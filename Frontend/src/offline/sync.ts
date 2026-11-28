// SINCRONIZADOR: envía al servidor las operaciones que se hicieron sin
// conexión, en el mismo orden en que ocurrieron, y aplica las reglas de
// conflicto de syncRules.ts.
//
// Usa el mismo cliente "api" que el resto de la app, así cada petición
// lleva el Access Token y se renueva la sesión si hace falta.
import axios from 'axios'
import { api } from '../services/api'
import { getAccessToken, refreshSession } from '../services/session'
import type { ApiError, ServerOrder } from '../types/models'
import {
  addSyncLog,
  deleteLocalData,
  getDatabase,
  saveLocalData,
  type LocalRecord,
  type PendingOperation,
  type SyncEntity,
} from './db'
import {
  deleteOperation,
  getAllOperations,
  getOperation,
  getPendingOperations,
  updateOperation,
} from './queue'
import { backoffDelay, decide, waitingForDependency, type ServerFailure } from './syncRules'

let synchronizing = false
let syncInterval: number | undefined

export const SYNC_EVENT = 'pos-sync-changed'

function notifyChange(): void {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT))
}

// ---------- utilidades ----------

function pick(data: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const key of keys) {
    if (data[key] !== undefined) result[key] = data[key]
  }

  return result
}

function toLocalRecord(value: unknown): LocalRecord | null {
  if (typeof value !== 'object' || value === null) return null

  const record = value as Record<string, unknown>
  const id = Number(record.id)

  if (!Number.isSafeInteger(id)) return null

  const normalized: LocalRecord = { ...record, id }

  // PostgreSQL devuelve los números decimales como texto: se convierten
  for (const key of ['price', 'current_stock', 'minimum_stock', 'total', 'stock', 'minimum']) {
    if (typeof normalized[key] === 'string') normalized[key] = Number(normalized[key])
  }

  return normalized
}

async function saveServerRecord(store: SyncEntity, value: unknown): Promise<void> {
  const record = toLocalRecord(value)
  if (record) await saveLocalData(store, record)
}

// Cuando un registro creado sin conexión recibe su id real del servidor,
// se actualizan las demás operaciones de la cola que usaban el id temporal.
async function replaceTemporaryId(
  entity: SyncEntity,
  localId: number,
  serverId: number,
  skipId: number | undefined,
): Promise<void> {
  for (const pending of await getAllOperations()) {
    if (pending.id === undefined || pending.id === skipId) continue

    const data = { ...pending.data }
    let changed = false

    if (pending.entity === entity && data.id === localId) {
      data.id = serverId
      changed = true
    }

    if (entity === 'orders' && pending.entity === 'sales' && data.orderId === localId) {
      data.orderId = serverId
      changed = true
    }

    if (entity === 'products' && pending.entity === 'orders' && Array.isArray(data.items)) {
      data.items = data.items.map((item: unknown) => {
        const line = item as { productId?: unknown }
        if (line.productId === localId) {
          changed = true
          return { ...line, productId: serverId }
        }
        return item
      })
    }

    if (changed) await updateOperation(pending.id, { data })
  }
}

function toFailure(error: unknown): ServerFailure {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiError | undefined

    return {
      status: error.response?.status,
      reason: body?.detalles?.reason,
      message: body?.mensaje ?? error.message,
      server: body?.detalles?.server,
    }
  }

  return { status: 0, message: error instanceof Error ? error.message : 'Error desconocido' }
}

// ---------- envío por tipo de dato ----------

const PRODUCT_FIELDS = ['name', 'category', 'price', 'description', 'available', 'minimum_stock']
const CATEGORY_FIELDS = ['name', 'description', 'active']

async function sendProduct(op: PendingOperation): Promise<void> {
  const id = Number(op.data.id)

  if (op.type === 'CREATE') {
    const payload = pick(op.data, [...PRODUCT_FIELDS, 'current_stock'])
    const { data } = await api.post<LocalRecord>('/products', payload)
    const serverId = Number(data.id)

    await deleteLocalData('products', id)
    await saveServerRecord('products', data)
    await replaceTemporaryId('products', id, serverId, op.id)
    return
  }

  if (op.type === 'UPDATE') {
    const payload = pick(op.data, [...PRODUCT_FIELDS, 'expectedVersion'])
    const { data } = await api.put<LocalRecord>(`/products/${id}`, payload)
    await saveServerRecord('products', data)
    return
  }

  await api.delete(`/products/${id}`)
  await deleteLocalData('products', id)
}

