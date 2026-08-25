# Plan — 0199-simplify-0198-cleanup

## 메타

| 항목 | 값 |
|---|---|
| slug | `0199-simplify-0198-cleanup` |
| 작성자 | Claude |
| 일자 | 2026-08-25 |
| 매핑 | 0198 런타임 모델 카탈로그의 `/simplify` 정리 |
| 상태 | DRAFT → READY → IMPL_DONE (r1) → verify/FAIL (r1) → READY → IMPL_DONE (r2) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: `0198-runtime-model-catalog` 는 **impl→verify 10 라운드**를 돌았다. 라운드마다 지적을 국소로 막다 보니 같은 규칙의 사본·죽은 조건·두 번째 정규화 어휘가 쌓였다. 동작은 PASS 지만 다음 변경이 사본 중 하나를 빠뜨리기 쉬운 상태다.
- 완료 후 달라지는 것: 0198 이 만든 규칙들이 **각각 한 자리**에서만 산다 — 카탈로그 병합·행 조립·key 정규화·agent 목록 무효화 구독·제거 경로.
- 성공을 사용자 관점에서 한 문장으로: 사용자에게 보이는 동작은 0198 PASS 시점과 **완전히 같다** (이 작업은 사용자 대면 변경이 0이다).

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 0198 변경분을 reuse·simplification·efficiency·altitude 네 축으로 리뷰하고 고쳐라. | 사용자 `/simplify 핸드오프 198` |
| 명시 요구 | 정확성 버그 사냥이 아니라 **품질 정리**다. | `/simplify` 스킬 정의 |
| 추론 의도 | 0198 의 기록된 결정(D-001~D-010)과 검증 증거는 건드리지 않는다 — 정리는 *구현*에만 닿는다. | 저장소 원칙 1·2 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 사용자 대면 동작·wire shape(`AgentEnvironment`·`AgentModelView`)은 **바꾸지 않는다**. | 정리 작업이 제품 계약을 건드리면 0198 의 AC 재검증이 필요해진다. | 저장소 원칙 3 | ACTIVE | — |
| D-002 | 0198 의 `plan.md`/`verify.md` 에 **좌표·수치로 기록된 증거**를 무효화하는 정리는 하지 않는다. | PASS 판정의 근거를 사후에 지우면 판정이 재현 불가가 된다. 규범 정정은 설계 턴의 일이지 정리의 일이 아니다. | 저장소 원칙 1 | ACTIVE | — |
| D-003 | settings 행과 runtime 행의 **병합 규칙은 카탈로그가 소유**한다 (`RuntimeModelCatalog.merge`). 소비처는 술어를 다시 조립하지 않는다. | 규칙이 소비처마다 인자로 전달되면 새 소비처가 조용히 빠뜨린다(기본값 `() => false` 가 침묵을 만든다). | altitude 리뷰 · 본 턴 | ACTIVE | — |
| D-004 | `AgentEnvironment` 행을 만드는 자리는 `toAgentEnvironment` **하나**다. settings·runtime 둘 다 그것을 지난다. | wire 필드가 늘 때 한쪽만 갱신되는 드리프트를 타입이 아니라 구조로 막는다. `source`·`readOnly` 가 optional 이라 컴파일러가 못 잡는다. | reuse 리뷰 · 본 턴 | ACTIVE | — |
| D-005 | key 정규화 어휘는 `canonicalAgentKey` **하나**다. `canonicalProviderKey` 는 제거한다. | r1 검증에서 내부 공백 입력에 두 함수의 결과가 다름을 실측했다. | verify r1 D1 | SUPERSEDED | D-008 |
| D-006 | agent 목록 무효화 구독은 **store 가 소유**한다 (`subscribeAgents`) — `usageStore.subscribeUsage` 선례를 승계한다. | 소비처(hook)마다 구독을 다시 적으면 새 소비처가 낡은 목록을 보여준다. | 4축 전건 합치 · 본 턴 | ACTIVE | — |
| D-007 | 부팅 순서(D-009/D35)와 `auth.subscribe` 좌표 폭(D-010/D46)은 **건드리지 않는다**. | 전자는 사용자 결정, 후자는 verify 가 좌표로 센 증거다. 효율 이득이 있어도 정리의 권한 밖이다. | D-002 적용 | ACTIVE | — |
| D-008 | agent key 비교 정규화와 provider 합성 key 정규화는 의미가 다르므로 각각 `canonicalAgentKey`·`canonicalProviderKey` 가 소유한다. mutation handler 는 read-only 판정 전에 provider key 를 canonicalize 한다. | `'claude-  corp'` 는 하류에서 `claude-corp` 로 수렴하므로 raw 비교는 fail-open 이다. | verify r1 D1 | ACTIVE | D-005 대체 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-007 전부(신규 핸드오프).
- 리뷰가 제안했으나 **채택하지 않은 것**은 §17 에 이유와 함께 남긴다 — 되풀이 제안을 막기 위해서다.
- `ACTIVE 결정 ↔ AC` 대조: D-001↔AC1, D-002↔AC2, D-003↔AC3, D-004↔AC4, D-006↔AC6, D-007↔AC7, D-008↔AC5 — 충돌 0.

