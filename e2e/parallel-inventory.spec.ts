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

// Use two real events from the database. Both must be chronologically AFTER
// every Cola purchase so quantity_before is positive (Cola has stock at the
// event date), and ideally without other consumption between them so totals
// stay deterministic.
const EVENT_A = 'cherazade'           // 2026-06-20
const EVENT_B = 'goodflyingbirds'     // 2026-06-23
// Cola: upc=24, id=5
const DRINK_ID = 5
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
      consumed_quantity: 24,
    }])
    expect(resultA.status).toBe(200)

    // Verify stock decreased by 24
    const stockAfterA = await getStock(DRINK_ID)
    expect(stockAfterA).toBe(initialStock - 24)

    // Tab B also consumes 1 crate (independent — no stale-before inference needed
    // with the new chronological semantics; the client owns consumed_quantity).
    const resultB = await saveInventory(abrB.id, [{
      beverage_item: DRINK_ID,
      consumed_quantity: 24,
    }])
    expect(resultB.status).toBe(200)

    // Final stock should be initial - 48 (both consumed correctly)
    const finalStock = await getStock(DRINK_ID)
    expect(finalStock).toBe(initialStock - 48)
  })

  test('Tab B (later event) sees Vorher update after Tab A consumes earlier', async () => {
    // Chronological semantics: when Tab A (earlier event) consumes, Tab B
    // (later event) MUST see its Vorher decrease — Tab B's chronological
    // before is "purchases up to B's date − consumption of all earlier
    // events", and Tab A is one of those earlier events.
    //
    // EVENT_A is 2026-06-20 (cherazade), EVENT_B is 2026-06-23 (goodflyingbirds).
    const initialStock = await getStock(DRINK_ID)
    test.skip(initialStock < 48, `Need >= 48 Cola bottles, have ${initialStock}`)

    // Open Tab B (the later event) and read its initial Vorher.
    await tabB.goto(`/admin/events/${EVENT_B}?tab=accounting`, { waitUntil: 'domcontentloaded' })
    await tabB.locator('button:has-text("Inventur")').click()
    await tabB.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

    const tabBRow = tabB.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first()
    const vorherSelector = '.col-inv-pair.readonly-before .qty-display, .col-inv-pair.readonly-before .col-inv-num'
    const tabBVorherBefore = (await tabBRow.locator(vorherSelector).first().textContent())?.trim()

    // Tab A (earlier event) consumes 1 crate via API.
    const abrA = await getOrCreateAbrechnung(EVENT_A)
    abrIdA = abrA.id
    await saveInventory(abrA.id, [{
      beverage_item: DRINK_ID,
      consumed_quantity: 24,
    }])

    // Trigger Tab B's focus refresh.
    await tabB.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await tabB.waitForTimeout(2000)

    // Tab B's Vorher should now be smaller (24 less in bottles).
    const tabBVorherAfter = (await tabBRow.locator(vorherSelector).first().textContent())?.trim()
    expect(tabBVorherAfter).not.toBe(tabBVorherBefore)

    // Cleanup: pull Tab B's abr id
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdB = abrB.id
  })

  test('Conflict when consuming more than available stock', async () => {
    const initialStock = await getStock(DRINK_ID)
    test.skip(initialStock < 24, `Need >= 24 Cola bottles, have ${initialStock}`)

    // Tab A consumes everything
    const abrA = await getOrCreateAbrechnung(EVENT_A)
    abrIdA = abrA.id
    await saveInventory(abrA.id, [{
      beverage_item: DRINK_ID,
      consumed_quantity: initialStock,
    }])

    // Tab B tries to consume more than available — stock now empty
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdB = abrB.id
    const result = await saveInventory(abrB.id, [{
      beverage_item: DRINK_ID,
      consumed_quantity: initialStock, // wants to consume all again, but stock is 0
    }])

    // Should get 400 with conflicts
    expect(result.status).toBe(400)
    expect(result.data.conflicts).toBeDefined()
    expect(result.data.conflicts.length).toBeGreaterThan(0)
    expect(result.data.conflicts[0].drink_id).toBe(DRINK_ID)
  })

  test('Decimal quantity (0.5 bottle) consumed correctly', async () => {
    // Sekt Piccolo id=22, upc=1 — supports 0.5 bottle steps
    const BOTTLE_DRINK_ID = 22
    const stock = await getStock(BOTTLE_DRINK_ID)
    test.skip(stock < 1, `Need ≥1 Sekt Piccolo, have ${stock}`)

    const abrA = await getOrCreateAbrechnung(EVENT_A)
    abrIdA = abrA.id

    // Consume 0.5 bottle
    const r1 = await saveInventory(abrA.id, [{
      beverage_item: BOTTLE_DRINK_ID,
      consumed_quantity: 0.5,
    }])
    expect(r1.status).toBe(200)
    const entry = r1.data.inventory_entries.find((e: any) => e.beverage_item === BOTTLE_DRINK_ID)
    expect(Number(entry.consumed_quantity)).toBeCloseTo(0.5)
    // quantity_after is chronological (= chronological_before - 0.5), not necessarily
    // related to the live global stock. Just verify consumed_quantity took effect on stock:
    const newStock = await getStock(BOTTLE_DRINK_ID)
    expect(newStock).toBeCloseTo(stock - 0.5)
  })

  test('User intent (consumed_quantity) survives parallel-tab Vorher updates', async ({ browser }) => {
    // Henne-Ei regression test:
    // 1. Tab A enters consumed=6 via UI
    // 2. Tab B consumes 12 in parallel (via API)
    // 3. Tab A's auto-save fires → server returns updated Vorher
    // 4. Tab A's local consumed_quantity must REMAIN 6 (not be re-derived
    //    from a now-stale before/after pair).
    const initialStock = await getStock(DRINK_ID)
    test.skip(initialStock < 48, `Need ≥48 ${DRINK_NAME}, have ${initialStock}`)

    const ctx = await browser.newContext()
    const tabA = await ctx.newPage()
    try {
      await loginPage(tabA)
      await tabA.goto(`/admin/events/${EVENT_A}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabA.locator('button:has-text("Inventur")').click()
      await tabA.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      // Step 1: Tab A reduces "Nachher" by 6 bottles via the bottle stepper input.
      // For Cola (upc=24) the row has crate + bottle inputs; the bottles input
      // is the second .qty-input under the editable col-inv-pair.
      const colaRowA = tabA.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first()
      const afterBottlesInput = colaRowA.locator('.col-inv-pair:not(.readonly-before) input.qty-input').nth(1)
      const currentBottles = Number(await afterBottlesInput.inputValue())
      await afterBottlesInput.fill(String(currentBottles - 6))
      // Wait for first auto-save to complete (2s debounce + network)
      await tabA.waitForResponse(
        r => r.url().includes('/api/abrechnungen/') && r.request().method() === 'PUT' && r.status() === 200,
        { timeout: 10_000 }
      )

      // Step 2: parallel API call — Tab B consumes 12 from EVENT_B
      const abrB = await getOrCreateAbrechnung(EVENT_B)
      abrIdB = abrB.id
      const rB = await saveInventory(abrB.id, [{
        beverage_item: DRINK_ID,
        consumed_quantity: 12,
      }])
      expect(rB.status).toBe(200)

      // Step 3: trigger Tab A re-fresh. visibilitychange refreshes stock and
      // updates local Vorher (via refreshStockAndCorrect).
      await tabA.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await tabA.waitForTimeout(2000)

      // Step 4: re-fetch Tab A's abrechnung and verify consumed=6 persisted
      const abrA = await getOrCreateAbrechnung(EVENT_A)
      abrIdA = abrA.id
      const colaEntry = abrA.inventory_entries.find((e: any) => e.beverage_item === DRINK_ID)
      expect(colaEntry).toBeDefined()
      expect(Number(colaEntry.consumed_quantity)).toBe(6)
      // Stock dropped by 6 (Tab A) + 12 (Tab B) = 18
      const finalStock = await getStock(DRINK_ID)
      expect(finalStock).toBe(initialStock - 18)
    } finally {
      await ctx.close()
    }
  })

  test('Editing a later event does not change earlier event Vorher on focus refresh', async ({ browser }) => {
    // Regression test: when the user edits Tab B (later event chronologically)
    // and switches back to Tab A (earlier event), Tab A's chronological Vorher
    // must NOT change. Earlier events are not affected by later consumption.
    //
    // Background: refreshStockAndCorrect() previously computed
    //   newBefore = liveGlobalStock + ownConsumed
    // which is wrong — it pulls in consumption from chronologically-later
    // events, since the global stock reflects all settlements regardless of
    // event date.

    // EVENT_A is 2026-06-20 (cherazade), EVENT_B is 2026-06-23 (goodflyingbirds).
    // Tab A is the EARLIER event; Tab B is LATER. Editing Tab B must not
    // change Tab A's Vorher.
    const initialStock = await getStock(DRINK_ID)
    test.skip(initialStock < 48, `Need ≥48 ${DRINK_NAME}, have ${initialStock}`)

    const ctx = await browser.newContext()
    const tabA = await ctx.newPage()
    try {
      await loginPage(tabA)
      await tabA.goto(`/admin/events/${EVENT_A}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabA.locator('button:has-text("Inventur")').click()
      await tabA.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      // Read Tab A's chronological Vorher BEFORE Tab B edits anything.
      const tabARow = tabA.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first()
      const tabAVorherBefore = await tabARow.locator('.col-inv-pair.readonly-before .qty-display, .col-inv-pair.readonly-before .col-inv-num').first().textContent()

      // Tab B (later event) consumes via API, reducing global stock.
      const abrB = await getOrCreateAbrechnung(EVENT_B)
      abrIdB = abrB.id
      const rB = await saveInventory(abrB.id, [{
        beverage_item: DRINK_ID,
        consumed_quantity: 24, // 1 crate
      }])
      expect(rB.status).toBe(200)

      // Trigger Tab A's focus refresh.
      await tabA.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await tabA.waitForTimeout(2000)

      // Tab A's chronological Vorher MUST be unchanged.
      const tabAVorherAfter = await tabARow.locator('.col-inv-pair.readonly-before .qty-display, .col-inv-pair.readonly-before .col-inv-num').first().textContent()
      expect(tabAVorherAfter?.trim()).toBe(tabAVorherBefore?.trim())

      const abrA = await getOrCreateAbrechnung(EVENT_A)
      abrIdA = abrA.id
    } finally {
      await ctx.close()
    }
  })

  test('Resetting consumed back to 0 unmarks the row as confirmed', async ({ browser }) => {
    // Visual regression: the inv-confirmed (yellow) class should toggle off
    // when the user resets consumed back to 0.
    const initialStock = await getStock(DRINK_ID)
    test.skip(initialStock < 24, `Need ≥24 ${DRINK_NAME}, have ${initialStock}`)

    const ctx = await browser.newContext()
    const tabA = await ctx.newPage()
    try {
      await loginPage(tabA)
      await tabA.goto(`/admin/events/${EVENT_A}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabA.locator('button:has-text("Inventur")').click()
      await tabA.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      const colaRowA = tabA.locator(`.inventory-row:has-text("${DRINK_NAME}")`).first()
      const afterBottlesInput = colaRowA.locator('.col-inv-pair:not(.readonly-before) input.qty-input').nth(1)
      const startBottles = Number(await afterBottlesInput.inputValue())

      // Step 1: reduce after by 1 → consumed = 1, row should be inv-confirmed
      await afterBottlesInput.fill(String(startBottles - 1))
      await tabA.waitForTimeout(300)
      await expect(colaRowA).toHaveClass(/inv-confirmed/)

      // Step 2: reset back to original → consumed = 0, row should be inv-pending
      await afterBottlesInput.fill(String(startBottles))
      await tabA.waitForTimeout(300)
      await expect(colaRowA).toHaveClass(/inv-pending/)
      await expect(colaRowA).not.toHaveClass(/inv-confirmed/)

      const abrA = await getOrCreateAbrechnung(EVENT_A)
      abrIdA = abrA.id
    } finally {
      await ctx.close()
    }
  })

  test('User input does not jump when a parallel save returns 400 conflict', async ({ browser }) => {
    // Regression test for the user-reported bug:
    // Tab A enters a Nachher-value via UI. Tab B, in parallel, consumes enough
    // from the same drink (via API) to push global stock below what Tab A
    // implicitly claimed. Tab A's auto-save fires → server returns 400.
    //
    // BEFORE the fix: the conflict handler rewrote Tab A's local
    // quantity_before / quantity_after, causing the visible input to "jump"
    // without user action.
    //
    // AFTER the fix: Tab A's input-field value remains exactly what the user
    // typed; only a warning surfaces. The user retains full control.

    const SEKT_ID = 22
    const SEKT_NAME = 'Sekt Piccolo'
    const globalStock = await getStock(SEKT_ID)
    test.skip(globalStock < 4, `Need ≥4 ${SEKT_NAME}, have ${globalStock}`)

    const ctx = await browser.newContext()
    const tabA = await ctx.newPage()
    try {
      await loginPage(tabA)
      await tabA.goto(`/admin/events/${EVENT_A}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabA.locator('button:has-text("Inventur")').click()
      await tabA.locator(`.inventory-row:has-text("${SEKT_NAME}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      const sektRow = tabA.locator(`.inventory-row:has-text("${SEKT_NAME}")`).first()

      // Read Tab A's chronological "Vorher" from the UI (not the global stock,
      // which differs in chronological-display mode).
      const vorherText = await sektRow.locator('.col-inv-pair.readonly-before .qty-display').first().textContent()
      const tabAVorher = parseFloat(vorherText?.trim() ?? '0')
      test.skip(tabAVorher < 4, `Tab A's chronological Vorher must be ≥4, got ${tabAVorher}`)

      // Tab A: type Nachher = Vorher - 1 → consumed=1.  Trigger save via
      // auto-save (blur + wait for debounce) instead of a save button.
      const afterInput = sektRow.locator('.col-inv-pair.bottle-mode:not(.readonly-before) input.qty-input').first()
      const firstNachher = String(tabAVorher - 1)
      await afterInput.fill(firstNachher)
      const wait200 = tabA.waitForResponse(
        r => r.url().includes('/api/abrechnungen/') && r.request().method() === 'PUT' && r.status() === 200,
        { timeout: 15_000 }
      )
      await afterInput.blur()
      await wait200

      // Tab B (via API) consumes the rest of global stock so it's near zero.
      const abrB = await getOrCreateAbrechnung(EVENT_B)
      abrIdB = abrB.id
      const stockAfterTabA = await getStock(SEKT_ID)
      const rB = await saveInventory(abrB.id, [{
        beverage_item: SEKT_ID,
        consumed_quantity: stockAfterTabA,
      }])
      expect(rB.status).toBe(200)
      // Now global stock = 0; Tab A holds consumed=1.

      // Tab A: type Nachher = 0 → consumed = Vorher (e.g. 7) — way more than
      // available. Trigger an explicit save → expect 400 conflict.
      // Tab A: type Nachher = 0 → consumed = Vorher (e.g. 7) — way more than
      // available. Trigger an explicit save → expect 400 conflict.
      const conflictNachher = '0'
      await afterInput.fill(conflictNachher)
      const wait400 = tabA.waitForResponse(
        r => r.url().includes('/api/abrechnungen/') && r.request().method() === 'PUT' && r.status() === 400,
        { timeout: 15_000 }
      )
      await afterInput.blur()
      await wait400
      // Allow post-conflict UI handling to settle.
      await tabA.waitForTimeout(500)

      // CRITICAL: the input field must still show the user-typed value.
      // Re-locate the input fresh — the row may have re-rendered after the
      // 400 error displayed.
      const afterInputAfter = sektRow.locator('.col-inv-pair.bottle-mode:not(.readonly-before) input.qty-input').first()
      const afterValue = await afterInputAfter.inputValue({ timeout: 5_000 })
      expect(afterValue).toBe(conflictNachher)

      // Cleanup: pull abr id for teardown
      const abrA = await getOrCreateAbrechnung(EVENT_A)
      abrIdA = abrA.id
    } finally {
      await ctx.close()
    }
  })
})
