# TaskXXX 도구군 스펙 (Agent SDK 원문 + Orca 채택 표기)

> **본 문서의 위치**
> 이 문서는 Claude Agent SDK 의 **TaskXXX 도구군 해설 미러** 다. 외부 사실의 1차 원본은 아래 두 곳이고,
> 본 문서는 그것을 *Orca 관점* 으로 정리해 채택 표기를 덧붙인다. PRD/TRD·`arch/`·handoff 가 TaskXXX 의
> 도구 이름·필드·이벤트를 인용할 때 본 문서가 단일 출처(SSOT) 다.
>
> - **1차 원본 (설치본 타입)**: `app/node_modules/@anthropic-ai/claude-agent-sdk/` 의 `sdk-tools.d.ts`(도구 입출력)
>   · `sdk.d.ts`(system 메시지·`Query` 제어 API). **버전은 `app/package.json` 이 고정한다** — 본 문서에 적지 않는다.
> - **원격 원문**: `https://code.claude.com/docs/ko/agent-sdk/typescript` · `https://code.claude.com/docs/ko/agent-sdk/todo-tracking`
> - **동기화 책임**: SDK 를 올리면 (1) 위 두 `.d.ts` 를 다시 읽고 (2) 본 문서의 필드 표를 정합화한다.
>   사람이 수동, 자동 동기화 없음.
> - **편집 규칙**: 외부 사실(도구 이름·필드·상태값)은 설치본 타입을 따른다. 본 문서가 *추가* 하는 것은
>   **Orca 채택 박스**, 정리표, 절 번호 안정성뿐이다. 원격 문서와 설치본 타입이 어긋나면 **타입이 정본**이다.
> - **절 번호 안정**: 다른 문서가 `§번호` 로 인용한다. 재번호하지 않고 새 사실은 끝에 흡수한다.
> - **각주 표기 범례**
>   - ✅ **Orca 채택** — 읽어서 화면·상태까지 도달한다
>   - ⛔ **의도적 미채택** — 읽지 않기로 결정했고 근거가 handoff Decision 에 있다
>   - ❌ **미채택** — 결정 기록 없이 빠져 있다 (지원 공백)
>   - ⏳ **채택 예정** — 진행 중 handoff 가 닫는다

---

## 1. 두 네임스페이스 — 이름이 비슷한 다른 것

TaskXXX 는 **한 도구군이 아니라 두 네임스페이스**다. 키 표기법이 둘을 가른다.

| 축 | 세션 할 일 목록 | background 실행 태스크 |
|---|---|---|
| 도구 | `TaskCreate` · `TaskGet` · `TaskUpdate` · `TaskList` | `TaskOutput` · `TaskStop` |
| 식별자 | `taskId` (camelCase) | `task_id` (snake_case) |
| 상태값 | `pending` · `in_progress` · `completed` (+ 제거 신호 `deleted`) | `pending` · `running` · `completed` · `failed` · `killed` · `paused` |
| 무엇인가 | 모델이 스스로 관리하는 **할 일 목록** | `Agent`/`Task` 도구로 뜬 **실행 중 서브에이전트** |
| 관측 경로 | `tool_use` + `tool_result` 의 구조화 출력 | `system` 메시지 (`task_*` · `background_tasks_changed`) |

두 네임스페이스를 한 모델로 합치면 `completed` 의 의미가 갈라진다 — 할 일의 완료와 프로세스의 종료는
다른 사건이다. Orca 는 `app/src/shared/task-tool.ts` 헤더에서 이 구분을 명시한다.

---

## 2. 세션 할 일 목록 도구

### 2.1 `TaskCreate` — 항목 하나를 만든다

