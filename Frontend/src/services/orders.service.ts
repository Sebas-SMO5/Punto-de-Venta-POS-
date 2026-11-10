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
    if (id < 0 || !navigator.onLine) {
      const localOrders = await getLocalData('orders') as unknown as Order[]
      const order = localOrders.find(item => item.id === id)

      if (!order) {
        throw new Error('No se encontró el pedido')
      }

      return order
    }

    const response = await api.get<Order>(`/orders/${id}`)
    return response.data
  },

  async create(
    tableId: number,
    items: OrderItem[],
    notes = ''
  ): Promise<Order> {
    if (!tableId || items.length === 0) {
      throw new Error('Selecciona una mesa y agrega productos al pedido')
    }

    const operationId = crypto.randomUUID()

    const data = {
      tableId,
      localId: operationId,
      notes,
      items: items.map(item => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity)
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
        if (navigator.onLine) {
          throw error
        }
      }
    }

    const localOrder: Order = {
      id: -Date.now(),
      tableNumber: tableId,
      items,
      total: items.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
      ),
      status: 'Pendiente',
      createdAt: new Date().toISOString()
    }

    await saveLocalData(
      'orders',
      localOrder as unknown as Record<string, unknown> & { id: number }
    )

    await addOperation({
      operationId,
      type: 'CREATE',
      entity: 'orders',
      data: {
        ...data,
        localOrderId: localOrder.id
      }
    })

    return localOrder
  },

  async updateStatus(
    id: number,
    status: Order['status']
  ): Promise<Order> {
    const serverStatus = ({
      'Pendiente': 'pending',
      'En preparación': 'preparing',
      'Listo': 'ready',
      'Entregado': 'completed',
      'Cancelado': 'cancelled'
    } as Record<string, string>)[status]

    if (id > 0 && navigator.onLine) {
      try {
        const response = await api.patch<Order>(
          `/orders/${id}/status`,
          { status: serverStatus }
        )

        await saveLocalData(
          'orders',
          response.data as unknown as Record<string, unknown> & { id: number }
        )

        return response.data
      } catch (error) {
        if (navigator.onLine) {
          throw error
        }
      }
    }

    const localOrders = await getLocalData('orders') as unknown as Order[]
    const current = localOrders.find(order => order.id === id)

    if (!current) {
      throw new Error('No se encontró el pedido en el almacenamiento local')
    }

    const updated = { ...current, status }

    await saveLocalData(
      'orders',
      updated as unknown as Record<string, unknown> & { id: number }
    )

    if (id > 0) {
      await addOperation({
        operationId: crypto.randomUUID(),
        type: 'UPDATE',
        entity: 'orders',
        data: { id, status: serverStatus }
      })
    }

    return updated
  },

  async cancel(id: number): Promise<Order> {
    if (id > 0 && navigator.onLine) {
      try {
        const response = await api.delete<{ order: Order }>(`/orders/${id}`)

        await saveLocalData(
          'orders',
          response.data.order as unknown as Record<string, unknown> & { id: number }
        )

        return response.data.order
      } catch (error) {
        if (navigator.onLine) {
          throw error
        }
      }
    }

    const localOrders = await getLocalData('orders') as unknown as Order[]
    const current = localOrders.find(order => order.id === id)

    if (!current) {
      throw new Error('No se encontró el pedido en el almacenamiento local')
    }

    const updated = {
      ...current,
      status: 'Cancelado' as const
    }

    await saveLocalData(
      'orders',
      updated as unknown as Record<string, unknown> & { id: number }
    )

    if (id > 0) {
      await addOperation({
        operationId: crypto.randomUUID(),
        type: 'DELETE',
        entity: 'orders',
        data: { id }
      })
    }

    return updated
  }
}