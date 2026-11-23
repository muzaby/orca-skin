import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import { transcriptHarness } from '@renderer/features/chat/harnesses/registries/transcript'
import { initialChatState } from '@renderer/features/chat/reducer/chatReducer'
import { ingestChatEvent, useChatStore } from '@renderer/features/chat/store/chatStore'
import { advanceStableBlocks } from '@renderer/features/chat/lib/markdownBlocks'
import {
  computeClient,
  setComputeClient,
  type ComputeClient
} from '@renderer/shared/compute/client'
import appCss from '@renderer/styles/app.css?inline'
import { STEPS } from './steps.mjs'

const style = document.createElement('style')
style.textContent = appCss + '\nhtml,body{margin:0}#root{display:flex;width:900px;height:560px}'
document.head.append(style)
const [backend, agentKind] = new URLSearchParams(location.search).get('screen')!.split('-') as [
  'claude' | 'opencode',
  'code' | 'work'
]
const key = 'streaming-' + backend + '-' + agentKind
useChatStore.setState({
  activeKey: key,
  sessions: {
    [key]: {
      session: {
        ...initialChatState,
        sessionId: key,
        backend,
        agentKind,
        inflight: true,
        turnStartedAt: 1
      },
      live: { text: '', reasoning: '', reasoningVisible: false },
      subagentMeta: {}
    }
  }
})
const { ScrollController } = transcriptHarness(backend)
export function Screen(): React.JSX.Element {
  const { messages, inflight, sendCount } = useChatStore((s) => s.sessions[key].session)
  return (
    <ScrollController
      sessionId={key}
      sessionKey={key}
      sendCount={sendCount}
      inflight={inflight}
      messages={messages}
    >
      {(scroll) => (
        <TranscriptView
          {...scroll}
          backend={backend}
          agentKind={agentKind}
          messages={messages}
          inflight={inflight}
          loadingSession={false}
          pendingSteer={[]}
        />
      )}
    </ScrollController>
  )
}
const client = computeClient()
let release: (() => void) | undefined
let gate: Promise<void> | undefined
const delegated: ComputeClient = {
  ...client,
  request(request, options) {
    const handle = client.request(request, options)
    const held = request.kind === 'markdown' && gate
    if (!held) return handle
    return {
      ...handle,
      promise: handle.promise.then(async (result) => {
        await held
        return result
      })
    }
  }
}
setComputeClient(delegated)
const root = createRoot(document.getElementById('root')!)
flushSync(() => root.render(<Screen />))

const paragraphs =
  Array.from({ length: 40 }, (_, i) =>
    Array.from(
      { length: 3 },
      (_, j) =>
        'C' + String(i + 1).padStart(2, '0') + '-' + (j + 1) + ' ' + 'reading text '.repeat(5)
    ).join('\n')
  ).join('\n\n') + '\n\n'
const longTail = Array.from(
  { length: 625 },
  (_, i) =>
    ('T' + String(i + 1).padStart(5, '0') + ' ' + 'word '.repeat(14) + ' x').padEnd(79, '.') + '\n'
).join('')
let source = ''
let anchor = ''

const frame = (): Promise<void> =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const scroller = (): HTMLElement =>
  document.querySelector<HTMLElement>('[data-behavior="virtualizable"]')!
const row = (): HTMLElement | undefined =>
  [...document.querySelectorAll<HTMLElement>('[data-block-key]')].find((el) =>
    el.textContent?.includes('C01-1')
  )
