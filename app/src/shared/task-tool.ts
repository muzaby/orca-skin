// Claude Agent SDK 의 TaskXXX 도구 wire 형태 (L0 — 양 프로세스 안전, 런타임 의존 0).
//
// 이 6개 도구는 **두 네임스페이스**다. TaskCreate/TaskGet/TaskList/TaskUpdate 는 세션의 할 일
// 목록(`taskId` camelCase · `pending|in_progress|completed` + `deleted`)이고, TaskOutput/TaskStop 은
// background 실행 태스크(`task_id` snake_case · `completed|failed|stopped`)를 다룬다. 후자는
// 이미 subagent.task 이벤트 경로가 관측하므로 여기서는 **관측 대상이 아니다**(0204 D-010).
//
// 왜 shared 인가: 도구 이름 리터럴을 main(어댑터가 구조화 출력을 실을지 판정)과 renderer(그
// 출력을 목록으로 접는다)가 각자 들면 CLI 가 이름을 바꿀 때 두 곳이 함께 어긋난다 — 프로세스
// 경계를 넘는 wire 상수라 shared 가 단일 소유한다(`subagent.ts` 선례, 0149).
//
// 출력 형태의 정본은 SDK `sdk-tools.d.ts` 의 `Task*Output` 이다. 여기서는 그 중 **패널이 쓰는
// 필드만** 좁혀 읽고, 형태가 어긋나면 `null` 을 돌려준다 — 거짓 항목보다 미표시를 택한다.

import { isRecord } from './obj'

// 관측 대상 6종. TaskOutput/TaskStop 도 이름 술어에는 포함된다 — 어댑터가 구조화 출력을
// 실을 대상이자, "관측했지만 목록을 바꾸지 않는다"(D-010)를 파서가 명시적으로 표현한다.
export const TASK_TOOL_NAMES = [
  'TaskCreate',
  'TaskGet',
  'TaskList',
  'TaskUpdate',
  'TaskOutput',
  'TaskStop'
] as const

export type TaskToolName = (typeof TASK_TOOL_NAMES)[number]

const TASK_TOOL_NAME_SET: ReadonlySet<string> = new Set(TASK_TOOL_NAMES)

export function isTaskToolName(name: string): name is TaskToolName {
  return TASK_TOOL_NAME_SET.has(name)
}

// SDK `TaskUpdateInput.status` 중 목록에 남는 값. `deleted` 는 상태가 아니라 제거 신호라
// 별도 관측(`removed`)으로 표현한다 — 상태 union 에 넣으면 그룹 렌더가 그것을 그려야 한다.
export const AGENT_TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const
export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number]

function asStatus(value: unknown): AgentTaskStatus | undefined {
  return typeof value === 'string' && (AGENT_TASK_STATUSES as readonly string[]).includes(value)
    ? (value as AgentTaskStatus)
    : undefined
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function asIdList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const ids = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  return ids.length === value.length ? ids : undefined
}

// 목록 항목에 실릴 수 있는 필드 묶음 — 관측마다 아는 것만 채운다(누락 = 기존 값 보존).
//
// **의존 간선은 두 의미로 흐른다**(0204 D-029 · §10 EP-19). SDK 가 이름으로 이미 가른다:
//   `blockedBy`    — `TaskGet`/`TaskList` **출력**. 그 시점의 전체 목록이라 **교체**한다.
//   `addBlockedBy` — `TaskUpdate` **입력**. `add-` 접두 그대로 **가산**한다.
// 한 필드에 담으면 `TaskUpdate` 한 번이 기존 간선을 통째로 지운다.
//
// `blocks`("내가 막는 것")는 **싣지 않는다**(D-028) — `TaskListOutput` 에 그 필드가 없어
// 전체 스냅샷(D-008)이 보정할 수 없다. 저장하면 삭제된 간선이 영구 잔류한다. `blockedBy` 의
// 역방향이라 정보 손실은 0이다.
export interface AgentTaskPatch {
  subject?: string
  description?: string
  status?: AgentTaskStatus
  // 전체 교체 — 출력이 준 그 시점의 전량.
  blockedBy?: string[]
  // 가산 병합 — 기존 간선에 더한다(중복 id 는 한 번만).
  addBlockedBy?: string[]
  owner?: string
}

// 도구 호출 1건이 목록에 지시하는 것. `null` 은 "이 호출은 목록을 바꾸지 않는다".
export type TaskToolObservation =
  // TaskCreate 성공 — id 가 확정된 시점에만 만들어진다(D: tool_use 만으로는 등록하지 않는다).
  | { kind: 'created'; id: string; patch: AgentTaskPatch }
  // TaskUpdate/TaskGet 성공 — 아는 필드만 병합한다.
  | { kind: 'upserted'; id: string; patch: AgentTaskPatch }
  // TaskUpdate(deleted) · TaskGet(task:null) — 목록에서 뺀다.
  | { kind: 'removed'; id: string }
  // TaskList — 전체 스냅샷. 여기 없는 로컬 항목은 제거 대상이다(D-008).
  | { kind: 'snapshot'; tasks: { id: string; patch: AgentTaskPatch }[] }

