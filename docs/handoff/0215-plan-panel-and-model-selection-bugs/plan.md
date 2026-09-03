# Plan — 0215-plan-panel-and-model-selection-bugs

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0215-plan-panel-and-model-selection-bugs` |
| 작성자 | Claude Code |
| 일자 | 2026-09-03 |
| 매핑 | 브랜치 `claude/plan-mode-bugs-f25i42` |
| 상태 | DRAFT → READY |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | `0215:V1@ea983b1` (자기 handoff 의 Baseline) |
| 이번 V revision | `ΔV2` — verify r2 `RETURN_TO_PLAN`(root D1(r2)·D2(r2)) 정정 |
| 유효 V | `V1 + ΔV1 + ΔV2` |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 사용자 실기에서 발견된 5건 — ① custom 모델에서 계획 본문이 우측 패널에 안 보임 ② `ANTHROPIC_MODEL` 이 모델 목록에 없음 ③ `[1M]` 변형과 기본 변형이 함께 있으면 1개만 노출 ④ haiku 모델에서 지원되지 않는 '자동' 권한 모드가 선택 가능 ⑤ 우측 `작업` 타일이 백그라운드(서브에이전트) 작업까지 섞어 보여준다.
- 완료 후 달라지는 것: 계획 승인 카드가 뜰 때 우측 Plan 타일이 **항상** 본문 또는 실패 사유를 보인다. 모델 메뉴가 설정된 모델을 빠짐없이·중복 없이 노출하고 `[1M]` 변형을 개별 선택할 수 있다. haiku 선택 시 '자동' 이 사라지고 기존 선택은 '편집 자동 수락' 으로 내려앉는다. `작업` 타일은 `TaskCreate` 계열로 만들어진 할 일만 보이고, 서브에이전트는 `백그라운드 작업` 타일에서만 보인다.
- 성공을 사용자 관점에서 한 문장으로: **보이지 않는 계획을 승인하라고 요구받지 않고, 설정한 모델은 목록에 그대로 있으며, 고른 모델이 지원하지 않는 권한 모드는 고를 수 없고, 두 타일이 서로 다른 것을 보여준다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "plan 모드(enterplanmode, exitplanmode 에서)에서 작성된 계획 text가 우측패널에 보이지 않는다." | 라이브 세션 |
| 명시 요구 ② | "availableModels 에 ANTHROPIC_MODEL 환경변수도 추가하라. 추가시 중복이 되면 1개만 유지." | 라이브 세션 |
| 명시 요구 ③ | "[1M] 접미를 포함한 모델과 미포함 모델이 모두 있을때 1개만 노출되눈 버그가 있음" | 라이브 세션 |
| 명시 요구 ④ | "haiku 모델의 경우 auto 권한 지원을 안함. haiku 머델 선택시, 권한 목록에 자동을 없앨것. 자동을 선택했던 경우 편집자동수락으로 변경할 것" | 라이브 세션 |
| 명시 결정 ⑤ | "현행은 Exitplanmode 하고있는데, anthropic model 사용시 문제없음. Custom model 사용시 우측패널에 노출안됨. 현재 구현에 구조적인 문제가 있는지 확인하라." | AskUserQuestion 답변 |
| 명시 결정 ⑥ | 증상 = "카드는 뜨는데 본문만 빔" | AskUserQuestion 답변 |
| 명시 결정 ⑦ | ANTHROPIC_MODEL 적용 범위 = settings.json `env` **+** runtime config `runtimeEnv`. top-level `model` 키는 **미선택**. | AskUserQuestion 답변 |
| 명시 결정 ⑧ | haiku 판정 = `alias='haiku'` **또는** 모델명에 `haiku` 포함 | AskUserQuestion 답변 |
| 명시 요구 ⑨ | "우측 작업패널에서 백그라운드 작업은 제외하라. taskcreate로 생성된 것만 표현되어야 한다" | 라이브 세션(턴 중 추가) |
| 추론 의도 | ⑤의 "구조적인 문제가 있는지 확인하라" 를 "원인을 진단하고 그 구조를 고쳐라"로 읽는다 (추론). 진단만 하고 끝내지 않는다. | — |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 계획 본문 해소는 **`input.plan` → 이번 턴 assistant 서술 → 실패 표시** 3단 체인 | CLI 가 `plan` 을 주입하는 조건이 *모델이 계획 파일을 썼는가*라 모델 의존이다. Anthropic 모델은 쓰고 custom 모델은 안 쓴다(요구⑤) | 요구①⑤⑥ + §8 F-01~F-05 | ACTIVE | — |
| D-002 | 본문을 못 구하면 "아직 플랜이 없습니다" 가 아니라 **가져오기 실패**를 보인다 | 승인 카드가 떠 있는데 빈 상태를 보이면 실패가 "아무 일도 안 일어남"으로 보인다 | 요구⑥ | ACTIVE | — |
| D-003 | 해소는 **main(어댑터)** 에서 한다. renderer 는 `PlanReviewRequest.plan` 소비자로 남는다 | `plan_review` 계약 소유자가 main 이고 0150 이 plan 의미를 어댑터에 뒀다 | §9 AS-IS | ACTIVE | — |
| D-004 | 계획 파일 경로 추측(plans 디렉토리·slug 재현)은 **하지 않는다** | CLI 내부 slug 생성 규칙을 복제하면 CLI 버전마다 깨진다. `input.planFilePath` 는 `plan` 과 **함께만** 주입되므로 독립 폴백이 되지 못한다(§8 F-03) | §8 F-03 | ACTIVE | — |
| D-005 | `ANTHROPIC_MODEL` 을 노출 목록에 **추가**한다. 기존 항목과 일치하면 추가하지 않는다 | 요구② 원문 "추가하라 … 중복이 되면 1개만 유지" | 요구② | ACTIVE | — |
| D-006 | 적용 경로 = settings.json `env.ANTHROPIC_MODEL` + runtime config `runtimeEnv.ANTHROPIC_MODEL`. top-level `model` 은 **기존대로 default 선정 전용** | 사용자 선택⑦ (3번 선지 미선택) | 요구⑦ | ACTIVE | — |
| D-007 | 모델 **선택 식별자 = SDK 에 넘기는 모델 문자열** (`model ?? alias` + `[1m]`) | `[1M]` 두 변형을 노출하려면 식별자가 1M 축을 실어야 한다. `modelNameForFamily` 가 이미 그 문자열을 만든다 | 요구③ + §8 F-08 | ACTIVE | — |
| D-008 | dedupe 축은 **(모델 identity, oneMillionContext)** 한 쌍이다 | `X` 와 `X[1m]` 은 서로 다른 실행 대상이다 | 요구③ | ACTIVE | — |
| D-009 | haiku 판정 = `alias === 'haiku' \|\| /haiku/i.test(model ?? '')` | 사용자 선택⑧. CLI 실물(`oqe`)은 더 좁지만 사용자가 넓은 규칙을 골랐다 | 요구⑧ + §8 F-11 | ACTIVE | — |
| D-010 | haiku 선택 시 '자동'은 **메뉴에서 제거**하고, 기존 선택 '자동'은 **'편집 자동 수락'** 으로 바꾼다 | 요구④ 원문 | 요구④ | ACTIVE | — |
| D-011 | main 은 이름 기반 **2차 방어**만 한다. alias 인지 판정의 정본은 renderer(카탈로그 보유) | main 의 turn 조립부는 SDK 모델 문자열만 갖고 alias 를 갖지 않는다(§8 F-12) | §8 F-12 | ACTIVE | — |
| D-012 | `EnterPlanMode` 도구 자체는 이번 범위 밖 | 요구는 "계획 text 가 안 보인다" 이고 `EnterPlanMode` 는 본문을 나르지 않는다(`EnterPlanModeInput {}`) | §8 F-06 | ACTIVE | — |
| D-013 | 우측 `작업` 타일 목록은 **`TaskCreate` 계열로 생성된 항목만** 담는다 | 요구⑨ 원문 "백그라운드 작업은 제외하라. taskcreate로 생성된 것만 표현되어야 한다" | 요구⑨ | ACTIVE | — |
| D-014 | 제외는 **파생(`taskBoardFromMessages`)에서** 한다 — 컴포넌트 필터가 아니다 | 파생 SSOT 가 하나라는 0204 결정을 지킨다. 두 곳에서 거르면 규칙이 갈라진다 | §8 F-14 | ACTIVE | — |
| D-015 | 그 결과 도달 불가가 된 `작업` 타일의 background 전용 코드(항목 생성·메타·중단/전환 버튼·상세 행)를 **삭제**한다 | 능력은 `백그라운드 작업` 타일에 이미 있다 — 이동이 아니라 **중복 제거**다. 남기면 죽은 형제 분기가 검사 장치를 침묵시킨다 | §8 F-15 | ACTIVE | — |
| D-016 | `작업` 타일 미확인 배지도 **agent 작업만** 센다 | 타일이 더는 보이지 않는 항목을 배지가 광고하면 눌러도 아무것도 없다 | §8 F-16 | ACTIVE | — |
| D-017 | background **중단 실패 문구**를 `백그라운드 작업` 타일로 옮긴다 | 현재 그 문구의 유일한 렌더 지점이 `작업` 타일이라, 옮기지 않으면 중단 실패가 화면에서 사라진다 | §8 F-17 | ACTIVE | — |
| D-018 | 컨테이너→View **prop 배선**은 축마다 다른 oracle 로 잠근다 — `SubAgentTileContent` 는 **컨테이너 마운트**, `Composer` 는 **소스 배선 단언** | 두 컨테이너의 관측 가능성이 다르다. `Composer` 는 배선이 `Popover` 안에 있고 그것이 `createPortal(…, document.body)` 다 — 테스트 환경에 `document` 가 없어 마운트로 도달할 수 없다(§8 F-18·F-19 실측) | verify r1 D1 | **SUPERSEDED → D-021** | 전제가 틀렸다. `Composer` **자체는 마운트된다**(§8 F-21) |
| D-021 | 경계는 컴포넌트가 아니라 **실행되지 않는 영역**이다 — `Popover` 내부와 `useEffect` 내부만 소스 단언, **항상 렌더되는 부분은 컨테이너 마운트**로 잠근다 | `Popover.tsx:111` 이 `if (!open) return null` 로 `:122` 의 `createPortal` **앞에서** 끊고, 세 메뉴의 `open` 초기값이 전부 `false` 다. SSR 은 effect 를 실행하지 않는다. 실측: `Composer` 마운트 성공(§8 F-21·F-22) | verify r2 D1 | ACTIVE | D-018 대체 |
| D-022 | `setModel` 호출은 **4슬롯 전체의 순서 계약**이다 — `(providerKey, modelFamily, modelAlias, adapter)` | 한 슬롯만 단언하면 형제 슬롯 오염이 침묵한다. 실측: arg3 은 alias 로 두고 arg2 만 alias 로 바꾸면 844/844 green 이고, 제품에서는 `selectionExists` 실패로 **사용자 선택이 default 로 되돌아간다**(§8 F-23) | verify r2 D2 | ACTIVE | — |
| D-019 | `ModeMenu.options`·`SubAgentTaskList.stopErrors` 의 **관대한 기본값을 없애고 필수 prop 으로** 바꾼다 | 침묵의 원인이 optional prop + 폴백이다 — 배선 누락이 컴파일 오류가 아니라 조용한 동작 복귀가 된다(verify r1 D1) | verify r1 D1 | ACTIVE | — |
| D-020 | renderer 테스트에 **DOM 환경(jsdom 등)을 도입할지**는 미정 | 도입하면 **`Popover` 를 연 상태**까지 마운트해 잠글 수 있어 D-021 이 남긴 소스 단언 5지점을 대체한다(ΔV2 로 범위가 좁아졌다). 그러나 **신규 devDependency** 라 단독 결정 금지(`app/AGENTS.md §의존성 정책`) | §8 F-20 | **OPEN** | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-017 (신규 handoff, 이전 ACTIVE 결정 없음). D-013~D-017 은 턴 중 도착한 요구⑨ 로 추가됐고 D-001~D-012 와 대상이 겹치지 않는다.
- **r1 착수 전 정정(PLAN_GAP)**: D-008 의 dedupe 축이 성립해야 하는 지점을 §10 EP-05 가 1개로 셌으나 실측 2개다 — `model-parser.ts:79-81` 의 configured↔discovered 교차 필터가 `candidate.model === entry.model` 로만 비교해 env family `X` + availableModels `X[1m]` 조합에서 1M 변형을 버린다. EP-05 를 2사이트로, VP-08 을 `AT-08·AT-22` 로 넓히고 AT-22 를 신설했다. **Decision 은 바뀌지 않았다**(D-008 이 이미 그 규칙을 갖고 있었고 강제 지점만 덜 셌다).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0150 D④(계획 승인 = allow 의 `updatedPermissions`), 0026 파서 규약(노출 목록 내 default 정확히 1개). 둘 다 §16 에서 유지 판정.
- **ΔV1(verify r1 `RETURN_TO_PLAN` 정정)**: root D1 은 "컨테이너 배선 4곳(M-B·M-F·M-G·M-H)이 삭제돼도
  838/838 green" 이다. **Decision 은 바뀌지 않았다** — D-009·D-010·D-017 이 요구한 동작은 프로덕션에
  그대로 있고(verify §5 20 pair PASS) 빠진 것은 그것을 지키는 oracle 이다. 그래서 D-018·D-019 를
  **추가**하고 D-001~D-017 은 전건 ACTIVE 로 남긴다. SUPERSEDED 0.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0.
  - D-001("3단 체인") ↔ AC1·AC2·AC3 → 세 단계가 각각 하나의 AC 로 대응, 우선순위 역전 없음.
  - D-002("실패 표시") ↔ AC3("`pendingPlanReview` 가 있는데 본문이 없으면 실패 문구") → 일치.
  - D-004("경로 추측 금지") ↔ AC1·AC2 어디에도 `planFilePath` 독립 폴백 요구 없음 → 일치.
  - D-006("top-level `model` 은 default 전용") ↔ AC5·AC6·AC7 은 `ANTHROPIC_MODEL` 만 대상 → 일치.
  - D-007·D-008("identity 에 1M 포함") ↔ AC8·AC9·AC10·**AC22** → 노출(두 생산 경로)·SDK 문자열·행 식별 네 축이 각각 대응 → 일치.
  - D-009("alias 또는 이름") ↔ AC11(메뉴 노출 판정) → 일치. AC11 이 두 축을 모두 케이스로 갖는다.
  - D-010("메뉴 제거 + accept_edits 강등") ↔ AC11·AC12·AC13 → 강등 대상이 `accept_edits` 로 고정되어 있고 `default` 로 내리는 AC 는 없다 → 일치.
  - D-011("main=이름 기반 2차 방어") ↔ AC14(main 경로는 SDK 모델 문자열로 판정) → 일치. AC14 가 alias 판정을 main 에 요구하지 않는다.
  - D-013("TaskCreate 로 만든 것만") ↔ AC16(목록에 background key 0건) → 일치. **AC 어디에도 `작업` 타일에서 background 를 보이라는 요구가 없다**.
  - D-014("파생에서 제외") ↔ AC16(검증 수단이 `taskBoardFromMessages` 반환값) → 일치. 컴포넌트 필터를 단언하는 AC 는 없다.
  - D-015("삭제") ↔ AC17(`TaskBoardItem` 에 `background` 필드 부재를 타입·런타임으로 단언) → 일치. AC 가 "숨김"이 아니라 "없음"을 요구한다.
  - D-016 ↔ AC18(배지 카운트가 background 정착에 반응하지 않는다) → 일치.
  - D-017 ↔ AC19(중단 실패 문구가 `백그라운드 작업` 타일에서 렌더) → 일치. D-015 의 삭제 대상과 충돌하지 않는다 — 삭제는 `작업` 타일 쪽 렌더고 이 행은 **다른 타일에 신설**이다.
  - D-018 ↔ AC23·AC24 → 일치. 두 AC 가 **서로 다른 검증 수단**(소스 단언 / 컨테이너 마운트)을 갖고,
    그 차이의 이유가 D-018 의 조건절과 같다.
  - D-019 ↔ AC23·AC24 → 일치. 두 AC 어디에도 "기본값으로 떨어진다"를 허용하는 문장이 없다.
  - D-020(OPEN) ↔ AC 없음 → **의도한 부재**. OPEN 결정에 AC 를 달면 미정 사항이 완료 조건이 된다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구①이 증상이 아니라 원인을 겨냥하는가 | **전제 정정** — "plan 모드에서 작성된 text 가 안 보인다"의 원인은 렌더러가 아니라 **CLI 계약 변경**이다 | `sdk-tools.d.ts:568` `ExitPlanModeInput` 에 `plan` 필드 없음 |
| 요구①이 Orca 의 구조적 결함인가 | **그렇다** — 유일한 소스가 모델 행동에 의존하는 optional 필드이고 폴백이 없다 | `adapters/claude.ts:150-153` `input.plan` 없으면 `''` |
| 이미 기존 코드가 충족하는가 | 아니오 — `planContent` 는 `plan_review` 1개 경로로만 채워진다 | `chatReducer.ts:787` 유일 대입 |
| 더 작은 해법이 있는가 | 있다 — 파일 경로 추측 대신 **이번 턴 assistant 서술** 폴백이면 새 파일 I/O 규칙 없이 닫힌다 | D-004 |
| 요구③이 표시만의 문제인가 | **아니다** — 노출을 고쳐도 `modelKey` 가 1M 을 안 실어 선택이 충돌한다 | `models.ts:15` · `modelSelection.ts:10` |
| 요구④가 사실인가 | **사실** — CLI 가 haiku 를 auto 대상에서 제외한다 | CLI 바이너리 `oqe()` (§8 F-11) |
| 요구⑨가 "제거"인가 "이동"인가 | **제거(중복 제거)** — 능력이 `백그라운드 작업` 타일에 **이미** 있다. 옮길 것이 없다 | `tileRegistry.ts` 의 `subagent` 타일 · `SubAgentTileContent` 가 `subagentTasksFromMessages` 직접 소비 |
| 요구⑨가 능력 자체를 없애는가 | **아니오** — 서브에이전트 목록·중단·전환은 `백그라운드 작업` 타일에 남는다 | `SubAgentTileContent.tsx:309`(전환)·`:328`(중단) |
| ACTIVE 결정·기존 계약과 충돌하는가 | 부분 충돌 2건 — TRD §6.8 의 "명시-only → 3개"(D-005), 0204 D-017 의 "두 종류가 한 목록에"(D-013) | `docs/TRD.md:344` · `taskBoard.ts:4-9` → §16 에서 변경 처리 |

- 사용자에게 올릴 결정: **없음** (요구⑤~⑧ 답변으로 4건 모두 닫힘).
- 코드 조사로 닫은 사실: §8 F-01~F-13.

## 5. 동작 / 사용자 흐름

```text
[plan 모드에서 모델이 ExitPlanMode 호출]
  → main: input.plan 확인 → 없으면 이번 턴 assistant 서술 사용
  → 승인 카드 + 우측 Plan 타일에 본문 표시
  ↘ 둘 다 없음 → 타일이 "계획 본문을 가져오지 못했습니다" 를 보이고 승인/거부는 그대로 동작

[모델 메뉴 열기]
  → 목록 = env family + availableModels + ANTHROPIC_MODEL(중복 시 생략)
  → `X` 와 `X[1m]` 은 별도 행, 1M 배지로 구분
  ↘ haiku 행 선택 → 모드 메뉴에서 '자동' 사라짐 · 현재 '자동'이면 '편집 자동 수락'으로 전환

[서브에이전트 실행 중 우측 패널]
  → `작업` 타일 = TaskCreate 할 일만
  → `백그라운드 작업` 타일 = 서브에이전트(중단·전환·중단 실패 문구)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| `plan_review` 도착 · `input.plan` 있음 | 그대로 사용 | 타일에 계획 마크다운 |
| `plan_review` 도착 · `plan` 없음 · 턴 서술 있음 | 서술을 본문으로 승격 | 타일에 모델이 쓴 계획 텍스트 |
| `plan_review` 도착 · 둘 다 없음 | 빈 본문 유지 | 타일이 **실패 문구** (승인 카드는 그대로) |
| 새 턴 시작(`result` 통과 후 다음 턴) | 서술 버퍼 리셋 | 이전 턴 텍스트가 새 계획으로 새지 않음 |
| `ANTHROPIC_MODEL` 이 기존 항목과 일치 | 추가 안 함 | 목록 길이 불변, 그 항목이 default |
| `X` + `X[1m]` 동시 존재 | 별개 항목 2개 | 두 행, 하나에 `1M` 배지 |
| haiku 선택 + 현재 모드 `auto_classified` | 모드 → `accept_edits`, main 동기화 | 칩 라벨이 '편집 자동 수락' |
| haiku 선택 상태에서 모드 메뉴 열기 | '자동' 항목 제외 | 5개 → 4개 항목 |
| 서브에이전트가 뜬 상태에서 `작업` 타일 열기 | agent 항목만 접는다 | 서브에이전트 행 없음. 할 일이 없으면 기존 빈 상태 |
| background 작업이 정착 | 배지를 켜지 않는다 | `작업` 탭 배지 불변, transcript 완료 통지는 그대로 |
| `백그라운드 작업` 타일에서 중단 실패 | 그 타일에 오류 문구 | 실패가 그 자리에서 보인다 |

### 파생 UX / 엣지케이스

