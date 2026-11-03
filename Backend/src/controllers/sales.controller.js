
const salesService = require('../services/sales.service')

async function getSales(req, res, next) {
  try {
    const sales = await salesService.getAll()
    res.json(sales)
  } catch (error) {
    next(error)
  }
}

async function getSaleById(req, res, next) {
  try {
    const id = Number(req.params.id)

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensaje: 'El identificador de la venta no es válido'
      })
    }

    const sale = await salesService.getById(id)

    if (!sale) {
      return res.status(404).json({
        mensaje: 'Venta no encontrada'
      })
    }

    res.json(sale)
  } catch (error) {
    next(error)
  }
}

async function createSale(req, res, next) {
  try {
    const orderId = Number(req.body.orderId)
    const paymentMethodId = Number(req.body.paymentMethodId)
    const reference = req.body.reference || null

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        mensaje: 'El identificador del pedido no es válido'
      })
    }

    if (!Number.isInteger(paymentMethodId) || paymentMethodId <= 0) {
      return res.status(400).json({
        mensaje: 'El medio de pago no es válido'
      })
    }

    const sale = await salesService.createFromOrder(
      orderId,
      paymentMethodId,
      reference
    )

    res.status(201).json({
      mensaje: 'Venta registrada correctamente',
      venta: sale
    })
  } catch (error) {
    if (
      error.message === 'El pedido no existe' ||
      error.message === 'Solo se pueden registrar ventas de pedidos completados' ||
      error.message === 'Este pedido ya tiene una venta registrada' ||
      error.message === 'El medio de pago no existe o está inactivo' ||
      error.message === 'El pedido no tiene productos registrados'
    ) {
      return res.status(400).json({
        mensaje: error.message
      })
    }

    next(error)
  }
}

module.exports = {
  getSales,
  getSaleById,
  createSale
}
