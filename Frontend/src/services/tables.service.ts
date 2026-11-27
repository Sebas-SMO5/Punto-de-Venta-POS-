
import { api } from './api'

import type { ServerOrder } from '../types/models'
import { readStore, writeRecords } from '../offline/db'

export interface RestaurantTable {
  id: number
  table_number: number
  capacity: number
  status: string
  active: boolean
  // Pedidos activos de la mesa (los incluye la API)
  orders?: ServerOrder[]
}

export const tablesService = {
  async getAll(): Promise<RestaurantTable[]> {
    try {
      if (!navigator.onLine) {
        return await readStore<RestaurantTable>('tables')
      }

      const response = await api.get<RestaurantTable[]>('/tables')
      await writeRecords('tables', response.data)

      return response.data
    } catch (error) {
      if (!navigator.onLine) {
        return await readStore<RestaurantTable>('tables')
      }

      throw error
    }
  }
}
