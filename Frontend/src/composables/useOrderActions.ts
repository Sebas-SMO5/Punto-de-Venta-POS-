// Acciones sobre pedidos que comparten "Punto de venta" y "Pedidos":
// entregar, cancelar y cobrar. Antes este código estaba copiado en las dos
// pantallas; ahora vive en un solo lugar.
import { onMounted, onUnmounted, ref } from 'vue'
import { useOrdersStore } from '../stores/orders'
import { useSalesStore } from '../stores/sales'
import { errorMessage } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { PosOrder } from '../types/models'

export function useOrderActions() {
  const ordersStore = useOrdersStore()
  const salesStore = useSalesStore()

  const isOffline = ref(!navigator.onLine)
  const orderToCharge = ref<PosOrder | null>(null)
  const charging = ref(false)

  async function refresh(): Promise<void> {
    await Promise.all([ordersStore.load(true), salesStore.loadSales(), salesStore.loadPaymentMethods()])
  }

  function savedMessage(onlineText: string): string {
    return navigator.onLine
      ? onlineText
      : `${onlineText}\n\nSe guardó en este dispositivo y se sincronizará cuando vuelva internet.`
  }

  async function complete(id: number): Promise<void> {
    if (!window.confirm('¿Marcar este pedido como entregado?')) return

    try {
      await ordersStore.complete(id)
      alert(savedMessage('Pedido entregado correctamente.'))
    } catch (error) {
      alert(errorMessage(error, 'No se pudo actualizar el pedido.'))
    }
  }

  async function cancel(id: number): Promise<void> {
    if (!window.confirm('¿Cancelar este pedido?')) return

    try {
      await ordersStore.cancel(id)
      alert(savedMessage('Pedido cancelado correctamente.'))
    } catch (error) {
      alert(errorMessage(error, 'No se pudo cancelar el pedido.'))
    }
  }

  function openCharge(order: PosOrder): void {
    if (salesStore.saleState(order.id) !== 'none') {
      alert('Este pedido ya tiene una venta registrada.')
      return
    }

    orderToCharge.value = order
  }

  function closeCharge(): void {
    if (!charging.value) orderToCharge.value = null
  }

  async function confirmCharge(paymentMethodId: number): Promise<void> {
    const order = orderToCharge.value
    if (!order) return

    charging.value = true

    try {
      const sale = await salesStore.registerSale(order, paymentMethodId)
      orderToCharge.value = null

      alert(
        `${sale.offline ? 'Venta guardada sin conexión' : '¡Venta registrada correctamente!'}\n\n` +
          `Venta: ${sale.saleNumber}\nPedido: ${order.order_number}\nTotal: ${formatCurrency(order.total)}` +
          (sale.offline ? '\n\nSe sincronizará cuando vuelva internet.' : ''),
      )
    } catch (error) {
      alert(errorMessage(error, 'No se pudo registrar la venta.'))
    } finally {
      charging.value = false
    }
  }

  function handleConnectionChange(): void {
    isOffline.value = !navigator.onLine
    if (navigator.onLine) void refresh()
  }

  onMounted(() => {
    void refresh()
    window.addEventListener('online', handleConnectionChange)
    window.addEventListener('offline', handleConnectionChange)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleConnectionChange)
    window.removeEventListener('offline', handleConnectionChange)
  })

  return {
    ordersStore,
    salesStore,
    isOffline,
    orderToCharge,
    charging,
    refresh,
    complete,
    cancel,
    openCharge,
    closeCharge,
    confirmCharge,
  }
}
