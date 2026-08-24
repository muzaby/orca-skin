# Verify — runtime-model-catalog

> 라운드별 판정을 누적한다. **이전 라운드 원문은 아래에 그대로 보존하고 재서술하지 않는다.**

## 메타

| 항목 | 값 |
|---|---|
| slug | `0198-runtime-model-catalog` |
| 검증자 | Claude Code |
| 일자 | 2026-08-24 |
| 대상 커밋/range | `4be8f95..176a73f` (r5 구현) · 라운드 이력 `803bd50`(r1) · `8e17aae`(r3) · `4be8f95`(r4) |
| 구현 전 plan 기준 | **부분 성립** — `176a73f`가 D-008(규범 행)을 구현과 같은 커밋에서 고쳤다(r5 §0) |
| 라운드 | 5 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude Code |

---

# 라운드 5 — FAIL

## 0. 기준선 / plan 변경 확인

- **기준선이 diff로 성립하는가: 부분 — AC·§10 축은 잠겼고 Decision 축은 잠기지 않았다.**
- **AC·§10 변경 0건.** `git diff 4be8f95..176a73f -- …/plan.md`에서 AC 행·§10 행 hunk가 없다. 채점은 현행 AC1~AC14 원문으로 한다.
- **D-008(ACTIVE Decision)이 구현 커밋 안에서 바뀌었다.** 같은 `176a73f`가 D-008 본문·`갱신 메모`·파생 이슈 상태 8칸·r5 절을 함께 담는다 — `handoff-impl`의 "규범 행 정정은 구현과 다른 커밋"을 어겼다. r3의 D15(`8e17aae`에 규범 행 혼입)와 같은 축이다.
- **D-008 변경의 근거는 사용자 결정으로 기록돼 있다.** 파생 이슈 D18 행이 `**사용자 결정 A:** cache와 catalog entry를 함께 제거`로 적혔고 r4 verify §13이 그 갈림길을 제품 결정으로 올렸다. 저장소 안에서 확인할 수 있는 것은 여기까지다 — 결정 자체는 검증자가 재현할 수 없다.
- Decision Ledger: D-001~D-008 ACTIVE 유지, SUPERSEDED 0건.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | `availableModels: string[]`만 인정 | 검증자 재측정 10형태 × 2 producer 전건 0개(§7) ✅ |
| D-002 | 같은 family 복수 항목 보존 | `['claude-sonnet-a','claude-sonnet-b']` 2행 유지 ✅ |
| D-003 | family 표시 `custom` · 실행값 self | `alias='custom'`·`model='corp-private-v1'`, title/선택 helper 3종 모두 self ✅ |
| D-004 | 정적·동적이 같은 정규화 규칙 | 8배열 `toEqual` · default 각 1개(§7) ✅ |
| D-005 | 인증 성공 → read-only 항목 생성 | `runtime-catalog.ts:101` `readOnly:true` ✅ |
| D-006 | `AuthRuntime.subscribe` 트리거 | `bootstrap.ts:385` 구독 · `:497` attach ✅ |
| D-007 | 두 UI가 같은 카탈로그 소비 | `misc.ts:42`·`turn-setup.ts:56` 같은 `mergeAgentEnvironments` ✅ |
| D-008 | 무효화되면 두 UI에서 숨긴다 | **부분** — contribution 단독 key는 숨겨지지만 settings 디렉터리가 같이 있으면 유령이 남는다(D25) ❌ |

### end-to-end 흐름

```text
settings.json → parseClaudeModels ─┐
                                    ├→ mergeAgentEnvironments(canonical key) → agent:list → EngineCard / ModelMenu
AuthChange(verified) → bridge → catalog.reconcile → runtime.resolve ─┘
                                                            ↓
   settings CRUD  → engine.ts:38 runtime.invalidate + :39 catalog.invalidate ─┐
   부팅 deploy    → bootstrap.ts:640 runtime.invalidate + :641 catalog.invalidate ─┤→ entry 제거
                                                            ↓
      turn-setup: isReadOnly(선언 기준) ? harnessRuntime.cached() : resolve()
                                                            ↓
                              cached() === undefined → throw "Runtime model cache is unavailable"
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | **중대 결함 2건** | 부팅에서 Gate 인증 fetch 결과가 지워진다(D24) · settings 디렉터리가 같이 있으면 D18 유령이 그대로 재현된다(D25). |
| false success 가능성 | **있음 — 검사 장치** | r5가 고친 두 배선(`engine.ts:39`·`bootstrap.ts:641`)을 지워도 대상 401케이스가 전건 통과한다(변이 M-E·M-F, §7). |
| partial failure/rollback | 정상 | reject는 해당 contribution만 제거하고 형제는 남는다(§7 AC7 재측정). |
| Product/UX의 A가 아닌 B를 구현했는가 | **부분** | 사용자 결정 A(미노출)를 catalog entry에만 적용했다. 같은 key의 settings 행은 노출된 채 남고 실행만 죽는다(D25). |
| 증상만 제거하고 상태가 남았는가 | **해당** | D18의 "목록엔 남고 턴만 죽는다"가 runtime 행 대신 settings 행으로 옮겨 갔을 뿐이다(D25). |
| 최적화가 잃은 재검증 관측 | 이전 라운드와 동일 | `cached()`는 여전히 `usable()`·`sourceRevision`을 보지 않는다 — D19는 무효화로 우회했고 만료 축은 D-008대로다. |
| 출력/요청 worst-case 상한 | 계산됨 | 출력 = 입력 배열 길이 이하. 요청 = 로그인 1회 × contribution 수, 만료·세션·턴 추가분 **0**(§7 AC13). |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 4be8f95..176a73f
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 스크립트 1a 공란. 신규 `canonicalAgentKey`·`invalidate`는 프로덕션 호출자가 있다. |
| 타입 전용 export 1건 | 오탐 | `RuntimeModelCatalogBridge`는 `createRuntimeModelCatalogBridge` 반환 타입으로 정의 파일 안에서 쓰인다. |
| 형제 정책 비대칭 | 스크립트 공란 · **직접 탐색 1건** | `isReadOnly`는 **선언** 기준, `list()`는 **entry** 기준이라 무효화 후 둘이 갈린다(D25). |
| producer ↔ consumer 파생 불일치 | 없음 | 목록·턴이 같은 `mergeAgentEnvironments`(`misc.ts:42`·`turn-setup.ts:56`). |
| 신규 표면의 기존 소비처 전수 | **누락 1건** | `harnessRuntime.invalidate` 3지점 중 `bootstrap.ts:488`은 **자기 authId의 contribution만** 재조정한다(D29). |
| 배선됐으나 인스턴스 0 | 사실 기록 | `RUNTIME_MODEL_CONTRIBUTIONS = []`·`AUTH_INVALIDATED_HARNESS_KEYS = {}`(`harness-runtime.ts:114,118`) — runtime 축 판정은 전부 주입 contribution 기준이다. |
| 중복 import | **닫힘** | `turn-setup.ts:12-18`이 한 블록이다(r4 D21). |

## 4. 기존 테스트 / semantic 검증 확인

- 신규 테스트가 production 심볼을 부르는가: 예. 로컬 재구현 없이 `createRuntimeModelCatalog`·`createHarnessRuntimeConfigService`·`mergeAgentEnvironments`·`parseClaudeModels`를 직접 부른다.
- **자기보고를 대조의 출발점으로만 썼다.** 강제 지점 22/22와 AC 13/14를 §5에서 다시 셌고 게이트 수치는 §9에서 재실행했다.
- **r5가 고치거나 만든 판정 지점마다 변이를 심었다** — 11건 중 6건 검출·5건 미검출(§7 표). 미검출 5건이 전부 이번 라운드의 핵심 수정(D18·D20 배선)이다.
- **exit code를 통과 증거로 쓰지 않았다.** vitest를 `tail`로 파이프한 첫 실행은 래퍼 exit 0을 보고했지만 실제 vitest는 exit 1이었다 — 파일 수·케이스 수를 직접 읽어 다시 측정했다(§9).
- `N회` 관측 주체: augmenter `vi.fn()` 호출 수 — 실제 fetch 주체와 일치한다.
- 순서 기준: `bootstrap.ts:385`(구독) < `:428`(`authResume.run()`) < `:497`(attach) < `:641`(catalog invalidate). **bootstrap을 import하는 테스트는 없다**(electron) — 이 순서는 코드 읽기로 고정하고 상태 기계 결과만 실행으로 관측했다(D24).

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 정확한 배열만 인정, 비배열은 자동 모델 0 | ✅ | 검증자 재측정 10형태 × 2 producer 전건 `=0`(§7) | settings ✅ / runtime ✅ |
| AC2 | family 결정적 분류 + 같은 family 복수 보존 | ✅ | `['claude-sonnet-a','claude-sonnet-b']` 2행 · 변이 M-K 검출(5실패) | parser → catalog |
| AC3 | custom은 `custom` 분류 + 실제 모델명 + self 실행 | ✅ | 재측정 `alias='custom'`·`model='corp-private-v1'` · `defaultModelFamily`/`modelNameForFamily`/`resolveTitleModel` 전부 self | catalog → 두 UI → turn-setup |
| AC14 | env 항목 선행 → 배열 순서로 추가 | ✅ | 재측정 `[sonnet/env-sonnet*, opus/env-opus, custom/corp-private-v1, opus/claude-opus-9, sonnet/claude-sonnet-z]` | settings env + availableModels |
| AC4 | 정적·동적이 같은 dedupe·분류·기본 선택 규칙 | ✅ | **검증자 실행**: 8배열 `toEqual`, default 각 1개, trim·`[1m]`·dedupe 포함(§7) | `markDefaultModel` 단일 소유 |
| AC5 | 인증 Harness LLM이 read-only로 등록 | ✅ | `runtime-catalog.ts:101` · 선언 key는 인증 전에도 read-only | Auth → catalog → agent:list |
| AC6 | 수동·자동 로그인 각각 fetch 정확히 1회 | ⚠️ | revision 단위 1회 ✅ · 동시 합류 ✅ · **bootstrap 배선 테스트 없음**(r4와 동일) | authResume/login → bridge |
| AC7 | 원인별로 해당 entry만 제거 | ✅ | **검증자 실행**: revoked·expired+verified·unknown+verified·unverified·reject 5원인 전건 `orca-other` 보존(§7) | AuthChange/failure → catalog |
| AC8 | 늦은 성공 폐기 + 재인증 새 fetch 1회 | ✅ | **검증자 실행**: revoke 중 late success → `[]`, 재인증 후 `['orca-corp']`·resolveCalls 2 | subscribe → generation fence |
| AC9 | Engine read-only 표시 + 액션 미제공 + IPC 거부 | ⚠️ | `EngineCard.tsx:20,33` · `engine.ts:55,67,75,81` 4종 · i18n ko/en `card.readOnly` 실재 · 두 테마는 사람 실기 | agentStore → EngineCard / engine IPC |
| AC10 | Composer가 같은 집합 표시 + 사라진 선택 재화해 | ✅ | `modelSelection` 스위트 통과(대상 401케이스에 포함) · 목록/턴 동일 병합 함수 | agentStore → Composer |
| AC11 | 재시작 시 grant만으로 미노출, verified 후 1회 fetch | ❌ | **검증자 실행**: `onSnapshot(verified)` → `attach` → `invalidate()` 순서에서 `list()=[]`·resolveCalls 1로 끝난다(D24) | restore → authResume → bridge → **:641** |
| AC12 | 기존 CRUD·기본 3 alias 회귀 없음 + 정적 게이트 | ✅ | **검증자 실행**: `npm run typecheck` exit **0** · 3구성 · error **0**(r4 exit 2·7건 → 닫힘) | CI `ci.yml` lint→typecheck→test |
| AC13 | 세션 N·턴 M에서 fetch 증가 0 | ✅ | **검증자 실행**: `validUntil` 뒤 t+10s·200s·10,000s 전건 `cached=hit`, augmenter 호출 **1** | login → cache → 턴 cache-only |

- **합계 재측정**: `✅ 11 · ⚠️ 2 · ❌ 1 = 총 14`. 자기보고는 `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14` — **분모 일치, AC11이 ✅→❌, AC6이 ✅→⚠️로 갈린다**.
- **합계 사본 대조**: 본문 14 ↔ 커밋 trailer `Criteria-Met: 13/14`·`Criteria-Pending: AC9` ↔ INDEX 비고 — **세 사본은 서로 일치한다**(0190형 분기 없음). 재측정과만 갈린다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| exact `availableModels` shape | settings load·runtime resolve (2) | `model-parser.ts:59` · `runtime-catalog.ts:89` | 2/2 |
| family + model identity + self | materialize 2 · 선택/표시 2 (4) | parser · catalog · `models.ts:11` · `modelSelection.ts:10` | 4/4 |
| runtime entry의 Auth 파생성 | verified·revoke·expired·unauthorized·failure (5) | `:73` 한 분기가 4전이, `:109` catch가 5번째 — 5원인 전건 실행 관측(§7) | 5/5 |
| 로그인당 fetch 1·세션 0 | login 1 · session create·turn setup (3) | `bootstrap.ts:397` · `misc.ts:42` · `turn-setup.ts:85` `cached()` | 3/3 |
| read-only provenance | **설계 3, 실측 6** | `models.ts:68`·`runtime-catalog.ts:101`·`EngineCard.tsx:20`·`engine.ts:55,67,75,81` = **7좌표** | 6/6(좌표 7) |
| 두 UI 동일 snapshot | Engine·Composer (2) | `useEngines.ts` · `useAgents.ts` | 2/2 |

- **분모 재측정**: 2+4+5+3+6+2 = **22**. 실효 **22/22** — 자기보고와 일치한다.
- **5행은 여전히 plan 원문이 `3지점`이다.** r1부터 실측과 갈려 있고 r4가 지적했으나 정정 커밋이 없다. 엄격 술어(“runtime-managed key를 앱 사용자가 편집할 수 없다”)로 세면 좌표는 **7**이다.
- **r5가 신설한 축은 §10에 행이 없다.** 구현자는 "runtime cache 무효화 3지점 3/3"을 보고했지만 그 축은 §10 어디에도 없다 — r4가 "cache 수명의 소유자"로 신설을 요청한 행이 아직 비어 있다.
- **그 축을 엄격 술어로 다시 세면 3/4다.** 술어를 구현자의 `invalidate 호출자`가 아니라 불변식의 주어 **"무엇이 `cached(contributionKey)`를 비울 수 있는가"**로 바꾸면 `bootstrap.ts:488`이 절반만 닫힌다(D29).

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `RuntimeConfigAugmenter.resolve` → `availableModels?` | typecheck 3구성 통과 | `undefined`·`[]`·비배열·reject 모두 자동 entry 제거로 수렴(§7) | ✅ |
| 같은 augmenter의 `validUntil` | 타입 ✅ | 가이드 `closed-network-extensions.md:618-623`이 contribution/settings 분기와 미노출·복구를 적었다 — 코드와 일치 | ✅ (r4 D22 닫힘) |
| 가이드 6-a 행(`:444`) | — | "설정 배포로 cache가 무효화되면 자동 항목도 미노출" 추가 — 코드와 일치 | ✅ |
| `HarnessRuntimeConfigService.cached` | ✅ | fake 7곳 전부 갱신, `typecheck:test` error 0 | ✅ (r4 D17 닫힘) |
| `RuntimeModelCatalog.invalidate` (신규 포트 메서드) | ✅ | **문서 없음** — `§15 외부 구현 포트`와 가이드 어디에도 catalog 무효화 계약이 없다 | ⚠️ 내부 포트라 배포 영향은 없다 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 전체 스위트: **211파일 중 206 통과 · 5 실패 / 2090케이스 중 2048 통과 · 42 실패**. r4(2087케이스) 대비 **+3케이스**이고 r5가 추가한 케이스는 `available-models` 1 + `runtime-catalog` 2 = **3** — 일치한다.
- **자기보고 `2092케이스 중 2048 pass/44 ABI fail`은 총계·실패 수가 2씩 어긋난다.** 통과 수 2048은 일치한다. 같은 값이 INDEX 비고에도 `5파일/44케이스`로 복사돼 있다(D30).
- 실패 5파일 = `infra/db/{queries,migrate}` · `extensions/builder` · `orchestration/fork` · `app/chat-turn.continuity`. `app/AGENTS.md`의 실측 5파일 목록과 **정확히 일치**하고 서명은 `Could not locate the bindings file … better_sqlite3.node`다. 변경 무관.
- 대상 스위트: **46파일 / 401케이스 통과**(harnesses · handlers · turn-setup.runtime-catalog · renderer engine/chat). 자기보고 "4파일 37/37"은 더 좁은 선택이라 모순이 아니다.
- doc inventory: **9 items · 76 channels** — 자기보고와 일치.
- **AC1 재측정**(10형태 × 2 producer): `string`·`mixed array`·`null`·`array-like`·`nested`·`number`·`object array`·`object`·키 오타 2종 전건에서 settings 발견 0 · runtime entry 0.
- **AC4 재측정**(두 production 함수를 같은 배열에 직접 호출):

  | 입력 배열 | settings default | runtime default | `toEqual` |
  |---|---|---|---|
  | `claude-opus-4-1`, `claude-sonnet-4-5` | `claude-sonnet-4-5` | 같음 | true |
  | `corp-a`, `corp-b` | `corp-a` | 같음 | true |
  | `claude-haiku-1`, `claude-opus-1` | `claude-haiku-1` | 같음 | true |
  | `  spaced-model  `, `claude-opus-2[1m]` | `claude-opus-2` | 같음 | true |
  | `dup`, `dup`, `claude-haiku-9` | `claude-haiku-9` | 같음 | true |

  8배열 전건 `toEqual` · `isDefault` 정확히 1개.
- **AC13 재측정**: `validUntil=+60s`, 로그인 1회 뒤 시계를 +10s·+200s·+10,000s로 옮기며 `cached()` 3회 → 전건 `hit`, augmenter 호출 **1**.
- **D24 재현**(부팅 순서): `bridge.onSnapshot('gate', verified)` → `bridge.attach(catalog)`(여기서 `list=['orca-corp']`·resolveCalls 1) → `catalog.invalidate()` → **`list=[]`·resolveCalls 1**. 이후 같은 스냅샷을 다시 넣으면 회복된다(`list=['orca-corp']`·resolveCalls 2) — 부팅에는 그 재진입이 보장되지 않는다.
- **D25 재현**(settings 충돌): 실제 `createHarnessRuntimeConfigService` + `mergeAgentEnvironments`로 contribution `orca-corp`와 같은 key의 settings 행을 함께 두고 `runtime.invalidate(undefined,'harness-settings-crud')` + `catalog.invalidate()` 실행 →
  `BEFORE list=[{k:orca-corp, ro:true, m:[corp-model]}]`·`cached=hit` →
  `AFTER  list=[{k:orca-corp, ro:undefined, m:[settings-sonnet]}]`·`isReadOnly=true`·`cached=MISS` →
  턴 재현이 `THROW: Runtime model cache is unavailable for "orca-corp"`.
- **변이 재측정**(대상 46파일 401케이스 기준, 구현자 스위트만):

  | # | 변이 | 결과 |
  |---|---|---|
  | M-A | `canonicalAgentKey` → identity | 2 실패 — 잠김 |
  | M-B | `invalidate()`의 generation bump 제거 | 1 실패 — 잠김 |
  | M-C | `invalidate()`의 `resolvedRevision.delete` 제거 | 1 실패 — 잠김 |
  | M-D | `invalidate()`의 `entries.delete` 제거 | 1 실패 — 잠김 |
  | M-E | `engine.ts:39` `catalog.invalidate()` 제거 | **401/401 통과 — 잠기지 않음**(D26) |
  | M-F | `bootstrap.ts:641` `catalog.invalidate()` 제거 | **401/401 통과 — 잠기지 않음**(D26) |
  | M-G | `mergeAgentEnvironments`를 원문 key로 되돌림 | **401/401 통과 — 잠기지 않음**(D27) |
  | M-H | `entries` map key를 원문 `contribution.key`로 되돌림 | **401/401 통과 — 잠기지 않음**(D27) |
  | M-I | `invalidate(key)`가 key 필터를 무시(항상 전체) | **401/401 통과 — 잠기지 않음**(D28) |
  | M-J | `markDefaultModel`의 `?? models[0]` 제거 | 1 실패 — **잠김**(r4 W1 → 닫힘) |
  | M-K | `DEFAULT_FAMILY_ORDER` 첫 일치 → 마지막 일치 | 5 실패 — 잠김 |

- **미검출 5건이 전부 이번 라운드의 수정 지점이다.** D18 배선 2곳·D20 정규화 2곳·신규 key 필터 1곳 — `handoff-impl`이 요구한 "이번 턴에 만들거나 고친 검사 장치는 판정 지점마다 결함을 심어 본다"가 수행되지 않았다.
- **미검출이 테스트 불가 때문이 아님을 실증했다.** `handlers/engine.ts`는 electron을 직접 import하지 않고, 저장소에 이미 `misc-split.test.ts`의 `vi.mock('electron')` 패턴이 있다. 검증자가 그 패턴으로 40줄 테스트를 만들자 M-E를 **검출**했다(`Tests 1 failed`).
- 0건 기준: `RUNTIME_MODEL_CONTRIBUTIONS`가 비어 있어 runtime 축의 "0건"은 전수가 아니라 **미배포**다 — 통과 근거로 쓰지 않았다. D24·D25·D29의 사용자 영향도 같은 이유로 현재 배포에서는 잠재적이다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| Engine read-only 배지 | `canMutate` 분기·i18n ko/en 키 실재·IPC 4종 거부를 코드와 테스트로 확인 | 두 테마의 배지 대비와 버튼 부재 | 앱 → 엔진 & 모델 → 라이트/다크 전환 |
| 로그인 → 카드 출현/제거 | catalog 상태 기계는 주입 테스트로 전건 | 실제 Gate 로그인·revoke 왕복 | contribution을 선언한 폐쇄망 배포에서만 가능 |

- 사람에게 넘기지 않은 것: 분류·순서·기본 선택·선택 화해·fetch 횟수·cache 수명·key 정규화·read-only 판정·shape guard는 전부 순수 함수 또는 주입 seam으로 기계 검증했다. D24·D25는 electron 없이 실제 service + 실제 병합 함수로 재현했다.
- **`handlers/engine.ts`는 더 이상 "electron이라 불가"가 아니다**(§7). 남은 electron 경계는 `bootstrap.ts` 하나이고, 거기서도 미관측인 것은 "bootstrap이 bridge와 invalidate를 그 순서로 쓴다"뿐이다 — 그 순서가 만드는 결과는 상태 기계로 관측했다(D24).

## 9. 게이트 재실행

- 실제 실행 명령: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts` · `npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(--fix 없이) · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `git diff --check`.
- **관측한 실행 산출**:
  - `npm run typecheck` → **exit 0**. `typecheck:node`·`typecheck:web`·`typecheck:test` 3구성이 모두 실행되고 error **0**. r4의 `TS2741` 7건은 사라졌다.
  - eslint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, 이번 diff 무관 기존 건).
  - vitest **211파일 2090케이스**(§7) · doc inventory **9 items·76 channels** · `git diff --check` 무출력.
- `npm test` 미사용 — DB 동작 검증이 필요 없고 `pretest`가 ABI를 뒤집는다(`app/AGENTS.md`).
- **exit code를 통과 증거로 쓰지 않았다.** 첫 vitest 실행을 `tail`로 파이프했더니 래퍼가 exit 0을 보고했고 실제 vitest는 exit 1이었다 — 산출을 다시 받아 파일 수·케이스 수·실패 파일명을 읽었다.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`가 `--fix`라 eslint를 직접 호출했고 실행 후 `git status --short` 공란이다.
- **검증 중 실행한 명령의 잔여물**: `npm ci`가 만든 `node_modules`(gitignore 대상), 검증자가 심었다가 제거한 임시 테스트 5벌(부팅 순서·AC 재측정·settings 충돌·engine 배선·AC3/14)과 변이 11건. 전부 되돌렸고 `git status --short` 공란을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료. **r4의 typecheck 회귀 해소 확인** |
| AC ↔ production path | 14건 1:1 대조 완료, 1건 미충족·2건 부분 |
| 계약/레이어/문서 링크 | doc inventory·링크 통과, 외부 포트 문서 drift 0(r4 D22 닫힘) |
| 제품 의도 | D24의 "부팅 deploy 무효화가 Gate 인증 fetch보다 뒤에 와도 되는가"는 **사람 결정** 후보 |
| UI 시각 품질 | AC9 두 테마만 사람 실기 대기 |
| PR merge | 사람 승인 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 diff는 `AGENTS.md`를 바꾸지 않았다 — 해당 없음.

