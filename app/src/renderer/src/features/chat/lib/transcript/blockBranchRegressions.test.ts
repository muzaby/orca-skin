import { expect, it } from 'vitest'
import { userMessageId } from '../../../../../../shared/message-id'
import { initialChatState, type ChatState, type Message } from '../../reducer/chatReducer'
import { transcriptIndexFor } from '../transcriptIndex'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import { createSegmentCache } from '../segmentCache'
import { carryPartKeys, PartKeyTracker } from './blockKeys'
import { changedMessageLocations, newTranscriptChanges, recordChange } from './changeLog'
import { messageOrderFor } from './messageOrder'
import { clearDisclosures, getDisclosure, setDisclosure } from '../../store/disclosureStore'

function row(id: string, role: Message['role'], parts: Message['parts']): Message {
  return { id, role, createdAt: 1, parts }
}
function call(id: string): Message['parts'][number] {
  return { type: 'tool_call', toolRunId: id, toolName: 'Read', args: {} }
}

it('l9/l10 keeps a reinserted ID at the winning end and uses the order within each batch', () => {
  expect(
    changedMessageLocations([
      { kind: 'append', ids: ['removed', 'to-prefix', 'tail-a', 'tail-b'] },
      { kind: 'prepend', ids: ['old-first', 'to-tail'] },
      { kind: 'remove', ids: ['removed', 'to-prefix', 'to-tail'] },
      { kind: 'replace', id: 'tail-b', partsFrom: 1 },
      { kind: 'prepend', ids: ['new-first', 'to-prefix'] },
      { kind: 'append', ids: ['to-tail', 'new-last'] }
    ])
  ).toEqual({
    prependedIds: ['new-first', 'to-prefix', 'old-first'],
    appendedIds: ['tail-a', 'tail-b', 'to-tail', 'new-last'],
    relocatedIds: new Set(['to-prefix', 'to-tail'])
  })
})

it('q1/q6 distinguishes legacy user client IDs, canonical IDs and anonymous assistant objects', () => {
  const legacy = { ...row('legacy', 'user', []), clientId: 'pending' }
  const assistant = { ...row('old-assistant', 'assistant', [call('owner')]), clientId: 'pending' }
  Reflect.deleteProperty(legacy, 'id')
  Reflect.deleteProperty(assistant, 'id')
  const canonical = { ...row('canonical', 'user', []), clientId: 'retired' }
  const messages = [assistant, canonical, legacy]
  const initial = newTranscriptChanges()
  const order = messageOrderFor({ messages, transcriptChanges: initial }, true)
  const legacyKey = userMessageId(['pending'])
  const anonymousKey = order.toolCallOwner('owner')
  expect(anonymousKey).toEqual(expect.any(String))
  expect(order.messagePosition(anonymousKey!)).toBe(0)
  expect(order.messagePosition(legacyKey)).toBe(2)
  expect(order.messagePosition('canonical')).toBe(1)
  expect(order.messagePosition(userMessageId(['retired']))).toBe(-1)
  const fresh = messageOrderFor(
    {
      messages: [legacy, assistant],
      transcriptChanges: recordChange(initial, { kind: 'reset', complete: false })
    },
    true
  )
  expect(fresh.toolCallOwner('owner')).toBe(anonymousKey)
  expect(fresh.messagePosition(anonymousKey!)).toBe(1)
  expect(fresh.messagePosition(legacyKey)).toBe(0)
})

it('y3/y14 excludes nested parts before assigning ordinals even for an empty parent ID', () => {
  const tracker = new PartKeyTracker()
  const first = row('row', 'assistant', [
    { type: 'text', text: 'child', parentToolRunId: '' },
    { type: 'reasoning', text: 'hidden', parentToolRunId: 'p' },
    {
      type: 'tool_call',
      toolRunId: 'child-call',
      toolName: 'Read',
      args: {},
      parentToolRunId: 'p'
    },
    { type: 'text', text: 'root', parentToolRunId: undefined },
    { type: 'reasoning', text: 'note' },
    call('root-call')
  ])
  const keys = carryPartKeys(tracker, first.id, undefined, first)
  expect(keys.map(({ partIndex, key }) => [partIndex, key])).toEqual([
    [3, 'row:text:0'],
    [4, 'row:reasoning:0'],
    [5, 'row:tool:root-call']
  ])
  const second = { ...first, parts: [...first.parts, { type: 'text' as const, text: 'later' }] }
  expect(carryPartKeys(tracker, first.id, keys, second).at(-1)?.key).toBe('row:text:1')
})

