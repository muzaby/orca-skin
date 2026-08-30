import { Button } from '../../../../shared/ui/Button'
import { useI18n } from '../../../../shared/i18n'
import { chatActions, useChatSession } from '../../store/chatStore'
import { statusForCwd } from '../composer/branchChipState'
import { gitRowView } from '../composer/gitRowState'

// diff 타일 헤더 override — 좌측에 파일트리 토글 + 비교 대상 표시(0206).
//
// **설정 메뉴 · 펼치기 · 이동 핸들을 두지 않는다**(D-013). 셋 다 Orca 에 대응 동작이 없어
// 조사 배치를 그대로 옮기면 누를 것이 없는 버튼이 된다 — 컴포저 행에 적용한 규칙과 같다.
// 닫기는 `RightPanelTile` 이 이미 갖는다.
//
// 비교 대상은 **현재 브랜치만** 쓴다(D-014). base 를 알 채널이 없어 `main →` 을 붙이면
// 그 `main` 이 가짜 값이 된다.

interface DiffTileHeaderViewProps {
  branch: string | null
  filesVisible: boolean
  onToggleFiles: () => void
}

export function DiffTileHeaderView({
  branch,
  filesVisible,
  onToggleFiles
}: DiffTileHeaderViewProps): React.JSX.Element {
  const { tr } = useI18n()
  const label = tr(filesVisible ? 'chat.rightpanel.diffFilesHide' : 'chat.rightpanel.diffFilesShow')
  return (
    <span className="flex min-w-0 items-center gap-g3">
      <Button
        iconOnly
        size="small"
        leadingIcon="folder"
        pressed={filesVisible}
        onClick={onToggleFiles}
        title={label}
        aria-label={label}
        aria-pressed={filesVisible}
      />
      <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
        {branch ?? tr('chat.rightpanel.tiles.diff')}
      </span>
    </span>
  )
}

export function DiffTileHeader(): React.JSX.Element {
  const filesVisible = useChatSession((s) => s.diffFilesVisible)
  const cwd = useChatSession((s) => s.cwd)
  // 컴포저 git 행과 **같은 스냅샷**을 읽는다(0206 D-020) — 조회는 `useGitRowStatus` 한 곳뿐이고
  // 여기서는 그 결과에서 브랜치만 꺼낸다. 판정도 같은 `gitRowView` 를 거친다(§10 EP-05).
  const snapshot = useChatSession((s) => s.gitStatus)
  const worktree = useChatSession((s) => s.worktree)
  const view = gitRowView(true, cwd, snapshot ? statusForCwd(cwd, snapshot) : null, worktree)
  const branch = view.visible ? (view.detached ? null : view.branch) : null
  return (
    <DiffTileHeaderView
      branch={branch}
      filesVisible={filesVisible}
      onToggleFiles={chatActions.toggleDiffFiles}
    />
  )
}
