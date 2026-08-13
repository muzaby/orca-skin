// 앱 로그인 게이트 선언 (0181) — 사내 ADFS.
//
// **기본값은 빈 배열이다.** 게이트 provider 가 0개면 앱은 로그인 화면 없이 열린다
// (`gate/index.ts` 진리표 1행 · AC14). 폐쇄망 배포가 아래 주석의 실값을 채워 빌드하면 그때부터
// 로그인이 강제된다.
//
// 배열인 이유: 게이트를 소비하는 쪽이 전부 N 개를 전제한다(`registry.byKind('gate')` ·
// `evaluateGate({members})` · 로그인 체인의 "n/N" 라벨). 선언만 1개로 좁혀 두면 게이트가 둘인
// 배포가 이 파일 대신 `index.ts` 를 고치게 된다 — `LLM_PROVIDERS`·`SERVICE_PROVIDERS` 와도
// 모양이 어긋난다.
//
// ⚠️ **`id` 는 한 번 정하면 바꾸지 않는다** — vault 네임스페이스이자 `${BINDING:<id>}` 참조
// 대상이라, 바뀌면 저장된 grant 를 못 읽고 사용자가 적은 MCP 설정이 깨진다.
//
// ⚠️ **`origin` 은 로그인을 *시작* 하는 IdP 가 아니라 probe·토큰 교환이 *사는* 호스트다.**
// `loginUrl` 은 절대 URL 이라 어디를 가리켜도 되지만, `probe.path`·`config.exchange.path`·
// `config.whoami.path` 는 전부 **`Provider.origin` 기준 상대 경로**다. 아래 예처럼 교환이
// portal 에 있는데 `origin` 을 ADFS 로 두면 그 요청들이 엉뚱한 호스트로 나간다.
//
// ⚠️ **게이트는 `probe` 가 필수다.** 없으면 등록 검사가 거부한다(`auth/registry.ts`
// `missing_probe`) — 확인 없이 통과하는 게이트는 곧 우회다. 로그인 직후와 부팅 복원이 **같은**
// 선언을 쓴다.
//
// 실값(0181 OQ1·OQ2 · 0182 whoami — 사용자 확인 대기):
//   - `probe.path` · `loginUrl` · `doneUrlPrefix` · `sessionGroup` · `allowedOrigins`
//   - 토큰 교환이 필요하면 `config.exchange = { path, valuePath, expiresAtPath?, principalPath? }`
//   - 사이드바에 계정을 표시하려면 `config.whoami = { path, valuePath }` (0182)
//
// 절차·필드별 주의사항은 `docs/guides/closed-network-extensions.md §2`(레시피 A).
//
// 채우는 예 (아래 형태 그대로 typecheck 통과를 확인했다):
//
// ```ts
// export const GATE_PROVIDERS: Provider[] = [
//   {
//   id: 'corp-sso',
//   label: '사내 로그인',
//   kind: 'gate',
//   origin: 'https://portal.example.corp',   // ← probe·whoami·exchange 가 사는 호스트
//   // 로그인 직후와 부팅 복원이 같은 선언으로 판정된다. 2xx + 체인이 이 origin 으로 복귀 = 인증됨.
//   probe: { path: '/api/me' },
//   auth: [
//     {
//       kind: 'browser-session',
//       label: '통합 인증(WIA)',
//       config: {
//         sessionGroup: 'corp',
//         loginUrl: 'https://adfs.example.corp/adfs/ls/?wa=wsignin1.0',
//         doneUrlPrefix: 'https://portal.example.corp/home',
//         allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp'],
//         // 로그인한 계정을 사이드바 하단에 표시한다. **origin 기준 상대 경로**다
//         // (절대 URL 인 loginUrl 과 다르다) — 로그인 후 갱신을 `ProviderApi.request` 로
//         // 그대로 재사용할 수 있게 하기 위함이고, 그쪽은 절대 경로를 거부한다.
//         whoami: { path: '/api/me', valuePath: 'mail' }
//       }
//     }
//   ]
//   }
// ]
// ```
//
// **`whoami` 를 안 적으면** 조회 요청이 아예 나가지 않고 사이드바는 폴백 라벨을 쓴다.
// **조회가 실패해도 로그인은 성립한다** — principal 은 표시용이라 인증을 되돌리지 않는다.
// 값을 못 찾으면 `providers.session.whoami.failed` 로그가 `valuePath` 를 그대로 찍는다.

import type { Provider } from '../../../contracts/provider'

export const GATE_PROVIDERS: Provider[] = []
