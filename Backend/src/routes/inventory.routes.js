// Rutas de inventario (/api/inventory). Las usan administrador y cajero.
// Los ajustes (conteo físico) solo el administrador: se revisa en el servicio.
const { Router } = require('express')
const controller = require('../controllers/inventory.controller')
const { authorize } = require('../middlewares/auth.middleware')
const validate = require('../middlewares/validate.middleware')
const { inventoryMovementBody, movementsQuery } = require('../validators/schemas')

const router = Router()

router.use(authorize('admin', 'cashier'))

router.get('/', controller.getInventory)
router.get('/movements', validate({ query: movementsQuery }), controller.getMovements)
router.post('/movements', validate({ body: inventoryMovementBody }), controller.createMovement)

module.exports = router
