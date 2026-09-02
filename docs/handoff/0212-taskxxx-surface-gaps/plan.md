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
| 상태 | DRAFT → READY → (r1 `RETURN_TO_PLAN`) → **READY (ΔV1)** |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | `0212:V1 @e38f545e` — Baseline V 근거는 §7-A |
| 이번 V revision | `ΔV1` — r1 verify 의 `PLAN_GAP` D4 정정. 변경 행은 §7-A `ΔV1` 절 |
| 유효 V | `V1 + ΔV1` |

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
| D-026 | 중단 정착이 나르는 **사유와 표시 문구는 서로 다른 키**다 — `cause` = SDK 가 준 원인(`task_updated.patch.error`), `message` = transcript 용 기본 문장. 소비자는 `reason:'aborted'` 면 `cause` 만 사유로 읽는다 | AC21 과 상속 표시 계약(0204 D-024 · AT-31)이 정착 `message` 한 자리를 두고 반대를 요구했다 — `killed` 는 사용자가 멈춘 것이 아니라 `patch.error` 가 유일한 원인 서술인데, 그것을 `message` 에 덮으면 **사용자 중단 행까지** 생산자 문장으로 바뀐다. 0204 D11 이 이 자리를 `open` 으로 두며 "D-024 가 `aborted` 분기를 정본으로 삼았으므로 **규범 정정이 선행**" 이라 적었다 | r1 verify D4 (`1f0c3da2`) · 0204 D11 | ACTIVE | 0204 D-024 를 **보완**(대체 아님) — `failed` 분기의 규칙은 그대로다 |
| D-027 | 레벨 REPLACE 로 사라진 항목은 기존 `failed` status 로 정착시키고 **무슨 일이 있었는지 그대로 말한다** — 새 표시 상태를 만들지 않는다 | 채널 사망 정착의 선례와 같은 자리다. 새 status 를 늘리면 두 타일의 라벨·그룹·아이콘이 함께 갈라진다(D-015 와 같은 이유) | r1 구현 P3 → r1 verify D4 동반 | ACTIVE | — |

### 갱신 메모

- **ΔV1 턴(r1 `RETURN_TO_PLAN` 후) 추가 결정: D-026 · D-027.** 둘 다 verify D4 가 연 자리다 — 중단 사유의 키 분리와 레벨 REPLACE 정착의 표시 규칙에 규범 행이 없었다. **SUPERSEDED 0건** — D-026 은 0204 D-024 를 보완하고 대체하지 않는다(`failed` 분기 규칙 불변, 렌더 테스트 두 케이스가 양쪽을 동시에 잠근다).
- **ΔV1 턴 조사 누락 1건**: §16 이 0204 의 ACTIVE Decision 은 전수 대조했으나 **0204 의 `open` 파생 이슈는 읽지 않았다.** D11 이 바로 이 자리에 "규범 정정이 선행" 을 적은 채 열려 있었고, 그래서 AC21 ↔ 상속 표시 계약의 충돌이 설계 시점에 보이지 않았다.
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
| `task_updated(killed)` · `patch.error` 있음 | `stopped` 동형 정착 + 사유를 `cause` 로 실음 | 행이 `중단됨` + **SDK 가 준 사유 문구**(D-026) |
| `task_updated(killed)` · `patch.error` 없음 | `stopped` 동형 정착, `cause` 키 없음 | 행이 `중단됨` + `사용자에 의해 중단됨`(0204 AT-31 유지) |
| 레벨 REPLACE 로 집합에서 사라짐 | 기존 `failed` status 로 정착(새 status 없음) | 행이 `실패` + `완료 통지 없이 백그라운드 작업 목록에서 사라졌습니다.`(D-027) |
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
| R-04 | AT-14 / AC14 **(ΔV1 정정)** | `background_tasks_changed` 의 집합에 없는 추적 항목이 **정착한다** | **관측 지점은 coordinator 가 내는 정착이다**(ΔV1) — `subagent.backgroundSet` 이벤트를 coordinator 에 2회 넣어 첫 payload 는 정착 0건, 둘째에서 빠진 항목이 `status:'failed'` · `stopLive:false` 로 정착하는지 단언한다. `applyLiveSet` 반환값만 읽는 단언은 이 AC 를 닫지 않는다 | SDK system → `claudeToNormalized` → `subagent.backgroundSet` → coordinator → `settleTaskSubset` |
| R-04 | AT-15 / AC15 **(ΔV1 정정)** | 첫 payload 는 아무것도 정착시키지 않는다 | 두 층 — tracker 단위로 `applyLiveSet` 반환이 빈 배열이고, **coordinator 에서 정착 방출이 0건**이다(AT-14 의 음성 짝) | 같은 경로 |
| R-04 | AT-16 / AC16 | 매핑 없는 `task_id` 는 무시한다 | 매핑 단위 — `taskToolUseById` 에 없는 `task_id` 만 든 payload → `toolUseIds` 빈 배열 | `claudeToNormalized` |
| R-04 | AT-17 / AC17 | watchdog 정착 경로가 그대로 동작한다 (회귀) | 기존 `stop-subagent` 테스트가 green — 레벨 신호 없이 timeout 만으로 정착 | `stopSubagentTask` |
| R-05 | AT-18 / AC18 | `paused` 행은 `일시정지` 라벨이고 **중단 버튼이 유지된다** | 렌더 테스트 — paused 집합에 든 background 행 → 라벨 일치 **+ 중단 버튼 존재** | `task_updated` → store transient → `backgroundBoardStatus` → 두 타일 |
| R-05 | AT-19 / AC19 | `running` 으로 돌아오면 라벨이 `진행 중` 으로 복귀한다 | 렌더 테스트 — paused 해제 후 라벨 복귀 + 버튼 계속 존재 | 같은 경로 |
| R-05 | AT-20 / AC20 | `killed` 는 `중단됨` 으로 정착한다 | 매핑 단위 — `patch.status:'killed'` → `status:'stopped'` 인 `subagent.task` | `claudeToNormalized` |
| R-05 | AT-21 / AC21 **(ΔV1 정정)** | `patch.error` 가 정착 사유로 보인다 — 사유는 `cause` 키가 나른다(D-026) | 생산자 단위 — `status:'stopped'` + `summary` 정착이 `result.cause` 를 만든다. 소비자 렌더 — `cause` 를 실은 정착 → 행이 그 문구를 보인다. **두 층을 각각 단언한다** | `task_updated` → `claudeToNormalized`(`summary`) → `subagent-settlement`(`cause`) → `parts.settlementMessageFromCall` → 행 |
| R-93 | AT-27 / AC27 **(ΔV1 신설)** | 사유가 없는 중단 행은 UI 문구 `사용자에 의해 중단됨` 을 보인다 (0204 AT-31 회귀) | 렌더 — `cause` 없는 `reason:'aborted'` 정착 → UI 문구가 보이고 생산자 기본 문장(`서브에이전트가 중단되었습니다.`)은 보이지 않는다 | 같은 경로 — `cause` 부재 분기 |
| R-06 | AT-22 / AC22 | 할 일 목록 4종(`TaskCreate`·`TaskGet`·`TaskUpdate`·`TaskList`)이 대화록에서 전용 본문으로 읽히고 실패 `error` 를 보인다. `TaskOutput`·`TaskStop` 은 **기존 폴백 그대로**다(D-025) | 렌더 테스트 — `TaskUpdate` 실패 카드가 `error` 문구를, 성공 카드가 `subject`·`status` 를 보인다. **관측 지점은 `toolRendererRegistry.resolve` 다**(ΔV1) — 6종 전량을 그것에 통과시켜 4종은 `task_list`, `TaskOutput`·`TaskStop` 은 폴백 kind 임을 단언한다. Body 를 직접 호출하는 단언은 이 AC 를 닫지 않는다 | tool parts → `registry.ts` match → 전용 Body |
| R-07 | AT-23 / AC23 | foreground 서브에이전트 행에 `백그라운드로` 버튼이 뜬다 | 렌더 테스트 — `asyncLaunched:false` 인 진행 중 행 → 버튼 존재 (두 타일 각각) | store 의 background 관측 → `canBackgroundTask` → 두 타일 |
| R-07 | AT-24 / AC24 | 이미 background 인 행에는 그 버튼이 없다 | 렌더 테스트 — `asyncLaunched:true` 행 → 버튼 부재. 중단 버튼은 그대로 존재 | 같은 경로 |
| R-07 | AT-25 / AC25 **(ΔV1 정정)** | 클릭하면 그 `toolUseId` 로 전환이 요청된다 | **관측 지점은 `turn.live.backgroundTask` 포트다**(ΔV1) — `registerChatHandlers` 를 실제로 등록해 `CHANNELS.chatBackgroundSubagent` 핸들러를 부르고, 그 포트가 **그 id 로 1회** 호출되는지와 `false` 반환이 reject 되는지를 단언한다. renderer 경계(`chatApi`)의 단언은 이 AC 를 닫지 않는다 | renderer → `orca:chat:backgroundSubagent` → session-runtime → SDK |
| R-07 | AT-26 / AC26 | 요청이 실패하면 버튼이 복구되고 사유가 보인다 | 통합 — 포트가 reject → renderer 가 요청 표식을 되돌리고 오류 문구를 낸다 | 같은 경로 (중단 실패와 동일 규칙) |

### AC 검증 주의사항

