# Plan — 0204-taskxxx-right-panel

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0204-taskxxx-right-panel` |
| 작성자 | Claude Code |
| 일자 | 2026-08-27 |
| 매핑 | PR [#393](https://github.com/muzaby/orca-skin/pull/393)(draft) · 구현 브랜치 `claude/task-panel-separation-dw3tt6` |
| 상태 | DRAFT → READY → impl → verify/FAIL(r1) → **READY (ΔV1)** — 단계·좌표 정본은 [`INDEX.md`](../INDEX.md) |
| V mode | `Baseline V + ΔV1 + ΔV2` |
| 기준 V | `none` — 0136·0143 은 V 규약 이전 handoff 라 상속할 명시 V node 가 없다 |
| 이번 V revision | `ΔV2` — 사용자 질의에서 파생한 파서 갭 G1·G2(§7-C). 직전 `ΔV1` (`72766d2:V1` 기준) — 사용자 제품 결정 변경(패널 분리·cowork 3섹션)으로 D-003 을 supersede 하고, verify r1 의 D1·D2·D4 를 규범 행에 귀속시킨다. 구 행은 덮어쓰지 않고 supersede |
| 유효 V | `V1 + ΔV1 + ΔV2` |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: Claude Agent SDK 의 `TaskCreate`/`TaskUpdate`/`TaskList`/`TaskGet` 호출이 transcript 의 일반 tool call 로만 흐른다 — 세션의 Task 목록과 현재 상태를 지속적으로 볼 곳이 없다.
- 완료 후 달라지는 것: 우측 패널 **`작업` 타일 하나**가 현재 세션의 일반 Task(TaskXXX)와 background Task 를 같은 상태 그룹으로 보여주고, background Task 는 거기서 개별 중단할 수 있다.
- 성공을 사용자 관점에서 한 문장으로: 에이전트가 Task 를 만들거나 상태를 바꾸면 사용자가 아무 조작 없이 우측 패널에서 그 변화를 본다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 「TaskXXX GUI 상호작용 시나리오 명세」 §1~§3 전문 (범위=6개 도구, 우측 패널 지속 표시, background 중단, 완료 통지, 세션 귀속, 채널 종료 처리) | 사용자 턴 (2026-08-27) |
| 명시 요구 | "task 기능은 우측 패널에서 상호작용할 수 있어야 한다" · "현재 프로젝트의 디자인 룰 및 시각효과와 통일성이 있어야 한다" | 같은 턴 |
| 명시 요구 | 첨부 `cowork_progress_widget.html` — 원형 상태 아이콘(✓/↻/번호) + 라벨 1행 목록 양식 | 같은 턴 첨부 |
| 명시 요구 | "별도의 범용 Task 추상화나 타 Agent SDK 대응은 수행하지 않는다" · "이번 작업에서 별도의 범용 Task 모델이나 backend 공통 추상화는 추가하지 않는다" | 명세 §1·§3 말미 |
| 사용자 결정 | 패널 구성 = 단일 `작업` 타일 통합 / 완료 통지 = 패널 내 표시만 / 구현 주체 = Codex | 같은 턴 AskUserQuestion 응답 |
| 추론 의도 | 일반 Task 는 transcript tool call 의 **순수 fold** 로 파생한다(main 에 Task 모델 미도입) — 명세의 "별도 backend 공통 추상화 추가 금지"를 만족하는 최소 해법이라는 설계자 판단 | 추론 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 범위는 `TaskCreate`·`TaskGet`·`TaskList`·`TaskUpdate`·`TaskOutput`·`TaskStop` 6개 도구의 실제 호출 관찰로 한정한다 | "별도의 범용 Task 추상화나 타 Agent SDK 대응은 수행하지 않는다" | 명세 §1 | ACTIVE | — |
| D-002 | 일반 Task 상태의 SSOT 는 **transcript parts 의 순수 fold** — main 에 Task 스토어를 두지 않는다 | 명세 §3 "별도의 범용 Task 모델이나 backend 공통 추상화는 추가하지 않는다". 세션별 격리·재로드 복원이 기존 `sessions[key].messages` 로 공짜 | 추론 + 명세 §3 | ACTIVE | — |
| D-003 | 우측 패널은 기존 `subagent` 타일을 **`task`(`작업`) 타일로 확장**해 일반 Task 와 background Task 를 한 목록에 둔다 | 명세 §3 예시가 진행 중/대기 중/완료 그룹 안에 두 종류를 섞어 보여준다. 사용자가 "단일 '작업' 타일로 통합"을 선택 | 사용자 턴 (AskUserQuestion) | **SUPERSEDED** | → D-015 (사용자가 분리를 지시) |
| D-004 | 완료 통지는 **패널 내 표시만** — 타일 칩의 미확인 배지 + 완료 그룹 이동. OS 알림 게이트를 바꾸지 않고 in-app 토스트도 만들지 않는다 | 사용자가 세 선택지 중 "패널 내 표시만"을 선택. 명세 §2 의 "완료 notification" 문언보다 좁다는 점을 제시한 뒤의 선택 | 사용자 턴 (AskUserQuestion) | ACTIVE | — |
| D-005 | background Task 중단은 클릭 즉시 `중단됨`으로 확정하지 않고 `중단 중` 을 거쳐 SDK 확인 후 확정한다. 중단 실패면 `진행 중` 복구 + 사유 표시 | 명세 §2 "즉시 '중단됨'으로 확정하지 않는다" · "중단 실패 시에는 다시 '진행 중' 상태로 복구하고 실패 원인을 표시할 수 있어야 한다" | 명세 §2 | ACTIVE | D-005 가 0143 의 "클릭 즉시 낙관 정착"(`chat-turn/index.ts:182`)을 대체한다 |
| D-006 | `중단 중` 이 영구 고착되지 않도록 main 이 `STOP_SETTLE_TIMEOUT_MS` watchdog 으로 합성 정착한다 | D-005 는 "확인될 때까지 기다린다"를 요구하고, 명세 §2 는 별도로 "GUI를 영원히 '진행 중'으로 남겨서는 안 된다"를 요구한다. 두 요구를 동시에 만족하는 유일한 구조 | 명세 §2 + 설계자 판단 | ACTIVE | — |
| D-007 | 사용자 중단은 완료 통지(`subagent_notice` 행)를 만들지 않는다 — 0143 결정을 유지한다 | "사용자 자기 행위의 통지는 소음"(`settle` 경로 주석, `chat-turn/index.ts:196`). D-005 로 추적 해제 시점이 늦어지므로 명시 게이트가 필요해졌다 | 0143 채택 결정 | ACTIVE | — |
| D-008 | `TaskList` 결과는 **전체 스냅샷**으로 취급한다 — 스냅샷에 없는 로컬 항목은 제거한다 | `TaskListOutput.tasks` 는 전체 목록이고(SDK 타입), 명세 §2 는 "실제 Claude 측 상태와 불일치하는 항목을 수정할 수 있어야 한다"를 요구한다 | SDK 타입 + 명세 §2 | ACTIVE | — |
| D-009 | `TaskUpdate(status:'deleted')`·`TaskGet(task:null)` 은 목록에서 제거한다 | 명세에 없는 SDK 상태값이다. 남겨두면 삭제된 Task 가 패널에 영구 잔류한다 | 설계자 판단 (SDK `TaskUpdateInput.status` 에 `deleted` 존재) | ACTIVE | — |
| D-010 | `TaskOutput`·`TaskStop` 은 transcript 에만 남기고 패널 상태를 바꾸지 않는다 | 명세 §2 "GUI의 background 상태를 TaskOutput 호출 여부에 의존시키지 않는다" | 명세 §2 | ACTIVE | — |
| D-011 | `waitForTask` 의 생산 소비자는 중단 확정 대기(D-005/D-006) 한 곳이다 — 주기적 `TaskOutput` polling 을 만들지 않는다 | 명세 §2 "별도의 주기적인 TaskOutput polling으로 구현하지 않는다". 소비자 없는 export 는 죽은 계약이므로 실제 경로에 붙인다 | 명세 §2 + 설계자 판단 | ACTIVE | — |
| D-012 | 이번 작업의 구현 주체는 Codex 다. Claude 는 plan 만 커밋한다 | 사용자가 "plan만 커밋 → Codex 구현"을 선택 | 사용자 턴 (AskUserQuestion) | SUPERSEDED | D-014 |
| D-014 | 이번 작업의 구현 주체는 Claude 다 — plan → impl → verify 절차는 낮추지 않는다 | 사용자가 같은 세션에서 `/handoff-impl` 을 명시 호출했다. `docs/handoff/AGENTS.md §역할 분담` 이 "사용자가 명시적으로 요청하면 Claude 가 기능 구현을 맡을 수 있으나 절차는 낮추지 않는다" 를 허용한다 | 사용자 턴 (`/handoff-impl`) | ACTIVE | D-012 를 대체 |
| D-013 | `skip_transcript` task 는 계속 드롭한다(패널에도 안 띄운다) | SDK 는 "may still appear in a tasks panel" 로 허용만 하고 명세는 요구하지 않는다. 현행 `mapTaskSystem` 드롭을 유지해 범위를 넓히지 않는다 | 설계자 판단 (SDK `SDKTaskStartedMessage.skip_transcript` 주석) | ACTIVE | — |
| D-015 | 우측 패널은 **두 타일**을 갖는다 — `subagent`(`백그라운드 작업`) 와 `task`(`작업`) | "백그라운드 작업 패널과 작업 패널이 합쳐졌는데, **패널을 분리할 것**" | 사용자 턴 (2026-08-27) | ACTIVE | D-003 을 대체 |
| D-016 | `백그라운드 작업` 타일은 `72766d2` 의 **기능·디자인을 그대로 복구**한다 — 상태 그룹 4종·3줄 카드·child transcript 상세·'대화록 보기' 우측의 중단 버튼 자리까지 | "백그라운드 작업 패널과 **기존의 기능, 디자인을 복구할 것**" · "백그라운드 패널은 **완전 복구**이다" | 사용자 턴 (2026-08-27) | ACTIVE | — |
| D-016a | 단 D-016 의 복구 대상은 **표시(디자인·정보구조)** 다 — 중단 수명주기는 D-005·D-006(`중단 중` → SDK 확정)을 유지한다 | D-005 는 명세 §2 "즉시 '중단됨'으로 확정하지 않는다" 에서 온 ACTIVE 결정이고 사용자가 이번 턴에 철회하지 않았다. Ledger 규칙 — 최신 턴에 언급되지 않았다는 이유로 삭제하지 않는다 | 설계자 판단 + D-005 승계 | ACTIVE | — |
| D-017 | `작업` 타일 내용은 cowork 우측 패널 양식을 따른다 — **한 카드 안에 접히는 3섹션**(`진행 상황` · `출력` · `컨텍스트`), 각 섹션은 제목 + chevron | "새로운 패널의 cowork의 스타일을 따라갈것" + 첨부 이미지(claude.ai/cowork 우측 패널) · 사용자 선택 "`작업` 타일 안에 3섹션" | 사용자 턴 + 첨부 (2026-08-27) | ACTIVE | — |
| D-018 | `진행 상황` 섹션은 **상태 그룹 헤더 없이** id 오름차순 단일 목록이고, 완료 항목은 제자리에서 **취소선**(+ ✓)으로 표시한다 | "작업 나열 방식을 id 로 순자적으로 나열하고 다 된 작업은 스트라이크 표시를 추가로 할 것" · 사용자 선택 "그룹 제거 + id 단일 목록" | 사용자 턴 (2026-08-27) | ACTIVE | verify r1 D5(그룹 내 순번)를 함께 닫는다 |
| D-019 | `진행 상황` 목록은 TaskXXX(할 일)와 background 실행 태스크를 **함께** 나열하고, background 행에만 중단 버튼이 붙는다 | "Taskoutput 이 백그라운드작업으로 출력을 검색한다. 그리고 taskstop 도구도 있다 code.claude.com/docs/en/tools-reference 참고할것" — Task 도구군은 두 네임스페이스를 모두 포함한다. **분리(D-015)의 의미는 background 전용 상세(대화록)를 갖는 타일을 되살리는 것**이다 | 사용자 턴 (2026-08-27) + SDK 실측(§7-B 조사) | ACTIVE | — |
| D-020 | background 행의 중단 버튼은 **제목 텍스트 바로 오른쪽**에 붙는다 — 행 우측 끝 정렬이 아니다 | "중단 아이콘이 우측에 얼라인 되어있는데 타이틀 우측에 나열할 것" | 사용자 턴 (2026-08-27) | ACTIVE | — |
| D-021 | 타일 정의는 4종을 유지한다 — `plan` · `subagent` · `task` · `reserved1`. `reserved2` 를 `task` 가 대체한다 | 사용자 선택 "4종 — 예약 2 를 대체" | 사용자 턴 (AskUserQuestion) | ACTIVE | — |
| D-022 | 이번 라운드에 `출력`·`컨텍스트` 섹션은 **빈 상태만** 만든다 — 일러스트 + 설명문이고 parts 파생 코드를 두지 않는다 | 사용자 선택 "진행 상황만 — 나머지는 빈 상태". 첨부 이미지 자체가 세 섹션의 빈 상태다. 두 섹션 충전은 다음 handoff | 사용자 턴 (AskUserQuestion) | ACTIVE | — |
| D-023 | `isAbortedResult` 는 권위 필드 `reason` 이 있으면 **그것만** 본다 — 메시지 부분문자열은 `reason` 이 없을 때의 폴백이다 | verify r1 D1 — `reason:'failed'` + 메시지에 '중단' 인 채널 종료 정착이 패널에서 `중단됨` 으로 읽히고 행 문구가 `사용자에 의해 중단됨` 이라 원인을 거짓 진술했다(AC21 위반) | verify r1 (`337a696`) | ACTIVE | — |
| D-024 | 실패로 정착한 background 행은 **정착 사유 문구를 그대로** 보인다 — `aborted` 분기와 대칭 | verify r1 D4 · 명세 §2 가 `실행 세션 종료` 표시를 요구한다. 사유는 `result.output.message`(`subagent-settlement.ts:28` — `ev.summary` 를 싣는다)에 이미 있다 | verify r1 | ACTIVE | — |
| D-025 | 미배선 표면 4종을 **제거**한다 — `taskBoardSettledKeys` · `isBackgroundTask` · `MARK_SETTLED_TASKS` · `TASK_STOP_SETTLED` | verify r1 D2. `taskBoardSettledKeys` 는 배지 판정 규칙이 실제 경로(reducer)와 달라 SSOT drift 이기도 하다. 실제 배지·중단 해제는 reducer 의 이벤트 경로가 수행하므로 배선이 아니라 제거가 맞다 | verify r1 | ACTIVE | — |
| D-026 | `docs/IPC_CONTRACT.md` 의 코드 파생 수치·열거를 정정한다 — ① `tool.call.completed` 필드 목록에 `structuredOutput` 추가 ② `MockScenarioId` **13종** 열거를 코드 정본 포인터로 교체 | 0204 구현이 만든 문서 드리프트 2건이고 verify r1 이 못 잡았다(문서 게이트 정규식이 이 형태를 세지 않는다 — `check-doc-inventory.mjs` 추적 항목 9종에 mock 시나리오가 없다). root `AGENTS.md` 원칙 4 = 셀 수 있는 수치를 문서에 적지 않는다 | 이번 턴 실측 | ACTIVE | — |
| D-027 | 섹션 접힘 상태는 `TaskTileContent` 의 **로컬 `useState`** 다 — reducer 에 두지 않는다 | 외부에서 섹션을 여닫는 소비자가 없다(transcript 행은 타일과 항목을 열지 섹션을 열지 않는다). 세션별 `ChatState` 에 넣으면 표시 취향이 세션마다 갈라진다 | 설계자 판단 | ACTIVE | — |
| D-028 | `blocks` 를 `AgentTaskPatch` 와 파서에서 **제거**한다 | 소비처 0 + **`TaskListOutput` 에 없어 전체 스냅샷이 보정 불가** → 저장하면 드리프트 확정. `blockedBy` 의 역방향이라 정보 손실 0 | 사용자 질의 파생 G1 + SDK 실측(§7-C) | ACTIVE | — |
| D-029 | 의존 간선은 두 의미를 분리한다 — `blockedBy`(Get/List) = 전체 교체, `addBlockedBy`(Update) = **가산 병합** | SDK 가 `add-` 접두로 이미 가른다. 한 필드에 담으면 `TaskUpdate` 한 번이 기존 간선을 지운다 | G2 + `TaskUpdateInput` | ACTIVE | — |
| D-030 | `updatedFields` 게이트는 `addBlockedBy`·`blockedBy` 두 이름을 **모두** 허용한다 | SDK 가 어느 이름을 싣는지 문서화하지 않았다. 놓치면 의존이 화면에서 사라지는 false negative 가 더 나쁘다 — **미실측 불확실성** | 설계자 판단 | ACTIVE | — |
| D-031 | 목록 **순서는 의존이 아니다** — id 순은 관측 순이고 의존은 `blockedBy` 만 말한다 | "완료후 추가 태스크들이 생기면 앞의 것과 의존이 없어야 해서 그렇다" | 사용자 턴 (2026-08-27) | ACTIVE | D-018 을 보완(대체 아님) |

### 갱신 메모

- **ΔV2 갱신(2026-08-27)**: 신규 **D-028 ~ D-031**. SUPERSEDED **0** — ΔV1 의 D-018(id 순 나열)은 그대로이고 **D-031 이 그 순서에 의존 의미가 없음을 명시**해 보완한다. 출처는 verify 가 아니라 사용자 질의다.
- **ΔV2 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-028↔AT-34③(`blocks` 미저장, 양성 짝 동반) · D-029↔AT-34①②(가산 vs 교체) · **D-031 ↔ AT-10a 비충돌**(AT-10a 는 *순서*만 단언하고 의존을 단언하지 않는다) · **D-008 ↔ AT-34② 비충돌**(스냅샷 전체 교체가 가산 병합을 덮는 것이 설계다) — 반대를 요구하는 AC 0건.
- **ΔV1 갱신(2026-08-27)**: 신규 **D-015 ~ D-027**. SUPERSEDED **1건 — D-003**(단일 타일 통합 → 두 타일 분리). D-001·D-002·D-004~D-011·D-013·D-014 는 **문장 그대로 유지**된다 — 사용자가 바꾼 것은 *패널 구성*이지 관측 범위·fold 방식·통지 수단·중단 수명주기가 아니다.
- **ΔV1 `ACTIVE 결정 ↔ AC` 대조: 충돌 0.** 확인한 쌍 — D-015↔AT-09a(두 타일이 서로 다른 집합을 낸다) · D-016↔AT-28(복구 대상은 정보구조) · **D-016a↔AT-12/13/15 비충돌**(복구가 `중단 중` 을 되돌리지 않는다, 두 문장이 서로 다른 축) · D-018↔AT-10a(그룹 배열이 아니라 단일 순서 배열) · D-019↔AT-09a(진행 상황이 두 종류를 갖는다) · D-020↔AT-27 · D-022↔AT-29(빈 상태 + 파생 0건) · D-023↔AT-21(권위 필드 우선) · D-025↔AT-32 · **D-010 ↔ AT-32 비충돌**(제거 대상 4종에 `TaskOutput` 관측 경로가 없다) — **반대를 요구하는 AC 0건**.
- **D-019 는 D-015 를 좁히지 않는다**: 두 타일이 background 를 함께 보이되 *책임*이 다르다 — `백그라운드 작업` = 전용 상세(child transcript·프롬프트·StatusLine), `작업` = 한 줄 진행 요약. 같은 항목이 두 곳에 *렌더*되지만 파생 SSOT 는 `taskBoard.ts` 하나다(§10 EP-14).
- 이번 턴에서 새로 추가된 결정: D-001 ~ D-013 (신규 handoff).
- 변경된 결정: D-005 가 0143 의 낙관 정착을 대체한다 — 사용자 명세가 `중단 중` 중간 상태를 명시 요구했다.
- 변경된 결정(구현 턴 직전): D-012 → **D-014** — 사용자가 `/handoff-impl` 을 명시 호출해 구현 주체가 Claude 로 바뀌었다. AC·V node/pair·§10 은 불변이다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0143 의 "사용자 중단은 통지 없음"(D-007 로 명시 승계), 0136 의 "채널 사망 시 합성 failed 정착"(§8 에서 이미 충족으로 판정).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. 확인한 쌍 — D-004("패널 내 표시만") ↔ AC19("타일 칩 미확인 배지, OS 알림 호출 0건") → 일치 · D-005("즉시 확정 금지") ↔ AC12/AC13 → 일치 · D-007("사용자 중단 통지 없음") ↔ AC17 → 일치 · D-010("TaskOutput 의존 금지") ↔ AC23 → 일치 · D-002("main Task 스토어 없음") ↔ AC18(재로드 후 동일 상태를 parts fold 로 달성) → 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | `rg "TaskCreate\|TaskUpdate\|TaskList\|TaskGet" app/src` → **0건**. 6개 도구를 인식하는 코드가 저장소에 없다 |
| 이미 기존 코드가 충족하는가 — background 부분 | **상당 부분 충족** | background listen(`app/src/main/app/chat-turn/post-turn.ts:75`) · 세션별 라우팅(`chatStore.ts:373` 주석 "비활성 세션의 턴도 백그라운드로 누적") · 개별 stop UI(`SubAgentTileContent.tsx:222`) · 진행 메타(`claude-map.ts:69` `mapTaskSystem`) |
| 이미 기존 코드가 충족하는가 — 채널 종료 처리 | **충족** | `chat-turn/index.ts:66` `settleDeadBackgroundTasks` 가 `status:'failed'` + `summary:'채널이 종료되어 서브에이전트가 중단되었습니다.'` 로 정착한다. 명세의 "실행 세션 종료"와 문언만 다르다 |
| 이미 기존 코드가 충족하는가 — 일반 Task 부분 | **미충족** | 위 0건. `TaskCreateOutput.task.id` 를 읽는 경로가 없고 `tool.call.completed.result` 는 모델용 wire content 다(`claude-map.ts:354`) |
| 더 작은 해법이 있는가 | 있다 — 채택 | main 에 Task 스토어를 만들지 않고 renderer 순수 fold 로 파생한다(D-002). 새 IPC 채널 0개·새 DB 마이그레이션 0개 |
| 선행 자료의 주장을 코드와 대조했는가 | 했다 | 명세의 "background task를 GUI에서 중단할 수 없다"는 **틀렸다** — `CHANNELS.chatStopSubagent`(`app/src/shared/ipc.ts:16`)와 우측 패널 중단 버튼이 이미 있다. 그래서 이번 범위는 `중단 중` 중간 상태(D-005)와 통합 목록(D-003)이다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 1건 충돌 → 대체 처리 | 0143 낙관 정착(`chat-turn/index.ts:182` 주석) ↔ 명세 §2 `중단 중`. D-005 로 supersede |

- 사용자에게 올릴 결정: **없음** — 세 건(패널 구성·완료 통지 수단·구현 주체)은 이번 턴에 물어 D-003·D-004·D-012 로 확정했다.
- 코드 조사로 닫은 사실: SDK 6개 도구의 입력/출력 타입(§8), `tool_use_result` 가 구조화 출력의 유일한 출처(§8), 우측 패널 타일 상태가 DB 미영속(§8), 새 IPC 채널·마이그레이션 불필요(§8).
- **명세보다 좁아진 지점(사용자 확정)**: 명세 §2·§3 은 "완료 notification 을 발생시킨다"를 요구하지만 D-004 는 패널 내 표시로 좁혔다. 창이 활성인 채 다른 세션을 보는 사용자는 배지로만 알게 된다.

## 5. 동작 / 사용자 흐름

```text
[에이전트가 TaskCreate 호출]
  → tool_use 관측(아직 항목 없음)
  → tool_result 성공 관측 → 작업 타일 '대기 중'에 항목 추가
  ↘ tool_result 실패 → 항목 미생성

[에이전트가 TaskUpdate(status) 호출]
  → 성공 결과 관측 → 같은 항목이 그룹 이동(중복 생성 없음)
  ↘ success:false → 무변화

[background Task 시작(task_started)]
  → '진행 중' 그룹에 background 배지 + 경과 + 도구수
  → task_progress 반복 → 같은 카드 갱신(메인 턴 종료 후에도)
  → task_notification → 완료/실패/중단됨 확정

[사용자가 [■] 클릭]
  → '중단 중' 표시(즉시 확정 아님)
  → SDK stopped 확인 → '중단됨' + 사유
  ↘ 중단 요청 거절 → '진행 중' 복구 + 실패 사유
  ↘ 확인 무응답 → watchdog 이 합성 정착(고착 없음)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| `TaskCreate` tool_use 만 관측 | Task id 미확정 → 등록하지 않음 | 목록 무변화 |