### INDEX 보드 정합성

- 단계 `impl` · 상태 `IMPL_DONE (r5)` · 다음 주체 `Claude (재검증)` — 검증 착수 시점의 실제와 일치했다.
- 비고 4줄 — 5줄 이내 ✅.
- **대상 커밋 칸이 다시 자리표시자다**: `(r5 구현)`. r4의 D23과 같은 형태이며 이번 검증 커밋에서 `176a73f`로 채운다.
- 비고의 `5파일/44케이스`는 재측정 `5파일/42케이스`와 갈린다(D30).

### Commit / reference 정합성

- trailer 허용값: `176a73f`는 `Agent: codex`·`Status: implemented`·`Criteria-Met: 13/14`·`Criteria-Pending`·`Verified-By: pending` — `git interpret-trailers --parse` 출력 6줄 전부 허용값이고 `Next-Action`은 없다(구현 커밋 규약대로).
- 인용 해시 실재: `803bd50`·`8e17aae`·`4be8f95`·`176a73f`·`e0517e0`·`1a2c0c6`·`cf4d0d4`·`931fea6`·`4ed51c8` 전건 `git cat-file -t` → `commit`.
- **D15 축이 재발했다**: `176a73f`가 규범 행(D-008)과 구현을 한 커밋에 담았다(§0). `verify.md` 혼입은 없다.
- reference/script 이동·삭제: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "D17 닫음" | **타당** — typecheck exit 0·3구성·error 0 | §5 AC12 ✅ |
| "D19·D21·D22 닫음" | **타당** — `cached()` 우회는 무효화로 대체, import 1블록, 가이드 618-623행 신설 | §3 · §6 |
| "W1 닫음" | **타당** — 변이 M-J가 검출한다(r4 미검출 → 닫힘) | §7 변이표 |
| "D20 닫음 — canonical key를 merge/read-only/invalidate에 공유" | **코드는 타당, 잠금은 미달** | M-G·M-H 미검출(D27) |
| "D18 닫음 — invalidate 호출자 3/3" | **부분** — 두 호출자는 배선됐으나 테스트가 없고(D26), 술어를 바꾸면 3/4이며(D29), 증상 자체가 settings 충돌 축에 남는다(D25) | §5 §10 · §13 |
| "강제 지점 22/22" | **일치** — 검증자 재측정도 22/22 | §5 §10 표 |
| "놓친 잠재 문제: 늦은 fetch에 generation fence 적용" | **타당** — M-B가 검출한다 | §7 변이표 |
| "설계 대비 차이 재유도: 만료·공유·재진입·다른 무효화 축" | **불완전** — 공유 축을 catalog entry에만 유도했고 같은 key의 settings 행은 유도하지 않았다 | D25 |
| "전체 vitest 2092케이스/44 ABI fail" | **사실과 다름** — 2090케이스/42 실패 | D30 |
| "AC 자기보고 ✅13·⚠️1" | **갈림** — 재측정 ✅11·⚠️2·❌1 | §5 |

## 13. 파생 이슈

- [ ] **D24 — 부팅 deploy 무효화가 Gate 인증 fetch 결과를 지운다 (AC11 · Part I §5 restart 행)**. `bootstrap.ts:428 void authResume.run()` < `:497 void attach()` < `:641 runtimeModelCatalog.invalidate()` 순서다. Gate 자동 인증의 `verified` 스냅샷이 `:641`보다 먼저 도착하면 방금 fetch한 entry가 지워지고, `auth.subscribe` 말고는 reconcile 트리거가 없어(주기 refresh 타이머 없음) **그 세션 동안 자동 모델이 돌아오지 않는다**. 재현은 §7 D24. 두 순서가 모두 가능하므로 결과가 비결정적이다. `:641`을 Auth 구독/attach보다 앞으로 옮기거나, 부팅 deploy 경로만 catalog 무효화에서 제외하는 선택지가 있다 — **어느 쪽이든 AC11·D-008 중 하나의 문장을 손대므로 제품 결정**이다.
- [ ] **D25 — 같은 key의 settings 디렉터리가 있으면 D18 유령이 그대로 남는다 (D-008 · Part I §14)**. `isReadOnly`는 `input.contributions` **선언** 기준이고 `list()`는 **entry** 기준이라, `catalog.invalidate()` 뒤 병합 결과에는 settings 행이 남는데 `turn-setup.ts:83`은 여전히 `runtimeManaged=true`로 판정해 `cached()` MISS → `Runtime model cache is unavailable`로 죽는다. 재현은 §7 D25. contribution key에 settings 디렉터리가 붙는 것은 예외가 아니라 **가이드 4단계가 지시하는 정상 형태**다(`runtime-config.ts:167`이 그 key의 settings를 resolve해 augmenter에 넘긴다). 게다가 남은 행은 `readOnly`가 없어 Engine & Models에 편집·삭제 버튼이 다시 나타난다.
- [ ] **D26 — 이번 라운드의 핵심 배선 2곳이 테스트로 잠기지 않는다**. `engine.ts:39`·`bootstrap.ts:641`의 `catalog.invalidate()`를 각각 지워도 대상 401케이스가 전건 통과한다(변이 M-E·M-F). `handlers/engine.ts`는 electron을 직접 import하지 않고 `misc-split.test.ts`의 `vi.mock('electron')` 패턴이 이미 있어, 검증자가 만든 40줄 테스트가 M-E를 검출했다 — 테스트 불가가 아니라 미작성이다.
- [ ] **D27 — D20 정규화가 두 소비처에서만 잠긴다**. `mergeAgentEnvironments`를 원문 key로 되돌려도(M-G), `entries` map key를 원문으로 되돌려도(M-H) 401케이스가 전건 통과한다. `canonicalAgentKey` 자체를 무력화하는 M-A만 2건을 검출하는데, 그 2건은 `isReadOnly`와 `invalidate` 경로다.
- [ ] **D28 — `invalidate(key)`의 key 필터가 잠기지 않는다**. 필터를 지워 항상 전체를 무효화하게 해도 401케이스가 전건 통과한다(M-I). 현재 프로덕션 호출자가 둘 다 인자 없는 호출이라 실사용 차이는 없지만, 포트가 받은 인자가 아무것도 강제하지 않는다.
- [ ] **D29 — `bootstrap.ts:488`은 자기 authId만 재조정한다 (§10 신설 축)**. `invalidateForAuth(authId)`가 비우는 key는 `AUTH_INVALIDATED_HARNESS_KEYS[authId]` ∪ `그 auth의 contribution key`인데, 뒤이은 `onSnapshot`은 **그 authId 하나만** reconcile한다. 배포가 A의 `AUTH_INVALIDATED_HARNESS_KEYS`에 B의 contribution key를 적으면 B의 cache만 비고 entry는 남아 D18이 재발한다. 술어를 "무엇이 `cached(contributionKey)`를 비울 수 있는가"로 바꾸면 이 축은 **3/4**다.
- [ ] **D30 — 게이트 자기보고 수치 2건이 재측정과 다르다**. 구현 보고와 INDEX 비고가 `2092케이스 / 44 ABI fail`인데 재측정은 `2090케이스 / 42 fail`이다(통과 2048은 일치). r4 verify도 42였다.
- [ ] **D31 — 좌표·기준선 위생 3건**. ① `176a73f`가 규범 행 D-008을 구현과 한 커밋에 담았다(D15와 같은 축, §0). ② INDEX 대상 커밋 칸의 `(r5 구현)` 자리표시자 — 이번 검증 커밋에서 `176a73f`로 교정. ③ plan §10 read-only 행이 아직 `3지점`이다(실측 6, 엄격 술어 7).

