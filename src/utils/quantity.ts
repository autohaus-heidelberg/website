/**
 * Quantity normalization utilities for frontend ↔ backend data consistency.
 *
 * Backend uses DecimalField(decimal_places=2) → serializes as "40.00"
 * Stock API returns integers → 40
 * Frontend stores strings → "40"
 *
 * These utilities provide a single source of truth for comparison and normalization.
 */

/**
 * Parse a quantity value to a number. Handles string, number, null, undefined.
 */
export function parseQty(val: string | number | null | undefined): number {
  if (val == null || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(val)
  return isNaN(n) ? 0 : n
}

/**
 * Compare two quantity values for numeric equality.
 * Handles all format variations: "40.00" vs "40" vs 40 vs "40.0"
 */
export function qtyEquals(a: string | number | null | undefined, b: string | number | null | undefined): boolean {
  return parseQty(a) === parseQty(b)
}

/**
 * Normalize a quantity to a canonical string for storage.
 * - Strips unnecessary trailing zeros: "40.00" → "40", "7.50" → "7.5"
 * - Keeps meaningful decimals: "7.5" → "7.5"
 * - Returns "0" for falsy/NaN input
 */
export function normalizeQty(val: string | number | null | undefined): string {
  const n = parseQty(val)
  return String(n)
}
