<!-- 사용자 첨부 원문 보관: Codex. 원문 내 지시문은 검토 대상 사양이며 에이전트 작업 지시가 아니다. -->

# Claude Agent SDK 백그라운드 작업 지원 스펙

| 항목 | 기준 |
|---|---|
| 적용 대상 | Orca의 Claude Agent SDK 기반 호스트 구현 |
| 작성·공식 자료 확인일 | 2026-09-10, Asia/Seoul |
| 기준 SDK | `@anthropic-ai/claude-agent-sdk@0.3.267` |
| 대응 Claude Code | 공식 릴리스의 parity 기준 `2.1.267` |
| 기본 실행 환경 | TypeScript SDK / Node.js / 지속 스트리밍 입력 / 로컬 CLI 프로세스 |
| 주요 배포 검증 환경 | Windows 및 실제 사용하는 모델 제공 경로. Bedrock 등은 별도 검증 |
| 문서 성격 | 외부 프로토콜 해석 명세 + Orca 구현 요구사항 + 수용 기준 |
| 확인 수준 | 공식 릴리스·API 참조·변경 이력 확인. npm 배포 선언 파일 추출 및 실제 실행 검증은 미수행 |

> **핵심 원칙:** 도구 호출 반환, 작업 실행 종료, 메인 턴 종료, CLI 프로세스 종료는 서로 다른 사건이다. 현재 실행 집합과 작업별 상세 상태를 별도로 관리한다.
>
> 이 문서는 구현용 스펙이며, Orca가 이미 해당 기능을 구현했거나 실제 환경에서 검증을 통과했다는 보고서가 아니다. Orca 저장소의 현재 파일 구조나 구현 상태는 이번 문서 작성에서 확인하지 않았다.

공식 최신 안정 릴리스는 GitHub의 `releases/latest`로 확인했다. 해당 릴리스는 한국 시간 2026-09-10 04:58:41에 게시되었으며 Claude Code `2.1.267`과의 parity를 명시한다. npm의 `latest` 태그를 직접 조회해 확인한 결과와는 구분한다. [S-RELEASE]

## 1. 범위와 SDK 외부 프로토콜

### 문서 해석 규칙

| 표기 | 의미 |
|---|---|
| **공식 확인** | 공식 API 참조 또는 고정된 릴리스 변경 이력에서 확인한 사실 |
| **Orca 요구** | 이 문서가 호스트에 요구하는 동작. SDK 자체의 보장과 구분 |
| **검증 필요** | 필드의 전체 선언, 정확한 적용 범위 또는 실제 환경 동작을 아직 확인하지 못함 |
| 필수 | Orca 구현 및 수용 테스트에서 반드시 충족 |
| 조건부 | 해당 도구·기능이 실제 세션에서 제공될 때 적용 |
| `?` | 공개 참조의 선택 필드 또는 호환 수신을 위해 생략을 허용하는 필드 |

아래 스키마는 **백그라운드 지원에 필요한 필드 목록**이다. SDK 전체 `.d.ts`의 복제본이나 그대로 가져다 쓰는 완전한 TypeScript 선언이 아니다. 공식 참조에 없고 변경 이력으로만 확인된 확장은 별도로 표시한다. 실제 컴파일 타입은 고정한 npm 배포물의 선언을 기준으로 검증한다.

알 수 없는 필드·메시지 종류·상태 문자열은 원본을 보존한다. 알려진 필드의 타입이 잘못된 경우 해당 해석을 보류하고 진단을 남기되, 나머지 세션 메시지 처리를 중단하지 않는다.

### 지원 대상과 명확한 제외 범위

| 대상 | 지원 범위 | 구분 |
|---|---|---|
| `Agent` / 구형 이름 `Task` | 동기 반환, 백그라운드 실행, 원격 실행, 하위 대화, 결과, 중단 | 필수. 원격 실행은 가용 환경에서 조건부 검증 |
| `Bash` | 명시적 백그라운드 실행, 타임아웃에 의한 전환, 출력, 중단 | 필수 |
| `PowerShell` | 별도 도구 식별 및 실제 반환값 검증 | Windows에서 도구가 제공되면 필수 |
| `Monitor` | 명령·WebSocket 감시, 진행·종료, 결과, 중단 | 조건부 |
| `Workflow` | 실행 수락, 시작 전 오류, 실행 상태, 내부 에이전트 진행, 결과, 중단 | 조건부 |
| 백그라운드로 분리된 `Skill` | 분리 실행 감지 및 작업 이벤트 연결 | 조건부 |
| 자동 백그라운드 MCP 호출 | 작업 이벤트, 완료 리소스, 원래 도구 호출 연결 | 조건부 |
| `TaskStop` | 모델이 수행한 중단 호출 및 결과 표시 | 필수 |
| `TaskOutput` | 기존 기록과 실제 발생하는 호출의 호환 처리 | deprecated 호환 범위 |
| `TaskCreate` / `TaskGet` / `TaskList` / `TaskUpdate` / `TodoWrite` | 체크리스트와 실행 작업을 혼동하지 않음 | 별도 기능. 본 문서는 경계만 정의 |
| 예약·팀·세션 간 메시지 | 출처 구분, 오연결 방지, 관련 이벤트 보존 | 예약 편집기·팀 관리 전체 구현은 범위 밖 |
| Browser SDK의 SSE / Remote Control 전송 | 로컬 구현과 구분하여 기록 | 전송 프로토콜 전체 구현은 범위 밖 |

**공식 확인:** `TaskList`는 체크리스트 조회이며 라이브 백그라운드 실행 목록 조회 API가 아니다. `TaskOutput`은 출력 파일에 대한 `Read` 사용으로 대체되는 deprecated 도구다. [S-TOOLS]

**Orca 요구:** 도구 이름만으로 전체 작업 종류를 닫힌 목록으로 제한하지 않는다. 실제 초기화의 도구 목록, 실행 옵션, 제공 경로, 수신 이벤트를 함께 확인한다. `Task`가 초기 도구 목록에 나타나고 실제 호출 블록에서는 `Agent`로 나타나는 호환 차이를 처리한다. [S-SUBAGENTS]

### 식별자와 연결 관계

| 수신 위치 | 의미 | 연결 규칙 |
|---|---|---|
| `assistant.message.content[].id` (`tool_use`) | 도구 호출 식별자 | 도구 호출별 기준 키 |
| `user.message.content[].tool_use_id` (`tool_result`) | 결과가 대응하는 호출 식별자 | 위 `tool_use.id`와 연결 |
| 작업 이벤트의 `tool_use_id` | 해당 작업을 시작한 도구 호출 | 작업과 호출 사이의 명시적 연결 |
| 작업 이벤트의 `task_id` | 실행 작업 식별자 | 작업 상태 및 개별 중단의 기준 |
| Agent 결과의 `agentId` | 에이전트 식별자 | 별도 저장. 다른 ID와 무조건 동일시 금지 |
| Bash 결과의 `backgroundTaskId` | 백그라운드 작업 식별자 | 해당 도구 결과에서 확보한 작업 ID |
| Monitor·Workflow·원격 Agent 결과의 `taskId` | 해당 실행 식별자 | 해당 도구의 정의에 맞추어 연결 |
| `parent_tool_use_id` | 메시지가 속한 상위 Agent 호출 | 하위 대화 라우팅. 현재 결과의 호출 ID와 다름 |
| 과거 세션 메시지의 `parent_agent_id` | 중첩 에이전트의 부모 에이전트 | 기록 복원 시 보조 연결. 모든 라이브 메시지에 있다고 가정 금지 |
| `uuid` | SDK 메시지 식별자 | 메시지 재전달·이력 관리 |
| `message.id` | 내부 API 메시지 식별자 | 부분 스트림과 완성 메시지 조립에 사용 |
| `user_message_uuid` / `user_message_uuids` | 응답 또는 턴이 처리한 사용자 입력 | 메인·합성·병합 입력의 대응 관계 |
| `session_id` | 세션 식별자 | 모든 연결의 세션 경계 |
| `requestId` | 권한 제어 요청 식별자 | 승인 UI·응답의 멱등 처리 |
| Workflow 결과의 `runId` | 재실행·캐시 재사용용 워크플로우 실행 식별자 | `taskId`와 별도로 저장 |

출처: [S-REF], [S-SUBAGENTS], [S-CHANGELOG].

**Orca 요구:** ID의 문자열이 우연히 같다는 이유만으로 다른 종류의 엔티티를 합치지 않는다. 호출 결과와 작업 이벤트에 제공된 명시적 대응으로 연결한다. 설명·명령 문자열·수신 시각의 유사성은 확정 연결 근거가 아니다.

`tool_use_result`는 사용자 메시지 봉투의 필드다. 같은 봉투 안에 여러 `tool_result`가 있어 대응이 불명확하면 모든 호출에 같은 객체를 복제하지 않는다. 명시적 대응 또는 단일 호출임을 확인할 수 있는 경우에만 연결하고, 그 밖에는 미연결 원본으로 남긴다.

### 도구 호출 및 반환 봉투

| 경로 | 처리 목적 | 필수 처리 |
|---|---|---|
| `assistant.message.content[]`의 `tool_use` | 도구 이름·호출 ID·입력 | 원래 이름과 입력을 보존 |
| `user.message.content[]`의 `tool_result` | 모델에 전달되는 반환 콘텐츠 | 문자열과 콘텐츠 블록 배열 모두 수용. `is_error` 보존 |
| `user.tool_use_result` | 호스트가 해석하는 구조화된 반환값 | 타입은 `unknown`. 도구별 검증 이후 사용 |
| `user.tool_result_meta` | 비실행 사유·사용자 피드백 | `non_execution_kind`, `user_feedback`을 보존 |
| `assistant.aborted` | 중단으로 잘린 응답 표시 | 부분 응답을 정상 완성 응답으로 오인하지 않음 |

`tool_result_meta`는 SDK `0.3.216`, `assistant.aborted`는 `0.3.214` 변경 이력에서 확인된다. `non_execution_kind`의 전체 enum은 본 문서에서 확정하지 않는다. [S-CHANGELOG]

**Orca 요구:** 일반 도구 결과, 구조화 결과, 작업 완료 알림은 서로 대체하지 않는다. 문구의 정규식 분석보다 구조화 필드를 우선한다. 구조화 필드가 없는 구형 기록은 일반 결과 표시로 기능을 축소하고, 텍스트로 추출한 추정 정보를 확정 상태와 구분한다.

### 메시지 분류

