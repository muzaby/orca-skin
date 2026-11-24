import { baselineAnchor } from './baseline-anchor'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import { HarnessScrollController } from '@renderer/features/chat/components/transcript/HarnessScrollController'
import { chatActions, useChatStore } from '@renderer/features/chat/store/chatStore'
import { createHostPortClient } from '@renderer/shared/api/transport/host-port'
import { createSessionLoadClient } from '@renderer/shared/api/transport/session-load'
import { CHANNELS } from '../../src/shared/ipc'
import { emptyBackgroundState } from '../../src/shared/background-task'
import appCss from '@renderer/styles/app.css?inline'

const id = 'session-0'
const isBaseline = new URLSearchParams(window.location.search).get('phase') === 'baseline'
const data = createHostPortClient({ host: 'data', requestConnect: () => undefined })
const connected = new Promise<void>((resolve) => {
  function receive(event: MessageEvent): void {
    if (event.source !== window || event.data !== 'stage-e-port' || event.ports.length !== 1) return
    window.removeEventListener('message', receive)
    const port = event.ports[0]
    data.attachPort({
      postMessage: (msg) => port.postMessage(msg),
      onMessage: (fn) => {
        port.onmessage = (msg) => fn(msg.data)
      },
      close: () => port.close()
    })
    resolve()
  }
  window.addEventListener('message', receive)
})
const session = createSessionLoadClient({
  invoke: data.invoke,
  send: data.send,
  subscribe: data.on,
  channels: {
    load: CHANNELS.sessionLoad,
    page: isBaseline ? undefined : CHANNELS.sessionHistoryPage,
    refresh: CHANNELS.sessionRefresh,
    chunk: CHANNELS.sessionLoadChunk,
    cancel: CHANNELS.sessionLoadCancel
  }
})
Object.assign(window, {
  oo: {
    session: isBaseline ? session : { ...session, load: session.loadLatest },
    settings: { set: async () => ({}) },
    chat: { backgroundState: async () => emptyBackgroundState() }
  }
})
const style = document.createElement('style')
style.textContent =
  appCss + '\nbody {margin:0} #root {height:100vh; display:flex;flex-direction:column}'
document.head.appendChild(style)
const frame = (): Promise<number> =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve))
let open: Promise<void>
let started: number

// eslint-disable-next-line react-refresh/only-export-components -- Diagnostic renderer entry point.
function Screen(): React.JSX.Element {
  const state = useChatStore((store) => store.sessions[id]?.session)
  if (!state)
    return (
      <button
        onClick={() => {
          started = performance.now()
          open = chatActions.loadSession(id)
        }}
      >
        Open
      </button>
    )
  return (
    <HarnessScrollController
      backend="claude"
      sessionKey={id}
      sessionId={id}
      sendCount={0}
      messages={state.messages}
      inflight={false}
    >
      {(scroll) => (
        <TranscriptView
          {...scroll}
          backend="claude"
          agentKind="code"
          messages={state.messages}
          pendingSteer={[]}
          inflight={false}
          loadingSession={state.loadingSession}
        />
      )}
    </HarnessScrollController>
  )
}
const root = createRoot(document.querySelector('#root')!)
flushSync(() => root.render(<Screen />))
Object.assign(window, {
  baselineAnchor,
  async measureHistoryOpen() {
    await connected
    document.querySelector('button')!.click()
    let loadingFrameMs: number | null = null
    let loadingFrame = 0
    function observeLoading(): void {
      if (useChatStore.getState().sessions[id]?.session.loadingSession) {
        const viewport = document.querySelector('[data-behavior="virtualizable"]')
        if (viewport?.textContent?.trim()) loadingFrameMs = performance.now() - started
        else loadingFrame = requestAnimationFrame(observeLoading)
      }
    }
    loadingFrame = requestAnimationFrame(observeLoading)
    try {
      await open
    } finally {
      cancelAnimationFrame(loadingFrame)
    }
    const receivedMessages = useChatStore.getState().sessions[id]?.session.messages.length
    if (!receivedMessages) throw Error('No messages committed by loadSession')
    for (let i = 0; i < 300; i++) {
      await frame()
      const viewport = document.querySelector<HTMLElement>('[data-behavior="virtualizable"]')
      const bounds = viewport?.getBoundingClientRect()
      const body = Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]')).find(
        (row) => {
          if (!bounds || !row.textContent?.includes('fixture message ')) return false
          const rect = row.getBoundingClientRect()
          return rect.height > 0 && rect.bottom > bounds.top && rect.top < bounds.bottom
        }
      )
      if (body) {
        const firstBodyId = body.dataset.messageId
        await frame()
        return {
          receivedMessages,
          loadingFrameMs,
          visible: true,
          firstBodyId,
          clickToBodyFrameMs: performance.now() - started
        }
      }
    }
    throw Error('No fixture body visible within 300 frames')
  }
})
