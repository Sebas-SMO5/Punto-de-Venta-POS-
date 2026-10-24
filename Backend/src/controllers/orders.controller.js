const ordersService = require('../services/orders.service');

function getOrders(req, res, next) {
  try {
    res.json(ordersService.getAll());
  } catch (error) {
    next(error);
  }
}

function getOrderById(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensaje: 'El identificador del pedido no es válido' });
    }

    const order = ordersService.getById(id);

    if (!order) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
}

function createOrder(req, res, next) {
  try {
    const order = ordersService.create(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
}

function updateOrderStatus(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensaje: 'El identificador del pedido no es válido' });
    }

    const order = ordersService.updateStatus(id, req.body.status);

    if (!order) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
}

function cancelOrder(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensaje: 'El identificador del pedido no es válido' });
    }

    const order = ordersService.cancel(id);

    if (!order) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    res.json({
      mensaje: 'Pedido cancelado correctamente',
      order
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder
};

