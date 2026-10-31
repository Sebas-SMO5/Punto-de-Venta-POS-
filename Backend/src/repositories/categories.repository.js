const pool = require('../config/database')

async function getAll() {
  const result = await pool.query(
    `SELECT id, name, description, active, created_at
     FROM categories
     ORDER BY id ASC`
  )

  return result.rows
}

async function getById(id) {
  const result = await pool.query(
    `SELECT id, name, description, active, created_at
     FROM categories
     WHERE id = $1`,
    [id]
  )

  return result.rows[0] || null
}

async function create(data) {
  const result = await pool.query(
    `INSERT INTO categories (name, description, active)
     VALUES ($1, $2, $3)
     RETURNING id, name, description, active, created_at`,
    [data.name, data.description, data.active]
  )

  return result.rows[0]
}

async function update(id, data) {
  const result = await pool.query(
    `UPDATE categories
     SET name = $1, description = $2, active = $3
     WHERE id = $4
     RETURNING id, name, description, active, created_at`,
    [data.name, data.description, data.active, id]
  )

  return result.rows[0] || null
}

async function deactivate(id) {
  const result = await pool.query(
    `UPDATE categories
     SET active = false
     WHERE id = $1
     RETURNING id`,
    [id]
  )

  return result.rowCount > 0
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deactivate
}