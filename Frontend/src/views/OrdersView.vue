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
  order_number: number
  table_id: number
  table_number: number | null
  items: OrderItem[]
  notes: string
  total: number
  status: string
  created_at: string
}

const orders = ref<Order[]>([])
const isLoading = ref(false)

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

onMounted(loadOrders)
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
                <strong>#{{ order.order_number || order.id }}</strong>
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

    <p class="demo-notice">
      Los pedidos se consultan y administran directamente desde PostgreSQL.
    </p>
  </div>
</template>