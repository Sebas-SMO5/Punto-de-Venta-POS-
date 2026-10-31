const pool = require('../config/database')

async function getAll() {
  const result = await pool.query(`
    SELECT
      o.id,
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
  const result = await pool.query(`
    SELECT
      o.id,
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

async function create(data) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const tableResult = await client.query(
      `SELECT id, status FROM restaurant_tables WHERE id = $1 AND active = TRUE FOR UPDATE`,
      [data.tableId]
    )

    if (!tableResult.rows.length) {
      const error = new Error('La mesa no existe o está inactiva')
      error.status = 400
      throw error
    }

    const userResult = data.userId
      ? await client.query(
          'SELECT id FROM users WHERE id = $1 AND active = TRUE',
          [data.userId]
        )
      : await client.query(
          'SELECT id FROM users WHERE active = TRUE ORDER BY id LIMIT 1'
        )

    if (!userResult.rows.length) {
      const error = new Error('No hay un usuario activo para registrar el pedido')
      error.status = 400
      throw error
    }

    const productIds = data.items.map(item => item.productId)

    const productsResult = await client.query(
      `SELECT id, name, price FROM products WHERE id = ANY($1::int[]) AND active = TRUE`,
      [productIds]
    )

    if (productsResult.rows.length !== new Set(productIds).size) {
      const error = new Error('Uno o más productos no existen o están inactivos')
      error.status = 400
      throw error
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

    const orderNumberResult = await client.query(
      'SELECT COALESCE(MAX(order_number), 0) + 1 AS next_number FROM orders'
    )

    const orderNumber = orderNumberResult.rows[0].next_number

    const orderResult = await client.query(`
      INSERT INTO orders (
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
      VALUES ($1, $2, $3, $4, 'pending', $5, $6, 0, $6)
      RETURNING id
    `, [
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

    await client.query('COMMIT')

    return await getById(orderId)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function updateStatus(id, status) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const current = await client.query(
      'SELECT id, status, table_id FROM orders WHERE id = $1 FOR UPDATE',
      [id]
    )

    if (!current.rows.length) {
      await client.query('ROLLBACK')
      return null
    }

    if (['completed', 'cancelled'].includes(current.rows[0].status)) {
      const error = new Error('No se puede modificar un pedido finalizado')
      error.status = 400
      throw error
    }

    const updated = await client.query(`
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `, [status, id])

    if (status === 'completed' || status === 'cancelled') {
      const activeOrders = await client.query(`
        SELECT id
        FROM orders
        WHERE table_id = $1
          AND status NOT IN ('completed', 'cancelled')
          AND id <> $2
      `, [current.rows[0].table_id, id])

      if (!activeOrders.rows.length) {
        await client.query(`
          UPDATE restaurant_tables
          SET status = 'available'
          WHERE id = $1
        `, [current.rows[0].table_id])
      }
    }

    await client.query('COMMIT')

    return await getById(updated.rows[0].id)
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