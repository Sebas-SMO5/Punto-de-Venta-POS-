const jwt = require('jsonwebtoken')

const authenticate = (req, res, next) => {
  const authorization = req.headers.authorization

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Autenticación requerida' })
  }

  try {
    const token = authorization.slice(7)
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (error) {
    return res.status(401).json({ mensaje: 'Sesión inválida o expirada' })
  }
}

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ mensaje: 'No tiene permisos para esta acción' })
  }

  next()
}

module.exports = {
  authenticate,
  authorize
}
