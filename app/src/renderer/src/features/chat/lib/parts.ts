// AppMessagePart(provider-runtime.md §7) 셀렉터 — 순서 보존 parts 를 transcript 렌더가 쓰는
// view 로 투영한다(순수). text/reasoning 추출, tool_call↔tool_result 페어링, error 추출.

import type { AppMessagePart, AttachmentView } from '../../../../../shared/ipc'
import type { Message, ToolCall } from '../reducer/chatReducer'

// 파트의 parentToolRunId(서브에이전트 child 표식) 조회 — 4종 파트가 옵션 필드로 가질 수 있다.
function partParentToolRunId(p: AppMessagePart): string | undefined {
  return 'parentToolRunId' in p ? p.parentToolRunId : undefined
}

// parentToolRunId 를 제거한 파트 사본 — child 트랜스크립트 안에서 최상위 파트로 취급되게 한다.
// 타입 안전을 위해 종류별로 재구성한다(spread + parentToolRunId:undefined 는 union 초과속성 에러).
function stripParentToolRunId(p: AppMessagePart): AppMessagePart {
  switch (p.type) {
    case 'text':
      return { type: 'text', text: p.text }
    case 'reasoning':
      return {
        type: 'reasoning',
        text: p.text,
        ...(p.signature !== undefined ? { signature: p.signature } : {})
      }
    case 'tool_call':
      return {
        type: 'tool_call',
        toolRunId: p.toolRunId,
        toolName: p.toolName,
        args: p.args
      }
    case 'tool_result':
      return {
        type: 'tool_result',
        toolRunId: p.toolRunId,
        result: p.result,
        isError: p.isError,
        ...(p.durationMs !== undefined ? { durationMs: p.durationMs } : {})
      }
    default:
      return p
  }
}

// text 파트들을 순서대로 이어붙인 본문(마크다운 소스). 서브에이전트 child 텍스트는 제외
// (메인 트랜스크립트/복사 대상이 아니라 우측 패널 child 트랜스크립트 전용).
export function partsText(parts: AppMessagePart[]): string {
  let out = ''
  for (const p of parts)
    if (p.type === 'text' && partParentToolRunId(p) === undefined) out += p.text
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

// reasoning(확장사고) 블록들 — 순서 보존. 서브에이전트 child 사고는 제외(메인 비노출).
export function partsReasoning(parts: AppMessagePart[]): ReasoningItem[] {
  const items: ReasoningItem[] = []
  for (const p of parts) {
    if (p.type === 'reasoning' && partParentToolRunId(p) === undefined) {
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
        ...(p.durationMs !== undefined ? { durationMs: p.durationMs } : {}),
        ...(p.parentToolRunId !== undefined ? { parentToolRunId: p.parentToolRunId } : {}),
        ...(p.subagentMeta !== undefined ? { subagentMeta: p.subagentMeta } : {})
      })
    }
  }
  const calls: ToolCall[] = []
  for (const p of parts) {
    if (p.type === 'tool_call' && p.parentToolRunId === undefined) {
      const result = resultByRun.get(p.toolRunId)
      calls.push({
        toolUseId: p.toolRunId,
        name: p.toolName,
        input: p.args,
        ...(p.parentToolRunId !== undefined ? { parentToolRunId: p.parentToolRunId } : {}),
        ...(result ? { result } : {})
      })
    }
  }
  return calls
}

// 재시작/크래시로 미완료(DB complete=0 = Message.incomplete)로 남은 메시지의 열린 도구 보정 —
// tool_result 가 없는 tool_call 마다 합성 aborted tool_result 를 붙여, 결과 미도착으로 인한
// "실행 중" 무한 렌더를 끝낸다. 기존 isAbortedResult/deriveSubagentTaskStatus 가 abort 마커를
// 인식해 "중단됨"으로 렌더하므로 별도 분기 불필요. 정상 종료(IpcRouter.shutdown)가 디스크에 이미
// 결과를 적어두면 orphan 이 없어 no-op = 크래시(will-quit 미발생) 백스톱.
//
// **로드(하이드레이션) 경로 전용** — 라이브 스트리밍 메시지(아직 결과 안 온 도구가 정당)에는
// 적용하지 않는다. LOAD_SESSION 에서 incomplete 메시지에만 호출한다(RECV_EVENT 라이브 경로 미경유).
export function settleOrphanToolParts(parts: AppMessagePart[]): AppMessagePart[] {
  const haveResult = new Set<string>()
  for (const p of parts) if (p.type === 'tool_result') haveResult.add(p.toolRunId)
  const synthesized: AppMessagePart[] = []
  for (const p of parts) {
    if (p.type !== 'tool_call' || haveResult.has(p.toolRunId)) continue
    synthesized.push({
      type: 'tool_result',
      toolRunId: p.toolRunId,
      result: { reason: 'aborted', message: '중단되었습니다' },
      isError: true,
      ...(p.parentToolRunId !== undefined ? { parentToolRunId: p.parentToolRunId } : {})
    })
  }
  return synthesized.length === 0 ? parts : [...parts, ...synthesized]
}

