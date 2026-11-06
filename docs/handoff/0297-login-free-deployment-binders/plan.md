# Plan — 0297-login-free-deployment-binders

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0297-login-free-deployment-binders` |
| 작성자 | Claude Code |
| 일자 | 2026-11-06 |
| 매핑 | 브랜치 `claude/login-free-plugin-tests-8vfoup` |
| 상태 | **READY** |
| V mode | `Baseline V` |
| 기준 V | `none` — 0248의 D-016 중 Harness·Usage 제외 문장만 이 plan의 D-002가 대체한다(V 상속 아님) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 문제: `app/deployment/` 의 배포 factory 중 Usage와 Harness config API는 자격증명 대상만 bind할 수 있다. 로그인 프리 대상(공개 API·로컬 키 API)으로 원격 사용량·사내 설정 API를 붙이려는 폐쇄망 배포는 Bootstrap을 고치지 않고는 조립할 수 없다.
- 문제: 로그인 프리 경로의 테스트가 Plugin 도구(0248)와 호스트 연결 harness row(0291)에만 있다. Usage·config API·usage row에는 로그인 프리 테스트가 0건이다.
- 완료 후: 배포는 `createUsageFetcher`·`createConfigApiAugmenters` 안에서 `deps.auth.bindLoginFreePlugin(id)`로 로그인 프리 포트를 받아 요청할 수 있고, 그 경로를 가상 배포 테스트가 끝까지 태운다.
- 한 문장: 폐쇄망 배포자가 `app/deployment/`만 고쳐 로그인 프리 대상으로 원격 사용량·config API를 조립할 수 있고, 그 조립이 앱 자격증명·게이트·vault에 닿지 않음이 테스트로 잠긴다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "`app/src/main/app/deployment`에서 로그인프리플러그인에 대한 테스트가 부족하다. 일부는 인증이 필요한 것들에 대해서만 지원하고있는 모듈이 있다. E.g., usage-fetcher" | 라이브 세션 `/handoff-plan` |
| 명시 결정 | 확장 범위 = "usage + harness config API" | 라이브 세션 질의 응답 |
| 추론 의도 | 확장한 두 모듈 외 기존 로그인 프리 지원 모듈(connections usage/harness row)의 빈 테스트도 채운다 — 요구 첫 문장 "테스트가 부족하다"의 범위 | 요구 문장 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 로그인 프리 지원을 넓히는 모듈은 `usage-fetcher.ts`(`UsageDeploymentDeps`)와 `harness-runtime.ts`의 config API 방식(`HarnessConfigApiDeps`) 둘이다 | 사용자 선택 "usage + harness config API" | 사용자 턴 | ACTIVE | — |
| D-002 | 두 deps의 `auth`에 `bindLoginFreePlugin`을 더한다. 0248 D-016의 "Harness/Usage에 들어가지 못하게 한다"는 이 두 factory에 한해 대체한다 | 0248 plan §6 "Harness·Usage의 로그인 프리 사용 — binder 확장으로 가능 — 후속" | 사용자 턴 + 0248 plan | ACTIVE | 0248 D-016 일부 |
| D-003 | 확장은 `AuthBinder`(`contracts/auth.ts`)를 `Pick<AuthRuntime,'bind'\|'bindLoginFreePlugin'>`로 넓혀 한 곳에서 한다. `ConnectionDeploymentDeps`도 같은 타입을 쓴다 | 같은 능력 집합이 세 deps에 복붙되면 갈린다. 현재 `AuthBinder` 소비처는 `usage-fetcher.ts` 1곳 | 설계자 | ACTIVE | — |
| D-004 | `bind`·`tryBind`·`bindForPlugin`·`AuthSecretReader`는 계속 로그인 프리 id를 해석하지 않는다. `bind(loginFreeId).request`는 `unknown_auth`로 거부된다 | 0248 D-016의 fail-closed 부분은 유지한다 — 로그인 프리가 자격증명 성공을 위조하지 않는다(ADR-006 invariant) | 0248 D-016 · ADR-006 | ACTIVE | — |
| D-005 | Usage·config API deps에 `bindForPlugin`·`tryBind`·lifecycle(`login`·`continue`·`reauth`·`revoke`·`resume`·`refresh`·`subscribe`·`connect`·`connectAll`)을 주지 않는다 | `PluginAuth.withCredential`은 raw credential을 연다 — config API 방식은 raw secret을 못 읽어야 한다(0188 r5 D-048) | 설계자 · `harness-runtime.ts:40-55` | ACTIVE | — |
| D-006 | `connectionValue`는 config API deps에만 남는다. Usage deps에 더하지 않는다 | 사용자가 고른 범위 밖이고 요구 근거가 없다 | 설계자 | ACTIVE | — |
| D-007 | Bootstrap(`bootstrap.ts`)은 수정하지 않는다 | Bootstrap은 이미 full `AuthRuntime`을 넘긴다(`bootstrap.ts:655`·`:695`). 가이드 §1.1 "`bootstrap.ts`는 열지 않는다" | 가이드 §1.1 | ACTIVE | — |
| D-008 | ADR-006 "포기한 것"의 "Harness·Usage의 로그인 프리 binder 사용"은 새 ADR-011이 대체하고 ADR-006 상단에 부분 대체 표기를 단다 | `docs/decisions/README.md` "기존 ADR을 고쳐 쓰지 않는다" | 저장소 규칙 | ACTIVE | — |
| D-009 | 기본 배포 내용("비어 있다")은 테스트로 고정하지 않는다. 가상 배포 fixture로 검증한다 | `app/AGENTS.md` 0294 D-007 | 저장소 규칙 | ACTIVE | — |

### 갱신 메모

- 이번 턴 신규: D-001~D-009 (첫 plan).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-002 ↔ AC1·AC2(허용), D-004 ↔ AC3(유지), D-005 ↔ AC3(차단), D-007 ↔ §18 파일 목록에 `bootstrap.ts` 없음, D-009 ↔ AC1~AC4 전부 fixture 기반.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 | `usage-fetcher.ts:21-23` `auth: AuthBinder` = `Pick<AuthRuntime,'bind'>`(`contracts/auth.ts:516`). `bind(loginFree).request`는 `authenticated-request.ts:104-105`에서 `unknown_auth` throw |
| 이미 충족되는가 | 부분 | Plugin(`plugins.ts:76`)·카탈로그(`connections.ts:43`)는 이미 `bindLoginFreePlugin`을 받는다. config API는 `connectionValue`만 받는다(`harness-runtime.ts:53-55`) — 로그인 프리 HTTP 요청은 불가 |
| 더 작은 해법 | 타입 한 줄 확장 + 테스트 | Bootstrap은 full runtime을 넘기므로 런타임 배선 변경 0(D-007) |
| 선행 자료 대조 | 정정 1건 | 가이드 §1.1 표가 config API를 "`auth: AuthBinder` **만**"으로 적지만 실제는 `bind`+`connectionValue`(0291) — 문서 낡음, 이번에 고친다 |
| 기존 결정 충돌 | 0248 D-016 · ADR-006 일부 | 사용자 결정으로 대체(D-002·D-008). fail-closed 부분은 유지(D-004) |

- 사용자에게 올릴 결정: 없음 (D-001 확정됨).
- 코드 조사로 닫은 사실: Bootstrap 수정 불필요, `AuthBinder` 소비처 1곳, `HarnessConfigApiDeps['auth']`를 직접 구현하는 테스트 stub 2곳(§8 전수).

## 5. 동작 / 사용자 흐름

```text
[배포자] auth-definitions.ts 에 LoginFreeDefinition(origin) 선언 → LOGIN_FREE_DEFINITIONS
  → usage-fetcher.ts:  deps.auth.bindLoginFreePlugin(id) → LoginFreePluginAuth
  → harness-runtime.ts: deps.auth.bindLoginFreePlugin(id) → config API resolve
