// 작업 타일 목록 파생 (순수) — 현재 세션의 transcript parts 를 접어 "지금 무슨 작업이 있는가"
// 를 만든다. 0204.
//
// 두 종류가 한 목록에 산다.
//   - `agent`      TaskCreate/TaskUpdate/TaskList/TaskGet 로 관측되는 세션 할 일 목록.
//   - `background` Agent/Task 도구로 뜬 서브에이전트(기존 subagentTasksFromMessages 파생).
//
// 이 목록의 소비자는 `작업` 타일의 `진행 상황` 섹션 하나다(0204 D-017). `백그라운드 작업` 타일은
// `subagentTasksFromMessages` 를 직접 쓴다 — 두 타일이 같은 항목을 다른 책임으로 그린다(D-019).
//
// **왜 fold 인가**: 일반 Task 의 상태는 어디에도 저장돼 있지 않다. main 에 Task 스토어를 두면
// 세션별 격리·재로드 복원·다중 창을 전부 다시 만들어야 하는데, transcript 는 그 셋을 이미
// 갖고 있다(parts 는 세션 엔트리에 살고 DB 에 영속된다). 그래서 목록은 파생값이고 이 파일이
// 그 파생의 유일한 소유자다 — 컴포넌트가 자기 상태로 목록을 만들지 않는다.
//
// 입력은 **그 세션 엔트리의 messages 뿐**이다(0204 §10 EP-08). 전역 스토어를 읽지 않으므로
// 다른 세션의 Task 가 섞일 수 없다.

import type { MessageKey } from '../../../shared/i18n'
import {
  isTaskToolName,
  readTaskToolObservation,
  type AgentTaskPatch,
  type AgentTaskStatus
} from '../../../../../shared/task-tool'
import type { Message } from '../reducer/chatReducer'
import {
  promptFromCall,
  resultMap,
  subagentTasksFromMessages,
  type SubagentTaskSummary
} from './parts'

// 목록에 렌더되는 상태. `stopping` 은 사용자가 중단을 요청했고 SDK 확정을 기다리는 중이다
// (0204 D-005) — 별도 그룹을 만들지 않고 '진행 중' 그룹 안에서 라벨만 달라진다.
// `paused` 는 SDK `task_updated` 로만 관측되는 **살아 있는 일시정지**다(0212 D-014) — 정착이
// 아니므로 완료 그룹으로 내려가지 않고, SDK 에 resume API 가 없어 여기서 나갈 사용자 경로는
// 중단뿐이다(D-022 — 그래서 중단 버튼을 유지한다).
export type TaskBoardStatus =
  'in_progress' | 'stopping' | 'paused' | 'pending' | 'completed' | 'aborted' | 'failed'

export type TaskBoardKind = 'agent' | 'background'

// background 항목만 갖는 실행 메타. 일반 Task 에는 경과·도구수 같은 개념이 없으므로 `null`
// 이며, 렌더는 이 필드의 유무로 `background` 배지를 판정한다(0204 §10 EP-10).
export interface TaskBoardBackgroundMeta {
  durationMs: number | null
  toolUses: number
  tokenCount: number | null
  currentToolLabel: string | null
  // 종단 정착이 남긴 사유 문구 — 실패/중단 행이 원인을 말한다(0204 D-024). 미정착이면 null.
  settlementMessage: string | null
  // 상세가 보이는 요청 프롬프트. 여기서 한 번 뽑아 두면 상세 컴포넌트가 전체 parts 를 다시
  // 훑지 않는다 — 상세 뷰모델의 소유자는 이 파일이다(0204 §10 EP-10).
  prompt: string | null
  // 이미 background 로 도는가(0212) — 전환 버튼 노출 술어의 입력. 컴포넌트가 `call.result` 를
  // 다시 shape-sniff 하지 않게 여기서 한 번 판정해 싣는다.
  asyncLaunched: boolean
}

