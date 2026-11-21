// Crea o actualiza un usuario administrador con contraseña cifrada (bcrypt).
// Uso: npm run create-admin -- <usuario> <contraseña> ["Nombre completo"]
require('dotenv').config({ quiet: true })

const bcrypt = require('bcryptjs')
const pool = require('../config/database')
const usersRepository = require('../repositories/users.repository')

async function main() {
  const [username = 'admin', password, fullName = 'Administrador'] = process.argv.slice(2)

  if (!password || password.length < 6) {
    console.error('Uso: npm run create-admin -- <usuario> <contraseña> ["Nombre completo"]')
    console.error('La contraseña debe tener al menos 6 caracteres.')
    process.exitCode = 1
    return
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await usersRepository.upsertUser({
    username,
    password: hash,
    fullName,
    role: 'admin'
  })

  console.log(`Administrador listo: ${user.username} (id ${user.id}, rol ${user.role})`)
}

main()
  .catch((error) => {
    console.error('No se pudo crear el administrador:', error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
