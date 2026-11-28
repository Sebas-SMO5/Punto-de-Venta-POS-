// Servicio de inventario.
// - Consultar existencias (con copia local para verlas sin conexión).
// - Registrar ENTRADAS de mercancía: también funcionan sin conexión, porque
//   una entrada solo suma y no choca con otros cambios (si dos personas
//   suman 5 y 3, el resultado es +8 sin importar el orden).
// - Registrar AJUSTES (conteo físico, solo admin): necesitan conexión,
//   porque dejan el stock en un valor exacto y podrían borrar ventas que
//   otra caja hizo mientras tanto.
import { api, isConnectionError } from './api'
import { clearLocalData, readStore, writeRecord, writeRecords } from '../offline/db'
import { addOperation } from '../offline/queue'

export interface InventoryItem {
  // id = id del producto
  id: number
  product_id: number
  product: string
  stock: number
  minimum: number
  updated_at?: string
}

export interface InventoryMovement {
  id: number
  product_id: number
  product: string
  type: 'entry' | 'exit' | 'adjustment'
  quantity: number
  previous_stock: number
  new_stock: number
  reason: string | null
  created_at: string
  user_name: string | null
}

export interface MovementInput {
  productId: number
  type: 'entry' | 'adjustment'
  quantity: number
  reason: string
}

type ServerItem = Omit<InventoryItem, 'stock' | 'minimum'> & { stock: number | string; minimum: number | string }

function normalize(item: ServerItem): InventoryItem {
  return {
    ...item,
    id: Number(item.product_id ?? item.id),
    product_id: Number(item.product_id ?? item.id),
    stock: Number(item.stock),
    minimum: Number(item.minimum),
  }
}

const getLocalInventory = () => readStore<InventoryItem>('inventory')

export const inventoryService = {
  async getAll(): Promise<InventoryItem[]> {
    if (!navigator.onLine) return getLocalInventory()

    try {
      const response = await api.get<ServerItem[]>('/inventory')
      const inventory = response.data.map(normalize)

      await clearLocalData('inventory')
      await writeRecords('inventory', inventory)

      return inventory
    } catch (error) {
      if (isConnectionError(error)) return getLocalInventory()
      throw error
    }
  },

  // Devuelve el producto con su stock actualizado y si quedó pendiente
  async registerMovement(input: MovementInput): Promise<{ item: InventoryItem; offline: boolean }> {
    const localId = crypto.randomUUID()

    if (navigator.onLine) {
      try {
        const response = await api.post<ServerItem>('/inventory/movements', { ...input, localId })
        const item = normalize(response.data)
        await writeRecord('inventory', item)
        return { item, offline: false }
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    if (input.type === 'adjustment') {
      throw new Error('Los ajustes de inventario necesitan conexión a internet.')
    }

    const current = (await getLocalInventory()).find((item) => item.id === input.productId)

    if (!current) {
      throw new Error('El producto no está en la copia local del inventario.')
    }

    const item: InventoryItem = { ...current, stock: current.stock + input.quantity }
    await writeRecord('inventory', item)

    await addOperation({
      operationId: localId,
      type: 'CREATE',
      entity: 'inventory',
      data: { ...input, localId, productName: current.product },
    })

    return { item, offline: true }
  },

  async getMovements(productId?: number): Promise<InventoryMovement[]> {
    const response = await api.get<InventoryMovement[]>('/inventory/movements', {
      params: { productId, limit: 30 },
    })

    return response.data.map((movement) => ({
      ...movement,
      quantity: Number(movement.quantity),
      previous_stock: Number(movement.previous_stock),
      new_stock: Number(movement.new_stock),
    }))
  },
}
