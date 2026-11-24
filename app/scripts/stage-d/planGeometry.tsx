import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { PlanTileContent } from '@renderer/features/chat/harnesses/common/rightpanel/PlanTileContent'
import { initialChatState, type PlanComment } from '@renderer/features/chat/reducer/chatReducer'
import { chatActions, useChatStore } from '@renderer/features/chat/store/chatStore'
import appCss from '@renderer/styles/app.css?inline'

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
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 6; tick++) await frame()
}

export async function measurePlanGeometry(): Promise<PlanGeometryResult> {
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
        session: { ...initialChatState, sessionId: session, planContent: source },
        live: { text: '', reasoning: '', reasoningVisible: false },
        subagentMeta: {}
      }
    }
  })
  const root = createRoot(host)
  const realRects = Range.prototype.getClientRects
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
    flushSync(() =>
      useChatStore.setState({
        sessions: {
          [session]: { ...stored, session: { ...stored.session, planComments: comments } }
        }
      })
    )
    await settle()
    const initialReads = rectReads
    const initialScroll = scroller.scrollTop
    const initialFirstTop = firstParagraph.getBoundingClientRect().top
    const initialRect = scroller.getBoundingClientRect()
    host.style.width = '360px'
    await settle()
    const rectReadsAfterResize = rectReads - initialReads
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
      initialScroll,
      initialFirstTop,
      initialViewport: [initialRect.top, initialRect.bottom, window.innerHeight]
    }
  } finally {
    Range.prototype.getClientRects = realRects
    root.unmount()
    host.remove()
    style.remove()
  }
}
