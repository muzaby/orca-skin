// chatStore 의 이벤트 라우팅(델타 → live 슬라이스 / 커밋 → reducer / sessionId 키 라우팅)
// 단위 테스트. IPC(window.orca)를 건드리지 않는 경로만 다룬다 — send/loadSession 등 액션과
// session.updated 의 설정 영속화는 통합/시각 검증 영역.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ingestChatEvent, useChatStore, NEW_CHAT_KEY } from './chatStore'
import { initialChatState } from '../reducer/chatReducer'
import { partsText } from '../lib/parts'
import type { NormalizedEvent } from '../../../../../shared/ipc'

// 코얼레서가 rAF 로 델타를 배칭한다 — 테스트에선 큐에 모았다가 flushRaf() 로 프레임을 흉내낸다.
// (등록 즉시 실행하는 스텁은 코얼레서의 handle 대입 전에 콜백이 돌아 재예약이 막힌다.)
let rafQueue: FrameRequestCallback[] = []
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
  rafQueue.push(cb)
  return rafQueue.length
})
vi.stubGlobal('cancelAnimationFrame', () => {})
const flushRaf = (): void => {
  const q = rafQueue
  rafQueue = []
  for (const cb of q) cb(0)
}

const delta = (text: string, sessionId = 's'): NormalizedEvent => ({
  type: 'message.delta',
  sessionId,
  provider: 'claude-code',
  delta: { text }
})

const reasoningDelta = (text: string): NormalizedEvent => ({
  type: 'message.reasoning.delta',
  sessionId: 's',
  provider: 'claude-code',
  delta: { text }
})

// 활성 키 's' 에 진행 중 턴 엔트리 1개로 초기화.
beforeEach(() => {
  rafQueue = []
  useChatStore.setState({
    sessions: {
      s: {
        session: { ...initialChatState, sessionId: 's', inflight: true, turnStartedAt: 1 },
        live: { text: '', reasoning: '' }
      }
    },
    activeKey: 's'
  })
})

const entry = (
  key = 's'
): { session: typeof initialChatState; live: { text: string; reasoning: string } } =>
  useChatStore.getState().sessions[key]

describe('chatStore — 델타/커밋 라우팅', () => {
  it('message.delta 는 live.text 에만 누적되고 session 슬라이스 identity 는 불변', () => {
    const before = entry().session
    ingestChatEvent(delta('hel'))
    ingestChatEvent(delta('lo'))
    flushRaf()
    expect(entry().live.text).toBe('hello')
    expect(entry().session).toBe(before) // session 구독자(transcript·Composer)는 깨어나지 않는다
  })

  it('reasoning 델타는 live.reasoning 만 갱신 — live.text 와 격리', () => {
    ingestChatEvent(delta('본문'))
    flushRaf()
    const textBefore = entry().live.text
    ingestChatEvent(reasoningDelta('생각'))
    flushRaf()
    expect(entry().live.reasoning).toBe('생각')
    expect(entry().live.text).toBe(textBefore)
  })

  it('message.completed 가 완성본을 커밋하고 live.text 를 비운다', () => {
    ingestChatEvent(delta('스트리'))
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      provider: 'claude-code',
      message: { text: '스트리밍 완성본' }
    })
    expect(entry().live.text).toBe('')
    expect(partsText(entry().session.messages[0].parts)).toBe('스트리밍 완성본')
  })

  it('telemetry 는 잔여 live.text 를 COMMIT_PENDING_TEXT 로 굳히고 live 를 리셋한다', () => {
    ingestChatEvent(delta('잘린 답'))
    ingestChatEvent(reasoningDelta('미완 사고'))
    ingestChatEvent({
      type: 'telemetry',
      sessionId: 's',
      provider: 'claude-code',
      usage: { inputTokens: 10, outputTokens: 5 }
    })
    expect(entry().live).toEqual({ text: '', reasoning: '' })
    expect(entry().session.inflight).toBe(false)
    expect(partsText(entry().session.messages[0].parts)).toBe('잘린 답')
  })

  it('error 는 잔여 라이브 프리뷰를 커밋 없이 버린다(기존 동작 동형)', () => {
    ingestChatEvent(delta('버려질 텍스트'))
    ingestChatEvent({
      type: 'error',
      sessionId: 's',
      provider: 'claude-code',
      error: { category: 'stream_error', message: 'boom', retryable: true }
    })
    expect(entry().live.text).toBe('')
    expect(entry().session.messages).toHaveLength(0)
    expect(entry().session.error?.message).toBe('boom')
  })

  it('비-델타 이벤트는 버퍼를 먼저 flush 한다 — 텍스트→도구 순서 보존', () => {
    ingestChatEvent(delta('먼저 텍스트'))
    ingestChatEvent({
      type: 'tool.call.started',
      sessionId: 's',
      provider: 'claude-code',
      toolRunId: 't1',
      toolName: 'Bash',
      args: { command: 'ls' }
    })
    expect(entry().live.text).toBe('먼저 텍스트') // 라이브 텍스트는 유지(완성 이벤트가 굳힘)
    expect(entry().session.messages[0].parts[0]).toMatchObject({
      type: 'tool_call',
      toolRunId: 't1'
    })
  })
})

