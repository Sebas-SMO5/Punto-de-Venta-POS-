
import { getDatabase, type PendingOperation } from './db'

export const addOperation = async (
  operation: Omit<PendingOperation, 'id' | 'createdAt' | 'status' | 'attempts'>
) => {
  const db = await getDatabase()

  const newOperation: PendingOperation = {
    ...operation,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0
  }

  return db.add('syncQueue', newOperation)
}

export const getPendingOperations = async () => {
  const db = await getDatabase()
  return db.getAllFromIndex('syncQueue', 'by-status', 'pending')
}

export const getAllOperations = async () => {
  const db = await getDatabase()
  return db.getAll('syncQueue')
}

export const updateOperation = async (
  id: number,
  changes: Partial<PendingOperation>
) => {
  const db = await getDatabase()
  const operation = await db.get('syncQueue', id)

  if (!operation) {
    throw new Error(`No existe la operación ${id}`)
  }

  await db.put('syncQueue', {
    ...operation,
    ...changes,
    id
  })
}

export const deleteOperation = async (id: number) => {
  const db = await getDatabase()
  await db.delete('syncQueue', id)
}

export const getPendingCount = async () => {
  const db = await getDatabase()
  return db.countFromIndex('syncQueue', 'by-status', 'pending')
}

export const retryFailedOperations = async () => {
  const db = await getDatabase()
  const failed = await db.getAllFromIndex('syncQueue', 'by-status', 'error')

  const transaction = db.transaction('syncQueue', 'readwrite')

  await Promise.all([
    ...failed.map(operation =>
      transaction.store.put({
        ...operation,
        status: 'pending',
        error: undefined
      })
    ),
    transaction.done
  ])
}