- 기존 테스트 재사용: AT-17 의 회귀 대상은 **행동 단언으로 확정했다** — "확정이 오지 않으면 합성 정착으로 마감한다"(watchdog 발화)와 그 양성 짝 "확정이 오면 watchdog 은 발화하지 않는다". 현재 두 단언은 `src/main/features/chat/stop-subagent.test.ts`(9케이스)에 있고 **정식화 턴에 케이스명까지 확인했다**. 파일명은 계약이 아니다 — 구현자가 옮기면 같은 두 단언이 어디 있든 회귀가 성립한다.
- R-92(중단 실패 복구, VP-19)의 회귀 대상도 같다 — "채널이 죽었으면 throw 하고 중단 표식을 되돌린다" + "`stopTask` 가 거절하면 그대로 전파한다 — 삼키지 않는다". 같은 스위트에 실존한다.
- 사람 실기 항목: **없음.** 안내 문구·라벨·버튼 유무는 전부 렌더 테스트로 관측 가능하다. 시각 실기가 필요한 신규 레이아웃이 없다(기존 행·빈 상태의 문구만 바뀐다).
- N회/총량 기준: **없음.** 이번 AC 에 호출 횟수·총량 식이 없다.
- 총량/0건 기준: **없음.** 음성 게이트를 AC 로 쓰지 않는다 — AT-03·AT-11·AT-12·AT-15·AT-24 는 "부재"를 단언하지만 각각 **같은 pair 안에 양성 짝**(AT-02·AT-10·AT-10·AT-14·AT-23)이 있어 장치가 침묵으로 통과하지 않는다. AT-24 는 부재 단언 안에 **양성 항도 함께** 든다(전환 버튼 부재 + 중단 버튼 존재) — 행 전체가 안 그려져도 실패한다.
- 순서 기준: AT-15 가 순서를 단언한다(첫 payload vs 이후). 관측 지점은 tracker 의 정착 호출이며 payload 순번은 테스트가 직접 제어한다.
- **AC 분모 26 → 27 (ΔV1).** AC27 신설로 분모가 하나 늘었다 — **r1 의 26 과 직접 비교하지 않는다.** R 별 분포는 R-01(4) · R-02(5) · R-03(4) · R-04(4) · R-05(4) · R-06(1) · R-07(4) · **R-93(1)** 이고 합 = **27** (검산 일치). 분할 검토 결과는 D-001 에 있고 상한 초과는 2건이 된다 — R-93 은 상속 계약의 회귀 1행이라 분할 근거를 바꾸지 않는다.
- **관측 지점 규칙 (ΔV1).** AC14·AC15·AC22·AC25 의 `검증 수단` 칸은 이제 **어디에 서서 관측하는지**를 함께 적는다. r1 은 네 AC 모두 값을 직접 읽고도 seam 한 홉 앞에서 통과했다 — path 와 oracle 을 따로 적으면 oracle 이 path 의 어디에 있어도 참이 된다(verify D1·D2·D3).
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
| **AR-05** | AR | §10 EP-15 — 정착 tool_result 의 **사유 키 분리**(`cause` / `message`) | **NEW (ΔV1)** | — |
| **R-93** | R | 0204 AT-31 — 사유 없는 중단 행은 UI 문구 `사용자에 의해 중단됨` | **INHERITED (ΔV1)** | `0204:ΔV2 @7b45fa3 (r5 PASS)` · 0204 plan §7 AT-31 행 · 0204 D11(`open`) |

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
| VP-08 | R-04 ↔ AT-14·15 **(ΔV1)** | REQUIRED | SDK `background_tasks_changed` → `subagent.backgroundSet` → coordinator → `settleTaskSubset` | **coordinator 가 낸 정착의 대상 id·status·`stopLive`** — `applyLiveSet` 반환값은 이 pair 를 닫지 않는다 | **required (ΔV1)** — 배선 존재가 계약이라 **coordinator 의 `subagent.backgroundSet` 분기를 통째로 지우는 변이**를 심어 red 를 확인한다(r1 은 이 변이에 2410케이스가 침묵했다) | EP-06·EP-07 (2) |
| VP-09 | AR-02 ↔ AT-16 | REQUIRED | `task_id` → `taskToolUseById` → `toolUseIds` | 이벤트의 `toolUseIds` 배열 | not selected — 배열을 직접 읽는다 | EP-06 (1) |
| VP-10 | R-91 ↔ AT-17 | REGRESSION | `stopSubagentTask` → timeout → 합성 정착 | 기존 스위트의 정착 단언 | not selected — 기존 직접 oracle | EP-08 (1) |
| VP-11 | R-05 ↔ AT-18·19 | REQUIRED | `task_updated` → store transient → `backgroundBoardStatus` → 두 타일 | 라벨 문자열 + 중단 버튼 노드 유무 | not selected — 두 타일 산출을 각각 직접 관측한다 | EP-09·EP-10 (2) |
| VP-12 | AR-03 ↔ AT-20·21 | REQUIRED | `task_updated` → `claudeToNormalized` → `subagent.task` | 정규화 이벤트의 `status`·`errorMessage` | not selected — 이벤트 필드를 직접 읽는다 | EP-09 (1) |
| VP-13 | R-06 ↔ AT-22 **(ΔV1)** | REQUIRED | tool parts → `registry.ts` match → 전용 Body | **`toolRendererRegistry.resolve` 가 6종에 돌려주는 kind** + 그 Body 의 필드 문구 — Body 직접 호출은 이 pair 를 닫지 않는다 | **required (ΔV1)** — **등록 블록 삭제**와 **match 를 `TASK_TOOL_NAMES`(6종)로 확장** 두 변이를 심어 각각 red 를 확인한다(r1 은 둘 다 침묵했다) | EP-11 (1) |
| VP-14 | R-90 ↔ 0204 기존 AT-10a | REGRESSION | 같은 fold 경로 | `taskBoard.test.ts` 의 순서 단언 | not selected — 기존 직접 oracle | EP-04 (1) |
| VP-15 | SD-03 ↔ AT-18·19 | REQUIRED | `paused` 진입 → **중단 가용성 유지** → 이탈 | `canStopTask` 반환 + 렌더의 버튼 노드 | **required** — `paused` 를 `in_progress` 와 나란히 허용하는 술어라, `paused` 항만 **지우는 변이**를 심어 AT-18 이 red 가 되는지 확인한다(D-022 가 이번 턴 자체 정정이라 방향을 잠근다) | EP-10 (1) |
| VP-16 | R-07 ↔ AT-23·24 | REQUIRED | background 관측(`asyncLaunched`) → `canBackgroundTask` → 두 타일 버튼 | 두 타일 산출의 전환 버튼 노드 유무 | not selected — AT-24 가 AT-23 의 양성 짝이고 중단 버튼 존재도 함께 단언한다 | EP-12·EP-13 (2) |
| VP-17 | AR-04 ↔ AT-25 **(ΔV1)** | REQUIRED | 클릭 → `orca:chat:backgroundSubagent` → session-runtime → `backgroundTask(toolUseId)` | **`turn.live.backgroundTask` 포트 호출의 인자와 횟수** — `chatApi` 경계 관측은 이 pair 를 닫지 않는다 | **required (ΔV1)** — 핸들러의 `turn.live.backgroundTask` 호출을 지우거나 인자를 상수로 바꾸는 변이를 심어 red 를 확인한다 | EP-12·EP-14 (2) |
| VP-18 | SD-04 ↔ AT-26 | REQUIRED | 포트 reject → IPC reject → renderer 복구 | 복구 후 버튼 노드 + 오류 문구 | not selected — 렌더 산출을 직접 읽는다 | EP-14 (1) |
| VP-19 | R-92 ↔ 기존 중단 실패 복구 | REGRESSION | `stopSubagentTask` throw → 표식 되돌림 → renderer 복구 | `stop-subagent` 스위트의 복구 단언 | not selected — 기존 직접 oracle | EP-08 (1) |
| VP-20 | MD-04 ↔ AT-23·24 | REQUIRED | `canBackgroundTask(item, asyncLaunched)` 반환 | 술어 반환값 (순수) | not selected — 반환을 직접 읽는다 | EP-13 (1) |
| **VP-21** | AR-05 ↔ AT-21 **(ΔV1 신설)** | REQUIRED | `subagent.task(stopped, summary)` → `subagent-settlement` → `result.cause` → `parts.settlementMessageFromCall` → 행 | 생산자의 `result.cause` 값 + 소비자가 그것을 사유로 고르는지 — **두 층 각각** | not selected — 두 층 모두 값을 직접 읽고 AT-27 이 음성 짝이다 | EP-15 (3) |
| **VP-22** | R-93 ↔ AT-27 **(ΔV1 신설)** | REGRESSION | 같은 경로의 `cause` 부재 분기 | 행이 보이는 문구 문자열 | **required (ΔV1)** — `cause`/`message` 형제 슬롯이 서로 다른 계약이라 **두 값을 맞바꾸는 변이**를 심는다(존재만 보는 단언은 두 문자열이 모두 남아 침묵한다) | EP-15 (3) |

### ΔV1 — r1 `RETURN_TO_PLAN` 정정 (기준 `0212:V1 @e38f545e`)

r1 verify(`1f0c3da2`)의 `PLAN_GAP` **D4** 를 닫고, 같은 라운드가 드러낸 **oracle 관측 지점 누락**을 규범 행으로 올린다. V1 의 나머지 행은 그대로다 — 아래가 증분 전부다.

| 축 | 변경 | provenance |
|---|---|---|
| Decision | **D-026**(사유 키 분리) · **D-027**(레벨 REPLACE 정착 표시) 신설 | NEW — SUPERSEDED 0 |
| Node | **AR-05** 신설 · **R-93** 상속 등록 | NEW / INHERITED |
| Pair | **VP-21**(REQUIRED) · **VP-22**(REGRESSION) 신설 | NEW |
| Pair | **VP-08 · VP-13 · VP-17** — oracle 에 관측 지점을 명시하고 배선 소거 변이를 적대 증거로 등록 | CHANGED |
| AC | **AC27** 신설 · **AC14·AC15·AC21·AC22·AC25** 검증 수단 정정 | NEW / CHANGED |
| §10 | **EP-15** 신설 (강제 지점 3) | NEW |
| §5 | `killed` 행을 사유 유무 2행으로 분리 + 레벨 REPLACE 정착 행 추가 | CHANGED |

- **왜 pair 3건의 oracle 을 고치는가**: r1 에서 VP-08·VP-13·VP-17 이 셋 다 oracle 문장을 참으로 만들고도 seam 한 홉 앞에서 통과했다. 배선을 통째로 지우는 변이에 게이트가 전건 초록이었다(verify §4 MV-1·MV-2·MV-3). 값을 "직접 관측한다" 는 것은 *값*에 대해 참이고 *배선*에 대해서는 아무 말도 하지 않는다.
- **`NOT_REQUIRED` 0건** — V1 의 어떤 pair도 비영향으로 판정하지 않는다. ΔV1 은 기존 pair 를 줄이지 않는다.
- **유효 V 재구성**: `0212:V1 @e38f545e` 의 20 pair + ΔV1 의 신설 2 pair = **22 pair**(REQUIRED 17 · REGRESSION 5), 그중 3 pair 의 oracle·적대 증거 칸이 ΔV1 로 갱신됐다.

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
| **EP-15 · AR-05·R-93/VP-21·VP-22 (ΔV1)** | 중단 정착의 **사유는 `cause`, 표시 기본값은 `message`** — 소비자는 `reason:'aborted'` 면 `cause` 만 사유로 읽는다(D-026) | 생산자 `subagent-settlement.ts` `stopped` 분기 · 소비자 `parts.ts` `settlementMessageFromCall` · 표시 `TaskTileContent` `backgroundMetaLine` 의 `aborted` 분기 — **지점 3** | main + renderer | 매 중단 정착 · 매 렌더 | 한 키에 둘을 담으면 `killed` 의 SDK 사유가 사용자 중단 행까지 덮어 원인을 거짓 진술한다(0204 D11 · r1 verify D4). 두 값을 맞바꾸면 두 문자열이 모두 남아 존재 단언은 침묵한다 |

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

### ΔV1 구현 범위 (r2)

**프로덕션 코드 변경은 필요하지 않을 수 있다.** r1 의 세 finding 은 "동작이 틀렸다" 가 아니라 "그 지점을 보는 눈이 없다" 다 — r2 는 오라클을 만들고, 만드는 과정에서 계약 위반이 드러나면 그때 코드를 고친다.

| 대상 | 만들 오라클 | seam |
|---|---|---|
| VP-13 / AC22 (D1) | `registry.test.ts` 에 6종을 `toolRendererRegistry.resolve` 에 통과시켜 4종=`task_list` · `TaskOutput`·`TaskStop`=폴백 kind 를 단언 | 순수 — 기존 파일에 케이스 추가 |
| VP-08 / AC14·15 (D2) | `turn-coordinator.test.ts` 에 `subagent.backgroundSet` 2회 주입 → 첫 payload 정착 0건, 둘째에서 빠진 항목의 정착 대상·`status:'failed'`·`stopLive:false` 를 단언 | 기존 coordinator 하네스 |
| VP-17 / AC25 (D3) | `vi.mock('electron')` 로 `ipcMain.handle` 을 포획해 `registerChatHandlers` 등록 후 `CHANNELS.chatBackgroundSubagent` 핸들러를 호출 — `turn.live.backgroundTask('use1')` 1회와 `false`→reject 를 단언 | **선례 7건**, 그중 `src/main/app/chat-turn.runtime-tools.test.ts` 가 같은 `registerChatHandlers` 를 이 방식으로 부른다 |
| VP-21·22 / AC21·27 (D4) | 생산자·소비자 두 층 단언은 이미 있다 — **`cause`↔`message` 맞바꿈 변이**로 민감도를 확인하고 EP-15 의 세 지점을 전수로 센다 | 기존 `subagent-settlement.test.ts` · 렌더 테스트 |

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
| 중단 행은 `사용자에 의해 중단됨` 을 보인다 | 0204 D-024 · AT-31 | D-026 — 사유가 있으면 `cause` 를 보이고 없으면 그 문구로 떨어진다 | **보완** — R-93/VP-22 가 원 계약을 회귀로 잠근다 |
| `aborted` 분기의 하드코딩 사유를 고치려면 규범 정정이 선행한다 | **0204 D11 (`open`)** | D-026 이 그 규범 행이다 | **닫는다** — 0204 는 `verify/PASS` 후 사람 대기라 그 문서는 건드리지 않고 여기서 계약을 만든다 |
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

### ΔV1 self-review (정정한 행만)

> 고쳐 쓴 AC 행은 §5 AC 게이트와 self-review 를 **다시** 통과시킨다(SKILL 마무리). 아래는 ΔV1 이 만들거나 고친 행에 대한 재검이다.

