import { useCallback, useEffect, useState } from 'react'
import type { DebugMockState } from '../../../../../shared/ipc'
import { debugApi } from '../../../shared/api/ipc'

const DEFAULT_DEBUG_MOCK: DebugMockState = {
  enabled: false,
  scenarioId: 'full',
  contextUsageRatio: 0.3
}

export function useDebugMock(): {
  state: DebugMockState
  setMock: (patch: Partial<DebugMockState>) => void
} {
  const [state, setState] = useState<DebugMockState>(DEFAULT_DEBUG_MOCK)

  useEffect(() => {
    let alive = true
    void debugApi
      .getMock()
      .then((next) => {
        if (alive) setState(next)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const setMock = useCallback((patch: Partial<DebugMockState>): void => {
    setState((prev) => ({ ...prev, ...patch }))
    void debugApi
      .setMock(patch)
      .then((next) => setState(next))
      .catch(() => {})
  }, [])

  return { state, setMock }
}
