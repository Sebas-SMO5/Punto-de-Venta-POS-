const salesRepository = require('../repositories/sales.repository')

async function getAll() {
  return salesRepository.getAll()
}

async function getById(id) {
  return salesRepository.getById(id)
}

module.exports = {
  getAll,
  getById
}