# ADR-011 — Usage 및 Harness config API 배포 factory의 로그인 프리 binder 확장

## 문제

ADR-006은 로그인 프리 체계(0248)를 도입하며 Harness·Usage에서 로그인 프리 binder 사용을 포기 항목으로 두었다.
그러나 사내 폐쇄망 배포에서는 공개 API 또는 로컬 API 키를 사용하는 사내 설정 API(config API)와 사용량 API(Usage)를
자격증명 없이 조립해야 하는 경우가 존재한다.
AS-IS 상태에서는 `UsageDeploymentDeps`와 `HarnessConfigApiDeps`의 `auth` 포트가 `bind`만을 제공하여,
로그인 프리 대상을 붙이려면 폐쇄망 배포자가 범용 `bootstrap.ts`를 수정해야 하거나 불가능했다.

## 검토한 선택지

| 선택지 | 판단 |
|---|---|
| `bind`가 로그인 프리 id도 투명하게 해석하게 한다 | 기각 — fail-closed 원칙 위반. `bind`는 자격증명 대상만 해석해야 하며, 로그인 프리 id는 `unknown_auth`로 거부되어 자격증명 성공을 위조하지 않아야 한다(ADR-006 invariant) |
| Bootstrap에서 직접 HTTP fetcher/augmenter를 조립하여 주입한다 | 기각 — `bootstrap.ts`는 폐쇄망 배포가 수정하지 않는 컴포지션 루트이다 |
| `AuthBinder`(`Pick<AuthRuntime, 'bind' \| 'bindLoginFreePlugin'>`)로 계약을 넓혀 factory에 제공한다 | 채택 — deps 타입 확장만으로 Bootstrap 수정 없이 폐쇄망 배포가 `bindLoginFreePlugin`을 호출할 수 있고, raw secret이나 인증 lifecycle은 계속 차단된다 |

## 선택

`contracts/auth.ts`의 `AuthBinder`를 `Pick<AuthRuntime, 'bind' | 'bindLoginFreePlugin'>`로 확장한다.
`UsageDeploymentDeps`, `HarnessConfigApiDeps`, `ConnectionDeploymentDeps`가 모두 이 `AuthBinder`를 공유한다(Harness config API는 `connectionValue`를 추가 교집합으로 보유).

- 배포자는 `createUsageFetcher` 및 `createConfigApiAugmenters` 안에서 `deps.auth.bindLoginFreePlugin(id)`를 호출해 로그인 프리 포트를 얻는다.
- `bind(loginFreeId).request`는 기존대로 `unknown_auth`로 거부된다(fail-closed 유지).
- raw credential을 열 수 있는 `bindForPlugin`이나 인증 lifecycle(`login`, `revoke`, `resume` 등)은 계속 노출되지 않는다.
- 로그인 프리 요청의 실패(401/403/네트워크 오류)는 Auth 상태 전이나 change를 일으키지 않으며, 배포 매퍼가 throw/오류로 처리한다.

## 포기한 것

- Usage deps에서의 `connectionValue` 노출 (요구 근거 부재).
- direct credential 방식에서의 로그인 프리 사용 (direct credential에는 secret 자체가 없음).

## 생긴 invariant

- `AuthBinder`는 `bind`와 `bindLoginFreePlugin`만을 제공하며, raw secret 및 인증 lifecycle에 접근할 수 없다.
- 두 deps에서 `bind(loginFreeId)`는 항상 `unknown_auth`로 실패하며, 로그인 프리 요청은 반드시 `bindLoginFreePlugin`을 거쳐야 한다.

## 관련

현재 구조: [auth.md](../arch/backend/auth.md) §3, §8 ·
배포 가이드: [폐쇄망 확장 가이드 §1.1, §4](../guides/closed-network-extensions.md#로그인-프리-원격-사용량config-api-레시피) ·
대체 원본: [ADR-006](006-login-free-auth-scheme.md)
