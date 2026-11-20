import { expect, it } from 'vitest'
import { newTranscriptChanges, recordChange } from '../../../lib/transcript/changeLog'
import type { Message } from '../../../reducer/chatReducer'
import { createClaudeBlockModel } from './claudeBlocks'

it('keeps the first source part as the Claude Code text key and separates reasoning keys', () => {
  const message: Message = {
    id: 'a:owner',
    role: 'assistant',
    createdAt: 1,
    parts: [
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
      { type: 'reasoning', text: 'third' }
    ]
  }
  const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's' })
  const snapshot = model.advance({
    messages: [message],
    transcriptChanges: recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
  })
  const segments = Array.from({ length: snapshot.count }, (_, index) =>
    snapshot.blockAt(index)
  ).filter((block) => block.kind === 'segment')
  expect(segments.map(({ key, partKeys }) => [key, partKeys])).toEqual([
    ['a:owner:text:0', ['a:owner:text:0', 'a:owner:text:1']],
    ['a:owner:reasoning:0', ['a:owner:reasoning:0']]
  ])
})