it.each(['code', 'work', 'opencode'] as const)(
  'z2/z5 %s preserves human text, attachments and attributed assistant text on feed toggles',
  (mode) => {
    const feed = { type: 'text' as const, text: 'received', origin: { kind: 'automatic' as const } }
    const text = { type: 'text' as const, text: 'typed' }
    const attachment = {
      type: 'attachment' as const,
      attachments: [{ id: 'f', name: 'f', kind: 'file' as const, mimeType: 'text/plain' }]
    }
    const diff: Message['parts'][number] = {
      type: 'diff_requirements',
      requirements: [
        {
          sessionId: 's',
          baselineCommit: 'base',
          filePath: 'a',
          oldLine: null,
          newLine: 1,
          hunkHeader: '@@',
          contextBefore: [],
          contextAfter: [],
          comment: 'keep',
          createdAt: 1
        }
      ]
    }
    const reviewed = row('review', 'user', [feed, diff])
    const mixed = row('mixed', 'user', [feed, text])
    const attached = row('attached', 'user', [feed, attachment])
    const hidden = row('hidden', 'user', [feed, { type: 'text', text: '   ' }])
    const assistant = row('assistant', 'assistant', [feed])
    const model =
      mode === 'opencode'
        ? createOpenCodeBlockModel()
        : createClaudeBlockModel({ mode, sessionKey: 'test' })
    const state = {
      messages: [mixed, attached, reviewed, hidden, assistant],
      transcriptChanges: newTranscriptChanges()
    }
    for (const showAutomaticFeeds of [false, true, false]) {
      const snap = model.advance(state, { showAutomaticFeeds })
      const blocks = Array.from({ length: snap.count }, (_, i) => snap.blockAt(i))
      const users = blocks.flatMap((b) => (b.kind === 'user' ? b.turn.messages : []))
      expect(users.map((m) => [m.id, m.parts])).toEqual(
        showAutomaticFeeds
          ? [
              [mixed.id, mixed.parts],
              [attached.id, attached.parts],
              [reviewed.id, reviewed.parts],
              [hidden.id, hidden.parts]
            ]
          : [
              [mixed.id, [text]],
              [attached.id, [attachment]],
              [reviewed.id, [diff]]
            ]
      )
      expect(
        blocks.flatMap((b) =>
          b.kind === 'segment' && b.segment.kind === 'text' ? [b.segment.text] : []
        )
      ).toContain('received')
    }
    const added = row('next', 'user', [feed, text])
    const appended = {
      messages: [...state.messages, added],
      transcriptChanges: recordChange(state.transcriptChanges, { kind: 'append', ids: [added.id] })
    }
    const before = model.advance(appended)
    const previous = before.blockAt(before.count - 1)
    expect(previous.kind === 'user' && previous.turn.messages[0].parts).toEqual([text])
    const replaced = { ...added, parts: [feed, attachment] }
    const after = model.advance({
      messages: [...state.messages, replaced],
      transcriptChanges: recordChange(appended.transcriptChanges, {
        kind: 'replace',
        id: added.id,
        partsFrom: 1
      })
    })
    const updated = after.blockAt(after.count - 1)
    expect(updated.key).toBe(previous.key)
    expect(updated.kind === 'user' && updated.turn.messages[0].parts).toEqual([attachment])
    expect(previous.kind === 'user' && previous.turn.messages[0].parts).toEqual([text])
  }
)

it('s3/s8 keeps completed and pending sibling call objects when one result changes or disappears', () => {
  const cache = createSegmentCache()
  const result = (id: string, output: string): Message['parts'][number] => ({
    type: 'tool_result',
    toolRunId: id,
    result: output,
    isError: false
  })
  const parts = [call('changed'), call('completed'), call('pending'), result('completed', 'saved')]
  const snapshots = [['old'], ['new'], []].map((values, index) => {
    const seg = cache.segmentsFor(
      row('calls', 'assistant', [...parts, ...values.map((s) => result('changed', s))]),
      index === 0 ? 0 : parts.length
    )[0]
    if (seg.kind !== 'tools') throw new Error('expected three sibling calls')
    return seg.calls
  })
  expect(snapshots.map((calls) => calls[0].result?.output)).toEqual(['old', 'new', undefined])
  expect(snapshots[1][0]).not.toBe(snapshots[0][0])
  expect(snapshots[2][0]).not.toBe(snapshots[1][0])
  for (const calls of snapshots.slice(1)) {
    expect(calls[1]).toBe(snapshots[0][1])
    expect(calls[2]).toBe(snapshots[0][2])
  }
})

