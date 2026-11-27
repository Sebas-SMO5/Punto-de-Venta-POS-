// Crea un usuario (o le cambia la contraseña si ya existe).
// La contraseña se guarda cifrada con bcrypt, nunca en texto plano.
//
// Uso:
//   npm run create-user -- <usuario> <contraseña> <rol> ["Nombre completo"]
//   rol: admin | cashier | waiter
//
// Ejemplos:
//   npm run create-user -- admin Admin2026* admin "Administrador"
//   npm run create-user -- cajero1 Cajero2026* cashier "Carlos Mendoza"
const bcrypt = require('bcryptjs')
const pool = require('../config/database')
const usersRepository = require('../repositories/users.repository')

const ROLES = ['admin', 'cashier', 'waiter']

async function main() {
  const [username, password, role = 'admin', fullName] = process.argv.slice(2)

  if (!username || !password || password.length < 8 || !ROLES.includes(role)) {
    console.error('Uso: npm run create-user -- <usuario> <contraseña> <rol> ["Nombre completo"]')
    console.error('La contraseña debe tener al menos 8 caracteres.')
    console.error(`Roles válidos: ${ROLES.join(', ')}`)
    process.exitCode = 1
    return
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await usersRepository.upsertUser({
    username,
    password: hash,
    fullName: fullName || username,
    role
  })

  console.log(`Usuario listo: ${user.username} (id ${user.id}, rol ${user.role})`)
}

main()
  .catch((error) => {
    console.error('No se pudo crear el usuario:', error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
