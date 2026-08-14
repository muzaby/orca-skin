// 사내 서비스 provider 선언 (0181) — Confluence 등 사내 REST.
//
// **기본값은 빈 배열이다**(0181 OQ3 — 서비스 인벤토리 미확정). 선언이 없으면 런타임 도구가
// 등록되지 않고, LLM 에 노출되는 도구 목록도 지금과 같다.
//
// `tools` 는 **자기 provider 에 묶인 컨텍스트**를 받아 런타임 도구 서버를 만든다. 등록/회수는
// 연결 상태를 따라간다 — 해제하면 도구가 스냅샷에서 사라진다. **provider 당 한 번만 호출되고
// 결과가 캐시된다**(`service/index.ts`) — 조립 결과에 요청 시점 상태를 굽지 마라.
//
// ⚠️ **id·label·origin 을 도구 쪽에 다시 적지 않는다.** 구 레시피는 같은 id 를 네 번(선언 ·
// 런타임 · `api.request` · 서버 팩토리) 쓰게 했고, 하나라도 어긋나면 도구는 모델에 보이는데
// 호출할 때마다 `unknown_provider` 로 죽었다. 이제 전부 `ctx` 에서 나온다.
//
// ⚠️ **컨텍스트 경로(`/confluence`)는 `origin` 이 아니라 도구 옵션(`apiBasePath`)으로 넘긴다.**
// `origin` 에 경로가 붙으면 등록 검사가 그 선언을 거부한다(`auth/registry.ts`).
//
// ⚠️ **`probe` 를 선언하라.** 없으면 값이 입력된 것만으로 "연결됨" 이 되고, 서버가 그 PAT 를
// 이미 회수했는지는 실제 도구 호출이 401 을 받을 때에야 드러난다.
//
// 절차·필드별 주의사항은 `docs/guides/closed-network-extensions.md §4`(레시피 C).
//
// 채우는 예 (아래 형태 그대로 typecheck·lint 통과를 확인했다):
//
// ```ts
// import { patSpec } from '../../features/auth/specs/credential'
// import { confluenceTools } from '../../features/plugins/confluence/tools'
//
// export const SERVICE_PROVIDERS: Provider[] = [
//   {
//     id: 'confluence',
//     label: 'Confluence',
//     kind: 'service',
//     origin: 'https://wiki.example.corp',   // 경로 없음
//     probe: { path: '/confluence/rest/api/user/current' },
//     auth: [
//       patSpec({
//         label: '개인 액세스 토큰(PAT)',
//         fieldLabel: '개인 액세스 토큰',
//         present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
//       })
//     ],
//     tools: (ctx) => confluenceTools(ctx, { apiBasePath: '/confluence' })
//   }
// ]
// ```

import type { Provider } from '../../contracts/auth'

export const SERVICE_PROVIDERS: Provider[] = []
