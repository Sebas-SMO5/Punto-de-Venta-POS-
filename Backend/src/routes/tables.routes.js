// Rutas de mesas (/api/tables). Todos los roles pueden consultarlas.
const { Router } = require('express')
const controller = require('../controllers/tables.controller')
const validate = require('../middlewares/validate.middleware')
const { idParam } = require('../validators/schemas')

const router = Router()

router.get('/', controller.getTables)
router.get('/:id', validate({ params: idParam }), controller.getTableById)

module.exports = router
