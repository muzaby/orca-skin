import { afterEach, expect, it, vi } from 'vitest'
import { chatActions, getActiveChatSession, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
afterEach(() => vi.unstubAllGlobals())
const setup = (): ReturnType<typeof installChatStoreHarness> => {
  const ipc = installChatStoreHarness()
  chatActions.newChat('old-id', 'C:/old')
  chatActions.setModel('native', 'sentinel/model', 'Model', 'opencode')
  return ipc
}
it('selects cwd and project together, resets repository context and sends both on the first message', () => {
  const { chatSend, settingsSet } = setup()
  chatActions.addExtraDir('C:/reference')
  chatActions.setWorktreeIsolation(true)
  chatActions.setWorktreeBaseRef('old-branch')
  const target = chatActions.capturePendingProjectTarget()!
  expect(chatActions.selectPendingProject({ cwd: 'D:/new', projectId: 'new-id' }, target)).toBe(
    true
  )
  expect(getActiveChatSession()).toMatchObject({
    cwd: 'D:/new',
    pendingProjectId: 'new-id',
    extraDirs: [],
    worktreeIsolation: false,
    worktreeBaseRef: null,
    backend: 'opencode'
  })
  expect(settingsSet).toHaveBeenCalledWith({ lastCwd: 'D:/new' })
  expect(chatActions.send('first with context')).toBe(true)
  expect(chatSend.mock.calls[0][0]).toMatchObject({
    text: 'first with context',
    cwd: 'D:/new',
    projectId: 'new-id'
  })
  expect(chatActions.selectPendingProject({ cwd: 'E:/stale', projectId: null }, target)).toBe(false)
})
it('keeps references and worktree settings on same-directory reselection', () => {
  setup()
  chatActions.addExtraDir('C:/reference')
  chatActions.setWorktreeIsolation(true)
  chatActions.setWorktreeBaseRef('keep-branch')
  chatActions.selectPendingProject(
    { cwd: 'c:\\OLD\\', projectId: 'old-id' },
    chatActions.capturePendingProjectTarget()!
  )
  expect(getActiveChatSession()).toMatchObject({
    extraDirs: ['C:/reference'],
    worktreeIsolation: true,
    worktreeBaseRef: 'keep-branch'
  })
})
it('rejects filesystem roots without persisting them or changing the project', () => {
  const { settingsSet } = setup()
  settingsSet.mockClear()
  expect(
    chatActions.selectPendingProject(
      { cwd: 'C:/', projectId: null },
      chatActions.capturePendingProjectTarget()!
    )
  ).toBe(false)
  chatActions.setPendingCwd('D:/')
  expect(getActiveChatSession()).toMatchObject({
    cwd: 'C:/old',
    pendingProjectId: 'old-id',
    extraDirRejection: 'root'
  })
  expect(settingsSet).not.toHaveBeenCalled()
})
it('rejects a reused draft key, busy/loading drafts, and deleted project IDs', () => {
  setup()
  const old = chatActions.capturePendingProjectTarget()!
  chatActions.newChat(null, 'E:/replacement')
  expect(chatActions.selectPendingProject({ cwd: 'D:/late', projectId: null }, old)).toBe(false)
  const current = chatActions.capturePendingProjectTarget()!
  for (const patch of [
    { loadingSession: true },
    { inflight: true },
    { listening: true },
    { sessionId: 'started' }
  ]) {
    const state = useChatStore.getState()
    const entry = state.sessions[state.activeKey]
    useChatStore.setState({
      sessions: {
        ...state.sessions,
        [state.activeKey]: { ...entry, session: { ...entry.session, ...patch } }
      }
    })
    expect(chatActions.selectPendingProject({ cwd: 'D:/late', projectId: null }, current)).toBe(
      false
    )
    useChatStore.setState({ sessions: state.sessions })
  }
  chatActions.detachProject('deleted-selection')
  expect(
    chatActions.selectPendingProject({ cwd: 'D:/late', projectId: 'deleted-selection' }, current)
  ).toBe(false)
  expect(getActiveChatSession().cwd).toBe('E:/replacement')
})
