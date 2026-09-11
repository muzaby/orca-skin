// SDK 실행 태스크의 **종류**와 **런치 영수증** 술어 (L0 — 양 프로세스 안전, 런타임 의존 0).
//
// 0230. `system/task_*` 이벤트는 서브에이전트 전용이 아니다 — 셸 명령·감시·워크플로가 같은
// 봉투로 온다(`task_type` 이 `local_bash`·`local_workflow` 등). 어댑터·트래커·정착·표시 fold
// 네 소비처가 각자 "task = 서브에이전트" 를 전제하면 셸 백그라운드 작업이 에이전트로 그려지고
// (타일에서는 아예 탈락하고) 정착이 셸의 stdout 을 덮는다. 종류 판정의 SSOT 를 여기 하나로 둔다.
//
// **판정 우선순위는 원래 도구 이름 > `task_type` 이다**(0230 D-004 · §10 EP-02). `Monitor` 와
// 셸이 `task_type: 'local_bash'` 를 공유하므로 `task_type` 단독으로는 둘이 갈리지 않는다.
//
// `isAsyncLaunchedPayload`(`./subagent.ts`)는 **에이전트 영수증 전용**으로 그대로 남는다 —
// 이 파일의 `readLaunchReceipt` 가 그것을 감싸 "아직 실행 중" 이라는 더 넓은 판정을 만든다.

import { isRecord } from './obj'
import { isAsyncLaunchedPayload } from './subagent'

/**
 * 실행 태스크의 종류. **미지정(키 부재)과 `'unknown'` 은 다르다** — 전자는 종류를 판정할
 * 입력이 없었다는 뜻(구형 CLI·매핑 부재)이고, 후자는 판정했으나 이 어휘에 없다는 뜻이다.
 * 소비처는 둘 다 일반 작업으로 그리되 원본을 버리지 않는다.
 */
export type TaskKind = 'agent' | 'shell' | 'monitor' | 'workflow' | 'unknown'

/** 셸 도구 이름. `Bash` 는 현재 거부 목록이지만 이름 판정은 배포 구성과 무관하게 둔다. */
export const SHELL_TOOL_NAMES: ReadonlySet<string> = new Set(['Bash', 'PowerShell'])

const AGENT_TOOL_NAMES: ReadonlySet<string> = new Set(['Task', 'Agent'])

// 도구 이름 → 종류. 매핑에 없으면 `undefined` 를 돌려 `task_type` 폴백으로 넘긴다 —
// 여기서 곧장 `'unknown'` 을 돌려주면 이름을 모르는 도구의 `task_type` 이 버려진다.
function kindFromToolName(toolName: string | undefined): TaskKind | undefined {
  if (!toolName) return undefined
  if (AGENT_TOOL_NAMES.has(toolName)) return 'agent'
  if (SHELL_TOOL_NAMES.has(toolName)) return 'shell'
  if (toolName === 'Monitor') return 'monitor'
  if (toolName === 'Workflow') return 'workflow'
  return undefined
}

// `task_type` → 종류. 개방형 문자열이라 아는 값만 접고 나머지는 `undefined`.
function kindFromTaskType(taskType: string | undefined): TaskKind | undefined {
  if (!taskType) return undefined
  if (taskType === 'local_agent' || taskType === 'remote_agent') return 'agent'
  if (taskType === 'local_bash') return 'shell'
  if (taskType === 'local_workflow') return 'workflow'
  return undefined
}

/**
 * 종류 판정 — 도구 이름이 1순위, `task_type` 이 2순위다(D-004).
 *
 * 둘 다 판정하지 못하면 `'unknown'` 이다. **호출부는 입력이 아예 없을 때 이 함수를 부르지 않고
 * 필드를 생략한다** — `'unknown'`(판정했으나 모름)과 미지정(판정 불가)을 가르기 위해서다.
 */
export function taskKindFrom(toolName?: string, taskType?: string): TaskKind {
  return kindFromToolName(toolName) ?? kindFromTaskType(taskType) ?? 'unknown'
}

