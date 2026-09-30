import type { RuntimeToolServer } from '../../../adapters/runtime-tools'
import { ARCHIVE_MCP_SERVER_ID, ARCHIVE_MCP_TOOLS } from '../../../../shared/mail-archive-plugin'
import type {
  ArchivePluginState,
  ArchiveScopeInput,
  ArchiveReadScope,
  ArchiveEvidenceResult
} from '../../../../shared/mail-archive-plugin'
import type { MailArchiveService } from './service'
import { archivePluginRpc, createArchiveToolServer } from './tools'

interface Backend {
  service: MailArchiveService
  sessionExists(id: string): boolean
  ready: Promise<unknown>
}
let backend: Backend | null = null

// The deployment can construct this server before the core DB is ready. There is only one
// archive writer; both the GUI and the standard Plugin handlers use the installed backend.
const server = createArchiveToolServer(
  {
    async pluginRequest(input) {
      const current = backend
      if (!current) throw new Error('mail_archive_not_ready')
      await current.ready
      if (backend !== current) throw new Error('mail_archive_not_ready')
      const result = await current.service.pluginRequest(input)
      if (backend !== current) throw new Error('mail_archive_not_ready')
      return result
    }
  },
  (id) => {
    if (!backend) throw new Error('mail_archive_not_ready')
    return backend.sessionExists(id)
  }
)

/** Standard Plugin factory. The caller owns registration and keeps this instance across syncs. */
export function createMailArchiveToolServer(): RuntimeToolServer {
  return server
}

export interface MailArchivePlugin {
  ready(): Promise<void>
  state(sessionId?: string): Promise<ArchivePluginState>
  setScope(input: ArchiveScopeInput): Promise<ArchiveReadScope | null>
  resolve(sessionId: string, id: string): Promise<ArchiveEvidenceResult>
  disposeSession(sessionId: string): Promise<void>
  close(): void
}

/** Installs the local backend and IPC lifecycle only. Never adds/removes a runtime server. */
export function initializeMailArchivePlugin(
  service: MailArchiveService,
  sessionExists: (id: string) => boolean,
  sessionIds: () => readonly string[],
  isRegistered: () => boolean
): MailArchivePlugin {
  if (backend) throw new Error('mail_archive_already_initialized')
  const current: Backend = {
    service,
    sessionExists,
    ready: archivePluginRpc(service, { operation: 'prune', sessionIds: sessionIds() })
  }
  backend = current
  const assertOpen = (): void => {
    if (backend !== current) throw new Error('mail_archive_not_ready')
  }
  const assertSession = (id: string): void => {
    assertOpen()
    if (!sessionExists(id)) throw new Error('mail_archive_session_removed')
  }
  return {
    async ready() {
      await current.ready
      assertOpen()
    },
    async state(sessionId) {
      await current.ready
      assertOpen()
      if (sessionId) assertSession(sessionId)
      const stats = await service.stats()
      const scope = sessionId
        ? await archivePluginRpc(service, { operation: 'scope', sessionId })
        : null
      assertOpen()
      if (sessionId) assertSession(sessionId)
      return {
        available: stats.totalMessages > 0,
        registered: isRegistered(),
        serverId: ARCHIVE_MCP_SERVER_ID,
        tools: ARCHIVE_MCP_TOOLS,
        scope: scope
          ? {
              sourceIds: scope.sourceIds,
              ...(scope.sentAfter !== undefined ? { sentAfter: scope.sentAfter } : {}),
              ...(scope.sentBefore !== undefined ? { sentBefore: scope.sentBefore } : {})
            }
          : null
      }
    },
    async setScope(input) {
      await current.ready
      assertSession(input.sessionId)
      const scope = await archivePluginRpc(service, { operation: 'setScope', input })
      if (!sessionExists(input.sessionId)) {
        await archivePluginRpc(service, { operation: 'dispose', sessionId: input.sessionId })
        throw new Error('mail_archive_session_removed')
      }
      assertOpen()
      return scope
    },
    async resolve(sessionId, id) {
      await current.ready
      assertSession(sessionId)
      const lease = await archivePluginRpc(service, { operation: 'scope', sessionId })
      const result = await archivePluginRpc(service, { operation: 'resolve', sessionId, id })
      assertSession(sessionId)
      if (lease) await archivePluginRpc(service, { operation: 'assert', lease })
      assertSession(sessionId)
      return result
    },
    async disposeSession(sessionId) {
      assertOpen()
      await archivePluginRpc(service, { operation: 'dispose', sessionId })
    },
    close() {
      if (backend === current) backend = null
    }
  }
}
