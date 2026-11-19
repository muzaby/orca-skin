import { childMessageId } from '../../../../../shared/message-id'
// AppMessagePart(provider-runtime.md §7) 셀렉터 — 순서 보존 parts 를 transcript 렌더가 쓰는
// view 로 투영한다(순수). text/reasoning 추출, tool_call↔tool_result 페어링, error 추출.

import type {
  AppMessagePart,
  AttachmentView,
  DiffRequirementAnchor
} from '../../../../../shared/ipc'
import { isAsyncLaunchedPayload } from '../../../../../shared/subagent'
import {
  nonExecutionOutcome,
  parseNonExecution,
  type NonExecutionOutcome
} from '../../../../../shared/tool-outcome'
import type { Message, ToolCall } from '../reducer/chatReducer'
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

// 파트의 parentToolRunId(서브에이전트 child 표식) 조회 — 4종 파트가 옵션 필드로 가질 수 있다.
function partParentToolRunId(p: AppMessagePart): string | undefined {
  return 'parentToolRunId' in p ? p.parentToolRunId : undefined
}

// parentToolRunId 를 제거한 파트 사본 — child 트랜스크립트 안에서 최상위 파트로 취급되게 한다.
// 식별자 외의 모든 원본 필드와 메타데이터를 사본에 보존한다.
function stripParentToolRunId(p: AppMessagePart): AppMessagePart {
  if (!('parentToolRunId' in p)) return p
  const rest = { ...p }
  delete rest.parentToolRunId
  return rest
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

// 재로드 위생(0143) — 앱 재시작 후에는 in-process 백그라운드 태스크가 존재하지 않으므로,
// settled 로 덮이지 않은 async_launched 런치 영수증(= '실행 중' 표시)은 항상 거짓이다. 세션
// 로드 시 전 메시지에 적용해 해당 부모 Task 를 합성 aborted 로 정착시킨다(마지막 tool_result
// 가 이기는 페어링 규칙 재사용). **로드 경로 전용** — 라이브 스트리밍에는 적용하지 않는다.
export function settleStaleAsyncLaunchParts(parts: AppMessagePart[]): AppMessagePart[] {
  // 대상 도구가 아예 없는 메시지(평문 텍스트 — 압도적 다수)는 Map 할당도 순회도 하지 않는다.
  // 세션 로드는 메시지 수만큼 이 함수를 부른다(0149).
  if (!parts.some((p) => isToolCallPart(p) && isAgentTaskName(p.toolName))) return parts
  const lastResult = new Map<string, Extract<AppMessagePart, { type: 'tool_result' }>>()
  for (const p of parts) if (isToolResultPart(p)) lastResult.set(p.toolRunId, p)
  const synthesized: AppMessagePart[] = []
  for (const p of parts) {
    if (!isToolCallPart(p) || !isAgentTaskName(p.toolName)) continue
    const last = lastResult.get(p.toolRunId)
    if (!last) continue // 결과 자체가 없는 미완 도구는 settleOrphanToolParts(incomplete) 소관
    if (!isAsyncLaunchedPayload(last.result)) continue
    synthesized.push({
      type: 'tool_result',
      toolRunId: p.toolRunId,
      result: {
        reason: 'aborted',
        message: '앱 재시작으로 백그라운드 서브에이전트가 중단되었습니다'
      },
      isError: true
    })
  }
  return synthesized.length === 0 ? parts : [...parts, ...synthesized]
}

export type ToolRunOutcome = 'running' | 'completed' | 'failed' | NonExecutionOutcome

export function isNonExecutionOutcome(outcome: ToolRunOutcome): outcome is NonExecutionOutcome {
  return outcome !== 'running' && outcome !== 'completed' && outcome !== 'failed'
}
export type SubagentTaskStatus = ToolRunOutcome

export interface SubagentTaskSummary {
  toolUseId: string
  description: string
  status: SubagentTaskStatus
  // 부모 Task tool_call 이 속한 메시지의 createdAt(ms) — 백그라운드 작업 목록의 시간 표시용.
  createdAtMs: number
  childToolCount: number
  // 소요시간/토큰 — 라벨이 아닌 원시값. 포맷(단위·언어)은 렌더가 tr 로 수행한다
  // (toolMeta.formatDurationLabel/formatTokenLabel, 0097).
  durationMs: number | null
  tokenCount: number | null
  // 표시 모델 라벨(예: 'Haiku 4.5') — subagentMeta.model 매핑 우선, 없으면 agentLabel/
  // subagent_type. 아무것도 없으면 null — '에이전트' 폴백 라벨은 렌더가 tr 로 채운다.
  agentLabel: string | null
  // subagent_type(예: 'Explore') — 모델과 별개의 에이전트 종류. 상세 타이틀 보조 표기용.
  subagentType: string | null
  // 진행 중일 때 마지막으로 실행 중인 child 도구명(예: 'Bash') — 단일 항목 메타 라인용.
  currentChildLabel: string | null
  // 종단 정착이 남긴 사람용 사유 문구(`result.output.message`) — 실패/중단 행이 "왜" 를 말한다
  // (0204 D-024). 진행 중이거나 성공이면 null. 생산자는 `subagent-settlement.ts:28`.
  settlementMessage: string | null
  // 이 태스크가 **이미 background 로 돌고 있는가**(0212 R-07) — `async_launched` 런치 영수증
  // 관측이 유일한 신호다(0136·0143). foreground → background 전환 버튼은 이 값이 `false` 일
  // 때만 뜬다: 이미 background 면 SDK 가 `false` 를 돌려주므로 눌러도 아무 일이 없다(D-021).
  asyncLaunched: boolean
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

// tool_call 파트 → `ToolCall` view 의 **단일 생성자**. 0229 이전에는 같은 본문이 세 곳
// (`partsToolCalls`·`messageSegments`·`subagentTasksFromMessages`)에 복사돼 있어, 파트에 필드가
// 늘면 세 곳이 갈라졌다 — 실제로 `editPreview` 를 한 곳에만 넣자 트랜스크립트 카드가 그 값을
// 보지 못했다. `resultMap` 과 같은 이유로 한 곳이 소유한다.
function toolCallFromPart(
  p: Extract<AppMessagePart, { type: 'tool_call' }>,
  resultByRun: ReadonlyMap<string, NonNullable<ToolCall['result']>>
): ToolCall {
  const result = resultByRun.get(p.toolRunId)
  return {
    toolUseId: p.toolRunId,
    name: p.toolName,
    ...(p.providerTool ? { providerTool: p.providerTool } : {}),
    input: p.args,
    ...(p.parentToolRunId !== undefined ? { parentToolRunId: p.parentToolRunId } : {}),
    // 실행 전 편집 미리보기(0229) — 라이브 파트에만 있다. 영속 파트에는 없으므로 재로드 후에는
    // 결과의 구조화 출력이 같은 카드를 세운다.
    ...(p.editPreview !== undefined ? { editPreview: p.editPreview } : {}),
    ...(result ? { result } : {})
  }
}

// tool_result 파트 → toolRunId 별 ToolCall.result. 0204 이전에는 같은 본문이 세 곳
// (partsToolCalls·subagentTasksFromMessages·messageSegments)에 복사돼 있었고, 파트에 필드가
// 늘 때마다 세 곳이 갈라질 수 있었다 — 한 곳이 소유한다. 파생을 직접 접는 소비자(taskBoard 의
// Task 도구 fold)도 자기 사본을 만들지 않고 이것을 부른다.
export function resultMap(parts: AppMessagePart[]): Map<string, NonNullable<ToolCall['result']>> {
  const resultByRun = new Map<string, NonNullable<ToolCall['result']>>()
  for (const part of parts) {
    if (isToolResultPart(part)) resultByRun.set(part.toolRunId, toolResultFromPart(part))
  }
  return resultByRun
}

export function toolResultFromPart(
  part: Extract<AppMessagePart, { type: 'tool_result' }>
): NonNullable<ToolCall['result']> {
  const nonExecution = parseNonExecution(part.nonExecution)
  return {
    output: part.result,
    isError: part.isError,
    ...(nonExecution ? { nonExecution } : {}),
    ...(part.durationMs !== undefined ? { durationMs: part.durationMs } : {}),
    ...(part.parentToolRunId !== undefined ? { parentToolRunId: part.parentToolRunId } : {}),
    ...(part.subagentMeta !== undefined ? { subagentMeta: part.subagentMeta } : {}),
    ...(part.structuredOutput !== undefined ? { structuredOutput: part.structuredOutput } : {})
  }
}

// 메시지 배열 파생 캐시 — 배열 identity 가 키이고(0313 D-013) 칸은 파생 인자마다 하나다. reducer 는
// 메시지 배열을 제자리에서 바꾸지 않으므로 같은 배열이면 같은 결과다. WeakMap 이라 배열이 버려지면
// 항목도 함께 사라진다 — 상한·명시 정리가 필요 없다. 반환은 화면끼리 공유하므로 고치지 않는다.
function cachedByMessages<K, V>(
  cache: WeakMap<readonly Message[], Map<K, V>>,
  messages: readonly Message[],
  key: K,
  derive: (messages: readonly Message[], key: K) => V
): V {
  let slots = cache.get(messages)
  if (!slots) {
    slots = new Map()
    cache.set(messages, slots)
  }
  // `null` 결과도 칸에 든다 — 비었는지는 `undefined` 로만 가른다.
  const cached = slots.get(key)
  if (cached !== undefined) return cached
  // 계산 뒤에 저장한다 — 파생이 던지면 칸은 빈 채로 남는다.
  const derived = derive(messages, key)
  slots.set(key, derived)
  return derived
}

const childMessageCache = new WeakMap<readonly Message[], Map<string, Message | null>>()

// 부모 tool run 의 child 트랜스크립트. 전 파트를 도는 조회라 같은 배열·같은 부모에는 한 번만 만든다.
export function childMessageForParentToolRunId(
  messages: readonly Message[],
  parentToolRunId: string
): Message | null {
  return cachedByMessages(childMessageCache, messages, parentToolRunId, deriveChildMessage)
}

function deriveChildMessage(messages: readonly Message[], parentToolRunId: string): Message | null {
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
  return { id: childMessageId(parentToolRunId), role: 'assistant', createdAt: Date.now(), parts }
}

// 부모 Task 하나의 description 만 필요할 때(완료 통지 행) — 전체 요약을 만들지 않는다.
// subagentTasksFromMessages 는 세션의 모든 파트를 flatMap 으로 펼치고 Map 4개를 만든 뒤 여러 번
// 순회하는데, 통지 행은 그중 문자열 하나만 읽었다. 트랜스크립트는 커밋마다 messages identity 가
// 바뀌므로(턴당 수십 회 × 표시 중인 행 수) 그 비용이 그대로 곱해졌다(0149).
export function subagentTaskDescription(
  messages: Message[],
  toolUseId: string
): string | undefined {
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        isToolCallPart(part) &&
        part.parentToolRunId === undefined &&
        part.toolRunId === toolUseId &&
        isAgentTaskName(part.toolName)
      ) {
        return toolDescriptionFromInput(part.args) ?? part.toolName
      }
    }
  }
  return undefined
}

