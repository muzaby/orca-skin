import { appEnv } from '../../infra/config/orca-config'
import { getLogger } from '../../infra/log'
import { expandEnvRecord, processEnvRecord } from '../../features/harnesses/common/env'
import {
  prepareHarnessConfig,
  type AdapterSpawnEnvPatch,
  type HarnessRuntimeConfig,
  type PreparedHarnessConfig
} from '../../adapters/common/harness-config'
import { SPAWN_ENV_INJECTOR } from '../deployment/spawn-env'
import type { RouterContext } from '../context'
import { legacySettingsEnvHoist } from './registry'

export function harnessAppEnv(ctx: Pick<RouterContext, 'mcp'>): Record<string, string> {
  const { env: expanded, missing } = expandEnvRecord(appEnv(), ctx.mcp.resolver())
  if (missing.length)
    getLogger()
      .child('config')
      .warn('config.env.unresolved', { missing, reason: 'app env keys skipped' })
  return expanded
}

/** Catalog and execution share the exact same env precedence and injection policy. */
export function prepareConfiguredHarnessInput(
  ctx: Pick<RouterContext, 'mcp'>,
  config: HarnessRuntimeConfig,
  adapterEnvPatch: AdapterSpawnEnvPatch
): PreparedHarnessConfig {
  return prepareHarnessConfig({
    config,
    appEnv: harnessAppEnv(ctx),
    baseEnv: processEnvRecord,
    customEnv: SPAWN_ENV_INJECTOR,
    adapterEnvPatch,
    settingsEnvHoist: legacySettingsEnvHoist
  })
}
