// Rutas de pedidos (/api/orders). Todos los roles trabajan con pedidos,
// pero un mesero solo puede cambiar o cancelar SUS propios pedidos
// (esa revisión de "propiedad del recurso" se hace en el servicio).
const { Router } = require('express')
const controller = require('../controllers/orders.controller')
const validate = require('../middlewares/validate.middleware')
const { idParam, orderCreateBody, orderStatusBody } = require('../validators/schemas')

const router = Router()

router.get('/', controller.getOrders)
router.get('/:id', validate({ params: idParam }), controller.getOrderById)
router.post('/', validate({ body: orderCreateBody }), controller.createOrder)
router.patch(
  '/:id/status',
  validate({ params: idParam, body: orderStatusBody }),
  controller.updateOrderStatus
)
router.delete('/:id', validate({ params: idParam }), controller.cancelOrder)

module.exports = router
