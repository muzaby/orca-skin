// 0319 W1 — 백그라운드 타일 카드 세 종의 키·클릭 열기 계약을 실제 렌더에서 꺼낸 처리기로 본다.
// 카드 안 버튼(전환·중단)에서 올라온 Enter·Space 는 카드를 열지 않고 기본 동작도 막지 않아야 버튼이 눌린다.
//
// 처리기는 `react/jsx-runtime` 을 감싸 렌더 중 props 를 기록해 꺼낸다(ForegroundShellActions 선례) —
// 카드 틀이 어느 컴포넌트에 있든 `role="button"` 노드를 찾으므로 구조와 무관하게 같은 단언이 돈다.
// 처리기·판정은 mock 하지 않는다. 정본 카드의 store 선택 함수만 기록용으로 바꾼다.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SubAgentTaskList } from '../../claude/rightpanel/LegacySubAgentTile'
import {
  BackgroundTaskCard,
  CanonicalBackgroundContent
} from '../../claude/rightpanel/CanonicalBackgroundContent'
import { subagentTasksFromMessages } from '../../../lib/parts'
import { chatActions, useChatStore } from '../../../store/chatStore'
import { selectBackgroundItem, useBackgroundStore } from '../../../store/backgroundStore'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState,
  type BackgroundSessionState
} from '../../../../../../../shared/background-task'
import type { Message } from '../../../reducer/chatReducer'

type Props = Record<string, unknown>
const recorded = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }))

vi.mock('react/jsx-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-runtime')>()
  return {
    ...actual,
    jsx: (type: Parameters<typeof actual.jsx>[0], props: Props, key?: string) => {
      recorded.props.push(props)
      return actual.jsx(type, props, key)
    },
    jsxs: (type: Parameters<typeof actual.jsxs>[0], props: Props, key?: string) => {
      recorded.props.push(props)
      return actual.jsxs(type, props, key)
    }
  }
})
vi.mock('react/jsx-dev-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-dev-runtime')>()
  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      recorded.props.push(args[1] as Props)
      return actual.jsxDEV(...args)
    }
  }
})
vi.mock('../../../store/backgroundStore', async (original) => ({
  ...(await original<typeof import('../../../store/backgroundStore')>()),
  selectBackgroundItem: vi.fn()
}))

function cards(render: () => void): Props[] {
  recorded.props = []
  render()
  return recorded.props.filter((props) => props.role === 'button')
}

// 실행 중 작업 1건 — 구 카드는 전환·중단 버튼을 함께 그린다(안쪽 대화형 요소가 있는 입력).
function legacyCards(): Props[] {
  const messages: Message[] = [
    {
      role: 'assistant',
      createdAt: 1_700_000_000_000,
      parts: [
        {
          type: 'tool_call',
          toolRunId: 'legacy-run',
          toolName: 'Task',
          args: { description: '구 모델 조사' }
        }
      ]
    }
  ]
  return cards(() =>
    renderToStaticMarkup(
      createElement(SubAgentTaskList, {
        tasks: subagentTasksFromMessages(messages),
        stoppingIds: new Set<string>(),
        stopErrors: {}
      })
    )
  )
}

// 실행 중 작업 1건 + 작업 없는 호출 1건 — 정본 작업 카드와 호출 카드를 하나씩 그린다.
function canonicalState(): BackgroundSessionState {
  let state = applyBackgroundEvent(emptyBackgroundState(), {
    type: 'background.task',
    sessionId: 's',
    taskId: 'task-keys',
    phase: 'started',
    source: { generation: 'gen-keys', sequence: 1, receivedAt: 1, replay: false },
    patch: { status: 'running', isBackgrounded: true, description: '정본 조사' }
  })
  state = applyBackgroundEvent(state, {
    type: 'background.call',
    sessionId: 's',
    toolUseId: 'call-keys',
    toolName: 'Bash',
    phase: 'started',
    source: { generation: 'gen-keys', sequence: 2, receivedAt: 2, replay: false },
    input: { command: 'echo keys', run_in_background: true }
  })
  return state
}

function canonicalCards(): Props[] {
  const initial = useChatStore.getInitialState()
  const session = initial.sessions[initial.activeKey].session
  const priorId = session.sessionId
  const backgrounds = useBackgroundStore.getInitialState()
  const priorViews = backgrounds.sessions
  session.sessionId = 's'
  backgrounds.sessions = { s: { state: canonicalState(), loading: false } }
  try {
    return cards(() => renderToStaticMarkup(createElement(CanonicalBackgroundContent)))
  } finally {
    session.sessionId = priorId
    backgrounds.sessions = priorViews
  }
}

const OPENED_CANONICAL = [
  ['s', { kind: 'task', key: backgroundKey('gen-keys', 'task-keys') }],
  ['s', { kind: 'call', key: backgroundKey('gen-keys', 'call-keys') }]
]

function press(card: Props, key: string, fromCard: boolean): { preventDefault: () => void } {
  const self = {}
  const event = { key, target: fromCard ? self : {}, currentTarget: self, preventDefault: vi.fn() }
  ;(card.onKeyDown as (event: unknown) => void)(event)
  return event
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(selectBackgroundItem).mockClear()
})

// 키 규칙: 카드 자신 + Enter·Space → 열고 1회 막음 / 안쪽 요소 + Enter·Space · 다른 키 → 아무것도 안 함.
const KEYS = [
  ['Enter', true, true],
  [' ', true, true],
  ['Enter', false, false],
  [' ', false, false],
  ['Escape', true, false]
] as const

describe('0319 W1 — background card keyboard and click', () => {
  it.each(KEYS)('legacy card: key %j from card=%s opens=%s', (key, fromCard, opens) => {
    const select = vi.spyOn(chatActions, 'selectSubagentTask').mockImplementation(() => {})
    const found = legacyCards()
    expect(found).toHaveLength(1)
    const event = press(found[0], key, fromCard)
    expect(select.mock.calls).toEqual(opens ? [['legacy-run']] : [])
    expect(event.preventDefault).toHaveBeenCalledTimes(opens ? 1 : 0)
  })

  it.each(KEYS)('canonical cards: key %j from card=%s opens=%s', (key, fromCard, opens) => {
    const found = canonicalCards()
    expect(found).toHaveLength(2)
    for (const card of found) {
      const event = press(card, key, fromCard)
      expect(event.preventDefault).toHaveBeenCalledTimes(opens ? 1 : 0)
    }
    expect(vi.mocked(selectBackgroundItem).mock.calls).toEqual(opens ? OPENED_CANONICAL : [])
  })

  it('opens each card by click', () => {
    const select = vi.spyOn(chatActions, 'selectSubagentTask').mockImplementation(() => {})
    ;(legacyCards()[0].onClick as () => void)()
    expect(select.mock.calls).toEqual([['legacy-run']])
    for (const card of canonicalCards()) (card.onClick as () => void)()
    expect(vi.mocked(selectBackgroundItem).mock.calls).toEqual(OPENED_CANONICAL)
  })

  it('a task card rendered without onOpen only prevents its own Enter', () => {
    const state = canonicalState()
    const task = state.tasks[backgroundKey('gen-keys', 'task-keys')]
    const [card] = cards(() =>
      renderToStaticMarkup(createElement(BackgroundTaskCard, { sessionId: 's', state, task }))
    )
    expect(card.onClick).toBeUndefined()
    expect(press(card, 'Enter', true).preventDefault).toHaveBeenCalledTimes(1)
    expect(press(card, 'Enter', false).preventDefault).not.toHaveBeenCalled()
    expect(selectBackgroundItem).not.toHaveBeenCalled()
  })
})
