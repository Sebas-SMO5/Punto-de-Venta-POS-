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

module.exports = {
  getSales,
  getSaleById
}