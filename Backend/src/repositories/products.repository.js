// Consultas SQL de productos. Cada producto tiene su fila de inventario.
const pool = require('../config/database')
const AppError = require('../utils/AppError')

const SELECT_PRODUCT = `
  SELECT
    p.id,
    p.category_id,
    p.name,
    p.description,
    p.price,
    p.sku,
    p.active AS available,
    p.version,
    p.updated_at,
    c.name AS category,
    COALESCE(i.current_stock, 0) AS current_stock,
    COALESCE(i.minimum_stock, 0) AS minimum_stock
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN inventory i ON i.product_id = p.id
`

async function getAll() {
  const result = await pool.query(`${SELECT_PRODUCT} WHERE p.active = TRUE ORDER BY p.id`)
  return result.rows
}

async function getById(id, db = pool) {
  const result = await db.query(`${SELECT_PRODUCT} WHERE p.id = $1`, [id])
  return result.rows[0] || null
}

async function getCategoryId(category, db = pool) {
  const result = await db.query(
    'SELECT id FROM categories WHERE name = $1 AND active = TRUE',
    [category]
  )

  return result.rows[0]?.id || null
}

async function withTransaction(work) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function create(data) {
  return withTransaction(async (client) => {
    const categoryId = await getCategoryId(data.category, client)

    if (!categoryId) {
      throw AppError.badRequest('La categoría seleccionada no existe o está inactiva')
    }

    const result = await client.query(`
      INSERT INTO products (category_id, name, description, price, active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [categoryId, data.name, data.description || '', data.price, data.available ?? true])

    const productId = result.rows[0].id

    await client.query(`
      INSERT INTO inventory (product_id, current_stock, minimum_stock, updated_at)
      VALUES ($1, $2, $3, NOW())
    `, [productId, data.current_stock ?? 0, data.minimum_stock ?? 0])

    return getById(productId, client)
  })
}

// Actualiza un producto con BLOQUEO OPTIMISTA:
// si llega expectedVersion y no coincide con la versión guardada, alguien
// más cambió el producto antes. Se responde 409 con los datos actuales
// del servidor para que el usuario decida qué hacer.
async function update(id, data) {
  return withTransaction(async (client) => {
    const locked = await client.query(
      'SELECT id FROM products WHERE id = $1 FOR UPDATE',
      [id]
    )

    if (!locked.rowCount) return null

    const current = await getById(id, client)

    if (data.expectedVersion !== undefined && data.expectedVersion !== current.version) {
      throw AppError.conflict(
        'El producto fue modificado por otra persona. Revise los cambios.',
        { reason: 'VERSION_MISMATCH', server: current }
      )
    }

    let categoryId = current.category_id

    if (data.category !== undefined) {
      categoryId = await getCategoryId(data.category, client)

      if (!categoryId) {
        throw AppError.badRequest('La categoría seleccionada no existe o está inactiva')
      }
    }

    await client.query(`
      UPDATE products
      SET category_id = $1,
          name = $2,
          description = $3,
          price = $4,
          active = $5,
          version = version + 1,
          updated_at = NOW()
      WHERE id = $6
    `, [
      categoryId,
      data.name ?? current.name,
      data.description ?? current.description,
      data.price ?? current.price,
      data.available ?? current.available,
      id
    ])

    if (data.minimum_stock !== undefined) {
      await client.query(`
        INSERT INTO inventory (product_id, current_stock, minimum_stock, updated_at)
        VALUES ($1, 0, $2, NOW())
        ON CONFLICT (product_id)
        DO UPDATE SET minimum_stock = EXCLUDED.minimum_stock, updated_at = NOW()
      `, [id, data.minimum_stock])
    }

    return getById(id, client)
  })
}

async function remove(id) {
  const result = await pool.query(`
    UPDATE products
    SET active = FALSE, version = version + 1, updated_at = NOW()
    WHERE id = $1 AND active = TRUE
    RETURNING id
  `, [id])

  return result.rowCount > 0
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove
}
