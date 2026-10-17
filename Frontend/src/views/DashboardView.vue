<script setup lang="ts">
import { computed } from 'vue'
import { useProductsStore } from '../stores/products'
import { useOrdersStore } from '../stores/orders'

const productsStore = useProductsStore()
const ordersStore = useOrdersStore()

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

const activeOrders = computed(() =>
  ordersStore.orders.filter(
    order =>
      order.status !== 'Entregado' &&
      order.status !== 'Cancelado',
  ),
)

const occupiedTables = computed(() => {
  const tableNumbers = new Set(
    activeOrders.value.map(order => order.tableNumber),
  )

  return tableNumbers.size
})

const availableProducts = computed(() =>
  productsStore.products.filter(product => product.available).length,
)

const todaySales = computed(() => {
  const today = new Date().toDateString()

  return ordersStore.orders
    .filter(
      order =>
        order.status === 'Entregado' &&
        new Date(order.createdAt).toDateString() === today,
    )
    .reduce((total, order) => total + order.total, 0)
})

const recentOrders = computed(() =>
  [...ordersStore.orders]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    )
    .slice(0, 5),
)

function getItemsDescription(quantity: number): string {
  return `${quantity} ${quantity === 1 ? 'producto' : 'productos'}`
}

const tables = computed(() =>
  Array.from({ length: 8 }, (_, index) => {
    const number = index + 1

    const occupied = activeOrders.value.some(
      order => order.tableNumber === number,
    )

    return {
      number,
      status: occupied ? 'Ocupada' : 'Disponible',
    }
  }),
)

const stats = computed(() => [
  {
    label: 'Ventas del día',
    value: formatCurrency(todaySales.value),
    icon: '$',
    note: 'Total de pedidos entregados hoy',
  },
  {
    label: 'Pedidos activos',
    value: String(activeOrders.value.length),
    icon: '≡',
    note: 'Pedidos pendientes de finalizar',
  },
  {
    label: 'Mesas ocupadas',
    value: `${occupiedTables.value} / 8`,
    icon: '▦',
    note: 'Mesas con pedidos activos',
  },
  {
    label: 'Platos disponibles',
    value: String(availableProducts.value),
    icon: '◇',
    note: 'Productos disponibles en el menú',
  },
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
      <article v-for="stat in stats" :key="stat.label" class="stat-card">
        <div class="stat-icon">{{ stat.icon }}</div>
        <p class="stat-label">{{ stat.label }}</p>
        <h3>{{ stat.value }}</h3>
        <p class="stat-note">{{ stat.note }}</p>
      </article>
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
                  <strong>#PED-{{ String(order.id).padStart(3, '0') }}</strong>
                  <small class="table-subtitle">
                    {{ getItemsDescription(
                      order.items.reduce((sum, item) => sum + item.quantity, 0)
                    ) }}
                  </small>
                </td>

                <td>Mesa {{ order.tableNumber }}</td>

                <td>{{ formatCurrency(order.total) }}</td>

                <td>
                  <span
                    class="status-pill"
                    :class="{
                      pending: order.status === 'Pendiente',
                      preparing: order.status === 'En preparación',
                      ready: order.status === 'Entregado',
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
      Información actualizada desde el almacenamiento local del navegador.
      La conexión con el backend se implementará posteriormente.
    </p>
  </div>
</template>