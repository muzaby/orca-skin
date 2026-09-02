import { useRef, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { MenuItem, MenuTitle } from '../../../../shared/ui/MenuItem'
import { Popover } from '../../../../shared/ui/Popover'
import { useI18n } from '../../../../shared/i18n'
import { formatRelativeTime } from '../../../../shared/i18n/datetime'
import { PANEL_DEFAULT_WIDTH, type DiffViewOptions } from '../../reducer/chatReducer'
import { chatActions, useChatSession } from '../../store/chatStore'
import { ALL_CHANGES, type DiffComparison } from './diffComparison'
import { nextDiffPanelWidth } from './diffPanelWidth'
import {
  DIFF_VIEW_MENU_ITEMS,
  diffViewMenuChecked,
  type DiffViewMenuItem
} from './diffViewMenuItems'
import { summaryBaseText } from './sessionChangesData'

// 컨텍스트 바 (0211 ΔV4 §4). 다섯 요소 — 폴더 토글 · 비교 기준 `▾` · `⋮` · `↗` · `×`.
// `×` 는 `RightPanelTile` 이 이미 그리므로 여기서는 앞의 넷만 만든다.

interface ComparisonMenuProps {
  comparison: DiffComparison
  onPick: (next: DiffComparison) => void
}

function ComparisonMenu({ comparison, onPick }: ComparisonMenuProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  const summary = useChatSession((state) => state.gitSnapshot.summary)
  const base = summaryBaseText(summary, tr)
  const commits = summary?.commits ?? []
  return (
    <div role="none" className="flex w-[280px] flex-col">
      <MenuTitle>{tr('chat.rightpanel.diffComparisonTitle')}</MenuTitle>
      <MenuItem
        role="menuitemradio"
        aria-checked={comparison.kind === 'all'}
        align="start"
        data-diff-comparison="all"
        onClick={() => onPick(ALL_CHANGES)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink">
            {tr('chat.rightpanel.diffAllChanges')}
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-ink2">
            {tr('chat.rightpanel.diffComparedWith', { base })}
          </span>
        </span>
        {comparison.kind === 'all' && <Icon name="check" size={12} className="mt-1 shrink-0" />}
      </MenuItem>
      <MenuItem
        role="menuitemradio"
        aria-checked={comparison.kind === 'uncommitted'}
        data-diff-comparison="uncommitted"
        onClick={() => onPick({ kind: 'uncommitted' })}
      >
        <span className="min-w-0 flex-1 text-[13px] text-ink">
          {tr('chat.rightpanel.diffUncommittedBlock')}
        </span>
        {comparison.kind === 'uncommitted' && <Icon name="check" size={12} className="shrink-0" />}
      </MenuItem>
      {commits.length > 0 && <MenuTitle>{tr('chat.rightpanel.diffCommitScope')}</MenuTitle>}
      {commits.map((commit) => (
        <MenuItem
          key={commit.sha}
          role="menuitemradio"
          aria-checked={comparison.kind === 'commit' && comparison.sha === commit.sha}
          align="start"
          data-diff-comparison={`commit:${commit.sha}`}
          onClick={() => onPick({ kind: 'commit', sha: commit.sha })}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-ink">{commit.subject}</span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink2">
              {commit.sha.slice(0, 7)} · {commit.author} ·{' '}
              {formatRelativeTime(commit.committedAt, locale)}
            </span>
          </span>
          {comparison.kind === 'commit' && comparison.sha === commit.sha && (
            <Icon name="check" size={12} className="mt-1 shrink-0" />
          )}
        </MenuItem>
      ))}
    </div>
  )
}

interface ViewMenuProps {
  view: DiffViewOptions
  sidebarVisible: boolean
  onToggleSidebar: () => void
  onCollapseAll: () => void
  onExpandAll: () => void
  onSetView: (patch: Partial<DiffViewOptions>) => void
  onRefresh: () => void
}

/**
 * `⋮` 메뉴 — 항목과 순서의 정본은 `diffViewMenuItems.ts` 다(D-086 · §10 EP-33). 여기서는
 * 그 목록을 그리고 행동만 붙인다: 목록을 컴포넌트 안에 두면 항목 하나를 지운 변이를
 * 배열 비교로 잡을 수 없다. Git 조작(stage·commit·push)은 없다 — 읽기 전용 review surface 다.
 */
function ViewMenu({
  view,
  sidebarVisible,
  onToggleSidebar,
  onCollapseAll,
  onExpandAll,
  onSetView,
  onRefresh
}: ViewMenuProps): React.JSX.Element {
  const { tr } = useI18n()
  const run = (item: DiffViewMenuItem): void => {
    if (item.action.kind === 'sidebar') return onToggleSidebar()
    if (item.action.kind === 'collapse-all') return onCollapseAll()
    if (item.action.kind === 'expand-all') return onExpandAll()
    if (item.action.kind === 'refresh') return onRefresh()
    if (item.action.option === 'layout')
      return onSetView({ layout: view.layout === 'side-by-side' ? 'inline' : 'side-by-side' })
    const option = item.action.option
    return onSetView({ [option]: !view[option] } as Partial<DiffViewOptions>)
  }
  return (
    <div role="none" data-diff-view-menu className="flex w-[220px] flex-col">
      {DIFF_VIEW_MENU_ITEMS.map((item) => {
        const checked = diffViewMenuChecked(item, view, sidebarVisible)
        return (
          <MenuItem
            key={item.id}
            data-diff-view-item={item.id}
            {...(item.checkable ? { role: 'menuitemcheckbox', 'aria-checked': checked } : {})}
            onClick={() => run(item)}
          >
            <span className="flex-1">{tr(item.labelKey)}</span>
            {checked && <Icon name="check" size={12} className="ml-auto shrink-0" />}
          </MenuItem>
        )
      })}
    </div>
  )
}

export function GitContextBar(): React.JSX.Element {
  const { tr } = useI18n()
  const summary = useChatSession((state) => state.gitSnapshot.summary)
  const comparison = useChatSession((state) => state.gitSnapshot.comparison)
  const patch = useChatSession((state) => state.gitSnapshot.patch)
  const sidebarVisible = useChatSession((state) => state.gitSnapshot.sidebarVisible)
  const view = useChatSession((state) => state.gitSnapshot.view)
  const columns = useChatSession((state) => state.rightPanelTiles)
  const widths = useChatSession((state) => state.rightPanelColWidths)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const comparisonRef = useRef<HTMLButtonElement>(null)
  const viewRef = useRef<HTMLButtonElement>(null)

  const col = columns.findIndex((column) => column.tiles.includes('diff'))
  const nextWidth = nextDiffPanelWidth(widths[col])
  const expanded = nextWidth === PANEL_DEFAULT_WIDTH
  const label = summaryBaseText(summary, tr)
  const filesLabel = tr('chat.rightpanel.diffShowFiles')
  const expandLabel = tr(
    expanded ? 'chat.rightpanel.diffShrinkPanel' : 'chat.rightpanel.diffExpandPanel'
  )

  return (
    <span data-diff-context-bar className="flex min-w-0 flex-1 items-center gap-g2">
      <Button
        iconOnly
        size="small"
        leadingIcon="folder"
        onClick={chatActions.toggleDiffSidebar}
        title={filesLabel}
        aria-label={filesLabel}
        aria-expanded={sidebarVisible}
        data-diff-sidebar-toggle
      />
      <button
        ref={comparisonRef}
        type="button"
        onClick={() => setComparisonOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={comparisonOpen}
        data-diff-comparison-trigger
        className="group/diffscope flex min-w-0 items-center gap-g1 rounded-r4 px-p2 py-1 text-left outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
      >
        <span className="min-w-0 truncate font-serif text-[13px] font-semibold text-t9">
          {label}
        </span>
        <Icon
          name="chevD"
          size={11}
          className="shrink-0 text-t5 transition-colors group-hover/diffscope:text-t7"
        />
      </button>
      <span className="ml-auto flex shrink-0 items-center gap-g1">
        <Button
          ref={viewRef}
          iconOnly
          size="small"
          leadingIcon="kebab"
          onClick={() => setViewOpen((open) => !open)}
          title={tr('chat.rightpanel.diffViewSettings')}
          aria-label={tr('chat.rightpanel.diffViewSettings')}
          aria-haspopup="menu"
          aria-expanded={viewOpen}
          data-diff-view-trigger
        />
        <Button
          iconOnly
          size="small"
          leadingIcon="panelL"
          onClick={() => chatActions.setRightPanelColWidth(col, nextWidth)}
          title={expandLabel}
          aria-label={expandLabel}
          data-diff-expand-panel
        />
      </span>
      <Popover
        open={comparisonOpen}
        anchorRef={comparisonRef}
        placement="bottom"
        onClose={() => setComparisonOpen(false)}
      >
        <ComparisonMenu
          comparison={comparison}
          onPick={(next) => {
            setComparisonOpen(false)
            chatActions.setDiffComparison(next)
          }}
        />
      </Popover>
      <Popover
        open={viewOpen}
        anchorRef={viewRef}
        placement="bottom"
        align="end"
        onClose={() => setViewOpen(false)}
      >
        <ViewMenu
          view={view}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => {
            setViewOpen(false)
            chatActions.toggleDiffSidebar()
          }}
          onCollapseAll={() => {
            setViewOpen(false)
            chatActions.setAllDiffFilesCollapsed(
              true,
              (patch?.files ?? []).map((file) => file.path)
            )
          }}
          onExpandAll={() => {
            setViewOpen(false)
            chatActions.setAllDiffFilesCollapsed(false, [])
          }}
          onSetView={(next) => chatActions.setDiffViewOption(next)}
          onRefresh={() => {
            setViewOpen(false)
            chatActions.refreshGitSnapshot()
          }}
        />
      </Popover>
    </span>
  )
}
