import { afterEach, expect, it, vi } from 'vitest'
import { createBootSteps, defaultBootDependencies, runBootSteps } from './steps'
import { backendApi, harnessApi, settingsApi } from '../../shared/api/ipc'
import { useChatStore } from '../../features/chat/store/chatStore'
import { useHarnessAvailabilityStore } from '../../shared/stores/harnessAvailabilityStore'

const chatBefore = useChatStore.getState()
const availabilityBefore = useHarnessAvailabilityStore.getState()
afterEach(() => {
  useChatStore.setState(chatBefore, true)
  useHarnessAvailabilityStore.setState(availabilityBefore, true)
  vi.restoreAllMocks()
})

it.each(['missing', 'unsupported', 'failed', undefined] as const)(
  'initializes backend availability before seeding the remembered OpenCode draft (%s), without writing settings',
  async (reason) => {
    const usable = reason === undefined
    vi.spyOn(harnessApi, 'onAvailability').mockReturnValue(() => {})
    vi.spyOn(backendApi, 'list').mockResolvedValue({
      backends: [
        { id: 'claude', installed: true, usable: true, capabilities: {} as never },
        {
          id: 'opencode',
          installed: usable,
          usable,
          ...(reason ? { unavailableReason: reason } : {}),
          capabilities: {} as never
        }
      ]
    })
    vi.spyOn(settingsApi, 'get').mockResolvedValue({
      lastBackend: 'opencode',
      lastAgentKind: 'code'
    } as never)
    const write = vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
    await runBootSteps(
      createBootSteps({
        ...defaultBootDependencies,
        whenMainReady: async () => {},
        getBootReport: async () => ({
          startedAt: 1,
          finishedAt: 2,
          durationMs: 1,
          status: 'ok',
          steps: [],
          warnings: []
        }),
        initSessions: async () => {},
        initProjects: async () => {},
        initUsage: async () => {}
      })
    )
    const state = useChatStore.getState()
    expect(state.sessions[state.activeKey].session.backend).toBe(usable ? 'opencode' : 'claude')
    expect(write).not.toHaveBeenCalled()
  }
)
