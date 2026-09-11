/**
 * E2E Test: a settlement save that gets NO HTTP response (timeout / connection
 * reset / edge 5xx) must NOT be silently ignored.
 *
 * Regression for the 2026-09 incident: two people edited the same Abrechnung;
 * a save timed out ("network error") at the external edge, the frontend
 * silently kept auto-saving, and a later write overwrote the co-editor's
 * entries (a drink line vanished). The fix pauses auto-save on an ambiguous
 * outcome, reconciles against the server, and — when the server has not moved
 * — shows a connection-error banner instead of blindly retrying.
 *
 * Here we abort the PUT (simulating the lost response) while letting the
 * reconcile GET through, and assert the connection banner appears.
 *
 * Requires: backend on :8000, frontend on :5173
 */
import { test, expect } from '@playwright/test'
import { loginPage } from './helpers/auth'
import { getOrCreateAbrechnung } from './helpers/api'

const EVENT = 'cherazade'
const COLA_NAME = 'Cola'

test.describe('Save network-error handling', () => {
  test.describe.configure({ timeout: 60_000 })

  test('a save with no response pauses auto-save and shows the connection banner', async ({ page }) => {
    // Ensure the settlement exists so the accounting view loads a real row.
    await getOrCreateAbrechnung(EVENT)

    await loginPage(page)

    // Fail every PUT to /api/abrechnungen/<id>/ as a network error, but let the
    // reconcile GET (same URL, GET) through so the client sees the server is
    // unchanged since its last confirmed save.
    await page.route('**/api/abrechnungen/**', route => {
      if (route.request().method() === 'PUT') return route.abort('failed')
      return route.continue()
    })

    await page.goto(`/admin/events/${EVENT}?tab=accounting`, { waitUntil: 'domcontentloaded' })
    await page.locator('button:has-text("Inventur")').click()
    const colaRow = page.locator(`.inventory-row:has-text("${COLA_NAME}")`).first()
    await colaRow.waitFor({ state: 'visible', timeout: 30_000 })

    // Edit the "after" quantity to trigger the debounced auto-save (which will
    // fail with a network error because the PUT is aborted).
    const afterInput = colaRow.locator('.col-inv-pair:not(.readonly-before) input.qty-input').first()
    const current = await afterInput.inputValue()
    await afterInput.fill(String((Number(current) || 0) + 1))
    await afterInput.blur()

    // The connection-error banner must appear (auto-save paused, not silent).
    await expect(page.getByText('Speichern fehlgeschlagen – keine Verbindung.')).toBeVisible({ timeout: 15_000 })

    // And it must NOT be misclassified as a parallel-edit (409) conflict — the
    // server did not move, so no stale-reload banner.
    await expect(page.getByText('Diese Abrechnung wurde parallel bearbeitet.')).toHaveCount(0)
  })
})
