// Junta todas las rutas de la API en un solo lugar.
// Todas, menos /health y /auth, exigen haber iniciado sesión.
const { Router } = require('express')
const { authenticate } = require('../middlewares/auth.middleware')

const router = Router()

router.use('/health', require('./health.routes'))
router.use('/auth', require('./auth.routes'))

// A partir de aquí, toda ruta necesita un Access Token válido
router.use(authenticate)

router.use('/products', require('./products.routes'))
router.use('/categories', require('./categories.routes'))
router.use('/inventory', require('./inventory.routes'))
router.use('/tables', require('./tables.routes'))
router.use('/orders', require('./orders.routes'))
router.use('/sales', require('./sales.routes'))
router.use('/payment-methods', require('./paymentMethods.routes'))
router.use('/users', require('./users.routes'))

module.exports = router
