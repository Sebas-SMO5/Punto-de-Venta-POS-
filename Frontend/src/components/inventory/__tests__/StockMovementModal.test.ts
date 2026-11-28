// @vitest-environment jsdom
// Pruebas de la ventana de entradas y ajustes de inventario.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StockMovementModal from '../StockMovementModal.vue'

const item = { id: 3, product_id: 3, product: 'Limonada natural', stock: 10, minimum: 2 }

describe('StockMovementModal', () => {
  it('una entrada muestra cómo quedará el stock (suma)', async () => {
    const wrapper = mount(StockMovementModal, { props: { item, type: 'entry', busy: false } })

    await wrapper.get('#stock-quantity').setValue(5)

    expect(wrapper.get('[data-test="resulting-stock"]').text()).toContain('15')
  })

  it('un ajuste deja el stock en el número contado', async () => {
    const wrapper = mount(StockMovementModal, { props: { item, type: 'adjustment', busy: false } })

    await wrapper.get('#stock-quantity').setValue(8)

    expect(wrapper.get('[data-test="resulting-stock"]').text()).toContain('8')
  })

  it('envía la cantidad y el motivo al guardar', async () => {
    const wrapper = mount(StockMovementModal, { props: { item, type: 'entry', busy: false } })

    await wrapper.get('#stock-quantity').setValue(20)
    await wrapper.get('#stock-reason').setValue('  Compra semanal  ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('confirm')).toEqual([[20, 'Compra semanal']])
  })

  it('no deja guardar una entrada en cero', async () => {
    const wrapper = mount(StockMovementModal, { props: { item, type: 'entry', busy: false } })

    await wrapper.get('#stock-quantity').setValue(0)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('no deja guardar un ajuste igual al stock actual', () => {
    const wrapper = mount(StockMovementModal, { props: { item, type: 'adjustment', busy: false } })
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
