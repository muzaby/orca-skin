import {
  Fragment,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { ThemedToken } from 'shiki'
import type { DiffRequirementItem, GitDiffPatchLine } from '../../../../../../shared/ipc'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import {
  buildDiffHunks,
  expandGap,
  type DiffHunkGapRow,
  type DiffHunkLineRow,
  type DiffHunkState,
  type GapDirection
} from '../../lib/diffHunks'
import {
  changedWordSpan,
  collapseWhitespaceOnlyChanges,
  toSideBySideRows
} from '../../lib/diffDisplay'
import { patchLinesToDiffLines } from '../../lib/diffPatchLines'
import { planUpwardExpansionCompensation } from '../../lib/diffViewport'
import type { DiffLine } from '../../lib/diffLines'
import { DiffSyntaxContext, useDiffSyntax } from '../../hooks/useDiffSyntax'
import type { DiffRequirementDraft, DiffViewOptions } from '../../reducer/chatReducer'
import { diffRequirementLineKey } from './diffRequirements'
import type { DiffSection } from './diffComparison'

/** 문맥을 한 번에 여는 폭. 남은 줄이 이보다 적으면 gap 자체가 사라진다(0211 ΔV4 D-090). */
export const CONTEXT_EXPAND_STEP = 20
/** 처음 보여줄 변경 주변 문맥. */
const INITIAL_CONTEXT = 3

export interface FileDiffSectionProps {
  section: DiffSection
  collapsed: boolean
  view: DiffViewOptions
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  scrollOwnerRef: React.RefObject<HTMLDivElement | null>
  tailSpacerRef: React.RefObject<HTMLDivElement | null>
  onToggleCollapsed: (path: string) => void
  /** `↗` — 그 파일을 OS 탐색기에서 선택해 연다 (0211 ΔV5 D-108). */
  onOpenFile: (path: string) => void
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
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

function lineAxisLabel(line: DiffLine): string {
  if (line.oldLine === null && line.newLine !== null) return `+${line.newLine}`
  if (line.newLine === null && line.oldLine !== null) return `-${line.oldLine}`
  return String(line.newLine ?? line.oldLine ?? '?')
}

function lineNumberLabel(line: DiffLine): string {
  return String(line.newLine ?? line.oldLine ?? '?')
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
  return (
    <section data-diff-file={section.path} className="relative min-w-0">
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
          <Icon name="arrowNE" size={12} />
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
        ) : (
          <FileDiffBody
            key={`${section.path}:${view.ignoreWhitespace}`}
            filePath={section.path}
            lines={section.patch.lines}
            view={view}
            requirements={requirements}
            draft={draft}
            scrollOwnerRef={scrollOwnerRef}
            tailSpacerRef={tailSpacerRef}
            onDraftChange={onDraftChange}
            onAddRequirement={onAddRequirement}
            onRemoveRequirement={onRemoveRequirement}
          />
        ))}
    </section>
  )
}

interface PendingCompensation {
  anchorId: string
  top: number
  insertedAbove: number
}

