import { describe, expect, it } from 'vitest'
import { groupExchanges, groupTurns, turnCopyText, turnEquals } from './turns'
import type { Message } from '../reducer/chatReducer'
import type { ReceivedMessageOrigin } from '../../../../../shared/session-schedules'

const literal = '<task-notification>사용자가 직접 입력한 본문</task-notification>'
const message = (role: Message['role'], text: string, origin?: ReceivedMessageOrigin): Message => ({
  role,
  createdAt: 1,
  parts: [{ type: 'text', text, ...(origin ? { origin } : {}) }]
})

describe('received input transcript projection', () => {
  it('does not leave an empty user turn when only empty human parts remain', () => {
    const mixed = message('user', '<system-reminder>hidden</system-reminder>', {
      kind: 'automatic'
    })
    mixed.parts.push({ type: 'text', text: '  ' }, { type: 'attachment', attachments: [] })
    expect(groupExchanges([mixed])).toEqual([])
    expect(mixed.parts).toHaveLength(3)
  })
  it.each([false, true])(
    'retains human parts and attachments in mixed messages (reveal=%s)',
    (showAutomaticFeeds) => {
      const hidden = message('user', '<system-reminder>internal</system-reminder>', {
        kind: 'automatic'
      })
      const human = { type: 'text' as const, text: '<system-reminder>human XML</system-reminder>' }
      const attachment = {
        type: 'attachment' as const,
        attachments: [
          { id: 'file', name: 'sample.md', kind: 'file' as const, mimeType: 'text/markdown' }
        ]
      }
      const automatic = {
        type: 'text' as const,
        text: '<task-notification>done</task-notification>',
        origin: { kind: 'task' as const, format: 'tagged' as const }
      }
      const mixed: Message = {
        role: 'user',
        createdAt: 2,
        parts: [...hidden.parts, human, automatic, attachment]
      }
      const assistant = message(
        'assistant',
        '<system-reminder>tool/assistant result</system-reminder>',
        { kind: 'automatic', format: 'system-reminder' }
      )
      const input = [hidden, mixed, assistant]
      const original = structuredClone(input)
      const turns = groupTurns(input, { showAutomaticFeeds })
      expect(turns.map((turn) => turn.startIndex)).toEqual([showAutomaticFeeds ? 0 : 1, 2])
      const projectedMixed = turns[0].messages.at(-1)!
      expect(projectedMixed.parts).toEqual(showAutomaticFeeds ? mixed.parts : [human, attachment])
      expect(projectedMixed.parts).toContain(human)
      expect(projectedMixed.parts.at(-1)).toBe(attachment)
      if (showAutomaticFeeds) {
        expect(turns[0].messages[0]).toBe(hidden)
        expect(projectedMixed).toBe(mixed)
      }
      expect(turns[1].messages[0]).toBe(assistant)
      expect(turnCopyText(turns[0])).toBe(
        showAutomaticFeeds
          ? `<system-reminder>internal</system-reminder>\n\n<system-reminder>internal</system-reminder>${human.text}${automatic.text}`
          : human.text
      )
      expect(input).toEqual(original)
      const reminderExchanges = groupExchanges([hidden], { showAutomaticFeeds })
      expect(reminderExchanges).toHaveLength(showAutomaticFeeds ? 1 : 0)
      if (showAutomaticFeeds) expect(reminderExchanges[0].turns[0].messages[0]).toBe(hidden)
    }
  )

  it.each(['tagged', 'plain', undefined] as const)(
    'reveals non-reminder automatic input with %s format and preserves unchanged identity',
    (format) => {
      const automatic = message('user', literal, { kind: 'task', ...(format ? { format } : {}) })
      expect(groupTurns([automatic])).toEqual([])
      expect(groupTurns([automatic], { showAutomaticFeeds: true })[0].messages[0]).toBe(automatic)
      expect(groupTurns([automatic], { showAutomaticFeeds: true })[0].startIndex).toBe(0)
    }
  )

  it.each(['system-reminder', undefined] as const)(
    'reveals %s reminders only when enabled while preserving identical handwritten text',
    (format) => {
      const automatic = message('user', '<system-reminder>model only</system-reminder>', {
        kind: 'automatic',
        ...(format ? { format } : {})
      })
      const human = message(
        'user',
        automatic.parts[0].type === 'text' ? automatic.parts[0].text : ''
      )
      expect(groupTurns([automatic, human])[0].messages).toEqual([human])
      const revealed = groupTurns([automatic, human], { showAutomaticFeeds: true })[0]
      expect(revealed.messages).toEqual([automatic, human])
      expect(revealed.messages[0]).toBe(automatic)
      expect(revealed.messages[1]).toBe(human)
    }
  )

  it.each(['automatic', 'scheduled', 'task', 'channel', 'peer'] as const)(
    'hides %s input while retaining literal user input, assistant output and original indexes',
    (kind) => {
      const automatic = message('user', literal, { kind })
      const human = message('user', literal)
      const reply = message('assistant', '처리 결과', { kind })
      const input = [automatic, human, reply, message('user', '다음 입력')]
      const original = structuredClone(input)
      const turns = groupTurns(input)
      expect(turns.map((turn) => turn.startIndex)).toEqual([1, 2, 3])
      expect(turns[0].messages).toEqual([human])
      expect(turns[1].messages[0]).toBe(reply)
      expect(turnCopyText(turns[0])).toBe(literal)
      expect(groupExchanges(input).map((exchange) => exchange.startIndex)).toEqual([1, 3])
      expect(groupTurns(input, { showAutomaticFeeds: true })[0].messages).toEqual([
        automatic,
        human
      ])
      expect(input).toEqual(original)
    }
  )

  it('adds no empty exchange and keeps the earlier turn identity across a received input', () => {
    const input = [message('user', '질문'), message('assistant', '이전 답변')]
    const before = groupTurns(input)
    const automatic = message('user', '자동 이벤트', { kind: 'task' })
    const after = groupTurns([...input, automatic])
    expect(groupExchanges([automatic])).toEqual([])
    expect(after).toHaveLength(2)
    expect(turnEquals(before[1], after[1])).toBe(true)
    const reply = message('assistant', '후속 결과')
    expect(groupTurns([...input, automatic, reply])[1].messages).toEqual([input[1], reply])
  })
})