export interface TaskBoardItem {
  // 목록/선택 키. 두 네임스페이스가 절대 충돌하지 않게 접두사를 붙인다(§10 EP-04) —
  // 일반 Task id 는 '3' 같은 짧은 문자열이고 background 는 tool_use id 다.
  key: string
  kind: TaskBoardKind
  id: string
  // **표시** 제목. `in_progress` 인 동안은 `activeForm`(현재진행형)으로 교체된다(0212 D-006).
  title: string
  // **안정** 이름 — 상태와 무관하게 같은 값이다. `aria-label` 과 상세 화면이 이것을 쓴다:
  // 접근성 라벨이 상태에 따라 흔들리면 스크린리더 사용자가 같은 항목을 다른 항목으로 읽는다
  // (0212 D-007 · §10 EP-05). 두 필드를 맞바꾸면 그 계약이 깨진다.
  subject: string
  description: string | null
  status: TaskBoardStatus
  blockedBy: string[]
  background: TaskBoardBackgroundMeta | null
}

export function agentTaskKey(id: string): string {
  return `agent:${id}`
}

export function backgroundTaskKey(toolUseId: string): string {
  return `bg:${toolUseId}`
}

// 목록 순서의 단일 소유자(0204 §10 EP-14). 컴포넌트는 이 배열을 그대로 그리고 자체 정렬·
// 그룹핑을 하지 않는다 — 두 곳에서 정렬하면 규칙이 갈라진다.
//
// 규칙: **agent 항목이 id 오름차순으로 먼저**, background 항목이 **관측 순서로** 뒤에 온다
// (D-018). agent id 는 SDK 가 매기는 할 일 순번('1'·'2'·'10')이라 수치 비교해야 한다 —
// 사전순이면 '10' 이 '2' 앞에 온다. 숫자가 아닌 id 는 수치 id 뒤에 사전순으로 둔다(전순서 보장).
// background 는 tool_use id(불투명)라 정렬 키가 없고, fold 가 만든 관측 순서가 곧 시작 순서다.
export function taskBoardOrdered(items: TaskBoardItem[]): TaskBoardItem[] {
  const agents = items.filter((item) => item.kind === 'agent')
  const backgrounds = items.filter((item) => item.kind !== 'agent')
  const sorted = [...agents].sort((a, b) => compareAgentTaskId(a.id, b.id))
  return [...sorted, ...backgrounds]
}

