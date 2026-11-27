// Punto de arranque del backend: revisa la configuración, aplica las
// migraciones pendientes, inicia las tareas periódicas y pone a escuchar
// el servidor en el puerto configurado.
const config = require('./config/env')
const app = require('./app')
const pool = require('./config/database')
const logger = require('./utils/logger')
const { queue } = require('./utils/jobQueue')
const { migrate } = require('./scripts/migrate')
const { ensureInitialAdmin } = require('./scripts/ensure-admin')
const sessionsRepository = require('./repositories/sessions.repository')

async function start() {
  config.assertConfig()

  await pool.query('SELECT 1')
  logger.info('Conexión establecida con PostgreSQL')

  // Deja la base de datos al día antes de atender peticiones
  await migrate({ silent: true })

  // Crea el primer administrador si se configuró ADMIN_USERNAME/ADMIN_PASSWORD
  await ensureInitialAdmin()

  // Cada hora se borran de la base los refresh tokens vencidos
  queue.register('cleanup-refresh-tokens', async () => {
    const deleted = await sessionsRepository.deleteExpired()
    if (deleted) logger.info('Tokens vencidos eliminados', { deleted })
  })
  setInterval(() => queue.add('cleanup-refresh-tokens'), 60 * 60 * 1000).unref()

  const server = app.listen(config.port, () => {
    logger.info(`Backend ejecutándose en http://localhost:${config.port}`)
  })

  // Apagado ordenado (Ctrl+C o cuando la nube reinicia el servicio)
  const shutdown = () => {
    logger.info('Cerrando el servidor...')
    server.close(() => pool.end().finally(() => process.exit(0)))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start().catch((error) => {
  logger.error('No se pudo iniciar el servidor', { error: error.message })
  process.exit(1)
})
