// /api/health: dice si el servidor y la base de datos están funcionando.
// Lo usa la nube (Render) para saber si la aplicación está viva.
const { Router } = require('express')
const pool = require('../config/database')
const { queue } = require('../utils/jobQueue')

const router = Router()

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS fecha')

    res.json({
      estado: 'OK',
      database: 'Conectada',
      fecha: result.rows[0].fecha,
      colaDeTareas: queue.stats()
    })
  } catch {
    res.status(503).json({ estado: 'ERROR', database: 'Sin conexión' })
  }
})

module.exports = router