## 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상: 예.** D25는 r4 D18과 같은 증상(목록엔 남고 턴만 죽는다)이 다른 행(settings)으로 옮겨 간 것이다. D31①은 r3 D15와 같은 축이다.
- 관련 plan 지침/AC의 존재 여부: D24는 AC11과 Part I restart 행이 이미 요구했다. D25는 §10에 "cache 수명의 소유자" 행이 여전히 없어 **지침 부재가 있는 쪽**이다 — r4가 신설을 요청했고 이번 라운드에도 신설되지 않았다.
- **검사 장치 자기검증 누락이 반복된다.** `handoff-impl`은 "이번 턴에 고친 장치의 판정 지점마다 결함을 심는다"를 요구하는데, r5의 수정 지점 5곳이 전부 미검출이다(§7). r4의 W1(변이 M3 미검출)과 같은 축이다.
- 사용자 결정 변경 근거: D-008이 D18 선택 A로 바뀌었고 근거가 파생 이슈 행에 기록돼 있다(§0). 결정 자체는 검증자가 재현할 수 없다.
- 반복된 검증 환경 한계: GUI/X server 부재로 AC9 시각 확인은 이번에도 사람 몫이다. better-sqlite3 bindings 부재로 DB 5스위트는 이번에도 red다. `RUNTIME_MODEL_CONTRIBUTIONS`가 비어 있어 runtime 축은 실배포 인스턴스가 0이다.
- 현재 라운드: 5. **라운드 3을 초과한 상태가 이어지므로 다음 재구현 전에 `handoff-review`를 다시 수행한다**(직전 review는 `cf4d0d4`, round 16).

## 15. 결론

- 상태: **FAIL**
- Product/UX 및 ACTIVE Decision 충족: D-001~D-007은 충족한다. **D-008은 부분** — contribution 단독 key는 무효화 시 두 UI에서 사라지지만, 같은 key의 settings 행이 있으면 r4 D18의 유령이 그대로 재현된다(D25).
- AC 충족: `✅ 11 · ⚠️ 2 · ❌ 1 = 총 14`. **AC12가 ❌ → ✅로 닫혔고 AC11이 ✅ → ❌로 열렸다**. 자기보고 `13/14`와는 AC11·AC6 두 칸이 갈린다.
- 강제 지점: 분모 **22**, 실효 **22/22**. r5가 신설한 cache 수명 축은 §10에 행이 없고, 엄격 술어로는 **3/4**다(D29).
- 기준 밖 결함: D24(부팅 순서)·D25(settings 충돌)·D26~D28(이번 수정의 미잠금)·D29(cross-auth 무효화)는 AC 채점 밖에서 찾았다.
- repository operation checks: INDEX 자리표시자 1건·규범 행 혼입 1건·plan §10 stale 1건·자기보고 수치 1건(D30·D31).
- 남은 사람 확인: AC9 두 테마 시각, **D24의 "부팅 deploy 무효화와 Gate 인증 fetch 중 무엇이 뒤에 와야 하는가"** 제품 결정.
- 다음 단계: **`handoff-review` 먼저**(라운드 3 초과 지속), 그 뒤 재구현 — **D25·D24를 먼저 닫고**(제품 동작) D26~D28의 잠금을 같은 라운드에 붙인다. D29~D31은 전수·위생이다.

---

# 라운드 4 — FAIL (원문 보존)

## 메타

| 항목 | 값 |
|---|---|
| slug | `0198-runtime-model-catalog` |
| 검증자 | Claude Code |
| 일자 | 2026-08-24 |
| 대상 커밋/range | `e0517e0..4be8f95` (r4 구현) · 라운드 이력 `803bd50`(r1) · `8e17aae`(r3) |
| 구현 전 plan 기준 | **고정됨** — `4be8f95`의 `plan.md` 변경에 규범 행 0건(r4 §0) |
| 라운드 | 4 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude Code |

## 0. 기준선 / plan 변경 확인

- **기준선이 diff로 성립하는가: 예 — r2·r3와 달리 이번엔 §0의 잠금이 작동한다.** 구현 커밋 `4be8f95`가 `plan.md`에서 바꾼 것은 메타 `상태` 행 1줄·파생 이슈 `상태` 칸 6개·신규 `[구현자 기입] r4` 절뿐이다.
- **규범 행(AC·Decision·§10) 변경 0건.** `git diff e0517e0..4be8f95 -- …/plan.md | grep -cE '^[+-]\| AC|^[+-]\| D-0'` → `0`.
- 설계·검증 산출이 구현 커밋에 섞이지 않았다 — `4be8f95`에 `verify.md` 변경 없음(diff stat 10파일). r3의 D15 패턴이 이번 커밋에서는 재발하지 않았다.
- 채점 기준: 현행 AC1~AC14 원문. **AC4·AC13은 r1(`803bd50`)부터 한 글자도 바뀌지 않았다**(r3 §0에서 고정한 인용과 동일).
- Decision Ledger: D-001~D-008 ACTIVE 유지, SUPERSEDED 0건.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | `availableModels: string[]`만 인정 | `model-parser.ts:59` · `runtime-catalog.ts:87` 둘 다 `availableModelsOf` ✅ |
| D-002 | 같은 family 복수 항목 보존 | 모델명 dedupe 유지 ✅ (변이 M4 검출) |
| D-003 | family 표시 `custom` · 실행값 self | `alias='custom'`·`model=self` 재측정 ✅ |
| D-004 | 정적·동적이 같은 정규화 규칙 | `markDefaultModel` 한 함수 소유 · **12배열 전건 동일** ✅ (r3 ❌ → 닫힘) |
| D-005 | 인증 성공 → read-only 항목 생성 | `runtime-catalog.ts:99` `readOnly:true` ✅ |
| D-006 | `AuthRuntime.subscribe` 트리거 | `bootstrap.ts:385` 구독 · `:497` attach ✅ |
| D-007 | 두 UI가 같은 카탈로그 소비 | 턴도 `mergeAgentEnvironments` 사용 ✅ (r3 ❌ → 닫힘, 변이 M6 검출) |
| D-008 | 로그인당 fetch 1회, 세션/턴은 cache만 | 만료 뒤 턴 3회에도 fetch 1회 ✅ · **cache가 Auth 밖에서 비면 회복 경로가 없다** ❌ (§2) |

### end-to-end 흐름

