import { randomUUID } from 'node:crypto'
import type { SteerFlush, SteerFlushBatch } from '../../adapters/turn'

export interface PendingMessage {
  id: string
  sessionId: string
  text: string
  createdAt: number
}

// held 에서 flush 로 넘어간 배치. 병합 텍스트는 flush 시점에 1회 계산·보존한다 — echo 의
// text 폴백 매칭과 steer.flushed 커밋이 같은 원본을 봐 재계산 드리프트가 없다.
interface FlushedBatch extends SteerFlushBatch {
  // CLI 가 이 배치를 흡수(user echo 관측)했는가 — 커밋(flush) 대상 판정 플래그(0060 D1).
  consumed: boolean
}

function mergeBatch(items: PendingMessage[], uuid: string): SteerFlushBatch {
  return {
    uuid,
    ids: items.map((item) => item.id),
    text: items.map((item) => item.text).join('\n\n'),
    createdAt: items[0].createdAt
  }
}

// 세션별 pending message queue — 사용자발 메시지가 커밋(DB 영속) 전에 머무는 단일 스테이징
// 통로(0066). 일반 메시지와 steer 메시지가 같은 통로를 지나며, 세션 상태가 경로를 가른다:
//
//   사용자 턴(세션 idle) — 일반 메시지는 머물 이유가 없어 즉시 커밋된다. 이월 pending 이
//     있으면 chat:send 가 drainAll 로 먼저 회수·커밋(새 user row 앞 영속 + 프롬프트 병합)한다.
//   어시스턴트 턴(inflight) — chat:steer 메시지는 예약(held)으로 대기한다. 항목 수명
//     (0060 D1·D3·D4):
//     [held]     enqueue 직후. stdin 미주입 — 취소·수정 100% 가능.
//     [flushed]  게이트 훅(PostToolBatch, flushHeld)에서 held 전체가 병합 단일 배치(batch
//                uuid)로 stdin 주입됨. 취소 불가(un-push API 부재) — cancel 은 held 만 본다.
//     [consumed] CLI 가 배치를 흡수해 user echo 로 되돌린 상태(markConsumed) — drainConsumed
//                가 커밋 대상으로 회수한다. 미소비 잔여(held + 미echo flushed)는 턴을 넘어
//                살아남아 다음 chat:send 이월(D2, drainAll)로 커밋된다.
//
// renderer 는 큐를 간접 관찰한다 — steer.queued/flushed/cancelled 이벤트가 pendingSteer
// 상태를 이끌고, 취소는 held 창 안에서만 성립한다. text-only 이며 DB 영속은 커밋 시점에만.
export class PendingMessageQueue {
  private readonly heldBySession = new Map<string, PendingMessage[]>()
  private readonly flushedBySession = new Map<string, FlushedBatch[]>()

  enqueue(
    sessionId: string,
    text: string,
    now = Date.now(),
    id: string = randomUUID()
  ): PendingMessage {
    const trimmed = text.trim()
    if (trimmed === '') throw new Error('empty steer text')
    const item: PendingMessage = { id, sessionId, text: trimmed, createdAt: now }
    const items = this.heldBySession.get(sessionId) ?? []
    items.push(item)
    this.heldBySession.set(sessionId, items)
    return item
  }

  // held 항목만 취소 가능 — flushed(stdin 주입 완료) 항목은 undefined(거부). 거부 시 호출자는
  // steer.cancelled 를 발신하지 않고, 이후 echo 커밋(steer.flushed)이 버블을 복원한다(D3).
  cancel(sessionId: string, id: string): PendingMessage | undefined {
    const items = this.heldBySession.get(sessionId)
    if (!items) return undefined
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) return undefined
    const [removed] = items.splice(index, 1)
    if (items.length === 0) this.heldBySession.delete(sessionId)
    return removed
  }

  pending(sessionId: string): PendingMessage[] {
    return [...(this.heldBySession.get(sessionId) ?? [])]
  }

  // 게이트 훅(PostToolBatch) 시점 — held 전체를 병합 단일 배치로 넘기고 flushed 로 전이한다.
  // 반환 배치를 stdin 에 1건의 user 메시지(uuid=batch uuid)로 주입한다(D3·D4: 1버블 = 구조 보장).
  flushHeld(sessionId: string, uuid: string = randomUUID()): SteerFlushBatch | undefined {
    const items = this.heldBySession.get(sessionId)
    if (!items || items.length === 0) return undefined
    this.heldBySession.delete(sessionId)
    const batch = mergeBatch(items, uuid)
    const batches = this.flushedBySession.get(sessionId) ?? []
    batches.push({ ...batch, consumed: false })
    this.flushedBySession.set(sessionId, batches)
    return batch
  }

  // user echo 관측 → 해당 배치를 소비로 표시한다. batch uuid 매칭 1차, echo 의 uuid 미보존
  // 대비 병합 텍스트 완전일치 폴백(FIFO — 가장 오래된 미소비 배치). 매칭 실패(초기 프롬프트
  // echo 등)는 undefined — 호출자는 무시한다.
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

  // 소비 확정 배치만 병합 drain — echo 배치가 끝난 지점(첫 비-echo 이벤트/턴 종료)에서 커밋에
  // 쓴다. 복수 배치가 함께 회수되는 경우는 연속 echo(같은 drain 지점 소비)뿐이므로 병합이 옳다
  // (D4: 어시스턴트 응답이 낀 경계만 분리). 미소비 배치는 남긴다(D2).
  drainConsumed(sessionId: string): SteerFlush | undefined {
    const batches = this.flushedBySession.get(sessionId)
    if (!batches) return undefined
    const consumed = batches.filter((batch) => batch.consumed)
    if (consumed.length === 0) return undefined
    const remaining = batches.filter((batch) => !batch.consumed)
    if (remaining.length === 0) this.flushedBySession.delete(sessionId)
    else this.flushedBySession.set(sessionId, remaining)
    return {
      ids: consumed.flatMap((batch) => batch.ids),
      text: consumed.map((batch) => batch.text).join('\n\n'),
      createdAt: consumed[0].createdAt
    }
  }

  // 전량 drain — idle 세션의 다음 chat:send 이월(carryover, D2) 전용. 미소비 flushed 배치
  // (모델이 못 본 stdin 사본 — 턴-스코프 서브프로세스 종료로 CLI 큐가 소멸)와 held 전부를
  // createdAt 순으로 병합해 비운다. 소비 확정분은 이미 drainConsumed 로 커밋됐어야 하나,
  // 남아 있다면(경계 유실) 중복 전달을 막기 위해 제외하고 버린다.
  drainAll(sessionId: string): SteerFlush | undefined {
    const held = this.heldBySession.get(sessionId) ?? []
    const unconsumed = (this.flushedBySession.get(sessionId) ?? []).filter(
      (batch) => !batch.consumed
    )
    this.heldBySession.delete(sessionId)
    this.flushedBySession.delete(sessionId)
    const parts: { ids: string[]; text: string; createdAt: number }[] = [
      ...unconsumed,
      ...held.map((item) => ({ ids: [item.id], text: item.text, createdAt: item.createdAt }))
    ].sort((a, b) => a.createdAt - b.createdAt)
    if (parts.length === 0) return undefined
    return {
      ids: parts.flatMap((part) => part.ids),
      text: parts.map((part) => part.text).join('\n\n'),
      createdAt: parts[0].createdAt
    }
  }
}
