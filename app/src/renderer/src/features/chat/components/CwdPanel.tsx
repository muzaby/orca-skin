import { useI18n } from '../../../shared/i18n'
import { BranchChip } from '../harnesses/common/composer/BranchChip'
import { ComposerChip } from '../harnesses/common/composer/ComposerChip'
import { ExtraDirChip } from '../harnesses/common/composer/ExtraDirChip'
import { WorktreeToggle } from '../harnesses/common/composer/WorktreeToggle'
import { harnessSurfaces } from '../harnesses/presentation'
import { useDirectoryPicker } from '../hooks/useDirectoryPicker'
import { agentUiPolicy } from '../lib/agentPresentation'
import type { LandingProjects } from '../lib/landingProjectOptions'
import { chatActions, useChatSession } from '../store/chatStore'
import { CwdButton } from './CwdButton'
import { LandingProjectPicker } from './LandingProjectPicker'

interface CwdPanelProps {
  cwd: string | null
  inflight: boolean
  appearance?: 'default' | 'opencode'
  landingProjects?: LandingProjects
}

// 랜딩 작업 컨텍스트 행 — [작업 경로] [브랜치] [참조 경로…] [＋]. OpenCode는 입력 아래에 둔다.
//
// 세션이 확정되기 전(랜딩)에만 뜬다. cwd·브랜치·참조 경로는 새 세션 출생 시 고정되는 값이라
// 편집 가능한 창이 여기뿐이다. Code의 브랜치 묶음은 조회 중에도 placeholder로 표시한다.
export function CwdPanel({
  cwd,
  inflight,
  landingProjects,
  appearance = 'default'
}: CwdPanelProps): React.JSX.Element {
  const surfaces = harnessSurfaces(appearance === 'default' ? 'claude' : appearance)
  const surface = surfaces.cwd
  const { tr } = useI18n()
  const agentKind = useChatSession((s) => s.agentKind)
  const extraDirs = useChatSession((s) => s.extraDirs)
  const rejection = useChatSession((s) => s.extraDirRejection)
  const worktreeIsolation = useChatSession((s) => s.worktreeIsolation)
  const worktreeBaseRef = useChatSession((s) => s.worktreeBaseRef)
  const { pick, picking, errorKey } = useDirectoryPicker()

  return (
    <div
      className={`app-frame-composer-directory flex flex-wrap items-center ${surfaces.directory} ${surface.contextRow}`}
      data-surface="cwd-panel"
      data-state="landing"
      data-appearance={appearance}
    >
      {landingProjects ? (
        <LandingProjectPicker
          cwd={cwd}
          inflight={inflight}
          projects={landingProjects}
          variant={surface.variant}
          className={surfaces.pathWidth}
        />
      ) : (
        <CwdButton
          cwd={cwd}
          sessionStarted={false}
          inflight={inflight}
          variant={surface.variant}
          className={surfaces.pathWidth}
          showChevron={surface.showChevron}
        />
      )}
      {/* Code에서만 Git을 조회한다. 격리 ON이면 선택은 base ref로 유예된다. */}
      <BranchChip
        cwd={cwd}
        hidden={!agentUiPolicy(agentKind).composer.showLandingCwdControls}
        disabled={inflight}
        variant={surface.chipVariant}
        trailingDivider={surface.trailingDivider}
        deferTo={worktreeIsolation ? (branch) => chatActions.setWorktreeBaseRef(branch) : undefined}
        deferred={worktreeIsolation ? worktreeBaseRef : null}
        renderTrigger={(branch, pending) => (
          <div className={surface.chipGroup} data-surface="branch-worktree-group">
            {surface.showChevron && (
              <span aria-hidden="true" className="mx-1 select-none text-t5">
                /
              </span>
            )}
            {branch}
            <WorktreeToggle
              checked={worktreeIsolation}
              disabled={inflight || !cwd || pending}
              onChange={chatActions.setWorktreeIsolation}
              variant={surface.chipVariant}
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
        variant={surface.variant}
        disabled={picking || inflight}
        onClick={() => void pick()}
        title={tr('chat.composer.extraDirAdd')}
      />
      {/* 거부 사유 — 고른 폴더가 칩으로 안 붙었는데 아무 말도 없으면 사용자는 앱이 먹은
          것으로 읽는다(D-020). 다음 추가·제거·작업 경로 변경에서 리듀서가 지운다. */}
      {errorKey && (
        <span role="alert" className="w-full px-1 text-footnote text-rust">
          {tr(errorKey)}
        </span>
      )}
      {rejection === 'root' && (
        <span data-surface="extra-dir-rejection" className="w-full px-1 text-footnote text-rust">
          {tr('chat.composer.extraDirRejectRoot')}
        </span>
      )}
    </div>
  )
}
