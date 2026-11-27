// Conexión con PostgreSQL.
// En la nube (Render, Railway, etc.) se usa una sola variable DATABASE_URL.
// En el computador de cada integrante se usan DB_HOST, DB_PORT, DB_NAME...
const { Pool } = require('pg')
const config = require('./env')

const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
    })
  : new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password
    })

pool.on('error', (error) => {
  console.error('Error inesperado en PostgreSQL:', error.message)
})

module.exports = pool
