// Antes de las pruebas E2E se crean (o actualizan) dos usuarios de prueba
// usando el script del backend, con la contraseña cifrada como siempre.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const E2E_PASSWORD = 'E2ePrueba2026*'
export const E2E_ADMIN = 'e2e_admin'
export const E2E_WAITER = 'e2e_mesero'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../Backend')

export default function globalSetup(): void {
  const createUser = (username: string, role: string, name: string) =>
    execFileSync(
      process.execPath,
      ['src/scripts/create-user.js', username, E2E_PASSWORD, role, name],
      { cwd: backendDir, stdio: 'inherit' },
    )

  execFileSync(process.execPath, ['src/scripts/migrate.js', '--seed'], { cwd: backendDir, stdio: 'inherit' })
  createUser(E2E_ADMIN, 'admin', 'Administrador E2E')
  createUser(E2E_WAITER, 'waiter', 'Mesero E2E')
}
