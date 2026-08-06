// 내장 인증 방식 목록 (0178) — **등록의 전부다.**
//
// `satisfies readonly AuthMethod[]` 가 형태를 컴파일 타임에 확정한다. 0178 이전에는 이 자리에
// zod manifest + 선언↔구현 전 필드 대조 + `apiVersion` ABI + 메서드 존재 확인이 있었는데, 그
// 전부가 **컴파일 타임에 이미 참인 명제**를 런타임에 재확인하는 것이었다.
//
// 런타임에 남는 판정은 타입으로 표현할 수 없는 둘뿐이다 — 중복 id 거부, origin 형태 검사
// (`../registry.ts` 헤더).
//
// **빌드 타임 코드다.** 런타임 동적 로딩(임의 경로 require()/import())은 금지 — 근거는
// `contracts/auth-method.ts` 헤더. "재빌드 없이 서비스 추가" 는 **MCP** 가 담당한다.

import type { AuthMethod } from '../../../contracts/auth-method'
import { createBasicMethod, createPatMethod } from './credential'
import { createBrowserSessionMethod } from './browser-session'
import { SSO_CONFIG } from './sso'

export type { BrowserSessionConfig } from './browser-session'
export { createBrowserSessionMethod } from './browser-session'
export {
  BASIC_METHOD_ID,
  BASIC_PASSWORD_FIELD,
  BASIC_USERNAME_FIELD,
  PAT_METHOD_ID,
  RECORD_SECRET_NAME,
  createBasicMethod,
  createPatMethod
} from './credential'

// SSO 는 **설정이 있을 때만** 등록한다. 미설정 상태로 등록하면 `application` 대상을 지원하는
// 방식이 생겨 앱 로그인 게이트가 켜지고, 채워지지 않은 주소로 로그인 창이 열린다.
export const AUTH_METHODS: readonly AuthMethod[] = [
  ...(SSO_CONFIG ? [createBrowserSessionMethod(SSO_CONFIG)] : []),
  createPatMethod(),
  createBasicMethod()
] satisfies readonly AuthMethod[]
