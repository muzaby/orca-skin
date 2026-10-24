import type { Backend } from './ipc'

/** Safe session-native resource view. Never includes configuration, credentials or paths. */
export interface NativeResource {
  id: string
  name: string
  description?: string
  kind: 'mcp' | 'plugin'
  status:
    | 'connected'
    | 'enabled'
    | 'disabled'
    | 'failed'
    | 'needs-auth'
    | 'pending'
    | 'configured'
    | 'installed'
  enabled: boolean
  canToggle: boolean
  /** False when no native configuration/directory opening action is available. */
  canOpen?: boolean
  /** Native provenance, without server configuration or credentials. */
  source?: string
  /** An Orca-injected MCP observed connected by the running harness. */
  origin?: 'orca'
}
export interface NativeCommand {
  name: string
  description: string
  argumentHint: string
  source: 'mcp' | 'plugin' | 'harness'
  /** False for custom commands or skills outside the supported source catalog. */
  skill?: boolean
}
export interface NativeResources {
  configurationPending?: boolean
  state: 'connected' | 'disconnected'
  generation?: string
  items: NativeResource[]
  commands?: NativeCommand[]
  partial?: boolean
  /** A successful installation inventory replaces cached/live plugin membership. */
  pluginsAuthoritative?: boolean
  /** Runtime-resolved, credential-free Composer choices (including native plugin changes). */
  composer?: NativeComposerCatalog
}
export interface NativeComposerCatalog {
  agents: { name: string; description?: string; model?: string; variant?: string }[]
  models: { id: string; variants: string[] }[]
}
export interface SetNativeResource {
  sessionId: string
  generation: string
  kind: NativeResource['kind']
  id: string
  enabled: boolean
}
export interface GlobalNativeResourceTarget {
  backend: Backend
  kind: NativeResource['kind']
  id: string
}
export interface SetGlobalNativeResource extends GlobalNativeResourceTarget {
  enabled: boolean
}

export interface OpenCodePluginsChanged {
  revision: number
}
export interface NativeResourcesChanged {
  sessionId?: string
  scope?: DraftNativeResourcesRequest
  resources: NativeResources
}

export interface NativeResourceObservation {
  owner: string
  active: boolean
}
export type OpenNativePlugin = ({ sessionId: string } | DraftNativeResourcesRequest) & {
  id: string
  /** Omitted for compatibility with plugin directory actions. MCP reveals its config file. */
  kind?: NativeResource['kind']
}

/** Read-only discovery before a draft has a persisted session. */
export interface DraftNativeResourcesRequest {
  backend: Backend
  cwd: string | null
  projectId: string | null
}
