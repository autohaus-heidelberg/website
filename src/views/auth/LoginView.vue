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
  background: #FFFFFF;
}

.login-container {
  background: white;
  padding: 3rem;
  border: 0.5rem solid #000000;
  width: 100%;
  max-width: 420px;
  transform: rotate(1deg);
}

h1 {
  margin-bottom: 0.5rem;
  text-align: center;
  font-size: 200%;
  color: #000000;
  font-weight: 900;
}

.subtitle {
  text-align: center;
  color: #000000;
  margin-bottom: 2rem;
  font-size: 0.95rem;
  font-weight: 600;
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
  color: #000000;
}

input {
  width: 100%;
  height: 3em;
  padding: 0.5rem;
  border: solid #000000;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #000000;
}

input:disabled {
  background: #FFFFFF;
  cursor: not-allowed;
  opacity: 0.6;
}

.error {
  color: #000000;
  font-size: 0.9rem;
  padding: 0.75rem;
  background: #FFFFFF;
  border: 0.25rem solid #000000;
}

.btn-primary {
  padding: 0.7em;
  background: #000000;
  color: #FFFFFF;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.4em;
  min-width: 280px;
  cursor: pointer;
  transition: filter 0.2s, transform 0.1s;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(120%);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.99);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.back-link {
  display: block;
  text-align: center;
  margin-top: 1.5rem;
  color: #000000;
  text-decoration: none;
  font-size: 0.95rem;
}

.back-link:hover {
  text-decoration: underline;
}
</style>
