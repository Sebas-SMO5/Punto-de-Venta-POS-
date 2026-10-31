
import { getDatabase, type PendingOperation } from './db'
import { getPendingOperations, updateOperation, deleteOperation } from './queue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

let synchronizing = false

const getEndpoint = (entity: PendingOperation['entity']) => {
  const endpoints = {
    products: 'products',
    categories: 'categories',
    tables: 'tables',
    orders: 'orders',
    sales: 'sales'
  }

  return `${API_URL}/${endpoints[entity]}`
}

const sendOperation = async (operation: PendingOperation) => {
  const endpoint = getEndpoint(operation.entity)

  const response = await fetch(
    operation.type === 'CREATE'
      ? endpoint
      : `${endpoint}/${operation.data.id}`,
    {
      method: {
        CREATE: 'POST',
        UPDATE: 'PUT',
        DELETE: 'DELETE'
      }[operation.type],
      headers: {
        'Content-Type': 'application/json'
      },
      body: operation.type === 'DELETE'
        ? undefined
        : JSON.stringify(operation.data)
    }
  )

  if (!response.ok) {
    throw new Error(`Error ${response.status} al sincronizar ${operation.entity}`)
  }
}

export const synchronizeData = async () => {
  if (!navigator.onLine || synchronizing) return

  synchronizing = true

  try {
    const operations = await getPendingOperations()

    for (const operation of operations) {
      if (operation.id === undefined) continue

      try {
        await updateOperation(operation.id, { status: 'processing' })
        await sendOperation(operation)
        await deleteOperation(operation.id)
      } catch (error) {
        await updateOperation(operation.id, {
          status: 'error',
          attempts: operation.attempts + 1,
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }
  } finally {
    synchronizing = false
  }
}

export const startAutoSync = () => {
  window.addEventListener('online', synchronizeData)
  synchronizeData()
}

export const stopAutoSync = () => {
  window.removeEventListener('online', synchronizeData)
}
