# Plan — 0230-background-task-ux-conformance

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0230-background-task-ux-conformance` |
| 작성자 | Claude Code |
| 일자 | 2026-09-11 |
| 매핑 | 0230~0236 분할의 **1번**. 조사 정본을 겸한다 |
| 상태 | **impl/IMPL_DONE** (r2) |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

**이 문서는 두 가지를 갖는다.** §0 은 7군 전수 조사와 0230~0236 분할 로드맵으로, **여섯 후속
핸드오프의 공통 입력**이다. Part I·II 는 이 핸드오프의 구현 범위인 **G1(셸 백그라운드 작업의 1급
표면)** 만 다룬다.

---

# §0 — 조사 정본 (0230~0236 공통 입력)

> 기준 문서 = 사용자 첨부 스펙 `Claude Agent SDK 백그라운드 작업 지원 스펙`(기준 SDK `0.3.267`,
> 작성일 2026-09-10). 기준 코드 = 현재 HEAD.
>
> **버전 간극**: `app/package.json:35` 의 SDK 핀은 `0.3.220` 이다. 스펙의
> `0.3.238`(`is_backgrounded`·`spawn_depth`) · `0.3.247`(`ambient`) ·
> `0.3.257`(`resource_links`·Agent `heartbeat`) 확장은 **핀 이후**라, 코드를 넣어도 SDK 를 올리기
> 전에는 도달하지 않는다. 실행 CLI 는 사용자 설치본이므로(`claude-map.ts:344-347`) 배포물 선언과
> 실제 로그로 다시 확인한다.

## 0.1 조사 요약

| 그룹 | 항목 | 완전 | 부분 | 없음 | 담당 handoff |
|---|---:|---:|---:|---:|---|
| G1 셸(PowerShell) 백그라운드 | 3 | 0 | 0 | 3 | **0230 (이 문서)** |
| G2 진행 표시 | 4 | 0 | 2 | 2 | [0231](../0231-background-progress-and-turn-state/plan.md) |
| G3 결과·출력 | 3 | 0 | 0 | 3 | [0232](../0232-background-output-access/plan.md) |
| G4 상태 정확성 | 4 | 0 | 2 | 2 | [0233](../0233-background-state-accuracy/plan.md) |
| G5 조건부 도구 | 5 | 0 | 0 | 5 | [0234](../0234-conditional-task-tools/plan.md) |
| G6 제어·수명 | 3 | 1 | 1 | 1 | [0235](../0235-background-control-and-lifetime/plan.md) |
| G7 견고성 | 2 | 0 | 1 | 1 | [0236](../0236-background-stream-robustness/plan.md) |

## 0.2 분할 로드맵

| 순서 | handoff | 범위 | 선행 | 사용자 제보 |
|---|---|---|---|---|
| 1 | 0230 | G1 — 셸 작업 종류 정규화 · 타일 표시 · 결과 보존 | 없음 | ① 절반 |
| 2 | 0231 | G2 + 턴 상태 — 진행 표시 · 배지 의미 · 클릭 진입 · 정식 사용자 턴 | 0230 (클릭 대상) | ① 나머지 · ② 전부 |
| 3 | 0233 | G4 — 상태 정확성 | 0230 (task kind) | — |
| 4 | 0232 | G3 — 결과·출력 접근 | 0230 · 0233 | — |
| 5 | 0234 | G5 — 조건부 도구 | 0230 (task kind · 런치 영수증) | — |
| 6 | 0235 | G6 — 제어·수명 | 0231 | — |
| 7 | 0236 | G7 — 견고성 | 없음 | — |

**번호 순서 ≠ 실행 순서다.** 실행은 위 `순서` 열을 따른다 — 0233 이 0232 보다 앞인 이유는
G3 의 출력 카드가 G4 의 "종료 사유 미확인" 상태 위에 서기 때문이다.

## 0.3 G1 — 셸(PowerShell) 백그라운드

| ID | SDK 신호 | 현재 Orca | 관측 근거 | 증상 |
|---|---|---|---|---|
| F-01 | `task_started.task_type` | 미판독 | `rg task_type app/src` → 0건 | 모든 `task_*` 이 서브에이전트로 취급된다 |
| F-02 | 백그라운드 목록 표시 | `Agent`/`Task` 만 | `parts.ts:319` `isAgentTaskName` 필터 | spark 라인 건수는 오르는데 타일은 비어 있다 |
| F-03 | Bash 결과 `backgroundTaskId`·`timedOutAfterMs`·`rawOutputPath`·`persistedOutputPath` | 미판독 | `rg backgroundTaskId app/src` → 0건 | ① 백그라운드 전환을 완료로 그린다 ② 추적이 해제돼 세션이 기다리지 않는다 ③ 정착이 실제 stdout 을 덮는다 |

## 0.4 G2 — 진행 표시

| ID | SDK 신호 | 현재 Orca | 관측 근거 | 증상 |
|---|---|---|---|---|
| F-04 | `tool_progress`(최상위 type) — `elapsed_time_seconds`·`heartbeat`·`subagent_retry` | 전량 미처리 | `rg tool_progress app/src` → 0건; `claude-map.ts:747` 이 미지 메시지를 드롭 | 긴 foreground 도구에 경과가 없다. 재시도 대기와 정상 진행을 구분 못 한다 |
| F-05 | `task_progress.summary` + `agentProgressSummaries` | 정규화는 하나 renderer 가 버린다. 옵션 미설정 | `claude-map.ts:144` 가 싣고 `chatStore.ts:322-338` 이 복사하지 않는다 | 작업이 "지금 무엇을 하는 중인지" 말하지 못한다 |
| F-06 | 실행 수 배지 = 라이브 스냅샷 기준 | `count()` = 추적 전량(foreground 포함) | `background-tasks.ts:124-126`; `session-activity-projector.ts:216` | 동기 에이전트도 "백그라운드 작업 1건"으로 센다 |
| F-07 | — (호스트 UX) | spark 라인 사실에 클릭 진입점 없음 | `StatusLine.tsx:123-128` — 사실은 `span` 뿐 | 건수를 봐도 상세로 갈 길이 없다 |

## 0.5 G3 — 결과·출력

| ID | SDK 신호 | 현재 Orca | 관측 근거 | 증상 |
|---|---|---|---|---|
| F-08 | `task_notification.output_file` | 미판독 | `rg output_file app/src` → 0건; `claude-taskxxx-spec.md:159` 가 ❌ | 알림 요약만 남고 전체 출력을 볼 방법이 없다 |
| F-09 | `resource_links` · `tool_use_result.resourceLinks` | 미판독 | `rg resource_links\|resourceLinks app/src` → 0건 | MCP 결과 파일 참조가 화면에 없다 |
| F-10 | 출력 읽기 안전성(경로 검증·대용량·쓰는 중 파일·외부 수정) | 해당 없음(읽는 코드가 없다) | F-08 의 귀결 | — |

## 0.6 G4 — 상태 정확성

| ID | SDK 신호 | 현재 Orca | 관측 근거 | 증상 |
|---|---|---|---|---|
| F-11 | `ambient` | 미판독. `skip_transcript` 만 드롭 | `claude-map.ts:120` | 내부 유지 작업이 일반 배지에 섞일 수 있다 |
| F-12 | `background_tasks_changed.tasks[].task_type·description` | 매핑된 id 만 추린다 | `claude-map.ts:311-334` | 스냅샷이 유일한 근거인 작업은 존재를 모른다 |
| F-13 | 종료 ↔ 스냅샷 불일치 표시 | 스냅샷 제외를 `failed` 로 **확정** | `turn-coordinator.ts:459-478` | 스펙의 "종료 사유 미확인"과 다르다 |
| F-14 | `task_updated.patch.end_time·total_paused_ms·description` | 미판독 | `claude-map.ts:271-309` | 일시정지 누적·설명 변경이 화면에 없다 |

## 0.7 G5 — 조건부 도구

> **차단은 없다.** 메인 chat query 의 거부 목록은 `Bash`·`WebSearch` 둘뿐이다(`claude.ts:432`).
> `allowedTools: []` 는 제목 생성 query 의 것이다(`claude.ts:272`, `maxTurns:1`). 설치본 CLI 가
> 이 도구들을 주면 모델은 지금도 부를 수 있고, 부르면 잘못 그려진다.
>
> 아래 결과 payload 형태는 스펙에서 왔다. 실제 로그로 관측하지 않았다. 코드 경로는 HEAD 실측이고
> 그 경로에 스펙 payload 를 대입한 귀결이 증상이다.

### 공통 분기점 — `isAsyncLaunchedPayload`

`tool.call.completed` 에서 이 술어가 참이면 `markAsyncLaunched`(라이브 유지), 거짓이면
`backgroundTasks.settled`(추적 해제)다(`turn-coordinator.ts:514-522`). 네 결과 중 `status` 가
`async_launched` 인 것은 `Workflow` 하나다.

| 도구 | 결과의 판별 필드 | 술어 | 귀결 |
|---|---|---|---|
| `Monitor` | `{ taskId, timeoutMs, persistent? }` — `status` 없음 | 거짓 | 즉시 추적 해제 |
| `Workflow` | `{ status: 'async_launched', taskId, … }` | **참** | 라이브 등록 — `error` 동반 시에도 |
| 분리 `Skill` | `{ …, background: true }` | 거짓 | 즉시 추적 해제 |
| 원격 Agent | `{ status: 'remote_launched', taskId, sessionUrl, … }` | 거짓 | 해제 + **완료로 표시** |

| ID | 대상 | 증상 |
|---|---|---|
| F-15 | `Monitor` | 감시는 도는데 추적에서 빠진다. 렌더러 등록이 없어 일반 key-value 카드로 떨어진다. `task_type:'local_bash'` 가 셸과 겹쳐 F-01 이 선행이다 |
| F-16 | `Workflow` | ① 유일한 비-Agent 라이브 등록 ② `error` 동반 시 시작 안 한 실행을 라이브로 등록해 세션이 유휴로 못 돌아온다 ③ 정착이 `runId`·`transcriptDir` 를 덮는다 ④ 통지 행 제목이 비고 클릭이 목록으로 폴백한다 |
| F-17 | 분리 `Skill` | `background:true` 는 술어가 거짓이라 반환 즉시 종료로 그려진다 |
| F-18 | 원격 Agent | `Agent` 도구라 타일에 들어가는데 `deriveSubagentTaskStatus` 가 `completed` 를 준다. `sessionUrl` 을 읽는 코드가 없다 |
| F-19 | `TaskOutput`/`TaskStop` | 미채택 결정은 유지가 맞다. 단 ① `structuredOutput` 을 영속하는데 렌더 소비처가 0 ② 모델이 `TaskStop` 을 불러도 UI 폴백이 "사용자에 의해 중단됨"(`ko.ts:775`)이라 행위자를 잘못 말한다 |

## 0.8 G6 — 제어·수명

| ID | 대상 | 현재 Orca | 판정 |
|---|---|---|---|
| F-20 | `stopTask(taskId)` · `backgroundTasks(toolUseId)` | 있음 (`stop-subagent.ts:55`) | **충족** — 회귀만 지킨다 |
| F-21 | `perTaskStopAffordance` | 미설정 — 메인 Stop 이 백그라운드 Agent 도 중단 | **문구는 일치**(`ko.ts:590`). 켜면 "응답만 중지" 가 새로 가능해진다 |
| F-22 | 결과 기다리기 / 대기 취소 UI | 없음 | 없음 |

## 0.9 G7 — 견고성

| ID | 대상 | 현재 Orca | 판정 |
|---|---|---|---|
| F-23 | 미지 스키마 원본 보존 | 드롭 (`claude-map.ts:747-749` `return []`) | 스트림은 안 끊기나 원본이 남지 않는다 |
| F-24 | 중복 이벤트 | uuid 단위 방어 없음. 자료구조 멱등성 의존 | 현재 경로에서는 중복 통지가 나지 않는다 |

## 0.10 이미 충족하는 것 — 7개 handoff 공통 회귀 대상

| 항목 | 근거 |
|---|---|
| `async_launched` 영수증으로 실제 백그라운드 판별 | `shared/subagent.ts`; 0136·0143 |
| 백그라운드 완료 통지 1회 | `turn-coordinator.ts:310-322`; `SubagentNoticeRow.tsx` |
| `task_updated` 델타 병합 · `killed`↔`stopped` 동형 · `paused` 라이브 유지 | `claude-map.ts:256-309`; 0212 |
| 레벨 신호 REPLACE + 첫 payload 기준선 | `background-tasks.ts:85-101` |
| 메인 `result` 이후에도 프레임 소비 유지 | `features/chat/post-turn.ts` |
| interrupt 영수증 `still_queued` 교집합 화해 | `interrupt-reconcile.ts` |
| 서브에이전트 행의 모델·현재 도구·도구수·경과 | `AgentTaskRow.tsx:55-77` |
| listening 중 낙관 커밋 금지(커밋 순서 보존) | `sendAdmission.ts:1-23`; 0153 |

---

# Part I — Product & UX Contract (범위 = G1)

## 1. Context / 목표

- 해결하려는 문제: 백그라운드로 도는 셸 명령(PowerShell)이 Orca 에서 **어디에도 실행 중으로 서지
  않는다**. 도구 카드는 완료로 그려지고, 백그라운드 타일은 그 항목을 갖지 않으며, 추적이 해제돼
  세션이 완료를 기다리지 않는다.
- 완료 후 달라지는 것: 백그라운드 셸 작업이 `백그라운드 작업` 타일에 **명령·상태·경과를 가진
  카드**로 서고, 종료될 때까지 세션이 그것을 기다리며, 종료 정착이 이미 받은 stdout 을 지우지
  않는다.
- 성공을 사용자 관점에서 한 문장으로: 백그라운드로 넘어간 vitest 실행이 화면 어딘가에 "아직 돌고
  있다" 고 서 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "백그라운드 기능에서 ux적인 통신이 충실하게 구현됐는지 점검/진단하고 부족한 부분이 발견되면 보완한다" | 라이브 세션 2026-09-11 |
| 명시 요구 | "vitest같은 긴 작업의 경우, powershell이 언제끝나는지 알수없어 고장인지 정상동작인지 판단이 어렵다" | 같은 턴 |
| 명시 요구 | "g7까지 핸드오프 문서를 분할하여 작성하라" | 같은 턴 |
| 추론 의도 | 진행 *표시*(경과·요약)보다 **존재 표시**가 먼저다 — 없는 항목에 경과를 붙일 수 없다 | 설계자 추론. 0231 이 표시를 잇는다 |
| 참조 입력 | 첨부 스펙 §1 Bash · §2 이벤트별 처리 규칙 · §3 `BASH-EXPLICIT`·`BASH-TIMEOUT`·`BASH-STDERR` | 사용자 첨부 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 백그라운드 진행 정보는 **spark 라인 한 줄 요약 + 클릭 시 상세**로 노출한다 | 사용자 선택 | 사용자 턴 | ACTIVE (0231 이 구현) | — |
| D-002 | 백그라운드 대기 구간의 사용자 전송은 **정식 사용자 턴**으로 보이고, 앞의 어시스턴트 턴은 "백그라운드 작업이 끝나면 답변하겠다"는 **종료된 턴**으로 보인다 | 사용자 원문: "원하큰건 정식사용자 턴인데 클로드가 백그라운드 작업이 끝나면 답변하겠다고 턴을 종료하는 상황이어야 한다" | 사용자 턴 | ACTIVE (0231 이 구현) | — |
| D-003 | 범위는 **G1~G7 전부**이며 7개 handoff(0230~0236)로 분할한다 | 사용자 원문: "g7까지 핸드오프 문서를 분할하여 작성하라" | 사용자 턴 | ACTIVE | D-003(OPEN) 를 대체 |
| D-004 | 작업 종류(`taskKind`)의 1순위 근거는 **원래 도구 이름**, 2순위가 `task_type` 이다 | 스펙: "원래 이름 `PowerShell` 을 보존한다". `Monitor` 와 셸이 `local_bash` 를 공유해 `task_type` 단독으로는 갈리지 않는다 | 스펙 §1 Monitor·PowerShell | ACTIVE | — |
| D-005 | `subagent.task` **이벤트 이름은 바꾸지 않는다**. `taskKind` 필드를 더한다 | 개명은 영속 파트·reducer·writer·테스트에 걸쳐 blast radius 가 크고 이번 목표(표시 정확성)와 무관하다. 이름 부채는 주석으로 남긴다 | 설계자 판단 | ACTIVE | — |
| D-006 | 정착 합성 `tool.call.completed`(부모 결과 덮어쓰기)는 **`taskKind==='agent'` 에만** 낸다 | 셸은 자기 `tool_result` 가 이미 권위다. 합성 결과가 그것을 덮으면 명령 출력이 사라진다 | 코드 실측 (`resultMap` 마지막 승) | ACTIVE | — |
| D-007 | "아직 실행 중" 판정을 `async_launched` 단일 리터럴에서 **런치 영수증 술어**로 넓힌다 | 셸 백그라운드 영수증은 `status` 가 아니라 `backgroundTaskId` 로 온다 | 스펙 §1 Bash 결과 | ACTIVE | — |

### 갱신 메모

- 새로 추가된 결정: D-004 · D-005 · D-006 · D-007.
- 변경된 결정: D-003 이 `OPEN` → `ACTIVE`(사용자가 전 범위 분할을 지시).
- 이번 턴에 언급되지 않았으나 유지: D-001 · D-002 (0231 이 구현한다).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-004 ↔ AC2(도구 이름 우선), D-005 ↔ AC1(같은 이벤트에
  필드 추가), D-006 ↔ AC6(셸은 합성 결과 없음), D-007 ↔ AC4(셸 영수증도 추적 유지). D-001·D-002
  는 이 handoff 의 AC 를 갖지 않는다 — 0231 소관이며 여기서 반대 방향을 요구하는 AC 도 없다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | "언제 끝나는지 모른다" 의 1차 원인은 표시가 없어서가 아니라 **추적이 해제돼 세션이 기다리지 않아서**다(F-03 ②) |
| 이미 기존 코드가 충족하는가 | 아니오 | `rg backgroundTaskId app/src` → 0건. `parts.ts:319` 가 Agent 로 좁힌다 |
| 더 작은 해법이 있는가 | 아니오 | 표시만 고치면 추적 해제가 남아 카드가 뜨자마자 사라진다. 추적·표시·정착 셋이 한 덩어리다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 | `claude-taskxxx-spec.md:137` 이 `task_type` 을 ❌ 로 적었고 코드와 일치 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 아니오 | 0143 의 `isAsyncLaunched` 는 **에이전트** 판별이 목적이다. D-007 은 그 술어를 대체하지 않고 상위에 런치 영수증 판정을 둔다 |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: §0.3 · §8.

## 5. 동작 / 사용자 흐름

```text
[모델이 PowerShell 을 run_in_background 로 실행하거나 타임아웃으로 전환됨]
  → 도구 카드: "백그라운드에서 실행 중" (부분 출력 유지)
  → 백그라운드 작업 타일: 셸 카드 1건 (명령 · 실행 중 · 경과 · 중단)
  → 세션: 종료를 기다린다 (listen 유지)
  → task_notification 도착
      → 타일 카드: 완료 / 실패 / 중단
      → 도구 카드: 상태만 갱신, 기존 stdout 보존
      ↘ 중단 클릭 → '중단 중' → 정착 → '중단됨'
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 셸 `tool_result` 에 `backgroundTaskId` 존재 | 런치 영수증으로 판정 → 추적 유지 | 도구 카드가 "백그라운드에서 실행 중" |
| 같은 결과에 `timedOutAfterMs` 존재 | 전환 사유 보존 | 카드가 "타임아웃으로 백그라운드 전환" |
| `task_started` (`task_type`·도구이름) | `taskKind` 확정 | 타일에 종류 라벨이 붙은 카드 |
| `task_notification` (`completed`/`failed`/`stopped`) | 정착. **부모 합성 결과 없음** | 타일 카드 상태 변경. 도구 카드 stdout 유지 |
| 사용자 중단 클릭 | `stopTask(taskId)` | '중단 중' → 정착 후 '중단됨' |
| 채널 사망 | 기존 합성 정착 경로 그대로 | 카드가 실패로 정착 |

