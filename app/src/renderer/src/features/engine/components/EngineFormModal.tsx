import { useEffect, useMemo, useRef, useState } from 'react'
import { engineApi } from '../../../shared/api/ipc'
import { Icon } from '../../../shared/ui/Icon'
import { Popover } from '../../../shared/ui/Popover'
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

  // 닫기 버튼이 없으므로 Esc 로 닫는다. 드롭다운이 열려 있으면 Popover 의 Esc 가
  // 메뉴만 닫도록 모달 닫기는 건너뛴다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !menuOpen) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, onClose])

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
        setImportError('~/.claude/settings.json 을 찾을 수 없어요.')
        return
      }
      setSettingsJson(result.settingsJson)
    } catch {
      setImportError('~/.claude/settings.json 을 불러오지 못했어요.')
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
      setSubmitError(e instanceof Error ? e.message : '저장에 실패했어요.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? '엔진 설정 편집' : '엔진 추가'}
      >
        <div className="border-b border-border px-6 pb-3.5 pt-4">
          <h2 className="m-0 text-[16px] font-semibold text-ink">
            {editing ? '엔진 설정 편집' : '엔진 추가'}
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
              <span className="text-[12px] font-medium text-ink2">공급자</span>
              <button
                ref={menuAnchorRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-left text-[13px] text-ink outline-none hover:border-border-strong focus:border-border-strong"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-medium">{selectedOption?.label ?? providerId}</span>
                  {selectedOption && (
                    <span className="text-[11.5px] text-ink3">{selectedOption.desc}</span>
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
                      <span className="block text-[13px] font-medium text-ink">{p.label}</span>
                      <span className="block text-[11.5px] leading-snug text-ink2">{p.desc}</span>
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
            <span className="text-[12px] font-medium text-ink2">Provider 이름</span>
            <input
              ref={nameRef}
              value={providerName}
              disabled={!isCustom}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="예: my-gateway"
              className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-border-strong disabled:cursor-not-allowed disabled:bg-bg2 disabled:text-ink2"
            />
            {!isCustom ? (
              <span className="text-[11px] text-ink3">
                선택한 공급자 이름으로 고정됩니다. 변경하려면 ‘직접 입력’을 고르세요.
              </span>
            ) : (
              providerName.trim() !== '' &&
              !nameCheck.ok && <span className="text-[11px] text-bad">{nameCheck.error}</span>
            )}
          </label>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-ink2">settings.json</span>
              <button
                type="button"
                onClick={() => void importUserSettings()}
                disabled={importBusy}
                title="~/.claude/settings.json 의 내용으로 본문을 채웁니다."
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink2 hover:bg-sidebar hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="fileOpen" size={13} />
                {importBusy ? '불러오는 중…' : '~/.claude/settings.json 불러오기'}
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
              <span className="text-[11.5px] text-good">✓ JSON 형식이 올바릅니다.</span>
            ) : (
              <span className="text-[11.5px] font-medium text-bad">⚠ {jsonCheck.error}</span>
            )}
            {importError && (
              <span className="text-[11.5px] font-medium text-bad">⚠ {importError}</span>
            )}
            <span className="text-[11px] text-ink3">
              <code>env</code> 블록에 API 키·리전 등을 넣습니다. 비밀은 <code>{'${VAR}'}</code>{' '}
              플레이스홀더로 두는 것을 권장합니다.
            </span>
          </div>

          {submitError && (
            <div className="rounded-lg bg-bad/10 px-3 py-2 text-[12px] text-bad">{submitError}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-ink2 hover:bg-sidebar"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="rounded-lg bg-ink px-4 py-2 text-[13px] font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (editing ? '저장 중…' : '추가 중…') : editing ? '저장' : '추가하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
