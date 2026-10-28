import type { ComposerCatalogLease, ComposerCatalogScope } from '../../shared/composer-catalog'
import type { NativeResourceObservation, NativeResources } from '../../shared/native-resources'
import type { ResourceRequest } from './project-resource-sync'
import { ComposerCatalogCancelled, ComposerCatalogOwners } from './composer-catalog-owner'
import { parseAgentKind } from '../../shared/agent-kind'
import type { RouterContext } from './context'

export function resourceRequestKey(request: ResourceRequest): string {
  return 'sessionId' in request
    ? JSON.stringify(['session', request.sessionId])
    : JSON.stringify([
        'draft',
        request.backend,
        request.cwd,
        request.projectId,
        request.providerKey ?? null,
        request.agentKind ?? 'code'
      ])
}

function cancelledResources(pending = false): NativeResources {
  return {
    state: 'disconnected',
    partial: true,
    items: [],
    ...(pending ? { configurationPending: true } : {})
  }
}

export function preparedMcpScope(
  db: Pick<RouterContext['db'], 'getSessionById'>,
  request: ResourceRequest
): ComposerCatalogScope | undefined {
  const session = 'sessionId' in request ? db.getSessionById(request.sessionId) : undefined
  if ('sessionId' in request && !session) return undefined
  const draft = 'backend' in request ? request : undefined
  const backend = session?.backend ?? draft?.backend
  if (backend !== 'opencode') return undefined
  return {
    backend,
    sessionId: session?.id ?? null,
    cwd: session?.cwd ?? draft?.cwd ?? null,
    projectId: session?.project_id ?? draft?.projectId ?? null,
    providerKey: session ? null : (draft?.providerKey ?? null),
    agentKind: session ? parseAgentKind(session.agent_kind) : (draft?.agentKind ?? 'code')
  }
}

export class PreparedMcpResources {
  private revisionValue = 0
  get revision(): number {
    return this.revisionValue
  }
  private readonly owners: ComposerCatalogOwners
  private readonly observations = new Map<
    string,
    { sender: number; owner: string; request: ResourceRequest }
  >()
  constructor(
    private readonly deps: {
      scope(request: ResourceRequest): ComposerCatalogScope | undefined
      prepare(scope: ComposerCatalogScope, signal: AbortSignal): Promise<ComposerCatalogLease>
    },
    owners?: ComposerCatalogOwners
  ) {
    this.owners = owners ?? new ComposerCatalogOwners(deps.prepare)
  }

  observe(sender: number, observation: NativeResourceObservation, request: ResourceRequest): void {
    const key = `${sender}:${observation.owner}`
    const previous = this.observations.get(key)
    if (previous && resourceRequestKey(previous.request) !== resourceRequestKey(request))
      void this.owners.release(sender, observation.owner).catch(() => undefined)
    if (observation.active)
      this.observations.set(key, { sender, owner: observation.owner, request })
    else {
      this.observations.delete(key)
      void this.owners.release(sender, observation.owner).catch(() => undefined)
    }
  }
  releaseSender(sender: number): void {
    for (const [key, entry] of this.observations)
      if (entry.sender === sender) this.observations.delete(key)
    this.owners.releaseSender(sender)
  }
  async read(request: ResourceRequest): Promise<NativeResources | undefined> {
    const key = resourceRequestKey(request)
    for (let attempt = 0; attempt < 2; attempt++) {
      const scope = this.deps.scope(request)
      if (!scope) return undefined
      const entry = [...this.observations.values()].find(
        (owner) => resourceRequestKey(owner.request) === key
      )
      // A one-shot inventory query must not advertise connections that have no owner.
      if (!entry) return attempt ? cancelledResources() : undefined
      try {
        const result = await this.owners.read(
          entry.sender,
          { owner: entry.owner, scope, part: 'mcp' },
          () => undefined
        )
        if (![...this.observations.values()].includes(entry)) return cancelledResources()
        if ('status' in result || result.part !== 'mcp')
          throw new Error('MCP 준비를 완료하지 못했습니다.')
        return { state: 'connected', generation: result.generation, items: result.value }
      } catch (error) {
        if (!(error instanceof ComposerCatalogCancelled)) throw error
        if (error.reason !== 'superseded') return cancelledResources()
      }
    }
    return cancelledResources(true)
  }
  invalidate(): void {
    this.revisionValue++
    this.owners.invalidate()
  }
  close(): void {
    this.observations.clear()
    this.owners.close()
  }
}