/**
 * 셸 백그라운드 결과의 투영 — SDK `tool_use_result` 원본을 그대로 싣지 않는다(§10 EP-04).
 * 원본에는 stdout 전문이 들어 있어 그대로 영속하면 같은 출력을 두 번 저장한다.
 */
export interface ShellBackgroundProjection {
  /** SDK `backgroundTaskId` — 이 값의 존재가 곧 "백그라운드로 분리됐다" 는 영수증이다. */
  taskId: string
  /** `timedOutAfterMs` — 명시 요청이 아니라 타임아웃으로 전환된 경우에만 실린다. */
  timedOutAfterMs?: number
  /** `persistedOutputPath` — 저장된 결과 경로. 원시 로그(`rawOutputPath`)와 구분한다. */
  persistedOutputPath?: string
  /** `rawOutputPath` — 원시 출력 경로. */
  rawOutputPath?: string
}

/** 런치 영수증 — "도구는 반환했지만 실행은 아직 끝나지 않았다" 의 종류별 표현. */
export type LaunchReceipt =
  { kind: 'agent-async' } | ({ kind: 'shell-background' } & ShellBackgroundProjection)

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined

/**
 * SDK 셸 결과(`tool_use_result`)에서 백그라운드 투영을 읽는다. `backgroundTaskId` 가 없으면
 * 백그라운드가 아니므로 `undefined` — **타입이 어긋나도 거짓 영수증을 만들지 않는다.**
 */
export function readShellBackground(toolUseResult: unknown): ShellBackgroundProjection | undefined {
  if (!isRecord(toolUseResult)) return undefined
  const taskId = str(toolUseResult.backgroundTaskId)
  if (!taskId) return undefined
  const timedOutAfterMs = num(toolUseResult.timedOutAfterMs)
  const persistedOutputPath = str(toolUseResult.persistedOutputPath)
  const rawOutputPath = str(toolUseResult.rawOutputPath)
  return {
    taskId,
    ...(timedOutAfterMs !== undefined ? { timedOutAfterMs } : {}),
    ...(persistedOutputPath !== undefined ? { persistedOutputPath } : {}),
    ...(rawOutputPath !== undefined ? { rawOutputPath } : {})
  }
}

/** 영속 파트의 `structuredOutput` 에서 셸 투영을 되읽는다 — 라이브와 재로드가 같은 자리다. */
export function readShellBackgroundFromStructured(
  structuredOutput: unknown
): ShellBackgroundProjection | undefined {
  if (!isRecord(structuredOutput)) return undefined
  const projected = structuredOutput.shellBackground
  if (!isRecord(projected)) return undefined
  const taskId = str(projected.taskId)
  if (!taskId) return undefined
  const timedOutAfterMs = num(projected.timedOutAfterMs)
  const persistedOutputPath = str(projected.persistedOutputPath)
  const rawOutputPath = str(projected.rawOutputPath)
  return {
    taskId,
    ...(timedOutAfterMs !== undefined ? { timedOutAfterMs } : {}),
    ...(persistedOutputPath !== undefined ? { persistedOutputPath } : {}),
    ...(rawOutputPath !== undefined ? { rawOutputPath } : {})
  }
}

/**
 * 도구 결과가 "아직 실행 중" 이라는 영수증인가 — **§10 EP-03 의 SSOT**.
 *
 * 두 축을 함께 본다. 에이전트 영수증은 모델용 결과(`result`)를 `{status:'async_launched'}` 로
 * 대체해 오지만, 셸 영수증은 `result` 가 stdout 이고 `backgroundTaskId` 는 구조화 출력 쪽에
 * 있다 — 한 축만 보면 백그라운드 셸이 추적에서 빠져 세션이 종료를 기다리지 않는다.
 */
export function readLaunchReceipt(ev: {
  result?: unknown
  structuredOutput?: unknown
}): LaunchReceipt | undefined {
  if (isAsyncLaunchedPayload(ev.result)) return { kind: 'agent-async' }
  const shell = readShellBackgroundFromStructured(ev.structuredOutput)
  return shell ? { kind: 'shell-background', ...shell } : undefined
}
