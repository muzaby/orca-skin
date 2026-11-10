# Plan — 0305-code-bloat-audit

## 메타

| 항목 | 값 |
|---|---|
| slug | `0305-code-bloat-audit` |
| 작성자 | Claude Code |
| 일자 | 2026-11-10 |
| 매핑 | 사용자 `/handoff-plan` — 코드 비대화 방지(CI 감소는 결과 — D-011). 0305는 감사(지도)만, 축소 구현은 후속 handoff |
| 상태 | impl/IMPL_DONE (r1.2) — ΔV1 심화 검토·분해안 완료, 검증 대기 |
| V mode | `Delta V` (ΔV1 — 사용자 요구 변경) |
| 기준 V | `V1` (이 plan · 설계 커밋 좌표는 INDEX) |
| 이번 V revision | `ΔV1` |
| 유효 V | `V1 + ΔV1` |
| 기준 커밋 | `a0a95f7` (`git cat-file -t` = commit · `origin/main` 조상) |

## 0. 작성 경로

- 판정: 조사는 설계자가 직접 했다(D-006). 서브에이전트·백그라운드 에이전트는 쓰지 않았다.
- 사용자 질의 1라운드(4문항)로 범위·CI 의미·회귀 기준·제거 권한을 닫았다(§2·§3).
- 이 plan은 감사 수행 지시서다. `app/**`·`.github/**` 변경은 이번 handoff 전체에 없다(AC11).

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 같은 사용자 조작을 처리하는 코드가 필요 이상으로 불어났다. `app/src` 는 prod 118,000줄 · test 168,262줄이다(§8 예비 실측). CI 부담은 그 결과이고 따로 겨냥하지 않는다(D-011).
- 어디가 실제로 비대한지에 대한 근거 지도가 없다. 기존 진단 2건(§8)은 성능·구조 경계가 축이었고 시나리오별 과잉은 보지 않았다.
- 완료 후 달라지는 것: 사용자가 **시나리오 카탈로그 · 분량 지도 · 축소 후보 목록 · 제거 승인 목록 · 후속 handoff 분할안**이 든 감사 문서 한 편을 받는다.
- 성공 한 문장: **사용자가 감사 문서만 읽고 "무엇을 어떤 순서로 줄이고, 무엇을 지워도 되는지"를 결정할 수 있다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "목적: 코드 비대화 방지. 과대한 ci 증가." | 턴 1 |
| 명시 요구 | "사용자 시나리오에 기반한 코드 최적화를 진행하려한다. 과도한, 비대한, 불필요한 절차/프로세싱/제어 프로토콜 구현을 제거하여, 똑같은 시나리오/조작에 대해 간소하고 짧은 코드로 재구성 해야 한다." | 턴 1 |
| 명시 요구 | "조건: **회귀 금지**. 이전 핸드오프의 요구 조건을 **개념적으로** 만족할 것." | 턴 1 |
| 명시 요구 | "백그라운드 에이전트 사용하지 말 것. 토큰이 금장 소모되어 에이전트 작업이 중단, 컨텍스트를 소실한다. 지속적인 작업이 안 된다." | 턴 1 |
| 명시 결정 | 첫 handoff 대상: "전체 감사 → 분할 (Recommended)" | 질의 1 |
| 명시 결정 | "과대한 CI 증가"의 뜻: "둘 다" (실행 시간 + 코드·가드 분량) | 질의 1 |
| 명시 결정 | 회귀 판정: "시나리오 단위 판정 (Recommended)" | 질의 1 |
| 명시 결정 | 시나리오 미도달 기능·방어 경로: "목록 승인 후 제거 (Recommended)" | 질의 1 |
| 명시 결정 | "조사과정에서, 핸드오프 간 상호배제되는 개념에 대해서는 후속 핸드오프를 정본으로 한다." | 턴 2 |
| 명시 요구 | "시나리오이 대해 닿지 않는 것만 찾는게 아니다. 닿는데 너무 과도하며/비대한 프로세싱이 있다면 과감하게 불필요한 요소들을 다이어트 하는 것이 목표다. (불필요한 혹은 너무 비대하거나 과한 요소/파라미터/프로토콜 등등)" | 턴 3 |
| 명시 요구 | "코드가 줄어든다면 ci는 자연적으로 줄어든다. Ci를 검사하여 의도적으로 줄이려는 형태로 접근하지 마라" | 턴 4 |
| 명시 요구 | r1 감사 뒤 "이어서"의 뜻을 묻자: "감사 심화 + 밀도있는 구현이 과도한 구현이라면 이를 어떻게 분해할지도". 질의 선택지 원문: "audit.md가 한계로 적은 미검토 영역 — renderer chatStore/chatReducer, chat/harnesses(prod 최대 버킷), adapters/claude·opencode 내부 — 의 닿는 경로 과잉(X1~X7)을 읽어 후보를 추가" | 턴 5 · 질의 2 |
| 추론 의도 | 감사 작업도 중단 뒤 이어갈 수 있어야 한다 — D-006 이유절("컨텍스트를 소실한다. 지속적인 작업이 안 된다")에서 유도 | 턴 1 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 목표는 코드 비대화 방지와 CI 증가 억제다. CI 증가는 실행 시간과 코드·가드 분량을 둘 다 뜻한다 | "과대한 ci 증가" · "둘 다" | 턴 1 · 질의 1 | SUPERSEDED | D-011 |
| D-002 | 축소의 기준은 사용자 시나리오다. 같은 시나리오/조작을 더 간소하고 짧은 코드로 재구성한다 | "과도한, 비대한, 불필요한 절차/프로세싱/제어 프로토콜 구현을 제거하여, 똑같은 시나리오/조작에 대해" | 턴 1 | ACTIVE | — |
| D-003 | 회귀 금지. 판정 단위는 시나리오별 관측 동작이다. 내부 구조에 묶인 테스트와 변이 잠금용 테스트는 통합·삭제할 수 있다 | "**회귀 금지**. 이전 핸드오프의 요구 조건을 **개념적으로** 만족할 것" · "시나리오 단위 판정" | 턴 1 · 질의 1 | ACTIVE | — |
| D-004 | 0305는 전체 감사만 한다. 코드는 바꾸지 않고, 감사 순위대로 후속 handoff로 나눈다 | "전체 감사 → 분할" | 질의 1 | ACTIVE | — |
| D-005 | 시나리오에 닿지 않는 기능·방어 경로는 근거와 함께 열거하고 사용자가 승인한 항목만 제거한다 | "목록 승인 후 제거" | 질의 1 | ACTIVE | — |
| D-006 | 백그라운드·서브 에이전트를 쓰지 않는다 | "토큰이 금장 소모되어 에이전트 작업이 중단, 컨텍스트를 소실한다. 지속적인 작업이 안 된다." | 턴 1 | ACTIVE | — |
| D-007 | 감사는 단계마다 산출 파일과 커밋을 남겨 다음 세션이 이어받을 수 있게 한다 | 설계자 추론 — D-006 이유절 | §2 추론 행 | ACTIVE | — |
| D-008 | 구현(감사 수행) 주체는 Claude다 | 비기능 작업은 Claude가 직접 구현 | root `AGENTS.md` 협업 워크플로우 | ACTIVE | — |
| D-009 | 이전 handoff끼리 상호배제되는 개념은 번호가 큰(후속) handoff를 정본으로 한다. 보존할 개념 요구는 후속 쪽에서 뽑는다 | "핸드오프 간 상호배제되는 개념에 대해서는 후속 핸드오프를 정본으로 한다" | 턴 2 | ACTIVE | — |
| D-010 | 감사의 주 대상은 시나리오에 **닿는** 경로의 과잉이다 — 불필요하거나 비대한 요소·파라미터·프로토콜을 과감하게 후보로 올린다. 미도달 탐색은 그 일부일 뿐이다 | "닿지 않는 것만 찾는게 아니다. 닿는데 너무 과도하며/비대한 프로세싱이 있다면 과감하게 불필요한 요소들을 다이어트" | 턴 3 | ACTIVE | — |
| D-011 | 목표는 코드 감량이다. CI 감소는 그 결과로만 얻는다 — CI 단계·실행 시간·가드·테스트 인프라를 검사해 줄이는 접근을 하지 않는다 | "코드가 줄어든다면 ci는 자연적으로 줄어든다. Ci를 검사하여 의도적으로 줄이려는 형태로 접근하지 마라" | 턴 4 | ACTIVE | D-001 대체 |
| D-012 | 감사를 심화한다 — r1이 진입 심볼만 본 분량 상위 영역의 내부를 읽고 과잉(X1~X7)을 판정한다 | "감사 심화" · 질의 2 선택지("chatStore/chatReducer, chat/harnesses, adapters/claude·opencode 내부") | 턴 5 | ACTIVE | — |
| D-013 | 밀도 높은 구현이 과도하다고 판정되면 그것을 어떻게 분해할지도 감사가 제시한다 | "밀도있는 구현이 과도한 구현이라면 이를 어떻게 분해할지도" | 턴 5 | ACTIVE | — |

### 갱신 메모

- 턴 5(ΔV1): D-012·D-013 추가. 변경·대체된 결정 없음 — D-002~D-011 유지. r1 산출(V1)은 그대로 두고 증분만 더한다: AC15·AC16 · EP-10·EP-11 · K18·K19 · 단계 P7·P8 · 선언 경계 7 정정·9·10 추가.
- D-012 ↔ AC15: 일치 — 분량 상위 버킷마다 심화 검토 1건. D-013 ↔ AC16: 일치 — "과도" 판정(`density=excess`)은 후보로 이어지고 `restructure` 후보는 전부 분해 단계를 갖는다. D-004("코드는 바꾸지 않고") ↔ AC16: 충돌 없음 — 분해안은 제안이고 구현은 후속 handoff다. D-006 유지 — 심화도 서브·백그라운드 에이전트 없이 한다.
- `ACTIVE 결정 ↔ AC` 대조(ΔV1): 충돌 0.

- 턴 4: D-001 → D-011(사용자 변경). 구현 전이라 V1을 그대로 갱신했다 — AC3·AC4 · EP-04 · K15·K16 · 단계 P3 · 렌즈 L2(테스트 과밀)·L3(메타 코드)·L6(CI 시간) · 추적 T6 · 후보 유형 `test-merge`·`guard-simplify`·`ci-step`을 삭제했다. 삭제한 ID는 재사용하지 않는다.
- D-011 ↔ AC: 충돌 0 — CI·테스트 시간을 재는 AC가 남아 있지 않다. D-003(테스트 통합·삭제 가능)은 유지되며, 테스트는 감량되는 제품 코드에 딸린 몫으로만 `saving.test`에 추정한다.

