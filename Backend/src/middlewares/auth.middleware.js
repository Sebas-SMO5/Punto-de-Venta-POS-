// Middlewares de seguridad:
//
// authenticate -> revisa que la petición traiga un Access Token válido y
//                 que su sesión no haya sido cerrada/revocada.
// authorize    -> revisa que el rol del usuario tenga permiso (RBAC).
const AppError = require('../utils/AppError')
const { verifyAccessToken } = require('../utils/tokens')
const sessionsRepository = require('../repositories/sessions.repository')

async function authenticate(req, res, next) {
  const authorization = req.get('authorization') || ''

  if (!authorization.startsWith('Bearer ')) {
    return next(AppError.unauthorized())
  }

  let user

  try {
    user = verifyAccessToken(authorization.slice(7))
  } catch {
    return next(AppError.unauthorized('Sesión inválida o expirada'))
  }

  try {
    // Si la sesión se cerró (por ejemplo con "cerrar todas las sesiones"),
    // el Access Token deja de servir de inmediato aunque no haya vencido.
    const active = await sessionsRepository.isFamilyActive(user.sessionId, user.id)

    if (!active) {
      return next(AppError.unauthorized('La sesión fue cerrada'))
    }

    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

// Ejemplo: router.post('/', authorize('admin'), controller.create)
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(AppError.unauthorized())

  if (!roles.includes(req.user.role)) {
    return next(AppError.forbidden())
  }

  next()
}

module.exports = {
  authenticate,
  authorize
}
