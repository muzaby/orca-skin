import { describe, expect, it } from 'vitest'
import { decidePostTurnStep, postTurnHoldsSession } from './post-turn'

// 턴-후 스텝 판정(0143) — 핵심 불변식: pushTurn(flush)은 "채널 생존 + CLI 유휴 + 백로그 없음"
// 에서만. mid-turn flush 가 auto-turn terminal 오귀속(steer 세션 사망)을 만들던 경로를 차단한다.
const base = {
  havePending: false,
  haveTasks: false,
  channelAlive: true,
  channelBusy: false,
  hasBacklog: false,
  haveUnconfirmed: false
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

// 미확정 예약 유예(0154) — CLI 에 넘겼으나 echo 를 못 받은 배치가 있으면 턴 체인을 끊지 않는다.
// 구 구조는 held 만 보는 havePending 하나로 판정해, 마지막 게이트 flush 직후 terminal 이 오면
// "기다린 적 없이" 고아 판정 → 폐기 → message.cancelled 가 나갔다. 실측(세션 8c70aacd)에서 그
// 배치는 CLI 큐에 살아 있었고 다음 턴에 정상 답변까지 나왔다 — 버블만 우리가 지운 것이다.
describe('decidePostTurnStep — 미확정 예약 유예 (0154)', () => {
  it('held 없음 + 미확정 예약 존재 → break 가 아니라 listen (핵심)', () => {
    expect(decidePostTurnStep({ ...base, haveUnconfirmed: true })).toBe('listen')
  })

  it('유예는 배치당 1회 — orphaned 강등 후(=haveUnconfirmed false) break 에 도달한다', () => {
    // 호출자가 listen 을 열며 submitted→orphaned 로 강등한다. 이 술어는 submitted 만 세므로
    // 재평가에서 미확정 사유가 사라져 무한 대기가 불가능하다.
    expect(decidePostTurnStep({ ...base, haveUnconfirmed: true })).toBe('listen')
    expect(decidePostTurnStep({ ...base, haveUnconfirmed: false })).toBe('break')
  })

  it('held 가 있으면 flush 가 우선 — 유예가 flush 를 가로채지 않는다', () => {
    expect(decidePostTurnStep({ ...base, havePending: true, haveUnconfirmed: true })).toBe('flush')
  })

  it('채널 사망 + 미확정 → break (CLI 큐가 서브프로세스와 함께 사라져 들을 것이 없다)', () => {
    expect(decidePostTurnStep({ ...base, channelAlive: false, haveUnconfirmed: true })).toBe(
      'break'
    )
  })

  it('미확정 사유의 listen 도 세션을 붙든다(0153 F1 과 정합)', () => {
    expect(postTurnHoldsSession(decidePostTurnStep({ ...base, haveUnconfirmed: true }))).toBe(true)
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
