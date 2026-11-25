import type { ToolCall } from './types'
import { isRecord } from '../obj'

export interface WorkSearchResult {
  title: string
  url: string
}

export function stringField(input: unknown, key: string): string | undefined {
  const value = isRecord(input) ? input[key] : undefined
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

export function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// wire text 블록은 표시용 텍스트로 읽는다. 다른 content 종류는 JSON 형태를 유지한다.
export function textContent(value: unknown): unknown {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isRecord(item) && item.type === 'text' && typeof item.text === 'string')
  )
    return value.map((item) => (item as { text: string }).text).join('\n\n')
  return value
}

// SDK WebSearch의 Links 배열만 해석한다. 문자열 속 대괄호/이스케이프를 건너뛰므로
// 정규식의 첫 `]` 절단으로 실제 제목/URL을 잃지 않는다.
function wireLinks(text: string): unknown {
  const match = /(?:^|\n)Links:\s*(\[)/.exec(text)
  if (!match) return undefined
  const start = match.index + match[0].lastIndexOf('[')
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '[') depth++
    else if (char === ']' && --depth === 0) return readJson(text.slice(start, index + 1))
  }
  return undefined
}

export function workSearchResults(call: ToolCall): WorkSearchResult[] {
  if (call.name !== 'WebSearch' || !call.result) return []
  const output = textContent(call.result.output)
  const parsed = typeof output === 'string' ? readJson(output) : output
  const source =
    isRecord(parsed) && Array.isArray(parsed.results)
      ? parsed.results
      : typeof output === 'string'
        ? wireLinks(output)
        : undefined
  if (!Array.isArray(source)) return []
  const candidates = source.flatMap((item) =>
    isRecord(item) && Array.isArray(item.content) ? item.content : [item]
  )
  const links: WorkSearchResult[] = []
  const seen = new Set<string>()
  for (const item of candidates) {
    const title = stringField(item, 'title')
    const url = stringField(item, 'url')
    if (!title || !url || seen.has(url)) continue
    try {
      const parsedUrl = new URL(url)
      if (
        !['https:', 'http:'].includes(parsedUrl.protocol) ||
        parsedUrl.username ||
        parsedUrl.password
      )
        continue
      links.push({ title, url })
      seen.add(url)
    } catch {
      // malformed/relative URL은 링크로 만들지 않으며 원문 응답에는 그대로 남는다.
    }
  }
  return links
}
