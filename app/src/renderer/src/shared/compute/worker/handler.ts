// 워커의 요청 처리 (0324 AR-01) — 요청 하나를 받아 결과 하나를 낸다. `self` 를 보지 않는 순수
// 함수라 vitest 가 그대로 부른다. 배선은 `compute.worker.ts` 가 한다.

import { TOKENIZE_MAX_LINE_CHARS, TOKENIZE_LINE_TIME_LIMIT_MS } from '../limits'
import { diffLines, lineDiff, parsePatch } from 'diff'
import { countDiffStats } from '../diffStats'
import { hunksToDiffLines } from '../diffModel'
import {
  resultSize,
  type ComputeRequest,
  type ComputeResult,
  type TokenRows,
  type WireRequest,
  type WireResponse
} from '../protocol'
import { markdownLayout } from '../../markdown/markdownSegments'
import { decodeHistoryBody } from './historyBody'
import { getHighlighter } from './highlighter'

export async function compute(request: ComputeRequest): Promise<ComputeResult> {
  switch (request.kind) {
    case 'markdownLayout':
      return { segments: markdownLayout(request.source) }
    case 'historyBody':
      return decodeHistoryBody(request)
    case 'imageThumb':
    case 'codeView':
    case 'diffView':
    case 'diffLocate':
    case 'diffContext':
    case 'tokens':
    case 'markdown':
      throw new Error('wrong-lane')
    case 'highlight': {
      const highlighter = await getHighlighter()
      return {
        html: highlighter.codeToHtml(request.code, {
          lang: request.lang,
          theme: request.theme,
          tokenizeMaxLineLength: TOKENIZE_MAX_LINE_CHARS,
          tokenizeTimeLimit: TOKENIZE_LINE_TIME_LIMIT_MS
        })
      }
    }
    case 'diffTokens': {
      const highlighter = await getHighlighter()
      const rows = (text: string | null): TokenRows | null =>
        text === null
          ? null
          : highlighter.codeToTokens(text, {
              lang: request.lang,
              theme: request.theme,
              tokenizeMaxLineLength: TOKENIZE_MAX_LINE_CHARS,
              tokenizeTimeLimit: TOKENIZE_LINE_TIME_LIMIT_MS
            }).tokens
      return { old: rows(request.oldText), new: rows(request.newText) }
    }
    case 'diffStat':
      return countDiffStats(
        request.sources,
        (before, after) => {
          // A complete rewrite has no common subsequence. Count jsdiff's exact line
          // tokens directly instead of constructing a quadratic edit frontier.
          const oldLines = lineDiff.tokenize(before, {})
          const newLines = lineDiff.tokenize(after, {})
          const oldSet = new Set(oldLines)
          if (!newLines.some((line) => oldSet.has(line))) {
            return [
              { removed: true, count: oldLines.length },
              { added: true, count: newLines.length }
            ]
          }
          return diffLines(before, after)
        },
        parsePatch
      )
    case 'diffLines':
      return { lines: hunksToDiffLines(diffLines(request.oldValue, request.newValue)) }
  }
}

// 계산이 던지면 그 요청만 실패 응답이 된다 — 워커는 계속 산다.
export async function handleMessage(message: WireRequest): Promise<WireResponse> {
  try {
    const result = await compute(message)
    // 결과 크기는 워커가 센다 — UI 스레드의 캐시는 이 값만 쓴다(0325 EP-5 ①).
    return { id: message.id, ok: true, result, size: resultSize(result) }
  } catch (error) {
    return {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
