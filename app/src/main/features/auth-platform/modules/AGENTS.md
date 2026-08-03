# `features/auth-platform/modules/` — 인증 패키지 opt-in 레지스트리

폐쇄망(사내) 배포가 **main 브랜치를 수정하지 않고** 자기 인증 provider·connector 를 붙이는 자리다.
0130 의 `features/sso/modules/` 를 승계하며 정책은 그대로다.

## 활성화 절차

1. `modules/<회사명>/` 디렉토리를 만들고 `AuthPluginPackage` 를 export 한다 (`_example/` 참조).
2. `modules/index.ts` 의 `AUTH_PLUGIN_PACKAGES` 배열에 한 줄 추가한다.

그 외 코어 코드(broker·registry·IPC·게이트)는 **수정하지 않는다.** 신규 설치의 기본값은 빈 배열
— 등록된 provider 가 0개면 `required:false` 로 로그인 게이트가 자동 통과된다(현행 동작 보존).

## 규칙

- 정적 connector는 fixed descriptor(origin 포함) 하나와 활성 연결 하나를 뜻한다. 동적 URL, alias, endpoint 입력을 만들지 않는다.
- connector별 runtime tool contribution은 connector ID를 명시하고 같은 factory로 구현한다. 서비스/부서 fixture 리터럴은 `__fixtures__/` 밖 core에 두지 않는다.
- **도구 handler 는 `RuntimeToolResult`(MCP 형상 — `{ content: [{ type:'text', text }], isError? }`)를 반환한다.** `ctx.invoke` 가 준 `ConnectorResult` 를 **그대로 반환하지 마라** — `content` 가 없으면 모델에게 "성공, 결과 없음" 으로 보이고 connector 오류까지 성공으로 뒤집힌다(0158 verify r1 D5). 실패는 `isError: true` 로 싣는다. 어긋난 형상은 SDK 경계에서 도구 실패로 거부된다. 변환 예시는 `__fixtures__/department-fixture-package.ts` 의 `toToolResult`.
- 연결이 끊긴 뒤의 `ctx.invoke` 는 **던진다.** 잡아서 성공으로 바꾸지 마라 — SDK 가 `isError` 로 변환한다.

- **빌드 타임 코드다.** 런타임 동적 로딩(임의 경로 `require()`/`import()`)은 금지 — 근거는
  `contracts/auth-plugin.ts` 헤더. "재빌드 없이 서비스 추가" 는 **MCP** 가 담당한다.
- **manifest 를 반드시 통과한다.** built-in 이라고 우회 등록로를 쓰지 않는다 — `manifest.ts` 의
  `PluginManifestSchema` + registry 의 중복·ABI·구현/선언 1:1 검사를 전부 지난다.
- **5메서드 전부 구현.** 미지원 동작은 메서드 부재가 아니라 `not_supported` 표준 결과.
- **선언한 origin 밖으로 못 나간다.** `allowedOrigins` 미선언 origin 요청·redirect 는 거부된다.
- **secret 은 `ctx.vault` 에만.** binding 결과·로그·renderer 응답에 값을 싣지 않는다.
- 복수 등록 가능하다 — 한 빌드에 provider 를 몇 개든 둘 수 있다(0130 의 "모듈 1개" 제약 해소).

## 게이트

`cd app && npm run lint && npm run typecheck`. 새 provider 는 conformance suite 에 한 줄 추가한다
(`features/auth-platform/conformance.test.ts` 의 `runConformance(...)` 호출부).
