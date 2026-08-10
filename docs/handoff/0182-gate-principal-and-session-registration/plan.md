# Plan — 0182-gate-principal-and-session-registration

## 메타

| 항목 | 값 |
|---|---|
| slug | `0182-gate-principal-and-session-registration` |
| 작성자 | Claude Code |
| 일자 | 2026-08-10 |
| 매핑 | PHASES "현재 작업 중" — 0181 후속 |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "로그인게이트에서 로그인 성공 시 nav 하단에 developer 가 아닌 email 을 표시한다" | 라이브 세션 요청 (2026-08-10) |
| 명시 요구 ② | "폐쇄망 도메인의 공통 설정(세션쿠키)에 대한 효과적인 방법과 다른 레이어에서 해당 SP 를 사용하려면 어떻게 접근해야 하는지 **가이드 문서 업데이트**" | 같은 세션 |
| 명시 요구 ③ | "첫번째 질문도 사실상 SP 질문으로 볼 수 있겠다" — 두 요구가 **한 축**임을 사용자가 지목 | 같은 세션 |
| 명시 요구 ④ | "보완 완료시 **가이드 문서도 그에 따라 반영**돼야 한다" | 같은 세션 (계획 승인 시) |
| 사용자 결정 (이번 세션) | ⓐ 범위 = **P0-1 + 신원 표시 + 문서**(케이스 B~E 는 후속) ⓑ 문서 = **기존 가이드 재구성**(신설 금지) ⓒ whoami 실값 = **모름 → 파라미터로** | AskUserQuestion 응답 |
| 추론 의도 | 요구 ①의 목적은 *라벨 교체* 가 아니라 **"로그인한 주체가 누구인지 앱이 알고 보여준다"** — 그래서 신원 조회를 SP 호출로 설계한다 (추론) | 요구 ③이 근거 |

## Context (왜)

0181 이 `Provider` 축을 세우면서 `ProviderInfo.principal` 까지 배관을 깔았으나 **양 끝이 비어 있다** —
`SessionRunner` 가 `principalId` 를 만들지 않고, 사이드바는 상수 `'developer'` 를 쓴다
(`SidebarUserButton.tsx:23` 의 주석이 "0181 이 이 자리를 다시 채운다" 고 예고한 채 남아 있다).

그리고 추적 중에 **세션 SP 호출이 재시작 후 예외로 죽는 결함**을 찾았다. 이 결함은 신원 갱신·
사용량 표본·서비스 도구가 **공통으로** 밟는 경로라, 신원 표시보다 먼저 닫아야 한다.

의도한 결과: ⓐ 폐쇄망 배포에서 로그인 후 사이드바에 실제 계정이 보인다 ⓑ 재시작해도 세션
provider 호출이 성립한다 ⓒ **절차 정본(가이드)이 바뀐 동작을 서술한다**.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당하나 범위가 넓어진다** — 요구는 "라벨"이지만 원인은 *신원을 조회하는 SP 호출이 없다* 는 것이다. 라벨만 바꾸면 표시할 값이 없다 | `specs/browser-session.ts` `login()` 이 `{kind:'session', sessionGroup}` 만 반환 · `exchange()` 가 `TokenValue` 에 `principalId` 를 넣지 않음 |
| 이미 있는 것 아닌가 | **절반은 이미 있다.** `Grant.principalId` → `platform.ts info()` → `ProviderInfo.principal` → `orca:provider:state` 는 전부 동작한다. `passwordSpec` 은 이미 principal(아이디)을 채운다 → **새로 만들 것은 양 끝 두 곳뿐** | `login.ts` `absorb()` 3분기 · `platform.ts` `info()` · `specs/credential.ts:81` |
| 더 작은 해법이 있는가 | **있고, 채택했다.** probe 응답 본문을 principal 로 쓰면 요청이 늘지 않지만 ⓐ `probe()` 는 판정만 돌려주도록 설계됐고(본문 폐기) ⓑ 리다이렉트 체인을 직접 돌아 본문이 **마지막 홉의 것**이라 신원 보장이 없다 → 대신 **이미 있는 `sessions.send()` + `pickPath()`** 를 재사용한다(새 전송 경로 0) | `infra/browser-session.ts` `probe()` 주석 "응답 본문·쿠키는 반환하지 않는다" · `classifyProbeChain` |
| 인용 자료가 요구를 부풀리지 않았나 | **부풀렸다 — 자기 산출물에서.** 선행 아티팩트(플레이북)가 ⓐ WIA 동작을 미검증 추론으로 단정 ⓑ `UsageSubscription.sourceId` 를 필수로 오독 ⓒ 설계 선택(세션 재검증 없음)을 결함으로 분류 ⓓ 실재하지 않는 심볼을 예제로 실었다. **넷 다 이 plan 의 근거에서 제외**했다 | 아래 §자료조사 R2·R3·R9·R10 |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다.** 0181 의 "세션 grant 는 값이 아니다"·"probe 는 판정 전용"·"401 강등" 을 전부 유지한 채 *더한다* | 아래 §기존 결정 표 |

