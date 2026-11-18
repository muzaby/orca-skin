// OpenCode live 유무 선택자와 조각 단위 reasoning 유무 (0325 VP-07 자리 2·3 · VP-32 · EP-2 ②③ · EP-2b).
//
// 실제 store 에 값을 넣고(`setState` · `ingestChatEvent` + `flushRaf`) fake DOM 탐침 컴포넌트가 선택자 값을
// 읽는다. 조각 단위 유무는 매 단계 `reasoningVisible === hasSegmentReasoning(reasoning)` 불변식으로 본다.
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { hasSegmentReasoning } from '../lib/parts'
import {
  chatActions,
  ingestChatEvent,
  useChatStore,
  useHasLiveReasoning,
  useHasLiveText,
  useLiveTextFor,
  type LiveTurnState
} from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  const { createStore } = await import('zustand/vanilla')
  const useStore = <T, U>(store: import('zustand').StoreApi<T>, select: (state: T) => U): U =>
    fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())) as U
  const bind = <T>(initializer: import('zustand').StateCreator<T>): unknown => {
    const store = createStore(initializer)
    return Object.assign(<U>(selector: (state: T) => U): U => useStore(store, selector), store)
  }
  return {
    ...actual,
    useStore,
    create: (initializer?: import('zustand').StateCreator<unknown>) =>
      initializer ? bind(initializer) : bind
  }
})

let dom: FakeDom | undefined
beforeEach(() => installChatStoreHarness({ inflight: true, turnStartedAt: 1 }))
afterEach(() => {
  dom?.unmount()
  dom = undefined
})

const liveOf = (key = 's'): LiveTurnState => useChatStore.getState().sessions[key].live
const setLive = (live: LiveTurnState, key = 's'): void =>
  useChatStore.setState((state) => ({
    sessions: { ...state.sessions, [key]: { ...state.sessions[key], live } }
  }))
const expectInvariant = (key = 's'): void => {
  const live = liveOf(key)
  expect(live.reasoningVisible).toBe(hasSegmentReasoning(live.reasoning))
}

function Probe(): React.JSX.Element {
  const text = useHasLiveText()
  const reasoning = useHasLiveReasoning()
  const on = useLiveTextFor(true)
  const off = useLiveTextFor(false)
  return createElement('span', { 'data-probe': '' }, `${text}|${reasoning}|${on}|${off}`)
}
const probe = (): string => {
  dom ??= installFakeDom({ innerWidth: 800, innerHeight: 600 })
  dom.render(createElement(Probe))
  return dom.body.querySelector('[data-probe]')!.textContent
}

describe('live 유무·본문 선택자 (0325 VP-07 자리 2·3)', () => {
  it('reports live presence and gated live text from the real store', () => {
    setLive({ text: '', reasoning: '', reasoningVisible: false })
    expect(probe()).toBe('false|false||')
    setLive({ text: 'a', reasoning: '  ', reasoningVisible: false })
    expect(probe()).toBe('true|false|a|')
    setLive({ text: 'a', reasoning: ' x', reasoningVisible: true })
    expect(probe()).toBe('true|true|a|')
    setLive({ text: '', reasoning: ' x', reasoningVisible: true })
    expect(probe()).toBe('false|true||')
    // 공백뿐인 live text 도 text 유무다 — `hasSegmentText` 는 '' 만 거짓이다.
    setLive({ text: ' ', reasoning: '', reasoningVisible: false })
    expect(probe()).toBe('true|false| |')
  })
})

