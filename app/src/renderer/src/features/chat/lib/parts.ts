// AppMessagePart(provider-runtime.md §7) 셀렉터 — 순서 보존 parts 를 transcript 렌더가 쓰는
// view 로 투영한다(순수). text/reasoning 추출, tool_call↔tool_result 페어링, error 추출.

import type { AppMessagePart, AttachmentView } from '../../../../../shared/ipc'
import type { ToolCall } from '../reducer/chatReducer'

// text 파트들을 순서대로 이어붙인 본문(마크다운 소스).
export function partsText(parts: AppMessagePart[]): string {
  let out = ''
  for (const p of parts) if (p.type === 'text') out += p.text
  return out
}

// attachment 파트의 첨부 뷰들을 순서대로 평탄화한다(트랜스크립트 user 버블 썸네일).
export function partsAttachments(parts: AppMessagePart[]): AttachmentView[] {
  const out: AttachmentView[] = []
  for (const p of parts) if (p.type === 'attachment') out.push(...p.attachments)
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
      if (p.text.trim() === '') continue // 빈/공백 reasoning 은 빈 카드라 스킵(빈 text 와 동형)
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

// ── 세그먼트 identity 보존 reconcile (0008) ─────────────────────────────────
//
// messageSegments 는 호출마다 새 세그먼트/ToolCall view 객체를 만든다 — 그대로 렌더에 쓰면
// tool.call.* 커밋 한 번에 메시지 내 모든 세그먼트·카드가 재렌더된다. reducer 는 parts 객체의
// identity 를 보존하므로(appendAssistantPart 는 배열만 복사), 이전 렌더의 세그먼트와 필드
// identity 로 대조해 "내용이 같으면 이전 객체를 재사용"하면 하위 memo 컴포넌트(ToolsSegment·
// ToolCard·ReasoningBlock…)가 shallow 비교만으로 재렌더를 건너뛴다 → 커밋 1건의 재렌더가
// "변경된 카드 1개"로 좁혀진다.

function resultEquals(a: ToolCall['result'], b: ToolCall['result']): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.output === b.output && a.isError === b.isError && a.durationMs === b.durationMs
}

function toolCallEquals(a: ToolCall, b: ToolCall): boolean {
  return (
    a.toolUseId === b.toolUseId &&
    a.name === b.name &&
    a.input === b.input &&
    resultEquals(a.result, b.result)
  )
}

function reasoningItemEquals(a: ReasoningItem, b: ReasoningItem): boolean {
  return a.text === b.text && a.signature === b.signature
}

function reconcileSegment(prev: MessageSegment, next: MessageSegment): MessageSegment {
  if (prev.kind !== next.kind) return next
  switch (next.kind) {
    case 'text':
      return prev.kind === 'text' && prev.text === next.text ? prev : next
    case 'reasoning': {
      if (prev.kind !== 'reasoning' || prev.items.length !== next.items.length) return next
      for (let i = 0; i < next.items.length; i++) {
        if (!reasoningItemEquals(prev.items[i], next.items[i])) return next
      }
      return prev
    }
    case 'tools': {
      if (prev.kind !== 'tools') return next
      const calls: ToolCall[] = new Array(next.calls.length)
      let changed = prev.calls.length !== next.calls.length
      for (let i = 0; i < next.calls.length; i++) {
        const pc = prev.calls[i]
        if (pc && toolCallEquals(pc, next.calls[i])) {
          calls[i] = pc
        } else {
          calls[i] = next.calls[i]
          changed = true
        }
      }
      return changed ? { kind: 'tools', calls } : prev
    }
    case 'ask':
      return prev.kind === 'ask' && toolCallEquals(prev.call, next.call) ? prev : next
    case 'structured':
      return prev.kind === 'structured' && prev.value === next.value ? prev : next
    case 'error':
      return prev.kind === 'error' && prev.error === next.error ? prev : next
  }
}

// 이전 렌더의 세그먼트 배열과 새로 계산한 배열을 대조해 변하지 않은 세그먼트(와 그 안의
// ToolCall view)의 identity 를 재사용한다(순수). 전부 동일하면 prev 배열 자체를 반환.
export function reconcileSegments(
  prev: MessageSegment[] | null,
  next: MessageSegment[]
): MessageSegment[] {
  if (!prev || prev.length === 0) return next
  let changed = prev.length !== next.length
  const out: MessageSegment[] = new Array(next.length)
  for (let i = 0; i < next.length; i++) {
    const p = prev[i]
    const r = p ? reconcileSegment(p, next[i]) : next[i]
    if (r !== p) changed = true
    out[i] = r
  }
  return changed ? out : prev
}
