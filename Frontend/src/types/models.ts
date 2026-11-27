// Tipos (la "forma") de los datos que maneja la aplicación.
// TypeScript usa estos tipos para avisar de errores antes de ejecutar,
// por ejemplo si se escribe "prise" en lugar de "price".

export type Role = 'admin' | 'cashier' | 'waiter'

export interface AuthUser {
  id: number
  username: string
  fullName?: string
  role: Role
}

// Lo que responde la API al iniciar sesión o renovar la sesión
export interface SessionResponse {
  accessToken: string
  user: AuthUser
}

export interface ActiveSession {
  id: string
  startedAt: string
  lastActivityAt: string
  userAgent: string | null
  ipAddress: string | null
  current: boolean
}

export interface Product {
  id: number
  category_id?: number
  name: string
  description?: string
  category: string
  price: number
  available: boolean
  current_stock?: number
  minimum_stock?: number
  sku?: string | null
  // Número de versión para detectar conflictos (bloqueo optimista)
  version?: number
}

// Datos que se envían al crear o editar un producto
export interface ProductInput {
  name: string
  category: string
  price: number
  available: boolean
  description?: string
  minimum_stock?: number
  current_stock?: number
}

export interface PaymentMethod {
  id: number
  name: string
}

// Formato de error que devuelve la API
export interface ApiError {
  mensaje: string
  correlationId?: string
  detalles?: {
    reason?: string
    code?: string
    server?: unknown
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  cashier: 'Cajero',
  waiter: 'Mesero',
}

// Pedido tal como lo devuelve la API
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'

export interface ServerOrderItem {
  id?: number
  productId: number
  name: string
  quantity: number | string
  price: number | string
  subtotal?: number | string
  // Nombres alternativos que usaban versiones anteriores de la API
  product_id?: number
  product_name?: string
  unit_price?: number | string
}

export interface ServerOrder {
  id: number | string
  local_id?: string
  order_number?: string
  table_id?: number
  table_number?: number
  user_id?: number
  status: string
  notes?: string
  total: number | string
  created_at?: string
  items?: ServerOrderItem[]
  // Nombres alternativos usados por pedidos guardados localmente
  tableNumber?: number
  createdAt?: string
}
