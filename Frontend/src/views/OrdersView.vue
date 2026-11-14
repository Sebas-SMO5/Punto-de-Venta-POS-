<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from '../services/api'
import { ordersService } from '../services/orders.service'
import { getLocalData, saveLocalData } from '../offline/db'
import { addOperation } from '../offline/queue'

interface OrderItem {
  id: number
  productId: number
  name: string
  quantity: number
  price: number
  subtotal: number
}

interface Order {
  id: number
  order_number: string
  table_id: number
  table_number: number | null
  items: OrderItem[]
  notes: string
  total: number
  status: string
  created_at: string
}

interface Sale {
  id: number
  order_id: number
  sale_number: string
  created_at?: string
  total?: number
  status?: string
  items?: OrderItem[]
  payments?: {
    id: number
    amount: number
    status: string
    method: string
    reference: string | null
  }[]
  pendingSync?: boolean
}

const orders = ref<Order[]>([])
const sales = ref<Sale[]>([])
const isLoading = ref(false)
const isRegistering = ref(false)
const selectedOrder = ref<Order | null>(null)
const selectedPaymentMethod = ref(1)
const isOffline = ref(!navigator.onLine)

const paymentMethods = [
  { id: 1, name: 'Efectivo' },
  { id: 2, name: 'Tarjeta' },
  { id: 3, name: 'Transferencia' },
  { id: 4, name: 'Nequi' },
  { id: 5, name: 'Daviplata' }
]

const sortedOrders = computed(() =>
  [...orders.value].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  )
)

const pendingCount = computed(() =>
  orders.value.filter(order =>
    ['pending', 'preparing', 'ready'].includes(order.status)
  ).length
)

const completedCount = computed(() =>
  orders.value.filter(order => order.status === 'completed').length
)

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value))
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CO')
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    preparing: 'En preparación',
    ready: 'Listo',
    completed: 'Entregado',
    cancelled: 'Cancelado',
    pending_sync: 'Pendiente de sincronización'
  }

  return labels[status] || status
}

function hasSale(orderId: number) {
  return sales.value.some(sale =>
    Number(sale.order_id) === orderId
  )
}

async function loadOrders() {
  isLoading.value = true

  try {
    const response = await ordersService.getAll()

    orders.value = response.map((order: any) => ({
      id: Number(order.id),
      order_number: order.order_number || `PED-${order.id}`,
      table_id: Number(order.table_id ?? order.tableNumber ?? 0),
      table_number: order.table_number ?? order.tableNumber ?? null,
      items: (order.items || []).map((item: any) => ({
        id: Number(item.id ?? item.productId ?? item.product_id ?? 0),
        productId: Number(item.productId ?? item.product_id ?? 0),
        name: item.name || item.product_name || 'Producto',
        quantity: Number(item.quantity || 0),
        price: Number(item.price ?? item.unit_price ?? 0),
        subtotal: Number(
          item.subtotal ??
          (Number(item.price ?? item.unit_price ?? 0) *
            Number(item.quantity || 0))
        )
      })),
      notes: order.notes || '',
      total: Number(order.total || 0),
      status: ({
        'Pendiente': 'pending',
        'En preparación': 'preparing',
        'Listo': 'ready',
        'Entregado': 'completed',
        'Cancelado': 'cancelled'
      } as Record<string, string>)[order.status] || order.status,
      created_at: order.created_at || order.createdAt || new Date().toISOString()
    }))
  } catch (error) {
    console.error('Error al cargar pedidos:', error)
    alert('No se pudieron cargar los pedidos.')
  } finally {
    isLoading.value = false
  }
}

async function loadSales() {
  try {
    if (!navigator.onLine) {
      sales.value = await getLocalData('sales') as unknown as Sale[]
      return
    }

    const response = await api.get<Sale[]>('/sales')
    const serverSales = response.data

    const localSales = await getLocalData('sales') as unknown as Sale[]

    const pendingSales = localSales.filter(sale =>
      sale.pendingSync === true
    )

    const combinedSales = [
      ...serverSales,
      ...pendingSales.filter(localSale =>
        !serverSales.some(serverSale =>
          Number(serverSale.order_id) === Number(localSale.order_id)
        )
      )
    ]

    sales.value = combinedSales

    for (const sale of serverSales) {
      await saveLocalData(
        'sales',
        sale as unknown as Record<string, unknown> & { id: number }
      )
    }
  } catch (error) {
    console.error('Error al cargar ventas:', error)
    sales.value = await getLocalData('sales') as unknown as Sale[]
  }
}