### 파생 UX / 엣지케이스

- empty: 셸 백그라운드가 없으면 타일 문구는 현행 유지.
- foreground 셸: `backgroundTaskId` 가 없으므로 타일에 서지 않는다 — 현행과 같다.
- stderr 만 있는 성공: 실패로 보지 않는다(스펙 `BASH-STDERR`).
- 재로드: `structuredOutput` 투영이 영속되므로 카드가 복원된다.
- a11y: 셸 카드는 기존 카드와 같은 `role="button"` · 키보드 계약을 쓴다.

## 6. 범위 / 비범위

- **범위**: `taskKind` 정규화 · 런치 영수증 술어 확장 · 셸 결과 필드 투영 · 백그라운드 타일의 셸
  카드 · 정착이 셸 결과를 덮지 않게 · 완료 통지 행의 제목 조인 확장.
- **비범위**: 경과·요약·배지 의미·클릭 진입(0231) · `output_file` 전체 출력(0232) · `ambient`·
  스냅샷 정확성(0233) · Monitor/Workflow/원격(0234) · `perTaskStopAffordance`(0235) · 미지 스키마
  보존(0236) · SDK 핀 상향.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `taskKind` 어휘(`agent`·`shell`·`monitor`·`workflow`·`unknown`) | **예 — 공개 IPC 계약** | 지금 확정한다. 0234 가 `monitor`·`workflow` 를 소비만 한다 |
