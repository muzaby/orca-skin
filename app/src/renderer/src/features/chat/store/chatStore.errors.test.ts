import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { errorToastStore } from '../../../shared/errors/errorToastStore'
import { ErrorToastHost } from '../../../shared/ui/ErrorToastHost'

let harness: ReturnType<typeof installChatStoreHarness>
const log = vi.fn()
beforeEach(() => {
  vi.useFakeTimers()
  harness = installChatStoreHarness({
    inflight: false,
    providerKey: 'claude',
    modelFamily: 'sonnet'
  })
  Object.assign(window.orca, {
    log: { error: log },
    session: { load: vi.fn().mockRejectedValue(new Error('load rejected')) }
  })
  log.mockClear()
})
afterEach(() => {
  for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
  errorToastStore.getInitialState().toasts = []
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('chat failures reach the toast host', () => {
  it('rolls back a rejected send, logs once, renders a card and expires it', async () => {
    harness.chatSend.mockRejectedValueOnce(new Error('transport rejected'))
    expect(chatActions.send('hello')).toBe(true)
    expect(useChatStore.getState().sessions.s.session.messages).toHaveLength(1)
    await Promise.resolve()
    expect(useChatStore.getState().sessions.s.session.messages).toHaveLength(0)
    expect(errorToastStore.getState().toasts).toHaveLength(1)
    expect(errorToastStore.getState().toasts[0]).toMatchObject({
      title: 'sendFailed',
      detail: 'transport rejected'
    })
    expect(log).toHaveBeenCalledTimes(1)
    errorToastStore.getInitialState().toasts = errorToastStore.getState().toasts
    expect(renderToStaticMarkup(createElement(ErrorToastHost, { onOpen: vi.fn() }))).toContain(
      'transport rejected'
    )
    vi.advanceTimersByTime(4600)
    expect(errorToastStore.getState().toasts).toEqual([])
  })
  it('drops a failed session load while reporting its failure', async () => {
    await chatActions.loadSession('missing')
    expect(useChatStore.getState().sessions.missing).toBeUndefined()
    expect(errorToastStore.getState().toasts[0]).toMatchObject({
      title: 'sessionOpenFailed',
      detail: 'load rejected'
    })
    expect(log).toHaveBeenCalledTimes(1)
  })
  it('leaves transcript-consumed failures out of the toast stack', () => {
    ingestChatEvent({
      type: 'error',
      sessionId: 's',
      error: { category: 'stream_error', message: 'transcript failure', retryable: false }
    })
    expect(errorToastStore.getState().toasts).toEqual([])
  })
})
