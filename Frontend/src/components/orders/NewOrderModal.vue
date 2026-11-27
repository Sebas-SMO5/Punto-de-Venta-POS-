<script setup lang="ts">
// Ventana para registrar un pedido nuevo: elegir mesa, agregar productos
// al carrito y escribir observaciones. Funciona con y sin conexión.
import { computed, onMounted, ref } from 'vue'
import { productsService } from '../../services/products.service'
import { tablesService, type RestaurantTable } from '../../services/tables.service'
import { errorMessage } from '../../services/api'
import { useOrdersStore } from '../../stores/orders'
import { useCart } from '../../composables/useCart'
import { formatCurrency } from '../../utils/format'
import type { PosOrder, Product } from '../../types/models'

const emit = defineEmits<{
  close: []
  created: [order: PosOrder]
}>()

const ordersStore = useOrdersStore()
const cart = useCart()

const products = ref<Product[]>([])
const tables = ref<RestaurantTable[]>([])
const tableId = ref<number | null>(null)
const notes = ref('')
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')

const canSave = computed(() => !saving.value && tableId.value !== null && cart.items.value.length > 0)

onMounted(async () => {
  try {
    const [productList, tableList] = await Promise.all([productsService.getAll(), tablesService.getAll()])
    products.value = productList.filter((product) => product.available !== false)
    tables.value = tableList.filter((table) => table.active !== false)
    tableId.value = tables.value[0]?.id ?? null

    if (!tables.value.length) loadError.value = 'No hay mesas activas disponibles.'
    else if (!products.value.length) loadError.value = 'No hay productos disponibles.'
  } catch (error) {
    loadError.value = errorMessage(error, 'No se pudieron cargar los productos o las mesas.')
  } finally {
    loading.value = false
  }
})

function onProductSelected(event: Event): void {
  const select = event.target as HTMLSelectElement
  const product = products.value.find((item) => item.id === Number(select.value))
  if (product) cart.add(product)
  select.value = ''
}

async function save(): Promise<void> {
  if (!canSave.value || tableId.value === null) return

  saving.value = true

  try {
    const order = await ordersStore.create(tableId.value, cart.items.value, notes.value)
    emit('created', order)
  } catch (error) {
    alert(errorMessage(error, 'No se pudo registrar el pedido.'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="!saving && emit('close')">
    <section class="panel modal-card" role="dialog" aria-labelledby="new-order-title">
      <h3 id="new-order-title">Registrar nuevo pedido</h3>

      <p v-if="loading" class="empty-state">Cargando productos y mesas…</p>
      <p v-else-if="loadError" class="empty-state">{{ loadError }}</p>

      <template v-else>
        <label class="field-label" for="order-table">Mesa</label>
        <select id="order-table" v-model="tableId" class="search-input" :disabled="saving">
          <option v-for="table in tables" :key="table.id" :value="table.id">
            Mesa {{ table.table_number }}
          </option>
        </select>

        <label class="field-label" for="order-product">Agregar producto</label>
        <select id="order-product" class="search-input" :disabled="saving" @change="onProductSelected">
          <option value="">Selecciona un producto</option>
          <option v-for="product in products" :key="product.id" :value="product.id">
            {{ product.name }} - {{ formatCurrency(product.price) }}
          </option>
        </select>

        <div v-if="cart.items.value.length" class="cart-list">
          <div v-for="item in cart.items.value" :key="item.productId" class="cart-row">
            <div>
              <strong>{{ item.name }}</strong>
              <small>{{ formatCurrency(item.price) }} c/u</small>
            </div>

            <div class="cart-controls">
              <button type="button" class="table-action" :disabled="saving" @click="cart.change(item.productId, -1)">
                −
              </button>
              <strong>{{ item.quantity }}</strong>
              <button type="button" class="table-action" :disabled="saving" @click="cart.change(item.productId, 1)">
                +
              </button>
            </div>

            <strong>{{ formatCurrency(item.price * item.quantity) }}</strong>
          </div>
        </div>
        <p v-else class="empty-state">Todavía no has agregado productos.</p>

        <label class="field-label" for="order-notes">Observaciones (opcional)</label>
        <textarea id="order-notes" v-model="notes" class="search-input" rows="2" :disabled="saving"></textarea>

        <div class="order-total">Total: {{ formatCurrency(cart.total.value) }}</div>
      </template>

      <div class="product-actions modal-actions">
        <button class="table-action" :disabled="saving" @click="emit('close')">Cancelar</button>
        <button class="primary-button" :disabled="!canSave" @click="save">
          {{ saving ? 'Registrando...' : 'Registrar pedido' }}
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
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
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

.cart-list {
  margin-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.cart-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}

.cart-row small {
  display: block;
  margin-top: 4px;
}

.cart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-total {
  margin-top: 18px;
  text-align: right;
  font-size: 18px;
  font-weight: 700;
}

textarea {
  width: 100%;
  resize: vertical;
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