async function sendCategory(op: PendingOperation): Promise<void> {
  const id = Number(op.data.id)

  if (op.type === 'CREATE') {
    const { data } = await api.post<LocalRecord>('/categories', pick(op.data, CATEGORY_FIELDS))

    await deleteLocalData('categories', id)
    await saveServerRecord('categories', data)
    await replaceTemporaryId('categories', id, Number(data.id), op.id)
    return
  }

  if (op.type === 'UPDATE') {
    const payload = pick(op.data, [...CATEGORY_FIELDS, 'expectedVersion'])
    const { data } = await api.put<LocalRecord>(`/categories/${id}`, payload)
    await saveServerRecord('categories', data)
    return
  }

  await api.delete(`/categories/${id}`)
  const db = await getDatabase()
  const category = await db.get('categories', id)
  if (category) await saveLocalData('categories', { ...category, active: false })
}

async function sendOrder(op: PendingOperation): Promise<void> {
  const id = Number(op.data.id)

  if (op.type === 'CREATE') {
    const localOrderId = Number(op.data.localOrderId)
    const payload = {
      tableId: op.data.tableId,
      localId: op.data.localId ?? op.operationId,
      notes: op.data.notes ?? '',
      items: op.data.items,
    }

    const { data } = await api.post<ServerOrder>('/orders', payload)
    const serverId = Number(data.id)

    if (Number.isSafeInteger(localOrderId)) await deleteLocalData('orders', localOrderId)
    await saveServerRecord('orders', data)
    await replaceTemporaryId('orders', localOrderId, serverId, op.id)
    return
  }

  if (op.type === 'UPDATE') {
    const { data } = await api.patch<ServerOrder>(`/orders/${id}/status`, { status: op.data.status })
    await saveServerRecord('orders', data)
    return
  }

  const { data } = await api.delete<{ order?: ServerOrder }>(`/orders/${id}`)
  await saveServerRecord('orders', data.order)
}

async function sendSale(op: PendingOperation): Promise<void> {
  if (op.type !== 'CREATE') {
    throw new Error('Las ventas solo se pueden crear')
  }

  const { data } = await api.post<{ venta?: LocalRecord }>('/sales', {
    orderId: Number(op.data.orderId),
    paymentMethodId: Number(op.data.paymentMethodId),
    reference: op.data.reference ?? null,
  })

  const sale = toLocalRecord(data.venta)
  const localSaleId = Number(op.data.localSaleId)

  if (sale) await saveLocalData('sales', { ...sale, order_id: Number(op.data.orderId), pendingSync: false })
  if (Number.isSafeInteger(localSaleId) && localSaleId < 0) await deleteLocalData('sales', localSaleId)
}

// Entrada de inventario hecha sin conexión. Lleva localId: si se envía dos
// veces, el servidor no suma dos veces.
async function sendInventory(op: PendingOperation): Promise<void> {
  const { data } = await api.post<LocalRecord>('/inventory/movements', {
    productId: Number(op.data.productId),
    type: 'entry',
    quantity: Number(op.data.quantity),
    reason: op.data.reason ?? '',
    localId: op.data.localId ?? op.operationId,
  })

  await saveServerRecord('inventory', data)
}

async function sendOperation(op: PendingOperation): Promise<void> {
  switch (op.entity) {
    case 'products':
      return sendProduct(op)
    case 'categories':
      return sendCategory(op)
    case 'orders':
      return sendOrder(op)
    case 'sales':
      return sendSale(op)
    case 'inventory':
      return sendInventory(op)
    default:
      throw new Error(`La sincronización de ${op.entity} no está disponible`)
  }
}

// ---------- ciclo de sincronización ----------

async function applyServerVersion(op: PendingOperation, server: unknown): Promise<void> {
  if (server === undefined) {
    if (op.type === 'CREATE' && op.entity !== 'sales') {
      await deleteLocalData(op.entity, Number(op.data.id))
    }
    return
  }

  await saveServerRecord(op.entity, server)
}

