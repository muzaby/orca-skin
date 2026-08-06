// Confluence Data Center 대상 패키지 (0160 → 0178 축소) — 대상 N + runtime tools N.
//
// 서버 목록을 받아 조립한다. 같은 factory 를 다른 `id`·`baseUrl` 로 부르면 서버가 늘어난다 —
// core 코드는 손대지 않는다.
//
// **인증 방식을 여기서 만들지 않는다** (0178). 0178 이전에는 이 파일이 PAT·ID/비밀번호
// provider 를 직접 생성해 패키지에 실었고, 사용량 모듈도 똑같은 것을 자기 id 로 한 벌 더 만들었다.
// 이제 방식은 내장 목록(`methods/index.ts`)이 소유하고, 대상은 그중 무엇을 받아들이는지만
// `acceptedMethods` 로 선언한다.

import type { ConnectorRuntime } from '../../../../contracts/connector'
import type { RuntimeToolContribution } from '../../../../adapters/runtime-tools'
import type { ConnectorPackage } from '../../registry'
import { createConfluenceConnector, type ConfluenceServerConfig } from './connector'
import { createConfluenceTools } from './tools'

export type { ConfluenceServerConfig } from './connector'
export { CONFLUENCE_SERVERS } from './servers'
export { CONFLUENCE_TOOL_NAMES, confluenceToolServerId } from './tools'

export function createConfluencePackage(
  servers: readonly ConfluenceServerConfig[]
): ConnectorPackage {
  const connectors: ConnectorRuntime[] = servers.map(createConfluenceConnector)
  const runtimeTools: RuntimeToolContribution[] = servers.map((server) =>
    createConfluenceTools(server.id, server.label)
  )

  return { connectors, runtimeTools }
}