- loading / empty / error: 본문 미해소는 **error 성 문구**로 표시(D-002). 계획 요청이 없는 평시는 기존 "아직 플랜이 없습니다" 유지.
- cancel / retry: 계획 거부·수정은 기존 경로 불변. 본문이 비어도 인라인 코멘트 UI 는 렌더되지 않는다(본문 없음 = 선택 대상 없음).
- concurrency / multi-session: 서술 버퍼는 **채널(세션) 스코프 `MapContext`** 에 산다 — 세션 간 교차 없음.
- keyboard / a11y / theme: 신규 문구 1개 외 변경 없음.
- 외부환경/폐쇄망: runtime catalog 경로(폐쇄망 gateway)도 D-006 대상이라 같은 규칙을 받는다.

## 6. 범위 / 비범위

- **범위**: 계획 본문 해소 체인 + 실패 표시 · `ANTHROPIC_MODEL` 목록 편입(2경로) · `[1m]` 식별자/중복 · haiku 자동권한 제거·강등 · **`작업` 타일에서 background 제외 + 딸린 배지·중단 실패 문구 정리** · 관련 문서 4건.
- **ΔV1 추가 범위**(코드 동작 불변, 잠금만): 컨테이너 배선 oracle 2종 신설 · `ModeMenu.options`·`SubAgentTaskList.stopErrors` 필수화 + 그로 깨지는 테스트 호출부 8곳 인자 추가 · §10 EP-19 분모 2 반영. **선택적 정리**(verify D3): `classifyModel`·`matchesExplicit`·`AUTO_UNSUPPORTED_FALLBACK_MODE` 의 `export` 제거 — 파일 밖 참조 0건이라 동작 영향 없다.
- **ΔV2 추가 범위**(코드 동작 불변, 잠금만): `composerWiring.test.ts` 확장 — 축③ 을 4슬롯 순서 계약으로 · `<ModelMenu selection>` 축 신설(AC25) · **`Composer` 마운트 테스트 신설**(AC26, 신규 의존성 0). 변이 6종(M-B·M-F·M-H·V-1·V-2c·V-5) 확인.
- **비범위**: DOM 테스트 환경(jsdom 등) 도입(D-020 OPEN) · `turn.aborted` 경로의 서술 리셋(verify D6 — 후속 handoff) · `EnterPlanMode` 도구 처리(D-012) · plan 모드 진행 중 실시간 계획 파일 미러링 · `planFilePath` 로부터의 파일 읽기(D-004) · 권한 모드 6종 UI 확장 · CLI `oqe` 표 전체 미러링(D-009) · `백그라운드 작업` 타일의 목록/상세 재설계(중단 실패 문구 1건만 추가).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| plan 파일 실시간 미러링 | 아니오 — 표시 기능이라 계약을 잠그지 않는다 | 후속 |
| 모델 선택 식별자 형식(`X[1m]`) | **예 — wire/선택 식별자** | **지금 확정** (D-007) |
| top-level `model` 의 목록 편입 | 아니오 — 같은 함수에 인자 하나 추가면 된다 | 후속(사용자 미선택) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `ExitPlanMode` 입력에 `plan` 이 없고 이번 턴 assistant 서술이 있으면 `plan_review.request.plan` 이 그 서술이다 | 단위: `makeCanUseTool` 에 `{}` 입력 + 서술 provider 주입 → `requestApproval` 인자의 `request.plan` 이 서술과 같다 | CLI `can_use_tool` → `makeCanUseTool` → `requestApproval` → `permission.requested` |
| R-01 | AT-02 / AC2 | `plan` 이 비어있지 않으면 그것이 이기고 서술은 쓰이지 않는다 | 단위: `{plan:'A'}` + 서술 `'B'` → `request.plan === 'A'` | 동일 |
| R-01 | AT-03 / AC3 | `plan` 도 서술도 없으면 본문은 `''` 이고, **`pendingPlanReview` 가 있는 상태의 Plan 타일은 실패 문구를 렌더한다** | 렌더: `pendingPlanReview!=null && !planContent` → `chat.rightpanel.planUnavailable*` 문구 존재, 기존 `planEmptyTitle` 부재 | reducer `permission.requested` → `PlanTileContent` |
| R-01 | AT-04 / AC4 | 이전 턴 서술이 다음 턴 계획으로 새지 않는다 | 단위: `result` 매핑 후 `ctx.lastAssistantText === undefined` | `claude-map.ts` `msg.type==='result'` 분기 |
| R-02 | AT-05 / AC5 | settings.json `env.ANTHROPIC_MODEL` 값이 노출 목록에 항목으로 나타난다 | 단위: `parseClaudeModels({env:{ANTHROPIC_MODEL:'corp-x'}})` → `corp-x` 항목 존재 + `isDefault` | `listProviders` → `orca:agent:list` → ModelMenu |
| R-02 | AT-06 / AC6 | 기존 항목과 중복이면 항목 수가 늘지 않는다 | 단위: `env.ANTHROPIC_MODEL='claude-sonnet-4-6'` + 같은 값 family → 길이 불변, 그 항목이 default | 동일 |
| R-02 | AT-07 / AC7 | runtime config `runtimeEnv.ANTHROPIC_MODEL` 도 같은 규칙으로 편입된다 | 단위: runtime catalog resolve 결과에 `runtimeEnv.ANTHROPIC_MODEL` 항목 포함 | `runtime-catalog.ts` resolve → 병합 → `orca:agent:list` |
| R-03 | AT-08 / AC8 | `['X','X[1m]']` 이면 항목이 **2개** 노출된다 | 단위: `normalizeAvailableModels(['X','X[1m]'])` 길이 2, `oneMillionContext` 가 각각 false/true | 두 생산 경로 공통 |
| R-03 | AT-09 / AC9 | 두 항목의 선택 식별자가 다르고, 각각 고르면 SDK 로 `X` / `X[1m]` 가 나간다 | 단위: `modelIdentity` 두 값이 다르고 `modelNameForFamily(models, 'X[1m]') === 'X[1m]'`, `(…, 'X') === 'X'` | ModelMenu 선택 → send payload `modelFamily` → `turn-setup.ts:106` → `options.model` |
| R-03 | AT-10 / AC10 | ModelMenu 가 두 행을 각각 렌더하고 활성 표시가 하나만 켜진다 | 렌더: 두 행의 key 가 다르고, `selection.modelFamily='X[1m]'` 일 때 `aria-checked` 가 정확히 1개 | `ModelMenu.tsx` |
| R-04 | AT-11 / AC11 | haiku 선택 시 모드 메뉴에 '자동'이 없고, 비-haiku 에서는 있다 | 렌더: `modeMenuOptions(model)` 이 haiku 에서 `auto_classified` 미포함 · 비-haiku 에서 포함 | Composer → `ModeMenu` |
| R-04 | AT-12 / AC12 | '자동' 상태에서 haiku 로 바꾸면 상태·칩이 '편집 자동 수락'이 된다 | 단위: reducer `SET_MODEL`(haiku) + `permissionMode='auto_classified'` → `'accept_edits'`; 비-haiku 는 불변 | `chatStore.setModel` → reducer |
| R-04 | AT-13 / AC13 | 그 전환이 main 에도 반영된다(controller + 진행 중 턴) | 단위: `setModel` 이 강등 시 `permissionApi.setMode` 를 `accept_edits` 로 1회 호출 | `chatStore.setModel` → `orca:permission:setMode` |
| R-04 | AT-14 / AC14 | 어떤 경로로든 haiku + `auto_classified` 가 main 에 오면 `accept_edits` 로 보정된 값이 controller 와 TurnRequest 양쪽에 쓰인다 | 단위: 순수 `coerceAutoPermissionMode('auto_classified','claude-haiku-4-5')==='accept_edits'`; send 조립 두 지점이 같은 지역변수를 읽는다 | `send.ts:353-354` · `send.ts:391` |
| R-02·R-03 | AT-15 / AC15 | 기존 파서 불변식이 유지된다 — 노출 목록 내 `isDefault` 정확히 1개 | 단위: 기존 `model-parser.test.ts` 전건 + 신규 케이스에서 `filter(isDefault).length === 1` | 두 생산 경로 공통 |
| R-05 | AT-16 / AC16 | `작업` 타일 목록에 서브에이전트 행이 **0건**이다 — TaskCreate 계열로 만든 할 일만 나온다 | 단위: 서브에이전트 tool_use 가 있는 messages 로 `taskBoardFromMessages` → 반환 전건의 `key` 가 `agent:` 로 시작 | SDK tool_use → `messages` → `taskBoardFromMessages` → `TaskProgressList` |
| R-05 | AT-17 / AC17 | background 전용 표면이 `작업` 타일에 **남아 있지 않다** | 렌더: 서브에이전트 진행 중 상태에서 `작업` 타일에 중단·전환 버튼과 경과/토큰 메타 문구가 없다. 타입: `TaskBoardItem` 에 `background` 필드 부재(typecheck) | 동일 |
| R-05 | AT-18 / AC18 | background 정착이 `작업` 탭 배지를 켜지 않는다 | 단위: `subagent.task`(`phase:'settled'`, `background:true`) 리듀스 후 `unseenSettledTaskKeys` 불변. agent 완료는 여전히 켠다 | `subagent.task` → reducer → `ChatTitleBar` 배지 |
| R-05 | AT-19 / AC19 | background 중단 실패 문구가 `백그라운드 작업` 타일에서 보인다 | 렌더: `taskStopErrors['bg:<id>']` 가 있을 때 `SubAgentTileContent` 가 그 문구를 렌더 | `stopTask` 실패 → reducer `taskStopErrors` → `SubAgentTileContent` |
| R-05 | AT-20 / AC20 | 서브에이전트 목록·중단·전환 능력이 `백그라운드 작업` 타일에 그대로 남는다(회귀) | 렌더: 기존 subagent 타일 테스트가 행·중단 버튼·전환 버튼을 계속 단언 | `SubAgentTileContent` |
| R-01~R-05 | AT-21 / AC21 | 게이트: `npm run lint` 0 error · `npm run typecheck` 3종 0 · 영향 vitest 스위트 green | 명령 산출(파일 수/케이스 수)을 관측값으로 기록 | 저장소 게이트 |
| R-03 | AT-22 / AC22 | env family `X` + availableModels `X[1m]` 조합에서도 **두 항목 모두** 노출된다 | 단위: `parseClaudeModels({env:{ANTHROPIC_DEFAULT_SONNET_MODEL:'X'}, availableModels:['X[1m]']})` 길이 2, `oneMillionContext` 가 각각 false/true | settings.json → `parseClaudeModels` → `orca:agent:list` → ModelMenu |
| ~~R-04~~ | ~~AT-23 / AC23 (ΔV1)~~ **SUPERSEDED → AC23(ΔV2)** — 축③ 이 arg3 만 봐서 형제 슬롯 오염에 침묵했다(verify r2 D2) | ~~`Composer` 가 **선택 모델에서 파생한** 값을 메뉴로 흘린다~~ — ① `ModeMenu` 에 `modeMenuOptions(selectedModelShape(...))` 결과 ② `selectedModel` 이 `modelAlias` 를 실음 ③ `setModel` 호출 3곳이 alias 를 넘김 | 배선 단언: `Composer.tsx` 원문에서 세 축을 각각 단언. **세 축을 각각 지우거나 `null` 로 바꾸면 red**(M-B·M-F·M-H) | 사용자 모델 선택 → `Composer` → `ModeMenu`/`chatStore.setModel` |
| R-04 | AT-23 / **AC23 (ΔV2 정정)** | `Composer` 가 선택 모델 파생값을 흘린다 — ① `ModeMenu` 에 `modeMenuOptions(selectedModelShape(...))` ② memo 가 `providerKey`·`modelFamily`·`modelAlias` 3필드를 싣는다 ③ `setModel` 호출 **전건이 `(providerKey, modelFamily, modelAlias, adapter)` 를 그 순서로** 넘긴다 | 소스 단언(D-021: 이 5지점은 `Popover`·`useEffect` 내부라 SSR 미실행). **각 축을 지우거나 `null` 로 바꾸면 red**(M-B·M-F·M-H) **+ 형제 슬롯을 맞바꾸거나 중복해도 red**(S-1·V-5) | 사용자 모델 선택 → `Composer` → `ModeMenu`/`chatStore.setModel` |
| R-04 | AT-25 / **AC25 (ΔV2 신설)** | `Composer` 가 선택 모델을 **모델 메뉴에** 넘긴다 — `<ModelMenu selection={selectedModel}>` | 소스 단언(D-021: `Popover` 내부). **`null` 로 바꾸면 red**(V-1) | 모델 메뉴 열기 → `ModelMenu.tsx:49` 활성 행 판정 |
| R-04 | AT-26 / **AC26 (ΔV2 신설)** | `Composer` 가 선택 모델을 **칩 라벨로** 낸다 — 마운트 출력에 `provider/modelFamily` 가 있다 | **컨테이너 마운트**(D-021: 항상 렌더되는 부분). 두 스토어를 시드해 `Composer` 렌더 → `anthropic/claude-sonnet-4-6` 관측. **폴백으로 바꾸면 red**(V-2c) | 세션 선택 상태 → memo → `selectionLabel` → `ComposerChip` |
| R-05 | AT-24 / AC24 (ΔV1) | `SubAgentTileContent` 가 세션의 `taskStopErrors` 를 목록 View 로 흘린다 | 컨테이너 마운트: store 를 시드해 `SubAgentTileContent` 를 렌더 → 중단 실패 문구가 출력에 있다. **prop 전달을 지우면 red**(M-G) | `stopTask` 실패 → reducer → `SubAgentTileContent` → `SubAgentTaskList` |

### AC 검증 주의사항

- 기존 테스트 재사용: `model-parser.test.ts` 의 `'불변식 — env-only 노출 length 1~3'` 케이스가 실재한다(파일 155행). **`ANTHROPIC_MODEL` 을 넣지 않는 4개 입력만 돌므로 D-005 로 깨지지 않는다** — 이 사실을 확인했고, AC15 는 이 케이스가 아니라 `isDefault` 1개 축만 계약으로 삼는다.
- 기존 테스트 재사용: `available-models.test.ts` 의 `'trims empties, keeps every distinct family model, and deduplicates exact names'`(23행) 는 `'private-v1','private-v1'` **완전 동일** 중복을 다룬다 — D-008 의 새 키(모델+1M)로도 여전히 1개다. 이 케이스는 변경 없이 통과해야 한다.
- 기존 테스트 재사용: `'명시 모델의 [1m] 접미사를 스트립한 base 로 매칭'`(144행)은 `defaults(models)` 로 **alias 만** 단언한다 — D-005 로 항목이 하나 늘어도 alias 는 `opus` 라 통과한다. 의미가 "base 매칭"에서 "1M 항목 신설 후 그것이 default"로 **바뀌므로 케이스 이름과 단언을 갱신한다**.
- 사람 실기 항목: **AC3 의 실제 문구 시각**(폰트·간격)만 사람 몫. 판정 로직(`pendingPlanReview!=null && !planContent`)은 렌더 테스트로 내린다.
- N회/총량 기준: AC13 은 "`setMode` 1회". sink(`permissionApi.setMode`) 의 프로덕션 호출부는 `rg "permissionApi.setMode" app/src` 로 전수(현재 1: `chatStore.ts:1240`)이고, 이번 변경이 `setModel` 안에 2번째를 만든다 → 식의 항 = {기존 setPermissionMode 경로, 신규 강등 경로}. 관측 지점은 강등 경로만 단언한다(기존 경로는 별도 케이스).
- 총량/0건 기준: 음성 단언은 **AC16 하나**다(`작업` 목록의 background 행 0건). 제거 대상 = `kind:'background'` 항목, 허용 대상 = `kind:'agent'` 항목 — 형태가 `key` 접두사(`bg:`/`agent:`)로 갈려 섞이지 않는다. **양성 짝 AC20** 이 같은 항목들이 `백그라운드 작업` 타일에는 그대로 있음을 단언한다 — 0건만으로는 "둘 다 사라짐" 과 구분되지 않는다.
- **AT-23·AT-24 는 verify r1 `RETURN_TO_PLAN`(root D1) 정정 행이다**. AC11·AC19 의 *동작 기준*은 그대로 두고
  **배선을 별도 요구로 신설**했다 — 두 AC 의 검증 수단이 순수 함수·View 출력이라 컨테이너가 그 값을
  공급하는지는 묻지 않았다(verify §4 M-B·M-F·M-G·M-H green).
- **AT-23 의 검증 수단이 소스 단언인 이유**: `Composer` 의 배선이 `Popover` 안이고 그것이
  `createPortal(…, document.body)` 다. 테스트 환경은 `environment: 'node'` 라 `typeof document === 'undefined'`
  이고 portal 은 `Target container is not a DOM element` 로 던진다(§8 F-18·F-19 실측) — **마운트 관측이
  불가능하다**. 소스 단언은 식별자 rename 에 취약하다는 한계를 §10 EP-20 `실패 의미` 에 적었다.
- **AT-24 는 마운트 관측이다** — `SubAgentTileContent` 는 `Popover` 를 타지 않고(`rg Popover` 0건) 이미
  `rightPanelTiles.render.test.ts:208` 이 마운트하는 선례가 있다. 두 AC 의 수단이 다른 것은 D-018 이다.
