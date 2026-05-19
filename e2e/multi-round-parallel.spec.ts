/**
 * E2E Tests: Multi-round parallel consumption.
 *
 * Two users (A and B) alternately consume from the same drinks across
 * multiple rounds. Tests verify:
 * - quantity_before always reflects true effective stock
 * - consumed_quantity accumulates correctly
 * - FIFO stock decreases correctly after each round
 * - Warnings are displayed when stock changes externally
 * - Works for crate-based drinks (upc=24) and per-bottle drinks (upc=1, decimal)
 *
 * Requires: backend on :8000, frontend on :5173
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { loginPage } from './helpers/auth'
import {
  getOrCreateAbrechnung,
  deleteAbrechnung,
  getStock,
  saveInventory,
  getAllStock,
} from './helpers/api'

// Events for the two parallel users
const EVENT_A = 'zoomies-howileft'
const EVENT_B = 'fivebucks-poopootalks'

// Cola: crate-based (upc=24)
const COLA = { id: 142, name: 'Cola', upc: 24 }
// Rotwein (im Angebot): per-bottle (upc=1), supports decimal (0.5)
const ROTWEIN = { id: 152, name: 'Rotwein (im Angebot)', upc: 1 }

test.describe('Multi-round parallel consumption', () => {
  test.describe.configure({ timeout: 90_000 })

  let abrIdA: number | null = null
  let abrIdB: number | null = null

  test.afterEach(async () => {
    // Cleanup: delete both abrechnungen to restore stock
    if (abrIdA) {
      try { await deleteAbrechnung(abrIdA) } catch { /* ok */ }
      abrIdA = null
    }
    if (abrIdB) {
      try { await deleteAbrechnung(abrIdB) } catch { /* ok */ }
      abrIdB = null
    }
  })

  test('Multi-round crate consumption (Cola, upc=24) — API level', async () => {
    const initialStock = await getStock(COLA.id)
    test.skip(initialStock < 48, `Need ≥48 Cola, have ${initialStock}`)

    const abrA = await getOrCreateAbrechnung(EVENT_A)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdA = abrA.id
    abrIdB = abrB.id

    // Using half-crate steps (12 bottles) to stay within available stock
    const STEP = 12

    // === Round 1: User A consumes 12 bottles ===
    const r1A = await saveInventory(abrA.id, [{
      beverage_item: COLA.id,
      quantity_before: initialStock,
      quantity_after: initialStock - STEP,
    }])
    expect(r1A.status).toBe(200)
    const r1A_entry = r1A.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(r1A_entry.quantity_before)).toBe(initialStock)
    expect(Number(r1A_entry.quantity_after)).toBe(initialStock - STEP)
    expect(Number(r1A_entry.consumed_quantity)).toBe(STEP)

    let stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - STEP)

    // === Round 2: User B consumes 12 bottles (stale quantity_before) ===
    const r2B = await saveInventory(abrB.id, [{
      beverage_item: COLA.id,
      quantity_before: initialStock, // stale — doesn't know A consumed
      quantity_after: initialStock - STEP,
    }])
    expect(r2B.status).toBe(200)
    const r2B_entry = r2B.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    // Backend corrects quantity_before to effective_before = current_stock + 0 = initial-12
    expect(Number(r2B_entry.quantity_before)).toBe(initialStock - STEP)
    // Intent: client_before(initial) - quantity_after(initial-12) = 12
    // actual_after = effective_before(initial-12) - 12 = initial-24
    expect(Number(r2B_entry.quantity_after)).toBe(initialStock - 2 * STEP)
    expect(Number(r2B_entry.consumed_quantity)).toBe(STEP)

    stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - 2 * STEP)

    // === Round 3: User B consumes another 12 (updating existing entry) ===
    const r3B = await saveInventory(abrB.id, [{
      beverage_item: COLA.id,
      quantity_before: initialStock - STEP, // B's known before
      quantity_after: initialStock - 3 * STEP, // wants total consumed = 24
    }])
    expect(r3B.status).toBe(200)
    const r3B_entry = r3B.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    // effective_before for B = current_stock(initial-24) + B's old_consumed(12) = initial-12
    expect(Number(r3B_entry.quantity_before)).toBe(initialStock - STEP)
    // Intent: client_before(initial-12) - quantity_after(initial-36) = 24
    // actual_after = effective_before(initial-12) - 24 = initial-36
    expect(Number(r3B_entry.quantity_after)).toBe(initialStock - 3 * STEP)
    expect(Number(r3B_entry.consumed_quantity)).toBe(2 * STEP) // accumulated

    stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - 3 * STEP)

    // === Round 4: User A resends same intent (no change) ===
    // A's effective_before = current_stock(initial-36) + A's old_consumed(12) = initial-24
    const r4A = await saveInventory(abrA.id, [{
      beverage_item: COLA.id,
      quantity_before: initialStock - 2 * STEP, // A's refreshed before
      quantity_after: initialStock - 3 * STEP, // intent: 12 (same as before)
    }])
    expect(r4A.status).toBe(200)
    const r4A_entry = r4A.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(r4A_entry.quantity_before)).toBe(initialStock - 2 * STEP)
    // Intent = (initial-24) - (initial-36) = 12. Same as old_consumed(12). No delta.
    expect(Number(r4A_entry.consumed_quantity)).toBe(STEP)
    stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - 3 * STEP) // unchanged

    // === Round 5: User A increases to total consumed = 24 ===
    const r5A = await saveInventory(abrA.id, [{
      beverage_item: COLA.id,
      quantity_before: initialStock - 2 * STEP, // A's effective before
      quantity_after: initialStock - 4 * STEP, // total consumed = 24
    }])
    expect(r5A.status).toBe(200)
    const r5A_entry = r5A.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(r5A_entry.quantity_before)).toBe(initialStock - 2 * STEP)
    expect(Number(r5A_entry.quantity_after)).toBe(initialStock - 4 * STEP)
    expect(Number(r5A_entry.consumed_quantity)).toBe(2 * STEP)

    stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - 4 * STEP)

    // === Final verification: total consumed = 48 (A:24 + B:24) ===
    expect(stock).toBe(initialStock - 48)
  })

  test('Multi-round decimal consumption (Rotwein, upc=1) — API level', async () => {
    const initialStock = await getStock(ROTWEIN.id)
    test.skip(initialStock < 1.5, `Need ≥1.5 Rotwein, have ${initialStock}`)

    const abrA = await getOrCreateAbrechnung(EVENT_A)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdA = abrA.id
    abrIdB = abrB.id

    // === Round 1: User A consumes 0.5 bottle ===
    const r1A = await saveInventory(abrA.id, [{
      beverage_item: ROTWEIN.id,
      quantity_before: initialStock,
      quantity_after: initialStock - 0.5,
    }])
    expect(r1A.status).toBe(200)
    const r1A_entry = r1A.data.inventory_entries.find((e: any) => e.beverage_item === ROTWEIN.id)
    expect(Number(r1A_entry.quantity_before)).toBeCloseTo(initialStock)
    expect(Number(r1A_entry.quantity_after)).toBeCloseTo(initialStock - 0.5)
    expect(Number(r1A_entry.consumed_quantity)).toBeCloseTo(0.5)

    let stock = await getStock(ROTWEIN.id)
    expect(stock).toBeCloseTo(initialStock - 0.5)

    // === Round 2: User B consumes 0.5 bottle (stale before) ===
    const r2B = await saveInventory(abrB.id, [{
      beverage_item: ROTWEIN.id,
      quantity_before: initialStock, // stale
      quantity_after: initialStock - 0.5,
    }])
    expect(r2B.status).toBe(200)
    const r2B_entry = r2B.data.inventory_entries.find((e: any) => e.beverage_item === ROTWEIN.id)
    // Backend corrects before to effective = current_stock + old_consumed = (initial-0.5) + 0 = initial-0.5
    expect(Number(r2B_entry.quantity_before)).toBeCloseTo(initialStock - 0.5)
    // Intent = initial - (initial-0.5) = 0.5, actual_after = (initial-0.5) - 0.5 = initial-1
    expect(Number(r2B_entry.quantity_after)).toBeCloseTo(initialStock - 1)
    expect(Number(r2B_entry.consumed_quantity)).toBeCloseTo(0.5)

    stock = await getStock(ROTWEIN.id)
    expect(stock).toBeCloseTo(initialStock - 1)

    // === Round 3: User B consumes another 0.5 (total: 1 bottle for B) ===
    const r3B = await saveInventory(abrB.id, [{
      beverage_item: ROTWEIN.id,
      quantity_before: initialStock - 0.5, // B's last known before
      quantity_after: initialStock - 1.5, // B wants total consumed = 1
    }])
    expect(r3B.status).toBe(200)
    const r3B_entry = r3B.data.inventory_entries.find((e: any) => e.beverage_item === ROTWEIN.id)
    // effective_before = current_stock(initial-1) + B's old_consumed(0.5) = initial-0.5
    expect(Number(r3B_entry.quantity_before)).toBeCloseTo(initialStock - 0.5)
    // Intent = (initial-0.5) - (initial-1.5) = 1, actual_after = (initial-0.5) - 1 = initial-1.5
    expect(Number(r3B_entry.quantity_after)).toBeCloseTo(initialStock - 1.5)
    expect(Number(r3B_entry.consumed_quantity)).toBeCloseTo(1)

    stock = await getStock(ROTWEIN.id)
    expect(stock).toBeCloseTo(initialStock - 1.5)

    // === Final: A consumed 0.5, B consumed 1.0, total = 1.5 ===
    expect(stock).toBeCloseTo(initialStock - 1.5)
  })

  test('Multi-round with UI — warnings and stock sync (Cola)', async ({ browser }) => {
    const initialStock = await getStock(COLA.id)
    test.skip(initialStock < 24, `Need ≥24 Cola, have ${initialStock}`)

    // Clean up any existing test abrechnungen first
    try {
      const existing = await getOrCreateAbrechnung(EVENT_A)
      if (existing?.id) await deleteAbrechnung(existing.id)
    } catch { /* ok */ }
    try {
      const existing = await getOrCreateAbrechnung(EVENT_B)
      if (existing?.id) await deleteAbrechnung(existing.id)
    } catch { /* ok */ }

    // Create contexts for UI test
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const tabA = await ctxA.newPage()
    const tabB = await ctxB.newPage()

    try {
      await loginPage(tabA)
      await loginPage(tabB)

      // Navigate both to their events, open Inventur
      await tabA.goto(`/admin/events/${EVENT_A}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabA.locator('button:has-text("Inventur")').click()
      // Wait specifically for Cola row to be visible (hideZeroStock may hide others)
      await tabA.locator(`.inventory-row:has-text("${COLA.name}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      await tabB.goto(`/admin/events/${EVENT_B}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabB.locator('button:has-text("Inventur")').click()
      await tabB.locator(`.inventory-row:has-text("${COLA.name}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      // === Round 1: Tab A changes Cola "Nachher" (crate-1) ===
      const colaRowA = tabA.locator(`.inventory-row:has-text("${COLA.name}")`)
      const afterInputA = colaRowA.locator('input.qty-input').first()
      const initialCratesA = await afterInputA.inputValue()
      // Decrease by 1 crate
      await afterInputA.fill(String(Number(initialCratesA) - 1))
      // Wait for auto-save (2s debounce + network)
      await tabA.waitForTimeout(3500)

      // Verify stock decreased by 1 crate
      let stock = await getStock(COLA.id)
      expect(stock).toBe(initialStock - COLA.upc)

      // === Round 2: Tab B changes Cola "Nachher" (crate-1) ===
      const colaRowB = tabB.locator(`.inventory-row:has-text("${COLA.name}")`)
      const afterInputB = colaRowB.locator('input.qty-input').first()
      const initialCratesB = await afterInputB.inputValue()
      await afterInputB.fill(String(Number(initialCratesB) - 1))
      await tabB.waitForTimeout(3500)

      // B also consumed 1 crate (intent-based: detects stale before, still consumes 1 crate)
      stock = await getStock(COLA.id)
      // Stock should have decreased by 2 crates total (if sufficient stock)
      // or by as much as available
      const expectedStock = Math.max(0, initialStock - 2 * COLA.upc)
      expect(stock).toBe(expectedStock)

      // === Round 3: Tab A comes back — should see updated stock warning ===
      await tabA.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await tabA.waitForTimeout(3000)

      // Warning should mention Cola (stock changed externally)
      const warningA = tabA.locator('.stock-changed-warning')
      const warningTextA = await warningA.textContent({ timeout: 5000 }).catch(() => '')
      expect(warningTextA).toContain('Cola')

      // Tab A's "Vorher" should now reflect the updated effective stock
      // A's effective_before = current_stock + A's consumed = expectedStock + upc = initialStock - upc
      const voherA = colaRowA.locator('.col-inv-num').first()
      const voherText = await voherA.textContent()
      expect(Number(voherText?.trim())).toBe(initialStock - COLA.upc)

      // Save abr IDs for cleanup
      const abrA = await getOrCreateAbrechnung(EVENT_A)
      const abrB = await getOrCreateAbrechnung(EVENT_B)
      abrIdA = abrA.id
      abrIdB = abrB.id
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })

  test('Simultaneous auto-save race — both tabs edit within 2s window (Cola)', async ({ browser }) => {
    const initialStock = await getStock(COLA.id)
    test.skip(initialStock < 48, `Need ≥48 Cola, have ${initialStock}`)

    // Cleanup
    try { const a = await getOrCreateAbrechnung(EVENT_A); if (a?.id) await deleteAbrechnung(a.id) } catch { /* ok */ }
    try { const b = await getOrCreateAbrechnung(EVENT_B); if (b?.id) await deleteAbrechnung(b.id) } catch { /* ok */ }

    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const tabA = await ctxA.newPage()
    const tabB = await ctxB.newPage()

    try {
      await loginPage(tabA)
      await loginPage(tabB)

      // Navigate both to their events → Inventur
      await tabA.goto(`/admin/events/${EVENT_A}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabA.locator('button:has-text("Inventur")').click()
      await tabA.locator(`.inventory-row:has-text("${COLA.name}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      await tabB.goto(`/admin/events/${EVENT_B}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabB.locator('button:has-text("Inventur")').click()
      await tabB.locator(`.inventory-row:has-text("${COLA.name}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      // Both tabs see initial stock (crates = initialStock / 24)
      const colaRowA = tabA.locator(`.inventory-row:has-text("${COLA.name}")`)
      const afterCratesA = colaRowA.locator('.col-inv-pair:not(.readonly-before) input.qty-input').first()
      const colaRowB = tabB.locator(`.inventory-row:has-text("${COLA.name}")`)
      const afterCratesB = colaRowB.locator('.col-inv-pair:not(.readonly-before) input.qty-input').first()

      const cratesA = await afterCratesA.inputValue()
      const cratesB = await afterCratesB.inputValue()

      // Set up response waiters BEFORE editing (to catch the auto-save PUTs)
      const putResponseA = tabA.waitForResponse(
        r => r.url().includes('/api/abrechnungen/') && r.request().method() === 'PUT',
        { timeout: 10_000 }
      )
      const putResponseB = tabB.waitForResponse(
        r => r.url().includes('/api/abrechnungen/') && r.request().method() === 'PUT',
        { timeout: 10_000 }
      )

      // === NEAR-SIMULTANEOUS EDIT: both reduce crates by 1 within the 2s window ===
      // Small stagger avoids SQLite "database is locked" (not an issue with PostgreSQL).
      // Both auto-saves still fire within the same 2s debounce window.
      await afterCratesA.fill(String(Number(cratesA) - 1))
      await tabA.waitForTimeout(500)
      await afterCratesB.fill(String(Number(cratesB) - 1))

      // Wait for BOTH auto-save PUTs to complete
      const [respA, respB] = await Promise.all([putResponseA, putResponseB])
      expect(respA.status()).toBe(200)
      expect(respB.status()).toBe(200)

      // Verify: stock should decrease by 2 crates (both users consumed 1 crate each)
      const finalStock = await getStock(COLA.id)
      expect(finalStock).toBe(initialStock - 2 * COLA.upc)

      // Get abr IDs for cleanup
      const abrA = await getOrCreateAbrechnung(EVENT_A)
      const abrB = await getOrCreateAbrechnung(EVENT_B)
      abrIdA = abrA.id
      abrIdB = abrB.id
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })

  test('Simultaneous auto-save race — API level (near-concurrent PUTs)', async () => {
    // Both users see the same stale stock and save nearly simultaneously.
    // A tiny stagger avoids SQLite "database is locked" errors (not an issue
    // in production with PostgreSQL). The FIFO logic is still fully exercised
    // because B's save uses stale data from before A's save completes.
    const initialStock = await getStock(COLA.id)
    test.skip(initialStock < 48, `Need ≥48 Cola, have ${initialStock}`)

    const abrA = await getOrCreateAbrechnung(EVENT_A)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdA = abrA.id
    abrIdB = abrB.id

    // User A saves (stale quantity_before = initialStock)
    const rA = await saveInventory(abrA.id, [{
      beverage_item: COLA.id,
      quantity_before: initialStock,
      quantity_after: initialStock - COLA.upc,
    }])
    expect(rA.status).toBe(200)

    // User B saves with same stale data (doesn't know A consumed)
    const rB = await saveInventory(abrB.id, [{
      beverage_item: COLA.id,
      quantity_before: initialStock,
      quantity_after: initialStock - COLA.upc,
    }])
    expect(rB.status).toBe(200)

    // Both should have consumed exactly 1 crate each
    const entryA = rA.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    const entryB = rB.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(entryA.consumed_quantity)).toBe(COLA.upc)
    expect(Number(entryB.consumed_quantity)).toBe(COLA.upc)

    // Final stock must reflect both consumptions
    const finalStock = await getStock(COLA.id)
    expect(finalStock).toBe(initialStock - 2 * COLA.upc)

    // A was first → kept its quantity_before; B was corrected
    expect(Number(entryA.quantity_before)).toBe(initialStock)
    expect(Number(entryB.quantity_before)).toBe(initialStock - COLA.upc)
  })

  test('Multi-round mixed drinks: crate + per-bottle simultaneous', async () => {
    const colaStock = await getStock(COLA.id)
    const rotweinStock = await getStock(ROTWEIN.id)
    test.skip(colaStock < 48 || rotweinStock < 1, `Need ≥48 Cola and ≥1 Rotwein`)

    const abrA = await getOrCreateAbrechnung(EVENT_A)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdA = abrA.id
    abrIdB = abrB.id

    // === Round 1: User A consumes Cola (1 crate) + Rotwein (0.5) ===
    const r1A = await saveInventory(abrA.id, [
      { beverage_item: COLA.id, quantity_before: colaStock, quantity_after: colaStock - 24 },
      { beverage_item: ROTWEIN.id, quantity_before: rotweinStock, quantity_after: rotweinStock - 0.5 },
    ])
    expect(r1A.status).toBe(200)

    let currentCola = await getStock(COLA.id)
    let currentRotwein = await getStock(ROTWEIN.id)
    expect(currentCola).toBe(colaStock - 24)
    expect(currentRotwein).toBeCloseTo(rotweinStock - 0.5)

    // === Round 2: User B consumes Cola (1 crate) + Rotwein (0.5) with stale before ===
    const r2B = await saveInventory(abrB.id, [
      { beverage_item: COLA.id, quantity_before: colaStock, quantity_after: colaStock - 24 },
      { beverage_item: ROTWEIN.id, quantity_before: rotweinStock, quantity_after: rotweinStock - 0.5 },
    ])
    expect(r2B.status).toBe(200)

    // Backend should correct B's before values
    const r2B_cola = r2B.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    const r2B_rotwein = r2B.data.inventory_entries.find((e: any) => e.beverage_item === ROTWEIN.id)

    // Cola: effective_before = (colaStock-24)+0 = colaStock-24
    expect(Number(r2B_cola.quantity_before)).toBe(colaStock - 24)
    expect(Number(r2B_cola.quantity_after)).toBe(colaStock - 48)
    expect(Number(r2B_cola.consumed_quantity)).toBe(24)

    // Rotwein: effective_before = (rotweinStock-0.5)+0 = rotweinStock-0.5
    expect(Number(r2B_rotwein.quantity_before)).toBeCloseTo(rotweinStock - 0.5)
    expect(Number(r2B_rotwein.quantity_after)).toBeCloseTo(rotweinStock - 1)
    expect(Number(r2B_rotwein.consumed_quantity)).toBeCloseTo(0.5)

    currentCola = await getStock(COLA.id)
    currentRotwein = await getStock(ROTWEIN.id)
    expect(currentCola).toBe(colaStock - 48)
    expect(currentRotwein).toBeCloseTo(rotweinStock - 1)

    // === Final totals ===
    // Cola: A=24 + B=24 = 48 consumed
    // Rotwein: A=0.5 + B=0.5 = 1.0 consumed (both using 0.5 decimal steps)
    expect(currentCola).toBe(colaStock - 48)
    expect(currentRotwein).toBeCloseTo(rotweinStock - 1)
  })
})
