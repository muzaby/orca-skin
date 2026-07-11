// 상대 시각 라벨 — "마지막 업데이트" 표기용(설정 사용량 동기화, 0080). 순수 함수.
// then/now 는 epoch ms. 미래(then>now)나 1분 미만은 "방금", 그 외 분/시간/일 단위.
// locale 은 UI 표시 언어(0096). 이 레이어는 의존성 0 이라 i18next 카탈로그 대신
// 인라인 ko/en 사전을 쓴다 — 기본값 'ko' 로 기존 호출자와 하위 호환.

export type TimeLocale = 'ko' | 'en'

export function relativeTimeLabel(
  then: number,
  now: number = Date.now(),
  locale: TimeLocale = 'ko'
): string {
  const deltaSec = Math.floor((now - then) / 1000)
  if (deltaSec < 60) return locale === 'ko' ? '방금' : 'just now'
  const min = Math.floor(deltaSec / 60)
  if (min < 60) {
    if (locale === 'ko') return `${min}분 전`
    return min === 1 ? '1 minute ago' : `${min} minutes ago`
  }
  const hr = Math.floor(min / 60)
  if (hr < 24) {
    if (locale === 'ko') return `${hr}시간 전`
    return hr === 1 ? '1 hour ago' : `${hr} hours ago`
  }
  const day = Math.floor(hr / 24)
  if (locale === 'ko') return `${day}일 전`
  return day === 1 ? '1 day ago' : `${day} days ago`
}
