// AppMessagePart(provider-runtime.md §7) 셀렉터 — 순서 보존 parts 를 transcript 렌더가 쓰는
// view 로 투영한다(순수). text/reasoning 추출, tool_call↔tool_result 페어링, error 추출.

import type {
  AppMessagePart,
  AttachmentView,
  DiffRequirementAnchor
} from '../../../../../shared/ipc'
import {
  resultMap,
  partParentToolRunId,
  toolCallFromPart
} from '../../../../../shared/history-panels/tool'
export * from '../../../../../shared/history-panels/tool'
import type { ToolCall } from '../reducer/chatReducer'
import type { ArtifactRef } from '../../../../../shared/artifacts'

export function partsArtifacts(parts: readonly AppMessagePart[]): ArtifactRef[] {
  const seen = new Set<string>()
  const fileIndexes = new Map<string, number>()
  const artifacts: ArtifactRef[] = []
  for (const part of parts) {
    if (part.type !== 'artifact' || seen.has(part.artifact.publicationId)) continue
    const artifact = part.artifact
    seen.add(artifact.publicationId)
    if (artifact.category === 'file') {
      const index = fileIndexes.get(artifact.filename)
      if (index !== undefined) {
        if (artifact.publishedAt >= artifacts[index].publishedAt) artifacts[index] = artifact
        continue
      }
      fileIndexes.set(artifact.filename, artifacts.length)
    }
    artifacts.push(artifact)
  }
  return artifacts
}

// text 파트들을 순서대로 이어붙인 본문(마크다운 소스). 서브에이전트 child 텍스트는 제외
// (메인 트랜스크립트/복사 대상이 아니라 우측 패널 child 트랜스크립트 전용).
export function isMainTextPart(
  part: AppMessagePart
): part is Extract<AppMessagePart, { type: 'text' }> {
  return part.type === 'text' && partParentToolRunId(part) === undefined
}

export function hasPartsText(parts: AppMessagePart[]): boolean {
  return parts.some((part) => isMainTextPart(part) && part.text.trim() !== '')
}

export function partsText(parts: AppMessagePart[]): string {
  let out = ''
  for (const p of parts) if (isMainTextPart(p)) out += p.text
  return out
}

// attachment 파트의 첨부 뷰들을 순서대로 평탄화한다(트랜스크립트 user 버블 썸네일).
export function partsAttachments(parts: AppMessagePart[]): AttachmentView[] {
  const out: AttachmentView[] = []
  for (const p of parts) if (p.type === 'attachment') out.push(...p.attachments)
  return out
}

export function partsDiffRequirements(parts: AppMessagePart[]): DiffRequirementAnchor[] {
  const requirements: DiffRequirementAnchor[] = []
  for (const part of parts) {
    if (part.type === 'diff_requirements') requirements.push(...part.requirements)
  }
  return requirements
}

export interface ReasoningItem {
  text: string
  signature?: string
}

// tool_call 을 같은 toolRunId 의 tool_result 와 페어링해 ToolCall view 로. 결과 미도착이면
// result 미포함(= '실행 중').
export function partsToolCalls(parts: AppMessagePart[]): ToolCall[] {
  const resultByRun = resultMap(parts)
  const calls: ToolCall[] = []
  for (const p of parts) {
    if (p.type === 'tool_call' && p.parentToolRunId === undefined) {
      calls.push(toolCallFromPart(p, resultByRun))
    }
  }
  return calls
}

// 콘텐츠 순서를 보존한 렌더 세그먼트 — parts 를 타입별로 뭉치지 않고,
// 만나는 순서대로 "연속 동종"을 묶어 분절한다(메시지 내부 "텍스트 → 도구 → 텍스트" 보존).
export type MessageSegment =
  | { kind: 'reasoning'; items: ReasoningItem[] } // 연속 reasoning 병합 → 1 ReasoningBlock
  | { kind: 'tools'; calls: ToolCall[] } // 연속 non-Ask 도구 병합 → 1 ToolGroup
  | { kind: 'ask'; call: ToolCall } // AskUserQuestion 은 개별 AskExchange
  | { kind: 'text'; text: string } // 연속 text 이어붙임 → 1 Markdown
  | { kind: 'error'; error: unknown } // 개별 카드
  | { kind: 'compact'; trigger?: 'manual' | 'auto'; preTokens?: number; postTokens?: number } // 압축 경계 구분선(0064, post=0065 r2)
  | { kind: 'fork' } // 분기 경계 구분선(0064 r5) — 복사된 원본 이력과 새 대화 사이
  // 백그라운드 서브에이전트 완료 통지(0143) — 독립 세그먼트(도구 그룹·텍스트에 미병합).
  // description 은 파트에 없다 — 렌더(SubagentNoticeRow)가 toolRunId 로 부모 Task 조인.
  | {
      kind: 'subagent_notice'
      toolRunId: string
      status: 'completed' | 'failed' | 'stopped'
      durationMs?: number
      summary?: string
    }

