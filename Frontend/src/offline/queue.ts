// Cola de operaciones pendientes (guardada en IndexedDB).
// Cada vez que se crea, edita o borra algo sin conexión, se agrega aquí
// una "operación". El sincronizador (sync.ts) las envía en orden de llegada.
import { getDatabase, type PendingOperation } from './db'

export const addOperation = async (
  operation: Omit<PendingOperation, 'id' | 'createdAt' | 'status' | 'attempts'>,
): Promise<number> => {
  const db = await getDatabase()

  // Si la misma operación ya está en la cola, no se duplica
  const existing = await db.getAll('syncQueue')
  const duplicate = existing.find((item) => item.operationId === operation.operationId)

  if (duplicate?.id !== undefined) {
    return duplicate.id
  }

  const newOperation: PendingOperation = {
    ...operation,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  }

  return db.add('syncQueue', newOperation)
}

// Operaciones listas para enviarse, de la más antigua a la más nueva.
// Si el navegador se cerró mientras una se enviaba ("processing"), se
// recupera como pendiente.
export const getPendingOperations = async (): Promise<PendingOperation[]> => {
  const db = await getDatabase()
  const operations = await db.getAll('syncQueue')
  const pendingOperations: PendingOperation[] = []

  for (const operation of operations) {
    if (operation.status === 'processing') {
      const recovered: PendingOperation = { ...operation, status: 'pending' }
      await db.put('syncQueue', recovered)
      pendingOperations.push(recovered)
    } else if (operation.status === 'pending') {
      pendingOperations.push(operation)
    }
  }

  return sortOperations(pendingOperations)
}

// Orden determinístico: por fecha de creación y, si empatan, por id
export function sortOperations(operations: PendingOperation[]): PendingOperation[] {
  return [...operations].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || (a.id ?? 0) - (b.id ?? 0),
  )
}

export const getAllOperations = async (): Promise<PendingOperation[]> => {
  const db = await getDatabase()
  return sortOperations(await db.getAll('syncQueue'))
}

export const getOperation = async (id: number): Promise<PendingOperation | undefined> => {
  const db = await getDatabase()
  return db.get('syncQueue', id)
}

export const updateOperation = async (
  id: number,
  changes: Partial<PendingOperation>,
): Promise<void> => {
  const db = await getDatabase()
  const operation = await db.get('syncQueue', id)

  if (!operation) {
    throw new Error(`No existe la operación ${id}`)
  }

  await db.put('syncQueue', { ...operation, ...changes, id })
}

export const deleteOperation = async (id: number): Promise<void> => {
  const db = await getDatabase()
  await db.delete('syncQueue', id)
}

export const getPendingCount = async (): Promise<number> => {
  const db = await getDatabase()
  return (await db.getAll('syncQueue')).length
}

// Vuelve a poner como pendientes las operaciones con error
export const retryFailedOperations = async (): Promise<void> => {
  const db = await getDatabase()
  const failed = await db.getAllFromIndex('syncQueue', 'by-status', 'error')

  for (const operation of failed) {
    if (operation.id === undefined) continue

    await db.put('syncQueue', {
      ...operation,
      status: 'pending',
      error: undefined,
      nextAttemptAt: undefined,
    })
  }
}
