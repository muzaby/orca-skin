import { useMemo, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'

const DEFAULT_SETTINGS = JSON.stringify({ env: {} }, null, 2)

interface EngineFormModalProps {
  mode: 'add' | 'edit'
  provider?: string
  initialSettingsJson?: string
  busy?: boolean
  onClose: () => void
  onSubmit: (payload: { provider: string; settingsJson: string }) => Promise<void>
}

export function EngineFormModal({
  mode,
  provider: initialProvider = '',
  initialSettingsJson = DEFAULT_SETTINGS,
  busy = false,
  onClose,
  onSubmit
}: EngineFormModalProps): React.JSX.Element {
  const [provider, setProvider] = useState(initialProvider)
  const [settingsJson, setSettingsJson] = useState(initialSettingsJson)
  const [error, setError] = useState<string | null>(null)

  const canSave = useMemo(() => provider.trim() !== '' && !busy, [provider, busy])

  const submit = async (): Promise<void> => {
    setError(null)
    try {
      JSON.parse(settingsJson)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON 파싱 실패')
      return
    }
    try {
      await onSubmit({ provider: provider.trim(), settingsJson })
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[680px] rounded-2xl border border-border bg-panel p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'add' ? '엔진 추가' : '엔진 설정 편집'}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-rust-soft text-rust">
            <Icon name="cpu" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[17px] font-semibold text-ink">
              {mode === 'add' ? '엔진 추가' : '엔진 설정 편집'}
            </h2>
            <p className="m-0 text-[12px] text-ink3">claude-code provider settings.json</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink3 hover:bg-sidebar hover:text-ink"
            aria-label="닫기"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink2">
            엔진
            <select
              value="claude-code"
              disabled
              className="rounded-lg border border-border bg-cream-50 px-2.5 py-2 text-[13px] text-ink"
            >
              <option value="claude-code">claude-code</option>
              <option disabled>opencode (후속)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink2">
            Provider
            <input
              value={provider}
              readOnly={mode === 'edit'}
              onChange={(event) => setProvider(event.target.value)}
              placeholder="anthropic / bedrock / vertex"
              className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-rust"
            />
          </label>
        </div>

        <label className="mt-4 flex flex-col gap-1.5 text-[12px] font-medium text-ink2">
          settings.json
          <textarea
            value={settingsJson}
            onChange={(event) => setSettingsJson(event.target.value)}
            spellCheck={false}
            className="min-h-[300px] resize-y rounded-xl border border-border bg-bg p-3 font-mono text-[12px] leading-5 text-ink outline-none focus:border-rust"
          />
        </label>

        {error && (
          <div className="mt-3 rounded-lg bg-rust-soft px-3 py-2 text-[12px] text-rust">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-ink2 hover:bg-sidebar"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void submit()}
            className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
