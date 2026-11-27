import { describe, expect, it, vi } from 'vitest'
import type { AppMessagePart } from '../../../../../../../shared/ipc'
import type { Message } from '../../../reducer/chatReducer'
import {
  newTranscriptChanges,
  recordChange,
  type TranscriptChanges,
  type TranscriptChange
} from '../../../lib/transcript/changeLog'
import { liveBlockKey, turnMetaKey, userBlockKey } from '../../../lib/transcript/blockKeys'
import { buildClaudeBlocksOracle, snapshotToArray } from '../../../lib/blockOracle.testfixture'
import * as segmentCache from '../../../lib/segmentCache'
import { getDisclosure, setDisclosure } from '../../../store/disclosureStore'
import { createClaudeBlockModel, type ClaudeBlock, type ClaudeActivityBlock } from './claudeBlocks'

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

  it('z2 keeps parsed prefix segments inside the message receiving a replacement', () => {
    const original = segmentCache.createSegmentCache
    const calls: { offset: number | undefined; first: unknown }[] = []
    const factory = vi.spyOn(segmentCache, 'createSegmentCache').mockImplementation(() => {
      const cache = original()
      const parse = cache.segmentsFor
      cache.segmentsFor = (...args) => {
        const result = parse(...args)
        if (args[0].id === 'a:edit') calls.push({ offset: args[1], first: result[0] })
        return result
      }
      return cache
    })
    try {
      const parts: AppMessagePart[] = [
        { type: 'text', text: 'stable' },
        { type: 'reasoning', text: 'old' }
      ]
      const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's' })
      const reset = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
      model.advance({ messages: [assistantMsg('a:edit', parts)], transcriptChanges: reset })
      const first = calls.at(-1)?.first
      expect(first).toBeDefined()
      model.advance({
        messages: [assistantMsg('a:edit', [parts[0], { type: 'reasoning', text: 'new' }])],
        transcriptChanges: recordChange(reset, { kind: 'replace', id: 'a:edit', partsFrom: 1 })
      })
      expect(calls.at(-1)?.offset).toBe(1)
      expect(calls.at(-1)?.first).toBe(first)
    } finally {
      factory.mockRestore()
    }
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
    expect(snap2.blockAt(1)).toBe(a1TextBefore)
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

  it('y9 deduplicates two calls inside the first owning message and uses its latest input', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's' })
    const messages = [
      assistantMsg('owner', [
        { type: 'tool_call', toolRunId: 'dup', toolName: 'Read', args: { path: 'first' } },
        { type: 'tool_call', toolRunId: 'dup', toolName: 'Read', args: { path: 'last' } }
      ])
    ]
    const blocks = snapshotToArray(
      model.advance({ messages, transcriptChanges: newTranscriptChanges() })
    )
    const calls = blocks.flatMap((b) =>
      b.kind === 'segment' && b.segment.kind === 'tools' ? b.segment.calls : []
    )
    expect(calls.map((call) => call.input)).toEqual([{ path: 'last' }])
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

  it('z9: incremental prepend cost is constant between 1 turn and 100 turns', () => {
    const runAtTurns = (
      turnCount: number
    ): { beforeCount: number; reused: number; added: number } => {
      const model = createClaudeBlockModel({ mode: 'code', sessionKey: 'z9' })
      const msgs: Message[] = []
      for (let i = 1; i <= turnCount; i++) {
        msgs.push(userMsg(`u:${i}`, `q ${i}`, i * 10))
        msgs.push(assistantMsg(`a:${i}`, [{ type: 'text', text: `ans ${i}` }], i * 10 + 1))
      }
      let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
      const before = model.advance({ messages: msgs, transcriptChanges: changes })
      const nextMsgs = [
        userMsg('u:0', 'older', 0),
        assistantMsg('a:0', [{ type: 'text', text: 'old' }], 1),
        ...msgs
      ]
      changes = recordChange(changes, { kind: 'prepend', ids: ['u:0', 'a:0'] })
      const after = model.advance({ messages: nextMsgs, transcriptChanges: changes })
      let reused = 0
      for (let i = 0; i < before.count; i++) {
        const b = before.blockAt(i)
        const idx = after.indexOf(b.key)
        if (idx >= 0 && after.blockAt(idx) === b) reused++
      }
      return { beforeCount: before.count, reused, added: after.count - before.count }
    }
    const r1 = runAtTurns(1)
    const r100 = runAtTurns(100)
    expect(r1.added).toBe(r100.added)
    expect(r1.beforeCount - r1.reused).toBeLessThanOrEqual(2)
    expect(r100.beforeCount - r100.reused).toBeLessThanOrEqual(2)
  })

  it.each(['code', 'work'] as const)(
    'z8 %s transfers duplicate calls and withdraws replay input for ordinary tools and questions',
    (mode) => {
      for (const toolName of ['Read', 'AskUserQuestion']) {
        const model = createClaudeBlockModel({ mode, sessionKey: 'replays' })
        const call = (id: string, input: string): Message =>
          assistantMsg(id, [
            { type: 'response_boundary', boundary: { phase: 'begin', id } },
            { type: 'tool_call', toolName, toolRunId: 'shared', args: { input } },
            { type: 'response_boundary', boundary: { phase: 'end', id, outcome: 'ended' } }
          ])
        const result = assistantMsg('result', [
          { type: 'tool_result', toolRunId: 'shared', isError: false, result: 'done' }
        ])
        let messages = [
          call('original', 'first'),
          userMsg('break', 'again'),
          call('replay', 'second'),
          result
        ]
        let changes = newTranscriptChanges()
        function check(owner: string, input: string): void {
          const state = { messages, transcriptChanges: changes }
          for (const snap of [
            model.advance(state),
            createClaudeBlockModel({ mode, sessionKey: 'fresh' }).advance(state)
          ]) {
            const visible = snapshotToArray(snap).flatMap((block) => {
              const items =
                block.kind === 'activity' ? block.items : block.kind === 'segment' ? [block] : []
              return items.flatMap((item) => {
                const seg = item.segment
                const calls =
                  seg.kind === 'tools' ? seg.calls : seg.kind === 'ask' ? [seg.call] : []
                return calls.map((c) => [item.messageId, c.input, c.result?.output])
              })
            })
            expect(visible).toEqual([[owner, { input }, 'done']])
          }
        }
        check('original', 'second')
        messages = messages.filter((m) => m.id !== 'replay')
        changes = recordChange(changes, { kind: 'remove', ids: ['replay'] })
        check('original', 'first')
        messages = [...messages, call('again', 'third')]
        changes = recordChange(changes, { kind: 'append', ids: ['again'] })
        check('original', 'third')
        messages = messages.slice(1)
        changes = recordChange(changes, { kind: 'remove', ids: ['original'] })
        check('again', 'third')
      }
    }
  )

  it('z8 keeps the surviving standalone Work call keyed by its first visible tool after a replay', () => {
    const first = assistantMsg('owner', [
      { type: 'tool_call', toolName: 'Read', toolRunId: 'dup', args: {} }
    ])
    const replay = assistantMsg('later', [
      { type: 'tool_call', toolName: 'Read', toolRunId: 'dup', args: { updated: true } },
      { type: 'tool_call', toolName: 'Read', toolRunId: 'remain', args: {} },
      { type: 'response_boundary', boundary: { phase: 'begin', id: 'r' } },
      { type: 'text', text: 'answer' },
      { type: 'response_boundary', boundary: { phase: 'end', id: 'r', outcome: 'ended' } }
    ])
    const model = createClaudeBlockModel({ mode: 'work', sessionKey: 'group-owner' })
    const before = newTranscriptChanges()
    const rows = [first, userMsg('new', 'second'), replay]
    const snap = model.advance({ messages: rows, transcriptChanges: before })
    const key = 'later:tool:remain'
    expect(snap.indexOf(key)).toBeGreaterThanOrEqual(0)
    const result = assistantMsg('result', [
      { type: 'tool_result', toolRunId: 'remain', result: 'later', isError: false }
    ])
    const after = model.advance({
      messages: [...rows, userMsg('third', 'third'), result],
      transcriptChanges: recordChange(before, { kind: 'append', ids: ['third', 'result'] })
    })
    expect(after.blockAt(after.indexOf(key))).toMatchObject({
      segment: { calls: [{ toolUseId: 'remain', result: { output: 'later' } }] }
    })
  })

  it('y19 keeps the Work activity representative after another message becomes its first item', () => {
    const sessionKey = 'work-representative'
    const model = createClaudeBlockModel({ mode: 'work', sessionKey })
    const begin: AppMessagePart = {
      type: 'response_boundary',
      boundary: { id: 'response', phase: 'begin' }
    }
    const tool = (id: string): AppMessagePart => ({
      type: 'tool_call',
      toolRunId: id,
      toolName: 'Read',
      args: {}
    })
    const original = assistantMsg('original', [
      begin,
      tool('retained'),
      { type: 'response_boundary', boundary: { id: 'response', phase: 'end', outcome: 'ended' } }
    ])
    let changes = newTranscriptChanges()
    const activity = (
      messages: Message[],
      change: TranscriptChange = { kind: 'reset', complete: true }
    ): ClaudeActivityBlock => {
      changes = recordChange(changes, change)
      const snapshot = model.advance({ messages, transcriptChanges: changes })
      const activities = snapshotToArray(snapshot).filter((block) => block.kind === 'activity')
      expect(activities).toHaveLength(1)
      return activities[0]
    }
    const first = activity([original])
    setDisclosure(sessionKey, first.key, true)
    try {
      for (const id of ['new-first', 'replacement-first', 'reloaded-first']) {
        const head = assistantMsg('head', [begin, tool(id)])
        const joined = activity(
          [head, original],
          id === 'replacement-first' ? { kind: 'replace', id: head.id, partsFrom: 1 } : undefined
        )
        expect(joined.partKeys).toEqual(['head:tool:' + id, 'original:tool:retained'])
        expect(joined.key).toBe(first.key)
        expect(getDisclosure(sessionKey, joined.key)).toBe(true)
      }
    } finally {
      setDisclosure(sessionKey, first.key, false)
    }
  })

  it.each(['work', 'code'] as const)(
    'z8 %s orders repeated results by final transcript position after an older contribution is edited',
    (mode) => {
      const model = createClaudeBlockModel({ mode, sessionKey: 'result-order' })
      const result = (id: string, value: string): Message =>
        assistantMsg(id, [
          { type: 'tool_result', toolRunId: 'original', isError: false, result: value }
        ])
      const owner = assistantMsg('owner', [
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'r' } },
        { type: 'tool_call', toolRunId: 'original', toolName: 'Read', args: {} },
        { type: 'response_boundary', boundary: { phase: 'end', id: 'r', outcome: 'ended' } }
      ])
      const rows = [
        owner,
        userMsg('next', 'continue'),
        result('older', 'old'),
        result('later', 'latest')
      ]
      const reset = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
      const displayed = (snapshot: ReturnType<typeof model.snapshot>): unknown => {
        for (const block of snapshotToArray(snapshot)) {
          const segments =
            block.kind === 'activity'
              ? block.items.map((item) => item.segment)
              : block.kind === 'segment'
                ? [block.segment]
                : []
          for (const segment of segments) {
            if (segment.kind === 'tools') return segment.calls[0].result?.output
          }
        }
        throw Error('missing original tool')
      }
      expect(displayed(model.advance({ messages: rows, transcriptChanges: reset }))).toBe('latest')
      const messages = rows.with(2, result('older', 'updated earlier'))
      const changed = recordChange(reset, { kind: 'replace', id: 'older', partsFrom: 0 })
      expect(displayed(model.advance({ messages, transcriptChanges: changed }))).toBe('latest')
      const removed = recordChange(changed, { kind: 'remove', ids: ['later'] })
      expect(
        displayed(model.advance({ messages: messages.slice(0, -1), transcriptChanges: removed }))
      ).toBe('updated earlier')
    }
  )

  it('z2 preserves unaffected text and tool blocks in the edited message itself', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 'siblings' })
    const first = assistantMsg('a:1', [
      { type: 'text', text: 'fixed' },
      { type: 'tool_call', toolName: 'Read', args: {}, toolRunId: 'sibling' },
      { type: 'reasoning', text: 'old' }
    ])
    const reset = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const before = model.advance({ messages: [first], transcriptChanges: reset })
    const updated = assistantMsg('a:1', [
      ...first.parts.slice(0, 2),
      { type: 'reasoning', text: 'new' }
    ])
    const after = model.advance({
      messages: [updated],
      transcriptChanges: recordChange(reset, {
        kind: 'replace',
        id: first.id,
        partsFrom: 2
      })
    })
    expect(after.blockAt(0)).toBe(before.blockAt(0))
    expect(after.blockAt(1)).toBe(before.blockAt(1))
    expect(after.blockAt(2)).not.toBe(before.blockAt(2))
    expect(after.blockAt(2)).toMatchObject({ segment: { items: [{ text: 'new' }] } })
  })

  it.each(['Read', 'AskUserQuestion'])(
    'z4 keeps late results on the stand-alone Work %s call',
    (toolName) => {
      const model = createClaudeBlockModel({ mode: 'work', sessionKey: 'standalone' })
      const first = assistantMsg('owner', [
        { type: 'tool_call', toolRunId: 'outside', toolName, args: {} },
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'r' } },
        { type: 'text', text: 'conclusion' },
        { type: 'response_boundary', boundary: { phase: 'end', id: 'r', outcome: 'ended' } }
      ])
      const reset = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
      const prefix = [first, userMsg('next', 'second')]
      const before = model.advance({ messages: prefix, transcriptChanges: reset })
      const next = assistantMsg('a:next', [
        { type: 'tool_result', toolRunId: 'outside', result: 'updated', isError: false }
      ])
      const after = model.advance({
        messages: [...prefix, next],
        transcriptChanges: recordChange(reset, { kind: 'append', ids: [next.id] })
      })
      const block = after.blockAt(after.indexOf(before.keyAt(0)))
      const expected = { toolUseId: 'outside', result: { output: 'updated' } }
      expect(block).toMatchObject({
        kind: 'segment',
        segment: toolName === 'Read' ? { calls: [expected] } : { call: expected }
      })
    }
  )

  it('z4 routes results from a later turn to the original Work activity and retracts them in place', () => {
    const model = createClaudeBlockModel({ mode: 'work', sessionKey: 'late-activity' })
    const owner = assistantMsg('owner', [
      { type: 'response_boundary', boundary: { phase: 'begin', id: 'response' } },
      { type: 'tool_call', toolName: 'Read', toolRunId: 'left', args: {} },
      { type: 'text', text: 'note' },
      { type: 'tool_call', toolName: 'Read', toolRunId: 'target', args: {} },
      { type: 'text', text: 'conclusion' },
      { type: 'response_boundary', boundary: { phase: 'end', id: 'response', outcome: 'ended' } }
    ])
    const resultMessage = assistantMsg('late', [{ type: 'text', text: 'next turn' }])
    const prefix = [userMsg('first', 'start'), owner, userMsg('second', 'continue')]
    const reset = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const before = model.advance({ messages: [...prefix, resultMessage], transcriptChanges: reset })
    const original = snapshotToArray(before).find((block) => block.kind === 'activity')!
    const change = { kind: 'replace' as const, id: resultMessage.id, partsFrom: 1 }
    const changed = recordChange(reset, change)
    const result: AppMessagePart = {
      type: 'tool_result',
      toolRunId: 'target',
      result: 'late',
      isError: false
    }
    const after = model.advance({
      messages: [...prefix, { ...resultMessage, parts: [...resultMessage.parts, result] }],
      transcriptChanges: changed
    })
    const current = after.blockAt(after.indexOf(original.key))
    if (current.kind !== 'activity' || original.kind !== 'activity') throw Error('missing activity')
    expect(current.items[2].segment).toMatchObject({
      calls: [{ toolUseId: 'target', result: { output: 'late' } }]
    })
    expect(current.items[0]).toBe(original.items[0])
    expect(current.items[1]).toBe(original.items[1])
    expect(original.items[2].segment).toMatchObject({ calls: [{ toolUseId: 'target' }] })
    expect(
      original.items[2].segment.kind === 'tools' && original.items[2].segment.calls[0].result
    ).toBeUndefined()
    const reverted = model.advance({
      messages: [...prefix, resultMessage],
      transcriptChanges: recordChange(changed, change)
    })
    const withdrawn = reverted.blockAt(reverted.indexOf(original.key))
    if (withdrawn.kind !== 'activity') throw Error('missing activity after withdrawal')
    expect(withdrawn.items[2].segment).toEqual(original.items[2].segment)
    expect(withdrawn.items[0]).toBe(original.items[0])
  })

  it('VP-37 (workToolResults): attributes tool results inside work-mode activity groups without cross-leaking', () => {
    const model = createClaudeBlockModel({ mode: 'work', sessionKey: 'work-vp37' })
    const messages: Message[] = [
      userMsg('u:1', 'work'),
      assistantMsg('a:1', [
        { type: 'response_boundary', boundary: { id: 'r1', phase: 'begin' } },
        { type: 'tool_call', toolRunId: 'w1', toolName: 'Read', args: { file_path: 'a.ts' } },
        { type: 'tool_result', toolRunId: 'w1', result: 'ok-1', isError: false },
        { type: 'text', text: 'summary' },
        { type: 'response_boundary', boundary: { id: 'r1', phase: 'end', outcome: 'ended' } }
      ])
    ]
    const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap = model.advance({ messages, transcriptChanges: changes })
    const blocks = snapshotToArray(snap)
    expect(blocks.some((b) => b.kind === 'activity')).toBe(true)
    expect(blocks.some((b) => b.kind === 'segment' && b.segment.kind === 'text')).toBe(true)
  })
})

