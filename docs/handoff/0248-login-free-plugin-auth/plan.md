# Plan — 0248-login-free-plugin-auth

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**

## 메타

| 항목 | 값 |
|---|---|
| slug | `0248-login-free-plugin-auth` |
| 작성자 | Claude Code |
| 일자 | 2026-10-02 |
| 매핑 | — (브랜치 `claude/0248-login-free-plugin-auth`) |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Codex — 기능 구현(계약 추가) |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 모든 Plugin은 Auth 하나에 묶이고 그 Auth가 `valid`일 때만 도구가 등록된다(`app/src/main/app/deployment/plugins.ts:57-68`). 인증 없이 앱이 기본 제공할 LLM 도구를 표현할 자리가 없다.
- **완료 후 달라지는 것**: 배포가 로그인 프리 대상을 선언하고 같은 Plugin 조립 경로에 올리면, 그 도구는 로그인·게이트 상태·다른 Auth 변화와 무관하게 항상 모델에 노출된다. 카탈로그는 그 행을 '기본 제공 · 인증 불필요'로 보여 준다.
- **성공을 한 문장으로**: 로그인 프리 플러그인은 로그인 없이, 항상 인증된 플러그인과 똑같이 도구를 제공한다.

## 2. 사용자 의도 / 요구 출처

라이브 세션(2026-10-02) 사용자 문장을 원문으로 인용한다.

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "플러그인 계약을 수정하고 싶다. 미로그인 플러그인도 가능하도록 인증 체계를 추가해야한다. (로그인 프리 플러그인). 로그인 프리 플러그인은 앱에서 인증없이 기본적으로 제공하는 llm 도구가 될 것이다." | T1 |
| 명시 요구 | "앱 로그인시에도 플러그인이 항상 인증됨 플러그인과 똑같은 취급을 받아야 할텐데 어떤 형태를 추천하나? 구조적으로 적절한 형태를 제안하라" | T2 (계약 축 질의 답) |
| 명시 요구 | "공개 api를 사용할 수 있다" | T2 (네트워크 질의 답) |
| 명시 선택 | 카탈로그 "행 표시·항상 켜짐" · 범위 "계약만" | T2 (선택지 답) |
| 명시 요구 | "로그인 프리 플러그인은 호스트에 설치된 다른 프로그램을 실행한다던지, public api 혹은 미리 발급된 인증키로 private api를 호출하기도 한다 이러한 상황에 맞도록 다시 검토해줘" | T3 |
| 명시 요구 | "예시의 사전발급된 인증키라는 건 로컬에 존재하는것이다. 그것을 앱 내부에서 고려할 필요가 없다" | T4 |
| 명시 요구 | "해석이 이상하다. 호스트에 설치된 Exe를 실행하능건데 실행기 필요있나?" | T5 |
| 추론 의도 | 로그인 프리 = "앱이 인증을 수행·관리하지 않는 Plugin". 키·exe의 인증은 플러그인이 로컬에서 스스로 해결한다 | T3·T4·T5 종합 — 추론 |
| 추론 의도 | 앱 기본 제공 도구가 될 것이므로 기본 빌드에서도 같은 계약으로 선언 가능해야 한다. 실제 도구는 후속이다 | T1 "될 것이다" + T2 "계약만" — 추론 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | Plugin 계약에 **로그인 프리 플러그인**을 추가한다 — 앱이 인증 없이 기본 제공하는 LLM 도구 | "미로그인 플러그인도 가능하도록 인증 체계를 추가" | T1 | ACTIVE | — |
| D-002 | 로그인 프리 플러그인은 앱 로그인(게이트) 상황을 포함해 **항상 인증된 플러그인과 똑같이 취급**한다 — 도구 등록·노출 도구 목록·`@` 후보·승인 정책이 같은 경로를 탄다 | "앱 로그인시에도 … 항상 인증됨 플러그인과 똑같은 취급" | T2 | ACTIVE | — |
| D-003 | 구조: 로그인 프리는 Auth 런타임의 **두 번째 인증 체계**로, 자격증명 Plugin과 같은 소비 포트(`BoundAuth` 형상)를 항상 valid 상태로 공급한다. 자격증명 lifecycle(store·vault·login·resume·gate)은 로그인 프리 대상을 모른다. 조립은 기존 `createPluginBinding` 한 경로다 | 소비 경로를 하나로 두어야 "똑같은 취급"이 분기 정합성이 아니라 구조로 성립한다. Plugin union·AuthMethod `'none'` 안은 기각(§4) | 설계자 제안 — T2 "구조적으로 적절한 형태를 제안하라", T3~T5 재검토 후 구조 이견 없음 | ACTIVE | — |
| D-004 | 로그인 프리 선언은 `AuthDefinition`과 **별도 타입·별도 배열**이고 두 타입은 서로 대입되지 않는다 | 게이트 목록·부팅 복원·vault 대상이 될 자리를 타입에서 없앤다 — 확인 없이 통과하는 게이트는 우회다(`auth.md §5.1`) | 설계자 (D-003 귀결) | ACTIVE | — |
| D-005 | 로그인 프리 플러그인은 **공개 API**를 호출할 수 있다 — 포트의 `request()`가 선언 origin으로 HTTP를 보낸다(Chromium 스택) | "공개 api를 사용할 수 있다" | T2 | ACTIVE | — |
| D-006 | 사전 발급 키 등 **로컬 인증 수단은 앱이 고려하지 않는다** — 저장·주입·검증·만료 판정·vault·UI가 없다. 플러그인(또는 그 exe)이 로컬에서 스스로 쓴다 | "로컬에 존재하는것이다. 그것을 앱 내부에서 고려할 필요가 없다" | T4 | ACTIVE | — |
| D-007 | 로그인 프리 `request()`는 플러그인이 붙인 헤더(`Authorization`·`Cookie` 포함)를 **그대로** 보낸다. 상대 경로·origin 고정·redirect 홉 재검사·응답 상한은 유지한다 | 예약 헤더 금지는 앱이 주입한 자격증명을 보호하는 규칙이다(`policy.ts:16-18`). 로그인 프리에는 주입이 없다. origin 고정이 플러그인 키의 타 host 유출을 막는다 | T3 "미리 발급된 인증키로 private api를 호출" + D-006 귀결 | ACTIVE | D-007a 대체 |
| D-007a | (1차 제안) 로그인 프리 `request()`에도 예약 헤더 금지를 유지한다 | 로컬 키로 private API를 부르는 T3 요구를 막는다 | 설계자 1차 제안 | SUPERSEDED | D-007 |
| D-008 | 로그인 프리 대상은 **상태 전이가 없다** — `snapshot()`은 항상 `valid`·`verified`이고, 401/403 응답은 그대로 반환하며 강등·change 방송·도구 회수를 하지 않는다 | 사용자가 재인증할 수단이 없고(D-006) "항상 인증됨" 취급이다(D-002) | 설계자 (D-002·D-006 귀결) | ACTIVE | — |
| D-009 | 호스트 exe 실행은 **별도 실행기 없이 플러그인 코드가 직접** 한다. 이를 막는 lint(`child_process`는 Git gateway·runner만)를 `src/main/features/plugins/**`에 한해 연다. Git runner 직접 import 금지는 플러그인에도 유지한다 | "Exe를 실행하능건데 실행기 필요있나?" — 인자·timeout·취소·출력 처리는 플러그인이 소유한다 | T5 | ACTIVE | D-009a 대체 |
| D-009a | (1차 제안) infra에 범용 호스트 프로그램 실행기를 신설한다 | 사용자가 불필요하다고 판단 | 설계자 1차 제안 | SUPERSEDED | D-009 |
| D-010 | 카탈로그: 연결 탭 행으로 표시하고 종류 '기본 제공', 상태 '인증 불필요'로 쓴다. 인증·재인증·연결 해제 액션은 없다. 노출 도구는 항상 활성이고 Composer `@` 후보에 들어간다. 사용자가 끌 수 없다 | 선택지 "행 표시·항상 켜짐" | T2 | ACTIVE | — |
| D-011 | 범위는 **계약만**이다 — 실제 로그인 프리 플러그인 0개. 기본 배포 `LOGIN_FREE_DEFINITIONS`·`createPluginBindings()`는 `[]`를 유지하고(0237 D-030 유지) 비어 있지 않은 가상 배포 테스트로 검증한다 | 선택지 "계약만" | T2 | ACTIVE | — |
| D-012 | 이름: `LoginFreeDefinition` · `LOGIN_FREE_DEFINITIONS` · `AuthRuntime.bindLoginFreePlugin` · `LoginFreePluginAuth` · `AuthScheme` · wire `ProviderAuthScheme = 'login-required' \| 'login-free'` · `ProviderInfo.authScheme` | 배포 소스·wire에 노출되는 one-way door. 질의에 이름을 명시해 제시했고 변경 요청이 없었다 | 설계자 제안 — T5 시점 | ACTIVE | — |
| D-013 | **id 공간 공유** — 로그인 프리 id도 케밥 소문자이며, `AuthDefinition` id·앞선 로그인 프리 id와 겹치면 그 로그인 프리 선언만 거부한다(자격증명 대상 우선) | 카탈로그 행 id·`@` 토큰·`<id>-tools` 서버 이름이 한 공간이다(`runtime-tool-policy.ts:13-15`, 0238 D-006) | 설계자 | ACTIVE | — |
| D-014 | `origin`은 **선택**이다 — 없으면 `request()`가 전송 없이 거부되고 카탈로그 '주소' 행을 숨긴다(wire `origin: ''`). 형식 규칙은 `AuthDefinition.origin`과 같다 | exe만 쓰는 플러그인에는 origin이 없다(D-009). 비-HTTP authority 허용·`request()` HTTP(S) 전용은 0237 D-051과 같은 규칙 | 설계자 | ACTIVE | — |
| D-015 | 로그인 프리 포트에는 `withCredential`이 **없다** — 자격증명이 필요한 플러그인 서버(`PluginAuth` 요구)는 타입상 로그인 프리 포트로 조립되지 않는다 | 앱 소유 자격증명이 없다(D-006) | 설계자 | ACTIVE | — |
| D-016 | 자격증명 binder(`bind`·`tryBind`·`bindForPlugin`)와 `AuthSecretReader`는 로그인 프리 id를 해석하지 않는다. `describe`만 두 체계를 설명한다 | 게이트 멤버 선택(`tryBind`)·부팅 복원·Harness/Usage·MCP `${BINDING}`에 들어가지 못하게 한다(fail-closed) | 설계자 (D-003·D-004 귀결) | ACTIVE | — |
| D-017 | `PluginDeploymentDeps` 슬롯은 auth·registry·logger 그대로다 — `auth` 능력에 `bindLoginFreePlugin` 하나를 더한다 | 0237 D-048 "auth만 받는 서버, 계약 슬롯 증식 금지" 유지 | 설계자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-017(신규 handoff).
- 변경된 결정: D-007a → D-007(T3·T4), D-009a → D-009(T5). 둘 다 설계자 1차 제안을 사용자 재검토 요청이 대체했다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0237 D-030·D-048, 0238 D-006·D-008·D-017, 0188 D-024·D-029·D-030(§16).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-002 ↔ AC1·AC2·AC3·AC13(같은 경로 단언) · D-007 ↔ AC5·AC6(헤더 통과 + origin 고정) · D-008 ↔ AC7 · D-010 ↔ AC11·AC12·AC13 · D-011 ↔ AC15 · D-016 ↔ AC4 · D-017 ↔ AC17(`PluginDeploymentDeps`로 컴파일) — 반대를 요구하는 AC 0.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **타당** — 무인증 도구를 표현할 자리가 계약에 없다 | `plugins.ts:57-68` sync가 `status==='valid'`만 등록, 포트 생산자는 `runtime.ts:197-230` 하나 |
| 이미 기존 코드가 충족하는가 | **아니오** — `orca_artifacts`는 무인증 상시 도구지만 카탈로그 행·`@` 후보 밖이다(D-010 불충족) | `bootstrap.ts:947` 직접 등록, `features/artifacts/tool.ts:28-31` |
| 더 작은 해법이 있는가 | 기각 2건 — ① valid grant를 seed한 가짜 `AuthDefinition`: vault·resume·게이트 경로를 타 D-006·D-016 위반, 게이트 우회 위험 ② artifact처럼 bootstrap 직접 등록: 카탈로그·`@` 불가, 배포가 `bootstrap.ts`를 고쳐야 함 | `auth.md §5.1`, `closed-network-extensions.md §1.1` "bootstrap.ts 는 열지 않는다" |
| 대안 구조와 비교했는가 | 기각 2건 — ③ `PluginBinding`을 `인증 필요 \| 로그인 프리` union으로 가르는 안: sync·view·`syncPlugins`·renderer마다 분기가 생겨 "똑같은 취급"(D-002)이 분기 정합성에 달린다 ④ `AuthMethod` `'none'`: store·login·resume·gate·vault 전부에 분기가 생기고 게이트 멤버가 되면 우회다 | `plugins.ts:57-68`, `connection-views.ts:62-82`, `features/gate/index.ts:150-172` |
| 선행 자료의 주장을 코드와 대조했는가 | 일치 — "Plugin은 `request()`·`withCredential()`" | `auth.md:626-630` ↔ `contracts/auth.ts:440-447` |
| 선행 자료의 주장을 코드와 대조했는가 | 일치 — "Auth가 valid일 때만 등록" | `closed-network-extensions.md:748-749` ↔ `plugins.ts:58` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 0 — 0237 D-048(D-017)·D-030(D-011), 0188 D-029(새 kind 금지 — `kind`는 `'service'` 유지, 새 필드는 kind가 아님) | §16 |
| 문서 원칙과 충돌하는가 | 확장 필요 — `auth.md §1` "Auth 는 인증하고 인증된 능력만 제공한다" | AC19가 그 문장을 로그인 프리 체계까지 고친다 |
| 보안 규칙과 충돌하는가 | 확장 필요 — `child_process` lint 경계(D-009), raw secret 예외 표는 vault 소유 값 대상이라 로컬 키(D-006)는 표 밖 | `eslint.config.mjs:177-188`, `security.md §1.4-b` |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: 게이트 화면은 `kind==='gate'` 행만 쓴다(`useProviderGate.ts:84`, `principal.ts:23`). `@` 후보는 `tools.length>0`으로만 판별한다(`pluginMention.ts:21`). `revoke`는 grant 없는 id에 change를 내지 않는다(`store.ts:283-286`, `login.ts:252`).

