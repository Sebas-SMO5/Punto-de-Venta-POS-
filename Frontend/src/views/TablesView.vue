<script setup lang="ts">
import { computed } from 'vue'
import { useOrdersStore } from '../stores/orders'

const ordersStore = useOrdersStore()

const tables = computed(() =>
  Array.from({ length: 8 }, (_, index) => {
    const number = index + 1
    const orders = ordersStore.getOrdersByTable(number)
    const occupied = orders.length > 0

    return {
      number,
      occupied,
      orders,
      total: orders.reduce((sum, order) => sum + order.total, 0),
    }
  }),
)

const occupiedCount = computed(
  () => tables.value.filter((table) => table.occupied).length,
)

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function completeOrder(orderId: number) {
  const confirmed = window.confirm(
    '¿Deseas marcar este pedido como entregado?',
  )

  if (confirmed) {
    ordersStore.completeOrder(orderId)
  }
}

function cancelOrder(orderId: number) {
  const confirmed = window.confirm(
    '¿Deseas cancelar este pedido?',
  )

  if (confirmed) {
    ordersStore.cancelOrder(orderId)
  }
}
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
        <h3>{{ tables.length - occupiedCount }}</h3>
      </article>
    </div>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h3>Distribución de mesas</h3>
          <p>Consulta los pedidos activos de cada mesa.</p>
        </div>
      </div>

      <div class="tables-grid large-tables-grid">
        <article
          v-for="table in tables"
          :key="table.number"
          class="table-card"
          :class="{ occupied: table.occupied }"
        >
          <span class="table-symbol">▦</span>

          <strong>Mesa {{ table.number }}</strong>

          <small>
            {{ table.occupied ? 'Ocupada' : 'Disponible' }}
          </small>

          <template v-if="table.occupied">
            <div class="table-orders">
              <article
                v-for="order in table.orders"
                :key="order.id"
                class="table-order"
              >
                <div class="order-heading">
                  <strong>Pedido #{{ order.id }}</strong>
                  <span class="status-pill pending">
                    {{ order.status }}
                  </span>
                </div>

                <div class="order-products">
                  <p
                    v-for="item in order.items"
                    :key="item.productId"
                  >
                    {{ item.name }} × {{ item.quantity }}
                  </p>
                </div>

                <div class="order-total">
                  <span>Total del pedido</span>
                  <strong>{{ formatCurrency(order.total) }}</strong>
                </div>

                <div
                  v-if="
                    order.status !== 'Entregado' &&
                    order.status !== 'Cancelado'
                  "
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
              <strong>{{ formatCurrency(table.total) }}</strong>
            </div>
          </template>

          <p v-else class="table-empty">
            No hay pedidos activos.
          </p>
        </article>
      </div>
    </section>

    <p class="demo-notice">
      Los pedidos se guardan localmente en este navegador.
      La conexión con el backend y la sincronización siguen pendientes.
    </p>
  </div>
</template>