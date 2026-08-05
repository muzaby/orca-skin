import { createConfluencePackage } from './confluence'
import { CONFLUENCE_SERVERS } from './confluence/servers'
import { createUsageConnectorPackage } from './usage'
import { USAGE_CONNECTORS } from './usage/servers'
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

// Confluence 는 **배선이 켜져 있다** (0164). 서버 목록이 비면 provider 2종만 등록되고
// connector 는 0개다 — 배포는 `confluence/servers.ts` **한 파일만** 고치면 서버가 켜진다.
// (0160 은 여기까지 함께 고치게 했는데, 편집 지점이 둘이면 하나를 빠뜨린다.)
// 사용량 connector 도 같은 규칙이다 (0176) — 배선은 켜져 있고 `usage/servers.ts` 의 목록이
// 비면 provider 2종만 등록된다. 사용량 provider 는 이 connector 의 `invoke` 결과를 **구독**해
// 자기 포맷으로 매핑한다(`contracts/usage-report.ts` §구독 경로).
export const AUTH_PLUGIN_PACKAGES: readonly AuthPluginPackage[] = [
  createConfluencePackage(CONFLUENCE_SERVERS),
  createUsageConnectorPackage(USAGE_CONNECTORS)
]
