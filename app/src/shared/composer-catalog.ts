import type { AgentKind } from './agent-kind'
import type { NativeComposerCatalog } from './native-resources'

export type ComposerCatalogPart = keyof NativeComposerCatalog
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
export type ComposerCatalogResult = {
  [K in ComposerCatalogPart]: { part: K; value: NativeComposerCatalog[K]; generation: string }
}[ComposerCatalogPart]
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
  ): Promise<NativeComposerCatalog[K]>
  release(): Promise<void>
}
