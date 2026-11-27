<script setup lang="ts">
// Tres tarjetas con el resumen de pedidos (total, activos y entregados).
defineProps<{
  total: number
  active: number
  completed: number
}>()
</script>

<template>
  <div class="stats-grid products-summary">
    <article class="stat-card">
      <p class="stat-label">Total de pedidos</p>
      <h3>{{ total }}</h3>
    </article>
    <article class="stat-card">
      <p class="stat-label">Pendientes o en preparación</p>
      <h3>{{ active }}</h3>
    </article>
    <article class="stat-card">
      <p class="stat-label">Entregados</p>
      <h3>{{ completed }}</h3>
    </article>
  </div>
</template>
