const pool = require('../config/database')

async function getAll() {
  const result = await pool.query(`
    SELECT
      p.id,
      p.category_id,
      p.name,
      p.description,
      p.price,
      p.sku,
      p.active AS available,
      c.name AS category
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = TRUE
    ORDER BY p.id
  `)

  return result.rows
}

async function getById(id) {
  const result = await pool.query(`
    SELECT
      p.id,
      p.category_id,
      p.name,
      p.description,
      p.price,
      p.sku,
      p.active AS available,
      c.name AS category
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = $1 AND p.active = TRUE
  `, [id])

  return result.rows[0] || null
}

async function getCategoryId(category) {
  const result = await pool.query(
    'SELECT id FROM categories WHERE name = $1 AND active = TRUE',
    [category]
  )

  return result.rows[0]?.id || null
}

async function create(data) {
  const categoryId = await getCategoryId(data.category)

  if (!categoryId) {
    const error = new Error('La categoría seleccionada no existe o está inactiva')
    error.status = 400
    throw error
  }

  const result = await pool.query(`
    INSERT INTO products (
      category_id,
      name,
      description,
      price,
      active
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    categoryId,
    data.name.trim(),
    data.description || '',
    data.price,
    data.available ?? true
  ])

  return getById(result.rows[0].id)
}

async function update(id, data) {
  const currentProduct = await getById(id)

  if (!currentProduct) {
    return null
  }

  let categoryId = currentProduct.category_id

  if (data.category !== undefined) {
    categoryId = await getCategoryId(data.category)

    if (!categoryId) {
      const error = new Error('La categoría seleccionada no existe o está inactiva')
      error.status = 400
      throw error
    }
  }

  await pool.query(`
    UPDATE products
    SET
      category_id = $1,
      name = $2,
      description = $3,
      price = $4,
      active = $5
    WHERE id = $6
  `, [
    categoryId,
    data.name?.trim() || currentProduct.name,
    data.description ?? currentProduct.description,
    data.price ?? currentProduct.price,
    data.available ?? currentProduct.available,
    id
  ])

  return getById(id)
}

async function remove(id) {
  const result = await pool.query(`
    UPDATE products
    SET active = FALSE
    WHERE id = $1 AND active = TRUE
    RETURNING id
  `, [id])

  return result.rowCount > 0
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove
}