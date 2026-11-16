# Claude Code mods 메커니즘 조사 — 범용 세션 훅과 우측 패널 갱신의 레퍼런스

> 성격: **자료조사(evidence)**. 현재 규칙이 아니며 구현 계획도 아니다. 결정이 필요한 항목은 §7에 모았다.
> 조사일: 2026-11-16.

## 0. 조사 대상과 방법

| 항목 | 값 |
|---|---|
| 조사 대상 SDK | `@anthropic-ai/claude-agent-sdk` **0.3.325** (동봉 CLI **2.1.325**, linux-x64) |
| 저장소가 고정한 SDK | `app/package.json` 의 exact pin 그대로 — **이 조사로 올리지 않았다**(사용자 지시) |
| 1차 문서 | `https://code.claude.com/docs/en/plugins/mods` 와 하위 9쪽(create · reference · interface · gallery · events · api · test · troubleshoot · admin) |
| 공개 타입 | 설치본의 `sdk.d.ts` |
| 엔진 코드 | 동봉 CLI 바이너리에 내장된 minified JS — 문자열 검색과 주변 덤프로 읽었다 |
| 실행 확인 | 동봉 CLI 로 `claude plugin validate` 를 시험용 mod 에 실행 |

조사 버전에서 `npm run typecheck` 는 통과했고 소스 수정은 필요 없었다. 0.3.325 를 실제로 채택할 때는 Windows 에서 전체 게이트를 다시 돌려야 한다 — 이 조사는 Linux 에서 했고, 그 환경에서는 Electron 바이너리·`better-sqlite3` 바인딩 부재와 Windows 전용 분기 때문에 전체 스위트를 판정 근거로 쓸 수 없다.

읽은 범위: overview · create · reference · events · api 는 본문, interface 는 색상·백드롭 절을 뺀 대부분, gallery · test · troubleshoot · admin 은 목차와 앞부분.

## 1. mod 가 무엇인가

mod 는 **hooks module 을 가진 플러그인**이다. `hooks/hooks.json` 의 `modules` 가 가리키는 ES 모듈이 `register(on, options)` 를 export 하고, 그 안에서 이벤트 핸들러를 등록한다.

| 축 | 메커니즘 |
|---|---|
| 등록 | `on(이벤트, 매처?, ($, e, next) => …)`. 매처는 필드별 값·배열·정규식. 이벤트명은 문자열 리터럴이어야 한다 |
| 처리 방식 | 미들웨어 체인. **관찰** `return next(e)` · **재작성** `next({...e, 필드})` · **응답** `next` 없이 결과 반환 |
| 입력 | `e` 는 깊이 동결된 plain data |
| 바깥 접근 | `$` (mods API) 하나뿐. 모듈에는 Node API·타이머 전역·네트워크가 없다 |
| 감사 가능성 | 모든 `$` 호출이 다시 이벤트(`fs.read` 등)다. 정적 분석이 실행 없이 훅·호출 목록을 낸다 |
| 순서 | 내장 가드·조직 `prependPlugins` → 사용자 설치 → 조직 `appendPlugins` → 그 밖의 내장. 앞선 mod 가 바깥쪽 |
| 실패 | 기본 fail-open — 던지거나 시간 초과한 훅은 건너뛴다. `.catch(handler)` 로 fail-closed 를 만든다 |
| 시간 한도 | 훅 자체 실행 10초(`prompt.edit` 50ms), `.catch` 1초. `next` 와 `$` 호출 대기는 세지 않는다 |
| 상태 수명 | 모듈 변수(리로드까지) · `$.state`(세션, `/clear`·`/resume`·`/branch` 에서 초기화) · `$.store`(세션 간, 기기 공유) |

실행 확인: 시험용 mod 에 `claude plugin validate` 를 돌리면 다음이 나온다.

