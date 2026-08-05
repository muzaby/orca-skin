// manifest 선언을 **구현 descriptor 에서 파생**하는 공용 헬퍼 (0176 에서 패키지 공용으로 승격).
//
// 손으로 두 벌 적으면 반드시 갈리고, registry 는 선언↔구현을 **전 필드 대조**하므로(0164 D4)
// 갈리는 순간 그 패키지가 **통째로** 거부된다. 파생이 그 드리프트를 막는 장치인데, 파생 함수
// 자체를 패키지마다 복사하면 같은 문제가 한 층 위에서 되살아난다 — 그래서 한 벌만 둔다.
//
// 새 패키지는 이 세 함수를 import 해 쓰고, descriptor 에 필드가 늘면 **여기만** 고친다.

import type { AuthProviderV1 } from '../../../contracts/auth-plugin'
import type { ConnectorRuntimeV1 } from '../../../contracts/connector-plugin'
import type { RuntimeToolContribution } from '../../../adapters/runtime-tools'

export function providerDeclaration(provider: AuthProviderV1): Record<string, unknown> {
  const { descriptor } = provider
  return {
    id: descriptor.id,
    apiVersion: descriptor.apiVersion,
    label: descriptor.label,
    targets: [...descriptor.targets],
    mechanisms: [...descriptor.mechanisms],
    capabilities: [...descriptor.capabilities]
  }
}

export function connectorDeclaration(connector: ConnectorRuntimeV1): Record<string, unknown> {
  const { descriptor } = connector
  return {
    id: descriptor.id,
    apiVersion: descriptor.apiVersion,
    label: descriptor.label,
    acceptedAuthProviders: [...descriptor.acceptedAuthProviders],
    baseUrl: descriptor.baseUrl,
    presentation: descriptor.presentation,
    presentations: descriptor.presentations
  }
}

export function runtimeToolDeclaration(
  contribution: RuntimeToolContribution
): Record<string, unknown> {
  const { descriptor } = contribution
  return {
    id: descriptor.id,
    connectorId: descriptor.connectorId,
    apiVersion: descriptor.apiVersion,
    tools: descriptor.tools
  }
}
