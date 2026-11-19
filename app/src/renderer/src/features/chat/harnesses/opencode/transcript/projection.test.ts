import { describe, expect, it } from 'vitest'
import type { Message } from '../../../reducer/chatReducer'
import { projectTimeline } from './projection'

const user: Message = {
  id: 'u:10',
  role: 'user',
  createdAt: 10,
  parts: [{ type: 'text', text: 'prompt' }]
}
const idle = { text: '', reasoning: '', pending: false }

describe('OpenCode timeline projection', () => {
  it('hides automatic feeds by default and reveals them when showAutomaticFeeds is enabled', () => {
    const reminder: Message = {
      id: 'u:1',
      role: 'user',
      createdAt: 1,
      parts: [
        {
          type: 'text',
          text: '<system-reminder>internal</system-reminder>',
          origin: { kind: 'automatic' }
        }
      ]
    }
    const answer: Message = {
      id: 'a:11',
      role: 'assistant',
      createdAt: 11,
      parts: [{ type: 'text', text: 'answer' }]
    }
    const source = [reminder, user, answer]
    const hidden = projectTimeline(source, idle, { showAutomaticFeeds: false })
    const revealed = projectTimeline(source, idle, { showAutomaticFeeds: true })
    expect(hidden.map((r) => r.kind)).toEqual(['user', 'segment', 'meta'])
    const hiddenUser = hidden.find((r) => r.kind === 'user')
    const revealedUser = revealed.find((r) => r.kind === 'user')
    expect(hiddenUser?.kind === 'user' && hiddenUser.turn.messages).toHaveLength(1)
    expect(revealedUser?.kind === 'user' && revealedUser.turn.messages).toHaveLength(2)
  })

  it('distinguishes same-timestamp messages by message id and preserves keys on prepend', () => {
    const m1: Message = {
      id: 'u:same-1',
      role: 'user',
      createdAt: 10,
      parts: [{ type: 'text', text: 'first' }]
    }
    const a1: Message = {
      id: 'a:same-1',
      role: 'assistant',
      createdAt: 10,
      parts: [{ type: 'text', text: 'reply' }]
    }
    const base = projectTimeline([m1, a1], idle)
    const olderUser: Message = {
      id: 'u:older',
      role: 'user',
      createdAt: 1,
      parts: [{ type: 'text', text: 'older' }]
    }
    const olderAssistant: Message = {
      id: 'a:older',
      role: 'assistant',
      createdAt: 2,
      parts: [{ type: 'text', text: 'older reply' }]
    }
    const prepended = projectTimeline([olderUser, olderAssistant, m1, a1], idle)
    expect(prepended.slice(-base.length).map((r) => r.key)).toEqual(base.map((r) => r.key))
  })

  it('projectTimeline emits live text row without reasoning prose when presence is active', () => {
    const rows = projectTimeline([user], {
      text: 'streaming',
      reasoning: 'thinking',
      pending: true
    })
    expect(rows.some((r) => r.kind === 'segment' && r.segment.kind === 'reasoning')).toBe(false)
    expect(
      rows.some(
        (r) =>
          r.kind === 'segment' &&
          r.segment.kind === 'text' &&
          r.streaming &&
          r.segment.text === 'streaming'
      )
    ).toBe(true)
  })
})