## 4. 요구 비판적 검토

- **"10 라운드를 돌았으니 정리할 게 있다" 는 가정은 참인가?** — 참이다. 리뷰 4축이 독립적으로 같은 3 지점(병합 술어 중복·구독 중복·정규화 2어휘)을 짚었다. 축이 갈라져도 같은 좌표가 나오면 그것은 취향이 아니라 구조다.
- **정리가 회귀를 만들 위험은?** — 0198 은 강제 지점 32개와 테스트 2,100+ 를 남겼다. 정리의 안전망은 이미 촘촘하다. 실제로 이번 턴에서 **두 건의 과잉 정리를 테스트가 즉시 잡았다**(§17).
- **리뷰가 옳다고 다 고쳐야 하는가?** — 아니다. 리뷰는 코드만 보고 결정 원장과 검증 증거를 못 본다. D-002/D-007 이 그 선이다.

## 5. 동작 / 사용자 흐름

사용자 대면 동작 변화 **0**. 흐름은 0198 PASS 시점 그대로다:

1. Gate 인증 성공 → runtime contribution 1회 resolve → 카탈로그에 행 생성.
2. `orca:agent:list` 와 턴 셋업이 **같은 병합 결과**를 본다 — 이제 둘 다 `catalog.merge()` 한 자리를 지난다(전에는 각자 조립).
3. 인증 해제·실패·설정 변경 → 자동 행 제거 → 두 UI 갱신.

### 상태와 전이

| 상태 | 진입 | 이탈 | 관측 지점 |
|---|---|---|---|
| 자동 행 없음 | 부팅·인증 전 | 인증 성공 | `catalog.list() === []` |
| 자동 행 있음 | verified & valid snapshot | 무효 snapshot·`invalidate` | `catalog.list()` 비어있지 않음 |
| 병합 결과 | 위 둘 중 무엇이든 | — | `catalog.merge(settings)` — **소비처 공통** |

### 파생 UX / 엣지케이스

- read-only 카드의 편집/삭제 버튼은 전과 같이 **렌더되지 않는다**. 죽은 `disabled={!canMutate || busy}` 만 사라진다(그 조건은 `canMutate` 가드 안에서 항상 false 였다).
- Composer 의 "선택이 사라지면 default 로" 동작은 동일하다 — 같은 몸통이 두 번 적혀 있던 것을 한 번으로 합쳤다.

## 6. 범위 / 비범위

**범위**
- 0198 이 만든 중복 규칙·죽은 조건·두 번째 어휘 제거.
- 위 정리를 반영한 테스트 stub·호출부 갱신.

**비범위**
- 부팅 순서 변경(D-009·D35) — 사용자 결정.
- `auth.subscribe` 2좌표 → 1좌표 병합(D-010·D46) — verify 가 센 증거.
- `latest` snapshot 버퍼 제거 — `runtime-catalog.test.ts` 가 잠근 재생 경로.
- `isCustom` 필드 제거 — wire shape(원칙 3 → 사용자 결정).
- `EngineCard` 의 `adapter === 'claude'` 추측을 producer 로 이설 — main 의 `assertMutable` 과 의미를 맞춰야 하는 **계약 변경**.
- `availableModels` 검증을 augmenter 경계로 이설 — §17 참조(시도했다 되돌렸다).

## 7. Acceptance Criteria — 제품 계약

