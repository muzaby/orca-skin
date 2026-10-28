import { getLogger } from '../../../infra/log/registry'
import type { McpErrorClass, ProfileComponent } from './diagnostics'
import type { NativeResource } from '../../../../shared/native-resources'

/** Only opaque identities and event counts. Never pass paths, settings or native errors. */
export function retentionTrace(
  event: string,
  data: {
    runtime?: string
    instance?: string
    reason?: string
    part?: string
    count?: number
    mcp?: string
    status?: NativeResource['status']
    errorClass?: McpErrorClass
    components?: ProfileComponent[]
    turn?: string
    ms?: number
  }
): void {
  getLogger().child('opencode').debug(`opencode.retention.${event}`, data)
}
