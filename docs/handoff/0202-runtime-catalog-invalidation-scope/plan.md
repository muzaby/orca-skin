# Plan — runtime-catalog-invalidation-scope

## 메타

| 항목 | 값 |
|---|---|
| slug | `0202-runtime-catalog-invalidation-scope` |
| 작성자 | Claude Code |
| 일자 | 2026-08-26 |
| 매핑 | 0198 파생 — 설정 CRUD가 플러그인 LLM 행을 지운다 |
| 상태 | DRAFT → READY |

# Part I — Product & UX Contract

## 1. Context / 목표

플러그인 LLM 행이 사라지는 축이 **둘**이다 — 둘 다 "카탈로그 상태를 바꾼 쪽이 재조정을 잇지 않는다"는 같은 형태다.

- 해결하려는 문제 ①(편집 축): 엔진 & 모델에서 **아무 provider나 추가·수정·삭제하면 플러그인이 등록한 LLM 행이 두 UI에서 사라지고 재로그인·재시작 전까지 돌아오지 않는다**. `engine.ts:39`의 `runtimeModelCatalog.invalidate()`가 인자 없이 **전체** contribution을 drop하는데, 그 뒤 reconcile을 다시 미는 쪽이 없다.
- 해결하려는 문제 ②(부팅 축): **contribution의 소유 Auth가 gate가 아니면 그 행은 부팅에서 아예 나타나지 않는다**. 나머지 batch는 `auth-resume.ts:208`에서 `emitVerifiedChange:false`로 probe하고, `login.ts:355-357`이 그 값을 보고 `onSnapshot`을 건너뛴다 — `AuthChange`가 없으니 `bootstrap.ts:643`의 bridge 통지도 돌지 않는다.
- 완료 후 달라지는 것: 무효화 폭이 **편집한 canonical key 하나**로 좁아지고, 카탈로그 무효화가 **drop + reconcile replay를 한 동작**으로 묶이며, 부팅 복원의 **성공한 verified 전이가 카탈로그 재조정으로 이어진다**.
- 성공을 사용자 관점에서 한 문장으로: 사용자는 앱을 켜면 플러그인이 제공한 모델을 보고, 다른 엔진을 편집해도 계속 본다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "동적으로 추가된 플로그인 llm 모델이 사라지는 현상이 발생하고 있다. 원인을 찾고 컨셉슈얼한 대안을 제안하라" | 라이브 세션 (2026-08-26) |
| 명시 요구 | "B로 폭 줄이고 A로 대칭 맞추자" — 조사 턴이 제시한 대안 B(무효화 폭 축소) + A(무효화·재조정 결합) 채택 | 라이브 세션 (2026-08-26) |
| 명시 요구 | "plan 문서에 α로 0202에 D-008 추가하고 AC·강제 지점 갱신해줘" — 부팅 축 대안 α(복원 batch의 성공 verified를 카탈로그 재조정으로 잇는다) 채택 | 라이브 세션 (2026-08-26) |
| 추론 의도 | 대안 C(빈 cache를 비활성 행으로 표시)는 고르지 않았으므로 **0198 D-008의 "숨긴다"가 유지**된다. | 사용자가 A·B·α만 지정 |
| 추론 의도 | "폭 축소"는 `harnessSettings.invalidateAll()`까지 좁히라는 뜻이 아니다 — 열거 캐시는 디렉터리 추가·삭제로 목록 자체가 바뀐다. | §4 코드 조사 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 설정 CRUD의 런타임 무효화는 **편집된 canonical key 하나**로 좁힌다 — `harnessRuntime.invalidate(key)`와 `catalog.invalidate(key)` 둘 다. | 편집 대상 key와 contribution key는 `engine.ts:44-49`의 `assertMutable`이 이미 배타로 만든다. 좁히면 플러그인 행이 CRUD 축에 아예 닿지 않는다. | 사용자 "B로 폭 줄이고" | ACTIVE | — |
| D-002 | 카탈로그 무효화는 **drop과 reconcile replay를 한 동작**으로 묶는다 — `invalidate`가 스스로 영향받은 authId를 현재 snapshot으로 재조정한다. | 짝 없는 drop 호출자가 존재할 수 없게 한다. 부팅·Auth 두 축은 이미 짝이 있고 CRUD 축만 없었다(§8 전수). | 사용자 "A로 대칭 맞추자" | ACTIVE | — |
| D-003 | `harnessSettings.invalidateAll()`은 전체 무효화를 유지한다. | provider 열거 캐시(`settings.ts:40-41`)는 add/delete로 **목록 자체**가 바뀐다. key 하나로 좁히면 새 provider가 목록에 나타나지 않는다. | 설계 (코드 조사) | ACTIVE | — |
| D-004 | 0198 D-008의 "contribution별 1회 fetch"는 **"credentialRevision당 1회 + 명시적 invalidate당 1회"**로 확장한다. | D-002가 replay를 도입하므로 fetch 횟수의 문면이 바뀐다. 사용자는 조사 턴에서 이 대가를 명시적으로 제시받고 A를 골랐다. | 사용자 "A로 대칭 맞추자" | ACTIVE | 0198 D-008 **부분 SUPERSEDED** |
| D-005 | 새 세션 생성·턴 실행은 여전히 cache만 읽는다 — network 0. | 0198 D-008의 유지 조항. D-002의 replay는 invalidate 경로에만 붙고 읽기 경로에는 붙지 않는다. | 0198 D-008 | ACTIVE | — |
| D-006 | cache가 빈 런타임 key는 두 UI에서 계속 **숨긴다** — 같은 canonical key의 settings 행도 함께. | 0198 D-008(D18 선택 A · D25 정정)의 유지 조항. 사용자가 대안 C를 고르지 않았다. | 0198 D-008 | ACTIVE | — |
| D-007 | D-008 적용 뒤에도 남는 **`runtime.resolve` 왕복 1회** 구간에서 플러그인 행을 빈칸으로 둘 것인가 비활성 행으로 보일 것인가. | 조사 턴이 올린 질의 2가 실측으로 좁혀졌다 — 원래 "부팅 전체 구간"으로 적었으나 `RootGate.tsx:42`가 `resuming` 동안 셸 자체를 안 띄우므로 실제 노출 구간은 contribution fetch 왕복뿐이다. D-006을 뒤집어야 하므로 단독 결정 불가. | 조사 턴 질의 2 (2026-08-26 실측으로 범위 축소) | **OPEN** | — |
| D-008 | 부팅 복원 batch가 **자기 probe로 `verified`가 된 authId**를 카탈로그 재조정에 잇는다 — `emitVerifiedChange:false`는 그대로 두고 재조정만 별도로 통지한다(대안 α). | `emitVerifiedChange:false`의 목적은 방송 횟수 절감(0187 D2)이지 재조정 생략이 아니다. 두 관심사가 한 채널에 얹혀 있어 함께 사라졌다. 방송 상한 `P + 1`(`docs/arch/backend/auth.md §5.2`)은 보존된다. | 사용자 "α로 0202에 D-008 추가" | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: **D-008**(대안 α). D-001 ~ D-007은 직전 설계 턴(`de8d15b`)에서 만들었다.
- 변경된 결정: **D-007의 범위를 좁혔다** — "부팅에서 Gate probe가 끝나기 전 구간" → "D-008 뒤에 남는 `runtime.resolve` 왕복 1회 구간". 사용자 결정 변경이 아니라 실측 정정이다(`RootGate.tsx:42`·`auth-resume.ts:248`). OPEN 상태는 유지된다.
- 변경된 결정: 0198 D-008 → D-004로 부분 SUPERSEDED. **fetch 횟수 조항만** 바뀌고 cache-only 읽기(D-005)·미노출(D-006)은 그대로다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0198 D-001~D-007(모델 분류·정규화·read-only 계약)·D-009(부팅 순서)·D-010(컴포지션 가드)·0187 D2(방송 상한).
- **`ACTIVE 결정 ↔ AC` 대조**: D-001↔AC1·AC3·AC4, D-002↔AC5·AC8·AC10, D-003↔AC2, D-004↔AC5·AC9, D-005↔AC7, D-006↔AC6·AC11, **D-008↔AC12·AC14·AC15** — 충돌 0. AC13은 D-008이 건드리는 0187 D2의 회귀 방어라 D-008과 같은 행을 본다. D-007은 OPEN이라 AC를 갖지 않고 §6 비범위에 있다.
- D-001과 D-006은 충돌하지 않는다: D-001이 좁히는 것은 *무엇을 무효화할지*이고 D-006이 정하는 것은 *무효화된 뒤 무엇을 보일지*다.
- **D-008과 D-005는 충돌하지 않는다**: D-005가 막는 것은 *읽기 경로의 network*이고, D-008이 잇는 것은 *부팅 복원 1회*의 재조정이다 — 세션 생성·턴 실행 경로는 그대로 `cached()`만 읽는다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 증상은 "행이 사라진다", 원인은 `engine.ts:39`의 무인자 `invalidate()` + replay 부재다. 0198 verify.md:1322가 같은 문장을 이미 적었다 — "cache가 Auth 밖에서 비면 회복 경로가 없다 ❌". |
| 이미 기존 코드가 충족하는가 | 미충족 | `RuntimeModelCatalog.invalidate(key?)`의 key 필터는 존재하지만(`runtime-catalog.ts:147`) 프로덕션 호출자 2곳이 **둘 다 인자 없이** 부른다(§8 전수). 0198 verify D28이 같은 사실을 적었다. |
| 더 작은 해법이 있는가 | B 단독이 더 작다 | B만으로 편집 축 증상은 사라진다 — 편집 key와 contribution key가 배타이므로 targets가 0이 된다. A는 **재발 방지**다: 다음 호출자가 같은 실수를 못 하게 한다. 사용자가 둘 다 지정했다. |
| 부팅 축이 편집 축과 같은 작업인가 | 같은 불변식 | 둘 다 "카탈로그 상태를 바꿀 수 있는 축은 reconcile과 짝이다"의 위반이다. 0202가 아직 구현 전이라 같은 라운드에서 닫는 편이 §10 표를 한 번만 세게 한다. |
| 부팅 축에 더 작은 해법이 있는가 | α가 가장 작다 | β(remaining도 `emitVerifiedChange:true`)는 한 줄이지만 방송 상한 `P + 1`(`auth.md §5.2`)을 Auth 수만큼 늘린다. γ(attach를 resume 뒤로)는 0198 D-009 순서를 뒤집어 D24를 되살린다. |
| 선행 자료의 주장을 코드와 대조했는가 | 대조 완료 | 0198 verify의 D18·D24·D25·D28을 현재 HEAD(`8b69b10`)에서 재확인했다. D24(부팅 순서)는 `runtime-model-startup.ts:81-85`로 닫혔고, D28(key 필터 미잠금)은 그대로 열려 있다. |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 의도적 변경 1건 | 0198 D-008의 fetch 횟수 조항을 D-004가 대체한다. 0198 D-009(부팅 순서)·D-010(컴포지션 가드)·0187 D2(방송 상한)는 건드리지 않는다 — AC9·AC13이 그것을 잠근다. |

