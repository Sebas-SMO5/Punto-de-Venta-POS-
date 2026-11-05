import { api } from './api'
import {
  getLocalData,
  saveLocalData,
  saveManyLocalData,
  deleteLocalData
} from '../offline/db'
import {
  addOperation,
  getAllOperations,
  updateOperation,
  deleteOperation
} from '../offline/queue'

export interface Category {
  id: number
  name: string
  description: string
  active: boolean
  created_at?: string
}

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    try {
      if (!navigator.onLine) {
        return await getLocalData('categories') as unknown as Category[]
      }

      const response = await api.get<Category[]>('/categories')

      await saveManyLocalData(
        'categories',
        response.data as unknown as (Record<string, unknown> & { id: number })[]
      )

      return response.data
    } catch (error) {
      if (!navigator.onLine) {
        return await getLocalData('categories') as unknown as Category[]
      }

      throw error
    }
  },

  async create(
    data: Omit<Category, 'id' | 'created_at'>
  ): Promise<Category> {
    if (navigator.onLine) {
      try {
        const response = await api.post<Category>('/categories', data)

        await saveLocalData(
          'categories',
          response.data as unknown as Record<string, unknown> & { id: number }
        )

        return response.data
      } catch (error) {
        if (navigator.onLine) throw error
      }
    }

    const category: Category = {
      id: -Date.now(),
      ...data
    }

    await saveLocalData(
      'categories',
      category as unknown as Record<string, unknown> & { id: number }
    )

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'CREATE',
      entity: 'categories',
      data: category as unknown as Record<string, unknown>
    })

    return category
  },

  async update(
    id: number,
    data: Omit<Category, 'id' | 'created_at'>
  ): Promise<Category> {
    if (id > 0 && navigator.onLine) {
      try {
        const response = await api.put<Category>(`/categories/${id}`, data)

        await saveLocalData(
          'categories',
          response.data as unknown as Record<string, unknown> & { id: number }
        )

        return response.data
      } catch (error) {
        if (navigator.onLine) throw error
      }
    }

    const category: Category = {
      id,
      ...data
    }

    await saveLocalData(
      'categories',
      category as unknown as Record<string, unknown> & { id: number }
    )

    const operations = await getAllOperations()

    const pendingCreate = operations.find(operation =>
      operation.entity === 'categories' &&
      operation.type === 'CREATE' &&
      operation.data.id === id
    )

    if (pendingCreate?.id !== undefined) {
      await updateOperation(pendingCreate.id, {
        data: category as unknown as Record<string, unknown>
      })
    } else {
      const pendingUpdate = operations.find(operation =>
        operation.entity === 'categories' &&
        operation.type === 'UPDATE' &&
        operation.data.id === id
      )

      if (pendingUpdate?.id !== undefined) {
        await updateOperation(pendingUpdate.id, {
          data: category as unknown as Record<string, unknown>
        })
      } else {
        await addOperation({
          operationId: crypto.randomUUID(),
          type: 'UPDATE',
          entity: 'categories',
          data: category as unknown as Record<string, unknown>
        })
      }
    }

    return category
  },

  async deactivate(id: number): Promise<void> {
    if (id > 0 && navigator.onLine) {
      try {
        await api.delete(`/categories/${id}`)

        const categories = await getLocalData('categories')
        const category = categories.find(item => item.id === id)

        if (category) {
          await saveLocalData('categories', {
            ...category,
            active: false
          })
        }

        return
      } catch (error) {
        if (navigator.onLine) throw error
      }
    }

    const categories = await getLocalData('categories')
    const category = categories.find(item => item.id === id)

    if (!category) {
      throw new Error('No se encontró la categoría')
    }

    const operations = await getAllOperations()

    const pendingCreate = operations.find(operation =>
      operation.entity === 'categories' &&
      operation.type === 'CREATE' &&
      operation.data.id === id
    )

    if (pendingCreate?.id !== undefined) {
      await deleteOperation(pendingCreate.id)

      const relatedOperations = operations.filter(operation =>
        operation.entity === 'categories' &&
        operation.data.id === id &&
        operation.id !== pendingCreate.id
      )

      for (const operation of relatedOperations) {
        if (operation.id !== undefined) {
          await deleteOperation(operation.id)
        }
      }

      await deleteLocalData('categories', id)
      return
    }

    await saveLocalData('categories', {
      ...category,
      active: false
    })

    const pendingDelete = operations.find(operation =>
      operation.entity === 'categories' &&
      operation.type === 'DELETE' &&
      operation.data.id === id
    )

    if (!pendingDelete) {
      await addOperation({
        operationId: crypto.randomUUID(),
        type: 'DELETE',
        entity: 'categories',
        data: { id }
      })
    }
  }
}