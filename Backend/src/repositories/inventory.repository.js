// Consultas SQL del inventario de productos.
const pool = require('../config/database')

async function getAll() {
  const result = await pool.query(`
    SELECT
      i.id,
      p.id AS product_id,
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

module.exports = {
  getAll,
  findLowStock
}