[런타임] fetchUsage / augmenter.resolve → request(상대 path) → 선언 origin, 앱 credential 주입 없음
  → 2xx: 배포 매퍼가 UsageSnapshot / runtimeEnv 생성
  ↘ 401·403·네트워크: 응답/throw가 배포 코드로 그대로 전달, Auth snapshot·change 불변
  ↘ origin 미선언 대상: request가 `origin_not_declared`로 거부 → fetch/resolve 실패
  ↘ 실수로 deps.auth.bind(loginFreeId): request가 `unknown_auth`로 거부
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 소비자에게 보이는 결과 |
|---|---|---|
| 로그인 프리 usage 요청 2xx | 선언 origin으로 요청, 헤더는 배포가 준 것만 | 사용량 snapshot |
| 로그인 프리 요청 401/403 | 상태 전이 없음(`login-free.ts:1`) | fetch/resolve 실패, 카탈로그 행 `연결됨` 유지 |
| 다른 자격증명 Auth 로그인·해제 | 로그인 프리 snapshot 불변 | 로그인 프리 usage·config 영향 없음 |
| usage/harness row에 로그인 프리 포트 | `describe` → login-free 디스크립터 | `kind` 매핑 유지, `authScheme:'login-free'`, `auth:[]`, `status:'valid'` |

