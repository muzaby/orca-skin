# ADR-006 — 로그인 프리는 별도 인증 체계이며 같은 Plugin 소비 포트를 사용한다

## 문제

앱은 인증 없이 기본 제공할 LLM 도구를 표현해야 한다. 도구는 공개 API를 호출하거나,
플러그인 또는 호스트 프로그램이 이미 보유한 로컬 키를 사용하거나, 설치된 exe를 실행할 수
있다. 앱 로그인·다른 자격증명 변화에도 항상 인증된 Plugin과 같은 도구 등록·카탈로그·
Composer 참조·승인 정책을 사용해야 한다. 앱이 그 로컬 인증 수단을 관리할 필요는 없다.

## 검토한 선택지

| 선택지 | 판단 |
|---|---|
| 항상 valid인 가짜 `AuthDefinition`·grant를 만든다 | 기각 — vault·부팅 복원·게이트 멤버 경로를 타며 확인 없는 앱 로그인 통과를 만들 수 있다 |
| `AuthMethod`에 인증 없음 방식을 추가한다 | 기각 — 자격증명 store·로그인·복원·게이트에 무인증 분기가 퍼진다 |
| Plugin binding을 인증 필요·불필요 union으로 나눈다 | 기각 — 등록·wire·소비자가 각자 체계를 분기해 같은 취급이 분기 정합성에 의존한다 |
| Bootstrap에서 로그인 프리 서버를 직접 등록한다 | 기각 — 같은 Plugin 카탈로그·Composer 경로를 쓰지 못하고 배포가 범용 부팅 코드를 고쳐야 한다 |
| Auth 런타임에 로그인 프리 체계를 두고 같은 `BoundAuth` 형상을 공급한다 | 채택 — 소비 경로는 공유하고 자격증명 lifecycle은 분리한다 |

## 선택

`LoginFreeDefinition`·`LOGIN_FREE_DEFINITIONS`를 자격증명 선언과 별도 타입·배열로 둔다.
두 선언 타입은 서로 대입되지 않는다. id 공간은 공유하며 자격증명 등록이 우선한다. origin은
선택적이고 생략하면 HTTP 요청을 보내지 않는다.

`AuthRuntime.bindLoginFreePlugin`은 항상 valid·verified인 `LoginFreePluginAuth`를 공급한다.
자격증명 `PluginAuth`와 같은 `BoundAuth` 형상을 만족하므로 기존 `createPluginBinding`이
등록·도구 목록·승인 정책을 그대로 소유한다. 로그인 프리에는 `withCredential`이 없다.
`bind`·`tryBind`·`bindForPlugin`과 `AuthSecretReader`는 자격증명 대상만 해석하고 `describe`만
두 체계를 설명한다. 게이트·부팅 복원·Harness/Usage 자격증명·MCP binding에 로그인 프리
대상이 들어가지 않는다.

로그인 프리 HTTP는 Chromium sender와 같은 redirect 체인을 사용하되 앱 credential을
주입하지 않는다. 플러그인의 `Authorization`·`Cookie`를 포함한 헤더는 그대로 전달한다.
자격증명 요청의 예약 헤더 금지는 앱이 주입한 비밀을 보호하는 규칙이므로 그 체계에 유지한다.
상대 경로·origin 고정·redirect 재검사·응답 상한은 공유하고 401/403은 상태 전이 없이 반환한다.

로컬 키는 플러그인 또는 호스트 프로그램이 직접 사용한다. 앱의 키 저장·주입·검증·만료
판정·vault·UI를 만들지 않는다. exe는 `features/plugins/**`에서 직접 실행하며 공용 실행기를
추가하지 않는다. Plugin의 `child_process` import를 허용해도 Git runner 직접 import 금지는
유지한다.

wire는 필수 `ProviderInfo.authScheme`으로 체계를 전달한다. 로그인 프리 행은 기존
`kind:'service'`를 유지하고 `기본 제공`·`연결됨`으로 표시한다(0249). 인증 액션이나 사용자
끄기 기능은 없으며 도구는 항상 활성이다. 기본 배포의 로그인 프리 선언과 Plugin binding은
빈 배열을 유지한다. 실제 도구를 추가하는 배포는 별도 작업이다.

## 포기한 것

- 로그인 프리 로컬 인증 수단의 앱 관리와 별도 호스트 실행기.
- 사용자 on/off, 다중 origin, Harness·Usage의 로그인 프리 binder 사용.
- 런타임 임의 코드 로딩. 선언과 도구는 계속 빌드타임 코드다.

## 생긴 invariant

- 로그인 프리는 자격증명 lifecycle의 성공 결과를 위조하지 않는다. 항상 valid인 소비 포트가
  게이트 통과·raw credential 조회의 근거가 될 수 없다.
- Plugin 조립과 승인 정책은 인증 체계와 무관하게 같은 경로를 사용한다.
- 로그인 프리 요청에는 앱 인증 주입과 상태 전이가 없다. 로컬 키를 쓰는 헤더는 통과하되
  선언 origin 밖으로 전송하지 않는다.
- 로컬 키를 로그·도구 결과·renderer DTO로 반출하지 않는다. 호스트 실행은 절대 경로·셸
  미사용·timeout·취소·출력 상한을 적용한다.
- 인증 체계는 `authScheme`으로 판단하고 `ProviderKind`·빈 origin·방식 배열에서 추론하지 않는다.

## 관련

현재 구조: [auth.md](../arch/backend/auth.md) ·
보안 경계: [security.md](../arch/backend/security.md) ·
배포 절차: [폐쇄망 확장 가이드 §4](../guides/closed-network-extensions.md#로그인-프리-plugin-레시피) ·
wire: [IPC_CONTRACT.md](../IPC_CONTRACT.md)

관계 단일 축과 소비 슬롯 분리의 근거는 [ADR-004](004-provider-single-axis.md),
원격 전송 스택의 근거는 [ADR-003](003-electron-network-stack.md)을 유지한다.
