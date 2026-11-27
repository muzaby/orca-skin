import { expect, it } from 'vitest'
import type { Message } from '../../../reducer/chatReducer'
import { createOpenCodeBlockModel } from './openCodeBlocks'
import { newTranscriptChanges, recordChange } from '../../../lib/transcript/changeLog'

it('keeps earlier blocks stable by reference as only live presence changes', () => {
  const messages: Message[] = [
    { id: 'u:1', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'first' }] },
    {
      id: 'a:1',
      role: 'assistant',
      createdAt: 2,
      parts: [{ type: 'text', text: 'committed answer' }]
    },
    { id: 'u:2', role: 'user', createdAt: 3, parts: [{ type: 'text', text: 'second' }] }
  ]
  const model = createOpenCodeBlockModel()
  const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
  const snap1 = model.advance(
    { messages, transcriptChanges: changes },
    { pending: true, liveText: false, liveReasoning: false, liveTextKey: undefined }
  )
  const snap2 = model.advance(
    { messages, transcriptChanges: changes },
    { pending: true, liveText: true, liveReasoning: false, liveTextKey: 'a:2' }
  )
  // All prior committed blocks keep the exact same object reference
  for (let i = 0; i < snap1.count; i++) {
    expect(snap2.blockAt(i)).toBe(snap1.blockAt(i))
  }
  expect(snap2.count).toBe(snap1.count + 1)
  const last = snap2.blockAt(snap2.count - 1)
  expect(last.kind === 'segment' && last.live).toBe(true)
})