- 턴 3에서 추가된 결정: D-010. 구현 전이라 V1을 그대로 갱신했다 — L4를 주 렌즈로 넓히고 과잉 범주 X1~X7 · AC14 · EP-09 · K17을 더했다.
- D-010 ↔ AC10·AC14: 일치 — 추적 단계와 모든 시나리오가 과잉 범주 판정을 갖는다. D-010 ↔ D-005: 충돌 없음 — 닿는 경로의 감량은 `restructure`이고, 사용자 관측 능력을 없애는 항목만 `remove`로 승인 목록에 간다.

- 이번 턴(턴 2)에서 새로 추가된 결정: D-009. 구현 전이라 V1을 그대로 갱신했다(AC7·EP-05·K7).
- 변경된 결정: 없음. D-003("이전 핸드오프의 요구 조건을 개념적으로 만족")은 유지되고 D-009가 충돌 시의 우선순위를 더한다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001~D-008.
- D-009 ↔ AC7: 일치 — `superseded` 칸이 밀려난 handoff와 그것을 대체한 후속 handoff를 적는다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0. D-003("테스트 통합·삭제 가능") ↔ AC6(`saving.test` 칸) 일치 · D-004("코드는 바꾸지 않고") ↔ AC11(`app`·`.github` diff 0) 일치 · D-005 ↔ AC8(승인 목록 차집합 0) 일치 · D-006·D-007 ↔ §19 운영 gate 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 코드량이 원인이고 CI는 결과다(D-011) | test/prod 비 1.43(`app/src`). 테스트는 제품 코드의 요소·분기·프로토콜 수를 따라 는다 |
| 이미 충족됐는가 | 아니오 | 기존 진단 2건은 "성능·자원"·"책임 경계"가 판단 기준이고 시나리오 단위의 과잉 판정이 없다(`docs/etc/study/main-structure/diagnosis.md` §1·§3) |
| 더 작은 해법이 있는가 | 감사 선행이 가장 작다 | 한 handoff가 2,116파일을 다 바꿀 수 없다. 근거 없이 영역을 고르면 절감이 작은 곳부터 손댄다 |
| 선행 자료를 코드와 대조했는가 | 했다 | 채널 117·feature 14는 `ipc.ts`·`features/` 재집계와 `docs/generated/inventory.md` 일치(§8) |
| 기존 결정과 충돌하는가 | 후속 handoff에서 충돌 가능 — 감사가 표시한다 | 기존 진단의 "유지할 경계" 5건(§8)과 ADR 채택 결정을 허무는 후보는 `decisionChange=true`로 승인 목록에 올린다(AC8) |

- 사용자에게 올릴 결정: 없음(이번 턴). 감사 완료 뒤 승인 목록과 분할 순위를 올린다(AC12).
- 코드 조사로 닫은 사실: §8 표.

## 5. 동작 / 사용자 흐름