| `subagent.task` 이벤트 개명 | 아니오 | D-005 로 보류 |
| `structuredOutput` 투영 형태 | **예 — 영속 데이터 포맷** | 지금 확정한다(§10 EP-04) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 | `task_started` 가 셸 도구의 `tool_use_id` 를 실으면 정규화 이벤트의 `taskKind` 가 `shell` 이다 | UT: `claudeToNormalized` 에 `task_started`(`task_type:'local_bash'`, 앞선 `PowerShell` tool_use) 를 넣고 `taskKind==='shell'` 단언 | SDK system 메시지 → `claude-map` → `subagent.task` |
| R-01 | AT-02 | 도구 이름이 `Agent` 면 `task_type` 이 `local_bash` 여도 `taskKind` 가 `agent` 다 | UT: 같은 함수에 도구이름/`task_type` 불일치 입력 → `agent` | 같음 (D-004 우선순위) |
| R-02 | AT-03 | 셸 `tool_result` 에 `backgroundTaskId` 가 있으면 그 도구 호출은 **추적에서 해제되지 않는다** | UT: `turn-coordinator` 이벤트 루프에 셸 런치 영수증 주입 → `backgroundTasks.count()` 가 감소하지 않음 | `tool_result` → `tool.call.completed` → 트래커 |
| R-02 | AT-04 | 같은 셸 작업의 `task_notification` 이 오면 그때 추적이 해제된다 | UT: 위 상태에서 `task_notification` 주입 → `count()` 가 0 | 같음 |
| R-03 | AT-05 | 셸 백그라운드 작업이 `백그라운드 작업` 타일에 카드로 선다 | 순수 렌더 테스트: 셸 `tool_call`+런치 영수증 `tool_result` 를 담은 `messages` → `renderToStaticMarkup` 에 명령 문자열 포함 | transcript parts → `backgroundTasksFromMessages` → `SubAgentTaskList` |
| R-03 | AT-06 | 그 카드는 종류 라벨로 에이전트 카드와 구분된다 | 같은 테스트에서 셸 라벨 존재 + 에이전트 라벨 부재 | 같음 |
| R-04 | AT-07 | 셸 작업의 종료 정착이 **부모 `tool.call.completed` 를 만들지 않는다**. 종류 미확인 정착은 **종전대로 만든다** | UT: `createSubagentSettlementEvents` 에 `taskKind:'shell'` 정착 입력 → 부모 id 의 이벤트 0건, child 정착은 유지. 음성 대조로 `taskKind` 부재·`'unknown'`·`'agent'` → 부모 이벤트 1건 | `subagent.task(settled)` → `settleSubagentTask` |
| R-04 | AT-08 | 정착 후에도 셸 도구 카드의 stdout 이 보존된다 | 순수 렌더 테스트: 런치 영수증 → 정착 순서로 접은 뒤 stdout 문자열 존재 | parts fold → `BashBody` |
| R-05 | AT-09 | `timedOutAfterMs` 가 있으면 카드가 타임아웃 전환을 말한다 | 순수 렌더 테스트: 해당 문구 키 존재 | 결과 투영 → 카드 |
| R-05 | AT-10 | `backgroundTaskId` 가 없는 셸 결과는 현행대로 완료로 그려지고 타일에 서지 않는다 | 같은 테스트의 음성 대조 | 같음 |
| R-06 | AT-11 | 세션을 다시 열어도 셸 백그라운드 카드가 복원된다 | UT: 영속 파트(`structuredOutput` 투영)만으로 `backgroundTasksFromMessages` 가 항목을 만든다 | DB 파트 → reducer → fold |
| R-07 | AT-12 | 완료 통지 행이 셸 작업의 설명을 조인한다 | 순수 렌더 테스트: 셸 toolRunId 통지 → 명령 문자열이 행에 있다 | `subagent_notice` 파트 → `SubagentNoticeRow` |

### AC 검증 주의사항

- 기존 테스트 재사용: `app/src/main/adapters/claude-map.test.ts` 와
  `app/src/renderer/src/features/chat/components/rightpanel/subagentWiring.render.test.ts` 가
  존재한다(파일 존재 확인 완료). **케이스는 신설**한다 — 셸 task 케이스는 현재 0건이다.
- 사람 실기 항목: 없음. 전부 순수 테스트로 내린다 — 목록 포함 여부·상태 파생은 로직이다.
- 총량/0건 기준: AT-07 의 "부모 이벤트 0건" 은 `createSubagentSettlementEvents` 반환 배열에서
  `toolRunId === 부모 id` 인 항목만 센다. child 정착 이벤트는 분모에서 제외한다.
- 음성 대조: AT-10 이 AT-05 의 방향을 잡는다 — 영수증이 없으면 카드가 서지 **않아야** 한다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 상속할 명시 V 가 없다(0212 는 TaskXXX 표면 handoff 로 V 를 남기지
  않았다).
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: `R`.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01 | R | §7 작업 종류 식별 | NEW | — |
| R-02 | R | §7 실행 중 유지 | NEW | — |
| R-03 | R | §7 타일 표시 | NEW | — |
| R-04 | R | §7 결과 보존 | NEW | — |
| R-05 | R | §7 전환 사유 표시 | NEW | — |
| R-06 | R | §7 재로드 복원 | NEW | — |
| R-07 | R | §7 통지 행 제목 | NEW | — |
| SD-01 | SD | §5·§13 셸 작업의 시작→정착 수명주기 | NEW | — |
| AR-01 | AR | §10 `subagent.task.taskKind` 계약 | NEW | — |
| AR-02 | AR | §10 런치 영수증 술어 | NEW | — |
| AR-03 | AR | §10 셸 결과 `structuredOutput` 투영 | NEW | — |
| AR-04 | AR | §10 정착 이벤트의 kind 게이트 | NEW | — |
| MD-01 | MD | §11 `taskKindFrom(toolName, taskType)` 순수 함수 | NEW | — |
| MD-02 | MD | §11 `backgroundTasksFromMessages` fold | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle | 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·AT-02 | REQUIRED | SDK `task_started` → `claudeToNormalized` → `subagent.task.taskKind` | 정규화 결과의 `taskKind` 값 | not selected — 값 단언이 직접적 | EP-01·EP-02 (2) |
| VP-02 | R-02 ↔ AT-03·AT-04 | REQUIRED | `tool_result` → `tool.call.completed` → `BackgroundTaskTracker` | `count()` 관측 | required — 술어를 좁히는 변이(영수증 무시)를 심어 AT-03 이 red 인지 확인 | EP-03 (1) |
| VP-03 | R-03·R-06 ↔ AT-05·AT-06·AT-11 | REQUIRED | parts → `backgroundTasksFromMessages` → `SubAgentTaskList` | 렌더 문자열 | required — 셸 필터 제거 변이로 AT-06 이 red 인지 | EP-04·EP-05 (2) |
| VP-04 | R-04 ↔ AT-07·AT-08 | REQUIRED | `subagent.task(settled)` → `createSubagentSettlementEvents` → parts | 반환 배열의 부모 항목 수 · fold 후 stdout | required — kind 게이트 제거 변이로 AT-08 이 red 인지 | EP-06 (1) |
| VP-05 | R-05 ↔ AT-09·AT-10 | REQUIRED | `tool_use_result` → 투영 → 카드 | 렌더 문자열 · 음성 대조 | not selected — AT-10 이 이미 음성 축이다 | EP-04 (1) |
| VP-06 | R-07 ↔ AT-12 | REQUIRED | `subagent_notice` 파트 → `SubagentNoticeRow` | 렌더 문자열 | not selected | EP-07 (1) |
| VP-07 | SD-01 ↔ ST-01 | REQUIRED | 시작→영수증→진행→정착 전 구간을 fake 채널로 1회 | 각 단계 후 트래커·parts 상태 | required — 정착 누락 변이로 red | EP-03·EP-06 (2) |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | 어댑터 → IPC → store 흡수 | `subagentMeta[id].taskKind` | not selected | EP-01 (1) |
| VP-09 | AR-03 ↔ IT-02 | REQUIRED | 어댑터 투영 → writer 영속 → 재로드 fold | 영속 파트의 필드 존재 | required — 투영 누락 변이로 AT-11 red | EP-04 (1) |
| VP-10 | MD-01 ↔ UT-01 | REQUIRED | 순수 함수 단독 | 입력 조합별 반환값 | required — 우선순위를 뒤집는 변이로 AT-02 red | EP-02 (1) |
| VP-11 | MD-02 ↔ UT-02 | REQUIRED | 순수 fold 단독 | 항목 수·필드 | not selected | EP-05 (1) |
| VP-12 | INHERITED: 서브에이전트 카드·통지 1회 (§0.10) | REGRESSION | 기존 경로 그대로 | 기존 테스트 green 유지 | not selected | EP-06 (1) |

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree unit (`app`) | `app/src/main/adapters` · `app/src/renderer/src/features/chat` 를 고친다 | `pnpm -C app test` | 이번 변경이 유발한 red 만 blocking |
| typecheck | 새 IPC 필드와 새 순수 모듈 | `pnpm -C app typecheck` | 전건 blocking |
| lint (boundaries) | main 레이어 DAG 와 renderer 4-layer 를 건드린다 | `pnpm -C app lint` | 전건 blocking |
| build | electron-vite 번들에 새 모듈이 들어간다 | `pnpm -C app build` | 전건 blocking |
| doc inventory | IPC 필드를 늘린다 | `node app/scripts/check-doc-inventory.mjs` | 전건 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `task_*` 정규화는 `tool_use_id` 만 요구하고 종류를 보지 않는다 | `app/src/main/adapters/claude-map.ts:118-176` |
| 런치 영수증 판정이 `status==='async_launched'` 리터럴 하나다 | `app/src/shared/subagent.ts` |
| 영수증이 아니면 `tool.call.completed` 가 추적을 해제한다 | `app/src/main/features/chat/turn-coordinator.ts:514-522` |
| 정착이 부모 `tool.call.completed` 를 합성한다 | `app/src/main/features/chat/subagent-settlement.ts:64-82` |
| 같은 `toolRunId` 의 두 번째 `tool_result` 가 첫 번째를 이긴다 | `app/src/renderer/src/features/chat/lib/parts.ts:231-246` (`resultMap`) |
| 백그라운드 목록 fold 가 Agent 이름으로 좁힌다 | `app/src/renderer/src/features/chat/lib/parts.ts:319` |
| 통지 행 제목 조인도 Agent 이름으로 좁힌다 | `app/src/renderer/src/features/chat/lib/parts.ts:283` |
| `structuredOutput` 은 영속되고 재로드에 복원된다 | `app/src/main/features/history/writer.ts:395`; `chatReducer.ts:962` |
| 편집 도구가 raw 대신 **투영**을 싣는 선례가 있다 | `claude-map.ts:575-586` (`{ structuredPatch }`, 0228 D-007) |
| 셸 도구 이름은 `PowerShell` 이다. `Bash` 는 거부 목록에 있다 | `claude.ts:432`; `risky-tools.ts:8` |