| 방향 | 필드 | 타입 | 의미 | Orca |
|---|---|---|---|---|
| 입력 | `subject` | `string` (필수) | 짧은 제목 | ✅ |
| 입력 | `description` | `string` (필수) | 무엇을 해야 하는가 | ✅ |
| 입력 | `activeForm` | `string?` | **진행 중 스피너에 보일 현재진행형** ("Running tests") | ⏳ 0212 |
| 입력 | `metadata` | `object?` | 임의 메타데이터 | ⛔ 소비처가 없다 (0212 §6) |
| 출력 | `task.id` | `string` | SDK 가 배정한 id — **입력에는 없다** | ✅ |
| 출력 | `task.subject` | `string` | SDK 정규화본 | ✅ |

출력이 `id` 를 처음 확정한다. 목록 항목은 **`tool_result` 가 성공으로 도착한 뒤** 만들어야 한다 —
`tool_use` 만으로 등록하면 실패한 생성이 유령 항목으로 남는다.

### 2.2 `TaskGet` — id 하나를 다시 읽는다

| 방향 | 필드 | 타입 | 의미 | Orca |
|---|---|---|---|---|
| 입력 | `taskId` | `string` (필수) | 조회할 id | ✅ |
| 출력 | `task` | `object \| null` | **`null` = 그 id 가 없다** | ✅ 제거 신호로 읽는다 |
| 출력 | `task.{id,subject,description,status}` | — | 현재 값 | ✅ |
| 출력 | `task.blockedBy` | `string[]` | 나를 막는 id 전량 | ✅ **전체 교체** |
| 출력 | `task.blocks` | `string[]` | 내가 막는 id 전량 | ⛔ `TaskListOutput` 에 없어 스냅샷이 보정 못 한다 (0204 D-028) |

### 2.3 `TaskUpdate` — id 하나를 패치한다

| 방향 | 필드 | 타입 | 의미 | Orca |
|---|---|---|---|---|
| 입력 | `taskId` | `string` (필수) | 대상 id | ✅ |
| 입력 | `subject` · `description` | `string?` | 새 값 | ✅ |
| 입력 | `activeForm` | `string?` | 새 현재진행형 | ⏳ 0212 |
| 입력 | `status` | `'pending'\|'in_progress'\|'completed'\|'deleted'` | **`deleted` 는 상태가 아니라 제거 신호** | ✅ |
| 입력 | `addBlocks` | `string[]?` | 내가 막을 id **가산** | ⏳ 0212 — 역방향 간선 |
| 입력 | `addBlockedBy` | `string[]?` | 나를 막을 id **가산** | ✅ 가산 병합 (0204 D-029) |
| 입력 | `owner` | `string?` | 담당자 | ⛔ 패널에 담당자 자리가 없다 |
| 입력 | `metadata` | `object?` | 키별 병합 · `null` 로 키 삭제 | ⛔ §2.1 과 같다 |
| 출력 | `success` | `boolean` | 갱신 성공 여부 | ✅ **fail-closed** — 미지정도 실패로 읽는다 |
| 출력 | `taskId` | `string` | **정규화된** id | ✅ 입력보다 우선 |
| 출력 | `updatedFields` | `string[]` | 무엇이 바뀌었는가의 권위 | ✅ 게이트로 사용 |
| 출력 | `statusChange` | `{from,to}?` | 상태 전이 | ✅ 입력보다 우선 |
| 출력 | `error` | `string?` | **실패 사유 문구** | ⏳ 0212 |

`add-` 접두가 의미를 가른다. `blockedBy`(출력)는 그 시점의 전량이라 **교체**하고, `addBlockedBy`(입력)는
**가산**한다. 한 필드에 담으면 `TaskUpdate` 한 번이 기존 간선을 통째로 지운다.

### 2.4 `TaskList` — 전체 스냅샷

| 방향 | 필드 | 타입 | 의미 | Orca |
|---|---|---|---|---|
| 입력 | — | `{}` | 인자가 없다 | ✅ |
| 출력 | `tasks[].{id,subject,status}` | — | 현재 전량 | ✅ |
| 출력 | `tasks[].blockedBy` | `string[]` | 의존 전량 | ✅ 전체 교체 |
| 출력 | `tasks[].owner` | `string?` | 담당자 | ⛔ §2.3 과 같다 |