- **사용자에게 올릴 것(단독 결정 불가)**: whoami 실값(경로·필드명) — 배포 시점 미정.
  0181 OQ1·OQ2 와 같은 성격이라 **파라미터화**로 착수를 막지 않는다(사용자 결정 ⓒ).

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **`sessions.register()` 호출부는 2곳뿐**(전수 grep) — 로그인 실행부와 OAuth 창 배선. 부팅 경로에 없다 | `rg 'sessions\.register\|\.register\(\{' app/src/main --glob '!**/*.test.ts'` → `specs/browser-session.ts:76` · `app/bootstrap.ts:315` (**N=2**) |
| 재시작 시 `acquire()` 는 미등록 group 에 **throw** 한다. `ProviderPolicyError` 가 아닌 raw `Error` 라 401 강등 경로도 타지 않는다 | `infra/browser-session.ts` `acquire()` · `auth/api.ts` `transport()` |
| 세션 grant 는 vault 를 읽지 않으므로 재시작 후에도 `status()==='valid'` — 즉 **도구는 등록되고 호출만 죽는다** | `auth/store.ts` `status()` · `service/index.ts` `sync()` |
| `principalId` 를 채우는 방식은 현재 **`passwordSpec` 하나**(전수: `rg 'principalId' app/src/main` → 선언부 3 + 소비부 4) | `specs/credential.ts:81` |
| `probe()` 반환은 `{ok,status,finalUrl}` — 본문 폐기가 **의도**다 | `infra/browser-session-policy.ts` `BrowserProbeResult` · `browser-session.ts` 주석 |
| `sessions.send()` 는 같은 jar 로 본문까지 돌려준다. `pickPath()`·`normalizeExpiry()` 는 이미 `specs/browser-session.ts` 에 있다(exchange 가 쓴다) | `infra/browser-session.ts` `send()` · `specs/browser-session.ts` |
| 로그인 중에는 `api.request()` 를 쓸 수 없다 — `checkOutboundRequest` 가 `grantStatus!=='valid'` 를 거부하고 grant 는 성공 **후** 커밋된다 | `auth/policy.ts` `checkOutboundRequest` · `login.ts` `commit()` |
| **게이트는 N개가 가능**하다 — 게이트 화면이 "n/N" 진행을 표시한다. 사이드바 선택 규칙이 필요하다 | `GateLogin.tsx:40` `providers.find(p => p.status!=='valid') ?? providers[0]` |
| renderer vitest include 는 **`src/**/*.test.ts`** — `.tsx` 는 수집되지 않는다. 순수 판정은 `.ts` 로 떼야 기계 검증된다 | `app/vitest.config.ts:8` |
| `docs/GLOSSARY.md` 에 **`principal` 표제어가 없다** | `rg 'principal' docs/GLOSSARY.md` → **0건** |
| 가이드 §2 "필드별 의미 · 흔한 실수" 표에 현재 5행(`sessionGroup`·`loginUrl`·`doneUrlPrefix`·`authenticationProbeUrl`·`allowedOrigins`) | `docs/guides/closed-network-extensions.md` §2 |
| **미종결(R2)**: Electron `allowNTLMCredentialsForDomains('')` 의 실제 의미. `node_modules` 부재 + `electronjs.org` egress 차단으로 이번 세션에 닫지 못했다 | WebFetch → `EGRESS_BLOCKED` · `ls node_modules` → 없음 |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 선언된 browser-session group 이 **로그인 없이** 등록된다 — fake 포트가 `register` 호출을 받는다 | `features/providers/auth/session-policies.test.ts::"선언된 세션 group 을 등록한다"` | `app/bootstrap.ts` `createProviderPlatform()` → `registerDeclaredSessions` |
| 2 | 같은 group 을 두 provider 가 선언하면 `allowedOrigins` 가 **합집합**으로 한 번 등록된다 | 같은 파일 `::"같은 group 은 origin 을 합집합으로 등록한다"` | 같음 |
| 3 | 등록 검사에서 **거부된 선언**의 group 은 등록되지 않는다 | 같은 파일 `::"거부된 선언의 group 은 등록하지 않는다"` | `registerProviders()` → `registerDeclaredSessions` |
| 4 | 세션 grant 가 복원됐고 이번 프로세스에 로그인이 없어도 `api.request` 가 **전송까지 도달**한다 | `features/providers/auth/api.test.ts::"세션 grant 는 재로그인 없이 전송된다"` | `ProviderApiImpl.transport()` |
| 5 | `whoami` 가 선언되면 probe 성공 직후 **그 경로로 요청이 나가고** 값이 `principalId` 로 접힌다 | `auth/specs/browser-session.test.ts::"whoami 값을 principalId 로 싣는다"` | `LoginService.absorb()` → `store.put()` |
| 6 | `whoami` 응답이 **비-2xx · 비-JSON · 필드 부재**일 때도 grant 는 커밋되고 `principalId` 만 비어 있다 (3케이스) | 같은 파일 `::"whoami 실패는 로그인을 실패시키지 않는다"` | 같음 |
| 7 | `whoami` **미선언**(undefined)이면 추가 요청이 나가지 않는다 — send 호출 수 0 | 같은 파일 `::"whoami 미선언이면 조회하지 않는다"` | 같음 |
| 8 | `exchange.principalPath` 가 있으면 **추가 요청 없이** 그 값이 principal 이 된다(whoami 보다 우선) | 같은 파일 `::"exchange 응답의 principal 이 whoami 보다 우선한다"` | 같음 |
| 9 | 게이트 0·1·N 개에서 표시할 principal 이 규칙대로 선택된다 — **선언 순서상 principal 이 있는 첫 게이트**, 없으면 `null` | `renderer/…/features/providers/lib/principal.test.ts::"게이트 0·1·N"` | `SidebarUserButton` → `useProviderPrincipal()` |
| 10 | **가이드 §2 필드 표에 `whoami` 행이 있고 선언 파일 주석 예제와 필드명이 일치**한다 | `rg -c 'whoami' docs/guides/closed-network-extensions.md app/src/main/features/providers/declarations/sso.ts` → **양쪽 ≥1** | 배포 담당자가 §2 를 보고 선언을 채운다 |
| 11 | **가이드·주석의 선언 예제가 실제로 컴파일된다** — 예제를 `declarations/sso.ts` 에 채워 넣어 typecheck 통과를 확인한 뒤 되돌린다 | `npm run typecheck` 3/3 (0181 5단계-e ⓔ 와 같은 절차) | 예제를 복사해 쓰는 구현자 |
| 12 | **가이드 §6 에 신원 표시 확인 절차**, **§9 에 "이름이 폴백 라벨로 남는다" 행**(원인=`valuePath` 오타, 신호=`providers.session.whoami.failed` 로그)이 있다 | `rg -n 'whoami|신원' docs/guides/closed-network-extensions.md` → §6·§9 히트 | 개발자가 §6 절차대로 확인한다 |
| 13 | **`arch/backend/providers.md` §4 라이프사이클이 "부팅 시 세션 group 등록"** 을, §7 이 principal 출처를 서술한다 | `rg -n 'session group|principal' docs/arch/backend/providers.md` → §4·§7 히트 | 구조를 읽으러 오는 에이전트 |
| 14 | **`docs/GLOSSARY.md` 에 `principal` 표제어가 등록**된다 (현재 0건 — 없는 정의를 문서가 인용하지 않게) | `rg -c '^### .*principal' docs/GLOSSARY.md` → ≥1 | 용어를 찾으러 오는 사람 |
| 15 | 실기: 실값을 채운 빌드로 로그인 → **사이드바 하단에 email 이 보인다**. 우회 토글 ON(DEV)에서는 폴백 라벨 | **사람 실기** — `npm run dev` 로 기동, 디버그 패널에서 우회 OFF → 게이트 로그인 → 사이드바 하단 확인 | 게이트 화면 → 메인 셸 |