```text
./register.js hooks: session.start, tool.call, turn.complete, agent.spawn, ui.render{component=Pane} (default matcher key: plugin)
./register.js gating hook without .catch: tool.call
./register.js gating hook without .catch: agent.spawn
./register.js calls: $.ui.invalidate, $.ui.open, $.ui.resolve
```

**"막을 수 있는 훅"과 "관찰만 하는 훅"을 엔진이 구분해서 안다**는 점이 여기서 드러난다.

## 2. 엔진 코드에서 확인한 것

### 2.1 이벤트 전체 목록

엔진의 이벤트 배열(문서 표와 일치하되 `prompt.change` 가 더 있다).

| 묶음 | 이벤트 |
|---|---|
| 도구 | `tool.call` `tool.check` `tool.describe` |
| 프롬프트 | `prompt.submit` `prompt.fill` `prompt.suggest` `prompt.edit` `prompt.change` `prompt.autocomplete` `prompt.section` `prompt.context` `prompt.attachment` `prompt.mention` `prompt.compose` `skill.prompt` `attribution.text` |
| 명령·설정 | `command.run` `command.describe` `config.set` `config.describe` |
| 턴 | `turn.start` `turn.step` `turn.complete` |
| 세션 | `session.start` `session.end` `session.compact` `session.receive` `session.send` `session.append` `session.attach` `session.detach` `session.measure` |
| 에이전트 | `agent.offer` `agent.spawn` |
| 인터페이스 | `ui.render` `ui.resolve` `ui.press` `ui.input` `ui.select` `ui.message` `ui.fault` `ui.scroll` `ui.focus` |
| 그 밖 | `plugin.register` `engine.create` `telemetry.log` `telemetry.mark` · 모든 `$` 메서드 · `classic.<설정 훅 이벤트>` |

스트리밍 이벤트(async generator 로 써야 하는 것)는 `turn.step` 과 `process.spawn` 둘이다.

### 2.2 거부 형태 표 — 게이트와 관찰의 구분

엔진은 이벤트마다 "거부할 때의 결과 형태"를 표로 갖는다. 값이 있으면 게이트, 없으면 관찰 전용이다.

| 거부 형태 | 이벤트 |
|---|---|
| `{ deny }` | `tool.call` `agent.spawn` `prompt.mention` `config.set` `session.append` `telemetry.*` `ui.scroll` `ui.focus` |
| `{ decision: 'deny', reason }` | `tool.check` |
| `{ drop }` | `prompt.submit` |
| `{ skip }` | `session.compact` |
| `{ consumed }` | `session.receive` |
| `{ isDelivered: false, reason }` | `session.send` |
| `{ refuse }` | `plugin.register` |
| `{ isOffered: false }` | `agent.offer` |
| 없음(관찰·재작성만) | `session.start/end/attach/detach/measure` `turn.start/step/complete` `ui.render/resolve/press/input/select/message/fault` 등 |

### 2.3 체인 실행

- 핸들러 배열을 `reduceRight` 로 접어 체인을 만든다. 각 단계에 `budgetMs` · `origin` · 아래 단계 · "아래에 아무도 없음" 표시가 붙는다.
- 이벤트마다 `AbortController` 를 만들어 `next.signal` 로 내려 준다.
- 체인 실패는 로그 한 줄로 남기고 던진다.

### 2.4 `$.state` 의 동시성

- 값마다 버전이 있고 `set(ref, value, { ifVersion })` 로 쓴다(낙관적 동시성).
- `update` 헬퍼는 읽기 → 계산 → 조건부 쓰기를 최대 64회 재시도하고, 계속 지면 던진다.
- `derive` 는 원천 값들의 버전 묶음이 바뀔 때만 다시 계산한다.
- `ui.render` 훅이 읽은 값은 구독으로 기록되어, 쓰기가 그 값을 읽은 인스턴스만 낡게 만든다(§3.2 의 `instances`).

## 3. 호스트로 UI 를 보내는 내부 프로토콜

