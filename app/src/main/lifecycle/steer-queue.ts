import { randomUUID } from 'node:crypto'

export interface SteerQueueItem {
  id: string
  sessionId: string
  text: string
  createdAt: number
}

export interface SteerFlush {
  ids: string[]
  text: string
  createdAt: number
}

// 진행 중 세션에 붙는 피드백 staging 버퍼. text-only 이며, DB 영속은 flush 시점에만 수행한다.
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

  drainForFlush(sessionId: string): SteerFlush | undefined {
    const items = this.bySession.get(sessionId)
    if (!items || items.length === 0) return undefined
    this.bySession.delete(sessionId)
    return {
      ids: items.map((item) => item.id),
      text: items.map((item) => item.text).join('\n\n'),
      createdAt: items[0].createdAt
    }
  }
}