describe('reasoning presence is updated per chunk (0325 VP-32 · EP-2b)', () => {
  const reasoningDelta = (text: string, sessionId = 's'): void =>
    ingestChatEvent({ type: 'message.reasoning.delta', sessionId, delta: { text } })

  it('h1 공백 조각만 → 거짓', () => {
    reasoningDelta('   ')
    reasoningDelta('\n\t')
    flushRaf()
    expect(liveOf().reasoning).toBe('   \n\t')
    expect(liveOf().reasoningVisible).toBe(false)
    expectInvariant()
  })

  it('h2 공백 뒤 유효 조각 → 참, 그 뒤 공백 조각에도 참', () => {
    reasoningDelta('  ')
    flushRaf()
    expect(liveOf().reasoningVisible).toBe(false)
    reasoningDelta('x')
    flushRaf()
    expect(liveOf().reasoningVisible).toBe(true)
    expectInvariant()
    reasoningDelta('   ')
    flushRaf()
    expect(liveOf().reasoningVisible).toBe(true)
    expectInvariant()
  })

  it('h2′ text 조각·`message.completed` 의 text 비움은 플래그를 그대로 둔다(EP-2b ④)', () => {
    reasoningDelta('생각')
    flushRaf()
    ingestChatEvent({ type: 'message.delta', sessionId: 's', delta: { text: '본문' } })
    flushRaf()
    expect(liveOf()).toEqual({ text: '본문', reasoning: '생각', reasoningVisible: true })
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      message: { text: '본문' }
    } as never)
    expect(liveOf().text).toBe('')
    expect(liveOf().reasoningVisible).toBe(true)
    expectInvariant()
  })

  it('h3 `message.reasoning` → 거짓 · reasoning 비움', () => {
    reasoningDelta('생각')
    flushRaf()
    expect(liveOf().reasoningVisible).toBe(true)
    ingestChatEvent({ type: 'message.reasoning', sessionId: 's', text: '생각' })
    expect(liveOf().reasoning).toBe('')
    expect(liveOf().reasoningVisible).toBe(false)
    expectInvariant()
  })

  it.each([
    [
      'telemetry',
      (): void => ingestChatEvent({ type: 'telemetry', sessionId: 's', usage: {} } as never)
    ],
    [
      'turn.aborted',
      (): void => ingestChatEvent({ type: 'turn.aborted', sessionId: 's' } as never)
    ],
    [
      'error',
      (): void =>
        ingestChatEvent({ type: 'error', sessionId: 's', error: { message: 'x' } } as never)
    ],
    [
      '전송(resetLive)',
      (): void => {
        useChatStore.setState((state) => ({
          sessions: {
            ...state.sessions,
            s: { ...state.sessions.s, session: { ...state.sessions.s.session, inflight: false } }
          }
        }))
        chatActions.send('다음 질문')
      }
    ]
  ])('h4 %s → 거짓', (_name, act) => {
    reasoningDelta('생각 중')
    flushRaf()
    expect(liveOf().reasoningVisible).toBe(true)
    act()
    expect(liveOf().reasoningVisible).toBe(false)
    expectInvariant()
  })

  it('h4 세션 초기화(newChat) → 거짓', () => {
    chatActions.newChat()
    const key = useChatStore.getState().activeKey
    setLive({ text: '', reasoning: '이전 사고', reasoningVisible: true }, key)
    chatActions.newChat()
    expect(useChatStore.getState().activeKey).toBe(key)
    expect(liveOf(key).reasoningVisible).toBe(false)
    expectInvariant(key)
  })

  it('h5 세션 전환 뒤 선택자는 활성 세션의 값이다', () => {
    setLive({ text: '', reasoning: '생각', reasoningVisible: true }, 's')
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        b: { ...state.sessions.s, live: { text: '', reasoning: '', reasoningVisible: false } }
      }
    }))
    expect(probe()).toBe('false|true||')
    useChatStore.setState({ activeKey: 'b' })
    expect(probe()).toBe('false|false||')
    useChatStore.setState({ activeKey: 's' })
    expect(probe()).toBe('false|true||')
  })

  it('h6 공백 4,000,000자 reasoning 에서도 선택자는 누적 문자열을 읽지 않는다', () => {
    let reads = 0
    const whitespace = ' '.repeat(4_000_000)
    const live = { text: '', reasoningVisible: false } as LiveTurnState
    Object.defineProperty(live, 'reasoning', {
      enumerable: true,
      get: () => {
        reads++
        return whitespace
      }
    })
    setLive(live)
    reads = 0
    expect(probe()).toBe('false|false||')
    expect(reads).toBe(0)
  })
})