| `TaskCreate` 성공 tool_result | `task.id`/`task.subject` + 입력 `description` 으로 항목 생성 | `대기 중` 그룹에 `○ <subject>` |
| `TaskUpdate` 성공(`statusChange.to`) | 같은 id 항목의 상태 교체 | `진행 중`/`완료` 그룹으로 이동 |
| `TaskUpdate` 성공(subject/description) | 제목·설명 교체 | 라벨/상세 갱신 |
| `TaskUpdate` `status:'deleted'` 성공 | 항목 제거 (D-009) | 목록에서 사라짐 |
| `TaskUpdate` `success:false` | 무시 | 무변화 |
| `TaskList` 결과 | 스냅샷으로 보정 — 상태 교체 · 미지 id 추가 · 스냅샷 부재 id 제거 (D-008) | 목록이 Claude 측 상태와 일치 |
| `TaskGet` 결과 `task:null` | 그 id 제거 | 목록에서 사라짐 |
| `task_started` | 기존 경로가 background 항목 생성 | `진행 중`에 `● <description> · background · mm:ss` |
| `task_progress` | 같은 항목 갱신(카드 1개) | 경과·최근 작업·도구수 갱신 |
| 메인 턴 result 이후 background 잔존 | listen 턴 유지(기존 0136/0143) | 갱신이 계속 보인다 |
| `[■]` 클릭 | main 이 stop 요청 + 확정 대기 | `중단 중` |
| `task_notification(stopped)` | 부모/child 를 `stopped` 로 정착 | `중단됨` + `사용자에 의해 중단됨` |
| stop 요청 거절(IPC reject) | renderer 가 `중단 중` 해제 | `진행 중` 복구 + 실패 사유 |
| watchdog timeout | main 이 합성 `stopped` 정착 (D-006) | `중단됨` (고착 없음) |
| 채널 종료 | 기존 `settleDeadBackgroundTasks` | `실패` + 사유 문구 |
| 세션 전환 | 이벤트가 `sessionId` 키 엔트리로 누적 | 다른 세션 Task 는 안 보이고, 돌아오면 최종 상태가 보인다 |
| 완료 발생 시 타일이 닫혀 있음 | 미확인 완료 카운트 증가 (D-004) | 타일 칩에 배지, 열면 해제 |

### 파생 UX / 엣지케이스

- loading / empty / error: 항목 0건이면 기존 빈 상태 문구를 `작업` 문맥으로 교체한다. 결과 파싱 실패는 항목을 만들지 않고 조용히 무시한다(패널이 거짓 항목을 만들지 않는다).
- cancel / retry / close / restart: 중단은 D-005/D-006. 타일을 닫으면 선택 상태를 비운다(기존 `REMOVE_RIGHT_PANEL_TILE` 동작 승계).
- concurrency / multi-session: 항목 키는 `agent:<taskId>` / `bg:<toolUseId>` 로 분리해 두 네임스페이스가 충돌하지 않는다.
- keyboard / a11y / theme: 카드는 기존 `role="button"` + Enter/Space 계약을 그대로 쓴다. 색은 시맨틱 토큰만 쓴다(`renderer/AGENTS.md §스타일`).
- 외부환경/오프라인/폐쇄망: 해당 없음 — 네트워크 호출을 추가하지 않는다.

## 6. 범위 / 비범위

- **범위**: 6개 Task 도구 결과 관측 → 우측 `작업` 타일(통합 목록 + 상세) · `중단 중` 중간 상태와 watchdog · 미확인 완료 배지 · `waitForTask` · mock 시나리오 1종.
- **비범위**: 범용 Task 모델/타 SDK 대응(D-001) · OS 알림 게이트 변경·in-app 토스트(D-004) · `TodoWrite` 대응 · `skip_transcript` task 표시(D-013) · GUI 에서 **일반** Task 를 생성/편집/중단하는 기능(명세는 관찰과 background 중단만 요구) · `background_tasks_changed` level 신호 채택.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| in-app 토스트 통지 | 아니오 — 새 UI 표면이라 언제 넣어도 비용이 같다 | 후속 (D-004) |
| `background_tasks_changed` 로 membership 보정 | 아니오 — 기존 edge 추적이 이미 정착 경로를 갖는다 | 후속 |
| 일반 Task 의 GUI 편집/중단 | 아니오 — 새 도구 호출 경로라 독립 | 후속 |
| 타일 id `subagent` → `task` 개명 | **아니오** — 타일 상태는 DB 미영속(`chatReducer.ts:222` `rightPanelTiles: []`)이라 마이그레이션 비용 0 | 지금 (D-003) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `TaskCreate` 성공 결과 관측 후에만 항목이 생긴다 | `taskBoard` UT — tool_call 만 있는 parts → 항목 0건, 성공 tool_result 추가 → `대기 중` 1건 | SDK user(tool_result) → `claude-map` → parts → `taskBoardFromMessages` → 타일 |
| R-01 | AT-02 / AC2 | `TaskCreate` 실패는 항목을 만들지 않는다 | UT — `isError:true` parts → 항목 0건 | 같은 경로 |
| R-02 | AT-03 / AC3 | `TaskUpdate(in_progress)` 성공은 같은 항목을 이동시키고 중복을 만들지 않는다 | UT — create+update 2회 fold → 항목 1건, `status==='in_progress'` | 같은 경로 |
| R-02 | AT-04 / AC4 | `TaskUpdate` 의 `subject`/`description` 변경이 반영된다 | UT — `updatedFields:['subject']` + args.subject → 제목 교체 | 같은 경로 |
| R-02 | AT-05 / AC5 | `status:'deleted'` 성공은 항목을 제거한다 | UT — 항목 0건 | 같은 경로 |
| R-02 | AT-06 / AC6 | `success:false` 는 무변화 | UT — 상태가 update 이전과 동일 | 같은 경로 |
| R-03 | AT-07 / AC7 | `TaskList` 스냅샷이 상태 교체·신규 추가·부재 제거를 모두 수행한다 | UT — 로컬 {1:in_progress,2:pending,9:pending} + 스냅샷 {1:completed,2:in_progress,3:pending} → 결과 {1:completed,2:in_progress,3:pending}, id `9` 부재 | 같은 경로 |
| R-03 | AT-08 / AC8 | `TaskGet` 은 그 id 만 갱신하고 `task:null` 은 제거한다 | UT — 두 케이스 각각 | 같은 경로 |
| R-04 | AT-09 / AC9 | background 항목만 `background` 배지·경과·도구수를 갖고 일반 Task 행은 갖지 않는다 | UT — 혼합 parts fold → `kind:'background'` 행만 `background` 필드 존재 | `subagent.task` → transient meta + parts → 같은 fold |
| R-04 | AT-10 / AC10 | 그룹 순서 `진행 중 → 대기 중 → 완료 → 중단됨 → 실패`, 빈 그룹 미렌더 | UT — 5종 혼합 입력의 그룹 배열이 정확히 이 순서, 항목 없는 그룹 부재 | 타일 렌더 |
| R-05 | AT-11 / AC11 | 메인 턴 종료 후 도착한 `task_progress` 가 같은 카드를 갱신한다(카드 수 불변) | 기존 listen 경로 IT + UT — progress 3회 후 항목 1건, 마지막 값 반영 | `post-turn.ts` listen 턴 → `subagent.task` → store |
| R-06 | AT-12 / AC12 | 중단 클릭 직후 표시는 `중단 중` 이다 | UT — `stopping` 집합에 든 항목의 파생 상태가 `stopping` | 타일 `[■]` → `chatActions.stopTask` |
| R-06 | AT-13 / AC13 | SDK `stopped` 확인 후 `중단됨` + 사유가 보인다 | UT(파생) + main IT — 정착 이벤트 후 `aborted` | `chatStopSubagent` → SDK → `settleSubagentTask` |
| R-06 | AT-14 / AC14 | 중단 요청이 거절되면 `진행 중` 으로 복구되고 사유가 보인다 | 스토어 UT — reject 시 `stopping` 해제 + `stopError` 설정 | `chatApi.stopSubagent` reject |
| R-06 | AT-15 / AC15 | 확정이 오지 않아도 `중단 중` 이 고착되지 않는다 | main UT — fake timer 로 `STOP_SETTLE_TIMEOUT_MS` 경과 → 합성 settled 1건 방출 | watchdog |
| R-06 | AT-16 / AC16 | 개별 중단이 turn 전체를 중단하지 않는다 | main UT — `abortTurn` 미호출, 다른 열린 도구의 정착 이벤트 0건 | `chatStopSubagent` 핸들러 |
| R-06 | AT-17 / AC17 | 사용자 중단에서 완료 통지 파트가 생기지 않는다 | main UT — `stoppedSubagents` 에 든 toolUseId 의 settled 는 `background` 미부여 → `subagent_notice` 0건 | coordinator enrich |
| R-07 | AT-18 / AC18 | 완료·실패·중단 최종 상태가 재로드 후에도 같다 | UT — 영속 parts(구조화 출력 포함)만으로 fold 한 결과가 라이브 결과와 동일 | writer 영속 → `LoadedSession` → fold |
| R-07 | AT-19 / AC19 | 완료 발생 시 타일 칩에 미확인 배지가 뜨고 열면 해제된다. OS 알림 호출은 0건 | 스토어 UT — 배지 카운트 증가/0 복귀 · `rg "notifyApi" <새 파일들>` → 0건 | `ChatTitleBar` 칩 |
| R-08 | AT-20 / AC20 | 세션 A 의 Task 는 세션 B 패널에 없고, A 로 돌아오면 완료 상태가 보인다 | UT — 두 엔트리 fold 결과가 서로 배타 · 사람 실기(2세션) | `chatStore` sessionId 라우팅 |
| R-08 | AT-21 / AC21 | 채널 종료 시 background 항목이 `실패` 로 정착한다(`진행 중` 고착 없음) | 기존 `settleDeadBackgroundTasks` 회귀 UT + 파생 UT | `post-turn.ts:73` |
| R-09 | AT-22 / AC22 | `waitForTask` 는 completed/failed/stopped 어느 것으로든 resolve 하고 polling 을 하지 않는다 | UT — 3 케이스 resolve · `rg "TaskOutput" app/src/main` → 0건 | `background-tasks.ts` |
| R-09 | AT-23 / AC23 | `TaskOutput`/`TaskStop` tool call 은 transcript 에 남고 패널 상태를 바꾸지 않는다 | UT — 두 도구만 있는 parts fold → 항목 0건, transcript 세그먼트에는 존재 | 같은 fold |
| R-10 | AT-24 / AC24 | 상세가 종류별로 다른 정보를 보여준다 — 일반=상태/설명/의존성, background=상태/경과/최근 작업/도구 사용/출력/중단 | UT(상세 뷰모델 파생) + 사람 실기(시각) | 타일 상세 |
| R-10 | AT-25 / AC25 | 시각이 첨부 양식을 따르고 raw hex 를 쓰지 않는다 | `rg "#[0-9a-fA-F]{3,6}" <새 tsx 파일들>` → 0건 + 사람 실기(시각) | 타일 렌더 |

### AC 검증 주의사항

