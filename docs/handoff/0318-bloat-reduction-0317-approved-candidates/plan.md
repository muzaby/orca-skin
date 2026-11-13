# Plan — 0318-bloat-reduction-0317-approved-candidates

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0318-bloat-reduction-0317-approved-candidates` |
| 작성자 | Claude Code |
| 일자 | 2026-11-13 |
| 매핑 | 0317 AC10 사용자 승인 항목의 구현 — [0317 verify.md 사용자 확인](../0317-wide-bloat-audit-stage1/verify.md) |
| 상태 | READY |
| 구현 주체 | Claude (비기능 — 리팩토링·미사용 리소스 제거) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0317은 감사 handoff라 구현 V가 없다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 재측정 기준 | 작업 트리 = `1168b67`(0317 감사 기준)과 `app/**` diff 0줄 — `git diff --stat 1168b67 HEAD -- app` → 출력 없음 |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0317 감사가 찾은 것 중 사용자가 승인한 8건이 코드에 남아 있다 — 읽는 곳 없는 번역 키 54개와, 한 함수 안에서 같은 값을 되풀이 조립하는 자리 3곳.
- 완료 후 달라지는 것: 화면·동작은 그대로이고 `ko.ts`·`en.ts`에서 54키가 빠지며, 되풀이 조립이 한 번의 지역 조립으로 합쳐진다. 전제가 틀린 후보는 구현하지 않고 제외 결정으로 남는다.
- 성공을 사용자 관점에서 한 문장으로: 앱을 쓰는 사람은 차이를 못 느끼고, 코드를 읽는 사람은 죽은 번역 키와 중복 조립을 더 만나지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "범위는 i18n 미사용 키 W-07~W-11(ko.ts•en.ts 같이), 그리고 통과 후보 W-01(opencode/v1/adapter.ts) • W-05(CanonicalBackgroundContent.tsx) • W-06(GitContextBar.tsx)이다" | 라이브 세션 2026-11-13 |
| 명시 요구 | "구현 전에 각 후보의 전제와 i18n 참조 0을 현재 코드로 다시 측정하고, 틀린 곳은 제외 결정으로 남겨라" | 같은 턴 |
| 명시 요구 | "I18n과 코드 후보는 커밋을 나눠라" | 같은 턴 |
| 명시 요구 | "조건은 ui 회귀 금지, 성능 최소 동등, 구조적 감량(무작정 코드 제거 금지, 구조적/ 모됼화 설계관점 유지)" | 같은 턴 |
| 명시 요구 | "i18n 미상용 키 W-07~W-11 제거를 승인하고(W-12 제외)" | 같은 턴(0317 AC10) |
| 추론 의도 | "전제"는 0317 `audit.md` §4의 칸(경쟁 가드·형태 잠금·AGENTS 채택 규칙·UI·성능·동적 키 접두사)과 §3의 자리·보존 동작으로 읽는다 | 0317 plan D-005 · audit.md §3·§4 |
| 추론 의도 | "틀린 곳"은 그 칸의 판정이나 근거 사실이 현재 코드에서 성립하지 않는 후보다. 틀린 후보는 고쳐서 구현하지 않고 뺀다 | 원문 "제외 결정으로 남겨라" |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 구현 대상은 0317 승인 8건이다 — i18n W-07~W-11, 코드 W-01·W-05·W-06 | 사용자 승인 | 사용자 2026-11-13 | ACTIVE | D-008이 W-06을 뺀다 |
| D-002 | 구현 전에 후보마다 전제와 i18n 참조 0을 현재 코드로 다시 재고, 틀린 후보는 제외 결정으로 남긴다 | "틀린 곳은 제외 결정으로 남겨라" | 사용자 2026-11-13 | ACTIVE | — |
| D-003 | W-12(`engine.subtitle`)는 지우지 않는다 | "(W-12 제외)" — 테스트 하나가 `ko.engine.subtitle`을 읽는다 | 사용자 2026-11-13 | ACTIVE | — |
| D-004 | i18n 키는 `ko.ts`·`en.ts`에서 함께 지운다 — 두 파일의 키 집합이 같게 남는다 | "ko.ts•en.ts 같이" | 사용자 2026-11-13 | ACTIVE | — |
| D-005 | i18n 변경과 코드 후보 변경은 다른 커밋이다 | "I18n과 코드 후보는 커밋을 나눠라" | 사용자 2026-11-13 | ACTIVE | — |
| D-006 | UI 회귀 금지 · 성능 최소 동등 | 사용자 조건 | 사용자 2026-11-13 | ACTIVE | — |
| D-007 | 구조적 감량만 한다 — 줄을 줄이려고 구조를 깨지 않는다. 컴포넌트·함수·props·export 경계는 그대로 두고 그 안의 되풀이만 합친다 | "무작정 코드 제거 금지, 구조적/ 모됼화 설계관점 유지" | 사용자 2026-11-13 | ACTIVE | — |
| D-008 | **W-06(`GitContextBar.tsx`)은 제외한다** — 성능 전제가 틀렸다 | 0317 §4 성능 칸은 "렌더마다 만드는 클로저 수가 같다(4)"다. 재측정: 닫고-부르기 래퍼를 컴포넌트 안에 두면 어떤 형태든 렌더당 4를 넘는다(§8 P-06). D-002·D-006 적용 | 설계자 재측정 2026-11-13 | ACTIVE | D-001의 W-06 부분 대체 |
| D-009 | 0317 근거 도구 후보 행(INDEX — `deriveI18n`·`refTally`·`i18nBase` UT 공백)은 이번에 승격하지 않는다 | 이번 gate는 그 세 함수를 판정 경로에 쓰지 않는다(`catalogTree`만). `--i18n` 출력은 보조 근거이고 독립 검색으로 교차 확인했다(§8) | 설계자 판단 — INDEX 후보 표 승격 조건 "사용자 요청" | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-009 (첫 설계 턴).
- 변경된 결정: 없음. D-008은 사용자 승인(D-001)의 일부를 사용자 조건(D-002·D-006)으로 뺀 것이다 — 사용자가 W-06을 되살리려면 "클로저 +1은 허용" 한 줄이면 되고, 그때 ΔV로 넣는다.
- **`ACTIVE 결정 ↔ AC` 대조: 충돌 0** — D-001 ↔ AC1·AC4·AC5 · D-002 ↔ AC8 · D-003 ↔ AC1(`engine.subtitle` 남음) · D-004 ↔ AC1·AC2 · D-005 ↔ AC9 · D-006 ↔ AC3·AC4·AC5·AC6·AC10 · D-007 ↔ AC7 · D-008 ↔ AC8(`GitContextBar.tsx` diff 0) · D-009 ↔ §10 선언 경계 3.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | 54키는 정의만 있고 읽는 곳이 0이다(§8 P-i18n). W-01·W-05는 같은 식이 한 함수에 3~7회 있다(§8 P-01·P-05) |
| 이미 기존 코드가 충족하는가 | 아니다 | `app/**`가 감사 기준과 diff 0줄이다 |
| 더 작은 해법 / 제거라면 능력이 없어도 되는가 | i18n — 능력 자체가 없다(그리는 자리 0). W-01·W-05 — 지역 상수·지역 배열로 충분하고 새 모듈·export는 필요 없다 | §9 TO-BE |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 — 7건 성립, **1건(W-06 성능 칸) 불성립** | §8 전제 재측정 표 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음 | `resources.test.ts:36-46`은 쓰지 않는 라벨이 빠져 있음을 단언하는 선례다 |

- 사용자에게 올릴 결정: 없음 — W-06 제외는 사용자가 준 규칙(D-002)의 적용이다. 완료 보고에서 알린다.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

UI가 바뀌지 않는 작업이다. 관측 대상은 "바뀌지 않음"과 그 반대편의 양성 사실이다.

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 한국어·영어로 앱을 쓴다 | 남은 번역 키 1,119개의 값이 그대로다 | 모든 화면 문구가 변경 전과 같다 |
| OpenCode 턴·이력·복구가 `client()`를 부른다 (`cwd` 있음) | 설정 리소스 조회·세션 컨텍스트·discovery 키가 그 `cwd`와 `{ ...process.env, ...env }`를 쓴다 | 변경 전과 같은 폴더·같은 환경으로 동작한다 |
| 같은 호출, `cwd` 없음(`undefined`·빈 문자열) | 세 자리 모두 홈 폴더를 쓴다 | 변경 전과 같다 |
| 백그라운드 패널이 작업 목록을 그린다 | 작업이 실행 중·완료 묶음에 변경 전과 같이 나뉘고 카드가 같은 호출·대화록 결과·모델을 받는다 | 패널이 변경 전과 같다 |
| 변경사항 패널의 `⋮` 메뉴 | 변경 없음(D-008) | 변경 전과 같다 |

### 파생 UX / 엣지케이스

- error: `client()`에서 설정 조회·서버 확보가 실패하면 bridge가 풀린다 — 그대로다(`adapter.ts:164-167`). 지역 상수는 bridge 확보보다 앞에 두므로 상수 계산이 던져도 풀 bridge가 없다.
- concurrency: `client()`의 세 자리 사이에 `await`가 있으나 `cwd`·`env`·`process.env`는 호출 동안 바뀌지 않는다(§8 P-01).
- 그 밖(loading·cancel·a11y·theme): 해당 없음 — 그리는 구조와 props가 그대로다.

## 6. 범위 / 비범위

- **범위**: `ko.ts`·`en.ts`의 54키 제거(W-07~W-11) · `adapter.ts` `client()`의 폴더·환경 조립 합치기(W-01) · `CanonicalBackgroundContent.tsx`의 작업별 조립 합치기(W-05) · 그 잠금 테스트.
- **비범위**: W-06(D-008) · W-12(D-003) · W-02~W-04(0317 걸림) · `adapter.ts:260`의 `{ ...process.env, ...req.env }`(`client()` 밖 — 0317 W-01 자리 목록에 없다) · 같은 컴포넌트의 호출(call) 쪽 `backgroundCallDisplay` 2회(0317 W-05 자리 목록에 없다) · `LegacySubAgentTile.tsx:245` 키 처리기(INDEX 독립 버그 후보).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| W-06 | 아니오 | 제외 결정(D-008) — 사용자가 되살리면 ΔV |
| 호출 쪽 `backgroundCallDisplay` 2회 | 아니오 | 후속 없음 — 감사가 후보로 올리지 않았다 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `ko.ts`·`en.ts`에서 승인 54키가 빠지고, 그 밖의 키는 하나도 빠지지 않으며 `engine.subtitle`이 남는다 | `gate:node docs/handoff/0318-…/scan/keyset.mjs <구현 전 커밋>` → 지운 잎 54 · 남은 승인 키 0 · 승인 밖 삭제 0 · 새 키 0 · 빈 묶음 0 · exit 0 | `resources/{ko,en}.ts` → `shared/i18n/index.ts` → `tr()` |
| R-01 | AT-01 / AC2 | 두 파일의 키 집합이 같고 남은 키의 값이 바뀌지 않는다 | 같은 gate의 `값 바뀜 0`·`ko↔en 키 집합 차이 0` · `resources.test.ts:'ko↔en 리프 키 집합 일치'` | 같음 |
| R-01 | AT-01 / AC3 | 지운 키를 읽는 코드가 없다 — 정적 키는 컴파일이 막고, 테스트 실패 집합이 변경 전과 같다 | `npm run typecheck` 3종 오류 0(`t()` 키는 `typeof ko`에 묶인다 — `i18next.d.ts:6-10`) · `npm run lint` error 0(안 쓰는 `PRODUCT_SLUG` import 포함) · 파일 필터 없는 vitest 실패 집합 − 기준선 = ∅ | `tr('…')` 호출부 전체 |
| R-02 | AT-02 / AC4 | `client(config, env, cwd)`가 설정 리소스 조회·세션 컨텍스트·discovery 키에 같은 폴더(`cwd`, 없으면 홈)와 같은 환경(`process.env`에 `env`를 덮은 값)을 넘긴다 | §10 EP-02 다섯 자리의 테스트 — `cwd` 있음/없음 × `env` 있음/없음에서 조회 키·hold 키·요청 `directory`를 기대값과 대조 | `sendMessage`·`complete`·`recoverSession`·`readHistory`·`prepareComposer` → `client()` (`adapter.ts:250·272·319·341·372`) |
| R-03 | AT-03 / AC5 | 백그라운드 패널이 작업을 실행 중·완료 묶음에 변경 전과 같이 나누고, 카드가 변경 전과 같은 호출·대화록 결과·모델 라벨을 받는다 — 작업과 호출의 `toolUseId`가 다른 경우 포함 | §10 EP-03 자리의 테스트 — 네 입력 분기에서 묶음 소속(`data-background-group`)과 카드 내용(상태·모델 라벨)을 단언 | `RightPanel` 타일 → `CanonicalBackgroundContent` → `BackgroundTaskCard` |
| R-03 | AT-03 / AC6 | 패널 렌더 한 번에 작업 한 건당 호출 찾기(`callForBackgroundTask`)가 목록에서 1회를 넘지 않는다(변경 전 최대 7회) | 신규 테스트 — 작업 N건을 렌더하고 목록 컴포넌트가 부른 횟수 ≤ N | 같음 |
| R-04 | AT-04 / AC7 | 구조가 그대로다 — 새 파일·새 export·props 변경이 없고, 후보마다 prod 줄 수가 준다 | `git diff --stat <구현 전>..HEAD -- app/src ':!*.test.*'` → 변경 파일 = `ko.ts`·`en.ts`·`adapter.ts`·`CanonicalBackgroundContent.tsx` 4개, 파일마다 삭제 > 추가 · `git diff <구현 전>..HEAD -- <두 코드 파일> \| grep -E '^[+-]export '` → 0줄 | — (저장소 형태) |
| R-04 | AT-04 / AC8 | 제외된 후보는 건드리지 않는다 | `git diff --stat <구현 전>..HEAD -- app/src/renderer/src/features/chat/harnesses/common/rightpanel/GitContextBar.tsx` → 0줄 | — |
| R-04 | AT-04 / AC9 | i18n과 코드 후보가 다른 커밋이다 | `git log --name-only <구현 전>..HEAD -- app` — 리소스 두 파일을 담은 커밋에 다른 `app/src` 파일이 없고, 코드 커밋에 리소스 파일이 없다 | — |
| R-05 | AT-05 / AC10 | 사람이 보는 화면이 같다 — 백그라운드 패널(실행 중·완료 묶음, 카드 열기)과 한국어·영어 화면 문구 | 사람 실기 — `npm run dev`에서 Claude 세션의 백그라운드 타일을 열어 묶음·카드·모델 라벨 확인, 언어 전환 후 플러그인·프로젝트·엔진 화면 훑기 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: `resources.test.ts:59 'ko↔en 리프 키 집합 일치'` · `adapter.instances.test.ts:303 'sends default POST directory and workspace…'` · `CanonicalBackgroundContent.render.test.ts:192 'moves terminal background work to completed…'`·`:348 'shows the observed child model…'` — 케이스 존재를 `grep -n "it("`로 확인했다. 이 케이스가 각 자리를 실제로 잠그는지는 구현자의 열거 sweep이 본다(§10).
- 사람 실기 항목: AC10 하나. 묶음 분류·키 순서·폴더 폴백은 테스트로 내렸다(AC4·AC5).
- N회 기준(AC6): sink `callForBackgroundTask`의 prod 호출부 — `git grep -n 'callForBackgroundTask(' -- app/src ':!*.test.*'`로 구현자가 다시 센다. 이 턴의 계수: `CanonicalBackgroundContent.tsx` 5줄(112·114·139·141·144) + `canonicalBackground.ts`의 기본 인자. 단언 범위는 **목록 컴포넌트가 직접 부른 횟수**로 좁힌다 — `backgroundTaskDisplay`의 기본 인자(`canonicalBackground.ts:82`)가 lib 안에서 부르는 것은 모듈 경계 밖에서 세지 못하고, 이번 변경은 `call`을 넘겨 그 기본 인자를 지나지 않는다.
- 총량/0건 기준(AC1): 제거 대상 = 승인 54잎, 허용 대상 = 나머지 1,119잎. gate가 둘을 따로 센다. "빠졌다"(음성)와 "남았다·값이 같다"(양성)를 같은 gate가 함께 본다.
- 구조 목표(AC7): 줄 수 절대값을 계약으로 두지 않는다 — i18n은 도구 실측 파일당 59줄, W-01·W-05는 추정(§14)이라 "파일마다 삭제 > 추가"만 건다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 구현 V가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01 | R | §7 AC1~AC3 — 54키 제거, 나머지 불변 | NEW | — |
| R-02 | R | §7 AC4 — `client()` 폴더·환경 보존 | NEW | — |
| R-03 | R | §7 AC5·AC6 — 패널 묶음·카드 보존, 호출 수 | NEW | — |
| R-04 | R | §7 AC7~AC9 — 구조·제외·커밋 분리 | NEW | — |
| R-05 | R | §7 AC10 — 사람이 보는 화면 | NEW | — |
| AR-01 | AR | §9·§10 EP-02 — `client()` → `configured-resources`·`session-context`·`discovery-cache` 경계로 넘기는 값 | NEW | — |
| MD-01 | MD | §9·§10 EP-03 — 목록 컴포넌트 안 작업별 한 벌(`task`·`call`·`transcript`·`settled`) | NEW | — |
| AT-01~AT-05 · IT-01 · UT-01 | AT·IT·UT | 아래 pair | NEW | — |

`SD` 수준은 고르지 않았다 — end-to-end 상태·수명주기를 바꾸지 않는다(`client()`의 try 두 블록과 lease 수명, 패널의 store 구독이 그대로다).

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `resources/{ko,en}.ts` 잎 → `i18n/index.ts` → `tr(key)` 호출부 | `gate:keyset.mjs`(삭제 집합·값·빈 묶음·ko↔en) · `gate:npm run typecheck`(정적 키 참조) · `resources.test.ts:'ko↔en 리프 키 집합 일치'` | required — 0건·전수 주장이다. 변이 5종(§10 EP-01)은 이 턴에 사본에서 red를 관측했고 구현자·검증자가 다시 심는다 | EP-01 (108잎 + import 2) |
| VP-02 | AR-01 ↔ IT-01 | REQUIRED | `client(config, env, cwd)` → `configuredOpenCodeResources`·`globalOpenCodeResources` → `openCodeDiscovery.run(key)` / → `contexts.acquire(server, directory, …, discoveryKey)` → `openCodeDiscovery.hold(key)`·요청 `directory` | EP-02 표의 자리별 좌표 | required — 형제 값(홈 폴더·`process.env` 원본)과 맞바뀌어도 대표 경로는 통과한다. 변이는 EP-02 표 | EP-02 (5자리) |
| VP-03 | MD-01 ↔ UT-01 | REQUIRED | `tasks` → 작업별 한 벌 → 묶음 거르기 → `BackgroundTaskCard` props(`call`·`transcript`·`persistedModel`) | EP-03 표의 자리별 좌표 | required — 두 키 식의 순서가 서로 반대라 맞바꿈이 가능하다. 변이는 EP-03 표 | EP-03 (6자리) |
| VP-04 | R-02 ↔ AT-02 | REQUIRED | AC4 경로 | VP-02 좌표가 path의 edge 전부를 덮는다(진입 `adapter.client` → 관측 = discovery 키·HTTP 요청) | not selected — VP-02와 같은 좌표 | EP-02 |
| VP-05 | R-03 ↔ AT-03 | REQUIRED | AC5·AC6 경로 | VP-03 좌표 + AC6 횟수 테스트(EP-03 S7) | not selected — VP-03과 같은 좌표 | EP-03 |
| VP-06 | R-04 ↔ AT-04 | REQUIRED | 저장소 형태 | `gate:` AC7·AC8·AC9의 git 명령 | not selected — 명령 출력이 직접 관측이다 | 0 — 운반 자리 없음(형태 계약) |
| VP-07 | R-05 ↔ AT-05 | REQUIRED | 실제 앱 | 사람 실기(AC10) | not selected | 0 — 사람 |

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/**` 변경 | §19 | 이번 변경이 만든 실패만 blocking — 기준선 분리는 두 조건(차집합 ∅ + 환경 원인) |
| 문서 가드 | `docs/handoff/**` 변경 | `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` | 링크·수치·표기 |
| message-bus | 커밋 | `git log -1 --format='%(trailers:only=true)'` — 구현 커밋 trailer | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 전제 재측정 (D-002) — 작업 트리, 2026-11-13

| 후보 | 전제 칸 | 0317 주장 | 재측정 명령 → 관측 | 판정 |
|---|---|---|---|---|
| W-01 | 자리 | 폴더 3회(131·189·197) · 환경 2회(129·198) | `grep -n -E 'nativeWorkingDirectory\(\)\|process\.env' adapter.ts` → 129·131·189·197·198 + 260(`client()` 밖) | 성립 |
| W-01 | 경쟁 가드 | `process.env`를 바꾸는 prod 자리 0 | 0317 §4의 대입·delete·assign 식을 작업 트리 `app/src`(test 제외)에 → 0줄 | 성립 |
| W-01 | 경쟁 가드 | 폴더 식은 호출 동안 같은 값 | `native-storage.ts:23-25` `resolve(cwd \|\| homedir())` — 인자 없는 호출은 홈 | 성립 |
| W-01 | 형태 잠금 | 인자 형태를 단언하는 테스트 0 | `git grep -n -E 'cwd \\|\\| nativeWorkingDirectory\|openCodeDiscovery\.key' -- 'app/src/**/*.test.ts' app/scripts app/eslint.config.mjs` → 1줄(`discovery-cache.test.ts:61` 키 생성 호출) | 성립 |
| W-01 | 값 공유 | (0317에 없음 — 이번에 추가) 환경 객체를 두 자리가 함께 읽어도 되는가 | `configured-resources.ts`·`discovery-cache.ts`에서 `env` 인자 쓰기 검색 → 0줄. `key()`는 `Object.entries(env)`를 읽기만 한다(`discovery-cache.ts:122-132`) | 성립 |
| W-01 | 성능 | 폴더 호출 3→1 · 전개 2→1 | 위 자리 수 | 성립 |
| W-05 | 자리 | 호출 찾기 묶음마다 2회 + 카드 3회, 대화록 찾기 식 2벌 | `grep -n -E 'callForBackgroundTask\|backgroundTaskDisplay\|transcriptResults\.get\|persistedModels\.get' CanonicalBackgroundContent.tsx` → 112·114(거르기) · 139·141·144(카드) · 109 | 성립 |
| W-05 | 경쟁 가드 | 한 렌더 안 동기 계산 | 58~174줄에 `await` 0 — 컴포넌트 본문이다 | 성립 |
| W-05 | UI | 합치는 식이 같은 인자의 같은 순수 함수 | `canonicalBackground.ts:148-159` — `state.calls` 조회만 한다 | 성립 |
| W-05 | 성능 | 작업당 호출 찾기 최대 7→1 · 표시 판정 2→1 | 거르기 2회 × 두 묶음 + 카드 3회 = 7. 표시 판정은 두 묶음에서 1회씩 | 성립 |
| W-06 | 자리 | 콜백 넷이 닫고-부르기를 풀어 쓴다(303~323) | `grep -n 'setViewOpen' GitContextBar.tsx` → 304·309·313·321(+ 토글 265 · `onClose` 298) | 성립 |
| W-06 | **성능** | "렌더마다 만드는 클로저 수가 같다(4)" | 변경 전 = 화살표 4. 0317 §3이 적은 형태(`onX={래퍼(() => 동작)}`, 콜백 6줄 + 래퍼 4줄) = 래퍼 1 + 인자 화살표 4 + 래퍼가 돌려주는 화살표 4 = **9**. 호출형(`onX={() => 래퍼(() => 동작)}`) = 래퍼 1 + 화살표 4 = **5**(클릭마다 화살표 +1) | **불성립 → D-008** |
| W-07~W-11 | prod 참조 0 | 54키 모두 | 독립 검색 — 키마다 `git grep -n -F <키> -- app`(리소스 두 파일 제외, 뒤에 식별자 문자가 오지 않는 것) + 멤버 체인 `(ko\|en\|…)\.<키>` → 닿는 키 0 / 54 | 성립 |
| W-07~W-11 | prod 참조 0 | 도구 재실행 | `node docs/handoff/0317-…/scan/check.mjs --i18n` → 후보마다 `prod 정적 0 · prod 템플릿 0 · 1단계 접두사 겹침 0` | 성립 |
| W-07~W-11 | 동적 키 접두사 | 번역 키 접두사 15개와 겹침 0 | ``git grep -n -E '`[A-Za-z0-9_.]+\.\$\{' -- app/src/renderer/src app/src/shared``(test 제외) → 머리 16종(27줄), 54키의 조상과 겹치는 머리 0 | 성립 |
| W-07~W-11 | 접두사 문자열 조합 | (독립 축) `'조상.' + x` 꼴 | 54키 조상으로 시작해 점으로 끝나는 문자열 검색(`app/src`·`app/scripts`) → prod 0줄 · test 2줄(`ChatTitleBar.render.test.ts:100·130`) | 성립 |
| W-11 | 형태 잠금 | `ChatTitleBar.render.test.ts`가 `'chat.rightpanel.tiles.' + 'artifacts'`를 `not.toContain`으로만 쓴다 | `:100` 상수 · `:131` 부정 단언 — 카탈로그를 읽지 않는다 | 성립(지워도 통과) |
| W-07~W-11 | 삭제 결과 | 키 54 · 잎 54 | `--i18n-strip <사본> W-07 W-08 W-09 W-10 W-11` → 파일당 `삭제 줄 59 · 뺀 import PRODUCT_SLUG · 남은 잎 1119 · 기대와 차집합 0` | 성립 — 줄 수는 0317의 후보별 합 118과 같다 |
| W-07~W-11 | 카탈로그 원문을 읽는 테스트 | 영향 없음 | `product-identity.test.ts:112-128`은 두 파일에 `PRODUCT_DISPLAY_NAME`이 있는지 본다(남는다) · `diffPanel0211dv6.render.test.ts:103-108`은 `diffEmpty` 값(승인 밖) | 성립 |

