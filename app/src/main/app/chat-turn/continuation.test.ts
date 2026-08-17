// 0179 — 자동 연속 턴 요청 조립 회귀. 두 회귀가 여기서 났었다:
//  0149 — listen 요청이 원 request 를 spread 해 base64 첨부가 listen phase 내내 살아남았다.
//  0166 D7 — 프레임 위임을 절반만 실어 배치가 `submitting` 에 갇혔다.
// 두 규칙을 양성 단언으로 못 박는다.

import { describe, expect, it, vi } from 'vitest'
import { buildFlushRequest, buildListenRequest } from './continuation'
import type { SteerFlushBatch, TurnRequest } from '../../adapters/turn'

// 0188 — settings 와 env 가 **한 객체**로 온다. listen 과 flush 가 둘 다 같은 값을 실어야
// 하므로 픽스처도 한 벌이다.
const continuation = {
  extensions: { skills: [] } as unknown as TurnRequest['extensions'],
  model: 'sonnet-next',
  prepared: {
    providerSettings: { blob: 'fresh' } as never,
    env: { ANTHROPIC_AUTH_TOKEN: 'fresh-token' },
    runtimeEnvFingerprint: 'fp-fresh',
    envFingerprint: 'fp-fresh'
  }
}

function baseRequest(): TurnRequest {
  return {
    sessionId: 's-1',
    text: '원 프롬프트',
    promptUuid: 'uuid-origin',
    cwd: '/workspace',
    signal: new AbortController().signal,
    extensions: { skills: ['old'] } as unknown as TurnRequest['extensions'],
    attachmentTexts: ['첨부 본문'],
    attachmentImages: [{ base64: 'AAAA', mediaType: 'image/png' }],
    forkFrom: 'origin-session',
    handoff: true,
    preludes: [{ uuid: 'p-1', ids: ['m-1'], text: '프렐류드' } as unknown as SteerFlushBatch],
    takeSteerFlush: vi.fn(),
    commitSteerFlush: vi.fn(),
    rollbackSteerFlush: vi.fn()
  } as unknown as TurnRequest
}

describe('buildListenRequest', () => {
  it('첨부를 싣지 않고 프레임 위임 3종을 전부 넘긴다', () => {
    const base = baseRequest()
    const signal = new AbortController().signal

    const request = buildListenRequest({ base, sessionId: 's-1', signal, continuation })

    expect(request.text).toBe('')
    expect(request.attachmentTexts).toBeUndefined()
    expect(request.attachmentImages).toBeUndefined()
    expect(request.promptUuid).toBeUndefined()
    // 0166 D7 — 위임을 절반만 실으면 게이트 훅이 배치를 submitting 에 가둔다.
    expect(request.takeSteerFlush).toBe(base.takeSteerFlush)
    expect(request.commitSteerFlush).toBe(base.commitSteerFlush)
    expect(request.rollbackSteerFlush).toBe(base.rollbackSteerFlush)
    // 신선한 확장/모델/설정을 쓰고 cwd 는 원 턴을 유지한다.
    expect(request.extensions).toBe(continuation.extensions)
    expect(request.model).toBe('sonnet-next')
    expect(request.cwd).toBe('/workspace')
    expect(request.signal).toBe(signal)
  })
})

describe('buildFlushRequest', () => {
  const batch = {
    uuid: 'batch-1',
    ids: ['m-9'],
    text: '잔여 메시지',
    attachmentTexts: ['잔여 첨부']
  } as unknown as SteerFlushBatch

  it('batch 를 프롬프트로 싣고 continuity 표식을 떨어뜨린다', () => {
    const signal = new AbortController().signal

    const request = buildFlushRequest({
      base: baseRequest(),
      sessionId: 's-1',
      signal,
      batch,
      preludes: [],
      continuation
    })

    expect(request.text).toBe('잔여 메시지')
    expect(request.promptUuid).toBe('batch-1')
    expect(request.attachmentTexts).toEqual(['잔여 첨부'])
    expect(request.attachmentImages).toEqual([])
    // 승계하면 재분기(forkFrom)하고 telemetry 를 무효화(handoff)한다.
    expect('forkFrom' in request).toBe(false)
    expect('handoff' in request).toBe(false)
    // 원 요청의 프렐류드도 이월하지 않는다(이중 전달 방지).
    expect('preludes' in request).toBe(false)
    expect(request.extensions).toBe(continuation.extensions)
  })

  it('이번 라운드의 프렐류드가 있으면 그것만 싣는다', () => {
    const preludes = [{ uuid: 'p-9', ids: ['m-8'], text: '이월' } as unknown as SteerFlushBatch]

    const request = buildFlushRequest({
      base: baseRequest(),
      sessionId: 's-1',
      signal: new AbortController().signal,
      batch,
      preludes,
      continuation
    })

    expect(request.preludes).toBe(preludes)
  })
})

// 0188 — 구 구현은 listen 이 `env` 를 아예 싣지 않았고 flush 는 원 request spread 로 **옛**
// env 를 실었다. 그 비대칭이 continuation 마다 죽은 토큰으로 respawn 하게 만들었다.
describe('listen·flush 의 spawn 입력 대칭 (0188)', () => {
  it('둘 다 같은 providerSettings 와 env 를 싣는다', () => {
    const base = baseRequest()
    const signal = new AbortController().signal

    const listen = buildListenRequest({ base, sessionId: 's-1', signal, continuation })
    const flush = buildFlushRequest({
      base,
      sessionId: 's-1',
      signal,
      batch: { uuid: 'b-1', text: 'next' } as never,
      preludes: [],
      continuation
    })

    expect(listen.env).toEqual(continuation.prepared.env)
    expect(flush.env).toEqual(continuation.prepared.env)
    expect(listen.providerSettings).toBe(continuation.prepared.providerSettings)
    expect(flush.providerSettings).toBe(continuation.prepared.providerSettings)
  })
})

// 조립부가 계산한 fingerprint 를 spawn 기록부까지 나르는 두 지점 중 하나 (0190 AC1).
// listen·flush 가 **함께** 실어야 한다 — 한쪽만 실으면 그 경로만 spawn 마다 재계산으로 돌아간다.
describe('envFingerprint 승계 (0190)', () => {
  it('listen 과 flush 가 같은 값을 싣는다', () => {
    const listen = buildListenRequest({
      base: baseRequest(),
      sessionId: 's1',
      signal: new AbortController().signal,
      continuation
    })
    const flush = buildFlushRequest({
      base: baseRequest(),
      sessionId: 's1',
      signal: new AbortController().signal,
      batch: { uuid: 'u1', text: 'next' } as SteerFlushBatch,
      preludes: [],
      continuation
    })

    expect(listen.envFingerprint).toBe('fp-fresh')
    expect(flush.envFingerprint).toBe('fp-fresh')
  })
})
