import { api } from './api'
import {
  getLocalData,
  saveLocalData,
  saveManyLocalData
} from '../offline/db'

export interface SaleItem {
  id: number
  name: string
  quantity: number
  price: number
  subtotal: number
}

export interface SalePayment {
  id: number
  amount: number
  status: string
  method: string
  reference: string | null
}

export interface Sale {
  id: number
  sale_number: string | number
  created_at: string
  total: number | string
  subtotal?: number | string
  tax?: number | string
  discount?: number | string
  status: string
  items: SaleItem[]
  payments: SalePayment[]
}

function normalizeSale(sale: any): Sale {
  return {
    ...sale,
    id: Number(sale.id),
    sale_number: sale.sale_number ?? sale.saleNumber ?? sale.id,
    created_at: sale.created_at ?? sale.createdAt ?? '',
    total: Number(sale.total || 0),
    subtotal: Number(sale.subtotal || 0),
    tax: Number(sale.tax || 0),
    discount: Number(sale.discount || 0),
    status: sale.status || 'completed',
    items: (sale.items || sale.sale_items || []).map((item: any) => ({
      id: Number(item.id || item.product_id || 0),
      name: item.name || item.product_name || item.product?.name || 'Producto',
      quantity: Number(item.quantity || 0),
      price: Number(item.price || item.unit_price || 0),
      subtotal: Number(item.subtotal || item.total || 0)
    })),
    payments: (sale.payments || []).map((payment: any) => ({
      id: Number(payment.id || 0),
      amount: Number(payment.amount || 0),
      status: payment.status || '',
      method: payment.method || payment.payment_method || payment.method_name || '',
      reference: payment.reference || null
    }))
  }
}

export const salesService = {
  async getAll(): Promise<Sale[]> {
    try {
      if (!navigator.onLine) {
        const localSales = await getLocalData('sales')
        return localSales.map(sale => normalizeSale(sale))
      }

      const response = await api.get('/sales')
      const responseData = response.data

      const salesData = Array.isArray(responseData)
        ? responseData
        : responseData.ventas || responseData.sales || responseData.data || []

      const sales = salesData.map((sale: any) => normalizeSale(sale))

      await saveManyLocalData(
        'sales',
        sales as unknown as (Record<string, unknown> & { id: number })[]
      )

      const localSales = await getLocalData('sales')

      const pendingSales = localSales
        .filter(sale => (sale as any).pendingSync === true)
        .map(sale => normalizeSale(sale))

      const combinedSales = [...sales]

      for (const pendingSale of pendingSales) {
        if (!combinedSales.some(sale => sale.id === pendingSale.id)) {
          combinedSales.push(pendingSale)
        }
      }

      return combinedSales
    } catch (error) {
      console.error('Error al consultar las ventas:', error)

      const localSales = await getLocalData('sales')

      return localSales.map(sale => normalizeSale(sale))
    }
  },

  async getById(id: number): Promise<Sale> {
    try {
      if (!navigator.onLine) {
        const localSales = await getLocalData('sales')
        const sale = localSales.find(item => Number(item.id) === id)

        if (!sale) {
          throw new Error('Esta venta no está guardada en el dispositivo.')
        }

        return normalizeSale(sale)
      }

      const response = await api.get(`/sales/${id}`)
      const data = response.data.venta || response.data.sale || response.data

      const sale = normalizeSale(data)

      await saveLocalData(
        'sales',
        sale as unknown as Record<string, unknown> & { id: number }
      )

      return sale
    } catch (error) {
      console.error('Error al consultar el detalle de la venta:', error)

      const localSales = await getLocalData('sales')
      const sale = localSales.find(item => Number(item.id) === id)

      if (sale) {
        return normalizeSale(sale)
      }

      throw error
    }
  }
}