import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  DiffRequirementItem,
  GitDiffFileContent,
  GitDiffSummary
} from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'
import {
  buildDiffHunks,
  expandGap,
  type DiffHunkLineRow,
  type DiffHunkState
} from '../../lib/diffHunks'
import { buildDiffLines, type DiffLine } from '../../lib/diffLines'
import type { DiffRequirementDraft, GitPeekTarget } from '../../reducer/chatReducer'
import type { DiffPeekBodyState } from './diffFileCache'
import { diffRequirementLineKey } from './diffRequirements'
import { peekNavigation } from './peekNavigation'
import { summaryBaseLabel } from './sessionChangesData'

export interface DiffPeekProps {
  summary: GitDiffSummary
  target: GitPeekTarget
  currentBody: DiffPeekBodyState | null
  requirements?: readonly DiffRequirementItem[]
  draft?: DiffRequirementDraft | null
  onBack: () => void
  onNavigate: (target: GitPeekTarget) => void
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}

interface PendingScrollCompensation {
  anchorId: string
  top: number
  insertedAbove: number
}

interface DiffPeekBodyProps {
  filePath: string
  content: GitDiffFileContent | null
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}

function initialHunks(content: GitDiffFileContent | null): DiffHunkState {
  return content?.kind === 'text'
    ? buildDiffHunks(buildDiffLines(content.oldValue, content.newValue), 3)
    : buildDiffHunks([], 3)
}

function lineAxisLabel(line: DiffLine): string {
  if (line.oldLine === null && line.newLine !== null) return `+${line.newLine}`
  if (line.newLine === null && line.oldLine !== null) return `-${line.oldLine}`
  return String(line.newLine ?? line.oldLine ?? '?')
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
              onClick={() =>
                onAddRequirement?.({
                  lines,
                  lineIndex,
                  comment: draft.body
                })
              }
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
              className="inline-flex min-w-0 max-w-full items-center gap-g2 rounded-r3 border border-accent bg-fill-contained px-p3 py-1 text-caption"
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
                className="shrink-0 text-t5 outline-none hide-focus-ring ring-focus"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </td>
    </tr>
  )
}

