import { getDatabase, type PendingOperation } from './db'

export const addOperation = async (
  operation: Omit<PendingOperation, 'id' | 'createdAt' | 'status' | 'attempts'>
): Promise<number> => {
  const db = await getDatabase()

  const existing = await db.getAll('syncQueue')
  const duplicate = existing.find(
    item => item.operationId === operation.operationId
  )

  if (duplicate?.id !== undefined) {
    return duplicate.id
  }

  const newOperation: PendingOperation = {
    ...operation,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0
  }

  return db.add('syncQueue', newOperation)
}

export const getPendingOperations = async (): Promise<PendingOperation[]> => {
  const db = await getDatabase()
  const operations = await db.getAll('syncQueue')

  const pendingOperations: PendingOperation[] = []

  for (const operation of operations) {
    if (operation.status === 'processing') {
      const recoveredOperation: PendingOperation = {
        ...operation,
        status: 'pending'
      }

      if (operation.id !== undefined) {
        await db.put('syncQueue', recoveredOperation)
      }

      pendingOperations.push(recoveredOperation)
    } else if (operation.status === 'pending') {
      pendingOperations.push(operation)
    }
  }

  return pendingOperations.sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
}

export const getAllOperations = async (): Promise<PendingOperation[]> => {
  const db = await getDatabase()
  return db.getAll('syncQueue')
}

export const updateOperation = async (
  id: number,
  changes: Partial<PendingOperation>
): Promise<void> => {
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

export const deleteOperation = async (id: number): Promise<void> => {
  const db = await getDatabase()
  await db.delete('syncQueue', id)
}

export const getPendingCount = async (): Promise<number> => {
  const db = await getDatabase()
  const operations = await db.getAll('syncQueue')

  return operations.filter(operation =>
    operation.status === 'pending' ||
    operation.status === 'processing' ||
    operation.status === 'error'
  ).length
}

export const retryFailedOperations = async (): Promise<void> => {
  const db = await getDatabase()
  const failed = await db.getAllFromIndex(
    'syncQueue',
    'by-status',
    'error'
  )

  for (const operation of failed) {
    if (operation.id === undefined) continue

    await db.put('syncQueue', {
      ...operation,
      status: 'pending',
      error: undefined
    })
  }
}