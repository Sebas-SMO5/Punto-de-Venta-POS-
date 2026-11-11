import {
  getDatabase,
  type PendingOperation,
  saveLocalData,
  deleteLocalData
} from './db'

import {
  getPendingOperations,
  updateOperation,
  deleteOperation
} from './queue'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/$/, '')

let synchronizing = false
let syncInterval: number | undefined

const getEndpoint = (entity: PendingOperation['entity']): string => {
  const endpoints = {
    products: 'products',
    categories: 'categories',
    tables: 'tables',
    orders: 'orders',
    sales: 'sales'
  }

  return `${API_URL}/${endpoints[entity]}`
}

const readResponse = async (response: Response): Promise<any> => {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const sendProductOperation = async (
  operation: PendingOperation
): Promise<void> => {
  const endpoint = getEndpoint('products')
  const data = { ...operation.data }
  const id = data.id

  if (operation.type === 'CREATE') {
    delete data.id

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    const result = await readResponse(response)

    if (!response.ok) {
      throw new Error(
        result?.mensaje || `Error ${response.status} al crear el producto`
      )
    }

    const product = result?.product || result
    const productId = Number(product?.id)

    if (!product || !Number.isSafeInteger(productId) || productId <= 0) {
      throw new Error('El servidor no devolvió el producto creado')
    }

    if (typeof id === 'number') {
      await deleteLocalData('products', id)
    }

    await saveLocalData('products', {
      ...product,
      id: productId
    } as Record<string, unknown> & { id: number })

    return
  }

  if (typeof id !== 'number' || id <= 0) {
    throw new Error('El identificador del producto no es válido')
  }

  if (operation.type === 'UPDATE') {
    delete data.id

    const response = await fetch(`${endpoint}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    const result = await readResponse(response)

    if (!response.ok) {
      throw new Error(
        result?.mensaje || `Error ${response.status} al actualizar el producto`
      )
    }

    const product = result?.product || result

    if (product && Number.isSafeInteger(Number(product.id))) {
      await saveLocalData('products', {
        ...product,
        id: Number(product.id)
      } as Record<string, unknown> & { id: number })
    }

    return
  }

  if (operation.type === 'DELETE') {
    const response = await fetch(`${endpoint}/${id}`, {
      method: 'DELETE'
    })

    const result = await readResponse(response)

    if (!response.ok) {
      throw new Error(
        result?.mensaje || `Error ${response.status} al eliminar el producto`
      )
    }

    await deleteLocalData('products', id)
  }
}

const sendCategoryOperation = async (
  operation: PendingOperation
): Promise<void> => {
  const endpoint = getEndpoint('categories')
  const data = { ...operation.data }
  const id = data.id

  if (operation.type === 'CREATE') {
    delete data.id

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    const result = await readResponse(response)

    if (!response.ok) {
      throw new Error(
        result?.mensaje || `Error ${response.status} al crear la categoría`
      )
    }

    const category = result?.category || result
    const categoryId = Number(category?.id)

    if (!category || !Number.isSafeInteger(categoryId) || categoryId <= 0) {
      throw new Error('El servidor no devolvió la categoría creada')
    }

    if (typeof id === 'number') {
      await deleteLocalData('categories', id)
    }

    await saveLocalData('categories', {
      ...category,
      id: categoryId
    } as Record<string, unknown> & { id: number })

    return
  }

  if (typeof id !== 'number' || id <= 0) {
    throw new Error('El identificador de la categoría no es válido')
  }

  if (operation.type === 'UPDATE') {
    delete data.id

    const response = await fetch(`${endpoint}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    const result = await readResponse(response)

    if (!response.ok) {
      throw new Error(
        result?.mensaje || `Error ${response.status} al actualizar la categoría`
      )
    }

    const category = result?.category || result

    if (category && Number.isSafeInteger(Number(category.id))) {
      await saveLocalData('categories', {
        ...category,
        id: Number(category.id)
      } as Record<string, unknown> & { id: number })
    }

    return
  }

  if (operation.type === 'DELETE') {
    const response = await fetch(`${endpoint}/${id}`, {
      method: 'DELETE'
    })

    const result = await readResponse(response)

    if (!response.ok) {
      throw new Error(
        result?.mensaje || `Error ${response.status} al desactivar la categoría`
      )
    }

    const db = await getDatabase()
    const category = await db.get('categories', id)

    if (category) {
      await saveLocalData('categories', {
        ...category,
        active: false
      })
    }
  }
}

const sendOrderOperation = async (
  operation: PendingOperation
): Promise<void> => {
  const endpoint = getEndpoint('orders')
  const data = { ...operation.data }

  if (operation.type === 'CREATE') {
    const localOrderId = data.localOrderId

    delete data.localOrderId

    data.localId = operation.operationId

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    const result = await readResponse(response)

    if (!response.ok) {
      throw new Error(
        result?.mensaje || `Error ${response.status} al sincronizar el pedido`
      )
    }

    const order = result?.order || result
    const serverOrderId = Number(order?.id)

    if (
      !order ||
      !Number.isSafeInteger(serverOrderId) ||
      serverOrderId <= 0
    ) {
      throw new Error(
        'El servidor no devolvió un identificador válido para el pedido'
      )
    }

    if (localOrderId !== undefined && localOrderId !== null) {
      await deleteLocalData('orders', Number(localOrderId))
    }

    await saveLocalData('orders', {
      ...order,
      id: serverOrderId
    } as Record<string, unknown> & { id: number })

    return
  }

  const id = Number(data.id)

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      'No se puede sincronizar el estado de un pedido sin identificador del servidor'
    )
  }

  if (operation.type === 'UPDATE') {
    const response = await fetch(`${endpoint}/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: data.status
      })
    })

    const result = await readResponse(response)

    if (!response.ok) {
      throw new Error(
        result?.mensaje || `Error ${response.status} al actualizar el pedido`
      )
    }

    const order = result?.order || result

    if (order && Number.isSafeInteger(Number(order.id))) {
      await saveLocalData('orders', {
        ...order,
        id: Number(order.id)
      } as Record<string, unknown> & { id: number })
    }

    return
  }

  if (operation.type === 'DELETE') {
    const response = await fetch(`${endpoint}/${id}`, {
      method: 'DELETE'
    })

    const result = await readResponse(response)

    if (!response.ok) {
      throw new Error(
        result?.mensaje || `Error ${response.status} al cancelar el pedido`
      )
    }

    const order = result?.order

    if (order && Number.isSafeInteger(Number(order.id))) {
      await saveLocalData('orders', {
        ...order,
        id: Number(order.id)
      } as Record<string, unknown> & { id: number })
    }

    return
  }
}

const sendSaleOperation = async (
  operation: PendingOperation
): Promise<void> => {
  if (operation.type !== 'CREATE') {
    throw new Error('Esta operación de venta todavía no está implementada')
  }

  const endpoint = getEndpoint('sales')
  const data = operation.data

  const orderId = Number(data.orderId)
  const paymentMethodId = Number(data.paymentMethodId)
  const localSaleId = Number(data.localSaleId)

  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error('El identificador del pedido no es válido')
  }

  if (!Number.isInteger(paymentMethodId) || paymentMethodId <= 0) {
    throw new Error('El medio de pago no es válido')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId,
      paymentMethodId,
      reference: data.reference ?? null
    })
  })

  const result = await readResponse(response)

  if (!response.ok) {
    throw new Error(
      result?.mensaje || `Error ${response.status} al registrar la venta`
    )
  }

  const sale = result?.venta || result?.sale || result
  const saleId = Number(sale?.id)

  if (!sale || !Number.isSafeInteger(saleId) || saleId <= 0) {
    throw new Error('El servidor no devolvió la venta registrada')
  }

  const savedSale = {
    ...sale,
    id: saleId,
    order_id: Number(sale.order_id ?? orderId),
    pendingSync: false
  }

  await saveLocalData(
    'sales',
    savedSale as Record<string, unknown> & { id: number }
  )

  if (Number.isInteger(localSaleId) && localSaleId < 0) {
    await deleteLocalData('sales', localSaleId)
  }
}

const sendOperation = async (
  operation: PendingOperation
): Promise<void> => {
  switch (operation.entity) {
    case 'products':
      await sendProductOperation(operation)
      return

    case 'categories':
      await sendCategoryOperation(operation)
      return

    case 'orders':
      await sendOrderOperation(operation)
      return

    case 'sales':
      await sendSaleOperation(operation)
      return

    default:
      throw new Error(
        `La sincronización de ${operation.entity} todavía no está implementada`
      )
  }
}

export const synchronizeData = async (): Promise<void> => {
  if (!navigator.onLine || synchronizing) return

  synchronizing = true

  try {
    const operations = await getPendingOperations()

    for (const operation of operations) {
      if (!navigator.onLine) break
      if (operation.id === undefined) continue

      try {
        await updateOperation(operation.id, {
          status: 'processing',
          error: undefined
        })

        await sendOperation(operation)

        await deleteOperation(operation.id)
      } catch (error) {
        await updateOperation(operation.id, {
          status: 'error',
          attempts: operation.attempts + 1,
          error: error instanceof Error
            ? error.message
            : 'Error desconocido'
        })

        console.error(
          `Error sincronizando ${operation.entity}:`,
          error
        )
      }
    }
  } finally {
    synchronizing = false
  }
}

export const startAutoSync = (): void => {
  window.addEventListener('online', synchronizeData)

  synchronizeData()

  if (syncInterval !== undefined) {
    window.clearInterval(syncInterval)
  }

  syncInterval = window.setInterval(() => {
    if (navigator.onLine) {
      synchronizeData()
    }
  }, 15000)
}

export const stopAutoSync = (): void => {
  window.removeEventListener('online', synchronizeData)

  if (syncInterval !== undefined) {
    window.clearInterval(syncInterval)
    syncInterval = undefined
  }
}