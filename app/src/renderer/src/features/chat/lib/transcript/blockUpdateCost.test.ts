import { describe, expect, it, vi } from 'vitest'
import { generateTranscriptFixture, type FixtureKind } from '../../dev/transcriptFixtures'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import type { Message } from '../../reducer/chatReducer'
import * as blockList from './blockList'
import { newTranscriptChanges, recordChange, type TranscriptChange } from './changeLog'
import { messageOrderFor } from './messageOrder'

type Edit = TranscriptChange['kind']

interface UpdateCost {
  partReads: number
  unrelatedPartReads: number
  newBlocks: number
  appLookups: number
  ownerVisits: number
  rankWrites: number
  afterRemovalLookup: number
  locationWrites: number
  copiedBlockSlots: number
  orderEntries: number
  spliceCalls: number
  messagesBefore: number
  blocksAfter: number
}
function measure(
  screen: FixtureKind,
  turns: number,
  edit: Edit,
  exactlyTenThousand = false
): UpdateCost {
  let partReads = 0
  let unrelatedPartReads = 0
  let appLookups = 0
  let ownerVisits = 0
  let copiedBlockSlots = 0
  let orderEntries = 0
  let locationWrites = 0
  let rankWrites = 0
  let spliceCalls = 0
  let splicing = false
  let measuring = false
  const realCreate = blockList.createBlockList
  const seen = new WeakSet()
  function observe<B extends { readonly key: string }>(
    initial?: readonly B[]
  ): blockList.BlockList<B> {
    const list = realCreate(initial)
    function track(snapshot: blockList.BlockSnapshot<B>): blockList.BlockSnapshot<B> {
      if (!seen.has(snapshot)) {
        seen.add(snapshot)
        const indexOf = snapshot.indexOf
        snapshot.indexOf = (key) => {
          if (measuring) appLookups++
          return indexOf(key)
        }
      }
      return snapshot
    }
    return {
      snapshot: () => track(list.snapshot()),
      splice(start, count, insert) {
        if (measuring) spliceCalls++
        splicing = true
        try {
          return track(list.splice(start, count, insert))
        } finally {
          splicing = false
        }
      }
    }
  }
  const factory = vi.spyOn(blockList, 'createBlockList').mockImplementation(observe)
  const entries = Map.prototype[Symbol.iterator]
  const mapSet = Map.prototype.set
  const slice = Array.prototype.slice
  const iterator = Array.prototype[Symbol.iterator]
  const chunk = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && 'slots' in value
  const block = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && 'gap' in value && 'key' in value
  const counted = (message: Message, unrelated: boolean): Message => ({
    ...message,
    parts: new Proxy(message.parts, {
      get(target, property, receiver) {
        if (measuring && typeof property === 'string' && /^\d+$/.test(property)) {
          partReads++
          if (unrelated) unrelatedPartReads++
        }
        return Reflect.get(target, property, receiver)
      }
    })
  })
  try {
    const loaded = generateTranscriptFixture(screen, { turns }).loadedMessages.map((m) =>
      counted(m, true)
    )
    const user = counted(
      { id: 'target-u', role: 'user', createdAt: 0, parts: [{ type: 'text', text: 'prompt' }] },
      false
    )
    const assistant: Message = {
      id: 'target-a',
      role: 'assistant',
      createdAt: 1,
      parts:
        screen === 'claude-work'
          ? [
              { type: 'response_boundary', boundary: { phase: 'begin', id: 'target-r' } },
              { type: 'tool_call', toolName: 'Read', toolRunId: 'target-tool', args: {} },
              { type: 'text', text: 'original' },
              {
                type: 'response_boundary',
                boundary: { phase: 'end', id: 'target-r', outcome: 'ended' }
              }
            ]
          : [{ type: 'text', text: 'original' }]
    }
    const reset = newTranscriptChanges()
    const active = counted(assistant, false)
    const tail = edit === 'append' ? [user] : [user, active]
    const initial = [
      ...(exactlyTenThousand ? loaded.slice(-(10_000 - tail.length)) : loaded),
      ...tail
    ]
    const state = { messages: initial, transcriptChanges: reset }
    const model =
      screen === 'opencode'
        ? createOpenCodeBlockModel()
        : createClaudeBlockModel({
            mode: screen === 'claude-work' ? 'work' : 'code',
            sessionKey: 'z9'
          })
    const before = model.advance(state)
    const prior = new Set(Array.from({ length: before.count }, (_, i) => before.blockAt(i)))
    const ranks: unknown = Reflect.get(messageOrderFor(state), 'ranks')
    let messages: Message[]
    let change: TranscriptChange
    switch (edit) {
      case 'append':
        messages = [...initial, active]
        change = { kind: edit, ids: [active.id] }
        break
      case 'remove':
        messages = initial.slice(0, -1)
        change = { kind: edit, ids: [active.id] }
        break
      case 'replace':
        messages = [
          ...initial.slice(0, -1),
          counted(
            { ...assistant, parts: [...assistant.parts, { type: 'reasoning', text: 'new' }] },
            false
          )
        ]
        change = { kind: edit, id: active.id, partsFrom: assistant.parts.length }
        break
      case 'prepend': {
        const prefix = [
          counted({ ...user, id: 'prefix-u' }, false),
          counted(
            { ...assistant, id: 'prefix-a', parts: [{ type: 'text', text: 'earlier' }] },
            false
          )
        ]
        messages = [...prefix, ...initial]
        change = { kind: edit, ids: prefix.map((m) => m.id) }
        break
      }
      case 'reset':
        messages = initial.map((m) => counted({ ...m, parts: m.parts.slice() }, true))
        change = { kind: edit, complete: true }
        break
    }
    const next = { messages, transcriptChanges: recordChange(reset, change) }

    Map.prototype[Symbol.iterator] = function () {
      const items = entries.call(this)
      const next = items.next.bind(items)
      items.next = () => {
        const entry = next()
        if (
          !entry.done &&
          measuring &&
          entry.value[1]?.blockKey !== undefined &&
          entry.value[1]?.messageId !== undefined
        )
          ownerVisits++
        return entry
      }
      return items
    }
    Map.prototype.set = function (key: unknown, value: unknown) {
      if (this === ranks) rankWrites++
      if (chunk(key)) orderEntries++
      if (chunk(value)) locationWrites++
      return mapSet.call(this, key, value)
    }
    Array.prototype.slice = function (start?: number, end?: number) {
      const result = slice.call(this, start, end)
      if (splicing && block(result[0])) copiedBlockSlots += result.length
      return result
    }
    Array.prototype[Symbol.iterator] = function () {
      if (splicing && block(this[0])) copiedBlockSlots += this.length
      return iterator.call(this)
    }
    measuring = true
    const after = model.advance(next)
    measuring = false
    // Materialize the new snapshot's order table outside the model's counted indexOf calls.
    after.indexOf(after.keyAt(0))
    const beforeLookup = rankWrites
    messageOrderFor(next).messagePosition(user.id)
    const afterRemovalLookup = rankWrites - beforeLookup
    const newBlocks = Array.from({ length: after.count }, (_, i) => after.blockAt(i)).filter(
      (b) => !prior.has(b)
    ).length
    return {
      partReads,
      unrelatedPartReads,
      newBlocks,
      appLookups,
      ownerVisits,
      rankWrites: beforeLookup,
      afterRemovalLookup,
      locationWrites,
      copiedBlockSlots,
      orderEntries,
      spliceCalls,
      messagesBefore: initial.length,
      blocksAfter: after.count
    }
  } finally {
    measuring = false
    Array.prototype[Symbol.iterator] = iterator
    Array.prototype.slice = slice
    Map.prototype[Symbol.iterator] = entries
    Map.prototype.set = mapSet
    factory.mockRestore()
  }
}

