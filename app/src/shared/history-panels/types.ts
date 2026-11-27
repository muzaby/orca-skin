import type { SubagentTaskMeta } from '../ipc'
import type { NonExecution } from '../tool-outcome'
import type { SubagentTaskSummary, ToolRunOutcome } from './tool'

export interface ToolCall {
  providerTool?: { name: string; input: unknown }
  toolUseId: string
  name: string
  input: unknown
  result?: {
    output: unknown
    isError: boolean
    durationMs?: number
    nonExecution?: NonExecution
    parentToolRunId?: string
    // 부모 Task tool_result 면 서브에이전트 영속 메타(모델·시간·도구수) — 재로드 후 카드/행 복원.
    subagentMeta?: SubagentTaskMeta
    // TaskXXX 도구의 SDK 구조화 출력(0204) — 작업 타일 목록 파생의 유일한 권위 입력.
    // `output` 은 모델용 wire content 라 task.id 같은 필드를 담지 않는다.
    structuredOutput?: unknown
  }
  parentToolRunId?: string
  // 실행 전 편집 미리보기(0229) — `result` 가 없는 동안 diff 카드가 읽는 값. 결과가 오면
  // `result.structuredOutput` 이 이긴다(§10 EP-Δ4).
  editPreview?: unknown
}

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

export type TaskContextSource =
  | { kind: 'web'; url: string; title: string }
  | { kind: 'file'; path: string }
  | { kind: 'attachment'; attachmentId: string; name: string; image: boolean; path?: string }

export interface SessionPanelModel {
  agents: (SubagentTaskSummary & { model: string | null | undefined })[]
  processes: {
    id: string
    command: string
    status: ToolRunOutcome
    output: string
    truncated: boolean
    call: ToolCall
  }[]
}

export type TranscriptResults = ReadonlyMap<string, NonNullable<ToolCall['result']>>
