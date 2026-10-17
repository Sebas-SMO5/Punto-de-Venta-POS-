<script setup lang="ts">
import type { Order } from '../stores/orders'

defineProps<{
  order: Order
}>()

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function getItemsDescription(quantity: number): string {
  return `${quantity} ${quantity === 1 ? 'producto' : 'productos'}`
}

function getStatusClass(status: Order['status']): string {
  switch (status) {
    case 'Pendiente':
      return 'pending'
    case 'En preparación':
      return 'preparing'
    case 'Entregado':
      return 'ready'
    case 'Cancelado':
      return 'pending'
    default:
      return ''
  }
}
</script>

<template>
  <article class="panel order-card">
    <div class="panel-heading">
      <div>
        <h3>#PED-{{ String(order.id).padStart(3, '0') }}</h3>
        <p>Mesa {{ order.tableNumber }}</p>
      </div>

      <span
        class="status-pill"
        :class="getStatusClass(order.status)"
      >
        {{ order.status }}
      </span>
    </div>

    <div class="order-card-items">
      <div
        v-for="(item, index) in order.items"
        :key="`${item.productId}-${index}`"
        class="order-card-item"
      >
        <span>{{ item.name }} × {{ item.quantity }}</span>
        <span>{{ formatCurrency(item.price * item.quantity) }}</span>
      </div>
    </div>

    <div class="order-card-total">
      <span>Total</span>
      <strong>{{ formatCurrency(order.total) }}</strong>
    </div>

    <p class="order-card-date">
      {{ new Date(order.createdAt).toLocaleString('es-CO') }}
    </p>
  </article>
</template>