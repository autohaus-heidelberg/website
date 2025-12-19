<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = 'Please enter username and password'
    return
  }

  isLoading.value = true
  error.value = ''

  const success = await authStore.login({
    username: username.value,
    password: password.value
  })

  isLoading.value = false

  if (success) {
    const redirect = route.query.redirect as string || '/admin'
    router.push(redirect)
  } else {
    error.value = authStore.error || 'Login failed'
  }
}
</script>

<template lang="pug">
.login-page
  .login-container
    h1 Login
    p.subtitle Backend Management

    form.login-form(@submit.prevent="handleLogin")
      .form-group
        label(for="username") Username
        input#username(
          v-model="username"
          type="text"
          required
          autocomplete="username"
          :disabled="isLoading"
          placeholder="Enter your username"
        )

      .form-group
        label(for="password") Password
        input#password(
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          :disabled="isLoading"
          placeholder="Enter your password"
        )

      .error(v-if="error") {{ error }}

      button.btn-primary(
        type="submit"
        :disabled="isLoading"
      )
        span(v-if="isLoading") Logging in...
        span(v-else) Login

    router-link.back-link(to="/") ← Back to Home
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-container {
  background: white;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 420px;
}

h1 {
  margin-bottom: 0.5rem;
  text-align: center;
  font-size: 2rem;
  color: #333;
}

.subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 2rem;
  font-size: 0.95rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
}

input {
  padding: 0.875rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

input:focus {
  outline: none;
  border-color: #667eea;
}

input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.error {
  color: #d32f2f;
  font-size: 0.9rem;
  padding: 0.75rem;
  background: #ffebee;
  border-radius: 6px;
  border-left: 4px solid #d32f2f;
}

.btn-primary {
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.back-link {
  display: block;
  text-align: center;
  margin-top: 1.5rem;
  color: #667eea;
  text-decoration: none;
  font-size: 0.95rem;
}

.back-link:hover {
  text-decoration: underline;
}
</style>
