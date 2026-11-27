// Error "con código HTTP". Los servicios lanzan, por ejemplo,
//   throw AppError.notFound('Producto no encontrado')
// y el manejador global de errores sabe qué responder al navegador.
class AppError extends Error {
  constructor(message, status = 500, details = undefined) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.details = details
  }

  static badRequest(message, details) {
    return new AppError(message, 400, details)
  }

  static unauthorized(message = 'Autenticación requerida') {
    return new AppError(message, 401)
  }

  static forbidden(message = 'No tiene permisos para esta acción') {
    return new AppError(message, 403)
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(message, 404)
  }

  // 409 = conflicto: los datos cambiaron en el servidor desde que el
  // dispositivo los leyó. "details" lleva la versión actual del servidor.
  static conflict(message, details) {
    return new AppError(message, 409, details)
  }
}

module.exports = AppError
