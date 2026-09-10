import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UserMessage } from './UserMessage'
import type { ReceivedMessageOrigin } from '../../../../../../shared/session-schedules'

describe('incoming prompt origin', () => {
  it.each([
    ['automatic', '자동 수신'],
    ['scheduled', '예약 작업'],
    ['channel', '채널'],
    ['task', '작업 알림'],
    ['peer', '다른 에이전트']
  ] as const)('labels %s prompts without replacing or hiding their content', (kind, label) => {
    const origin: ReceivedMessageOrigin = { kind, label: '<외부 이름>' }
    const html = renderToStaticMarkup(
      createElement(UserMessage, {
        message: {
          role: 'user',
          createdAt: 1,
          parts: [{ type: 'text', text: '수신된 작업 내용을 처리하세요.', origin }]
        }
      })
    )
    expect(html).toContain(`data-message-origin="${kind}"`)
    expect(html).toContain(label)
    expect(html).toContain('&lt;외부 이름&gt;')
    expect(html).toContain('수신된 작업 내용을 처리하세요.')
  })

  it('does not label ordinary user messages', () => {
    const html = renderToStaticMarkup(
      createElement(UserMessage, {
        message: { role: 'user', createdAt: 1, parts: [{ type: 'text', text: '일반 메시지' }] }
      })
    )
    expect(html).toContain('일반 메시지')
    expect(html).not.toContain('data-message-origin')
  })
})
