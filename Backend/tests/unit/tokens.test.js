// Pruebas unitarias de la creación y verificación de tokens.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto_de_prueba_suficientemente_largo'

const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken
} = require('../../src/utils/tokens')

const user = { id: 7, username: 'ana', role: 'cashier' }

test('el access token contiene el usuario, el rol y la sesión', () => {
  const token = signAccessToken(user, 'sesion-1')
  const data = verifyAccessToken(token)

  assert.deepEqual(data, { id: 7, username: 'ana', role: 'cashier', sessionId: 'sesion-1' })
})

test('un access token alterado no es válido', () => {
  const token = signAccessToken(user, 'sesion-1')
  const [header, , signature] = token.split('.')
  const fakePayload = Buffer.from(JSON.stringify({ sub: 7, role: 'admin' })).toString('base64url')

  assert.throws(() => verifyAccessToken(`${header}.${fakePayload}.${signature}`))
})

test('un access token firmado con otra clave no es válido', () => {
  const token = jwt.sign({ sub: 7, role: 'admin' }, 'otra-clave-cualquiera')
  assert.throws(() => verifyAccessToken(token))
})

test('los refresh tokens son aleatorios y largos', () => {
  const a = generateRefreshToken()
  const b = generateRefreshToken()

  assert.notEqual(a, b)
  assert.ok(a.length >= 60)
})

test('el hash del refresh token es siempre el mismo y no revela el token', () => {
  const token = generateRefreshToken()

  assert.equal(hashToken(token), hashToken(token))
  assert.equal(hashToken(token).length, 64)
  assert.ok(!hashToken(token).includes(token))
})
