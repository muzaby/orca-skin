/** Internal policy, milliseconds. The directory owns the only retention deadline. */
export const openCodeRetention = Object.freeze({
  idleRetentionMs: 90_000,
  maxIdleInstances: 4,
  mcpFreshMs: NATIVE_RESOURCE_FRESH_MS,
  discoveryCheckMs: 1_000,
  maxDiscoveryScopes: 64,
  maxInstallationEntries: 256
})
import { NATIVE_RESOURCE_FRESH_MS } from '../../../../shared/native-resources'
