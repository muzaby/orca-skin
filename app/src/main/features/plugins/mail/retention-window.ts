// 14일 보관 경계와 수집 중단 판정의 SSOT (ΔV4 · D-062 · EP-28).
//
// 경계 계산이 두 사본이면 한쪽만 바뀌어도 수집과 정리가 서로 다른 날짜를 믿는다.
// 중단 판정을 여기 두는 이유는 `sync-manager`가 better-sqlite3를 import하는 파일이라
// 그 안의 클로저로는 판정만 따로 부를 수 없기 때문이다 — `protection.ts`·`freshness.ts`와
// 같은 순수 모듈 자리다.

export const RETENTION_DAYS = 14
// §14의 수렴 논증이 쓰는 유예창. 연속으로 이만큼 경계 밖이면 더 과거만 남았다고 본다.
export const INGEST_GRACE = 50

export function retentionCutoff(now: number, retentionDays: number = RETENTION_DAYS): number {
  return now - retentionDays * 24 * 60 * 60 * 1000
}

export type IngestAction = 'fetch' | 'skip' | 'stop'

export interface IngestDecision {
  readonly action: IngestAction
  // 호출자가 누적 변수를 따로 들지 않도록 다음 카운터를 결과로 돌려준다 (EP-28 ②).
  readonly consecutiveOld: number
}

/**
 * 메시지 하나의 헤더 날짜로 수집 여부를 정한다.
 *
 * **연속** 카운트다 (D-062). 경계 안의 메일을 만나면 카운터를 0으로 되돌린다 — 누적으로 세면
 * 날짜가 뒤섞인 사서함에서 옛 메일이 흩어져 있을 때 그 아래의 최근 메일을 건너뛴다.
 * 날짜를 읽지 못한 메일(`null`)은 건너뛰지 않는다. 판정 근거가 없는 유실을 만들지 않는다.
 */
export function decideIngest(input: {
  readonly headerDate: number | null
  readonly cutoff: number
  readonly consecutiveOld: number
  readonly grace?: number
}): IngestDecision {
  const grace = input.grace ?? INGEST_GRACE
  if (input.headerDate === null || input.headerDate >= input.cutoff) {
    return { action: 'fetch', consecutiveOld: 0 }
  }
  const consecutiveOld = input.consecutiveOld + 1
  return { action: consecutiveOld >= grace ? 'stop' : 'skip', consecutiveOld }
}
