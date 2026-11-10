const salesService = require('../services/sales.service')

async function getSales(req, res, next) {
    try {
        const sales = await salesService.getAll()

        res.status(200).json({
            ventas: sales
        })
    } catch (error) {
        next(error)
    }
}

async function getSaleById(req, res, next) {
    try {
        const id = Number(req.params.id)

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                mensaje: 'El ID de la venta no es válido'
            })
        }

        const sale = await salesService.getById(id)

        if (!sale) {
            return res.status(404).json({
                mensaje: 'Venta no encontrada'
            })
        }

        res.status(200).json({
            venta: sale
        })
    } catch (error) {
        next(error)
    }
}

async function createSale(req, res, next) {
    try {
        const sale = await salesService.create(req.body)

        res.status(201).json({
            mensaje: 'Venta registrada correctamente',
            venta: sale
        })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    getSales,
    getSaleById,
    createSale
}