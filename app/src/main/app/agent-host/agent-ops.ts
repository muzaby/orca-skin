// 데이터 호스트가 에이전트 호스트에 부탁하는 연산의 표 (0324 F4 · EP-21). 인자·결과는 구조화 복제가
// 되는 값만 쓴다 — 함수·`AbortSignal` 은 건너가지 못한다(실행 취소는 `cancelShell` 로 따로 보낸다).
//
// 확보 여부는 부르는 쪽(`app/data-host/agent-link.ts`)이 정한다: 활동 조회·런타임 폐기는 `request`,
// 네이티브 이력 읽기·예약 셸 명령은 `requestEnsured`.

import type { ChatActivitySnapshot } from '../../../shared/ipc'
import type { NativeHistoryResult } from '../../adapters/common/native-history'
import type { ShellRunResult } from '../../infra/shell/shell-runner'

export interface ShellRunRequest {
  // 데이터 호스트가 정한 실행 id — 취소가 이 id 를 가리킨다.
  runId: string
  command: string
  cwd: string
  timeoutMs: number
  maxOutputBytes: number
}

export type AgentCallOps = {
  // 세션의 실행 상태 — 세션 로드 응답에 실린다.
  sessionActivity(sessionId: string): ChatActivitySnapshot
  // 세션 삭제·숨김 전에 그 세션의 런타임·대기 메시지·백그라운드 작업을 폐기한다.
  discardSession(sessionId: string): void
  // 하네스 원본 이력 읽기 — 이전 스냅샷은 실행 쪽이 데이터 링크로 다시 읽는다.
  readNativeHistory(sessionId: string): Promise<NativeHistoryResult | null>
  runShell(request: ShellRunRequest): Promise<ShellRunResult>
  cancelShell(runId: string): void
}

// 표의 구현은 에이전트 조립이 준다. 표에 없는 이름은 받지 않는다(`createOpDispatcher`).
export function createAgentCallOps(impl: AgentCallOps): AgentCallOps {
  return {
    sessionActivity: (sessionId) => impl.sessionActivity(sessionId),
    discardSession: (sessionId) => impl.discardSession(sessionId),
    readNativeHistory: (sessionId) => impl.readNativeHistory(sessionId),
    runShell: (request) => impl.runShell(request),
    cancelShell: (runId) => impl.cancelShell(runId)
  }
}