### 전수 조사

| 대상 | 검색 | N | 의미 |
|---|---|---:|---|
| `isAsyncLaunchedPayload` 호출부 | `rg "isAsyncLaunchedPayload" app/src` | 3 | `subagent.ts` 정의 · `turn-coordinator.ts` · `parts.ts` — 술어를 넓히면 세 곳이 함께 따라간다 |
| `isAgentTaskName` 호출부 | `rg "isAgentTaskName" app/src` | 4 | `parts.ts` 정의 + `parts.ts:283`·`parts.ts:319` + `registry.ts` — 타일·통지·렌더 세 소비처 |
| `subagent.task` 이벤트 소비처 | `rg "'subagent.task'" app/src` | 다수 | main: `turn-coordinator`·`settle`·`subagent-settlement`. renderer: `chatStore.ts:588` |
| `task_type` 판독 | `rg "task_type" app/src` | 0 | 신설 |
| `backgroundTaskId` 판독 | `rg "backgroundTaskId" app/src` | 0 | 신설 |

> 위 `N` 은 구현 턴에 **다시 센다**. 여기 값은 설계 시점 관측이며, 구현자는 같은 명령으로
> 재측정해 §10 강제 지점 수와 대조한다.

### 수치 / 전칭 표현 검산

- "모든 `task_*` 이 서브에이전트로 취급된다": `mapTaskSystem` 에 종류 분기가 없음을 함수 전문
  (118-176)으로 확인. 반례 없음.
- "`Workflow` 만 `async_launched` 를 돌려준다": 스펙 기준의 주장이며 **코드 관측이 아니다**.
  0234 가 실제 로그로 확인한다.
- 문서 앵커 확인: `docs/claude-taskxxx-spec.md` 의 `§4.1`(130행) · `§4.3`(152행) 존재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

- 관련 V node: `SD-01`, `AR-01`~`AR-04`.
- 현재 책임 소유자: `claude-map.mapTaskSystem`(정규화) · `BackgroundTaskTracker`(라이브 집합) ·
  `subagent-settlement`(정착) · `parts.subagentTasksFromMessages`(표시 fold).
- 문제의 직접 원인: 네 소유자가 모두 "task = 서브에이전트" 를 전제한다. 종류를 나르는 필드가
  계약에 없다.

```text
SDK task_started(tool_use_id)
  → mapTaskSystem            (종류 미판정)
  → subagent.task            (taskKind 없음)
  → BackgroundTaskTracker    (전부 동일 취급)
  → parts fold               (Agent 이름으로 걸러 셸은 탈락)

셸 tool_result(backgroundTaskId)
  → isAsyncLaunchedPayload = false
  → backgroundTasks.settled  (아직 도는데 추적 해제)

task_notification(셸)
  → createSubagentSettlementEvents
  → tool.call.completed { summary:'' }
  → resultMap 마지막 승       (stdout 소멸)
```

### TO-BE

- 관련 V node: 같음.
- 변경 후 책임 소유자: `taskKindFrom`(신설 순수 모듈)이 종류의 SSOT. 나머지 넷은 그 값을 **읽기만**
  한다.
- 유지하는 기존 메커니즘: 트래커의 레벨 신호 REPLACE · 완료 통지 1회 게이팅 · `stopTask` 수명주기.
- 대체하는 메커니즘: `isAsyncLaunchedPayload` 단독 판정 → `readLaunchReceipt` 로 감싼다(기존 함수는
  에이전트 판별 용도로 남는다).

```text
SDK task_started(tool_use_id, task_type)
  → mapTaskSystem + ctx.toolNameByRunId
  → taskKindFrom(toolName, task_type)     ← SSOT
  → subagent.task { taskKind }
  → BackgroundTaskTracker (kind 보존)
  → backgroundTasksFromMessages           (kind 별 카드)

셸 tool_result(backgroundTaskId)
  → readLaunchReceipt → { kind:'shell', taskId }
  → markAsyncLaunched 상당 (추적 유지)
  → structuredOutput: { shellBackground:{…} }  → 영속

task_notification(셸)
  → createSubagentSettlementEvents(taskKind)
  → 부모 이벤트 없음 (D-006)               → stdout 보존
  → 타일 카드만 상태 전이
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 연결 |
|---|---|---|---|---|
| 책임/소유권 | 종류 개념 없음 | `taskKindFrom` 단일 소유 | 네 소비처가 각자 추측하면 갈라진다 | MD-01 / VP-10 · `shared/task-kind.ts` |
| data flow | `subagent.task` 가 종류를 안 나른다 | `taskKind` 필드 추가 | 표시·정착·추적이 같은 값을 본다 | AR-01 / VP-01·VP-08 |
| state/contract | 영수증 = `async_launched` 하나 | 런치 영수증 union | 셸 영수증은 `status` 가 없다 | AR-02 / VP-02 |
| 영속 | 셸 결과 투영 없음 | `structuredOutput.shellBackground` | 재로드 복원 | AR-03 / VP-09 |
| error/lifecycle | 정착이 결과를 덮는다 | kind 게이트로 부모 이벤트 생략 | 출력 소멸 방지 | AR-04 / VP-04 |
| test seam | 없음 | 순수 `task-kind` · 순수 fold | electron 비의존 | MD-01·MD-02 / VP-10·VP-11 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import |
|---|---|---|---|
| `app/src/shared/task-kind.ts` (신설, L0) | `taskKindFrom` · `readLaunchReceipt` · `TaskKind` 타입 | (도구이름, `task_type`) → kind · `tool_use_result` → 영수증 \| undefined | main 어댑터 · main 트래커 · renderer parts |
| `claude-map.ts` | `ctx.toolNameByRunId` 유지 · `taskKind` 부착 · 셸 투영 | SDK 메시지 → `NormalizedEvent[]` | 어댑터 내부 |
| `subagent-settlement.ts` | kind 게이트 | 정착 이벤트 → `tool.call.completed[]` | `turn-coordinator` |
| `parts.ts` | `backgroundTasksFromMessages` | `Message[]` → 카드 모델 | 타일 · 통지 행 |

## 10. 계약 / 타입 / 강제 지점

| EP | V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 | AR-01 / VP-01·VP-08 | `subagent.task.taskKind?: TaskKind` | `shared/ipc.ts` | 어댑터가 부착, store 가 흡수 | 정규화 시점 | 소비처가 종류를 모른다 → 셸이 다시 에이전트로 보인다 |
| EP-02 | MD-01 / VP-01·VP-10 | 종류 판정 우선순위 = 도구이름 > `task_type` > `unknown` | `shared/task-kind.ts` | `taskKindFrom` | 정규화 시점 | Monitor 와 셸이 뒤섞인다(둘 다 `local_bash`) |
| EP-03 | AR-02 / VP-02·VP-07 | 런치 영수증 = `async_launched` **또는** `backgroundTaskId` 보유 | `shared/task-kind.ts` | `turn-coordinator` 의 `tool.call.completed` 분기 | 도구 결과 도착 | 백그라운드 셸이 추적에서 빠져 세션이 기다리지 않는다 |
| EP-04 | AR-03 / VP-05·VP-09 | `structuredOutput = { shellBackground: { taskId, timedOutAfterMs?, persistedOutputPath?, rawOutputPath? } }` — **raw payload 를 싣지 않는다** | `claude-map.ts` | 어댑터 | `tool_result` 매핑 | raw 를 실으면 stdout 이 두 번 저장된다 |
| EP-05 | MD-02 / VP-03·VP-11 | 백그라운드 목록의 포함 술어 = 에이전트 이름 **또는** `shellBackground` 보유 | `parts.ts` | `backgroundTasksFromMessages` | 렌더 fold | 셸 카드가 안 뜨거나 foreground 셸까지 뜬다 |
| EP-06 | AR-04 / VP-04·VP-07·VP-12 | 부모 합성 `tool.call.completed` 는 **에이전트가 아님이 확인된 종류**(`shell`·`monitor`·`workflow`)에서만 생략한다. 종류 미확인(키 부재·`'unknown'`)은 현행대로 합성한다 | `subagent-settlement.ts` | 정착 빌더 | `task_notification` 도착 · `task_updated(killed)` · 합성 정착(`settle.ts`) | 생략 조건이 좁으면 셸 stdout 이 `{summary:''}` 로 덮이고, 넓으면(`=== 'agent'`) 종류를 못 읽은 에이전트 카드가 영원히 실행 중으로 남는다 |
| EP-07 | R-07 / VP-06 | 통지 행 제목 조인 술어 = 백그라운드 목록과 **같은 술어** | `parts.ts` | `subagentTaskDescription` 개칭분 | 통지 렌더 | 셸 통지 행의 제목이 빈다 |

> **EP-06 정정(설계 턴, 구현 전)**: 초안은 `taskKind === 'agent'` 에만 합성한다고 적었다. 그
> 술어는 종류 미확인에서 **에이전트 정착까지 막아** `§0.10` 의 회귀 대상(서브에이전트 카드)을
> 깨뜨린다 — `VP-12` 가 보호하는 동작이다. 보호하려는 불변식은 "셸의 stdout 이 살아남는다" 이지
> "비-에이전트 정착을 없앤다" 가 아니므로, 판정을 **확인된 비-에이전트**로 뒤집는다. 강제 지점도
> 셋으로 늘린다 — 정착 이벤트의 생산자가 `task_notification` 하나가 아니다.

- 같은 규칙이 여러 레이어에 있는 곳: EP-05 와 EP-07 이 **같은 포함 술어**를 쓴다. `parts.ts` 가
  하나의 `isBackgroundTaskCall(call)` 를 export 하고 두 소비처가 그것을 부른다 — 술어를 복붙하지
  않는다.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: 없음.
- 선택적 필드 의미: `taskKind` **미지정 = 판정 불가**(구형 CLI). `unknown` 과 다르다 — 전자는
  이벤트에 키가 없고, 후자는 종류를 봤지만 어휘에 없다. 소비처는 둘 다 "일반 작업 카드" 로
  그리되 원본을 버리지 않는다.
- 외부 SDK 경계: `tool_use_result` 는 `unknown` 이다. `readLaunchReceipt` 가 `isRecord` 가드 뒤에
  필드를 읽고, 타입이 어긋나면 `undefined` 를 돌려준다(거짓 영수증보다 미판정).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/task-kind.ts` | 신설 L0 | `TaskKind` · `taskKindFrom` · `readLaunchReceipt` · `SHELL_TOOL_NAMES` | 순수 단위 |
