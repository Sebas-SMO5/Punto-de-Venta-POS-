// Pruebas de integración de las entradas/ajustes de inventario y del
// manejo de usuarios por parte del administrador.
const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('crypto')
const h = require('./helpers')

describe('Inventario y usuarios', async () => {
  const available = await h.databaseAvailable()
  let server
  let baseUrl
  let admin
  let cashier
  let waiter
  let productId

  before(async () => {
    if (!available) return
    ;({ server, baseUrl } = await h.startServer())

    const users = await Promise.all([
      h.createUser('inv_admin', 'admin'),
      h.createUser('inv_cajero', 'cashier'),
      h.createUser('inv_mesero', 'waiter')
    ])
    admin = h.createClient(baseUrl)
    cashier = h.createClient(baseUrl)
    waiter = h.createClient(baseUrl)
    await admin.login(users[0].username)
    await cashier.login(users[1].username)
    await waiter.login(users[2].username)

    const product = await admin.request('POST', '/products', {
      name: `Prueba ${randomUUID().slice(0, 8)}`,
      category: 'Bebidas',
      price: 3000,
      current_stock: 10,
      minimum_stock: 2
    })
    productId = product.body.id
  })

  after(async () => {
    if (!available) return
    await h.cleanup()
    server.close()
    await h.pool.end()
  })

  // ---------- inventario ----------

  test('un cajero registra una entrada de mercancía y el stock sube', { skip: !available }, async () => {
    const res = await cashier.request('POST', '/inventory/movements', {
      productId, type: 'entry', quantity: 5, reason: 'Compra al proveedor'
    })

    assert.equal(res.status, 201)
    assert.equal(Number(res.body.stock), 15)
  })

  test('una entrada enviada dos veces (mismo localId) no suma dos veces', { skip: !available }, async () => {
    const body = { productId, type: 'entry', quantity: 3, localId: randomUUID() }

    const first = await cashier.request('POST', '/inventory/movements', body)
    const second = await cashier.request('POST', '/inventory/movements', body)

    assert.equal(first.status, 201)
    assert.equal(second.status, 200)
    assert.equal(Number(second.body.stock), Number(first.body.stock))
  })

  test('el administrador ajusta el stock a un conteo exacto', { skip: !available }, async () => {
    const res = await admin.request('POST', '/inventory/movements', {
      productId, type: 'adjustment', quantity: 7, reason: 'Conteo físico'
    })

    assert.equal(res.status, 201)
    assert.equal(Number(res.body.stock), 7)
  })

  test('un ajuste que no cambia nada se rechaza', { skip: !available }, async () => {
    const res = await admin.request('POST', '/inventory/movements', { productId, type: 'adjustment', quantity: 7 })
    assert.equal(res.status, 400)
  })

  test('un cajero no puede hacer ajustes, solo entradas', { skip: !available }, async () => {
    const res = await cashier.request('POST', '/inventory/movements', { productId, type: 'adjustment', quantity: 1 })
    assert.equal(res.status, 403)
  })

  test('un mesero no puede tocar el inventario', { skip: !available }, async () => {
    assert.equal((await waiter.request('GET', '/inventory')).status, 403)
    assert.equal(
      (await waiter.request('POST', '/inventory/movements', { productId, type: 'entry', quantity: 1 })).status,
      403
    )
  })

  test('una entrada de cero o negativa se rechaza', { skip: !available }, async () => {
    assert.equal((await cashier.request('POST', '/inventory/movements', { productId, type: 'entry', quantity: 0 })).status, 400)
    assert.equal((await cashier.request('POST', '/inventory/movements', { productId, type: 'entry', quantity: -4 })).status, 400)
  })

  test('el historial muestra cada movimiento con quién lo hizo', { skip: !available }, async () => {
    const res = await admin.request('GET', `/inventory/movements?productId=${productId}`)

    assert.equal(res.status, 200)
    assert.ok(res.body.length >= 3)

    const [latest] = res.body
    assert.equal(latest.type, 'adjustment')
    assert.equal(Number(latest.new_stock), 7)
    assert.ok(latest.user_name)
  })

  // ---------- usuarios ----------

  test('solo el administrador puede ver y crear usuarios', { skip: !available }, async () => {
    assert.equal((await cashier.request('GET', '/users')).status, 403)
    assert.equal((await admin.request('GET', '/users')).status, 200)
  })

  test('el administrador crea un mesero que puede iniciar sesión', { skip: !available }, async () => {
    const username = `${h.PREFIX}nuevo`
    const created = await admin.request('POST', '/users', {
      username, password: 'Mesero12345', fullName: 'Mesero Nuevo', role: 'waiter'
    })

    assert.equal(created.status, 201)
    assert.equal(created.body.role, 'waiter')
    assert.equal(created.body.password, undefined, 'nunca se devuelve la contraseña')

    const client = h.createClient(baseUrl)
    assert.equal((await client.login(username, 'Mesero12345')).status, 200)

    // Usuario repetido
    const duplicate = await admin.request('POST', '/users', {
      username, password: 'OtraClave123', fullName: 'Otro', role: 'waiter'
    })
    assert.equal(duplicate.status, 409)
  })

  test('valida contraseña corta y rol inválido', { skip: !available }, async () => {
    const short = await admin.request('POST', '/users', {
      username: `${h.PREFIX}corto`, password: '123', fullName: 'X', role: 'waiter'
    })
    const badRole = await admin.request('POST', '/users', {
      username: `${h.PREFIX}rol`, password: 'Clave12345', fullName: 'X', role: 'jefe'
    })

    assert.equal(short.status, 400)
    assert.equal(badRole.status, 400)
  })

  test('desactivar un usuario le cierra la sesión y ya no puede entrar', { skip: !available }, async () => {
    const username = `${h.PREFIX}desactivar`
    const created = await admin.request('POST', '/users', {
      username, password: 'Clave12345', fullName: 'Temporal', role: 'cashier'
    })

    const client = h.createClient(baseUrl)
    await client.login(username, 'Clave12345')
    assert.equal((await client.request('GET', '/products')).status, 200)

    const res = await admin.request('PATCH', `/users/${created.body.id}`, { active: false })
    assert.equal(res.status, 200)
    assert.equal(res.body.active, false)

    assert.equal((await client.request('GET', '/products')).status, 401)
    assert.equal((await client.login(username, 'Clave12345')).status, 401)
  })

  test('el administrador cambia la contraseña de un usuario', { skip: !available }, async () => {
    const username = `${h.PREFIX}clave`
    const created = await admin.request('POST', '/users', {
      username, password: 'Vieja12345', fullName: 'Cambio', role: 'waiter'
    })

    await admin.request('PATCH', `/users/${created.body.id}`, { password: 'Nueva12345' })

    const client = h.createClient(baseUrl)
    assert.equal((await client.login(username, 'Vieja12345')).status, 401)
    assert.equal((await client.login(username, 'Nueva12345')).status, 200)
  })

  test('un administrador no se puede desactivar a sí mismo', { skip: !available }, async () => {
    const me = await admin.request('GET', '/auth/profile')
    const res = await admin.request('PATCH', `/users/${me.body.id}`, { active: false })

    assert.equal(res.status, 400)
  })
})
