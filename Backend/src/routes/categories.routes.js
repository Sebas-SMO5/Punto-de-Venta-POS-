// Rutas de categorías (/api/categories). Todos las ven; solo el
// administrador las crea, edita o desactiva.
const { Router } = require('express')
const controller = require('../controllers/categories.controller')
const { authorize } = require('../middlewares/auth.middleware')
const validate = require('../middlewares/validate.middleware')
const { idParam, categoryBody } = require('../validators/schemas')

const router = Router()

router.get('/', controller.getCategories)
router.get('/:id', validate({ params: idParam }), controller.getCategory)
router.post('/', authorize('admin'), validate({ body: categoryBody }), controller.createCategory)
router.put(
  '/:id',
  authorize('admin'),
  validate({ params: idParam, body: categoryBody }),
  controller.updateCategory
)
router.delete('/:id', authorize('admin'), validate({ params: idParam }), controller.deactivateCategory)

module.exports = router