function readCreate(
  structured: Record<string, unknown>,
  args: unknown
): TaskToolObservation | null {
  const task = structured.task
  if (!isRecord(task)) return null
  const id = asText(task.id)
  if (!id) return null
  const input = isRecord(args) ? args : {}
  // TaskCreate 로 만들어진 태스크는 항상 pending 이다(SDK 도구 설명).
  const patch: AgentTaskPatch = { status: 'pending' }
  // subject 는 출력이 권위(SDK 가 정규화할 수 있다), description 은 출력에 없어 입력에서 읽는다.
  const subject = asText(task.subject) ?? asText(input.subject)
  if (subject) patch.subject = subject
  const description = asText(input.description)
  if (description) patch.description = description
  return { kind: 'created', id, patch }
}

function readUpdate(
  structured: Record<string, unknown>,
  args: unknown
): TaskToolObservation | null {
  // 실패한 갱신은 패널에 닿지 않는다 — success 미지정도 실패로 읽는다(fail-closed).
  if (structured.success !== true) return null
  const input = isRecord(args) ? args : {}
  const id = asText(structured.taskId) ?? asText(input.taskId)
  if (!id) return null
  const fields = asIdList(structured.updatedFields)
  // updatedFields 가 있으면 그것이 무엇이 바뀌었는지의 권위다. 없으면 입력 전체를 후보로 본다.
  const changed = (key: string): boolean => (fields ? fields.includes(key) : true)

  const statusChange = isRecord(structured.statusChange) ? structured.statusChange : undefined
  const rawStatus = statusChange?.to ?? input.status
  if (rawStatus === 'deleted') return { kind: 'removed', id }

  const patch: AgentTaskPatch = {}
  const status = asStatus(rawStatus)
  if (status) patch.status = status
  if (changed('subject')) {
    const subject = asText(input.subject)
    if (subject) patch.subject = subject
  }
  if (changed('description')) {
    const description = asText(input.description)
    if (description) patch.description = description
  }
  if (changed('owner')) {
    const owner = asText(input.owner)
    if (owner) patch.owner = owner
  }
  // 의존 간선 추가(D-029). `updatedFields` 가 어느 이름을 싣는지 SDK 가 문서화하지 않아
  // **두 이름을 모두** 허용한다(D-030) — 놓치면 의존이 화면에서 사라지는 쪽이 더 나쁘다.
  if (changed('addBlockedBy') || changed('blockedBy')) {
    const added = asIdList(input.addBlockedBy)
    if (added && added.length > 0) patch.addBlockedBy = added
  }
  // 필드가 하나도 안 잡히면 목록이 바뀔 것이 없다 — 빈 upsert 로 항목을 만들지 않는다.
  if (Object.keys(patch).length === 0) return null
  return { kind: 'upserted', id, patch }
}

function readGet(structured: Record<string, unknown>, args: unknown): TaskToolObservation | null {
  const input = isRecord(args) ? args : {}
  const task = structured.task
  // `task: null` = 그 id 가 Claude 측에 없다 → 목록에서 뺀다.
  if (task === null) {
    const id = asText(input.taskId)
    return id ? { kind: 'removed', id } : null
  }
  if (!isRecord(task)) return null
  const id = asText(task.id) ?? asText(input.taskId)
  if (!id) return null
  return { kind: 'upserted', id, patch: patchFromTaskRecord(task) }
}

function readList(structured: Record<string, unknown>): TaskToolObservation | null {
  const raw = structured.tasks
  if (!Array.isArray(raw)) return null
  const tasks: { id: string; patch: AgentTaskPatch }[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) continue
    const id = asText(entry.id)
    if (!id) continue
    tasks.push({ id, patch: patchFromTaskRecord(entry) })
  }
  return { kind: 'snapshot', tasks }
}

function patchFromTaskRecord(task: Record<string, unknown>): AgentTaskPatch {
  const patch: AgentTaskPatch = {}
  const subject = asText(task.subject)
  if (subject) patch.subject = subject
  const description = asText(task.description)
  if (description) patch.description = description
  const status = asStatus(task.status)
  if (status) patch.status = status
  const owner = asText(task.owner)
  if (owner) patch.owner = owner
  // 출력의 `blockedBy` 는 전체 교체다. `task.blocks` 는 읽지 않는다(D-028).
  const blockedBy = asIdList(task.blockedBy)
  if (blockedBy) patch.blockedBy = blockedBy
  return patch
}

/**
 * Task 도구 호출 1건(이름 + 입력 args + SDK 구조화 출력)을 목록 지시로 읽는다.
 *
 * 반환 `null` = 이 호출은 목록을 바꾸지 않는다. 실패 결과(`isError`)·형태 불일치·구조화 출력
 * 부재·관측 대상 아님(TaskOutput/TaskStop)이 전부 여기로 수렴한다.
 */
export function readTaskToolObservation(input: {
  toolName: string
  args: unknown
  structuredOutput: unknown
  isError: boolean
}): TaskToolObservation | null {
  if (input.isError) return null
  if (!isRecord(input.structuredOutput)) return null
  const structured = input.structuredOutput
  switch (input.toolName) {
    case 'TaskCreate':
      return readCreate(structured, input.args)
    case 'TaskUpdate':
      return readUpdate(structured, input.args)
    case 'TaskGet':
      return readGet(structured, input.args)
    case 'TaskList':
      return readList(structured)
    // TaskOutput/TaskStop 은 transcript 에만 남는다 — background 상태를 이 호출 여부에
    // 의존시키지 않는다(0204 D-010, 명세 §2).
    default:
      return null
  }
}
