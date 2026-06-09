import { createContext, useContext } from 'react'
import type { CostSummary } from '../../../../../shared/ipc'

export interface CostContextValue {
  summary: CostSummary | null
}

export const CostContext = createContext<CostContextValue | null>(null)

export function useCost(): CostContextValue {
  const ctx = useContext(CostContext)
  if (!ctx) throw new Error('useCost must be used within CostProvider')
  return ctx
}
