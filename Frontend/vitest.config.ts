// Configuración de las pruebas unitarias (Vitest).
// Solo se buscan pruebas dentro de src/ (las E2E de la carpeta e2e/ las
// ejecuta Playwright).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