function FileDiffBody({
  filePath,
  lines,
  view,
  requirements,
  draft,
  scrollOwnerRef,
  tailSpacerRef,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: {
  filePath: string
  lines: readonly GitDiffPatchLine[]
  view: DiffViewOptions
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  scrollOwnerRef: React.RefObject<HTMLDivElement | null>
  tailSpacerRef: React.RefObject<HTMLDivElement | null>
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
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
  const [hunks, setHunks] = useState<DiffHunkState>(() =>
    buildDiffHunks(diffLines, INITIAL_CONTEXT)
  )
  const syntax = useDiffSyntax(diffLines, filePath)
  const pending = useRef<PendingCompensation | null>(null)

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

  const wrapClass = view.wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
  const body =
    view.layout === 'side-by-side' ? (
      <SideBySideBody rows={hunks.rows} wrapClass={wrapClass} view={view} onExpand={expand} />
    ) : (
      <InlineBody
        rows={hunks.rows}
        lines={hunks.lines}
        filePath={filePath}
        wrapClass={wrapClass}
        view={view}
        requirements={requirements}
        draft={draft}
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
  const tokens = useContext(DiffSyntaxContext).get(line)?.[axis]
  const span =
    highlight && counterpart && (line.type === 'added' || line.type === 'removed')
      ? changedWordSpan(
          line.type === 'removed' ? line.text : counterpart.text,
          line.type === 'removed' ? counterpart.text : line.text
        )[line.type === 'removed' ? 'old' : 'new']
      : null
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

/** 변경 강조가 문법 토큰 중간을 잘라도 원문과 각 토큰 색은 그대로 보존한다. */
function syntaxText(
  line: DiffLine,
  tokens: readonly ThemedToken[] | undefined,
  start = 0,
  end = line.text.length
): React.ReactNode {
  if (!tokens) return line.text.slice(start, end)
  let offset = 0
  return tokens.map((token, index) => {
    const tokenStart = offset
    offset += token.content.length
    const text = token.content.slice(Math.max(0, start - tokenStart), Math.max(0, end - tokenStart))
    return text.length > 0 ? (
      <span key={index} style={{ color: token.color }}>
        {text}
      </span>
    ) : null
  })
}

/** 연속된 removed/added 묶음에서 k 번째끼리 짝지어 단어 강조의 상대를 찾는다. */
function counterpartOf(lines: readonly DiffLine[], sourceIndex: number): DiffLine | null {
  const line = lines[sourceIndex]
  if (!line || line.type === 'unchanged') return null
  if (line.type === 'removed') {
    let start = sourceIndex
    while (start > 0 && lines[start - 1]?.type === 'removed') start -= 1
    let end = sourceIndex
    while (end + 1 < lines.length && lines[end + 1]?.type === 'removed') end += 1
    const offset = sourceIndex - start
    const candidate = lines[end + 1 + offset]
    return candidate?.type === 'added' && lines[end + 1]?.type === 'added' ? candidate : null
  }
  let start = sourceIndex
  while (start > 0 && lines[start - 1]?.type === 'added') start -= 1
  const offset = sourceIndex - start
  const removedEnd = start - 1
  if (lines[removedEnd]?.type !== 'removed') return null
  let removedStart = removedEnd
  while (removedStart > 0 && lines[removedStart - 1]?.type === 'removed') removedStart -= 1
  const candidate = lines[removedStart + offset]
  return candidate?.type === 'removed' ? candidate : null
}

function InlineBody({
  rows,
  lines,
  filePath,
  wrapClass,
  view,
  requirements,
  draft,
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
  onExpand: (id: string, direction: GapDirection) => void
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}): React.JSX.Element {
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
              lines={lines}
              filePath={filePath}
              wrapClass={wrapClass}
              view={view}
              requirements={requirements}
              draft={draft}
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
  lines,
  filePath,
  wrapClass,
  view,
  requirements,
  draft,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: {
  row: DiffHunkLineRow
  lines: readonly DiffLine[]
  filePath: string
  wrapClass: string
  view: DiffViewOptions
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const lineKey = diffRequirementLineKey(filePath, row.line.oldLine, row.line.newLine)
  const lineRequirements = requirements.filter(
    (item) =>
      item.located &&
      item.anchor.filePath === filePath &&
      item.anchor.oldLine === row.line.oldLine &&
      item.anchor.newLine === row.line.newLine
  )
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
            counterpart={counterpartOf(lines, row.sourceIndex)}
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
          lineIndex={row.sourceIndex}
          onDraftChange={onDraftChange}
          onAddRequirement={onAddRequirement}
        />
      )}
      <DiffRequirementMarkerRow
        colSpan={3}
        items={lineRequirements}
        onRemoveRequirement={onRemoveRequirement}
      />
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
  onExpand
}: {
  rows: DiffHunkState['rows']
  wrapClass: string
  view: DiffViewOptions
  onExpand: (id: string, direction: GapDirection) => void
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
                <tr
                  key={`sbs:${chunkIndex}:${index}`}
                  data-diff-hunk-row-id={chunk.rows[index]?.id}
                >
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
              className="flex size-[20px] shrink-0 items-center justify-center rounded-[4px] text-ink3 outline-none hover:bg-selected-soft hover:text-selected focus-visible:bg-selected-soft disabled:hover:bg-transparent disabled:hover:text-ink3"
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
  onRemoveRequirement
}: {
  colSpan: number
  items: readonly DiffRequirementItem[]
  onRemoveRequirement?: (id: string) => void
}): React.JSX.Element | null {
  const { tr } = useI18n()
  if (items.length === 0) return null
  return (
    <tr>
      <td colSpan={colSpan - 1} />
      <td className="px-[8px] py-[4px] align-top">
        <div className="flex flex-col gap-[8px]">
          {items.map((item) => (
            <div
              key={item.id}
              data-diff-requirement-marker={item.id}
              className="group/requirement-card relative rounded-[6px] border border-t5 bg-panel focus-within:border-selected"
            >
              <button
                type="button"
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
                className="absolute right-[12px] top-1/2 flex size-[20px] -translate-y-1/2 items-center justify-center rounded-[4px] text-ink3 opacity-0 outline-none group-focus-within/requirement-card:opacity-100 group-hover/requirement-card:opacity-100 hover:text-ink focus-visible:bg-selected-soft"
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
