import { api } from './api'
import type { Order, OrderItem } from '../stores/orders'
import { getLocalData, saveLocalData } from '../offline/db'
import { addOperation } from '../offline/queue'

interface ApiOrder {
  id: number
  local_id?: string
  order_number?: string
  table_id?: number | null
  table_number?: number | null
  tableNumber?: number
  user_id?: number
  order_type?: string
  status: string
  notes?: string
  subtotal?: number | string
  tax?: number | string
  total: number | string
  created_at?: string
  createdAt?: string
  items?: Array<{
    id?: number
    productId?: number
    product_id?: number
    name?: string
    quantity: number
    price?: number | string
    unit_price?: number | string
    subtotal?: number | string
  }>
}

function normalizeStatus(status: string): Order['status'] {
  const statuses: Record<string, Order['status']> = {
    pending: 'Pendiente',
    preparing: 'En preparación',
    ready: 'Listo',
    completed: 'Entregado',
    cancelled: 'Cancelado',
    Pendiente: 'Pendiente',
    'En preparación': 'En preparación',
    Listo: 'Listo',
    Entregado: 'Entregado',
    Cancelado: 'Cancelado'
  }

  return statuses[status] || 'Pendiente'
}

function normalizeOrder(order: ApiOrder): Order {
  return {
    ...order,
    id: Number(order.id),
    tableNumber: Number(order.table_number ?? order.tableNumber ?? 0),
    items: (order.items || []).map(item => ({
      productId: Number(item.productId ?? item.product_id ?? 0),
      name: item.name || 'Producto',
      quantity: Number(item.quantity || 0),
      price: Number(item.price ?? item.unit_price ?? 0)
    })),
    total: Number(order.total || 0),
    status: normalizeStatus(order.status),
    createdAt: order.created_at || order.createdAt || ''
  }
}

async function getLocalOrders(): Promise<Order[]> {
  const orders = await getLocalData('orders')
  return orders.map(order => normalizeOrder(order as unknown as ApiOrder))
}

async function saveOrder(order: Order): Promise<void> {
  await saveLocalData(
    'orders',
    order as unknown as Record<string, unknown> & { id: number }
  )
}

export const ordersService = {
  async getAll(): Promise<Order[]> {
    try {
      if (!navigator.onLine) {
        return await getLocalOrders()
      }

      const response = await api.get<ApiOrder[]>('/orders')
      const serverOrders = response.data.map(normalizeOrder)

      for (const order of serverOrders) {
        await saveOrder(order)
      }

      const localOrders = await getLocalOrders()

      const pendingOrders = localOrders.filter(order => order.id < 0)

      const combinedOrders = [...serverOrders]

      for (const localOrder of pendingOrders) {
        if (!combinedOrders.some(order => order.id === localOrder.id)) {
          combinedOrders.push(localOrder)
        }
      }

      return combinedOrders.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } catch (error) {
      if (!navigator.onLine) {
        return await getLocalOrders()
      }

      throw error
    }
  },

  async getById(id: number): Promise<Order> {
    if (id < 0) {
      const localOrders = await getLocalOrders()
      const order = localOrders.find(item => item.id === id)

      if (!order) {
        throw new Error('Pedido no encontrado localmente')
      }

      return order
    }

    try {
      const response = await api.get<ApiOrder>(`/orders/${id}`)
      const order = normalizeOrder(response.data)

      await saveOrder(order)

      return order
    } catch (error) {
      const localOrders = await getLocalOrders()
      const localOrder = localOrders.find(item => item.id === id)

      if (localOrder) return localOrder

      throw error
    }
  },

  async create(tableId: number, items: OrderItem[]): Promise<Order> {
    const operationId = crypto.randomUUID()

    const data = {
      tableId,
      localId: operationId,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    }

    if (navigator.onLine) {
      try {
        const response = await api.post<ApiOrder>('/orders', data)
        const order = normalizeOrder(response.data)

        await saveOrder(order)

        return order
      } catch (error) {
        if (navigator.onLine) throw error
      }
    }

    const localOrder = {
      id: -Date.now(),
      tableNumber: tableId,
      items: items.map(item => ({ ...item })),
      total: items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
      status: 'Pendiente' as const,
      createdAt: new Date().toISOString()
    }

    await saveOrder(localOrder)

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
    const backendStatuses: Record<Order['status'], string> = {
      Pendiente: 'pending',
      'En preparación': 'preparing',
      Listo: 'ready',
      Entregado: 'completed',
      Cancelado: 'cancelled'
    }

    if (id < 0 || !navigator.onLine) {
      throw new Error(
        'La actualización de estado sin conexión todavía no está disponible.'
      )
    }

    const response = await api.patch<ApiOrder>(`/orders/${id}/status`, {
      status: backendStatuses[status]
    })

    const order = normalizeOrder(response.data)

    await saveOrder(order)

    return order
  },

  async cancel(id: number): Promise<Order> {
    if (id < 0 || !navigator.onLine) {
      throw new Error(
        'La cancelación sin conexión todavía no está disponible.'
      )
    }

    const response = await api.delete<{ order: ApiOrder }>(
      `/orders/${id}`
    )

    const order = normalizeOrder(response.data.order)

    await saveOrder(order)

    return order
  }
}