```text
settings.json → parseClaudeModels ─┐
                                    ├→ mergeAgentEnvironments → agent:list → EngineCard / ModelMenu
AuthChange(verified) → bridge → catalog.reconcile → runtime.resolve ─┘   (states.cached 를 warm)
                                                            ↓
      turn-setup: mergeAgentEnvironments → find(key) → isReadOnly ? harnessRuntime.cached() : resolve()
                                                            ↓
                              cached() === undefined → throw "Runtime model cache is unavailable"
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | **중대 결함** | Auth와 무관한 `invalidate(undefined)` 2지점이 cache를 비우는데 catalog entry는 남는다 → 턴이 영구 실패(D18). |
| false success 가능성 | **있음 — 게이트 보고** | 구현자 "typecheck 3구성 PASS"가 사실과 다르다. 실제 `npm run typecheck` exit 2 · 7 error(D17). |
| partial failure/rollback | 정상 | reject는 해당 contribution만 제거하고 형제 entry는 남는다(`runtime-catalog.test.ts:136`). |
| Product/UX의 A가 아닌 B를 구현했는가 | 아니오 | AC4·AC13 모두 원문이 요구한 A를 구현했다(§5). |
| 최적화가 잃은 재검증 관측 | **있음** | `cached()`가 `usable()`과 `sourceRevision`을 둘 다 건너뛴다(`runtime-config.ts:216-218`) — 만료 무시는 D-008대로지만 settings 재검증도 함께 사라졌다(D19). |
| 증상만 제거하고 상태가 남았는가 | 아니오 | catalog는 메모리 파생 상태뿐이다. |
| 출력/요청 worst-case 상한 | 계산됨 | 출력 = 입력 배열 길이 이하. 요청 = 로그인 1회 × contribution 수, 만료·세션·턴 추가분 **0**(재측정 §7). |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh e0517e0..4be8f95
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 스크립트 1a 공란. 신규 `markDefaultModel`·`cached`는 프로덕션 호출자가 있다. |
| 테스트 전용 참조 3건 | 오탐 | `StaleHarnessConfigError`·`HarnessSettingsPort`·`RuntimeConfigAugmenter`는 정의 파일 안에서 쓰인다(`runtime-config.ts:206`·`74`·`137`). r3과 같은 목록이다. |
| 형제 정책 비대칭 | 스크립트 공란 · **직접 탐색에서 1건** | `isReadOnly`는 `trim().toLowerCase()`로 비교하고 `cached()`·`mergeAgentEnvironments`는 원문 key를 쓴다(D20). |
| producer ↔ consumer 파생 불일치 | **없음**(r3 2건 모두 닫힘) | default 12배열 동일(§7) · 목록/턴이 같은 병합 함수(`misc.ts:44`·`turn-setup.ts:55`). |
| 신규 표면의 기존 소비처 전수 | **누락 1건** | `harnessRuntime.invalidate` 호출 3지점 중 재조정이 뒤따르는 것은 `bootstrap.ts:488`뿐이다(D18). |
| 동일 규칙 중복 구현 | 의도된 2사본 | `modelKey`가 `models.ts:11`·`modelSelection.ts:10`. 프로세스 경계라 공유 불가. |
| 배선됐으나 인스턴스 0 | 사실 기록 | `RUNTIME_MODEL_CONTRIBUTIONS = []`(`harness-runtime.ts:118`) — runtime 축 판정은 전부 주입 contribution 기준이다. |
| 중복 import | **1건** | `turn-setup.ts:11-16`과 `:18`이 같은 `features/harnesses/models`를 두 번 import 한다. `import/no-duplicates`가 config에 없어 lint가 못 잡는다(D21). |

## 4. 기존 테스트 / semantic 검증 확인

- 신규 테스트가 production 심볼을 부르는가: 예. `zz` 로컬 재구현 없이 `parseClaudeModels`·`normalizeAvailableModels`·`createRuntimeModelCatalog`·`resolveTurnProvider`를 직접 부른다.
- **자기보고를 대조의 출발점으로만 썼다.** 강제 지점 22/22와 AC 11/14를 §5에서 다시 셌고, 게이트 수치는 §9에서 재실행했다.
- **구현자가 이번 라운드에 만든 테스트를 변이 7건으로 다시 쟀다**(§7 표). 6건 검출·1건 미검출.
- **`exit code`를 통과 증거로 쓰지 않았다.** `--reporter=basic`은 vitest 4에서 존재하지 않아 0파일 실행 + startup error를 냈다 — 리포터를 되돌려 파일 수·케이스 수를 관측했다(§9).
- `N회` 관측 주체: augmenter `vi.fn()` 호출 수 — 실제 fetch 주체와 일치한다.
- 순서 기준: `bootstrap.ts:385`(구독) < `:428`(`authResume.run()`) < `:497`(attach) < `:640`(전체 invalidate). **bootstrap을 import하는 테스트는 없다**(electron 의존) — 이 순서는 코드 읽기로만 확인했고, `:497`이 `void`라 `:640`과 경합한다(D18 2문단).

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 정확한 배열만 인정, 비배열은 자동 모델 0 | ✅ | 검증자 재측정 8형태(문자열·혼합·null·유사배열·중첩·숫자·객체배열·키 오타) 전건 discovery 0 | settings ✅ / runtime ✅ |
| AC2 | family 결정적 분류 + 같은 family 복수 보존 | ✅ | `['claude-sonnet-a','claude-sonnet-b']` 2행 보존 · 변이 M4 검출 | parser → catalog |
| AC3 | custom은 `custom` 분류 + 실제 모델명 + self 실행 | ✅ | 재측정 `['custom','corp-private-v1']` · `isCustom:true` | catalog → 두 UI → turn-setup |
| AC14 | env 항목 선행 → 배열 순서로 추가 | ✅ | 재측정 `[sonnet/env-sonnet, custom/corp-private-v1, opus/claude-opus-9]` | settings env + availableModels |
| AC4 | 정적·동적이 같은 dedupe·분류·**기본 선택** 규칙 | ✅ | **검증자 실행**: 12배열에서 두 producer 산출이 `toEqual`, default 1개, r3의 3배열 전건 일치(§7) | `markDefaultModel` 단일 소유 |
| AC5 | 인증 Harness LLM이 read-only로 등록 | ✅ | `runtime-catalog.ts:98-99` · 선언 key는 인증 전에도 read-only(`:152` 테스트) | Auth → catalog → agent:list |
| AC6 | 수동·자동 로그인 각각 fetch 정확히 1회 | ⚠️ | revision 단위 1회 ✅ · 동시 합류 ✅ · **bootstrap 배선 테스트 없음** · `:497`↔`:640` 경합 미관측 | authResume/login → bridge |
| AC7 | 원인별로 해당 entry만 제거 | ✅ | `expired`·`unknown` 케이스 신규 · **변이 M1이 이제 검출된다**(r3 미검출 → 닫힘) | AuthChange/failure → catalog |
| AC8 | 늦은 성공 폐기 + 재인증 새 fetch 1회 | ✅ | `runtime-catalog.test.ts:84`·`:98` 통과 | subscribe → generation fence |
| AC9 | Engine read-only 표시 + 액션 미제공 + IPC 거부 | ⚠️ | `EngineCard.tsx:20,33` · `engine.ts:54,66,74,80` 4종 ✅ · 두 테마는 사람 실기 | agentStore → EngineCard / engine IPC |
| AC10 | Composer가 같은 집합 표시 + 사라진 선택 재화해 | ✅ | `modelSelection.test.ts` 전건 통과(9파일 77케이스에 포함) | agentStore → Composer |
| AC11 | 재시작 시 grant만으로 미노출, verified 후 1회 fetch | ⚠️ | bridge catch-up·pre-attach replay ✅ · **restart 경로 자체는 테스트 없음** | restore → authResume → bridge |
| AC12 | 기존 CRUD·기본 3 alias 동작 회귀 없음 + **정적 게이트** | ❌ | **검증자 실행**: `npm run typecheck` exit **2** · `error TS2741` **7건**. `e0517e0`에서는 exit **0**·0건 | CI `ci.yml` lint→typecheck→test |
| AC13 | 세션 N·턴 M에서 fetch 증가 0 | ✅ | **검증자 실행**: `validUntil=60s` 뒤 t=10s·200s·10,000s 턴 3회에도 `AUGMENTER_CALLS=1`, 모델 해석 성공 | login → cache → 턴 cache-only |

- **합계 재측정**: `✅ 10 · ⚠️ 3 · ❌ 1 = 총 14`. 자기보고는 `✅ 11 · ⚠️ 3 · ❌ 0 = 총 14` — **분모 일치, AC12 한 칸이 갈린다**.
- **합계 사본 대조**: 본문 14 ↔ 커밋 trailer `Criteria-Met: 11/14`·`Criteria-Pending: AC6·AC9·AC11` ↔ INDEX 비고 "✅11·⚠️3·❌0 / 14" — **세 사본은 서로 일치한다**(0190형 사본 분기 없음). 재측정과만 갈린다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| exact `availableModels` shape | settings load·runtime resolve (2) | `model-parser.ts:59` · `runtime-catalog.ts:87` | 2/2 |
| family + model identity + self | materialize 2 · 선택/표시 2 (4) | parser · catalog · `models.ts:11` · `modelSelection.ts:10` | 4/4 |
| runtime entry의 Auth 파생성 | verified·revoke·expired·unauthorized·failure (5) | `:71` 한 분기가 4전이, `:106` catch가 5번째 | 5/5 (관측 4/5 — M1 검출로 상승) |
| 로그인당 fetch 1·세션 0 | login 1 · session create·turn setup (3) | `bootstrap.ts:397` · `misc.ts:44` · `turn-setup.ts:85` `cached()` | **3/3** (r3 2/3 → 닫힘) |
| read-only provenance | 설계 3, 실측 6 | `models.ts:64`·`runtime-catalog.ts:99` · `EngineCard.tsx:20` · `engine.ts:54,66,74,80` | 6/6 |
| 두 UI 동일 snapshot | Engine·Composer (2) | `useEngines.ts:9` · `useAgents.ts:3` | 2/2 |

- **분모 재측정**: 2+4+5+3+6+2 = **22**. 실효 **22/22**. 자기보고와 일치한다.
- **표에 없는데 같은 불변식이 필요한 지점 2건**:
  - **cache 수명의 소유자.** 4행은 "cache miss 시 명시 실패"만 적고 *누가 cache를 비울 수 있는가*를 열거하지 않는다. `invalidate` 3지점 중 2곳은 재조정이 없다(D18).
  - **기본 선택 규칙의 producer 간 동일성.** r3이 요구한 §10 행이 아직 없다 — 구현자가 "규범 변경이라 설계자 정정 제안"으로 남겼다. AC4는 성립하므로 닫힘 판정은 유지하되 강제 지점은 여전히 비어 있다.
- 5행의 plan 원문은 아직 **3지점**이다. r1부터 실측 6과 갈려 있고 정정 커밋이 없다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `RuntimeConfigAugmenter.resolve` → `availableModels?` | typecheck node/web 통과 | `undefined`·`[]`·비배열·reject 모두 자동 entry 제거로 수렴 | ✅ |
| 같은 augmenter의 `validUntil` | 타입 ✅ | **의미가 key 종류에 따라 갈린다** — catalog contribution key면 턴에서 무시되고, 아니면 종전대로 만료가 재resolve를 낸다. 가이드 `closed-network-extensions.md:610` 예제·`:444` 6-a 어디에도 이 분기가 없다 | ❌ 문서 drift (D22) |
| `AgentEnvironment.source/readOnly` | 타입 ✅ | `IPC_CONTRACT.md:69`가 `alias='custom'`·`model=self`로 정정됐다 — `available-models.ts:23-31`과 일치 | ✅ (r3 D14 닫힘) |
| `HarnessRuntimeConfigService.cached` (신규 포트 메서드) | **❌** | 인터페이스에 필수 메서드를 추가하고 구현체 fake 7곳을 갱신하지 않았다 — `typecheck:test` 7 error(D17) | ❌ |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 전체 스위트: **211파일 중 206 통과 · 5 실패 / 2087케이스 중 2045 통과 · 42 실패**. r3(211파일·2083케이스) 대비 **+4케이스**이고, r4가 추가한 케이스는 공유 default 1 + `it.each` 2 + key 충돌 1 = **4** — 일치한다.
- 실패 5파일 = `infra/db/{queries,migrate}` · `extensions/builder` · `orchestration/fork` · `app/chat-turn.continuity`. `app/AGENTS.md`의 실측 5파일 목록과 **정확히 일치**하고 서명은 `Could not locate the bindings file … better_sqlite3.node`다. 변경 무관.
- 대상 스위트: **9파일 / 77케이스 통과**(`harnesses` · `turn-setup.runtime-catalog` · `modelSelection`). 자기보고 "5파일/44케이스"는 더 좁은 선택이라 모순이 아니다.
- doc inventory: **9 items · 76 channels** — 자기보고와 일치.
- **AC4 재측정**(두 production 함수를 같은 배열에 직접 호출, r3의 3배열 포함 12배열):

  | 입력 배열 | settings default | runtime default |
  |---|---|---|
  | `claude-opus-4-1`, `claude-sonnet-4-5` | `claude-sonnet-4-5` | `claude-sonnet-4-5` |
  | `corp-private-v1`, `claude-sonnet-4-5` | `claude-sonnet-4-5` | `claude-sonnet-4-5` |
  | `claude-haiku-x`, `claude-sonnet-y` | `claude-sonnet-y` | `claude-sonnet-y` |
  | `corp-a`, `corp-b` | `corp-a` | `corp-a` |
  | `claude-haiku-1`, `claude-opus-1` | `claude-haiku-1` | `claude-haiku-1` |

  12배열 전건에서 `ParsedModel[]`이 `toEqual`이고 `isDefault`는 정확히 1개다. r3의 5배열 중 3배열 불일치는 해소됐다.
- **AC13 재측정**: `validUntil=60_000`, 로그인 1회 뒤 `clock`을 10s → 200s → 10,000s로 옮기며 턴 3회 → `AUGMENTER_CALLS=1`, 매 턴 `model='claude-sonnet-corp'`.
- **유령 entry 재현**(D18): 로그인 → 턴 성공 → `runtime.invalidate(undefined,'harness-settings-crud')`(= `handlers/engine.ts:38` 원문) → `catalog.list()`는 `['claude-corp']` 그대로 · `resolveTurnProvider`가 `Runtime model cache is unavailable for "claude-corp"` throw · 같은 snapshot으로 재reconcile해도 `resolvedRevision` 동일이라 fetch 수 1 유지 · 턴은 계속 throw.
- **변이 재측정**(신규/수정 테스트가 동작을 잠그는가):

  | # | 변이 | 결과 |
  |---|---|---|
  | M1 | `!verified \|\| status!=='valid'` → `!verified` | 2 실패 — **잠김**(r3 미검출 → 닫힘) |
  | M2 | `DEFAULT_FAMILY_ORDER` sonnet,haiku,opus → sonnet,opus,haiku | 1 실패 — 잠김 |
  | M3 | `markDefaultModel`의 `?? models[0]` 폴백 제거 | **77/77 통과 — 잠기지 않음** |
  | M4 | `normalizeAvailableModels`의 `markDefaultModel` 호출 제거 | 2파일 실패 — 잠김 |
  | M5 | `runtimeManaged` 분기 제거(항상 `resolve`) | 1 실패 — 잠김 |
  | M6 | `mergeAgentEnvironments` 인자 순서 반전 | 1 실패 — 잠김 |
  | M7 | `cached()`가 `usable()`을 보도록 변경 | 1 실패 — 잠김 |

- 0건 기준: `RUNTIME_MODEL_CONTRIBUTIONS`가 비어 있어 runtime 축의 "0건"은 전수가 아니라 **미배포**다 — 통과 근거로 쓰지 않았다. D18·D20의 사용자 영향도 같은 이유로 현재 배포에서는 잠재적이다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| Engine read-only 배지 | `canMutate` 분기·i18n ko/en 키·IPC 4종 거부를 코드와 테스트로 확인 | 두 테마의 배지 대비와 버튼 부재 | 앱 → 엔진 & 모델 → 라이트/다크 전환 |
| 로그인 → 카드 출현/제거 | catalog 상태 기계는 주입 테스트로 전건 | 실제 Gate 로그인·revoke 왕복 | contribution을 선언한 폐쇄망 배포에서만 가능 |

- 사람에게 넘기지 않은 것: 분류·순서·기본 선택·선택 화해·fetch 횟수·cache 수명·read-only 판정·shape guard는 전부 순수 함수 또는 주입 seam으로 기계 검증했다. D18은 electron 없이 `resolveTurnProvider` + 실제 service로 재현했다.
- `bootstrap.ts` 배선은 electron import 때문에 이 환경에서 테스트 불가다. **다만 bridge seam이 이미 있으므로 "electron이라 불가"가 아니라 "bootstrap이 bridge를 그렇게 쓴다"만 미관측이다**(AC6·AC11의 ⚠️ 근거, r3과 동일).

## 9. 게이트 재실행

- 실제 실행 명령: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts` · `npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(--fix 없이) · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `git diff --check`.
- **관측한 실행 산출**:
  - `npm run typecheck` → **exit 2**. `typecheck:node`·`typecheck:web` 무출력, `typecheck:test`가 `runtime-catalog.test.ts` 56·75·89·119·145·161·172행에서 `error TS2741: Property 'cached' is missing` **7건**.
  - 같은 명령을 `e0517e0`(r4 직전)의 `app/src`로 되돌려 실행 → **exit 0 · error 0**. 회귀 주체는 `4be8f95`다.
  - eslint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, 이번 diff 무관 기존 건).
  - vitest 211파일 2087케이스(§7) · doc inventory 9 items·76 channels · `git diff --check` 무출력.
- `npm test` 미사용 — DB 동작 검증이 필요 없고 `pretest`가 ABI를 뒤집는다(`app/AGENTS.md`).
- **exit code를 통과 증거로 쓰지 않았다.** `--reporter=basic`은 vitest 4에 없어 `Failed to load custom Reporter` 이후 **0파일 실행**으로 끝났다 — 산출을 읽지 않았다면 이 실행을 결과로 옮길 뻔했다. 기본 리포터로 다시 돌려 파일 수·케이스 수를 관측했다.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`가 `--fix`라 eslint를 직접 호출했고 실행 후 `git status --short` 공란이다.
- **검증 중 실행한 명령의 잔여물**: `npm ci`가 만든 `node_modules`(gitignore 대상), 검증자가 심었다가 삭제한 임시 테스트 3벌(AC4 12배열·AC1 shape 8형태·AC13/유령 entry)과 변이 7건. 전부 `rm`/`git checkout`으로 되돌렸고 `git status --short` 공란을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료. **typecheck 회귀 적발** |
| AC ↔ production path | 14건 1:1 대조 완료, 1건 미충족·3건 부분 |
| 계약/레이어/문서 링크 | doc inventory·링크 통과, 외부 포트 문서 drift 1건 적발(D22) |
| 제품 의도 | D18의 "cache가 비면 목록에서도 감출 것인가, 재fetch를 허용할 것인가"는 **사람 결정** 후보 |
| UI 시각 품질 | AC9 두 테마만 사람 실기 대기 |
| PR merge | 사람 승인 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 diff는 `AGENTS.md`를 바꾸지 않았다 — 해당 없음.

### INDEX 보드 정합성

- 단계 `impl` · 상태 `IMPL_DONE (r4)` · 다음 주체 `Claude (재검증)` — 검증 착수 시점의 실제와 일치했다.
- 비고 4줄 — 5줄 이내 ✅.
- **대상 커밋 칸이 자리표시자를 갖는다**: `(r4 구현)`. 구현자가 자기 해시를 모르는 자리라 비워 둔 것이며, 이번 검증 커밋에서 `4be8f95`(r4)로 채운다.

### Commit / reference 정합성

- trailer 허용값: `4be8f95`는 `Agent: codex`·`Status: implemented`·`Criteria-Met/Pending`·`Verified-By: pending` — `git interpret-trailers --parse` 출력 6줄 전부 허용값이다.
- 인용 해시 실재: `803bd50`·`8e17aae`·`4be8f95`·`e0517e0`·`1a2c0c6` 전건 `git cat-file -t` → `commit`. 죽은 좌표 `fb04047`·`7fb771f`는 **보존된 라운드 원문과 파생 이슈 서술 안에만** 남아 있고 살아 있는 좌표 칸에는 없다.
- **D15의 재발 없음**: `4be8f95`는 규범 행 정정도 `verify.md`도 담지 않았다. 과거 커밋(`a5f06c4` 리터럴 `\n` trailer · `d479e7c`의 `Agent: codex`+`designed`)은 history rewrite 없이 남으며 그 판단은 유지한다.
- plan 메타 `상태` 행의 마크다운이 깨졌다 — `**verify/FAIL (r3) → **IMPL_DONE (r4)**`(볼드 중첩). 렌더가 어긋난다(D23).
- reference/script 이동·삭제: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "D11 / AC4 해결" | **타당** — 12배열 재측정으로 확인 | §5 AC4 ✅ |
| "D12 / AC13 해결" | **타당** — 만료 뒤 턴 3회에도 fetch 1회 | §5 AC13 ✅ |
| "D13 해결" | **타당** — 변이 M6이 검출한다 | §5 D-007 ✅ |
| "D14·D16 해결" | **타당** — IPC 문장이 코드와 맞고 변이 M1이 검출된다 | §6 · §5 AC7 |
| "강제 지점 22/22" | **일치** — 검증자 재측정도 22/22 | §5 §10 표 |
| "typecheck 3구성 PASS" | **사실과 다름** — exit 2 · 7 error | D17 |
| "설계 대비 차이 재유도"(runtime service cache 결합) | **불완전** — 만료 축은 다시 유도했으나 그 cache가 Auth 밖에서 비는 축은 유도하지 않았다 | D18 |
| "신규 파생 결함은 없다" | **아니오** — D17·D18·D19·D20·D21 | §13 |

## 13. 파생 이슈

