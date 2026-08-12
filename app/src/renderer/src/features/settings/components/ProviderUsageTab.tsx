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
  setProviderLimit,
  syncProviderUsage,
  useProviderUsage,
  useProviderUsageUpdatedAt
} from '../../../shared/stores/usageStore'

export function ProviderUsageTab({ provider }: { provider: AgentEnvironment }): React.JSX.Element {
  const [view, setView] = useState<'root' | 'limit'>('root')
  const [refreshing, setRefreshing] = useState(false)
  // 0186 r6 (D23) — 동기화 실패를 이 화면에서만 알린다. 전역 toast 를 만들지 않는 이유는
  // 실패가 이 provider 의 사실이고, 사용자가 보고 있는 자리가 여기이기 때문이다.
  const [refreshFailed, setRefreshFailed] = useState(false)
  const { tr, locale } = useI18n()
  const usageLimits = useProviderUsage(provider.key)
  // **이 provider** 를 마지막으로 받은 시각. 전역 타임스탬프를 쓰면 다른 provider 를 갱신한
  // 시각이 여기 "마지막 반영" 으로 뜬다 — mirror scope 와 timestamp scope 가 어긋난다.
  const updatedAt = useProviderUsageUpdatedAt(provider.key)

  // 서브탭에 처음 들어온 provider 를 확보한다 — 이후 갱신은 delta push 가 맡는다.
  // 의존에 `usageLimits` 가 함께 있어야 자정 경계 무효화(스토어의 provider map 비움) 후에도
  // 같은 키로 다시 채워진다. `ensureProviderUsage` 가 값이 있으면 조기 반환해 루프는 없다.
  useEffect(() => {
    if (usageLimits) return
    void ensureProviderUsage(provider.key)
  }, [provider.key, usageLimits])

  // 동기화 = **원격 즉시 조회**(`cost:refreshUsage`). 캐시 재조회가 아니다 — 그러면 버튼이
  // 1분 cron 이 이미 써 둔 값을 다시 읽을 뿐이라 사용자가 기대한 "지금 갱신" 이 되지 않는다.
  const onRefresh = useCallback(() => {
    void (async () => {
      setRefreshing(true)
      setRefreshFailed(false) // 재시도 시작 = 이전 실패 표시를 지운다
      try {
        await syncProviderUsage(provider.key)
      } catch {
        // Main command 가 reject 하면 기존 mirror/timestamp 를 **유지한 채** 실패만 알린다 —
        // 마지막으로 성공한 값이 사라지면 사용자가 비교할 기준을 잃는다.
        setRefreshFailed(true)
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
          {refreshFailed && <p className="m-0 text-[12px] text-red">{tr('usage.refreshFailed')}</p>}
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
