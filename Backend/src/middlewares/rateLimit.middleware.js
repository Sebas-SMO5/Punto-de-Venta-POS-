// Límite de peticiones (rate limiting).
// Evita que alguien pruebe miles de contraseñas seguidas (fuerza bruta)
// o que sature el servidor con demasiadas peticiones.
const { rateLimit } = require('express-rate-limit')

const message = (mensaje) => ({ mensaje })

// Inicio de sesión: máximo 10 intentos fallidos cada 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Demasiados intentos de inicio de sesión. Espere unos minutos.')
})

// Resto de la API: 300 peticiones por minuto por IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Demasiadas peticiones. Intente de nuevo en un momento.')
})

module.exports = {
  loginLimiter,
  apiLimiter
}
