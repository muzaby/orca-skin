import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import {
  createPlanCommentIndex,
  type OverlayRect,
  type PlanCommentIndex
} from '../lib/planCommentDom'
import type { PlanComment } from '../reducer/chatReducer'

type CommentRange = Pick<PlanComment, 'start' | 'end' | 'quote'>

interface Geometry {
  source: string
  activeId: string | null
  comments: { id: string; rects: OverlayRect[] }[]
  draft: OverlayRect[]
  anchor: { x: number; top: number; bottom: number; containerWidth: number } | null
}

function intersects(rect: DOMRect, viewport: DOMRect): boolean {
  return (
    rect.bottom > Math.max(0, viewport.top) &&
    rect.top < Math.min(window.innerHeight, viewport.bottom) &&
    rect.right > Math.max(0, viewport.left) &&
    rect.left < Math.min(window.innerWidth, viewport.right)
  )
}

export function usePlanCommentGeometry(
  contentRef: RefObject<HTMLDivElement | null>,
  overlayRef: RefObject<HTMLDivElement | null>,
  source: string | null,
  comments: readonly PlanComment[],
  active: PlanComment | null,
  draft: CommentRange | null,
  indexRef: RefObject<PlanCommentIndex | null>
): Geometry | null {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const inputs = useRef({ comments, active, draft })
  const scheduleRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<(() => void) | null>(null)

  useLayoutEffect(() => {
    const content = contentRef.current
    const overlay = overlayRef.current
    if (!source || !content || !overlay) return
    const scroller = overlay.closest('[data-plan-task-overview]')
    const visible = new Set<Element>()
    let blocksByElement = new Map<Element, PlanCommentIndex['blocks'][number][]>()
    let frame: number | undefined
    let reveal = true
    let indexed = false

    function schedule(): void {
      frame ??= requestAnimationFrame(measure)
    }
    const visibility = new IntersectionObserver(
      (changes) => {
        for (const { target, isIntersecting } of changes) {
          if (isIntersecting) visible.add(target)
          else visible.delete(target)
        }
        schedule()
      },
      { root: scroller }
    )
    const layout = new ResizeObserver(schedule)
    function indexContent(): void {
      visibility.disconnect()
      visible.clear()
      const index = createPlanCommentIndex(content!)
      indexRef.current = index
      if (indexed) reveal = true
      indexed = true
      blocksByElement = new Map()
      for (const block of index.blocks) {
        const blocks = blocksByElement.get(block.element)
        if (blocks) blocks.push(block)
        else {
          blocksByElement.set(block.element, [block])
          visibility.observe(block.element)
        }
      }
      schedule()
    }
    function measure(): void {
      frame = undefined
      const index = indexRef.current
      if (!index) return
      const { comments, active, draft } = inputs.current
      const viewport =
        scroller?.getBoundingClientRect() ??
        new DOMRect(0, 0, window.innerWidth, window.innerHeight)
      if (reveal && active && index.text.slice(active.start, active.end) === active.quote) {
        const element = index.range(active.start, active.end)?.startContainer.parentElement
        if (element && !intersects(element.getBoundingClientRect(), viewport)) {
          element.scrollIntoView({ block: 'nearest' })
          schedule()
          reveal = false
          return
        }
      }
      reveal = false
      const origin = overlay!.getBoundingClientRect()
      const blocks = [...visible]
        .flatMap((element) =>
          intersects(element.getBoundingClientRect(), viewport)
            ? (blocksByElement.get(element) ?? [])
            : []
        )
        .sort((a, b) => a.start - b.start)
      const rects = (entry: CommentRange): OverlayRect[] =>
        blocks.some((block) => block.start < entry.end && entry.start < block.end) &&
        entry.end - entry.start === entry.quote.length &&
        index.text.startsWith(entry.quote, entry.start)
          ? index.rects(entry.start, entry.end, origin, blocks)
          : []
      const entries = comments.map((comment) => ({ id: comment.id, rects: rects(comment) }))
      const first = entries.find((item) => item.id === active?.id)?.rects[0]
      setGeometry({
        source: source!,
        activeId: active?.id ?? null,
        comments: entries,
        draft: draft ? rects(draft) : [],
        anchor: first
          ? {
              x: first.left + first.width / 2,
              top: first.top,
              bottom: first.top + first.height,
              containerWidth: overlay!.clientWidth
            }
          : null
      })
    }
    const mutations = new MutationObserver(indexContent)
    mutations.observe(content, { childList: true, characterData: true, subtree: true })
    layout.observe(content)
    if (scroller) layout.observe(scroller)
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    scheduleRef.current = schedule
    scrollRef.current = () => {
      reveal = true
    }
    indexContent()
    return () => {
      mutations.disconnect()
      visibility.disconnect()
      layout.disconnect()
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      if (frame !== undefined) cancelAnimationFrame(frame)
      indexRef.current = null
      scheduleRef.current = null
      scrollRef.current = null
    }
  }, [contentRef, overlayRef, source, indexRef])

  useLayoutEffect(() => {
    if (inputs.current.active?.id !== active?.id) scrollRef.current?.()
    inputs.current = { comments, active, draft }
    scheduleRef.current?.()
  }, [comments, active, draft])
  return geometry?.source === source ? geometry : null
}
