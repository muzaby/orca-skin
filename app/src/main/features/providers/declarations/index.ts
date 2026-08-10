// 배포 선언 (0181) — **폐쇄망 배포가 고치는 유일한 파일 묶음**이다.
//
// 여기 배열이 곧 앱이 아는 provider 전부다. 런타임 동적 로딩은 없다 — 값을 바꾸면 다시 빌드한다.
// 기본 배포(OSS/dev)는 **전부 비어 있다**: 게이트 선언이 0 이므로 로그인 화면 없이 앱이 열리고
// (`gate/index.ts` 진리표 1행), 서비스·LLM provider 도 없어 동작 변화가 없다.
//
// 절차·예시는 `docs/guides/closed-network-extensions.md`.

import type { Provider } from '../../../contracts/provider'
import { SSO_PROVIDER } from './sso'
import { LLM_PROVIDERS } from './llm'
import { SERVICE_PROVIDERS } from './service'

export function declaredProviders(): Provider[] {
  return [...(SSO_PROVIDER ? [SSO_PROVIDER] : []), ...LLM_PROVIDERS, ...SERVICE_PROVIDERS]
}
