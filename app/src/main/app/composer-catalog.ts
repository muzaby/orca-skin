import { isAbsolute, normalize } from 'node:path'
import { createHash } from 'node:crypto'
import type { ComposerPreparationTarget } from './composer-preparation-service'
import type { ComposerCatalogLease, ComposerCatalogScope } from '../../shared/composer-catalog'
import type { RouterContext } from './context'
import { resolveTurnProvider } from './chat-turn/resolve-turn'
import {
  registerComposerCatalogHandlers,
  type ComposerCatalogRegistration
} from './handlers/composer-catalog'
import { ComposerCatalogError } from './composer-catalog-error'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)])
    )
  return value
}

export async function prepareComposerCatalog(
  ctx: RouterContext,
  scope: ComposerCatalogScope,
  signal: AbortSignal
): Promise<ComposerCatalogLease> {
  return (await resolveComposerPreparation(ctx, scope, signal)).acquire()
}

export async function resolveComposerPreparation(
  ctx: RouterContext,
  scope: ComposerCatalogScope,
  signal: AbortSignal
): Promise<ComposerPreparationTarget> {
  const adapter = ctx.registry.get(scope.backend)
  if (!adapter?.prepareComposer) throw new Error('Composer preparation unavailable')
  const prepare = adapter.prepareComposer.bind(adapter)
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
  const cwd = normalize(directory)
  const identity = JSON.stringify([
    scope.backend,
    process.platform === 'win32' ? cwd.toLowerCase() : cwd,
    scope.agentKind,
    canonical(resolved.prepared)
  ])
  return {
    key: createHash('sha256').update(identity).digest('hex'),
    acquire: () =>
      prepare({
        cwd: directory,
        env: resolved.prepared.env,
        providerSettings: resolved.prepared.providerSettings
      }).catch((error: unknown) => {
        throw new ComposerCatalogError('acquire', error)
      })
  }
}

export function registerComposerCatalog(ctx: RouterContext): ComposerCatalogRegistration {
  return registerComposerCatalogHandlers((scope, signal) =>
    prepareComposerCatalog(ctx, scope, signal)
  )
}
