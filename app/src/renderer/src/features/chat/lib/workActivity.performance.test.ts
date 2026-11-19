import { performance } from 'node:perf_hooks'
import { expect, it } from 'vitest'
import { createClaudeBlockModel } from '../harnesses/claude/transcript/claudeBlocks'
import { newTranscriptChanges, recordChange } from '../lib/transcript/changeLog'
import type { Message } from '../reducer/chatReducer'

it('measures 100 old exchanges plus 100 completed current messages over 100 tail updates', () => {
  let completedPartReads = 0
  function completed(id: string): Message {
    const parts: Message['parts'] = [
      { type: 'response_boundary', boundary: { phase: 'begin', id } },
      { type: 'tool_call', toolRunId: id, toolName: 'Read', args: {} },
      { type: 'tool_result', toolRunId: id, result: 'done', isError: false },
      { type: 'text', text: `result-${id}` },
      { type: 'response_boundary', boundary: { phase: 'end', id, outcome: 'ended' } }
    ]
    return {
      id: `a:${id}`,
      role: 'assistant',
      createdAt: 1,
      get parts() {
        completedPartReads++
        return parts
      }
    }
  }
  const history: Message[] = Array.from({ length: 100 }, (_, index): Message[] => [
    {
      id: `u:past-${index}`,
      role: 'user',
      createdAt: index,
      parts: [{ type: 'text', text: `request-${index}` }]
    },
    completed(`past-${index}`)
  ]).flat()
  history.push({
    id: 'u:current',
    role: 'user',
    createdAt: 101,
    parts: [{ type: 'text', text: 'current request' }]
  })
  history.push(...Array.from({ length: 100 }, (_, index) => completed(`current-${index}`)))

  const model = createClaudeBlockModel({ mode: 'work', sessionKey: 'perf' })
  let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
  const durations: number[] = []
  let prevMessages: Message[] = history

  function update(index: number): void {
    const liveMsg: Message = {
      id: 'a:live',
      role: 'assistant',
      createdAt: 102,
      parts: [
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'live' } },
        { type: 'text', text: `delta-${index}` }
      ]
    }
    const messages: Message[] = [...history, liveMsg]
    if (index === -1) {
      changes = recordChange(changes, { kind: 'append', ids: ['a:live'] })
    } else {
      changes = recordChange(changes, { kind: 'replace', id: 'a:live', partsFrom: 0 })
    }
    prevMessages = messages
    const start = performance.now()
    model.advance({ messages: prevMessages, transcriptChanges: changes }, { inflight: true })
    durations.push(performance.now() - start)
  }

  model.advance({ messages: history, transcriptChanges: changes }, { inflight: false })
  update(-1)
  const initialReads = completedPartReads
  for (let index = 0; index < 100; index++) update(index)
  expect(completedPartReads - initialReads).toBe(0)
  const sorted = durations.slice(1).sort((a, b) => a - b)
  process.stdout.write(
    JSON.stringify({
      scope: 'Work incremental block model only; not React commit time',
      previousExchanges: 100,
      currentCompletedMessages: 100,
      updates: 100,
      repeatedCompletedPartReads: completedPartReads - initialReads,
      medianMs: sorted[50],
      p95Ms: sorted[95]
    }) + '\n'
  )
})
