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
import { SubAgentTileContent } from '../../claude/rightpanel/SubAgentTileContent'
import { useChatStore } from '../../../store/chatStore'
import { backgroundTaskKey } from '../../../lib/taskBoard'
import type { ChatState, Message } from '../../../reducer/chatReducer'

const activeSession = (): ChatState => {
  const init = useChatStore.getInitialState()
  return init.sessions[init.activeKey]!.session
}

const pristine = {
  messages: activeSession().messages,
  errors: activeSession().taskStopErrors,
  stopping: activeSession().stoppingTaskIds,
  paused: activeSession().pausedTaskIds,
  backgrounded: activeSession().backgroundedTaskIds
}

afterEach(() => {
  const session = activeSession()
  session.messages = pristine.messages
  session.taskStopErrors = pristine.errors
  session.stoppingTaskIds = pristine.stopping
  session.pausedTaskIds = pristine.paused
  session.backgroundedTaskIds = pristine.backgrounded
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

// 0313 — 구 모델 본문이 새 파일로 옮겨졌다. 래퍼가 라이브 표식 세 집합을 목록 View 로 흘리는
// 배선은 View 를 직접 렌더하는 테스트(`taskSurface0212`)로는 보이지 않는다 — 컨테이너로 본다.
describe('0313 — 타일 컨테이너가 중단 대기·일시정지·백그라운드 전환 집합을 목록 View 로 흘린다', () => {
  const renderWith = (patch: Partial<ChatState>): string => {
    Object.assign(activeSession(), patch)
    return renderTile({ stopErrors: {} })
  }
  const toBackground = 'aria-label="로그 파서 조사 백그라운드로 보내기"'

  it('표식이 없으면 실행 중 라벨과 전환·중단 버튼이 뜬다 — 대조', () => {
    const html = renderWith({})
    expect(html).not.toContain('중단 중…')
    expect(html).not.toContain('일시정지')
    expect(html).toContain(toBackground)
    expect(html).toContain('aria-label="중단"')
  })

  it('중단 대기 집합에 있으면 중단 중 라벨을 보이고 중단 버튼을 감춘다', () => {
    const html = renderWith({ stoppingTaskIds: ['bg1'] })
    expect(html).toContain('중단 중…')
    expect(html).not.toContain('aria-label="중단"')
  })

  it('일시정지 집합에 있으면 일시정지 라벨을 보인다', () => {
    const html = renderWith({ pausedTaskIds: ['bg1'] })
    expect(html).toContain('일시정지')
    expect(html).not.toContain('중단 중…')
  })

  it('백그라운드로 옮긴 집합에 있으면 전환 버튼이 없다', () => {
    const html = renderWith({ backgroundedTaskIds: ['bg1'] })
    expect(html).not.toContain(toBackground)
    expect(html).toContain('aria-label="중단"')
  })
})
