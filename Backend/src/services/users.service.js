// Lógica de negocio de usuarios (solo la usa el administrador).
// Reglas:
//  - Las contraseñas se guardan cifradas con bcrypt.
//  - No se puede quitar el último administrador activo (el sistema quedaría
//    sin nadie que lo administre).
//  - Un administrador no se puede desactivar ni quitar el rol a sí mismo.
//  - Si se desactiva a alguien, se le cambia el rol o la contraseña, se le
//    cierran todas las sesiones abiertas.
const bcrypt = require('bcryptjs')
const pool = require('../config/database')
const usersRepository = require('../repositories/users.repository')
const sessionsRepository = require('../repositories/sessions.repository')
const AppError = require('../utils/AppError')
const logger = require('../utils/logger')

function toPublic(user) {
  return {
    id: Number(user.id),
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.created_at
  }
}

async function list() {
  return (await usersRepository.list()).map(toPublic)
}

async function create(data, admin) {
  if (await usersRepository.findByUsername(data.username)) {
    throw AppError.conflict('Ya existe un usuario con ese nombre')
  }

  const user = await usersRepository.create({
    ...data,
    password: await bcrypt.hash(data.password, 10)
  })

  logger.info('Usuario creado', { userId: user.id, role: user.role, by: admin.id })
  return toPublic(user)
}

async function update(id, changes, admin) {
  const current = await usersRepository.findById(id)

  if (!current) throw AppError.notFound('Usuario no encontrado')

  const isSelf = Number(id) === admin.id
  const losesAdmin =
    current.role === 'admin' &&
    current.active &&
    ((changes.role && changes.role !== 'admin') || changes.active === false)

  if (isSelf && losesAdmin) {
    throw AppError.badRequest('No puede quitarse a sí mismo el rol de administrador ni desactivarse')
  }

  if (losesAdmin && (await usersRepository.countActiveAdmins()) <= 1) {
    throw AppError.badRequest('Debe quedar al menos un administrador activo')
  }

  const updated = await usersRepository.update(id, {
    ...changes,
    password: changes.password ? await bcrypt.hash(changes.password, 10) : undefined
  })

  const securityChange =
    changes.active === false ||
    (changes.role && changes.role !== current.role) ||
    changes.password !== undefined

  if (securityChange && !isSelf) {
    await sessionsRepository.revokeAllForUser(pool, id, 'changed_by_admin')
  }

  logger.info('Usuario actualizado', { userId: Number(id), fields: Object.keys(changes), by: admin.id })
  return toPublic(updated)
}

module.exports = {
  list,
  create,
  update
}