### 3.1 공개 SDK 에는 없다

`sdk.d.ts` 와 `sdk.mjs` 에 `ui_attach` · `ui_render` · `ui_invalidate` 는 0건이다. 공개 SDK 가 호스트에 주는 것은 `options.hooks` 콜백, `SDKMessage` 스트림, `canUseTool`, `onUserDialog`(`supportedDialogKinds` 로 선언한 종류만)이다. 문서의 "Agent SDK 에서는 훅은 돌지만 그림은 안 그려진다"와 맞는다.

### 3.2 CLI 안에는 `@internal` 로 있다

동봉 CLI 는 원격 surface(`desktop` · `mobile` · `vscode`)를 위한 제어 프로토콜을 갖는다. 설명문이 전부 `@internal` 이고 surface 값이 셋으로 닫혀 있어 **Orcinus orca 가 탈 수 있는 통로는 아니다.** 다만 "세션 엔진 → 별도 프로세스의 패널"을 푸는 설계로서는 가장 직접적인 레퍼런스다.

| 방향 | 메시지 | 의미 |
|---|---|---|
| surface → 엔진 | `ui_attach` | surface 가 세션에 붙는다. `surface` · `client_id` · `viewport` · `answers`(이 클라이언트가 대신 답할 요청) · `draws`(추가로 그릴 수 있는 요소). 엔진은 `session.attach` 를 발화한다. 멱등 |
| surface → 엔진 | `ui_detach` | 떠난다. `session.detach` 발화 |
| surface → 엔진 | `ui_render` | **인스턴스 하나를 그려 달라고 묻는다.** `component` · `instance_id` · `props` · `viewport` · `on_screen` · `content_rows` · `keyed` |
| 엔진 → surface | `ui_render` 응답 | `tree` · `props` · `rewritten` · `hooked` · `drawn_by` · `client_modules` |
| 엔진 → surface | `ui_invalidate` | 그린 트리가 낡았다. `instances` 가 있으면 그것만, 없으면 전부 다시 묻는다. 플러그인당 100ms 에 한 번으로 접힌다 |
| 엔진 → surface | `ui_panes` | pane 목록(roster)이 바뀌었다. 중복 제거. 마운트 때는 요청으로 읽는다 |
| 엔진 → surface | `ui_placed` | transcript 에 놓인 행. 붙는 클라이언트에게도 보낸다 |
| 엔진 → surface | `ui_log` `ui_toast` `ui_status` `ui_notify` `ui_notify_cancel` | 보내고 잊는 표시 |
| 엔진 → surface | `ui_scroll` `ui_focus` | 플러그인이 옮긴 스크롤·포커스. 사람이 옮긴 것은 되돌려 보내지 않는다 |
| surface → 엔진 | `ui_press` `ui_input` `ui_select` | 사용자 조작. `plugin` + `handle`(엔진이 쥔 콜백 번호) + `key` |

기능 협상은 `system/init` 의 capability 로 한다(`ui_surface_v1` · `ui_hooked_v1` · `ui_pane_widget_v1` 등).

### 3.3 이 프로토콜의 설계 규칙

