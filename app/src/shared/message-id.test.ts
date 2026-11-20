import { describe, expect, it, vi } from 'vitest'
import {
  archivedMessageId,
  assistantMessageId,
  childMessageId,
  localRowMessageId,
  nativeOnlyMessageId,
  orphanMessageId,
  receivedMessageId,
  rendererMessageId,
  userMessageId
} from './message-id'

describe('transcript message identity', () => {
  it('preserves the namespace and escapes each untrusted component exactly once', () => {
    const raw = '42:/,#% 한'
    const escaped = '42%3A%2F%2C%23%25%20%ED%95%9C'
    expect(assistantMessageId(raw)).toBe(`a:${escaped}`)
    expect(userMessageId([raw, raw])).toBe(`u:${escaped},${escaped}`)
    expect(nativeOnlyMessageId(raw)).toBe(`n:${escaped}`)
    expect(rendererMessageId(raw)).toBe(`r:${escaped}`)
    expect(childMessageId(raw)).toBe(`c:${escaped}`)
    expect(localRowMessageId(42)).toBe('m:42')
    expect(archivedMessageId(42)).toBe('x:42')
    expect(orphanMessageId(`a:${escaped}`)).toBe(`a:${escaped}#o`)
  })

  it('prefers the received UUID, then native ID, and allocates only on the fallback path', () => {
    const newId = vi.fn(() => 'same:id')
    expect(receivedMessageId('same:id', 'unused', newId)).toBe('i:same%3Aid')
    expect(receivedMessageId(undefined, 'same:id', newId)).toBe('i:n:same%3Aid')
    expect(newId).not.toHaveBeenCalled()
    expect(receivedMessageId(undefined, undefined, newId)).toBe('i:g:same%3Aid')
    expect(newId).toHaveBeenCalledTimes(1)
  })
})
