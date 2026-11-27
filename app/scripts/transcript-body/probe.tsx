import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { HarnessScrollController } from '@renderer/features/chat/components/transcript/HarnessScrollController'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import { chatActions, ingestChatEvent, useChatStore } from '@renderer/features/chat/store/chatStore'
import { emptyBackgroundState } from '../../src/shared/background-task'
import type { HistoryPageReply, HistoryQuery } from '../../src/shared/history-page'
import { overlapsMeasurement } from './observation.mjs'
import { selectBodyText, verifyBody } from './semantics'
import appCss from '@renderer/styles/app.css?inline'

const params = new URLSearchParams(location.search)
const backend = params.get('screen') === 'claude-code' ? 'claude' : 'opencode'
const input = params.get('input')
const id = 'body-' + input
interface Meta {
  characters: number
  utf8Bytes: number
  bytes: number
}
interface BodyBridge {
  meta(): Promise<Meta>
  page(query: HistoryQuery & { requestId: number }): Promise<HistoryPageReply>
  delta(offset: number): Promise<string>
  expected(offset: number): Promise<string>
}
const bridge = (window as Window & typeof globalThis & { bodyProbe: BodyBridge }).bodyProbe
const meta = await bridge.meta()
let delivered = 0
let requests = 0
let start = Infinity
const phases: { name: string; at: number }[] = []
function phase(name: string): void {
  if (!phases.some((p) => p.name === name)) phases.push({ name, at: performance.now() })
}
interface LongFrame extends PerformanceEntry {
  styleAndLayoutStart: number
  scripts: readonly {
    invoker: string
    duration: number
    forcedStyleAndLayoutDuration: number
  }[]
}
const tasks: PerformanceEntry[] = []
let lost = 0
const supported = PerformanceObserver.supportedEntryTypes.includes('longtask')
const observer = new PerformanceObserver(
  (list, _observer, options?: { droppedEntriesCount?: number }) => {
    lost += options?.droppedEntriesCount ?? 0
    tasks.push(...list.getEntries())
  }
)
if (supported) observer.observe({ type: 'longtask', buffered: true })
const loaf = PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
  ? new PerformanceObserver((list) => tasks.push(...list.getEntries()))
  : undefined
loaf?.observe({ type: 'long-animation-frame', buffered: true })
let resolveBody!: () => void
const startBody = new Promise<void>((resolve) => {
  resolveBody = resolve
})
Object.assign(window, {
  oo: {
    settings: { set: async () => ({}) },
    chat: { backgroundState: async () => emptyBackgroundState() },
    session: {
      load: async () => ({
        id,
        backend,
        agentKind: 'code',
        title: id,
        complete: false,
        messages:
          input === 'B3'
            ? []
            : [
                {
                  id: 'message',
                  role: 'assistant',
                  createdAt: 1,
                  parts: [],
                  deferredBody: {
                    kind: 'parts',
                    session: id,
                    generation: 'g',
                    message: 'message',
                    bytes: meta.bytes
                  }
                }
              ],
        history: { generation: 'g' }
      }),
      refresh: async () => ({ status: 'unchanged' }),
      cancelLoad: () => {},
      page: async (q: HistoryQuery) => {
        const requestId = ++requests
        if (q.kind === 'target')
          return {
            status: 'useCached',
            sessionId: id,
            openGeneration: q.openGeneration,
            requestId,
            generation: 'g',
            messageKey: q.locator.projectedKey
          }
        if (q.kind !== 'body') throw Error('unexpected ' + q.kind)
        await startBody
        const reply = await bridge.page({ ...q, requestId })
        if (
          reply.status !== 'body' ||
          reply.requestId !== requestId ||
          reply.offset !== delivered ||
          reply.openGeneration !== q.openGeneration
        )
          throw Error('Body sequence mismatch')
        if (!delivered) {
          start = performance.now()
          phase('first input')
        }
        delivered = reply.nextOffset
        if (reply.done) phase('last page')
        return reply
      }
    }
  }
})
const style = document.createElement('style')
style.textContent =
  appCss + '\nbody {margin:0} #root {height:100vh;display:flex;flex-direction:column}'
