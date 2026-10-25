import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CLAUDE_OUTPUT_STYLES,
  DEFAULT_CLAUDE_OUTPUT_STYLE,
  type ClaudeOutputStyle
} from '../../../../../shared/harness'
import type { Backend } from '../../../../../shared/ipc'
import { reportError } from '../../../shared/errors'
import { useTweakContext } from '../../../shared/theme'
import { settingsApi } from '../../../shared/api/ipc'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Toggle } from '../../../shared/ui/Toggle'
import { AutoGrowTextarea } from '../../../shared/ui/AutoGrowTextarea'
import { useI18n, type UiLocale } from '../../../shared/i18n'
import type { ThemeId } from '../../../shared/config/theme'
import type { AppFontId } from '../../../shared/theme'
import {
  TRANSCRIPT_TEXT_SIZES,
  TRANSCRIPT_WIDTHS,
  UPDATE_CHECK_INTERVAL_HOURS,
  type TranscriptTextSize,
  type TranscriptWidth
} from '../../../../../shared/ipc'
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

// 대화 내용 텍스트 크기 · 대화 기록 너비(0256). 값 순서는 ipc.ts 배열이 SSOT — 라벨 키만 여기서 붙인다.
const TEXT_SIZE_LABEL_KEYS = {
  small: 'settings.general.transcriptTextSizeSmall',
  medium: 'settings.general.transcriptTextSizeMedium',
  large: 'settings.general.transcriptTextSizeLarge'
} as const satisfies Record<TranscriptTextSize, string>

const WIDTH_LABEL_KEYS = {
  narrow: 'settings.general.transcriptWidthNarrow',
  medium: 'settings.general.transcriptWidthMedium',
  wide: 'settings.general.transcriptWidthWide'
} as const satisfies Record<TranscriptWidth, string>

// 언어 이름은 해당 언어 자체 표기(자기 언어로 항상 읽을 수 있어야 함) — 번역 대상 아님.
const LOCALE_OPTIONS: { value: UiLocale; label: string }[] = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' }
]

// 설정 모달 '일반' 탭 — 프로필(계정 지침) / 환경설정(모양·폰트·언어) / 알림(응답완료) /
// 업데이트(자동 확인 주기).
// theme·appFont·uiLocale·notifyOnComplete 는 Tweak 컨텍스트(영속 자동). accountInstructions 는
// 대용량 텍스트라, scheduler.updateCheck 는 중첩 키라 컨텍스트에 두지 않고 settingsApi 로 직접
// 로드/저장한다(Tweaks의 flat 패치로는 중첩 키를 표현할 수 없다).
export function GeneralTab({
  harnessBrand
}: {
  harnessBrand?: (backend: Backend) => ReactNode
}): React.JSX.Element {
  const { t, setTweak } = useTweakContext((t) => ({
    theme: t.theme,
    appFont: t.appFont,
    uiLocale: t.uiLocale,
    transcriptTextSize: t.transcriptTextSize,
    transcriptWidth: t.transcriptWidth,
    notifyOnComplete: t.notifyOnComplete
  }))
  const { tr } = useI18n()
  // 자동 업데이트 확인 주기 — 중첩 설정이라 Tweaks 가 아니라 전용 훅으로 바인딩(0156).
  const [updateCheck, setUpdateCheck] = useUpdateCheckSetting()

  // 계정 지침 — 저장값(saved) vs 편집 중(draft). draft≠saved 면 저장 버튼 노출.
  const [outputStyle, setOutputStyle] = useState<ClaudeOutputStyle>(DEFAULT_CLAUDE_OUTPUT_STYLE)
  const [autoApprove, setAutoApprove] = useState(false)
  const [harnessLoaded, setHarnessLoaded] = useState(false)
  const [savingHarness, setSavingHarness] = useState(false)
  const savingRef = useRef(false)
  const [saved, setSaved] = useState('')
  const [draft, setDraft] = useState('')
  useEffect(() => {
    let cancelled = false
    void settingsApi
      .get()
      .then((s) => {
        if (cancelled) return
        setOutputStyle(s.harnesses?.claude?.outputStyle ?? DEFAULT_CLAUDE_OUTPUT_STYLE)
        setAutoApprove(s.harnesses?.opencode?.autoApprovePermissions ?? false)
        setHarnessLoaded(true)
        setSaved(s.accountInstructions)
        setDraft(s.accountInstructions)
      })
      .catch((error) =>
        reportError({
          event: 'settings.harness.load-failed',
          scope: 'settings',
          title: 'loadFailed',
          error
        })
      )
    return () => {
      cancelled = true
    }
  }, [])
  const dirty = draft !== saved
  const onSave = (): void => {
    void settingsApi.set({ accountInstructions: draft })
    setSaved(draft)
  }

  const saveHarness = async (
    patch: import('../../../../../shared/ipc').SettingsPatch
  ): Promise<void> => {
    if (savingRef.current) return
    savingRef.current = true
    setSavingHarness(true)
    try {
      const next = await settingsApi.set(patch)
      setOutputStyle(next.harnesses?.claude?.outputStyle ?? DEFAULT_CLAUDE_OUTPUT_STYLE)
      setAutoApprove(next.harnesses?.opencode?.autoApprovePermissions ?? false)
    } catch (error) {
      reportError({
        event: 'settings.harness.save-failed',
        scope: 'settings',
        title: 'saveFailed',
        error
      })
    } finally {
      savingRef.current = false
      setSavingHarness(false)
    }
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
          label={tr('settings.general.transcriptTextSize')}
          description={tr('settings.general.transcriptTextSizeDesc')}
        >
          <SettingsSelect
            value={t.transcriptTextSize}
            options={TRANSCRIPT_TEXT_SIZES.map((value) => ({
              value,
              label: tr(TEXT_SIZE_LABEL_KEYS[value])
            }))}
            onChange={(v) => setTweak('transcriptTextSize', v)}
          />
        </SettingsRow>

        <SettingsRow
          label={tr('settings.general.transcriptWidth')}
          description={tr('settings.general.transcriptWidthDesc')}
        >
          <SettingsSelect
            value={t.transcriptWidth}
            options={TRANSCRIPT_WIDTHS.map((value) => ({
              value,
              label: tr(WIDTH_LABEL_KEYS[value])
            }))}
            onChange={(v) => setTweak('transcriptWidth', v)}
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
      <SettingsGroup title={tr('settings.general.claude')} leading={harnessBrand?.('claude')}>
        <SettingsRow
          label={tr('settings.general.outputStyle')}
          description={tr('settings.general.outputStyleDesc')}
        >
          <SettingsSelect
            label={tr('settings.general.outputStyle')}
            value={outputStyle}
            disabled={!harnessLoaded || savingHarness}
            options={CLAUDE_OUTPUT_STYLES.map((value) => ({ value, label: value }))}
            onChange={(value) =>
              void saveHarness({ harnesses: { claude: { outputStyle: value } } })
            }
          />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title={tr('settings.general.opencode')} leading={harnessBrand?.('opencode')}>
        <SettingsRow
          label={tr('settings.general.autoApprove')}
          description={tr('settings.general.autoApproveDesc')}
        >
          <Toggle
            on={autoApprove}
            disabled={!harnessLoaded || savingHarness}
            label={tr('settings.general.autoApproveToggle')}
            onClick={() =>
              void saveHarness({
                harnesses: { opencode: { autoApprovePermissions: !autoApprove } }
              })
            }
          />
        </SettingsRow>
      </SettingsGroup>
    </div>
  )
}
