// 0230 VP-03 · VP-05 (R-03·R-05 ↔ AT-05·AT-06·AT-09 · §10 EP-05)
//
// 목록 View 가 셸 작업을 **에이전트와 다르게** 그리는지 본다. props 만 읽는 순수 View 라
// `renderToStaticMarkup` 으로 관측한다(`rightPanelTiles.render.test.ts` 와 같은 방식).

import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SubAgentTaskList, SubAgentTileContent } from './SubAgentTileContent'
import { useChatStore } from '../../store/chatStore'
import { subagentTasksFromMessages } from '../../lib/parts'
import type { Message } from '../../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../../shared/ipc'

const CMD = 'npx vitest run src/main'
const EMPTY: ReadonlySet<string> = new Set()

function messages(parts: AppMessagePart[]): Message[] {
  return [{ role: 'assistant', createdAt: 1_700_000_000_000, parts }]
}

function shellParts(structuredOutput: unknown): AppMessagePart[] {
  return [
    { type: 'tool_call', toolRunId: 'sh1', toolName: 'PowerShell', args: { command: CMD } },
    { type: 'tool_result', toolRunId: 'sh1', result: 'RUN v4 …', isError: false, structuredOutput }
  ]
}

const agentParts: AppMessagePart[] = [
  { type: 'tool_call', toolRunId: 'ag1', toolName: 'Task', args: { description: '로그 조사' } }
]

function render(parts: AppMessagePart[]): string {
  return renderToStaticMarkup(
    createElement(SubAgentTaskList, {
      tasks: subagentTasksFromMessages(messages(parts)),
      stoppingIds: EMPTY,
      stopErrors: {}
    })
  )
}

const launched = { shellBackground: { taskId: 'bg-1' } }

describe('0230 AT-05/AT-06 — 셸 카드', () => {
  it('AT-05: 명령이 카드에 보인다', () => {
    expect(render(shellParts(launched))).toContain(CMD)
  })

  it('AT-06: 셸 라벨이 있고 에이전트 폴백 라벨은 없다', () => {
    const html = render(shellParts(launched))
    expect(html).toContain('셸 명령')
    expect(html).not.toContain('에이전트')
  })

  it('AT-06 형제 대조: 에이전트 카드는 반대다 — 에이전트 라벨이 있고 셸 라벨이 없다', () => {
    const html = render(agentParts)
    expect(html).toContain('에이전트')
    expect(html).not.toContain('셸 명령')
  })

  it('셸 카드에는 대화록 진입점이 없다 — child 스트림이 없어 죽은 어포던스다', () => {
    expect(render(shellParts(launched))).not.toContain('대화록 보기')
  })

  it('회귀: 에이전트 카드의 대화록 진입점은 남는다', () => {
    expect(render(agentParts)).toContain('대화록 보기')
  })

  it('AT-10 음성: 영수증 없는 셸은 카드가 서지 않는다', () => {
    const html = render([
      { type: 'tool_call', toolRunId: 'sh2', toolName: 'PowerShell', args: { command: CMD } },
      { type: 'tool_result', toolRunId: 'sh2', result: 'done', isError: false }
    ])
    expect(html).not.toContain(CMD)
    expect(html).toContain('백그라운드 작업이 없습니다')
  })
})

describe('0230 AT-09 — 타임아웃 전환 표시', () => {
  it('AT-09: timedOutAfterMs 가 있으면 전환 사유를 말한다', () => {
    const html = render(
      shellParts({ shellBackground: { taskId: 'bg-1', timedOutAfterMs: 120_000 } })
    )
    expect(html).toContain('타임아웃으로 백그라운드 전환')
  })

  it('AT-09 음성: 명시 백그라운드 실행은 전환 사유를 말하지 않는다', () => {
    expect(render(shellParts(launched))).not.toContain('타임아웃으로 백그라운드 전환')
  })
})

describe('0230 — 셸 카드의 중단 어포던스', () => {
  it('실행 중이면 중단 버튼이 있다', () => {
    expect(render(shellParts(launched))).toContain('aria-label="중단"')
  })

  it('정착하면 중단 버튼이 사라진다', () => {
    const html = render([
      ...shellParts(launched),
      { type: 'subagent_notice', toolRunId: 'sh1', status: 'completed' }
    ])
    expect(html).not.toContain('aria-label="중단"')
  })
})

// W4(r2) — **컨테이너를 마운트**해 store → props → 셸 카드 배선을 본다. 위 케이스들은
// `SubAgentTaskList` 에 props 를 직접 넣으므로, 컨테이너가 셸 항목을 걸러도 전부 초록이었다
// (r2 실측). `subagentWiring.render.test.ts` 와 같은 시드 방식을 쓴다 — zustand v5 의 SSR
// 스냅샷은 `getInitialState()` 만 보므로 `setState` 가 아니라 제자리 변형이다.
describe('0230 r2 — 컨테이너가 셸 작업을 목록에 공급한다 (W4)', () => {
  const activeSession = (): { messages: Message[] } => {
    const init = useChatStore.getInitialState()
    return init.sessions[init.activeKey]!.session as unknown as { messages: Message[] }
  }
  const pristine = activeSession().messages

  afterEach(() => {
    activeSession().messages = pristine
  })

  it('셸 백그라운드 작업이 컨테이너를 거쳐 카드로 선다', () => {
    activeSession().messages = messages(shellParts(launched))
    const html = renderToStaticMarkup(createElement(SubAgentTileContent))
    expect(html).toContain(CMD)
    expect(html).toContain('셸 명령')
  })

  it('음성 대조: 영수증이 없으면 컨테이너도 빈 목록을 공급한다', () => {
    activeSession().messages = messages([
      { type: 'tool_call', toolRunId: 'sh9', toolName: 'PowerShell', args: { command: CMD } },
      { type: 'tool_result', toolRunId: 'sh9', result: 'done', isError: false }
    ])
    expect(renderToStaticMarkup(createElement(SubAgentTileContent))).toContain(
      '백그라운드 작업이 없습니다'
    )
  })
})
