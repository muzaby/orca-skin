import { writeScrollTop } from '@renderer/features/chat/components/transcript/TranscriptViewport'
import {
  observeScrollWrites,
  type ScrollTrace
} from '@renderer/features/chat/lib/transcript/viewport/scrollCorrection'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { LoadedMessage } from '../../src/shared/ipc'
import { emptyBackgroundState } from '../../src/shared/background-task'
import { HarnessScrollController } from '@renderer/features/chat/components/transcript/HarnessScrollController'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import { chatActions, useChatStore } from '@renderer/features/chat/store/chatStore'
import type { HistoryEdgeState } from '@renderer/features/chat/lib/transcript/historyGesture'
import appCss from '@renderer/styles/app.css?inline'

const [backend, agentKind] = new URLSearchParams(location.search).get('screen')!.split('-') as [
  'claude' | 'opencode',
  'code' | 'work'
]
const id = 'history-probe'
function turn(index: number, paragraphs: number): LoadedMessage[] {
  return [
    {
      id: 'u:' + index,
      role: 'user',
      createdAt: 2 * index,
      parts: [{ type: 'text', text: 'Question ' + index + ' — fixture line' }]
    },
    {
      id: 'a:' + index,
      role: 'assistant',
      createdAt: 2 * index + 1,
      parts: [
        {
          type: 'text',
          text: Array.from(
            { length: paragraphs },
            (_, i) => 'Answer ' + index + ', paragraph ' + i + ' — fixture line'
          ).join('\n\n')
        }
      ]
    }
  ]
}
Object.assign(window, {
  oo: {
    session: {
      load: async () => ({
        id,
        backend,
        agentKind,
        title: id,
        messages: turn(2, 40),
        complete: false
      }),
      refresh: async () => ({ status: 'unchanged' })
    },
    settings: { set: async () => ({}) },
    chat: { backgroundState: async () => emptyBackgroundState() }
  }
})
const style = document.createElement('style')
style.textContent =
  appCss + '\nbody {margin:0} #root {height:100vh;display:flex;flex-direction:column}'
document.head.appendChild(style)
await chatActions.loadSession(id)
const root = createRoot(document.querySelector('#root')!)
const scenario = new URLSearchParams(location.search).get('scenario')
const writes: ScrollTrace[] = []
let growth: { initial: number; final: number; at: number } | undefined
let requests = 0
let edge: HistoryEdgeState = 'ready'
function request(direction: string): boolean {
  if (direction !== 'before' || edge === 'loading' || edge === 'end') return false
  requests++
  edge = 'loading'
  render()
  return true
}
// eslint-disable-next-line react-refresh/only-export-components -- Standalone diagnostic entry point.
function Screen(): React.JSX.Element {
  const state = useChatStore((store) => store.sessions[id].session)
  return (
    <HarnessScrollController
      backend={backend}
      sessionKey={id}
      sessionId={id}
      messages={state.messages}
      sendCount={0}
      inflight={false}
    >
      {(scroll) => (
        <TranscriptView
          {...scroll}
          backend={backend}
          agentKind={agentKind}
          messages={state.messages}
          history={{ before: edge, request }}
          pendingSteer={[]}
          inflight={false}
          loadingSession={false}
        />
      )}
    </HarnessScrollController>
  )
}
function render(): void {
  root.render(<Screen />)
}
flushSync(render)
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))
async function settle(count = 6): Promise<void> {
  for (let i = 0; i < count; i++) await frame()
}
const scroller = (): HTMLElement =>
  document.querySelector<HTMLElement>('[data-behavior="virtualizable"]')!
const header = (): HTMLElement =>
  document.querySelector<HTMLElement>('[data-history-edge="before"]')!