> AC15 의 실행 경로는 **비범위에 막혀 있지 않다** — 게이트 화면·디버그 패널·사이드바가 모두 범위 안이다.
> 다만 SSO 실값(OQ1)이 없으면 로그인 왕복 자체가 불가하므로, 실값 없는 환경에서는 **우회 ON 폴백
> 표시까지만** 확인 가능하다(그 부분은 실값 없이도 실기된다).

## 범위 / 비범위

- **범위**: 부팅 시 세션 group 등록(결함) · whoami/principalPath 선언과 조회 · 사이드바 신원 표시 ·
  **가이드/구조 문서/GLOSSARY 반영**(AC10~14) · 아티팩트 정정.
- **비범위**: WIA 필드(P0-2, 조사 미종결) · 세션 부팅 재검증(P0-3, 설계 선택) ·
  폐쇄망 세션 공유 레시피 확장(케이스 B) · 사용량 소스 레시피(케이스 C) · PAT 내장 MCP 레시피(케이스 D) ·
  SP API 소비 3패턴 문서화(케이스 E) · renderer 범용 SP 채널.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| WIA 필드(P0-2) | **아니오** — 선택적 필드 추가라 뒤에 붙여도 기존 선언이 안 깨진다. 단 **의미 확인 전에는 넣지 않는다**(잘못된 필드가 나가면 그때부터 일방향) |
