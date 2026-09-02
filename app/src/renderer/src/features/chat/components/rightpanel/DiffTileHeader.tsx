import { Button } from '../../../../shared/ui/Button'
import { useI18n } from '../../../../shared/i18n'
import { chatActions, useChatSession } from '../../store/chatStore'
import { statusForCwd } from '../composer/branchChipState'
import { gitRowView } from '../composer/gitRowState'

interface DiffTileHeaderViewProps {
  branch: string | null
  title: string
  onRefresh: () => void
}

/** Header keeps only the branch context and the explicit refresh control. */
export function DiffTileHeaderView({
  branch,
  title,
  onRefresh
}: DiffTileHeaderViewProps): React.JSX.Element {
  const { tr } = useI18n()
  const refreshLabel = tr('chat.rightpanel.diffRefresh')
  return (
    <span className="flex min-w-0 items-center gap-g3">
      <Button
        iconOnly
        size="small"
        leadingIcon="refresh"
        onClick={onRefresh}
        title={refreshLabel}
        aria-label={refreshLabel}
      />
      <span className="min-w-0 truncate font-serif text-[13px] font-semibold text-t9">{title}</span>
      {branch && <span className="min-w-0 truncate text-caption text-t5">{branch}</span>}
    </span>
  )
}

export function DiffTileHeader(): React.JSX.Element {
  const { tr } = useI18n()
  const cwd = useChatSession((state) => state.cwd)
  const snapshot = useChatSession((state) => state.gitStatus)
  const worktree = useChatSession((state) => state.worktree)
  const totals = useChatSession((state) => state.gitSnapshot.summary?.totals ?? null)
  const peekTarget = useChatSession((state) => state.gitSnapshot.peekTarget)
  const view = gitRowView(
    true,
    cwd,
    snapshot ? statusForCwd(cwd, snapshot) : null,
    worktree,
    totals
  )
  return (
    <DiffTileHeaderView
      branch={view.visible && !view.detached ? view.branch : null}
      title={tr(peekTarget ? 'chat.rightpanel.diffPeek' : 'chat.rightpanel.diffSessionChanges')}
      onRefresh={chatActions.refreshGitSnapshot}
    />
  )
}
