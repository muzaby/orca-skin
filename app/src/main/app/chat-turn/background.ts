import { CHANNELS } from '../../../shared/ipc'
import {
  BackgroundStateSchema,
  StopBackgroundTaskSchema,
  PromoteBackgroundTaskSchema
} from '../../../shared/protocol'
import { BackgroundController } from '../../features/chat/background-controller'
import { broadcastBackgroundEvent } from '../../infra/ipc/send'
import { handle } from '../../infra/ipc/handle'
import type { ChatDeps } from './deps'

export function registerBackgroundHandlers(deps: ChatDeps): BackgroundController {
  const controller = new BackgroundController({
    tracker: deps.backgroundTasks,
    persist: (event, committed) => deps.persistence.persistProviderEvent(event, committed),
    load: deps.loadBackgroundEvents,
    publish: broadcastBackgroundEvent,
    runtime: (sessionId) => {
      const live = deps.supervisor.peekRuntime(sessionId)
      return live
        ? {
            identity: live,
            generation: live.providerGeneration,
            stopTask: (taskId) => live.stopTask(taskId),
            backgroundTask: (toolUseId) => live.backgroundTask(toolUseId)
          }
        : undefined
    }
  })
  handle(CHANNELS.chatBackgroundState, BackgroundStateSchema, 'reject', async (req) => {
    // 기록은 다른 프로세스에 있을 수 있다(0324) — 동기 복원 읽기 전에 사본을 채운다.
    await deps.prefetchBackgroundEvents?.(req.sessionId)
    return controller.state(req.sessionId)
  })
  handle(CHANNELS.chatStopBackgroundTask, StopBackgroundTaskSchema, 'reject', (req) =>
    controller.stop(req)
  )
  handle(CHANNELS.chatPromoteBackgroundTask, PromoteBackgroundTaskSchema, 'reject', (req) =>
    controller.promote(req)
  )
  return controller
}
