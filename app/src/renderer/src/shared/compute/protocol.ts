// 계산 레인은 강조와 diff를 처리하고, Markdown 레인은 임차한 문서 범위를 파싱한다.

import type { MarkdownSegmentRange } from '../markdown/markdownSegments'
import type { AppMessagePart } from '../../../../shared/ipc'
import type { Root } from 'hast'
import type { ThemedToken } from 'shiki'
import {
  diffSourceKey,
  diffSourceDocs,
  type DiffSourceRef,
  type AxisRef,
  type LineNumbers,
  type DiffOptions
} from './diffSource'
import type { diffViewRows, diffViewContext, diffViewLocate } from './diffView'
import type { DiffStat, DiffStatSource } from './diffStats'
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
export type Lane = 'compute' | 'markdown' | 'image'
export interface TableChunk {
  headerEnd: number
  rows: readonly [number, number]
}
export interface MarkdownRequest {
  table?: TableChunk
  kind: 'markdown'
  doc: DocRef
  start: number
  end: number
}
export interface ViewRef {
  doc: DocRef
  transform: 'stripGutter'
}
export type CodeSource = { doc: DocRef } | { view: ViewRef }
export interface CodeViewRequest {
  kind: 'codeView'
  source: CodeSource
  start: number
  end: number
}
export type TokenSource = CodeSource | { axis: AxisRef }
export type TokensRequest = TokenSource & {
  kind: 'tokens'
  lang: string
  theme: ComputeTheme
  start: number
  end: number
}
export type WireControl =
  | { type: 'doc.open'; ref: DocRef; text: string; lines?: LineNumbers }
  | { type: 'doc.close'; ref: DocRef }
export const docKey = (ref: DocRef): string => `${ref.id}@${ref.revision}`
export function laneOf(kind: ComputeRequest['kind']): Lane {
  if (kind === 'markdown') return 'markdown'
  if (kind === 'imageThumb') return 'image'
  return 'compute'
}
export interface ImageThumbRequest {
  kind: 'imageThumb'
  attachmentId: string
  mimeType: string
  data: string
  pixels: number
}

export interface HistoryBodyRequest {
  kind: 'historyBody'
  sequence: number
  packet: { offset: number; base64: string } | null
  bytes: number
}

export type ComputeRequest =
  | { kind: 'markdownLayout'; sequence: number; source: string }
  | HistoryBodyRequest
  | ImageThumbRequest
  | HighlightRequest
  | DiffTokensRequest
  | { kind: 'diffStat'; sequence: number; sources: readonly DiffStatSource[] }
  | DiffLinesRequest
  | MarkdownRequest
  | TokensRequest
  | CodeViewRequest
  | { kind: 'diffView'; source: DiffSourceRef; options: DiffOptions; start: number; end: number }
  | {
      kind: 'diffLocate'
      source: DiffSourceRef
      options: DiffOptions
      anchors: readonly { oldLine: number | null; newLine: number | null }[]
    }
  | { kind: 'diffContext'; source: DiffSourceRef; ignoreWhitespace: boolean; lineIndex: number }

export type TokenRows = ThemedToken[][]

export const sourceDoc = (source: CodeSource): DocRef =>
  'doc' in source ? source.doc : source.view.doc
export const sourceKey = (source: CodeSource): string =>
  'doc' in source ? docKey(source.doc) : docKey(source.view.doc) + '|' + source.view.transform
export const tokenSourceKey = (s: TokenSource): string =>
  'axis' in s
    ? [diffSourceKey(s.axis.source), s.axis.ignoreWhitespace ? 'w' : 'k', s.axis.axis].join('|')
    : sourceKey(s)