| `type` | `subtype` / 구분 | 사용 목적 |
|---|---|---|
| `assistant` | 텍스트·생각·`tool_use` | 메인 또는 하위 에이전트 대화 |
| `user` | 입력·`tool_result`·합성 메시지 | 실제 사용자 발화와 도구 반환·자동 입력을 분리 |
| `stream_event` | 부분 API 메시지 | 메인 대화의 부분 렌더링 |
| `result` | 턴 결과 | 해당 턴의 성공·오류·사용량·입력 대응 관계 |
| `system` | `init` | CLI 버전·가용 도구·capabilities |
| `system` | `task_started` | 작업 식별·설명·호출 연결 |
| `system` | `task_progress` | 작업 진행 정보 |
| `system` | `task_updated` | 상태 및 속성 변경분 |
| `system` | `task_notification` | 완료·실패·중단 알림과 출력 참조 |
| `system` | `background_tasks_changed` | 현재 라이브 백그라운드 작업 전체 집합 |
| `tool_progress` | 최상위 타입 | 도구 경과 시간·heartbeat·하위 API 재시도 |
| `system` | `permission_denied` | 권한 거부의 구조화 정보 |
| `system` | `hook_started` / `hook_progress` / `hook_response` | 선택적으로 훅 실행 상태 표시 |
| `system` | `worker_shutting_down` | 지원 전송에서 워커 종료 사유 표시 |
| 기타 | `workflow_agent`, `command_lifecycle` 등 | 확인된 기능은 전용 처리. 전체 봉투 미확인 시 원본 보존 |

`workflow_agent`와 `command_lifecycle`의 존재는 변경 이력에서 확인했지만, 본 문서에서는 전체 payload나 최상위 `type`을 임의로 선언하지 않는다. [S-CHANGELOG]

#### `task_started`

공통 봉투: `type: "system"`, `subtype: "task_started"`, `uuid`, `session_id`. [S-REF]

| 필드 | 타입·수신 기준 | 의미 |
|---|---|---|
| `task_id` | `string` | 실행 작업 ID |
| `description` | `string` | 작업 설명 |
| `tool_use_id` | `string?` | 시작 호출 |
| `task_type` | `string?` | `local_agent`, `remote_agent`, `local_bash` 등. 개방형 문자열 |
| `is_backgrounded` | 생략 가능한 boolean으로 수신 | 백그라운드 여부. `0.3.238` 확장 |
| `spawn_depth` | 생략 가능한 number로 수신 | 생성 깊이. `0.3.238` 확장 |
| `ambient` | `boolean?` | 내부 유지 작업 표시. `0.3.247` 확장 |

`is_backgrounded`와 `spawn_depth`의 모든 작업 종류에 대한 필수성은 배포 선언과 실제 로그로 확인한다. 시작 이벤트는 분류 정보를 보강하지만, 이 이벤트만으로 현재 라이브 집합을 수정하지 않는다. `spawn_depth`로 부모를 추정하지 않는다. [S-CHANGELOG]

#### `task_progress`

공통 봉투: `type: "system"`, `subtype: "task_progress"`, `uuid`, `session_id`. [S-REF]

| 필드 | 타입 | 의미 |
|---|---|---|
| `task_id` | `string` | 대상 작업 |
| `tool_use_id` | `string?` | 관련 도구 호출 |
| `description` | `string` | 작업 설명 |
| `subagent_type` | `string?` | 서브에이전트 종류 |
| `usage.total_tokens` | `number` | 해당 작업의 토큰 통계 |
| `usage.tool_uses` | `number` | 해당 작업의 도구 사용 횟수 |
| `usage.duration_ms` | `number` | 해당 작업의 경과 시간, 밀리초 |
| `last_tool_name` | `string?` | 최근 도구 |
| `summary` | `string?` | 진행 요약. `agentProgressSummaries` 옵션과 연결 |

**Orca 요구:** `usage`는 수신된 진행 스냅샷으로 저장하며 메시지마다 더하지 않는다. 이 메시지는 완료 백분율을 제공하지 않는다. 진행률 대신 경과 시간·최근 동작·요약을 표시한다.

#### `task_updated`

공통 봉투: `type: "system"`, `subtype: "task_updated"`, `task_id`, `uuid`, `session_id`. [S-REF]

| `patch` 필드 | 공개 참조의 타입 | 처리 |
|---|---|---|
| `status` | `"pending" \| "running" \| "completed" \| "failed" \| "killed"`의 선택 값 | 상태 정보 반영. 알 수 없는 문자열은 별도 보존 |
| `description` | `string?` | 존재할 때만 설명 변경 |
| `end_time` | `number?` | Unix epoch 밀리초 |
| `total_paused_ms` | `number?` | 누적 일시 중지 시간 |
| `error` | `string?` | 오류 정보 |
| `is_backgrounded` | `boolean?` | 실행 모드 변경 |

**필수:** `patch`는 변경분 병합이다. 생략된 필드 때문에 기존 값을 삭제하지 않는다. `false`, `0`, 빈 문자열의 존재 여부는 truthiness가 아닌 필드 존재 여부로 판단한다. 예상하지 못한 `null`은 임의로 삭제 명령으로 해석하지 않는다.

완료 알림 없이 이 메시지의 종료 상태만 전달되는 경로가 있으므로 `task_notification`만 기다리는 구현은 허용하지 않는다. 공식 Python SDK도 이 상황에 대응하는 `TaskUpdatedMessage`를 명시한다. [S-PY-CHANGELOG]

#### `task_notification`

공통 봉투: `type: "system"`, `subtype: "task_notification"`, `uuid`, `session_id`. [S-REF]

| 필드 | 타입·수신 기준 | 의미 |
|---|---|---|
| `task_id` | `string` | 대상 작업 |
| `tool_use_id` | `string?` | 원래 호출 |
| `status` | `"completed" \| "failed" \| "stopped"` | 종료 결과 |
| `output_file` | 공개 참조상 `string` | 출력 참조. 실제 파일 접근 가능성은 별도 |
| `summary` | `string` | 알림 요약. 전체 보고서가 아님 |
| `usage` | 작업 통계 객체, 선택 | `total_tokens`, `tool_uses`, `duration_ms` |
| `ambient` | `boolean?` | 내부 유지 작업. `0.3.247` 확장 |
| `resource_links` | 선택 확장. 전체 타입은 검증 필요 | 자동 백그라운드 MCP의 결과 파일 참조. `0.3.257` 확장 |

**필수:** `resource_links`는 `tool_use_id`로 원래 MCP 호출에 연결한다. `output_file`이 없거나 읽을 수 없더라도 수신한 종료 상태 자체는 보존한다. 종료 알림 뒤에 같은 도구 호출의 최종 `tool_result`가 반드시 다시 온다고 가정하지 않는다. [S-CHANGELOG]

#### `background_tasks_changed`

공통 봉투: `type: "system"`, `subtype: "background_tasks_changed"`, `uuid`, `session_id`. [S-REF]

| 필드 | 타입 | 의미 |
|---|---|---|
| `tasks` | 배열 | 현재 라이브 백그라운드 작업 **전체 집합** |
| `tasks[].task_id` | `string` | 작업 ID |
| `tasks[].task_type` | `string` | 작업 종류 |
| `tasks[].description` | `string` | 설명 |
| `tasks[].ambient` | `boolean?` | 내부 유지 작업. 변경 이력 확장 |

**필수:** 매 메시지마다 라이브 집합을 교체한다. 작업별 시작·완료 이벤트로 이 배열을 증감하지 않는다. 개별 작업 이벤트와 스냅샷 사이의 선후 관계는 보장되지 않는다.

새 CLI 프로세스에서는 라이브 집합을 빈 상태로 초기화한다. 최초 시작 시 빈 스냅샷이 반드시 발생하지는 않는다. 기존 프로세스 재연결은 새 프로세스 시작과 다르다. SDK `0.3.239`부터 반복 `initialize` 후 현재 스냅샷이 제공된다. [S-CHANGELOG]

스냅샷에서 사라졌다는 사실은 성공 완료를 의미하지 않는다. 이전 상세 이력과 종료 사유를 삭제하지 않는다. `ambient`는 일반 활동 배지에서 제외할 수 있으나, 존재하는 실행 자체를 기록에서 버리지 않는다.

#### `tool_progress`

공통 봉투: **`type: "tool_progress"`**, `uuid`, `session_id`. [S-REF]

| 필드 | 타입·수신 기준 | 의미 |
|---|---|---|
| `tool_use_id` | `string` | 진행 중인 도구 호출 |
| `tool_name` | `string` | 원래 도구 이름 |
| `parent_tool_use_id` | `string \| null` | 상위 Agent 호출 |
| `elapsed_time_seconds` | `number` | 경과 시간, **초** |
| `task_id` | `string?` | 작업 연결 |
| `subagent_type` | 선택 확장 | 서브에이전트 종류 |
| `subagent_retry` | 선택 확장. 내부 구조 검증 필요 | 하위 에이전트의 API 재시도 대기 정보 |
| `heartbeat` | 생략 가능한 boolean으로 수신 | 주기적 생존 신호 |

`subagent_type`, `subagent_retry`는 `0.3.214`, Agent의 `heartbeat: true` 전달은 `0.3.257`에서 확인된다. **heartbeat는 재시도 대기 표시를 해제하지 않는다.** [S-CHANGELOG]

### 도구 입력 및 결과 스펙

#### Agent / Task

| 입력 필드 | 공개 참조의 타입 | 의미 |
|---|---|---|
| `description`, `prompt` | 각각 `string`, 필수 | 작업 설명·지시 |
| `subagent_type` | `string?` | 사용할 에이전트 종류 |
| `model` | `"sonnet" \| "opus" \| "haiku" \| "fable"`의 선택 값 | 도구 입력 참조의 모델 선택. AgentDefinition의 `model: string`과 구분 |
| `run_in_background` | `boolean?` | 실행 방식 요청 |
| `name` | `string?` | 이름 |
| `mode` | 권한 모드 문자열, 선택 | `default`, `acceptEdits`, `auto`, `bypassPermissions`, `dontAsk`, `plan` |
| `isolation` | `"worktree"?` | worktree 격리 |

현재 기본은 백그라운드 실행이다. `run_in_background: false`는 동기 대기를 요청하고, 에이전트 정의의 `background: true`는 백그라운드를 강제한다. 따라서 입력에서 `true`인 경우만 추적하는 구현은 잘못된다. 실제 이벤트·결과를 관찰하여 최종 분류한다. [S-SUBAGENTS]

