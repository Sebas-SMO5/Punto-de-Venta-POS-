const pool = require('../config/database')
const { randomUUID } = require('crypto')
const AppError = require('../utils/AppError')

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

// Registra la venta de un pedido en UNA sola transacción (todo o nada):
// bloquea el pedido y el inventario (FOR UPDATE) para que dos cajas no
// cobren el mismo pedido ni descuenten el mismo stock al mismo tiempo.
async function createFromOrder(orderId, paymentMethodId, reference = null, userId = null) {
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
      throw AppError.notFound('El pedido no existe')
    }

    const order = orderResult.rows[0]

    if (order.status !== 'completed') {
      throw AppError.badRequest('Solo se pueden registrar ventas de pedidos completados')
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
      throw AppError.badRequest('El medio de pago no existe o está inactivo')
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
      throw AppError.badRequest('El pedido no tiene productos registrados')
    }

    for (const item of itemsResult.rows) {
      const inventoryResult = await client.query(`
        SELECT current_stock
        FROM inventory
        WHERE product_id = $1
        FOR UPDATE
      `, [item.product_id])

      if (inventoryResult.rows.length === 0) {
        throw AppError.badRequest(
          `El producto ${item.product_name} no tiene inventario registrado`
        )
      }

      const previousStock = Number(inventoryResult.rows[0].current_stock)
      const quantity = Number(item.quantity)

      if (previousStock < quantity) {
        // Conflicto: el stock cambió (por ejemplo, otra caja vendió mientras
        // este dispositivo estaba sin conexión). La venta no se registra.
        throw AppError.conflict(
          `Stock insuficiente para ${item.product_name}. Existencias: ${previousStock}, solicitado: ${quantity}`,
          { reason: 'INSUFFICIENT_STOCK', productId: item.product_id, available: previousStock, requested: quantity }
        )
      }

      const newStock = previousStock - quantity

      await client.query(`
        UPDATE inventory
        SET
          current_stock = $1,
          updated_at = NOW()
        WHERE product_id = $2
      `, [newStock, item.product_id])

      await client.query(`
        INSERT INTO inventory_movements (
          local_id,
          product_id,
          user_id,
          movement_type,
          quantity,
          previous_stock,
          new_stock,
          reason,
          created_at
        )
        VALUES ($1, $2, $3, 'exit', $4, $5, $6, $7, NOW())
      `, [
        randomUUID(),
        item.product_id,
        userId || order.user_id,
        quantity,
        previousStock,
        newStock,
        `Venta ${orderId}`
      ])
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
      userId || order.user_id,
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

async function getPaymentMethods() {
  const result = await pool.query(
    'SELECT id, name FROM payment_methods WHERE active = TRUE ORDER BY id'
  )

  return result.rows
}

module.exports = {
  getPaymentMethods,
  getAll,
  getById,
  createFromOrder
}