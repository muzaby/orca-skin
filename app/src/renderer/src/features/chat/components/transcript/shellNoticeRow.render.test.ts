// 0230 r2 · D3 — 셸 백그라운드 작업의 완료 통지 행은 **상세 진입 어포던스를 갖지 않는다**.
//
// 셸은 하위 대화록이 없다(SDK 가 셸 실행에 child 스트림을 만들지 않는다). 상세로 들어가면
// `SubAgentTaskDetail` 이 stdout 을 "에이전트 답변" 자리에 명령도 맥락도 없이 그린다 — 우측 패널
// 카드에서 이미 막은 규칙(R-03)이 통지 행에서는 열려 있었다.
//
// **컨테이너를 마운트한다.** 행은 `useChatSession` 으로 messages 를 읽어 부모 tool_call 과
// 조인하므로, View 에 props 를 넣는 테스트는 그 조인(= 종류 판정의 입력)을 지나지 않는다.
// 시드는 `getInitialState()` 제자리 변형이다 — zustand v5 의 SSR 스냅샷은 초기 상태만 본다
// (`subagentWiring.render.test.ts` 와 같은 이유).

import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SubagentNoticeRow } from './SubagentNoticeRow'
import { agentUiPolicy } from '../../lib/agentPresentation'
import { useChatStore } from '../../store/chatStore'
import type { ChatState, Message } from '../../reducer/chatReducer'

const CMD = 'npx vitest run src/main'

const activeSession = (): ChatState => {
  const init = useChatStore.getInitialState()
  return init.sessions[init.activeKey]!.session
}

const pristine = activeSession().messages

afterEach(() => {
  activeSession().messages = pristine
})

const shellMessages = (): Message[] => [
  {
    role: 'assistant',
    createdAt: 1_700_000_000_000,
    parts: [
      { type: 'tool_call', toolRunId: 'sh1', toolName: 'PowerShell', args: { command: CMD } },
      {
        type: 'tool_result',
        toolRunId: 'sh1',
        result: 'RUN v4 …',
        isError: false,
        structuredOutput: { shellBackground: { taskId: 'bg-1' } }
      },
      { type: 'subagent_notice', toolRunId: 'sh1', status: 'completed' }
    ]
  }
]

const agentMessages = (): Message[] => [
  {
    role: 'assistant',
    createdAt: 1_700_000_000_000,
    parts: [
      { type: 'tool_call', toolRunId: 'ag1', toolName: 'Task', args: { description: '로그 조사' } },
      { type: 'subagent_notice', toolRunId: 'ag1', status: 'completed' }
    ]
  }
]

// 통지 행 하나를 활성 세션 위에서 마운트한다. `agentKind` 로 인라인 상세 정책을 가른다.
const renderNotice = (opts: {
  messages: Message[]
  toolRunId: string
  agentKind: 'code' | 'work'
}): string => {
  activeSession().messages = opts.messages
  return renderToStaticMarkup(
    createElement(SubagentNoticeRow, {
      toolRunId: opts.toolRunId,
      status: 'completed' as const,
      transcriptPolicy: agentUiPolicy(opts.agentKind).transcript
    })
  )
}

describe('0230 r2 D3 — 셸 통지 행은 상세로 들어가지 않는다', () => {
  it('우측 패널 진입 정책(code)에서 버튼 역할·포인터가 없다', () => {
    const html = renderNotice({ messages: shellMessages(), toolRunId: 'sh1', agentKind: 'code' })
    expect(html).not.toContain('role="button"')
    expect(html).not.toContain('cursor-pointer')
    // 양성 짝 — 행 자체는 그려졌고 조인도 됐다(어포던스만 없다).
    expect(html).toContain(CMD)
  })

  it('인라인 상세 정책(work)에서도 펼침 어포던스가 없다', () => {
    const html = renderNotice({ messages: shellMessages(), toolRunId: 'sh1', agentKind: 'work' })
    expect(html).not.toContain('role="button"')
    expect(html).not.toContain('aria-expanded')
  })

  it('형제 계약: 에이전트 통지 행은 두 정책 모두에서 진입 어포던스를 유지한다', () => {
    for (const agentKind of ['code', 'work'] as const) {
      const html = renderNotice({ messages: agentMessages(), toolRunId: 'ag1', agentKind })
      expect(html).toContain('role="button"')
      expect(html).toContain('로그 조사')
    }
  })

  it('종류 미확인(조인 실패)은 현행대로 어포던스를 유지한다', () => {
    // 부모 tool_call 이 아직 없는 통지 — 셸이라고 단정할 수 없으므로 막지 않는다.
    const html = renderNotice({ messages: [], toolRunId: 'zz', agentKind: 'code' })
    expect(html).toContain('role="button"')
  })

  // 0231 D-106 · §10 EP-207 — 같은 `joined.kind` 가 **라벨과 hover 까지** 가른다. 어포던스만
  // 막고 라벨·틴트를 두면 셸이 에이전트처럼 보이고, 누를 수 없는 줄이 밝아진다.
  it('AT-114 — 셸 통지 행은 `Agent "…"` 가 아니라 셸 라벨을 쓴다', () => {
    const html = renderNotice({ messages: shellMessages(), toolRunId: 'sh1', agentKind: 'code' })
    expect(html).not.toContain('Agent &quot;')
    expect(html).toContain('셸 &quot;')
    expect(html).toContain(CMD)
  })

  it('형제 계약: 에이전트 통지 행은 `Agent "…"` 를 유지한다', () => {
    const html = renderNotice({ messages: agentMessages(), toolRunId: 'ag1', agentKind: 'code' })
    expect(html).toContain('Agent &quot;')
    expect(html).not.toContain('셸 &quot;')
  })

  it('0230 D8 — 비대화형이 된 셸 행은 hover 틴트도 갖지 않는다', () => {
    const shell = renderNotice({ messages: shellMessages(), toolRunId: 'sh1', agentKind: 'code' })
    expect(shell).not.toContain('group-hover/notice:text-t9')
    // 양성 짝 — 에이전트 행은 그대로 반응한다.
    const agent = renderNotice({ messages: agentMessages(), toolRunId: 'ag1', agentKind: 'code' })
    expect(agent).toContain('group-hover/notice:text-t9')
  })
})
