// Pruebas E2E de las herramientas del administrador:
//  - registrar una entrada de inventario (también sin conexión)
//  - crear un usuario desde la aplicación y entrar con él
import { expect, test, type Page } from '@playwright/test'
import { E2E_ADMIN, E2E_PASSWORD } from './global-setup'

async function login(page: Page, username: string, password = E2E_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible()
}

function acceptDialogs(page: Page): string[] {
  const messages: string[] = []
  page.on('dialog', (dialog) => {
    messages.push(dialog.message())
    void dialog.accept()
  })
  return messages
}

test('el administrador registra entradas de inventario con y sin conexión', async ({ page, context }) => {
  const dialogs = acceptDialogs(page)
  await login(page, E2E_ADMIN)

  await page.getByRole('link', { name: 'Inventario' }).click()
  const row = page.getByRole('row').filter({ hasText: 'Limonada natural' })
  const stockCell = row.getByRole('cell').nth(1)
  const before = Number((await stockCell.innerText()).replace(/\D/g, ''))

  // Con conexión
  await row.getByRole('button', { name: '+ Entrada' }).click()
  await page.locator('#stock-quantity').fill('4')
  await page.locator('#stock-reason').fill('Prueba E2E')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(stockCell).toHaveText(String(before + 4))
  await expect(page.getByRole('cell', { name: 'Prueba E2E' }).first()).toBeVisible()

  // Sin conexión: la entrada queda en la cola y se envía al volver
  await context.setOffline(true)
  await row.getByRole('button', { name: '+ Entrada' }).click()
  await page.locator('#stock-quantity').fill('2')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => dialogs.join('\n')).toContain('Entrada guardada sin conexión')
  await expect(stockCell).toHaveText(String(before + 6))

  await context.setOffline(false)
  await page.getByRole('link', { name: 'Sincronización' }).click()
  await expect(page.getByText('No hay operaciones pendientes')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('link', { name: 'Inventario' }).click()
  await expect(stockCell).toHaveText(String(before + 6))
})

test('el administrador crea un mesero y ese mesero puede iniciar sesión', async ({ page, browser }) => {
  acceptDialogs(page)
  await login(page, E2E_ADMIN)

  const username = `e2e_m${Date.now().toString().slice(-6)}`

  await page.getByRole('link', { name: 'Usuarios' }).click()
  await page.getByRole('button', { name: '+ Nuevo usuario' }).click()
  await page.locator('#user-username').fill(username)
  await page.locator('#user-fullname').fill('Mesero creado en E2E')
  await page.locator('#user-role').selectOption('waiter')
  await page.locator('#user-password').fill('MeseroE2E2026')
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByRole('row').filter({ hasText: username })).toContainText('Mesero')

  const other = await browser.newPage()
  await login(other, username, 'MeseroE2E2026')
  await expect(other.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
  await other.close()
})
