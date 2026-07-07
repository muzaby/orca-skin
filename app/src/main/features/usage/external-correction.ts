// 외부 사용량 보정 seam (후속 핸드오프 구현 대기) — 현재는 no-op.
//
// 기본 동작(폴백)은 Orca 로컬 추적(turn_usage 원장) 기준 남은 한도 계산이다. 다만 사용자는
// Orca 밖에서도 같은 계정으로 사용할 수 있어, 로컬 추적만으로는 실제 남은 한도를 과대평가한다.
// 향후 앱 시작/주기(예: 5분)마다 외부 소스(Claude 사용 사례에 한해 SDK 로 근사 추적)로
// 남은 한도를 보정할 수 있어야 한다. 그 배선의 계약점을 여기 인터페이스로 고정해 둔다.
//
// **이번 범위는 seam(인터페이스 + no-op 구현)만** — 폴링·SDK 호출·타이머는 후속에서 붙인다.

export interface UsageCorrectionSource {
  // 외부에서 관측한 "남은 한도(USD)"를 반환한다. 관측 불가·비지원이면 null → 로컬 폴백 사용.
  fetchRemaining(): Promise<number | null>
}

// 항상 null(보정 없음) — 로컬 폴백만 쓰게 한다.
export class NoopCorrectionSource implements UsageCorrectionSource {
  async fetchRemaining(): Promise<number | null> {
    return null
  }
}
