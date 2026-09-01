# Plan — 0212-taskxxx-surface-gaps

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 외부 계약 정본은 [`docs/claude-taskxxx-spec.md`](../../claude-taskxxx-spec.md) — 본 문서는 SDK 필드를 재서술하지 않고 그 절을 인용한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0212-taskxxx-surface-gaps` |
| 작성자 | Claude Code |
| 일자 | 2026-09-01 |
| 기준 브랜치 | `claude/taskxxx-handoff-212-5228f0` (`main` 기준 — **0211 산출물 미포함**) — §8 의 줄 좌표·필드 수는 이 베이스 실측이다 |
| 매핑 | 없음 (PR 미개설) |
| 상태 | DRAFT → **READY** |
| V mode | `Baseline V` |
| 기준 V | `none` — 근거는 §7-A |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제 — **관측**: 0204 가 TaskXXX 패널을 만들었으나 SDK 표면 6개를 읽지 않는다 — 진행 중 어휘(`activeForm`), 역방향 의존(`addBlocks`), 갱신 실패 사유(`error`), background 멤버십 레벨 신호, `paused`/`killed` 상태, 그리고 **Task 도구가 아예 없는 런타임을 앱이 인지하지 못한다**.
- 해결하려는 문제 — **제어**: SDK 가 주는 제어 3종 중 하나가 사용자에게 닿지 않는다 — `backgroundTasks(toolUseId)` 는 포트도 상위 진입점도 있는데 **IPC 핸들러가 없어 소비자가 0**이다. 그리고 `paused` 행에서 나갈 사용자 경로가 없다.
- 완료 후 달라지는 것: 패널이 SDK 가 말하는 대로 말하고, SDK 가 허용하는 만큼 조작된다 — 진행 중 항목은 현재진행형으로, 실패한 갱신은 사유와 함께, 죽은 background 항목은 레벨 신호로 사라지고, Task 도구가 없는 CLI 에서는 원인이 뜨며, 턴을 막고 있는 서브에이전트를 **기다림만 풀어** 보낼 수 있다.
- 성공을 사용자 관점에서 한 문장으로: 패널이 조용히 틀리지 않고 조용히 막혀 있지도 않다 — 비어 있으면 왜 비었는지 말하고, 항목이 있으면 SDK 가 아는 만큼 말하며 할 수 있는 만큼 누를 수 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "taskXXX 에 대한 **모든 기능 지원**을 위해 아래 웹사이트 및 설치된 claude-agent-sdk 를 분석하고 orca의 지원 수준에 대해 진단보고서를 작성하라" | 사용자 턴 (2026-09-01) |
| 명시 요구 | "그래서 해야할 일이 무엇인지 정리하라" · "plan 문서와 taskXXX 스펙 문서를 함께 작성하라" | 같은 날 후속 턴 |
| 명시 결정 | 범위 분할 = **1개로 통합** / 스펙 성격 = **SDK 표면 정본** / 구버전 CLI = **안내만** / `activeForm` = **제목 교체** | 같은 턴 AskUserQuestion 응답 |
| 조사 산출 | SDK 표면 46개 대조 — 완전 23 · 의도적 배제 7 · 조건부 3 · 미지원 13 | 이번 세션 실측 (§8) |
| 추론 의도 | 결손 9건 중 `metadata`·`output_file`·`task_type` 3건은 **지원 공백이 아니라 새 기능**이므로 이번 범위에서 뺀다 — 설계자 판단, §6 에 근거 | 추론 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 결손을 **하나의 handoff** 에 담는다 — 분할하지 않는다 | 사용자가 세 선택지 중 "1개로 통합"을 골랐다. SKILL §5 의 "AC 25건 초과 시 분할 검토"를 수행했다 — 제어 축(D-019) 반환 후 **AC 26건으로 상한을 1건 넘지만** R 7개로 갈라져 R 당 3~4건이고, R-07(제어)만 떼면 `paused` 중단 버튼(AT-18·D-022)이 두 handoff 에 걸쳐 모순될 수 있다. 통합 유지 | 사용자 턴 (AskUserQuestion) + 재검토 | ACTIVE | — |
| D-002 | TaskXXX 외부 계약의 정본은 **`docs/claude-taskxxx-spec.md`** 다 — plan 은 SDK 필드를 재서술하지 않고 인용한다 | 사용자가 "SDK 표면 정본"을 골랐다. `docs/AGENTS.md §작성규칙 7` 의 2단 미러(원문 미러 / 해설 미러) 중 해설 미러 자리다 | 사용자 턴 + `docs/AGENTS.md` | ACTIVE | — |
| D-003 | 기능 존재 판정은 **`init` 의 `tools` 배열**로 한다 — CLI 버전 문자열 비교가 아니다 | SDK `capabilities` 주석이 원칙을 준다 — "so SDK consumers can feature-detect instead of version-sniffing". `tools` 는 노출 도구 전량이라 `TaskCreate` 포함 여부가 곧 답이다 | SDK 실측 (`sdk.d.ts`) | ACTIVE | — |
| D-004 | 구버전 CLI 는 **안내만** 한다 — `TodoWrite` 폴백 파서를 만들지 않는다 | 사용자가 세 선택지 중 "안내만"을 골랐다. `TodoWrite` 는 매 호출이 전체 배열 교체라 fold 규칙 자체가 달라 파서가 두 벌이 된다 | 사용자 턴 (AskUserQuestion) | ACTIVE | — |
| D-005 | `tools` **부재**(`undefined`)와 `TaskCreate` **미포함**은 다른 사실이다 — 전자는 안내하지 않는다 | 부재는 "판정 불가"지 "기능 없음"이 아니다. 거짓 안내는 빈 화면보다 나쁘다 — 사용자가 멀쩡한 CLI 를 의심하게 된다 | 설계자 판단 | ACTIVE | — |
| D-006 | `activeForm` 은 **`in_progress` 인 동안 제목을 교체**한다 — 부제나 상세 행이 아니다 | 사용자가 "제목 교체"를 골랐다. SDK 주석이 용도를 못박는다 — "Present continuous form shown in spinner when in_progress" | 사용자 턴 + SDK 실측 | ACTIVE | — |
| D-007 | `aria-label` 과 상세 화면은 **`subject` 를 유지**한다 — 표시 제목만 교체한다 | 접근성 라벨이 상태에 따라 흔들리면 스크린리더 사용자가 같은 항목을 다른 항목으로 읽는다 | 설계자 판단 | ACTIVE | D-006 을 보완(대체 아님) |
| D-008 | `activeForm` 은 **입력에서만** 읽고 `active_form` 별칭도 함께 허용한다 | `TaskGetOutput`·`TaskListOutput` 에 이 필드가 없다(spec §2.2·§2.4). 원격 문서가 스트림 입력의 키 정규화 누락을 경고한다(spec §2.5) | SDK 실측 + 원격 문서 | ACTIVE | — |
| D-009 | `addBlocks` 는 **역방향 간선으로 가산**한다 — `TaskUpdate(A, addBlocks:[B])` 는 `B.blockedBy` 에 `A` 를 더한다 | `blocks` 를 저장하지 않기로 한 0204 D-028 을 유지하면서 간선을 잃지 않는 유일한 방법이다. 방향만 뒤집으므로 정보 손실 0 | 이번 세션 실측 | ACTIVE | 0204 D-028 의 "정보 손실 0" 을 **성립시킨다**(그 문장은 `TaskList` 도착 전까지 거짓이었다) |
| D-010 | 역방향 가산은 **대상 항목이 이미 있을 때만** 수행한다 — 없으면 무시한다 | 없는 id 로 stub 을 만들면 제목이 `2` 인 유령 행이 뜬다. `TaskList` 스냅샷이 나중에 보정한다(0204 D-008) | 설계자 판단 | ACTIVE | — |
| D-011 | `background_tasks_changed` 를 구독하되 **`STOP_SETTLE_TIMEOUT_MS` watchdog 은 유지**한다 | 레벨 신호는 CLI 가 살아 있을 때만 온다 — 채널이 죽으면 아무것도 오지 않는다. watchdog 은 그 축을 막으므로 대체 관계가 아니라 직교한다 | 설계자 판단 | ACTIVE | — |
| D-012 | 레벨 신호는 **첫 payload 도착 전에는 무효**이고 CLI 프로세스 (재)기동 시 리셋한다 | SDK 주석이 명시한다 — "The level is per-process: nothing is emitted at startup, so consumers must reset to the empty set whenever the session's CLI process (re)starts" | SDK 실측 | ACTIVE | — |
| D-013 | REPLACE 는 **`task_id → tool_use_id` 매핑이 있는 항목에만** 적용한다 — 매핑 없는 payload 항목은 무시한다 | payload 는 `task_id` 만 싣고 Orca 의 표시·중단 키는 `tool_use_id` 다. 매핑 없는 항목은 애초에 추적 대상이 아니므로 오정착 위험이 없다 | 설계자 판단 + `claude-map.ts:54` 기존 매핑 | ACTIVE | — |
| D-014 | `task_updated.patch.status:'paused'` 는 **`stoppingBackgroundIds` 와 같은 transient 집합**으로 표현한다 — parts fold 를 바꾸지 않는다 | `paused` 는 transcript 에 흔적이 없는 라이브 상태다. 기존 `stopping` 이 정확히 같은 성질이라 검증된 선례를 따른다 | 설계자 판단 + `taskBoard.ts` 선례 | ACTIVE | — |
| D-015 | `task_updated.patch.status:'killed'` 는 **`stopped` 와 동형으로 정착**시킨다 | 사용자에게 `killed` 와 `stopped` 는 같은 사건이다 — 둘 다 "끝까지 못 갔다". 새 표시 상태를 늘리면 두 타일의 라벨이 함께 갈라진다 | 설계자 판단 | ACTIVE | — |
| D-016 | 실패한 `TaskUpdate` 의 `error` 는 **transcript 도구 카드**에만 보인다 — 패널에는 내지 않는다 | 존재하지 않는 `taskId` 갱신이 실패의 주 사례인데 그때 패널에는 걸 항목 자체가 없다. 성공한 갱신만 목록에 닿는다는 fail-closed 계약(0204)을 유지한다 | 설계자 판단 | ACTIVE | — |
| D-017 | `session.updated.patch` 에 **optional 필드를 얹고** 새 NormalizedEvent variant 를 만들지 않는다 | 0211 이 `worktree` 를 같은 방식으로 얹은 선례가 `ipc.ts:447` 주석에 있다. variant 는 `check-doc-inventory.mjs` 추적 대상이라 늘릴 때 비용이 붙는다 | 기존 코드 선례 | ACTIVE | — |
| D-018 | `metadata`·`output_file`·`task_type`/`workflow_name` 은 **이번 범위 밖**이다 | `metadata` 는 소비처가 0이고 `task-tool.ts` 헤더가 "소비처 없는 파싱은 계약처럼 보이는 죽은 표면"이라고 스스로 금지한다. 나머지 둘은 지원 공백이 아니라 **새 UX 기능**(전체 출력 열기·workflow 구분)이라 자기 결정이 필요하다 | 설계자 판단 | ACTIVE | — |
| D-019 | **제어 축을 관측 축과 함께 닫는다** — SDK 제어 표면 전수(`stopTask`·`backgroundTasks(id)`·`backgroundTasks()`·`interrupt`·`canUseTool`)를 대조해 결손을 범위에 넣는다 | "orca 가 taskXXX 를 제어하기 위한 인터페이스가 필요하다면 (e.g., 중단버튼 등) 이에 대한 것들도 모두 포함해야한다" | 사용자 턴 (2026-09-01) | ACTIVE | — |
| D-020 | **단건** foreground → background 전환에 사용자 진입점을 만든다. **전량 전환(`backgroundTasks()` 인자 없음)은 범위 밖** | SDK 주석이 대상을 "Bash commands and subagents" 로 적는다 — 전량 전환은 Bash 까지 옮겨 TaskXXX 경계를 벗어난다. 행별 제어가 있는 GUI 에는 터미널의 일괄 단축키가 필요하지 않다 | SDK 실측 + 설계자 판단 | ACTIVE | — |
| D-021 | 전환 버튼은 **foreground 행에만** 뜬다 — 이미 background 인 행에는 띄우지 않는다 | `backgroundTasks(toolUseId)` 는 foreground 태스크가 없으면 `false` 를 돌려준다. 효과 없는 버튼은 사용자를 속인다. 판별은 기존 `async_launched` 영수증(`isAsyncLaunched`)이 이미 한다 | SDK 실측 + `0136` 선례 | ACTIVE | — |
| D-022 | `paused` 행도 **중단 버튼을 유지**한다 | 멈춰 있어도 태스크는 살아 있고 자원을 쥔다 — 사용자가 없앨 방법이 없으면 안 된다. SDK 에 resume API 가 없으므로(spec §5.3) `paused` 에서 나갈 사용자 경로는 중단뿐이다 | 설계자 판단 | ACTIVE | 이번 턴 자체 정정 — 초안의 "paused 는 버튼 숨김"을 뒤집는다 |
| D-023 | 할 일 목록 항목의 **직접 편집·개별 중단은 만들지 않는다** | SDK 에 경로가 없다 — `Query` 제어 API 에도 control request union 에도 없고 `TaskCreate`/`TaskUpdate` 는 모델 도구다(spec §5.3). 없는 것을 흉내 내면 GUI 와 실제 상태가 갈라진다 | SDK 실측 | ACTIVE | — |
| D-024 | Task 도구를 **`RISKY_TOOLS` 에 넣지 않는다** | 상태를 바꾸는 도구가 아니라 할 일 목록만 바꾼다. 넣으면 할 일이 갱신될 때마다 승인 카드가 뜬다(`risky-tools.ts` 헤더 — "상태를 변경하는 도구만 승인 카드로 surface") | 설계자 판단 + 기존 주석 | ACTIVE | — |
| D-025 | 대화록 전용 본문은 **할 일 목록 4종만** 받는다 — 이름 SSOT 는 `task-tool.ts` 가 새로 export 하는 **4종 부분집합**이고 렌더가 배열을 다시 적지 않는다 | `TASK_TOOL_NAMES` 는 **6종**이라(§8) 그대로 재사용하면 `TaskOutput`·`TaskStop` 에도 전용 본문이 붙는다. 둘은 구조화 출력이 없어(spec §3) 그릴 필드가 없고 0204 D-010 이 관측만으로 못박았다 — 기존 `KeyValueBody` 폴백을 유지한다 | 이번 세션 실측 (`task-tool.ts:16-27`) | ACTIVE | R-06·EP-11 의 "4종" ↔ "`TASK_TOOL_NAMES` 재사용" 모순을 닫는다 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: **D-001 ~ D-018** (신규 handoff) + **D-019 ~ D-024** (제어 축 반환) + **D-025** (정식화 턴 — 도구 이름 범위 모순 해소).
- 변경된 결정: **D-022 가 같은 턴 초안을 정정한다** — "paused 는 중단 버튼 숨김"을 "유지"로 뒤집었다. 사용자가 제어 축을 명시 요구해 재검토한 결과이고, `paused` 에서 나갈 사용자 경로가 중단뿐이라는 SDK 사실(spec §5.3)이 근거다. **0204 의 ACTIVE 결정은 대체하지 않는다** — D-009 가 0204 D-028 의 *이유 문장*을 성립시키지만 "`blocks` 를 저장하지 않는다"는 결정 자체는 그대로다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0204 D-002(main 에 Task 스토어 없음) · D-005/D-006(`중단 중` 경유 + watchdog) · D-008(`TaskList` 전체 스냅샷) · D-010(`TaskOutput` 의존 금지) · D-013(`skip_transcript` 드롭) · D-018(id 오름차순 단일 목록) · D-031(순서는 의존이 아니다).
- **정식화 턴(이 커밋) 재측정**: 초안은 0211 작업 브랜치에서 작성됐다. `main` 기준 베이스에서 §8 을 다시 세어 **좌표 5건·수치 2건을 정정**하고 SDK 0.3.220 표면 여섯을 재실측했다(§8 검산). 설계 결함 **1건**을 닫았다 — R-06·EP-11 이 "4종" 과 "6종 배열 재사용" 을 함께 요구했다(D-025). ACTIVE 결정 중 대체된 것은 없다.
- **`ACTIVE 결정 ↔ AC` 대조: 충돌 0.** 확인한 쌍 — D-003↔AT-01·02 · D-005↔AT-03(`tools` 부재는 안내 없음) · D-006↔AT-05/06(교체 후 복귀) · **D-007↔AT-08 비충돌**(표시 제목과 a11y 라벨이 서로 다른 축) · D-008↔AT-09 · D-009↔AT-10 · D-010↔AT-11 · D-012↔AT-15 · D-013↔AT-16 · **D-011↔AT-17 비충돌**(레벨 신호 도입이 watchdog 을 지우지 않는다) · D-014↔AT-18 · D-015↔AT-20 · D-016↔AT-22 · **D-022↔AT-19**(paused 에서 중단 버튼 유지) · D-021↔AT-24(foreground 행에만 전환 버튼) · D-020↔§6(전량 전환 비범위 — 반대 AC 없음) · **D-023·D-024 ↔ AC 없음**(둘 다 "만들지 않는다" 이고 이를 요구하는 AC 가 0건) · **0204 D-008 ↔ AT-13 비충돌**(스냅샷 전체 교체가 역방향 가산분을 덮는 것이 설계다) — **반대를 요구하는 AC 0건**.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 6건 모두 SDK 표면이 코드에 없다. `rg "activeForm\|addBlocks\|task_updated\|background_tasks_changed" app/src` → **0건** |
| 이미 기존 코드가 충족하는가 — 기능 게이트 | **부분 충족** | `init` 메시지를 이미 매핑한다(`claude-map.ts:177`). `session_id`·`model` 만 읽고 `tools`·`claude_code_version` 을 버린다 — 새 경로가 아니라 기존 경로의 확장이다 |
| 이미 기존 코드가 충족하는가 — `paused` | **미충족** | `rg "'paused'" app/src` → 0건. `SubagentTaskStatus` 는 `running\|completed\|aborted\|failed` 4종 |
| 이미 기존 코드가 충족하는가 — stale 정착 | **다른 수단으로 충족** | `settleDeadBackgroundTasks`(`chat-turn/index.ts:62`) + watchdog 이 막는다. 레벨 신호는 **채널이 살아 있을 때** 더 빨리 막는 직교 수단이다(D-011) |
| 이미 기존 코드가 충족하는가 — **중단 제어** | **충족** | 두 타일 모두 행별 중단 버튼이 있다(`TaskTileContent.tsx:182,289` · `SubAgentTileContent.tsx:258`). 실패 시 복구도 있다 — `stopSubagentTask` 가 throw 하면 표식을 되돌리고 renderer 가 `진행 중` 으로 복구한다(`stop-subagent.ts:82-86`) |
| 이미 기존 코드가 충족하는가 — **백그라운드 전환** | **미충족** | 포트는 있으나 사용자 진입점이 0이다. `backgroundTask` 호출부는 전부 내부 폴백이다 — `stop-subagent.ts:55` · `settle.ts:122`. IPC 채널은 `chatStopSubagent` 하나뿐이다 |
| 요구가 증상이 아니라 원인을 겨냥하는가 — 제어 축 | 타당, **단 상한이 있다** | SDK `Query` 제어 API 는 `stopTask`·`backgroundTasks`·`interrupt` 3종이 전부다. 할 일 목록 편집·pause/resume 은 **API 자체가 없다**(spec §5.3) — 결손이 아니라 경계다 |
| 더 작은 해법이 있는가 — 전량 전환 | 있다 — **범위에서 뺀다** | `backgroundTasks()` 는 Bash 까지 옮긴다(SDK 주석). 행별 전환(D-020)이 TaskXXX 범위에서 같은 필요를 채운다 |
| 더 작은 해법이 있는가 | 있다 — 채택 | 새 DB 마이그레이션 0개 · 새 NormalizedEvent variant **1개**(레벨 신호만, D-017 로 나머지는 기존 variant 확장) · 새 IPC 채널 **1개**(`chatBackgroundSubagent` — 관측 축만 닫던 초안은 0개였고, 제어 축 반환 D-019 가 이 하나를 들여왔다. 이미 있는 `SessionRuntime.backgroundTask` 에 배선하는 것이라 포트·런타임 신설은 0이다) |
| 선행 자료의 주장을 코드와 대조했는가 | 했다 — **1건 정정** | 0204 D-028 의 "`blockedBy` 의 역방향이라 정보 손실 0" 은 `TaskList` 가 도착할 때만 참이다. `TaskUpdate(A, addBlocks:[B])` 는 patch 가 비어 `null` 로 떨어진다(프로브 재현, §8) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 0 | 0204 의 ACTIVE 결정 어느 것도 이번 6건을 금지하지 않는다. D-028 은 `blocks` **저장**을 금지하지 `addBlocks` **역방향 해석**을 금지하지 않는다 |

- 사용자에게 올릴 결정: **없음** — 네 건(범위 분할·스펙 성격·구버전 지원·`activeForm` 표시)은 이번 턴에 물어 D-001·D-002·D-004·D-006 으로 확정했다.
- 코드 조사로 닫은 사실: `init` 이 `tools`·`claude_code_version`·`capabilities` 를 싣는다는 것 · `session.updated.patch` 에 optional 을 얹는 0211 선례 · `stoppingBackgroundIds` transient 선례 · `taskToolUseById` 매핑이 이미 있다는 것 (전부 §8).
- **요구보다 좁아진 지점(설계자 판단, 사용자 확인 필요)**: "모든 기능 지원" 대비 `metadata`·`output_file`·`task_type` 3건을 뺐다(D-018·§6). 뺀 이유는 §6 표에 있고 셋 다 **나중에 해도 비싸지지 않는다**.

## 5. 동작 / 사용자 흐름

```text
[세션 시작 — SDK init 도착]
  → tools 에 TaskCreate 있음 → 평소대로(빈 목록)
  ↘ tools 에 TaskCreate 없음 → '작업' 타일이 원인 + CLI 버전을 말한다
  ↘ tools 필드 자체가 없음 → 평소대로(판정 불가, 안내 없음)