```text
[감사 수행(impl)]
  → P1 분량 지도 → P2 시나리오 카탈로그
  → P4 렌즈별 후보 → P5 경로 추적 5건 + 전 시나리오 검토 → P6 분할안·승인 목록
  → [audit.md 완성 + 검사 green]
  → [사용자: 승인 목록 판정 · 분할 순위 확정]  → 후속 handoff 0306~ 생성
  ↘ [세션 중단] → 다음 세션이 audit.md 머리 진행표에서 마지막 완료 단계 다음부터 재개
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 단계 Pn 완료 | 산출 JSON·audit.md 블록 갱신 → 검사 실행 → 단계 커밋 | 진행표의 Pn 행이 `완료 + 커밋 제목` |
| 세션 중단(토큰 소진) | 없음 | 진행표에 미완료 단계가 남는다. 완료 단계 산출은 커밋돼 있다 |
| `app` 설치 실패(ABI·egress) | L1의 export 조사를 `rg` 기반으로 수행하고 실패 서명을 렌즈 `method`에 기록 | L1 방법 칸에 대체 방법과 서명이 보인다 |
| 후보 0인 렌즈 | 방법·분모와 함께 0을 기록 | "후보 0 — 분모 N"으로 보인다 |
| P6 완료 | INDEX를 `impl/IMPL_DONE`으로 갱신 | 사용자가 승인 목록·분할안을 읽을 수 있다 |

### 파생 UX / 엣지케이스

- empty / error: 위 표의 설치 실패·`후보 0` 행.
- restart: D-007 — 단계별 커밋과 진행표.
- concurrency: `main`이 감사 도중 바뀔 수 있다. 모든 수치는 기준 커밋(`audit.md` 머리)에서 재현하고, 도중에 기준을 옮기면 P1부터 다시 생성한다.

## 6. 범위 / 비범위

- **범위**: `docs/handoff/0305-code-bloat-audit/` 아래의 `audit.md` · `data/*.json` · `scan/*.mjs`(+자체 테스트) · `docs/handoff/INDEX.md` 행.
- **비범위**: `app/**`·`.github/**` 변경 · 후보의 실제 축소 구현 · handoff 지침(SKILL·AGENTS) 변경 · 새 의존성.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 후보별 축소 구현 | 아니오 | 후속 handoff(분할안) |
| 제거 후보 승인 | 아니오 | 감사 완료 뒤 사용자 결정(AC12) |

## 7. Requirements / Acceptance — `R ↔ AT`

용어: **시나리오** = 사용자 조작 1개와 그 관측 결과. **버킷** = §9의 영역 단위. **후보** = 축소 가능 지점 1건(`C-NN`). **검사** = `node docs/handoff/0305-code-bloat-audit/scan/audit-check.mjs`.

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | 모든 IPC 채널과 모든 renderer feature가 시나리오 1개 이상에 귀속되거나 `unreached`에 명시된다 | 검사 K1~K3: `ipc.ts` 채널 집합 − (시나리오 채널 ∪ unreached) = ∅, feature도 같음 | `ipc.ts`·`features/` → `scenarios.json` → 검사 |
| R-02 | AC2 | 대상 파일 전부가 버킷 1개·종류 1개에 속하고 줄 수 합이 총계와 같다 | `volume.mjs --check`: 미분류 0 · Σ버킷 = `git ls-files` 총 줄 수 · 저장본 = 재생성본 | `git ls-files` → `volume.json` → audit 표 |
| R-03 | AC5 | 렌즈 L1·L4·L5마다 방법(명령)·분모 N·후보 수가 있다 | 검사 K14: `lenses` 3건 각각 `method`·`denominator`·후보 수(= 그 렌즈 후보 행 수) | 렌즈 수행 → `candidates.json` |
| R-03 | AC6 | 후보 행은 필수 9칸을 모두 가진다 — 버킷·렌즈·유형·시나리오·출처·보존 요구·근거·예상 절감·위험 | 검사 K4~K6: 칸 누락·빈 값·미지 enum·없는 버킷·절감 > 버킷 현재 줄 수면 red | `candidates.json` → 검사 |
| R-03 | AC7 | 후보마다 그 코드에 요구를 실은 이전 handoff ID와 보존할 개념 요구 한 문장이 있다 | 검사 K7: ID 실재 · `unknown`이면 검색 명령 동반. 출처끼리 상호배제면 `superseded{id, by}`에 적고 `preserve`는 후속(`by`) 기준(D-009) | 코드 주석·plan → `origin` 칸 |
| R-03 | AC10 | 경로 추적 5건이 entry부터 end까지 단계별로 `파일:심볼`·사용자 관측 효과·판정을 가진다 | 검사 K11: 단계의 파일 실재 + 그 파일에서 심볼 문자열 검출. `effect=none` 단계는 후보 ID를 갖거나 유지 근거를 가짐 | `traces.json` → 검사 |
| R-03 | AC14 | 카탈로그의 모든 시나리오가 경로 검토 1건을 갖는다 — 읽은 파일 목록과 과잉 범주 X1~X7 각각의 판정(후보 ID 또는 `none`) | 검사 K17: 시나리오 집합 − 검토 집합 = ∅ · 범주 7개 전부 판정 · `none`이 아닌 칸의 후보 ID 실재 | `scenarios.json` → `reviews.json` → 검사 |
| R-03 | AC15 (ΔV1) | prod 3,000줄 이상인 버킷 전부와 `renderer/features/chat/reducer`가 심화 검토 1건을 갖는다 — 읽은 파일(그 버킷 소속) · 범주 X1~X7 판정 · 밀도 판정(`excess`/`necessary`)과 근거 | 검사 K18: {prod ≥ 3,000 버킷} − 검토 집합 = ∅ · 칸 누락·미실재 파일·타 버킷 파일·`excess`인데 후보 0이면 red | `volume.json` → `deep.json` → 검사 |
| R-03 | AC16 (ΔV1) | `restructure` 후보 전부가 분해안을 갖는다 — 단계마다 떼어내는 것 · 남는 관측 동작 · 대상 파일 · 회귀 판정 시나리오 | 검사 K19: `restructure` 후보 − 분해안 보유 = ∅ · 단계 칸 누락·미실재 파일·없는 S-ID면 red | `candidates.json` `decomposition` → audit 분해 표 |
| R-04 | AC8 | 유형이 `remove`이거나 채택 결정을 바꾸는 후보는 전부 승인 목록에 나타난다 | 검사 K8: {remove ∪ decisionChange} − 승인 목록 = ∅ = 역방향 | `candidates.json` → audit 승인 표 |
| R-04 | AC9 | 모든 후보가 후속 handoff 1개 또는 `deferred`(사유)에 정확히 한 번 속하고, 후속마다 회귀 판정 시나리오가 1개 이상 있다 | 검사 K9·K10: 0회·2회 이상·없는 후보 참조·시나리오 0이면 red | `split.json` → audit 분할 표 |
| R-04 | AC12 | 사용자가 승인 목록과 분할 순위를 판정한다 | 사람 — 감사 문서 열람 후 결정 | audit.md → 사용자 |
| R-05 | AC11 | 감사는 제품·CI 코드를 바꾸지 않는다 | `git diff --stat a0a95f7..HEAD -- app .github` 출력 0줄 | git |
| R-06 | AC13 | audit.md의 표는 `data/*.json`과 같은 내용이다 | 검사 K12: 생성 블록 = 렌더 결과(바이트 동일) | JSON → 렌더 → audit.md |

### AC 검증 주의사항

- 기존 테스트 재사용: 없음. 검사·자체 테스트는 신규다.
- 사람 실기: AC12만. 승인·순위는 제품 결정이라 순수 로직으로 내릴 수 없다.
- 총량 기준: AC2의 총계는 `git ls-files app/src app/scripts .github/workflows` 전 파일 줄 수 합이다. 종류별 분해는 §10 EP-03.
- 예상 절감은 추정이다. AC6은 형식과 상한(버킷 현재 줄 수)만 잠근다 — 정확도는 선언 경계(§10).
- 구조 proxy 주의: 검사 green은 "표가 완전하고 일관된다"만 뜻한다. 후보의 타당성은 근거 칸(`파일:줄`·명령+N)과 verify의 표본 재현으로 본다(VP-03 적대 증거).

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` pair 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01 | R | §7 AC1 시나리오 카탈로그 | NEW | — |
| R-02 | R | §7 AC2 분량 지도 | NEW | — |
| R-03 | R | §7 AC5~AC7·AC10·AC14 후보·출처·경로 추적·시나리오 검토 | NEW | — |
| R-04 | R | §7 AC8·AC9·AC12 승인 목록·분할안 | NEW | — |
| R-05 | R | §7 AC11 무변경 | NEW | — |
| R-06 | R | §7 AC13 문서 = 데이터 | NEW | — |
| AT-01~AT-06 | AT | 위 R의 검사·명령·사람 판정 | NEW | — |
| AR-01 | AR | §9 `data/*.json` → 렌더 → `audit.md` 생성 블록 | NEW | — |
| IT-01 | IT | 검사 `--check`의 재생성 대조 | NEW | — |
| MD-01 | MD | §10 EP-03 `volume.mjs` 종류·버킷 규칙 | NEW | — |
| MD-02 | MD | §10 EP-06 `audit-check.mjs` 규칙 K1~K14·K17·K7b | NEW | — |
| UT-01·UT-02 | UT | `scan/*.test.mjs` | NEW | — |
| R-03 (ΔV1) | R | §7 AC15·AC16 추가 — 심화 검토·분해안 | CHANGED | V1 R-03 |
| AT-03 (ΔV1) | AT | 검사 K18·K19 | CHANGED | V1 AT-03 |
| MD-02 (ΔV1) | MD | §10 EP-06 규칙에 K18·K19 추가(16 → 18) | CHANGED | V1 MD-02 |
| UT-02 (ΔV1) | UT | `scan/audit-check.test.mjs` K18·K19 입력 | CHANGED | V1 UT-02 |

### Pair registry

| Pair | left ↔ right | requiredness | path `start → edges → end` | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `ipc.ts` 채널·`features/` → `scenarios.json` → 검사 K1~K3 | `gate:audit-check.mjs --check` | required — 0건 주장. 변이: 채널 1개·feature 1개를 매핑에서 제거 → red | EP-01(117) · EP-02(14) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `git ls-files` → `volume.mjs` → `volume.json` | `gate:volume.mjs --check` | required — 전수 주장. 변이: `volume.json` 버킷 1행 삭제 → red | EP-03(2,116) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 렌즈 수행 → `candidates.json`·`traces.json`·`reviews.json` → 검사 K4~K7·K11·K14·K17 | `gate:audit-check.mjs --check` | required — 구조 proxy. 검증자가 후보 5건·추적 단계 5개의 근거 명령을 재실행해 N 일치를 본다 | EP-05(9칸) · EP-08(5) · EP-09(시나리오 수 × 7) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `candidates.json` → `split.json`·승인 목록 → 검사 K8~K10 → 사용자 | `gate:audit-check.mjs --check` · 사람(AC12) | required — 변이: `remove` 후보의 `approval` 뒤집기 · 후보 1건을 분할안에서 제거 → red | EP-05 |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | 작업 트리 → `git diff` | `gate:git diff --stat a0a95f7..HEAD -- app .github` | not selected — 직접 관측 | 0 — 강제 자리 없음(부재 단언) |
| VP-06 | R-06 ↔ AT-06 · AR-01 ↔ IT-01 | REQUIRED | `data/*.json` → `render()` → `audit.md` 생성 블록 | `gate:audit-check.mjs --check`(K12) | required — 변이: 생성 블록 숫자 1개 수정 → red | EP-07(2 사본) |
| VP-07 | MD-01 ↔ UT-01 | REQUIRED | 경로 문자열 → `classify()` → `{bucket, kind}` | `scan/volume.test.mjs` — EP-03 규칙 행마다 1케이스 | not selected — 행동 oracle | EP-03 규칙 8행 |
| VP-08 | MD-02 ↔ UT-02 | REQUIRED | fixture 데이터 → `check()` → 위반 목록 | `scan/audit-check.test.mjs` — K1~K14·K17·K7b 규칙마다 red 입력 + 전부 유효한 green 입력 1 | not selected — 행동 oracle | EP-06(16규칙) |
| VP-09 (ΔV1) | R-03 ↔ AT-03 | REQUIRED | `volume.json`(prod ≥ 3,000) → `deep.json` → 검사 K18 · `candidates.json` `decomposition` → 검사 K19 | `gate:audit-check.mjs --check` | required — 전수 주장·구조 proxy. 변이: 심화 검토 1건 삭제 · 검토 `X3` 칸 삭제 · `restructure` 후보 1건의 `decomposition` 삭제 → red. 검증자가 심화 후보 3건의 근거를 재현 | EP-10 · EP-11 |
| VP-10 (ΔV1) | MD-02 ↔ UT-02 | REQUIRED | fixture → `check()` → 위반 목록 | `scan/audit-check.test.mjs` — K18·K19 조건마다 red 입력 | not selected — 행동 oracle | EP-06 K18·K19 |
| VP-03·VP-04·VP-06 (ΔV1) | V1 그대로 | REGRESSION | 후보가 늘어 `lenses.count`·승인 목록·분할안·생성 블록(7 → 9)이 바뀐다 | V1 좌표 그대로 | V1 등록 변이 M4·M5·M6 재실행 | EP-05 · EP-07 |

- ΔV1 비영향(`NOT_REQUIRED`): VP-01·VP-02·VP-05·VP-07 — 채널·feature·분량·`classify` 규칙을 바꾸지 않는다(V1 증거: r1 gate). VP-05는 AC11 명령으로 다시 본다(운영 gate).
- VP-08(V1)은 그대로 유효하고 K18·K19 몫은 VP-10이 든다.

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| 감사 검사 | 산출물 자체의 완결성 | `node …/scan/volume.mjs --check && node …/scan/audit-check.mjs --check` | 이번 산출물 |
| 검사기 자체 테스트 | 검사 규칙의 민감도 | `node --test docs/handoff/0305-code-bloat-audit/scan/*.test.mjs` | 이번 산출물 |
| 문서 가드 | `INDEX.md`는 링크 검사 대상(`check-doc-inventory.mjs` `isHistoricalHandoff`) | `cd app && node scripts/check-doc-inventory.mjs --check` | 이번 변경이 깬 링크만 |
| trailer 파싱 | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 이번 커밋 |
| 무변경 | D-004 | AC11 명령 | `app`·`.github` |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 기존 진단이 "유지할 경계" 5건을 정했다 — bootstrap 조립 루트 · 작은 순수 판정 함수 · auth/gate 분리 · SessionRuntime/RuntimePool · Chromium 원격 스택 | `docs/etc/study/main-structure/diagnosis.md` §5 |
| 코드가 handoff 번호를 주석으로 인용한다 — 출처 추적의 1차 원천 | `rg -o "0[0-9]{3}" app/src app/scripts` 고유값 163 |
| 저장소가 shallow clone이다 — `git blame`·`git log`로 출처를 거슬러 갈 수 없다 | `git rev-parse --is-shallow-repository` = true · 커밋 50 |
| `docs/handoff/<NNNN>-*/` 문서는 수치·링크 검사에서 제외된다. `INDEX.md`만 링크 검사를 받는다 | `app/scripts/check-doc-inventory.mjs:230-234,347-359` |
| `app/node_modules`가 없다 — vitest·TypeScript API는 설치 뒤에만 쓸 수 있다 | `ls app/node_modules` = 0 |
| handoff 폴더에 재현 스크립트를 두는 선례가 있다 | `docs/handoff/0292-deep-optimization/scan/` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| IPC 채널 | `rg -o "'orca:[A-Za-z:._-]+'" app/src/shared/ipc.ts \| sort -u \| wc -l` | 117 | EP-01 분모 |
| renderer feature | `ls app/src/renderer/src/features \| wc -l` | 14 | EP-02 분모 |
| 대상 파일 | `git ls-files app/src app/scripts .github/workflows \| wc -l` | 2,116 | EP-03 분모 |
| 확장자 | 위 목록의 확장자 집계 | 13종 | `ts 1722 · tsx 293 · mjs 42 · sql 36 · md 6 · html 4 · yml 3 · mts 3 · pem 2 · css 2 · snap 1 · json 1 · cjs 1` |

### 수치 / 전칭 표현 검산

- 재측정 수치(예비, `.test.` 접미만 test로 분류): `src/main` 57,332/103,320 · `src/renderer` 54,104/61,137 · `src/shared` 6,096/3,213 · `src/preload` 468/592 · `scripts` 7,058/6,908.
- 내역 합 = 총계: prod 57,332+54,104+6,096+468 = 118,000 · test 103,320+61,137+3,213+592 = 168,262. 정식 수치는 P1의 `volume.json`이 대체한다.
- 확장자 합: 1722+293+42+36+6+4+3+3+2+2+1+1+1 = 2,116 = 대상 파일 수.
- 채널 117·feature 14는 `docs/generated/inventory.md`와 일치한다.
- 문서 앵커: `docs/handoff/AGENTS.md` "§판정 범위와 운영 gate"·"§고장 내 보기" 표제 실재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조

- 관련 V node: R-01~R-04.
- 분량·시나리오 귀속을 재는 장치가 없다. `check-doc-inventory.mjs`는 채널·슬라이스 개수만 센다.
- 축소 판단의 근거는 개별 handoff의 plan(0290·0292·0298·0300)과 진단 2건에 흩어져 있고 축이 성능이다.

```text
[축소 요구] → [설계자가 영역을 직감으로 선택] → [handoff] → 절감 규모 사후 확인
```

### TO-BE — 감사 산출 구조

- 관련 V node: AR-01 · MD-01 · MD-02.
- 책임 소유자: `scan/volume.mjs`(분량 생성) · 사람 작성 `data/*.json`(시나리오·후보·추적·분할) · `scan/audit-check.mjs`(검증 + 렌더).
- 표는 JSON에서 렌더한다. `audit.md`에는 사람이 쓰는 해설과 생성 블록(`<!-- gen:NAME -->`…`<!-- /gen -->`)이 있다.

```text
git ls-files ──▶ volume.mjs ──▶ data/volume.json ─┐
ipc.ts · features/ ─▶ (사람) data/scenarios.json ─┤
(사람) 렌즈 방법·분모 ─────────────────────────────┼─▶ audit-check.mjs ─▶ 위반 목록(--check)
렌즈 L1·L4·L5 ─▶ (사람) data/candidates.json ────────┤                   └▶ audit.md 생성 블록(--write)
경로 추적·검토 ─▶ (사람) data/{traces,reviews}.json ┤
분할 ─▶ (사람) data/split.json ────────────────────┘
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V 연결 |
|---|---|---|---|---|
| 책임/소유권 | 분량 근거 소유자 없음 | `volume.mjs` + `data/` | 재현 가능한 지도 | MD-01 / VP-02·VP-07 |
| data flow | plan마다 일회성 `wc` | JSON 정본 → 렌더 | 사본 갈라짐 방지 | AR-01 / VP-06 |
| state/contract | 후보 형식 없음 | 후보 9칸 스키마 | 후속 handoff 입력 통일 | MD-02 / VP-03·VP-08 |
| error/lifecycle | 중단 시 조사 소실 | 단계 커밋 + 진행표 | D-007 | §13 |
| test seam | 없음 | `classify()`·`check()` 순수 함수 | 검사 민감도 확인 | VP-07·VP-08 |

### 핵심 책임 분리

| 모듈 | 책임 | 입력/출력 | 누가 호출 |
|---|---|---|---|
| `scan/volume.mjs` | 파일 → 버킷·종류 분류, 줄 수 집계 | `git ls-files` → `volume.json` | 감사자 · `--check` |
| `scan/audit-check.mjs` | K1~K14·K17·K7b 검증, 표 렌더 | `data/*.json`·`ipc.ts`·`audit.md` → 위반 목록 / 생성 블록 | 감사자 · 검증자 |
| `data/*.json` | 감사 판단의 정본 | 사람 작성 | 검사 · 렌더 |
| `audit.md` | 사용자가 읽는 문서 | 해설 + 생성 블록 | 사용자 |

### 감사 방법 — 단계와 렌즈

| 단계 | 산출 | 내용 |
|---|---|---|
| P1 | `scan/volume.mjs` · `volume.json` · 자체 테스트 | 버킷×종류 줄 수·파일 수·test/prod 비 |
| P2 | `scenarios.json` | 시나리오 카탈로그(`S-NN`: 조작 · 관측 결과 · 채널 · feature) + `unreached` |
| P4 | `candidates.json` | 렌즈 L1·L4·L5 수행 |
| P5 | `traces.json` · `reviews.json` | 경로 추적 5건(단계 단위) + 나머지 시나리오 전부의 경로 검토(시나리오 단위). L4의 입력 — P4와 순서를 바꿔도 된다 |
| P6 | `split.json` · `audit.md` 완성 | 분할안 · 승인 목록 |
| P7 (ΔV1) | `deep.json` · 후보 추가 | 분량 상위 버킷의 내부를 읽는 심화 검토. 버킷 묶음별로 끊어 커밋한다(D-007). 시작할 때 `audit.md`의 완료 선언을 내리고 진행표에 P7·P8 행을 둔다 |
| P8 (ΔV1) | `candidates.json` `decomposition` · `split.json` 갱신 · `audit.md` 완성 | `restructure` 후보의 분해안 · 늘어난 후보의 분할·승인 목록 반영 |

| 렌즈 | 묻는 것 | 방법(분모) | 후보 유형 |
|---|---|---|---|
| L1 미도달 | 시나리오에 닿지 않는 코드가 있는가 | renderer·preload 호출부 0인 채널(117) · prod importer 0인 prod export · reader 0인 settings 키 | `remove` |
| **L4 경로 과잉(주 렌즈, D-010)** | 시나리오에 닿는 경로가 그 조작에 필요한 것보다 많은 요소·파라미터·프로토콜을 쓰는가 | 추적 5건의 단계 전수 + 모든 시나리오의 경로 검토, 과잉 범주 X1~X7(아래) | `restructure` · `remove` |
| L5 하네스 중복 | Claude·OpenCode 병렬 구현이 같은 일을 두 번 하는가 | `adapters/{claude,opencode}` · `chat/harnesses/{claude,opencode}`의 같은 역할 파일 쌍 | `restructure` |

과잉 범주(L4가 단계·시나리오마다 묻는 것). 판정 태도는 D-010을 따른다 — 사용자 관측 결과에 기여한다는 근거를 댈 수 없는 요소는 후보로 올리고, 유지하려면 근거를 적는다.

| # | 범주 | 후보가 되는 형태 |
|---|---|---|
| X1 | 파라미터·옵션 | 모든 호출부가 같은 값만 넘기는 인자 · 한 값만 쓰이는 옵션·설정 키·enum 멤버 · 읽는 곳 없는 필드 |
| X2 | 프로토콜·이벤트 | 소비 효과 없는 이벤트·메시지 필드 · 관측 효과 없는 왕복(ack·핸드셰이크·재시도·재동기화) · 같은 값을 여러 번 변환하는 계층 |
| X3 | 상태 | 다른 상태에서 파생 가능한 중복 상태 · 도달 불가능한 상태·전이 · 같은 사실을 든 복수 저장소 |
| X4 | 방어·검증 | 내부 호출자만 있는 경계의 재검증 · 발생 경로 없는 입력 방어 · 같은 조건의 중복 가드 |
| X5 | 간접층 | 호출자 1곳인 래퍼 · 구현 1개인 포트·레지스트리 · 전달만 하는 계층 |
| X6 | 처리량 | 같은 입력의 반복 계산·재조회·재직렬화 · 일부만 쓰는데 전체를 만드는 처리 |
| X7 | 시간 제어 | 중첩된 타임아웃·폴링·지연 · 같은 대기를 여러 층이 따로 재는 것 |

경로 추적 5건(P5, 분량 상위 영역 기준 고정):

| ID | 시나리오 | 지나는 주요 버킷(§8 예비 실측 prod/test) |
|---|---|---|
| T1 | 메시지 전송 → 스트리밍 → 완료(Claude) | `main/app/chat-turn` 3,348/12,244 · `adapters/claude` 6,508/14,357 · renderer `chat/store`·`reducer` |
| T2 | 같은 조작(OpenCode) | `adapters/opencode` 5,644/10,170 |
| T3 | 세션 열기·재개 | `features/sessions` 1,813/3,236 · `features/history` 1,074/2,850 |
| T4 | 앱 부팅 → 첫 화면 | `main/app/bootstrap.ts` 1,365 · `features/auth` 4,111/6,670 |
| T5 | 플러그인·확장 켜기/끄기 | `features/plugins` 4,710/5,222 · `features/extensions` 1,916/1,945 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 / VP-01 | 채널 → 시나리오 귀속 | `ipc.ts` | 검사 K1·K2 | 채널 117개 각각 | §8 채널 명령 → 117 | 귀속 없는 채널 = 시나리오 없이 남은 진입점 |
| EP-02 / VP-01 | feature → 시나리오 귀속 | `features/` 디렉토리 | 검사 K3 | feature 14개 각각 | `ls app/src/renderer/src/features` → 14 | 감사가 보지 않은 화면 |
| EP-03 / VP-02·VP-07 | 파일 → 버킷·종류 | `volume.mjs` `classify()` | `--check` | 파일 2,116개 각각 · 규칙 8행(아래) | `git ls-files app/src app/scripts .github/workflows` → 2,116 | 지도에서 빠진 코드 |
| EP-05 / VP-03·VP-04 | 후보 행 필수 칸 | `candidates.json` 스키마 | 검사 K4~K8 | 칸 9개 × 후보 수 | 스키마 필드 목록(아래) | 후속 handoff가 근거 없이 착수 |
| EP-06 / VP-08 | 검사 규칙 | `audit-check.mjs` `check()` | UT-02 | 규칙 16개(아래) | 규칙 표 K1~K14 · K17 · K7b | 검사가 green인데 표가 불완전 |
| EP-07 / VP-06 | 판정 사본 일치 | `data/*.json` | 검사 K12 · 사람 | `audit.md` 생성 블록 · `INDEX.md` 비고 (2) | `rg -c 'gen:' …/audit.md` · INDEX 0305 행 | 문서와 데이터가 다른 말을 함 |
| EP-08 / VP-03 | 경로 추적 단계 | `traces.json` | 검사 K11 | 추적 5건(T1~T5) | §9 추적 표 → 5 | 추적이 실재하지 않는 코드를 인용 |
| EP-09 / VP-03 | 시나리오 → 경로 검토 | `scenarios.json` | 검사 K17 | 시나리오마다 범주 7칸 — 시나리오 수는 P2가 `scenarios.json`으로 고정 | `scenarios.json`의 `S-NN` 전수 | 닿는 경로를 보지 않고 넘어간 시나리오 |
| EP-10 / VP-09 (ΔV1) | 버킷 → 심화 검토 | `volume.json` | 검사 K18 | prod ≥ 3,000 버킷 12 + `renderer/features/chat/reducer` 1 = 13건, 건마다 범주 7칸 + 밀도 1칸 | `node -e` 로 `volume.json` 에서 `prod.lines >= 3000` 버킷 나열 → 12 | 분량이 가장 큰 구현을 읽지 않고 "과잉 없음"으로 넘어감 |
| EP-11 / VP-09 (ΔV1) | `restructure` 후보 → 분해안 | `candidates.json` | 검사 K19 | `restructure` 후보마다(수는 P7 뒤 `candidates.json`이 고정 — r1 시점 7) | `candidates.json`의 `type=restructure` 전수 | 과도하다고만 하고 어떻게 줄일지 없는 후보 |

**EP-03 종류 규칙** (위에서부터 첫 일치, 규칙 칸 ↔ UT 입력 1:1):

| # | 조건 | 종류 | UT-01 입력 |
|---|---|---|---|
| V1 | `*.test.{ts,tsx,mjs,mts}` | `test` | `app/src/main/a.test.ts` |
| V2 | `*.testfixture.*` · 경로에 `/fixtures/`·`/__snapshots__/` · 파일명 `mock-*`·`*.mock.*` · `scripts/vitest-setup.mjs` | `test-support` | `app/src/main/infra/git/temp-repo.testfixture.ts` · `app/scripts/fixtures/x.html` |
| V3 | `renderer/src/shared/i18n/resources/**` · `*.sql` · `*.pem` · `*.json` | `data` | `…/i18n/resources/ko.ts` · `…/migrations/0001_initial.sql` |
| V4 | `*.md` | `doc` | `app/src/main/AGENTS.md` |
| V5 | `.github/workflows/*.yml` | `ci` | `.github/workflows/ci.yml` |
| V6 | `app/scripts/**` 의 `*.{mjs,mts,cjs}` | `tooling` | `app/scripts/test-pools.mjs` |
| V7 | `*.{ts,tsx,css,html}` (위에 안 걸린 것) | `prod` | `app/src/main/index.ts` |
| V8 | 그 밖의 확장자 | red — 미분류 | `app/src/x.wasm` |

버킷 규칙: `app/src/main/<layer>/<entry>` · `app/src/renderer/src/features/<feature>/<entry>` · `app/src/renderer/src/<dir>` · `app/src/shared/<entry>`(파일이면 `shared/(root)`) · `app/src/preload` · `app/scripts` · `.github/workflows`. UT-01은 층마다 1입력을 둔다.

**EP-05 후보 필수 칸**: `bucket` · `lens`(L1·L4·L5) · `type`(`remove`/`restructure`) · `scenarios`(S-ID 배열, `remove`만 빈 배열 허용) · `origin`(handoff ID 배열 또는 `{unknown, search}`) · `preserve`(보존할 개념 요구 한 문장) · `evidence`(`파일:줄` 또는 명령+N — L4 후보는 과잉 요소의 정의 자리와 그 소비처 수) · `saving`(`{prod, test, basis}` — `test`는 감량되는 제품 코드에 딸린 테스트 줄 수) · `risk`. 조건부 필수 칸: `excess`(X1~X7 배열) — `lens=L4`면 1개 이상. 선택 칸: `decisionChange`(bool) · `approval`(`required`/`none`) · `superseded`(`{id, by, concept}` 배열 — 상호배제로 밀려난 출처 `id`, 정본인 후속 `by`, 배제되는 개념 한 문장. D-009).

**EP-06 검사 규칙** (규칙 칸 ↔ UT-02 red 입력 1:1, 전부 유효한 입력 1건은 green):

| # | red 조건 | UT-02 입력 |
|---|---|---|
| K1 | 채널이 어느 시나리오에도 `unreached`에도 없다 | 매핑에서 채널 1개 제거 |
| K2 | 시나리오·`unreached`가 `ipc.ts`에 없는 채널을 참조한다 | 채널 이름 오타 |
| K3 | feature가 어느 시나리오에도 `unreached`에도 없다 / 없는 feature 참조 | feature 1개 제거 · 오타 |
| K4 | 후보 필수 칸 누락 또는 빈 값 | 9칸 각각 제거(9입력) |
| K5 | 후보의 S-ID가 카탈로그에 없다 / `remove` 아닌데 `scenarios` 빈 배열 | 없는 S-ID · `restructure`+빈 배열 |
| K6 | 후보 `bucket`이 `volume.json`에 없다 / `saving.prod`·`saving.test`가 버킷 현재 값 초과 | 없는 버킷 · 초과 값(prod·test 각 1) |
| K7 | `origin` ID가 `docs/handoff/<ID>-*`·archive history에 없다 / `unknown`인데 `search` 없음 | `9999` · `search` 누락 |
| K7b | `superseded`의 `id`·`by`가 실재하지 않음 / `by` 번호 ≤ `id` 번호 / `by`가 `origin`에 없음 / `concept` 빈 값 | 네 조건 각각 1입력 |
| K8 | `type=remove` 또는 `decisionChange=true`인데 `approval≠required` / 승인 표와 집합 불일치 | 두 조건 각각 1입력 |
| K9 | 후보가 `split.json`에 0회 또는 2회 이상 / 분할이 없는 후보 참조 | 누락 · 중복 · 유령 ID |
| K10 | 후속 handoff의 회귀 시나리오 0개 / 없는 S-ID / `deferred`에 사유 없음 | 세 조건 각각 1입력 |
| K11 | 추적 단계의 파일 미실재 / 심볼 미검출 / `effect=none`인데 후보 ID·유지 근거 둘 다 없음 / 추적 ID 집합 ≠ T1~T5 / 단계의 `excess` 칸 누락(빈 배열은 허용) | 다섯 조건 각각 1입력 |
| K17 | 검토 없는 시나리오 / 없는 S-ID의 검토 / `read`(읽은 파일) 빈 배열·미실재 파일 / 범주 X1~X7 중 판정 없는 칸 / 판정의 후보 ID 미실재 / `lens=L4` 후보에 `excess` 없음 / 후보 `excess`와 그 후보를 가리킨 검토·추적 칸의 범주 불일치 | 일곱 조건 각각 1입력 |
| K12 | `audit.md` 생성 블록 ≠ 렌더 결과 / 필수 블록 누락 | 숫자 1개 수정 · 블록 삭제 |
| K13 | 모르는 최상위 키 · 모르는 enum 값(`lens`·`type`·`kind`·`effect`) | 키 추가 · `type: "x"` |
| K14 | `lenses`가 {L1, L4, L5} 집합이 아님 / `method`·`denominator` 누락 / 후보 수 불일치 | 세 조건 각각 1입력 |
| K18 (ΔV1) | prod ≥ 3,000 버킷에 심화 검토 없음 / 없는 버킷의 검토 / `read` 빈 배열·미실재 파일 / `read` 파일이 그 버킷 소속이 아님 / 범주 X1~X7 중 판정 없는 칸 / 판정의 후보 ID 미실재·`excess` 범주 불일치 / `density`가 `excess`인데 가리킨 후보 0 / `basis` 빈 값 | 여덟 조건 각각 1입력(후보 ID 미실재·범주 불일치는 각 1) |
| K19 (ΔV1) | `restructure` 후보에 `decomposition` 없음·빈 배열 / 단계의 `cut`·`keep` 빈 값 / `files` 빈 배열·미실재 파일 / `scenarios` 빈 배열·없는 S-ID | 네 조건 각각 1입력(`cut`·`keep` 각 1, 빈·미실재 각 1, 빈·없는 ID 각 1) |

- ΔV1 스키마: `data/deep.json` = `{reviews:[{bucket, read[], verdicts{X1..X7: 후보 ID 배열 또는 "none"}, density, basis}]}`. `density` enum = `excess`·`necessary`(모르는 값은 K13). 후보 선택 칸 `decomposition` = `[{cut, keep, files[], scenarios[]}]` — `cut` 떼어내는 것, `keep` 그 단계 뒤에도 같아야 하는 관측 동작. 단계는 앞에서부터 하나씩 따로 병합할 수 있는 순서로 적는다.
- ΔV1 생성 블록: `deep`(버킷 · 범주 7칸 · 밀도 · 읽은 줄/버킷 prod 줄 · 근거) · `decomposition`(후보 · 단계 · 떼어내는 것 · 남는 동작 · 파일 · 시나리오). 필수 블록 7 → 9(K12).
- ΔV1 `facts` 추가: `bucketOf(path)`(`volume.mjs` `classify` 재사용 — 규칙 사본을 만들지 않는다) · `lineCount(path)`(렌더의 읽은 줄 수).
- 자리 목록과 검색 출력의 차집합은 0이어야 한다. 기준 커밋이 바뀌면 분모를 다시 센다.
- 열린 입력 집합: 검사 입력은 이 plan이 정한 JSON 스키마다. 모르는 키·enum은 K13으로 red(fail-closed). `volume.mjs`는 모르는 확장자를 V8로 red.
- 같은 규칙의 공유: 채널 추출 정규식은 `audit-check.mjs` 한 곳에만 둔다. `check-doc-inventory.mjs`를 import하지 않는다(app gate와 분리).
- 선택적 칸: `decisionChange` 미지정 = false. `approval` 미지정은 `type≠remove`일 때만 `none`으로 읽고, `remove`에서 미지정이면 K8 red(fail-closed).

**선언 경계** (verify는 이 안의 반례를 판정에 쓰지 않는다):

1. 감사 후보는 하한이다. 렌즈가 찾지 못한 비대는 결함이 아니다 — 렌즈 방법이 정한 분모 밖(동적 호출·문자열 조립 채널)은 다루지 않는다.
2. `saving`은 추정이다. 검사는 형식과 상한만 본다.
3. CI 단계·실행 시간·테스트 시간은 재지 않는다(D-011). `app/scripts`의 가드·테스트 인프라와 테스트 파일은 분량 지도에만 나타나고 후보 렌즈의 대상이 아니다.
4. L1의 "prod importer 0" 판정은 정적 import만 본다. 후보마다 `rg` 근거를 달아 오탐을 사람이 거른다.
5. `origin`은 코드 주석·handoff 문서의 번호 인용에 의존한다(shallow clone). 인용이 없는 코드는 `unknown + 검색 명령`으로 남는다.
6. 상호배제 판정은 감사자가 두 handoff의 plan을 읽고 내린다. 검사는 `superseded`의 형식과 번호 순서만 본다 — 적지 않은 상호배제는 검사가 찾지 못한다.
7. 단계 단위 추적은 §9 표의 5건으로 고정한다. 그 밖의 시나리오는 시나리오 단위 검토(EP-09)로 다루며, 검토의 깊이는 `read`에 적은 파일까지다. (ΔV1) 심화 검토(EP-10)도 같다 — 버킷 안에서 `read`에 없는 파일은 판정하지 않았고, 읽은 비율은 `deep` 블록이 보인다. prod 3,000줄 미만 버킷은 `chat/reducer` 외에는 심화 대상이 아니다.
8. 과잉 판정(X1~X7)은 감사자의 판단이다. 검사는 판정이 빠짐없이 있는지와 후보와의 연결만 본다 — `none`의 옳고 그름은 verify의 표본 재현으로만 본다.
9. (ΔV1) 밀도 판정(`excess`/`necessary`)은 감사자의 판단이다. 검사는 판정·근거의 존재와 `excess` → 후보 연결만 본다.
10. (ΔV1) 분해안은 제안이다. 단계가 실제로 따로 병합되는지·동작이 보존되는지는 후속 handoff의 plan·verify가 본다 — 검사는 칸의 존재와 파일·시나리오 실재만 본다.

## 11. 구현 설계

| 신규 파일 | 책임 | 내용 | 테스트 seam |
|---|---|---|---|
| `…/scan/volume.mjs` | 분량 지도 | `classify(path)` 순수 함수 + `git ls-files` 집계 + `--check` | `classify` 단위 |
| `…/scan/volume.test.mjs` | UT-01 | V1~V8 · 버킷 층별 입력 | `node --test` |
| `…/scan/audit-check.mjs` | 검증·렌더 | `check(data, facts)` 순수 함수(파일 I/O는 CLI 껍질) · `render(data)` · `--check`·`--write` | `check`·`render` 단위 |
| `…/scan/audit-check.test.mjs` | UT-02 | K1~K14·K17·K7b red 입력 + green 1 | `node --test` |
| `…/data/{volume,scenarios,candidates,traces,reviews,split}.json` | 감사 정본 | P1·P2·P4~P6 산출 | 검사 |
| `…/audit.md` | 사용자 문서 | 진행표 · 요약 · 생성 블록 7 · 재현 방법 | 검사 K12 |

`…` = `docs/handoff/0305-code-bloat-audit`.

### 테스트 가능성

- 순수 파일: `classify`·`check`·`render`는 `git`·파일 시스템을 받지 않고 인자로 받은 값만 쓴다. CLI 껍질이 `facts`(채널 집합·feature 목록·파일 존재 함수)를 모아 넘긴다.
- 의존성: Node 내장 모듈만 쓴다. `app/node_modules`가 없어도 P1·P2·검사는 돈다.
- L1의 export 조사만 `app` 설치(TypeScript API)를 쓴다. 설치 절차는 `app/AGENTS.md` 게이트 가이드를 따르고, 실패하면 `rg` 기반으로 대체하고 서명을 기록한다(경계 4).

## 12. End-to-end 영향

```text
(사람·스크립트) data/*.json → audit-check render → audit.md → 사용자 결정 → 후속 handoff plan의 입력
```

- producer 기준: JSON이 정본이다. 합계·순위는 저장하지 않고 렌더 때 계산한다.
- consumer 파생 규칙: 후속 handoff는 `candidates.json`의 `C-NN`과 `split.json`의 묶음을 인용한다.
- 부팅/등록 변경: 해당 없음.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: impl 턴이 P1부터. `audit.md` 머리에 기준 커밋과 진행표(P1·P2·P4·P5·P6)를 둔다.
- 중단/재개: 단계가 끝날 때마다 검사 green을 확인하고 커밋·push 한다(D-007). 미완성 단계의 검사 규칙은 그 단계 산출 파일이 없으면 "대기"로 보고하고 red로 세지 않는다 — 단 P6 완료 선언(`audit.md` 진행표 전부 완료) 뒤에는 파일 부재가 red다.
- 부분 실패: 단계 검사가 red면 다음 단계로 넘어가지 않는다.
- 다중 저장소 쓰기: 판정 사본은 `data/*.json` → `audit.md` 생성 블록 → `INDEX.md` 비고 세 곳이다. 앞 둘은 K12가 잠근다. `INDEX.md` 비고에는 수치를 옮기지 않고 `audit.md` 링크만 둔다.

## 14. 성능 / 상한 / 최적화

- 새 CI 부하: 0. 산출 스크립트는 `docs/handoff/` 아래라 `ci.yml` paths 필터(`app/**`·`.github/workflows/**`)에 걸리지 않고 `npm test`의 `scripts/*.test.mjs` glob에도 들지 않는다.
- 구조적 목표: 이번 handoff에는 줄 수 감축 목표가 없다. 후속 handoff가 `saving` 추정을 상대 목표의 근거로 쓴다.
- 산출물 크기: 후보 수에 상한을 두지 않는다(D-010 "과감하게"). 버킷·유형·과잉 범주가 모두 같은 항목만 한 행으로 합친다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 코드에서 셀 수 있는 수치를 문서에 적지 않는다 | root `AGENTS.md` 원칙 4 | §8 수치 · `audit.md` | 유지 — `docs/handoff/` 는 검사 제외 대상(`check-doc-inventory.mjs:234`) |
| 유지할 경계 5건 | `main-structure/diagnosis.md` §5 | §9 L4·L5 | 유지 — 이 경계를 허무는 후보는 `decisionChange=true` |
| 테스트 예산 게이트(0294) · 풀 가드(0298) · git spawn 축소(0300) | 각 plan · `app/AGENTS.md` | §10 경계 3 | 유지 — 감사 대상 아님(D-011) |
| 새 `AGENTS.md`는 아무 데나 만들지 않는다 | root `AGENTS.md` 원칙 7 | §11 | 유지 — 만들지 않음 |
| PR은 사용자가 요청할 때 생성 | `docs/handoff/AGENTS.md` §커밋·git 규약 | 해당 없음 | 세션 지시(push 뒤 draft PR)가 우선 — 이번 세션 한정 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 감사 자체가 문서·스크립트 비대가 된다 | CI 밖에 둔다(§14). 스크립트 2개 · 검사 규칙 16개로 고정 |
| 후보 판단이 주관적이다 | 근거 칸 필수(K4) · verify가 표본 재현(VP-03) |
| 과감한 감량 후보가 회귀를 부른다 | 0305는 후보만 만든다. 후보마다 `preserve`·`risk`·회귀 판정 시나리오를 달고, 실제 감량은 후속 handoff의 plan·verify를 거친다(D-003) |
| 모든 시나리오 검토로 감사가 길어진다 | 검토는 시나리오 단위 1행. 단계 커밋(D-007)으로 P5를 시나리오 묶음별로 끊어 커밋한다 |
| 토큰 소진으로 감사가 끊긴다 | 단계 커밋·진행표(D-007) |
| 후속 handoff가 앞선 요구를 일부만 대체했는데 전부 밀려난 것으로 읽는다 | `superseded.concept`에 배제되는 개념만 한 문장으로 한정(D-009). 나머지 요구는 `origin`에 남긴다 |
| 시나리오 단위 판정이 세부 잠금을 잃는다 | 사용자 결정(D-003). 후보마다 `preserve`·`origin`으로 무엇을 잃는지 드러낸다 |
| 기준 커밋이 감사 중 낡는다 | `audit.md` 머리에 기준 커밋 고정, 옮기면 P1부터 재생성 |

- 되돌리기 어려운 결정: 없음(문서·스크립트만).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `docs/handoff/0305-code-bloat-audit/{plan.md,audit.md,data/*.json,scan/*.mjs}`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `docs/handoff/AGENTS.md`. `app/**`는 수정하지 않으므로 `app` lint·typecheck·test는 gate가 아니다.
- 환경 제약: `app` 설치는 L1에만 필요하다. ABI·egress 실패는 서명을 기록하고 `rg` 기반으로 대체한다.
- 기본 gate: §7-A 운영 gate 표의 5개.
- D-006: impl·verify 턴도 서브·백그라운드 에이전트를 쓰지 않는다.
- 사람 실기: AC12.

## READY self-review

- [x] Decision Ledger가 결정을 보존한다 — D-001~D-011(D-001은 SUPERSEDED), 사용자 문장 원문 인용.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §1 성공 문장 · §5 흐름.
- [x] 조건절·이유절을 재해석하지 않았다 — "개념적으로"는 D-003·AC7 `preserve` 칸으로, D-006 이유절은 D-007 추론으로 분리 표기.
- [x] 핵심 동작이 AC와 Technical Design에 연결된다 — §7 표의 도달 경로 ↔ §9 흐름도.
- [x] AS-IS와 TO-BE가 같은 축이다 — §9 Delta 5행.
- [x] Delta가 구현 파일·AC에 추적된다 — Delta `V 연결` 칸.
- [x] 사라진 책임: 없음(AS-IS에 소유자가 없었다).
- [x] 수치·앵커 실측 — §8 전수 조사 7행 · 검산 3줄.
- [x] 각 AC가 단언·수단·경로를 가진다 — §7 13행.
- [x] Baseline V — 상속 없음.
- [x] 모든 NEW node에 REQUIRED pair — VP-01~VP-08.
- [x] INHERITED node 없음 — REGRESSION·NOT_REQUIRED 해당 없음.
- [x] pair별 경로·분모·좌표 — §7-A · §10. 적대 증거는 0건/전수/구조 proxy pair(VP-01~04·06)에만.
- [x] 규칙 칸 ↔ UT 입력 — EP-03 8행 · EP-06 16행 각각 입력.
- [x] 선언 경계 8건 · fail-closed(K13·V8).
- [x] 후보 표 확인 — 0294 행(`test-budget-bindings.mjs`)은 겹치지 않는다. `app/scripts`는 후보 렌즈 대상이 아니다(D-011).
- [x] 운영 gate 5개 — 관련 없는 `app` 실패를 범위로 만들지 않는다.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC12만 사람.
- [x] structural proxy — AC6·AC10은 VP-03 표본 재현으로 보강.
- [x] 신규 계약의 SSOT·강제 지점·seam — §10·§11.
- [x] 부팅/등록 변경 없음.
- [x] producer/consumer — §12.
- [x] 상한 — §14.
- [x] gate가 대상 subtree `AGENTS.md`와 충돌하지 않는다 — `app` 미수정.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다.
- [x] 문장 규칙 — 표 위주, Part I/II 중복 없음.

---

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: 단계 P1·P2·P4·P5·P6, 데이터 → 렌더 → `audit.md` 구조, 검사 규칙 16개.
- 이견 / 현실성 문제: §11 "L1의 export 조사만 `app` 설치(TypeScript API)를 쓴다" — 설치 없이 식별자 일치 스캔(`scan/lens-exports.mjs`)으로 수행했다. 아래 "설계 대비 명시적 차이".
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 | 채널 → 시나리오 | 117 | 117/117 | `rg -o "'orca:[A-Za-z:._-]+'" app/src/shared/ipc.ts \| sort -u \| wc -l` → 117 · `gate:audit-check.mjs --check` ok · 변이 M1 red | 채널 이름 · `orca:chat:send` 제거 → K1 | — |
| VP-01 | feature → 시나리오 | 14 | 14/14 | `ls app/src/renderer/src/features \| wc -l` → 14 · 같은 gate · 변이 M2 red | feature 이름 · `update` 제거 → K3 | — |
| VP-02·VP-07 | 파일 → 버킷·종류 | 파일 2,116 · 규칙 8행 | 2,116/2,116 · 8/8 | `gate:volume.mjs --check` → `2116 files · 305843 lines · 102 buckets` · `scan/volume.test.mjs` 47케이스 · 변이 M3 red | 경로 · 규칙 행마다 입력(V1~V8) → 종류 | — |
| VP-03·VP-04 | 후보 필수 9칸 | 9칸 × 후보 18 | 162/162 | `gate:audit-check.mjs --check` · `audit-check.test.mjs` "red K4" 11케이스 · 변이 M4·M5·M10 red | 칸 값 · 칸별 제거 → K4 · approval 뒤집기 → K8 | — |
| VP-08 | 검사 규칙 | 16규칙 | 16/16 | `node --test scan/*.test.mjs` → tests 117 · pass 117 · `audit-check.test.mjs` RED 표 62행 + K12 3 + green 1 | 규칙마다 red 입력 | — |
| VP-06 | 판정 사본 | 2(`audit.md` 블록 · INDEX 비고) | 2/2 | 변이 M6 red(K12) · INDEX 비고는 수치 없이 `audit.md` 링크만(`rg -n '0305' docs/handoff/INDEX.md`) | 블록 본문 · 숫자 1개 수정 → K12 | — |
| VP-03 | 경로 추적 | 5건 | 5/5 | `data/traces.json` T1~T5 · 단계 46 · 변이 M7 red(K11) | 파일·심볼 · 심볼 변경 → K11 | — |
| VP-03 | 시나리오 검토 | 시나리오 31 × 7칸 | 217/217 | `data/reviews.json` 31건 · 변이 M8·M9 red(K17) | 시나리오·범주 · 검토·칸 삭제 → K17 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `gate:audit-check.mjs --check` | M1·M2 red |
| VP-02 | REQUIRED | SELF_PASS | `gate:volume.mjs --check` | M3 red |
| VP-03 | REQUIRED | SELF_PASS | `gate:audit-check.mjs --check` | 표본 재현은 검증자 몫 — 구현자는 후보 근거 명령을 작성 시 실행 |
| VP-04 | REQUIRED | SELF_PASS(기계 범위) | 같은 gate · AC12 는 사람 | M4·M5 red |
| VP-05 | REQUIRED | SELF_PASS | `git diff --stat a0a95f7..HEAD -- app .github` → 0줄 | not selected |
| VP-06 | REQUIRED | SELF_PASS | 같은 gate(K12) | M6 red |
| VP-07 | REQUIRED | SELF_PASS | `scan/volume.test.mjs` | not selected |
| VP-08 | REQUIRED | SELF_PASS | `scan/audit-check.test.mjs` | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

실제 데이터에 심고 원복했다(`git status` 로 원복 확인).

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 gate | 결과 |
|---|---|---|---|---|
| M1 `scenarios.json` S-04 에서 `orca:chat:send` 제거 | sweep — EP-01 · VP-01 선택 증거 | 최초 | `audit-check --check` | 잠김 |
| M2 `scenarios.json` 에서 feature `update` 제거 | sweep — EP-02 · VP-01 선택 증거 | 최초 | 같음 | 잠김 |
| M3 `volume.json` 버킷 `preload` 삭제 | sweep — EP-03 · VP-02 선택 증거 | 최초 | `volume --check` | 잠김 |
| M4 C-01 `approval` 을 `none` 으로 | VP-04 선택 증거 | 최초 | `audit-check --check` | 잠김 |
| M5 H-A 에서 후보 1건 제거 | VP-04 선택 증거 | 최초 | 같음 | 잠김 |
| M6 `audit.md` volume 블록 `468` → `469` | sweep — EP-07 · VP-06 선택 증거 | 최초 | 같음 | 잠김 |
| M7 T1 2단계 심볼 변경 | sweep — EP-08 | 최초 | 같음 | 잠김 |
| M8 `reviews.json` 마지막 검토 삭제 | sweep — EP-09 | 최초 | 같음 | 잠김 |
| M9 S-01 검토의 `X7` 칸 삭제 | sweep — EP-09 | 최초 | 같음 | 잠김 |
| M10 C-12 `evidence` 제거 | sweep — EP-05 | 최초 | 같음 | 잠김 |

- **분모 검산**: `선택 증거 6(M1~M6) · 인용 변이 0 · 새 oracle 2(검사·volume, 자체 테스트 117케이스가 민감도) · sweep 추가 4(M7~M10) = 표 행 10`. EP-06 의 16규칙 sweep 은 `audit-check.test.mjs` RED 표가 규칙·조건마다 1입력으로 수행한다(62행).
- **덮개 회귀**: 해당 없음(첫 라운드).

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있다 — `audit.md` 를 사용자가 읽는다 | AC12 |
| seam 을 만들려고 production 을 재배치했는가 | 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | "`app` 설치 실패" 행 — 설치를 시도하지 않고 대체 방법을 썼다 | 아래 차이 |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 검사가 위반 목록과 exit 1 을 낸다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

- 사용자 자리에서 본 한계: 후보 18건 중 4건(C-07·C-14·C-15, 부분적으로 C-06)은 절감을 추정하지 않았다. `audit.md` §0 "한계"에 적었다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | EP-03 V2 가 `*.testlib.ts`·`*.testHarness.ts` 를 테스트 지원으로 잡지 않아 prod 로 센다 | ⚠️ 보고만 — 분류 규칙은 plan 규범 행 | 5파일 431줄(`git ls-files app/src \| grep -E 'testlib\|testHarness'`). prod 합계 113,757줄의 0.4% |
| 2 | L4 검토 깊이가 진입 핸들러·main 전송 경로에 치우쳤다. renderer `chatStore.ts`·`chatReducer.ts` 와 어댑터 내부는 진입 심볼만 확인했다 | ⚠️ 보고만 — 선언 경계 7("검토의 깊이는 `read` 에 적은 파일까지") 안 | `data/reviews.json` `read` 칸 · `audit.md` §0 한계 |
| 3 | 채널 호출부 스캔의 첫 판(한 줄 정규식)이 여러 줄 호출 사슬을 놓쳐 오탐 19건을 냈다 | ✅ 선조치 — `rg -U` 다중 줄 검색으로 재확인해 4건으로 확정 | `audit.md` §0 재현 방법 |
| 4 | L5 겹침 측정 스크립트(파이썬)를 저장소에 남기지 않았다 | ⚠️ 보고만 — 방법은 `candidates.json` L5 `method` 에 서술 | 재현하려면 같은 기준으로 다시 작성해야 한다 |
| 5 | 예비 실측(plan §8)의 prod 118,000줄과 정식 수치 113,757줄이 다르다 | ✅ 선조치 — `audit.md` 는 정식 수치만 쓴다 | 차이는 i18n 리소스·mock·fixture 를 종류 `data`·`test-support` 로 뺀 것 |

### 설계 대비 명시적 차이

- §11 은 L1 export 조사에 TypeScript API(설치 필요)를 지정했다. 설치하지 않고 식별자 일치 스캔으로 대체했다 — 설치는 better-sqlite3 ABI·egress 변수를 끌어들이고, 후보마다 사람이 근거를 확인하는 선언 경계 4 안이다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 일회성 스캔 | — |
| 공유 | 같은 이름의 다른 심볼이 다른 파일에 있으면 "참조 있음"으로 잘못 본다(미탐) | 선언 경계 1 "후보는 하한" · 스캔 결과 646 중 16+50만 후보 |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 문자열·주석 안의 같은 단어도 참조로 센다(미탐). 타입 전용 재export 는 구분하지 못한다 | C-06·C-07 `risk` 칸 · C-07 은 절감 미추정 |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `docs/handoff/0305-code-bloat-audit/{audit.md,data/*.json(6),scan/*.mjs(6)}` · `docs/handoff/INDEX.md` · 이 절 |
| 실행 명령 | `node scan/volume.mjs --check` · `node scan/audit-check.mjs --check` · `node --test scan/*.test.mjs` · `cd app && node scripts/check-doc-inventory.mjs --check` · AC11 명령 |
| 관측한 게이트 산출 | `[volume] ok — 2116 files · 305843 lines · 102 buckets` · `[audit-check] ok — 완료 선언` · `tests 117 · pass 117 · fail 0` · doc-inventory `links ok` · AC11 0줄. `app` lint·typecheck·test 는 gate 가 아니다(§19 — `app/**` 미수정) |
| 추가·수정 테스트의 subtree 규칙 | 해당 없음 — 테스트 2파일은 `docs/handoff/` 아래 `node:test` 이고 `app` 테스트 규칙 대상이 아니다 |
| V-pair 자기확인 | `SELF_PASS 8 / SELF_BLOCKED 0` |
| 강제 지점 전수 | 8행 전부 닫음(위 표) |
| AC 자기보고 | AC1 ✅ 117채널·14 feature 차집합 0 · AC2 ✅ 2,116파일 미분류 0 · AC5 ✅ 렌즈 3건 · AC6 ✅ 후보 18건 9칸 · AC7 ✅ 출처 ID 실재(K7) · AC8 ✅ 승인 목록 11건 = remove 11 · AC9 ✅ 후속 5묶음 + 보류 1 · AC10 ✅ 추적 5건 46단계 · AC11 ✅ 0줄 · AC13 ✅ K12 · AC14 ✅ 31건 × 7칸 · AC12 ⚠️ 사람 |
| 합계 검산 | `✅ 11 · ⚠️ 1 · ❌ 0 = 총 12` (AC3·AC4 는 D-011 로 삭제) |
| 블로커 / 역질문 | 없음. 사용자 판정 대기: 승인 목록 11건 · 분할 순위(AC12) |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(첫 라운드).
- 막았어야 할 plan 지침·AC 가 있었는가: 해당 없음.
- 반복해서 부딪히는 환경 한계: `app/node_modules` 없음 · shallow clone(출처 추적이 코드 주석의 handoff 번호에 의존).
- 현재 라운드·impl 턴: `r1`. 단계 커밋 3회(P1 · P2 · P4~P6)는 같은 턴이다.

## [구현자 기입] 설계 리뷰 (r1.2)

- 동의 / 그대로 진행: ΔV1 의 AC15·AC16 · K18·K19 · 단계 P7·P8 · 생성 블록 2개.
- 이견 / 현실성 문제: 없음. 아래 "설계 대비 명시적 차이" 2건은 구현 세부다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.2)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-09 | 버킷 → 심화 검토 (EP-10) | 13건 × (범주 7 + 밀도 1) | 13/13 · 104/104 | `node -e` 로 `volume.json` 의 `prod.lines >= 3000` 나열 → 12, `chat/reducer` 더해 13 = `deep.json` 13건(차집합 0) · `gate:audit-check.mjs --check` ok · 변이 N1·N2·N4·N5·N7 red | 버킷 이름·판정 칸 · `chat/store` 검토 삭제 → K18 | — |
| VP-09 | `restructure` 후보 → 분해안 (EP-11) | `restructure` 후보 23 | 23/23 (단계 50) | `candidates.json` 의 `type=restructure` 23건 전부 `decomposition` 보유 · 같은 gate · 변이 N3·N6 red | 후보 ID · C-24 분해안 삭제 → K19 | — |
| VP-10 | 검사 규칙 K18·K19 (EP-06) | K18 8조건 · K19 4조건 | 8/8 · 4/4 | `scan/audit-check.test.mjs` "red K18" 10케이스 · "red K19" 8케이스 · 경계(`2999`/`3000`)·`necessary`·대기 3케이스 · 코드 변이 24건 red | 조건마다 red 입력 | — |
| VP-06 (REGRESSION) | 판정 사본 (EP-07) | 2(`audit.md` 블록 9 · INDEX 비고) | 2/2 | 변이 M6·N10·N11 red(K12) · "K12: 필수 생성 블록은 9개…" 케이스 · INDEX 비고는 수치 없이 링크만 | 블록 본문 · 문자 1개 수정 → K12 | — |
| VP-03·VP-04 (REGRESSION) | 후보 9칸 · 승인 · 분할 (EP-05) | 9칸 × 후보 35 | 315/315 | 같은 gate ok · 변이 M4·M5·N8·N9 red | approval·분할 소속 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(verify 0회).
- V1 의 EP-01~EP-03·EP-08·EP-09 는 이번 턴에 바꾸지 않았다(`scenarios.json`·`volume.json`·`traces.json`·`reviews.json` diff 0). 닫힘은 r1 표의 좌표 그대로이고 gate 를 다시 돌려 green 을 봤다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-09 | REQUIRED | SELF_PASS | `gate:audit-check.mjs --check` | N1·N2·N3 red(등록 3) · 심화 후보 근거 재현은 검증자 몫 |
| VP-10 | REQUIRED | SELF_PASS | `scan/audit-check.test.mjs` | not selected |
| VP-03·VP-04·VP-06 | REGRESSION | SELF_PASS | V1 좌표 | M4·M5·M6 재실행 red |
| VP-01·VP-02·VP-05·VP-07 | NOT_REQUIRED | — | r1 gate | 운영 gate 로 green 재확인 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.2)

실제 데이터·검사기 코드에 심고 원복했다(`git status` 로 원복 확인). 하네스는 일회성 스크립트다 — 변이 목록은 아래 표가 전부다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 gate | 결과 |
|---|---|---|---|---|
| N1 `deep.json` 에서 `chat/store` 검토 삭제 | VP-09 선택 증거 · sweep EP-10 | 최초 | `audit-check --check` | 잠김 |
| N2 심화 검토의 `X3` 칸 삭제 | VP-09 선택 증거 | 최초 | 같음 | 잠김 |
| N3 C-24 `decomposition` 삭제 | VP-09 선택 증거 · sweep EP-11 | 최초 | 같음 | 잠김 |
| N4 심화 `read` 를 다른 버킷 파일로 · N5 과도 버킷의 판정 전부 `none` · N7 범주가 다른 후보 지목 | sweep EP-10 규칙 분기 | 최초 | 같음 | 잠김 3 |
| N6 분해 단계의 없는 S-ID | sweep EP-11 | 최초 | 같음 | 잠김 |
| N8 승인 목록에서 C-34 제거 · N9 C-27 을 분할안에서 제거 | sweep EP-05(새 후보) | 최초 | 같음 | 잠김 2 |
| M4 C-01 `approval` 뒤집기 · M5 H-A 후보 제거 · M6 volume 블록 숫자 | V1 등록 변이 재실행 | r1 잠김 | 같음 | 잠김 3(덮개 회귀 0) |
| N10 `deep` 블록 문자 수정 · N11 `decomposition` 블록 문자 수정 | sweep EP-07(새 블록) | 최초 | 같음 | 잠김 2 |
| 검사기 K18 조건 11건(제거 9 · 경계 `>=`→`>` · `excess`↔`necessary` 맞바꿈) | sweep EP-06 규칙 분기 | 최초 | `node --test` | 잠김 11 |
| 검사기 K19 조건 10건(제거 8 · `restructure`→`remove` · `cut`↔`keep` 맞바꿈) | sweep EP-06 규칙 분기 | 최초 | 같음 | 잠김 10 |
| 검사기 K13 3건(`density` enum · 심화 키 · 분해 단계 키) · 렌더 2건(읽은 줄 합 · 단계 번호) | sweep(이번 diff 의 조건·항) | 최초 | 같음 | 잠김 5 |
| `BLOCKS` 에서 `deep` 제거 · `decomposition` 제거 | sweep EP-07 | 최초 — **못 잡음** | 같음 | 테스트 추가 뒤 잠김 2 |

- **분모 검산**: `선택 증거 3(N1~N3) · 인용 변이 0 · 새 oracle 0(K18·K19 는 기존 검사기의 규칙 추가 — 민감도는 코드 변이 28건) · sweep 39(N4~N11 8 · M4~M6 3 · 코드 변이 28) = 표 행 42건`. 표는 12행으로 묶었다.
- `못 잡음` 2건: fixture 가 `BLOCKS` 로 `audit.md` 를 만들어 목록에서 블록을 빼도 green 이었다. "K12: 필수 생성 블록은 9개…" 케이스를 더해 두 변이 모두 red 를 봤다.
- **덮개 회귀**: 0 — r1 의 M1~M10 중 이번 diff 가 닿은 것(M4·M5·M6)을 다시 돌려 전부 red.

## [구현자 기입] Product/UX 파생 검토 (r1.2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있다 — `audit.md` §0 "심화 검토에서 더 나온 것" · §7 · §8 을 사용자가 읽는다 | AC12 |
| seam 을 만들려고 production 을 재배치했는가 | 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | "단계 Pn 완료" 행 — P7·P8 을 진행표에 더했다 | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 검사가 위반 목록과 exit 1 을 낸다. 완료 선언 전의 빈 분해안은 `대기: decomposition:C-NN` 으로 보인다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

- 사용자 자리에서 본 한계: `읽은 파일 줄 수` 비율은 파일 전체 줄 수라 실제보다 크게 보인다. 표 머리에 `(상한)` 을 붙이고 `audit.md` §0 한계·§7 머리말·근거 칸에 읽은 구간을 적었다.
- "필요" 판정 7버킷 중 `chat/harnesses`(읽은 파일 1개)와 `plugins`(키워드 필터)는 근거가 얇다 — `audit.md` §0 에 "판정할 만큼 읽지 못함"으로 적었다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 검사기 CLI 가 `files` 에 디렉토리 경로가 오면 `EISDIR` 로 죽었다(위반 보고 없이 중단) | ✅ 선조치 — `statSync().isFile()` 로 디렉토리를 미실재로 센다 | C-18 분해안 작성 중 재현. 고친 뒤 `K19 … files 미실재` 로 보고됨. CLI 껍질(`loadFacts`)이라 UT 좌표는 없다 — 남긴 곳 |
| 2 | 완료 선언 전에는 K19 가 기존 `restructure` 7건에서 red 라 단계 커밋(D-007)을 막았다 | ✅ 선조치 — 완료 전의 빈 분해안은 `pending` 으로 센다(data 파일 부재와 같은 규칙) | "K19: 완료 선언 전에는 분해안 부재가 대기다" 케이스 · 코드 변이 K19a2 red |
| 3 | 심화 검토가 읽지 않은 큰 파일이 남는다 — `claude/map.ts` 1,019줄 · `opencode/session-context.ts` 567줄 · `auth/store.ts` 517줄 · `FileDiffSection.tsx` 915줄 · `chatReducer` 본문 대부분 | ⚠️ 보고만 — 선언 경계 7 안 | `audit.md` §0 한계 |
| 4 | 과잉 범주 X1~X7 에 "한 함수에 몰린 책임"이 없다. 분해 대상 후보(C-15·C-24·C-27·C-28)는 그 안에서 찾은 중복 상태·중복 처리로 범주를 달았다 | ⚠️ 보고만 — 범주 추가는 plan 규범 행 | 확장 후보(verify 0회 — 창 열림). 설계자가 범주를 더할지 정한다 |
| 5 | r1 의 "놓친 잠재 문제" 1(V2 가 `*.testlib.ts` 를 prod 로 셈)은 그대로다 | ⚠️ 보고만 | 심화 분모(prod ≥ 3,000)에 영향 없음 — 해당 5파일 431줄이 문턱을 넘기는 버킷이 없다(가장 가까운 `chat/components` 2,772) |

### 설계 대비 명시적 차이

- ΔV1 §10 은 `facts` 에 `bucketOf`·`lineCount` 를 더한다고만 적었다. `render(data, lineCount)` 로 둘째 인자를 더했다 — `render` 가 순수 함수로 남는다.
- K19 의 "완료 선언 전 대기"는 ΔV1 규칙 칸에 없다(위 표 2). plan §13 "미완성 단계의 검사 규칙은 … 대기로 보고"의 적용이다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 | — |
| 공유 | 완료 선언 표식 하나가 data 파일 부재와 분해안 부재를 함께 연다 — 표식을 지우면 둘 다 대기가 된다 | AC16 · `audit.md` 에 `<!-- audit:complete -->` 실재(`grep -c` → 1) · 변이 N3 는 완료 상태에서 red |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r1.2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `audit.md` · `data/candidates.json` · `data/deep.json`(신규) · `data/split.json` · `scan/audit-check.mjs` · `scan/audit-check.test.mjs` · `docs/handoff/INDEX.md` · 이 절 |
| 실행 명령 | `node scan/volume.mjs --check` · `node scan/audit-check.mjs --check` · `node --test scan/*.test.mjs` · `cd app && node scripts/check-doc-inventory.mjs --check` · AC11 명령 |
| 관측한 게이트 산출 | `[volume] ok — 2116 files · 305843 lines · 102 buckets` · `[audit-check] ok — 완료 선언` · `tests 144 · pass 144 · fail 0` · doc-inventory `links ok` · AC11 0줄(작업 트리 `git status -- app .github` 도 0줄). `app` lint·typecheck·test 는 gate 가 아니다(§19) |
| 추가·수정 테스트의 subtree 규칙 | 해당 없음 — `docs/handoff/` 아래 `node:test` 1파일 수정 |
| V-pair 자기확인 | `SELF_PASS 5(VP-09 · VP-10 · REGRESSION 3) / SELF_BLOCKED 0` |
| 강제 지점 전수 | 5행 전부 닫음(위 표) |
| AC 자기보고 | AC15 ✅ 심화 검토 13건 = {prod ≥ 3,000 버킷 12} ∪ {`chat/reducer`}, 차집합 0 · AC16 ✅ `restructure` 23건 전부 분해안(단계 50) · AC1·AC2·AC10·AC14 ✅ r1 그대로(데이터 diff 0, gate green) · AC5 ✅ 렌즈 3건 후보 수 12·21·2 = 35 · AC6·AC7 ✅ 후보 35건(K4~K7 green) · AC8 ✅ 승인 목록 14 = remove 12 ∪ 결정 변경 2 · AC9 ✅ 후속 9묶음 + 보류 3 · AC11 ✅ 0줄 · AC13 ✅ K12(블록 9) · AC12 ⚠️ 사람 |
| 합계 검산 | `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14` — 분모가 r1 의 12 에서 14 로 바뀌었다(ΔV1 이 AC15·AC16 추가) |
| 블로커 / 역질문 | 없음. 사용자 판정 대기: 승인 목록 14건 · 분할 순위(AC12) |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 아니다 — 사용자 요구 변경(ΔV1) 턴이다.
- 막았어야 할 plan 지침·AC 가 있었는가: r1 은 AC14 의 깊이를 "`read` 에 적은 파일까지"(선언 경계 7)로 두어 분량 상위 버킷 내부를 읽지 않고 완료됐다. D-010("닿는 경로의 과잉이 주 대상")의 주어보다 좁았다.
- 반복해서 부딪히는 환경 한계: `app/node_modules` 없음 · shallow clone · 서브에이전트 금지(D-006)라 읽는 양이 한 세션의 컨텍스트에 묶인다.
- 현재 라운드·impl 턴: `r1.2`(사용자 요구 변경 턴 — verify 없는 impl 턴 수 산정에서 제외).
- 세션 중 PR #566 본문이 D-011 이전 요약(렌즈 6개·CI 시간)으로 남아 있어 사용자가 추가 지시로 오인될 수 있는 형태로 전달했다. 본문을 현재 plan 에 맞게 고쳤다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