| 규칙 | 근거가 된 설명 |
|---|---|
| **push 는 "낡았다"만 알리고 내용은 surface 가 다시 묻는다** | `ui_invalidate` — "The surface re-asks each mounted instance; the engine dedups the evaluations" |
| **무효화 범위를 좁힐 수 있지만 무시해도 옳다** | "A surface that ignores the field re-asks everything and stays correct" |
| **붙는 순간 현재 상태를 받을 길이 따로 있다** | `ui_panes` — "A pane opened before the stream armed produces none; read the roster with ui_panes on mount" |
| **surface 가 능력을 선언하고 엔진이 그에 맞춰 낮춘다** | `draws` 에 없는 요소는 빈 `Box` 나 `Box`+`Text` 로 바꿔 보낸다 |
| **모르는 것은 버린다(전방 호환)** | "A surface that does not know the subtype drops it" · 모르는 `draws` 이름은 무시 |
| **인스턴스 식별자는 이미 있는 id 를 쓴다** | `instance_id` — 도구 행은 `tool_use_id`, 메시지는 message id, 명령 출력은 uuid |
| **누가 그렸는지는 엔진이 말하고 훅이 못 바꾼다** | `drawn_by` — "The engine's word, which no hook can set" |
| **훅이 없으면 묻지 말라고 알려 준다** | `hooked: false` — 다음 `ui_invalidate` 까지 묻지 않아도 된다 |
| **콜백은 엔진에 남고 선은 번호만 넘는다** | `ui_press` 의 `handle` + `key` 대조. 키가 다르면 `{ handled: false }` |
| **사람의 조작을 사람에게 되돌려 보내지 않는다** | `ui_scroll` / `ui_focus` push 설명 |
| **보이는 범위를 엔진에 알려 준다** | `on_screen` — 뷰포트 밖이면 `null`, 한 surface 의 보고를 다른 surface 로 옮기지 않는다 |

## 4. 공개 SDK 의 훅 표면

`query().options.hooks` 는 `Partial<Record<HookEvent, HookCallbackMatcher[]>>` 이다.

| 타입 | 내용 |
|---|---|
| `HookCallbackMatcher` | `matcher?` · `hooks` · `timeout?` · **`onFailure?: 'continue' \| 'block'`** |
| `HookCallback` | `(input, toolUseID, { signal }) => Promise<HookJSONOutput>` |
| `BaseHookInput` | `session_id` · `transcript_path` · `cwd` · `prompt_id?` · `permission_mode?` · **`agent_id?` · `agent_type?`** · `effort?` |
| `SyncHookJSONOutput` | `continue?` · `decision?` · `reason?` · `stopReason?` · `systemMessage?` · `suppressOutput?` · `hookSpecificOutput?` |
| `AsyncHookJSONOutput` | `{ async: true, asyncTimeout? }` — 결과를 기다리지 않게 한다 |
| `HookPermissionDecision` | `allow` · `deny` · `ask` · `defer` |

`HOOK_EVENTS`(0.3.325)는 다음과 같다.

| 묶음 | 이벤트 |
|---|---|
| 도구 | `PreToolUse` `PostToolUse` `PostToolUseFailure` `PostToolBatch` |
| 권한 | `PermissionRequest` `PermissionDenied` |
| 프롬프트·표시 | `UserPromptSubmit` `UserPromptExpansion` `MessageDisplay` |
| 세션·턴 | `SessionStart` `SessionEnd` `Stop` `StopFailure` `Setup` |
| 에이전트·작업 | `SubagentStart` `SubagentStop` `TeammateIdle` `TaskCreated` `TaskCompleted` |
| 컨텍스트·모델 | `PreCompact` `PostCompact` `PreModelSwitch` `PostModelSwitch` |
| 작업공간 | `CwdChanged` `FileChanged` `DirectoryAdded` `WorktreeCreate` `WorktreeRemove` `InstructionsLoaded` `ConfigChange` |
| 그 밖 | `Notification` `Elicitation` `ElicitationResult` |

패널 상태에 쓸 만한 입력 필드.

| 이벤트 | 필드 |
|---|---|
| `SessionStart` | `source: startup\|resume\|clear\|compact\|fork` · `model` · `context_tokens` |
| `PostToolUse` / `PostToolUseFailure` | `tool_use_id` · `duration_ms` · (`error` · `is_interrupt`) |
| `PostToolBatch` | 한 배치의 `tool_calls[]` |
| `SubagentStart` / `SubagentStop` | `agent_id` · `agent_type` · (`last_assistant_message` · `background_tasks[]`) |
| `Stop` | `last_assistant_message` · `background_tasks[]` · `session_crons[]` |
| `TaskCreated` / `TaskCompleted` | `task_id` · `task_subject` · `task_description` |
| `FileChanged` | `file_path` · `event: change\|add\|unlink` |
| `MessageDisplay` | `turn_id` · `message_id` · `index` · `final` |