[에이전트가 TaskUpdate(status:'in_progress', activeForm:'테스트를 실행하는 중')]
  → 그 행의 제목이 activeForm 으로 바뀐다
  → completed 로 바뀌면 제목이 subject 로 돌아오고 취소선이 붙는다
  ↘ activeForm 이 없으면 subject 를 그대로 쓴다

[에이전트가 TaskUpdate(A, addBlocks:['B'])]
  → B 가 이미 있으면 B 의 '차단 요인'에 A 가 더해진다
  ↘ B 가 없으면 무시 — 다음 TaskList 스냅샷이 보정한다

[에이전트가 TaskUpdate 에 실패(success:false)]
  → 목록은 그대로
  → 대화록의 그 도구 카드가 error 문구를 보인다

[background_tasks_changed 도착]
  → 매핑된 집합으로 추적 목록을 교체 — 집합에 없는 추적 항목은 정착
  ↘ 첫 payload 이전 · 매핑 없는 항목 → 무시

[task_updated(patch.status:'paused')]
  → 그 행이 '일시정지' 로 바뀌고 중단 버튼은 그대로 남는다(D-022)
  → 'running' 으로 돌아오면 원래대로

[사용자가 foreground 서브에이전트 행의 '백그라운드로' 클릭]
  → backgroundTasks(toolUseId) → 막혀 있던 tool_result 가 즉시 반환되고 턴이 이어진다
  → 작업은 계속 돈다 — 끝나면 task_notification 이 온다
  → 그 행의 전환 버튼이 사라진다(더 이상 foreground 가 아니다)
  ↘ 요청 실패 → 버튼 복구 + 사유 표시 (중단 실패와 같은 규칙)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| `init` · `tools` 에 `TaskCreate` 없음 | 세션 상태에 `agentTools` 저장 | `작업` 타일 `진행 상황` 이 안내 문구 + CLI 버전 |
| `init` · `tools` 부재 | `agentTools` 미저장 | 현행 빈 상태 — 안내 없음 |
| `TaskUpdate(in_progress + activeForm)` | 항목의 `activeForm` 병합 | 제목이 현재진행형으로 교체 |
| `TaskUpdate(completed)` | `status` 병합 | 제목이 `subject` 로 복귀 + 취소선 |
| `TaskUpdate(addBlocks)` · 대상 있음 | 대상의 `blockedBy` 에 가산 | 대상 상세의 `차단 요인` 에 id 추가 |
| `TaskUpdate(success:false)` | 목록 무변경 | 대화록 도구 카드에 `error` 문구 |
| `background_tasks_changed` · 첫 payload | 집합 저장 + 유효 표시 | 변화 없음 (기준선 확립) |
| `background_tasks_changed` · 2회차 이후 | 매핑 집합으로 REPLACE | 집합에 없는 진행 중 항목이 정착 상태로 |
| `task_updated(paused)` | transient 집합에 추가 | 행 라벨 `일시정지` · **중단 버튼 유지**(D-022) |
| `task_updated(killed)` | `stopped` 와 동형 정착 | 행이 `중단됨` |
| CLI 프로세스 재기동 | 레벨 집합 리셋 + 무효화 | 다음 변화까지 레벨로 정착시키지 않음 |
| `백그라운드로` 클릭 (foreground 행) | `backgroundTasks(toolUseId)` 요청 | 턴이 이어지고 그 행의 전환 버튼이 사라진다 |
| `백그라운드로` 요청 실패 | 표식 되돌림 + reject | 버튼 복구 + 사유 표시 |
| 이미 background 인 행 | 전환 버튼 자체를 렌더하지 않음 | 효과 없는 버튼이 보이지 않는다(D-021) |

