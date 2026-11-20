import { expect, it } from 'vitest'
import { userMessageId } from '../../../../../../shared/message-id'
import type { Message } from '../../reducer/chatReducer'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import { createSegmentCache } from '../segmentCache'
import { carryPartKeys, PartKeyTracker } from './blockKeys'
import { changedMessageLocations, newTranscriptChanges, recordChange } from './changeLog'
import { messageOrderFor } from './messageOrder'

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