## 6. 범위 / 비범위

- **범위**: `AuthBinder` 확장(D-003) · Usage/config API deps 타입 · 로그인 프리 Usage/config API/usage row/harness row(connect 무선언) 가상 배포 테스트 · 능력 경계 테스트 · 가이드·auth.md·ADR 갱신.
- **비범위**: direct credential 방식의 로그인 프리 사용(로그인 프리에는 secret이 없다) · 게이트·MCP `${BINDING}`·부팅 복원(D-004) · Usage deps의 `connectionValue`(D-006) · `UsageTracker`/DB 내부 · 실제 로그인 프리 배포 추가(D-009) · 로그인 프리 대상의 harness invalidation 정책(§10 선언 경계).

| 미룬 항목 | 지금 정하지 않으면 비싸지는가 | 처리 |
|---|---|---|
| Usage deps `connectionValue` | 아니오 — 추가 확장 | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `UsageDeploymentDeps`만으로 만든 fetcher가 로그인 프리 대상의 선언 origin에 요청하고, 2xx는 snapshot, 401은 reject, origin 미선언 대상은 reject한다. 어느 경우에도 Auth change 0건·로그인 프리 snapshot 불변이며 요청에 `Authorization`이 없다(다른 자격증명 Auth가 로그인된 상태에서도) | 가상 배포 테스트: URL·헤더·반환·changes·snapshot 단언 | `bootstrap.ts:695 createUsageFetcher({auth})` → `bindLoginFreePlugin` → `login-free.ts request` → `fetchImpl` |
| R-02 | AT-02 / AC2 | `HarnessConfigApiDeps`만으로 만든 config API augmenter가 로그인 프리 origin 응답으로 `runtimeEnv` overlay를 만들고, 403이면 resolve가 reject하며 Auth change 0건이다 | 가상 배포 테스트: `createHarnessRuntimeConfigService` → `prepareHarnessConfig` env 단언 | `bootstrap.ts:655 createRuntimeConfigAugmenters({auth})` → `mergeAugmenters` → service resolve |
| R-03 | AT-03 / AC3 | 두 deps의 `auth`로 `bindForPlugin`·`tryBind`·`login`·`revoke`·`resume`·`subscribe`·`connect`에 도달할 수 없다(컴파일). 두 deps의 `bind(loginFreeId).request`는 `unknown_auth`로 reject한다(런타임) | `@ts-expect-error` 단언(typecheck:test) + 런타임 reject 단언 | 같은 deps 타입 |
| R-04 | AT-04 / AC4 | `usageRows`·`harnessRows`에 connect 무선언 로그인 프리 포트를 넣으면 `ProviderInfo`가 `authScheme:'login-free'`·`auth:[]`·`status:'valid'`·`origin`(선언값 또는 `''`)·`connection` 키 없음이고 `kind`는 usage=`service`·harness=`llm`이다 | 가상 배포 `connectionState` 행 단언 | `createConnectionSources` → `connectionState` → `orca:provider:state` |
| R-05 | AT-05 / AC5 | `AuthBinder`가 `bindLoginFreePlugin`을 포함하고 `UsageDeploymentDeps`·`HarnessConfigApiDeps`·`ConnectionDeploymentDeps`가 그 타입에서 파생된다 | AC1·AC2·AC4 fixture를 실제 deps 타입으로 작성 → `AuthBinder`에서 `bindLoginFreePlugin`을 빼면 typecheck red | `contracts/auth.ts:516` |
| R-06 | AT-06 / AC6 | 기존 자격증명 Usage·config API·direct credential·카탈로그·0190 경계·0291 연결·engine IPC 테스트가 그대로 green이다 | 기존 스위트 재실행 | 기존 경로 |

### AC 검증 주의사항