function compareAgentTaskId(a: string, b: string): number {
  const na = /^\d+$/.test(a) ? Number(a) : null
  const nb = /^\d+$/.test(b) ? Number(b) : null
  if (na !== null && nb !== null) return na - nb
  if (na !== null) return -1
  if (nb !== null) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

export function taskBoardItemByKey(
  items: TaskBoardItem[],
  key: string | null
): TaskBoardItem | undefined {
  return key ? items.find((item) => item.key === key) : undefined
}

const AGENT_STATUS_FALLBACK: AgentTaskStatus = 'pending'

// 기본 인자용 불변 빈 집합 — 매 호출마다 `new Set()` 을 만들면 memo 의존성이 매번 바뀐다.
const EMPTY_IDS: ReadonlySet<string> = new Set()

interface AgentEntry {
  id: string
  subject?: string
  description?: string
  status: AgentTaskStatus
  blockedBy: string[]
  activeForm?: string
}

function applyPatch(entry: AgentEntry, patch: AgentTaskPatch): void {
  if (patch.subject !== undefined) entry.subject = patch.subject
  if (patch.description !== undefined) entry.description = patch.description
  if (patch.status !== undefined) entry.status = patch.status
  // 의존 간선의 두 의미를 각각 구현한다(0204 §10 EP-19). 하나만 알면 나머지가 조용히 무시된다.
  if (patch.blockedBy !== undefined) entry.blockedBy = patch.blockedBy
  if (patch.addBlockedBy !== undefined) {
    entry.blockedBy = [...new Set([...entry.blockedBy, ...patch.addBlockedBy])]
  }
  // 현재진행형은 마지막 관측값을 유지한다 — `completed` 로 바뀌어도 지우지 않는다. 제목이
  // `subject` 로 돌아가는 것은 **상태 조건**이 하는 일이고(`agentItem`), 값 삭제가 하는 일이
  // 아니다: 다시 `in_progress` 가 되면 같은 문구가 돌아와야 한다.
  if (patch.activeForm !== undefined) entry.activeForm = patch.activeForm
}

// `addBlocks`(내가 막는 것)를 **역방향 간선으로 가산**한다(0212 D-009 · §10 EP-04).
// `TaskUpdate(A, addBlocks:[B])` → `B.blockedBy += A`. `blocks` 를 저장하지 않는다는 0204 D-028
// 을 지키면서 간선을 잃지 않는 유일한 방법이 방향을 뒤집는 것이다 — 방향만 바뀌므로 정보 손실 0.
//
// 두 조건이 붙는다. **대상이 이미 있을 때만** 가산한다(D-010 — 없는 id 로 stub 을 만들면 제목이
// `2` 인 유령 행이 뜨고, `TaskList` 스냅샷이 나중에 보정한다). 그리고 **자기 자신은 제외**한다:
// 자기를 막는 간선은 화면에서 영원히 풀리지 않는 차단으로 보인다.
function applyReverseBlocks(
  entries: Map<string, AgentEntry>,
  sourceId: string,
  addBlocks: string[] | undefined
): void {
  if (!addBlocks) return
  for (const targetId of addBlocks) {
    if (targetId === sourceId) continue
    const target = entries.get(targetId)
    if (!target) continue
    target.blockedBy = [...new Set([...target.blockedBy, sourceId])]
  }
}

function ensure(entries: Map<string, AgentEntry>, id: string): AgentEntry {
  let entry = entries.get(id)
  if (!entry) {
    entry = { id, status: AGENT_STATUS_FALLBACK, blockedBy: [] }
    entries.set(id, entry)
  }
  return entry
}

// 최상위 Task 도구 호출을 **관측 순서대로** 접는다. Map 은 삽입 순서를 보존하므로 목록 순서가
// 곧 최초 관측 순서다 — 별도 order 필드를 들지 않는다.
function agentEntriesFromMessages(messages: Message[]): Map<string, AgentEntry> {
  const entries = new Map<string, AgentEntry>()
  // 파트 페어링 규칙은 `parts.ts` 하나가 갖는다 — 여기서 사본을 만들면 tool_result 에 필드가
  // 늘 때 조용히 갈라진다(그 comment 가 말하는 네 번째 사본이 된다).
  const resultByRun = resultMap(messages.flatMap((message) => message.parts))

  for (const message of messages) {
    for (const part of message.parts) {
      // 서브에이전트 child 의 Task 도구 호출은 그 서브에이전트의 목록이지 이 세션의 것이 아니다.
      if (part.type !== 'tool_call' || part.parentToolRunId !== undefined) continue
      if (!isTaskToolName(part.toolName)) continue
      const paired = resultByRun.get(part.toolRunId)
      // 결과 미도착 = 아직 아무것도 확정되지 않았다(명세 §2: tool_use 만으로는 등록하지 않는다).
      if (!paired) continue
      const observation = readTaskToolObservation({
        toolName: part.toolName,
        args: part.args,
        structuredOutput: paired.structuredOutput,
        isError: paired.isError
      })
      if (!observation) continue
      switch (observation.kind) {
        case 'created':
        case 'upserted':
          applyPatch(ensure(entries, observation.id), observation.patch)
          // 역방향 간선은 **다른 엔트리**를 건드리므로 `applyPatch`(엔트리 하나) 안에 둘 수 없다.
          applyReverseBlocks(entries, observation.id, observation.patch.addBlocks)
          break
        case 'removed':
          entries.delete(observation.id)
          break
        case 'snapshot': {
          // TaskList 는 전체 스냅샷이다(0204 D-008) — 스냅샷에 없는 로컬 항목은 Claude 측에서
          // 사라진 것이므로 지운다. 그러지 않으면 삭제된 Task 가 패널에 영구 잔류한다.
          const seen = new Set(observation.tasks.map((task) => task.id))
          for (const id of [...entries.keys()]) if (!seen.has(id)) entries.delete(id)
          for (const task of observation.tasks) applyPatch(ensure(entries, task.id), task.patch)
          break
        }
      }
    }
  }
  return entries
}

function agentItem(entry: AgentEntry): TaskBoardItem {
  const subject = entry.subject ?? entry.id
  return {
    key: agentTaskKey(entry.id),
    kind: 'agent',
    id: entry.id,
    // 진행 중일 때만 현재진행형으로 교체한다(0212 D-006 — SDK 주석이 용도를 못박는다:
    // "shown in spinner when in_progress"). 완료되면 `subject` 로 돌아온다.
    title: entry.status === 'in_progress' && entry.activeForm ? entry.activeForm : subject,
    subject,
    description: entry.description ?? null,
    status: entry.status,
    blockedBy: entry.blockedBy,
    background: null
  }
}

/**
 * background 실행 상태 + 중단 대기 집합 → 화면 상태. **두 타일이 공유하는 단일 규칙**이다
 * (plan §3 갱신메모 — "파생 SSOT 는 taskBoard.ts 하나다"). `작업` 타일은 `TaskBoardItem.status`
 * 로, `백그라운드 작업` 타일은 이 함수를 직접 불러 라벨/버튼을 정한다. 인라인으로 각자 쓰면
 * 수명주기가 바뀔 때 한쪽만 따라간다.
 */
export function backgroundBoardStatus(
  status: SubagentTaskSummary['status'],
  toolUseId: string,
  stopping: ReadonlySet<string>,
  paused: ReadonlySet<string> = EMPTY_IDS
): TaskBoardStatus {
  if (status !== 'running') return status
  // 중단 요청이 우선한다 — 사용자가 이미 없애기로 했고 확정을 기다리는 중이면 그것이 지금의
  // 사실이다. `paused` 인 태스크도 중단할 수 있으므로(D-022) 두 상태가 겹칠 수 있다.
  if (stopping.has(toolUseId)) return 'stopping'
  return paused.has(toolUseId) ? 'paused' : 'in_progress'
}

function backgroundItem(
  task: SubagentTaskSummary,
  stopping: ReadonlySet<string>,
  paused: ReadonlySet<string>,
  backgrounded: ReadonlySet<string>
): TaskBoardItem {
  const status = backgroundBoardStatus(task.status, task.toolUseId, stopping, paused)
  return {
    key: backgroundTaskKey(task.toolUseId),
    kind: 'background',
    id: task.toolUseId,
    // background 항목에는 `activeForm` 개념이 없다 — 표시와 안정 이름이 같은 값이다.
    title: task.description,
    subject: task.description,
    description: null,
    status,
    blockedBy: [],
    background: {
      durationMs: task.durationMs,
      toolUses: task.childToolCount,
      tokenCount: task.tokenCount,
      currentToolLabel: task.currentChildLabel,
      settlementMessage: task.settlementMessage,
      prompt: promptFromCall(task.call),
      // 세 출처가 같은 축이다 — 런치 영수증(fold 관측) · SDK `is_backgrounded` 확정 · 사용자
      // 전환 요청 in-flight. 어느 하나라도 참이면 그 행에 전환 버튼은 의미가 없다.
      asyncLaunched: task.asyncLaunched || backgrounded.has(task.toolUseId)
    }
  }
}

/**
 * 세션 messages → 작업 목록. `stoppingBackgroundIds` 는 중단 요청을 보내고 확정을 기다리는
 * background tool_use id 집합(스토어 transient) — 아직 진행 중인 항목에만 반영된다.
 */
export function taskBoardFromMessages(
  messages: Message[],
  opts: {
    stoppingBackgroundIds: ReadonlySet<string>
    pausedBackgroundIds?: ReadonlySet<string>
    backgroundedIds?: ReadonlySet<string>
  } = { stoppingBackgroundIds: EMPTY_IDS }
): TaskBoardItem[] {
  const agents = [...agentEntriesFromMessages(messages).values()].map(agentItem)
  const paused = opts.pausedBackgroundIds ?? EMPTY_IDS
  const backgrounded = opts.backgroundedIds ?? EMPTY_IDS
  const backgrounds = subagentTasksFromMessages(messages).map((task) =>
    backgroundItem(task, opts.stoppingBackgroundIds, paused, backgrounded)
  )
  return [...agents, ...backgrounds]
}

// 상세 화면 행 — 종류가 **실제로 가진 정보만** 낸다(0204 §10 EP-10). 값 포맷(경과·토큰)은
// 렌더가 tr 로 수행하므로 여기서는 원시값 또는 이미 결정된 문자열만 싣는다.
export type TaskDetailValue =
  | { kind: 'statusLabel'; status: TaskBoardStatus }
  | { kind: 'text'; text: string }
  | { kind: 'durationMs'; ms: number | null }
  | { kind: 'count'; count: number }
  | { kind: 'taskIds'; ids: string[] }

export interface TaskDetailRow {
  labelKey: MessageKey
  value: TaskDetailValue
}

export function taskDetailRows(item: TaskBoardItem): TaskDetailRow[] {
  const rows: TaskDetailRow[] = [
    { labelKey: 'chat.taskTile.detail.status', value: { kind: 'statusLabel', status: item.status } }
  ]
  if (item.kind === 'agent') {
    if (item.description) {
      rows.push({
        labelKey: 'chat.taskTile.detail.description',
        value: { kind: 'text', text: item.description }
      })
    }
    if (item.blockedBy.length > 0) {
      rows.push({
        labelKey: 'chat.taskTile.detail.blockedBy',
        value: { kind: 'taskIds', ids: item.blockedBy }
      })
    }
    return rows
  }
  const meta = item.background
  if (!meta) return rows
  rows.push({
    labelKey: 'chat.taskTile.detail.elapsed',
    value: { kind: 'durationMs', ms: meta.durationMs }
  })
  if (meta.currentToolLabel) {
    rows.push({
      labelKey: 'chat.taskTile.detail.lastTool',
      value: { kind: 'text', text: meta.currentToolLabel }
    })
  }
  rows.push({
    labelKey: 'chat.taskTile.detail.toolUses',
    value: { kind: 'count', count: meta.toolUses }
  })
  return rows
}

// 중단 버튼을 노출할 상태인가 — 아직 살아 있을 때만. `stopping` 중에는 다시 누를 수 없다
// (중복 요청 차단). `backgroundBoardStatus` 와 짝이라 두 타일이 같은 규칙을 본다.
//
// **`paused` 도 허용한다**(0212 D-022 · §10 EP-10). 멈춰 있어도 태스크는 살아 있고 자원을
// 쥔다. SDK 에 resume API 가 없으므로(spec §5.3) `paused` 에서 나갈 사용자 경로는 중단뿐이다 —
// 숨기면 사용자가 멈춘 태스크를 없앨 방법을 잃는다.
export function canStopBackgroundStatus(status: TaskBoardStatus): boolean {
  return status === 'in_progress' || status === 'paused'
}

// 중단 버튼을 노출할 항목인가 — background 이고 아직 살아 있을 때만.
export function canStopTask(item: TaskBoardItem): boolean {
  return item.kind === 'background' && canStopBackgroundStatus(item.status)
}

/**
 * foreground → background **전환** 버튼을 노출할 상태인가(0212 R-07 · §10 EP-13).
 * `canStopBackgroundStatus` 와 같은 자리에 사는 형제 규칙이다 — 두 타일이 입력 타입이 서로
 * 달라(`TaskBoardItem` vs `SubagentTaskSummary`) 규칙은 status+flag 로 받고 래퍼가 항목을 푼다.
 *
 * 세 조건이 모두 필요하다. 살아 있어야 하고(정착한 태스크는 옮길 것이 없다), 중단 대기 중이
 * 아니어야 하고, **이미 background 가 아니어야** 한다: `backgroundTasks(toolUseId)` 는 대상
 * foreground 태스크가 없으면 `false` 를 돌려주므로 눌러도 아무 일이 없는 죽은 버튼이 된다
 * (D-021). 서브에이전트는 기본이 background 라(spec §5.2) **버튼이 안 보이는 것이 정상**이다.
 *
 * `paused` 는 제외한다 — 멈춘 태스크는 턴을 막고 있지 않으므로 옮길 기다림이 없다.
 */
export function canBackgroundStatus(status: TaskBoardStatus, asyncLaunched: boolean): boolean {
  return status === 'in_progress' && !asyncLaunched
}

// 전환 버튼을 노출할 항목인가 — background 종류이고 위 규칙을 만족할 때만.
export function canBackgroundTask(item: TaskBoardItem): boolean {
  if (item.kind !== 'background' || !item.background) return false
  return canBackgroundStatus(item.status, item.background.asyncLaunched)
}
