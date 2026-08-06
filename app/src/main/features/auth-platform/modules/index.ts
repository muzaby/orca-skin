import type { AuthPackage } from '../registry'
import { createConfluencePackage } from './confluence'
import { CONFLUENCE_SERVERS } from './confluence/servers'
import { createUsageConnectorPackage } from './usage'
import { USAGE_CONNECTORS } from './usage/servers'

/**
 * 인증 패키지 opt-in 레지스트리 (0157 — 구 `features/sso/modules/index.ts` 승계).
 *
 * 신규 설치는 의도적으로 아무 패키지도 켜지 않는다(빈 목록 = 로그인 게이트 없음).
 * 폐쇄망 배포는 `modules/<이름>/` 에 자기 패키지를 두고 아래 배열에 한 줄 더한다 — broker·
 * registry·IPC·게이트 코드는 손대지 않는다.
 *
 * **빌드 타임 코드다.** 런타임 동적 로딩(임의 경로 require()/import())은 금지 — 근거는
 * `contracts/auth-plugin.ts` 헤더. "재빌드 없이 서비스 추가" 는 **MCP** 가 담당한다.
 *
 * `satisfies` 가 형태를 컴파일 타임에 강제한다 (0178). 등록 시점의 런타임 검증은 타입으로
 * 표현할 수 없는 둘(중복 id · origin 형태)뿐이다 — `registry.ts` 헤더.
 */
export type { AuthPackage as AuthPluginPackage } from '../registry'

// Confluence 는 **배선이 켜져 있다** (0164). 서버 목록이 비면 provider 2종만 등록되고
// connector 는 0개다 — 배포는 `confluence/servers.ts` **한 파일만** 고치면 서버가 켜진다.
// 사용량 connector 도 같은 규칙이다 (0176) — 배선은 켜져 있고 `usage/servers.ts` 가 비면
// provider 2종만 등록된다. 사용량 provider 는 이 connector 의 `invoke` 결과를 **구독**해
// 자기 포맷으로 매핑한다(`contracts/usage-report.ts` §구독 경로).
export const AUTH_PLUGIN_PACKAGES = [
  createConfluencePackage(CONFLUENCE_SERVERS),
  createUsageConnectorPackage(USAGE_CONNECTORS)
] satisfies readonly AuthPackage[]
