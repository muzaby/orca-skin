# `modules/usage/` — 범용 usage connector (0176)

사내 **사용량/quota API** 를 인증된 경로로 부르는 connector 패키지다. Confluence 패키지처럼
서비스 하나에 코드를 쓰는 것이 아니라, **설정 하나가 서버 하나**가 된다 — 사용량 API 는 배포마다
경로·쿼리·헤더가 다를 뿐 형태가 같기 때문이다("인증된 GET/POST 한 번, 응답 그대로 돌려주기").

## 왜 있나

0157 이후 자격증명은 broker 의 vault 에만 있고 `provider:<key>:` 네임스페이스(0130 핸드셰이크)에는
**쓰는 쪽이 없다.** 그래서 usage provider 는 자기 손으로 인증된 요청을 만들 수 없다. 이 connector
가 대신 부르고, usage provider 는 그 결과를 **구독**해 자기 포맷으로 매핑한다
(`contracts/usage-report.ts` §구독 경로).

```
USAGE_CONNECTORS[] → usage connector.invoke() → { status, contentType, payload }
                                                     │ (구독)
                                  usage provider 의 map(sample, ctx) → ExternalUsageReport
```

**이 connector 는 응답을 해석하지 않는다.** LLM provider 마다 반환 포맷이 다르므로 해석은 전적으로
구독자 몫이다.

## 서버 추가 — `servers.ts` **한 파일만** 고친다

```ts
export const USAGE_CONNECTORS: readonly UsageConnectorConfig[] = [
  {
    id: 'usage-corp',                    // = usage provider 가 구독하는 sourceId
    label: '사내 LLM 사용량',
    baseUrl: 'https://llm-portal.corp',  // 경로 없는 origin
    apiBasePath: '/api',                 // 컨텍스트 경로가 있는 배포만
    probe: { operation: 'quota' },       // 없으면 요청 0건으로 연결된다
    operations: {
      quota: { method: 'GET', path: '/v1/quota', query: { scope: '{scope}' } }
    }
  }
]
```

배열에 항목을 더하면 서버가 늘어난다 — **여러 LLM provider = 여러 usage connector**. 코어 코드는
손대지 않는다.

## 규칙

- **`id` 는 한 번 정하면 유지한다.** usage 모듈의 `subscription.sourceId`·binding 이 이 문자열에
  묶인다. 주소만 바뀌면 `baseUrl` 만 고친다.
- **`operations` 는 허용 목록이다.** 선언에 없는 operation 호출은 `invoke` 가 거부한다.
- **`{name}` 자리표시자만 치환된다.** 값은 `encodeURIComponent` 를 거치므로 `/`·`?` 가 든
  파라미터가 선언된 경로 밖으로 나가지 못한다. 선언되지 않은 파라미터는 요청에 새지 않는다.
- **`baseUrl` 은 경로 없는 origin.** 컨텍스트 경로는 `apiBasePath` 로 분리한다(등록이 형태를
  강제하고, 어긋나면 패키지가 **통째로** 거부된다 — 사유는 플러그인 탭
  배너에 뜬다).
- **4xx·5xx 는 표본이 아니라 실패다.** 오류 본문을 quota 로 읽는 map 이 나오면 잘못된 값이
  권위값으로 영속된다.
- **raw credential 을 보지 않는다.** `ctx.request({ target, … })` 만 부른다 — 이 디렉터리에
  vault·secret·전역 `fetch` import 가 하나도 없어야 한다(AUTH-PLAT-009).
- **인증 방식은 내장이다** (0178). 이 패키지는 방식을 만들지 않고 `acceptedMethods` 로 고를 뿐이다
  — 미지정이면 내장 PAT·ID/비밀번호 2종, 사내 SSO 를 쓰려면 `methods/sso.ts` 의 id 를 적는다.
- **UI 추가 경로는 없다.** 서버 목록의 정본은 빌드타임이다(0164 규약과 동일).

## 파일 구성

| 파일 | 책임 | 순수? |
|---|---|---|
| `spec.ts` | 설정 계약(`UsageConnectorConfig`·`UsageOperationSpec`) | 선언 |
| `request.ts` | operation 선언 → `AuthenticatedFetchRequest`(치환·인코딩·basePath) | ✅ 순수 |
| `payload.ts` | 응답 → `{status, contentType, payload}`(JSON 파싱 시도) | ✅ 순수 |
| `connector.ts` | `ConnectorRuntimeV1` — 위 둘을 부르는 오케스트레이션 | I/O |
| `servers.ts` | 빌드타임 서버 목록(기본 `[]`) | 데이터 |
| `index.ts` | 패키지 조립 — 설정 목록 → 대상 N. **인증 방식은 만들지 않는다**(0178) | 조립 |

## 게이트

```
cd app && npm run lint && npm run typecheck
./node_modules/.bin/vitest run src/main/features/auth-platform/modules/usage/
```

서버를 추가해도 테스트는 그대로다 — `usage-package.test.ts` 가 설정 2개로 factory 를 호출해
등록 성공과 ID 충돌 없음을 고정한다.
