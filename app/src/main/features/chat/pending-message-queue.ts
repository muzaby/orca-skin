import { randomUUID } from 'node:crypto'
import type { AttachmentView } from '../../../shared/ipc'
import type { SteerFlush, SteerFlushBatch, TurnSelectionSnapshot } from '../../adapters/turn'
import type { ExtractedAttachmentImage, ExtractedAttachmentText } from '../../adapters/turn'

// 큐 아이템 페이로드 — 구조 페이로드(0067 AC5): 텍스트 + 추출 첨부(어댑터가 content 블록으로
// 굽는 입력) + 표시용 첨부 뷰(커밋 시 renderer/DB 로 흐른다).
export interface PendingMessagePayload {
  text: string
  attachmentTexts?: ExtractedAttachmentText[]
  attachmentImages?: ExtractedAttachmentImage[]
  attachmentViews?: AttachmentView[]
  selection?: TurnSelectionSnapshot
}

export interface PendingMessage extends PendingMessagePayload {
  id: string
  sessionId: string
  createdAt: number
  delivery: 'steer' | 'queued'
}

// held 에서 flush 로 넘어간 배치. 병합 텍스트는 flush 시점에 1회 계산·보존한다 — echo 의
// text 폴백 매칭과 message.committed 커밋이 같은 원본을 봐 재계산 드리프트가 없다.
interface FlushedBatch extends SteerFlushBatch {
  // CLI 가 이 배치를 흡수(user echo 관측)했는가 — 커밋 대상 판정 플래그(0060 D1).
  consumed: boolean
}

function toBatch(items: PendingMessage[], uuid: string): SteerFlushBatch {
  const attachmentTexts = items.flatMap((item) => item.attachmentTexts ?? [])
  const attachmentImages = items.flatMap((item) => item.attachmentImages ?? [])
  const attachmentViews = items.flatMap((item) => item.attachmentViews ?? [])
  return {
    uuid,
    ids: items.map((item) => item.id),
    text: items.map((item) => item.text).join('\n\n'),
    createdAt: items[0].createdAt,
    ...(items.at(-1)?.selection ? { selection: items.at(-1)!.selection } : {}),
    ...(attachmentTexts.length > 0 ? { attachmentTexts } : {}),
    ...(attachmentImages.length > 0 ? { attachmentImages } : {}),
    ...(attachmentViews.length > 0 ? { attachmentViews } : {})
  }
}

// 세션별 pending message queue — **모든 사용자 프롬프트**가 커밋(DB 영속) 전에 지나는 단일
// 스테이징 통로(0066 → 0067 완전 일원화). 세션 상태가 주입 경로를 가른다:
//
//   사용자 턴(세션 idle) — chat:send 가 enqueue 직후 flushItem 으로 아이템 단위 배치를 떠서
//     턴 프롬프트로 주입한다(스폰 초기 메시지 또는 pushTurn). 채널이 죽어 있었다면
//     takeForRespawn 이 잔여(미소비 flushed 재주입 + held)를 프렐류드 배치로 앞세운다.
//   어시스턴트 턴(inflight) — chat:send 는 예약(held)만 한다. 항목 수명(0060 D1·D3·D4):
//     [held]     enqueue 직후. stdin 미주입 — 취소·수정 100% 가능.
//     [flushed]  게이트 훅(PostToolBatch, flushHeld 병합 단일 배치) 또는 턴 프롬프트
//                (flushItem/takeForRespawn, 아이템 단위)로 stdin 주입됨. 취소 불가.
//     [consumed] 소비 확정(markConsumed) — 신호는 배치 성격에 따라 둘(0069):
//                · 턴-시작 배치(프롬프트·프렐류드) = 프레임의 **첫 모델 출력**(응답 시작이
//                  곧 소비 증거 — coordinator MODEL_OUTPUT_EVENTS 앵커, echo 불요)
//                · steer 배치(mid-turn 게이트 flush) = CLI **user echo**(uuid 매칭 — 응답
//                  진행은 소비 증거가 못 되므로(D2) echo 가 유일한 정밀 신호)
//                drainConsumedBatches 가 배치 단위로 커밋 대상 회수.
//
// 훅(PostToolBatch/UserPromptSubmit)은 주입 제어 계층이지 커밋 신호가 아니다(0068 실측 —
// UserPromptSubmit 은 uuid 부재+init 이전 발화라 상관 불가). renderer 는 message.queued/
// committed/cancelled 로 큐를 간접 관찰하고, 취소(cancel/cancelAllHeld)는 held 창 안에서만
// 성립한다.
export class PendingMessageQueue {
  private readonly heldBySession = new Map<string, PendingMessage[]>()
  private readonly flushedBySession = new Map<string, FlushedBatch[]>()
  private readonly queueBarriers = new Set<string>()

