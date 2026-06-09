import { useEffect, useState, type ReactNode } from 'react'
import type { CostSummary } from '../../../../../shared/ipc'
import { costApi } from '../../../shared/api/ipc'
import { CostContext } from './costContext'

export function CostProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [summary, setSummary] = useState<CostSummary | null>(null)

  useEffect(() => {
    let alive = true
    void costApi.summary().then((next) => {
      if (alive) setSummary(next)
    })
    const unsubscribe = costApi.onSummary((next) => setSummary(next))
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  return <CostContext.Provider value={{ summary }}>{children}</CostContext.Provider>
}
