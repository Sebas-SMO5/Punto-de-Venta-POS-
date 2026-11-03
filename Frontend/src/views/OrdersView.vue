
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../services/api'

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
}

const orders = ref<Order[]>([])
const sales = ref<Sale[]>([])
const isLoading = ref(false)
const isRegistering = ref(false)
const selectedOrder = ref<Order | null>(null)
const selectedPaymentMethod = ref(1)

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
    cancelled: 'Cancelado'
  }

  return labels[status] || status
}

function hasSale(orderId: number) {
  return sales.value.some(sale => Number(sale.order_id) === orderId)
}

async function loadOrders() {
  isLoading.value = true

  try {
    const response = await api.get<Order[]>('/orders')

    orders.value = response.data.map(order => ({
      ...order,
      total: Number(order.total),
      items: (order.items || []).map(item => ({
        ...item,
        quantity: Number(item.quantity),
        price: Number(item.price),
        subtotal: Number(item.subtotal)
      }))
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
    const response = await api.get<Sale[]>('/sales')
    sales.value = response.data
  } catch (error) {
    console.error('Error al cargar ventas:', error)
    alert('No se pudieron consultar las ventas.')
  }
}

async function updateStatus(id: number, status: 'completed' | 'cancelled') {
  const message = status === 'completed'
    ? '¿Marcar este pedido como entregado?'
    : '¿Cancelar este pedido?'

  if (!window.confirm(message)) return

  try {
    if (status === 'cancelled') {
      await api.delete(`/orders/${id}`)
    } else {
      await api.patch(`/orders/${id}/status`, {
        status
      })
    }

    await loadOrders()
    alert('Pedido actualizado correctamente.')
  } catch (error: any) {
    console.error('Error al actualizar pedido:', error)
    alert(error.response?.data?.mensaje || 'No se pudo actualizar el pedido.')
  }
}

function openSaleModal(order: Order) {
  selectedOrder.value = order
  selectedPaymentMethod.value = 1
}

function closeSaleModal() {
  if (isRegistering.value) return

  selectedOrder.value = null
}

async function registerSale() {
  if (!selectedOrder.value) return

  isRegistering.value = true

  try {
    const response = await api.post('/sales', {
      orderId: selectedOrder.value.id,
      paymentMethodId: selectedPaymentMethod.value,
      reference: null
    })

    const saleNumber = response.data.venta.sale_number

    alert(
      `¡Venta registrada correctamente!\n\nVenta: ${saleNumber}\nPedido: ${selectedOrder.value.order_number}\nTotal: ${formatCurrency(selectedOrder.value.total)}`
    )

    selectedOrder.value = null

    await Promise.all([
      loadOrders(),
      loadSales()
    ])
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

onMounted(async () => {
  await Promise.all([
    loadOrders(),
    loadSales()
  ])
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

            <tr
              v-for="order in sortedOrders"
              :key="order.id"
            >
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
                    Vendido
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
      Los pedidos y las ventas se consultan directamente desde PostgreSQL.
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
