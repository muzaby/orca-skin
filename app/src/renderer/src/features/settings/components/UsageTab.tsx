// 설정 모달 '사용량' 탭(전역) — 사용량 한도 바/한도 설정은 provider 하위 탭(ProviderUsageTab)
// 으로 이관됐다(0081). 이 전역 탭은 Claude Code `/cost` 유사 요약(총비용·토큰·모델별 내역)의
// 자리와 주기적 사용량 새로고침 설정을 담는다.
// SyncRow/CostRefreshView 는 provider 서브탭이 재사용하므로 여기 정의를 유지한다.

import { useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Toggle } from '../../../shared/ui/Toggle'
import { useI18n } from '../../../shared/i18n'
import { useTweakContext } from '../../../shared/theme'
import { SettingsGroup, SettingsRow } from './parts'
import {
  CUSTOM_USAGE_RECOMPUTE_PRESET,
  USAGE_RECOMPUTE_PRESETS,
  isUsageCronInputEnabled,
  usageRecomputeSelectValue
} from '../lib/usageSchedule'

export interface CostRefreshView {
  label: string | null
  refreshing: boolean
  onRefresh: () => void
}

// "마지막 업데이트: <라벨> <새로고침 버튼(inflight spin)>" (0080). provider 서브탭이 재사용.
export function SyncRow({ label, refreshing, onRefresh }: CostRefreshView): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="flex items-center gap-2 text-[12px] text-ink3">
      <span>
        {tr('usage.lastUpdated')}: {label ?? '—'}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={tr('usage.refreshAria')}
        className="grid h-6 w-6 place-items-center rounded-r4 text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2 disabled:cursor-not-allowed"
      >
        <Icon name="refresh" size={13} className={refreshing ? 'animate-spin' : undefined} />
      </button>
    </div>
  )
}

// 전역 사용량 요약 — /cost 유사 기능 예고 + 추후 구현 안내(0081) + 주기적 실행 설정(0099).
export function UsageTab(): React.JSX.Element {
  const { tr } = useI18n()
  const { t, setTweak } = useTweakContext()
  const [customSelected, setCustomSelected] = useState(false)
  const cron = t.scheduler.usageRecompute.cron
  const selectValue = usageRecomputeSelectValue(cron, customSelected)
  const cronInputEnabled = isUsageCronInputEnabled(selectValue)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{tr('settings.usage.title')}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">
          {tr('settings.usage.descPrefix')}
          <span className="font-mono text-[12px] text-ink">/cost</span>
          {tr('settings.usage.descSuffix')}
        </p>
      </div>

      <SettingsGroup title={tr('settings.usage.scheduling')}>
        <SettingsRow
          label={tr('settings.usage.usageRecompute')}
          description={tr('settings.usage.usageRecomputeDesc')}
        >
          <Toggle
            on={t.scheduler.usageRecompute.enabled}
            onClick={() =>
              setTweak('scheduler', {
                ...t.scheduler,
                usageRecompute: {
                  ...t.scheduler.usageRecompute,
                  enabled: !t.scheduler.usageRecompute.enabled
                }
              })
            }
            label={tr('settings.usage.usageRecomputeToggle')}
          />
        </SettingsRow>

        <SettingsRow
          label={tr('settings.usage.refreshInterval')}
          description={tr('settings.usage.refreshIntervalDesc')}
        >
          <div className="flex flex-col gap-2">
            <select
              value={selectValue}
              onChange={(e) => {
                if (e.target.value === CUSTOM_USAGE_RECOMPUTE_PRESET) {
                  setCustomSelected(true)
                  return
                }
                setCustomSelected(false)
                setTweak('scheduler', {
                  ...t.scheduler,
                  usageRecompute: { ...t.scheduler.usageRecompute, cron: e.target.value }
                })
              }}
              className="cursor-pointer rounded-r4 border border-border bg-bg px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-border-strong"
            >
              {USAGE_RECOMPUTE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {tr(preset.labelKey)}
                </option>
              ))}
              <option value={CUSTOM_USAGE_RECOMPUTE_PRESET}>
                {tr('settings.usage.presetCustom')}
              </option>
            </select>
            <input
              key={`${cron}:${selectValue}`}
              defaultValue={cron}
              disabled={!cronInputEnabled}
              aria-disabled={!cronInputEnabled}
              onBlur={(e) => {
                const next = e.currentTarget.value.trim()
                if (!next || next === cron) return
                setCustomSelected(false)
                setTweak('scheduler', {
                  ...t.scheduler,
                  usageRecompute: { ...t.scheduler.usageRecompute, cron: next }
                })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              aria-label={tr('settings.usage.cronAria')}
              className={`w-48 rounded-r4 border border-border bg-bg px-2.5 py-1.5 font-mono text-[12.5px] outline-none focus:border-border-strong ${
                cronInputEnabled ? 'text-ink' : 'cursor-not-allowed text-ink3 opacity-70'
              }`}
            />
          </div>
        </SettingsRow>
      </SettingsGroup>

      <div className="flex flex-col items-center gap-1.5 rounded-r4 border border-dashed border-border px-4 py-8 text-center">
        <Icon name="chart" size={20} className="text-ink3" />
        <div className="text-[13px] font-medium text-ink2">{tr('settings.usage.comingSoon')}</div>
        <p className="text-[12px] text-ink3">{tr('settings.usage.comingSoonDesc')}</p>
      </div>
    </div>
  )
}
