# Verify — 0215-plan-panel-and-model-selection-bugs

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0215-plan-panel-and-model-selection-bugs` |
| 검증자 | Claude Code |
| 일자 | 2026-09-03 |
| 대상 커밋/range | `ea983b1..b273832` |
| 구현 전 plan 기준 | `ea983b1` (설계 커밋, 구현과 분리) |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `ea983b1:V1` |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** |
| 자기 검증 여부 | **설계·구현·검증이 모두 Claude다** — §4에 구현 보고가 이름을 대지 않은 적대 축 5건을 추가했고, 그중 M-B가 이번 판정의 root다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: **예, 그러나 추가만이다** — `git diff ea983b1..b273832 -- plan.md`가 `@@ -613,3 +613,164 @@` 단일 hunk이고 삭제 줄 0이다.
- **기준선이 diff로 성립하는가**: **예**. 설계 `fc82344`·`ea983b1`과 구현 `b273832`가 갈려 §0의 자기 증명 방지 장치가 작동한다.
- Decision Ledger 변경: **없음**(D-001~D-017 ACTIVE 17건 불변).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음 — AC1~AC22 원문이 그대로다.
- V node/pair·requiredness·§10·oracle 변경: 없음.
- 채점에 사용할 원 기준: `ea983b1`의 §7 AC 표 22행 · §7-A pair registry 20행 · §10 강제 지점 19행/26사이트.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | `INDEX.md` 미완료 표에 선행 handoff 없음 — 상속할 V가 없어 Baseline이 맞다 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | **PLAN_GAP** | AR 노드 5개 중 **AR-04·AR-05에 `AR↔IT` pair가 없다**. AR-01→VP-03·AR-02→VP-10·AR-03→VP-07은 IT인데, AR-04는 VP-12·13(R↔AT)·VP-14(SD↔ST)·VP-15(MD↔UT)만, AR-05는 VP-18(`AR-05 ↔ AT-20`)만 갖는다 |
| 영향받은 INHERITED ↔ REGRESSION pair | 해당 없음 | Baseline V — INHERITED 노드 0 |
| pair별 path·§10 전수·직접 oracle | 유효 | 20 pair 전건이 path·전수 `N`·oracle 3열을 갖는다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | **PLAN_GAP** | 배선 주장인 VP-12·VP-19가 `not selected`다. 같은 성격의 VP-03·VP-07·VP-10에는 변이를 붙였으므로 판단 축이 일관되지 않는다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | gate 4종이 열거됐고 기존 DB-ABI red를 blocking으로 올리지 않았다 |

- root PLAN_GAP: **AR-04·AR-05의 `AR↔IT` pair 부재** → 영향 pair VP-12·VP-19(및 그 배선이 닿는 EP-12·EP-14·EP-19).
- V 도입 전 plan 아님 — 읽기 전용 합성 매핑 해당 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 3단 체인 | `plan` → 턴 서술 → `''` | `claude.ts:156 resolvePlanText(input, opts.getPlanNarrative?.())` |
| D-002 실패 표시 | 승인 대기 + 본문 없음 = 실패 문구 | `PlanTileContent.tsx:77 unavailable = enabled`(=`pendingPlanReview != null`) |
| D-005·D-006 explicit 편입 | 두 경로 모두 목록에 더한다 | `model-parser.ts:97` · `runtime-catalog.ts:125` |
| D-007·D-008 identity | `X`와 `X[1m]`이 다른 식별자 | `shared/model-identity.ts#modelIdentity`, `modelKey` 2곳이 위임만 한다 |
| D-009·D-010 haiku 강등 | 메뉴 제거 + `accept_edits` | `modes.ts:60` · `chatReducer.ts:1113` · `chatStore.ts:1233` · `send.ts:357` |
| D-013~D-017 타일 분리 | `작업`=agent만, 서브에이전트는 백그라운드 타일 | `taskBoard.ts:234` · `SubAgentTileContent.tsx:359` |

### end-to-end 흐름

