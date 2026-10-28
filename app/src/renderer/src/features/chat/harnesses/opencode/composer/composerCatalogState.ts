import type {
  ComposerCatalogPart,
  ComposerCatalogScope,
  ComposerCatalogData
} from '../../../../../../../shared/composer-catalog'
import type { NativeComposerCatalog } from '../../../../../../../shared/native-resources'
import { sessionApi } from '../../../../../shared/api/ipc'
import { composerAgentStore } from './composerAgentStore'
import { onComposerPromotion } from '../../../lib/composerPromotion'

export interface CatalogSlot<T> {
  status: 'loading' | 'ready' | 'error'
  value?: T
}
export type ComposerCatalogSnapshot = {
  [K in keyof NativeComposerCatalog]: CatalogSlot<NativeComposerCatalog[K]>
} & Partial<{ [K in 'mcp' | 'plugins']: CatalogSlot<ComposerCatalogData[K]> }>
const initial = (): ComposerCatalogSnapshot => ({
  agents: { status: 'loading' },
  models: { status: 'loading' }
})

export class ComposerCatalogState {
  private owner = crypto.randomUUID()
  private previousOwner?: string
  private readonly listeners = new Set<() => void>()
  private readonly retired = new Set<string>()
  private snapshot = initial()
  private generation?: string
  private epoch = 0
  private flights: Partial<Record<ComposerCatalogPart, Promise<void>>> = {}
  private detach?: () => void
  private detachAgents?: () => void
  private detachManagedMcp?: () => void
  private disposal?: ReturnType<typeof setTimeout>
  private disposed = false

  constructor(
    public scope: ComposerCatalogScope,
    private readonly remove: () => void = () => undefined,
    private readonly agents = composerAgentStore
  ) {
    this.snapshot.agents = this.agentSlot()
  }

  private agentSlot(): ComposerCatalogSnapshot['agents'] {
    const value = this.agents.getState().agents
    return value === undefined ? { status: 'loading' } : { status: 'ready', value }
  }

