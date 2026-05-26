// 채팅 transcript 에서 쓰이는 시간/JSON 포맷 유틸. 컴포넌트 간 공유 — ChatTile 분해 시
// 한 곳에 모음 (구 frame/ChatTile.tsx 내부에 있었던 formatTimeShort/formatTimeFull/stringify).

// 표시용 짧은 형식: 오늘이면 '오전 11:44', 다른 날이면 '5월 13일'
export function formatTimeShort(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d)
  }
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(d)
}

// 툴팁용 전체 형식: '2026. 5. 12. 오전 11:03:09'
export function formatTimeFull(ms: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date(ms))
}

export function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