export function requestDocs(request: ComputeRequest): DocRef[] {
  switch (request.kind) {
    case 'tokens':
      return 'axis' in request ? diffSourceDocs(request.axis.source) : [sourceDoc(request)]
    case 'diffView':
    case 'diffLocate':
    case 'diffContext':
      return diffSourceDocs(request.source)
    case 'codeView':
      return [sourceDoc(request.source)]
    case 'markdown':
      return [request.doc]
    default:
      return []
  }
}
export interface ComputeResults {
  imageThumb: { thumbnail: string | null }
  diffView: ReturnType<typeof diffViewRows>
  diffLocate: ReturnType<typeof diffViewLocate>
  diffContext: ReturnType<typeof diffViewContext>
  codeView: {
    lineCount: number
    widthColumns: number
    textChars: number
    charsBefore: number
    lines: string[]
  }
  tokens: { rows: TokenRows }
  markdown: { hast: Root }
  markdownLayout: { segments: MarkdownSegmentRange[] }
  historyBody: {
    parts: AppMessagePart[]
    nextOffset: number
    layouts?: { index: number; segments: MarkdownSegmentRange[] }[]
  }
  highlight: { html: string }
  diffTokens: { old: TokenRows | null; new: TokenRows | null }
  diffLines: { lines: DiffLine[] }
  diffStat: DiffStat
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
    case 'markdownLayout':
      return [request.kind, request.sequence].join(SEP)
    case 'historyBody':
      return [request.kind, request.sequence, request.packet?.offset ?? 'close'].join(SEP)
    case 'imageThumb':
      return ['imageThumb', request.attachmentId].join(SEP)
    case 'tokens':
      return [
        'tokens',
        tokenSourceKey(request),
        request.lang,
        request.theme,
        request.start,
        request.end
      ].join(SEP)
    case 'diffContext':
      return [
        request.kind,
        diffSourceKey(request.source),
        Number(request.ignoreWhitespace),
        request.lineIndex
      ].join(SEP)
    case 'diffView':
    case 'diffLocate': {
      const { layout, ignoreWhitespace, highlightWords, expansions } = request.options
      const tail =
        request.kind === 'diffView'
          ? [request.start, request.end]
          : [request.anchors.map((a) => (a.oldLine ?? '-') + ':' + (a.newLine ?? '-')).join(',')]
      return [
        request.kind,
        diffSourceKey(request.source),
        layout,
        Number(ignoreWhitespace),
        Number(highlightWords),
        expansions.map(([a, b]) => a + ':' + b).join(','),
        ...tail
      ].join(SEP)
    }
    case 'codeView':
      return ['codeView', sourceKey(request.source), request.start, request.end].join(SEP)
    case 'markdown':
      return [
        'markdown',
        docKey(request.doc),
        request.start,
        request.end,
        ...(request.table ? [request.table.headerEnd, ...request.table.rows] : [])
      ].join(SEP)
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
    case 'diffStat':
      return 'diffStat:' + request.sequence
    case 'diffLines':
      return ['diffLines', request.oldValue.length, request.oldValue, request.newValue].join(SEP)
  }
}

export interface DocumentSample {
  chars: number
  lines: number
}

// 대기 순서를 정하는 입력 크기(문자 수).
export function requestSize(
  request: ComputeRequest,
  lengthOf: (ref: DocRef) => DocumentSample
): number {
  switch (request.kind) {
    case 'markdownLayout':
      return request.source.length
    case 'historyBody':
      return request.packet?.base64.length ?? 0
    case 'imageThumb':
      return request.pixels
    case 'diffContext':
    case 'diffView':
    case 'codeView':
    case 'tokens': {
      let chars = 0
      let lines = 0
      for (const ref of requestDocs(request)) {
        const sample = lengthOf(ref)
        chars += sample.chars
        lines += sample.lines
      }
      const rows = request.kind === 'diffContext' ? 7 : request.end - request.start
      return rows * (chars / lines)
    }
    case 'diffLocate':
      return request.anchors.length * 16
    case 'markdown':
      return request.end - request.start
    case 'highlight':
      return request.code.length
    case 'diffTokens':
      return (request.oldText?.length ?? 0) + (request.newText?.length ?? 0)
    case 'diffStat':
      return request.sources.reduce(
        (sum, source) =>
          sum +
          (source.kind === 'patch'
            ? source.patch.length
            : source.before.length + source.after.length),
        0
      )
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
  if ('added' in result) return 2 * COMPUTE_RESULT_ELEMENT_CHARS
  if ('thumbnail' in result) return result.thumbnail?.length ?? 0
  if ('summary' in result) return JSON.stringify(result).length
  if ('rowIndex' in result) return result.rowIndex.length * 8
  if ('lineCount' in result)
    return result.lines.reduce((sum, line) => sum + COMPUTE_RESULT_ELEMENT_CHARS + line.length, 0)
  if ('rows' in result) return rowsSize(result.rows)
  if ('segments' in result || 'parts' in result) return 0 // Body assembly requests are never cached.
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
