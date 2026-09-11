import { ref, type Ref } from 'vue'

type SortDir = 'asc' | 'desc'

export function useSort<T>(initialKey = '', initialDir: SortDir = 'asc') {
  const sortKey = ref(initialKey) as Ref<string>
  const sortDir = ref<SortDir>(initialDir)

  function toggle(key: string, initialDir: SortDir = 'desc') {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = initialDir
    }
  }

  function indicator(key: string): string {
    if (sortKey.value !== key) return ''
    return sortDir.value === 'asc' ? ' ▲' : ' ▼'
  }

  function sorted(items: T[], accessor: (item: T, key: string) => number | string): T[] {
    if (!sortKey.value) return items
    const dir = sortDir.value === 'asc' ? 1 : -1
    return [...items].sort((a, b) => {
      const va = accessor(a, sortKey.value)
      const vb = accessor(b, sortKey.value)
      return va < vb ? -dir : va > vb ? dir : 0
    })
  }

  return { sortKey, sortDir, toggle, indicator, sorted }
}
