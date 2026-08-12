// 설정 사용량 provider별 서브탭(0080 항목 4) — 한 provider(agent key)의 한도 바 + 월 한도 설정.
//
// 0186 — 상태는 `shared/stores/usageStore`(Main mirror)에서 직접 읽는다. 구 app 레이어 주입
// (`ProviderUsageController`)은 사용량이 feature 안에 있어 교차-feature 를 피하려던 우회였고,
// 스토어가 shared 로 올라가면서 필요가 없어졌다. **여기서 한도를 계산하지 않는다** — Main 이
// 완성한 `UsageLimitsView` 를 표시만 한다.

import { useCallback, useEffect, useState } from 'react'
import type { AgentEnvironment } from '../../../../../shared/ipc'
import { SettingsGroup } from './parts'
import { Icon } from '../../../shared/ui/Icon'
import { formatRelativeTime, useI18n } from '../../../shared/i18n'
import { LimitBarsSection, LimitEditor } from './UsageLimitViews'
import { SyncRow } from './UsageTab'
import { fmtUsd, providerLabel } from '../lib/usageFormat'
import {
  ensureProviderUsage,
  refreshProviderUsage,
  setProviderLimit,
  useProviderUsage,
  useUsageUpdatedAt
} from '../../../shared/stores/usageStore'

export function ProviderUsageTab({ provider }: { provider: AgentEnvironment }): React.JSX.Element {
  const [view, setView] = useState<'root' | 'limit'>('root')
  const [refreshing, setRefreshing] = useState(false)
  const { tr, locale } = useI18n()
  const usageLimits = useProviderUsage(provider.key)
  const updatedAt = useUsageUpdatedAt()

  // 서브탭에 처음 들어온 provider 만 한 번 확보한다 — 이후 갱신은 delta push 가 맡는다.
  useEffect(() => {
    void ensureProviderUsage(provider.key)
  }, [provider.key])

  const onRefresh = useCallback(() => {
    void (async () => {
      setRefreshing(true)
      try {
        await refreshProviderUsage(provider.key)
      } finally {
        setRefreshing(false)
      }
    })()
  }, [provider.key])

  // 적용 중인 한도가 원격에서 왔는지 — 그렇다면 사용자가 입력을 바꿔도 표시값이 안 바뀌므로
  // 그 사실을 밝혀야 한다(U6). 편집기가 다루는 값은 **언제나 사용자 설정값**이다.
  const remoteApplied = usageLimits?.budgetSource === 'remote'
  const configuredLimitUsd = usageLimits?.configuredLimitUsd ?? null

  if (view === 'limit') {
    return (
      <LimitEditor
        title={tr('usage.setLimitTitle', { provider: providerLabel(provider) })}
        limit={configuredLimitUsd}
        onSave={(v) => {
          void setProviderLimit(provider.key, v)
          setView('root')
        }}
        onBack={() => setView('root')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{providerLabel(provider)}</h2>
        <p className="mt-0.5 font-mono text-[11px] text-ink3">{provider.key}</p>
      </div>

      <SettingsGroup title={tr('usage.usageLimit')}>
        <div className="flex flex-col gap-4">
          <LimitBarsSection usageLimits={usageLimits} />
          <SyncRow
            label={updatedAt ? formatRelativeTime(updatedAt, locale) : null}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        </div>
      </SettingsGroup>

      <section>
        <h3 className="mb-3 text-[15px] font-semibold text-ink">{tr('usage.limitSettings')}</h3>
        <button
          type="button"
          onClick={() => setView('limit')}
          className="flex w-full items-center justify-between gap-4 rounded-r4 border border-border bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-fill-uncontained-hover"
        >
          <div className="min-w-0">
            <div className="text-[13px] text-ink">{tr('usage.monthlyLimit')}</div>
            <div className="mt-0.5 text-[12px] text-ink3">
              {remoteApplied ? tr('usage.accountLimitApplied') : tr('usage.monthlyLimitDesc')}
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <span className="text-[12.5px] tabular-nums text-ink2">
              {configuredLimitUsd == null ? tr('common.unlimited') : fmtUsd(configuredLimitUsd)}
            </span>
            <Icon name="chevR" size={14} />
          </div>
        </button>
      </section>
    </div>
  )
}
