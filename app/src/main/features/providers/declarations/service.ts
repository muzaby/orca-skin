// 사내 서비스 provider 선언 (0181) — Confluence 등 사내 REST.
//
// **기본값은 빈 배열이다**(0181 OQ3 — 서비스 인벤토리 미확정). 선언이 없으면 런타임 도구가
// 등록되지 않고, LLM 에 노출되는 도구 목록도 지금과 같다.
//
// `tools` 는 인증된 `ProviderApi` 를 받아 런타임 도구 서버를 만든다. 등록/회수는 연결 상태를
// 따라간다 — 해제하면 도구가 스냅샷에서 사라진다. **provider 당 한 번만 호출되고 결과가
// 캐시된다**(`service/index.ts`) — 조립 결과에 요청 시점 상태를 굽지 마라.
//
// ⚠️ **컨텍스트 경로(`/confluence`)는 `origin` 이 아니라 런타임 옵션(`apiBasePath`)으로 넘긴다.**
// `origin` 에 경로가 붙으면 등록 검사가 그 선언을 거부한다(`auth/registry.ts`).
//
// 절차·필드별 주의사항은 `docs/guides/closed-network-extensions.md §4`(레시피 C).
//
// 채우는 예 (아래 형태 그대로 typecheck·lint 통과를 확인했다):
//
// ```ts
// import { patSpec } from '../auth/specs/credential'
// import { createConfluenceRuntime } from '../service/confluence/connector'
// import { createConfluenceToolServer } from '../service/confluence/tools'
//
// export const SERVICE_PROVIDERS: Provider[] = [
//   {
//     id: 'confluence',
//     label: 'Confluence',
//     kind: 'service',
//     origin: 'https://wiki.example.corp',   // 경로 없음
//     auth: [
//       patSpec({
//         label: '개인 액세스 토큰(PAT)',
//         fieldLabel: '개인 액세스 토큰',
//         present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
//       })
//     ],
//     tools: (api) => {
//       const runtime = createConfluenceRuntime({
//         id: 'confluence',
//         label: 'Confluence',
//         baseUrl: 'https://wiki.example.corp',
//         apiBasePath: '/confluence'         // 컨텍스트 경로는 여기
//       })
//       return createConfluenceToolServer('confluence', 'Confluence', runtime, {
//         request: (req, signal) => api.request('confluence', req, signal),
//         logger: () => undefined
//       })
//     }
//   }
// ]
// ```

import type { Provider } from '../../../contracts/provider'

export const SERVICE_PROVIDERS: Provider[] = []
