import { useEffect, useMemo, useRef, useState } from 'react'
import { engineApi } from '../../../shared/api/ipc'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Modal } from '../../../shared/ui/Modal'
import { Popover } from '../../../shared/ui/Popover'
import { Trans } from 'react-i18next'
import { useI18n } from '../../../shared/i18n'
import {
  DEFAULT_PROVIDER_ID,
  PROVIDER_OPTIONS,
  providerOption,
  validateProviderName,
  validateSettingsJson
} from '../lib/providerCatalog'

interface EngineFormModalProps {
  mode: 'add' | 'edit'
  // edit 모드에서만 의미 — 고정된 provider 와 기존 settings.json.
  provider?: string
  initialSettingsJson?: string
  busy?: boolean
  onClose: () => void
  onSubmit: (payload: { provider: string; settingsJson: string }) => Promise<void>
}

// 단일 화면 폼 (handoff 0090) — adapter 는 claude 하나뿐이라 엔진/공급자 선택 단계를
// 없앴다. 공급자는 드롭다운, adapter 는 claude 칩 고정 표기. 닫기는 취소 버튼 · 백드롭
// 클릭 · Esc 세 경로.
export function EngineFormModal({
  mode,
  provider: editProvider = '',
  initialSettingsJson = '{\n  "env": {}\n}',
  busy = false,
  onClose,
  onSubmit
}: EngineFormModalProps): React.JSX.Element {
  const { tr } = useI18n()
  const editing = mode === 'edit'
  const [providerId, setProviderId] = useState(editing ? 'custom' : DEFAULT_PROVIDER_ID)
  const [providerName, setProviderName] = useState(editing ? editProvider : DEFAULT_PROVIDER_ID)
  const [settingsJson, setSettingsJson] = useState(
    editing ? initialSettingsJson : (providerOption(DEFAULT_PROVIDER_ID)?.template ?? '{}')
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const menuAnchorRef = useRef<HTMLButtonElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const isCustom = editing || providerOption(providerId)?.custom === true
  const jsonCheck = useMemo(() => validateSettingsJson(settingsJson), [settingsJson])
  const nameCheck = useMemo(() => validateProviderName(providerName), [providerName])
  const canSubmit = jsonCheck.ok && nameCheck.ok && !busy

  const selectedOption = providerOption(providerId)

  // 닫기(Esc·백드롭 클릭)는 공용 Modal 이 담당. 드롭다운이 열려 있으면 Popover 의
  // Esc 가 메뉴만 닫도록 모달 닫기는 건너뛴다.
  const requestClose = (): void => {
    if (!menuOpen) onClose()
  }

  useEffect(() => {
    if (isCustom) queueMicrotask(() => nameRef.current?.focus())
  }, [isCustom])

  // 공급자를 고르면 해당 템플릿으로 settings.json 을 채우고 이름 기본값도 맞춘다.
  const pickProvider = (id: string): void => {
    const opt = providerOption(id)
    if (!opt) return
    setProviderId(id)
    setSettingsJson(opt.template)
    setProviderName(opt.custom ? '' : id)
    setImportError(null)
    setMenuOpen(false)
  }

  // ~/.claude/settings.json 원문을 불러와 본문을 채운다 (자동완성).
  const importUserSettings = async (): Promise<void> => {
    setImportError(null)
    setImportBusy(true)
    try {
      const result = await engineApi.importUserSettings()
      if (!result.exists) {
        setImportError(tr('engine.form.importNotFound'))
        return
      }
      setSettingsJson(result.settingsJson)
    } catch {
      setImportError(tr('engine.form.importFailed'))
    } finally {
      setImportBusy(false)
    }
  }

  const submit = async (): Promise<void> => {
    setSubmitError(null)
    if (!canSubmit) return
    try {
      await onSubmit({ provider: providerName.trim(), settingsJson })
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tr('engine.form.saveFailed'))
    }
  }

  return (
    <Modal
      open
      onClose={requestClose}
      ariaLabel={editing ? tr('engine.form.titleEdit') : tr('engine.form.titleAdd')}
      panelClassName="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-r6 border border-border bg-panel shadow-xl"
    >
      <>
        <div className="border-b border-border px-6 pb-3.5 pt-4">
          <h2 className="m-0 font-serif text-[18px] font-semibold text-ink">
            {editing ? tr('engine.form.titleEdit') : tr('engine.form.titleAdd')}
          </h2>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {/* adapter 는 claude 고정 — 편집 모드에선 고정된 provider 도 함께 표기 */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink2">
            <span className="rounded-md bg-sidebar px-2 py-0.5 font-medium text-ink">claude</span>
            {editing && (
              <>
                <span className="text-ink3">/</span>
                <span className="rounded-md bg-sidebar px-2 py-0.5 font-medium text-ink">
                  {providerName || editProvider}
                </span>
              </>
            )}
          </div>

          {!editing && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-ink2">
                {tr('engine.form.provider')}
              </span>
              <button
                ref={menuAnchorRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-left text-[13px] text-ink outline-none hover:border-border-strong focus:border-border-strong"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-medium">
                    {selectedOption ? tr(selectedOption.labelKey) : providerId}
                  </span>
                  {selectedOption && (
                    <span className="text-[11.5px] text-ink3">{tr(selectedOption.descKey)}</span>
                  )}
                </span>
                <Icon name={menuOpen ? 'chevU' : 'chevD'} size={14} color="var(--color-ink3)" />
              </button>
              <Popover
                open={menuOpen}
                anchorRef={menuAnchorRef}
                onClose={() => setMenuOpen(false)}
                placement="bottom"
                className="min-w-[300px]"
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    onClick={() => pickProvider(p.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-fill-uncontained-hover"
                  >
                    <span className="flex-1">
                      <span className="block text-[13px] font-medium text-ink">
                        {tr(p.labelKey)}
                      </span>
                      <span className="block text-[11.5px] leading-snug text-ink2">
                        {tr(p.descKey)}
                      </span>
                    </span>
                    {p.id === providerId && (
                      <Icon name="check" size={14} color="var(--color-ink)" />
                    )}
                  </button>
                ))}
              </Popover>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink2">
              {tr('engine.form.providerName')}
            </span>
            <input
              ref={nameRef}
              value={providerName}
              disabled={!isCustom}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder={tr('engine.form.namePlaceholder')}
              className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-border-strong disabled:cursor-not-allowed disabled:bg-bg2 disabled:text-ink2"
            />
            {!isCustom ? (
              <span className="text-[11px] text-ink3">{tr('engine.form.nameFixedHint')}</span>
            ) : (
              providerName.trim() !== '' &&
              !nameCheck.ok && (
                <span className="text-[11px] text-bad">{tr(nameCheck.errorKey)}</span>
              )
            )}
          </label>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-ink2">settings.json</span>
              <button
                type="button"
                onClick={() => void importUserSettings()}
                disabled={importBusy}
                title={tr('engine.form.importTitle')}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink2 hover:bg-sidebar hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="fileOpen" size={13} />
                {importBusy ? tr('common.loading') : tr('engine.form.importButton')}
              </button>
            </div>
            <textarea
              value={settingsJson}
              onChange={(e) => setSettingsJson(e.target.value)}
              spellCheck={false}
              aria-label="settings.json"
              className={`min-h-[220px] resize-y rounded-xl border bg-bg p-3 font-mono text-[12px] leading-5 text-ink outline-none focus:border-border-strong ${
                jsonCheck.ok ? 'border-border' : 'border-bad'
              }`}
            />
            {/* 실시간 JSON 검증 — 만족 시 초록, 불만족 시 빨강으로 즉시 표시 */}
            {jsonCheck.ok ? (
              <span className="text-[11.5px] text-good">{tr('engine.form.jsonValid')}</span>
            ) : (
              <span className="text-[11.5px] font-medium text-bad">
                ⚠ {tr(jsonCheck.errorKey, jsonCheck.params)}
              </span>
            )}
            {importError && (
              <span className="text-[11.5px] font-medium text-bad">⚠ {importError}</span>
            )}
            <span className="text-[11px] text-ink3">
              {/* 카탈로그 값의 <c> 태그가 code 요소로 치환된다. */}
              <Trans
                i18nKey="engine.form.envHint"
                values={{ varToken: '${VAR}' }}
                components={{ c: <code /> }}
              />
            </span>
          </div>

          {submitError && (
            <div className="rounded-lg bg-bad/10 px-3 py-2 text-[12px] text-bad">{submitError}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-3.5">
          <Button variant="contained" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={() => void submit()}>
            {busy
              ? editing
                ? tr('engine.form.saving')
                : tr('engine.form.adding')
              : editing
                ? tr('common.save')
                : tr('engine.form.addAction')}
          </Button>
        </div>
      </>
    </Modal>
  )
}