it.each(['code', 'work'] as const)(
  'z1/z2 %s protects older messages inside the same open turn',
  (mode) => {
    const allocations: ClaudeBlock[] = []
    const model = createClaudeBlockModel({ mode, sessionKey: 'local-turn' }, (block) =>
      allocations.push(block)
    )
    let reads = 0
    let measuring = false
    const older = Array.from({ length: 12 }, (_, index) => {
      const id = 'prior-' + index
      const parts: AppMessagePart[] = [{ type: 'text', text: id }]
      if (index === 0)
        parts.push({
          type: 'artifact',
          artifact: {
            publicationId: 'published',
            artifactFileId: 'file',
            title: 'file',
            filename: 'file.txt',
            kind: 'text',
            sizeBytes: 1,
            publishedAt: 1
          }
        })
      if (mode === 'work') {
        parts.unshift(
          { type: 'response_boundary', boundary: { phase: 'begin', id } },
          { type: 'tool_call', toolName: 'Read', toolRunId: id, args: {} }
        )
        parts.push({ type: 'response_boundary', boundary: { phase: 'end', id, outcome: 'ended' } })
      }
      const instrumented = new Proxy(
        parts.map(
          (part) =>
            new Proxy(part, {
              get(target, key, receiver) {
                if (measuring) reads++
                return Reflect.get(target, key, receiver)
              }
            })
        ),
        {
          get(target, key, receiver) {
            if (measuring && typeof key === 'string' && /^\d+$/.test(key)) reads++
            return Reflect.get(target, key, receiver)
          }
        }
      )
      return {
        ...assistantMsg(id, instrumented),
        get parts() {
          if (measuring) reads++
          return instrumented
        }
      }
    })
    const changed = assistantMsg('changed', [{ type: 'text', text: 'answer' }])
    const suffix = assistantMsg('suffix', [{ type: 'text', text: 'more' }])
    const original = [userMsg('user', 'go'), ...older, changed]
    let changes = newTranscriptChanges()
    let snap = model.advance({ messages: original, transcriptChanges: changes })
    const retained = snapshotToArray(snap).filter(
      (b) => b.kind !== 'meta' && 'messageId' in b && b.messageId?.startsWith('prior-')
    )
    expect(retained.length).toBeGreaterThan(0)
    let messages = [...original, suffix]
    for (const edit of ['append', 'replace'] as const) {
      if (edit === 'replace')
        messages = [
          ...original,
          assistantMsg('suffix', [...suffix.parts, { type: 'text', text: ' revised' }])
        ]
      changes = recordChange(
        changes,
        edit === 'append'
          ? { kind: edit, ids: [suffix.id] }
          : { kind: edit, id: suffix.id, partsFrom: 1 }
      )
      const priorBlocks = new Set(snapshotToArray(snap))
      allocations.length = 0
      measuring = true
      try {
        snap = model.advance({ messages, transcriptChanges: changes })
      } finally {
        measuring = false
      }
      const published = snapshotToArray(snap).filter((block) => !priorBlocks.has(block))
      expect(allocations.map((block) => block.kind)).toEqual(['segment', 'meta'])
      expect(allocations.length).toBe(published.length)
      for (const block of published) expect(allocations).toContain(block)
      expect(reads).toBe(0)
      for (const b of retained) expect(snap.blockAt(snap.indexOf(b.key))).toBe(b)
      expect(snapshotToArray(snap)).toEqual(
        buildClaudeBlocksOracle(messages, { mode, sessionKey: 'local-turn' })
      )
    }
  }
)

