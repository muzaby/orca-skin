import { createHash } from 'node:crypto'
import { isAbsolute, normalize } from 'node:path'
import type { ComposerCatalogScope } from '../../shared/composer-catalog'
import { canonicalJson } from '../../shared/obj'
import { resolveTurnProvider } from './chat-turn/resolve-turn'
import { ComposerCatalogError } from './composer-catalog-error'
import type { ComposerPreparationTarget } from './composer-preparation-service'
import type { AgentContext } from './context'
import { workspaceLookup } from './chat-turn/workspace'
import { sameSessionBinding } from './session-binding'

export async function resolveComposerPreparation(
  ctx: AgentContext,
  scope: ComposerCatalogScope,
  signal: AbortSignal
): Promise<ComposerPreparationTarget> {
  if (scope.backend === 'opencode' && !ctx.registry.availability(scope.backend).usable)
    throw new ComposerCatalogError('unavailable', new Error('OpenCode를 사용할 수 없습니다.'))
  const adapter = ctx.registry.get(scope.backend)
  if (!adapter?.prepareComposer) throw new Error('Composer preparation unavailable')
  const prepare = adapter.prepareComposer.bind(adapter)
  const session = scope.sessionId ? await ctx.data.query.getSessionById(scope.sessionId) : undefined
  if (
    scope.sessionId &&
    (!session || session.backend !== scope.backend || session.agent_kind !== scope.agentKind)
  )
    throw new Error('Composer session changed')
  const projectId = session ? session.project_id : scope.projectId
  const directory =
    (session ? session.cwd : scope.cwd) ?? (await workspaceLookup(ctx, [projectId]))(projectId)
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
    const current = await ctx.data.query.getSessionById(session.id)
    if (!sameSessionBinding(current, session) || current?.agent_kind !== session.agent_kind)
      throw new Error('Composer session changed')
  }
  const cwd = normalize(directory)
  const identity = canonicalJson([
    scope.backend,
    process.platform === 'win32' ? cwd.toLowerCase() : cwd,
    scope.agentKind,
    resolved.prepared
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
