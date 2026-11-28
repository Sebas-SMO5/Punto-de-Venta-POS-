// Consultas SQL del inventario de productos y de sus movimientos.
const pool = require('../config/database')
const AppError = require('../utils/AppError')

const SELECT_ITEM = `
  SELECT
    p.id,
    p.id AS product_id,
    p.name AS product,
    COALESCE(i.current_stock, 0) AS stock,
    COALESCE(i.minimum_stock, 0) AS minimum,
    i.updated_at
  FROM products p
  LEFT JOIN inventory i ON i.product_id = p.id
`

async function getAll() {
  const result = await pool.query(`${SELECT_ITEM} WHERE p.active = TRUE ORDER BY p.name`)
  return result.rows
}

async function getItem(productId, db = pool) {
  const result = await db.query(`${SELECT_ITEM} WHERE p.id = $1`, [productId])
  return result.rows[0] || null
}

// Productos (de la lista dada) cuyo stock está en el mínimo o por debajo
async function findLowStock(productIds) {
  const result = await pool.query(`
    SELECT i.product_id, p.name, i.current_stock, i.minimum_stock
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    WHERE i.product_id = ANY($1::int[])
      AND i.current_stock <= i.minimum_stock
  `, [productIds])

  return result.rows
}

// Registra una entrada o un ajuste en UNA transacción:
//  1. Si el movimiento ya existe (mismo localId), lo devuelve sin repetirlo
//     (idempotencia: importante cuando se envía desde la cola offline).
//  2. Bloquea la fila del inventario (FOR UPDATE) para que dos personas no
//     cambien el mismo stock al mismo tiempo.
//  3. Calcula el stock nuevo, lo guarda y deja el registro del movimiento.
async function registerMovement({ productId, type, quantity, reason, localId, userId }) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    if (localId) {
      const existing = await client.query(
        'SELECT id FROM inventory_movements WHERE local_id = $1',
        [localId]
      )

      if (existing.rowCount) {
        const item = await getItem(productId, client)
        await client.query('COMMIT')
        return { item, duplicate: true }
      }
    }

    const product = await client.query(
      'SELECT id FROM products WHERE id = $1 AND active = TRUE',
      [productId]
    )

    if (!product.rowCount) {
      throw AppError.notFound('El producto no existe o está inactivo')
    }

    // Si el producto no tenía fila de inventario, se crea en cero
    await client.query(`
      INSERT INTO inventory (product_id, current_stock, minimum_stock)
      VALUES ($1, 0, 0)
      ON CONFLICT (product_id) DO NOTHING
    `, [productId])

    const locked = await client.query(
      'SELECT current_stock FROM inventory WHERE product_id = $1 FOR UPDATE',
      [productId]
    )

    const previousStock = Number(locked.rows[0].current_stock)
    const newStock = type === 'entry' ? previousStock + quantity : quantity
    const movedQuantity = Math.abs(newStock - previousStock)

    if (movedQuantity === 0) {
      throw AppError.badRequest(`El stock ya es ${previousStock}; no hay nada que ajustar`)
    }

    await client.query(`
      UPDATE inventory
      SET current_stock = $1, updated_at = NOW()
      WHERE product_id = $2
    `, [newStock, productId])

    await client.query(`
      INSERT INTO inventory_movements (
        local_id, product_id, user_id, movement_type,
        quantity, previous_stock, new_stock, reason
      )
      VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8)
    `, [localId || null, productId, userId, type, movedQuantity, previousStock, newStock, reason || null])

    const item = await getItem(productId, client)
    await client.query('COMMIT')

    return { item, duplicate: false }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Últimos movimientos (de un producto o de todos)
async function listMovements({ productId, limit }) {
  const result = await pool.query(`
    SELECT
      m.id,
      m.product_id,
      p.name AS product,
      m.movement_type AS type,
      m.quantity,
      m.previous_stock,
      m.new_stock,
      m.reason,
      m.created_at,
      u.full_name AS user_name
    FROM inventory_movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE ($1::int IS NULL OR m.product_id = $1)
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT $2
  `, [productId ?? null, limit])

  return result.rows
}

module.exports = {
  getAll,
  getItem,
  findLowStock,
  registerMovement,
  listMovements
}