| 세션 부팅 재검증(P0-3) | 아니오 — 판정 시점 추가일 뿐 저장 형식이 안 바뀐다 |
| 케이스 B~E 문서 | 아니오 — 문서는 언제든 더 쓸 수 있다 |
| **`whoami` 필드명 자체** | **예 — 일방향이다.** 선언 스키마이자 배포가 적는 이름이라 나중에 바꾸면 이미 배포된 선언이 깨진다 → **지금 확정한다**(아래 §설계) |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `sessions.send()`(cookie jar 전송) · `pickPath()` · `registerProviders()` ·
  `providerApi.state()/onState()`(renderer 구독) — **전부 이미 있다**.
- 전제: 세션 grant 의 cookie jar 는 `persist:auth.<group>` 파티션에 영속되므로 재시작 후에도
  쿠키가 살아 있다(`partitionFor`). 이 전제가 깨지면 AC4 는 통과해도 실제 요청은 401 로 강등된다 —
  **그 강등 경로는 0181 이 이미 갖고 있다**(정상 동작).
- **신규 의존성: 없음.**

## 설계

**축**: SP 를 부르는 순간은 넷(probe · whoami · exchange · 로그인 후 API)이고 **전송은 이미 한 벌**이다
(`transport()` 가 세션 grant 를 만나면 `sessions.send()` 로 위임). 이번 작업은 **네 번째 순간이
재시작 후에도 성립하게** 하고, **두 번째 순간(whoami)을 신설**한다.

**일방향 결정 — 지금 확정한다**

| 결정 | 값 | 근거 |
|---|---|---|
| 신원 조회 선언 이름 | **`whoami`** | 배포가 적는 스키마 이름. `identity` 는 `Grant`·`principal` 과 의미가 겹쳐 읽는 사람이 무엇을 적는지 헷갈린다 |
| 신원 값 경로 이름 | **`valuePath`** (exchange 와 동일) | 두 선언이 같은 형상이면 규칙이 하나다 |
| 경로 표기 | **origin 기준 상대 경로** | 로그인 후 갱신을 `api.request()` 로 그대로 재사용할 수 있다(절대 URL 은 `absolute_path` 로 거부된다) |
| exchange 의 신원 필드 | **`principalPath`** | `valuePath`(토큰)와 한 객체 안에서 구분돼야 한다 |

