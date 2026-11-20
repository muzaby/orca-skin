import { describe, expect, it } from 'vitest'
import { beginCopyTiming } from './transcriptViewportDiagnostics'
import { createDiagnosticDevApi, generateTranscriptFixture } from './transcriptFixtures'
import { createClaudeBlockModel } from '../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../harnesses/opencode/transcript/openCodeBlocks'
import { newTranscriptChanges } from '../lib/transcript/changeLog'

describe('transcriptFixtures (WU-14 · S3/S4/S5/S7 generator invariants)', () => {
  it('diagnostics retain timings only for the most recent copy', () => {
    const api = createDiagnosticDevApi()
    const previous = beginCopyTiming()
    previous({ kind: 'handler', durationMs: 3, blockCount: 100 })
    const saved = api.copyTimings()
    const current = beginCopyTiming()
    previous({ kind: 'chunk', durationMs: 60, blockCount: 2000 })
    current({ kind: 'handler', durationMs: 5, blockCount: 300 })
    expect(api.copyTimings()).toEqual([{ kind: 'handler', durationMs: 5, blockCount: 300 }])
    expect(saved).toEqual([{ kind: 'handler', durationMs: 3, blockCount: 100 }])
  })

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