  getSnapshot = (): ComposerCatalogSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    clearTimeout(this.disposal)
    this.listeners.add(listener)
    if (!this.detach) {
      this.detachManagedMcp = sessionApi.onManagedMcpChanged?.(() => {
        if (this.snapshot.mcp) void this.read('mcp', true)
      })
      this.snapshot = { ...this.snapshot, agents: this.agentSlot() }
      this.detachAgents = this.agents.subscribe((current, previous) => {
        this.snapshot = { ...this.snapshot, agents: this.agentSlot() }
        if (current.revision !== previous.revision) {
          this.epoch++
          this.flights = {}
          if (this.generation) this.retired.add(this.generation)
          this.generation = undefined
          const parts = Object.keys(this.snapshot) as ComposerCatalogPart[]
          for (const part of parts) void this.read(part, true)
        }
        this.publish()
      })
      this.detach = sessionApi.onComposerCatalogInvalidated((event) => {
        if (event.owner !== this.owner) return
        if (this.retired.has(event.generation)) return
        this.retired.add(event.generation)
        this.epoch++
        this.flights = {}
        this.invalidate()
        this.publish()
      })
      void this.read('agents')
      void this.read('models')
    }
    return () => {
      this.listeners.delete(listener)
      if (!this.listeners.size) this.disposal = setTimeout(() => this.dispose(), 0)
    }
  }

  promote(scope: ComposerCatalogScope): void {
    this.scope = scope
    this.previousOwner = this.owner
    this.owner = crypto.randomUUID()
    // Preserve the visible draft snapshot/flight; acquire the verified saved target in parallel.
    delete this.flights.models
    void this.read('models', false, true)
  }

  private invalidate(): void {
    this.snapshot = {
      agents: this.agents.getState().agents === undefined ? { status: 'error' } : this.agentSlot(),
      models: { status: 'error' },
      ...(this.snapshot.mcp ? { mcp: { status: 'error' as const } } : {}),
      ...(this.snapshot.plugins ? { plugins: { status: 'error' as const } } : {})
    }
  }

  retry = (part: ComposerCatalogPart): void => {
    void this.read(part, true)
  }

  private read(part: ComposerCatalogPart, refresh = false, rebind = false): Promise<void> {
    if (part === 'agents' && this.agents.getState().agents !== undefined) {
      this.snapshot = { ...this.snapshot, agents: this.agentSlot() }
      return Promise.resolve()
    }
    if (this.flights[part]) return this.flights[part]!
    if (this.disposed || (!refresh && !rebind && this.snapshot[part]?.status === 'ready'))
      return Promise.resolve()
    const epoch = this.epoch
    const owner = this.owner
    const revision = this.agents.getState().revision
    if (!rebind || !this.snapshot[part]?.value)
      this.snapshot = { ...this.snapshot, [part]: { ...this.snapshot[part], status: 'loading' } }
    this.publish()
    const flight = sessionApi
      .composerCatalog({ owner, scope: this.scope, part, refresh })
      .then((result) => {
        if (
          this.disposed ||
          epoch !== this.epoch ||
          (owner !== this.owner && owner !== this.previousOwner)
        )
          return
        if (result.part !== part) throw new Error('Unexpected composer catalog part')
        if ('status' in result) {
          // Cancellation is an ownership outcome, never a successful empty catalog.
          this.snapshot = {
            ...this.snapshot,
            [part]:
              part === 'agents' && this.agents.getState().agents !== undefined
                ? this.agentSlot()
                : { ...this.snapshot[part], status: 'error' }
          }
          this.publish()
          return
        }
        if (this.retired.has(result.generation)) return
        if (this.generation && this.generation !== result.generation) {
          this.retired.add(this.generation)
          this.invalidate()
        }
        this.generation = result.generation
        if (this.previousOwner && owner === this.owner) {
          void sessionApi.releaseComposerCatalog(this.previousOwner).catch(() => undefined)
          this.previousOwner = undefined
        }
        if (result.part === 'agents') this.agents.getState().accept(result.value, revision)
        this.snapshot = {
          ...this.snapshot,
          [part]: part === 'agents' ? this.agentSlot() : { status: 'ready', value: result.value }
        }
        this.publish()
      })
      .catch(() => {
        if (
          this.disposed ||
          epoch !== this.epoch ||
          (owner !== this.owner && owner !== this.previousOwner)
        )
          return
        this.snapshot = {
          ...this.snapshot,
          [part]:
            part === 'agents' && this.agents.getState().agents !== undefined
              ? this.agentSlot()
              : { ...this.snapshot[part], status: 'error' }
        }
        this.publish()
      })
      .finally(() => {
        if (this.flights[part] === flight) delete this.flights[part]
      })
    this.flights[part] = flight
    return flight
  }

  private publish(): void {
    for (const listener of this.listeners) listener()
  }
  private dispose(): void {
    if (this.disposed || this.listeners.size) return
    this.disposed = true
    this.epoch++
    this.detach?.()
    this.detachAgents?.()
    this.detachManagedMcp?.()
    this.remove()
    void sessionApi.releaseComposerCatalog(this.owner).catch(() => undefined)
    if (this.previousOwner)
      void sessionApi.releaseComposerCatalog(this.previousOwner).catch(() => undefined)
  }
}

const states = new Map<string, ComposerCatalogState>()
const stateKey = (scope: ComposerCatalogScope, identity?: number): string =>
  JSON.stringify([
    identity,
    scope.backend,
    scope.sessionId,
    scope.cwd,
    scope.projectId,
    scope.providerKey,
    scope.agentKind
  ])
onComposerPromotion(({ identity, before, after }) => {
  if (
    before.backend !== 'opencode' ||
    after.backend !== 'opencode' ||
    before.cwd !== after.cwd ||
    before.providerKey !== after.providerKey ||
    before.agentKind !== after.agentKind ||
    before.worktreeIsolation
  )
    return
  const previous: ComposerCatalogScope = {
    backend: 'opencode',
    sessionId: null,
    cwd: before.cwd,
    projectId: before.projectId ?? before.pendingProjectId,
    providerKey: before.providerKey,
    agentKind: before.agentKind
  }
  const oldKey = stateKey(previous, identity)
  const state = states.get(oldKey)
  if (!state) return
  const next = {
    ...previous,
    sessionId: after.sessionId,
    cwd: after.cwd,
    projectId: after.projectId
  }
  states.delete(oldKey)
  states.set(stateKey(next, identity), state)
  state.promote(next)
})
export function composerCatalogState(
  scope: ComposerCatalogScope,
  identity?: number
): ComposerCatalogState {
  const key = stateKey(scope, identity)
  let state = states.get(key)
  if (!state) {
    const created = new ComposerCatalogState(scope, () => {
      for (const [entry, value] of states) if (value === created) states.delete(entry)
    })
    state = created
    states.set(key, state)
  }
  return state
}
