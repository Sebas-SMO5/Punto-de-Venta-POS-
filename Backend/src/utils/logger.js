// Logs estructurados: cada línea es un objeto JSON con la hora, el nivel,
// el mensaje y el correlationId de la petición. Así, si algo falla, se
// pueden buscar todas las líneas de una misma petición por su id.
const { AsyncLocalStorage } = require('async_hooks')

const requestContext = new AsyncLocalStorage()

function write(level, message, extra = {}) {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return

  const context = requestContext.getStore() || {}
  const line = {
    time: new Date().toISOString(),
    level,
    message,
    correlationId: context.correlationId,
    ...extra
  }

  const output = JSON.stringify(line)

  if (level === 'error') console.error(output)
  else console.log(output)
}

module.exports = {
  requestContext,
  info: (message, extra) => write('info', message, extra),
  warn: (message, extra) => write('warn', message, extra),
  error: (message, extra) => write('error', message, extra)
}