- **AT-22 는 구현 턴 r1 착수 전 §10 대조에서 추가된 정정 행이다**(표 끝에 붙어 ID 순서와 표 순서가 다르다). AT-08 이 `normalizeAvailableModels` 만 보던 자리에서 `model-parser` 교차 필터를 빠뜨렸다.
- 기존 테스트 재사용: `taskSurface0212.render.test.ts` · `taskTile0213.render.test.ts` 가 `작업` 타일의 background 행을 단언한다(파일 실재 확인). **AC16·AC17 은 이 단언들을 뒤집으므로 구현 턴이 해당 케이스를 갱신한다** — 삭제가 아니라 `백그라운드 작업` 타일 쪽 단언으로 옮기거나 agent 항목으로 바꾼다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V** — `INDEX.md` 미완료 표에 이 작업의 선행 handoff 가 없고 상속할 V 가 없다.
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: R (사용자 관측 결과 4건이 모두 바뀐다).

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §5·§7 계획 본문 표시/실패 표시 | NEW | — |
| R-02 | R | §7 ANTHROPIC_MODEL 편입·중복 1개 | NEW | — |
| R-03 | R | §7 `[1m]` 양쪽 노출·개별 선택 | NEW | — |
| R-04 | R | §7 haiku 자동권한 제거·강등 | NEW | — |
| R-05 | R | §7 `작업` 타일 = TaskCreate 항목만 | NEW | — |
| AT-01…AT-22 | AT | §7 표 | NEW | — |
| SD-01 | SD | §9 plan 본문 해소 end-to-end + 턴 경계 리셋 | NEW | — |
| SD-02 | SD | §9·§12 모델 식별자 왕복(카탈로그→wire→선택→SDK) | NEW | — |
| SD-03 | SD | §9 모델 전환 시 권한 모드 상태 전이(renderer+main) | NEW | — |
| SD-04 | SD | §9 서브에이전트 관측 → 두 타일의 책임 분리(목록·배지·중단 실패) | NEW | — |
| AR-01 | AR | §10·§11 어댑터 plan 해소 포트 + `MapContext` 캡처/리셋 | NEW | — |
| AR-02 | AR | §10 `shared/model-identity.ts` 를 두 `modelKey` 의 SSOT 로 | NEW | — |
| AR-03 | AR | §10 두 모델 목록 생산 경로가 같은 순수 함수 공유 | NEW | — |
| AR-04 | AR | §10 권한 모드 강제 지점(renderer 3 + main 2) | NEW | — |
| AR-05 | AR | §10 `작업`/`백그라운드 작업` 두 타일의 소비 경계 | NEW | — |
| MD-01 | MD | §11 `normalizeAvailableModels` dedupe 키 | NEW | — |
| MD-02 | MD | §11 `withExplicitModel` + `markDefaultModel` 1M 매칭 | NEW | — |
| MD-03 | MD | §11 `modelIdentity`·`isHaikuModel`·`coerceAutoPermissionMode` | NEW | — |
| MD-04 | MD | §11 `resolvePlanText` 순수 체인 | NEW | — |
| MD-05 | MD | §11 `taskBoardFromMessages` 가 agent 항목만 접는다 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·AT-02·AT-03 | REQUIRED | CLI `can_use_tool` → `makeCanUseTool` → `requestApproval` → `permission.requested` → reducer `planContent` → `PlanTileContent` | 승인 요청 인자의 `request.plan` 실값 + 타일 렌더 문구 | not selected — 값 자체를 직접 관측한다 | EP-01·EP-04 (2) |
| VP-02 | SD-01 ↔ AT-04 | REQUIRED | assistant text emit → `ctx.lastAssistantText` → `result` 리셋 → 다음 턴 | 매핑 전후 `ctx.lastAssistantText` 실값 | not selected — 상태값 직접 관측 | EP-02·EP-03 (2) |
| VP-03 | AR-01 ↔ IT(어댑터 배선) | REQUIRED | `claude.ts` 가 `makeCanUseTool` 에 서술 provider 를 주입 → 같은 `ctx` 를 매퍼와 공유 | 주입된 provider 가 매퍼가 쓴 값을 되돌려준다(같은 ctx 객체) | **required** — 배선 존재 oracle 이라 방향이 뒤집힌다. 변이: `claude.ts` 의 provider 인자를 제거하면 AT-01 이 red | EP-01 (1) |
| VP-04 | MD-04 ↔ UT | REQUIRED | — (순수 함수) | `resolvePlanText` 3분기 반환값 | not selected | EP-01 (1) |
| VP-05 | R-02 ↔ AT-05·AT-06 | REQUIRED | settings.json → `parseClaudeModels` → `listProviders` → `orca:agent:list` → ModelMenu | 반환 배열의 항목 존재/길이 | not selected | EP-10 (1) |
| VP-06 | R-02 ↔ AT-07 | REQUIRED | runtime resolve → `runtime-catalog.ts` → 병합 → `orca:agent:list` | 반환 항목 존재 | not selected | EP-11 (1) |
| VP-07 | AR-03 ↔ IT | REQUIRED | 두 경로가 `withExplicitModel` 동일 함수를 호출 | 두 경로 각각의 산출에 같은 규칙이 적용됨(AT-05·AT-07 동시 green) | **required** — "같은 함수를 쓴다"는 구조 주장이다. 변이: `withExplicitModel` 본문을 항등함수로 바꾸면 AT-05·AT-07 이 **둘 다** red | EP-10·EP-11 (2) |
| VP-08 | R-03 ↔ AT-08·AT-22 | REQUIRED | availableModels → `normalizeAvailableModels` → 목록 · env family + availableModels → `parseClaudeModels` 교차 필터 → 목록 | 두 경로 각각의 반환 길이 2 + 두 항목의 `oneMillionContext` | not selected — 반환 배열을 직접 관측한다 | EP-05 (2) |
| VP-09 | R-03 ↔ AT-09·AT-10 | REQUIRED | 목록 → `modelIdentity` → ModelMenu 행/선택 → send `modelFamily` → `modelNameForFamily` → `options.model` | `modelNameForFamily` 반환 문자열 + 렌더 행 key/`aria-checked` 개수 | **required** — 형제 슬롯(1M/비1M)이 서로 다른 계약이라 *존재*만 보면 맞바꿔도 통과한다. 변이: 두 행의 `oneMillionContext` 를 맞바꾸면 AT-09 가 red | EP-05·EP-06·EP-07·EP-08·EP-09 (6 사이트) |
| VP-10 | AR-02 ↔ IT | REQUIRED | main `models.ts#modelKey` · renderer `modelSelection.ts#modelKey` 가 `shared/model-identity.ts` 를 호출 | 두 파일이 shared 를 import 하고 자체 계산식을 갖지 않는다 | **required** — 배선/유일성 주장이다. 변이: renderer `modelKey` 만 옛 식으로 되돌리면 AT-10 이 red | EP-07 (2) |
| VP-11 | MD-01·MD-02 ↔ UT | REQUIRED | — (순수) | dedupe 키·explicit 매칭 반환값 | not selected | EP-05·EP-06 (2) |
| VP-12 | R-04 ↔ AT-11 | REQUIRED | 선택 모델 → `modeMenuOptions` → `ModeMenu` 렌더 | 옵션 배열에 `auto_classified` 포함/미포함 | not selected | EP-12 (1) |
| VP-13 | R-04 ↔ AT-12·AT-13 | REQUIRED | ModelMenu 선택 → `chatStore.setModel` → reducer `SET_MODEL` + `permissionApi.setMode` | 다음 상태의 `permissionMode` + `setMode` 호출 인자 | not selected | EP-13·EP-14 (2) |
| VP-14 | SD-03 ↔ AT-14 | REQUIRED | send payload → `send.ts` 보정 → controller + TurnRequest | 두 지점이 읽는 값이 `accept_edits` | **required** — 형제 두 지점이 같은 값을 읽어야 한다. 변이: `send.ts:391` 만 원래 `payload.permissionMode` 로 되돌리면 AT-14 가 red | EP-15 (2) |
| VP-15 | MD-03 ↔ UT | REQUIRED | — (순수) | `isHaikuModel`·`coerceAutoPermissionMode` 반환값 | not selected | EP-12·EP-13·EP-15 (4) |
| VP-17 | R-05 ↔ AT-16·AT-17 | REQUIRED | SDK tool_use → `messages` → `taskBoardFromMessages` → `TaskProgressList` 렌더 | 반환 배열 전건의 `key` 접두사 + 렌더 출력에 중단/전환 버튼 부재 | **required** — "없다"는 음성 주장이라 방향이 뒤집힌다. 변이: `taskBoardFromMessages` 에 background 항목을 되살리면 AT-16·AT-17 이 red | EP-16·EP-17 (2) |
| VP-18 | AR-05 ↔ AT-20 | REGRESSION-성격의 REQUIRED | `subagentTasksFromMessages` → `SubAgentTileContent` 목록·중단·전환 | 렌더 출력의 행 수·버튼 존재 | not selected — 존재를 직접 관측한다 | EP-17 (1) |
| VP-19 | SD-04 ↔ AT-18·AT-19 | REQUIRED | `subagent.task(settled)` → reducer 배지 · `stopTask` 실패 → `taskStopErrors` → 백그라운드 타일 | 배지 카운트 값 + 오류 문구 렌더 | not selected — 값·문구 직접 관측 | EP-18·EP-19 (2) |
| VP-20 | MD-05 ↔ UT | REQUIRED | — (순수) | `taskBoardFromMessages` 반환 | not selected | EP-16 (1) |
| VP-16 | SD-02 ↔ AT-15 | REQUIRED | 두 생산 경로 → 목록 → default | `filter(isDefault).length === 1` | not selected | EP-05·EP-06·EP-10·EP-11 (4) |

### ΔV1 — verify r1 `RETURN_TO_PLAN` 정정 (root D1)

> 기준 V `0215:V1@ea983b1` 에 대한 **증분**이다. 영향 없는 V1 행은 복사하지 않는다.
> 변경이 시작되는 수준: **AR** — 두 AR node 에 같은 레벨 `AR↔IT` pair 가 없었다.

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| AR-04 | AR | §10 EP-12·13·14·15·**EP-20·EP-21** | **CHANGED** | `V1@ea983b1` — 배선 강제 지점을 더한다 |
| AR-05 | AR | §10 EP-17·**EP-19(2)**·**EP-20·EP-21** | **CHANGED** | `V1@ea983b1` — 문구 2종 + 배선 |
| AT-23 | AT | §7 AC23 | NEW | — |
| AT-24 | AT | §7 AC24 | NEW | — |

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-21 | AR-04 ↔ IT(컨테이너 배선) | REQUIRED | 사용자 선택 → `Composer` memo·`setModel`·`ModeMenu options` → reducer·메뉴 | `Composer.tsx` 원문의 세 배선 축 단언 | **required** — 소스 단언은 구조적 proxy 다. 변이 3종: ① `options` prop 미전달 ② `setModel(…, null, …)` ③ memo 가 `modelAlias: null` (verify M-B·M-F·M-H) | EP-20 (5) · EP-21 (1) |
| VP-22 | AR-05 ↔ IT(타일 배선) | REQUIRED | `stopTask` 실패 → reducer `taskStopErrors` → `SubAgentTileContent` → `SubAgentTaskList` | 컨테이너 마운트 렌더 출력의 문구 | **required** — 배선 존재 oracle 이다. 변이: `stopErrors` prop 미전달 (verify M-G) | EP-20 (1) · EP-21 (1) |
| VP-12 | R-04 ↔ AT-11 | **CHANGED** (REQUIRED 유지) | V1 그대로 | V1 그대로 — 순수 옵션 배열 | **not selected → VP-21 이 배선을 잠근다**. 이 pair 는 규칙(무엇을 거르는가)만 본다 | EP-12 (1) |
| VP-19 | SD-04 ↔ AT-18·AT-19 | **CHANGED** (REQUIRED 유지) | V1 그대로 | V1 그대로 — 배지 값 + 문구 렌더 | **not selected → VP-22 가 배선을 잠근다** | EP-18 (1) · **EP-19 (2)** |

- `NOT_REQUIRED` 로 판정한 inherited pair: **없음** — V1 의 나머지 18 pair 는 이번 정정 경로에 닿지
  않는다(verify §5 에서 20 pair 전건 PASS, 그중 VP-12·VP-19 만 배선 미잠금으로 지목됐다).
- ΔV1 이 만드는 회귀: `ModeMenu.options`·`SubAgentTaskList.stopErrors` 의 **필수화**(D-019)가 기존
  테스트 호출부를 깬다 → `modelMenu0215.render.test.ts` 1곳 · `rightPanelTiles.render.test.ts` 5곳 ·
  `taskSurface0212.render.test.ts` 2곳(§8 전수). 그 8곳은 **인자를 더해 고친다**(단언은 유지).

### ΔV2 — verify r2 `RETURN_TO_PLAN` 정정 (root D1(r2)·D2(r2))

> 기준 V `0215:V1@ea983b1` + `ΔV1@1636ccc` 에 대한 **증분**이다. 영향 없는 행은 복사하지 않는다.
> 변경이 시작되는 수준: **AR** — VP-21 의 §10 분모가 전수가 아니었다.

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| AR-04 | AR | §10 EP-12·13·14·15·**EP-20a·b·c·EP-21·EP-22** | **CHANGED** | `ΔV1@1636ccc` — 분모를 주어로 재산출 |
| AR-05 | AR | §10 EP-17·EP-19(2)·**EP-20d**·EP-21 | **CHANGED** | `ΔV1@1636ccc` — EP-20 세분에 따른 재라벨만, 실질 불변 |
| AT-23 | AT | §7 AC23(ΔV2) | **CHANGED** | `ΔV1` — 축③ 을 4슬롯 순서 계약으로 확장 |
| AT-25 | AT | §7 AC25 | NEW | — |
| AT-26 | AT | §7 AC26 | NEW | — |

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-21 | AR-04 ↔ IT(컨테이너 배선) | **CHANGED** (REQUIRED 유지) | 사용자 선택 → `Composer` memo → 칩·두 메뉴·`setModel` | 소스 단언 5지점 + **마운트 관측 1지점**(`:392`) | **required** — 소스 단언은 구조적 proxy 다. 변이 6종: M-B·M-F·M-H(ΔV1 승계) · **V-1**(`selection={null}`) · **V-2c**(칩 라벨 폴백, 잔여물 0까지) · **V-5**(arg2 에 alias 중복) | EP-20a (3/4, `:255` 제외) · EP-20b (3) · EP-20c (1) · EP-21 (1) · EP-22 (2) |
| VP-22 | AR-05 ↔ IT(타일 배선) | INHERITED (REQUIRED 유지) | ΔV1 그대로 | ΔV1 그대로 — AT-24 마운트 | ΔV1 그대로 — M-G | EP-20d (1) · EP-21 (1) |

- **`NOT_REQUIRED` 로 판정한 지점**: EP-20a 의 `Composer.tsx:255`(`selectedProviderKey` → `steerBlockedByProviderBoundary`). 주어로 세면 분모에 들어오지만 그 계약은 **0119 의 턴 중 provider 경계**이고 0215 가 바꾸지 않는다. verify r2 가 D5(r2) `NEXT_HANDOFF` 로 기록했다 — **분모에서 숨기지 않고 제외 사유를 적는다**.
- **AT-23·AT-25·AT-26 의 좌 node 는 R-04(INHERITED)** 다. `NEW`·`CHANGED` 좌 node 는 AR-04·AR-05 이고 둘 다 같은 레벨 `REQUIRED` pair(VP-21·VP-22)를 갖는다.
- **VP-12(R-04 ↔ AT-11) 의 위임 대상이 넓어졌다** — ΔV1 은 "배선은 VP-21 이 잠근다" 였고 ΔV2 가 그 VP-21 의 분모를 6→9 로 고쳤다. VP-12 자체 행은 변경 없다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree (`app/**`) 정적 | main·renderer·shared 를 모두 건드린다. boundaries 규칙 대상 | `npm run lint` · `npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| subtree 테스트 (비-DB) | 순수 스위트만 필요 — DB 미접촉 | `./node_modules/.bin/vitest run <영향 스위트>` | 이번 변경이 낸 red 만 blocking. better-sqlite3 ABI 기인 DB 스위트 red 는 기준선으로 분리 |
| repository 문서 인벤토리 | `docs/` 3건을 고친다 | `node app/scripts/check-doc-inventory.mjs` | 이번 변경이 만든 불일치만 |
| message-bus (커밋 trailer) | plan/impl/verify 커밋 3종 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| F-01 `ExitPlanModeInput` 에 `plan` 필드가 **없다**(deprecated `allowedPrompts` + passthrough 뿐) | `app/node_modules/@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts:568-583` |
| F-02 계획 본문은 **plan 파일**에 산다 — 도구 설명 "This tool does NOT take the plan content as a parameter - it will read the plan from the file you wrote" | CLI 바이너리 문자열(`claude-agent-sdk-linux-x64/claude`) |
| F-03 CLI 가 `plan`·`planFilePath` 를 **함께** 주입한다. 파일이 없으면 **둘 다** 없다 | CLI: `case UP:{let n=v4(r),o=VB(r);return Kze(),n!==null?{...t,plan:n,planFilePath:o}:t}` |
| F-04 주입 시점은 **assistant 메시지 파싱 시점** (`Xpn(content, tools, agentId, meta)`) — 도구 실행 전 | CLI: `i=atp(s,l,r)` 호출부가 `case"tool_use"` 블록 안 |
| F-05 `checkPermissions` 가 `{behavior:"ask", updatedInput:e}` 를 돌려주고 브리지가 `input: l` 로 그대로 전달한다 — Orca 가 받는 입력이 곧 주입된 입력 | CLI: `S6.checkPermissions` · `createCanUseTool` 의 `let l=a.updatedInput??r` |
| F-06 `EnterPlanModeInput` 은 **빈 객체** — 본문을 나르지 않는다 | `sdk-tools.d.ts:2482` |
| F-07 Orca 는 `input.plan` 하나만 읽고 없으면 `''` 로 내려보낸다 | `app/src/main/adapters/claude.ts:149-153` |
| F-08 `planContent` 대입 지점은 1곳, 빈 문자열이면 "아직 플랜이 없습니다" 빈 상태 | `chatReducer.ts:787` · `PlanTileContent.tsx:75-88` · `ko.ts:844` |
| F-09 `normalizeAvailableModels` 가 `[1m]` 을 떼고 **base 이름만** dedupe 키로 쓴다 | `available-models.ts:18-23` |
| F-10 선택 식별자 `modelKey` 가 1M 을 싣지 않아 두 변형이 충돌한다(두 곳 중복 정의) | `features/harnesses/models.ts:15-17` · `composer/modelSelection.ts:10-12` |
| F-11 CLI 는 `claude-haiku-4-5` 를 auto 대상에서 제외하고, 비-firstParty 에서는 이름에 `haiku` 가 들어간 모델 전부를 제외한다 | CLI: `function oqe(e){…t==="claude-haiku-4-5")return!1;if(r!=="firstParty"&&!iW(r)&&(…\|\|t.includes("haiku")))return!1;…}` |
| F-12 main 의 턴 조립부는 SDK 모델 **문자열**만 갖는다(alias 없음) | `turn-setup.ts:105-106` 이 `modelNameForFamily` 결과만 반환 |
| F-13 `env.ANTHROPIC_MODEL` 은 default 선정에만 쓰이고 노출 목록에 들어가지 않는다 | `model-parser.ts:88-91` |
| F-14 `taskBoardFromMessages` 가 agent 와 background 를 **한 배열로** 합친다 | `taskBoard.ts:308` (`return [...agents, ...backgrounds]`) |
| F-15 서브에이전트 능력은 **별도 타일**에 이미 있다 — `백그라운드 작업` 타일이 `subagentTasksFromMessages` 를 직접 소비하고 중단·전환 버튼을 갖는다 | `tileRegistry.ts` `subagent: SubAgentTileContent` · `SubAgentTileContent.tsx:309`·`:328` |
| F-16 `작업` 탭 배지는 background 정착에서도 켜진다 | `chatReducer.ts:858-864`(`backgroundTaskKey`) → `ChatTitleBar.tsx:237-239` |
| F-17 background 중단 실패 문구의 유일한 렌더 지점이 `작업` 타일이다 | `TaskTileContent.tsx:409` 가 `taskStopErrors` 를 읽는 유일한 컴포넌트 |
| F-18 테스트 환경에 **DOM 이 없다** — `typeof document === 'undefined'` | `vitest.config.ts` `environment: 'node'` · 프로브 실측 출력 `typeof document = undefined` |
| F-19 `createPortal` 이 SSR 에서 던진다 — `Target container is not a DOM element` | 같은 프로브 실측. `Popover.tsx` 말미가 `createPortal(<div role="menu">…, document.body)` 이고 닫힘 상태는 `if (!open) return null` |
| F-20 DOM 환경 패키지가 **설치돼 있지 않다**(jsdom·happy-dom·testing-library 0건) | `package.json` 스캔 0건 · `ls node_modules` 0건. 도입은 `app/AGENTS.md §의존성 정책` 상 사용자 승인 대상 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `planContent` 대입 지점 | `rg "planContent" app/src \| rg -v "\.test\."` | 1 (`chatReducer.ts:787`) | 본문 소스가 단일 → 폴백이 없으면 곧 빈 화면 |
| `modelKey` 정의 | `rg "export function modelKey" app/src` | 2 | 같은 규칙이 main·renderer 에 복제됨 → SSOT 필요 |
| `normalizeAvailableModels` 호출부 | `rg "normalizeAvailableModels" app/src \| rg -v "\.test\."` | 2 (`runtime-catalog.ts:115`·`model-parser.ts:74`) | dedupe 수정이 두 경로에 동시 적용 |
| **모델 동일성 판정 사이트 전수**(D-008 축) | `available-models.ts`·`model-parser.ts`·`models.ts`·`modelSelection.ts`·`ModelMenu.tsx` 정독 | 6 | ① `normalizeAvailableModels` dedupe ② **`model-parser.ts:79-81` 교차 필터** ③ `markDefaultModel` explicit ④ `modelNameForFamily` ⑤ `selectionExists` ⑥ `ModelMenu` 활성. ②만 §10 최초본이 빠뜨렸다(r1 정정) · ⑤⑥은 EP-07 의 `modelKey` 위임으로 자동 충족 |
| `parseClaudeModels` 호출부 | `rg "parseClaudeModels" app/src \| rg -v "\.test\."` | 4 (`settings-entries.ts` 4곳, 그중 3곳 `{}`) | 빈 설정 폴백 경로가 영향 없음 |
| `modelNameForFamily` 호출부 | `rg "modelNameForFamily" app/src \| rg -v "\.test\."` | 2 (`turn-setup.ts:106`·`models.ts:50`) | 식별자 매칭 변경의 소비처 전수 |
| `MODE_MENU_OPTIONS` 소비처 | `rg "MODE_MENU_OPTIONS" app/src` | 1 (`ModeMenu.tsx:23`) | 필터 함수화 시 단일 호출부 |
| `permissionApi.setMode` 프로덕션 호출부 | `rg "permissionApi.setMode" app/src \| rg -v "\.test\."` | 1 (`chatStore.ts:1240`) | AC13 식의 항 매핑 근거 |
| `payload.permissionMode` 소비처(main) | `rg "payload.permissionMode" app/src/main` | 2 (`send.ts:353-354`·`send.ts:391`) | EP-15 의 분모 |
| `modelFamily` DB 영속 | `rg "model_family" app/src/main/infra/db` | 0 | 식별자 형식 변경에 **마이그레이션 불필요** |
| `taskBoardFromMessages` 호출부 | `rg "taskBoardFromMessages" app/src \| rg -v "\.test\."` | 2 (`TaskTileContent.tsx:68`·`:82`) | 소비자가 `작업` 타일 하나뿐 → 파생에서 제외해도 다른 화면에 영향 없음 |
| `kind === 'background'` 소비처 | `rg "kind === 'background'\|kind !== 'background'" app/src/renderer \| rg -v "\.test\."` | 5 (`TaskTileContent.tsx:327·332·350` · `taskBoard.ts:375·396`) | D-015 삭제 대상 전수 |
| `taskBoard` 에서 `백그라운드 작업` 타일이 쓰는 export | `SubAgentTileContent.tsx` import 절 | 3 (`backgroundBoardStatus`·`canBackgroundStatus`·`canStopBackgroundStatus`) | **이 셋은 삭제하지 않는다** — 삭제 대상은 `TaskBoardItem` 을 받는 래퍼(`canStopTask`·`canBackgroundTask`)와 `backgroundItem` |
| `taskStopErrors` 렌더 소비처 | `rg "taskStopErrors" app/src/renderer \| rg -v "\.test\.\|chatReducer"` | 1 (`TaskTileContent.tsx:409`) | D-017 의 근거 — 옮기지 않으면 0곳이 된다 |
| **F-21 `Composer` 는 SSR 로 마운트된다**(ΔV1 D-018 전제 반증) | `renderToStaticMarkup(createElement(Composer, {backendLabel,canAbort}))` | throw 0 · HTML **3795자** | `Popover.tsx:111` `if (!open) return null` 이 `:122` `createPortal` **앞**이고 세 메뉴 open 초기값이 `false`(`Composer.tsx:151`·`153`·`155`) |
| **F-22 시드하면 칩 라벨이 마운트 출력에 나온다** | 두 스토어 `getInitialState()` 제자리 시드 후 마운트 | `anthropic/claude-sonnet-4-6` **포함**, HTML 4249자 | AC26 의 마운트 oracle 이 성립한다. 칩은 `agents.some(a => a.supported)` 로 게이팅되므로 시드에 `supported: true` 가 필요하다 |
| **F-23 형제 슬롯 중복은 침묵한다** | `setModel(pk, selection.modelAlias, selection.modelAlias, adapter)` → 전체 chat 스위트 | **844/844 green · typecheck 0** | D-022 의 근거. 제품에서는 `selectionExists` 실패 → `Composer.tsx:193` 복구 effect 가 선택을 default 로 되돌린다 |
| **EP-20 분모 재산출**(ΔV2, 주어 기준) | `rg -n 'selectedModel' Composer.tsx`(memo 정의·import 제외) · `rg -c 'setModel\(' Composer.tsx` · `rg -n '<SubAgentTaskList' src/renderer` | a **4** · b **3** · c **1** · d **1** = **9** | `:255`·`:392`·`:466`·`:496` / `:193`·`:200`·`:498` / `:176` memo / `SubAgentTileContent.tsx:147` |
| **컨테이너 배선 지점 전수**(ΔV1 EP-20 분모) | `rg "options=\{modeMenuOptions\|modelAlias,\|setModel\(\|stopErrors=\{" src/renderer --glob '!*.test.*'` | 6 | `Composer.tsx:466`·`:181`·`:193`·`:200`·`:498` · `SubAgentTileContent.tsx:147` |
| **관대한 기본값 전수**(ΔV1 EP-21 분모) | `rg "options\?: ModeOption\[\]\|stopErrors\?: Record" src/renderer --glob '!*.test.*'` | 2 | `ModeMenu.tsx:11`(+`:25` 폴백) · `SubAgentTileContent.tsx:218`(+`:209` 기본값) |
| **필수화가 깨뜨릴 테스트 호출부**(ΔV1 회귀 분모) | `<ModeMenu`·`SubAgentTaskList` 참조 파일별 집계 | 8 | `modelMenu0215` 1 · `rightPanelTiles` 5 · `taskSurface0212` 2 — 전부 인자 추가로 고친다 |
| `SubAgentTileContent` 마운트 선례 | `rg "createElement\(SubAgentTileContent\)" src/renderer` | 1 (`rightPanelTiles.render.test.ts:208`) | AT-24 가 재사용할 패턴 — 이 컨테이너는 `Popover` 를 타지 않는다(`rg Popover` 0건) |

### 수치 / 전칭 표현 검산

- 재측정 수치: `MODE_OPTIONS` 6종 중 `hidden` 1(`dont_ask`) → 메뉴 노출 5종. haiku 에서 4종. 우측 패널 타일 4종(`plan`·`subagent`·`task`·`diff`) — `tileRegistry.ts` 의 `contentById` 키 수.
- 내역 합 = 총계 **(ΔV2 재산출)**: EP-01~EP-19 는 V1 구간 그대로 `1+1+1+1+2+1+2+1+2+1+1+1+1+1+2+1+4+1+2` = **27**.
  ΔV2 가 EP-20 을 `a4 + b3 + c1 + d1` = **9** 로 세분하고 EP-21 **2** · EP-22 **2** 를 더한다 →
  **27 + 9 + 2 + 2 = 40 사이트 / 24 EP 행**. ΔV1 의 35 에서 늘어난 5 = EP-20 미계수 3(`:255`·`:392`·`:496`)
  + EP-22 신설 2. **ΔV1 의 6 은 해법 이름으로 센 값이라 승계하지 않는다**(verify r2 D1).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `SD-02`, `SD-03`, `AR-01`~`AR-04`
- 현재 책임 소유자: 계획 본문 = `adapters/claude.ts` 의 `makeCanUseTool`; 모델 목록 = `features/harnesses`(2 경로); 선택 식별자 = main·renderer 각자의 `modelKey`; 권한 모드 = `shared/permission-mode.ts` + renderer 메뉴.
- 현재 entry → flow → state → consumer:

```text
[CLI can_use_tool(ExitPlanMode, input)]
  → makeCanUseTool: plan = input.plan ?? ''      # 유일 소스
  → requestApproval({kind:'plan_review', plan})
  → permission.requested → reducer planContent
  → PlanTileContent: !planContent → "아직 플랜이 없습니다"

