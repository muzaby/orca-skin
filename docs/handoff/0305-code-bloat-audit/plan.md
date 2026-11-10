# Plan — 0305-code-bloat-audit

## 메타

| 항목 | 값 |
|---|---|
| slug | `0305-code-bloat-audit` |
| 작성자 | Claude Code |
| 일자 | 2026-11-10 |
| 매핑 | 사용자 `/handoff-plan` — 코드 비대화 방지·과대한 CI 증가 억제. 0305는 감사(지도)만, 축소 구현은 후속 handoff |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 기준 커밋 | `a0a95f7` (`git cat-file -t` = commit · `origin/main` 조상) |

## 0. 작성 경로

- 판정: 조사는 설계자가 직접 했다(D-006). 서브에이전트·백그라운드 에이전트는 쓰지 않았다.
- 사용자 질의 1라운드(4문항)로 범위·CI 의미·회귀 기준·제거 권한을 닫았다(§2·§3).
- 이 plan은 감사 수행 지시서다. `app/**`·`.github/**` 변경은 이번 handoff 전체에 없다(AC11).

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 테스트·가드 코드가 제품 코드보다 빨리 불어났다. `app/src` 는 prod 118,000줄 · test 168,262줄이고 `app/scripts` 는 본체 7,058줄 · 테스트 6,908줄이다(§8 예비 실측).
- 어디가 실제로 비대한지에 대한 근거 지도가 없다. 기존 진단 2건(§8)은 성능·구조 경계가 축이었고 분량·CI는 재지 않았다.
- 완료 후 달라지는 것: 사용자가 **시나리오 카탈로그 · 분량/CI 지도 · 축소 후보 목록 · 제거 승인 목록 · 후속 handoff 분할안**이 든 감사 문서 한 편을 받는다.
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
| 추론 의도 | 감사 작업도 중단 뒤 이어갈 수 있어야 한다 — D-006 이유절("컨텍스트를 소실한다. 지속적인 작업이 안 된다")에서 유도 | 턴 1 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 목표는 코드 비대화 방지와 CI 증가 억제다. CI 증가는 실행 시간과 코드·가드 분량을 둘 다 뜻한다 | "과대한 ci 증가" · "둘 다" | 턴 1 · 질의 1 | ACTIVE | — |
| D-002 | 축소의 기준은 사용자 시나리오다. 같은 시나리오/조작을 더 간소하고 짧은 코드로 재구성한다 | "과도한, 비대한, 불필요한 절차/프로세싱/제어 프로토콜 구현을 제거하여, 똑같은 시나리오/조작에 대해" | 턴 1 | ACTIVE | — |
| D-003 | 회귀 금지. 판정 단위는 시나리오별 관측 동작이다. 내부 구조에 묶인 테스트와 변이 잠금용 테스트는 통합·삭제할 수 있다 | "**회귀 금지**. 이전 핸드오프의 요구 조건을 **개념적으로** 만족할 것" · "시나리오 단위 판정" | 턴 1 · 질의 1 | ACTIVE | — |
| D-004 | 0305는 전체 감사만 한다. 코드는 바꾸지 않고, 감사 순위대로 후속 handoff로 나눈다 | "전체 감사 → 분할" | 질의 1 | ACTIVE | — |
| D-005 | 시나리오에 닿지 않는 기능·방어 경로는 근거와 함께 열거하고 사용자가 승인한 항목만 제거한다 | "목록 승인 후 제거" | 질의 1 | ACTIVE | — |
| D-006 | 백그라운드·서브 에이전트를 쓰지 않는다 | "토큰이 금장 소모되어 에이전트 작업이 중단, 컨텍스트를 소실한다. 지속적인 작업이 안 된다." | 턴 1 | ACTIVE | — |
| D-007 | 감사는 단계마다 산출 파일과 커밋을 남겨 다음 세션이 이어받을 수 있게 한다 | 설계자 추론 — D-006 이유절 | §2 추론 행 | ACTIVE | — |
| D-008 | 구현(감사 수행) 주체는 Claude다 | 비기능 작업은 Claude가 직접 구현 | root `AGENTS.md` 협업 워크플로우 | ACTIVE | — |
| D-009 | 이전 handoff끼리 상호배제되는 개념은 번호가 큰(후속) handoff를 정본으로 한다. 보존할 개념 요구는 후속 쪽에서 뽑는다 | "핸드오프 간 상호배제되는 개념에 대해서는 후속 핸드오프를 정본으로 한다" | 턴 2 | ACTIVE | — |

