interface ToolPartValue<T> {
  readonly toolId: string
  readonly messageId: string
  readonly partIndex: number
  readonly value: T
}

/** A replay keeps its transcript position even when an older part is replaced later. */
export class OrderedToolParts<T> {
  private readonly byMessage = new Map<string, ToolPartValue<T>[]>()
  private readonly byTool = new Map<string, ToolPartValue<T>[]>()

  clear(): void {
    this.byMessage.clear()
    this.byTool.clear()
  }

  latest(id: string): T | undefined {
    return this.byTool.get(id)?.at(-1)?.value
  }

  firstOwner(id: string): string | undefined {
    return this.byTool.get(id)?.[0]?.messageId
  }

  retract(messageId: string, from: number, affected: Set<string>): void {
    const slots = this.byMessage.get(messageId)
    if (!slots) return
    // Parts arrive in increasing index order; replacing a suffix leaves its prefix untouched.
    while (slots.length && slots[slots.length - 1].partIndex >= from) {
      const slot = slots.pop()!
      const stack = this.byTool.get(slot.toolId)!
      stack.splice(stack.indexOf(slot), 1)
      if (stack.length === 0) this.byTool.delete(slot.toolId)
      affected.add(slot.toolId)
    }
    if (slots.length === 0) this.byMessage.delete(messageId)
  }

  /** Add parts in ascending index order after retracting the message suffix being replaced. */
  put(
    toolId: string,
    messageId: string,
    partIndex: number,
    value: T,
    order?: { messagePosition(id: string): number }
  ): void {
    const slots = this.byMessage.get(messageId) ?? []
    const slot = { toolId, messageId, partIndex, value }
    slots.push(slot)
    this.byMessage.set(messageId, slots)
    const stack = this.byTool.get(toolId) ?? []
    const position = order && stack.length ? order.messagePosition(messageId) : -1
    const later =
      order && position >= 0
        ? stack.findIndex((candidate) =>
            candidate.messageId === messageId
              ? candidate.partIndex > partIndex
              : order.messagePosition(candidate.messageId) > position
          )
        : -1
    if (later < 0) stack.push(slot)
    else stack.splice(later, 0, slot)
    this.byTool.set(toolId, stack)
  }
}