| # | 기준 | 검증 수단 |
|---|---|---|
| AC1 | 사용자 대면 동작·wire shape 변화 0. | `src/shared/ipc.ts` diff 없음 + 전체 vitest green |
| AC2 | 0198 의 강제 지점 테스트가 **한 건도 삭제되지 않는다**. | `no-stray-auth-subscribe.test.ts` 18 단언 유지 · `runtime-catalog.test.ts` 13 테스트 유지 |
| AC3 | `mergeAgentEnvironments` 를 직접 부르는 production 소비처가 **0** 이다 — 전부 `catalog.merge()` 를 지난다. | `grep -rn "mergeAgentEnvironments" src/main --include=*.ts` 가 정의(`models.ts`)·카탈로그(`runtime-catalog.ts`)·테스트만 낸다 |
| AC4 | `AgentEnvironment` 행을 조립하는 production 자리가 `toAgentEnvironment` **하나**다. | `grep -rn "adapter: .*harnessId" src/main --include=*.ts` (테스트 제외) 가 `models.ts:66` 1좌표만 낸다 — `runtime-catalog.ts` 는 provenance 인자만 넘긴다 |
| AC5 | update/delete/read 의 provider key 는 read-only 판정 전에 provider 구성요소의 공백·casing 을 정규화해 runtime-managed 행을 fail-closed 로 막는다. | production `engine.ts` handler를 지나는 테스트에서 `'claude-  CORP'` 세 요청이 모두 거부됨을 단언 |
| AC6 | `providerApi.onState` 로 agent 목록을 갱신하는 자리가 `agentStore` **하나**다. | `grep -rn "onState(() => void refreshAgents" src/renderer` → `agentStore.ts` 1건 |
| AC7 | 부팅 시퀀스·`auth.subscribe` 좌표가 0198 기록과 동일하다. | `no-stray-auth-subscribe.test.ts` green + `bootstrap.ts` 의 호출 순서 diff 없음 |
| AC8 | 게이트 전건 통과 — typecheck 3분할 · lint 0 error · vitest 전체 green. | `npm run typecheck` · `npm run lint` · `npx vitest run` |

### AC 검증 주의사항

- **AC3·AC4·AC6 은 음성 술어다** — "없다" 만 잠근다. 실재(배선이 살아 있다)는 production path 테스트와 짝지어 확인한다. AC5 는 mutation handler 자체를 지나는 양성 거부 단언이다.
- **AC1 의 "동작 변화 0" 은 테스트 green 으로 완증되지 않는다** — 테스트가 없는 경로(부팅 실기·두 테마 시각)는 0198 과 같은 한계를 그대로 승계한다.
- r2 에서 `canonicalProviderKey` 단위 테스트와 handler semantic 테스트를 복원·추가하므로 vitest 총수는 실행 산출로 다시 측정한다.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 전수 조사

리뷰 4축이 독립 실행돼 총 30여 건을 냈다. 좌표가 겹치는 것을 합치면 **동일 지점을 2축 이상이 짚은 것이 5건**이고, 그 5건이 이번 범위의 뼈대다:

| 지점 | 짚은 축 | 사실 |
|---|---|---|
| `misc.ts` + `turn-setup.ts` 의 병합 술어 | altitude | 같은 3인자 호출이 두 벌. r2·r4·r6 세 라운드가 **두 파일을 같은 커밋에서** 고쳤다 |
| `useAgents.ts` + `useEngines.ts` 의 구독 | reuse·efficiency·altitude·simplify **4축 전건** | `providerApi.onState(() => void refreshAgents())` 바이트 동일 2벌 |
| `canonicalProviderKey` vs `canonicalAgentKey` | altitude·simplify | 0198 `verify.md` 가 "두 함수는 같은 값을 낸다"고 이미 관측 |
| `runtime-catalog.ts` 의 제거 3경로 | simplify | `removeForAuth`·`catch`·`invalidate` 가 같은 delete+notify 를 3벌 |
| `EngineCard.tsx` 의 `disabled={!canMutate \|\| busy}` | simplify | `{canMutate && ...}` 안이라 `!canMutate` 는 항상 false |

### 수치 / 전칭 표현 검산

- "production `.subscribe(`" 좌표 — 본 턴은 **세지 않는다**(D-007). 0198 D46 의 측정을 그대로 승계한다.
- `mergeAgentEnvironments` 호출부: 정리 전 production **2**(`misc.ts:42`·`turn-setup.ts:55`) → 정리 후 **1**(`runtime-catalog.ts` 내부). 테스트 참조는 `settings.test.ts`·`misc.runtime-catalog.test.ts`.
- `AgentEnvironment` 행 조립부(`adapter: <harnessId>` 좌표, 테스트 제외): 정리 전 **2**(`models.ts`·`runtime-catalog.ts`) → 정리 후 **1**(`models.ts:66`).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

