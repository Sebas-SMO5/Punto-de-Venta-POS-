// Rutas de inventario (/api/inventory). Lo consultan administrador y cajero.
const { Router } = require('express')
const controller = require('../controllers/inventory.controller')
const { authorize } = require('../middlewares/auth.middleware')

const router = Router()

router.get('/', authorize('admin', 'cashier'), controller.getInventory)

module.exports = router