**신규 모듈**

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `main/features/providers/auth/session-policies.ts` | `sessionPolicies(providers)` 순수 추출 + `registerDeclaredSessions(port, providers)` — `port` 는 `Pick<BrowserSessionPort,'register'>` | features (providers) | **순수 단위** — fake port 로 `register` 호출 인자를 단언. electron 비의존 |
| `renderer/…/features/providers/lib/principal.ts` | `selectGatePrincipal(providers)` — 게이트 0·1·N 선택 규칙 | features (providers) | **순수 단위**(`.ts` 라 vitest include 대상) |
| `renderer/…/features/providers/hooks/useProviderPrincipal.ts` | `orca:provider:state` 구독 → `selectGatePrincipal` | features (providers) | 훅은 시각 검증, **판정은 위 순수 모듈이 커버** |

**변경 모듈**

- `contracts/provider.ts` — `SessionLookup` 신설 · `BrowserSessionConfig.whoami?` · `SessionTokenExchange.principalPath?`
- `auth/specs/browser-session.ts` — probe 성공 후 whoami 조회(`sessions.send` + `pickPath`), exchange 응답에서 principal 추출. **실패는 `undefined` 로 접고 `providers.session.whoami.failed` 로그**(exchange 의 `no-token` 로그와 같은 형태 — `valuePath` 를 찍어 오타를 지목)
- `app/bootstrap.ts` — `new BrowserSessionStore()` 직후 `registerDeclaredSessions(sessions, registry.list())`
- `app/SidebarUserButton.tsx` — 상수 → 훅 + 폴백(버튼과 팝오버 헤더 **두 곳**)

**레이어 준수**: 신규 main 모듈은 `features/providers` 안이고 `infra`(포트 타입)만 아래로 본다.
renderer 신규는 `features/providers` 안이며 `app/SidebarUserButton` 이 위에서 내려다본다(허용 방향).
`useProviderGate` 와 **같은 채널을 구독**하므로 새 IPC 채널이 없다 — `IPC_CONTRACT` 무변경.

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| probe 는 판정만 돌려준다(본문·쿠키 반환 금지) | `infra/browser-session.ts` 주석 · AUTH-PLAT-008 | §설계 "네 번째 순간… whoami 를 신설" | **유지** — probe 계약을 건드리지 않고 `send()` 로 따로 부른다 |
| 세션 grant 는 값이 아니다(MCP·LLM 으로 반출 금지) | `auth/api.ts` `token()` · 가이드 §5 | §자료조사 "세션 grant 는 vault 를 읽지 않는다" | **유지** — principal 은 secret 이 아니라 표시용 식별자다 |
| 401/403 관측 시 강등(부팅 재검증 없음) | `auth/store.ts` `markExpired()` | §의존 기술 "그 강등 경로는 0181 이 이미 갖고 있다" | **유지** — P0-3 은 비범위 |
| `Provider.id`·vault 키는 일방향 | `contracts/provider.ts` 주석 | §설계 일방향 결정 표 | **유지** — 이번에 추가하는 것은 선언 필드뿐 |
| 새 howto 문서 신설 금지, 기존 재구성 | INDEX 0181 5단계-e (사용자 결정) | §범위 "가이드/구조 문서/GLOSSARY 반영" | **유지** — 가이드 §2·§6·§9 에 넣고 새 파일을 만들지 않는다 |
| 순수 판정은 `.ts` 로 떼어 vitest 대상으로 | `app/vitest.config.ts:8` · 0181 `providerRows.ts` 선례 | §설계 신규 모듈 표 | **유지** — 두 신규 판정 모듈 모두 `.ts` |
| main 에서 electron 을 무는 파일을 늘리지 않는다 | `app/src/main/AGENTS.md` §원격 요청 | §설계 "electron 비의존" | **유지** — 신규 모듈은 포트만 받는다 |

## 파생 UX / 엣지케이스

- **principal 이 없는 정상 경우 3종**: DEV 게이트(선언 0) · 우회 토글 ON · `api-key`/`pat` 게이트.
  폴백 라벨이 반드시 있어야 한다(빈 문자열이면 버튼이 빈칸으로 보인다).