- [x] **정정한 AC 5행 + 신설 1행이 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다** — AC14·15·21·22·25·27 전부 세 칸을 채웠고, 검증 수단 칸에 **관측 지점**을 추가로 명시했다.
- [x] **"X 가 쓰인다" 의 검사 장치가 X 를 지웠을 때 실패한다** — VP-08·VP-13·VP-17 이 배선 소거 변이를 `required` 로 등록했다. r1 은 이 세 변이에 침묵했다는 것이 실측이다(verify §4).
- [x] **자리를 말하는 불변식은 형제 맞바꿈에도 실패한다** — VP-22 가 `cause`↔`message` 맞바꿈 변이를 등록했다. 존재만 보는 단언은 두 문자열이 모두 남아 통과한다.
- [x] **음성 단언에 양성 짝이 있다** — AC27(사유 없음 → UI 문구)은 AC21(사유 있음 → 그 문구)의 짝이고, AC15(정착 0건)는 AC14(정착 N건)의 짝이다. 새로 만든 부재 단언 중 짝 없는 것 0건.
- [x] **ACTIVE Decision ↔ 정정 AC 대조: 충돌 0.** 확인 쌍 — D-026↔AC21·AC27(사유/기본 문구가 서로 다른 키라 둘이 동시에 참) · D-027↔§5 레벨 REPLACE 행(새 status 없음) · **0204 D-024↔AC27 비충돌**(`failed` 분기 규칙 불변) · D-015↔AC21(`killed` 정착은 그대로 `stopped`).
- [x] **분모 변경을 적었다** — 26 → 27, r1 합계와 직접 비교하지 않는다(§7 주의사항).
- [x] **EP-15 의 강제 지점을 전수로 셌다** — `grep -rn "cause" src/main src/renderer` 에서 이 계약의 지점은 **3**이다: 생산 `subagent-settlement.ts:33` · 소비 `parts.ts:387` · 표시 `TaskTileContent.tsx:147`. 나머지 `cause` 히트는 error-classifier·auth·`AbortCause` 로 다른 계약이다. 하나만 닫으면 나머지 둘이 조용히 갈라진다.
- [x] **`NOT_REQUIRED` 를 만들지 않았다** — ΔV1 은 기존 pair 를 줄이지 않는다.
- [x] **인용한 앵커가 실재한다** — 0204 `AT-31`(plan:371) · 0204 `D-024`(plan:68) · 0204 `D11`(plan:1226) · `vi.mock('electron')` 선례 7건(`chat-turn.runtime-tools.test.ts` 포함) 전부 grep 확인.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: R-01~R-07 전부. plan 이 잡은 사실은 실측과 일치했다 — `SessionRuntime.backgroundTask` 가 `turn.live` 로 도달해 `chatStopSubagent` 와 대칭 배선이 가능하고(`ports.ts:33` — `SessionRuntime` 이 `GovernedLiveTurn` 을 구조적으로 만족), `TaskProgressList` 가 props-only 순수 View 라 AC1~AC3 이 렌더 테스트로 관측되고, `isAsyncLaunchedResult`(`parts.ts:331`)가 renderer 에 이미 있어 R-07 술어의 입력이 존재한다.
- 이견 / 현실성 문제: **없다.** 차단 `PLAN_GAP` 0건.
- ACTIVE Decision 과 충돌하는 설계 발견: **1건 — AC21 ↔ 0204 AT-31.** AC21 은 "중단 행이 `patch.error` 를 사유로 보인다" 를 요구하고, 0204 AT-31(REGRESSION 축)은 "중단 행이 UI 문구 `사용자에 의해 중단됨` 을 보인다" 를 잠갔다. 두 기준은 *중단 정착이 사유 문구를 실은 경우*에만 충돌한다. **한쪽을 고르지 않고** 정착 payload 의 키를 갈라 둘 다 성립시켰다(아래 §놓친 잠재 문제 P1) — 새 Decision 이 필요한 자리이므로 검증자에게 규범 승격 여부를 올린다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01 | `init.tools` → `patch.agentTools`, 부재는 키 미포함 | EP-01 | `claude-map.ts` init 분기 1/1 | `vitest run src/main/adapters/claude-map.test.ts` — 4케이스. 변이 M7(부재를 `[]` 로) → **RED 3** | — |
| VP-02 | patch 병합 = 누락은 보존 | EP-02 | `chatReducer.ts` `session.updated` 1/1 | `chatReducer.task.test.ts` AT-04. 변이 M8(무조건 대입) → **RED 1** | — |
| VP-05 | `activeForm` 은 입력 전용 + `active_form` 별칭 | EP-03 | `task-tool.ts` `readCreate`·`readUpdate` 2/2 | `task-tool.test.ts` 4케이스. 변이 M9(별칭 제거) → **RED 1** | — |
| VP-06·07·14 | 역방향 가산 = 대상 존재 시에만·자기 간선 배제·스냅샷 교체 | EP-04 | `taskBoard.ts` `applyReverseBlocks` + fold 호출 1지점 | `taskBoard.test.ts` AT-10·11·12·13. 변이 M5(호출 제거) → **RED 2** | — |
| VP-03·04 | `title`=표시 파생 · `subject`=안정 · `aria-label`=`subject` | EP-05 | `taskBoard.ts` `agentItem` + `TaskTileContent` 행 aria 2/2 | `taskSurface0212.render.test.ts` AT-05·08. **형제 맞바꿈 변이 M1 → RED 3** | 헤더 제목도 `subject` 로 바꿨다(같은 계약, §10 밖) |
| VP-08·09 | 매핑된 `task_id` 만 이벤트에 싣는다 | EP-06 | `claude-map.ts` `mapBackgroundTasksChanged` 1/1 | `claude-map.test.ts` AT-16 + 3케이스 | — |
| VP-08 | 첫 payload 는 기준선 · 프로세스 (재)기동 시 리셋 | EP-07 | `background-tasks.ts` `applyLiveSet`·`resetLevel`·`clear` 3/3 | `background-tasks.test.ts` AT-15 외 6케이스. 변이 M3(기준선 제거) → **RED 4** | — |
| VP-10 | watchdog 정착 경로 불변 | EP-08 | `stop-subagent.ts` **미변경**(0/0 — 지점을 건드리지 않는 것이 계약이다) | `stop-subagent.test.ts` 9케이스 green. AT-17 대상 = "확정이 없으면 합성 정착으로 마감한다" + 양성 짝 "확정이 오면 watchdog 은 발화하지 않는다" | — |
| VP-11·12 | `killed`→`stopped` 동형 · `paused` 는 정착 아님 | EP-09 | `claude-map.ts` `mapTaskUpdated` 1/1 | `claude-map.test.ts` AT-20·21 외 5케이스. 변이 M4(매핑 제거) → **RED 2** | — |
| VP-11·15 | `paused` 도 중단 가능 · **두 타일 모두** | EP-10 | `taskBoard.ts` `canStopBackgroundStatus` 1 + 도달 경로 2(`canStopTask`→`TaskTileContent:182,289` · `SubAgentTileContent:258`) | `taskSurface0212.render.test.ts` AT-18 두 타일 각각. **`paused` 항 제거 변이 M2 → RED 4** | — |
| VP-13 | 레지스트리는 이름 사본을 만들지 않는다 | EP-11 | `task-tool.ts` `TASK_LIST_TOOL_NAMES` 1 + `registry.ts` match 1 = 2/2 | `task-tool.test.ts` 부분집합 케이스 + `registry.test.ts`. 변이 M10(6종 전량으로 넓힘) → **RED 2** | — |
| VP-16·17 | 전환 버튼은 두 타일 모두 같은 술어로 | EP-12 | `TaskTileContent` 행+상세 2 · `SubAgentTileContent` 1 = 3/3 | `taskSurface0212.render.test.ts` AT-23·24 두 타일 각각 | — |
| VP-16·20 | `canBackgroundStatus` = 진행 중 AND not asyncLaunched | EP-13 | `taskBoard.ts` 1/1 | `taskBoard.test.ts` AT-23·24. 변이 M6(`asyncLaunched` 항 제거) → **RED 5** | — |
| VP-17·18 | 전환은 `toolUseId` 단건 · 실패를 삼키지 않는다 | EP-14 | 신규 IPC 핸들러 1 · store 액션 1 = 2/2 | `chatStore.subagentControl.test.ts` — "그 id 로 1회" + reject 복구 | **핸들러 본문은 단위 테스트 없음**(electron 의존) — 아래 AC25 |

- §10 에 없는데 같은 불변식이 필요했던 지점: **2건.** ① `subagent-settlement.ts` 의 `stopped` 분기가 `summary` 를 버렸다(중단 행이 사유를 말할 수 없었다). ② `TaskTileContent` `backgroundMetaLine` 의 `aborted` 분기가 `settlementMessage` 를 버렸다. 둘은 같은 불변식의 생산자·소비자 짝이다 — **"중단 행은 SDK 가 준 사유가 있으면 그것을 말한다"**. §10 EP-09 는 정규화까지만 적었다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | 렌더 산출의 안내 문구·버전 유무(3갈래) | not selected |
| VP-02 | REQUIRED | SELF_PASS | 병합 후 `agentTools` 값 | not selected |
| VP-03 | REQUIRED | SELF_PASS | 상태별 `title` 값 | **M1 형제 맞바꿈 → RED 3** |
| VP-04 | REQUIRED | SELF_PASS | `aria-label` 문자열 | **M1 형제 맞바꿈 → RED 3**(같은 변이가 두 pair 를 함께 잡는다) |
| VP-05 | REQUIRED | SELF_PASS | patch 의 `activeForm` 값 | not selected |
| VP-06 | REQUIRED | SELF_PASS | 대상 항목의 `blockedBy` 배열 | not selected |
| VP-07 | REGRESSION | SELF_PASS | 스냅샷 후 `blockedBy` 배열 | not selected |
| VP-08 | REQUIRED | SELF_PASS | `applyLiveSet` 반환 id 집합 | not selected |
| VP-09 | REQUIRED | SELF_PASS | 이벤트의 `toolUseIds` 배열 | not selected |
| VP-10 | REGRESSION | SELF_PASS | 기존 `stop-subagent` 스위트 9케이스 green | not selected |
| VP-11 | REQUIRED | SELF_PASS | 두 타일 라벨 + 중단 버튼 노드 | **M2 `paused` 항 제거 → RED 4** |
| VP-12 | REQUIRED | SELF_PASS | 정규화 이벤트의 `status`·`summary` | not selected |
| VP-13 | REQUIRED | SELF_PASS | 렌더 산출의 필드 문구(4종 + 6종 대조) | not selected |
| VP-14 | REGRESSION | SELF_PASS | `taskBoard.test.ts` AT-10a 순서 단언 | not selected |
| VP-15 | REQUIRED | SELF_PASS | `canStopBackgroundStatus` 반환 + 버튼 노드 | **M2 → RED 4** |
| VP-16 | REQUIRED | SELF_PASS | 두 타일 산출의 전환 버튼 유무 | not selected |
| VP-17 | REQUIRED | SELF_PASS | 포트 호출의 인자와 횟수(store→IPC hop) | not selected |
| VP-18 | REQUIRED | SELF_PASS | 복구 후 표식 + 오류 문구 | not selected |
| VP-19 | REGRESSION | SELF_PASS | `stop-subagent` 복구 단언 2케이스 | not selected |
| VP-20 | REQUIRED | SELF_PASS | 술어 반환값(순수) | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 `agentItem` 의 `title`↔`subject` 맞바꿈 | VP-03·VP-04 선택 증거(형제 자리) | 해당 없음 (r1) | 3 failed | **RED** |
| M2 `canStopBackgroundStatus` 의 `paused` 항 제거 | VP-15 선택 증거 | 해당 없음 (r1) | 4 failed | **RED** |
| M11 CLI 진입 가드를 깨진 형태로 복원 | 이번 턴에 만든 **배선 존재 oracle** | 해당 없음 (r1) | 1 failed | **RED** |
| M13 settle 의 `cause` 미포함 | 이번 턴에 만든 배선 oracle(1차 무음 → 보강) | 1차 **GREEN(무음)** | 보강 후 1 failed | **RED** |

- 분모 검산: **선택 증거 3**(VP-03·VP-04·VP-15 — M1 이 앞 둘을 함께 잡아 변이 2개) · **인용 변이 0**(r1) · **새 oracle 2**(CLI 가드 spawn 테스트 · settle `cause` 생산자 테스트) = **표 행 4**. 표 행 4 ✅.
- 덮개 회귀: **없다.** 장치를 교체·삭제한 곳이 0이다 — 기존 스위트에 케이스를 더했을 뿐이고 277파일 2779케이스가 전건 green 이다. 단 **M13 이 1차에 무음이었다**: 소비자 fixture 만 있고 생산자 배선을 보는 단언이 없었다 — 그 자리를 `subagent-settlement.test.ts` 3케이스로 메우고 재측정해 RED 를 확인했다.
- 추가 측정(요구 밖, 참고): M3 레벨 기준선 제거 → RED 4 · M4 `killed` 매핑 제거 → RED 2 · M5 역방향 가산 호출 제거 → RED 2 · M6 전환 술어의 `asyncLaunched` 제거 → RED 5 · M7 `tools` 부재를 `[]` → RED 3 · M8 reducer 무조건 대입 → RED 1 · M9 `activeForm` 별칭 제거 → RED 1 · M10 레지스트리 6종 확장 → RED 2 · M12 `aborted` 사유를 `message` 로 되돌림 → RED 3. **심은 13종 전건 검출.**

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **있다 — 전수 확인.** 안내 2문구→`TaskProgressList` · `일시정지`→두 타일 · 전환 버튼 라벨/aria/툴팁→두 타일 · `backgroundFailed`→`TaskRow` 사유 줄 · Task 도구 본문 9키→`TaskToolBody` | — |
| seam 을 만들려고 production 을 재배치했는가 | **아니다.** 새 파일은 `TaskToolBody.tsx` 하나(신규 기능)이고 기존 seam(`taskBoard` 순수 fold · tracker · props-only View)을 그대로 썼다 | — |
| 이번에 만든 실패 경로가 §5 상태 전이표의 어느 행인가 | 전환 실패 = "`백그라운드로` 요청 실패 → 표식 되돌림 + reject" 행 ✅. **레벨 REPLACE 정착의 표시 문구는 표에 행이 없다** — 새로 만든 문구("완료 통지 없이 백그라운드 작업 목록에서 사라졌습니다")가 §5 어느 행에도 대응하지 않는다 | 아래 P3 |
| 실패가 화면에서 "아무 일도 안 일어남" 으로 보이지 않는가 | 보이지 않는다. 전환 실패는 버튼 복구 + 사유 줄(`taskStopErrors`), `false` 반환도 reject 로 같은 경로를 탄다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 되돌리지 않는다. 전환은 **비정착 연산**이라 성공 시 상태를 바꾸지 않고, 실패만 요청 표식을 지운다. 정착(부모 Task 권위 결과)이 오면 `pausedTaskIds`·`backgroundingTaskIds` 를 함께 비워 늦은 라이브 표식이 정착 행에 남지 않는다 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| P1 | **AC21 ↔ 0204 AT-31 충돌.** 중단 정착의 `message` 한 자리를 UI 문구와 SDK 사유가 함께 쓰려 해서, 한쪽을 만족시키면 다른 쪽이 red 가 된다(실측: 소비자를 `message` 로 바꾸자 AT-31 red) | **선조치 — 키를 갈랐다.** 정착 payload 에 `cause` 를 추가하고(`summary` 가 있을 때만) 소비자는 `aborted` 면 `cause`, `failed` 면 `message` 를 읽는다. 두 계약이 함께 성립한다(AT-31·AT-21 동시 green) | 검증자에게 **Decision 승격**을 올린다 — 지속 계약이므로 §10 에 행이 있어야 한다 |
| P2 | **`check-doc-inventory.mjs` 등 5개 CLI 의 진입 가드가 Windows 에서 절대 성립하지 않는다.** `import.meta.url === \`file://${process.argv[1]}\`` 는 `file:///C:/…` vs `file://C:\…` 라 항상 거짓 → **본문 미실행 + exit 0**. CI 가 `windows-latest` 이므로 문서 인벤토리·마이그레이션 append-only·릴리스 버전·dist sha512·ABI 보장이 **전부 무음으로 통과**해 왔다 | **선조치 — 5개 전수 수정**(`pathToFileURL` + argv 미정의 가드, 선례 `analyze-composer-input-trace.mjs:151`). spawn 기반 테스트를 추가해 잠갔다(양성 짝: import 만으로는 본문이 돌지 않는다). 재측정 결과 인벤토리 실제 drift 는 이번 변경분뿐(79→80 채널 · 21→22 variant) | 이번 변경의 **필수 gate 가 그 스크립트**라 우회 불가. 0212 범위 밖이므로 검증자가 별도 handoff 로 뺄지 판단한다 |
| P3 | 레벨 REPLACE 정착이 §5 상태 전이표에 없는 **새 사용자 문구**를 만든다 | 보고만. status 는 기존 `failed` 를 재사용했고(채널 사망 정착 선례) 문구는 무슨 일이 있었는지 그대로 말한다 | plan §5 에 행 추가 필요 |
| P4 | `patch.error`·`is_backgrounded` 가 AR-03 에 선언됐으나 plan 의 AC 어디에도 소비처가 없다 — 그대로 실으면 `task-tool.ts` 헤더가 금지한 죽은 표면이 된다 | `errorMessage` 는 **wire 에서 뺐다**(정착 `summary` 경로가 AC21 을 만족한다). `is_backgrounded` 는 **소비자를 만들었다** — `backgroundedTaskIds` 로 흡수해 전환 버튼 술어를 즉시 끈다(런치 영수증보다 빠르다) | 아래 §설계 대비 명시적 차이 |
| P5 | `paused` 와 `stopping` 이 겹칠 수 있다(paused 도 중단 가능하므로) | 중단 요청이 우선한다 — EP-10 의 "`stopping` 만 제외" 에서 파생. 케이스로 잠갔다 | — |

