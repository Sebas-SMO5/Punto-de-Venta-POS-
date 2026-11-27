// Funciones pequeñas para mostrar datos de forma bonita en pantalla.

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

// 18000 -> "$ 18.000"
export function formatCurrency(value: number | string): string {
  return currency.format(Number(value) || 0)
}

// "2026-11-27T22:36:38Z" -> "27/11/2026, 5:36:38 p. m."
export function formatDate(value: string | undefined): string {
  return value ? new Date(value).toLocaleString('es-CO') : '—'
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  ready: 'Listo',
  completed: 'Entregado',
  cancelled: 'Cancelado',
}

// "completed" -> "Entregado"
export function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status
}
