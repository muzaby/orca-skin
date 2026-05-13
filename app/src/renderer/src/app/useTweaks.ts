import { useCallback, useState } from 'react'

export function useTweaks<T extends object>(
  defaults: T
): [T, <K extends keyof T>(key: K, val: T[K]) => void] {
  const [values, setValues] = useState<T>(defaults)
  const setTweak = useCallback(<K extends keyof T>(key: K, val: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: val }))
  }, [])
  return [values, setTweak]
}
