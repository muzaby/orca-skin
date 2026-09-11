# Plan — 0230-background-task-ux-conformance

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0230-background-task-ux-conformance` |
| 작성자 | Claude Code |
| 일자 | 2026-09-11 |
| 매핑 | — |
| 상태 | **DRAFT** (범위 결정 대기 — D-003) |
| V mode | `Baseline V` (범위 확정 후 작성) |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: Orca 가 지원하는 백그라운드 기능(서브에이전트 · 셸 백그라운드 · 라이브 집합)의
  **사용자 통신**이 SDK 가 주는 신호를 다 쓰지 않는다. 사용자는 작업이 도는지 멈췄는지 판단할
  근거를 화면에서 얻지 못한다.
- 완료 후 달라지는 것: 백그라운드 작업이 **무엇을 · 얼마나 오래 · 지금 무엇을** 하는지 화면이
  말하고, 어시스턴트 턴이 끝난 뒤 사용자가 정상 턴으로 대화를 이어갈 수 있다.
- 성공을 사용자 관점에서 한 문장으로: 긴 PowerShell 작업이 도는 동안에도 "고장인지 정상인지"를
  화면만 보고 판단할 수 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "백그라운드 작업과 서브에이전트 등 orca에서 현재 지원중인 백그라운드 기능에서 ux적인 통신이 충실하게 구현됐는지 점검/진단하고 부족한 부분이 발견되면 보완한다" | 라이브 세션 2026-09-11 |
| 명시 요구 | "메시지버블 아래 spark 라인에서 백그라운드 작업 이라는 표현될때 실제로 해당 백그라운드 작업이 얼마나 진행됐는지 확인하고 싶을때가 있다. 가령 vitest같은 긴 작업의 경우, powershell이 언제끝나는지 알수없어 고장인지 정상동작인지 판단이 어렵다." | 같은 턴 |
| 명시 요구 | "main이 백그라운드 작업을 기다리고 있을때, 대화재개가 가능한 상태가 되는데 메시지 전송시 steer로 push되는 uiux로 표현된다. 어시스턴트의 종료 이후 사용자 턴을 기다리는 상태로 되어여 한다." | 같은 턴 |
| 명시 요구 | "원하큰건 정식사용자 턴인데 클로드가 백그라운드 작업이 끝나면 답변하겠다고 턴을 종료하는 상황이어야 한다" | 같은 턴 (질의 응답) |
| 명시 요구 | 진행 정보 위치 = "spark 라인 요약 + 클릭 진입" | 같은 턴 (질의 응답) |
| 명시 요구 | "스펙전면대응을 자세하게 나열해줘 구현하면 어떤 ux가 가능한지도 포함해서" | 같은 턴 (질의 응답) |
| 참조 입력 | 첨부 문서 `Claude Agent SDK 백그라운드 작업 지원 스펙` (기준 SDK `0.3.267`, 작성일 2026-09-10) | 사용자 첨부 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 백그라운드 진행 정보는 **spark 라인 한 줄 요약 + 클릭 시 상세**로 노출한다 | 사용자 선택 | 사용자 턴 | ACTIVE | — |
| D-002 | 백그라운드 대기 구간의 사용자 전송은 **정식 사용자 턴**으로 보이고, 그 앞의 어시스턴트 턴은 "백그라운드 작업이 끝나면 답변하겠다"는 **종료된 턴**으로 보인다 | 사용자 원문: "원하큰건 정식사용자 턴인데 클로드가 백그라운드 작업이 끝나면 답변하겠다고 턴을 종료하는 상황이어야 한다" | 사용자 턴 | ACTIVE | — |
| D-003 | 이번 핸드오프의 구현 범위 | 사용자가 전면 대응 항목의 상세 열람을 먼저 요구했다 | 사용자 턴 | **OPEN** | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 · D-002 · D-003.
- 변경된 결정: 없음.
- `ACTIVE 결정 ↔ AC` 대조: **미수행** — AC 는 범위(D-003) 확정 후 작성한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 아래 §조사 의 F-01·F-02·F-04 가 제보 두 건의 직접 원인이다 |
| 이미 기존 코드가 충족하는가 | 부분 | 서브에이전트(`Agent`/`Task`)는 경과·현재도구·도구수를 그린다(`AgentTaskRow.tsx:55-77`). 셸 백그라운드는 어디에도 없다 |
| 더 작은 해법이 있는가 | 있음 | 제보 2건만 닫는 최소안이 가능하다 — 그래서 D-003 이 OPEN 이다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 | `docs/claude-taskxxx-spec.md §4.1·§4.3` 이 `task_type`·`output_file` 을 이미 ❌ 로 표기한다 — 코드와 일치 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 주의 필요 | 0153 이 "listening 중 낙관 커밋 금지"를 잠갔다(`sendAdmission.ts:1-23`). D-002 는 **표시**를 바꾸되 그 커밋 순서 불변식을 깨지 않아야 한다 |

- 사용자에게 올릴 결정: D-003(범위).
- 코드 조사로 닫은 사실: 아래 §조사 전량.

---

# Part II — 조사 (스펙 대비 현재 구현)

> 기준 문서 = 사용자 첨부 스펙. 기준 코드 = 현재 HEAD. `app/package.json:35` 의 SDK 핀은
> `0.3.220` 이고 스펙 기준은 `0.3.267` 이다 — 스펙의 `0.3.238`(`is_backgrounded`·`spawn_depth`) ·
> `0.3.247`(`ambient`) · `0.3.257`(`resource_links`·Agent `heartbeat`) 확장은 **핀 이후**다.
> 실행 CLI 는 사용자 설치본이라(`claude-map.ts:344-347`) 배포물 선언과 실제 로그로 다시 확인한다.

## 조사 요약

| 그룹 | 항목 수 | 완전 | 부분 | 없음 |
|---|---|---|---|---|
| G1 셸(PowerShell) 백그라운드 | 3 | 0 | 0 | 3 |
| G2 진행 표시 | 4 | 0 | 2 | 2 |
| G3 결과·출력 | 3 | 0 | 0 | 3 |
| G4 상태 정확성 | 4 | 0 | 2 | 2 |
| G5 조건부 도구 | 5 | 0 | 0 | 5 |
| G6 제어·수명 | 3 | 1 | 1 | 1 |
| G7 견고성 | 2 | 0 | 1 | 1 |

## G1 — 셸(PowerShell) 백그라운드

| ID | SDK 신호 | 현재 Orca | 관측 근거 | 증상 | 구현 시 가능한 UX |
|---|---|---|---|---|---|
| F-01 | `task_started.task_type`(`local_bash`·`local_agent`·`local_workflow`) | 미판독 | `rg task_type app/src` → 0건 | 모든 `task_*` 이 서브에이전트로 취급된다 | 종류별 카드 — 에이전트/셸/감시/워크플로를 구분해 그린다 |
| F-02 | 백그라운드 목록 표시 | `Agent`/`Task` 만 | `parts.ts:319` `isAgentTaskName` 필터 | spark 라인 건수는 오르는데 `백그라운드 작업` 타일은 비어 있다 | 셸 작업 카드 — 명령·경과·부분 출력·중단 버튼 |
| F-03 | Bash 결과 `backgroundTaskId`·`timedOutAfterMs`·`rawOutputPath`·`persistedOutputPath`·`interrupted` | 미판독 | `rg backgroundTaskId app/src` → 0건 | 타임아웃 자동 전환을 "완료"로 그린다. `task_notification` 이 합성 `tool.call.completed`(`{summary:''}`)로 실제 stdout 을 덮는다(`resultMap` 은 마지막 승) | "타임아웃으로 백그라운드 전환 · 계속 실행 중" 배지, 종료 시 전체 출력 복원 |

## G2 — 진행 표시

| ID | SDK 신호 | 현재 Orca | 관측 근거 | 증상 | 구현 시 가능한 UX |
|---|---|---|---|---|---|
| F-04 | `tool_progress`(최상위 type) — `elapsed_time_seconds`·`heartbeat`·`subagent_retry` | 전량 미처리 | `rg tool_progress app/src` → 0건; `claude-map.ts:747` 이 미지 메시지를 드롭 | 긴 foreground 도구에 경과 시간이 없다. API 재시도 대기와 정상 진행을 구분하지 못한다 | 도구 카드의 경과 초, "재시도 대기 중" 상태, heartbeat 로 "연결은 살아 있음" 구분 |
| F-05 | `task_progress.summary` + `agentProgressSummaries` 옵션 | 정규화는 하나 renderer 가 버린다. 옵션 미설정 | `claude-map.ts:144` 가 `summary` 를 싣고, `chatStore.ts:322-338` 이 복사하지 않는다 | 작업이 "지금 무엇을 하는 중인지" 문장으로 말하지 못한다 | spark 라인·카드의 한 줄 진행 요약 |
| F-06 | 실행 수 배지 = 라이브 스냅샷 기준 | `BackgroundTaskTracker.count()` = **추적 전량**(foreground 포함) | `background-tasks.ts:124-126`; `session-activity-projector.ts:216` | `run_in_background:false` 동기 에이전트도 "백그라운드 작업 1건"으로 센다 | 배지가 실제 백그라운드만 세고 foreground 는 다른 문구를 쓴다 |
| F-07 | — (호스트 UX) | spark 라인 사실에 클릭 진입점 없음 | `StatusLine.tsx:123-128` — 사실은 `span` 뿐 | 건수를 봐도 상세로 갈 길이 없다 | **D-001** — 클릭 시 해당 작업 상세 |

## G3 — 결과·출력

| ID | SDK 신호 | 현재 Orca | 관측 근거 | 증상 | 구현 시 가능한 UX |
|---|---|---|---|---|---|
| F-08 | `task_notification.output_file` | 미판독 | `rg output_file app/src` → 0건; `claude-taskxxx-spec.md:159` 가 ❌ 로 표기 | 알림 요약만 남고 전체 출력을 볼 방법이 없다 | "전체 출력 보기" — 증분 읽기·부분 표시·접근 불가 구분 |
| F-09 | `resource_links`(자동 백그라운드 MCP) · `tool_use_result.resourceLinks` | 미판독 | `rg resource_links\|resourceLinks app/src` → 0건 | MCP 가 돌려준 결과 파일 참조가 화면에 없다 | 결과 파일 카드 — 원래 호출에 연결, 중복 카드 없음 |
| F-10 | 출력 읽기 안전성(경로 검증·대용량·쓰는 중 파일·외부 수정) | 해당 없음(읽는 코드가 없다) | F-08 의 귀결 | — | F-08 을 하면 같은 설계에서 함께 잠근다 |

## G4 — 상태 정확성

| ID | SDK 신호 | 현재 Orca | 관측 근거 | 증상 | 구현 시 가능한 UX |
|---|---|---|---|---|---|
| F-11 | `ambient`(내부 유지 작업) | 미판독. `skip_transcript` 만 드롭 | `claude-map.ts:120` | 내부 유지 작업이 일반 배지에 섞일 수 있다 | 배지에서 제외하되 목록에서는 볼 수 있다 |
| F-12 | `background_tasks_changed.tasks[].task_type·description` | `task_id → tool_use_id` 매핑된 것만 추린다 | `claude-map.ts:311-334` | 스냅샷이 유일한 근거인 작업은 존재 자체를 모른다 | 매핑 없는 라이브 작업도 최소 카드로 표시 |
| F-13 | 종료 ↔ 스냅샷 불일치 표시 | 스냅샷 제외를 `failed` 로 **확정** | `turn-coordinator.ts:459-478` | 스펙의 "종료 사유 미확인"(성공도 실패도 아님)과 다르다 | "실행 목록에서 제외됨 · 종료 사유 미확인" / "완료 · 정리 중" 구분 |
| F-14 | `task_updated.patch.end_time·total_paused_ms·description` | 미판독 | `claude-map.ts:271-309` 가 `status`·`error`·`is_backgrounded` 만 읽는다 | 일시정지 누적 시간·설명 변경이 화면에 없다 | 카드에 "일시정지 N분 포함" 표기 |

## G5 — 조건부 도구 (F-15~F-19 상세)

> **전제 ① 차단은 없다.** 메인 chat query 의 거부 목록은 `Bash`·`WebSearch` 둘뿐이다
> (`claude.ts:432`). `allowedTools: []` 는 제목 생성 query(`claude.ts:272`, `maxTurns:1`)의 것이라
> 본문 대화와 무관하다. **사용자 설치본 CLI 가 `Monitor`·`Workflow`·분리 `Skill`·원격 Agent 를
> 제공하면 모델은 지금도 그것을 부를 수 있다.** "미구현" 은 "호출이 막혀 있다" 가 아니라
> "호출되면 잘못 그린다" 는 뜻이다.
>
> **전제 ② 아래 결과 payload 형태는 첨부 스펙에서 왔다.** 실제 로그로 관측하지 않았다. 각 항목의
> 코드 경로는 현재 HEAD 실측이고, 그 경로에 스펙의 payload 를 대입한 귀결이 '증상' 칸이다.

### 공통 분기점 — `isAsyncLaunchedPayload`

네 도구의 운명은 한 술어가 가른다(`shared/subagent.ts`):

```ts
export function isAsyncLaunchedPayload(value: unknown): boolean {
  return isRecord(value) && value.status === 'async_launched'
}
```

`tool.call.completed` 에서 이 술어가 참이면 `markAsyncLaunched`(= 라이브 백그라운드 유지),
거짓이면 `backgroundTasks.settled`(= 추적 해제 · 도구 호출 종료)다
(`turn-coordinator.ts:514-522`). 스펙이 말하는 네 결과 중 **`status` 가
`async_launched` 인 것은 `Workflow` 하나**다.

| 도구 | 결과의 판별 필드 | 술어 결과 | 귀결 |
|---|---|---|---|
| `Monitor` | `{ taskId, timeoutMs, persistent? }` — `status` 없음 | 거짓 | 즉시 추적 해제 |
| `Workflow` | `{ status: 'async_launched', taskId, … }` | **참** | 라이브 등록 — `error` 동반 시에도 |
| 분리 `Skill` | `{ …, background: true }` | 거짓 | 즉시 추적 해제 |
| 원격 Agent | `{ status: 'remote_launched', taskId, sessionUrl, … }` | 거짓 | 즉시 추적 해제 + **완료로 표시** |

### F-15 `Monitor` — 감시가 도는데 추적에서 빠진다

| 축 | 내용 |
|---|---|
| 지금 일어나는 일 | 결과에 `status` 가 없어 도구 반환 시 `backgroundTasks.settled(toolRunId)` 가 돈다. 감시는 CLI 안에서 계속 도는데 Orca 의 라이브 집합에서 사라진다 |
| 연쇄 | 추적이 비면 `decidePostTurnStep` 이 `break` 로 갈 수 있다(`features/chat/post-turn.ts` 마지막 줄). listen 프레임이 닫히고 이후 감시 stdout 은 `unframed` 백로그로 쌓인다 — 유실은 아니지만 라이브 표시가 없다 |
| 표시 | `toolRendererRegistry` 에 `Monitor` 등록이 없어 `KeyValueBody` 일반 카드로 떨어진다. 동사는 `toolVerbCategory` 의 `default` 인 "사용" 이다 |
| 스펙 요구 | `command` 와 `ws` 중 정확히 하나. `persistent: true` 를 "CLI 종료 후에도 사는 서비스" 로 읽지 않는다. `task_type: 'local_bash'` 가 Bash 와 겹치므로 **원래 도구 이름을 보존**한다 |
| 열리는 UX | 감시 카드 — 대상(명령 또는 WebSocket URL) · 경과 · 수신 이벤트 수 · 타임아웃 잔여 · 개별 중단. 감시가 도는 동안 listen 유지 |
| 선행 조건 | F-01(`task_type`) — Bash 와 같은 `local_bash` 를 쓰므로 원래 도구 이름 없이는 구분할 수 없다 |

### F-16 `Workflow` — 시작 실패를 라이브 실행으로 등록한다

| 축 | 내용 |
|---|---|
| 지금 일어나는 일 ① | 결과가 `status: 'async_launched'` 라 **비-Agent 도구 중 유일하게** 라이브 백그라운드로 등록된다 |
| 지금 일어나는 일 ② | 스펙: 구문 검사 실패 시 `async_launched` 와 `error` 가 **함께** 온다. Orca 는 `error` 를 보지 않으므로 **시작조차 안 한 실행을 라이브로 등록**한다. 정착 이벤트가 영영 오지 않아 listen 루프가 채널 사망까지 세션을 붙잡고, spark 라인의 "백그라운드 작업 1건" 이 고착된다 |
| 지금 일어나는 일 ③ | 정착 시 `createSubagentSettlementEvents` 가 `{ summary: '' }` 를 `tool.call.completed` 로 덮어쓴다. `resultMap` 은 마지막 항목이 이기므로 `runId`·`transcriptDir`·`scriptPath` 가 지워진다 (F-03 과 같은 축) |
| 지금 일어나는 일 ④ | 완료 통지 행은 뜨지만 `subagentTaskDescription` 이 `isAgentTaskName` 으로 조인해 **제목이 빈다**. 클릭하면 `openSubagentTask(toolRunId)` → `SubAgentTileContent` 가 그 id 를 못 찾아 목록으로 폴백한다 — **죽은 어포던스** |
| 스펙 요구 | `error` 를 **먼저** 확인한다. `taskId`·`runId`·내부 에이전트 ID 를 별도 보존한다. 내부 에이전트 완료를 전체 Workflow 완료로 처리하지 않는다 |
| 열리는 UX | Workflow 실행 카드 — 스크립트 이름 · `runId` · `transcriptDir` · 내부 에이전트 진행과 `blocked` · `resumeFromRunId` 재실행 |
| 선행 조건 | 없음. 시작 오류 판정만으로도 고착 결함이 닫힌다 |

### F-17 분리 실행 `Skill` — 백그라운드인데 완료로 본다

| 축 | 내용 |
|---|---|
| 지금 일어나는 일 | `SkillToolOutput.background: true` 는 `async_launched` 가 아니므로 술어가 거짓이다. 스킬이 분리 실행으로 돌기 시작해도 도구 호출은 반환 즉시 종료로 그려지고 추적에서 빠진다 |
| 스펙 요구 | 작업 이벤트와 연결한다. **Skill 결과에 없는 `taskId` 를 만들어 연결하지 않는다** |
| 열리는 UX | 분리 실행 스킬의 진행·완료 통지. 도구 카드가 "백그라운드로 실행 중" 을 말한다 |
| 선행 조건 | `task_started.tool_use_id` 로만 연결해야 한다 — id 를 합성하면 스펙 위반이다 |

### F-18 원격 Agent — 띄우자마자 완료로 그린다

| 축 | 내용 |
|---|---|
| 지금 일어나는 일 ① | `remote_launched` 는 `async_launched` 가 아니라 술어가 거짓이다 → `backgroundTasks.settled`. 원격 실행의 종료를 기다리지 않는다 |
| 지금 일어나는 일 ② | 원격 실행은 `Agent` 도구라 `subagentTasksFromMessages` 에 **들어간다**. `deriveSubagentTaskStatus` 는 `result` 존재 + `isError` 아님 → **`completed`** 를 돌려준다. 우측 패널 타일이 원격 에이전트를 **즉시 완료**로 그리고, 런치 영수증이 답변 자리에 들어간다 |
| 지금 일어나는 일 ③ | `sessionUrl` 을 읽는 코드가 없어 원격 세션으로 갈 링크가 화면에 없다 |
| 스펙 요구 | 원격 링크·상태·출력·중단 범위를 실제로 확인한다. 로컬 종료 시 원격 결과를 임의 확정하지 않는다 |
| 열리는 UX | 원격 실행 카드 — 세션 링크 · 원격 상태 · `outputFile` · 로컬 종료 시 "확인 불가" 표시 |
| 선행 조건 | 술어를 `async_launched` 단일 리터럴에서 **런치 영수증 종류 판별**로 넓혀야 한다 |

### F-19 `TaskOutput` / `TaskStop` — 유지가 맞다, 단 두 가지 사실

| 축 | 내용 |
|---|---|
| 현행 결정 | ⛔ **의도적 미채택**(`claude-taskxxx-spec.md:111-124`). GUI 의 백그라운드 상태를 `TaskOutput` polling 에 의존시키지 않는다(0204 D-010·D-011). 호스트 제어는 `Query.stopTask(taskId)` 다 — 이 결정은 스펙과도 일치하므로 **유지**한다 |
| 사실 ① | 두 이름이 `TASK_TOOL_NAMES` 에 있어 어댑터가 `structuredOutput` 을 실어 **영속**한다(`claude-map.ts:514-517`·`583`). 그런데 렌더 소비자는 `TASK_LIST_TOOL_NAMES` 4종뿐이라(`registry.ts` `task_list`) **소비처가 0** 이다 — 읽히지 않는 필드를 저장한다 |
| 사실 ② | 모델이 `TaskStop` 을 부르면 `stoppedSubagents` 에는 들어가지 않는다. 정착은 `status:'stopped'` 로 오고, `task_notification.summary` 가 없으면 UI 가 폴백 문구 `chat.taskTile.stoppedReason`(`ko.ts:775`) = **"사용자에 의해 중단됨"** 을 쓴다. 실제로는 모델이 멈춘 것이라 행위자를 잘못 말한다 |
| 열리는 UX | 사실 ②를 고치면 "모델이 중단함" 과 "사용자가 중단함" 이 갈린다. 사실 ①은 저장을 멈추거나 상세에서 보여주거나 둘 중 하나로 닫는다 |

### G5 를 미룰 때의 비용

| 항목 | 미뤘을 때 | 성격 |
|---|---|---|
| F-16 ② | 세션이 유휴로 돌아오지 못한다 | **고착 결함** — 도구가 있으면 오늘 재현된다 |
| F-18 ② | 원격 실행이 즉시 완료로 보인다 | 오표시 |
| F-15 · F-17 | 백그라운드 실행이 조용히 사라진다 | 누락 |
| F-19 ② | 중단 행위자를 잘못 말한다 | 오표시 (경미) |
| F-19 ① | 소비처 없는 필드를 영속한다 | 위생 |

F-16 ②·F-18 ②·F-19 ②는 **새 화면 없이 판정 한 줄씩**으로 닫힌다. 새 카드(F-15·F-16 ①·F-17·F-18 ①)는
그보다 크다 — 이 둘을 같은 항목으로 묶어 미루면 값싼 결함 수정까지 함께 미뤄진다.

## G6 — 제어·수명

| ID | 대상 | 현재 Orca | 관측 근거 | 판정 |
|---|---|---|---|---|
| F-20 | `stopTask(taskId)` · `backgroundTasks(toolUseId)` | 있음 | `stop-subagent.ts:55`; 0212 | **충족** |
| F-21 | `perTaskStopAffordance` | 미설정 — 메인 Stop 이 백그라운드 Agent 도 중단 | `rg perTaskStopAffordance app/src` → 0건; 문구는 `ko.ts:590` 이 그렇게 말한다 | **문구는 일치**. 옵션을 켜면 "응답만 중지"가 새로 가능해진다 |
| F-22 | 결과 기다리기 / 대기 취소 UI | 없음 | — | 특정 작업의 종료를 구독하고 알림 받는 UI |

## G7 — 견고성

| ID | 대상 | 현재 Orca | 관측 근거 | 판정 |
|---|---|---|---|---|
| F-23 | 미지 스키마 원본 보존(`UNKNOWN-SCHEMA`) | 드롭 | `claude-map.ts:747-749` `return []` | 스트림은 안 끊기나 원본이 남지 않는다 |
| F-24 | 중복 이벤트(`DUPLICATE-EVENT`) | uuid 단위 방어 장치는 없고 자료구조 멱등성에 의존 | `background-tasks.ts:56-62`(재삭제 no-op), `turn-coordinator.ts:310-322`(관측 소멸 후 미부여) | 현재 경로에서는 중복 통지가 나지 않는다 |

## 이미 충족하는 것 (회귀 금지)

| 항목 | 근거 |
|---|---|
| `async_launched` 영수증으로 실제 백그라운드 판별 | `shared/subagent.ts`; 0136·0143 |
| 백그라운드 완료 통지 1회 | `turn-coordinator.ts:310-322`; `SubagentNoticeRow.tsx` |
| `task_updated` 델타 병합 · `killed`↔`stopped` 동형 · `paused` 라이브 유지 | `claude-map.ts:256-309`; 0212 |
| 레벨 신호 REPLACE + 첫 payload 기준선 | `background-tasks.ts:85-101` |
| 메인 `result` 이후에도 프레임 소비 유지 | `post-turn.ts`; `chat-turn/post-turn.ts` |
| interrupt 영수증 `still_queued` 교집합 화해 | `interrupt-reconcile.ts` |
| 서브에이전트 행의 모델·현재 도구·도구수·경과 | `AgentTaskRow.tsx:55-77` |

---

## 제보 2건의 원인 귀속

| 제보 | 원인 | 항목 |
|---|---|---|
| ① spark 라인이 "백그라운드 작업 N건"만 말한다 | 건수 외 진행 신호가 없고(F-05) 클릭 진입점이 없으며(F-07) 셸 작업은 상세 화면 자체가 없다(F-02) | F-02·F-05·F-07 |
| ① PowerShell 이 언제 끝나는지 모른다 | 셸 결과 필드 미판독(F-03) · `tool_progress` 경과 미처리(F-04) | F-03·F-04 |
| ② 전송이 steer push 로 보인다 | `shouldQueueAsPending` 이 `listening`(transport ≠ idle)만 보고 예약 경로로 보낸다 | `sendAdmission.ts:14-23` |
| ② 어시스턴트 턴이 끝나 보이지 않는다 | `sessionResponding` 이 `listening && transport !== 'ready'` 동안 `PendingAssistant`(스피너)를 유지한다 | `chatStore.ts:1762-1766`; `ChatTile.tsx:60` |

---

## 다음 단계

D-003(범위)이 정해지면 Part I §5~§7-A(동작 흐름 · 범위 · AC · V)와 Part II 나머지(아키텍처 ·
모듈 · §10 강제 지점 · 테스트)를 작성하고 상태를 `READY` 로 올린다.
