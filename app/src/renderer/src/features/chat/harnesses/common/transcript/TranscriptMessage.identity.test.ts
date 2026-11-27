import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { Message } from '../../../reducer/chatReducer'
import type { MessageSegment } from '../../../lib/parts'
import { transcriptPresentation } from '../../../lib/agentPresentation'
import { AssistantMessage } from './AssistantMessage'
import { UserTurn } from './UserTurn'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
const seen = vi.hoisted(() => ({ rows: [] as MessageSegment[] }))
vi.mock('./TranscriptRuntime', () => ({
  useTranscriptRuntime: () => ({
    Segment: ({ segment }: { segment: MessageSegment }) => {
      seen.rows.push(segment)
      return null
    },
    messageClassName: ''
  })
}))
vi.mock('./UserMessage', () => ({
  UserMessage: ({ message }: { message: Message }) =>
    createElement('span', { 'data-child': message.id }, message.id)
}))
vi.mock('./MessageMeta', () => ({ MessageMeta: () => null }))

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  seen.rows.length = 0
})

it('s1/s2 keeps the Segment cache for one mounted AssistantMessage instance across prop changes', () => {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  const message: Message = {
    id: 'answer',
    role: 'assistant',
    createdAt: 0,
    parts: [{ type: 'compact_boundary' }, { type: 'text', text: 'first' }]
  }
  const policy = transcriptPresentation('code', 'claude')
  dom.render(createElement(AssistantMessage, { message, transcriptPolicy: policy }))
  const prefix = seen.rows.find((row) => row.kind === 'compact')
  expect(prefix).toBeDefined()
  seen.rows.length = 0
  dom.render(
    createElement(AssistantMessage, {
      message: { ...message, parts: [...message.parts, { type: 'text', text: ' next' }] },
      transcriptPolicy: policy
    })
  )
  expect(seen.rows.find((row) => row.kind === 'compact')).toBe(prefix)
  expect(seen.rows).toContainEqual({ kind: 'text', text: 'first next' })
})

it('y4 keeps the same rendered UserMessage node when an older user joins the front of its group', () => {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  const user = (id: string): Message => ({
    id,
    role: 'user',
    createdAt: 0,
    parts: [{ type: 'text', text: id }]
  })
  const retained = user('retained')
  dom.render(
    createElement(UserTurn, { turn: { role: 'user', startIndex: 0, messages: [retained] } })
  )
  const old = dom.queryAll('[data-child="retained"]')[0]
  expect(old).toBeDefined()
  dom.render(
    createElement(UserTurn, {
      turn: { role: 'user', startIndex: 0, messages: [user('older'), retained] }
    })
  )
  expect(dom.queryAll('[data-child="older"]')).toHaveLength(1)
  expect(dom.queryAll('[data-child="retained"]')[0]).toBe(old)
})
