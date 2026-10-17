<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  icon: string
  note: string
}>()
</script>

<template>
  <article class="stat-card">
    <div class="stat-icon">{{ icon }}</div>
    <p class="stat-label">{{ label }}</p>
    <h3>{{ value }}</h3>
    <p class="stat-note">{{ note }}</p>
  </article>
</template>