import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import { StatusLine } from './StatusLine'

vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

it('0243 AC8 — interrupted 상태에서 진행 표시와 스파크 스피너가 렌더되지 않는다', () => {
  const after = chatReducer(
    { ...initialChatState, inflight: true, turnStartedAt: 100 },
    {
      type: 'RECV_EVENT',
      event: { type: 'turn.aborted', sessionId: 's1', reason: 'interrupted' }
    }
  )
  expect(
    renderToStaticMarkup(createElement(StatusLine, { turnStartedAt: after.turnStartedAt }))
  ).toBe('')
})
