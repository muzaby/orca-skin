// 턴 프롬프트 큐 적재 (0179 에서 분해).
//
// **모든 프롬프트는 pending queue 를 경유한다** (0067 AC5·AC6) — send 시점 선영속은 폐기됐고,
// 커밋(user row 영속·preview/provider_key·renderer 승격)은 echo 관측 단일 경로(coordinator)가
// 소유한다. 여기서 하는 일은 적재와 예약, 그리고 pending-first 렌더 신호뿐이다.

import type { WebContents } from 'electron'
import type { AttachmentView, DiffRequirementAnchor } from '../../../shared/ipc'
import type { SteerFlushBatch } from '../../adapters/turn'
import type { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import { sendChatEvent } from '../../infra/ipc/send'
import type { NormalizedAttachments } from './deps'

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
  const queuedItem = pendingMessages.enqueue(
    queueKey,
    {
      text: input.text,
      ...(input.attachments.attachmentTexts.length > 0
        ? { attachmentTexts: input.attachments.attachmentTexts }
        : {}),
      ...(input.attachments.attachmentImages.length > 0
        ? { attachmentImages: input.attachments.attachmentImages }
        : {}),
      ...(input.requirements.length > 0 ? { requirements: input.requirements } : {}),
      ...(input.attachmentViews.length > 0 ? { attachmentViews: input.attachmentViews } : {})
    },
    input.admittedAt,
    input.clientRequestId
  )
  // pending-first 렌더(0067 AC8) — renderer 낙관 항목과 id 로 합류(upsert). 새 세션은
  // sessionId 미확정이라 생략 → renderer 가 clientKey/pendingNewChatKey 로 라우팅.
  sendChatEvent(input.wc, {
    type: 'message.queued',
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    id: queuedItem.id,
    text: queuedItem.text,
    ...(queuedItem.attachmentViews ? { attachmentViews: queuedItem.attachmentViews } : {}),
    createdAt: queuedItem.createdAt
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
