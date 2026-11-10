const salesRepository = require('../repositories/sales.repository')

async function getAll() {
    return salesRepository.getAll()
}

async function getById(id) {
    return salesRepository.getById(id)
}

async function create(data) {
    return salesRepository.create(data)
}

module.exports = {
    getAll,
    getById,
    create
}