async function updateStatus(
  id: number,
  status: 'completed' | 'cancelled'
) {
  const message = status === 'completed'
    ? '¿Marcar este pedido como entregado?'
    : '¿Cancelar este pedido?'

  if (!window.confirm(message)) return

  try {
    if (status === 'cancelled') {
      await ordersService.cancel(id)
    } else {
      await ordersService.updateStatus(id, 'Entregado')
    }

    await loadOrders()

    alert(
      navigator.onLine
        ? 'Pedido actualizado correctamente.'
        : 'Pedido actualizado y guardado localmente. Se sincronizará cuando vuelva internet.'
    )
  } catch (error: any) {
    console.error('Error al actualizar pedido:', error)
    alert(error.response?.data?.mensaje || error.message || 'No se pudo actualizar el pedido.')
  }
}

function openSaleModal(order: Order) {
  if (hasSale(order.id)) {
    alert('Este pedido ya tiene una venta registrada.')
    return
  }

  selectedOrder.value = order
  selectedPaymentMethod.value = 1
}

function closeSaleModal() {
  if (isRegistering.value) return
  selectedOrder.value = null
}

async function registerSale() {
  if (!selectedOrder.value) return

  const order = selectedOrder.value

  if (hasSale(order.id)) {
    alert('Este pedido ya tiene una venta registrada.')
    selectedOrder.value = null
    return
  }

  isRegistering.value = true

  try {
    if (navigator.onLine) {
      const response = await api.post('/sales', {
        orderId: order.id,
        paymentMethodId: selectedPaymentMethod.value,
        reference: null
      })

      const registeredSale = response.data.venta

      alert(
        `¡Venta registrada correctamente!\n\nVenta: ${registeredSale.sale_number}\nPedido: ${order.order_number}\nTotal: ${formatCurrency(order.total)}`
      )

      selectedOrder.value = null

      await Promise.all([
        loadOrders(),
        loadSales()
      ])

      return
    }

    const operationId = crypto.randomUUID()
    const localSaleId = -Date.now()

    const paymentMethod = paymentMethods.find(
      method => method.id === selectedPaymentMethod.value
    )

    const localSale: Sale = {
      id: localSaleId,
      order_id: order.id,
      sale_number: `PEND-${Math.abs(localSaleId)}`,
      created_at: new Date().toISOString(),
      total: order.total,
      status: 'pending_sync',
      pendingSync: true,
      items: order.items,
      payments: [
        {
          id: localSaleId,
          amount: order.total,
          status: 'pending_sync',
          method: paymentMethod?.name || 'No especificado',
          reference: null
        }
      ]
    }

    const saleToSave = JSON.parse(
      JSON.stringify(localSale)
    ) as Record<string, unknown> & { id: number }

    await saveLocalData('sales', saleToSave)

    await addOperation({
      operationId,
      type: 'CREATE',
      entity: 'sales',
      data: {
        orderId: order.id,
        paymentMethodId: selectedPaymentMethod.value,
        reference: null,
        localSaleId,
        localOrderId: order.id
      }
    })

    sales.value.push(localSale)
    selectedOrder.value = null

    alert(
      `Venta guardada correctamente sin conexión.\n\nVenta: ${localSale.sale_number}\nPedido: ${order.order_number}\nTotal: ${formatCurrency(order.total)}\n\nSe sincronizará cuando vuelva internet.`
    )
  } catch (error: any) {
    console.error('Error al registrar venta:', error)
    alert(
      error.response?.data?.mensaje ||
      'No se pudo registrar la venta.'
    )
  } finally {
    isRegistering.value = false
  }
}

function handleConnectionChange() {
  isOffline.value = !navigator.onLine

  if (navigator.onLine) {
    loadOrders()
    loadSales()
  }
}

onMounted(async () => {
  await Promise.all([
    loadOrders(),
    loadSales()
  ])

  window.addEventListener('online', handleConnectionChange)
  window.addEventListener('offline', handleConnectionChange)
})

