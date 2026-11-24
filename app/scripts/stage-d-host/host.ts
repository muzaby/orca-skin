import { serialize } from 'node:v8'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { wrapPort, type ParentPort } from '../../src/main/app/host-runtime'
import { createPortTransport } from '../../src/main/app/host-port-server'
import { setIpcTransport } from '../../src/main/infra/ipc/transport'
import { applyMigrations } from '../../src/main/infra/db/migrate'
import { DbQueries } from '../../src/main/infra/db/queries'
import { ArtifactCatalog } from '../../src/main/features/artifacts/catalog'
import { ScheduledTaskService } from '../../src/main/features/scheduled-tasks/service'
import { registerFilesHandlers } from '../../src/main/app/handlers/files'
import { registerSessionHandlers } from '../../src/main/app/handlers/session'
import { registerProjectHandlers } from '../../src/main/app/handlers/project'
import { registerArtifactHandlers } from '../../src/main/app/handlers/artifacts'
import { registerScheduledTaskHandlers } from '../../src/main/app/handlers/scheduled-tasks'
import { CHANNELS } from '../../src/shared/ipc'

const cwd = process.argv[2]
const parent = (process as typeof process & { parentPort: ParentPort }).parentPort
const database = new Database(':memory:')
database.pragma('foreign_keys = ON')
applyMigrations(database)
const db = new DbQueries(database)
const unavailable = (): never => {
  throw new Error('Diagnostic uses read-only channels')
}
const allowed = new Set<string>([
  CHANNELS.filesList,
  CHANNELS.sessionList,
  CHANNELS.projectList,
  CHANNELS.projectListSessions,
  CHANNELS.artifactCatalog,
  CHANNELS.scheduleListRuns,
  CHANNELS.scheduleList
])

database.transaction(() => {
  for (let index = 0; index < 100; index++) {
    const id = 'project-' + index
    db.insertProject({ id, name: 'Project ' + index, instructions: '', createdAt: index })
    if (index % 10 === 0) db.setProjectPinned(id, index)
  }
  for (let index = 0; index < 10_000; index++) {
    const id = 'session-' + index
    db.insertSession({
      id,
      title: 'Review ' + index,
      projectId: 'project-0',
      backend: 'claude',
      createdAt: index
    })
    if (index % 10 === 0) db.setSessionPinned(id, index)
    db.artifacts.createPublication({
      publicationId: 'publication-' + index,
      artifactFileId: 'artifact-' + index,
      sessionId: id,
      inputSource: join(cwd, 'source-' + index + '.md'),
      relativePath: 'artifact-' + index + '/plan.md',
      filename: 'plan.md',
      title: 'Plan ' + index,
      kind: 'markdown',
      sizeBytes: index,
      hash: 'fixture',
      publishedAt: index
    })
  }
  for (let index = 0; index < 100; index++) {
    db.scheduledTasks.insertTask({
      id: 'task-' + index,
      title: 'Task ' + index,
      projectId: 'project-0',
      trigger: { kind: 'hourly' },
      action: { kind: 'shell', command: 'fixture' },
      enabled: index % 2 === 0,
      createdAt: index,
      updatedAt: index
    })
  }
  const output = ('a'.repeat(63) + '\n').repeat(1024)
  for (let index = 0; index < 50; index++) {
    const id = db.scheduledTasks.insertRun(
      { taskId: 'task-0', origin: 'schedule', startedAt: index },
      50
    )
    db.scheduledTasks.finishRun({
      id,
      finishedAt: index + 1,
      status: index % 4 ? 'success' : 'error',
      output,
      outputTruncated: true
    })
  }
})()

const transport = createPortTransport()
const responseSizes = new Map<string, number>()
setIpcTransport({
  ...transport,
  handle(channel, listener) {
    if (!allowed.has(channel)) return
    transport.handle(channel, async (event, payload) => {
      const started = performance.now()
      const value = await listener(event, payload)
      const T1 = performance.now() - started
      const key = JSON.stringify([channel, payload])
      let C1 = responseSizes.get(key)
      if (C1 === undefined) {
        // Immutable fixtures use the warmup reply to size the serialized response once.
        C1 = serialize(value).byteLength
        responseSizes.set(key, C1)
      }
      return { value, T1, C1 }
    })
  }
})
const getCwd = (): string => cwd
registerFilesHandlers({ db, getCwd })
registerSessionHandlers({ db, getCwd, settings: { getAll: unavailable, patch: unavailable } })
registerProjectHandlers({ db })
registerArtifactHandlers(
  {
    listLatest: unavailable,
    status: unavailable,
    preview: unavailable,
    trash: unavailable,
    readForExport: unavailable,
    revealPath: unavailable,
    openFolderPath: unavailable
  },
  (event) => event.trusted,
  new ArtifactCatalog(db.artifacts)
)
registerScheduledTaskHandlers(
  new ScheduledTaskService({
    store: db.scheduledTasks,
    projects: db,
    runner: {
      fire: unavailable,
      isRunning: () => false,
      cancel: unavailable,
      reconcileStaleRuns: unavailable
    },
    startCron: unavailable,
    onChanged: unavailable
  }),
  { report: unavailable }
)

parent.on('message', ({ ports }) => {
  const port = ports[0]
  if (!port) return
  transport.connect(wrapPort(port), { clientId: 1, trusted: true })
  parent.postMessage('connected')
})
parent.postMessage('ready')
