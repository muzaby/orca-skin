/** Safe session-native resource view. Never includes configuration, credentials or paths. */
export interface NativeResource {
  id: string
  name: string
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
}
export interface SetNativeResource {
  sessionId: string
  generation: string
  kind: NativeResource['kind']
  id: string
  enabled: boolean
}
