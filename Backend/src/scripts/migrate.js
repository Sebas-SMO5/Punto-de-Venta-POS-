// Ejecuta las migraciones de la carpeta database/migrations en orden.
// Guarda en la tabla schema_migrations cuáles ya se aplicaron, para no
// repetirlas. Cada migración corre dentro de una transacción: si algo
// falla, no queda aplicada a medias.
//
// Uso:
//   npm run migrate            -> aplica las migraciones pendientes
//   npm run migrate -- --seed  -> además carga los datos iniciales
const fs = require('fs')
const path = require('path')
const pool = require('../config/database')

const DATABASE_DIR = path.resolve(__dirname, '../../../database')
const MIGRATIONS_DIR = path.join(DATABASE_DIR, 'migrations')
const SEEDS_DIR = path.join(DATABASE_DIR, 'seeds')

function sqlFiles(directory) {
  if (!fs.existsSync(directory)) return []

  return fs
    .readdirSync(directory)
    .filter(file => file.endsWith('.sql'))
    .sort()
}

async function runFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8')
  await client.query('BEGIN')

  try {
    await client.query(sql)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function migrate({ seed = false, silent = false } = {}) {
  const log = silent ? () => {} : console.log
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const applied = new Set(
      (await client.query('SELECT name FROM schema_migrations')).rows.map(r => r.name)
    )

    let count = 0

    for (const file of sqlFiles(MIGRATIONS_DIR)) {
      if (applied.has(file)) continue

      log(`Aplicando migración ${file}...`)
      await runFile(client, path.join(MIGRATIONS_DIR, file))
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      count++
    }

    log(count ? `${count} migración(es) aplicada(s).` : 'La base de datos ya está al día.')

    if (seed) {
      for (const file of sqlFiles(SEEDS_DIR)) {
        log(`Cargando datos iniciales ${file}...`)
        await runFile(client, path.join(SEEDS_DIR, file))
      }
    }
  } finally {
    client.release()
  }
}

if (require.main === module) {
  migrate({ seed: process.argv.includes('--seed') })
    .catch(error => {
      console.error('Error en la migración:', error.message)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}

module.exports = { migrate }