- 재측정하지 못한 것: 삭제 사본의 `typecheck`·vitest. 이 환경에 `app/node_modules`가 없다(`ls app/node_modules` → 0). 0317 삭제 실험 E3(typecheck 오류 0 · 렌더러 실패 집합 = 기준선)는 같은 트리(diff 0)의 관측이고, 이번 구현의 AC3 gate가 다시 잰다.

### 그 밖의 발견

| 발견 / 제약 | 근거 |
|---|---|
| `engine.blurb`(W-08)가 `PRODUCT_SLUG`의 유일한 사용처다 — 지우면 두 파일의 import에서 `PRODUCT_SLUG`가 빠져야 한다 | `ko.ts:6`·`:413` · strip 출력 `뺀 import PRODUCT_SLUG` |
| `skills.list`·`skills.groups`·`skills.view`는 키가 전부 빠져 묶음째 지운다 | `--i18n` 출력 `함께 비는 객체` |
| `client()` 호출부 5곳 + `native-history.ts:204`(주입) | `git grep -n -E '\.client\(' -- app/src/main`(test 제외) |
| `discoveryKey`는 `contexts.acquire`에서 `openCodeDiscovery.hold(key)`로만 쓰인다 | `session-context.ts:513-515` |
| 테스트는 실제 홈을 보지 않는다 — `HOME`·`USERPROFILE`이 파일마다 임시 루트다. `OPENCODE_*`는 지워진다 | `app/AGENTS.md` `test-host.mjs` 항 |
| `callForBackgroundTask`는 `task.toolUseId` 키로 못 찾으면 `taskId`로 전체를 훑는다 — 그래서 작업과 호출의 `toolUseId`가 다를 수 있다 | `canonicalBackground.ts:152-158` |
| INDEX 후보 표의 겹치는 행: 0317 근거 도구(D-009로 비승격) · 0308 `chatStore.ts`·`background-controller.ts` 잠금 공백(이번 파일과 겹치지 않는다) | `docs/handoff/INDEX.md` `## 새 handoff 후보` |