type Line = { part: string; text: string }
let reading: Line
function visibleLine(wanted?: Line): Line & { top: number; partTop: number } {
  const scroll = scroller().getBoundingClientRect()
  for (const part of scroller().querySelectorAll<HTMLElement>('[data-part-key]')) {
    if (wanted && wanted.part !== part.dataset.partKey) continue
    const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      if (!text.includes('fixture line') || (wanted && wanted.text !== text)) continue
      const range = document.createRange()
      range.setStart(node, 0)
      range.setEnd(node, 1)
      const rect = range.getBoundingClientRect()
      if (!rect.height || (!wanted && (rect.top < scroll.top || rect.bottom > scroll.bottom)))
        continue
      return {
        part: part.dataset.partKey!,
        text,
        top: rect.top,
        partTop: part.getBoundingClientRect().top
      }
    }
  }
  throw Error('Missing reading line ' + JSON.stringify(wanted))
}
interface Sample extends Line {
  partTop: number
  top: number
  scrollTop: number
  headerHeight: number
  state?: string
  time: number
}
function snapshot(): Sample {
  const line = visibleLine(reading)
  return {
    part: line.part,
    text: line.text,
    partTop: line.partTop,
    top: line.top,
    scrollTop: scroller().scrollTop,
    headerHeight: header().offsetHeight,
    state: header().dataset.historyState,
    time: performance.now()
  }
}
// Preserve the intermediate layouts without delaying the native follow-up wheel.
let layouts: Promise<Sample[]> = Promise.resolve([])
async function sampleCorrection(): Promise<Sample[]> {
  const samples: Sample[] = []
  for (let i = 0; i < 8; i++) {
    await frame()
    samples.push(snapshot())
  }
  return samples
}
const wheels: {
  at: number
  timestamp: number
  delta: number
  prevented: boolean
  trusted: boolean
  scrollTop: number
}[] = []
window.addEventListener(
  'wheel',
  (e) => {
    wheels.push({
      at: performance.now(),
      timestamp: e.timeStamp,
      delta: e.deltaY,
      prevented: e.defaultPrevented,
      trusted: e.isTrusted,
      scrollTop: scroller().scrollTop
    })
  },
  { passive: true }
)
async function waitForRequest(): Promise<void> {
  for (let i = 0; requests === 0 && i < 60; i++) await frame()
  if (requests !== 1 || edge !== 'loading')
    throw Error('Expected one pending request, got ' + requests + ' ' + edge)
}
Object.assign(window, {
  historyProbe: {
    async prepare() {
      await document.fonts.ready
      await settle()
      scroller().scrollTop = 0
      await settle()
      reading = visibleLine()
      observeScrollWrites(scroller(), (event) => writes.push(event))
      const bounds = scroller().getBoundingClientRect()
      return {
        x: Math.round(bounds.left + bounds.width / 2),
        y: Math.round(bounds.top + bounds.height / 2),
        start: snapshot()
      }
    },
    async middle() {
      await waitForRequest()
      scroller().scrollTop = 216
      await settle()
      reading = visibleLine()
    },
    async commit() {
      await waitForRequest()
      await frame()
      const before = snapshot()
      const deferred = document.createElement('style')
      if (scenario === 'firstMeasurement') {
        deferred.textContent =
          '[data-index][data-message-id="u:1"], [data-index]:has([data-part-key="u:1:user"]){display:none!important}'
        document.head.appendChild(deferred)
      }
      flushSync(() => {
        chatActions.prependHistory(id, turn(1, 5), { reachedStart: true })
        edge = 'end'
        render()
      })
      if (useChatStore.getState().sessions[id].session.messages[0].id !== 'u:1')
        throw Error('Page rejected')
      const commitAt = performance.now()
      if (scenario === 'ownership') {
        writeScrollTop(scroller(), scroller().scrollTop + 17, undefined, backend)
      }
      layouts = (async () => {
        if (scenario === 'lateHeight' || scenario === 'firstMeasurement') {
          await frame()
          const row = Array.from(scroller().querySelectorAll<HTMLElement>('[data-index]')).find(
            (el) => el.textContent?.includes('Question 1 — fixture line')
          )
          if (!row) throw Error('Missing prepended row')
          const initial = row.getBoundingClientRect().height
          deferred.remove()
          if (scenario === 'lateHeight')
            row.style.paddingBottom = parseFloat(getComputedStyle(row).paddingBottom) + 40 + 'px'
          growth = { initial, final: row.getBoundingClientRect().height, at: performance.now() }
        }
        return sampleCorrection()
      })()
      return { before, commitAt }
    },
    async states() {
      const samples = [snapshot()]
      for (const state of ['loading', 'error', 'ready', 'loading', 'end'] as const) {
        flushSync(() => {
          edge = state
          render()
        })
        await settle(2)
        samples.push(snapshot())
      }
      return samples
    },
    async result() {
      await settle(8)
      return { after: snapshot(), wheels, requests, layouts: await layouts, writes, growth }
    }
  }
})