| `app/src/shared/ipc.ts` | 계약 | `subagent.task` 에 `taskKind?` 추가 | 타입 |
| `app/src/main/adapters/claude-map.ts` | 정규화 | `ctx.toolNameByRunId`(경계 도구만) · `mapTaskSystem` 에 kind 부착 · 셸 `structuredOutput` 투영 | 순수 단위(기존 `claude-map.test.ts`) |
| `app/src/main/features/chat/turn-coordinator.ts` | 추적 | `tool.call.completed` 분기를 `readLaunchReceipt` 로 교체 | 단위(기존 `turn-coordinator.test.ts`) |
| `app/src/main/features/chat/background-tasks.ts` | 추적 | kind 보존(표시용, 판정은 안 바꾼다) | 단위 |
| `app/src/main/features/chat/subagent-settlement.ts` | 정착 | kind 게이트 | 순수 단위 |
| `app/src/renderer/src/features/chat/lib/parts.ts` | fold | `isBackgroundTaskCall` · `backgroundTasksFromMessages` · 제목 조인 확장 | 순수 단위 |
| `app/src/renderer/src/features/chat/components/rightpanel/SubAgentTileContent.tsx` | 표시 | 셸 카드 분기 | `renderToStaticMarkup` |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | 셸 카드 라벨 · 타임아웃 전환 문구 | — |
| `docs/claude-taskxxx-spec.md` | 해설 미러 | `task_type` ❌ → ✅, Bash 결과 필드 행 추가 | — |
| `docs/IPC_CONTRACT.md` | 계약 | `subagent.task.taskKind` | — |

### 테스트 가능성

- electron 의존 분리: `task-kind.ts` 는 L0(런타임 의존 0)라 main·renderer 양쪽 테스트에서 직접
  import 한다 — `shared/subagent.ts` 의 선례와 같은 자리다.
- 기존 메커니즘 재사용 적합성: `structuredOutput` 투영은 0228 의 `{ structuredPatch }` 와 같은
  지점·같은 게이트 방식이다. 새 영속 채널을 만들지 않는다.
- 순서 관측: VP-07 은 fake 채널에 이벤트를 순서대로 넣고 각 단계 후 트래커·parts 를 관측한다.

## 12. End-to-end 영향

```text
SDK system/tool_result
  → claude-map (taskKind · shellBackground 투영)
  → NormalizedEvent subagent.task / tool.call.completed
  → main: BackgroundTaskTracker · settlement
  → IPC → chatStore(subagentMeta) · chatReducer(parts)
  → parts fold → SubAgentTaskList · SubagentNoticeRow · BashBody
```

- producer 기준: `taskKind` 는 어댑터만 만든다. renderer 는 파생하지 않는다.
- consumer 파생 규칙: 카드 포함 여부는 `isBackgroundTaskCall` 하나로만 판정한다.
- 합성값 우회 방지: renderer 가 도구 이름으로 "이건 셸이니 백그라운드겠지" 를 추론하지 않는다 —
  foreground 셸과 구분되지 않기 때문이다.

### 기존 소비처 영향

| 기존 소비처 | 변경 영향 | 회귀 AC |
|---|---|---|
| `SubAgentTaskList`(에이전트 카드) | 목록이 늘어난다. 그룹 분류·중단 버튼 술어는 그대로 | VP-12 |
| `SubagentNoticeRow` | 제목 조인 술어가 넓어진다. 에이전트 행은 불변 | VP-12 |
| `AgentTaskRow` | 변경 없음 — Agent 전용 행이다 | VP-12 |
| `backgroundTaskCount` 배지 | **의미가 바뀌지 않는다**(0231 소관). 셸이 추적에 남으므로 건수가 늘 수 있다 | 0231 로 이월 |

> 마지막 행이 이 handoff 의 알려진 부작용이다. EP-03 이 셸을 추적에 남기면 배지 건수가
> 늘어난다 — 실제로 도는 작업이므로 **정확해지는 방향**이지만, 배지 문구의 의미 정정은 0231 이다.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `task_started` 또는 런치 영수증 중 먼저 온 것으로 레코드가 선다(기존 순서 역전 처리
  그대로).
- 취소/중단: 사용자 중단은 `stopTask(taskId)` — 셸도 같은 경로다. `taskId` 는 `task_started` 에서
  온다.
- 종료/crash/renderer-gone: `backgroundTasks.clear(sessionId)` 경로 불변(`send.ts` 의 `onOwnerGone`).
- 채널 사망: `settleDeadBackgroundTasks` 가 셸도 함께 정착시킨다. **이때는 부모 합성 결과가
  없으므로** 도구 카드가 마지막 stdout 인 채로 남는다 — 타일 카드가 실패로 정착해 사유를 말한다.
- **다중 저장소 쓰기**: 해당 없음. 이번 변경의 영속은 `structuredOutput` 한 곳이다.

## 14. 성능 / 상한 / 최적화

- `ctx.toolNameByRunId` 는 **경계 도구 이름만** 담는다(에이전트·셸·Monitor·Workflow·Skill).
  턴 길이에 비례해 자라지 않는다 — `taskToolRunIds` 와 같은 제한 방식이다.
- `structuredOutput.shellBackground` 는 필드 4개의 투영이다. stdout 을 싣지 않으므로 파트 크기가
  명령 출력에 비례하지 않는다.
- `backgroundTasksFromMessages` 는 기존 fold 와 같은 1-entry 캐시를 쓴다(`taskBoardForMessages`
  선례) — 헤더·본문 두 컴포넌트가 같은 배열을 두 번 접지 않게 한다.

## 15. 외부 구현 포트 / 문서 계약

- 외부 구현자가 구현할 port: 없음.
- 갱신할 문서: `docs/claude-taskxxx-spec.md`(`task_type` 채택 표기) · `docs/IPC_CONTRACT.md`
  (`taskKind` 필드). 둘 다 해설 미러/계약이라 **같은 커밋**에서 갱신한다.

---

> **[구현자 기입]** 이하는 구현 턴(r1)이 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: Part I 전부와 Part II §9~§14. AS-IS 의 네 소유자 진단이 코드와 일치했다.
- 이견 / 현실성 문제: **§10 EP-06 의 술어**. 초안 `taskKind === 'agent'` 는 종류 미확인에서
  에이전트 정착까지 막아 §0.10 의 회귀 대상(서브에이전트 카드)을 깨뜨린다. 규범 행이라 구현과
  분리해 설계 턴으로 정정했다(선행 커밋).
