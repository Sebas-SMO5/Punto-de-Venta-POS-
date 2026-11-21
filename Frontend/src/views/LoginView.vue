<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''

  if (!username.value.trim() || !password.value) {
    error.value = 'Ingrese usuario y contraseña'
    return
  }

  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      error.value = err.response.data?.mensaje || 'Credenciales incorrectas'
    } else {
      error.value = 'No se pudo conectar con el servidor'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="submit">
      <div class="login-brand">
        <div class="brand-icon">R</div>
        <div>
          <h2>Restaurante POS</h2>
          <span>Iniciar sesión</span>
        </div>
      </div>

      <label>
        Usuario
        <input v-model="username" type="text" autocomplete="username" autofocus />
      </label>

      <label>
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>

      <p v-if="error" class="login-error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Ingresando…' : 'Ingresar' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #f3f5f8;
}

.login-card {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 32px 28px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(20, 30, 50, 0.08);
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.login-brand h2 {
  margin: 0;
  font-size: 18px;
}

.login-brand span {
  color: #6b7789;
  font-size: 13px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #344054;
}

input {
  padding: 10px 12px;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  font-size: 14px;
}

input:focus {
  outline: 2px solid #31b981;
  border-color: transparent;
}

.login-error {
  margin: 0;
  color: #d14343;
  font-size: 13px;
}

button {
  padding: 11px;
  border: 0;
  border-radius: 8px;
  background: #1f2937;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
