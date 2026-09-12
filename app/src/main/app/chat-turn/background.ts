import { app } from 'electron'
import { join } from 'node:path'
import { CHANNELS } from '../../../shared/ipc'
import {
  BackgroundStateSchema,
  StopBackgroundTaskSchema,
  PromoteBackgroundTaskSchema,
  StopAllBackgroundTasksSchema,
  ReadBackgroundOutputSchema
} from '../../../shared/protocol'
import { BackgroundController } from '../../features/chat/background-controller'
import { BackgroundOutputStore } from '../../infra/background-output'
import { getTemporaryFilesPath } from '../../infra/config/temp-path'
import { broadcastBackgroundEvent } from '../../infra/ipc/send'
import { handle } from '../../infra/ipc/handle'
import type { ChatDeps } from './deps'

export function registerBackgroundHandlers(deps: ChatDeps): BackgroundController {
  const store = (): BackgroundOutputStore =>
    new BackgroundOutputStore(join(app.getPath('userData'), 'background-outputs'))
  const controller = new BackgroundController({
    tracker: deps.backgroundTasks,
    persist: (event, committed) => deps.persistence.persistProviderEvent(event, committed),
    load: (sessionId) => deps.ctx.db.background?.list(sessionId) ?? [],
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
    },
    roots: (sessionId) => {
      const row = deps.ctx.db.getSessionById(sessionId)
      if (!row) return []
      const extra: unknown = row.extra_dirs ? JSON.parse(row.extra_dirs) : []
      return [
        ...(row.cwd ? [row.cwd] : []),
        ...(Array.isArray(extra)
          ? extra.filter((item): item is string => typeof item === 'string')
          : []),
        getTemporaryFilesPath()
      ]
    },
    outputs: {
      read: (...args) => store().read(...args),
      capture: (...args) => store().capture(...args),
      readSnapshot: (...args) => store().readSnapshot(...args),
      removeSnapshot: (id) => store().removeSnapshot(id)
    }
  })
  handle(CHANNELS.chatBackgroundState, BackgroundStateSchema, 'reject', (req) =>
    controller.state(req.sessionId)
  )
  handle(CHANNELS.chatStopBackgroundTask, StopBackgroundTaskSchema, 'reject', (req) =>
    controller.stop(req)
  )
  handle(CHANNELS.chatPromoteBackgroundTask, PromoteBackgroundTaskSchema, 'reject', (req) =>
    controller.promote(req)
  )
  handle(CHANNELS.chatStopAllBackgroundTasks, StopAllBackgroundTasksSchema, 'reject', (req) =>
    controller.stopAll(req)
  )
  handle(CHANNELS.chatReadBackgroundOutput, ReadBackgroundOutputSchema, 'reject', (req) =>
    controller.read(req)
  )
  return controller
}