## 5. 동작 / 사용자 흐름

```text
[배포] LOGIN_FREE_DEFINITIONS 선언 + createPluginBindings 에서 bindLoginFreePlugin → createPluginBinding
  → [부팅] 첫 sync: snapshot 항상 valid → 도구 서버 등록 (게이트 판정·resume 이전)
  → [사용] 연결 탭 '기본 제공 · 인증 불필요' 행 · 새 채팅 도구 노출 · Composer @<id>
  → [도구 호출] 공개 API / 로컬 키 private API(request) · 호스트 exe(child_process) → 결과
  ↘ [실패] 정책 거부·응답 오류·exe 실패 → 그 호출의 tool error. 상태·등록은 그대로
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 부팅 | 등록 검사 → `bindLoginFreePlugin` → `createPluginBinding.sync()` → registry add 1회 | 첫 snapshot부터 도구 존재 |
| 게이트 필요 빌드 — 로그인 전 | 도구는 이미 등록, 메인 셸은 게이트 뒤 | 로그인 화면(로그인 프리 행은 게이트 화면에 없다) |
| 게이트 로그인·재인증·해제·만료, 다른 Plugin Auth 변화 | change는 자기 `authId` Plugin만 sync한다 | 로그인 프리 도구 유지(remove 0) |
| 도구 호출 — 공개 API | `request()` → origin 고정 전송 | 응답 결과 |
| 도구 호출 — 로컬 키 private API | 플러그인이 헤더를 붙여 `request()` | 응답 결과. 401/403도 상태 불변 |
| 도구 호출 — 호스트 exe | 플러그인이 `child_process`로 실행 | 플러그인이 만든 tool result |
| `request()` — origin 미선언·절대 경로·origin 밖 redirect | `AuthPolicyError`, 전송 0 또는 다음 홉 0 | 그 호출의 tool error |
| 선언 오류(id 중복·형식, origin 형식) | 그 선언만 거부 + `auth.declaration.rejected` 진단 | 행 없음. 그 id를 바인딩하는 배포는 부팅에서 실패(기존 `bindForPlugin` 미등록 id와 같은 규칙) |
| IPC `login`·`reauth`·`revoke`에 로그인 프리 id(UI는 부르지 않음) | `unknown_provider` 실패 step / revoke `absent` | 상태 불변 |

### 파생 UX / 엣지케이스

- loading / empty / error: 기본 빌드는 로그인 프리 행 0이라 빈 목록 문구가 그대로다.
- cancel / retry / close / restart: 로그인이 없어 인증 재시도가 없다. 도구 호출 취소는 `RuntimeToolContext.getSignal()`을 `request(signal)`·exe 실행에 넘기는 플러그인 몫이다.
- concurrency / multi-session: 상태가 상수라 경쟁이 없다.
- keyboard / a11y / theme: 기존 행·상세 컴포넌트를 그대로 쓴다. 상태 점 색은 `valid` tone(green)이다(`ProviderDetail.tsx:17`).
- 외부환경/폐쇄망: 공개 API 도달 실패는 플러그인의 tool error이고 상태는 불변이다.

## 6. 범위 / 비범위

- **범위**: 로그인 프리 선언·등록 검사·포트(`snapshot`·`request`)·런타임 바인딩·`describe`, Plugin 배포 능력, 부팅 배선, 카탈로그 wire `authScheme`, renderer 표시(목록·상세·액션·i18n), `child_process` lint 경계, 테스트, 문서(auth·security·가이드·IPC·GLOSSARY·ADR).
- **비범위**: 실제 로그인 프리 플러그인(D-011) · 로컬 키 저장·주입(D-006) · 범용 exe 실행기(D-009) · 사용자 on/off(D-010) · 로그인 프리 대상을 Harness 실행 구성·Usage·MCP `${BINDING}`에 쓰는 것(D-016) · 다중 origin.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 다중 origin | 아니오 — 선택 필드를 더하면 기존 선언이 그대로 유효하다 | 후속 |
| on/off 토글 | 아니오 — 설정 키 추가로 확장 | 후속 |
| Harness·Usage의 로그인 프리 사용 | 아니오 — binder 확장으로 가능 | 후속 |
| 이름·wire 필드 | **예** — 배포 소스·wire 계약 | 지금 확정(D-012) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 로그인 프리 선언 + `bindLoginFreePlugin` + `createPluginBinding` → 첫 `sync()`에서 서버가 registry에 등록된다. 자격증명 Auth가 전부 `none`이어도 같다 | 테스트: 가상 배포 → `registry.snapshot().servers`에 `<id>-tools` 존재 | `createAuthRuntime` → `bindLoginFreePlugin` → `createPluginBinding.sync` → `RuntimeToolRegistry.add` |
| R-01 | AT-01 / AC2 | 다른 Auth의 commit·revoke·만료·401 강등 change를 실제 handler에 흘려도 로그인 프리 서버 id의 registry 호출은 add 1회·remove 0회이고 snapshot은 `{status:'valid', verified:true, credentialRevision:0}` 그대로다 | 테스트: registry spy의 서버 id별 호출 수 + `subscribe`가 받은 snapshot change 중 로그인 프리 id 0건 | `AuthRuntime.subscribe` → `createRuntimeModelAuthChangeHandler` → `syncPlugins` |
| R-01 | AT-01 / AC3 | 게이트 멤버가 있는 가상 배포에서 게이트 미통과 → 로그인 → 게이트 해제 전 구간에 로그인 프리 서버가 snapshot에 있다. 같은 구간 자격증명 Plugin은 자기 상태대로 등록·회수된다(대조군) | 테스트: 구간마다 두 서버의 존재를 단언 | 위 경로 + `selectGateMembers`·`createGate` |
| R-02 | AT-02 / AC5 | `request()`는 `${origin}${path}`(+query)로 나간다. 앱은 `Authorization`·`Cookie`를 주입하지 않는다 — 플러그인이 헤더를 넣지 않으면 그 헤더 0, fetch init은 `credentials:'omit'`. 플러그인이 넣은 `Authorization`·임의 헤더는 그대로 1회 전달된다 | 테스트: stub fetch가 받은 URL·init 헤더·`credentials` 단언 | `LoginFreePluginAuth.request` → `checkLoginFreeRequest` → 공유 redirect 루프 → `createSender` |
| R-02 | AT-02 / AC6 | 절대 URL·`//host` 경로는 `absolute_path`로 거부된다. origin 밖 Location redirect는 따르지 않고 `origin_not_allowed`(다음 요청 0)다. 같은 origin redirect는 따라가 `finalUrl`에 반영되고 5홉 상한을 지킨다. `maxBytes` 초과는 `ResponseTooLargeError`다. origin 미선언·비-HTTP origin은 전송 0으로 거부된다 | 테스트: 케이스별 예외 종류·reason + stub 호출 수 | 같음 |
| R-02 | AT-02 / AC7 | 401·403 응답(요청의 `authFailureStatuses`를 줘도)은 `ok:false`로 그대로 반환되고 snapshot·`subscribe` change·registry가 바뀌지 않는다 | 테스트: 응답 단언 + change 0건 + registry 호출 0건 | 같음 + `AuthRuntime.subscribe` |
| R-03 | AT-03 / AC18 | `src/main/features/plugins/**`의 `child_process`·`node:child_process` 정적·동적 import는 경계 규칙 위반 0이다. 그 밖 main 경로(예: `features/worktrees`)는 기존대로 error다. plugins에서 `infra/git/runner` import는 `import/no-restricted-paths` error를 유지한다 | `node --test scripts/git-boundary.test.mjs` — ESLint `lintText`로 경로별 메시지 단언 | `npm run lint`(CI 게이트) |
| R-04 | AT-04 / AC10 | 로그인 프리 plugin row의 `ProviderInfo`는 `{kind:'service', authScheme:'login-free', origin: 선언값 또는 '', auth:[], status:'valid', activeAuthKind:null, principal:null, expiresAt:null, tools: 완전 이름, catalog}`다. 자격증명 row(gate·harness·plugin·usage)는 `authScheme:'login-required'`이고 나머지 필드는 불변이다 | 테스트: `connectionInfo`·가상 배포 `connectionState` 행 단언 | `describe` → `connectionInfo` → `orca:provider:list`/`state` |
| R-04 | AT-04 / AC11 | 목록: 로그인 프리 행 detail은 '기본 제공'(인증 방식 라벨 없음), trailing은 '인증 불필요'다. 자격증명 행 표시는 불변이다 | 테스트: `providerRowMeta` 순수 단언 + `CustomizeList` render 트리 텍스트 | provider state → `CustomizeList` |
| R-04 | AT-04 / AC12 | 상세: 로그인 프리 행은 인증·재인증·연결 해제 컨트롤이 0개다. 상태 '인증 불필요'·종류 '기본 제공'을 쓰고, 노출 도구 목록은 보이되 비활성 안내는 없다. `origin:''`이면 '주소' 행이 없고 선언하면 보인다 | 테스트: `providerAuthActionKind`='none' + `ProviderAuthActions`·`ProviderDetail` render 트리 단언 | provider state → `ProviderDetail` |
| R-04 | AT-04 / AC13 | tools가 있는 로그인 프리 행은 Composer `@` Plugin 후보와 `validPluginIds`에 들어간다(status·authScheme 무관한 기존 규칙) | 테스트: `pluginMentionCandidates`에 로그인 프리 fixture | provider state → `useMentionAutocomplete` |
| R-05 | AT-05 / AC4 | 로그인 프리 id는 `tryBind`→`null`, `selectGateMembers`→blocked `unregistered`(게이트 닫힘), `secretReader.read`→`null`, `bind(id).request`→`AuthPolicyError('unknown_auth')`다. 타입상 `LoginFreeDefinition`은 `AuthDefinition[]`·`GateAuthDefinition[]`에, `AuthDefinition`은 `LoginFreeDefinition[]`에 들어가지 않는다 | 테스트: 런타임 단언 + `@ts-expect-error` 3건(`npm run typecheck`) | `createAuthRuntime`·`selectGateMembers`·`createAuthSecretReader` |
| R-05 | AT-05 / AC9 | `bindForPlugin(로그인 프리 id)`·`bindLoginFreePlugin(자격증명 id)`·`bindLoginFreePlugin(미등록 id)`는 각각 던진다. 로그인 프리 포트에는 `withCredential`이 없어 `PluginAuth` 요구 자리에 넣으면 컴파일 오류다 | 테스트: throw 단언 + `@ts-expect-error` | `AuthRuntime` |
| R-06 | AT-06 / AC8 | 로그인 프리 id가 `AuthDefinition` id 또는 앞선 로그인 프리 id와 같으면 `duplicate_id`, 케밥 아님은 `invalid_id`, origin 형식 오류는 `invalid_origin`으로 그 선언만 거부되고 `rejected`에 `scheme:'login-free'`로 실린다. origin 생략은 통과하고 자격증명 등록 결과는 불변이다 | 테스트: registry 순수 단언 | `createAuthRuntime(deps.loginFreeDefinitions)` → `rejected` → `auth.declaration.rejected` |
| R-06 | AT-06 / AC15 | 기본 배포: `LOGIN_FREE_DEFINITIONS`는 `[]`, production `createPluginBindings()`는 `[]`, production `createConnectionSources()`에 로그인 프리 행 0 | 테스트: production export 직접 호출 | `app/deployment/*` |
| R-06 | AT-06 / AC16 | Bootstrap이 `LOGIN_FREE_DEFINITIONS`를 `createAuthRuntime({ loginFreeDefinitions })`로 넘긴다 — 인자가 빠지거나 다른 식별자면 실패한다 | 테스트: `bootstrap.ts` 소스 스캔(주석·문자열 제거 후 정규식) + 가드 자체 감도 케이스 | `Bootstrap.createAuthStack` |
| R-06 | AT-06 / AC17 | 가이드 §4 로그인 프리 레시피 예제(선언 + `createPluginBindings`)가 실제 `PluginDeploymentDeps`·`LoginFreeDefinition` 타입으로 컴파일되고, 가상 배포에서 도구 등록과 `request()`까지 동작한다 | 테스트: 가이드 예제와 같은 코드를 가상 배포로 실행 | 배포 파일 → Bootstrap 능력 |
| R-07 | AT-07 / AC14 | 기존 자격증명 Plugin 회귀 0: `createPluginBinding` 가시성(none/expired/unknown 미등록·valid 등록·반복 sync revision 불변), revoke 시 회수·이름 유지, `AuthenticatedRequester` 정책(redirect 재검사·홉 사이 grant 확인·강등·후보 비강등)과 renderer 액션(none→인증, 그 외 dropdown). **신규 1케이스**: 자격증명 요청이 origin 밖 Location을 받으면 다음 홉을 보내지 않고 `origin_not_allowed`로 끝난다 | 기존 케이스 전부 green(§7 주의사항 목록) + 신규 케이스 | 기존 경로 |
| R-08 | AT-08 / AC19 | 문서가 D-003~D-016을 서술한다 — `auth.md` §1·§2·§3·§7·§9·§11, `security.md`(로컬 키·exe 경계·로그인 프리 요청), 가이드 §0 라우팅·§1.1·§4, `IPC_CONTRACT.md` provider:list `authScheme`, `GLOSSARY.md`, ADR-006 + `decisions/README.md` 목록. `check-doc-inventory --check` green | 문서 diff 대조 + `node scripts/check-doc-inventory.mjs --check` | 문서 |
| R-04 | AT-09 / AC20 | **사람 실기**: 로컬 임시 배포(커밋하지 않음)로 로그인 프리 행을 띄워 라이트·다크 두 테마에서 목록·상세(상태 점 색·버튼 부재·도구 목록·주소 유무)가 깨지지 않는다 | 사람 실기 — `npm run dev` | 연결 탭 |

