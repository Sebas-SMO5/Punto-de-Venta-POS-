
const pool = require('../config/database')

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
          json_build_object(
            'id', si.id,
            'product_id', si.product_id,
            'name', si.product_name,
            'quantity', si.quantity,
            'price', si.unit_price,
            'subtotal', si.subtotal
          )
        ) FILTER (WHERE si.id IS NOT NULL),
        '[]'
      ) AS items
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
          json_build_object(
            'id', si.id,
            'product_id', si.product_id,
            'name', si.product_name,
            'quantity', si.quantity,
            'price', si.unit_price,
            'subtotal', si.subtotal
          )
        ) FILTER (WHERE si.id IS NOT NULL),
        '[]'
      ) AS items
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.id = $1
    GROUP BY s.id
  `, [id])

  return result.rows[0] || null
}

module.exports = {
  getAll,
  getById
}
