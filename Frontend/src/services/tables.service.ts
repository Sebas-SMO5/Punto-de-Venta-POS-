
import { api } from './api'
import { getLocalData, saveManyLocalData } from '../offline/db'

export interface RestaurantTable {
  id: number
  table_number: number
  capacity: number
  status: string
  active: boolean
}

export const tablesService = {
  async getAll(): Promise<RestaurantTable[]> {
    try {
      if (!navigator.onLine) {
        return await getLocalData('tables') as unknown as RestaurantTable[]
      }

      const response = await api.get<RestaurantTable[]>('/tables')

      await saveManyLocalData(
        'tables',
        response.data as unknown as (Record<string, unknown> & { id: number })[]
      )

      return response.data
    } catch (error) {
      if (!navigator.onLine) {
        return await getLocalData('tables') as unknown as RestaurantTable[]
      }

      throw error
    }
  }
}