- **게이트 N개**: 선언 순서상 principal 이 있는 첫 게이트. 전부 없으면 폴백.
- **만료·해제 후**: grant 는 남고 `status` 만 `expired` 가 되므로 **principal 은 계속 보인다**.
  이는 의도다 — "누가 재인증해야 하는가" 를 화면이 알려준다.
- **whoami 지연**: 로그인 왕복에 GET 1회가 더 붙는다. 실패해도 로그인은 성립하므로 타임아웃은
  전송 계층 기본값을 따른다(별도 상한을 두지 않는다 — 상한을 두면 그 값이 또 하나의 미정 파라미터가 된다).
- **재시작 직후**: 등록은 되지만 쿠키가 죽었을 수 있다 → 첫 요청 401 → `expired` 강등 → 카탈로그에
  재인증 지점이 뜬다(기존 경로).

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| whoami 로 로그인 왕복이 1 RTT 늘어난다 | `exchange.principalPath` 를 **우선**해 교환이 있는 배포는 추가 요청이 0. whoami 미선언이면 아예 안 부른다(AC7) |
| `registerDeclaredSessions` 가 부팅 경로에 붙어 실패하면 앱이 안 뜬다 | `register()` 는 파티션 생성뿐이라 네트워크가 없다. 그래도 **부팅을 막지 않도록** 예외를 삼키고 로그만 남긴다(0181 의 persistence 폴백과 같은 태도) |
| 표시용 principal 이 개인정보(email)다 | 로그에 싣지 않는다 — 실패 로그는 `valuePath` 만 찍는다(값 금지). renderer 로는 이미 나가는 필드(`ProviderInfo.principal`) |
| AC15 가 실값 없이는 절반만 실기된다 | 우회 ON 폴백 표시는 실값 없이 확인 가능. email 표시는 OQ1 해소 후 사람 실기(0181 AC13 선례) |

- 되돌리기 어려운 결정: **`whoami`·`valuePath`·`principalPath` 이름**(선언 스키마) — §설계에서 확정.
- **단독 결정 금지(Open Question)**: whoami 실값 · WIA 필요 여부 · 부팅 재검증 채택 여부.

## 영향 받는 파일

- `app/src/main/contracts/provider.ts`
- `app/src/main/features/providers/auth/session-policies.ts` (신규) + `.test.ts`
- `app/src/main/features/providers/auth/specs/browser-session.ts` (+ `.test.ts`)
- `app/src/main/features/providers/auth/api.test.ts`
- `app/src/main/features/providers/declarations/sso.ts` (주석 예제)
- `app/src/main/app/bootstrap.ts`
- `app/src/renderer/src/features/providers/{lib/principal.ts,hooks/useProviderPrincipal.ts,index.ts}`
- `app/src/renderer/src/app/SidebarUserButton.tsx`
- `docs/guides/closed-network-extensions.md` (§2·§6·§9)
- `docs/arch/backend/providers.md` (§4·§7)
- `docs/GLOSSARY.md` (`principal` 표제어)

## 참고 문서

- `docs/arch/backend/providers.md` — provider 플랫폼 구조 정본
- `docs/guides/closed-network-extensions.md` — 절차 정본
- `docs/arch/backend/security.md` §1.4-b — raw secret 노출 경계(이번 변경은 **표에 추가되지 않는다**)
- IPC 변경 **없음** — `docs/IPC_CONTRACT.md` 무수정

## 게이트

- `cd app && npm run lint && npm run typecheck` (ABI 중립)
- `./node_modules/.bin/vitest run src/main/features/providers src/renderer/src/features/providers`
  (`npm test` 는 ABI 를 Node 로 뒤집으므로 쓰지 않는다 — `app/AGENTS.md` §ABI 가이드)