export type SubagentTaskStatus = 'running' | 'completed' | 'failed' | 'aborted'

export interface SubagentTaskSummary {
  toolUseId: string
  description: string
  status: SubagentTaskStatus
  // 부모 Task tool_call 이 속한 메시지의 createdAt(ms) — 백그라운드 작업 목록의 시간 표시용.
  createdAtMs: number
  childToolCount: number
  toolCountLabel: string
  durationLabel: string | null
  tokenLabel: string | null
  // 표시 모델 라벨(예: 'Haiku 4.5') — subagentMeta.model 매핑 우선, 없으면 agentLabel/subagent_type.
  agentLabel: string
  // subagent_type(예: 'Explore') — 모델과 별개의 에이전트 종류. 상세 타이틀 보조 표기용.
  subagentType: string | null
  // 진행 중일 때 마지막으로 실행 중인 child 도구명(예: 'Bash') — 단일 항목 메타 라인용.
  currentChildLabel: string | null
  call: ToolCall
}

function isToolCallPart(p: AppMessagePart): p is Extract<AppMessagePart, { type: 'tool_call' }> {
  return p.type === 'tool_call'
}

function isToolResultPart(
  p: AppMessagePart
): p is Extract<AppMessagePart, { type: 'tool_result' }> {
  return p.type === 'tool_result'
}

function toolCallFromPart(
  p: Extract<AppMessagePart, { type: 'tool_call' }>,
  resultByRun: Map<string, NonNullable<ToolCall['result']>>
): ToolCall {
  const result = resultByRun.get(p.toolRunId)
  return {
    toolUseId: p.toolRunId,
    name: p.toolName,
    input: p.args,
    ...(p.parentToolRunId !== undefined ? { parentToolRunId: p.parentToolRunId } : {}),
    ...(result ? { result } : {})
  }
}

function resultMap(parts: AppMessagePart[]): Map<string, NonNullable<ToolCall['result']>> {
  const resultByRun = new Map<string, NonNullable<ToolCall['result']>>()
  for (const p of parts) {
    if (isToolResultPart(p)) {
      resultByRun.set(p.toolRunId, {
        output: p.result,
        isError: p.isError,
        ...(p.durationMs !== undefined ? { durationMs: p.durationMs } : {}),
        ...(p.parentToolRunId !== undefined ? { parentToolRunId: p.parentToolRunId } : {}),
        ...(p.subagentMeta !== undefined ? { subagentMeta: p.subagentMeta } : {})
      })
    }
  }
  return resultByRun
}

export function childMessageForParentToolRunId(
  messages: Message[],
  parentToolRunId: string
): Message | null {
  const parts: AppMessagePart[] = []
  for (const message of messages) {
    for (const part of message.parts) {
      // tool_call/tool_result 뿐 아니라 child 의 text/reasoning(서브에이전트 답변·사고)도 모은다 —
      // 완료된 서브에이전트의 실제 답변 텍스트가 child 트랜스크립트에 순서대로 렌더되게 한다.
      if (partParentToolRunId(part) === parentToolRunId) {
        // parentToolRunId 를 벗겨 child 트랜스크립트 안에서는 최상위 파트로 취급되게 한다 —
        // messageSegments/partsToolCalls/partsText 는 parentToolRunId 가 있는 파트를 메인
        // 트랜스크립트에서 제외(스킵)하므로, 벗기지 않으면 우측 패널 child 가 비어 렌더된다.
        parts.push(stripParentToolRunId(part))
      }
    }
  }
  if (parts.length === 0) return null
  return { role: 'assistant', createdAt: Date.now(), parts }
}