- 기존 테스트 재사용: `deployment-wiring.test.ts` "가상 배포 — Usage"(L442)·"가상 배포 — Harness 실행 구성"(L376)·"배포 factory 의 능력 경계 (0190)"(L533) 존재 확인. 로그인 프리 단언은 0건.
- 사람 실기: 없음. 전부 순수 vitest(DB·electron 미로드).
- AC1 "Authorization 없음"은 구별 입력이 필요하다: 같은 테스트에서 `CREDENTIAL`을 PAT로 먼저 로그인해 둔다 — 잘못 자격증명 포트를 쓰면 헤더가 실린다.

## 7-A. V / Trace Matrix

- V mode: Baseline V. 상속 기준 없음. `SUPERSEDED` 이관: 해당 없음.
- 변경 시작 수준: R(배포자 관측 능력) + AR(deps 타입 계약).

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01·AT-01 | R/AT | §7 R-01 | NEW | — |
| R-02·AT-02 | R/AT | §7 R-02 | NEW | — |
| R-03·AT-03 | R/AT | §7 R-03 | NEW | — |
| R-04·AT-04 | R/AT | §7 R-04 | NEW | — |
| AR-01·IT-01 | AR/IT | §10 `AuthBinder` SSOT (R-05) | NEW | — |
| R-06·AT-06 | R/AT | §7 R-06 | NEW(회귀 묶음) | 기존 스위트 |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별, 입력 분기) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `createUsageFetcher(deps)` → `deps.auth.bindLoginFreePlugin` → `LoginFreePluginAuth.request` → `fetchImpl` → 배포 매퍼 | 신규 `login-free-deployment.test.ts` "로그인 프리 Usage" — 입력 (a) `USAGE_API` 200 → snapshot `{providerKey, raw:'result'}`·URL `https://usage.example.corp/api/usage`·헤더 `Authorization` 없음 (b) status 401 → reject·changes 0·snapshot 불변 (c) `LOCAL_PLUGIN`(origin 없음) → reject `origin_not_declared` (d) `supports(다른 key)` false. 전 입력 전에 `CREDENTIAL` PAT 로그인 | not selected — 직접 oracle이 URL·헤더로 구별 | EP-1 (1자리) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `createConfigApiAugmenters(deps)` → `mergeAugmenters` → `createHarnessRuntimeConfigService.resolve` → `bindLoginFreePlugin().request` → `prepareHarnessConfig` | 신규 같은 파일 "로그인 프리 config API" — 입력 (a) `CONFIG_API` 200 → `prepared.env.CORP_LLM_CONFIG==='result'`·URL `https://llm-config.example.corp/v1/config` (b) 403 → resolve reject·changes 0 | not selected | EP-2 (1자리) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | deps 타입 → 배포 factory 본문 | 신규 `deployment-wiring.test.ts` 0190 describe 확장 — `UsageDeploymentDeps['auth']`·`HarnessConfigApiDeps['auth']` 각각 `@ts-expect-error` 7종(`bindForPlugin`·`tryBind`·`login`·`revoke`·`resume`·`subscribe`·`connect`) + 실제 `createAuthRuntime` 기반 두 deps에서 `bind(USAGE_API.id).request` reject `unknown_auth` (login-free-deployment.test.ts) | required — `@ts-expect-error`는 구조 proxy. 변이: `UsageDeploymentDeps.auth`를 `AuthRuntime`으로 되돌림 → typecheck:test red | EP-3 (2자리) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `usageRows`/`harnessRows` → `connectionState` → `ProviderInfo` | 신규 같은 파일 "로그인 프리 usage·harness row" — 입력 `[gateRows(CREDENTIAL), harnessRows(CONFIG_API), usageRows(USAGE_API), usageRows(LOCAL_PLUGIN)]` → 행 1~3 각각 `kind`(`llm`/`service`/`service`)·`authScheme:'login-free'`·`origin`(선언값/선언값/`''`)·`auth:[]`·`status:'valid'`·`'connection' in row === false`; 행 0 `login-required` | not selected | EP-4 (2자리) |
| VP-05 | AR-01 ↔ IT-01 | REQUIRED | `contracts/auth.ts AuthBinder` → 세 deps 선언 | `gate:npm run typecheck` — VP-01·02·04 fixture가 실제 deps 타입으로 `bindLoginFreePlugin`을 호출하므로 `AuthBinder`에서 빼면 red | required — 변이: `AuthBinder`를 `Pick<AuthRuntime,'bind'>`로 되돌림 → typecheck red 관측 | EP-5 (3자리) |
| VP-06 | R-06 ↔ AT-06 | REGRESSION | 기존 경로 | `deployment-wiring.test.ts` 전체 · `opencode-connection-deployment.test.ts` · `handlers/engine.ipc.test.ts` · `login-free-deployment.test.ts` 기존 케이스 · `features/auth` | — | 0 — 기존 계약 불변 |

