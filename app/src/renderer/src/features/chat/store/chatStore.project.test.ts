import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bootstrapChat,
  chatActions,
  ingestChatEvent,
  NEW_CHAT_KEY,
  useChatStore
} from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'

beforeEach(() => {
  installChatStoreHarness({ inflight: false })
})
const current = (): ReturnType<typeof useChatStore.getState>['sessions'][string]['session'] => {
  const state = useChatStore.getState()
  return state.sessions[state.activeKey].session
}

describe('project landing cwd', () => {
  it('uses the selected project cwd and changes it when entering another project', () => {
    chatActions.newChat('a', 'C:\\A\\Demo')
    expect(current()).toMatchObject({ pendingProjectId: 'a', cwd: 'C:\\A\\Demo' })
    chatActions.newChat('b', 'C:\\B\\Demo')
    expect(current()).toMatchObject({ pendingProjectId: 'b', cwd: 'C:\\B\\Demo' })
  })
  it('seeds a late catalog result only once and preserves a manually selected folder', () => {
    chatActions.newChat('a')
    chatActions.initializeProjectCwd('a', 'C:\\A')
    chatActions.initializeProjectCwd('a', 'C:\\B')
    expect(current().cwd).toBe('C:\\A')
    chatActions.newChat('b')
    chatActions.setPendingCwd('C:\\Chosen')
    chatActions.initializeProjectCwd('b', 'C:\\B')
    expect(current().cwd).toBe('C:\\Chosen')
    chatActions.initializeProjectCwd('elsewhere', 'C:\\Wrong')
    expect(current().pendingProjectId).toBe('b')
  })
  it('a late Desktop response does not change a project path or a loaded session', async () => {
    let resolve!: (cwd: string) => void
    const ready = new Promise<string>((finish) => {
      resolve = finish
    })
    const unsubscribe = (): void => {}
    vi.stubGlobal('window', {
      orca: {
        chat: { onEvent: () => unsubscribe },
        session: { cwd: () => ready, onTitle: () => unsubscribe },
        settings: { get: async () => ({}), set: async () => ({}) },
        concurrency: { onEvent: () => unsubscribe }
      }
    })
    chatActions.newChat('a', 'C:\\Project')
    const cleanup = bootstrapChat()
    resolve('C:\\OneDrive\\Desktop')
    await ready
    expect(current().cwd).toBe('C:\\Project')
    expect(useChatStore.getState().sessions.s.session.cwd).toBeNull()
    chatActions.newChat()
    expect(current().cwd).toBe('C:\\OneDrive\\Desktop')
    cleanup()
  })
  it('accepts the main-created project ID and preserves it when later patches omit it', () => {
    chatActions.newChat()
    useChatStore.setState({ pendingNewChatKey: NEW_CHAT_KEY })
    ingestChatEvent({
      type: 'session.updated',
      sessionId: 'created',
      patch: { cwd: 'C:\\A', projectId: 'path-project' }
    })
    expect(current()).toMatchObject({
      sessionId: 'created',
      projectId: 'path-project',
      pendingProjectId: null
    })
    ingestChatEvent({ type: 'session.updated', sessionId: 'created', patch: { model: 'later' } })
    expect(current().projectId).toBe('path-project')
  })
  it('increments the catalog refresh epoch when a pending session is confirmed in the background', () => {
    chatActions.newChat()
    useChatStore.setState({ pendingNewChatKey: NEW_CHAT_KEY, activeKey: 's' })
    ingestChatEvent({
      type: 'session.updated',
      sessionId: 'background',
      patch: { cwd: 'C:\\Background', projectId: 'background-project' }
    })
    const state = useChatStore.getState()
    expect(state.activeKey).toBe('s')
    expect(state.sessions.s.session.projectId).toBeNull()
    expect(state.sessions.background.session.projectId).toBe('background-project')
    expect(state.recentsEpoch).toBe(1)
    ingestChatEvent({ type: 'session.updated', sessionId: 'background', patch: { model: 'later' } })
    expect(useChatStore.getState().recentsEpoch).toBe(1)
  })
})