### 설계 대비 명시적 차이

- plan 이 지정한 것과 다르게 구현한 것과 그 이유:
  1. **`subagent.task` 확장에서 `errorMessage` 를 뺐다**(AR-03 은 4필드, 구현은 `runState`+`isBackgrounded` 2필드). 라이브 표시에 소비처가 없고 AC21 은 정착 경로가 만족한다.
  2. **`canBackgroundTask(item, asyncLaunched)` → 규칙+래퍼 2함수**(`canBackgroundStatus(status, asyncLaunched)` + `canBackgroundTask(item)`). 두 타일의 입력 타입이 다르므로(`TaskBoardItem` vs `SubagentTaskSummary`) 단일 시그니처로는 EP-12 의 "두 타일 같은 술어" 를 만족할 수 없다. 기존 `canStopBackgroundStatus`/`canStopTask` 쌍과 동형이다.
  3. **`RenderableKind` 에 `task_list` 를 신설**하고 `docs/arch/frontend/rendering.md §1.6`(정본 taxonomy 3자리)을 갱신했다. plan §18 에 이 문서가 없었다 — `agent_task` 재사용은 "서브에이전트 실행" 과 "할 일 목록 변경" 을 같은 의미로 접는다.
  4. **정착 payload 에 `cause` 신설**(P1).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | **해당 없음.** 새 상태는 전부 프로세스 내 메모리이고 TTL 을 갖지 않는다. `backgroundedTaskIds`·`pausedTaskIds` 는 정착이 지우고 정착은 반드시 온다(watchdog 보장) | AC18·AC24 — 정착 후 표식 제거를 `chatReducer.task.test.ts` 마지막 케이스가 단언 |
