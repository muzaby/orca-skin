import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { chatActions, useChatSession } from '../../store/chatStore'
import { columnsContain } from '../../lib/rightPanelLayout'
import { statusForCwd } from './branchChipState'
import { COMPOSER_PANEL_ICON_SIZE, composerPanelSurface } from './composerPanel'
import { gitRowView, type GitRowView } from './gitRowState'
import { useGitSnapshot } from './useGitSnapshot'

// 컴포저 입력 **위**의 git 행 — `[저장소] [브랜치] ─ [+N −M]`(0206 D-005).
//
// 좌측 둘은 **표시 전용**이다(D-006): Orca 에 저장소 전환 개념이 없고, 세션 시작 후 브랜치
// 전환은 0201 D-009 가 이미 닫았다. 버튼은 변경량 하나이고 diff 타일을 연다·닫는다(D-007).
//
// PR·CI·상태 글리프는 **그리지 않는다**(D-005) — 배선할 채널이 없고, 상시 보이는 좁은
// 자리에 누를 것 없는 버튼을 두지 않는다. **닫기는 예외다**(0211 ΔV6 D-114): 사용자가
// 요청했고 배선이 생겼다 — 누르면 이 행이 사라지고 **다음 턴 종료 싱크에 다시 선다**.
// 형제 패널(`Notice`)이 이미 같은 자리·같은 primitive 로 닫기를 그린다.
//
// 표면은 스택 크롬 SSOT 가 준다(`composerPanel.ts`, D-021) — 배경·반경·여백을 여기 적으면
// 형제 패널과 어긋난다. 선두 글리프 하나는 참조 배치를 따른 식별 표시다(D-022): 상태를
// 말하지 않고 누를 수 없으므로 D-005 의 네 금지에 걸리지 않는다.

interface GitRowViewProps {
  view: GitRowView
  diffOpen: boolean
  onToggleDiff: () => void
  onClose: () => void
}

export function GitRowView({
  view,
  diffOpen,
  onToggleDiff,
  onClose
}: GitRowViewProps): React.JSX.Element | null {
  const { tr } = useI18n()
  if (!view.visible) return null

  const changesAria = tr('chat.gitRow.changesAria', { added: view.added, removed: view.removed })
  return (
    <nav
      aria-label={tr('chat.gitRow.aria')}
      data-surface="git-row"
      className={`flex items-center gap-g4 ${composerPanelSurface}`}
    >
      {/* 선두 글리프 — 이 행이 무엇에 관한 행인지를 말한다(D-022). `fork` 는 카탈로그의
          분기 글리프이고 랜딩 브랜치 칩도 같은 이름을 쓴다(`BranchChip.tsx:122`). */}
      <Icon name="fork" size={COMPOSER_PANEL_ICON_SIZE} className="shrink-0 text-rust" />
      {/* 좌측 = 식별. `flex-1 min-w-0` 이 남는 공간을 먹고 그 안에서 브랜치가 먼저 줄어든다.
          저장소와 브랜치는 **같은 톤**이다 — 참조 실측에서 둘 다 #868681 한 단계였다. */}
      <span className="flex min-w-0 flex-1 items-center gap-g6">
        {view.repo && (
          <span className="max-w-[160px] shrink truncate text-footnote text-t6">{view.repo}</span>
        )}
        <span className="min-w-0 shrink-[9999] truncate text-footnote text-t6">
          {view.detached ? tr('chat.gitRow.detached') : view.branch}
        </span>
      </span>
      {/* 우측 = 조작. 유일한 채움이고 유일한 버튼이다 — 누르면 새 표면(diff 타일)이 열린다. */}
      <Button
        size="small"
        variant="contained"
        pressed={diffOpen}
        onClick={onToggleDiff}
        title={tr('chat.gitRow.diffTitle')}
        aria-label={changesAria}
        aria-pressed={diffOpen}
      >
        {/* 두 수 사이 간격은 **이 래퍼가 소유**한다. `contents` 로 두면 두 수가 Button 의
            children 래퍼(`<span>`, display 미지정 = inline) 안에 직접 놓여 **gap 이 아예
            적용되지 않는다** — 버튼의 `gap-g2` 는 두 단계 위라 닿지 않고 실측 간격은 0px 였다.
            참조 실측은 5.93px 다(0206 verify D1 정정). */}
        <span className="inline-flex items-center gap-g4 tabular-nums">
          <span aria-hidden="true" className="text-git-added">
            +{view.added}
          </span>
          <span aria-hidden="true" className="text-git-removed">
            −{view.removed}
          </span>
        </span>
      </Button>
      {/* 0211 ΔV6 D-114 — **변경량 버튼 뒤**가 계약이다(AT-70 이 인덱스로 센다). 앞에 두면
          누르려던 변경량 대신 닫기가 눌린다. `Notice` 의 닫기와 같은 primitive·크기다. */}
      <Button
        iconOnly
        size="small"
        leadingIcon="x"
        onClick={onClose}
        title={tr('chat.gitRow.close')}
        aria-label={tr('chat.gitRow.close')}
        data-git-row-close
        className="shrink-0 text-ink3"
      />
    </nav>
  )
}

interface GitRowProps {
  cwd: string | null
  // 랜딩이면 false. **노출 판정은 `gitRowView` 한 곳이 한다**(0206 §10 EP-05) — 호출부가
  // `showGitRow && <GitRow/>` 로 걸러 버리면 판정자가 둘이 되어 조건이 갈라진다.
  sessionStarted: boolean
}

export function GitRow({ cwd, sessionStarted }: GitRowProps): React.JSX.Element | null {
  // 랜딩에서는 조회하지 않는다 — cwd 를 null 로 넘겨 훅 전체를 끈다.
  const sessionId = useChatSession((s) => s.sessionId)
  useGitSnapshot(sessionStarted ? cwd : null, sessionStarted ? sessionId : null)
  const snapshot = useChatSession((s) => s.gitStatus)
  const tiles = useChatSession((s) => s.rightPanelTiles)
  const worktree = useChatSession((s) => s.worktree)
  // 변경량은 diff 요약 합계다(ΔV1 D-025) — 우측 패널과 같은 값을 읽는다.
  const totals = useChatSession((s) => s.gitSnapshot.summary?.totals ?? null)
  const closedAtTick = useChatSession((s) => s.gitRowClosedAtTick)
  const tick = useChatSession((s) => s.turnEndTick)
  const view = gitRowView(
    sessionStarted,
    cwd,
    snapshot ? statusForCwd(cwd, snapshot) : null,
    worktree,
    totals,
    closedAtTick,
    tick
  )
  return (
    <GitRowView
      view={view}
      diffOpen={columnsContain(tiles, 'diff')}
      onToggleDiff={() => chatActions.toggleRightPanelTile('diff')}
      onClose={chatActions.closeGitRow}
    />
  )
}
