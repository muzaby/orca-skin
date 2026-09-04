import { useState } from 'react'
import { fileApi } from '../../../shared/api/ipc'
import { useI18n } from '../../../shared/i18n'
import { chatActions, useChatSession } from '../store/chatStore'
import { CwdButton } from './CwdButton'
import { BranchChip } from './composer/BranchChip'
import { chipGroupSurface } from './composer/chipSurface'
import { ComposerChip } from './composer/ComposerChip'
import { ExtraDirChip } from './composer/ExtraDirChip'
import { WorktreeToggle } from './composer/WorktreeToggle'

interface CwdPanelProps {
  cwd: string | null
  inflight: boolean
}

// 컴포저 입력 위의 작업 컨텍스트 행 — [작업 경로] [브랜치] [참조 경로…] [＋].
//
// 세션이 확정되기 전(랜딩)에만 뜬다. cwd·브랜치·참조 경로는 새 세션 출생 시 고정되는 값이라
// 편집 가능한 창이 여기뿐이다. 브랜치·워크트리 묶음은 Git 확인 후 함께 표시한다.
export function CwdPanel({ cwd, inflight }: CwdPanelProps): React.JSX.Element {
  const { tr } = useI18n()
  const extraDirs = useChatSession((s) => s.extraDirs)
  const rejection = useChatSession((s) => s.extraDirRejection)
  const worktreeIsolation = useChatSession((s) => s.worktreeIsolation)
  const worktreeBaseRef = useChatSession((s) => s.worktreeBaseRef)
  const [picking, setPicking] = useState(false)

  const addDir = async (): Promise<void> => {
    if (picking) return
    setPicking(true)
    try {
      const picked = await fileApi.pickDirectory()
      if (picked) chatActions.addExtraDir(picked)
    } finally {
      setPicking(false)
    }
  }

  return (
    <div
      className="app-frame-composer-directory flex flex-wrap items-center gap-g3 rounded-r7 border border-transparent bg-transparent px-1 py-1"
      data-surface="cwd-panel"
      data-state="landing"
    >
      <CwdButton cwd={cwd} sessionStarted={false} inflight={inflight} variant="outlined" />
      {/* 같은 Git 응답으로 묶음 전체를 표시한다. 격리 ON이면 선택은 base ref로 유예된다. */}
      <BranchChip
        cwd={cwd}
        disabled={inflight}
        variant="segment"
        trailingDivider
        deferTo={worktreeIsolation ? (branch) => chatActions.setWorktreeBaseRef(branch) : undefined}
        deferred={worktreeIsolation ? worktreeBaseRef : null}
        renderTrigger={(branch) => (
          <div className={chipGroupSurface} data-surface="branch-worktree-group">
            {branch}
            <WorktreeToggle
              checked={worktreeIsolation}
              disabled={inflight || !cwd}
              onChange={chatActions.setWorktreeIsolation}
            />
          </div>
        )}
      />
      {extraDirs.map((dir) => (
        <ExtraDirChip
          key={dir}
          path={dir}
          disabled={inflight}
          onRemove={() => chatActions.removeExtraDir(dir)}
        />
      ))}
      <ComposerChip
        icon="plus"
        variant="outlined"
        disabled={picking || inflight}
        onClick={() => void addDir()}
        title={tr('chat.composer.extraDirAdd')}
      />
      {/* 거부 사유 — 고른 폴더가 칩으로 안 붙었는데 아무 말도 없으면 사용자는 앱이 먹은
          것으로 읽는다(D-020). 다음 추가·제거·작업 경로 변경에서 리듀서가 지운다. */}
      {rejection === 'root' && (
        <span data-surface="extra-dir-rejection" className="w-full px-1 text-footnote text-rust">
          {tr('chat.composer.extraDirRejectRoot')}
        </span>
      )}
    </div>
  )
}
