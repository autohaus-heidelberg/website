import { describe, it, expect } from 'vitest'
import { useSort } from '../useSort'

describe('useSort', () => {
  const items = [
    { name: 'Banana', price: 2 },
    { name: 'Apple', price: 3 },
    { name: 'Cherry', price: 1 },
  ]
  const accessor = (item: typeof items[0], key: string) =>
    item[key as keyof typeof item] as number | string

  it('returns items unsorted when no key is set', () => {
    const { sorted } = useSort<typeof items[0]>()
    expect(sorted(items, accessor)).toEqual(items)
  })

  it('sorts descending on first toggle', () => {
    const { toggle, sorted } = useSort<typeof items[0]>()
    toggle('price')
    const result = sorted(items, accessor)
    expect(result[0].name).toBe('Apple')   // price 3
    expect(result[2].name).toBe('Cherry')  // price 1
  })

  it('sorts ascending on second toggle of same key', () => {
    const { toggle, sorted } = useSort<typeof items[0]>()
    toggle('price')
    toggle('price')
    const result = sorted(items, accessor)
    expect(result[0].name).toBe('Cherry')  // price 1
    expect(result[2].name).toBe('Apple')   // price 3
  })

  it('resets to descending when toggling a different key', () => {
    const { toggle, sortDir, sortKey } = useSort<typeof items[0]>()
    toggle('price')
    toggle('price') // now asc
    toggle('name')  // switch key → desc
    expect(sortKey.value).toBe('name')
    expect(sortDir.value).toBe('desc')
  })

  it('indicator shows arrow for active key', () => {
    const { toggle, indicator } = useSort<typeof items[0]>()
    toggle('price')
    expect(indicator('price')).toBe(' ▼')
    expect(indicator('name')).toBe('')
  })

  it('indicator toggles between arrows', () => {
    const { toggle, indicator } = useSort<typeof items[0]>()
    toggle('price')
    expect(indicator('price')).toBe(' ▼')
    toggle('price')
    expect(indicator('price')).toBe(' ▲')
  })

  it('does not mutate original array', () => {
    const { toggle, sorted } = useSort<typeof items[0]>()
    toggle('price')
    const result = sorted(items, accessor)
    expect(result).not.toBe(items)
    expect(items[0].name).toBe('Banana') // unchanged
  })

  it('sorts strings correctly', () => {
    const { toggle, sorted } = useSort<typeof items[0]>()
    toggle('name')
    const result = sorted(items, accessor)
    // desc: Cherry, Banana, Apple
    expect(result[0].name).toBe('Cherry')
    expect(result[2].name).toBe('Apple')
  })
})