훅과 별개로 메시지 스트림이 상태를 준다: `session_state_changed`(`idle\|running\|requires_action`) · `background_tasks_changed`(**교체 의미** — "swap your set for this payload") · `task_started/updated/progress/notification`(`task_updated` 는 patch, `run_id` 로 실행 세대 구분) · `tool_progress` · `notification` · `hook_started/progress/response` · `commands_changed`.

## 5. Orcinus orca 현재 훅 구조의 한계

현재 구조: `adapters/common/hooks.ts` 의 `NormalizedHookSet` → `adapters/claude/adapt.ts` 의 `adaptHooks()` → SDK `options.hooks`. 그 옆에 어댑터 내부 훅(`makeTurnEndHook` · `makeInputReceiptHook` · `makePlanFileHook` · `makeOutputFilesHook` · `makeWorkspaceGuardHook` · `withPostCompactHook`)이 `mergeHooks` 로 합쳐진다.

| # | 한계 | 근거 | 레퍼런스가 하는 방식 |
|---|---|---|---|
| L1 | **정규 훅 집합이 실제로는 비어 있고, 일하는 훅은 전부 정규 계약 밖에 있다.** 새 기능마다 `make…Hook` 을 하나씩 더하는 구조다 | `features/extensions/common/builder.ts` 가 `hooks: { normalized: {} }` 를 공급. 내부 훅은 SDK `HookCallback` 을 직접 구현 | 내장 기능도 같은 `on()` 으로 등록한다(`/diff`, AGENTS.md 로더가 mod) |
| L2 | **Claude 전용이다.** OpenCode 세션에는 대응 경로가 없다 | `adapters.md` §3.2.5 의 채택 결정. `adapters/opencode` 에 훅 어댑트 없음 | 해당 없음(단일 엔진) |
| L3 | **이벤트 어휘가 좁다.** 턴 시작·모델 요청 단위, 도구 실패·배치, 서브에이전트 시작, compact 후, 권한 요청·거부, 작업 생성·완료, cwd·파일 변경이 없다 | `NormalizedHookEvent` ↔ §4 의 `HOOK_EVENTS` 대조 | §2.1 |
| L4 | **컨텍스트에 상관관계 키가 없다.** `agentId` · `toolRunId` · `turnId` · 권한 모드가 정규 필드가 아니라 `raw` 에만 있다 → 메인과 서브에이전트를 구분하려면 핸들러가 SDK payload 를 직접 읽어야 한다 | `NormalizedHookContext` 필드. `makeClaudeHookCallback` 이 SDK 가 넘긴 `toolUseID` 인자를 쓰지 않는다(`_toolUseID`) | 모든 이벤트에 `e.agentId` · `e.turnId` · `next.origin` |
| L5 | **매처가 없다.** 정규 훅은 이벤트당 매처 없는 콜백 하나로 묶여 모든 도구 호출에 전 핸들러가 돈다. 내부 훅만 `matcher: 'Write\|Edit'` 를 쓴다 | `adaptHooks()` 가 `{ hooks: [callback] }` 만 만든다 | `on(event, { tool: … }, handler)` |
| L6 | **실패·시간 정책이 없다.** 핸들러가 던지면 그대로 SDK 로 올라가고, 핸들러별 시간 한도가 없다. SDK 가 주는 `timeout` · `onFailure` 를 넘기지 않는다 | `makeClaudeHookCallback` 은 `await handler(ctx)` 를 try 없이 순차 실행 | 훅별 예산, fail-open 기본, `.catch` 로 fail-closed, 게이트 여부 정적 판정 |
| L7 | **미들웨어가 아니라 "전부 실행 후 병합"이다.** 앞 핸들러가 뒤 핸들러를 건너뛰게 하거나 결과를 받아 고칠 수 없다. `updatedToolInput` 은 마지막 것이 이긴다 | `resolveHookDecisions` — `deny > ask > allow`, last-writer-wins | `next(e)` 체인: 앞이 뒤를 감싸고 결과를 본다 |
| L8 | **관찰 훅이 턴을 막는다.** 모든 콜백을 SDK 가 await 한다. 그래서 턴 종료 훅은 "신호만 적재하고 즉시 반환"하는 관례에 의존한다 | `makeTurnEndHook` 주석. `AsyncHookJSONOutput` 미사용 | 거부 형태가 없는 이벤트는 관찰 전용으로 구분된다 |
| L9 | **훅이 한 일이 사용자에게 보이지 않는다.** SDK 가 내는 `hook_started` · `hook_progress` · `hook_response` 를 정규 이벤트로 올리지 않는다 | `adapters/claude/map.ts` 가 처리하는 system subtype 에 없음 | `drawn_by`, `hook skipped` 한 줄, `/plugin` 의 mods 목록 |
| L10 | **훅에서 패널로 가는 길이 없다.** 훅이 얻은 사실을 우측 패널에 올리려면 그 기능 전용 콜백 → 전용 `NormalizedEvent` → reducer → 타일을 매번 새로 뚫어야 한다 | `makeOutputFilesHook` → `output.captured` 가 그 예 | 훅이 상태에 쓰면 그 상태를 읽은 그림만 낡는다(§2.4, §3.2) |
| L11 | **패널 상태의 수명 규칙이 훅 쪽에 없다.** 재개·fork·compact 뒤 무엇을 다시 채울지가 타일마다 따로 정해져 있다 | `state.md` — "재로드된 live 목록은 현재 실행 근거가 아니다" 가 background 에만 적혀 있다 | `SessionStart.source`, `$.state` 초기화 규칙, `ui_panes` 를 마운트 때 읽기 |
| L12 | **열린 집합을 선언할 방법이 없다.** 타일 id 가 닫힌 목록이라 하네스나 확장이 새 패널 조각을 기여할 수 없다 | `rightPanelTileDefinitions` | pane 은 `id` 로 열고, surface 가 `draws` 로 능력을 선언 |
| L13 | 주석 수치가 낡았다 — `hooks.ts` 머리말의 claude `HookEvent` 개수가 조사 버전의 `HOOK_EVENTS` 와 다르다 | §4 | — |

