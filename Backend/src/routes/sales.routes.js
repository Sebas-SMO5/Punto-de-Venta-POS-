// Rutas de ventas (/api/sales). Solo administrador y cajero cobran.
const { Router } = require('express')
const controller = require('../controllers/sales.controller')
const { authorize } = require('../middlewares/auth.middleware')
const validate = require('../middlewares/validate.middleware')
const { idParam, saleCreateBody } = require('../validators/schemas')

const router = Router()

router.use(authorize('admin', 'cashier'))

router.get('/', controller.getSales)
router.get('/:id', validate({ params: idParam }), controller.getSaleById)
router.post('/', validate({ body: saleCreateBody }), controller.createSale)

module.exports = router
