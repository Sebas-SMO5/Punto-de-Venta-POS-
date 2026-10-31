
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { startAutoSync, stopAutoSync } from './offline/sync'

onMounted(() => {
  startAutoSync()
})

onUnmounted(() => {
  stopAutoSync()
})
</script>

<template>
  <RouterView />
</template>

