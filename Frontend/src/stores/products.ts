// Tienda (Pinia) de productos, NORMALIZADA:
// en vez de una lista, guarda un "diccionario" por id (byId) y el orden
// (ids). Así buscar o actualizar un producto es inmediato y no hay copias
// repetidas del mismo dato.
// También maneja de forma explícita: cargando (loading), error y caché
// (no vuelve a pedir al servidor si los datos tienen menos de 1 minuto).
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { productsService } from '../services/products.service'
import { errorMessage } from '../services/api'
import type { Product } from '../types/models'

const CACHE_TTL_MS = 60 * 1000

export const useProductsStore = defineStore('products', () => {
  const byId = ref<Record<number, Product>>({})
  const ids = ref<number[]>([])
  const loading = ref(false)
  const error = ref('')
  const lastLoadedAt = ref<number | null>(null)

  const products = computed(() =>
    ids.value.map((id) => byId.value[id]).filter((p): p is Product => p !== undefined),
  )
  const availableProducts = computed(() => products.value.filter((p) => p.available))

  function setAll(list: Product[]): void {
    const map: Record<number, Product> = {}
    for (const product of list) map[product.id] = product
    byId.value = map
    ids.value = list.map((product) => product.id)
  }

  function upsert(product: Product): void {
    if (!byId.value[product.id]) ids.value.push(product.id)
    byId.value[product.id] = product
  }

  function remove(id: number): void {
    delete byId.value[id]
    ids.value = ids.value.filter((item) => item !== id)
  }

  async function load(force = false): Promise<void> {
    const fresh = lastLoadedAt.value !== null && Date.now() - lastLoadedAt.value < CACHE_TTL_MS

    if (!force && fresh) return

    loading.value = true
    error.value = ''

    try {
      setAll(await productsService.getAll())
      lastLoadedAt.value = Date.now()
    } catch (err) {
      error.value = errorMessage(err, 'No se pudieron cargar los productos')
    } finally {
      loading.value = false
    }
  }

  return {
    byId,
    ids,
    products,
    availableProducts,
    loading,
    error,
    lastLoadedAt,
    load,
    upsert,
    remove,
  }
})