describe('chatStore — 멀티세션 키 라우팅 (handoff 0013)', () => {
  it('비활성 세션의 이벤트는 그 엔트리에 백그라운드 누적되고 활성 엔트리는 불변', () => {
    useChatStore.setState((st) => ({
      sessions: {
        ...st.sessions,
        bg: {
          session: { ...initialChatState, sessionId: 'bg', inflight: true, turnStartedAt: 1 },
          live: { text: '', reasoning: '' }
        }
      }
    }))
    const activeBefore = entry('s')
    ingestChatEvent(delta('백그라운드', 'bg'))
    flushRaf()
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 'bg',
      provider: 'claude-code',
      message: { text: '백그라운드 완성' }
    })
    expect(entry('s')).toBe(activeBefore) // 활성 엔트리 identity 불변 — UI 재렌더 0
    expect(partsText(entry('bg').session.messages[0].parts)).toBe('백그라운드 완성')
    expect(useChatStore.getState().activeKey).toBe('s')
  })

  it('session.updated 가 새-채팅 엔트리를 sessionId 키로 승격하고 활성이면 activeKey 추종', () => {
    // 활성 엔트리의 session.updated 는 lastSessionId 영속화(IPC)를 킥한다 — node 환경 스텁.
    vi.stubGlobal('window', { orca: { settings: { set: vi.fn() } } })
    useChatStore.setState({
      sessions: {
        [NEW_CHAT_KEY]: {
          session: { ...initialChatState, inflight: true, turnStartedAt: 1 },
          live: { text: '', reasoning: '' }
        }
      },
      activeKey: NEW_CHAT_KEY
    })
    ingestChatEvent({
      type: 'session.updated',
      sessionId: 'fresh',
      provider: 'claude-code',
      patch: {}
    })
    const st = useChatStore.getState()
    expect(st.sessions[NEW_CHAT_KEY]).toBeUndefined()
    expect(st.sessions.fresh.session.sessionId).toBe('fresh')
    expect(st.activeKey).toBe('fresh')
  })

  it('미지 sessionId 의 늦은 이벤트(엔트리 삭제 후)는 폐기된다', () => {
    const before = useChatStore.getState()
    ingestChatEvent(delta('유령', 'ghost'))
    flushRaf()
    expect(useChatStore.getState().sessions).toEqual(before.sessions)
  })

  it('sessionId 없는 error 이벤트는 활성 엔트리로 폴백한다', () => {
    ingestChatEvent({
      type: 'error',
      provider: 'claude-code',
      error: { category: 'provider_connection_error', message: '활성 백엔드 없음', retryable: true }
    })
    expect(entry('s').session.error?.message).toBe('활성 백엔드 없음')
  })
})
