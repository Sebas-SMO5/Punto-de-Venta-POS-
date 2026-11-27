<script setup lang="ts">
// Pantalla "Pedidos": consultar pedidos, entregarlos, cancelarlos y
// cobrarlos. Usa las mismas piezas que "Punto de venta".
import OrdersSummary from '../components/orders/OrdersSummary.vue'
import OrdersTable from '../components/orders/OrdersTable.vue'
import SaleModal from '../components/orders/SaleModal.vue'
import { useOrderActions } from '../composables/useOrderActions'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const actions = useOrderActions()
const { ordersStore, salesStore, isOffline, orderToCharge, charging } = actions
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
      Estás trabajando sin conexión. Los cambios se guardarán localmente.
    </div>

    <OrdersSummary
      :total="ordersStore.orders.length"
      :active="ordersStore.pendingCount"
      :completed="ordersStore.completedCount"
    />

    <OrdersTable
      :orders="ordersStore.sortedOrders"
      :loading="ordersStore.loading"
      :sale-state="salesStore.saleState"
      :can-charge="auth.hasRole('admin', 'cashier')"
      @complete="actions.complete"
      @cancel="actions.cancel"
      @charge="actions.openCharge"
    />

    <SaleModal
      v-if="orderToCharge"
      :order="orderToCharge"
      :methods="salesStore.paymentMethods"
      :busy="charging"
      @close="actions.closeCharge"
      @confirm="actions.confirmCharge"
    />
  </div>
</template>