[settings.json / runtime config]
  → parseClaudeModels | normalizeAvailableModels   # ANTHROPIC_MODEL 미편입, [1m] base dedupe
  → AgentModelView → ModelMenu(modelKey = model ?? alias)   # 1M 축 소실
  → send(modelFamily) → modelNameForFamily → options.model

[ModeMenu]
  → MODE_MENU_OPTIONS (모델 무관 고정 5종)
  → setPermissionMode → reducer + orca:permission:setMode

[서브에이전트 tool_use]
  → taskBoardFromMessages = [...agents, ...backgrounds]   # 두 종류가 한 목록
  → 작업 타일: 서브에이전트 행 + 중단/전환 버튼 + 경과·토큰 메타
  → 작업 탭 배지: background 정착도 카운트
  → 백그라운드 작업 타일: 같은 항목을 다시 그림(중단 실패 문구는 못 그림)
```

- 현재 오류/취소/정리 경로: 계획 본문 미해소는 **오류로 취급되지 않는다** — 빈 문자열이 정상값과 구분되지 않는다.
- 문제의 직접 원인: (a) 본문 소스가 모델 행동 의존 optional 필드 1개뿐 (b) dedupe·식별자가 1M 축을 버린다 (c) 모드 목록이 모델과 무관하다 (d) 두 타일이 같은 서브에이전트를 **둘 다** 그린다.

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 동일
- 변경 후 책임 소유자: 계획 본문 해소 = 순수 `resolvePlanText` + 어댑터 배선; 모델 식별자 = `shared/model-identity.ts` 단일 SSOT; explicit 모델 편입 = 순수 `withExplicitModel`(두 경로 공유); 자동권한 가부 = 순수 `isHaikuModel`/`coerceAutoPermissionMode`.
- 변경 후 entry → flow → state → consumer:

```text
[CLI can_use_tool(ExitPlanMode, input)]
  → resolvePlanText({ input, narrative: ctx.lastAssistantText })
      1) input.plan (trim 후 비지 않음)  2) narrative  3) ''
  → requestApproval({kind:'plan_review', plan})
  → reducer planContent → PlanTileContent
      planContent 있음 → 마크다운
      없음 + pendingPlanReview 있음 → 실패 문구(신규)
      없음 + pendingPlanReview 없음 → 기존 빈 상태

[claude-map]  assistant text emit → ctx.lastAssistantText = text
              result 매핑     → ctx.lastAssistantText = undefined

[settings.json / runtime config]
  → normalizeAvailableModels(dedupe 키 = identity+1M)
  → withExplicitModel(models, ANTHROPIC_MODEL)   # 두 경로 공통
  → markDefaultModel(models, explicit{value,oneMillion})
  → AgentModelView → ModelMenu(modelIdentity = `${model ?? alias}${1m?'[1m]':''}`)
  → send(modelFamily=identity) → modelNameForFamily(identity 우선) → options.model

[ModelMenu 선택]
  → chatStore.setModel(…, alias) → reducer SET_MODEL(+coerce) → 필요 시 setMode IPC
[ModeMenu]
  → modeMenuOptions(selectedModel) : haiku면 auto_classified 제외
[send.ts]
  → const mode = coerceAutoPermissionMode(payload.permissionMode, resolved.model)
  → permissionModes.setMode(sid, mode) · TurnRequest.permissionMode = mode

[서브에이전트 tool_use]
  → taskBoardFromMessages = agents 만
  → 작업 타일: TaskCreate 할 일만 (background 전용 표면 삭제)
  → 작업 탭 배지: agent 완료만 카운트
  → 백그라운드 작업 타일: 목록·중단·전환 + **중단 실패 문구(신설)**
```

- 변경 후 오류/취소/정리 경로: 본문 미해소가 **표면화**된다(D-002). 턴 종료 시 서술 버퍼가 비워진다.
- 유지하는 기존 메커니즘: `plan_review` IPC 계약·`PlanFeedback` 직렬화·0150 의 `updatedPermissions` 원자 전환·`markDefaultModel` 의 "정확히 1개" 불변식·`backgroundBoardStatus`/`canStopBackgroundStatus`/`canBackgroundStatus` 3종 상태 규칙(백그라운드 타일이 계속 쓴다). 제거/대체: 두 곳의 `modelKey` 자체 계산식(→ shared 위임) · `MODE_MENU_OPTIONS` 상수 소비(→ 함수) · `작업` 타일의 background 항목 생성·메타·버튼·상세 행(→ **삭제**, 능력은 백그라운드 타일에 존치).

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 계획 본문 = `input.plan` 한 줄 | 순수 `resolvePlanText` + ctx 서술 캡처 | 모델 의존 필드에 단일 의존(D-001) | AR-01·MD-04 / VP-01·VP-03·VP-04 · `claude.ts`·`plan-text.ts` |
| data/control flow | 서술이 어댑터에 남지 않음 | `MapContext.lastAssistantText` 캡처·리셋 | 폴백 소스 확보 + 턴 누수 차단 | SD-01 / VP-02 · `claude-map.ts` |
| state/contract | 선택 식별자 = `model ?? alias` (2곳 복제) | `shared/model-identity.ts` 단일 정의, 1M 포함 | 두 변형 개별 선택(D-007) | AR-02·MD-03 / VP-09·VP-10 |
| state/contract | dedupe = base 이름 | dedupe = (identity, 1M) | 변형 소실 제거(D-008) | MD-01 / VP-08·VP-11 |
| state/contract | ANTHROPIC_MODEL 미노출 | `withExplicitModel` 로 편입(2경로) | 요구②·D-006 | AR-03·MD-02 / VP-05·VP-06·VP-07 |
| error/lifecycle | 본문 없음 = 빈 상태 | 본문 없음 + 승인 대기 = 실패 문구 | D-002 | R-01 / VP-01 · `PlanTileContent.tsx` |
| state/contract | 모드 목록이 모델 무관 | `modeMenuOptions(model)` + 강등 | 요구④·D-010 | AR-04·MD-03 / VP-12·VP-13·VP-14·VP-15 |
| 책임/소유권 | `작업` 타일이 agent+background 둘 다 소유 | `작업`=agent 전용, `백그라운드 작업`=서브에이전트 전용 | 요구⑨·D-013 | AR-05·MD-05 / VP-17·VP-18 · `taskBoard.ts`·`TaskTileContent.tsx` |
| error/lifecycle | background 중단 실패가 `작업` 타일에만 보임 | `백그라운드 작업` 타일이 그 문구를 렌더 | D-017 — 안 옮기면 0곳 | SD-04 / VP-19 · `SubAgentTileContent.tsx` |
| state/contract | 배지가 agent+background 정착을 함께 카운트 | agent 정착만 카운트 | D-016 | SD-04 / VP-19 · `chatReducer.ts` |
| test seam/관측점 | 어댑터 plan 로직이 인라인 | 순수 파일 분리(`plan-text.ts`·`model-identity.ts`·`auto-mode.ts`) | electron/SDK 비의존 단위 테스트 | MD-03·MD-04 / VP-04·VP-15 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/model-identity.ts` | 모델 식별자·haiku 판정 | `{alias, model, oneMillionContext}` → `string` / `boolean` | main `models.ts`, renderer `modelSelection.ts`·`ModelMenu` |
| `shared/permission-mode.ts` (확장) | `coerceAutoPermissionMode` | `(mode, {alias?, model?})` → mode | reducer, `chatStore`, `send.ts` |
| `main/adapters/plan-text.ts` (신규) | `resolvePlanText` 순수 체인 | `{input, narrative}` → `string` | `claude.ts#makeCanUseTool` |
| `main/adapters/claude-map.ts` | 서술 캡처·턴 경계 리셋 | SDK 메시지 → `ctx.lastAssistantText` | `claude.ts` 스트림 루프 |
| `main/features/harnesses/claude/available-models.ts` | dedupe·explicit 편입·default | `string[]`, explicit → `ParsedModel[]` | `model-parser.ts`, `runtime-catalog.ts` |
| `renderer/.../composer/modes.ts` | `modeMenuOptions(model)` | 선택 모델 → `ModeOption[]` | `ModeMenu.tsx` (Composer 경유) |
| `renderer/.../lib/taskBoard.ts` | agent 할 일 목록 파생(단일 종류) | `Message[]` → `TaskBoardItem[]` | `TaskTileContent.tsx` 만 |
| `renderer/.../rightpanel/SubAgentTileContent.tsx` | 서브에이전트 목록·중단·전환·**중단 실패 문구** | `Message[]` + transient 집합 → 렌더 | 우측 패널 `subagent` 타일 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-01·VP-03·VP-04 | **EP-01** 계획 본문 해소 체인 | `adapters/plan-text.ts` | 어댑터 | `canUseTool('ExitPlanMode')` 진입 시 | 본문이 비어 사용자가 못 보는 계획을 승인 |
| R-01 / VP-01 | **EP-04** 승인 대기 중 본문 없음 = 실패 문구 | `PlanTileContent.tsx` | renderer | Plan 타일 렌더 시 | 실패가 "아무 일도 안 일어남"으로 보임 |
| SD-01 / VP-02 | **EP-02** assistant text 캡처 | `claude-map.ts` `p.type==='text'` 분기(410행) | 매퍼 | assistant 콘텐츠 매핑 시 | 폴백 소스가 비어 AC1 이 무의미 |
| SD-01 / VP-02 | **EP-03** 턴 경계 리셋 | `claude-map.ts` `msg.type==='result'` 분기(532행) | 매퍼 | 턴 종료 매핑 시 | 이전 턴 텍스트가 새 계획으로 샌다 |
| MD-01 / VP-08·VP-11·VP-16 | **EP-05** dedupe 키 = (identity, 1M) (**2 사이트**: `normalizeAvailableModels` 내부 dedupe · `model-parser.ts` 의 configured↔discovered 교차 필터) | `shared/model-identity.ts#modelIdentity` 를 두 사이트가 함께 쓴다 | 파서 | 목록 정규화 시 · env family 와 discovery 병합 시 | `[1m]` 변형 소실(요구③ 재발). 교차 필터를 빼면 env family 가 있는 provider 에서만 재발한다 |
| MD-02 / VP-09·VP-11·VP-16 | **EP-06** explicit 매칭이 1M 축 포함 | `available-models.ts#markDefaultModel` | 파서 | default 부여 시 | 1M 을 지정했는데 비-1M 이 default |
| AR-02 / VP-09·VP-10 | **EP-07** 선택 식별자 SSOT (2 사이트: `features/harnesses/models.ts`·`composer/modelSelection.ts`) | `shared/model-identity.ts` | main·renderer | 목록/선택 계산 시 | 한쪽만 1M 을 실어 선택이 어긋난다 |
| SD-02 / VP-09 | **EP-08** 식별자 → SDK 모델 문자열 매칭 | `features/harnesses/models.ts#modelNameForFamily` | 턴 조립 | 턴 조립 시 | 1M 을 골랐는데 비-1M 이 실행된다 |
| R-03 / VP-09 | **EP-09** 행 key·활성 판정 (같은 파일 2 사이트) | `ModelMenu.tsx` | renderer | 메뉴 렌더 시 | React key 충돌·활성 표시 2개 |
| AR-03 / VP-05·VP-07·VP-16 | **EP-10** settings 경로 explicit 편입 | `model-parser.ts#parseClaudeModels` | 파서 | settings.json 파싱 시 | 요구② 미충족(settings 경로) |
| AR-03 / VP-06·VP-07·VP-16 | **EP-11** runtime 경로 explicit 편입 | `runtime-catalog.ts:115` | 카탈로그 | runtime resolve 성공 시 | 요구② 미충족(폐쇄망 경로) |
| AR-04 / VP-12·VP-15 | **EP-12** 모드 메뉴 옵션 필터 | `composer/modes.ts#modeMenuOptions` | renderer | 메뉴 렌더 시 | haiku 에서 '자동' 선택 가능 |
| AR-04 / VP-13·VP-15 | **EP-13** 상태 강등 | `chatReducer.ts` `SET_MODEL` | reducer | 모델 전환 시 | 칩이 '자동'인데 실행은 다른 모드 |
| AR-04 / VP-13 | **EP-14** main 동기화 | `chatStore.ts#setModel` | 스토어 | 강등 발생 시 | main controller·진행 중 턴이 stale |
| AR-04 / VP-14·VP-15 | **EP-15** 턴 조립 보정 (2 사이트: controller 기록·TurnRequest) | `send.ts:353-354` · `send.ts:391` | main | 턴 조립 시 | SDK 가 `auto` 를 받아 CLI 가 `default` 로 폴백(사용자 요구는 `accept_edits`) |
| MD-05 / VP-17·VP-20 | **EP-16** 목록 파생이 agent 만 접는다 | `taskBoard.ts#taskBoardFromMessages` | renderer | `작업` 타일 렌더 시 | 서브에이전트가 다시 섞인다(요구⑨ 재발) |
| AR-05 / VP-17·VP-18 | **EP-17** background 전용 표면 제거 (4 사이트: `backgroundItem` 생성 · `TaskBoardItem.background` 필드 · `canStopTask`/`canBackgroundTask` 래퍼 · `TaskTileContent` 의 `kind==='background'` 분기) | `taskBoard.ts` · `TaskTileContent.tsx` | renderer | 렌더/타입 검사 시 | 죽은 형제 분기가 남아 이후 검사 장치를 침묵시킨다 |
| SD-04 / VP-19 | **EP-18** 배지 마킹이 agent 만 | `chatReducer.ts:858-864` | reducer | `subagent.task(settled, background)` 수신 시 | 배지가 보이지 않는 항목을 광고한다 |
| SD-04 / VP-19 | **EP-19 (ΔV1: 1→2)** `작업` 타일이 유일 렌더 지점이던 문구를 백그라운드 타일이 낸다 — **2 사이트**: 중단 실패 · **정착 사유** | `SubAgentTileContent.tsx` | renderer | 백그라운드 타일 렌더 시 | 그 문구가 화면에서 사라진다. 정착 사유는 0204 D-024 가 요구한 문장이다 |
| ~~AR-04·AR-05 / VP-21·VP-22~~ | ~~**EP-20 (ΔV1)** 6 사이트~~ **SUPERSEDED → EP-20a·b·c** — 분모를 *해법의 이름*(`options=`·`modelAlias,`·`setModel(`·`stopErrors=`)으로 세어 **이미 고친 자리만** 올랐다(verify r2 D1) | — | — | 분모가 전수가 아니면 결함 심기는 그 집합의 감도만 증명한다 |
| AR-04 / VP-21 | **EP-20a (ΔV2)** `Composer` 가 `selectedModel` 을 소비자에게 넘긴다 — **4 사이트**: `:255` steerGate · `:392` 칩 라벨 · `:466` ModeMenu options · `:496` ModelMenu selection | `Composer.tsx` | 렌더 시 | 규칙은 옳은데 그 값이 소비자에 닿지 않는다. `:255` 는 0119 계약이라 **NOT_REQUIRED**(§7-A ΔV2) |
| AR-04 / VP-21 | **EP-20b (ΔV2)** `Composer` 가 사용자 선택을 스토어에 되쓴다 — **3 사이트**(`:193`·`:200`·`:498`), 각각 **4슬롯 순서 계약**(D-022) | `Composer.tsx` | 선택·복구 시 | 한 슬롯만 보면 형제 오염이 침묵한다 — arg2 가 alias 가 되면 `selectionExists` 실패로 **선택이 default 로 되돌아간다** |
| AR-04 / VP-21 | **EP-20c (ΔV2)** memo 가 선택 상태 3필드를 싣는다 — **1 사이트**(`:176`), 필드 `providerKey`·`modelFamily`·`modelAlias` | `Composer.tsx` | 렌더 시 | 한 필드가 `null` 이면 그 축의 파생이 통째로 죽는다(D-009 의 두 축 중 절반) |
| AR-05 / VP-22 | **EP-20d (ΔV2)** `SubAgentTileContent` 가 세션 상태를 목록 View 로 넘긴다 — **1 사이트**(`:147`) | `SubAgentTileContent.tsx` | 렌더 시 | ΔV1 EP-20 의 타일 몫을 그대로 승계한다(AT-24 가 이미 닫았다) |
| AR-04 / VP-21 | **EP-22 (ΔV2 신설)** 관측 수단은 **실행 여부**로 가른다(D-021) — **2 버킷**: `Popover`·`useEffect` 내부 5지점은 소스 단언 · 항상 렌더되는 1지점(`:392`)은 컨테이너 마운트 | 테스트 배치 | 테스트 작성 시 | 마운트 가능한 자리를 소스 단언으로 두면 식별자 rename 에만 반응하고 **동작 회귀에는 침묵**한다 |
| AR-04·AR-05 / VP-21·VP-22 | **EP-21 (ΔV1 신설)** 관대한 기본값 제거 — **2 사이트**: `ModeMenu.options` · `SubAgentTaskList.stopErrors` 를 필수 prop 으로 | 각 컴포넌트 타입 | typecheck 시 | prop 누락이 컴파일 오류가 아니라 조용한 동작 복귀가 된다(verify r1 D1 의 침묵 원인) |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 강제 방법: 식별자 규칙 = `shared/model-identity.ts`(EP-07 두 사이트가 위임만 한다); 자동권한 규칙 = `shared/permission-mode.ts`(EP-12·EP-13·EP-15 가 같은 함수를 호출); background 상태 규칙 = `taskBoard.ts` 의 status 3함수(백그라운드 타일 단독 소비, `작업` 타일 래퍼는 삭제). 정규식 복붙 금지.
- **ΔV1 의 두 축이 서로 다른 oracle 을 쓰는 이유는 관측 가능성이다**(D-018) — `Composer` 배선은
  `Popover`→`createPortal(…, document.body)` 안이고 테스트 환경에 `document` 가 없다(§8 F-18·F-19).
  EP-21 은 그 한계를 **누락 축에서만** 메운다(타입) — 잘못된 값(`null`)은 EP-20 의 변이가 잡는다.
