import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

/**
 * 한 파일의 섹션 (0211 ΔV4 D-073). 헤더가 곧 목록 행이고 그 아래에 diff 가 이어진다 —
 * 별도 화면으로 가지 않는다. 기본은 펼침이고 헤더의 chevron 이 이 파일만 접는다(D-074).
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
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: FileDiffSectionProps): React.JSX.Element {
  const { tr } = useI18n()
  const { parent, name } = splitPath(section.path)
  return (
    <section data-diff-file={section.path} className="border-b border-t5">
      <button
        type="button"
        data-diff-file-toggle={section.path}
        aria-expanded={!collapsed}
        onClick={() => onToggleCollapsed(section.path)}
        className="group/filehead flex w-full items-start gap-g2 px-p5 py-p3 text-left outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
      >
        <Icon
          name={collapsed ? 'chevR' : 'chevD'}
          size={12}
          className="mt-[2px] shrink-0 text-t5 transition-colors group-hover/filehead:text-t7"
        />
        <Icon name="doc" size={12} className="mt-[2px] shrink-0 text-t5" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-t9">{name}</span>
          {parent.length > 0 && (
            <span className="block truncate font-mono text-caption text-t5">{parent}</span>
          )}
        </span>
        <span className="mt-[2px] flex shrink-0 gap-g1 text-caption tabular-nums">
          <span className="text-git-added">+{section.added}</span>
          <span className="text-git-removed">−{section.removed}</span>
        </span>
      </button>
      {!collapsed &&
        (section.patch === null ? (
          <p className="px-p5 pb-p3 text-caption text-t5">
            {tr('chat.rightpanel.diffNoSessionChange')}
          </p>
        ) : section.patch.kind === 'binary' ? (
          <p className="px-p5 pb-p3 text-caption text-t5">{tr('chat.rightpanel.diffFileBinary')}</p>
        ) : section.patch.kind === 'too-large' ? (
          <p className="px-p5 pb-p3 text-caption text-t5">
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
        <p className="px-p5 pb-p3 text-caption text-t5">{tr('chat.rightpanel.diffEmpty')}</p>
      ) : (
        body
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
      <td colSpan={colSpan} className="px-p5 py-1">
        <span className="flex gap-g2">
          {row.canUp && (
            <button
              type="button"
              data-diff-gap-up={row.id}
              onClick={() => onExpand(row.id, 'up')}
              className="group/gapup flex items-center gap-g2 rounded-r4 px-p2 py-1 text-caption text-accent outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
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
              className="group/gapdown flex items-center gap-g2 rounded-r4 px-p2 py-1 text-caption text-accent outline-none transition-colors hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
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
  if (type === 'added') return 'bg-[color-mix(in_srgb,var(--color-good)_14%,transparent)]'
  if (type === 'removed') return 'bg-[color-mix(in_srgb,var(--color-bad)_14%,transparent)]'
  return ''
}

/** 바뀐 토큰만 덧칠한다. 꺼져 있으면 강조 요소가 **0개**여야 메뉴 항목이 뜻을 갖는다(D-089). */
function LineText({
  line,
  counterpart,
  wrapClass,
  highlight
}: {
  line: DiffLine
  counterpart: DiffLine | null
  wrapClass: string
  highlight: boolean
}): React.JSX.Element {
  const span =
    highlight && counterpart && (line.type === 'added' || line.type === 'removed')
      ? changedWordSpan(
          line.type === 'removed' ? line.text : counterpart.text,
          line.type === 'removed' ? counterpart.text : line.text
        )[line.type === 'removed' ? 'old' : 'new']
      : null
  if (!span || span.end <= span.start)
    return <pre className={`m-0 ${wrapClass} text-code text-t9`}>{line.text}</pre>
  return (
    <pre className={`m-0 ${wrapClass} text-code text-t9`}>
      {line.text.slice(0, span.start)}
      <mark
        data-diff-word-change
        className="rounded-[2px] bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] text-t9"
      >
        {line.text.slice(span.start, span.end)}
      </mark>
      {line.text.slice(span.end)}
    </pre>
  )
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
    <table className="w-full border-collapse font-mono">
      <tbody>
        {rows.map((row) =>
          row.kind === 'gap' ? (
            <GapRow key={row.id} row={row} colSpan={5} onExpand={onExpand} />
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
        <td className="select-none px-2 text-right text-code text-t5">
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
            className="rounded-r4 px-1 text-accent opacity-0 outline-none transition-opacity hide-focus-ring ring-focus group-hover/diffline:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
          >
            <Icon name="plus" size={11} />
          </button>
        </td>
        <td className="select-none px-2 text-right text-code text-t5">{row.line.oldLine ?? ''}</td>
        <td className="select-none px-2 text-right text-code text-t5">{row.line.newLine ?? ''}</td>
        <td className="select-none px-1 text-center text-code text-t6">
          {row.line.type === 'added' ? '+' : row.line.type === 'removed' ? '-' : ' '}
        </td>
        <td className="px-2">
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
          colSpan={5}
          draft={lineDraft}
          lines={lines}
          lineIndex={row.sourceIndex}
          onDraftChange={onDraftChange}
          onAddRequirement={onAddRequirement}
        />
      )}
      <DiffRequirementMarkerRow
        colSpan={5}
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
    <table data-diff-side-by-side className="w-full table-fixed border-collapse font-mono">
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
                  <td className="w-[3em] select-none px-2 text-right text-code text-t5">
                    {pair.left?.oldLine ?? ''}
                  </td>
                  <td
                    className={`w-1/2 px-2 align-top ${pair.left ? rowTint(pair.left.type) : ''}`}
                  >
                    {pair.left && (
                      <LineText
                        line={pair.left}
                        counterpart={pair.right}
                        wrapClass={wrapClass}
                        highlight={view.highlightWords}
                      />
                    )}
                  </td>
                  <td className="w-[3em] select-none px-2 text-right text-code text-t5">
                    {pair.right?.newLine ?? ''}
                  </td>
                  <td
                    className={`w-1/2 px-2 align-top ${pair.right ? rowTint(pair.right.type) : ''}`}
                  >
                    {pair.right && (
                      <LineText
                        line={pair.right}
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
  return (
    <tr data-diff-requirement-draft="true">
      <td colSpan={colSpan} className="px-p5 py-2">
        <div className="flex flex-col gap-g2 rounded-r4 border border-accent bg-fill-contained p-2">
          <textarea
            value={draft.body}
            onChange={(event) => onDraftChange?.({ ...draft, body: event.currentTarget.value })}
            placeholder={tr('chat.rightpanel.diffRequirementDraftPlaceholder')}
            aria-label={tr('chat.rightpanel.diffRequirementDraftInputAria')}
            data-diff-requirement-draft-input="true"
            className="min-h-[3rem] resize-y rounded-r3 border border-t5 bg-panel px-2 py-1 text-body text-t9 outline-none hide-focus-ring ring-focus"
          />
          <span className="flex justify-end gap-g2">
            <button
              type="button"
              onClick={() => onDraftChange?.(null)}
              className="text-caption text-t6 outline-none hide-focus-ring ring-focus"
            >
              {tr('chat.rightpanel.diffRequirementDraftCancel')}
            </button>
            <button
              type="button"
              disabled={draft.body.trim() === ''}
              onClick={() => onAddRequirement?.({ lines, lineIndex, comment: draft.body })}
              className="text-caption text-accent outline-none hide-focus-ring ring-focus disabled:text-t5"
            >
              {tr('chat.rightpanel.diffRequirementDraftSubmit')}
            </button>
          </span>
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
      <td colSpan={colSpan} className="px-p5 pb-2">
        <div className="flex flex-wrap gap-g2">
          {items.map((item) => (
            <span
              key={item.id}
              data-diff-requirement-marker={item.id}
              className="inline-flex min-w-0 max-w-full items-center gap-g2 rounded-r4 border border-accent bg-fill-contained px-p3 py-1 text-caption"
            >
              <span className="shrink-0 text-accent">
                {tr('chat.rightpanel.diffRequirementMarkerLabel')}
              </span>
              <span className="min-w-0 truncate text-t7">{item.anchor.comment}</span>
              <button
                type="button"
                onClick={() => onRemoveRequirement?.(item.id)}
                aria-label={tr('chat.composer.diffRequirementRemoveAria', {
                  comment: item.anchor.comment
                })}
                className="shrink-0 rounded-r4 text-t5 outline-none transition-colors hide-focus-ring ring-focus hover:text-t7"
              >
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
        </div>
      </td>
    </tr>
  )
}
