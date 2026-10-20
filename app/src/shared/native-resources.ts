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
}
export interface NativeCommand {
  name: string
  description: string
  argumentHint: string
  source: 'mcp' | 'plugin' | 'harness'
}
export interface NativeResources {
  state: 'connected' | 'disconnected'
  generation?: string
  items: NativeResource[]
  commands?: NativeCommand[]
  partial?: boolean
  /** A successful installation inventory replaces cached/live plugin membership. */
  pluginsAuthoritative?: boolean
}
export interface SetNativeResource {
  sessionId: string
  generation: string
  kind: NativeResource['kind']
  id: string
  enabled: boolean
}
export type OpenNativePlugin = ({ sessionId: string } | DraftNativeResourcesRequest) & {
  id: string
}

/** Read-only discovery before a draft has a persisted session. */
export interface DraftNativeResourcesRequest {
  backend: Backend
  cwd: string | null
  projectId: string | null
}
