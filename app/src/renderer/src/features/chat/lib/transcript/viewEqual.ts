export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (typeof a !== 'object') return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false
    }
    return true
  }
  if (Array.isArray(b) || b instanceof Map) return false
  const recA = a as Record<string, unknown>
  const recB = b as Record<string, unknown>
  const keysA = Object.keys(recA)
  const keysB = Object.keys(recB)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(recB, key)) return false
    if (!deepEqual(recA[key], recB[key])) return false
  }
  return true
}
