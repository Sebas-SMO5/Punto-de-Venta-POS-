// Lógica del inicio de sesión con doble token.
//
// login   -> revisa usuario y contraseña, abre una sesión nueva y entrega
//            un Access Token (corto) y un Refresh Token (largo).
// refresh -> cambia un Refresh Token por uno nuevo (ROTACIÓN). El viejo
//            queda marcado como usado. Si alguien intenta usar un token
//            viejo otra vez, se asume que fue robado y se cierra toda la
//            sesión (detección de reutilización).
// logout / logoutAll / revokeSession -> cierran sesiones.
const { randomUUID } = require('crypto')
const bcrypt = require('bcryptjs')
const pool = require('../config/database')
const config = require('../config/env')
const AppError = require('../utils/AppError')
const logger = require('../utils/logger')
const usersRepository = require('../repositories/users.repository')
const sessionsRepository = require('../repositories/sessions.repository')
const {
  signAccessToken,
  generateRefreshToken,
  hashToken
} = require('../utils/tokens')

// Si dos pestañas renuevan el token al mismo tiempo, la segunda llega con
// el token que la primera acaba de usar. Durante estos segundos no se
// considera robo: se le pide al navegador que reintente con la cookie nueva.
const REFRESH_GRACE_MS = config.refreshGraceMs

// Hash falso para que "usuario no existe" tarde lo mismo que
// "contraseña incorrecta" y no se pueda adivinar qué usuarios existen.
const DUMMY_HASH = bcrypt.hashSync('usuario-inexistente', 10)

function publicUser(user) {
  return {
    id: Number(user.id),
    username: user.username,
    fullName: user.full_name,
    role: user.role
  }
}

function refreshExpiry() {
  return new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000)
}

async function issueTokens(db, user, familyId, meta) {
  const refreshToken = generateRefreshToken()
  const expiresAt = refreshExpiry()

  await sessionsRepository.create(db, {
    userId: user.id,
    familyId,
    tokenHash: hashToken(refreshToken),
    userAgent: meta.userAgent,
    ip: meta.ip,
    expiresAt
  })

  return {
    accessToken: signAccessToken(user, familyId),
    refreshToken,
    refreshExpiresAt: expiresAt,
    user: publicUser(user)
  }
}

async function login(username, password, meta = {}) {
  const user = await usersRepository.findByUsername(username)
  const passwordValid = await bcrypt.compare(password, user?.password || DUMMY_HASH)

  if (!user || !passwordValid) {
    throw AppError.unauthorized('Credenciales incorrectas')
  }

  if (user.active === false) {
    throw AppError.unauthorized('El usuario está desactivado')
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Límite de sesiones simultáneas: si el usuario ya tiene el máximo,
    // se cierran las más antiguas.
    const active = await sessionsRepository.listActive(client, user.id)

    for (const session of active.slice(config.maxSessionsPerUser - 1)) {
      await sessionsRepository.revokeFamily(client, session.family_id, 'session_limit')
    }

    const result = await issueTokens(client, user, randomUUID(), meta)

    await client.query('COMMIT')
    logger.info('Inicio de sesión', { userId: user.id })

    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function refresh(rawToken, meta = {}) {
  if (!rawToken) {
    throw AppError.unauthorized('No hay una sesión activa')
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const stored = await sessionsRepository.findByHashForUpdate(client, hashToken(rawToken))

    if (!stored) {
      await client.query('ROLLBACK')
      throw AppError.unauthorized('Sesión inválida')
    }

    if (stored.revoked_at) {
      await client.query('ROLLBACK')
      throw AppError.unauthorized('La sesión fue cerrada')
    }

    if (stored.used_at) {
      const usedAgo = Date.now() - new Date(stored.used_at).getTime()

      if (usedAgo <= REFRESH_GRACE_MS) {
        await client.query('ROLLBACK')
        const error = AppError.unauthorized('La sesión se está renovando, reintente')
        error.details = { code: 'REFRESH_RACE' }
        throw error
      }

      // Token viejo usado de nuevo: posible robo. Se cierra toda la familia.
      await sessionsRepository.revokeFamily(client, stored.family_id, 'reuse_detected')
      await client.query('COMMIT')
      logger.warn('Reutilización de refresh token detectada', {
        userId: stored.user_id,
        familyId: stored.family_id
      })
      throw AppError.unauthorized('Sesión inválida. Inicie sesión de nuevo')
    }

    if (new Date(stored.expires_at) <= new Date()) {
      await client.query('ROLLBACK')
      throw AppError.unauthorized('La sesión expiró')
    }

    const user = await usersRepository.findById(stored.user_id)

    if (!user || !user.active) {
      await sessionsRepository.revokeFamily(client, stored.family_id, 'user_inactive')
      await client.query('COMMIT')
      throw AppError.unauthorized('El usuario está desactivado')
    }

    await sessionsRepository.markUsed(client, stored.id)
    const result = await issueTokens(client, user, stored.family_id, meta)

    await client.query('COMMIT')
    return result
  } catch (error) {
    if (!(error instanceof AppError)) {
      await client.query('ROLLBACK').catch(() => {})
    }
    throw error
  } finally {
    client.release()
  }
}

async function logout(rawToken) {
  if (!rawToken) return

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const stored = await sessionsRepository.findByHashForUpdate(client, hashToken(rawToken))

    if (stored) {
      await sessionsRepository.revokeFamily(client, stored.family_id, 'logout')
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function logoutAll(userId) {
  return sessionsRepository.revokeAllForUser(pool, userId, 'logout_all')
}

async function listSessions(userId, currentSessionId) {
  const sessions = await sessionsRepository.listActive(pool, userId)

  return sessions.map(session => ({
    id: session.family_id,
    startedAt: session.started_at,
    lastActivityAt: session.last_refresh_at,
    userAgent: session.user_agent,
    ipAddress: session.ip_address,
    current: session.family_id === currentSessionId
  }))
}

async function revokeSession(userId, sessionId) {
  const sessions = await sessionsRepository.listActive(pool, userId)

  // Validación de propiedad: solo se pueden cerrar sesiones propias
  if (!sessions.some(session => session.family_id === sessionId)) {
    throw AppError.notFound('Sesión no encontrada')
  }

  await sessionsRepository.revokeFamily(pool, sessionId, 'revoked_by_user')
}

async function getProfile(userId) {
  const user = await usersRepository.findById(userId)

  if (!user) throw AppError.notFound('Usuario no encontrado')

  return publicUser(user)
}

module.exports = {
  login,
  refresh,
  logout,
  logoutAll,
  listSessions,
  revokeSession,
  getProfile,
  REFRESH_GRACE_MS
}