| **공유** | `backgroundedTaskIds` 는 **두 출처가 함께 쓴다** — SDK `is_backgrounded` 확정분과 사용자 요청 in-flight 분(`backgroundingTaskIds`). 한쪽이 비우면 다른 쪽 의미가 사라질 수 있다 | **두 배열을 분리해 유지**하고 합집합만 파생한다(`useBackgroundedTasks`) — 정착은 in-flight 만 지우고 확정분은 SDK `false`(foreground 복귀)만 지운다. AC24 + reducer 케이스 2개로 각각 관측 |
| 재진입 | 전환 재클릭은 `backgroundingTaskIds` 가 막는다(버튼이 사라진다). 재요청 시 이전 실패 사유를 지운다 — 오래된 사유가 새 요청 위에 남지 않는다 | AC26 + `chatReducer.task.test.ts` "재요청은 앞선 실패 사유를 지운다" |
| 다른 무효화 축 | **레벨 신호의 기준선**이 새 무효화 축이다 — `clear` 가 프로세스 경계이므로 채널 사망 정착·콜드 spawn 이 레벨을 미확립으로 되돌린다. 되돌리지 않으면 구 프로세스 집합이 새 태스크를 죽인다 | AC15 + `background-tasks.test.ts` "프로세스 (재)기동 경계" · "resetLevel" 2케이스 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **40** (수정 37 · 신규 3). shared 4 · main 8 · preload 1 · renderer 13 · scripts 6 · docs 3 · 신규 테스트/컴포넌트 3. 목록은 커밋 diff |
| 실행 명령 | `npm run typecheck` · `./node_modules/.bin/vitest run src/shared src/renderer src/main` · `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs` → `--check` · `npm run lint` |
| 관측한 게이트 산출 | **typecheck 3구성 exit 0 · 출력 0줄** / **vitest 277파일 2779케이스 전건 pass** / **scripts 61/61 pass** / **doc-inventory: generated ok(80 channels) · prose ok · links ok** / **lint 0 error · 1 warning**(기존분 `useTranscriptVirtualizer.ts:22`, 트리 쓰기 0) |
| V-pair 자기확인 | REQUIRED 16 + REGRESSION 4 = **20 전건 SELF_PASS**, SELF_BLOCKED 0 |
| 강제 지점 전수 | **14/14** (EP-01~EP-14). EP-08 은 "건드리지 않는 것" 이 계약이라 0/0 으로 센다. §10 밖 형제 지점 **2건 추가 발견·수정** |
| AC 자기보고 | ✅25 · ⚠️1 · ❌0. ⚠️ = **AC25** — renderer→IPC hop 은 "그 `toolUseId` 로 1회" 로 잠갔으나 **main 핸들러 본문**(`turn.live.backgroundTask` 호출·`false`→throw)은 단위 테스트가 없다(electron 의존, 저장소에 `vi.mock('electron')` 선례 0건). 핸들러는 `chatStopSubagent` 와 5줄 대칭이다 |
| 합계 검산 | ✅25 · ⚠️1 · ❌0 = **총 26** ✅ (분모 = plan §7 AC1~AC26, r1 에서 분할·추가 0) |
| 블로커 / 역질문 | **없다.** 단 P1·P2 는 규범 승격 판단이 필요하다 — P1 은 §10 행(중단 사유의 키 분리), P2 는 별도 handoff 여부 |
| 대상 커밋 | `(r1 구현 — 검증자 기입)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: r1 이라 이전 라운드가 없다. 단 **0204 가 세운 불변식의 미적용 지점 2곳**을 이번에 닫았다 — "실패·중단 행이 원인을 말한다"(0204 D-024)가 `failed` 축에만 구현돼 있었고 `stopped`/`aborted` 축은 생산자·소비자 양쪽에서 사유를 버렸다.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **있었다.** §10 EP-09 가 `killed`→`stopped` 매핑까지만 지점을 적고 **그 뒤의 표시 경로를 지점으로 세지 않았다** — AC21 은 "행이 그 문구를 보인다" 를 요구했으므로 지점이 정규화 1곳이 아니라 정규화·정착·표시 3곳이어야 했다. plan §10 의 `실패 의미` 칸은 정규화 실패만 서술한다.
- 반복해서 부딪히는 환경 한계: ① bash heredoc 이 큰 비-ASCII 블록에서 `unexpected EOF` 로 실패해 파일 쓰기를 우회해야 했다. ② `META_GAP` 이 U+00A0 이라 렌더 단언에 리터럴 공백을 쓰면 조용히 어긋난다 — 상수를 import 해 조립했다. ③ `.bin/vitest` shim 은 Win32 실행 파일이 아니라 프로그램적 실행에 `node node_modules/vitest/vitest.mjs` 가 필요하다.
- 현재 라운드 수: **1**

---

## [구현자 기입] r2 — 설계 리뷰

- 동의 / 그대로 진행: ΔV1 §11 의 4항목 전부. plan 이 지목한 seam 이 실측과 일치했다 — `registry.test.ts` 가 이미 `toolRendererRegistry.resolve` 를 부르고(기존 5케이스), `turn-coordinator.test.ts` 하네스가 이미 `forward` 스파이로 정착 이벤트를 읽으며(기존 4케이스), `chat-turn.runtime-tools.test.ts:11-19` 의 `vi.mock('electron')` 이 같은 `registerChatHandlers` 를 부른다.
- 이견 / 현실성 문제: **없다.** 차단 `PLAN_GAP` 0건 — 네 오라클 전부 기존 seam 으로 닿았고 **프로덕션 코드 diff 0**(`git diff --stat` = 테스트 2파일 수정 + 1파일 신규).
- ACTIVE Decision 과 충돌하는 설계 발견: **0건.** 프로덕션 표면을 바꾸지 않아 충돌할 자리가 없다. D-026·D-027 은 r1 구현이 이미 만족하고 있었고 ΔV1 이 규범 행을 붙였다.
- 보고: ΔV1 self-review 의 EP-15 검색 술어가 재현되지 않는다(아래 P6). §10 EP-15 행 자체는 세 지점을 파일로 옳게 지목한다.

## [구현자 기입] r2 — 강제 지점 전수 (§10 대조)

이번 라운드가 여는 EP 만 적는다. 나머지 EP-01~EP-05·EP-08~EP-10·EP-12·EP-13 은 r1 이 닫았고 **프로덕션 diff 가 0**이라 재측정만 했다(전체 스위트 green, 아래 게이트).

| Pair | 계약 | §10 지점 | r1 잠금 | r2 잠금 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-13 | 레지스트리 match 는 4종 부분집합 술어를 쓴다 | EP-11 — **지점 2** | 1/2 | **2/2** | 전수 검색 `grep -rn "isTaskListToolName\|TASK_LIST_TOOL_NAMES" src --include=*.ts --include=*.tsx \| grep -v '\.test\.'` → 프로덕션 2사이트(`task-tool.ts:34-40` SSOT · `registry.ts:93` match). MV-1 등록 삭제 → **RED 1** · MV-2 6종 확장 → **RED 1** | — |
| VP-08 | 매핑분만 싣기 · 첫 payload 는 기준선 | EP-06·EP-07 (2) | 1/2 | **2/2** | MV-3 coordinator 의 `subagent.backgroundSet` 블록 삭제 → **RED 2**(`turn-coordinator.test.ts` 신규 2케이스) | — |
| VP-17 | 전환은 `toolUseId` 단건 · 실패를 삼키지 않는다 | EP-14 — **지점 2** | 1/2 | **2/2** | MV-4 포트 호출 삭제 → **RED 2** · MV-5 인자 상수화(`'use1'` 고정) → **RED 1**(`chat-turn.background-subagent.test.ts` 신규) | — |
| VP-21·22 | 중단 정착의 사유는 `cause`, 표시 기본값은 `message` | EP-15 (3) | — (ΔV1 신설) | **3/3** | 생산 `subagent-settlement.ts:33` → MV-7 맞바꿈 **RED 3** · 소비 `parts.ts:387` → MV-6 맞바꿈 **RED 4** · 표시 `TaskTileContent.tsx:148` → MV-8 `settlementMessage` 폐기 **RED 1** | — |

- **EP-15 전수 검색의 술어를 고쳤다.** ΔV1 self-review 는 `grep -rn "cause" src/main src/renderer` 로 지점 3을 셌다고 적었지만, 표시 지점은 `cause` 를 담지 않는다 — `grep -c "cause" src/renderer/.../TaskTileContent.tsx` = **0**. 불변식의 주어가 두 이름에 걸쳐 있어서다: 생산·소비 축은 `cause`, 표시 축은 `settlementMessage`. 두 술어를 합친 전수는 생산 1 · 소비 1(`parts.ts:387`) · 표시 1(`:148`, `aborted` 분기) = **3** 으로 §10 행의 숫자와 일치한다. `:153` 의 `failed` 분기는 0204 D-024 소관이라 이 계약 밖이다.
- **운반 홉 1건을 추가로 확인했다** — `taskBoard.ts:281` 이 `settlementMessage` 를 타일로 나른다. §10 밖이지만 같은 값의 경로라 MV-11(`null` 로 고정) 을 심었고 **RED 2** 다.
- §10 에 없는데 같은 불변식이 필요했던 지점: **등록 범위 안 0건.** 범위 밖에서 같은 *부류*의 무잠금 지점 **4건**을 찾았다 — 아래 P7.

**V-pair 자기확인 (r2)** — 유효 V = 22 pair(REQUIRED 17 · REGRESSION 5).

| Pair | requiredness | r1 결과(검증자) | r2 자기 상태 | 이번 라운드 직접 관측 |
|---|---|---|---|---|
| VP-08 | REQUIRED | **PAIR_FAIL** | **SELF_PASS** | coordinator 가 낸 정착의 대상 id·`status:'failed'`·summary + `stopLive:false`(포트 미호출). MV-3 → RED 2 |
| VP-13 | REQUIRED | **PAIR_FAIL** | **SELF_PASS** | `resolve` 가 6종에 돌려주는 kind — 4종 `task_list`+`TaskToolBody`, 2종 `generic`. MV-1·MV-2 각 → RED 1 |
| VP-17 | REQUIRED | **PAIR_FAIL** | **SELF_PASS** | `turn.live.backgroundTask` 호출 목록 `[['use1'],['use2']]` + `false`→reject. MV-4 → RED 2 · MV-5 → RED 1 |
| VP-21 | REQUIRED | — (ΔV1 신설) | **SELF_PASS** | 생산자 `result.cause` 값 + 소비자 렌더 문구, 두 층 각각. MV-7 → RED 3 · MV-6 → RED 4 |
| VP-22 | REGRESSION | — (ΔV1 신설) | **SELF_PASS** | `cause` 부재 분기가 `사용자에 의해 중단됨` 을 보이고 생산자 기본 문장은 안 보인다. MV-6 맞바꿈 → RED 4 |
| VP-03·VP-04 | REQUIRED | PASS | **SELF_PASS** | `title`/`subject` 형제 맞바꿈 M1 → **RED 3**(이번 턴 재측정) |
| VP-15 | REQUIRED | PASS | **SELF_PASS** | `canStopBackgroundStatus` 의 `paused` 항 제거 M2 → **RED 4**(이번 턴 재측정) |
| VP-01·02·05·06·07·09·10·11·12·14·16·18·19·20 (14) | REQUIRED 10 · REGRESSION 4 | PASS | **SELF_PASS(상속)** | 적대 증거 미선택 pair 다 — 프로덕션 diff 0 이고 전체 스위트 278파일 2790케이스 green |

- `SELF_BLOCKED` 0 · `NOT_REQUIRED` 0.

## [구현자 기입] r2 — 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| MV-1 `registry.ts` 의 `task_list` 등록 블록 전체 삭제 | VP-13 선택 증거(ΔV1) · D1 인용 | r1 verify **GREEN**(277파일 2779케이스) | 1 failed / 59파일 584케이스 | **RED** |
| MV-2 같은 지점의 match 를 `isTaskToolName`(6종)으로 확장 | VP-13 선택 증거(ΔV1) · D1 인용 | r1 verify **GREEN**(6파일 87케이스) | 1 failed / 584케이스 | **RED** |
| MV-3 `turn-coordinator.ts` 의 `subagent.backgroundSet` 블록 전체 삭제 | VP-08 선택 증거(ΔV1) · D2 인용 | r1 verify **GREEN**(229파일 2410케이스) | 2 failed / 15파일 182케이스 | **RED** |
| MV-4 핸들러의 `turn.live.backgroundTask` 호출 제거 | VP-17 선택 증거(ΔV1) · D3 인용 | 미측정 | 2 failed / 32파일 255케이스 | **RED** |
| MV-5 같은 호출의 인자를 상수 `'use1'` 로 고정 | VP-17 선택 증거(ΔV1) | 미측정 | 1 failed / 255케이스 | **RED** |
| MV-6 소비자 `parts.ts` 의 `cause`↔`message` 맞바꿈 | VP-22 선택 증거(ΔV1) | 미측정(r1 M12 는 인접 축) | 4 failed / 584케이스 | **RED** |
| MV-7 생산자 `subagent-settlement.ts` 의 `cause`↔`message` 맞바꿈 | EP-15 지점 1 전수 | 미측정(r1 M13 은 `cause` 누락 축) | 3 failed / 182케이스 | **RED** |
| MV-8 표시 `backgroundMetaLine` 의 `aborted` 분기가 `settlementMessage` 폐기 | EP-15 지점 3 전수 | 미측정 | 1 failed / 584케이스 | **RED** |
| MV-11 운반 `taskBoard.ts:281` 의 `settlementMessage` 를 `null` 고정 | EP-15 운반 홉(§10 밖) | 미측정 | 2 failed / 584케이스 | **RED** |
| M1 `agentItem` 의 `title`↔`subject` 맞바꿈 | VP-03·VP-04 선택 증거 | r1 RED 3 | 3 failed / 584케이스 | **RED** |
| M2 `canStopBackgroundStatus` 의 `paused` 항 제거 | VP-15 선택 증거 | r1 RED 4 | 4 failed / 584케이스 | **RED** |

- 분모 검산: **선택 증거 8**(VP-03·04←M1 · VP-15←M2 · VP-08←MV-3 · VP-13←MV-1·MV-2 · VP-17←MV-4·MV-5 · VP-22←MV-6) · **인용 변이 0**(D1·D2·D3 이 인용한 변이가 위 선택 증거와 같은 변이다 — 중복 계상하지 않는다) · **EP-15 전수 확인 3**(MV-7 생산 · MV-8 표시 · MV-11 운반) = **표 행 11**. 표 행 11 ✅.
- 새로 만든 oracle 3건(레지스트리 6종 대조 · coordinator 정착 · IPC 핸들러)은 전부 **직접 행동 oracle** 이라 자체 mutation 의무가 없고, 그 감도는 위 선택 증거 5건(MV-1~MV-5)이 잰다.
- **덮개 회귀: 없다.** 장치를 교체·삭제한 곳이 0이다 — 기존 파일에 케이스를 더하고 파일 하나를 새로 만들었을 뿐이다. r1 이 RED 로 관측한 M1·M2 를 이번 턴에 다시 심어 **같은 RED 3·RED 4** 를 재현했다.

## [구현자 기입] r2 — Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **해당 없음** — 이번 라운드는 사용자 대면 표면을 만들지 않았다(프로덕션 diff 0) | — |
| seam 을 만들려고 production 을 재배치했는가 | **아니다.** 네 오라클 전부 기존 seam 으로 닿았다 — `resolve`(순수) · coordinator `forward` 스파이(기존 하네스) · `vi.mock('electron')`(선례 7건) · 기존 렌더/생산자 테스트 | — |
| 이번에 만든 실패 경로가 §5 상태 전이표의 어느 행인가 | 새 실패 경로 **0** | — |
| 실패가 화면에서 "아무 일도 안 일어남" 으로 보이지 않는가 | 화면 변경 0. 다만 오라클이 그것을 **처음으로 관측**한다 — `false` → reject 가 이제 핸들러에서 단언된다(AC25) | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 이번 라운드 변경 없음 — r1 판정 유지 | — |
| 사용자가 이 라운드 뒤 다르게 보는 것이 있는가 | **없다.** 잠금만 늘었다 | — |

## [구현자 기입] r2 — 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| P6 | **ΔV1 self-review 의 EP-15 전수 검색 술어가 재현되지 않는다.** `grep -rn "cause"` 는 표시 지점을 잡지 못한다 — 그 파일에 `cause` 가 0회다. 술어 하나로 세면 분모가 3이 아니라 2로 조용히 줄어든다 | **선조치 — 술어를 고쳐 다시 셌다.** 생산·소비는 `cause`, 표시는 `settlementMessage` 두 술어의 합집합으로 3지점을 확정하고 각각 변이를 심었다(MV-6·MV-7·MV-8). §10 EP-15 **행 자체는 옳다** — 세 지점을 파일·함수로 지목한다 | 검증자에게 보고 — 규범 행 변경은 필요 없다(자기 검산 술어의 문제) |
| P7 | **store → 순수 View 의 prop 홉이 무잠금이다 — 0212 가 만든 것만 4건.** `TaskTileContent` 의 `agentTools`·`cliVersion`, `SubAgentTileContent` 의 `pausedIds`·`backgroundedIds`. 네 줄을 **한꺼번에 지워도** `vitest run src/renderer` 가 86파일 755케이스 전건 green 이다(MV-10). D1·D2·D3 과 같은 부류 — 오라클이 seam 한 홉 앞(props-only View)에 선다 | **보고만.** plan §7 이 AC1~AC3·AC18·AC23 의 검증 수단을 *props 를 시드한 렌더 테스트*로 명시했고 §10 은 이 홉을 지점으로 세지 않는다 — 구현자가 단독으로 pair 의 관측 지점을 옮기지 않는다 | 검증자·설계자 판단: ΔV1 의 "관측 지점 규칙" 을 VP-01·VP-11·VP-16 까지 넓힐지. 넓힌다면 zustand 훅 모듈을 `vi.mock` 하는 새 oracle 이 필요하다(SSR 시드가 안 먹는 이유는 `TaskProgressList` 헤더 주석에 있다) |
| P8 | r1 보고의 수치 2건이 실측과 갈렸다(검증자 D6·D7) | **정정한다.** 변경 파일 수 실측 **41**(main 10 · renderer 17 · shared 4 · preload 1 · scripts 6 · docs 3), EP-10 도달 경로는 **3**(`TaskTileContent:227,364` · `SubAgentTileContent:313`) — 보고의 182·289·258 은 변경 전 좌표였다 | D6·D7 `closed` |

### r2 — 설계 대비 명시적 차이

- **없다.** plan §11 `ΔV1 구현 범위 (r2)` 표의 4행을 그대로 수행했다 — seam·오라클·단언 대상이 전부 표와 일치한다. 대체한 메커니즘이 0건이므로 대체물 실패 모드(만료·공유·재진입·다른 무효화 축) **네 축 모두 `해당 없음`** 이고 근거는 같다: 이번 라운드에 새 상태·새 캐시·새 저장소가 0이다(프로덕션 diff 0).

## [구현자 기입] r2 — 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **3** — 수정 2(`registry.test.ts` +35줄 · `turn-coordinator.test.ts` +91줄) · 신규 1(`src/main/app/chat-turn.background-subagent.test.ts`). **프로덕션 코드 diff 0** |
| 실행 명령 | `npm ci`(워크트리 `node_modules` 부재 — 아래) · `npm run typecheck` · `node node_modules/vitest/vitest.mjs run src/shared src/renderer src/main` · `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs --check` · `npm run lint` |
| 관측한 게이트 산출 | **typecheck 3구성 exit 0 · 진단 출력 0줄** / **vitest 278파일 2790케이스 green**(3회 실행 중 2회에서 같은 2케이스가 red — 아래 분리) / **scripts 61 pass 0 fail(8 suites)** / **doc-inventory `generated ok (9 items, 80 channels)` · `prose ok` · `links ok`** / **lint 0 error · 1 warning**(기존분 `useTranscriptVirtualizer.ts:22`) |
| 환경 기인 분리 | **워크트리에 `node_modules` 가 없었다** — plan §19 가 "이 워크트리는 설치 완료" 라 적었으나 그것은 다른 워크트리다. `npm ci` exit 0 으로 선행 조건을 만들었다. **전체 스위트 flaky 2케이스**: `features/worktrees/safe-delete.test.ts`(`Test timed out in 5000ms` + `EBUSY: rmdir`) · `infra/git/mutation-queue.test.ts`. plan §7-A 의 *알려진 기준선*과 실패 서명이 같고, 두 스위트를 따로 돌리면 **12파일 63케이스 green**(기본 5,000ms·`--testTimeout=60000` 양쪽). 이번 변경은 두 파일을 건드리지 않는다(diff 3파일 전부 0212 범위) |
| V-pair 자기확인 | REQUIRED 17 + REGRESSION 5 = **22 전건 SELF_PASS**, SELF_BLOCKED 0. r1 의 root `PAIR_FAIL` 3건(VP-08·VP-13·VP-17)이 이번 라운드 대상이다 |
| 강제 지점 전수 | 이번 라운드가 연 것 — EP-11 **2/2** · EP-06·EP-07 **2/2** · EP-14 **2/2** · EP-15 **3/3**. 나머지 EP 는 r1 잠금 유지(프로덕션 diff 0) |
| AC 자기보고 | **✅27 · ⚠️0 · ❌0.** r1 검증자 재측정 ✅22 를 상속하고 **AC14(❌→✅) · AC15(⚠️→✅) · AC22(❌→✅) · AC25(❌→✅)** 를 닫았으며 **AC27(ΔV1 신설)** 을 렌더 2케이스 + MV-6 로 확인했다 |
| 합계 검산 | ✅27 · ⚠️0 · ❌0 = **총 27** ✅ (분모 = §7 AC1~AC27). **r1 의 26 과 직접 비교하지 않는다** — ΔV1 이 AC27 을 더해 분모가 26→27 로 바뀌었다(§7 주의사항). 상속 22 + 닫은 4 + 신설 1 = 27 ✅ |
| 파생 이슈 처리(자기보고) | **D1·D2·D3 닫음** — 각 이슈가 인용한 변이(MV-1·MV-2 / MV-3 / MV-4·MV-5)가 이제 전부 RED 다. **D6·D7 닫음** — P8 에 정정값. **D4·D5·D10 은 이미 closed**. **D8·D9 는 open 유지** — plan §11 의 r2 범위 4행 밖이고 둘 다 NON_BLOCKING 이다 |
| 블로커 / 역질문 | **없다.** P7(store→View prop 홉 4건 무잠금)은 관측 지점을 넓힐지가 규범 판단이라 보고만 한다 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

## [구현자 기입] r2 — Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **그렇다 — r1 이 연 축을 그대로 닫았다.** 불변식 한 문장은 **"값이 프로덕션 경로를 타고 도착한다는 주장은, 그 경로의 마지막 배선을 지웠을 때 red 가 되는 단언이 있어야 참이다."** 세 지점(VP-08·VP-13·VP-17)을 닫고, 같은 문장이 성립해야 할 자리를 전수로 훑어 **§10 등록 범위 안에서는 잔여 0**, 범위 밖에서 **4건**(P7)을 찾았다.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **ΔV1 이 이미 만들었다** — AC14·15·22·25 의 `검증 수단` 칸에 관측 지점이 박혀 있어 이번 라운드는 그 문장을 그대로 코드로 옮겼다. r1 이 못 걸린 이유는 `production path` 와 `oracle` 이 따로 적혀 oracle 이 path 의 어디에 있어도 참이었기 때문이다(ΔV1 §7 주의사항이 그렇게 적는다).
- 반복해서 부딪히는 환경 한계: ① **워크트리마다 `node_modules` 를 새로 설치해야 한다** — plan 이 "설치 완료" 라 적어도 그것은 그 워크트리의 사실이다. ② `.bin/vitest` shim 이 Win32 실행 파일이 아니라 `node node_modules/vitest/vitest.mjs` 로 부른다(r1 과 같은 한계). ③ 전체 스위트를 `| tail` 로 자르면 실패 **이름**이 사라진다 — 1차 실행에서 2 failed 를 얻고도 무엇인지 몰라 3차 실행으로 다시 잡았다.
- 현재 라운드 수: **2**

---

## [구현자 기입] r3 — 설계 리뷰

- 동의 / 그대로 진행: verify r2 D11 의 대응 방향 그대로다 — `session-runtime.test.ts` 의 기존 `GovernedLiveTurn` fake 하네스가 실측과 일치했고(`:31`·`:150`·`:1119`) production `SessionRuntime` 을 직접 `new` 해 닿았다. **프로덕션 코드 diff 0**.
- 이견 / 현실성 문제: **없다.** 차단 `PLAN_GAP` 0건 — D11 을 닫는 데 새 계약이 필요하지 않았다.
- ACTIVE Decision 과 충돌하는 설계 발견: **0건.** 프로덕션 표면을 바꾸지 않아 충돌할 자리가 없다.
- 보고 2건: 클릭 홉 3사이트는 DOM 환경·신규 의존성이 있어야 잠긴다(P9) · 이전 라운드들의 게이트 명령이 `src/preload` 를 건너뛴다(P10).

## [구현자 기입] r3 — 강제 지점 전수 (§10 대조)

이번 라운드가 여는 EP 만 적는다. 나머지는 r1·r2 가 닫았고 **프로덕션 diff 가 0**이라 재측정만 했다(전체 스위트 green, 아래 게이트).

| Pair | 계약 | §10 지점 | r2 잠금 | r3 잠금 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-17·18 | 전환은 `toolUseId` 단건 · 실패를 삼키지 않는다 | EP-14 — **지점 2** | 1/2 | **2/2** | 핸들러 `chat-turn/index.ts:213` → MV-4 **RED 2** · MV-5 **RED 1**. `session-runtime.ts:651-652` → N8 인자 오염 **RED 2** · N9 본문 폐기 **RED 2**(둘 다 r2 에서 GREEN 2790) | — |

**AC25 production path 8사이트 독립 재열거** — §10 은 이 중 2를 센다. `실패 의미`("인자를 흘리면 다른 태스크가 백그라운드로 간다")가 성립하는 지점 전수다.

| # | 홉 | r3 이전 | r3 이후 |
|---|---|---|---|
| ① | `TaskTileContent.tsx:223`·`:359` onClick | GREEN | **미잠금 — P9** |
| ① | `SubAgentTileContent.tsx:309` onClick | GREEN | **미잠금 — P9** |
| ② | `chatStore.ts:872` store action | RED 1 | 잠김(재측정) |
| ③ | `shared/api/ipc.ts:74` renderer api | RED 1 (r2 N7) | 잠김(r2 좌표 참조) |
| ④ | `preload/index.ts:102` wire | **GREEN** | **RED 1** — 신설 `src/preload/index.test.ts` |
| ⑤ | `chat-turn/index.ts:213` main 핸들러 | RED 2 | 잠김(재측정) |
| ⑥ | `session-runtime.ts:652` 포트 구현 | **GREEN** | **RED 2** — `session-runtime.test.ts` 신설 5케이스 |
| ⑦ | `claude.ts:507` 어댑터→SDK | **GREEN** | **RED 2** — 신설 `claude.live-control.test.ts` |

- **차집합**: 8사이트 중 잠긴 것 **5부류**(②③④⑤⑥⑦), 남은 것 **① 클릭 3사이트**. 잔여 0이 아니다 — 남긴 곳은 P9 다.
- **같은 형상의 형제 홉도 함께 닫았다**(§5 전수). `SessionRuntime` 의 `this.live?.X(arg)` forwarder는 **4개**(`setPermissionMode:636`·`setModel:644`·`stopTask:648`·`backgroundTask:652`)이고 r3 이전 **4/4 무잠금**이었다 — 넷 다 인자 변이가 이제 RED 다. `ClaudeAdapter` 의 위임 3개 중 2(`stopTask`·`setModel`)와 preload 형제 채널(`stopSubagent`)도 같이 잠갔다.
- §10 에 없는데 같은 불변식이 필요한 지점: **① 클릭 3사이트**(P9) · ④⑦(이번에 닫음, 규범 행 없음). 셋 다 규범 분모 확대 여부는 설계 판단이다.

**V-pair 자기확인 (r3)** — 유효 V = 22 pair(REQUIRED 17 · REGRESSION 5).

| Pair | requiredness | r2 결과(검증자) | r3 자기 상태 | 이번 라운드 직접 관측 |
|---|---|---|---|---|
| VP-17 | REQUIRED | **PAIR_FAIL** | **SELF_PASS** | EP-14 2/2 — 핸들러(MV-4·MV-5)와 `session-runtime`(N8·N9) 양쪽이 RED |
| VP-18 | REQUIRED | PASS | **SELF_PASS** | 실패 비삼킴 — `live` 부재 시 포트 미호출 + `false`, live 의 `false` 를 그대로 전파 |
| VP-10·VP-19 | REGRESSION | PASS | **SELF_PASS** | `stopTask` 전달 홉 2개(runtime·adapter)가 이번에 RED — 기존 `stop-subagent` 스위트는 무변경 green |
| VP-01·02·03·04·05·06·07·08·09·11·12·13·14·15·16·20·21·22 (18) | REQUIRED 14 · REGRESSION 4 | PASS | **SELF_PASS(상속)** | 프로덕션 diff 0 이고 전체 스위트 **280파일 2800케이스 green** |

- `SELF_BLOCKED` 0 · `NOT_REQUIRED` 0.

## [구현자 기입] r3 — 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| MV-4 핸들러의 `turn.live.backgroundTask` 호출 제거 | VP-17 선택 증거(ΔV1) | r2 RED 2 | 2 failed / 2798 | **RED** |
| MV-5 같은 호출의 인자를 상수 `'use1'` 로 | VP-17 선택 증거(ΔV1) | r2 RED 1 | 1 failed / 2798 | **RED** |
| N8 `SessionRuntime.backgroundTask` 인자 오염(`+ '-x'`) | **D11 인용 변이** | **r2 GREEN 2790** | 2 failed / 2798 | **RED** |
| N9 `SessionRuntime.backgroundTask` 본문 폐기(`return false`) | **D11 인용 변이** | **r2 GREEN 2790** | 2 failed / 2798 | **RED** |
| N2c preload `{ sessionId, toolUseId }` 맞바꿈 | **D12 인용 변이** | **r2 GREEN 2790** | 1 failed / 2798 | **RED** |
| SR-1 `SessionRuntime.stopTask` 인자 오염 | 새 oracle 감도(형제 홉) | r3 사전 측정 GREEN 2790 | 1 failed / 2798 | **RED** |
| SR-2 `SessionRuntime.setModel` 인자 상수화 | 새 oracle 감도(형제 홉) | r3 사전 측정 GREEN | 1 failed / 2798 (+무관 1, 아래) | **RED** |
| SR-3 `SessionRuntime.setPermissionMode` 인자 상수화 | 새 oracle 감도(형제 홉) | r3 사전 측정 GREEN 2790 | 1 failed / 2798 | **RED** |
| PL-1 preload 의 채널 상수를 `chatStopSubagent` 로 교체 | 새 oracle 감도(형제 슬롯) | 미측정 | 1 failed / 2798 | **RED** |
| PL-2 preload `stopSubagent` 인자 맞바꿈 | 새 oracle 감도(형제 채널) | 미측정 | 1 failed / 2800 | **RED** |
| CA-1 `claude.ts:507` `backgroundTasks` 인자 오염 | 새 oracle 감도 | **r3 사전 측정 GREEN 2798** | 2 failed / 2800 (+무관 1) | **RED** |
| CA-2 `claude.ts:505` `stopTask` 인자 오염 | 새 oracle 감도(형제 위임) | 미측정 | 1 failed / 2800 | **RED** |

- 분모 검산: **선택 증거 2**(VP-17 ← MV-4·MV-5) · **인용 변이 3**(D11 ← N8·N9 · D12 ← N2c) · **새 oracle 감도 7**(SR-1·2·3 · PL-1·2 · CA-1·2) = **표 행 12**. 표 행 12 ✅.
- **덮개 회귀: 없다.** 장치를 교체·삭제한 곳이 0이다 — 기존 파일에 케이스를 더하고 파일 둘을 새로 만들었을 뿐이다(삽입만, 삭제 0). r2 가 RED 로 관측한 MV-4·MV-5 를 이번 턴에 다시 심어 **같은 RED 2·RED 1** 을 재현했다.
- **잔여물 수렴**: 12행 중 SR-2·SR-3 만 `error TS 1`(변이가 만든 미사용 파라미터)이고, 두 행의 red 는 진단이 아니라 **단언 실패**다(`expected [['x'],['x']] to deeply equal [['opus'],['sonnet']]`). 나머지 10행은 `typecheck error TS 0` 에서 얻은 red 다.
- **무관 실패 분리**: SR-2·CA-1 실행에서 `infra/git/mutation-queue.test.ts` 가 함께 red 였다(`AssertionError: expected true to be false`). 단독 실행 2회는 green 이고 변이는 각각 `session-runtime.ts`·`claude.ts` 한 줄이라 인과가 없다 — P11.

## [구현자 기입] r3 — Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **해당 없음** — 사용자 대면 표면을 만들지 않았다(프로덕션 diff 0) | — |
| seam 을 만들려고 production 을 재배치했는가 | **아니다.** 세 오라클 전부 기존 seam 을 썼다 — `new SessionRuntime(adapter(live))`(기존 하네스) · `contextBridge.exposeInMainWorld` 포획 · `vi.mock('@anthropic-ai/claude-agent-sdk')`(선례 7파일) | — |
| 이번에 만든 실패 경로가 §5 상태 전이표의 어느 행인가 | 새 실패 경로 **0** | — |
| 실패가 화면에서 "아무 일도 안 일어남" 으로 보이지 않는가 | 화면 변경 0. 다만 `live` 부재 → `false` → 핸들러 reject 경로가 **처음으로 runtime 층에서** 단언됐다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 이번 라운드 변경 없음 — r1 판정 유지 | — |
| 사용자가 이 라운드 뒤 다르게 보는 것이 있는가 | **없다.** 잠금만 늘었다 | — |

## [구현자 기입] r3 — 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| P9 | **클릭 홉 3사이트가 무잠금이다.** `TaskTileContent.tsx:223`·`:359` 와 `SubAgentTileContent.tsx:309` 의 `onClick` 인자를 상수 `'use1'` 로 굳혀도 2798케이스가 전건 초록이다. AC25 의 문장은 "**클릭하면** 그 `toolUseId` 로" 라 이 홉이 그 문장의 첫 글자다 | **보고만.** 닫으려면 DOM 환경이 필요한데 이 저장소는 `vitest.config.ts` 가 `environment: 'node'` · `include: ['src/**/*.test.ts']` 이고 `jsdom`·`happy-dom`·testing-library 가 **의존성에 없다**. 신규 의존성은 사용자 승인 사항이다(`app/AGENTS.md §의존성 정책`) | 설계·사용자 판단: DOM 환경을 들일지, 아니면 onClick 을 순수 함수로 떼어 잠글지 |
| P10 | **이전 라운드들의 게이트 명령이 `src/preload` 를 건너뛴다.** plan §7-A·§19 와 r1·r2 가 쓴 `vitest run src/shared src/renderer src/main` 은 **279파일 2797케이스**이고, 인자 없는 `vitest run` 은 **280파일 2800케이스**다 — 차이가 정확히 이번에 만든 `src/preload/index.test.ts` 3케이스다 | **선조치 — 이번 보고의 게이트는 인자 없는 `vitest run` 으로 돌렸다.** plan §7-A 관련 스위트 행과 §19 의 명령에 `src/preload` 를 더하거나 경로 필터를 빼는 정정을 제안한다 | 규범 행(§7-A gate·§19)이라 설계자 몫 |
| P11 | `infra/git/mutation-queue.test.ts` 가 전체 스위트 병렬 실행에서 **3회 red**, 단독 실행 **2회 green** 이다. 실패 형태가 `AssertionError: expected true to be false` 라 plan §7-A 가 적은 알려진 기준선(`timed out in 5000ms` · `EBUSY: rmdir`)과 **다르다** | **보고만** — 이번 변경과 인과가 없다(변이는 `session-runtime.ts`·`claude.ts` 한 줄). 최종 게이트 실행에서는 green 이었다 | 별도 handoff 후보 — §7-A 의 알려진 기준선 서술에 이 형태를 더할지 |
| P12 | **win32 분기의 최종 확인은 CI 몫이다** — 검증 환경이 Linux 라 `commandForTarget` 이 내는 명세(`shell:true`)까지만 잠근다 | r3 후속 턴 · §7-A 선행 조건 gate | 다음 windows-latest 실행이 판정. 실패해도 로그가 사유를 말한다 | NON_BLOCKING | open (r3 제기) |
| P13 | **`postinstall` 등 4개 훅이 Windows 에서 수명 내내 무음 no-op 이었다**(0212 r1 이 가드를 고치기 전까지). `app/AGENTS.md §ABI 가이드` 의 "4개 명령이 ABI 를 뒤집는다" 가 Windows 에서는 참이 아니었다 | `app/AGENTS.md` 서술 ↔ 코드 | 코드는 이 턴으로 서술과 일치. 문서 정정 여부는 설계자 판단 | NON_BLOCKING | open (r3 제기) |

### r3 — 설계 대비 명시적 차이

- **없다.** plan ΔV1 §11 의 `r2 범위` 표는 r2 가 소진했고, r3 는 verify r2 의 파생 이슈(D11 BLOCKING · D12 선조치)와 §5 전수 확장을 수행했다. plan 이 지정한 메커니즘을 다른 것으로 **대체한 곳이 0건**이므로 대체물 실패 모드 네 축(만료·공유·재진입·다른 무효화)은 전부 `해당 없음` 이고 근거는 같다: 이번 라운드에 새 상태·새 캐시·새 저장소가 0이고 프로덕션 diff 가 0이다.

## [구현자 기입] r3 — 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **3** — 수정 1(`src/main/features/sessions/session-runtime.test.ts` +99줄) · 신규 2(`src/preload/index.test.ts` · `src/main/adapters/claude.live-control.test.ts`). **프로덕션 코드 diff 0** |
| 실행 명령 | `npm ci` · `npm rebuild better-sqlite3` · `npm run typecheck` · `./node_modules/.bin/vitest run`(경로 필터 없음 — P10) · `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs --check` · `npm run lint` |
| 관측한 게이트 산출 | **typecheck `error TS` 0건** / **vitest 280파일 2800케이스 green** / **scripts 61 pass 0 fail(8 suites)** / **doc-inventory `generated ok (9 items, 80 channels)` · `prose ok` · `links ok`** / **lint 0 error · 1 warning**(기존분 `useTranscriptVirtualizer.ts:22`). lint 실행 후 `git status --porcelain` 에 도구 변경분 0 |
| 환경 기인 분리 | `npm ci` 는 `postinstall` 로 better-sqlite3 를 Electron ABI 로 만든다 — 그 상태의 DB 스위트 red 는 `Module did not self-register` 서명이고 `npm rebuild better-sqlite3`(exit 0) 로 분리했다. `npm test` 미사용. P11 의 `mutation-queue` 병렬 flake는 위에 따로 적었다 |
| V-pair 자기확인 | REQUIRED 17 + REGRESSION 5 = **22 전건 SELF_PASS**, SELF_BLOCKED 0. r2 의 root `PAIR_FAIL` **VP-17** 이 이번 라운드 대상이다 |
| 강제 지점 전수 | 이번 라운드가 연 것 — **EP-14 2/2**(핸들러 · `session-runtime`). 나머지 EP 는 r1·r2 잠금 유지(프로덕션 diff 0) |
| AC 자기보고 | **✅27 · ⚠️0 · ❌0.** r2 **검증자 재측정** ✅26 을 상속하고 **AC25(⚠️→✅)** 를 닫았다 — ΔV1 이 지정한 관측 지점(`turn.live.backgroundTask` 포트, "그 id 로 1회")이 충족되고 그 포트의 production 구현(`session-runtime`)까지 잠겼다. 클릭 홉은 §10 분모 밖이라 P9 로 남긴다 |
| 합계 검산 | ✅27 · ⚠️0 · ❌0 = **총 27** ✅ (분모 = §7 AC1~AC27). 분모는 ΔV1 이후 불변이라 r2 의 27 과 직접 비교한다 — 상속 26 + 닫은 1 = 27 ✅ |
| 파생 이슈 처리(자기보고) | **D11 닫음** — 인용 변이 N8·N9 가 이제 전부 RED. **D12 닫음** — 인용 변이 N2c 가 RED. **D3 닫음** — 인용 변이 MV-4·MV-5 재현 RED 이고 같은 EP 의 두 번째 지점(D11)도 닫혔다. **D1·D2·D4·D5·D6·D7·D10 은 이미 closed**. **D8·D9·D13·D14 는 open 유지** — 이번 범위 밖이고 넷 다 NON_BLOCKING 이다 |
| 블로커 / 역질문 | **없다.** P9(클릭 홉)는 신규 의존성이 필요해 보고만 하고, P10(게이트 명령 범위)은 규범 행 정정 제안이다 |
| 대상 커밋 | `(r3 구현 — 좌표는 INDEX)` |

## [구현자 기입] r3 — Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **그렇다 — 네 라운드째 같은 축이다.** r1 D1·D2·D3, r2 D11 이 전부 "oracle 이 경로의 한 홉 앞에 선다" 였다. 불변식 한 문장은 **"값이 여러 홉을 지나 도착한다는 주장은, 각 홉에서 그 값을 오염시켰을 때 red 가 되는 단언이 있어야 참이다."** 이번에는 그 문장을 지점 이름 없이 올려 **AC25 경로 8사이트를 전수로 재열거**했고, 잠긴 5부류와 남은 3사이트(P9)를 차집합으로 적었다.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **부분적으로 있었다.** ΔV1 이 만든 "관측 지점 규칙" 은 AC14·15·22·25 **네 AC 에만** 걸렸고, §10 EP-14 의 분모는 경로 8사이트 중 **2**만 센다. 그 2를 다 닫아도 나머지 6사이트 중 3(④⑥⑦)이 무잠금이었다 — 분모가 경로보다 짧으면 `N/N` 이 경로를 말하지 못한다.
- 사용자 결정 변경 근거: 없음 — ACTIVE Decision 27건 전건 유지, SUPERSEDED 0.
- 반복해서 부딪히는 환경 한계: ① 워크트리에 `node_modules` 부재 → `npm ci` 필요(r2 와 동일). ② `npm ci` 직후는 Electron ABI 라 DB 스위트 red — `npm rebuild better-sqlite3` 로 분리(r2 와 동일). ③ **경로 필터를 준 게이트 명령이 새 디렉토리의 테스트를 조용히 건너뛴다**(P10, 이번 라운드 신규). ④ DOM 환경·testing-library 부재로 클릭 홉을 잠글 수 없다(P9, 이번 라운드 신규).
- 현재 라운드 수: **3**

---

## [구현자 기입] r3 — 후속 턴: CI red gate (windows-latest)

> **라운드는 3 그대로다** — 같은 라운드의 둘째 턴이다(0210 선례: 턴 `r3` 오라클 → 턴 `r4` CI red gate).
> 위 r3 절의 7필드 중 **설계 리뷰 · Product/UX 파생 검토 · 설계 대비 차이**는 이 턴에 변동이 없다(사용자 대면 표면 0 · 대체 메커니즘 0).

### 사실 — 무엇이 red 였나

사용자 보고(2026-09-02, windows-latest · Node 22):

```text
> node scripts/ensure-sqlite-abi.mjs electron
[sqlite-abi] ensure failed for electron
npm error code 1
```

- **자식 출력이 0줄이다.** `defaultRunner` 는 `stdio:'inherit'` 라 `electron-builder` 가 돌았다면 그 출력이 보여야 한다 — 안 보이므로 **자식이 뜨지 못했다**(spawn 자체 실패).
- 원인: `commandForTarget` 이 win32 에서 **`electron-builder.cmd` 를 `shell:false` 로** 넘긴다. `spawn` 은 shell 없이 **실행 이미지(`.com`/`.exe`)만** 띄울 수 있다 — 이 저장소의 `node_modules/cross-spawn/lib/parse.js` 가 같은 규칙을 코드로 갖는다(`isExecutableRegExp = /\.(?:com|exe)$/i` → `needsShell`).
- **이 handoff 가 드러냈다.** r1 의 P2 가 진입 가드를 `pathToFileURL` 비교로 고치기 전까지, Windows 에서는 `import.meta.url === \`file://${argv[1]}\`` 가 성립하지 않아 **CLI 본문이 한 번도 돈 적이 없다**(무음 exit 0). 가드가 고쳐지자 4개 훅(`postinstall`·`pretest`·`predev`·`prebuild`)이 Windows 에서 처음 실행됐고 그 아래 있던 결함이 나왔다. verify r2 **D14** 가 같은 사실을 반대쪽에서 관측했다(POSIX 에서는 깨진 형태가 우연히 참).