### 파생 UX / 엣지케이스

- loading / empty / error: 빈 상태가 **세 갈래**다 — 판정 불가(현행) · 기능 없음(안내) · 기능 있고 항목 없음(현행).
- cancel / retry / close / restart: `paused` 중에도 중단은 가능하다(D-022) — SDK 에 resume 이 없어 중단이 유일한 탈출구다. `중단 중` 에는 중단 버튼을 숨긴다(중복 요청 차단, 현행 유지).
- 제어 가용성: 행에 붙는 버튼은 **최대 둘**이다 — `중단`(background 이고 `in_progress`\|`paused`) · `백그라운드로`(background 이고 foreground 실행 중). 할 일 항목에는 **버튼이 없다**(D-023 · SDK 경로 부재).
- concurrency / multi-session: 레벨 신호는 `sessionId` 로 라우팅한다. 다른 세션의 집합이 이 세션을 정착시키지 않는다.
- keyboard / a11y / theme: `aria-label` 은 `subject` 고정(D-007). 표시 제목만 상태에 따라 바뀐다.
- 외부환경/오프라인/폐쇄망: 안내 문구는 로컬 문자열이다 — 네트워크에 의존하지 않는다.

## 6. 범위 / 비범위

- **관측 범위**: 기능 존재 게이트 · `activeForm` · `addBlocks` 역방향 · `TaskUpdate.error` 표시 · `background_tasks_changed` · `task_updated`(`paused`·`killed`·`is_backgrounded`·`error`) · Task 도구 4종의 transcript 전용 렌더.
- **제어 범위**: 단건 foreground → background 전환 진입점(D-020·D-021, **새 IPC 채널 1개**) · `paused` 행의 중단 버튼 유지(D-022).
- **비범위**: `TodoWrite` 폴백(D-004) · `metadata` · `output_file` · `task_type`/`workflow_name` · **전량 백그라운드 전환**(D-020) · **할 일 항목 직접 편집·개별 중단**(D-023) · **pause/resume**(SDK API 부재) · Task 도구 권한 게이트(D-024) · `TaskOutput`/`TaskStop` 채택(0204 D-010 유지) · `owner`(0204 유지) · DB 마이그레이션.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `metadata` (Create·Update) | 아니오 | 후속 — 소비처가 생길 때. 지금 넣으면 `task-tool.ts` 헤더가 금지한 죽은 표면이다 |
| `output_file` (`task_notification`) | 아니오 | 후속 handoff — "서브에이전트 전체 출력 열기" 는 파일 접근·표시 방식 결정이 따로 필요하다 |
| `task_type`/`workflow_name` (`task_started`) | 아니오 | 후속 handoff — workflow 를 일반 서브에이전트와 다르게 그릴지가 UX 결정이다 |
| `TodoWrite` 폴백 | 아니오 | D-004 로 명시 배제. 구버전 CLI 사용자는 안내를 받는다 |
| 전량 백그라운드 전환 (`backgroundTasks()`) | 아니오 | D-020 — 포트 시그니처를 `toolUseId?` 로 넓혀 **나중에 열 수 있게** 남긴다. 진입점만 안 만든다 |
| 할 일 항목 편집·개별 중단 · pause/resume | **해당 없음** | **SDK 에 경로가 없다**(spec §5.3). 미룬 것이 아니라 불가능한 것이다 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `init.tools` 에 `TaskCreate` 가 있으면 안내가 뜨지 않는다 | 렌더 테스트 — `agentTools:['TaskCreate','Bash']` + 항목 0건 → 안내 문구 부재 | SDK init → `claudeToNormalized` → `session.updated` → store → `TaskTileContent` |
| R-01 | AT-02 / AC2 | `init.tools` 에 `TaskCreate` 가 없으면 원인과 CLI 버전이 뜬다 | 렌더 테스트 — `agentTools:['Bash']`, `cliVersion:'2.1.100'` → 안내 문구 + `2.1.100` 이 함께 보인다 | 같은 경로 |
| R-01 | AT-03 / AC3 | `tools` 필드가 없으면 안내하지 않는다 | 렌더 테스트 — `agentTools:undefined` → 안내 문구 부재. 단위 테스트 — `init` 에 `tools` 없으면 patch 에 `agentTools` 키가 없다 | 같은 경로 — **방어 분기**다. SDK 타입은 `tools` 를 required 로 선언하므로(§8) 도달 경로는 "CLI 가 사용자 설치본" 이라는 사실(spec §6)이 연다 |
| R-01 | AT-04 / AC4 | 뒤이은 `session.updated` 가 `agentTools` 를 지우지 않는다 | reducer 단위 — `{model}` 만 든 patch 적용 후 `agentTools` 보존 | `session.updated` 재도착 |
| R-02 | AT-05 / AC5 | `in_progress` 항목의 제목이 `activeForm` 이다 | fold 단위 — Create(subject) → Update(in_progress+activeForm) → `title === activeForm` | tool_result → parts → `taskBoardFromMessages` → 행 |
| R-02 | AT-06 / AC6 | `completed` 로 바뀌면 제목이 `subject` 로 돌아온다 | fold 단위 — 위 상태에서 Update(completed) → `title === subject` | 같은 경로 |
| R-02 | AT-07 / AC7 | `activeForm` 이 없으면 `subject` 를 쓴다 | fold 단위 — activeForm 미제공 in_progress → `title === subject` | 같은 경로 |
| R-02 | AT-08 / AC8 | `aria-label` 은 상태와 무관하게 `subject` 다 | 렌더 테스트 — in_progress 행의 `aria-label` 에 `subject` 포함, `activeForm` 미포함 | `TaskTileContent` 행 |
| R-02 | AT-09 / AC9 | `active_form` 별칭도 읽는다 | 파서 단위 — `{active_form:'…'}` 입력 → patch 에 `activeForm` 이 실린다 | `readTaskToolObservation` |
| R-03 | AT-10 / AC10 | `addBlocks` 가 대상의 `blockedBy` 에 가산된다 | fold 단위 — Create(1)·Create(2) 후 `Update(1, addBlocks:['2'])` → 항목 2 의 `blockedBy` 에 `'1'` 포함 | 같은 fold 경로 |
| R-03 | AT-11 / AC11 | 대상이 없으면 항목을 만들지 않는다 | fold 단위 — Create(1) 만 있고 `Update(1, addBlocks:['9'])` → 목록 길이 1, id `9` 부재 | 같은 경로 |
| R-03 | AT-12 / AC12 | 자기 자신을 막는 간선은 만들지 않는다 | fold 단위 — `Update(1, addBlocks:['1'])` → 항목 1 의 `blockedBy` 가 빈 배열 | 같은 경로 |
| R-03 | AT-13 / AC13 | `TaskList` 스냅샷이 역방향 가산분을 교체한다 | fold 단위 — AT-10 상태에서 `blockedBy:[]` 인 스냅샷 → 항목 2 의 `blockedBy` 가 빈 배열 | 같은 경로 |
| R-04 | AT-14 / AC14 | `background_tasks_changed` 의 집합에 없는 추적 항목이 정착한다 | tracker 통합 — 두 항목 추적 중 첫 payload → 둘째 payload(항목 1개) → 빠진 항목이 정착 상태 | SDK system → `claudeToNormalized` → `subagent.backgroundSet` → coordinator → tracker |
| R-04 | AT-15 / AC15 | 첫 payload 는 아무것도 정착시키지 않는다 | tracker 통합 — 추적 2건 상태에서 빈 `tasks:[]` 첫 payload → 정착 0건 | 같은 경로 |
| R-04 | AT-16 / AC16 | 매핑 없는 `task_id` 는 무시한다 | 매핑 단위 — `taskToolUseById` 에 없는 `task_id` 만 든 payload → `toolUseIds` 빈 배열 | `claudeToNormalized` |
| R-04 | AT-17 / AC17 | watchdog 정착 경로가 그대로 동작한다 (회귀) | 기존 `stop-subagent` 테스트가 green — 레벨 신호 없이 timeout 만으로 정착 | `stopSubagentTask` |
| R-05 | AT-18 / AC18 | `paused` 행은 `일시정지` 라벨이고 **중단 버튼이 유지된다** | 렌더 테스트 — paused 집합에 든 background 행 → 라벨 일치 **+ 중단 버튼 존재** | `task_updated` → store transient → `backgroundBoardStatus` → 두 타일 |
| R-05 | AT-19 / AC19 | `running` 으로 돌아오면 라벨이 `진행 중` 으로 복귀한다 | 렌더 테스트 — paused 해제 후 라벨 복귀 + 버튼 계속 존재 | 같은 경로 |
| R-05 | AT-20 / AC20 | `killed` 는 `중단됨` 으로 정착한다 | 매핑 단위 — `patch.status:'killed'` → `status:'stopped'` 인 `subagent.task` | `claudeToNormalized` |
| R-05 | AT-21 / AC21 | `patch.error` 가 정착 사유로 보인다 | fold + 렌더 — errorMessage 를 실은 정착 → 행이 그 문구를 보인다 | 같은 경로 |
| R-06 | AT-22 / AC22 | 할 일 목록 4종(`TaskCreate`·`TaskGet`·`TaskUpdate`·`TaskList`)이 대화록에서 전용 본문으로 읽히고 실패 `error` 를 보인다. `TaskOutput`·`TaskStop` 은 **기존 폴백 그대로**다(D-025) | 렌더 테스트 — `TaskUpdate` 실패 카드가 `error` 문구를 보이고, 성공 카드는 `subject`·`status` 를 보인다. **6종 전량 대조** — `TaskOutput`·`TaskStop` 카드는 전용 본문을 갖지 않는다 | tool parts → `registry.ts` → 전용 Body |
| R-07 | AT-23 / AC23 | foreground 서브에이전트 행에 `백그라운드로` 버튼이 뜬다 | 렌더 테스트 — `asyncLaunched:false` 인 진행 중 행 → 버튼 존재 (두 타일 각각) | store 의 background 관측 → `canBackgroundTask` → 두 타일 |
| R-07 | AT-24 / AC24 | 이미 background 인 행에는 그 버튼이 없다 | 렌더 테스트 — `asyncLaunched:true` 행 → 버튼 부재. 중단 버튼은 그대로 존재 | 같은 경로 |
| R-07 | AT-25 / AC25 | 클릭하면 그 `toolUseId` 로 전환이 요청된다 | 통합 — 클릭 → IPC → `backgroundTask(toolUseId)` 가 **그 id 로** 1회 호출 | renderer → `orca:chat:backgroundSubagent` → session-runtime → SDK |
| R-07 | AT-26 / AC26 | 요청이 실패하면 버튼이 복구되고 사유가 보인다 | 통합 — 포트가 reject → renderer 가 요청 표식을 되돌리고 오류 문구를 낸다 | 같은 경로 (중단 실패와 동일 규칙) |

### AC 검증 주의사항

