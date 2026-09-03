import { useState } from 'react'
import { fileApi } from '../../../shared/api/ipc'
import { useI18n } from '../../../shared/i18n'
import { chatActions, useChatSession } from '../store/chatStore'
import { CwdButton } from './CwdButton'
import { BranchChip } from './composer/BranchChip'
import { chipGroupSurface } from './composer/chipSurface'
import { ComposerChip } from './composer/ComposerChip'
import { ExtraDirChip } from './composer/ExtraDirChip'

interface CwdPanelProps {
  cwd: string | null
  inflight: boolean
}

// 컴포저 입력 위의 작업 컨텍스트 행 — [작업 경로] [브랜치] [참조 경로…] [＋].
//
// 세션이 확정되기 전(랜딩)에만 뜬다. cwd·브랜치·참조 경로는 새 세션 출생 시 고정되는 값이라
// 편집 가능한 창이 여기뿐이다. 브랜치 칩은 git 저장소가 아니면 스스로 사라진다.
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
      {/* 브랜치와 워크트리는 **한 테두리 안**에 나란히 선다(참조 컴포저) — 둘은 "다음 세션을
          어디서 시작하는가" 라는 한 결정의 두 축이라, 낱개 칩으로 흩어 두면 워크트리 토글이
          옆의 참조 경로 칩과 같은 층으로 읽힌다. 버튼은 그대로 둘이고 사이의 실선이 경계를
          긋는다(외형 정본은 `chipSurface.ts`). */}
      <div className={chipGroupSurface} data-surface="branch-worktree-group">
        {/* 격리가 켜져 있으면 브랜치 선택을 유예한다 — 작업 트리는 그대로 두고 다음 worktree 의
            base ref 만 정한다(0210 D-101). 꺼져 있으면 `deferTo` 가 undefined 라 기존 즉시 checkout. */}
        <BranchChip
          cwd={cwd}
          disabled={inflight}
          variant="segment"
          trailingDivider
          deferTo={
            worktreeIsolation ? (branch) => chatActions.setWorktreeBaseRef(branch) : undefined
          }
          deferred={worktreeIsolation ? worktreeBaseRef : null}
        />
        <ComposerChip
          label={tr('chat.composer.worktreeIsolation')}
          variant="segment"
          disabled={inflight || !cwd}
          onClick={() => chatActions.setWorktreeIsolation(!worktreeIsolation)}
          // 커밋되지 않은 변경이 새 worktree 에 따라오지 않는다는 사실을 여기서 알린다(D-106) —
          // 준비 단계가 dirty 를 더 이상 거부하지 않으므로 이 문구가 유일한 안내다.
          title={tr('chat.composer.worktreeIsolationHelp')}
          ariaPressed={worktreeIsolation}
        />
      </div>
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
