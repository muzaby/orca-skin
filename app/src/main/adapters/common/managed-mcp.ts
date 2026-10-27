import type { OrcaMcpConfig } from './mcp-config'
import type { RuntimeToolServer } from './runtime-tools'

export interface ManagedMcpIdentity {
  kind: 'builtin' | 'user'
  sourceId: string
  name: string
  mentionId: string
}
export interface ManagedMcpPlugin {
  identity: ManagedMcpIdentity
  server: RuntimeToolServer
  authorized(): boolean
  credentialRevision(): number
}
/** Main-only execution input. Never serialize into IPC or a file. */
export interface ManagedMcpSnapshot {
  revision: number
  users: OrcaMcpConfig
  plugins: ReadonlyMap<string, ManagedMcpPlugin>
}
export interface ManagedMcpSource {
  snapshot(): ManagedMcpSnapshot
  refresh(): void
  subscribe(listener: (revision: number) => void): () => void
}
export interface ManagedMcpBridgeLease {
  endpoints: ReadonlyMap<string, { url: string; token: string }>
  release(): Promise<void>
}
export interface ManagedMcpRuntime {
  snapshot(): ManagedMcpSnapshot | undefined
  acquire(snapshot: ManagedMcpSnapshot): Promise<ManagedMcpBridgeLease>
}
