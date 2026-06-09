/**
 * E2E helper — direct API calls for test setup/teardown.
 * Uses the backend API to create/clean test data without going through the UI.
 */
const BASE_URL = 'http://localhost:8000'

let cachedToken: string | null = null

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken
  const resp = await fetch(`${BASE_URL}/api/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  })
  const data = await resp.json()
  cachedToken = data.access
  return cachedToken!
}

async function apiGet(path: string) {
  const token = await getToken()
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return resp.json()
}

async function apiPost(path: string, body: unknown) {
  const token = await getToken()
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: resp.status, data: await resp.json() }
}

async function apiPut(path: string, body: unknown) {
  const token = await getToken()
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: resp.status, data: await resp.json() }
}

async function apiDelete(path: string) {
  const token = await getToken()
  return fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

/**
 * Get stock for a specific drink.
 */
export async function getStock(drinkId: number): Promise<number> {
  const stock = await apiGet('/api/drinks/stock/')
  const entry = stock.find((s: any) => s.id === drinkId)
  return entry?.quantity ?? 0
}

/**
 * Get full stock list.
 */
export async function getAllStock(): Promise<Array<{ id: number; name: string; quantity: number; units_per_crate: number }>> {
  return apiGet('/api/drinks/stock/')
}

/**
 * Get or create an Abrechnung for a given event.
 */
export async function getOrCreateAbrechnung(eventId: string) {
  const resp = await apiGet(`/api/abrechnungen/by-event/${eventId}/`)
  return resp
}

/**
 * Delete an Abrechnung (restores all FIFO stock).
 */
export async function deleteAbrechnung(id: number) {
  return apiDelete(`/api/abrechnungen/${id}/`)
}

/**
 * Save inventory entries on an Abrechnung. The new chronological backend
 * accepts only `consumed_quantity`; `quantity_before` / `quantity_after`
 * are computed server-side and ignored on input.
 */
export async function saveInventory(abrechnungId: number, entries: Array<{
  beverage_item: number
  consumed_quantity: string | number
}>) {
  return apiPut(`/api/abrechnungen/${abrechnungId}/`, {
    inventory_entries: entries,
    revenues: [],
    expenses: [],
    splits: [],
    notes: '',
  })
}

/**
 * Reset remaining_quantity on all PurchaseItems for a drink to match quantity.
 */
export async function resetDrinkStock(drinkId: number) {
  // This uses a direct API call; for real cleanup we'd need a management command
  // For now, delete all abrechnungen that consumed from this drink
}

export { apiGet, apiPost, apiPut, apiDelete, getToken }
