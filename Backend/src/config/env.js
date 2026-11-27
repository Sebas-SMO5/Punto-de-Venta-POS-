// Lee y valida las variables de entorno (archivo .env) en un solo lugar.
// Si falta algo importante, el servidor avisa al arrancar en vez de fallar
// más tarde con un error difícil de entender.
const path = require('path')

// Se carga el .env de la carpeta Backend, sin importar desde dónde se ejecute
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

const config = {
  isProduction,
  isTest,
  port: Number(process.env.PORT) || 3000,

  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },

  jwtSecret: process.env.JWT_SECRET || '',
  // Duración del Access Token (corto) y del Refresh Token (largo)
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  // Cuántas sesiones (dispositivos) puede tener abiertas un usuario a la vez
  maxSessionsPerUser: Number(process.env.MAX_SESSIONS_PER_USER) || 5,
  // Margen (ms) para cuando dos pestañas renuevan la sesión a la vez
  refreshGraceMs: Number(process.env.REFRESH_GRACE_MS ?? 15000),

  // Cookie "Secure": solo viaja por HTTPS. Los navegadores aceptan
  // http://localhost como seguro, así que funciona también en desarrollo.
  cookieSecure: process.env.COOKIE_SECURE !== 'false',

  // Orígenes permitidos para CORS (separados por coma)
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

function assertConfig() {
  if (!config.jwtSecret || config.jwtSecret.length < 16) {
    throw new Error(
      'JWT_SECRET no está configurado en el archivo .env (mínimo 16 caracteres)'
    )
  }
}

module.exports = config
module.exports.assertConfig = assertConfig
