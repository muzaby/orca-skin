// 0319 W3 — 세션 점유 판정 `sessionBusy`(= inflight ∨ 채널 ready·listening)를 쓰는 소비처를 잠근다.
// 핸드오프 가드 · 캐시 재진입 가드 · 지연 갱신 현재성 · `useChatBusy` 선택자. 자리마다 점유 세 갈래와 비점유 대조를
// 넣는다 — `ready` 는 형제 `sessionResponding`, `inflight` 는 `sessionListening`, 채널 둘은 `inflight` 맞바꿈을 가른다.
// (폴더 선택기의 같은 판정은 store 를 교체하지 않아야 해서 `hooks/useDirectoryPicker.busy.test.ts` 가 본다.)

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { LoadedSession, RefreshSessionResult } from '../../../../../shared/ipc'
import { chatActions, useChatBusy, useChatStore } from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'
import { initialChatState, type ChatState } from '../reducer/chatReducer'

type Transport = ChatState['activity']['transport']
type Occupancy = { inflight: boolean; transport: Transport }

const occupancy = ({ inflight, transport }: Occupancy): Partial<ChatState> => ({
  inflight,
  activity: { ...initialChatState.activity, transport }
})
const message = (
  role: 'user' | 'assistant',
  text: string,
  createdAt: number
): ChatState['messages'][number] => ({ role, createdAt, parts: [{ type: 'text', text }] })

const IDLE: Occupancy = { inflight: false, transport: 'idle' }
const OCCUPIED = [
  ['inflight', { inflight: true, transport: 'idle' }],
  ['ready', { inflight: false, transport: 'ready' }],
  ['listening', { inflight: false, transport: 'listening' }]
] as const satisfies readonly (readonly [string, Occupancy])[]

afterEach(() => {
  flushRaf()
  vi.restoreAllMocks()
})

describe('0319 W3 — startHandoff guard', () => {
  // 확정 세션 · 사용자 턴 2 · continuity 지원 하네스 — 점유만 빼면 핸드오프가 열리는 입력.
  const ready = (state: Occupancy): Partial<ChatState> => ({
    backend: 'claude',
    ...occupancy(state),
    messages: [message('user', 'q1', 1), message('assistant', 'a1', 2), message('user', 'q2', 3)]
  })

  it.each(OCCUPIED)('does not open while the session is %s', (_label, state) => {
    const harness = installChatStoreHarness(ready(state))
    expect(chatActions.startHandoff()).toBe(false)
    expect(harness.chatSend).not.toHaveBeenCalled()
  })

  it('opens when the session is idle', () => {
    const harness = installChatStoreHarness(ready(IDLE))
    expect(chatActions.startHandoff()).toBe(true)
    expect(harness.chatSend).toHaveBeenCalledTimes(1)
  })
})

describe('0319 W3 — cached reopen guard and lazy refresh currency', () => {
  const refresh = vi.fn<() => Promise<RefreshSessionResult>>()
  const load = vi.fn<() => Promise<LoadedSession | null>>()
  const snapshot = (text: string): LoadedSession => ({
    id: 's',
    backend: 'opencode',
    agentKind: 'code',
    title: 'native',
    messages: [message('assistant', text, 9)]
  })
  const cached = [message('user', 'cached body', 1)]

  // 캐시가 있는 세션 s 와 다른 활성 세션 — s 를 다시 열면 캐시 재진입 경로를 탄다.
  function seed(state: Occupancy): void {
    installChatStoreHarness({
      backend: 'opencode',
      agentKind: 'code',
      messages: cached,
      ...occupancy(state)
    })
    const original = useChatStore.getState().sessions.s
    useChatStore.setState({
      sessions: {
        s: original,
        other: { ...original, session: { ...original.session, sessionId: 'other' } }
      },
      activeKey: 'other'
    })
    load.mockReset().mockResolvedValue(snapshot('native'))
    refresh.mockReset().mockResolvedValue({ status: 'updated', session: snapshot('refreshed') })
    Object.assign(window.oo, { session: { load, refresh } })
  }

  // 본문·live 는 그대로 두고 점유만 바꾼다 — 현재성 판정의 다른 항(본문·live 동일성)은 참으로 남는다.
  function occupy(state: Occupancy): void {
    useChatStore.setState((store) => ({
      sessions: {
        ...store.sessions,
        s: { ...store.sessions.s, session: { ...store.sessions.s.session, ...occupancy(state) } }
      }
    }))
  }

  const messages = (): ChatState['messages'] => useChatStore.getState().sessions.s.session.messages

  it.each(OCCUPIED)(
    'keeps the cached entry authoritative when it was %s at request time',
    async (_label, state) => {
      seed(state)
      await chatActions.loadSession('s')
      expect(load).toHaveBeenCalledWith('s')
      expect(messages()).toEqual(cached)
      flushRaf()
      flushRaf()
      expect(refresh).not.toHaveBeenCalled()
    }
  )

  it('applies the load and refreshes when the cached entry is idle', async () => {
    seed(IDLE)
    await chatActions.loadSession('s')
    expect(messages()).toEqual(snapshot('native').messages)
    flushRaf()
    flushRaf()
    await vi.waitFor(() => expect(messages()).toEqual(snapshot('refreshed').messages))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it.each(OCCUPIED)(
    'skips the lazy refresh when the session becomes %s before it starts',
    async (_label, state) => {
      seed(IDLE)
      await chatActions.loadSession('s')
      expect(messages()).toEqual(snapshot('native').messages)
      occupy(state)
      flushRaf()
      flushRaf()
      expect(refresh).not.toHaveBeenCalled()
    }
  )

  it.each(OCCUPIED)(
    'drops a refresh result when the session becomes %s while it is pending',
    async (_label, state) => {
      seed(IDLE)
      let resolve!: (result: RefreshSessionResult) => void
      refresh.mockReturnValueOnce(new Promise((settle) => (resolve = settle)))
      await chatActions.loadSession('s')
      flushRaf()
      flushRaf()
      expect(refresh).toHaveBeenCalledTimes(1)
      occupy(state)
      resolve({ status: 'updated', session: snapshot('late') })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(messages()).toEqual(snapshot('native').messages)
    }
  )

  it('applies a pending refresh result when the session stays idle', async () => {
    seed(IDLE)
    let resolve!: (result: RefreshSessionResult) => void
    refresh.mockReturnValueOnce(new Promise((settle) => (resolve = settle)))
    await chatActions.loadSession('s')
    flushRaf()
    flushRaf()
    resolve({ status: 'updated', session: snapshot('late') })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(messages()).toEqual(snapshot('late').messages)
  })
})

describe('0319 W3 — useChatBusy selector', () => {
  it.each([
    ['idle', false, IDLE],
    ...OCCUPIED.map(([label, state]) => [label, true, state] as const)
  ] as const)('reads %s as busy=%s', (_label, expected, state) => {
    // SSR 은 zustand 의 서버 스냅샷(getInitialState)을 읽는다 — 기존 렌더 테스트와 같은 방식으로 시드한다.
    const initial = useChatStore.getInitialState()
    const session = initial.sessions[initial.activeKey].session
    const prior = { inflight: session.inflight, activity: session.activity }
    Object.assign(session, occupancy(state))
    let value: boolean | undefined
    function Probe(): null {
      value = useChatBusy()
      return null
    }
    try {
      renderToStaticMarkup(createElement(Probe))
    } finally {
      Object.assign(session, prior)
    }
    expect(value).toBe(expected)
  })
})