- `실패 의미`에 "다른 게이트가 막는다"를 적었다면 그 범위를 이 턴에 측정한 근거: **해당 없음** — 어느 행도 다른 게이트에 위임하지 않는다. 단, EP-15 는 "renderer 가 애초에 못 만든다"에 기대지 않고 **독립적으로 보정**한다(D-011).
- 선택적 필드의 `true/false/undefined` 의미: `ctx.lastAssistantText` — `undefined` = 이번 턴에 서술 없음(폴백 불가), `''` 는 저장하지 않는다(빈 텍스트 블록은 EP-02 에서 스킵). `input.plan` — `undefined`/`''`/공백만 = 모두 "없음"으로 취급(trim 후 판정). `TaskBoardItem.background` — **필드 자체를 없앤다**(`null` 로 남기면 "메타 없는 background" 라는 불가능 상태가 타입에 남는다).
- 외부 SDK 경계의 실제 요구 타입/의미: `ExitPlanModeInput` 은 `[k:string]: unknown` 이므로 `plan` 은 **선언되지 않은 런타임 주입 필드**다 — 타입 단언 없이 `typeof === 'string'` 런타임 가드로만 읽는다(현행 유지).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/model-identity.ts` (신규) | 식별자·haiku 판정 | `modelIdentity()`·`isHaikuModel()` | 순수 단위 |
| `app/src/shared/permission-mode.ts` | 자동권한 강등 규칙 | `coerceAutoPermissionMode(mode, model)` 추가 | 순수 단위 |
| `app/src/main/adapters/plan-text.ts` (신규) | 계획 본문 해소 | `resolvePlanText({input, narrative})` | 순수 단위 |
| `app/src/main/adapters/claude.ts` | 배선 | `makeCanUseTool` 에 `getPlanNarrative?: () => string \| undefined` 옵션 추가·주입 | 순수 단위(fake 주입) |
| `app/src/main/adapters/claude-map.ts` | 서술 캡처·리셋 | `MapContext.lastAssistantText` 추가, text emit 시 대입·`result` 에서 `undefined` | 순수 단위(ctx 관측) |
| `app/src/main/features/harnesses/claude/available-models.ts` | dedupe·explicit·default | dedupe 키 변경 · `withExplicitModel()` 추가 · `markDefaultModel(models, {value,oneMillion})` | 순수 단위 |
| `app/src/main/features/harnesses/claude/model-parser.ts` | settings 경로 | `withExplicitModel` 호출 + explicit 전달 · **configured↔discovered 교차 필터를 `modelIdentity` 비교로 교체** | 순수 단위 |
| `app/src/main/features/harnesses/runtime-catalog.ts` | runtime 경로 | `withExplicitModel(models, config.runtimeEnv?.ANTHROPIC_MODEL)` | 순수 단위 |
| `app/src/main/features/harnesses/models.ts` | 식별자 위임 | `modelKey` → shared 위임 · `modelNameForFamily` identity 우선 매칭 | 순수 단위 |
| `app/src/main/app/chat-turn/send.ts` | 턴 보정 | 두 지점이 `coerceAutoPermissionMode` 결과 지역변수를 읽는다 | 조립부 — 순수 함수 단위 + 코드 리뷰 |
| `app/src/renderer/.../composer/modelSelection.ts` | 식별자 위임 | `modelKey` → shared 위임 | 순수 단위 |
| `app/src/renderer/.../composer/ModelMenu.tsx` | 행 식별 | key·활성 판정에 identity 사용 | 렌더 테스트 |
| `app/src/renderer/.../composer/modes.ts` | 옵션 필터 | `modeMenuOptions(model)` 추가(`MODE_MENU_OPTIONS` 는 인자 없는 기본으로 유지) | 순수 단위 |
| `app/src/renderer/.../composer/ModeMenu.tsx` | 옵션 소비 | `options` prop 수용 | 렌더 테스트 |
| `app/src/renderer/.../components/Composer.tsx` | 배선 | 선택 모델 → `modeMenuOptions` · `setModel(…, alias)` | 렌더 테스트 |
| `app/src/renderer/.../reducer/chatReducer.ts` | 상태 강등 | `SET_MODEL` 에 `modelAlias` 추가 + 강등 규칙 · `ChatState.modelAlias` | 순수 단위 |
| `app/src/renderer/.../store/chatStore.ts` | main 동기화 | 강등 시 `permissionApi.setMode` 발행 | 순수 단위(모듈 fake) |
| `app/src/renderer/.../rightpanel/PlanTileContent.tsx` | 실패 표시 | `pendingPlanReview && !planContent` 분기 | 렌더 테스트 |
| `app/src/renderer/.../lib/taskBoard.ts` | 목록 파생 축소 | `taskBoardFromMessages` 가 agent 만 반환 · `backgroundItem`·`TaskBoardBackgroundMeta`·`canStopTask`·`canBackgroundTask` 삭제 · `TaskBoardKind` = `'agent'` · `taskBoardOrdered` 단순화 | 순수 단위 |
| `app/src/renderer/.../rightpanel/TaskTileContent.tsx` | background 표면 제거 | `kind==='background'` 분기 3곳·중단/전환 버튼·`backgroundMetaLine` 삭제 · `stopErrors` prop 제거 | 렌더 테스트 |
| `app/src/renderer/.../rightpanel/SubAgentTileContent.tsx` | 중단 실패 문구 | `taskStopErrors[bg:<id>]` 를 읽어 행 아래 렌더 | 렌더 테스트 |
| `app/src/renderer/.../reducer/chatReducer.ts` | 배지 마킹 축소 | `subagent.task(settled,background)` 에서 `unseenSettledTaskKeys` 마킹 제거 | 순수 단위 |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | `planUnavailableTitle`·`planUnavailableDesc` 추가 | 타입(키 존재) |
| **ΔV1** `composer/ModeMenu.tsx` | 관대한 기본값 제거 | `options?: ModeOption[]` → 필수 · `options ?? MODE_MENU_OPTIONS` 폴백 제거 | typecheck |
| **ΔV1** `rightpanel/SubAgentTileContent.tsx` | 관대한 기본값 제거 | `stopErrors?` → 필수(기본값 `= {}` 제거) | typecheck + 컨테이너 마운트 |
| **ΔV1** `composer/composerWiring.test.ts`(신규) | AT-23 배선 단언 | `Composer.tsx` 원문 3축 — options 공급 · memo alias · `setModel` alias 3곳 | 소스 읽기(순수) |
| **ΔV1** `rightpanel/subagentWiring.render.test.ts`(신규) | AT-24 배선 관측 | store 시드 후 `SubAgentTileContent` 마운트 → 중단 실패 문구 | 컨테이너 마운트 |
| **ΔV2** `composer/composerWiring.test.ts` | AC23(정정)·AC25 | 축③ 을 4슬롯 순서 단언으로 · `<ModelMenu selection={selectedModel}>` 축 추가 | 소스 읽기(순수) |
| **ΔV2** `composerMount.render.test.ts`(신규) | AC26 배선 관측 | 두 스토어 시드 후 `Composer` 마운트 → 칩 라벨 `provider/modelFamily` | 컨테이너 마운트 |
| **ΔV1** 기존 테스트 8곳 | 필수 prop 인자 추가 | `modelMenu0215` 1 · `rightPanelTiles` 5 · `taskSurface0212` 2 — 단언은 그대로 | — |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: `shared/model-identity.ts` · `main/adapters/plan-text.ts` · `renderer/.../composer/modes.ts` · 기존 `renderer/.../lib/taskBoard.ts`. 넷 다 `electron`·`node:fs`·SDK 를 import 하지 않는다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `MapContext` 는 이미 `lastAssistantUsage` 를 같은 방식(매핑 중 누산·턴 경계 무효화)으로 들고 있다 — 같은 형상, 같은 시점.
- 순서를 관측할 훅/로그/주입 경계: EP-02→EP-01 순서(서술이 승인 요청보다 먼저)는 SDK 스트림 순서에 의존한다 → `claude-map` 을 먼저 돌린 뒤 `resolvePlanText` 를 부르는 단위 테스트로 순서를 재현한다.

## 12. End-to-end 영향

### producer → consumer

```text
[settings.json | runtime config]
  → normalizeAvailableModels + withExplicitModel + markDefaultModel   # producer 기준
  → ParsedModel → AgentModelView(wire)
  → ModelMenu(modelIdentity)  →  chatStore.modelFamily
  → send payload.modelFamily → modelNameForFamily → options.model     # consumer 파생
