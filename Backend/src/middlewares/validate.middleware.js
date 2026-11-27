// Valida los datos que llegan en la petición usando un esquema de Zod.
// Si los datos no cumplen las reglas, responde 400 con la lista de errores
// y la petición no llega al controlador. Si cumplen, deja los datos ya
// limpios y convertidos en req.body / req.params / req.query.
//
// Uso: router.post('/', validate({ body: productSchema }), controller.create)
const AppError = require('../utils/AppError')

function validate(schemas) {
  return (req, res, next) => {
    const errors = []

    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part]
      if (!schema) continue

      const result = schema.safeParse(req[part] ?? {})

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            campo: [part, ...issue.path].join('.'),
            mensaje: issue.message
          })
        }
      } else if (part === 'query') {
        // En Express 5 req.query es de solo lectura
        req.validatedQuery = result.data
      } else {
        req[part] = result.data
      }
    }

    if (errors.length) {
      return next(AppError.badRequest(errors[0].mensaje, errors))
    }

    next()
  }
}

module.exports = validate
