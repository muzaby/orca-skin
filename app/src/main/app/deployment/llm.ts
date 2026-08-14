// LLM provider 선언 (0181) — 모델 게이트웨이의 인증.
//
// **기본값은 빈 배열이다.** 선언이 없으면 LLM 자격증명 주입 경로가 비활성이고, 모델 설정은
// 지금처럼 `sources/settings/<adapter>/<provider>/` 트리와 `orca.json` env 만으로 돈다.
//
// ── 두 갈래를 함께 지원한다 (사용자 결정: "둘다 쓰는데, 구현자·사용자 모두 골라서 선택") ──
//   ⓐ **API key** — 사용자가 값을 붙여 넣는다.
//   ⓑ **OAuth code→token** — 표준 흐름으로 토큰을 발급받는다. **추후 사용 예정**(0181 OQ4 답변).
// 배열에 둘 다 선언하면 GUI 가 **선언 순서대로** 선택지를 낸다. 하나만 선언하면 선택 단계가
// 생략된다.
//
// `llm.envKey` 는 자격증명을 실을 subprocess 환경변수 이름이다 — 인증된 값이 그 키로
// `Options.env` 에만 병합되고, settings.json 에는 **여전히 기록되지 않는다**(0028 결정 유지).
//
// 채우는 예 (OAuth · loopback redirect):
//
// ```ts
// export const LLM_PROVIDERS: Provider[] = [
//   {
//     id: 'corp-gateway',
//     label: '사내 모델 게이트웨이',
//     kind: 'llm',
//     origin: 'https://llm.example.corp',
//     llm: { adapter: 'claude', provider: 'corp', envKey: 'ANTHROPIC_AUTH_TOKEN' },
//     auth: [
//       apiKeySpec({
//         label: 'API 키',
//         fieldLabel: 'API 키',
//         present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
//       }),
//       {
//         kind: 'oauth',
//         label: '사내 계정으로 로그인',
//         present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
//         async authorize(ctx) {
//           const pkce = ctx.pkce()
//           const redirectUri = ctx.loopbackRedirectUri(OAUTH_PORT)
//           const url = new URL('https://llm.example.corp/oauth/authorize')
//           url.searchParams.set('response_type', 'code')
//           url.searchParams.set('client_id', 'orca-desktop')
//           url.searchParams.set('redirect_uri', redirectUri)
//           // SP 명세에 state 가 없으면 이 줄과 `ctx.state()` 를 **함께 뺀다** — 안 부르면
//           // 코어가 콜백에서 state 를 요구하지 않는다(부르면 echo 를 요구한다).
//           url.searchParams.set('state', ctx.state())
//           url.searchParams.set('code_challenge', pkce.challenge)
//           url.searchParams.set('code_challenge_method', pkce.method)
//           return {
//             url: url.toString(),
//             redirect: { kind: 'loopback', port: OAUTH_PORT },
//             exchange: async (code, verifier) => { … }   // POST /oauth/token
//           }
//         }
//       }
//     ]
//   }
// ]
// ```

import type { Provider } from '../../contracts/auth'

export const LLM_PROVIDERS: Provider[] = []
