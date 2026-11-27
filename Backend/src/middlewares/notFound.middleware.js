// Responde 404 cuando se pide una ruta de la API que no existe.
const AppError = require('../utils/AppError')

function notFound(req, res, next) {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`))
}

module.exports = notFound