- [ ] **D17 — `npm run typecheck`가 red다 (AC12·게이트)**. `cached(key)`를 `HarnessRuntimeConfigService`(필수 멤버)에 추가하고 `runtime-catalog.test.ts`의 fake 7곳(56·75·89·119·145·161·172행) 중 신규 1곳만 갱신했다. `error TS2741` 7건이고 `e0517e0`에서는 exit 0이다. vitest는 타입을 지우고 실행하므로 초록이었다 — 테스트 green이 typecheck를 대신하지 않는다. `.github/workflows/ci.yml`이 lint→typecheck→test 순이라 CI가 여기서 멈춘다.
- [ ] **D18 — Auth 밖 invalidate가 유령 entry를 만든다 (Part I §5 상태 전이표·§14·§10 4행)**. `harnessRuntime.invalidate` 3지점 중 `bootstrap.ts:488`(auth-change)만 뒤이어 `reconcile`이 재fetch한다. `handlers/engine.ts:38`은 **아무 harness settings CRUD 마다** `invalidate(undefined)`를 부르고, `bootstrap.ts:640`은 부팅에서 같은 일을 하는데 `:497`의 `attach`가 `void`라 경합한다. 결과: `states.cached`는 비고 `catalog.entries`는 남아 **목록·Composer에는 모델이 계속 보이는데 턴은 `Runtime model cache is unavailable`로 죽는다**. `resolvedRevision`이 그대로라 같은 스냅샷 재reconcile도 재fetch하지 않아 **Gate 재인증 전까지 회복 경로가 없다**. plan §14의 "유령 entry보다 미노출을 택한다"와 상태 전이표의 "추가 fetch 없이 동작한다"가 동시에 깨진다. 재현은 §7. **cache가 비면 entry도 감출지, 이 경로만 재fetch를 허용할지는 제품 결정**이라 해결안을 고르지 않는다.
- [ ] **D19 — `cached()`가 `sourceRevision`도 건너뛴다 (§2)**. `runtime-config.ts:216-218`은 `states.get(key)?.cached?.config`를 그대로 준다. 만료 무시는 D-008대로지만 settings 파일 변경(mtime) 재검증까지 함께 사라져, runtime-managed key에 settings 디렉터리가 함께 있으면 그 편집이 턴에 영원히 반영되지 않는다. `resolve()` 경로에만 있던 `sourceRevision` 대조를 의도적으로 버린 것인지 문서에 없다.
- [ ] **D20 — key 정규화가 세 소비처에서 갈린다 (§3)**. `isReadOnly`는 `trim().toLowerCase()`(`runtime-catalog.ts:129-131`), `cached()`와 `mergeAgentEnvironments`는 원문 key다. 배포가 `key:'claude-Corp'` 같은 비정규 contribution을 선언하고 `claude-corp` settings 디렉터리가 있으면 UI에 두 행이 남고 settings 행은 `runtimeManaged=true`·`cached()=undefined`로 실행 불가가 된다. settings 쪽 key는 `providerKeyOf`가 소문자화하므로(`settings-entries.ts:85`) 트리거는 배포 선언뿐이다.
- [ ] **D21 — `turn-setup.ts`가 같은 모듈을 두 번 import 한다 (r2 D9와 같은 축)**. `:11-16`과 `:18`이 모두 `../../features/harnesses/models`다. `eslint.config.mjs`에 `import/no-duplicates`가 없어 lint가 잡지 못한다.
- [ ] **D22 — `validUntil` 의미가 key 종류에 따라 갈리는데 가이드가 그대로다 (§6)**. catalog contribution key는 턴에서 만료를 무시하고 아닌 key는 종전대로 재resolve한다. `closed-network-extensions.md:610`의 예제는 `validUntil: config.expiresAt`를 그대로 권하고 `:444`의 6-a는 이 분기를 적지 않는다. 만료 token이 실린 `runtimeEnv`로 턴이 나가는 결과도 문서에 없다.
- [ ] **D23 — 좌표·형식 위생 2건**. INDEX 대상 커밋 칸의 `(r4 구현)` 자리표시자(이번 검증 커밋에서 `4be8f95`로 교정) · plan 메타 `상태` 행의 볼드 중첩 깨짐.
- [ ] **W1 — `markDefaultModel`의 `?? models[0]` 폴백이 잠기지 않는다**(변이 M3, §7). 전 항목이 custom인 배열에서 `isDefault`가 하나도 없게 돼도 구현자 스위트 77케이스가 전건 통과한다. 소비처(`modelSelection.ts:21`·`models.ts:37`)에 `?? models[0]` 폴백이 또 있어 선택은 살고 배지만 사라진다 — AC 밖의 관측 부족이라 별도로 적는다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **아니오**. r3이 남긴 D11~D14·D16은 전건 닫혔고(§12) 재측정으로 확인했다. 이번 미충족은 새 축이다.
- 새 축의 성격: **① 게이트 자기보고가 사실과 달랐다**(D17 — 구현 보고 "typecheck 3구성 PASS" ↔ exit 2). **② 이번 수정이 만든 새 표면을 스스로 검사하지 않았다**(D18 — `cached()`로 바꾸며 `invalidate` 호출자 3지점을 전수 확인하지 않음).
- 관련 plan 지침/AC의 존재 여부: D17은 AC12의 "정적 게이트"와 `app/AGENTS.md`의 기본 게이트가 이미 요구했다. D18은 §10 4행이 "cache miss 시 명시 실패"만 적고 cache 수명 소유자를 열거하지 않았다 — **지침 부재가 있는 쪽**이다.
- 사용자 결정 변경 근거: 이번 라운드에 Decision 변경 없음.
- 반복된 검증 환경 한계: GUI/X server 부재로 AC9 시각 확인은 이번에도 사람 몫이다. better-sqlite3 bindings 부재로 DB 5스위트는 이번에도 red다. `RUNTIME_MODEL_CONTRIBUTIONS`가 비어 있어 runtime 축은 실배포 인스턴스가 0이다.
- 현재 라운드: 4. 다음 재구현은 5라운드이고 **라운드 3을 초과하므로 재구현 전 `handoff-review`를 수행한다**(직전 review는 `1a2c0c6`, round 15).

## 15. 결론

- 상태: **FAIL**
- Product/UX 및 ACTIVE Decision 충족: D-001~D-007은 충족한다. r3이 미충족으로 남긴 **D-004·D-007은 닫혔다**. **D-008은 부분** — 로그인당 1회·턴 0회는 성립하지만 cache가 Auth 밖에서 비는 경로에 회복이 없다(D18).
- AC 충족: `✅ 10 · ⚠️ 3 · ❌ 1 = 총 14`. **AC4·AC13이 ❌ → ✅로 닫혔고 AC12가 ✅ → ❌로 열렸다**. 자기보고 `11/14`와는 AC12 한 칸이 갈린다.
- 강제 지점: 분모 **22**, 실효 **22/22**. r3의 미달 1행(로그인/세션 fetch)이 닫혔다.
- 기준 밖 결함: D18(유령 entry)·D19(`sourceRevision` 유실)·D20(key 정규화 비대칭)·D21(중복 import)·D22(문서 drift)는 AC 채점 밖에서 찾았다.
- repository operation checks: INDEX 자리표시자 1건·plan 메타 마크다운 1건. **r3의 D15 재발은 없다** — trailer·기준선 분리는 이번 커밋에서 지켜졌다.
- 남은 사람 확인: AC9 두 테마 시각, D18의 "cache 부재를 목록에서도 감출 것인가" 제품 결정.
- 다음 단계: **`handoff-review` 먼저**(라운드 3 초과), 그 뒤 재구현 — **D17을 먼저 닫고**(CI 게이트) D18을 제품 결정과 함께 처리한다. D19~D23·W1은 위생·관측이다.

---

# 라운드 3 — FAIL

## 0. 기준선 / plan 변경 확인

- **기준선이 diff로 성립하는가: 아니오.** r2 구현 커밋 `fb04047`이 저장소에 없다(`git cat-file -t fb04047` → `Not a valid object name`). 0198의 전체 이력은 `a5f06c4`·`d479e7c`(설계) · `803bd50`(r1) · `8e17aae`(r3) 4개다.
- 구현 커밋이 `plan.md`를 바꿨는가: **예, 규범 행까지**. `git show 8e17aae:…/plan.md`와 `803bd50:…/plan.md` 대조 결과 **AC2·AC3 재작성 + AC14 신설(분모 13→14)**이 `8e17aae` 안에서 일어났다.
- **r2 verify 문서 자체가 구현 커밋 산출이다.** `verify.md`(227줄)는 `8e17aae`에서 신규 추가됐다 — `Agent: codex` 커밋이 검증 판정을 담았다.
- 따라서 **"AC 변경 없음"을 확인할 수 없다.** §0의 자기 증명 방지 장치는 이번 라운드에도 작동하지 않는다.
- 채점에 사용할 원 기준: **현행 AC1~AC14 원문**(아래 인용으로 고정). 변경 방향은 완화가 아니라 강화라 r1 원 기준으로 채점해도 ❌ 항목은 같다.
  - AC4 원문: "정적 settings와 runtime config가 같은 중복 제거·분류·**기본 선택** 규칙을 쓴다." 검증 수단 "같은 배열이 양 producer에서 동일 `AgentModelView` 생성". **이 문장은 r1(`803bd50`)부터 한 글자도 바뀌지 않았다.**
  - AC13 원문: "로그인 후 새 세션을 여러 개 만들고 턴을 실행해도 contribution fetch 호출 수는 증가하지 않고 cache snapshot만 사용한다." **r1부터 불변이다.**
- Decision Ledger: D-001~D-008 모두 ACTIVE 유지, SUPERSEDED 0건.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | `availableModels: string[]`만 인정 | settings `model-parser.ts:55` ✅ · runtime `runtime-catalog.ts:87` ✅ (r3 신규) |
| D-002 | 같은 family 복수 항목 전부 보존 | `normalizeAvailableModels` 모델명 dedupe ✅ |
| D-003 | family 표시 `custom` · 실행값 self | `alias='custom'`·`model=self`(`available-models.ts:23-25`) ✅ |
| D-004 | 정적·동적이 같은 정규화 규칙 | 분류·dedupe 동일 · **기본 선택은 여전히 갈린다** ❌ (§5 AC4) |
| D-005 | 인증 성공 → read-only 항목 생성 | `runtime-catalog.ts:98-99` `source:'runtime'`·`readOnly:true` ✅ |
| D-006 | `AuthRuntime.subscribe` 트리거, polling 없음 | `bootstrap.ts:385` 구독 + `:497` bridge attach ✅ |
| D-007 | 두 UI가 같은 `orca:agent:list` 소비 | `useEngines.ts:31`·`useAgents.ts:12` ✅ · **턴 경로는 다른 병합 규칙** ❌ (§3) |
| D-008 | 로그인당 fetch 1회, 세션/턴은 cache만 | `validUntil` 선언 시 **턴이 재fetch한다** ❌ (§5 AC13) |

### end-to-end 흐름

