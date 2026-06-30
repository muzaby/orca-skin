import { useState } from 'react'
import { basenameForDisplay } from '../../../../../../shared/path-basename'
import { fileApi } from '../../../../shared/api/ipc'
import { chatActions } from '../../store/chatStore'

interface DirectoryPanelProps {
  cwd: string | null
  sessionStarted: boolean
  inflight: boolean
}

export function DirectoryPanel({
  cwd,
  sessionStarted,
  inflight
}: DirectoryPanelProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const label = basenameForDisplay(cwd)
  const title = cwd ?? label

  const handleClick = async (): Promise<void> => {
    if (busy || (!sessionStarted && inflight)) return
    setBusy(true)
    try {
      if (sessionStarted) {
        if (cwd) await fileApi.openPath({ path: cwd })
        return
      }
      const picked = await fileApi.pickDirectory()
      if (picked) chatActions.setPendingCwd(picked)
    } catch (err) {
      console.warn('[files] directory panel action failed', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`app-frame-composer-directory flex rounded-r7 border px-1 py-1 transition-colors ${
        sessionStarted ? 'border-border bg-sidebar' : 'border-transparent bg-transparent'
      }`}
      data-surface="cwd-panel"
      data-state={sessionStarted ? 'session' : 'landing'}
    >
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy || (!sessionStarted && inflight) || (sessionStarted && !cwd)}
        aria-label={sessionStarted ? '작업 폴더 열기' : '작업 폴더 선택'}
        title={title}
        className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-r4 border border-transparent bg-transparent px-p5 text-footnote text-t6 transition-colors hover:bg-fill-uncontained-hover hover:text-t7 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true">📂</span>
        <span className="min-w-0 truncate">{label}</span>
      </button>
    </div>
  )
}
