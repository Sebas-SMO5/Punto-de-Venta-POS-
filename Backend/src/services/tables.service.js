const tablesRepository = require('../repositories/tables.repository')

async function getAll() {
  return tablesRepository.getAll()
}

async function getById(id) {
  return tablesRepository.getById(id)
}

module.exports = {
  getAll,
  getById
}