// 상대 시각 계산 — "마지막 업데이트" 표기용(설정 사용량 동기화, 0080). 순수 함수, 로케일 무관.
// then/now 는 epoch ms. 미래(then>now)나 1분 미만은 'now', 그 외 분/시간/일 단위 데이터를
// 반환한다. 사람이 읽는 문장은 renderer i18n 카탈로그가 만든다(formatRelativeTime, 0100).

export interface RelativeTime {
  unit: 'now' | 'minute' | 'hour' | 'day'
  value: number
}

export function relativeTime(then: number, now: number = Date.now()): RelativeTime {
  const deltaSec = Math.floor((now - then) / 1000)
  if (deltaSec < 60) return { unit: 'now', value: 0 }
  const min = Math.floor(deltaSec / 60)
  if (min < 60) return { unit: 'minute', value: min }
  const hr = Math.floor(min / 60)
  if (hr < 24) return { unit: 'hour', value: hr }
  return { unit: 'day', value: Math.floor(hr / 24) }
}
