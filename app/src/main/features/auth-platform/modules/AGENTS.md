# `features/auth-platform/modules/` — 인증 패키지 opt-in 레지스트리

폐쇄망(사내) 배포가 **코어를 거의 건드리지 않고** 자기 인증 provider·connector 를 붙이는 자리다.

## 활성화 절차

1. `modules/<회사명>/` 디렉토리를 만들고 `AuthPackage` 를 export 한다.
2. `modules/index.ts` 의 `AUTH_PLUGIN_PACKAGES` 배열에 한 줄 추가한다.

```ts
export const AUTH_PLUGIN_PACKAGES = [
  createConfluencePackage(CONFLUENCE_SERVERS),
  createUsageConnectorPackage(USAGE_CONNECTORS)
] satisfies readonly AuthPackage[]
```

**동봉된 패키지**: [`confluence/`](confluence/AGENTS.md) — Confluence Data Center ·
[`usage/`](usage/AGENTS.md) — 범용 usage connector(설정 하나가 서버 하나).
**서버 목록의 정본은 각 모듈의 `servers.ts`** 다 — 배포는 그 파일만 고친다. 신규 설치의 기본값은
빈 배열이라 connector 0개로 부팅한다.

## 형태 강제는 타입 시스템이 한다 (0178)

`satisfies readonly AuthPackage[]` 가 컴파일 타임에 형태를 확정한다. 그래서 **manifest 도,
`apiVersion` ABI 도, 선언↔구현 대조도, conformance 하네스도 없다** — 전부 타입이 이미 참으로
만든 명제를 런타임에 재확인하던 것이라 0178 에서 걷어냈다(선언을 두 벌 적게 만들던 `declare.ts`
파생 helper 도 함께 사라졌다).

런타임에 남는 판정은 **타입으로 표현할 수 없는 둘**뿐이다 — 중복 id 거부, origin 형태 검사.
근거는 [`../registry.ts`](../registry.ts) 헤더.

> **앱 로그인 게이트를 실수로 켜지 마라.** `required` 는 `providersForTarget('application').length > 0`
> 이고, prod `RootGate` 는 그 값으로 앱 전체를 막는다(DEV 는 bypass 라 개발 중에는 안 보인다).
> **서비스 연결용 provider 는 반드시 `targets: ['connector']`** 로 좁힌다 —
> `createStaticCredentialProvider` 의 기본값은 `['application','connector']` 라 그냥 쓰면 게이트가 켜진다.

> **`targets: ['application']` 선언은 곧 "로그인 체인 멤버"다** (0172). 한 패키지가 application
> provider 를 둘 이상 기여하면 그 provider 들은 **하나의 논리 로그인**이 된다 — **등록 배열 순서**대로
> 실행되고(0178 이전에는 manifest 선언 순서였다), **전부 성공해야** `authenticated:true` 이며, 하나라도
> 실패하면 로그인 전체가 실패하고 그때까지 만들어진 보류 자원(vault secret·browser session)이 정리된다.
> "둘 중 아무거나로 로그인" 을 표현하려면 **패키지를 나눈다**.

## 패키지 공용 헬퍼 — 복사하지 말고 import 한다

| 파일 | 쓰임 |
|---|---|
| [`base-path.ts`](base-path.ts) | `normalizeBasePath` — 컨텍스트 경로(`/confluence`·`/api`)의 선두·꼬리 슬래시 정규화. |

## 규칙

- **connector 하나 = 서버 하나 = 고정 origin = 활성 연결 하나.** 주소는 코드 레벨(`servers.ts`)에서
  온다 — UI 추가 경로는 0178 에서 제거했다.
- **`id` 는 한 번 정하면 유지한다.** 도구 이름(`mcp__<server>__<tool>`)·승인 키·다운로드 경로가
  여기서 파생되고, 그 값들은 대화 기록과 승인 이력에 남는다. 주소가 바뀌면 `baseUrl` 만 고친다.
- **인증 방식이 둘 이상이면 `presentations` 로 mechanism 별 표현을 선언한다.** `presentation` 하나로는
  PAT(Bearer)와 ID/비밀번호(Basic)를 함께 표현할 수 없다. 선언하지 않은 mechanism 은 기본
  `presentation` 으로 되돌아간다. ID/비밀번호는 `scheme:'BasicPair'`(secret 자체가 `user:pass`) —
  `'Basic'` 은 사용자명이 빈 값인 PAT-as-password 형식이라 다르다.
- **바이너리를 받으려면 `responseType:'binary'` 를 선언한다.** 미지정은 `'text'` 이고 그 경로는
  `res.text()` 라 이미지·PDF 가 손상된다. `maxBytes` 로 상한을 함께 건다.
- **도구 handler 는 `RuntimeToolResult`(MCP 형상 — `{ content: [{ type:'text', text }], isError? }`)를
  반환한다.** `ctx.invoke` 가 준 `ConnectorResult` 를 그대로 반환하지 마라 — `content` 가 없으면
  모델에게 "성공, 결과 없음" 으로 보이고 connector 오류까지 성공으로 뒤집힌다.
- 연결이 끊긴 뒤의 `ctx.invoke` 는 **던진다.** 잡아서 성공으로 바꾸지 마라 — SDK 가 `isError` 로 변환한다.
- **빌드 타임 코드다.** 런타임 동적 로딩(임의 경로 `require()`/`import()`)은 금지 — 근거는
  `contracts/auth-plugin.ts` 헤더. "재빌드 없이 서비스 추가" 는 **MCP** 가 담당한다.
- **secret 은 `ctx.vault` 에만.** binding 결과·로그·renderer 응답에 값을 싣지 않는다.
- **선언한 origin 밖으로 못 나간다.** `allowedOrigins` 미선언 origin 요청·redirect 는 거부된다.
- **등록 실패는 화면에 뜬다.** 등록은 패키지 단위 **all-or-nothing** 이라 `baseUrl` 하나가 경로를
  달고 있으면 그 패키지의 provider·connector 가 **전부** 사라진다. 사유는 `orca:plugin:diagnostics`
  로 나가 플러그인 탭 배너에 뜬다 — 조용히 없어지지 않는다.

## 게이트

`cd app && npm run lint && npm run typecheck`.