### AC 검증 주의사항

- 기존 테스트 재사용(케이스 존재 확인): `plugins.test.ts:71`(`%s 는 등록하지 않는다`)·`:82`(`valid 면 등록하고 그 외에는 회수한다`)·`:104`(반복 sync revision), `deployment-wiring.test.ts:331`(해제 시 회수·이름 유지)·`:517`(기본 배포 비어 있음), `connection-views.test.ts:73`(ProviderInfo 전 필드), `scripts/git-boundary.test.mjs:31-48`(`child_process` 3케이스), `ProviderAuthActions.render.test.ts:76`, `pluginMention.test.ts:32`.
- 기존 테스트 공백(실측): requester를 거쳐 origin 밖 redirect 차단을 보는 케이스가 없다 — `rg -n "origin_not_allowed\|redirect-blocked" app/src/main/features/auth/*.test.ts` → `policy.test.ts:93`(순수 판정) 1건뿐이고, `authenticated-request.test.ts`의 홉 케이스(`:235`·`:246`·`:256`·`:284`)는 홉 사이 grant 변화만 본다. redirect 루프를 공유 함수로 옮기므로(EP-06) AC14에 신규 케이스를 둔다.
- 사람 실기 항목: AC20만이다 — 테마별 시각이라 기계 판정이 없다. 판정 로직(라벨·액션·주소 유무)은 AC11·AC12 render·순수 테스트로 내렸다.
- N회 기준(AC2): sink는 `RuntimeToolSink.add/remove`다. 프로덕션 호출부는 `plugins.ts:59`(add)·`plugins.ts:67`(remove)·`bootstrap.ts:947`(artifact add — 다른 서버 id) 3곳이다. 로그인 프리 서버 id로 오는 호출은 `createPluginBinding.sync()` 하나뿐이고, sync 호출부는 `bootstrap.ts:453`(부팅 1회)과 `bootstrap.ts:769-771`(change의 authId 일치 시) 둘이다. 테스트의 `syncPlugins` 클로저는 `bootstrap.ts:769-771`의 모형이므로, 둘째 자리는 "런타임이 로그인 프리 id로 snapshot change를 내지 않는다"(`subscribe` 수신 0건)로 직접 단언한다.
- 0건 기준(AC5): 허용 대상(플러그인이 넣은 헤더)과 제거 대상(앱 주입)을 나눈다 — 헤더를 넣지 않은 요청에서 `authorization`·`cookie` 0, 넣은 요청에서 같은 값 1.
- 0건 기준(AC7): 상태 전이 0은 change 수신 0·registry 호출 0·snapshot 동일 세 관측의 곱으로 단언한다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V** — 신규 handoff이고 상속할 명시 V가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 로그인 프리 도구 항상 노출(D-002) | NEW | — |
| R-02 | R | §7 공개 API·로컬 키 private API 호출(D-005~D-008) | NEW | — |
| R-03 | R | §7 호스트 exe 직접 실행 가능(D-009) | NEW | — |
| R-04 | R | §7 카탈로그·Composer 표시(D-010) | NEW | — |
| R-05 | R | §7 게이트·자격증명 경로 진입 불가(D-004·D-015·D-016) | NEW | — |
| R-06 | R | §7 배포 계약·등록 검사·기본 배포 불변(D-011~D-014·D-017) | NEW | — |
| R-07 | R | §7 기존 자격증명 Plugin 불변 | NEW | — |
| R-08 | R | §7 문서 계약 | NEW | — |
| AT-01~AT-08 | AT | §7 AC1~AC19 | NEW | — |
| AT-09 | AT | §7 AC20 사람 실기 | NEW | — |
| SD-01 | SD | §5 상태 전이표 · §13 — 로그인 프리 수명주기(선언→등록→부팅 sync→Auth change·IPC에 불변) | NEW | — |
| ST-01 | ST | AC2·AC3 수명주기 테스트 | NEW | — |
| AR-01 | AR | §9·§10 런타임 두 체계 등록·바인딩·`describe` | NEW | — |
| AR-02 | AR | §9·§10 로그인 프리 요청 경로(정책→공유 redirect 루프→Chromium 전송) | NEW | — |
| AR-03 | AR | §9·§12 wire `authScheme` 생산→renderer 소비 | NEW | — |
| AR-04 | AR | §9·§15 배포 계약 경로(선언→Bootstrap→배포 능력→조립) | NEW | — |
| AR-05 | AR | §10 `child_process` lint 경계 | NEW | — |
| IT-01~IT-05 | IT | AR-01~AR-05 통합 테스트 | NEW | — |
| MD-01 | MD | §11 registry 등록 검사(공유 id 공간) | NEW | — |
| MD-02 | MD | §11 `checkLoginFreeRequest` + 공유 redirect 루프(SSOT) | NEW | — |
| MD-03 | MD | §11 renderer 순수 판정(`providerRowMeta`·`canManageAuth`·`providerAuthActionKind`) | NEW | — |
| UT-01~UT-03 | UT | MD-01~MD-03 단위 테스트 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 배포 선언 → `bindLoginFreePlugin` → `createPluginBinding.sync` → registry → 첫 턴 snapshot | AC1~AC3 서버 존재 | required — "같은 경로" 위반 변이 **M1**: `sync()`에 로그인 프리 분기(`return`) 삽입 → AC1 red (자리: `plugins.ts` sync) | EP-01·EP-02 (2) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 도구 handler → `request()` → 정책 → redirect 루프 → `createSender` → 응답 | AC5~AC7 | required — 0건 주장. **M2** 앱 `Authorization` 주입, **M2b** 플러그인 헤더를 버리고 앱 값으로 교체(형제 슬롯 맞바꿈), **M3** 로그인 프리 경로만 `checkRedirect` 생략, **M4** 401에서 상태 `expired`+change 발행 → 각각 AC5·AC5·AC6·AC7 red | EP-03·EP-04·EP-05 (8) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `features/plugins/**` 소스 → ESLint config → `npm run lint` | AC18 경로별 메시지 | required — lint 설정은 구조 장치. **M9** plugins를 ignores에서 제거, **M10** ignores를 `features/**`로 확장, **M11** plugins를 git runner 경로 블록에서도 제외 → 각각 AC18 plugins·worktrees·runner 케이스 red | EP-15 (2) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `describe` → `connectionInfo` → wire → `providerRowMeta`·`providerAuthActionKind` → `CustomizeList`·`ProviderDetail`·`ProviderAuthActions`·`pluginMentionCandidates` | AC10~AC13 | required — 형제 슬롯. **M6** loginFree status/kind 키 맞바꿈, **M7** 로그인 프리 → `'authenticate'` → AC11·AC12 red | EP-10·EP-11 (8) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | `selectGateMembers(tryBind)` · `bind`/`bindForPlugin`/`secretReader` | AC4·AC9 | required — 비해석(0건) 주장. **M5a** `tryBind`가 로그인 프리 id도 바인딩, **M5b** `bindForPlugin`이 로그인 프리 포트 반환, **M5c** requester registry가 로그인 프리 id 해석 → AC4·AC9 red | EP-07·EP-08 (9) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | `LOGIN_FREE_DEFINITIONS` → `bootstrap.ts` → `createAuthRuntime` → registry → 배포 능력 → 조립 | AC8·AC15~AC17 | required — 소스 스캔은 구조 oracle. **M8** bootstrap 인자 삭제, **M8b** `loginFreeDefinitions: []`로 교체 → AC16 red. **M12** 로그인 프리 등록이 자격증명 id를 공유 공간에 넣지 않음 → AC8 red | EP-09·EP-12·EP-13·EP-14 (6) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | 기존 자격증명 Plugin 경로 전부 | AC14 기존 케이스 green | not selected — 기존 케이스가 직접 행동 oracle이다. 공유 루프 추출의 민감도는 VP-17이 갖는다 | EP-06 (2) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | 문서 6종 + ADR 목록 | AC19 문서 대조 + inventory check | not selected — 직접 대조 | EP-16 (8) |
| VP-09 | SD-01 ↔ ST-01 | REQUIRED | 부팅 sync → Auth change 4종(commit·revoke·만료·401) → handler → `syncPlugins` → registry | AC2·AC3 구간별 존재 + add/remove 수 | required — N회 주장. **M4**(VP-02와 같은 변이)가 remove 1을 만들어 AC2 red. 자리: `login-free.ts` request·`runtime.ts` emit | EP-01·EP-03 (3) |
| VP-10 | AR-01 ↔ IT-01 | REQUIRED | `createAuthRuntime(deps)` → registry 두 목록 → `bind`·`tryBind`·`bindForPlugin`·`bindLoginFreePlugin`·`describe` | AC4·AC8·AC9 런타임 단언 | required — VP-05 M5a~M5c와 같은 변이를 런타임 테스트에서 심는다 | EP-07·EP-09 (8) |
| VP-11 | AR-02 ↔ IT-02 | REQUIRED | `bindLoginFreePlugin(id).request` → stub fetch | AC5~AC7 | required — VP-02 M2·M2b·M3·M4를 런타임 경유 테스트에서 심는다 | EP-04·EP-05·EP-06 (8) |
| VP-12 | AR-03 ↔ IT-03 | REQUIRED | 가상 배포 `connectionState` → `ProviderInfo` | AC10 | not selected — 필드 전수 등치(`toEqual`) 직접 oracle | EP-10 (2) |
| VP-13 | AR-04 ↔ IT-04 | REQUIRED | production `app/deployment/*` export + 가이드 예제 + bootstrap 스캔 | AC15~AC17 | required — VP-06 M8·M8b와 같다 | EP-12·EP-13·EP-14 (4) |
| VP-14 | AR-05 ↔ IT-05 | REQUIRED | `eslint.config.mjs` → `lintText` | AC18 | required — VP-03 M9~M11과 같다 | EP-15 (2) |
| VP-15 | MD-01 ↔ UT-01 | REQUIRED | `registerAuthDefinitions(declared, loginFree)` | AC8 순수 단언 | required — **M12** | EP-09 (2) |
| VP-16 | MD-03 ↔ UT-03 | REQUIRED | `providerRowMeta`·`canManageAuth`·`providerAuthActionKind` | AC11·AC12 순수 단언 | required — **M6**·**M7** | EP-11 (3 — 순수 함수 자리) |
| VP-17 | MD-02 ↔ UT-02 | REQUIRED | `checkLoginFreeRequest` · `followRedirects` | AC6 정책 단언 + AC14 신규 자격증명 redirect 차단 케이스 | required — SSOT 주장. **M13** 공유 루프에서 `checkRedirect`를 지우면 **두 경로 모두**(로그인 프리 AC6, 자격증명 AC14 신규 케이스) red여야 한다 — 기존 케이스만으로는 자격증명 쪽이 green으로 남는다(§7 주의사항) | EP-05 첫 두 자리(첫 요청 판정·홉 판정) · EP-06 (4) |
| VP-18 | R-04 ↔ AT-09 | REQUIRED | `npm run dev` → 연결 탭(라이트·다크) | AC20 사람 관측 | not selected — 시각 실기 | 0 + 시각 판정이라 자리 없음 |

