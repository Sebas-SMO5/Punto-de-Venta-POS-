import { api } from './api'
import type { Product } from '../stores/products'

export const productsService = {
  async getAll(): Promise<Product[]> {
    const response = await api.get<Product[]>('/products')
    return response.data
  },

  async getById(id: number): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`)
    return response.data
  },

  async create(product: Omit<Product, 'id'>): Promise<Product> {
    const response = await api.post<Product>('/products', product)
    return response.data
  },

  async update(id: number, product: Omit<Product, 'id'>): Promise<Product> {
    const response = await api.put<Product>(`/products/${id}`, product)
    return response.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/products/${id}`)
  },
}