it.each(['code', 'work'] as const)(
  'z2 %s reads only the edited suffix of a message with a long committed prefix',
  (mode) => {
    const model = createClaudeBlockModel({ mode, sessionKey: 'old-prefix' })
    let measuring = false
    let fieldReads = 0
    const rawPrefix: AppMessagePart[] = [
      { type: 'response_boundary', boundary: { id: 'r', phase: 'begin' } },
      ...Array.from({ length: 9_997 }, (_, i): AppMessagePart => ({
        type: 'text',
        text: String(i)
      })),
      { type: 'compact_boundary' },
      { type: 'response_boundary', boundary: { id: 'r', phase: 'end', outcome: 'ended' } }
    ]
    const prefix = rawPrefix.map(
      (part) =>
        new Proxy(part, {
          get(target, key, receiver) {
            if (measuring) fieldReads++
            return Reflect.get(target, key, receiver)
          }
        })
    )
    expect(prefix).toHaveLength(10_000)
    const before = assistantMsg('long', [...prefix, { type: 'text', text: 'old' }])
    const initial = newTranscriptChanges()
    const oldSnapshot = model.advance({ messages: [before], transcriptChanges: initial })
    const oldContent = snapshotToArray(oldSnapshot).filter((b) => b.kind === 'segment')
    expect(oldContent).toHaveLength(3)
    let reads = 0
    const after = assistantMsg(
      'long',
      new Proxy([...prefix, { type: 'text' as const, text: 'new' }], {
        get(target, key, receiver) {
          if (typeof key === 'string' && /^\d+$/.test(key) && Number(key) < prefix.length) reads++
          return Reflect.get(target, key, receiver)
        }
      })
    )
    measuring = true
    const result = model.advance({
      messages: [after],
      transcriptChanges: recordChange(initial, {
        kind: 'replace',
        id: 'long',
        partsFrom: prefix.length
      })
    })
    measuring = false
    expect({ reads, fieldReads }).toEqual({ reads: 0, fieldReads: 0 })
    for (const prior of oldContent.slice(0, 2))
      expect(result.blockAt(result.indexOf(prior.key))).toBe(prior)
    expect(
      snapshotToArray(result).flatMap((b) =>
        b.kind === 'segment' && b.segment.kind === 'text' ? [b.segment.text] : []
      )
    ).toContain('new')
    const reference = createClaudeBlockModel({ mode, sessionKey: 'old-prefix' })
    reference.advance({ messages: [before], transcriptChanges: initial })
    const full = reference.advance({
      messages: [after],
      transcriptChanges: recordChange(initial, { kind: 'reset', complete: true })
    })
    expect(snapshotToArray(result)).toEqual(snapshotToArray(full))
  }
)

