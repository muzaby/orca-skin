import { describe, expect, it } from 'vitest'
import type { AppMessagePart } from '../../../../../../../shared/ipc'
import type { Message } from '../../../reducer/chatReducer'
import {
  newTranscriptChanges,
  recordChange,
  type TranscriptChanges
} from '../../../lib/transcript/changeLog'
import { liveBlockKey, turnMetaKey, userBlockKey } from '../../../lib/transcript/blockKeys'
import { buildClaudeBlocksOracle, snapshotToArray } from '../../../lib/blockOracle.testfixture'
import { createClaudeBlockModel } from './claudeBlocks'

function userMsg(id: string, text: string, createdAt = 1000): Message {
  return { id, role: 'user', createdAt, parts: [{ type: 'text', text }] }
}

function assistantMsg(id: string, parts: AppMessagePart[], createdAt = 2000): Message {
  return { id, role: 'assistant', createdAt, parts }
}

describe('claudeBlocks (EP-8 · z1~z9)', () => {
  it('z1/z5: append adds only new blocks and updates boundary meta/gap without recreating unrelated blocks', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
    let messages: Message[] = [
      userMsg('u:1', 'hello'),
      assistantMsg('a:1', [{ type: 'text', text: 'world' }])
    ]
    let changes: TranscriptChanges = recordChange(newTranscriptChanges(), {
      kind: 'reset',
      complete: true
    })
    const snap1 = model.advance(
      { messages, transcriptChanges: changes },
      { forkable: true, reserve: true }
    )
    const b0Before = snap1.blockAt(0)
    const b1Before = snap1.blockAt(1)

    // Append new user message (z5: boundary changes)
    const u2 = userMsg('u:2', 'follow up')
    messages = [...messages, u2]
    changes = recordChange(changes, { kind: 'append', ids: ['u:2'] })
    const snap2 = model.advance(
      { messages, transcriptChanges: changes },
      { forkable: true, reserve: true }
    )

    // Assistant text block from turn 1 is untouched reference
    expect(snap2.blockAt(1)).toBe(b1Before)
    // Old user block reserveTarget cleared
    const firstBlock = snap2.blockAt(0)
    expect(firstBlock).not.toBe(b0Before)
    expect(firstBlock.kind === 'user' && firstBlock.reserveTarget).toBe(false)
    // New user block at end has reserveTarget true & gap 24
    const lastBlock = snap2.blockAt(snap2.count - 1)
    expect(lastBlock.key).toBe(userBlockKey('u:2'))
    expect(lastBlock.gap).toBe(24)
    expect(lastBlock.kind === 'user' && lastBlock.reserveTarget).toBe(true)
  })

  it('z2/z4: replace{partsFrom} updates only target message and late tool_result updates only original tool call block', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
    let messages: Message[] = [
      userMsg('u:1', 'run tool'),
      assistantMsg('a:1', [
        { type: 'text', text: 'calling' },
        { type: 'tool_call', toolRunId: 't1', toolName: 'Read', args: { path: 'a.ts' } }
      ]),
      assistantMsg('a:2', [{ type: 'text', text: 'waiting' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap1 = model.advance({ messages, transcriptChanges: changes })
    const u1Before = snap1.blockAt(0)
    const a1TextBefore = snap1.blockAt(1)
    const a1ToolBefore = snap1.blockAt(2)
    expect(a1ToolBefore.key).toBe('a:1:tool:t1')

    // Late tool_result arrives on a:2
    messages = [
      messages[0],
      messages[1],
      {
        ...messages[2],
        parts: [
          ...messages[2].parts,
          { type: 'tool_result', toolRunId: 't1', result: 'file content', isError: false }
        ]
      }
    ]
    changes = recordChange(changes, { kind: 'replace', id: 'a:2', partsFrom: 1 })
    const snap2 = model.advance({ messages, transcriptChanges: changes })

    // Unrelated user block is exact same object reference
    expect(snap2.blockAt(0)).toBe(u1Before)
    // Original tool block in a:1 now has the result
    const a1ToolAfter = snap2.blockAt(snap2.indexOf('a:1:tool:t1'))
    expect(a1ToolAfter).not.toBe(a1ToolBefore)
    expect(
      a1ToolAfter.kind === 'segment' &&
        a1ToolAfter.segment.kind === 'tools' &&
        a1ToolAfter.segment.calls[0].result?.output
    ).toBe('file content')
    // Text block key preserved
    expect(snap2.blockAt(1).key).toBe(a1TextBefore.key)
  })

  it('z3: remove deletes blocks of removed message and updates first-block gap', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
    let messages: Message[] = [
      userMsg('u:1', 'first'),
      assistantMsg('a:1', [{ type: 'text', text: 'reply' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    model.advance({ messages, transcriptChanges: changes })

    messages = [messages[1]]
    changes = recordChange(changes, { kind: 'remove', ids: ['u:1'] })
    const snap2 = model.advance({ messages, transcriptChanges: changes })
    expect(snap2.indexOf(userBlockKey('u:1'))).toBe(-1)
    expect(snap2.blockAt(0).gap).toBe(0)
  })

  it('z6: T-preserving prepend inserts prefix and only updates old first boundary block without touching tail', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
    let messages: Message[] = [
      userMsg('u:2', 'second'),
      assistantMsg('a:2', [{ type: 'text', text: 'ans 2' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap1 = model.advance({ messages, transcriptChanges: changes })
    const a2TextBefore = snap1.blockAt(1)
    const a2MetaBefore = snap1.blockAt(2)

    const prefix = [userMsg('u:1', 'first'), assistantMsg('a:1', [{ type: 'text', text: 'ans 1' }])]
    messages = [...prefix, ...messages]
    changes = recordChange(changes, { kind: 'prepend', ids: ['u:1', 'a:1'] })
    const snap2 = model.advance({ messages, transcriptChanges: changes })

    expect(snap2.blockAt(0).key).toBe(userBlockKey('u:1'))
    expect(snap2.blockAt(0).gap).toBe(0)
    // Old first block (u:2) updated to gap 24
    const u2After = snap2.blockAt(snap2.indexOf(userBlockKey('u:2')))
    expect(u2After.gap).toBe(24)
    // Tail blocks are exact same object references (0 visits / 0 allocations)
    expect(snap2.blockAt(snap2.indexOf(a2TextBefore.key))).toBe(a2TextBefore)
    expect(snap2.blockAt(snap2.indexOf(a2MetaBefore.key))).toBe(a2MetaBefore)
  })

  it('z7: live block toggles structurally with stable liveBlockKey and hides/shows meta on inflight', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 'sess-7' })
    const messages: Message[] = [
      userMsg('u:1', 'hi'),
      assistantMsg('a:1', [{ type: 'text', text: 'part 1' }])
    ]
    const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })

    const snapInflight = model.advance(
      { messages, transcriptChanges: changes },
      { inflight: true, hasLive: true }
    )
    expect(snapInflight.indexOf(liveBlockKey('sess-7'))).toBe(snapInflight.count - 1)
    expect(snapInflight.indexOf(turnMetaKey('a:1'))).toBe(-1)

    const snapDone = model.advance(
      { messages, transcriptChanges: changes },
      { inflight: false, hasLive: false, forkable: true }
    )
    expect(snapDone.indexOf(liveBlockKey('sess-7'))).toBe(-1)
    const metaIdx = snapDone.indexOf(turnMetaKey('a:1'))
    expect(metaIdx).toBeGreaterThanOrEqual(0)
    const meta = snapDone.blockAt(metaIdx)
    expect(meta.kind === 'meta' && meta.forkable).toBe(true)
  })

  it('y9/D-067: duplicate toolRunId call emits 1 block at first position with updated input', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' })
    const messages: Message[] = [
      assistantMsg('a:1', [
        { type: 'tool_call', toolRunId: 'dup1', toolName: 'Read', args: { path: 'old.ts' } }
      ]),
      assistantMsg('a:2', [
        { type: 'tool_call', toolRunId: 'dup1', toolName: 'Read', args: { path: 'new.ts' } },
        { type: 'tool_result', toolRunId: 'dup1', result: 'ok', isError: false }
      ])
    ]
    const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap = model.advance({ messages, transcriptChanges: changes })
    const blocks = snapshotToArray(snap)
    const toolBlocks = blocks.filter((b) => b.kind === 'segment' && b.segment.kind === 'tools')
    expect(toolBlocks).toHaveLength(1)
    expect(toolBlocks[0].key).toBe('a:1:tool:dup1')
    if (toolBlocks[0].kind === 'segment' && toolBlocks[0].segment.kind === 'tools') {
      expect(toolBlocks[0].segment.calls[0].input).toEqual({ path: 'new.ts' })
      expect(toolBlocks[0].segment.calls[0].result?.output).toBe('ok')
    }
  })

  it('z8 + property: 200-step randomized sequence matches full-build oracle at every step', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 'prop' })
    let messages: Message[] = []
    let changes = newTranscriptChanges()
    let seq = 0
    let seed = 42
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }

    for (let step = 0; step < 200; step++) {
      const r = nextRand()
      if (messages.length === 0 || r < 0.4) {
        const isUser = messages.length === 0 || messages[messages.length - 1].role === 'assistant'
        const id = `${isUser ? 'u' : 'a'}:${++seq}`
        const m = isUser
          ? userMsg(id, `user ${seq}`, 1000 + seq)
          : assistantMsg(
              id,
              nextRand() < 0.5
                ? [{ type: 'text', text: `resp ${seq}` }]
                : [
                    {
                      type: 'tool_call',
                      toolRunId: `t${seq}`,
                      toolName: 'Bash',
                      args: { cmd: `echo ${seq}` }
                    }
                  ],
              1000 + seq
            )
        messages = [...messages, m]
        changes = recordChange(changes, { kind: 'append', ids: [id] })
      } else if (r < 0.7) {
        // Replace last assistant message
        const idx = messages.length - 1
        const target = messages[idx]
        if (target.role === 'assistant') {
          const prevLen = target.parts.length
          const nextParts: AppMessagePart[] = [
            ...target.parts,
            { type: 'text', text: ` extra ${++seq}` }
          ]
          messages = [...messages.slice(0, idx), { ...target, parts: nextParts }]
          changes = recordChange(changes, { kind: 'replace', id: target.id, partsFrom: prevLen })
        }
      } else if (r < 0.85 && messages[0].role === 'user') {
        // T-preserving prepend (user + assistant pair)
        const uid = `u:pre${++seq}`
        const aid = `a:pre${++seq}`
        const pre = [
          userMsg(uid, `pre ${seq}`, seq),
          assistantMsg(aid, [{ type: 'text', text: `ans ${seq}` }], seq + 1)
        ]
        messages = [...pre, ...messages]
        changes = recordChange(changes, { kind: 'prepend', ids: [uid, aid] })
      } else if (r < 0.95 && messages.length > 2) {
        // Remove last message
        const removed = messages[messages.length - 1]
        messages = messages.slice(0, -1)
        changes = recordChange(changes, { kind: 'remove', ids: [removed.id] })
      } else {
        changes = recordChange(changes, { kind: 'reset', complete: true })
      }

      const opts = {
        forkable: true,
        reserve: true,
        inflight: step % 7 === 0,
        hasLive: step % 7 === 0
      }
      const incBlocks = snapshotToArray(
        model.advance({ messages, transcriptChanges: changes }, opts)
      )
      const oracleBlocks = buildClaudeBlocksOracle(
        messages,
        { mode: 'code', sessionKey: 'prop' },
        opts
      )

      expect(incBlocks.map((b) => ({ kind: b.kind, key: b.key, gap: b.gap }))).toEqual(
        oracleBlocks.map((b) => ({ kind: b.kind, key: b.key, gap: b.gap }))
      )
    }
  })
})