`tasks` 는 그 시점의 **전량**이다. 스냅샷에 없는 로컬 항목은 Claude 측에서 사라진 것이므로 지운다 —
남기면 삭제된 항목이 영구 잔류한다. `description` 은 이 출력에 **없다**(`TaskGetOutput` 에만 있다).

### 2.5 스트림 입력의 키 이름은 정규화 전이다

원격 문서가 명시한다 — Claude Code 는 실행 전에 `id`/`task_id` → `taskId`, `active_form` → `activeForm`
으로 **거의 맞는 키를 고쳐 주지만 그 수정은 스트림에 반영되지 않는다**. `tool_use.input` 은 모델이 낸
원형이므로 방어적으로 읽어야 한다.

`taskId` 는 `TaskUpdateOutput.taskId` 가 정규화본을 싣기 때문에 **출력을 1순위로 읽으면 자동으로 해결된다**.
`activeForm` 은 출력에 없으므로 입력에서 두 이름을 모두 읽어야 한다.

---

## 3. background 실행 태스크 도구

| 도구 | 필드 | 의미 | Orca |
|---|---|---|---|
| `TaskOutput` 입력 | `task_id` · `block` · `timeout` | 실행 태스크의 출력을 읽는다 (`block=true` 면 완료까지 대기) | ⛔ 관측만 |
| `TaskOutput` 출력 | — | **구조화 출력 타입이 없다** (텍스트) | ⛔ |
| `TaskStop` 입력 | `task_id?` · `shell_id?`(deprecated) | 실행 태스크를 멈춘다 | ⛔ 관측만 |
| `TaskStop` 출력 | `message` · `task_id` · `task_type` · `command?` | 멈춘 대상 | ⛔ |

> ⛔ **Orca 의도적 미채택.** GUI 의 background 상태를 `TaskOutput` 호출 여부에 의존시키지 않는다 —
> 주기적 polling 을 만들지 않기 위해서다(0204 D-010·D-011). 상태의 권위는 §4 의 system 메시지이고,
> 모델이 이 두 도구를 부르는 것은 transcript 에만 남는다.

---

## 4. SDK system 메시지 — background 상태의 권위

도구 호출이 아니라 `type:'system'` 스트림으로 온다. 다섯 subtype 이 있고 **둘은 edge, 하나는 level** 이다.

### 4.1 `task_started` (edge)

| 필드 | 의미 | Orca |
|---|---|---|
| `task_id` · `tool_use_id?` | 식별자 두 축 | ✅ `tool_use_id` 가 없으면 앞선 매핑으로 복원 |
| `description` · `subagent_type?` | 무엇을 하는 서브에이전트인가 | ✅ |
| `prompt?` | 요청 프롬프트 | ⛔ 같은 값을 `tool_use.args` 에서 파생한다 |
| `task_type?` · `workflow_name?` | `local_workflow` 등 종류 | ❌ |
| `skip_transcript?` | ambient/housekeeping — 인라인 transcript 에서 숨기라는 뜻 | ⛔ 드롭 (0204 D-013) |

`skip_transcript` 의 SDK 주석은 *"it may still appear in a tasks panel"* 이다 — 패널 표시는 **허용**이지
요구가 아니다. Orca 는 범위를 넓히지 않으려고 패널에서도 드롭한다.

### 4.2 `task_progress` (반복)

| 필드 | 의미 | Orca |
|---|---|---|
| `description` | 무엇을 하는 서브에이전트인가 (필수) | ✅ |
| `subagent_type?` | Task 도구 서브에이전트의 종류 | ✅ |
| `usage.{total_tokens,tool_uses,duration_ms}` | 누적 실행 메타 | ✅ |
| `last_tool_name?` · `summary?` | 현재 작업 표시 | ✅ |