### 수치 / 전칭 표현 검산

- 재측정 수치: 잎 1,173 → 1,119(−54) 두 파일 모두 · 삭제 줄 59 + import 수정 1줄씩.
- 내역 합 = 총계: 17 + 6 + 10 + 11 + 10 = 54키 · 0317 후보별 삭제 줄 40 + 16 + 20 + 22 + 20 = 118 = 59 × 2.
- "읽는 곳이 없다" 반례 검색: 위 표의 독립 검색 3종(정확 키 · 멤버 체인 · 접두사 조합) + 도구.
- 기존 테스트 케이스 존재 확인: §7 주의사항.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

- 관련 V node: AR-01 · MD-01 · R-01.
- i18n: `ko.ts`·`en.ts`가 1,173잎을 갖고 그중 54잎은 어떤 `tr()`도 읽지 않는다.
- `client()`(`adapter.ts:117-…`): bridge 확보 → try① 안에서 `environment` 조립(129) → 조회에 `cwd || nativeWorkingDirectory()`(131) → 서버 확보 → try② 안에서 같은 폴더 식(189)과, discovery 키 인자로 폴더 식(197)·환경 전개(198)를 다시 쓴다.
- 패널(`CanonicalBackgroundContent.tsx:106-153`): 두 묶음을 돌 때마다 `tasks.filter`가 작업마다 호출 찾기 2회 + 표시 판정 1회를 하고, 카드 props가 호출 찾기를 3회 더 한다.

