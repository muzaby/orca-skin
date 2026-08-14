// 배포 Auth 선언 (0188 — 구 `features/providers/declarations/{sso,llm,service}.ts` 통합).
//
// **폐쇄망 배포가 고치는 파일이다.** 여기 배열이 곧 앱이 아는 인증 대상 전부다. 런타임 동적
// 로딩은 없다 — 값을 바꾸면 다시 빌드한다.
//
// 기본 배포(OSS/dev)는 **비어 있다**: gate 선언이 0 이므로 prod 는 로그인 화면 없이 열리고
// (`features/gate` 진리표 1행), Plugin·Harness·Usage 인증도 없어 동작 변화가 없다.
// **예시 Auth 를 여기 추가하거나 가짜 사내 URL 을 production 값으로 넣지 않는다** — 아래
// 주석의 레시피는 배포가 복사해 채우는 형판이다.
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
// ── 레시피 A · 앱 로그인 게이트 (사내 ADFS/WIA) ──────────────────────────────
//
// ⚠️ `id` 는 한 번 정하면 바꾸지 않는다 — vault 네임스페이스이자 `${BINDING:<id>}` 참조
//    대상이라, 바뀌면 저장된 grant 를 못 읽고 사용자가 적은 MCP 설정이 깨진다.
// ⚠️ `origin` 은 로그인을 *시작* 하는 IdP 가 아니라 probe·토큰 교환이 *사는* 호스트다.
//    `loginUrl` 은 절대 URL 이라 어디를 가리켜도 되지만 `probe.path`·`config.exchange.path`·
//    `config.whoami.path` 는 전부 `origin` 기준 **상대 경로**다.
// ⚠️ gate 는 `probe` 가 필수다 — `GateAuthDefinition` 타입이 compile time 에 강제하고,
//    부팅 composition 이 runtime 에서도 fail-closed 한다. 확인 없이 통과하는 게이트는 우회다.
//
// ```ts
// export const CORP_SSO_AUTH = {
//   id: 'corp-sso',
//   label: '사내 로그인',
//   origin: 'https://portal.example.corp',   // ← probe·whoami·exchange 가 사는 호스트
//   probe: { path: '/api/me' },
//   methods: [
//     {
//       kind: 'browser-session',
//       label: '통합 인증(WIA)',
//       config: {
//         sessionGroup: 'corp',
//         loginUrl: 'https://adfs.example.corp/adfs/ls/?wa=wsignin1.0',
//         doneUrlPrefix: 'https://portal.example.corp/home',
//         allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp'],
//         whoami: { path: '/api/me', valuePath: 'mail' }
//       }
//     }
//   ]
// } satisfies GateAuthDefinition
// ```
//
// ── 레시피 B · Harness ModelProvider 인증 ────────────────────────────────────
//
// 두 갈래를 함께 지원한다(사용자 결정: "둘다 쓰는데, 구현자·사용자 모두 골라서 선택"):
//   ⓐ **API key** — 사용자가 값을 붙여 넣는다. → `harness-runtime.ts` 의 direct-credential
//      augmenter 가 `readSecret()` 으로 읽어 env 에 놓는다.
//   ⓑ **OAuth code→token** — 표준 흐름으로 토큰을 발급받는다. → config API augmenter 가 그
//      토큰으로 `/api/llm/config` 를 불러 **URL·모델 변수·실행 token** 을 받는다.
//
// **`envKey` 를 여기 적지 않는다** (0188 D-006) — 환경변수 이름은 Auth 의 지식이 아니다.
//
// ```ts
// export const CORP_LLM_AUTH = {
//   id: 'corp-llm',
//   label: '사내 모델 게이트웨이',
//   origin: 'https://llm.example.corp',
//   probe: { path: '/api/me' },
//   methods: [
//     apiKeySpec({
//       label: 'API 키',
//       fieldLabel: 'API 키',
//       present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
//     }),
//     {
//       kind: 'oauth',
//       label: '사내 계정으로 로그인',
//       present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
//       async authorize(ctx) {
//         const pkce = ctx.pkce()
//         const url = new URL('https://llm.example.corp/oauth/authorize')
//         url.searchParams.set('response_type', 'code')
//         url.searchParams.set('client_id', 'orca-desktop')
//         url.searchParams.set('redirect_uri', ctx.loopbackRedirectUri(OAUTH_PORT))
//         // SP 명세에 state 가 없으면 이 줄과 `ctx.state()` 를 **함께 뺀다**.
//         url.searchParams.set('state', ctx.state())
//         url.searchParams.set('code_challenge', pkce.challenge)
//         url.searchParams.set('code_challenge_method', pkce.method)
//         return {
//           url: url.toString(),
//           redirect: { kind: 'loopback', port: OAUTH_PORT },
//           exchange: async (code, verifier) => { /* POST /oauth/token */ }
//         }
//       }
//     }
//   ]
// } satisfies AuthDefinition
// ```
//
// ── 레시피 C · Plugin 인증 (Confluence 등 사내 REST) ─────────────────────────
//
// ⚠️ 컨텍스트 경로(`/confluence`)는 `origin` 이 아니라 Plugin 옵션(`apiBasePath`)으로 넘긴다 —
//    `origin` 에 경로가 붙으면 등록 검사가 그 선언을 거부한다.
// ⚠️ `probe` 를 선언하라. 없으면 값이 입력된 것만으로 "연결됨" 이 되고, 서버가 그 PAT 를
//    이미 회수했는지는 실제 도구 호출이 401 을 받을 때에야 드러난다.
//
// ```ts
// export const CONFLUENCE_AUTH = {
//   id: 'confluence',
//   label: 'Confluence',
//   origin: 'https://wiki.example.corp',   // 경로 없음
//   probe: { path: '/confluence/rest/api/user/current' },
//   methods: [
//     patSpec({
//       label: '개인 액세스 토큰(PAT)',
//       fieldLabel: '개인 액세스 토큰',
//       present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
//     })
//   ]
// } satisfies AuthDefinition
// ```
//
// 절차·필드별 주의사항은 `docs/guides/closed-network-extensions.md`.

import type { AuthDefinition } from '../../contracts/auth'

// 등록 순서 = GUI 카탈로그 행 순서. `connection-views.ts` 의 view source 배열이 이 순서를
// 보존해야 한다(0188 D-029).
export const AUTH_DEFINITIONS: readonly AuthDefinition[] = []
