import { expect, it, vi } from 'vitest'

const broadcastBackgroundEvent = vi.hoisted(() => vi.fn())
vi.mock('../../infra/ipc/send', () => ({ broadcastBackgroundEvent }))

import type { BackgroundEvent } from '../../../shared/background-task'
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
