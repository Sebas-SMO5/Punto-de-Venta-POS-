const pool = require('../config/database')

async function getSaleById(db, id) {
  const result = await db.query(`
    SELECT
      s.id,
      s.local_id,
      s.order_id,
      s.user_id,
      s.sale_number,
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
            'product_id', si.product_id,
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
              'payment_method_id', p.payment_method_id,
              'payment_method', pm.name,
              'method', pm.name,
              'amount', p.amount,
              'reference', p.reference,
              'status', p.status
            )
          )
          FROM payments p
          INNER JOIN payment_methods pm
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

async function getAll() {
  const result = await pool.query(`
    SELECT
      s.id,
      s.local_id,
      s.order_id,
      s.user_id,
      s.sale_number,
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
            'product_id', si.product_id,
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
              'payment_method_id', p.payment_method_id,
              'payment_method', pm.name,
              'method', pm.name,
              'amount', p.amount,
              'reference', p.reference,
              'status', p.status
            )
          )
          FROM payments p
          INNER JOIN payment_methods pm
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
  return getSaleById(pool, id)
}

async function create(data) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    if (!data.localId) {
      const error = new Error('El identificador local de la venta es obligatorio')
      error.status = 400
      throw error
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(data.localId)) {
      const error = new Error('El identificador local de la venta no es válido')
      error.status = 400
      throw error
    }

    const orderId = Number(data.orderId)
    const paymentMethodId = Number(data.paymentMethodId)

    if (!Number.isInteger(orderId) || orderId <= 0) {
      const error = new Error('El identificador del pedido no es válido')
      error.status = 400
      throw error
    }

    if (!Number.isInteger(paymentMethodId) || paymentMethodId <= 0) {
      const error = new Error('El medio de pago no es válido')
      error.status = 400
      throw error
    }

    const existingSale = await client.query(
      'SELECT id FROM sales WHERE local_id = $1',
      [data.localId]
    )

    if (existingSale.rows.length) {
      const sale = await getSaleById(client, existingSale.rows[0].id)
      await client.query('COMMIT')
      return sale
    }

    await client.query('SELECT pg_advisory_xact_lock(73143)')

    const orderResult = await client.query(`
      SELECT
        id,
        user_id,
        subtotal,
        tax,
        total,
        status
      FROM orders
      WHERE id = $1
      FOR UPDATE
    `, [orderId])

    if (!orderResult.rows.length) {
      const error = new Error('El pedido no existe')
      error.status = 404
      throw error
    }

    const order = orderResult.rows[0]

    const existingOrderSale = await client.query(
      'SELECT id FROM sales WHERE order_id = $1',
      [orderId]
    )

    if (existingOrderSale.rows.length) {
      const error = new Error('Este pedido ya tiene una venta registrada')
      error.status = 409
      throw error
    }

    const paymentMethodResult = await client.query(`
      SELECT id
      FROM payment_methods
      WHERE id = $1 AND active = TRUE
    `, [paymentMethodId])

    if (!paymentMethodResult.rows.length) {
      const error = new Error('El medio de pago no existe o está inactivo')
      error.status = 400
      throw error
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

    if (!itemsResult.rows.length) {
      const error = new Error('El pedido no tiene productos registrados')
      error.status = 400
      throw error
    }

    const total = Number(order.total)

    if (!Number.isFinite(total) || total <= 0) {
      const error = new Error('El total del pedido no es válido para registrar el pago')
      error.status = 400
      throw error
    }

    const saleNumberResult = await client.query(`
      SELECT COALESCE(
        MAX(
          CASE
            WHEN sale_number ~ '^VTA-[0-9]+$'
            THEN SUBSTRING(sale_number FROM 5)::BIGINT
          END
        ),
        0
      ) + 1 AS next_number
      FROM sales
    `)

    const saleNumber = `VTA-${String(
      saleNumberResult.rows[0].next_number
    ).padStart(6, '0')}`

    const saleResult = await client.query(`
      INSERT INTO sales (
        local_id,
        order_id,
        user_id,
        sale_number,
        subtotal,
        tax,
        discount,
        total,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'completed')
      RETURNING id
    `, [
      data.localId,
      orderId,
      order.user_id,
      saleNumber,
      order.subtotal,
      order.tax,
      total
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
        reference,
        status
      )
      VALUES ($1, $2, $3, $4, 'completed')
    `, [
      saleId,
      paymentMethodId,
      total,
      data.reference || null
    ])

    const sale = await getSaleById(client, saleId)

    await client.query('COMMIT')

    return sale
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
  create
}