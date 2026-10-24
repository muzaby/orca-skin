import type { AgentKind } from './agent-kind'
import type { NativeComposerCatalog, NativeResource } from './native-resources'

export type ComposerCatalogData = NativeComposerCatalog & {
  mcp: NativeResource[]
  plugins: NativeResource[]
}
export type ComposerCatalogPart = keyof ComposerCatalogData
export interface ComposerCatalogScope {
  backend: 'opencode'
  sessionId: string | null
  cwd: string | null
  projectId: string | null
  providerKey: string | null
  agentKind: AgentKind
}
export interface ComposerCatalogRequest {
  owner: string
  scope: ComposerCatalogScope
  part: ComposerCatalogPart
  refresh?: boolean
}
export type ComposerCatalogResult =
  | {
      [K in ComposerCatalogPart]: { part: K; value: ComposerCatalogData[K]; generation: string }
    }[ComposerCatalogPart]
  | { part: ComposerCatalogPart; status: 'cancelled' }
  | { part: ComposerCatalogPart; status: 'error'; failure: ComposerCatalogFailure }
export interface ComposerCatalogFailure {
  stage: 'configuration' | 'acquire' | 'owner' | ComposerCatalogPart
  reason: 'timeout' | 'aborted' | 'network' | 'http' | 'unavailable'
  httpStatus?: number
}
export interface ComposerCatalogInvalidated {
  owner: string
  generation: string
}

/** Main-only ownership port. Only read results cross IPC. */
export interface ComposerCatalogLease {
  generation: string
  signal: AbortSignal
  read<K extends ComposerCatalogPart>(
    part: K,
    signal: AbortSignal,
    refresh?: boolean
  ): Promise<ComposerCatalogData[K]>
  release(): Promise<void>
}