```text
client(): bridge → try①{ environment=…(129) ; 조회(cwd||home(), environment) } → try②{ acquire(cwd||home(), key(cwd||home(), {...process.env,...env})) }
패널    : groups.map → tasks.filter(task → display(task, call(task), transcript(call(task)))) → 카드(call(task), transcript(call(task)), model(call(task)))
```

### TO-BE

- i18n: 두 파일에서 54잎과 빈 묶음 3개, `PRODUCT_SLUG` import가 빠진다. 다른 줄은 바뀌지 않는다.
- `client()`: bridge 확보 **앞**에 지역 상수 둘 — `directory = cwd || nativeWorkingDirectory()` · `environment = { ...process.env, ...env }`. 세 폴더 자리와 두 환경 자리가 그 상수를 읽는다. try 두 블록·오류 경로·lease 수명은 그대로다.
- 패널: `return` 앞에서 작업마다 `{ task, call, transcript, settled }` 한 벌을 한 번 만들고(지역 배열), 묶음 거르기는 `settled`만 비교하며 카드는 그 한 벌을 받는다. `persistedModel`의 키 순서(`task.toolUseId` 먼저)는 그대로 둔다.

```text
client(): directory, environment → bridge → try①{ 조회(directory, environment) } → try②{ acquire(directory, key(directory, environment)) }
패널    : rows = tasks.map(task → {task, call, transcript, settled}) → groups.map → rows.filter(settled) → 카드(row)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | `client()`·`CanonicalBackgroundContent`가 값 조립을 자리마다 한다 | 같은 함수가 한 번 조립한다 — 소유자 불변, 새 모듈·export 없음 | D-007 | AC7 · VP-06 |
| data flow (W-01) | 폴더 식 3벌 · 환경 식 2벌 | 지역 상수 2개 → 5자리 | 되풀이 제거 | AR-01 · VP-02 · EP-02 |
| data flow (W-05) | 호출 찾기 작업당 최대 7회 | 작업당 1회 | 되풀이 제거 · 성능 | MD-01 · VP-03 · EP-03 · AC6 |
| state/contract | 번역 키 1,173 | 1,119 — `MessageKey` 타입에서 54키가 빠진다 | 미사용 제거 | R-01 · VP-01 · EP-01 |
| error/lifecycle | 폴더 식은 try① 안에서 처음 평가된다 | bridge 확보 앞에서 평가된다 — 던지면 bridge를 잡기 전이라 풀 것이 없다 | 상수를 두 try가 함께 읽어야 한다 | §13 |
| test seam | — | 기존 어댑터 fixture · 패널 render 테스트에 입력 추가 | 자리 잠금 | §11 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 호출 |
|---|---|---|---|
| `adapters/opencode/v1/adapter.ts` `client()` | 한 호출의 폴더·환경을 정하고 서버·컨텍스트를 확보 | `(config, env, cwd)` → lease | 같은 클래스의 턴·이력·복구 메서드 |
| `harnesses/claude/rightpanel/CanonicalBackgroundContent.tsx` | 패널 목록의 작업별 표시 재료 조립과 묶음 배치 | store 상태 → 카드 props | 오른쪽 패널 타일 |
| `shared/i18n/resources/{ko,en}.ts` | 번역 값 | 키 → 문자열 | `tr()` |

## 10. 계약 / 타입 / 강제 지점

| V pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|
| VP-01 / EP-01 | 승인 54키만, 두 파일에서 같이 빠진다 | 0317 `data/audit.json` W-07~W-11 `i18nKeys` | 54잎 × 2파일 = 108잎 + import 2줄 | `node …/0318-…/scan/keyset.mjs <구현 전 커밋>` → 파일마다 `지운 잎 54` | 남은 키 = 죽은 문구 잔존 · 초과 삭제 = 화면에 키 문자열 노출 |
| VP-02·04 / EP-02 | 한 `client()` 호출의 다섯 자리가 같은 폴더·같은 환경을 받는다 | `client()`의 지역 상수 | 5자리 — 아래 표 | `grep -n -E 'directory\|environment' adapter.ts`의 `client()` 구간 — 구현 뒤 읽는 자리 5 + 정의 2. 변경 전 대응: `grep -n -E 'nativeWorkingDirectory\(\)\|process\.env'` → 129·131·189·197·198 | 조회와 컨텍스트가 다른 폴더·환경을 본다 — 캐시 키가 실제 조회와 어긋나 무효화가 빗나간다 |
| VP-03·05 / EP-03 | 한 작업의 한 벌이 묶음 판정과 카드에 같은 값으로 간다 | 목록 컴포넌트의 지역 배열 | 6자리 + 횟수 1 — 아래 표 | `grep -n -E 'callForBackgroundTask\|backgroundTaskDisplay\|transcriptResults\.get\|persistedModels\.get' CanonicalBackgroundContent.tsx` → 변경 전 109·112·113·114·139·140·141·143·144, 구현 뒤 한 벌 조립 3줄 + 카드 1줄 | 작업이 틀린 묶음에 뜨거나 카드가 다른 호출의 결과·모델을 그린다 |

### EP-01 — 등록 변이 (사본에서 이 턴에 red 관측)

| # | 변이 | 종류 | 잡는 좌표 | 이 턴 관측 |
|---|---|---|---|---|
| V1 | 아무것도 지우지 않는다 | 제거 | `gate:keyset.mjs` | `남은 승인 키 54` · exit 1 |
| V2 | 승인 밖 키 하나를 더 지운다(`background.title`) | 다른 값 | `gate:keyset.mjs` | `승인 밖 삭제 1` |
| V3 | 남은 키의 값을 바꾼다(`background.loading`) | 다른 값 | `gate:keyset.mjs` | `값 바뀜 1` |
| V4 | `ko.ts`만 지운다 | 제거 | `gate:keyset.mjs` · `resources.test.ts:'ko↔en 리프 키 집합 일치'` | `ko↔en 키 집합 차이 54` |
| V5 | 빈 묶음 껍데기를 남긴다(`list: {}`) | 빈 값 | `gate:keyset.mjs` | `빈 묶음 1` |
| V6 | `PRODUCT_SLUG` import를 남긴다 | 제거 | `gate:npm run lint` (`no-unused-vars`) | 미관측 — 구현자가 확인한다 |

### EP-02 — 자리 · 규칙 분기 · oracle

규칙: 폴더 = `cwd`가 참이면 `cwd`, 아니면 홈(분기 2). 환경 = `process.env`에 `env`를 덮은 값, `env`가 없으면 `process.env`와 같은 내용(분기 2).

| 자리 | 운반 값 | oracle 좌표 | 구별 입력 | 등록 변이 |
|---|---|---|---|---|
| S1 조회 폴더 (`configuredOpenCodeResources` 1번 인자, 현 131) | 폴더 | 신규 — `adapter.test.ts`(또는 같은 fixture의 새 파일), 진입 `f.adapter.client`, 관측 = `vi.spyOn(openCodeDiscovery, 'run')` 첫 인자 키 | `cwd` = 홈과 다른 경로 / `cwd` 없음 — 기대 키는 `openCodeDiscovery.key('configured', <폴더>, <환경>, 'false')` | `directory` → `nativeWorkingDirectory()` (맞바꿈) |
| S2 조회 환경 (같은 호출 2번 인자 + `globalOpenCodeResources`, 현 129-132) | 환경 | 같은 테스트 — `run` 키 둘(`'false'`·`'true'`) | `env` = 키 필터에 드는 이름 하나(`XDG_`·`OPENCODE_` 접두사)에 표식 값 / `env` 없음 | `environment` → `process.env` (맞바꿈) |
| S3 컨텍스트 폴더 (`contexts.acquire` 2번 인자, 현 189) | 폴더 | 기존 `adapter.instances.test.ts:'sends default POST directory and workspace…'`(`cwd` 있음) + 신규(`cwd` 없음 → 요청 `directory` = `homedir()`) | `cwd` = `'C:/프로젝트'` / 없음 | `directory` → `nativeWorkingDirectory()` |
| S4 discovery 키 폴더 (현 197) | 폴더 | 신규 — 관측 = `vi.spyOn(openCodeDiscovery, 'hold')` 첫 인자 | S1과 같은 입력, 기대 키도 같다 | `directory` → `nativeWorkingDirectory()` |
| S5 discovery 키 환경 (현 198) | 환경 | 같은 테스트 | S2와 같은 입력 | `environment` → `process.env` |
| 정의 | 두 상수 | 위 다섯 좌표 전부 | — | `cwd \|\| home` → home 고정(고정값) · `{...process.env, ...env}` → `{...env, ...process.env}`(뒤집기 — 표식 이름을 `process.env`에도 다른 값으로 넣은 입력이 필요하다) |

- spy는 구현을 바꾸지 않는 관측이다(`mockImplementation` 없음) — 실행 구간은 `client()`부터 `discovery-cache`·`session-context`까지 production 코드다.
- `vi.spyOn`이 그 fixture에서 동작하지 않으면(모듈 객체 동결 등) 구현자는 관측을 같은 값이 드러나는 다른 지점(`openCodeDiscovery.invalidate`가 그 키를 비우는지, 요청 헤더)으로 바꾸고 `설계 대비 명시적 차이`에 적는다.

### EP-03 — 자리 · 규칙 분기 · oracle

규칙(입력 분기 4): ① 작업 `toolUseId`로 호출을 찾음(둘이 같다) · ② 작업에 `toolUseId`가 없고 `taskId`로 호출을 찾음 · ③ 작업 `toolUseId`가 있으나 그 키에 호출이 없어 `taskId`로 다른 `toolUseId`의 호출을 찾음(둘이 다르다) · ④ 호출 없음.
키 규칙: 대화록 = `call?.toolUseId ?? task.toolUseId ?? ''` · 모델 = `task.toolUseId ?? call?.toolUseId ?? ''`.

| 자리 | 운반 값 | oracle 좌표 | 구별 입력 | 등록 변이 |
|---|---|---|---|---|
| S1 한 벌의 `call` | 호출 | `CanonicalBackgroundContent.render.test.ts` — 기존 케이스 + 신규(분기 ②·③) | 분기 ①~④ | `call` → `undefined`(빈 값) |
| S2 한 벌의 `transcript` 키 | 대화록 결과 | 신규 — 분기 ③에서 호출 쪽 `toolUseId`에만 결과를 둔다 → `settled`·카드 상태로 관측 | 분기 ③ | 키 순서 뒤집기(`task.toolUseId ?? call?.toolUseId`) |
| S3 한 벌의 `settled` | 묶음 소속 | 기존 `:192 'moves terminal background work to completed…'` + 신규(전경 작업이 `returned` 호출로 정착하는 입력 — `canonicalBackground.ts:92`) | 실행 중 1 + 완료 1 동시 | `settled` → `false` 고정 |
| S4 묶음 거르기 | 묶음 소속 | S3 좌표 — `data-background-group`별 카드 수 | 같음 | 비교 뒤집기(`!==`) |
| S5 카드 `call`·`transcript` | 카드 내용 | 기존 render 케이스(카드 상태·결과) + 분기 ③ 신규 | 분기 ①·③ | 카드에 다른 행의 값(맞바꿈 — 작업 2건 입력) |
| S6 카드 `persistedModel` 키 | 모델 라벨 | 기존 `:348 'shows the observed child model…'` + 신규(분기 ③ — 작업 쪽 `toolUseId`에만 모델을 둔다) | 분기 ③ | 키 순서 뒤집기(`call?.toolUseId ?? task.toolUseId`) |
| S7 호출 횟수(AC6) | — | 신규 — `canonicalBackground` 모듈의 `callForBackgroundTask`를 원본을 부르는 spy로 감싸 목록 렌더의 호출 수 ≤ 작업 수 | 작업 3건 | 카드 prop을 `callForBackgroundTask(state, task)` 직접 호출로 되돌림 |

- 기존 케이스 좌표는 이름만 확인했다. 그 케이스가 변이를 실제로 잡는지는 구현자의 sweep이 판정하고, `못 잡음`이면 그 자리에 입력을 더한다(규칙 칸이 기대를 정한다).

### 선언 경계 · 그 밖

- **선언 경계 1**: `keyset.mjs`는 잎(키·값)만 본다 — 주석·빈 줄·키 순서의 변경은 green이다. 측정: 사본의 삭제 줄 59는 전부 잎 줄·묶음 여닫는 줄이고 주석 줄 0(`diff`의 `<` 줄 60 = 59 + import).
- **선언 경계 2**: W-01의 성능은 정적 자리 수(폴더 3→1, 환경 2→1)로만 본다 — 턴당 한 번 도는 경로라 횟수 테스트를 두지 않는다. 횟수 잠금은 핫패스인 W-05(AC6)에만 둔다.
- **선언 경계 3**: 0317 근거 도구의 UT 입력 공백 9행(INDEX 후보)은 이번 판정에 닿지 않는다(D-009) — `keyset.mjs`의 import는 `catalogTree`·`I18N_KO`·`I18N_EN`뿐이다(`grep -n 'import' scan/keyset.mjs`).
- **선언 경계 4**: 지운 키를 런타임에 조합해 읽는 미래 코드는 막지 않는다 — 현재 트리에 그런 형태 0(§8 동적 접두사·접두사 조합 검색).
- 열린 입력 집합 판정 산출물: `keyset.mjs`는 닫힌 비교다 — 기준 잎 집합과의 차이가 "승인 54키 삭제"와 정확히 같지 않으면 전부 red다(fail-closed).
- 같은 규칙의 SSOT: 승인 키 목록은 0317 `audit.json` 한 곳, gate가 직접 읽는다. plan은 키를 다시 나열하지 않는다.
- 선택적 필드: `cwd`·`env`의 `undefined`와 `cwd === ''`는 모두 "없음" 분기다(`||`). `??`로 바꾸지 않는다 — 빈 문자열 의미가 달라진다.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/shared/i18n/resources/ko.ts` · `en.ts` | 번역 값 | 54잎 · 빈 묶음 3 · `PRODUCT_SLUG` import 제거. 0317 도구로 사본에 strip한 결과와 같아야 한다(`--i18n-strip`은 작업 트리를 거부하므로 사본에 쓰고 옮기거나 손으로 지운 뒤 gate로 판정) | `gate:keyset.mjs` |
| `app/src/main/adapters/opencode/v1/adapter.ts` | `client()` | bridge 확보 앞에 `directory`·`environment` 지역 상수, 다섯 자리가 읽는다. `openCodeDiscovery.key(…)` 인자 네 줄 풀어쓰기가 한 줄이 된다 | 기존 어댑터 fixture(`adapter.testfixture.ts`) |
| `app/src/main/adapters/opencode/v1/adapter*.test.ts` | EP-02 좌표 | S1·S2·S4·S5 신규 케이스, S3 `cwd` 없음 케이스 | — |
| `…/claude/rightpanel/CanonicalBackgroundContent.tsx` | 목록 | `return` 앞 작업별 한 벌 배열, 거르기·카드가 그것을 읽는다 | 기존 render·wiring 테스트 |
| `…/claude/rightpanel/CanonicalBackgroundContent.render.test.ts` | EP-03 좌표 | 분기 ②·③ 입력, S7 횟수 케이스 | — |
| `docs/handoff/0318-…/scan/keyset.mjs` | VP-01 gate | 이 설계 커밋에 포함(구현 산출 아님) | 변이 V1~V5 |