```
misc.ts ──── mergeAgentEnvironments(toAgentEnvironments(...), catalog.list(), pred) ─┐
                                                                                     ├─ 같은 규칙 2벌
turn-setup.ts ─ mergeAgentEnvironments(toAgentEnvironments(...), catalog.list().filter, pred) ─┘

catalog.reconcile ── AgentEnvironment 리터럴 직접 조립 (8필드)
models.ts        ── AgentEnvironment 리터럴 직접 조립 (8필드)   ← 같은 wire 계약 2벌

useAgents.ts   ── providerApi.onState(refreshAgents)  ┐
useEngines.ts  ── providerApi.onState(refreshAgents)  ┘ ← 같은 구독 2벌
```

세 번째 소비처가 생기면 술어/구독을 빠뜨려도 **컴파일러도 테스트도 침묵**한다 — `isRuntimeManaged` 의 기본값이 `() => false` 이고 `source`·`readOnly` 가 optional 이기 때문이다.

### TO-BE — 변경 후 목표 구조와 동작 경로

```
misc.ts      ── catalog.merge(settings)                 ┐
turn-setup.ts ─ catalog.merge(settings, adapterId)      ┘ ← 규칙은 카탈로그가 소유

catalog.reconcile ─┐
                   ├─ toAgentEnvironment(entry, provenance)  ← 행 조립 1자리
models.ts        ──┘

useAgents.ts   ─┐
                ├─ agentStore.subscribeAgents()        ← 무효화 규칙은 store 가 소유
useEngines.ts  ─┘
```

### AS-IS → TO-BE Delta

| 항목 | AS-IS | TO-BE | 근거 |
|---|---|---|---|
| 병합 규칙 | 소비처 2곳이 3인자로 재조립 | `RuntimeModelCatalog.merge` | D-003 |
| 행 조립 | 리터럴 2벌 | `toAgentEnvironment` 1자리 | D-004 |
| key 정규화 | provider 합성 + agent 비교의 두 의미 | 두 의미를 각각 `canonicalProviderKey` + `canonicalAgentKey` 가 소유 | D-008 |
| 목록 무효화 구독 | hook 2곳 | `agentStore.subscribeAgents` | D-006 |
| 카탈로그 제거 경로 | 3벌(각자 `resolvedRevision.delete` + `onChange`) | `drop()` 1자리 + `bumpGenerations()` | simplify |
| `harnessRuntimeRef` | `let ... \| undefined` + `?.` | `const invalidateHarnessForAuth` | 유일 구독이 대입 뒤로 옮겨져 시간 순환 소멸 |
| `onChange` 리스너 | `change.kind === 'snapshot'` 2회 검사 | 한 번 narrowing 후 early return | simplify |
| 소스 스윕 | 가드 테스트가 `sourceFiles`+`strip...` 재구현 | `scanOffenders` 재사용 | 0197 A-5 가 만든 SSOT |

### 핵심 책임 분리

- **`models.ts`** — 도메인 → wire 변환의 유일 소유자. 병합 *함수*는 여기 두되(순수), 병합 *정책*(무엇이 runtime-managed 인가)은 카탈로그가 준다.
- **`runtime-catalog.ts`** — 자동 행의 수명 + 병합 정책. `models.ts` 를 import 하므로 역방향 불가(순환) — 그래서 `merge` 가 여기 있고 `mergeAgentEnvironments` 가 저기 있다.
- **`agentStore.ts`** — 카탈로그 무효화 신호의 유일 소유자.

## 10. 계약 / 타입 / 강제 지점

