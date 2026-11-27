// Pruebas unitarias de las reglas de pedidos (máquina de estados y
// propiedad del recurso). No necesitan base de datos.
const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluateTransition, canModifyOrder } = require('../../src/domain/orderRules')

test('un pedido puede avanzar de estado', () => {
  assert.equal(evaluateTransition('pending', 'preparing'), 'apply')
  assert.equal(evaluateTransition('preparing', 'ready'), 'apply')
  assert.equal(evaluateTransition('pending', 'completed'), 'apply')
})

test('un pedido no puede retroceder de estado', () => {
  assert.equal(evaluateTransition('ready', 'pending'), 'conflict')
  assert.equal(evaluateTransition('preparing', 'pending'), 'conflict')
})

test('un pedido finalizado no se puede cambiar', () => {
  assert.equal(evaluateTransition('completed', 'cancelled'), 'conflict')
  assert.equal(evaluateTransition('cancelled', 'completed'), 'conflict')
})

test('repetir el mismo estado no hace nada (idempotencia)', () => {
  assert.equal(evaluateTransition('completed', 'completed'), 'noop')
  assert.equal(evaluateTransition('cancelled', 'cancelled'), 'noop')
})

test('se puede cancelar desde cualquier estado no final', () => {
  for (const status of ['pending', 'preparing', 'ready']) {
    assert.equal(evaluateTransition(status, 'cancelled'), 'apply')
  }
})

test('la resolución es determinística: gana el estado más avanzado', () => {
  // Dos dispositivos sin conexión: uno completa, otro marca "preparing".
  // Sin importar el orden de llegada, el resultado final es "completed".
  const applyAll = (start, changes) =>
    changes.reduce(
      (status, next) => (evaluateTransition(status, next) === 'apply' ? next : status),
      start
    )

  assert.equal(applyAll('pending', ['completed', 'preparing']), 'completed')
  assert.equal(applyAll('pending', ['preparing', 'completed']), 'completed')
})

test('administrador y cajero pueden modificar cualquier pedido', () => {
  const order = { user_id: 99 }
  assert.equal(canModifyOrder({ id: 1, role: 'admin' }, order), true)
  assert.equal(canModifyOrder({ id: 2, role: 'cashier' }, order), true)
})

test('un mesero solo puede modificar sus propios pedidos', () => {
  assert.equal(canModifyOrder({ id: 3, role: 'waiter' }, { user_id: 3 }), true)
  assert.equal(canModifyOrder({ id: 3, role: 'waiter' }, { user_id: 4 }), false)
})