- 신규 테스트 요구: 순수 판정 2종(세션 정책 추출 · 게이트 principal 선택) + whoami 분기 4종

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 4건을 라이브 세션 인용으로 적고, 추론은 추론으로 표기
- [x] 자료조사 — 발견마다 `파일:라인` 또는 명령. **미종결 1건(R2)을 미종결로 명시**
- [x] 의존 기술 — 신규 의존성 0. 재사용 모듈을 이름으로 지목
- [x] 파생 UX — principal 부재 3종·게이트 N개·만료 후·재시작 직후
- [x] 리스크 — 일방향 결정을 §설계에서 확정, Open Question 3건 분리
- [x] **요구 비판적 검토** 5질문 답변. 범위를 줄이지 않았다(사용자가 직접 분할을 결정)
- [x] `검증 수단` 칸 **15/15 채움**. AC15 만 "사람 실기" 로 명시 + 실행 경로 기재
- [x] 부정형/"불변" 기준 **0개** — AC4·AC6·AC7 은 "…한다/커밋된다/나가지 않는다(호출 수 0)" 로 **측정 가능한 양성 단언**
- [x] AC 간 모순 확인 — AC7(미선언 시 요청 0)과 AC5(선언 시 요청 1)는 **선언 유무로 배타**. AC8(exchange 우선)과 AC5 는 **우선순위로 정렬**되며 둘 다 참일 때 요청 수는 0
- [x] 인용 수치를 이번 세션에서 직접 측정 — `register` 호출부 N=2 · `principalId` 채움 1곳 · GLOSSARY `principal` 0건 · 가이드 §2 표 5행
- [x] 신규 모듈 3종 모두 테스트 방법 기재. electron 의존은 **포트 주입으로 떼어냄**
- [x] 전수 조사에 N 수치 있음
- [x] 각 AC 에 프로덕션 도달 경로 있음. **유일한 호출자가 테스트인 AC 0개** — AC1~3 의 도달 경로가 `bootstrap.createProviderPlatform` 임을 명시
- [x] 선택적 필드(`whoami?`·`principalPath?`)로 판정하는 곳마다 **미지정 케이스 AC**(AC7) 있음
- [x] 소비 계약의 제약 필드 강제 지점 — `whoami.path` 는 `sessions.send` 의 `isAllowedOrigin` 이, 로그인 후 재사용 시 `checkOutboundRequest` 가 강제(§설계)
- [x] 참조 구현(0181 exchange 경로) 대비 커버리지 — `AuthResult` 5분기 중 이번 변경이 닿는 것은 `session`·`token` 2분기이며 나머지 3(`secret`·`code-required`·`failed`)은 무변경임을 확인
- [x] 미룬 항목마다 일방향 여부 답변 — `whoami` 이름만 일방향이라 **지금 확정**
- [x] **관문 4 를 본문 완성 후 실행** — 기존 결정 표 7행을 본문 문장 기준으로 채웠고, 인용 경로를 `ls`/`rg` 로 확인(§자료조사), `[구현자 기입]`·`[검증자 기입]` 블록 유지
- [x] "확정돼 있다" 류 서술의 앵커 확인 — `GLOSSARY.md` 의 `principal` 이 **0건**이라 인용하지 않고 **표제어 등록을 AC14 로** 넣었다

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

구현 주체 = **Claude**(비기능 = 결함 수정 + 표시 배선, `docs/handoff/AGENTS.md` 역할 분담).

- **동의**: 순서(P0-1 → 신원)가 옳았다. 부팅 등록을 먼저 넣으니 AC4 회귀 테스트가 *그 자체로*
  결함의 재현이 됐다 — `restartedProcess({registerAtBoot:false})` 분기가 0182 이전 동작이다.
- **동의**: `whoami` 를 `sessions.send()` 로 돌린 판단. 구현해 보니 `exchange()` 와 코드 모양이
  거의 같아 두 경로가 같은 파싱 실패 처리를 공유한다 — 새 전송 개념이 늘지 않았다.
