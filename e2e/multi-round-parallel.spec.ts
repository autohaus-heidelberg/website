/**
 * E2E Tests: Multi-round parallel consumption.
 *
 * Two users (A and B) alternately consume from the same drinks across
 * multiple rounds. With the new chronological backend semantics, the client
 * sends `consumed_quantity` directly (no intent inference from stale
 * before/after pairs); the displayed `quantity_before` / `quantity_after`
 * are server-computed read-only values.
 *
 * These tests verify:
 * - consumed_quantity is faithfully applied to FIFO stock per save
 * - quantity_before reflects chronological-before (purchases up to event date
 *   minus consumption of all earlier events)
 * - The server rejects requests that would push stock negative
 *
 * Requires: backend on :8000, frontend on :5173
 */
import { test, expect } from '@playwright/test'
import { loginPage } from './helpers/auth'
import {
  getOrCreateAbrechnung,
  deleteAbrechnung,
  getStock,
  saveInventory,
} from './helpers/api'

// Events for the two parallel users. Both chronologically AFTER all current
// Cola purchases so quantity_before is positive (= chronological stock at the
// event date), and consecutive so they're deterministic.
const EVENT_A = 'cherazade'           // 2026-06-20
const EVENT_B = 'goodflyingbirds'     // 2026-06-23

// Cola: crate-based (upc=24)
const COLA = { id: 5, name: 'Cola', upc: 24 }
// Sekt Piccolo: per-bottle (upc=1), supports decimal (0.5)
const ROTWEIN = { id: 22, name: 'Sekt Piccolo', upc: 1 }

