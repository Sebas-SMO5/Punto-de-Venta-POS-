const syncRepository = require('../repositories/sync.repository')

const syncOperations = async (operations, userId) => {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('Debes enviar una lista de operaciones para sincronizar')
  }

  if (!userId) {
    throw new Error('El usuario es obligatorio para sincronizar')
  }

  const operationIds = new Set()
  const results = []

  for (const operation of operations) {
    if (!operation.id || !operation.type || !operation.data) {
      results.push({
        id: operation.id || null,
        status: 'rejected',
        message: 'La operación debe incluir id, type y data'
      })
      continue
    }

    if (operationIds.has(operation.id)) {
      results.push({
        id: operation.id,
        status: 'duplicate',
        message: 'La operación está repetida en esta solicitud'
      })
      continue
    }

    operationIds.add(operation.id)

    try {
      const existingOperation = await syncRepository.findOperationById(
        operation.id,
        userId
      )

      if (existingOperation) {
        results.push({
          id: operation.id,
          status: 'already_synced',
          message: 'La operación ya fue procesada anteriormente'
        })
        continue
      }

      const result = await syncRepository.processOperation(operation, userId)

      results.push({
        id: operation.id,
        status: 'synced',
        result
      })
    } catch (error) {
      results.push({
        id: operation.id,
        status: 'failed',
        message: error.message || 'No fue posible sincronizar la operación'
      })
    }
  }

  return {
    total: operations.length,
    synced: results.filter(operation => operation.status === 'synced').length,
    failed: results.filter(operation => operation.status === 'failed').length,
    results
  }
}

module.exports = {
  syncOperations
}