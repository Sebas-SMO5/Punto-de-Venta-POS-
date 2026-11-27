// Le pone un número de seguimiento (x-correlation-id) a cada petición.
// Si el navegador ya mandó uno, se reutiliza; si no, se genera.
// El mismo id se devuelve en la respuesta y aparece en todos los logs de
// esa petición, para poder rastrear un error de punta a punta.
const { randomUUID } = require('crypto')
const logger = require('../utils/logger')

const VALID_ID = /^[A-Za-z0-9-]{8,64}$/

function correlationId(req, res, next) {
  const incoming = req.get('x-correlation-id')
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID()

  req.correlationId = id
  res.setHeader('x-correlation-id', id)

  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6

    logger.requestContext.run({ correlationId: id }, () => {
      logger.info('Petición atendida', {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        userId: req.user?.id
      })
    })
  })

  logger.requestContext.run({ correlationId: id }, () => next())
}

module.exports = correlationId