// segment 유무 판정의 정본 (0325 EP-2 ①). `messageSegments` 의 건너뛰기와 store 의 live 유무
// (`useHasLiveText` · `LiveTurnState.reasoningVisible`)가 같은 함수를 쓴다 — 두 곳에 두면 공백
// reasoning 에서 행 key 가 갈린다.
export function hasSegmentText(text: string): boolean {
  return text !== ''
}

export function hasSegmentReasoning(text: string): boolean {
  return text.trim() !== ''
}

// parts 를 순회하며 순서 보존 세그먼트 배열로 투영한다(순수). tool_result 는 toolRunId 로
// 선구축한 맵에서 페어링되며(partsToolCalls 와 동일 규칙) 순회 중에는 흡수(스킵)한다.
// file/diff(claude 미생성 seam)는 현재 미렌더 — OpenCode 어댑터 도입 시 채운다.
export function messageSegments(
  parts: AppMessagePart[],
  resultByRun: ReadonlyMap<string, NonNullable<ToolCall['result']>> = resultMap(parts)
): MessageSegment[] {
  const segments: MessageSegment[] = []
  for (const part of parts) {
    const segment = segmentForPart(part, resultByRun)
    if (!segment) continue
    const tail = segments.at(-1)
    if (!tail || !extendSegment(tail, segment)) segments.push(segment)
  }
  return segments
}

export function extendSegment(tail: MessageSegment, next: MessageSegment): boolean {
  if (tail.kind === 'text' && next.kind === 'text') tail.text += next.text
  else if (tail.kind === 'reasoning' && next.kind === 'reasoning') tail.items.push(...next.items)
  else if (tail.kind === 'tools' && next.kind === 'tools') tail.calls.push(...next.calls)
  else return false
  return true
}

export function segmentForPart(
  part: AppMessagePart,
  resultByRun: ReadonlyMap<string, NonNullable<ToolCall['result']>>
): MessageSegment | undefined {
  switch (part.type) {
    case 'text':
      return part.parentToolRunId === undefined && hasSegmentText(part.text)
        ? { kind: 'text', text: part.text }
        : undefined
    case 'reasoning':
      return part.parentToolRunId === undefined && hasSegmentReasoning(part.text)
        ? {
            kind: 'reasoning',
            items: [
              {
                text: part.text,
                ...(part.signature !== undefined ? { signature: part.signature } : {})
              }
            ]
          }
        : undefined
    case 'tool_call': {
      if (part.parentToolRunId !== undefined) return undefined
      const call = toolCallFromPart(part, resultByRun)
      return part.toolName === 'AskUserQuestion'
        ? { kind: 'ask', call }
        : { kind: 'tools', calls: [call] }
    }
    case 'error':
      return { kind: 'error', error: part.error }
    case 'compact_boundary':
      return {
        kind: 'compact',
        ...(part.trigger !== undefined ? { trigger: part.trigger } : {}),
        ...(part.preTokens !== undefined ? { preTokens: part.preTokens } : {}),
        ...(part.postTokens !== undefined ? { postTokens: part.postTokens } : {})
      }
    case 'fork_boundary':
      return { kind: 'fork' }
    case 'subagent_notice':
      return {
        kind: 'subagent_notice',
        toolRunId: part.toolRunId,
        status: part.status,
        ...(part.durationMs !== undefined ? { durationMs: part.durationMs } : {}),
        ...(part.summary !== undefined ? { summary: part.summary } : {})
      }
    default:
      return undefined
  }
}
