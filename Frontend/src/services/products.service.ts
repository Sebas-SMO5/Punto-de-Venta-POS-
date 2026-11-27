// Servicio de productos con soporte OFFLINE:
// - Con conexión: habla con la API y guarda una copia en IndexedDB.
// - Sin conexión: lee la copia local y deja la operación en la cola para
//   enviarla después. Los productos creados sin conexión usan un id
//   negativo temporal hasta que el servidor les asigna el real.
import { api, isConnectionError } from './api'
import type { Product, ProductInput } from '../types/models'
import { deleteLocalData, readStore, writeRecord, writeRecords } from '../offline/db'
import { addOperation, deleteOperation, getAllOperations, updateOperation } from '../offline/queue'

type ServerProduct = Omit<Product, 'price' | 'current_stock' | 'minimum_stock'> & {
  price: number | string
  current_stock?: number | string
  minimum_stock?: number | string
}

// PostgreSQL envía los decimales como texto ("18000.00"): se pasan a número
export function normalizeProduct(product: ServerProduct): Product {
  return {
    ...product,
    id: Number(product.id),
    price: Number(product.price),
    current_stock: Number(product.current_stock ?? 0),
    minimum_stock: Number(product.minimum_stock ?? 0),
  }
}

const getLocalProducts = () => readStore<Product>('products')

async function findPending(id: number, type: 'CREATE' | 'UPDATE') {
  const operations = await getAllOperations()
  return operations.find(
    (op) => op.entity === 'products' && op.type === type && op.data.id === id && op.status === 'pending',
  )
}

export const productsService = {
  async getAll(): Promise<Product[]> {
    if (!navigator.onLine) return getLocalProducts()

    try {
      const response = await api.get<ServerProduct[]>('/products')
      const products = response.data.map(normalizeProduct)
      await writeRecords('products', products)
      return products
    } catch (error) {
      if (isConnectionError(error)) return getLocalProducts()
      throw error
    }
  },

  async create(input: ProductInput): Promise<Product> {
    if (navigator.onLine) {
      try {
        const response = await api.post<ServerProduct>('/products', input)
        const product = normalizeProduct(response.data)
        await writeRecord('products', product)
        return product
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    const localProduct: Product = { ...input, id: -Date.now(), version: 1 }
    await writeRecord('products', localProduct)

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'CREATE',
      entity: 'products',
      data: { ...localProduct },
    })

    return localProduct
  },

  // expectedVersion = versión del producto que el usuario tenía en pantalla.
  // Si alguien más lo cambió, la API responde 409 (conflicto).
  async update(id: number, input: ProductInput, expectedVersion?: number): Promise<Product> {
    if (navigator.onLine && id > 0) {
      try {
        const response = await api.put<ServerProduct>(`/products/${id}`, { ...input, expectedVersion })
        const product = normalizeProduct(response.data)
        await writeRecord('products', product)
        return product
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    const localProduct: Product = { ...input, id, version: expectedVersion }
    await writeRecord('products', localProduct)

    const pendingCreate = await findPending(id, 'CREATE')
    const pendingUpdate = await findPending(id, 'UPDATE')

    if (pendingCreate?.id !== undefined) {
      // Todavía no existe en el servidor: se actualiza la creación pendiente
      await updateOperation(pendingCreate.id, { data: { ...pendingCreate.data, ...input } })
    } else if (pendingUpdate?.id !== undefined) {
      // Se combinan los cambios, conservando la versión original que vio el usuario
      await updateOperation(pendingUpdate.id, { data: { ...pendingUpdate.data, ...input } })
    } else {
      await addOperation({
        operationId: crypto.randomUUID(),
        type: 'UPDATE',
        entity: 'products',
        data: { ...input, id, expectedVersion },
      })
    }

    return localProduct
  },

  async delete(id: number): Promise<void> {
    if (navigator.onLine && id > 0) {
      try {
        await api.delete(`/products/${id}`)
        await deleteLocalData('products', id)
        return
      } catch (error) {
        if (!isConnectionError(error)) throw error
      }
    }

    await deleteLocalData('products', id)

    const pendingCreate = await findPending(id, 'CREATE')

    if (pendingCreate?.id !== undefined) {
      // Se creó y se borró sin conexión: no hay nada que enviar
      await deleteOperation(pendingCreate.id)
      return
    }

    await addOperation({
      operationId: crypto.randomUUID(),
      type: 'DELETE',
      entity: 'products',
      data: { id },
    })
  },
}
