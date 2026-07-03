import type { SessionTitleSource } from '../infra/db/types'

export const MAX_AUTO_TITLE_LENGTH = 60

export interface ShouldGenerateTitleInput {
  isNewSession: boolean
  titleSource: SessionTitleSource | null
  alreadyStarted: boolean
  sessionId: string | null
  firstUserText: string | null
}

export function titlePrompt(firstUserText: string): string {
  return [
    '다음 첫 사용자 메시지를 바탕으로 대화 목록에 표시할 짧은 제목을 하나만 작성하세요.',
    '',
    '규칙:',
    '- 첫 사용자 메시지의 언어를 따르세요.',
    '- 60자 이하로 작성하세요.',
    '- 따옴표, 마침표, 설명, 접두어 없이 제목만 출력하세요.',
    '- 코드/로그/붙여넣기가 포함되어도 핵심 의도를 요약하세요.',
    '',
    '첫 사용자 메시지:',
    firstUserText
  ].join('\n')
}

export function normalizeTitle(raw: string): string | null {
  let title = raw.replace(/\s+/g, ' ').trim()
  title = stripSymmetricQuotes(title).trim()
  title = title.replace(/[.。．]+$/u, '').trim()
  if (title.length > MAX_AUTO_TITLE_LENGTH) title = title.slice(0, MAX_AUTO_TITLE_LENGTH).trim()
  title = stripSymmetricQuotes(title).trim()
  return title === '' ? null : title
}

export function shouldGenerateTitle(input: ShouldGenerateTitleInput): boolean {
  return (
    input.isNewSession &&
    !input.alreadyStarted &&
    input.sessionId != null &&
    input.firstUserText != null &&
    input.firstUserText.trim() !== '' &&
    input.titleSource !== 'user'
  )
}

function stripSymmetricQuotes(value: string): string {
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['‘', '’'],
    ['「', '」'],
    ['『', '』'],
    ['《', '》'],
    ['〈', '〉'],
    ['`', '`']
  ]
  let next = value
  let changed = true
  while (changed && next.length >= 2) {
    changed = false
    for (const [open, close] of pairs) {
      if (next.startsWith(open) && next.endsWith(close)) {
        next = next.slice(open.length, next.length - close.length).trim()
        changed = true
      }
    }
  }
  return next
}
