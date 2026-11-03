import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { ChatProvider } from './ChatProvider'
import * as chat from '../store/chatStore'
import { useHarnessAvailabilityStore } from '../../../shared/stores/harnessAvailabilityStore'
import { settingsApi } from '../../../shared/api/ipc'
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('reseeds an ordinary OpenCode draft from actual provider subscription and stops on unmount', () => {
  const dom = installFakeDom({ innerWidth: 1000, innerHeight: 700 })
  const before = chat.useChatStore.getState()
  vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
  vi.spyOn(chat, 'bootstrapChat').mockReturnValue(() => {})
  const change = (usable: boolean): void => {
    useHarnessAvailabilityStore.setState(({ byId }) => ({
      byId: {
        ...byId,
        opencode: {
          id: 'opencode',
          installed: usable,
          usable,
          ...(!usable ? { unavailableReason: 'missing' as const } : {})
        }
      }
    }))
  }
  try {
    change(true)
    chat.seedLandingBackend('opencode')
    chat.chatActions.newChat()
    dom.render(createElement(ChatProvider, null, null))
    expect(chat.getActiveChatSession().backend).toBe('opencode')
    change(false)
    expect(chat.getActiveChatSession().backend).toBe('claude')
    dom.unmount()
    change(true)
    chat.seedLandingBackend('opencode')
    chat.chatActions.newChat()
    change(false)
    expect(chat.getActiveChatSession().backend).toBe('opencode')
  } finally {
    dom.unmount()
    chat.seedLandingBackend('claude')
    chat.useChatStore.setState(before, true)
  }
})
