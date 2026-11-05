import { api } from './api'
import type { Product } from '../stores/products'
import {
  getLocalData,
  saveManyLocalData,
  saveLocalData,
  deleteLocalData
} from '../offline/db'
import {
  addOperation,
  getAllOperations,
  updateOperation,
  deleteOperation
} from '../offline/queue'

const saveProduct = async (product: Product) => {
  await saveLocalData(
    'products',
    product as unknown as Record<string, unknown> & { id: number }
  )
}

const getLocalProducts = async (): Promise<Product[]> => {
  return await getLocalData('products') as unknown as Product[]
}

const isConnectionError = (error: unknown): boolean => {
  if (!navigator.onLine) return true

  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    return (error as { response?: unknown }).response === undefined
  }

  return false
}

export const productsService = {
  async getAll(): Promise<Product[]> {
    try {
      if (!navigator.onLine) {
        return await getLocalProducts()
      }

      const response = await api.get<Product[]>('/products')

      await saveManyLocalData(
        'products',
        response.data as unknown as (Record<string, unknown> & { id: number })[]
      )

      return response.data
    } catch (error) {
      if (isConnectionError(error)) {
        return await getLocalProducts()
      }

      throw error
    }
  },

  async getById(id: number): Promise<Product> {
    try {
      if (!navigator.onLine) {
        const products = await getLocalProducts()
        const product = products.find(item => item.id === id)

        if (!product) {
          throw new Error('Producto no encontrado localmente')
        }

        return product
      }

      const response = await api.get<Product>(`/products/${id}`)

      await saveProduct(response.data)

      return response.data
    } catch (error) {
      if (isConnectionError(error)) {
        const products = await getLocalProducts()
        const product = products.find(item => item.id === id)

        if (product) {
          return product
        }
      }

      throw error
    }
  },

  async create(product: Omit<Product, 'id'>): Promise<Product> {
    if (navigator.onLine) {
      try {
        const response = await api.post<Product>('/products', product)

        await saveProduct(response.data)

        return response.data
      } catch (error) {
        if (!isConnectionError(error)) {
          throw error
        }
      }
    }

    const localProduct: Product = {
      ...product,
      id: -Date.now()
    }

    await saveProduct(localProduct)

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'CREATE',
      entity: 'products',
      data: localProduct as unknown as Record<string, unknown>
    })

    return localProduct
  },

  async update(
    id: number,
    product: Omit<Product, 'id'>
  ): Promise<Product> {
    if (navigator.onLine && id > 0) {
      try {
        const response = await api.put<Product>(
          `/products/${id}`,
          product
        )

        await saveProduct(response.data)

        return response.data
      } catch (error) {
        if (!isConnectionError(error)) {
          throw error
        }
      }
    }

    const localProduct: Product = {
      ...product,
      id
    }

    await saveProduct(localProduct)

    const operations = await getAllOperations()

    const pendingCreate = operations.find(operation =>
      operation.entity === 'products' &&
      operation.type === 'CREATE' &&
      operation.data.id === id
    )

    if (pendingCreate?.id !== undefined) {
      await updateOperation(pendingCreate.id, {
        data: localProduct as unknown as Record<string, unknown>
      })
    } else {
      await addOperation({
        operationId: crypto.randomUUID(),
        type: 'UPDATE',
        entity: 'products',
        data: localProduct as unknown as Record<string, unknown>
      })
    }

    return localProduct
  },

  async delete(id: number): Promise<void> {
    if (navigator.onLine && id > 0) {
      try {
        await api.delete(`/products/${id}`)

        await deleteLocalData('products', id)

        return
      } catch (error) {
        if (!isConnectionError(error)) {
          throw error
        }
      }
    }

    await deleteLocalData('products', id)

    const operations = await getAllOperations()

    const pendingCreate = operations.find(operation =>
      operation.entity === 'products' &&
      operation.type === 'CREATE' &&
      operation.data.id === id
    )

    if (pendingCreate?.id !== undefined) {
      await deleteOperation(pendingCreate.id)
      return
    }

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'DELETE',
      entity: 'products',
      data: { id }
    })
  }
}