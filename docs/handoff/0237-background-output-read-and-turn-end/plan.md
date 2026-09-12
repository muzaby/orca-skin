# Plan — 0237-background-output-read-and-turn-end

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md).
> **조사 정본은 [`0230 §0`](../0230-background-task-ux-conformance/plan.md)** — 여기서 다시 적지 않는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0237-background-output-read-and-turn-end` |
| 작성자 | Claude Code |
| 일자 | 2026-09-12 |
| 매핑 | 사용자 Windows 실기(0230 테스트) 결함 중 **기존 handoff 에 자리가 없는 3건** — 1 · 3 · 6 |
| 상태 | **DRAFT** — A 는 경로 규약 실측이, B 는 main 측 원인 확인이 선행 |
| V mode | `Baseline V` 후보 |
| 기준 V | `none` |

**두 축이다.** A 는 워크스페이스 가드 경계이고 B 는 턴 종료 신호다. 서로 독립이지만 둘 다 실기
3건에서 나왔고 둘 다 다른 handoff 의 전제가 된다 — A 는 0232·0234 의 선행이다.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- **A(실기 1)**: 백그라운드 셸 작업의 출력 파일을 모델이 `Read` 로 열지 못한다. 같은 경로를
  `TaskOutput` 으로는 읽는다. 벤더가 지목한 정식 경로가 막혀 있고 deprecated 경로만 살아 있다.
- **B(실기 3·6)**: 백그라운드 작업을 중단하면 결과 메시지가 나온 뒤 화면이 **답변중 상태로 멈춘다**.
  같은 구간에서 컴포저가 `피드백 보내기` 로 남는다.
- 완료 후 달라지는 것: 모델이 백그라운드 stdout 을 정식 경로로 읽는다. 중단 뒤 세션이 유휴로 돌아온다.
- 성공을 사용자 관점에서 한 문장으로: 백그라운드 작업을 중단하면 대화가 끝나고, 그 출력은 볼 수 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "`~/<APPDATA>/Loacl/Temp/` read 실패, 반면 taskoutput 도구로는 성공. 모든 도구에 대해서 `~/<APPDATA>/Loacl/Temp/` 경로에 대해서는 rw 성공해야함" | 실기 보고 2026-09-12 |
| 명시 요구 | "백그라운드 작업 중단 클릭 시, 결과 메시지 출력 후 hang(답변중 상태 멈춤)에 빠짐" | 같은 보고 |
| 명시 요구 | 범위 축소 — **"Orca 가 만든 하위 경로만 rw"** (OS temp 전체를 열지 않는다) | 사용자 결정 2026-09-12 |
| 설계자 추론 | 실기 3(컴포저가 `피드백 보내기`)은 별도 결함이 아니라 B 의 같은 뿌리다 — `feedbackMode` 가 `inflight` 를 직접 본다 | 설계자 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 |
|---|---|---|---|---|
| D-701 | 가드를 **OS temp 전체로 열지 않는다**. 백그라운드 출력 경로에 한정한다 | 사용자 선택. temp 전체를 열면 모델이 workspace 밖 임의 파일을 temp 경유로 읽고 쓸 수 있다 | 사용자 턴 | **ACTIVE** |
| D-702 | 허용 단위는 **도구 결과가 실제로 보고한 출력 경로**다 — 디렉토리 prefix 가 아니다 | D-701 의 가장 좁은 구현이다. `persistedOutputPath`·`rawOutputPath` 는 이미 투영에 있다(`task-kind.ts:93-99`) | 설계자 추론 | **ACTIVE** |
| D-703 | 읽기는 **셸 작업에만**. 에이전트 작업의 `.output` 은 열지 않는다 | 벤더 원문: "For local_agent tasks: do NOT Read the .output file — it is a symlink to the full subagent conversation transcript (JSONL) and will overflow your context window" | 도구 계약 | **ACTIVE** |
| D-704 | 쓰기(`w`)를 함께 열 것인가 | **OPEN** — 사용자 문장은 "rw" 지만 읽기만으로 실기 1 이 닫힌다. 쓰기를 여는 사용 사례가 확인되지 않았다 | — | **OPEN** |
| D-705 | 중단 뒤 턴 종료를 **어느 신호로** 닫을 것인가 | **OPEN** — main 측 원인 확인 후 결정 | — | **OPEN** |

### 갱신 메모

- 새로 추가: D-701~D-705.
- **`ACTIVE 결정 ↔ AC` 대조**: READY 승격 시 수행. D-704·D-705 가 OPEN 이라 아직 닫히지 않았다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| A 의 요구가 원인을 겨냥하는가 | 타당 | `guardToolAccess` 의 `readRoots` 에 temp 가 없다(`workspace-guard.ts:50-84`). `TaskOutput` 은 `READ_TOOLS` 가 아니라 가드를 지나지 않는다 |
| "Orca 가 만든 하위 경로" 가 실재하는가 | **아니다 — 이름이 어긋난다** | 출력 파일을 만드는 것은 CLI 이고 Orca 가 아니다. 사용자 의도는 *범위를 좁혀라* 이므로 D-702 가 그것을 가장 좁게 구현한다. 경로 규약 자체는 Windows 실측이 필요하다 |
| 이미 기존 코드가 충족하는가 | 아니오 | `rg "readOnlyExceptionRoots" app/src` → 정의 1 · 소비 1. temp 항목 0건 |
| 더 작은 해법이 있는가 | 있다 — D-704 | 읽기만 열면 실기 1 이 닫힌다. 쓰기는 사용 사례가 없다 |
| B 의 증상과 원인이 같은가 | **미확정** | 아래 §8 이 가설까지만 닫았다. main 측 실행 확인이 남았다 |
| ACTIVE 결정과 충돌하는가 | 주의 | 0074·0075 의 워크스페이스 격리 스탠스를 넓히는 변경이다. `workspace-guard.ts` 헤더가 "가이드의 기본 read-only 스탠스에서 Orca 가 의도적으로 넓힌 지점 — 편차로 문서화" 라고 적었으므로 이번 확장도 같은 자리에 적는다 |

- **사용자에게 올릴 결정**: D-704(쓰기 개방 여부) · D-705(턴 종료 신호).
- 코드 조사로 닫은 사실: 가드의 예외 루트 목록 · `feedbackMode` 의 입력 · `TURN_END_RESET` 의 트리거 3종.

## 5. 동작 / 사용자 흐름

```text
[A] 셸 백그라운드 작업 결과 도착 (persistedOutputPath 실림)
  → main 이 그 경로를 세션의 허용 목록에 올린다
  → 모델이 Read(그 경로) → 통과
  → workspace 밖 임의 경로 Read → 종전대로 차단

