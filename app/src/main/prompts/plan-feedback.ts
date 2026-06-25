import type { PlanFeedback, PlanFeedbackComment } from '../../shared/ipc'

// 계획 검토(plan_review) revise 의 구조화 코멘트를 ExitPlanMode deny message 로 직렬화한다.
// prompts/attachment.ts 와 동일 규율: 영문 instruction(모델 입력 안정성, handoff 0039) +
// sentinel 블록 + attribute escaping + content 태그 + sentinel/닫는태그 neutralize.

const START_SENTINEL = 'ORCA_PLAN_FEEDBACK_START'
const END_SENTINEL = 'ORCA_PLAN_FEEDBACK_END'
const COMMENT_START_SENTINEL = 'ORCA_PLAN_COMMENT_START'
const COMMENT_END_SENTINEL = 'ORCA_PLAN_COMMENT_END'

const INSTRUCTION =
  'The user reviewed your proposed plan and left inline comments anchored to quoted ' +
  'regions of the plan. Revise the plan to address every comment. Text in <quote> is the ' +
  "referenced plan region (reference data); text in <comment> is the user's instruction to " +
  'act on.'

// 인용문 직렬화 상한 — 긴 선택은 앞부분만 남기고 절삭(range 속성이 전체 구간을 가리키므로
// 모델이 위치를 특정하는 데 충분). 패널 하이라이트는 원본 오프셋을 쓰므로 영향 없다.
const MAX_QUOTE_CHARS = 200

function escapeAttribute(value: string | number | boolean): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 사용자 콘텐츠가 sentinel/닫는 태그를 흉내내 블록 구조를 깨거나 인젝션하는 것을 차단한다.
function neutralize(text: string): string {
  return text
    .replaceAll('<<<ORCA_PLAN_FEEDBACK', '<<<ORCA_PLAN_FEEDBACK_ESCAPED')
    .replaceAll('<<<ORCA_PLAN_COMMENT', '<<<ORCA_PLAN_COMMENT_ESCAPED')
    .replaceAll('</quote>', '<\\/quote>')
    .replaceAll('</comment>', '<\\/comment>')
    .replaceAll('</note>', '<\\/note>')
}

// 인용문은 한 줄로 정규화(연속 공백/개행 → 단일 공백)하고 MAX_QUOTE_CHARS 초과 시 절삭한다.
// 패널 하이라이트는 원본 오프셋을 쓰므로 영향 없다(정규화·절삭은 직렬화 한정).
function normalizeQuote(quote: string): string {
  const normalized = quote.replace(/\s+/g, ' ').trim()
  if (normalized.length <= MAX_QUOTE_CHARS) return normalized
  return normalized.slice(0, MAX_QUOTE_CHARS).trimEnd() + '…'
}

function formatComment(comment: PlanFeedbackComment, index: number): string {
  const attrs = [
    `id="${escapeAttribute(comment.id)}"`,
    `index="${index}"`,
    `range="${escapeAttribute(comment.start)}-${escapeAttribute(comment.end)}"`
  ].join(' ')
  return [
    `<<<${COMMENT_START_SENTINEL} ${attrs}>>>`,
    `<quote>${neutralize(normalizeQuote(comment.quote))}</quote>`,
    `<comment>${neutralize(comment.body.trim())}</comment>`,
    `<<<${COMMENT_END_SENTINEL} id="${escapeAttribute(comment.id)}">>>`
  ].join('\n')
}

// PlanFeedback → 구조화 태그 문자열. 코멘트는 start 오프셋 오름차순(문서 순서)으로 정렬한다.
// 코멘트가 0개여도 note 가 있으면 블록을 만든다(note 만 전송하는 경로).
export function formatPlanFeedbackPrompt(feedback: PlanFeedback): string {
  const comments = [...feedback.comments].sort((a, b) => a.start - b.start)
  const note = feedback.note?.trim() ?? ''

  const parts: string[] = [`<<<${START_SENTINEL} count="${comments.length}">>>`, INSTRUCTION, '']
  comments.forEach((comment, i) => {
    parts.push(formatComment(comment, i + 1))
    parts.push('')
  })
  if (note !== '') {
    parts.push(`<note>${neutralize(note)}</note>`)
  }
  parts.push(`<<<${END_SENTINEL}>>>`)
  return parts.join('\n')
}
