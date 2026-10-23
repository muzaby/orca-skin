import type {
  ComposerCatalogPart,
  ComposerCatalogScope,
  ComposerCatalogData
} from '../../../../../../../shared/composer-catalog'
import type { NativeComposerCatalog } from '../../../../../../../shared/native-resources'
import { sessionApi } from '../../../../../shared/api/ipc'
import { composerAgentCache } from './composerAgentCache'

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
  private readonly owner = crypto.randomUUID()
  private readonly listeners = new Set<() => void>()
  private readonly retired = new Set<string>()
  private snapshot = initial()
  private generation?: string
  private epoch = 0
  private flights: Partial<Record<ComposerCatalogPart, Promise<void>>> = {}
  private detach?: () => void
  private detachAgents?: () => void
  private disposal?: ReturnType<typeof setTimeout>
  private disposed = false

  constructor(
    readonly scope: ComposerCatalogScope,
    private readonly remove: () => void = () => undefined,
    private readonly agents = composerAgentCache
  ) {
    this.snapshot.agents = this.agentSlot()
  }

  private agentSlot(): ComposerCatalogSnapshot['agents'] {
    const value = this.agents.get()
    return value === undefined ? { status: 'loading' } : { status: 'ready', value }
  }

  getSnapshot = (): ComposerCatalogSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    clearTimeout(this.disposal)
    this.listeners.add(listener)
    if (!this.detach) {
      this.snapshot = { ...this.snapshot, agents: this.agentSlot() }
      this.detachAgents = this.agents.subscribe(() => {
        this.snapshot = { ...this.snapshot, agents: this.agentSlot() }
        if (this.agents.get() === undefined) {
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
        if (event.revalidate !== undefined) {
          this.agents.reset(event.revalidate)
          return
        }
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

  subscribeResources = (listener: () => void): (() => void) => {
    const unsubscribe = this.subscribe(listener)
    void this.read('mcp')
    void this.read('plugins')
    return unsubscribe
  }

  private invalidate(): void {
    this.snapshot = {
      agents: this.agents.get() === undefined ? { status: 'error' } : this.agentSlot(),
      models: { status: 'error' },
      ...(this.snapshot.mcp ? { mcp: { status: 'error' as const } } : {}),
      ...(this.snapshot.plugins ? { plugins: { status: 'error' as const } } : {})
    }
  }

  retry = (part: ComposerCatalogPart): void => {
    void this.read(part, true)
  }

  private read(part: ComposerCatalogPart, refresh = false): Promise<void> {
    if (part === 'agents' && this.agents.get() !== undefined) {
      this.snapshot = { ...this.snapshot, agents: this.agentSlot() }
      return Promise.resolve()
    }
    if (this.flights[part]) return this.flights[part]!
    if (this.disposed || (!refresh && this.snapshot[part]?.status === 'ready'))
      return Promise.resolve()
    const epoch = this.epoch
    const revision = this.agents.getRevision()
    this.snapshot = { ...this.snapshot, [part]: { ...this.snapshot[part], status: 'loading' } }
    this.publish()
    const flight = sessionApi
      .composerCatalog({ owner: this.owner, scope: this.scope, part, refresh })
      .then((result) => {
        if (this.disposed || epoch !== this.epoch) return
        if (result.part !== part) throw new Error('Unexpected composer catalog part')
        if ('status' in result) {
          // Cancellation is an ownership outcome, never a successful empty catalog.
          this.snapshot = {
            ...this.snapshot,
            [part]:
              part === 'agents' && this.agents.get() !== undefined
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
        if (result.part === 'agents') this.agents.accept(result.value, revision)
        this.snapshot = {
          ...this.snapshot,
          [part]: part === 'agents' ? this.agentSlot() : { status: 'ready', value: result.value }
        }
        this.publish()
      })
      .catch(() => {
        if (this.disposed || epoch !== this.epoch) return
        this.snapshot = {
          ...this.snapshot,
          [part]:
            part === 'agents' && this.agents.get() !== undefined
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
    this.remove()
    void sessionApi.releaseComposerCatalog(this.owner).catch(() => undefined)
  }
}

const states = new Map<string, ComposerCatalogState>()
export function composerCatalogState(scope: ComposerCatalogScope): ComposerCatalogState {
  const key = JSON.stringify(scope)
  let state = states.get(key)
  if (!state) {
    const created = new ComposerCatalogState(scope, () => {
      if (states.get(key) === created) states.delete(key)
    })
    state = created
    states.set(key, state)
  }
  return state
}