커밋 순서(D-005): ① i18n(리소스 두 파일만) → ② W-01(코드 + 테스트) → ③ W-05(코드 + 테스트) → ④ `[구현자 기입]`·INDEX. ②와 ③은 한 커밋이어도 된다. 구현 커밋 trailer는 `Status: implemented` 형식이다.

### 테스트 가능성

- electron/DB 의존: 없음 — 어댑터 테스트는 fixture가 서버·프로세스를 가짜로 세우고, 패널 테스트는 순수 렌더다.
- 테스트 소스 규칙: 새 케이스에 시간 값을 두지 않는다(예산 가드). 자식 프로세스·git을 쓰지 않는다(unit 풀). `HOME`은 setup의 임시 루트를 그대로 쓰고 기대값은 `homedir()`로 얻는다.

## 12. End-to-end 영향

```text
tr(key) ← resources   : 54키의 소비자 0 → 영향받는 화면 0
client() → discovery 키 = 조회 키 : 같은 상수에서 나오므로 조회 캐시와 hold 대상이 같은 항목을 가리킨다(변경 전에도 값은 같았다)
패널 한 벌 → 카드     : 카드가 받는 props 타입·이름 불변
```

- 부팅/등록/초기화 변경: 해당 없음.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `client()`의 상수는 호출마다 새로 만든다 — 호출 간 공유·캐시 없음.
- 오류: 상수 계산은 bridge 확보 앞이다. `homedir()`가 던지는 드문 경우 변경 전에는 bridge를 잡았다가 풀었고 변경 뒤에는 잡지 않는다 — 호출자가 받는 거절은 같다.
- 취소·종료·retry: 변경 없음.
- 다중 저장소 쓰기: 코드 — 해당 없음. 문서 — 판정 사본이 `plan.md` `[구현자 기입]`·`verify.md`·`INDEX.md` 세 곳에 산다. 수치는 plan/verify가 갖고 INDEX 비고는 링크와 요약만 둔다.

## 14. 성능 / 상한 / 최적화

