// 사내 Confluence 서버 목록 (0160) — **배포가 편집하는 유일한 파일.**
//
// 서버 주소는 UI 가 아니라 **코드 레벨**에서 온다(사용자 결정 2026-08-03). 0158 의 정적
// connector 모델 그대로다 — connector 하나 = 서버 하나 = 고정 origin, 활성 연결 1개.
//
// ## 서버를 추가하려면 — **이 파일만 고친다** (0164)
//
// 아래 `CONFLUENCE_SERVERS` 배열의 주석을 풀고 값을 채운다. `modules/index.ts` 의
// `AUTH_PLUGIN_PACKAGES` 배선은 **이미 켜져 있다** — 배열이 비어 있으면 provider 2종만
// 등록되고 서버는 0개다(부팅에 문제 없음). 편집 지점이 둘이면 하나를 빠뜨리므로 하나로 줄였다.
//
// `id` 는 케밥 소문자여야 하고(manifest `IdSchema`), **바꾸면 도구 이름(`mcp__<server>__<tool>`)·
// 승인 키·다운로드 경로가 함께 바뀐다** — 대화 기록과 승인 이력에 남는 값이므로 **한 번 정하면
// 유지한다**. 주소를 바꿔야 하면 `baseUrl` 만 바꾸고 `id` 는 그대로 둔다.
//
// 그 외 코어 코드는 수정하지 않는다.
//
// ## baseUrl 과 apiBasePath
//
// `baseUrl` 은 **경로 없는 origin** 이어야 한다(manifest `OriginSchema` 가 강제). 컨텍스트 경로가
// 붙은 배포(`https://wiki.corp/confluence`)는 origin 을 `https://wiki.corp` 로 두고 경로를
// `apiBasePath: '/confluence'` 로 분리한다.

import type { ConfluenceServerConfig } from './connector'

// 저장소 기본값은 **비어 있다.** placeholder origin 을 기본 등록하면 모든 사용자에게 연결되지
// 않는 카드가 보인다. 사내 배포가 아래 두 자리를 자기 주소로 채운다.
//
// 두 서버를 쓰는 배포의 자리(주석을 풀고 값만 채운다):
//
//   {
//     id: 'confluence-dc',            // 한 번 정하면 유지 — 도구 이름·승인 키가 파생된다
//     label: '사내 위키',              // 목록에 보이는 이름
//     baseUrl: 'https://wiki.corp'    // 경로 없는 origin
//   },
//   {
//     id: 'confluence-lab',
//     label: '연구소 위키',
//     baseUrl: 'https://rnd.corp',
//     apiBasePath: '/confluence'      // 컨텍스트 경로가 붙은 배포만
//   }
export const CONFLUENCE_SERVERS: readonly ConfluenceServerConfig[] = []
