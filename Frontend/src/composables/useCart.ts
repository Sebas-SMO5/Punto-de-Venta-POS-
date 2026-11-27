// "Composable" del carrito de un pedido nuevo.
// Un composable es una función que agrupa estado y lógica reutilizable de
// Vue. Separarlo de la pantalla permite probarlo solo (ver __tests__).
import { computed, ref } from 'vue'
import type { CartItem, Product } from '../types/models'

export function useCart() {
  const items = ref<CartItem[]>([])

  const total = computed(() => items.value.reduce((sum, item) => sum + item.price * item.quantity, 0))
  const count = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

  // Si el producto ya está, suma 1; si no, lo agrega
  function add(product: Pick<Product, 'id' | 'name' | 'price'>): void {
    const existing = items.value.find((item) => item.productId === Number(product.id))

    if (existing) {
      existing.quantity += 1
      return
    }

    items.value.push({
      productId: Number(product.id),
      name: product.name,
      price: Number(product.price),
      quantity: 1,
    })
  }

  // Suma o resta unidades; si llega a 0 se quita del carrito
  function change(productId: number, amount: number): void {
    const item = items.value.find((line) => line.productId === productId)
    if (!item) return

    item.quantity += amount

    if (item.quantity <= 0) {
      items.value = items.value.filter((line) => line.productId !== productId)
    }
  }

  function clear(): void {
    items.value = []
  }

  return { items, total, count, add, change, clear }
}
