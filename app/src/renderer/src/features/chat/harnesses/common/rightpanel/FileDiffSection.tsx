import { diffViewPath } from '../../../../../shared/compute/diffViewPath'
import { useDiffAxes, type DiffAxes } from '../../../hooks/useDiffAxes'
import { DiffScrollAnchorContext } from '../../../hooks/useDiffScrollCoordinator'
import { useMountedRows } from '../../../../../shared/ui/virtual/rowMount'
import { useDiffAnchor, useDiffContext } from '../../../hooks/useDiffAnchor'
import {
  useDiffViewWindow,
  useDiffRowWindow,
  diffWindowPriority
} from '../../../hooks/useDiffViewWindow'
import { useWindowTokens } from '../../../hooks/useWindowTokens'
import { extToLang } from '../../../lib/lang'
import { buildDiffView, type DiffCell } from '../../../../../shared/compute/diffView'
import {
  packLines,
  type DiffOptions,
  type DiffSourceRef
} from '../../../../../shared/compute/diffSource'
import { useComputeDocument } from '../../../../../shared/compute/useComputeDocument'
import {
  DIFF_MODEL_SYNC_MAX_CHARS,
  TOKENS_RANGE_MAX_LINES
} from '../../../../../shared/compute/limits'
import { useVirtualRows } from '../../../../../shared/ui/virtual/useVirtualRows'
import {
  VIRTUAL_BODY_MIN_LINES,
  VIRTUAL_ROW_ESTIMATE_PX
} from '../../../../../shared/ui/virtual/limits'
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { DiffRequirementItem, GitDiffPatchLine } from '../../../../../../../shared/ipc'
import { buildCounterparts } from '../../../../../shared/compute/diffView'
import { Icon } from '../../../../../shared/ui/Icon'
import { useI18n } from '../../../../../shared/i18n'
import {
  buildDiffHunks,
  expandGap,
  revealDiffHunkLine,
  type DiffHunkGapRow,
  type DiffHunkLineRow,
  type DiffHunkState,
  type GapDirection
} from '../../../lib/diffHunks'
import {
  changedWordSpan,
  collapseWhitespaceOnlyChanges,
  toSideBySideRows
} from '../../../lib/diffDisplay'
import { patchLinesToDiffLines } from '../../../lib/diffPatchLines'
import { planUpwardExpansionCompensation } from '../../../lib/diffViewport'
import { lineAxisLabel, lineNumberLabel, type DiffLine } from '../../../lib/diffLines'
import { useSmallDiffSyntax } from '../../../hooks/useSmallDiffSyntax'
import { DiffSyntaxContext } from '../../../hooks/useDiffSyntax'
import { syntaxText } from '../transcript/diffSyntaxText'
import type { DiffRequirementDraft, DiffViewOptions } from '../../../reducer/chatReducer'
import { diffRequirementLineKey, diffRequirementMatchesLine } from './diffRequirements'
import { revealDiffRequirement } from '../../../lib/diffRequirementScroll'
import type { DiffSection } from './diffComparison'

/** 문맥을 한 번에 여는 폭. 남은 줄이 이보다 적으면 gap 자체가 사라진다(0211 ΔV4 D-090). */
export const CONTEXT_EXPAND_STEP = 20
/** 처음 보여줄 변경 주변 문맥. */
const INITIAL_CONTEXT = 3

// 줄마다 만들던 빈 배열을 하나로 접는다 — 요구사항 없는 파일이 일반적인 상태다.
const EMPTY_RANGES: DiffOptions['expansions'] = []
const NO_REQUIREMENTS: readonly DiffRequirementItem[] = Object.freeze([])

export interface FileDiffSectionProps {
  section: DiffSection
  collapsed: boolean
  view: DiffViewOptions
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  activeRequirementId?: string | null
  selectionVersion?: number
  onSelectRequirement?: (id: string) => void
  scrollOwnerRef: React.RefObject<HTMLDivElement | null>
  tailSpacerRef: React.RefObject<HTMLDivElement | null>
  onToggleCollapsed: (path: string) => void
  /** `↗` — 그 파일을 OS 탐색기에서 선택해 연다 (0211 ΔV5 D-108). */
  onOpenFile: (path: string) => void
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    before?: { old: number | null; new: number | null }
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}

function splitPath(path: string): { parent: string; name: string } {
  const cut = path.lastIndexOf('/')
  return cut < 0
    ? { parent: '', name: path }
    : { parent: path.slice(0, cut), name: path.slice(cut + 1) }
}

// eslint-disable-next-line react-refresh/only-export-components -- action seams share the component's draft contract.
export function shouldCancelDiffRequirementDraft(key: string, isComposing: boolean): boolean {
  return key === 'Escape' && !isComposing
}

// eslint-disable-next-line react-refresh/only-export-components -- action seams share the component's draft contract.
export function buildDiffRequirementSubmission(
  lines: readonly DiffLine[],
  lineIndex: number,
  comment: string
): { lines: readonly DiffLine[]; lineIndex: number; comment: string } | null {
  return comment.trim() === '' ? null : { lines, lineIndex, comment }
}

/**
 * 한 파일의 섹션 (0211 ΔV4 D-073 · ΔV5 D-105·D-108). 헤더가 곧 목록 행이고 그 아래에 diff 가
 * 이어진다 — 별도 화면으로 가지 않는다. **기본은 접힘**이고 헤더를 누르면 이 파일만 펼쳐진다.
 *
 * 헤더는 **한 줄**이다(참조 배치): chevron · 아이콘 · 이름 · 흐린 부모 경로 · `+N −M` · `↗`.
 * 접기 토글과 `↗` 는 **형제 버튼**이다 — 버튼 안에 버튼을 넣으면 무효 HTML 이고 중첩 클릭이
 * 두 동작을 함께 발화한다.
 */