### 현재 변경의 운영 gate

| Gate | 이유 | 명령 | 실패 범위 |
|---|---|---|---|
| lint + typecheck | `app/**` 변경 | `cd app && npm run lint && npm run typecheck` | 이번 변경 유발분 |
| 관련 vitest | 비-DB | `./node_modules/.bin/vitest run src/main/app/deployment src/main/features/auth src/main/app/handlers/engine.ipc.test.ts` | 이번 변경 유발분 |
| 문서 인벤토리·링크 | `docs/**` 변경 | `node scripts/check-doc-inventory.mjs --check` | 이번 변경 유발분 |
| 테스트 예산 | 테스트 소스 변경 | `node scripts/check-test-budgets.mjs` | 이번 변경 유발분 |
| 가이드 예제 = fixture | 가이드가 "같은 예제를 컴파일하는 테스트"를 약속(§4 표) | verify가 가이드 신규 코드 블록과 fixture 함수 본문을 대조 | 불일치 시 FAIL |
| commit trailer | message-bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 FAIL |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `AuthBinder = Pick<AuthRuntime,'bind'>` | `app/src/main/contracts/auth.ts:516` |
| `bind`는 자격증명 requester로 직행, 로그인 프리 id면 `unknown_auth` | `features/auth/runtime.ts:214-218` · `authenticated-request.ts:104-105` |
| `bindLoginFreePlugin`은 `LoginFreePluginAuth`(withCredential 없음) | `runtime.ts:257-271` · `contracts/auth.ts:501-504` |
| 로그인 프리 request: origin 미선언 → `origin_not_declared`, 상태 전이 없음, 헤더 그대로 | `features/auth/login-free.ts:35-71` |
| Bootstrap은 full `auth`를 넘긴다 | `app/bootstrap.ts:655-663` · `:695` |
| `connectionView`는 category와 무관하게 `describe`로 scheme을 얻는다 | `app/connection-views.ts:60-75` |
| 0248 D-016·§6이 Harness·Usage를 "binder 확장으로 가능 — 후속"으로 남김 | `docs/handoff/0248-login-free-plugin-auth/plan.md:66,128,134` |

### 전수 조사

| 대상 | 검색 | N | 의미 |
|---|---|---:|---|
| `AuthBinder` 코드 소비처 | `rg -n 'AuthBinder' app/src --type ts` (주석 제외) | 1 | `usage-fetcher.ts:18,22` |
| `HarnessConfigApiDeps` 소비처 | `rg -n 'HarnessConfigApiDeps' app/src --type ts` | 4파일 | `harness-runtime.ts`·`deployment-wiring.test.ts`(L49·341·540)·`opencode-connection-deployment.test.ts`(L51·78)·`handlers/engine.ipc.test.ts`(L14·75) |
| `HarnessConfigApiDeps['auth']`를 직접 구현하는 객체 | 위 결과 중 리터럴 객체 | 2 | `deployment-wiring.test.ts:540`·`engine.ipc.test.ts:75` — 확장 후 `bindLoginFreePlugin` stub 필요 |
| `UsageDeploymentDeps` 소비처 | `rg -n 'UsageDeploymentDeps' app/src` | 2파일 | `usage-fetcher.ts`·`deployment-wiring.test.ts`(L52·422·721) — 리터럴 구현 0 |
| 배포 deps의 `auth:` 선언 | `rg -n '^\s+auth: ' app/src/main/app/deployment/*.ts -g '!*.test.ts'` | 4 | connections:43 · harness-runtime:54 · plugins:76 · usage-fetcher:22 (plugins는 별도 binder 유지) |
| 문서의 `AuthBinder`/deps 서술 | `rg -n 'AuthBinder\|HarnessConfigApiDeps\|UsageDeploymentDeps' docs -g '!handoff/0*' -g '!archive/**'` | auth.md 3곳 · guide 7곳 | §18 갱신 대상 |

### 수치 / 전칭 검산

