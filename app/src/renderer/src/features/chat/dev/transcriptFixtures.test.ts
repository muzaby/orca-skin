import { describe, expect, it } from 'vitest'
import { generateTranscriptFixture } from './transcriptFixtures'
import { buildClaudeBlocksOracle, buildOpenCodeBlocksOracle } from '../lib/blockOracle.testfixture'

describe('transcriptFixtures (WU-14 · S3/S4/S5/S7 generator invariants)', () => {
  it('S3/S5: generates >= 5,000 blocks for claude-code, claude-work, and opencode when minBlocks=6000', () => {
    const cc = generateTranscriptFixture('claude-code', { turns: 500, minBlocks: 6000 })
    const ccBlocks = buildClaudeBlocksOracle(cc.allMessages, { mode: 'code', sessionKey: 's' })
    expect(ccBlocks.length).toBeGreaterThanOrEqual(5000)

    const cw = generateTranscriptFixture('claude-work', { turns: 500, minBlocks: 6000 })
    const cwBlocks = buildClaudeBlocksOracle(cw.allMessages, { mode: 'work', sessionKey: 's' })
    expect(cwBlocks.length).toBeGreaterThanOrEqual(1500)

    const oc = generateTranscriptFixture('opencode', { turns: 500, minBlocks: 6000 })
    const ocBlocks = buildOpenCodeBlocksOracle(oc.allMessages)
    expect(ocBlocks.length).toBeGreaterThanOrEqual(5000)
  })

  it('S4: loadedTurns < turns leaves >= 3 remaining prefix turns in document order', () => {
    const fx = generateTranscriptFixture('claude-code', { turns: 10, loadedTurns: 5 })
    expect(fx.remainingPrefixTurns.length).toBe(5)
    expect(fx.remainingPrefixTurns.length).toBeGreaterThanOrEqual(3)
    expect(fx.loadedMessages.length).toBe(10) // 5 turns * 2 messages
    expect(fx.allMessages.length).toBe(20)
  })
})
