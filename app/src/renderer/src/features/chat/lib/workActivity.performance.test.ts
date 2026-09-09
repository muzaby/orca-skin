import { performance } from 'node:perf_hooks'
import { expect, it } from 'vitest'
import { createWorkProjector } from './workActivity'
import { createWorkToolResultSelector } from './workToolResults'
import { groupExchanges } from './turns'
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
      role: 'assistant',
      createdAt: 1,
      get parts() {
        completedPartReads++
        return parts
      }
    }
  }
  const history: Message[] = Array.from({ length: 100 }, (_, index): Message[] => [
    { role: 'user', createdAt: index, parts: [{ type: 'text', text: `request-${index}` }] },
    completed(`past-${index}`)
  ]).flat()
  history.push({ role: 'user', createdAt: 101, parts: [{ type: 'text', text: 'current request' }] })
  history.push(...Array.from({ length: 100 }, (_, index) => completed(`current-${index}`)))
  const selectResults = createWorkToolResultSelector()
  const projectCurrent = createWorkProjector()
  const durations: number[] = []
  function update(index: number): void {
    const messages: Message[] = [
      ...history,
      {
        role: 'assistant',
        createdAt: 102,
        parts: [
          { type: 'response_boundary', boundary: { phase: 'begin', id: 'live' } },
          { type: 'text', text: `delta-${index}` }
        ]
      }
    ]
    const start = performance.now()
    const exchanges = groupExchanges(messages)
    const results = selectResults(exchanges)
    const tail = exchanges.at(-1)!
    const assistant = tail.turns.find((turn) => turn.role === 'assistant')!
    projectCurrent(assistant.messages, results.get(tail.startIndex))
    durations.push(performance.now() - start)
  }
  update(-1)
  const initialReads = completedPartReads
  for (let index = 0; index < 100; index++) update(index)
  expect(completedPartReads - initialReads).toBe(0)
  const sorted = durations.slice(1).sort((a, b) => a - b)
  process.stdout.write(
    JSON.stringify({
      scope: 'Work selectors only; not React commit time',
      previousExchanges: 100,
      currentCompletedMessages: 100,
      updates: 100,
      repeatedCompletedPartReads: completedPartReads - initialReads,
      medianMs: sorted[50],
      p95Ms: sorted[95]
    }) + '\n'
  )
})
