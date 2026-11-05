import { api } from './api'
import {
  getLocalData,
  saveManyLocalData
} from '../offline/db'

export interface InventoryItem {
  id: number
  product: string
  stock: number
  minimum: number
}

export const inventoryService = {
  async getAll(): Promise<InventoryItem[]> {
    try {
      if (!navigator.onLine) {
        return await getLocalData('inventory') as unknown as InventoryItem[]
      }

      const response = await api.get<InventoryItem[]>('/inventory')

      const inventory = response.data.map(item => ({
        ...item,
        id: Number(item.id),
        stock: Number(item.stock),
        minimum: Number(item.minimum)
      }))

      await saveManyLocalData(
        'inventory',
        inventory as unknown as (Record<string, unknown> & { id: number })[]
      )

      return inventory
    } catch (error) {
      console.error('Error al consultar inventario:', error)

      const localInventory = await getLocalData('inventory')

      if (localInventory.length > 0) {
        return localInventory as unknown as InventoryItem[]
      }

      throw error
    }
  }
}