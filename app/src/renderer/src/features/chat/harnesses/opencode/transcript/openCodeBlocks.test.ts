import { describe, expect, it } from 'vitest'
import type { AppMessagePart } from '../../../../../../../shared/ipc'
import type { Message } from '../../../reducer/chatReducer'
import { newTranscriptChanges, recordChange } from '../../../lib/transcript/changeLog'
import { userBlockKey } from '../../../lib/transcript/blockKeys'
import { buildOpenCodeBlocksOracle, snapshotToArray } from '../../../lib/blockOracle.testfixture'
import { createOpenCodeBlockModel } from './openCodeBlocks'

function userMsg(id: string, text: string, createdAt = 1000): Message {
  return { id, role: 'user', createdAt, parts: [{ type: 'text', text }] }
}

function assistantMsg(id: string, parts: AppMessagePart[], createdAt = 2000): Message {
  return { id, role: 'assistant', createdAt, parts }
}

describe('openCodeBlocks (EP-7 · EP-8 · y10~y20 · z1~z9)', () => {
  it('y11: cross-message text segment keeps representative part key <A>:text:0 even when C appends', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = [
      userMsg('u:1', 'q'),
      assistantMsg('a:A', [{ type: 'text', text: 'part A' }]),
      assistantMsg('a:B', [{ type: 'text', text: 'part B' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap1 = model.advance({ messages, transcriptChanges: changes })
    const seg1 = snapshotToArray(snap1).find((b) => b.kind === 'segment')
    expect(seg1?.key).toBe('a:A:text:0')

    messages = [...messages, assistantMsg('a:C', [{ type: 'text', text: 'part C' }])]
    changes = recordChange(changes, { kind: 'append', ids: ['a:C'] })
    const snap2 = model.advance({ messages, transcriptChanges: changes })
    const seg2 = snapshotToArray(snap2).find((b) => b.kind === 'segment')
    expect(seg2?.key).toBe('a:A:text:0')
  })

  it('y10/y20: OpenCode live peeks nextPartKey without consuming; committed text gets exact same key; continuing last text segment emits no separate live block', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = [
      userMsg('u:1', 'start'),
      assistantMsg('a:M', [
        { type: 'text', text: 'intro' },
        { type: 'tool_call', toolRunId: 't1', toolName: 'Read', args: {} }
      ])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })

    // Live text starts after tool_call on message a:M → peeks a:M:text:1
    const snapLive = model.advance(
      { messages, transcriptChanges: changes },
      { pending: true, liveText: true, liveTextKey: 'a:M' }
    )
    const liveBlock = snapshotToArray(snapLive).find((b) => b.kind === 'segment' && b.live)
    expect(liveBlock?.key).toBe('a:M:text:1')

    // Commit that text part to a:M → exact same key a:M:text:1 (peek did not consume seq!)
    messages = [
      messages[0],
      {
        ...messages[1],
        parts: [...messages[1].parts, { type: 'text', text: 'done' }]
      }
    ]
    changes = recordChange(changes, { kind: 'replace', id: 'a:M', partsFrom: 2 })
    const snapCommitted = model.advance(
      { messages, transcriptChanges: changes },
      { pending: false, liveText: false }
    )
    const textBlocks = snapshotToArray(snapCommitted).filter(
      (b) => b.kind === 'segment' && b.segment.kind === 'text'
    )
    expect(textBlocks.map((b) => b.key)).toEqual(['a:M:text:0', 'a:M:text:1'])

    // Continuing last committed text segment with live → NO separate live block, reuses a:M:text:1
    const snapCont = model.advance(
      { messages, transcriptChanges: changes },
      { pending: true, liveText: true, liveTextKey: 'a:M' }
    )
    const contTextBlocks = snapshotToArray(snapCont).filter(
      (b) => b.kind === 'segment' && b.segment.kind === 'text'
    )
    expect(contTextBlocks).toHaveLength(2)
    expect(contTextBlocks[1].key).toBe('a:M:text:1')
    expect(contTextBlocks[1].kind === 'segment' && contTextBlocks[1].live).toBe(true)
  })

  it('y16/y19: on reset, prepending earlier text keeps previous representative key, and merging two segments picks front representative', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = [
      userMsg('u:1', 'q'),
      assistantMsg('a:B', [{ type: 'text', text: 'world' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap1 = model.advance({ messages, transcriptChanges: changes })
    expect(snapshotToArray(snap1).find((b) => b.kind === 'segment')?.key).toBe('a:B:text:0')

    // Reset with a:A inserted before a:B in the same assistant turn → merges, keeps a:B:text:0 (y16)
    messages = [messages[0], assistantMsg('a:A', [{ type: 'text', text: 'hello' }]), messages[1]]
    changes = recordChange(changes, { kind: 'reset', complete: true })
    const snap2 = model.advance({ messages, transcriptChanges: changes })
    expect(snapshotToArray(snap2).find((b) => b.kind === 'segment')?.key).toBe('a:B:text:0')
  })

  it('z1: append 1 message allocates only the new message blocks and keeps earlier blocks identical', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = [
      userMsg('u:1', 'q1'),
      assistantMsg('a:1', [{ type: 'text', text: 'ans 1' }]),
      userMsg('u:2', 'q2'),
      assistantMsg('a:2', [{ type: 'text', text: 'ans 2' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap1 = model.advance({ messages, transcriptChanges: changes })
    const u1Before = snap1.blockAt(0)
    const a1Before = snap1.blockAt(1)

    messages = [...messages, userMsg('u:3', 'q3')]
    changes = recordChange(changes, { kind: 'append', ids: ['u:3'] })
    const snap2 = model.advance({ messages, transcriptChanges: changes })
    expect(snap2.blockAt(0)).toBe(u1Before)
    expect(snap2.blockAt(1)).toBe(a1Before)
    expect(snap2.blockAt(snap2.count - 1).key).toBe(userBlockKey('u:3'))
  })

  it('z2: replace{partsFrom} updates only the targeted message blocks and keeps other blocks identical', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = [
      userMsg('u:1', 'q1'),
      assistantMsg('a:1', [{ type: 'text', text: 'first' }]),
      userMsg('u:2', 'q2'),
      assistantMsg('a:2', [{ type: 'text', text: 'second' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap1 = model.advance({ messages, transcriptChanges: changes })
    const a1Before = snap1.blockAt(1)

    messages = [
      messages[0],
      messages[1],
      messages[2],
      {
        ...messages[3],
        parts: [
          ...messages[3].parts,
          { type: 'tool_call', toolRunId: 't2', toolName: 'Read', args: { file: 'x' } }
        ]
      }
    ]
    changes = recordChange(changes, { kind: 'replace', id: 'a:2', partsFrom: 1 })
    const snap2 = model.advance({ messages, transcriptChanges: changes })
    expect(snap2.blockAt(1)).toBe(a1Before)
    expect(snapshotToArray(snap2).map((b) => b.key)).toEqual(
      buildOpenCodeBlocksOracle(messages).map((b) => b.key)
    )
  })

  it('z3: remove deletes the message blocks and updates boundary blocks', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = [
      userMsg('u:1', 'q1'),
      assistantMsg('a:1', [{ type: 'text', text: 'ans 1' }]),
      userMsg('u:2', 'q2')
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    model.advance({ messages, transcriptChanges: changes })

    messages = [messages[1], messages[2]]
    changes = recordChange(changes, { kind: 'remove', ids: ['u:1'] })
    const snap2 = model.advance({ messages, transcriptChanges: changes })
    expect(snap2.indexOf(userBlockKey('u:1'))).toBe(-1)
    expect(snap2.blockAt(0).gap).toBe(0)
    expect(snapshotToArray(snap2).map((b) => ({ kind: b.kind, key: b.key, gap: b.gap }))).toEqual(
      buildOpenCodeBlocksOracle(messages).map((b) => ({ kind: b.kind, key: b.key, gap: b.gap }))
    )
  })

  it('z4: late tool result updates only the original call block', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = [
      userMsg('u:1', 'q1'),
      assistantMsg('a:1', [
        { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: { cmd: 'ls' } }
      ]),
      userMsg('u:2', 'q2'),
      assistantMsg('a:2', [{ type: 'text', text: 'later' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap1 = model.advance({ messages, transcriptChanges: changes })
    const a2Before = snap1.blockAt(3)

    messages = [
      messages[0],
      {
        ...messages[1],
        parts: [
          ...messages[1].parts,
          { type: 'tool_result', toolRunId: 't1', result: 'ok', isError: false }
        ]
      },
      messages[2],
      messages[3]
    ]
    changes = recordChange(changes, { kind: 'replace', id: 'a:1', partsFrom: 1 })
    const snap2 = model.advance({ messages, transcriptChanges: changes })
    expect(snap2.blockAt(3)).toBe(a2Before)
    expect(snap2.blockAt(1)).not.toBe(snap1.blockAt(1))
  })

  it('z5: boundary-changing append updates only boundary blocks and keeps earlier turns identical', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = [
      userMsg('u:1', 'q1'),
      assistantMsg('a:1', [{ type: 'text', text: 'ans 1' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap1 = model.advance({ messages, transcriptChanges: changes })
    const u1Before = snap1.blockAt(0)

    messages = [...messages, userMsg('u:2', 'q2')]
    changes = recordChange(changes, { kind: 'append', ids: ['u:2'] })
    const snap2 = model.advance({ messages, transcriptChanges: changes })
    expect(snap2.blockAt(0)).toBe(u1Before)
    expect(snapshotToArray(snap2).map((b) => ({ kind: b.kind, key: b.key, gap: b.gap }))).toEqual(
      buildOpenCodeBlocksOracle(messages).map((b) => ({ kind: b.kind, key: b.key, gap: b.gap }))
    )
  })

  it('z6: T-preserving prepend keeps existing blocks identical by reference', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = [
      userMsg('u:2', 'q2'),
      assistantMsg('a:2', [{ type: 'text', text: 'ans 2' }])
    ]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snap1 = model.advance({ messages, transcriptChanges: changes })
    const a2SegBefore = snap1.blockAt(1)

    messages = [
      userMsg('u:1', 'q1'),
      assistantMsg('a:1', [{ type: 'text', text: 'ans 1' }]),
      ...messages
    ]
    changes = recordChange(changes, { kind: 'prepend', ids: ['u:1', 'a:1'] })
    const snap2 = model.advance({ messages, transcriptChanges: changes })

    expect(snap2.blockAt(0).key).toBe(userBlockKey('u:1'))
    expect(snap2.blockAt(snap2.indexOf(a2SegBefore.key))).toBe(a2SegBefore)
  })

  it('z7: live presence transition (p1~p3) updates structure once with stable representative keys', () => {
    const model = createOpenCodeBlockModel()
    const messages: Message[] = [
      userMsg('u:1', 'q1'),
      assistantMsg('a:1', [{ type: 'text', text: 'hello' }])
    ]
    const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const snapIdle = model.advance(
      { messages, transcriptChanges: changes },
      { pending: false, liveText: false }
    )
    const snapLive = model.advance(
      { messages, transcriptChanges: changes },
      { pending: true, liveText: true, liveTextKey: 'a:1' }
    )
    const snapDone = model.advance(
      { messages, transcriptChanges: changes },
      { pending: false, liveText: false }
    )
    expect(snapLive.blockAt(1).key).toBe(snapIdle.blockAt(1).key)
    expect(snapDone.blockAt(1).key).toBe(snapIdle.blockAt(1).key)
  })

  it('z8: folded catch-up (append -> replace -> remove and remove -> re-add) matches full oracle', () => {
    const mFresh = createOpenCodeBlockModel()
    const mMid = createOpenCodeBlockModel()
    let messages: Message[] = [userMsg('u:1', 'q1')]
    let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    mMid.advance({ messages, transcriptChanges: changes })

    // append a:tmp -> replace a:tmp -> remove a:tmp
    messages = [...messages, assistantMsg('a:tmp', [{ type: 'text', text: 'temp' }])]
    changes = recordChange(changes, { kind: 'append', ids: ['a:tmp'] })
    messages = [
      messages[0],
      assistantMsg('a:tmp', [
        { type: 'text', text: 'temp' },
        { type: 'text', text: '2' }
      ])
    ]
    changes = recordChange(changes, { kind: 'replace', id: 'a:tmp', partsFrom: 1 })
    messages = [messages[0]]
    changes = recordChange(changes, { kind: 'remove', ids: ['a:tmp'] })

    // append a:2 -> remove a:2 -> re-add a:2
    messages = [...messages, assistantMsg('a:2', [{ type: 'text', text: 'v1' }])]
    changes = recordChange(changes, { kind: 'append', ids: ['a:2'] })
    messages = [messages[0]]
    changes = recordChange(changes, { kind: 'remove', ids: ['a:2'] })
    messages = [...messages, assistantMsg('a:2', [{ type: 'text', text: 'v2' }])]
    changes = recordChange(changes, { kind: 'append', ids: ['a:2'] })

    const oracle = buildOpenCodeBlocksOracle(messages).map((b) => ({
      kind: b.kind,
      key: b.key,
      gap: b.gap
    }))
    expect(
      snapshotToArray(mFresh.advance({ messages, transcriptChanges: changes })).map((b) => ({
        kind: b.kind,
        key: b.key,
        gap: b.gap
      }))
    ).toEqual(oracle)
    expect(
      snapshotToArray(mMid.advance({ messages, transcriptChanges: changes })).map((b) => ({
        kind: b.kind,
        key: b.key,
        gap: b.gap
      }))
    ).toEqual(oracle)
  })

  it('z9: incremental append/prepend/replace work is constant between 1 turn and 100 turns', () => {
    const runAtTurns = (
      turnCount: number
    ): { beforeCount: number; reused: number; added: number } => {
      const model = createOpenCodeBlockModel()
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

  it('property: 200-step randomized sequence matches full-build oracle', () => {
    const model = createOpenCodeBlockModel()
    let messages: Message[] = []
    let changes = newTranscriptChanges()
    let seq = 0
    let seed = 1337
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }

    for (let step = 0; step < 200; step++) {
      const r = nextRand()
      if (messages.length === 0 || r < 0.45) {
        const isUser = messages.length === 0 || messages[messages.length - 1].role === 'assistant'
        const id = `${isUser ? 'u' : 'a'}:${++seq}`
        const m = isUser
          ? userMsg(id, `u ${seq}`, 1000 + seq)
          : assistantMsg(
              id,
              nextRand() < 0.6
                ? [{ type: 'text', text: `t ${seq}` }]
                : [
                    {
                      type: 'tool_call',
                      toolRunId: `t${seq}`,
                      toolName: 'Read',
                      args: { file: `${seq}` }
                    }
                  ],
              1000 + seq
            )
        messages = [...messages, m]
        changes = recordChange(changes, { kind: 'append', ids: [id] })
      } else if (r < 0.75) {
        const idx = messages.length - 1
        const target = messages[idx]
        if (target.role === 'assistant') {
          const prevLen = target.parts.length
          messages = [
            ...messages.slice(0, idx),
            { ...target, parts: [...target.parts, { type: 'text', text: ` +${++seq}` }] }
          ]
          changes = recordChange(changes, { kind: 'replace', id: target.id, partsFrom: prevLen })
        }
      } else if (r < 0.9 && messages[0].role === 'user') {
        const uid = `u:p${++seq}`
        const aid = `a:p${++seq}`
        messages = [
          userMsg(uid, `pu ${seq}`, seq),
          assistantMsg(aid, [{ type: 'text', text: `pa ${seq}` }], seq + 1),
          ...messages
        ]
        changes = recordChange(changes, { kind: 'prepend', ids: [uid, aid] })
      } else {
        changes = recordChange(changes, { kind: 'reset', complete: true })
      }

      const opts = {
        pending: step % 5 === 0,
        liveText: step % 5 === 0,
        liveTextKey: `a:live${seq}`
      }
      const inc = snapshotToArray(model.advance({ messages, transcriptChanges: changes }, opts))
      const oracle = buildOpenCodeBlocksOracle(messages, opts)

      expect(inc.map((b) => ({ kind: b.kind, key: b.key, gap: b.gap }))).toEqual(
        oracle.map((b) => ({ kind: b.kind, key: b.key, gap: b.gap }))
      )
    }
  })

  it('projects the committed head once and the live tail once per presence change without computing copy text', () => {
    const model = createOpenCodeBlockModel()
    const messages: Message[] = [
      userMsg('u:1', 'question'),
      assistantMsg('a:1', [{ type: 'text', text: 'committed head' }])
    ]
    const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    const s1 = model.advance(
      { messages, transcriptChanges: changes },
      { pending: false, liveText: false }
    )
    const headBlock = s1.blockAt(0)
    const s2 = model.advance(
      { messages, transcriptChanges: changes },
      { pending: true, liveText: true, liveTextKey: 'a:1' }
    )
    const s3 = model.advance(
      { messages, transcriptChanges: changes },
      { pending: true, liveText: true, liveTextKey: 'a:1' }
    )
    expect(s2.blockAt(0)).toBe(headBlock)
    expect(s3.blockAt(0)).toBe(headBlock)
    expect(s3.blockAt(1)).toBe(s2.blockAt(1))
  })
})
