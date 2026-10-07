import type { Locator, Page } from '@playwright/test'

/**
 * Zugriff auf die Inventur-Tabelle für die e2e-Tests.
 *
 * Die Tests hingen früher an Layout-Klassen (`.col-inv-pair`, `.readonly-before`,
 * `.bottle-mode`) und unterschieden Kisten- von Flaschenfeld über `.first()` /
 * `.nth(1)`. Jeder Umbau der Tabelle konnte sie damit stillschweigend auf das
 * falsche Feld zeigen lassen. Die Anker sind jetzt `data-testid`-Attribute im
 * Markup — sichtbar als Test-Hook und unabhängig vom Layout.
 *
 * Alle Selektoren leben hier, damit ein künftiger Umbau nur diese Datei trifft.
 */

/** Zeile eines Getränks. `name` muss dem Namen im Getränke-Stamm entsprechen
 *  (ohne Flaschengröße), z.B. "Cola" — nicht "Cola 0,33l". */
export function invRow(scope: Page | Locator, name: string): Locator {
  return scope.locator(`[data-testid="inv-row"][data-drink="${name}"]`).first()
}

/** Hauptmenge im "Nachher"-Feld: Kisten bei Kistenware, sonst Flaschen.
 *  Existiert in jedem Zählmodus. */
export function invAfterMajor(row: Locator): Locator {
  return row.getByTestId('inv-after-major')
}

/** Nebeneinheit im "Nachher"-Feld: Einzelflaschen innerhalb der angebrochenen
 *  Kiste. Gibt es NUR bei Kistenware — Portions- und Ganzflaschen-Getränke
 *  haben kein zweites Eingabefeld. */
export function invAfterMinor(row: Locator): Locator {
  return row.getByTestId('inv-after-minor')
}

/** Read-only "Vorher"-Block (Text, kein Eingabefeld). */
export function invBefore(row: Locator): Locator {
  return row.getByTestId('inv-before')
}

/** Spalte "Gesamt" — der chronologische Vorher-Bestand als eine Zahl. */
export function invTotal(row: Locator): Locator {
  return row.getByTestId('inv-total')
}

/** Spalte "Verbraucht". */
export function invConsumed(row: Locator): Locator {
  return row.getByTestId('inv-consumed')
}

/** Öffnet den Inventur-Reiter und wartet, bis die Zeile des Getränks steht.
 *  `hideZeroStock` blendet Zeilen ohne Bestand aus, deshalb warten wir auf eine
 *  konkrete Zeile statt auf die Tabelle. */
export async function openInventur(page: Page, drinkName: string, timeout = 30_000): Promise<Locator> {
  await page.locator('button:has-text("Inventur")').click()
  const row = invRow(page, drinkName)
  await row.waitFor({ state: 'visible', timeout })
  return row
}
