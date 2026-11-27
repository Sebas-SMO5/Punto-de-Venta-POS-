// Servicio de categorías con soporte OFFLINE (misma idea que productos).
import { api, isConnectionError } from './api'
import { deleteLocalData, readStore, writeRecord, writeRecords } from '../offline/db'
import { addOperation, deleteOperation, getAllOperations, updateOperation } from '../offline/queue'

export interface Category {
  id: number
  name: string
  description: string
  active: boolean
  version?: number
  created_at?: string
}

export type CategoryInput = Pick<Category, 'name' | 'description' | 'active'>

const getLocalCategories = () => readStore<Category>('categories')

async function findPending(id: number, type: 'CREATE' | 'UPDATE' | 'DELETE') {
  const operations = await getAllOperations()
  return operations.find(
    (op) => op.entity === 'categories' && op.type === type && op.data.id === id && op.status === 'pending',
  )
}

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    if (!navigator.onLine) return getLocalCategories()

    try {
      const response = await api.get<Category[]>('/categories')
      await writeRecords('categories', response.data)
      return response.data
    } catch (error) {
      if (isConnectionError(error)) return getLocalCategories()
      throw error
    }
  },

  async create(data: CategoryInput): Promise<Category> {
    if (navigator.onLine) {
      try {
        const response = await api.post<Category>('/categories', data)
        await writeRecord('categories', response.data)
        return response.data
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    const category: Category = { id: -Date.now(), ...data, version: 1 }
    await writeRecord('categories', category)

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'CREATE',
      entity: 'categories',
      data: { ...category },
    })

    return category
  },

  async update(id: number, data: CategoryInput, expectedVersion?: number): Promise<Category> {
    if (id > 0 && navigator.onLine) {
      try {
        const response = await api.put<Category>(`/categories/${id}`, { ...data, expectedVersion })
        await writeRecord('categories', response.data)
        return response.data
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    const category: Category = { id, ...data, version: expectedVersion }
    await writeRecord('categories', category)

    const pendingCreate = await findPending(id, 'CREATE')
    const pendingUpdate = await findPending(id, 'UPDATE')

    if (pendingCreate?.id !== undefined) {
      await updateOperation(pendingCreate.id, { data: { ...pendingCreate.data, ...data } })
    } else if (pendingUpdate?.id !== undefined) {
      await updateOperation(pendingUpdate.id, { data: { ...pendingUpdate.data, ...data } })
    } else {
      await addOperation({
        operationId: crypto.randomUUID(),
        type: 'UPDATE',
        entity: 'categories',
        data: { ...data, id, expectedVersion },
      })
    }

    return category
  },

  async deactivate(id: number): Promise<void> {
    if (id > 0 && navigator.onLine) {
      try {
        await api.delete(`/categories/${id}`)
        const category = (await getLocalCategories()).find((item) => item.id === id)
        if (category) await writeRecord('categories', { ...category, active: false })
        return
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    const category = (await getLocalCategories()).find((item) => item.id === id)

    if (!category) {
      throw new Error('No se encontró la categoría')
    }

    const pendingCreate = await findPending(id, 'CREATE')

    if (pendingCreate?.id !== undefined) {
      // Creada y desactivada sin conexión: se eliminan todas sus operaciones
      const related = (await getAllOperations()).filter(
        (op) => op.entity === 'categories' && op.data.id === id,
      )

      for (const op of related) {
        if (op.id !== undefined) await deleteOperation(op.id)
      }

      await deleteLocalData('categories', id)
      return
    }

    await writeRecord('categories', { ...category, active: false })

    if (!(await findPending(id, 'DELETE'))) {
      await addOperation({
        operationId: crypto.randomUUID(),
        type: 'DELETE',
        entity: 'categories',
        data: { id },
      })
    }
  },
}