export function subagentTasksFromMessages(messages: Message[]): SubagentTaskSummary[] {
  const allParts = messages.flatMap((m) => m.parts)
  const resultByRun = resultMap(allParts)
  // 최상위 tool_call → 그 파트가 속한 메시지의 createdAt. flatMap 은 메시지 경계를 잃으므로
  // 시간 표시를 위해 별도 순회로 toolRunId 별 createdAt 을 모은다(부모 Task 카드 시간 표시용).
  const createdAtByRun = new Map<string, number>()
  for (const message of messages) {
    for (const part of message.parts) {
      if (isToolCallPart(part) && part.parentToolRunId === undefined) {
        createdAtByRun.set(part.toolRunId, message.createdAt)
      }
    }
  }
  const childCounts = new Map<string, number>()
  // 부모 Task → 마지막으로 결과 미도착(진행 중)인 child 도구명. 단일 항목 '· Bash · N' 메타용.
  const currentChild = new Map<string, string>()
  for (const part of allParts) {
    if (isToolCallPart(part) && part.parentToolRunId !== undefined) {
      childCounts.set(part.parentToolRunId, (childCounts.get(part.parentToolRunId) ?? 0) + 1)
      if (!resultByRun.has(part.toolRunId)) currentChild.set(part.parentToolRunId, part.toolName)
    }
  }
  const summaries: SubagentTaskSummary[] = []
  for (const part of allParts) {
    if (
      isToolCallPart(part) &&
      part.parentToolRunId === undefined &&
      isAgentTaskName(part.toolName)
    ) {
      const call = toolCallFromPart(part, resultByRun)
      const meta = call.result?.subagentMeta
      // 도구수·소요시간은 SDK 누산 메타(영속)를 우선, 없으면 child 파트 파생/result.durationMs.
      const toolCount = meta?.toolUses ?? childCounts.get(call.toolUseId) ?? 0
      summaries.push({
        toolUseId: call.toolUseId,
        description: toolDescriptionFromInput(call.input) ?? call.name,
        status: deriveSubagentTaskStatus(call),
        createdAtMs: createdAtByRun.get(call.toolUseId) ?? Date.now(),
        childToolCount: toolCount,
        toolCountLabel: `${toolCount} 도구 사용`,
        durationLabel: formatDurationLabel(meta?.durationMs ?? call.result?.durationMs),
        tokenLabel: tokenLabelFromResult(call.result?.output),
        agentLabel: agentModelFromCall(call),
        subagentType: subagentTypeFromCall(call),
        currentChildLabel: currentChild.get(call.toolUseId) ?? null,
        call
      })
    }
  }
  return summaries
}

export function isAgentTaskName(name: string): boolean {
  return name === 'Task' || name === 'Agent'
}

// 부모 Task 결과가 "백그라운드로 시작됨"(async_launched) 인지 — run_in_background 로 띄운
// 서브에이전트의 Agent tool_result 는 즉시 { status:'async_launched', agentId, … } 성공을
// 반환하고(SDK AgentOutput), 진짜 종료(완료/실패/중지)는 나중에 task_notification 으로 온다.
// 따라서 이 임시 결과는 "완료"가 아니라 "실행 중"으로 취급한다(settled 알림이 덮어쓸 때까지).
export function isAsyncLaunchedResult(result: ToolCall['result']): boolean {
  if (!result) return false
  const o = result.output
  return (
    typeof o === 'object' && o !== null && (o as { status?: unknown }).status === 'async_launched'
  )
}

// 도구 결과가 중단/취소(에러이되 사용자/시스템 abort 마커를 가진) 인지. 전체 턴 취소·개별
// 서브에이전트 stop·SDK stopTask 가 남기는 결과를 일반 실패와 구분한다(메인 카드 "중단됨" 라벨,
// 서브에이전트 'aborted' 분류). 일반 도구 에러(isError 이나 abort 마커 없음)는 false.
export function isAbortedResult(result: ToolCall['result']): boolean {
  if (!result?.isError) return false
  const reason = valueString(result.output, 'reason')?.toLowerCase() ?? ''
  const message = valueString(result.output, 'message')?.toLowerCase() ?? ''
  return (
    reason.includes('abort') ||
    reason.includes('cancel') ||
    message.includes('abort') ||
    message.includes('중단')
  )
}

export function deriveSubagentTaskStatus(call: ToolCall): SubagentTaskStatus {
  if (!call.result) return 'running'
  // 백그라운드로 막 시작된 임시 결과는 진행 중 — settled 알림이 권위 결과로 덮어쓰기 전까지.
  if (isAsyncLaunchedResult(call.result)) return 'running'
  if (!call.result.isError) return 'completed'
  return isAbortedResult(call.result) ? 'aborted' : 'failed'
}

export function formatDurationLabel(durationMs: number | undefined): string | null {
  if (durationMs === undefined) return null
  const seconds = Math.max(1, Math.round(durationMs / 1000))
  if (seconds < 60) return `${seconds}초`
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`
}

function valueString(input: unknown, key: string): string | null {
  if (typeof input !== 'object' || input === null) return null
  const value = (input as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function valueNumber(input: unknown, key: string): number | null {
  if (typeof input !== 'object' || input === null) return null
  const value = (input as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function tokenLabelFromResult(output: unknown): string | null {
  const tokens = valueNumber(output, 'tokenCount') ?? valueNumber(output, 'tokens')
  if (tokens === null) return null
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k 토큰` : `${tokens} 토큰`
}

