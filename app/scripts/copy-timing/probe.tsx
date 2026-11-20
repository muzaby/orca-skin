import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import { initialChatState } from '@renderer/features/chat/reducer/chatReducer'
import { useChatStore } from '@renderer/features/chat/store/chatStore'
import { createDiagnosticDevApi } from '@renderer/features/chat/dev/transcriptFixtures'
import { SELECTION_COPY_SYNC_MAX_BLOCKS as cap } from '@renderer/features/chat/lib/transcript/viewport/copy'
import appCss from '@renderer/styles/app.css?inline'

const style = document.createElement('style')
style.textContent = appCss + '\nhtml, body, #root { height: 600px; width: 900px; }'
document.head.appendChild(style)
const frame = (): Promise<void> =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const api = createDiagnosticDevApi()

const params = new URLSearchParams(location.search)
const [backend, agentKind] = params.get('screen')!.split('-') as [
  'claude' | 'opencode',
  'code' | 'work'
]
const screen = backend + '-' + agentKind
const candidate = Number(params.get('candidate')) || undefined
// Only candidate discovery overrides the viewport prop. Constant runs use the product default.
Object.assign(globalThis, { copyCandidate: candidate })
const limit = candidate ?? cap
const sizes = candidate ? [limit, 2 * limit + 1] : [limit, limit + 1, 2 * limit + 1, 2500, 5000]
let observeWrite: ((result: Promise<void>) => void) | undefined
let lastWrite: Promise<void> | undefined
const write = navigator.clipboard.write.bind(navigator.clipboard)
navigator.clipboard.write = (items) => {
  const result = write(items)
  observeWrite?.(result)
  return result
}
const key = 'time-' + screen
const session = { ...initialChatState, sessionId: key, backend, agentKind }
useChatStore.setState({
  activeKey: key,
  sessions: {
    [key]: {
      session,
      live: { text: '', reasoning: '', reasoningVisible: false },
      subagentMeta: {}
    }
  }
})
export function Screen(): React.JSX.Element {
  const state = useChatStore((s) => s.sessions[key].session)
  return (
    <TranscriptView
      backend={backend}
      agentKind={agentKind}
      messages={state.messages}
      inflight={false}
      loadingSession={false}
      anchored={false}
      pendingSteer={[]}
      scrollRef={React.useRef(null)}
      contentRef={React.useRef(null)}
      onScroll={() => {}}
    />
  )
}
const root = createRoot(document.querySelector('#root')!)
flushSync(() => root.render(<Screen />))
api.loadFixture('long', { turns: 1, minBlocks: Math.max(...sizes) + 40 })
await frame()
await frame()
const viewport = document.querySelector<HTMLElement>('[data-transcript-viewport]')!
viewport.tabIndex = -1
viewport.focus({ preventScroll: true })

let trusted = false
Object.assign(globalThis, {
  cap,
  async select(size: number) {
    let selected = false

    for (let offset = 0; offset < 32; offset++) {
      if (
        api.selectBlocks(offset, offset + size - 1, { partialEnds: true }) &&
        api.selectionInfo().blockCount === size
      ) {
        selected = true
        break
      }
    }
    if (!selected)
      throw new Error(
        'No selectable endpoints for ' + screen + ' ' + size + ' in ' + api.blockCount()
      )
    await frame()
    await frame()
    observeWrite = undefined
    lastWrite =
      size > limit
        ? new Promise<void>((resolve) => {
            observeWrite = resolve
          })
        : undefined

    trusted = false
    viewport.addEventListener(
      'copy',
      (event) => {
        trusted = event.isTrusted
      },
      { once: true }
    )
  },
  async timings(size: number) {
    if (!trusted) throw new Error('Missing native copy event')
    if (size > limit) {
      // Wait outside the measured tasks without scheduling a frame for every chunk.
      let timer: number | undefined
      try {
        await Promise.race([
          lastWrite,
          new Promise<never>((_, reject) => {
            timer = window.setTimeout(() => reject(new Error('Clipboard write timed out')), 120000)
          })
        ])
      } finally {
        window.clearTimeout(timer)
      }
    }
    const records = api.copyTimings()
    await frame()
    await frame()
    return records
  }
})
