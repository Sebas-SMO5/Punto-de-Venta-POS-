<script setup lang="ts">
// Ventana para registrar una ENTRADA de mercancía o un AJUSTE por conteo.
//  - Entrada: "llegaron 20 limonadas" -> el stock sube 20.
//  - Ajuste:  "conté y hay 18"        -> el stock queda en 18.
import { computed, ref } from 'vue'
import type { InventoryItem } from '../../services/inventory.service'

const props = defineProps<{
  item: InventoryItem
  type: 'entry' | 'adjustment'
  busy: boolean
}>()

const emit = defineEmits<{
  confirm: [quantity: number, reason: string]
  close: []
}>()

const quantity = ref<number>(props.type === 'adjustment' ? props.item.stock : 1)
const reason = ref('')

const isEntry = computed(() => props.type === 'entry')

const resultingStock = computed(() =>
  isEntry.value ? props.item.stock + Number(quantity.value || 0) : Number(quantity.value || 0),
)

const valid = computed(() => {
  const value = Number(quantity.value)
  if (!Number.isFinite(value) || value < 0) return false
  return isEntry.value ? value > 0 : value !== props.item.stock
})

function submit(): void {
  if (valid.value && !props.busy) emit('confirm', Number(quantity.value), reason.value.trim())
}
</script>

<template>
  <div class="modal-overlay" @click.self="!busy && emit('close')">
    <form class="panel modal-card" role="dialog" aria-labelledby="stock-title" @submit.prevent="submit">
      <h3 id="stock-title">{{ isEntry ? 'Registrar entrada' : 'Ajustar por conteo' }}</h3>

      <p>
        Producto: <strong>{{ item.product }}</strong><br />
        Stock actual: <strong data-test="current-stock">{{ item.stock }}</strong>
      </p>

      <label class="field-label" for="stock-quantity">
        {{ isEntry ? 'Cantidad que llegó' : 'Cantidad contada' }}
      </label>
      <input
        id="stock-quantity"
        v-model.number="quantity"
        class="search-input"
        type="number"
        :min="isEntry ? 1 : 0"
        step="1"
        :disabled="busy"
        required
      />

      <label class="field-label" for="stock-reason">Motivo (opcional)</label>
      <input
        id="stock-reason"
        v-model="reason"
        class="search-input"
        maxlength="200"
        :placeholder="isEntry ? 'Ej: compra al proveedor' : 'Ej: conteo de fin de mes'"
        :disabled="busy"
      />

      <p class="result" data-test="resulting-stock">
        El stock quedará en <strong>{{ resultingStock }}</strong>
      </p>

      <div class="product-actions modal-actions">
        <button type="button" class="table-action" :disabled="busy" @click="emit('close')">Cancelar</button>
        <button type="submit" class="primary-button" :disabled="!valid || busy">
          {{ busy ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
}

.modal-card {
  width: 100%;
  max-width: 420px;
  padding: 24px;
}

.modal-card h3 {
  margin-top: 0;
}

.field-label {
  display: block;
  margin: 14px 0 6px;
  font-weight: 600;
}

.modal-card input {
  width: 100%;
  box-sizing: border-box;
}

.result {
  margin-top: 16px;
  color: #445064;
}

.modal-actions {
  justify-content: flex-end;
  margin-top: 20px;
  gap: 10px;
}

.modal-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
