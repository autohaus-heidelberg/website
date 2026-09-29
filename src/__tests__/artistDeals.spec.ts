import { describe, it, expect } from 'vitest'
import {
  resolveComboDeal,
  findDuplicateNames,
  parsePrice,
  comboBreakeven,
  estimateTicketRange,
  showsGuarantee,
  showsDoorDeal,
  needsDealSuggestion,
  bandDealIssues,
} from '../utils/artistDeals'

describe('resolveComboDeal', () => {
  it('guarantee wins when the door share is lower', () => {
    // 700€ brutto -> ~654€ netto (7% USt raus) * 30% ≈ 196€ < 300€ Garantie
    const result = resolveComboDeal({ guarantee_amount: '300', door_deal_percentage: '30' }, 654.21)
    expect(result.resolvedSource).toBe('guarantee')
    expect(result.resolvedAmount).toBe(300)
  })

  it('doordeal wins when the door share is higher', () => {
    // 1400€ brutto -> ~1308€ netto * 30% ≈ 392€ > 300€ Garantie
    const result = resolveComboDeal({ guarantee_amount: '300', door_deal_percentage: '30' }, 1308.41)
    expect(result.resolvedSource).toBe('doordeal')
    expect(result.resolvedAmount).toBeCloseTo(392.52, 1)
  })

  it('never adds guarantee and door share — always the max of the two', () => {
    const result = resolveComboDeal({ guarantee_amount: '300', door_deal_percentage: '30' }, 2000)
    expect(result.resolvedAmount).toBe(600) // 30% of 2000, NOT 300+600
  })

  it('treats a tie as guarantee (not strictly greater)', () => {
    const result = resolveComboDeal({ guarantee_amount: '300', door_deal_percentage: '30' }, 1000)
    expect(result.resolvedAmount).toBe(300)
    expect(result.resolvedSource).toBe('guarantee')
  })

  it('handles missing/empty fields as 0', () => {
    const result = resolveComboDeal({}, 1000)
    expect(result.guaranteeAmount).toBe(0)
    expect(result.doorDealPercentage).toBe(0)
    expect(result.resolvedAmount).toBe(0)
  })
})

describe('findDuplicateNames', () => {
  it('returns empty set when all names are unique', () => {
    expect(findDuplicateNames(['Alvilda', 'Bär', 'Tyvek']).size).toBe(0)
  })

  it('detects an exact duplicate', () => {
    const dupes = findDuplicateNames(['The Bats', 'The Bats'])
    expect(dupes.has('the bats')).toBe(true)
  })

  it('is case- and whitespace-insensitive', () => {
    const dupes = findDuplicateNames(['Bernd', ' bernd ', 'BERND'])
    expect(dupes.has('bernd')).toBe(true)
  })

  it('ignores empty/blank names entirely', () => {
    expect(findDuplicateNames(['', '  ', '']).size).toBe(0)
  })

  it('can detect multiple distinct duplicates at once', () => {
    const dupes = findDuplicateNames(['A', 'B', 'A', 'B', 'C'])
    expect(dupes.has('a')).toBe(true)
    expect(dupes.has('b')).toBe(true)
    expect(dupes.has('c')).toBe(false)
  })
})

describe('parsePrice', () => {
  it('parses German comma decimals', () => {
    expect(parsePrice('18,60')).toBe(18.6)
  })

  it('parses plain integers', () => {
    expect(parsePrice('12')).toBe(12)
  })

  it('returns 0 for empty/undefined/invalid input', () => {
    expect(parsePrice('')).toBe(0)
    expect(parsePrice(undefined)).toBe(0)
    expect(parsePrice('abc')).toBe(0)
  })
})

describe('comboBreakeven', () => {
  it('computes the revenue needed for the door share to match the guarantee', () => {
    // 300€ Garantie / 30% -> 1000€ Netto-Eintrittseinnahmen
    expect(comboBreakeven(300, 30)).toBe(1000)
  })

  it('returns null when there is no guarantee or no percentage', () => {
    expect(comboBreakeven(0, 30)).toBeNull()
    expect(comboBreakeven(300, 0)).toBeNull()
  })
})

describe('estimateTicketRange', () => {
  it('returns a range between AK-only and VVK-only ticket counts', () => {
    // netRevenue 600 -> grossRevenue 642 (7% USt) -> /20 = 33, /12 = 54
    expect(estimateTicketRange(600, 12, 20)).toBe('33–54')
  })

  it('returns a single number when only one price is set', () => {
    expect(estimateTicketRange(600, 0, 20)).toBe('33')
  })

  it('returns null when netRevenue is null or no prices are set', () => {
    expect(estimateTicketRange(null, 12, 20)).toBeNull()
    expect(estimateTicketRange(600, 0, 0)).toBeNull()
  })
})

describe('showsGuarantee / showsDoorDeal', () => {
  it('guarantee and combo deals show the guarantee field', () => {
    expect(showsGuarantee('guarantee')).toBe(true)
    expect(showsGuarantee('guarantee_plus_door')).toBe(true)
    expect(showsGuarantee('door_deal')).toBe(false)
  })

  it('door_deal and combo deals show the percentage field', () => {
    expect(showsDoorDeal('door_deal')).toBe(true)
    expect(showsDoorDeal('guarantee_plus_door')).toBe(true)
    expect(showsDoorDeal('guarantee')).toBe(false)
  })
})