- "로그인 프리 테스트 0건": `rg -c -i 'loginFree|login-free|로그인 프리'` → `plugins.test.ts` 0 · `connections.test.ts` 0 · `deployment-wiring.test.ts` 1(주석) · usage·config API 단언 0.
- 문서 앵커 확인: 가이드 `### 로그인 프리 Plugin 레시피`(L824)·`### 살아 있는 선례 — 사용량 fetcher (0186)`(L1237)·auth.md `## 8. Usage`(L797) 존재.

## 9. Architecture — AS-IS → TO-BE

### AS-IS

```text
bootstrap: createUsageFetcher({auth: AuthRuntime})
  → UsageDeploymentDeps.auth: AuthBinder(bind)           ← bindLoginFreePlugin 타입상 불가
bootstrap: createRuntimeConfigAugmenters({auth, secrets})
  → HarnessConfigApiDeps.auth: Pick<bind|connectionValue> ← 로그인 프리 HTTP 불가
connections: ConnectionDeploymentDeps.auth: Pick<bind|bindLoginFreePlugin> (별도 인라인 Pick)
```

### TO-BE

```text
contracts/auth.ts  AuthBinder = Pick<AuthRuntime, 'bind' | 'bindLoginFreePlugin'>
  ├─ UsageDeploymentDeps.auth      : AuthBinder
  ├─ HarnessConfigApiDeps.auth     : AuthBinder & Pick<AuthRuntime,'connectionValue'>
  └─ ConnectionDeploymentDeps.auth : AuthBinder
bootstrap.ts 불변 (full AuthRuntime이 구조적으로 만족)
```

### Delta

| 축 | AS-IS | TO-BE | V |
|---|---|---|---|
| 계약 | `AuthBinder`=bind | bind+bindLoginFreePlugin | AR-01/VP-05 |
| Usage 능력 | 자격증명만 | + 로그인 프리 포트 | R-01/VP-01 |
| config API 능력 | 자격증명 + connectionValue | + 로그인 프리 포트 | R-02/VP-02 |
| 차단 능력 | 문서·0190 테스트(config API만) | Usage까지 `@ts-expect-error` | R-03/VP-03 |
| 테스트 | 로그인 프리 Usage/config/usage row 0 | VP-01·02·04 | — |
| 문서 | "로그인 프리 id를 `AuthBinder`에 넣지 않는다" | `bind`에는 넣지 않고 `bindLoginFreePlugin`을 쓴다 | §15 |

## 10. 계약 / 강제 지점

| V / pair | 계약 | SSOT | 언제 강제 (자리 = 분모) | 자리 검색 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-05 | `AuthBinder` 능력 집합 | `contracts/auth.ts` | EP-5: ① `usage-fetcher.ts` `UsageDeploymentDeps.auth` ② `harness-runtime.ts` `HarnessConfigApiDeps.auth` ③ `connections.ts` `ConnectionDeploymentDeps.auth` | `rg -n '^\s+auth: ' app/src/main/app/deployment/*.ts -g '!*.test.ts'` → 4건 중 plugins.ts 제외 3건 | 자리가 `AuthBinder`가 아닌 인라인 Pick이면 능력이 갈린다 |
| R-01 / VP-01 | 로그인 프리 Usage 요청 | `login-free.ts` | EP-1: ① fixture `createUsageFetcher`의 `bindLoginFreePlugin` 호출 | fixture 본문 `rg -n 'bindLoginFreePlugin' …login-free-deployment.test.ts` | — |
| R-02 / VP-02 | 로그인 프리 config API | 동일 | EP-2: ① fixture `createConfigApiAugmenters`의 `bindLoginFreePlugin` 호출 | 동일 | — |
| R-03 / VP-03 | 차단 능력 | deps 타입 | EP-3: ① `UsageDeploymentDeps['auth']` ② `HarnessConfigApiDeps['auth']` | `rg -n 'auth: AuthBinder' app/src/main/app/deployment` | `@ts-expect-error`가 오류 없음이 되면 typecheck red |
| R-04 / VP-04 | login-free row 투영 | `connection-views.ts` | EP-4: ① `usageRows` ② `harnessRows` | `rg -n '^export function (usage\|harness)Rows' app/src/main/app/deployment/connections.ts` → 2 | — |

