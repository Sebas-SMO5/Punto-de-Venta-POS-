// Tienda (Pinia) de PEDIDOS, la única fuente de pedidos para todas las
// pantallas (Dashboard, Punto de venta, Pedidos).
// - Normalizada: los pedidos se guardan por id (byId) más una lista de ids.
// - Estados explícitos: loading (cargando), error y caché (lastLoadedAt).
// - Funciona sin conexión porque usa ordersService (API o IndexedDB).
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ordersService } from '../services/orders.service'
import { errorMessage } from '../services/api'
import type { CartItem, PosOrder, ServerOrder } from '../types/models'

const CACHE_TTL_MS = 30 * 1000
const ACTIVE_STATUSES = ['pending', 'preparing', 'ready']

// Convierte el pedido de la API (o de IndexedDB) al formato de pantalla
export function toPosOrder(raw: ServerOrder): PosOrder {
  return {
    id: Number(raw.id),
    order_number: raw.order_number || `PED-${raw.id}`,
    table_id: Number(raw.table_id ?? raw.tableNumber ?? 0),
    table_number: raw.table_number ?? raw.tableNumber ?? null,
    items: (raw.items ?? []).map((item, index) => {
      const price = Number(item.price ?? item.unit_price ?? 0)
      const quantity = Number(item.quantity || 0)

      return {
        id: Number(item.id ?? index + 1),
        productId: Number(item.productId ?? item.product_id ?? 0),
        name: item.name || item.product_name || 'Producto',
        quantity,
        price,
        subtotal: Number(item.subtotal ?? price * quantity),
      }
    }),
    notes: raw.notes ?? '',
    total: Number(raw.total || 0),
    status: raw.status,
    created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
  }
}

export const useOrdersStore = defineStore('orders', () => {
  const byId = ref<Record<number, PosOrder>>({})
  const ids = ref<number[]>([])
  const loading = ref(false)
  const error = ref('')
  const lastLoadedAt = ref<number | null>(null)

  const orders = computed(() =>
    ids.value.map((id) => byId.value[id]).filter((o): o is PosOrder => o !== undefined),
  )

  // Del más reciente al más antiguo
  const sortedOrders = computed(() =>
    [...orders.value].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
  )

  const activeOrders = computed(() => orders.value.filter((o) => ACTIVE_STATUSES.includes(o.status)))
  const pendingCount = computed(() => activeOrders.value.length)
  const completedCount = computed(() => orders.value.filter((o) => o.status === 'completed').length)

  function upsert(order: PosOrder): void {
    if (!byId.value[order.id]) ids.value.push(order.id)
    byId.value[order.id] = order
  }

  async function load(force = false): Promise<void> {
    const fresh = lastLoadedAt.value !== null && Date.now() - lastLoadedAt.value < CACHE_TTL_MS

    if (!force && fresh) return

    loading.value = true
    error.value = ''

    try {
      const list = (await ordersService.getAllRaw()).map(toPosOrder)
      const map: Record<number, PosOrder> = {}
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

  async function create(tableId: number, cart: CartItem[], notes: string): Promise<PosOrder> {
    const order = toPosOrder(await ordersService.create(tableId, cart, notes))
    upsert(order)
    return order
  }

  async function complete(id: number): Promise<void> {
    upsert(toPosOrder(await ordersService.updateStatus(id, 'completed')))
  }

  async function cancel(id: number): Promise<void> {
    upsert(toPosOrder(await ordersService.cancel(id)))
  }

  return {
    byId,
    ids,
    orders,
    sortedOrders,
    activeOrders,
    pendingCount,
    completedCount,
    loading,
    error,
    lastLoadedAt,
    load,
    create,
    complete,
    cancel,
  }
})
