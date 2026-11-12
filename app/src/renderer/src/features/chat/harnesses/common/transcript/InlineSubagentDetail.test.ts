// 0313 VP-04 — 인라인 상세는 펼친 뒤(effect 로 상세 구현을 읽은 뒤) 세션 요약에서 자기 작업을
// 찾아 상세에 넘긴다. SSR 은 effect 를 돌리지 않아 이 자리를 볼 수 없으므로 실행 하네스로 본다.
// 상세 구현은 대역이다 — 이 파일이 보는 것은 "어느 작업을 넘기는가"다.
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { InlineSubagentDetail } from './InlineSubagentDetail'
import { agentUiPolicy } from '../../../lib/agentPresentation'
import type { SubagentTaskSummary } from '../../../lib/parts'
import { useChatStore } from '../../../store/chatStore'
import type { ChatState, Message } from '../../../reducer/chatReducer'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
// zustand 는 React default export 로 훅을 부른다 — 가짜 훅을 타게 store 바인딩만 바꾼다
// (`SessionRow.interaction.test.ts` 와 같은 대역). store 자체는 실제 vanilla store 다.
vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla')
  const { fakeHooks } = await import('../../../../../shared/ui/renderHarness.testfixture')
  const useStore = <T, U>(store: import('zustand').StoreApi<T>, select: (state: T) => U): U =>
    fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())) as U
  const bind = <T>(
    init: import('zustand').StateCreator<T>
  ): import('zustand').StoreApi<T> & ((select?: (s: T) => unknown) => unknown) => {
    const store = createStore(init)
    return Object.assign((select: (s: T) => unknown = (s) => s) => useStore(store, select), store)
  }
  return {
    create: (init?: import('zustand').StateCreator<unknown>) => (init ? bind(init) : bind),
    useStore
  }
})
vi.mock('../../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key })
}))
// 0316 T-08b — 상세에 넘기는 child 대화도 기록한다(파트 id 목록, 없으면 'none').
vi.mock('../rightpanel/SubAgentTaskDetail', () => ({
  SubAgentTaskDetail: ({
    task,
    childMessage
  }: {
    task: SubagentTaskSummary
    childMessage: Message | null
  }) =>
    createElement('div', {
      'data-detail-task': task.toolUseId,
      'data-detail-status': task.status,
      'data-detail-child':
        childMessage?.parts
          .map((part) => ('toolRunId' in part ? part.toolRunId : part.type))
          .join(',') ?? 'none'
    })
}))

const activeSession = (): ChatState => {
  const state = useChatStore.getState()
  return state.sessions[state.activeKey]!.session
}
const pristine = activeSession().messages
afterEach(() => {
  activeSession().messages = pristine
  vi.unstubAllGlobals()
})

// 최상위 에이전트(완료) 안에서 뜬 child 에이전트(진행 중) — 중첩 포함 요약에만 child 가 있다.
const messages: Message[] = [
  {
    role: 'assistant',
    createdAt: 1,
    parts: [
      {
        type: 'tool_call',
        toolRunId: 'top-agent',
        toolName: 'Agent',
        args: { description: 'top' }
      },
      {
        type: 'tool_call',
        toolRunId: 'nested-agent',
        toolName: 'Agent',
        args: { description: 'nested' },
        parentToolRunId: 'top-agent'
      },
      { type: 'tool_result', toolRunId: 'top-agent', result: 'done', isError: false }
    ]
  }
]

async function open(toolRunId: string): Promise<ReturnType<typeof installFakeDom>> {
  activeSession().messages = messages
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  dom.render(
    createElement(InlineSubagentDetail, {
      toolRunId,
      transcriptPolicy: agentUiPolicy('code').transcript
    })
  )
  // 상세 구현의 동적 import 가 끝나고 그 상태 갱신이 다시 그려질 때까지 기다린다.
  await vi.waitFor(() => {
    dom.act(() => {})
    expect(dom.body.textContent).not.toContain('chat.subagentTile.loadingDetail')
  })
  return dom
}

describe('0313 — 인라인 상세가 세션 요약에서 자기 작업을 찾는다', () => {
  it('최상위 작업은 그 요약을 상세에 넘긴다', async () => {
    const dom = await open('top-agent')
    const detail = dom.query('[data-detail-task]')
    expect(detail?.getAttribute('data-detail-task')).toBe('top-agent')
    expect(detail?.getAttribute('data-detail-status')).toBe('completed')
    // 자기 child 대화(중첩 에이전트 호출)를 함께 넘긴다.
    expect(detail?.getAttribute('data-detail-child')).toBe('nested-agent')
    dom.unmount()
  })

  it('중첩 작업도 찾는다 — 요약을 중첩 포함으로 읽는다', async () => {
    const dom = await open('nested-agent')
    const detail = dom.query('[data-detail-task]')
    expect(detail?.getAttribute('data-detail-task')).toBe('nested-agent')
    expect(detail?.getAttribute('data-detail-status')).toBe('running')
    expect(detail?.getAttribute('data-detail-child')).toBe('none')
    dom.unmount()
  })

  it('요약에 없는 작업은 상세 대신 활동 없음 문구를 보인다', async () => {
    const dom = await open('no-such-agent')
    expect(dom.query('[data-detail-task]')).toBeNull()
    expect(dom.body.textContent).toContain('chat.subagentTile.noChildActivity')
    dom.unmount()
  })
})
