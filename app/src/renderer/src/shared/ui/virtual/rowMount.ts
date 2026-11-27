import { createContext, useContext, useLayoutEffect, useRef } from 'react'
export const VirtualRowMountContext = createContext<(() => void) | null>(null)
export function useMountedRows(keys: readonly (string | number | bigint)[]): void {
  const notify = useContext(VirtualRowMountContext)
  const previous = useRef(new Set<string | number | bigint>())
  useLayoutEffect(() => {
    const added = keys.some((key) => !previous.current.has(key))
    previous.current = new Set(keys)
    if (added) notify?.()
  })
}
