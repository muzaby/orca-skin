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
})