- 기존 테스트 재사용: AT-17 의 회귀 대상은 **행동 단언으로 확정했다** — "확정이 오지 않으면 합성 정착으로 마감한다"(watchdog 발화)와 그 양성 짝 "확정이 오면 watchdog 은 발화하지 않는다". 현재 두 단언은 `src/main/features/chat/stop-subagent.test.ts`(9케이스)에 있고 **정식화 턴에 케이스명까지 확인했다**. 파일명은 계약이 아니다 — 구현자가 옮기면 같은 두 단언이 어디 있든 회귀가 성립한다.
- R-92(중단 실패 복구, VP-19)의 회귀 대상도 같다 — "채널이 죽었으면 throw 하고 중단 표식을 되돌린다" + "`stopTask` 가 거절하면 그대로 전파한다 — 삼키지 않는다". 같은 스위트에 실존한다.
- 사람 실기 항목: **없음.** 안내 문구·라벨·버튼 유무는 전부 렌더 테스트로 관측 가능하다. 시각 실기가 필요한 신규 레이아웃이 없다(기존 행·빈 상태의 문구만 바뀐다).
- N회/총량 기준: **없음.** 이번 AC 에 호출 횟수·총량 식이 없다.
- 총량/0건 기준: **없음.** 음성 게이트를 AC 로 쓰지 않는다 — AT-03·AT-11·AT-12·AT-15·AT-24 는 "부재"를 단언하지만 각각 **같은 pair 안에 양성 짝**(AT-02·AT-10·AT-10·AT-14·AT-23)이 있어 장치가 침묵으로 통과하지 않는다. AT-24 는 부재 단언 안에 **양성 항도 함께** 든다(전환 버튼 부재 + 중단 버튼 존재) — 행 전체가 안 그려져도 실패한다.
- 순서 기준: AT-15 가 순서를 단언한다(첫 payload vs 이후). 관측 지점은 tracker 의 정착 호출이며 payload 순번은 테스트가 직접 제어한다.
- **AC 분모 26 — 상한 초과 1건.** SKILL §5 의 분할 검토 결과는 D-001 에 있다. R 별 분포는 R-01(4) · R-02(5) · R-03(4) · R-04(4) · R-05(4) · R-06(1) · R-07(4) 이고 합 = **26** (검산 일치).
- 인자 단언: AT-25 는 "호출됐다" 가 아니라 **"그 `toolUseId` 로 1회 호출됐다"** 를 단언한다 — 인자를 안 보면 아무 태스크나 백그라운드로 보내도 통과한다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 0204 의 V(`ΔV2 @7b45fa3` · r5 PASS)를 상속하지 않는다 — 이번 R 6건 중 4건(R-01·R-04·R-05·R-06)은 0204 V 에 대응 노드가 **없다**. 나머지 2건(R-02·R-03)이 닿는 0204 의 표시·fold 계약은 `INHERITED` 노드로 등록해 `REGRESSION` pair 로 닫는다.
- 기준 V 상속 근거: 없음 (`none`).
- 변경이 시작되는 수준: **R** — 사용자 관측 결과가 바뀐다. 아래로 SD·AR·MD 전 층을 포함한다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §5·§7 기능 존재 게이트 | NEW | — |
| R-02 | R | §5·§7 `activeForm` 제목 교체 | NEW | — |
| R-03 | R | §5·§7 역방향 의존 간선 | NEW | — |
| R-04 | R | §5·§7 background 멤버십 레벨 | NEW | — |
| R-05 | R | §5·§7 `paused`·`killed`·`error` | NEW | — |
| R-06 | R | §5·§7 transcript 전용 렌더 | NEW | — |
| R-07 | R | §5·§7 단건 foreground → background 전환 | NEW | — |
| R-90 | R | 0204 §7 — 목록이 id 오름차순 단일 목록이고 완료는 취소선 | INHERITED | `0204:ΔV2 @7b45fa3 (r5 PASS)` · `taskBoard.test.ts` AT-10a 케이스 |
| R-91 | R | 0204 §7 — `중단 중` 경유 후 SDK 확정으로 정착 | INHERITED | `0204:ΔV2 @7b45fa3 (r5 PASS)` · `stop-subagent` 스위트 |
| AT-01…AT-26 | AT | §7 각 행 | NEW | — |
| SD-01 | SD | §5·§13 — `init` → 세션 상태 → 빈 상태 세 갈래 | NEW | — |
| SD-02 | SD | §5·§13 — 레벨 신호 수명(첫 payload·프로세스 재기동) | NEW | — |
| SD-03 | SD | §5·§13 — `paused` 진입/이탈과 **중단 가용성 유지** | NEW | — |
| SD-04 | SD | §5·§13 — 전환 요청 수명(요청 → 성공 시 버튼 소멸 / 실패 시 복구) | NEW | — |
| AR-01 | AR | §9·§10 — `session.updated.patch` 확장(신규 variant 0) | NEW | — |
| AR-02 | AR | §9·§10 — `subagent.backgroundSet` 신규 variant + 소비자 | NEW | — |
| AR-03 | AR | §9·§10 — `subagent.task` 확장(`phase:'updated'`·`runState`) | NEW | — |
| AR-04 | AR | §9·§10 — 신규 IPC 채널 `chatBackgroundSubagent` + 포트 `backgroundTask(toolUseId?)` | NEW | — |
| MD-01 | MD | §10·§11 — `AgentTaskPatch` 확장과 별칭 허용 | NEW | — |
| MD-02 | MD | §10·§11 — 역방향 가산 규칙(존재 조건·자기 간선 배제) | NEW | — |
| MD-03 | MD | §10·§11 — 표시 제목 파생(`title` vs `subject`) | NEW | — |
| MD-04 | MD | §10·§11 — `canBackgroundTask` 술어(foreground 이고 진행 중일 때만) | NEW | — |
| MD-90 | MD | 0204 — `TaskList` 전체 스냅샷 교체 | INHERITED | `0204:ΔV2 @7b45fa3 (r5 PASS)` · `taskBoard.test.ts` AT-34 케이스 |
| R-92 | R | 0204 — 중단 요청 실패 시 `진행 중` 복구 + 사유 표시 | INHERITED | `0204:ΔV2 @7b45fa3 (r5 PASS)` · `stop-subagent.ts:82-86` 복구 경로 |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02·03 | REQUIRED | SDK `init` → `claudeToNormalized` → `session.updated` → store → `TaskTileContent` 빈 상태 | 렌더 산출의 안내 문구·버전 문자열 유무 | not selected — 문구 존재/부재를 직접 관측하고 세 갈래가 서로의 양성 짝이다 | EP-01·EP-02 (2) |
| VP-02 | SD-01 ↔ AT-04 | REQUIRED | 두 번째 `session.updated` → reducer patch 병합 → store | 병합 후 `agentTools` 값 | not selected — 값을 직접 읽는다 | EP-02 (1) |
| VP-03 | R-02 ↔ AT-05·06·07 | REQUIRED | tool_result → parts → `taskBoardFromMessages` → `TaskBoardItem.title` | 상태별 `title` 값 비교 | **required** — `title`/`subject` 형제 슬롯이 서로 다른 계약이라 **맞바꾸는 변이**를 심는다(SKILL §5 자리 규칙) | EP-03·EP-05 (2) |
| VP-04 | MD-03 ↔ AT-08 | REQUIRED | store → `TaskTileContent` 행 `aria-label` | `aria-label` 문자열 | **required** — 위와 같은 형제 맞바꿈 변이 | EP-05 (1) |
| VP-05 | MD-01 ↔ AT-09 | REQUIRED | `tool_use.args` → `readTaskToolObservation` → patch | patch 의 `activeForm` 값 | not selected — 반환값을 직접 읽는다 | EP-03 (1) |
| VP-06 | R-03 ↔ AT-10·11·12 | REQUIRED | `TaskUpdate` 결과 → fold → 대상 `blockedBy` | 대상 항목의 `blockedBy` 배열 | not selected — 배열 내용을 직접 읽고 AT-11·12 는 AT-10 을 양성 짝으로 갖는다 | EP-04 (1) |
| VP-07 | MD-90 ↔ AT-13 | REGRESSION | `TaskList` 결과 → fold → 전체 교체 | 스냅샷 후 `blockedBy` 배열 | not selected — 직접 읽는다 | EP-04 (1) |
| VP-08 | R-04 ↔ AT-14·15 | REQUIRED | SDK `background_tasks_changed` → `subagent.backgroundSet` → coordinator → `BackgroundTaskTracker` | 정착 호출 대상 id 집합 | not selected — 정착된 id 를 직접 관측한다 | EP-06·EP-07 (2) |
| VP-09 | AR-02 ↔ AT-16 | REQUIRED | `task_id` → `taskToolUseById` → `toolUseIds` | 이벤트의 `toolUseIds` 배열 | not selected — 배열을 직접 읽는다 | EP-06 (1) |
| VP-10 | R-91 ↔ AT-17 | REGRESSION | `stopSubagentTask` → timeout → 합성 정착 | 기존 스위트의 정착 단언 | not selected — 기존 직접 oracle | EP-08 (1) |
| VP-11 | R-05 ↔ AT-18·19 | REQUIRED | `task_updated` → store transient → `backgroundBoardStatus` → 두 타일 | 라벨 문자열 + 중단 버튼 노드 유무 | not selected — 두 타일 산출을 각각 직접 관측한다 | EP-09·EP-10 (2) |
| VP-12 | AR-03 ↔ AT-20·21 | REQUIRED | `task_updated` → `claudeToNormalized` → `subagent.task` | 정규화 이벤트의 `status`·`errorMessage` | not selected — 이벤트 필드를 직접 읽는다 | EP-09 (1) |
| VP-13 | R-06 ↔ AT-22 | REQUIRED | tool parts → `registry.ts` match → 전용 Body | 렌더 산출의 필드 문구 | not selected — 문구를 직접 관측한다 | EP-11 (1) |
| VP-14 | R-90 ↔ 0204 기존 AT-10a | REGRESSION | 같은 fold 경로 | `taskBoard.test.ts` 의 순서 단언 | not selected — 기존 직접 oracle | EP-04 (1) |
| VP-15 | SD-03 ↔ AT-18·19 | REQUIRED | `paused` 진입 → **중단 가용성 유지** → 이탈 | `canStopTask` 반환 + 렌더의 버튼 노드 | **required** — `paused` 를 `in_progress` 와 나란히 허용하는 술어라, `paused` 항만 **지우는 변이**를 심어 AT-18 이 red 가 되는지 확인한다(D-022 가 이번 턴 자체 정정이라 방향을 잠근다) | EP-10 (1) |
| VP-16 | R-07 ↔ AT-23·24 | REQUIRED | background 관측(`asyncLaunched`) → `canBackgroundTask` → 두 타일 버튼 | 두 타일 산출의 전환 버튼 노드 유무 | not selected — AT-24 가 AT-23 의 양성 짝이고 중단 버튼 존재도 함께 단언한다 | EP-12·EP-13 (2) |
| VP-17 | AR-04 ↔ AT-25 | REQUIRED | 클릭 → `orca:chat:backgroundSubagent` → session-runtime → `backgroundTask(toolUseId)` | 포트 호출의 **인자와 횟수** | not selected — 인자를 직접 관측한다 | EP-12·EP-14 (2) |
| VP-18 | SD-04 ↔ AT-26 | REQUIRED | 포트 reject → IPC reject → renderer 복구 | 복구 후 버튼 노드 + 오류 문구 | not selected — 렌더 산출을 직접 읽는다 | EP-14 (1) |
| VP-19 | R-92 ↔ 기존 중단 실패 복구 | REGRESSION | `stopSubagentTask` throw → 표식 되돌림 → renderer 복구 | `stop-subagent` 스위트의 복구 단언 | not selected — 기존 직접 oracle | EP-08 (1) |
| VP-20 | MD-04 ↔ AT-23·24 | REQUIRED | `canBackgroundTask(item, asyncLaunched)` 반환 | 술어 반환값 (순수) | not selected — 반환을 직접 읽는다 | EP-13 (1) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| **선행 조건 — 의존성 설치** | 워크트리는 `node_modules` 를 물려받지 않는다 — 없으면 아래 게이트가 하나도 실행되지 않는다 | `cd app && npm ci`. **이 워크트리는 2026-09-01 설치 완료** — SDK `0.3.220` 이 `package.json:34` 고정값과 일치 | 미설치는 게이트 미실행 |
| subtree — `app/**` 정적 | `app/src/{main,renderer,shared}` 를 바꾼다 | `npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| subtree — 관련 스위트 | 파서·fold·렌더·tracker 가 바뀐다 | `./node_modules/.bin/vitest run src/shared/task-tool.test.ts src/renderer/src/features/chat src/main/adapters src/main/features/chat` | 이번 변경이 깬 케이스만 blocking |
| repository — 문서 인벤토리 | **추적 항목 둘이 늘어난다** — `subagent.backgroundSet`(NormalizedEvent variant) · `chatBackgroundSubagent`(IPC 채널·핸들러). 셋 다 `check-doc-inventory.mjs` 대상이다 | `node scripts/check-doc-inventory.mjs` 로 재생성 후 `--check` 통과 | 재생성 누락은 blocking |
| repository — IPC 계약 | `session.updated.patch` 확장 + 신규 variant + **신규 채널 1개** | `docs/IPC_CONTRACT.md` 를 같은 커밋에서 갱신 (`docs/AGENTS.md §작성규칙 6`) | 미갱신은 blocking |

> **알려진 기준선(이번 변경과 무관 — blocking 아님) — 이 베이스에서 실측 확정, 2026-09-01.** `vitest run src/main/infra/git src/main/features/worktrees` 는 **12파일 63케이스**이고 기본 5,000ms 에서 **flaky** 하다 — 두 번 돌려 `3파일 10케이스` / `6파일 24케이스` 로 결과가 달랐다. 실패는 두 형태뿐이고 **단언 실패는 0건**이다: `timed out in 5000ms` **20건** + `EBUSY: rmdir` **17건**(`afterEach` 의 `rmSync` 가 아직 도는 git 프로세스와 경합한다 — 타임아웃의 2차 효과다). `--testTimeout=60000` 으로 재실행하면 **12파일 63케이스 전건 통과, 실패 0**. 이번 변경은 이 파일들을 건드리지 않는다.

> **변경 전 초록 기준선 (정식화 턴 실측, 2026-09-01)** — 구현 턴이 "내가 깬 것"과 "원래 그랬던 것"을 가르는 분모다.
>
> | 게이트 | 결과 |
> |---|---|
> | `npm run typecheck` (node·web·test 3구성) | **exit 0 · 출력 0줄** |
> | `npm run lint` | **0 error / 1 warning** — 기존분이다(`useTranscriptVirtualizer.ts:22` React Compiler `incompatible-library`). 트리 쓰기 0 |
> | 이번 변경의 대상 스위트 (`task-tool` · `renderer/features/chat` · `main/adapters` · `main/features/chat`) | **103파일 1054케이스 전건 green** |
> | `node scripts/check-doc-inventory.mjs --check` | **exit 0** — 현재 인벤토리가 코드와 동기 상태다 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `init` 매핑이 `session_id`·`model` 만 읽고 `tools`·`claude_code_version`·`capabilities` 를 버린다 | `app/src/main/adapters/claude-map.ts:177-188` |
| `session.updated.patch` 는 이미 optional 병합 patch 다 — 현재 `{ model?; cwd? }` **2필드**. 얹는 것이 새 형태가 아니다 | `app/src/shared/ipc.ts:443-445`. **0211 의 `worktree` 선례 주석은 이 베이스에 없다**(그 작업은 다른 브랜치) |
| `subagent.task` 는 reducer 를 거치지 않는 transient 다 — store 가 `toolUseId` 키 맵으로 흡수한다 | `app/src/shared/ipc.ts:539` 주석 |
| `task_id → tool_use_id` 매핑이 이미 있다 | `app/src/main/adapters/claude-map.ts:54` `ctx.taskToolUseById` |
| `stoppingBackgroundIds` 가 transient 집합으로 표시 상태를 바꾸는 선례다 | `app/src/renderer/src/features/chat/lib/taskBoard.ts` `backgroundBoardStatus` |
| `SubagentTaskStatus` 는 `running\|completed\|failed\|aborted` — `paused` 가 없다 | `app/src/renderer/src/features/chat/lib/parts.ts:151` |
| transcript 레지스트리는 `Task`·`Agent` 만 전용 본문을 갖고 나머지는 `KeyValueBody` 폴백이다 | `app/src/renderer/src/features/chat/components/transcript/registry.ts:64,79` |
| `isAgentTaskName` 은 `Task`·`Agent` 2종뿐이다 — Task 도구 4종은 여기 없다 | `app/src/renderer/src/features/chat/lib/parts.ts:318` |
| NormalizedEvent variant 는 `check-doc-inventory.mjs` 추적 항목이다 | `app/scripts/check-doc-inventory.mjs:28` |
| ABI-중립 기본 게이트는 `lint` + `typecheck` 이고 비-DB 스위트는 `vitest run` 직접 호출로 `pretest` 를 우회한다 | `app/AGENTS.md:124,127` |
| **`Query` 의 task 제어 API 는 3종이 전부다** — `stopTask`·`backgroundTasks(toolUseId?)`·`interrupt`. 할 일 목록 편집·pause/resume 은 control request union 에도 없다 | SDK `sdk.d.ts` `Query` 인터페이스 · `SDKControlRequestInner` |
| `backgroundTask` 포트가 **`toolUseId: string` 필수**라 SDK 의 인자 없는 전량 전환이 구조적으로 도달 불가다 | `app/src/main/adapters/types.ts:46` |
| 중단 실패 복구가 이미 있다 — throw 시 `stoppedSubagents`·`blockedSubagents` 표식을 되돌린다 | `app/src/main/features/chat/stop-subagent.ts:82-86` |
| **`SessionRuntime.backgroundTask` 는 소비자가 0인 죽은 표면이다** — 상위 진입점이 있는데 IPC 핸들러가 없다 | `app/src/main/features/sessions/session-runtime.ts:651` + 전수 조사 |
| `RISKY_TOOLS` 는 상태 변경 도구 5종만 담는다 — Task 도구는 승인 게이트를 지나지 않는다 | `app/src/main/adapters/risky-tools.ts` |
| **`TASK_TOOL_NAMES` 는 6종이다** — 할 일 목록 4종 + `TaskOutput`·`TaskStop`. 후자는 구조화 출력이 없고 파일 헤더가 "관측 대상이 아니다"(0204 D-010)로 못박는다 | `app/src/shared/task-tool.ts:16-27` 주석 + 배열 |
| 워크트리의 `app/node_modules` 는 설치해야 생긴다 — 설치 후 SDK 실측이 가능해졌다 | `npm ci` 후 `node_modules/@anthropic-ai/claude-agent-sdk` = `0.3.220` (2026-09-01) |
| 외부 SDK 표면 정본 | [`docs/claude-taskxxx-spec.md`](../../claude-taskxxx-spec.md) §2·§4·§5·§6 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `activeForm`·`addBlocks`·`task_updated`·`background_tasks_changed`·`is_backgrounded` 소비처 | `rg "activeForm\|addBlocks\|task_updated\|background_tasks_changed\|is_backgrounded" app/src` | **0** | 다섯 표면 모두 코드에 없다 |
| `TodoWrite` 등장 | `rg "TodoWrite" app/src` | **6** | **전부 부정 참조** — mock 시나리오 1(일반 도구로 발행) · 권한 분류 3(위험 도구 아님·파일툴 아님) · 술어 테스트 2(**Task 도구가 아님을 단언**). **관측 경로 0** |
| `output_file`·`workflow_name` 소비처 | `rg "output_file\|workflow_name" app/src` | **0** | §6 비범위 |
| `system` subtype 분기 | `claude-map.ts` 의 dispatch 조건 | **5** | `init`·`task_started`·`task_progress`·`task_notification`·`compact_boundary` — 두 개를 늘려 7이 된다 |
| `backgroundBoardStatus` 호출부 | `rg "backgroundBoardStatus" app/src` (정의·주석 제외) | **2** | `taskBoard.ts:210`(fold 내부 파생) · `SubAgentTileContent.tsx:208`. **`TaskTileContent` 는 부르지 않는다** — 이미 파생된 `item.status` 를 받는다. `paused` 인자는 이 2곳에 닿는다 |
| 표시 상태 규칙이 두 타일에 닿는 경로 | `rg "canStopTask\(\|canStopBackgroundStatus\(" app/src` | **3+2** | `TaskTileContent` 는 `canStopTask`(:182·:289), `SubAgentTileContent` 는 `canStopBackgroundStatus`(:258). 전자가 후자에 위임하므로(`taskBoard.ts:304-305`) 술어 1곳을 넓히면 **두 타일 모두** 닿는다 |
| Task 도구 이름 리터럴 소유자 | `rg "TASK_TOOL_NAMES" app/src` | **6건 / 2파일** | 비테스트 소유자는 `task-tool.ts` **1곳**(3건) · 나머지 3건은 같은 이름의 테스트. 렌더 레지스트리는 사본을 만들지 말고 이 파일에서 받아야 한다 — 단 **배열이 6종이라 그대로는 못 쓴다**(D-025) |
| 행별 중단 버튼 렌더 지점 | `rg "canStopTask\(\|canStopBackgroundStatus\(" --include=*.tsx` (테스트 제외) | **3** | `TaskTileContent.tsx:182`(행)·`:289`(상세) · `SubAgentTileContent.tsx:258` — 전환 버튼도 같은 자리에 붙는다(EP-12) |
| 어댑터 포트 `backgroundTask` 호출부 | `rg "\.backgroundTask\("` (테스트 제외) | **3** | **내부 폴백 2**(`stop-subagent.ts:55` · `settle.ts:122`) + 런타임 위임 1(`session-runtime.ts:652`). **사용자 진입점 0** |
| `SessionRuntime.backgroundTask` 소비자 | `rg "\.backgroundTask\("` 중 `live.`·`this.live` 제외 | **0** | **죽은 표면이다.** 상위 진입점이 이미 있는데 IPC 핸들러가 없어 아무도 부르지 않는다 — R-07 은 새로 만드는 것이 아니라 **배선을 잇는 것**이다 |
| task 제어 IPC 채널 | `rg "Subagent" app/src/shared/ipc.ts` 중 채널 정의 | **1** | `chatStopSubagent`(`ipc.ts:16`) 하나 — 전환 채널이 없다 |
| `session.updated.patch` 현재 필드 | `ipc.ts:443-445` | **2** | `model?`·`cwd?`. 이번 변경이 4로 늘린다 |

### 수치 / 전칭 표현 검산

- 재측정 수치: SDK 표면 46개 = 할 일 목록 26 + background 15 + 교차 5. 내역 합 = 총계 ✅.
- "유일한/항상/절대" 반례 검색: 본문에 전칭 표현 **0건** — `단일 소유`(§8 표)는 비테스트 참조 N=1 로 뒷받침된다(테스트 3건은 같은 파일의 스위트).
- 문서 앵커 존재 확인: `docs/claude-taskxxx-spec.md` §2.1·§2.2·§2.4·§2.5·§4.4·§4.5·§6 — 이번 턴에 함께 작성해 전부 존재한다. `docs/AGENTS.md §작성규칙 6·7` 존재 확인 ✅.
- 기존 테스트 케이스 존재 확인: `taskBoard.test.ts` 의 `AT-10a`·`AT-34` 케이스명 실존 ✅ (`rg "AT-10a\|AT-34"` → 4건). `stop-subagent.test.ts` **9케이스 전량 열거 확인** ✅ — AT-17 은 "확정이 없으면 합성 정착으로 마감한다"·"확정이 오면 watchdog 은 발화하지 않는다", R-92 는 "채널이 죽었으면 throw 하고 중단 표식을 되돌린다"·"`stopTask` 가 거절하면 그대로 전파한다" 에 귀속한다(§7 주의사항).
- 결손 재현 — **이 베이스에서 재확인 (4/4 green)**: SDK 타입 페이로드로 ① `TaskCreate.activeForm` 이 관측에 남지 않는다 ② `addBlocks` 만 든 `TaskUpdate` 는 patch 가 비어 **`null`** 로 떨어진다 ③ 실패 갱신의 `error` 문구가 관측에 남지 않는다 ④ `in_progress` 갱신에서도 `activeForm` 이 사라진다. 프로브는 확인 후 삭제했다(트리 변화 0).
- **정식화 턴 SDK 표면 재실측** (`node_modules/@anthropic-ai/claude-agent-sdk` **0.3.220**, `package.json:34` 고정값과 일치): `TaskCreateInput.activeForm?`(`sdk-tools.d.ts:2495`) · `TaskUpdateInput.{activeForm?,addBlocks?,addBlockedBy?,owner?,metadata?}` 및 `status` 의 `"deleted"`(`:2509-2547`) · `TaskUpdateOutput.{success,taskId,updatedFields,error?,statusChange?}`(`:3618-3623`) · `SDKTaskUpdatedMessage.patch.status` 의 `killed`·`paused` 와 `{description?,end_time?,total_paused_ms?,error?,is_backgrounded?}`(`sdk.d.ts:4522-4536`) · `SDKBackgroundTasksChangedMessage.tasks[]`(`:2913-2926`) · `Query.{stopTask(taskId),backgroundTasks(toolUseId?),interrupt()}` **3종이 전부**(`:2562`·`:2575`·`:2293`). 여섯 표면 전부 존재 ✅.
- **`init.tools` 는 타입상 required 다** — `SDKSystemMessage.tools: string[]`(`sdk.d.ts:4420`), `claude_code_version: string`(`:4418`), `capabilities?: string[]`(`:4450`). 따라서 AC3 의 `tools` 부재 분기는 **타입이 아니라 실행 현실**(CLI 가 사용자 설치본이라는 spec §6)이 여는 방어 분기다 — spec 준수 CLI 로는 도달하지 않는다.
- **좌표 재측정 (베이스 차이)**: 초안은 0211 작업 브랜치에서 작성됐다. 이 베이스에서 다시 세어 `ipc.ts:447→443-445`(0211 주석 부재) · `ipc.ts:552→539` · `parts.ts:153→151` · `chat-turn/index.ts:66→62` · `stop-subagent.ts:78-84→82-86` 을 정정하고, `session.updated.patch` 를 **3필드→2필드**로 고쳤다. 일치한 좌표: `claude-map.ts:54`·`:177` · `types.ts:46` · `session-runtime.ts:651` · `TaskTileContent.tsx:182,289` · `SubAgentTileContent.tsx:258` · `registry.ts:64,79` · `check-doc-inventory.mjs:28` · `app/AGENTS.md:124,127` · `taskBoard.test.ts` AT-10a·AT-34.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`·`SD-02`·`SD-03`·`AR-01`·`AR-02`·`AR-03`
- 현재 책임 소유자: 정규화 = `claude-map.ts` · 파싱 = `task-tool.ts` · 파생 = `taskBoard.ts` · 표시 = 두 타일
- 현재 오류/취소/정리 경로: 중단은 `stopTask` → `중단 중` → `task_notification` 정착, 미도착은 watchdog 합성 정착. 실패는 throw → 표식 되돌림 → renderer 복구
- 현재 **제어** 경로: `chatStopSubagent` 채널 하나. 전환(`backgroundTask`)은 중단 앞의 내부 폴백으로만 불린다
- 문제의 직접 원인 — 관측: **정규화 단계에서 버려진다.** `init` 의 `tools`, `task_updated`·`background_tasks_changed` subtype, `tool_use.args` 의 `activeForm`·`addBlocks` 가 각각 그 자리에서 사라져 하위 레이어가 볼 수 없다
- 문제의 직접 원인 — 제어: **배선이 끊겨 있다.** `SessionRuntime.backgroundTask` 가 존재하지만 IPC 핸들러가 없어 소비자가 0이다

