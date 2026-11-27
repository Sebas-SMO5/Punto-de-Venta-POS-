// @vitest-environment jsdom
// Pruebas del componente OrdersTable: qué botones muestra según el estado
// del pedido y qué avisa (emite) al hacer clic.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrdersTable from '../OrdersTable.vue'
import type { PosOrder } from '../../../types/models'
import type { SaleState } from '../../../stores/sales'

function order(partial: Partial<PosOrder>): PosOrder {
  return {
    id: 1,
    order_number: 'PED-000001',
    table_id: 1,
    table_number: 1,
    items: [{ id: 1, productId: 1, name: 'Arepa', quantity: 2, price: 5000, subtotal: 10000 }],
    notes: '',
    total: 10000,
    status: 'pending',
    created_at: '2026-11-27T12:00:00.000Z',
    ...partial,
  }
}

function render(orders: PosOrder[], { canCharge = true, sale = 'none' as SaleState } = {}) {
  return mount(OrdersTable, {
    props: { orders, loading: false, canCharge, saleState: () => sale },
  })
}

describe('OrdersTable', () => {
  it('muestra un mensaje cuando no hay pedidos', () => {
    expect(render([]).text()).toContain('Todavía no hay pedidos registrados')
  })

  it('un pedido pendiente muestra Entregar y Cancelar', async () => {
    const wrapper = render([order({ id: 7 })])

    await wrapper.get('button.table-action:not(.delete-action)').trigger('click')
    await wrapper.get('button.delete-action').trigger('click')

    expect(wrapper.emitted('complete')).toEqual([[7]])
    expect(wrapper.emitted('cancel')).toEqual([[7]])
  })

  it('un pedido entregado y sin venta muestra "Registrar venta" a quien puede cobrar', async () => {
    const completed = order({ status: 'completed' })
    const wrapper = render([completed])

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('charge')?.[0]).toEqual([completed])
  })

  it('un mesero no ve el botón de cobrar', () => {
    const wrapper = render([order({ status: 'completed' })], { canCharge: false })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('indica cuando la venta está pendiente de sincronización', () => {
    const wrapper = render([order({ status: 'completed' })], { sale: 'pending' })
    expect(wrapper.text()).toContain('Pendiente de sincronización')
  })

  it('marca los pedidos creados sin conexión (id negativo)', () => {
    const wrapper = render([order({ id: -123 })])
    expect(wrapper.text()).toContain('Sin sincronizar')
  })

  it('muestra el estado en español y el total con formato de pesos', () => {
    const text = render([order({ status: 'preparing', total: 18000 })]).text()

    expect(text).toContain('En preparación')
    expect(text).toMatch(/18\.000/)
  })
})
