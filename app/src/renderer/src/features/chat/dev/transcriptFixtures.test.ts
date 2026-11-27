import { describe, expect, it } from 'vitest'
import { computeDiagnostics } from '../../../shared/compute/diagnostics'
import { generateTranscriptFixture, createDiagnosticDevApi } from './transcriptFixtures'
import { createClaudeBlockModel } from '../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../harnesses/opencode/transcript/openCodeBlocks'
import { newTranscriptChanges } from '../lib/transcript/changeLog'

describe('transcriptFixtures (WU-14 · S3/S4/S5/S7 generator invariants)', () => {
  it.each(['claude-code', 'claude-work', 'opencode'] as const)(
    '%s builds 5,000 blocks in one answer and loads 6,000 selectable blocks for copy',
    (kind) => {
      for (const scenario of ['answer-5000', 'long'] as const) {
        const fixture = generateTranscriptFixture(
          kind,
          { turns: 1, minBlocks: scenario === 'long' ? 6000 : 0 },
          scenario
        )
        const model =
          kind === 'opencode'
            ? createOpenCodeBlockModel()
            : createClaudeBlockModel({
                mode: kind === 'claude-work' ? 'work' : 'code',
                sessionKey: 's'
              })
        const snapshot = model.advance({
          messages: fixture.loadedMessages,
          transcriptChanges: newTranscriptChanges()
        })
        if (scenario === 'answer-5000') {
          expect(fixture.loadedMessages).toHaveLength(2)
          expect(snapshot.count).toBeGreaterThanOrEqual(5000)
        } else {
          const selectable = Array.from({ length: snapshot.count }, (_, index) =>
            snapshot.blockAt(index)
          ).filter((block) => ['segment', 'user', 'activity'].includes(block.kind))
          expect(selectable.length).toBeGreaterThanOrEqual(6000)
          expect(new Set(selectable.map((block) => block.key)).size).toBe(selectable.length)
        }
      }
    }
  )

  it('S4: loadedTurns < turns leaves >= 3 remaining prefix turns in document order', () => {
    const fx = generateTranscriptFixture('claude-code', { turns: 10, loadedTurns: 5 })
    expect(fx.remainingPrefixTurns.length).toBe(5)
    expect(fx.remainingPrefixTurns.length).toBeGreaterThanOrEqual(3)
    expect(fx.loadedMessages.length).toBe(10) // 5 turns * 2 messages
    expect(fx.allMessages.length).toBe(20)
  })
})

it('fx2 records the first paint per request key within each timing session', () => {
  const api = createDiagnosticDevApi()
  api.startComputeTimings()
  const sink = computeDiagnostics()!
  sink.paint('a', 5)
  sink.paint('b', 7)
  sink.paint('a', 12)
  expect(api.finishComputeTimings().paints).toEqual([
    { key: 'a', at: 5 },
    { key: 'b', at: 7 }
  ])
  expect(computeDiagnostics()).toBeUndefined()
  api.startComputeTimings()
  expect(api.finishComputeTimings().paints).toEqual([])
})
