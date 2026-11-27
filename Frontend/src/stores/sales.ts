// Tienda (Pinia) de VENTAS y medios de pago.
// Cobrar con conexión envía la venta al servidor; sin conexión la guarda en
// el dispositivo con un id temporal y la deja en la cola de sincronización.
import axios from 'axios'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, errorMessage, isConnectionError } from '../services/api'
import { readStore, writeRecord, writeRecords } from '../offline/db'
import { addOperation } from '../offline/queue'
import type { LocalSale, PaymentMethod, PosOrder } from '../types/models'

// Se usan si no hay conexión para pedirlos al servidor
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 1, name: 'Efectivo' },
  { id: 2, name: 'Tarjeta' },
  { id: 3, name: 'Transferencia' },
  { id: 4, name: 'Nequi' },
  { id: 5, name: 'Daviplata' },
]

export type SaleState = 'none' | 'pending' | 'done'

export interface RegisteredSale {
  saleNumber: string
  offline: boolean
}

export const useSalesStore = defineStore('sales', () => {
  const sales = ref<LocalSale[]>([])
  const paymentMethods = ref<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS)
  const loading = ref(false)
  const error = ref('')

  const byOrderId = computed(() => {
    const map = new Map<number, LocalSale>()
    for (const sale of sales.value) map.set(Number(sale.order_id), sale)
    return map
  })

  function saleState(orderId: number): SaleState {
    const sale = byOrderId.value.get(orderId)
    if (!sale) return 'none'
    return sale.pendingSync ? 'pending' : 'done'
  }

  async function loadSales(): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      const localSales = await readStore<LocalSale>('sales')

      if (!navigator.onLine) {
        sales.value = localSales
        return
      }

      const { data } = await api.get<LocalSale[]>('/sales')
      const serverOrderIds = new Set(data.map((sale) => Number(sale.order_id)))

      // Ventas del servidor + ventas sin conexión que aún no se sincronizan
      sales.value = [
        ...data,
        ...localSales.filter((sale) => sale.pendingSync && !serverOrderIds.has(Number(sale.order_id))),
      ]

      await writeRecords('sales', data.map((sale) => ({ ...sale, id: Number(sale.id) })))
    } catch (err) {
      // 403: el mesero no puede ver ventas; no es un error para mostrar
      sales.value = await readStore<LocalSale>('sales')
      const forbidden = axios.isAxiosError(err) && err.response?.status === 403
      if (isConnectionError(err) || forbidden) return
      error.value = errorMessage(err, 'No se pudieron cargar las ventas')
    } finally {
      loading.value = false
    }
  }

  async function loadPaymentMethods(): Promise<void> {
    if (!navigator.onLine) return

    try {
      const { data } = await api.get<PaymentMethod[]>('/payment-methods')
      if (data.length) paymentMethods.value = data
    } catch {
      // Se mantienen los medios de pago por defecto
    }
  }

  async function registerSale(order: PosOrder, paymentMethodId: number): Promise<RegisteredSale> {
    if (saleState(order.id) !== 'none') {
      throw new Error('Este pedido ya tiene una venta registrada.')
    }

    if (navigator.onLine && order.id > 0) {
      try {
        const { data } = await api.post<{ venta: LocalSale }>('/sales', {
          orderId: order.id,
          paymentMethodId,
          reference: null,
        })

        sales.value.push({ ...data.venta, order_id: order.id })
        return { saleNumber: data.venta.sale_number, offline: false }
      } catch (err) {
        if (!isConnectionError(err)) throw err
      }
    }

    const localSaleId = -Date.now()
    const method = paymentMethods.value.find((item) => item.id === paymentMethodId)

    const localSale: LocalSale = {
      id: localSaleId,
      order_id: order.id,
      sale_number: `PEND-${Math.abs(localSaleId)}`,
      created_at: new Date().toISOString(),
      total: order.total,
      status: 'pending_sync',
      pendingSync: true,
      items: order.items.map((item) => ({ ...item })),
      payments: [
        {
          id: localSaleId,
          amount: order.total,
          status: 'pending_sync',
          method: method?.name ?? 'No especificado',
          reference: null,
        },
      ],
    }

    await writeRecord('sales', localSale)

    // Si el pedido también se creó sin conexión (id negativo), esta venta
    // espera a que el pedido se sincronice primero.
    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'CREATE',
      entity: 'sales',
      data: { orderId: order.id, paymentMethodId, reference: null, localSaleId },
    })

    sales.value.push(localSale)
    return { saleNumber: localSale.sale_number, offline: true }
  }

  return {
    sales,
    paymentMethods,
    loading,
    error,
    saleState,
    loadSales,
    loadPaymentMethods,
    registerSale,
  }
})
