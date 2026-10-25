import { afterEach, expect, it, vi } from 'vitest'
const reported = vi.hoisted(() => vi.fn())
vi.mock('../../../shared/errors', () => ({ reportError: reported }))
import { installChatStoreHarness } from './chatStore.testHarness'
import { bootstrapChat, chatActions, getActiveChatSession } from './chatStore'
afterEach(() => vi.unstubAllGlobals())
it('persists the picked work path and seeds later drafts', () => {
  const f = installChatStoreHarness({ sessionId: null })
  chatActions.setPendingCwd('C:/selected')
  expect(f.settingsSet).toHaveBeenCalledExactlyOnceWith({ lastCwd: 'C:/selected' })
  expect(getActiveChatSession().cwd).toBe('C:/selected')
  chatActions.newChat()
  expect(getActiveChatSession().cwd).toBe('C:/selected')
  chatActions.newChat('project', 'C:/project')
  expect(getActiveChatSession().cwd).toBe('C:/project')
  chatActions.addExtraDir('C:/reference')
  expect(f.settingsSet.mock.calls.filter(([patch]) => 'lastCwd' in patch)).toHaveLength(1)
  chatActions.newChat()
  expect(getActiveChatSession().cwd).toBe('C:/selected')
})
it('does not remember a path for an established session', () => {
  const f = installChatStoreHarness({ cwd: 'C:/old' })
  chatActions.setPendingCwd('C:/ignored')
  expect(f.settingsSet).not.toHaveBeenCalled()
  expect(getActiveChatSession().cwd).toBe('C:/old')
})

it('keeps the chosen path when the boot query finishes late', async () => {
  const f = installChatStoreHarness({ sessionId: null })
  let finish!: (path: string) => void
  const ready = new Promise<string>((resolve) => {
    finish = resolve
  })
  const unsubscribe = (): void => {}
  Object.assign(window.orca, {
    chat: { ...window.orca.chat, onEvent: () => unsubscribe, onBackgroundEvent: () => unsubscribe },
    session: { cwd: () => ready, onTitle: () => unsubscribe },
    concurrency: { onEvent: () => unsubscribe },
    settings: { get: async () => ({}), set: f.settingsSet }
  })
  const cleanup = bootstrapChat()
  chatActions.setPendingCwd('C:/new-choice')
  finish('C:/old-default')
  await ready
  chatActions.newChat()
  expect(getActiveChatSession().cwd).toBe('C:/new-choice')
  cleanup()
})
it('keeps the chosen draft and reports a failed persistence write', async () => {
  const f = installChatStoreHarness({ sessionId: null })
  f.settingsSet.mockRejectedValueOnce(new Error('disk failure'))
  chatActions.setPendingCwd('C:/still-usable')
  await Promise.resolve()
  expect(getActiveChatSession().cwd).toBe('C:/still-usable')
  expect(reported).toHaveBeenCalledWith(expect.objectContaining({ title: 'saveFailed' }))
  chatActions.newChat()
  expect(getActiveChatSession().cwd).toBe('C:/still-usable')
})

it('treats picking the current path as an explicit choice before a late project seed', () => {
  installChatStoreHarness({ sessionId: null, pendingProjectId: 'project', cwd: 'C:/same' })
  chatActions.setPendingCwd('C:/same')
  chatActions.initializeProjectCwd('project', 'C:/late-project')
  expect(getActiveChatSession().cwd).toBe('C:/same')
})
