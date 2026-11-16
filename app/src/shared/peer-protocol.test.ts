// 피어 계약 (0324 VP-39) — 메서드마다 보내는 쪽이 만든 봉투를 받는 쪽 판정이 받아들이고,
// 반대 방향·틀린 봉투·모르는 이름은 거부한다.

import { describe, expect, it } from 'vitest'
import { PEER_METHODS, PeerMessageSchema, peerMessageFits, type PeerMethod } from './peer-protocol'

describe('peer-protocol', () => {
  it('메서드마다 보낸 쪽의 봉투는 통과하고, 반대 방향으로 보내면 거부된다', () => {
    for (const method of Object.keys(PEER_METHODS) as PeerMethod[]) {
      const spec = PEER_METHODS[method]
      const message =
        spec.kind === 'request'
          ? { kind: 'request' as const, id: 1, method, payload: {} }
          : { kind: 'notify' as const, method, payload: {} }
      const parsed = PeerMessageSchema.parse(message)
      expect(peerMessageFits(parsed, spec.from), method).toBe(true)
      expect(peerMessageFits(parsed, spec.from === 'agent' ? 'data' : 'agent'), method).toBe(false)
      // 봉투를 바꾸면 거부된다.
      const swapped =
        spec.kind === 'request'
          ? PeerMessageSchema.parse({ kind: 'notify', method })
          : PeerMessageSchema.parse({ kind: 'request', id: 2, method })
      expect(peerMessageFits(swapped, spec.from), `${method} swapped`).toBe(false)
    }
  })

  it('모르는 메서드·음수 id·결과의 오류 문장 누락은 스키마에서 거부된다', () => {
    expect(PeerMessageSchema.safeParse({ kind: 'notify', method: 'nope' }).success).toBe(false)
    expect(
      PeerMessageSchema.safeParse({ kind: 'request', id: -1, method: 'turn.commitUser' }).success
    ).toBe(false)
    expect(PeerMessageSchema.safeParse({ kind: 'result', id: 1, ok: false }).success).toBe(false)
    expect(PeerMessageSchema.safeParse({ kind: 'result', id: 1, ok: true }).success).toBe(true)
  })

  it('F1 저장 스트림은 에이전트 → 데이터, 설정 사본은 데이터 → 에이전트다', () => {
    expect(PEER_METHODS['turn.event']).toEqual({ from: 'agent', kind: 'notify' })
    expect(PEER_METHODS['turn.commitUser']).toEqual({ from: 'agent', kind: 'request' })
    expect(PEER_METHODS['provider.event']).toEqual({ from: 'agent', kind: 'request' })
    expect(PEER_METHODS['settings.patch']).toEqual({ from: 'data', kind: 'notify' })
    expect(PEER_METHODS['agent.call']).toEqual({ from: 'data', kind: 'request' })
  })
})
