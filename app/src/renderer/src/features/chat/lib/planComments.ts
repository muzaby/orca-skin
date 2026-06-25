import type { PlanFeedback } from '../../../../../shared/ipc'
import type { PlanComment } from '../reducer/chatReducer'

// 계획 패널 코멘트(렌더러 상태) → IPC PlanFeedback 변환. 본문이 빈 코멘트는 제거하고,
// start 오프셋 오름차순(문서 순서)으로 정렬한다. note 는 trim 후 비면 생략한다.
// 실제 구조화 태그 직렬화는 main(prompts/plan-feedback.ts)이 담당 — 여기선 데이터만 만든다.
export function toPlanFeedback(comments: PlanComment[], note: string): PlanFeedback {
  const cleaned = comments
    .filter((c) => c.body.trim() !== '')
    .map((c) => ({ id: c.id, quote: c.quote, start: c.start, end: c.end, body: c.body.trim() }))
    .sort((a, b) => a.start - b.start)
  const trimmedNote = note.trim()
  return { comments: cleaned, ...(trimmedNote !== '' ? { note: trimmedNote } : {}) }
}

// 코멘트 칩/팝오버 헤더에 보일 인용 스니펫 — 공백 정규화 + max 초과 시 말줄임.
export function quoteSnippet(quote: string, max = 60): string {
  const normalized = quote.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return normalized.slice(0, max - 1).trimEnd() + '…'
}

// 전송 가능 여부 — 본문 있는 코멘트가 1개 이상이거나 note 가 비어있지 않으면 true.
export function hasSendablePlanFeedback(comments: PlanComment[], note: string): boolean {
  return comments.some((c) => c.body.trim() !== '') || note.trim() !== ''
}
