import type { Backend, ProviderDescriptor } from '../../shared/ipc'
import type { Resolver } from '../mcp/expand'
import type { SessionAdapter } from './types'
import { ClaudeAdapter } from './claude'

interface InstalledInfo {
  installed: boolean
  version?: string
}

// Phase 1: 단일 백엔드 (claude). opencode 는 future work — TRD §10 anchor.
export class AdapterRegistry {
  private readonly adapters = new Map<Backend, SessionAdapter>()
  private active: Backend | null = null
  private installState = new Map<Backend, InstalledInfo>()

  // resolver 팩토리를 어댑터 ctor 로 전달한다. 호출 시점(턴 실행)에 this.mcp 가 이미 할당돼 있도록
  // IpcRouter 가 lazy arrow `() => this.mcp.resolver()` 를 넘긴다 (field-init 순서 무관).
  constructor(makeResolver: () => Resolver) {
    const claude = new ClaudeAdapter(makeResolver)
    this.adapters.set(claude.id, claude)
    this.active = claude.id
  }

  async refreshInstallState(): Promise<void> {
    const entries = await Promise.all(
      [...this.adapters.entries()].map(
        async ([id, adapter]) => [id, await adapter.isInstalled()] as const
      )
    )
    this.installState = new Map(entries)
  }

  list(): { id: Backend; installed: boolean; version?: string }[] {
    return [...this.adapters.keys()].map((id) => {
      const info = this.installState.get(id) ?? { installed: false }
      return { id, ...info }
    })
  }

  getActive(): SessionAdapter | null {
    if (!this.active) return null
    return this.adapters.get(this.active) ?? null
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
