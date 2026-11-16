import { describe, it, expect } from 'vitest'
import { describeChange } from '@/utils/abrechnungChanges'
import type { AbrechnungChange } from '@/types/accounting'

function change(overrides: Partial<AbrechnungChange>): AbrechnungChange {
  return {
    id: 1, at: '2026-11-14T22:07:27Z', user: 'thierry', scope: 'abrechnung',
    subject: '', field: '', change_type: 'changed', old_value: null, new_value: null,
    ...overrides,
  }
}

// Intl setzt zwischen Zahl und € ein geschütztes Leerzeichen.
const nbsp = (s: string) => s.replace(/ /g, '\u00a0')

describe('describeChange', () => {
  it('beschreibt die Änderung eines Rechner-Felds', () => {
    const text = describeChange(change({ field: 'deal_calc_cash', old_value: '1010.00', new_value: '1160.00' }))
    expect(text).toBe(`Rechner: Bargeld – ${nbsp('1.010,00 €')} → ${nbsp('1.160,00 €')}`)
  })

  it('benennt Einnahmen mit ihrer Quelle und dem Feld', () => {
    const text = describeChange(change({
      scope: 'revenue', subject: 'vvk_pretix', field: 'fees', old_value: '11.19', new_value: '11.88',
    }))
    expect(text).toBe(`Einnahme VVK (Pretix) – Gebühren: ${nbsp('11,19 €')} → ${nbsp('11,88 €')}`)
  })

  it('beschreibt hinzugefügte und entfernte Ausgaben', () => {
    const added = describeChange(change({
      scope: 'expense', subject: 'Yellow Walls', field: 'amount', change_type: 'added', new_value: '150.00',
    }))
    const removed = describeChange(change({
      scope: 'expense', subject: 'Yellow Walls', field: 'amount', change_type: 'removed', old_value: '150.00',
    }))
    expect(added).toBe(`Ausgabe „Yellow Walls“ hinzugefügt: ${nbsp('150,00 €')}`)
    expect(removed).toBe(`Ausgabe „Yellow Walls“ entfernt (war ${nbsp('150,00 €')})`)
  })

  it('übersetzt „Bezahlt aus“ und zeigt leere Werte als Strich', () => {
    const paid = describeChange(change({
      scope: 'expense', subject: 'COME', field: 'paid_from', old_value: 'entrance_cash', new_value: 'bar_cash',
    }))
    expect(paid).toBe('Ausgabe „COME“ – Bezahlt aus: Einlasskasse → Barkasse')
    expect(describeChange(change({ field: 'deal_calc_cash', old_value: null, new_value: '500.00' })))
      .toBe(`Rechner: Bargeld – – → ${nbsp('500,00 €')}`)
  })
})
