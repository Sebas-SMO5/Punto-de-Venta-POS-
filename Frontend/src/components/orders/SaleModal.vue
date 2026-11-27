<script setup lang="ts">
// Ventana para cobrar un pedido: muestra el total y deja elegir el medio de
// pago. Al confirmar, avisa a la pantalla con el medio elegido.
import { ref } from 'vue'
import type { PaymentMethod, PosOrder } from '../../types/models'
import { formatCurrency } from '../../utils/format'

const props = defineProps<{
  order: PosOrder
  methods: PaymentMethod[]
  busy: boolean
}>()

const emit = defineEmits<{
  confirm: [paymentMethodId: number]
  close: []
}>()

const selectedMethod = ref<number>(props.methods[0]?.id ?? 1)
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <section class="panel modal-card" role="dialog" aria-labelledby="sale-modal-title">
      <h3 id="sale-modal-title">Registrar venta</h3>

      <p>Pedido: <strong>{{ order.order_number }}</strong></p>
      <p>Total: <strong data-test="sale-total">{{ formatCurrency(order.total) }}</strong></p>

      <label class="field-label" for="payment-method">Medio de pago</label>
      <select id="payment-method" v-model="selectedMethod" class="search-input" :disabled="busy">
        <option v-for="method in methods" :key="method.id" :value="method.id">
          {{ method.name }}
        </option>
      </select>

      <div class="product-actions modal-actions">
        <button class="table-action" :disabled="busy" @click="emit('close')">Cancelar</button>
        <button class="primary-button" :disabled="busy" @click="emit('confirm', selectedMethod)">
          {{ busy ? 'Registrando...' : 'Confirmar pago' }}
        </button>
      </div>
    </section>
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

.modal-actions {
  justify-content: flex-end;
  margin-top: 24px;
  gap: 10px;
}

.modal-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
