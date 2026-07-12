import { useEffect, useRef, useState } from 'react'
import type { InstallStatus } from '../../../../../shared/ipc'
import { installApi } from '../../../shared/api/ipc'
import { useI18n } from '../../../shared/i18n'

interface InstallerDialogProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export function InstallerDialog({
  open,
  onClose,
  onComplete
}: InstallerDialogProps): React.JSX.Element | null {
  const { tr } = useI18n()
  const [log, setLog] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!open) return
    const unsub = installApi.onStatus((st: InstallStatus) => {
      if (st.log) setLog((prev) => prev + st.log)
      if (st.error) setError(st.error)
      if (st.done) {
        setRunning(false)
        setDone(true)
        if (!st.error) onComplete()
      }
    })
    return unsub
  }, [open, onComplete])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  if (!open) return null

  const start = async (): Promise<void> => {
    setLog('')
    setError(null)
    setDone(false)
    setRunning(true)
    try {
      await installApi.start('claude')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setRunning(false)
    }
  }

  const manualCmd = 'npm install -g @anthropic-ai/claude-code'

  // backdrop (blur + dim) 은 #app-frame-overlay 가 담당. 이 컴포넌트는 panel 자체만
  // grid cell 중앙에 놓는다. fixed inset-0 도 grid 부모를 가지면 grid cell 기준으로 작동.
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="w-[520px] max-w-[90vw] rounded-xl border border-border bg-panel p-5 shadow-xl">
        <div className="mb-2 font-serif text-[16px] font-semibold text-ink">
          {tr('backend.installer.title')}
        </div>
        <div className="mb-3 text-[12.5px] text-ink2">{tr('backend.installer.cliRequired')}</div>
        <div className="mb-3 rounded-md border border-border bg-bg px-2.5 py-1.5 font-mono text-[12px] text-ink">
          {manualCmd}
        </div>
        <pre
          ref={logRef}
          className="mb-3 max-h-[200px] overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11.5px] text-ink2"
        >
          {log || tr('backend.installer.preparing')}
        </pre>
        {error && (
          <div className="mb-3 rounded-md border border-rust bg-rust-soft px-2.5 py-1.5 text-[12px] text-ink">
            {tr('backend.installer.failedPrefix')} {error}
            <button
              onClick={() => void navigator.clipboard.writeText(manualCmd)}
              className="ml-2 cursor-pointer rounded border border-border bg-panel px-2 py-0.5 text-[11px] text-ink2"
            >
              {tr('backend.installer.copyCommand')}
            </button>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md border border-border bg-panel px-3 py-1.5 text-[12.5px] text-ink2"
          >
            {tr('common.close')}
          </button>
          <button
            onClick={() => void start()}
            disabled={running}
            className="cursor-pointer rounded-md border-0 bg-ink px-3 py-1.5 text-[12.5px] text-bg disabled:opacity-50"
          >
            {running
              ? tr('backend.installer.installing')
              : done && !error
                ? tr('backend.installer.done')
                : tr('backend.installer.start')}
          </button>
        </div>
      </div>
    </div>
  )
}
