// 사내 Confluence 서버 목록 (0160) — **배포가 편집하는 유일한 파일.**
//
// 서버 주소는 UI 가 아니라 **코드 레벨**에서 온다(사용자 결정 2026-08-03). 0158 의 정적
// connector 모델 그대로다 — connector 하나 = 서버 하나 = 고정 origin, 활성 연결 1개.
//
// ## 서버를 추가하려면
//
// 1. 아래 배열에 항목 하나를 더한다. `id` 는 케밥 소문자여야 하고(manifest `IdSchema`),
//    **바꾸면 도구 이름과 다운로드 경로가 함께 바뀐다** — 대화 기록·승인 키에 남는 값이므로
//    한 번 정하면 유지한다.
// 2. `modules/index.ts` 의 `AUTH_PLUGIN_PACKAGES` 에 `createConfluencePackage(CONFLUENCE_SERVERS)`
//    한 줄을 추가한다.
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
// 않는 카드가 보인다. 사내 배포가 자기 서버를 여기 적고 index.ts 에 한 줄을 추가한다.
export const CONFLUENCE_SERVERS: readonly ConfluenceServerConfig[] = []

// 예시 (주석 해제해 쓰지 말고, 위 배열에 실제 값을 적는다):
//
// export const CONFLUENCE_SERVERS: readonly ConfluenceServerConfig[] = [
//   { id: 'confluence-dc', label: 'Confluence', baseUrl: 'https://wiki.corp' },
//   {
//     id: 'confluence-lab',
//     label: 'Confluence — 연구소',
//     baseUrl: 'https://rnd.corp',
//     apiBasePath: '/confluence'
//   }
// ]
