// Base de datos LOCAL del navegador (IndexedDB), usando la librería "idb".
// Aquí se guarda una copia de productos, pedidos, ventas, etc. para que el
// POS funcione aunque no haya internet, y la COLA de operaciones
// pendientes (syncQueue) que se enviarán al servidor al volver la conexión.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export type SyncEntity = 'products' | 'categories' | 'tables' | 'orders' | 'sales'
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE'

// pending    -> esperando para enviarse
// processing -> enviándose en este momento
// error      -> el servidor la rechazó (datos inválidos, sin permiso...)
// conflict   -> choca con un cambio hecho en el servidor; alguien decide
export type OperationStatus = 'pending' | 'processing' | 'error' | 'conflict'

export interface ConflictInfo {
  reason: string
  message: string
  server?: unknown
  detectedAt: string
}

export interface PendingOperation {
  id?: number
  operationId: string
  type: OperationType
  entity: SyncEntity
  data: Record<string, unknown>
  createdAt: string
  status: OperationStatus
  attempts: number
  error?: string
  conflict?: ConflictInfo
  // Momento (ms) desde el que se puede volver a intentar (espera creciente)
  nextAttemptAt?: number
}

// Registro de cómo se resolvió cada conflicto (para auditoría)
export interface SyncLogEntry {
  id?: number
  operationId: string
  entity: SyncEntity
  type: OperationType
  resolution: 'server_wins' | 'local_wins' | 'discarded'
  message: string
  at: string
}

export type LocalRecord = Record<string, unknown> & { id: number }

interface POSDatabase extends DBSchema {
  products: { key: number; value: LocalRecord }
  categories: { key: number; value: LocalRecord }
  tables: { key: number; value: LocalRecord }
  orders: { key: number; value: LocalRecord }
  sales: { key: number; value: LocalRecord }
  inventory: { key: number; value: LocalRecord }
  syncQueue: {
    key: number
    value: PendingOperation
    indexes: {
      'by-status': string
      'by-date': string
    }
  }
  syncLog: { key: number; value: SyncLogEntry }
}

export type DataStore = 'products' | 'categories' | 'tables' | 'orders' | 'sales' | 'inventory'

const DATA_STORES: DataStore[] = ['products', 'categories', 'tables', 'orders', 'sales', 'inventory']

let database: Promise<IDBPDatabase<POSDatabase>> | null = null

export const getDatabase = () => {
  if (!database) {
    database = openDB<POSDatabase>('restaurante-pos', 3, {
      upgrade(db) {
        for (const store of DATA_STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' })
          }
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const queue = db.createObjectStore('syncQueue', {
            keyPath: 'id',
            autoIncrement: true,
          })

          queue.createIndex('by-status', 'status')
          queue.createIndex('by-date', 'createdAt')
        }

        if (!db.objectStoreNames.contains('syncLog')) {
          db.createObjectStore('syncLog', { keyPath: 'id', autoIncrement: true })
        }
      },
    }).catch((error) => {
      database = null
      throw error
    })
  }

  return database
}

export const saveLocalData = async (store: DataStore, data: LocalRecord): Promise<void> => {
  const db = await getDatabase()
  await db.put(store, data)
}

export const saveManyLocalData = async (store: DataStore, data: LocalRecord[]): Promise<void> => {
  const db = await getDatabase()
  const transaction = db.transaction(store, 'readwrite')

  for (const item of data) {
    await transaction.store.put(item)
  }

  await transaction.done
}

export const getLocalData = async (store: DataStore): Promise<LocalRecord[]> => {
  const db = await getDatabase()
  return db.getAll(store)
}

export const deleteLocalData = async (store: DataStore, id: number): Promise<void> => {
  const db = await getDatabase()
  await db.delete(store, id)
}

export const clearLocalData = async (store: DataStore): Promise<void> => {
  const db = await getDatabase()
  await db.clear(store)
}

// Versiones "con tipo" de las funciones anteriores, para no repetir
// conversiones en cada servicio.
export async function readStore<T>(store: DataStore): Promise<T[]> {
  return (await getLocalData(store)) as unknown as T[]
}

export async function writeRecord<T extends { id: number }>(store: DataStore, record: T): Promise<void> {
  await saveLocalData(store, record as unknown as LocalRecord)
}

export async function writeRecords<T extends { id: number }>(store: DataStore, records: T[]): Promise<void> {
  await saveManyLocalData(store, records as unknown as LocalRecord[])
}

export async function addSyncLog(entry: Omit<SyncLogEntry, 'id' | 'at'>): Promise<void> {
  const db = await getDatabase()
  await db.add('syncLog', { ...entry, at: new Date().toISOString() })

  // Solo se guardan los últimos 100 registros
  const keys = await db.getAllKeys('syncLog')
  for (const key of keys.slice(0, Math.max(0, keys.length - 100))) {
    await db.delete('syncLog', key)
  }
}

export async function getSyncLog(): Promise<SyncLogEntry[]> {
  const db = await getDatabase()
  return (await db.getAll('syncLog')).reverse()
}
