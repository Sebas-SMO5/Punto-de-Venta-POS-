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
  orderNumber: number
  status: string
  total: number
  notes: string
  createdAt: string
  items: OrderItem[]
}

interface RestaurantTable {
  id: number
  table_number: number
  capacity: number
  status: string
  active: boolean
  orders: Order[]
}

const tables = ref<RestaurantTable[]>([])
const isLoading = ref(false)

const occupiedCount = computed(
  () => tables.value.filter(table => table.orders.length > 0).length
)

const availableCount = computed(
  () => tables.value.length - occupiedCount.value
)

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value))
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

async function loadTables() {
  isLoading.value = true

  try {
    const response = await api.get<RestaurantTable[]>('/tables')

    tables.value = response.data.map(table => ({
      ...table,
      orders: (table.orders || []).map(order => ({
        ...order,
        total: Number(order.total),
        items: (order.items || []).map(item => ({
          ...item,
          quantity: Number(item.quantity),
          price: Number(item.price),
          subtotal: Number(item.subtotal)
        }))
      }))
    }))
  } catch (error) {
    console.error('Error al cargar mesas:', error)
    alert('No se pudieron cargar las mesas.')
  } finally {
    isLoading.value = false
  }
}

function tableTotal(table: RestaurantTable) {
  return table.orders.reduce(
    (sum, order) => sum + Number(order.total),
    0
  )
}

async function completeOrder(orderId: number) {
  const confirmed = window.confirm(
    '¿Deseas marcar este pedido como entregado?'
  )

  if (!confirmed) return

  try {
    await api.patch(`/orders/${orderId}/status`, {
      status: 'completed'
    })

    await loadTables()
    alert('Pedido entregado correctamente.')
  } catch (error: any) {
    console.error('Error al entregar pedido:', error)
    alert(error.response?.data?.mensaje || 'No se pudo entregar el pedido.')
  }
}

async function cancelOrder(orderId: number) {
  const confirmed = window.confirm(
    '¿Deseas cancelar este pedido?'
  )

  if (!confirmed) return

  try {
    await api.delete(`/orders/${orderId}`)
    await loadTables()
    alert('Pedido cancelado correctamente.')
  } catch (error: any) {
    console.error('Error al cancelar pedido:', error)
    alert(error.response?.data?.mensaje || 'No se pudo cancelar el pedido.')
  }
}

onMounted(loadTables)
</script>

<template>
  <div class="tables-page">
    <div class="page-title-row">
      <div>
        <h2>Mesas del restaurante</h2>
        <p>Consulta las mesas, sus pedidos y los productos solicitados.</p>
      </div>
    </div>

    <div class="stats-grid tables-summary">
      <article class="stat-card">
        <p class="stat-label">Total de mesas</p>
        <h3>{{ tables.length }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Mesas ocupadas</p>
        <h3>{{ occupiedCount }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Mesas disponibles</p>
        <h3>{{ availableCount }}</h3>
      </article>
    </div>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h3>Distribución de mesas</h3>
          <p>Consulta los pedidos activos de cada mesa.</p>
        </div>
      </div>

      <div v-if="isLoading" class="empty-state">
        Cargando mesas...
      </div>

      <div v-else class="tables-grid large-tables-grid">
        <article
          v-for="table in tables"
          :key="table.id"
          class="table-card"
          :class="{ occupied: table.orders.length > 0 }"
        >
          <span class="table-symbol">▦</span>

          <strong>Mesa {{ table.table_number }}</strong>

          <small>
            {{ table.orders.length > 0 ? 'Ocupada' : 'Disponible' }}
          </small>

          <template v-if="table.orders.length > 0">
            <div class="table-orders">
              <article
                v-for="order in table.orders"
                :key="order.id"
                class="table-order"
              >
                <div class="order-heading">
                  <strong>
                    Pedido #{{ order.orderNumber || order.id }}
                  </strong>

                  <span class="status-pill pending">
                    {{ statusLabel(order.status) }}
                  </span>
                </div>

                <div class="order-products">
                  <p
                    v-for="item in order.items"
                    :key="item.id"
                  >
                    {{ item.name }} × {{ item.quantity }}
                  </p>
                </div>

                <div class="order-total">
                  <span>Total del pedido</span>
                  <strong>{{ formatCurrency(order.total) }}</strong>
                </div>

                <div
                  v-if="!['completed', 'cancelled'].includes(order.status)"
                  class="order-actions"
                >
                  <button
                    class="table-action"
                    @click="completeOrder(order.id)"
                  >
                    Marcar entregado
                  </button>

                  <button
                    class="table-action delete-action"
                    @click="cancelOrder(order.id)"
                  >
                    Cancelar
                  </button>
                </div>
              </article>
            </div>

            <div class="table-total">
              <span>Total de la mesa</span>
              <strong>{{ formatCurrency(tableTotal(table)) }}</strong>
            </div>
          </template>

          <p v-else class="table-empty">
            No hay pedidos activos.
          </p>
        </article>

        <p v-if="tables.length === 0" class="empty-state">
          No hay mesas registradas.
        </p>
      </div>
    </section>

    <p class="demo-notice">
      Las mesas y sus pedidos se consultan directamente desde PostgreSQL.
    </p>
  </div>
</template>