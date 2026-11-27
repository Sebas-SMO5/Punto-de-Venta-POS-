// Pruebas unitarias de los esquemas de validación (Zod).
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  productCreateBody,
  productUpdateBody,
  orderCreateBody,
  loginBody,
  idParam
} = require('../../src/validators/schemas')

test('acepta un producto válido y convierte el precio a número', () => {
  const result = productCreateBody.safeParse({
    name: '  Arepa  ',
    category: 'Comidas',
    price: '5000'
  })

  assert.equal(result.success, true)
  assert.equal(result.data.name, 'Arepa')
  assert.equal(result.data.price, 5000)
})

test('rechaza un precio negativo o cero', () => {
  assert.equal(productCreateBody.safeParse({ name: 'X', category: 'C', price: -1 }).success, false)
  assert.equal(productCreateBody.safeParse({ name: 'X', category: 'C', price: 0 }).success, false)
})

test('rechaza HTML en los textos (prevención de XSS)', () => {
  const result = productCreateBody.safeParse({
    name: '<script>alert(1)</script>',
    category: 'Comidas',
    price: 1000
  })

  assert.equal(result.success, false)
})

test('rechaza campos que no están permitidos', () => {
  const result = productCreateBody.safeParse({
    name: 'Arepa',
    category: 'Comidas',
    price: 1000,
    role: 'admin'
  })

  assert.equal(result.success, false)
})

test('al editar un producto no se permite cambiar el stock actual', () => {
  assert.equal(productUpdateBody.safeParse({ current_stock: 10 }).success, false)
  assert.equal(productUpdateBody.safeParse({ price: 2000, expectedVersion: 3 }).success, true)
})

test('un pedido necesita al menos un producto', () => {
  assert.equal(orderCreateBody.safeParse({ tableId: 1, items: [] }).success, false)
  assert.equal(
    orderCreateBody.safeParse({ tableId: 1, items: [{ productId: 1, quantity: 2 }] }).success,
    true
  )
})

test('el identificador local del pedido debe ser un UUID', () => {
  const base = { tableId: 1, items: [{ productId: 1, quantity: 1 }] }

  assert.equal(orderCreateBody.safeParse({ ...base, localId: 'abc' }).success, false)
  assert.equal(
    orderCreateBody.safeParse({ ...base, localId: '3f1c2b8e-9d4a-4c1e-8b7a-2e5f6a7b8c9d' }).success,
    true
  )
})

test('el login exige usuario y contraseña', () => {
  assert.equal(loginBody.safeParse({ username: '', password: 'x' }).success, false)
  assert.equal(loginBody.safeParse({ username: 'admin', password: 'x' }).success, true)
})

test('los identificadores deben ser enteros positivos', () => {
  assert.equal(idParam.safeParse({ id: '5' }).data.id, 5)
  assert.equal(idParam.safeParse({ id: '-1' }).success, false)
  assert.equal(idParam.safeParse({ id: "1' OR 1=1" }).success, false)
})
