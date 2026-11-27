// Pruebas de integración de permisos por rol (RBAC), propiedad de los
// pedidos y resolución de conflictos de sincronización.
const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('crypto')
const h = require('./helpers')

describe('Permisos y conflictos', async () => {
  const available = await h.databaseAvailable()
  let server
  let baseUrl
  let admin
  let waiter
  let otherWaiter
  let productId
  let tableId

  before(async () => {
    if (!available) return
    ;({ server, baseUrl } = await h.startServer())

    const users = await Promise.all([
      h.createUser('admin2', 'admin'),
      h.createUser('mesero', 'waiter'),
      h.createUser('mesero_b', 'waiter')
    ])
    admin = h.createClient(baseUrl)
    waiter = h.createClient(baseUrl)
    otherWaiter = h.createClient(baseUrl)
    await admin.login(users[0].username)
    await waiter.login(users[1].username)
    await otherWaiter.login(users[2].username)

    const product = await admin.request('POST', '/products', {
      name: `Prueba ${randomUUID().slice(0, 8)}`,
      category: 'Comidas',
      price: 10000,
      current_stock: 50,
      minimum_stock: 1
    })
    productId = product.body.id

    tableId = (await h.pool.query('SELECT id FROM restaurant_tables WHERE active = TRUE ORDER BY id LIMIT 1')).rows[0].id
  })

  after(async () => {
    if (!available) return
    await h.cleanup()
    server.close()
    await h.pool.end()
  })

  test('un mesero no puede crear productos (403)', { skip: !available }, async () => {
    const res = await waiter.request('POST', '/products', { name: 'Prueba X', category: 'Comidas', price: 1 })
    assert.equal(res.status, 403)
  })

  test('un mesero no puede ver ni registrar ventas (403)', { skip: !available }, async () => {
    assert.equal((await waiter.request('GET', '/sales')).status, 403)
    assert.equal((await waiter.request('POST', '/sales', { orderId: 1, paymentMethodId: 1 })).status, 403)
  })

  test('un mesero sí puede ver el menú y las mesas', { skip: !available }, async () => {
    assert.equal((await waiter.request('GET', '/products')).status, 200)
    assert.equal((await waiter.request('GET', '/tables')).status, 200)
  })

  test('un pedido enviado dos veces con el mismo localId no se duplica', { skip: !available }, async () => {
    const order = { tableId, localId: randomUUID(), items: [{ productId, quantity: 1 }] }

    const first = await waiter.request('POST', '/orders', order)
    const second = await waiter.request('POST', '/orders', order)

    assert.equal(first.status, 201)
    assert.equal(second.status, 201)
    assert.equal(first.body.id, second.body.id)
  })

  test('el pedido queda a nombre del usuario que inició sesión', { skip: !available }, async () => {
    const res = await waiter.request('POST', '/orders', { tableId, items: [{ productId, quantity: 1 }] })
    const profile = await waiter.request('GET', '/auth/profile')

    assert.equal(Number(res.body.user_id), profile.body.id)
  })

  test('un mesero no puede cambiar el pedido de otro mesero', { skip: !available }, async () => {
    const order = await waiter.request('POST', '/orders', { tableId, items: [{ productId, quantity: 1 }] })
    const res = await otherWaiter.request('PATCH', `/orders/${order.body.id}/status`, { status: 'ready' })

    assert.equal(res.status, 403)
  })

  test('un cambio de estado que llega tarde produce conflicto (409) y gana el servidor', { skip: !available }, async () => {
    const order = await waiter.request('POST', '/orders', { tableId, items: [{ productId, quantity: 1 }] })
    const id = order.body.id

    assert.equal((await waiter.request('PATCH', `/orders/${id}/status`, { status: 'ready' })).status, 200)

    const late = await waiter.request('PATCH', `/orders/${id}/status`, { status: 'preparing' })
    assert.equal(late.status, 409)
    assert.equal(late.body.detalles.reason, 'INVALID_TRANSITION')
    assert.equal(late.body.detalles.server.status, 'ready')

    // Reenviar el mismo estado no es error (idempotencia)
    assert.equal((await waiter.request('PATCH', `/orders/${id}/status`, { status: 'ready' })).status, 200)
  })

  test('editar un producto con una versión vieja produce conflicto (409)', { skip: !available }, async () => {
    const current = await admin.request('GET', `/products/${productId}`)
    const version = current.body.version

    const ok = await admin.request('PUT', `/products/${productId}`, { price: 12000, expectedVersion: version })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.version, version + 1)

    // Otro dispositivo todavía tenía la versión anterior
    const stale = await admin.request('PUT', `/products/${productId}`, { price: 9000, expectedVersion: version })
    assert.equal(stale.status, 409)
    assert.equal(stale.body.detalles.reason, 'VERSION_MISMATCH')
    assert.equal(Number(stale.body.detalles.server.price), 12000)
  })

  test('no se puede vender más de lo que hay en stock (409)', { skip: !available }, async () => {
    const order = await admin.request('POST', '/orders', { tableId, items: [{ productId, quantity: 999 }] })
    await admin.request('PATCH', `/orders/${order.body.id}/status`, { status: 'completed' })

    const sale = await admin.request('POST', '/sales', { orderId: order.body.id, paymentMethodId: 1 })
    assert.equal(sale.status, 409)
    assert.equal(sale.body.detalles.reason, 'INSUFFICIENT_STOCK')
  })

  test('rechaza inyección SQL en los parámetros', { skip: !available }, async () => {
    const res = await admin.request('GET', `/products/${encodeURIComponent("1 OR 1=1")}`)
    assert.equal(res.status, 400)
  })
})
