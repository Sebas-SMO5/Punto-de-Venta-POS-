// Pruebas unitarias del manejador global de errores.
process.env.NODE_ENV = 'test'

const test = require('node:test')
const assert = require('node:assert/strict')
const errorHandler = require('../../src/middlewares/error.middleware')
const AppError = require('../../src/utils/AppError')

function fakeResponse() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

const req = { method: 'GET', originalUrl: '/api/x', correlationId: 'abc-123-def' }

test('responde con el código y mensaje de un AppError', () => {
  const res = fakeResponse()
  errorHandler(AppError.notFound('No existe'), req, res, () => {})

  assert.equal(res.statusCode, 404)
  assert.equal(res.body.mensaje, 'No existe')
  assert.equal(res.body.correlationId, 'abc-123-def')
})

test('un 409 incluye los detalles del conflicto', () => {
  const res = fakeResponse()
  errorHandler(AppError.conflict('Cambiado', { server: { version: 4 } }), req, res, () => {})

  assert.equal(res.statusCode, 409)
  assert.deepEqual(res.body.detalles, { server: { version: 4 } })
})

test('un error interno no muestra detalles técnicos', () => {
  const res = fakeResponse()
  const original = console.error
  console.error = () => {}

  try {
    errorHandler(new Error('password authentication failed for user postgres'), req, res, () => {})
  } finally {
    console.error = original
  }

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.mensaje, 'Error interno del servidor')
})

test('traduce un dato duplicado de PostgreSQL a 409', () => {
  const res = fakeResponse()
  const error = Object.assign(new Error('duplicate key'), { code: '23505' })
  errorHandler(error, req, res, () => {})

  assert.equal(res.statusCode, 409)
})
