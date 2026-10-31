
import { api } from './api'
import type { Order, OrderItem } from '../stores/orders'
import { getLocalData, saveLocalData } from '../offline/db'
import { addOperation } from '../offline/queue'

export const ordersService = {
  async getAll(): Promise<Order[]> {
    try {
      if (!navigator.onLine) {
        return await getLocalData('orders') as unknown as Order[]
      }

      const response = await api.get<Order[]>('/orders')

      for (const order of response.data) {
        await saveLocalData(
          'orders',
          order as unknown as Record<string, unknown> & { id: number }
        )
      }

      return response.data
    } catch (error) {
      if (!navigator.onLine) {
        return await getLocalData('orders') as unknown as Order[]
      }

      throw error
    }
  },

  async getById(id: number): Promise<Order> {
    const response = await api.get<Order>(`/orders/${id}`)
    return response.data
  },

  async create(tableId: number, items: OrderItem[]): Promise<Order> {
    const data = {
      tableId,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    }

    if (navigator.onLine) {
      try {
        const response = await api.post<Order>('/orders', data)

        await saveLocalData(
          'orders',
          response.data as unknown as Record<string, unknown> & { id: number }
        )

        return response.data
      } catch (error) {
        if (navigator.onLine) throw error
      }
    }

    const localOrder: Order = {
      id: -Date.now(),
      tableNumber: tableId,
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: 'Pendiente',
      createdAt: new Date().toISOString()
    }

    await saveLocalData(
      'orders',
      localOrder as unknown as Record<string, unknown> & { id: number }
    )

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'CREATE',
      entity: 'orders',
      data: {
        ...data,
        localId: localOrder.id
      }
    })

    return localOrder
  },

  async updateStatus(id: number, status: Order['status']): Promise<Order> {
    const response = await api.patch<Order>(`/orders/${id}/status`, {
      status
    })

    return response.data
  },

  async cancel(id: number): Promise<Order> {
    const response = await api.delete<{ order: Order }>(`/orders/${id}`)
    return response.data.order
  }
}
