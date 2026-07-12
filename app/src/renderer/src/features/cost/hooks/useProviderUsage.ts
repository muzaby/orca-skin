// provider별 사용량 컨트롤러(설정 사용량 서브항목, 0080 항목 4). 구성된 provider(agent key)를
// shared agentStore 에서 얻고, key 마다 실사용 summary + 월 한도를 main 에서 조회한다. 각 provider
// 서브탭이 computeUsageLimits(entry.summary, entry.limitUsd)로 자기 한도 바를 그린다.

import { useCallback, useEffect, useState } from 'react'
import type { AgentEnvironment, ProviderUsageEntry } from '../../../../../shared/ipc'
import { costApi } from '../../../shared/api/ipc'
import { useAgentStore } from '../../../shared/stores/agentStore'

export interface ProviderUsageController {
  providers: AgentEnvironment[]
  entryFor: (key: string) => ProviderUsageEntry | undefined
  refreshing: boolean
  refresh: () => void
  setLimit: (key: string, limitUsd: number | null) => Promise<void>
}

export function useProviderUsage(): ProviderUsageController {
  const providers = useAgentStore((s) => s.agents)
  const ensureLoaded = useAgentStore((s) => s.ensureLoaded)
  const [entries, setEntries] = useState<Record<string, ProviderUsageEntry>>({})
  const [refreshing, setRefreshing] = useState(false)

  // agent 목록을 최초 1회 확보(엔진&모델 페이지를 안 거쳐도 provider 서브항목이 나오도록).
  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  // provider key 목록을 문자열로 직렬화해 deps 안정화(useCallback 재생성 최소화).
  const keys = providers.map((p) => p.key).join(' ')

  // 순수 조회(setState 없음) — 효과/이벤트 양쪽이 await 뒤에 결과를 반영한다.
  const fetchEntries = useCallback(async (): Promise<Record<string, ProviderUsageEntry>> => {
    const providerKeys = keys ? keys.split(' ') : []
    if (providerKeys.length === 0) return {}
    const list = await costApi.providerSummaries(providerKeys)
    return Object.fromEntries(list.map((e) => [e.providerKey, e]))
  }, [keys])

  // provider 목록이 바뀌면 다시 조회. setEntries 는 await 이후라 effect 동기 setState 아님.
  useEffect(() => {
    let cancelled = false
    void fetchEntries().then((next) => {
      if (!cancelled) setEntries(next)
    })
    return () => {
      cancelled = true
    }
  }, [fetchEntries, keys])

  const refresh = useCallback(() => {
    void (async () => {
      setRefreshing(true)
      try {
        const providerKeys = keys ? keys.split(' ') : []
        if (providerKeys.length > 0) {
          const refreshed = await Promise.all(
            providerKeys.map((key) => costApi.refreshProviderUsageReport(key))
          )
          setEntries(Object.fromEntries(refreshed.map((e) => [e.providerKey, e])))
        } else {
          setEntries(await fetchEntries())
        }
      } finally {
        setRefreshing(false)
      }
    })()
  }, [fetchEntries, keys])

  const setLimit = useCallback(async (key: string, limitUsd: number | null): Promise<void> => {
    const updated = await costApi.setProviderLimit(key, limitUsd)
    setEntries((prev) => ({ ...prev, [updated.providerKey]: updated }))
  }, [])

  return {
    providers,
    entryFor: (key) => entries[key],
    refreshing,
    refresh,
    setLimit
  }
}