```

- producer 기준: `ParsedModel.oneMillionContext` 가 1M 의 **정본**이다. 표시(`1M` 배지)도 실행(`[1m]` 재부착)도 이 필드에서 파생한다.
- consumer 파생 규칙: 소비자는 `[1m]` 접미사를 **문자열에서 다시 파싱하지 않는다** — `modelIdentity()` 하나만 부른다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: `modelIdentity` 출력이 곧 `options.model` 문자열이라 두 값이 갈라질 자리가 없다(EP-08 이 같은 함수를 쓴다).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `defaultModelFamily`(`models.ts:39`) | 목록에 항목이 1개 늘 수 있으나 `isDefault` 가 여전히 1개라 결과 불변 | AC15 |
| `resolveTitleModel`(`models.ts:48`) | haiku alias 를 이름으로 찾는다 — 목록 증가와 무관 | AC15 |
| `selectionExists`(`modelSelection.ts:34`) | identity 로 비교하도록 함께 갱신 | AC10 |
| `Composer` 기본 선택 effect(`Composer.tsx:186-198`) | identity 불일치 시 default 로 되돌아간다 → identity 통일 필요 | AC10 |
| `ModelMenu` 행 수 | ANTHROPIC_MODEL·1M 변형으로 최대 +2 | AC5·AC8 |
| main `PermissionModeController` | 강등 값이 기록된다 | AC13·AC14 |
| `ChatTitleBar` 배지(`useUnseenSettledTaskCount`) | background 정착분만큼 카운트가 준다 | AC18 |
| `SubAgentTileContent` | 중단 실패 문구 1행이 는다 | AC19·AC20 |
| `taskSurface0212`·`taskTile0213` 렌더 테스트 | `작업` 타일의 background 단언이 뒤집힌다 | AC16·AC17 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `MapContext` 생성 시 `lastAssistantText` 미설정(`undefined`).
- 취소/중단: 턴 abort 시에도 `result` 가 오지 않을 수 있다 → 다음 턴의 첫 assistant text 가 덮어쓴다. 덮어쓰기 전 `plan_review` 가 올 수 없다(계획 요청은 assistant 메시지 뒤에만 온다).
- 종료/quit/crash: 서술은 메모리에만 산다 — 영속 없음.
- retry/timeout/partial failure: 본문 미해소는 예외가 아니라 **빈 문자열 + 실패 표시**로 흡수한다(승인/거부는 계속 가능). background 중단 실패도 같은 원칙 — 예외가 아니라 그 타일의 문구로 흡수한다(D-017).
- cleanup/rollback: 없음(새 자원 없음).
- **다중 저장소 쓰기**: 코드 산출물에는 **해당 없음**(파일 쓰기 없음). 문서 산출물에는 **해당 있음** — 이 작업의 판정·상태가 `plan.md`/`verify.md` 와 `INDEX.md` 보드 **두 곳**에 산다. 두 사본이 갈라지지 않도록 상태 갱신은 같은 커밋에서 함께 한다(§10 에는 코드 불변식만 있으므로 여기서 명시).

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: 서술 폴백은 **assistant 텍스트 블록 1개**만 보관한다(누적 아님). 상한 = 모델 1회 출력 상한 × 1.
- 새 요청 수: 0 — 네트워크/파일 I/O 를 추가하지 않는다(D-004).
- `작업` 타일 fold 비용: background 분기 제거로 세션당 `subagentTasksFromMessages` 순회 1회가 준다(감소, 회귀 없음).
- 구조적 목표: 없음.
- 캐시/snapshot/호출 축소로 잃는 부수 효과: 없음. `ctx.lastAssistantText` 는 마지막 값만 유지하므로 여러 텍스트 블록이 있으면 **마지막 블록**이 폴백이다 — ExitPlanMode 직전 블록이 곧 계획이라는 전제이며, 이 전제를 AC1 이 케이스로 고정한다.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port/schema/config: `HarnessRuntimeConfig.runtimeEnv` 에 `ANTHROPIC_MODEL` 을 실으면 모델 목록에 나타난다 — **배포자가 관측할 동작이 바뀐다**(D-006).
- 구현 문서: `docs/arch/backend/auth.md` 의 runtime augmenter 절(`availableModels` 설명, 496행 근방).
- **shape 검증**: `runtimeEnv` 는 이미 `Readonly<Record<string,string>>` 이라 타입 변경 없음 — 문서 예제 그대로 typecheck 통과.
- **semantics 검증**: "augmenter 가 `availableModels` 를 주면 그 목록만 노출" → "**+ `runtimeEnv.ANTHROPIC_MODEL` 이 있으면 중복이 아닐 때 1행 추가**"로 의미가 바뀐다 → 문서를 같이 갱신한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 파서 규약 "명시 모델(`env.ANTHROPIC_MODEL`>`model`)은 default 선정에만" | `docs/TRD.md:344` | §9 TO-BE `withExplicitModel` | **변경** — `ANTHROPIC_MODEL` 은 노출 목록에도 들어간다(D-005·D-006). 문서 갱신 대상 |
| "노출 목록 내 default 정확히 1개" | `docs/TRD.md:344` · 0026 | §7 AC15 | 유지 |
| "`model:null` 항목은 SDK 가 bare alias 를 해석(모델명 추측 금지)" | `docs/TRD.md:344` | §10 EP-08 | 유지 — identity 는 alias 를 그대로 쓴다 |
| "wire/state 는 표시 문자열이 아니라 `providerKey`·`modelFamily` 구조 필드" | `docs/TRD.md:601` | §12 | 유지 — `modelFamily` 값 형식만 1M 을 싣는다. 문서 문장 보강 |
| `AgentModelView = {alias, model, isCustom, oneMillionContext, isDefault}` | `docs/IPC_CONTRACT.md:70` | §12 | 유지 — 필드 불변 |
| "custom 항목은 실제 모델명을 그대로 표시하고 선택값도 같은 이름" | `docs/arch/frontend/ux-domains.md:158` | §10 EP-07 | **변경** — 1M 변형은 선택값에 `[1m]` 이 붙는다. 문서 갱신 대상 |
| 0150 D④ "계획 승인 = allow 의 `updatedPermissions`" | `docs/handoff/0150-.../plan.md` | §9 유지 목록 | 유지 |
| `DEFAULT_PERMISSION_MODE = 'auto_classified'` (0??? D-012) | `shared/permission-mode.ts:30` | §10 EP-13 | 유지 — 상수는 그대로 두고 **haiku 세션에서만** 강등한다 |
| 워크스페이스 가드가 `~/.claude` write 를 연다("plan 아티팩트 기록") | `workspace-guard.ts:26-31` | §8 | 유지 — 이번 설계가 이 예외에 의존하지 않는다(파일을 읽지 않음) |
| 0204 D-017 "두 종류가 한 목록에 산다"(`agent`+`background`) | `taskBoard.ts:4-9` 주석 | §9 TO-BE · §10 EP-16 | **변경** — `작업` 타일은 `agent` 만 담는다(D-013). 주석 갱신 대상 |
| 0204 D-019 "두 타일이 같은 항목을 다른 책임으로 그린다" | `taskBoard.ts:8-9` 주석 | §9 TO-BE | **변경** — 같은 항목을 두 타일이 그리지 않는다. 서브에이전트는 `백그라운드 작업` 타일 단독 |
| 0204 D-004 "완료 통지 파트와 같은 게이트로 작업 타일 미확인 배지" | `chatReducer.ts:856` 주석 | §10 EP-18 | **변경** — background 정착은 통지 파트만 남기고 배지는 켜지 않는다(D-016) |
| 0212 D-021·D-022 (전환 버튼 조건 · `paused` 중단 허용) | `taskBoard.ts:369`·`:390` | §9 유지 목록 | 유지 — status 3함수는 그대로, `TaskBoardItem` 래퍼만 삭제 |
| 0204 §10 EP-04 "둘째 줄 한 슬롯을 두 분기가 나눠 쓴다" | `TaskTileContent.tsx:259` 주석 | §10 EP-17 | **변경** — 분기가 하나(막힘 표시)만 남는다 |
| **ΔV1 D-018** "`Composer` 는 마운트로 도달할 수 없다" | plan §3 Decision Ledger | §8 F-21·F-22 | **변경(반증)** — `Popover` 가 닫히면 `createPortal` **앞에서** `null` 을 반환하고 SSR 은 effect 를 실행하지 않는다. `Composer` 자체는 마운트된다(3795자). D-021 이 경계를 *컴포넌트* 에서 *실행되지 않는 영역* 으로 옮긴다 |
| **ΔV1 §10 EP-20** "6 사이트" | plan §10 | verify r2 D1 | **변경(분모 오류)** — 검색 술어가 해법의 이름이라 이미 고친 자리만 올랐다. 주어로 재산출하면 **9** 이고 그중 3이 미계수였다 |
| 0213 D-007 "안내 분모 = `items` 전체가 아니라 할 일 항목" | `TaskTileContent.tsx` `unsupported` 술어 | §11 ΔV1 · verify D7 | **변경(소멸)** — `items` 자체가 할 일뿐이라 두 분모가 같아졌다. 술어가 `items.length === 0` 으로 단순화됐고 0213 의 구분은 더 이상 필요 없다 |
| 0212 주석 "기본값을 둬서 기존 렌더 테스트가 인자를 늘리지 않고도 그대로 돈다"(`pausedIds`·`backgroundedIds`) | `SubAgentTileContent.tsx:213-216` | §10 EP-21 | **부분 변경** — `stopErrors` 만 필수로 올린다(D-019). `pausedIds`·`backgroundedIds` 의 기본값은 **유지**한다: 그 둘은 라이브 표식이라 부재가 곧 빈 집합이고, 배선 누락과 구분되지 않는 값이 아니다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 서술 폴백이 계획이 아닌 잡담을 싣는다 | 승인 카드 옆에 본문이 있는 편이 빈 화면보다 낫다(D-002 와 같은 판단). 본문은 사용자가 읽고 거부할 수 있다 |
| `plan` 이 있는데도 비어 보이는 다른 원인이 남는다 | AC3 의 실패 문구가 그 경우를 **관측 가능**하게 만든다 — 다음 라운드의 진단 입력이 된다 |
| 식별자 형식 변경이 진행 중 세션의 선택을 깨뜨린다 | `modelFamily` 는 DB 영속이 아니다(§8 전수: `model_family` 0건). `modelNameForFamily` 는 identity 매칭 실패 시 기존 predicate 로 폴백한다 |
| haiku 규칙이 CLI 실물보다 넓다(향후 auto 지원 haiku 를 감춤) | 사용자 선택⑧. §16 에 편차로 남기고, CLI 표가 바뀌면 D-009 를 재검토 |
| `ANTHROPIC_MODEL` 편입으로 목록이 4행이 되는 조합 | 기존 "1~3개" 서술은 env-only 조건부 문장이라 §16 에서 문서 갱신으로 흡수 |
| `작업` 타일에서 서브에이전트를 못 찾는 사용자 | `백그라운드 작업` 타일이 그대로 있고 AC20 이 그 능력을 회귀로 잠근다. 두 타일 이름이 이미 구분된다 |
| background 정착 배지 상실로 완료를 놓친다 | transcript 의 완료 통지 파트(`subagent_notice`)는 그대로 남는다 — 알림 경로가 0이 되지 않는다 |
| **AT-23 의 소스 단언이 리팩토링에 취약하다** | 식별자를 바꾸면 단언이 깨진다 — 그러나 **red 로 드러나므로 침묵이 아니다**(0209 r5 선례: 조악한 텍스트 단언이 배선 삭제를 잡았고, r6 이 그것을 지우자 같은 변이가 초록이 됐다). 대체 수단은 D-020(OPEN) |
| 필수 prop 전환이 미래의 새 소비처를 막는다 | 그것이 목적이다 — 새 소비처가 값을 계산하도록 강제한다. 프로덕션 소비처는 각 1곳뿐이라 비용이 작다(§8 전수) |

- 되돌리기 어려운 결정: **모델 선택 식별자 형식**(D-007). 지금 확정한다. `작업` 타일 범위 축소(D-013)는 파생 한 줄이라 되돌리기 쉽다.
- 신규 의존성: **0건** — 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/model-identity.ts`(신규) · `app/src/shared/permission-mode.ts`
- `app/src/main/adapters/plan-text.ts`(신규) · `claude.ts` · `claude-map.ts`
- `app/src/main/features/harnesses/claude/{available-models,model-parser}.ts` · `runtime-catalog.ts` · `models.ts`
- `app/src/main/app/chat-turn/send.ts`
- `app/src/renderer/src/features/chat/components/composer/{modes,modelSelection,ModeMenu,ModelMenu}.tsx|ts` · `Composer.tsx`
- `app/src/renderer/src/features/chat/{reducer/chatReducer.ts,store/chatStore.ts}`
- `app/src/renderer/src/features/chat/components/rightpanel/{PlanTileContent,TaskTileContent,SubAgentTileContent}.tsx` · `lib/taskBoard.ts`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/TRD.md`(§6.8 모델 파싱 규약·§Composer 모델 메뉴) · `docs/arch/frontend/ux-domains.md`(158행 + 우측 패널 타일 책임) · `docs/arch/backend/auth.md`(runtime augmenter 절)

## 19. 게이트

- 적용할 하위 가이드: [`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`](../../../app/AGENTS.md) · [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md)(레이어 DAG) · [`app/src/renderer/AGENTS.md`](../../../app/src/renderer/AGENTS.md)
- ABI/네트워크 등 환경 제약: DB 를 건드리지 않으므로 `npm test` 를 쓸 이유가 없다 — `pretest` 를 우회해 순수 스위트만 돌린다.
- 기본 정적 게이트: `npm run lint` · `npm run typecheck`
- 관련 테스트: `./node_modules/.bin/vitest run src/main/features/harnesses src/main/adapters src/shared src/renderer/src/features/chat`
- **ΔV1 추가 게이트**: 필수 prop 전환이 테스트 호출부 8곳을 깨므로 `npm run typecheck` 가 그 전수를
  드러낸다 — 진단 0줄이 될 때까지 인자를 더한다. 변이 4종(M-B·M-F·M-G·M-H)을 심어 각각 red 를 확인한다.
- **ΔV2 추가 게이트**: 변이 **6종**(M-B·M-F·M-H·**V-1**·**V-2c**·**V-5**)을 심어 각각 red 를 확인한다.
  소거 변이 V-2c 는 **잔여물 진단(`TS6133`)이 0이 될 때까지** 밀고 그 상태로 판정한다 —
  ΔV1 때 미사용 import 가 red 를 만들어 잠금으로 오독될 뻔했다.
- 사람 실기: AC3 문구 시각 1건 · custom 모델 실환경에서 계획 본문 노출 1건 · 서브에이전트 실행 중 두 타일 대조 1건.

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 여러 턴의 결정을 보존한다 — SUPERSEDED 0, OPEN 0, ACTIVE 17. 턴 중 도착한 요구⑨ 를 D-013~D-017 로 **추가**했고 기존 12건을 지우지 않았다.
- [x] Part I 만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — 요구②④⑨와 답변⑤⑦⑧을 원문 인용으로 §2 에 보존. 요구⑨ 의 "제외" 를 §4 에서 **제거(중복 제거)** 로 판정했고 이동으로 바꾸지 않았다.
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다 — §5 상태표 11행이 AC1~AC20·AC22 로 매핑.
- [x] Technical Design 에 AS-IS 와 TO-BE 가 모두 있고 같은 비교 축/구체성이다.
- [x] AS-IS → TO-BE Delta 11행이 모두 §11 파일 또는 AC 로 추적된다.
- [x] AS-IS 에서 사라진 책임 명시 — 두 곳의 `modelKey` 자체 계산식은 **이동**(shared 위임), `MODE_MENU_OPTIONS` 상수 소비는 **대체**(함수), `작업` 타일의 background 표면은 **삭제**(능력은 `백그라운드 작업` 타일에 이미 존재), background 중단 실패 문구는 **이동**(타일 간).
- [x] 수치·전칭·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 검산 절.
- [x] 각 AC 가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] Baseline V 를 만들었고 유효 V = V1 로 재구성 가능하다.
- [x] 변경 효과에 필요한 레벨을 선택했고 모든 NEW node 에 같은 레벨 REQUIRED pair 가 있다 — R 5개·SD 4개·AR 5개·MD 5개 전부 VP-01~VP-20 에 등장.
- [x] INHERITED/NOT_REQUIRED 없음 — Baseline V 라 해당 없음.
- [x] 각 pair 의 경로·§10 전수 분모·직접 oracle 이 있고 적대 증거는 **6개 pair**(VP-03·VP-07·VP-09·VP-10·VP-14·VP-17)만 이유·변이를 갖는다.
- [x] 현재 변경 산출물의 운영 gate 4종을 열거했고 기존 DB-ABI red 를 blocking 으로 올리지 않았다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 실기 3건은 시각·실환경·타일 대조뿐이고 목록 포함 여부는 전부 순수 테스트다.
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — 구조·음성 주장 4건(VP-03·VP-07·VP-10·VP-17)에 결함 변이를 붙였고, 음성 AC16 에는 양성 짝 AC20 을 뒀다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 9행.
- [x] producer/consumer 양쪽 의미를 확인했다.
- [x] 상한·총량·one-way door 를 필요한 곳에서 계산했다 — §14 · §17.
- [x] 게이트 명령이 `app/AGENTS.md` 현행과 충돌하지 않는다 — `npm test` 대신 순수 vitest.
- [x] 본문 완성 후 Decision Ledger 와 기존 결정을 교차검증했고 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴(r1)이 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: Part I·Part II 전부. Decision 17건과 충돌 없이 구현했다.
- 이견 / 현실성 문제: **없음**. 다만 §9 TO-BE 의 runtime 경로 의사코드가 `withExplicitModel` 만
  적고 `markDefaultModel` 재호출을 빠뜨렸다(§11 `runtime-catalog.ts` 행도 같다) — 그대로 두면
  목록에는 들어오고 default 는 갱신되지 않는다. 아래 잠재 문제 #2.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.
- **착수 전 PLAN_GAP 1건을 설계자로 전환해 정정했다**(별도 커밋 `ea983b1`) — §10 EP-05 가 D-008 의
  지점을 1개로 셌으나 실측 2개다. §3 갱신 메모에 기록.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·VP-03·VP-04 | EP-01 계획 본문 해소 체인 | canUseTool 진입 (1) | 1/1 | `rg "resolvePlanText\(" src/main --glob '!*.test.ts'` → 2건(정의 1·호출 1) · `claude.ts:156` | — |
| VP-02 | EP-02·EP-03 서술 캡처·턴 리셋 | 2 | 2/2 | `rg "ctx.lastAssistantText = " claude-map.ts` → `:418`(캡처) `:541`(리셋) | — |
| VP-01 | EP-04 승인 대기 중 실패 문구 | 1 | 1/1 | `rg "planUnavailableTitle" src/renderer --glob '!*.test.ts'` → 3건(ko·en·렌더 1) | — |
| VP-08·VP-11·VP-16 | EP-05 dedupe 키 (2, r1 정정) | 2 | 2/2 | `available-models.ts:72` `modelIdentity(entry)` · `model-parser.ts:87` `sameParsedModel(...)` | — |
| VP-09·VP-11·VP-16 | EP-06 explicit 매칭 1M 포함 | 1 | 1/1 | `available-models.ts:86` `markDefaultModel(models, explicit?: ExplicitModel)` | — |
| VP-09·VP-10 | EP-07 식별자 SSOT | 2 | 2/2 | `rg "return modelIdentity\(model\)"` → `models.ts:19` · `modelSelection.ts:18` (둘 다 위임만) | — |
| VP-09 | EP-08 식별자 → SDK 문자열 | 1 | 1/1 | `models.ts:34` `modelIdentity(model) === wanted` | — |
| VP-09 | EP-09 행 key·활성 판정 | 2 | 2/2 | `ModelMenu.tsx:48`(key) `:49`(활성) | — |
| VP-05·VP-07·VP-16 | EP-10 settings explicit 편입 | 1 | 1/1 | `model-parser.ts:97` `withExplicitModel(visible, anthropicModel)` | — |
| VP-06·VP-07·VP-16 | EP-11 runtime explicit 편입 | 1 | 1/1 | `runtime-catalog.ts:125` + `markDefaultModel` 재호출(설계에 없던 줄, 잠재 문제 #2) | — |
| VP-12·VP-15 | EP-12 모드 메뉴 필터 | 1 | 1/1 | `modes.ts:60` 정의 · `Composer.tsx:466` 유일 호출부 | — |
| VP-13·VP-15 | EP-13 상태 강등 | 1 | 1/1 | `chatReducer.ts:1113` `coerceAutoPermissionMode(state.permissionMode, …)` | — |
| VP-13 | EP-14 main 동기화 | 1 | 1/1 | `chatStore.ts:1233`(신규 강등 경로) — 기존 `:1246` 은 `setPermissionMode` 경로로 분리 | — |
| VP-14·VP-15 | EP-15 턴 조립 보정 | 2 | 2/2 | `send.ts:356` 지역변수 1회 계산 → `:363`(controller) `:400`(TurnRequest) 두 지점이 같은 값 | — |
| VP-17·VP-20 | EP-16 파생이 agent 만 | 1 | 1/1 | `taskBoard.ts:234-236` — 반환이 `agentItem` 매핑 하나 | — |
| VP-17·VP-18 | EP-17 background 표면 제거 | 4 | 4/4 | **차집합 0**: `rg "function backgroundItem"`→0 · `item.background`→0 · `canStopTask\|canBackgroundTask`→0 · `kind === 'background'`→0 | — |
| VP-19 | EP-18 배지 마킹 agent 만 | 1 | 1/1 | `chatReducer.ts:864-870` subagent settled 분기에 `unseenSettledTaskKeys` 없음 · agent 경로 `:728` 유지 | — |
| VP-19 | EP-19 중단 실패 문구 렌더 | 1 | 1/1 | `SubAgentTileContent.tsx:361` | — |

- 합계: **19행 / 26 사이트 = 26/26**.
- §10에 없는데 같은 불변식이 필요했던 지점: **1건 — 정착 사유(`settlementMessage`)**. D-017("`작업`
  타일이 유일 렌더 지점이던 문구는 옮긴다")과 **같은 축**인데 §10 EP-19 는 중단 실패 문구 하나만
  셌다. `작업` 타일 제거로 0204 D-024 의 사유 문구도 소비자가 0곳이 됐다 — `SubAgentTileContent.tsx:295`
  에 옮겨 닫았다(선조치). ACTIVE Decision(D-024)이 이미 규칙을 갖고 있어 새 결정이 필요하지 않았다.

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `claude.canusetool.test.ts` 3케이스 + `plan0215.render.test.ts` 3케이스 | not selected — 승인 인자·렌더 문구 직접 관측 |
| VP-02 | REQUIRED | SELF_PASS | `claude-map.test.ts` 4케이스 (ctx 값 직접) | not selected |
| VP-03 | REQUIRED | SELF_PASS | `claude.plan-narrative.test.ts` 2케이스 — production `options.canUseTool` 포획 | **required** — `claude.ts` 의 `getPlanNarrative` 인자 제거 → **1 red** |
| VP-04 | REQUIRED | SELF_PASS | `plan-text.test.ts` 4케이스 | not selected |
| VP-05 | REQUIRED | SELF_PASS | `model-parser.test.ts` AT-05·AT-06 | not selected |
| VP-06 | REQUIRED | SELF_PASS | `runtime-catalog.test.ts` 3케이스 | not selected |
| VP-07 | REQUIRED | SELF_PASS | 두 경로 테스트 동시 green | **required** — `withExplicitModel` 항등화 → **3 red**(settings 2 · runtime 1) |
| VP-08 | REQUIRED | SELF_PASS | `available-models.test.ts` 3 + `model-parser.test.ts` AT-22 2 | not selected |
| VP-09 | REQUIRED | SELF_PASS | `settings.test.ts` 4 + `modelMenu0215.render.test.ts` 4 | **required** — dedupe 키를 base 이름으로 되돌림 → **2 red** · 형제 맞바꿈 케이스 내장 |
| VP-10 | REQUIRED | SELF_PASS | 두 `modelKey` 가 shared 위임(전수 grep 2/2) | **required** — renderer `modelKey` 만 옛 식 복귀 → **3 red** |
| VP-11 | REQUIRED | SELF_PASS | dedupe·explicit 반환값 | not selected |
| VP-12 | REQUIRED | SELF_PASS | `modes.test.ts` 3 + 렌더 2 | not selected |
| VP-13 | REQUIRED | SELF_PASS | `chatReducer.permission.test.ts` 5 + `chatStore.modelPermission.test.ts` 3 | not selected |
| VP-14 | REQUIRED | SELF_PASS | `send.permission-mode.test.ts` 4 — 두 지점 값 동시 관측 | **required** — TurnRequest 지점만 `payload.permissionMode` 로 복귀 → **1 red** |
| VP-15 | REQUIRED | SELF_PASS | `permission-mode.test.ts` 4 + `model-identity.test.ts` 5 | not selected |
| VP-16 | REQUIRED | SELF_PASS | `model-parser.test.ts` AT-15(3조합 전건 default 1개) | not selected |
| VP-17 | REQUIRED | SELF_PASS | `taskBoard.test.ts` 3(차집합) + 렌더 3 | **required** — 파생에 background 복원 → **13 red** |
| VP-18 | REQUIRED | SELF_PASS | `taskSurface0212`·`rightPanelTiles` 백그라운드 타일 케이스 전건 유지 | not selected — 존재 직접 관측 |
| VP-19 | REQUIRED | SELF_PASS | `chatReducer.task.test.ts` AT-18 + `rightPanelTiles` AT-19 3케이스 | not selected |
| VP-20 | REQUIRED | SELF_PASS | `taskBoard.test.ts` 반환 배열 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `claude.ts:~430` — `getPlanNarrative` 인자 제거 | `VP-03 선택 증거` | 최초 | `계획 서술 배선` 1건 | 잠김 |
| `available-models.ts:56-58` — `withExplicitModel` 본문을 항등함수로 | `VP-07 선택 증거` | 최초 | settings 2 · runtime 1 = 3건 | 잠김 |
| `available-models.ts:72` — dedupe 키를 `entry.model ?? entry.alias` 로 | `VP-09 선택 증거` | 최초 | `[1m] 변형` 2건 | 잠김 |
| `modelSelection.ts:18` — `modelKey` 를 옛 식(`model ?? alias`)으로 | `VP-10 선택 증거` | 최초 | ModelMenu 3건 | 잠김 |
| `send.ts:400` — TurnRequest 지점만 `payload.permissionMode` 로(형제 분리) | `VP-14 선택 증거` | 최초 | `haiku 면 두 지점` 1건 | 잠김 |
| `taskBoard.ts:234` — 파생에 background 항목 복원 | `VP-17 선택 증거` · 이번 턴 새 0건 oracle | 최초 | 13건(파생 3 · 렌더 10) | 잠김 |

- **분모 검산**: `선택 증거 6 · 인용 변이 0 · 새 oracle 1(AT-16 차집합, VP-17 변이가 함께 검출) = 표 행 6`.
- **덮개 회귀**: 이전 라운드 없음(r1). 다만 **장치를 옮긴 자리가 6곳**이라 하한을 확인했다 —
  0212·0213 의 `작업` 타일 background 단언 13건을 지우지 않고 `백그라운드 작업` 타일 축으로
  **옮겨** 같은 불변식을 계속 잠근다(paused 라벨·중단 가용성·전환 3조건·정착 사유·중단 실패 문구).
  `taskBoard.test.ts` 의 제어 술어 5케이스도 래퍼(`canStopTask`) 대신 status 함수로 재작성했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ `planUnavailableTitle/Desc` 2건 — `PlanTileContent` 가 렌더하고 `plan0215.render.test.ts` 가 화면 출력으로 단언 | — |
| **기존** 문구가 소비자를 잃지 않았는가 | ⚠️ **2건 잃을 뻔했다** — 중단 실패(설계가 잡음) + **정착 사유(설계가 못 잡음)**. 둘 다 백그라운드 타일로 이동 | §10 EP-19 분모 정정 제안 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 1건 — `send.ts` 가 `permissionMode` 지역변수를 도입했으나 `payload` 스코프 안이고 `finally` 경로가 읽는 변수는 건드리지 않았다 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ `plan_review 도착 · 둘 다 없음` 행 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | ✅ 승인 대기 중 본문 없음이 **경고 아이콘 + 실패 문구**로 보인다(기존엔 "아직 플랜이 없습니다") | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | ✅ 해당 없음 — 이번 변경에 비동기 응답 경로가 없다 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `작업` 타일이 유일 렌더 지점이던 문구가 **둘**이었다(중단 실패 + 정착 사유). §10 EP-19 는 하나만 셌다 | ✅ 선조치 — `SubAgentTileContent.tsx:295` 에 정착 사유 추가 | `rightPanelTiles.render.test.ts` 의 기존 AT-31 케이스가 red 로 드러냈다 |
| 2 | runtime 경로가 `withExplicitModel` 만 부르면 목록은 늘고 **default 는 안 바뀐다** | ✅ 선조치 — `markDefaultModel` 재호출 | `runtime-catalog.test.ts` AT-07 이 red 로 드러냈다 |
| 3 | 0213 D-007 의 "안내 분모 = 할 일 항목" 구분이 이번 변경으로 **소멸**했다(`items` 자체가 할 일뿐) | 📝 plan 수정 제안 — §16 에 supersede 행 추가 | `TaskTileContent.tsx` 의 `unsupported` 술어가 `items.length === 0` 으로 단순화됨 |
| 4 | 턴이 `result` 없이 중단되면 `ctx.lastAssistantText` 가 다음 턴으로 넘어간다. 다음 턴의 첫 assistant 텍스트가 덮으므로 창이 매우 좁지만 0은 아니다 | ⚠️ 보고만 — `turn.aborted` 경로에 리셋을 더할지는 제품 판단(계획 본문이 한 턴 낡을 수 있다) | `claude-map.ts` 는 `result` 분기에서만 비운다 |
| 5 | `modelFamily` 형식 변경 후 **진행 중 세션의 옛 선택값**은 `selectionExists` 에서 탈락해 default 로 되돌아갈 수 있다 | ⚠️ 보고만 — 영속되지 않는 값이라 재시작 후엔 무관하고, `modelNameForFamily` 에 legacy 폴백을 뒀다 | `rg model_family src/main/infra/db` → 0건 |
| 6 | `백그라운드 작업` 타일 상세에는 `최근 작업`(`currentChildLabel`) 행이 없다 — `작업` 타일 상세가 유일 소비자였다 | ⚠️ 보고만 — 그 타일은 child transcript 를 통째로 보여줘 정보량이 더 많다. 필요하면 후속 | `taskDetailRows` 의 `detail.lastTool` 행 제거 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: **1건** — §11 은 `ModeMenu` 가 `options` prop 을
  받고 Composer 가 `modeMenuOptions(model)` 을 넘긴다고 적었다. 그대로 하되 **모델 형상을 뽑는
  헬퍼를 `modelSelection.ts#selectedModelShape` 로 분리**했다(설계에 없던 함수). 이유: `modes.ts`
  가 카탈로그 조회를 하면 `shared` 성격의 순수 모듈이 도메인 조회를 갖게 된다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 두 함수 모두 순수하고 시간 축이 없다 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | `selectedModelShape` 가 `agents`(agentStore)를 읽는다 — 카탈로그가 비면 `null` 이 아니라 **선택값 문자열로 폴백**한다. 폴백이 없으면 하이드레이션 지연 중 haiku 에서 '자동'이 잠깐 열린다 | AC11 / `modelMenuOptions` 의 `selection.modelAlias ?? ''` 경로 · `modes.test.ts` `modesOf(null)` 케이스가 미선택 축을 잡는다 |
