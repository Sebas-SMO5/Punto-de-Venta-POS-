// Prueba de punta a punta (E2E) del flujo principal del POS:
//   1. Iniciar sesión (y comprobar que los tokens no quedan expuestos).
//   2. Quedarse SIN INTERNET y registrar un pedido.
//   3. Recargar la página sin internet (la abre el Service Worker).
//   4. Volver a tener internet y ver que el pedido se sincroniza solo.
// Además se comprueba que un mesero no ve las opciones de administrador.
import { expect, test, type Page } from '@playwright/test'
import { E2E_ADMIN, E2E_PASSWORD, E2E_WAITER } from './global-setup'

async function login(page: Page, username: string) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.locator('input[autocomplete="current-password"]').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible()
}

// Lee directamente la base local (IndexedDB) del navegador
async function readLocalStore(page: Page, store: string) {
  return page.evaluate(
    (storeName) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const request = indexedDB.open('restaurante-pos')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const tx = request.result.transaction(storeName, 'readonly')
          const all = tx.objectStore(storeName).getAll()
          all.onsuccess = () => resolve(all.result as Record<string, unknown>[])
          all.onerror = () => reject(all.error)
        }
      }),
    store,
  )
}

test('los tokens no quedan expuestos al JavaScript de la página', async ({ page }) => {
  await login(page, E2E_ADMIN)

  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(storage).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/) // ningún JWT guardado

  const visibleCookies = await page.evaluate(() => document.cookie)
  expect(visibleCookies).not.toContain('pos_refresh') // la cookie es HttpOnly

  const cookies = await page.context().cookies()
  const refresh = cookies.find((cookie) => cookie.name === 'pos_refresh')
  expect(refresh).toMatchObject({ httpOnly: true, sameSite: 'Strict', secure: true })
})

test('la sesión se recupera al recargar (refresh token en cookie)', async ({ page }) => {
  await login(page, E2E_ADMIN)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible()
})

test('un pedido hecho sin conexión se sincroniza al volver internet', async ({ page, context }) => {
  const dialogs: string[] = []
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    void dialog.accept()
  })

  await login(page, E2E_ADMIN)

  // Con conexión se cargan productos y mesas para tener copia local
  await page.getByRole('link', { name: 'Punto de venta' }).click()
  await expect(page.getByRole('heading', { name: 'Punto de venta', level: 2 })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)

  // --- Sin conexión ---
  await context.setOffline(true)
  await expect(page.getByText('Estás trabajando sin conexión')).toBeVisible()

  const tag = `e2e-${Date.now()}`

  await page.getByRole('button', { name: '+ Nuevo pedido' }).click()
  await page.locator('#order-product').selectOption({ index: 1 })
  await page.locator('#order-notes').fill(tag)
  await page.getByRole('button', { name: 'Registrar pedido' }).click()

  await expect.poll(() => dialogs.join('\n')).toContain('Pedido registrado correctamente')

  // El pedido quedó en la cola local con un id temporal (negativo)
  const queue = await readLocalStore(page, 'syncQueue')
  expect(queue.some((op) => op.entity === 'orders' && (op.data as { notes?: string }).notes === tag)).toBe(true)

  // La página abre aunque se recargue sin internet (Service Worker)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Punto de venta', level: 2 })).toBeVisible()

  await page.getByRole('link', { name: 'Sincronización' }).click()
  await expect(page.getByText('Crear pedido')).toBeVisible()

  // --- Vuelve la conexión: se sincroniza automáticamente ---
  await context.setOffline(false)

  await expect
    .poll(async () => (await readLocalStore(page, 'syncQueue')).length, { timeout: 30_000 })
    .toBe(0)

  const orders = await readLocalStore(page, 'orders')
  const synced = orders.find((order) => order.notes === tag)
  expect(synced).toBeDefined()
  expect(Number(synced?.id)).toBeGreaterThan(0) // ya tiene id real del servidor
})

test('un mesero no ve las opciones de administrador', async ({ page }) => {
  await login(page, E2E_WAITER)

  await expect(page.getByRole('link', { name: 'Pedidos' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Categorías' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Historial de ventas' })).toHaveCount(0)

  // Si escribe la dirección a mano, el router lo devuelve al inicio
  await page.goto('/categories')
  await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible()
})
