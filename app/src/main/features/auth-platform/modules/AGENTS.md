# `features/auth-platform/modules/` — 인증 패키지 opt-in 레지스트리

폐쇄망(사내) 배포가 **main 브랜치를 수정하지 않고** 자기 인증 provider·connector 를 붙이는 자리다.
0130 의 `features/sso/modules/` 를 승계하며 정책은 그대로다.

## 활성화 절차

1. `modules/<회사명>/` 디렉토리를 만들고 `AuthPluginPackage` 를 export 한다 (`_example/` 참조).
2. `modules/index.ts` 의 `AUTH_PLUGIN_PACKAGES` 배열에 한 줄 추가한다.

**동봉된 패키지**: [`confluence/`](confluence/AGENTS.md) — Confluence Data Center(0160·0161).
**기본 경로는 UI 다** — 사용자가 플러그인 페이지의 추가 버튼에서 서버를 만든다(템플릿이 이미
등록돼 있어 별도 활성화가 없다). 위 1~2번 절차는 사내 표준 서버를 코드에 미리 박아둘 때만
쓴다. 규칙 상세는 그 디렉터리의 `AGENTS.md`.

그 외 코어 코드(broker·registry·IPC·게이트)는 **수정하지 않는다.** 신규 설치의 기본값은 빈 배열
— 등록된 provider 가 0개면 `required:false` 로 로그인 게이트가 자동 통과된다(현행 동작 보존).

## 규칙

- **connector 는 두 출처를 갖는다** (0161). ⓐ **정적** — 코드 레벨 서버 목록(`<모듈>/servers.ts`)에서 오는 고정 descriptor. UI 에서 삭제할 수 없다. ⓑ **인스턴스** — 사용자가 템플릿으로 UI 에서 추가한 것. 둘 다 connector 하나 = 고정 origin = 활성 연결 하나이고, DTO 의 `source` 가 구분한다.
- **인스턴스 주소는 생성 후 불변이다.** `connectorId` 가 host+컨텍스트 경로에서 파생되고 그 ID 에서 도구 서버 ID·승인 키·다운로드 경로가 나온다 — 주소 수정은 그것들의 이동이므로 수정 채널을 두지 않고 삭제 후 재생성한다.
- **템플릿을 만들 때 패키지를 둘로 나눈다** — `sharedPackage()`(auth provider, 템플릿당 1회)와 `instancePackage()`(connector+tools, 인스턴스마다). registry 가 중복 provider id 를 거부하므로 합치면 **두 번째 서버 추가가 통째로 실패**한다. 계약은 `contracts/connector-template.ts`.
- **인증 방식이 둘 이상이면 `presentations` 로 mechanism 별 표현을 선언한다** (0160). `presentation` 하나로는 PAT(Bearer)와 ID/비밀번호(Basic)를 함께 표현할 수 없다. 선언하지 않은 mechanism 은 기본 `presentation` 으로 되돌아가므로 기존 패키지는 무변경으로 동작한다. ID/비밀번호는 `scheme:'BasicPair'`(secret 자체가 `user:pass`) — `'Basic'` 은 사용자명이 빈 값인 PAT-as-password 형식이라 다르다.
- **바이너리를 받으려면 `responseType:'binary'` 를 선언한다** (0160). 미지정은 `'text'` 이고, 그 경로는 `res.text()` 라 이미지·PDF 가 손상된다. `maxBytes` 로 상한을 함께 걸어 대용량 첨부가 main 메모리를 먹지 않게 한다.
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
