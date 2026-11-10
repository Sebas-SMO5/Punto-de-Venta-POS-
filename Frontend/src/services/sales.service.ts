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

function normalizeSale(sale: Sale): Sale {
  return {
    ...sale,
    id: Number(sale.id),
    total: Number(sale.total || 0),
    subtotal: Number(sale.subtotal || 0),
    tax: Number(sale.tax || 0),
    discount: Number(sale.discount || 0),
    items: (sale.items || []).map(item => ({
      ...item,
      id: Number(item.id),
      quantity: Number(item.quantity),
      price: Number(item.price),
      subtotal: Number(item.subtotal)
    })),
    payments: (sale.payments || []).map(payment => ({
      ...payment,
      id: Number(payment.id),
      amount: Number(payment.amount)
    }))
  }
}

export const salesService = {
  async getAll(): Promise<Sale[]> {
    try {
      if (!navigator.onLine) {
        return await getLocalData('sales') as unknown as Sale[]
      }

      const response = await api.get<Sale[]>('/sales')

      const sales = response.data.map(normalizeSale)

      await saveManyLocalData(
        'sales',
        sales as unknown as (Record<string, unknown> & { id: number })[]
      )

      return sales
    } catch (error) {
      console.error('Error al consultar las ventas:', error)

      const localSales = await getLocalData('sales')

      if (localSales.length > 0) {
        return localSales as unknown as Sale[]
      }

      throw error
    }
  },

  async getById(id: number): Promise<Sale> {
    try {
      if (!navigator.onLine) {
        const localSales = await getLocalData('sales')
        const sale = localSales.find(item => item.id === id)

        if (!sale) {
          throw new Error('No existe información local de esta venta.')
        }

        return normalizeSale(sale as unknown as Sale)
      }

      const response = await api.get(`/sales/${id}`)
      const data = response.data.venta || response.data
      const sale = normalizeSale(data as Sale)

      await saveLocalData(
        'sales',
        sale as unknown as Record<string, unknown> & { id: number }
      )

      return sale
    } catch (error) {
      console.error('Error al consultar el detalle de la venta:', error)

      const localSales = await getLocalData('sales')
      const sale = localSales.find(item => item.id === id)

      if (sale) {
        return normalizeSale(sale as unknown as Sale)
      }

      throw error
    }
  }
}