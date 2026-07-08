// 상대 시각 라벨(한국어) — "마지막 업데이트" 표기용(설정 사용량 동기화, 0080). 순수 함수.
// then/now 는 epoch ms. 미래(then>now)나 1분 미만은 "방금", 그 외 분/시간/일 단위.

export function relativeTimeLabel(then: number, now: number = Date.now()): string {
  const deltaSec = Math.floor((now - then) / 1000)
  if (deltaSec < 60) return '방금'
  const min = Math.floor(deltaSec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  return `${day}일 전`
}
