import { expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import { registerBackgroundHandlers } from './background'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import type { ChatDeps } from './deps'
import type { BackgroundEventSource } from '../../../shared/background-task'
import { invokeChannel, registeredChannels } from '../../infra/ipc/test-transport.testfixture'

it('registered IPC validates the payload and drives controller through the selected live runtime', async () => {
  const backgroundTask = vi.fn<(id: string) => Promise<boolean>>(async () => true)
  const live = { providerGeneration: 'generation', backgroundTask, stopTask: vi.fn() }
  const peekRuntime = vi.fn((sessionId: string) => (sessionId === 'session' ? live : undefined))
  const controller = registerBackgroundHandlers({
    backgroundTasks: new BackgroundTaskTracker(),
    persistence: { persistProviderEvent: (_event: unknown, done: () => void) => done() },
    supervisor: { peekRuntime },
    loadBackgroundEvents: () => []
  } as unknown as ChatDeps)
  let sequence = 0
  const source = (): BackgroundEventSource => ({
    generation: 'generation',
    sequence: ++sequence,
    receivedAt: sequence,
    replay: false
  })
  controller.observe({
    type: 'background.connection',
    sessionId: 'session',
    source: source(),
    state: 'connected'
  })
  for (const id of ['shell-a', 'shell-b']) {
    controller.observe({
      type: 'background.call',
      sessionId: 'session',
      source: source(),
      toolUseId: id,
      toolName: 'Bash',
      phase: 'started'
    })
    controller.observe({
      type: 'background.task',
      sessionId: 'session',
      source: source(),
      toolUseId: id,
      taskId: `task-${id}`,
      phase: 'started',
      patch: { taskType: 'local_bash', status: 'running', isBackgrounded: false }
    })
  }
  expect(registeredChannels()).toContain(CHANNELS.chatPromoteBackgroundTask)
  const invoke = (req: unknown): Promise<unknown> =>
    invokeChannel(CHANNELS.chatPromoteBackgroundTask, req)
  for (const toolUseId of ['', ' ', '\t'])
    await expect(
      invoke({ sessionId: 'session', generation: 'generation', toolUseId })
    ).rejects.toBeDefined()
  await expect(
    invoke({ sessionId: 'session', generation: 'old', toolUseId: 'shell-a' })
  ).rejects.toThrow()
  expect(backgroundTask).not.toHaveBeenCalled()
  await invoke({ sessionId: 'session', generation: 'generation', toolUseId: 'shell-b' })
  await invoke({ sessionId: 'session', generation: 'generation', toolUseId: 'shell-a' })
  expect(backgroundTask.mock.calls).toEqual([['shell-b'], ['shell-a']])
  expect(peekRuntime).toHaveBeenCalledWith('session')
})