```text
CLI can_use_tool(ExitPlanMode)
  → resolvePlanText(input, ctx.lastAssistantText)      # claude-map 이 같은 ctx 에 캡처·리셋
  → requestApproval({kind:'plan_review', plan})
  → reducer planContent → PlanTileContent
      본문 있음 → 마크다운 / 없음+승인대기 → 실패 문구 / 없음 → 기존 빈 상태
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ✅ 흡수 | 본문 미해소가 예외가 아니라 빈 문자열 + 실패 문구다. 승인/거부는 계속 동작 |
| false success 가능성 | ⚠️ 1건 | `send.ts:357`에서 `resolved.model`이 `undefined`면 강등이 침묵한다. 다만 `modelNameForFamily`가 bare alias(`haiku`)도 문자열로 반환해 실제로는 닿지 않는다 |
| partial failure/rollback | ✅ 해당 없음 | 파일·네트워크 쓰기 0 — §14 "새 요청 수 0"이 코드와 일치(`rg 'fetch\|writeFile' ` 신규 파일 0건) |
| Product/UX의 A가 아닌 B | ✅ A | 요구⑨의 "제외"를 §4가 판정한 대로 **삭제**로 구현했다 — `TaskBoardItem.background` 필드 자체가 없다 |
| 증상만 제거하고 상태가 남았는가 | ✅ 아니오 | EP-17 4사이트가 전수 제거됐다(§7 엄격화 재측정) |
| 최적화가 잃은 관측 | ✅ 없음 | `ctx.lastAssistantText`는 마지막 블록만 유지 — §14가 그 전제를 AC1로 고정했다 |
| 출력/요청 worst-case 상한 | ✅ 모델 1회 출력 × 1 | 누적이 아니라 대입(`claude-map.ts:418`) |

- **서브에이전트 오염 차단은 설계보다 넓다**: `claude-map.ts:418`이 `parentToolRunId === undefined`로 메인 에이전트 텍스트만 담는다. §10 EP-02는 이 조건을 요구하지 않았다 — 구현이 더 좁게 닫았고 `claude-map.test.ts:1519`가 그것을 단언한다.

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh ea983b1..b273832
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `classifyModel`·`matchesExplicit`·`AUTO_UNSUPPORTED_FALLBACK_MODE` 미사용 export | **불필요한 export** | 세 심볼 모두 정의 파일 밖 참조 0(`rg` 교차 검색). 동작 영향 0 — D3 NON_BLOCKING |
| `promptFromCall`(taskBoard import에서 제거) | 정상 | `SubAgentTileContent.tsx:167`이 여전히 소비 — 죽지 않았다 |
| `MODE_OPTIONS`·`TaskProgressList` 테스트 전용 | 정상 | 배럴/렌더 진입점이라 스크립트 오탐. `MODE_OPTIONS`는 `MODE_MENU_OPTIONS`·`MODE_LABEL_KEYS`의 원천 |
| 형제 정책 비대칭 | **없음** | 스크립트 0건. mock 어댑터의 `plan_review`는 시나리오 생성기라 `input.plan`을 읽지 않는다 — 체인 대상 아님 |
| 신규 등록값의 기존 소비처 영향 | 무영향 | `TaskDetailValue`에서 `durationMs`·`count` variant 제거 → exhaustive switch를 typecheck 3구성이 통과 |
| producer ↔ consumer 파생 불일치 | 없음 | `modelNameForFamily`가 `modelIdentity(selected)`를 그대로 반환 — 선택 식별자와 SDK 문자열이 같은 함수다 |
| 동일 규칙 중복 구현 | SSOT 유지 | `export function modelKey` 2곳이 **둘 다 본문 1줄 위임**이다(`models.ts:19`·`modelSelection.ts:18`) |

- **`explicitModelOf`의 trim 회귀 없음**: 교체된 `modelValue`가 `.trim()`을 했고, `stripOneMillion:98`도 `raw.trim()`을 먼저 한다 — 공백 처리 동치.

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: ✅ — `model-parser.test.ts` 불변식 케이스·`available-models.test.ts:23` 완전 중복 케이스·`taskSurface0212`·`taskTile0213` 모두 실재하고 green.
- 핵심 입력/분기가 실제 실행됨: ✅ — 0215 main측 14파일 241케이스 · renderer측 23파일 235케이스 개별 실행 green.
- structural proxy만으로 통과시킨 AC: **AC11·AC19** — 아래 M-B·M-G 참조.
- **선택된 적대 증거 재측정**: 등록 변이 **6건 중 검출 6** · 미검출 0 · 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1이라 해당 없음 — 덮개 회귀 0건.
- **자기검증 분모**(구현자 = 검증자): 보고에 없던 축 **5건**(M-A·M-B·M-C·M-F/M-H·M-G)을 만들었고 **4건이 green**이다.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| R1 `claude.ts`의 `getPlanNarrative` 인자 제거 | `src/main/adapters` | — | **red 1** | VP-03 등록 변이 |
| R2 `withExplicitModel` 본문 항등화 | `src/main/features/harnesses` | — | **red 5**(보고 3, 내 변이가 더 넓다) | VP-07 등록 변이 |
| R3 dedupe 키를 `entry.model ?? entry.alias`로 | 〃 | — | **red 2** | VP-09 등록 변이 |
| R4 renderer `modelKey`를 옛 식으로 | `src/renderer/.../chat` | — | **red 3** | VP-10 등록 변이 |
| R5 `send.ts` TurnRequest 지점만 복귀 | `src/main/app` | — | **red 1** | VP-14 등록 변이 |
| R6 파생에 background 복원 | `src/renderer/.../chat` | — | **red 14**(보고 13) | VP-17 등록 변이 |
| **M-A** `matchesExplicit`의 1M 축 검사 삭제(EP-06, 미보고 지점) | `src/main/features/harnesses` | — | **red 2** | 신규 축 — 잠김 |
| **M-B** Composer가 `<ModeMenu options=…>`를 안 넘김 | `src/renderer/.../chat` | — | **green 838/838** | **신규 축 — 잠금 없음 → D1** |
| **M-C** `send.ts` **controller** 지점만 복귀(형제 지점) | `src/main/app` | — | **red 1** | 신규 축 — 잠김 |
| **M-D** EP-03 턴 경계 리셋 삭제 | `src/main/adapters` | — | **red 1** | 신규 축 — 잠김 |
| **M-E** EP-18 배지 마킹 복원 | `src/renderer/.../chat` | — | **red 1** | 신규 축 — 잠김 |
| **M-F** Composer가 `setModel(…, null, …)` | `src/renderer/.../chat` | — | **green 838/838** | **신규 축 — 잠금 없음 → D1** |
| **M-G** `SubAgentTileContent`가 `stopErrors` prop 미전달 | `src/renderer/.../chat` | — | **green 838/838** | **신규 축 — 잠금 없음 → D1** |
| **M-H** Composer `selectedModel` memo가 `modelAlias: null` | `src/renderer/.../chat` | — | **green 838/838** | **신규 축 — 잠금 없음 → D1** |

- 동작 보존 추출 라운드인가: **아니오** — 신규 동작이라 hunk 되돌림 초록 문제는 해당 없음.
- 소거 변이의 잔여물 수렴: M-B·M-G는 **optional prop 삭제**라 잔여물이 없다(typecheck 통과). M-F·M-H는 `string | null`에 `null`을 넣어 진단 0이다 — 네 변이 모두 진단 0 상태의 게이트로 판정했다.
- 형제 슬롯 맞바꿈 변이: M-C가 EP-15의 형제 두 지점 중 보고가 안 건드린 쪽이다 — red 1로 두 지점이 각각 잠겼다.
- `N회` 기준의 실제 관측 주체: AC13의 "`setMode` 1회"는 `permissionApi.setMode` 프로덕션 2곳(`chatStore.ts:1233` 신규 강등 · `:1246` 기존 `setPermissionMode`)으로 분해되고, `chatStore.modelPermission.test.ts`가 강등 경로만 단언한다 — plan §7 주의사항과 일치.
- 순서 기준의 관측 훅: EP-02→EP-01 순서를 `claude.plan-narrative.test.ts`가 production `options.canUseTool`을 포획해 재현한다.

### D1 — 컨테이너 배선이 잠기지 않는다 (root)

네 변이가 모두 **프로덕션 배선 한 줄을 지우는데 838/838 green**이다. 코드는 옳고, 그 옳음을 지키는 장치가 없다.

- 공통 메커니즘: 이번 라운드가 만든 렌더 테스트는 **presentational 컴포넌트에 테스트가 스스로 조립한 props를 넣는다**. `modelMenu0215.render.test.ts:97`이 `options: modeMenuOptions(selectedModelShape([agent(models)], sel))`로 **Composer가 하는 조립을 테스트가 다시 만든다** — Composer가 그 줄을 잃어도 이 단언은 통과한다.
- 침묵의 원인은 **optional prop + 관대한 기본값**이다. `ModeMenu.options?`는 `options ?? MODE_MENU_OPTIONS`로, `SubAgentTaskList.stopErrors?`는 `= {}`로 폴백한다 — 배선 누락이 컴파일 오류가 아니라 조용한 동작 복귀가 된다.
- 제품 영향(M-B): haiku에서 '자동'이 메뉴에 다시 뜬다. `send.ts`의 D-011 2차 방어가 SDK로 `auto`가 나가는 것은 막지만, 칩은 '자동'인데 턴은 `accept_edits`로 도는 EP-13의 실패 의미가 그대로 재현된다.
- 제품 영향(M-F·M-H): `modelAlias` 축이 끊겨 `ANTHROPIC_DEFAULT_HAIKU_MODEL`로 선언한(이름에 haiku가 없는) 계열에서 강등이 멈춘다 — D-009가 두 축을 모두 보라고 한 바로 그 절반이다.
- 제품 영향(M-G): D-017이 존재하는 이유인 중단 실패 문구가 다시 0곳이 된다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-04 | MD-04 ↔ UT / UT | REQUIRED | PASS | `plan-text.test.ts` 4케이스 | 순수 / EP-01 1/1 |
| VP-11 | MD-01·MD-02 ↔ UT / UT | REQUIRED | PASS | `available-models.test.ts` · M-A red 2 | 순수 / EP-05·EP-06 2/2 |
| VP-15 | MD-03 ↔ UT / UT | REQUIRED | PASS | `permission-mode.test.ts` 4 + `model-identity.test.ts` 5 | 순수 / EP-12·13·15 4/4 |
| VP-20 | MD-05 ↔ UT / UT | REQUIRED | PASS | `taskBoard.test.ts` 반환 배열 · R6 red 14 | 순수 / EP-16 1/1 |
| VP-03 | AR-01 ↔ IT / IT | REQUIRED | PASS | `claude.plan-narrative.test.ts` 2 · R1 red 1 | `claude.ts:425` / EP-01 1/1 |
| VP-07 | AR-03 ↔ IT / IT | REQUIRED | PASS | 두 경로 동시 green · R2 red 5 | `model-parser:97`·`runtime-catalog:125` / EP-10·11 2/2 |
| VP-10 | AR-02 ↔ IT / IT | REQUIRED | PASS | `modelKey` 2곳 전수 위임 · R4 red 3 | `models.ts:19`·`modelSelection.ts:18` / EP-07 2/2 |
| VP-18 | AR-05 ↔ AT-20 / AT | REQUIRED | PASS | `taskSurface0212` 백그라운드 타일 케이스 유지 | `SubAgentTileContent` / EP-17 1/1 |
| VP-02 | SD-01 ↔ AT-04 / ST | REQUIRED | PASS | `claude-map.test.ts` 4 · M-D red 1 | `claude-map:418`·`:541` / EP-02·03 2/2 |
| VP-14 | SD-03 ↔ AT-14 / ST | REQUIRED | PASS | `send.permission-mode.test.ts` 4 · R5·M-C 각 red 1 | `send.ts:363`·`:400` / EP-15 2/2 |
| VP-16 | SD-02 ↔ AT-15 / ST | REQUIRED | PASS | `model-parser.test.ts` AT-15 3조합 | 두 생산 경로 / EP-05·06·10·11 4/4 |
| VP-19 | SD-04 ↔ AT-18·AT-19 / ST | REQUIRED | **PASS(배선 미잠금)** | `chatReducer.task.test.ts` AT-18 · M-E red 1 | `chatReducer:864` / EP-18·19 2/2 — **EP-19 배선은 M-G green** |
| VP-01 | R-01 ↔ AT-01·02·03 / AT | REQUIRED | PASS | `claude.canusetool.test.ts` 3 + `plan0215.render.test.ts` 3 | EP-01·04 2/2 |
| VP-05 | R-02 ↔ AT-05·06 / AT | REQUIRED | PASS | `model-parser.test.ts` AT-05·06 | EP-10 1/1 |
| VP-06 | R-02 ↔ AT-07 / AT | REQUIRED | PASS | `runtime-catalog.test.ts` 3 | EP-11 1/1 |
| VP-08 | R-03 ↔ AT-08·22 / AT | REQUIRED | PASS | 두 경로 반환 길이 2 · R3 red 2 | EP-05 2/2 |
| VP-09 | R-03 ↔ AT-09·10 / AT | REQUIRED | PASS | `settings.test.ts` 4 + `modelMenu0215.render` 4 | EP-05~09 6/6 |
| VP-12 | R-04 ↔ AT-11 / AT | REQUIRED | **PASS(배선 미잠금)** | `modes.test.ts` 3 — 순수 함수는 잠김 | EP-12 1/1 — **배선은 M-B green** |
| VP-13 | R-04 ↔ AT-12·13 / AT | REQUIRED | PASS | `chatReducer.permission.test.ts` 5 + `chatStore.modelPermission.test.ts` 3 | EP-13·14 2/2 |
| VP-17 | R-05 ↔ AT-16·17 / AT | REQUIRED | PASS | `taskBoard.test.ts` 차집합 0 · R6 red 14 | EP-16·17 5/5 |

- root `PAIR_FAIL`: **없음** — 20 pair가 각자의 등록 oracle로 PASS다.
- 종속 `BLOCKED_BY`: 없음.
- VP-12·VP-19를 `PAIR_FAIL`로 올리지 않은 이유: 두 pair의 등록 oracle(옵션 배열 / 문구 렌더)이 실제로 통과하고 프로덕션 코드도 옳다. 빠진 것은 **oracle 자체**이므로 §11에 따라 `PLAN_GAP`이다.
- 이번 라운드 실행 범위: 최초 검증 — 유효 V의 REQUIRED 20 pair 전건 + 운영 gate 4종.

### AT / AC 세부와 합계

`AC1`✅ `claude.canusetool` AT-01 · `AC2`✅ AT-02 · `AC3`⚠️ 판정 로직 green(`plan0215.render` 3), 시각 사람 ·
`AC4`✅ `claude-map.test` 턴 리셋 · `AC5`✅ AT-05 · `AC6`✅ AT-06 · `AC7`✅ `runtime-catalog` 3 ·
`AC8`✅ `available-models` 3 · `AC9`✅ `settings.test` 4 · `AC10`✅ `modelMenu0215.render` 4 ·
`AC11`✅ `modes.test` 3(**순수 함수만 — 배선은 D1**) · `AC12`✅ `chatReducer.permission` 5 · `AC13`✅ `chatStore.modelPermission` 3 ·
`AC14`✅ `send.permission-mode` 4 · `AC15`✅ AT-15 · `AC16`✅ 차집합 0 · `AC17`✅ 4축 전수 0건(엄격화 후에도 0) ·
`AC18`✅ AT-18 · `AC19`✅ `rightPanelTiles` AT-19(**배선은 D1**) · `AC20`✅ `taskSurface0212` 유지 ·
`AC21`✅ 게이트 §9 · `AC22`✅ `model-parser` AT-22 · **AC1 custom 모델 실환경 노출**⚠️ 사람 실기.

- **합계 재측정**: `✅ 20 · ⚠️ 2 · ❌ 0 = 총 22`. 분모를 §7 표에서 직접 세었다(AT-01~AT-22 = 22행).
- **합계 사본 대조**: 본문 `20/22` ↔ 커밋 trailer `Criteria-Met: 20/22` ↔ INDEX 비고 — **세 곳 일치**(0190 P40형 갈림 없음).

### pair별 plan §10 강제 지점 분모

**26/26 — 검증자 독립 재열거가 구현자 보고와 일치한다.** 라벨이 아니라 각 사이트를 코드에서 다시 셌다.

| EP | plan이 적은 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| EP-01·02·03·04 | 1·1·1·1 | `claude.ts:156` · `claude-map:418` · `:541` · `PlanTileContent:94` | 4/4 |
| EP-05 | 2 | `available-models:72 modelIdentity(entry)` · `model-parser:87 sameParsedModel` | 2/2 |
| EP-06·07·08·09 | 1·2·1·2 | `matchesExplicit` · `modelKey` 2곳 위임 · `models.ts:34` · `ModelMenu:48`·`:49` | 6/6 |
| EP-10·11·12·13·14 | 각 1 | `model-parser:97` · `runtime-catalog:125` · `Composer:466` · `chatReducer:1113` · `chatStore:1233` | 5/5 |
| EP-15 | 2 | `send.ts:363`(controller) · `:400`(TurnRequest), 둘 다 지역변수 `permissionMode` | 2/2 |
| EP-16·17 | 1·4 | `taskBoard:234` · 4축 전수 0건 | 5/5 |
| EP-18·19 | 1·1 | `chatReducer:864`(마킹 없음, 유일 마킹은 `:728` agent 경로) · `SubAgentTileContent:359` | 2/2 |

- **EP-17 0건 게이트를 한 단계 엄격하게 재측정했다** — 구현자 grep(`function backgroundItem`·`item.background`·래퍼·`kind === 'background'`)을 각각 넓혀 `backgroundItem`(전체)·`\.background\b`·`'background'` 리터럴·`TaskBoardBackgroundMeta`·`kind: 'count'`로 다시 쓸었다. **차집합 0**이다. 남은 `.background` 히트 8건은 전부 `subagent.task` **이벤트** 필드(`ev.background`)로 다른 축이다.
- 표에 없는데 같은 불변식이 필요한 지점: **1건 — 정착 사유**. 구현자가 선조치로 `SubAgentTileContent.tsx:295`에 옮긴 것이 맞다. D-024가 이미 규칙을 갖고 있어 새 결정이 필요 없었다 — EP-19 분모 정정은 D2로 이관.
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 해당 없음(§10 자체 서술과 일치).

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| subtree 정적 — `npm run lint` | **PASS** | **0 error / 1 warning** — `useTranscriptVirtualizer.ts:22` react-compiler 경고, 변경 무관(기준선 존재) |
| subtree 정적 — `npm run typecheck` | **PASS** | node·web·test **3구성 진단 0줄** |
| subtree 테스트 — `vitest run` | **PASS** | **327파일 / 3233케이스 passed**, 0 failed |
| repository 문서 인벤토리 | **PASS** | `--check`: `9 items, 82 channels` · prose ok · links ok. 재생성이 diff 0 |
| message-bus (trailer) | **PASS** | §11 참조 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `HarnessRuntimeConfig.runtimeEnv.ANTHROPIC_MODEL` | ✅ 타입 변경 0 — 이미 `Readonly<Record<string,string>>`이라 문서 예제가 그대로 typecheck | ✅ `auth.md:497` 이 "그 배열만이 아니다 … 중복이면 더하지 않는다"로 갱신됐고 `runtime-catalog.test.ts` 3케이스가 동작을 단언 | PASS |
| `AgentModelView` wire | ✅ 필드 불변(§16 유지 판정과 일치) | ✅ `modelFamily` 값 형식이 1M을 싣는다 — `TRD.md:601`에 명시 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 소비처/파일 재측정: `modelKey` 정의 **2** · `withExplicitModel` 프로덕션 호출 **2** · `permissionApi.setMode` 프로덕션 **2** · `taskBoardFromMessages` 소비 **1파일**(`TaskTileContent`) — plan §8 전수와 전건 일치.
- 내역 합 = 총계: **26 = 4+2+6+5+2+5+2**(위 표) — 구현자 보고 26/26과 일치. 다만 plan §8 검산 줄의 항 나열(`2+1+1+1+2+2+…`)은 EP-01~19 순서와 어긋난다 — 합계는 26으로 맞다(D4).
- 0건 게이트의 정당한 예외 보존: ✅ — EP-17 0건이 `ev.background`(이벤트 축)를 지우지 않았다.
- 총량 임계의 제거/허용 분해: ✅ AC16의 음성 단언에 양성 짝 AC20이 붙어 "둘 다 사라짐"과 구분된다 — `taskSurface0212` 케이스가 계속 green.
- 출력 상한 실측: `ctx.lastAssistantText`는 대입이라 누적 0 — 상한 = 모델 1회 출력 × 1.
- **테스트 스킵 수 재측정**: **0 skipped**(`Tests 3233 passed (3233)`). 구현자 보고의 "7 skipped"는 관측과 어긋난다 → D5.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| AC3 실패 문구 | 판정 술어·문구 키·아이콘 분기를 `plan0215.render.test.ts` 3케이스가 단언 | 폰트·간격·대비 | plan 모드로 custom 모델 턴 → 승인 카드에서 우측 Plan 타일 |
| AC1 custom 모델 실환경 | 체인 3분기 전부 단위로 닫힘 | 계획 파일을 쓰지 않는 실제 모델에서 서술 폴백이 뜨는가 | custom provider 설정 후 plan 모드 실행 |
| 두 타일 대조 | 목록 파생·렌더 전부 순수 테스트 | 서브에이전트 실행 중 두 타일 동시 관측 | Task 도구로 서브에이전트 기동 후 우측 패널 두 타일 |

- **컨테이너 배선은 사람 몫이 아니다** — M-B~M-H가 보였듯 `Composer`·`SubAgentTileContent`를 마운트하는 렌더 테스트로 기계 검증할 수 있다. D1의 후속이다.

## 9. 게이트 재실행

- 실제 실행 명령: `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-migrations-appendonly.mjs`. `app/AGENTS.md` 지침대로 `npm test`를 쓰지 않았다(DB 미접촉).
- **관측한 실행 산출**(exit code 아님): vitest **327파일 3233케이스 passed / 0 failed / 0 skipped** · lint **0 error 1 warning** · typecheck **3구성 0줄** · doc-inventory `9 items, 82 channels` · migrations `20 migrations, 906 files`.
- **첫 vitest 실행은 false success였다** — `--reporter=basic`이 `ERR_LOAD_URL`로 로드에 실패하고 **아무것도 실행하지 않은 채 exit 0**이었다. 기본 리포터로 재실행해 위 산출을 얻었다. exit code를 통과 증거로 쓰지 않는다는 §8이 실제로 걸린 자리다.
- ABI 분리 근거: 세션 시작 시 이미 Node ABI였다(`require('better-sqlite3')` OK) — 구현자가 보고한 DB 10파일 55케이스 red는 재현되지 않았고 이번 실행에 ABI 기인 실패 0건이다.
- **게이트가 작업 트리를 바꿨는가**: **아니오**. `npm run lint`는 `eslint --cache --fix`라 쓰기 가능하지만 실행 후 `git status --porcelain`이 0줄이다 — 검증자가 고친 코드를 검증자가 채점한 자리가 없다.
- **검증 중 실행한 명령의 잔여물**: `check-doc-inventory.mjs`를 `--check` 없이 한 번 실행해 `docs/generated/inventory.md`를 재생성했으나 **diff 0**이라 트리가 그대로다. 변이 13건은 모두 백업본으로 복원했고 최종 트리 미추적 0.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 — 산출 관측치를 §9에 기록 |
| AC ↔ production path | 에이전트 — 22행 1:1 대조 완료 |
| 레이어/계약/문서 링크 | 에이전트 — boundaries lint + doc-inventory links ok |
| AGENTS 위생 | 해당 없음 — 이번 변경에 `AGENTS.md` 수정 0 |
| 제품 의도 / Open Question | 사람 — 없음(요구⑤~⑧ 답변으로 닫힘) |
| UI 시각 품질 | 사람 — AC3 문구 시각 |
| 신규 의존성 / PR merge | 사람 — 신규 의존성 0건이라 승인 불필요 |

## 11. Repository operation checks

### AGENTS.md 위생

- 해당 없음 — 이번 변경은 `AGENTS.md`를 건드리지 않았다(`git show --stat` 53파일 중 0건).

### INDEX 보드 정합성

- 상태 / 다음 주체 일치: ✅ `impl / IMPL_DONE (V1 r1)` · 「다음 주체」 = `Claude (검증)` **한 주체만** 담는다(0198 r6형 이중 기입 없음).
- **대상 커밋 좌표 기입(검증자 몫)**: `(r1 구현 — 검증자 기입)` → **`b273832`**로 채운다. `git cat-file -t b273832` = `commit`(실재 확인).
- 비고 5줄 이내: ✅ 5문장 — 상세는 `plan.md`/본 문서로 링크.
- PASS 시 archive 이동: 해당 없음(RETURN_TO_PLAN).

### Commit / reference 정합성

- trailer 허용값: ✅ `Agent: claude` · `Status: implemented` · `Criteria-Met: 20/22` · `Verified-By: pending` — root `AGENTS.md` 표의 구현 커밋 조합과 일치하고 `Next-Action`을 넣지 않았다(검증 커밋 전용 키).
- **trailer가 실제로 파싱됨**: ✅ `git log -1 --format='%(trailers:only=true)' b273832`가 **8키를 그대로 반환**한다 — 0198 r7형 리터럴 `\n` 한 줄 붕괴 없음.
- 인용된 커밋 해시 실재: ✅ 설계 `fc82344`·정정 `ea983b1`·구현 `b273832` 셋 다 `git cat-file -t` = `commit`.
- `[구현자 기입]` 7필드 전수: ✅ **7/7** — 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals. 산문으로 접힌 필드 0(전부 표).
- 이동/삭제한 reference·script: 해당 없음 — 삭제된 `backgroundItem` 등은 export 소비처가 0으로 확인됐다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 ① 정착 사유를 백그라운드 타일로 이동 | **타당** — D-024가 이미 규칙을 갖고 §10만 덜 셌다. 새 결정을 만들지 않았다 | 인정. EP-19 분모 정정은 D2 |
| 선조치 ② runtime 경로에 `markDefaultModel` 재호출 | **타당** — 설계 §9 의사코드 누락을 메웠고 `runtime-catalog.test.ts` AT-07이 red로 드러냈다 | 인정 |
| 설계 대비 차이 — `selectedModelShape` 분리 | **타당하나 대체물의 실패 모드가 실재한다** | 카탈로그 미스 시 `{alias: modelAlias ?? '', model: modelFamily}` 폴백이 열린다. **그 폴백의 `modelAlias` 공급선이 M-F·M-H로 끊긴다** → D1에 포함 |
| 보고 #4 `turn.aborted`에서 서술이 다음 턴으로 넘어감 | **타당** — 제품 판단 사항 | D6 NEXT_HANDOFF |
| 보고 #3 0213 D-007 안내 분모 소멸 | **타당** — `TaskTileContent:173`의 `unsupported`가 단순화된 것을 확인 | D7 NON_BLOCKING |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| **D1** | 컨테이너→presentational 배선 4곳이 삭제돼도 838/838 green (M-B·M-F·M-G·M-H) | AR-04·AR-05에 `AR↔IT` pair 부재 · VP-12·VP-19의 적대 증거 `not selected` | **PLAN_GAP** | root; 영향 VP-12·VP-19 | **planner** — AR-04·AR-05에 `AR↔IT` REQUIRED pair를 신설하고 배선 oracle과 변이(M-B·M-G)를 등록. 코드 변경은 불필요 |
| D2 | §10 EP-19가 "유일 렌더 지점을 잃는 문구"를 1개로 셌으나 실측 2개(중단 실패 + 정착 사유) | §10 EP-19 | **NON_BLOCKING** | — | 구현자가 이미 선조치. planner가 분모를 2로 정정 |
| D3 | `classifyModel`·`matchesExplicit`·`AUTO_UNSUPPORTED_FALLBACK_MODE`가 파일 밖 참조 0인데 export | 비귀속 | NON_BLOCKING | — | 기록 — 다음 손댈 때 `export` 제거 |
| D4 | plan §8 검산 줄의 항 나열이 EP-01~19 순서와 어긋난다(합계 26은 정확) | plan §8 | NON_BLOCKING | — | planner 문서 정정 |
| D5 | 구현 보고의 vitest "7 skipped"가 관측(0 skipped)과 어긋난다 | 구현 보고 | NON_BLOCKING | — | 기록 — 케이스 수 3233은 일치 |
| D6 | `turn.aborted`로 `result`가 안 오면 `ctx.lastAssistantText`가 다음 턴으로 넘어간다 | 비귀속(§13이 창을 인지하고 수용) | **NEXT_HANDOFF** | — | 제품 판단 — abort 경로 리셋 여부 |
| D7 | 0213 D-007의 "안내 분모 = 할 일 항목" 구분이 `items.length === 0`으로 소멸 | 0213 D-007 | NON_BLOCKING | — | planner가 supersede 행 추가(구현자 제안 #3) |
| D8 | `백그라운드 작업` 타일 상세에 `최근 작업`(`currentChildLabel`) 행이 없다 | 비귀속 | NON_BLOCKING | — | 기록(구현자 보고 #6) |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **없음** — r1이다.
- 관련 plan 지침/AC의 존재 여부: **있었고 절반만 걸렸다**. plan은 배선 주장에 변이가 필요하다는 것을 알고 VP-03·VP-07·VP-10·VP-17에 붙였으나, 같은 성격의 **컨테이너 prop 배선**(VP-12·VP-19)에는 `not selected`를 적었다. 판단 축이 "구조/음성 주장"에는 걸리고 "prop 전달"에는 안 걸렸다.
- 사용자 결정 변경 근거: **없음** — Decision 17건 전부 ACTIVE 유지, SUPERSEDED 0.
- 반복된 검증 환경 한계: better-sqlite3 ABI는 이번 세션에 재현되지 않았다(이미 Node ABI). 대신 **검증자 자신의 리포터 오류가 exit 0 false success**를 만들었다 — §8이 명시한 형태다.

## 15. 결론

- 상태: **RETURN_TO_PLAN**
- pair 결과: REQUIRED **20 PASS** · root PAIR_FAIL **0** · BLOCKED_BY **0**
- PLAN_GAP: **root D1** — AR-04·AR-05에 같은 레벨 `AR↔IT` REQUIRED pair가 없고, VP-12·VP-19의 적대 증거가 `not selected`다. 영향 pair VP-12·VP-19.
- Product/UX 및 ACTIVE Decision 충족: **충족** — D-001~D-017 전건이 production path에 있다.
- AC 충족: **✅20 · ⚠️2(사람 실기) · ❌0 = 22**. 본문·trailer·INDEX 세 사본 일치.
- 현재 변경 운영 gate: **5종 전건 PASS**(lint 0 error · typecheck 3구성 0 · vitest 327파일 3233케이스 · doc-inventory · migrations).
- NON_BLOCKING: D2·D3·D4·D5·D7·D8 / NEXT_HANDOFF: D6.
- repository operation checks: **PASS** — trailer 8키 파싱 확인 · 인용 해시 3건 실재 · `[구현자 기입]` 7/7 · INDEX 대상 커밋을 `b273832`로 기입.
- 남은 사람 확인: AC3 문구 시각 · custom 모델 실환경 계획 노출 · 두 타일 동시 대조.
- **다음 단계: 설계자**. 코드는 고칠 것이 없다 — D1은 규범 행(pair·oracle·변이) 추가로 닫히고, 그 다음 구현 턴이 `Composer`·`SubAgentTileContent`를 마운트하는 배선 테스트를 더한다.

---

# Verify r2 — ΔV1 (컨테이너 배선 잠금)

> r1 판정 원문은 위에 그대로 둔다. 이 절은 r2 만 다룬다.

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 검증 범위 | `1636ccc..eebb9a5` — 구현 `a427764` · 보고 보강 `eebb9a5` |
| 기준선 plan | `1636ccc` (ΔV1 설계 커밋, 구현과 **분리됨**) |
| 유효 V | `V1 + ΔV1` |
| 판정 | **RETURN_TO_PLAN** — root `PLAN_GAP` D1(r2) |
| 자기 검증 여부 | 설계·구현·검증이 모두 Claude다. §4 분모 규칙대로 **구현 보고가 이름대지 않은 적대 축 5건**(V-1~V-5)을 만들었고 **3건이 green** 이다 |

## 0. 기준선 / plan 변경 확인 (r2)

✅ **기준선이 diff 로 성립한다.** `git diff 1636ccc..eebb9a5 -- plan.md` 의 삭제 줄 **0** — 단일 hunk(`@@ -851,6 +851,141 @@`)가 전부 `[구현자 기입]` H2 7개다. Decision·AC·V 노드/pair·§10 원문은 손대지 않았다.

### Plan validity (r2)

| 항목 | 판정 | 관측 |
|---|---|---|
| V mode / 상속 좌표 | ✅ | `Baseline V + Delta V`, 기준 `0215:V1@ea983b1` — `git cat-file -t ea983b1` = `commit` |
| `CHANGED` 좌 node 의 같은 레벨 REQUIRED pair | ✅ | AR-04→VP-21 · AR-05→VP-22, 둘 다 `AR↔IT` REQUIRED |
| pair 의 경로·강제 지점·oracle | ⚠️ | 셋 다 있으나 **EP-20 분모가 전수가 아니다** — §7 재열거 참조 |
| 적대 증거 선택 이유 | ✅ | VP-21 `구조적 proxy` · VP-22 `배선 존재` — 둘 다 `required` 로 변이 등록 |
| AT-23·AT-24 노드 명명 | ⚠️ NON_BLOCKING | ΔV1 노드표는 `AT-23`·`AT-24` 를 NEW 로 선언했는데 pair 표의 우 node 는 `IT(컨테이너 배선)`·`IT(타일 배선)` 이다. 같은 산출물에 라벨이 둘이다 — 계약 누락은 아니다 |

## 1~3. 비판적 읽기 · 역방향 탐색 (r2)

✅ **프로덕션 동작 변경 0** 을 확인했다. 코드 diff 는 ① optional→required prop 2 ② `export` 3건 제거 ③ 신규 테스트 2 ④ 기존 테스트 인자 추가 2 뿐이다. 값 전달 경로는 한 줄도 바뀌지 않았다.

- `export` 제거 3건의 파일 밖 참조: `rg` 로 `classifyModel` · `matchesExplicit` · `AUTO_UNSUPPORTED_FALLBACK_MODE` 전부 **정의 파일 내부 참조만** — 미배선/죽은 코드 아님.
- 신규 테스트 2개가 production symbol 을 부르는가: `subagentWiring` 은 `SubAgentTileContent` 를 직접 마운트(동명 재구현 없음). `composerWiring` 은 **소스를 읽는다** — production 을 실행하지 않는 구조적 proxy 이고, plan D-018 이 그 이유(포털·`document` 부재)를 적었다.

## 4. 등록된 적대 증거 재측정 + 자기검증 분모 (r2)

**등록 변이 4종 — 구현 보고와 무관하게 다시 심었다. 전부 red 로 재현된다.**

| 변이 | r1 결과 | r2 재측정 | 판정 |
|---|---|---|---|
| M-B `<ModeMenu options=…>` 미전달 | green 838/838 | **red** `축①` 1건 (843/844) | 잠김 |
| M-F `setModel(…, null, …)` | green 838/838 | **red** `축③` 1건 | 잠김 |
| M-G `stopErrors` prop 미전달 | green 838/838 | **red** AT-24 3건 (841/844) | 잠김 |
| M-H memo `modelAlias: null` | green 838/838 | **red** `축②` 1건 | 잠김 |

**덮개 회귀 재실행**: r1 이 red 로 잡던 축 2개를 다시 심었다 — `taskBoard` 파생 복원 **red 45건** · `modelKey` 옛 식 **red 3건**. `red → green` 은 **0건**.

### 자기검증 분모 — 구현 보고가 이름대지 않은 축 5건

구현자와 검증자가 같은 에이전트다. 보고된 변이의 재실행은 자기 목록의 재실행이므로 **§10 EP-20 분모를 독립 재열거**하고 거기서 축을 만들었다.

| 축 | 무엇을 깨는가 | 결과 |
|---|---|---|
| **V-1** `<ModelMenu selection={null}>` | 컨테이너가 선택 모델을 모델 메뉴에 공급하는 지점(`Composer.tsx:496`) | **GREEN 844/844 · typecheck 0** |
| **V-2c** 칩 라벨을 `selectionLabel(selectedModel)` → 폴백 문자열 (미사용 import 까지 밀어 **잔여물 진단 0**) | 컨테이너가 선택 모델을 칩에 공급하는 지점(`:392`) | **GREEN 844/844 · TS 0** |
| **V-5** `setModel(pk, selection.modelAlias, selection.modelAlias, adapter)` | 같은 호출의 **형제 슬롯** — arg3 은 alias 그대로 두고 arg2(`modelFamily`)만 오염 | **GREEN 844/844 · TS 0** |
| V-4 `options` 없는 두 번째 `<ModeMenu>` 삽입 | 새 oracle 의 `indexOf` 민감도 | red — `축①` 1건 + `TS2741` |
| V-3 `selectedProviderKey: undefined` | steer 게이트 입력(0119 축) | GREEN — 0215 유효 V 밖 |

**제품 영향 — 셋 다 사용자에게 보인다.**

- V-1 → `ModelMenu.tsx:49` 가 `selection?.providerKey === agent.key && selection.modelFamily === modelId` 로 활성 행을 정한다. `null` 이면 **어느 모델이 선택됐는지 체크 표시가 사라진다** — D-008 이 만든 `[1m]` 두 행 구분이 화면에서 무의미해진다.
- V-2c → `selectionLabel` 은 `provider/modelFamily` 다. 폴백으로 바뀌면 **칩이 항상 기본 문구**를 보인다 — "지금 어떤 모델인가" 의 주 표시가 죽는다.
- V-5 → `modelFamily` 에 alias 가 들어가면 `selectionExists(agents, providerKey, alias)` 가 거짓이 되어 `Composer.tsx:193` 의 복구 effect 가 **사용자 선택을 default 로 되돌린다**.

## 5. V-pair closeout (r2)

| Pair | 레벨 | 판정 | 증거 | §10 분모 |
|---|---|---|---|---|
| VP-22 | AR↔IT | **PASS** | `subagentWiring.render.test.ts` 3케이스 · M-G red 3 | EP-20(1) 1/1 · EP-21(1) 1/1 |
| VP-21 | AR↔IT | **PAIR_FAIL** | 등록 변이 3종은 red 다. 그러나 EP-20 이 잠근다고 적은 "컨테이너가 값을 공급한다" 의 **분모가 5가 아니라 8** 이고 그중 2지점 + 형제 슬롯 1이 green | EP-20 **5/8** · EP-21 1/1 |
| VP-12 · VP-19 | AT / ST | PASS(위임 성립) | VP-12 는 VP-21 에, VP-19 는 VP-22 에 배선을 위임했다. VP-22 는 닫혔고 **VP-12 의 위임 대상 VP-21 은 열려 있다** | EP-12 1/1 · EP-18·19 2/2 |
| V1 나머지 18 pair | — | PASS(승계) | r1 §5 좌표 참조. r2 는 프로덕션 동작을 바꾸지 않았고 지정 스위트 169파일 1619케이스 green |

### AC / 합계 (r2)

- `AC24` ✅ — 컨테이너 마운트 출력에 `중단하지 못했습니다`, 양성 짝(`로그 파서 조사`)·음성 짝·시드 도달 관측 3케이스.
- `AC23` ⚠️ **부분** — 세 축 전부 red 로 잠겼으나 축③ 이 `setModel` 호출의 **arg3 만** 본다. V-5 가 그 구멍이다.
- 합계 재측정: ✅ **21** · ⚠️ **3**(AC3 시각 · custom 모델 실환경 · **AC23**) · ❌ 0 = **24**. 구현 자기보고는 `✅22 · ⚠️2`, 커밋 trailer 2개 모두 `Criteria-Met: 22/24`, INDEX 비고는 합계 미기재 — **본문↔trailer 는 일치**하고 검증 재측정과 1건(AC23) 갈린다.

### 현재 변경의 운영 gate (r2)

| gate | 관측 |
|---|---|
| `npm run lint` | **0 error / 1 warning** — `react-hooks/incompatible-library`(`useTranscriptVirtualizer`), 이번 변경과 무관 |
| `npm run typecheck` | 3구성 **0 error** |
| 지정 vitest 스위트 | **169파일 1619케이스 green** |
| 게이트가 트리를 바꿨는가 | ❌ 아니다 — 실행 후 `git status --short` 빈 출력 |

## 7. 숫자 재측정 — §10 EP-20 분모 (root)

❌ **plan §8 의 EP-20 분모 6 은 전수가 아니다.**

plan §8 의 검색어는 `rg "options=\{modeMenuOptions\|modelAlias,\|setModel\(\|stopErrors=\{"` 다 — 이것은 **해법의 이름**이지 불변식의 주어가 아니다. 이미 고쳐 놓은 6지점만 분모에 오르고, 그 집합에 결함을 심으니 당연히 전부 red 였다.

불변식의 주어(`컨테이너가 선택 모델에서 파생한 값을 View 로 공급한다`)로 다시 세면:

```
rg -nE '<(ModeMenu|ModelMenu)' Composer.tsx      → 2   (:464 options · :496 selection)
rg -n 'selectedModel' Composer.tsx               → :255 · :392 · :466 · :496 (+ memo :176)
rg -n 'setModel\(' src/renderer --glob '!*.test.*' → 호출 3 (:193 :200 :498) + 정의 1
```

| 지점 | plan EP-20 이 셌는가 | 잠겼는가 |
|---|---|---|
| `:466` `options=` · `:181` memo alias · `:193`·`:200`·`:498` `setModel` | ✅ 6 중 5 | ✅ (M-B·M-F·M-H) |
| `SubAgentTileContent.tsx:147` `stopErrors=` | ✅ 6 중 1 | ✅ (M-G) |
| **`:496` `selection={selectedModel}`** | ❌ 미계수 | ❌ **green** (V-1) |
| **`:392` `selectionLabel(selectedModel)`** | ❌ 미계수 | ❌ **green** (V-2c) |
| `:255` `selectedProviderKey` | ❌ 미계수 | green — 0119 축, 0215 유효 V 밖 |

**0215 범위 내 분모 = 8, 잠긴 것 = 5.** `:255` 는 범위 밖이라 제외했다.

## 9. Repository operation checks (r2)

| 검사 | 판정 | 관측 |
|---|---|---|
| trailer 파싱 | ✅ | `a427764` 9키 · `eebb9a5` 8키, 전부 허용값. `Agent: claude` · `Status: implemented` · `Verified-By: pending` |
| 인용 커밋 실재 | ✅ | `ea983b1`·`1636ccc`·`a427764`·`eebb9a5`·`b273832` 전부 `git cat-file -t` = commit |
| 구현자 7 필드 | ✅ | 854·871·889·915·926·947·972 = **7/7**. `설계 대비 명시적 차이` 도 H3 로 존재 |
| 대상 커밋 좌표 | ⚠️ → 이번 턴에 기입 | 구현자가 `(r2 구현 — 검증자 기입)` 자리표시자를 남겼다. INDEX 를 `a427764` 로 채운다 |
| INDEX 비고 길이 | ⚠️ NON_BLOCKING | 735자 ≈ 7줄 — `AGENTS.md §산출물 문장 규칙 3` 의 5줄 상한 초과 |
| 검증 중 잔여물 | ✅ 정리함 | 변이 스크립트가 timeout 으로 죽어 `Composer.tsx:255` 에 변이가 남았다. `git checkout` 으로 복원하고 `.bak` 0건·`git status` clean 을 확인했다 |

## 12. 구현자 코멘트 / 선조치 경계 (r2)

- **설계 대비 차이(시드 수단) — 타당 판정으로 닫지 않고 재검증했다.** `useChatStore.setState` 가 SSR 에 안 보이는 것은 사실이다(zustand v5 `getServerSnapshot = getInitialState`). 대체물(`getInitialState()` 제자리 변형)이 갖는 **공유 축** 실패 모드를 구현자가 적었고, 실제로 `afterEach` 원복이 있으며 단독 실행 3/3 · 전체 실행에서도 green 이다. 그 축에 기댄 AC24 를 다시 단언했다 — 통과.
- **선조치 범위 준수** ✅ — 규범 행을 고치지 않았고 `export` 정리는 plan §11 이 명시한 선택 항목이다.
- **구현자가 스스로 보고한 §8 과대(8→2)** ✅ 재확인 — `npm run typecheck` 가 `rightPanelTiles:111`·`taskSurface0212:124` 2건만 낸다.

## 13. Finding disposition / 파생 이슈 (r2)

| # | finding | 귀속 | disposition | 후속 주체 |
|---|---|---|---|---|
| **D1(r2)** | §10 EP-20 분모가 **해법의 이름**으로 세어져 전수가 아니다 — 0215 범위 내 8지점 중 3이 미계수, 그중 `:496`(V-1) `:392`(V-2c) 가 green. 형제 슬롯 V-5 도 green | VP-21 · §10 EP-20 · AC23 축③ | **PLAN_GAP** | **설계자** |
| D2(r2) | AC23 축③ 이 `setModel` 호출의 arg3 만 단언해 arg2 오염(V-5)에 침묵 | AC23 | PLAN_GAP(D1 종속) | 설계자 |
| D3(r2) | ΔV1 노드표의 `AT-23`·`AT-24` 가 pair 표에서 `IT(…)` 로 다르게 불린다 | plan §7-A ΔV1 | NON_BLOCKING | 설계자(명명 통일) |
| D4(r2) | INDEX 0215 비고 735자(≈7줄) — 5줄 상한 초과 | `AGENTS.md §산출물 문장 규칙 3` | NON_BLOCKING | 이번 턴에 줄인다 |
| D5(r2) | `Composer.tsx:255` steer 게이트 입력이 배선 잠금 없이 green(V-3) | 0119 축 | NEXT_HANDOFF | — |

### D1(r2) — 설계자가 고칠 규범 행

- **왜 구현자가 못 닫는가**: EP-20 은 "6 사이트" 를 **열거**로 못박았고 AC23 축③ 은 "alias 를 3번째 인자로 넘김" 이라 적었다. 미계수 2지점과 arg2 를 잠그려면 **§10 분모와 AC 행 자체를 늘려야** 한다 — 구현자 권한 밖이다.
- **필요한 정정**: ① EP-20 의 분모를 불변식의 주어로 재산출하고 검색 명령을 그 주어로 적는다 ② 미계수 2지점(`:496`·`:392`)을 EP-20 에 편입 ③ AC23 축③ 을 "호출 전건이 `(providerKey, modelFamily, modelAlias, adapter)` 를 그 순서로 넘긴다" 로 넓히고 V-5 를 등록 변이로 추가 ④ VP-21 의 `§10 강제 지점 전수` 를 5 → 8 로 고친다.
- 코드 변경은 그다음이다 — 지금 코드는 **옳고**, 없는 것은 그것을 지키는 oracle 이다(r1 D1 과 같은 형태, 한 단계 더 안쪽).

## 14. Review Signals — 사실만 (r2)

- 이전 라운드와 동일 증상인가: **같은 형태다.** r1 D1 = "규칙은 잠겼는데 배선이 안 잠겼다". r2 D1 = "배선 6곳은 잠겼는데 **그 6이 전수가 아니다**". 두 번 다 분모가 이미 고친 자리로만 이뤄졌다.
- 관련 지침이 있었는가: **있었다.** `handoff-impl §2` — "그 검색의 술어는 불변식의 주어로 쓴다 — 네가 쓴 해법의 이름이 아니다. 해법 이름으로 세면 이미 고친 지점만 분모에 오르고, 결함 심기는 그 집합의 감도만 증명한다." plan §8 의 EP-20 검색어가 정확히 해법 이름이다.
- 사용자 결정 변경: 없음. D-020 은 OPEN 유지.
- 반복된 검증 환경 한계: ① renderer 에 DOM 이 없어 포털 안 배선은 마운트 불가(D-020 OPEN) ② zustand v5 SSR 스냅샷이 `setState` 시드를 무시 ③ better-sqlite3 ABI ④ **변이 스크립트가 timeout 으로 죽으면 트리에 변이가 남는다** — 이번에 실제로 겪었고 복원했다.

## 15. 결론 (r2)

**RETURN_TO_PLAN.** 다음 주체는 **설계자**다.

- 등록된 계약은 전부 성립한다 — 변이 4종 red, VP-22 PASS, 게이트 3종 green, 프로덕션 동작 변경 0, 덮개 회귀 0.
- 그러나 **VP-21 의 §10 분모가 전수가 아니고**, 범위 내 미계수 2지점 + 형제 슬롯 1이 green 이다. 셋 다 사용자에게 보이는 회귀(선택 표시 소멸·칩 라벨 소멸·선택 되돌림)다.
- 구현자는 EP-20 열거와 AC23 문언을 늘리지 않고는 닫을 수 없다 → `PLAN_GAP`.

---

# Verify r3 — ΔV2 (배선 분모를 주어로 재산출)

> r1·r2 판정 원문은 위에 그대로 둔다. 이 절은 r3 만 다룬다.

## 메타 (r3)

| 항목 | 값 |
|---|---|
| 검증 범위 | `0740eb0..ab3bd03` — 구현 `ab3bd03` (`git cat-file -t` = `commit`) |
| 기준선 plan | `0740eb0` (ΔV2 설계 커밋, 구현과 **분리됨**) |
| 유효 V | `V1 + ΔV1 + ΔV2` |
| 판정 | **PASS** |
| 자기 검증 여부 | 설계·구현·검증이 모두 Claude다. §4 분모 규칙대로 **구현 보고가 이름대지 않은 적대 축 3건**(A1~A3)을 만들었고 **1건이 green** 이다 |

## 0. 기준선 / plan 변경 확인 (r3)

✅ **기준선이 diff 로 성립한다.** `git show ab3bd03 -- plan.md` 는 삭제 줄 **0** 에 단일 hunk(`@@ -1028,6 +1028,129 @@`) — 전부 `[구현자 기입] … (r3)` H2 7개다. Decision·AC·V node/pair·§10 원문은 손대지 않았다.

- 설계 커밋 `0740eb0` 의 `app/` 변경: **0 파일** — 규범 정정과 구현이 다른 커밋이다.
- 구현 커밋 `ab3bd03` 의 production 변경: **0 파일** — 테스트 2 파일뿐(`composerWiring.test.ts` +56/-15 · `composerMount.render.test.ts` 신규 100줄).

### Plan validity (r3)

| 항목 | 판정 | 관측 |
|---|---|---|
| V mode / 상속 좌표 | ✅ | `V1@ea983b1 + ΔV1@1636ccc + ΔV2@0740eb0`, 셋 다 `git cat-file -t` = `commit` |
| `CHANGED` 좌 node 의 같은 레벨 REQUIRED pair | ✅ | AR-04→VP-21 · AR-05→VP-22, 둘 다 `AR↔IT` REQUIRED |
| pair 의 경로·강제 지점·oracle | ⚠️ | 셋 다 있다. **EP-20a 분모는 주어로 세면 4가 아니라 5** — D1(r3), 다만 5번째는 0215 계약 밖이다 |
| 적대 증거 선택 이유 | ✅ | VP-21 변이 6종 등록, 방향 명시. 형제 슬롯 계약에 맞바꿈(S-1)·중복(V-5) 둘 다 있다 |
| EP-22 버킷 서술 | ⚠️ NON_BLOCKING | 소스 단언 버킷의 실측은 5가 아니라 6이다(memo `:176` 포함) — D2(r3). 지점 자체는 잠겨 있다 |
| 현재 변경 산출물의 운영 gate | ✅ | §19 ΔV2 가 잔여물 수렴(`TS6133` 0)까지 적었고 그대로 재현된다 |

## 1~3. 비판적 읽기 · 역방향 탐색 (r3)

✅ **프로덕션 동작 변경 0 을 재확인했다.** `git show ab3bd03 --stat -- app/` 에 production 파일이 없다 — 이번 라운드 산출은 oracle 뿐이다.

- 신규 테스트가 production symbol 을 부르는가: `composerMount.render.test.ts` 는 `./Composer` 의 `Composer` 를 직접 `renderToStaticMarkup` 한다 — 동명 로컬 재구현 0.
- `composerWiring.test.ts` 는 여전히 소스를 읽는 **구조적 proxy** 다. 읽는 대상이 실제 production 파일인지 확인: `new URL('../Composer.tsx', …)` → `components/Composer.tsx` 실재.
- 소스 스캔의 미끼 가능성: `<ModeMenu` 1건 · `<ModelMenu` 1건 — `indexOf` 가 다른 태그를 집을 여지 0.
- 시드가 전역 상태를 오염시키는가: `afterEach` 4필드 원복. 단독 3케이스 green, 전체 실행에서도 green — 순서 의존 0.

## 4. 등록된 적대 증거 재측정 + 자기검증 분모 (r3)

**등록 변이 7종 — 구현 보고와 무관하게 다시 심었다. 전부 red 로 재현된다.**

| 변이 | r2 결과 | r3 재측정 | 판정 |
|---|---|---|---|
| M-B `<ModeMenu options=…>` 미전달 | red | **red** `축①` 1건 (6/7 pass) | 잠김 |
| M-F `setModel(…, null, …)` | red | **red** `축③` 1건 | 잠김 |
| M-G `stopErrors` prop 미전달 | red | **red** AT-24 3건 | 잠김 |
| M-H memo `modelAlias: null` | red | **red** `축②` 1건 | 잠김 |
| S-1 `modelFamily` ↔ `modelAlias` 맞바꿈 | red | **red** `축③` 1건 | 잠김 |
| **V-1** `<ModelMenu selection={null}>` | **GREEN 844/844** | **red** `축④` 1건 | **새로 잠김** |
| **V-2c** 칩 라벨 → 폴백 (미사용 import 까지 밀어 잔여물 0) | **GREEN 844/844** | **red** AT-26 **3건**, **typecheck 0 error** | **새로 잠김** |
| **V-5** `setModel(pk, alias, alias, adapter)` 형제 슬롯 중복 | **GREEN 844/844** | **red** `축③` 1건 | **새로 잠김** |

- **V-2c 는 잔여물 부산물이 아니다.** 미사용 `selectionLabel` import 를 함께 제거한 상태에서 `npm run typecheck` 3구성 **0 error**, 그럼에도 AT-26 3케이스 red — 마운트 oracle 이 **동작으로** 잡았다.
- **덮개 회귀 0.** r2 가 red 로 관측한 5종(M-B·M-F·M-G·M-H·S-1)을 그대로 다시 실행해 전부 red 다. `red → green` **0건**.

### 자기검증 분모 — 구현 보고가 이름대지 않은 축 3건

구현자와 검증자가 같은 에이전트다. 보고된 7종의 재실행은 자기 목록의 재실행이므로 **§10 EP-20 분모를 다시 독립 재열거**하고 거기서 축을 만들었다.

| 축 | 무엇을 깨는가 | 결과 |
|---|---|---|
| **A1** `onOpenUsageSettings?.(undefined)` — `:452` | 선택 상태(`providerKey`)가 소비자에 닿는 **5번째** 지점. memo 를 우회해 raw 필드를 읽어 `rg selectedModel` 에 안 걸린다 | **GREEN — 전체 330파일 3243케이스** |
| **A2** 스토어 셀렉터 `s.modelFamily` ↔ `s.modelAlias` 맞바꿈 (`:139-140`) | 같은 계약을 등록 변이 전부보다 **상류(seam 바깥)** 에서 깬다 — memo 는 축약이라 소스 단언이 못 본다 | red — AT-26 **2건** |
| **A3** 4번째 `setModel(` 호출 삽입 (슬롯 순서 위반) | 축③ 이 주장한 "호출부가 늘면 red" 의 분모 탄력성 | red — `축③` 1건 |

- **A2 가 이번 라운드 마운트 oracle 의 값어치를 보인다.** memo 의 세 필드는 축약(`modelFamily,`)이라 소스가 바뀌지 않는데도 흘러가는 **값**이 바뀐다 — 소스 단언 4축은 전부 green 이고 마운트만 red 다.
- **A1 은 green 이다.** 다만 그 지점의 계약은 0215 것이 아니다 — §13 D1(r3) 참조.

## 5. V-pair closeout (r3)

| Pair | 레벨 | 판정 | 증거 | §10 분모 |
|---|---|---|---|---|
| VP-21 | AR↔IT | **PASS** | `composerWiring` 4축 + `composerMount` 3케이스 = 7 green · 등록 변이 6종 + A2·A3 전부 red | EP-20a 3/3(+`:255` NOT_REQUIRED) · EP-20b 3/3 · EP-20c 1/1 · EP-21 1/1 · EP-22 2/2 |
| VP-22 | AR↔IT | **PASS** | `subagentWiring.render.test.ts` 3케이스 · M-G red 3건 | EP-20d 1/1 · EP-21 1/1 |
| VP-12 · VP-19 | AT / ST | **PASS** | 위임 성립 — 두 pair 가 배선을 맡긴 VP-21·VP-22 가 **이번에 둘 다 닫혔다**(r2 는 VP-21 이 열려 있었다) | EP-12 1/1 · EP-18·19 2/2 |
| V1 나머지 18 pair | — | **PASS(승계)** | r1 §5 좌표 참조. r3 은 production 을 한 줄도 바꾸지 않았고 전체 330파일 3243케이스 green | 변동 없음 |

**22 pair 전건 PASS · `PAIR_FAIL` 0 · `BLOCKED_BY` 0.**

### AC / 합계 (r3)

- 재측정한 AC 총수: §7 표의 distinct id **26**(AC1~AC26) — 구현 보고 `✅24 · ⚠️2 · ❌0 = 26` 과 일치.
- 커밋 trailer `Criteria-Met: 24/26` ↔ 본문 24 ↔ INDEX 비고 — **세 사본이 같은 값**이다(0190 P40 축 재발 0).
- ⚠️ 2건은 둘 다 사람 실기다 — AC3 문구 시각 · custom 모델 실환경 계획 노출. 판정 로직은 기계 검증으로 닫혔다.
- 신설 3행 재관측: AC23 축③(V-5·S-1 red) · AC25 축④(V-1 red) · AC26 마운트 3케이스(V-2c red 3, typecheck 0).

### 현재 변경의 운영 gate (r3)

| Gate | 관측 산출 | 판정 |
|---|---|---|
| `npm run typecheck` | 3구성 전부 무출력 — **0 error** | ✅ |
| `npm run lint` | **0 error / 1 warning**(`useTranscriptVirtualizer`, `react-hooks/incompatible-library`) · 실행 후 `git status` 변화 **0** | ✅ 변경 무관 |
| `./node_modules/.bin/vitest run` | **330파일 3243케이스 green, 0 failed** | ✅ |
| `node scripts/check-doc-inventory.mjs --check` | `generated doc ok (9 items, 82 channels)` · prose ok · links ok, exit 0 | ✅ |
| 커밋 trailer 파싱 | `git log -1 --format='%(trailers:only=true)' ab3bd03` → **8키 전건 반환** | ✅ |

## 7. 숫자 재측정 (r3)

- **EP-20b 분모 3**: `grep -n 'setThe[M]odel(' ` 대신 `grep -n 'setModel(' Composer.tsx` → `:193`·`:200`·`:498`. 엄격화(주석 줄 제외) 후에도 **3** — 차집합 공집합.
- **EP-20c 분모 1**: `const selectedModel = useMemo` 1건(`:176`).
- **EP-20a 분모**: `rg selectedModel` 기준 4(`:255`·`:392`·`:466`·`:496`). **주어("선택 상태가 소비자에 닿는다") 기준으로 엄격화하면 5** — `:452` 가 더 나온다(D1(r3)). 차집합 1건.
- **§8 검산 사이트 합계 40**: `1+1+1+1+2+1+2+1+2+1+1+1+1+1+2+1+4+1+2` = **27** 재계산 일치 · `27+9+2+2 = 40` 일치. 요구 39(=40−`:255`) / 닫힘 39 일치.
- **§8 검산의 `24 EP 행`은 실측 25** 다 — EP-01~19(19) + EP-20a~d(4) + EP-21 + EP-22, superseded EP-20 제외. 사이트 합계는 정확하다(D3(r3)).

## 9. Repository operation checks (r3)

- **대상 커밋 좌표를 기입했다** — INDEX 의 `(r3 구현 — 검증자 기입)` 을 `ab3bd03` 으로 채웠다. plan 구현 보고 행은 자리표시자 그대로 둔다(좌표 정본은 INDEX 한 곳).
- INDEX 비고: 527자 — r2 의 735자에서 줄어 **5줄 상한 이내**(D4(r2) 해결 확인).
- `AGENTS.md` 변경 없음 — 위생 검사 대상 아님.
- 인용 커밋 해시 실재: `ab3bd03`·`0740eb0`·`1636ccc`·`ea983b1` 전부 `git cat-file -t` = `commit`.
- reference/script 이동·삭제 0건.

## 13. Finding disposition / 파생 이슈 (r3)

| # | finding | 귀속 | disposition | 후속 주체 |
|---|---|---|---|---|
| **D1(r3)** | `Composer.tsx:452` `onOpenUsageSettings?.(providerKey ?? undefined)` 가 선택 상태를 소비자에 넘기는 **5번째** 지점인데 EP-20a 분모(4)에 없다. 끊어도 3243케이스 green | **0215 계약 밖** — 사용량 설정 내비게이션이고 AC1~AC26 어디에도 없다. `:255`(0119)와 같은 계열이나 `:255` 는 분모에 넣고 제외했고 이것은 **세지 않았다** | **NEXT_HANDOFF** | 제품 판단 |
| D2(r3) | EP-22 의 소스 단언 버킷 서술이 `5지점`인데 실측 6이다 — memo `:176` 은 `Popover`·`useEffect` 밖이라 **항상 실행**되는데 소스 버킷에 있다 | plan §10 EP-22 서술 | NON_BLOCKING | 설계자(문언) |
| D3(r3) | §8 검산의 `24 EP 행` 이 실측 25 (사이트 합계 40 은 정확) | plan §8 | NON_BLOCKING | 설계자 |
| D4(r3) | 구현 보고의 vitest `7 skipped` 가 재측정(skipped 0)과 어긋난다 — 330파일 3243케이스는 일치 | 구현 보고 | NON_BLOCKING | 기록 — r1 D5 와 동일 증상 |

### D1(r3) 이 왜 이번 PASS 를 막지 않는가

- **r2 D1 과 다른 점은 계약 귀속이다.** r2 의 미계수 2지점(`:496` 모델 메뉴 활성 행 · `:392` 칩 라벨)은 요구③·④ 가 직접 말하는 화면이라 0215 AC 로 닫아야 했다. `:452` 는 사용량 설정 서브탭을 여는 경로이고 0215 의 어떤 R·AC·ACTIVE Decision 도 그것을 말하지 않는다.
- **구현자가 발명해야 닫히는 것이 아니다.** 0215 가 요구한 지점은 전부 닫혔다 — `:452` 를 REQUIRED 로 올리는 것은 정정이 아니라 **범위 확대**이고, plan 은 같은 상황(`:255`)에서 이미 확대하지 않기로 판정했다.
- 다만 **분모 기재 방식은 `:255` 와 갈린다** — `:255` 는 분모에 넣고 `NOT_REQUIRED` 사유를 적었고 `:452` 는 술어(`rg selectedModel`)가 memo 를 경유하는 지점만 잡아 아예 오르지 않았다. 후속 handoff 가 이 축을 열 때의 시작점이다.

## 14. Review Signals — 사실만 (r3)

- 이전 라운드와 동일 증상인가: **분모 축이 3라운드 연속이다.** r1 D1 "배선이 안 잠김" → r2 D1 "잠근 6이 전수가 아님" → r3 D1 "주어로 세면 하나 더 있음(단, 계약 밖)". **r3 에서 처음으로 0215 계약 내부의 미계수 지점이 0 이다.**
- 관련 지침이 있었는가: 있었다 — `handoff-impl §2` "검색의 술어는 불변식의 주어로 쓴다". r3 은 이 규칙을 적용했고(술어 `selectedModel`·`setModel(`·`stopErrors={`), 남은 차집합 1건은 그 술어가 **memo 경유 지점만** 잡기 때문이다.
- 사용자 결정 변경 근거: 없음. D-020(jsdom)은 OPEN 유지 — ΔV2 로 필요 범위가 소스 단언 5지점으로 좁아졌다.
- 반복된 검증 환경 한계: ① `Popover`·`useEffect` 내부는 SSR 미실행이라 소스 단언이 남는다 ② zustand v5 SSR 스냅샷이 `setState` 시드를 무시 ③ better-sqlite3 ABI ④ 변이 스크립트가 외부 timeout 으로 죽으면 트리에 변이가 남는다 — 이번 턴은 `trap` 으로 원복을 강제했고 매 변이 후 `git status` 로 확인했다(잔여 0).
- 라운드 수: 3 (`> 3` 아님 — review 자동 트리거 조건 미달).

## 15. 결론 (r3)

**PASS.**

- 22 pair 전건 PASS · `PLAN_GAP` 0 · 이번 변경 산출물의 필수 gate 5종 전부 green.
- r2 가 green 으로 관측한 3지점(V-1·V-2c·V-5)이 전부 red 로 잠겼고, r2 가 red 로 잡던 5종은 그대로 red 다 — **덮개 회귀 0**.
- 자기검증 축 3건 중 green 1건(A1)은 0215 계약 밖이라 `NEXT_HANDOFF` 다. 나머지 findings 3건은 문서 수치·문언으로 `NON_BLOCKING`.
- production 코드는 이번 라운드에 한 줄도 바뀌지 않았다 — 잠금만 늘었다.
