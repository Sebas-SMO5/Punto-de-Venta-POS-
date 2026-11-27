// Rutas de productos (/api/products). Todos ven el menú; solo el
// administrador puede crear, editar o desactivar productos.
const { Router } = require('express')
const controller = require('../controllers/products.controller')
const { authorize } = require('../middlewares/auth.middleware')
const validate = require('../middlewares/validate.middleware')
const { idParam, productCreateBody, productUpdateBody } = require('../validators/schemas')

const router = Router()

router.get('/', controller.getProducts)
router.get('/:id', validate({ params: idParam }), controller.getProductById)
router.post('/', authorize('admin'), validate({ body: productCreateBody }), controller.createProduct)
router.put(
  '/:id',
  authorize('admin'),
  validate({ params: idParam, body: productUpdateBody }),
  controller.updateProduct
)
router.delete('/:id', authorize('admin'), validate({ params: idParam }), controller.deleteProduct)

module.exports = router
