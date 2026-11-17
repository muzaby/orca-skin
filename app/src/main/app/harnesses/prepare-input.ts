import { processEnvRecord } from '../../features/harnesses/common/env'
import {
  prepareHarnessConfig,
  type AdapterSpawnEnvPatch,
  type HarnessRuntimeConfig,
  type PreparedHarnessConfig
} from '../../adapters/common/harness-config'
import { SPAWN_ENV_INJECTOR } from '../deployment/spawn-env'
import { legacySettingsEnvHoist } from './registry'

/** Catalog and execution share the exact same env precedence and injection policy. */
// `appEnv` 는 데이터 호스트가 MCP 해석기로 펼친 앱 환경이다(`HarnessConfigPort.appEnv`).
export function prepareConfiguredHarnessInput(
  appEnv: Record<string, string>,
  config: HarnessRuntimeConfig,
  adapterEnvPatch: AdapterSpawnEnvPatch
): PreparedHarnessConfig {
  return prepareHarnessConfig({
    config,
    appEnv,
    baseEnv: processEnvRecord,
    customEnv: SPAWN_ENV_INJECTOR,
    adapterEnvPatch,
    settingsEnvHoist: legacySettingsEnvHoist
  })
}