- **이견 없음.** 다만 설계가 덜 적은 것 4건을 아래에 적는다(전부 구현 세부라 선조치).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **`SessionGroupPolicy` 가 electron 을 무는 파일에 산다**(`infra/browser-session.ts`). 설계는 "포트를 받는다" 까지만 적었고 그 타입의 출처를 안 적었다 — 순수부(`browser-session-policy`)에는 없다 | ✅ **구조적으로 다시 선언**했다(`session-policies.ts`). `specs/browser-session.ts` 의 `BrowserSessionPort` 가 같은 이유로 같은 선택을 한 선례 | typecheck 가 즉시 잡았다(TS2305) |
| 2 | **점 경로 결과가 문자열이 아닐 수 있다.** 설계는 `pickPath` 재사용만 적었는데 숫자·객체·빈 문자열이 오면 사이드바에 `[object Object]` 가 뜬다 | ✅ `pickPrincipal()` 을 더해 **문자열·비어 있지 않음**일 때만 통과. 회귀 1건(`{"mail":{}}`) 추가 | 표시용 값이라 화면이 최종 소비자다 |
| 3 | **`api.test.ts` 가 없었다.** 설계는 AC4 검증 수단으로 그 파일을 지목했으나 0181 은 만들지 않았다 | ✅ 신설. 세션 전송 4건 + **fetch 스택으로 새면 던지는 `fetchImpl`** 로 경로 오염까지 잡는다 | `ls` 로 부재 확인 |
| 4 | **`infra/browser-session.ts:219` 주석이 삭제된 파일을 현재형으로 가리켰다**(`features/auth-platform/api.ts`) | ✅ `features/providers/auth/api.ts` 로 정정 | 죽은 좌표 정리 중 발견 |

**⚠️ 보고만 — WIA(P0-2) 조사는 부분 종결이다.** `npm ci` 로 `node_modules` 를 얻어
`electron.d.ts` 를 열었으나 `allowNTLMCredentialsForDomains(domains: string)` 의 docstring 은
*"Dynamically sets whether to always send credentials for HTTP NTLM or Negotiate authentication."*
뿐이고 **`''` 의 의미도, 미호출 시 기본값도 서술하지 않는다**. 전체 문서는 `electronjs.org`
egress 차단(`EGRESS_BLOCKED`). **설계대로 비범위 유지** — 선언 필드를 추가하지 않았다.
"잘못된 필드가 배포되면 그때부터 일방향" 이라는 §범위 판단이 그대로 선다.

## [구현자 기입] 구현 체크리스트

- [x] `SessionLookup`·`whoami`·`exchange.principalPath` 계약
- [x] `session-policies.ts` 순수 seam + 부팅 배선
- [x] whoami 조회 + exchange principal 우선 + 실패 흡수
- [x] renderer 순수 선택 규칙 + 훅 + 사이드바(버튼·팝오버 헤더 **두 곳**)
- [x] 선언 주석 예제 (+ 실제 파일에 채워 typecheck 확인 후 되돌림)
- [x] 문서 — 가이드 §1.6·§1.7·§2·§5-b·§6.3·§6.4·§9 · `providers.md` §4.1·§7.1 · `GLOSSARY` 2행
- [x] 죽은 좌표 정리 — 사용량 문서 4곳 · `browser-session` 주석 · `runtime-tools` 죽은 타입 경고

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **20** — 코드 9(계약·`session-policies`+test·`browser-session`+test·`api.test`·`bootstrap`·`principal`+test·`useProviderPrincipal`·배럴·`SidebarUserButton`) · 선언 주석 1 · 죽은 좌표 5 · 문서 5 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` |
| 게이트 결과 | lint **0 error / 1 warn**(0102 베이스라인) · typecheck **3/3** · vitest **195 파일(190/5) · 1,706 테스트(1,667/39)** |
| 신규 red | **0** — 실패 5파일이 문서화된 DB ABI 베이스라인과 정확히 일치(`infra/db/{queries,migrate}` · `extensions/builder` · `orchestration/fork` · `app/chat-turn.continuity`)이고 실패 테스트 수도 **39** 로 같다 |
| 신규 테스트 | **+30건** (`session-policies` 6 · `api` 4 · whoami 5 · `principal` 7 + 기존 파일 증분) |
| AC 충족 | **14/15** — AC15(사람 실기)만 미충족: SSO 실값(OQ1) 부재 + egress 차단으로 `npm run dev` 기동 불가(0181 AC13 · 0180 AC9 선례) |
| 블로커 / 역질문 | 없음 (WIA 부분 종결은 위 ⚠️) |
| 대상 커밋 | `b464cd3`(설계) + 구현 커밋 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (비어 있음) | — | — | — |
