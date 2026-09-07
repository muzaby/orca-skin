// 턴 프롬프트 큐 적재 (0179 에서 분해).
//
// **모든 프롬프트는 pending queue 를 경유한다** (0067 AC5·AC6) — send 시점 선영속은 폐기됐고,
// 커밋(user row 영속·preview/provider_key·renderer 승격)은 echo 관측 단일 경로(coordinator)가
// 소유한다. 여기서 하는 일은 적재와 예약, 그리고 pending-first 렌더 신호뿐이다.

import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { AttachmentView, DiffRequirementAnchor } from '../../../shared/ipc'
import type { SteerFlushBatch } from '../../adapters/turn'
import type { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import { sendChatEvent } from '../../infra/ipc/send'
import type { NormalizedAttachments } from './deps'
import type { SessionChainLease } from '../../features/sessions/session-chain-lease'
import { checkBusyReservation } from './admission'

interface EnqueueResult {
  preludes: SteerFlushBatch[]
  mainBatch: SteerFlushBatch
  initialBatches: SteerFlushBatch[]
}

export function enqueueTurnPrompt(input: {
  wc: WebContents
  pendingMessages: PendingMessageQueue
  queueKey: string
  chainId: string
  channelAlive: boolean
  /** renderer 라우팅용 — 새 세션은 id 미확정이라 생략한다. */
  sessionId: string | null
  text: string
  requirements: DiffRequirementAnchor[]
  attachments: NormalizedAttachments
  attachmentViews: AttachmentView[]
  admittedAt: number
  clientRequestId?: string | undefined
}): EnqueueResult {
  const { pendingMessages, queueKey, chainId } = input

  // ① 프렐류드: 채널 사망 이월 — 미소비 flushed(CLI 큐 소멸분) 재전달 + held 를 아이템 단위
  //    배치로 회수해 본 프롬프트 *앞에* 개별 user 메시지로 선적재한다(개별 echo→개별 커밋 =
  //    버블 구조 보존). **채널 생존 시엔 회수하지 않는다** — flushed 분은 CLI 큐에 살아있어
  //    다음 턴 픽업으로, held 분은 이번 턴 게이트 flush 로 이어진다(드레인하면 이중 전달).
  const preludes: SteerFlushBatch[] = input.channelAlive
    ? []
    : pendingMessages.takeForRespawn(queueKey, chainId)

  // ② 본 프롬프트.
  const queuedItem = enqueueMessage({
    wc: input.wc,
    pendingMessages,
    queueKey,
    sessionId: input.sessionId,
    data: input,
    attachments: input.attachments,
    admittedAt: input.admittedAt
  })
  // 턴 프롬프트 예약 — origin='turn-open' 이라 확정 신호는 **첫 모델 출력**이다(0069·0151 AC1).
  //
  // **잔여 held 를 함께 병합한다(0152 AC2)**: 이전 턴이 남긴 예약이 있는데 새 항목만 예약하면
  // 새 메시지가 턴 프롬프트로 먼저 들어가고 잔여는 게이트/연속 턴으로 나중에 흘러 **입력 순서가
  // 뒤집힌다**. reserveHeld 는 held 를 적재 순서(=시간 순)대로 병합하므로 잔여가 앞, 새 메시지가
  // 뒤가 된다(0067 D4 = 병합 1버블, 게이트 flush 와 동일 규칙). 잔여가 없으면 아이템 단위 배치.
  const mainBatch =
    pendingMessages.pending(queueKey).length > 1
      ? pendingMessages.reserveHeld(queueKey, 'turn-open', undefined, chainId)!
      : pendingMessages.reserveItem(queueKey, queuedItem.id, 'turn-open', chainId)!

  return { preludes, mainBatch, initialBatches: [...preludes, mainBatch] }
}

// busy admission과 적재는 동기 실행하며 첨부 정규화는 send가 먼저 마친다.
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
  enqueueMessage({
    wc: event.sender,
    pendingMessages: deps.pendingMessages,
    queueKey,
    sessionId,
    data,
    attachments: na,
    admittedAt: Math.max(Date.now(), lease.admittedAt + 1)
  })
  // 0136 — listen 턴(백그라운드 대기) 중의 예약은 게이트 훅(PostToolBatch)이 영영 안 올 수
  // 있다(CLI 유휴). listen 프레임을 닫아 턴-후 루프가 즉시 held flush 연속 턴으로 전환한다.
  if (sessionId) deps.listenRelease.get(sessionId)?.()
}
// 신규·busy 입력은 같은 내용과 queued wire를 만든다. 예약·respawn·listen 정책은 호출부 소유.
function enqueueMessage(input: {
  wc: WebContents
  pendingMessages: PendingMessageQueue
  queueKey: string
  sessionId: string | null | undefined
  data: Pick<BusyReservePayload, 'text' | 'requirements' | 'attachmentViews' | 'clientRequestId'>
  attachments: NormalizedAttachments
  admittedAt: number
}): ReturnType<PendingMessageQueue['enqueue']> {
  const { data, attachments } = input
  const item = input.pendingMessages.enqueue(
    input.queueKey,
    {
      text: data.text,
      ...(attachments.attachmentTexts.length > 0
        ? { attachmentTexts: attachments.attachmentTexts }
        : {}),
      ...(attachments.attachmentImages.length > 0
        ? { attachmentImages: attachments.attachmentImages }
        : {}),
      ...(data.requirements && data.requirements.length > 0
        ? { requirements: data.requirements }
        : {}),
      ...(data.attachmentViews && data.attachmentViews.length > 0
        ? { attachmentViews: data.attachmentViews }
        : {})
    },
    input.admittedAt,
    data.clientRequestId
  )
  sendChatEvent(input.wc, {
    type: 'message.queued',
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    id: item.id,
    text: item.text,
    ...(item.requirements ? { requirements: item.requirements } : {}),
    ...(item.attachmentViews ? { attachmentViews: item.attachmentViews } : {}),
    createdAt: item.createdAt
  })
  return item
}

// 소유권 표시(0151 AC12) 발신 단일 지점 — held(취소 가능) ↔ submitted(전달됨, 취소 불가) 전이를
// renderer 에 알린다. 버스 미경유 직행(message.queued 동렬 — 미영속 UI 상태). 턴 핸들러(활성 턴의
// wc)와 steerCancel 핸들러(event.sender)가 서로 다른 WebContents 를 쓰므로 인자로 받는다.
export function sendSubmitted(
  wc: WebContents,
  sessionId: string,
  ids: string[],
  submitted: boolean
): void {
  if (ids.length === 0) return
  sendChatEvent(wc, { type: 'message.submitted', sessionId, ids, submitted })
}
