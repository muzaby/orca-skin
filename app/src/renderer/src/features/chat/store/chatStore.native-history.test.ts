import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { LoadedSession } from '../../../../../shared/ipc'
import * as errors from '../../../shared/errors'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function snapshot(
  text = 'native addition',
  nativeSync?: LoadedSession['nativeSync']
): LoadedSession {
  return {
    id: 's',
    backend: 'opencode',
    agentKind: 'code',
    title: 'native title',
    messages: [{ role: 'assistant', createdAt: 2, parts: [{ type: 'text', text }] }],
    ...(nativeSync ? { nativeSync } : {})
  }
}

const load = vi.fn<() => Promise<LoadedSession | null>>()
let harness: ReturnType<typeof installChatStoreHarness>
let report: MockInstance<typeof errors.reportError>

function leaveSession(): void {
  useChatStore.setState({ activeKey: 'other' })
}

beforeEach(() => {
  harness = installChatStoreHarness({
    backend: 'opencode',
    agentKind: 'code',
    inflight: false,
    title: 'cached title',
    messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'cached body' }] }],
    permissionMode: 'accept_edits',
    modelFamily: 'selected-model',
    agentPanelInitialized: true,
    rightPanelTiles: [{ id: 'custom', tiles: ['process'] }],
    selectedProcessToolId: 'shell',
    rightPanelColWidths: [420]
  })
  const original = useChatStore.getState().sessions.s
  useChatStore.setState({
    sessions: {
      s: original,
      other: { ...original, session: { ...original.session, sessionId: 'other' } }
    },
    activeKey: 'other'
  })
  load.mockReset().mockResolvedValue(snapshot())
  Object.assign(window.orca, { session: { load } })
  report = vi.spyOn(errors, 'reportError').mockImplementation(() => {})
})

afterEach(() => {
  flushRaf()
  vi.restoreAllMocks()
})

