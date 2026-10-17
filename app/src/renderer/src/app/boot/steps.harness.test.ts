import { afterEach, expect, it, vi } from 'vitest'
import { defaultBootDependencies } from './steps'
import { settingsApi } from '../../shared/api/ipc'
import {
  getActiveChatSession,
  seedLandingBackend,
  seedLandingAgentKind
} from '../../features/chat/store/chatStore'
import { installChatStoreHarness } from '../../features/chat/store/chatStore.testHarness'

afterEach(() => {
  seedLandingBackend(null)
  seedLandingAgentKind('work')
  vi.restoreAllMocks()
})

it('applies the persisted harness through boot before seeding Code-only draft kind', async () => {
  installChatStoreHarness({ sessionId: null, backend: 'claude', agentKind: 'work' })
  vi.spyOn(settingsApi, 'get').mockResolvedValue({
    lastBackend: 'opencode',
    lastAgentKind: 'work'
  } as never)
  await defaultBootDependencies.applyLandingAgentKind()
  expect(getActiveChatSession()).toMatchObject({ backend: 'opencode', agentKind: 'code' })
})

it('keeps the loaded session harness when boot restores a different last selection', async () => {
  installChatStoreHarness({ sessionId: 'existing', backend: 'claude', agentKind: 'work' })
  vi.spyOn(settingsApi, 'get').mockResolvedValue({
    lastBackend: 'opencode',
    lastAgentKind: 'code'
  } as never)
  await defaultBootDependencies.applyLandingAgentKind()
  expect(getActiveChatSession()).toMatchObject({ backend: 'claude', agentKind: 'work' })
})
