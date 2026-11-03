import { afterEach, expect, it, vi } from 'vitest'
import {
  BOOT_TIMING_POLICY,
  createBootSteps,
  defaultBootDependencies,
  runBootSteps,
  type BootStepEvent
} from './steps'
import { backendApi, harnessApi, settingsApi } from '../../shared/api/ipc'
import { chatActions, useChatStore } from '../../features/chat/store/chatStore'
import { useHarnessAvailabilityStore } from '../../shared/stores/harnessAvailabilityStore'

const chatBefore = useChatStore.getState()
const availabilityBefore = useHarnessAvailabilityStore.getState()
afterEach(() => {
  useChatStore.setState(chatBefore, true)
  useHarnessAvailabilityStore.setState(availabilityBefore, true)
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it.each(['missing', 'unsupported', 'failed', undefined] as const)(
  'initializes backend availability before seeding the remembered OpenCode draft (%s), persisting only an automatic fallback',
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
    if (usable) expect(write).not.toHaveBeenCalled()
    else expect(write).toHaveBeenCalledExactlyOnceWith({ lastBackend: 'claude' })
  }
)

it.each(['rejected', 'timed out'] as const)(
  'persists the Claude fallback once for new and project drafts when the backend list is %s',
  async (failure) => {
    vi.useFakeTimers()
    vi.spyOn(harnessApi, 'onAvailability').mockReturnValue(() => {})
    const list = vi.spyOn(backendApi, 'list')
    if (failure === 'rejected') list.mockRejectedValue(new Error('backend list unavailable'))
    else list.mockReturnValue(new Promise(() => {}))
    vi.spyOn(settingsApi, 'get').mockResolvedValue({
      lastBackend: 'opencode',
      lastAgentKind: 'code'
    } as never)
    const write = vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
    const events: BootStepEvent[] = []
    const boot = runBootSteps(
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
      }),
      (event) => events.push(event)
    )
    await vi.advanceTimersByTimeAsync(0)
    if (failure === 'timed out') {
      expect(events.at(-1)).toMatchObject({ id: 'backend', status: 'running' })
      await vi.advanceTimersByTimeAsync(BOOT_TIMING_POLICY.optionalTimeoutMs)
    }
    expect(await boot).toEqual({ landingTarget: '/new' })
    expect(events).toContainEqual(expect.objectContaining({ id: 'backend', status: 'degraded' }))
    expect(list).toHaveBeenCalledOnce()
    expect(useHarnessAvailabilityStore.getState().byId.opencode).toEqual(
      availabilityBefore.byId.opencode
    )
    const currentBackend = () => {
      const state = useChatStore.getState()
      return state.sessions[state.activeKey].session.backend
    }
    expect(currentBackend()).toBe('claude')
    expect(write).toHaveBeenCalledExactlyOnceWith({ lastBackend: 'claude' })
    chatActions.newChat()
    expect(currentBackend()).toBe('claude')
    chatActions.newChat('project', '/repo')
    expect(currentBackend()).toBe('claude')
    expect(write.mock.calls.filter(([patch]) => 'lastBackend' in patch)).toEqual([
      [{ lastBackend: 'claude' }]
    ])
  }
)