| 재진입 | 해당 없음 — 렌더마다 새로 계산하는 순수 파생이라 상태를 남기지 않는다 | — |
| 다른 무효화 축 | provider 기여 회수 시 `agents` 에서 사라진다 → 위 폴백이 같은 자리를 덮는다 | AC11 / `selectedModelShape` 의 카탈로그 미스 분기 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | production 19 · 테스트 20 (신규 7: `shared/model-identity.ts`·`adapters/plan-text.ts` + 테스트 5) · 문서 3 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-migrations-appendonly.mjs` |
| **관측한 게이트 산출** | lint **0 error / 1 warning**(기존 `useTranscriptVirtualizer` react-compiler 경고, 변경 무관) · typecheck **3구성 0** · vitest **327파일 3233케이스 전건 green, 0 failed / 7 skipped** · doc-inventory `9 items, 82 channels` + prose ok + links ok · migrations `20 migrations` sync ok |
| ABI 주의 | 첫 전체 실행에서 DB 로드 10파일 55케이스가 `Module did not self-register: better_sqlite3.node` 로 red 였다 — `npm ci` 가 Electron ABI 를 남긴 상태였다. `node scripts/ensure-sqlite-abi.mjs node` 후 **전건 green**. 변경 무관한 환경 축이다 |
| V-pair 자기확인 | `SELF_PASS 20 / SELF_BLOCKED 0`; pair별 상세는 위 표 |
| 강제 지점 전수 | **26/26** (19행) |
| **AC 자기보고**(`Criteria-Met`) | 아래 합계 검산 참조 |
| **합계 검산** | ✅ 20 · ⚠️ 2(사람 실기) · ❌ 0 = 총 22. ⚠️ 2 = **AC3 문구 시각**(판정 로직은 렌더 테스트로 닫음) · **custom 모델 실환경 계획 노출**(모델 행동 의존이라 실기 필요). 분모는 r1 착수 전 정정으로 21→22 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

### AC 행별 관측

`AC1`✅`claude.canusetool` AT-01 · `AC2`✅같은 파일 AT-02 · `AC3`⚠️로직 green(`plan0215.render` 3케이스), 시각 사람 ·
`AC4`✅`claude-map.test` 턴 리셋 · `AC5`✅`model-parser` AT-05 · `AC6`✅AT-06 3케이스 · `AC7`✅`runtime-catalog` 3케이스 ·
`AC8`✅`available-models` 3케이스 · `AC9`✅`settings.test` 4케이스 · `AC10`✅`modelMenu0215.render` 4케이스 ·
`AC11`✅`modes.test` 3 + 렌더 2 · `AC12`✅`chatReducer.permission` 5 · `AC13`✅`chatStore.modelPermission` 3 ·
`AC14`✅`send.permission-mode` 4 · `AC15`✅`model-parser` AT-15 · `AC16`✅`taskBoard.test` 차집합 0 ·
`AC17`✅잔여 4축 전부 0건 · `AC18`✅`chatReducer.task` AT-18 · `AC19`✅`rightPanelTiles` AT-19 3케이스 ·
`AC20`✅`taskSurface0212` 21케이스 전건 유지 · `AC21`✅게이트 산출 위 · `AC22`✅`model-parser` AT-22 2케이스.
남은 ⚠️ 1건: **custom 모델 실환경 계획 노출**(AC1 의 프로덕션 도달 — 모델이 계획 파일을 쓰지 않는
실제 조합은 실기로만 재현된다).

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: r1 이라 이전 라운드 없음.
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: **2건**. ① §10 EP-05 가
  D-008 의 지점을 1개로 셌다 — 설계가 `normalizeAvailableModels` 만 보고 `model-parser` 의 교차
  필터를 세지 않았다(착수 전 정정). ② §10 EP-19 가 "유일 렌더 지점을 잃는 문구"를 **중단 실패
  하나로** 셌다 — 같은 축의 정착 사유가 §8 전수 조사(`taskStopErrors` 렌더 소비처 1곳)에는
  잡혔지만 `settlementMessage` 는 그 검색의 술어에 없었다.
- 반복해서 부딪히는 환경 한계: better-sqlite3 ABI 가 `npm ci`(Electron) ↔ vitest(Node) 사이에서
  뒤집힌다 — `app/AGENTS.md` 가 문서화한 그대로다.
- 현재 라운드 수: 1

---

## [구현자 기입] 설계 리뷰 (r2 — ΔV1)

- 동의 / 그대로 진행: ΔV1 규범 행 전부 — D-018·D-019, AC23·AC24, VP-21·VP-22, EP-19(2)·EP-20·EP-21.
  D-020 은 OPEN 그대로 두었다(신규 의존성 0).
- **이견 / 현실성 문제: 1건 — AC24 의 *시드 수단*.** plan 은 "store 를 시드해 `SubAgentTileContent`
  를 렌더" 라 적었으나 `useChatStore.setState` 시드는 SSR 렌더에 **보이지 않는다**. zustand v5 의
  `useStore` 가 `getServerSnapshot = () => selector(api.getInitialState())` 이고
  (`node_modules/zustand/react.js:8-12`) `setState` 는 새 객체를 만들어 초기 상태 객체를 갱신하지
  않는다. 실측: `getState().…messages` 1건 / `getInitialState().…messages` 0건 / 렌더 출력에 시드
  문자열 **미포함**. → 같은 oracle 에 도달하는 다른 시드 수단으로 대체했다(아래 §설계 대비 차이).
- **이것을 `PLAN_GAP` 으로 올리지 않은 근거**: VP-22 의 pair·경로·requiredness·§10 강제 지점·직접
  oracle(컨테이너 마운트 렌더 출력의 문구)·등록 변이(M-G)가 전부 그대로 성립한다. 바뀐 것은
  oracle 에 도달하는 **시드 하위 수단** 하나이고, 새 node·pair·경로·강제 지점을 요구하지 않는다.
- ACTIVE Decision 과 충돌하는 설계 발견: 없음.
- **§8 전수 행 1건이 과대였다**: `필수화가 깨뜨릴 테스트 호출부 8` 은 *참조* 를 셌다(import·주석·이미
  준수하는 호출 포함). 실제로 필수 prop 이 빠진 호출부는 **2곳**이다 — 아래 잠재 문제 #2.

## [구현자 기입] 강제 지점 전수 (§10 대조 · r2 — ΔV1 신설 행)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-19 | EP-19 유일 렌더 지점을 잃는 문구 (2) | 2 | 2/2 | `SubAgentTileContent.tsx:361`(중단 실패) · `:295`(정착 사유) — r1 선조치를 r2 가 재관측 | — |
| VP-21 | EP-20 `Composer` 가 값을 공급 (5) | 5 | 5/5 | 주어 검색 `rg 'setModel\(' src/renderer --glob '!*.test.*'` → 호출 3(`:193`·`:200`·`:498`) + 정의 1(`chatStore.ts:1220`, 호출 아님) · `rg '<ModeMenu' src/renderer` → 1(`:464`) · memo 축약 `Composer.tsx:181` | — |
| VP-22 | EP-20 `SubAgentTileContent` 가 값을 공급 (1) | 1 | 1/1 | `rg '<SubAgentTaskList' src/renderer` → 1(`:142`), `stopErrors={stopErrors}` `:147` | — |
| VP-21 | EP-21 관대한 기본값 제거 — `ModeMenu.options` (1) | 1 | 1/1 | `rg '^\s*[a-z]*\?:' ModeMenu.tsx` → **0건**(변경 전 1) · 폴백 `?? MODE_MENU_OPTIONS` 0건 | — |
| VP-22 | EP-21 관대한 기본값 제거 — `SubAgentTaskList.stopErrors` (1) | 1 | 1/1 | `rg 'stopErrors\?:' SubAgentTileContent.tsx` → **0건** · 기본값 `stopErrors = {}` 0건 | — |

- **EP-20 분모 검산**: `setModel` 호출 3 + `<ModeMenu options=` 1 + memo `modelAlias` 1 + `stopErrors=` 1
  = **6** — plan §8 의 6 과 일치한다(주어로 다시 세도 같다).
- **EP-21 잔여 optional prop 2건은 누락이 아니라 명시 면제다** — `pausedIds`·`backgroundedIds` 는
  plan §16 이 "부재가 곧 빈 집합이라 배선 누락과 구분되지 않는 값이 아니다" 로 유지 판정했다.
  실측: `SubAgentTileContent.tsx:215`·`:216` 두 줄만 남고 `ModeMenu` 는 0건.
- **누적 강제 지점**: V1 구간 **27**(EP-19 의 2번째 지점 포함 — r1 이 선조치로 닫았고 위 표에서
  재관측했다) + ΔV1 신설 **8**(EP-20 6 · EP-21 2) = **35/35**. r2 가 이번 턴에 닫은 것은 **8** 이다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| **M-B** `Composer` 가 `<ModeMenu options=…>` 미전달 | VP-21 선택 증거 · D1 인용 변이 | **green 838/838**(verify r1) | `축① ModeMenu 에 …options 를 넘긴다` 1건 (843/844) | **red — 잠김** |
| **M-F** `setModel(…, null, …)` | VP-21 선택 증거 · D1 인용 변이 | **green 838/838** | `축③ setModel 호출 전건이 alias 를…` 1건 | **red — 잠김** |
| **M-H** memo 가 `modelAlias: null` | VP-21 선택 증거 · D1 인용 변이 | **green 838/838** | `축② selectedModel memo 가 modelAlias 를 싣는다` 1건 | **red — 잠김** |
| **M-G** `SubAgentTileContent` 가 `stopErrors` prop 미전달 | VP-22 선택 증거 · D1 인용 변이 | **green 838/838** | AT-24 3건 (841/844) | **red — 잠김** |
| **S-1** 형제 맞바꿈 — `setModel` 의 `modelFamily` ↔ `modelAlias` | 새 oracle 민감도(소스 단언은 구조적 proxy) | 최초 | `축③` 1건 | **red — 잠김** |
| **S-2** 형제 맞바꿈 — memo 의 `modelAlias` 슬롯에 형제 값(`modelFamily`) | 새 oracle 민감도 | 최초 | `축②` 1건 | **red — 잠김** |
| **EP-21-B** `options` prop 누락 + 잔여물 제거 | 새 강제 지점(typecheck 축) | 최초 | `TS2741 Property 'options' is missing` · 잔여물 진단 **0** | **red — 잠김** |
| **EP-21-G** `stopErrors` prop 누락 + 잔여물 제거 | 새 강제 지점(typecheck 축) | 최초 | `TS2741 Property 'stopErrors' is missing` · 잔여물 진단 **0** | **red — 잠김** |

- **분모 검산**: `선택 증거 4(M-B·M-F·M-H·M-G) · 인용 변이 4(파생 이슈 D1 이 인용한 같은 4건 —
  동일 집합이라 행을 겹쳐 쓴다) · 새 oracle 2(민감도 검사 4행: 형제 맞바꿈 2 · EP-21 typecheck 2)
  = 표 행 8`.
- **소거 변이의 잔여물 수렴**: M-B·M-G 는 필수화 이후 `TS6133` 잔여물을 낳으므로 미사용 import·
  지역변수까지 밀어 **잔여물 진단 0** 상태에서 다시 쟀다 — 그 상태에서도 `TS2741` 이 남는다.
  vitest 축은 잔여물과 무관하게 red 다(esbuild 는 타입을 보지 않는다).
- **덮개 회귀 없음 — 재실행으로 확인했다.** 이번 라운드는 장치를 교체하지 않고 새 oracle 2개를
  **더했다**(전체 3233 → 3239, 감소 0). 다만 기존 테스트 파일 2곳(`rightPanelTiles`·`taskSurface0212`)
  에 필수 인자를 더했으므로 r1 이 red 로 잡던 축 2개를 실제로 다시 심었다:
  `taskBoard.ts:234` 파생에 background 항목 복원 → **red 45건** · `modelSelection.ts:18` `modelKey` 를
  옛 식(`model ?? alias`)으로 → **red 3건**. 전자의 건수가 r1 의 13 과 다른 것은 변이의 *형상* 이
  달라서다(주입 항목의 필드 구성) — 방향(red)과 잠금 여부가 확인 대상이고 건수는 비교 축이 아니다.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ **해당 없음** — 이번 라운드의 산출은 잠금(테스트 2 · 필수 prop 2)이고 사용자 대면 문구 0건 | — |
| **기존** 문구가 소비자를 잃지 않았는가 | ✅ 프로덕션 동작 변경 0 — 필수화는 값 전달을 바꾸지 않는다. 기존 838케이스 전건 유지 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | ✅ **재배치 0건** — `export` 3건 제거는 모듈 공개면만 좁히고 호출부는 전부 같은 파일 안이다 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 해당 없음 — 새 실패 경로 0 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 해당 없음 — 화면 산출 불변 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — 비동기 경로 미변경 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | AC24 가 적은 `setState` 시드가 SSR 렌더에 **도달하지 않는다** | ✅ 선조치 — 같은 oracle 에 도달하는 `getInitialState()` 제자리 시드로 대체. 축별 실패 모드는 아래 | 프로브 실측: `getState 1 / getInitialState 0 / 출력 미포함` |
| 2 | plan §8 `깨질 테스트 호출부 8` 이 과대 — 실제 **2곳** | ✅ 보고 — 8은 *참조*(import 2·주석 1·이미 준수하는 호출 3 포함) | `npm run typecheck` 가 정확히 `rightPanelTiles:111`·`taskSurface0212:124` 2건만 냈다 |
| 3 | 시드 도달 자체가 실패하면 AT-24 의 두 단언이 "아무것도 안 그려진 출력" 과 구분되지 않는다 | ✅ 선조치 — 세 번째 케이스로 **빈 상태 문구 소멸**을 양성 관측한다 | `subagentWiring.render.test.ts` `시드가 실제로 SSR 렌더에 도달한다` |
| 4 | M-G 소거 시 `stopErrors[...]` 가 `undefined` 접근으로 **throw** 한다(assertion 실패가 아닌 crash) | 보고만 — red 라는 결론은 같고, 필수화(EP-21)가 typecheck 에서 먼저 막아 프로덕션에 도달하지 않는다 | M-G 실행에서 3케이스 red |

### 설계 대비 명시적 차이 (r2)

**차이**: AC24 의 시드 수단을 `useChatStore.setState` → `useChatStore.getInitialState()` **제자리 변형**
으로 바꿨다. 이유는 위 §설계 리뷰의 실측이다. 대체물이 갖고 원본이 갖지 않던 실패 모드를 축마다 적는다.

| 축 | 대체물의 실패 모드 | 다시 확인한 AC / §10 행 |
|---|---|---|
| 만료 | **해당 없음** — 초기 상태 객체는 모듈 수명 동안 교체되지 않는다(`createStore` 가 생성 시 1회 캡처) | AC24 — 3케이스 green |
| **공유** | **있다** — 초기 상태 객체는 파일 내 모든 테스트가 공유하고 `setState` 와 달리 스스로 되돌아가지 않는다. `afterEach` 로 `messages`·`taskStopErrors` 두 필드를 원복한다. vitest 는 파일별 모듈 격리라 파일 간 누출은 없다 | AC24 — 단독 실행 3/3 · 전체 실행 3239/3239 둘 다 green(순서 무관) |
| 재진입 | **해당 없음** — 시드→`renderToStaticMarkup` 사이에 비동기 경계가 없다(동기 렌더) | AC24 |
| 다른 무효화 | **있다(잠재)** — 제자리 변형은 구독자를 깨우지 않는다. SSR 은 구독하지 않으므로 이 oracle 에는 무영향이나, 이 파일이 훗날 CSR 마운트로 바뀌면 시드가 반영되지 않는다 | plan D-020(OPEN) 이 열리는 자리 — §17 리스크로 기록 |

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | production 4(`ModeMenu.tsx`·`SubAgentTileContent.tsx` 필수화 · `available-models.ts`·`permission-mode.ts` export 정리) · 테스트 4(신규 2 · 인자 추가 2) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run src/main/features/harnesses src/main/adapters src/shared src/renderer/src/features/chat` · `node scripts/ensure-sqlite-abi.mjs node` 후 `./node_modules/.bin/vitest run` |
| **관측한 게이트 산출** | lint **0 error / 1 warning**(기존 `useTranscriptVirtualizer` react-compiler 경고, 변경 무관) · typecheck **3구성 0 error** · 지정 스위트 **169파일 1619케이스 green** · 전체 **329파일 3239케이스 green, 0 failed / 7 skipped**(r1 327/3233 → 신규 테스트 2파일 6케이스) |
| ABI 주의 | 전체 실행 전 `node scripts/ensure-sqlite-abi.mjs node` 를 먼저 돌렸다 — r1 과 같은 축 |
| V-pair 자기확인 | `SELF_PASS 22 / SELF_BLOCKED 0` — V1 20 pair 유지 + ΔV1 VP-21·VP-22 신규 |
| 강제 지점 전수 | 이번 턴 **8/8**(EP-20 6 · EP-21 2) · 누적 **35/35** |
| **합계 검산** | ✅ 22 · ⚠️ 2(사람 실기) · ❌ 0 = **총 24**. 분모가 r1 의 22 에서 24 로 늘었다(AC23·AC24 신설) — r1 합계와 직접 비교하지 않는다 |
| 선택적 정리(verify D3) | 수행 — `classifyModel`·`matchesExplicit`·`AUTO_UNSUPPORTED_FALLBACK_MODE` 의 `export` 제거. 착수 전 `rg` 로 파일 밖 참조 **0건** 재확인 |
| 블로커 / 역질문 | 없음. D-020(jsdom)은 OPEN 유지 — 신규 의존성이라 사용자 결정 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

### AC 행별 관측 (r2 신설분)

`AC23`✅ `composerWiring.test.ts` 3케이스 — 축① `<ModeMenu options={modeMenuOptions(selectedModelShape(…))}`
· 축② memo 축약 `modelAlias` + 의존성 배열 · 축③ `setModel` 호출 **정확히 3건**의 3번째 인자가 전부
`…Alias` . 변이 M-B·M-F·M-H 및 형제 맞바꿈 S-1·S-2 가 각각 red.
`AC24`✅ `subagentWiring.render.test.ts` 3케이스 — 컨테이너 마운트 출력에 `중단하지 못했습니다` 존재
(양성 짝: 행 제목 `로그 파서 조사`), 실패 없으면 미존재(음성 짝), 시드 도달 양성 관측. 변이 M-G 가 red.
`AC21`✅ 게이트 재관측 — 위 표.
나머지 AC1~AC22 는 이번 라운드가 프로덕션 동작을 바꾸지 않았고 r1 관측이 전건 유지된다(838→838).

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **같은 축이다.** r1 이 닫은 것은 *규칙*
  (`modeMenuOptions` 가 무엇을 거르는가 · `SubAgentTaskList` 가 문구를 어떻게 그리는가)이고
  r2 가 닫은 것은 **그 규칙의 입력을 View 에 공급하는 배선**이다. verify r1 D1 이 지목한 축 그대로다.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가, 있었다면 왜 안 걸렸는가: **있었다.**
  `handoff-plan/SKILL.md §5` 의 "단위를 잠그고 **그 단위를 부르는 배선**을 잠그지 않으면 배선을
  지운 회귀가 초록으로 통과한다" 가 정확히 이 경우다. r1 설계가 AC11·AC19 의 검증 수단을
  *순수 함수* 와 *props View* 로 적는 순간 배선이 분모에서 빠졌고, 그 AC 들은 각자 축에서
  전부 참이었다 — 그래서 게이트가 초록인 채로 결함이 남았다.
- 반복해서 부딪히는 환경 한계: ① renderer 테스트에 DOM 이 없어 `Popover`→`createPortal` 안의
  배선은 마운트로 관측할 수 없다(D-020 OPEN). ② zustand v5 의 SSR 스냅샷이 `setState` 시드를
  무시한다 — 컨테이너 마운트 oracle 을 쓸 때마다 다시 부딪히는 자리다. ③ better-sqlite3 ABI 뒤집힘.
- 현재 라운드 수: 2

---

## [구현자 기입] 설계 리뷰 (r3 — ΔV2)

- 동의 / 그대로 진행: ΔV2 규범 행 전부 — D-021·D-022, AC23(정정)·AC25·AC26, EP-20a~d·EP-22, VP-21 변이 6종.
- 이견 / 현실성 문제: **없음.** D-021 의 전제(`Composer` 마운트 가능)를 구현 전에 직접 재현했다 —
  props `{backendLabel, canAbort}` 만으로 throw 0 · HTML 3795자, 시드 후 4249자.
- ACTIVE Decision 과 충돌하는 설계 발견: 없음. D-020 은 OPEN 유지(신규 의존성 0).
- **설계가 적지 않은 게이팅을 하나 찾았다** — 모델 칩은 `agents.some((a) => a.supported)` 로 가려진다
  (`Composer.tsx:389`). `supported` 없이 시드하면 칩이 통째로 사라진다. AC26 은 `toContain` 이라
  거짓 통과가 아니라 **실패**하지만, 그 실패 원인이 배선이 아니라 시드라 오독을 부른다 → 세 번째
  케이스로 도달 자체를 양성 관측한다(아래 잠재 문제 #2).

## [구현자 기입] 강제 지점 전수 (§10 대조 · r3 — ΔV2 신설 행)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-21 | EP-20a `Composer` 가 `selectedModel` 을 소비자에게 넘긴다 | 4 | **3/4** | `rg -n 'selectedModel' Composer.tsx`(memo 정의·import 제외) → `:255`·`:392`·`:466`·`:496` | **`:255` = NOT_REQUIRED**(0119 steerGate, ΔV2 §7-A 에 사유 기재) |
| VP-21 | EP-20b `setModel` 4슬롯 순서 계약 | 3 | 3/3 | `rg -c 'setModel\(' Composer.tsx` → **3**. 축③ 이 호출마다 `args.length === 4` + 슬롯별 정규식 | — |
| VP-21 | EP-20c memo 가 선택 3필드를 싣는다 | 1 | 1/1 | `rg -c 'const selectedModel = useMemo' Composer.tsx` → **1**. 축② 가 `providerKey`·`modelFamily`·`modelAlias` 각각 축약·비-null·의존성 3검사 | — |
| VP-22 | EP-20d 타일 → 목록 View | 1 | 1/1 | `rg -n 'stopErrors={' SubAgentTileContent.tsx` → `:147`. ΔV1 AT-24 가 이미 닫았고 r3 이 재관측 | — |
| VP-21·VP-22 | EP-21 관대한 기본값 제거 | 2 | 2/2 | ΔV1 에서 닫음. `rg '^\s*[a-z]*\?:' ModeMenu.tsx` → 0건 · `rg 'stopErrors\?:'` → 0건 | — |
| VP-21 | EP-22 관측 수단을 **실행 여부**로 가른다(D-021) | 2 버킷 | 2/2 | 소스 단언 5지점 → `composer/composerWiring.test.ts` · 마운트 1지점(`:392`) → `composerMount.render.test.ts` | — |

- **ΔV2 분모 검산**: `a4 + b3 + c1 + d1` = **9**, `EP-21 2` · `EP-22 2` → ΔV2 구간 **13 사이트**.
  그중 `:255` 1건이 `NOT_REQUIRED` 이므로 **12/13 닫음 + 1 명시 제외**.
- **누적**: V1 27 + ΔV2 13 = **40 사이트**(plan §8 검산과 일치), 요구 39 중 **39 닫음**.
- **검색 술어는 불변식의 주어다** — `selectedModel`(넘기는 대상) · `setModel(`(되쓰는 동작) ·
  `stopErrors={`(넘기는 값). ΔV1 이 쓴 해법 이름(`options=\{modeMenuOptions`)은 술어에서 뺐다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r3)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| **M-B** `<ModeMenu options=…>` 미전달 | VP-21 선택 증거 | r2 red | `축①` 1건 (847/848) · `TS2741` | red — 잠김 |
| **M-F** `setModel(…, null, …)` | VP-21 선택 증거 | r2 red | `축③` 1건 | red — 잠김 |
| **M-H** memo `modelAlias: null` | VP-21 선택 증거 | r2 red | `축②` 1건 | red — 잠김 |
| **V-1** `<ModelMenu selection={null}>` | D1(r2) 인용 변이 | **r2 GREEN 844/844** | `축④` 1건 | **red — 새로 잠김** |
| **V-2c** 칩 라벨 → 폴백(미사용 import 까지 밀어 **잔여물 진단 0**) | D1(r2) 인용 변이 | **r2 GREEN 844/844** | AT-26 **3건** (845/848), **typecheck 0** | **red — 새로 잠김** |
| **V-5** `setModel(pk, alias, alias, adapter)` 형제 슬롯 중복 | D2(r2) 인용 변이 | **r2 GREEN 844/844** | `축③` 1건 | **red — 새로 잠김** |
| **S-1** `modelFamily` ↔ `modelAlias` 맞바꿈 | 형제 슬롯 규칙(§3) | r2 red | `축③` 1건 | red — 잠김 |