- 사용자에게 올릴 결정: **D-007(OPEN)**. 본 handoff는 D-007 없이 완결되므로 차단 질문이 아니다.
- 코드 조사로 닫은 사실 ①: 좁혀도 편집이 안 먹는 일은 없다 — `runtime-config.ts:167-172`가 `sourceRevision`(경로+mtime)을 cache key의 일부로 쓰므로, settings.json 쓰기가 mtime을 바꾸면 그 key는 자동 miss가 된다.
- 코드 조사로 닫은 사실 ②: 편집 key와 contribution key는 겹칠 수 없다 — `engine.ts:44-49`가 `isReadOnly(canonical)`이면 add/update/delete/read를 전부 던진다.
- 코드 조사로 닫은 사실 ③: `probeTargets`는 `status==='valid' && !verified`로 이미 걸러진 집합이라(`auth-resume.ts:197-203`), resume 뒤 `verified===true`인 것은 **이번 probe가 만든 전이**다 — `resume`의 반환값을 바꾸지 않고 snapshot 재조회만으로 성공분을 특정할 수 있다.
- 코드 조사로 닫은 사실 ④: 실패 강등은 `login.ts:354`가 `emitVerifiedChange`와 무관하게 즉시 `onSnapshot('expired')`를 내므로 이미 bridge에 도달한다 — D-008의 통지는 **성공분만** 담아야 중복이 없다.

## 5. 동작 / 사용자 흐름

