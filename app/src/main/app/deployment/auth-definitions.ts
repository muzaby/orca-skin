// 배포 Auth 선언 (0188 — 구 `features/providers/declarations/{sso,llm,service}.ts` 통합).
//
// **폐쇄망 배포가 고치는 파일이다.** 여기 배열이 곧 앱이 아는 인증 대상 전부다. 런타임 동적
// 로딩은 없다 — 값을 바꾸면 다시 빌드한다.
//
// 기본 배포(OSS/dev)는 **비어 있다**: gate 선언이 0 이므로 prod 는 로그인 화면 없이 열리고
// (`features/gate` 진리표 1행), Plugin·Harness·Usage 인증도 없어 동작 변화가 없다.
// **예시 Auth 를 여기 추가하거나 가짜 사내 URL 을 production 값으로 넣지 않는다.**
//
// ── 여기 없는 것 ──────────────────────────────────────────────────────────────
// `kind`·`tools`·`llm`·`usage` 슬롯은 없다(0188 D-006). "이 Auth 가 무엇에 쓰이는가" 는 옆
// 파일들이 안다:
//
//   필수 gate membership → `gate-auth.ts`
//   Harness 실행 구성     → `harness-runtime.ts`
//   Plugin 도구           → `plugins.ts`
//   원격 사용량           → `usage-fetcher.ts`
//
// 그 파일들은 **여기서 export 한 상수의 `.id` 를 재사용**한다. 같은 문자열을 각 feature 에
// 다시 적지 않는다 — 어긋나면 도구는 보이는데 인증 대상을 못 찾는다.
//
// ── 채우기 전에 반드시 아는 것 (레시피는 가이드가 갖는다) ────────────────────
// 절차·필드별 주의사항·레시피 A/B/C 전문은
// `docs/guides/closed-network-extensions.md` §2·§3·§4 다 (0190 — 같은 레시피가 소스와
// 가이드 두 곳에 살면서 이미 세 군데가 갈렸다). 아래 넷은 **틀리면 조용히 실패하는** 항목이라
// 값을 적는 자리 옆에 남긴다:
//
// ⚠️ `id` 는 한 번 정하면 바꾸지 않는다 — vault 네임스페이스이자 `${BINDING:<id>}` 참조
//    대상이라, 바뀌면 저장된 grant 를 못 읽고 사용자가 적은 MCP 설정이 깨진다.
// ⚠️ `origin` 은 로그인을 *시작* 하는 IdP 가 아니라 probe·토큰 교환이 *사는* 호스트다.
//    `loginUrl` 은 절대 URL 이지만 `probe.path`·`config.exchange.path`·`config.whoami.path` 는
//    전부 `origin` 기준 **상대 경로**다.
// ⚠️ `origin` 에 컨텍스트 경로(`/confluence`)를 붙이지 않는다 — 등록 검사가 그 선언을 거부한다.
//    컨텍스트 경로는 Plugin 옵션(`apiBasePath`)으로 넘긴다.
// ⚠️ gate 는 `probe` 가 필수다 — `GateAuthDefinition` 타입이 compile time 에 강제하고, 부팅
//    composition 이 runtime 에서도 fail-closed 한다. 확인 없이 통과하는 게이트는 우회다.
//    gate 가 아닌 Auth 도 `probe` 를 선언하라 — 없으면 값 입력만으로 "연결됨" 이 되고 서버가
//    이미 회수한 자격증명은 실제 도구 호출이 401 을 받을 때에야 드러난다.

import type { AuthDefinition } from '../../contracts/auth'

// 등록 순서 = GUI 카탈로그 행 순서. `connection-views.ts` 의 view source 배열이 이 순서를
// 보존해야 한다(0188 D-029).
export const AUTH_DEFINITIONS: readonly AuthDefinition[] = []