```text
settings.json → parseClaudeModels ─┐
                                    ├→ mergeAgentEnvironments → agent:list → agentStore → EngineCard / ModelMenu
AuthChange(verified) → bridge → catalog.reconcile → runtime.resolve ─┘
                                                            ↓
                    turn-setup: [settings…, runtime…] concat → find(key) → harnessRuntime.resolve → SDK
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 부분 결함 | credential 만료(`validUntil`) 뒤 턴이 조용히 network fetch를 낸다(§5 AC13). |
| false success 가능성 | 없음(r2 건은 닫힘) | runtime 경계 shape guard를 7가지 형태로 재측정, 자동 모델 0건(§7). |
| partial failure/rollback | 정상 | reject는 해당 contribution만 제거하고 형제 entry는 남는다(`runtime-catalog.test.ts:136`). |
| Product/UX의 A가 아닌 B를 구현했는가 | **있음** | AC4가 요구한 "같은 기본 선택 규칙" 대신 producer마다 다른 규칙을 유지했다(§5 AC4). |
| 증상만 제거하고 상태가 남았는가 | 아니오 | catalog는 메모리 파생 상태뿐이다. |
| 최적화가 잃은 재검증 관측 | **있음** | 기존 `HarnessRuntimeConfigService` cache 재사용(구현자 명시 차이)이 만료 재fetch를 턴 경로로 들여왔다. |
| 출력/요청 worst-case 상한 | 계산됨 | 출력 = 입력 배열 길이 이하. 요청 = 로그인 1회 × contribution 수 **+ 만료마다 턴 1회**. |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 803bd50..8e17aae
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 스크립트 1a 공란. |
| 타입 전용 export 2건 | 정상 | `RuntimeModelCatalogBridge`는 factory 반환 타입, `EngineMutationState`는 기존 건이다. |
| 테스트 전용 참조 | 없음 | 스크립트 2 공란. |
| 형제 정책 비대칭 | 없음 | 스크립트 3 공란. |
| **producer ↔ consumer 파생 불일치** | **있음 2건** | ① 같은 배열의 default가 두 producer에서 갈린다(AC4). ② key 충돌 시 `agent:list`는 runtime 행, 턴은 settings 행을 쓴다(D13). |
| 동일 규칙 중복 구현 | 의도된 2사본 | `modelKey`가 main `models.ts:11`·renderer `modelSelection.ts:10`에 있다. 프로세스 경계라 공유 불가, 식은 동일하다. |
| 배선됐으나 인스턴스 0 | 사실 기록 | `RUNTIME_MODEL_CONTRIBUTIONS = []`(`harness-runtime.ts:118`). 참조는 `bootstrap.ts` 3곳뿐이라 **기본 배포에서 runtime 축은 동면한다** — runtime 관련 판정은 전부 주입 contribution 기준이다. |

## 4. 기존 테스트 / semantic 검증 확인

- 신규 테스트가 production 심볼을 부르는가: 예. `runtime-catalog.test.ts`는 `createRuntimeModelCatalog`/`createRuntimeModelCatalogBridge`를, `turn-setup.runtime-catalog.test.ts`는 실제 `resolveTurnProvider`를 부른다 — 로컬 재구현 없음.
- **자기보고를 대조의 출발점으로만 썼다.** 구현자 "강제 지점 22/22"를 아래 §5에서 다시 셌고, 자기보고 게이트 수치는 §7에서 재실행했다.
- **테스트가 실제로 동작을 잠그는지 변이로 재측정했다.** 판정 기준을 한 단계 엄격하게 바꾼 셈이다(§7 변이 표) — 6건 중 5건은 잠기고 1건은 통과했다.
- `N회` 관측 주체: augmenter `vi.fn()` 호출 수 — 실제 fetch 주체와 일치한다.
- 순서 기준: `bootstrap.ts:385`(구독)이 `:428`(`authResume.run()`)보다 앞이고 `:497`이 bridge를 attach한다. **bootstrap을 import하는 테스트는 없다**(electron 의존) — bridge seam은 테스트가 있으나 bootstrap이 그 seam을 그렇게 쓴다는 사실은 코드 읽기로만 확인했다.

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 정확한 배열만 인정, 비배열은 자동 모델 0 | ✅ | 검증자 재측정 7형태(문자열·혼합배열·null·유사배열·중첩·숫자·객체배열) 전건 모델 0 | settings ✅ / runtime ✅ |
| AC2 | family 결정적 분류 + 같은 family 복수 보존 | ✅ | `available-models.test.ts:12,23` 2케이스 | parser → catalog |
| AC3 | custom은 `custom` 분류 + 실제 모델명 병기 + self 실행 | ✅ | `ModelMenu.tsx:56,62`·`EngineModelList.tsx:17,21` alias+model 2행 · `settings.test.ts:138` | catalog → 두 UI → turn-setup |
| AC14 | env 항목 선행 → `availableModels` 배열 순서로 추가 | ✅ | `model-parser.test.ts:13,25` · 변이 M4가 잡힌다 | settings env + availableModels |
| AC4 | 정적·동적이 같은 dedupe·분류·**기본 선택** 규칙 | ❌ | **검증자 실행**: 5배열 중 3배열에서 default가 갈린다(§7) | 두 producer가 다른 규칙 |
| AC5 | 인증 Harness LLM이 read-only로 등록 | ✅ | `runtime-catalog.test.ts:52` `readOnly:true·source:'runtime'` · 선언 key는 인증 전에도 read-only(`:152`) | Auth → catalog → agent:list |
| AC6 | 수동·자동 로그인 각각 fetch 정확히 1회 | ⚠️ | revision 단위 1회 ✅(`:52`) · 동시 합류 ✅(`:70`) · **bootstrap 배선 테스트 없음** | authResume/login → bridge → reconcile |
| AC7 | revoke·expired·unauthorized·unavailable·실패 시 해당 entry만 제거 | ✅ | 코드 5전이 전건 도달 · reject 격리 테스트 `:136` 신규 · **변이 M1이 통과**(D16) | AuthChange/failure → catalog |
| AC8 | 늦은 성공 폐기 + 재인증 새 fetch 1회 | ✅ | `:84` late success 폐기 · `:98` revision별 2회 | subscribe → generation fence |
| AC9 | Engine read-only 표시 + 액션 미제공 + IPC 거부 | ⚠️ | 배지·버튼 숨김 ✅(`EngineCard.tsx:20,33,41,50`) · ko/en ✅ · 가드 두 반쪽은 테스트 ✅ · **`assertMutable` 합성과 4 handler는 테스트 0** · 두 테마는 사람 실기 | agentStore → EngineCard / engine IPC |
| AC10 | Composer가 같은 집합 표시 + 사라진 선택 재화해 | ✅ | `selectionExists`가 `modelFamily==null`을 hydrate 상태로 인정 · 변이 M5가 잡힌다 | agentStore → Composer |
| AC11 | 재시작 시 grant만으로 미노출, verified 후 1회 fetch | ⚠️ | bridge catch-up ✅(`:42`)·pre-attach replay ✅(`:29`) · **restart 경로 자체는 테스트 없음** | restore → authResume → bridge |
| AC12 | 기존 CRUD·기본 3 alias 동작 회귀 없음 | ✅ | 전체 스위트에서 변경 관련 red 0(§7) · 세션 로드 provider 전환(r2 D2) 해소 | engine IPC → agent:list |
| AC13 | 세션 N·턴 M에서 fetch 증가 0 | ❌ | **검증자 실행**: augmenter가 `validUntil`을 선언하면 만료 후 턴에서 `AUGMENTER_CALLS=2` | login → cache → **턴이 재fetch** |

- **합계 재측정**: `✅ 9 · ⚠️ 3 · ❌ 2 = 총 14`. 자기보고는 `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14` — **분모 일치, 내역 불일치**.
- **합계 사본 대조**: 본문 14 ↔ 커밋 trailer `Criteria-Met: 13/14` ↔ INDEX 비고 "자기보고 AC 13/14" — 세 사본은 서로 일치하고 재측정과 갈린다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| exact `availableModels` shape | settings load·runtime resolve (2) | `model-parser.ts:55` · `runtime-catalog.ts:87` | **2/2** (r2 1/2 → 닫힘) |
| family + model identity + self | materialize 2 · 선택/표시 2 (4) | parser · catalog · main `modelKey` · renderer `modelKey` | 4/4 |
| runtime entry의 Auth 파생성 | verified·revoke·expired·unauthorized·failure (5) | `:71` 한 분기가 4전이, `:106` catch가 5번째 | 5/5 (관측 2/5 — D16) |
| 로그인당 fetch 1·세션 0 | login 1 · session create·turn setup (3) | `bootstrap.ts:397` ✅ · `misc.ts:42` cache read ✅ · **`turn-setup.ts:83`이 만료 시 fetch** | **2/3** |
| read-only provenance | DTO·UI·add·update·delete·read (6) | `models.ts:63`·`runtime-catalog.ts:98` · `EngineCard.tsx:20` · `engine.ts:54,66,74,80` | **6/6** (r2 실효 2/6 → 닫힘) |
| 두 UI 동일 snapshot | Engine·Composer (2) | `useEngines.ts:31` · `useAgents.ts:12` | 2/2 |

- **분모 재측정**: 2+4+5+3+6+2 = **22**. 실효 **21/22**. 자기보고 22/22와 1행 갈린다.
- 표에 없는데 같은 불변식이 필요한 지점: **기본 선택 규칙의 producer 간 동일성**. r2 verify가 같은 문장으로 지적했고 §10에 행이 추가되지 않아 이번에도 아무도 강제하지 않았다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `RuntimeConfigAugmenter.resolve` → `availableModels?` | typecheck 3구성 통과 | `undefined`·`[]`·비배열·reject 모두 자동 entry 제거로 수렴 | ✅ (r2 지적 닫힘) |
| 같은 augmenter의 `validUntil` | 타입 ✅ | **가이드 예제와 코드가 어긋난다** — `closed-network-extensions.md:610`이 `validUntil: config.expiresAt`를 권장하는데 같은 문서 6-a행은 "새 세션/턴 fetch 금지"다 | ❌ (D12) |
| `AgentEnvironment.source/readOnly` | 타입 ✅ | `IPC_CONTRACT.md:69`가 "custom의 alias/model은 원문 self"라 적었으나 코드는 `alias='custom'`이다 | ❌ 문서 drift (D14) |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 전체 스위트: **211파일 중 206 통과 · 5 실패 / 2083케이스 중 2041 통과 · 42 실패**. r2 측정(210파일·2072케이스) 대비 +1파일·+11케이스로 신규 테스트 증가와 일치한다.
- 실패 5파일 = `infra/db/{queries,migrate}` · `extensions/builder` · `orchestration/fork` · `app/chat-turn.continuity`. `app/AGENTS.md`의 알려진 목록과 **정확히 일치**하고 42건 전부 `Could not locate the bindings file … better_sqlite3.node`다 — 같은 문서가 명시한 egress 차단 서명이다. 변경 무관.
- 대상 스위트 재측정: **12파일 / 97케이스 통과**(`harnesses`·`deployment`·`turn-setup.runtime-catalog`·`provider-key`·`modelSelection`). 자기보고 "18파일 124케이스"는 더 넓은 선택이라 모순이 아니다.
- doc inventory: **9 items · 76 channels** — 자기보고와 일치.
- **AC4 재측정**(두 production 함수를 같은 배열에 직접 호출):

  | 입력 배열 | settings default | runtime default |
  |---|---|---|
  | `claude-opus-4-1`, `claude-sonnet-4-5` | `claude-sonnet-4-5` | `claude-opus-4-1` |
  | `corp-private-v1`, `claude-sonnet-4-5` | `claude-sonnet-4-5` | `corp-private-v1` |
  | `claude-haiku-x`, `claude-sonnet-y` | `claude-sonnet-y` | `claude-haiku-x` |

  5배열 중 3배열이 갈린다. 원인은 `available-models.ts:28` `isDefault: normalized.length === 0`(배열 첫 항목) ↔ `model-parser.ts:98` `FALLBACK_ORDER` sonnet→haiku→opus다.
- **AC13 재측정**: augmenter가 `validUntil = now+60s`를 반환하고 로그인 1회 + 턴 2회(사이에 120초 경과)를 돌리면 `AUGMENTER_CALLS=2`다. `runtime-config.ts:128` `usable()`이 만료를 cache miss로 만들고 `turn-setup.ts:83`이 그대로 fetch한다.
- **변이 재측정**(신규 테스트가 동작을 잠그는가):

  | # | 변이 | 결과 |
  |---|---|---|
  | M1 | `!verified \|\| status!=='valid'` → `!verified` | **10/10 통과 — 잠기지 않음** |
  | M2 | `isReadOnly`에서 casing 정규화 제거 | 1 실패 — 잠김 |
  | M3 | runtime 경계 `availableModelsOf` 제거 | 1 실패 — 잠김 |
  | M4 | parser default를 첫 항목→마지막 항목 | 1 실패 — 잠김 |
  | M5 | `selectionExists`의 null-family 절 제거 | 1 실패 — 잠김 |
  | M6 | `mergeAgentEnvironments` 우선순위 반전 | 1 실패 — 잠김 |

- 0건 기준: `RUNTIME_MODEL_CONTRIBUTIONS`가 비어 있어 runtime 축의 "0건"은 전수가 아니라 **미배포**를 뜻한다 — 통과 근거로 쓰지 않았다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| Engine read-only 배지 | `canMutate` 분기·i18n ko/en 키를 코드로 확인 | 두 테마의 배지 대비와 버튼 부재 | 앱 → 엔진 & 모델 → 라이트/다크 전환 |
| 로그인 → 카드 출현/제거 | catalog 상태 기계는 주입 테스트로 전건 | 실제 Gate 로그인·revoke 왕복 | contribution을 선언한 폐쇄망 배포에서만 가능 |

- 사람에게 넘기지 않은 것: 분류·순서·선택 화해·fetch 횟수·read-only 판정·shape guard는 전부 순수 함수 또는 주입 seam으로 기계 검증했다.
- `bootstrap.ts` 배선은 electron import 때문에 이 환경에서 테스트 불가다. **다만 bridge seam이 이미 있으므로 "electron이라 불가"가 아니라 "bootstrap이 bridge를 그렇게 쓴다"만 미관측이다**(AC6·AC11의 ⚠️ 근거).

## 9. 게이트 재실행

- 실제 실행 명령: `npm ci --ignore-scripts` · `npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(--fix 없이) · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `git diff --check`.
- **관측한 실행 산출**: typecheck 3구성 전건 무출력 · eslint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, 이번 diff 무관 기존 건) · vitest 211파일 2083케이스 · doc inventory 9 items·76 channels · `git diff --check` 무출력.
- `npm test` 미사용 — DB 동작 검증이 필요 없고 `pretest`가 ABI를 뒤집는다(`app/AGENTS.md`).
- 환경 기인 실패 분리 근거: §7의 5파일·42케이스가 전부 bindings 부재 서명이며 `app/AGENTS.md`의 실측 5파일 목록과 일치한다.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`가 `--fix`라 eslint를 직접 호출했고 실행 후 `git status --short`가 공란이다.
- **검증 중 실행한 명령의 잔여물**: `npm ci`가 만든 `node_modules`(gitignore 대상)와 검증자가 심었다가 삭제한 임시 테스트 4벌(AC4·key 충돌·AC13·shape guard) 및 변이 6건. 전부 `git checkout`/`rm`으로 되돌렸고 `git status --short` 공란을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료 |
| AC ↔ production path | 14건 1:1 대조 완료, 2건 미충족·3건 부분 |
| 계약/레이어/문서 링크 | 기계 검증 통과, 문서 drift 1건 적발(D14) |
| 제품 의도 | D11의 "기본 선택 주체를 env가 갖는가 배열 순서가 갖는가"는 **사람 결정** 후보 |
| UI 시각 품질 | AC9 두 테마만 사람 실기 대기 |
| PR merge | 사람 승인 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 diff는 `AGENTS.md`를 바꾸지 않았다 — 해당 없음.

### INDEX 보드 정합성

- 상태 `impl/IMPL_DONE (r3)` · 다음 주체 `Claude (재검증)` — 실제와 일치했다.
- 비고 4줄 — 5줄 이내 ✅.
- **대상 커밋 칸이 죽은 좌표를 갖는다**: `fb04047`(r2)가 실재하지 않는다. r2 verify가 D10으로 지적한 좌표 위생이 plan 본문(`7fb771f`→`803bd50`)에서만 고쳐지고 보드에는 남았다. 이번 검증 커밋에서 `803bd50`(r1) · `8e17aae`(r3)로 바로잡는다.

### Commit / reference 정합성

- trailer 허용값: `8e17aae`는 `Agent: codex`·`Status: implemented`·`Criteria-Met/Pending`·`Verified-By: pending` — 전부 허용값이다.
- **`a5f06c4`의 trailer가 파싱되지 않는다.** 본문이 리터럴 `\n` 문자열 한 줄이라 `git interpret-trailers --parse` 출력이 **공란**이다. 메시지 버스에서 이 설계 커밋은 보이지 않는다.
- **`d479e7c`가 `Agent: codex` + `Status: designed`다.** root `AGENTS.md`의 설계 커밋 행은 `Agent: claude`다.
- **설계·검증 산출이 구현 커밋에 들어 있다.** `8e17aae`가 규범 행 정정(AC2·AC3·AC14)과 r2 `verify.md` 신규 227줄을 함께 담았다 — r2에서 같은 지적(D10)을 받은 패턴이 반복됐다.
- 인용 해시 실재: plan `[구현자 기입] 구현 보고`의 `803bd50` ✅ 실재. INDEX의 `fb04047` ❌ 부재.
- reference/script 이동·삭제: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "D1~D10을 전건 닫았다" | **부분** — D2·D3·D4·D6·D7·D8·D9는 변이로 잠김 확인, D1은 증상만 닫히고 AC4는 미충족 | §5 AC4 · D11 |
| "D1은 `ANTHROPIC_DEFAULT_<FAMILY>_MODEL` 선행 구성이 default 우선권도 가진다" | 타당하나 **settings 쪽에만 적용됐다** | runtime은 여전히 배열 첫 항목 |
| "강제 지점 22/22" | **21/22** — 턴 경로가 만료 시 fetch한다 | §5 §10 표 4행 |
| "실제 turn cache 경로를 테스트" | 타당 — `resolveTurnProvider`를 직접 부른다 | 다만 만료 케이스가 없다(D12) |
| "기존 `HarnessRuntimeConfigService` cache와 결합"(설계 대비 차이) | **이 차이가 AC13 미충족의 원인이다** | D12 |
| "AC 자기보고 13/14" | **불일치** — 재측정 ✅9·⚠️3·❌2 | §5 |

## 13. 파생 이슈

- [ ] **D11 — 두 producer의 기본 선택이 여전히 갈린다 (AC4·D-004)**. `available-models.ts:28`은 배열 첫 항목을, `model-parser.ts:98`은 `FALLBACK_ORDER` sonnet→haiku→opus를 default로 만든다. 5배열 중 3배열에서 결과가 다르다(§7). r2 D1이 같은 AC를 지적했고 settings 쪽 first/last만 고쳐졌다. **§10에 "기본 선택 규칙 동일성" 행이 없어 강제 지점이 비어 있다** — 행 추가와 함께 닫아야 한다. env 항목이 default 우선권을 갖는 규칙을 runtime에도 줄지는 제품 결정이다.
- [ ] **D12 — 만료 credential에서 턴이 재fetch한다 (AC13·D-008·§10 4행)**. augmenter가 `validUntil`을 반환하면 `runtime-config.ts:128` `usable()`이 cache miss를 만들고 `turn-setup.ts:83`이 그대로 network를 탄다. 재현: 로그인 1회 + 턴 2회(사이 만료) → `AUGMENTER_CALLS=2`. **`closed-network-extensions.md:610`의 권장 예제가 정확히 이 구성**(`validUntil: config.expiresAt`)이라 같은 문서 6-a행의 "새 세션/턴 fetch 금지"와 어긋난다. 재fetch 시 catalog는 갱신되지 않아 `agent:list`는 옛 모델 목록을 계속 준다.
- [ ] **D13 — key 충돌 시 목록과 실행이 다른 행을 쓴다 (D-007)**. `misc.ts:42`는 `mergeAgentEnvironments`로 runtime 행을 남기지만 `turn-setup.ts:52-61`은 단순 concat 뒤 `find`라 **settings 행**을 고른다. 재현: 같은 key의 settings·runtime entry에서 UI는 `runtime-model`, 턴은 `settings-model`을 실행한다. r2 D8이 두 소비처 중 하나만 닫았다.
- [ ] **D14 — `IPC_CONTRACT.md:69`가 코드와 어긋난다**. "custom의 alias/model은 원문 self다"라고 적혀 있으나 D-003 재정의 뒤 코드는 `alias='custom'`·`model=self`다(`available-models.ts:23-25`). r1에 쓴 문장이 r2 규범 변경 뒤 갱신되지 않았다.
- [ ] **D15 — 커밋/좌표 위생 4건**. INDEX 대상 커밋 `fb04047` 부재 · `a5f06c4` trailer가 리터럴 `\n`이라 `interpret-trailers` 출력 0건 · `d479e7c`가 `Agent: codex` + `Status: designed` · `8e17aae`가 규범 행 정정과 r2 `verify.md`를 구현 커밋에 담았다(r2 D10과 같은 축).
- [ ] **D16 — AC7의 원인별 제거가 테스트로 잠기지 않는다**. `runtime-catalog.ts:71`의 `!verified || status!=='valid'`에서 뒤 항을 지워도 10케이스 전건 통과한다(변이 M1). 유일한 unusable 케이스가 `status:'none'`과 `verified:false`를 동시에 뒤집어 두 피연산자가 분리되지 않는다. `status:'expired'`·`'unknown'`을 `verified:true`와 함께 넣는 케이스가 필요하다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **예 2건**. D11은 r2 D1과 같은 AC4 축이고, D13은 r2 D8과 같은 key 충돌 축이다. 둘 다 지적된 증상 하나만 닫히고 AC/불변식 전체로 올라가지 않았다.
- 관련 plan 지침/AC의 존재 여부: D11은 AC4가, D12는 AC13·D-008·§10 4행이, D13은 D-007이 이미 요구했다 — 지침 부재가 아니다.
- 사용자 결정 변경 근거: 이번 라운드에 Decision 변경 없음. r2의 D-002·D-003 재작성 근거는 plan §3 갱신 메모의 "사용자 후속 결정"이며 **커밋 이력이 없어 검증 범위에서 확인할 수 없다**(§0).
- 반복된 검증 환경 한계: GUI/X server 부재로 AC9 시각 확인은 이번에도 사람 몫이다. better-sqlite3 bindings 부재로 DB 5스위트는 이번에도 red다. `RUNTIME_MODEL_CONTRIBUTIONS`가 비어 있어 runtime 축은 실배포 인스턴스가 0이다.
- 현재 라운드: 3. **다음 재구현 전에 `handoff-review`를 수행한다**(라운드 3 초과).

## 15. 결론

- 상태: **FAIL**
- Product/UX 및 ACTIVE Decision 충족: D-001·D-002·D-003·D-005·D-006은 충족한다. **D-004·D-007·D-008은 미충족**이다.
- AC 충족: `✅ 9 · ⚠️ 3 · ❌ 2 = 총 14`. 자기보고 `13/14`와 내역이 갈린다.
- 강제 지점: 분모 **22**, 실효 **21/22**. r2의 미달 2행(exact shape·read-only)은 닫혔고 로그인/세션 fetch 행이 새로 열렸다.
- 기준 밖 결함: D13(목록과 실행이 다른 행)·D14(문서 drift)·D16(변이 미검출)은 AC 채점 밖에서 찾았다.
- repository operation checks: INDEX 대상 커밋 1건 사망 · 설계 trailer 1건 파싱 불가 · 설계 커밋 주체 1건 불일치 · 설계/검증 산출이 구현 커밋에 혼입.
- 남은 사람 확인: AC9 두 테마 시각, D11의 기본 선택 주체 결정.
- 다음 단계: **`handoff-review` 먼저**(라운드 3 초과), 그 뒤 Codex 재구현 — D11·D12를 닫고 D13·D16으로 관측을 채운다. D14·D15는 위생이다.

---

# 라운드 2 — FAIL (원문 보존)

## 메타

| 항목 | 값 |
|---|---|
| slug | `0198-runtime-model-catalog` |
| 검증자 | Claude Code |
| 일자 | 2026-08-24 |
| 대상 커밋/range | `d479e7c..fb04047` (r1 `803bd50` + r2 `fb04047`) |
| 구현 전 plan 기준 | `d479e7c` (설계 갱신) |
| 라운드 | 2 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude Code |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: **예**. r1 `803bd50`이 `[구현자 기입]` 절을, r2 `fb04047`이 **규범 행**(D-002·D-003·AC2·AC3·§10 2행)을 바꾸고 **AC14를 신설**했다.
- **기준선이 diff로 성립하는가**: **부분**. 설계 커밋(`a5f06c4`·`d479e7c`)과 r1 구현은 갈라져 있으나, **r2의 규범 행 정정이 구현 산출과 같은 커밋(`fb04047`)에 들어 있다** — root `AGENTS.md`의 "설계 커밋은 구현 산출과 같은 커밋에 담지 않는다"에 어긋나며, r2 구간에서는 §0의 자기 증명 방지 장치가 작동하지 않는다.
- Decision Ledger 변경: D-002·D-003이 r2에서 재작성됐다. 방향은 **완화가 아니라 강화**다 — D-002는 "family 첫 일치"에서 "같은 family 항목 전부 보존"으로, D-003은 "alias=self"에서 "alias=`custom`·model=self"로 바뀌었고 AC14가 추가로 늘었다. 근거는 plan §2·§3의 "사용자 후속 결정"이다.
- AC 변경: AC2·AC3 재작성 + AC14 신설(분모 13 → 14). 자기 코드에 맞춘 완화는 관측되지 않는다.
- 채점에 사용할 원 기준: **현행 AC1~AC14 원문**. 변경이 요구를 넓히는 방향이라 r1 원 기준으로 채점해도 결과는 같다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | `availableModels: string[]`만 인정 | settings: `settings-entries.ts:51` → `availableModelsOf` ✅ · runtime: `runtime-catalog.ts:58` **guard 없음** ❌ |
| D-002 | 같은 family 복수 항목 전부 보존 | `normalizeAvailableModels` 모델명 기준 dedupe → 보존 ✅ |
| D-003 | family 표시 `custom` · 실행값 self | `modelKey = model ?? alias` (main·renderer 2사본) ✅ |
| D-004 | 정적·동적이 같은 정규화 규칙 | 분류·dedupe는 동일, **기본 선택은 갈린다** ❌ (§5 AC4) |
| D-005 | 인증 성공 → read-only 항목 생성 | `reconcile` → `entries` → `agent:list`, `readOnly:true` ✅ (mutation 거부는 우회 가능) |
| D-006 | `AuthRuntime.subscribe` 트리거, polling 없음 | `bootstrap.ts:382-395` + 부팅 catch-up `:496` ✅ |
| D-007 | 두 UI가 같은 `orca:agent:list` 소비 | `useAgents`·`useEngines` 모두 agentStore + `providerApi.onState` ✅ |
| D-008 | 로그인당 fetch 1회, 세션은 cache만 | `inFlight`+`resolvedRevision` 단일 비행 ✅ · `turn-setup.ts:54` cache read ✅ |

### end-to-end 흐름

```text
settings.json → parseClaudeModels → toAgentEnvironments ─┐
                                                          ├→ agent:list → agentStore → EngineCard / ModelMenu
