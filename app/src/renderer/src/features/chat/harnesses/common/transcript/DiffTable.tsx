import { useDiffAxes, type DiffAxes } from '../../../hooks/useDiffAxes'
import { DiffLinesStatus } from './DiffLinesStatus'
import { useEffect, useId, useMemo, useRef } from 'react'
import { type ThemedToken } from 'shiki'
import { useDiffViewWindow } from '../../../hooks/useDiffViewWindow'
import { useWindowTokens } from '../../../hooks/useWindowTokens'
import { extToLang } from '../../../lib/lang'
import {
  buildDiffView,
  type DiffModel,
  type DiffCell
} from '../../../../../shared/compute/diffView'
import {
  packLines,
  type DiffOptions,
  type DiffSourceRef
} from '../../../../../shared/compute/diffSource'
import { useComputeDocument } from '../../../../../shared/compute/useComputeDocument'
import {
  DIFF_MODEL_SYNC_MAX_LINES,
  DIFF_MODEL_SYNC_MAX_CHARS,
  TOKENS_RANGE_MAX_LINES
} from '../../../../../shared/compute/limits'
import { useVirtualRows } from '../../../../../shared/ui/virtual/useVirtualRows'
import {
  VIRTUAL_BODY_MIN_LINES,
  VIRTUAL_BODY_MAX_HEIGHT_CLASS
} from '../../../../../shared/ui/virtual/limits'
import { useSmallDiffSyntax } from '../../../hooks/useSmallDiffSyntax'
import type { DiffLine } from '../../../lib/diffLines'
import { syntaxText } from './diffSyntaxText'

export interface DiffTableAppearance {
  table: string
  addedRow: string
  removedRow: string
  addedGutter: string
  removedGutter: string
  muted: string
  text: string
}
const defaultAppearance: DiffTableAppearance = {
  table: '',
  addedRow: 'bg-[color-mix(in_srgb,var(--color-good)_14%,transparent)]',
  removedRow: 'bg-[color-mix(in_srgb,var(--color-bad)_14%,transparent)]',
  addedGutter: 'bg-[color-mix(in_srgb,var(--color-good)_18%,transparent)]',
  removedGutter: 'bg-[color-mix(in_srgb,var(--color-bad)_18%,transparent)]',
  muted: 'text-t6',
  text: 'text-t9'
}

// diff 줄 묶음의 렌더 — **props 만 읽는다**(0206 D-019). 줄 파생은 `lib/diffLines`(입력 쌍)와
// `lib/diffPatchLines`(구조화 패치)가 소유하고 여기는 그 결과를 그리기만 한다.
//
// 3열이 계약이다: 줄번호(3em) · `+`/`-` 거터(1.4em) · 본문. 앞 둘은 `select-none` 이라
// 사용자가 diff 를 복사하면 본문만 딸려 온다.
//
// `filePath` 를 주면 변경사항 패널과 같은 경로로 문법 색을 얹는다(0228 D-011). 확장자가
// 미지원이거나 하이라이터가 아직 없으면 토큰 맵이 비어 원문 그대로 그린다 — 훅 순서가
// 분기하지 않도록 호출 자체는 무조건 한다.
function PlainDiffTable({
  lines,
  filePath,
  appearance = defaultAppearance
}: {
  lines: readonly DiffLine[]
  filePath?: string
  appearance?: DiffTableAppearance
}): React.JSX.Element {
  const tokens = useSmallDiffSyntax(lines, filePath ?? '')

  return (
    <table
      className={`w-full border-collapse font-mono ${appearance.table}`}
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
    >
      <colgroup>
        <col style={{ width: '3em' }} />
        <col style={{ width: '1.4em' }} />
        <col />
      </colgroup>
      <tbody>
        {lines.map((line, i) => {
          return (
            <DiffTableRow
              key={i}
              line={line}
              appearance={appearance}
              tokens={tokens.get(line)?.[line.type === 'removed' ? 'old' : 'new']}
            />
          )
        })}
      </tbody>
    </table>
  )
}