```text
SDK stream
  → claudeToNormalized
      init          → session.updated { model, cwd }        [tools·version 소실]
      task_started  → subagent.task(started)
      task_progress → subagent.task(progress)
      task_notification → subagent.task(settled)
      task_updated          [분기 없음 — 통째로 소실]
      background_tasks_changed [분기 없음 — 통째로 소실]
      tool_use / tool_result → tool.call.* { args, structuredOutput }
  → bus → coordinator → reducer → messages[].parts
  → taskBoardFromMessages   [readTaskToolObservation 가 activeForm·addBlocks 를 안 읽는다]
  → TaskTileContent / SubAgentTileContent

제어(역방향)
  두 타일 [중단] → chatStopSubagent → stopSubagentTask → backgroundTask→stopTask → 정착
  두 타일 [전환] → **없음**
  SessionRuntime.backgroundTask → **소비자 0 (죽은 표면)**
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같음
- 변경 후 책임 소유자: **같다** — 새 레이어를 만들지 않고 각 소유자의 읽는 범위만 넓힌다
- 변경 후 오류/취소/정리 경로: 정착 경로가 **셋**이 된다 — `task_notification`(기존) · 레벨 신호 REPLACE(신규) · watchdog(기존 유지, D-011). 전환 실패는 중단 실패와 **같은 규칙**으로 복구한다
- 변경 후 **제어** 경로: 채널이 **둘** — `chatStopSubagent`(기존) · `chatBackgroundSubagent`(신규, 죽은 표면에 배선)
- 유지하는 기존 메커니즘: fold 파생(0204 D-002) · `중단 중` 수명주기 · watchdog · `TaskList` 스냅샷 교체 · 중단 실패 복구
- 제거/대체하는 메커니즘: **없음** — 이번 변경은 순수 확장이다. 단 `canStopBackgroundStatus` 의 술어가 **넓어진다**(`paused` 추가, D-022)

```text
SDK stream
  → claudeToNormalized
      init          → session.updated { model, cwd, agentTools?, cliVersion? }   [AR-01]
      task_updated  → subagent.task(phase:'updated', runState?, isBackgrounded?, errorMessage?)  [AR-03]
      background_tasks_changed → subagent.backgroundSet { toolUseIds }           [AR-02 · 신규 variant]
      (나머지 분기 불변)
  → bus → coordinator
      · backgroundSet → BackgroundTaskTracker REPLACE (첫 payload 무효 · 매핑분만)
      · subagent.task(updated) → store transient (paused 집합 · errorMessage)
  → reducer → messages[].parts (불변)
  → taskBoardFromMessages(messages, { stoppingBackgroundIds, pausedBackgroundIds })
      · readTaskToolObservation → patch { …, activeForm?, addBlocks? }           [MD-01]
      · fold 가 addBlocks 를 역방향 가산                                          [MD-02]
      · agentItem 이 title(표시) 과 subject(안정) 를 각각 낸다                    [MD-03]
  → TaskTileContent (빈 상태 3갈래 · aria-label=subject) / SubAgentTileContent (paused)
  → transcript registry 가 Task 도구 4종을 전용 Body 로                          [R-06]

