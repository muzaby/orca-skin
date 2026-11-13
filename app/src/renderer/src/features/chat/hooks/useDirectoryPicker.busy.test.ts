// 0319 W3 — 폴더를 고르는 동안 세션이 점유(inflight ∨ 채널 ready·listening)되면 고른 결과를 적용하지 않는다.
// `pick()` 의 현재성 판정이 `sessionBusy` 를 쓰는 자리다.
//
// 이 파일은 store 를 교체하지 않는다 — 탐침 렌더(SSR)는 zustand 서버 스냅샷(getInitialState)을, `pick()` 은
// 현재 상태(getState)를 읽으므로 둘이 같은 객체여야 같은 세션을 본다. 그래서 store 를 바꾸는 테스트와 나눴다.

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useDirectoryPicker } from './useDirectoryPicker'
import { chatActions, useChatStore } from '../store/chatStore'
import { initialChatState, type ChatState } from '../reducer/chatReducer'

type Occupancy = { inflight: boolean; transport: ChatState['activity']['transport'] }

const initial = useChatStore.getInitialState()
const session = initial.sessions[initial.activeKey].session
const prior = {
  sessionId: session.sessionId,
  inflight: session.inflight,
  activity: session.activity
}
let resolvePick!: (directory: string | null) => void

const occupy = ({ inflight, transport }: Occupancy): void => {
  Object.assign(session, { inflight, activity: { ...initialChatState.activity, transport } })
}

beforeEach(() => {
  Object.assign(session, { sessionId: 's' })
  occupy({ inflight: false, transport: 'idle' })
  vi.stubGlobal('window', {
    oo: {
      files: {
        pickDirectory: () => new Promise<string | null>((settle) => (resolvePick = settle))
      }
    }
  })
})

afterEach(() => {
  Object.assign(session, prior)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// 확정 세션에서 추가 폴더를 고르는 선택기(allowExisting) — 점유만 빼면 고른 폴더를 세션에 더한다.
function startPick(): Promise<void> {
  let pick!: () => Promise<void>
  function Probe(): null {
    pick = useDirectoryPicker(true).pick
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  return pick()
}

it.each([
  ['inflight', false, { inflight: true, transport: 'idle' }],
  ['ready', false, { inflight: false, transport: 'ready' }],
  ['listening', false, { inflight: false, transport: 'listening' }],
  ['idle', true, { inflight: false, transport: 'idle' }]
] as const)(
  '0319 W3 — a session that becomes %s while picking gets the directory=%s',
  async (_label, applies, state) => {
    expect(useChatStore.getState()).toBe(initial)
    const add = vi
      .spyOn(chatActions, 'addSessionDirectory')
      .mockResolvedValue({ ok: true } as Awaited<
        ReturnType<typeof chatActions.addSessionDirectory>
      >)
    const picking = startPick()
    occupy(state)
    resolvePick('/work/extra')
    await picking
    expect(add.mock.calls).toEqual(
      applies ? [[{ key: initial.activeKey, sessionId: 's' }, '/work/extra']] : []
    )
  }
)
