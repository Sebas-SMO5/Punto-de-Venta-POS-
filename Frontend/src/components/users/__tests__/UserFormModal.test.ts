// @vitest-environment jsdom
// Pruebas de la ventana para crear y editar usuarios.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UserFormModal from '../UserFormModal.vue'
import type { ManagedUser } from '../../../services/users.service'

const existing: ManagedUser = {
  id: 9,
  username: 'mesero1',
  fullName: 'Laura Torres',
  email: null,
  role: 'waiter',
  active: true,
  createdAt: '2026-11-01T10:00:00.000Z',
}

describe('UserFormModal', () => {
  it('al crear, exige contraseña de al menos 8 caracteres', async () => {
    const wrapper = mount(UserFormModal, { props: { user: null, busy: false } })

    await wrapper.get('#user-username').setValue('cajero3')
    await wrapper.get('#user-fullname').setValue('Pedro Pérez')
    await wrapper.get('#user-password').setValue('123')

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Mínimo 8 caracteres')
  })

  it('al crear, envía los datos del nuevo usuario', async () => {
    const wrapper = mount(UserFormModal, { props: { user: null, busy: false } })

    await wrapper.get('#user-username').setValue('cajero3')
    await wrapper.get('#user-fullname').setValue('Pedro Pérez')
    await wrapper.get('#user-role').setValue('cashier')
    await wrapper.get('#user-password').setValue('Cajero12345')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save')).toEqual([
      [{ username: 'cajero3', fullName: 'Pedro Pérez', role: 'cashier', password: 'Cajero12345' }],
    ])
  })

  it('rechaza nombres de usuario con espacios o símbolos', async () => {
    const wrapper = mount(UserFormModal, { props: { user: null, busy: false } })

    await wrapper.get('#user-username').setValue('mal usuario!')

    expect(wrapper.text()).toContain('letras, números')
  })

  it('al editar, el usuario no se puede cambiar y la contraseña es opcional', async () => {
    const wrapper = mount(UserFormModal, { props: { user: existing, busy: false } })

    expect(wrapper.get('#user-username').attributes('disabled')).toBeDefined()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ fullName: 'Laura Torres', password: '' })
  })

  it('el botón Ver muestra la contraseña escrita', async () => {
    const wrapper = mount(UserFormModal, { props: { user: null, busy: false } })

    expect(wrapper.get('#user-password').attributes('type')).toBe('password')
    await wrapper.get('button[aria-label="Mostrar contraseña"]').trigger('click')
    expect(wrapper.get('#user-password').attributes('type')).toBe('text')
  })
})
