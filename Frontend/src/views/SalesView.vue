<script setup lang="ts">
// Pantalla "Punto de venta": registrar pedidos, entregarlos y cobrarlos.
// Solo arma las piezas; la lógica está en:
//   - composables/useOrderActions.ts (entregar, cancelar, cobrar)
//   - components/orders/* (tabla, ventana de pedido y ventana de cobro)
import { ref } from 'vue'
import OrdersSummary from '../components/orders/OrdersSummary.vue'
import OrdersTable from '../components/orders/OrdersTable.vue'
import NewOrderModal from '../components/orders/NewOrderModal.vue'
import SaleModal from '../components/orders/SaleModal.vue'
import { useOrderActions } from '../composables/useOrderActions'
import { useAuthStore } from '../stores/auth'
import { formatCurrency } from '../utils/format'
import type { PosOrder } from '../types/models'

const auth = useAuthStore()
const actions = useOrderActions()
const { ordersStore, salesStore, isOffline, orderToCharge, charging } = actions

const showNewOrder = ref(false)

function onOrderCreated(order: PosOrder): void {
  showNewOrder.value = false

  alert(
    `Pedido registrado correctamente.\n\nPedido: ${order.order_number}\n` +
      `Mesa: ${order.table_number ?? order.table_id}\nTotal: ${formatCurrency(order.total)}` +
      (isOffline.value ? '\n\nSe sincronizará cuando vuelva internet.' : ''),
  )
}
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Punto de venta</h2>
        <p>Registra pedidos, consulta su estado y procesa los pagos.</p>
      </div>

      <button class="primary-button" @click="showNewOrder = true">+ Nuevo pedido</button>
    </div>

    <div v-if="isOffline" class="demo-notice">
      Estás trabajando sin conexión. Los pedidos y las ventas nuevas se guardarán localmente.
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

    <NewOrderModal v-if="showNewOrder" @close="showNewOrder = false" @created="onOrderCreated" />

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
