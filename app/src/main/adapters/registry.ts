import type { Backend, ProviderDescriptor } from '../../shared/ipc'
import type { SessionAdapter } from './types'
import { ClaudeAdapter } from './claude/adapter'

interface InstalledInfo {
  installed: boolean
  version?: string
}

// 등록된 하네스와 설치 상태를 소유한다. 생성된 세션은 저장된 backend로 get()을 호출한다.
export class AdapterRegistry {
  private readonly adapters = new Map<Backend, SessionAdapter>()
  private active: Backend | null = null
  private installState = new Map<Backend, InstalledInfo>()

  // MCP 는 0058 이후 plugin .mcp.json 으로 배포되어 로드된다. options.mcpServers 는 레거시로 남지만
  // 기본 query 경로에서 호출하지 않는다.
  constructor(extraAdapters: SessionAdapter[] = []) {
    const claude = new ClaudeAdapter()
    this.adapters.set(claude.id, claude)
    this.active = claude.id
    for (const adapter of extraAdapters) this.adapters.set(adapter.id, adapter)
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

  close(): void {
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