[B] 사용자가 백그라운드 작업 중단 클릭
  → 정착 + 완료 통지 행
  → 턴 종료 신호
  → 스피너 내려가고 컴포저가 '전송' 으로 돌아온다
```

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 셸 결과에 출력 경로가 있다 | 그 경로만 read 허용에 추가 | 모델이 stdout 을 읽어 답한다 |
| 에이전트 결과의 `.output` | 허용하지 않는다(D-703) | 종전대로 차단 |
| 중단 후 잔여 작업 0 | 턴 종료 | 유휴 · `전송` 버튼 |
| 중단 후 다른 작업이 남음 | 종전대로 대기 | 실행 줄이 남은 건수를 말한다 |

## 6. 범위 / 비범위

- **범위**: 가드 확장(A) · 중단 후 턴 종료(B) · 같은 구간의 컴포저 상태.
- **비범위**: 출력 전체를 화면에 그리는 UX(0232) · 목록 진입 조건(0232) · 정착 상태 어휘(0233) ·
  `Monitor`·`Workflow` 의 `RISKY_TOOLS` 등록(0234 D-407).

---

# Part II — Technical Design (방향)

## 8. Research — 이미 닫은 것

| 발견 / 제약 | 근거 |
|---|---|
| `readRoots` = `ws` + `additionalDirs` + `~/.claude` + `~/.config/orca` + `dirname(process.execPath)` | `workspace-guard.ts:50-84` |
| `READ_TOOLS` 는 `Read`·`Glob`·`Grep` 셋. `TaskOutput` 은 목록 밖이라 가드를 지나지 않는다 | `workspace-guard.ts:24` · `:96-120` |
| 출력 경로는 이미 투영에 보존된다 — `persistedOutputPath`·`rawOutputPath` | `task-kind.ts:68-71`·`:93-99` |
| `feedbackMode = inflight && !steerBlocked && text !== ''` | `ComposerInputController.tsx:270` |
| renderer `inflight` 를 내리는 것은 `TURN_END_RESET` 이고 트리거는 `telemetry`·`turn.aborted`·`error` 다 | `chatReducer.ts:1030`·`:1157`·`:1168` |
| `turn.ended` 는 `turnEndTick` 만 올리고 **턴을 닫지 않는다** | `chatReducer.ts:1150-1152` 주석 |
| 합성 정착은 `status:'failed'` 하드코딩이고 `settle.ts` 의 union 에 `unknown` 이 없다 | `turn-coordinator.ts:462-473` · `settle.ts:93` |

### 가설 — 아직 닫지 못한 것

| 대상 | 가설 | 확인 방법 |
|---|---|---|
| B 의 직접 원인 | 백그라운드 중단 경로가 **`telemetry` 를 renderer 로 내지 않는다**. 그래서 `inflight` 가 참으로 남고 `sessionResponding` 이 답변중을 유지하며 `feedbackMode` 도 함께 고착한다 | main 의 중단 → 정착 → 턴-후 루프 경로를 따라가 `telemetry` 방출 지점을 전수로 센다 |
| 실기 3 이 B 와 같은 뿌리인가 | 같다 — `feedbackMode` 의 유일한 게이트가 `inflight` 다 | 위와 동일 |
| 실기 6 의 `Agent "…"` 라벨 | 합성 정착이 `kindOf` 미관측이면 종류를 못 싣는다 | 0233 이 같은 지점을 본다 |

## 9~15

READY 승격 시 작성한다. 선행은 셋이다.

1. Windows 실측 — 출력 경로의 실제 형태와 `Read` 차단 메시지.
2. main 측 `telemetry` 방출 전수 — B 의 가설 확인.
3. D-704·D-705 사용자 결정.
