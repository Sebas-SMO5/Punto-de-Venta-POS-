// Tienda (Pinia) de pedidos, normalizada por id, con estados explícitos de
// carga, error y caché. Los datos vienen de ordersService, que ya sabe
// leer de la API o, sin conexión, de IndexedDB.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ordersService } from '../services/orders.service'
import { errorMessage } from '../services/api'
import type { ServerOrder } from '../types/models'

export interface OrderItem {
  productId: number
  name: string
  price: number
  quantity: number
}

export type OrderStatusLabel = 'Pendiente' | 'En preparación' | 'Listo' | 'Entregado' | 'Cancelado'

// Pedido en el formato que usan las pantallas
export interface Order {
  id: number
  tableNumber: number
  items: OrderItem[]
  total: number
  status: OrderStatusLabel
  createdAt: string
}

export const STATUS_LABELS: Record<string, OrderStatusLabel> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  ready: 'Listo',
  completed: 'Entregado',
  cancelled: 'Cancelado',
}

const CACHE_TTL_MS = 30 * 1000

export function toOrder(raw: ServerOrder): Order {
  return {
    id: Number(raw.id),
    tableNumber: Number(raw.table_number ?? raw.table_id ?? 0),
    total: Number(raw.total ?? 0),
    status: STATUS_LABELS[raw.status] ?? 'Pendiente',
    createdAt: raw.created_at ?? new Date().toISOString(),
    items: (raw.items ?? []).map((item) => ({
      productId: Number(item.productId),
      name: item.name,
      price: Number(item.price),
      quantity: Number(item.quantity),
    })),
  }
}

export const useOrdersStore = defineStore('orders', () => {
  const byId = ref<Record<number, Order>>({})
  const ids = ref<number[]>([])
  const loading = ref(false)
  const error = ref('')
  const lastLoadedAt = ref<number | null>(null)

  const orders = computed(() =>
    ids.value.map((id) => byId.value[id]).filter((o): o is Order => o !== undefined),
  )

  const activeOrders = computed(() =>
    orders.value.filter((order) => !['Entregado', 'Cancelado'].includes(order.status)),
  )

  async function load(force = false): Promise<void> {
    const fresh = lastLoadedAt.value !== null && Date.now() - lastLoadedAt.value < CACHE_TTL_MS

    if (!force && fresh) return

    loading.value = true
    error.value = ''

    try {
      const list = (await ordersService.getAllRaw()).map(toOrder)
      const map: Record<number, Order> = {}
      for (const order of list) map[order.id] = order
      byId.value = map
      ids.value = list.map((order) => order.id)
      lastLoadedAt.value = Date.now()
    } catch (err) {
      error.value = errorMessage(err, 'No se pudieron cargar los pedidos')
    } finally {
      loading.value = false
    }
  }

  function getOrdersByTable(tableNumber: number): Order[] {
    return activeOrders.value.filter((order) => order.tableNumber === tableNumber)
  }

  return {
    byId,
    ids,
    orders,
    activeOrders,
    loading,
    error,
    lastLoadedAt,
    load,
    getOrdersByTable,
  }
})
