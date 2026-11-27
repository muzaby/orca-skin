import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { Element } from 'hast'
import { scheduleMarkdownCommit } from './commitQueue'

interface Slice {
  start: number
  end: number
  height?: number
}

const GROUP = 144

// Keep the unfinished line in normal inline layout. Only complete, measured lines
// become independent formatting contexts, with the same text and interactive children.
export const MeasuredInlineParagraph = memo(function MeasuredInlineParagraph({
  node,
  render,
  onComplete
}: {
  node: Element
  render: (start: number, end: number, done?: () => void, wrapped?: boolean) => ReactNode
  onComplete?: () => void
}): React.JSX.Element {
  const active = useRef<HTMLSpanElement>(null)
  const [groups, setGroups] = useState<Slice[]>([])
  const start = groups.at(-1)?.end ?? 0
  const end = Math.min(node.children.length, start + GROUP)
  const [painted, setPainted] = useState(-1)
  const [paintedGroups, setPaintedGroups] = useState(0)
  const ack = useCallback((): void => setPaintedGroups((n) => n + 1), [])
  const [layout, setLayout] = useState(0)
  const paintedActive = useMemo(() => () => setPainted(end), [end])
  const last = start === node.children.length || (end === node.children.length && end === painted)
  const done = last && paintedGroups === groups.length
  useEffect(() => {
    if (done) onComplete?.()
  }, [done, onComplete])
  useLayoutEffect(() => {
    const p = active.current?.closest('p')
    if (!p) return
    let width = p.getBoundingClientRect().width
    const reset = (): void => setLayout((n) => n + 1)
    const observer = new ResizeObserver(() => {
      const current = p.getBoundingClientRect().width
      if (current !== width) {
        width = current
        reset()
      }
    })
    observer.observe(p)
    document.fonts?.addEventListener('loadingdone', reset)
    return () => {
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', reset)
    }
  }, [])
  useLayoutEffect(() => {
    if (layout) {
      setGroups([])
      setPainted(-1)
      setPaintedGroups(0)
    }
  }, [layout])
  useEffect(() => {
    if (last || painted !== end) return
    return scheduleMarkdownCommit(() => {
      const span = active.current
      if (!span) return
      const nodes = span.childNodes
      // More than one source fragment, an indivisible word or a live selection can
      // make the DOM boundary unsuitable. Leave that slice inline, with no forced break.
      const slice: Slice = { start, end }
      if (
        (start === 0 || groups.at(-1)?.height !== undefined) &&
        getComputedStyle(span).direction === 'ltr' &&
        nodes.length === end - start &&
        !span.contains(document.getSelection()?.anchorNode ?? null) &&
        !span.contains(document.activeElement)
      ) {
        const range = document.createRange()
        function top(index: number, last: boolean): number | undefined {
          let child: Node | null = nodes[index]
          while (child && child.nodeType !== Node.TEXT_NODE)
            child = last ? child.lastChild : child.firstChild
          if (!(child instanceof Text)) return
          const at = last ? child.data.search(/\S\s*$/u) : child.data.search(/\S/u)
          if (at < 0) return
          range.setStart(child, at)
          range.setEnd(child, at + 1)
          const rect = range.getBoundingClientRect()
          return rect.height ? rect.top : undefined
        }
        const first = top(0, false)
        let nextTop: number | undefined,
          nextIndex = nodes.length
        const line = parseFloat(getComputedStyle(span).lineHeight)
        if (first !== undefined && line > 0) {
          for (let i = nodes.length - 1; i > 0; i--) {
            const bottom = top(i, true)
            if (bottom === undefined) continue
            if (
              nextTop !== undefined &&
              nextTop - bottom > line * 0.55 &&
              nextTop - first >= line
            ) {
              slice.end = start + nextIndex
              slice.height = Math.round((nextTop - first) / line) * line
              break
            }
            nextTop = top(i, false)
            nextIndex = i
          }
        }
      }
      setGroups((previous) => [...previous, slice])
    })
  }, [node, last, start, end, painted, groups])
  return (
    <>
      {!done && <span hidden data-md-block-pending="" />}
      {groups.map((group) => (
        <InlineSlice key={group.start} group={group} render={render} ack={ack} />
      ))}
      {start < node.children.length && (
        <span key={layout} ref={active}>
          {render(start, end, paintedActive)}
        </span>
      )}
    </>
  )
})
const InlineSlice = memo(function InlineSlice({
  group,
  render,
  ack
}: {
  ack: () => void
  group: Slice
  render: (start: number, end: number, done?: () => void, wrapped?: boolean) => ReactNode
}): React.JSX.Element {
  const committed = useRef(false)
  const done = useMemo(
    () => (): void => {
      if (!committed.current) {
        committed.current = true
        ack()
      }
    },
    [ack]
  )
  return (
    <span
      data-markdown-inline-group={group.height ? '' : undefined}
      style={
        group.height
          ? {
              display: 'inline-block',
              width: '100%',
              verticalAlign: 'top',
              contentVisibility: 'auto',
              containIntrinsicSize: 'auto ' + group.height + 'px'
            }
          : undefined
      }
    >
      {render(group.start, group.end, done, !!group.height)}
    </span>
  )
})
