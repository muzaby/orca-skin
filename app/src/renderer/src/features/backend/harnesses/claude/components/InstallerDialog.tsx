import { useEffect, useRef, useState } from 'react'
import type { InstallStatus } from '../../../../../../../shared/ipc'
import { installApi } from '../../../../../shared/api/ipc'
import { Button } from '../../../../../shared/ui/Button'
import { useSurfacePresence } from '../../../../../shared/hooks/useSurfacePresence'
import { useEscToClose } from '../../../../../shared/hooks/useEscToClose'
import { InstallLog } from './InstallLog'
import { InstallLogArchive } from './installLogArchive'
import { useI18n } from '../../../../../shared/i18n'

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
  const { present } = useSurfacePresence(open)
  const [log, setLog] = useState(() => ({ generation: 0, archive: new InstallLogArchive() }))
  const [revision, setRevision] = useState(0)
  const run = useRef<{ generation: number; archive: InstallLogArchive; failed: boolean } | null>(
    null
  )
  const nextGeneration = useRef(0)
  const completeRef = useRef(onComplete)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // 설치 진행 중에는 Esc·바깥 클릭 닫기를 차단한다 (handoff 0121 닫기 UX 통일).
  useEscToClose(open && !running, onClose)

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])
  useEffect(() => {
    if (!open) return
    let frame: number | undefined
    const unsub = installApi.onStatus((status: InstallStatus) => {
      const active = run.current
      if (!active) return
      if (status.log) {
        active.archive.append(status.log)
        frame ??= requestAnimationFrame(() => {
          frame = undefined
          setRevision((previous) => previous + 1)
        })
      }
      if (status.error) {
        active.failed = true
        setError(status.error)
      }
      if (status.done) {
        if (frame !== undefined) {
          cancelAnimationFrame(frame)
          frame = undefined
          setRevision((previous) => previous + 1)
        }
        run.current = null
        setRunning(false)
        setDone(true)
        if (!active.failed) completeRef.current()
      }
    })
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      run.current = null
      unsub()
    }
  }, [open])

  if (!present) return null

  const start = async (): Promise<void> => {
    if (run.current) return
    const active = {
      generation: ++nextGeneration.current,
      archive: new InstallLogArchive(),
      failed: false
    }
    run.current = active
    setLog(active)
    setError(null)
    setDone(false)
    setRunning(true)
    try {
      await installApi.start('claude')
    } catch (err) {
      if (run.current !== active) return
      run.current = null
      setError(err instanceof Error ? err.message : String(err))
      setRunning(false)
    }
  }

  const manualCmd = 'npm install -g @anthropic-ai/claude-code'

  // backdrop (blur + dim) 은 #app-frame-overlay 가 담당. 이 컴포넌트는 panel 자체만
  // grid cell 중앙에 놓는다. fixed inset-0 도 grid 부모를 가지면 grid cell 기준으로 작동.
  return (
    <div
      data-surface-presence={open ? 'open' : 'closing'}
      inert={!open}
      aria-hidden={!open}
      className="grid h-full w-full place-items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('backend.installer.title')}
        className="w-[520px] max-w-[92vw] rounded-r6 border border-border bg-panel p-5 shadow-xl"
      >
        <div className="mb-2 font-serif text-[18px] font-semibold text-ink">
          {tr('backend.installer.title')}
        </div>
        <div className="mb-3 text-[12.5px] text-ink2">{tr('backend.installer.cliRequired')}</div>
        <div className="mb-3 rounded-r4 border border-border bg-bg px-2.5 py-1.5 font-mono text-[12px] text-ink">
          {manualCmd}
        </div>
        <InstallLog key={log.generation} {...log} revision={revision} />
        {error && (
          <div className="mb-3 rounded-r4 border border-rust bg-rust-soft px-2.5 py-1.5 text-[12px] text-ink">
            {tr('backend.installer.failedPrefix')} {error}
            <Button
              variant="contained"
              size="small"
              className="ml-2"
              onClick={() => void navigator.clipboard.writeText(manualCmd)}
            >
              {tr('backend.installer.copyCommand')}
            </Button>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="contained" size="small" onClick={onClose} disabled={running}>
            {tr('common.close')}
          </Button>
          <Button variant="primary" size="small" onClick={() => void start()} disabled={running}>
            {running
              ? tr('backend.installer.installing')
              : done && !error
                ? tr('backend.installer.done')
                : tr('backend.installer.start')}
          </Button>
        </div>
      </div>
    </div>
  )
}
