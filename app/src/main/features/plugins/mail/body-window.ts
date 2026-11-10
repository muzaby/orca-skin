export const MAIL_GET_DEFAULT_CHARS = 8_000
export const MAIL_GET_MAX_CHARS = 16_000
export const MAIL_SEARCH_SNIPPET_CHARS = 300

function splitsPair(text: string, offset: number): boolean {
  const before = text.charCodeAt(offset - 1)
  const after = text.charCodeAt(offset)
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff
}

export function sliceBody(
  text: string,
  offset = 0,
  maxChars = MAIL_GET_DEFAULT_CHARS
): {
  offset: number
  returnedChars: number
  text: string
  totalChars: number
  nextOffset: number | null
} {
  let start = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0
  const size =
    Number.isSafeInteger(maxChars) && maxChars >= 1
      ? Math.min(maxChars, MAIL_GET_MAX_CHARS)
      : MAIL_GET_DEFAULT_CHARS
  if (splitsPair(text, start)) start -= 1
  let end = Math.min(start + size, text.length)
  if (splitsPair(text, end)) end -= 1
  if (end === start && start < text.length) end = start + 2
  const body = text.slice(start, end)
  return {
    offset: start,
    returnedChars: body.length,
    text: body,
    totalChars: text.length,
    nextOffset: end < text.length ? end : null
  }
}
