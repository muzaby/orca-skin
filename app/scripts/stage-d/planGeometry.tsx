import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { PlanTileContent } from '@renderer/features/chat/harnesses/common/rightpanel/PlanTileContent'
import { initialChatState, type PlanComment } from '@renderer/features/chat/reducer/chatReducer'
import { chatActions, useChatStore } from '@renderer/features/chat/store/chatStore'
import appCss from '@renderer/styles/app.css?inline'
import { editInput } from './domInput'

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

export interface PlanGeometryResult {
  paragraphs: number
  comments: number
  rectReads: number
  rectReadsAfterResize: number
  openedLast: boolean
  lastVisible: boolean
  tookFocus: boolean
  initialScroll: number
  initialFirstTop: number
  initialViewport: number[]
  savedSelection: string
  burstRectReads: number
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 6; tick++) await frame()
}

interface GeometryTiming {
  paragraphs: number
  comments: number
  commitMs: number
  paintMs: number
  rectReads: number
  rectReadsAfterResize: number
}

export async function measurePlanGeometry(
  comparison = false
): Promise<PlanGeometryResult | GeometryTiming> {
  const style = document.createElement('style')
  style.textContent = appCss
  document.head.append(style)
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed; top:0; left:0; display:flex; height:470px; width:600px;'
  document.body.append(host)
  const paragraphCount = 2000
  const paragraphs = Array.from(
    { length: paragraphCount },
    (_, index) => `row${index}: plan entry repeated 🐬 with a [reference](https://example.invalid).`
  )
  const source = paragraphs.join('\n\n')
  const session = 'stage-d-plan'
  useChatStore.setState({
    activeKey: session,
    sessions: {
      [session]: {
        session: {
          ...initialChatState,
          sessionId: session,
          planContent: source,
          pendingPlanReview: { requestId: 'review', plan: source }
        },
        live: { text: '', reasoning: '', reasoningVisible: false },
        subagentMeta: {}
      }
    }
  })
  const root = createRoot(host)
  const realRects = Range.prototype.getClientRects
  const elementRect = Element.prototype.getBoundingClientRect
  let paragraphReads = 0
  Element.prototype.getBoundingClientRect = function () {
    if (this.tagName === 'P') paragraphReads++
    return elementRect.call(this)
  }
  let rectReads = 0
  Range.prototype.getClientRects = function () {
    rectReads++
    return realRects.call(this)
  }
  try {
    flushSync(() =>
      root.render(
        <PlanTileContent
          emptyDescriptionKey="chat.rightpanel.planEmptyTitle"
          selectHintKey="chat.rightpanel.planEmptyTitle"
        />
      )
    )
    const scroller = host.querySelector<HTMLElement>('[data-plan-task-overview]')!
    const nodes = [...scroller.querySelectorAll('p')].filter((node) =>
      node.textContent?.startsWith('row')
    )
    if (nodes.length !== paragraphCount) throw Error('Plan fixture did not mount')
    const lastParagraph = nodes.at(-1)!
    const firstParagraph = nodes[0]
    const content = firstParagraph.parentElement!
    const rendered = content.textContent!
    async function selectDuplicate(): Promise<string> {
      const scope = content.parentElement!
      const outside = document.createElement('span')
      outside.textContent = 'overlay text'
      scope.parentElement!.prepend(outside)
      const link = nodes[1].querySelector('a')!
      // Markdown can replace Text nodes while preserving the same source string.
      link.replaceChildren(document.createTextNode(link.textContent!))
      await settle()
      link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      document.getSelection()!.setBaseAndExtent(link.firstChild!, 9, link.firstChild!, 0)
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 40, clientY: 40 }))
      await settle()
      const draft = host.querySelector('textarea')
      if (!draft) throw Error('replaced Markdown selection did not open')
      flushSync(() => editInput(draft, 'new selection'))
      flushSync(() =>
        draft.dispatchEvent(
          new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ctrlKey: true })
        )
      )
      const saved = useChatStore.getState().sessions[session].session.planComments.at(-1)
      const expected = rendered.indexOf('reference', rendered.indexOf('reference') + 1)
      if (saved?.start !== expected || saved.end !== expected + 9 || saved.quote !== 'reference')
        throw Error('duplicate quote stored at the wrong offset')
      outside.remove()
      return saved.quote
    }
    const savedSelection = comparison ? null : await selectDuplicate()
    const comments: PlanComment[] = Array.from({ length: 128 }, (_, index) => {
      const row = Math.floor(((paragraphCount - 1) * index) / 127)
      const marker = `row${row}: plan`
      const start = content.textContent!.indexOf(marker)
      if (start < 0) throw Error('Plan source offset is unavailable')
      return {
        id: String(index),
        start,
        end: start + marker.length,
        quote: marker,
        createdAt: 1,
        body: `body-${index}`
      }
    })
    const stored = useChatStore.getState().sessions[session]
    comments.push({
      id: 'whole',
      start: 0,
      end: rendered.length,
      quote: rendered,
      body: 'whole body',
      createdAt: 1
    })
    const start = performance.now()
    flushSync(() =>
      useChatStore.setState({
        sessions: {
          [session]: { ...stored, session: { ...stored.session, planComments: comments } }
        }
      })
    )
    const commitMs = performance.now() - start
    await frame()
    await frame()
    const paintMs = performance.now() - start - commitMs
    await settle()
    const initialReads = rectReads
    const initialScroll = scroller.scrollTop
    const initialFirstTop = firstParagraph.getBoundingClientRect().top
    const initialRect = scroller.getBoundingClientRect()
    host.style.width = '360px'
    await settle()
    const rectReadsAfterResize = rectReads - initialReads
    host.style.width = '600px'
    await settle()
    if (comparison)
      return {
        paragraphs: nodes.length,
        comments: comments.length,
        commitMs,
        paintMs,
        rectReads: initialReads,
        rectReadsAfterResize
      }
    const beforeSingle = rectReads
    window.dispatchEvent(new Event('resize'))
    await settle()
    const single = rectReads - beforeSingle
    const beforeBurst = rectReads
    const paragraphStart = paragraphReads
    for (let i = 0; i < 8; i++) window.dispatchEvent(new Event('resize'))
    await settle()
    const burstRectReads = rectReads - beforeBurst
    if (paragraphReads - paragraphStart >= 200)
      throw Error('measured offscreen paragraphs ' + (paragraphReads - paragraphStart))
    if (single === 0 || burstRectReads !== single || burstRectReads >= 200)
      throw Error('visible range frame coalescing ' + JSON.stringify({ single, burstRectReads }))
    flushSync(() => chatActions.setActivePlanComment('127'))
    await settle()
    const input = host.querySelector<HTMLTextAreaElement>('textarea')
    const rect = lastParagraph.getBoundingClientRect()
    const viewport = scroller.getBoundingClientRect()
    return {
      paragraphs: nodes.length,
      comments: comments.length,
      rectReads: initialReads,
      rectReadsAfterResize,
      openedLast: input?.value === 'body-127',
      lastVisible: rect.bottom > viewport.top && rect.top < viewport.bottom,
      tookFocus: input !== null && document.activeElement === input,
      savedSelection: savedSelection!,
      burstRectReads,
      initialScroll,
      initialFirstTop,
      initialViewport: [initialRect.top, initialRect.bottom, window.innerHeight]
    }
  } finally {
    Range.prototype.getClientRects = realRects
    Element.prototype.getBoundingClientRect = elementRect
    root.unmount()
    host.remove()
    style.remove()
  }
}
