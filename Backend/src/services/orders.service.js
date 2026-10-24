let orders = [];
let nextId = 1;

const validStatuses = ['pendiente', 'preparando', 'entregado', 'cancelado'];

function getAll() {
  return orders;
}

function getById(id) {
  return orders.find(order => order.id === id) || null;
}

function create(data) {
  const { tableId, items, notes = '' } = data;

  if (!Number.isInteger(tableId) || tableId <= 0) {
    const error = new Error('El identificador de la mesa no es válido');
    error.status = 400;
    throw error;
  }

  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('El pedido debe incluir al menos un producto');
    error.status = 400;
    throw error;
  }

  const validatedItems = items.map(item => {
    if (
      !Number.isInteger(item.productId) ||
      item.productId <= 0 ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.price) ||
      item.price <= 0
    ) {
      const error = new Error('Los productos del pedido contienen datos inválidos');
      error.status = 400;
      throw error;
    }

    return {
      productId: item.productId,
      name: typeof item.name === 'string' ? item.name.trim() : '',
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity
    };
  });

  const total = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);

  const order = {
    id: nextId++,
    tableId,
    items: validatedItems,
    notes: typeof notes === 'string' ? notes.trim() : '',
    total,
    status: 'pendiente',
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  return order;
}

function updateStatus(id, status) {
  const order = getById(id);

  if (!order) {
    return null;
  }

  if (!validStatuses.includes(status)) {
    const error = new Error('El estado del pedido no es válido');
    error.status = 400;
    throw error;
  }

  if (order.status === 'cancelado' || order.status === 'entregado') {
    const error = new Error('No se puede cambiar el estado de un pedido finalizado');
    error.status = 400;
    throw error;
  }

  order.status = status;

  return order;
}

function cancel(id) {
  const order = getById(id);

  if (!order) {
    return null;
  }

  if (order.status === 'entregado') {
    const error = new Error('No se puede cancelar un pedido entregado');
    error.status = 400;
    throw error;
  }

  order.status = 'cancelado';

  return order;
}

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  cancel
};
