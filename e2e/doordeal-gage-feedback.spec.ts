/**
 * Der Gagen-Rechner im Ausgaben-Tab ist ein Hilfsmittel für den Abend: man
 * trägt ein, was im Einlass liegt, und sieht was jede Band bekommt. Sein
 * Eingabefeld hängt an nichts dran — insbesondere darf eine gebuchte Gage den
 * Wert nicht verändern, sonst leitet sich die nächste Gage aus einer Basis ab,
 * die bereits eine Gage enthält, und läuft hoch (467 → 904 → 1.287 …).
 *
 * Die Abrechnung selbst bleibt unverändert: aus den Kassen bezahlte Ausgaben
 * werden für die Brutto-Einnahme zurückgerechnet (gezählt wird der Rest).
 *
 * Setup: zwei Bands, je Garantie 100 € vs. 50 % Doordeal.
 * 1.000 € brutto (7 % USt) => 934,58 € netto => je 467,29 €.
 */
import { test, expect, type Page } from '@playwright/test'
import { loginPage } from './helpers/auth'
import { apiGet, apiPut, getToken } from './helpers/api'

const EVENT_ID = 'thegoods-jcusumano'
const BANDS = ['The Goods', 'Joel Cusumano']

let originalDeals: unknown

async function patchEvent(body: unknown) {
  const token = await getToken()
  const resp = await fetch(`http://localhost:8000/api/events/${EVENT_ID}/`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(resp.ok).toBe(true)
}

async function resetAbrechnung(opts: { entranceTotal: string; expenses?: unknown[] }) {
  const abr = await apiGet(`/api/abrechnungen/by-event/${EVENT_ID}/`)
  const res = await apiPut(`/api/abrechnungen/${abr.id}/`, {
    notes: '',
    door_deal_enabled: false,
    door_deal_splits: [],
    revenues: [{ source: 'entrance_cash', total: opts.entranceTotal, change_money: '0.00', fees: '0.00', vat_rate: '7' }],
    inventory_entries: [],
    expenses: opts.expenses ?? [],
    splits: [],
  })
  expect(res.status).toBe(200)
}

test.beforeAll(async () => {
  const ev = await apiGet(`/api/events/${EVENT_ID}/`)
  originalDeals = ev.artist_deals
  const deals: Record<string, unknown> = {}
  for (const a of ev.artists) {
    deals[String(a.id)] = { deal_type: 'guarantee_plus_door', guarantee_amount: '100', door_deal_percentage: '50' }
  }
  await patchEvent({ artist_deals: deals })
})

test.afterAll(async () => {
  await patchEvent({ artist_deals: originalDeals })
})

function bandRow(page: Page, name: string) {
  return page.locator('.band-deal-row').filter({ hasText: name })
}

test('Rechner-Basis bleibt stehen, wenn Gagen gebucht werden', async ({ page }) => {
  await resetAbrechnung({ entranceTotal: '1000.00' })
  await loginPage(page)
  await page.goto(`/admin/events/${EVENT_ID}?abrTab=expenses`)

  // Vorbelegt mit der Brutto-Türeinnahme aus der Abrechnung
  const calcBase = page.locator('#deal-calc-base')
  await expect(calcBase).toHaveValue('1000.00', { timeout: 15_000 })
  await expect(page.locator('.deal-calc-net')).toContainText('934,58')

  for (const name of BANDS) {
    await expect(bandRow(page, name).locator('.band-deal-deal')).toContainText('467,29')
    await bandRow(page, name).getByRole('button', { name: 'Als Ausgabe übernehmen' }).click()
  }

  // Weder die Basis noch die gebuchten Beträge bewegen sich
  await expect(calcBase).toHaveValue('1000.00')
  for (const name of BANDS) {
    await expect(bandRow(page, name).locator('.band-deal-recorded')).toContainText('467,29')
    await expect(bandRow(page, name).locator('.tag-warn')).toHaveCount(0)
  }

  await page.waitForTimeout(2500)
  await page.reload()
  for (const name of BANDS) {
    await expect(bandRow(page, name).locator('.band-deal-recorded')).toContainText('467,29', { timeout: 15_000 })
    await expect(bandRow(page, name).locator('.tag-warn')).toHaveCount(0)
  }
})

test('Rechner zieht die USt ab und lässt sich überschreiben', async ({ page }) => {
  await resetAbrechnung({ entranceTotal: '1000.00' })
  await loginPage(page)
  await page.goto(`/admin/events/${EVENT_ID}?abrTab=expenses`)
  const calcBase = page.locator('#deal-calc-base')
  await expect(calcBase).toHaveValue('1000.00', { timeout: 15_000 })

  // 642 € brutto => 600 € netto => 50 % = 300 € (nicht 321 €)
  await calcBase.fill('642')
  await expect(page.locator('.deal-calc-net')).toContainText('600,00')
  await expect(bandRow(page, BANDS[0]).locator('.band-deal-deal')).toContainText('300,00')

  await page.getByRole('button', { name: '↺ aus Abrechnung' }).click()
  await expect(calcBase).toHaveValue('1000.00')
  await expect(bandRow(page, BANDS[0]).locator('.band-deal-deal')).toContainText('467,29')
})

test('Abrechnung rechnet Auszahlungen weiterhin zurück', async ({ page }) => {
  // Einlass-Rest 532,71 € + 467,29 € ausgezahlt = 1.000 €
  // Barkasse 0 € gezählt + 198 € daraus bezahlt = 198 €
  await resetAbrechnung({
    entranceTotal: '532.71',
    expenses: [
      { description: BANDS[0], amount: '467.29', notes: '', paid_from: 'entrance_cash', grant_category: 'kuenstlerhonorar', tax_sphere: 'zweckbetrieb' },
      { description: 'Taxi Crew', amount: '198.00', notes: '', paid_from: 'bar_cash', tax_sphere: 'zweckbetrieb' },
    ],
  })
  await loginPage(page)
  await page.goto(`/admin/events/${EVENT_ID}?abrTab=result`)
  await expect(page.locator('.summary-table')).toContainText('1.198,00', { timeout: 15_000 })
})

test('Betragsfelder markieren ihren Wert beim Reinklicken', async ({ page }) => {
  await resetAbrechnung({
    entranceTotal: '1000.00',
    expenses: [{ description: 'Taxi Crew', amount: '198.00', notes: '', paid_from: 'other', tax_sphere: 'zweckbetrieb' }],
  })
  await loginPage(page)
  await page.goto(`/admin/events/${EVENT_ID}?abrTab=expenses`)
  const input = page.locator('.expense-row input.amount-input').first()
  await expect(input).toHaveValue('198.00', { timeout: 15_000 })

  // Tippen ersetzt den Betrag, statt ihn zu ergänzen — egal wo man hinklickt
  const box = (await input.boundingBox())!
  const other = page.locator('.expense-row input.text-input').first()
  for (const x of [4, box.width / 2, box.width - 4]) {
    await input.fill('198.00')
    await other.click()
    await input.click({ position: { x, y: box.height / 2 } })
    await page.keyboard.type('5')
    await expect(input).toHaveValue('5')
  }

  // Zweiter Klick ins bereits fokussierte Feld setzt wieder den Cursor
  await input.fill('198.00')
  await other.click()
  await input.click({ position: { x: box.width - 4, y: box.height / 2 } })
  await input.click({ position: { x: box.width - 4, y: box.height / 2 } })
  await page.keyboard.type('5')
  await expect(input).not.toHaveValue('5')
})
