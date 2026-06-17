import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ENGINE_OPTIONS,
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

type Step = 1 | 2 | 3

// 빗금(준비 중) 배경 — 테마 border 토큰을 써 다크/쿨 테마에서도 자연스럽게 따라간다.
const HATCH =
  'bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--color-border)_5px,var(--color-border)_6px)]'

const CARD_BASE = 'rounded-xl border px-4 py-3 text-left transition-colors'
const CARD_IDLE = 'border-border bg-panel hover:border-border-strong hover:bg-sidebar'
const CARD_SEL = 'border-rust bg-rust-soft'

export function EngineFormModal({
  mode,
  provider: editProvider = '',
  initialSettingsJson = '{\n  "env": {}\n}',
  busy = false,
  onClose,
  onSubmit
}: EngineFormModalProps): React.JSX.Element {
  const editing = mode === 'edit'
  const [step, setStep] = useState<Step>(editing ? 3 : 1)
  const [engineId, setEngineId] = useState('claude')
  const [providerId, setProviderId] = useState(editing ? 'custom' : '')
  const [providerName, setProviderName] = useState(editProvider)
  const [settingsJson, setSettingsJson] = useState(initialSettingsJson)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isCustom = editing || providerOption(providerId)?.custom === true
  const jsonCheck = useMemo(() => validateSettingsJson(settingsJson), [settingsJson])
  const nameCheck = useMemo(() => validateProviderName(providerName), [providerName])
  const canSubmit = jsonCheck.ok && nameCheck.ok && !busy

  // 2단계에서 공급자를 고르면 해당 템플릿으로 3단계를 채우고 이름 기본값도 맞춘다.
  const pickProvider = (id: string): void => {
    const opt = providerOption(id)
    if (!opt) return
    setProviderId(id)
    setSettingsJson(opt.template)
    setProviderName(opt.custom ? '' : id)
    setStep(3)
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

  const providerLabel = editing
    ? providerName || editProvider
    : (providerOption(providerId)?.label ?? providerId)

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
        <div className="border-b border-border px-6 pb-3 pt-4">
          <div className="flex items-center gap-2">
            {step > 1 && !editing && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="-ml-1 rounded-md px-2 py-1 text-[13px] font-medium text-ink2 hover:bg-sidebar hover:text-ink"
              >
                ← 이전
              </button>
            )}
            <h2 className="m-0 text-[16px] font-semibold text-ink">
              {editing ? '엔진 설정 편집' : '엔진 추가'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-md px-2 py-1 text-[13px] text-ink3 hover:bg-sidebar hover:text-ink"
              aria-label="닫기"
            >
              닫기
            </button>
          </div>
          {!editing && <Stepper step={step} />}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <EngineStep engineId={engineId} onPick={setEngineId} onNext={() => setStep(2)} />
          )}
          {step === 2 && <ProviderStep selectedId={providerId} onPick={pickProvider} />}
          {step === 3 && (
            <SettingsStep
              engineId={engineId}
              providerLabel={providerLabel}
              providerName={providerName}
              nameDisabled={!isCustom}
              nameError={providerName.trim() !== '' && !nameCheck.ok ? nameCheck.error : undefined}
              onName={setProviderName}
              settingsJson={settingsJson}
              onSettings={setSettingsJson}
              jsonError={jsonCheck.ok ? undefined : jsonCheck.error}
              submitError={submitError}
            />
          )}
        </div>

        {step === 3 && (
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
              className="rounded-lg bg-rust px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? (editing ? '저장 중…' : '추가 중…') : editing ? '저장' : '추가하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Stepper({ step }: { step: Step }): React.JSX.Element {
  const items: Array<[Step, string]> = [
    [1, '엔진'],
    [2, '공급자'],
    [3, '설정']
  ]
  return (
    <div className="mt-3 flex items-center gap-1.5">
      {items.map(([n, label], i) => {
        const active = step === n
        const done = step > n
        return (
          <div key={n} className="flex flex-1 items-center gap-1.5">
            <span
              className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold ${
                active
                  ? 'bg-rust text-white'
                  : done
                    ? 'bg-rust-soft text-rust'
                    : 'bg-sidebar text-ink3'
              }`}
            >
              {n}
            </span>
            <span className={`text-[12px] ${active ? 'font-semibold text-ink' : 'text-ink3'}`}>
              {label}
            </span>
            {i < items.length - 1 && (
              <span className={`h-px flex-1 ${done ? 'bg-rust-soft' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function EngineStep({
  engineId,
  onPick,
  onNext
}: {
  engineId: string
  onPick: (id: string) => void
  onNext: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px] text-ink2">사용할 엔진(adapter)을 선택하세요.</p>
      <div className="flex flex-col gap-2">
        {ENGINE_OPTIONS.map((eng) => {
          if (!eng.enabled) {
            return (
              <div
                key={eng.id}
                className={`relative overflow-hidden rounded-xl border border-dashed border-border-strong px-4 py-3 ${HATCH}`}
                aria-disabled
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink3">{eng.label}</span>
                  <span className="rounded-full bg-panel px-2 py-px text-[10px] font-semibold text-ink3">
                    준비 중
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-ink3">{eng.desc}</div>
              </div>
            )
          }
          const isSel = engineId === eng.id
          return (
            <button
              key={eng.id}
              type="button"
              onClick={() => onPick(eng.id)}
              className={`${CARD_BASE} ${isSel ? CARD_SEL : CARD_IDLE}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{eng.label}</span>
                {isSel && <span className="text-[12px] font-semibold text-rust">선택됨</span>}
              </div>
              <div className="mt-0.5 text-[12px] text-ink2">{eng.desc}</div>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-1 self-end rounded-lg bg-ink px-4 py-2 text-[13px] font-semibold text-bg"
      >
        다음
      </button>
    </div>
  )
}

function ProviderStep({
  selectedId,
  onPick
}: {
  selectedId: string
  onPick: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px] text-ink2">Claude 를 어떤 공급자(provider)로 호출할까요?</p>
      <div className="grid grid-cols-2 gap-2">
        {PROVIDER_OPTIONS.map((p) => {
          const isSel = selectedId === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              className={`${CARD_BASE} ${isSel ? CARD_SEL : CARD_IDLE} px-3.5`}
            >
              <div className="text-[13.5px] font-semibold text-ink">{p.label}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-ink2">{p.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SettingsStep({
  engineId,
  providerLabel,
  providerName,
  nameDisabled,
  nameError,
  onName,
  settingsJson,
  onSettings,
  jsonError,
  submitError
}: {
  engineId: string
  providerLabel: string
  providerName: string
  nameDisabled: boolean
  nameError?: string
  onName: (v: string) => void
  settingsJson: string
  onSettings: (v: string) => void
  jsonError?: string
  submitError: string | null
}): React.JSX.Element {
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!nameDisabled) queueMicrotask(() => nameRef.current?.focus())
  }, [nameDisabled])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink2">
        <span className="rounded-md bg-sidebar px-2 py-0.5 font-medium text-ink">{engineId}</span>
        <span className="text-ink3">/</span>
        <span className="rounded-md bg-sidebar px-2 py-0.5 font-medium text-ink">
          {providerLabel}
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-ink2">Provider 이름</span>
        <input
          ref={nameRef}
          value={providerName}
          disabled={nameDisabled}
          onChange={(e) => onName(e.target.value)}
          placeholder="예: my-gateway"
          className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-rust disabled:cursor-not-allowed disabled:bg-cream-50 disabled:text-ink2"
        />
        {nameDisabled ? (
          <span className="text-[11px] text-ink3">
            선택한 공급자 이름으로 고정됩니다. 변경하려면 ‘직접 입력’을 고르세요.
          </span>
        ) : (
          nameError && <span className="text-[11px] text-rust">{nameError}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-ink2">settings.json</span>
        <textarea
          value={settingsJson}
          onChange={(e) => onSettings(e.target.value)}
          spellCheck={false}
          className={`min-h-[220px] resize-y rounded-xl border bg-bg p-3 font-mono text-[12px] leading-5 text-ink outline-none focus:border-rust ${
            jsonError ? 'border-rust' : 'border-border'
          }`}
        />
        {/* 실시간 JSON 검증 — 만족 시 초록, 불만족 시 빨강으로 즉시 표시 */}
        {jsonError ? (
          <span className="text-[11.5px] font-medium text-rust">⚠ {jsonError}</span>
        ) : (
          <span className="text-[11.5px] text-good">✓ JSON 형식이 올바릅니다.</span>
        )}
        <span className="text-[11px] text-ink3">
          <code>env</code> 블록에 API 키·리전 등을 넣습니다. 비밀은 <code>{'${VAR}'}</code>{' '}
          플레이스홀더로 두는 것을 권장합니다.
        </span>
      </label>

      {submitError && (
        <div className="rounded-lg bg-rust-soft px-3 py-2 text-[12px] text-rust">{submitError}</div>
      )}
    </div>
  )
}
