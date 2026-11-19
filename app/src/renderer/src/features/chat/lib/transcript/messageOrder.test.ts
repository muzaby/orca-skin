import { describe, expect, it, vi } from 'vitest'
import type { AppMessagePart } from '../../../../../../shared/ipc'
import type { Message } from '../../reducer/chatReducer'
import { newTranscriptChanges, recordChange } from './changeLog'
import { messageOrderFor } from './messageOrder'

function tool(toolRunId: string): AppMessagePart {
  return { type: 'tool_call', toolRunId, toolName: 'Read', args: {} }
}

function message(id: string, parts: AppMessagePart[] = []): Message {
  return { id, role: 'assistant', createdAt: 0, parts }
}

describe('transcript order and part ownership', () => {
  it('updates suffix contributions without reading unrelated messages and keeps first ownership', () => {
    const reads = vi.fn()
    const other = message('other', [tool('duplicate')])
    const history: Message[] = Array.from({ length: 10_000 }, (_, index) => ({
      id: String(index),
      role: 'assistant',
      createdAt: 0,
      get parts() {
        reads(index)
        return []
      }
    }))
    history[1] = message('target', [tool('duplicate'), tool('old')])
    history[2] = other
    const before = { messages: history, transcriptChanges: newTranscriptChanges() }
    expect(messageOrderFor(before, true).toolCallOwner('duplicate')).toBe('target')
    reads.mockClear()

    const messages = history.slice()
    messages[1] = message('target', [tool('duplicate'), tool('new')])
    const transcriptChanges = recordChange(before.transcriptChanges, {
      kind: 'replace',
      id: 'target',
      partsFrom: 1
    })
    const order = messageOrderFor({ messages, transcriptChanges }, true)
    expect(order.toolCallOwner('old')).toBeUndefined()
    expect(order.toolCallOwner('new')).toBe('target')
    expect(order.toolCallOwner('duplicate')).toBe('target')
    expect(order.messagePosition('target')).toBe(1)
    expect(reads).not.toHaveBeenCalled()
  })

  it('applies prepends, deletion and readdition in order while contents catch up independently', () => {
    const before = {
      messages: [message('a', [tool('old')]), message('b')],
      transcriptChanges: newTranscriptChanges()
    }
    expect(messageOrderFor(before, true).toolCallOwner('old')).toBe('a')
    let changes = recordChange(before.transcriptChanges, { kind: 'prepend', ids: ['p', 'q'] })
    changes = recordChange(changes, { kind: 'remove', ids: ['a'] })
    changes = recordChange(changes, { kind: 'append', ids: ['a'] })
    const order = messageOrderFor(
      {
        messages: [message('p'), message('q'), before.messages[1], message('a', [tool('new')])],
        transcriptChanges: changes
      },
      true
    )
    expect(['p', 'q', 'b', 'a'].map((id) => order.messagePosition(id))).toEqual([0, 1, 2, 3])
    expect(order.toolCallOwner('old')).toBeUndefined()
    expect(order.toolCallOwner('new')).toBe('a')
  })
})
