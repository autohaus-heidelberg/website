<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import FanzineNav from '@/components/FanzineNav.vue'
import { ransomChars } from '@/utils/ransom'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = 'Bitte Benutzername und Passwort eingeben'
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
    error.value = authStore.error || 'Anmeldung fehlgeschlagen'
  }
}
</script>

<template lang="pug">
.fz
  FanzineNav(label="Login")
  header.fz-page-head
    h1.fz-page-title(aria-label="Login")
      span.fz-line(aria-hidden="true")
        span.fz-ch(v-for="(c, i) in ransomChars('Login')" :key="i" :class="c.cls") {{ c.ch }}
    p.fz-page-sub Nur für den Verein: Hier geht's hinter die Kulissen.
  .fz-login
    form.fz-box.login-form(@submit.prevent="handleLogin")
      .form-group
        label(for="username") Benutzername
        input#username(
          v-model="username"
          type="text"
          required
          autocomplete="username"
          :disabled="isLoading"
        )

      .form-group
        label(for="password") Passwort
        input#password(
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          :disabled="isLoading"
        )

      .form-error(v-if="error" role="alert") {{ error }}

      button.btn-submit(type="submit" :disabled="isLoading")
        | {{ isLoading ? 'Anmeldung läuft...' : 'Anmelden' }}
</template>

<style scoped>
.fz-login { max-width: 32rem; margin-top: 2.5rem; }

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-group label {
  font-weight: 900;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

input {
  padding: 0.6rem 0.75rem;
  border: 0.2rem solid black;
  border-radius: 0;
  background: #fff;
  font-size: 1rem;
  font-family: inherit;
}

input:focus {
  outline: none;
  box-shadow: 0.3rem 0.3rem 0 black;
}

input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-error {
  border: 0.2rem solid black;
  border-left: 0.8rem solid var(--alert);
  padding: 0.75rem;
  font-weight: 700;
}

.btn-submit {
  align-self: flex-start;
  padding: 0.6em 1.4em;
  font-weight: 900;
  font-size: 0.95rem;
  text-transform: uppercase;
  cursor: pointer;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
