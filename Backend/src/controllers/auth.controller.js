// Controlador de autenticación: recibe la petición HTTP, llama al servicio
// y arma la respuesta. Aquí se maneja la cookie del Refresh Token.
const config = require('../config/env')
const authService = require('../services/auth.service')

const REFRESH_COOKIE = 'pos_refresh'

// La cookie es:
//  - HttpOnly: JavaScript del navegador NO la puede leer (protege de XSS)
//  - SameSite=Strict: no se envía desde otros sitios (protege de CSRF)
//  - Secure: solo viaja por HTTPS (localhost cuenta como seguro)
//  - path=/api/auth: solo se envía a las rutas de autenticación
function cookieOptions(expires) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/api/auth',
    ...(expires && { expires })
  }
}

function requestMeta(req) {
  return {
    userAgent: req.get('user-agent'),
    ip: req.ip
  }
}

function sendSession(res, result) {
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions(result.refreshExpiresAt))

  // El Refresh Token NO va en el cuerpo de la respuesta: solo en la cookie
  res.json({
    accessToken: result.accessToken,
    user: result.user
  })
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body
    const result = await authService.login(username, password, requestMeta(req))
    sendSession(res, result)
  } catch (error) {
    next(error)
  }
}

async function refresh(req, res, next) {
  try {
    const result = await authService.refresh(req.cookies?.[REFRESH_COOKIE], requestMeta(req))
    sendSession(res, result)
  } catch (error) {
    if (error.status === 401 && error.details?.code !== 'REFRESH_RACE') {
      res.clearCookie(REFRESH_COOKIE, cookieOptions())
    }
    next(error)
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.cookies?.[REFRESH_COOKIE])
    res.clearCookie(REFRESH_COOKIE, cookieOptions())
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}

async function logoutAll(req, res, next) {
  try {
    const closed = await authService.logoutAll(req.user.id)
    res.clearCookie(REFRESH_COOKIE, cookieOptions())
    res.json({ mensaje: 'Se cerraron todas las sesiones', sesionesCerradas: closed })
  } catch (error) {
    next(error)
  }
}

async function getProfile(req, res, next) {
  try {
    res.json(await authService.getProfile(req.user.id))
  } catch (error) {
    next(error)
  }
}

async function listSessions(req, res, next) {
  try {
    res.json(await authService.listSessions(req.user.id, req.user.sessionId))
  } catch (error) {
    next(error)
  }
}

async function revokeSession(req, res, next) {
  try {
    await authService.revokeSession(req.user.id, req.params.sessionId)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}

module.exports = {
  REFRESH_COOKIE,
  login,
  refresh,
  logout,
  logoutAll,
  getProfile,
  listSessions,
  revokeSession
}