제어(역방향)
  두 타일 [중단] → chatStopSubagent → (불변, paused 도 허용)                      [EP-10]
  두 타일 [전환] → chatBackgroundSubagent → SessionRuntime.backgroundTask → SDK  [AR-04 · 죽은 표면 배선]
  버튼 노출 술어 = canBackgroundTask(item, asyncLaunched)                         [MD-04]
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 소유자 4곳 | **동일** — 읽는 범위만 확장 | 새 레이어는 fold SSOT 를 갈라놓는다 | AR-01·AR-02·AR-03 / `claude-map.ts` |
| data/control flow | system subtype **5** 분기 | **7 분기** (`task_updated`·`background_tasks_changed` 추가) | 두 신호가 정규화에서 소실된다 | SD-02 / VP-08·VP-12 |
| state/contract | `session.updated.patch` **2필드**(`model?`·`cwd?`) · variant 불변 | patch **4필드** + `subagent.backgroundSet` **신규 1** | 기능 게이트는 세션 상태, 멤버십은 집합이라 형태가 다르다 | AR-01·AR-02 / `ipc.ts` · `IPC_CONTRACT.md` |
| state/contract | `AgentTaskPatch` 5필드 | **7필드** (`activeForm`·`addBlocks`) | 두 필드가 파서에서 소실된다 | MD-01 / `task-tool.ts` · VP-05 |
| state/contract | `TaskBoardItem.title` 단일 | `title`(표시 파생) + `subject`(안정) | a11y 라벨이 상태에 따라 흔들리면 안 된다(D-007) | MD-03 / VP-03·VP-04 |
| state/contract | `TaskBoardStatus` 6종 | **7종** (`paused`) | `killed` 는 `stopped` 로 접지만 `paused` 는 접을 대상이 없다 | SD-03 / VP-11 |
| error/lifecycle | 정착 경로 2 (notification · watchdog) | **3** (+ 레벨 REPLACE) | 채널 생존 시 더 빠르게 유령을 없앤다 · watchdog 은 직교하므로 유지 | SD-02 / VP-08·VP-10 |
| **제어 표면** | 채널 1 (`chatStopSubagent`) · 행 버튼 1종(중단) | 채널 **2** (+`chatBackgroundSubagent`) · 행 버튼 **2종**(중단·전환) | `SessionRuntime.backgroundTask` 가 소비자 0인 채 있었다 — 새로 만들지 않고 **배선을 잇는다** | AR-04·R-07 / VP-16·VP-17 · 신규 IPC 핸들러 |
| **제어 가용성** | 중단 = `in_progress` 만 | 중단 = `in_progress`\|`paused` · 전환 = foreground 진행 중만 | SDK 에 resume 이 없어 `paused` 의 탈출구가 중단뿐이다(D-022) · 효과 없는 버튼을 띄우지 않는다(D-021) | SD-03·MD-04 / VP-15·VP-20 |
| test seam/관측점 | fold 순수 · tracker 통합 | **동일 seam 재사용** + 술어 `canBackgroundTask` 순수 | 새 seam 을 만들 이유가 없다 — 전부 기존 순수 경계 안이다 | MD-01·MD-02·MD-04 / 기존 스위트 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/src/shared/task-tool.ts` | 도구 이름 술어 + 관측 파싱 (양 프로세스 안전) | 도구명·args·구조화 출력 → `TaskToolObservation \| null` | main 어댑터 · renderer fold · **renderer transcript 레지스트리(신규)** |
| `app/src/main/adapters/claude-map.ts` | SDK 메시지 → NormalizedEvent | SDKMessage + ctx → 이벤트 배열 | 어댑터 |
| `app/src/main/features/chat/background-tasks.ts` | background 추적·정착 | 이벤트 → tracker 상태 | coordinator · chat-turn |
| `app/src/renderer/…/lib/taskBoard.ts` | 목록 파생·순서·표시 상태 SSOT | messages + transient → `TaskBoardItem[]` | 두 타일 |
| `app/src/renderer/…/transcript/registry.ts` | 도구 → 본문 컴포넌트 매칭 | ToolCall → Body | `ToolCard` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| EP-01 · AR-01/VP-01 | `init.tools` → `patch.agentTools` — **부재는 키를 싣지 않는다** | `claude-map.ts` init 분기 | 어댑터 | `init` 도착 시 | 부재를 `[]` 로 실으면 멀쩡한 CLI 에 거짓 안내가 뜬다 |
| EP-02 · SD-01/VP-02 | `patch` 병합은 **누락 = 기존값 보존** | reducer 의 `session.updated` 처리 | renderer reducer | 매 `session.updated` | 덮어쓰면 두 번째 이벤트가 게이트를 지운다 |
| EP-03 · MD-01/VP-05 | `activeForm` 은 **입력에서만**, `active_form` 별칭 허용 | `task-tool.ts` `readCreate`·`readUpdate` | 파서 | 매 Task 도구 결과 | 출력에서 읽으려 하면 항상 `undefined` 다(spec §2.2·§2.4) |
| EP-04 · MD-02/VP-06·VP-07·VP-14 | 역방향 가산은 **대상 존재 시에만**, 자기 간선 배제, 스냅샷이 교체 | `taskBoard.ts` fold 루프 | fold | 매 관측 | 없는 대상에 stub 을 만들면 유령 행이 생긴다 |
| EP-05 · MD-03/VP-03·VP-04 | `title` = 표시 파생, `subject` = 안정 이름. **`aria-label` 은 `subject`** | `taskBoard.ts` `agentItem` + `TaskTileContent` | fold + 렌더 | 매 렌더 | 둘을 맞바꾸면 스크린리더가 같은 항목을 다르게 읽는다 |
| EP-06 · AR-02/VP-08·VP-09 | `task_id → tool_use_id` 매핑분만 이벤트에 싣는다 | `claude-map.ts` `taskToolUseById` | 어댑터 | 매 `background_tasks_changed` | 매핑 없는 id 를 실으면 소비자가 키를 못 찾는다 |
| EP-07 · SD-02/VP-08 | **첫 payload 는 기준선**이고 프로세스 (재)기동 시 리셋 | tracker 의 레벨 상태 | tracker | 매 payload · 프로세스 수명 경계 | 첫 payload 로 정착시키면 시작 직후 살아 있는 태스크가 죽는다 |
| EP-08 · R-91/VP-10 | watchdog 정착 경로 **불변** | `stop-subagent.ts` | main | timeout 시 | 레벨 신호로 대체하면 채널 사망 축이 열린다(D-011) |
| EP-09 · AR-03/VP-11·VP-12 | `killed` → `stopped` 동형 · `paused` 는 정착이 아님 | `claude-map.ts` `task_updated` 분기 | 어댑터 | 매 `task_updated` | `paused` 를 정착으로 읽으면 재개된 태스크가 돌아오지 않는다 |
| EP-10 · SD-03/VP-11·VP-15 | `paused` 도 **중단 가능** — `in_progress` 와 나란히 허용, `stopping` 만 제외. **두 타일 모두** | `taskBoard.ts` `canStopBackgroundStatus` | 두 타일 | 매 렌더 | 숨기면 SDK 에 resume 이 없어 사용자가 멈춘 태스크를 없앨 방법을 잃는다(D-022) |
| EP-11 · R-06/VP-13 | 렌더 레지스트리의 match 술어는 `task-tool.ts` 가 export 하는 **할 일 목록 4종 부분집합**을 쓴다 — 이름 사본 금지, `TASK_TOOL_NAMES`(6종) 그대로 쓰기도 금지 | `app/src/shared/task-tool.ts` (4종 부분집합 + 6종 전량, 같은 파일이 둘 다 소유) | 레지스트리 | 등록 시점 | 사본을 만들면 CLI 가 이름을 바꿀 때 두 곳이 갈라진다. 6종을 그대로 쓰면 구조화 출력이 없는 `TaskOutput`·`TaskStop` 이 빈 전용 본문을 받는다(D-025) |
| EP-12 · R-07·AR-04/VP-16·VP-17 | 전환 버튼은 **두 타일 모두**에 같은 술어로 붙는다 | `taskBoard.ts` `canBackgroundTask` | 두 타일 | 매 렌더 | 한 타일에만 넣으면 같은 항목이 화면마다 다른 제어를 갖는다 |
| EP-13 · MD-04/VP-16·VP-20 | `canBackgroundTask` = background 종류 **AND** 진행 중 **AND** `asyncLaunched` 아님 | `taskBoard.ts` | 술어 | 매 렌더 | 이미 background 인 행에 붙으면 눌러도 `false` 만 돌아오는 죽은 버튼이 된다(D-021) |
| EP-14 · AR-04·SD-04/VP-17·VP-18 | 전환 요청은 **`toolUseId` 단건**이고 실패는 삼키지 않는다 | 신규 IPC 핸들러 + `session-runtime` | main | 클릭 시 | 인자를 흘리면 다른 태스크가 백그라운드로 간다. 실패를 삼키면 화면이 "아무 일도 안 일어남" 이 된다 |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 공유 방법: 도구 이름은 `TASK_TOOL_NAMES` 하나(EP-11) · 표시 상태 규칙은 `backgroundBoardStatus` 하나(EP-10, 호출부 2곳 실측).
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: **없음** — 모든 행이 자기 실패 결과를 직접 서술한다.
- 선택적 필드의 `true/false/undefined` 의미: `agentTools` — `undefined`=판정 불가(안내 없음) · 배열에 `TaskCreate` 없음=기능 없음(안내). `is_backgrounded` — `undefined`=무변경, `false`=foreground 복귀. `patch` 의 모든 키는 **누락 = 무변경**이다(spec §4.4).
- 외부 SDK 경계의 실제 요구 타입/의미: spec §2·§4 가 정본. `as any`/`as never` 가 필요한 경계는 **없다** — 전부 읽기 방향이고 SDK 타입이 구조적으로 대입 가능하다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | wire 계약 | `session.updated.patch` 에 `agentTools?`·`cliVersion?` · `subagent.task` 에 `phase:'updated'`·`runState?`·`isBackgrounded?`·`errorMessage?` · 신규 variant `subagent.backgroundSet` · **신규 채널 `chatBackgroundSubagent`** | 타입만 |
| `app/src/main/adapters/types.ts` | 포트 | `backgroundTask(toolUseId?: string)` — optional 로 넓혀 전량 전환을 나중에 열 수 있게 남긴다(D-020) | 타입만 |
| `app/src/main/app/handlers/` | IPC | `chatBackgroundSubagent` 핸들러 신설 → `SessionRuntime.backgroundTask` 배선(죽은 표면 연결) | 통합 |
| `app/src/renderer/…/shared/api/ipc.ts` + preload | renderer API | `backgroundSubagent(sessionId, toolUseId)` 노출 | 통합 |
| `app/src/shared/task-tool.ts` | 관측 파싱 + 이름 SSOT | `AgentTaskPatch` 에 `activeForm?`·`addBlocks?` · `readCreate`/`readUpdate` 에서 별칭 포함 읽기 · **할 일 목록 4종 부분집합 export 신설**(D-025) | 순수 단위 |
| `app/src/main/adapters/claude-map.ts` | 정규화 | `init` 확장 · `task_updated`·`background_tasks_changed` 분기 신설 · `killed`→`stopped` 매핑 | 순수 단위 |
| `app/src/main/features/chat/background-tasks.ts` | 추적·정착 | 레벨 REPLACE + 첫-payload 기준선 + 프로세스 리셋 | 순수 단위 (tracker 는 electron 비의존) |
| `app/src/main/app/chat-turn/…` | 이벤트 배선 | `subagent.backgroundSet` → tracker 호출 | 통합 |
| `app/src/renderer/…/reducer/chatReducer.ts` | 세션 상태 | `agentTools`·`cliVersion` 보존 병합 | 순수 단위 |
| `app/src/renderer/…/store/chatStore.ts` | transient | `pausedBackgroundIds` 집합 + `errorMessage` 흡수 | 순수 단위 |
| `app/src/renderer/…/lib/taskBoard.ts` | 파생 SSOT | `activeForm` 병합 · 역방향 가산 · `title`/`subject` 분리 · `paused` 상태 · **`canStopBackgroundStatus` 에 `paused` 허용** · **`canBackgroundTask` 신설** | 순수 단위 |
| `app/src/renderer/…/rightpanel/TaskTileContent.tsx` | 표시·제어 | 빈 상태 3갈래 · `aria-label`=`subject` · **행/상세에 전환 버튼**(중단 버튼 옆) | 렌더 |
| `app/src/renderer/…/rightpanel/SubAgentTileContent.tsx` | 표시·제어 | `paused` 라벨(중단 버튼 유지) · **전환 버튼** | 렌더 |
| `app/src/renderer/…/transcript/registry.ts` + 신규 Body | 대화록 | 할 일 목록 4종 전용 본문 + 실패 `error`. `TaskOutput`·`TaskStop` 은 폴백 유지(D-025) | 렌더 |
| `app/src/renderer/…/i18n/resources/{ko,en}.ts` | 문구 | 안내 문구 · `일시정지` · Task 도구 라벨 4종 · **전환 버튼 라벨·aria·실패 문구** | — |
| `docs/IPC_CONTRACT.md` | 채널 계약 | patch 확장 + 신규 variant | 문서 게이트 |
| `docs/generated/inventory.md` | 생성물 | **재생성** (variant 증가) | `check-doc-inventory.mjs --check` |
| `docs/INDEX.md` | 라우팅 | `claude-taskxxx-spec.md` 행 추가 | — |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: 신규 없음. `task-tool.ts`·`taskBoard.ts` 는 이미 L0 순수이고 `BackgroundTaskTracker` 는 electron 을 import 하지 않는다(`background-tasks.ts` — DB·ipc 비의존).
- 기존 메커니즘 재사용 시 형상/시점 적합성: `pausedBackgroundIds` 는 `stoppingBackgroundIds` 와 **같은 형상**(`ReadonlySet<string>` transient)이고 적용 시점도 같다(렌더 파생) — 선례가 그대로 맞는다.
- 순서를 관측할 훅/로그/주입 경계: AT-15 의 "첫 payload" 순서는 tracker 에 payload 를 직접 순차 주입해 관측한다 — 별도 훅이 필요 없다.

## 12. End-to-end 영향

### producer → consumer

```text
SDK(producer) → claude-map(정규화) → bus → coordinator/tracker(상태) → reducer/store → taskBoard(파생) → 두 타일 + transcript(consumer)
```

- producer 기준: SDK 가 `undefined` 로 말하는 것은 "모른다" 이고 `[]`·`false` 로 말하는 것은 "없다" 다(§10).
- consumer 파생 규칙: 표시 상태는 `backgroundBoardStatus` 하나가 정한다. 두 타일이 각자 계산하지 않는다.
- 파생 가능한 합성값이 정본을 우회하는가: **아니다.** `title` 은 `subject`+`status`+`activeForm` 에서 파생하지만 소유자가 `agentItem` 하나이고, 컴포넌트는 계산하지 않고 받는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `session.updated` 소비자 (reducer) | patch 키 2개 증가 — 기존 키 처리 불변 | AC4 |
| NormalizedEvent 소비자 전체 | variant 1개 증가 — 미처리 variant 는 기존대로 무시된다 | AC14·AC15 |
| `backgroundBoardStatus` 호출부 2곳 | 인자 1개 증가 — 두 곳 모두 갱신 필요 | AC18·AC19 |
| `TaskBoardItem` 소비자 (두 타일 + `taskDetailRows`) | 필드 1개 증가(`subject`) — 기존 필드 불변 | AC8 |
| `canStopBackgroundStatus` 호출부 2곳 | 술어가 넓어진다(`paused` 허용) — 두 곳 모두 닿는다 | AC18 |
| `SessionRuntime.backgroundTask` | 소비자 0 → **1**(신규 IPC 핸들러). 시그니처는 optional 로 넓어질 뿐 기존 호출부 3곳 불변 | AC25 |
| preload / renderer API 표면 | 메서드 1개 증가 — 기존 메서드 불변 | AC25·AC26 |
| `docs/generated/inventory.md` | **variant · 채널 · 핸들러 수 증가** → 재생성 필요 | §7-A 운영 gate |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 레벨 집합은 세션별로 **미확립** 상태에서 시작한다 — 첫 payload 가 기준선을 세운다(EP-07).
- 취소/중단: 수명주기 불변(`중단 중` → SDK 확정 → 정착, 0204 D-005·D-006). **가용 범위만 넓어진다** — `paused` 에서도 누를 수 있다(D-022).
- 전환(foreground → background): 요청은 **비정착 연산**이다 — 성공하면 그 행의 전환 버튼만 사라지고 상태·진행은 그대로다. 중단과 달리 대기·watchdog 이 없다(SDK 가 즉시 boolean 을 준다).
- 전환 실패: 삼키지 않는다 — 포트 reject → IPC reject → renderer 가 요청 표식을 되돌리고 사유를 낸다(EP-14). `false` 반환(대상 없음)도 실패로 취급해 버튼을 되살린다.
- 종료/quit/crash/renderer-gone: CLI 프로세스가 재기동하면 레벨 집합을 **미확립로 되돌린다** — 그러지 않으면 구 프로세스의 집합이 새 프로세스의 태스크를 죽인다(D-012).
- retry/timeout/partial failure: watchdog 유지(D-011). 레벨 신호가 안 와도 기존 타임아웃이 정착시킨다.
- cleanup/rollback: 없음 — 이번 변경에 되돌릴 부작용이 있는 쓰기가 없다.
- **다중 저장소 쓰기**: **해당 없음.** 이번 변경의 상태는 전부 프로세스 내 메모리(tracker transient · store transient · fold 파생)다. DB 마이그레이션 0개 · 파일 쓰기 0개. 단 **산출물 문서 사본은 둘**이다 — 이 `plan.md` 의 상태와 `INDEX.md` 보드 행이 같은 판정을 들고 있으므로 상태 전이마다 **둘 다** 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: `background_tasks_changed` 의 `tasks[]` 는 동시 실행 서브에이전트 수에 비례한다 — 실측 상한이 없으나 payload 는 id·type·description 만 싣고 렌더가 아니라 집합 연산에만 쓰인다. 출력 길이 증가 **0**.
- 새 요청 수: **0** — 이번 변경은 전부 수신 방향이다. polling 을 만들지 않는다(0204 D-011 유지).
- 구조적 목표(줄/파일/모듈 수): 없음.
- 캐시/snapshot/호출 축소로 잃는 부수 효과: 없음 — 최적화를 도입하지 않는다.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port/schema/config: **없음.**
- 구현 문서: [`docs/claude-taskxxx-spec.md`](../../claude-taskxxx-spec.md) 는 외부 계약의 *해설 미러* 이지 외부 구현자용 포트가 아니다.
- **shape 검증 — 정식화 턴에 완료.** `TaskCreateInput`·`TaskUpdateInput`·`TaskUpdateOutput` 으로 선언한 페이로드(`activeForm`·`addBlocks`·`error`·`statusChange` 포함)를 `readTaskToolObservation` 에 대입해 `tsc`·vitest 를 통과시켰다 — **4/4 green**, 프로브는 확인 후 삭제했다. 구현 턴은 같은 페이로드를 정식 케이스로 승격하면 된다.
- **semantics 검증**: `undefined` vs `[]` vs `false` 의미(§10)를 AC3·AC11·AC15 가 각각 잠근다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| main 에 Task 스토어를 두지 않는다 | 0204 D-002 | §9 TO-BE — fold 파생 유지 | **유지** |
| `TaskList` 는 전체 스냅샷 | 0204 D-008 | §10 EP-04 — 스냅샷이 역방향 가산분을 교체 | **유지** |
| `blocks` 를 저장하지 않는다 | 0204 D-028 | D-009 — 역방향으로 해석해 `blockedBy` 에만 저장 | **유지** (결정 불변, 이유 문장은 D-009 가 성립시킴) |
| `TaskOutput` 의존 금지·polling 금지 | 0204 D-010·D-011 | §14 — 새 요청 0 | **유지** |
| `중단 중` 경유 정착 + watchdog | 0204 D-005·D-006 | D-011 — watchdog 유지 | **유지** |
| 중단 요청 실패 시 `진행 중` 복구 + 사유 | 0204 D-005 · `stop-subagent.ts:82-86` | §13 — 전환 실패가 **같은 규칙**을 따른다 | **유지·확장 적용** |
| 중단 버튼은 진행 중일 때만 | 0204 · `canStopBackgroundStatus` | D-022 — `paused` 도 허용하도록 **넓힌다** | **변경** — SDK 에 resume 이 없어 `paused` 의 유일한 탈출구다(spec §5.3) |
| 위험 도구만 승인 카드로 surface | `risky-tools.ts` 헤더 | D-024 — Task 도구를 넣지 않는다 | **유지** |
| 백그라운드 전환은 중단 앞의 내부 폴백 | `stop-subagent.ts:55` 주석 | R-07 — 사용자 진입점을 **추가**한다(내부 폴백은 그대로) | **유지·확장 적용** |
| `skip_transcript` 드롭 | 0204 D-013 | §6 비범위에 없음 — 건드리지 않는다 | **유지** |
| 새 variant 대신 patch 에 optional | `ipc.ts:447` (0211) | D-017 | **유지·확장 적용** |
| 코드에서 셀 수 있는 수치를 문서에 적지 않는다 | `docs/AGENTS.md §작성규칙 2` | §7-A 운영 gate — inventory 재생성 | **유지** |
| IPC 채널 변경은 같은 PR 에서 `IPC_CONTRACT.md` 갱신 | `docs/AGENTS.md §작성규칙 6` | §11 파일 목록 | **유지** |
| 외부 문서 미러는 2단 | `docs/AGENTS.md §작성규칙 7` | D-002 — 해설 미러 신설 | **유지** |
| ABI-중립 기본 게이트 = lint + typecheck | `app/AGENTS.md:124` | §19 | **유지** |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 레벨 신호가 살아 있는 태스크를 죽인다 | 첫 payload 기준선(EP-07) + 매핑분 한정(EP-06) + 프로세스 리셋(D-012). 세 장치가 각각 다른 축을 막는다 |
| `title`/`subject` 분리가 기존 소비처를 놓친다 | `TaskBoardItem` 소비처 전수(§12 표) — 두 타일 + `taskDetailRows`. 형제 맞바꿈 변이를 VP-03·VP-04 가 심는다 |
| `paused` 가 두 타일 중 한 곳만 반영된다 | `backgroundBoardStatus` 단일 규칙(EP-10) + 호출부 2곳 실측 |
| 안내 문구가 정상 CLI 에 뜬다 | `undefined` 와 미포함을 가르는 D-005 + AC3 |
| variant·채널 증가로 문서 게이트가 깨진다 | §7-A 운영 gate 에 재생성 명령을 명시 |
| "모든 기능 지원" 대비 3건 축소 | §6 표에 근거와 "나중에 해도 안 비싸다" 판정. 사용자 확인 대상 |
| 전환 버튼이 실제로 뜰 일이 드물다 | 서브에이전트는 기본이 background 라(spec §5.2) foreground 행은 모델이 `run_in_background:false` 를 준 경우뿐이다. **버튼이 안 보이는 것이 정상**이며 AT-24 가 그 정상을 단언한다 |
| 사용자가 전환을 중단으로 오해한다 | 라벨·툴팁이 "작업은 계속됩니다" 를 말한다(i18n). 두 버튼이 같은 행에 나란히 붙으므로 문구가 구분의 유일한 수단이다 |
| `paused` 중단 허용이 SDK 에서 거부된다 | 실패 경로가 이미 있다 — reject → 복구(EP-14·R-92). 미검증 가정이므로 구현 턴이 실제 거동을 관측해 보고한다 |
| 0211 과 같은 파일을 동시에 고친다 | **완화 못 한다 — 사실로 적는다.** 0211(`claude/…-implementation-review`)이 `ipc.ts`·`taskBoard.ts`·두 타일을 같은 시기에 고치고 있다. 이 handoff 는 `main` 기준이라 두 갈래가 합쳐질 때 그 4파일에서 충돌한다. 순서는 사람이 정한다 — 먼저 합쳐진 쪽이 기준이 되고 뒤가 재기저한다 |

- 되돌리기 어려운 결정: `subagent.backgroundSet` variant 이름과 `chatBackgroundSubagent` 채널 이름 — 둘 다 wire 계약이라 나중에 바꾸면 소비처가 함께 움직여야 한다. 기존 `subagent.task`·`chatStopSubagent` 접두를 따라 네임스페이스를 맞췄다.
- 신규 의존성: **0개.** 사용자 승인 불필요.
- **미검증 가정 1건**: `paused` 상태에서 `stopTask` 가 성공하는지 SDK 문서·타입 어디에도 없다. D-022 는 "사용자에게 탈출구가 있어야 한다" 는 제품 판단이고, SDK 가 거부하면 실패 경로가 그것을 화면에 말한다.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/ipc.ts` · `app/src/shared/task-tool.ts`
- `app/src/main/adapters/{claude-map.ts,types.ts}` · `app/src/main/features/chat/background-tasks.ts` · `app/src/main/app/{chat-turn,handlers}/` · `app/src/main/features/sessions/session-runtime.ts`(배선 대상)
- `app/src/preload/` (전환 API 노출)
- `app/src/renderer/src/features/chat/{reducer,store,lib}/` · `.../components/rightpanel/{TaskTileContent,SubAgentTileContent}.tsx` · `.../components/transcript/registry.ts` + 신규 Body · `.../shared/api/ipc.ts`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md`(재생성) · `docs/INDEX.md` · `docs/claude-taskxxx-spec.md`(이번 턴 신설)
- `docs/handoff/INDEX.md` · 본 `plan.md`

## 19. 게이트

- 적용할 하위 가이드: [`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`](../../../app/AGENTS.md) · [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md)(레이어 DAG) · [`app/src/renderer/AGENTS.md`](../../../app/src/renderer/AGENTS.md)(4-layer 의존 방향)
- ABI/네트워크 등 환경 제약: DB 스위트를 건드리지 않으므로 `npm test` 를 쓰지 않는다 — ABI 를 뒤집을 이유가 없다.
- **선행: `cd app && npm ci`** — 워크트리는 `node_modules` 를 물려받지 않는다. **이 워크트리는 설치 완료**(2026-09-01)이고 변경 전 초록 기준선은 §7-A 에 있다.
- 기본 정적 게이트: `npm run lint && npm run typecheck`
- 관련 테스트: `./node_modules/.bin/vitest run src/shared/task-tool.test.ts src/renderer/src/features/chat src/main/adapters src/main/features/chat src/main/app`
- IPC 배선 위생: `app/src/main/AGENTS.md` 의 레이어 DAG 를 지킨다 — 신규 핸들러는 `app/handlers/` 에 두고 feature 교차 import 를 만들지 않는다(eslint-plugin-boundaries 강제)
- 문서 게이트: `node scripts/check-doc-inventory.mjs` (재생성) → `node scripts/check-doc-inventory.mjs --check`
- 사람 실기: **없음** (§7 주의사항 — 신규 레이아웃이 없다)

## READY self-review

- [x] 여러 턴의 결정이 Decision Ledger 에 `ACTIVE/SUPERSEDED/OPEN` 으로 보존되어 있다 — D-001~D-025 전부 ACTIVE, SUPERSEDED 0건 · OPEN 0건. D-022(같은 턴 자체 정정)·D-025(정식화 턴)의 근거는 갱신 메모가 남긴다.
- [x] Part I 만 읽어도 완료 상태를 설명할 수 있다 — §5 흐름(관측 6 + 제어 3) + §7 AC 26행.
- [x] 조건절·이유절을 재해석하지 않았다 — 사용자 4결정 + 제어 축 지시를 §2·§3 에 원문으로 인용했다("이에 대한 것들도 모두 포함해야한다" → D-019).
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다 — §5 상태표 14행이 AC1~AC26 과 §9 TO-BE 에 각각 대응한다.
- [x] **제어 표면을 전수 대조했다** — SDK `Query` 3종 + `canUseTool` 축까지 §8 에 관측으로 남겼고, SDK 에 API 가 없는 3건(할 일 편집·pause/resume·할 일 개별 중단)을 §6 에서 "미룬 것이 아니라 불가능" 으로 구분했다.
- [x] AS-IS 와 TO-BE 가 모두 있고 같은 축/구체성이다 — §9 두 블록이 같은 파이프라인 표기를 쓴다.
- [x] Delta 각 변경이 구현 파일 또는 AC 에 추적 가능하다 — §9 Delta 8행 전부 `V / 구현·검증 연결` 칸을 가진다.
- [x] AS-IS 에서 사라진 책임 없음 — 순수 확장이라 삭제/이동 0건(§9 TO-BE 명시).
- [x] 수치·전칭·외부 규약·앵커·기존 테스트 인용을 실측했다 — §8 검산 절. **정식화 턴에 이 베이스에서 전부 재측정**했다(SDK 0.3.220 표면 여섯 · 좌표 5건 정정 · patch 필드 수 정정 · `stop-subagent.test.ts` 9케이스 열거). 미확인 인용 **0건**.
- [x] **인용한 게이트를 직접 돌렸다** — typecheck 3구성 exit 0 · lint 0 error/1 warning(기존분) · 대상 스위트 103파일 1054케이스 green · doc-inventory `--check` exit 0 · 알려진 기준선의 flaky 성질과 두 실패 형태를 실측 확정. 인용만 한 게이트는 없다(§7-A).
- [x] **결손을 프로덕션 코드에서 재현했다** — SDK 타입 페이로드 프로브 4/4 green 으로 네 결손을 관측하고 삭제했다(§8 · §15). AC 가 겨냥하는 실패가 실제로 존재한다.
- [x] **베이스가 초안 작성 브랜치와 다르다는 사실을 규범에 반영했다** — 메타 `기준 브랜치` 행 · §8 좌표 재측정 · §7-A 기준선 후보의 미측정 표기 · §17 의 0211 충돌 행.
- [x] **같은 사실을 여러 절이 서술하는 곳을 대조했다** — §4 "새 IPC 채널 0개" ↔ AR-04·§10 EP-14·§11 의 신규 채널 1개가 **정면 모순**이라 §4 를 정정했다(초안이 제어 축 반환 전 문장을 남겼다). R-06 "4종" ↔ EP-11 "`TASK_TOOL_NAMES` 재사용"(6종) 모순은 D-025 로 닫았다.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 가진다 — §7 표 3개 칸.
- [x] Baseline V 를 썼고 유효 V 를 재구성할 수 있다 — §7-A, 상속 없음 근거 포함.
- [x] 모든 `NEW`·`CHANGED` node 에 같은 레벨 `REQUIRED` pair 가 있다 — R-01~R-07·SD-01~04·AR-01~04·MD-01~04 각각 VP 보유(pair 20).
- [x] 영향받은 `INHERITED` node 는 `REGRESSION` 이다 — R-90(VP-14) · R-91(VP-10) · R-92(VP-19) · MD-90(VP-07). `NOT_REQUIRED` 0건.
- [x] 각 pair 가 production path · §10 전수 · 직접 oracle 을 갖고, 적대 증거는 VP-03·VP-04·VP-15 만 선택했다(형제 맞바꿈 2 + `paused` 항 제거 1, 각각 이유 명시).
- [x] 현재 변경 산출물의 운영 gate 가 열거됐고 무관한 기존 실패를 blocking 으로 만들지 않는다 — git/worktree 타임아웃을 알려진 기준선으로 분리했다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 사람 실기 0건.
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — 부재 단언 5건 전부 같은 pair 안에 양성 짝이 있다(§7 주의사항).
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다 — §10 EP-01~EP-14 · §11 seam 칸.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 8행(제어 배선 3행 포함).
- [x] producer/consumer 양쪽 의미를 확인했다 — §12 `undefined`/`[]`/`false` 규칙.
- [x] 상한·총량·one-way door 를 계산했다 — §14 · §17(variant 이름).
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다 — `npm test` 미사용, `vitest run` 직접 호출(§19).
- [x] 본문 완성 후 교차검증했고 `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 관측으로 적었다 — 충돌 0, 확인 쌍 13개 열거.
- [x] 산출물 문장 규칙을 지켰다 — 판정 먼저, 표 한 칸 3줄 이내, Part I/II 사실 중복 없음(SDK 필드는 spec 인용으로 대체).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: 
- 이견 / 현실성 문제: 
- ACTIVE Decision 과 충돌하는 설계 발견: 

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| | | | | | |

- §10 에 없는데 같은 불변식이 필요했던 지점: 

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| | | | | |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| | | | | |

- 분모 검산: 
- 덮개 회귀: 

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | | |
| seam 을 만들려고 production 을 재배치했는가 | | |
| 이번에 만든 실패 경로가 §5 상태 전이표의 어느 행인가 | | |
| 실패가 화면에서 "아무 일도 안 일어남" 으로 보이지 않는가 | | |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | | |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| | | | |

### 설계 대비 명시적 차이

- plan 이 지정한 것과 다르게 구현한 것과 그 이유: 

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | | |
| 공유 | | |
| 재진입 | | |
| 다른 무효화 축 | | |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | |
| 실행 명령 | |
| 관측한 게이트 산출 | |
| V-pair 자기확인 | |
| 강제 지점 전수 | |
| AC 자기보고 | |
| 합계 검산 | |
| 블로커 / 역질문 | |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: 
- 반복해서 부딪히는 환경 한계: 
- 현재 라운드 수: 

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| | | | | | |
