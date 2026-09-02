import { useState } from 'react'
import type { WorktreeDisplay } from '../../../../../shared/ipc'
import { fileApi } from '../../../shared/api/ipc'
import { Icon } from '../../../shared/ui/Icon'
import { chatActions } from '../store/chatStore'
import { cwdDisplayName } from '../lib/worktreeDisplay'
import { useI18n } from '../../../shared/i18n'
import { chipSurface, OUTLINED_ICON_SIZE, type ChipVariant } from './composer/chipSurface'

interface CwdButtonProps {
  cwd: string | null
  sessionStarted: boolean
  inflight?: boolean
  // 타이틀바(flat)와 컴포저 상단 작업 컨텍스트 행(outlined)이 같은 버튼을 다른 외형으로 쓴다.
  variant?: ChipVariant
  className?: string
  // 0211 — 격리 세션의 표시 정본. 라벨만 이 값을 쓰고 **클릭은 `cwd`(실행 경로)** 다.
  worktree?: WorktreeDisplay | null
}

export function CwdButton({
  cwd,
  sessionStarted,
  inflight = false,
  variant = 'flat',
  className = '',
  worktree = null
}: CwdButtonProps): React.JSX.Element {
  const { tr } = useI18n()
  const [busy, setBusy] = useState(false)
  // 이름은 원본에서, 툴팁은 실제로 열리는 경로에서 — 둘이 다르다는 것이 격리 세션의 사실이다.
  const label = cwdDisplayName(cwd, worktree)
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
