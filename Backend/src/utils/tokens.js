// Funciones para crear y revisar los dos tokens del inicio de sesión:
//
// - Access Token (JWT): dura poco (15 min). El navegador lo guarda solo en
//   memoria y lo manda en cada petición (cabecera Authorization).
// - Refresh Token: un texto aleatorio largo que dura días. Viaja en una
//   cookie HttpOnly (JavaScript no la puede leer) y solo sirve para pedir
//   un Access Token nuevo. En la base de datos se guarda su huella SHA-256.
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const config = require('../config/env')

function signAccessToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, sid: sessionId },
    config.jwtSecret,
    { expiresIn: config.accessTokenTtl }
  )
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.jwtSecret)

  return {
    id: Number(payload.sub),
    username: payload.username,
    role: payload.role,
    sessionId: payload.sid
  }
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken
}
