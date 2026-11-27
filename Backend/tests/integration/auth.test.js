// Pruebas de integración del inicio de sesión con doble token.
const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

describe('Autenticación con doble token', async () => {
  const available = await h.databaseAvailable()
  let server
  let baseUrl
  let admin

  before(async () => {
    if (!available) return
    ;({ server, baseUrl } = await h.startServer())
    admin = await h.createUser('admin', 'admin')
  })

  after(async () => {
    if (!available) return
    await h.cleanup()
    server.close()
    await h.pool.end()
  })

  test('rechaza una contraseña incorrecta', { skip: !available }, async () => {
    const client = h.createClient(baseUrl)
    const res = await client.login(admin.username, 'incorrecta')

    assert.equal(res.status, 401)
    assert.equal(res.body.mensaje, 'Credenciales incorrectas')
  })

  test('valida los datos del login', { skip: !available }, async () => {
    const client = h.createClient(baseUrl)
    const res = await client.request('POST', '/auth/login', { username: '' }, { auth: false })

    assert.equal(res.status, 400)
  })

  test('el login entrega access token en el cuerpo y refresh token en cookie segura', { skip: !available }, async () => {
    const client = h.createClient(baseUrl)
    const res = await client.login(admin.username)

    assert.equal(res.status, 200)
    assert.ok(res.body.accessToken)
    assert.equal(res.body.user.role, 'admin')
    assert.equal(res.body.refreshToken, undefined, 'el refresh token no debe ir en el cuerpo')

    assert.match(res.setCookie, /pos_refresh=/)
    assert.match(res.setCookie, /HttpOnly/i)
    assert.match(res.setCookie, /SameSite=Strict/i)
    assert.match(res.setCookie, /Secure/i)
  })

  test('las rutas protegidas exigen access token', { skip: !available }, async () => {
    const client = h.createClient(baseUrl)

    assert.equal((await client.request('GET', '/products')).status, 401)

    await client.login(admin.username)
    assert.equal((await client.request('GET', '/products')).status, 200)
  })

  test('cada respuesta trae un x-correlation-id', { skip: !available }, async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { 'x-correlation-id': 'prueba-correlacion-123' }
    })

    assert.equal(response.headers.get('x-correlation-id'), 'prueba-correlacion-123')
  })

  test('el refresh token rota: cada renovación entrega uno nuevo', { skip: !available }, async () => {
    const client = h.createClient(baseUrl)
    await client.login(admin.username)
    const firstCookie = client.cookie

    const res = await client.refresh()

    assert.equal(res.status, 200)
    assert.ok(res.body.accessToken)
    assert.notEqual(client.cookie, firstCookie)
  })

  test('reutilizar un refresh token viejo cierra toda la sesión', { skip: !available }, async () => {
    const client = h.createClient(baseUrl)
    await client.login(admin.username)
    const stolenCookie = client.cookie

    assert.equal((await client.refresh()).status, 200)
    const currentToken = client.accessToken

    // Se espera a que pase el margen de tolerancia entre pestañas
    await new Promise(resolve => setTimeout(resolve, 1000))

    const attacker = h.createClient(baseUrl)
    attacker.cookie = stolenCookie
    assert.equal((await attacker.refresh()).status, 401)

    // La sesión legítima también quedó cerrada (por seguridad)
    client.accessToken = currentToken
    assert.equal((await client.request('GET', '/products')).status, 401)
    assert.equal((await client.refresh()).status, 401)
  })

  test('logout cierra la sesión y el access token deja de servir', { skip: !available }, async () => {
    const client = h.createClient(baseUrl)
    await client.login(admin.username)

    const res = await client.request('POST', '/auth/logout', undefined, { sendCookie: true })
    assert.equal(res.status, 204)

    assert.equal((await client.request('GET', '/products')).status, 401)
  })

  test('cerrar todas las sesiones revoca las de otros dispositivos', { skip: !available }, async () => {
    const pc = h.createClient(baseUrl)
    const tablet = h.createClient(baseUrl)
    await pc.login(admin.username)
    await tablet.login(admin.username)

    const sessions = await pc.request('GET', '/auth/sessions')
    assert.ok(sessions.body.length >= 2)
    assert.equal(sessions.body.filter(s => s.current).length, 1)

    assert.equal((await pc.request('POST', '/auth/logout-all')).status, 200)
    assert.equal((await tablet.request('GET', '/products')).status, 401)
  })
})
