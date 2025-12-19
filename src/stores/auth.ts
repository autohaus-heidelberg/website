import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService, type User, type LoginCredentials } from '@/services/auth'

export const useAuthStore = defineStore('auth', () => {
  // State
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'))
  const user = ref<User | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
  const hasWebsiteGroup = computed(() => user.value?.groups.includes('website') ?? false)
  const canManage = computed(() => isAuthenticated.value && hasWebsiteGroup.value)

  // Actions
  async function login(credentials: LoginCredentials): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const tokens = await authService.login(credentials)

      accessToken.value = tokens.access
      refreshToken.value = tokens.refresh

      authService.storeTokens(tokens)

      await fetchUser()

      return true
    } catch (e: any) {
      error.value = e.response?.data?.detail || e.message || 'Login failed'
      logout()
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function fetchUser() {
    if (!accessToken.value) return

    try {
      user.value = await authService.getCurrentUser()
    } catch (e: any) {
      console.error('Failed to fetch user:', e)
      logout()
    }
  }

  async function refreshTokens(): Promise<boolean> {
    if (!refreshToken.value) return false

    try {
      const tokens = await authService.refreshToken(refreshToken.value)

      accessToken.value = tokens.access
      refreshToken.value = tokens.refresh

      authService.storeTokens(tokens)

      return true
    } catch (e) {
      console.error('Token refresh failed:', e)
      logout()
      return false
    }
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null

    authService.logout()
  }

  async function initialize() {
    if (accessToken.value) {
      await fetchUser()
    }
  }

  return {
    // State
    accessToken,
    refreshToken,
    user,
    isLoading,
    error,

    // Getters
    isAuthenticated,
    hasWebsiteGroup,
    canManage,

    // Actions
    login,
    logout,
    refreshTokenFn: refreshTokens,
    fetchUser,
    initialize,
  }
})
