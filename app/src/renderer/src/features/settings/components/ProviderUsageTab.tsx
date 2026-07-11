// 설정 사용량 provider별 서브탭(0080 항목 4) — 한 provider(agent key)의 실사용 한도 바 +
// 자기 월 한도 설정. 데이터/저장 콜백은 app 레이어가 주입한 ProviderUsageController 에서 온다.

import { useState } from 'react'
import type { AgentEnvironment, ProviderUsageEntry } from '../../../../../shared/ipc'
import { computeUsageLimits } from '../../../../../shared/usage/limits'
import { relativeTimeLabel } from '../../../../../shared/time/relative'
import { SettingsGroup } from './parts'
import { Icon } from '../../../shared/ui/Icon'
import { useI18n } from '../../../shared/i18n'
import { LimitBarsSection, LimitEditor } from './UsageLimitViews'
import { SyncRow } from './UsageTab'
import { fmtUsd, providerLabel } from '../lib/usageFormat'

export function ProviderUsageTab({
  provider,
  entry,
  refreshing,
  onRefresh,
  onSetLimit
}: {
  provider: AgentEnvironment
  entry: ProviderUsageEntry | undefined
  refreshing: boolean
  onRefresh: () => void
  onSetLimit: (limitUsd: number | null) => Promise<void>
}): React.JSX.Element {
  const [view, setView] = useState<'root' | 'limit'>('root')
  const { tr, locale } = useI18n()
  const usageLimits = entry
    ? computeUsageLimits(entry.summary, entry.limitUsd, undefined, locale)
    : null
  const limitUsd = entry?.limitUsd ?? null

  if (view === 'limit') {
    return (
      <LimitEditor
        title={tr('usage.setLimitTitle', { provider: providerLabel(provider) })}
        limit={limitUsd}
        onSave={(v) => {
          void onSetLimit(v)
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
            label={entry ? relativeTimeLabel(entry.summary.updatedAt, undefined, locale) : null}
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
            <div className="mt-0.5 text-[12px] text-ink3">{tr('usage.monthlyLimitDesc')}</div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <span className="text-[12.5px] tabular-nums text-ink2">
              {limitUsd == null ? tr('common.unlimited') : fmtUsd(limitUsd)}
            </span>
            <Icon name="chevR" size={14} />
          </div>
        </button>
      </section>
    </div>
  )
}