- 새 출력·새 요청: 없음.
- W-01: `nativeWorkingDirectory()` 호출 최대 3 → 1, `process.env` 전개 2 → 1(호출당).
- W-05: 렌더당 작업 한 건에 호출 찾기 최대 7 → 1, 표시 판정 2 → 1. 대신 작업마다 작은 객체 1개와 배열 1개를 만든다 — 호출 찾기는 `toolUseId`가 없으면 `state.calls` 전체를 훑으므로(`canonicalBackground.ts:156`) 줄어드는 쪽이 크다.
- 구조적 목표: i18n −59줄 × 2(실측). W-01 약 −4줄 · W-05 약 −6~−9줄(추정 — 0317 §3 감량 칸과 이 턴의 TO-BE 스케치). 계약은 "파일마다 삭제 > 추가"(AC7)다.
- 호출 축소로 잃는 부수 효과: 없음 — 합치는 함수가 순수 조회다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 하네스 공통은 구체 하네스를 import하지 않는다 | `app/src/renderer/AGENTS.md` 4-layer | §11 — 변경이 각 파일 안에 머문다, import 추가 0 | 유지 |
| adapters 레이어 하향 의존 | `app/src/main/AGENTS.md` | §11 — `adapter.ts` import 불변 | 유지 |
| 테스트는 실제 홈·호스트 설정을 보지 않는다 | `app/AGENTS.md` | §11 테스트 소스 규칙 | 유지 |
| 쓰지 않는 라벨은 카탈로그에서 뺀다(선례) | `resources.test.ts:36-46` | §4 | 유지 |
| 0317 D-006·D-016 — `remove`는 승인 목록 대상, i18n은 문턱 밖 | 0317 plan | D-001·D-003 | 유지(승인 받음) |
| 문서에 코드 수치를 적지 않는다 | root `AGENTS.md` 원칙 4 | 대상은 current-state 문서다 — handoff 산출물은 가드 제외 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 지운 키를 동적으로 읽는 자리를 놓쳤다 | 독립 검색 3종 + 도구 + typecheck + 전체 vitest. 사람 실기(AC10)가 마지막 그물 |
| `vi.spyOn(openCodeDiscovery, …)`가 fixture와 맞지 않는다 | §10 EP-02 대체 관측 허용 |
| AC6 횟수 테스트가 이후 리팩토링의 형태 잠금이 된다 | 상한(≤ 작업 수)만 건다 — 정확한 횟수가 아니다 |
| W-06 제외가 사용자 승인과 다르다 | D-008에 근거와 되살리는 조건을 적었고 완료 보고에서 알린다 |

