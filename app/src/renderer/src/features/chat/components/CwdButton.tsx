import { useState } from 'react'
import { basenameForDisplay } from '../../../../../shared/path-basename'
import { fileApi } from '../../../shared/api/ipc'
import { Icon } from '../../../shared/ui/Icon'
import { chatActions } from '../store/chatStore'
import { useI18n } from '../../../shared/i18n'

interface CwdButtonProps {
  cwd: string | null
  sessionStarted: boolean
  inflight?: boolean
  className?: string
}

export function CwdButton({
  cwd,
  sessionStarted,
  inflight = false,
  className = ''
}: CwdButtonProps): React.JSX.Element {
  const { tr } = useI18n()
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
      console.warn('[files] cwd button action failed', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy || (!sessionStarted && inflight) || (sessionStarted && !cwd)}
      aria-label={
        sessionStarted ? tr('chat.composer.cwdOpenAria') : tr('chat.composer.cwdSelectAria')
      }
      title={title}
      className={`inline-flex h-7 max-w-full items-center gap-1.5 rounded-r4 border border-transparent bg-transparent px-p5 text-footnote text-t6 transition-colors hover:bg-fill-uncontained-hover hover:text-t7 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <Icon name="folder" size={14} className="shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  )
}
