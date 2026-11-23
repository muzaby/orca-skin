// 계산 레인은 강조와 diff를 처리하고, Markdown 레인은 임차한 문서 범위를 파싱한다.

import type { Root } from 'hast'
import type { ThemedToken } from 'shiki'
import type { DiffLine } from './diffModel'
import { COMPUTE_RESULT_ELEMENT_CHARS } from './limits'

export type ComputeTheme = 'github-light' | 'github-dark'

export interface HighlightRequest {
  kind: 'highlight'
  code: string
  lang: string
  theme: ComputeTheme
}

// 삭제된 주석·문자열이 새 파일의 문법 상태를 오염시키지 않도록 두 축을 따로 읽는다.
// 축에 줄이 없으면 `null` 이다(빈 줄 하나인 축 `''` 과 구별한다).
export interface DiffTokensRequest {
  kind: 'diffTokens'
  oldText: string | null
  newText: string | null
  lang: string
  theme: ComputeTheme
}

export interface DiffLinesRequest {
  kind: 'diffLines'
  oldValue: string
  newValue: string
}

export interface DocRef {
  id: string
  revision: number
}
export type Lane = 'compute' | 'markdown'
export interface MarkdownRequest {
  kind: 'markdown'
  doc: DocRef
  start: number
  end: number
}
export interface TokensRequest {
  kind: 'tokens'
  doc: DocRef
  lang: string
  theme: ComputeTheme
  start: number
  end: number
}
export type WireControl =
  { type: 'doc.open'; ref: DocRef; text: string } | { type: 'doc.close'; ref: DocRef }
export const docKey = (ref: DocRef): string => `${ref.id}@${ref.revision}`
export function laneOf(kind: ComputeRequest['kind']): Lane {
  return kind === 'markdown' ? 'markdown' : 'compute'
}
export type ComputeRequest =
  HighlightRequest | DiffTokensRequest | DiffLinesRequest | MarkdownRequest | TokensRequest

export type TokenRows = ThemedToken[][]

export interface ComputeResults {
  tokens: { rows: TokenRows }
  markdown: { hast: Root } | { tooLarge: true }
  highlight: { html: string }
  diffTokens: { old: TokenRows | null; new: TokenRows | null }
  diffLines: { lines: DiffLine[] }
}

export type ComputeResult = ComputeResults[ComputeRequest['kind']]

export type WireRequest = ComputeRequest & { id: number; resumeFrom?: number; discard?: number[] }
// 성공 응답의 `size` 는 워커가 센 결과 크기(`resultSize`)다 — UI 스레드는 결과를 순회해 크기를 세지 않는다
// (0325 D-011 · EP-5 ①). 숫자가 아니면 캐시에 넣지 않는다(결과는 전달).
export type WireResponse =
  | { id: number; ok: true; result: ComputeResult; size: number }
  | { id: number; ok: 'continue' }
  | { id: number; ok: false; error: string }

const SEP = '\u0000'

// 같은 `(종류, 언어, 테마, 내용)` 은 같은 키다.
export function requestKey(request: ComputeRequest): string {
  switch (request.kind) {
    case 'tokens':
      return [
        'tokens',
        docKey(request.doc),
        request.lang,
        request.theme,
        request.start,
        request.end
      ].join(SEP)
    case 'markdown':
      return ['markdown', docKey(request.doc), request.start, request.end].join(SEP)
    case 'highlight':
      return ['highlight', request.lang, request.theme, request.code].join(SEP)
    case 'diffTokens':
      return [
        'diffTokens',
        request.lang,
        request.theme,
        request.oldText === null ? 'n' : 's',
        request.oldText ?? '',
        request.newText === null ? 'n' : 's',
        request.newText ?? ''
      ].join(SEP)
    case 'diffLines':
      return ['diffLines', request.oldValue.length, request.oldValue, request.newValue].join(SEP)
  }
}

// 대기 순서를 정하는 입력 크기(문자 수).
export function requestSize(request: ComputeRequest): number {
  switch (request.kind) {
    case 'tokens':
    case 'markdown':
      return request.end - request.start
    case 'highlight':
      return request.code.length
    case 'diffTokens':
      return (request.oldText?.length ?? 0) + (request.newText?.length ?? 0)
    case 'diffLines':
      return request.oldValue.length + request.newValue.length
  }
}

const rowsSize = (rows: TokenRows | null): number =>
  rows?.reduce(
    (sum, row) =>
      sum +
      COMPUTE_RESULT_ELEMENT_CHARS +
      row.reduce((n, token) => n + COMPUTE_RESULT_ELEMENT_CHARS + token.content.length, 0),
    0
  ) ?? 0

// 캐시 상한에 세는 결과 크기(문자 수) — 결과 문자 + 줄·행·토큰 객체마다 `COMPUTE_RESULT_ELEMENT_CHARS`
// (html 은 문자만). 빈 줄만 내는 거대 결과도 비용이 0 이 아니다(0325 D-038 · §8 X5). 워커가 센다.
export function resultSize(result: ComputeResult): number {
  if ('rows' in result) return rowsSize(result.rows)
  if ('tooLarge' in result) return 1
  if ('hast' in result) return JSON.stringify(result.hast).length
  if ('html' in result) return result.html.length
  if ('lines' in result)
    return result.lines.reduce(
      (sum, line) => sum + COMPUTE_RESULT_ELEMENT_CHARS + line.text.length,
      0
    )
  return rowsSize(result.old) + rowsSize(result.new)
}

// 워커가 보낸 값을 응답으로 읽는다. 형식이 아니면 `null`.
export function parseResponse(raw: unknown): WireResponse | null {
  if (typeof raw !== 'object' || raw === null) return null
  const message = raw as Record<string, unknown>
  if (typeof message.id !== 'number') return null
  if (message.ok === true && typeof message.result === 'object' && message.result !== null) {
    return {
      id: message.id,
      ok: true,
      result: message.result as ComputeResult,
      size: typeof message.size === 'number' ? message.size : Number.NaN
    }
  }
  if (message.ok === 'continue') return { id: message.id, ok: 'continue' }
  if (message.ok === false && typeof message.error === 'string') {
    return { id: message.id, ok: false, error: message.error }
  }
  return null
}
