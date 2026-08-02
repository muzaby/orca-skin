import type { AuthProviderV1 } from '../../../contracts/auth-plugin'
import type { ConnectorRuntimeV1 } from '../../../contracts/connector-plugin'
import type { RuntimeToolContribution } from '../../../adapters/runtime-tools'

/**
 * Opt-in auth plugin registry (0157 — 구 `features/sso/modules/index.ts` 승계).
 *
 * Fresh installs intentionally register no auth package (빈 배열 = 로그인 게이트 없음).
 * A closed-network deployment adds its package under `modules/<name>/` and registers it
 * here; no broker, registry, IPC, or gate code changes for activation.
 *
 * **These are build-time plugins.** Runtime dynamic loading (arbitrary path require()/import())
 * is forbidden — see `contracts/auth-plugin.ts` header. "Add a service without rebuilding"
 * is served by **MCP**, not by this registry.
 *
 * Example activation:
 *   import { examplePackage } from './_example'
 *   export const AUTH_PLUGIN_PACKAGES: readonly AuthPluginPackage[] = [examplePackage]
 */
export interface AuthPluginPackage {
  // `manifest.ts` 의 PluginManifestSchema 를 통과해야 한다 — built-in 도 예외 없다.
  manifest: unknown
  providers?: readonly AuthProviderV1[]
  connectors?: readonly ConnectorRuntimeV1[]
  runtimeTools?: readonly RuntimeToolContribution[]
}

export const AUTH_PLUGIN_PACKAGES: readonly AuthPluginPackage[] = []
