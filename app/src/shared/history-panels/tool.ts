import type { AppMessagePart } from '../ipc'
import { isAsyncLaunchedPayload } from '../subagent'
import { nonExecutionOutcome, parseNonExecution, type NonExecutionOutcome } from '../tool-outcome'
import type { ToolCall } from './types'

// 파트의 parentToolRunId(서브에이전트 child 표식) 조회 — 4종 파트가 옵션 필드로 가질 수 있다.
export function partParentToolRunId(p: AppMessagePart): string | undefined {
  return 'parentToolRunId' in p ? p.parentToolRunId : undefined
}

// parentToolRunId 를 제거한 파트 사본 — child 트랜스크립트 안에서 최상위 파트로 취급되게 한다.
// 식별자 외의 모든 원본 필드와 메타데이터를 사본에 보존한다.
export function stripParentToolRunId(p: AppMessagePart): AppMessagePart {
  if (!('parentToolRunId' in p)) return p
  const rest = { ...p }
  delete rest.parentToolRunId
  return rest
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
export function toolCallFromPart(
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
export function settlementMessageFromCall(call: ToolCall): string | null {
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

export function tokenCountFromResult(output: unknown): number | null {
  return valueNumber(output, 'tokenCount') ?? valueNumber(output, 'tokens')
}

// 표시 모델 라벨 — 실제 모델(subagentMeta.model)을 친근한 이름으로. 없으면 caller 가 준
// agentLabel, 그것도 없으면 subagent_type('Explore' 등). 최후 폴백('에이전트')은 렌더가
// tr('chat.toolMeta.agentFallback') 로 채운다 — null 반환.
export function agentModelFromCall(call: ToolCall): string | null {
  const model = call.result?.subagentMeta?.model
  if (model) return modelDisplayLabel(model)
  return (
    valueString(call.result?.output, 'agentLabel') ??
    valueString(call.input, 'agentLabel') ??
    valueString(call.input, 'subagent_type')
  )
}

export function subagentTypeFromCall(call: ToolCall): string | null {
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

export function toolDescriptionFromInput(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null
  const rec = input as Record<string, unknown>
  const desc = rec.description
  return typeof desc === 'string' && desc.trim() !== '' ? desc : null
}
