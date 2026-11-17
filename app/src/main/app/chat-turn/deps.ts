// chat 턴 파이프라인이 공유하는 의존 묶음 (0179).
//
// `ChatDeps` 는 컴포지션 루트(bootstrap)가 주입하는 것, `ChatRuntimeDeps` 는 거기에
// `registerChatHandlers` 가 만드는 턴-공통 헬퍼와 listen 프레임 릴리즈 맵을 더한 것이다.
// 두 층을 가른 이유는 send 경로가 후자만 알면 되고, 전자는 배선의 관심사이기 때문이다.

import type { ClientRef } from '../../contracts/client'
import type { TurnContext } from '../../contracts/turn'
import type { MainBus } from '../../contracts/bus-events'
import type { ApprovalCoordinator } from '../../features/approvals/coordinator'
import type { PermissionModeController } from '../../features/approvals/permission-mode-controller'
import type { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import type { normalizeAttachments } from '../../features/chat/attachments'
import type { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import type { SessionActivityProjector } from '../../features/chat/session-activity-projector'
import type { TurnPersistSink } from '../../features/chat/turn-sinks'
import type { RuntimeSupervisor } from '../../features/sessions/supervisor'
import type { AgentContext } from '../context'
import type { WorktreeService } from '../../features/worktrees/service'
import type { TurnExtensions } from '../../adapters/common/turn'
import type { BackgroundController } from '../../features/chat/background-controller'
import type { BackgroundEvent, ProviderMessageEvent } from '../../../shared/background-task'

// 턴 코드가 쓰는 저장 입력 — 턴 싱크에 턴 끝과 백그라운드 기록을 더한 것.
export interface TurnPersistence extends TurnPersistSink<ClientRef> {
  finalizeTurn(turn: TurnContext<ClientRef>): void
  // 기록이 끝난 뒤에만 `committed` 를 부른다 — 그 뒤에 창에 공개한다.
  persistProviderEvent(event: BackgroundEvent | ProviderMessageEvent, committed: () => void): void
}

export interface ChatDeps {
  ctx: AgentContext
  supervisor: RuntimeSupervisor<ClientRef>
  bus: MainBus<ClientRef>
  approvals: ApprovalCoordinator
  // 턴 저장 입력이 가는 곳 — 에이전트 호스트에서는 저장 스트림의 보내는 끝이다(0324 EP-15).
  persistence: TurnPersistence
  // 백그라운드 작업 기록의 복원 읽기. 기록(`persistence.persistProviderEvent`)과 같은 순서 안에서
  // 동기로 읽는다 — 턴 저장 스트림(0324 EP-15)과 함께 데이터 호스트로 옮긴다.
  loadBackgroundEvents: (sessionId: string) => BackgroundEvent[]
  // 복원 읽기가 동기라, 기록이 다른 프로세스에 있으면 상태 요청 전에 사본을 채운다(0324).
  prefetchBackgroundEvents?: (sessionId: string) => Promise<void>
  permissionModes: PermissionModeController
  pendingMessages: PendingMessageQueue
  backgroundTasks: BackgroundTaskTracker
  activity: SessionActivityProjector
  isUpdateInstallPending: () => boolean
  // 하네스 채널이 오류로 내려갔다(0324 EP-11 `harness.exited`). 세션 미확정이면 null 이다.
  onHarnessExited?: (sessionId: string | null) => void
  worktrees: WorktreeService
  prepareOutputFiles?: (cwd: string) => Promise<NonNullable<TurnExtensions['outputFiles']>>
}

export type NormalizedAttachments = Awaited<ReturnType<typeof normalizeAttachments>>

export interface ChatRuntimeDeps extends ChatDeps {
  background: BackgroundController
  /** 세션 키별 listen 프레임 릴리즈 밸브 — busy send 예약 직후 즉시 연속 턴으로 전환시킨다. */
  listenRelease: Map<string, () => void>
}
