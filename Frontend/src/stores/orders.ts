import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface OrderItem {
  productId: number
  name: string
  price: number
  quantity: number
}

export interface Order {
  id: number
  tableNumber: number
  items: OrderItem[]
  total: number
  status: 'Pendiente' | 'En preparación' | 'Entregado' | 'Cancelado'
  createdAt: string
}

const STORAGE_KEY = 'restaurante-pos-orders'

function loadOrders(): Order[] {
  try {
    const savedOrders = localStorage.getItem(STORAGE_KEY)

    if (savedOrders !== null) {
      const parsedOrders: unknown = JSON.parse(savedOrders)

      if (Array.isArray(parsedOrders)) {
        return parsedOrders as Order[]
      }
    }
  } catch (error) {
    console.error('Error al cargar los pedidos:', error)
  }

  return []
}

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>(loadOrders())

  watch(
    orders,
    (newOrders) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrders))
      } catch (error) {
        console.error('Error al guardar los pedidos:', error)
      }
    },
    { deep: true },
  )

  function createOrder(
    tableNumber: number,
    items: OrderItem[],
  ): Order {
    const id =
      orders.value.length > 0
        ? Math.max(...orders.value.map((order) => order.id)) + 1
        : 1

    const newOrder: Order = {
      id,
      tableNumber,
      items: items.map((item) => ({ ...item })),
      total: items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      ),
      status: 'Pendiente',
      createdAt: new Date().toISOString(),
    }

    orders.value.push(newOrder)

    return newOrder
  }

  function getOrdersByTable(tableNumber: number): Order[] {
    return orders.value.filter(
      (order) =>
        order.tableNumber === tableNumber &&
        order.status !== 'Cancelado' &&
        order.status !== 'Entregado',
    )
  }

  function cancelOrder(orderId: number) {
    const order = orders.value.find((item) => item.id === orderId)

    if (order) {
      order.status = 'Cancelado'
    }
  }

  function completeOrder(orderId: number) {
    const order = orders.value.find((item) => item.id === orderId)

    if (order) {
      order.status = 'Entregado'
    }
  }

  return {
    orders,
    createOrder,
    getOrdersByTable,
    cancelOrder,
    completeOrder,
  }
})