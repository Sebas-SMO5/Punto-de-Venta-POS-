// Servicio de usuarios (solo administrador). Necesita conexión: crear
// usuarios o cambiar contraseñas no se deja para "después" por seguridad.
import { api } from './api'
import type { Role } from '../types/models'

export interface ManagedUser {
  id: number
  username: string
  fullName: string
  email: string | null
  role: Role
  active: boolean
  createdAt: string
}

export interface NewUser {
  username: string
  password: string
  fullName: string
  role: Role
  email?: string
}

export type UserChanges = Partial<Pick<ManagedUser, 'fullName' | 'role' | 'active'>> & {
  password?: string
}

export const usersService = {
  async getAll(): Promise<ManagedUser[]> {
    const { data } = await api.get<ManagedUser[]>('/users')
    return data
  },

  async create(user: NewUser): Promise<ManagedUser> {
    const { data } = await api.post<ManagedUser>('/users', user)
    return data
  },

  async update(id: number, changes: UserChanges): Promise<ManagedUser> {
    const { data } = await api.patch<ManagedUser>(`/users/${id}`, changes)
    return data
  },
}
