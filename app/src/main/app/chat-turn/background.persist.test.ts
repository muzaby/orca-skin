import { expect, it, vi } from 'vitest'

const broadcastBackgroundEvent = vi.hoisted(() => vi.fn())
vi.mock('../../infra/ipc/send', () => ({ broadcastBackgroundEvent }))

import type { BackgroundEvent, BackgroundSessionState } from '../../../shared/background-task'
import { CHANNELS } from '../../../shared/ipc'
import { invokeChannel } from '../../infra/ipc/test-transport.testfixture'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import { registerBackgroundHandlers } from './background'
import type { ChatDeps } from './deps'

// 0324 EP-15 — 백그라운드 기록은 저장 스트림(`persistProviderEvent`)으로 가고, 데이터 호스트가 기록한 뒤에만
// 창에 공개한다(AC39 · "기록한 뒤에만 공개").
it('관찰한 기록을 저장 스트림으로 보내고 기록 확인 뒤에만 창에 공개한다', () => {
  let commit: (() => void) | undefined
  const persistProviderEvent = vi.fn((_event: unknown, committed: () => void) => {
    commit = committed
  })
  const controller = registerBackgroundHandlers({
    backgroundTasks: new BackgroundTaskTracker(),
    persistence: { persistProviderEvent },
    supervisor: { peekRuntime: () => undefined },
    loadBackgroundEvents: () => []
  } as unknown as ChatDeps)
  const event = {
    type: 'background.connection',
    sessionId: 'session-B',
    source: { generation: 'g1', sequence: 1, receivedAt: 1, replay: false },
    state: 'connected'
  } as BackgroundEvent
  controller.observe(event)
  expect(persistProviderEvent).toHaveBeenCalledOnce()
  expect(persistProviderEvent.mock.calls[0]![0]).toBe(event)
  expect(broadcastBackgroundEvent).not.toHaveBeenCalled()
  commit!()
  expect(broadcastBackgroundEvent).toHaveBeenCalledExactlyOnceWith(event)
})

// 0324 EP-23 — 기록은 데이터 호스트에 있다. 상태 요청은 그 기록을 받은 뒤에 동기 복원으로 상태를 만든다
// (받기 전에 만들면 앱 재시작 뒤 작업 목록이 빈 채로 보인다).
it('상태 요청은 기록을 받은 뒤 상태를 만든다', async () => {
  const stored: BackgroundEvent = {
    type: 'background.task',
    sessionId: 'session-R',
    source: { generation: 'g1', sequence: 1, receivedAt: 1, replay: false },
    taskId: 'task-restored',
    phase: 'started',
    patch: { status: 'running' }
  }
  const received = new Map<string, BackgroundEvent[]>()
  const prefetchBackgroundEvents = vi.fn(async (sessionId: string) => {
    await Promise.resolve()
    received.set(sessionId, [stored])
  })
  registerBackgroundHandlers({
    backgroundTasks: new BackgroundTaskTracker(),
    persistence: { persistProviderEvent: vi.fn() },
    supervisor: { peekRuntime: () => undefined },
    loadBackgroundEvents: (sessionId: string) => received.get(sessionId) ?? [],
    prefetchBackgroundEvents
  } as unknown as ChatDeps)
  const state = (await invokeChannel(CHANNELS.chatBackgroundState, {
    sessionId: 'session-R'
  })) as BackgroundSessionState
  expect(prefetchBackgroundEvents).toHaveBeenCalledExactlyOnceWith('session-R')
  expect(Object.values(state.tasks).map((task) => task.taskId)).toEqual(['task-restored'])
})