describe('native history refresh on cached session reopen', () => {
  it('keeps the cached screen during IPC and refreshes history without resetting model or panel state', async () => {
    const pending = deferred<LoadedSession>()
    load.mockReturnValueOnce(pending.promise)
    const before = useChatStore.getState().sessions.s
    const operation = chatActions.loadSession('s')
    expect(load).toHaveBeenCalledWith('s')
    expect(useChatStore.getState().activeKey).toBe('s')
    expect(useChatStore.getState().sessions.s).toBe(before)
    expect(before.session.loadingSession).toBe(false)
    pending.resolve(snapshot())
    await operation
    const after = useChatStore.getState().sessions.s
    expect(after.session.messages).toEqual(snapshot().messages)
    expect(after.session).toMatchObject({
      title: 'native title',
      permissionMode: 'accept_edits',
      modelFamily: 'selected-model',
      selectedProcessToolId: 'shell'
    })
    expect(after.session.rightPanelTiles).toBe(before.session.rightPanelTiles)
    expect(after.session.rightPanelColWidths).toBe(before.session.rightPanelColWidths)
    expect(after.live).toBe(before.live)
    expect(report).not.toHaveBeenCalled()
  })

  it('reloads after leaving and returning, while an active-session re-click remains a no-op', async () => {
    await chatActions.loadSession('s')
    await chatActions.loadSession('s')
    expect(load).toHaveBeenCalledTimes(1)
    leaveSession()
    load.mockResolvedValueOnce(snapshot('second terminal addition'))
    await chatActions.loadSession('s')
    expect(load).toHaveBeenCalledTimes(2)
    expect(useChatStore.getState().sessions.s.session.messages).toEqual(
      snapshot('second terminal addition').messages
    )
  })

  it('accepts only the newest request for the same session', async () => {
    const old = deferred<LoadedSession>()
    const current = deferred<LoadedSession>()
    load.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const first = chatActions.loadSession('s')
    leaveSession()
    const second = chatActions.loadSession('s')
    current.resolve(snapshot('newest'))
    await second
    const accepted = useChatStore.getState().sessions.s
    old.resolve(snapshot('stale'))
    await first
    expect(useChatStore.getState().sessions.s).toBe(accepted)
    expect(accepted.session.messages).toEqual(snapshot('newest').messages)
  })

  it('does not report a rejected older request after a newer refresh has completed', async () => {
    const old = deferred<LoadedSession>()
    load.mockReturnValueOnce(old.promise)
    const first = chatActions.loadSession('s')
    leaveSession()
    await chatActions.loadSession('s')
    old.reject(new Error('obsolete failure'))
    await first
    expect(report).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'] as const)(
    'does not resurrect a removed session after a late %s',
    async (outcome) => {
      const pending = deferred<LoadedSession>()
      load.mockReturnValueOnce(pending.promise)
      const operation = chatActions.loadSession('s')
      chatActions.handleSessionDeleted('s')
      if (outcome === 'resolve') pending.resolve(snapshot())
      else pending.reject(new Error('removed'))
      await operation
      expect(useChatStore.getState().sessions.s).toBeUndefined()
      expect(report).not.toHaveBeenCalled()
    }
  )

  it('rejects a snapshot after a completed live message', async () => {
    const pending = deferred<LoadedSession>()
    load.mockReturnValueOnce(pending.promise)
    const operation = chatActions.loadSession('s')
    ingestChatEvent({ type: 'message.completed', sessionId: 's', message: { text: 'live answer' } })
    const live = useChatStore.getState().sessions.s
    pending.resolve(snapshot('obsolete archive'))
    await operation
    expect(useChatStore.getState().sessions.s).toBe(live)
    expect(live.session.messages.at(-1)?.parts).toContainEqual({
      type: 'text',
      text: 'live answer'
    })
  })

  it('rejects a snapshot even before an already received delta reaches its animation frame', async () => {
    const pending = deferred<LoadedSession>()
    load.mockReturnValueOnce(pending.promise)
    const operation = chatActions.loadSession('s')
    ingestChatEvent({ type: 'message.delta', sessionId: 's', delta: { text: 'buffered live' } })
    pending.resolve(snapshot('obsolete archive'))
    await operation
    expect(useChatStore.getState().sessions.s.session.messages[0].parts).toEqual([
      { type: 'text', text: 'cached body' }
    ])
    flushRaf()
    expect(useChatStore.getState().sessions.s.live.text).toBe('buffered live')
  })

  it('flushes live data received before the refresh and preserves an already active runtime', async () => {
    ingestChatEvent({ type: 'message.delta', sessionId: 's', delta: { text: 'already running' } })
    await chatActions.loadSession('s')
    expect(load).toHaveBeenCalledTimes(1)
    expect(useChatStore.getState().sessions.s.live.text).toBe('already running')
    expect(useChatStore.getState().sessions.s.session.messages[0].parts).toEqual([
      { type: 'text', text: 'cached body' }
    ])
  })

  it('preserves an optimistic send made while a refresh is pending', async () => {
    const pending = deferred<LoadedSession>()
    load.mockReturnValueOnce(pending.promise)
    const operation = chatActions.loadSession('s')
    expect(chatActions.send('new input')).toBe(true)
    const sent = useChatStore.getState().sessions.s
    pending.resolve(snapshot('old answer'))
    await operation
    expect(useChatStore.getState().sessions.s).toBe(sent)
    expect(harness.chatSend).toHaveBeenCalledTimes(1)
  })

  it('retains the cached history and reports an IPC failure, then allows a later retry', async () => {
    const before = useChatStore.getState().sessions.s
    load.mockRejectedValueOnce(new Error('unreadable native store'))
    await chatActions.loadSession('s')
    expect(useChatStore.getState().sessions.s).toBe(before)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chat.session-load.failed',
        title: 'sessionOpenFailed',
        error: expect.any(Error)
      })
    )
    leaveSession()
    await chatActions.loadSession('s')
    expect(useChatStore.getState().sessions.s.session.messages).toEqual(snapshot().messages)
  })

  it.each(['missing', 'unavailable', 'migration-required'] as const)(
    'shows the retained archive and reports native %s',
    async (status) => {
      load.mockResolvedValueOnce(
        snapshot('last good snapshot and tail', { status, message: 'native warning' })
      )
      await chatActions.loadSession('s')
      expect(useChatStore.getState().sessions.s.session.messages).toEqual(
        snapshot('last good snapshot and tail').messages
      )
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'chat.session-load.failed',
          detail: 'native warning'
        })
      )
    }
  )

  it('does not toast for busy, but surfaces a ready snapshot with unassigned archive metadata', async () => {
    load.mockResolvedValueOnce(snapshot('cached', { status: 'busy', message: 'still active' }))
    await chatActions.loadSession('s')
    expect(report).not.toHaveBeenCalled()
    leaveSession()
    load.mockResolvedValueOnce(
      snapshot('native', { status: 'ready', message: 'archive metadata retained' })
    )
    await chatActions.loadSession('s')
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'archive metadata retained' })
    )
  })

  it('does not change the current selection or saved last session when another session is opened', async () => {
    const pending = deferred<LoadedSession>()
    load.mockReturnValueOnce(pending.promise)
    const operation = chatActions.loadSession('s')
    leaveSession()
    harness.settingsSet.mockClear()
    pending.resolve(snapshot())
    await operation
    expect(useChatStore.getState().activeKey).toBe('other')
    expect(harness.settingsSet).not.toHaveBeenCalled()
    expect(useChatStore.getState().sessions.s.session.messages).toEqual(snapshot().messages)
  })

  it('finishes the loading state without replacing live data that arrived during a cold load', async () => {
    chatActions.invalidateSessionCache('s')
    const pending = deferred<LoadedSession>()
    load.mockReturnValueOnce(pending.promise)
    const operation = chatActions.loadSession('s')
    ingestChatEvent({ type: 'message.completed', sessionId: 's', message: { text: 'fresh live' } })
    pending.resolve(snapshot('stale'))
    await operation
    const session = useChatStore.getState().sessions.s.session
    expect(session.loadingSession).toBe(false)
    expect(session.messages[0].parts).toContainEqual({ type: 'text', text: 'fresh live' })
  })
})