AuthChange(verified) → reconcile → runtime.resolve 1회 ──┘                              ↓
                                                                          turn-setup(list, fetch 0) → modelNameForFamily → SDK
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 부분 결함 | augmenter가 배열이 아닌 값을 주면 예외 없이 **가짜 모델**이 생긴다(§5 AC1). |
| false success 가능성 | **있음** | `availableModels:'abc'` → `custom/a`·`custom/b`·`custom/c` 3항목이 두 UI에 노출된다. |
| partial failure/rollback | 정상 | resolve reject는 해당 contribution만 제거하고 settings entry는 건드리지 않는다(검증자 재현). |
| Product/UX의 A가 아닌 B를 구현했는가 | **있음** | AC10의 "사라진 선택 재화해"가 **선택이 살아 있는 세션 로드까지** 발동해 provider를 바꾼다(§5 AC10). |
| 증상만 제거하고 상태가 남았는가 | 아니오 | catalog는 메모리 파생 상태뿐이며 파일·DB 쓰기가 없다. |
| 최적화가 잃은 재검증 관측 | 아니오 | `credentialRevision` 변화마다 refetch하고 revoke가 `resolvedRevision`을 지운다. |
| 출력/요청 worst-case 상한 | 계산됨 | 출력 = settings 모델 + contribution별 `availableModels.length`. 요청 = 로그인 1회 × contribution 수, 세션/턴 추가 0. |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh d479e7c..fb04047
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 스크립트 1a 공란. |
| 테스트 전용 참조 8건 | **범위 밖(기존)** | `harness-runtime.ts`·`runtime-config.ts`의 8심볼은 0188 배포 확장점이며 이번 diff가 만든 것이 아니다. |
| 형제 정책 비대칭 | 없음 | 스크립트 3 공란. |
| 신규 등록값의 기존 소비처 | **회귀 1건** | `modelKey` 의미 변경(alias → 모델명)이 세션 로드 화해 경로를 깬다(§5 AC10·AC12). |
| producer ↔ consumer 파생 불일치 | **있음** | 두 producer가 같은 배열에서 서로 다른 `isDefault`를 만든다(§5 AC4). |
| 동일 규칙 중복 구현 | 의도된 2사본 | `modelKey`가 main `models.ts:11`과 renderer `modelSelection.ts:10`에 있다. 프로세스 경계라 공유 불가, 두 구현은 동일 식이다. |
| 죽은 분기 | **있음** | `Composer.tsx:166` `providerKey && modelFamily == null` 분기는 도달 불가다 — 앞 분기가 항상 먼저 잡는다. |
| 배선됐으나 인스턴스 0 | 사실 기록 | `RUNTIME_MODEL_CONTRIBUTIONS = []`(`harness-runtime.ts:118`)이라 기본 배포에서 runtime catalog는 동면한다. `AUTH_INVALIDATED_HARNESS_KEYS = {}`와 같은 0188 배포 선언 패턴이라 결함으로 보지 않는다. |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 존재: `settings.test.ts`·`model-parser.test.ts`·`runtime-config.test.ts`·`auth-resume.test.ts` 모두 실재한다.
- 신규 테스트가 production 심볼을 부르는가: 예. `runtime-catalog.test.ts`는 `createRuntimeModelCatalog`를, `modelSelection.test.ts`는 `defaultSelection`/`selectionExists`를 직접 부른다 — 로컬 재구현 없음.
- **structural proxy만으로 통과한 AC**: AC13. `runtime-catalog.test.ts:86`은 `runtime.resolve(contribution)`를 두 번 직접 부르며, 실제 `resolveTurnProvider`나 세션 생성 경로를 지나지 않는다.
- **주장한 검증 수단이 없는 AC**: AC6·AC11이 말한 "auth-resume 배선 테스트"·"bootstrap 통합 테스트"가 **존재하지 않는다**. `grep -rn "runtimeModelCatalog|RUNTIME_MODEL_CONTRIBUTIONS" src --include=*.test.ts` → `runtime-catalog.test.ts` 단일 파일.
- `N회` 관측 주체: `vi.fn()` augmenter 호출 수로 단언한다 — 실제 fetch 주체와 일치한다.
- 순서 기준: `bootstrap.ts:382`(구독)이 `:425`(`authResume.run()`)보다 앞이다. 다만 `runtimeModelCatalogRef.current` 대입은 `:494`라 그 사이 이벤트는 catalog에 닿지 않으며, `:496`의 부팅 catch-up 루프가 그 창을 덮는다. **이 순서를 잠그는 테스트는 없다.**

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 정확한 배열만 인정, 비배열은 자동 모델 0 | ❌ | 검증자 재현: runtime 경계에 `availableModels:'abc'` → `custom/a·b·c` 3항목 생성 | settings ✅ / augmenter ❌ |
| AC2 | family 결정적 분류 + 같은 family 복수 보존 | ✅ | `available-models.test.ts` 3케이스 · 검증자 재현 `sonnet-a`·`sonnet-b` 동시 보존 | parser → catalog |
| AC3 | custom은 `custom` 분류 + 실제 모델명 병기 + self 실행 | ✅ | `ModelMenu.tsx:56,62` alias+model 2행 · `EngineModelList.tsx:18,21` · `modelNameForFamily(custom,'orca-private-v1')='orca-private-v1'` | catalog → UI → turn-setup |
| AC14 | env 항목 선행 → `availableModels` 배열 순서로 추가 | ✅ | 검증자 재현: `env-sonnet` → `claude-sonnet-4-5` → `claude-sonnet-4-6` 순서 일치 | settings env + availableModels |
| AC4 | 정적·동적이 같은 dedupe·분류·**기본 선택** 규칙 | ❌ | 같은 배열에서 runtime default=`claude-sonnet-4-5`, settings default=`claude-sonnet-4-6` | 두 producer → normalizer |
| AC5 | 인증 Harness LLM이 read-only로 등록 | ⚠️ | 등록 ✅(`runtime-catalog.test.ts`) · mutation 거부는 우회 가능(§5 강제 지점) · 기본 배포 인스턴스 0 | Auth → catalog → agent:list |
| AC6 | 수동·자동 로그인 각각 fetch 정확히 1회 | ⚠️ | catalog 내부 단일 비행은 실증 ✅ · **배선 테스트 부재** | authResume/login → reconcile |
| AC7 | revoke·expired·unauthorized·unavailable·실패 시 해당 entry만 제거 | ✅ | 코드 5전이 전건 도달 · 구현자 테스트 4/5 · **fetch 실패 제거는 검증자가 심어 확인** | AuthChange/failure → catalog |
| AC8 | 늦은 성공 폐기 + 재인증 새 fetch 1회 | ✅ | `runtime-catalog.test.ts:61,75` 두 케이스가 fence 제거 시 실패한다 | subscribe → fence |
| AC9 | Engine read-only 표시 + 액션 미제공 + IPC 거부 | ⚠️ | 배지·버튼 숨김 ✅(`EngineCard.tsx:20,34`) · ko/en 2언어 ✅ · **IPC 거부 우회 가능** · 두 테마 시각은 사람 실기 | agentStore → EngineCard |
| AC10 | Composer가 같은 집합 표시 + 사라진 선택 재화해 | ❌ | 재화해가 과잉 발동해 **세션 로드 시 provider가 바뀐다**(아래 D2) | agentStore → Composer |
| AC11 | 재시작 시 grant만으로 미노출, verified 후 1회 fetch | ⚠️ | 코드 경로 정합(`verified`는 비영속 + 부팅 catch-up) · **테스트 부재** | restore → authResume → catalog |
| AC12 | 기존 CRUD·기본 3 alias 동작 회귀 없음 | ❌ | env-only parser 경로는 기존 테스트 전건 통과 · **세션 로드 provider 전환이 회귀**(D2) | engine IPC → agent:list |
| AC13 | 세션 N·턴 M에서 fetch 증가 0 | ⚠️ | `turn-setup.ts:54`는 cache read ✅(코드) · 테스트는 `runtime.resolve` 직접 호출 프록시 | login → cache → turn |

