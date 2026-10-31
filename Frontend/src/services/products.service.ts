
import { api } from './api'
import type { Product } from '../stores/products'
import {
  getLocalData,
  saveManyLocalData,
  saveLocalData,
  deleteLocalData
} from '../offline/db'
import { addOperation } from '../offline/queue'

const saveProduct = async (product: Product) => {
  await saveLocalData(
    'products',
    product as unknown as Record<string, unknown> & { id: number }
  )
}

export const productsService = {
  async getAll(): Promise<Product[]> {
    try {
      if (!navigator.onLine) {
        return await getLocalData('products') as unknown as Product[]
      }

      const response = await api.get<Product[]>('/products')

      await saveManyLocalData(
        'products',
        response.data as unknown as (Record<string, unknown> & { id: number })[]
      )

      return response.data
    } catch (error) {
      if (!navigator.onLine) {
        return await getLocalData('products') as unknown as Product[]
      }

      throw error
    }
  },

  async getById(id: number): Promise<Product> {
    try {
      if (!navigator.onLine) {
        const products = await getLocalData('products') as unknown as Product[]
        const product = products.find(item => item.id === id)

        if (!product) throw new Error('Producto no encontrado localmente')

        return product
      }

      const response = await api.get<Product>(`/products/${id}`)
      await saveProduct(response.data)

      return response.data
    } catch (error) {
      if (!navigator.onLine) {
        const products = await getLocalData('products') as unknown as Product[]
        const product = products.find(item => item.id === id)

        if (product) return product
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
        if (navigator.onLine) throw error
      }
    }

    const localProduct = {
      ...product,
      id: -Date.now()
    } as Product

    await saveProduct(localProduct)

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'CREATE',
      entity: 'products',
      data: localProduct as unknown as Record<string, unknown>
    })

    return localProduct
  },

  async update(id: number, product: Omit<Product, 'id'>): Promise<Product> {
    if (navigator.onLine) {
      try {
        const response = await api.put<Product>(`/products/${id}`, product)
        await saveProduct(response.data)
        return response.data
      } catch (error) {
        if (navigator.onLine) throw error
      }
    }

    const localProduct = { ...product, id } as Product

    await saveProduct(localProduct)

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'UPDATE',
      entity: 'products',
      data: localProduct as unknown as Record<string, unknown>
    })

    return localProduct
  },

  async delete(id: number): Promise<void> {
    if (navigator.onLine) {
      try {
        await api.delete(`/products/${id}`)
        await deleteLocalData('products', id)
        return
      } catch (error) {
        if (navigator.onLine) throw error
      }
    }

    await deleteLocalData('products', id)

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'DELETE',
      entity: 'products',
      data: { id }
    })
  }
}