### 수정 — 두 불변식

| 불변식 | 지점 전수 | 닫음 | 차집합 |
|---|---|---|---|
| **Windows 에서 실행 이미지가 아닌 것은 shell 을 거친다** | `commandForTarget` 의 명령 2종(`npm.cmd`·`electron-builder.cmd`). 나머지 spawn 3곳은 `git`(→`git.exe`)·`process.execPath` 라 비대상 | 2/2 — 술어를 `/\.(?:cmd\|bat)$/i` 로 두어 **명령 이름 목록이 아니라 규칙**으로 판정 | **0** |
| **spawn 실패 사유를 삼키지 않는다** | `defaultRunner`(error 반환) → `ensureSqliteAbi`(버림) → `runCli`(한 줄만 출력) = 3홉 | 3/3 — `describeRunFailure` 신설, `reason` 을 결과에 싣고 `runCli` 가 출력 | **0** — 형제 `check-migrations-appendonly.mjs:154` 는 이미 `result.error` 를 문장에 싣는다(선례) |

- **`pretest` 도 같이 고쳐졌다** — node target 은 `npm.cmd` 라 같은 결함이었다. CI 는 `npm ci` 다음에 `npm test` 를 돌리므로 이 턴이 없었으면 다음 단계에서 같은 자리에 다시 걸린다.
- 관측: `commandForTarget` 를 세 플랫폼 × 두 target 전수 실행 — win32 2종 `shell:true`, linux·darwin 4종 `shell:false`.
- 출력이 실제로 달라졌다: `[sqlite-abi] check failed for electron: electron ABI marker is stale`(전: 사유 없음).

