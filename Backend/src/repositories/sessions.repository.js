// Acceso a la tabla refresh_tokens (las sesiones abiertas).
// Una "familia" (family_id) = una sesión en un dispositivo. Cada vez que
// se renueva el token, se agrega una fila nueva a la misma familia.
const pool = require('../config/database')

async function create(db, { userId, familyId, tokenHash, userAgent, ip, expiresAt }) {
  await db.query(
    `INSERT INTO refresh_tokens
       (user_id, family_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, familyId, tokenHash, userAgent?.slice(0, 255) || null, ip || null, expiresAt]
  )
}

// Busca el token y bloquea la fila (FOR UPDATE) para que dos peticiones
// simultáneas no puedan usar el mismo token al mismo tiempo.
async function findByHashForUpdate(db, tokenHash) {
  const result = await db.query(
    `SELECT id, user_id, family_id, expires_at, used_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1
     FOR UPDATE`,
    [tokenHash]
  )

  return result.rows[0] || null
}

async function markUsed(db, id) {
  await db.query('UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1', [id])
}

async function revokeFamily(db, familyId, reason) {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(), revoked_reason = $2
     WHERE family_id = $1 AND revoked_at IS NULL`,
    [familyId, reason]
  )
}

async function revokeAllForUser(db, userId, reason) {
  const result = await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(), revoked_reason = $2
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason]
  )

  return result.rowCount
}

// Sesiones activas de un usuario, de la más reciente a la más antigua
async function listActive(db, userId) {
  const result = await db.query(
    `SELECT
       family_id,
       MIN(created_at) AS started_at,
       MAX(created_at) AS last_refresh_at,
       (ARRAY_AGG(user_agent ORDER BY created_at DESC))[1] AS user_agent,
       (ARRAY_AGG(ip_address ORDER BY created_at DESC))[1] AS ip_address
     FROM refresh_tokens
     WHERE user_id = $1
     GROUP BY family_id
     HAVING BOOL_OR(revoked_at IS NULL AND expires_at > NOW())
     ORDER BY MAX(created_at) DESC`,
    [userId]
  )

  return result.rows
}

async function isFamilyActive(familyId, userId) {
  if (!familyId) return false

  const result = await pool.query(
    `SELECT 1
     FROM refresh_tokens
     WHERE family_id = $1 AND user_id = $2
       AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [familyId, userId]
  )

  return result.rowCount > 0
}

async function deleteExpired() {
  const result = await pool.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW() - INTERVAL '1 day'`
  )

  return result.rowCount
}

module.exports = {
  create,
  findByHashForUpdate,
  markUsed,
  revokeFamily,
  revokeAllForUser,
  listActive,
  isFamilyActive,
  deleteExpired
}
