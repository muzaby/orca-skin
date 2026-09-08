import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { WorkActivity } from './WorkActivity'
import { Composer } from '../Composer'
import { getActiveChatSession, ingestChatEvent } from '../../store/chatStore'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'

// 실제 컴포넌트 callback/재렌더와 기존 preload facade까지 관측한다.
// React DOM 이벤트/포커스 또는 Electron permission handler 실행 시험은 아니다.
const h = vi.hoisted(() => ({
  arrays: [] as unknown[][],
  index: 0,
  option: undefined as undefined | (() => void),
  submit: undefined as undefined | (() => void),
  disabled: true
}))
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) => {
      const seed = typeof initial === 'function' ? initial() : initial
      if (!Array.isArray(seed)) return actual.useState(() => seed)
      const index = h.index++
      h.arrays[index] ??= seed
      return [
        h.arrays[index],
        (next: unknown) => {
          h.arrays[index] = typeof next === 'function' ? next(h.arrays[index]) : (next as unknown[])
        }
      ]
    }
  }
})
vi.mock('react/jsx-dev-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-dev-runtime')>()
  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      const [type, value] = args
      const props = value as Record<string, unknown>
      if (type === 'button' && props.role === 'option') h.option = props.onClick as () => void
      if (type === 'button' && props['data-behavior'] === 'action:send') {
        h.submit = props.onClick as () => void
        h.disabled = props.disabled === true
      }
      return actual.jsxDEV(...args)
    }
  }
})
vi.mock('../../store/chatStore', async (original) => {
  const actual = await original<typeof import('../../store/chatStore')>()
  return {
    ...actual,
    useChatSession: (
      selector: (state: ReturnType<typeof actual.getActiveChatSession>) => unknown
    ) => selector(actual.getActiveChatSession())
  }
})
vi.mock('../../../../shared/hooks/useAgents', () => ({ useAgents: () => [] }))
vi.mock('../composer/ComposerInputController', () => ({ ComposerInputController: () => null }))

it('keeps the pending Work ask in Composer, sends its actual answer callback to permission IPC, and renders resolved Q&A once', () => {
  const questions = [
    {
      header: '범위',
      question: '어떤 범위를 작성할까요?',
      multiSelect: false,
      options: [{ label: '전체', description: '전체 범위' }]
    }
  ]
  const { permissionRespond } = installChatStoreHarness({
    agentKind: 'work',
    inflight: true,
    messages: [
      {
        role: 'assistant',
        createdAt: 1,
        parts: [
          { type: 'response_boundary', boundary: { phase: 'begin', id: 'work-response' } },
          {
            type: 'tool_call',
            toolRunId: 'question-tool',
            toolName: 'AskUserQuestion',
            args: { questions }
          }
        ]
      }
    ]
  })
  ingestChatEvent({
    type: 'permission.requested',
    sessionId: 's',
    approvalId: 'question-approval',
    origin: 'agent',
    action: { kind: 'ask_question', request: { requestId: 'question-approval', questions } }
  })
  function render(): string {
    h.index = 0
    h.option = undefined
    h.submit = undefined
    return renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(WorkActivity, { messages: getActiveChatSession().messages }),
        createElement(Composer, { backendLabel: 'Claude', canAbort: true })
      )
    )
  }
  const pending = render()
  expect(pending).toContain('data-ask-user-input="true"')
  expect(pending.split('어떤 범위를 작성할까요?')).toHaveLength(2)
  expect(h.disabled).toBe(true)
  expect(permissionRespond).not.toHaveBeenCalled()
  h.option!()
  render()
  expect(h.disabled).toBe(false)
  h.submit!()
  expect(permissionRespond).toHaveBeenCalledExactlyOnceWith({
    approvalId: 'question-approval',
    resolution: {
      behavior: 'allow',
      updatedInput: { answers: { '어떤 범위를 작성할까요?': '전체' } }
    }
  })
  expect(getActiveChatSession().pendingAsks).toEqual([])
  ingestChatEvent({
    type: 'tool.call.completed',
    sessionId: 's',
    toolRunId: 'question-tool',
    result: { answers: { '어떤 범위를 작성할까요?': '전체' } },
    isError: false
  })
  const resolved = render()
  expect(resolved).not.toContain('data-ask-user-input')
  expect(resolved.split('어떤 범위를 작성할까요?')).toHaveLength(2)
  expect(resolved).toContain('font-semibold"> 전체</span>')
})