- **분모 검산**: `선택 증거 6(M-B·M-F·M-H·V-1·V-2c·V-5) · 인용 변이 3(D1(r2) V-1·V-2c · D2(r2) V-5
  — 선택 증거와 **동일 집합**이라 행을 겹쳐 쓴다) · 새 oracle 4(축② 확장·축③ 확장·축④ 신설·
  마운트 신설) → 민감도 검사에 형제 맞바꿈 S-1 을 더해 **= 표 행 7**`.
- **V-2c 는 typecheck 0 상태에서 red 다** — 잔여물(`TS6133`)에 걸린 부산물이 아니라 **마운트
  oracle 이 동작으로 잡은 것**이다. ΔV1 때 이 자리는 잔여물을 치우면 초록으로 수렴했다.
- **덮개 회귀 0**: 이번 라운드는 장치를 **교체하지 않고 확장**했다. 축①은 원문 그대로, 축②·축③은
  단언을 **더했다**(줄이지 않음). r2 가 red 로 잡던 M-B·M-F·M-H·S-1 이 전부 red 로 재현된다.

## [구현자 기입] Product/UX 파생 검토 (r3)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ **해당 없음** — 산출은 잠금(테스트 2파일)뿐, 사용자 대면 문구 0건 |— |
| **기존** 문구가 소비자를 잃지 않았는가 | ✅ 프로덕션 코드 변경 **0줄** — `git diff --stat` 에 `Composer.tsx`·`ModeMenu.tsx` 등 production 파일이 없다 | — |
| seam 을 만들려고 production 을 재배치했는가 | ✅ **0건** — 마운트 oracle 은 기존 컴포넌트를 그대로 렌더한다 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 해당 없음 — 새 실패 경로 0 | — |
| 실패가 화면에서 "아무 일도 안 일어남" 으로 보이지 않는가 | 해당 없음 — 화면 산출 불변 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — 비동기 경로 미변경 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r3)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **§5 전수 적용** — "분모의 술어를 해법 이름으로 쓴다" 가 plan §8 의 **다른 행**에도 있는지 | ✅ 선조치(조사) — 검색 술어 33개를 분류해 위험 2건을 주어로 재측정. **추가 지점 0** | A: `.plan` 직접 읽기 = `plan-text.ts:22` 1곳(=`resolvePlanText` 내부) · B: `[1m]` 재부착 = `model-identity.ts:28` 1곳. 나머지 hit 는 전부 주석 |
| 2 | 모델 칩이 `agents.some((a) => a.supported)` 로 게이팅돼 시드가 불완전하면 라벨이 사라진다 | ✅ 선조치 — `supported: true` 를 시드에 넣고, **세 번째 케이스로 도달을 양성 관측**(`supported:false` 면 `anthropic/` 가 사라진다) | 실측: `supported` 없이는 HTML 3795자·라벨 부재, 있으면 4249자·라벨 존재 |
| 3 | 마운트 oracle 이 `agentStore`·`chatStore` **두 스토어**의 초기 상태를 제자리 변형한다 | ✅ 선조치 — `afterEach` 로 4필드 원복. 축별 실패 모드는 아래 | 단독 실행 3/3 · 전체 3243/3243 둘 다 green(순서 무관) |
| 4 | 변이 스크립트가 외부 `timeout` 으로 죽으면 `finally` 가 실행되지 않아 트리에 변이가 남는다 | 보고 — 이번 라운드에 **2회** 발생. 매번 `git status` 로 확인하고 `git checkout` + `.bak` 삭제로 복원 | r2 검증에서도 같은 축을 겪었다(verify r2 §9) |

### 설계 대비 명시적 차이 (r3)

**차이 없음 — 설계가 지정한 메커니즘을 그대로 썼다.** AC26 의 마운트는 D-021 이 적은 그대로
`renderToStaticMarkup(createElement(Composer, …))` 이고, 시드는 AT-24 와 같은 `getInitialState()`
제자리 변형이다. 신규 의존성 0.

다만 **AT-24 에서 이미 보고한 시드 수단의 축별 실패 모드가 이 파일에도 그대로 적용**되므로 다시 적는다.

| 축 | 대체물의 실패 모드 | 다시 확인한 AC / §10 행 |
|---|---|---|
| 만료 | **해당 없음** — 초기 상태 객체는 모듈 수명 동안 교체되지 않는다 | AC26 — 3케이스 green |
| **공유** | **있다** — 초기 상태 객체를 파일 내 모든 케이스가 공유한다. 이 파일은 **두 스토어**(`agentStore.agents` + 세션 3필드)를 건드리므로 `afterEach` 가 4필드를 원복한다 | AC26 — 단독 3/3 · 전체 3243/3243, 순서 무관 |
| 재진입 | **해당 없음** — 시드→렌더가 동기이고 effect 가 SSR 에서 실행되지 않는다 | AC26 |
| 다른 무효화 | **있다(잠재)** — 제자리 변형은 구독자를 깨우지 않는다. SSR 은 구독하지 않아 무영향이나 CSR 마운트로 바뀌면 시드가 죽는다 | D-020(OPEN) 이 열리는 자리 — §17 리스크에 기록됨 |

## [구현자 기입] 구현 보고 (r3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | **production 0** · 테스트 2(`composerWiring.test.ts` 확장 · `composerMount.render.test.ts` 신규) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run <지정 스위트>` · `node scripts/ensure-sqlite-abi.mjs node` 후 `./node_modules/.bin/vitest run` |
| **관측한 게이트 산출** | lint **0 error / 1 warning**(기존 `useTranscriptVirtualizer`, 변경 무관) · typecheck **3구성 0 error** · 지정 스위트 **1623케이스 green** · 전체 **330파일 3243케이스 green, 0 failed / 7 skipped**(r2 329/3239 → 신규 1파일 4케이스) |
| ABI 주의 | 전체 실행 전 `ensure-sqlite-abi.mjs node` 선행 — r1·r2 와 같은 축 |
| V-pair 자기확인 | `SELF_PASS 22 / SELF_BLOCKED 0` — VP-21 이 ΔV2 분모로 재확인됨, VP-22 는 ΔV1 증거 승계 |
| 강제 지점 전수 | ΔV2 구간 **12/13 + 1 NOT_REQUIRED** · 누적 요구 **39/39** |
| **합계 검산** | ✅ **24** · ⚠️ **2**(사람 실기) · ❌ 0 = **총 26**. 분모가 r2 의 24 에서 26 으로 늘었다(AC25·AC26 신설) — r2 합계와 직접 비교하지 않는다 |
| 블로커 / 역질문 | 없음. D-020(jsdom)은 OPEN 유지 — ΔV2 로 필요 범위가 소스 단언 5지점으로 좁아졌다 |
| 대상 커밋 | `(r3 구현 — 좌표는 INDEX)` |

### AC 행별 관측 (r3 신설·정정분)

`AC23`✅ **정정분 닫힘** — 축③ 이 호출 3건 각각 `args.length === 4` 와 슬롯별 정규식
(`providerKey$` / `modelFamily$|^modelKey\(` / `[Aa]lias$` / `adapter$`)을 단언한다. V-5(중복)·S-1(맞바꿈) 각각 red.
`AC25`✅ `composerWiring` 축④ — `<ModelMenu selection={selectedModel}>`. 변이 V-1 red.
`AC26`✅ `composerMount.render.test.ts` 3케이스 — 칩 라벨 `anthropic/claude-sonnet-4-6`,
`[1m]` 변형 구분(`…-4-6[1m]`), 도달 양성 관측. 변이 V-2c red 3건(typecheck 0).
`AC21`✅ 게이트 산출 위 표. 나머지 AC1~AC22·AC24 는 프로덕션 코드를 바꾸지 않았고 r1·r2 관측이 유지된다(844→848, 감소 0).

## [구현자 기입] Review Signals — 사실만 (r3)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **같은 축의 3라운드째다.** r1 "규칙은 잠겼는데
  배선이 안 잠겼다" → r2 "배선 6곳은 잠겼는데 그 6이 전수가 아니다" → r3 은 그 분모를 주어로
  재산출해 닫았다. **세 라운드 모두 분모가 이미 고친 자리로만 이뤄져 있었다.**
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **있었다.** `handoff-impl §2` 의 "그 검색의 술어는
  불변식의 주어로 쓴다 — 네가 쓴 해법의 이름이 아니다" 가 정확히 이 문장이다. r2 설계 턴에서
  §8 검색어를 쓸 때 이 규칙을 적용하지 않았다.
- 이번 라운드가 그 규칙을 **전수 적용했는가**: 예 — 잠재 문제 #1. plan §8 의 검색 술어 33개를
  분류해 해법 이름으로 센 위험 2건을 주어로 재측정했고 추가 지점 0을 확인했다.
- 반복해서 부딪히는 환경 한계: ① `Popover`·`useEffect` 내부는 SSR 에서 실행되지 않아 소스 단언이
  남는다(D-020 OPEN) ② zustand v5 SSR 스냅샷이 `setState` 시드를 무시 ③ better-sqlite3 ABI
  ④ 변이 스크립트가 외부 timeout 으로 죽으면 트리에 변이가 남는다(이번 2회).
- 현재 라운드 수: 3

---

> **[검증자 기입]** 이하는 검증 턴(r1)이 채운다. 판정 원문은 [`verify.md`](verify.md).

## [검증자 기입] 파생 이슈 (r1)

| # | finding | 귀속 | disposition | 후속 주체 |
|---|---|---|---|---|
| **D1** | 컨테이너→presentational 배선 4곳이 삭제돼도 스위트가 838/838 green이다 — Composer의 `<ModeMenu options=…>`(M-B) · `setModel(…, selection.modelAlias, …)`(M-F) · `selectedModel` memo의 `modelAlias`(M-H) · `SubAgentTileContent`의 `stopErrors` prop(M-G) | AR-04·AR-05에 같은 레벨 `AR↔IT` REQUIRED pair 부재 · VP-12·VP-19의 적대 증거 `not selected` | **PLAN_GAP** | **설계자** |
| D2 | §10 EP-19가 "유일 렌더 지점을 잃는 문구"를 1개로 셌으나 실측 2개다(중단 실패 + 정착 사유) | §10 EP-19 분모 | NON_BLOCKING | 설계자(분모 2로 정정) |
| D3 | `classifyModel`·`matchesExplicit`·`AUTO_UNSUPPORTED_FALLBACK_MODE`가 정의 파일 밖 참조 0인데 `export`다 | 비귀속 | NON_BLOCKING | 기록 |
| D4 | §8 검산 줄의 항 나열이 EP-01~19 순서와 어긋난다(합계 26은 정확) | plan §8 | NON_BLOCKING | 설계자 |
| D5 | 구현 보고의 vitest `7 skipped`가 재측정(0 skipped)과 어긋난다 — 파일 327·케이스 3233은 일치 | 구현 보고 | NON_BLOCKING | 기록 |
| D6 | `turn.aborted`로 `result`가 오지 않으면 `ctx.lastAssistantText`가 다음 턴으로 넘어간다 | 비귀속(§13이 창을 인지·수용) | NEXT_HANDOFF | 제품 판단 |
| D7 | 0213 D-007의 "안내 분모 = 할 일 항목" 구분이 `items.length === 0`으로 소멸했다 | 0213 D-007 | NON_BLOCKING | 설계자(supersede 행) |
| D8 | `백그라운드 작업` 타일 상세에 `최근 작업`(`currentChildLabel`) 행이 없다 | 비귀속 | NON_BLOCKING | 기록 |

### D1 — 설계자가 고칠 규범 행

**코드는 고칠 것이 없다.** 네 배선 모두 프로덕션에 올바르게 존재하고 AC·§10을 충족한다. 빠진 것은 그 옳음을 잠그는 oracle이다.

- 침묵의 메커니즘: `ModeMenu.options?`가 `options ?? MODE_MENU_OPTIONS`로, `SubAgentTaskList.stopErrors?`가 `= {}`로 폴백한다 — **optional prop + 관대한 기본값**이라 배선 누락이 컴파일 오류가 아니라 조용한 동작 복귀가 된다.
- 현재 렌더 테스트가 못 잡는 이유: `modelMenu0215.render.test.ts:97`이 `options: modeMenuOptions(selectedModelShape(...))`로 **Composer가 하는 조립을 테스트가 다시 만든다**. presentational 컴포넌트는 잠기지만 컨테이너의 배선은 잠기지 않는다.
- 필요한 정정: AR-04·AR-05에 `AR↔IT` REQUIRED pair를 신설하고, 각 pair에 배선 oracle(컨테이너를 마운트해 메뉴 항목·문구를 관측)과 선택 변이(M-B·M-G)를 등록한다. VP-12·VP-19의 `not selected` 판단도 함께 갱신한다.

---

## [검증자 기입] 파생 이슈

> 판정 원문은 [`verify.md`](verify.md). `PLAN_GAP` 인 D1 은 **설계 턴(ΔV1)이 닫았다** — 아래 상태 열 참조.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | 컨테이너→presentational 배선 4곳이 삭제돼도 838/838 green (M-B·M-F·M-G·M-H) | AR-04·AR-05 의 `AR↔IT` pair 부재 · VP-12·VP-19 적대 증거 `not selected` | ΔV1 이 VP-21·VP-22 신설 + EP-20·EP-21 + AC23·AC24 + D-018·D-019 로 닫았다. **구현 턴은 그 oracle 을 만들고 변이 4종을 심는다** | PLAN_GAP | **설계 정정 완료 — 구현 대기** |
| D2 | §10 EP-19 가 "유일 렌더 지점을 잃는 문구"를 1개로 셌으나 실측 2개 | §10 EP-19 | 분모를 2로 정정 | NON_BLOCKING | **해결**(ΔV1 §10) |
| D3 | `classifyModel`·`matchesExplicit`·`AUTO_UNSUPPORTED_FALLBACK_MODE` 가 파일 밖 참조 0인데 export | 비귀속 | 구현 턴의 **선택적 정리**로 §6 범위에 넣었다 | NON_BLOCKING | open |
| D4 | plan §8 검산 줄의 항 나열이 EP 순서와 어긋난다(합계 26은 정확) | plan §8 | 순서대로 재작성 + ΔV1 반영(27 / 35) | NON_BLOCKING | **해결**(ΔV1 §8) |
| D5 | 구현 보고의 vitest "7 skipped"가 관측(0 skipped)과 어긋난다 | 구현 보고 | 기록만 — 케이스 수 3233 은 일치 | NON_BLOCKING | 기록 |
| D6 | `turn.aborted` 로 `result` 가 안 오면 `ctx.lastAssistantText` 가 다음 턴으로 넘어간다 | 비귀속 | 제품 판단 — abort 경로 리셋 여부. §6 비범위에 명시 | NEXT_HANDOFF | open |
| D7 | 0213 D-007 의 "안내 분모" 구분이 소멸 | 0213 D-007 | §16 에 supersede 행 추가 | NON_BLOCKING | **해결**(ΔV1 §16) |
| D8 | `백그라운드 작업` 타일 상세에 `최근 작업`(`currentChildLabel`) 행이 없다 | 비귀속 | 기록 — 그 타일은 child transcript 를 통째로 보여 정보량이 더 많다 | NON_BLOCKING | 기록 |

### ΔV1 READY self-review (정정 행만)

- [x] `PLAN_GAP` 을 재구현 **전에** 닫았다 — 구현자에게 그대로 넘기지 않았다.
- [x] 구 행을 덮어쓰지 않고 supersede 했다 — V1 의 VP-12·VP-19·EP-19 원문이 남아 있고 ΔV1 이 증분이다.
- [x] 새로 쓴 AC 2행이 §5 게이트를 통과한다 — 행동 단언(무엇이 View 에 닿는가) · 검증 수단(소스 단언 / 컨테이너 마운트) · 프로덕션 도달 경로 3열을 모두 갖는다.
- [x] **구조적 proxy 인 AT-23 에 적대 증거를 붙였다** — 변이 3종이 등록돼 있고 방향(지우면 red)이 명시적이다.
- [x] 음성/배선 주장에 양성 짝이 있다 — AT-24 는 "문구가 있다"는 양성 단언이고 변이가 그 방향을 증명한다.
- [x] 새 `NEW`·`CHANGED` node 4개(AR-04·AR-05·AT-23·AT-24)가 같은 레벨 `REQUIRED` pair 를 갖는다.
- [x] 수치를 이번 턴에 다시 셌다 — EP-20 6 · EP-21 2 · 깨질 테스트 호출부 8 · 합계 35(V1 구간 27).
- [x] 신규 의존성을 단독으로 채택하지 않았다 — D-020 을 OPEN 으로 남기고 의존성 0 인 수단을 골랐다.
- [x] 저장소 규칙을 설계 입력으로 확인했다 — `vitest.config.ts environment: 'node'` · `app/AGENTS.md §의존성 정책`.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 관측으로 적었다 — 충돌 0, D-018·D-019·D-020 3행 추가.

## [검증자 기입] 파생 이슈 (r2)

> 판정 원문은 [`verify.md`](verify.md) `# Verify r2`. root `PLAN_GAP` 은 **D1(r2)** 다.

| # | finding | 귀속 | 대응 방향 | disposition | 상태 |
|---|---|---|---|---|---|
| **D1(r2)** | §10 EP-20 분모가 **해법의 이름**으로 세어져 전수가 아니다 — 0215 범위 내 8지점 중 3 미계수, `:496`(V-1)·`:392`(V-2c) 가 green | VP-21 · §10 EP-20 | ΔV2 가 EP-20 을 주어 기준 `a4+b3+c1+d1`=**9** 로 세분하고 AC25·AC26 을 신설했다. V-1·V-2c 를 등록 변이로 | **PLAN_GAP** | **설계 정정 완료 — 구현 대기** |
| D2(r2) | AC23 축③ 이 `setModel` arg3 만 단언해 arg2 오염(V-5)에 침묵 | AC23 | AC23 을 ΔV2 로 supersede — 4슬롯 순서 계약(D-022) + V-5 등록 | PLAN_GAP(D1 종속) | **설계 정정 완료 — 구현 대기** |
| D3(r2) | ΔV1 노드표의 `AT-23`·`AT-24` 가 pair 표에서 `IT(…)` 로 다르게 불린다 | plan §7-A ΔV1 | 명명 통일 | NON_BLOCKING | **해결**(ΔV2 §7-A 가 좌/우 node 귀속을 명시) |
| D4(r2) | INDEX 0215 비고 735자(≈7줄) — 5줄 상한 초과 | `AGENTS.md §문장 규칙 3` | 비고 축약 | NON_BLOCKING | **해결**(이번 턴) |
| D5(r2) | `Composer.tsx:255` steer 게이트 입력이 배선 잠금 없이 green(V-3) | 0119 축 | 별도 handoff | NEXT_HANDOFF | 기록 |

**닫힌 것**: 등록 변이 4종(M-B·M-F·M-G·M-H) 전부 red · VP-22 PASS · 덮개 회귀 0 · 게이트 3종 green · 프로덕션 동작 변경 0. r1 D1 의 네 자리는 **실제로 잠겼다**.

**남은 것**: 그 네 자리가 EP-20 분모의 전부가 아니었다. 코드는 옳고 없는 것은 oracle 이다 — r1 D1 과 같은 형태가 한 단계 안쪽에서 반복됐다.

### ΔV2 READY self-review (정정 행만)

- [x] `PLAN_GAP` 을 구현자에게 넘기지 않고 여기서 닫았다 — D1(r2)·D2(r2) 가 규범 행(§10 EP-20a~d·EP-22 · AC23 정정 · AC25·AC26 · D-021·D-022)으로 내려왔다.
- [x] 구 행을 덮어쓰지 않고 supersede 했다 — ΔV1 의 AC23·EP-20·D-018 원문이 취소선으로 남아 있고 §16 에 대체 사유가 있다.
- [x] **수치를 이번 세션에 다시 셌다** — EP-20 주어 기준 `a4+b3+c1+d1`=9(§8 재산출 행), 총계 `27+9+2+2`=40 사이트 / 24 EP 행.
- [x] **분모의 술어가 불변식의 주어다** — `rg 'selectedModel' Composer.tsx` · `rg 'setModel\('` 로 세고, 해법 이름(`options=`·`stopErrors=`)을 술어에서 뺐다.
- [x] **분모에서 뺀 지점을 숨기지 않았다** — `:255` 는 분모에 넣고 `NOT_REQUIRED` + 0119 귀속 사유를 적었다.
- [x] 고쳐 쓴 AC 행이 §5 게이트를 다시 통과한다 — AC23(정정)·AC25·AC26 셋 다 행동 기준·검증 수단·프로덕션 도달 경로 3칸을 갖는다.
- [x] **형제 자리를 말하는 불변식에 맞바꿈/중복 변이가 있다** — D-022 의 4슬롯 계약에 S-1(맞바꿈)·V-5(중복) 둘 다 등록했다.
- [x] 구조적 proxy 에 적대 증거가 붙어 있다 — VP-21 변이 6종, 방향(지우면/바꾸면 red) 명시.
- [x] **소거 변이의 잔여물 수렴을 게이트에 적었다**(§19 ΔV2) — V-2c 는 `TS6133` 0 상태로 판정한다.
- [x] `NEW`·`CHANGED` 좌 node 가 같은 레벨 REQUIRED pair 를 갖는다 — AR-04→VP-21 · AR-05→VP-22.
- [x] 신규 의존성을 채택하지 않았다 — AC26 의 마운트는 기존 `react-dom/server` 로 성립한다(F-21·F-22 실측). D-020 은 OPEN 유지.
- [x] `ACTIVE 결정 ↔ AC` 대조: 충돌 0. D-021 ↔ AC23·AC25(소스)·AC26(마운트) 일치 — 수단이 갈리는 이유가 D-021 의 조건절과 같다. D-022 ↔ AC23 축③ 일치.

