import type { EngineHarnessConfiguration } from '../harnesses/types'
import { engineHarnessConfiguration } from '../harnesses/configuration'
import type { Backend, CreateEngineRequest } from '../../../../../shared/ipc'
import { HARNESS_CAPABILITIES, HARNESS_IDS, isBackend } from '../../../../../shared/harness'
import { useEffect, useMemo, useRef, useState } from 'react'
import { engineApi } from '../../../shared/api/ipc'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Modal } from '../../../shared/ui/Modal'
import { Popover } from '../../../shared/ui/Popover'
import { Trans } from 'react-i18next'
import { useI18n } from '../../../shared/i18n'
import { validateProviderName, validateSettingsJson } from '../lib/providerCatalog'

interface EngineFormModalProps {
  mode: 'add' | 'edit'
  // edit 모드에서만 의미 — 고정된 provider 와 기존 settings.json.
  engine?: Backend
  provider?: string
  initialSettingsJson?: string
  busy?: boolean
  onClose: () => void
  onSubmit: (payload: CreateEngineRequest) => Promise<void>
}

// 새 엔진은 하네스를 선택하고, 기존 엔진의 하네스는 고정한다.
export function EngineFormModal({
  mode,
  engine: initialEngine = 'claude',
  provider: editProvider = '',
  initialSettingsJson = '{\n  "env": {}\n}',
  busy = false,
  onClose,
  onSubmit
}: EngineFormModalProps): React.JSX.Element {
  const { tr } = useI18n()
  const editing = mode === 'edit'
  const [engine, setEngine] = useState<Backend>(initialEngine)
  const configuration = engineHarnessConfiguration(engine)
  const initialConfiguration = engineHarnessConfiguration(initialEngine)
  const providerOption = (
    id: string
  ): EngineHarnessConfiguration['providers'][number] | undefined =>
    configuration.providers.find((option) => option.id === id)
  const [providerId, setProviderId] = useState(
    editing ? 'custom' : initialConfiguration.defaultProvider
  )
  const [providerName, setProviderName] = useState(
    editing ? editProvider : initialConfiguration.defaultProvider
  )
  const [settingsJson, setSettingsJson] = useState(
    editing ? initialSettingsJson : initialConfiguration.defaultSettings
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const menuAnchorRef = useRef<HTMLButtonElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const importRevision = useRef(0)
  const importPending = useRef(false)

  useEffect(
    () => () => {
      importRevision.current += 1
    },
    []
  )

  const isCustom =
    editing || configuration.providers.length === 0 || providerOption(providerId)?.custom === true
  const jsonCheck = useMemo(() => validateSettingsJson(settingsJson), [settingsJson])
  const nameCheck = useMemo(() => validateProviderName(providerName), [providerName])
  const canSubmit = jsonCheck.ok && nameCheck.ok && !busy && !importBusy
  const importKeys = configuration.importKeys

  const cancelImport = (): void => {
    importRevision.current += 1
    importPending.current = false
    setImportBusy(false)
    setImportError(null)
  }

  const selectedOption = providerOption(providerId)

  // 닫기(Esc·백드롭 클릭)는 공용 Modal 이 담당. 드롭다운이 열려 있으면 Popover 의
  // Esc 가 메뉴만 닫도록 모달 닫기는 건너뛴다.
  const requestClose = (): void => {
    if (!menuOpen) {
      cancelImport()
      onClose()
    }
  }

  useEffect(() => {
    if (isCustom) queueMicrotask(() => nameRef.current?.focus())
  }, [isCustom])

  const pickEngine = (next: Backend): void => {
    cancelImport()
    setEngine(next)
    const nextConfiguration = engineHarnessConfiguration(next)
    setProviderId(nextConfiguration.defaultProvider)
    setProviderName(nextConfiguration.defaultProvider)
    setSettingsJson(nextConfiguration.defaultSettings)
    setMenuOpen(false)
    setImportError(null)
    setSubmitError(null)
  }

  // 공급자를 고르면 해당 템플릿으로 settings.json 을 채우고 이름 기본값도 맞춘다.
  const pickProvider = (id: string): void => {
    const opt = providerOption(id)
    if (!opt) return
    cancelImport()
    setProviderId(id)
    setSettingsJson(opt.template)
    setProviderName(opt.custom ? '' : id)
    setImportError(null)
    setMenuOpen(false)
  }

  // 선택한 하네스의 원문을 초안에만 적용한다. 중간 편집/전환 뒤의 응답은 버린다.
  const importUserSettings = async (): Promise<void> => {
    if (busy || importPending.current) return
    const revision = ++importRevision.current
    importPending.current = true
    setImportError(null)
    setImportBusy(true)
    try {
      const result = await engineApi.importUserSettings(engine)
      if (revision !== importRevision.current) return
      if (!result.exists) {
        setImportError(tr(importKeys.notFound))
        return
      }
      setSettingsJson(result.settingsJson)
    } catch {
      if (revision === importRevision.current) setImportError(tr(importKeys.failed))
    } finally {
      if (revision === importRevision.current) {
        importPending.current = false
        setImportBusy(false)
      }
    }
  }

  const submit = async (): Promise<void> => {
    setSubmitError(null)
    if (!canSubmit || importPending.current) return
    try {
      await onSubmit({ engine, provider: providerName.trim(), settingsJson })
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
          {/* 편집에서는 하네스를 고정해 provider 저장 경로를 유지한다. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink2">
            <label className="flex items-center gap-2">
              <span>{tr('engine.form.harness')}</span>
              <select
                aria-label={tr('engine.form.harness')}
                value={engine}
                disabled={editing || busy}
                onChange={(event) => {
                  if (isBackend(event.target.value)) pickEngine(event.target.value)
                }}
                className="rounded-md border border-border bg-bg px-2 py-1 text-ink disabled:opacity-70"
              >
                {HARNESS_IDS.map((id) => (
                  <option key={id} value={id}>
                    {HARNESS_CAPABILITIES[id].label}
                  </option>
                ))}
              </select>
            </label>
            {editing && (
              <>
                <span className="text-ink3">/</span>
                <span className="rounded-md bg-sidebar px-2 py-0.5 font-medium text-ink">
                  {providerName || editProvider}
                </span>
              </>
            )}
          </div>

          {!editing && configuration.providers.length > 0 && (
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
                {configuration.providers.map((p) => (
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
                disabled={busy || importBusy}
                title={tr(importKeys.title)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink2 hover:bg-sidebar hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="fileOpen" size={13} />
                {importBusy ? tr('common.loading') : tr(importKeys.button)}
              </button>
            </div>
            <textarea
              value={settingsJson}
              onChange={(e) => {
                cancelImport()
                setSettingsJson(e.target.value)
              }}
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
                i18nKey={configuration.hint}
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
          <Button
            variant="contained"
            onClick={() => {
              cancelImport()
              onClose()
            }}
          >
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
