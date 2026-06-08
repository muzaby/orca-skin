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

// structured_output 파트들의 value.
export function partsStructured(parts: AppMessagePart[]): unknown[] {
  const out: unknown[] = []
  for (const p of parts) if (p.type === 'structured_output') out.push(p.value)
  return out
}

// 콘텐츠 순서를 보존한 렌더 세그먼트 — parts 를 타입별로 뭉치지 않고,
// 만나는 순서대로 "연속 동종"을 묶어 분절한다(메시지 내부 "텍스트 → 도구 → 텍스트" 보존).
export type MessageSegment =
  | { kind: 'reasoning'; items: ReasoningItem[] } // 연속 reasoning 병합 → 1 ReasoningBlock
  | { kind: 'tools'; calls: ToolCall[] } // 연속 non-Ask 도구 병합 → 1 ToolGroup
  | { kind: 'ask'; call: ToolCall } // AskUserQuestion 은 개별 AskExchange
  | { kind: 'text'; text: string } // 연속 text 이어붙임 → 1 Markdown
  | { kind: 'structured'; value: unknown } // 개별 카드
  | { kind: 'error'; error: unknown } // 개별 카드

// parts 를 순회하며 순서 보존 세그먼트 배열로 투영한다(순수). tool_result 는 toolRunId 로
// 선구축한 맵에서 페어링되며(partsToolCalls 와 동일 규칙) 순회 중에는 흡수(스킵)한다.
// file/diff(claude 미생성 seam)는 현재 미렌더 — OpenCode 어댑터 도입 시 채운다.
export function messageSegments(parts: AppMessagePart[]): MessageSegment[] {
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

  const segments: MessageSegment[] = []
  let current: MessageSegment | null = null

  for (const p of parts) {
    if (p.type === 'tool_result') continue // 맵으로 흡수
    if (p.type === 'text') {
      if (p.text === '') continue
      if (current?.kind === 'text') current.text += p.text
      else segments.push((current = { kind: 'text', text: p.text }))
    } else if (p.type === 'reasoning') {
      const item: ReasoningItem = {
        text: p.text,
        ...(p.signature !== undefined ? { signature: p.signature } : {})
      }
      if (current?.kind === 'reasoning') current.items.push(item)
      else segments.push((current = { kind: 'reasoning', items: [item] }))
    } else if (p.type === 'tool_call') {
      const result = resultByRun.get(p.toolRunId)
      const call: ToolCall = {
        toolUseId: p.toolRunId,
        name: p.toolName,
        input: p.args,
        ...(result ? { result } : {})
      }
      if (p.toolName === 'AskUserQuestion') {
        segments.push((current = { kind: 'ask', call }))
      } else if (current?.kind === 'tools') {
        current.calls.push(call)
      } else {
        segments.push((current = { kind: 'tools', calls: [call] }))
      }
    } else if (p.type === 'structured_output') {
      segments.push((current = { kind: 'structured', value: p.value }))
    } else if (p.type === 'error') {
      segments.push((current = { kind: 'error', error: p.error }))
    }
  }

  return segments
}
