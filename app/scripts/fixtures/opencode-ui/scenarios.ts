import type { NormalizedEvent } from '../../../src/shared/ipc'
import {
  chatReducer,
  initialChatState,
  type ChatState,
  type Message
} from '../../../src/renderer/src/features/chat/reducer/chatReducer'
import {
  ingestChatEvent,
  useChatStore
} from '../../../src/renderer/src/features/chat/store/chatStore'

export const scenarios = [
  'long-history-selection',
  'streaming-unpin-repin',
  'resize-and-disclosure-anchor',
  'session-switch-anchor',
  'mixed-request-queue',
  'todo-dock-lifecycle'
] as const
export type Scenario = (typeof scenarios)[number]
let serial = 0
let scenarioEpoch = 0
let scenarioSessions: [string, string] = ['fixture-0-a', 'fixture-0-b']

function history(count: number): Message[] {
  return Array.from({ length: count }, (_, i): Message[] => [
    {
      role: 'user',
      createdAt: i * 2 + 1,
      parts: [
        {
          type: 'text',
          text: `${i + 1}번 요청: sample.md를 읽고 셸 출력과 변경 결과를 확인해 주세요.`
        }
      ]
    },
    {
      role: 'assistant',
      createdAt: i * 2 + 2,
      parts: [
        {
          type: 'text',
          text: `## ${i + 1}번 응답\n\n본문 드래그 선택과 읽던 위치를 확인합니다. **굵은 글자**, [참조](https://example.com), 줄바꿈을 포함합니다.`
        },
        { type: 'tool_call', toolRunId: `glob-${i}`, toolName: 'Glob', args: { pattern: '*.md' } },
        {
          type: 'tool_result',
          toolRunId: `glob-${i}`,
          result: 'sample.md\nREADME.md',
          isError: false
        },
        {
          type: 'tool_call',
          toolRunId: `read-${i}`,
          toolName: 'Read',
          args: { file_path: 'sample.md' }
        },
        {
          type: 'tool_result',
          toolRunId: `read-${i}`,
          result: '# Before\n테스트 문서',
          isError: false
        },
        {
          type: 'tool_call',
          toolRunId: `bash-${i}`,
          toolName: 'Bash',
          args: { command: 'fixture command (not executed)' }
        },
        {
          type: 'tool_result',
          toolRunId: `bash-${i}`,
          result: Array.from({ length: 22 }, (_, n) => `출력 ${n + 1}: 수신 로그 검증`).join('\n'),
          isError: false
        },
        {
          type: 'tool_call',
          toolRunId: `edit-${i}`,
          toolName: 'Edit',
          args: { file_path: 'sample.md', old_string: '# Before', new_string: '# After' }
        },
        {
          type: 'tool_result',
          toolRunId: `edit-${i}`,
          result: 'Updated sample.md',
          isError: false
        },
        {
          type: 'text',
          text: `검증 본문 ${i + 1} 종료. 카드 앞뒤의 텍스트 순서를 유지해야 합니다.`
        }
      ]
    }
  ]).flat()
}

export function resetScenario(
  scenario: Scenario,
  backend: 'opencode' | 'claude' = 'opencode'
): void {
  const state = useChatStore.getState()
  const base = state.sessions[state.activeKey]
  const messages = history(scenario === 'long-history-selection' ? 60 : 4)
  const epoch = ++scenarioEpoch
  scenarioSessions = [`fixture-${epoch}-a`, `fixture-${epoch}-b`]
  const entries = Object.fromEntries(
    scenarioSessions.map((sessionId) => {
      const session: ChatState = {
        ...initialChatState,
        backend,
        agentKind: 'code',
        sessionId,
        title: sessionId,
        agentKindLocked: true,
        agentPanelInitialized: true,
        cwd: 'C:/fixture',
        providerKey: `${backend}:fixture`,
        modelFamily: 'fixture',
        modelAlias: '검증 모델',
        messages,
        rightPanelTiles: []
      }
      return [
        sessionId,
        { ...base, session, live: { text: '', reasoning: '' }, subagentMeta: {}, pendingSteer: [] }
      ]
    })
  )
  useChatStore.setState({ sessions: entries, activeKey: scenarioSessions[0], draftRestore: null })
}

export function startTurn(): void {
  useChatStore.setState((state) => {
    const key = state.activeKey
    const entry = state.sessions[key]
    let session = chatReducer(entry.session, { type: 'BEGIN_TURN' })
    session = chatReducer(session, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: '현재 턴 UI 검증'
    })
    return { sessions: { ...state.sessions, [key]: { ...entry, session } } }
  })
}

export function requestQueue(permissionFirst = false): void {
  const sessionId = useChatStore.getState().activeKey
  const suffix = ++serial
  const question = (index: number): NormalizedEvent => ({
    type: 'permission.requested',
    sessionId,
    approvalId: `q-${suffix}-${index}`,
    origin: 'agent',
    action: {
      kind: 'ask_question',
      request: {
        requestId: `q-${suffix}-${index}`,
        questions: [
          {
            header: `질문 ${index}`,
            question: `대기열 질문 ${index}`,
            multiSelect: false,
            options: [
              { label: '진행', description: '검증용 선택' },
              { label: '보류', description: '검증용 선택' }
            ]
          }
        ]
      }
    }
  })
  const permission: NormalizedEvent = {
    type: 'permission.requested',
    sessionId,
    approvalId: `p-${suffix}`,
    origin: 'agent',
    action: { kind: 'tool_approval', toolName: 'Read', input: { file_path: 'sample.md' } }
  }
  const events = permissionFirst
    ? [permission, question(1), question(2)]
    : [question(1), permission, question(2)]
  events.forEach(ingestChatEvent)
}

export function updateTodos(complete: boolean): void {
  const sessionId = useChatStore.getState().activeKey
  const toolRunId = `todo-${++serial}`
  const todos = ['카드 표시', '접기 요약', '전체 완료'].map((content, i) => ({
    content,
    status: complete || i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'pending',
    priority: 'medium'
  }))
  ingestChatEvent({
    type: 'tool.call.started',
    sessionId,
    toolRunId,
    toolName: 'TodoWrite',
    args: { todos },
    providerTool: { name: 'todowrite', input: { todos } }
  })
  ingestChatEvent({
    type: 'tool.call.completed',
    sessionId,
    toolRunId,
    result: 'Todo updated',
    isError: false,
    structuredOutput: { todos }
  })
}

export function swapSession(): void {
  const key = useChatStore.getState().activeKey
  useChatStore.setState({
    activeKey: key === scenarioSessions[0] ? scenarioSessions[1] : scenarioSessions[0]
  })
}

export function appendInactiveDelta(): void {
  const activeKey = useChatStore.getState().activeKey
  const sessionId = scenarioSessions.find((key) => key !== activeKey)!
  ingestChatEvent({ type: 'message.delta', sessionId, delta: { text: '\n비활성 세션 출력\n' } })
}
