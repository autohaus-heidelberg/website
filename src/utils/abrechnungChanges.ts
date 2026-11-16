import {
  EXPENSE_PAID_FROM_LABELS,
  REVENUE_SOURCE_LABELS,
  type AbrechnungChangeDetail,
} from '@/types/accounting'

const FIELD_LABELS: Record<string, string> = {
  deal_calc_cash: 'Rechner: Bargeld',
  deal_calc_change: 'Rechner: Wechselgeld',
  status: 'Status',
  notes: 'Notiz',
  total: 'Gesamt',
  change_money: 'Wechselgeld',
  fees: 'Gebühren',
  amount: 'Betrag',
  paid_from: 'Bezahlt aus',
}

const MONEY_FIELDS = new Set(['deal_calc_cash', 'deal_calc_change', 'total', 'change_money', 'fees', 'amount'])

// Ohne gespeicherten Wert folgt der Rechner der Kassenzählung, bis ein Feld angefasst wird.
const CALC_FIELDS = new Set(['deal_calc_cash', 'deal_calc_change'])

function formatValue(field: string, value: string | null): string {
  if (value === null || value === '') return CALC_FIELDS.has(field) ? 'folgt der Kassenzählung' : '–'
  if (MONEY_FIELDS.has(field)) {
    return Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  }
  if (field === 'paid_from') return (EXPENSE_PAID_FROM_LABELS as Record<string, string>)[value] ?? value
  return value
}

function subjectLabel(c: AbrechnungChangeDetail): string {
  if (c.scope === 'revenue') return `Einnahme ${(REVENUE_SOURCE_LABELS as Record<string, string>)[c.subject] ?? c.subject}`
  if (c.scope === 'expense') return `Ausgabe „${c.subject}“`
  return FIELD_LABELS[c.field] ?? c.field
}

/** Genauer Zeitpunkt in Ortszeit, z. B. „Sa., 14.11., 23:07“. */
export function formatChangeTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Ein Satz für den Änderungsverlauf, z. B. „Rechner: Bargeld – 1.010,00 € → 1.160,00 €“. */
export function describeChange(c: AbrechnungChangeDetail): string {
  if (c.change_type === 'added') return `${subjectLabel(c)} hinzugefügt: ${formatValue(c.field, c.new_value)}`
  if (c.change_type === 'removed') return `${subjectLabel(c)} entfernt (war ${formatValue(c.field, c.old_value)})`
  const field = c.scope === 'abrechnung' ? '' : `${FIELD_LABELS[c.field] ?? c.field}: `
  const diff = `${formatValue(c.field, c.old_value)} → ${formatValue(c.field, c.new_value)}`
  return c.scope === 'abrechnung' ? `${subjectLabel(c)} – ${diff}` : `${subjectLabel(c)} – ${field}${diff}`
}