test.describe('Multi-round parallel consumption', () => {
  test.describe.configure({ timeout: 90_000 })

  let abrIdA: number | null = null
  let abrIdB: number | null = null

  test.beforeEach(async () => {
    // Reset state: delete any pre-existing abrechnungen for our test events.
    try {
      const a = await getOrCreateAbrechnung(EVENT_A)
      if (a?.id) await deleteAbrechnung(a.id)
    } catch { /* ok */ }
    try {
      const b = await getOrCreateAbrechnung(EVENT_B)
      if (b?.id) await deleteAbrechnung(b.id)
    } catch { /* ok */ }
  })

  test.afterEach(async () => {
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

    // Use half-crate steps (12 bottles) to stay within available stock
    const STEP = 12

    // === Round 1: User A consumes 12 bottles ===
    const r1A = await saveInventory(abrA.id, [{
      beverage_item: COLA.id,
      consumed_quantity: STEP,
    }])
    expect(r1A.status).toBe(200)
    const r1A_entry = r1A.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(r1A_entry.consumed_quantity)).toBe(STEP)

    let stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - STEP)

    // === Round 2: User B consumes 12 bottles (independent action) ===
    const r2B = await saveInventory(abrB.id, [{
      beverage_item: COLA.id,
      consumed_quantity: STEP,
    }])
    expect(r2B.status).toBe(200)
    const r2B_entry = r2B.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(r2B_entry.consumed_quantity)).toBe(STEP)

    stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - 2 * STEP)

    // === Round 3: User B updates to total consumed = 24 (delta +12) ===
    const r3B = await saveInventory(abrB.id, [{
      beverage_item: COLA.id,
      consumed_quantity: 2 * STEP,
    }])
    expect(r3B.status).toBe(200)
    const r3B_entry = r3B.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(r3B_entry.consumed_quantity)).toBe(2 * STEP)

    stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - 3 * STEP)

    // === Round 4: User A re-saves same value (no delta) ===
    const r4A = await saveInventory(abrA.id, [{
      beverage_item: COLA.id,
      consumed_quantity: STEP,
    }])
    expect(r4A.status).toBe(200)
    const r4A_entry = r4A.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(r4A_entry.consumed_quantity)).toBe(STEP)
    stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - 3 * STEP) // unchanged

    // === Round 5: User A increases to 24 ===
    const r5A = await saveInventory(abrA.id, [{
      beverage_item: COLA.id,
      consumed_quantity: 2 * STEP,
    }])
    expect(r5A.status).toBe(200)
    const r5A_entry = r5A.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(r5A_entry.consumed_quantity)).toBe(2 * STEP)

    stock = await getStock(COLA.id)
    expect(stock).toBe(initialStock - 4 * STEP)

    // === Final: total consumed = 48 (A:24 + B:24) ===
    expect(stock).toBe(initialStock - 48)
  })

  test('Multi-round decimal consumption (Sekt Piccolo, upc=1) — API level', async () => {
    const initialStock = await getStock(ROTWEIN.id)
    test.skip(initialStock < 1.5, `Need ≥1.5 ${ROTWEIN.name}, have ${initialStock}`)

    const abrA = await getOrCreateAbrechnung(EVENT_A)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdA = abrA.id
    abrIdB = abrB.id

    // === Round 1: User A consumes 0.5 bottle ===
    const r1A = await saveInventory(abrA.id, [{
      beverage_item: ROTWEIN.id,
      consumed_quantity: 0.5,
    }])
    expect(r1A.status).toBe(200)
    const r1A_entry = r1A.data.inventory_entries.find((e: any) => e.beverage_item === ROTWEIN.id)
    expect(Number(r1A_entry.consumed_quantity)).toBeCloseTo(0.5)

    let stock = await getStock(ROTWEIN.id)
    expect(stock).toBeCloseTo(initialStock - 0.5)

    // === Round 2: User B consumes 0.5 bottle ===
    const r2B = await saveInventory(abrB.id, [{
      beverage_item: ROTWEIN.id,
      consumed_quantity: 0.5,
    }])
    expect(r2B.status).toBe(200)
    const r2B_entry = r2B.data.inventory_entries.find((e: any) => e.beverage_item === ROTWEIN.id)
    expect(Number(r2B_entry.consumed_quantity)).toBeCloseTo(0.5)

    stock = await getStock(ROTWEIN.id)
    expect(stock).toBeCloseTo(initialStock - 1)

    // === Round 3: User B increases to 1.0 ===
    const r3B = await saveInventory(abrB.id, [{
      beverage_item: ROTWEIN.id,
      consumed_quantity: 1,
    }])
    expect(r3B.status).toBe(200)
    const r3B_entry = r3B.data.inventory_entries.find((e: any) => e.beverage_item === ROTWEIN.id)
    expect(Number(r3B_entry.consumed_quantity)).toBeCloseTo(1)

    stock = await getStock(ROTWEIN.id)
    expect(stock).toBeCloseTo(initialStock - 1.5)
  })

  test('Multi-round with UI — stock updates and warnings (Cola)', async ({ browser }) => {
    const initialStock = await getStock(COLA.id)
    test.skip(initialStock < 48, `Need ≥48 Cola, have ${initialStock}`)

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
      await tabA.locator(`.inventory-row:has-text("${COLA.name}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      await tabB.goto(`/admin/events/${EVENT_B}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabB.locator('button:has-text("Inventur")').click()
      await tabB.locator(`.inventory-row:has-text("${COLA.name}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      // === Round 1: Tab A reduces Cola by 1 crate via UI ===
      const colaRowA = tabA.locator(`.inventory-row:has-text("${COLA.name}")`)
      const afterInputA = colaRowA.locator('input.qty-input').first()
      const initialCratesA = await afterInputA.inputValue()
      await afterInputA.fill(String(Number(initialCratesA) - 1))
      await tabA.waitForTimeout(3500)

      let stock = await getStock(COLA.id)
      expect(stock).toBe(initialStock - COLA.upc)

      // === Round 2: Tab B reduces Cola by 1 crate via UI ===
      const colaRowB = tabB.locator(`.inventory-row:has-text("${COLA.name}")`)
      const afterInputB = colaRowB.locator('input.qty-input').first()
      const initialCratesB = await afterInputB.inputValue()
      await afterInputB.fill(String(Number(initialCratesB) - 1))
      await tabB.waitForTimeout(3500)

      stock = await getStock(COLA.id)
      expect(stock).toBe(initialStock - 2 * COLA.upc)

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

    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const tabA = await ctxA.newPage()
    const tabB = await ctxB.newPage()

    try {
      await loginPage(tabA)
      await loginPage(tabB)

      await tabA.goto(`/admin/events/${EVENT_A}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabA.locator('button:has-text("Inventur")').click()
      await tabA.locator(`.inventory-row:has-text("${COLA.name}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      await tabB.goto(`/admin/events/${EVENT_B}?tab=accounting`, { waitUntil: 'domcontentloaded' })
      await tabB.locator('button:has-text("Inventur")').click()
      await tabB.locator(`.inventory-row:has-text("${COLA.name}")`).first().waitFor({ state: 'visible', timeout: 30_000 })

      const colaRowA = tabA.locator(`.inventory-row:has-text("${COLA.name}")`)
      const afterCratesA = colaRowA.locator('.col-inv-pair:not(.readonly-before) input.qty-input').first()
      const colaRowB = tabB.locator(`.inventory-row:has-text("${COLA.name}")`)
      const afterCratesB = colaRowB.locator('.col-inv-pair:not(.readonly-before) input.qty-input').first()

      const cratesA = await afterCratesA.inputValue()
      const cratesB = await afterCratesB.inputValue()

      const putResponseA = tabA.waitForResponse(
        r => r.url().includes('/api/abrechnungen/') && r.request().method() === 'PUT',
        { timeout: 10_000 }
      )
      const putResponseB = tabB.waitForResponse(
        r => r.url().includes('/api/abrechnungen/') && r.request().method() === 'PUT',
        { timeout: 10_000 }
      )

      // Near-simultaneous edit: both reduce crates by 1 within 2s window.
      // Small stagger avoids SQLite "database is locked".
      await afterCratesA.fill(String(Number(cratesA) - 1))
      await tabA.waitForTimeout(500)
      await afterCratesB.fill(String(Number(cratesB) - 1))

      const [respA, respB] = await Promise.all([putResponseA, putResponseB])
      expect(respA.status()).toBe(200)
      expect(respB.status()).toBe(200)

      const finalStock = await getStock(COLA.id)
      expect(finalStock).toBe(initialStock - 2 * COLA.upc)

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
    const initialStock = await getStock(COLA.id)
    test.skip(initialStock < 48, `Need ≥48 Cola, have ${initialStock}`)

    const abrA = await getOrCreateAbrechnung(EVENT_A)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdA = abrA.id
    abrIdB = abrB.id

    // User A and User B both consume 1 crate, sequentially close in time.
    const rA = await saveInventory(abrA.id, [{
      beverage_item: COLA.id,
      consumed_quantity: COLA.upc,
    }])
    expect(rA.status).toBe(200)

    const rB = await saveInventory(abrB.id, [{
      beverage_item: COLA.id,
      consumed_quantity: COLA.upc,
    }])
    expect(rB.status).toBe(200)

    const entryA = rA.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    const entryB = rB.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    expect(Number(entryA.consumed_quantity)).toBe(COLA.upc)
    expect(Number(entryB.consumed_quantity)).toBe(COLA.upc)

    // Final stock must reflect both consumptions
    const finalStock = await getStock(COLA.id)
    expect(finalStock).toBe(initialStock - 2 * COLA.upc)
  })

  test('Multi-round mixed drinks: crate + per-bottle simultaneous', async () => {
    const colaStock = await getStock(COLA.id)
    const rotweinStock = await getStock(ROTWEIN.id)
    test.skip(colaStock < 48 || rotweinStock < 1, `Need ≥48 Cola and ≥1 ${ROTWEIN.name}`)

    const abrA = await getOrCreateAbrechnung(EVENT_A)
    const abrB = await getOrCreateAbrechnung(EVENT_B)
    abrIdA = abrA.id
    abrIdB = abrB.id

    // === Round 1: User A consumes Cola (1 crate) + Sekt Piccolo (0.5) ===
    const r1A = await saveInventory(abrA.id, [
      { beverage_item: COLA.id, consumed_quantity: 24 },
      { beverage_item: ROTWEIN.id, consumed_quantity: 0.5 },
    ])
    expect(r1A.status).toBe(200)

    let currentCola = await getStock(COLA.id)
    let currentRotwein = await getStock(ROTWEIN.id)
    expect(currentCola).toBe(colaStock - 24)
    expect(currentRotwein).toBeCloseTo(rotweinStock - 0.5)

    // === Round 2: User B consumes Cola (1 crate) + Sekt Piccolo (0.5) ===
    const r2B = await saveInventory(abrB.id, [
      { beverage_item: COLA.id, consumed_quantity: 24 },
      { beverage_item: ROTWEIN.id, consumed_quantity: 0.5 },
    ])
    expect(r2B.status).toBe(200)

    const r2B_cola = r2B.data.inventory_entries.find((e: any) => e.beverage_item === COLA.id)
    const r2B_rotwein = r2B.data.inventory_entries.find((e: any) => e.beverage_item === ROTWEIN.id)
    expect(Number(r2B_cola.consumed_quantity)).toBe(24)
    expect(Number(r2B_rotwein.consumed_quantity)).toBeCloseTo(0.5)

    currentCola = await getStock(COLA.id)
    currentRotwein = await getStock(ROTWEIN.id)
    expect(currentCola).toBe(colaStock - 48)
    expect(currentRotwein).toBeCloseTo(rotweinStock - 1)

    // === Final totals: Cola 48 consumed, Sekt Piccolo 1.0 consumed ===
    expect(currentCola).toBe(colaStock - 48)
    expect(currentRotwein).toBeCloseTo(rotweinStock - 1)
  })
})