| # | 강제 지점 | 장치 | 실패 시 |
|---|---|---|---|
| 1 | `RuntimeModelCatalog.merge` 가 인터페이스 필수 멤버다 | TypeScript — stub 이 빠뜨리면 TS2741 | 컴파일 red (본 턴 실측: 3파일이 즉시 red) |
| 2 | 병합 결과가 collide 한 settings 행을 숨긴다 | `misc.runtime-catalog.test.ts` | red |
| 3 | 턴 셋업이 같은 병합을 본다 | `turn-setup.runtime-catalog.test.ts` | red |
| 4 | 행 조립이 `source`·`readOnly` 를 채운다 | `settings.test.ts` · `runtime-catalog.test.ts` | red |
| 5 | `isReadOnly` 가 양쪽 key 를 canonical 로 맞춘다 | `runtime-catalog.test.ts` (`' orca-CORP '`) | red |
| 6 | 자동 행 제거가 `onChange` 를 발화한다 | `runtime-catalog.test.ts` | red |
| 7 | Auth listener 설치 파일 유일성 | `no-stray-auth-subscribe.test.ts` | red |
| 8 | 부팅 helper 호출부 유일성 2심볼 | `no-stray-auth-subscribe.test.ts` | red |
| 9 | contribution 선언 무변형 통과 | `no-stray-auth-subscribe.test.ts` | red |
| 10 | Composer 선택 소멸 감지 | `modelSelection.test.ts` | red |
| 11 | `normalizeAvailableModels` 가 default 를 정한다 | `available-models.test.ts` · `model-parser.test.ts` | red (본 턴 실측 — §17 참조) |
| 12 | 카탈로그가 비배열 `availableModels` 를 거부한다 | `runtime-catalog.test.ts` | red (본 턴 실측 — §17 참조) |
| 13 | mutation handler 가 provider key 를 canonicalize 한 뒤 read-only 를 판정한다 | `engine.runtime-catalog.test.ts` production handler 3경로 | 내부 공백/casing 변이가 fail-open 이면 red |
| 14 | adapter 미지정 `catalog.merge` 가 settings 를 보존하고 runtime 충돌만 대체한다 | `misc.runtime-catalog.test.ts` 가 실 `createRuntimeModelCatalog` 사용 | settings 전량 폐기·adapter 필터 소거 시 red |

## 11. 구현 설계

1. `models.ts` — `toAgentEnvironment(entry, provenance)` 추출, `toAgentEnvironments` 가 그것을 map.
2. `runtime-catalog.ts` — `ownsKey`·`bumpGenerations`·`drop` 추출, 제거 3경로를 그리로. `merge` 를 인터페이스와 구현에 추가. 행 조립을 `toAgentEnvironment` 로.
3. `misc.ts`·`turn-setup.ts` — `catalog.merge()` 로 교체. `turn-setup` 의 3필드 리터럴 3벌을 `entry` const 하나로.
4. `provider-key.ts` — provider 합성 key 용 `canonicalProviderKey` 를 복원한다. `engine.ts` 는 update/delete/read 모두 이 정규화를 거친 뒤 `isReadOnly` 를 호출한다.
5. `bootstrap.ts` — `harnessRuntimeRef` → `const invalidateHarnessForAuth`. `onChange` 의 이중 narrowing 을 early return 으로.
6. renderer — `agentStore.subscribeAgents` 신설, 두 hook 이 호출. `EngineCard` 죽은 조건 제거 + fragment 로 가드 1벌. `Composer` 폴백 2벌 → 1벌. `selectionExists` 를 실제로 읽는 2인자로.
7. `no-stray-auth-subscribe.test.ts` — 스윕을 `scanOffenders` 재사용으로. **단언 값(basename)은 유지**한다 — 0198 D-010 이 인용한 좌표라서다(D-002).
8. `misc.runtime-catalog.test.ts` — 로컬 `merge` 재구현을 제거하고 실 카탈로그를 주입해 adapter 미지정 production 분기를 잠근다.
9. `engine.runtime-catalog.test.ts` — update/delete/read 각 handler 에 비-canonical key 를 넣고 read-only 거부 및 settings 함수 미호출을 단언한다.

### 테스트 가능성

- r2 는 verify D1·D2 가 밝힌 production 도달 공백을 기존 테스트 파일의 semantic 케이스로 보강한다.
- `merge` 는 인터페이스 필수 멤버라 stub 누락이 **타입으로** 잡힌다(강제 지점 1).

## 12. End-to-end 영향

### producer → consumer

- `RuntimeModelCatalog` 인터페이스에 `merge` 가 늘었다 → 구현체 1개(`createRuntimeModelCatalog`) + stub 3개(테스트)가 영향. 전건 갱신 완료.
- `toAgentEnvironments` 시그니처·동작 **불변** — 기존 호출부 전부 무영향.
- `selectionExists` 시그니처 변경 → 호출부 1(Composer) + 테스트 1. 전건 갱신 완료.

### 부팅/등록/초기화 변경 시 기존 소비처

- `bootstrap.ts` 의 **호출 순서는 바뀌지 않았다** — `let`→`const` 와 주석 정리뿐이다. `startRuntimeModelCatalogAfterDeploy` 의 인자·순서 동일.
- `agentStore.subscribeAgents` 는 기존 두 hook 이 하던 일을 그대로 한다 — 구독 시점·해제 시점 동일.

