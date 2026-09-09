import { createElement, type EffectCallback } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialChatState, type ChatState } from '../../reducer/chatReducer'
import { TaskTileContent } from './TaskTileContent'
import { PlanTileContent } from './PlanTileContent'

const harness = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  state: null as ChatState | null,
  unseen: 2,
  acknowledge: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffect: (effect: EffectCallback) => harness.effects.push(effect)
}))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(harness.state!),
  useChatStore: (select: (state: { activeKey: string }) => unknown) =>
    select({ activeKey: 'work' }),
  useUnseenSettledTaskCount: () => harness.unseen,
  chatActions: { acknowledgeSettledTasks: harness.acknowledge, selectTask: vi.fn() }
}))
// 이 검사는 Work/Coding 실제 wrapper가 공유하는 shell effect를 실행한다. 외부 구독/OS 포트 수명은 native에서 관측한다.
vi.mock('./TaskOutputContent', () => ({ TaskOutputContent: () => null }))
vi.mock('./TaskContextContent', () => ({ TaskContextContent: () => null }))

function commitPanelEffects(kind: 'work' | 'coding'): void {
  harness.effects = []
  renderToStaticMarkup(createElement(kind === 'work' ? TaskTileContent : PlanTileContent))
  for (const effect of harness.effects) effect()
}

beforeEach(() => {
  harness.unseen = 2
  harness.state = {
    ...initialChatState,
    agentKind: 'work',
    selectedTaskKey: 'agent:1',
    messages: [
      {
        role: 'assistant',
        createdAt: 0,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'create1',
            toolName: 'TaskCreate',
            args: { subject: 'task' }
          },
          {
            type: 'tool_result',
            toolRunId: 'create1',
            result: 'ok',
            isError: false,
            structuredOutput: { task: { id: '1', subject: 'task' } }
          }
        ]
      }
    ]
  }
  harness.acknowledge.mockReset().mockImplementation(() => {
    harness.unseen = 0
  })
})

describe.each(['work', 'coding'] as const)(
  '%s overview visibility and completed-task acknowledgement',
  (kind) => {
    it('keeps unseen completion notifications while overview is hidden in detail', () => {
      commitPanelEffects(kind)
      expect(harness.acknowledge).not.toHaveBeenCalled()
      expect(harness.unseen).toBe(2)
    })
    it('acknowledges preserved completions only after returning to the visible overview', () => {
      commitPanelEffects(kind)
      harness.state!.selectedTaskKey = null
      commitPanelEffects(kind)
      expect(harness.acknowledge).toHaveBeenCalledOnce()
      expect(harness.unseen).toBe(0)
      commitPanelEffects(kind)
      expect(harness.acknowledge).toHaveBeenCalledOnce()
    })
  }
)
