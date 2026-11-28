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

// Movimiento de inventario:
//  entry      -> entrada de mercancía: SUMA "quantity" al stock
//  adjustment -> conteo físico: el stock QUEDA en "quantity" (solo admin)
const inventoryMovementBody = z
  .object({
    productId: positiveInt,
    type: z.enum(['entry', 'adjustment'], { error: 'Tipo de movimiento inválido' }),
    quantity: z.coerce
      .number({ error: 'La cantidad debe ser un número' })
      .min(0, 'La cantidad no puede ser negativa')
      .max(1_000_000),
    reason: safeText(200).optional().default(''),
    localId: z.uuid('Identificador local inválido').optional()
  })
  .strict()
  .refine(data => data.type !== 'entry' || data.quantity > 0, {
    message: 'La cantidad de la entrada debe ser mayor que cero',
    path: ['quantity']
  })

const movementsQuery = z.object({
  productId: positiveInt.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50)
})

const username = z
  .string()
  .trim()
  .min(3, 'El usuario debe tener al menos 3 caracteres')
  .max(50)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'El usuario solo puede tener letras, números, punto, guion y guion bajo')

const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(200)

const userCreateBody = z
  .object({
    username,
    password,
    fullName: safeText(100).min(1, 'El nombre es obligatorio'),
    role: z.enum(ROLES, { error: 'Rol inválido' }),
    email: z.email('Correo inválido').max(100).optional()
  })
  .strict()

const userUpdateBody = z
  .object({
    fullName: safeText(100).min(1, 'El nombre es obligatorio'),
    role: z.enum(ROLES, { error: 'Rol inválido' }),
    active: z.boolean(),
    password,
    email: z.email('Correo inválido').max(100).nullable()
  })
  .partial()
  .strict()
  .refine(data => Object.keys(data).length > 0, { message: 'No hay cambios para guardar' })

module.exports = {
  inventoryMovementBody,
  movementsQuery,
  userCreateBody,
  userUpdateBody,
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
