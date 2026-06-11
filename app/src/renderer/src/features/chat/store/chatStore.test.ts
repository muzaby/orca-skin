// chatStore 의 이벤트 라우팅(델타 → live 슬라이스 / 커밋 → reducer) 단위 테스트.
// IPC(window.orca)를 건드리지 않는 경로만 다룬다 — send/loadSession 등 액션과
// session.updated(설정 영속화)는 통합/시각 검증 영역.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ingestChatEvent, useChatStore } from './chatStore'
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

const delta = (text: string): NormalizedEvent => ({
  type: 'message.delta',
  sessionId: 's',
  provider: 'claude-code',
  delta: { text }
})

const reasoningDelta = (text: string): NormalizedEvent => ({
  type: 'message.reasoning.delta',
  sessionId: 's',
  provider: 'claude-code',
  delta: { text }
})

beforeEach(() => {
  rafQueue = []
  useChatStore.setState({
    session: { ...initialChatState, inflight: true, turnStartedAt: 1 },
    live: { text: '', reasoning: '' }
  })
})

describe('chatStore — 델타/커밋 라우팅', () => {
  it('message.delta 는 live.text 에만 누적되고 session 슬라이스 identity 는 불변', () => {
    const before = useChatStore.getState().session
    ingestChatEvent(delta('hel'))
    ingestChatEvent(delta('lo'))
    flushRaf()
    const st = useChatStore.getState()
    expect(st.live.text).toBe('hello')
    expect(st.session).toBe(before) // session 구독자(transcript·Composer)는 깨어나지 않는다
  })

  it('reasoning 델타는 live.reasoning 만 갱신 — live.text 와 격리', () => {
    ingestChatEvent(delta('본문'))
    flushRaf()
    const textBefore = useChatStore.getState().live.text
    ingestChatEvent(reasoningDelta('생각'))
    flushRaf()
    const st = useChatStore.getState()
    expect(st.live.reasoning).toBe('생각')
    expect(st.live.text).toBe(textBefore)
  })

  it('message.completed 가 완성본을 커밋하고 live.text 를 비운다', () => {
    ingestChatEvent(delta('스트리'))
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      provider: 'claude-code',
      message: { text: '스트리밍 완성본' }
    })
    const st = useChatStore.getState()
    expect(st.live.text).toBe('')
    expect(partsText(st.session.messages[0].parts)).toBe('스트리밍 완성본')
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
    const st = useChatStore.getState()
    expect(st.live).toEqual({ text: '', reasoning: '' })
    expect(st.session.inflight).toBe(false)
    expect(partsText(st.session.messages[0].parts)).toBe('잘린 답')
  })

  it('error 는 잔여 라이브 프리뷰를 커밋 없이 버린다(기존 동작 동형)', () => {
    ingestChatEvent(delta('버려질 텍스트'))
    ingestChatEvent({
      type: 'error',
      sessionId: 's',
      provider: 'claude-code',
      error: { category: 'stream_error', message: 'boom', retryable: true }
    })
    const st = useChatStore.getState()
    expect(st.live.text).toBe('')
    expect(st.session.messages).toHaveLength(0)
    expect(st.session.error?.message).toBe('boom')
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
    const st = useChatStore.getState()
    expect(st.live.text).toBe('먼저 텍스트') // 라이브 텍스트는 유지(완성 이벤트가 굳힘)
    expect(st.session.messages[0].parts[0]).toMatchObject({ type: 'tool_call', toolRunId: 't1' })
  })
})
