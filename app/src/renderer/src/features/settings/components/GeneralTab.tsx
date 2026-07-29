import { useEffect, useState } from 'react'
import { useTweakContext } from '../../../shared/theme'
import { settingsApi } from '../../../shared/api/ipc'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Toggle } from '../../../shared/ui/Toggle'
import { AutoGrowTextarea } from '../../../shared/ui/AutoGrowTextarea'
import { useI18n, type UiLocale } from '../../../shared/i18n'
import type { ThemeId, DensityId } from '../../../shared/config/theme'
import type { AppFontId } from '../../../shared/hooks/useTweaks'
import { UPDATE_CHECK_INTERVAL_HOURS } from '../../../../../shared/ipc'
import { useUpdateCheckSetting } from '../hooks/useUpdateCheckSetting'
import { SettingsGroup, SettingsRow, SettingsSelect } from './parts'

// 옵션 라벨은 언어 전환 시 stale 해지지 않도록 모듈 상수에 키만 두고 컴포넌트 안에서 t() 해석.
const FONT_OPTIONS = [
  { value: 'sans', labelKey: 'settings.general.fontSans' },
  { value: 'serif', labelKey: 'settings.general.fontSerif' },
  { value: 'mono', labelKey: 'settings.general.fontMono' }
] as const satisfies readonly { value: AppFontId; labelKey: string }[]

const THEME_OPTIONS = [
  { value: 'white', labelKey: 'settings.general.themeWhite', icon: 'sun' },
  { value: 'dark', labelKey: 'settings.general.themeDark', icon: 'moon' }
] as const satisfies readonly { value: ThemeId; labelKey: string; icon: 'sun' | 'moon' }[]

// 앱 전역 밀도(루트 font-size 파생 — DENSITY_FONT). 디버그 패널의 밀도 라디오와 같은 t.density Tweak.
const DENSITY_OPTIONS = [
  { value: 'compact', labelKey: 'settings.general.densityCompact' },
  { value: 'normal', labelKey: 'settings.general.densityNormal' },
  { value: 'comfortable', labelKey: 'settings.general.densityComfortable' }
] as const satisfies readonly { value: DensityId; labelKey: string }[]

// 언어 이름은 해당 언어 자체 표기(자기 언어로 항상 읽을 수 있어야 함) — 번역 대상 아님.
const LOCALE_OPTIONS: { value: UiLocale; label: string }[] = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' }
]

// 설정 모달 '일반' 탭 — 프로필(계정 지침) / 환경설정(모양·폰트·언어) / 알림(응답완료) /
// 업데이트(자동 확인 주기).
// theme·appFont·uiLocale·notifyOnComplete 는 Tweak 컨텍스트(영속 자동). accountInstructions 는
// 대용량 텍스트라, scheduler.updateCheck 는 중첩 키라 컨텍스트에 두지 않고 settingsApi 로 직접
// 로드/저장한다(useTweaks 의 flat 패치로는 중첩 키를 표현할 수 없다).
export function GeneralTab(): React.JSX.Element {
  const { t, setTweak } = useTweakContext()
  const { tr } = useI18n()
  // 자동 업데이트 확인 주기 — 중첩 설정이라 Tweaks 가 아니라 전용 훅으로 바인딩(0156).
  const [updateCheck, setUpdateCheck] = useUpdateCheckSetting()

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
      <SettingsGroup title={tr('settings.general.profile')}>
        <SettingsRow
          label={tr('settings.general.accountInstructions')}
          description={tr('settings.general.accountInstructionsDesc')}
          stacked
        >
          <AutoGrowTextarea
            value={draft}
            onChange={setDraft}
            placeholder={tr('settings.general.accountPlaceholder')}
            ariaLabel={tr('settings.general.accountInstructions')}
            className="min-h-[76px] max-h-56"
          />
          {dirty && (
            <div className="flex justify-end gap-2">
              <Button variant="contained" size="small" onClick={() => setDraft(saved)}>
                {tr('common.cancel')}
              </Button>
              <Button variant="primary" size="small" onClick={onSave}>
                {tr('common.save')}
              </Button>
            </div>
          )}
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={tr('settings.general.preferences')}>
        <SettingsRow
          label={tr('settings.general.appearance')}
          description={tr('settings.general.appearanceDesc')}
        >
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
                      ? 'bg-selected-soft text-selected'
                      : 'bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2'
                  }`}
                >
                  <Icon name={opt.icon} size={14} />
                  <span>{tr(opt.labelKey)}</span>
                </button>
              )
            })}
          </div>
        </SettingsRow>

        <SettingsRow
          label={tr('settings.general.font')}
          description={tr('settings.general.fontDesc')}
        >
          <SettingsSelect
            value={t.appFont}
            options={FONT_OPTIONS.map((o) => ({ value: o.value, label: tr(o.labelKey) }))}
            onChange={(v) => setTweak('appFont', v)}
          />
        </SettingsRow>

        <SettingsRow
          label={tr('settings.general.language')}
          description={tr('settings.general.languageDesc')}
        >
          <SettingsSelect
            value={t.uiLocale}
            options={LOCALE_OPTIONS}
            onChange={(v) => setTweak('uiLocale', v)}
          />
        </SettingsRow>

        <SettingsRow
          label={tr('settings.general.density')}
          description={tr('settings.general.densityDesc')}
        >
          <SettingsSelect
            value={t.density}
            options={DENSITY_OPTIONS.map((o) => ({ value: o.value, label: tr(o.labelKey) }))}
            onChange={(v) => setTweak('density', v)}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={tr('settings.general.notifications')}>
        <SettingsRow
          label={tr('settings.general.notifyComplete')}
          description={tr('settings.general.notifyCompleteDesc')}
        >
          <Toggle
            on={t.notifyOnComplete}
            onClick={() => setTweak('notifyOnComplete', !t.notifyOnComplete)}
            label={tr('settings.general.notifyCompleteToggle')}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={tr('settings.general.updates')}>
        <SettingsRow
          label={tr('settings.general.updateAuto')}
          description={tr('settings.general.updateAutoDesc')}
        >
          <Toggle
            on={updateCheck.enabled}
            onClick={() => setUpdateCheck({ enabled: !updateCheck.enabled })}
            label={tr('settings.general.updateAutoToggle')}
          />
        </SettingsRow>

        <SettingsRow
          label={tr('settings.general.updateInterval')}
          description={tr('settings.general.updateIntervalDesc')}
        >
          <SettingsSelect
            value={updateCheck.intervalHours}
            disabled={!updateCheck.enabled}
            options={UPDATE_CHECK_INTERVAL_HOURS.map((hours) => ({
              value: hours,
              label: tr('settings.general.updateIntervalEvery', { count: hours })
            }))}
            onChange={(v) => setUpdateCheck({ intervalHours: v })}
          />
        </SettingsRow>
      </SettingsGroup>
    </div>
  )
}