async function processOperation(op: PendingOperation): Promise<'continue' | 'stop'> {
  const id = op.id as number

  await updateOperation(id, { status: 'processing', error: undefined })

  try {
    await sendOperation(op)
    await deleteOperation(id)
    return 'continue'
  } catch (error) {
    const decision = decide(toFailure(error), op.type)

    switch (decision.action) {
      case 'retry_later':
        await updateOperation(id, {
          status: 'pending',
          attempts: op.attempts + 1,
          nextAttemptAt: Date.now() + backoffDelay(op.attempts + 1),
          error: 'Servidor no disponible, se reintentará',
        })
        return 'stop'

      case 'stop':
        await updateOperation(id, { status: 'pending' })
        return 'stop'

      case 'server_wins':
        // Resolución automática: se acepta la versión del servidor
        await applyServerVersion(op, decision.server)
        await deleteOperation(id)
        await addSyncLog({
          operationId: op.operationId,
          entity: op.entity,
          type: op.type,
          resolution: 'server_wins',
          message: decision.message,
        })
        return 'continue'

      case 'conflict':
        await updateOperation(id, {
          status: 'conflict',
          attempts: op.attempts + 1,
          error: decision.message,
          conflict: {
            reason: decision.reason,
            message: decision.message,
            server: decision.server,
            detectedAt: new Date().toISOString(),
          },
        })
        return 'continue'

      case 'error':
        await updateOperation(id, {
          status: 'error',
          attempts: op.attempts + 1,
          error: decision.message,
        })
        return 'continue'
    }
  }
}

export const synchronizeData = async (): Promise<void> => {
  if (!navigator.onLine || synchronizing) return

  synchronizing = true

  try {
    // Se necesita una sesión válida para enviar datos
    if (!getAccessToken()) {
      const session = await refreshSession().catch(() => null)
      if (!session) return
    }

    for (const queued of await getPendingOperations()) {
      if (!navigator.onLine) break
      if (queued.id === undefined) continue

      // Se vuelve a leer por si cambió mientras se procesaban las anteriores
      const op = await getOperation(queued.id)

      if (!op || op.status !== 'pending') continue
      if (op.nextAttemptAt && op.nextAttemptAt > Date.now()) continue
      if (waitingForDependency(op)) continue

      if ((await processOperation(op)) === 'stop') break
    }
  } finally {
    synchronizing = false
    notifyChange()
  }
}

// ---------- resolución manual de conflictos ----------

// choice = 'local'  -> "mantener mi cambio"
// choice = 'server' -> "usar lo que está en el servidor"
export async function resolveConflict(operationId: number, choice: 'local' | 'server'): Promise<void> {
  const op = await getOperation(operationId)

  if (!op || op.status !== 'conflict' || !op.conflict) return

  const { reason, server } = op.conflict

  if (choice === 'local') {
    const data = { ...op.data }

    // Se reenvía el cambio tomando como base la versión actual del servidor
    if (reason === 'VERSION_MISMATCH' && typeof server === 'object' && server !== null) {
      data.expectedVersion = Number((server as { version?: unknown }).version)
    }

    await updateOperation(operationId, {
      data,
      status: 'pending',
      conflict: undefined,
      error: undefined,
      nextAttemptAt: undefined,
    })
    await addSyncLog({
      operationId: op.operationId,
      entity: op.entity,
      type: op.type,
      resolution: 'local_wins',
      message: 'Se mantuvo el cambio hecho en este dispositivo',
    })
  } else {
    if (reason === 'VERSION_MISMATCH') {
      await saveServerRecord(op.entity, server)
    }

    if (op.entity === 'sales') {
      const localSaleId = Number(op.data.localSaleId)
      if (Number.isSafeInteger(localSaleId) && localSaleId < 0) {
        await deleteLocalData('sales', localSaleId)
      }
    }

    await deleteOperation(operationId)
    await addSyncLog({
      operationId: op.operationId,
      entity: op.entity,
      type: op.type,
      resolution: reason === 'VERSION_MISMATCH' ? 'server_wins' : 'discarded',
      message:
        reason === 'VERSION_MISMATCH'
          ? 'Se conservó la versión del servidor'
          : 'La operación se descartó',
    })
  }

  notifyChange()
  await synchronizeData()
}

export async function discardOperation(operationId: number): Promise<void> {
  const op = await getOperation(operationId)
  if (!op) return

  await deleteOperation(operationId)
  await addSyncLog({
    operationId: op.operationId,
    entity: op.entity,
    type: op.type,
    resolution: 'discarded',
    message: 'Operación descartada manualmente',
  })
  notifyChange()
}

// ---------- sincronización automática ----------

export const startAutoSync = (): void => {
  window.addEventListener('online', synchronizeData)

  void synchronizeData()

  if (syncInterval !== undefined) {
    window.clearInterval(syncInterval)
  }

  syncInterval = window.setInterval(() => {
    if (navigator.onLine) void synchronizeData()
  }, 15000)
}

export const stopAutoSync = (): void => {
  window.removeEventListener('online', synchronizeData)

  if (syncInterval !== undefined) {
    window.clearInterval(syncInterval)
    syncInterval = undefined
  }
}
