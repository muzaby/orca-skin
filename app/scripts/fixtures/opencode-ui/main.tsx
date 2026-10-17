import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../../src/renderer/src/styles/app.css'
import '../../../src/renderer/src/shared/i18n'
import { ChatTile } from '../../../src/renderer/src/features/chat/components/ChatTile'
import {
  ingestChatEvent,
  useChatStore,
  useChatSession
} from '../../../src/renderer/src/features/chat/store/chatStore'
import {
  TweakProvider,
  useTweakContext
} from '../../../src/renderer/src/shared/theme/TweakProvider'
import { installNativeFixture, nativeCalls } from './native'
import {
  appendInactiveDelta,
  requestQueue,
  resetScenario,
  scenarios,
  startTurn,
  swapSession,
  updateTodos,
  type Scenario
} from './scenarios'

installNativeFixture()
resetScenario('long-history-selection')

export function App(): React.JSX.Element {
  const [scenario, setScenario] = useState<Scenario>('long-history-selection')
  const [streaming, setStreaming] = useState(false)
  const [metrics, setMetrics] = useState('측정 버튼으로 실제 DOM의 좌표와 선택을 기록합니다.')
  const [narrow, setNarrow] = useState(false)
  const theme = useTweakContext((t) => t.theme)
  const size = useTweakContext((t) => t.transcriptTextSize)
  const session = useChatSession((s) => s)
  const sequence = useRef(0)

  const appendDelta = (): void => {
    ingestChatEvent({
      type: 'message.delta',
      sessionId: useChatStore.getState().activeKey,
      delta: {
        text: `\n새 출력 ${++sequence.current}: 스크롤 위치와 선택을 유지하는지 확인합니다.\n`
      }
    })
  }
  useEffect(() => {
    if (!streaming) return
    const timer = window.setInterval(() => {
      ingestChatEvent({
        type: 'message.delta',
        sessionId: useChatStore.getState().activeKey,
        delta: { text: `\n스트리밍 ${++sequence.current}: 과거 본문을 읽는 중입니다.\n` }
      })
    }, 400)
    return () => window.clearInterval(timer)
  }, [streaming])

  const measure = (): void => {
    const viewport = document.querySelector<HTMLElement>('.app-frame-transcript')
    const bounds = viewport?.getBoundingClientRect()
    const rows = [...document.querySelectorAll<HTMLElement>('[data-timeline-key]')]
    const visible = rows
      .filter((node) => {
        const box = node.getBoundingClientRect()
        return bounds && box.bottom > bounds.top && box.top < bounds.bottom
      })
      .map((node) => ({ key: node.dataset.timelineKey, y: node.getBoundingClientRect().top }))
    const composer = document.querySelector<HTMLElement>('.app-frame-composer')
    setMetrics(
      JSON.stringify(
        {
          scenario,
          session: session.sessionId,
          scrollTop: viewport?.scrollTop,
          scrollHeight: viewport?.scrollHeight,
          clientHeight: viewport?.clientHeight,
          visible,
          selection: window.getSelection()?.toString(),
          composerHeight: composer?.getBoundingClientRect().height,
          requests: {
            asks: session.pendingAsks.map((q) => q.requestId),
            approvals: session.pendingToolApprovals.map((p) => p.approvalId)
          },
          replies: nativeCalls.filter((call) => call.operation === 'permission.respond').slice(-5)
        },
        null,
        2
      )
    )
  }

  return (
    <main className="flex h-screen w-full flex-col bg-bg text-ink [font-family:var(--font-app)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 text-caption">
        <strong>0262 UI 검증</strong>
        <select
          aria-label="검증 시나리오"
          value={scenario}
          className="bg-surface-primary"
          onChange={(e) => {
            const next = e.target.value as Scenario
            setStreaming(false)
            setScenario(next)
            resetScenario(next)
          }}
        >
          {scenarios.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <button onClick={() => resetScenario(scenario, 'claude')}>Claude</button>
        <button onClick={() => resetScenario(scenario, 'opencode')}>OpenCode</button>
        <button onClick={swapSession}>세션 A/B</button>
        <button onClick={() => theme.setTweak('theme', theme.t === 'white' ? 'dark' : 'white')}>
          테마: {theme.t}
        </button>
        <button onClick={() => setNarrow((v) => !v)}>너비 전환</button>
        <button
          onClick={() =>
            size.setTweak('transcriptTextSize', size.t === 'medium' ? 'large' : 'medium')
          }
        >
          글자 크기
        </button>
        <button onClick={measure}>측정</button>
      </div>
      <div className="flex flex-wrap gap-3 border-b border-border px-3 py-2 text-caption">
        <button onClick={startTurn}>턴 시작</button>
        <button onClick={appendDelta}>출력 추가</button>
        <button onClick={appendInactiveDelta}>비활성 출력 추가</button>
        <button onClick={() => setStreaming((v) => !v)}>
          {streaming ? '스트리밍 정지' : '스트리밍 시작'}
        </button>
        <button onClick={() => requestQueue()}>질문→승인→질문</button>
        <button onClick={() => requestQueue(true)}>승인→질문→질문</button>
        <button onClick={() => updateTodos(false)}>Todo 진행</button>
        <button onClick={() => updateTodos(true)}>Todo 완료</button>
        <span data-fixture-session>
          {session.backend} / {session.sessionId}
        </span>
      </div>
      <div className={`mx-auto flex min-h-0 w-full flex-1 ${narrow ? 'max-w-[460px]' : ''}`}>
        <ChatTile
          backendLabel={session.backend === 'opencode' ? 'OpenCode' : 'Claude'}
          canAbort={true}
          initialDraft="보존할 초안"
        />
      </div>
      <details className="max-h-48 shrink-0 overflow-auto border-t border-border px-3 text-caption">
        <summary>측정값 · 실제 컴포넌트 / 메모리 IPC / 외부 모델 호출 없음</summary>
        <pre data-fixture-metrics className="whitespace-pre-wrap">
          {metrics}
        </pre>
      </details>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <TweakProvider>
      <App />
    </TweakProvider>
  </MemoryRouter>
)
