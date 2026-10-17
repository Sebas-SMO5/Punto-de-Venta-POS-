<script setup lang="ts">
import type { Product } from '../stores/products'

defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  select: [product: Product]
}>()

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}
</script>

<template>
  <article class="product-card">
    <div class="product-card-header">
      <span class="product-category">{{ product.category }}</span>

      <span
        class="status-pill"
        :class="product.available ? 'ready' : 'pending'"
      >
        {{ product.available ? 'Disponible' : 'Agotado' }}
      </span>
    </div>

    <div class="product-card-body">
      <h3>{{ product.name }}</h3>
      <p class="product-card-price">
        {{ formatCurrency(product.price) }}
      </p>
    </div>

    <button
      type="button"
      class="primary-button product-card-button"
      :disabled="!product.available"
      @click="emit('select', product)"
    >
      {{ product.available ? 'Agregar al pedido' : 'No disponible' }}
    </button>
  </article>
</template>