```text
[엔진 & 모델에서 provider X 추가/수정/삭제]
  → 편집 key X 만 무효화 (settings 해석 캐시는 전체)
  → 재배포 + 목록 갱신
  → 성공: X 는 새 값으로, 플러그인 LLM 행은 **그대로** 남는다
  ↘ 실패(쓰기 오류): 기존 목록 유지 + 오류 문구

[누군가 플러그인 key 를 명시적으로 invalidate]
  → drop → 같은 자리에서 현재 snapshot 으로 reconcile
  → snapshot 이 valid: 행이 다시 채워진다
  ↘ snapshot 이 invalid / fetch 실패: 행은 사라진 채 남는다 (fail-closed 유지)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 플러그인 행이 있는 상태에서 다른 provider add | 편집 key만 무효화, contribution targets 0 | 새 provider 카드 + 플러그인 카드 둘 다 보인다 |
| 같은 상태에서 다른 provider update | 위와 같음. 편집 key는 mtime 변화로 재해석된다 | 편집 내용이 반영되고 플러그인 카드는 유지 |
| 같은 상태에서 다른 provider delete | 위와 같음 | 삭제된 카드만 사라지고 플러그인 카드는 유지 |
| 플러그인 key를 명시적으로 invalidate, snapshot valid | drop → replay → fetch 1회 → 재등록 | 행이 유지된다(깜빡임은 같은 turn 안에서 수렴) |
| 플러그인 key를 명시적으로 invalidate, snapshot invalid | drop → replay가 미인증으로 조기 종료 | 행이 사라진다 (D-006 유지) |
| replay 중 fetch 실패 | drop 상태 유지, 예외를 호출자에게 던지지 않는다 | 행이 사라지고 CRUD 자체는 성공한다 |
| 앱 재시작 — contribution이 **gate** Auth 소유 | deploy 무효화 → attach → 구독 → resume. gate resume이 `verified` change를 내고 bridge가 재조정한다 | 대기 화면이 걷힌 뒤 fetch 왕복만큼 늦게 행이 나타난다 (D-007 범위) |
| 앱 재시작 — contribution이 **플러그인(remaining)** Auth 소유 | 나머지 batch가 probe 성공분의 authId를 카탈로그 재조정에 잇는다 (D-008) | 위와 같다 — 소유 Auth가 gate냐 아니냐로 결과가 갈리지 않는다 |
| 나머지 batch의 probe 실패 | `login.ts:354`가 즉시 `expired`를 내고 bridge가 그 자리에서 drop한다 | 그 Auth 소유 행은 나타나지 않는다 (D-006 유지) |

### 파생 UX / 엣지케이스

- loading / empty / error: CRUD 중 목록은 이전 값을 유지하고, 완료 후 `refreshAgents()`가 한 번 다시 그린다(`useEngines.ts` mutate).
- cancel / retry / close / restart: replay 실패는 재시도하지 않는다 — 다음 Auth 이벤트나 다음 명시 invalidate가 트리거다.
- concurrency / multi-session: 같은 key의 동시 reconcile은 기존 `inFlight` single-flight가 합류시킨다(`runtime-catalog.ts:100-101`).
- keyboard / a11y / theme: 해당 없음 — 렌더러 변경 0.
- 외부환경/오프라인/폐쇄망: replay의 fetch가 오프라인에서 실패하면 D-006대로 미노출로 수렴한다. 폴링은 도입하지 않는다.

## 6. 범위 / 비범위

- **범위**: `engine.ts`의 무효화 폭 축소, `RuntimeModelCatalog.invalidate`의 replay 결합, **부팅 복원 batch의 성공 verified → 카탈로그 재조정 배선(D-008)**, 부팅 helper의 await 시퀀스 유지, 관련 테스트, 0198 D-008 문면 갱신 표기, `docs/arch/backend/auth.md §5.2` 순서 블록 한 줄 추가.
- **비범위**: `runtime.resolve` 왕복 구간의 UI 표현(D-007 · 대안 C), `AgentEnvironment`에 상태 필드 추가, 폴링·주기 refresh, `harnessSettings` 열거 캐시의 폭 축소(D-003), renderer 변경, `AuthRuntime.resume`의 반환 타입 변경(§4 사실 ③으로 불필요), 방송 상한 `P + 1` 변경.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `runtime.resolve` 왕복 구간의 비활성 행 표시(대안 C) | 아니오 — `AgentEnvironment` 확장은 추가 필드라 후행 가능 | 후속(D-007 응답 후) |
| `RUNTIME_MODEL_CONTRIBUTIONS`가 비어 있어 기본 배포에 실인스턴스가 0인 점 | 아니오 | 테스트가 선언을 주입해 덮는다(§11) |

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | contribution 행이 카탈로그에 있는 상태에서 **다른** key를 add·update·delete하면 그 행이 `agent:list` 결과에 남는다 (3채널 전부) | 실제 `createRuntimeModelCatalog` + 실제 `mergeAgentEnvironments`로 CRUD 전후 `merge()` 결과를 비교 — 3채널 각각 행 존재 | 엔진&모델 저장 → `orca:engine:{add,update,delete}` → `refreshHarnessSettings` → `orca:agent:list` |
| AC2 | 같은 CRUD 뒤에도 turn 후보 해석이 살아 있다 — 그 contribution key의 `harnessRuntime.cached()`가 값을 돌려준다 | 실제 `createHarnessRuntimeConfigService`로 resolve 1회 → CRUD 무효화 호출 → `cached(key)`가 `undefined`가 아님 | `chat:send` → `resolveTurnProvider` → `turn-setup.ts:89` |
| AC3 | 편집한 provider 자신은 새 설정으로 재해석된다 — 폭을 좁혀도 편집이 무시되지 않는다 | settings.json을 다시 쓴 뒤 같은 key `resolve()`가 새 `sourceRevision`과 새 값을 돌려준다 | 위와 같은 CRUD 경로 → 다음 턴의 `resolve` |
| AC4 | 무효화 폭이 편집 key를 넘지 않는다 — 3채널이 `catalog.invalidate`·`harnessRuntime.invalidate`에 canonical 편집 key를 넘기고 `undefined`를 넘기지 않는다 | 3채널 각각에 대해 두 sink의 인자를 단언 (`'claude-corp'`, `undefined` 아님) | 위와 같음 |
| AC5 | `invalidate(key)`는 drop 직후 영향받은 authId를 **현재 snapshot으로** 재조정한다 — snapshot이 valid면 같은 호출 안에서 행이 다시 채워진다 | contribution을 reconcile로 채운 뒤 `invalidate(key)` → `resolve` 호출 2회, `list()` 길이 1. **replay를 지우면 `list()`가 `[]`가 되어 실패한다** | `engine.ts:39` · `runtime-model-startup.ts:83` |
| AC6 | snapshot이 invalid면 replay가 행을 되살리지 않는다 | invalid snapshot으로 세팅 후 `invalidate()` → `list()`가 `[]`, `resolve` 추가 호출 0 | 로그아웃·만료 후의 CRUD |
| AC7 | replay의 fetch 실패가 호출자에게 던져지지 않고 행만 사라진다 | `resolve`가 reject하도록 두고 `invalidate()`가 reject하지 않음 + `list()`가 `[]` | CRUD 중 네트워크 실패 |
| AC8 | 인자 없는 `invalidate()`(부팅 helper 경로)도 replay한다 | 두 contribution을 채운 뒤 `invalidate()` → 둘 다 재조정 시도 | `runtime-model-startup.ts:83` |
| AC9 | 부팅 시퀀스가 `settings 무효화 → runtime 무효화 → catalog 무효화 → attach → resume` 순서로 **전부 await된 채** 유지된다 | 주입한 5개 seam의 호출 순서를 배열로 단언 (기존 `runtime-model-startup.test.ts` 확장) | `bootstrap.ts:622` |
| AC10 | replay가 자기 자신을 다시 무효화하지 않는다 — `invalidate` 1회당 `resolve` 최대 1회/contribution | `invalidate()` 후 `resolve` 호출 수가 contribution 수를 넘지 않음 | 위 두 호출자 |
| AC11 | 두 읽기 소비처가 같은 결과를 본다 — CRUD 뒤 `misc.ts` 목록과 `turn-setup.ts` 후보에 같은 key 집합이 있다 | 같은 카탈로그 인스턴스로 `merge()`(무필터)와 `merge(settings, 'claude')`를 비교 | `orca:agent:list` · `chat:send` |
| AC12 | **나머지 batch의 probe로 `verified`가 된 authId가 부팅 안에서 카탈로그 재조정에 도달한다** — 소유 Auth가 gate가 아니어도 행이 등록된다 | 실제 `createAuthResume`에 `verified`로 전이하는 fake `resume`을 주입하고 재조정 sink가 그 authId로 불리는지 단언. **배선을 지우면 sink 호출이 0이 되어 실패한다** | 앱 시작 → `authResume.run()` → `startRemaining()` → bridge → `catalog.reconcile` |
| AC13 | 복원 절차가 **스스로 내는** 방송 수는 `P + 1`로 불변이다 — D-008이 방송을 늘리지 않는다 | `pushConnectionState` fake의 호출 수를 probe 후보 유/무 두 경우로 단언(1+1 / 0+1). 기존 `auth-resume.test.ts`의 방송 상한 describe를 재사용 | `docs/arch/backend/auth.md §5.2` |
| AC14 | probe **실패**한 authId는 D-008 통지에 담기지 않는다 — 실패는 기존 즉시 `expired` 경로 하나로만 도달한다 | 성공 1·실패 1을 섞은 batch에서 재조정 sink가 성공 authId로만 불림 | `login.ts:354`(실패) · D-008 통지(성공) |
| AC15 | gate 축은 그대로다 — gate resume의 `verified` change가 계속 bridge에 도달하고 D-008 통지가 그것을 중복해서 내지 않는다 | gate만 있는 구성에서 bridge 도달 경로가 `AuthChange` 하나이고 재조정 sink 호출이 authId당 1회 | `auth-resume.ts:231` → `bootstrap.ts:643` |

### AC 검증 주의사항

- 기존 테스트 재사용: `runtime-catalog.test.ts`에 `invalidates only the requested canonical contribution key`(:226)와 `removes invalidated entries and permits the next verified snapshot to refill them`(:207)이 실재한다 — 후자는 D-002 도입으로 **의미가 바뀌므로 갱신 대상**이다(replay가 `reconcile` 없이 이미 채운다).
- 기존 테스트 재사용 ②: `engine.runtime-catalog.test.ts:30`이 `invalidateCatalog`가 `toHaveBeenCalledOnce()`만 단언한다 — 인자를 보지 않으므로 AC4가 그 케이스를 인자 단언으로 강화한다.
- 사람 실기 항목: 없음. 모든 AC가 순수 함수 또는 주입 seam으로 판정된다 — `handlers/engine.ts`는 electron을 직접 import하지 않아 `vi.mock('electron')` 없이 로드된다(`engine.runtime-catalog.test.ts`가 이미 그렇게 한다).
- N회/총량 기준: AC10의 분모는 contribution 수다. `resolve` sink의 프로덕션 호출부는 `runtime-catalog.ts:104` 1곳뿐이다(`rg -n "runtime\.resolve\(" src/main --glob '!*.test.ts'` → 1건) — 관측 지점이 그 호출부 전부를 모형한다.
- 순서 기준: AC9의 관측 지점은 `startRuntimeModelCatalogAfterDeploy`의 5개 주입 인자다. `bootstrap.ts`는 vitest가 열지 못하므로(0198 D-010) 순서 단언은 helper 안에서 하고, "bootstrap이 그 helper를 실제로 쓴다"는 기존 `app/no-stray-auth-subscribe.test.ts`의 양성 스윕이 계속 잠근다 — 이번 턴은 그 가드를 건드리지 않는다.
- 총량/0건 기준: AC4의 "`undefined`를 넘기지 않는다"는 음성 단언이므로 **AC1의 양성 행동 단언과 짝으로만** 유효하다. AC4 단독으로 목표를 표현하지 않는다.
- 기존 테스트 재사용 ③: AC13이 재사용할 `describe('createAuthResume — 자기 push 는 P + 1 (0187 D2 승계 · 0194 종료 push)')`가 `auth-resume.test.ts:346`에 실재하고 케이스 3건(`:347`·`:365`·`:383`)이 P·K 조합을 이미 나눈다 — D-008은 이 3건이 **그대로 통과해야** 한다.
- N회/총량 기준 ②: AC13의 `P + 1`은 **복원 절차가 스스로 내는** push만 센다. `pushConnectionState` sink의 프로덕션 호출부는 `rg -n "pushConnectionState" src/main --glob '!*.test.ts'` 12건 중 **호출 4 + 참조 1**이다 — 호출: `auth-resume.ts:213`(batch)·`:222`(종료)·`bootstrap.ts:634`(`AuthChange` 구독)·`settings-reactions.ts:34`(`authBypass` 설정 변경), 참조: `bootstrap.ts:478`(카탈로그 `onChange`, 실제 발화는 `runtime-catalog.ts:84`·`:119`). 나머지 7건은 타입·주석·정의·주입 인자다.
- N회/총량 기준 ③: AC13의 관측 지점(`createAuthResume`에 주입한 fake)이 모형하는 항은 **`auth-resume.ts:213`·`:222` 둘뿐**이다 — `bootstrap.ts:634`·`:478`·`settings-reactions.ts:34`는 모형하지 않으므로 AC13은 그 항들을 반증하지 않는다. 그 셋은 `AuthChange`당 1회·행 변화당 1회·설정 변경당 1회라는 별도 항이고, `auth.md §5.2`가 "부팅 방송 총량은 상수가 아니다"로 이미 열어 둔 자리다.
- 방향 기준: AC12의 불변식은 "배선이 **있다**"이므로 검사 장치는 **배선을 지웠을 때 실패**해야 한다 — 재조정 sink 호출 수 `0`으로 red가 되는 양성 단언이다. 음성 스윕(`emitVerifiedChange:false` 호출 파일 수 등)으로 대신하지 않는다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| CRUD 무효화가 전체 폭이고 replay가 없다 | `app/src/main/app/handlers/engine.ts:37-39` |
| 부팅 축은 invalidate 뒤 `attach`가 replay한다 | `app/src/main/app/runtime-model-startup.ts:81-85` |
| Auth 축은 invalidate 뒤 `reconcile`이 replay한다 | `app/src/main/app/runtime-model-startup.ts:29-33` |
| `invalidate(key)`의 key 필터는 이미 구현돼 있다 | `app/src/main/features/harnesses/runtime-catalog.ts:146-151` |
| `resolvedRevision`이 drop에서 지워지므로 같은 revision으로도 재fetch가 가능하다 | `app/src/main/features/harnesses/runtime-catalog.ts:81`·`:99` |
| reconcile 트리거는 `auth.subscribe` 하나뿐 — 주기 타이머 없음 | `rg -n "setInterval\|setTimeout" src/main/features/auth/*.ts` → 0건 |
| `credentialRevision`은 credential 변동에서만 오른다 | `app/src/main/features/auth/store.ts:222` · `runtime.ts:139` |
| 편집 key와 contribution key는 배타다 | `app/src/main/app/handlers/engine.ts:44-49` (`assertMutable`) |
| `sourceRevision`이 runtime-config cache key의 일부라 mtime 변화가 자동 miss다 | `app/src/main/features/harnesses/runtime-config.ts:167-172` |
| 열거 캐시는 디렉터리 목록 자체를 캐싱한다 | `app/src/main/features/harnesses/settings.ts:40-41`·`:58-67` |
| `features` → `contracts` import는 boundaries 허용 | `app/eslint.config.mjs:167` |
| 같은 증상이 0198에서 이미 기록됐다 | `docs/handoff/0198-runtime-model-catalog/verify.md:1322` · `:1257`(D24) · `:1258`(D25) |
| **나머지 batch의 probe 성공은 `AuthChange`를 만들지 않는다** | `app/src/main/app/auth-resume.ts:208`(`emitVerifiedChange:false`) → `app/src/main/features/auth/login.ts:355-357`(그 값이 거짓이면 `onSnapshot` 생략) |
| `verified` cause를 내는 production 지점은 하나다 | `app/src/main/features/auth/login.ts:356` (`rg -n "'verified'\)" src/main --glob '!*.test.ts'` → 1건). `runtime.ts:121-127`의 lazy-expiry `publish`는 `expired`만 낸다 |
| bridge 통지는 `credentialChanged`와 무관하게 모든 snapshot change에서 돈다 | `app/src/main/app/bootstrap.ts:643` — `verified`는 `credentialChanged:false`(`runtime.ts:52-54`)인데도 도달한다 |
| gate 축은 `emitVerifiedChange:true`라 도달한다 | `app/src/main/app/auth-resume.ts:231` |
| batch의 두 `pushConnectionState()`는 화면만 다시 그린다 | `app/src/main/app/auth-resume.ts:213`·`:222` — 재조정 호출이 없다 |
| `resuming` 동안 앱 셸 자체가 안 뜬다 — 엔진&모델은 그 구간에 mount되지 않는다 | `app/src/renderer/src/app/RootGate.tsx:42` · `app/src/main/app/auth-resume.ts:248` |
| 방송 상한 `P + 1`의 정본은 arch 문서다 | `docs/arch/backend/auth.md §5.2` |
| `createAuthResume`는 bridge 생성 뒤에 조립된다 — 배선에 시간 순환이 없다 | `app/src/main/app/bootstrap.ts:386`(bridge) < `:402`(authResume) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `catalog.invalidate(` production 호출 | `rg -n "runtimeModelCatalog\??\.invalidate\s*\(\|catalog\.invalidate\s*\(" src --glob '!*.test.ts'` | 2 | `engine.ts:39`(짝 없음) · `runtime-model-startup.ts:83`(attach가 짝) |
| `harnessRuntime.invalidate` production 호출 | `rg -n "harnessRuntime\??\.invalidate\s*\(" src --glob '!*.test.ts'` | 3 | `engine.ts:38`(전체) · `bootstrap.ts:469`(Auth key) · `bootstrap.ts:624`(부팅 전체) |
| 카탈로그 entry 삭제 지점 | `rg -n "entries\.delete" src/main/features/harnesses/runtime-catalog.ts` | 2 | `:82`(drop 안) · `:117`(models 0인 reconcile 결과) |
| `drop(` 호출 | `rg -n "drop\(" src/main/features/harnesses/runtime-catalog.ts` | 3 | `:92`(invalid snapshot) · `:122`(fetch 실패) · `:149`(invalidate) — **replay가 필요한 것은 `:149` 하나** |
| 카탈로그 읽기 소비처 | `rg -n "\.merge\(\|isReadOnly\(" src/main --glob '!*.test.ts'` | 4 | `turn-setup.ts:54`·`:88` · `engine.ts:46` · `misc.ts:43` |
| `refreshHarnessSettings(ctx)` 호출 | `rg -n "refreshHarnessSettings\(ctx\)" src/main/app/handlers/engine.ts` | 3 | add(:57) · update(:69) · delete(:77) |
| `harnessSettings.invalidateAll()` production 호출 | `rg -n "invalidateAll\(\)" src/main --glob '!*.test.ts'` (주석 2건 제외) | 2 | `engine.ts:37` · `bootstrap.ts:623` — 둘 다 유지 |
| `harnessRuntime.cached(` 소비처 | `rg -n "\.cached\(" src/main --glob '!*.test.ts'` | 1 | `turn-setup.ts:89` |
| `runtime.resolve(` production 호출 | `rg -n "runtime\.resolve\(" src/main --glob '!*.test.ts'` | 1 | `runtime-catalog.ts:104` |
| `verified` 전이 지점 | `rg -n "markVerified" src/main --glob '!*.test.ts'` | 2 | `login.ts:345`(전이) · `store.ts:233`(메서드 정의) — **전이는 1지점** |
| `verified` 통지 분기 | `rg -n "'verified'\)" src/main --glob '!*.test.ts'` | 1 | `login.ts:356` — `emitVerifiedChange`가 참일 때만 |
| `auth.resume(` production 호출 | `rg -n "auth\.resume\(" src/main --glob '!*.test.ts'` | 2 | `auth-resume.ts:208`(remaining · false) · `:231`(gate · true) |
| `pushConnectionState` production 호출 + 참조 | `rg -n "pushConnectionState" src/main --glob '!*.test.ts'` 12건 중 발화 지점만 | 4+1 | 호출 `auth-resume.ts:213`·`:222` · `bootstrap.ts:634` · `settings-reactions.ts:34` / 참조 `bootstrap.ts:478`(카탈로그 `onChange`) |
| `bridge.onSnapshot(` production 호출 | `rg -n "onSnapshot\(" src/main --glob '!*.test.ts'` (타입·정의 2건 제외) | 2 | `bootstrap.ts:472`(Auth 무효화 replay) · `:643`(AuthChange 구독) — **둘 다 `AuthChange`를 전제한다** |

### 수치 / 전칭 표현 검산

- 재측정 수치: 위 전수 표는 전부 이번 세션의 `rg` 결과다. HEAD = `8b69b10`.
- 내역 합 = 총계: §10 강제 지점 `5 + 3 + 2 + 1 + 3 + 2 + 6 = 22`. 아래 표의 행별 합과 일치한다. **직전 설계 턴 대비 분모가 16 → 22로 바뀌었다**(D-008 행 신설) — 이전 합계와 직접 비교하지 않는다.
- "유일한/항상/절대" 반례 검색: "reconcile 트리거는 `auth.subscribe` 하나뿐" → `rg -n "reconcile\s*\(" src --glob '!*.test.ts'` 7건 중 타입 선언 3건·bridge 내부 2건·helper 2건이고 **외부 트리거는 `bridge.onSnapshot` 경로 하나**다(`bootstrap.ts:472`·`:643` 둘 다 Auth 이벤트에서 온다).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `runtime-catalog.test.ts:207`·`:226`·`:247`, `engine.runtime-catalog.test.ts:30`, `runtime-model-startup.test.ts`, `auth-resume.test.ts:346`(P+1 describe)·`:347`·`:365`·`:383` 실재 확인. 0198 `verify.md:1257`·`:1258`·`:1322` 실재 확인. `docs/arch/backend/auth.md §5.2` 앵커는 `:391`에 실재한다.
- "유일한/항상/절대" 반례 검색 ②: `kind:'snapshot'`을 내는 `publish` 호출은 **2곳**이다 — `runtime.ts:121`(lazy expiry, `cause:'expired'` 고정)과 `:171`(`emitSnapshot`). 세 번째 `publish`(`:191`)는 `kind:'step'`이라 `bootstrap.ts:643`의 조기 반환에 걸린다. 그래서 "유일한 생산자"는 `AuthChange` 전체가 아니라 **`verified` cause**에 대해서만 참이고, 본문은 그 좁힌 주장만 쓴다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 현재 책임 소유자: 무효화 폭은 **호출자**가, replay는 **호출자**가 각각 따로 정한다 — `RuntimeModelCatalog`는 drop만 한다.
- 현재 entry → flow → state → consumer: `orca:engine:update` → `refreshHarnessSettings` → 세 캐시 전체 무효화 → `catalog.entries` 비움 → `onChange` → `pushConnectionState` → renderer `subscribeAgents` → `agent:list` → `merge()`가 빈 runtime + 필터된 settings를 돌려줌 → **행 소멸**.
- 현재 오류/취소/정리 경로: `drop`이 `resolvedRevision`을 지워 재fetch 가능 상태로 두지만, 그것을 소비할 트리거가 CRUD 축에 없다.
- 문제의 직접 원인 ①: `engine.ts:39` 무인자 invalidate + replay 부재. **두 결함이 각각 독립적으로 증상을 만든다** — 폭이 좁아도 replay가 없으면 명시 invalidate에서 같은 일이 나고, replay가 있어도 폭이 넓으면 매 CRUD마다 불필요한 fetch가 돈다.
- 현재 부팅 flow: `attach`는 probe **전** snapshot으로 replay하므로 `verified:false` → drop이고, 그 뒤 실제 전이는 gate 축에서만 `AuthChange`가 된다.
- 문제의 직접 원인 ②: `emitVerifiedChange`가 **방송 절감**과 **재조정 트리거** 두 관심사를 한 채널로 나른다. 나머지 batch가 방송을 끄면 재조정도 함께 꺼진다.

```text
engine:{add,update,delete}
  → refreshHarnessSettings
  → harnessSettings.invalidateAll()            (열거 + 해석)
  → harnessRuntime.invalidate(undefined)       (전체 config cache)
  → catalog.invalidate()                       (전체 entry drop) ── replay 없음 ✗
  → onChange → pushConnectionState → agent:list → merge() → 행 없음

부팅:
  attach()  … probe 전 snapshot → verified:false → drop
  authResume.run()
    gate    resume(emitVerifiedChange: true)   → AuthChange → bridge → reconcile ✓
    나머지  resume(emitVerifiedChange: false)  → AuthChange 없음 ── bridge 미도달 ✗
            pushConnectionState() ×2           (화면만 다시 그린다)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 변경 후 책임 소유자: 무효화 **폭**은 호출자가 key로 지정하고, **replay**는 `RuntimeModelCatalog`가 소유한다. 호출자가 replay를 잊을 자리가 없어진다.
- 변경 후 entry → flow → state → consumer: `orca:engine:update` → `refreshHarnessSettings(ctx, key)` → 열거 캐시만 전체 무효화, runtime·catalog는 `key` 하나 → contribution targets 0 → entries 불변 → `merge()`가 기존 행을 그대로 돌려줌.
- 변경 후 오류/취소/정리 경로: replay 안의 `reconcile`은 이미 자기 catch로 `drop`한다(`:120-122`) — `invalidate`는 그 Promise를 await하고 예외를 밖으로 내보내지 않는다.
- 유지하는 기존 메커니즘: `inFlight` single-flight, `authGeneration` fence, `resolvedRevision` 조기 반환, `mergeAgentEnvironments`의 미노출 필터, 부팅 순서(0198 D-009).
- 제거/대체하는 메커니즘: `runtime-model-startup.ts:83-84`의 `invalidate() → attach()` 이중 replay 중 attach의 것은 **남긴다** — attach는 bridge에 catalog를 등록하는 별도 책임이고, replay 중복은 `resolvedRevision` 조기 반환이 흡수한다.
- 변경 후 부팅 책임 소유자: 방송 절감(`emitVerifiedChange`)과 재조정 트리거를 **두 채널로 가른다** — `createAuthResume`이 자기 probe로 `verified`가 된 authId를 별도 sink(`reconcileVerified`)로 통지하고, 컴포지션 루트가 그것을 bridge에 잇는다(D-008).
- 성공분 판정: `resume`의 반환 타입을 바꾸지 않고 **resume 뒤 snapshot 재조회**로 고른다 — `probeTargets`가 이미 `!verified`로 걸러진 집합이라 사후 `verified===true`는 이번 probe의 전이다(§4 사실 ③).

```text
engine:{add,update,delete}(key)
  → refreshHarnessSettings(ctx, canonicalKey)
  → harnessSettings.invalidateAll()            (열거 — 목록이 바뀐다, D-003)
  → harnessRuntime.invalidate(canonicalKey)    (그 key 의 config cache 만)
  → await catalog.invalidate(canonicalKey)     (drop + replay 한 몸, D-002)
       └ contribution targets 0 → 아무 일도 하지 않는다 (D-001)
  → agent:list → merge() → 플러그인 행 유지 ✓

부팅:
  authResume.run()
    gate    resume(emitVerifiedChange: true)   → AuthChange → bridge ✓   (불변)
    나머지  resume(emitVerifiedChange: false)  → 방송 절감 유지 (P + 1)
            성공분 authId → reconcileVerified() → bridge → reconcile ✓  (D-008)
            실패분        → login.ts:354 즉시 expired → bridge → drop ✓ (불변)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | replay를 호출자가 소유 (2호출자 중 1곳 누락) | replay를 `RuntimeModelCatalog`가 소유 | 짝 없는 drop을 구조적으로 불가능하게 | `runtime-catalog.ts` · AC5·AC8 |
| data/control flow | CRUD가 전체 contribution을 drop | CRUD가 편집 key만 대상으로 하고 contribution은 0건 | 플러그인 행이 CRUD 축에 닿지 않게 | `handlers/engine.ts` · AC1·AC4 |
| state/contract | `invalidate(key?): void` | `invalidate(key?): Promise<void>` + `snapshotOf` 생성 의존 | replay를 await 가능하게 해 부팅 순서 결정성 유지 | `runtime-catalog.ts` 인터페이스 · AC9 |
| error/lifecycle | drop 후 무한 미노출 | drop 후 즉시 1회 재조정, 실패는 미노출로 수렴 | D-006 유지하면서 회복 경로 신설 | AC6·AC7 |
| test seam/관측점 | `invalidateCatalog` 호출 횟수만 단언 | 인자 단언 + 실제 카탈로그로 행 존속 단언 | 구조 proxy를 행동 단언으로 승격 | `engine.runtime-catalog.test.ts` · AC1·AC4 |
| 부팅 재조정 트리거 | `AuthChange` 하나 — 나머지 batch는 그것을 내지 않는다 | `AuthChange` + 복원 batch의 `reconcileVerified` 통지 | 방송 절감과 재조정 트리거를 두 채널로 가른다 | `app/auth-resume.ts` · `bootstrap.ts` · AC12·AC14·AC15 |
| 부팅 방송 수 | 복원 절차 자기 push `P + 1` | 불변 `P + 1` — 재조정은 방송을 만들지 않는다 | 0187 D2 상한 보존 | `auth-resume.test.ts:346` describe · AC13 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `features/harnesses/runtime-catalog.ts` | contribution 행의 수명 — drop과 replay를 한 동작으로 소유 | `contributions`·`runtime`·`snapshotOf`·`onChange` → `RuntimeModelCatalog` | `app/bootstrap.ts` |
| `app/handlers/engine.ts` | 편집 key의 canonical 형태를 만들고 그 폭으로만 무효화 요청 | IPC req → 세 캐시 무효화 | IPC 라우터 |
| `app/runtime-model-startup.ts` | 부팅 시퀀스의 순서 소유 | 5개 주입 seam → `Promise<void>` | `app/bootstrap.ts` |
| `app/auth-resume.ts` | 복원 순서 + **자기 probe가 만든 `verified` 전이의 통지** | `ResumeAuthDeps` + `reconcileVerified` → `AuthResumeHandle` | `app/bootstrap.ts` |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| 무효화 폭 = 편집 canonical key | `handlers/engine.ts` | 핸들러 | add(:57)·update(:69)·delete(:77) 3채널의 key 전달 + `refreshHarnessSettings` 안의 `harnessRuntime.invalidate`·`catalog.invalidate` 2호출 = **5지점** | 한 채널이라도 `undefined`를 넘기면 그 채널에서 증상이 그대로 재현된다 |
| drop과 replay는 한 동작 | `features/harnesses/runtime-catalog.ts` `invalidate` | 카탈로그 자신 | `invalidate` 본체 1 + production 호출자 2(`engine.ts:39`·`runtime-model-startup.ts:83`) = **3지점** | 호출자에 replay를 남기면 다음 호출자가 다시 빠뜨린다 |
| 열거 캐시는 전체 무효화 유지 | `features/harnesses/settings.ts` `invalidateAll` | 호출자 | `engine.ts:37` · `bootstrap.ts:623` = **2지점** | 좁히면 add/delete가 목록에 반영되지 않는다 |
| read-only key의 실행은 cache만 읽는다 | `chat-turn/turn-setup.ts` | turn setup | `turn-setup.ts:89` = **1지점** | 여기서 `resolve`로 바꾸면 턴마다 network가 돈다(D-005 위반) |
| 무효화된 canonical key는 두 UI에서 미노출 | `features/harnesses/models.ts` `mergeAgentEnvironments` | 병합 함수 | `models.ts:105` 필터 1 + 읽기 소비처 2(`misc.ts:43`·`turn-setup.ts:54`) = **3지점** | 필터를 빼면 편집 버튼이 달린 유령 행이 돌아온다(0198 D25) |
| 부팅 순서 `settings→runtime→catalog→attach→resume` | `app/runtime-model-startup.ts:81-85` | helper | helper 본체 1 + `bootstrap.ts:622` 호출 1 = **2지점** | 순서가 흐트러지면 0198 D24(부팅 fetch 결과 소멸)가 재발한다 |
| `verified` 전이는 카탈로그 재조정에 도달한다 | `app/auth-resume.ts` (통지) + `app/bootstrap.ts` (배선) | 복원 batch + 컴포지션 루트 | 불변식 주어(`verified` 전이·그 통지 분기)로 전수 검색한 6지점 — `login.ts:345`(전이) · `:355-357`(통지 분기) · `auth-resume.ts:208`(remaining 호출 · false) · `:231`(gate 호출 · true) · 복원 batch의 통지 신설 지점 · `bootstrap.ts`의 `createAuthResume` 인자 배선 = **6지점** | 한 지점이라도 빠지면 그 축의 contribution이 부팅에서 영영 안 붙는다. 검색: `rg -n "markVerified\|emitVerifiedChange" src/main --glob '!*.test.ts'` → 9건 = 주석 2(`contracts:433`·`login:301`) + 시그니처 2(`contracts:437`·`login:307`) + store 메서드 정의 1(`store.ts:233`) + **코드 4**, 그 4에 신설 2를 더해 6 |

- 합계: 5 + 3 + 2 + 1 + 3 + 2 + 6 = **22지점**. **분모가 16 → 22로 바뀌었다**(D-008 행 신설) — 이전 설계 턴의 합계와 직접 비교하지 않는다.
- 같은/동일 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: canonical key 규칙의 SSOT는 `infra/config/provider-key.ts`의 `canonicalProviderKey`와 `features/harnesses/models.ts`의 `canonicalAgentKey` 둘이다 — 전자는 adapter 목록을 알고 후자는 모른다. `engine.ts`는 전자로 만들고 카탈로그는 후자로 비교하며, 두 함수는 `${adapter}-${provider}` 입력에 대해 같은 결과를 낸다(둘 다 trim + lowercase). 이번 턴은 그 관계를 바꾸지 않는다.
- `실패 의미`에 "다른 게이트가 막는다"를 적었다면 그 범위를 이 턴에 측정한 근거: 해당 없음 — 어느 행에도 적지 않았다.
- 선택적 필드의 `true/false/undefined` 의미: `invalidate(key?)`의 `undefined`는 "전체"다. 이 의미는 유지하되 프로덕션에서 그 값을 넘기는 곳은 부팅 helper 하나로 줄어든다. `emitVerifiedChange`의 `undefined`는 `true`(`login.ts:355`) — D-008은 이 기본값을 바꾸지 않는다.
- `reconcileVerified`를 **optional로 두지 않는다**: 미주입이 "부팅에서 행이 안 붙는다"로 조용히 나타나므로, 주입을 빠뜨리면 typecheck가 red가 되게 필수 필드로 선언한다.
- 외부 SDK 경계의 실제 요구 타입/의미: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/features/harnesses/runtime-catalog.ts` | drop + replay 결합 | `RuntimeModelCatalog.invalidate`를 `Promise<void>`로 바꾸고, drop 뒤 영향받은 authId를 `snapshotOf(authId)`로 `reconcile`한다. `createRuntimeModelCatalog` 입력에 `snapshotOf: (authId: AuthId) => AuthSnapshot` 추가 | 순수 단위 — 이미 electron 비의존 |
| `app/src/main/app/handlers/engine.ts` | 무효화 폭 축소 | `refreshHarnessSettings(ctx, key)`로 canonical key를 받아 `harnessRuntime.invalidate(key, 'harness-settings-crud')` · `await ctx.runtimeModelCatalog?.invalidate(key)`. 3채널이 `assertMutable`이 만든 canonical 값을 재사용한다 | `vi.mock('../../infra/ipc/handle')` 기존 패턴 |
| `app/src/main/app/runtime-model-startup.ts` | 부팅 순서 유지 | `input.catalog.invalidate()`를 `await` | 주입 seam 순서 배열 |
| `app/src/main/app/auth-resume.ts` | **D-008 통지** | `ResumeAuthDeps`에 `reconcileVerified(authId: AuthId): void` 필수 필드 추가. `resumeRemainingOnce`가 `await Promise.all(...)` 뒤 `probeTargets` 중 `tryBind(id)?.snapshot()`이 `verified && status==='valid'`인 것만 골라 통지한다 — `pushConnectionState` 호출 수는 건드리지 않는다 | 순수 — electron 비의존(모듈 헤더가 그 이유를 이미 적었다) |
| `app/src/main/app/bootstrap.ts` | 조립 | `createRuntimeModelCatalog`에 `snapshotOf: (authId) => auth.bind(authId).snapshot()` 전달(bridge가 쓰는 것과 같은 표현식) + `createAuthResume`에 `reconcileVerified: (authId) => void runtimeModelCatalogBridge.onSnapshot(authId, auth.bind(authId).snapshot())` 전달. bridge(`:386`)가 authResume(`:402`)보다 먼저 만들어져 시간 순환이 없다 | vitest 대상 아님(0198 D-010) |
| `app/src/main/features/harnesses/runtime-catalog.test.ts` | AC5~AC8·AC10 | `:207` 케이스의 의미 갱신(replay가 이미 채운다), replay 소멸 변이 케이스 추가 | 순수 |
| `app/src/main/app/handlers/engine.runtime-catalog.test.ts` | AC1·AC2·AC4·AC11 | 3채널 인자 단언 + 실제 카탈로그로 행 존속 단언 | 순수 |
| `app/src/main/app/runtime-model-startup.test.ts` | AC9 | await 순서 배열 단언 확장 | 순수 |
| `app/src/main/app/auth-resume.test.ts` | AC12~AC15 | `reconcileVerified` sink 단언 3종(성공만 통지·gate 중복 없음·배선 소멸 시 0회) 추가. **기존 `P + 1` describe(`:346`) 3케이스는 수정 없이 통과해야 한다** | 순수 |
| `docs/arch/backend/auth.md` | §5.2 순서 블록 | "성공한 verified 변화를 …" 줄 뒤에 카탈로그 재조정으로 잇는다는 한 줄 추가. **방송 상한 `P + 1` 문장은 고치지 않는다** | — |
| `docs/handoff/0198-runtime-model-catalog/plan.md` | D-008 문면 | D-004로 부분 SUPERSEDED임을 D-008 행에 표기 | — |
| `docs/handoff/INDEX.md` | 보드 | 0202 행 추가 | — |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: 이미 분리돼 있다 — `runtime-catalog.ts`·`runtime-model-startup.ts`는 electron 비의존이고, `handlers/engine.ts`는 `handle`/`deployer`/`settings-write`/`log`를 mock하면 열린다(`engine.runtime-catalog.test.ts`가 실증).
- 기존 메커니즘 재사용 시 형상/시점 적합성: `snapshotOf`는 `createRuntimeModelCatalogBridge`가 이미 받는 것과 **같은 시그니처·같은 표현식**이다(`bootstrap.ts:387-388`) — 새 계약이 아니라 같은 능력의 두 번째 주입이다.
- 순서를 관측할 훅/로그/주입 경계: `startRuntimeModelCatalogAfterDeploy`의 5개 인자가 그대로 관측점이고, D-008은 `createAuthResume`의 `reconcileVerified` 인자가 관측점이다.
- D-008이 `AuthRuntime.resume`의 시그니처를 바꾸지 않는 이유: 반환 타입을 바꾸면 `contracts/auth.ts:437`이 외부 계약이라 표면이 넓어진다. §4 사실 ③의 snapshot 재조회로 같은 정보를 얻는다.

## 12. End-to-end 영향

### producer → consumer

```text
Auth snapshot / 명시 invalidate
  → RuntimeModelCatalog.reconcile → entries
  → merge(settings, adapter?)
  → orca:agent:list (misc.ts:43) / turn 후보 (turn-setup.ts:54)
```

- producer 기준: 행의 존재 = `entries`에 canonical key가 있다. `invalidate`는 이제 그 판정을 바꾼 뒤 반드시 한 번 다시 계산하고, 부팅 복원은 자기가 만든 `verified` 전이를 반드시 재조정에 잇는다(D-008).
- consumer 파생 규칙: `merge`가 runtime-managed key의 settings 행을 필터한다(D-006). 두 소비처가 같은 함수를 지나므로 갈리지 않는다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: `isReadOnly`는 **선언**(`contributions`) 기준이고 `list()`는 **entry** 기준이다 — 0198 D25가 이 비대칭을 지적했고 `merge`의 필터가 그것을 흡수한다. 이번 변경은 그 관계를 건드리지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `runtime-model-startup.ts:83` | `invalidate()`가 Promise를 돌려주므로 `await` 필요 — 안 하면 attach와 경합(0198 D24 축) | AC9 |
| `engine.ts:39` | 같은 이유로 `await` 필요. `finally` 블록이 async라 가능 | AC1·AC4 |
| `bootstrap.ts:475` | `createRuntimeModelCatalog` 인자에 `snapshotOf` 추가 — 누락 시 typecheck red | AC5 |
| `runtime-catalog.test.ts` 15개 케이스 | `createRuntimeModelCatalog` 호출부 전부가 새 필수 인자를 받아야 한다 | 게이트 typecheck |
| `turn-setup.ts:54`·`misc.ts:43` | 읽기 계약 불변 — `merge` 시그니처 변화 없음 | AC11 |
| `bootstrap.ts:402` `createAuthResume` | `reconcileVerified` 필수 필드 추가 — 누락 시 typecheck red | AC12 |
| `auth-resume.test.ts` 기존 케이스 전부 | `ResumeAuthDeps`에 필수 필드가 늘어 모든 fake deps가 갱신돼야 한다 | 게이트 typecheck |
| `auth-resume.ts:213`·`:222` `pushConnectionState` | 호출 수 불변 — D-008은 방송을 만들지 않는다 | AC13 |
| `login.ts:354` 실패 즉시 통지 | 불변 — D-008 통지가 실패분을 담지 않아 중복이 없다 | AC14 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `createRuntimeModelCatalog`가 `snapshotOf`를, `createAuthResume`이 `reconcileVerified`를 추가로 닫는다. 부팅 순서(0198 D-009)는 불변.
- 재진입: `startRemaining()`은 `remainingResume ??=`으로 batch를 1회로 묶는다(`auth-resume.ts:226`) — gate가 나중에 열려 `onGateChange`가 다시 들어와도 D-008 통지는 한 번뿐이다.
- 늦은 개입: probe 왕복 중 사용자가 직접 로그인하면 그 경로가 `credential-committed`를 이미 냈고 D-008 통지가 중복으로 붙어도 `resolvedRevision` 조기 반환(`runtime-catalog.ts:99`)이 흡수한다.
- 취소/중단: `invalidate`의 replay는 `authGeneration` fence 뒤에서 돈다 — 연속 invalidate 시 앞선 fetch 결과는 `:105`의 세대 검사로 폐기된다.
- 종료/quit/crash/renderer-gone: 해당 없음 — 프로세스 메모리 상태만 다룬다.
- retry/timeout/partial failure: replay 실패는 재시도하지 않고 drop 상태로 남는다(AC7). 다음 Auth 이벤트나 다음 invalidate가 트리거다. D-008 통지 뒤의 `runtime.resolve` 실패도 같다 — `reconcile`의 catch가 `drop`하고 예외는 `void`로 삼켜져 복원 batch를 멈추지 않는다.
- cleanup/rollback: 해당 없음.
- **다중 저장소 쓰기**: 코드 축은 해당 없음 — 무효화·재조정은 메모리 캐시만 만진다. **문서 축은 해당한다**: 이 작업의 판정·상태가 `plan.md`·`docs/handoff/INDEX.md`·`0198/plan.md`(D-008 대체 표기) **3곳**에 살고, D-008 도입으로 `docs/arch/backend/auth.md §5.2`(부팅 복원 순서) 사본이 하나 더 붙는다. plan·INDEX·0198 세 사본은 같은 설계 커밋에 묶고, arch 문서는 **구현 커밋**과 함께 간다 — arch는 현재 상태 서술이라 코드보다 먼저 바꾸면 거짓이 된다(`docs/AGENTS.md` 4).

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: 해당 없음 — UI 행 수는 contribution 수로 불변.
- 새 요청 수의 `원천 상한 × 배치 상한`: replay 1회당 최대 `|영향받은 contribution|`회 fetch. 기본 배포는 `RUNTIME_MODEL_CONTRIBUTIONS = []`라 0회. 폐쇄망 배포에서 명시 invalidate 1회당 그 key 1회다 — D-001로 CRUD 축의 호출은 0이 되므로 **실사용 요청 수는 현재보다 늘지 않는다**.
- D-008의 부팅 fetch 상한: `|probe 성공한 remaining authId|` × `|그 authId 소유 contribution|`, 그리고 **`resolvedRevision` 조기 반환이 authId당 1회로 묶는다**. 현재는 그 값이 0회(이벤트 미도달)이므로 **늘어나는 것이 곧 결함의 수정**이다 — gate 축이 이미 내던 것과 같은 횟수다.
- D-008의 부팅 방송 상한: **증가 0**. 통지 sink는 `pushConnectionState`를 부르지 않고, 카탈로그가 실제로 행을 바꿨을 때의 `onChange` 1회는 gate 축에 이미 존재하던 항이다(AC13 · §7 총량 기준 ②③).
- 구조적 목표(줄/파일/모듈 수): 없음.
- 캐시/snapshot/호출 축소로 잃는 부수 효과와 회귀 테스트: `harnessRuntime.invalidate`를 전체 → key로 좁히면 "다른 provider 편집이 이 provider의 config를 다시 계산하게 만들던" 부수 효과가 사라진다. 그 부수 효과에 의존하던 소비처는 없다 — `sourceRevision`이 mtime을 보므로 각 key가 자기 변경을 스스로 감지한다(AC3이 회귀 테스트).

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port/schema/config: `RUNTIME_MODEL_CONTRIBUTIONS`(`app/deployment/harness-runtime.ts:118`) — **형상 불변**이다. 배포가 채우는 선언은 그대로다.
- 구현 문서: `docs/guides/closed-network-extensions.md` — 무효화 폭·replay는 배포가 작성하는 표면이 아니므로 갱신 대상이 아니다.
- **shape 검증**: `RuntimeModelContribution` 타입 불변 → 기존 예제가 그대로 typecheck된다.
- **semantics 검증**: 배포가 관측하는 의미 변화는 둘이다 — "설정 CRUD가 내 contribution을 지운다" → "지우지 않는다"(D-001), 그리고 **"contribution의 `authId`를 gate로 두어야 부팅에서 붙는다" → "gate가 아니어도 붙는다"**(D-008). 어느 쪽도 배포 코드 변경을 요구하지 않는다 — 오히려 `harness-runtime.ts:118` 주석이 이미 "실제 Auth 상수의 id"라 적어 gate 제한을 두지 않았고, D-008이 그 문면을 코드로 맞추는 것이다.
- `docs/guides/closed-network-extensions.md` 갱신 대상 여부: 아니다 — 위 두 의미 변화 모두 배포가 *작성하는* 표면이 아니라 *관측하는* 결과다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0198 D-008 "Auth 밖 설정 변경이 cache를 무효화하면 자동 항목 전체를 숨긴다" | `0198/plan.md` Decision Ledger | §3 D-001·D-004 | **변경** — CRUD가 그 cache를 무효화하지 않게 되어 조항의 트리거가 사라진다 |
| 0198 D-008 "설정 CRUD는 자동 재fetch하지 않는다" | 같음 | §3 D-004 | **변경** — 명시 invalidate당 1회 replay |
| 0198 D-008 "새 세션·턴은 cache만 읽는다" | 같음 | §3 D-005 · §10 4행 | 유지 |
| 0198 D-009 부팅 순서 | 같음 | §10 6행 · AC9 | 유지 |
| 0198 D-010 컴포지션 유일성·실재 가드 | 같음 | §7 AC 주의사항 | 유지 — 가드 파일을 건드리지 않는다 |
| 0198 D25 정정 (같은 key의 settings 행도 숨긴다) | `0198/verify.md:1258` | §10 5행 · §12 | 유지 |
| `main/AGENTS.md` 하향 의존 DAG | `app/src/main/AGENTS.md` | §11 — `features`가 `contracts/auth` 타입만 추가 참조 | 유지 (`eslint.config.mjs:167` 허용) |
| 커밋 프로토콜 trailer | root `AGENTS.md` | §19 | 유지 |
| 0187 D2 / 0194 방송 상한 `P + 1` | `docs/arch/backend/auth.md §5.2`(`:391`) · `auth-resume.test.ts:346` | §3 D-008 · AC13 | **유지** — D-008은 방송을 늘리지 않고 재조정 채널만 신설한다 |
| `emitVerifiedChange:false`의 의미 ("성공 알림만 지연") | `contracts/auth.ts:433` 주석 | §9 TO-BE | 유지 — 이 값의 의미를 바꾸지 않고 **재조정을 그 채널에서 떼어낸다** |
| `docs/arch/backend/auth.md §5.2` 부팅 복원 순서 블록 | 같음 | §11 — 순서 블록에 재조정 한 줄 추가 | **변경**(구현 커밋과 함께) — 상한 문장은 불변 |
| 0198 D-008 "Gate 로그인 인증 성공 시 fetch" | `0198/plan.md` D-008 | §3 D-008 | **변경** — 트리거를 Gate에 한정하지 않는다. 0198이 gate 소유를 전제한 것이 이번 결함의 근원이다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| `invalidate`가 async가 되며 부팅 경합이 재발할 수 있다(0198 D24 축) | 두 호출자 모두 `await`한다. AC9가 순서를 배열로 잠근다 |
| 폭을 좁혀 편집이 반영되지 않을 수 있다 | `sourceRevision`이 mtime을 보므로 편집 key는 스스로 miss된다. AC3이 회귀 테스트 |
| replay가 CRUD 응답을 느리게 만든다 | CRUD 축의 targets는 0이라 fetch가 돌지 않는다. 명시 invalidate에서만 1회 |
| 기본 배포의 contribution이 0이라 실인스턴스로 검증할 수 없다 | 테스트가 선언을 주입한다. 0198 verify.md:1185가 "0건은 전수가 아니라 미배포"라고 적었으므로 통과 근거로 쓰지 않는다 |
| 0198 D-008 문면이 세 문서에 산다 | §13 다중 저장소 쓰기 — 한 커밋으로 묶는다 |
| `ResumeAuthDeps`에 필수 필드가 늘어 기존 테스트 fake가 전부 깨진다 | 의도한 것이다 — optional로 두면 미주입이 조용한 결함이 된다(§10). typecheck가 전수를 잡는다 |
| D-008 통지가 gate 축과 중복될 수 있다 | gate는 `remainingDefinitions`에 없어 `probeTargets`에 들어오지 못한다(`auth-resume.ts:197`·`gate-auth.ts:16-22`). AC15가 이를 잠근다 |
| snapshot 재조회가 사용자 개입과 경합할 수 있다 | 중복 통지가 되더라도 `resolvedRevision` 조기 반환이 흡수한다(§13 늦은 개입) |

- 되돌리기 어려운 결정: `RuntimeModelCatalog.invalidate`의 반환 타입 변경과 `ResumeAuthDeps`의 필수 필드 추가. 둘 다 내부 포트라 외부 계약이 아니다 — 전자는 소비처 2곳, 후자는 1곳(`bootstrap.ts:402`)이다. `AuthRuntime.resume`(외부 계약)은 건드리지 않는다.
- 신규 의존성: 없음 → 사용자 승인 불요.

## 18. 영향 받는 파일 / 문서

- `app/src/main/features/harnesses/runtime-catalog.ts`
- `app/src/main/features/harnesses/runtime-catalog.test.ts`
- `app/src/main/app/handlers/engine.ts`
- `app/src/main/app/handlers/engine.runtime-catalog.test.ts`
- `app/src/main/app/runtime-model-startup.ts`
- `app/src/main/app/runtime-model-startup.test.ts`
- `app/src/main/app/auth-resume.ts`
- `app/src/main/app/auth-resume.test.ts`
- `app/src/main/app/bootstrap.ts`
- `docs/arch/backend/auth.md` (§5.2 순서 블록 — 구현 커밋과 함께)
- `docs/handoff/0198-runtime-model-catalog/plan.md` (D-008 행 표기)
- `docs/handoff/0202-runtime-catalog-invalidation-scope/plan.md`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`(:112-138) · `app/src/main/AGENTS.md`
- ABI/네트워크 등 환경 제약: better-sqlite3 bindings 부재로 DB 로드 스위트는 red 베이스라인이다 — 변경 무관으로 분리 보고한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`
- 관련 테스트: `./node_modules/.bin/vitest run src/main/features/harnesses/runtime-catalog.test.ts src/main/app/handlers/engine.runtime-catalog.test.ts src/main/app/runtime-model-startup.test.ts src/main/app/handlers/misc.runtime-catalog.test.ts src/main/features/harnesses/runtime-config.test.ts src/main/app/auth-resume.test.ts`
- 사람 실기: 없음.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001~D-006·D-008 ACTIVE, D-007 OPEN, 0198 D-008 부분 SUPERSEDED.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다 — §5 상태 전이표 9행(부팅 축 3행 포함).
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — "B로 폭 줄이고 A로 대칭 맞추자"를 D-001·D-002로, "α로 0202에 D-008 추가"를 D-008로 1:1 매핑.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 9행이 AC1·AC4~AC7·AC12·AC14·AC15로 간다. 표시 축(무엇을 보일지)만 D-007(비범위)로 남는다.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축으로 작성돼 있다 — §9 Delta 7행, 두 절 모두 편집 축·부팅 축 flow 블록을 갖는다.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일 또는 AC에 추적 가능하다 — Delta 7행 전부 `구현/검증 연결` 칸이 채워져 있다.
- [x] AS-IS에서 사라진 책임은 삭제/이동인지 명시했다 — replay 소유권이 호출자 → 카탈로그로 **이동**(§9 Delta 1행).
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 14행 + 검산 5항. `pushConnectionState` sink 수와 "유일한 생산자" 주장은 이번 턴 재측정으로 정정했다(4+1 · `verified` cause 한정).
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — AC1~AC15 3칸 전부.
- [x] 사람 실기로 미룬 순수 로직이 없다 — §7 주의사항 "사람 실기 항목: 없음".
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC4(인자 단언)는 AC1(행 존속)과 짝으로만 유효하다고 §7에 명시. AC12는 sink 호출 수라는 행동 단언이다.
- [x] "X가 쓰인다"의 검사 장치가 X를 지웠을 때 실패한다 — AC5는 "replay를 지우면 `list()`가 `[]`", AC12는 "배선을 지우면 sink 호출이 0"을 단언 대상으로 적었다(§7 방향 기준).
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다 — §10 7행/22지점, §11 테스트 seam 칸.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 소비처 표 9행 + §8 전수 14행.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12.
- [x] 상한·총량·one-way door를 필요한 곳에서 계산했다 — §14 요청 수·부팅 fetch 상한·방송 증가 0, §17 되돌리기 2건.
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다 — §19가 `app/AGENTS.md:124`·`:127`을 그대로 따른다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 전체 교차검증했고 결과를 §3 갱신 메모에 적었다 — D-008↔AC12·AC14·AC15 추가, D-008↔D-005 비충돌 판정 포함.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: **✅ D-001~D-006·D-008을 구현했다.** 편집 key 축소, drop+replay 결합, remaining verified 별도 통지가 production 경로에 들어갔다.
- 이견 / 현실성 문제: **⚠️ 기존 `inFlight`는 generation을 몰라 stale 작업에 합류했다.** `runtime-catalog.test.ts`의 deferred 변이에서 resolve가 2회가 아닌 1회라 replay 소멸을 재현했다.
- ACTIVE Decision과 충돌하는 설계 발견: **없음.** generation-aware slot은 D-002를 동시 호출에서도 성립시키는 구현 세부이며 AC10의 최신 replay 상한을 유지한다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| 무효화 폭 = canonical key | 5 | **5/5** | `rg "invalidate" engine.ts` = handler 전달 3 + sink 2, 변이 시 engine 테스트 **3 실패** | 없음 |
| drop+replay | 3 | **3/3** | catalog 본체 + 호출자 2; stale join 변이 시 catalog 테스트 **1 실패** | 없음 |
| 열거 cache 전체 무효화 | 2 | **2/2** | `rg "invalidateAll"` = engine·bootstrap 유지 | 없음 |
| read-only 실행 cache-only | 1 | **1/1** | `turn-setup.ts`의 `cached(selected.key)` 유지 | 없음 |
| 미노출 병합 | 3 | **3/3** | `models.ts` 필터 + misc·turn 소비처 테스트 green | 없음 |
| 부팅 순서 | 2 | **2/2** | helper await + bootstrap 호출; await 제거 변이 시 startup 테스트 **1 실패** | 없음 |
| verified→재조정 | 6 | **6/6** | 기존 전이 4 + auth-resume 통지 + bootstrap 배선; 통지 제거 변이 시 **1 실패** | 없음 |

- §10에 없는데 같은 불변식이 필요했던 지점: **1곳 선조치.** `runtime-catalog.ts`의 `inFlight` slot에 generation을 싣고 동일 generation만 합류시켰다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| 이전 generation pending에 합류 | 구현 전 비판 검토 | `runtime-catalog.test.ts` 1 | **red** — resolve 2회 기대에 1회 |
| engine runtime invalidate를 전체로 복귀 | AC4·§10 | `engine.runtime-catalog.test.ts` 3 | **red** — 3 CRUD 모두 `undefined` 검출 |
| remaining verified 통지 제거 | AC12·§10 | `auth-resume.test.ts` 1 | **red** — sink 1회 기대에 0회 |
| catalog invalidate await 제거 | AC9·§10 | `runtime-model-startup.test.ts` 1 | **red** — attach·resume 조기 실행 검출 |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **해당 없음** — UI 문자열·DTO 변경 0 | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | **일치** — invalid snapshot·fetch 실패는 미노출 행 | D-006 유지 |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | **기존 정책 유지** — 실패 시 행 미노출 | D-007 후속 결정 유지 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | **✅ generation fence 유지** | stale pending 변이 테스트로 잠금 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 이전 generation `inFlight`에 새 replay가 합류하면 둘 다 stale로 폐기됨 | generation-aware slot으로 최신 resolve를 별도 시작 | deferred 변이에서 1회 호출·빈 catalog 재현 |
| 2 | `assertMutable`이 canonical key를 반환하지 않아 sink 재사용 불가 | 반환형을 `string`으로 바꾸고 3채널이 같은 값 재사용 | 공백·대소문자 fixture 3건 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: **`inFlight`에 generation을 추가했다.** 단순 Promise 합류는 invalidate가 요구한 최신 replay를 삼키므로 D-002를 만족시키기 위한 선조치다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 차이 없음 — snapshot valid 판정과 runtime `usable` 유지 | AC6·AC7 대상 테스트 green |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | authId generation은 같은 owner contribution이 공유 | AC8 전체 invalidate 2 owner replay green |
| 재진입 | 이전·최신 fetch가 공존하나 이전 결과는 fence가 폐기 | stale pending 변이 테스트 red 확인 |
| 다른 무효화 축 | Auth invalidator와 deploy 전체 invalidate 계약 유지 | §10 3·6행 전수 검색 잔여 0 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main 코드 5 · 테스트 6 · 현재 arch 1 · handoff 2 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npm test` · 관련 vitest · `node scripts/check-doc-inventory.mjs --check` |
| 관측한 게이트 산출 | lint 0 error/기존 warning 1 · typecheck 3/3 · vitest **227파일/2305건** + scripts **59건** · doc inventory green |
| 강제 지점 전수 | **22/22** — 7행 합 `5+3+2+1+3+2+6`, 검색 차집합 0 |
| AC 자기보고 | **15/15** — AC1~15 대상 케이스 및 production sink 검색으로 재현 |
| 합계 검산 | `✅ 15 · ⚠️ 0 · ❌ 0 = 총 15` |
| 블로커 / 역질문 | 없음. D-007 OPEN은 기존 비범위 유지 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **예.** 0198의 cache invalidation→reconcile 짝 축이며 0202가 직접 승계했다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: **AC5·AC10은 있었지만 pending fetch fixture가 없었다.** 새 deferred 케이스가 그 교집합을 잠근다.
- 반복해서 부딪히는 환경 한계: **없음.** `npm ci` 후 Node ABI 게이트와 전체 테스트가 실행됐다.
- 현재 라운드 수: 1

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | — | — | — | — |
