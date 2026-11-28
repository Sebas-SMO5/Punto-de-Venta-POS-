// Controlador de usuarios: recibe la petición, llama al servicio y responde.
const usersService = require('../services/users.service')

async function getUsers(req, res, next) {
  try {
    res.json(await usersService.list())
  } catch (error) {
    next(error)
  }
}

async function createUser(req, res, next) {
  try {
    res.status(201).json(await usersService.create(req.body, req.user))
  } catch (error) {
    next(error)
  }
}

async function updateUser(req, res, next) {
  try {
    res.json(await usersService.update(req.params.id, req.body, req.user))
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser
}
