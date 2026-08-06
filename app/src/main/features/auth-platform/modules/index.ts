import type { ConnectorPackage } from '../registry'
import { createConfluencePackage } from './confluence'
import { CONFLUENCE_SERVERS } from './confluence/servers'
import { createUsageConnectorPackage } from './usage'
import { USAGE_CONNECTORS } from './usage/servers'

/**
 * 사내 대상(connector) opt-in 레지스트리 (0157 → 0178 축소).
 *
 * 신규 설치는 의도적으로 아무 서버도 켜지 않는다(빈 목록 = 대상 0개).
 * 폐쇄망 배포는 각 모듈의 `servers.ts` **한 파일만** 고친다 — 배선은 이미 켜져 있다.
 *
 * **인증 방식은 여기 없다** (0178). 방식의 정본은 `../methods/index.ts` 의 내장 목록이고,
 * 대상은 그중 무엇을 받아들이는지만 `acceptedMethods` 로 선언한다. 0178 이전에는 모듈마다
 * 자기 provider 를 만들어 붙였고, 그래서 위키와 사용량이 글자까지 같은 PAT·ID/비밀번호 구현을
 * 각각 한 벌씩 들고 있었다.
 *
 * **빌드 타임 코드다.** 런타임 동적 로딩(임의 경로 require()/import())은 금지 — 근거는
 * `contracts/auth-method.ts` 헤더. "재빌드 없이 서비스 추가" 는 **MCP** 가 담당한다.
 */
export type { ConnectorPackage } from '../registry'

export const CONNECTOR_PACKAGES = [
  createConfluencePackage(CONFLUENCE_SERVERS),
  createUsageConnectorPackage(USAGE_CONNECTORS)
] satisfies readonly ConnectorPackage[]
