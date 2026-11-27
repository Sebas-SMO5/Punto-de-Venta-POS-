// Configuración de las pruebas de punta a punta (E2E) con Playwright.
// Playwright abre un navegador Chrome de verdad y usa la aplicación como lo
// haría una persona: escribe, hace clic, se desconecta de internet, etc.
//
// Antes de las pruebas: compila el frontend y enciende el backend en el
// puerto 3100, que entrega la página y la API desde el mismo servidor
// (igual que en la nube).
import { defineConfig, devices } from '@playwright/test'

const PORT = 3100

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build-only && node ../Backend/src/server.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: 'production',
      CORS_ORIGINS: `http://localhost:${PORT}`,
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