describe('0331 tool run boundaries', () => {
  const call = (id: string, name = 'Bash'): AppMessagePart => ({
    type: 'tool_call',
    toolRunId: id,
    toolName: name,
    args: {}
  })
  const a = call('a'),
    b = call('b')
  const ws: AppMessagePart = { type: 'text', text: '\n\n' }
  it.each(['code', 'work'] as const)(
    'AC1′ c1-c4, w3 merges visible tool neighbours in %s',
    (mode) => {
      const project = (parts: AppMessagePart[][]) =>
        buildClaudeBlocksOracle(
          parts.map((p, i) => assistantMsg('m' + i, p)),
          { mode, sessionKey: 's' }
        ).flatMap((block) => (block.kind === 'segment' ? [block] : []))
      for (const input of [[[a, ws, b]], [[a], [b]], [[a], [ws, b]], [[a, b]], [[a], [a], [b]]]) {
        const blocks = project(input)
        expect(blocks.map((block) => block.key)).toEqual(['m0:tool:a'])
        expect(blocks[0].segment).toMatchObject({
          kind: 'tools',
          calls: [{ toolUseId: 'a' }, { toolUseId: 'b' }]
        })
      }
      const boundaries: AppMessagePart[] = [
        { type: 'text', text: 'visible' },
        { type: 'reasoning', text: 'reason' },
        call('ask', 'AskUserQuestion'),
        { type: 'error', error: 'error' },
        { type: 'compact_boundary' }
      ]
      for (const boundary of boundaries)
        expect(project([[a, boundary, b]]).map((block) => block.segment.kind)).toHaveLength(3)
    }
  )
  it('retains the error part key after transparent text inside a tool run', () => {
    const error:AppMessagePart = {type:'error',error:'oops'}
    const messages=[assistantMsg('m',[a,ws,b,error])]
    const blocks=buildClaudeBlocksOracle(messages,{mode:'code',sessionKey:'s'})
    expect(blocks.map(block=>block.key)).toEqual(['m:tool:a','m:error:0','m:meta'])
  })
  it('AC10 tool gap is symmetric within and across messages', () => {
    for (const same of [true, false]) {
      const text: AppMessagePart = { type: 'text', text: 'visible' }
      for (const end of [text, call('ask', 'AskUserQuestion')]) {
        const messages = (same ? [[text, a, end]] : [[text], [a], [end]]).map((p, i) =>
          assistantMsg('m' + i, p)
        )
        expect(
          buildClaudeBlocksOracle(messages, { mode: 'code', sessionKey: 's' })
            .filter((b) => b.kind === 'segment')
            .map((b) => b.gap)
        ).toEqual([0, 12, 12])
      }
    }
  })
  it('AC1′ merged owner receives the later result and retains the first key after prepend', () => {
    const model = createClaudeBlockModel({ mode: 'code', sessionKey: 's' })
    let messages = [userMsg('u', 'later')]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    model.advance({ messages, transcriptChanges: changes })
    messages = [assistantMsg('first', [a]), assistantMsg('second', [b]), ...messages]
    changes = recordChange(changes, { kind: 'prepend', ids: ['first', 'second'] })
    expect(
      snapshotToArray(model.advance({ messages, transcriptChanges: changes })).map((b) => b.key)
    ).toEqual(['first:tool:a', 'first:meta', 'u:user'])
    messages = [
      ...messages,
      assistantMsg('result', [
        { type: 'tool_result', toolRunId: 'b', result: 'late', isError: false }
      ])
    ]
    changes = recordChange(changes, { kind: 'append', ids: ['result'] })
    expect(model.advance({ messages, transcriptChanges: changes }).blockAt(0)).toMatchObject({
      key: 'first:tool:a',
      segment: { calls: [{ toolUseId: 'a' }, { toolUseId: 'b', result: { output: 'late' } }] }
    })
  })
})
