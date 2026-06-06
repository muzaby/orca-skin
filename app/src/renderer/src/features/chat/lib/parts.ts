// AppMessagePart(provider-runtime.md §7) 셀렉터 — 순서 보존 parts 를 transcript 렌더가 쓰는
// view 로 투영한다(순수). text/reasoning 추출, tool_call↔tool_result 페어링, error 추출.

import type { AppMessagePart } from '../../../../../shared/ipc'
import type { ToolCall } from '../reducer/chatReducer'

// text 파트들을 순서대로 이어붙인 본문(마크다운 소스).
export function partsText(parts: AppMessagePart[]): string {
  let out = ''
  for (const p of parts) if (p.type === 'text') out += p.text
  return out
}

export interface ReasoningItem {
  text: string
  signature?: string
}

// reasoning(확장사고) 블록들 — 순서 보존.
export function partsReasoning(parts: AppMessagePart[]): ReasoningItem[] {
  const items: ReasoningItem[] = []
  for (const p of parts) {
    if (p.type === 'reasoning') {
      items.push({ text: p.text, ...(p.signature !== undefined ? { signature: p.signature } : {}) })
    }
  }
  return items
}

// tool_call 을 같은 toolRunId 의 tool_result 와 페어링해 ToolCall view 로. 결과 미도착이면
// result 미포함(= '실행 중').
export function partsToolCalls(parts: AppMessagePart[]): ToolCall[] {
  const resultByRun = new Map<string, NonNullable<ToolCall['result']>>()
  for (const p of parts) {
    if (p.type === 'tool_result') {
      resultByRun.set(p.toolRunId, {
        output: p.result,
        isError: p.isError,
        ...(p.durationMs !== undefined ? { durationMs: p.durationMs } : {})
      })
    }
  }
  const calls: ToolCall[] = []
  for (const p of parts) {
    if (p.type === 'tool_call') {
      const result = resultByRun.get(p.toolRunId)
      calls.push({
        toolUseId: p.toolRunId,
        name: p.toolName,
        input: p.args,
        ...(result ? { result } : {})
      })
    }
  }
  return calls
}

// error 파트들의 payload(렌더는 간단 텍스트화).
export function partsErrors(parts: AppMessagePart[]): unknown[] {
  const errs: unknown[] = []
  for (const p of parts) if (p.type === 'error') errs.push(p.error)
  return errs
}
