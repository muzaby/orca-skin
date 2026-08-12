<!-- 생성물 — 직접 편집 금지. `cd app && node scripts/check-doc-inventory.mjs` 로 재생성한다. -->

# 코드 인벤토리 (생성물)

> 이 문서는 **코드를 세어 만든 것**이다. 사람이 고치면 CI 가 실패한다
> (`check-doc-inventory.mjs --check` 가 재생성 결과와 대조한다).
>
> **다른 문서는 이 수치를 옮겨 적지 않는다.** 수치가 필요하면 이 표를 링크한다 — 사본을 만들면
> 반드시 갈라진다(0177 이 전수 동기화한 채널 수가 6일 만에 재드리프트한 것이 그 증거다).

| 항목 | 수 | 정본 |
|---|---|---|
| IPC 채널 | **75** | `app/src/shared/ipc.ts` |
| IPC 도메인 | **22** | `app/src/shared/ipc.ts` |
| NormalizedEvent variant | **21** | `app/src/shared/ipc.ts` |
| settings 키 | **18** | `app/src/shared/protocol.ts` |
| main 수직 슬라이스 | **9** | `app/src/main/features/` |
| main contracts 모듈 | **5** | `app/src/main/contracts/` |
| IPC 핸들러 | **13** | `app/src/main/app/handlers/` |
| DB 마이그레이션 | **16** | `app/src/main/infra/db/migrations/` |
| renderer feature | **13** | `app/src/renderer/src/features/` |

## 내역

### IPC 채널 (75)

`orca:agent:list` · `orca:backend:list` · `orca:boot:report` · `orca:boot:whenReady` · `orca:chat:cancel` · `orca:chat:discardSession` · `orca:chat:event` · `orca:chat:send` · `orca:chat:steerCancel` · `orca:chat:stopSubagent` · `orca:concurrency:event` · `orca:cost:setProviderLimit` · `orca:cost:usage` · `orca:cost:usageEvent` · `orca:cost:usageStats` · `orca:debug:getMock` · `orca:debug:setMock` · `orca:engine:add` · `orca:engine:delete` · `orca:engine:importUserSettings` · `orca:engine:read` · `orca:engine:update` · `orca:files:list` · `orca:files:openPath` · `orca:files:pickAttachments` · `orca:files:pickDirectory` · `orca:files:readAttachment` · `orca:install:start` · `orca:install:status` · `orca:log:emit` · `orca:mcp:add` · `orca:mcp:delete` · `orca:mcp:list` · `orca:mcp:update` · `orca:notify:show` · `orca:permission:respond` · `orca:permission:setMode` · `orca:project:create` · `orca:project:delete` · `orca:project:list` · `orca:project:listSessions` · `orca:project:setPinned` · `orca:project:update` · `orca:provider:continue` · `orca:provider:list` · `orca:provider:login` · `orca:provider:reauth` · `orca:provider:revoke` · `orca:provider:state` · `orca:search:messages` · `orca:session:cwd` · `orca:session:delete` · `orca:session:list` · `orca:session:load` · `orca:session:rename` · `orca:session:setPinned` · `orca:session:titleEvent` · `orca:settings:get` · `orca:settings:set` · `orca:skills:author` · `orca:skills:list` · `orca:skills:open` · `orca:skills:remove` · `orca:skills:setEnabled` · `orca:skills:showInFolder` · `orca:skills:upload` · `orca:update:check` · `orca:update:download` · `orca:update:progressEvent` · `orca:update:quitAndInstall` · `orca:update:state` · `orca:update:stateEvent` · `orca:window:close` · `orca:window:maximize` · `orca:window:minimize`

### IPC 도메인 (22)

`session 7` · `skills 7` · `chat 6` · `project 6` · `provider 6` · `update 6` · `engine 5` · `files 5` · `cost 4` · `mcp 4` · `window 3` · `boot 2` · `debug 2` · `install 2` · `permission 2` · `settings 2` · `agent 1` · `backend 1` · `concurrency 1` · `log 1` · `notify 1` · `search 1`

### NormalizedEvent variant (21)

`ChatActivitySnapshot` · `error` · `input.echo` · `message.cancelled` · `message.committed` · `message.completed` · `message.delta` · `message.queued` · `message.reasoning` · `message.reasoning.delta` · `message.submitted` · `permission.requested` · `permission.resolved` · `session.compacted` · `session.updated` · `subagent.task` · `telemetry` · `tool.call.completed` · `tool.call.started` · `turn.aborted` · `turn.retrying`

### settings 키 (18)

`accountInstructions` · `appFont` · `authBypass` · `density` · `language` · `lastBackend` · `lastSessionId` · `mcpEnabled` · `mcpMeta` · `notifyOnComplete` · `scheduler` · `sidebarCollapsed` · `sidebarWidth` · `skillEnabled` · `spendingLimitUsd` · `theme` · `uiLocale` · `windowBounds`

### main 수직 슬라이스 (9)

`approvals` · `chat` · `extensions` · `history` · `orchestration` · `providers` · `scheduler` · `sessions` · `usage`

### main contracts 모듈 (5)

`bus-events` · `ports` · `provider` · `session-state` · `turn`

### IPC 핸들러 (13)

`boot` · `cost` · `engine` · `files` · `log` · `mcp` · `misc` · `project` · `providers` · `session` · `settings` · `skills` · `update`

### DB 마이그레이션 (16)

`0001_initial` · `0002_projects` · `0003_messages_fts` · `0004_message_parts` · `0005_usage_events` · `0006_turn_usage` · `0007_title_source` · `0008_provider_key` · `0009_message_complete` · `0010_session_cwd` · `0011_session_lineage` · `0012_provider_limits` · `0013_schedules` · `0014_provider_usage_report_cache` · `0015_pinned` · `0016_turn_model_context_window`

### renderer feature (13)

`backend` · `camera` · `captures` · `chat` · `cost` · `debug` · `engine` · `projects` · `providers` · `sessions` · `settings` · `skills` · `update`

