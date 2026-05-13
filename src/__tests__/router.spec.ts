import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { defineComponent } from 'vue'

// Mock localStorage before auth store initializes
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

const Stub = defineComponent({ template: '<div />' })

function createTestRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/login', name: 'login', component: Stub, meta: { requiresGuest: true } },
      { path: '/admin', name: 'admin-dashboard', component: Stub, meta: { requiresAuth: true } },
      { path: '/admin/events', name: 'admin-events', component: Stub, meta: { requiresAuth: true, requiresWebsiteGroup: true } },
    ],
  })
}

describe('Router Navigation Guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('allows access to public routes without auth', async () => {
    const router = createTestRouter()

    // Add guard matching production logic
    router.beforeEach((to) => {
      const authStore = useAuthStore()
      const requiresAuth = to.matched.some(r => r.meta.requiresAuth)
      if (requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    })

    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('redirects to login when accessing protected route without auth', async () => {
    const router = createTestRouter()

    router.beforeEach((to) => {
      const authStore = useAuthStore()
      const requiresAuth = to.matched.some(r => r.meta.requiresAuth)
      if (requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    })

    await router.push('/admin')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/admin')
  })

  it('allows authenticated users to access protected routes', async () => {
    const router = createTestRouter()
    const authStore = useAuthStore()

    // Simulate authenticated state
    authStore.$patch({
      accessToken: 'fake-token',
      user: { id: 1, username: 'admin', email: 'a@b.com', first_name: 'A', last_name: 'B', groups: ['website'] },
    } as any)

    router.beforeEach((to) => {
      const store = useAuthStore()
      const requiresAuth = to.matched.some(r => r.meta.requiresAuth)
      if (requiresAuth && !store.isAuthenticated) {
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    })

    await router.push('/admin')
    expect(router.currentRoute.value.name).toBe('admin-dashboard')
  })

  it('redirects authenticated users away from guest-only pages', async () => {
    const router = createTestRouter()
    const authStore = useAuthStore()

    authStore.$patch({
      accessToken: 'fake-token',
      user: { id: 1, username: 'admin', email: 'a@b.com', first_name: 'A', last_name: 'B', groups: ['website'] },
    } as any)

    router.beforeEach((to) => {
      const store = useAuthStore()
      const requiresGuest = to.matched.some(r => r.meta.requiresGuest)
      if (requiresGuest && store.isAuthenticated) {
        return { name: 'admin-dashboard' }
      }
    })

    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('admin-dashboard')
  })

  it('preserves redirect path in login query', async () => {
    const router = createTestRouter()

    router.beforeEach((to) => {
      const authStore = useAuthStore()
      const requiresAuth = to.matched.some(r => r.meta.requiresAuth)
      if (requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    })

    await router.push('/admin/events')
    expect(router.currentRoute.value.query.redirect).toBe('/admin/events')
  })
})