- 되돌리기 어려운 결정: 없음 — 번역 키는 `git revert`로 돌아온다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/shared/i18n/resources/ko.ts` · `en.ts`
- `app/src/main/adapters/opencode/v1/adapter.ts` + 같은 디렉터리 테스트
- `app/src/renderer/src/features/chat/harnesses/claude/rightpanel/CanonicalBackgroundContent.tsx` + `.render.test.ts`
- `docs/handoff/0318-bloat-reduction-0317-approved-candidates/{plan.md,scan/keyset.mjs}` · `docs/handoff/INDEX.md`
- `docs/arch/**`·카탈로그 문서: 변경 없음 — 컴포넌트 신설·이동·삭제가 없다.

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md §테스트`.
- 환경 제약: 이 환경에 `node_modules`가 없다 — `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`로 설치하고 postinstall(Electron ABI) 실패는 환경 서명으로 분리한다.
- 구현 전 기준선: 같은 명령으로 변경 전 실패 집합을 먼저 뜬다(0317 r 기록상 이 Linux 환경은 Windows 경로 단언 등 기준선 red가 있다).
- 수정 루프: `npm run lint && npm run typecheck` · `./node_modules/.bin/vitest run src/main/adapters/opencode/v1/adapter src/renderer/src/features/chat/harnesses/claude/rightpanel src/renderer/src/shared/i18n`.
- IMPL_DONE 전 마지막 gate(`app/`에서): `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` · (저장소 루트에서) `node docs/handoff/0318-…/scan/keyset.mjs <구현 전 커밋>`.
- `lint`는 `--fix`라 파일을 쓴다 — 실행 뒤 `git status`로 자기 변경 밖의 수정이 없는지 본다.
- 사람 실기: AC10.

## READY self-review

- [x] Decision Ledger — D-001~D-009, 사용자 원문 인용. `ACTIVE 결정 ↔ AC 대조: 충돌 0`(§3 갱신 메모).
- [x] Part I만으로 완료 상태가 읽힌다 — §5 표 5행.
- [x] 조건절 유지 — "틀린 곳은 제외"를 "고쳐서 구현"으로 바꾸지 않았다(D-008).
- [x] 사용자에게 물을 결정 0 · 조사로 닫은 사실은 §8 전제 표 19행.
- [x] AS-IS·TO-BE·Delta가 같은 축(i18n · `client()` · 패널)이다. 사라진 책임 0 — 삭제는 미사용 키뿐이다.
- [x] 수치 실측 — 잎 1,173→1,119 · 59줄 × 2 · 자리 줄 번호. 인용한 테스트 케이스 4개 `grep`으로 존재 확인.
- [x] AC10개 모두 동작 기준·검증 수단·도달 경로를 가진다. 음성 기준(AC1 "빠진다")은 양성(AC2 "남고 값이 같다")과 짝이다.
- [x] Baseline V · NEW node 7 전부 같은 레벨 REQUIRED pair(R-01↔VP-01 · R-02↔VP-04 · R-03↔VP-05 · R-04↔VP-06 · R-05↔VP-07 · AR-01↔VP-02 · MD-01↔VP-03).
- [x] pair마다 path·§10 자리·좌표. EP-02 규칙 분기 2×2 ↔ 구별 입력 칸, EP-03 분기 4 ↔ 구별 입력 칸.
- [x] 선언 경계 4개 — 1·3·4는 측정 근거, 2는 범위 선언.
- [x] `keyset.mjs`는 fail-closed다 — 변이 5종 red를 사본에서 관측.
- [x] 후보 표 겹침 확인 — 0317 근거 도구 행(D-009) · 0308 행(파일 불일치).
- [x] 운영 gate 3행 · §19가 `app/AGENTS.md` 로컬 확인 목록과 같다.
- [x] 사람 실기로 미룬 순수 로직 0 — AC10은 시각만.
- [x] structural proxy — AC6(횟수)은 성능 조건의 직접 관측이고 동작은 AC5가 따로 잠근다. AC7(형태)은 D-007의 직접 관측이다.
- [x] 부팅/등록 변경 없음 · 신규 계약 없음 · one-way door 없음.
- [x] 문장 규칙 — 판정 먼저, 표 칸 3줄 이내.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md). 필드는 [`plan.template.md`](../../../.agents/skills/handoff-plan/plan.template.md)의 `[구현자 기입]` 전부를 같은 이름으로 채운다.

## [구현자 기입] 설계 리뷰

### r1

- 동의 / 그대로 진행: §9 TO-BE 세 축(i18n · `client()` 지역 상수 둘 · 패널 작업별 한 벌)을 그대로 구현했다. D-008(W-06 제외)·D-003(W-12 유지)도 그대로다 — `GitContextBar.tsx` diff 0줄, `engine.subtitle` 잔존(`keyset.mjs` 승인 밖 삭제 0).
- 이견 / 현실성 문제: 없음. §8의 "삭제 줄 59 + import 1줄"은 도구 출력 기준이고, 실제 diff는 파일당 −65/+6이다 — strip이 남긴 묶음 끝 쉼표 5곳을 `npm run lint`(prettier `trailingComma: none`)가 고쳤다. 잎 집합·값은 같다(`keyset.mjs` 값 바뀜 0).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

### r1

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 / EP-01 | 승인 54키만, 두 파일에서 같이 | 108잎 + import 2줄 | 108/108 + 2/2 | `node …/scan/keyset.mjs 3e7e6fc` → 파일마다 `잎 1173 → 1119 · 지운 잎 54 · 남은 승인 키 0 · 승인 밖 삭제 0 · 새 키 0 · 값 바뀜 0 · 빈 묶음 0`, `ko↔en 키 집합 차이 0`, exit 0 · import → `gate:npm run lint`(V6 red 관측) | 잎 경로·값 — 기준 커밋 잎 집합과의 양방향 차집합 · import — 변이 V6에서 `no-unused-vars` error 2 | — |
| VP-02·04 / EP-02 | 다섯 자리가 같은 폴더·환경 | S1~S5 (5) + 정의 2 | 5/5 | `grep -n -E 'directory\|environment' adapter.ts`의 `client()` 구간 → 정의 124·125, 읽는 자리 132(S1·S2)·133(S2)·190(S3)·196(S4·S5) — 목록과 차집합 0 · 좌표: `adapter.instances.test.ts:'reads resources, holds discovery and scopes requests with %s'`(4케이스) · S3는 `'sends default POST directory and workspace…'`도 | 폴더: `cwd`=`/fixture/explicit-project`(홈과 다름을 단언) / `undefined` / `''` → `run`·`hold` 키의 폴더 항 + 요청 `x-opencode-directory` · 환경: `XDG_STATE_HOME` 표식(`process.env` 값과 다름을 단언) / `env` 없음 → 키의 환경 항 | — |
| VP-03·05 / EP-03 | 한 작업의 한 벌이 묶음·카드에 같은 값 | S1~S6 (6) + 횟수 S7 | 6/6 + 1/1 | `grep -n -E 'callForBackgroundTask\|backgroundTaskDisplay\|transcriptResults\.get\|persistedModels\.get' CanonicalBackgroundContent.tsx` → 한 벌 91·92·93, 카드 134·135·136(그 밖 85·116·150·151·187은 호출 쪽·상세·카드 내부 — 변경 전부터 있던 줄) · 좌표: `CanonicalBackgroundContent.render.test.ts:'joins a task to a call under another toolUseId for grouping, transcript and model'`(S1·S2·S5·S6) · `'keeps a foreground task running until its joined call returns'`·`'moves terminal background work to completed…'`(S3·S4) · `'looks up the call of each listed task at most once per render'`(S7) | 호출: 작업 둘의 호출 이름을 `Agent`/`Task`로 다르게 → 카드 제목 · 대화록: 분기 ③에서 호출 쪽 키에 `no_result`, 작업 쪽 키에 미실행 표식 없는 결과 → `실행되지 않음` · 모델: 작업 쪽 키 Haiku / 호출 쪽 키 Sonnet → `Haiku 4.5` · 묶음: `data-background-group`별 작업 ID 목록 | — |
| VP-06 | 저장소 형태 | 0 — 운반 자리 없음 | — | AC7~AC9 명령(구현 보고) | 운반 항 없음 | — |
| VP-07 | 사람이 보는 화면 | 0 — 사람 | — | AC10 실기 대기 | 운반 항 없음 | AC10 |

- §10 자리 목록 밖에서 본 운반 자리: 1건 — `store/backgroundStore.ts:73·75`가 같은 작업에 `callForBackgroundTask`를 두 번 부른다. 0317 W-05 자리 목록(이 컴포넌트)에 없고 이번 path(`CanonicalBackgroundContent` → 카드)도 아니다 → **비귀속**(인접 개선), 고치지 않았다.
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 — verify 0회.
- 규칙 분기 입력: EP-02 폴더 2(있음 · 없음=`undefined`와 `''`) × 환경 2(있음 · 없음) = `it.each` 4행. EP-03 분기 ①(`mixedBackgroundState` — 작업·호출 `toolUseId` 같음) · ②(`task-two` — 작업에 `toolUseId` 없음) · ③(`task-one` — 작업 쪽 `orphan-one`, 호출 쪽 `call-one`) · ④(`mixedBackgroundState`의 `done` — 호출 없음).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `gate:keyset.mjs` · `gate:npm run typecheck` · `resources.test.ts:'ko↔en 리프 키 집합 일치'` | required — V1~V6 전부 red(잠금 표) |
| VP-02 | REQUIRED | SELF_PASS | `adapter.instances.test.ts:'reads resources, holds discovery and scopes requests with %s'` | required — A1~A12 전부 red |
| VP-03 | REQUIRED | SELF_PASS | `CanonicalBackgroundContent.render.test.ts`의 신규 3케이스 + 기존 `:'moves terminal background work to completed…'` | required — P 17건 중 red 14 · 동치 3 |
| VP-04 | REQUIRED | SELF_PASS | VP-02 좌표(진입 `adapter.client` → 관측 discovery 키·HTTP 요청) | not selected — VP-02와 같은 좌표 |
| VP-05 | REQUIRED | SELF_PASS | VP-03 좌표 + `'looks up the call of each listed task at most once per render'` | not selected — VP-03과 같은 좌표 |
| VP-06 | REQUIRED | SELF_PASS | `gate:` AC7·AC8·AC9 git 명령(구현 보고의 출력) | not selected — 명령 출력이 직접 관측 |
| VP-07 | REQUIRED | SELF_BLOCKED | 사람 실기(AC10) | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

### r1

하네스 `mutate.py`(A·P) · 사본/작업 트리 수동 실행(V). oracle은 A = `vitest run …/adapter.instances -t "reads resources|sends default POST"`(변이 없이 5 passed 확인), P = `vitest run …/CanonicalBackgroundContent.render`(변이 없이 42 passed 확인). 실행 뒤 `git status`로 원복을 확인했다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| V1 아무것도 지우지 않음(기준 커밋 두 파일) | VP-01 선택 증거 | 최초 | `keyset.mjs` `남은 승인 키` 108줄 · exit 1 | 잠김 |
| V2 `background.title` 추가 삭제(두 파일) | VP-01 선택 증거 | 최초 | `승인 밖 삭제 1` × 2 | 잠김 |
| V3 `background.loading` 값 변경 | VP-01 선택 증거 | 최초 | `값 바뀜: background.loading` · exit 1 | 잠김 |
| V4 `en.ts`만 기준 커밋으로 | VP-01 선택 증거 | 최초 | `ko↔en 키 집합 차이 54` · `resources.test.ts:'ko↔en 리프 키 집합 일치'` 1 failed | 잠김 |
| V5 `skills.list: {}` 껍데기 | VP-01 선택 증거 | 최초 | `빈 묶음 1` · exit 1 | 잠김 |
| V6 `PRODUCT_SLUG` import 복원(두 파일) | VP-01 선택 증거 | 최초 | `eslint` `no-unused-vars` error 2 | 잠김 |
| A1 `adapter.ts:132` 조회 폴더 → `nativeWorkingDirectory()` | VP-02 선택 증거(S1 맞바꿈) | 최초 | 2 failed / 5 | 잠김 |
| A2 `:132` 조회 환경 → `process.env` | VP-02 선택 증거(S2 맞바꿈) | 최초 | 2 failed | 잠김 |
| A3 `:133` 전역 조회 환경 → `process.env` | sweep — §10 자리(S2 둘째 인자) | 최초 | 2 failed | 잠김 |
| A4 `:190` 컨텍스트 폴더 → `nativeWorkingDirectory()` | VP-02 선택 증거(S3) | 최초 | 3 failed | 잠김 |
| A5 `:196` 키 폴더 → `nativeWorkingDirectory()` | VP-02 선택 증거(S4) | 최초 | 2 failed | 잠김 |
| A6 `:196` 키 환경 → `process.env` | VP-02 선택 증거(S5) | 최초 | 2 failed | 잠김 |
| A7 `:124` `cwd \|\| home` → home 고정 | VP-02 선택 증거(정의 고정값) | 최초 | 3 failed | 잠김 |
| A8 `:125` `{...env, ...process.env}` | VP-02 선택 증거(정의 뒤집기) | 최초 | 2 failed | 잠김 |
| A9 `:124` `\|\|` → `??` | sweep — 규칙 칸 분기(빈 문자열) | 최초 | 1 failed(`an empty directory…`) | 잠김 |
| A10 `:125` `...env` 제거 | sweep — 규칙 칸 분기(diff 자리) | 최초 | 2 failed | 잠김 |
| A11 `:196` 키 `'false'` → `'true'` | sweep — §10 자리(형제 슬롯 맞바꿈) | 최초 | 4 failed | 잠김 |
| A12 `:125` `...process.env` 제거 | sweep — 규칙 칸 분기(diff 자리) | 최초 | 2 failed | 잠김 |
| P1 `…Content.tsx:91` `call` → `undefined` | VP-03 선택 증거(S1) | 최초 | 2 failed / 42 | 잠김 |
| P2 `:92` 대화록 키 순서 뒤집기 | VP-03 선택 증거(S2) | 최초 | 1 failed | 잠김 |
| P2b `:92` `?? task.toolUseId` 제거 | sweep — 규칙 칸 분기(diff 자리) | 최초 | 0 failed | 동치 — 작업의 대화록 결과는 `call?.phase === 'returned'` 가지에서만 읽힌다(`canonicalBackground.ts:92-101`). 호출이 없으면 어떤 키로 찾아도 쓰이지 않는다. 확인 실행 42 passed |
| P2c `:92` 키 → `''` | sweep — §10 자리(S2 빈 값) | 최초 | 1 failed | 잠김 |
| P3 `:93` `settled` → `false` | VP-03 선택 증거(S3) | 최초 | 7 failed | 잠김 |
| P3b `:93` 판정에서 `transcript` 인자 제거 | sweep — 규칙 칸 분기(diff 자리) | 최초 | 0 failed | 동치 — `settled`는 대화록 결과와 무관하다. 대화록을 읽는 가지는 항상 `settled: true`를 돌려준다(`canonicalBackground.ts:92-101`). 확인 실행 42 passed |
| P3c `:93` 판정의 `call` → `undefined` | sweep — §10 자리(S1 빈 값) | 최초 | 0 failed | 동치 — 기본 인자가 같은 호출을 다시 찾는다(`canonicalBackground.ts:82`). 그 재조회는 모듈 안이라 AC6 단언 범위 밖(§7 주의사항). 확인 실행 42 passed |
| P4 `:113` 비교 `!==` | VP-03 선택 증거(S4) | 최초 | 7 failed | 잠김 |
| P5a `:134` 카드 `call` → `rows[0].call` | VP-03 선택 증거(S5 맞바꿈) | 최초 | 1 failed | 잠김 |
| P5b `:135` 카드 `transcript` → `rows[0].transcript` | sweep — §10 자리(S5 맞바꿈) | 최초 | 1 failed | 잠김 |
| P5c `:134` 카드 `call` → `undefined` | sweep — §10 자리(S5 제거) | 최초 | 1 failed | 잠김 |
| P5d `:135` 카드 `transcript` → `undefined` | sweep — §10 자리(S5 제거) | 최초 | 1 failed | 잠김 |
| P6 `:136` 모델 키 순서 뒤집기 | VP-03 선택 증거(S6) | 최초 | 1 failed | 잠김 |
| P6b `:136` `?? call?.toolUseId` 제거 | sweep — 규칙 칸 분기(diff 자리) | 최초 | 1 failed | 잠김 |
| P6c `:136` `task.toolUseId ??` 제거 | sweep — 규칙 칸 분기(diff 자리) | 최초 | 1 failed | 잠김 |
| P7 `:134` 카드 `call` → `callForBackgroundTask(state, task)` | VP-03 선택 증거(S7) | 최초 | 1 failed(`looks up the call…`) | 잠김 |
| P7b `:113` 거르기에서 호출·판정 재계산 | sweep — §10 자리(S7 형제) | 최초 | 1 failed | 잠김 |

- **분모 검산**: `선택 증거 20(EP-01 6 · EP-02 7 · EP-03 7) · 인용 변이 0 · 새 oracle 0 · sweep 15(EP-02 5 · EP-03 10) = 표 행 35`. 새 구조 oracle인 AC6 횟수 테스트의 민감도는 P7·P7b가 본다.
- **덮개 회귀**: 0건 — 이전 라운드가 없고 교체·삭제한 장치도 없다.
- 첫 P sweep 17건은 폐기하고 다시 돌렸다 — 원인은 Review Signals.

## [구현자 기입] Product/UX 파생 검토

### r1

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 문구·상태 없음 — 지운 54키는 읽는 곳 0(typecheck 오류 0) | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치는 `client()` 상수 둘을 bridge 확보 앞으로 올린 것뿐이다. `catch`가 보는 `bridge`·`server`는 그대로다(`adapter.ts:126·165·233`) | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 실패 경로 없음. `homedir()`가 던지면 bridge를 잡기 전에 거절된다 — §5 error 행·§13과 같다 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 해당 없음 — 실패 표시 경로 불변 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — 패널은 한 렌더 안 동기 계산, `client()` 상수는 호출마다 새로 만든다 | — |
| 로딩·빈 상태에서 무엇이 보이는가 | 변경 없음 — `rows`는 조기 반환(로딩·상세) 뒤에서 만든다(`…Content.tsx:90`) | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

### r1

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | strip 도구가 묶음의 마지막 잎을 지우면 앞 잎에 쉼표가 남는다 | ✅ 선조치 — `npm run lint`(prettier)가 파일당 5줄을 고쳤다 | `git diff --numstat` 두 파일 `6 65` · `keyset.mjs` 값 바뀜 0 |
| 2 | `backgroundStore.ts:73·75`에 같은 이중 호출 찾기가 있다 | ⚠️ 보고만 — 비귀속(0317 자리 목록 밖) | `git grep -n 'callForBackgroundTask(' -- src ':!*.test.*'` |
| 3 | 대화록 키의 `?? task.toolUseId` 폴백은 작업 카드에서 결과에 닿지 않는다(P2b 동치) | ⚠️ 보고만 — 변경 전부터 있던 항이고 지우면 범위 밖 감량이다(D-007) | `canonicalBackground.ts:92-101` |
| 4 | 이 Linux 환경은 변경 전에도 vitest 68파일 320케이스가 red다. 그중 `adapter.instances.test.ts`의 2케이스는 이번에 수정한 파일 안이다 | ⚠️ 보고만 — 두 조건 충족: 실패 집합 차집합 양방향 0 · 원인이 다른 OS 경로(`'C:/two'`를 Linux가 상대 경로로 해석) | 구현 보고 gate 행 |

### 설계 대비 명시적 차이

- EP-02 신규 케이스를 `adapter.test.ts`가 아니라 `adapter.instances.test.ts`에 뒀다 — S3 기존 좌표와 같은 `fixture()`(가짜 서버·`requests`)를 써야 요청 `directory`를 함께 볼 수 있다. §11의 `adapter*.test.ts` 범위 안이다.
- EP-03 S7을 `vi.spyOn`이 아니라 `vi.mock`으로 감싼 계수 래퍼로 관측한다 — ESM 이름 import는 `spyOn`으로 가로챌 수 없다. 래퍼는 원본을 그대로 부른다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 래퍼는 상태가 계수 하나뿐이다 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | `vi.mock`이 파일 전체에 걸려 같은 파일 42케이스가 모두 래퍼를 지난다. 계수는 S7 케이스가 렌더 직전에 0으로 되돌린다 | 파일 42 passed · P7·P7b red |
| 재진입 | 해당 없음 — 동기 렌더 | — |
| 다른 무효화 축 | `afterEach`의 `vi.restoreAllMocks()`가 래퍼를 풀지 않는다(`vi.fn`이 아닌 일반 함수) | 케이스 순서와 무관하게 42 passed |

## [구현자 기입] 구현 보고

### r1

| 항목 | 내용 |
|---|---|
| 변경 파일 | prod 4 — `ko.ts`·`en.ts`·`adapter.ts`·`CanonicalBackgroundContent.tsx` · test 2 — `adapter.instances.test.ts`·`CanonicalBackgroundContent.render.test.ts` · 문서 — 본 plan `[구현자 기입]`·`INDEX.md` |
| 실행 명령 | §19 목록 전부. 기준선은 `git worktree`로 설계 커밋(`3e7e6fc`) 트리에서 같은 `vitest run`을 돌렸다 |
| **관측한 게이트 산출**(마지막 수정 뒤) | `lint` error 0 · warning 2(기존 `react-hooks/incompatible-library` 2파일, 변경 밖) · `typecheck` 3종 오류 0 · 가드 4종 OK(`product-naming 2227파일` · `test-budgets 18 real-git suites ok`) · `node --test` 868 pass / 0 fail · `keyset.mjs` exit 0 |
| vitest(파일 필터 없음) | 944파일 8,844케이스 · red 68파일 320케이스. 기준선 944파일 8,837케이스 · red 68파일 320케이스. **실패 집합 차집합: head−base 0 · base−head 0.** 환경 서명: `Electron failed to install correctly` 20파일 · `better_sqlite3.node` ABI 7파일 · 나머지는 Windows 경로 단언 |
| **추가·수정 테스트의 subtree 규칙** | `git diff --name-only 3e7e6fc..HEAD -- '*.test.*'` → 2파일. 시간 값 0(`check-test-budgets` OK) · 호스트 격리 — `homedir()`·`process.env.XDG_STATE_HOME`은 setup의 임시 루트 값을 읽기만 한다 · 풀 — `adapter.instances.test.ts` io(기존) · `CanonicalBackgroundContent.render.test.ts` unit(자식 프로세스·git 없음). 두 파일의 가드 실패 0 |
| V-pair 자기확인 | `SELF_PASS 6 / SELF_BLOCKED 1`(VP-07 사람 실기) |
| 강제 지점 전수 | EP-01 110/110 · EP-02 5/5 · EP-03 7/7 |
| **AC 자기보고**(`Criteria-Met`) | 9/10 — 아래 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

| AC | 판정 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | `keyset.mjs 3e7e6fc` → 두 파일 `지운 잎 54 · 남은 승인 키 0 · 승인 밖 삭제 0 · 새 키 0 · 빈 묶음 0` · exit 0 |
| AC2 | ✅ | 같은 실행 `값 바뀜 0` · `ko↔en 키 집합 차이 0` · `vitest run src/renderer/src/shared/i18n` 2파일 18 passed |
| AC3 | ✅ | `typecheck` 오류 0 · `lint` error 0 · vitest 실패 집합 − 기준선 = 0줄 |
| AC4 | ✅ | `adapter.instances.test.ts` 신규 4케이스 + `'sends default POST…'` = 5 passed · A1~A12 red |
| AC5 | ✅ | `CanonicalBackgroundContent.render.test.ts` 42 passed(신규 3) · P 14건 red · 3건 동치 |
| AC6 | ✅ | `'looks up the call of each listed task at most once per render'` passed · P7·P7b red |
| AC7 | ✅ | `git diff --numstat 3e7e6fc..HEAD -- app/src ':!*.test.*'` → 4파일 `5 9`·`11 20`·`6 65`·`6 65`(추가 삭제) · `grep -cE '^[+-]export '` → 0 |
| AC8 | ✅ | `git diff --stat 3e7e6fc..HEAD -- …/GitContextBar.tsx` → 0줄 |
| AC9 | ✅ | `git log --name-only 3e7e6fc..HEAD -- app` → i18n 커밋 = 리소스 2파일만 · 코드 커밋 = `adapter.ts`·`…Content.tsx`와 그 테스트 2파일 |
| AC10 | ⚠️ | 사람 실기 대기 — 이 환경은 Electron 바이너리가 없어 `npm run dev`를 띄울 수 없다 |

- **합계 검산**: `✅ 9 · ⚠️ 1 · ❌ 0 = 총 10`.

## [구현자 기입] Review Signals — 사실만

### r1

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 — 첫 라운드.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 해당 없음.
- 반복해서 부딪히는 환경 한계: 2건. (1) 시간 초과로 백그라운드로 넘어간 `npm run lint`(`--fix`)가 그 사이 고친 테스트 파일을 옛 내용으로 덮어썼다 — 그 상태에서 돈 첫 P sweep은 oracle이 변이 전부터 red라 17건 모두 무효였고, 전체 vitest의 기준선 차집합(+1)에서 드러나 테스트를 복구한 뒤 sweep과 마지막 gate를 다시 돌렸다. (2) Linux에서 vitest 68파일이 변경 전부터 red다.
- 현재 라운드·impl 턴: `r1`(verify 0회).

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
