// Rutas de usuarios (/api/users). Solo el administrador.
// No hay "borrar": los usuarios se DESACTIVAN, porque sus pedidos y ventas
// deben seguir mostrando quién los hizo.
const { Router } = require('express')
const controller = require('../controllers/users.controller')
const { authorize } = require('../middlewares/auth.middleware')
const validate = require('../middlewares/validate.middleware')
const { idParam, userCreateBody, userUpdateBody } = require('../validators/schemas')

const router = Router()

router.use(authorize('admin'))

router.get('/', controller.getUsers)
router.post('/', validate({ body: userCreateBody }), controller.createUser)
router.patch('/:id', validate({ params: idParam, body: userUpdateBody }), controller.updateUser)

module.exports = router