`§10 강제 지점 전수`의 N은 §10 항목 수가 아니라 **자리 수**다. 같은 변이가 여러 자리에서 가능하면 VP 행에 자리를 적었다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 정적 | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 현재 변경이 유발한 error만 blocking |
| app 비-DB 테스트 | main auth·deployment·views, renderer 표시 | `./node_modules/.bin/vitest run src/main/features/auth src/main/app/deployment src/main/app/connection-views.test.ts src/main/app/runtime-model-startup src/main/features/gate src/renderer/src/features/skills src/renderer/src/features/chat/lib src/renderer/src/features/chat/hooks/useMentionAutocomplete.test.ts src/renderer/src/shared/i18n` | 변경 무관 DB 로드 스위트 실패는 ABI 기준선(`app/AGENTS.md`)으로 분리 |
| lint 경계 테스트 | eslint 설정 변경 | `cd app && node --test scripts/git-boundary.test.mjs` | blocking |
| 문서 인벤토리 | docs 수정 | `cd app && node scripts/check-doc-inventory.mjs --check` | blocking |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |
| CI | PR/CI 통합 정본 | `.github/workflows/ci.yml`(windows) | 최종 판정은 CI |

> 보안 제약(게이트 우회 불가·origin 고정·로컬 키 비관리)은 VP-02·VP-05·D-006에 귀속했다. 이 표는 새 제품 범위를 만들지 않는다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| Plugin 조립은 `createPluginBinding({auth: BoundAuth, server, registry, catalog})` 하나이고 sync가 `status==='valid'`면 add, 아니면 remove | `app/src/main/app/deployment/plugins.ts:36-42`·`:57-68` |
| 배포 능력은 `PluginDeploymentDeps = {auth: Pick<AuthRuntime,'bindForPlugin'>, registry, logger?}` | `plugins.ts:75-79` |
| 기본 배포 `createPluginBindings()`·`AUTH_DEFINITIONS`·`GATE_AUTH_DEFINITIONS`는 `[]` | `plugins.ts:85-88`, `auth-definitions.ts:48`, `gate-auth.ts:13` |
| 소비 포트: `BoundAuth{authId, snapshot, request}`, `PluginAuth = BoundAuth + label·origin·withCredential` | `contracts/auth.ts:434-447` |
| `AuthDefinition{id,label,origin,methods,probe?}` — `methods` 필수, `GateAuthDefinition = AuthDefinition & {probe}` | `contracts/auth.ts:315-334` |
| `AuthDescriptor{authId,label,origin,methods}` — 소비자는 `connection-views.ts:63` 하나 | `contracts/auth.ts:419-424` |
| 런타임 `bind`(검증 없음)·`bindForPlugin`(미등록 throw)·`tryBind`(registry 조회)·`describe`(미등록 throw) | `features/auth/runtime.ts:197-246` |
| 등록 검사 = 중복 id·케밥 id(`AUTH_ID_RE`)·bare origin. 거부는 그 선언만 | `features/auth/registry.ts:31`·`:40-93` |
| 요청 정책 = 상대 경로·예약 헤더(`authorization`·`cookie`·`proxy-authorization`)·grant valid·origin | `features/auth/policy.ts:18`·`:64-76` |
| redirect 루프(5홉·홉별 `checkRedirect`·홉 사이 grant 확인)는 `AuthenticatedRequester.send` 안에만 있다 | `features/auth/authenticated-request.ts:38`·`:202-237` |
| 전송은 `createSender(fetchImpl)` — `credentials:'omit'`·`redirect:'manual'` | `infra/net/transport.ts:50-62` |
| 부팅: `createAuthRuntime({definitions: AUTH_DEFINITIONS…})` → 거부 진단 → 게이트 멤버(`tryBind`) → plugins 생성·1회 sync | `app/bootstrap.ts:318`·`:355-368`·`:379`·`:448-453` |
| Auth change는 `credentialChanged`일 때만 같은 authId Plugin을 sync | `app/runtime-model-startup.ts:91-106`, `bootstrap.ts:769-771` |
| 게이트 멤버 선택은 `tryBind`가 `null`이면 `unregistered`로 막고 게이트를 닫는다 | `features/gate/index.ts:150-172` |
| wire `ProviderInfo` — `kind`·`origin: string`·`auth[]`·`status`·`tools`·`catalog?` | `app/src/shared/ipc.ts:1748-1769` |
| renderer 행 메타·액션: `STATUS_KEYS`/`KIND_KEYS`·`canManageAuth = status!=='none'`·액션 `'authenticate'\|'dropdown'` | `providerRows.ts:21-53`, `providerAuthActionModel.ts:4-13` |
| 상세: 주소 행 무조건 표시, 도구 비활성 안내는 `status!=='valid'`일 때 | `ProviderDetail.tsx:112-113`·`:140-144` |
| 목록 detail = `kind · (activeLabel ?? '알 수 없음')` | `CustomizeList.tsx:113` |
| `@` 후보 = `tools.length>0` | `pluginMention.ts:21` |
| `child_process` import는 `infra/git/{gateway,runner}.ts`·테스트만 허용, runner 경로 import는 전부 금지 | `app/eslint.config.mjs:177-188` |
| ESLint 경계를 `lintText`로 검증하는 선례 | `app/scripts/git-boundary.test.mjs:5-75` |
| bootstrap 배선을 소스 스캔으로 검증하는 선례(`stripCommentsAndStrings`) | `deployment-wiring.test.ts:686-714` |
| 외부 SDK/API | 해당 없음 — Runtime Tool·SDK 경계 불변 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `ProviderInfo` 생산처 | `rg -n "activeAuthKind:" app/src -g '!*.test.*'` | 1 | `connection-views.ts:76`(나머지 1건은 `ipc.ts:1757` 타입 선언) |
| `ProviderInfo` 테스트 fixture | `rg -c "activeAuthKind:" app/src -g '*.test.ts'` | 16 | 12파일 16자리 — 필수 `authScheme` 추가 대상 |
| `createAuthRuntime(` 호출부 | `rg -n "createAuthRuntime\(" app/src` | 30 | bootstrap 1 + 테스트 29 — `loginFreeDefinitions`를 optional로 두는 근거 |
| `AuthRuntime.describe` 소비 | `rg -n "auth\.describe\(" app/src/main` | 1 | `connection-views.ts:63` |
| `tryBind` 소비 | `rg -n "\.tryBind\(" app/src/main -g '!*.test.ts'` | 5 | `auth-resume.ts:88·113·201·214`, `bootstrap.ts:379` — 전부 자격증명 선언 목록 입력 |
| `bindForPlugin` 프로덕션 호출 | 같은 방식 | 0 | 기본 배포 비어 있음(주석 예시 `plugins.ts:82`만) |
| `RuntimeToolSink` add/remove 프로덕션 호출 | `rg -n "registry\.(add\|remove)\(\|runtimeTools\.add\(" app/src/main -g '!*.test.ts'` | 3 | `plugins.ts:59·67`, `bootstrap.ts:947` |
| snapshot `AuthChange` 발행 자리 | `rg -n "publish\(\|emitSnapshot\(" features/auth/runtime.ts` + `onSnapshot` 호출 | 4 | `snapshot()` 만료 정착, requester 강등·만료, LoginService `onSnapshot`, `withCredential` reject — 전부 자격증명 store/registry 경유. step change(`onStep`)는 별도이고 sync를 부르지 않는다 |
| renderer `authScheme` 소비 자리 | 설계 대상 | 6 | `providerRowMeta`·`canManageAuth`·`providerAuthActionKind`·`ProviderAuthActions`·`CustomizeList` detail·`ProviderDetail` 주소 행 |
| `child_process` 비-테스트 import | `rg -ln "child_process" app/src/main -g '!*.test.ts' -g '!*.testfixture.ts'` | 1 | `infra/git/runner.ts` |
| renderer `ProviderInfo` 소비 파일(비-테스트) | `rg -l "ProviderInfo" app/src/renderer -g '!*.test.*'` | 17 | 그중 표시·액션 6자리만 바뀐다. 게이트 화면 2곳은 `kind==='gate'` 필터라 불변 |