describe('needsDealSuggestion', () => {
  // Exhaustive truth table over every (dealType, guaranteeApplied,
  // doorDealApplied) combination — this is exactly the logic that decides
  // whether the "Gage/Doordeal übernehmen"-Vorschlag im Ausgaben-Tab
  // erscheint. Written after a real-world report ("nach dem Entfernen einer
  // Ausgabe erscheint nicht immer ein Vorschlag") to pin down the exact
  // intended behaviour per deal type/combination.
  it.each([
    // dealType,            guaranteeApplied, doorDealApplied, expected
    ['guarantee', false, false, true],
    ['guarantee', false, true, true], // door split irrelevant for a pure guarantee deal
    ['guarantee', true, false, false],
    ['guarantee', true, true, false],

    ['door_deal', false, false, true],
    ['door_deal', false, true, false],
    ['door_deal', true, false, true], // stale/leftover expense irrelevant — only the door split counts
    ['door_deal', true, true, false],

    ['guarantee_plus_door', false, false, true],
    ['guarantee_plus_door', false, true, true], // combo resolves into ONE expense — door split state irrelevant
    ['guarantee_plus_door', true, false, false],
    ['guarantee_plus_door', true, true, false],
  ] as [string, boolean, boolean, boolean][])(
    '%s (guaranteeApplied=%s, doorDealApplied=%s) -> %s',
    (dealType, guaranteeApplied, doorDealApplied, expected) => {
      expect(needsDealSuggestion(dealType, guaranteeApplied, doorDealApplied)).toBe(expected)
    },
  )

  it('never suggests anything for an unknown/undefined deal type', () => {
    expect(needsDealSuggestion(undefined, false, false)).toBe(false)
    expect(needsDealSuggestion('', false, false)).toBe(false)
    expect(needsDealSuggestion('something_else', false, false)).toBe(false)
  })
})

describe('bandDealIssues', () => {
  const base = {
    expenseAmount: null as number | null,
    expectedAmount: null as number | null,
    mismatchAcknowledged: false,
  }

  // Exhaustive matrix over (dealType × hasExpense × hasSplit) for the
  // suggestion + orphan flags (amount ignored here). This is the full set of
  // states a band can be in as the treasurer switches deal types and
  // adds/removes expenses/splits — exactly the transitions that were buggy.
  it.each([
    // dealType, hasExpense, hasSplit -> suggestGuarantee, suggestDoorDeal, orphanExpense, orphanSplit
    ['guarantee', false, false, true, false, false, false],
    ['guarantee', false, true, true, false, false, true], // leftover split from a former doordeal
    ['guarantee', true, false, false, false, false, false],
    ['guarantee', true, true, false, false, false, true],

    ['door_deal', false, false, false, true, false, false],
    ['door_deal', false, true, false, false, false, false],
    ['door_deal', true, false, false, true, true, false], // leftover fixed-fee expense from a former guarantee
    ['door_deal', true, true, false, false, true, false],

    ['guarantee_plus_door', false, false, true, false, false, false],
    ['guarantee_plus_door', false, true, true, false, false, true], // combo never uses a manual split
    ['guarantee_plus_door', true, false, false, false, false, false],
    ['guarantee_plus_door', true, true, false, false, false, true],

    // No deal at all (deal removed): nothing deal-driven, leftovers are ambiguous
    [null, true, true, false, false, false, false],
    [undefined, true, true, false, false, false, false],
  ] as [string | null | undefined, boolean, boolean, boolean, boolean, boolean, boolean][])(
    '%s (expense=%s, split=%s) -> sG=%s sD=%s oExp=%s oSplit=%s',
    (dealType, hasExpense, hasSplit, sG, sD, oExp, oSplit) => {
      const r = bandDealIssues({ ...base, dealType, hasExpense, hasSplit })
      expect(r.suggestGuarantee).toBe(sG)
      expect(r.suggestDoorDeal).toBe(sD)
      expect(r.orphanExpense).toBe(oExp)
      expect(r.orphanSplit).toBe(oSplit)
    },
  )

  describe('amountMismatch', () => {
    it('flags a guarantee expense whose amount differs from the deal', () => {
      const r = bandDealIssues({
        dealType: 'guarantee', hasExpense: true, hasSplit: false,
        expenseAmount: 285, expectedAmount: 200, mismatchAcknowledged: false,
      })
      expect(r.amountMismatch).toBe(true)
    })

    it('flags a combo expense whose amount differs from the resolved amount', () => {
      const r = bandDealIssues({
        dealType: 'guarantee_plus_door', hasExpense: true, hasSplit: false,
        expenseAmount: 285, expectedAmount: 272.36, mismatchAcknowledged: false,
      })
      expect(r.amountMismatch).toBe(true)
    })

    it('does not flag when the amounts match (within a cent)', () => {
      const r = bandDealIssues({
        dealType: 'guarantee', hasExpense: true, hasSplit: false,
        expenseAmount: 200.004, expectedAmount: 200, mismatchAcknowledged: false,
      })
      expect(r.amountMismatch).toBe(false)
    })

    it('does not flag once the mismatch has been acknowledged', () => {
      const r = bandDealIssues({
        dealType: 'guarantee', hasExpense: true, hasSplit: false,
        expenseAmount: 285, expectedAmount: 200, mismatchAcknowledged: true,
      })
      expect(r.amountMismatch).toBe(false)
    })

    it('never flags a pure door_deal (no fixed-fee expense expected)', () => {
      const r = bandDealIssues({
        dealType: 'door_deal', hasExpense: true, hasSplit: false,
        expenseAmount: 285, expectedAmount: 0, mismatchAcknowledged: false,
      })
      expect(r.amountMismatch).toBe(false)
    })

    it('does not flag when there is no expense yet', () => {
      const r = bandDealIssues({
        dealType: 'guarantee', hasExpense: false, hasSplit: false,
        expenseAmount: null, expectedAmount: 200, mismatchAcknowledged: false,
      })
      expect(r.amountMismatch).toBe(false)
    })
  })
})
