// 계산 클라이언트 ↔ 워커 메시지 계약 (0324 AR-01). 요청 3종 — 구문 강조 HTML · diff 두 축의
// 토큰 · diff 줄. 워커는 상태를 갖지 않고 요청 하나에 응답 하나를 낸다.

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

export type ComputeRequest = HighlightRequest | DiffTokensRequest | DiffLinesRequest

export type TokenRows = ThemedToken[][]

export interface ComputeResults {
  highlight: { html: string }
  diffTokens: { old: TokenRows | null; new: TokenRows | null }
  diffLines: { lines: DiffLine[] }
}

export type ComputeResult = ComputeResults[ComputeRequest['kind']]

export type WireRequest = ComputeRequest & { id: number }
// 성공 응답의 `size` 는 워커가 센 결과 크기(`resultSize`)다 — UI 스레드는 결과를 순회해 크기를 세지 않는다
// (0325 D-011 · EP-5 ①). 숫자가 아니면 캐시에 넣지 않는다(결과는 전달).
export type WireResponse =
  | { id: number; ok: true; result: ComputeResult; size: number }
  | { id: number; ok: false; error: string }

const SEP = '\u0000'

// 같은 `(종류, 언어, 테마, 내용)` 은 같은 키다.
export function requestKey(request: ComputeRequest): string {
  switch (request.kind) {
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
  if (message.ok === false && typeof message.error === 'string') {
    return { id: message.id, ok: false, error: message.error }
  }
  return null
}