export function FileDiffSection({
  section,
  collapsed,
  view,
  requirements,
  draft,
  activeRequirementId,
  selectionVersion,
  onSelectRequirement,
  scrollOwnerRef,
  tailSpacerRef,
  onToggleCollapsed,
  onOpenFile,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: FileDiffSectionProps): React.JSX.Element {
  const { tr } = useI18n()
  const { parent, name } = splitPath(section.path)
  const sectionRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const element = sectionRef.current
    if (!element || collapsed || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (bodyRef.current) setHeight(bodyRef.current.offsetHeight)
        setNear(entry.isIntersecting)
      },
      { root: scrollOwnerRef.current, rootMargin: '100% 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [collapsed, scrollOwnerRef])
  const [expanded, setExpanded] = useState<{
    lines: readonly GitDiffPatchLine[]
    ignoreWhitespace: boolean
    value: DiffOptions['expansions']
  } | null>(null)
  const patchLines = section.patch?.lines
  const expansions =
    expanded?.lines === patchLines && expanded?.ignoreWhitespace === view.ignoreWhitespace
      ? expanded.value
      : EMPTY_RANGES
  const setExpansions = useCallback<
    React.Dispatch<React.SetStateAction<DiffOptions['expansions']>>
  >(
    (next) => {
      if (!patchLines) return
      setExpanded((previous) => {
        const value =
          previous?.lines === patchLines && previous.ignoreWhitespace === view.ignoreWhitespace
            ? previous.value
            : EMPTY_RANGES
        return {
          lines: patchLines,
          ignoreWhitespace: view.ignoreWhitespace,
          value: typeof next === 'function' ? next(value) : next
        }
      })
    },
    [patchLines, view.ignoreWhitespace]
  )
  const pinned =
    draft?.filePath === section.path ||
    requirements.some(
      (item) => item.id === activeRequirementId && item.anchor.filePath === section.path
    )
  const [openedGeneration, setOpenedGeneration] = useState<typeof section.patch>(null)
  const open =
    !!section.patch && !collapsed && (near || pinned || openedGeneration === section.patch)
  if (open && openedGeneration !== section.patch) setOpenedGeneration(section.patch)
  if (collapsed && openedGeneration) setOpenedGeneration(null)
  return (
    <section ref={sectionRef} data-diff-file={section.path} className="relative min-w-0">
      {/* 0211 ΔV6 실측 5행 — 참조의 파일 헤더는 폭 전체를 채우는 밴드다(`#f2f2f2`). 배경이
          없으면 접힌 헤더들이 본문과 같은 평면이라 파일 경계가 읽히지 않는다. */}
      <div
        data-diff-file-header
        className="group/filehead sticky top-0 z-[4] flex h-[32px] w-full items-center bg-bg2 font-sans"
      >
        <button
          type="button"
          data-diff-file-toggle={section.path}
          aria-expanded={!collapsed}
          aria-label={tr('chat.rightpanel.diffFileToggleAria', { path: section.path })}
          onClick={() => onToggleCollapsed(section.path)}
          className="flex h-full min-w-0 flex-1 items-center gap-[4px] pl-[8px] pr-[32px] text-left outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
        >
          <Icon
            name={collapsed ? 'chevR' : 'chevD'}
            size={16}
            className="shrink-0 text-ink3 transition-colors group-hover/filehead:text-ink2"
          />
          <Icon name="doc" size={12} className="shrink-0 text-ink3" />
          <span className="flex min-w-0 items-baseline gap-[4px] overflow-hidden whitespace-nowrap text-footnote text-ink2">
            <span className="max-w-full shrink-0 truncate font-normal">{name}</span>
            {parent.length > 0 && (
              <span className="min-w-0 truncate text-footnote text-ink3" title={parent}>
                {parent}
              </span>
            )}
          </span>
          <span
            data-diff-file-counts
            className="flex shrink-0 gap-[2px] text-footnote tabular-nums"
          >
            <span className="text-git-added">+{section.added}</span>
            <span className="text-git-removed">−{section.removed}</span>
          </span>
        </button>
        <button
          type="button"
          data-diff-file-open={section.path}
          aria-label={tr('chat.rightpanel.diffOpenFileAria', { path: section.path })}
          title={tr('chat.rightpanel.diffOpenFile')}
          onClick={() => onOpenFile(section.path)}
          className="absolute right-[8px] flex size-[20px] shrink-0 items-center justify-center rounded-[4px] text-ink opacity-0 outline-none transition-opacity hide-focus-ring ring-focus hover:bg-fill-uncontained-hover group-hover/filehead:opacity-100 group-focus-within/filehead:opacity-100 [@media(pointer:coarse)]:opacity-100"
        >
          <Icon name="fileOpen" size={12} />
        </button>
      </div>
      {!collapsed &&
        (section.patch === null ? (
          <p className="px-p5 pb-p3 text-footnote text-ink3">
            {tr('chat.rightpanel.diffNoSessionChange')}
          </p>
        ) : section.patch.kind === 'binary' ? (
          <p className="px-p5 pb-p3 text-footnote text-ink3">
            {tr('chat.rightpanel.diffFileBinary')}
          </p>
        ) : section.patch.kind === 'too-large' ? (
          <p className="px-p5 pb-p3 text-footnote text-ink3">
            {tr('chat.rightpanel.diffFileTooLarge')}
          </p>
        ) : open ? (
          <div ref={bodyRef}>
            <GitBody
              near={near}
              lastHeight={height}
              expansions={expansions}
              setExpansions={setExpansions}
              key={`${section.path}:${view.ignoreWhitespace}`}
              filePath={section.path}
              revisionSource={section.patch}
              lines={section.patch.lines}
              view={view}
              requirements={requirements}
              draft={draft}
              selection={{ activeRequirementId, selectionVersion, onSelectRequirement }}
              scrollOwnerRef={scrollOwnerRef}
              tailSpacerRef={tailSpacerRef}
              onDraftChange={onDraftChange}
              onAddRequirement={onAddRequirement}
              onRemoveRequirement={onRemoveRequirement}
            />
          </div>
        ) : (
          <div
            aria-busy="true"
            data-diff-placeholder=""
            style={{
              height:
                height ||
                20 *
                  Math.max(
                    1,
                    Math.min(section.patch.lines.length, 7 * (section.added + section.removed) + 1)
                  )
            }}
          />
        ))}
    </section>
  )
}

type GitBodyProps = Parameters<typeof FileDiffBody>[0] & {
  revisionSource: object
  near: boolean
  lastHeight: number
  expansions: DiffOptions['expansions']
  setExpansions: React.Dispatch<React.SetStateAction<DiffOptions['expansions']>>
}
function GitBody(props: GitBodyProps): React.JSX.Element {
  const large = useMemo(() => {
    if (props.lines.length > VIRTUAL_BODY_MIN_LINES) return true
    let chars = 0
    return props.lines.some((line) => (chars += line.text.length) > DIFF_MODEL_SYNC_MAX_CHARS)
  }, [props.lines])
  return large ? (
    <WindowedGitBody {...props} />
  ) : (
    <FileDiffBody
      {...props}
      active={props.near || !!props.draft || !!props.selection.activeRequirementId}
    />
  )
}

interface WindowSyntax {
  axes: DiffAxes | null
  priority: import('../../../../../shared/compute/client').Priority
  cells: DiffCell[]
  source: DiffSourceRef
  options: DiffOptions
  lang: string | undefined
  ready: boolean
}
const WindowSyntaxContext = createContext<WindowSyntax | null>(null)

function WindowedGitBody(props: GitBodyProps): React.JSX.Element {
  const { filePath, lines, view, scrollOwnerRef, tailSpacerRef } = props
  const id = 'git:' + filePath
  const packed = useMemo(() => packLines(lines), [lines])
  const doc = useComputeDocument(id, packed.text, 'compute', props.revisionSource, packed.lines)
  const source = useMemo<DiffSourceRef>(() => ({ kind: 'lines', doc: doc.ref }), [doc.ref])
  const model = useMemo(
    () =>
      diffViewPath(lines) === 'sync'
        ? buildDiffView(patchLinesToDiffLines(lines), view.ignoreWhitespace)
        : null,
    [lines, view.ignoreWhitespace]
  )
  const axes = useDiffAxes(model, id, props.revisionSource, view.ignoreWhitespace)
  const { expansions, setExpansions } = props
  const options = useMemo<DiffOptions>(
    () => ({
      layout: view.layout,
      highlightWords: view.highlightWords,
      ignoreWhitespace: view.ignoreWhitespace,
      expansions
    }),
    [view.layout, view.highlightWords, view.ignoreWhitespace, expansions]
  )
  const selected = props.requirements.find(
    (item) =>
      item.located &&
      item.id === props.selection.activeRequirementId &&
      item.anchor.filePath === filePath
  )
  const draft = props.draft?.filePath === filePath ? props.draft : null
  const selectedAt = useDiffAnchor(source, options, model, selected?.anchor ?? null, doc.ready)
  const draftAt = useDiffAnchor(source, options, model, draft, doc.ready)
  const draftLine = draftAt?.lineIndex[0] ?? -1
  const context = useDiffContext(source, view.ignoreWhitespace, model, draftLine, doc.ready)
  useEffect(() => {
    const hidden = [selectedAt, draftAt].filter(
      (at) =>
        at &&
        at.rowIndex[0] === -1 &&
        at.lineIndex[0] >= 0 &&
        !expansions.some(([a, b]) => a <= at.lineIndex[0] && at.lineIndex[0] < b)
    )
    if (hidden.length)
      setExpansions((old) => [
        ...old,
        ...hidden.map((at) => [Math.max(0, at!.lineIndex[0] - 3), at!.lineIndex[0] + 4] as const)
      ])
  }, [selectedAt, draftAt, expansions, setExpansions])
  const initial = useDiffViewWindow(source, options, model, 0, 1, doc.ready)
  const root = useRef<HTMLDivElement>(null)
  const rowCount = initial?.summary.rowCount ?? 0
  const list = useVirtualRows(
    rowCount,
    root,
    scrollOwnerRef,
    !props.near ? 'hidden' : rowCount <= VIRTUAL_BODY_MIN_LINES ? 'all' : undefined
  )
  const items = list.getVirtualItems()
  const start = items[0]?.index ?? 0,
    end = (items.at(-1)?.index ?? -1) + 1
  const { data, rowAt: windowRow } = useDiffRowWindow(
    source,
    options,
    model,
    start,
    end,
    doc.ready,
    diffWindowPriority(start, end, list.range)
  )
  const draftRow = draftAt?.rowIndex[0] ?? -1
  const selectedRow = selectedAt?.rowIndex[0] ?? -1
  const pinnedDraft = useDiffViewWindow(
    source,
    options,
    model,
    Math.max(0, draftRow),
    Math.max(0, draftRow + 1),
    doc.ready && draftRow >= 0,
    diffWindowPriority(draftRow, draftRow + 1, list.range)
  )
  const pinnedSelection = useDiffViewWindow(
    source,
    options,
    model,
    Math.max(0, selectedRow),
    Math.max(0, selectedRow + 1),
    doc.ready && selectedRow >= 0,
    diffWindowPriority(selectedRow, selectedRow + 1, list.range)
  )
  const pins = [...new Set([draftRow, selectedRow])].filter(
    (i) => i >= 0 && (i < start || i >= end)
  )
  const renderItems = pins.length
    ? [
        ...items,
        ...pins.map((index) => ({
          index,
          start: list.measurementsCache[index]?.start ?? index * VIRTUAL_ROW_ESTIMATE_PX
        }))
      ].sort((a, b) => a.index - b.index)
    : items
  const rowAt = (
    index: number
  ): import('../../../../../shared/compute/diffView').DiffViewRow | undefined =>
    (index === draftRow ? pinnedDraft?.rows[0] : undefined) ??
    (index === selectedRow ? pinnedSelection?.rows[0] : undefined) ??
    windowRow(index)
  useMountedRows(
    renderItems.flatMap((item) => {
      const row = rowAt(item.index)
      return row ? [row.id] : []
    })
  )
  const seen = useRef('')
  const navigation = JSON.stringify([
    selected?.id,
    props.selection.selectionVersion,
    source,
    view.layout
  ])
  useEffect(() => {
    if (!selected || selectedRow < 0 || seen.current === navigation) return
    if (revealDiffRequirement(scrollOwnerRef.current, selected.id)) seen.current = navigation
    else list.scrollToIndex(selectedRow, { align: 'center' })
  }, [selected, selectedRow, list, navigation, scrollOwnerRef, data])
  const rememberAnchor = useContext(DiffScrollAnchorContext)
  useLayoutEffect(() => {
    if (!rememberAnchor) return
    // TanStack exposes this scroll policy as an imperative instance callback.
    // eslint-disable-next-line react-hooks/immutability
    list.shouldAdjustScrollPositionOnItemSizeChange = () => false
    return () => {
      delete list.shouldAdjustScrollPositionOnItemSizeChange
    }
  }, [list, rememberAnchor])
  const preserve = useRef<{ id: string; top: number; previous: DiffOptions } | null>(null)
  useLayoutEffect(() => {
    const correction = preserve.current,
      owner = scrollOwnerRef.current,
      tail = tailSpacerRef.current
    if (!correction || !owner || !tail || !data || correction.previous === options) return
    const anchor = root.current?.querySelector<HTMLElement>(
      '[data-window-row="' + correction.id + '"]'
    )
    if (!anchor) return
    const result = planUpwardExpansionCompensation({
      scrollTop: owner.scrollTop,
      scrollHeight: owner.scrollHeight,
      clientHeight: owner.clientHeight,
      anchorDelta: anchor.getBoundingClientRect().top - correction.top,
      tailSpacerHeight: parseFloat(tail.style.height) || 0
    })
    tail.style.height = result.tailSpacerHeight + 'px'
    owner.scrollTop = result.scrollTop
    preserve.current = null
  }, [data, options, scrollOwnerRef, tailSpacerRef])
  const expand = (id: string, dir: GapDirection): void => {
    const gap = data?.rows.find((row) => row.kind === 'gap' && row.id === id)
    if (gap?.kind !== 'gap') return
    if (dir === 'up') {
      const anchor = root.current?.querySelector<HTMLElement>(
        '[data-window-row="' + id + '"]'
      )?.nextElementSibling
      const key = anchor?.getAttribute('data-window-row')
      if (anchor instanceof HTMLElement && rememberAnchor) rememberAnchor(anchor)
      else if (anchor && key)
        preserve.current = { id: key, top: anchor.getBoundingClientRect().top, previous: options }
    }
    const range: readonly [number, number] =
      dir === 'up'
        ? [Math.max(gap.start, gap.end - CONTEXT_EXPAND_STEP), gap.end]
        : [gap.start, Math.min(gap.end, gap.start + CONTEXT_EXPAND_STEP)]
    setExpansions((previous) => [...previous, range])
  }
  const wrapClass = view.wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
  if (!model && (doc.unavailable || initial === null || data === null))
    return <FileDiffBody {...props} />
  return (
    <div
      data-diff-file-body={filePath}
      className={view.wrapLines ? 'pb-p2' : 'overflow-x-auto pb-p2'}
    >
      <div
        ref={root}
        data-virtual-git=""
        aria-busy={!initial || undefined}
        style={{
          position: 'relative',
          height:
            !props.near && props.lastHeight
              ? props.lastHeight
              : initial
                ? list.getTotalSize()
                : VIRTUAL_ROW_ESTIMATE_PX,
          minWidth:
            !view.wrapLines && initial
              ? 'calc(' + initial.summary.widthColumns + 'ch + 5em)'
              : undefined
        }}
      >
        {renderItems.map((item) => {
          const row = rowAt(item.index)
          if (!row) return null
          const cells =
            row.kind === 'gap'
              ? []
              : row.kind === 'line'
                ? [row]
                : [row.left, row.right].filter((c): c is DiffCell => !!c)
          const lineRows = cells
            .filter((c, i) => i === 0 || c.sourceIndex !== cells[i - 1].sourceIndex)
            .map((c): DiffHunkLineRow => ({
              kind: 'line',
              id: `line:${c.sourceIndex}`,
              sourceIndex: c.sourceIndex,
              line: c.line
            }))
          return (
            <div
              key={row.id}
              data-window-row={row.id}
              ref={list.measureElement}
              data-index={item.index}
              style={{
                position: 'absolute',
                width: '100%',
                top: item.start - list.options.scrollMargin
              }}
            >
              <WindowSyntaxContext.Provider
                value={{
                  source,
                  axes,
                  options,
                  cells,
                  lang: extToLang(filePath),
                  ready: doc.ready,
                  priority:
                    list.range &&
                    item.index >= list.range.startIndex &&
                    item.index <= list.range.endIndex
                      ? 'visible'
                      : 'background'
                }}
              >
                {row.kind === 'pair' ? (
                  <SideBySideBody
                    {...props}
                    rows={lineRows}
                    wrapClass={wrapClass}
                    onExpand={expand}
                  />
                ) : (
                  <table
                    data-diff-inline
                    className="w-full border-collapse font-mono text-footnote"
                  >
                    <colgroup>
                      <col className="w-[calc(4ch+16px)]" />
                      <col className="w-[12px]" />
                      <col />
                    </colgroup>
                    <tbody>
                      {row.kind === 'gap' ? (
                        <GapRow row={row} colSpan={3} onExpand={expand} />
                      ) : (
                        <InlineLineRow
                          {...props}
                          lines={context?.lines ?? []}
                          draftIndex={context?.offset}
                          draft={context ? draft : null}
                          onAddRequirement={(input) =>
                            props.onAddRequirement?.({
                              ...input,
                              before: context && { old: context.oldBefore, new: context.newBefore }
                            })
                          }
                          row={lineRows[0]}
                          counterpart={null}
                          wrapClass={wrapClass}
                        />
                      )}
                    </tbody>
                  </table>
                )}
              </WindowSyntaxContext.Provider>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface PendingCompensation {
  anchorId: string
  top: number
  insertedAbove: number
}

interface RequirementSelection {
  activeRequirementId?: string | null
  selectionVersion?: number
  onSelectRequirement?: (id: string) => void
}

function FileDiffBody({
  filePath,
  active = true,
  lastHeight = 0,
  lines,
  view,
  requirements,
  draft,
  selection,
  scrollOwnerRef,
  tailSpacerRef,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: {
  active?: boolean
  lastHeight?: number
  filePath: string
  lines: readonly GitDiffPatchLine[]
  view: DiffViewOptions
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  selection: RequirementSelection
  scrollOwnerRef: React.RefObject<HTMLDivElement | null>
  tailSpacerRef: React.RefObject<HTMLDivElement | null>
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    before?: { old: number | null; new: number | null }
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const diffLines = useMemo(() => {
    const converted = patchLinesToDiffLines(lines)
    return view.ignoreWhitespace ? collapseWhitespaceOnlyChanges(converted) : converted
  }, [lines, view.ignoreWhitespace])
  const initialHunks = useMemo(() => buildDiffHunks(diffLines, INITIAL_CONTEXT), [diffLines])
  const [expandedHunks, setHunks] = useState<DiffHunkState>(initialHunks)
  const hunks = expandedHunks.lines === diffLines ? expandedHunks : initialHunks
  const syntax = useSmallDiffSyntax(diffLines, filePath)
  const pending = useRef<PendingCompensation | null>(null)
  const selectedRequirement = requirements.find(
    (item) =>
      item.id === selection.activeRequirementId && item.located && item.anchor.filePath === filePath
  )
  const selectedIndex = selectedRequirement
    ? diffLines.findIndex((line) => diffRequirementMatchesLine(selectedRequirement, filePath, line))
    : -1
  const visibleHunks = useMemo(
    () => revealDiffHunkLine(hunks, selectedIndex, INITIAL_CONTEXT),
    [hunks, selectedIndex]
  )
  const lastReveal = useRef<{
    id: string
    version: number | undefined
    lines: readonly GitDiffPatchLine[]
    layout: DiffViewOptions['layout']
  } | null>(null)

  // 선택으로 연 문맥도 유지한다. 입력이 바뀐 렌더에서 조정해 effect 연쇄 렌더를 피한다.
  if (visibleHunks !== hunks) setHunks(visibleHunks)

  // 부모의 scroll owner ref가 부착된 뒤 실행해야 캐시로 타일을 재열 때도 이동한다.
  useEffect(() => {
    if (!selectedRequirement) {
      lastReveal.current = null
      return
    }
    const previous = lastReveal.current
    if (
      previous?.id === selectedRequirement.id &&
      previous.version === selection.selectionVersion &&
      previous.lines === lines &&
      previous.layout === view.layout
    )
      return
    if (revealDiffRequirement(scrollOwnerRef.current, selectedRequirement.id)) {
      lastReveal.current = {
        id: selectedRequirement.id,
        version: selection.selectionVersion,
        lines,
        layout: view.layout
      }
    }
  }, [
    hunks,
    visibleHunks,
    selectedRequirement,
    selection.selectionVersion,
    lines,
    view.layout,
    scrollOwnerRef
  ])

  // 위쪽 확장은 보던 줄을 밀어낸다 — 삽입된 만큼 scrollTop 을 보정해 그 줄을 제자리에 둔다.
  // 아래쪽 확장은 아래에 넣으므로 보정이 필요 없고 `insertedAbove` 가 0 이다(D-090).
  useLayoutEffect(() => {
    const compensation = pending.current
    const owner = scrollOwnerRef.current
    const spacer = tailSpacerRef.current
    if (!compensation || !owner || !spacer || compensation.insertedAbove <= 0) {
      pending.current = null
      return
    }
    const anchor = owner.querySelector<HTMLElement>(
      `[data-diff-hunk-row-id="${compensation.anchorId}"]`
    )
    if (anchor) {
      const planned = planUpwardExpansionCompensation({
        scrollTop: owner.scrollTop,
        scrollHeight: owner.scrollHeight,
        clientHeight: owner.clientHeight,
        anchorDelta: anchor.getBoundingClientRect().top - compensation.top,
        tailSpacerHeight: Number.parseFloat(spacer.style.height) || 0
      })
      spacer.style.height = `${planned.tailSpacerHeight}px`
      owner.scrollTop = planned.scrollTop
    }
    pending.current = null
  }, [hunks, scrollOwnerRef, tailSpacerRef])

  const expand = useCallback(
    (id: string, direction: GapDirection) => {
      const rowIndex = hunks.rows.findIndex((row) => row.kind === 'gap' && row.id === id)
      const successor =
        rowIndex >= 0
          ? hunks.rows.slice(rowIndex + 1).find((row) => row.kind === 'line')
          : undefined
      const owner = scrollOwnerRef.current
      const anchor =
        successor && owner?.querySelector<HTMLElement>(`[data-diff-hunk-row-id="${successor.id}"]`)
      const result = expandGap(hunks, id, CONTEXT_EXPAND_STEP, direction)
      if (anchor && successor && result.insertedAbove > 0) {
        pending.current = {
          anchorId: successor.id,
          top: anchor.getBoundingClientRect().top,
          insertedAbove: result.insertedAbove
        }
      }
      setHunks(result.state)
    },
    [hunks, scrollOwnerRef]
  )

  if (!active) return <div data-diff-placeholder="" style={{ height: lastHeight }} />
  const wrapClass = view.wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
  const body =
    view.layout === 'side-by-side' ? (
      <SideBySideBody
        rows={visibleHunks.rows}
        wrapClass={wrapClass}
        view={view}
        onExpand={expand}
        filePath={filePath}
        requirements={requirements}
        selection={selection}
        onRemoveRequirement={onRemoveRequirement}
      />
    ) : (
      <InlineBody
        rows={visibleHunks.rows}
        lines={hunks.lines}
        filePath={filePath}
        wrapClass={wrapClass}
        view={view}
        requirements={requirements}
        draft={draft}
        selection={selection}
        onExpand={expand}
        onDraftChange={onDraftChange}
        onAddRequirement={onAddRequirement}
        onRemoveRequirement={onRemoveRequirement}
      />
    )

  return (
    <div
      data-diff-file-body={filePath}
      className={view.wrapLines ? 'pb-p2' : 'overflow-x-auto pb-p2'}
    >
      {hunks.rows.length === 0 ? (
        <p className="px-p5 pb-p3 text-footnote text-ink3">{tr('chat.rightpanel.diffEmpty')}</p>
      ) : (
        <DiffSyntaxContext value={syntax}>{body}</DiffSyntaxContext>
      )}
    </div>
  )
}

function GapRow({
  row,
  colSpan,
  onExpand
}: {
  row: DiffHunkGapRow
  colSpan: number
  onExpand: (id: string, direction: GapDirection) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const hidden = row.end - row.start
  const label = tr('chat.rightpanel.diffUnmodifiedLines', { count: hidden })
  return (
    <tr data-diff-gap={row.id}>
      <td colSpan={colSpan} className="px-[8px] py-[8px] font-sans">
        <span className="flex items-center gap-[4px]">
          {row.canUp && (
            <button
              type="button"
              data-diff-gap-up={row.id}
              onClick={() => onExpand(row.id, 'up')}
              className="group/gapup flex items-center gap-[4px] rounded-[4px] text-footnote text-ink3 outline-none transition-colors hide-focus-ring ring-focus hover:text-ink2"
            >
              <Icon name="chevU" size={11} />
              <span>{label}</span>
            </button>
          )}
          {row.canDown && (
            <button
              type="button"
              data-diff-gap-down={row.id}
              onClick={() => onExpand(row.id, 'down')}
              className="group/gapdown flex items-center gap-[4px] rounded-[4px] text-footnote text-ink3 outline-none transition-colors hide-focus-ring ring-focus hover:text-ink2"
            >
              <Icon name="chevD" size={11} />
              {!row.canUp && <span>{label}</span>}
            </button>
          )}
        </span>
      </td>
    </tr>
  )
}

function rowTint(type: DiffLine['type']): string {
  if (type === 'added') return 'bg-[color-mix(in_srgb,var(--color-git-added)_14%,transparent)]'
  if (type === 'removed') return 'bg-[color-mix(in_srgb,var(--color-git-removed)_14%,transparent)]'
  return ''
}

/** 바뀐 토큰만 덧칠한다. 꺼져 있으면 강조 요소가 **0개**여야 메뉴 항목이 뜻을 갖는다(D-089). */
function LineText({
  line,
  counterpart,
  wrapClass,
  highlight,
  axis = line.type === 'removed' ? 'old' : 'new'
}: {
  line: DiffLine
  counterpart: DiffLine | null
  wrapClass: string
  highlight: boolean
  axis?: 'old' | 'new'
}): React.JSX.Element {
  const window = useContext(WindowSyntaxContext)
  if (window)
    return <WindowLineText window={window} line={line} axis={axis} wrapClass={wrapClass} />
  return <LegacyLineText {...{ line, axis, highlight, wrapClass, counterpart }} />
}
function WindowLineText({
  window,
  line,
  axis,
  wrapClass
}: {
  window: WindowSyntax
  line: DiffLine
  axis: 'old' | 'new'
  wrapClass: string
}): React.JSX.Element {
  const cell = window.cells.find((c) => c.line === line)!
  const pos = axis === 'old' ? cell.oldAxis : cell.newAxis
  const start = Math.floor(pos / TOKENS_RANGE_MAX_LINES) * TOKENS_RANGE_MAX_LINES
  const source = useMemo(
    () =>
      window.axes
        ? { doc: window.axes[axis] }
        : {
            axis: { source: window.source, ignoreWhitespace: window.options.ignoreWhitespace, axis }
          },
    [window.source, window.axes, window.options.ignoreWhitespace, axis]
  )
  const parts = useWindowTokens(
    source,
    window.lang,
    start,
    window.priority,
    window.axes?.ready ?? window.ready
  )?.[pos - start]
  return (
    <DiffTextContent
      {...{ line, wrapClass }}
      tokens={parts?.map((t) => t.content).join('') === line.text ? parts : undefined}
      span={cell.wordSpan}
    />
  )
}
function LegacyLineText({
  line,
  axis,
  highlight,
  wrapClass,
  counterpart
}: Required<Parameters<typeof LineText>[0]>): React.JSX.Element {
  const tokens = useContext(DiffSyntaxContext).get(line)?.[axis]
  const span =
    highlight && counterpart && (line.type === 'added' || line.type === 'removed')
      ? changedWordSpan(
          line.type === 'removed' ? line.text : counterpart.text,
          line.type === 'removed' ? counterpart.text : line.text
        )[line.type === 'removed' ? 'old' : 'new']
      : null
  return <DiffTextContent {...{ line, tokens, span, wrapClass }} />
}
function DiffTextContent({
  line,
  tokens,
  span,
  wrapClass
}: {
  line: DiffLine
  tokens: readonly import('shiki').ThemedToken[] | undefined
  span: DiffCell['wordSpan']
  wrapClass: string
}): React.JSX.Element {
  if (!span || span.end <= span.start)
    return (
      <pre className={`m-0 ${wrapClass} text-footnote text-ink`}>{syntaxText(line, tokens)}</pre>
    )
  return (
    <pre className={`m-0 ${wrapClass} text-footnote text-ink`}>
      {syntaxText(line, tokens, 0, span.start)}
      <mark
        data-diff-word-change
        className={`rounded-[2px] text-ink ${line.type === 'removed' ? 'bg-[color-mix(in_srgb,var(--color-git-removed)_22%,transparent)]' : 'bg-[color-mix(in_srgb,var(--color-git-added)_22%,transparent)]'}`}
      >
        {syntaxText(line, tokens, span.start, span.end)}
      </mark>
      {syntaxText(line, tokens, span.end)}
    </pre>
  )
}

function InlineBody({
  rows,
  lines,
  filePath,
  wrapClass,
  view,
  requirements,
  draft,
  selection,
  onExpand,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: {
  rows: DiffHunkState['rows']
  lines: readonly DiffLine[]
  filePath: string
  wrapClass: string
  view: DiffViewOptions
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  selection: RequirementSelection
  onExpand: (id: string, direction: GapDirection) => void
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    before?: { old: number | null; new: number | null }
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}): React.JSX.Element {
  const counterparts = useMemo(() => buildCounterparts(lines), [lines])
  return (
    <table data-diff-inline className="w-full border-collapse font-mono text-footnote">
      <colgroup>
        <col className="w-[calc(4ch+16px)]" />
        <col className="w-[12px]" />
        <col />
      </colgroup>
      <tbody>
        {rows.map((row) =>
          row.kind === 'gap' ? (
            <GapRow key={row.id} row={row} colSpan={3} onExpand={onExpand} />
          ) : (
            <InlineLineRow
              key={row.id}
              row={row}
              counterpart={lines[counterparts[row.sourceIndex]] ?? null}
              lines={lines}
              filePath={filePath}
              wrapClass={wrapClass}
              view={view}
              requirements={requirements}
              draft={draft}
              selection={selection}
              onDraftChange={onDraftChange}
              onAddRequirement={onAddRequirement}
              onRemoveRequirement={onRemoveRequirement}
            />
          )
        )}
      </tbody>
    </table>
  )
}

function InlineLineRow({
  row,
  draftIndex,
  counterpart,
  lines,
  filePath,
  wrapClass,
  view,
  requirements,
  draft,
  selection,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: {
  draftIndex?: number
  counterpart: DiffLine | null
  row: DiffHunkLineRow
  lines: readonly DiffLine[]
  filePath: string
  wrapClass: string
  view: DiffViewOptions
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  selection: RequirementSelection
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    before?: { old: number | null; new: number | null }
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const lineKey = diffRequirementLineKey(filePath, row.line.oldLine, row.line.newLine)
  // 요구사항이 없는 것이 일반적인 상태다 — 그때 줄마다 빈 배열을 만들지 않는다.
  const lineRequirements =
    requirements.length === 0
      ? NO_REQUIREMENTS
      : requirements.filter((item) => diffRequirementMatchesLine(item, filePath, row.line))
  const lineDraft = draft?.key === lineKey && draft.filePath === filePath ? draft : null
  return (
    <Fragment>
      <tr
        data-diff-hunk-row-id={row.id}
        // 익명 `group` 은 상위의 다른 `.group` 까지 매칭돼 형제 줄이 함께 반응한다
        // (`src/renderer/AGENTS.md §그룹 스코프 격리`). 이름을 붙여 이 줄로 가둔다.
        className={`group/diffline ${rowTint(row.line.type)}`}
      >
        <td className="relative select-none pl-[20px] pr-[4px] text-right align-top text-footnote text-ink2">
          <button
            type="button"
            data-diff-requirement-add={lineKey}
            onClick={() =>
              onDraftChange?.({
                key: lineKey,
                filePath,
                oldLine: row.line.oldLine,
                newLine: row.line.newLine,
                body: ''
              })
            }
            aria-label={tr('chat.rightpanel.diffRequirementAddAria', {
              line: lineAxisLabel(row.line)
            })}
            className="absolute left-[4px] top-[2px] flex size-[14px] items-center justify-center rounded-[3px] bg-fill-uncontained-hover text-ink opacity-0 outline-none transition-opacity hide-focus-ring ring-focus group-hover/diffline:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
          >
            <Icon name="plus" size={11} />
          </button>
          <span data-diff-line-number>
            {row.line.type === 'removed' ? row.line.oldLine : row.line.newLine}
          </span>
        </td>
        <td
          className={`select-none text-center align-top text-footnote ${row.line.type === 'added' ? 'text-git-added' : row.line.type === 'removed' ? 'text-git-removed' : 'text-ink3'}`}
        >
          {row.line.type === 'added' ? '+' : row.line.type === 'removed' ? '-' : ' '}
        </td>
        <td className="px-[8px] align-top">
          <LineText
            line={row.line}
            counterpart={counterpart}
            wrapClass={wrapClass}
            highlight={view.highlightWords}
          />
        </td>
      </tr>
      {lineDraft && (
        <DiffRequirementDraftRow
          colSpan={3}
          draft={lineDraft}
          lines={lines}
          lineIndex={draftIndex ?? row.sourceIndex}
          onDraftChange={onDraftChange}
          onAddRequirement={onAddRequirement}
        />
      )}
      {lineRequirements.length > 0 && (
        <DiffRequirementMarkerRow
          colSpan={3}
          items={lineRequirements}
          selection={selection}
          onRemoveRequirement={onRemoveRequirement}
        />
      )}
    </Fragment>
  )
}

/**
 * 나란히 보기 — gap 은 **제자리에** 두고 그 사이의 연속된 줄 묶음만 좌우로 짝짓는다.
 * gap 을 따로 모으면 문맥 컨트롤이 본문과 순서가 어긋나 엉뚱한 자리를 펼친다.
 */
function SideBySideBody({
  rows,
  wrapClass,
  view,
  onExpand,
  filePath,
  requirements,
  selection,
  onRemoveRequirement
}: {
  rows: DiffHunkState['rows']
  wrapClass: string
  view: DiffViewOptions
  onExpand: (id: string, direction: GapDirection) => void
  filePath: string
  requirements: readonly DiffRequirementItem[]
  selection: RequirementSelection
  onRemoveRequirement?: (id: string) => void
}): React.JSX.Element {
  const chunks: Array<
    { kind: 'gap'; row: DiffHunkGapRow } | { kind: 'lines'; rows: DiffHunkLineRow[] }
  > = []
  for (const row of rows) {
    if (row.kind === 'gap') {
      chunks.push({ kind: 'gap', row })
      continue
    }
    const last = chunks[chunks.length - 1]
    if (last?.kind === 'lines') last.rows.push(row)
    else chunks.push({ kind: 'lines', rows: [row] })
  }
  return (
    <table
      data-diff-side-by-side
      className="w-full table-fixed border-collapse font-mono text-footnote"
    >
      <tbody>
        {chunks.map((chunk, chunkIndex) =>
          chunk.kind === 'gap' ? (
            <GapRow key={chunk.row.id} row={chunk.row} colSpan={4} onExpand={onExpand} />
          ) : (
            <Fragment key={`sbs:${chunkIndex}`}>
              {toSideBySideRows(chunk.rows.map((row) => row.line)).map((pair, index) => (
                <Fragment key={`sbs:${chunkIndex}:${index}`}>
                  <tr data-diff-hunk-row-id={chunk.rows[index]?.id}>
                    <td className="w-[3em] select-none px-2 text-right align-top text-footnote text-ink2">
                      {pair.left?.oldLine ?? ''}
                    </td>
                    <td
                      className={`w-1/2 px-2 align-top ${pair.left ? rowTint(pair.left.type) : ''}`}
                    >
                      {pair.left && (
                        <LineText
                          line={pair.left}
                          axis="old"
                          counterpart={pair.right}
                          wrapClass={wrapClass}
                          highlight={view.highlightWords}
                        />
                      )}
                    </td>
                    <td className="w-[3em] select-none px-2 text-right align-top text-footnote text-ink2">
                      {pair.right?.newLine ?? ''}
                    </td>
                    <td
                      className={`w-1/2 px-2 align-top ${pair.right ? rowTint(pair.right.type) : ''}`}
                    >
                      {pair.right && (
                        <LineText
                          line={pair.right}
                          axis="new"
                          counterpart={pair.left}
                          wrapClass={wrapClass}
                          highlight={view.highlightWords}
                        />
                      )}
                    </td>
                  </tr>
                  <DiffRequirementMarkerRow
                    colSpan={4}
                    leadingColumns={1}
                    items={
                      requirements.length === 0
                        ? NO_REQUIREMENTS
                        : requirements.filter(
                            (item) =>
                              (pair.left &&
                                diffRequirementMatchesLine(item, filePath, pair.left)) ||
                              (pair.right && diffRequirementMatchesLine(item, filePath, pair.right))
                          )
                    }
                    selection={selection}
                    onRemoveRequirement={onRemoveRequirement}
                  />
                </Fragment>
              ))}
            </Fragment>
          )
        )}
      </tbody>
    </table>
  )
}

function DiffRequirementDraftRow({
  colSpan,
  draft,
  lines,
  lineIndex,
  onDraftChange,
  onAddRequirement
}: {
  colSpan: number
  draft: DiffRequirementDraft
  lines: readonly DiffLine[]
  lineIndex: number
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    before?: { old: number | null; new: number | null }
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const submission = buildDiffRequirementSubmission(lines, lineIndex, draft.body)
  return (
    <tr data-diff-requirement-draft="true">
      <td colSpan={colSpan - 1} />
      <td className="px-[8px] py-[4px] align-top">
        <div
          data-diff-requirement-draft-box
          className="flex min-h-[82px] flex-col gap-[6px] rounded-[6px] border border-t5 bg-panel px-[16px] py-[12px] focus-within:border-selected"
        >
          <span className="font-sans text-footnote text-ink3">
            {tr('chat.rightpanel.diffRequirementDraftLineLabel', {
              line: lineNumberLabel(lines[lineIndex]!)
            })}
          </span>
          <div className="flex items-center gap-[8px]">
            <textarea
              autoFocus
              value={draft.body}
              onChange={(event) => onDraftChange?.({ ...draft, body: event.currentTarget.value })}
              onKeyDown={(event) => {
                if (shouldCancelDiffRequirementDraft(event.key, event.nativeEvent.isComposing)) {
                  event.preventDefault()
                  onDraftChange?.(null)
                }
              }}
              placeholder={tr('chat.rightpanel.diffRequirementDraftPlaceholder')}
              aria-label={tr('chat.rightpanel.diffRequirementDraftInputAria')}
              data-diff-requirement-draft-input="true"
              className="min-h-[2rem] w-full min-w-0 resize-none overflow-hidden bg-transparent text-footnote text-ink outline-none [field-sizing:content]"
            />
            <button
              type="button"
              disabled={submission === null}
              onClick={() => submission && onAddRequirement?.(submission)}
              aria-label={tr('chat.rightpanel.diffRequirementDraftSubmit')}
              data-diff-requirement-draft-submit
              className="flex size-[20px] shrink-0 items-center justify-center rounded-[4px] text-ink3 outline-none transition-colors hover:bg-selected-soft hover:text-selected focus-visible:bg-selected-soft disabled:hover:bg-transparent disabled:hover:text-ink3"
            >
              <Icon name="commentAdd" size={16} />
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function DiffRequirementMarkerRow({
  colSpan,
  items,
  leadingColumns = colSpan - 1,
  selection,
  onRemoveRequirement
}: {
  colSpan: number
  items: readonly DiffRequirementItem[]
  leadingColumns?: number
  selection: RequirementSelection
  onRemoveRequirement?: (id: string) => void
}): React.JSX.Element | null {
  const { tr } = useI18n()
  if (items.length === 0) return null
  return (
    <tr>
      <td colSpan={leadingColumns} />
      <td colSpan={colSpan - leadingColumns} className="px-[8px] py-[4px] align-top">
        <div className="flex flex-col gap-[8px]">
          {items.map((item) => (
            <div
              key={item.id}
              data-diff-requirement-marker={item.id}
              className={`group/requirement-card relative rounded-[6px] border bg-panel ${item.id === selection.activeRequirementId ? 'border-selected' : 'border-t5'}`}
            >
              <button
                type="button"
                aria-pressed={item.id === selection.activeRequirementId}
                onClick={() => selection.onSelectRequirement?.(item.id)}
                className="flex min-h-[82px] w-full flex-col gap-[6px] rounded-[5px] px-[16px] py-[12px] text-left text-footnote outline-none"
              >
                <span className="font-sans text-ink3">
                  {tr('chat.rightpanel.diffRequirementDraftLineLabel', {
                    line: String(item.anchor.newLine ?? item.anchor.oldLine ?? '?')
                  })}
                </span>
                <span
                  data-diff-requirement-body
                  className="w-full whitespace-pre-wrap break-words pr-[20px] text-ink [overflow-wrap:anywhere]"
                >
                  {item.anchor.comment}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveRequirement?.(item.id)}
                aria-label={tr('chat.composer.diffRequirementRemoveAria', {
                  comment: item.anchor.comment
                })}
                className="absolute right-[12px] top-1/2 flex size-[20px] -translate-y-1/2 items-center justify-center rounded-[4px] text-ink3 opacity-0 outline-none transition-colors group-focus-within/requirement-card:opacity-100 group-hover/requirement-card:opacity-100 hover:text-ink focus-visible:bg-selected-soft"
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}