### 갱신 메모

- 이번 턴(턴 2)에서 새로 추가된 결정: D-009. 구현 전이라 V1을 그대로 갱신했다(AC7·EP-05·K7).
- 변경된 결정: 없음. D-003("이전 핸드오프의 요구 조건을 개념적으로 만족")은 유지되고 D-009가 충돌 시의 우선순위를 더한다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001~D-008.
- D-009 ↔ AC7: 일치 — `superseded` 칸이 밀려난 handoff와 그것을 대체한 후속 handoff를 적는다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0. D-003("테스트 통합·삭제 가능") ↔ AC6(후보 유형 `test-merge` 허용) 일치 · D-004("코드는 바꾸지 않고") ↔ AC11(`app`·`.github` diff 0) 일치 · D-005 ↔ AC8(승인 목록 차집합 0) 일치 · D-006·D-007 ↔ §19 운영 gate 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당. 단 원인 하나는 범위 밖이다 | test/prod 비 1.43(`app/src`). handoff 절차가 열거 항목마다 변이·테스트를 요구한다(`docs/handoff/AGENTS.md` 하한 ⑦) — 지침 변경은 `handoff-review` 몫(§6) |
| 이미 충족됐는가 | 아니오 | 기존 진단 2건은 "성능·자원"·"책임 경계"가 판단 기준이고 줄 수·CI 시간 표가 없다(`docs/etc/study/main-structure/diagnosis.md` §1·§3) |
| 더 작은 해법이 있는가 | 감사 선행이 가장 작다 | 한 handoff가 2,116파일을 다 바꿀 수 없다. 근거 없이 영역을 고르면 절감이 작은 곳부터 손댄다 |
| 선행 자료를 코드와 대조했는가 | 했다 | 채널 117·feature 14는 `ipc.ts`·`features/` 재집계와 `docs/generated/inventory.md` 일치(§8) |
| 기존 결정과 충돌하는가 | 후속 handoff에서 충돌 가능 — 감사가 표시한다 | 0294 테스트 예산 게이트·덮개 회귀 하한 ④는 사용자 결정으로 채택됐다. 이를 줄이는 후보는 `decisionChange=true`로 승인 목록에 올린다(AC8) |

- 사용자에게 올릴 결정: 없음(이번 턴). 감사 완료 뒤 승인 목록과 분할 순위를 올린다(AC12).
- 코드 조사로 닫은 사실: §8 표.

## 5. 동작 / 사용자 흐름

