const pool = require('../config/database')

async function findByUsername(username) {
  const result = await pool.query(
    `SELECT id, username, password, full_name, email, role, active
     FROM users
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [username]
  )

  return result.rows[0] || null
}

async function findById(id) {
  const result = await pool.query(
    `SELECT id, username, full_name, email, role, active, created_at
     FROM users
     WHERE id = $1`,
    [id]
  )

  return result.rows[0] || null
}

async function upsertUser({ username, password, fullName, email, role }) {
  const result = await pool.query(
    `INSERT INTO users (username, password, full_name, email, role, active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (username) DO UPDATE
       SET password = EXCLUDED.password,
           full_name = COALESCE(EXCLUDED.full_name, users.full_name),
           email = COALESCE(EXCLUDED.email, users.email),
           role = EXCLUDED.role,
           active = true
     RETURNING id, username, full_name, email, role, active`,
    [username, password, fullName || null, email || null, role]
  )

  return result.rows[0]
}

module.exports = {
  findByUsername,
  findById,
  upsertUser
}
