import { getLogger } from '../../../infra/log/registry'

/** Only opaque identities and event counts. Never pass paths, settings or native errors. */
export function retentionTrace(
  event: string,
  data: { runtime?: string; instance?: string; reason?: string; part?: string; count?: number }
): void {
  getLogger().child('opencode').debug(`opencode.retention.${event}`, data)
}
