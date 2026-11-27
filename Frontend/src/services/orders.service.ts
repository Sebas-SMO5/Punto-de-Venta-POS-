// Servicio de pedidos con soporte OFFLINE.
// Cada pedido creado sin conexión lleva un "localId" (UUID). Si se envía
// dos veces al servidor, el servidor lo reconoce y no lo duplica.
import { api, isConnectionError } from './api'
import type { OrderItem } from '../stores/orders'
import type { OrderStatus, ServerOrder } from '../types/models'
import { readStore, writeRecord } from '../offline/db'
import { addOperation } from '../offline/queue'

type LocalOrder = ServerOrder & { id: number }

const getLocalOrders = () => readStore<LocalOrder>('orders')

const STATUS_FROM_LABEL: Record<string, OrderStatus> = {
  Pendiente: 'pending',
  'En preparación': 'preparing',
  Listo: 'ready',
  Entregado: 'completed',
  Cancelado: 'cancelled',
  pending: 'pending',
  preparing: 'preparing',
  ready: 'ready',
  completed: 'completed',
  cancelled: 'cancelled',
}

async function saveOrder(order: ServerOrder): Promise<LocalOrder> {
  const local: LocalOrder = { ...order, id: Number(order.id) }
  await writeRecord('orders', local)
  return local
}

async function findLocal(id: number): Promise<LocalOrder> {
  const order = (await getLocalOrders()).find((item) => Number(item.id) === Number(id))

  if (!order) {
    throw new Error('No se encontró el pedido en el almacenamiento local')
  }

  return order
}

export const ordersService = {
  async getAllRaw(): Promise<ServerOrder[]> {
    if (!navigator.onLine) return getLocalOrders()

    try {
      const response = await api.get<ServerOrder[]>('/orders')

      for (const order of response.data) {
        await saveOrder(order)
      }

      return response.data
    } catch (error) {
      if (isConnectionError(error)) return getLocalOrders()
      throw error
    }
  },

  // Alias que usan las pantallas
  async getAll(): Promise<ServerOrder[]> {
    return this.getAllRaw()
  },

  async getById(id: number): Promise<ServerOrder> {
    if (id < 0 || !navigator.onLine) return findLocal(id)

    const response = await api.get<ServerOrder>(`/orders/${id}`)
    return response.data
  },

  async create(tableId: number, items: OrderItem[], notes = ''): Promise<ServerOrder> {
    if (!tableId || items.length === 0) {
      throw new Error('Selecciona una mesa y agrega productos al pedido')
    }

    const operationId = crypto.randomUUID()

    const data = {
      tableId,
      localId: operationId,
      notes,
      items: items.map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
      })),
    }

    if (navigator.onLine) {
      try {
        const response = await api.post<ServerOrder>('/orders', data)
        return await saveOrder(response.data)
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    const now = new Date().toISOString()
    const localOrder: LocalOrder = {
      id: -Date.now(),
      local_id: operationId,
      order_number: `PED-${String(Date.now()).slice(-6)}`,
      table_id: Number(tableId),
      table_number: Number(tableId),
      items: items.map((item) => ({ ...item })),
      total: items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0),
      status: 'pending',
      notes,
      created_at: now,
    }

    await writeRecord('orders', localOrder)

    await addOperation({
      operationId,
      type: 'CREATE',
      entity: 'orders',
      data: { ...data, localOrderId: localOrder.id },
    })

    return localOrder
  },

  async updateStatus(id: number, status: string): Promise<ServerOrder> {
    const serverStatus = STATUS_FROM_LABEL[status] ?? 'pending'

    if (id > 0 && navigator.onLine) {
      try {
        const response = await api.patch<ServerOrder>(`/orders/${id}/status`, { status: serverStatus })
        return await saveOrder(response.data)
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    const updated: LocalOrder = { ...(await findLocal(id)), status: serverStatus }
    await writeRecord('orders', updated)

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'UPDATE',
      entity: 'orders',
      data: { id: Number(id), status: serverStatus },
    })

    return updated
  },

  async cancel(id: number): Promise<ServerOrder> {
    if (id > 0 && navigator.onLine) {
      try {
        const response = await api.delete<{ order: ServerOrder }>(`/orders/${id}`)
        return await saveOrder(response.data.order)
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    const updated: LocalOrder = { ...(await findLocal(id)), status: 'cancelled' }
    await writeRecord('orders', updated)

    // Si el pedido tiene id temporal (negativo), esta operación espera a que
    // el pedido se cree en el servidor y luego usa el id real.
    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'DELETE',
      entity: 'orders',
      data: { id },
    })

    return updated
  },
}
