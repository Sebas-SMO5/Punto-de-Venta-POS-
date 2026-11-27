<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useProductsStore } from '../stores/products'
import { useOrdersStore } from '../stores/orders'
import { tablesService } from '../services/tables.service'
import StatCard from '../components/StatCard.vue'
import { formatCurrency, statusLabel } from '../utils/format'

const productsStore = useProductsStore()
const ordersStore = useOrdersStore()

const tableData = ref<{ number: number; occupied: boolean }[]>([])
const loadError = ref('')

onMounted(async () => {
  await Promise.all([productsStore.load(), ordersStore.load(true)])

  try {
    const restaurantTables = await tablesService.getAll()

    tableData.value = restaurantTables.map((table) => ({
      number: Number(table.table_number),
      occupied: (table.orders ?? []).some(
        (order) => !['completed', 'cancelled'].includes(order.status),
      ),
    }))
  } catch (error) {
    console.error('Error al cargar las mesas:', error)
    loadError.value = 'No se pudieron cargar las mesas'
  }
})

const allOrders = computed(() => ordersStore.orders)

const activeOrders = computed(() => ordersStore.activeOrders)

const occupiedTables = computed(() =>
  tableData.value.length
    ? tableData.value.filter(table => table.occupied).length
    : new Set(activeOrders.value.map(order => order.table_number)).size
)

const availableProducts = computed(() => productsStore.availableProducts.length)

const todaySales = computed(() => {
  const today = new Date().toDateString()

  return allOrders.value
    .filter(order =>
      order.status === 'completed' &&
      new Date(order.created_at).toDateString() === today
    )
    .reduce((total, order) => total + Number(order.total || 0), 0)
})

const recentOrders = computed(() => ordersStore.sortedOrders.slice(0, 5))

const tables = computed(() =>
  tableData.value.length
    ? tableData.value.map(table => ({
        number: table.number,
        status: table.occupied ? 'Ocupada' : 'Disponible'
      }))
    : Array.from({ length: 8 }, (_, index) => {
        const number = index + 1
        const occupied = activeOrders.value.some(
          order => Number(order.table_number) === number
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
    value: `${occupiedTables.value} / ${tableData.value.length || 8}`,
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
                  <strong>{{ order.order_number }}</strong>
                </td>

                <td>Mesa {{ order.table_number ?? order.table_id }}</td>

                <td>{{ formatCurrency(Number(order.total || 0)) }}</td>

                <td>
                  <span
                    class="status-pill"
                    :class="{
                      pending: ['pending', 'preparing'].includes(order.status),
                      preparing: order.status === 'ready',
                      ready: order.status === 'completed'
                    }"
                  >
                    {{ statusLabel(order.status) }}
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