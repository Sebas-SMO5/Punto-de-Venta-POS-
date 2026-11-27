// Reglas (esquemas) que deben cumplir los datos que llegan a la API.
// Se escriben con la librería Zod. Ejemplo: el precio de un producto debe
// ser un número mayor que cero; si llega "-5" o "hola", la API responde 400.
// .strict() rechaza campos que no estén en la lista (evita que se cuelen
// datos extra), y .trim() quita espacios al inicio y al final.
const { z } = require('zod')

const ROLES = ['admin', 'cashier', 'waiter']
const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled']

// Texto sin etiquetas HTML (<script>...). Ayuda a prevenir ataques XSS.
const safeText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .refine(value => !/[<>]/.test(value), 'No se permiten los caracteres < >')

const positiveInt = z.coerce
  .number({ error: 'Debe ser un número' })
  .int('Debe ser un número entero')
  .positive('Debe ser mayor que cero')

const idParam = z.object({ id: positiveInt })

const loginBody = z.object({
  username: z.string().trim().min(1, 'Ingrese el usuario').max(50),
  password: z.string().min(1, 'Ingrese la contraseña').max(200)
})

const sessionIdParam = z.object({
  sessionId: z.uuid('Identificador de sesión inválido')
})

const stockNumber = (label) =>
  z.coerce
    .number({ error: `${label} debe ser un número` })
    .min(0, `${label} no puede ser negativo`)
    .max(1_000_000)

const productBase = {
  name: safeText(120).min(1, 'El nombre es obligatorio'),
  category: safeText(100).min(1, 'La categoría es obligatoria'),
  description: safeText(500).optional(),
  price: z.coerce
    .number({ error: 'El precio debe ser un número' })
    .positive('El precio debe ser mayor que cero')
    .max(100_000_000),
  available: z.boolean().optional(),
  minimum_stock: stockNumber('El stock mínimo').optional()
}

const productCreateBody = z
  .object({
    ...productBase,
    current_stock: stockNumber('El stock inicial').optional()
  })
  .strict()

const productUpdateBody = z
  .object({
    ...productBase,
    // Versión que tenía el dispositivo cuando editó (bloqueo optimista)
    expectedVersion: positiveInt.optional()
  })
  .partial()
  .strict()

const categoryBody = z
  .object({
    name: safeText(100).min(1, 'El nombre de la categoría es obligatorio'),
    description: safeText(500).optional().default(''),
    active: z.boolean().optional().default(true),
    expectedVersion: positiveInt.optional()
  })
  .strict()

const orderCreateBody = z
  .object({
    tableId: positiveInt,
    localId: z.uuid('El identificador local del pedido no es válido').optional(),
    notes: safeText(500).optional().default(''),
    orderType: z.enum(['dine_in', 'takeaway', 'delivery']).optional(),
    items: z
      .array(
        z.object({
          productId: positiveInt,
          quantity: positiveInt.max(1000, 'Cantidad demasiado grande')
        })
      )
      .min(1, 'El pedido debe incluir al menos un producto')
      .max(100)
  })
  .strict()

const orderStatusBody = z
  .object({
    status: z.enum(ORDER_STATUSES, { error: 'El estado del pedido no es válido' })
  })
  .strict()

const saleCreateBody = z
  .object({
    orderId: positiveInt,
    paymentMethodId: positiveInt,
    reference: safeText(100).nullable().optional()
  })
  .strict()

module.exports = {
  ROLES,
  ORDER_STATUSES,
  idParam,
  loginBody,
  sessionIdParam,
  productCreateBody,
  productUpdateBody,
  categoryBody,
  orderCreateBody,
  orderStatusBody,
  saleCreateBody
}