### 4.3 `task_notification` (edge — 종단)

| 필드 | 의미 | Orca |
|---|---|---|
| `status` | `completed` \| `failed` \| `stopped` | ✅ |
| `summary` | 정착 사유 문구 | ✅ 실패·중단 행이 원인을 말한다 (0204 D-024) |
| `usage?` | 최종 실행 메타 | ✅ |
| `output_file` | **전체 출력이 저장된 파일 경로** (필수) | ❌ |
| `skip_transcript?` | §4.1 과 같다 — 종단 메시지에도 실린다 | ⛔ 드롭 (0204 D-013) |

### 4.4 `task_updated` (델타 패치)

| 필드 | 의미 | Orca |
|---|---|---|
| `task_id` | 대상 | ⏳ 0212 |
| `patch.status` | `pending`\|`running`\|`completed`\|`failed`\|**`killed`**\|**`paused`** | ⏳ 0212 |
| `patch.description` | 태스크 설명 변경 | ❌ |
| `patch.is_backgrounded` | foreground → background 전환 확정 | ⏳ 0212 |
| `patch.error` | 실패 사유 | ⏳ 0212 |
| `patch.{end_time,total_paused_ms}` | 종료 시각 · 누적 일시정지 시간 | ⏳ 0212 |

SDK 주석이 범위를 못박는다 — *"Wire-safe subset of TaskState fields that changed. Clients merge into
their local task map."* **누락 필드는 무변경**이지 초기화가 아니다. `killed`·`paused` 는 `task_notification`
의 3종 `status` 에 없으므로 **이 메시지로만 관측된다**.

### 4.5 `background_tasks_changed` (level)

| 필드 | 의미 | Orca |
|---|---|---|
| `tasks[].{task_id,task_type,description}` | **변화 후 살아 있는 전량** | ⏳ 0212 |

SDK 주석이 사용법과 존재 이유를 함께 적는다.

> *"A level signal, unlike the task_started/task_notification edge bookends: consumers that only need
> 'is background work running' should **replace their set with each payload** rather than pairing edges,
> **so a missed bookend cannot wedge a stale running indicator**."*

세 가지 제약이 함께 온다. **①** 순서는 edge 와 비교해 미정의이고 payload 는 id 만 실으므로 edge 스트림과
상관시키지 않는다. **②** 프로세스 단위 level 이라 **시작 시점에는 아무것도 오지 않는다** — 소비자는 CLI
프로세스가 (재)기동할 때마다 빈 집합으로 초기화하고 다음 변화를 기다려야 한다. **③** 따라서 첫 payload
도착 전에는 이 신호로 무엇도 정착시킬 수 없다.

---

## 5. 제어 표면 — GUI 가 TaskXXX 에 무엇을 할 수 있는가

**제어는 한쪽 네임스페이스에만 있다.** background 실행 태스크는 `Query` 제어 API 로 조작할 수 있고,
세션 할 일 목록은 **모델 전용**이다 — GUI 가 항목을 만들거나 고칠 SDK 경로가 없다.

### 5.1 `Query` 제어 API (background 실행 태스크)

| API | 의미 | Orca |
|---|---|---|
| `stopTask(taskId)` | 실행 태스크 중단 — `status:'stopped'` 인 `task_notification` 이 뒤따른다 | ✅ 두 타일의 행별 중단 버튼 |
| `backgroundTasks(toolUseId)` | **그 tool_use 의 foreground 태스크 하나**를 background 로 | ⏳ 0212 — 현재는 `stopTask` 앞의 내부 폴백 전용이고 사용자 진입점이 없다 |
| `backgroundTasks()` (인자 없음) | **모든 foreground 태스크**를 background 로 (Ctrl+B 시맨틱) | ⛔ Bash 까지 포함하므로 TaskXXX 범위 밖 (0212 D-020) |
| `interrupt()` | 턴 전체 중단 | ✅ 기존 취소 경로 |

