require('dotenv').config()

const express = require('express')
const cors = require('cors')
const pool = require('./config/database')

const productsRoutes = require('./routes/products.routes')
const ordersRoutes = require('./routes/orders.routes')
const categoriesRoutes = require('./routes/categories.routes')
const inventoryRoutes = require('./routes/inventory.routes')
const salesRoutes = require('./routes/sales.routes')
const tablesRoutes = require('./routes/tables.routes')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS fecha')

    res.json({
      mensaje: 'Backend del POS funcionando correctamente',
      estado: 'OK',
      database: 'Conectada',
      fecha: result.rows[0].fecha
    })
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al conectar con PostgreSQL',
      estado: 'ERROR'
    })
  }
})

app.use('/api/products', productsRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/tables', tablesRoutes)

app.use((err, req, res, next) => {
  console.error(err.message)

  res.status(err.status || 500).json({
    mensaje: err.status ? err.message : 'Error interno del servidor'
  })
})

pool.query('SELECT NOW()')
  .then(() => {
    console.log('Conexión establecida con PostgreSQL')

    app.listen(PORT, () => {
      console.log(`Backend ejecutándose en http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('No se pudo conectar con PostgreSQL:', error.message)
    process.exit(1)
  })