onUnmounted(() => {
  window.removeEventListener('online', handleConnectionChange)
  window.removeEventListener('offline', handleConnectionChange)
})
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Pedidos</h2>
        <p>Consulta y administra los pedidos registrados.</p>
      </div>
    </div>

    <div v-if="isOffline" class="demo-notice">
      Estás trabajando sin conexión. Las ventas nuevas se guardarán localmente.
    </div>

    <div class="stats-grid products-summary">
      <article class="stat-card">
        <p class="stat-label">Total de pedidos</p>
        <h3>{{ orders.length }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Pendientes o en preparación</p>
        <h3>{{ pendingCount }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Entregados</p>
        <h3>{{ completedCount }}</h3>
      </article>
    </div>

    <section class="panel">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Mesa</th>
              <th>Productos</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoading">
              <td colspan="7">Cargando pedidos...</td>
            </tr>

            <tr v-for="order in sortedOrders" :key="order.id">
              <td>
                <strong>{{ order.order_number || order.id }}</strong>
              </td>

              <td>
                {{ order.table_number ? `Mesa ${order.table_number}` : 'Sin mesa' }}
              </td>

              <td>
                {{ order.items.reduce((sum, item) => sum + item.quantity, 0) }}
                unidades
              </td>

              <td>{{ formatDate(order.created_at) }}</td>

              <td>{{ formatCurrency(order.total) }}</td>

              <td>
                <span
                  class="status-pill"
                  :class="{
                    pending: order.status === 'pending' || order.status === 'cancelled',
                    preparing: order.status === 'preparing',
                    ready: order.status === 'ready' || order.status === 'completed'
                  }"
                >
                  {{ statusLabel(order.status) }}
                </span>
              </td>

              <td>
                <div
                  class="product-actions"
                  v-if="!['completed', 'cancelled'].includes(order.status)"
                >
                  <button
                    class="table-action"
                    @click="updateStatus(order.id, 'completed')"
                  >
                    Entregar
                  </button>

                  <button
                    class="table-action delete-action"
                    @click="updateStatus(order.id, 'cancelled')"
                  >
                    Cancelar
                  </button>
                </div>

                <div v-else-if="order.status === 'completed'">
                  <span v-if="hasSale(order.id)" class="status-pill ready">
                    {{ sales.find(sale => Number(sale.order_id) === order.id)?.pendingSync ? 'Pendiente de sincronización' : 'Vendido' }}
                  </span>

                  <button
                    v-else
                    class="table-action"
                    @click="openSaleModal(order)"
                  >
                    Registrar venta
                  </button>
                </div>

                <span v-else>—</span>
              </td>
            </tr>

            <tr v-if="!isLoading && orders.length === 0">
              <td colspan="7" class="empty-state">
                Todavía no hay pedidos registrados.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="selectedOrder"
      class="sale-modal-overlay"
      @click.self="closeSaleModal"
    >
      <section class="panel sale-modal">
        <h3>Registrar venta</h3>

        <p>
          Pedido:
          <strong>{{ selectedOrder.order_number }}</strong>
        </p>

        <p>
          Total:
          <strong>{{ formatCurrency(selectedOrder.total) }}</strong>
        </p>

        <label class="field-label" for="payment-method">
          Medio de pago
        </label>

        <select
          id="payment-method"
          v-model="selectedPaymentMethod"
          class="search-input"
          :disabled="isRegistering"
        >
          <option
            v-for="method in paymentMethods"
            :key="method.id"
            :value="method.id"
          >
            {{ method.name }}
          </option>
        </select>

        <div class="product-actions sale-modal-actions">
          <button
            class="table-action"
            :disabled="isRegistering"
            @click="closeSaleModal"
          >
            Cancelar
          </button>

          <button
            class="primary-button"
            :disabled="isRegistering"
            @click="registerSale"
          >
            {{ isRegistering ? 'Registrando...' : 'Confirmar pago' }}
          </button>
        </div>
      </section>
    </div>

    <p class="demo-notice">
      Los pedidos y las ventas se almacenan localmente para permitir su consulta
      y registro sin conexión.
    </p>
  </div>
</template>

<style scoped>
.sale-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
}

.sale-modal {
  width: 100%;
  max-width: 420px;
  padding: 24px;
}

.sale-modal h3 {
  margin-top: 0;
}

.sale-modal-actions {
  justify-content: flex-end;
  margin-top: 24px;
  gap: 10px;
}

.sale-modal-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>