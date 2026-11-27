// @vitest-environment jsdom
// Pruebas del componente SaleModal (ventana de cobro).
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleModal from '../SaleModal.vue'
import type { PosOrder } from '../../../types/models'

const order: PosOrder = {
  id: 5,
  order_number: 'PED-000005',
  table_id: 2,
  table_number: 2,
  items: [],
  notes: '',
  total: 28000,
  status: 'completed',
  created_at: '2026-11-27T12:00:00.000Z',
}

const methods = [
  { id: 1, name: 'Efectivo' },
  { id: 4, name: 'Nequi' },
]

describe('SaleModal', () => {
  it('muestra el pedido y el total a cobrar', () => {
    const wrapper = mount(SaleModal, { props: { order, methods, busy: false } })

    expect(wrapper.text()).toContain('PED-000005')
    expect(wrapper.get('[data-test="sale-total"]').text()).toMatch(/28\.000/)
  })

  it('confirma con el medio de pago elegido', async () => {
    const wrapper = mount(SaleModal, { props: { order, methods, busy: false } })

    await wrapper.get('select').setValue(4)
    await wrapper.get('button.primary-button').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[4]])
  })

  it('mientras registra, los botones se desactivan', () => {
    const wrapper = mount(SaleModal, { props: { order, methods, busy: true } })

    expect(wrapper.get('button.primary-button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Registrando...')
  })

  it('el botón Cancelar avisa que se cierra', async () => {
    const wrapper = mount(SaleModal, { props: { order, methods, busy: false } })

    await wrapper.get('button.table-action').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
