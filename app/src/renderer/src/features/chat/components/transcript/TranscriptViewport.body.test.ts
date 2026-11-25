import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { HistoryBodyRef } from '../../../../../../shared/history-page'
import { sessionApi } from '../../../../shared/api/ipc'
import { installFakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { DeferredBody } from '../../harnesses/common/transcript/DeferredBody'
import { chatActions, useChatStore } from '../../store/chatStore'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key })
}))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('retries a deferred body from its button and resolves the original message in place', async () => {
  vi.useFakeTimers()
  const parts = [{ type: 'text', text: '다시 연 본문' }]
  const bytes = Buffer.from(JSON.stringify(parts))
  const body: HistoryBodyRef = {
    kind: 'parts',
    session: 's',
    generation: 'published',
    message: 'target',
    bytes: bytes.length
  }
  const messages = ['before', 'target', 'after'].map((id) => ({
    id,
    role: 'assistant' as const,
    createdAt: 1,
    parts: [],
    ...(id === 'target' ? { deferredBody: body } : {})
  }))
  installChatStoreHarness({ messages })
  const original = useChatStore.getState().sessions.s
  useChatStore.setState({
    sessions: {
      s: {
        ...original,
        history: { generation: body.generation, openGeneration: 9 }
      }
    }
  })
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  const open = vi.spyOn(chatActions, 'openHistoryBody')
  const page = vi
    .spyOn(sessionApi, 'page')
    .mockRejectedValueOnce(Error('interrupted'))
    .mockResolvedValueOnce({
      status: 'body',
      sessionId: 's',
      openGeneration: 9,
      requestId: 2,
      offset: 0,
      nextOffset: bytes.length,
      done: true,
      base64: bytes.toString('base64')
    })
  try {
    const element = createElement(DeferredBody, { body })
    dom.render(element)
    dom.click(dom.query('[data-history-body="target"]')!)
    expect(dom.query('[data-history-body="target"]')?.props.disabled).toBe(true)
    expect(await open.mock.results[0].value).toBe(false)
    dom.render(element)
    expect(dom.query('[data-history-body="target"]')?.textContent).toBe(
      'chat.transcript.historyRetry'
    )
    expect(useChatStore.getState().sessions.s.session.messages[1].deferredBody).toBe(body)
    dom.click(dom.query('[data-history-body="target"]')!)
    expect(await open.mock.results[1].value).toBe(true)
    const current = useChatStore.getState().sessions.s.session.messages
    expect(current.map((m) => m.id)).toEqual(['before', 'target', 'after'])
    expect(current[1].deferredBody).toBeUndefined()
    expect(current[1].parts).toEqual(parts)
    expect(page.mock.calls.map(([query]) => query)).toEqual(
      Array(2).fill({
        kind: 'body',
        ref: body,
        sessionId: 's',
        openGeneration: 9,
        offset: 0
      })
    )
  } finally {
    dom.unmount()
  }
})
