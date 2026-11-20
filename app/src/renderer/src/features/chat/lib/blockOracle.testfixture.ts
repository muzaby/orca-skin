/**
 * Full-build oracle for transcript block models (EP-8 · property tests).
 * Builds a brand-new block snapshot from scratch for any message list + options
 * so incremental `advance()` results can be compared block-for-block.
 */
import type { Message } from '../reducer/chatReducer'
import { newTranscriptChanges, recordChange } from './transcript/changeLog'
import {
  createClaudeBlockModel,
  type ClaudeAdvanceOptions,
  type ClaudeBlock
} from '../harnesses/claude/transcript/claudeBlocks'
import {
  createOpenCodeBlockModel,
  type OpenCodeAdvanceOptions,
  type OpenCodeBlock
} from '../harnesses/opencode/transcript/openCodeBlocks'

export function buildClaudeBlocksOracle(
  messages: readonly Message[],
  config: { mode: 'code' | 'work'; sessionKey: string },
  options: ClaudeAdvanceOptions = {}
): ClaudeBlock[] {
  const model = createClaudeBlockModel(config)
  const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
  const snap = model.advance({ messages, transcriptChanges: changes }, options)
  const out: ClaudeBlock[] = []
  for (let i = 0; i < snap.count; i++) out.push(snap.blockAt(i))
  return out
}

export function buildOpenCodeBlocksOracle(
  messages: readonly Message[],
  options: OpenCodeAdvanceOptions = {}
): OpenCodeBlock[] {
  const model = createOpenCodeBlockModel()
  const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
  const snap = model.advance({ messages, transcriptChanges: changes }, options)
  const out: OpenCodeBlock[] = []
  for (let i = 0; i < snap.count; i++) out.push(snap.blockAt(i))
  return out
}

export function snapshotToArray<T>(snap: { count: number; blockAt(i: number): T }): T[] {
  const out: T[] = []
  for (let i = 0; i < snap.count; i++) out.push(snap.blockAt(i))
  return out
}