- ACTIVE Decision 과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·VP-08 | `subagent.task.taskKind` 부착 | 어댑터 부착 (2) | 2/2 | `rg "taskKind !== undefined \? \{ taskKind \}" src/main/adapters/claude-map.ts` → 2건 | 소비자가 store 가 아니다(아래 차이) |
| VP-01·VP-10 | 종류 우선순위 SSOT | `taskKindFrom` 호출부 (2) | 2/2 | `rg "taskKindFrom\(" src --type ts \| grep -v test \| grep -v "export function"` → 2건 | — |
| VP-02·VP-07 | 런치 영수증 술어 | `tool.call.completed` 분기 (1) | 1/1 | `rg "readLaunchReceipt\(" src \| grep -v test \| grep -v "export function"` → 1건 (`turn-coordinator.ts:522`) | — |
| VP-05·VP-09 | 셸 투영 생성 | `tool_result` 매핑 (1) | 1/1 | `rg "shellBackground \}" src/main/adapters/claude-map.ts` → 1건 | — |
| VP-03·VP-11 | 목록 포함 술어 | fold + 제목 조인 (2) | 2/2 | `rg "isBackgroundTaskCall\(" src \| grep -v test \| grep -v "export function"` → 2건 | — |
| VP-04·VP-07·VP-12 | 정착 kind 게이트 | 게이트 1 + **정착 생산자 4** | 1/1 + **4/4** | `rg "phase: 'settled'" src/main \| grep -v test` → 4건(`settle.ts:111`·`stop-subagent.ts:99`·`mock-scenarios.ts:278`·`claude-map.ts:322`) + `mapTaskSystem` 의 `phase` 변수 경로. 프로덕션 4곳 전부 `taskKind` 를 싣는다 | `mock-scenarios.ts` 는 dev mock — 프로덕션 아님 |
| VP-06 | 제목 조인 술어 = 목록 술어 | **EP-05 와 같은 2지점** | 2/2 | `rg "isBackgroundTaskCall\(part, resultByRun\)" src/renderer/.../parts.ts` → 2건(fold + 조인). 두 EP 가 같은 집합이라 합계에서 한 번만 센다 | — |

- **§10 에 없는데 같은 불변식이 필요했던 지점: 1건 → 선조치.** `stop-subagent.ts:99`(중단
  watchdog 정착)가 네 번째 정착 생산자인데 §10 초안의 지점 목록(3)에 없었다. 술어를 해법 이름
  (`readLaunchReceipt`)이 아니라 불변식의 주어(`phase: 'settled'` 를 내는 곳)로 다시 세어 찾았다.
  게이트만 고치고 이 생산자를 빠뜨렸다면 **중단 경로에서만** 셸 stdout 이 덮였다.

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `claude-map.taskKind.test.ts` 11케이스 | not selected — 값 단언 |
| VP-02 | REQUIRED | SELF_PASS | AT-03·AT-04 케이스 | required — M1 red(AT-03) |
| VP-03 | REQUIRED | SELF_PASS | fold 6 + 렌더 10케이스 | required — M4 red 13건 |
| VP-04 | REQUIRED | SELF_PASS | 정착 5케이스 | required — M2 red 3건 · M7(형제 반전) red 4건 |
| VP-05 | REQUIRED | SELF_PASS | 투영 4 + 렌더 2케이스 | not selected — AT-10 이 음성 축 |
| VP-06 | REQUIRED | SELF_PASS | 조인 3케이스 | not selected |
| VP-07 | REQUIRED | SELF_PASS | 시작→영수증→정착 전 구간(트래커 6케이스) | required — M1·M2 로 대체 관측 |
| VP-08 | REQUIRED | SELF_PASS | **store 가 아니라 main 소비자**(tracker·settlement) 3지점 | not selected |
| VP-09 | REQUIRED | SELF_PASS | 영속 파트만으로 카드 복원(AT-11) | required — M5 red 3건 |
| VP-10 | REQUIRED | SELF_PASS | 우선순위 5케이스 | required — M3 red 2건 |
| VP-11 | REQUIRED | SELF_PASS | fold 단독 | not selected |
| VP-12 | REGRESSION | SELF_PASS | 에이전트 카드·통지·정착 회귀 4케이스 + 기존 295 우측패널 케이스 green | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `task-kind.ts` — 셸 영수증 분기 제거 | `VP-02 선택 증거` | 최초 | `AT-03: backgroundTaskId 결과가 도착해도 추적이 줄지 않는다` 1건 | 잠김 |
| `subagent-settlement.ts` — kind 게이트 제거 | `VP-04 선택 증거` | 최초 | AT-07 외 3건 | 잠김 |
| `task-kind.ts` — 종류 우선순위 뒤집기 | `VP-10 선택 증거` | 최초 | AT-02 외 2건 | 잠김 |
| `parts.ts` — 포함 술어를 이름만으로 | `VP-03 선택 증거` | 최초 | 13건 | 잠김 |
| `claude-map.ts` — 셸 투영 미부착 | `VP-09 선택 증거` | 최초 | 3건 | 잠김 |
| `SubAgentTileContent.tsx` — **형제 맞바꿈**: 셸 카드에 에이전트 라벨 | `VP-03 형제 슬롯 계약` | 최초 | AT-06 1건 | 잠김 |
| `subagent-settlement.ts` — **형제 맞바꿈**: 게이트 반전(agent 만 생략) | `VP-04 형제 슬롯 계약` | 최초 | 4건 | 잠김 |
| `stop-subagent.ts` — watchdog 정착에서 종류 제거 | `§10 신설 지점 민감도` | 최초 | `watchdog 정착이 종류를 싣는다` 1건 | 잠김 |

- **분모 검산**: 선택 증거 5 · 인용 변이 0 · 새 oracle(형제 맞바꿈 2 + 신설 지점 1) 3 = 표 행 8. ✅
- **덮개 회귀**: 이전 라운드 없음(r1) — 해당 없음.

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ `kind.shell`·`timedOutToBackground` 둘 다 `ShellTaskCard` 가 렌더하고 렌더 테스트가 문자열을 관측한다 | — |
| seam 을 만들려고 production 을 재배치했는가 | 재배치 없음 — 새 파일(`task-kind.ts`)과 분기 추가뿐이다 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ 6행 전부 대응. 채널 사망·watchdog 정착은 "채널 사망" 행 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | ✅ 중단 실패는 기존 `stopErrors` 문구를 셸 카드도 렌더한다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | ✅ 정착 후 통지 파트가 상태를 확정하고, 늦은 `started` 는 `kind` 를 덮어쓰지 않는다(테스트 있음) | — |

- **파생(범위 밖, 0231 로)**: 실행 중 셸 카드에 **경과 시간이 없다**. Part I §5 흐름은 "경과" 를
  적었지만 AC 는 그것을 잠그지 않았고, 진행 표시(F-04·F-05)는 0231 의 범위다. 지금은 정착 후
  `durationMs` 만 그린다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `stop-subagent.ts` watchdog 정착이 §10 지점 목록에 없었다 | ✅ 선조치 + 테스트 + 변이 | `rg "phase: 'settled'" src/main` → 4건 |
| 2 | 셸 task 의 **종단 상태가 어디에 영속되는가** 가 설계에 없었다. D-006 이 부모 결과 합성을 없애면서 재로드 복원 경로가 함께 사라진다 | ✅ 선조치 — `subagent_notice` 파트(이미 영속)를 상태원으로 쓴다 | AT-11 이 영속 파트만으로 통과 |
| 3 | 셸 카드의 서술이 도구 이름(`PowerShell`)으로 떨어졌다 — `toolDescriptionFromInput` 은 `description` 만 읽는다 | ✅ 선조치 — 명령 첫 줄 규칙을 `parts.shellCommandDescription` 단일 소유로 옮기고 `toolMeta` 가 부른다 | 최초 테스트 2건 red → green |
| 4 | VP-08 의 oracle(`subagentMeta[id].taskKind`)이 **죽은 표면**을 요구한다 | 📝 **plan 수정 제안** — 렌더러는 transcript fold 에서 종류를 얻는다(재로드 생존). store 에 두 번째 출처를 만들면 갈라진다 | `parts.ts:367` 이 유일 파생원 |

### 설계 대비 명시적 차이 (r1)

- plan 이 지정한 것과 다르게 구현한 것: **VP-08 의 소비자**. `store 흡수` 대신 main 의
  tracker·settlement 가 `taskKind` 를 소비한다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 트래커 레코드는 정착에서만 사라지고 TTL 이 없다 | `background-tasks.ts` 에 시간 기반 제거 0건 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | **있다** — `clear(sessionId)` 와 `settled()` 가 종류를 함께 지운다. 정착 **후** 읽으면 `undefined` 다 | §10 EP-06 / `stop-subagent.ts:95` 를 `settled()` **앞**으로 두고 테스트로 잠갔다 |