### 수치 / 전칭 표현 검산

- 재측정: `docs/generated/inventory.md`의 contracts 모듈 5·IPC 채널 100·settings 키 19는 바뀌지 않는다 — 새 타입은 `contracts/auth.ts` 안, 새 채널·설정 키 0.
- 내역 합 = 총계: fixture 16 = connection-views 1 + useMentionAutocomplete 1 + pluginMention 1 + principal 2 + CustomizeList 1 + ProviderAuthActions.render 1 + ProviderAuthActions 1 + providerAuthWiring 1 + ProviderDetail 2 + catalogOrder 1 + pluginPresentation 1 + providerRows 3.
- "`child_process`는 Git gateway만" 반례 검색: 비-테스트 import 1건(runner)뿐이다.
- "로그인 프리 id로 snapshot change가 나가지 않는다": snapshot 발행 4자리(`runtime.ts` `snapshot()` 만료 정착·requester 강등/만료·LoginService `onSnapshot`·`withCredential` reject) 모두 자격증명 `store`/`registry.get`을 거친다 — 로그인 프리 id는 거기 없다. 반례 1건: IPC `login`을 로그인 프리 id로 직접 부르면 `unknown_provider` **step** change가 나간다(`login.ts:464`). step change는 `syncPlugins`를 부르지 않는다(`runtime-model-startup.ts:100`).
- 문서 앵커 확인: `auth.md` §7(L624)·§9(L687)·§11(L757), 가이드 §0(L18·L33)·§1.1(L55)·§4(L746), `IPC_CONTRACT.md` provider:list(L460), `security.md` §1.4-b(L44)·§1.10(L184), `GLOSSARY.md` Plugin(L43), `decisions/README.md` 목록.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`~`AR-05`
- 현재 책임 소유자: Auth 런타임이 모든 Plugin 포트를 공급하고, 포트는 자격증명 grant 상태를 따른다.
- 현재 흐름: `AUTH_DEFINITIONS` → `createAuthRuntime` → `bindForPlugin` → `createPluginBinding.sync`(valid만 add) → registry → 첫 턴. 카탈로그는 `describe`+`snapshot` → `ProviderInfo`.
- 현재 오류/정리 경로: 401/403·만료 → `markExpired` → change → `syncPlugins` → remove.
- 문제의 직접 원인: 포트 생산자가 자격증명 체계 하나뿐이라 무인증 Plugin을 표현할 수 없다. `child_process`가 Git 전용이라 플러그인이 exe를 실행할 수 없다.

```text
AUTH_DEFINITIONS ─► createAuthRuntime ─► AuthRegistry(자격증명) ─► store·login·resume·gate·vault
plugins.ts: deps.auth.bindForPlugin(id) ─► PluginAuth ─► createPluginBinding.sync()
   valid ? registry.add : registry.remove            ◄── AuthChange(credentialChanged) ─ syncPlugins