### 5.2 foreground / background 는 "실행 여부" 가 아니라 "턴이 기다리는가" 다

**서브에이전트는 기본이 background 다.** `AgentInput.run_in_background` 주석 — *"Agents run in the
background by default; you will be notified when one completes. **Set to false** to run this agent
synchronously when you need its result before continuing."*

따라서 foreground 태스크는 둘뿐이다 — 모델이 `run_in_background:false` 로 **결과를 기다리는**
서브에이전트, 그리고 **Bash 명령**.

`backgroundTasks` 주석이 전환의 효과를 못박는다 — *"Each blocking tool call returns immediately with
a 'running in the background' tool_result and **the turn continues**; the task keeps running and emits
a task_notification when it settles."*

| 오해 | 사실 |
|---|---|
| 백그라운드로 보내면 작업이 멈춘다 | **아니다.** 작업은 계속 돌고 끝나면 `task_notification` 이 온다 |
| 이미 돌고 있으니 전환할 게 없다 | 이미 background 인 항목에는 **효과가 없다**(`false` 반환). 전환 대상은 턴을 막고 있는 foreground 뿐이다 |
| 중단과 비슷한 것이다 | 반대다. 중단은 일을 없애고, 전환은 **기다림만 없앤다** |

Orca 는 이 구분을 `async_launched` 영수증으로 이미 판별한다(0136 · `isAsyncLaunched`).

### 5.3 SDK 에 제어 API 가 **없는** 것

| 하고 싶은 것 | 상태 | 근거 |
|---|---|---|
| 할 일 항목을 GUI 에서 생성·수정·삭제 | **불가능** | `Query` 에 해당 메서드가 없고 control request union 에도 없다. `TaskCreate`/`TaskUpdate` 는 **모델 도구**다 |
| 실행 태스크 일시정지 / 재개 | **불가능** | `task_updated.patch.status` 가 `paused` 를 **관측만** 시킨다(§4.4). pause/resume API 가 없다 |
| 할 일 항목 하나만 중단 | **해당 없음** | 할 일은 실행 단위가 아니다 — 멈출 프로세스가 없다 |

> 위 세 줄은 **Orca 의 결손이 아니라 SDK 의 경계**다. "모든 기능 지원" 의 상한이 여기다.

### 5.4 도구 호출 자체를 막는 경로

`canUseTool` 권한 콜백과 `PreToolUse` 훅은 Task 도구 호출도 가로챌 수 있다.

> ⛔ **Orca 의도적 미채택.** `RISKY_TOOLS` 는 상태를 바꾸는 도구(`Bash`·`Write`·`Edit`·`MultiEdit`·
> `NotebookEdit`)만 담는다. Task 도구는 할 일 목록만 바꾸므로 승인 카드 대상이 아니다 — 넣으면
> 할 일이 갱신될 때마다 승인 카드가 뜬다.

`stopTask` 는 **확정을 기다려야 한다**. 클릭 즉시 `중단됨` 으로 확정하지 않고 `중단 중` 을 거쳐
`task_notification` 으로 정착하는 것이 Orca 의 계약이다(0204 D-005·D-006).

---

## 6. 기능 가용성 — TaskXXX 가 항상 있는 것은 아니다

**Task 도구는 조건부다.** 원격 문서가 전환 지점을 명시한다 — TypeScript Agent SDK 0.3.142 및
**Claude Code v2.1.142** 부터 세션은 `TodoWrite` 대신 `TaskCreate`/`TaskUpdate`/`TaskGet`/`TaskList` 를 쓴다.

