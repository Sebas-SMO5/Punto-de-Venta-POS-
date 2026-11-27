// Cola de tareas en memoria.
// Sirve para hacer trabajos "en segundo plano" sin que el usuario tenga
// que esperar. Ejemplo: después de registrar una venta se encola la tarea
// de revisar si algún producto quedó con poco stock; la venta responde de
// inmediato y la revisión se hace un instante después.
// Si una tarea falla se reintenta con espera creciente (1s, 2s, 4s...).
const logger = require('./logger')

class JobQueue {
  constructor({ concurrency = 1, maxAttempts = 3, baseDelayMs = 1000 } = {}) {
    this.handlers = new Map()
    this.jobs = []
    this.running = 0
    this.concurrency = concurrency
    this.maxAttempts = maxAttempts
    this.baseDelayMs = baseDelayMs
    this.processed = 0
    this.failed = 0
  }

  // Registra la función que sabe hacer un tipo de tarea
  register(name, handler) {
    this.handlers.set(name, handler)
  }

  // Agrega una tarea a la fila
  add(name, payload = {}) {
    if (!this.handlers.has(name)) {
      throw new Error(`No hay un manejador registrado para la tarea "${name}"`)
    }

    this.jobs.push({ name, payload, attempts: 0 })
    setImmediate(() => this.next())
  }

  next() {
    while (this.running < this.concurrency && this.jobs.length) {
      const job = this.jobs.shift()
      this.run(job)
    }
  }

  async run(job) {
    this.running++
    job.attempts++

    try {
      await this.handlers.get(job.name)(job.payload)
      this.processed++
    } catch (error) {
      if (job.attempts < this.maxAttempts) {
        const delay = this.baseDelayMs * 2 ** (job.attempts - 1)
        logger.warn('Tarea fallida, se reintentará', {
          job: job.name,
          attempts: job.attempts,
          delayMs: delay,
          error: error.message
        })
        setTimeout(() => {
          this.jobs.push(job)
          this.next()
        }, delay).unref()
      } else {
        this.failed++
        logger.error('Tarea descartada tras varios intentos', {
          job: job.name,
          error: error.message
        })
      }
    } finally {
      this.running--
      this.next()
    }
  }

  // Espera a que no queden tareas (se usa en las pruebas)
  async drain() {
    while (this.jobs.length || this.running) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  stats() {
    return {
      pending: this.jobs.length,
      running: this.running,
      processed: this.processed,
      failed: this.failed
    }
  }
}

module.exports = { JobQueue, queue: new JobQueue() }
