const pool = require('../config/database')

async function getAll() {
  const result = await pool.query(`
    SELECT
      i.id,
      p.name AS product,
      COALESCE(i.current_stock, 0) AS stock,
      COALESCE(i.minimum_stock, 0) AS minimum
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.active = TRUE
    ORDER BY p.name
  `)

  return result.rows
}

module.exports = {
  getAll
}