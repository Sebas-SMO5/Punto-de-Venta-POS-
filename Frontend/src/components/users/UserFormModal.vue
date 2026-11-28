<script setup lang="ts">
// Ventana para crear un usuario o editar uno existente.
// Al editar, la contraseña es opcional: si se deja vacía no se cambia.
import { computed, ref } from 'vue'
import { ROLE_LABELS, type Role } from '../../types/models'
import type { ManagedUser } from '../../services/users.service'

export interface UserFormValue {
  username: string
  fullName: string
  role: Role
  password: string
}

const props = defineProps<{
  user: ManagedUser | null
  busy: boolean
}>()

const emit = defineEmits<{
  save: [value: UserFormValue]
  close: []
}>()

const isNew = computed(() => props.user === null)
const roles = Object.entries(ROLE_LABELS) as [Role, string][]

const form = ref<UserFormValue>({
  username: props.user?.username ?? '',
  fullName: props.user?.fullName ?? '',
  role: props.user?.role ?? 'waiter',
  password: '',
})

const showPassword = ref(false)

const usernameValid = computed(() => /^[a-zA-Z0-9_.-]{3,50}$/.test(form.value.username))
const passwordValid = computed(() =>
  isNew.value ? form.value.password.length >= 8 : form.value.password === '' || form.value.password.length >= 8,
)
const valid = computed(() => usernameValid.value && form.value.fullName.trim() !== '' && passwordValid.value)

function submit(): void {
  if (valid.value && !props.busy) emit('save', { ...form.value, fullName: form.value.fullName.trim() })
}
</script>

<template>
  <div class="modal-overlay" @click.self="!busy && emit('close')">
    <form class="panel modal-card" role="dialog" aria-labelledby="user-form-title" @submit.prevent="submit">
      <h3 id="user-form-title">{{ isNew ? 'Nuevo usuario' : `Editar ${user?.username}` }}</h3>

      <label class="field-label" for="user-username">Usuario</label>
      <input
        id="user-username"
        v-model.trim="form.username"
        class="search-input"
        autocomplete="off"
        :disabled="busy || !isNew"
        required
      />
      <small v-if="isNew && form.username && !usernameValid" class="hint">
        Mínimo 3 caracteres: letras, números, punto, guion o guion bajo.
      </small>

      <label class="field-label" for="user-fullname">Nombre completo</label>
      <input id="user-fullname" v-model="form.fullName" class="search-input" maxlength="100" :disabled="busy" required />

      <label class="field-label" for="user-role">Rol</label>
      <select id="user-role" v-model="form.role" class="search-input" :disabled="busy">
        <option v-for="[value, label] in roles" :key="value" :value="value">{{ label }}</option>
      </select>

      <label class="field-label" for="user-password">
        {{ isNew ? 'Contraseña' : 'Nueva contraseña (opcional)' }}
      </label>
      <div class="password-field">
        <input
          id="user-password"
          v-model="form.password"
          class="search-input"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :disabled="busy"
          :required="isNew"
        />
        <button
          type="button"
          class="table-action"
          :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showPassword = !showPassword"
        >
          {{ showPassword ? 'Ocultar' : 'Ver' }}
        </button>
      </div>
      <small v-if="form.password && !passwordValid" class="hint">Mínimo 8 caracteres.</small>

      <div class="product-actions modal-actions">
        <button type="button" class="table-action" :disabled="busy" @click="emit('close')">Cancelar</button>
        <button type="submit" class="primary-button" :disabled="!valid || busy">
          {{ busy ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
}

.modal-card {
  width: 100%;
  max-width: 440px;
  padding: 24px;
}

.modal-card h3 {
  margin-top: 0;
}

.field-label {
  display: block;
  margin: 14px 0 6px;
  font-weight: 600;
}

.modal-card input,
.modal-card select {
  width: 100%;
  box-sizing: border-box;
}

.password-field {
  display: flex;
  gap: 8px;
}

.hint {
  display: block;
  margin-top: 4px;
  color: #b42318;
  font-size: 12px;
}

.modal-actions {
  justify-content: flex-end;
  margin-top: 22px;
  gap: 10px;
}

.modal-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
