// Pruebas unitarias de la cola de tareas en memoria.
process.env.NODE_ENV = 'test'

const test = require('node:test')
const assert = require('node:assert/strict')
const { JobQueue } = require('../../src/utils/jobQueue')

test('ejecuta las tareas encoladas', async () => {
  const queue = new JobQueue()
  const done = []

  queue.register('saludar', async ({ nombre }) => done.push(nombre))
  queue.add('saludar', { nombre: 'Ana' })
  queue.add('saludar', { nombre: 'Luis' })

  await queue.drain()

  assert.deepEqual(done, ['Ana', 'Luis'])
  assert.equal(queue.stats().processed, 2)
})

test('reintenta una tarea que falla y luego funciona', async () => {
  const queue = new JobQueue({ baseDelayMs: 5 })
  let attempts = 0

  queue.register('inestable', async () => {
    attempts++
    if (attempts < 3) throw new Error('falla temporal')
  })

  queue.add('inestable')
  await new Promise(resolve => setTimeout(resolve, 100))
  await queue.drain()

  assert.equal(attempts, 3)
  assert.equal(queue.stats().processed, 1)
  assert.equal(queue.stats().failed, 0)
})

test('descarta la tarea después del máximo de intentos', async () => {
  const queue = new JobQueue({ baseDelayMs: 5, maxAttempts: 2 })

  queue.register('rota', async () => {
    throw new Error('siempre falla')
  })

  queue.add('rota')
  await new Promise(resolve => setTimeout(resolve, 100))
  await queue.drain()

  assert.equal(queue.stats().failed, 1)
})

test('no permite encolar tareas desconocidas', () => {
  const queue = new JobQueue()
  assert.throws(() => queue.add('no-existe'))
})
