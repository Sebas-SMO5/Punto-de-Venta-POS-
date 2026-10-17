import { api } from './api'
import type { Order, OrderItem } from '../stores/orders'

export const ordersService = {
  async getAll(): Promise<Order[]> {
    const response = await api.get<Order[]>('/orders')
    return response.data
  },

  async getById(id: number): Promise<Order> {
    const response = await api.get<Order>(`/orders/${id}`)
    return response.data
  },

  async create(tableNumber: number, items: OrderItem[]): Promise<Order> {
    const response = await api.post<Order>('/orders', {
      tableNumber,
      items,
    })
    return response.data
  },

  async updateStatus(id: number, status: Order['status']): Promise<Order> {
    const response = await api.patch<Order>(`/orders/${id}/status`, {
      status,
    })
    return response.data
  },

  async cancel(id: number): Promise<Order> {
    const response = await api.patch<Order>(`/orders/${id}/cancel`)
    return response.data
  },
}