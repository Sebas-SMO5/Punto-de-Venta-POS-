
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
  syncQueue: {
    key: number
    value: PendingOperation
    indexes: {
      'by-status': string
      'by-date': string
    }
  }
}

let database: Promise<IDBPDatabase<POSDatabase>> | null = null

export const getDatabase = () => {
  if (!database) {
    database = openDB<POSDatabase>('restaurante-pos', 1, {
      upgrade(db) {
        db.createObjectStore('products', { keyPath: 'id' })
        db.createObjectStore('categories', { keyPath: 'id' })
        db.createObjectStore('tables', { keyPath: 'id' })
        db.createObjectStore('orders', { keyPath: 'id' })
        db.createObjectStore('sales', { keyPath: 'id' })

        const queue = db.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true
        })

        queue.createIndex('by-status', 'status')
        queue.createIndex('by-date', 'createdAt')
      }
    })
  }

  return database
}

export const saveLocalData = async (
  store: 'products' | 'categories' | 'tables' | 'orders' | 'sales',
  data: Record<string, unknown> & { id: number }
) => {
  const db = await getDatabase()
  await db.put(store, data)
}

export const saveManyLocalData = async (
  store: 'products' | 'categories' | 'tables' | 'orders' | 'sales',
  data: (Record<string, unknown> & { id: number })[]
) => {
  const db = await getDatabase()
  const transaction = db.transaction(store, 'readwrite')

  await Promise.all([
    ...data.map(item => transaction.store.put(item)),
    transaction.done
  ])
}

export const getLocalData = async (
  store: 'products' | 'categories' | 'tables' | 'orders' | 'sales'
) => {
  const db = await getDatabase()
  return db.getAll(store)
}

export const deleteLocalData = async (
  store: 'products' | 'categories' | 'tables' | 'orders' | 'sales',
  id: number
) => {
  const db = await getDatabase()
  await db.delete(store, id)
}

export const clearLocalData = async (
  store: 'products' | 'categories' | 'tables' | 'orders' | 'sales'
) => {
  const db = await getDatabase()
  await db.clear(store)
}
