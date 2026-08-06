// Confluence Data Center 플러그인 패키지 (0160) — provider 2 + connector N + runtime tools N.
//
// 서버 목록을 받아 패키지를 조립한다. 같은 factory 를 다른 `id`·`baseUrl` 로 부르면 서버가
// 늘어난다 — core 코드는 손대지 않는다(0158 `createJiraConnector` 선례).
//
// 선언이 따로 없다 — 구현체가 곧 선언이다 (0178). manifest 를 손으로 두 벌 적던 시절의
// 파생 helper(`declare.ts`)도 함께 사라졌다.

import type { AuthProviderV1 } from '../../../../contracts/auth-plugin'
import type { ConnectorRuntimeV1 } from '../../../../contracts/connector-plugin'
import type { RuntimeToolContribution } from '../../../../adapters/runtime-tools'
import { createBasicCredentialProvider } from '../../providers/basic-credential'
import { createStaticCredentialProvider } from '../../providers/static-credential'
import type { AuthPluginPackage } from '../index'
import {
  createConfluenceConnector,
  CONFLUENCE_BASIC_PROVIDER_ID,
  CONFLUENCE_PAT_PROVIDER_ID,
  CONFLUENCE_PLUGIN_ID,
  type ConfluenceServerConfig
} from './connector'
import { createConfluenceTools } from './tools'

export {
  CONFLUENCE_BASIC_PROVIDER_ID,
  CONFLUENCE_PAT_PROVIDER_ID,
  CONFLUENCE_PLUGIN_ID,
  type ConfluenceServerConfig
} from './connector'
export { CONFLUENCE_SERVERS } from './servers'
export { CONFLUENCE_TOOL_NAMES, confluenceToolServerId } from './tools'

function confluenceProviders(): AuthProviderV1[] {
  return [
    // PAT 는 단일 opaque 값이라 static-credential 을 그대로 쓴다. **probeUrl 을 주지 않는다** —
    // 검증은 connector.start() 가 실제 요청 경로로 한다(provider 는 origin 을 모른다).
    createStaticCredentialProvider({
      id: CONFLUENCE_PAT_PROVIDER_ID,
      pluginId: CONFLUENCE_PLUGIN_ID,
      label: 'Confluence PAT',
      mechanism: 'personal_access_token',
      service: 'confluence',
      fieldLabel: '개인 액세스 토큰(PAT)',
      // **연결 전용이다** — 위 선언(`targets: ['connector']`)과 같아야 한다. 기본값
      // (`['application','connector']`)을 쓰면 이 패키지를 켜는 것만으로 prod 앱 로그인
      // 게이트가 켜진다(0164 verify D1 — DEV bypass 때문에 개발 중에는 보이지 않는다).
      targets: ['connector']
    }),
    createBasicCredentialProvider({
      id: CONFLUENCE_BASIC_PROVIDER_ID,
      pluginId: CONFLUENCE_PLUGIN_ID,
      label: 'Confluence ID/비밀번호',
      service: 'confluence'
    })
  ]
}

export function createConfluencePackage(
  servers: readonly ConfluenceServerConfig[]
): AuthPluginPackage {
  const providers = confluenceProviders()
  const connectors: ConnectorRuntimeV1[] = servers.map(createConfluenceConnector)
  const runtimeTools: RuntimeToolContribution[] = servers.map((server) =>
    createConfluenceTools(server.id, server.label)
  )

  return { providers, connectors, runtimeTools }
}