function DiffTableRow({
  line,
  appearance,
  tokens,
  measure,
  index
}: {
  line: DiffLine
  appearance: DiffTableAppearance
  tokens?: readonly ThemedToken[]
  measure?: (node: Element | null) => void
  index?: number
}): React.JSX.Element {
  const isAdded = line.type === 'added'
  const isRemoved = line.type === 'removed'
  const rowBg = isAdded ? appearance.addedRow : isRemoved ? appearance.removedRow : ''
  const gutterBg = isAdded
    ? appearance.addedGutter
    : isRemoved
      ? appearance.removedGutter
      : 'bg-transparent'
  return (
    <tr ref={measure} data-index={index} className={rowBg}>
      <td
        className={`select-none whitespace-nowrap px-2 text-right align-baseline tabular-nums ${gutterBg}`}
      >
        <pre className={`m-0 text-code opacity-60 ${appearance.muted}`}>{line.lineNo}</pre>
      </td>
      <td className={`select-none px-1 text-center align-baseline ${gutterBg}`}>
        <pre className={`m-0 text-code ${appearance.muted}`}>
          {isAdded ? '+' : isRemoved ? '-' : ' '}
        </pre>
      </td>
      <td className="px-2 align-baseline">
        <pre className={`m-0 whitespace-pre-wrap break-all text-code ${appearance.text}`}>
          {syntaxText(line, tokens)}
        </pre>
      </td>
    </tr>
  )
}

const options: DiffOptions = {
  layout: 'inline',
  ignoreWhitespace: false,
  highlightWords: false,
  expansions: [[0, Number.MAX_SAFE_INTEGER]]
}
function AxisRow({
  cell,
  source,
  axes,
  lang,
  ready,
  appearance,
  priority,
  measure,
  index
}: {
  cell: DiffCell
  axes?: DiffAxes | null
  source: DiffSourceRef
  lang?: string
  ready: boolean
  priority: import('../../../../../shared/compute/client').Priority
  appearance: DiffTableAppearance
  measure: (el: Element | null) => void
  index: number
}): React.JSX.Element {
  const old = cell.line.type === 'removed'
  const axis = useMemo(
    () =>
      axes
        ? { doc: axes[old ? 'old' : 'new'] }
        : source.kind === 'pair'
          ? { doc: old ? source.old : source.new }
          : {
              axis: {
                source,
                axis: old ? ('old' as const) : ('new' as const),
                ignoreWhitespace: false
              }
            },
    [source, old, axes]
  )
  const pos = old ? cell.oldAxis : cell.newAxis
  const start = Math.floor(pos / TOKENS_RANGE_MAX_LINES) * TOKENS_RANGE_MAX_LINES
  const tokenRows = useWindowTokens(axis, lang, start, priority, axes?.ready ?? ready)
  const parts = tokenRows?.[pos - start]
  return (
    <DiffTableRow
      line={cell.line}
      appearance={appearance}
      tokens={parts?.map((t) => t.content).join('') === cell.line.text ? parts : undefined}
      index={index}
      measure={measure}
    />
  )
}
type Props = Parameters<typeof PlainDiffTable>[0]
function VirtualDiffTable({
  lines,
  filePath,
  appearance = defaultAppearance
}: Props): React.JSX.Element {
  const id = useId()
  const packed = useMemo(() => packLines(lines), [lines])
  const doc = useComputeDocument(id, packed.text, 'compute', lines, packed.lines)
  const source = useMemo<DiffSourceRef>(() => ({ kind: 'lines', doc: doc.ref }), [doc.ref])
  const model = useMemo(
    () =>
      lines.length <= DIFF_MODEL_SYNC_MAX_LINES && packed.text.length <= DIFF_MODEL_SYNC_MAX_CHARS
        ? buildDiffView(lines, false)
        : null,
    [lines, packed]
  )
  return (
    <DiffWindowTable
      source={source}
      model={model}
      ready={doc.ready}
      lines={lines}
      count={lines.length}
      filePath={filePath}
      appearance={appearance}
    />
  )
}