| 재진입 | 순서 역전(영수증이 시작보다 먼저)에서 종류가 미지정으로 남을 수 있다 | AT-07 음성 케이스 — 미지정은 현행(합성) 유지라 회귀가 아니다 |
| 다른 무효화 축 | CLI 재기동(`resetLevel`)은 종류를 지우지 않는다 — 레코드 자체가 `clear` 로 사라진다 | `background-tasks.ts:183-186` 관측 |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 2(`shared/task-kind.ts` + 테스트 4) · 수정 12(`ipc.ts`·`claude-map.ts`·`background-tasks.ts`·`turn-coordinator.ts`·`settle.ts`·`subagent-settlement.ts`·`stop-subagent.ts`·`parts.ts`·`toolMeta.ts`·`SubAgentTileContent.tsx`·`ko.ts`·`en.ts`) · 문서 2 |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `./node_modules/.bin/electron-vite build` · `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출** | vitest **491파일 / 4571케이스 · 실패 0 · skip 3**. 파일 6건은 수집 오류(`Electron failed to install correctly`) — **변경 전 트리에서 같은 6건 동일 실패**(`git stash` 후 측정). typecheck 3구성 `error TS` 0건. lint 0 error / 1 warning(`useTranscriptVirtualizer.ts` — 미수정 파일, 기존). build 3번들 성공. doc-inventory 3검사 통과 |
| 환경 기인 분리 근거 | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 로 설치해 electron 바이너리가 없다. `npm rebuild better-sqlite3`(Node ABI) 후 DB 스위트는 전부 green — 남은 6건은 `electron/index.js` 로드 실패 하나뿐이다 |
| V-pair 자기확인 | `SELF_PASS 12 / SELF_BLOCKED 0` |
| 강제 지점 전수 | **13/13**. 합계를 행과 별개로 다시 셌다: EP-01 2 · EP-02 2 · EP-03 1 · EP-04 1 · **EP-05+EP-07 2(공유 — 같은 두 호출부라 따로 세면 중복)** · EP-06 게이트 1 + 프로덕션 정착 생산자 4 = 13. `mock-scenarios.ts:278` 은 dev mock 이라 분모 밖이다 |
| **AC 자기보고**(`Criteria-Met`) | 12/12 — AT-01·02(`claude-map.taskKind.test.ts`) · AT-03·04·07(`shell-background.test.ts`) · AT-05·06·09·10(`shellTaskCard.render.test.ts` + fold) · AT-08·11·12(`shellBackgroundTasks.test.ts`) |
| **합계 검산** | `✅ 12 · ⚠️ 0 · ❌ 0 = 총 12` — 분모는 §7 의 AT 행을 다시 세었다(AT-01~AT-12). 분모 변경 없음 |
| 블로커 / 역질문 | 없음. 단 셸 백그라운드의 **실제 SDK payload 는 스펙 기준 추론**이고 이 환경에서 Windows 실기를 못 한다 — 검증자·사람이 실제 로그로 확인할 항목이다 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 — r1 이다.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **§10 EP-06 의 지점 목록이 3이었고 실제는 4였다.**
  설계 턴이 정착 생산자를 `task_notification` 중심으로 셌고 `stop-subagent.ts` 의 watchdog 경로를
  빠뜨렸다. 구현 턴이 `phase: 'settled'` 전수 검색으로 찾았다.
- 반복해서 부딪히는 환경 한계: electron 바이너리 egress 차단 — `npm test`·`npm run build` 의
  pre 훅이 막힌다. `vitest` 직접 호출 + `electron-vite build` 직접 호출로 우회했다.
- 현재 라운드 수: 1

---

## [구현자 기입] 설계 리뷰 (r2)

- 동의 / 그대로 진행: Part I·Part II·§10 전부. r2 는 **기능을 다시 만들지 않았다** — 코드 동작
  변경은 D2·D3 두 비차단 이슈뿐이고 나머지는 증거를 프로덕션 경로로 옮긴 것이다.
- 이견 / 현실성 문제: 없음. §10 은 r1 의 13지점 그대로다(재열거 13 — 아래 전수표).
- ACTIVE Decision 과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r2)

§10 에 행 신설·삭제가 없으므로 **분모는 r1 과 같은 13** 이다. 값을 기억하지 않고 다시 셌다 —
EP-05·EP-07 의 검색 술어는 r2 가 인자 형태를 바꿔(`resultByRun` → 조회 콜백) r1 의 리터럴로는
0건이 나온다. 술어를 불변식의 주어(`isBackgroundTaskCall` 호출)로 바꿔 세었다.

| Pair | 계약/필드 | §10 지점 | 닫은 지점 | 재현 명령 / 관측 |
|---|---|---|---|---|
| VP-01·VP-08 | `taskKind` 부착 | 2 | 2/2 | `grep -c "taskKind !== undefined ? { taskKind }" claude-map.ts` → 2 |
| VP-01·VP-10 | 종류 우선순위 SSOT | 2 | 2/2 | `grep -rn "taskKindFrom(" src \| grep -v test \| grep -v "export function"` → 2 |
| VP-02·VP-07 | 런치 영수증 술어 | 1 | 1/1 | `grep -rn "readLaunchReceipt(" src \| grep -v test \| grep -v "export function"` → 1 (`turn-coordinator.ts:522`) |
| VP-05·VP-09 | 셸 투영 생성 | 1 | 1/1 | `grep -c "shellBackground }" claude-map.ts` → 1 |
| VP-03·VP-06·VP-11 | 목록 포함 술어 = 조인 술어 | 2(공유) | 2/2 | `grep -n "isBackgroundTaskCall(" parts.ts \| grep -v "export function"` → 2 |
| VP-04·VP-07·VP-12 | 정착 kind 게이트 | 1 | 1/1 | `grep -rn "settlementOverwritesOwnResult(task)" src \| grep -v test` → 1 |
| VP-04·VP-12 | 정착 생산자 전수 | 4 | 4/4 | `grep -rn "phase: 'settled'" src/main \| grep -v test` → 4(`settle.ts:111`·`stop-subagent.ts:107`·`mock-scenarios.ts:278`·`claude-map.ts:322`). `const phase` 경로는 `claude-map.ts:184` 1건 |

- **합계 재검산**: `2+2+1+1+2+1+4 = 13`. r1 자기보고·verify r1 독립 재열거와 같다. 분모 변경 없음.
- **§10 밖이지만 이번에 닫은 불변식 1건**: "하위 대화록이 없는 셸 작업은 상세 진입 어포던스를
  갖지 않는다"(D3). 현재 AC·ACTIVE Decision 어디에도 귀속되지 않아 §10 행을 신설하지 않았다 —
  `PLAN_GAP` 이 아니라 비차단 파생 이슈의 종결이다. 전수는 아래 §놓친 잠재 문제 2 에 있다.

**V-pair 자기확인 (r2)** — `SELF_PASS`는 독립 검증의 `PASS`가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `claude-map.taskKind.test.ts` 11케이스 | not selected — 값 단언 |
| VP-02 | REQUIRED | SELF_PASS | **프로덕션 `TurnCoordinator.run` 을 지나는** AT-03·AT-04 | required — W1 red 1건(r1 은 green 이었다) |
| VP-03 | REQUIRED | SELF_PASS | fold 6 + 렌더 10 + **컨테이너 마운트 2** | required — M4 red 16건 |
| VP-04 | REQUIRED | SELF_PASS | 정착 5 + **`settleTaskSubset` 배선 2** | required — M2 red 4 · M7 red 6 |
| VP-05 | REQUIRED | SELF_PASS | 투영 4 + 렌더 2 | not selected — AT-10 이 음성 축 |
| VP-06 | REQUIRED | SELF_PASS | 조인 3 + **통지 행 컨테이너 마운트 4** | not selected |
| VP-07 | REQUIRED | SELF_PASS | 시작→영수증→정착이 **한 코디네이터 실행**을 지난다 | required — W1·W2·W3 red |
| VP-08 | REQUIRED | SELF_PASS | main 소비자(tracker·settlement) 3지점 | not selected |
| VP-09 | REQUIRED | SELF_PASS | 영속 파트만으로 카드 복원 | required — M5 red 3건 |
| VP-10 | REQUIRED | SELF_PASS | 우선순위 5케이스 | required — M3 red 2건 |
| VP-11 | REQUIRED | SELF_PASS | fold 단독 | not selected |
| VP-12 | REGRESSION | SELF_PASS | 에이전트 카드·통지 행·정착 회귀 + 전 스위트 4578 green | not selected |

`SELF_PASS 12 / SELF_BLOCKED 0`. VP-02·VP-07 이 r1 의 `PAIR_FAIL`·`BLOCKED_BY` 대상이었다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| W1 `turn-coordinator.ts:522` → `readLaunchReceipt(ev)?.kind === 'agent-async'` | `D1 인용 변이` | **r1 green(4571 전건)** | `AT-03: backgroundTaskId 결과가 코디네이터를 지나도 추적이 줄지 않는다` 1건 | 잠김 |
| W2 `turn-coordinator.ts:445` → `started()` 3번째 인자 제거 | `새 oracle — started 배선` | 최초 | `started 이벤트의 taskKind 가 트래커에 기록된다` 외 1건 = 2건 | 잠김 |
| W3 `settle.ts:106` → `kind = undefined` | `새 oracle — 정착 배선` | 최초 | `레벨 제외 정착이 트래커의 종류를 실어 보낸다` 1건 | 잠김 |
| W4 `SubAgentTileContent.tsx:258` 셸 분기 제거 | `새 oracle — 컨테이너→카드` | 최초 | 4건(AT-06·AT-09·진입점 부재·컨테이너 경유) | 잠김 |
| W5a `SubagentNoticeRow` `hasDetail = true` | `새 oracle — 컨테이너→통지 행` | 최초 | 2건 | 잠김 |
| W5b **형제 맞바꿈** `hasDetail = joined?.kind === 'shell'` | `형제 슬롯 계약` | 최초 | 4건(셸 2 + 에이전트 1 + 미확인 1) | 잠김 |
| W5c `TranscriptActionRow` 비대화형 분기 제거 | `새 oracle 민감도` | 최초 | 2건 | 잠김 |
| W6 `claude-map.ts:558` 경계 도구 기억 제거 | `불변식 전수 재열거` | 최초 | 6건 | 잠김 |
| W7 `toolMeta.ts` 셸 명령 폴백 제거 | `불변식 전수 재열거` | 최초 | `Bash 는 description 없으면 명령 첫 줄로 폴백` 1건 | 잠김 |
| M1 `task-kind.ts` 셸 영수증 분기 제거 | `VP-02 선택 증거` | r1 red 1 | 1건 | 잠김 |
| M2 `subagent-settlement.ts` kind 게이트 제거 | `VP-04 선택 증거` | r1 red 3 | 4건(+1 = W3 의 첫 케이스) | 잠김 |
| M3 `task-kind.ts` 우선순위 뒤집기 | `VP-10 선택 증거` | r1 red 2 | 2건 | 잠김 |
| M4 `parts.ts` 포함 술어를 이름만으로 | `VP-03 선택 증거` | r1 red 13 | 16건 | 잠김 |
| M5 `claude-map.ts` 셸 투영 미부착 | `VP-09 선택 증거` | r1 red 3 | 3건 | 잠김 |
| M6 **형제 맞바꿈**: 셸 카드에 에이전트 라벨 | `VP-03 형제 슬롯 계약` | r1 red 1 | 2건 | 잠김 |
| M7 **형제 맞바꿈**: 정착 게이트 반전 | `VP-04 형제 슬롯 계약` | r1 red 4 | 6건 | 잠김 |
| M8 `stop-subagent.ts` watchdog 정착에서 종류 제거 | `§10 신설 지점 민감도` | r1 red 1 | 1건 | 잠김 |

- **분모 검산**: 선택 증거 5(M1·M2·M3·M4·M5) · 인용 변이 1(D1 → W1) · 새 oracle 4개의 변이
  6(W2·W3·W4·W5a·W5b·W5c) · 불변식 전수 재열거 5(M6·M7·M8·W6·W7) = **표 행 17**. ✅
- **덮개 회귀**: r1 이 red 로 관측한 8변이(M1~M8)를 전부 다시 실행했다 — **red → green 0건**.
  세 변이가 커졌다(M4 13→16 · M6 1→2 · M7 4→6): r2 가 같은 계약에 관측 지점을 더한 결과다.
  M2 는 verify r1 의 독립 재측정 `3` 에 W3 의 첫 케이스가 더해져 4다.
- 실행 방식: 변이 1건 적용 → `./node_modules/.bin/vitest run`(전 스위트) → 원복. 실패 케이스
  이름은 대상 스위트 재실행으로 확인했다.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ r2 는 새 문구를 만들지 않았다 — 어포던스를 **없앤** 변경이다 | — |
| 그 제거가 화면에서 "아무 일도 안 일어남"이 되지 않는가 | ✅ 셸 통지 행은 버튼 역할·포인터·꺾쇠가 함께 사라져 **누를 수 있게 보이지 않는다**. 눌러도 반응 없는 행이 아니라 처음부터 평문 행이다 | — |
| seam 을 만들려고 production 을 재배치했는가 | `TranscriptActionRow` 의 `onActivate` 를 선택으로 넓혔다. 기존 두 호출부는 항상 값을 넘기므로 동작 불변 — 회귀는 전 스위트 4578 green | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 신규 실패 경로 없음 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | ✅ `subagentTaskJoin` 은 messages 파생이라 늦은 파트가 도착하면 종류가 `undefined` → `shell` 로 **좁아지는 방향**으로만 바뀐다. 반대(셸 → 에이전트)는 없다 | — |
| 상세로 가는 다른 길이 남아 있는가 | ✅ 선택 지점 4 · 인라인 펼침 1 중 셸 도달 3, 전부 닫혔다(아래 전수) | — |

- **파생(범위 밖, 0231 로)**: r1 과 같다 — 실행 중 셸 카드에 경과 시간이 없다. r2 가 바꾸지 않았다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **D1 은 한 줄이 아니라 불변식이었다** — "이번 핸드오프가 만든 배선을 프로덕션 호출부에서 관측한다". 지적된 `turn-coordinator.ts:522` 만 고치면 형제 배선이 다음 라운드에 올라온다 | ✅ 배선 12지점을 전수로 세고 잠기지 않은 4곳을 함께 닫았다(W2·W3·W4·W5) | 전수표는 아래 |
| 2 | D3 의 "상세 진입" 도 한 지점이 아니다 | ✅ 선택 4 + 인라인 펼침 1 = 5지점을 세고 셸 도달 3지점을 닫았다 | `grep -rn "openSubagentTask(\|selectSubagentTask("` → 4(그중 `(null)` 제외). `AgentTaskBody`·`AgentTaskRow` 는 `registry.ts:82` 가 Bash/PowerShell 을 `terminal` 로 먼저 잡아 셸이 도달하지 못한다 |
| 3 | 소비자 쪽(`SubAgentTaskDetail` 렌더 2지점)에도 가드가 필요한가 | ❌ 불필요 — `selectedSubagentTaskId` 를 쓰는 곳은 reducer 2 case 뿐이고 그 입력이 위 4 producer 다 | `grep -rn "selectedSubagentTaskId" src` → 쓰기 2(`chatReducer.ts:1767`·`:1772`) |
| 4 | D2 를 고치며 `subagentTaskDescription` 이 한 번 더 messages 를 걷게 될 뻔했다 — 통지 행이 설명과 종류 둘을 읽는다 | ✅ 선조치 — `subagentTaskJoin` 한 함수가 **한 순회로 두 값**을 낸다. `subagentTaskDescription` 은 래퍼로 남겨 AT-12 의 단언을 그대로 유지 | `grep -c "resultMap(messages.flatMap" parts.ts` → 0 |
| 5 | 조인이 실패(부모 `tool_call` 미도착)하면 종류를 모른다 | ✅ 현행 유지(어포던스 보존) — §10 EP-06 의 "미확인은 현행" 과 같은 방향이다. 테스트로 고정 | `종류 미확인(조인 실패)은 현행대로 어포던스를 유지한다` |

**배선 전수 (불변식 1)** — "0230 이 만든 배선이 프로덕션 호출부에서 관측되는가". 12/12.

| # | 배선 지점 | 잠금 | 라운드 |
|---|---|---|---|
| B1 | `claude-map.ts:558` 경계 도구 이름 기억 | W6 red 6 | r1(관측은 r2) |
| B2 | `claude-map.ts:162` started 에 `taskKind` 부착 | M3 red 2 | r1 |
| B3 | `claude-map.ts:313` killed 정착에 `taskKind` 부착 | `killed 정착 이벤트에 taskKind 가 실린다` | r1 |
| B4 | `claude-map.ts:629` 셸 결과 투영 | M5 red 3 | r1 |
| B5 | `turn-coordinator.ts:445` started → 트래커 종류 기록 | **W2 red 2** | **r2 신설** |
| B6 | `turn-coordinator.ts:522` 영수증 → 추적 유지 | **W1 red 1** | **r2 수정** |
| B7 | `settle.ts:106` 정착이 트래커 종류를 싣는다 | **W3 red 1** | **r2 신설** |
| B8 | `stop-subagent.ts:98` watchdog 정착이 종류를 싣는다 | M8 red 1 | r1 |
| B9 | `subagent-settlement.ts:88` 게이트가 부모 결과를 가른다 | M2 red 4 · M7 red 6 | r1 |
| B10 | `parts.ts` fold → `SubAgentTaskList` 셸 분기 | **W4 red 4** | **r2 신설** |
| B11 | `toolMeta.toolDescription` → `shellCommandDescription` | W7 red 1 | r1(관측은 r2) |
| B12 | `SubagentNoticeRow` → `subagentTaskJoin` 종류 | **W5a·W5b·W5c red** | **r2 신설** |

### 설계 대비 명시적 차이 (r2)

- r1 이 보고한 차이(VP-08 소비자가 store 가 아니라 main 의 tracker·settlement)는 **그대로**다.
  r2 는 그 차이를 바꾸지 않았고 축별 재유도도 r1 표가 유효하다.
- r2 가 새로 만든 차이: 없음. `TranscriptActionRow.onActivate` 를 선택으로 넓힌 것은 plan 이
  지정한 메커니즘의 교체가 아니라 기존 공용 셸의 확장이다.

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 프로덕션 3(`parts.ts`·`SubagentNoticeRow.tsx`·`TranscriptActionRow.tsx`) · 테스트 4(`shell-background.test.ts`·`shellTaskCard.render.test.ts`·`shellBackgroundTasks.test.ts` 수정 + `shellNoticeRow.render.test.ts` 신규) |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `./node_modules/.bin/electron-vite build` · `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출** | vitest **492파일 / 4581케이스 · 실패 0 · skip 3**(r1 4571 → +10: W2 2 · W3 2 · 컨테이너 2 · 통지 행 4). 수집 오류 6파일 = `Electron failed to install correctly`, r1·r2 세션 시작 시점과 **동일 6건**. typecheck exit 0 · `error TS` **0건**(3구성). lint **0 error / 1 warning**(`useTranscriptVirtualizer.ts` — 미수정 파일). lint 후 `git status --short` 에 도구 변경분 **0줄**. build exit 0 · 3번들. doc-inventory 3검사 통과(9 items · 92 channels) |
| 환경 기인 분리 근거 | electron 바이너리 egress 차단 — 6파일 전부 `electron/index.js` 로드 실패 하나뿐이고 DB 스위트는 `npm rebuild better-sqlite3`(Node ABI) 후 green |
| V-pair 자기확인 | `SELF_PASS 12 / SELF_BLOCKED 0` |
| 강제 지점 전수 | **13/13** — 분모 변경 없음. 술어를 불변식의 주어로 다시 세었다(위 전수표) |
| **AC 자기보고**(`Criteria-Met`) | 12/12 — AT-01·02(`claude-map.taskKind.test.ts`) · AT-03·04·07(`shell-background.test.ts`, **이제 실제 코디네이터를 지난다**) · AT-05·06·09·10(`shellTaskCard.render.test.ts`) · AT-08·11·12(`shellBackgroundTasks.test.ts`) |
| **합계 검산** | `✅ 12 · ⚠️ 0 · ❌ 0 = 총 12` — §7 의 AT 행을 다시 세었다(AT-01~AT-12). r1 과 분모 동일 |
| 파생 이슈 처리 | D1 **closed**(W1 red — 인용 변이가 이제 검출된다) · D2 **closed**(`resultMap(messages.flatMap` 0건) · D3 **closed**(어포던스 3/3, W5 red) · D4 **open 유지** — 현재 경로에서 재현되지 않는다. 정착이 `tool_result` 보다 먼저 오는 순서를 만들 수 없어 관측 자체가 없다 |
| 블로커 / 역질문 | 없음. r1 과 같은 한계 — 셸 백그라운드의 실제 SDK payload 는 스펙 기준 추론이고 Windows 실기를 못 한다 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **같다.** r1 의 결함도 "oracle 이 선언한
  프로덕션 경로를 지나지 않는다" 였고, r2 가 그것을 불변식으로 올려 12배선을 전수로 세자
  지적되지 않은 3곳(B5·B7·B10)이 더 나왔다.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **있었다.** VP-02 의 production path 칸이
  정확했다. plan 은 pair 마다 path 를 적지만 **그 path 를 테스트가 실제로 지나는지** 를 묻는
  칸은 없다 — r1 은 path 를 읽고 같은 형상의 로컬 함수를 세웠다.
- 반복해서 부딪히는 환경 한계: electron 바이너리 egress 차단(0230 고유 아님). Windows 실기 불가.
- 현재 라운드 수: 2
