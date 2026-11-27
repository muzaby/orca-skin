import {
  cloneElement,
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { Element, Root, RootContent, Text } from 'hast'
import { LongParagraphText } from './LongParagraphText'
import { MARKDOWN_COMMIT_MAX_NODES } from '../../compute/limits'
import {
  COMPONENTS,
  COMPONENTS_WITH_SOURCE_PARTS,
  MarkdownPartsContext
} from './markdownComponents'
import { markSourceText, type MarkdownSourcePart } from './sourceParts'

interface MarkdownHastProps {
  hast: Root
  source: string
  parts?: readonly MarkdownSourcePart[]
  onComplete?: () => void
  tableRows?: ReactNode
}

const TableRows = createContext<ReactNode>(null)
function TableBody({ children }: { children?: ReactNode }): React.JSX.Element {
  const rows = useContext(TableRows)
  return (
    <tbody>
      {children}
      {rows}
    </tbody>
  )
}
const withTableRows = { ...COMPONENTS, tbody: TableBody }
const withMarkedTableRows = { ...COMPONENTS_WITH_SOURCE_PARTS, tbody: TableBody }

const tableParents = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr'])

/** Each yield is the next displayable prefix of the same tree. Completed sibling groups
 * retain their React elements and keys when a later frame extends a deeply nested child. */
// eslint-disable-next-line react-refresh/only-export-components -- Pure iterator also supplies the frame-budget oracle.
export function* markdownFrames(
  {
    hast,
    source,
    parts,
    trackParagraph
  }: MarkdownHastProps & {
    trackParagraph?: () => () => void
  },
  limit = MARKDOWN_COMMIT_MAX_NODES,
  milliseconds = 5
): Generator<ReactNode, ReactNode> {
  let remaining = limit
  let deadline = performance.now() + milliseconds
  function* displayText(value: string, bounded: boolean): Generator<ReactNode, ReactNode> {
    if (!bounded || value.length <= 16384) return value
    const runs: ReactNode[] = []
    let offset = 0
    while (offset < value.length) {
      let end = Math.min(offset + 2048, value.length)
      if (end < value.length) {
        const space = value.slice(offset, end).lastIndexOf(' ')
        if (space > 0) end = offset + space + 1
        else if (/[\uD800-\uDBFF]/.test(value[end - 1])) end--
      }
      runs.push(<span key={offset}>{value.slice(offset, end)}</span>)
      offset = end
      if (offset < value.length && runs.length % 4 === 0) yield runs.slice()
    }
    return runs
  }
  function* text(node: Text, parent: string, inPre: boolean): Generator<ReactNode, ReactNode> {
    if (tableParents.has(parent) && !node.value.trim()) return null
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    const bounded = Number.isFinite(limit) && parent !== 'code' && !inPre
    if (!parts?.length || inPre || start === undefined || end === undefined || !node.value)
      return yield* displayText(node.value, bounded)
    const spans: ReactNode[] = []
    for (const run of markSourceText(
      node.value,
      source,
      start,
      end,
      parts,
      parent === 'code' ? 'inlineCode' : 'markdown'
    )) {
      const stream = displayText(run.text, bounded)
      const span = (children: ReactNode): ReactNode => (
        <span key={spans.length} data-part-key={run.key} data-markdown-part-fragment="">
          {children}
        </span>
      )
      let frame = stream.next()
      while (!frame.done) {
        yield [...spans, span(frame.value)]
        frame = stream.next()
      }
      spans.push(span(frame.value))
    }
    return spans
  }
  function* visit(
    node: Root | RootContent,
    index: number,
    parent = '',
    inPre = false
  ): Generator<ReactNode, ReactNode> {
    if (--remaining <= 0 || (remaining % 64 === 0 && performance.now() >= deadline)) {
      yield null
      remaining = limit
      deadline = performance.now() + milliseconds
    }
    if (node.type === 'text') {
      if (
        Number.isFinite(limit) &&
        parent === 'p' &&
        index === 0 &&
        node.value.length > 131072 &&
        (!parts || parts.length <= 1)
      ) {
        const run = <LongParagraphText value={node.value} onComplete={trackParagraph?.()} />
        return parts?.length ? (
          <span data-part-key={parts[0].key} data-markdown-part-fragment="">
            {run}
          </span>
        ) : (
          run
        )
      }
      return yield* text(node, parent, inPre)
    }
    if (node.type !== 'element' && node.type !== 'root') return null
    const tag = node.type === 'element' ? node.tagName : ''
    // Let the normal converter own URL, CSS, table alignment and component props.
    const template = toJsxRuntime({ ...node, children: [] } as Root | Element, {
      Fragment,
      jsx,
      jsxs,
      passNode: true,
      ignoreInvalidStyle: true,
      components: parts?.length ? withMarkedTableRows : withTableRows
    })
    if (!node.children.length) return cloneElement(template, { key: index })
    const wrap = (children: ReactNode): ReactNode =>
      cloneElement(template, { key: index }, children)
    const groups: ReactNode[] = []
    let group: ReactNode[] = []
    const prefix = (child?: ReactNode): ReactNode => {
      const tail = child == null ? group : [...group, child]
      if (node.children.length < 128) return tail.length === 1 ? tail[0] : tail
      return [...groups, <Fragment key={groups.length}>{tail}</Fragment>]
    }
    for (let i = 0; i < node.children.length; i++) {
      const nested = visit(node.children[i], i, tag, inPre || tag === 'pre')
      let result = nested.next()
      while (!result.done) {
        yield wrap(prefix(result.value))
        result = nested.next()
      }
      if (result.value != null) group.push(result.value)
      // The first group also needs a stable wrapper before the second one appears.
      if (group.length === 128) {
        groups.push(<Fragment key={groups.length}>{group}</Fragment>)
        group = []
      }
    }
    return wrap(prefix())
  }
  return yield* visit(hast, 0)
}

export function MarkdownHast({
  hast,
  source,
  parts,
  onComplete,
  tableRows
}: MarkdownHastProps): React.JSX.Element {
  const [completedParagraphs, setCompletedParagraphs] = useState(0)
  const stream = useMemo(() => {
    const pending = new Set<object>()
    const trackParagraph = (): (() => void) => {
      const ticket = {}
      pending.add(ticket)
      return () => {
        if (pending.delete(ticket) && !pending.size) setCompletedParagraphs((n) => n + 1)
      }
    }
    const frames =
      typeof window === 'undefined'
        ? markdownFrames({ hast, source, parts }, Infinity, Infinity)
        : markdownFrames({ hast, source, parts, trackParagraph })
    const first = frames.next()
    return { frames, first, pending }
  }, [hast, source, parts])
  const [progress, setProgress] = useState<{ stream: typeof stream; step: typeof stream.first }>()
  const step = progress?.stream === stream ? progress.step : stream.first
  useEffect(() => {
    if (step.done) {
      if (!stream.pending.size) onComplete?.()
      return
    }
    const frame = requestAnimationFrame(() => setProgress({ stream, step: stream.frames.next() }))
    return () => cancelAnimationFrame(frame)
  }, [step, stream, completedParagraphs, onComplete])
  const context = useMemo(() => (parts?.length ? { source, parts } : null), [source, parts])
  return (
    <MarkdownPartsContext.Provider value={context}>
      <TableRows.Provider value={tableRows}>{step.value}</TableRows.Provider>
    </MarkdownPartsContext.Provider>
  )
}
