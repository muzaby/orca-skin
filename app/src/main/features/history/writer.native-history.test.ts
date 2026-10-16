import { describe, expect, it, vi } from 'vitest'
import type { DbQueries } from '../../infra/db'
import type { TurnContext } from '../../contracts/turn'
vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))
import { HistoryWriter } from './writer'

describe('native ID persistence', () => {
  it('binds native user and multiple assistant records to their local rows, excluding child IDs', () => {
    let id = 0
    const bind = vi.fn()
    const db = {
      nativeHistory: { bind },
      appendMessage: () => ++id,
      appendPart: vi.fn(),
      updateSessionPreview: vi.fn(),
      updateSessionProviderKey: vi.fn(),
      updateMessageContent: vi.fn(),
      markMessageComplete: vi.fn()
    } as unknown as DbQueries
    const writer = new HistoryWriter(db, () => false)
    const turn = {
      dbSessionId: 's',
      currentAssistantMessageId: null,
      assistantText: '',
      providerKey: null
    } as unknown as TurnContext
    writer.commitUserMessage(turn, { text: 'hello', createdAt: 1, nativeMessageId: 'native-u' })
    writer.persist(turn, {
      type: 'message.reasoning',
      sessionId: 's',
      text: 'thinking',
      nativeMessageId: 'native-a1'
    })
    writer.persist(turn, {
      type: 'message.completed',
      sessionId: 's',
      message: { text: 'reply' },
      nativeMessageId: 'native-a2'
    })
    writer.persist(turn, {
      type: 'message.completed',
      sessionId: 's',
      parentToolRunId: 'parent',
      message: { text: 'child' },
      nativeMessageId: 'child-a'
    })
    expect(bind.mock.calls).toEqual([
      [1, 'native-u'],
      [2, 'native-a1'],
      [2, 'native-a2']
    ])
  })
})
