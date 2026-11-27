// Controlador de pedidos: recibe la petición, llama al servicio y responde.
const ordersService = require('../services/orders.service')

async function getOrders(req, res, next) {
  try {
    res.json(await ordersService.getAll())
  } catch (error) {
    next(error)
  }
}

async function getOrderById(req, res, next) {
  try {
    res.json(await ordersService.getById(req.params.id))
  } catch (error) {
    next(error)
  }
}

async function createOrder(req, res, next) {
  try {
    res.status(201).json(await ordersService.create(req.body, req.user))
  } catch (error) {
    next(error)
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    res.json(await ordersService.updateStatus(req.params.id, req.body.status, req.user))
  } catch (error) {
    next(error)
  }
}

async function cancelOrder(req, res, next) {
  try {
    const order = await ordersService.cancel(req.params.id, req.user)
    res.json({ mensaje: 'Pedido cancelado correctamente', order })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder
}