connection-views: auth.describe(id) + snapshot() ─► ProviderInfo{kind:'service'} ─► renderer
eslint: child_process = infra/git/{gateway,runner}.ts 만
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`~`AR-05`
- 변경 후 책임 소유자: Auth 런타임이 **두 체계**의 포트를 공급한다. 로그인 프리 목록은 `bindLoginFreePlugin`·`describe`만 보고 자격증명 lifecycle은 보지 않는다.
- 변경 후 흐름: `LOGIN_FREE_DEFINITIONS` → `createAuthRuntime({loginFreeDefinitions})` → `bindLoginFreePlugin` → **같은** `createPluginBinding.sync`(항상 valid → add) → registry. 카탈로그는 `describe().scheme` → `ProviderInfo.authScheme`.
- 변경 후 오류 경로: 로그인 프리 `request()` 실패는 예외·응답으로만 나가고 상태 전이가 없다.
- 유지: `createPluginBinding`·sync 규칙·`syncPlugins`·자격증명 요청 정책·wire `kind`. 대체: redirect 루프를 공유 함수로 옮긴다(동작 불변). 신설: 로그인 프리 포트·정책 함수·wire 필드·lint 예외.

```text
AUTH_DEFINITIONS ──────┐
LOGIN_FREE_DEFINITIONS ┴► createAuthRuntime ─► AuthRegistry
                                               ├ 자격증명 목록 ─► store·login·resume·gate·vault (불변)
                                               └ 로그인 프리 목록 ─► bindLoginFreePlugin · describe 만