### 이번 턴 수정의 잠금

`commandForTarget` 의 플랫폼 분기는 **테스트가 0건**이었다(`rg commandForTarget scripts/ensure-sqlite-abi.test.mjs` → 0). 그래서 깨진 채 배포됐다.

| 심은 결함 | 출처 | 실패한 케이스 | 결과 |
|---|---|---|---|
| M-A `shell` 을 항상 `false` 로 되돌림 (**이번 CI 회귀 그 자체**) | 새 oracle 감도 | 2 — win32 분기 · 전수 불변식 | **RED** |
| M-B win32 에서 `.cmd` 를 떼고 `electron-builder` 로 | 새 oracle 감도 | 1 — win32 분기 | **RED** |
| M-C `ensureSqliteAbi` 가 `shell` 을 runner 에 안 넘김 | 새 oracle 감도(배선) | 1 — 전달 단언 | **RED** |
| M-D `reason` 을 상수 `'failed'` 로 | 새 oracle 감도 | 1 — 사유 단언 | **RED** |

- 분모 검산: **선택 증거 0**(plan 이 이 축에 등록한 적대 증거 없음) · **인용 변이 0** · **새 oracle 감도 4** = **표 행 4**. 표 행 4 ✅.
- **덮개 회귀: 없다.** 기존 7케이스는 그대로 두고 6케이스를 더했다(61 → **67**). 다만 기존 2케이스가 `ensureSqliteAbi` 결과 shape 을 `deepEqual` 로 고정하고 있어 `reason` 추가에 맞춰 갱신했다 — shape 이 실제로 늘어난 것이라 단언을 약화한 것이 아니다.
- **전수 케이스를 목록이 아니라 규칙으로 썼다** — `모든 target × 플랫폼에서 .cmd/.bat 이면 shell 이 참이다` 는 차집합(`offenders`)이 빈 배열임을 단언하므로 새 target 이 늘어도 함께 걸린다.

