// 범용 usage 대상 패키지 (0176 → 0178 축소) — 대상 N.
//
// 서버 목록(`servers.ts`)을 받아 조립한다. 같은 factory 를 다른 `id`·`baseUrl` 로 부르면 서버가
// 늘어난다 — core 코드는 손대지 않는다.
//
// **인증 방식을 여기서 만들지 않는다** (0178). 방식은 내장 목록(`methods/index.ts`)이 소유하고,
// 대상은 그중 무엇을 받아들이는지만 `acceptedMethods` 로 선언한다.

import type { ConnectorRuntime } from '../../../../contracts/connector'
import type { ConnectorPackage } from '../../registry'
import { createUsageConnector } from './connector'
import type { UsageConnectorConfig } from './spec'

export { createUsageConnector, usageConnectorDescriptor } from './connector'
export { USAGE_CONNECTORS } from './servers'
export type { UsageConnectorConfig, UsageOperationSpec } from './spec'
export type { UsagePayloadEnvelope } from './payload'

export function createUsageConnectorPackage(
  configs: readonly UsageConnectorConfig[]
): ConnectorPackage {
  const connectors: ConnectorRuntime[] = configs.map(createUsageConnector)
  return { connectors }
}