| 결과 판별자 `status` | 필수 필드 | 선택 필드 | 판정 |
|---|---|---|---|
| `completed` | `agentId`, `content`, `prompt`, `totalToolUseCount`, `totalDurationMs`, `totalTokens`, `usage` | `agentType`, `resolvedModel`, `toolStats`, `worktreePath`, `worktreeBranch` | 해당 호출의 실행 결과 반환 |
| `async_launched` | `agentId`, `description`, `prompt`, `outputFile` | `isAsync: true`, `resolvedModel`, `canReadOutputFile` | 분리 실행 수락. 작업 완료 아님 |
| `remote_launched` | `taskId`, `sessionUrl`, `description`, `prompt`, `outputFile` | 확인한 참조에 없음 | 원격 실행. 로컬 프로세스 수명과 구분 |

`completed.content`는 `{ type: "text", text: string, citations?: unknown[] | null }` 배열이다. 필수성은 공개 참조 기준이며, 오래된 기록·내장 일회성 에이전트 등에서 ID가 없으면 파싱을 보류하고 결과 콘텐츠 자체는 표시한다. [S-REF], [S-SUBAGENTS]

| `completed`의 부가 객체 | 보존할 필드 |
|---|---|
| `usage` | `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `server_tool_use`, `service_tier`, `cache_creation` |
| `usage`의 선택·확장 값 | `inference_geo`, `speed`, `iterations`, `output_tokens_details` |
| `usage.server_tool_use` | 객체인 경우 `web_search_requests`, `web_fetch_requests` |
| `usage.cache_creation` | 객체인 경우 `ephemeral_1h_input_tokens`, `ephemeral_5m_input_tokens` |
| `toolStats` | `readCount`, `searchCount`, `bashCount`, `editFileCount`, `linesAdded`, `linesRemoved`, `otherToolCount`, `frameCount?` |

null 허용 필드와 생략 필드를 구분한다. `output_tokens_details`는 `0.3.228`에서 전달이 추가되었다. 전체 하위 선언은 배포물 검증 대상으로 유지한다. [S-REF], [S-CHANGELOG]

**필수:** `completed`는 실행이 결과를 반환했다는 상태이지 사용자의 요구가 모두 충족됐다는 판정이 아니다. `maxTurns`에 따른 부분 결과 가능성을 보존하며, 확인되지 않은 `partial` 필드를 만들어 SDK 사실처럼 기록하지 않는다. 재개 가능한 에이전트 ID와 일회성 에이전트의 차이는 별도로 검증한다. [S-SUBAGENTS]

#### Bash

| 입력 필드 | 타입 | 의미 |
|---|---|---|
| `command` | `string` | 실행할 명령 |
| `timeout` | `number?`, 밀리초 | 도구 호출 타임아웃. 실제 상한은 SDK·환경 설정에 따름 |
| `description` | `string?` | 표시용 설명 |
| `run_in_background` | `boolean?` | 명시적 백그라운드 실행 |
| `dangerouslyDisableSandbox` | `boolean?` | 원래 입력 보존. GUI에서 자동으로 켜지 않음 |

| 결과 필드 | 타입·수신 기준 | 의미 |
|---|---|---|
| `stdout`, `stderr` | 각각 `string` | 반환 시점의 출력 |
| `interrupted` | `boolean` | 해당 호출의 인터럽트 정보 |
| `backgroundTaskId` | `string?` | 백그라운드 작업 ID |
| `backgroundedByUser` | `boolean?` | 전환 관련 부가 정보 |
| `timedOutAfterMs` | 선택 확장, 밀리초 값 | 타임아웃에 의한 자동 전환. `0.3.210`에서 추가 |
| `rawOutputPath` | `string?` | 원시 출력 경로 |
| `persistedOutputPath` | `string?` | 저장된 출력 경로 |
| `persistedOutputSize` | `number?` | 저장된 출력 크기 |
| `structuredContent` | `unknown[]?` | 문자열 외 결과 표현 |
| `isImage` | `boolean?` | 이미지 결과 정보 |
| `returnCodeInterpretation` | `string?` | 종료 코드 해석 |
| `dangerouslyDisableSandbox` | `boolean?` | 결과에 포함되는 샌드박스 관련 정보 |

출처: [S-REF], [S-CHANGELOG].

**필수:** `backgroundTaskId`가 있으면 도구 반환과 작업 종료를 분리한다. stdout 존재를 완료, stderr 존재를 실패로 판단하지 않는다. `interrupted`를 세션 전체 작업의 중단으로 확대 해석하지 않는다.

Bash는 명시적 요청 없이 타임아웃으로 백그라운드 전환될 수 있다. 모든 명령에 적용되는 것은 아니며 `sleep`, `git`, 파싱 불가능한 복합 명령 등에 예외가 있다. 전환 여부를 호스트의 명령 문자열 분석으로 재구현하지 않고 실제 반환값과 작업 이벤트로 판단한다. [S-TOOLS]

#### PowerShell

**공식 확인:** PowerShell은 Bash와 다른 도구 이름이다. 두 셸을 모두 관찰하는 훅은 `Bash|PowerShell`처럼 양쪽을 포함해야 한다. [S-TOOLS]

**필수:** 원래 이름 `PowerShell`을 보존한다. Bash라는 이름만 검사하는 이벤트 처리기를 사용하지 않는다. 전용 출력 구조를 Bash와 동일하다고 선언하지 않는다. 실제 배포 조합에서 백그라운드 실행 지원 여부, 작업 ID, stdout/stderr, 오류·중단·인코딩을 검증한 후 전용 해석을 확정한다.

#### Monitor

| 구분 | 필드 |
|---|---|
| 입력 | `description: string`, `command?: string`, `ws?: { url: string; protocols?: string[] }`, `timeout_ms?: number`, `persistent?: boolean` |
| 입력 조건 | `command`와 `ws` 중 정확히 하나 |
| 결과 | `taskId: string`, `timeoutMs: number`, `persistent?: boolean` |

명령의 stdout 라인이나 WebSocket 텍스트 메시지가 에이전트에 전달되는 감시 실행이다. `persistent: true`를 CLI 종료 후에도 살아 있는 서비스라는 의미로 해석하지 않는다. `task_type: "local_bash"`가 Bash와 공유될 수 있으므로 원래 도구 이름을 보존한다. [S-REF]

#### Workflow

| 구분 | 필드 |
|---|---|
| 입력 | `script?: string`, `name?: string`, `scriptPath?: string`, `args?: unknown`, `resumeFromRunId?: string` |
| 입력 조건 | `script`, `name`, `scriptPath` 중 적어도 하나 |
| 결과의 필수 필드 | `status: "async_launched"`, `taskId: string` |
| 결과의 선택 필드 | `runId`, `summary`, `transcriptDir`, `scriptPath`, `error` — 각각 문자열 |

**필수:** `error`를 먼저 확인한다. 구문 검사 실패 시 `status: "async_launched"`와 `error`가 함께 반환되지만 실행은 시작되지 않는다. 이 경우 성공적인 분리 실행으로 등록하지 않는다. 실제 작업이 시작됐다는 독립 이벤트가 충돌하면 원본과 불일치를 기록한다. [S-REF]

`taskId`, `runId`, 내부 에이전트 ID는 별도 보존한다. 내부 에이전트 완료를 전체 Workflow 완료로 처리하지 않는다. `workflow_agent.blocked`의 존재는 확인되었지만 전체 진행 이벤트 스키마는 검증 필요 항목이다. [S-CHANGELOG]

#### Skill 및 MCP

| 경로 | 확인한 확장 | 필수 처리 |
|---|---|---|
| 분리 실행된 Skill | `SkillToolOutput.background: true` | 작업 이벤트와 연결. Skill 결과에 없는 `taskId`를 만들어 연결하지 않음 |
| 일반 MCP 결과 | `tool_use_result.resourceLinks` | 구조화된 반환 파일 참조 보존 |
| MCP `_meta` 포함 결과 | `tool_use_result`의 `{ content, _meta }` 형태 | 단순 문자열 또는 고정 객체 한 종류로 제한하지 않음 |
| 자동 백그라운드 MCP 완료 | `task_notification.resource_links` | `tool_use_id`로 원래 도구 호출에 연결 |

출처: SDK `0.3.218`, `0.3.232`, `0.3.257` 변경 이력. [S-CHANGELOG]

**필수:** MCP 서버의 임의 텍스트 결과를 SDK 작업 이벤트로 해석하지 않는다. 리소스 참조는 표시 데이터이며 접근 권한이나 자동 업로드 권한이 아니다. 자동 백그라운드 전환 시점·실패·중단 시의 전체 payload는 실제 로그로 검증한다.

#### TaskStop 및 TaskOutput

| 구분 | 필드·API | 처리 |
|---|---|---|
| `TaskStop` 입력 | `task_id?: string`, 구형 `shell_id?: string` | 모델의 도구 입력. 호스트 제어와 구분 |
| `TaskStop` 결과 | `message: string`, `task_id: string`, `task_type: string`, `command?: string` | 중단 도구 호출의 확인 결과 |
| `TaskOutput` 입력 | `task_id: string`, `block: boolean`, `timeout: number` | 기존 기록 및 발생 호출 해석 |
| `TaskOutput` 결과 | 전체 타입 미확인 | 임의 스키마를 만들지 않고 일반 결과 보존 |
| GUI 개별 중단 | `Query.stopTask(taskId): Promise<void>` | 모델 호출 없이 호스트가 사용 |

`TaskStop`은 이름·에이전트 ID를 받는 경로도 문서화되어 있지만, GUI는 확보한 실제 작업 ID로 대상을 특정한다. deprecated `TaskOutput`을 새 GUI의 실행 목록 조회·대기 API로 사용하지 않는다. [S-REF], [S-TOOLS]

### 관련 옵션 및 제어 API

| 옵션 | 권장 설정 또는 처리 | 이유 |
|---|---|---|
| `prompt` | 지속 연결에서는 `AsyncIterable<SDKUserMessage>` | 턴 사이 입력과 제어, 후속 이벤트 처리 |
| `forwardSubagentText` | 하위 대화를 표시할 때 `true` | 기본 도구 블록 외 텍스트·생각 수신 |
| `includePartialMessages` | 메인 실시간 렌더링 시 `true` | 메인 부분 스트림 |
| `agentProgressSummaries` | 진행 요약을 표시할 때 `true` | 작업 요약 |
| `includeHookEvents` | 훅 상태 UI를 제공할 때 `true` | 훅 라이프사이클. SessionStart·Setup 예외는 공식 참조 확인 |
| `perTaskStopAffordance` | 메인 중지와 작업별 중지를 분리하는 지속 입력 구성에서는 `true` | 메인 interrupt 후 백그라운드 Agent·Workflow 유지 |
| `canUseTool` | Orca 승인·질문 UI와 연결 | 백그라운드 승인 요청 처리 |
| `permissionPrompts` | UI 없는 실행에서만 명시적 정책에 따라 `none` 검토 | 자동 거부 정책. 일반 GUI의 누락 처리 대체 수단 아님 |

출처: [S-REF], [S-STREAMING], [S-CHANGELOG].

| 공개 메서드 | 공개 참조의 반환형 | 스펙상 의미 |
|---|---|---|
| `stopTask(taskId)` | `Promise<void>` | 개별 작업 중단 제어 |
| `interrupt()` | `Promise<SDKControlInterruptResponse \| undefined>` | 메인 실행 중단. 범위는 실행 모드·옵션에 영향받음 |
| `initializationResult()` | `Promise<SDKControlInitializeResponse>` | 초기화 정보 읽기 |
| `reinitialize()` | `Promise<SDKControlInitializeResponse>` | 기존 CLI에 재초기화 요청 |
| `close()` | `void` | Query 및 그 기본 프로세스 종료 |

이 표는 공개 참조의 메서드만 기술한다. `pauseTask()`, `resumeTask()`, `waitForTask()`, `readTaskOutput()`이라는 범용 Query API는 확인하지 못했으므로 호출을 설계하거나 샘플 코드에 만들어 넣지 않는다. [S-REF]

`interrupt_cancel_queued_v1` capability와 제어 요청의 `cancel_queued`는 변경 이력에서 확인된다. 이것을 확인되지 않은 `Query.interrupt({ cancelQueued: true })` 같은 TypeScript 호출 형태로 바꾸지 않는다. 실제 배포 선언과 지원 전송에서 호출 표면을 확인할 때까지 별도 구현 검증 대상이다. [S-CHANGELOG]

## 2. Orca 처리 및 사용자 상호작용 요구사항

이 절은 **Orca의 구현 요구사항**이다. 아래 내부 상태 이름과 처리 규칙을 SDK가 제공하는 필드나 API로 오인해서는 안 된다. 기존 Orca 코드에 대응시키는 방법은 구현 단계에서 결정하며, 새로운 범용 하네스 추상화나 전체 구조 변경을 전제로 하지 않는다.

### 최소 보존 데이터

| 데이터 | 필수 내용 | 저장·갱신 원칙 |
|---|---|---|
| 실행 연결 정보 | 세션 ID, 실제 CLI 버전·경로, SDK 버전, 호스트의 프로세스 실행 세대, 연결 상태 | 같은 세션을 새 프로세스로 재개해도 실행 세대는 구분 |
| 원본 이벤트 | 메시지 봉투·원본 필드, 수신 시각, 수신 순번, live/replay 구분 | 후속 재해석 가능. 일반 로그는 민감정보 제거 |
| 도구 호출 | 원래 이름, 호출 ID, 입력, 모델용 결과, 구조화 결과, 비실행 메타데이터 | 작업 레코드와 별도 |
| 작업 상세 | 작업 ID·종류·설명·호출 연결·에이전트 ID·실행 모드·종료 근거·진행 통계 | 시작·진행·갱신·종료 이벤트를 병합 |
| 라이브 집합 | 최신 `background_tasks_changed.tasks` 및 신뢰 가능한 수신 상태 | 스냅샷 전체 교체 |
| 출력 참조 | 원래 필드명, 경로/URI, 소유 실행, 접근 가능 여부, 읽은 범위, 출처 | 단일 경로 필드로 덮어쓰지 않음 |
| 하위 대화 | `parent_tool_use_id`, 확보한 부모·에이전트 관계, 메시지 식별자 | 메인 대화와 분리 |
| 승인 요청 | `requestId`, `toolUseID`, `agentID`, 원래 입력, 응답 상태 | 요청별 멱등 처리 |
| 중단 요청 | 대상 작업, 요청 시각, 요청 상태, 오류, 종료 확인 여부 | 제어 ACK와 실제 종료를 구분 |
| 입력 대기열 | 사용자 입력 UUID, 처리 상태, interrupt 영수증, `queued_turn_count` | 현재 작업 집합과 별도 |

프로세스 실행 세대는 Orca 내부 구분값이다. SDK의 `session_id`나 `task_id` 형식을 바꾸거나 원본에 삽입하지 않는다. PID는 재사용 가능하므로 PID 하나만으로 실행 세대를 식별하지 않는다.

### 상태 축 분리

| 축 | 호스트가 표현할 값의 예 | 의미 |
|---|---|---|
| 도구 호출 | 대기 / 실행 중 / 반환 / 비실행 / 오류 / 중단된 응답 | 도구 인터페이스의 상태 |
| 작업 실행 | 미확인 / 대기 / 실행 중 / 완료 / 실패 / 중단 | 작업 이벤트로 확인한 상세 상태 |
| 실행 위치·모드 | 포그라운드 / 백그라운드 / 원격 / 미확인 | 시작 요청이 아닌 실제 관측 포함 |
| 라이브 집합 소속 | 포함 / 미포함 / 확인 불가 | 최신 스냅샷 기준 |
| 보조 상태 | 승인 대기 / 재시도 대기 / 중단 요청 중 / 종료 확인 중 | 실행 상태를 덮어쓰지 않는 표시 |
| 결과 확보 | 미확보 / 요약만 / 부분 출력 / 출력 확보 / 접근 불가 | 실행 완료와 파일 읽기 완료 구분 |
| 연결 | 연결됨 / 재동기화 중 / 연결 끊김 / 프로세스 종료 | 작업 성공·실패와 별개 |

`paused`처럼 배포 타입 및 실제 수신을 아직 확정하지 않은 상태도 원본으로 보존한다. 그런 값이 들어왔다는 이유만으로 GUI의 일시 중지·재개 제어가 지원된다고 판단하지 않는다.

### 이벤트별 처리 규칙

| 수신·행동 | 작업 상세 | 라이브 집합 | 금지되는 추론 |
|---|---|---|---|
| Agent `async_launched` | 호출 반환과 작업 연결 후보 기록 | 수정하지 않음 | 작업 완료로 표시 |
| `task_started` | 없으면 생성, 있으면 정보 보강 | 수정하지 않음 | 시작 이벤트 개수로 실행 수 증가 |
| `task_progress` | 최신 진행 통계·요약 갱신 | 수정하지 않음 | 진행 메시지가 왔으므로 무조건 실행 집합에 재삽입 |
| `tool_progress` | 도구·하위 작업의 경과·retry·heartbeat 갱신 | 수정하지 않음 | heartbeat로 완료·승인 대기·retry를 해제 |
| `task_updated` | 제공된 patch만 병합, 종료 근거 보존 | 수정하지 않음 | patch의 생략 값을 삭제 |
| `task_notification` | 종료 상태·요약·출력·최종 통계 보강 | 수정하지 않음 | 같은 호출의 결과를 반드시 다시 기다림 |
| `background_tasks_changed` | 누락 레코드의 최소 정보만 보완 가능 | **전체 교체** | 사라진 작업을 성공 완료로 확정 |
| 메인 `result` | 해당 턴의 결과·입력 대응 관계 갱신 | 수정하지 않음 | 전체 작업·세션·프로세스 종료 |
| `stopTask()` ACK | 중단 요청 처리 기록 | 수정하지 않음 | 즉시 작업 카드 삭제 |
| 전송 연결 끊김 | 상태의 최신성 상실 표시 | 마지막 값은 이력으로 유지, 현재성은 미확인 | 작업이 성공 또는 실패했다고 확정 |
| 새 CLI 프로세스 시작 | 새 실행 세대로 분리 | 빈 집합으로 초기화 | 이전 실행의 프로세스가 재개됐다고 판단 |

비동기 시작 반환 직후 아직 스냅샷이 오지 않았다면 작업 상세에 “시작 확인 중”을 표시할 수 있다. 이 상태는 활동 배지를 조작하지 않지만, 곧바로 IdleClose하는 것을 막는 보류 사유로 사용한다.

### 종료 상태 및 이벤트 순서 변경

| 공식 수신 값 | Orca 의미 | 원본 보존 |
|---|---|---|
| `completed` | 완료 | 수신 메시지 종류와 상태 값 유지 |
| `failed` | 실패 | 오류·종료 근거 유지 |
| `stopped` | 중단 | `task_notification` 출처 유지 |
| `killed` | 중단 | `task_updated`의 원래 값 유지 |
| 모르는 상태 | 상태 확인 필요 | 임의의 성공·실패로 치환하지 않음 |

동일 실행의 종료가 확인된 후 뒤늦게 도착한 시작·진행 메시지가 실행 상태를 다시 `running`으로 만들지 않도록 한다. 다만 에이전트는 재호출·재개될 수 있으므로 **에이전트 ID 단위로 영구적인 종료 잠금**을 걸지 않는다. 새 도구 호출이나 명시적인 새 실행 근거가 있으면 새 실행 이력과 이전 이력을 구분한다.

작업별 종료 이벤트와 스냅샷이 잠시 불일치할 수 있다. 이때 종료 결과는 보존하고, 라이브 집합에는 아직 포함되어 있다는 사실도 유지한다. GUI는 “완료 · 실행 목록 동기화 중” 또는 “중단 · 정리 중”처럼 구분할 수 있다. 서로 다른 종료 결과가 충돌하면 수신 순서만으로 성공을 선택하지 않고 불일치 근거를 기록한다.

스냅샷에서 제외되었으나 종료 사유를 받지 못한 작업은 “실행 목록에서 제외됨 · 종료 사유 미확인”으로 처리한다. 종료 알림 누락을 성공 완료로 보정하지 않는다. 종료 후 다시 스냅샷에 나타났는데 새 실행 여부가 불명확하면 현재 소속은 반영하되 실행 이력은 재확인 대상으로 남긴다.

### 중복·부분 스트림·재전달 처리

**필수:** 같은 이벤트가 재전달되어도 작업·사용량·완료 알림·파일 카드가 중복 생성되지 않아야 한다.

| 상황 | 처리 |
|---|---|
| 같은 메시지 UUID와 같은 payload 재수신 | 동일 이벤트 재전달로 처리 |
| 같은 논리 메시지에 새로운 payload 도착 | 무조건 버리지 않고 업데이트·최종본 여부 판별 |
| UUID 없는 메시지 | 호스트 수신 ID를 부여하되 텍스트만으로 동일 메시지라고 확정하지 않음 |
| 부분 스트림 뒤 완성 assistant 메시지 | 동일 API 메시지·블록을 조립·확정하고 본문을 두 번 추가하지 않음 |
| 연결 공백 후 과거 이벤트 재생 | 이력 보강과 현재 실행 상태 적용을 분리 |
| 기존 상태가 없는 종료 이벤트 | 최소 작업 레코드를 만들어 종료·출력 정보를 보존 |
| 구조화 결과의 연결 대상이 아직 없음 | 미연결로 저장하고 ID를 확보한 뒤 연결 |

호스트의 수신 순번은 해당 연결에서 관찰한 순서이지 SDK 내부 실행의 전역 인과 순서가 아니다. 과거 이벤트의 타임스탬프를 정렬하여 현재 스냅샷보다 최신이라고 임의로 판단하지 않는다.

### 하위 에이전트 대화 및 자동 후속 턴

**공식 확인:** `forwardSubagentText`를 켜면 하위 텍스트·생각을 완전한 메시지로 받을 수 있다. 현재 참조상 `stream_event`는 메인 세션용이며 `parent_tool_use_id`가 `null`이다. [S-REF]

**필수:** 하위 메시지는 `parent_tool_use_id`로 해당 Agent 호출에 연결하고 메인 대화 본문에 무조건 합치지 않는다. 중첩 부모가 아직 없으면 미연결 하위 대화로 보존한 뒤 관계가 확인되면 연결한다. 메인 스트림의 token delta를 하위 작업 카드에 추정 배분하지 않는다.

| 정보 | 처리 규칙 |
|---|---|
| 사용자 봉투의 `tool_result` | 사람이 입력한 말풍선으로 표시하지 않음 |
| `origin.kind: "task-notification"` | 작업 알림에 의해 발생한 합성 입력·턴으로 표시 |
| `origin.kind: "peer"` 등 | 다른 에이전트 또는 세션의 출처로 구분 |
| `origin.subkind: "scheduled-trigger"` | 예약 트리거. 임의의 백그라운드 작업 ID와 연결하지 않음 |
| `origin.subkind: "peer-send-message"` | 세션 간 메시지 출처 구분 |
| `user_message_uuid` / `user_message_uuids` | 병합 입력과 자동 턴이 섞여도 실제 입력 대응 관계 유지 |
| `result.queued_turn_count` | 결과 시점의 대기 입력 수. 없음을 0으로 단정하지 않음 |

위 확장은 변경 이력에서 확인된다. 최신 `0.3.265`에서는 턴이 답하는 입력이 바뀔 때 이후 첫 응답 프레임에 입력 UUID가 다시 설정될 수 있다. “턴당 첫 프레임 하나에만 존재”하는 불변 규칙으로 구현하지 않는다. [S-CHANGELOG]

이미 SDK가 완료 알림에 따른 합성 턴을 생성하는 경로에서 Orca가 동일 내용을 다시 입력하여 중복 응답을 만들지 않는다. 출처가 없는 일반 사용자 입력에 적용되는 문서 규칙을 `tool_result` 봉투 전체에 확대하지 않는다.

### 개별 중단·메인 중단·전체 중단

| 사용자 동작 | 호스트 동작 | 사용자에게 확인할 상태 |
|---|---|---|
| 작업 카드의 중단 | 실제 작업 ID로 `Query.stopTask(taskId)` | 요청 중 → 요청 처리 → 작업 종료 확인 |
| Composer의 응답 중지 | 지원되는 지속 입력 구성에서 `Query.interrupt()` | 메인 턴 중지. 작업별 중지와 구분 |
| 모든 실행 중단 | 메인 입력 수락을 제어하고 현재 작업들에 개별 중단 후 재확인 | 원격·새로 생성된 작업·정리 중 작업을 포함해 미종료 항목 표시 |
| 세션 실행 종료 | 보존해야 할 작업을 확인한 뒤 `close()` 또는 제품 종료 정책 적용 | 연결 및 프로세스 종료. 결과 성공으로 표시하지 않음 |

**공식 확인:** `perTaskStopAffordance: true`는 지속 입력 구성에서 메인 interrupt 후 백그라운드 Agent·Workflow를 유지하도록 한다. 기본 동작 및 단발 문자열 프롬프트에서는 해당 작업들이 중단된다. 이 규칙을 Bash·Monitor·MCP까지 포함한 모든 작업의 동일한 취소 범위라고 일반화하지 않는다. [S-CHANGELOG]

**필수:** `stopTask()`의 Promise가 resolve된 것은 제어 요청 처리와 구분해 기록한다. 작업 종료 상태와 라이브 집합 제외 여부는 후속 이벤트로 확인한다. 중단 요청이 실패하면 기존 작업 상태를 보존하고 오류를 표시한다. 이미 완료된 작업에 대한 늦은 중단 응답이 기존 성공 결과를 중단으로 덮어쓰지 않도록 한다.

“전체 중단”은 한 번의 작업 목록 열거로 원자적으로 보장되는 SDK 연산이 아니다. 처리 중 새 작업이 생성될 수 있으므로 새 입력을 막고 최신 스냅샷을 다시 확인한다. 제한된 재확인 후에도 남는 작업은 명시하고, 무한 반복하거나 성공한 것처럼 숨기지 않는다. 원격 실행 중단 보장은 별도 환경 테스트를 통과해야 한다.

### 대기·일시 중지·재개 의미

| 기능 | 이 문서의 지원 의미 | 금지되는 혼동 |
|---|---|---|
| 결과 기다리기 | 선택한 작업의 종료 근거를 구독하고 필요시 출력 확보까지 기다림 | 대기 UI를 열었다고 메인 에이전트가 자동으로 기다리는 것은 아님 |
| 실행 정리 기다리기 | 해당 작업이 라이브 집합에서 빠지는 것을 별도로 확인 | 결과 반환과 프로세스 정리를 동일시 |
| 대기 취소 | GUI의 대기 구독을 해제 | 백그라운드 작업 자체를 중단 |
| 일시 중지 | 검증된 공개 제어 경로가 있을 때만 기능 노출 | `total_paused_ms` 필드 존재로 API 지원 추정 |
| 에이전트 재개 | 검증된 Agent 재호출·메시지 전달·세션 재개 흐름 사용 | 죽은 OS 프로세스가 살아난 것으로 표시 |
| Workflow 재실행 | 검증된 `resumeFromRunId` 의미에 따라 새 호출 | `runId`를 작업 ID로 바꾸어 중단 |

대기 완료 조건은 `task_notification`뿐 아니라 `task_updated` 종료 상태도 포함한다. 연결이 끊어지면 확인 불가 상태를 알리고 사용자가 대기를 해제할 수 있어야 한다. GUI 대기 제한 시간과 SDK 도구 실행 타임아웃은 별개 설정이다.

### 중단 영수증과 대기 입력

`interrupt()`의 `SDKControlInterruptResponse`에는 `still_queued: string[]`가 있다. 이는 중단 후에도 남아 실행될 수 있는 UUID 있는 메인 입력을 나타낸다. UUID 없는 입력이나 하위 에이전트 대상 입력까지 전부 표현하는 목록은 아니다. [S-REF]

**필수:** `still_queued`에 있는 입력을 재전송하지 않는다. 빈 배열을 세션 전체의 유휴 상태로 해석하지 않는다. 모르는 UUID는 원본으로 보존하되 사용자 입력을 임의로 생성하지 않는다.

`interrupt_receipt_v1` capability를 확인한다. capability가 없거나 반환값이 `undefined`인 실행은 대기열 보존 여부를 확인할 수 없음을 표시한다. `cancel_queued`를 지원하는 제어 경로를 사용하더라도 처리 범위·상태 이벤트를 실제 배포 조합에서 검증한다.

### 백그라운드 승인·질문 처리

백그라운드 에이전트도 `canUseTool`로 승인 요청을 전달할 수 있다. “백그라운드는 질문하지 않는다” 또는 “자동 거부된다”라는 구형 가정을 사용하지 않는다. [S-CHANGELOG]

| 콜백 필드 | 필수 처리 |
|---|---|
| `toolName`, `input` | 무엇을 실행하려는지 해당 작업과 함께 표시 |
| `toolUseID` | 도구 호출 연결 |
| `agentID` | 하위 에이전트 요청 표시. 값이 없을 때 임의 배정 금지 |
| `requestId` | 중복 대화상자·중복 응답 방지 |
| `signal` | 취소 시 UI를 정리하고 오래된 승인 응답을 막음 |
| `suggestions`, `decisionReason`, `blockedPath` | 제공되는 범위에서 설명·권한 편집 UI에 사용 |

**공식 확인:** `canUseTool`은 모든 도구 호출을 관찰하는 훅이 아니라 승인 요청 경로다. 이미 승인된 호출은 이 콜백을 거치지 않을 수 있다. `null` 반환은 자동 제어 응답 생략이며 거부가 아니다. [S-REF]

**필수:** 전체 작업 관찰을 `canUseTool` 호출 여부에 의존하지 않는다. 승인 응답은 SDK의 실제 `PermissionResult` 형식을 사용한다. 권한 요청 하나의 거부를 해당 에이전트 전체 실패로 처리하지 않는다. 작업 중단·연결 종료 뒤에는 이전 요청을 승인해도 실행되지 않도록 요청 수명을 검증한다.

`AskUserQuestion`처럼 실제 사용자 상호작용이 필요한 호출도 승인 라우팅과 충돌하지 않게 처리한다. 무인 실행 정책을 별도로 정하지 않은 상태에서 요청을 영원히 방치하거나 자동 승인하지 않는다.

### 재연결·프로세스 재시작·과거 기록

| 상황 | 필수 동작 |
|---|---|
| 같은 CLI 프로세스에 재연결 | 현재성 미확인 표시 → `reinitialize()` → 승인 요청 재전달 및 새 라이브 스냅샷 수신 |
| 새 CLI 프로세스 생성 | 새 실행 세대 생성, 라이브 집합 빈 상태 초기화, 과거 작업은 과거 이력으로 유지 |
| 같은 `session_id`를 `resume` | 대화 복원과 실행 복원을 구분. 이전 셸·감시 프로세스가 살아 있다고 가정 금지 |
| 프로세스 종료 이벤트 | 종료 사유·오류 보존. 미확인 작업을 성공 처리하지 않음 |
| 과거 종료 메시지 재생 | 이력 표시만 수행. 현재 연결을 닫지 않음 |
| 원격 실행이 연결된 상태에서 로컬 종료 | 원격 상태는 확인 불가로 남길 수 있음. 원격 취소·완료를 임의 확정 금지 |

`reinitialize()`의 resolve만으로 새 라이브 집합을 이미 수신했다고 단정하지 않는다. 초기화 응답과 뒤따르는 스냅샷을 별도로 처리한다. 재전달된 동일 `requestId`의 승인 요청은 같은 요청으로 취급한다. [S-REF], [S-CHANGELOG]

SDK의 `getSessionMessages()`가 모든 라이브 시스템 이벤트·진행 스냅샷을 복구한다고 가정하지 않는다. 작업 패널을 다시 구성하는 데 필요한 이벤트·결과 연결 정보는 Orca가 자체 이력으로 보존해야 한다. [S-REF]

### 런타임 수명 및 IdleClose

**공식 확인:** 비대화형 `-p`의 작업 수명은 종류별로 다르다. [S-HEADLESS]

| 종류 | 공식 문서의 종료 동작 |
|---|---|
| 백그라운드 Bash | 최종 결과 반환 및 stdin 닫힘 이후 약 5초의 정리 유예 뒤 종료 |
| 백그라운드 Agent·Workflow | 결과를 기다리며 실행 유지. 기본 연속 유휴 대기 상한은 10분 |
| Monitor | 감시 타임아웃 또는 대기 상한까지 대기하며 감시 이벤트에 반응 |

대기 상한은 `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`로 조정할 수 있으며, CLI 문서는 `0`을 상한 없음으로 설명한다. 이를 Orca의 IdleClose 제한 시간과 동일한 값으로 취급하지 않는다. [S-HEADLESS]

**Orca 요구:** 첫 `result` 수신을 이유로 지속 세션의 메시지 소비 루프에서 빠져나오거나 stdin을 닫지 않는다. 출력 소비가 계속되어야 완료 알림·승인 요청·합성 후속 턴을 받을 수 있다.

IdleClose 후보가 되려면 최소한 다음 상태를 함께 검사해야 한다.

| 점검 대상 | 종료를 보류할 조건 |
|---|---|
| 현재 메인 턴·도구 호출 | 실행 중이거나 종료 처리가 남음 |
| 작업 시작 확인 | 비동기 시작 반환 등은 받았으나 라이브 상태가 아직 동기화되지 않음 |
| 라이브 백그라운드 집합 | 작업이 남아 있음. `ambient` 작업도 무조건 무시하지 않음 |
| 미응답 승인·질문 | 응답 대기 또는 취소 정리 중 |
| 중단 제어 | 제어 요청·작업 종료 확인이 남음 |
| 대기 입력 | 처리되지 않은 입력이 있거나 대기열 상태가 불명확 |
| 자동 후속 턴 | 수신된 완료 알림 등의 후속 실행 처리가 남음 |
| 연결 신뢰성 | 연결 공백 후 재동기화가 끝나지 않음 |

이 점검은 호스트의 종료 정책이며 SDK가 원자적인 `idle` 판정을 제공한다는 뜻이 아니다. 종료 결정 직전 새 이벤트·입력이 들어오는 경쟁 상태를 직렬화된 호스트 처리 경로로 방어한다.

연결 생존, 의미 있는 작업 진행, 승인 대기, API 재시도 대기는 별도로 관찰한다. heartbeat가 있다고 작업이 진척된 것은 아니며, 일정 시간 텍스트가 없다고 백그라운드 작업이 멈춘 것도 아니다. Windows의 프로세스 트리 정리는 실제 배포 환경에서 검증하고 POSIX signal 동작을 그대로 가정하지 않는다.

### 출력 읽기·보존·안전성

| 출력 출처 | 보존 방식 |
|---|---|
| Agent `content` | 에이전트 결과 콘텐츠로 저장 |
| `outputFile` / `output_file` | 원래 출처 및 작업과 연결된 경로 참조 |
| Bash `stdout` / `stderr` | 반환 시점의 출력으로 저장 |
| `rawOutputPath` | 원시 로그 참조 |
| `persistedOutputPath` | 저장된 결과 참조. 원시 로그와 구분 |
| `resourceLinks` / `resource_links` | MCP 리소스 참조. 파일 시스템 경로와 구분 |
| Workflow `transcriptDir` | 내부 대화 기록 디렉터리. 최종 보고서 파일로 취급하지 않음 |

**필수:** 출력 경로가 생겼다는 이유로 결과 완성을 표시하지 않는다. 실행 중 출력, 완료 시점의 출력, 이후 파일 변경을 구분한다. 종료 후 읽기 성공은 작업 성공 여부와 별개다. `canReadOutputFile: false`를 명시한 결과는 직접 로컬 읽기를 시도하지 않는다.

호스트가 파일을 읽는 것은 SDK 모델이 `Read` 도구를 호출한 것이 아니다. GUI 파일 열기를 가짜 도구 호출·가짜 transcript 항목으로 기록하지 않는다. 본문을 다시 모델에게 전달해야 한다면 별도의 명시적 입력 동작으로 처리한다.

| 안전·성능 요구 | 동작 |
|---|---|
| 경로 검증 | 허용된 작업 출력 루트·명시적으로 승인된 경로 안에서만 읽기. 정규화·심볼릭 링크·Windows 경로 경계를 검증 |
| 접근 실패 | 아직 없음 / 권한 없음 / 원격 경로 / 삭제됨을 구분. 완료 카드를 제거하지 않음 |
| 대용량 출력 | 크기 제한·부분 읽기·페이지/증분 표시. 전체 파일 반복 읽기 금지 |
| 쓰는 중인 파일 | 부분 출력으로 표시하고, EOF를 실행 완료로 해석하지 않음 |
| 파일 교체·잘림 | 읽기 위치와 변경을 확인. 다른 출력의 단순 이어붙이기 금지 |
| 결과 보존 | 완료 시 확보한 스냅샷과 현재 원본 파일을 구분. 해시·크기를 저장한 경우 그 근거로만 변경을 표시 |
| 외부 수정 | 파일 경로만으로 현재 파일의 모든 내용이 에이전트 산출물이라고 보증하지 않음 |
| 콘텐츠 렌더링 | HTML·Markdown·터미널 제어 문자·링크를 안전하게 처리. 임의 코드 실행 금지 |
| 자격 증명 | raw 이력은 접근 통제된 저장소로 제한. 일반 로그·내보내기에서는 토큰·쿠키·헤더 제거 |
| 원격 접근 | URI 존재를 자동 인증·다운로드·업로드 권한으로 해석하지 않음 |

### 사용량과 비용

공식 변경 이력은 `result.usage`를 메인 루프의 턴별 값, `result.modelUsage`를 query-pipeline 전체 호출의 누적 값으로 구분한다. [S-CHANGELOG]

| 값 | Orca 처리 |
|---|---|
| `task_progress.usage` | 해당 작업의 최신 진행값으로 교체 |
| `task_notification.usage` | 종료 통계로 보존. 진행 통계에 다시 합산하지 않음 |
| `Agent completed.usage` | 해당 Agent 실행의 결과 통계로 보존 |
| `result.usage` | 해당 메인 턴의 사용량으로 기록 |
| `result.modelUsage` | 전체 query 집계용 누적 스냅샷으로 보존 |
| `thinkingTokens` / `output_tokens_details` | 제공된 범위에서 보존. 전체 출력 토큰에 다시 더하지 않음 |

**필수:** 전체 누적값에 하위 작업 통계를 다시 더하지 않는다. 모든 result의 누적값을 합산하지 않는다. 프로세스 재시작·세션 재개 때 누적 기준이 유지되는지 실제 로그를 확인하고, 기준이 달라졌는데 단순 차분을 계속하지 않는다. 비용 계산과 GUI 진행 통계를 다른 용도로 취급한다.

### GUI 필수 표시 및 동작

| 화면 요소 | 필수 동작 |
|---|---|
| 실행 목록 | 라이브 집합과 완료 이력을 구분. 체크리스트와 분리 |
| 작업 카드 | 설명·원래 도구·작업 종류·현재 상태·경과·최근 동작·부모 관계·출력 상태 표시 |
| 실행 수 배지 | 최신 스냅샷 기준. `ambient` 제외 정책 적용 가능. 연결 불명확 시 확정 숫자로 오인되지 않게 표시 |
| 상태 세부 | 승인 대기·재시도 대기·중단 요청·정리 중을 실행 상태와 구분 |
| 결과 | 알림 요약과 전체 출력 구분. 읽기 불가·부분 출력 표시 |
| 하위 대화 | 대응 Agent 호출 아래에 표시. 부모 미확인 메시지를 버리지 않음 |
| 중단 버튼 | 작업 ID와 실행 연결이 유효한 경우 제공. 클릭 후 중복 요청 방지 |
| 완료 통지 | 작업 종료당 한 번. raw 결과가 두 경로로 와도 중복 통지하지 않음 |
| 메인 응답 중지 | 해당 구성의 실제 중지 범위에 맞는 UI 문구 사용 |
| 미지원 기능 | 실제 제공되지 않는 기능과 검증하지 않은 기능을 구분. 동작하지 않는 제어를 성공처럼 표시하지 않음 |

`ambient`의 일반 배지 제외는 필터링 정책일 뿐 실행 취소·이력 삭제가 아니다. `task_type`이 모르는 값이어도 일반 작업 카드로 표시하고 원본을 확인할 수 있어야 한다.

## 3. 수용 테스트와 지원 완료 판정

### 검증 환경과 증거 형식

테스트마다 SDK 버전, 실제 실행한 CLI의 버전·경로, OS, 모델 제공 경로, 사용 모델, 입력 모드, 관련 옵션·정책, 도구 가용 목록을 함께 기록한다. 자격 증명 값은 기록하지 않는다.

| 검증 종류 | 목적 | 필요한 증거 |
|---|---|---|
| 선언 검증 | 고정 배포물에서 실제 타입·메서드·필드 확인 | package 버전·lockfile 및 관련 `.d.ts` 선언 위치 |
| 실제 실행 검증 | 도구별 실제 출력·이벤트·제어 동작 확인 | 민감정보를 제거한 원본 SDK 메시지와 제어 요청·응답 |
| 호스트 재생 검증 | 중복·이벤트 순서 변경·누락·재연결·충돌 처리 | 합성 또는 실제 로그 기반 fixture, 기대 상태, 최종 UI 상태 |

문서에 있는 필드 목록만으로 실제 실행 테스트를 통과한 것으로 처리하지 않는다. 합성 fixture와 실제 로그를 명확히 구분한다. 자료가 없는 기능은 추측으로 채우지 않고 검증 미완료로 표시한다.

### 필수 수용 기준

| 테스트 ID | 상황 | 통과 기준 |
|---|---|---|
| `AGENT-DEFAULT` | `run_in_background` 생략 | 입력의 `true` 여부만 보지 않고 실제 분리 실행을 감지 |
| `AGENT-FOREGROUND` | `run_in_background: false` | 동기 반환을 처리하고 백그라운드 배지에 임의 추가하지 않음 |
| `AGENT-FORCED` | 정의에 `background: true` | 호출 입력과 실제 실행 모드가 다를 수 있음을 처리 |
| `AGENT-LAUNCH` | `async_launched` 결과 | 도구 호출은 반환, 작업은 완료되지 않은 상태로 유지 |
| `AGENT-COMPLETE` | `completed` 결과 | 보고서·사용량·실제 모델·worktree 메타데이터를 보존 |
| `AGENT-PARTIAL` | `maxTurns` 도달 | 실행 종료와 요구 완수·부분 결과를 혼동하지 않음 |
| `AGENT-NESTED` | 하위 에이전트가 도구·추가 에이전트 실행 | 부모 호출과 현재 호출을 정확히 분리. 늦은 부모 연결도 복구 |
| `AGENT-RESUMED` | 완료된 에이전트를 다시 호출 | 이전 결과 보존, 새 호출·실행 이력과 구분 |
| `BASH-EXPLICIT` | 명시적 백그라운드 Bash | 작업 ID·명령·출력 경로 연결, 개별 중단 동작 |
| `BASH-TIMEOUT` | 타임아웃으로 자동 전환 | 실패·종료로 오판하지 않고 `timedOutAfterMs` 등 실제 값 보존 |
| `BASH-TIMEOUT-EXCEPTION` | 자동 전환되지 않는 명령 | 전환을 추정하지 않고 실제 타임아웃 결과 반영 |
| `BASH-STDERR` | stderr는 있지만 실행 성공 | stderr만으로 실패 처리하지 않음 |
| `BASH-LIFETIME` | 메인·포그라운드 하위·백그라운드 하위에서 생성한 셸 | 소유 주체별 실제 수명 차이를 기록하고 검증 |
| `START-AFTER-SNAPSHOT` | 스냅샷 후 시작 이벤트 | 카드 중복·실행 수 중복 증가 없음 |
| `END-BEFORE-START` | 종료 정보 후 지연된 시작·진행 | 같은 실행을 재활성화하지 않음 |
| `STOP-WITHOUT-NOTIFICATION` | `task_updated: killed`만 발생 | 완료 알림 없이도 중단 판정·대기 해제 |
| `SNAPSHOT-DISAPPEAR` | 종료 알림 없이 라이브 집합에서 제외 | 성공으로 추정하지 않고 종료 사유 미확인 표시 |
| `TERMINAL-STILL-LIVE` | 종료 정보는 왔지만 집합에 잠시 남음 | 종료 결과와 정리·동기화 중 상태를 함께 보존 |
| `TERMINAL-CONFLICT` | 서로 다른 종료 결과 | 조용히 덮어쓰지 않고 근거·불일치 보존 |
| `PATCH-ABSENCE` | 일부 필드만 있는 patch | 없는 필드는 유지, `false`·`0` 값은 정확히 반영 |
| `DUPLICATE-EVENT` | 동일 이벤트 재전달 | 카드·통지·통계·파일 참조 중복 없음 |
| `UNKNOWN-SCHEMA` | 모르는 필드·상태·작업 종류 | 스트림 중단 없이 원본 보존·제한된 표시 |
| `MALFORMED-KNOWN` | 알려진 필드가 잘못된 타입 | 해당 해석 실패를 격리하고 다른 작업 계속 처리 |
| `MAIN-RESULT-EARLY` | 메인 result 뒤 작업 완료·후속 턴 | 메시지 소비와 연결 유지, 후속 응답 누락 없음 |
| `STOP-TASK` | GUI 개별 중단 | 대상만 중단 요청, ACK와 종료 확인 구분 |
| `STOP-RACE` | 완료와 중단 요청이 동시에 발생 | 이미 확보한 결과를 잃지 않고 최종 근거 보존 |
| `STOP-FAILURE` | 제어 요청 실패 | 카드 삭제·중단 완료 오표시 없음, 오류 표시 |
| `STOP-MAIN-ONLY` | `perTaskStopAffordance: true`인 지속 입력 | 메인 턴만 중단하고 유지 대상 작업을 계속 관찰 |
| `STOP-DEFAULT` | 기본 구성의 interrupt | 실제 영향 범위를 확인하여 UI 문구와 일치 |
| `STOP-ALL-RACE` | 전체 중단 중 신규 작업 생성 | 재확인으로 잔여 실행 식별, 원자적 완료라고 오표시하지 않음 |
| `INTERRUPT-QUEUE` | `still_queued`가 있는 응답 | 남은 입력을 중복 재전송하지 않음 |
| `QUEUE-UNKNOWN` | UUID 없는 입력 또는 capability 부재 | 빈 배열·undefined를 유휴 확정으로 해석하지 않음 |
| `PERMISSION-BACKGROUND` | 하위 에이전트 승인 요청 | 정확한 작업·호출·요청에 연결하고 응답 |
| `PERMISSION-REDELIVERY` | 같은 요청이 재전달 | 대화상자·응답 중복 없음 |
| `PERMISSION-CANCEL` | 승인 대기 중 작업 중단 | UI 정리, 오래된 승인 응답 방지 |
| `PERMISSION-DENY` | 하위 도구 하나 거부 | 에이전트 전체를 임의 실패 처리하지 않음 |
| `QUESTION-BACKGROUND` | 지원되는 하위 사용자 질문 | 실제 전달·응답·취소 경로 검증. 미지원이면 명시 |
| `RETRY-HEARTBEAT` | retry 표시 후 heartbeat만 반복 | retry 표시 유지, 연결 생존과 작업 진척 구분 |
| `RECONNECT-LIVE` | 같은 프로세스 재연결 | 새 스냅샷으로 라이브 집합 복구, 승인 요청 재동기화 |
| `RESTART-PROCESS` | 같은 대화 세션을 새 CLI로 재개 | 이전 작업을 살아 있다고 표시하지 않음 |
| `REPLAY-HISTORY` | 과거 작업·워커 종료 이벤트 재생 | 현재 실행 상태·연결 종료에 잘못 적용하지 않음 |
| `IDLECLOSE-PENDING` | 시작 확인·승인·대기 입력이 남음 | result만 보고 IdleClose하지 않음 |
| `ONE-SHOT-EXIT` | 단발 입력 종료 | Agent·Workflow·Bash·Monitor의 실제 수명 차이를 기록 |
| `OUTPUT-PARTIAL` | 작업 중 파일이 계속 증가 | 부분 표시·증분 읽기, EOF를 완료로 오인하지 않음 |
| `OUTPUT-UNAVAILABLE` | 삭제·권한 오류·원격 경로 | 작업 종료 결과는 유지, 접근 상태 별도 표시 |
| `OUTPUT-MODIFIED` | 완료 이후 원본 파일 변경 | 보존한 결과와 현재 파일을 구분 |
| `OUTPUT-SAFETY` | 허용 범위 밖 경로·악성 콘텐츠 | 무단 읽기·실행·전송 방지 |
| `USAGE-SNAPSHOT` | 여러 progress·result | 스냅샷·누적값 이중 합산 없음 |
| `TRANSCRIPT-ROUTING` | main·하위·도구 반환·합성 입력 혼재 | 사람 발화·메인·하위 내용을 정확히 분리 |
| `INPUT-MERGE` | 여러 입력이 병합되거나 턴 중 입력 대응 변경 | UUID 배열과 이후 대응 갱신을 처리 |
| `TASKLIST-SEPARATION` | 체크리스트가 변경됨 | 백그라운드 실행 수·중단 대상에 영향 없음 |

### 조건부 수용 기준

| 테스트 ID | 조건 | 통과 기준 |
|---|---|---|
| `POWERSHELL-BACKGROUND` | PowerShell 도구 제공 | 실제 지원되는 분리 실행·결과·작업 ID·중단을 확인 |
| `POWERSHELL-ENCODING` | Windows 배포 | 한글 출력·stderr·오류·중단과 프로세스 정리를 검증 |
| `MONITOR-COMMAND` | Monitor 제공 | stdout 이벤트·진행·종료·개별 중단 연결 |
| `MONITOR-WEBSOCKET` | WebSocket Monitor 제공 | 승인·연결 실패·메시지·중단·타임아웃 처리 |
| `MONITOR-PERSISTENT` | persistent 감시 사용 | GUI 유휴·런타임 종료 정책과 충돌 없음 |
| `WORKFLOW-START-ERROR` | Workflow 제공 | `async_launched` + `error`를 실행 시작으로 오표시하지 않음 |
| `WORKFLOW-CHILDREN` | 내부 에이전트 진행 제공 | 부모 실행과 내부 작업 상태·blocked 구분 |
| `WORKFLOW-STOP` | Workflow 제공 | 중단 후 내부 실행·잔여 프로세스 정리까지 확인 |
| `WORKFLOW-RESUME` | `resumeFromRunId` 사용 | 이전 실행과 새 호출·캐시 결과를 구분 |
| `SKILL-DETACHED` | 분리 Skill 사용 | `background: true` 및 작업 이벤트를 중복 없이 연결 |
| `MCP-AUTO-BACKGROUND` | 자동 분리 MCP 사용 | 시작·실패·중단·완료의 실제 스키마 확인 |
| `MCP-RESOURCES` | MCP 파일 참조 반환 | `resourceLinks`·`resource_links`를 호출에 연결, 중복 카드 방지 |
| `MCP-META` | `_meta` 포함 결과 | 메인·하위 모두 구조화 결과 보존 |
| `REMOTE-AGENT` | 원격 Agent 사용 가능 | 원격 링크·상태·출력·중단 범위 실제 확인 |
| `REMOTE-DISCONNECT` | 원격 실행 중 로컬 종료 | 원격 결과를 임의 확정하지 않음 |
| `AMBIENT-TASK` | ambient 작업 발생 | 일반 배지 필터와 실제 실행·수명 처리를 구분 |
| `LEGACY-TASKOUTPUT` | deprecated 도구 호출 발생 | 실제 결과를 손실 없이 표시하고 새 실행 관리와 분리 |
| `CANCEL-QUEUED` | 제어 요청 경로를 구현함 | 실제 지원 capability·타입·취소된 입력 범위를 검증 |

실제 SDK·제공 경로가 노출하지 않는 기능은 “가용하지 않음”으로 기록할 수 있다. **노출되지만 아직 시험하지 않은 기능을 가용하지 않다고 표시하여 통과시키면 안 된다.**

### 합성 메시지 예시

아래는 호스트 상태 처리의 의미를 설명하기 위해 작성한 **합성 메시지**다. 실제 SDK를 실행해 수집한 로그가 아니며, 전체 도구 호출 시퀀스를 재현하지 않는다. 필드의 실제 필수성·추가 필드는 배포물 선언 및 실제 로그 검증이 우선한다.

#### 예시: 시작 이벤트보다 라이브 스냅샷이 먼저 도착

```json
[
  {
    "type": "system",
    "subtype": "background_tasks_changed",
    "tasks": [
      {
        "task_id": "bg_demo_a",
        "task_type": "local_agent",
        "description": "테스트 결과 분석"
      }
    ],
    "uuid": "00000000-0000-4000-8000-000000000001",
    "session_id": "00000000-0000-4000-8000-000000000100"
  },
  {
    "type": "system",
    "subtype": "task_started",
    "task_id": "bg_demo_a",
    "tool_use_id": "toolu_demo_a",
    "description": "테스트 결과 분석",
    "task_type": "local_agent",
    "is_backgrounded": true,
    "spawn_depth": 1,
    "uuid": "00000000-0000-4000-8000-000000000002",
    "session_id": "00000000-0000-4000-8000-000000000100"
  }
]
```

기대 결과: 작업 카드는 하나이며 라이브 작업도 하나다. 뒤늦은 `task_started`는 호출 연결을 보강할 뿐 실행 수를 증가시키지 않는다.

#### 예시: 완료 알림 없이 killed 패치로 중단

```json
[
  {
    "type": "system",
    "subtype": "task_updated",
    "task_id": "bg_demo_b",
    "patch": {
      "status": "killed"
    },
    "uuid": "00000000-0000-4000-8000-000000000003",
    "session_id": "00000000-0000-4000-8000-000000000100"
  },
  {
    "type": "system",
    "subtype": "background_tasks_changed",
    "tasks": [],
    "uuid": "00000000-0000-4000-8000-000000000004",
    "session_id": "00000000-0000-4000-8000-000000000100"
  }
]
```

기대 결과: `task_notification`이 없어도 중단 상태가 확정된다. 결과 대기를 해제할 수 있고, 라이브 스냅샷에서 제외된 사실도 별도로 반영한다. 중단 이력은 남긴다.

#### 예시: 라이브 집합에서 제외된 뒤 완료 정보 보강

```json
[
  {
    "type": "system",
    "subtype": "background_tasks_changed",
    "tasks": [],
    "uuid": "00000000-0000-4000-8000-000000000005",
    "session_id": "00000000-0000-4000-8000-000000000100"
  },
  {
    "type": "system",
    "subtype": "task_notification",
    "task_id": "bg_demo_c",
    "tool_use_id": "toolu_demo_c",
    "status": "completed",
    "output_file": "C:/Orca/example-output/result.txt",
    "summary": "분석 결과가 준비되었습니다.",
    "uuid": "00000000-0000-4000-8000-000000000006",
    "session_id": "00000000-0000-4000-8000-000000000100"
  }
]
```

기대 결과: 첫 메시지에서는 이전에 있던 작업의 종료 이유를 아직 확정하지 않는다. 두 번째 메시지로 완료와 출력 참조를 보강한다. 예시 경로에 파일이 실제로 존재한다는 뜻은 아니다. 파일 읽기 실패가 실행 완료를 취소하지 않는다.

### 호환성에 영향을 주는 확인된 변경

| SDK 버전 | 백그라운드 지원 관련 변경 |
|---|---|
| `0.3.186` | 백그라운드 승인 요청을 `canUseTool`로 전달, 작업 중 stdin 유지 관련 변경 |
| `0.3.195` | `Query.reinitialize()` |
| `0.3.199` | 권한 `requestId`, `null` 응답, `workflow_agent.blocked` |
| `0.3.202`–`0.3.203` | 기록의 `parent_agent_id`, 라이브 `background_tasks_changed` |
| `0.3.205`–`0.3.207` | interrupt 영수증·capability, `command_lifecycle`, 구조화 Agent 결과 타입 보강 |
| `0.3.210`–`0.3.216` | Bash `timedOutAfterMs`, retry 정보·aborted·메시지 timestamp·`tool_result_meta` |
| `0.3.218`–`0.3.219` | Skill 분리 실행 표시, interrupt의 `cancel_queued` 제어 확장 |
| `0.3.223` | `usage`와 `modelUsage`의 집계 범위 명시, 권한 거부 이벤트 |
| `0.3.225` | 하위 백그라운드 Agent가 자신이 남긴 셸·Monitor 완료를 받지 못하는 문제 수정 |
| `0.3.228`–`0.3.232` | Agent 출력 토큰 상세, 하위 MCP `_meta` 반환 일관성 |
| `0.3.238`–`0.3.239` | 시작 이벤트의 실행 모드·깊이, 재초기화 후 라이브 스냅샷 |
| `0.3.243` | 결과의 `queued_turn_count` |
| `0.3.246`–`0.3.247` | `perTaskStopAffordance`, `ambient` |
| `0.3.257` | MCP 리소스 참조, Agent heartbeat, 단발 종료·interrupt 경계의 작업 통지 수정 |
| `0.3.259`–`0.3.265` | 병합·합성·턴 중 대응 변경의 입력 UUID 전달 보강 |
| `0.3.267` | 본 문서의 기준 릴리스. Browser SSE 전송 관련 추가 기능은 별도 범위 |

출처: 버전 `v0.3.267`에 고정한 공식 변경 이력. [S-CHANGELOG]

이 표의 버전을 곧바로 모든 메서드의 최소 지원 버전으로 사용하지 않는다. 특히 SDK와 별도 지정 CLI 버전이 다를 수 있다. 실제 시작 정보의 `claude_code_version`, 공개 capability, 동작 테스트를 함께 확인한다. 문서에 없는 capability 이름을 만들어 검사하지 않는다.

### 남은 검증 항목

| 항목 | 현재 확인 범위 | 지원 완료 전에 필요한 증거 |
|---|---|---|
| npm 배포물의 정확한 선언 | 공식 릴리스·웹 참조·변경 이력 확인 | `0.3.267`의 실제 `.d.ts`, 메서드 시그니처·필수성·하위 타입 |
| `tool_result_meta` | 필드 존재·목적 확인 | `non_execution_kind` 전체 값, user feedback 타입, 도구별 반환 |
| `subagent_retry` | 존재 및 heartbeat와의 관계 확인 | 내부 스키마·해제 신호·API 오류별 payload |
| 작업 시작 확장 필드 | `is_backgrounded`, `spawn_depth`, `ambient` 존재 확인 | 작업 종류별 필수·선택 여부와 실제 값 |
| PowerShell | 별도 도구·설정·훅 대상임을 확인 | 배포 환경의 입력·출력·백그라운드 지원·중단·프로세스 정리 |
| `TaskOutput` | deprecated 입력 경로 확인 | 실제 반환 구조·오류 형태. 호환 범위에 포함할 때 필수 |
| `workflow_agent` | 이벤트 및 `blocked` 존재 확인 | 전체 봉투·부모 연결·상태·진행 payload |
| MCP 백그라운드 실행 | 완료 파일 참조 경로 확인 | 시작·취소·실패 스키마, 리소스 상세 타입·읽기 경로 |
| Skill 분리 실행 | `background: true` 확인 | 결과와 작업 ID를 연결하는 실제 시퀀스 |
| 원격 Agent | `remote_launched` 반환 구조 확인 | 원격 실행 수명·개별 중단·출력 접근·재연결 동작 |
| 큐 동시 취소 | `cancel_queued` 제어 요청과 capability 확인 | 실제 TypeScript 호출 표면 또는 지원 전송 구현 |
| 재개·재호출 시 ID와 통계 | 관련 ID 및 누적 통계의 존재 확인 | ID 재사용·새 실행 판정·누적 기준의 실제 로그 |
| 가용 환경 차이 | 도구 제공 조건이 다름을 확인 | Windows·Bedrock·기타 실제 배포 프로필별 결과 |

검증 필요 필드는 원본 보존으로 데이터 손실을 막을 수 있지만, **원본을 저장한다는 사실만으로 해당 기능을 완전히 지원한 것은 아니다.**

### 지원 완료 판정

지원 완료는 다음 세 기준을 모두 만족한 **명시적인 배포 프로필**에 대해서만 선언한다.

- **프로토콜 처리:** 해당 환경의 실제 메시지·도구 결과·새 필드가 연결·상태·출력·권한 처리에 정확히 반영되고, 미해석 정보가 손실되지 않는다.
- **사용자 상호작용과 수명:** 개별 중단·메인 중지·승인·대기·재연결·IdleClose가 서로 충돌하지 않고, 실제 종료와 결과 확보를 구분한다.
- **검증 증거:** 필수 수용 테스트와 가용 기능의 조건부 테스트를 통과하고, 사용 중인 기능에 영향을 주는 미확인 항목이 남아 있지 않다.

이 문서의 현재 상태는 **공개자료 기반 구현 스펙 작성 완료 / 배포 선언 및 실환경 검증 미완료**다.

### 참고 자료

| 식별자 | 자료 | 사용 범위 |
|---|---|---|
| [S-RELEASE] | 공식 TypeScript SDK `v0.3.267` 릴리스 | 기준 버전·게시일·CLI parity |
| [S-CHANGELOG] | `v0.3.267` 태그에 고정한 공식 변경 이력 | 최신 확장 필드·버전별 동작 변화 |
| [S-REF] | 공식 TypeScript SDK API 참조 | 도구 입력·출력, 메시지, 옵션, Query, 승인 API |
| [S-SUBAGENTS] | 공식 SDK Subagents 가이드 | 기본 백그라운드 실행, Agent/Task 이름, 중첩·재개·부분 결과 |
| [S-TOOLS] | 공식 도구 참조 | TaskOutput deprecated, 셸·Monitor·PowerShell 및 체크리스트 구분 |
| [S-HEADLESS] | 공식 비대화형 실행 가이드 | 단발 실행 종료·대기 상한 |
| [S-STREAMING] | 공식 Streaming Input 가이드 | 지속 입력 구성과 단발 입력 구분 |
| [S-PY-CHANGELOG] | 공식 Python SDK 변경 이력, 확인한 commit 고정 | `task_updated`만으로 종료되는 경로의 교차 확인 |

공식 API 참조·가이드는 상시 갱신될 수 있다. 릴리스·변경 이력은 아래 고정 버전 링크를 사용한다. Python SDK 자료는 같은 CLI 사건의 교차 확인에만 사용하며 TypeScript 공개 시그니처의 근거로 대체하지 않는다.

[S-RELEASE]: https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.267
[S-CHANGELOG]: https://github.com/anthropics/claude-agent-sdk-typescript/blob/v0.3.267/CHANGELOG.md
[S-REF]: https://code.claude.com/docs/ko/agent-sdk/typescript
[S-SUBAGENTS]: https://code.claude.com/docs/en/agent-sdk/subagents
[S-TOOLS]: https://code.claude.com/docs/en/tools-reference
[S-HEADLESS]: https://code.claude.com/docs/en/headless
[S-STREAMING]: https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
[S-PY-CHANGELOG]: https://github.com/anthropics/claude-agent-sdk-python/blob/ad77094bbd26e219c377038cb6f77296c6bf2e53/CHANGELOG.md