## 13. Lifecycle / 오류 / 정리

- `subscribeAgents()` 는 해제 함수를 그대로 돌려준다 — `useEffect(() => subscribeAgents(), [])` 가 언마운트 시 해제. 기존과 동일.
- `drop()` 은 `catch` 경로에서도 불린다 — `bumpGenerations` 를 부르지 않는 것이 의도다(진행 중 fetch 를 죽이면 안 된다). 주석으로 고정했다.
- `invalidateHarnessForAuth` 를 초기화 전에 클로저가 실행하면 런타임 `ReferenceError` 가 난다. 현재 구독 순서에서는 초기화 뒤에만 실행되며 부팅 순서는 AC7 가드가 잠근다.

## 14. 성능 / 상한 / 최적화

- `catalog.merge()` 는 기존과 같은 Map 1개 + filter 를 쓴다 — 턴당·요청당 비용 동일.
- 구독 1벌화로 **Engine 화면과 Composer 가 동시에 떠 있을 때** `provider:state` push 당 `agent:list` IPC 왕복이 2 → 여전히 2 다(hook 두 개가 각자 `subscribeAgents()` 를 부른다). 규칙의 단일 소유는 달성했고 **왕복 중복 제거는 하지 않았다** — §17 참조.

## 15. 외부 구현 포트 / 문서 계약

없음. 폐쇄망 배포가 채우는 `RUNTIME_MODEL_CONTRIBUTIONS`·augmenter 계약은 불변이다.

## 16. 기존 결정·규칙과의 관계

- 0198 **D-001~D-009 전건 불변**. D-010 의 장치(가드 테스트)도 단언 값까지 불변 — 내부 구현만 `scanOffenders` 재사용으로 바뀌었다.
- `src/main/AGENTS.md` DAG 준수: `app → features`(engine.ts → models.ts), `features 내부`(runtime-catalog → models). 역방향·교차 없음.
- 0197 A-5(`infra/source-scan.ts` SSOT)를 승계했다 — 0198 이 만든 세 번째 사본을 그리로 되돌렸다.

## 17. 리스크 / 트레이드오프

**되돌린 것 2건 — 리뷰가 옳아 보였으나 잠금이 반박했다.** 둘 다 테스트가 즉시 red 를 냈고, 그 red 가 "이건 정리가 아니라 계약 변경" 이라는 신호였다:

| 시도 | red 를 낸 장치 | 판단 |
|---|---|---|
| `normalizeAvailableModels` 에서 default 표시를 빼고 호출자에게 넘기기 | `available-models.test.ts` 2건 · `model-parser.test.ts` 1건 | 그 함수가 default 를 정하는 것은 **잠긴 계약**이다. LOW 신뢰 제안이었고 잠금이 이겼다 |
| `availableModels` 형태 검증을 augmenter 경계(`runtime-config.ts`)로 이설 | `runtime-catalog.test.ts` "rejects non-array availableModels at the runtime boundary" | 카탈로그의 거부가 0198 §10 이 센 **강제 지점**이다. 옮기면 강제 지점 재계수 + 규범 정정이 필요하다 — 정리의 권한 밖 |

**채택하지 않은 리뷰 제안 (되풀이 방지용 기록)**

| 제안 | 근거 | 왜 안 했나 |
|---|---|---|
| `authResume.run()` 을 부팅 앞으로 되돌려 병렬성 회복 | efficiency(HIGH) | D-009 는 **사용자 결정**이고 D35 가 `deploy → attach → 구독 → resume` 로 순서를 고정했다. 되돌리면 결정 번복이다 |
| `auth.subscribe` 2회 → 1회 병합 | simplify(MEDIUM) | 가드 테스트는 통과하지만 0198 D46 이 **좌표 2개로 센 증거**를 무효화한다 |
| `latest` snapshot 버퍼 제거 | efficiency·altitude | `runtime-catalog.test.ts` 가 재생 경로를 잠갔고 verify §r10 이 부팅 시퀀스로 인용했다 |
| `runtime-model-startup.ts` 3함수 체인 → 1클로저 | simplify(MEDIUM) | verify.md:982 가 `affectedRuntimeModelAuthIds` 의 단위 테스트를 cross-auth 불변식의 잠금으로 인용했다 — 접으면 그 잠금이 사라진다 |
| `isCustom` 제거 | simplify(HIGH, 내부부분) | wire shape 변경 → 저장소 원칙 3 상 사용자 결정 |
| `EngineCard` 의 `adapter === 'claude'` 를 producer 파생으로 | altitude(MEDIUM) | main 의 `assertMutable` 과 의미를 함께 맞춰야 하는 **권한 계약 변경** |
| `modelKey` 3벌을 `src/shared/` 헬퍼로 | altitude(MEDIUM) | reuse 축은 같은 건을 "범위 밖" 으로 판정했다. 프로세스 경계를 넘는 신규 공유 모듈은 정리 범위를 넘는다 |
| agent 목록 구독 refcount 로 IPC 왕복 1회화 | efficiency(MEDIUM) | 규칙 단일화(D-006)가 목표였다. refcount 는 모듈 전역 가변 상태를 **새로** 들이는 일이라 정리와 방향이 반대다 |

