<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../services/api'
import { useProductsStore } from '../stores/products'
import { useOrdersStore } from '../stores/orders'
import StatCard from '../components/StatCard.vue'

const productsStore = useProductsStore()
const ordersStore = useOrdersStore()

const tableData = ref<{ number: number; occupied: boolean }[]>([])
const dashboardOrders = ref<any[]>([])

onMounted(async () => {
  try {
    await productsStore.loadProducts()
  } catch (error) {
    console.error('Error al cargar productos:', error)
  }

  try {
    const [ordersResponse, tablesResponse] = await Promise.all([
      api.get<any[]>('/orders'),
      api.get<any[]>('/tables')
    ])

    dashboardOrders.value = (ordersResponse.data || []).map(order => ({
      id: order.id,
      tableNumber: Number(order.table_number || order.tableNumber || order.table_id || 0),
      total: Number(order.total || 0),
      status: ({
        pending: 'Pendiente',
        preparing: 'En preparación',
        ready: 'Listo',
        completed: 'Entregado',
        cancelled: 'Cancelado'
      } as Record<string, string>)[order.status] || order.status,
      createdAt: order.created_at || order.createdAt,
      items: Array.isArray(order.items) ? order.items : []
    }))

    tableData.value = (tablesResponse.data || []).map(table => ({
      number: Number(table.table_number || table.number),
      occupied: Array.isArray(table.orders)
        ? table.orders.some((order: any) =>
            !['completed', 'cancelled', 'Entregado', 'Cancelado'].includes(order.status)
          )
        : Boolean(table.occupied)
    }))
  } catch (error) {
    console.error('Error al cargar el dashboard:', error)
  }
})

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(value)
}

const allOrders = computed(() =>
  dashboardOrders.value.length > 0
    ? dashboardOrders.value
    : ordersStore.orders
)

const activeOrders = computed(() =>
  allOrders.value.filter(order =>
    !['Entregado', 'Cancelado', 'completed', 'cancelled'].includes(order.status)
  )
)

const occupiedTables = computed(() =>
  tableData.value.length
    ? tableData.value.filter(table => table.occupied).length
    : new Set(activeOrders.value.map(order => order.tableNumber)).size
)

const availableProducts = computed(() =>
  productsStore.products.filter(product => product.available).length
)

const todaySales = computed(() => {
  const today = new Date().toDateString()

  return allOrders.value
    .filter(order =>
      ['Entregado', 'completed'].includes(order.status) &&
      order.createdAt &&
      new Date(order.createdAt).toDateString() === today
    )
    .reduce((total, order) => total + Number(order.total || 0), 0)
})

const recentOrders = computed(() =>
  [...allOrders.value]
    .sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5)
)

const tables = computed(() =>
  tableData.value.length
    ? tableData.value.map(table => ({
        number: table.number,
        status: table.occupied ? 'Ocupada' : 'Disponible'
      }))
    : Array.from({ length: 8 }, (_, index) => {
        const number = index + 1
        const occupied = activeOrders.value.some(
          order => Number(order.tableNumber) === number
        )

        return {
          number,
          status: occupied ? 'Ocupada' : 'Disponible'
        }
      })
)

const stats = computed(() => [
  {
    label: 'Ventas del día',
    value: formatCurrency(todaySales.value),
    icon: '$',
    note: 'Total de pedidos entregados hoy'
  },
  {
    label: 'Pedidos activos',
    value: String(activeOrders.value.length),
    icon: '≡',
    note: 'Pedidos pendientes de finalizar'
  },
  {
    label: 'Mesas ocupadas',
    value: `${occupiedTables.value} / 8`,
    icon: '▦',
    note: 'Mesas con pedidos activos'
  },
  {
    label: 'Platos disponibles',
    value: String(availableProducts.value),
    icon: '◇',
    note: 'Productos disponibles en el menú'
  }
])
</script>

<template>
  <div class="dashboard">
    <div class="welcome-row">
      <div>
        <h2>¡Bienvenido al restaurante!</h2>
        <p>Este es el resumen general de tu negocio.</p>
      </div>

      <RouterLink to="/sales" class="primary-button">
        + Nueva venta
      </RouterLink>
    </div>

    <div class="stats-grid">
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :icon="stat.icon"
        :note="stat.note"
      />
    </div>

    <div class="dashboard-grid">
      <section class="panel orders-panel">
        <div class="panel-heading">
          <div>
            <h3>Pedidos recientes</h3>
            <p>Últimos pedidos registrados</p>
          </div>

          <RouterLink to="/sales" class="text-link">
            Crear pedido
          </RouterLink>
        </div>

        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Mesa</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="order in recentOrders" :key="order.id">
                <td>
                  <strong>#PED-{{ String(order.id).padStart(6, '0') }}</strong>
                </td>

                <td>Mesa {{ order.tableNumber }}</td>

                <td>{{ formatCurrency(Number(order.total || 0)) }}</td>

                <td>
                  <span
                    class="status-pill"
                    :class="{
                      pending: ['Pendiente', 'En preparación'].includes(order.status),
                      preparing: order.status === 'Listo',
                      ready: order.status === 'Entregado'
                    }"
                  >
                    {{ order.status }}
                  </span>
                </td>
              </tr>

              <tr v-if="recentOrders.length === 0">
                <td colspan="4" class="empty-state">
                  Todavía no hay pedidos registrados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h3>Estado de las mesas</h3>
            <p>Ocupación actual del restaurante</p>
          </div>

          <RouterLink to="/tables" class="text-link">
            Ver todas
          </RouterLink>
        </div>

        <div class="tables-grid">
          <div
            v-for="table in tables"
            :key="table.number"
            class="table-card"
            :class="{ occupied: table.status === 'Ocupada' }"
          >
            <span class="table-symbol">▦</span>
            <strong>Mesa {{ table.number }}</strong>
            <small>{{ table.status }}</small>
          </div>
        </div>
      </section>
    </div>

    <p class="demo-notice">
      Información consultada desde el backend y el almacenamiento local disponible.
    </p>
  </div>
</template>