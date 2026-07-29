import { describe, expect, it } from 'vitest'
import { shouldQueueAsPending } from './sendAdmission'

// 0153 — 낙관 커밋(0068)이 정당한 조건의 명시. main 이 이 메시지를 **즉시** 턴 프롬프트로 쓸 때만
// 참이고, 그 밖에는 예약 경로여야 라이브 버블 순서가 main 커밋 순서(DB `idx`)와 일치한다.
describe('shouldQueueAsPending (0153)', () => {
  const idle = { inflight: false, listening: false, pendingCount: 0 }

  it('완전 유휴 → 낙관 커밋 허용 (통상 첫 send 반응성 보존)', () => {
    expect(shouldQueueAsPending(idle)).toBe(false)
  })

  it('내 턴 진행 중 → 예약', () => {
    expect(shouldQueueAsPending({ ...idle, inflight: true })).toBe(true)
  })

  it('턴-후 체인 진행 중(listening) → 예약 (0143)', () => {
    expect(shouldQueueAsPending({ ...idle, listening: true })).toBe(true)
  })

  it('**핵심** — inflight·listening 이 모두 false 여도 미확정 예약이 있으면 예약', () => {
    // 관측된 순서 역전의 판정 지점: telemetry 로 inflight 가 내려가고 chat.listen started 가
    // 아직 도착하지 않은 창. 잔여 예약이 보이는 이상 이 메시지는 그 뒤에 커밋된다.
    expect(shouldQueueAsPending({ ...idle, pendingCount: 3 })).toBe(true)
  })
})