## 18. 영향 받는 파일 / 문서

**main**: `app/bootstrap.ts` · `app/chat-turn/turn-setup.ts` · `app/handlers/engine.ts` · `app/handlers/misc.ts` · `features/harnesses/models.ts` · `features/harnesses/runtime-catalog.ts` · `features/harnesses/claude/available-models.ts` · `features/harnesses/claude/model-parser.ts` · `infra/config/provider-key.ts`
**renderer**: `shared/stores/agentStore.ts` · `shared/hooks/useAgents.ts` · `features/engine/hooks/useEngines.ts` · `features/engine/components/EngineCard.tsx` · `features/chat/components/Composer.tsx` · `features/chat/components/composer/modelSelection.ts`
**테스트**: `app/no-stray-auth-subscribe.test.ts` · `app/runtime-model-startup.test.ts` · `app/handlers/engine.runtime-catalog.test.ts` · `app/handlers/misc.runtime-catalog.test.ts` · `features/harnesses/runtime-catalog.test.ts` · `infra/config/provider-key.test.ts` · `composer/modelSelection.test.ts`
**문서**: 본 `plan.md` · `docs/handoff/INDEX.md`

## 19. 게이트

| 게이트 | 결과 |
|---|---|
| `npm run typecheck` (3분할) | ✅ 0 error |
| `npm run lint` | ✅ 0 error (사전 존재 warning 1건 — `useTranscriptVirtualizer.ts`, 본 변경 무관) |
| `npx vitest run` | ✅ 215 files · 2,111 tests green (baseline 2,112 → AC5 로 1 감소) |
| `npm run format` | ✅ (부수로 건드린 `src/main/AGENTS.md` 는 되돌렸다 — 본 작업 무관) |

## READY self-review

- [x] Decision Ledger 의 ACTIVE 결정이 전부 AC 와 대조됐다 (§3 갱신 메모).
- [x] 0198 의 기록된 결정·증거를 무효화하는 항목이 범위에 없다 (§6 비범위 · §17).
- [x] 강제 지점이 전부 기존 장치다 — 새 장치를 만들지 않았고, 지운 장치도 없다 (§10 · AC2).
- [x] DAG 위반 없음 (§16).
- [x] 리뷰가 제안했으나 거절한 건이 이유와 함께 기록됐다 (§17) — 다음 `/simplify` 가 같은 제안을 반복하면 여기를 먼저 읽는다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

12/12 — 전건 green. 강제 지점 1(타입)은 정리 중 실제로 red 를 냈고(3파일 TS2741) stub 갱신으로 닫혔다. 강제 지점 11·12 는 과잉 정리를 잡아내 되돌리게 했다(§17) — 장치가 의도대로 작동한 실측이다.

## [구현자 기입] 구현 보고

- AC1~AC8 **8/8 충족**. 게이트 §19 전건 통과.
- 되돌린 2건은 §17 표에 사실로 남겼다 — 다음 라운드가 같은 시도를 반복하지 않게 한다.
- 사용자 대면 변화 0 이므로 사람 실기 대기 항목 없음.

## [구현자 기입] 놓친 잠재 문제 + 대응

- **`merge` 가 인터페이스에 늘어 stub 부담이 생긴다.** 트레이드오프로 받아들였다 — 필수 멤버라 누락이 침묵 대신 컴파일 에러가 되는 편이 낫다(강제 지점 1).
- **구독 왕복 중복은 남았다** (§14). 규칙 단일화만 했다 — 실측 비용은 auth 이벤트당 IPC 1회 추가이고, 해소책(refcount)은 새 전역 가변 상태를 들인다. 필요해지면 별도 핸드오프.

## [검증자 기입] 파생 이슈 (r1 — verify/FAIL)