L2 는 한계이면서 **채택된 결정**이다. 바꾸려면 §7-1 의 확인이 먼저다.

## 6. 범용 세션이 제공해야 할 것 — 제안

### 6.1 게이트 훅과 관찰 이벤트를 가른다

mod 는 둘을 한 체인에 두지만 엔진 안에서는 §2.2 처럼 구분한다. Orcinus orca 는 계약 단계에서 가르는 편이 맞다.

| 종류 | 성격 | 실행 위치 | 하네스 간 범용화 |
|---|---|---|---|
| 게이트 훅 | 응답·재작성 가능, 블로킹, 실패 정책 필요 | 하네스가 도는 자리(Claude 는 in-process, OpenCode 는 플러그인 모듈) | 어렵다 — `adapters.md` §3.2.4 의 지연·표현력 한계 |
| 관찰 이벤트 | 사실 통지, 논블로킹 | main 의 정규 이벤트 스트림 | 가능 — 이미 `NormalizedEvent` 가 이 역할 |

우측 패널은 관찰 이벤트만으로 구동한다. 그래야 하네스 차이가 패널로 새지 않는다.

### 6.2 범용으로 둘 훅

| 묶음 | 훅 | 종류 | mod | SDK | 현재 |
|---|---|---|---|---|---|
| 세션 | 시작(`source`) · 종료(`reason`) | 관찰 | `session.start/end` | `SessionStart/End` | 정규 훅 있음 |
| 세션 | 상태(`idle/running/requires_action`) | 관찰 | — | `session_state_changed` | 없음 |
| 세션 | 표시 화면 접속·이탈 | 관찰 | `session.attach/detach` | — | 없음 |
| 턴 | 시작 · 완료(`isAborted` · 소요 · 사용량) | 관찰 | `turn.start/complete` | `Stop` · `StopFailure` | `turn.ended/aborted` |
| 턴 | 모델 요청 1회(모델 · 사용량) | 관찰 | `turn.step` | — | `telemetry` |
| 프롬프트 | 제출 | 게이트 | `prompt.submit` | `UserPromptSubmit` | 정규 훅 있음 |
| 도구 | 실행 전 · 권한 판정 | 게이트 | `tool.call` · `tool.check` | `PreToolUse` · `PermissionRequest` | 정규 훅 · `permission.*` |
| 도구 | 실행 후 · 실패 · 배치 · 진행 | 관찰 | `tool.call` 의 `await next` 뒤 | `PostToolUse` · `…Failure` · `PostToolBatch` · `tool_progress` | 일부 |
| 에이전트 | 시작(재개 표시) · 종료 | 시작만 게이트 | `agent.spawn` | `SubagentStart/Stop` | 종료만 |
| 작업 | 생성 · 갱신 · 완료 | 관찰 | `$.agent.list()` | `TaskCreated/Completed` · `task_*` | background reducer |
| 컨텍스트 | compact 전 · 후, 사용량 측정 | 전만 게이트 | `session.compact` · `session.measure` | `PreCompact` · `PostCompact` | 전 · `session.compacted` |
| 작업공간 | cwd · 파일 · worktree 변경 | 관찰 | — | `CwdChanged` · `FileChanged` · `Worktree*` | `worktree.preparing` |
| 알림 | 알림(키 · 우선순위) | 관찰 | `$.ui.notify` | `Notification` · `notification` | 정규 훅 있음 |