- 기존 테스트 재사용: `app/src/main/features/chat/background-tasks.test.ts` 에 `영수증이 task_started 보다 먼저 와도(순서 역전) 등록 + 관측을 기록한다` 케이스가 실재한다(`:56`) — `waitForTask` UT 를 같은 파일에 붙인다. `chatReducer.listen.test.ts` 의 `settled + background:true 는 subagent_notice 파트로 물질화된다`(`:172`)가 AC17 의 회귀 대상이다.
- 사람 실기 항목: AC25 시각과 AC20 의 2세션 조작만. 목록 포함 여부·그룹 순서·상태 파생은 전부 순수 fold UT 로 내렸다.
- N회/총량 기준: AC19 의 `OS 알림 호출 0건` 은 **이번에 추가한 파일들**로 분모를 좁힌다 — 기존 `useCompletionNotifier.ts:25` 의 호출 1건은 이번 변경 대상이 아니며 제거 대상도 아니다. 검색 명령은 새 파일 목록(§18)에 한정한다.
- 총량/0건 기준: AC22 의 `rg "TaskOutput" app/src/main` → 0건은 "main 이 polling 하지 않는다"의 음성 게이트다. 양성 짝은 AC22 의 3개 resolve 케이스가 갖는다(§5 방향 규칙 — polling 코드를 지워도 resolve 테스트는 계속 참이어야 한다).
- AC25 의 raw hex 0건 역시 음성 게이트다. 양성 짝은 AC10(그룹 순서 UT)과 사람 실기 시각 확인이다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 0136·0143·0034 는 V 규약 도입 이전 handoff 라 상속할 명시 node 가 없다(`docs/handoff/AGENTS.md §신규 템플릿 적용 경계`).
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음 — R 부터 MD 까지 전 층을 새로 만든다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 TaskCreate 관측 | NEW | — |
| R-02 | R | §7 TaskUpdate 관측 | NEW | — |
| R-03 | R | §7 TaskList/TaskGet 보정 | NEW | — |
| R-04 | R | §7 통합 목록·그룹 | NEW | — |
| R-05 | R | §7 턴-후 진행 갱신 | NEW | — |
| R-06 | R | §7 중단 중 → 확정/복구 | NEW | — |
| R-07 | R | §7 최종 상태 일치·완료 배지 | NEW | — |
| R-08 | R | §7 세션 귀속·채널 종료 | NEW | — |
| R-09 | R | §7 waitForTask·polling 금지 | NEW | — |
| R-10 | R | §7 상세·시각 | NEW | — |
| AT-01…AT-25 | AT | §7 각 행 | NEW | — |
| SD-01 | SD | §5·§9 관측 → 패널 end-to-end 수명주기 | NEW | — |
| SD-02 | SD | §5·§13 중단 수명주기(요청→중단 중→확정/복구/watchdog) | NEW | — |
| SD-03 | SD | §5·§12 세션별 귀속과 재로드 복원 | NEW | — |
| ST-01…ST-03 | ST | §7 AT-11·AT-13/15·AT-18/20 | NEW | — |
| AR-01 | AR | §9·§10 `tool.call.completed.structuredOutput` producer/consumer 계약 | NEW | — |
| AR-02 | AR | §9·§10 `작업` 타일 조립(레지스트리·선택 키) | NEW | — |
| AR-03 | AR | §10 stop 경로 배선(핸들러 ↔ tracker ↔ coordinator enrich) | NEW | — |
| IT-01…IT-03 | IT | §7 AT-18·AT-09/10·AT-17 | NEW | — |
| MD-01 | MD | §11 `shared/task-tool.ts` 결과 파서 불변식 | NEW | — |
| MD-02 | MD | §11 `taskBoard.ts` fold 불변식 | NEW | — |
| MD-03 | MD | §11 `BackgroundTaskTracker.waitForTask` 불변식 | NEW | — |
| UT-01…UT-03 | UT | §7 AT-01~08/23 · AT-09/10/12 · AT-22 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01/02 | REQUIRED | SDK user(tool_result) → `claude-map` → `tool.call.completed` → parts → `taskBoardFromMessages` → 타일 | 항목 수·상태 단언 UT | not selected — 항목 존재/부재를 직접 관측 | EP-01 (1) |
| VP-02 | R-02 ↔ AT-03/04/05/06 | REQUIRED | 같은 경로 | 같은 id 항목 1건 + 필드 단언 UT | not selected — 직접 관측 | EP-02 (1) |
| VP-03 | R-03 ↔ AT-07/08 | REQUIRED | 같은 경로 | 스냅샷 전후 id 집합 차집합 단언 UT | not selected — 집합 차이를 직접 관측 | EP-03 (1) |
| VP-04 | R-04 ↔ AT-09/10 | REQUIRED | `subagent.task` + parts → 같은 fold → 그룹 배열 | 그룹 순서 배열 동등 단언 UT | not selected — 배열을 직접 관측 | EP-04 (1) |
| VP-05 | R-05 ↔ AT-11 | REQUIRED | `post-turn.ts` listen → `subagent.task(progress)` → store transient → 타일 | 항목 수 불변 + 최신 값 단언 | not selected — 직접 관측 | EP-05 (2) |
| VP-06 | R-06 ↔ AT-12/13/14/15/16/17 | REQUIRED | 타일 `[■]` → `chatStopSubagent` → `stopLiveSubagent` → `waitForTask`/watchdog → 정착 → 타일 | 상태 문자열 전이 단언 + 합성 이벤트 1건 단언 | **required** — AT-17 은 "통지가 **없다**"라 0건 단언이다. `stoppedSubagents` 게이트를 지우는 변이를 심어 `subagent_notice` 1건이 나오는지 확인한다 | EP-06 (3) |
| VP-07 | R-07 ↔ AT-18/19 | REQUIRED | writer 영속 → `LoadedSession` → fold / 완료 관측 → 배지 | 영속 parts 만으로 fold 한 결과 동등 단언 · 배지 카운트 단언 | not selected — 결과 동등을 직접 관측 | EP-07 (2) |
| VP-08 | R-08 ↔ AT-20/21 | REQUIRED | `chatStore.receive` sessionId 라우팅 / `settleDeadBackgroundTasks` | 두 엔트리 항목 집합 배타 단언 · 정착 상태 단언 | not selected — 직접 관측 | EP-08 (1) |
| VP-09 | R-09 ↔ AT-22/23 | REQUIRED | `chatStopSubagent` → `waitForTask` → resolve | 3 종료 상태 각각 resolve 단언 | not selected — resolve 를 직접 관측(0건 스윕은 보조) | EP-09 (1) |
| VP-10 | R-10 ↔ AT-24/25 | REQUIRED | 타일 상세 렌더 | 상세 뷰모델 필드 단언 UT + 사람 실기 | not selected — 뷰모델을 직접 관측 | EP-10 (1) |
| VP-11 | SD-01 ↔ ST-01(AT-11) | REQUIRED | 위 VP-05 경로 전체 | 턴 종료 이후 프레임에서도 갱신 도달 | not selected | EP-05 (2) |
| VP-12 | SD-02 ↔ ST-02(AT-13/15) | REQUIRED | 위 VP-06 경로 전체 | 확정/watchdog 두 종단 상태 단언 | not selected | EP-06 (3) |
| VP-13 | SD-03 ↔ ST-03(AT-18/20) | REQUIRED | 위 VP-07/08 경로 | 재로드·세션 전환 후 상태 동등 | not selected | EP-07 (2) |
| VP-14 | AR-01 ↔ IT-01(AT-18) | REQUIRED | `claude-map` → 이벤트 → writer → DB payload → 로드 → fold | 구조화 출력이 영속되고 되읽힌다는 왕복 단언 | not selected | EP-01 (1) |
| VP-15 | AR-02 ↔ IT-02(AT-09/10) | REQUIRED | `tileRegistry` → `RightPanelTile` → 타일 콘텐츠 | 레지스트리 id 로 콘텐츠가 해석된다는 단언 | not selected | EP-11 (1) |
| VP-16 | AR-03 ↔ IT-03(AT-17) | REQUIRED | 핸들러 → tracker → coordinator enrich → store | enrich 가 stopped 태스크에 background 를 안 싣는다는 단언 | **required** — VP-06 과 같은 0건 주장 | EP-06 (3) |
| VP-17 | MD-01 ↔ UT-01(AT-01~08/23) | REQUIRED | `shared/task-tool.ts` 순수 파서 | 도구별 입력→관측 매핑 단언 | not selected | EP-01·EP-02·EP-03 (3) |
| VP-18 | MD-02 ↔ UT-02(AT-09/10/12) | REQUIRED | `taskBoard.ts` 순수 fold | 그룹·키·stopping 파생 단언 | not selected | EP-04 (1) |
| VP-19 | MD-03 ↔ UT-03(AT-22) | REQUIRED | `background-tasks.ts` | resolve/timeout/이미-정착 3 케이스 | not selected | EP-09 (1) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app/**` 정적 게이트 | main·renderer·shared 를 모두 고친다 | `cd app && npm run lint && npm run typecheck` (`app/AGENTS.md §better-sqlite3 ABI` — ABI 중립) | 이번 변경이 유발한 error 만 blocking |
| renderer/main 경계 | 새 파일이 `features/chat` · `src/shared` 에 생긴다 | `npm run lint` 의 `boundaries/dependencies` · `import/no-cycle` | 같음 |
| 비-DB vitest | 새 순수 모듈 3종 + 기존 chat 스위트 회귀 | `./node_modules/.bin/vitest run src/shared src/main/features/chat src/main/adapters src/renderer/src/features/chat` | 같음. better-sqlite3 ABI 차단 환경의 DB 로드 스위트 실패는 기준선으로 분리 보고 |
| 문서 인벤토리 | `shared/ipc.ts` 를 고치므로 채널/variant 수가 바뀌었는지 확인해야 한다 | `node app/scripts/check-doc-inventory.mjs --check` | 수치 변동 시 생성물 갱신 누락만 blocking |

> 이번 설계는 새 IPC 채널 0개·새 `NormalizedEvent` variant 0개·새 마이그레이션 0개다(§8) — 인벤토리 수치는 불변이어야 하고, 바뀌었다면 설계와 다르게 구현된 것이다.

---

## 7-B. ΔV1 — 패널 분리 · cowork 3섹션 · verify r1 파생 이슈

> **적용 순서: `V1` → `ΔV1`.** 두 출처가 합류한다 — ① 사용자 제품 결정 변경(D-003 supersede), ② verify r1(`337a696`)의 파생 이슈 D1·D2·D4·D5. 구 행은 §7·§7-A·§10 에 그대로 두고 여기서 `SUPERSEDED` 로 가리킨다.

| 출처 | 진단 | ΔV1 의 답 |
|---|---|---|
| 사용자 턴 | D-003(단일 타일 통합)이 사용자가 원한 결과가 아니었다 — background 전용 상세를 잃었다 | D-015·D-016 — 두 타일. `subagent` 복구 + `task` 신설 |
| 사용자 턴 + 첨부 | `작업` 타일의 시각 정본이 "첨부 양식"(AC25)이라는 이름뿐이었다 | D-017 — cowork 우측 패널의 **3섹션 아코디언**으로 형태를 고정. AT-29 가 섹션 존재를 잠근다 |
| 사용자 턴 | 상태 그룹 나열이 요구와 다르다 | D-018 — 그룹 제거, id 단일 순서. `taskBoardGroups` 는 `작업` 타일에서 소비자를 잃는다 |
| verify r1 **D1** | `reason:'failed'` 정착이 `aborted` 로 읽힌다(AC21 위반) | D-023 — `isAbortedResult` 가 권위 필드 우선. **MD-04/UT-04 신설** — V1 에 파서 불변식 노드가 없어 AC21 이 UT pair 없이 AT 만 갖고 있었다 |
| verify r1 **D2** | 미배선 표면 4종 + SSOT drift | D-025 — 제거. AT-32 가 음성+양성 짝으로 잠근다 |
| verify r1 **D4** | 실패 행에만 사유가 없다 | D-024 — `aborted` 분기와 대칭. AT-31 |
| verify r1 **D5** | 번호가 그룹 내 순번 | D-018 이 흡수 — 번호는 **task id** 다 |
| verify r1 **D3** | 구현 보고 합계 18 ≠ 내역 19 | 규범 행 변경 없음 — §10 EP-07 분모를 **3** 으로 정정(아래 표) |
| 이번 턴 실측 | `IPC_CONTRACT.md` 문서 드리프트 2건 | D-026 — AT-33 |

### ΔV1 조사 — 이번 턴 실측

| 대상 | 검색 / 출처 | N | 의미 |
|---|---|---|---|
| `TaskStop` 이 무엇을 멈추는가 | SDK 0.3.220 `sdk-tools.d.ts:702` `TaskStopInput.task_id` = "The ID of the **background task** to stop" + [tools-reference](https://code.claude.com/docs/en/tools-reference) | 1 | background 전용. D-019 의 근거이고, 일반 Task(`taskId` camelCase)에는 중단 op 이 없다 |
| 일반 Task 상태 어휘 | `sdk-tools.d.ts:2509` `TaskUpdateInput.status` | 4 | `pending`·`in_progress`·`completed`·`deleted` — 중단·실패 상태가 없다. `진행 상황` 섹션의 아이콘 분기가 이 4종 + background 5종을 덮는다 |
| `TaskCreateOutput.task` 필드 | `sdk-tools.d.ts:3602` | 2 | `id`·`subject` 뿐 — `activeForm` 은 출력에 없다. 진행 중 라벨은 `subject` 를 쓴다 |
| `reason:'failed'` + '중단' 메시지 조합 | `rg "message: '[^']*중단\|summary: '[^']*중단" app/src/main`(비테스트) → **10 사이트**. 그중 `reason:'failed'` 로 흐르는 것: `settle.ts:26` · `subagent-settlement.ts:28`(`chat-turn/index.ts:68` 의 summary 를 싣는다) | **2 / 10** | D-023 의 강제 지점 전수. 나머지 **8** 은 전부 `reason:'aborted'`(`subagent-settlement.ts:23,81,102` · `settle.ts:25` · `recovery.ts:5` · `mock-scenarios.ts:371,380` · `chat-turn/index.ts:81`)라 무영향 — 이번 턴 전수 확인 |
| 타일 메뉴의 가시 항목 | `ChatTitleBar.tsx:22` `VISIBLE_TILE_REGISTRY` 가 `reserved1`·`reserved2` 를 제외 | 2 | **예약 타일은 메뉴에 뜨지 않는다** — D-021 의 4종은 *정의* 수이고 사용자가 보는 메뉴는 `계획`·`백그라운드 작업`·`작업` 3항목이 된다 |
| `reserved2` 프로덕션 참조 | `rg reserved2 app/src` | 6 | 정의 1 · 레지스트리 1 · 메뉴 필터 1 · i18n 2 · 테스트 3행. 제거 시 전부 따라간다(typecheck 강제) |
| `structuredOutput` 문서화 | `rg structuredOutput docs/` | **0** | 코드 `ipc.ts:536`·`ipc.ts:1101` 에 있으나 `IPC_CONTRACT.md:447` 필드 목록에 없다 → D-026 ① |
| `MockScenarioId` 수 | 코드 `ipc.ts:175` = **14** vs `IPC_CONTRACT.md:386` = **13종** 열거 | 1 | 문서 게이트가 세지 않는 형태(`check-doc-inventory.mjs` 추적 9종에 없다) → D-026 ② |
| 출력·컨텍스트를 채울 재료 | `toolMeta.ts:17` `FILE_EDIT_TOOLS`(3) · `FILE_TOOLS`(4) · `toolDiffStat` · 채널 `orca:files:openPath` · 0201 의 cwd/브랜치/참조경로 | — | 세 섹션 모두 새 IPC·DB 없이 순수 fold 로 채울 수 있다. **이번 라운드는 D-022 로 빈 상태만** 만든다 |

### ΔV1 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-04a | R | §7-B AT-09a·AT-10a — 두 타일의 책임 분리 + `진행 상황` 단일 순서 | **CHANGED** | `V1:R-04` 대체 |
| R-11 | R | §7-B AT-28 — `백그라운드 작업` 타일 복구 | **NEW** | — |
| R-12 | R | §7-B AT-26·AT-27·AT-29 — cowork 3섹션 · 취소선 · 중단 버튼 자리 | **NEW** | — |
| R-13 | R | §7-B AT-30 — 두 타일 선택 상태 독립 | **NEW** | — |
| R-14 | R | §7-B AT-32·AT-33 — 미배선 표면 제거 · 문서 계약 정정 | **NEW** | — |
| R-08 | R | §7 AT-20/21 | INHERITED | `V1` — 계약 문장 불변, D-023 이 파생만 고친다 |
| R-01·R-02·R-03·R-05·R-06·R-07·R-09 | R | §7 | INHERITED | `V1` — r1 에서 PASS |
| R-10 | R | §7 AT-24/25 | INHERITED | `V1` — 상세 뷰모델 불변(AT-25 의 "첨부 양식"은 AT-29 가 구체화) |
| AT-09a·AT-10a·AT-26~AT-33 | AT | §7-B 각 행 | **NEW/CHANGED** | AT-09/AT-10 대체 · 나머지 신설 |
| SD-04 | SD | §7-B — 두 타일의 선택·표시 수명주기 | **NEW** | — |
| ST-04 | ST | §7-B AT-30 | **NEW** | — |
| SD-01·SD-02·SD-03 | SD | §5 | INHERITED | `V1` — 관측·중단·귀속 수명주기 무변경 |
| AR-02a | AR | §7-B EP-13 — 타일 조립(정의 4종·콘텐츠 2종·헤더 override 2종·선택 상태 2개) | **CHANGED** | `V1:AR-02` 대체 |
| AR-04 | AR | §7-B EP-17 — transcript 3행 → `subagent` 타일 배선 | **NEW** | — |
| IT-02a·IT-04 | IT | §7-B AT-09a/28 · AT-30 | **CHANGED/NEW** | `V1:IT-02` 대체 · IT-04 신설 |
| AR-01·AR-03 | AR | §10 | INHERITED | `V1` — 구조화 출력 계약·stop 배선 무변경 |
| MD-02a | MD | §7-B EP-14 — `taskBoardOrdered` 순서 불변식(그룹 제거) | **CHANGED** | `V1:MD-02` 대체 |
| MD-04 | MD | §7-B EP-15 — `isAbortedResult` 권위 필드 우선 | **NEW** | — |
| UT-02a·UT-04 | UT | §7-B AT-10a · AT-21/31 | **CHANGED/NEW** | `V1:UT-02` 대체 · UT-04 신설 |
| MD-01·MD-03 | MD | §11 | INHERITED | `V1` — 파서·`waitForTask` 무변경 |

### ΔV1 Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-20 | R-04a ↔ AT-09a/10a | REQUIRED | parts → `taskBoardFromMessages` → `taskBoardOrdered` → `진행 상황` 섹션 ∥ `subagentTasksFromMessages` → `백그라운드 작업` 타일 | 두 파생의 항목 집합·순서 배열 동등 단언 UT | not selected — 배열을 직접 관측 | EP-13 · EP-14 |
| VP-21 | R-11 ↔ AT-28 | REQUIRED | `subagent` 타일 → `SubAgentTileContent` → 그룹·카드·상세 | 그룹 순서 배열 + 카드 필드 존재 단언(렌더 문자열) | not selected — 출력 내용을 직접 관측 | EP-13 |
| VP-22 | R-12 ↔ AT-26/27/29 | REQUIRED | `TaskTileContent` → 3섹션 → 행 | 취소선 클래스 유무 · 버튼이 제목 직후 형제 · 두 섹션의 파생 호출 0건 | **required** (AT-29) — "파생 코드 0" 은 0건 주장이다. `출력` 섹션이 parts 를 읽는 변이를 심어 AT-29 가 red 인지 확인 | EP-16 |
| VP-23 | R-13 ↔ AT-30 | REQUIRED | `SELECT_TASK` / `SELECT_SUBAGENT_TASK` → 두 상태 → 두 타일 | 한쪽 선택이 다른 쪽을 바꾸지 않는다는 reducer 단언(양방향) | not selected — 두 필드를 직접 관측 | EP-12 |
| VP-24 | R-14 ↔ AT-32/33 | REQUIRED | 저장소 전수 스윕 + 문서 | 4종 부재(음성) **+ 배지·중단 해제가 계속 동작(양성 짝)** · 문서 문자열 존재/부재 | not selected — 양성 짝이 방향을 잡는다 | EP-18 |
| VP-25 | SD-04 ↔ ST-04(AT-30) | REQUIRED | 타일 열기/닫기/전환 전체 | 타일 제거 시 그 타일의 선택만 비워진다는 단언 | not selected | EP-12 |
| VP-26 | AR-02a ↔ IT-02a(AT-09a/28) | REQUIRED | `rightPanelTiles` → `tileRegistry` → `RightPanelTile` → 두 콘텐츠 | 두 타일 id 가 각각 다른 콘텐츠·헤더로 해석된다는 단언 + typecheck | not selected | EP-13 |
| VP-27 | AR-04 ↔ IT-04(AT-30) | REQUIRED | transcript 행 → `openSubagentTask` → `subagent` 타일 활성 | 3행 각각이 `subagent` 를 여는지 단언(`task` 가 아님) | not selected | EP-17 |
| VP-28 | MD-02a ↔ UT-02a(AT-10a) | REQUIRED | `taskBoard.ts` 순수 정렬 | id 순서 배열 동등 + background 후치 단언 | not selected | EP-14 |
| VP-29 | MD-04 ↔ UT-04(AT-21/31) | REQUIRED | `parts.ts` `isAbortedResult` → `deriveSubagentTaskStatus` → 두 타일 | `reason:'failed'`+'중단' 메시지 → `failed`, `reason:'aborted'` → `aborted` 두 단언 | **required** — 회귀 방향. `reason` 우선 분기를 지우는 변이를 심어 red 인지 확인 | EP-15 |
| **VP-08** | R-08 ↔ AT-20/21 | **REGRESSION** | `settleDeadBackgroundTasks` → 정착 → fold → 타일 | AC21 재측정 — 채널 종료가 `실패` 그룹/문구로 읽힌다 | VP-29 의 변이가 이 pair 도 red 로 만든다 | EP-08 · EP-15 |
| VP-06·VP-12·VP-16 | R-06/SD-02/AR-03 ↔ AT-12~17 | **REGRESSION** | 중단 경로 전체 | D-016a 가 유지를 요구한다 — `중단 중`·watchdog·통지 0건이 복구 후에도 성립 | 기존 변이 2종 재실행 | EP-06 (3) |
| VP-15 | AR-02 ↔ IT-02 | **SUPERSEDED** | — | → VP-26 | — | — |
| VP-04·VP-18 | R-04/MD-02 ↔ AT-09/10 | **SUPERSEDED** | — | → VP-20 · VP-28 | — | — |
| VP-01·02·03·05·07·09·10·11·13·14·17·19 | — | INHERITED | — | r1 에서 PASS. 이번 변경 경로에 닿지 않는다 | — | 무변경 |

> `V1` 의 12개 INHERITED pair 는 ΔV1 이 건드리지 않는다 — 파서(`task-tool.ts`)·fold 입력·구조화 출력 영속·`waitForTask` 는 diff 대상이 아니다. **VP-08·VP-06·VP-12·VP-16 만 REGRESSION** 으로 다시 닫는다: 앞은 D-023 이 파생을 바꾸고, 뒤 셋은 D-016a 가 "복구가 중단 수명주기를 되돌리지 않는다"를 주장하기 때문이다.

### ΔV1 Acceptance — 정정·신설

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-04a | **AT-09a** / AC9a (AT-09 대체) | `백그라운드 작업` 타일은 background 항목만, `작업` 타일 `진행 상황` 은 TaskXXX + background 를 함께 낸다 | UT — 혼합 parts 하나로 두 파생을 부르고 `subagentTasksFromMessages` 결과 집합 ⊂ `taskBoardFromMessages` 결과 집합이며, agent 항목이 앞엔 없고 뒤엔 있음을 단언 | 같은 parts → 두 파생 → 두 타일 |
| R-04a | **AT-10a** / AC10a (AT-10 대체) | `진행 상황` 은 그룹 헤더 없이 **id 오름차순 단일 배열**이고 background 는 관측 순으로 뒤에 온다 | UT — `taskBoardOrdered` 가 `['1','2','10', bg-a, bg-b]` 를 정확히 그 순서로 낸다(숫자 id 는 사전순 `'10'<'2'` 가 아니라 수치순). 그룹 배열을 내는 API 가 `작업` 타일 경로에 없음도 함께 | fold → `taskBoardOrdered` → 섹션 |
| R-12 | **AT-26** / AC26 (신설) | 완료 항목 제목에 취소선이 걸리고 미완료 항목에는 걸리지 않는다 | 렌더 — 완료 1건 + 진행 중 1건을 준 출력에서 완료 제목에만 `line-through` 가 있고 진행 중 제목에는 없음(양방향) | `TaskRow` |
| R-12 | **AT-27** / AC27 (신설) | background 진행 중 행의 중단 버튼이 **제목 직후**에 온다 — 행 우측 끝으로 밀리지 않는다 | 렌더 — 제목 span 과 버튼이 같은 flex 행의 **연속 형제**이고 제목에 `flex-1` 이 없음. 양성 짝: 버튼이 실제 렌더된다(진행 중 background 1건) | `TaskRow` |
| R-11 | **AT-28** / AC28 (신설) | `백그라운드 작업` 타일이 `72766d2` 의 정보 구조를 복원한다 — 상태 그룹 `진행 중→완료→중단됨→실패` · 카드 3줄(제목 / 에이전트·상태·경과·시각 / 토큰·도구수·대화록 보기) · 상세 = child transcript | 렌더 — 4상태 혼합 입력의 그룹 헤더 순서 배열 동등 + 카드 세 줄의 필드 존재 + 상세에 child 텍스트 존재 | `subagent` 타일 |
| R-12 | **AT-29** / AC29 (신설) | `작업` 타일은 `진행 상황`·`출력`·`컨텍스트` 세 섹션 헤더를 갖고 각 섹션이 접힌다. `출력`·`컨텍스트` 는 설명문만 내고 **parts 를 읽지 않는다** | 렌더 — 세 헤더 존재 + chevron 클릭 후 내용 부재(양성) · `rg "messages\|parts" <두 섹션 컴포넌트>` → 0건(음성) | `TaskTileContent` |
| R-13 | **AT-30** / AC30 (신설) | 두 타일의 선택 상태가 독립이다 — 한쪽 상세를 열거나 타일을 닫아도 다른 쪽 선택이 바뀌지 않는다 | reducer UT — `SELECT_TASK` 후 `selectedSubagentTaskId` 불변, `SELECT_SUBAGENT_TASK` 후 `selectedTaskKey` 불변, `REMOVE_RIGHT_PANEL_TILE('task')` 가 `selectedSubagentTaskId` 를 비우지 않음(양방향 4단언) | reducer |
| R-08 | **AT-21** / AC21 (재측정 · 계약 문장 불변) | 채널 종료 시 background 항목이 `실패` 로 정착하고 행 문구가 사용자 중단이라고 말하지 않는다 | UT(신설) — `{reason:'failed', message:'채널이 종료되어 … 중단되었습니다.'}` → `deriveSubagentTaskStatus` = `'failed'` **그리고** `{reason:'aborted', …}` → `'aborted'`(회귀 짝) | `settleDeadBackgroundTasks` → 정착 → `parts.ts` → 두 타일 |
| R-04a | **AT-31** / AC31 (신설) | 실패로 정착한 background 행이 정착 사유 문구를 보인다 | UT — 실패 항목의 메타 줄이 `result.output.message` 문자열을 포함. 양성 짝으로 `aborted` 행의 기존 사유도 계속 나온다 | `subagent-settlement.ts:28` → parts → 메타 줄 |
| R-14 | **AT-32** / AC32 (신설) | 미배선 표면 4종이 저장소에 없다 | 음성 — `rg "taskBoardSettledKeys\|isBackgroundTask\|MARK_SETTLED_TASKS\|TASK_STOP_SETTLED" app/src` → **0건**. **양성 짝** — 미확인 배지가 여전히 켜지고(완료 관측 → 카운트 1), 중단 대기가 여전히 해제된다(`tool.call.completed` → `stoppingTaskIds` 비움) | reducer 이벤트 경로 |
| R-14 | **AT-33** / AC33 (신설) | `IPC_CONTRACT.md` 가 코드와 어긋나지 않는다 | 문서 — `tool.call.completed` 행 필드 목록에 `structuredOutput` 이 있고, `MockScenarioId` 의 **개수 열거가 없다**(코드 정본 포인터로 대체). 양성 짝: 포인터가 실재 심볼(`MOCK_SCENARIO_IDS`)을 가리킨다 | `docs/IPC_CONTRACT.md` |

**AC 게이트 재통과**(§5) — 정정 2 · 재측정 1 · 신설 8 = **11행**에 대해:

- 세 칸(행동 단언·검증 수단·도달 경로): 11행 모두 보유.
- **방향**: AT-26·AT-27·AT-28·AT-30·AT-31 은 "X 가 있다/쓰인다"를 잠그고 각각 그 X 를 지우면 red 다 — 취소선 클래스 제거·버튼을 `ml-auto` 로 복귀·그룹 배열 축소·선택 필드 통합·사유 분기 삭제. **여분 사본이나 잔여물에 반응하는 장치가 아니다.**
- **음성 게이트의 양성 짝**: AT-29(파생 0건)↔같은 행의 "세 헤더가 렌더된다" · AT-32(4종 부재)↔"배지·중단 해제가 계속 동작" · AT-10a(그룹 API 부재)↔"순서 배열 동등".
- structural proxy 검토: AT-27 은 DOM 형제 관계라 구조적이다 — 이것이 "제목 우측"(D-020)의 의미 그 자체이고, 최종 시각 대조는 아래 **ΔV1 사람 실기**로 남긴다. AT-29 의 chevron 접힘도 같은 성질이다.
- 사람 실기로 미룬 순수 로직: 없다. 순서·취소선 유무·그룹 배열·선택 독립은 전부 순수/렌더 단언으로 내렸다.
- **AC 총수: `V1` 25 + 신설 8(AT-26~AT-33) = 33**(정정 2행 AT-09a·AT-10a 와 재측정 1행 AT-21 은 번호를 승계해 분모를 늘리지 않는다). **25 초과라 분할을 검토했다** — 분할하지 않는다: ① 0204 가 `verify/FAIL` 이고 D1 은 이 handoff 의 AC21 위반이라 여기서 닫아야 한다, ② 패널 분리·복구·3섹션은 같은 렌더 트리 하나를 동시에 바꾸므로 두 handoff 로 가르면 중간 상태가 컴파일되지 않는다. **분할 가능한 유일한 덩어리는 AT-33(문서 2줄)** 이고 그것만 떼면 나머지가 여전히 32 다.

**ΔV1 사람 실기 — 기계로 못 내리는 것만**

| 항목 | 기계가 닫는 범위 | 사람이 볼 것 | 실행 방법 |
|---|---|---|---|
| 3섹션 시각(D-017) | 헤더 3종 존재 · 접힘 동작 · 파생 0건 | 첨부 cowork 이미지와의 여백·구분선·일러스트 대조, 라이트/다크 | 디버그 패널 → mock `agent_task_board` → `작업` 타일 |
| 중단 버튼 자리(D-020) | DOM 형제 순서 · `flex-1` 부재 | 긴 제목이 잘릴 때 버튼이 밀리지 않는지 | 같은 mock, 제목 긴 background 1건 |
| 복구 충실도(D-016) | 그룹 순서 · 카드 3줄 필드 · 상세 child 텍스트 | `72766d2` 스크린샷과의 시각 동일성 | `git stash` 로 두 판을 번갈아 띄워 대조 |

### ΔV1 §10 강제 지점 — 정정·신설

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| SD-04 / VP-23·VP-25 | **EP-12** 두 타일의 선택 상태는 **독립 필드 2개**다 — `selectedSubagentTaskId`(subagent) · `selectedTaskKey`(task). `REMOVE_RIGHT_PANEL_TILE` 은 **두 특례 분기 각각**이 자기 필드만 비운다 | `chatReducer.ts` `ChatState` | reducer | 타일 제거·선택 시점 | 지점 **2**. 하나만 두면 한 타일을 닫을 때 다른 타일의 상세가 함께 접힌다(AC30 위반) |
| AR-02a / VP-20·VP-21·VP-26 | **EP-13** 타일 정의 변경은 **다섯 곳 전부**에서 이뤄져야 한다 — ① `rightPanelTiles.ts` 정의 배열(`reserved2` 제거 + `subagent` 재도입) ② `tileRegistry.ts` `contentById` ③ 같은 파일 `headerContentById` ④ `chatReducer` 타일 특례(EP-12 와 같은 분기) ⑤ i18n `chat.rightpanel.tiles.*` 2파일 | `rightPanelTiles.ts` | lint/typecheck + 렌더 | 빌드 시점 | 지점 **5**. `V1:EP-11`(4곳) 을 대체한다 — 헤더 override 가 두 타일로 늘어 3번이 독립 지점이 됐다. 빠지면 타일이 콘텐츠 없이 렌더되거나 헤더가 기본 라벨로 떨어진다 |
| MD-02a / VP-20·VP-28 | **EP-14** `진행 상황` 목록 순서의 SSOT 는 `taskBoardOrdered` **하나**다 — 컴포넌트가 자체 정렬·그룹핑하지 않는다. agent 는 id 수치순, background 는 관측순 후치 | `taskBoard.ts` | `TaskTileContent` | 렌더 시점 | 지점 **1**. 컴포넌트가 다시 정렬하면 `백그라운드 작업` 타일과 순서 규칙이 갈라진다 |
| MD-04 / VP-29·VP-08 | **EP-15** `isAbortedResult` 는 `reason` 이 있으면 message 를 보지 않는다 | `parts.ts` | `deriveSubagentTaskStatus` | 결과 해석 시점 | 지점 **1** (술어) + 영향 생산 지점 **2**(`settle.ts:26` · `subagent-settlement.ts:28`). 빠지면 실패가 사용자 중단으로 보인다(AC21 위반) |
| R-12 / VP-22 | **EP-16** `출력`·`컨텍스트` 섹션 컴포넌트는 `messages`/`parts` 를 읽지 않는다 | 두 섹션 컴포넌트 | 렌더 | 렌더 시점 | 지점 **2**(섹션 2개). 빠지면 D-022 가 무의미해지고 미완성 파생이 화면에 샌다 |
| AR-04 / VP-27 | **EP-17** transcript 행은 **`subagent` 타일**을 연다 — `AgentTaskRow` · `AgentTaskBody` · `SubagentNoticeRow` | `chatStore` `openSubagentTask` | 세 컴포넌트 | 클릭 시점 | 지점 **3**. 하나라도 `openTask` 로 남으면 대화록을 기대한 클릭이 한 줄 요약을 연다 |
| R-14 / VP-24 | **EP-18** 제거 대상 4종은 **정의·소비처·테스트** 전부에서 사라진다 | 저장소 | lint/typecheck + 스윕 | 빌드·검증 시점 | 지점 **4**(심볼 4종). 정의만 지우고 테스트를 남기면 빌드가 깨지고, 테스트만 지우면 죽은 코드가 남는다 |
| R-07 / VP-07·VP-13·VP-14 | **EP-07 (분모 정정)** 구조화 출력은 **세 곳**에 같은 규칙으로 실린다 — `claude-map.ts:385` · `writer.ts:275` · `chatReducer.ts:469` | `shared/ipc.ts` 타입 | 세 지점 | 이벤트 방출 · 파트 upsert · 라이브 리듀스 | verify r1 실측이 3이다(`V1` 표기 2). **분모만 정정, 계약 불변** |

- **`실패 의미`에 "다른 게이트가 막는다"를 적은 행**: 없다. EP-13 은 typecheck 가 ①②④⑤ 를 잡지만 ③(`headerContentById`)은 **선택적 map 이라 빠져도 컴파일된다** — 그래서 AT-28 이 헤더 출력을 직접 단언한다. 이 범위는 이번 턴에 측정했다: `headerContentById` 는 `Partial<Record<…>>`(`tileRegistry.ts:21`)이고 키 누락이 타입 오류가 아니다.
- **`진행 상황` 아이콘의 불가능 조합 제거**: `TaskStatusIcon` 은 `{ status: 'pending'; badge: string } | { status: Exclude<TaskBoardStatus,'pending'> }` 판별 union 을 받는다 — 번호 배지는 `pending` 에만 존재하고(background 는 `pending` 이 될 수 없다) flat prop 이면 `toolUseId` 가 18px 원에 들어가는 조합을 타입이 허용한다.

### ΔV1 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `.../lib/rightPanelTiles.ts` | EP-13① | 정의 = `plan`·`subagent`·`task`·`reserved1`. `reserved2` 제거 | typecheck |
| `.../rightpanel/SubAgentTileContent.tsx` **(복원)** | R-11 | `72766d2` 판을 되살린다. **변경 2점만** — ① `chatActions.stopSubagent` → `stopTask(backgroundTaskKey(id))`(D-016a) ② `stopping` 상태 라벨 + 그때 버튼 숨김 | 렌더 |
| `.../rightpanel/TaskTileContent.tsx` | R-12 | 3섹션 아코디언 껍데기 + `진행 상황` 목록. 그룹 렌더 제거, `taskBoardOrdered` 소비, 취소선, 중단 버튼을 제목 직후로 | 렌더 |
| `.../rightpanel/TaskTileSections.tsx` **(신규)** | EP-16 | `출력`·`컨텍스트` 빈 상태 2종 + 접힘 껍데기(`useState`, D-027). parts 미import | 렌더 + 음성 스윕 |
| `.../rightpanel/TaskStatusIcon.tsx` | R-12 | props 를 판별 union 으로. `index:number` → `badge:string`(pending 전용) | 순수 |
| `.../rightpanel/tileRegistry.ts` | EP-13②③ | `subagent`·`task` 두 콘텐츠 + 두 헤더 override | typecheck + AT-28 |
| `.../lib/taskBoard.ts` | MD-02a · D-025 | `taskBoardOrdered` 신설. `taskBoardGroups`·`TASK_BOARD_GROUP_ORDER`·`taskBoardGroupOf`·`taskBoardSettledKeys`·`isBackgroundTask` 제거 | 순수 단위 |
| `.../lib/parts.ts` | MD-04 | `isAbortedResult` 권위 필드 우선. `SubagentTaskSummary` 에 `settlementMessage` 추가(D-024) | 순수 단위 |
| `.../reducer/chatReducer.ts` | EP-12 · D-025 | `selectedSubagentTaskId` 복원(2필드 공존) · `SELECT/OPEN_SUBAGENT_TASK` 복원 · 타일 특례 2분기 · `MARK_SETTLED_TASKS`·`TASK_STOP_SETTLED` 제거 | reducer 단위 |
| `.../store/chatStore.ts` | EP-12·EP-17 | `selectSubagentTask`·`openSubagentTask` 복원(`stopTask` 는 유지) | 단위 |
| `.../transcript/{AgentTaskRow,AgentTaskBody,SubagentNoticeRow}.tsx` | EP-17 | `openTask(backgroundTaskKey(id))` → `openSubagentTask(id)` | typecheck + AT-30 |
| `.../shared/i18n/resources/{ko,en}.ts` | EP-13⑤ | `chat.subagentTile.*` 복원(+`status.stopping` 신설) · `tiles.subagent` 복원 · `tiles.reserved2` 제거 · `taskTile.group.*` 제거 · `taskTile.sections.*`·`taskTile.failedReason` 신설 | typecheck |
| `.../lib/rightPanelLayout.test.ts` | — | `reserved2` 를 쓰는 3행을 `subagent` 로 교체 | 단위 |
| `docs/IPC_CONTRACT.md` | D-026 | `tool.call.completed` 필드에 `structuredOutput` · mock 시나리오 개수 열거 → 코드 포인터 | AT-33 |

**AS-IS → TO-BE 요약**

```text
AS-IS (c3bb0d1)                        TO-BE (ΔV1)
  [계획][작업]                            [계획][백그라운드 작업][작업]
         └ 상태 그룹 목록                            │              └ 진행 상황 ▾  ← id 순 · 취소선 · 제목직후 중단
           (agent+bg 혼합)                          │                 출력 ▾      ← 빈 상태
           상세: dl + child transcript              │                 컨텍스트 ▾  ← 빈 상태
                                                    └ 상태 그룹 카드 · 상세=child transcript (72766d2 복원)
  selectedTaskKey 1개                     selectedTaskKey + selectedSubagentTaskId 2개
  transcript 행 → task 타일               transcript 행 → subagent 타일
```

### ΔV1 운영 gate

`V1` §7-A 의 4종을 그대로 쓴다. 이번 변경으로 달라지는 점만:

| Gate | 이번 변경에서 추가로 보는 것 |
|---|---|
| `npm run typecheck` | `RightPanelTileId` 에서 `reserved2` 가 빠지므로 잔여 참조 6곳이 전부 error 로 드러난다 — EP-13 의 기계적 강제 |
| `npm run lint` | 신규 `TaskTileSections.tsx` 가 `features/chat` 안에 있어 boundaries 무영향. 제거한 4종의 unused import 가 error 로 드러난다 |
| vitest | `taskBoard.test.ts`·`chatReducer.task.test.ts` 는 그룹/제거 심볼을 참조하므로 **함께 고쳐야 한다** — 테스트 수정이 곧 AT-32 의 일부다 |
| `check-doc-inventory --check` | 채널·variant·마이그레이션 수치 **불변**이어야 한다(신규 IPC 0 · 신규 variant 0). `IPC_CONTRACT.md` 편집이 prose 검사를 깨지 않는지도 본다 |

> **환경 주의**: 이 세션 시점 `app/node_modules` 가 없다(`ls app/node_modules` → No such file). 구현 턴은 `npm ci` 후 게이트를 돌리고, `app/AGENTS.md §better-sqlite3 ABI` 대로 DB 스위트는 ABI 정합 후에만 blocking 으로 센다.

---

## 7-C. ΔV2 — 의존 간선의 두 의미를 가른다

> **적용 순서: `V1` → `ΔV1` → `ΔV2`.** 출처는 verify 가 아니라 **사용자 질의**다 — "task 가 id 로 할당될텐데 그룹의 개념이 있나 … 완료후 추가 태스크들이 생기면 앞의 것과 의존이 없어야 해서". 그 답을 조사하다 파서 갭 2건(G1·G2)이 나왔고 사용자가 "고치고 검증 진행해" 로 범위에 넣었다.

| 출처 | 진단 | ΔV2 의 답 |
|---|---|---|
| 사용자 질의 | SDK 에 **그룹 개념이 없고** 의존은 작업별 간선(`blockedBy`/`blocks`)이다 — 목록 순서(id)는 의존이 아니다 | 규범 변경 없음. **확인 사실**로 §7-C 조사에 기록한다 |
| **G1** | `patch.blocks` 가 파싱되는데(`task-tool.ts:173`) `applyPatch`(`taskBoard.ts:122`)가 적용하지 않는다 — 죽은 필드 | **D-028** — 제거. `TaskListOutput` 에 `blocks` 가 없어 스냅샷이 보정할 수 없다 |
| **G2** | `readUpdate` 가 `addBlockedBy`/`addBlocks` 를 안 읽어, `TaskUpdate` 로 만든 의존이 다음 `TaskGet`/`TaskList` 전까지 안 보인다 | **D-029** — 가산 병합으로 읽는다. AC24("상세=…의존성")가 이미 약속한 표시를 실제로 닿게 한다 |

### ΔV2 조사 — SDK 실측

| 대상 | 검색 / 출처 | N | 의미 |
|---|---|---|---|
| 그룹·배치 개념 | `rg "group\|batch\|parentTask" sdk-tools.d.ts` 중 Task 관련 | **0** | 그룹 API 가 없다. 유사 표면은 `owner?`(담당자 배정)와 `metadata`(SDK 미해석) 둘뿐 |
| Task 도구 총수 | `rg -oE "Task[A-Za-z]+(Input\|Output)"` | **6종** | 재시작·재개 계열 도구 **없음**. 되돌리는 수단은 `TaskUpdate(status)` 뿐이고 모델이 부른다 |
| todo task 상태 어휘 | `sdk-tools.d.ts:2529` | **3+1** | `pending\|in_progress\|completed` + `deleted`(제거 신호). **취소·중단·실패 상태가 없다** → "중간에서 스탑" 을 표현할 방법이 없고 연쇄 취소도 정의되지 않는다 |
| 의존 간선 | `TaskGetOutput.task.{blocks,blockedBy}`(`:3614`) · `TaskUpdateInput.{addBlocks,addBlockedBy}`(`:2531`) | 2쌍 | 그룹이 아니라 **DAG 간선**. 새 태스크는 `blockedBy: []` 로 시작해 앞의 것과 무관하다 — 사용자가 요구한 성질이 SDK 계약에서 이미 성립 |
| `blocks` 의 스냅샷 가용성 | `TaskListOutput.tasks[]` = `{id, subject, status, owner?, blockedBy[]}` (`:3628`) | **부재** | `TaskList` 가 `blocks` 를 못 싣는다 → 저장하면 D-008 전체 스냅샷이 보정할 수 없어 **반드시 드리프트한다**. D-028 의 결정적 근거 |
| id 단조 증가 보장 | SDK 문서·타입 | **없음** | `id: string` 이고 단조성 문언이 없다. 수치 정렬(ΔV1 D-018)은 관측된 형태에 기댄 것이라는 사실을 여기 남긴다 — 실측 반례는 0건 |

### ΔV2 Decision

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-028 | `blocks` 를 `AgentTaskPatch` 와 파서에서 **제거**한다 | ① 소비처 0(죽은 필드) ② **`TaskListOutput` 에 없어 전체 스냅샷이 보정 불가** — 저장하면 드리프트가 확정이다 ③ `blockedBy` 의 역방향이라 정보 손실 0 | G1 + SDK 실측 | ACTIVE | — |
| D-029 | 의존 간선은 **두 의미를 분리**한다 — `blockedBy`(Get/List 출력) = 전체 교체, `addBlockedBy`(Update 입력) = **가산 병합** | SDK 가 이름으로 이미 가르고 있다(`add-` 접두). 한 필드에 담으면 `TaskUpdate` 한 번이 기존 간선을 지운다 | G2 + `TaskUpdateInput:2531` | ACTIVE | — |
| D-030 | `updatedFields` 게이트는 `addBlockedBy`·`blockedBy` **두 이름을 모두** 허용한다 | SDK 가 `updatedFields` 에 어느 이름을 싣는지 문서화하지 않았다. 놓치면 의존이 화면에서 사라지는 쪽(false negative)이 더 나쁘다 — **이 불확실성은 실측하지 못했고 여기 명시한다** | 설계자 판단 | ACTIVE | — |
| D-031 | 목록 **순서는 의존이 아니다** — id 순은 관측 순이고 의존은 `blockedBy` 만 말한다 | 사용자 요구("완료후 추가 태스크가 앞의 것과 의존이 없어야")를 계약으로 고정한다. 표시가 연쇄처럼 읽히는 문제는 별도 축이다(NEXT_HANDOFF) | 사용자 턴 | ACTIVE | ΔV1 D-018 을 보완(대체 아님) |

### ΔV2 Node / Pair registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| MD-01a | MD | §7-C EP-19 — 파서의 의존 간선 병합 불변식 | **CHANGED** | `V1:MD-01` 대체 |
| UT-05 | UT | §7-C AT-34 | **NEW** | — |
| R-02 | R | §7 TaskUpdate 관측 | INHERITED | `V1` — 계약 문장 불변, AT-34 가 붙는다 |
| MD-02a·MD-04 | MD | ΔV1 | INHERITED | 정렬·권위 필드 불변 |

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-30 | MD-01a ↔ UT-05(AT-34) | REQUIRED | `TaskUpdate(addBlockedBy)` → `readTaskToolObservation` → `applyPatch` → 상세 `의존성` 행 | 가산 병합 전후 배열 동등 + `blocks` 미저장 단언 | not selected — 배열을 직접 관측 | EP-19 |
| VP-17 | MD-01 ↔ UT-01 | **REGRESSION** | 파서 전체 | `task-tool.test` 17케이스 — `blocks` 제거가 나머지 관측을 바꾸지 않는다 | — | EP-02 |
| VP-03·VP-18 | R-03/MD-02 ↔ AT-07/08 | **REGRESSION** | 스냅샷 보정 | `TaskList` 가 여전히 전체 교체 | — | EP-03 |

### ΔV2 Acceptance — 신설

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-02 | **AT-34** / AC34 (신설) | `TaskUpdate(addBlockedBy)` 는 기존 의존에 **더하고**, `TaskGet`/`TaskList` 는 **전체를 교체**한다. `blocks` 는 어디에도 저장되지 않는다 | UT — ① `addBlockedBy:['1']` 후 `addBlockedBy:['2']` → `['1','2']`(중복 id 는 한 번) ② 그 뒤 `TaskList` 스냅샷 `blockedBy:['3']` → `['3']`(교체, 누적 아님) ③ `TaskGet` 출력에 `blocks` 가 있어도 patch·항목 어디에도 없다(음성) + **양성 짝**: 같은 출력의 `blockedBy` 는 실린다 | SDK 결과 → 파서 → fold → 상세 `#N 완료 필요` |

**AC 게이트 재통과**(§5) — 신설 1행:

- 세 칸 보유. **방향**: "간선이 쓰인다" 를 잠근다 — 가산 병합을 지우면 ①이, 교체를 가산으로 바꾸면 ②가 red 다.
- **음성 게이트의 양성 짝**: ③의 `blocks` 부재는 같은 단언 안의 `blockedBy` 실림과 짝지어 있다 — 파서가 통째로 죽어도 참이 되는 형태가 아니다.
- structural proxy 없음 — 배열 내용을 직접 관측한다.
- **AC 총수: `V1` 25 + ΔV1 8 + ΔV2 1 = 34.**

### ΔV2 §10 강제 지점 — 신설

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| MD-01a / VP-30 | **EP-19** 의존 간선은 **두 경로가 다른 의미**로 흐른다 — (1) `readUpdate` 는 `addBlockedBy` 를 **가산**으로, (2) `patchFromTaskRecord`(Get/List)는 `blockedBy` 를 **전체 교체**로 싣는다. `applyPatch` 가 두 의미를 각각 구현한다 | `shared/task-tool.ts` `AgentTaskPatch` | 파서 + `taskBoard.applyPatch` | 결과 파싱 · fold 시점 | 지점 **3**(파서 2 + 적용 1). (1)이 빠지면 G2 재발, (2)가 가산이 되면 삭제된 의존이 영구 잔류, 적용부가 한 의미만 알면 둘 중 하나가 조용히 무시된다 |

- `blocks` 는 이 표에서 **사라진다** — 필드 자체가 없어지므로 강제할 지점이 없다(D-028).

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 6개 Task 도구를 인식하는 코드가 없다 | `rg "TaskCreate\|TaskUpdate\|TaskList\|TaskGet"` → 0건 |
| `TaskCreateOutput = { task: { id, subject } }` — description·status 는 출력에 없다 | SDK `sdk-tools.d.ts` `TaskCreateOutput` |
| `TaskGetOutput = { task: {id,subject,description,status,blocks,blockedBy} \| null }` | 같은 파일 `TaskGetOutput` |
| `TaskUpdateOutput = { success, taskId, updatedFields, error?, statusChange?:{from,to} }` — 새 subject/description 은 출력에 없다(입력에서 읽어야 한다) | 같은 파일 `TaskUpdateOutput` |
| `TaskListOutput = { tasks: [{id,subject,status,owner?,blockedBy}] }` — 전체 목록 | 같은 파일 `TaskListOutput` (D-008 근거) |
| 일반 Task status 어휘는 `pending\|in_progress\|completed` + `deleted` | `TaskUpdateInput.status` |
| background Task status 어휘는 별개다 — `completed\|failed\|stopped` | `SDKTaskNotificationMessage.status` |
| **두 네임스페이스가 다르다** — 일반 Task 는 `taskId`(camelCase), background 는 `task_id`(snake_case) | `TaskGetInput.taskId` vs `TaskStopInput.task_id` |
| 구조화 tool 출력은 `SDKUserMessage.tool_use_result` 에만 있다 — `tool_result.content` 는 모델용 텍스트다 | `sdk.d.ts:4589` 주석 "the tool's full Output object, not the string content sent to the model" |
| 현재 매퍼는 `tool_use_result` 를 async_launched 영수증에만 쓴다 | `app/src/main/adapters/claude-map.ts:354` `result: launchReceipt ?? p.content` |
| `tool_call` 파트가 `args` 를 영속한다 → 재로드 후에도 입력을 읽을 수 있다 | `app/src/main/features/history/writer.ts:223` |
| 파트 payload 는 `payload_json` 이라 새 옵션 필드에 마이그레이션이 불필요하다 | `app/src/main/infra/db/queries.ts:155` |
| 우측 패널 타일 상태는 DB 미영속(reducer 초기값 `[]`) | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:222` |
| background 목록·상세·개별 중단 UI 가 이미 있다 | `app/src/renderer/src/features/chat/components/rightpanel/SubAgentTileContent.tsx` (245줄) |
| 채널 사망 시 합성 failed 정착이 이미 있다 | `app/src/main/app/chat-turn/index.ts:66` |
| 사용자 중단은 지금 **즉시** 합성 settled 를 흘린다 | `app/src/main/app/chat-turn/index.ts:182` 주석 "클릭 즉시 … 낙관 정착" (D-005 가 대체) |
| settled background enrich 가 `isAsyncLaunched` 로만 게이트된다 | `app/src/main/features/chat/turn-coordinator.ts:259-268` (D-007 의 새 게이트가 필요한 지점) |
| 비활성 세션 이벤트가 그 세션 엔트리로 누적된다 | `app/src/renderer/src/features/chat/store/chatStore.ts:373` 주석 |
| `stopSubagent` 는 `Promise<void>` 라 거절을 renderer 가 받을 수 있다 | `app/src/renderer/src/shared/api/ipc.ts:70` |
| 시맨틱 색 토큰 `good`/`warn`/`bad`/`accent`/`t1~t9` 가 있다 | `app/src/renderer/src/styles/tokens.css:48-71` |
| 아이콘 `check`·`stop`·`alert` 가 있다 — `○`/`●` 는 CSS 원으로 그린다(기존 목록도 동일) | `app/src/renderer/src/shared/ui/Icon.tsx` · `SubAgentTileContent.tsx:190` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| Task 도구 인식 코드 | `rg "TaskCreate\|TaskUpdate\|TaskList\|TaskGet" app/src` | 0 | 전부 신규 |
| 우측 패널 타일 정의 | `rightPanelTiles.ts` 배열 | 4 | `plan`·`subagent`·`reserved1`·`reserved2` → `subagent` 를 `task` 로 개명 (총 4 유지) |
| 타일 개명 영향 지점(비-테스트) | `rg "selectedSubagentTaskId\|openSubagentTask\|selectSubagentTask\|OPEN_SUBAGENT_TASK\|SELECT_SUBAGENT_TASK\|'subagent'" app/src/renderer/src \| grep -v .test.` | 23 | 개명 전수 분모 |
| 같은 검색의 테스트 지점 | 같은 검색 + `grep .test.` | 24 | 테스트도 함께 갱신해야 한다 |
| `tool.call.completed` 생산 지점(main, 비-테스트) | `rg "type: 'tool.call.completed'" app/src/main \| grep -v .test.` | 21 | 그중 새 필드를 실어야 하는 곳은 `claude-map.ts:354` **1곳** — 나머지는 합성/mock 이라 구조화 출력이 없다 |
| mock 시나리오 | `MOCK_SCENARIO_IDS` | 13 | 그중 subagent 계열 5 — 신규 1종 추가 시 14 |
| OS 알림 호출 지점 | `rg "notifyApi" app/src/renderer/src` | 1 | `useCompletionNotifier.ts:25` — 이번 변경 대상 아님(D-004) |
| DB 마이그레이션 | `ls app/src/main/infra/db/migrations` | 17 | 이번 변경 0개 추가 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 위 표는 전부 이번 세션에서 실행한 검색 결과다.
- 내역 합 = 총계: 타일 개명 지점 23(비-테스트) + 24(테스트) = 47 — 두 분모를 합치지 않고 분리해 센다.
- "유일한/항상/절대" 반례 검색: `rg -n "tool_use_result" app/src` → **9행**, 그중 프로덕션은 전부 `claude-map.ts`(150·151·159·339) 한 파일이고 나머지 5행은 `claude-map.test.ts` 다 — "구조화 출력을 읽는 프로덕션 지점은 매퍼 1곳"이 성립한다.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`(`:112`) 실재 · `background-tasks.test.ts:56` 케이스 실재 · `chatReducer.listen.test.ts:172` 케이스 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: 없음(신규).
- 현재 책임 소유자: background Task = `BackgroundTaskTracker`(main) + `subagentTasksFromMessages`(renderer). 일반 Task = **소유자 없음**.
- 현재 entry → flow → state → consumer: SDK `system task_*` → `mapTaskSystem` → `subagent.task` → store transient meta + parts → `SubAgentTileContent`. `TaskCreate` 등은 `tool.call.started/completed` 로만 흘러 `ToolGroup` 안의 익명 도구 행이 된다.
- 현재 오류/취소/정리 경로: 개별 중단 = 즉시 낙관 정착. 채널 사망 = 합성 failed 정착. 턴 중단 = `settleOpenToolRuns`.
- 문제의 직접 원인: `tool.call.completed.result` 가 모델용 wire content 라 `TaskCreateOutput.task.id` 를 얻을 수 없다. id 가 없으면 같은 Task 의 후속 `TaskUpdate` 와 이어붙일 수 없다.

```text
SDK user(tool_result)
  → claude-map (result = p.content, 모델용 텍스트)
  → tool_result part
  → ToolGroup (익명 도구 행)          ← Task 정체성이 여기서 소실된다
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`·`AR-01`·`AR-02`·`MD-01`·`MD-02`.
- 변경 후 책임 소유자: 결과 파싱 = `shared/task-tool.ts`(양 프로세스 공용 wire 지식) · 목록 파생 = `renderer .../lib/taskBoard.ts` · 중단 수명주기 = `chatStopSubagent` 핸들러 + `BackgroundTaskTracker`.
- 변경 후 entry → flow → state → consumer: `claude-map` 이 6개 Task 도구의 `tool_use_result` 를 `structuredOutput` 으로 실어 보내고, writer 가 파트에 영속하며, renderer 가 parts 를 fold 해 목록을 만든다.
- 변경 후 오류/취소/정리 경로: 중단 = `중단 중` → SDK 확정 / IPC 거절 복구 / watchdog 합성. 채널 사망·턴 중단은 **기존 경로 그대로**.
- 유지하는 기존 메커니즘: listen 턴 · 세션별 이벤트 라우팅 · `settleSubagentTask` · `settleDeadBackgroundTasks` · `subagentTasksFromMessages`. 대체하는 메커니즘: 중단 시 즉시 합성 settled(D-005) · `subagent` 타일(→ `task` 타일).

```text
SDK user(tool_result)
  → claude-map (+ structuredOutput, Task 도구 한정)
  → tool.call.completed → writer → tool_result part(payload_json)
  → taskBoardFromMessages(parts, stopping)   ← 일반 Task + background Task 통합 fold
  → TaskTileContent (상태 그룹 목록 / 상세)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 일반 Task 소유자 없음 | `shared/task-tool.ts` + `lib/taskBoard.ts` | id 없이는 이어붙일 수 없다 | AR-01·MD-01/02 / VP-01·VP-17 |
| data/control flow | 구조화 출력이 매퍼에서 버려짐 | Task 도구 한정으로 `structuredOutput` 동행 | `TaskCreateOutput.task.id` 확보 | SD-01 / VP-14 · `claude-map.ts` |
| state/contract | `tool.call.completed`/`tool_result` 파트에 구조화 출력 자리 없음 | 옵션 필드 `structuredOutput?: unknown` 추가 | 재로드 복원(AC18) | AR-01 / VP-14 · `shared/ipc.ts` |
| UI 조립 | `subagent` 타일 = background 전용 | `task` 타일 = 통합 목록 + 종류별 상세 | D-003 | AR-02 / VP-15 · `tileRegistry.ts` |
| error/lifecycle | 중단 클릭 = 즉시 확정 | `중단 중` → 확정/복구/watchdog | D-005·D-006 | SD-02 / VP-06·VP-12 |
| error/lifecycle | 통지 억제가 "추적 즉시 해제"의 부수 효과 | `stoppedSubagents` 명시 게이트 | D-007 — 추적 해제가 늦어지면 부수 효과가 사라진다 | AR-03 / VP-16 |
| test seam/관측점 | 없음 | 순수 모듈 3종 + mock 시나리오 1종 | 사람 실기 최소화 | MD-01/02/03 / VP-17/18/19 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/src/shared/task-tool.ts` (L0) | 6개 도구 이름 술어 + 결과 → 관측(observation) 파싱 | `(toolName, args, structuredOutput)` → `TaskToolObservation \| null` | `claude-map.ts`(이름 술어), `taskBoard.ts`(파싱) |
| `app/src/main/adapters/claude-map.ts` | `tool_use_id → toolName` 기억 + Task 도구 결과에 `structuredOutput` 동행 | SDKMessage → NormalizedEvent[] | 어댑터 |
| `app/src/main/features/history/writer.ts` | `structuredOutput` 파트 영속 | 이벤트 → payload_json | 버스 |
| `app/src/main/features/chat/background-tasks.ts` | 추적 + `waitForTask` | `(sessionId, toolUseId, {signal, timeoutMs})` → `Promise<'settled'\|'timeout'>` | `chatStopSubagent` 핸들러 |
| `app/src/main/app/chat-turn/index.ts` | 중단 요청 → 확정 대기 → watchdog 합성 | IPC req → Promise | preload |
| `.../features/chat/lib/taskBoard.ts` (renderer) | parts + stopping → 통합 목록/상세 뷰모델 | 순수 | 타일 컴포넌트 |
| `.../components/rightpanel/TaskTileContent.tsx` | 목록/상세 렌더 + 중단 버튼 | 뷰모델 → JSX | `tileRegistry` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-01·VP-14·VP-17 | **EP-01** `structuredOutput` 은 `isTaskToolName(name)` 인 tool_result 에만 실린다 | `shared/task-tool.ts` `TASK_TOOL_NAMES` | `claude-map.ts` `claudeToNormalized`(user 분기) | tool_result 매핑 시점 | 다른 도구의 큰 출력까지 영속돼 DB 가 부푼다 |
| MD-01 / VP-02·VP-17 | **EP-02** `TaskUpdate` 는 `success===true` 일 때만 관측을 만들고, 상태는 `statusChange.to` → 없으면 `args.status` 순으로 읽는다 | `shared/task-tool.ts` | 같은 파서 | 결과 파싱 시점 | 실패한 갱신이 패널에 반영된다(AC6 위반) |
| MD-01 / VP-03·VP-17 | **EP-03** `TaskList` 는 전체 스냅샷 — 반환 집합에 없는 로컬 id 를 제거한다 | `taskBoard.ts` fold | `taskBoardFromMessages` | fold 중 snapshot 관측 시점 | 삭제된 Task 가 영구 잔류(AC7 위반) |
| MD-02 / VP-04·VP-18 | **EP-04** 항목 키는 `agent:<taskId>` / `bg:<toolUseId>` — 두 네임스페이스를 절대 합치지 않는다 | `taskBoard.ts` `taskKey()` | 같은 fold + 선택 상태 | 키 생성 시점 | 숫자 id 와 tool_use id 가 충돌해 항목이 서로 덮인다 |
| SD-01 / VP-05·VP-11 | **EP-05** 턴-후 갱신은 두 지점이 함께 성립해야 한다 — (1) `post-turn.ts` 의 listen 스텝 유지, (2) store 의 `subagent.task` transient 흡수 | 기존 코드 | `post-turn.ts` · `chatStore.ts` | 매 턴 종료 후 루프 반복 | 턴 종료 후 카드가 멈춘다(AC11 위반) |
| SD-02 / VP-06·VP-12·VP-16 | **EP-06** 중단 확정은 세 지점이 함께 성립해야 한다 — (1) 핸들러가 즉시 합성 정착을 하지 **않는다**, (2) coordinator enrich 가 `stoppedSubagents` 를 게이트해 `background` 를 안 싣는다, (3) watchdog 이 timeout 에 합성 정착한다 | `chat-turn/index.ts` + `turn-coordinator.ts` | 중단 요청 시점 · settled 도착 시점 · timeout 시점 | (1) 빠지면 AC12 위반, (2) 빠지면 AC17 위반(사용자 중단에 통지 발생), (3) 빠지면 `중단 중` 고착 |
| R-07 / VP-07·VP-13·VP-14 | **EP-07** 구조화 출력은 두 곳에 같은 규칙으로 실려야 한다 — (1) 라이브 이벤트, (2) writer 의 `payload_json` | `shared/ipc.ts` 타입 | `claude-map.ts` · `writer.ts` | 이벤트 방출 · 파트 upsert | 라이브와 재로드가 갈라진다(AC18 위반) |
| R-08 / VP-08 | **EP-08** fold 입력은 **그 세션 엔트리의 messages** 뿐이다 — 전역 상태를 읽지 않는다 | `taskBoard.ts` 시그니처 | 타일 컴포넌트 | 렌더 시점 | 다른 세션 Task 가 섞인다(AC20 위반) |
| MD-03 / VP-09·VP-19 | **EP-09** `waitForTask` 는 tracker 구독으로만 종료를 안다 — polling 하지 않는다 | `background-tasks.ts` | 핸들러 | 중단 대기 시점 | 명세 §2 polling 금지 위반 |
| R-10 / VP-10 | **EP-10** 상세는 항목 `kind` 로 분기해 **그 종류가 실제로 가진 정보만** 보여준다 | `taskBoard.ts` 상세 뷰모델 | 상세 렌더 | 렌더 시점 | 일반 Task 에 경과/도구수 같은 빈 칸이 생긴다(AC24 위반) |
| AR-02 / VP-15 | **EP-11** 타일 id 개명은 정의·레지스트리·reducer 특례·i18n **네 곳 전부**에서 이뤄져야 한다 | `rightPanelTiles.ts` | lint/typecheck + 렌더 | 빌드 시점 | 타일이 콘텐츠 없이 렌더되거나 라벨이 비어 보인다 |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 공유 방법: 6개 도구 이름과 결과 해석은 `shared/task-tool.ts` 한 곳이 갖는다 — main 은 이름 술어만, renderer 는 파서를 쓴다. 정규식/문자열 리터럴을 두 프로세스가 각자 갖지 않는다(`shared/subagent.ts` 선례와 동형).
- `실패 의미`에 "다른 게이트가 막는다"를 적었다면 그 범위를 이 턴에 측정한 근거: **해당 없음** — 어느 행도 다른 게이트에 의존한다고 적지 않았다.
- 선택적 필드의 `true/false/undefined` 의미: `structuredOutput` 은 `undefined` = Task 도구가 아니거나 SDK 가 안 실었다(둘 다 "항목을 만들지 않는다"로 수렴). `TaskUpdateOutput.success` 는 `false`/`undefined` 모두 무시(fail-closed).
- 외부 SDK 경계의 실제 요구 타입/의미: `tool_use_result` 는 SDK 에서 `unknown` 이다 — 파서는 `isRecord` 가드로 좁히고 실패 시 `null` 을 돌려준다. `as any`/`as never` 를 쓰지 않는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/task-tool.ts` **(신규)** | 도구 이름 술어 + 결과 파서 | `TASK_TOOL_NAMES`(6) · `isTaskToolName` · `readTaskToolObservation` | 순수 단위 |
| `app/src/shared/task-tool.test.ts` **(신규)** | MD-01 UT | 도구별 성공/실패/누락 케이스 | 순수 단위 |
| `app/src/shared/ipc.ts` | 계약 | `tool.call.completed` 와 `tool_result` 파트에 `structuredOutput?: unknown` 추가 (variant 수 불변) | typecheck |
| `app/src/main/adapters/claude-map.ts` | EP-01 | `MapContext.toolNameByRunId` 추가 · tool_use 에서 기록 · tool_result 에서 Task 도구면 `structuredOutput` 동행 | 순수 단위(기존 `claude-map.test.ts`) |
| `app/src/main/features/history/writer.ts` | EP-07(2) | `tool.call.completed` 영속 payload 에 `structuredOutput` 조건부 포함 | 통합 |
| `app/src/main/features/chat/background-tasks.ts` | MD-03 | `waitForTask(sessionId, toolUseId, opts)` 추가 — `subscribe` 기반, 이미 미추적이면 즉시 resolve | 순수 단위(기존 테스트 파일) |
| `app/src/main/app/chat-turn/index.ts` | EP-06(1)(3) | 즉시 합성 정착 제거 · `stopLiveSubagent` 후 `waitForTask` 대기 · timeout 시 기존 합성 정착 수행 · 실패는 reject | 단위(fake timer) |
| `app/src/main/features/chat/turn-coordinator.ts` | EP-06(2) | settled background enrich 에 `!turn.stoppedSubagents.has(id)` 게이트 추가 | 단위 |
| `app/src/main/adapters/mock-scenarios.ts` · `app/src/shared/ipc.ts` | 실기 경로 | `agent_task_board` 시나리오 추가(TaskCreate→TaskUpdate→TaskList + background 1건) | 사람 실기 진입점 |
| `.../features/chat/lib/taskBoard.ts` **(신규)** | MD-02 | `taskBoardFromMessages` · `taskBoardGroups` · `taskDetailView` · `taskKey`/`backgroundTaskKey` | 순수 단위 |
| `.../features/chat/lib/taskBoard.test.ts` **(신규)** | MD-02 UT | AC1~AC10·AC12·AC23·AC24 | 순수 단위 |
| `.../features/chat/lib/rightPanelTiles.ts` | EP-11 | `subagent` → `task`, 라벨 키 교체 | typecheck |
| `.../components/rightpanel/TaskTileContent.tsx` **(신규, `SubAgentTileContent.tsx` 대체)** | 목록/상세 렌더 | 통합 목록 + 종류별 상세 + `중단 중`/중단 버튼 | 사람 실기(시각) |
| `.../components/rightpanel/tileRegistry.ts` | EP-11 | `task` 매핑 | typecheck |
| `.../reducer/chatReducer.ts` | EP-04·EP-11 | `selectedSubagentTaskId` → `selectedTaskKey` · 액션 개명 · 타일 특례 id 교체 · 미확인 완료 카운트 상태 | 단위(기존 reducer 테스트) |
| `.../store/chatStore.ts` | AT-12/14/19 | `stoppingTasks` transient · `stopTask` 가 `await` 후 실패 시 해제 + 사유 보관 · 완료 배지 카운트 | 단위 |
| `.../components/ChatTitleBar.tsx` | AT-19 | 타일 칩 미확인 배지 | 사람 실기(시각) |
| `.../components/transcript/{AgentTaskRow,AgentTaskBody,SubagentNoticeRow}.tsx` | EP-04 | `openTask(backgroundTaskKey(toolRunId))` 로 호출 교체 | typecheck |
| `.../shared/i18n/resources/{ko,en}.ts` | 라벨 | `chat.taskTile.*` 신설 + `chat.rightpanel.tiles.task` | typecheck |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: `shared/task-tool.ts` 와 `lib/taskBoard.ts` 는 electron·DB·SDK 런타임을 import 하지 않는다(타입만) — `claude-map.ts` 와 같은 성질이라 vitest 직행이 가능하다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `subagentTasksFromMessages`(`lib/parts.ts:269`)의 반환을 그대로 background 항목으로 매핑한다 — 상태 어휘가 `running/completed/aborted/failed` 라 통합 어휘로 1:1 사상된다(`running` → `in_progress`, 나머지 동명).
- 순서를 관측할 훅/로그/주입 경계: fold 는 parts 순회 순서가 곧 관측 순서다 — 항목의 `order` 필드가 최초 관측 인덱스를 들어 정렬을 관측 가능하게 만든다.

## 12. End-to-end 영향

### producer → consumer

```text
SDK tool_result / system task_*
  → claude-map(정규화 + structuredOutput)
  → 버스 → writer(영속) ∥ renderer(라이브)
  → parts
  → taskBoardFromMessages(순수 fold)
  → TaskTileContent(목록/상세) · ChatTitleBar(배지)
```

- producer 기준: 항목 존재의 권위는 **성공한 tool_result** 다. tool_use 만으로는 항목을 만들지 않는다(AC1).
- consumer 파생 규칙: 상태 그룹·`중단 중`·배지 카운트는 전부 fold 결과에서 파생한다 — 컴포넌트가 자체 상태로 상태를 만들지 않는다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: `stopping` 은 fold **입력**이지 항목 필드가 아니다 — 렌더가 따로 `stopping` 을 다시 읽어 표시를 만들지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `tileRegistry` 소비자(`RightPanelTile`·`ChatTitleBar`) | 타일 id 집합 크기 불변(4) — 한 원소의 이름만 바뀐다 | AC24·AC25 |
| `MOCK_SCENARIO_IDS` 소비자(디버그 패널 셀렉트) | 13 → 14, 셀렉트 항목 1개 증가 | 사람 실기 |
| `tool_result` 파트 소비자(`parts.ts`·transcript) | 새 옵션 필드는 기존 소비자가 무시한다(전방 호환) | AC18 |
| `NormalizedEvent` variant 소비자 | variant 수 불변 → 인벤토리 수치 불변 | 운영 gate |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 항목 생성 = 성공 tool_result 관측 또는 `task_started`. 별도 등록 절차가 없다.
- 취소/중단: D-005/D-006 — `중단 중` → (a) SDK stopped 확정 (b) IPC 거절 → `진행 중` 복구 (c) timeout → 합성 정착.
- 종료/quit/crash/renderer-gone: 기존 경로 유지 — `settleDeadBackgroundTasks`(채널 사망)와 앱 종료 정리(`settleTrackedTasks`)가 이미 모든 추적을 정착시킨다. `waitForTask` 는 `clear()` 에서도 resolve 되므로 대기가 남지 않는다.
- retry/timeout/partial failure: `waitForTask` 의 `timeoutMs` 는 밀리초 단위 정수이며 `STOP_SETTLE_TIMEOUT_MS = 15_000` 을 기본값으로 쓴다. 범위는 `[1_000, 60_000]` 을 벗어나지 않는다(상수 1개, 설정 노출 없음).
- cleanup/rollback: renderer `stoppingTasks` 는 항목이 `in_progress` 를 벗어나면 해제한다 — 정착 이벤트가 유일한 해제 신호가 아니어야 재로드/세션 전환에서도 남지 않는다.
- **다중 저장소 쓰기**: 런타임에는 없다 — 일반 Task 는 어디에도 별도 저장되지 않고 파트 하나에만 실린다(D-002). **산출물 사본은 둘이다** — 이 `plan.md` 의 상태와 `docs/handoff/INDEX.md` 보드 행. 둘이 갈라지지 않도록 상태·다음 주체는 INDEX 를 정본으로 두고 plan 메타는 단계만 적는다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: `structuredOutput` 은 6개 도구에만 실린다. 최대 크기는 `TaskListOutput` — Task 수 × (id+subject+status+blockedBy) 다. 실용 상한을 Task 200건 × 약 200B ≈ **40KB/호출**로 잡고, 이를 넘는 파싱은 항목 수 상한 없이 그대로 fold 한다(목록 렌더는 가상화 없이 200행까지 안전 — 기존 background 목록과 같은 규모).
- 새 요청 수의 `원천 상한 × 배치 상한`: 네트워크 요청 증가 0 — 새 IPC 채널도 없다.
- 구조적 목표: 없음.
- 캐시/snapshot/호출 축소로 잃는 부수 효과: fold 는 `useMemo(messages)` 로 감싼다 — 기존 `subagentTasksFromMessages` 와 같은 메모 경계이며(`SubAgentTileContent.tsx:97` 선례), `messages` identity 는 커밋 이벤트에만 바뀐다. `stopping` 집합이 바뀌면 재계산해야 하므로 **의존성에 `stopping` 을 포함**한다 — 빠뜨리면 `중단 중` 표시가 갱신되지 않는다(AC12 회귀).

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port/schema/config: 해당 없음.
- 구현 문서: `docs/arch/frontend/ux-domains.md` 의 우측 패널 서술과 `docs/arch/backend/provider-runtime.md` 의 파트/이벤트 서술이 타일 이름·파트 필드를 언급하면 같이 갱신한다(구현 턴에 실측).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0143 "클릭 즉시 낙관 정착" | `chat-turn/index.ts:182` 주석 | §5 상태 전이표 `[■] 클릭` 행, D-005 | **변경** — 명세 §2 가 `중단 중` 을 명시 요구 |
| 0143 "사용자 자기 행위의 통지는 소음" | `chat-turn/index.ts:196` 주석 | D-007, EP-06(2) | **유지** — 부수 효과였던 억제를 명시 게이트로 승격 |
| 0136 "채널 사망 시 합성 failed 정착" | `chat-turn/index.ts:66` | §4 "이미 충족", AC21 | 유지 |
| 0149 "프로세스 경계를 넘는 wire 상수는 shared 가 단일 소유" | `shared/subagent.ts` 헤더 주석 | §10 SSOT 항, `shared/task-tool.ts` | 유지(같은 패턴으로 확장) |
| renderer 4-layer + 그룹 스코프 | `app/src/renderer/AGENTS.md` | §11 파일 배치, §5 a11y | 유지 |
| "코드에서 셀 수 있는 수치를 문서에 적지 마라" | root `AGENTS.md` 원칙 4 | §7-A 운영 gate 의 인벤토리 행 | 유지 — 수치는 생성물이 갖고 본 문서는 "불변이어야 한다"만 적는다 |
| 마이그레이션 append-only | `app/AGENTS.md` | §8 "마이그레이션 0개 추가" | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 현재 CLI 가 `TaskCreate` 대신 `TodoWrite` 를 쓸 수 있다 — 그러면 패널이 비어 있다 | mock 시나리오 `agent_task_board` 로 렌더 경로를 CLI 와 독립적으로 검증한다. `TodoWrite` 대응은 비범위(D-001) |
| `tool_use_result` 가 특정 도구/버전에서 누락될 수 있다 | 파서가 `null` 을 돌려주고 항목을 만들지 않는다 — 거짓 항목보다 미표시를 택한다 |
| 중단 확정 대기가 IPC 응답을 최대 15초 붙잡는다 | 렌더러는 `중단 중` 으로 즉시 피드백하므로 사용자 체감 지연이 없다. 핸들러는 turn 을 막지 않는다(AC16) |
| 타일 개명이 47개 지점에 걸린다 | typecheck 가 전수를 잡는다(문자열 id 3곳만 수동 확인 — EP-11) |
| `TaskList` 스냅샷 제거 규칙(D-008)이 과했을 가능성 | `TaskListOutput.tasks` 가 전체 목록이라는 SDK 타입에 근거한다. 반증되면 D-008 만 뒤집으면 되고 fold 한 곳만 바뀐다 |

- 되돌리기 어려운 결정: 없다 — 타일 상태·일반 Task 상태 모두 미영속이고, 새 파트 필드는 옵션이라 무시 가능하다.
- 신규 의존성: 없음 → 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/task-tool.ts` **(신규)** · `app/src/shared/task-tool.test.ts` **(신규)** · `app/src/shared/ipc.ts`
- `app/src/main/adapters/claude-map.ts` · `claude-map.test.ts` · `mock-scenarios.ts`
- `app/src/main/features/history/writer.ts`
- `app/src/main/features/chat/background-tasks.ts` · `background-tasks.test.ts` · `turn-coordinator.ts`
- `app/src/main/app/chat-turn/index.ts`
- `app/src/renderer/src/features/chat/lib/taskBoard.ts` **(신규)** · `taskBoard.test.ts` **(신규)** · `rightPanelTiles.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/TaskTileContent.tsx` **(신규)** · `tileRegistry.ts` · (삭제) `SubAgentTileContent.tsx`
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` · `store/chatStore.ts` · `components/ChatTitleBar.tsx`
- `app/src/renderer/src/features/chat/components/transcript/{AgentTaskRow,SubagentNoticeRow}.tsx` · `tool-bodies/AgentTaskBody.tsx`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/handoff/INDEX.md` · (실측 후) `docs/arch/frontend/ux-domains.md` · `docs/arch/backend/provider-runtime.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md §테스트` · `app/src/main/AGENTS.md`.
- ABI/네트워크 등 환경 제약: 이 저장소 클론에는 `app/node_modules` 가 없다(`ls app/node_modules` → 0개). 구현 턴은 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 로 설치하고 postinstall(Electron ABI) 실패는 환경 제약으로 분리 보고한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/shared src/main/adapters src/main/features/chat src/main/app src/renderer/src/features/chat` (비-DB, `pretest` 우회).
- 문서 게이트: `node app/scripts/check-doc-inventory.mjs --check`.
- 사람 실기: AC25(시각 — 첨부 양식 대조, 라이트/다크 두 테마) · AC20(2세션 전환) · mock `agent_task_board` 시나리오로 AC1~AC10 육안 확인.

## ΔV1 READY self-review

- [x] 여러 턴의 결정이 Ledger 에 보존 — D-001~D-014 유지, **D-003 만 SUPERSEDED**, 신규 D-015~D-027. 최신 턴에 안 나온 D-005·D-006·D-010 은 삭제하지 않고 D-016a 로 명시 승계했다.
- [x] 사용자 표현을 재해석하지 않았다 — "패널을 분리할 것"·"완전 복구이다"·"타이틀 우측에 나열"·"id 로 순자적으로"를 §3 에 **원문 인용**으로 실었다. "복구"를 "부분 이동"으로 바꾸지 않았고, D-016a 가 *무엇을 복구하지 않는지*(중단 수명주기)를 근거와 함께 적었다.
- [x] 사용자 결정과 코드 조사를 갈랐다 — 물은 것 4건(나열 방식·중단 버튼·타일 슬롯·섹션 범위), 조사로 닫은 것: `TaskStop` 대상(SDK 실측) · 예약 타일이 메뉴에 안 뜬다는 사실 · `reason:'failed'` 사이트 2/10 · 문서 드리프트 2건.
- [x] 수치·전칭 표현 실측 — '중단' 문자열 **10 사이트 전수 열거** 후 2/8 분해. `reserved2` 참조 6곳. EP-13 지점 5. 승계 숫자 0건(EP-07 분모는 verify 실측으로 2→3 정정).
- [x] 저장소 규칙을 설계 입력으로 확인 — `renderer/AGENTS.md` 의 시맨틱 토큰·`group/<이름>` 스코프·400줄 분해 트리거(그래서 `TaskTileSections.tsx` 를 분리), boundaries(신규 파일이 `features/chat` 내부).
- [x] 각 AC 가 행동 단언·검증 수단·도달 경로 3칸 보유(11행 전수).
- [x] Delta V 를 썼다 — `72766d2:V1` 기준, 변경이 시작되는 수준(R-04a)부터 아래로. 영향 없는 V1 pair 12개를 복사하지 않았다.
- [x] 모든 `NEW`·`CHANGED` 왼쪽 노드에 같은 레벨 pair — R-04a→VP-20 · R-11→VP-21 · R-12→VP-22 · R-13→VP-23 · R-14→VP-24 · SD-04→VP-25 · AR-02a→VP-26 · AR-04→VP-27 · MD-02a→VP-28 · MD-04→VP-29. **차집합 0.**
- [x] 영향받은 INHERITED 상위는 REGRESSION — VP-08(D-023 이 파생을 바꾼다) · VP-06·12·16(D-016a 가 유지를 주장한다). 나머지 12 pair 만 무변경 INHERITED.
- [x] 적대 증거는 필요한 pair 에만 — VP-22(파생 0건 주장) · VP-29(회귀 방향). 각각 심을 변이를 적었다.
- [x] "X 가 쓰인다" 불변식의 장치 방향 — AT-26/27/28/30/31 은 그 X 를 지우면 red 다(§AC 게이트 재통과의 방향 항목에 지움 대상을 적었다).
- [x] 상호배타 상태의 불가능 조합을 타입이 막는다 — `TaskStatusIcon` 판별 union(`pending` 만 `badge`).
- [x] 신규 모듈마다 레이어·강제 지점·seam — `TaskTileSections.tsx`(features/chat · EP-16 · 렌더+음성 스윕) · `taskBoardOrdered`(lib · EP-14 · 순수).
- [x] end-to-end 로 닫혔다 — producer(`subagent-settlement.ts:28`) → 파생(`parts.ts` MD-04) → 두 소비자(두 타일). transcript 3행의 배선(EP-17)까지 포함.
- [x] 다중 저장소 쓰기 검사 — **문서 사본 2곳**: 이 `plan.md` 의 판정과 `INDEX.md` 보드 행. 함께 갱신하지 않으면 두 사본이 다른 말을 한다 → 이번 커밋이 둘을 같은 커밋에 담는다. 코드 쪽 다중 저장소 쓰기는 없다(신규 IPC 0 · DB 0).
- [x] worst-case — 신규 네트워크 요청 0 · 신규 영속 필드 0. `taskBoardOrdered` 는 `O(n log n)`, n = 세션 Task 수.
- [x] 본문 ↔ Ledger 교차검증 관측을 §3 갱신 메모에 남겼다(`충돌 0`, 확인한 쌍 10개 + 비충돌 판정 2건).
- [x] 문장 규칙 — 판정 먼저 · 주장 한 줄에 관측 하나 · Part I(관측)/Part II(경로) 중복 없음.
- [x] **규범 행과 구현 산출을 같은 커밋에 담지 않는다** — 이 ΔV1 설계 커밋은 `2 files changed`(`plan.md` · `INDEX.md`), `app/**` 0파일. trailer 파싱 `git log -1 --format='%(trailers:only=true)'` → **5키 반환**(`Agent: claude` · `Status: designed`, `Criteria-*`/`Next-Action` 없음).

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 여러 턴의 결정을 보존한다 — ACTIVE 13 · SUPERSEDED 1(D-012 → D-014). D-005 는 0143 코드 결정을 대체(대체 관계 칸에 기록).
- [x] Part I 만 읽어도 사용자/제품 완료 상태가 이해된다 — §5 전이표가 구현 파일을 언급하지 않는다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — 명세의 "즉시 '중단됨'으로 확정하지 않는다"·"별도의 주기적인 TaskOutput polling으로 구현하지 않는다"를 원문으로 D-005·D-011 에 인용했다.
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다 — §5 전이표 18행이 AC1~AC25 와 §9 TO-BE 경로로 각각 이어진다.
- [x] Technical Design 에 AS-IS 와 TO-BE 가 모두 있고 같은 비교 축으로 작성됐다.
- [x] AS-IS → TO-BE Delta 의 각 변경이 구현 파일/모듈 또는 AC 에 추적 가능하다 — Delta 7행 전부 §11 파일 또는 VP 를 가리킨다.
- [x] AS-IS 에서 사라진 책임은 명시했다 — `SubAgentTileContent.tsx` 는 `TaskTileContent.tsx` 로 **대체**(§11 · §18), 즉시 낙관 정착은 **삭제**(D-005).
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 조사 8행 + 검산 4항.
- [x] 각 AC 가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — §7 표 3칸.
- [x] Baseline V 를 썼고 유효 V 를 재구성할 수 있다 — 상속 기준 `none`.
- [x] 변경 효과에 필요한 레벨을 선택했고 모든 NEW node 에 같은 레벨 REQUIRED pair 가 있다 — R 10·SD 3·AR 3·MD 3 전부 pair 보유.
- [x] 영향받은 INHERITED node 는 REGRESSION, 비영향 node 만 NOT_REQUIRED 다 — Baseline 이라 INHERITED 없음.
- [x] 각 pair 의 경로·§10 전수 분모·직접 oracle 이 있고 적대 증거가 필요한 pair 만 선택 이유·변이를 갖는다 — VP-06·VP-16 두 pair 만 0건 주장이라 변이를 요구했다.
- [x] 현재 변경 산출물의 운영 gate 가 열거됐고 관련 없는 기존 실패를 새 blocking 범위로 만들지 않는다 — DB 로드 스위트 실패는 기준선 분리.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 그룹 순서·상태 파생·키 생성은 전부 UT.
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — AC22 의 0건 스윕에 3개 resolve 케이스 양성 짝을 붙였다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다 — §10 EP-01~EP-11.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 4행.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12.
- [x] 상한·총량·one-way door 를 필요한 곳에서 계산했다 — §14, §17.
- [x] 게이트 명령이 대상 subtree 의 현재 `AGENTS.md` 와 충돌하지 않는다 — `npm test` 대신 lint+typecheck+직접 vitest(§19).
- [x] 본문 완성 후 Decision Ledger 와 기존 결정을 전체 교차검증했고 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다 — Part I 은 관측 결과, Part II 는 경로·계약. 같은 사실을 양쪽에 쓰지 않았다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: Part I 전부와 Part II §9~§14. AS-IS 조사가 실제 코드와 맞았다 — background 목록·listen·채널 사망 정착은 이미 있었고 이번 작업은 일반 Task fold·통합 타일·`중단 중`에 집중됐다.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision 과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·14·17 | EP-01 `structuredOutput` 은 Task 도구에만 | `claude-map` tool_result 매핑 (1) | 1/1 | `rg -n "isTaskToolName" app/src --glob '!*.test.ts'` → 5행 / 게이트 지점 `claude-map.ts:329` · 소비 `taskBoard.ts:163` | — |
| VP-02·17 | EP-02 `success===true` 만, 상태는 `statusChange.to` 우선 | 결과 파싱 (1) | 1/1 | 케이스 `success 가 true 가 아니면 관측이 없다 (미지정 포함 — fail-closed)` · `statusChange.to 를 상태의 권위로 읽는다` | — |
| VP-03·17 | EP-03 `TaskList` 전체 스냅샷 — 부재 제거 | fold 중 snapshot (1) | 1/1 | 케이스 `TaskList 스냅샷이 상태 교체·신규 추가·부재 제거를 모두 수행한다` (id `9` 부재 단언) | — |
| VP-04·18 | EP-04 키 네임스페이스 분리 | 키 생성 + 선택 상태 (1) | 1/1 | 케이스 `같은 문자열 id 를 가진 두 종류가 서로 덮어쓰지 않는다` → 2건 | — |
| VP-05·11 | EP-05 턴-후 갱신 2지점 | `post-turn.ts` listen · store transient (2) | 2/2 | `git diff --stat -- app/src/main/app/chat-turn/post-turn.ts app/src/renderer/src/features/chat/store/chatStore.ts` → post-turn **변경 0줄**(경로 무변경), store 는 `subagent.task` transient 흡수 그대로 | — |
| VP-06·12·16 | EP-06 중단 확정 3지점 | 즉시 정착 없음 · enrich 게이트 · watchdog (3) | 3/3 | (1) `SDK 확정을 기다리며, 요청 시점에는 합성 정착을 하지 않는다` (2) `사용자가 중단한 태스크의 settled 는 영수증이 관측됐어도 background 미부여` (3) `확정이 없으면 합성 정착으로 마감한다` | — |
| VP-07·13·14 | EP-07 구조화 출력 쓰기 지점 | 라이브 이벤트 · writer (2) — **실측 3** | 3/3 | `rg -n "structuredOutput" app/src --glob '!*.test.ts'` 중 이 필드의 쓰기 지점 = `claude-map.ts:355`(생산) · `writer.ts:272`(영속) · `chatReducer.ts:466`(라이브 파트). 셋 다 결함 심기로 확인 | — |
| VP-08 | EP-08 fold 입력은 그 세션 messages 뿐 | 렌더 시점 (1) | 1/1 | `rg -n "chatStore|useChatSession" app/src/renderer/src/features/chat/lib/taskBoard.ts` → **0건**(전역 상태 미참조, 시그니처가 강제) | — |
| VP-09·19 | EP-09 polling 금지 | 중단 대기 (1) | 1/1 | `rg -n "TaskOutput" app/src/main --glob '!*.test.ts'` → 1행, **전부 주석**(코드 참조 0) · `rg -n "setInterval" <신규 main 2파일>` → 0 | — |
| VP-10 | EP-10 상세는 종류별 정보만 | 렌더 (1) | 1/1 | 케이스 `background Task 는 …설명/의존성 행이 없다` (`not.toContain` 2건) | — |
| VP-15 | EP-11 타일 개명 4곳 | 정의·레지스트리·reducer 특례·i18n (4) | 4/4 | `rg -n "'subagent'" app/src/renderer/src` → **0건** · 개명 후 `rg -n "'task'" .../rightPanelTiles.ts .../tileRegistry.ts .../chatReducer.ts` → 각 1·2·1 | — |

- §10 에 없는데 같은 불변식이 필요했던 지점: **1건 — EP-07 의 세 번째 쓰기 지점**(renderer reducer 의 `tool_result` 파트 조립). §10 은 "라이브 이벤트 · writer" 2곳으로 적었는데, 라이브 이벤트가 파트가 되는 hop 이 하나 더 있고 거기서 필드를 떨어뜨리면 **재로드 전까지 목록이 비어 보인다**. 현재 pair(VP-07/AC18)에 귀속되는 지점이라 선조치했고, §10 행의 지점 수를 2→3 으로 정정할 것을 제안한다(아래 §plan 수정 제안 1).

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `taskBoard.test` AC1/AC2 2케이스 | not selected — 항목 수를 직접 관측 |
| VP-02 | REQUIRED | SELF_PASS | `task-tool.test` TaskUpdate 6케이스 | not selected |
| VP-03 | REQUIRED | SELF_PASS | 스냅샷 id 집합 차집합 단언 | not selected |
| VP-04 | REQUIRED | SELF_PASS | 키 충돌 케이스 2건 | not selected |
| VP-05 | REQUIRED | SELF_PASS | listen 경로 무변경(diff 0줄) + 기존 `post-turn.test.ts` green | not selected |
| VP-06 | REQUIRED | SELF_PASS | `stop-subagent.test` 9케이스 | **required** — 변이 2종 red 확인(아래 잠금 표) |
| VP-07 | REQUIRED | SELF_PASS | reducer·writer·taskBoard 3층 단언 | not selected(직접) + 변이 2종 red |
| VP-08 | REQUIRED | SELF_PASS | 전역 참조 0건 + 시그니처 | not selected |
| VP-09 | REQUIRED | SELF_PASS | `waitForTask` 6케이스 | not selected — resolve 를 직접 관측 |
| VP-10 | REQUIRED | SELF_PASS | `taskDetailRows` 2케이스 | not selected |
| VP-11 | REQUIRED | SELF_PASS | 경로 무변경 | not selected |
| VP-12 | REQUIRED | SELF_PASS | 확정·watchdog 두 종단 | not selected |
| VP-13 | REQUIRED | SELF_PASS | 라이브 파트 → fold 동등 + 영속 payload | not selected |
| VP-14 | REQUIRED | SELF_PASS | `claude-map.test` 3케이스 | **required** — 게이트 제거 변이 red |
| VP-15 | REQUIRED | SELF_PASS | 개명 전수 0건 + typecheck | not selected |
| VP-16 | REQUIRED | SELF_PASS | coordinator 음성 + 양성 짝 2케이스 | **required** — 게이트 제거 변이 red |
| VP-17 | REQUIRED | SELF_PASS | `task-tool.test` 17케이스 | not selected |
| VP-18 | REQUIRED | SELF_PASS | `taskBoard.test` 17케이스 | not selected |
| VP-19 | REQUIRED | SELF_PASS | `background-tasks.test` waitForTask 6케이스 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| `turn-coordinator.ts:264` — enrich 의 `!turn.stoppedSubagents.has(...)` 삭제 | `VP-06·VP-16 선택 증거`(AC17 0건 주장) | **1차: 0건 — 잠금 없음** → oracle 정정 후 `사용자가 중단한 태스크의 settled 는 … background 미부여` 1 failed | 잠김(정정 후) |
| `stop-subagent.ts` — 0143 낙관 정착 복원(요청 직후 합성 정착) | `VP-06 선택 증거`(AC12 "즉시 확정 안 함") | `SDK 확정을 기다리며…` 외 3건 | 잠김 |
| `claude-map.ts:329` — `isTaskToolName` 게이트를 `true` 로 | `VP-14 구조·전수 oracle 민감도`(EP-01) | `Task 도구가 아닌 결과에는 structuredOutput 을 싣지 않는다` 1건 | 잠김 |
| `chatReducer.ts:466` — 라이브 파트에서 `structuredOutput` 드롭 | `VP-07·VP-13 배선 존재 oracle`(AC18) | `라이브 이벤트로 만든 파트만으로…` 외 1건 | 잠김 |
| `writer.ts:272` — 영속 payload 에서 `structuredOutput` 드롭 | `VP-07 배선 존재 oracle`(EP-07) | `structuredOutput 을 tool_result payload 에 싣는다` 1건 | 잠김 |

> **첫 변이가 무음이었던 것이 이 라운드의 실질 산출이다.** 최초 AC17 테스트는 스트림에 async_launched 영수증을 넣었는데, `coerceStoppedToolCompletion` 이 그 영수증을 먼저 aborted 로 바꿔 `markAsyncLaunched` 자체가 일어나지 않았다 — 그래서 게이트를 지워도 `isAsyncLaunched` 가 false 라 결과가 같았다. 영수증 관측을 tracker 에 직접 심어(중단 클릭 **이전** 관측을 재현) 게이트가 판정에 참여하게 만든 뒤에야 변이가 red 가 됐고, 같은 조건의 양성 짝(`중단하지 않은 태스크는 … background:true`)을 붙여 방향을 고정했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ 전부 있다 | `chat.taskTile.*` 25키 — 목록/그룹/상세/배지/중단 실패가 각각 렌더 지점을 갖는다. `stopFailed` 는 `TaskRow` 의 `stopError` 줄이 유일한 소비자다 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ 전부 표에 있다 | `stop 요청 거절`·`watchdog timeout`·`채널 종료` 3행. **표에 없던 것 1건**: 턴이 없는 세션에서 중단을 누르는 경우 → 구 코드는 조용히 성공했다. 지금은 reject 하므로 `stop 요청 거절` 행으로 수렴한다 |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | ✅ | 요청 실패 시 `중단 중` 이 풀리고 카드 아래에 사유가 붙는다(`taskStopErrors[key]`). 구 코드에는 실패 표시가 아예 없었다 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | ✅ | `stopping` 해제는 **부모 Task 결과 도착**이 유일한 신호라 순서에 무관하다. watchdog 합성 정착과 진짜 확정이 겹쳐도 `settled` 는 멱등(트래커 delete 실패 시 no-op) |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | §10 EP-07 이 쓰기 지점을 2곳으로 셌으나 실제는 **3곳** — 라이브 이벤트가 파트가 되는 reducer hop 이 빠졌다 | 📝 **plan 수정 제안** — EP-07 의 `언제 강제` 를 `(1) 이벤트 방출 (2) renderer 파트 조립 (3) writer payload` 로, 전수 `2`→`3` 으로 정정 | 그 hop 을 빠뜨리면 재로드 전까지 목록이 빈다. 변이로 확인(잠금 표 4행) |
| 2 | `structuredOutput` 이름이 기존 어댑터 **capability 플래그**와 겹친다 | ⚠️ 보고만 | `adapters/descriptor.ts:40` 의 `structuredOutput: true`(Options.outputFormat 지원 여부)와 이름만 같고 타입·위치가 다르다. 혼동 가능하나 개명은 공개 파트 필드 변경이라 사용자 결정 |
| 3 | `TaskList`/`TaskGet` **보정으로만** completed 가 되는 Task 는 배지를 켜지 않는다 | ✅ 선조치(범위 명시) | 전이의 권위는 `TaskUpdate.statusChange` 다. 보정은 "지금 상태가 이렇다" 이지 "방금 끝났다" 가 아니라 배지를 켜면 재보정마다 알림이 생긴다. `chatReducer.ts` 주석에 명시 |
| 4 | `parts.ts` 에 tool_result→ToolCall 변환 본문이 **3벌 복사**돼 있었다 | ✅ 선조치 | 이번에 필드를 하나 더하면서 세 곳이 갈라질 수 있었다 — `resultMap(parts)` 한 곳으로 접었다(`parts.ts:80`·`:449`). 동작 변화 없음, 기존 `parts.test.ts` green |
| 5 | mock 시나리오 개수가 테스트 **제목**(`12종`)에 박혀 있었다 | ✅ 선조치 | 시나리오를 늘리자 제목과 배열이 갈라졌다. `MOCK_SCENARIO_IDS` 대조로 바꿔 개수를 코드가 갖게 했다(root `AGENTS.md` 원칙 4 와 같은 축) |
| 6 | 일반 Task 는 GUI 에서 중단/편집할 수 없다 | ⚠️ 보고만 | 명세가 요구하지 않았고 §6 비범위다. `canStopTask` 가 `kind==='background'` 로 잠가 UI 에 오해 여지가 없다 |

### 설계 대비 명시적 차이

- plan 이 지정한 것과 다르게 구현한 것과 그 이유: **1건** — §11 은 중단 흐름을 `app/chat-turn/index.ts` 에 두라고 적었으나 `features/chat/stop-subagent.ts` 로 **분리**했다. 이유: `app/` 은 배선 레이어라 IPC 없이 테스트할 수 없고(`src/main/AGENTS.md §작업 규칙 1`), AC12~AC16 이 전부 이 흐름의 판정이다. 계약·경로·강제 지점은 그대로다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 시한은 `timeoutMs` 인자 하나뿐이고 캐시·자격증명 같은 만료 상태를 새로 만들지 않았다 | AC15 `확정이 없으면 합성 정착으로 마감한다`(timeoutMs 5ms 주입) |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | **있다** — `stoppedSubagents`·`blockedSubagents` 는 turn 이 공유하고 lease 재사용이 `clear()` 한다(`session-chain-lease.ts:166`). 요청 실패 시 되돌리지 않으면 다른 경로가 이 태스크를 stopped 로 강등한다 | AC14 `채널이 죽었으면 throw 하고 중단 표식을 되돌린다` — `stoppedSubagents.has` false 단언 |
| 재진입 | **있다** — 같은 태스크에 중단을 두 번 누르면 요청이 두 번 나간다 | UI 에서 막았다: `canStopTask` 가 `stopping` 을 제외한다(케이스 `중단 중에는 버튼을 다시 누를 수 없다`). reducer 도 `TASK_STOP_REQUESTED` 를 멱등 처리 |
| 다른 무효화 축 | **있다** — watchdog 합성 정착과 진짜 SDK 확정이 겹칠 수 있다 | `tracker.settled` 는 미존재 키에 no-op 이고 `settleSubagentTask` 는 `openToolRuns` 에서 이미 지워진 항목을 건너뛴다 — 중복 정착이 이벤트를 두 번 만들지 않는다(`settle.ts:56` delete 후 재호출 no-op) |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 27 수정 + 9 신규 · 1 삭제(`SubAgentTileContent.tsx` → `TaskTileContent.tsx` 대체). `git diff --stat -- app/` = 794 insertions / 398 deletions |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `npm rebuild better-sqlite3`(Node ABI) |
| **관측한 게이트 산출**(exit code 아님) | lint **0 error · 1 warning**(warning 은 기존 `TranscriptVirtualizer` 의 `react-hooks/incompatible-library`, 변경 무관) · typecheck 3구성 **출력 0줄** · vitest **235파일 / 2413 케이스 통과, 실패 0**. 로드 실패 1파일 = `chat-turn.continuity.test.ts`(`electron` import) — **stash 후 기준선에서 동일 실패 재현**, 환경 기인(ELECTRON_SKIP_BINARY_DOWNLOAD) · inventory `9 items, 79 channels` + prose/links ok |
| V-pair 자기확인 | `SELF_PASS 19 / SELF_BLOCKED 0`; pair 별 상세는 위 표 |
| 강제 지점 전수 | **18/18** (EP-05 2 · EP-06 3 · EP-07 3(§10 은 2로 적었다, 위 제안 1) · EP-11 4 · 나머지 각 1) |
| **AC 자기보고**(`Criteria-Met`) | 21/25 — 아래 합계 검산 참조 |
| **합계 검산** | `✅ 21 · ⚠️ 4 · ❌ 0 = 총 25`. 분모 25 는 §7 표 행 수를 다시 세어 확인했고 이번 라운드에 AC 를 나누거나 더하지 않았다. ⚠️ 4 = AC11(경로 무변경·기존 커버리지) · AC20(2세션 실기) · AC21(경로 무변경) · AC25(시각 실기) |
| 블로커 / 역질문 | 없음. 사람 실기 2건(시각·2세션)과 CLI 실환경에서 TaskXXX 가 실제로 호출되는지의 확인이 남는다 — 후자는 §17 리스크 1이고 mock `agent_task_board` 가 렌더 경로를 CLI 와 독립 검증한다 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

### AC 자기보고 상세

| AC | 판정 | 이번 턴에 재현한 관측 |
|---|---|---|
| AC1·AC2 | ✅ | `taskBoard.test` — `성공 결과가 도착해야 항목이 생긴다` (pending 0건 / settled 1건) · `실패한 TaskCreate 는 항목을 만들지 않는다` |
| AC3~AC6 | ✅ | 같은 파일 TaskUpdate 4케이스 — 중복 없음(1건) · 제목 교체 · deleted 제거 · `success:false` 무변화 |
| AC7·AC8 | ✅ | `TaskList 스냅샷이 상태 교체·신규 추가·부재 제거를 모두 수행한다`(id 9 부재) · `TaskGet 은 그 id 만 갱신하고 task:null 은 제거한다` |
| AC9·AC10 | ✅ | `background 항목만 실행 메타를 갖고…` · 그룹 배열 `['in_progress','pending','completed','aborted','failed']` 동등 단언 |
| AC11 | ⚠️ | listen 경로 **변경 0줄**(`git diff -- app/src/main/app/chat-turn/post-turn.ts` 빈 출력) + 기존 `post-turn.test.ts` green. 턴-후 실제 갱신은 사람 실기 |
| AC12 | ✅ | `중단 요청 중인 background 는 stopping 이고 진행 중 그룹에 남는다` + reducer `요청은 중단 대기에 넣고…` |
| AC13 | ✅ | coordinator `사용자가 중단한 태스크의 settled…`(부모 결과 `reason:'aborted'`) + taskBoard 그룹 테스트의 `aborted` 행 |
| AC14 | ✅ | `stop-subagent.test` 2케이스(no-channel / stopTask 거절) + reducer `요청 실패는 대기를 풀고 사유를 남긴다` |
| AC15 | ✅ | `확정이 없으면 합성 정착으로 마감한다` — `onWatchdog` 호출 + `settled` 1건 |
| AC16 | ✅ | `turn 전체를 중단하지 않는다 — 다른 열린 도구는 그대로다` |
| AC17 | ✅ | coordinator 음성 + 양성 짝 2케이스, 변이 red 확인 |
| AC18 | ✅ | reducer `라이브 이벤트로 만든 파트만으로 작업 목록이 파생된다` + writer payload 단언 + 로드 경로가 payload 를 통째로 spread(`dto.ts:52`) |
| AC19 | ✅ | reducer 배지 4케이스(켜짐/안 켜짐/해제/중단 제외) + `rg notifyApi <신규 5파일>` → 0건 |
| AC20 | ⚠️ | `rg "chatStore\|useChatSession" taskBoard.ts` → **0건**(EP-08 구성상 성립) + 라우팅 코드 무변경. 2세션 전환은 사람 실기 |
| AC21 | ⚠️ | `settleDeadBackgroundTasks` 무변경 + taskBoard 가 `failed` 를 실패 그룹으로 사상(그룹 테스트). 채널 사망 실기는 사람 몫 |
| AC22 | ✅ | `waitForTask` 6케이스(settled/clear/즉시/timeout/타세션/구독해제) + `rg TaskOutput app/src/main` → 1행 전부 주석 |
| AC23 | ✅ | `TaskOutput·TaskStop 호출은 목록을 만들지 않는다`(0건) |
| AC24 | ✅ | `taskDetailRows` 2케이스 — 종류별 labelKey 배열 동등/부재 단언 |
| AC25 | ⚠️ | `rg "#[0-9a-fA-F]{3,6}" <신규 tsx 2파일>` → 0건. 시각 대조는 사람 실기 |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음 — r1 이다.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: EP-07 의 지점 수(2→3)는 plan 이 producer/consumer 를 셀 때 **파트 조립 hop 을 레이어로 세지 않아서** 빠졌다. §10 작성 시 "이벤트 → 파트 → DB" 를 세 층으로 나눠 세면 걸렸을 것이다.
- 반복해서 부딪히는 환경 한계: `chat-turn.continuity.test.ts` 가 `electron` 을 import 해 이 환경에서 로드 실패한다(기준선 동일). better-sqlite3 는 `npm rebuild` 로 Node ABI 를 맞춰 DB 스위트까지 green 으로 돌렸다.
- 현재 라운드 수: 1

---

---

# 라운드 2 (ΔV1) — 패널 분리 · cowork 3섹션 · verify r1 파생 이슈

## [구현자 기입] 설계 리뷰 — r2

| 항목 | 판정 | 근거 |
|---|---|---|
| ΔV1 규범 행이 구현 가능한가 | 가능 | Decision 13건·AC 11행·pair 14·EP 7신설 모두 코드 지점으로 사상됐다. `PLAN_GAP` 0 |
| 인용한 기존 테스트가 실재하는가 | **실재** | AT-32 양성 짝으로 인용한 두 케이스를 확인했다 — `chatReducer.task.test.ts` 의 `부모 Task 결과가 도착하면 중단 대기가 풀린다`(:101) · `TaskUpdate 의 completed 전이가 배지를 켠다`(:124). 둘 다 제거 대상 4종을 거치지 않는 실제 경로다 |
| 인용 커밋이 실재하는가 | 실재 | `git show 72766d2:.../SubAgentTileContent.tsx` 가 245줄을 돌려준다 — D-016 복구 원본 |
| §7-B 조사표의 수치가 맞는가 | **1건 정정** | 「예약 타일이 메뉴에 안 뜬다」 행은 맞다(`ChatTitleBar.tsx:23`). 다만 `reserved2` 참조를 **6** 으로 적었는데 실측 **파일 6 · 행 9** 다(`git grep -c reserved2 HEAD -- app/src`: ChatTitleBar 1 · tileRegistry 1 · rightPanelLayout.test **4** · rightPanelTiles 1 · en 1 · ko 1). plan 의 6 은 **파일 축**이고 일치한다 — 분모 단위를 여기 적어 둔다 |

## [구현자 기입] 강제 지점 전수 (§10 대조) — r2

각 행의 `재현 명령` 은 이번 턴에 실제로 실행한 것이다.

| EP | plan 분모 | 실측 | 재현 명령 | 관측 |
|---|---|---|---|---|
| EP-12 | 2 | **2/2** | `rg -n "action.id === 'task'\|action.id === 'subagent'" chatReducer.ts` | `:909` `:910` 두 분기 |
| EP-13 | 5 | **5/5** | 지점별 `rg` 5회(아래) | ①`rightPanelTiles.ts:9` ②`tileRegistry.ts:9` ③`tileRegistry.ts:26` ④`chatReducer.ts:910` ⑤`ko.ts`+`en.ts` 각 1 |
| EP-14 | 1 | **1/1** | `rg -n taskBoardOrdered src -g '!*.test.ts'` · `rg -n "\.sort\(" rightpanel/` | 소비 `TaskTileContent.tsx:50` 1곳 · 컴포넌트 프로덕션 `.sort(` **0**(유일 히트는 테스트 파일의 인덱스 단조 단언) |
| EP-15 | 1 술어 + 2 생산 | **3/3** | `rg -n "if \(reason\) return" parts.ts` · `rg -n "reason: 'failed'" settle.ts subagent-settlement.ts` | 술어 `parts.ts:340` · 생산 `settle.ts:26` `subagent-settlement.ts:28` |
| EP-16 | 2 | **2/2** | `rg -c "^import.*(lib/parts\|lib/taskBoard\|store/chatStore\|reducer/chatReducer)" TaskTileSections.tsx` | 섹션 2개(`:67` `:71`) · 세션 파생 import **0건** |
| EP-17 | 3 | **3/3** | `rg -n "chatActions.openSubagentTask" transcript/` · `rg -c "chatActions.openTask" transcript/` | 3행(`SubagentNoticeRow:54`·`AgentTaskRow:75`·`AgentTaskBody:40`) · 잔여 `openTask` **0건** |
| EP-18 | 4 | **4/4** | 심볼별 `rg -c <심볼> app/src` ×4 | `taskBoardSettledKeys`·`isBackgroundTask`·`MARK_SETTLED_TASKS`·`TASK_STOP_SETTLED` 전부 **0건** |
| EP-07 | 3(ΔV1 정정) | **3/3** | `rg -n structuredOutput claude-map.ts writer.ts chatReducer.ts` | `claude-map.ts:385` · `writer.ts:275` · `chatReducer.ts:469` — D3 의 분모 정정이 실측과 일치 |
| EP-08 | 1 | **1/1**(REGRESSION) | `rg -c "chatStore\|useChatSession\|getState" taskBoard.ts` | **0건** — import 4개가 전부 타입·shared·parts |
| EP-06 | 3 | **3/3**(REGRESSION) | 변이 D·E (아래 잠금 절) | (1)(3)은 변이 E 가 3 red, (2)는 변이 D 가 1 red |

**합계 검산: `2+5+1+3+2+3+4+3+1+3 = 27`.** ΔV1 신설 7행이 **20**, REGRESSION 으로 다시 닫은 V1 행이 **7**(EP-07 3 · EP-08 1 · EP-06 3)이다. 미충족 **0**.

### V-pair 자기확인

| Pair | 자기 상태 | 증거 |
|---|---|---|
| VP-20 (R-04a↔AT-09a/10a) | SELF_PASS | `taskBoard.test` AT-10a 2케이스(수치순·비수치 전순서) + 렌더 `두 파생이 다르다` 차집합 0 |
| VP-21 (R-11↔AT-28) | SELF_PASS | 렌더 3케이스 — 그룹 순서 배열 단조 · 3줄 필드 · child transcript |
| VP-22 (R-12↔AT-26/27/29) | SELF_PASS | 렌더 4케이스 + **변이 A**(섹션에 세션 파생 import) 스윕 red |
| VP-23·VP-25 (R-13/SD-04↔AT-30) | SELF_PASS | reducer 3케이스 — 선택 2방향 · 제거 2방향 · 열기 2방향 |
| VP-24 (R-14↔AT-32/33) | SELF_PASS | 4종 0건(음성) + 배지·중단해제 기존 2케이스(양성) + 문서 3관측 |
| VP-26 (AR-02a↔IT-02a) | SELF_PASS | typecheck 3구성 0 + AT-28 헤더 출력 단언(③은 `Partial` 이라 typecheck 무관) |
| VP-27 (AR-04↔IT-04) | SELF_PASS | EP-17 3/3 + 잔여 `openTask` 0 |
| VP-28 (MD-02a↔UT-02a) | SELF_PASS | `taskBoardOrdered` 2케이스 |
| VP-29 (MD-04↔UT-04) | SELF_PASS | `parts.test` AT-21 2케이스 + AT-31 + **변이 B** red |
| **VP-08** (REGRESSION) | SELF_PASS | AT-21 이 `failed`/`aborted` 양방향을 단언 — 변이 B 가 이 pair 도 red 로 만든다 |
| **VP-06·12·16** (REGRESSION) | SELF_PASS | 변이 D(1 red) · 변이 E(3 red) 재실행 |

## [구현자 기입] 이번 라운드 수정의 잠금 — r2

plan 이 적대 증거를 선택한 pair(VP-22·VP-29)와 REGRESSION 인용 변이(VP-06·VP-16), 그리고 **이번 턴에 새로 만든 구조적 oracle**(AT-26·AT-27)만 다룬다. 나머지는 `해당 없음 — 직접 oracle`.

| # | 심은 결함 | 대상 | 재측정 | 판정 |
|---|---|---|---|---|
| A | `TaskTileSections.tsx` 에 `import { taskBoardFromMessages }` 추가 | VP-22 (AT-29 파생 0건) | 스윕 `0건 → 1건` | 검출 |
| B | `isAbortedResult` 의 `reason` 우선 분기 삭제(수정 전 코드로 복귀) | VP-29 · VP-08 | `1 failed / 416 passed` — `AT-21` | 검출 |
| C | 제목에 `flex-1` 복귀 + `line-through` 제거 | AT-26·AT-27(신규 구조적 oracle) | `2 failed / 7 passed` | 검출 |
| D | coordinator enrich 의 `!turn.stoppedSubagents.has(...)` 제거 | VP-16 (EP-06②) | `1 failed / 281 passed` | 검출 |
| E | 요청 직후 즉시 합성 정착 복원(0143 회귀) | VP-06 (EP-06①③) | `3 failed / 166 passed` | 검출 |

- **스윕의 실재 판정을 한 번 고쳤다.** EP-16 을 처음엔 `rg "messages|parts"` 로 셌더니 **내가 쓴 주석 1건**이 걸렸다 — 낱말이 아니라 **import 그래프**가 불변식의 주어라서, 술어를 `^import.*(lib/parts|lib/taskBoard|store/chatStore|reducer/chatReducer)` 로 바꿨다. 변이 A 는 바꾼 술어로 검출을 확인한 것이다.
- 변이 5건 모두 적용 후 원본 복원했고 `git diff --quiet <파일>` 로 HEAD 동일을 확인했다. 게이트 후 변경 파일 수 **22** 로 불변.

## [구현자 기입] Product/UX 파생 검토 — r2

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 사용자 대면 문구에 소비자가 있는가 | **있다 — 렌더로 확인** | `sections.*` 3종 → AT-29 · `failedReason`/정착 사유 → 신설 케이스 `작업 타일의 실패 행이 정착 사유를 그대로 보인다` · `subagentTile.status.stopping` → 신설 케이스. **producer 만 만든 문구 0건** |
| 실패가 "아무 일도 안 일어남" 으로 보이는가 | 아니오 | 중단 요청 실패는 `taskStopErrors` → 행 아래 빨간 줄(`TaskProgressList` 가 `stopErrors` 를 받아 내린다). 채널 종료는 이제 `실패` + 사유 문구 |
| 이번 실패 경로가 Part I 상태 전이표의 어느 행인가 | 전건 대응 | `채널 종료 → 실패 + 사유 문구` 행이 이미 있었다(D1 은 그 행이 코드에서 안 지켜진 것) |
| 빈 상태에서 무엇이 보이는가 | 3섹션이 그대로 | 항목 0건이면 `진행 상황` 이 안내문 한 줄, 나머지 두 섹션은 일러스트+설명. **타일 전체가 빈 화면이 되지 않는다** — 기존에는 전체가 빈 상태 카드였다 |
| 늦게 도착한 응답이 화면을 되돌리는가 | 아니오 | 두 선택 상태 모두 파생 목록에서 항목이 사라지면 목록 뷰로 떨어진다(dangling key → `undefined`) |
| 같은 항목이 두 타일에 보이는 것이 혼란인가 | **의도** | D-019. 책임이 다르다 — `백그라운드 작업` = 대화록 상세, `작업` = 한 줄 진행 요약. 파생 SSOT 는 `taskBoard.ts` 하나(EP-14) |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r2

| # | 발견 | 분류 | 대응 |
|---|---|---|---|
| I1 | `renderToStaticMarkup` + zustand 는 **항상 `getInitialState()`** 를 돌려준다 — store 연결 컴포넌트는 시드가 반영되지 않아 렌더 단언이 빈 출력에서 자동 참이 된다 | 구현 세부 | **선조치** — 순수 View 3종(`TaskProgressList`·`SubAgentTaskList`·`SubAgentTaskDetail`) 추출. 0203 의 `PinnedSectionView` 와 같은 seam 이다. 처음 작성한 store-시드 방식 테스트가 **7 failed** 로 이 사실을 드러냈다 |
| I2 | `TaskStatusIcon` 의 `index:number` 는 background 의 `toolUseId`(불투명 긴 문자열)를 18px 원에 넣는 조합을 타입이 허용했다 | 구현 세부 | **선조치** — plan 대로 판별 union(`{status:'pending'; badge}` \| `{status: Exclude<…>}`). 잘못된 칸은 컴파일 실패 |
| I3 | `chevronD` 아이콘이 없다 — 실제 이름은 `chevD` | 구현 세부 | 선조치. 아이콘 이름은 `Icon.tsx` 의 union 이라 typecheck 가 잡았다 |
| I4 | `ChatTitleBar.tsx:23` 의 `VISIBLE_TILE_REGISTRY` 가 `reserved2` 를 참조 — 정의 제거로 `TS2367` | 구현 세부 | 선조치. **plan §7-B 조사가 예고한 그대로** typecheck 가 `reserved2` 지점을 전부 드러냈다 — **4건**(`ChatTitleBar` 1 · `rightPanelLayout.test` 3; 같은 expect 블록의 2행이 1건으로 합쳐진다). 나머지 typecheck error 2건은 `taskBoard.test` 의 제거 심볼 import 라 다른 축이다 |
| I5 | `백그라운드 작업` 타일 복구본은 `stopping` 상태 어휘가 없었다(`72766d2` 는 4종) | 구현 세부 | 선조치 — D-016a 대로 `status.stopping` 라벨 신설 + 대기 중 버튼 숨김. **복구가 D-005 를 되돌리지 않는다**는 것을 렌더 케이스로 잠갔다 |
| I6 | `작업` 타일이 background 를 계속 보이므로, 같은 작업이 두 타일에 동시에 렌더된다 | **보고만** | D-019 의 직접 귀결이고 사용자 확정 사항이다. 재론하지 않는다 |
| I7 | 섹션 접힘 상태가 로컬 `useState` 라 **타일을 닫았다 열면 초기화**된다(모두 펼침) | **보고만** | D-027 이 로컬 상태를 택했다. 세션/전역 영속이 필요하면 제품 판단 — 다음 handoff 후보 |
| I8 | `출력`·`컨텍스트` 는 **항상 빈 상태**다 — 데이터가 붙기 전까지 사용자는 영원히 같은 문구를 본다 | **보고만** | D-022(사용자 확정). 첨부 이미지 자체가 빈 상태였다. 다만 "언제 채워지는가" 를 화면이 말하지 않는다는 점은 남는다 |

### 설계 대비 명시적 차이 — r2

**차이 1건: plan §11 이 `TaskTileContent.tsx` 를 store 연결 컴포넌트 하나로 두었으나, 순수 View 를 추출했다**(I1).

| 축 | 대체물이 갖고 원본이 갖지 않던 실패 모드 | 다시 확인한 AC/§10 |
|---|---|---|
| **공유** | View 가 `stopErrors` 를 props 로 받으므로, 래퍼가 전달을 빠뜨리면 중단 실패 문구가 조용히 사라진다(원본은 행이 직접 store 를 읽어 누락이 불가능했다) | `TaskProgressList` 기본값 `{}` + 래퍼 `TaskTileContent:294` 가 실제로 전달. AT-27 의 stopError 경로는 렌더 케이스가 덮지 않으므로 **미덮임으로 남긴다**(아래 사람 실기) |
| **재진입** | 없음 — View 가 상태를 갖지 않는다(접힘 `useState` 는 `TileSection` 소유이고 항목과 무관) | AT-29 의 `aria-expanded` 3건 |
| **만료** | 해당 없음 — 캐시·TTL 을 도입하지 않았다 | — |
| **다른 무효화 축** | 해당 없음 — `useMemo` 의존성(`messages`·`stopping`)은 원본과 동일하고 View 는 매 렌더 props 를 그대로 받는다 | 기존 `useTaskBoard` 무변경 |

**차이 2건째: `SubAgentTileContent.tsx` 도 같은 이유로 목록/상세를 View 로 갈랐다.** 축별 판정은 위와 동일하며, 추가 실패 모드는 `startedAtMs` 를 props 로 받는 것 하나다 — 래퍼가 `useSubagentMeta` 결과를 그대로 넘기고(`:122`) 원본과 같은 값이다.

## [구현자 기입] 구현 보고 — r2

| 항목 | 값 |
|---|---|
| 변경 파일 | **22**(수정 19 · 신규 3). `app/**` 19 · `docs/**` 1 · 나머지는 plan/INDEX(별도 커밋) |
| 신규 파일 | `TaskTileSections.tsx` · `rightPanelTiles.render.test.ts` · `SubAgentTileContent.tsx`(복구) |
| 관측한 게이트 산출 | `lint` **0 error · 1 warning**(`useTranscriptVirtualizer.ts:22` `react-hooks/incompatible-library` — 기존, 변경 무관) · `typecheck` **error TS 0건**(3구성) · `vitest` **236파일 / 2432케이스 / 실패 0** · `check-doc-inventory --check` **9 items, 79 channels · prose ok · links ok** |
| ABI 처리 | 최초 `vitest` 는 **5파일 / 48케이스 red** — 전부 `Module did not self-register: better_sqlite3.node`. `app/AGENTS.md §better-sqlite3 ABI` 가 적은 **실측 5파일과 정확히 일치**(`infra/db/{queries,migrate}` · `extensions/builder` · `orchestration/fork` · `app/chat-turn.continuity`). `npm rebuild better-sqlite3`(Node ABI) 후 전건 green |
| 인벤토리 수치 | 채널 **79** · variant **21** · 마이그레이션 **17** — **불변**(설계 예측대로 신규 IPC 0 · 신규 variant 0) |
| 게이트가 트리를 바꿨는가 | 아니오 — `lint --fix` 실행 후에도 `git status --short` **22** 로 불변 |
| 검증 중 잔여물 | 변이 5건 전부 원본 복원 확인(`git diff --quiet`). 백업은 scratchpad 에만 |

### AC 자기보고 상세 — r2

ΔV1 이 정정·신설한 11행만 센다. `V1` 의 나머지 22행은 이번 변경 경로에 닿지 않는 `INHERITED` 다.

| AC | 결과 | 이번 턴 재현 관측 |
|---|---|---|
| AC9a | ✅ | 렌더 `두 파생이 다르다` — 차집합 `[]`, board 가 `agent:1` 포함·background 파생은 미포함 |
| AC10a | ✅ | `taskBoard.test` — `['1','2','10',bgA,bgB]` 순서 동등 · 비수치 id `['3','alpha','beta']` |
| AC26 | ✅ | 완료 제목 class 에 `line-through` 有 · 진행 중 제목엔 無(양방향) |
| AC27 | ✅ | `/로그 파서 조사<\/span><button/` 매치 · 제목 class 에 `flex-1` 無 · `truncate` 有 · 버튼 실재 |
| AC28 | ✅ | 그룹 4종 인덱스 단조 증가 · 3줄 필드 · child 텍스트 · 중단 버튼이 '대화록 보기' 우측(제목 우측 아님) |
| AC29 | ✅ | 헤더 3종 + 설명문 2종 + `aria-expanded="true"` 3건 · 세션 파생 import **0건**(변이 A 로 감도 확인) |
| AC30 | ✅ | reducer 6단언 — 선택 2방향 · 제거 2방향 · 열기 2방향 |
| AC21 | ✅ | `reason:'failed'`+'중단' 메시지 → `failed` 2케이스(생산 지점 2곳 그대로) · `reason:'aborted'` → `aborted` 회귀 짝 |
| AC31 | ✅ | 요약 필드 + **화면 출력** 둘 다 — `채널이 종료되어 …` 가 실패 행에 실린다 · `aborted` 사유도 유지 |
| AC32 | ✅ | 4종 `rg` **0건**(음성) + 배지·중단 해제 기존 2케이스 green(양성) |
| AC33 | ✅ | `MockScenarioId.*13종` **0건** · `structuredOutput?` 존재 · 포인터 `MOCK_SCENARIO_IDS` 가 `ipc.ts:175` 실재 심볼 |

**검산: `✅ 11 · ⚠️ 0 · ❌ 0 = 총 11`**(ΔV1 분모). `V1` 22행 INHERITED 를 더하면 **33** 이고, 그중 r1 에서 ⚠️ 였던 **AC11·AC20·AC25** 는 이번에도 사람 실기로 남는다.

**남은 사람 실기**(기계로 못 내린 것만):

| 항목 | 기계가 닫은 범위 | 사람이 볼 것 |
|---|---|---|
| 3섹션 시각(D-017) | 헤더·접힘·파생 0건 | 첨부 cowork 이미지와 여백·구분선·일러스트 대조, 라이트/다크 |
| 중단 버튼 자리(D-020) | DOM 형제 순서 · `flex-1` 부재 | 제목이 길 때 실제 잘림/버튼 유지 |
| 복구 충실도(D-016) | 그룹 순서·3줄 필드·상세 | `72766d2` 와 시각 동일성 |
| 중단 실패 문구 | reducer 상태 전이 | `stopErrors` 가 화면에 실제로 뜨는지(렌더 케이스 미덮임 — 위 차이표) |
| AC11·AC20 | 경로·격리 | 턴-후 갱신 · 2세션 전환 |

## [구현자 기입] Review Signals — 사실만 — r2

- **이전 라운드와 같은 축인가**: 아니다. r1 의 D1 은 *권위 필드 vs 메시지 문구* 축이고 이번 라운드가 그것을 닫았다. 같은 불변식의 형제 지점을 4축으로 전수 검색해 **renderer 1 · main 0** 을 확인했다 — 남은 곳이 없다.
- **막았어야 할 plan 지침·AC 가 있었는가**: **있었다.** `V1` AC21 이 "`실패` 로 정착" 을 명시했으나 **UT pair 가 없어** 구현자가 "경로 무변경" 으로 대체할 수 있었다. ΔV1 이 `MD-04/UT-04` 를 신설해 그 자리를 메웠다 — 이번 라운드의 변이 B 가 그 pair 에 눈이 있음을 보였다.
- **반복해서 부딪히는 환경 한계**: better-sqlite3 ABI. 이번엔 `npm rebuild better-sqlite3` 로 전건 green 까지 갔다(r1 은 1파일 로드 실패를 남겼다). 대신 이 트리는 이제 Node ABI 라 `dev`/`build` 는 재빌드가 필요하다.
- **새로 관측한 도구 한계**: `renderToStaticMarkup` + zustand = 항상 `getInitialState()`. 저장소에 이 사실이 적힌 곳이 없어 처음 작성한 테스트 7건이 조용히 빈 출력을 단언할 뻔했다(음성 단언만 있었다면 통과했을 것이다). 순수 View seam 으로 우회했고 근거를 두 컴포넌트 주석에 남겼다.
- **현재 라운드 수**: **2**.

---

# 라운드 3 (ΔV2) — 의존 간선의 두 의미

## [구현자 기입] 설계 리뷰 — r3

| 항목 | 판정 | 근거 |
|---|---|---|
| ΔV2 규범 행이 구현 가능한가 | 가능 | D-028~D-031 · AT-34 · EP-19(3지점) 전부 코드 지점으로 사상. `PLAN_GAP` 0 |
| 인용한 SDK 사실이 맞는가 | **실측 확인** | `TaskListOutput.tasks[]` 에 `blocks` 부재(`sdk-tools.d.ts:3628`) — D-028 의 결정적 근거 |
| 인용한 기존 테스트가 실재하는가 | 실재 | `task-tool.test.ts:112` `task 를 그대로 upsert 한다` 가 `blocks` 를 단언하고 있었다 — 이번에 그 행을 AT-34③(음성+양성 짝)으로 바꿨다 |

## [구현자 기입] 강제 지점 전수 (§10 대조) — r3

| EP | plan 분모 | 실측 | 재현 명령 | 관측 |
|---|---|---|---|---|
| EP-19 | 3 | **3/3** | `rg -n "addBlockedBy" task-tool.ts taskBoard.ts` | 파서 가산 `task-tool.ts:142-144` · 출력 교체 `task-tool.ts:189-190` · 적용부 두 분기 `taskBoard.ts:123-126` |
| EP-02 | 1 | **1/1**(REGRESSION) | `task-tool.test` 전건 | 17케이스 green — `blocks` 제거가 나머지 관측을 바꾸지 않는다 |
| EP-03 | 1 | **1/1**(REGRESSION) | `taskBoard.test` 스냅샷 케이스 | `TaskList` 전체 교체 유지 — AT-34② 가 직접 단언 |

**합계: 5/5.** 미충족 0. (ΔV1 의 27 은 이번 변경 경로에 닿지 않아 재측정하지 않았다 — 파서/fold 두 파일만 바뀌었고 전체 스위트가 green 이다.)

### V-pair 자기확인

| Pair | 자기 상태 | 증거 |
|---|---|---|
| VP-30 (MD-01a↔UT-05) | SELF_PASS | `taskBoard.test` AT-34 3케이스 + **변이 F·G** 각각 red |
| VP-17 (REGRESSION) | SELF_PASS | `task-tool.test` 17케이스 green |
| VP-03·VP-18 (REGRESSION) | SELF_PASS | AT-34② 가 교체 의미를 직접 단언 |

## [구현자 기입] 이번 라운드 수정의 잠금 — r3

| # | 심은 결함 | 대상 | 재측정 | 판정 |
|---|---|---|---|---|
| F | `applyPatch` 의 가산을 교체로 (`[...patch.addBlockedBy]`) | VP-30 (D-029) | `1 failed / 19 passed` | 검출 |
| G | `readUpdate` 의 `addBlockedBy` 읽기 제거 (G2 재발) | VP-30 (EP-19①) | `1 failed / 19 passed` | 검출 |

- plan 이 VP-30 에 적대 증거를 `not selected`(직접 oracle)로 뒀으나, **D-030 이 미실측 가정**(SDK 가 `updatedFields` 에 싣는 이름)에 기대므로 두 변이를 자발적으로 심었다. 둘 다 red.
- 두 변이 모두 원본 복원 확인(`addBlockedBy` 참조 5건 유지).

## [구현자 기입] Product/UX 파생 검토 — r3

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 표시가 생기는가 | **있다** | `TaskUpdate(addBlockedBy)` 로 만든 의존이 이제 즉시 상세의 `#N 완료 필요` 행에 닿는다. 기존에는 다음 `TaskGet`/`TaskList` 까지 안 보였다 |
| 소비자가 있는가 | 있다 | `taskDetailRows`(`taskBoard.ts:271`) → `chat.taskTile.detail.blockedBy` → 상세 `dl`. 신규 문구 0건 — 기존 소비자에 값이 닿게만 했다 |
| 사라지는 표시가 있는가 | **없다** | `blocks` 는 애초에 소비처가 0이었다(G1). 화면에서 사라지는 것이 없다 |
| 사용자 요구를 충족하는가 | 충족 | D-031 — "완료후 추가 태스크가 앞의 것과 의존이 없어야" 를 AT-34③ 케이스가 직접 단언한다(새 항목 `blockedBy: []`) |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r3

| # | 발견 | 분류 | 대응 |
|---|---|---|---|
| J1 | `updatedFields` 가 어느 이름(`addBlockedBy` vs `blockedBy`)을 싣는지 **SDK 문서·타입에 없다**. 실환경 관측도 못 했다 | **보고만** | D-030 이 두 이름을 모두 허용해 false negative 를 피한다. 대신 `updatedFields: ['status']` 인 갱신이 `addBlockedBy` args 를 함께 들고 오면 **간선을 놓친다** — 실환경에서 확인할 항목 |
| J2 | `addBlocks`(역방향 가산)는 여전히 안 읽는다 | **보고만** | D-028 과 같은 이유 — `blocks` 를 저장하지 않으므로 읽을 곳이 없다. `blockedBy` 만으로 그래프가 닫힌다 |
| J3 | id 단조 증가가 SDK 보장이 아니다(§7-C 조사) — 재번호되면 새 태스크가 완료된 것들 *사이에* 낀다 | **보고만** | 실측 반례 0건. 순서가 의존이 아니므로(D-031) 정합성 문제는 아니고 **읽는 느낌**의 문제다 |
| J4 | 번호 붙은 체크리스트 + 취소선이 "1→2→3 단계" 로 읽혀 실제 계약(순서≠의존)과 다르게 보인다 | **보고만** | D-031 이 계약을 고정했으나 표시는 그대로다. 의존 간선 시각화(들여쓰기·연결선)는 별도 설계 — **NEXT_HANDOFF** |

### 설계 대비 명시적 차이 — r3

**차이 없음.** plan §7-C 의 D-028~D-031·AT-34·EP-19 를 그대로 구현했다. 대체 메커니즘을 쓰지 않았으므로 축별 재유도는 **해당 없음**.

## [구현자 기입] 구현 보고 — r3

| 항목 | 값 |
|---|---|
| 변경 파일 | **4** — `shared/task-tool.ts` · `shared/task-tool.test.ts` · `lib/taskBoard.ts` · `lib/taskBoard.test.ts` |
| 관측한 게이트 산출 | `lint` **0 error · 1 warning**(기존 `useTranscriptVirtualizer`) · `typecheck` **error TS 0건**(3구성) · `vitest` **236파일 / 2435케이스 / 실패 0** · `check-doc-inventory` **9 items, 79 channels · prose ok · links ok** |
| 케이스 증분 | r2 **2432** → r3 **2435** (+3 = AT-34 3케이스). 기존 `blocks` 단언 1행은 케이스 수를 늘리지 않고 내용만 바뀌었다 |
| 인벤토리 수치 | 채널 79 · variant 21 · 마이그레이션 17 — **불변** |
| 게이트가 트리를 바꿨는가 | 아니오 — `lint --fix` 후 변경 파일 **4** 로 불변 |
| 검증 중 잔여물 | 변이 F·G 복원 확인 |

### AC 자기보고 상세 — r3

| AC | 결과 | 이번 턴 재현 관측 |
|---|---|---|
| AC34 | ✅ | ① `addBlockedBy:['1']`→`['2']`→`['1']` = `['1','2']`(중복 1회) ② 그 뒤 `TaskList blockedBy:['3']` = `['3']`(교체) ③ `TaskGet` 이 `blocks:['2']` 를 줘도 patch 에 없고 **`blockedBy:['9']` 는 실린다**(양성 짝) |

**검산: `✅ 1 · ⚠️ 0 · ❌ 0 = 총 1`**(ΔV2 분모). 누적 AC 총수는 `V1` 25 + ΔV1 8 + ΔV2 1 = **34**.

## [구현자 기입] Review Signals — 사실만 — r3

- **이전 라운드와 같은 축인가**: **부분적으로 그렇다.** G1(죽은 필드)은 verify r1 의 **D2 와 같은 부류**다 — 파싱은 하는데 소비처가 없는 표면. r2 가 D2 의 4종을 지웠는데 `blocks` 는 그 스윕에 안 걸렸다(D2 는 renderer 심볼 4개를 이름으로 열거했고 `blocks`는 `shared/` 의 *필드* 라 다른 축이었다).
- **막았어야 할 plan 지침·AC 가 있었는가**: **있었다.** `V1` AC24 가 "상세 = 상태/설명/**의존성**" 을 약속했는데, 의존이 *어느 경로로* 도달하는지를 AC 도 §10 도 적지 않았다. 그래서 `TaskGet`/`TaskList` 경로만 구현돼도 AC24 가 참이었다 — ΔV2 EP-19 가 그 구멍을 두 경로로 명시했다.
- **이 라운드의 출처가 verify 가 아니다**: 사용자 질의(그룹/의존/중단 연쇄)에서 파생했다. 조사만으로 끝날 수 있었으나 갭 2건이 나와 사용자가 범위에 넣었다.
- **반복해서 부딪히는 환경 한계**: 없음(이번 라운드는 순수 모듈 2파일).
- **현재 라운드 수**: **3**. 다음 라운드가 열리면 `handoff-review` 트리거(라운드 3 초과)에 해당한다.

## [검증자 기입] 파생 이슈

> **ΔV1 처분(2026-08-27, 설계 턴).** `대응 방향` 은 제안이고 닫힘은 `출처` 가 가리키는 계약의 성립이다 — 아래 `귀속` 칸이 ΔV1 에서 그 계약을 어디로 옮겼는지 적는다.

| # | 이슈 | 출처 pair / 계약·gate | 분류 | ΔV1 귀속 | 상태 |
|---|---|---|---|---|---|
| D1 | 채널 종료 정착이 패널에서 `실패` 가 아니라 `중단됨` 으로 분류되고, 행 문구가 `사용자에 의해 중단됨` 이라 원인을 거짓 진술한다 | verify r1 · **VP-08** · AC21 | **BLOCKING** | **D-023** · **MD-04/UT-04(신설)** · **VP-29(REQUIRED)** · **EP-15** · AT-21 재측정. V1 은 AC21 에 UT pair 가 없어 "경로 무변경" 으로 대체될 수 있었다 — 그 구멍을 노드 신설로 메운다 | 규범 정정 완료 → 구현 대기 |
| D2 | 미배선 표면 4종 — `taskBoardSettledKeys`(참조 0 + 배지 규칙이 reducer 와 다름) · `isBackgroundTask`(참조 0) · `MARK_SETTLED_TASKS`·`TASK_STOP_SETTLED`(도달 불가 액션) | verify r1 · §3 역방향 | NON_BLOCKING → **범위 편입** | **D-025** · **AT-32**(음성 4종 + 양성 짝) · **EP-18** | 규범 정정 완료 → 구현 대기 |
| D3 | 구현 보고 강제 지점 합계 `18/18` 이 내역과 어긋난다 — EP-07=3 이면 **19** | verify r1 · §7 | NON_BLOCKING | **§7-B EP-07 분모 정정(2→3)**. 계약 불변, 분모만 정정 — 다음 구현 보고는 정정된 표에서 센다 | closed(규범) |
| D4 | 실패 상태 background 행에 사유 문구가 없다 — 명세 §2 는 `실행 세션 종료` 를 요구한다 | verify r1 · AC21(명세 §2) | NON_BLOCKING → **범위 편입** | **D-024** · **AT-31** · `SubagentTaskSummary.settlementMessage` | 규범 정정 완료 → 구현 대기 |
| D5 | 대기 중 항목 번호가 **그룹 내 순번** 이다(첨부 예시는 전역 순번) | verify r1 · AC25 | NON_BLOCKING | **D-018 이 흡수** — 그룹 자체가 사라지고 번호는 task id 다. `AT-10a` 가 순서를, `TaskStatusIcon` 판별 union 이 배지 출처를 잠근다 | closed(규범) |
| D6 | 일반 Task 행에 상태 보조줄이 없다(그룹 헤더만 상태를 말한다) | verify r1 · AC25 | NON_BLOCKING | **의도된 결과로 확정** — cowork 양식(D-017)에서 상태는 아이콘(✓/↻/번호)과 취소선이 말한다. 그룹 헤더가 사라져도 상태가 사라지지 않는다. 별도 보조줄을 만들지 않는다 | closed(설계 확정) |
| D7 | `structuredOutput` 이름이 기존 어댑터 capability 플래그(`descriptor.ts:40`)와 겹친다 | verify r1 · §3 | NEXT_HANDOFF | 이번 ΔV1 범위 밖 — 파트 필드 개명은 영속 payload 계약 변경이라 마이그레이션 판단이 필요하다. **D-026 이 문서에 필드를 명시**하므로 다음 handoff 가 두 이름을 나란히 볼 수 있다 | open(이관) |
| D8 | `TaskUpdate` 가 미지 id 에 도착하면 제목이 id 인 유령 항목이 생긴다(압축된 세션 재개 시나리오) | verify r1 · §2 | NON_BLOCKING | **ΔV1 이 가시성을 높인다** — id 단일 나열(D-018)에서 제목이 `3` 인 행은 정상 행과 구분되지 않는다. 다만 "존재하는 Task 를 버리지 않는다" 는 제품 판단이라 사용자에게 올릴 항목으로 남긴다 | open(사용자 판단 대기) |
| D9 | `IPC_CONTRACT.md` 문서 드리프트 2건 — `tool.call.completed` 필드에 `structuredOutput` 부재 · `MockScenarioId` **13종**(코드 14) | **이번 턴 실측** · §7-B 조사 | NON_BLOCKING → **범위 편입** | **D-026** · **AT-33**. 문서 게이트가 세지 않는 형태라 r1 이 통과했다 | 규범 정정 완료 → 구현 대기 |

### r3 검증(2026-08-27) — 이관

> r1 의 D1·D2·D4·D5·D9 는 위 표에서 **닫혔다** — 판정 근거는 [`verify.md`](verify.md) §1·§5. D7·D8 은 열린 채 유지된다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D10 | 이번 라운드에 추출한 순수 View 3종의 **래퍼→View 배선이 잠기지 않는다** — 래퍼에서 지워도 `44파일/422케이스` 전건 통과(변이 V1·V2) | verify r3 · **VP-21**·**VP-22** · AT-28·AT-29 | AT-29 에 "`진행 상황` 섹션 본문이 목록 산출을 담는다" 를 더한다 — SSR 에서 store 가 비므로 `chat.taskTile.emptyDesc` 가 그 자리에 오는지가 가장 싼 관측이다. `subagent` 타일도 동형. **계약 신설이 아니라 기존 AC 보강** | **BLOCKING** | **부분 닫힘 (r4)** — VP-21 은 PASS, VP-22 는 열린 채 D15 로 좁혀 이관 |
| D11 | `backgroundMetaLine` 의 `aborted` 분기가 사유를 하드코딩(`사용자에 의해 중단됨`)한다. `recovery.ts:5`(앱 사망 후 dangling 정산)가 `reason:'aborted'` 라 **사용자가 중단하지 않은 항목**도 그 문구를 받는다 — r1 D1 과 같은 거짓 진술 부류 | verify r3 · §3 역방향 | `failed` 분기와 같이 `settlementMessage` 를 우선 쓰고 없을 때만 라벨로 떨어뜨린다. **D-024 가 `aborted` 분기를 정본으로 삼았으므로 규범 정정이 선행** | NON_BLOCKING | open |
| D12 | 고아 i18n 키 2건 — `chat.taskTile.emptyTitle`(r2 가 소비처 제거) · `chat.taskTile.viewTranscript`(r1 이래 0건) | verify r3 · §3 역방향 | 제거한다. **D2·G1 과 같은 죽은 표면 축의 세 번째 발현**이고 매번 분모가 달랐다(renderer 심볼 → shared 필드 → i18n 키) | NON_BLOCKING | open |
| D13 | 구현자 §5 전수 스윕의 축이 좁았다 — "message 로 *상태를 파생*하는 곳" 만 셌고 "*사유를 표시*하는 곳" 은 안 셌다 | verify r3 · §4 | D11 이 그 차집합이다. 다음 라운드의 스윕은 표시 축을 포함한다 | NON_BLOCKING | open |
| D14 | INDEX 비고가 5줄 규칙 초과(100자 기준 7줄) | verify r3 · `AGENTS.md §산출물 문장 규칙 3` | 이번 검증 갱신에서 줄였다 | NON_BLOCKING | **closed** |

### r4 검증(2026-08-27) — 이관

> r3 의 D10 은 **VP-21 쪽만 닫혔다** — 판정 근거는 [`verify.md`](verify.md) §4. D11·D12·D13 은 열린 채 유지된다(r4 범위 밖).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D15 | AT-29 가 `진행 상황` 섹션 본문의 **자리**를 잠그지 않는다 — `진행 상황`↔`출력` 본문을 맞바꾸는 변이 M-S 가 `44파일/423케이스` 전건 통과다. VP-22 의 `3섹션` hop 이 세 섹션을 구별하지 못한다 | verify r4 · **VP-22** · AC29 · D-022 | AT-29 에서 문자열 순서를 구속한다 — `indexOf('진행 상황') < indexOf(emptyDesc) < indexOf('출력')`. 또는 `진행 상황` `<section>` 조각만 잘라 그 안에서 `toContain`. **계약 신설이 아니라 기존 AC29 단언의 위치 구속** | **BLOCKING** | **구현 완료 (r5)** — 형제 3지점 전수. 변이 M-S·M-S2·M-O 각 1 red |
| D16 | r4 구현 커밋 `e459be0` 의 trailer 가 `Agent: codex` 인데 **ACTIVE D-014 는 구현 주체를 Claude 로 확정**했고 r1·r2·r3 구현 커밋 3개는 전부 `Agent: claude` 다 | verify r4 · §7 · **D-014** | 다음 구현 커밋의 `Agent` 를 D-014 와 맞추거나, 주체가 실제로 바뀌었다면 D-014 를 supersede 하는 결정을 남긴다. 값 자체는 허용값이고 파싱된다 | NON_BLOCKING | **구현 완료 (r5)** — r5 커밋 trailer 를 `Agent: claude` 로 맞췄다 |

---

# 라운드 4 — verify r3 D10 재구현

## [구현자 기입] 설계 리뷰 — r4

| 항목 | 판정 | 근거 |
|---|---|---|
| D10 구현 가능성 | **가능** | VP-21·VP-22의 기존 AT-28·AT-29에 wrapper 출력 단언을 보강하면 된다. 신규 계약·production 변경·`PLAN_GAP` 0 |
| r4 사전 handoff-review | **B(실행 누락), 지침 변경 없음** | 현 `handoff-impl §3`이 “단위와 그 단위를 부르는 배선” 및 인용 변이 재실행을 이미 요구한다. 같은 규칙 중복 추가를 금지하므로 APPLY 검토 결과 normative delta 0 |
| 인용 변이 실재성 | **재현** | V1은 AT-29 1 red, V2는 AT-28 1 red로 바뀌었다. 두 production 파일은 변이 후 byte 동일 복원 |

## [구현자 기입] 강제 지점 전수 (§10 대조) + V-pair 자기확인 — r4

| Pair | 자기 상태 | 강제 지점 / 관측 |
|---|---|---|
| VP-21 (R-11↔AT-28) | SELF_PASS | `SubAgentTileContent → SubAgentTaskList` **1/1**. 빈 제목·설명 양성 단언, V2에서 1 failed |
| VP-22 (R-12↔AT-29) | SELF_PASS | `TaskTileContent → TaskProgressList` **1/1**. 진행 상황 빈 설명 양성 단언, V1에서 1 failed |

**합계: 2/2.** 이번 변경은 테스트 oracle만 보강했고 §10 production 강제 지점 32곳은 변경하지 않았다.

## [구현자 기입] 이번 라운드 수정의 잠금 — r4

| 변이 | 대상 | 재측정 | 판정 |
|---|---|---|---|
| V1: wrapper의 `<TaskProgressList>` 제거 | VP-22 · AT-29 | **1 failed / 11 passed** — 진행 상황 빈 설명 단언 | 검출 |
| V2: wrapper의 `<SubAgentTaskList>` 제거 | VP-21 · AT-28 | **1 failed / 11 passed** — background 빈 제목 단언 | 검출 |

두 변이는 원본 복원 후 `cmp`로 production 파일 byte 동일을 확인했다. 정상 대상 suite는 **1파일 / 12케이스** 전건 green이다.

## [구현자 기입] Product/UX 파생 검토 — r4

| 질문 | 판정 | 근거 |
|---|---|---|
| 사용자 출력이 바뀌는가 | **아니오** | production 코드·i18n 변경 0건. 기존 빈 상태 문구를 oracle로 관측만 한다 |
| 빈 상태가 무출력으로 퇴행할 수 있는가 | **잠금** | 두 wrapper에서 목록 View를 제거하면 V1·V2가 각각 red다 |
| 늦은 응답·상태 전이에 영향이 있는가 | **없음** | store·reducer·effect 변경 0건 |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r4

| # | 발견 | 분류 | 대응 |
|---|---|---|---|
| K1 | SSR은 store initial state만 보므로 비어 있지 않은 wrapper 배선은 이 seam으로 관측할 수 없다 | 환경/증거 한계 | 이번 D10은 빈 상태 양성 출력으로 두 wrapper 호출 자체를 직접 잠근다. 행 의미는 기존 순수 View 테스트가 담당 |
| K2 | D11~D13은 D10과 별개이며 D11은 D-024 규범 정정이 선행돼야 한다 | 보고만 | production/i18n을 임의 수정하지 않고 열린 파생 이슈로 유지 |

## [구현자 기입] 구현 보고 — r4

| 항목 | 값 |
|---|---|
| 변경 | `rightPanelTiles.render.test.ts` 1파일 — wrapper 빈 상태 양성 단언 3개, AT-28 케이스 1개 추가 |
| 게이트 | renderer chat **44파일 / 423케이스 green** · typecheck 3구성 TS error 0 · lint 0 error/1 기존 warning · doc inventory **9 items/79 channels**, prose/link green |
| 전체 vitest | **231파일 / 2388케이스 green**, 5파일 46 red + 1 suite 0건은 install scripts를 생략한 환경의 `better-sqlite3` binding·Electron binary 부재 서명 |
| 인벤토리/계약 | 신규 dependency·IPC·DB·i18n·production 변경 **0건** |

### AC 자기보고 — r4

| AC | 결과 | 이번 턴 관측 |
|---|---|---|
| AC28 / VP-21 | ✅ | `SubAgentTileContent` 빈 상태가 제목·설명 2문구를 출력하고 V2에서 1 red |
| AC29 / VP-22 | ✅ | `TaskTileContent` 진행 상황 본문이 빈 설명을 출력하고 V1에서 1 red |

**검산: `✅ 2 · ⚠️ 0 · ❌ 0 = 총 2`.** D10의 실패 pair 두 건만 이번 r4 분모로 센다.

## [구현자 기입] Review Signals — 사실만 — r4

- **같은 축인가**: r3에서 새로 발견된 wrapper 배선 축을 그대로 닫았다. V1·V2가 `44파일/422케이스 green`에서 각각 `1 failed/11 passed`로 바뀌었다.
- **막았어야 할 지침**: 현 `handoff-impl §3`에 단위와 호출 배선을 함께 잠그라는 규칙이 이미 있어 **B(실행 누락)**다. 중복 지침·corpus·template 변경은 하지 않았다.
- **환경 한계**: `npm ci --ignore-scripts`로 Electron binary와 better-sqlite3 binding이 없어 전체 vitest의 알려진 5파일/1 suite만 실패했다. 변경 대상 44파일은 전건 green이다.
- **현재 라운드 수**: **4**. 구현 완료 후 다음 주체는 독립 검증자다.

---

# 라운드 5 — verify r4 D15 재구현

## [구현자 기입] 설계 리뷰 — r5

| 항목 | 판정 | 근거 |
|---|---|---|
| D15 구현 가능성 | **가능** | AC29 가 이미 "`출력`·`컨텍스트` 는 설명문만 낸다" 를 갖는다. 단언을 섹션 본문으로 좁히면 되고 신규 계약·production 변경·`PLAN_GAP` 0 |
| r5 사전 handoff-review | **수행(DIAGNOSE_ONLY)** | 라운드 4 초과 트리거. 결과는 아래 Review Signals — **A(coverage gap) 1건 진단, 지침 파일 변경 0**(사용자가 지침 수정을 요청하지 않았다) |
| 인용 변이 실재성 | **재현** | M-S 를 이번 턴에 다시 심어 수정 전 `44파일/423케이스 전건 통과`(무음)를 확인한 뒤 고쳤다 |

## [구현자 기입] 강제 지점 전수 (§10 대조) + V-pair 자기확인 — r5

**불변식(§5-1)**: **형제 슬롯이 서로 다른 계약을 가지면 산출의 *존재*가 아니라 *귀속*을 단언한다.** 존재만 보면 슬롯끼리 맞바꾼 회귀가 초록으로 통과한다.

전수 스윕 — `rg "<TileSection" app/src | rg -v '\.test\.'` → **3지점**(`TaskTileContent.tsx:307·310·313`), 전부 한 부모 아래 형제다.

| 지점 | 계약 | 이번 턴 관측 |
|---|---|---|
| `sections.progress` | 목록 View 를 담는다 | `bodies['진행 상황']` 단언 — V1·M-S 에서 red |
| `sections.output` | 설명문만 담는다(D-022) | `bodies['출력']` 단언 — M-S·M-S2 에서 red |
| `sections.context` | 설명문만 담는다(D-022) | `bodies['컨텍스트']` 단언 — M-S2 에서 red |

**합계: 3/3.** D15 가 지목한 것은 첫 행 하나였고 나머지 둘은 같은 불변식의 형제 지점이라 함께 닫았다.

| Pair | 자기 상태 | 관측 |
|---|---|---|
| VP-22 (R-12↔AT-26/27/29) | SELF_PASS | 섹션 순서 `toEqual` + 본문 3종 귀속 단언. 변이 M-S·M-S2·M-O·V1 각각 1 red |
| VP-21 (R-11↔AT-28) | SELF_PASS | r4 잠금 유지 회귀 — 변이 V2 가 여전히 1 red |

§10 production 강제 지점 **32곳은 변경하지 않았다** — 이번 diff 에 production 코드가 없다.

## [구현자 기입] 이번 라운드 수정의 잠금 — r5

| 변이 | 대상 | 재측정 | 판정 |
|---|---|---|---|
| M-S: `진행 상황`↔`출력` 본문 맞바꿈 | VP-22 · AC29 · D15 | **1 failed / 422 passed** | 검출 |
| M-S2: `출력`↔`컨텍스트` 본문 맞바꿈 | VP-22 · AC29 · D-022 | **1 failed / 422 passed** | 검출 |
| M-O: 섹션 순서 뒤집기 | VP-22 · D-017 | **1 failed / 422 passed** | 검출 |
| V1: 래퍼의 `<TaskProgressList>` 제거 | VP-22 · D10 회귀 | **1 failed / 422 passed** | 검출 |
| V2: 래퍼의 `<SubAgentTaskList>` 제거 | VP-21 · D10 회귀 | **1 failed / 422 passed** | 검출 |

**새 장치의 적대 검사(§3)**: `sectionBodies()` 는 이번 턴에 만든 구조적 proxy라 눈이 있는지 먼저 봤다. ① 섹션을 못 찾으면 `bodies[제목]` 이 `undefined` 라 단언이 실패한다(fail-closed) ② M-S·M-S2 가 red 라 세 본문을 **서로 구별**한다 — 전부 같은 문자열을 돌려주는 눈먼 장치가 아니다. 5변이 전부 복원 후 두 production 파일은 `git diff` 0줄이다.

## [구현자 기입] Product/UX 파생 검토 — r5

| 질문 | 판정 | 근거 |
|---|---|---|
| 사용자 출력이 바뀌는가 | **아니오** | production·i18n 변경 0건. 기존 빈 상태 문구를 더 좁게 관측만 한다 |
| 섹션이 뒤바뀐 화면이 회귀로 샐 수 있는가 | **잠금** | 본문 귀속 3종 + 헤더 순서까지 단언한다 |
| 접힘 상태에서 단언이 깨지는가 | **아니오** | SSR 은 `useState(true)` 초기값을 보므로 세 본문이 모두 렌더된다. `aria-expanded` 3개 단언이 그 전제를 함께 잡는다 |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r5

| # | 발견 | 분류 | 대응 |
|---|---|---|---|
| L1 | `sectionBodies()` 가 `pb-3`·`<section` 이라는 `TileSection` 의 DOM 형태에 묶인다 | 구조적 proxy 한계 | fail-closed 라 형태가 바뀌면 red 가 된다 — 조용히 통과하지 않는다. 선조치 없이 그대로 둔다 |
| L2 | 형제 파일 `navSections.render.test.ts`(0203)는 같은 축을 **다른 장치**로 이미 닫는다 — 구획마다 별도 렌더 + 슬롯 브랜드 타입 | 보고만 | 저장소에서 이 불변식이 열린 다른 지점 0건. 파생 이슈를 만들지 않는다 |
| L3 | D11·D12·D13·D16 은 여전히 열려 있다 | 보고만 | r5 범위 밖. D16(trailer `Agent` 값)은 이번 커밋에서 D-014 에 맞춘다 |

## [구현자 기입] 구현 보고 — r5

| 항목 | 값 |
|---|---|
| 변경 | `rightPanelTiles.render.test.ts` 1파일 — `sectionBodies()` 헬퍼 신설 + AT-29 첫 케이스를 귀속 단언으로 교체 |
| 게이트 | renderer chat **44파일 / 423케이스 green** · typecheck **error TS 0건**(3구성) · lint **0 error / 1 warning**(기존 `useTranscriptVirtualizer.ts:22`) · doc inventory `9 items / 79 channels`, prose·link ok |
| 전체 vitest | **231파일 green / 5파일 red · 2388케이스 green / 46 red** — 5파일은 `app/AGENTS.md §제약 환경` 의 실측 서명(better-sqlite3 bindings 부재)과 동일 목록 |
| 인벤토리/계약 | 신규 dependency·IPC·DB·i18n·production 변경 **0건** |

### AC 자기보고 — r5

| AC | 결과 | 이번 턴 관측 |
|---|---|---|
| AC29 / VP-22 | ✅ | 세 본문 귀속 + 헤더 순서 단언. M-S·M-S2·M-O·V1 각 1 red |
| AC28 / VP-21 | ✅ | r4 잠금 회귀 유지 — V2 1 red |

**검산: `✅ 2 · ⚠️ 0 · ❌ 0 = 총 2`.** 분모는 r4 와 같다 — D15 는 AC 를 늘리지 않고 AC29 의 단언을 좁혔다.

## [구현자 기입] Review Signals — 사실만 — r5

- **같은 축인가**: **그렇다 — 세 번째다.** r3 D10(래퍼→View 배선), r4 D15(섹션→본문 귀속)가 같은 "hop 이 무관측" 축이고 분모만 좁아졌다. 이번에는 지목된 1지점이 아니라 형제 3지점을 전수로 닫았다.
- **막았어야 할 지침이 있었는가**: **있었고, 정상 수행해도 못 막는다.** `handoff-impl §3`의 배선 규칙은 "배선을 **지운** 회귀가 초록으로 통과"라고 써 있어 *존재* 축만 지시한다 — r4 는 그 문장을 정확히 수행해 존재를 잠갔고 귀속은 열린 채였다. 사전 `handoff-review`(DIAGNOSE_ONLY)가 이것을 **A(coverage gap)** 로 진단했다.
- **진단한 지침 변경안(미적용)**: `handoff-impl §3`의 해당 문장을 "지운 회귀"에서 **"지우거나·형제 슬롯과 맞바꾼 회귀"**로 넓힌다. normative 변경이라 `Tier 1`(6-A+6-B+6-C) 회귀 검증이 필요하고, 사용자가 지침 수정을 요청하지 않아 **적용하지 않았다**.
- **반복된 환경 한계**: better-sqlite3 ABI/egress(5라운드 연속) · zustand SSR 스냅샷이 store 연결 컴포넌트를 시드하지 못함(3라운드 연속).
- **현재 라운드 수**: **5**. 다음 주체는 독립 검증자다.
