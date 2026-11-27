// Manejador GLOBAL de errores. Cualquier error que ocurra en una ruta
// termina aquí. Decide el código HTTP, escribe el log y responde siempre
// con el mismo formato: { mensaje, correlationId, detalles? }.
// Los errores internos (500) nunca muestran detalles técnicos al usuario.
const AppError = require('../utils/AppError')
const logger = require('../utils/logger')

// Códigos de error de PostgreSQL que conviene traducir
const PG_ERRORS = {
  '23505': { status: 409, mensaje: 'Ya existe un registro con esos datos' },
  '23503': { status: 400, mensaje: 'El registro está relacionado con datos que no existen' },
  '23514': { status: 400, mensaje: 'Los datos no cumplen las reglas de la base de datos' },
  '22P02': { status: 400, mensaje: 'Formato de dato inválido' }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500
  let mensaje = 'Error interno del servidor'
  let detalles

  if (err.type === 'entity.parse.failed') {
    status = 400
    mensaje = 'El cuerpo de la petición no es un JSON válido'
  } else if (err instanceof AppError || (err.status && err.status < 500)) {
    status = err.status
    mensaje = err.message
    detalles = err.details
  } else if (err.code && PG_ERRORS[err.code]) {
    status = PG_ERRORS[err.code].status
    mensaje = PG_ERRORS[err.code].mensaje
  }

  const logData = {
    status,
    method: req.method,
    path: req.originalUrl,
    error: err.message
  }

  if (status >= 500) {
    logger.error('Error no controlado', { ...logData, stack: err.stack })
  } else {
    logger.warn('Petición rechazada', logData)
  }

  res.status(status).json({
    mensaje,
    correlationId: req.correlationId,
    ...(detalles !== undefined && { detalles })
  })
}

module.exports = errorHandler