describe('z9 actual block update costs', () => {
  it.each(['claude-code', 'claude-work', 'opencode'] as const)(
    '%s append, replace and remove after one or one hundred loaded turns',
    (screen) => {
      for (const edit of ['append', 'replace', 'remove'] as const) {
        const short = measure(screen, 1, edit)
        const long = measure(screen, 100, edit)
        for (const key of [
          'partReads',
          'unrelatedPartReads',
          'newBlocks',
          'appLookups',
          'ownerVisits',
          'rankWrites'
        ] as const) {
          expect.soft(long[key], edit + '.' + key).toBe(short[key])
        }
        expect.soft(long.unrelatedPartReads, edit).toBe(0)
      }
    }
  )
  it.each(['claude-code', 'claude-work', 'opencode'] as const)(
    '%s stays within the edit footprint at 10,000 messages',
    (screen) => {
      for (const edit of ['append', 'replace', 'remove', 'prepend', 'reset'] as const) {
        const cost = measure(screen, 5000, edit, true)
        expect(cost.messagesBefore).toBe(10_000)
        if (edit === 'reset') {
          expect(cost.partReads).toBeGreaterThanOrEqual(10_000)
          expect(cost.rankWrites).toBe(10_000)
          expect(cost.newBlocks).toBeGreaterThan(0)
          expect(cost.copiedBlockSlots).toBeGreaterThanOrEqual(cost.blocksAfter)
          expect(cost.orderEntries).toBeGreaterThan(0)
          expect(cost.appLookups).toBeLessThanOrEqual(cost.blocksAfter)
          continue
        }
        const reference = measure(screen, 1, edit)
        for (const key of [
          'partReads',
          'unrelatedPartReads',
          'newBlocks',
          'appLookups',
          'ownerVisits',
          'rankWrites'
        ] as const)
          expect.soft(cost[key], edit + '.' + key).toBe(reference[key])
        // A splice can copy the two edge chunks (64 slots each) plus the fixed input blocks.
        const blockBudget = (128 + cost.newBlocks) * cost.spliceCalls
        expect(cost.locationWrites).toBeLessThanOrEqual(blockBudget)
        expect(cost.copiedBlockSlots).toBeLessThanOrEqual(3 * blockBudget)
        expect(cost.afterRemovalLookup).toBe(edit === 'remove' ? 9_999 : 0)
      }
    },
    120_000
  )
})