  enqueue(
    sessionId: string,
    payload: PendingMessagePayload,
    now = Date.now(),
    id: string = randomUUID(),
    requestedDelivery: 'steer' | 'queued' = 'steer'
  ): PendingMessage {
    const trimmed = payload.text.trim()
    if (trimmed === '') throw new Error('empty pending message text')
    const delivery =
      requestedDelivery === 'queued' || this.queueBarriers.has(sessionId) ? 'queued' : 'steer'
    if (delivery === 'queued') this.queueBarriers.add(sessionId)
    const item: PendingMessage = {
      ...payload,
      id,
      sessionId,
      text: trimmed,
      createdAt: now,
      delivery
    }
    const items = this.heldBySession.get(sessionId) ?? []
    items.push(item)
    this.heldBySession.set(sessionId, items)
    return item
  }

  // held 항목만 취소 가능 — flushed(stdin 주입 완료) 항목은 undefined(거부). 거부 시 호출자는
  // message.cancelled 를 발신하지 않고, 이후 echo 커밋이 버블을 복원한다(D3 정직 화해).
  cancel(sessionId: string, id: string): PendingMessage | undefined {
    const items = this.heldBySession.get(sessionId)
    if (!items) return undefined
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) return undefined
    const [removed] = items.splice(index, 1)
    if (items.length === 0) this.heldBySession.delete(sessionId)
    return removed
  }

  // 중단 버튼(0067 확정 5) — held 전량 취소. 반환 항목들의 텍스트를 renderer 가 composer draft
  // 로 복원한다. flushed 분은 대상 아님(un-push 불가).
  cancelAllHeld(sessionId: string): PendingMessage[] {
    const items = this.heldBySession.get(sessionId) ?? []
    this.heldBySession.delete(sessionId)
    this.queueBarriers.delete(sessionId)
    return items
  }

  pending(sessionId: string): PendingMessage[] {
    return [...(this.heldBySession.get(sessionId) ?? [])]
  }

  hasQueueBarrier(sessionId: string): boolean {
    return this.queueBarriers.has(sessionId)
  }

  // 세션 키 재바인딩(0067 AC9) — 새 세션은 clientKey(draft UUID)로 적재됐다가 init 에서 실
  // session id 로 갈아탄다(coordinator 가 session.updated 에서 호출).
  rekey(oldKey: string, newKey: string): void {
    if (oldKey === newKey) return
    const held = this.heldBySession.get(oldKey)
    if (held) {
      this.heldBySession.delete(oldKey)
      const target = this.heldBySession.get(newKey) ?? []
      this.heldBySession.set(newKey, [...target, ...held])
    }
    const flushed = this.flushedBySession.get(oldKey)
    if (flushed) {
      this.flushedBySession.delete(oldKey)
      const target = this.flushedBySession.get(newKey) ?? []
      this.flushedBySession.set(newKey, [...target, ...flushed])
    }
    if (this.queueBarriers.delete(oldKey)) this.queueBarriers.add(newKey)
  }

  // 게이트 훅(PostToolBatch) 시점 — queue barrier 앞의 steer 가능 prefix 만 병합한다.
  // 반환 배치를 stdin 에 1건의 user 메시지(uuid=batch uuid)로 주입한다(D3·D4: 1버블 = 구조 보장).
  flushHeld(sessionId: string, uuid: string = randomUUID()): SteerFlushBatch | undefined {
    const items = this.heldBySession.get(sessionId)
    if (!items || items.length === 0) return undefined
    const barrierIndex = items.findIndex((item) => item.delivery === 'queued')
    const count = barrierIndex < 0 ? items.length : barrierIndex
    if (count === 0) return undefined
    const flushedItems = items.splice(0, count)
    if (items.length === 0) this.heldBySession.delete(sessionId)
    const batch = toBatch(flushedItems, uuid)
    this.registerFlushed(sessionId, batch)
    return batch
  }

  // 어시스턴트 턴 종료 — 남은 steer/queued 항목을 마지막 선택으로 한 번에 연속 실행한다.
  flushAllHeld(sessionId: string, uuid: string = randomUUID()): SteerFlushBatch | undefined {
    const items = this.heldBySession.get(sessionId)
    this.queueBarriers.delete(sessionId)
    if (!items || items.length === 0) return undefined
    this.heldBySession.delete(sessionId)
    const batch = toBatch(items, uuid)
    this.registerFlushed(sessionId, batch)
    return batch
  }

  endTurn(sessionId: string): void {
    this.queueBarriers.delete(sessionId)
  }

  // 턴 프롬프트 flush(0067 AC5) — 지정 아이템 1개를 자기 배치(uuid=item id)로 전이한다. 사용자
  // 턴의 일반 메시지는 병합 없이 자기 버블/row 로 커밋돼야 하므로 게이트 병합과 경로를 나눈다.
  flushItem(sessionId: string, id: string): SteerFlushBatch | undefined {
    const item = this.cancel(sessionId, id) // held 에서 제거(재사용 — 검증 동일)
    if (!item) return undefined
    const batch = toBatch([item], item.id)
    this.registerFlushed(sessionId, batch)
    return batch
  }

  // 채널 사망 후 스폰 직전(0067) — 이월 잔여를 프렐류드 배치 목록으로 회수한다: 미소비 flushed
  // (모델이 못 본 stdin 사본 — 서브프로세스 종료로 CLI 큐 소멸)는 **재주입**(배치 그대로, uuid
  // 보존 = renderer pending id 정합), held 는 아이템 단위 배치로 전이. createdAt 순.
  takeForRespawn(sessionId: string): SteerFlushBatch[] {
    // 소비 확정 잔존분(경계 유실 — drain 전에 채널 사망)은 폐기한다: 이미 커밋됐거나 커밋
    // 판정이 유실된 배치를 재전달하면 모델 이중 전달이 된다(구 drainForFlush 규칙 계승).
    const unconsumed = (this.flushedBySession.get(sessionId) ?? []).filter(
      (batch) => !batch.consumed
    )
    const held = this.heldBySession.get(sessionId) ?? []
    this.heldBySession.delete(sessionId)
    this.queueBarriers.delete(sessionId)
    const next: FlushedBatch[] = [...unconsumed]
    const heldBatches = held.map((item) => {
      const batch: FlushedBatch = { ...toBatch([item], item.id), consumed: false }
      next.push(batch)
      return batch as SteerFlushBatch
    })
    if (next.length > 0) this.flushedBySession.set(sessionId, next)
    else this.flushedBySession.delete(sessionId)
    return [...unconsumed, ...heldBatches].sort((a, b) => a.createdAt - b.createdAt)
  }

  // user echo 관측 → 해당 배치를 소비로 표시한다. batch uuid 매칭 1차, echo 의 uuid 미보존
  // 대비 병합 텍스트 완전일치 폴백(FIFO — 가장 오래된 미소비 배치). 매칭 실패(무관 echo)는
  // undefined — 호출자는 무시한다.
  markConsumed(
    sessionId: string,
    match: { uuid?: string; text?: string }
  ): SteerFlushBatch | undefined {
    const batches = this.flushedBySession.get(sessionId)
    if (!batches) return undefined
    const textMatch = match.text?.trim()
    const batch =
      (match.uuid !== undefined
        ? batches.find((b) => !b.consumed && b.uuid === match.uuid)
        : undefined) ??
      (textMatch !== undefined
        ? batches.find((b) => !b.consumed && b.text === textMatch)
        : undefined)
    if (!batch) return undefined
    batch.consumed = true
    return batch
  }

  // 소비 확정 배치를 **배치 단위로** drain — echo 배치가 끝난 지점(첫 비-echo 이벤트/턴 종료)
  // 에서 각 배치가 자기 user row/버블로 커밋된다(0067: 턴 프롬프트·프렐류드는 아이템 단위
  // 배치라 병합하면 버블 구조가 깨진다 — 병합은 게이트 flushHeld 가 이미 수행한 단위 그대로).
  // 미소비 배치는 남긴다(D2).
  drainConsumedBatches(sessionId: string): SteerFlushBatch[] {
    const batches = this.flushedBySession.get(sessionId)
    if (!batches) return []
    const consumed = batches.filter((batch) => batch.consumed)
    if (consumed.length === 0) return []
    const remaining = batches.filter((batch) => !batch.consumed)
    if (remaining.length === 0) this.flushedBySession.delete(sessionId)
    else this.flushedBySession.set(sessionId, remaining)
    return consumed
  }

  private registerFlushed(sessionId: string, batch: SteerFlushBatch): void {
    const batches = this.flushedBySession.get(sessionId) ?? []
    batches.push({ ...batch, consumed: false })
    this.flushedBySession.set(sessionId, batches)
  }
}

export type { SteerFlush, SteerFlushBatch }
