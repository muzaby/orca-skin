import { randomUUID } from 'node:crypto'

export interface SteerQueueItem {
  id: string
  sessionId: string
  text: string
  createdAt: number
  // CLI 가 이 항목을 흡수(user echo 관측)했는가 — 커밋(flush) 대상 판정 플래그(0060 D1).
  consumed?: boolean
}

export interface SteerFlush {
  ids: string[]
  text: string
  createdAt: number
}

function toFlush(items: SteerQueueItem[]): SteerFlush {
  return {
    ids: items.map((item) => item.id),
    text: items.map((item) => item.text).join('\n\n'),
    createdAt: items[0].createdAt
  }
}

// 진행 중 세션에 붙는 피드백 staging 버퍼. text-only 이며, DB 영속은 flush 시점에만 수행한다.
// 소비(consumed) = CLI 가 stdin 주입분을 흡수해 user echo 로 되돌린 항목 — flush 는 소비분만
// 대상으로 한다(0060 D1). 미소비 잔여는 턴을 넘어 살아남아 다음 chat:send 에서 이월(D2).
export class SteerQueue {
  private readonly bySession = new Map<string, SteerQueueItem[]>()

  enqueue(
    sessionId: string,
    text: string,
    now = Date.now(),
    id: string = randomUUID()
  ): SteerQueueItem {
    const trimmed = text.trim()
    if (trimmed === '') throw new Error('empty steer text')
    const item: SteerQueueItem = { id, sessionId, text: trimmed, createdAt: now }
    const items = this.bySession.get(sessionId) ?? []
    items.push(item)
    this.bySession.set(sessionId, items)
    return item
  }

  cancel(sessionId: string, id: string): SteerQueueItem | undefined {
    const items = this.bySession.get(sessionId)
    if (!items) return undefined
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) return undefined
    const [removed] = items.splice(index, 1)
    if (items.length === 0) this.bySession.delete(sessionId)
    return removed
  }

  pending(sessionId: string): SteerQueueItem[] {
    return [...(this.bySession.get(sessionId) ?? [])]
  }

  // user echo 관측 → 해당 항목을 소비로 표시한다. uuid(=item id) 매칭 1차, 미보존 대비
  // text 완전일치 폴백(FIFO — 가장 오래된 미소비 항목). 매칭 실패(초기 프롬프트 echo 등)는
  // undefined — 호출자는 무시한다.
  markConsumed(
    sessionId: string,
    match: { uuid?: string; text?: string }
  ): SteerQueueItem | undefined {
    const items = this.bySession.get(sessionId)
    if (!items) return undefined
    const textMatch = match.text?.trim()
    const item =
      (match.uuid !== undefined
        ? items.find((it) => !it.consumed && it.id === match.uuid)
        : undefined) ??
      (textMatch !== undefined
        ? items.find((it) => !it.consumed && it.text === textMatch)
        : undefined)
    if (!item) return undefined
    item.consumed = true
    return item
  }

  hasConsumed(sessionId: string): boolean {
    return (this.bySession.get(sessionId) ?? []).some((item) => item.consumed === true)
  }

  // 소비 확정분만 병합 drain — echo 배치가 끝난 지점(첫 비-echo 이벤트/턴 종료)에서 커밋에 쓴다.
  // 미소비 항목은 남긴다(모델이 아직 못 본 텍스트를 committed 로 굳히지 않는다 — D2).
  drainConsumed(sessionId: string): SteerFlush | undefined {
    const items = this.bySession.get(sessionId)
    if (!items) return undefined
    const consumed = items.filter((item) => item.consumed === true)
    if (consumed.length === 0) return undefined
    const remaining = items.filter((item) => item.consumed !== true)
    if (remaining.length === 0) this.bySession.delete(sessionId)
    else this.bySession.set(sessionId, remaining)
    return toFlush(consumed)
  }

  // 전량 drain — idle 세션의 다음 chat:send 이월(carryover, D2) 전용. 소비 여부와 무관하게
  // 남은 항목 전부를 병합해 비운다(이월분은 새 턴 프롬프트에 실려 모델에 전달된다).
  drainForFlush(sessionId: string): SteerFlush | undefined {
    const items = this.bySession.get(sessionId)
    if (!items || items.length === 0) return undefined
    this.bySession.delete(sessionId)
    return toFlush(items)
  }
}
