import { scaleMs } from '../../../../../../../scripts/test-time.mjs'
import { describe, expect, it } from 'vitest'
import {
  createClaudeBlockModel,
  type ClaudeBlock
} from '../../harnesses/claude/transcript/claudeBlocks'
import {
  createOpenCodeBlockModel,
  type OpenCodeBlock
} from '../../harnesses/opencode/transcript/openCodeBlocks'
import type { Message } from '../../reducer/chatReducer'
import { snapshotToArray } from '../blockOracle.testfixture'
import { newTranscriptChanges, recordChange, type TranscriptChange } from './changeLog'

function randomFrom(seed: number): (bound: number) => number {
  return (bound) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return Math.floor((seed / 0x100000000) * bound)
  }
}

describe.each(['code', 'work', 'opencode'] as const)('VP-16 %s', (mode) => {
  it(
    'matches every full block after 500 sequences of 40 edits and delayed consumption',
    () => {
      const config = {
        mode: mode === 'work' ? ('work' as const) : ('code' as const),
        sessionKey: 'property'
      }
      const model = (): ReturnType<
        typeof createOpenCodeBlockModel | typeof createClaudeBlockModel
      > => (mode === 'opencode' ? createOpenCodeBlockModel() : createClaudeBlockModel(config))
      const options = { reserve: true, forkable: true, showAutomaticFeeds: false }
      const intervals = new Set<number>()
      const edits = new Set<string>()
      for (let seed = 1; seed <= 500; seed++) {
        const random = randomFrom(seed)
        let serial = 0
        function message(role: Message['role']): Message {
          const id = 'msg-' + serial++
          const text = { type: 'text' as const, text: id }
          const parts: Message['parts'] =
            role === 'user' || random(3) === 0
              ? [text]
              : [
                  {
                    type: 'tool_call',
                    toolName: 'Read',
                    toolRunId: 'call-' + id,
                    args: { file_path: id }
                  },
                  text
                ]
          if (mode === 'work' && role === 'assistant' && serial % 3 === 0)
            return {
              id,
              role,
              createdAt: serial,
              parts: [
                { type: 'response_boundary', boundary: { phase: 'begin', id } },
                ...parts,
                { type: 'response_boundary', boundary: { phase: 'end', id, outcome: 'ended' } }
              ]
            }
          return { id, role, createdAt: serial, parts }
        }
        const eager = model()
        const delayed = model()
        let messages = [message('user'), message('assistant')]
        let transcriptChanges = newTranscriptChanges()
        const state = (): { messages: Message[]; transcriptChanges: typeof transcriptChanges } => ({
          messages,
          transcriptChanges
        })
        // A full projection retains representative keys from its own last published
        // snapshot (D-070). Each independent consumer therefore needs its own oracle.
        function fullBuilder(): () => (ClaudeBlock | OpenCodeBlock)[] {
          const reference = model()
          let changes = newTranscriptChanges()
          return () => {
            changes = recordChange(changes, { kind: 'reset', complete: true })
            return snapshotToArray<ClaudeBlock | OpenCodeBlock>(
              reference.advance({ messages, transcriptChanges: changes }, options)
            )
          }
        }
        const eagerFull = fullBuilder()
        const delayedFull = fullBuilder()
        eagerFull()
        delayedFull()
        eager.advance(state(), options)
        delayed.advance(state(), options)
        let due = 0
        function schedule(): void {
          const interval = 1 + random(70)
          intervals.add(interval)
          due = transcriptChanges.revision + interval
        }
        schedule()
        function record(change: TranscriptChange): void {
          edits.add(change.kind)
          transcriptChanges = recordChange(transcriptChanges, change)
        }
        for (let step = 0; step < 40; step++) {
          // Multiple recorded edits in a render can cross the 64-record retention boundary.
          const changes = 1 + random(4)
          for (let i = 0; i < changes; i++) {
            const op = random(9)
            if (op < 3 || messages.length === 0) {
              const added = message(random(3) === 0 ? 'user' : 'assistant')
              messages = [...messages, added]
              record({ kind: 'append', ids: [added.id] })
            } else if (op < 5) {
              const at = random(messages.length)
              const old = messages[at]
              const from = random(old.parts.length + 1)
              const updated: Message = {
                ...old,
                parts: [...old.parts.slice(0, from), { type: 'text', text: String(step) + '/' + i }]
              }
              messages = messages.map((m) => (m === old ? updated : m))
              record({ kind: 'replace', id: old.id, partsFrom: from })
            } else if (op < 7) {
              const old = messages[random(messages.length)]
              messages = messages.filter((m) => m !== old)
              record({ kind: 'remove', ids: [old.id] })
              if (op === 6 && step % 3 === 0) {
                messages = [...messages, old]
                record({ kind: 'append', ids: [old.id] })
              }
            } else if (op === 7) {
              const prefix = [message('user'), message('assistant')]
              const preservesTurn = messages[0]?.role === 'user'
              messages = [...prefix, ...messages]
              record(
                preservesTurn
                  ? { kind: 'prepend', ids: prefix.map((m) => m.id) }
                  : { kind: 'reset', complete: false }
              )
            } else {
              messages = [message('user'), message('assistant')]
              record({ kind: 'reset', complete: true })
            }
          }
          const context =
            'seed ' + seed + ', step ' + step + ', revision ' + transcriptChanges.revision
          expect(
            snapshotToArray<ClaudeBlock | OpenCodeBlock>(eager.advance(state(), options)),
            context
          ).toEqual(eagerFull())
          if (transcriptChanges.revision >= due || step === 39) {
            expect(
              snapshotToArray<ClaudeBlock | OpenCodeBlock>(delayed.advance(state(), options)),
              'delayed ' + context
            ).toEqual(delayedFull())
            schedule()
          }
        }
      }
      expect(edits.size).toBe(5)
      expect(intervals.size).toBe(70)
    },
    scaleMs(600_000)
  )
})