- **선언 경계**: (a) 로그인 프리 포트는 Auth change를 내지 않으므로 `AUTH_INVALIDATED_HARNESS_KEYS`에 로그인 프리 id를 적어도 요청 실패로는 invalidate되지 않는다 — config API 결과 갱신은 서비스 캐시 정책 몫이고 이 handoff는 다루지 않는다(측정: `login-free.ts:1` "요청 실패는 상태를 바꾸지 않는다"). (b) connect 선언 로그인 프리 대상을 Usage에 쓰는 경우 연결 상태와 무관하게 request가 나간다(`login-free.ts:35` request는 snapshot을 보지 않는다). (c) Bootstrap이 deps를 넘기는 자리는 production factory 기본값이 `undefined`/`{}`라 실행 oracle이 없다 — typecheck gate만 잠근다(D-009).
- 열린 입력 집합 판정 산출물: 해당 없음.
- 선택 필드 의미: `LoginFreeDefinition.origin` 미선언 → request 거부(VP-01 (c)).

## 11. 구현 설계

| 파일 | 변경 | 테스트 seam |
|---|---|---|
| `app/src/main/contracts/auth.ts` | `AuthBinder`를 `Pick<AuthRuntime,'bind'\|'bindLoginFreePlugin'>`로. 주석: `bind`는 자격증명만, 로그인 프리는 `bindLoginFreePlugin`, `bindForPlugin`(raw credential)은 Plugin deps 전용 | typecheck |
| `app/src/main/app/deployment/usage-fetcher.ts` | 타입 변화만(`AuthBinder` 유지). 주석에 로그인 프리 사용·가이드 앵커 한 줄 | — |
| `app/src/main/app/deployment/harness-runtime.ts` | `HarnessConfigApiDeps.auth: AuthBinder & Pick<AuthRuntime,'connectionValue'>` | — |
| `app/src/main/app/deployment/connections.ts` | `ConnectionDeploymentDeps.auth: AuthBinder` | — |
| `app/src/main/app/deployment/login-free-deployment.test.ts` | fixture에 `USAGE_API`(origin `https://usage.example.corp`)·`CONFIG_API`(origin `https://llm-config.example.corp`) 로그인 프리 선언 추가. 가이드 예제와 같은 `createUsageFetcher(deps: UsageDeploymentDeps)`·`createConfigApiAugmenters(deps: HarnessConfigApiDeps)` fixture. describe 3개(VP-01·02·04) + VP-03 런타임 `unknown_auth` | 순수 vitest. fetchImpl의 `init.headers` 기록 추가 |
| `app/src/main/app/deployment/deployment-wiring.test.ts` | 0190 describe: config API stub에 `bindLoginFreePlugin` 추가, `bindForPlugin`·`tryBind` `@ts-expect-error` 추가, Usage deps 케이스 신설 | typecheck:test |
| `app/src/main/app/handlers/engine.ipc.test.ts` | `authStub`에 `bindLoginFreePlugin`(refused throw) 추가 | 기존 단언 유지 |

### 테스트 가능성

- electron 미로드: `createAuthRuntime`·`RuntimeToolRegistry`·`createHarnessRuntimeConfigService`·`prepareHarnessConfig`는 이미 같은 파일들에서 vitest로 쓰인다.
- 헤더 관측: fixture `fetchImpl`이 `new Headers(init?.headers)`를 기록한다(`deployment-wiring.test.ts:170` 선례).

## 12. End-to-end 영향

- producer: 배포 매퍼(fixture/포크). consumer: `UsageTracker`(fetcher 포트만 봄)·harness runtime catalog. 계약 형상(`UsageSnapshot`·`RuntimeConfigAugmenters`) 불변.

| 기존 소비처 | 영향 | 회귀 |
|---|---|---|
| `bootstrap.ts:655`·`:695` | 없음 (full runtime) | AC6 typecheck |
| `engine.ipc.test.ts` stub | method 1개 추가 | AC6 |
| `deployment-wiring.test.ts:540` stub | method 1개 추가 | AC6 |
| 포크 배포 코드 | 사용하는 쪽은 호환. `AuthBinder`를 직접 구현한 포크 stub만 method 추가 필요 | §17 |

## 13. Lifecycle / 오류 / 정리

- 생성: 배포 factory 호출 시 bind(부팅 1회). 취소: `signal`을 `request`로 전달(기존과 동일). 오류: 로그인 프리 응답은 상태 전이 없이 배포 코드로. 정리: 해당 없음.
- 다중 저장소 쓰기: 해당 없음(코드). 문서 산출물은 plan.md + `INDEX.md` 두 곳 — 커밋 하나에 함께 담는다.

## 14. 성능 / 상한

