// 0324 AC29′·AC33′ — 호스트가 죽거나 다시 붙을 때의 renderer 상태. 실행 프로세스(에이전트 호스트)가 죽으면
// 진행 중 세션은 오류 1건과 함께 끝나 입력을 받고, 활동 상태는 처음으로 돌아간다(다시 뜬 호스트의 활동
// 번호가 처음부터 세어도 버려지지 않게). 죽었던 호스트가 다시 붙으면 활성 세션을 다시 읽는다.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoadedSession } from '../../../../../shared/ipc'
import { initialChatState, type ChatState } from '../reducer/chatReducer'
import { bootstrapChat, onHostLifecycle, sessionBusy, useChatStore } from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'

type Activity = ChatState['activity']
const activity = (patch: Partial<Activity>): Activity => ({
  ...initialChatState.activity,
  ...patch
})

afterEach(() => {
  flushRaf()
  vi.restoreAllMocks()
})

// 활성 세션 s(진행 중)와 다른 세션 idle(쉬는 중 · 활동 번호 7).
function seed(busy: Partial<ChatState>): void {
  installChatStoreHarness({
    inflight: true,
    activity: activity({ revision: 5, transport: 'listening', foreground: 'streaming' }),
    ...busy
  })
  const original = useChatStore.getState().sessions.s
  useChatStore.setState({
    sessions: {
      s: original,
      idle: {
        ...original,
        session: {
          ...original.session,
          sessionId: 'idle',
          inflight: false,
          activity: activity({ revision: 7 })
        }
      }
    }
  })
}

const session = (key: string): ChatState => useChatStore.getState().sessions[key]!.session

describe('에이전트 호스트 종료 (AC29′)', () => {
  it('진행 중 세션은 오류 1건과 함께 끝나 입력을 받고, 활동 상태는 처음으로 돌아간다', () => {
    seed({
      pendingAsks: [{ requestId: 'ask-1' }] as unknown as ChatState['pendingAsks']
    })
    expect(sessionBusy(session('s'))).toBe(true)
    onHostLifecycle({ host: 'agent', kind: 'exited' })
    const s = session('s')
    expect(sessionBusy(s)).toBe(false)
    expect(s.error).toMatchObject({ category: 'stream_error', retryable: true })
    expect(s.error?.message).toEqual(expect.any(String))
    expect(s.error?.message).not.toBe('')
    expect(s.activity.revision).toBe(0)
    expect(s.pendingAsks).toEqual([])
  })

  it('쉬는 세션은 오류 없이 활동 번호만 처음으로 돌아간다', () => {
    seed({})
    onHostLifecycle({ host: 'agent', kind: 'exited' })
    const idle = session('idle')
    expect(idle.error).toBeUndefined()
    expect(idle.activity.revision).toBe(0)
  })

  it('데이터 호스트 종료는 진행 중 턴을 끝내지 않는다 — 실행은 에이전트 호스트에 있다', () => {
    seed({})
    onHostLifecycle({ host: 'data', kind: 'exited' })
    expect(sessionBusy(session('s'))).toBe(true)
    expect(session('s').error).toBeUndefined()
    expect(session('s').activity.revision).toBe(5)
  })
})

describe('호스트 재연결 (AC33′)', () => {
  const loaded = (id: string): LoadedSession => ({
    id,
    backend: 'claude',
    agentKind: 'code',
    title: 'reloaded',
    messages: []
  })

  it.each(['agent', 'data'] as const)(
    '%s 호스트가 다시 붙으면 활성 세션을 한 번 다시 읽는다',
    async (host) => {
      seed({ inflight: false, activity: activity({}) })
      const load = vi.fn(async (id: string) => loaded(id))
      Object.assign(window.oo, { session: { load, refresh: vi.fn(), cancelLoad: vi.fn() } })
      onHostLifecycle({ host, kind: 'reconnected' })
      await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
      expect(load).toHaveBeenCalledWith('s')
    }
  )
})

describe('배선', () => {
  it('bootstrapChat 이 호스트 수명 통지를 구독하고, 정리하면 해제한다', () => {
    installChatStoreHarness()
    const off = vi.fn()
    const onLifecycle = vi.fn(() => off)
    const none = (): (() => void) => () => {}
    Object.assign(window.oo, {
      hosts: { onLifecycle },
      session: { cwd: async () => '/w', onTitle: none },
      settings: { get: async () => ({}) },
      concurrency: { onEvent: none }
    })
    Object.assign(window.oo.chat, { onEvent: none, onBackgroundEvent: none })
    const cleanup = bootstrapChat()
    expect(onLifecycle).toHaveBeenCalledExactlyOnceWith(onHostLifecycle)
    cleanup()
    expect(off).toHaveBeenCalledTimes(1)
  })
})
