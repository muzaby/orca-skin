import { isAbsolute } from 'node:path'
import type { ComposerCatalogLease, ComposerCatalogScope } from '../../shared/composer-catalog'
import type { RouterContext } from './context'
import { resolveTurnProvider } from './chat-turn/resolve-turn'
import { registerComposerCatalogHandlers } from './handlers/composer-catalog'
import { ComposerCatalogError } from './composer-catalog-error'

export async function prepareComposerCatalog(
  ctx: RouterContext,
  scope: ComposerCatalogScope,
  signal: AbortSignal
): Promise<ComposerCatalogLease> {
  const adapter = ctx.registry.get(scope.backend)
  if (!adapter?.prepareComposer) throw new Error('Composer preparation unavailable')
  const session = scope.sessionId ? ctx.db.getSessionById(scope.sessionId) : undefined
  if (
    scope.sessionId &&
    (!session || session.backend !== scope.backend || session.agent_kind !== scope.agentKind)
  )
    throw new Error('Composer session changed')
  const directory = session
    ? (session.cwd ?? ctx.getCwd(session.project_id))
    : (scope.cwd ?? ctx.getCwd(scope.projectId))
  if (!isAbsolute(directory)) throw new Error('Composer directory must be absolute')
  signal.throwIfAborted()
  const resolved = await resolveTurnProvider(ctx, {
    adapter,
    agentKind: scope.agentKind,
    sessionId: scope.sessionId,
    providerKey: scope.providerKey,
    modelFamily: null
  }).catch((error: unknown) => {
    throw new ComposerCatalogError('configuration', error)
  })
  signal.throwIfAborted()
  if (session) {
    const current = ctx.db.getSessionById(session.id)
    if (
      !current ||
      current.backend !== session.backend ||
      current.agent_kind !== session.agent_kind ||
      current.cwd !== session.cwd ||
      current.project_id !== session.project_id
    )
      throw new Error('Composer session changed')
  }
  return adapter
    .prepareComposer({
      cwd: directory,
      env: resolved.prepared.env,
      providerSettings: resolved.prepared.providerSettings
    })
    .catch((error: unknown) => {
      throw new ComposerCatalogError('acquire', error)
    })
}

export function registerComposerCatalog(ctx: RouterContext): () => void {
  return registerComposerCatalogHandlers((scope, signal) =>
    prepareComposerCatalog(ctx, scope, signal)
  )
}
