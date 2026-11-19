// 작업 타일 목록 파생 (순수) — 현재 세션의 transcript parts 를 접어 "지금 무슨 작업이 있는가"
// 를 만든다. 0204.
//
// **`TaskCreate` 계열로 만들어진 할 일만 담는다**(0215 D-013 — 사용자 요구). 0204 는 서브에이전트
// (`background`)를 같은 목록에 섞었지만, 그 항목은 `백그라운드 작업` 타일이 이미 자기 책임으로
// 그린다 — 두 타일이 같은 것을 그리던 중복을 없앴다(0204 D-017·D-019 supersede).
//
// 서브에이전트의 상태 규칙(`backgroundBoardStatus`·`canStopBackgroundStatus`·`canBackgroundStatus`)
// 은 **여기 남는다** — `LegacySubAgentTile` 이 `SubagentTaskSummary` 를 들고 직접 부른다.
//
// **왜 fold 인가**: 일반 Task 의 상태는 어디에도 저장돼 있지 않다. main 에 Task 스토어를 두면
// 세션별 격리·재로드 복원·다중 창을 전부 다시 만들어야 하는데, transcript 는 그 셋을 이미
// 갖고 있다(parts 는 세션 엔트리에 살고 DB 에 영속된다). 그래서 목록은 파생값이고 이 파일이
// 그 파생의 유일한 소유자다 — 컴포넌트가 자기 상태로 목록을 만들지 않는다.
//
// 입력은 **그 세션 엔트리의 messages 뿐**이다(0204 §10 EP-08). 전역 스토어를 읽지 않으므로
// 다른 세션의 Task 가 섞일 수 없다.

import type { MessageKey } from '../../../shared/i18n'
import type { SubagentTaskSummary } from './parts'

// 목록에 렌더되는 상태. `stopping` 은 사용자가 중단을 요청했고 SDK 확정을 기다리는 중이다
// (0204 D-005) — 별도 그룹을 만들지 않고 '진행 중' 그룹 안에서 라벨만 달라진다.
// `paused` 는 SDK `task_updated` 로만 관측되는 **살아 있는 일시정지**다(0212 D-014) — 정착이
// 아니므로 완료 그룹으로 내려가지 않고, SDK 에 resume API 가 없어 여기서 나갈 사용자 경로는
// 중단뿐이다(D-022 — 그래서 중단 버튼을 유지한다).
export type TaskBoardStatus =
  | 'in_progress'
  | 'stopping'
  | 'paused'
  | 'pending'
  | 'completed'
  | 'aborted'
  | 'failed'
  | 'rejected'
  | 'cancelled'
  | 'not_executed'

export interface TaskBoardItem {
  // 목록/선택 키. `agent:` 접두사를 유지한다 — `taskStopErrors` 등 다른 상태가 여전히
  // `bg:<toolUseId>` 를 쓰므로 두 네임스페이스는 계속 공존한다(0215 이후에도 키는 갈린다).
  key: string
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
// 규칙: **id 오름차순**. agent id 는 SDK 가 매기는 할 일 순번('1'·'2'·'10')이라 수치 비교해야
// 한다 — 사전순이면 '10' 이 '2' 앞에 온다. 숫자가 아닌 id 는 수치 id 뒤에 사전순으로 둔다.
export function taskBoardOrdered(items: TaskBoardItem[]): TaskBoardItem[] {
  return [...items].sort((a, b) => compareAgentTaskId(a.id, b.id))
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

// 기본 인자용 불변 빈 집합 — 매 호출마다 `new Set()` 을 만들면 memo 의존성이 매번 바뀐다.
const EMPTY_IDS: ReadonlySet<string> = new Set()

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

// 상세 화면 행 — 항목이 **실제로 가진 정보만** 낸다(0204 §10 EP-10). 경과·토큰 행은 서브에이전트
// 전용이었고 0215 로 이 타일에서 사라졌다 — 죽은 variant 를 남기면 렌더의 exhaustive switch 가
// 도달 불가 분기를 계속 들고 있게 된다.
export type TaskDetailValue =
  | { kind: 'statusLabel'; status: TaskBoardStatus }
  | { kind: 'text'; text: string }
  | { kind: 'taskIds'; ids: string[] }

export interface TaskDetailRow {
  labelKey: MessageKey
  value: TaskDetailValue
}

export function taskDetailRows(item: TaskBoardItem): TaskDetailRow[] {
  const rows: TaskDetailRow[] = [
    { labelKey: 'chat.taskTile.detail.status', value: { kind: 'statusLabel', status: item.status } }
  ]
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

// 중단 버튼을 노출할 상태인가 — 아직 살아 있을 때만. `stopping` 중에는 다시 누를 수 없다
// (중복 요청 차단). `backgroundBoardStatus` 와 짝이라 두 타일이 같은 규칙을 본다.
//
// **`paused` 도 허용한다**(0212 D-022 · §10 EP-10). 멈춰 있어도 태스크는 살아 있고 자원을
// 쥔다. SDK 에 resume API 가 없으므로(spec §5.3) `paused` 에서 나갈 사용자 경로는 중단뿐이다 —
// 숨기면 사용자가 멈춘 태스크를 없앨 방법을 잃는다.
export function canStopBackgroundStatus(status: TaskBoardStatus): boolean {
  return status === 'in_progress' || status === 'paused'
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
