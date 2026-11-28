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

const PUBLIC_COLUMNS = 'id, username, full_name, email, role, active, created_at'

async function list() {
  const result = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY active DESC, role, username`
  )

  return result.rows
}

async function create({ username, password, fullName, email, role }) {
  const result = await pool.query(
    `INSERT INTO users (username, password, full_name, email, role, active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING ${PUBLIC_COLUMNS}`,
    [username, password, fullName, email || null, role]
  )

  return result.rows[0]
}

// Actualiza solo los campos que llegan (los demás quedan igual)
async function update(id, { fullName, email, role, active, password }) {
  const result = await pool.query(
    `UPDATE users
     SET full_name = COALESCE($2, full_name),
         email     = CASE WHEN $3::boolean THEN $4 ELSE email END,
         role      = COALESCE($5, role),
         active    = COALESCE($6, active),
         password  = COALESCE($7, password)
     WHERE id = $1
     RETURNING ${PUBLIC_COLUMNS}`,
    [id, fullName ?? null, email !== undefined, email ?? null, role ?? null, active ?? null, password ?? null]
  )

  return result.rows[0] || null
}

async function countActiveAdmins() {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS total FROM users WHERE role = 'admin' AND active = TRUE"
  )

  return result.rows[0].total
}

module.exports = {
  findByUsername,
  findById,
  upsertUser,
  list,
  create,
  update,
  countActiveAdmins
}
