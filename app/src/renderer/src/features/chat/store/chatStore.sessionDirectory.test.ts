import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatActions, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import type { AddSessionDirectoryResult } from '../../../../../shared/ipc'

let addDirectory: ReturnType<typeof vi.fn>
beforeEach(() => {
  installChatStoreHarness({ agentKind: 'work' })
  addDirectory = vi.fn().mockResolvedValue({ ok: true, extraDirs: ['C:/canonical'] })
  Object.assign(window.orca, { session: { addDirectory } })
})
const target = { key: 's', sessionId: 's' }
function deferred(): {
  promise: Promise<AddSessionDirectoryResult>
  resolve: (result: AddSessionDirectoryResult) => void
} {
  let resolve!: (result: AddSessionDirectoryResult) => void
  return {
    promise: new Promise<AddSessionDirectoryResult>((done) => {
      resolve = done
    }),
    resolve: (result) => resolve(result)
  }
}

describe('session directory action — bound target and persisted scope', () => {
  it('uses the typed bridge and merges only successful canonical results', async () => {
    expect(await chatActions.addSessionDirectory(target, 'C:/chosen')).toEqual({
      ok: true,
      extraDirs: ['C:/canonical']
    })
    expect(addDirectory).toHaveBeenCalledWith({ sessionId: 's', directory: 'C:/chosen' })
    expect(useChatStore.getState().sessions.s.session.extraDirs).toEqual(['C:/canonical'])
  })
  it('rejects a picker result after switching session before IPC', async () => {
    useChatStore.setState({ activeKey: 'other' })
    expect(await chatActions.addSessionDirectory(target, 'C:/chosen')).toEqual({
      ok: false,
      reason: 'not-found'
    })
    expect(addDirectory).not.toHaveBeenCalled()
  })
  it.each([{ inflight: true }, { listening: true }, { loadingSession: true }])(
    'rejects busy state %j before IPC',
    async (patch) => {
      const entry = useChatStore.getState().sessions.s
      useChatStore.setState({
        sessions: { s: { ...entry, session: { ...entry.session, ...patch } } }
      })
      expect(await chatActions.addSessionDirectory(target, 'C:/chosen')).toEqual({
        ok: false,
        reason: 'busy'
      })
      expect(addDirectory).not.toHaveBeenCalled()
    }
  )
  it('does not apply a late response to the new active session', async () => {
    const gate = deferred()
    addDirectory.mockReturnValue(gate.promise)
    const operation = chatActions.addSessionDirectory(target, 'C:/chosen')
    const original = useChatStore.getState().sessions.s
    useChatStore.setState({
      activeKey: 'other',
      sessions: {
        s: original,
        other: { ...original, session: { ...original.session, sessionId: 'other' } }
      }
    })
    gate.resolve({ ok: true, extraDirs: ['C:/canonical'] })
    await operation
    expect(useChatStore.getState().sessions.s.session.extraDirs).toEqual(['C:/canonical'])
    expect(useChatStore.getState().sessions.other.session.extraDirs).toEqual([])
  })
  it('never recreates an entry deleted during IPC', async () => {
    const gate = deferred()
    addDirectory.mockReturnValue(gate.promise)
    const operation = chatActions.addSessionDirectory(target, 'C:/chosen')
    useChatStore.setState({ sessions: {} })
    gate.resolve({ ok: true, extraDirs: ['C:/canonical'] })
    await operation
    expect(useChatStore.getState().sessions).toEqual({})
  })
  it('preserves additions when successful responses arrive in reverse order', async () => {
    const first = deferred()
    const second = deferred()
    addDirectory.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const operations = [
      chatActions.addSessionDirectory(target, 'C:/a'),
      chatActions.addSessionDirectory(target, 'C:/b')
    ]
    second.resolve({ ok: true, extraDirs: ['C:/a', 'C:/b'] })
    await operations[1]
    first.resolve({ ok: true, extraDirs: ['C:/a'] })
    await operations[0]
    expect(useChatStore.getState().sessions.s.session.extraDirs).toEqual(['C:/a', 'C:/b'])
  })
  it.each(['busy', 'not-work', 'limit', 'failed', 'invalid-directory', 'not-found'] as const)(
    'preserves the scope and returns %s',
    async (reason) => {
      addDirectory.mockResolvedValue({ ok: false, reason })
      expect(await chatActions.addSessionDirectory(target, 'C:/chosen')).toEqual({
        ok: false,
        reason
      })
      expect(useChatStore.getState().sessions.s.session.extraDirs).toEqual([])
    }
  )
  it('returns a visible failure reason for IPC rejection', async () => {
    addDirectory.mockRejectedValue(new Error('ipc gone'))
    expect(await chatActions.addSessionDirectory(target, 'C:/chosen')).toEqual({
      ok: false,
      reason: 'failed'
    })
  })
  it('restores allowed directories from LoadedSession', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        title: null,
        messages: [],
        agentKind: 'work',
        extraDirs: ['C:/restored']
      }
    })
    expect(loaded.extraDirs).toEqual(['C:/restored'])
  })
})
