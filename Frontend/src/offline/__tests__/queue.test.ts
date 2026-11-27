// Pruebas unitarias de la cola offline usando una IndexedDB simulada
// (fake-indexeddb), así se pueden correr sin navegador.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase } from '../db'
import {
  addOperation,
  getAllOperations,
  getPendingOperations,
  retryFailedOperations,
  sortOperations,
  updateOperation,
} from '../queue'

beforeEach(async () => {
  const db = await getDatabase()
  await db.clear('syncQueue')
})

describe('cola de operaciones offline', () => {
  it('guarda una operación como pendiente', async () => {
    await addOperation({ operationId: 'a', type: 'CREATE', entity: 'orders', data: { tableId: 1 } })

    const [operation] = await getAllOperations()
    expect(operation).toMatchObject({ operationId: 'a', status: 'pending', attempts: 0 })
  })

  it('no duplica una operación con el mismo operationId', async () => {
    const first = await addOperation({ operationId: 'dup', type: 'CREATE', entity: 'orders', data: {} })
    const second = await addOperation({ operationId: 'dup', type: 'CREATE', entity: 'orders', data: {} })

    expect(second).toBe(first)
    expect(await getAllOperations()).toHaveLength(1)
  })

  it('recupera como pendientes las operaciones que quedaron "enviándose"', async () => {
    const id = await addOperation({ operationId: 'p', type: 'UPDATE', entity: 'orders', data: { id: 1 } })
    await updateOperation(id, { status: 'processing' })

    const pending = await getPendingOperations()
    expect(pending[0]?.status).toBe('pending')
  })

  it('no entrega conflictos ni errores como pendientes', async () => {
    const a = await addOperation({ operationId: 'c', type: 'UPDATE', entity: 'products', data: { id: 1 } })
    const b = await addOperation({ operationId: 'e', type: 'UPDATE', entity: 'products', data: { id: 2 } })
    await updateOperation(a, { status: 'conflict' })
    await updateOperation(b, { status: 'error' })

    expect(await getPendingOperations()).toHaveLength(0)
  })

  it('"reintentar errores" vuelve a poner las operaciones con error como pendientes', async () => {
    const id = await addOperation({ operationId: 'r', type: 'CREATE', entity: 'sales', data: {} })
    await updateOperation(id, { status: 'error', error: 'falló' })

    await retryFailedOperations()

    const [operation] = await getAllOperations()
    expect(operation).toMatchObject({ status: 'pending', error: undefined })
  })

  it('ordena las operaciones por fecha y luego por id (orden determinístico)', () => {
    const base = { operationId: '', type: 'CREATE' as const, entity: 'orders' as const, data: {}, status: 'pending' as const, attempts: 0 }
    const sorted = sortOperations([
      { ...base, id: 3, createdAt: '2026-01-01T10:00:00.000Z' },
      { ...base, id: 1, createdAt: '2026-01-01T11:00:00.000Z' },
      { ...base, id: 2, createdAt: '2026-01-01T10:00:00.000Z' },
    ])

    expect(sorted.map((op) => op.id)).toEqual([2, 3, 1])
  })
})
