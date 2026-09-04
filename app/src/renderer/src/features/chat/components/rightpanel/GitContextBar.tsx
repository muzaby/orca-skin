import { useRef, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { MenuItem, MenuTitle } from '../../../../shared/ui/MenuItem'
import { Popover } from '../../../../shared/ui/Popover'
import { useI18n } from '../../../../shared/i18n'
import { formatRelativeTime } from '../../../../shared/i18n/datetime'
import { PANEL_DEFAULT_WIDTH, type DiffViewOptions } from '../../reducer/chatReducer'
import { chatActions, useChatSession } from '../../store/chatStore'
import { statusForCwd } from '../composer/branchChipState'
import { ALL_CHANGES, type DiffComparison } from './diffComparison'
import { nextDiffPanelWidth } from './diffPanelWidth'
import {
  DIFF_VIEW_MENU_ITEMS,
  diffViewMenuChecked,
  type DiffViewMenuItem
} from './diffViewMenuItems'
import { summaryBaseText, summaryComparisonLabel } from './sessionChangesData'

// 실제 DOM 기준 컨텍스트 바 (0211 ΔV7 D-122): 목록 토글 · 비교 범위 · 설정 · 확대/축소.
// 닫기는 RightPanelTile이 그린다. 범위 라벨은 전체 `기준 → 현재`, 커밋 `<sha7> <제목>`이다.

interface ComparisonMenuProps {
  comparison: DiffComparison
  onPick: (next: DiffComparison) => void
}

/**
 * 비교 기준 메뉴 — **2행 + 커밋 서브메뉴** (0211 ΔV5 D-106·D-107).
 *
 * ΔV4 의 평면 목록에서 바뀐 자리다. 커밋을 첫 화면에 전부 펼치면 커밋이 많은 세션에서
 * 메뉴가 화면을 넘고, 참조 배치가 그것을 서브메뉴로 접는다. `미커밋 변경` 행은 사라졌다.
 */
function ComparisonMenu({ comparison, onPick }: ComparisonMenuProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  const summary = useChatSession((state) => state.gitSnapshot.summary)
  const base = summaryBaseText(summary, tr)
  const commits = summary?.commits ?? []
  const [commitsOpen, setCommitsOpen] = useState(false)
  const commitsRef = useRef<HTMLButtonElement>(null)
  return (
    <div role="none" className="flex w-[280px] flex-col">
      <MenuTitle>{tr('chat.rightpanel.diffComparisonTitle')}</MenuTitle>
      <MenuItem
        role="menuitemradio"
        aria-checked={comparison.kind === 'all'}
        data-diff-comparison="all"
        onClick={() => onPick(ALL_CHANGES)}
      >
        <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">
          {tr('chat.rightpanel.diffAllChanges')}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-g2">
          <span className="truncate text-[11.5px] text-ink2">
            {tr('chat.rightpanel.diffComparedWith', { base })}
          </span>
          {comparison.kind === 'all' && <Icon name="check" size={12} className="shrink-0" />}
        </span>
      </MenuItem>
      {/* 서브메뉴는 **바깥 패널의 자식**이다 — 중첩 `Popover` 로 띄우면 portal 이라 바깥
          패널 밖의 클릭이 되어 바깥 메뉴가 먼저 닫히고 항목 클릭이 도달하지 못한다. */}
      <div className="relative">
        <MenuItem
          ref={commitsRef}
          aria-haspopup="menu"
          aria-expanded={commitsOpen}
          data-diff-comparison-commits
          onClick={() => setCommitsOpen((open) => !open)}
        >
          <span className="min-w-0 flex-1 text-[13px] text-ink">
            {tr('chat.rightpanel.diffCommitScope')}
          </span>
          <Icon name="chevR" size={12} className="ml-auto shrink-0" />
        </MenuItem>
        {commitsOpen && (
          <div
            role="menu"
            data-diff-commit-submenu
            className="app-frame-floating absolute left-full top-0 z-50 ml-1 flex max-h-[320px] w-[280px] flex-col overflow-y-auto rounded-lg border border-border bg-panel p-1 shadow-lg"
          >
            {commits.length === 0 ? (
              <MenuTitle>{tr('chat.rightpanel.diffEmpty')}</MenuTitle>
            ) : (
              commits.map((commit) => (
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
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface ViewMenuProps {
  view: DiffViewOptions
  sidebarVisible: boolean
  onToggleSidebar: () => void
  onCollapseAll: () => void
  onExpandAll: () => void
  onRefresh: () => void
  onSetView: (patch: Partial<DiffViewOptions>) => void
}

/**
 * `⋮` 메뉴 — 항목과 순서의 정본은 `diffViewMenuItems.ts` 다(D-106 · §10 EP-33). 여기서는
 * 그 목록을 그리고 행동만 붙인다: 목록을 컴포넌트 안에 두면 항목 하나를 지운 변이를
 * 배열 비교로 잡을 수 없다. Git 조작(stage·commit·push)은 없다 — 읽기 전용 review surface 다.
 * 마지막 새로 고침은 상태·요약·선택 패치를 다시 조회한다.
 */
function ViewMenu({
  view,
  sidebarVisible,
  onToggleSidebar,
  onCollapseAll,
  onExpandAll,
  onRefresh,
  onSetView
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
  const snapshot = useChatSession((state) => state.gitStatus)
  const cwd = useChatSession((state) => state.cwd)
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
  // 0211 ΔV5 D-104 — 두 값 라벨. `head` 가 없으면 화살표도 그리지 않는다.
  const label = summaryComparisonLabel(
    summary,
    snapshot ? statusForCwd(cwd, snapshot) : null,
    comparison,
    tr
  )
  const filesLabel = tr(
    sidebarVisible ? 'chat.rightpanel.diffFilesOff' : 'chat.rightpanel.diffFilesOn'
  )
  const expandLabel = tr(
    expanded ? 'chat.rightpanel.diffShrinkPanel' : 'chat.rightpanel.diffExpandPanel'
  )

  return (
    <span
      data-diff-context-bar
      className="flex min-w-0 flex-1 items-center gap-[4px] font-sans text-body font-normal"
    >
      {/* ΔV7: 실제 DOM은 표시 상태를 뒤집는 단일 목록 버튼이다. */}
      <Button
        iconOnly
        size="compact"
        leadingIcon="panelL"
        pressed={sidebarVisible}
        aria-pressed={sidebarVisible}
        onClick={() => chatActions.setDiffSidebarVisible(!sidebarVisible)}
        title={filesLabel}
        aria-label={filesLabel}
        data-diff-sidebar-toggle
        className="shrink-0 aria-pressed:text-selected [&[aria-pressed=true]>.btn-squish]:bg-selected-soft"
      />
      <button
        ref={comparisonRef}
        type="button"
        onClick={() => setComparisonOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={comparisonOpen}
        data-diff-comparison-trigger
        className="group/diffscope flex h-[24px] min-w-0 items-center gap-[4px] rounded-[6px] px-[8px] text-left text-body font-normal text-ink2 outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
      >
        {/* 서체는 **버튼 라벨**의 규칙을 따른다 (0211 ΔV6 실측 2·3행) — 참조의 이 자리는
            타일 제목이 아니라 드롭다운 트리거이고, `Button` 이 이미 regular sans 로 정했다.
            `font-serif font-semibold` 가 그 규칙에서 벗어나 있던 자리다. */}
        {label.kind === 'commit' ? (
          <>
            <span data-diff-commit-sha-label className="shrink-0 text-body tabular-nums">
              {label.sha}
            </span>
            <span data-diff-commit-subject-label className="min-w-0 truncate text-body">
              {label.subject}
            </span>
          </>
        ) : (
          <>
            <span data-diff-base-label className="min-w-0 truncate text-body">
              {label.base}
            </span>
            {label.head !== null && (
              <>
                <span aria-hidden="true" className="shrink-0 text-body text-ink3">
                  →
                </span>
                <span data-diff-head-label className="min-w-0 shrink truncate text-body">
                  {label.head}
                </span>
              </>
            )}
          </>
        )}
        <Icon
          name="chevD"
          size={12}
          className="shrink-0 text-ink3 transition-colors group-hover/diffscope:text-ink2"
        />
      </button>
      <span className="ml-auto flex shrink-0 items-center gap-[2px]">
        <Button
          ref={viewRef}
          iconOnly
          size="compact"
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
          size="compact"
          leadingIcon={expanded ? 'collapse' : 'expand'}
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
            chatActions.setDiffSidebarVisible(!sidebarVisible)
          }}
          // 0211 ΔV5 D-105 — 방향이 반대다. 펼치기가 전 경로를 채우고 접기가 비운다.
          onCollapseAll={() => {
            setViewOpen(false)
            chatActions.setAllDiffFilesExpanded(false, [])
          }}
          onExpandAll={() => {
            setViewOpen(false)
            chatActions.setAllDiffFilesExpanded(
              true,
              (patch?.files ?? []).map((file) => file.path)
            )
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
