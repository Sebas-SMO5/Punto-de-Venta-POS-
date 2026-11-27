const pool = require('../config/database')
const AppError = require('../utils/AppError')
const { evaluateTransition, canModifyOrder } = require('../domain/orderRules')

async function getOrderById(db, id) {
  const result = await db.query(`
    SELECT
      o.id,
      o.local_id,
      o.order_number,
      o.table_id,
      rt.table_number,
      o.user_id,
      o.order_type,
      o.status,
      o.notes,
      o.subtotal,
      o.tax,
      o.total,
      o.created_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'productId', oi.product_id,
            'name', p.name,
            'quantity', oi.quantity,
            'price', oi.unit_price,
            'subtotal', oi.subtotal
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS items
    FROM orders o
    LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.id = $1
    GROUP BY o.id, rt.table_number
  `, [id])

  return result.rows[0] || null
}

async function getAll() {
  const result = await pool.query(`
    SELECT
      o.id,
      o.local_id,
      o.order_number,
      o.table_id,
      rt.table_number,
      o.user_id,
      o.order_type,
      o.status,
      o.notes,
      o.subtotal,
      o.tax,
      o.total,
      o.created_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'productId', oi.product_id,
            'name', p.name,
            'quantity', oi.quantity,
            'price', oi.unit_price,
            'subtotal', oi.subtotal
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS items
    FROM orders o
    LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    GROUP BY o.id, rt.table_number
    ORDER BY o.created_at DESC
  `)

  return result.rows
}

async function getById(id) {
  return getOrderById(pool, id)
}

async function create(data) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query('SELECT pg_advisory_xact_lock(73142)')

    if (data.localId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

      if (!uuidRegex.test(data.localId)) {
        throw AppError.badRequest('El identificador local del pedido no es válido')
      }

      const existingOrder = await client.query(
        'SELECT id FROM orders WHERE local_id = $1',
        [data.localId]
      )

      if (existingOrder.rows.length) {
        const order = await getOrderById(client, existingOrder.rows[0].id)
        await client.query('COMMIT')
        return order
      }
    }

    const tableResult = await client.query(
      `SELECT id, status
       FROM restaurant_tables
       WHERE id = $1 AND active = TRUE
       FOR UPDATE`,
      [data.tableId]
    )

    if (!tableResult.rows.length) {
      throw AppError.badRequest('La mesa no existe o está inactiva')
    }

    const userResult = await client.query(
      'SELECT id FROM users WHERE id = $1 AND active = TRUE',
      [data.userId]
    )

    if (!userResult.rows.length) {
      throw AppError.badRequest('El usuario que registra el pedido no está activo')
    }

    const productIds = data.items.map(item => item.productId)

    const productsResult = await client.query(
      `SELECT id, name, price
       FROM products
       WHERE id = ANY($1::int[]) AND active = TRUE`,
      [productIds]
    )

    if (productsResult.rows.length !== new Set(productIds).size) {
      throw AppError.badRequest('Uno o más productos no existen o están inactivos')
    }

    const products = new Map(
      productsResult.rows.map(product => [product.id, product])
    )

    const validatedItems = data.items.map(item => {
      const product = products.get(item.productId)
      const price = Number(product.price)

      return {
        productId: item.productId,
        quantity: item.quantity,
        price,
        subtotal: price * item.quantity
      }
    })

    const subtotal = validatedItems.reduce(
      (sum, item) => sum + item.subtotal,
      0
    )

    const orderNumberResult = await client.query(`
      SELECT COALESCE(
        MAX(
          CASE
            WHEN order_number ~ '^PED-[0-9]+$'
            THEN SUBSTRING(order_number FROM 5)::BIGINT
          END
        ),
        0
      ) + 1 AS next_number
      FROM orders
    `)

    const orderNumber = `PED-${String(
      orderNumberResult.rows[0].next_number
    ).padStart(6, '0')}`

    const orderResult = await client.query(`
      INSERT INTO orders (
        local_id,
        table_id,
        user_id,
        order_number,
        order_type,
        status,
        notes,
        subtotal,
        tax,
        total
      )
      VALUES (
        COALESCE($1::uuid, gen_random_uuid()),
        $2, $3, $4, $5, 'pending', $6, $7, 0, $7
      )
      RETURNING id
    `, [
      data.localId || null,
      data.tableId,
      userResult.rows[0].id,
      orderNumber,
      data.orderType || 'dine_in',
      data.notes || '',
      subtotal
    ])

    const orderId = orderResult.rows[0].id

    for (const item of validatedItems) {
      await client.query(`
        INSERT INTO order_items (
          order_id,
          product_id,
          quantity,
          unit_price,
          subtotal
        )
        VALUES ($1, $2, $3, $4, $5)
      `, [
        orderId,
        item.productId,
        item.quantity,
        item.price,
        item.subtotal
      ])
    }

    await client.query(`
      UPDATE restaurant_tables
      SET status = 'occupied'
      WHERE id = $1
    `, [data.tableId])

    const order = await getOrderById(client, orderId)

    await client.query('COMMIT')

    return order
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Cambia el estado de un pedido respetando:
//  1. La propiedad del recurso (un mesero solo cambia sus pedidos).
//  2. La máquina de estados (los pedidos solo avanzan; ver domain/orderRules.js).
// Si el cambio llega tarde (el pedido ya avanzó), responde 409 con el
// pedido tal como está en el servidor: el servidor gana.
async function updateStatus(id, status, user) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const current = await client.query(
      `SELECT id, status, table_id, user_id
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [id]
    )

    if (!current.rows.length) {
      throw AppError.notFound('Pedido no encontrado')
    }

    const order = current.rows[0]

    if (!canModifyOrder(user, order)) {
      throw AppError.forbidden('Solo puede modificar sus propios pedidos')
    }

    const decision = evaluateTransition(order.status, status)

    if (decision === 'noop') {
      const unchanged = await getOrderById(client, id)
      await client.query('COMMIT')
      return unchanged
    }

    if (decision === 'conflict') {
      throw AppError.conflict(
        `El pedido ya está en estado "${order.status}" y no puede pasar a "${status}"`,
        { reason: 'INVALID_TRANSITION', server: await getOrderById(client, id) }
      )
    }

    await client.query(`
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, id])

    if (status === 'completed' || status === 'cancelled') {
      const activeOrders = await client.query(`
        SELECT id
        FROM orders
        WHERE table_id = $1
          AND status NOT IN ('completed', 'cancelled')
          AND id <> $2
      `, [order.table_id, id])

      if (!activeOrders.rows.length) {
        await client.query(`
          UPDATE restaurant_tables
          SET status = 'available'
          WHERE id = $1
        `, [order.table_id])
      }
    }

    const updated = await getOrderById(client, id)

    await client.query('COMMIT')

    return updated
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  getAll,
  getById,
  create,
  updateStatus
}