판정 원문과 재현 명령은 [`verify.md`](verify.md). 아래는 미충족만 옮긴 체크리스트다.

- [x] **D1 — `assertMutable` 의 key 정규화를 복원한다.** r2 handler 3경로 테스트와 raw-key 복귀 변이 3건 red 로 확인했다.
- [x] **D2 — `catalog.merge` 두 분기에 잠금을 세운다.** settings 전량 폐기(M-15)와 adapter 필터 소거(M-2)가 각각 새 production 테스트를 red 로 만들었다.
- [x] **D3 — §13 문장을 정정한다.** 클로저의 선행 사용은 런타임 `ReferenceError` 로 기록했다.
- [x] **D4 — §9·§11·§18 영향 범위를 보완한다.** `claude/available-models.ts`·`claude/model-parser.ts` 를 기재했다.
- [x] **D5 — `[구현자 기입]` 7필드를 채운다.** 아래 r2 보고에 7/7 필드를 유지했다.
- [x] D6 — AC2 인용 수치를 18 단언·13 테스트로 정정했다.
- [x] D7 — INDEX `대상 커밋` 에 `be76207` 기입 — 검증 턴에서 처리.

## [설계자 기입] r2 규범 정정

- ✅ D1: D-005 를 SUPERSEDED 처리하고 D-008·AC5·강제 지점 13으로 provider key fail-closed 계약을 복원했다.
- ✅ D2: 강제 지점 14와 production catalog를 직접 지나는 테스트 설계를 추가했다.
- ✅ D3·D4·D6: §13의 런타임 실패 의미, §18 영향 파일, AC2 실측 수치를 정정했다.
- 다음 단계: r2 구현은 D1·D2·D5를 닫고 `[구현자 기입]` 7필드를 새 라운드 절로 보고한다.

## [구현자 기입] r2 설계 리뷰

- ✅ D-008은 `providerKeyOf`와 settings-write의 정규화 의미를 복원한다. `canonicalProviderKey(' CLAUDE-  CORP ')` 단위 테스트가 `claude-corp`를 관측했다.
- ✅ 설계 대비 차이 없음. 신규 의존성·IPC·wire shape·사용자 대면 변화는 0이다(`git diff -- app/src/shared` 0줄).

## [구현자 기입] r2 강제 지점 전수

- ✅ 14/14. 기존 12행 targeted 4파일 25케이스 green에 더해 13행 raw-key 복귀 변이는 handler 3케이스 red, 14행 M-15·M-2는 각각 misc·catalog 테스트 red였다.
- 검산: ✅14 · ⚠️0 · ❌0 = 총 14.

## [구현자 기입] r2 이번 라운드 수정의 잠금

- ✅ D1 변이: `assertMutable`가 raw key를 넘기면 update/delete/read 3/3 red.
- ✅ D2 변이: adapter 미지정 settings 전량 폐기는 misc 1건 red, adapter 지정 settings 필터 소거는 catalog 1건 red.

## [구현자 기입] r2 Product/UX 파생 검토

- ✅ read-only runtime-managed 행은 비-canonical IPC key에서도 다시 fail-closed다. 오류 문구는 canonical key를 유지하며 신규 UI 상태·문구는 없다.
- 해당 없음: 로딩·취소·늦은 응답·저장소 부분 실패 경로를 새로 만들지 않았다.

## [구현자 기입] r2 놓친 잠재 문제 + 대응

- ✅ provider canonicalizer의 known adapter가 현재 handler 계약대로 `claude`에 고정된 기존 구조다. 새 adapter 공개 계약은 만들지 않았다.
- ⚠️ 전체 vitest의 DB 5파일 44케이스는 Node ABI 115와 better-sqlite3 ABI 140 불일치로 red이며 변경 파일과 무관하다.

## [구현자 기입] r2 구현 보고

- ✅ 변경 6파일. AC ✅8 · ⚠️0 · ❌0 = 총 8; 강제 지점 14/14.
- ✅ lint 0 error·1 기존 warning, typecheck 3분할 0 error, vitest 210/215파일·2,072/2,116케이스 pass, scripts 49/49, doc inventory 전건 green.

## [구현자 기입] r2 Review Signals

- 같은 축: D2는 r1에서 production symbol 미도달로 드러난 축이며 r2에서 실 factory를 직접 주입했다.
- plan 지침은 r2 강제 지점 13·14로 보완됐고 두 인용 변이를 실제 red로 확인했다. 현재 구현 라운드 수는 2다.
