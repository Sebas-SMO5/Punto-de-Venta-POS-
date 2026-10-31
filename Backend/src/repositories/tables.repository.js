const pool = require('../config/database')

async function getAll() {
  const result = await pool.query(`
    SELECT
      rt.id,
      rt.table_number,
      rt.capacity,
      rt.status,
      rt.active,
      COALESCE(
        json_agg(
          json_build_object(
            'id', o.id,
            'orderNumber', o.order_number,
            'status', o.status,
            'total', o.total,
            'notes', o.notes,
            'createdAt', o.created_at,
            'items', COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', oi.id,
                    'productId', oi.product_id,
                    'name', p.name,
                    'quantity', oi.quantity,
                    'price', oi.unit_price,
                    'subtotal', oi.subtotal
                  )
                )
                FROM order_items oi
                LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = o.id
              ),
              '[]'
            )
          )
        ) FILTER (WHERE o.id IS NOT NULL),
        '[]'
      ) AS orders
    FROM restaurant_tables rt
    LEFT JOIN orders o
      ON o.table_id = rt.id
      AND o.status NOT IN ('completed', 'cancelled')
    WHERE rt.active = TRUE
    GROUP BY rt.id
    ORDER BY rt.table_number
  `)

  return result.rows
}

async function getById(id) {
  const result = await pool.query(`
    SELECT
      id,
      table_number,
      capacity,
      status,
      active
    FROM restaurant_tables
    WHERE id = $1 AND active = TRUE
  `, [id])

  return result.rows[0] || null
}

module.exports = {
  getAll,
  getById
}