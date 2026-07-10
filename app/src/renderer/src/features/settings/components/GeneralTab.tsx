import { useEffect, useState } from 'react'
import { useTweakContext } from '../../../shared/theme'
import { settingsApi } from '../../../shared/api/ipc'
import { Toggle } from '../../../shared/ui/Toggle'
import { Icon } from '../../../shared/ui/Icon'
import { AutoGrowTextarea } from '../../../shared/ui/AutoGrowTextarea'
import type { ThemeId } from '../../../shared/config/theme'
import type { AppFontId } from '../../../shared/hooks/useTweaks'
import { SettingsGroup, SettingsRow } from './parts'

const ACCOUNT_PLACEHOLDER = '예: 자세한 설명을 하기 전에 질문을 해주세요.'

const FONT_OPTIONS: { value: AppFontId; label: string }[] = [
  { value: 'sans', label: '산세리프 (Inter)' },
  { value: 'serif', label: '세리프 (Source Serif)' },
  { value: 'mono', label: '모노 (JetBrains Mono)' }
]

const USAGE_RECOMPUTE_PRESETS = [
  { value: '0 */1 * * *', label: '매시간' },
  { value: '*/30 * * * *', label: '30분마다' },
  { value: '0 9 * * *', label: '매일 오전 9시' }
]

const THEME_OPTIONS: { value: ThemeId; label: string; icon: 'sun' | 'moon' }[] = [
  { value: 'white', label: '화이트', icon: 'sun' },
  { value: 'dark', label: '다크', icon: 'moon' }
]

// 설정 모달 '일반' 탭 — 프로필(계정 지침) / 환경설정(모양·폰트) / 알림(응답완료).
// theme·appFont·notifyOnComplete 는 Tweak 컨텍스트(영속 자동), accountInstructions 는
// 대용량 텍스트라 컨텍스트에 두지 않고 이 탭이 settingsApi 로 직접 로드/저장한다.
export function GeneralTab(): React.JSX.Element {
  const { t, setTweak } = useTweakContext()

  // 계정 지침 — 저장값(saved) vs 편집 중(draft). draft≠saved 면 저장 버튼 노출.
  const [saved, setSaved] = useState('')
  const [draft, setDraft] = useState('')
  useEffect(() => {
    let cancelled = false
    void settingsApi.get().then((s) => {
      if (cancelled) return
      setSaved(s.accountInstructions)
      setDraft(s.accountInstructions)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const dirty = draft !== saved
  const onSave = (): void => {
    void settingsApi.set({ accountInstructions: draft })
    setSaved(draft)
  }

  return (
    <div>
      <SettingsGroup title="프로필">
        <SettingsRow
          label="계정 지침"
          description="모든 대화에 적용되는 지침입니다. 저장 후 영속되며, 시스템 프롬프트 배선은 추후 제공됩니다."
          stacked
        >
          <AutoGrowTextarea
            value={draft}
            onChange={setDraft}
            placeholder={ACCOUNT_PLACEHOLDER}
            ariaLabel="계정 지침"
            className="min-h-[76px] max-h-56"
          />
          {dirty && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDraft(saved)}
                className="cursor-pointer rounded-r4 border border-border bg-transparent px-3.5 py-1.5 text-[12.5px] font-medium text-ink hover:bg-fill-uncontained-hover"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onSave}
                className="cursor-pointer rounded-r4 border-0 bg-ink px-3.5 py-1.5 text-[12.5px] font-medium text-bg hover:bg-t8"
              >
                저장
              </button>
            </div>
          )}
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="환경설정">
        <SettingsRow label="모양" description="앱 색상 테마">
          <div className="flex gap-1 rounded-r5 border border-border p-0.5">
            {THEME_OPTIONS.map((opt) => {
              const active = t.theme === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTweak('theme', opt.value)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-r4 border-0 px-2.5 py-1 text-[12.5px] transition-colors ${
                    active
                      ? 'bg-fill-selected text-ink'
                      : 'bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2'
                  }`}
                >
                  <Icon name={opt.icon} size={14} />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </SettingsRow>

        <SettingsRow label="폰트" description="앱 전체에 적용되는 글꼴">
          <select
            value={t.appFont}
            onChange={(e) => setTweak('appFont', e.target.value as AppFontId)}
            className="cursor-pointer rounded-r4 border border-border bg-bg px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-border-strong"
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="주기적 실행">
        <SettingsRow
          label="사용량 새로고침"
          description="앱이 실행 중일 때만 저장된 주기에 따라 사용량 집계를 다시 계산합니다."
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
            label="주기적 사용량 새로고침"
          />
        </SettingsRow>

        <SettingsRow label="새로고침 주기" description="cron 표현식 또는 기본 프리셋을 선택하세요.">
          <div className="flex flex-col gap-2">
            <select
              value={
                USAGE_RECOMPUTE_PRESETS.some((p) => p.value === t.scheduler.usageRecompute.cron)
                  ? t.scheduler.usageRecompute.cron
                  : 'custom'
              }
              onChange={(e) => {
                if (e.target.value === 'custom') return
                setTweak('scheduler', {
                  ...t.scheduler,
                  usageRecompute: { ...t.scheduler.usageRecompute, cron: e.target.value }
                })
              }}
              className="cursor-pointer rounded-r4 border border-border bg-bg px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-border-strong"
            >
              {USAGE_RECOMPUTE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">직접 입력</option>
            </select>
            <input
              key={t.scheduler.usageRecompute.cron}
              defaultValue={t.scheduler.usageRecompute.cron}
              onBlur={(e) => {
                const next = e.currentTarget.value.trim()
                if (!next || next === t.scheduler.usageRecompute.cron) return
                setTweak('scheduler', {
                  ...t.scheduler,
                  usageRecompute: { ...t.scheduler.usageRecompute, cron: next }
                })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              aria-label="사용량 새로고침 cron"
              className="w-48 rounded-r4 border border-border bg-bg px-2.5 py-1.5 font-mono text-[12.5px] text-ink outline-none focus:border-border-strong"
            />
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="알림">
        <SettingsRow
          label="응답 완료"
          description="Agent가 응답을 완료하면 알림을 받습니다. (앱 창이 비활성일 때만 표시)"
        >
          <Toggle
            on={t.notifyOnComplete}
            onClick={() => setTweak('notifyOnComplete', !t.notifyOnComplete)}
            label="응답 완료 알림"
          />
        </SettingsRow>
      </SettingsGroup>
    </div>
  )
}
