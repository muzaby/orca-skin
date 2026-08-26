import { useState } from 'react'
import { basenameForDisplay } from '../../../../../shared/path-basename'
import { fileApi } from '../../../shared/api/ipc'
import { Icon } from '../../../shared/ui/Icon'
import { chatActions } from '../store/chatStore'
import { useI18n } from '../../../shared/i18n'
import { chipSurface, OUTLINED_ICON_SIZE, type ChipVariant } from './composer/chipSurface'

interface CwdButtonProps {
  cwd: string | null
  sessionStarted: boolean
  inflight?: boolean
  // 타이틀바(flat)와 컴포저 상단 작업 컨텍스트 행(outlined)이 같은 버튼을 다른 외형으로 쓴다.
  variant?: ChipVariant
  className?: string
}

export function CwdButton({
  cwd,
  sessionStarted,
  inflight = false,
  variant = 'flat',
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
      className={`${chipSurface(variant)} focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <Icon
        name="folder"
        size={variant === 'outlined' ? OUTLINED_ICON_SIZE : 14}
        className="shrink-0"
      />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  )
}
