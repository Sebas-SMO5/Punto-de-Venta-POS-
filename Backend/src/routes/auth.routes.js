// Rutas de inicio de sesión y manejo de sesiones (/api/auth/...)
const { Router } = require('express')
const controller = require('../controllers/auth.controller')
const { authenticate } = require('../middlewares/auth.middleware')
const { loginLimiter } = require('../middlewares/rateLimit.middleware')
const validate = require('../middlewares/validate.middleware')
const { loginBody, sessionIdParam } = require('../validators/schemas')

const router = Router()

// Públicas (no necesitan Access Token)
router.post('/login', loginLimiter, validate({ body: loginBody }), controller.login)
router.post('/refresh', controller.refresh)
router.post('/logout', controller.logout)

// Necesitan Access Token
router.get('/profile', authenticate, controller.getProfile)
router.get('/sessions', authenticate, controller.listSessions)
router.delete(
  '/sessions/:sessionId',
  authenticate,
  validate({ params: sessionIdParam }),
  controller.revokeSession
)
router.post('/logout-all', authenticate, controller.logoutAll)

module.exports = router
