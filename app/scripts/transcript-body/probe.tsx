import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { HarnessScrollController } from '@renderer/features/chat/components/transcript/HarnessScrollController'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import { chatActions, useChatStore } from '@renderer/features/chat/store/chatStore'
import { emptyBackgroundState } from '../../src/shared/background-task'
import { HISTORY_BODY_BYTES, type HistoryQuery } from '../../src/shared/history-page'
import appCss from '@renderer/styles/app.css?inline'

const params = new URLSearchParams(location.search)
const backend = params.get('screen') === 'claude-code' ? 'claude' : 'opencode'
const input = params.get('input')
const id = 'body-' + input
const marker = '**완료**'
function fixture(): string {
  if (input === 'B1') return '가나다 라마바 '.repeat(210000) + marker
  if (input === 'B2') {
    const wide = (s: string): string => '|' + Array(600).fill(s).join('|') + '|\n'
    const body = [
      'p'.repeat(200) + '\n\n',
      '\n```ts\nlet n = 1\n```\n'.repeat(40),
      '|a|b|\n|-|-|\n' + '|c|d|\n'.repeat(2001),
      wide('a') + wide('-') + wide('b'),
      '- Item\n'.repeat(30000),
      'Note[^1]\n\n[^1]: footnote'
    ]
    body[0] = body[0].repeat(3000)
    const content = body.join('\n\n')
    return (
      content +
      '\n\n' +
      'x'.repeat(Math.max(0, 1024 * 1024 - content.length - marker.length - 4)) +
      '\n\n' +
      marker
    )
  }
  if (input === 'B3') return 'stream '.repeat(7200) + marker
  if (input === 'B4') return '`code` [link](https://example.org) '.repeat(12500) + marker
  if (input === 'B5')
    return (
      ('a '.repeat(8190) + '\n\n').repeat(2442).slice(0, 40000000 - marker.length - 2) +
      '\n\n' +
      marker
    )
  throw Error('Unknown input')
}
const source = fixture()
const bytes = new TextEncoder().encode(JSON.stringify([{ type: 'text', text: source }]))
const chunks: string[] = []
for (let offset = 0; offset < bytes.length; offset += HISTORY_BODY_BYTES) {
  const chunk = bytes.subarray(offset, offset + HISTORY_BODY_BYTES)
  let binary = ''
  for (let i = 0; i < chunk.length; i += 8192)
    binary += String.fromCharCode(...chunk.subarray(i, i + 8192))
  chunks.push(btoa(binary))
}
let start = Infinity
const tasks: PerformanceEntry[] = []
const observer = new PerformanceObserver((list) => tasks.push(...list.getEntries()))
observer.observe({ entryTypes: ['longtask', 'long-animation-frame'] })
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
                    bytes: bytes.length
                  }
                }
              ],
        history: { generation: 'g' }
      }),
      refresh: async () => ({ status: 'unchanged' }),
      page: async (q: HistoryQuery) => {
        if (q.kind !== 'body') throw Error('unexpected ' + q.kind)
        await startBody
        if (!q.offset) start = performance.now()
        const nextOffset = Math.min(q.offset + HISTORY_BODY_BYTES, bytes.length)
        return {
          status: 'body',
          sessionId: id,
          offset: q.offset,
          openGeneration: q.openGeneration,
          requestId: 1,
          base64: chunks[q.offset / HISTORY_BODY_BYTES],
          nextOffset,
          done: nextOffset === bytes.length
        }
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
      inflight={input === 'B3'}
    >
      {(scroll) => (
        <TranscriptView
          {...scroll}
          backend={backend}
          agentKind="code"
          messages={state.messages}
          pendingSteer={[]}
          inflight={input === 'B3'}
          loadingSession={false}
        />
      )}
    </HarnessScrollController>
  )
}
const root = createRoot(document.querySelector('#root')!)
flushSync(() => root.render(<Screen />))
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))
function copyAcrossProseWrap(): boolean {
  const group = document.querySelector('[data-markdown-prose-group]')
  const first = group?.firstChild
  const next = group?.nextElementSibling?.firstChild
  const selection = window.getSelection()
  if (!(first instanceof Text) || !(next instanceof Text) || !selection) return false
  const range = document.createRange()
  range.setStart(first, Math.max(0, first.length - 12))
  range.setEnd(next, Math.min(12, next.length))
  selection.removeAllRanges()
  selection.addRange(range)
  const copied = selection.toString()
  selection.removeAllRanges()
  return copied.length > 0 && copied === range.cloneContents().textContent
}
async function measure(): Promise<unknown> {
  await frame()
  if (input === 'B3') {
    start = performance.now()
    for (let end = 4100; ; end += 8000) {
      useChatStore.setState((s) => ({
        sessions: {
          ...s.sessions,
          [id]: {
            ...s.sessions[id],
            live: { ...s.sessions[id].live, text: source.slice(0, end), textKey: 'part' }
          }
        }
      }))
      if (end >= source.length) break
      await frame()
    }
  } else resolveBody()
  let stable = 0
  let changed = true
  const watch = new MutationObserver(() => {
    changed = true
  })
  watch.observe(document.querySelector('#root')!, {
    childList: true,
    subtree: true,
    characterData: true
  })
  const deadline = performance.now() + 180000
  let complete = false
  while (performance.now() < deadline && stable < 10) {
    await frame()
    if (changed || !complete) {
      // Only scan when the tree changed, and wait for the final formatted token.
      complete =
        !document.querySelector(
          '[data-md-block-pending],[data-md-block-error],[data-history-body]'
        ) &&
        Array.from(document.querySelectorAll('strong')).some((el) => el.textContent === '완료') &&
        (input !== 'B3' ||
          document
            .querySelector('[data-markdown-tail="parsed"]')
            ?.getAttribute('data-markdown-tail-parsed') === String(source.length))
      stable = 0
      changed = false
    }
    if (complete) stable++
  }
  watch.disconnect()
  const end = performance.now()
  await frame()
  tasks.push(...observer.takeRecords())
  observer.disconnect()
  const durations = (kind: string): number[] =>
    tasks
      .filter((e) => e.entryType === kind && e.startTime + e.duration > start && e.startTime < end)
      .map((e) => e.duration)
  return {
    complete: complete && stable === 10,
    ...(input === 'B1' && { selectionMatches: copyAcrossProseWrap() }),
    characters: source.length,
    bytes: bytes.length,
    longtask: durations('longtask'),
    longAnimationFrame: durations('long-animation-frame'),
    duration: end - start
  }
}
Object.assign(window, { measureBody: measure })
