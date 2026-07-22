import { describe, expect, it } from 'vitest'
import { decidePostTurnStep } from './post-turn'

// 턴-후 스텝 판정(0143) — 핵심 불변식: pushTurn(flush)은 "채널 생존 + CLI 유휴 + 백로그 없음"
// 에서만. mid-turn flush 가 auto-turn terminal 오귀속(steer 세션 사망)을 만들던 경로를 차단한다.
describe('decidePostTurnStep (0143)', () => {
  const base = {
    havePending: false,
    haveTasks: false,
    channelAlive: true,
    channelBusy: false,
    hasBacklog: false
  }

  it('할 일 없음(유휴) → break', () => {
    expect(decidePostTurnStep(base)).toBe('break')
  })

  it('미정착 태스크 존재 → listen (0138 게이트 폐기 — 상시 개방)', () => {
    expect(decidePostTurnStep({ ...base, haveTasks: true })).toBe('listen')
  })

  it('held pending + 유휴 채널 → flush', () => {
    expect(decidePostTurnStep({ ...base, havePending: true })).toBe('flush')
  })

  it('held pending + CLI mid-turn → listen 드레인 선행 (버그 a 핵심)', () => {
    expect(decidePostTurnStep({ ...base, havePending: true, channelBusy: true })).toBe('listen')
  })

  it('held pending + unframed 백로그 잔존 → listen 드레인 선행', () => {
    expect(decidePostTurnStep({ ...base, havePending: true, hasBacklog: true })).toBe('listen')
  })

  it('채널 사망 + held → flush (respawn 콜드 패스)', () => {
    expect(
      decidePostTurnStep({ ...base, channelAlive: false, havePending: true, channelBusy: true })
    ).toBe('flush')
  })

  it('채널 사망 + held 없음 → break (태스크가 남아도 들을 채널 없음)', () => {
    expect(decidePostTurnStep({ ...base, channelAlive: false, haveTasks: true })).toBe('break')
  })

  it('태스크 + held 동시 존재 + 유휴 → flush 우선(held 가 곧 커밋), listen 은 재평가로', () => {
    expect(decidePostTurnStep({ ...base, havePending: true, haveTasks: true })).toBe('flush')
  })
})
