// 사내 SSO 설정 — **배포가 편집하는 유일한 파일** (0178 §4).
//
// 여기에 값을 채우면 앱 로그인 게이트가 켜지고, 그 세션으로 사내 서비스가 재입력 없이 연결된다.
// 값이 `null` 이면 브라우저 세션 방식이 아예 등록되지 않는다 — 신규 설치 기본값이고, 그때
// `login.status().required` 는 false 라 게이트가 통과된다.
//
// **0178 이전에는 구현체(`providers/corp-adfs-wia.ts`)가 있는데 어떤 등록 목록에도 없었다.**
// 즉 코드가 존재하는데 SSO 로그인 자체가 동작하지 않았다 — 유일한 참조가 미등록 예제였다.
// 이제 아래 한 곳만 채우면 `methods/index.ts` 의 내장 목록에 들어간다.
//
// 채우는 예:
//
//   export const SSO_CONFIG: BrowserSessionConfig | null = {
//     id: 'corp-sso',                                   // 대상의 acceptedMethods 가 참조하는 값
//     label: '사내 SSO',
//     sessionGroup: 'corp',                             // 같은 이름끼리 cookie jar 를 공유한다
//     loginUrl: 'https://sso.corp/adfs/ls',
//     doneUrlPrefix: 'https://portal.corp/home',        // 이 주소에 닿으면 로그인 완료
//     authenticationProbeUrl: 'https://portal.corp/api/me',
//     allowedOrigins: ['https://sso.corp', 'https://portal.corp']
//   }
//
// **`id` 는 한 번 정하면 유지한다** — 대상 선언(`acceptedMethods`)과 vault 네임스페이스가 이
// 문자열에 묶인다. 주소만 바뀌면 URL 만 고친다.
//
// `allowedOrigins` 는 **경로 없는 origin** 이어야 한다(등록에서 거부된다). 로그인 리다이렉트가
// 거치는 origin 을 빠짐없이 적는다 — 빠지면 그 홉에서 요청이 조용히 막힌다.

import type { BrowserSessionConfig } from './browser-session'

export const SSO_CONFIG: BrowserSessionConfig | null = null
