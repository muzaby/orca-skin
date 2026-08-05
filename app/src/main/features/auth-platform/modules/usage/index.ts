// 범용 usage connector 패키지 (0176) — provider 2 + connector N.
//
// 서버 목록(`servers.ts`)을 받아 패키지를 조립한다. 같은 factory 를 다른 `id`·`baseUrl` 로
// 부르면 서버가 늘어난다 — core 코드는 손대지 않는다(confluence 선례).
//
// manifest 는 구현 descriptor 에서 **파생**한다. 손으로 두 벌 적으면 registry 의 전 필드 동등
// 검사에서 갈리고, 그 순간 패키지 전체가 거부된다.

import type { AuthProviderV1 } from '../../../../contracts/auth-plugin'
import type { ConnectorRuntimeV1 } from '../../../../contracts/connector-plugin'
import { connectorDeclaration, providerDeclaration } from '../declare'
import { createBasicCredentialProvider } from '../../providers/basic-credential'
import { createStaticCredentialProvider } from '../../providers/static-credential'
import type { AuthPluginPackage } from '../index'
import {
  createUsageConnector,
  USAGE_BASIC_PROVIDER_ID,
  USAGE_PAT_PROVIDER_ID,
  USAGE_PLUGIN_ID
} from './connector'
import type { UsageConnectorConfig } from './spec'

export {
  createUsageConnector,
  usageConnectorDescriptor,
  USAGE_BASIC_PROVIDER_ID,
  USAGE_PAT_PROVIDER_ID,
  USAGE_PLUGIN_ID
} from './connector'
export { USAGE_CONNECTORS } from './servers'
export type { UsageConnectorConfig, UsageOperationSpec } from './spec'
export type { UsagePayloadEnvelope } from './payload'

// 이 패키지 안에서만 쓴다 — 배포가 고치는 것은 `servers.ts` 뿐이므로 밖으로 열지 않는다.
function usageAuthProviders(): AuthProviderV1[] {
  return [
    // **`targets:['connector']` 로 좁힌다** — 기본값(`['application','connector']`)을 쓰면 이
    // 패키지를 켜는 것만으로 prod 앱 로그인 게이트가 켜진다(0164 verify D1, DEV 는 bypass 라
    // 개발 중에는 보이지 않는다).
    createStaticCredentialProvider({
      id: USAGE_PAT_PROVIDER_ID,
      pluginId: USAGE_PLUGIN_ID,
      label: '사용량 API 토큰',
      mechanism: 'personal_access_token',
      service: 'usage',
      fieldLabel: '사용량 API 토큰',
      targets: ['connector']
    }),
    createBasicCredentialProvider({
      id: USAGE_BASIC_PROVIDER_ID,
      pluginId: USAGE_PLUGIN_ID,
      label: '사용량 API ID/비밀번호',
      service: 'usage'
    })
  ]
}

export function createUsageConnectorPackage(
  configs: readonly UsageConnectorConfig[]
): AuthPluginPackage {
  const providers = usageAuthProviders()
  const connectors: ConnectorRuntimeV1[] = configs.map(createUsageConnector)

  return {
    manifest: {
      schemaVersion: 1,
      id: USAGE_PLUGIN_ID,
      version: '1.0.0',
      contributes: {
        authProviders: providers.map(providerDeclaration),
        connectors: connectors.map(connectorDeclaration)
      }
    },
    providers,
    connectors
  }
}
