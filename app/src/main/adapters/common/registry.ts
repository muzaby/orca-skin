import type { Backend, HarnessAvailability, ProviderDescriptor } from '../../../shared/ipc'
import type { SessionAdapter } from './types'

// 등록된 하네스와 설치 상태를 소유한다. 생성된 세션은 저장된 backend로 get()을 호출한다.
export class AdapterRegistry {
  private readonly adapters = new Map<Backend, SessionAdapter>()
  private active: Backend | null = null
  private installState = new Map<Backend, HarnessAvailability>()
  private identities = new Map<Backend, string | undefined>()
  private flights = new Map<Backend, { identity?: string; ready: Promise<void> }>()
  private listeners = new Set<(state: HarnessAvailability) => void>()
  private closed = false

  // MCP 는 0058 이후 plugin .mcp.json 으로 배포되어 로드된다. options.mcpServers 는 레거시로 남지만
  // 기본 query 경로에서 호출하지 않는다.
  constructor(adapters: readonly SessionAdapter[], active: Backend | null) {
    for (const adapter of adapters) this.adapters.set(adapter.id, adapter)
    if (active !== null) this.select(active)
  }

  refreshInstallState(id?: Backend): Promise<void> {
    if (this.closed) return Promise.resolve()
    const refresh = (backend: Backend): Promise<void> => {
      const adapter = this.adapters.get(backend)
      if (!adapter) return Promise.resolve()
      let identity: string | undefined
      try {
        identity = adapter.executableIdentity?.()
      } catch {
        /* absent/inaccessible executable */
      }
      const current = this.flights.get(backend)
      if (current && current.identity === identity) return current.ready
      const slot = { identity, ready: Promise.resolve() }
      this.flights.set(backend, slot)
      slot.ready = (async () => {
        const info = await adapter.isInstalled()
        if (this.closed || this.flights.get(backend) !== slot) return
        // CLI gating applies to OpenCode; keep Claude's existing SDK paths available.
        const usable = backend === 'claude' || (info.usable ?? info.installed)
        const next: HarnessAvailability = {
          id: backend,
          installed: info.installed,
          usable,
          ...(info.installed && info.version !== undefined ? { version: info.version } : {}),
          ...(!usable ? { unavailableReason: info.reason ?? 'missing' } : {})
        }
        const previous = this.installState.get(backend)
        this.identities.set(backend, identity)
        this.installState.set(backend, next)
        if (JSON.stringify(previous) !== JSON.stringify(next))
          for (const listener of this.listeners) listener(next)
      })().finally(() => {
        if (this.flights.get(backend) === slot) this.flights.delete(backend)
      })
      return slot.ready
    }
    return Promise.all(id ? [refresh(id)] : [...this.adapters.keys()].map(refresh)).then(
      () => undefined
    )
  }

  availability(id: Backend): HarnessAvailability {
    return (
      this.installState.get(id) ?? {
        id,
        installed: false,
        usable: false,
        unavailableReason: 'missing'
      }
    )
  }

  async settled(id: Backend): Promise<HarnessAvailability> {
    await this.flights.get(id)?.ready
    return this.availability(id)
  }

  focusRecheck(): void {
    if (this.closed) return
    for (const [id, adapter] of this.adapters) {
      const reason = this.availability(id).unavailableReason
      if (reason !== 'missing' && reason !== 'failed') continue
      let identity: string | undefined
      try {
        identity = adapter.executableIdentity?.()
      } catch {
        continue
      }
      if (identity !== this.identities.get(id))
        void this.refreshInstallState(id).catch(() => undefined)
    }
  }

  onAvailabilityChange(listener: (state: HarnessAvailability) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  list(): HarnessAvailability[] {
    return [...this.adapters.keys()].map((id) => this.availability(id))
  }

  getActive(): SessionAdapter | null {
    if (!this.active) return null
    return this.adapters.get(this.active) ?? null
  }

  close(): void {
    this.closed = true
    this.listeners.clear()
    for (const adapter of this.adapters.values()) adapter.close?.()
  }

  getActiveId(): Backend | null {
    return this.active
  }

  select(backend: Backend): void {
    if (!this.adapters.has(backend)) {
      throw new Error(`Unknown backend: ${backend}`)
    }
    this.active = backend
  }

  get(backend: Backend): SessionAdapter | null {
    return this.adapters.get(backend) ?? null
  }

  // 활성 백엔드의 능력 서술자 (활성 없으면 null). backend:list 가 active 엔트리에 부착.
  describeActive(): ProviderDescriptor | null {
    return this.getActive()?.describe() ?? null
  }

  // 등록된 모든 백엔드의 능력 서술자. backend:list 가 각 엔트리에 부착(computed-on-the-fly).
  describeAll(): Record<Backend, ProviderDescriptor> {
    const out = {} as Record<Backend, ProviderDescriptor>
    for (const [id, adapter] of this.adapters) out[id] = adapter.describe()
    return out
  }
}
