import { writeScrollTop } from '@renderer/features/chat/components/transcript/TranscriptViewport'
import {
  observeScrollWrites,
  type ScrollTrace
} from '@renderer/features/chat/lib/transcript/viewport/scrollCorrection'
import { useState } from 'react'
import type { HistoryQuery, HistoryLocator } from '../../src/shared/history-page'
import { SearchModal } from '@renderer/features/sessions/components/SearchModal'
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
const scenario = new URLSearchParams(location.search).get('scenario')
const searchCase = scenario === 'search'
const realPage = [
  'unitOpen',
  'framesUnit',
  'openFrames',
  'entryPrepend',
  'entryCancel',
  'pullShort'
].includes(scenario ?? '')
const entryCase = ['openFrames', 'entryPrepend', 'entryCancel'].includes(scenario ?? '')
const latestFive = [6, 7, 8, 9, 10].flatMap((i) => turn(i, 3))
let releaseUnit: (() => void) | undefined
let expanded = false
const target = 'u:63'
const locator: HistoryLocator = {
  v: 1,
  session: id,
  source: 'local',
  identity: '63',
  epoch: 'g',
  projectedKey: target
}
const searchRequests: string[] = []
Object.assign(window, {
  oo: {
    search: {
      messages: async () => [
        {
          messageId: 63,
          sessionId: id,
          locator,
          role: 'user',
          snippet: 'fixture',
          sessionTitle: 'fixture',
          createdAt: 1
        }
      ]
    },
    session: {
      page: async (query: HistoryQuery) => {
        searchRequests.push(query.kind)
        if (realPage && query.kind !== 'target') {
          await new Promise<void>((resolve) => {
            releaseUnit = resolve
          })
          const unitRemainder = query.kind === 'withinUnit'
          return {
            status: 'ok',
            requestId: 1,
            sessionId: id,
            openGeneration: query.openGeneration,
            session: {
              id,
              backend,
              agentKind,
              title: id,
              complete: false,
              messages: unitRemainder
                ? [6, 7, 8, 9].flatMap((i) => turn(i, 3))
                : scenario === 'pullShort'
                  ? []
                  : [1, 2, 3, 4, 5].flatMap((i) => turn(i, 3)),
              history: {
                generation: 'g',
                before: unitRemainder ? { kind: 'earlierTurn', cursor: 'prior' } : undefined
              }
            }
          }
        }
        return {
          status: 'ok',
          sessionId: id,
          requestId: 1,
          openGeneration: query.openGeneration,
          targetMessage: target,
          session: {
            id,
            backend,
            agentKind,
            title: id,
            complete: false,
            messages: [...turn(62, 45), ...turn(63, 1), ...turn(64, 30)],
            history: {
              generation: 'g',
              before: { kind: 'earlierTurn', cursor: 'before' },
              after: { kind: 'laterTurn', cursor: 'after' }
            }
          }
        }
      },
      load: async (key: string) => ({
        id: key,
        backend,
        agentKind,
        title: id,
        messages:
          key !== id
            ? turn(90, 1)
            : !realPage
              ? turn(2, 40)
              : entryCase && expanded
                ? turn(10, 80)
                : scenario === 'unitOpen'
                  ? latestFive
                  : turn(10, entryCase ? 1 : 42),
        ...(key === id && realPage
          ? {
              history: {
                generation: 'g',
                before:
                  scenario === 'unitOpen' || scenario === 'pullShort'
                    ? { kind: 'earlierTurn', cursor: 'prior' }
                    : expanded || scenario === 'framesUnit'
                      ? { kind: 'withinUnit', cursor: 'remainder' }
                      : undefined
              }
            }
          : {}),
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
await chatActions.loadSession(entryCase ? 'previous' : id)
const root = createRoot(document.querySelector('#root')!)
const writes: ScrollTrace[] = []
let nested: HTMLElement | undefined
let nestedRead: { scrollTop: number; requests: number } | undefined
let betweenPrepends: number | undefined
const footerSizes: number[] = []
const footer = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-transcript-viewport] > :last-child')
if (scenario === 'footerResize') {
  const Observer = window.ResizeObserver
  window.ResizeObserver = class extends Observer {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        for (const entry of entries)
          if (entry.target === footer()) footerSizes.push(entry.contentRect.height)
        callback(entries, observer)
      })
    }
  }
}
let growth: { initial: number; final: number; at: number } | undefined
let requests = 0
let edge: HistoryEdgeState = scenario === 'pullEnd' ? 'end' : 'ready'
function request(direction: string): boolean {
  if (scenario === 'states') return false
  if (direction !== 'before' || edge === 'loading' || edge === 'end') return false
  requests++
  edge = 'loading'
  render()
  return true
}
// eslint-disable-next-line react-refresh/only-export-components -- Standalone diagnostic entry point.
function Screen(): React.JSX.Element {
  const [searchOpen, setSearchOpen] = useState(searchCase)
  const active = useChatStore((store) => store.activeKey)
  const state = useChatStore((store) => store.sessions[active].session)
  return (
    <>
      {searchOpen && (
        <div className="absolute z-50">
          <SearchModal
            onClose={() => setSearchOpen(false)}
            onChoose={(hit, keyboard) => chatActions.openSearchHit(hit.locator!, keyboard)}
          />
        </div>
      )}
      <HarnessScrollController
        backend={backend}
        sessionKey={active}
        sessionId={active}
        messages={state.messages}
        sendCount={0}
        inflight={false}
      >
        {(scroll) => (
          <TranscriptView
            {...scroll}
            backend={backend}
            sessionId={active}
            agentKind={agentKind}
            messages={state.messages}
            history={searchCase || realPage ? undefined : { before: edge, request }}
            pendingSteer={[]}
            inflight={false}
            loadingSession={state.loadingSession}
          />
        )}
      </HarnessScrollController>
    </>
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
let point: { x: number; y: number } | undefined
function hitAtPoint() {
  if (!point) return undefined
  const range = document.caretRangeFromPoint(point.x, point.y)
  const node = range?.startContainer
  const part = node?.parentElement?.closest<HTMLElement>('[data-part-key]')
  if (!range || !node || !part) return undefined
  const block = part.closest<HTMLElement>('[data-message-id]')
  const prefix = document.createRange()
  prefix.setStart(part, 0)
  prefix.setEnd(node, range.startOffset)
  const offset = prefix.toString().length
  return {
    part: part.dataset.partKey,
    message: block?.dataset.messageId,
    offset,
    text: part.textContent?.slice(offset, offset + 20)
  }
}

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
      if (!wanted) point = { x: rect.left + rect.width / 4, y: rect.top + rect.height / 2 }
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
  hit?: ReturnType<typeof hitAtPoint>
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
    hit: hitAtPoint(),
    time: performance.now()
  }
}
// Preserve the intermediate layouts without delaying the native follow-up wheel.
let layouts: Promise<Sample[]> = Promise.resolve([])
async function sampleCorrection(): Promise<Sample[]> {
  const samples: Sample[] = []
  for (let i = 0; i < 10; i++) {
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
    async unitReady() {
      await settle(8)
      const r = scroller().getBoundingClientRect()
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
    },
    async unit() {
      const ids = () => useChatStore.getState().sessions[id].session.messages.map((m) => m.id)
      await settle(8)
      const first = ids()
      const rowsBeforeScroll = [...searchRequests]
      if (scenario === 'unitOpen') scroller().scrollTo({ top: 0, behavior: 'instant' })
      for (let n = 0; !releaseUnit && n < 90; n++) await frame()
      if (!releaseUnit) throw Error('Missing unit request')
      reading = visibleLine()
      const before = snapshot()
      releaseUnit()
      const layouts = await sampleCorrection()
      return {
        first,
        ids: ids(),
        rowsBeforeScroll,
        requests: searchRequests,
        before,
        layouts,
        after: snapshot()
      }
    },
    async entry() {
      const offsets: { top: number; bottom: number; opacity: number; line: string }[] = []
      const sample = () => {
        const el = scroller()
        const body = el.querySelector('[data-transcript-viewport]')
        const first = el.querySelector('[data-block-key]')
        if (!body || !first || el.dataset.transcriptSession !== id) return
        let line: string
        try {
          line = visibleLine().text
        } catch {
          line = ''
        }
        offsets.push({
          top: el.scrollTop,
          bottom: Math.max(0, el.scrollHeight - el.clientHeight),
          opacity: Number(getComputedStyle(body).opacity),
          line
        })
      }
      await chatActions.loadSession(id)
      for (let n = 0; n < 16; n++) {
        await frame()
        sample()
      }
      const firstPaint = [...offsets]
      offsets.length = 0
      expanded = true
      await chatActions.loadSession(id, null, { revalidate: true })
      for (let n = 0; n < 90; n++) {
        await frame()
        sample()
        const last = offsets.at(-1)
        if (last && last.top > 1 && last.top < last.bottom - 1 && releaseUnit) break
      }
      return { firstPaint, moving: [...offsets], requests: searchRequests }
    },
    async entrySettle() {
      const samples = []
      const el = scroller()
      for (let n = 0; n < 20 && !releaseUnit; n++) await frame()
      if (!releaseUnit) throw Error('Entry did not schedule unit fill')
      reading = visibleLine()
      const before = snapshot()
      observeScrollWrites(el, (record) => writes.push(record))
      releaseUnit()
      for (let n = 0; n < 90; n++) {
        await frame()
        samples.push({
          top: el.scrollTop,
          bottom: Math.max(0, el.scrollHeight - el.clientHeight),
          correcting: writes.at(-1)?.correcting,
          line: (() => {
            try {
              return visibleLine(reading).top
            } catch {
              return null
            }
          })()
        })
      }
      return { before, samples, writes }
    },

    async waitWheel() {
      await settle(2)
      for (let n = 0; !wheels.length && n < 60; n++) await frame()
    },
    async waitPull() {
      const heights: number[] = []
      for (let n = 0; n < 22; n++) {
        heights.push(document.querySelector('[data-history-pull]')!.getBoundingClientRect().height)
        await frame()
      }
      return heights
    },
    async short() {
      if (!releaseUnit) throw Error('Missing earlier page')
      reading = visibleLine()
      const before = snapshot()
      releaseUnit()
      const frames = []
      for (let n = 0; n < 28; n++) {
        await frame()
        frames.push({
          ...snapshot(),
          height: document.querySelector('[data-history-pull]')!.getBoundingClientRect().height
        })
      }
      return { before, frames, requests: searchRequests }
    },
    async fail() {
      reading = visibleLine()
      flushSync(() => {
        edge = 'error'
        render()
      })
      const heights: number[] = []
      for (let n = 0; n < 22; n++) {
        heights.push(document.querySelector('[data-history-pull]')!.getBoundingClientRect().height)
        await frame()
      }
      return heights
    },

    async searchInput() {
      await document.fonts.ready
      for (let i = 0; i < 80; i++) {
        if (document.querySelector('#search-modal-input') === document.activeElement) return true
        await frame()
      }
      throw Error('Search input did not receive focus')
    },
    async searchOption() {
      for (let i = 0; i < 100; i++) {
        const item = document.querySelector('[role="option"]')
        if (item) {
          const box = item.getBoundingClientRect()
          return {
            x: Math.round(box.left + box.width / 2),
            y: Math.round(box.top + box.height / 2)
          }
        }
        await frame()
      }
      throw Error('No search hit')
    },
    async searchResult() {
      for (let i = 0; i < 90; i++) {
        const row = scroller().querySelector<HTMLElement>('[data-history-highlight]')
        if (row) {
          const box = row.getBoundingClientRect(),
            area = scroller().getBoundingClientRect()
          return {
            requests: searchRequests,
            focused: document.activeElement === row,
            owner: row.dataset.partKey ?? row.dataset.blockKey,
            visible: box.bottom > area.top && box.top < area.bottom,
            selected: useChatStore.getState().sessions[id].search?.target
          }
        }
        await frame()
      }
      const element = scroller()
      const targetRow = element.querySelector<HTMLElement>('[data-part-key="u:63:user"]')
      throw Error(
        'Search target did not become visible ' +
          JSON.stringify({
            requests: searchRequests,
            target: useChatStore.getState().sessions[id].search?.target,
            focus: document.activeElement?.tagName,
            top: element.scrollTop,
            viewport: element.getBoundingClientRect().toJSON(),
            row: targetRow?.getBoundingClientRect().toJSON(),
            keys: [...element.querySelectorAll<HTMLElement>('[data-block-key]')].map(
              (row) => row.dataset.blockKey
            )
          })
      )
    },
    async focusForHome() {
      await document.fonts.ready
      await settle()
      const el = scroller()
      el.tabIndex = -1
      el.focus({ preventScroll: true })
    },
    async prepare() {
      await document.fonts.ready
      await settle()
      scroller().scrollTop = 0
      if (scenario === 'framesSmoothCss') scroller().style.scrollBehavior = 'smooth'
      await settle()
      reading = visibleLine()
      observeScrollWrites(scroller(), (event) => writes.push(event))
      const bounds = scroller().getBoundingClientRect()
      if (scenario === 'nested') {
        nested = document.createElement('pre')
        Object.assign(nested.style, {
          position: 'fixed',
          zIndex: '100',
          overflowY: 'auto',
          width: '100px',
          height: '70px',
          left: bounds.left + bounds.width / 2 - 50 + 'px',
          top: bounds.top + bounds.height / 2 - 35 + 'px'
        })
        const code = document.createElement('code')
        Object.assign(code.style, { display: 'block', height: '240px' })
        nested.append(code)
        scroller().append(nested)
        nested.scrollTop = 40
      }
      return {
        x: Math.round(bounds.left + bounds.width / 2),
        y: Math.round(bounds.top + bounds.height / 2),
        start: snapshot()
      }
    },
    async nestedBoundary() {
      if (!nested) throw Error('Missing nested scroller')
      for (let i = 0; i < 60 && (!wheels.length || nested.scrollTop === 40); i++) await frame()
      nestedRead = { scrollTop: nested.scrollTop, requests }
      nested.scrollTop = 0
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
      nested?.remove()
      reading = visibleLine()
      const before = snapshot()
      const deferred = document.createElement('style')
      if (scenario === 'firstMeasurement') {
        deferred.textContent =
          '[data-index][data-message-id="u:1"], [data-index]:has([data-part-key="u:1:user"]){display:none!important}'
        document.head.appendChild(deferred)
      }
      flushSync(() => {
        const payload =
          scenario?.startsWith('frames') || scenario === 'pullSuccess'
            ? [-3, -2, -1, 0, 1].flatMap((i) => turn(i, Math.abs(i) * 3 + 2))
            : turn(1, 5)
        chatActions.prependHistory(id, payload, { reachedStart: scenario !== 'doublePrepend' })
        edge = 'end'
        render()
      })
      if (!['u:1', 'u:-3'].includes(useChatStore.getState().sessions[id].session.messages[0].id))
        throw Error('Page rejected')
      const commitAt = performance.now()
      if (scenario === 'doublePrepend') {
        betweenPrepends = snapshot().top
        flushSync(() => {
          chatActions.prependHistory(id, turn(0, 3), { reachedStart: true })
          render()
        })
        if (useChatStore.getState().sessions[id].session.messages[0].id !== 'u:0')
          throw Error('Second page rejected')
      }
      if (scenario === 'ownership') {
        writeScrollTop(scroller(), scroller().scrollTop + 17, undefined, backend)
      }
      layouts = (async () => {
        if (scenario === 'footerResize') {
          await frame()
          const slot = footer()
          if (!slot) throw Error('Missing transcript footer')
          const initial = slot.getBoundingClientRect().height
          slot.style.height = initial + 39 + 'px'
          growth = { initial, final: slot.getBoundingClientRect().height, at: performance.now() }
        }
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
      const scrollerEl = scroller()
      const row = (part: string) =>
        scrollerEl.querySelector('[data-part-key="' + part + '"]')?.closest('[data-index]')
      const lastInserted = row('a:1:text:0')
      const firstExisting = row('u:2:user')
      return {
        joinGap:
          scenario === 'pullSuccess' && lastInserted && firstExisting
            ? firstExisting.getBoundingClientRect().top - lastInserted.getBoundingClientRect().bottom
            : undefined,
        spinners: scrollerEl.querySelectorAll(
          '[data-history-edge="before"] svg, [data-history-pull] svg'
        ).length,
        after: snapshot(),
        wheels,
        requests,
        layouts: await layouts,
        writes,
        growth,
        nestedRead,
        footerSizes,
        betweenPrepends
      }
    }
  }
})