### 6.3 모든 이벤트에 공통으로 실을 정보

| 정보 | 내용 | 없으면 생기는 일 |
|---|---|---|
| 식별 | `sessionId` · 하네스 · 에이전트 종류 · cwd | 타일 정책을 고를 수 없다 |
| 상관관계 | `turnId` · `toolRunId` · `agentId` 와 부모 `toolRunId` · `taskId` 와 실행 세대 | 메인과 서브에이전트, 재개 전후를 못 가른다(L4) |
| 순서 | 세션 내 단조 증가 번호 · 시각 | 합쳐지거나 늦게 온 갱신에서 최신을 못 가린다 |
| 출처 | 하네스 · Orcinus orca · 확장 중 누가 냈는가 | 패널에 "누가 바꿨나"를 표시할 수 없다(L9) |
| 실시간 여부 | 실시간인가 재로드로 다시 흘러온 것인가 | 끝난 작업이 실행 중으로 보인다(L11) |
| 게이트 전용 | 중단 신호 · 남은 시간 · 실패 시 열림/닫힘 | L6 |
| 원본 | `raw` 패스스루 | 정규화가 놓친 필드를 못 읽는다 |

### 6.4 우측 패널은 이벤트가 아니라 상태 조각으로 갱신한다

§3.3 의 규칙을 옮긴 형태다.