function bodyText(el: HTMLElement | undefined): string {
  if (!el) return ''
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-transcript-chrome]').forEach((node) => node.remove())
  return clone.textContent ?? ''
}
function rectOf(marker: string): DOMRect | undefined {
  const el = row()
  if (!el || !marker) return undefined
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const start = node.textContent!.indexOf(marker)
    if (start < 0) continue
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, start + marker.length)
    return range.getBoundingClientRect()
  }
  return undefined
}
const markerPattern = /C\d{2}-[123]|T\d{5}|F\d{4}/g
const stamp = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-markdown-tail]')
function view(): { view: string | null; parsedChars: number | null } {
  const el = stamp()
  return {
    view: el?.dataset.markdownTail ?? null,
    parsedChars: el?.dataset.markdownTailParsed ? Number(el.dataset.markdownTailParsed) : null
  }
}
// Install the observer before dispatch. A state marker can already match at consecutive
// steps, so also require the newest sent marker and a mutation from this commit.
async function advance(step: string): Promise<void> {
  const spec = STEPS.find((s) => s.step === step)!
  let delta = ''
  if (step === 'sync@4000') delta = paragraphs + longTail.slice(0, 4000)
  if (step === 'enter@4001') {
    gate = new Promise((resolve) => {
      release = resolve
    })
    delta = longTail.slice(4000, 4001)
  }
  if (step === 'parsed@50000') delta = longTail.slice(4001, 50000)
  if (step === 'final@50001') delta = '.'
  if (step === 'finalized') delta = '\n\nF0001.\n'
  if (step === 'after') delta = 'F0002.\nF0003.\nF0004.\n'
  source += delta
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect()
      reject(
        new Error(
          'no worker result: ' +
            step +
            ' ' +
            JSON.stringify(view()) +
            ' ' +
            bodyText(row()).slice(-100)
        )
      )
    }, 5000)
    const observer = new MutationObserver(() => {
      if (step === 'completed' && useChatStore.getState().sessions[key].live.text !== '') return
      const actual = view()
      const latest = source.match(markerPattern)?.at(-1)
      if (
        actual.view !== spec.view ||
        actual.parsedChars !== spec.parsedChars ||
        !latest ||
        !bodyText(row()).includes(latest)
      )
        return
      clearTimeout(timer)
      observer.disconnect()
      resolve()
    })
    observer.observe(document.getElementById('root')!, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    })
    if (delta) {
      if (step === 'after') {
        for (const line of delta.match(/[^\n]+\n/g)!)
          ingestChatEvent({ type: 'message.delta', sessionId: key, delta: { text: line } })
      } else ingestChatEvent({ type: 'message.delta', sessionId: key, delta: { text: delta } })
    }
    if (step === 'parsed@4001') {
      release?.()
      gate = undefined
    }
    if (step === 'completed') {
      ingestChatEvent({ type: 'message.completed', sessionId: key, message: { text: source } })
    }
  })
  await frame()
  await frame()
}
function locateReadingPosition(): { tailBelow: boolean; rowTopAbove: boolean; anchor: string } {
  const bounds = scroller().getBoundingClientRect()
  const tailBelow = (rectOf('T00001')?.top ?? -Infinity) >= bounds.bottom + 1
  const rowTopAbove = (row()?.getBoundingClientRect().top ?? Infinity) < bounds.top
  if (tailBelow && rowTopAbove) {
    anchor =
      (paragraphs.match(markerPattern) ?? []).find(
        (m) =>
          (rectOf(m)?.top ?? -Infinity) >= bounds.top &&
          (rectOf(m)?.top ?? Infinity) < bounds.bottom
      ) ?? ''
  }
  return { tailBelow, rowTopAbove, anchor }
}
function observe(step: string): Record<string, unknown> {
  const el = scroller()
  const bounds = el.getBoundingClientRect()
  const expected = source.match(markerPattern) ?? []
  const latest = expected.at(-1)!
  const positions = bodyText(row()).match(markerPattern) ?? []
  const counts = new Map<string, number>()
  for (const mark of positions) counts.set(mark, (counts.get(mark) ?? 0) + 1)
  const rect = rectOf(latest)
  const split = advanceStableBlocks(null, source)
  const firstParagraph = row()?.querySelector('p')
  const stream = firstParagraph?.parentElement?.parentElement
  const stableBlocks = stream?.classList.contains('gap-2') ? stream.childElementCount - 1 : null
  return {
    step,
    ...view(),
    tailLength:
      step === 'completed' && useChatStore.getState().sessions[key].live.text === ''
        ? null
        : split.tail.length,
    stableBlocks,
    bottomDistance: el.scrollHeight - el.clientHeight - el.scrollTop,
    latestPresent: counts.has(latest),
    latestVisible: !!rect && rect.top >= bounds.top - 0.5 && rect.bottom <= bounds.bottom + 0.5,
    offset: anchor && rectOf(anchor) ? rectOf(anchor)!.top - bounds.top : null,
    missing: expected.filter((m) => !counts.has(m)),
    duplicated: expected.filter((m) => (counts.get(m) ?? 0) > 1)
  }
}
Object.assign(window, { probe: { advance, locateReadingPosition, observe } })
