import { describe, expect, it } from 'vitest'
import { decidePostTurnStep, postTurnHoldsSession } from './post-turn'

// 턴-후 스텝 판정(0143) — 핵심 불변식: pushTurn(flush)은 "채널 생존 + CLI 유휴 + 백로그 없음"
// 에서만. mid-turn flush 가 auto-turn terminal 오귀속(steer 세션 사망)을 만들던 경로를 차단한다.
const base = {
  havePending: false,
  haveTasks: false,
  channelAlive: true,
  channelBusy: false,
  hasBacklog: false
}

describe('decidePostTurnStep (0143)', () => {
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

// 세션 점유 신호(0153 F1) — renderer 의 busy(listening)를 구동한다. 구 구조는 `listen` 에서만
// 신호를 보내 `flush` 구간을 renderer 가 idle 로 오판했고, 그 창의 send 가 낙관 커밋 경로를 타
// 잔여보다 **앞에** 렌더됐다(DB 는 반대 순서 → 재시작 시 위치 재조정).
describe('postTurnHoldsSession (0153)', () => {
  it('flush 는 세션을 붙든다 — 구 구조가 놓쳤던 구간', () => {
    expect(postTurnHoldsSession('flush')).toBe(true)
  })

  it('listen 은 세션을 붙든다 (0143 종전 동작 유지)', () => {
    expect(postTurnHoldsSession('listen')).toBe(true)
  })

  it('break 만 세션을 놓는다 — 정상 턴 종료에서 listening 깜빡임 없음', () => {
    expect(postTurnHoldsSession('break')).toBe(false)
  })

  it('held pending 이 있으면 어떤 스텝이 나오든 세션을 붙든다(전수)', () => {
    for (const state of [
      { ...base, havePending: true },
      { ...base, havePending: true, channelBusy: true },
      { ...base, havePending: true, hasBacklog: true },
      { ...base, havePending: true, channelAlive: false }
    ]) {
      expect(postTurnHoldsSession(decidePostTurnStep(state))).toBe(true)
    }
  })
})
