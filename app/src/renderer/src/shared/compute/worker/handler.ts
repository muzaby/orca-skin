// 워커의 요청 처리 (0324 AR-01) — 요청 하나를 받아 결과 하나를 낸다. `self` 를 보지 않는 순수
// 함수라 vitest 가 그대로 부른다. 배선은 `compute.worker.ts` 가 한다.

import { diffLines } from 'diff'
import { hunksToDiffLines } from '../diffModel'
import type {
  ComputeRequest,
  ComputeResult,
  TokenRows,
  WireRequest,
  WireResponse
} from '../protocol'
import { getHighlighter } from './highlighter'

export async function compute(request: ComputeRequest): Promise<ComputeResult> {
  switch (request.kind) {
    case 'highlight': {
      const highlighter = await getHighlighter()
      return {
        html: highlighter.codeToHtml(request.code, { lang: request.lang, theme: request.theme })
      }
    }
    case 'diffTokens': {
      const highlighter = await getHighlighter()
      const rows = (text: string | null): TokenRows | null =>
        text === null
          ? null
          : highlighter.codeToTokens(text, { lang: request.lang, theme: request.theme }).tokens
      return { old: rows(request.oldText), new: rows(request.newText) }
    }
    case 'diffLines':
      return { lines: hunksToDiffLines(diffLines(request.oldValue, request.newValue)) }
  }
}

// 계산이 던지면 그 요청만 실패 응답이 된다 — 워커는 계속 산다.
export async function handleMessage(message: WireRequest): Promise<WireResponse> {
  try {
    return { id: message.id, ok: true, result: await compute(message) }
  } catch (error) {
    return {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
