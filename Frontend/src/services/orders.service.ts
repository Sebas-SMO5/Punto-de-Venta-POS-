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
          { ...order, id: Number(order.id) } as unknown as Record<string, unknown> & { id: number }
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
      const order = localOrders.find(item => Number(item.id) === Number(id))

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
          { ...response.data, id: Number(response.data.id) } as unknown as Record<string, unknown> & { id: number }
        )

        return response.data
      } catch (error) {
        if (navigator.onLine) {
          throw error
        }
      }
    }

    const localOrder = {
      id: -Date.now(),
      local_id: operationId,
      order_number: `PED-${String(Math.abs(Date.now())).slice(-6)}`,
      table_id: Number(tableId),
      table_number: Number(tableId),
      tableNumber: Number(tableId),
      items: JSON.parse(JSON.stringify(items)),
      total: items.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
      ),
      status: 'pending',
      notes,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString()
    } as unknown as Order

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
      'Cancelado': 'cancelled',
      'pending': 'pending',
      'preparing': 'preparing',
      'ready': 'ready',
      'completed': 'completed',
      'cancelled': 'cancelled'
    } as Record<string, string>)[status] || status

    if (id > 0 && navigator.onLine) {
      try {
        const response = await api.patch<Order>(
          `/orders/${id}/status`,
          { status: serverStatus }
        )

        await saveLocalData(
          'orders',
          { ...response.data, id: Number(response.data.id) } as unknown as Record<string, unknown> & { id: number }
        )

        return response.data
      } catch (error) {
        if (navigator.onLine) {
          throw error
        }
      }
    }

    const localOrders = await getLocalData('orders') as unknown as Order[]

    const current = localOrders.find(
      order => Number(order.id) === Number(id)
    )

    if (!current) {
      throw new Error('No se encontró el pedido en el almacenamiento local')
    }

    const updated = {
      ...current,
      id: Number(current.id),
      status: serverStatus
    } as Order

    await saveLocalData(
      'orders',
      updated as unknown as Record<string, unknown> & { id: number }
    )

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'UPDATE',
      entity: 'orders',
      data: { id: Number(id), status: serverStatus }
    })

    return updated
  },

  async cancel(id: number): Promise<Order> {
    if (id > 0 && navigator.onLine) {
      try {
        const response = await api.delete<{ order: Omit<Order, 'status'> & { status: string } }>(
          `/orders/${id}`
        )

        const cancelledOrder = {
          ...response.data.order,
          status: 'Cancelado' as const
        }

        await saveLocalData(
          'orders',
          cancelledOrder as unknown as Record<string, unknown> & { id: number }
        )

        return cancelledOrder
      } catch (error) {
        if (navigator.onLine) {
          throw error
        }
      }
    }

    const localOrders = await getLocalData('orders') as unknown as Order[]
    const current = localOrders.find(order => Number(order.id) === Number(id))

    if (!current) {
      throw new Error('No se encontró el pedido en el almacenamiento local')
    }

    const updated: Order = {
      ...current,
      status: 'Cancelado'
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