// 표시 모델 라벨 — 실제 모델(subagentMeta.model)을 친근한 이름으로. 없으면 caller 가 준
// agentLabel, 그것도 없으면 subagent_type('Explore' 등), 최후 '에이전트'.
function agentModelFromCall(call: ToolCall): string {
  const model = call.result?.subagentMeta?.model
  if (model) return modelDisplayLabel(model)
  return (
    valueString(call.result?.output, 'agentLabel') ??
    valueString(call.input, 'agentLabel') ??
    valueString(call.input, 'subagent_type') ??
    '에이전트'
  )
}

function subagentTypeFromCall(call: ToolCall): string | null {
  return valueString(call.input, 'subagent_type')
}

// 모델 id → 친근한 라벨. 예: 'claude-haiku-4-5-20251001'→'Haiku 4.5',
// 'claude-3-5-haiku-20241022'→'Haiku 3.5', 'claude-sonnet-4-5'→'Sonnet 4.5', 'opus'→'Opus'.
// 패밀리 미인식이면 원형 그대로(미지 모델 보존).
export function modelDisplayLabel(modelId: string): string {
  const family = /opus/i.test(modelId)
    ? 'Opus'
    : /sonnet/i.test(modelId)
      ? 'Sonnet'
      : /haiku/i.test(modelId)
        ? 'Haiku'
        : /fable/i.test(modelId)
          ? 'Fable'
          : null
  if (!family) return modelId
  // 끝의 날짜 스냅샷(YYYYMMDD)을 떼고, claude/패밀리 토큰을 제외한 숫자 토큰을 버전으로 본다.
  const tokens = modelId
    .toLowerCase()
    .replace(/-?\d{8}$/, '')
    .split('-')
    .filter((t) => /^\d+$/.test(t))
  if (tokens.length >= 2) return `${family} ${tokens[0]}.${tokens[1]}`
  if (tokens.length === 1) return `${family} ${tokens[0]}`
  return family
}

function toolDescriptionFromInput(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null
  const rec = input as Record<string, unknown>
  const desc = rec.description
  return typeof desc === 'string' && desc.trim() !== '' ? desc : null
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
  | { kind: 'compact'; trigger?: 'manual' | 'auto'; preTokens?: number; postTokens?: number } // 압축 경계 구분선(0064, post=0065 r2)
  | { kind: 'fork' } // 분기 경계 구분선(0064 r5) — 복사된 원본 이력과 새 대화 사이

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
        ...(p.durationMs !== undefined ? { durationMs: p.durationMs } : {}),
        ...(p.parentToolRunId !== undefined ? { parentToolRunId: p.parentToolRunId } : {}),
        ...(p.subagentMeta !== undefined ? { subagentMeta: p.subagentMeta } : {})
      })
    }
  }

  const segments: MessageSegment[] = []
  let current: MessageSegment | null = null

  for (const p of parts) {
    if (p.type === 'tool_result') continue // 맵으로 흡수
    // 서브에이전트(Task) child 의 text/reasoning 은 메인 트랜스크립트에서 제외(우측 패널 전용).
    if ((p.type === 'text' || p.type === 'reasoning') && partParentToolRunId(p) !== undefined)
      continue
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
      if (p.parentToolRunId !== undefined) continue
      const result = resultByRun.get(p.toolRunId)
      const call: ToolCall = {
        toolUseId: p.toolRunId,
        name: p.toolName,
        input: p.args,
        ...(p.parentToolRunId !== undefined ? { parentToolRunId: p.parentToolRunId } : {}),
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
    } else if (p.type === 'compact_boundary') {
      segments.push(
        (current = {
          kind: 'compact',
          ...(p.trigger !== undefined ? { trigger: p.trigger } : {}),
          ...(p.preTokens !== undefined ? { preTokens: p.preTokens } : {}),
          ...(p.postTokens !== undefined ? { postTokens: p.postTokens } : {})
        })
      )
    } else if (p.type === 'fork_boundary') {
      segments.push((current = { kind: 'fork' }))
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
    case 'compact':
      return prev.kind === 'compact' &&
        prev.trigger === next.trigger &&
        prev.preTokens === next.preTokens &&
        prev.postTokens === next.postTokens
        ? prev
        : next
    case 'fork':
      // 필드 없는 마커 — kind 일치(첫 가드)면 항상 이전 identity 재사용.
      return prev
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
