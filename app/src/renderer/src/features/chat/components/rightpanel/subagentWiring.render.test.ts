// 0215 ΔV1 · VP-22 (AR-05 ↔ IT · §10 EP-20·EP-21) — 컨테이너가 세션 상태를 목록 View 로
// **공급하는지**를 관측한다.
//
// 기존 AT-19(`rightPanelTiles.render.test.ts`)는 `SubAgentTaskList` 에 props 를 직접 넣어
// 문구 렌더 규칙만 봤다. 그래서 `SubAgentTileContent` 가 `stopErrors={stopErrors}` 를
// 빼도 전 스위트가 초록이었다(verify r1 M-G). 여기서는 **컨테이너를 마운트**해 store →
// props → 문구까지의 배선을 본다.
//
// 시드 방법: `useChatStore.setState` 가 아니라 `getInitialState()` 를 제자리 변형한다.
// zustand v5 의 `useStore` 는 `getServerSnapshot = () => selector(api.getInitialState())` 라
// `renderToStaticMarkup`(SSR) 이 **초기 상태만** 본다 — `setState` 시드는 보이지 않는다
// (실측: getState 1건 / getInitialState 0건 / 렌더 출력 미포함).

import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SubAgentTileContent } from './SubAgentTileContent'
import { useChatStore } from '../../store/chatStore'
import { backgroundTaskKey } from '../../lib/taskBoard'
import type { ChatState, Message } from '../../reducer/chatReducer'

const activeSession = (): ChatState => {
  const init = useChatStore.getInitialState()
  return init.sessions[init.activeKey]!.session
}

const pristine = { messages: activeSession().messages, errors: activeSession().taskStopErrors }

afterEach(() => {
  const session = activeSession()
  session.messages = pristine.messages
  session.taskStopErrors = pristine.errors
})

const backgroundMessages = (toolRunId: string, description: string): Message[] => [
  {
    role: 'assistant',
    createdAt: 1_700_000_000_000,
    parts: [{ type: 'tool_call', toolRunId, toolName: 'Task', args: { description, prompt: 'p' } }]
  }
]

// 활성 세션을 시드하고 **컨테이너**를 마운트한다.
const renderTile = (opts: { stopErrors: ChatState['taskStopErrors'] }): string => {
  const session = activeSession()
  session.messages = backgroundMessages('bg1', '로그 파서 조사')
  session.taskStopErrors = opts.stopErrors
  return renderToStaticMarkup(createElement(SubAgentTileContent))
}

describe('0215 AT-24 — `SubAgentTileContent` 가 세션의 taskStopErrors 를 목록 View 로 흘린다', () => {
  it('세션에 중단 실패가 있으면 타일이 그 문구를 낸다', () => {
    const html = renderTile({
      stopErrors: { [backgroundTaskKey('bg1')]: { messageKey: 'chat.taskTile.stopFailed' } }
    })
    // 배선 단언 — `stopErrors={stopErrors}` 를 지우면 이 줄이 red 다(verify r1 M-G).
    expect(html).toContain('중단하지 못했습니다')
    // 양성 짝 — 행 자체가 컨테이너 경로로 그려졌다(문구만 새는 것이 아니다).
    expect(html).toContain('로그 파서 조사')
  })

  it('세션에 중단 실패가 없으면 문구도 없다 — 음성 짝', () => {
    const html = renderTile({ stopErrors: {} })
    expect(html).not.toContain('중단하지 못했습니다')
    expect(html).toContain('로그 파서 조사')
  })

  it('시드가 실제로 SSR 렌더에 도달한다 — 시드 수단 자체의 양성 관측', () => {
    // 이 케이스가 없으면 위 두 단언은 "시드가 안 먹어서 아무것도 안 그려진 출력" 과
    // 구분되지 않는다. 빈 상태 문구가 사라졌다는 것이 시드 도달의 증거다.
    const html = renderTile({ stopErrors: {} })
    expect(html).not.toContain('백그라운드 작업이 없습니다')
  })
})