it.each(['code', 'work', 'opencode'] as const)(
  'y1/y2/y4/y5 %s keeps the original user representative through a reset and later edits',
  (mode) => {
    const model =
      mode === 'opencode'
        ? createOpenCodeBlockModel()
        : createClaudeBlockModel({ mode, sessionKey: 'keys' })
    const user = (id: string): Message => row(id, 'user', [{ type: 'text', text: id }])
    const older = user('older')
    const first = user('first')
    const next = user('next')
    const assistant = row('answer', 'assistant', [{ type: 'text', text: 'answer' }])
    let changes = newTranscriptChanges()
    const initial = model.advance({ messages: [first, assistant], transcriptChanges: changes })
    const initialKeys = Array.from({ length: initial.count }, (_, i) => initial.keyAt(i))
    for (const [messages, delta] of [
      [[older, first, assistant], { kind: 'reset', complete: false }],
      [[older, first, assistant, next], { kind: 'append', ids: ['next'] }],
      [[user('older'), first, assistant, next], { kind: 'replace', id: 'older', partsFrom: 0 }]
    ] as const) {
      changes = recordChange(changes, delta)
      const snap = model.advance({ messages, transcriptChanges: changes })
      const block = snap.blockAt(0)
      expect(block.kind === 'user' && [block.key, block.messageId, block.partKeys]).toEqual([
        'first:user',
        'older',
        ['older:user', 'first:user']
      ])
      expect(Array.from({ length: snap.count }, (_, i) => snap.keyAt(i))).toEqual(
        expect.arrayContaining(initialKeys)
      )
    }
  }
)

it('y13/y19 releases the losing Work disclosure after a merge and inherits the winner on a split', () => {
  const sessionKey = 'merged-activity'
  const model = createClaudeBlockModel({ mode: 'work', sessionKey })
  let changes = newTranscriptChanges()
  function project(split: boolean): string[] {
    const message = row('m', 'assistant', [
      { type: 'response_boundary', boundary: { id: 'r', phase: 'begin' } },
      call('one'),
      ...(split ? [{ type: 'compact_boundary' as const }] : []),
      call('two'),
      { type: 'response_boundary', boundary: { id: 'r', phase: 'end', outcome: 'ended' } }
    ])
    changes = recordChange(changes, { kind: 'reset', complete: true })
    const snap = model.advance({ messages: [message], transcriptChanges: changes })
    return Array.from({ length: snap.count }, (_, i) => snap.blockAt(i))
      .filter((b) => b.kind === 'activity')
      .map((b) => b.key)
  }
  try {
    const [first, second] = project(true)
    expect([first, second]).toEqual(['m:activity:m:tool:one', 'm:activity:m:tool:two'])
    setDisclosure(sessionKey, first, false)
    setDisclosure(sessionKey, second, true)
    expect(project(false)).toEqual([first])
    expect(getDisclosure(sessionKey, first, true)).toBe(false)
    expect(getDisclosure(sessionKey, second, false)).toBe(false)
    expect(getDisclosure(sessionKey, second, true)).toBe(true)
    setDisclosure(sessionKey, first, true)
    expect(project(true)).toEqual([first, second])
    expect(getDisclosure(sessionKey, second, false)).toBe(true)
  } finally {
    clearDisclosures(sessionKey)
  }
})
it.each(['code', 'work', 'opencode'] as const)(
  'z8 %s resumes from revisions 0, 32 and 64 with the same blocks, ranks, ownership and panel values',
  (mode) => {
    for (const checkpoint of [0, 32, 64]) {
      const model =
        mode === 'opencode'
          ? createOpenCodeBlockModel()
          : createClaudeBlockModel({ mode, sessionKey: 'delayed' })
      let messages = [
        row('user', 'user', [{ type: 'text', text: 'prompt' }]),
        row('replayed', 'assistant', [call('obsolete')])
      ]
      let changes = newTranscriptChanges()
      function state(): ChatState {
        return { ...initialChatState, messages, transcriptChanges: changes }
      }
      function consume(): void {
        model.advance(state())
        messageOrderFor(state(), true)
        transcriptIndexFor(state())
      }
      if (checkpoint === 0) consume()
      while (changes.revision < 64) {
        const id = 'checkpoint-' + changes.revision
        messages = [...messages, row(id, 'assistant', [{ type: 'text', text: id }])]
        changes = recordChange(changes, { kind: 'append', ids: [id] })
        if (changes.revision === checkpoint) consume()
      }
      for (const delta of [
        { kind: 'append', ids: ['temporary'] },
        { kind: 'replace', id: 'temporary', partsFrom: 0 },
        { kind: 'remove', ids: ['temporary', 'replayed'] },
        { kind: 'append', ids: ['replayed'] }
      ] as const)
        changes = recordChange(changes, delta)
      const final = row('replayed', 'assistant', [
        call('kept'),
        { type: 'tool_result', toolRunId: 'kept', result: 'retained', isError: false },
        { type: 'text', text: 'child output', parentToolRunId: 'group' }
      ])
      messages = [...messages.filter((m) => m.id !== 'replayed'), final]
      const after = state()
      const reference = { ...after, transcriptChanges: newTranscriptChanges() }
      const full =
        mode === 'opencode'
          ? createOpenCodeBlockModel()
          : createClaudeBlockModel({ mode, sessionKey: 'delayed' })
      const a = model.advance(after)
      const b = full.advance(reference)
      expect(Array.from({ length: a.count }, (_, i) => a.blockAt(i))).toEqual(
        Array.from({ length: b.count }, (_, i) => b.blockAt(i))
      )
      const order = messageOrderFor(after, true)
      expect([
        order.toolCallOwner('obsolete'),
        order.toolCallOwner('kept'),
        order.messagePosition('replayed'),
        order.messagePosition('temporary')
      ]).toEqual([undefined, 'replayed', messages.length - 1, -1])
      const panels = transcriptIndexFor(after)
      const expected = transcriptIndexFor(reference)
      expect(panels.childMessage('group')).toEqual(expected.childMessage('group'))
      expect(panels.childMessage('group')?.parts).toMatchObject([{ text: 'child output' }])
      expect(panels.transcriptResults()).toEqual(expected.transcriptResults())
    }
  }
)