function DiffLineRow({
  row,
  filePath,
  requirements,
  draft,
  lines,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: {
  row: DiffHunkLineRow
  filePath: string
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  lines: readonly DiffLine[]
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}): React.JSX.Element {
  const isAdded = row.line.type === 'added'
  const isRemoved = row.line.type === 'removed'
  const lineKey = diffRequirementLineKey(filePath, row.line.oldLine, row.line.newLine)
  const lineRequirements = requirements.filter(
    (item) =>
      item.located &&
      item.anchor.filePath === filePath &&
      item.anchor.oldLine === row.line.oldLine &&
      item.anchor.newLine === row.line.newLine
  )
  const lineDraft = draft?.key === lineKey && draft.filePath === filePath ? draft : null
  const { tr } = useI18n()
  return (
    <Fragment>
      <tr
        data-diff-hunk-row-id={row.id}
        className={
          isAdded
            ? 'bg-[color-mix(in_srgb,var(--color-good)_14%,transparent)]'
            : isRemoved
              ? 'bg-[color-mix(in_srgb,var(--color-bad)_14%,transparent)]'
              : ''
        }
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
            className="rounded-r3 px-1 text-caption text-accent outline-none hide-focus-ring ring-focus"
          >
            +
          </button>
        </td>
        <td className="select-none px-2 text-right text-code text-t5">{row.line.oldLine ?? ''}</td>
        <td className="select-none px-2 text-right text-code text-t5">{row.line.newLine ?? ''}</td>
        <td className="select-none px-1 text-center text-code text-t6">
          {isAdded ? '+' : isRemoved ? '-' : ' '}
        </td>
        <td className="px-2">
          <pre className="m-0 whitespace-pre-wrap break-all text-code text-t9">{row.line.text}</pre>
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

/** Diff body state is keyed by request identity; body changes remount instead of syncing state in an effect. */
function DiffPeekBody({
  filePath,
  content,
  requirements,
  draft,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: DiffPeekBodyProps): React.JSX.Element {
  const { tr } = useI18n()
  const [visibleHunks, setVisibleHunks] = useState(() => initialHunks(content))
  const scrollOwnerRef = useRef<HTMLDivElement>(null)
  const pendingCompensationRef = useRef<PendingScrollCompensation | null>(null)

  useLayoutEffect(() => {
    const pending = pendingCompensationRef.current
    const owner = scrollOwnerRef.current
    if (!pending || !owner) return
    const anchor = owner.querySelector<HTMLElement>(`[data-diff-hunk-row-id="${pending.anchorId}"]`)
    if (anchor && pending.insertedAbove > 0)
      owner.scrollTop += anchor.getBoundingClientRect().top - pending.top
    pendingCompensationRef.current = null
  }, [visibleHunks])

  const expand = useCallback(
    (id: string) => {
      const rowIndex = visibleHunks.rows.findIndex((row) => row.kind === 'gap' && row.id === id)
      const successor =
        rowIndex >= 0
          ? visibleHunks.rows.slice(rowIndex + 1).find((row) => row.kind === 'line')
          : undefined
      const owner = scrollOwnerRef.current
      const anchor =
        successor && owner?.querySelector<HTMLElement>(`[data-diff-hunk-row-id="${successor.id}"]`)
      const result = expandGap(visibleHunks, id, 5)
      if (anchor && result.insertedAbove > 0) {
        pendingCompensationRef.current = {
          anchorId: successor!.id,
          top: anchor.getBoundingClientRect().top,
          insertedAbove: result.insertedAbove
        }
      }
      setVisibleHunks(result.state)
    },
    [visibleHunks]
  )

  return (
    <div ref={scrollOwnerRef} data-diff-peek-scroll-owner className="min-h-0 flex-1 overflow-auto">
      {content === null ? (
        <p className="px-p5 py-3 text-caption text-t5">{tr('chat.rightpanel.diffFileLoading')}</p>
      ) : content.kind === 'text' ? (
        <table className="w-full border-collapse font-mono">
          <tbody>
            {visibleHunks.rows.map((row) =>
              row.kind === 'line' ? (
                <DiffLineRow
                  key={row.id}
                  row={row}
                  filePath={filePath}
                  requirements={requirements}
                  draft={draft}
                  lines={visibleHunks.lines}
                  onDraftChange={onDraftChange}
                  onAddRequirement={onAddRequirement}
                  onRemoveRequirement={onRemoveRequirement}
                />
              ) : (
                <tr key={row.id} data-diff-gap={row.id}>
                  <td colSpan={5} className="px-p5 py-2">
                    <button
                      type="button"
                      onClick={() => expand(row.id)}
                      className="text-caption text-accent outline-none hide-focus-ring ring-focus"
                    >
                      {tr('chat.rightpanel.diffExpandGap', {
                        count: Math.min(5, row.end - row.start)
                      })}
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      ) : (
        <p className="px-p5 py-3 text-caption text-t5">
          {tr(
            content.kind === 'binary'
              ? 'chat.rightpanel.diffFileBinary'
              : content.reason === 'too-large'
                ? 'chat.rightpanel.diffFileTooLarge'
                : 'chat.rightpanel.diffFileUnavailable'
          )}
        </p>
      )}
    </div>
  )
}

/** 두 번째 화면. scroll owner/ref와 DOM 위치 보정은 의도적으로 body child 한 곳에만 둔다. */
export function DiffPeek({
  summary,
  target,
  currentBody,
  requirements = [],
  draft = null,
  onBack,
  onNavigate,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: DiffPeekProps): React.JSX.Element {
  const { tr } = useI18n()
  const content = currentBody?.content ?? null
  const bodyIdentity = currentBody ? `${currentBody.key}:${currentBody.generation}` : 'loading'
  const navigation = useMemo(() => peekNavigation(summary, target), [summary, target])

  return (
    <div data-session-changes-screen="peek" className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-g3 border-b border-t5 px-p5 py-2">
        <button
          type="button"
          onClick={onBack}
          className="text-body text-accent outline-none hide-focus-ring ring-focus"
        >
          ← {tr('header.back')}
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-body text-t9">{target.path}</span>
        <span className="shrink-0 text-caption text-t5">
          {tr('chat.rightpanel.diffPeekPosition', {
            index: navigation.index,
            total: navigation.total
          })}
        </span>
      </header>
      <div className="flex shrink-0 flex-wrap items-center gap-g2 border-b border-t5 px-p5 py-1 text-caption text-t6">
        <span>
          {tr('chat.rightpanel.diffBaselineCurrent', { base: summaryBaseLabel(summary) })}
        </span>
        {target.group.kind === 'uncommitted' && (
          <span>{tr('chat.rightpanel.diffIncludesUncommitted')}</span>
        )}
      </div>
      <div className="flex shrink-0 justify-between gap-g3 border-b border-t5 px-p5 py-1">
        <button
          type="button"
          disabled={!navigation.previous}
          onClick={() => navigation.previous && onNavigate(navigation.previous)}
          className="text-caption text-accent disabled:text-t5"
        >
          {tr('chat.rightpanel.diffPreviousFile')}
        </button>
        <button
          type="button"
          disabled={!navigation.next}
          onClick={() => navigation.next && onNavigate(navigation.next)}
          className="text-caption text-accent disabled:text-t5"
        >
          {tr('chat.rightpanel.diffNextFile')}
        </button>
      </div>
      <DiffPeekBody
        key={bodyIdentity}
        filePath={target.path}
        content={content}
        requirements={requirements}
        draft={draft}
        onDraftChange={onDraftChange}
        onAddRequirement={onAddRequirement}
        onRemoveRequirement={onRemoveRequirement}
      />
    </div>
  )
}
