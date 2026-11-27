// Busca usuarios cuya contraseña quedó guardada en texto plano
// (por ejemplo los usuarios de prueba antiguos) y la cifra con bcrypt.
// La contraseña sigue siendo la misma para el usuario; lo único que cambia
// es cómo se guarda en la base de datos.
//
// Uso: npm run hash-passwords
const bcrypt = require('bcryptjs')
const pool = require('../config/database')

async function main() {
  const { rows } = await pool.query(
    "SELECT id, username, password FROM users WHERE password NOT LIKE '$2%'"
  )

  if (!rows.length) {
    console.log('Todas las contraseñas ya están cifradas.')
    return
  }

  for (const user of rows) {
    const hash = await bcrypt.hash(user.password, 10)
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user.id])
    console.log(`Contraseña cifrada para ${user.username}`)
  }
}

main()
  .catch((error) => {
    console.error('No se pudieron cifrar las contraseñas:', error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