document.head.appendChild(style)
await chatActions.loadSession(id)
// eslint-disable-next-line react-refresh/only-export-components -- Standalone Electron probe entry point.
function Screen(): React.JSX.Element {
  const state = useChatStore((s) => s.sessions[id].session)
  return (
    <HarnessScrollController
      backend={backend}
      sessionKey={id}
      sessionId={id}
      messages={state.messages}
      sendCount={0}
      inflight={state.inflight}
    >
      {(scroll) => (
        <TranscriptView
          {...scroll}
          backend={backend}
          agentKind="code"
          messages={state.messages}
          pendingSteer={[]}
          inflight={state.inflight}
          loadingSession={false}
        />
      )}
    </HarnessScrollController>
  )
}
const root = createRoot(document.querySelector('#root')!)
flushSync(() => root.render(<Screen />))
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
// The native result must overlap the marker in the message actually revealed by app search.
// Keep that same row after the temporary highlight expires or another tail is mounted.
let revealedRow: HTMLElement | undefined
function revealedMarker(): Element | undefined {
  if (!revealedRow?.isConnected) return
  const documentNode = revealedRow.querySelector('[data-markdown-document="complete"]')
  if (!documentNode || documentNode.querySelector('[data-md-block-pending],[data-md-block-error]'))
    return
  const markers = documentNode.querySelectorAll('strong')
  return markers.length === 1 && markers[0].textContent === '완료' ? markers[0] : undefined
}
async function settledMarker(): Promise<DOMRect | null> {
  const deadline = performance.now() + 10000
  let last: DOMRect | undefined
  let count = 0
  while (performance.now() < deadline) {
    await frame()
    const marker = revealedMarker()
    if (!marker) {
      count = 0
      continue
    }
    const range = document.createRange()
    range.selectNodeContents(marker)
    const rect = range.getBoundingClientRect()
    if (
      last &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.x === last.x &&
      rect.y === last.y &&
      rect.width === last.width &&
      rect.height === last.height
    ) {
      if (++count === 4) return rect
    } else count = 0
    last = rect
  }
  return null
}
async function revealBody(): Promise<boolean> {
  let streamedText: string | undefined
  if (input === 'B3') {
    const live = useChatStore.getState().sessions[id].live
    streamedText = live.text
    ingestChatEvent({
      type: 'message.completed',
      sessionId: id,
      message: { text: live.text },
      messageKey: 'message',
      messageKeySource: 'owner'
    })
    ingestChatEvent({ type: 'turn.ended', sessionId: id })
    ingestChatEvent({ type: 'telemetry', sessionId: id })
    if (useChatStore.getState().sessions[id].live.text) return false
  }
  const entry = useChatStore.getState().sessions[id]
  const target = entry.session.messages.at(-1)?.id
  if (!target) return false
  const opened = await chatActions.openSearchHit(
    { v: 1, session: id, source: 'local', epoch: 'g', identity: target, projectedKey: target },
    false
  )
  if (!opened) return false
  for (let i = 0; i < 40; i++) {
    await frame()
    const highlighted = document.querySelector<HTMLElement>('[data-history-highlight]')
    if (
      highlighted &&
      highlighted.closest<HTMLElement>('[data-message-id]')?.dataset.messageId === target &&
      useChatStore.getState().sessions[id].search?.target === target
    ) {
      revealedRow = highlighted
      if (!(await settledMarker())) return false
      if (streamedText !== undefined) {
        const paragraphs = highlighted.querySelectorAll('[data-markdown-document="complete"] p')
        return (
          paragraphs.length === 1 &&
          paragraphs[0].textContent === streamedText.slice(0, -6) + '완료'
        )
      }
      return true
    }
  }
  return false
}
async function measure(budget: number): Promise<unknown> {
  if (params.has('calibrate')) {
    await tick()
    const from = performance.now()
    while (performance.now() - from < 80) {
      /* isolated positive control */
    }
    for (let i = 0; i < 4; i++) await frame()
    tasks.push(...observer.takeRecords())
    observer.disconnect()
    loaf?.disconnect()
    return {
      supported,
      lost,
      calibration: tasks.some(
        (e) =>
          e.entryType === 'longtask' && e.startTime <= from && e.startTime + e.duration >= from + 70
      )
    }
  }
  let changed = true
  const watch = new MutationObserver(() => {
    changed = true
  })
  watch.observe(document.querySelector('#root')!, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'data-markdown-document',
      'data-markdown-tail-parsed',
      'data-md-block-pending'
    ]
  })
  if (input === 'B3') {
    while (delivered < meta.characters) {
      const text = await bridge.delta(delivered)
      if (!text.length) throw Error('Missing delta')
      if (!delivered) {
        start = performance.now()
        phase('first input')
      }
      ingestChatEvent({
        type: 'message.delta',
        sessionId: id,
        messageKey: 'message',
        delta: { text }
      })
      delivered += text.length
      if (delivered === meta.characters) phase('last delta')
      await frame()
    }
  } else resolveBody()
  let stable = 0
  const deadline = performance.now() + budget
  let documentNode: HTMLElement | null = null
  while (performance.now() < deadline && stable < 10) {
    await frame()
    if (!documentNode?.isConnected)
      documentNode = document.querySelector(
        input === 'B3' ? '[data-markdown-tail]' : '[data-markdown-document]'
      )
    const revision =
      input === 'B3'
        ? documentNode?.dataset.markdownTailParsed === String(meta.characters)
        : documentNode?.dataset.markdownDocument === 'complete'
    if (documentNode) phase('markdown mounted')
    if (revision) phase('final render')
    stable = revision && !changed ? stable + 1 : 0
    changed = false
  }
  const end = performance.now()
  const stage = (at: number): string => phases.findLast((p) => p.at <= at)?.name ?? 'first input'
  const done = documentNode?.querySelector('strong')?.textContent === '완료'
  const pending = documentNode?.querySelectorAll(
    '[data-md-block-pending],[data-md-block-error]'
  ).length
  for (let i = 0; i < 2; i++) {
    await tick()
    await frame()
  }
  const lateMutation = changed || watch.takeRecords().length > 0
  watch.disconnect()
  tasks.push(...observer.takeRecords(), ...(loaf?.takeRecords() ?? []))
  observer.disconnect()
  loaf?.disconnect()
  const overlapping = tasks.filter((e) => overlapsMeasurement(e, start, end))
  return {
    screen: params.get('screen'),
    input,
    run: Number(params.get('run')),
    supported,
    lost,
    start,
    end,
    stable,
    delivered,
    pending,
    viewport: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
    lateMutation,
    complete: !!done && pending === 0 && stable === 10 && !lateMutation,
    phases,
    longtask: overlapping
      .filter((e) => e.entryType === 'longtask')
      .map((e) => ({
        start: e.startTime,
        duration: e.duration,
        from: stage(e.startTime),
        to: stage(e.startTime + e.duration)
      })),
    longAnimationFrame: overlapping
      .filter((e) => e.entryType === 'long-animation-frame')
      .map((entry) => {
        const f = entry as LongFrame
        return {
          start: f.startTime,
          duration: f.duration,
          styleAndLayoutStart: f.styleAndLayoutStart,
          scripts: f.scripts.map((s) => ({
            invoker: s.invoker,
            duration: s.duration,
            forcedLayout: s.forcedStyleAndLayoutDuration
          }))
        }
      })
  }
}
Object.assign(window, {
  measureBody: measure,
  revealBody,
  selectBodyText: () => selectBodyText(input!),
  markerRect: async () => {
    const rect = await settledMarker()
    let viewport = revealedRow?.closest<HTMLElement>('[data-transcript-viewport]')
    while (viewport && !['auto', 'scroll'].includes(getComputedStyle(viewport).overflowY))
      viewport = viewport.parentElement
    if (!rect || !viewport) return null
    return {
      ...rect.toJSON(),
      scrollTop: viewport.scrollTop,
      scrollLeft: viewport.scrollLeft,
      scrollViewport: viewport.getBoundingClientRect().toJSON(),
      viewportWidth: innerWidth,
      viewportHeight: innerHeight
    }
  },
  verifyBody: () =>
    verifyBody(
      input!,
      meta.characters,
      bridge.expected,
      input === 'B3'
        ? useChatStore.getState().sessions[id].live.text
        : useChatStore
            .getState()
            .sessions[id].session.messages.flatMap((m) => m.parts)
            .filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('')
    )
})
