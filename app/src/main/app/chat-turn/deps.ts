// chat 턴 파이프라인이 공유하는 의존 묶음 (0179).
//
// `ChatDeps` 는 컴포지션 루트(bootstrap)가 주입하는 것, `ChatRuntimeDeps` 는 거기에
// `registerChatHandlers` 가 만드는 턴-공통 헬퍼(버스 방출·태스크 정착·busy 예약)를 더한 것이다.
// 두 층을 가른 이유는 send 경로가 후자만 알면 되고, 전자는 배선의 관심사이기 때문이다.

import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { AttachmentView } from '../../../shared/ipc'
import type { MainBus } from '../../contracts/bus-events'
import type { TurnContext } from '../../contracts/turn'
import type { ApprovalCoordinator } from '../../features/approvals/coordinator'
import type { PermissionModeController } from '../../features/approvals/permission-mode-controller'
import type { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import type { normalizeAttachments } from '../../features/chat/attachments'
import type { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import type { SessionActivityProjector } from '../../features/chat/session-activity-projector'
import type { HistoryWriter } from '../../features/history/writer'
import type { SessionChainLease } from '../../features/sessions/session-chain-lease'
import type { RuntimeSupervisor } from '../../features/sessions/supervisor'
import type { RouterContext } from '../context'

export interface ChatDeps {
  ctx: RouterContext
  supervisor: RuntimeSupervisor<WebContents>
  bus: MainBus<WebContents>
  approvals: ApprovalCoordinator
  persistence: HistoryWriter
  permissionModes: PermissionModeController
  pendingMessages: PendingMessageQueue
  backgroundTasks: BackgroundTaskTracker
  activity: SessionActivityProjector
  isUpdateInstallPending: () => boolean
}

export type NormalizedAttachments = Awaited<ReturnType<typeof normalizeAttachments>>

export interface ChatRuntimeDeps extends ChatDeps {
  /** 채널 사망으로 소멸한 백그라운드 태스크를 합성 settled(failed)로 정착한다 (0136). */
  settleDeadBackgroundTasks: (turn: TurnContext<WebContents>, sessionId: string) => Promise<void>
  /** listen 대기 중 사용자 중단 — 실행 중 태스크도 stopTask + 합성 stopped 로 정착 (0143). */
  stopAndSettleAbortedTasks: (turn: TurnContext<WebContents>, sessionId: string) => Promise<void>
  /** busy 세션의 send 를 pending queue 예약(held)으로 수용한다 (0067 AC5). */
  reserveOnBusySession: (
    event: IpcMainInvokeEvent,
    queueKey: string,
    sessionId: string | undefined,
    lease: SessionChainLease<WebContents>,
    data: {
      text: string
      attachmentViews?: AttachmentView[]
      clientRequestId?: string | undefined
      providerKey?: string | null | undefined
    },
    attachments: NormalizedAttachments
  ) => void
  /** 세션 키별 listen 프레임 릴리즈 밸브 — busy send 예약 직후 즉시 연속 턴으로 전환시킨다. */
  listenRelease: Map<string, () => void>
}
