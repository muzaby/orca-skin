# Plan — 0314-0305-derivative-closeout

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0305 감사](../0305-code-bloat-audit/audit.md) §3·§8 · 0307~0313 plan의 Decision · 2026-11-12 사용자 지시(§2)다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0314-0305-derivative-closeout` |
| 작성자 | Claude Code |
| 일자 | 2026-11-12 |
| 매핑 | 0305 분할안 H-H 3·4단계(C-34) · H-B 잔여(C-26) · 0305 후보 39건의 종결 장부 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 산출물이 새 문서 하나다. 0305의 감사 V는 상속하지 않는다(감사 산출물을 바꾸지 않는다, D-008) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 작업 — root `AGENTS.md` 협업 워크플로우). 코드 구현은 없고 장부 문서 작성이 구현 턴이다 |
| 조사 기준 커밋 | `2479aa4` (`git cat-file -t` → commit · `git rev-list --left-right --count origin/main...HEAD` → `0 0`) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0305 감사가 낸 후보 39건은 0307~0313 여덟 handoff에 흩어져 처리됐고, "무엇이 끝났고 무엇을 왜 하지 않는가"를 한 곳에서 볼 수 없다. 남은 두 구현 후보(C-34 3단계 · C-26)는 0313 D-010이 "실 어댑터에서 닿지 않는다는 것을 증명하지 못했다"로 남겼다.
- 완료 후 달라지는 것: 그 증명 여부가 조사로 닫힌다(§4 — mock 어댑터가 구 추적에 기댄다, 그래서 구현하지 않는다). 39건과 분해안 58단계가 전부 "구현됨(어느 handoff)" 또는 "근거 종결(어느 Decision·어떤 관측)"로 귀속된 장부 한 장이 생긴다.
- 성공을 사용자 관점에서 한 문장으로: 장부만 읽고 0305 파생 작업을 닫을 수 있고, 앱은 한 줄도 바뀌지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "305파생 마감 핸드오프를 만들어 plan 작성하라. 범위는 c-34 3단계(main hasCanoncial 스위치 단일화)와 c-26, 그리고 305후보 39건 종결 장부다." | 2026-11-12 턴 1 |
| 명시 요구 | "먼저 claude, opencode, mock어댑터가 백그아뉸드 이벤트보다 먼저 정본 상태를 내는지 조사하고, 하나라도 구 추적에 기대면 규현 없이 종결 근거만 남겨라." | 턴 1 |
| 명시 요구 | "종결 대상은 c -18,23,33,35,34 4단계•캐시 2종이다." | 턴 1 |
| 명시 요구 | "조건은 ui 회귀 금지, 성능 최소 동등, 전략 없이 줄 수 감량 금지다. (=과밀도제거+구조화/모듈화유지혹은확보)" | 턴 1 |
| 상속 | 화면 정책 포함 사용자 경험 변경 불가 · 단순 test 감소 불가 · 실기는 모든 최적화 뒤 사람이 한 번에 | 0313 plan §2 턴 2·턴 5 |
| 상속 | C-33·C-34 "둘 다 보류" | 0307 plan D-004 |
| 해석 | "캐시 2종" = 0313 §6이 미룬 `child 메시지·정본 보조 파생의 공유 캐시` 두 묶음 | 설계자 해석(D-006) — 틀리면 장부 B표 2행만 바뀐다 |

## 3. Decision Ledger

| ID | 결정 | 근거 / 조건 | 출처 | 상태 | 비고 |
|---|---|---|---|---|---|
| D-001 | 범위는 C-34 3단계 · C-26 · 후보 39건 종결 장부다 | §2 턴 1 원문 | 사용자 | ACTIVE | — |
| D-002 | 구현 여부는 선행 조사가 정한다 — 세 어댑터 중 하나라도 구 추적에 기대면 구현하지 않고 종결 근거만 남긴다 | "하나라도 구 추적에 기대면 규현 없이 종결 근거만 남겨라" | 사용자 | ACTIVE | — |
| D-003 | C-34 3단계와 C-26을 구현하지 않는다. `app/**` 변경은 0이다 | §4 조사: mock 어댑터는 정본 이벤트를 내지 않고 구 추적으로 대기·정착한다(`mock.ts:59-62` · `mock-scenarios.ts:554-558`) — D-002 조건 성립 | 설계자 조사 | ACTIVE | 0313 D-010 · 0307 D-009를 조사 결과로 확정 |
| D-004 | C-18 · C-23 · C-33 · C-35 · C-34 4단계 · 캐시 2종을 구현 없이 종결한다 | "종결 대상은 …이다" | 사용자 | ACTIVE | 0307 D-004("보류")의 C-33·C-34를 종결로 닫는다 |
| D-005 | 종결·재개 판단의 기준은 세 조건이다 — UI 회귀 금지 · 성능 최소 동등 · 전략 없는 줄 수 감량 금지(과밀도 제거 + 구조화/모듈화 유지·확보) | §2 턴 1 원문 | 사용자 | ACTIVE | 장부 `재개 조건` 칸의 기준 |
| D-006 | "캐시 2종"은 (a) child 메시지 파생 `childMessageForParentToolRunId` (b) 정본 보조 파생 `persistedBackgroundModels`·`transcriptResultsByToolUseId`의 공유 캐시다 | 0313 plan §6 미룬 항목 표 "child 메시지·정본 보조 파생의 공유 캐시" | 설계자 해석 | ACTIVE | 사용자가 다른 둘을 뜻했으면 B표 2행을 ΔV로 바꾼다 |
| D-007 | C-26은 13곳 전부를 종결한다 — 구 추적과 무관한 9곳만 따로 구현하지 않는다 | D-002의 조건문이 범위 전체(C-34 3단계와 C-26)에 걸린다. 4곳(`turn-coordinator.ts:140,141,289,593`)은 스위치 자체다 | 사용자 조건 + 설계자 조사 | ACTIVE | 9곳만의 필수화는 사용자가 고르면 새 handoff(§6) |
| D-008 | 산출물은 새 문서 `ledger.md` 하나다. 0305 `audit.md`·`data/*.json`은 바꾸지 않는다 | 감사 문서는 `audit-check.mjs --check`가 데이터와 대조하는 생성물이다(0305 verify r2 gate) | 설계자 판단 | ACTIVE | — |
| D-009 | mock이 정본 이벤트를 내도록 고쳐 스위치를 걷는 길은 이번에 가지 않는다 | D-002가 "구현 없이"를 지정한다. DEV 전용 도구에 정본 이벤트 조립을 더하는 순증이라 D-005에도 맞지 않는다 | 설계자 판단 | ACTIVE | 장부 C-34 3단계 `재개 조건`에 적는다 |
| D-010 | 장부의 단위는 후보 39행(A표) + 분해안 단계 58행(A-2표) + 후보 번호 없는 파생 2행(B표)이다 | 후보 하나가 단계별로 다른 handoff·다른 Decision에 귀속된다(C-24 · C-34 · C-14) | 설계자 판단 | ACTIVE | — |

### 갱신 메모

- 새 handoff다. 상속한 ACTIVE 결정: 0307 D-004(→ D-004가 종결로 닫음) · 0313 D-010·D-011 · 0305 D-003·D-006·D-007.
- `ACTIVE 결정 ↔ AC 대조: 충돌 0` — D-003 ↔ AC2(`app/**` diff 0) · D-004 ↔ AC4(8항목 근거) · D-008 ↔ AC2(0305 산출물 diff 0) · D-010 ↔ AC1·AC3(39·58·2).
- OPEN 0. D-006·D-007은 설계자 해석이라 완료 보고에서 사용자에게 알린다.

## 4. 요구 비판적 검토

### 선행 조사 — 어댑터가 백그라운드 이벤트보다 먼저 정본 상태를 내는가

정본 상태는 `BackgroundTaskTracker.canonical`에 세션 키가 생기는 것이고(`background-tasks.ts:46-52,67-71`), 구 추적은 `started`·`settled`·`markAsyncLaunched`가 `bySession`에 쓰는 것이다(`:84-122` — 정본이 있으면 첫 줄에서 반환). 아래는 코드 경로 판독이다(실행 관측 아님).

| 어댑터 | 정본을 먼저 내는가 | 구 추적에 기대는가 | 관측 |
|---|---|---|---|
| Claude | 예 | 아니오 | SDK 메시지마다 `backgroundMapper.map` 결과가 같은 배치의 `providerEvents`로 나간다(`adapter.ts:869,960`). 첫 메시지 `init`이 `background.connection connected`다(`background.ts:124-134`). 런타임은 배치의 provider 이벤트를 normalized 이벤트보다 먼저 넘긴다(`session-runtime.ts:630` → 프레임 push `:673`) |
| Claude (새 세션) | 예 — 세션 행 생성 시점 | 아니오 | 세션 행이 없으면 provider 이벤트가 보류되고(`writer.ts:90-95`) 행 insert 직후 flush된다(`:331`). 그 insert는 `init`의 `session.updated` 처리라 같은 스트림의 뒤 `subagent.task`보다 앞이다 |
| OpenCode | 항상은 아니다 | 아니오 | 정본 이벤트는 bash·Task 도구 파트에서만 난다(`activity.ts:113,174,220`) — 연결 이벤트 없음(`rg "background\.connection" adapters/opencode` → 0). `subagent.task` 생산이 0이라(`rg -c "subagent\.task" adapters/opencode -g '!*.test.*'` → 0파일) 구 추적에 쓰는 값이 없다 |
| mock | 아니오 | **예** | 배치가 `events`만 싣는다(`mock.ts:59-62` — `rg "providerEvents" mock.ts` → 0). 시나리오는 `subagent.task` started/settled(`mock-scenarios.ts:250-281`)와 정착 없는 `async_launched` 영수증(`:554-558`)을 낸다 |

mock 세션에서 구 추적이 하는 일(스위치를 걷으면 사라지는 동작):

| 동작 | 경로 |
|---|---|
| 턴 뒤 미정착 작업이 있으면 listen 턴을 연다 | `post-turn.ts:124-127` → `hasPending` → 정본 없음 → `hasAny`(`background-tasks.ts:62-65,187-192`) |
| 채널이 죽으면 합성 `failed`로 정착한다 | `chat-turn/index.ts:78-84` → `settleTrackedTasks`(`settle.ts:176-180`) |
| listen 중 사용자 중단이 작업을 멈추고 `stopped`로 정착한다 | `chat-turn/index.ts:93-99` |
| 정착 통지의 `background:true` 부여 · 중단 분기 | `turn-coordinator.ts:347,516` → `isAsyncLaunched` 구 분기(`background-tasks.ts:137`) |

판정: D-002 조건 성립 — **C-34 3단계와 C-26은 구현하지 않는다**(D-003). OpenCode 한 가지는 닫지 못했다 — 도구 결과가 `status:'async_launched'` 꼴이면 `markAsyncLaunched`가 구 추적에 쓴다(`turn-coordinator.ts:542-543` · `shared/subagent.ts:15`). OpenCode가 그 꼴을 내는지는 조사하지 않았고 판정에 쓰지 않았다(mock만으로 조건이 선다).

### 검토 표

| 검토 | 판정 | 관측 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 예 | 0313 D-010의 미증명 항이 이 조사의 대상이다 — `0313 plan.md:56` |
| 이미 기존 코드가 충족하는가 | 장부 없음 | `rg -l "C-18" docs/handoff/03{07,08,09,10,11,12,13}*/plan.md` → 0파일 — C-18·C-35는 어느 후속 plan에도 판정이 없다 |
| 더 작은 해법 | 문서 하나 | 스위치 5곳(`rg -n "hasCanonical" app/src -g '!*.test.*'` → 호출 5 · 선언 3)을 건드리지 않는다 |
| 선행 자료의 주장을 코드와 대조했는가 | 감사 C-34의 스위치 좌표 `background-controller.ts:81`은 지금 `:62`다. `:62`는 모드 스위치가 아니라 복원 가드다(정본이 없을 때만 DB 이벤트로 `restore`) | `background-controller.ts:61-75` |
| 선행 자료의 주장을 코드와 대조했는가 | 감사 C-26 "13곳" — 일치 | `rg -c "\?\.\(" app/src/main/features/chat/turn-coordinator.ts` → 13 |
| ACTIVE 결정과 충돌하는가 | 없음 | 0307 D-004 "보류"를 사용자 지시로 "종결"로 닫는다(D-004) |

## 5. 동작 / 사용자 흐름

앱 동작은 바뀌지 않는다. 관측 대상은 장부의 독자다.

| 시작 | 중간 | 결과 |
|---|---|---|
| 독자가 `ledger.md`를 연다 | A표에서 후보 ID를 찾는다 | 분류(`DONE`·`PARTIAL`·`CLOSED`) · 처리 handoff 또는 근거 Decision · 현재 트리 관측 · 재개 조건을 한 행에서 읽는다 |
| 독자가 "C-34는 어디까지 했나"를 묻는다 | A-2표의 C-34 네 행을 본다 | 1단계(결정) · 2단계(0313) · 3단계(이번 조사로 종결) · 4단계(사용자 종결)를 단계별로 읽는다 |
| 독자가 종결 항목을 다시 열려 한다 | `재개 조건` 칸을 본다 | 무엇이 바뀌어야 다시 검토할 수 있는지(D-005 기준)를 읽는다 |

### 상태와 전이 — 장부의 분류값

| 값 | 뜻 | 필수 칸 |
|---|---|---|
| `DONE` | 후보의 모든 단계가 구현돼 verify PASS다 | 처리 handoff · 현재 트리 관측 |
| `PARTIAL` | 일부 단계는 구현, 나머지는 근거 종결 | 처리 handoff · 종결 Decision · 현재 트리 관측 |
| `CLOSED` | 구현 없이 근거 종결 | 종결 Decision · 현재 트리 관측 · 재개 조건 |

### 설계자가 고정한 A표 분류 (39 = 14 + 8 + 17)

| 분류 | 후보 | 수 |
|---|---|---|
| `DONE` | C-01 C-03 C-04 C-05 C-08 C-09 C-32 C-13 C-17 C-39(0307) · C-02 C-10 C-11(0308) · C-25(0311) | 14 |
| `PARTIAL` | C-06(0307 D-012) · C-07(0310 D-002) · C-14(0311 D-009·D-008) · C-24(0308·0309 D-007) · C-27(0312 D-006·D-007) · C-29(0310 D-007·D-008) · C-36(0312 D-011) · C-34(0313 + 이번 D-003·D-004) | 8 |
| `CLOSED` | C-12(0307 D-008) · C-15(0311 D-007) · C-16(0307 D-015) · C-19(0311 D-008 · 0313 D-002) · C-20 C-21 C-22 C-23 C-31(0309 D-008~D-012) · C-28(0312 D-009) · C-30(0307 D-016) · C-37(0307 D-013) · C-38(0307 D-014) · C-18 C-33 C-35(이번 D-004) · C-26(이번 D-003·D-007) | 17 |

### 이번 handoff가 닫는 항목과 설계자가 잰 근거

| 항목 | 종결 근거 | 관측 (조사 기준 커밋) |
|---|---|---|
| C-34 3단계 | mock이 구 추적에 기댄다(D-003) | §4 조사 표 |
| C-26 | 4곳은 스위치, 조건이 범위 전체에 걸린다(D-007). 테스트 조립 50자리가 걸린다 | `rg -n "new TurnCoordinator\(" app/src/main -g '*.test.*'` → 50줄 · 5파일 |
| C-34 4단계 | 0231 이전 세션의 구 모델 표시가 그 id 배열과 파생 함수를 쓴다 | `LegacySubAgentTile.tsx:86,135` · `chatReducer.ts:435-444` |
| C-18 | 겹침 22줄에 하네스별 정책 분리 경계(감사 §9 보류 표) | 두 파일 57 · 77줄 |
| C-23 | 채택 규칙 "안정 액션 묶음 `chatActions`" 변경이다(0309 D-011) | `docs/arch/frontend/state.md:90` · 테스트 81파일 |
| C-33 | 채택 규칙 "직접 호출 금지" 변경이다 | `state.md:120-121` · 래퍼를 참조하는 테스트 51파일 · `ipc.ts` 363줄 |
| C-35 | 공통 줄 13 — 겉모습이 하네스별로 다르다(감사 §9 보류 표) | `QuestionCard.tsx` 325줄 · `QuestionDock.tsx` 265줄 |
| 캐시 (a) child 메시지 | 소비처 3곳이 각자 `useMemo`로 든다 — 공유 캐시가 줄이는 계산을 재지 않았다 | `rg -n "childMessageForParentToolRunId\(" renderer/src -g '!*.test.*'` → 정의 1 + 호출 3 |
| 캐시 (b) 정본 보조 파생 | 소비처가 한 컴포넌트다 — 공유할 상대가 없다 | `CanonicalBackgroundContent.tsx:62,63` — 두 함수 각 호출 1 |

### 파생 UX / 엣지케이스

- 구현자가 한 행의 현재 트리 관측을 재현하지 못하면(설계자 분류와 어긋남) 그 행을 고치지 않고 `PLAN_GAP`으로 돌린다 — 분류는 규범 행이다.
- A-2표의 단계 가운데 어느 handoff·Decision에도 귀속되지 않는 것이 나오면 같은 처리다.

## 6. 범위 / 비범위

- **범위**: 새 파일 `docs/handoff/0314-0305-derivative-closeout/ledger.md` · `docs/handoff/INDEX.md`의 0314 행.
- **비범위**: `app/**` 전부(D-003) · 0305 `audit.md`·`data/`·`scan/`(D-008) · 0305~0313 보드 행과 archive 이동(사람 판정 대기 행이다) · `docs/arch/**` · mock 어댑터(D-009) · C-26의 구 추적 무관 9곳(D-007).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| mock이 정본 이벤트를 내게 하고 스위치를 걷기 | 아니오 | 사용자가 고르면 새 handoff — 장부 `재개 조건` |
| C-26 가운데 구 추적과 무관한 9곳의 필수화 | 아니오 | 같음 |
| OpenCode 도구 결과의 `async_launched` 꼴 여부 | 아니오 | 위 두 항목을 열 때 조사한다 |

## 7. Requirements / Acceptance — `R ↔ AT`

| AC | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|
| AC1 | 장부 A표가 0305 후보 39건을 빠짐없이·겹침 없이 담고, 분류 수가 14·8·17이며 §5 고정 분류와 행마다 같다 | `gate:G1` (§19) | `ledger.md` A표 ↔ `0305 data/candidates.json` |
| AC2 | `app/**` · `.github/**` · 0305 디렉토리의 변경이 0이다 | `gate:G3` | `git diff --stat 2479aa4..HEAD` |
| AC3 | A-2표가 감사 §8의 단계 58행(후보 27)을 전부 담고, 행마다 `구현 handoff` 또는 `종결 Decision` 중 하나가 채워져 있다. B표는 캐시 2행이다 | `gate:G2` | `ledger.md` A-2표 ↔ `audit.md` `gen:decomposition` |
| AC4 | `CLOSED`·`PARTIAL` 행마다 종결 Decision 좌표(`handoff D-NNN`)가 실재하고, 이번에 닫는 9항목(§5 표)은 재실행할 수 있는 관측 명령과 그 출력을 갖는다 | `gate:G4` + 검증자 재실행(9명령) | `ledger.md` → 각 plan의 Decision 행 · 현재 트리 |
| AC5 | §4 어댑터 조사 표 4행이 장부에 명령·출력과 함께 실려 있고, mock 행의 판정이 "기댄다"다 | 검증자 재실행(§10 E1~E4) | `ledger.md` 조사 절 ↔ `app/src/main/adapters/**` |
| AC6 | `DONE`·`PARTIAL` 행의 처리 handoff가 그 handoff `verify.md`의 PASS 판정과 맞는다 | 검증자 대조(7 handoff) | `ledger.md` → `03{07..13}/verify.md` |
| AC7 | 문서 가드와 링크가 통과한다 | `gate:G5` | `check-doc-inventory.mjs --check` |

### AC 검증 주의사항

- AC1·AC3은 총계가 아니라 차집합으로 본다 — 장부 ID 집합 − 감사 ID 집합, 그 반대, 둘 다 ∅.
- AC4의 "실재"는 `rg -n "^\| D-NNN \|" <plan>`이 1줄을 내는 것이다. Decision 문장의 타당성 재심은 범위가 아니다(그 handoff의 verify가 닫았다).
- 사람 실기 없음 — 화면이 바뀌지 않는다. 0305~0313의 일괄 실기는 각 보드 행에 남는다.

## 7-A. V / Trace Matrix

- V mode: `Baseline V`. 필요한 레벨: 사용자 결과(`R↔AT` — 장부) · 모듈 불변식(`MD↔UT` — 장부 표의 완전성 규칙). `SD↔ST`·`AR↔IT`는 두지 않는다 — 수명주기·production 경계가 바뀌지 않는다.

### Node registry

| ID | 레벨 | 내용 | provenance | 기준선 |
|---|---|---|---|---|
| R-01 | R | 0305 후보 39건·58단계·파생 2건이 장부 한 장에 귀속된다 | NEW | — |
| R-02 | R | C-34 3단계·C-26은 구현하지 않고 앱은 불변이다 | NEW | — |
| MD-01 | MD | 장부 완전성 규칙 L1~L5(§10) | NEW | — |

### Pair registry

| Pair | 좌 ↔ 우 | requiredness | production path | 강제 지점 N · oracle | 적대 증거 |
|---|---|---|---|---|---|
| VP-01 | R-01·MD-01 ↔ AT-01 | REQUIRED | `candidates.json`·`audit.md §8` → `ledger.md` A·A-2·B표 → 독자 | §10 L1~L5 — 5자리 · `gate:G1`·`G2`·`G4` | required — 0건/전수 주장이다. 변이: (a) A표 한 행 삭제 → G1 red (b) 한 행 분류를 형제 값으로 → G1 red (c) A-2표 한 행의 귀속 칸 비움 → G2 red (d) Decision 좌표를 없는 번호로 → G4 red |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 작업 트리 → `git diff` | §10 L6 — 1자리 · `gate:G3` | required — 0건 주장. 변이: (e) `app/` 아래 빈 줄 하나 추가 → G3 red |
| VP-03 | R-02 ↔ AT-03 | REQUIRED | `app/src/main/adapters/**`·`features/chat/**` → 장부 조사 절 | §10 E1~E4 — 4자리 · 검증자 재실행 | 선택 안 함 — 명령 출력이 직접 관측이다 |

### 현재 변경의 운영 gate

| gate | 명령 | 적용 이유 |
|---|---|---|
| G1~G4 | §19 | 장부의 완료 조건 |
| G5 | `cd app && node scripts/check-doc-inventory.mjs --check` | `docs/**` 문서를 더한다 |
| G6 | `git log -1 --format='%(trailers:only=true)'` | 커밋 프로토콜 |

`lint`·`typecheck`·vitest는 적용하지 않는다 — `app/**` diff가 0이다(AC2가 그 전제를 잠근다).

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 전수 조사

| 대상 | 검색 | N | 의미 |
|---|---|---|---|
| 감사 후보 | `data/candidates.json`의 `candidates` 길이 | 39 | A표 분모 |
| 분해안 단계 | `audit.md:437-503`에서 `\| 숫자 \|` 단계 칸이 있는 행 | 58 (후보 27) | A-2표 분모 — `remove` 12건은 단계가 없다 |
| 후속 handoff | `ls docs/handoff \| rg "^03(0[7-9]\|1[0-3])"` | 7 | 0307~0313 — 처리 handoff의 전체 집합 |
| `hasCanonical` 호출 | `rg -n "hasCanonical" app/src -g '!*.test.*'` | 호출 5 · 선언 3 | `settle.ts:176` · `background-controller.ts:62` · `turn-coordinator.ts:140` · `chat-turn/index.ts:78,93` |
| 구 추적 쓰기 호출 | `rg -n "backgroundTasks\.(started\|settled\|markAsyncLaunched)\(" app/src/main -g '!*.test.*'` | 4 | `turn-coordinator.ts:492,494,543,545` |
| `subagent.task` 생산자 | `rg -n "type: 'subagent\.task'" app/src/main/adapters -g '!*.test.*'` | Claude `map.ts` 4 · mock 4 · OpenCode 0 | §4 조사 |
| mock 주입 | `rg -n "new MockAdapter" app/src/main -g '!*.test.*'` | 1 | `bootstrap.ts:831` — `import.meta.env.DEV`일 때만 |

### 수치 / 전칭 표현 검산

- 39 = 14 + 8 + 17(§5). `remove` 12 + `restructure` 27 = 39.
- 58 = 후보별 단계 수 합(C-12 2 · C-13 2 · C-14 3 · C-15 3 · C-16 1 · C-17 1 · C-18 1 · C-19 3 · C-20 3 · C-21 2 · C-22 2 · C-23 2 · C-24 4 · C-25 2 · C-26 2 · C-27 3 · C-28 3 · C-29 1 · C-30 1 · C-31 2 · C-33 2 · C-34 4 · C-35 1 · C-36 3 · C-37 2 · C-38 2 · C-39 1).
- "OpenCode는 `subagent.task`를 내지 않는다" — 반례 검색 0파일(위 표).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
0305 audit(39 후보 · 58 단계)
  ├ 0307 … 0313 plan — 후보별 Decision이 흩어져 있다
  └ C-18 · C-35 — 어느 후속 plan에도 판정 없음
main 백그라운드: 정본 있음 → 정본 경로 / 정본 없음(mock) → 구 추적 경로   ← 그대로 둔다
```

### TO-BE

```text
0305 audit ──┐
0307~0313 ───┼─→ 0314 ledger.md (A 39행 · A-2 58행 · B 2행 · 어댑터 조사)
현재 트리 ───┘
main 백그라운드: 변경 없음
```

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | AC |
|---|---|---|---|
| 후보 귀속 | 여덟 문서에 분산 | 장부 A·A-2표 | AC1·AC3 |
| C-34 3단계·C-26 | "증명하지 못했다"(0313 D-010) | 조사로 종결(mock) | AC5 |
| C-18·C-35·캐시 | 판정 없음 | 사용자 종결 + 관측 | AC4 |
| 앱 코드 | — | 불변 | AC2 |

### 핵심 책임 분리

| 문서 | 갖는 것 |
|---|---|
| `0305 audit.md` | 후보의 증거와 분해안(불변) |
| 각 handoff `plan.md` | Decision의 근거 원문 |
| `0314 ledger.md` | 귀속과 좌표 — 근거 원문을 복제하지 않고 `handoff D-NNN`으로 가리킨다 |

## 10. 계약 / 타입 / 강제 지점

### 장부 형식

| 표 | 열 |
|---|---|
| A | `후보` · `분류` · `처리 handoff` · `종결 Decision` · `현재 트리 관측` · `재개 조건` |
| A-2 | `후보` · `단계` · `구현 handoff` · `종결 Decision` |
| B | `항목` · `종결 Decision` · `현재 트리 관측` · `재개 조건` |
| 조사 | `어댑터` · `정본을 먼저 내는가` · `구 추적에 기대는가` · `명령` · `출력` |

- A표 `후보` 칸은 `C-NN`만 적는다(제목은 감사가 갖는다). `분류`는 `DONE`·`PARTIAL`·`CLOSED` 셋 중 하나다.
- 비는 칸은 `—`로 적는다. A-2표는 `구현 handoff`와 `종결 Decision` 중 정확히 하나가 `—`가 아니다.

### 강제 지점

| ID / pair | 규칙 | 누가 | 언제 강제(자리) | 자리 검색 | 실패 의미 |
|---|---|---|---|---|---|
| L1 / VP-01 | A표 ID 집합 = 감사 후보 ID 집합 | 구현자 | A표 | G1 | 후보가 장부에서 빠지거나 겹친다 |
| L2 / VP-01 | A표 분류가 §5 고정 분류와 행마다 같다 | 구현자 | A표 `분류` 칸 | G1 | 끝나지 않은 후보가 `DONE`으로 보인다 |
| L3 / VP-01 | A-2표 (후보, 단계) 집합 = 감사 §8 집합 | 구현자 | A-2표 | G2 | 단계가 귀속 없이 남는다 |
| L4 / VP-01 | A-2표 행마다 두 귀속 칸 중 정확히 하나가 채워진다 | 구현자 | A-2표 귀속 칸 | G2 | 귀속 없는 단계 · 이중 귀속 |
| L5 / VP-01 | 장부가 적은 `NNNN D-NNN` 좌표가 그 plan에 실재한다 | 구현자 | A·A-2·B표 Decision 칸 | G4 | 근거 없는 종결 |
| L6 / VP-02 | `app/**`·`.github/**`·0305 디렉토리 diff 0 | 구현자 | 작업 트리 | G3 | 구현 없이 종결한다는 결정을 어긴다 |
| E1 / VP-03 | mock 배치에 provider 이벤트가 없다 | 검증자 | 장부 조사 절 mock 행 | `rg -c "providerEvents" app/src/main/adapters/claude/mock.ts` → 0(출력 없음) | 조사 판정의 전제가 무너진다 |
| E2 / VP-03 | mock이 `subagent.task`를 낸다 | 검증자 | 같음 | `rg -c "type: 'subagent\.task'" app/src/main/adapters/claude/mock-scenarios.ts` → 4 | 같음 |
| E3 / VP-03 | OpenCode가 `subagent.task`를 내지 않는다 | 검증자 | OpenCode 행 | `rg -c "subagent\.task" app/src/main/adapters/opencode -g '!*.test.*'` → 0파일 | OpenCode 행 판정이 틀린다 |
| E4 / VP-03 | Claude `init`이 연결 이벤트를 낸다 | 검증자 | Claude 행 | `rg -n "subtype === 'init'" app/src/main/adapters/claude/background.ts` → 1줄, 다음 줄들이 `background.connection` | Claude 행 판정이 틀린다 |

규칙 칸 분기 ↔ 입력(L4): `구현만 채움` → 통과 · `종결만 채움` → 통과 · `둘 다 —` → red(변이 c) · `둘 다 채움` → red. 네 분기 모두 G2가 본다.

### 선언 경계 — 게이트가 green인 채로 남는 차이

1. G1·G2·G4는 귀속의 **존재와 좌표 실재**를 본다. Decision 문장이 그 단계를 실제로 가리키는지는 AC4·AC6의 검증자 대조가 본다 — 게이트는 보지 않는다.
2. §4 조사는 코드 경로 판독이다. mock 시나리오를 실행해 listen 턴·합성 정착을 관측하지 않았다.
3. Claude 행의 "새 세션" 순서는 `writer.ts:331`의 flush가 `subagent.task` 처리보다 앞이라는 판독이다. 판정(D-003)은 mock 행만으로 서므로 이 행이 틀려도 결론은 같다.
4. OpenCode 도구 결과의 `async_launched` 꼴 여부는 조사하지 않았다(§4).
5. 0307~0313 verify의 PASS는 "기계 범위"다. 장부의 `DONE`은 그 PASS를 가리킬 뿐 사람 실기 완료를 뜻하지 않는다 — 장부 머리에 한 줄로 적는다.

## 11. 구현 설계

커밋은 하나다: **M1** `ledger.md` 작성 + `[구현자 기입]` + INDEX 갱신.

1. A표 39행을 §5 고정 분류로 채운다. `현재 트리 관측`은 행마다 이번 턴에 재실행한 명령과 출력이다 — `DONE`은 제거·변경 대상이 지금 트리에 없음(또는 새 형태로 있음)을, `CLOSED`는 종결 근거가 가리키는 자리가 지금도 있음을 보인다.
2. A-2표 58행을 채운다. 종결 Decision은 그 단계를 뺀 plan의 `D-NNN`이다. 귀속할 Decision이 없으면 채우지 않고 `PLAN_GAP`으로 돌린다(§5 엣지).
3. B표 2행과 조사 절 4행을 §4·§5의 명령으로 재실행해 채운다.
4. `재개 조건`은 D-005 세 조건으로 적는다 — 예: C-34 3단계 "mock이 정본 이벤트를 내거나 mock 경로가 제거될 때. UI 불변 · 계산량 동등 · 스위치 5곳이 한 경로로 합쳐져 구조가 단순해질 것".
5. G1~G6을 마지막 수정 뒤 트리에서 돌리고 변이 (a)~(e)를 심어 red를 확인한다.

### 테스트 가능성

- G1·G2·G4는 `node -e` 한 줄 명령이다(§19). 새 스크립트 파일을 만들지 않는다 — 장부는 한 번 쓰고 닫는 문서라 상시 게이트가 필요 없다.
- 표 파싱은 `| C-NN |`로 시작하는 줄만 읽는다. 장부 산문에 같은 꼴의 줄을 쓰지 않는다.

## 12. End-to-end 영향

| producer | 정규화/상태 | consumer |
|---|---|---|
| 감사 데이터 · 후속 plan · 현재 트리 | `ledger.md` | 사용자(0305 파생 종료 판정) · 이후 설계자(재개 조건) |

부팅/등록/초기화 변경: 해당 없음.

## 13. Lifecycle / 오류 / 정리

- 장부는 조사 기준 커밋의 스냅샷이다. 머리에 기준 커밋과 날짜를 적고 이후 갱신하지 않는다 — 재개 시 새 handoff가 다시 잰다.
- 오류 경로: 구현 중 분류 불일치 → `PLAN_GAP`(§5).

## 14. 성능 / 상한 / 최적화

- 앱 성능: 변경 없음 — "성능 최소 동등"(D-005)은 `app/**` diff 0(AC2)으로 성립한다.
- 줄 수: `app/**` 0. 감량도 순증도 없다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 결정 / 규칙 | 관계 |
|---|---|
| 0307 D-004 C-33·C-34 보류 | 대체 — D-004가 종결로 닫는다(사용자 지시) |
| 0307 D-009 · 0313 D-010 C-26·스위치 미구현 | 유지 · 근거 보강(§4 조사) |
| 0231 구 모델 표시 fallback | 유지 — C-34 4단계 종결의 근거 |
| `docs/arch/frontend/state.md:90,120-121` 채택 규칙 | 유지 — C-23·C-33 종결의 근거 |
| root `AGENTS.md` 원칙 4(셀 수 있는 수치를 문서에 적지 않는다) | handoff 문서는 조사 스냅샷이라 수치를 명령과 함께 적는다 — `arch/` 규칙의 대상이 아니다. G5로 확인한다 |
| `docs/handoff/AGENTS.md` 후보 표 | 이번 범위와 겹치는 행: 0308 독립 행(`background-controller.ts`의 `dispose` 타이머 미잠금) — 그 파일을 건드리지 않으므로 승격 없음 |

## 17. 리스크 / 트레이드오프

| 리스크 | 대응 |
|---|---|
| D-006 해석이 사용자 뜻과 다르다 | B표 2행만 바뀐다 — 완료 보고에서 알린다 |
| 장부가 Decision 원문을 복제해 갈라진다 | 좌표만 적는다(§9 책임 분리) |
| 후속 handoff의 PR 브랜치 좌표가 `main`과 다르다 | 장부는 커밋 해시를 적지 않고 handoff 번호와 Decision ID만 적는다 |

## 18. 영향 받는 파일 / 문서

| 파일 | 변경 |
|---|---|
| `docs/handoff/0314-0305-derivative-closeout/ledger.md` | 신규 |
| `docs/handoff/0314-0305-derivative-closeout/plan.md` | `[구현자 기입]` |
| `docs/handoff/INDEX.md` | 0314 행 |

## 19. 게이트

`L=docs/handoff/0314-0305-derivative-closeout/ledger.md` · 저장소 루트에서 실행한다. 표는 장부의 `<!-- table:A -->` … `<!-- /table:A -->`(A-2 · B도 같은 꼴) 표식 사이에서 읽는다.

| ID | 명령(요지) | green 조건 |
|---|---|---|
| G1 | `node -e`: A 구간의 `\| C-NN \| 분류 \|` 줄을 읽어 ID 집합을 `0305 data/candidates.json`과 양방향 차집합, 분류를 §5 고정 분류(스크립트 안 상수 39쌍)와 대조 | 차집합 둘 다 ∅ · 중복 0 · 불일치 0 · 14/8/17 |
| G2 | `node -e`: A-2 구간의 (후보, 단계)를 `audit.md`의 `gen:decomposition` 구간과 양방향 차집합, 귀속 두 칸의 `—` 개수 검사 | 차집합 ∅ · 58행 · 모든 행에서 `—`가 정확히 1 |
| G3 | `git diff --stat 2479aa4..HEAD -- app .github docs/handoff/0305-code-bloat-audit` | 출력 없음 |
| G4 | `node -e`: 장부의 `(\d{4}) D-(\d{3})` 좌표마다 해당 `plan.md`에서 `^\| D-NNN \|` 줄 수 | 전부 1 |
| G5 | `cd app && node scripts/check-doc-inventory.mjs --check` | exit 0 |
| G6 | `git log -1 --format='%(trailers:only=true)'` | trailer 파싱됨 |

구현자는 G1·G2·G4의 실제 명령 전문을 `[구현자 기입] 구현 보고`에 적는다 — 검증자가 그대로 재실행한다.

## READY self-review

- [x] Decision Ledger: ACTIVE 10 · OPEN 0. 상속 결정은 갱신 메모에 적었다.
- [x] Part I이 Part II 앞이고 구현 방식 없이 완료 상태(장부 한 장 · 앱 불변)를 설명한다.
- [x] 사용자 문장 4개를 원문으로 인용했다(§2). "종결"을 "보류"·"이동"으로 바꾸지 않았다.
- [x] 사용자에게 물을 제품 결정 없음 — D-006·D-007은 해석으로 표시하고 보고한다.
- [x] 수치 실측: 39 · 58 · 13 · 5 · 50 · 81 · 51(§5·§8 명령).
- [x] 저장소 규칙: `docs/AGENTS.md`(수치·링크 가드) · 후보 표 겹침 행(§16).
- [x] AC마다 동작 기준·검증 수단·도달 경로가 있다.
- [x] Baseline V — 상속 기준 없음.
- [x] NEW 노드 R-01·R-02·MD-01에 REQUIRED pair(VP-01~03).
- [x] INHERITED 회귀 없음 — 앱 경로를 건드리지 않는다(AC2).
- [x] pair마다 path · §10 자리 · oracle 좌표(`gate:`) · 적대 증거 이유.
- [x] 규칙 칸 분기 ↔ 입력: L4 네 분기(§10).
- [x] 선언 경계 5건(§10) — 측정하지 않은 것을 보호로 적지 않았다.
- [x] 운영 gate G5·G6. `lint`·vitest 비적용 근거(AC2).
- [x] 사람 실기로 미룬 순수 로직 없음.
- [x] structural proxy: G1·G2·G4는 존재·좌표만 본다는 차이를 경계 1에 적고 AC4·AC6 대조로 보완했다.
- [x] "있다" 불변식: 행 삭제(a)·분류 맞바꿈(b)·귀속 비움(c)으로 본다.
- [x] 정책 파라미터·배타 상태: 분류 3값 · 귀속 칸 배타(L4).
- [x] 참조 구현 없음.
- [x] 신규 모듈 없음 — 문서 하나.
- [x] producer/consumer(§12).
- [x] worst-case·one-way door 없음.
- [x] 본문 ↔ Ledger 교차검증: 갱신 메모 `충돌 0`.
- [x] 산출물 문장 규칙.

---

## [구현자 기입] 설계 리뷰

(구현 턴에 기입)

## [구현자 기입] 강제 지점 전수 (§10 대조)

(구현 턴에 기입)

## [구현자 기입] 이번 라운드 수정의 잠금

(구현 턴에 기입)

## [구현자 기입] Product/UX 파생 검토

(구현 턴에 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응

(구현 턴에 기입)

## [구현자 기입] 구현 보고

(구현 턴에 기입)

## [구현자 기입] Review Signals — 사실만

(구현 턴에 기입)

## [검증자 기입] 파생 이슈

(검증 턴에 기입)
