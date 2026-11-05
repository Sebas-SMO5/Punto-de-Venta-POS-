import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface PendingOperation {
  id?: number
  operationId: string
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  entity: 'products' | 'categories' | 'tables' | 'orders' | 'sales'
  data: Record<string, unknown>
  createdAt: string
  status: 'pending' | 'processing' | 'error'
  attempts: number
  error?: string
}

interface POSDatabase extends DBSchema {
  products: {
    key: number
    value: Record<string, unknown> & { id: number }
  }
  categories: {
    key: number
    value: Record<string, unknown> & { id: number }
  }
  tables: {
    key: number
    value: Record<string, unknown> & { id: number }
  }
  orders: {
    key: number
    value: Record<string, unknown> & { id: number }
  }
  sales: {
    key: number
    value: Record<string, unknown> & { id: number }
  }
  inventory: {
    key: number
    value: Record<string, unknown> & { id: number }
  }
  syncQueue: {
    key: number
    value: PendingOperation
    indexes: {
      'by-status': string
      'by-date': string
    }
  }
}

type DataStore =
  | 'products'
  | 'categories'
  | 'tables'
  | 'orders'
  | 'sales'
  | 'inventory'

let database: Promise<IDBPDatabase<POSDatabase>> | null = null

export const getDatabase = () => {
  if (!database) {
    database = openDB<POSDatabase>('restaurante-pos', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('tables')) {
          db.createObjectStore('tables', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('sales')) {
          db.createObjectStore('sales', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const queue = db.createObjectStore('syncQueue', {
            keyPath: 'id',
            autoIncrement: true
          })

          queue.createIndex('by-status', 'status')
          queue.createIndex('by-date', 'createdAt')
        }
      }
    }).catch(error => {
      database = null
      throw error
    })
  }

  return database
}

export const saveLocalData = async (
  store: DataStore,
  data: Record<string, unknown> & { id: number }
): Promise<void> => {
  const db = await getDatabase()
  await db.put(store, data)
}

export const saveManyLocalData = async (
  store: DataStore,
  data: (Record<string, unknown> & { id: number })[]
): Promise<void> => {
  const db = await getDatabase()
  const transaction = db.transaction(store, 'readwrite')

  for (const item of data) {
    await transaction.store.put(item)
  }

  await transaction.done
}

export const getLocalData = async (store: DataStore) => {
  const db = await getDatabase()
  return db.getAll(store)
}

export const deleteLocalData = async (
  store: DataStore,
  id: number
): Promise<void> => {
  const db = await getDatabase()
  await db.delete(store, id)
}

export const clearLocalData = async (store: DataStore): Promise<void> => {
  const db = await getDatabase()
  await db.clear(store)
}