
let products = [
  { id: 1, name: 'Arroz con pollo', category: 'Platos fuertes', price: 18000, available: true },
  { id: 2, name: 'Hamburguesa clásica', category: 'Platos fuertes', price: 22000, available: true },
  { id: 3, name: 'Pizza personal', category: 'Platos fuertes', price: 20000, available: true },
  { id: 4, name: 'Papas fritas', category: 'Acompañamientos', price: 8000, available: true },
  { id: 5, name: 'Limonada natural', category: 'Bebidas', price: 6000, available: true },
  { id: 6, name: 'Agua embotellada', category: 'Bebidas', price: 4000, available: false },
];

function getAll() {
  return products;
}

function getById(id) {
  return products.find(product => product.id === id);
}

function create(data) {
  const { name, category, price, available = true } = data;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof category !== 'string' ||
    !category.trim() ||
    !Number.isFinite(price) ||
    price <= 0 ||
    typeof available !== 'boolean'
  ) {
    const error = new Error('Los datos del producto no son válidos');
    error.status = 400;
    throw error;
  }

  const newId = products.length
    ? Math.max(...products.map(product => product.id)) + 1
    : 1;

  const product = {
    id: newId,
    name: name.trim(),
    category: category.trim(),
    price,
    available,
  };

  products.push(product);

  return product;
}

function update(id, data) {
  const index = products.findIndex(product => product.id === id);

  if (index === -1) {
    return null;
  }

  const currentProduct = products[index];

  const updatedProduct = {
    ...currentProduct,
    ...data,
    id,
  };

  if (
    typeof updatedProduct.name !== 'string' ||
    !updatedProduct.name.trim() ||
    typeof updatedProduct.category !== 'string' ||
    !updatedProduct.category.trim() ||
    !Number.isFinite(updatedProduct.price) ||
    updatedProduct.price <= 0 ||
    typeof updatedProduct.available !== 'boolean'
  ) {
    const error = new Error('Los datos del producto no son válidos');
    error.status = 400;
    throw error;
  }

  updatedProduct.name = updatedProduct.name.trim();
  updatedProduct.category = updatedProduct.category.trim();

  products[index] = updatedProduct;

  return updatedProduct;
}

function remove(id) {
  const index = products.findIndex(product => product.id === id);

  if (index === -1) {
    return false;
  }

  products.splice(index, 1);

  return true;
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
};
