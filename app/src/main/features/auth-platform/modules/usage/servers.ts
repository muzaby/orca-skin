// 사내 사용량 서버 목록 — **배포가 고치는 유일한 파일**.
//
// 기본값은 빈 배열이다. 사내 주소를 모르는 상태로 placeholder 를 넣으면 모든 사용자에게
// 연결되지 않는 카드가 보인다(0164 confluence 선례).
//
// 예시:
//
//   export const USAGE_CONNECTORS: readonly UsageConnectorConfig[] = [
//     {
//       id: 'usage-corp-llm',                     // = usage provider 가 구독하는 sourceId
//       label: '사내 LLM 사용량',
//       baseUrl: 'https://llm-portal.corp',
//       apiBasePath: '/api',                      // 컨텍스트 경로가 있는 배포만
//       probe: { operation: 'quota' },            // 없으면 요청 없이 연결된다
//       operations: {
//         quota: { method: 'GET', path: '/v1/quota', query: { scope: 'month' } },
//         detail: { method: 'GET', path: '/v1/quota/{team}' }   // {team} = params.team
//       }
//     }
//   ]
//
// **`id` 는 한 번 정하면 유지한다** — usage 모듈의 `subscription.sourceId` 와 binding 이 이
// 문자열에 묶인다. 주소만 바뀌면 `baseUrl` 만 고친다.

import type { UsageConnectorConfig } from './spec'

export const USAGE_CONNECTORS: readonly UsageConnectorConfig[] = []
