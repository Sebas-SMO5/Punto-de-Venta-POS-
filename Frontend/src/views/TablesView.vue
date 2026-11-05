<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../services/api'
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
  () => tables.value.filter(table =>
    table.orders.some(order =>
      !['completed', 'cancelled'].includes(order.status)
    )
  ).length
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

function normalizeTables(data: RestaurantTable[]): RestaurantTable[] {
  return data.map(table => ({
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
}

async function loadTables() {
  isLoading.value = true

  try {
    if (navigator.onLine) {
      try {
        const response = await api.get<RestaurantTable[]>('/tables')

        tables.value = normalizeTables(response.data)

        for (const table of tables.value) {
          await saveLocalData(
            'tables',
            table as unknown as Record<string, unknown> & { id: number }
          )
        }

        return
      } catch (error) {
        console.error('No se pudieron consultar las mesas en el servidor:', error)
      }
    }

    const localTables = await getLocalData('tables')

    tables.value = normalizeTables(
      localTables as unknown as RestaurantTable[]
    )
  } catch (error) {
    console.error('Error al cargar las mesas:', error)
    tables.value = []
    alert('No se pudieron cargar las mesas guardadas en el dispositivo.')
  } finally {
    isLoading.value = false
  }
}

function tableTotal(table: RestaurantTable) {
  return table.orders
    .filter(order => !['cancelled'].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total), 0)
}

async function updateLocalOrder(orderId: number, status: string) {
  for (const table of tables.value) {
    const order = table.orders.find(item => item.id === orderId)

    if (order) {
      order.status = status

      await saveLocalData(
        'tables',
        table as unknown as Record<string, unknown> & { id: number }
      )

      return
    }
  }
}

async function completeOrder(orderId: number) {
  const confirmed = window.confirm(
    '¿Deseas marcar este pedido como entregado?'
  )

  if (!confirmed) return

  try {
    if (navigator.onLine && orderId > 0) {
      try {
        await api.patch(`/orders/${orderId}/status`, {
          status: 'completed'
        })

        await loadTables()
        alert('Pedido entregado correctamente.')
        return
      } catch (error) {
        console.error('No se pudo actualizar el pedido en el servidor:', error)

        if (navigator.onLine) {
          alert('No se pudo actualizar el pedido. Intenta nuevamente.')
          return
        }
      }
    }

    if (orderId > 0) {
      await addOperation({
        operationId: crypto.randomUUID(),
        type: 'UPDATE',
        entity: 'orders',
        data: {
          id: orderId,
          status: 'completed'
        }
      })
    }

    await updateLocalOrder(orderId, 'completed')
    alert('Pedido actualizado localmente. Se sincronizará cuando vuelva la conexión.')
  } catch (error) {
    console.error('Error al entregar el pedido:', error)
    alert('No se pudo actualizar el pedido.')
  }
}

async function cancelOrder(orderId: number) {
  const confirmed = window.confirm(
    '¿Deseas cancelar este pedido?'
  )

  if (!confirmed) return

  try {
    if (navigator.onLine && orderId > 0) {
      try {
        await api.delete(`/orders/${orderId}`)
        await loadTables()
        alert('Pedido cancelado correctamente.')
        return
      } catch (error) {
        console.error('No se pudo cancelar el pedido en el servidor:', error)

        if (navigator.onLine) {
          alert('No se pudo cancelar el pedido. Intenta nuevamente.')
          return
        }
      }
    }

    if (orderId > 0) {
      await addOperation({
        operationId: crypto.randomUUID(),
        type: 'DELETE',
        entity: 'orders',
        data: {
          id: orderId
        }
      })
    }

    await updateLocalOrder(orderId, 'cancelled')
    alert('Pedido cancelado localmente. Se sincronizará cuando vuelva la conexión.')
  } catch (error) {
    console.error('Error al cancelar el pedido:', error)
    alert('No se pudo cancelar el pedido.')
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
          :class="{
            occupied: table.orders.some(order =>
              !['completed', 'cancelled'].includes(order.status)
            )
          }"
        >
          <span class="table-symbol">▦</span>

          <strong>Mesa {{ table.table_number }}</strong>

          <small>
            {{
              table.orders.some(order =>
                !['completed', 'cancelled'].includes(order.status)
              )
                ? 'Ocupada'
                : 'Disponible'
            }}
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
          No hay mesas guardadas en el dispositivo.
          Conéctate para cargar las mesas por primera vez.
        </p>
      </div>
    </section>

    <p class="demo-notice">
      Las mesas se guardan localmente y se consultan desde el servidor cuando hay conexión.
    </p>
  </div>
</template>