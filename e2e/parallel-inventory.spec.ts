/**
 * E2E Tests: Parallel-tab FIFO inventory editing.
 *
 * Simulates two browser sessions (two different users/tabs) editing
 * Abrechnungen for different events that share the same drink stock.
 *
 * Requires: backend running on :8000, frontend on :5173
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { loginPage } from './helpers/auth'
import { getOrCreateAbrechnung, deleteAbrechnung, getStock, saveInventory } from './helpers/api'

// Use two real events from the database
const EVENT_A = 'zoomies-howileft'
const EVENT_B = 'fivebucks-poopootalks'
// Cola: upc=24, id=142
const DRINK_ID = 142
const DRINK_NAME = 'Cola'

test.describe('Parallel-tab FIFO inventory', () => {
  // UI tests need more time (multiple navigations + API calls)
  test.describe.configure({ timeout: 90_000 })
  let ctxA: BrowserContext
  let ctxB: BrowserContext
  let tabA: Page
  let tabB: Page
  let abrIdA: number | null = null
  let abrIdB: number | null = null

  test.beforeEach(async ({ browser }) => {
    // Clean up any existing abrechnungen for test events
    try {
      const abrA = await getOrCreateAbrechnung(EVENT_A)
      if (abrA?.id) { await deleteAbrechnung(abrA.id) }
    } catch { /* none exists */ }
    try {
      const abrB = await getOrCreateAbrechnung(EVENT_B)
      if (abrB?.id) { await deleteAbrechnung(abrB.id) }
    } catch { /* none exists */ }

    // Create two independent browser contexts (separate sessions)
    ctxA = await browser.newContext()
    ctxB = await browser.newContext()
    tabA = await ctxA.newPage()
    tabB = await ctxB.newPage()

    // Login both
    await loginPage(tabA)
    await loginPage(tabB)
  })

  test.afterEach(async () => {
    // Clean up abrechnungen to restore stock
    if (abrIdA) {
      try { await deleteAbrechnung(abrIdA) } catch { /* ok */ }
    }
    if (abrIdB) {
      try { await deleteAbrechnung(abrIdB) } catch { /* ok */ }
    }
    await ctxA.close()
    await ctxB.close()
  })

  test('Tab B editing different drink does not affect Tab A', async () => {
    // Navigate both tabs to their respective event accounting pages
    await tabA.goto(`/admin/events/${EVENT_A}?tab=accounting`, { waitUntil: 'domcontentloaded' })
    await tabB.goto(`/admin/events/${EVENT_B}?tab=accounting`, { waitUntil: 'domcontentloaded' })

    // Click on the "Inventur" sub-tab in each
    await tabA.locator('button:has-text("Inventur")').click()
    await tabB.locator('button:has-text("Inventur")').click()

    // Wait for Cola row to be visible (hideZeroStock hides 0-stock entries)
    await tabA.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first().waitFor({ state: 'visible', timeout: 30_000 })
    await tabB.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

    // Get initial stock for Cola
    const initialStock = await getStock(DRINK_ID)
    expect(initialStock).toBeGreaterThan(0)

    // Tab A: record Cola "Vorher" value
    const tabAColaBefore = await tabA.locator(
      `.inventory-row:has-text("${DRINK_NAME}") .col-inv-num`
    ).first().textContent()

    // Tab B: modify a DIFFERENT drink (e.g., Sprudel id=138)
    // Use the stepper to change Sprudel quantity
    const sprudelRow = tabB.locator('.inventory-row:has-text("Sprudel")')
    // Skip if not visible
    if (await sprudelRow.isVisible()) {
      const afterInput = sprudelRow.locator('input.qty-input').first()
      await afterInput.fill('0')
      // Wait for auto-save
      await tabB.waitForTimeout(3000)
    }

    // Tab A: Cola "Vorher" should NOT have changed
    const tabAColaAfter = await tabA.locator(
      `.inventory-row:has-text("${DRINK_NAME}") .col-inv-num`
    ).first().textContent()

    expect(tabAColaAfter).toBe(tabAColaBefore)
  })

  test('Both tabs consume same drink — correct final stock', async () => {
    const initialStock = await getStock(DRINK_ID)
    // Need at least 2 crates (48 bottles for upc=24)
    test.skip(initialStock < 48, `Need >= 48 Cola bottles, have ${initialStock}`)

    // Create abrechnungen via API for deterministic setup
    const abrA = await getOrCreateAbrechnung(EVENT_A)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdA = abrA.id
    abrIdB = abrB.id

    // Tab A consumes 1 crate (24 bottles)
    const resultA = await saveInventory(abrA.id, [{
      beverage_item: DRINK_ID,
      quantity_before: initialStock,
      quantity_after: initialStock - 24,
    }])
    expect(resultA.status).toBe(200)

    // Verify stock decreased by 24
    const stockAfterA = await getStock(DRINK_ID)
    expect(stockAfterA).toBe(initialStock - 24)

    // Tab B also consumes 1 crate (sends stale quantity_before)
    const resultB = await saveInventory(abrB.id, [{
      beverage_item: DRINK_ID,
      quantity_before: initialStock, // stale!
      quantity_after: initialStock - 24,
    }])
    expect(resultB.status).toBe(200)

    // Final stock should be initial - 48 (both consumed correctly)
    const finalStock = await getStock(DRINK_ID)
    expect(finalStock).toBe(initialStock - 48)
  })

  test('Tab A sees warning after Tab B consumes same drink', async () => {
    const initialStock = await getStock(DRINK_ID)
    test.skip(initialStock < 48, `Need >= 48 Cola bottles, have ${initialStock}`)

    // Navigate Tab A to its accounting page
    await tabA.goto(`/admin/events/${EVENT_A}?tab=accounting`, { waitUntil: 'domcontentloaded' })
    await tabA.locator('button:has-text("Inventur")').click()
    await tabA.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

    // Tab A: consume 1 crate via UI stepper (mobile card or desktop input)
    const colaRow = tabA.locator(`.inventory-row:has-text("${DRINK_NAME}")`)
    if (await colaRow.isVisible()) {
      const afterInput = colaRow.locator('input.qty-input').first()
      const currentValue = await afterInput.inputValue()
      const currentCrates = parseInt(currentValue || '0')
      await afterInput.fill(String(currentCrates - 1))
    }

    // Wait for auto-save to complete
    await tabA.waitForTimeout(3000)
    const abrA = await getOrCreateAbrechnung(EVENT_A)
    abrIdA = abrA.id

    // Tab B consumes 1 crate via API (simulates parallel user)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdB = abrB.id
    await saveInventory(abrB.id, [{
      beverage_item: DRINK_ID,
      quantity_before: initialStock,
      quantity_after: initialStock - 24,
    }])

    // Tab A: simulate returning to tab (trigger visibility change)
    await tabA.evaluate(() => {
      // Simulate visibilitychange event
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Wait for stock refresh + immediate save
    await tabA.waitForTimeout(2000)

    // Check that a warning appeared
    const warning = tabA.locator('text=Bestand extern geändert')
    const warningVisible = await warning.isVisible({ timeout: 5000 }).catch(() => false)
    expect(warningVisible).toBe(true)
  })

  test('Conflict when consuming more than available stock', async () => {
    const initialStock = await getStock(DRINK_ID)
    test.skip(initialStock < 24, `Need >= 24 Cola bottles, have ${initialStock}`)

    // Tab A consumes everything
    const abrA = await getOrCreateAbrechnung(EVENT_A)
    abrIdA = abrA.id
    await saveInventory(abrA.id, [{
      beverage_item: DRINK_ID,
      quantity_before: initialStock,
      quantity_after: 0,
    }])

    // Tab B tries to consume more than available (stale before)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdB = abrB.id
    const result = await saveInventory(abrB.id, [{
      beverage_item: DRINK_ID,
      quantity_before: initialStock, // stale — thinks there's still stock
      quantity_after: 0, // wants to consume all
    }])

    // Should get 400 with conflicts
    expect(result.status).toBe(400)
    expect(result.data.conflicts).toBeDefined()
    expect(result.data.conflicts.length).toBeGreaterThan(0)
    expect(result.data.conflicts[0].drink_id).toBe(DRINK_ID)
  })

  test('Decimal quantity (0.5 bottle) consumed correctly', async () => {
    // Rotwein (im Angebot) id=152, upc=1 — supports 0.5 bottle steps
    const ROTWEIN_ID = 152
    const stock = await getStock(ROTWEIN_ID)
    test.skip(stock < 1, `Need ≥1 Rotwein, have ${stock}`)

    const abrA = await getOrCreateAbrechnung(EVENT_A)
    abrIdA = abrA.id

    // Consume 0.5 bottle
    const r1 = await saveInventory(abrA.id, [{
      beverage_item: ROTWEIN_ID,
      quantity_before: stock,
      quantity_after: stock - 0.5,
    }])
    expect(r1.status).toBe(200)
    const entry = r1.data.inventory_entries.find((e: any) => e.beverage_item === ROTWEIN_ID)
    expect(Number(entry.consumed_quantity)).toBeCloseTo(0.5)
    expect(Number(entry.quantity_after)).toBeCloseTo(stock - 0.5)

    const newStock = await getStock(ROTWEIN_ID)
    expect(newStock).toBeCloseTo(stock - 0.5)
  })
})