| 요소 | 내용 | 대응 규칙 |
|---|---|---|
| 패널 조각 | `{ sessionId, 타일, rev, 상태, 배지, 데이터 }`. **교체 의미** — 중간 값이 빠져도 안전 | `background_tasks_changed` · `ui_invalidate` 접힘 |
| 접속 시 스냅샷 | 세션을 열면 현재 조각 전체를 먼저 받고 이후 변경만 받는다 | `ui_panes` 를 마운트 때 읽기 |
| 범위 있는 무효화 | 바뀐 조각만 알리되, 전체 갱신으로 처리해도 옳아야 한다 | `instances` |
| 열기 요청의 출처 | `user` / `auto`. 사용자가 닫은 패널을 자동으로 다시 열지 않는다 | 자동으로 연 pane 은 넓은 화면에서만 뜬다 · `agentPanelInitialized` |
| 능력 선언 | 하네스·에이전트 종류별 지원 타일을 패널이 선언하고 main 이 그에 맞춘다 | `draws` · `rightPanelPolicy` |
| 식별자 재사용 | 조각의 키는 이미 있는 id(`toolRunId` · `agentId` · `taskId`) | `instance_id` |
| 기여자 표시 | 누가 이 조각을 썼는지는 main 이 붙이고 기여자가 못 바꾼다 | `drawn_by` |

타일별 최소 데이터.

| 타일 | 데이터 | 갱신 계기 |
|---|---|---|
| 계획 | 본문 · 상태(제안/승인/수정 요청) · 출처 도구 | 계획 도구 실행 후 · 권한 응답 |
| 작업 | 항목 id · 제목 · 상태 · 진행 문구 | 작업 생성·갱신·완료 |
| 하위 에이전트 | `agentId` · 유형 · 설명 · 부모 · 사용량 · 상태(`pending/running/waiting/idle/completed/failed/killed`) | 에이전트 시작·종료 · 진행 |
| 프로세스 | 명령 · 상태 · 로그 끝부분 · 종료 코드 | 도구 진행 · 실행 후 |
| 변경사항 | 바뀐 경로 집합 | 파일 편집류 도구 실행 후 · 파일 변경 |
| 소스 | 폴더 · 첨부 · 참조 | 프롬프트 제출 · 디렉터리 추가 |

## 7. 결정이 필요한 것

| # | 질문 | 갈리는 지점 |
|---|---|---|
| 1 | 교차 하네스 훅 정규화를 다시 여는가 | `adapters.md` §3.2.5 는 정규 훅을 Claude 전용 in-process 콜백으로 한정했다. 관찰 이벤트만 범용화하면 이 결정과 충돌하지 않고, 게이트 훅까지 범용화하면 결정을 바꾸는 것이다 |
| 2 | 훅을 누가 등록하는가 | Orcinus orca 내부 기능만이면 신뢰 모델이 필요 없다. 사용자·플러그인 작성 훅이면 임의 코드 실행이라 `adapters.md` §3.2.6 의 출처 신뢰·비밀 취급을 먼저 정해야 한다 |
| 3 | 우측 패널을 확장 가능하게 하는가 | 고정 타일을 범용 상태로 구동할지, 제3자가 선언적 트리로 타일을 더하게 할지. 후자는 요소 어휘·검증기·능력 협상까지 필요하다 |
| 4 | 내부 훅을 정규 계약으로 옮기는가 | L1 을 닫으려면 `make…Hook` 들을 같은 등록 형태로 옮겨야 한다. 동작은 같고 구조만 바뀌는 리팩토링이다 |
| 5 | SDK 를 0.3.325 로 올리는가 | 이 조사는 올리지 않았다. §4 의 이벤트 중 고정 버전에 없는 것이 있다면 그 훅은 올린 뒤에만 쓸 수 있다 — 고정 버전의 `HOOK_EVENTS` 는 이번에 대조하지 않았다 |

## 8. 이 조사가 확인하지 않은 것

- 고정 버전(`app/package.json`)의 `HOOK_EVENTS` · `SDKMessage` 와 조사 버전의 차이.
- 조사 버전에서의 실제 턴 실행(인증이 필요한 경로) — mod 로드와 훅 발화는 정적 검증까지만 했다.
- §3.2 프로토콜의 실제 선 위 동작 — 스키마 설명문을 읽은 것이며 메시지를 주고받아 보지 않았다.
- OpenCode 쪽에서 §6.2 의 관찰 이벤트를 전부 낼 수 있는지.
