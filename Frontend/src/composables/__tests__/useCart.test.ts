// Pruebas del carrito de pedidos (composable useCart).
import { describe, expect, it } from 'vitest'
import { useCart } from '../useCart'

const arepa = { id: 1, name: 'Arepa', price: 5000 }
const jugo = { id: 2, name: 'Jugo', price: 4000 }

describe('useCart', () => {
  it('agrega productos y calcula el total', () => {
    const cart = useCart()
    cart.add(arepa)
    cart.add(jugo)

    expect(cart.items.value).toHaveLength(2)
    expect(cart.total.value).toBe(9000)
  })

  it('si el producto ya está, suma una unidad en vez de repetirlo', () => {
    const cart = useCart()
    cart.add(arepa)
    cart.add(arepa)

    expect(cart.items.value).toHaveLength(1)
    expect(cart.items.value[0]?.quantity).toBe(2)
    expect(cart.count.value).toBe(2)
  })

  it('quita el producto cuando la cantidad llega a cero', () => {
    const cart = useCart()
    cart.add(arepa)
    cart.change(1, -1)

    expect(cart.items.value).toHaveLength(0)
    expect(cart.total.value).toBe(0)
  })

  it('vaciar el carrito deja el total en cero', () => {
    const cart = useCart()
    cart.add(arepa)
    cart.add(jugo)
    cart.clear()

    expect(cart.total.value).toBe(0)
  })
})
