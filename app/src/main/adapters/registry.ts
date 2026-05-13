import type { Backend } from '../../shared/protocol'
import type { SessionAdapter } from './types'
import { ClaudeCodeAdapter } from './claude-code'

interface InstalledInfo {
  installed: boolean
  version?: string
}

// Phase 1: 단일 백엔드 (claude-code). opencode 는 future work — TRD §10 anchor.
export class AdapterRegistry {
  private readonly adapters = new Map<Backend, SessionAdapter>()
  private active: Backend | null = null
  private installState = new Map<Backend, InstalledInfo>()

  constructor() {
    const claudeCode = new ClaudeCodeAdapter()
    this.adapters.set(claudeCode.id, claudeCode)
    this.active = claudeCode.id
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
}
