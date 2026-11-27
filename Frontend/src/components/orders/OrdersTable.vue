<script setup lang="ts">
// Tabla de pedidos con sus botones (entregar, cancelar, cobrar).
// No sabe cómo se entrega o se cobra: solo AVISA (emit) a la pantalla
// que la usa. Así la misma tabla sirve en "Punto de venta" y "Pedidos".
import type { PosOrder } from '../../types/models'
import type { SaleState } from '../../stores/sales'
import { formatCurrency, formatDate, statusLabel } from '../../utils/format'

defineProps<{
  orders: PosOrder[]
  loading: boolean
  saleState: (orderId: number) => SaleState
  canCharge: boolean
}>()

const emit = defineEmits<{
  complete: [id: number]
  cancel: [id: number]
  charge: [order: PosOrder]
}>()

function units(order: PosOrder): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0)
}

function pillClass(status: string) {
  return {
    pending: status === 'pending' || status === 'cancelled',
    preparing: status === 'preparing',
    ready: status === 'ready' || status === 'completed',
  }
}
</script>

<template>
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
          <tr v-if="loading && !orders.length">
            <td colspan="7">Cargando pedidos...</td>
          </tr>

          <tr v-for="order in orders" :key="order.id" data-test="order-row">
            <td>
              <strong>{{ order.order_number }}</strong>
              <small v-if="order.id < 0" class="pending-sync">Sin sincronizar</small>
            </td>
            <td>{{ order.table_number ? `Mesa ${order.table_number}` : 'Sin mesa' }}</td>
            <td>{{ units(order) }} unidades</td>
            <td>{{ formatDate(order.created_at) }}</td>
            <td>{{ formatCurrency(order.total) }}</td>
            <td>
              <span class="status-pill" :class="pillClass(order.status)">
                {{ statusLabel(order.status) }}
              </span>
            </td>
            <td>
              <div v-if="!['completed', 'cancelled'].includes(order.status)" class="product-actions">
                <button class="table-action" @click="emit('complete', order.id)">Entregar</button>
                <button class="table-action delete-action" @click="emit('cancel', order.id)">Cancelar</button>
              </div>

              <template v-else-if="order.status === 'completed'">
                <span v-if="saleState(order.id) !== 'none'" class="status-pill ready">
                  {{ saleState(order.id) === 'pending' ? 'Pendiente de sincronización' : 'Vendido' }}
                </span>
                <button v-else-if="canCharge" class="table-action" @click="emit('charge', order)">
                  Registrar venta
                </button>
                <span v-else>—</span>
              </template>

              <span v-else>—</span>
            </td>
          </tr>

          <tr v-if="!loading && orders.length === 0">
            <td colspan="7" class="empty-state">Todavía no hay pedidos registrados.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.pending-sync {
  display: block;
  margin-top: 2px;
  color: #b7791f;
  font-size: 11px;
}
</style>
