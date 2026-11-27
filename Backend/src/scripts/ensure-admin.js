// Crea el primer administrador al arrancar el servidor, si se configuraron
// las variables ADMIN_USERNAME y ADMIN_PASSWORD (por ejemplo en Render,
// pestaña "Environment"). Sirve cuando no hay acceso a una terminal en la
// nube. Si el usuario ya existe NO se modifica (no cambia su contraseña).
const bcrypt = require('bcryptjs')
const usersRepository = require('../repositories/users.repository')
const logger = require('../utils/logger')

async function ensureInitialAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim()
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) return

  if (password.length < 8) {
    logger.warn('ADMIN_PASSWORD debe tener al menos 8 caracteres; no se creó el administrador')
    return
  }

  if (await usersRepository.findByUsername(username)) return

  await usersRepository.upsertUser({
    username,
    password: await bcrypt.hash(password, 10),
    fullName: 'Administrador',
    role: 'admin'
  })

  logger.info('Administrador inicial creado', { username })
}

module.exports = { ensureInitialAdmin }
