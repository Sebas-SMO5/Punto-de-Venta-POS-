// Rutas de medios de pago (/api/payment-methods): efectivo, tarjeta, etc.
const { Router } = require('express')
const controller = require('../controllers/sales.controller')

const router = Router()

router.get('/', controller.getPaymentMethods)

module.exports = router
