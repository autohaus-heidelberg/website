/**
 * E2E auth helper — logs in via API and sets JWT tokens in localStorage.
 * Used by all E2E tests to authenticate as a user in the 'website' group.
 */
import { type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:8000'
const USERNAME = 'admin'
const PASSWORD = 'admin'

export interface AuthTokens {
  access: string
  refresh: string
}

/**
 * Get JWT tokens from the backend API.
 */
export async function getTokens(): Promise<AuthTokens> {
  const resp = await fetch(`${BASE_URL}/api/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  if (!resp.ok) {
    throw new Error(`Login failed: ${resp.status} ${await resp.text()}`)
  }
  return resp.json()
}

/**
 * Authenticate a Playwright page by setting JWT tokens in localStorage
 * before navigating.
 */
export async function loginPage(page: Page): Promise<void> {
  const tokens = await getTokens()

  // Navigate to origin first (localStorage is origin-scoped)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((t) => {
    localStorage.setItem('access_token', t.access)
    localStorage.setItem('refresh_token', t.refresh)
  }, tokens)
}
