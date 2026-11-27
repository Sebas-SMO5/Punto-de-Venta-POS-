// Utilidades para las pruebas de integración: encienden la API en un
// puerto libre, crean usuarios de prueba y limpian todo al terminar.
// Usan la base de datos configurada en .env (o DATABASE_URL en GitHub Actions).
process.env.NODE_ENV = 'test'
process.env.REFRESH_GRACE_MS = process.env.REFRESH_GRACE_MS || '800'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto_de_prueba_suficientemente_largo'

const bcrypt = require('bcryptjs')
const app = require('../../src/app')
const pool = require('../../src/config/database')
const { migrate } = require('../../src/scripts/migrate')

const PASSWORD = 'Prueba2026*'
const PREFIX = `test_${process.pid}_`

async function databaseAvailable() {
  try {
    await pool.query('SELECT 1')
    return true
  } catch {
    return false
  }
}

async function startServer() {
  await migrate({ seed: true, silent: true })

  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s))
  })

  const baseUrl = `http://127.0.0.1:${server.address().port}/api`
  return { server, baseUrl }
}

async function createUser(name, role) {
  const hash = await bcrypt.hash(PASSWORD, 4)
  const result = await pool.query(
    `INSERT INTO users (username, password, full_name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role, active = TRUE
     RETURNING id, username, role`,
    [PREFIX + name, hash, `Usuario ${name}`, role]
  )

  return result.rows[0]
}

// Cliente HTTP mínimo que recuerda la cookie del refresh token,
// como lo haría un navegador.
function createClient(baseUrl) {
  let cookie = null
  let accessToken = null

  async function request(method, path, body, { auth = true, sendCookie = false } = {}) {
    const headers = { 'Content-Type': 'application/json' }

    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`
    if (sendCookie && cookie) headers.Cookie = cookie

    const response = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })

    const setCookie = response.headers.get('set-cookie')

    if (setCookie) {
      const value = setCookie.split(';')[0]
      cookie = value.endsWith('=') ? null : value
    }

    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : null, setCookie }
  }

  return {
    request,
    get cookie() {
      return cookie
    },
    set cookie(value) {
      cookie = value
    },
    get accessToken() {
      return accessToken
    },
    set accessToken(value) {
      accessToken = value
    },
    async login(username, password = PASSWORD) {
      const res = await request('POST', '/auth/login', { username, password }, { auth: false })
      if (res.status === 200) accessToken = res.body.accessToken
      return res
    },
    async refresh() {
      const res = await request('POST', '/auth/refresh', undefined, { auth: false, sendCookie: true })
      if (res.status === 200) accessToken = res.body.accessToken
      return res
    }
  }
}

// Borra todo lo que crearon las pruebas
async function cleanup() {
  const users = await pool.query('SELECT id FROM users WHERE username LIKE $1', [PREFIX + '%'])
  const ids = users.rows.map(u => u.id)

  if (ids.length) {
    const orders = await pool.query('SELECT id FROM orders WHERE user_id = ANY($1::int[])', [ids])
    const orderIds = orders.rows.map(o => o.id)

    if (orderIds.length) {
      await pool.query('DELETE FROM order_items WHERE order_id = ANY($1::bigint[])', [orderIds])
      await pool.query('DELETE FROM orders WHERE id = ANY($1::bigint[])', [orderIds])
    }

    await pool.query('DELETE FROM refresh_tokens WHERE user_id = ANY($1::int[])', [ids])
    await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids])
  }

  const products = await pool.query("SELECT id FROM products WHERE name LIKE 'Prueba %'")
  const productIds = products.rows.map(p => p.id)

  if (productIds.length) {
    await pool.query('DELETE FROM inventory WHERE product_id = ANY($1::int[])', [productIds])
    await pool.query('DELETE FROM products WHERE id = ANY($1::int[])', [productIds])
  }

  // Las mesas quedan libres otra vez
  await pool.query(`
    UPDATE restaurant_tables t SET status = 'available'
    WHERE NOT EXISTS (
      SELECT 1 FROM orders o
      WHERE o.table_id = t.id AND o.status NOT IN ('completed', 'cancelled')
    )
  `)
}

module.exports = {
  PASSWORD,
  PREFIX,
  pool,
  databaseAvailable,
  startServer,
  createUser,
  createClient,
  cleanup
}