plugins.ts: bindForPlugin(자격증명) | bindLoginFreePlugin(로그인 프리) ─► 같은 createPluginBinding.sync()
login-free request: checkLoginFreeRequest ─► followRedirects(공유) ─► createSender(netFetch) ─► 응답(전이 0)
connection-views: describe(id).scheme ─► ProviderInfo.authScheme · origin ?? '' ─► renderer 표시 분기
eslint: child_process = infra/git/{gateway,runner}.ts + features/plugins/** (runner import 금지는 유지)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 포트 생산자 = 자격증명 체계 하나 | 두 체계, 자격증명 lifecycle은 로그인 프리를 모름 | D-003·D-016 | AR-01 / VP-10 · `runtime.ts`·`registry.ts` |
| data/control flow | Plugin sync가 grant 상태를 따름 | 같은 sync가 로그인 프리 포트의 상수 valid를 따름 | D-002 | SD-01 / VP-09 · `login-free.ts` |
| state/contract | `AuthDescriptor` 단일 형상, wire에 체계 없음 | `AuthDescriptor` scheme union, `ProviderInfo.authScheme` 필수 | D-010·D-012 | AR-03 / VP-12 · `contracts/auth.ts`·`ipc.ts` |
| 요청 정책 | 예약 헤더 금지·grant 확인·강등 | 로그인 프리: 헤더 통과·전이 0, origin 고정 동일 | D-007·D-008 | AR-02 / VP-11 · `policy.ts`·`login-free.ts` |
| redirect 루프 | requester 내부 1벌 | 공유 함수 1벌, 두 경로가 호출 | SSOT | MD-02 / VP-17 · `request-chain.ts` |
| 프로세스 실행 경계 | Git만 | Git + `features/plugins/**` | D-009 | AR-05 / VP-14 · `eslint.config.mjs` |
| test seam/관측점 | 가상 배포가 자격증명만 | 가상 배포에 로그인 프리 + registry spy + 소스 스캔 | AC2·AC16 | VP-09·VP-13 · `deployment-wiring.test.ts` |

AS-IS에서 사라지는 책임은 없다 — redirect 루프는 **이동**(공유 함수)이고 동작은 같다.

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `contracts/auth.ts` | 두 체계의 타입 계약 | 타입 | features·app |
| `features/auth/registry.ts` | 두 목록 등록 검사·공유 id 공간 | 선언 → 목록·거부 | `runtime.ts` |
| `features/auth/policy.ts` | 로그인 프리 요청 판정(순수) | facts → PolicyResult | `login-free.ts` |
| `features/auth/request-chain.ts`(신규) | `withQuery`·`followRedirects`·응답 변환(순수) | 준비된 요청 → 결과 | `authenticated-request.ts`·`login-free.ts` |
| `features/auth/login-free.ts`(신규) | 로그인 프리 포트 생성(순수, fetch 주입) | 선언 + sender → `LoginFreePluginAuth` | `runtime.ts` |
| `features/auth/runtime.ts` | 체계별 바인딩·describe | deps → `AuthRuntime` | `bootstrap.ts`·테스트 |
| `app/deployment/{auth-definitions,plugins}.ts` | 배포 선언·조립 | 상수·factory | `bootstrap.ts` |
| `app/connection-views.ts` | wire 매핑 | descriptor·snapshot → `ProviderInfo` | IPC 핸들러 |
| renderer `providerRows`·`providerAuthActionModel` | 표시·액션 순수 판정 | `ProviderInfo` → 키·액션 | 컴포넌트 |
| `features/plugins/**` | (후속 플러그인) exe 실행·요청 | — | 배포 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| EP-01 · SD-01 / VP-01·VP-09 | 로그인 프리 snapshot 상수 `{status:'valid', verified:true, credentialRevision:0}` | `login-free.ts` 포트 `snapshot()` (1자리) | 런타임 | 모든 호출 | 도구가 회수되거나 카탈로그가 다른 상태를 보인다 |
| EP-02 · R-01 / VP-01 | 같은 조립 경로 — `createPluginBinding.sync()`에 체계 분기 0 | `plugins.ts:57-68` (1) | 배포 조립 | sync마다 | "똑같은 취급"(D-002) 붕괴 |
| EP-03 · R-02·SD-01 / VP-02·VP-09 | 상태 전이 0 — 로그인 프리 요청 경로는 store·`onUnauthorized`·`onExpired`를 받지 않고(deps 구조), 런타임은 로그인 프리 id로 snapshot change를 내지 않는다 | `login-free.ts` deps (1) · `runtime.ts` 발행 자리 (1) | 런타임 | 요청·change마다 | 401 한 번에 도구가 회수된다 |
| EP-04 · R-02 / VP-02·VP-11 | 앱 주입 0 + 플러그인 헤더 통과 | 요청 조립(`headers = {...req.headers}`, `applyPresentation` 미호출) (1) · `checkLoginFreeRequest`에 헤더 검사 없음 (1) · `createSender` `credentials:'omit'` (1, 기존) | 요청 경로 | 요청마다 | 로컬 키 호출 불가(D-007) 또는 앱 자격증명 유출 |
| EP-05 · R-02 / VP-02·VP-11·VP-17 | origin 고정 | 첫 요청 `checkLoginFreeRequest` (1) · 공유 루프 홉별 `checkRedirect` (1) · origin 미선언·비-HTTP 전송 전 거부 (1) | 요청 경로 | 요청·홉마다 | 플러그인 키가 다른 host로 간다 |
| EP-06 · MD-02 / VP-07·VP-17 | redirect 루프 SSOT | `request-chain.ts` `followRedirects`를 부르는 자리: `AuthenticatedRequester.send` (1) · 로그인 프리 request (1) | 두 요청 경로 | 요청마다 | 두 벌이 갈라져 한쪽만 재검사 |
| EP-07 · R-05 / VP-05·VP-10 | 자격증명 binder 비해석 | `runtime.bind`(requester가 자격증명 registry만 조회) (1) · `tryBind` (1) · `bindForPlugin` (1) · `secretReader.read`(store 엔트리 없음) (1) · `selectGateMembers`(tryBind 경유, 기존) (1) · 부팅 복원 입력 = `AUTH_DEFINITIONS`(구조) (1) | 런타임·부팅 | 바인딩·게이트 선택·복원 | 로그인 없이 게이트 통과(우회) |
| EP-08 · R-05 / VP-05 | 타입 상호 비대입 | `LoginFreeDefinition{methods?: never; probe?: never}` (1) · `AuthDefinition.methods` 필수(기존) (1) · `LoginFreePluginAuth`에 `withCredential` 없음 (1) | 컴파일러 | typecheck | 잘못된 배열·포트 조립이 빌드를 통과 |
| EP-09 · R-06 / VP-06·VP-10·VP-15 | id 공간 공유·등록 검사 | `registerAuthDefinitions` 로그인 프리 단계(자격증명 accepted id 선등록) (1) · `AuthRejection.scheme` + 부팅 진단 data (1) | registry·bootstrap | 부팅 | 같은 id 두 행·`@` 토큰·서버 이름 충돌 |
| EP-10 · R-04 / VP-04·VP-12 | wire 생산 | `describe()` scheme (1) · `connectionInfo` `authScheme`·`origin ?? ''` (1) | main | invoke·push마다 | renderer가 체계를 모른다 |
| EP-11 · R-04 / VP-04·VP-16 | wire 소비 | `providerRowMeta` (1) · `canManageAuth` (1) · `providerAuthActionKind` (1) · `ProviderAuthActions` `'none'` 분기 (1) · `CustomizeList` detail (1) · `ProviderDetail` 주소 행 (1) | renderer | 렌더마다 | 로그인 프리 행에 인증 버튼·'알 수 없음' 표시 |
| EP-12 · R-06 / VP-06·VP-13 | 부팅 배선 | `bootstrap.ts` `createAuthRuntime({ loginFreeDefinitions: LOGIN_FREE_DEFINITIONS })` (1) | Bootstrap | 부팅 | 선언해도 바인딩이 부팅에서 실패 |
| EP-13 · R-06 / VP-06·VP-13 | 기본 배포 비어 있음 | `LOGIN_FREE_DEFINITIONS = []` (1) · `createPluginBindings` `[]` (1, 기존) | 배포 | 빌드 | OSS 기본 빌드에 도구·행이 생긴다 |
| EP-14 · R-06 / VP-06·VP-13 | 배포 능력 | `PluginDeploymentDeps.auth: Pick<AuthRuntime,'bindForPlugin'\|'bindLoginFreePlugin'>` (1) | 컴파일러 | typecheck | 배포가 `bootstrap.ts`를 고쳐야 한다 |
| EP-15 · R-03 / VP-03·VP-14 | lint 경계 | `child_process` 블록 ignores에 `src/main/features/plugins/**` (1) · git runner 경로 블록은 plugins 미제외 (1) | ESLint | lint | 플러그인 exe 실행 불가 또는 Git 경계 붕괴 |
| EP-16 · R-08 / VP-08 | 문서 사본 | `auth.md` (1) · `security.md` (1) · 가이드 (1) · `IPC_CONTRACT.md` (1) · `GLOSSARY.md` (1) · ADR-006 + `decisions/README.md` (1) · handoff `plan.md`·`INDEX.md` 상태 사본 (2) | 구현자·설계자 | 커밋 | 문서끼리 다른 계약을 말한다 |

- 같은 규칙이 여러 레이어에 있는 경우: redirect 루프 → `request-chain.ts` 1벌(EP-06). id·origin 형식 → `registry.ts`의 `AUTH_ID_RE`·`isBareOrigin`을 두 목록이 공유한다. wire 체계 문자열 union → `shared/ipc.ts` `ProviderAuthScheme`이 정본이고 `contracts/auth.ts`는 `AuthScheme = ProviderAuthScheme`로 별칭한다(`AuthStatus = ProviderGrantStatus` 선례, `contracts/auth.ts:392`).
- "다른 게이트가 막는다"를 적은 칸: 없음.
- 선택적 필드 의미: `LoginFreeDefinition.origin` — `undefined` = 네트워크 없음(요청 거부). `CreateAuthRuntimeDeps.loginFreeDefinitions` — `undefined` = 로그인 프리 0개(배선 누락은 EP-12 소스 스캔이 잡고, 누락 상태에서 배포가 바인딩하면 부팅이 실패한다). `ProviderInfo.authScheme` — **필수**(미지정 의미를 두지 않는다).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | wire | `export type ProviderAuthScheme = 'login-required' \| 'login-free'` · `ProviderInfo.authScheme: ProviderAuthScheme`(필수) · `origin` 주석에 "로그인 프리 미선언 = `''`" | typecheck |
| `app/src/shared/protocol.ts` | re-export | `ProviderAuthScheme` 추가(`:834-847` 묶음) | typecheck |
| `app/src/main/contracts/auth.ts` | 계약 | `AuthScheme = ProviderAuthScheme` · `LoginFreeDefinition{id,label,origin?,methods?:never,probe?:never}` · `LoginFreePluginAuth extends BoundAuth {label, origin?}` · `AuthDescriptor`를 scheme union으로(`login-free`는 `origin?`. `methods` 타입은 두 갈래 모두 `readonly AuthMethodDescriptor[]`로 두고 로그인 프리는 런타임이 항상 `[]`를 준다 — `readonly []`로 좁히면 기존 `runtime.test.ts:1430-1440`의 `methods[0]` 접근이 타입 오류가 된다) · `AuthRuntime.bindLoginFreePlugin(id): LoginFreePluginAuth` | `@ts-expect-error` |
| `app/src/main/features/auth/registry.ts` | 등록 | `registerAuthDefinitions(declared, loginFree = [])` — 자격증명 먼저, 로그인 프리는 자격증명 accepted id가 든 `seen`으로 검사. `AuthRejection.scheme` 추가. `AuthRegistry`에 `loginFree()`·`getLoginFree(id)`. `list()`·`get()`은 자격증명 전용 그대로 | 순수 단위 |
| `app/src/main/features/auth/policy.ts` | 판정 | `checkLoginFreeRequest({url, path, allowedOrigins})` = `checkRequestPath` → `isAllowedOrigin`. 헤더 검사 없음(D-007, 주석으로 이유) | 순수 단위 |
| `app/src/main/features/auth/request-chain.ts` (신규) | 공유 전송 체인 | `MAX_REDIRECTS`·`withQuery`·`followRedirects({prepared, options, allowedOrigins, transport, beforeNextHop?, onBlocked?})`·`toAuthenticatedResponse`. 루프 순서: 전송 → 3xx·Location 확인 → 홉 상한 → `checkRedirect`(실패 시 `onBlocked` 후 `AuthPolicyError`) → `beforeNextHop` → 다음 홉 | 순수 단위 |
| `app/src/main/features/auth/authenticated-request.ts` | 자격증명 요청 | `send()`·`withQuery`를 공유 함수로 대체. `beforeNextHop` = 기존 grant 동일성 확인, `onBlocked` = 기존 로그. 동작·로그 이벤트·예외 불변 | 기존 테스트 |
| `app/src/main/features/auth/login-free.ts` (신규) | 로그인 프리 포트 | `createLoginFreePluginAuth(definition, {sender, logger?})`: `snapshot()` 상수, `request()` = origin 미선언→`AuthPolicyError('origin_not_declared')`, 비-HTTP→기존과 같은 `Error`, URL 조립 → `checkLoginFreeRequest` → `followRedirects`(beforeNextHop 없음) → 응답. store·change 콜백 의존 없음 | 순수 단위(fetch stub) |
| `app/src/main/features/auth/runtime.ts` | 런타임 | `CreateAuthRuntimeDeps.loginFreeDefinitions?` · `bindLoginFreePlugin`(자격증명 id·미등록은 서로 다른 메시지로 throw) · `bindForPlugin`이 로그인 프리 id면 안내 메시지로 throw · `describe` 두 체계 · `bind`·`tryBind`·`secretReader` 불변 | 런타임 단위 |
| `app/src/main/app/deployment/auth-definitions.ts` | 배포 선언 | `export const LOGIN_FREE_DEFINITIONS: readonly LoginFreeDefinition[] = []` + ⚠️ 주석(id 공유·origin 선택·키 비관리, 레시피는 가이드 §4) | production 테스트 |
| `app/src/main/app/deployment/plugins.ts` | 배포 능력 | `PluginDeploymentDeps.auth` Pick 확장 · 주석 예시에 로그인 프리 1줄 | typecheck |
| `app/src/main/app/bootstrap.ts` | 배선 | `createAuthRuntime`에 `loginFreeDefinitions: LOGIN_FREE_DEFINITIONS` · 거부 진단 data에 `scheme` | 소스 스캔 |
| `app/src/main/app/connection-views.ts` | wire | `authScheme: descriptor.scheme` · `origin: descriptor.origin ?? ''` | 단위 |
| `app/src/renderer/src/features/skills/lib/providerRows.ts` | 표시 판정 | `ProviderRowMeta.showsAuthMethod` · 로그인 프리는 `status.loginFree`·`kind.loginFree`·`activeLabel:null`·`showsAuthMethod:false` · `canManageAuth`는 `authScheme==='login-required' && status!=='none'` | 순수 단위 |
| `.../customize/providerAuthActionModel.ts` | 액션 판정 | `ProviderAuthActionKind`에 `'none'`, 로그인 프리 → `'none'` | 순수 단위 |
| `.../customize/ProviderAuthActions.tsx` | 액션 | `'none'`이면 `null` 반환 | render |
| `.../customize/ProviderDetail.tsx` | 상세 | 주소 `<dt>/<dd>`를 `origin !== ''`일 때만 | render |
| `.../customize/CustomizeList.tsx` | 목록 | detail = `showsAuthMethod ? kind · (activeLabel ?? unknown) : kind` | render |
| `.../shared/i18n/resources/{ko,en}.ts` | 문구 | `skills.provider.status.loginFree`='인증 불필요'/'No sign-in required' · `skills.provider.kind.loginFree`='기본 제공'/'Built-in' | `resources.test.ts` |
| `app/eslint.config.mjs` | 경계 | `:177-188`을 둘로 가른다 — ① `child_process` 금지 블록: ignores에 `src/main/features/plugins/**` 추가 ② git runner 경로 금지 블록: 기존 ignores 그대로 | `git-boundary.test.mjs` |
| 테스트 | — | §7 AC별 — registry·policy·login-free·runtime·plugins·deployment-wiring·connection-views·renderer 5종·git-boundary, fixture 16자리에 `authScheme:'login-required'` | — |
| 문서 | — | AC19 목록 + ADR-006 신설 | inventory check |

### 테스트 가능성

- electron 비의존 별도 파일: `login-free.ts`·`request-chain.ts`·`policy.ts`·`registry.ts`는 electron을 import하지 않는다(`fetchImpl`·sender 주입). `bootstrap.ts`는 electron을 물어 소스 스캔으로 검증한다(`deployment-wiring.test.ts:686-714` 선례).
- 기존 메커니즘 재사용의 형상 적합성: `createPluginBinding`은 `BoundAuth`만 요구하고(`plugins.ts:36-42`) `LoginFreePluginAuth`가 그 형상이다. `createSender`는 `credentials:'omit'`이 이미 고정이다.
- 순서 관측: AC2는 registry를 감싼 spy(`add`/`remove`를 서버 id별로 기록)와 `subscribe` 리스너 기록으로 본다.
- 타입 단언: `@ts-expect-error`는 `src/main` 테스트(`tsconfig.test.json`)와 renderer 테스트(`tsconfig.web.json`) 모두 `npm run typecheck`가 본다.

## 12. End-to-end 영향

### producer → consumer

```text
LOGIN_FREE_DEFINITIONS → registry → bindLoginFreePlugin → createPluginBinding → RuntimeToolRegistry → 턴 spawn
                       └→ describe(scheme) → connectionInfo → orca:provider:list/state → renderer(목록·상세·@)
```

- producer 기준: 체계는 선언 배열이 정하고(`describe`), 상태는 포트 `snapshot()`이 정한다.
- consumer 파생 규칙: renderer는 `authScheme`으로 표시·액션을 고르고 `status`로 tone·도구 안내를 고른다.
- 파생 합성값 우회 여부: 없음 — renderer는 `origin===''`이나 `auth.length===0`으로 체계를 추론하지 않고 `authScheme`만 본다(EP-11).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `RuntimeToolRegistry` → 턴 spawn | 로그인 프리 서버만큼 도구가 늘고 revision은 부팅 add만큼 오른다 | AC1·AC2 |
| `runtimeApprovalToolNames` | `readOnlyHint` 규칙 그대로 — 로그인 프리 도구도 같은 승인 정책(D-002) | AC14(기존 정책 불변) |
| `connectionState` invoke·push | 행 증가, 필드 `authScheme` 추가 | AC10 |
| `duplicateConnectionAuthIds` | 공유 id 공간이라 중복 0 | AC8 |
| 게이트 멤버 선택·부팅 복원 | 로그인 프리 미해석 | AC4 |
| MCP `${BINDING:<id>}` | `secretReader` null → 그 서버 드롭(fail-closed) | AC4 |
| renderer 게이트 화면·principal | `kind==='gate'` 필터라 불변 | AC14 |
| Composer `@` | tools>0 행에 포함 | AC13 |
| Harness augmenter·Usage | `bind`가 자격증명 전용 — 비범위 | AC4 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 부팅 `createAuthStack`에서 등록, `createPluginBindings`에서 포트 생성, 첫 sync에서 add.
- 취소/중단: `request(req, signal)`의 signal이 `createSender`로 간다. exe 실행 취소는 플러그인이 signal을 넘긴다.
- 종료/quit/crash: 영속 상태가 없다.
- retry/timeout/partial failure: 앱 재시도 없음. redirect 체인 중간 실패는 예외로 끝나고 상태 전이가 없다.
- cleanup/rollback: 해당 없음.
- **다중 저장소 쓰기**: 런타임은 해당 없음 — 로그인 프리는 grant·vault에 쓰지 않는다. 산출 문서는 판정 사본이 `plan.md`와 `INDEX.md` 두 곳이라 EP-16에 둘 다 지점으로 둔다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수: `request()` 1회당 최대 1 + 5홉(`MAX_REDIRECTS`). polling·부팅 network 0.
- 새 출력: 응답 크기는 플러그인이 정한 `maxBytes`(미지정 = 상한 없음 — 기존 `AuthenticatedRequest`와 같은 의미).
- registry: 로그인 프리 서버 N개 → 부팅 add N회, 이후 0.
- 캐시/호출 축소: 해당 없음.

## 15. 외부 구현 포트 / 문서 계약

- 외부(배포)가 구현할 계약: `LoginFreeDefinition` · `LOGIN_FREE_DEFINITIONS` · `PluginDeploymentDeps.auth.bindLoginFreePlugin` · `LoginFreePluginAuth`.
- 구현 문서: `docs/guides/closed-network-extensions.md` §4(로그인 프리 레시피 신설) · §0 라우팅 행 · §1.1 파일 표.
- **shape 검증**(AC17): 가이드 예제와 같은 코드를 `PluginDeploymentDeps`로 타입을 못 박은 가상 배포 함수로 컴파일한다.
- **semantics 검증**(AC5~AC9): 헤더 통과·origin 고정·상태 전이 0·게이트 비해석을 contract test가 단언한다. 가이드 문장이 이 의미와 같아야 한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| `PluginDeploymentDeps`는 auth·registry·logger뿐 | 0237 D-048, `plugins.ts:72-79` | §11 `PluginDeploymentDeps.auth` Pick 확장 | 유지 — 슬롯 수 불변(D-017) |
| 기본 OSS 배포는 Plugin `[]` | 0237 D-030, `deployment-wiring.test.ts:516-524` | D-011·AC15 | 유지 |
| 연결 좌표는 `origin` 한 사본 | 0237 D-057 | D-014 origin 선택 | 유지 — 사본 하나 |
| non-HTTP authority 허용·`request()`는 HTTP(S)만 | 0237 D-051 | D-014 | 유지 |
| GUI tools는 cached descriptor | 0188 D-024, `plugins.ts:26-27` | AC10·AC12 | 유지 |
| renderer에 새 kind 금지·wire 호환 | 0188 D-029·D-030, `auth.md §9` | §11 `ProviderInfo.authScheme` | 유지 — `kind`는 `'service'`, 추가 필드는 kind가 아니다 |
| `@` 토큰 = `ProviderInfo.id`, status 무관, `tools.length>0` 판별 | 0238 D-006·D-008·D-017 | AC13 | 유지 |
| 확인 없이 통과하는 게이트 금지 | `auth.md §5.1`, 0188 D-007 | D-004·D-016·AC4 | 유지 — 로그인 프리는 게이트 멤버 불가 |
| Auth 계약에 소비 슬롯을 되살리지 않는다 | `auth.md §11` | D-003 | 유지 — 체계는 소비 슬롯이 아니다 |
| main 원격 요청은 Chromium 스택만 | ADR-003, `security.md §1.8` | 로그인 프리 요청 = `createSender(netFetch)` | 유지 |
| 예약 헤더 금지 | `policy.ts:16-18` | D-007 | **변경(범위 한정)** — 자격증명 요청은 유지, 로그인 프리 요청에는 적용하지 않는다. 근거: 보호 대상(앱 주입 자격증명) 부재 |
| `child_process`는 Git gateway·runner만 | `eslint.config.mjs:177-188`, `security.md §1.10` | D-009 | **변경(범위 한정)** — `features/plugins/**` 추가, runner 경로 금지는 유지 |
| raw secret 예외 3곳, 표 밖 신규 노출 금지 | `security.md §1.4-b`, `app/AGENTS.md` | D-006 | 유지 — 로컬 키는 vault 소유가 아니라 표 대상이 아니다. 문서에 그 경계를 적는다 |
| "Auth 는 인증하고 인증된 능력만 제공한다" | `auth.md §1` | D-003 | **변경(문서 확장)** — 로그인 프리 대상에는 인증 없이 같은 형상의 능력을 준다 |
| 런타임 동적 코드 로딩 금지 | `auth.md §11` | 해당 없음 — 로그인 프리도 빌드타임 선언 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 로그인 프리 도구가 항상 노출돼 모델이 외부 API를 부른다 | 승인 정책(`readOnlyHint`) 동일, origin 고정, 기본 배포 0개(D-011) |
| 플러그인이 셸 경유로 exe를 실행해 인자 주입이 생긴다 | `security.md`에 "셸 없이 `execFile`/`spawn`, 절대 경로, timeout·signal" 규칙을 둔다. 첫 exe 플러그인 handoff가 그 규칙의 테스트를 갖는다 — lint는 import만 연다(D-009) |
| 플러그인이 로컬 키를 로그·도구 결과에 싣는다 | `security.md`에 금지 규칙. 앱 로그는 URL 대신 origin만 남긴다(`policy.ts:86-92` 규칙 재사용) |
| `AuthDescriptor` union·wire 필수 필드로 테스트 fixture 수정 — `ProviderInfo` 16자리 + `AuthDescriptor` 1자리(`connection-views.test.ts:57`, 나머지는 spread) | 컴파일 오류가 전수를 안내한다(§8 전수 조사) |
| redirect 루프 추출이 자격증명 경로를 바꾼다 | 기존 `authenticated-request.test.ts` 전부 green + M13이 두 경로를 함께 깨는지 확인 |

- 되돌리기 어려운 결정: D-012 이름·wire 필드, D-013 공유 id 공간.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{ipc,protocol}.ts`
- `app/src/main/contracts/auth.ts`
- `app/src/main/features/auth/{registry,policy,runtime,authenticated-request}.ts` + 신규 `login-free.ts`·`request-chain.ts`
- `app/src/main/app/{bootstrap,connection-views}.ts`, `app/src/main/app/deployment/{auth-definitions,plugins}.ts`
- `app/src/renderer/src/features/skills/{lib/providerRows.ts, components/customize/{providerAuthActionModel.ts,ProviderAuthActions.tsx,ProviderDetail.tsx,CustomizeList.tsx}}`, `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `app/eslint.config.mjs`, `app/scripts/git-boundary.test.mjs`
- 테스트: §7 AC별 + fixture 16자리
- `docs/arch/backend/{auth,security}.md`, `docs/guides/closed-network-extensions.md`, `docs/IPC_CONTRACT.md`, `docs/GLOSSARY.md`, `docs/decisions/{006-login-free-auth-scheme.md, README.md}`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`, `app/src/main/AGENTS.md`(레이어·Chromium 스택), `app/src/renderer/AGENTS.md`(토큰·레이어).
- ABI/네트워크 제약: DB 로드 스위트는 대상이 아니다. `npm test`는 쓰지 않아도 된다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-A 운영 gate 표의 `vitest run` 대상 + `node --test scripts/git-boundary.test.mjs` + `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: AC20(두 테마 시각).

## READY self-review

- [x] Decision Ledger가 T1~T5 결정을 ACTIVE/SUPERSEDED로 보존한다 — D-007a·D-009a는 대체 ID를 가리킨다.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §1·§5 상태표.
- [x] 조건절·이유절을 원문 인용했다 — §2 T1~T5.
- [x] Product/UX 핵심 동작이 AC와 Technical Design에 연결된다 — §5 행 ↔ AC1~AC20 ↔ §9 경로.
- [x] AS-IS·TO-BE가 같은 축(소유권·흐름·계약·정책·루프·경계·seam)으로 있다.
- [x] Delta 각 행이 파일·VP로 이어진다.
- [x] 사라진 책임 없음 — redirect 루프는 이동.
- [x] 수치·전칭·앵커·기존 테스트를 실측했다 — §8 전수 조사·검산.
- [x] 각 AC가 행동 단언·검증 수단·프로덕션 경로를 가진다.
- [x] Baseline V이며 유효 V = V1.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — R 8·SD 1·AR 5·MD 3 → VP-01~VP-18.
- [x] Baseline이라 INHERITED/NOT_REQUIRED 없음.
- [x] 각 pair가 경로·자리 수·직접 oracle을 갖고, 구조·0건·N회 oracle만 적대 증거를 골랐다.
- [x] 운영 gate가 현재 변경 산출물로 한정된다.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC20은 시각만.
- [x] semantic 목표를 structural proxy로만 검증하지 않는다 — 소스 스캔(AC16)은 가이드 예제 실행(AC17)과 짝.
- [x] "X가 쓰인다" 불변식은 X를 지웠을 때 실패한다 — M1·M8·M9, 형제 맞바꿈 M2b·M6·M8b.
- [x] 정책 파라미터 의미가 명확하다 — origin `undefined`·`maxBytes`·`loginFreeDefinitions` 미지정 의미(§10).
- [x] 참조 구현 없음 — 해당 없음.
- [x] 신규 모듈마다 레이어·강제 지점·seam이 있다(§9 책임표·§10·§11).
- [x] producer/consumer와 외부 포트 문서까지 닫혔다(§12·§15).
- [x] worst-case 요청 수와 one-way door를 적었다(§14·§17).
- [x] 게이트 명령이 `app/AGENTS.md`와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙 — 판정 먼저, 표 한 칸 3줄.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K = 표 행 T`
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님) | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