it.each(['code', 'work', 'opencode'] as const)(
  'z2 %s rejects stale artifacts when the gap or a later artifact changes',
  (mode) => {
    const model =
      mode === 'opencode'
        ? createOpenCodeBlockModel()
        : createClaudeBlockModel({ mode, sessionKey: 'artifact-edit' })
    const artifact = (name: string): Message['parts'][number] => ({
      type: 'artifact',
      artifact: {
        publicationId: name,
        artifactFileId: name,
        title: name,
        filename: name,
        kind: 'text',
        sizeBytes: 1,
        publishedAt: 1
      }
    })
    const first = artifact('first')
    const second = artifact('second')
    const third = artifact('third')
    const content: Message['parts'][number] = { type: 'text', text: 'tail' }
    let changes = newTranscriptChanges()
    const edits = [
      { parts: [first, second], expected: ['first', 'second'], gap: 0, from: 0 },
      { parts: [first, second, content], expected: ['first', 'second'], gap: 16, from: 2 },
      { parts: [first, third, content], expected: ['first', 'third'], gap: 16, from: 1 },
      {
        parts: [first, third, second, content],
        expected: ['first', 'third', 'second'],
        gap: 16,
        from: 2
      },
      { parts: [first, content], expected: ['first'], gap: 16, from: 1 }
    ]
    for (const [index, edit] of edits.entries()) {
      if (index)
        changes = recordChange(changes, { kind: 'replace', id: 'art', partsFrom: edit.from })
      const snap = model.advance({
        messages: [row('art', 'assistant', edit.parts)],
        transcriptChanges: changes
      })
      const existing = Array.from({ length: snap.count }, (_, i) => snap.blockAt(i)).filter(
        (b) => b.kind === 'artifacts'
      )
      expect(existing).toHaveLength(1)
      expect(existing[0].gap).toBe(edit.gap)
      expect(existing[0].artifacts.map((a) => a.publicationId)).toEqual(edit.expected)
    }
  }
)

it('z2 Work rejects a suffix hint based on the intervening non-Work projection', () => {
  const model = createClaudeBlockModel({ mode: 'work', sessionKey: 'hint' })
  const boundary: Message['parts'][number] = {
    type: 'response_boundary',
    boundary: { phase: 'begin', id: 'new' }
  }
  const old = row('m', 'assistant', [boundary, { type: 'text', text: 'stale' }])
  const intermediate = row('m', 'assistant', [
    { type: 'text', text: 'outside' },
    { type: 'text', text: ' revision' }
  ])
  const next = row('m', 'assistant', [
    ...intermediate.parts,
    boundary,
    { type: 'text', text: 'new tail' }
  ])
  let changes = newTranscriptChanges()
  model.advance({ messages: [old], transcriptChanges: changes })
  changes = recordChange(changes, { kind: 'replace', id: 'm', partsFrom: 0 })
  model.advance({ messages: [intermediate], transcriptChanges: changes })
  changes = recordChange(changes, { kind: 'replace', id: 'm', partsFrom: 2 })
  const snap = model.advance({ messages: [next], transcriptChanges: changes })
  const text = Array.from({ length: snap.count }, (_, i) => snap.blockAt(i)).flatMap((b) =>
    b.kind === 'segment' && b.segment.kind === 'text' ? [b.segment.text] : []
  )
  expect(text).toEqual(['outside revision', 'new tail'])
})