function DiffWindowTable({
  source,
  model,
  ready,
  lines,
  count,
  filePath,
  appearance = defaultAppearance
}: Omit<Props, 'lines'> & {
  source: DiffSourceRef
  model: DiffModel | null
  ready: boolean
  lines?: Props['lines']
  count: number
}): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null),
    owner = useRef<HTMLDivElement>(null)
  const axes = useDiffAxes(model)
  const small = count <= VIRTUAL_BODY_MIN_LINES
  const list = useVirtualRows(count, root, owner, small ? 'all' : undefined)
  const items = list.getVirtualItems()
  const start = items[0]?.index ?? 0,
    end = (items.at(-1)?.index ?? -1) + 1
  const window = useDiffViewWindow(source, options, model, start, end, ready)
  return (
    <div
      ref={owner}
      tabIndex={0}
      className={
        small ? undefined : VIRTUAL_BODY_MAX_HEIGHT_CLASS + ' overflow-auto overscroll-contain'
      }
    >
      <div
        ref={root}
        data-virtual-diff=""
        style={{ height: list.getTotalSize(), position: 'relative' }}
      >
        <table
          className={'absolute w-full border-collapse font-mono ' + appearance.table}
          style={{
            top: (items[0]?.start ?? 0) - list.options.scrollMargin,
            userSelect: 'text',
            tableLayout: 'fixed'
          }}
        >
          <colgroup>
            <col style={{ width: '3em' }} />
            <col style={{ width: '1.4em' }} />
            <col />
          </colgroup>
          <tbody>
            {items.map(({ index }) => {
              const row = window?.rows[index - start]
              return row?.kind === 'line' ? (
                <AxisRow
                  key={index}
                  axes={axes}
                  cell={row}
                  priority={
                    list.range && index >= list.range.startIndex && index <= list.range.endIndex
                      ? 'visible'
                      : 'background'
                  }
                  source={source}
                  lang={extToLang(filePath ?? '')}
                  ready={ready}
                  appearance={appearance}
                  index={index}
                  measure={list.measureElement}
                />
              ) : lines ? (
                <DiffTableRow
                  key={index}
                  line={lines[index]}
                  appearance={appearance}
                  index={index}
                  measure={list.measureElement}
                />
              ) : null
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type RemoteProps = Omit<Props, 'lines'> & {
  fallback: React.ReactNode
  onSummary?: (summary: { added: number; removed: number }) => void
}
function RemoteTable({
  source,
  ready,
  unavailable,
  ...props
}: RemoteProps & {
  source: DiffSourceRef
  ready: boolean
  unavailable: boolean
}): React.JSX.Element {
  const initial = useDiffViewWindow(source, options, null, 0, 1, ready)
  useEffect(() => {
    if (initial) props.onSummary?.(initial.summary)
  }, [initial, props.onSummary])
  if (unavailable || initial === null) return <>{props.fallback}</>
  if (!initial) return <DiffLinesStatus />
  if (!initial.summary.rowCount) return <>{props.fallback}</>
  return (
    <DiffWindowTable
      {...props}
      model={null}
      ready={ready}
      source={source}
      count={initial.summary.rowCount}
    />
  )
}
export function StructuredDiffTable({
  lines,
  ...props
}: RemoteProps & { lines: Parameters<typeof packLines>[0] }): React.JSX.Element {
  const packed = useMemo(() => packLines(lines), [lines])
  const doc = useComputeDocument(useId(), packed.text, 'compute', lines, packed.lines)
  const source = useMemo<DiffSourceRef>(() => ({ kind: 'lines', doc: doc.ref }), [doc.ref])
  return <RemoteTable {...props} source={source} ready={doc.ready} unavailable={doc.unavailable} />
}
export function PairDiffTable({
  before,
  after,
  ...props
}: RemoteProps & { before: string; after: string }): React.JSX.Element {
  const old = useComputeDocument(useId(), before, 'compute')
  const next = useComputeDocument(useId(), after, 'compute')
  const source = useMemo<DiffSourceRef>(
    () => ({ kind: 'pair', old: old.ref, new: next.ref }),
    [old.ref, next.ref]
  )
  return (
    <RemoteTable
      {...props}
      source={source}
      ready={old.ready && next.ready}
      unavailable={old.unavailable || next.unavailable}
    />
  )
}
export function PatchDiffTable({
  patch,
  ...props
}: RemoteProps & { patch: string }): React.JSX.Element {
  const doc = useComputeDocument(useId(), patch, 'compute')
  const source = useMemo<DiffSourceRef>(() => ({ kind: 'patch', doc: doc.ref }), [doc.ref])
  return <RemoteTable {...props} source={source} ready={doc.ready} unavailable={doc.unavailable} />
}
export function DiffTable(props: Props): React.JSX.Element {
  return props.lines.length > VIRTUAL_BODY_MIN_LINES ? (
    <VirtualDiffTable {...props} />
  ) : (
    <PlainDiffTable {...props} />
  )
}