// 요약 캐시 — 칸은 `includeNested` 값마다 하나다(최상위만 · 중첩 포함).
const subagentTaskCache = new WeakMap<
  readonly Message[],
  Map<boolean, readonly SubagentTaskSummary[]>
>()

// 서브에이전트 요약(SSOT). 전 파트를 여러 번 도는 파생이라 같은 메시지 배열에는 한 번만 계산한다 —
// 화면에 뜬 소비처(에이전트 행·인라인 상세·타일·패널)가 같은 결과 배열을 함께 든다. 그래서
// 반환은 읽기 전용이다(D-012): 한 곳이 고치면 다른 화면이 바뀐다.
export function subagentTasksFromMessages(
  messages: readonly Message[],
  includeNested = false
): readonly SubagentTaskSummary[] {
  return cachedByMessages(subagentTaskCache, messages, includeNested, deriveSubagentTasks)
}

function deriveSubagentTasks(
  messages: readonly Message[],
  includeNested: boolean
): readonly SubagentTaskSummary[] {
  const allParts = messages.flatMap((m) => m.parts)
  const resultByRun = resultMap(allParts)
  // 최상위 tool_call → 그 파트가 속한 메시지의 createdAt. flatMap 은 메시지 경계를 잃으므로
  // 시간 표시를 위해 별도 순회로 toolRunId 별 createdAt 을 모은다(부모 Task 카드 시간 표시용).
  const createdAtByRun = new Map<string, number>()
  for (const message of messages) {
    for (const part of message.parts) {
      if (isToolCallPart(part) && (includeNested || part.parentToolRunId === undefined)) {
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
      (includeNested || part.parentToolRunId === undefined) &&
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
        durationMs: meta?.durationMs ?? call.result?.durationMs ?? null,
        tokenCount: tokenCountFromResult(call.result?.output),
        agentLabel: agentModelFromCall(call),
        subagentType: subagentTypeFromCall(call),
        currentChildLabel: currentChild.get(call.toolUseId) ?? null,
        settlementMessage: settlementMessageFromCall(call),
        asyncLaunched: isAsyncLaunchedResult(call.result),
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
  return result ? isAsyncLaunchedPayload(result.output) : false
}

// 도구 결과가 중단/취소(에러이되 사용자/시스템 abort 마커를 가진) 인지. 전체 턴 취소·개별
// 서브에이전트 stop·SDK stopTask 가 남기는 결과를 일반 실패와 구분한다(메인 카드 "중단됨" 라벨,
// 서브에이전트 'aborted' 분류). 일반 도구 에러(isError 이나 abort 마커 없음)는 false.
//
// **`reason` 이 있으면 그것만 본다**(0204 D-023 · §10 EP-15). 정착 생산자는 사유를 `reason` 에
// 싣고 `message` 에는 사람용 문장을 싣는데, 그 문장이 '중단' 을 담을 수 있다 — 채널 종료 정착은
// `{ reason:'failed', message:'채널이 종료되어 서브에이전트가 중단되었습니다.' }` 라서, 메시지를
// 먼저 보면 실패가 "사용자가 중단함" 으로 읽힌다. 권위 필드가 없을 때만 문구로 폴백한다.
export function isAbortedResult(result: ToolCall['result']): boolean {
  if (!result?.isError) return false
  const reason = valueString(result.output, 'reason')?.toLowerCase()
  if (reason) return reason.includes('abort') || reason.includes('cancel')
  const message = valueString(result.output, 'message')?.toLowerCase() ?? ''
  return message.includes('abort') || message.includes('중단')
}

export function deriveSubagentTaskStatus(call: ToolCall): SubagentTaskStatus {
  return toolRunOutcome(call.result)
}

export function toolRunOutcome(result: ToolCall['result']): ToolRunOutcome {
  if (!result) return 'running'
  if (result.nonExecution) return nonExecutionOutcome(result.nonExecution)
  // 백그라운드로 막 시작된 임시 결과는 진행 중 — settled 알림이 권위 결과로 덮어쓰기 전까지.
  if (isAsyncLaunchedResult(result)) return 'running'
  if (!result.isError) return 'completed'
  return isAbortedResult(result) ? 'aborted' : 'failed'
}

function valueString(input: unknown, key: string): string | null {
  if (typeof input !== 'object' || input === null) return null
  const value = (input as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

// Task 도구 입력의 요청 프롬프트. 두 타일의 상세가 같은 wire 필드를 읽으므로 여기가 소유한다 —
// 컴포넌트가 각자 `input.prompt` 를 shape-sniff 하면 SDK 가 키를 바꿀 때 한쪽만 따라간다.
export function promptFromCall(call: ToolCall): string | null {
  const input = call.input
  if (typeof input === 'object' && input !== null) {
    const prompt = (input as Record<string, unknown>).prompt
    if (typeof prompt === 'string' && prompt.trim() !== '') return prompt
  }
  return null
}

// 종단 정착의 사유 문구. 에러 결과만 사유를 갖는다 — 성공 결과의 `summary` 는 답변이라 사유
// 자리에 쓰지 않는다(0204 D-024).
//
// **중단(`aborted`)과 실패(`failed`)가 읽는 키가 다르다.** 중단 행의 표시 문구는 UI 가 소유하고
// (0204 AT-31 — "사용자에 의해 중단됨"), 정착의 `message` 는 transcript 용 기본 문장이다. 그래서
// 중단은 SDK 가 실제로 준 사유(`cause` — 0212 의 `task_updated.patch.error`)만 사유로 읽는다:
// `message` 를 읽으면 사용자 중단 행이 생산자 기본 문장으로 덮인다.
function settlementMessageFromCall(call: ToolCall): string | null {
  if (!call.result?.isError) return null
  const output = call.result.output
  if (valueString(output, 'reason')?.toLowerCase() === 'aborted') {
    return valueString(output, 'cause')
  }
  return valueString(output, 'message')
}

function valueNumber(input: unknown, key: string): number | null {
  if (typeof input !== 'object' || input === null) return null
  const value = (input as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function tokenCountFromResult(output: unknown): number | null {
  return valueNumber(output, 'tokenCount') ?? valueNumber(output, 'tokens')
}

// 표시 모델 라벨 — 실제 모델(subagentMeta.model)을 친근한 이름으로. 없으면 caller 가 준
// agentLabel, 그것도 없으면 subagent_type('Explore' 등). 최후 폴백('에이전트')은 렌더가
// tr('chat.toolMeta.agentFallback') 로 채운다 — null 반환.
function agentModelFromCall(call: ToolCall): string | null {
  const model = call.result?.subagentMeta?.model
  if (model) return modelDisplayLabel(model)
  return (
    valueString(call.result?.output, 'agentLabel') ??
    valueString(call.input, 'agentLabel') ??
    valueString(call.input, 'subagent_type')
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