| 축 | 사실 | 함의 |
|---|---|---|
| CLI 버전 | v2.1.142 미만은 `TodoWrite` 를 쓴다 | Task 도구 호출이 **한 번도 오지 않는다** |
| 환경 변수 | `CLAUDE_CODE_ENABLE_TASKS=0` 이면 Task 도구가 꺼진다 | 최신 CLI 에서도 같은 결과가 된다 |
| SDK 버전 | `package.json` 의 SDK 버전은 **이 축을 고정하지 못한다** | SDK 와 CLI 는 별개 축이다 |
| 실행 경로 | Orca 는 `pathToClaudeCodeExecutable` 로 **PATH 의 사용자 설치본을 번들보다 먼저** 고른다 (`app/src/main/adapters/claude-executable.ts`) | 사용자 머신의 CLI 버전이 실제 결정자다 |

### 6.1 판정 방법 — 버전 파싱이 아니라 feature detection

`SDKSystemMessage`(`subtype:'init'`)가 세 필드를 싣는다.

| 필드 | 타입 | 쓰임 |
|---|---|---|
| `tools` | `string[]` (**required**) | **노출된 도구 이름 전량** — `TaskCreate` 포함 여부가 직접 답이다. 타입은 부재를 허용하지 않으므로 `undefined` 는 spec 준수 CLI 가 아니라 **비준수/구버전 실행 현실**만 만든다 |
| `claude_code_version` | `string` | 실제 CLI 버전 (안내 문구용) |
| `capabilities` | `string[]?` | 프로토콜 능력 — 열린 집합, 모르는 값은 무시 |

`capabilities` 의 SDK 주석이 원칙을 준다 — *"so SDK consumers can feature-detect instead of
version-sniffing"*. `tools` 에 `TaskCreate` 가 있는지 보는 것이 버전 비교보다 정확하다.

> ⏳ **0212 가 닫는다.** `tools` 부재(`undefined`)와 `TaskCreate` 부재(`[]` 안에 없음)는 **다른 사실**이다 —
> 전자는 판정 불가라 안내하지 않고, 후자만 원인을 말한다.

### 6.2 `TodoWrite` — 레거시 경로

SDK 는 `TodoWriteInput`/`TodoWriteOutput` 을 **여전히 정의한다**. 한 번의 호출이 `todos` 배열 전체를
다시 쓰는 형태라 fold 규칙 자체가 Task 도구와 다르다.

| 필드 | 타입 | 비고 |
|---|---|---|
| `todos[].content` | `string` | Task 도구의 `subject` 에 대응 |
| `todos[].status` | `'pending'\|'in_progress'\|'completed'` | 같다 |
| `todos[].activeForm` | `string` | **필수** — Task 도구에서는 선택 |

> ❌ **Orca 미채택.** `TodoWrite` 관측 경로가 없다. 구버전 CLI 에서는 목록이 채워지지 않으며,
> 0212 는 **폴백을 만들지 않고 원인을 안내하는 쪽**을 택했다(0212 D-004).

---

## 7. Orca 채택 요약

| 영역 | 상태 | 정본 코드 |
|---|---|---|
| 할 일 목록 파싱 | 관측 → 목록 지시 변환 | `app/src/shared/task-tool.ts` |
| 목록 파생(fold) | transcript parts 의 순수 fold — main 에 스토어 없음 | `app/src/renderer/src/features/chat/lib/taskBoard.ts` |
| 구조화 출력 동행 | `tool_result` 블록이 정확히 1개일 때만 귀속 | `app/src/main/adapters/claude-map.ts` |
| background 이벤트 | `task_started`/`task_progress`/`task_notification` → `subagent.task` | 같은 파일 |
| 중단 수명주기 | `중단 중` → SDK 확정 → 정착 (watchdog 병행) | `app/src/main/features/chat/` |

세부 결정의 근거는 [`handoff/0204-taskxxx-right-panel/plan.md`](handoff/0204-taskxxx-right-panel/plan.md)
Decision Ledger 와 [`handoff/0212-taskxxx-surface-gaps/plan.md`](handoff/0212-taskxxx-surface-gaps/plan.md)
가 갖는다. 본 문서는 **외부 계약**만 서술하고 Orca 내부 구조는 위 정본 코드가 갖는다.
