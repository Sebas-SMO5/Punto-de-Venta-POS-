// Controlador de ventas: recibe la petición, llama al servicio y responde.
// Los datos ya llegan validados por Zod (ver validators/schemas.js).
const salesService = require('../services/sales.service')

async function getSales(req, res, next) {
  try {
    res.json(await salesService.getAll())
  } catch (error) {
    next(error)
  }
}

async function getSaleById(req, res, next) {
  try {
    res.json(await salesService.getById(req.params.id))
  } catch (error) {
    next(error)
  }
}

async function createSale(req, res, next) {
  try {
    const sale = await salesService.createFromOrder(req.body, req.user)

    res.status(201).json({
      mensaje: 'Venta registrada correctamente',
      venta: sale
    })
  } catch (error) {
    next(error)
  }
}

async function getPaymentMethods(req, res, next) {
  try {
    res.json(await salesService.getPaymentMethods())
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getSales,
  getSaleById,
  createSale,
  getPaymentMethods
}
