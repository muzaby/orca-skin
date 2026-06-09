import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { CostSummary } from '../../../../../shared/ipc'
import { costApi } from '../../../shared/api/ipc'

const ZERO_TOTALS = {
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0
}

const INITIAL_SUMMARY: CostSummary = {
  day: { ...ZERO_TOTALS },
  week: { ...ZERO_TOTALS },
  month: { ...ZERO_TOTALS }
}

interface CostContextValue {
  summary: CostSummary
  loading: boolean
}

const CostContext = createContext<CostContextValue | null>(null)

export function CostProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [summary, setSummary] = useState<CostSummary>(INITIAL_SUMMARY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void costApi
      .summary()
      .then((next) => {
        if (!alive) return
        setSummary(next)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    const off = costApi.onSummary((next) => {
      setSummary(next)
      setLoading(false)
    })
    return () => {
      alive = false
      off()
    }
  }, [])

  return <CostContext.Provider value={{ summary, loading }}>{children}</CostContext.Provider>
}

export function useCost(): CostContextValue {
  const ctx = useContext(CostContext)
  if (!ctx) throw new Error('useCost must be used within CostProvider')
  return ctx
}