- **합계 재측정**: `✅ 5 · ⚠️ 5 · ❌ 4 = 총 14`. 자기보고는 `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14` — 분모는 일치, **내역이 갈린다**.
- **합계 사본 대조**: 본문 14 ↔ 커밋 trailer `Criteria-Met: 13/14` ↔ INDEX 비고 "기계 AC 13/14" — 세 사본은 서로 일치하나 재측정과 다르다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| exact `availableModels` shape | settings load·runtime resolve (2) | settings `settings-entries.ts:51` ✅ · runtime `runtime-catalog.ts:58` **guard 없음** | **1/2** |
| family + model identity + self | materialize 2 · 선택/표시 2 (4) | parser · catalog · main `modelKey` · renderer `modelKey` | 4/4 |
| runtime entry의 Auth 파생성 | verified·revoke·expired·unauthorized·failure (5) | 판정 1분기(`!verified \|\| status!=='valid'`)가 4전이, `catch`가 5번째 | 5/5 (테스트 4/5) |
| 로그인당 fetch 1·세션 0 | login 1 · session create·turn setup 2 (3) | `bootstrap.ts:394` · `misc.ts:42` · `turn-setup.ts:54` 모두 cache read | 3/3 (배선 테스트 0/3) |
| read-only provenance | DTO·UI·add·update·delete·read (6) | 6지점 모두 존재하나 IPC 4지점이 **대소문자·공백 변형으로 우회** | **실효 2/6** |
| 두 UI 동일 snapshot | Engine·Composer (2) | `useEngines.ts:31` · `useAgents.ts:12` 둘 다 `onState → refreshAgents` | 2/2 |

- **분모 재측정**: 2+4+5+3+6+2 = **22**. 실효 닫힘 **17/22**. 구현자 r1 자기보고 `20/20`은 §10 2행이 r2에서 2→4로 늘기 전 분모이고, r2 보고(1/1·2/2·2/2·2/2)는 표와 다른 분해라 대조 불가다.
- 표에 없는데 같은 불변식이 필요한 지점: **기본 선택 규칙의 producer 간 동일성**. AC4가 요구하지만 §10에는 행이 없어 아무도 강제하지 않았다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `RuntimeConfigAugmenter.resolve` → `availableModels?` | 타입 추가 ✅ typecheck 통과 | `undefined`=미제공 ✅ · `[]`=제거 ✅ · reject=제거 ✅ | **런타임 shape 강제 없음** — 타입만으로는 §10 1행을 닫지 못한다 |
| `RuntimeModelContribution` 선언 | 타입 ✅ | 기본 배포 `[]` — 실 인스턴스 0 | 가이드 §6-a에 절차 기록 ✅ |
| `docs/guides/closed-network-extensions.md` | 단계 표에 6-a 추가 | 로그인당 1회·세션 fetch 금지 명시 | ✅ |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 관련 스위트 재측정: **16파일 / 110케이스 통과**(`harnesses`·`deployment`·`composer`·`engine`). 자기보고 r2 "5파일 39케이스"는 더 좁은 선택이다.
- 전체 스위트: **210파일 중 205 통과 · 5 실패 / 2072케이스 중 2030 통과 · 42 실패**.
- 실패 5파일 = `infra/db/{queries,migrate}` · `extensions/builder` · `orchestration/fork` · `app/chat-turn.continuity` — `app/AGENTS.md:135`의 알려진 ABI 베이스라인과 **정확히 일치**하며 전부 `Module did not self-register: better_sqlite3.node`다. 변경 무관.
- doc inventory 재측정: **9 items · 76 channels** — 자기보고와 일치.
- 출력 상한: `normalizeAvailableModels`는 입력 배열 길이를 넘지 않는다(dedupe만 감소). 요청 상한: contribution별 revision당 1회.
- 0건 기준: `RUNTIME_MODEL_CONTRIBUTIONS`가 비어 있어 runtime 축의 "0건"은 전수가 아니라 **미배포**를 뜻한다 — 그 사실을 통과 근거로 쓰지 않았다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| Engine read-only 배지 | `canMutate` 분기·i18n ko/en 키 존재를 코드로 확인 | 두 테마에서 배지 대비와 버튼 부재 | 앱 실행 → 엔진 & 모델 → 라이트/다크 전환 |
| 로그인 → 카드 출현 | catalog 상태 기계는 주입 테스트로 전건 | 실제 Gate 로그인·revoke 왕복 | contribution을 선언한 폐쇄망 배포에서만 가능 |

- 사람에게 넘기지 않은 것: 분류·순서·선택 화해·fetch 횟수·read-only 판정은 모두 순수 함수로 기계 검증했다.

## 9. 게이트 재실행

- 실제 실행 명령: `npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(--fix 없이) · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `git diff --check`.
- **관측한 실행 산출**: typecheck 3구성 전건 무출력 · eslint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, 이번 diff 무관 기존 건) · vitest 210파일 2072케이스 · doc inventory 9 items·76 channels.
- `npm test` 미사용 — DB 동작 검증이 필요 없고 `pretest`가 ABI를 뒤집는다.
- 환경 기인 실패 분리 근거: §7의 5파일이 전부 `better_sqlite3.node` self-register 실패이며 `app/AGENTS.md`의 알려진 목록과 일치한다.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`가 `--fix`라 eslint를 직접 호출했고, 실행 후 `git status`는 공란이다.
- **검증 중 실행한 명령의 잔여물**: `npm ci`가 만든 `node_modules`(gitignore 대상)와 검증자가 심었다가 삭제한 임시 테스트 3벌. 실행 후 `git status --short` 공란을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료 |
| AC ↔ production path | 14건 1:1 대조 완료, 4건 미충족 |
| 계약/레이어/문서 링크 | 기계 검증 통과 |
| 제품 의도 | 아래 D1의 "기본 선택을 env가 갖는가 discovery가 갖는가"는 **사람 결정** 후보 |
| UI 시각 품질 | AC9 두 테마만 사람 실기 대기 |
| PR merge | 사람 승인 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 diff는 `AGENTS.md`를 바꾸지 않았다 — 해당 없음.

### INDEX 보드 정합성

- 상태 `impl/IMPL_DONE (r2)` · 다음 주체 `Claude (검증)` — 실제와 일치했다.
- 비고 4줄 — 5줄 이내 ✅.
- 대상 커밋 칸이 `803bd50`(r1) · **(r2 구현)** 으로 r2 해시가 비어 있다. 같은 커밋에서 자기 해시를 쓸 수 없는 제약이라 이번 검증 커밋에서 채운다.

### Commit / reference 정합성

- trailer 허용값: `Agent: codex` · `Status: implemented` · `Criteria-Met/Pending` · `Verified-By: pending` — 전부 허용값이다.
- **인용 해시 실재: 실패**. plan `[구현자 기입] 구현 보고`의 대상 커밋 `7fb771f`가 존재하지 않는다(`git cat-file -t 7fb771f` → `Not a valid object name`). 실제 r1은 `803bd50`이다.
- **커밋 type 오표기**: r1 `803bd50`은 production 20파일·신규 모듈 2개를 담은 기능 커밋인데 제목이 `docs(models):`다. `git log` 고고학이 이 라운드를 문서 커밋으로 읽는다.
- **설계·구현 동일 커밋**: r2 `fb04047`이 규범 행 정정과 구현을 함께 담았다(§0).
- reference/script 이동·삭제: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "§10 read-only는 3곳이 아니라 6곳" | **타당** — 실측 6지점 확인 | 분모 22로 재계산 |
| "선언 key 자체를 불변 read-only로 판정" | **타당** — `isReadOnly`가 인증 상태와 무관하다 | 다만 키 정규화 누락으로 실효가 깨진다(D4) |
| "catalog `onChange`에서 provider state 재push" | 타당 | `bootstrap.ts:492` 확인 |
| "기존 `HarnessRuntimeConfigService` cache와 결합" | 타당한 설계 대비 차이 | warm-cache 테스트로 뒷받침 |
| "custom 문자열이 SDK에 전달되지 않는다" | **타당** — `modelNameForFamily`가 model 우선 | ✅ |
| "AC 자기보고 13/14" | **불일치** — 재측정 ✅5·⚠️5·❌4 | §5 |

## 13. 파생 이슈

- [ ] **D1 — 두 producer의 기본 선택이 갈린다 (AC4)**. `parseClaudeModels`의 `byAlias = new Map(visible.map(m => [m.alias, m]))`(`model-parser.ts:97`)가 같은 alias에서 **마지막 항목**을 남겨, 자기 주석의 "노출 항목 중 첫 항목"과 반대로 동작한다. 같은 배열이 runtime에서는 `claude-sonnet-4-5`, settings에서는 `claude-sonnet-4-6`을 default로 만든다. env로 명시 구성한 모델이 discovery 항목에 default를 빼앗기는 것이 제품 의도인지 확인이 필요하다.
- [ ] **D2 — 세션 로드가 provider를 바꾼다 (AC10·AC12 회귀)**. `LOAD_SESSION`은 `providerKey`만 복원하고 `modelFamily`는 `initialChatState`의 `null`이다(`chatReducer.ts:666-672`). `modelKey`가 절대 `null`을 반환하지 않으므로 `selectionExists`는 이 상태에서 **항상 false**이고, `Composer.tsx:153` 분기가 `defaultSelection(agents, backend)` — 즉 **첫 supported provider** — 로 화해한다. 저장된 provider가 목록 첫 항목이 아니면 다음 턴이 다른 provider·credential로 나간다. `Composer.tsx:166`의 원래 분기는 이 때문에 도달 불가가 됐다.
- [ ] **D3 — runtime 경계에 exact-shape guard가 없다 (AC1 · §10 1행)**. `runtime-catalog.ts:58`이 `availableModelsOf` 없이 `config.availableModels ?? []`를 그대로 정규화한다. 문자열 `'abc'`는 문자 단위로 순회돼 `custom/a`·`custom/b`·`custom/c`를 만들고, `['sonnet-a', 7]`은 `raw.trim()` TypeError로 **유효 항목까지 통째로** 사라진다.
- [ ] **D4 — mutation 가드가 키 정규화 전 값을 본다 (§10 5행)**. `engine.ts`의 `assertMutable`은 add에서 `` `${req.engine}-${req.provider}` `` 원본을, update/delete/read에서 `req.key` 원본을 본다. 그러나 `settings-write.ts:40`의 `normalizeProvider`가 `trim().toLowerCase()`를 적용하므로 `provider:'Corp'`·`key:'claude-Corp'`는 가드를 통과한 뒤 `claude-corp` 디렉토리를 건드린다. 재현: `isReadOnly('claude-corp')=true` · `isReadOnly('claude-Corp')=false` · `providerKeyOf('claude','Corp')='claude-corp'`.
- [ ] **D5 — AC6·AC11·AC13이 주장한 배선 테스트가 없다**. catalog를 참조하는 테스트 파일은 `runtime-catalog.test.ts` 하나이며 contributions를 직접 주입한다. bootstrap 구독 순서, authResume 경유 1회 fetch, `resolveTurnProvider` 경유 fetch 0은 코드 읽기로만 확인했다.
- [ ] **D6 — fetch 실패 제거 경로에 테스트가 없다**. 검증자가 reject fixture를 심어 정상 동작을 확인했다(entry 제거·다른 entry 보존). 구현자 테스트 5건 중 reject 케이스는 없다.
- [ ] **D7 — 테스트 이름이 단언과 어긋난다**. `available-models.test.ts:26` "deterministically keeps **the first model per family**"인데 단언은 `sonnet-a`·`sonnet-b` 둘 다 보존이다. r1 이름이 r2 의미 변경 후 남았다.
- [ ] **D8 — `agent:list`가 key 충돌을 병합하지 않는다**. `misc.ts:42`가 settings entry와 runtime entry를 단순 concat하므로 같은 key가 양쪽에 있으면 두 행이 나오고 renderer의 `key={agent.key}`가 중복된다. D4를 닫으면 생성 경로는 막히지만 디스크에 이미 있는 디렉토리는 남는다.
- [ ] **D9 — 위생 2건**. `useEngines.ts:7-8`이 같은 모듈에서 두 줄로 import한다. `availableModels` 항목의 `[1m]` 접미사는 `stripOneMillion`을 지나지 않아 env 경로와 의미가 갈린다(모델명에 접미사가 남고 `oneMillionContext`는 false).
- [ ] **D10 — 좌표/커밋 위생 3건**. plan이 인용한 `7fb771f`가 실재하지 않는다 · r1 `803bd50`이 기능 커밋인데 제목이 `docs(models):`다 · r2 `fb04047`이 규범 행 정정과 구현을 한 커밋에 담았다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: r1의 verify가 없어 대조할 판정이 없다. r2는 사용자 피드백이 만든 라운드이지 verify/FAIL 후속이 아니다.
- 관련 plan 지침/AC의 존재 여부: D1은 AC4가, D2는 AC10·AC12가, D3은 AC1과 §10 1행이, D4는 §10 5행이 이미 요구했다 — 지침 부재가 아니라 **강제 지점 표를 AC와 별개로 걷지 않은 결과**다.
- 사용자 결정 변경 근거: D-002·D-003 재작성은 plan §3 갱신 메모에 "사용자 후속 결정"으로 기록돼 있다. 검증 범위 밖의 대화는 확인할 수 없다.
- 반복된 검증 환경 한계: GUI/X server 부재로 AC9 시각 확인은 이번에도 사람 몫이다. better-sqlite3 ABI로 DB 5스위트는 이번에도 red다.
- 현재 라운드: 2. 다음 재구현 후 라운드가 3을 넘으면 `handoff-review`를 먼저 수행한다.

## 15. 결론

- 상태: **FAIL**
- Product/UX 및 ACTIVE Decision 충족: D-002·D-003·D-005~D-008은 충족한다. **D-001과 D-004는 미충족**이다.
- AC 충족: `✅ 5 · ⚠️ 5 · ❌ 4 = 총 14`. 자기보고 13/14과 갈린다.
- 강제 지점: 재측정 분모 **22**, 실효 **17/22**. exact-shape 1/2와 read-only 실효 2/6이 미달이다.
- 기준 밖 결함: D2(세션 로드 provider 전환)는 AC 밖이 아니라 AC12 회귀이고, 이번 라운드에서 가장 사용자 영향이 크다.
- repository operation checks: INDEX·trailer 허용값은 정합, **인용 해시 1건 사망 · 커밋 type 1건 오표기 · 설계/구현 동일 커밋 1건**.
- 남은 사람 확인: AC9 두 테마 시각, D1의 기본 선택 주체 결정.
- 다음 단계: **Codex 재구현** — D1~D4를 먼저 닫고 D5~D6으로 관측을 채운다. D7~D10은 위생이다.
