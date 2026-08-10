// 사내 서비스 provider 선언 (0181) — Confluence 등 사내 REST.
//
// **기본값은 빈 배열이다**(0181 OQ3 — 서비스 인벤토리 미확정). 선언이 없으면 런타임 도구가
// 등록되지 않고, LLM 에 노출되는 도구 목록도 지금과 같다.
//
// `tools` 는 인증된 `ProviderApi` 를 받아 런타임 도구 서버를 만든다. 등록/회수는 연결 상태를
// 따라간다 — 해제하면 도구가 스냅샷에서 사라진다.
//
// 채우는 예:
//
// ```ts
// export const SERVICE_PROVIDERS: Provider[] = [
//   {
//     id: 'confluence',
//     label: 'Confluence',
//     kind: 'service',
//     origin: 'https://wiki.example.corp',
//     auth: [
//       patSpec({
//         label: '개인 액세스 토큰(PAT)',
//         fieldLabel: '개인 액세스 토큰',
//         present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
//       })
//     ],
//     tools: (api) => createConfluenceToolServer(api, { providerId: 'confluence', contextPath: '' })
//   }
// ]
// ```

import type { Provider } from '../../../contracts/provider'

export const SERVICE_PROVIDERS: Provider[] = []
