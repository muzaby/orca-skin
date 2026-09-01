import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GitDiffFileContent, GitDiffSummary } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'
import {
  buildDiffHunks,
  expandGap,
  type DiffHunkLineRow,
  type DiffHunkState
} from '../../lib/diffHunks'
import { buildDiffLines } from '../../lib/diffLines'
import type { GitPeekTarget } from '../../reducer/chatReducer'
import type { DiffPeekBodyState } from './diffFileCache'
import { peekNavigation } from './peekNavigation'
import { summaryBaseLabel } from './sessionChangesData'

export interface DiffPeekProps {
  summary: GitDiffSummary
  target: GitPeekTarget
  currentBody: DiffPeekBodyState | null
  onBack: () => void
  onNavigate: (target: GitPeekTarget) => void
}

interface PendingScrollCompensation {
  anchorId: string
  top: number
  insertedAbove: number
}

interface DiffPeekBodyProps {
  content: GitDiffFileContent | null
}

function initialHunks(content: GitDiffFileContent | null): DiffHunkState {
  return content?.kind === 'text'
    ? buildDiffHunks(buildDiffLines(content.oldValue, content.newValue), 3)
    : buildDiffHunks([], 3)
}

function DiffLineRow({ row }: { row: DiffHunkLineRow }): React.JSX.Element {
  const isAdded = row.line.type === 'added'
  const isRemoved = row.line.type === 'removed'
  return (
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
      <td className="select-none px-2 text-right text-code text-t5">{row.line.oldLine ?? ''}</td>
      <td className="select-none px-2 text-right text-code text-t5">{row.line.newLine ?? ''}</td>
      <td className="select-none px-1 text-center text-code text-t6">
        {isAdded ? '+' : isRemoved ? '-' : ' '}
      </td>
      <td className="px-2">
        <pre className="m-0 whitespace-pre-wrap break-all text-code text-t9">{row.line.text}</pre>
      </td>
    </tr>
  )
}

/** Diff body state is keyed by request identity; body changes remount instead of syncing state in an effect. */
function DiffPeekBody({ content }: DiffPeekBodyProps): React.JSX.Element {
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
                <DiffLineRow key={row.id} row={row} />
              ) : (
                <tr key={row.id} data-diff-gap={row.id}>
                  <td colSpan={4} className="px-p5 py-2">
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
  onBack,
  onNavigate
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
      <DiffPeekBody key={bodyIdentity} content={content} />
    </div>
  )
}
