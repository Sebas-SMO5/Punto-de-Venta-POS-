const pool = require('../config/database')
const { randomUUID } = require('crypto')

async function getAll() {
  const result = await pool.query(`
    SELECT
      s.id,
      s.sale_number,
      s.order_id,
      s.user_id,
      s.subtotal,
      s.tax,
      s.discount,
      s.total,
      s.status,
      s.created_at,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', si.id,
            'productId', si.product_id,
            'name', si.product_name,
            'quantity', si.quantity,
            'price', si.unit_price,
            'subtotal', si.subtotal
          )
        ) FILTER (WHERE si.id IS NOT NULL),
        '[]'
      ) AS items,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', p.id,
              'amount', p.amount,
              'status', p.status,
              'method', pm.name,
              'reference', p.reference
            )
          )
          FROM payments p
          LEFT JOIN payment_methods pm
            ON pm.id = p.payment_method_id
          WHERE p.sale_id = s.id
        ),
        '[]'
      ) AS payments
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `)

  return result.rows
}

async function getById(id) {
  const result = await pool.query(`
    SELECT
      s.id,
      s.sale_number,
      s.order_id,
      s.user_id,
      s.subtotal,
      s.tax,
      s.discount,
      s.total,
      s.status,
      s.created_at,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', si.id,
            'productId', si.product_id,
            'name', si.product_name,
            'quantity', si.quantity,
            'price', si.unit_price,
            'subtotal', si.subtotal
          )
        ) FILTER (WHERE si.id IS NOT NULL),
        '[]'
      ) AS items,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', p.id,
              'amount', p.amount,
              'status', p.status,
              'method', pm.name,
              'reference', p.reference
            )
          )
          FROM payments p
          LEFT JOIN payment_methods pm
            ON pm.id = p.payment_method_id
          WHERE p.sale_id = s.id
        ),
        '[]'
      ) AS payments
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.id = $1
    GROUP BY s.id
  `, [id])

  return result.rows[0] || null
}

async function createFromOrder(orderId, paymentMethodId, reference = null) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const orderResult = await client.query(`
      SELECT *
      FROM orders
      WHERE id = $1
      FOR UPDATE
    `, [orderId])

    if (orderResult.rows.length === 0) {
      throw new Error('El pedido no existe')
    }

    const order = orderResult.rows[0]

    if (order.status !== 'completed') {
      throw new Error('Solo se pueden registrar ventas de pedidos completados')
    }

    const existingSale = await client.query(
      'SELECT id FROM sales WHERE order_id = $1',
      [orderId]
    )

    if (existingSale.rows.length > 0) {
      const existingSaleId = existingSale.rows[0].id

      await client.query('COMMIT')

      return await getById(existingSaleId)
    }

    const methodResult = await client.query(`
      SELECT id
      FROM payment_methods
      WHERE id = $1 AND active = TRUE
    `, [paymentMethodId])

    if (methodResult.rows.length === 0) {
      throw new Error('El medio de pago no existe o está inactivo')
    }

    const itemsResult = await client.query(`
      SELECT
        oi.product_id,
        p.name AS product_name,
        oi.quantity,
        oi.unit_price,
        oi.subtotal
      FROM order_items oi
      INNER JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1
    `, [orderId])

    if (itemsResult.rows.length === 0) {
      throw new Error('El pedido no tiene productos registrados')
    }

    const saleNumber = `VTA-${randomUUID()}`

    const saleResult = await client.query(`
      INSERT INTO sales (
        order_id,
        user_id,
        sale_number,
        subtotal,
        tax,
        discount,
        total
      )
      VALUES ($1, $2, $3, $4, $5, 0, $6)
      RETURNING id
    `, [
      order.id,
      order.user_id,
      saleNumber,
      order.subtotal,
      order.tax,
      order.total
    ])

    const saleId = saleResult.rows[0].id

    for (const item of itemsResult.rows) {
      await client.query(`
        INSERT INTO sale_items (
          sale_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          subtotal
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        saleId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.subtotal
      ])
    }

    await client.query(`
      INSERT INTO payments (
        sale_id,
        payment_method_id,
        amount,
        reference
      )
      VALUES ($1, $2, $3, $4)
    `, [
      saleId,
      paymentMethodId,
      order.total,
      reference
    ])

    await client.query('COMMIT')

    return await getById(saleId)

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
  createFromOrder
}