```text
[감사 수행(impl)]
  → P1 분량 지도 → P2 시나리오 카탈로그 → P3 CI·테스트 시간 지도
  → P4 렌즈별 후보 → P5 경로 추적 6건 → P6 분할안·승인 목록
  → [audit.md 완성 + 검사 green]
  → [사용자: 승인 목록 판정 · 분할 순위 확정]  → 후속 handoff 0306~ 생성
  ↘ [세션 중단] → 다음 세션이 audit.md 머리 진행표에서 마지막 완료 단계 다음부터 재개
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 단계 Pn 완료 | 산출 JSON·audit.md 블록 갱신 → 검사 실행 → 단계 커밋 | 진행표의 Pn 행이 `완료 + 커밋 제목` |
| 세션 중단(토큰 소진) | 없음 | 진행표에 미완료 단계가 남는다. 완료 단계 산출은 커밋돼 있다 |
| 측정 불가(설치·ABI·API 실패) | 실패 명령과 출력 서명을 해당 표에 기록 | 그 칸이 `미측정 — 서명`으로 보인다(AC3·AC4) |
| 후보 0인 렌즈 | 방법·분모와 함께 0을 기록 | "후보 0 — 분모 N"으로 보인다 |
| P6 완료 | INDEX를 `impl/IMPL_DONE`으로 갱신 | 사용자가 승인 목록·분할안을 읽을 수 있다 |

### 파생 UX / 엣지케이스

- empty / error: 위 표의 `미측정`·`후보 0` 행.
- restart: D-007 — 단계별 커밋과 진행표.
- concurrency: `main`이 감사 도중 바뀔 수 있다. 모든 수치는 기준 커밋(`audit.md` 머리)에서 재현하고, 도중에 기준을 옮기면 P1부터 다시 생성한다.
- 외부환경: GitHub Actions 실행 시간은 MCP `actions_list`·`actions_get`으로 읽는다. 읽지 못하면 `미측정`.

## 6. 범위 / 비범위

- **범위**: `docs/handoff/0305-code-bloat-audit/` 아래의 `audit.md` · `data/*.json` · `scan/*.mjs`(+자체 테스트) · `docs/handoff/INDEX.md` 행.
- **비범위**: `app/**`·`.github/**` 변경 · 후보의 실제 축소 구현 · handoff 지침(SKILL·AGENTS) 변경 · 새 의존성.
- 감사가 절차 기인 비대(변이 잠금 테스트)를 관측하면 `audit.md` "원인 신호" 절에 사실만 적는다. 지침 개선은 사용자가 `handoff-review`를 요청할 때 한다.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 후보별 축소 구현 | 아니오 | 후속 handoff(분할안) |
| handoff 지침의 테스트 증식 원인 | 아니오 | 원인 신호 기록 → 사용자 결정 |
| 제거 후보 승인 | 아니오 | 감사 완료 뒤 사용자 결정(AC12) |

## 7. Requirements / Acceptance — `R ↔ AT`

용어: **시나리오** = 사용자 조작 1개와 그 관측 결과. **버킷** = §9의 영역 단위. **후보** = 축소 가능 지점 1건(`C-NN`). **검사** = `node docs/handoff/0305-code-bloat-audit/scan/audit-check.mjs`.

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | 모든 IPC 채널과 모든 renderer feature가 시나리오 1개 이상에 귀속되거나 `unreached`에 명시된다 | 검사 K1~K3: `ipc.ts` 채널 집합 − (시나리오 채널 ∪ unreached) = ∅, feature도 같음 | `ipc.ts`·`features/` → `scenarios.json` → 검사 |
| R-02 | AC2 | 대상 파일 전부가 버킷 1개·종류 1개에 속하고 줄 수 합이 총계와 같다 | `volume.mjs --check`: 미분류 0 · Σ버킷 = `git ls-files` 총 줄 수 · 저장본 = 재생성본 | `git ls-files` → `volume.json` → audit 표 |
| R-02 | AC3 | `ci.yml` gate 단계 9개 각각에 최근 `main` 성공 실행 3회의 소요 시간(중앙값·run ID)과 그 단계가 돌리는 코드 줄 수가 있다 | 검사 K15: `ci.json` 단계 이름 집합 = `ci.yml` 단계 집합. 시간 칸은 값 또는 `미측정 — 서명` | `ci.yml` + Actions API → `ci.json` |
| R-02 | AC4 | 테스트 파일별 실행 시간 상위 30과 버킷별 합이 있다. 측정 못 하면 실패 명령·서명이 있다 | 검사 K16: `test-time.json`이 `rows` 30행 이상 또는 `unmeasured{command,signature}` 중 하나 | vitest JSON reporter → `test-time.json` |
| R-03 | AC5 | 렌즈 L1~L6마다 방법(명령)·분모 N·후보 수가 있다 | 검사 K14: `lenses` 6건 각각 `method`·`denominator`·후보 수(= 그 렌즈 후보 행 수) | 렌즈 수행 → `candidates.json` |
| R-03 | AC6 | 후보 행은 필수 9칸을 모두 가진다 — 버킷·렌즈·유형·시나리오·출처·보존 요구·근거·예상 절감·위험 | 검사 K4~K6: 칸 누락·빈 값·미지 enum·없는 버킷·절감 > 버킷 현재 줄 수면 red | `candidates.json` → 검사 |
| R-03 | AC7 | 후보마다 그 코드에 요구를 실은 이전 handoff ID와 보존할 개념 요구 한 문장이 있다 | 검사 K7: ID 실재 · `unknown`이면 검색 명령 동반. 출처끼리 상호배제면 `superseded{id, by}`에 적고 `preserve`는 후속(`by`) 기준(D-009) | 코드 주석·plan → `origin` 칸 |
| R-03 | AC10 | 경로 추적 6건이 entry부터 end까지 단계별로 `파일:심볼`·사용자 관측 효과·판정을 가진다 | 검사 K11: 단계의 파일 실재 + 그 파일에서 심볼 문자열 검출. `effect=none` 단계는 후보 ID를 갖거나 유지 근거를 가짐 | `traces.json` → 검사 |
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
| R-02 | R | §7 AC2~AC4 분량·CI 지도 | NEW | — |
| R-03 | R | §7 AC5~AC7·AC10 후보·출처·경로 추적 | NEW | — |
| R-04 | R | §7 AC8·AC9·AC12 승인 목록·분할안 | NEW | — |
| R-05 | R | §7 AC11 무변경 | NEW | — |
| R-06 | R | §7 AC13 문서 = 데이터 | NEW | — |
| AT-01~AT-06 | AT | 위 R의 검사·명령·사람 판정 | NEW | — |
| AR-01 | AR | §9 `data/*.json` → 렌더 → `audit.md` 생성 블록 | NEW | — |
| IT-01 | IT | 검사 `--check`의 재생성 대조 | NEW | — |
| MD-01 | MD | §10 EP-03 `volume.mjs` 종류·버킷 규칙 | NEW | — |
| MD-02 | MD | §10 EP-06 `audit-check.mjs` 규칙 K1~K16·K7b | NEW | — |
| UT-01·UT-02 | UT | `scan/*.test.mjs` | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | path `start → edges → end` | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `ipc.ts` 채널·`features/` → `scenarios.json` → 검사 K1~K3 | `gate:audit-check.mjs --check` | required — 0건 주장. 변이: 채널 1개·feature 1개를 매핑에서 제거 → red | EP-01(117) · EP-02(14) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `git ls-files` → `volume.mjs` → `volume.json` / `ci.yml`+API → `ci.json` / vitest → `test-time.json` | `gate:volume.mjs --check` · `gate:audit-check.mjs --check`(K15·K16) | required — 전수 주장. 변이: `volume.json` 버킷 1행 삭제 · `ci.json` 단계 1개 삭제 → red | EP-03(2,116) · EP-04(9) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 렌즈 수행 → `candidates.json`·`traces.json` → 검사 K4~K7·K11·K14 | `gate:audit-check.mjs --check` | required — 구조 proxy. 검증자가 후보 5건·추적 단계 5개의 근거 명령을 재실행해 N 일치를 본다 | EP-05(9칸) · EP-08(6) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `candidates.json` → `split.json`·승인 목록 → 검사 K8~K10 → 사용자 | `gate:audit-check.mjs --check` · 사람(AC12) | required — 변이: `remove` 후보의 `approval` 뒤집기 · 후보 1건을 분할안에서 제거 → red | EP-05 |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | 작업 트리 → `git diff` | `gate:git diff --stat a0a95f7..HEAD -- app .github` | not selected — 직접 관측 | 0 — 강제 자리 없음(부재 단언) |
| VP-06 | R-06 ↔ AT-06 · AR-01 ↔ IT-01 | REQUIRED | `data/*.json` → `render()` → `audit.md` 생성 블록 | `gate:audit-check.mjs --check`(K12) | required — 변이: 생성 블록 숫자 1개 수정 → red | EP-07(2 사본) |
| VP-07 | MD-01 ↔ UT-01 | REQUIRED | 경로 문자열 → `classify()` → `{bucket, kind}` | `scan/volume.test.mjs` — EP-03 규칙 행마다 1케이스 | not selected — 행동 oracle | EP-03 규칙 8행 |
| VP-08 | MD-02 ↔ UT-02 | REQUIRED | fixture 데이터 → `check()` → 위반 목록 | `scan/audit-check.test.mjs` — K1~K16·K7b 규칙마다 red 입력 + 전부 유효한 green 입력 1 | not selected — 행동 oracle | EP-06(17규칙) |

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
| CI gate는 9단계다 — checkout · setup-node · `npm ci` · 마이그레이션 가드 · 문서 인벤토리 가드 · 테스트 예산 가드 · lint · typecheck · test | `.github/workflows/ci.yml:37-76` |
| 테스트 예산 게이트는 자체 선언 그래프 해석기를 가진 정적 분석기다 | `app/scripts/check-test-budgets.mjs` 870줄 · `test-budget-bindings.mjs` 968줄 · `check-test-budgets.test.mjs` 3,951줄 |
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
| CI 단계 | `rg -c '^      - (name\|uses):' .github/workflows/ci.yml` | 9 | EP-04 분모 |
| 테스트 파일 | `git ls-files app/src app/scripts \| grep -cE '\.test\.(ts\|tsx\|mjs\|mts)$'` | 961 | L2 분모 |
| 500줄 초과 테스트 파일 | 위 목록 `wc -l` > 500 | 54 | L2 분류 대상 |

### 수치 / 전칭 표현 검산

- 재측정 수치(예비, `.test.` 접미만 test로 분류): `src/main` 57,332/103,320 · `src/renderer` 54,104/61,137 · `src/shared` 6,096/3,213 · `src/preload` 468/592 · `scripts` 7,058/6,908.
- 내역 합 = 총계: prod 57,332+54,104+6,096+468 = 118,000 · test 103,320+61,137+3,213+592 = 168,262. 정식 수치는 P1의 `volume.json`이 대체한다.
- 확장자 합: 1722+293+42+36+6+4+3+3+2+2+1+1+1 = 2,116 = 대상 파일 수.
- 채널 117·feature 14는 `docs/generated/inventory.md`와 일치한다.
- 문서 앵커: `docs/handoff/AGENTS.md` "§판정 범위와 운영 gate"·"§고장 내 보기" 표제 실재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조

- 관련 V node: R-01~R-04.
- 분량·CI 시간·시나리오 귀속을 재는 장치가 없다. `check-doc-inventory.mjs`는 채널·슬라이스 개수만 센다.
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
ci.yml · Actions API ─▶ (사람) data/ci.json ───────┤
vitest JSON ─▶ (사람) data/test-time.json ─────────┼─▶ audit-check.mjs ─▶ 위반 목록(--check)
렌즈 L1~L6 ─▶ (사람) data/candidates.json ────────┤                   └▶ audit.md 생성 블록(--write)
경로 추적 ─▶ (사람) data/traces.json ──────────────┤
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
| `scan/audit-check.mjs` | K1~K16 검증, 표 렌더 | `data/*.json`·`ipc.ts`·`ci.yml`·`audit.md` → 위반 목록 / 생성 블록 | 감사자 · 검증자 |
| `data/*.json` | 감사 판단의 정본 | 사람 작성 | 검사 · 렌더 |
| `audit.md` | 사용자가 읽는 문서 | 해설 + 생성 블록 | 사용자 |

### 감사 방법 — 단계와 렌즈

| 단계 | 산출 | 내용 |
|---|---|---|
| P1 | `scan/volume.mjs` · `volume.json` · 자체 테스트 | 버킷×종류 줄 수·파일 수·test/prod 비 |
| P2 | `scenarios.json` | 시나리오 카탈로그(`S-NN`: 조작 · 관측 결과 · 채널 · feature) + `unreached` |
| P3 | `ci.json` · `test-time.json` | CI 단계 시간·가드 줄 수 · 테스트 파일별 시간 |
| P4 | `candidates.json` | 렌즈 L1~L6 수행 |
| P5 | `traces.json` | 경로 추적 6건(L4의 입력) — P4와 순서를 바꿔도 된다 |
| P6 | `split.json` · `audit.md` 완성 | 분할안 · 승인 목록 · 원인 신호 |

| 렌즈 | 묻는 것 | 방법(분모) | 후보 유형 |
|---|---|---|---|
| L1 미도달 | 시나리오에 닿지 않는 코드가 있는가 | renderer·preload 호출부 0인 채널(117) · prod importer 0인 prod export · reader 0인 settings 키 | `remove` |
| L2 테스트 과밀 | 어느 테스트가 시나리오가 아니라 구조에 묶였는가 | 버킷별 test/prod 비 + 500줄 초과 테스트 파일 54건을 `scenario`/`structure`/`sweep`으로 분류 | `test-merge` |
| L3 메타 코드 | 가드·검사기가 막는 실패에 비해 큰가 | `app/scripts/**` 가드별 본체+테스트 줄 수 · 막는 실패(출처 handoff) · 더 작은 대체 장치 | `guard-simplify` |
| L4 경로 과잉 | 시나리오 경로에 사용자 관측 효과 없는 단계가 있는가 | 추적 6건의 단계 전수 | `restructure` · `remove` |
| L5 하네스 중복 | Claude·OpenCode 병렬 구현이 같은 일을 두 번 하는가 | `adapters/{claude,opencode}` · `chat/harnesses/{claude,opencode}`의 같은 역할 파일 쌍 | `restructure` |
| L6 CI 시간 | 어느 단계·테스트가 시간을 쓰는가 | `ci.json` 9단계 · `test-time.json` 상위 30 | `ci-step` · `test-merge` |

경로 추적 6건(P5, 분량 상위 영역 기준 고정):

| ID | 시나리오 | 지나는 주요 버킷(§8 예비 실측 prod/test) |
|---|---|---|
| T1 | 메시지 전송 → 스트리밍 → 완료(Claude) | `main/app/chat-turn` 3,348/12,244 · `adapters/claude` 6,508/14,357 · renderer `chat/store`·`reducer` |
| T2 | 같은 조작(OpenCode) | `adapters/opencode` 5,644/10,170 |
| T3 | 세션 열기·재개 | `features/sessions` 1,813/3,236 · `features/history` 1,074/2,850 |
| T4 | 앱 부팅 → 첫 화면 | `main/app/bootstrap.ts` 1,365 · `features/auth` 4,111/6,670 |
| T5 | 플러그인·확장 켜기/끄기 | `features/plugins` 4,710/5,222 · `features/extensions` 1,916/1,945 |
| T6 | 개발자가 PR을 올린다(CI gate) | `app/scripts` 7,058/6,908 · `ci.yml` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 / VP-01 | 채널 → 시나리오 귀속 | `ipc.ts` | 검사 K1·K2 | 채널 117개 각각 | §8 채널 명령 → 117 | 귀속 없는 채널 = 시나리오 없이 남은 진입점 |
| EP-02 / VP-01 | feature → 시나리오 귀속 | `features/` 디렉토리 | 검사 K3 | feature 14개 각각 | `ls app/src/renderer/src/features` → 14 | 감사가 보지 않은 화면 |
| EP-03 / VP-02·VP-07 | 파일 → 버킷·종류 | `volume.mjs` `classify()` | `--check` | 파일 2,116개 각각 · 규칙 8행(아래) | `git ls-files app/src app/scripts .github/workflows` → 2,116 | 지도에서 빠진 코드 |
| EP-04 / VP-02 | CI 단계 → 시간·줄 수 | `ci.yml` | 검사 K15 | gate job 단계 9개 | §8 CI 명령 → 9 | 재지 않은 단계 |
| EP-05 / VP-03·VP-04 | 후보 행 필수 칸 | `candidates.json` 스키마 | 검사 K4~K8 | 칸 9개 × 후보 수 | 스키마 필드 목록(아래) | 후속 handoff가 근거 없이 착수 |
| EP-06 / VP-08 | 검사 규칙 | `audit-check.mjs` `check()` | UT-02 | 규칙 17개(아래) | 규칙 표 K1~K16 + K7b | 검사가 green인데 표가 불완전 |
| EP-07 / VP-06 | 판정 사본 일치 | `data/*.json` | 검사 K12 · 사람 | `audit.md` 생성 블록 · `INDEX.md` 비고 (2) | `rg -c 'gen:' …/audit.md` · INDEX 0305 행 | 문서와 데이터가 다른 말을 함 |
| EP-08 / VP-03 | 경로 추적 단계 | `traces.json` | 검사 K11 | 추적 6건(T1~T6) | §9 추적 표 → 6 | 추적이 실재하지 않는 코드를 인용 |

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

**EP-05 후보 필수 칸**: `bucket` · `lens`(L1~L6) · `type`(`remove`/`restructure`/`test-merge`/`guard-simplify`/`ci-step`) · `scenarios`(S-ID 배열, `remove`만 빈 배열 허용) · `origin`(handoff ID 배열 또는 `{unknown, search}`) · `preserve`(보존할 개념 요구 한 문장) · `evidence`(`파일:줄` 또는 명령+N) · `saving`(`{prod, test, ciSeconds, basis}`) · `risk`. 선택 칸: `decisionChange`(bool) · `approval`(`required`/`none`) · `superseded`(`{id, by, concept}` 배열 — 상호배제로 밀려난 출처 `id`, 정본인 후속 `by`, 배제되는 개념 한 문장. D-009).

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
| K11 | 추적 단계의 파일 미실재 / 심볼 미검출 / `effect=none`인데 후보 ID·유지 근거 둘 다 없음 / 추적 ID 집합 ≠ T1~T6 | 네 조건 각각 1입력 |
| K12 | `audit.md` 생성 블록 ≠ 렌더 결과 / 필수 블록 누락 | 숫자 1개 수정 · 블록 삭제 |
| K13 | 모르는 최상위 키 · 모르는 enum 값(`lens`·`type`·`kind`·`effect`) | 키 추가 · `type: "x"` |
| K14 | `lenses`가 L1~L6 집합이 아님 / `method`·`denominator` 누락 / 후보 수 불일치 | 세 조건 각각 1입력 |
| K15 | `ci.json` 단계 집합 ≠ `ci.yml` gate 단계 집합 / 시간 칸이 값도 `unmeasured`도 아님 | 단계 삭제 · 빈 시간 |
| K16 | `test-time.json`이 `rows`(30행 이상)도 `unmeasured{command,signature}`도 아님 | 빈 객체 · 29행 |

- 자리 목록과 검색 출력의 차집합은 0이어야 한다. 기준 커밋이 바뀌면 분모를 다시 센다.
- 열린 입력 집합: 검사 입력은 이 plan이 정한 JSON 스키마다. 모르는 키·enum은 K13으로 red(fail-closed). `volume.mjs`는 모르는 확장자를 V8로 red.
- 같은 규칙의 공유: 채널 추출 정규식은 `audit-check.mjs` 한 곳에만 둔다. `check-doc-inventory.mjs`를 import하지 않는다(app gate와 분리).
- 선택적 칸: `decisionChange` 미지정 = false. `approval` 미지정은 `type≠remove`일 때만 `none`으로 읽고, `remove`에서 미지정이면 K8 red(fail-closed).

**선언 경계** (verify는 이 안의 반례를 판정에 쓰지 않는다):

1. 감사 후보는 하한이다. 렌즈가 찾지 못한 비대는 결함이 아니다 — 렌즈 방법이 정한 분모 밖(동적 호출·문자열 조립 채널)은 다루지 않는다.
2. `saving`은 추정이다. 검사는 형식과 상한만 본다.
3. 시간 수치는 환경 의존이다. `ci.json`은 Windows 러너 기록, `test-time.json`은 감사 환경(Linux) 1회 실행이며 순위 용도다.
4. L1의 "prod importer 0" 판정은 정적 import만 본다. 후보마다 `rg` 근거를 달아 오탐을 사람이 거른다.
5. `origin`은 코드 주석·handoff 문서의 번호 인용에 의존한다(shallow clone). 인용이 없는 코드는 `unknown + 검색 명령`으로 남는다.
6. 상호배제 판정은 감사자가 두 handoff의 plan을 읽고 내린다. 검사는 `superseded`의 형식과 번호 순서만 본다 — 적지 않은 상호배제는 검사가 찾지 못한다.
7. 추적 6건은 §9 표로 고정한다. 그 밖의 시나리오 경로는 L1·L2·L5의 버킷 단위 관측으로만 다룬다.

## 11. 구현 설계

| 신규 파일 | 책임 | 내용 | 테스트 seam |
|---|---|---|---|
| `…/scan/volume.mjs` | 분량 지도 | `classify(path)` 순수 함수 + `git ls-files` 집계 + `--check` | `classify` 단위 |
| `…/scan/volume.test.mjs` | UT-01 | V1~V8 · 버킷 층별 입력 | `node --test` |
| `…/scan/audit-check.mjs` | 검증·렌더 | `check(data, facts)` 순수 함수(파일 I/O는 CLI 껍질) · `render(data)` · `--check`·`--write` | `check`·`render` 단위 |
| `…/scan/audit-check.test.mjs` | UT-02 | K1~K16·K7b red 입력 + green 1 | `node --test` |
| `…/data/{volume,scenarios,ci,test-time,candidates,traces,split}.json` | 감사 정본 | P1~P6 산출 | 검사 |
| `…/audit.md` | 사용자 문서 | 진행표 · 요약 · 생성 블록 7 · 원인 신호 · 재현 방법 | 검사 K12 |

`…` = `docs/handoff/0305-code-bloat-audit`.

### 테스트 가능성

- 순수 파일: `classify`·`check`·`render`는 `git`·파일 시스템을 받지 않고 인자로 받은 값만 쓴다. CLI 껍질이 `facts`(채널 집합·feature 목록·CI 단계·파일 존재 함수)를 모아 넘긴다.
- 의존성: Node 내장 모듈만 쓴다. `app/node_modules`가 없어도 P1·P2·검사는 돈다.
- L1의 export 조사와 P3 vitest 측정은 `app` 설치가 필요하다. 설치 절차는 `app/AGENTS.md` 게이트 가이드를 따르고, 실패하면 서명을 기록한다(AC4 · 경계 4).

## 12. End-to-end 영향

```text
(사람·스크립트) data/*.json → audit-check render → audit.md → 사용자 결정 → 후속 handoff plan의 입력
```

- producer 기준: JSON이 정본이다. 합계·순위는 저장하지 않고 렌더 때 계산한다.
- consumer 파생 규칙: 후속 handoff는 `candidates.json`의 `C-NN`과 `split.json`의 묶음을 인용한다.
- 부팅/등록 변경: 해당 없음.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: impl 턴이 P1부터. `audit.md` 머리에 기준 커밋과 진행표(P1~P6)를 둔다.
- 중단/재개: 단계가 끝날 때마다 검사 green을 확인하고 커밋·push 한다(D-007). 미완성 단계의 검사 규칙은 그 단계 산출 파일이 없으면 "대기"로 보고하고 red로 세지 않는다 — 단 P6 완료 선언(`audit.md` 진행표 전부 완료) 뒤에는 파일 부재가 red다.
- 부분 실패: 측정 실패는 `unmeasured` 기록(AC3·AC4). 그 밖의 단계 실패는 다음 단계로 넘어가지 않는다.
- 다중 저장소 쓰기: 판정 사본은 `data/*.json` → `audit.md` 생성 블록 → `INDEX.md` 비고 세 곳이다. 앞 둘은 K12가 잠근다. `INDEX.md` 비고에는 수치를 옮기지 않고 `audit.md` 링크만 둔다.

## 14. 성능 / 상한 / 최적화

- 새 CI 부하: 0. 산출 스크립트는 `docs/handoff/` 아래라 `ci.yml` paths 필터(`app/**`·`.github/workflows/**`)에 걸리지 않고 `npm test`의 `scripts/*.test.mjs` glob에도 들지 않는다.
- 구조적 목표: 이번 handoff에는 줄 수 감축 목표가 없다. 후속 handoff가 `saving` 추정을 상대 목표의 근거로 쓴다.
- 산출물 크기 상한: 후보는 영역당 묶어 60건 이내를 목표로 한다. 넘으면 같은 버킷·같은 유형을 한 행으로 합친다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 코드에서 셀 수 있는 수치를 문서에 적지 않는다 | root `AGENTS.md` 원칙 4 | §8 수치 · `audit.md` | 유지 — `docs/handoff/` 는 검사 제외 대상(`check-doc-inventory.mjs:234`) |
| 유지할 경계 5건 | `main-structure/diagnosis.md` §5 | §9 L4·L5 | 유지 — 이 경계를 허무는 후보는 `decisionChange=true` |
| 테스트 예산 게이트(0294) · 풀 가드(0298) · git spawn 축소(0300) | 각 plan · `app/AGENTS.md` | §9 L3·T6 | 유지 — 감사는 측정만. 단순화 후보는 승인 목록 |
| 덮개 회귀 하한 ④ · 열거 sweep ⑦ | `docs/handoff/AGENTS.md` §고장 내 보기 | §6 원인 신호 | 유지 — 지침 변경은 비범위 |
| 새 `AGENTS.md`는 아무 데나 만들지 않는다 | root `AGENTS.md` 원칙 7 | §11 | 유지 — 만들지 않음 |
| PR은 사용자가 요청할 때 생성 | `docs/handoff/AGENTS.md` §커밋·git 규약 | 해당 없음 | 세션 지시(push 뒤 draft PR)가 우선 — 이번 세션 한정 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 감사 자체가 문서·스크립트 비대가 된다 | CI 밖에 둔다(§14). 스크립트 2개 · 검사 규칙 17개로 고정 |
| 후보 판단이 주관적이다 | 근거 칸 필수(K4) · verify가 표본 재현(VP-03) |
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
- 환경 제약: `app` 설치는 P3·L1에만 필요하다. ABI·egress 실패는 `unmeasured` 서명으로 기록한다.
- 기본 gate: §7-A 운영 gate 표의 5개.
- D-006: impl·verify 턴도 서브·백그라운드 에이전트를 쓰지 않는다.
- 사람 실기: AC12.

## READY self-review

- [x] Decision Ledger가 결정을 보존한다 — D-001~D-009, 사용자 문장 원문 인용.
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
- [x] 규칙 칸 ↔ UT 입력 — EP-03 8행 · EP-06 17행 각각 입력.
- [x] 선언 경계 7건 · fail-closed(K13·V8).
- [x] 후보 표 확인 — 0294 행(`test-budget-bindings.mjs`)이 L3 대상과 겹친다. 이번에는 측정만 하고 코드를 건드리지 않아 승격하지 않는다.
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

## [구현자 기입] 설계 리뷰

(impl 턴에서 채운다)

## [구현자 기입] 강제 지점 전수 (§10 대조)

(impl 턴에서 채운다)

## [구현자 기입] 이번 라운드 수정의 잠금

(impl 턴에서 채운다)

## [구현자 기입] Product/UX 파생 검토

(impl 턴에서 채운다)

## [구현자 기입] 놓친 잠재 문제 + 대응

(impl 턴에서 채운다)

## [구현자 기입] 구현 보고

(impl 턴에서 채운다)

## [구현자 기입] Review Signals — 사실만

(impl 턴에서 채운다)

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
