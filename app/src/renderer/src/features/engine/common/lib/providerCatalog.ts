// 하네스 공통 설정 편집 검증. native 템플릿은 harnesses/<name>/가 소유한다.
import type { MessageKey } from '../../../../shared/i18n'
// provider 이름 제약 — backend(normalizeProvider)와 동일. 빈 값/형식 위반을 미리 막는다.
const PROVIDER_NAME_RE = /^[A-Za-z0-9_-]+$/

export type ProviderNameValidation = { ok: true } | { ok: false; errorKey: MessageKey }

export function validateProviderName(name: string): ProviderNameValidation {
  const trimmed = name.trim()
  if (trimmed === '') return { ok: false, errorKey: 'engine.validation.nameRequired' }
  if (!PROVIDER_NAME_RE.test(trimmed)) {
    return { ok: false, errorKey: 'engine.validation.nameFormat' }
  }
  return { ok: true }
}

export type JsonValidation =
  { ok: true } | { ok: false; errorKey: MessageKey; params?: Record<string, unknown> }

// JSON.parse 의 "at position N" 을 사람이 읽을 줄·열로 환산 (toss 식 친절한 안내).
function locateError(text: string, raw: string): { line: number; col: number } | null {
  const match = /position (\d+)/.exec(raw)
  if (!match) return null
  const pos = Number(match[1])
  let line = 1
  let col = 1
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') {
      line += 1
      col = 1
    } else {
      col += 1
    }
  }
  return { line, col }
}

// settings.json 실시간 검증 — 빈 값/파싱 실패/비객체 최상위를 구분해 친절히 안내한다.
export function validateSettingsJson(text: string): JsonValidation {
  if (text.trim() === '') return { ok: false, errorKey: 'engine.validation.jsonRequired' }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    const raw = e instanceof Error ? e.message : null
    const at = raw ? locateError(text, raw) : null
    if (at) return { ok: false, errorKey: 'engine.validation.jsonSyntaxAt', params: at }
    // position 미검출 시 JSON.parse 원문(reason)을 그대로 통과, 원문조차 없으면 별도 키.
    if (raw) return { ok: false, errorKey: 'engine.validation.jsonSyntax', params: { reason: raw } }
    return { ok: false, errorKey: 'engine.validation.jsonSyntaxUnknown' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errorKey: 'engine.validation.topLevelObject' }
  }
  return { ok: true }
}