### 놓친 잠재 문제 + 대응 (이 턴)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| P12 | **최종 확인은 Windows CI 가 해야 한다.** 이 환경은 Linux 라 win32 분기를 *실행*할 수 없다 — 잠근 것은 `commandForTarget` 이 내는 **명세**(`shell:true`)이고, 그 명세로 `cmd.exe` 가 실제로 `electron-builder.cmd` 를 띄우는지는 windows-latest 에서만 관측된다 | 보고 — 다음 CI 실행이 판정이다. 실패해도 이제 로그가 사유를 말한다(`spawn '...' failed (CODE): ...`) | 사람/CI 몫 |
| P13 | **`postinstall` 이 Windows 에서 수명 내내 무음 no-op 이었다** — 0212 r1 이 가드를 고치기 전까지 4개 훅 전부. 즉 Windows 개발자·CI 는 ABI 보장 없이 돌아왔고, `app/AGENTS.md §better-sqlite3 ABI 가이드` 의 서술("4개 명령이 ABI 를 뒤집는다")이 Windows 에서는 참이 아니었다 | 보고만 — 문서 정정 여부는 설계자 판단이다. 코드는 이 턴으로 서술과 일치하게 됐다 | `docs/` 규범 행이라 설계자 몫 |

### 구현 보고 (이 턴)

| 항목 | 내용 |
|---|---|
| 변경 파일 | **2** — `app/scripts/ensure-sqlite-abi.mjs`(프로덕션 스크립트) · `app/scripts/ensure-sqlite-abi.test.mjs`(+6케이스). **`app/src` diff 0** |
| 관측한 게이트 산출 | typecheck **`error TS` 0건** · vitest **280파일 2800케이스 green** · scripts **67 pass 0 fail(8 suites)** — 이번 턴 61→67 · doc-inventory **3줄 ok** · lint **0 error / 1 warning**(기존분), 트리 변경 0 |
| AC 자기보고 | **✅27 · ⚠️0 · ❌0 / 27 — 불변.** 이 턴은 AC 축이 아니라 §7-A 의 **선행 조건 gate**(`npm ci`)를 고쳤다 |
| 강제 지점 전수 | 이번 턴이 연 것 — win32 shell **2/2** · 실패 사유 전달 **3/3**. §10 EP 표에는 이 축의 행이 없다(P13 과 함께 설계자 판단) |
| 블로커 / 역질문 | **없다.** P12 는 CI 관측 대기, P13 은 문서 정정 제안이다 |
| 대상 커밋 | `(r3 후속 — 좌표는 INDEX)` |

### Review Signals (이 턴)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **아니다 — 새 축이다.** r1~r3 는 "oracle 이 경로의 한 홉 앞에 선다" 였고, 이 턴은 **"플랫폼 분기가 한 번도 실행된 적 없다"** 다. 다만 뿌리는 같다: `commandForTarget` 의 win32 분기는 테스트가 0건이었고 Windows 진입 가드가 깨져 런타임에서도 안 돌았다 — **두 눈이 동시에 없었다**.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **없다.** 0212 의 V 는 이 스크립트를 계약으로 갖지 않는다(P2 가 범위 밖 선조치였고 verify r1 이 D10 으로 존치 판정했다). §7-A 의 `선행 조건 — 의존성 설치` 행이 이 gate 를 적지만 지점·oracle 은 없다.
- 사용자 결정 변경 근거: 없음.
- 반복해서 부딪히는 환경 한계: **검증 환경이 Linux 라 타겟 플랫폼(Windows)의 분기를 실행할 수 없다.** 이 턴은 그것을 *명세 단언*으로 우회했고(플랫폼을 인자로 받는 순수 함수), 실행 확인은 CI 몫이다.
- 현재 라운드 수: **3** (둘째 턴)

---

## [검증자 기입] 파생 이슈

> r1 검증 = **FAIL + PLAN_GAP**, r2 검증 = **FAIL**(`PLAN_GAP` 0). 판정 원문과 관측은 [`verify.md`](verify.md) — 아래는 이관 표다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | 전용 본문이 **레지스트리를 경유해** 붙는지 보는 단언이 0건이다 — 등록 블록 전체 삭제(MV-1)와 match 를 6종으로 확장(MV-2) 둘 다 게이트 전건 초록이다. AC22 의 "6종 전량 대조" 단언이 없다 | VP-13 · AC22 · §10 EP-11 | `registry.test.ts` 에 4종 → `task_list` 와 `TaskOutput`/`TaskStop` → 폴백 kind 를 넣는다. **ΔV1 이 AC22 의 관측 지점을 `resolve` 로 못박고 VP-13 에 소거·확장 두 변이를 등록했다** | **BLOCKING** | **closed (r2)** — MV-1·MV-2 각 RED 1 |
| D2 | 레벨 신호가 **정착을 일으키는지** 보는 단언이 0건이다 — `turn-coordinator.ts` 의 `subagent.backgroundSet` 블록 전체 삭제(MV-3)에 229파일 2410케이스가 침묵한다 | VP-08 · AC14 · §10 EP-06·EP-07 | `turn-coordinator.test.ts` 에 payload 2회 주입 후 정착 대상과 `stopLive:false` 를 단언. **ΔV1 이 AC14·15 의 관측 지점을 coordinator 정착으로 못박고 VP-08 에 분기 소거 변이를 등록했다** | **BLOCKING** | **closed (r2)** — MV-3 RED 2 |
| D3 | 전환 요청이 **포트까지** 가는지 보는 단언이 0건이다 — 관측이 renderer 경계에서 끝난다. "`vi.mock('electron')` 선례 0건" 은 사실이 아니다(선례 7건, 그중 하나가 같은 `registerChatHandlers` 를 부른다) | VP-17 · AC25 · §10 EP-14 | 같은 하네스로 핸들러를 불러 `backgroundTask('use1')` 1회와 `false`→reject 를 단언. **ΔV1 이 AC25 의 관측 지점을 포트로 못박고 VP-17 에 호출 소거·인자 고정 변이를 등록했다** | **BLOCKING** | **closed (r3)** — MV-4 RED 2 · MV-5 RED 1 재현, 두 번째 지점도 닫혔다(D11) |
| D4 | 중단 정착의 사유를 어느 키가 나르는지에 **규범 행이 없다** — AC21 과 상속 계약 0204 AT-31 이 `message` 한 자리를 두고 반대를 요구했고 구현자가 `cause` 키를 발명해 둘을 세웠다. 0204 D11 이 같은 자리에 "규범 정정이 선행" 을 적어 두었다 | VP-12 · AC21 · 0204 D-024/D11 | 설계자가 ΔV1 로 닫았다 — **D-026·D-027** 신설 · **AR-05·R-93** node · **VP-21·VP-22** pair · **AC21 정정 + AC27 신설** · **§10 EP-15**(지점 3) · §5 상태표 3행 | **PLAN_GAP** | **closed (ΔV1)** |
| D5 | INDEX r1 비고가 924자(≈10줄)로 5줄 상한을 넘었다 | `AGENTS.md §산출물 문장 규칙 3` | 검증자가 이번 턴에 5줄로 교체 | NON_BLOCKING | **closed** |
| D6 | 구현 보고 변경 파일 수 40 ↔ 실측 **41**. 내역도 main 8↔**10** · renderer 13↔**17** 이고 보고 내역 합 38 이 보고 총계 40 과도 다르다 | 구현 보고 정확도 | 다음 라운드 보고에서 정정 | NON_BLOCKING | **closed (r2)** — P8 정정값이 실측과 일치 |
| D7 | §10 대조표 EP-10 이 "도달 경로 2" 라 쓰고 같은 칸이 좌표 3개를 연다. 좌표도 변경 전 줄번호다(182·289·258 → 실제 227·364·313) | 구현 보고 정확도 | 다음 라운드 보고에서 정정 | NON_BLOCKING | **closed (r2)** — P8 정정값이 실측과 일치 |
| D8 | `chat.taskTool.fetched`(ko·en)의 소비처가 0이다 — `KIND_KEY` 는 4키만 쓴다 | 죽은 표면 | 제거하거나 `TaskGet` 본문에 소비처를 만든다 | NON_BLOCKING | open |
| D9 | P2 의 신설 oracle 이 "출력이 비어 있지 않다" 라, `ensure-sqlite-abi.mjs --check` 는 `parseArgs` throw 의 catch 만 관측한다(5중 1) | 이번 턴 신설 배선 oracle | 유효 인자를 주거나 기대 출력 접두를 단언 | NON_BLOCKING | open |
| D10 | P2 가 0212 범위 밖 스크립트 4종을 함께 고쳤다 | 범위 | **존치** — 5개가 같은 한 줄의 사본이고 그중 하나가 이번 변경의 필수 gate 다 | NON_BLOCKING | **closed** |
| D11 | **§10 EP-14 가 적은 두 main 지점 중 `session-runtime` 이 무잠금이다.** 구현자가 핸들러 한 지점에 변이 둘(MV-4·MV-5)을 심고 `2/2` 로 보고했다. `SessionRuntime.backgroundTask` 의 인자를 오염시켜도(N8) 본문을 폐기해도(N9) **278파일 2790케이스 green · typecheck 0** 이다 | VP-17 · AC25 · §10 EP-14 (root VP-17) | 구현 — `session-runtime.test.ts` 의 기존 `GovernedLiveTurn` fake 하네스(`:31`·`:150`·`:1119`)로 `backgroundTask('use1')` 을 불러 인자·횟수와 `live` 부재 시 `false` 를 단언한다. electron 비의존 | **BLOCKING** | **closed (r3)** — N8 인자 오염 **RED 2** · N9 본문 폐기 **RED 2**(둘 다 r2 GREEN 2790). EP-14 **2/2** |
| D12 | **preload 홉이 무잠금이다.** `preload/index.ts:101-102` 의 `{ sessionId, toolUseId }` 를 맞바꿔도 2790케이스 green · typecheck 0(N2c). EP-14 의 `실패 의미` 가 바로 이 상태인데 §10 이 이 홉을 지점으로 세지 않는다 | AC25 경로 홉 4 · §10 밖 | **선조치 (r3)** — `src/preload/index.test.ts` 신설, `contextBridge.exposeInMainWorld` 가 받은 production 객체를 부른다 | NON_BLOCKING | **closed (r3)** — N2c 맞바꿈 **RED 1** · 채널 상수 교체 **RED 1** |
| D13 | **store→View prop 홉 4건이 무잠금이다**(구현자 P7 재측정). 네 줄 + 잔여(지역변수 2 · import 2)를 치워도 2790케이스 green · typecheck 0(N6). plan §7 이 검증 수단을 *props 시드 렌더 테스트* 로 명시했으므로 구현자 위반은 아니다 | VP-01·VP-11·VP-16 의 oracle 지정 밖 | 설계 판단 — ΔV1 의 관측 지점 규칙을 세 pair 까지 넓힐지. 넓히면 zustand 훅 모듈을 `vi.mock` 하는 oracle 이 필요하다 | NON_BLOCKING | open |
| D14 | **r1 의 M11(진입 가드) red 는 플랫폼 조건부다.** 깨진 형태 `` `file://${argv[1]}` `` 가 POSIX 절대경로에서 정상형과 문자열이 같아 Linux 에서 green 이다 — 이 오라클은 CI(windows-latest)에서만 감도를 갖는다 | r1 신설 oracle · D9 인접 | D9 와 함께 처리 — 비교를 순수 함수로 떼어 두 형태를 플랫폼 무관하게 단언한다 | NON_BLOCKING | open |
| P9 | **클릭 홉 3사이트가 무잠금이다** — `TaskTileContent.tsx:223`·`:359` · `SubAgentTileContent.tsx:309` 의 `onClick` 인자를 상수로 굳혀도 2798케이스 전건 초록. AC25 의 "**클릭하면** 그 `toolUseId` 로" 가 이 홉이다 | AC25 경로 홉 ① · §10 밖 | 보고만 — DOM 환경(`jsdom`/`happy-dom`)이 의존성에 없고 `vitest.config.ts` 가 `environment: 'node'`·`include: src/**/*.test.ts` 다. 신규 의존성은 사용자 승인 사항 | NON_BLOCKING | open (r3 제기) |
| P10 | **게이트 명령이 `src/preload` 를 건너뛴다** — plan §7-A·§19 의 `vitest run src/shared src/renderer src/main` 은 279파일 2797케이스, 인자 없는 `vitest run` 은 280파일 2800케이스다 | §7-A 운영 gate · §19 | **선조치 (r3)** — 이번 게이트는 경로 필터 없이 돌렸다. 규범 행(§7-A·§19)에 `src/preload` 를 더하는 정정은 설계자 몫 | NON_BLOCKING | open (r3 제기) |
| P11 | `infra/git/mutation-queue.test.ts` 가 병렬 전체 실행에서 3회 red · 단독 2회 green. 실패 형태가 `AssertionError` 라 §7-A 의 알려진 기준선(`timed out` · `EBUSY`)과 다르다 | §7-A 알려진 기준선 | 보고만 — 이번 변경과 인과 없음(변이는 다른 파일 한 줄). 최종 게이트는 green | NON_BLOCKING | open (r3 제기) |
