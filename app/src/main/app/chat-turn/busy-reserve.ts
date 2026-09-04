// busy 세션의 send 를 pending queue 예약(held)으로 수용한다 (0067 AC5 — 구 chat:steer 본체).
//
// **동기 함수다 (0152 AC1)**: 첨부 정규화는 호출자가 busy 판정 *전에* 끝내 넘긴다. 여기서
// await 하면 그 사이 진행 턴이 끝나 턴-후 루프가 break·release 해버려 뒤늦게 held 에 착지한
// 예약을 flush 할 주체가 사라진다("pending 인 채 답변완료").

import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { AttachmentView, DiffRequirementAnchor } from '../../../shared/ipc'
import type { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import type { SessionChainLease } from '../../features/sessions/session-chain-lease'
import { sendChatEvent } from '../../infra/ipc/send'
import { checkBusyReservation } from './admission'
import type { NormalizedAttachments } from './deps'

interface BusyReservePayload {
  text: string
  requirements?: DiffRequirementAnchor[]
  attachmentViews?: AttachmentView[]
  clientRequestId?: string | undefined
  providerKey?: string | null | undefined
}

export function reserveOnBusySession(
  deps: {
    pendingMessages: PendingMessageQueue
    /** 세션 키별 listen 프레임 릴리즈 밸브. */
    listenRelease: Map<string, () => void>
  },
  event: IpcMainInvokeEvent,
  queueKey: string,
  sessionId: string | undefined,
  lease: SessionChainLease<WebContents>,
  data: BusyReservePayload,
  na: NormalizedAttachments
): void {
  // 큐 admission 과 즉시 steer 가능 여부는 다른 계약이다. active 채널이 mid-turn steer 를
  // 지원하지 않아도 체인 종료 뒤 자동 continuation 으로 안전하게 전달할 수 있으므로,
  // closing 전 lease 는 입력을 held 로 수용한다. 실제 push 가능성은 턴-후 루프가 판정한다.
  const rejection = checkBusyReservation({
    leaseKind: lease.kind,
    leasedProviderKey: lease.kind === 'active' ? lease.providerKey : lease.requestedProviderKey,
    requestedProviderKey: data.providerKey ?? null
  })
  if (rejection) {
    sendChatEvent(event.sender, {
      type: 'error',
      ...(sessionId ? { sessionId } : {}),
      error: rejection
    })
    return
  }
  const item = deps.pendingMessages.enqueue(
    queueKey,
    {
      text: data.text,
      ...(na.attachmentTexts.length > 0 ? { attachmentTexts: na.attachmentTexts } : {}),
      ...(na.attachmentImages.length > 0 ? { attachmentImages: na.attachmentImages } : {}),
      ...(data.requirements && data.requirements.length > 0
        ? { requirements: data.requirements }
        : {}),
      ...(data.attachmentViews && data.attachmentViews.length > 0
        ? { attachmentViews: data.attachmentViews }
        : {})
    },
    Math.max(Date.now(), lease.admittedAt + 1),
    data.clientRequestId
  )
  sendChatEvent(event.sender, {
    type: 'message.queued',
    ...(sessionId ? { sessionId } : {}),
    id: item.id,
    text: item.text,
    ...(item.requirements ? { requirements: item.requirements } : {}),
    ...(item.attachmentViews ? { attachmentViews: item.attachmentViews } : {}),
    createdAt: item.createdAt
  })
  // 0136 — listen 턴(백그라운드 대기) 중의 예약은 게이트 훅(PostToolBatch)이 영영 안 올 수
  // 있다(CLI 유휴). listen 프레임을 닫아 턴-후 루프가 즉시 held flush 연속 턴으로 전환한다.
  if (sessionId) deps.listenRelease.get(sessionId)?.()
}