- 새 요청 수: 0 (기본 배포 비어 있음). 포크가 채우면 기존 자격증명 경로와 같은 1요청/fetch. 테스트 fixture는 `maxBytes: 64 * 1024`로 상한을 보인다.

## 15. 외부 구현 포트 / 문서 계약

- 포트: `UsageDeploymentDeps`·`HarnessConfigApiDeps`(폐쇄망 배포자 구현).
- 문서: 가이드 §1.1 factory 표·`AuthBinder` 문단 정정, `### 로그인 프리 Plugin 레시피` 뒤에 `### 로그인 프리 원격 사용량·config API 레시피` 신설(표 + 예제 2개, "fixture와 같은 예제" 명시), §5-b 선례 문단에 한 줄 링크. auth.md L112-113·L126-129·§8에 `bindLoginFreePlugin` 사용 문장, `Decision rationale: ADR-011`. ADR-011 신설 + ADR-006 상단 `> 일부(Harness·Usage binder) superseded by ADR-011` + decisions README 표 행.
- shape: 가이드 신규 예제 = `login-free-deployment.test.ts` fixture 본문(운영 gate 대조).
- semantics: 성공=snapshot/env, 실패=reject, 상태 전이 0 — VP-01·02가 단언.

## 16. 기존 결정·규칙과의 관계

| 기존 결정 | 출처 | 본문 문장 | 결과 |
|---|---|---|---|
| 0248 D-016 | 0248 plan | D-002·D-004 | 일부 대체(Harness config API·Usage), fail-closed 유지 |
| ADR-006 포기한 것 | decisions/006 | D-008 | ADR-011이 일부 대체 |
| 0188 r5 D-048 두 능력 분리 | `harness-runtime.ts:40-47` | D-005 | 유지 — config API는 여전히 raw secret 없음 |
| 0190 좁은 binder | `contracts/auth.ts:506-516` | D-003 | 유지 — lifecycle 미노출, 능력 1개 추가 |
| 가이드 §1.1 Bootstrap 미수정 | guide | D-007 | 유지 |
| 0294 D-007 기본 배포 고정 금지 | `app/AGENTS.md` | D-009 | 유지 |

## 17. 리스크

| 리스크 | 완화 |
|---|---|
| 포크가 `AuthBinder` stub을 직접 구현했다면 컴파일 깨짐 | 가이드에 한 줄 명시. 저장소 내 2곳은 이번에 고친다 |
| 배포자가 로그인 프리 포트를 자격증명처럼 믿음(재인증으로 회복 기대) | 가이드 레시피에 "401/403은 상태를 바꾸지 않는다 — 회복 경로 없음, 배포 매퍼가 오류로 낸다" 명시 |

- 되돌리기 어려운 결정: 없음(타입 확장, 하위 호환). 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/contracts/auth.ts` · `app/src/main/app/deployment/{usage-fetcher,harness-runtime,connections}.ts`
- `app/src/main/app/deployment/{login-free-deployment,deployment-wiring}.test.ts` · `app/src/main/app/handlers/engine.ipc.test.ts`
- `docs/guides/closed-network-extensions.md` · `docs/arch/backend/auth.md` · `docs/decisions/{006-login-free-auth-scheme,011-login-free-deployment-binders,README}.md`

## 19. 게이트

- 적용 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 기본 정적: `npm run lint && npm run typecheck`. 관련 테스트: §7-A 운영 gate의 vitest 명령(비-DB, `pretest` 우회). `scripts/check-doc-inventory.mjs --check`·`check-test-budgets.mjs`.
- 사람 실기: 없음.

## READY self-review

- [x] Decision Ledger D-001~D-009, 사용자 결정 D-001 원문 반영.
- [x] Part I만으로 완료 상태 설명 가능, 조건절 재해석 없음.
- [x] AC1~AC6 모두 행동 단언·검증·도달 경로 보유, 실기 0.
- [x] Baseline V, NEW node 전부 REQUIRED pair, 회귀 VP-06.
- [x] 각 pair에 path·§10 자리·검색 명령·입력 분기((a)~(d)) 보유. 구조 proxy인 VP-03·VP-05만 적대 증거 선택.
- [x] 선언 경계 (a)~(c) 측정 근거와 함께 기재.
- [x] INDEX `## 새 handoff 후보`에서 `deployment`·`usage`·`login` 겹침 행 0 확인.
- [x] 소비처 전수(§8) — stub 2곳 포함.
- [x] 게이트 명령이 `app/AGENTS.md`와 일치.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 기록.
