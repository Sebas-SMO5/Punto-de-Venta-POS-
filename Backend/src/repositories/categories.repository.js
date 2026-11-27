// Consultas SQL de categorías.
const pool = require('../config/database')
const AppError = require('../utils/AppError')

const COLUMNS = 'id, name, description, active, version, updated_at, created_at'

async function getAll() {
  const result = await pool.query(`SELECT ${COLUMNS} FROM categories ORDER BY id ASC`)
  return result.rows
}

async function getById(id, db = pool) {
  const result = await db.query(`SELECT ${COLUMNS} FROM categories WHERE id = $1`, [id])
  return result.rows[0] || null
}

async function create(data) {
  const result = await pool.query(
    `INSERT INTO categories (name, description, active)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNS}`,
    [data.name, data.description, data.active]
  )

  return result.rows[0]
}

// Igual que en productos: si la versión no coincide hay un conflicto (409)
async function update(id, data) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const current = await client.query(
      `SELECT ${COLUMNS} FROM categories WHERE id = $1 FOR UPDATE`,
      [id]
    )

    if (!current.rowCount) {
      await client.query('ROLLBACK')
      return null
    }

    if (data.expectedVersion !== undefined && data.expectedVersion !== current.rows[0].version) {
      throw AppError.conflict(
        'La categoría fue modificada por otra persona. Revise los cambios.',
        { reason: 'VERSION_MISMATCH', server: current.rows[0] }
      )
    }

    const result = await client.query(
      `UPDATE categories
       SET name = $1, description = $2, active = $3,
           version = version + 1, updated_at = NOW()
       WHERE id = $4
       RETURNING ${COLUMNS}`,
      [data.name, data.description, data.active, id]
    )

    await client.query('COMMIT')
    return result.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function deactivate(id) {
  const result = await pool.query(
    `UPDATE categories
     SET active = FALSE, version = version + 1, updated_at = NOW()
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
