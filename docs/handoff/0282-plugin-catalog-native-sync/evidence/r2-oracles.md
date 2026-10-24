# 0282 r2 직접 oracle 좌표

각 별칭은 최종 177파일·1906케이스 실행에서 통과한 실제 파일과 테스트 이름이다. 파일 경로는 `app/` 기준이다. 자리별 사용 구간은 plan의 r2 강제 지점 표에 적었다.

## T-state

`src/renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.test.ts`

- `publishes agents before models and shares subscribers and remounts`
- `coalesces retry, keeps data on error and accepts successful empty data`
- `discards retired and unmounted responses without automatic reconnect`
- `keeps the new generation when an older part resolves in the same epoch`
- `loads resource parts only for a panel subscriber and invalidates their connection on instance loss`
- `does not turn a cancelled outcome into a successful empty catalog`
- `does not turn a error outcome into a successful empty catalog`
- `publishes the first agent success to concurrent scopes and ignores later results`
- `leaves the agent cache empty after failed or cancelled reads`
- `keeps cached agents through instance invalidation while models become error`
- `refreshes subscribed parts once per plugin revision while keeping models`
- `keeps the first cached agents when a concurrent read ends as error`
- `keeps the first cached agents when a concurrent read ends as cancelled`
- `keeps the first cached agents when a concurrent read ends as reject`
- `refetches agents when the cache is cleared between construction and first subscribe`
- `drops agent results requested before a plugin change and caches the refetched list`

## T-module

`src/renderer/src/features/chat/harnesses/opencode/composer/Module.integration.test.ts`

- `prepares draft agents before providers, reuses cached agents and variants across menu reopenings`
- `uses only the agent slot for title loading when agents completes first`
- `uses only the agent slot for title loading when models completes first`
- `reuses the first successful agent list across landing scopes without requesting or spinning`
- `shows cached agents before the chat scope exists`
- `clears cached agents on plugin changes with no Composer mounted and refetches on remount`

## T-store

`src/renderer/src/features/chat/harnesses/opencode/composer/composerAgentStore.test.ts`

- `keeps the first list accepted at the current revision and notifies subscribers once`
- `invalidates only for a newer revision and ignores results captured at an older revision`
- `subscribes to plugin changes once at creation and clears agents without any view`

## T-query

`src/main/adapters/claude/adapter.native-plugins.test.ts`

- `applies current global plugin choices to every new query while live queries keep theirs`
- `loads enabled native skills for session null alongside Orca skills`
- `loads enabled native skills for session resume-native-B alongside Orca skills`
- `carries plugin controls through the actual adapter and preserves provider flags and generation`
- `exposes runtime-native watch files and applies external project choices only after idle reconciliation`
- `persists both plugin states across follow-up turns, new adapters and cold resumes over provider defaults`
- `pins deployed MCP files for same-cwd peers and reloads until the final owner closes`

## T-bootstrap

`src/main/app/bootstrap.native-history.test.ts`

- `carries catalog changes through the real bootstrap registry into every new SDK query`
- `registers the global catalog and ignores legacy persisted defaults`
- `native history bootstrap callbacks preserves background snapshots while disposing the same session runtime and activity`
- `native history bootstrap callbacks forwards context and all native refresh runtime callbacks from the actual bootstrap registration`
- `wires native resource lookups to the current supervisor runtime`
- `reads native configuration through the registered module using stored backend and cwd`
- `refreshes the bootstrap skill cache with native catalog sources and preserves Orca enablement`
- `groups runtimes by actual cwd and backend across project IDs and broadcasts actual snapshots`
- `keeps different current working directories distinct even under one Git root`
- `observes external project settings through real bootstrap and waits for peer activity before reconciliation`
- `applies nav plugin choices to draft and stored-session commands and resources`
- `broadcasts each OpenCode plugin revision after retiring servers without an owner`
- `restores global choices through production Bootstrap into catalogs, new Claude queries and OpenCode directories`

## T-priority

`src/main/adapters/claude/configured-resources.test.ts`

- `configured Claude resources reads global defaults without project plugin installs or project MCP switches`
- `configured Claude resources resolves the actual MCP declaration file across user, project, local and plugin precedence`
- `configured Claude resources reads scoped MCP metadata and disabled flags without exposing private configuration`
- `configured Claude resources applies plugin scope and setting precedence, and shares identity with actual init observations`
- `configured Claude resources reads bundled, inline and referenced plugin MCP metadata but blocks escaped paths`
- `configured Claude resources distinguishes absent metadata from malformed data with a redacted error`
- `lists every applicable install independently of flags, uses path boundaries and refreshes removal`
- `applies Orca plugin choices above user defaults and below project selections`
- `omits installations whose directory no longer exists`

`src/main/adapters/claude/plugin-catalog.test.ts`

- `native plugin catalog selects active installations by scope and precedence and refreshes every read`
- `native plugin catalog discovers declared skill paths and legacy commands with descriptions, hints and invocation policy`
- `native plugin catalog reports invalid configuration without its contents and leaves absent installations empty`
- `excludes local installs from child cwd and selects the nearest project without relying on git root`

## T-choiceMap

`src/main/adapters/common/extension-control.test.ts`

- `maps only one kind of choice to harness keys`

## T-view

`src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.interaction.test.ts`

- `moves native plugins to the plugin tab after provider groups`
- `hides native plugin skills from the skills tab`
- `scopes native loading and failure to plugin and MCP tabs`
- `shows OpenCode plugin rows as fixed native state and sends no toggle`
- `shows the empty skills state when native resources are present`
- `shows the empty skills state when native resources are loading`
- `shows the empty skills state when native resources are failed`

## T-list

`src/renderer/src/features/skills/components/customize/CustomizeList.render.test.ts`

- `plugin catalog list renders switches only for Orca skills`
- `plugin catalog list hides native plugin skills and labels both native MCP groups with brand marks`
- `plugin catalog list skills uses flat catalog buttons with selection and preserves its previous order`
- `plugin catalog list mcp uses flat catalog buttons with selection and preserves its previous order`
- `plugin catalog list providers uses flat catalog buttons with selection and preserves its previous order`
- `plugin catalog list groups skills and MCP by canonical source while retaining management metadata`
- `plugin catalog list plugin catalog title을 locale에 맞게 목록에 표시한다`
- `plugin catalog list 로그인 프리 행은 detail에 기본 제공만, trailing에 연결됨을 표시한다 (0249 AC1)`
- `plugin catalog list skills exposes an empty state without a table`
- `plugin catalog list mcp exposes an empty state without a table`
- `plugin catalog list providers exposes an empty state without a table`
- `orders Claude then OpenCode plugin groups after providers and keeps plugin toggle capability`

## T-detail

`src/renderer/src/features/skills/components/customize/SkillDetail.render.test.ts`

- `renders no switch for default-path skills`

## T-skill

`src/main/app/skill-catalog.test.ts`

- `assembles the real catalog from lock, harness and native plugin files without exposing other installations`

`src/main/features/extensions/common/skills/scan.test.ts`

- `scanSkills 여러 source root 를 소스 메타와 enabled 상태로 스캔한다`

## T-skillHandler

`src/main/app/handlers/skills.test.ts`

- `catalog skill target IPC orca:skills:open opens the exact disabled native skill without treating its name as a directory slug`
- `catalog skill target IPC orca:skills:showInFolder opens the exact disabled native skill without treating its name as a directory slug`
- `catalog skill target IPC uses the exact catalog name, including long Unicode frontmatter names`
- `catalog skill target IPC orca:skills:open rejects unknown source/name combinations before side effects`
- `catalog skill target IPC orca:skills:showInFolder rejects unknown source/name combinations before side effects`
- `catalog skill target IPC orca:skills:setEnabled rejects unknown source/name combinations before side effects`
- `catalog skill target IPC orca:skills:remove rejects unknown source/name combinations before side effects`
- `catalog skill target IPC keeps native toggles read-only after accepting namespaced targets`
- `catalog skill target IPC keeps native removal forbidden after accepting namespaced targets`
- `catalog skill target IPC still updates Orca skill toggles without changing other settings`
- `catalog skill target IPC still removes only the selected Orca directory and its setting`

## T-attach

`src/renderer/src/features/chat/lib/attachMenuModel.test.ts`

- `buildAttachMenu limits claude to approved skill sources and merges duplicate source headings`
- `buildAttachMenu limits opencode to approved skill sources and merges duplicate source headings`
- `buildAttachMenu offers only observed connected MCP names with no descriptions, statuses or notices`
- `buildAttachMenu exposes native commands for OpenCode without exposing Orca integrations or inventing slash names`
- `buildAttachMenu excludes unsupported plugins and other harness skills for OpenCode`
- `buildAttachMenu 최상위 = 파일 추가 · 구분선 · 스킬 ▸ · 플러그인 ▸ (AC1)`
- `buildAttachMenu lists source headings and every skill in one panel`
- `buildAttachMenu 플러그인 ▸ 목록 · 구분선 · 플러그인 관리 (AC3)`
- `buildAttachMenu 빈 상태 행 (AC4)`
- `buildAttachMenu hover 설명: 스킬 = 설명⏎출처, 설명 없으면 출처 · 플러그인 = 라벨 (AC5)`
- `attachMenuToken (AC2·AC3) keeps the exact native plugin id as one token: plugin:docs`
- `attachMenuToken (AC2·AC3) keeps the exact native plugin id as one token: @org/package`
- `attachMenuToken (AC2·AC3) keeps the exact native plugin id as one token: server with spaces`
- `attachMenuToken (AC2·AC3) keeps the exact native plugin id as one token: server"quoted`
- `attachMenuToken (AC2·AC3) 스킬 = /이름, 플러그인 = @id, 그 밖 = 토큰 없음`
- `shares native menu membership with decoration without exposing disabled or other-origin entries`
- `keeps previously disabled harness skills selectable`

## T-composerSkills

`src/renderer/src/features/chat/lib/composerSkills.test.ts`

- `uses session commands over global plugin flags and preserves allowed file skills`
- `removes disabled session commands and never resurrects catalog-only plugin entries`
- `keeps OpenCode native commands while excluding Orca and Claude file extensions`
- `excludes MCP prompts and commands outside the supported skill catalog`
- `offers active default-path skills regardless of their former stored choice`

## T-json

`src/main/infra/config/json-file.test.ts`

- `creates missing parents, replaces existing files and leaves no temp file`

## T-mcpFresh

`src/main/features/extensions/common/mcp/store.fresh-root.test.ts`

- `adds a server when the sources mcp directory does not exist`

## T-server

`src/main/adapters/opencode/v1/server.test.ts`

- `owned OpenCode server lifecycle releases only the last owner, is idempotent and never retires a replacement generation`
- `owned OpenCode server lifecycle coalesces version checks across install and different server configurations`
- `owned OpenCode server lifecycle invalidates the version cache when the executable bytes change at the same path`
- `owned OpenCode server lifecycle shares a profile across directories while separating native storage environments`
- `owned OpenCode server lifecycle resolves configured and PATH npm executable files without invoking a shell`
- `owned OpenCode server lifecycle separates relative path environments and preserves relative XDG and special native values`
- `owned OpenCode server lifecycle retires only future acquisitions and shuts down every owned generation`
- `owned OpenCode server lifecycle does not discover the scoped CLI package`
- `owned OpenCode server lifecycle ignores the unprefixed startup announcement`
- `owned OpenCode server lifecycle accepts supported 1.x versions (1.18.27)`
- `owned OpenCode server lifecycle accepts supported 1.x versions (1.19.0)`
- `owned OpenCode server lifecycle accepts supported 1.x versions (v1.19.0)`
- `owned OpenCode server lifecycle accepts supported 1.x versions (opencode v1.19.0)`
- `owned OpenCode server lifecycle accepts supported 1.x versions (1.19.0-beta.1)`
- `owned OpenCode server lifecycle accepts supported 1.x versions (1.19.0+local)`
- `owned OpenCode server lifecycle rejects unsupported versions before spawning a server (2.0.28)`
- `owned OpenCode server lifecycle rejects unsupported versions before spawning a server (opencode v2.0.28)`
- `owned OpenCode server lifecycle rejects unsupported versions before spawning a server (2.0.0-beta.1)`
- `owned OpenCode server lifecycle rejects unsupported versions before spawning a server ()`
- `owned OpenCode server lifecycle rejects unsupported versions before spawning a server (1.19.)`
- `owned OpenCode server lifecycle rejects unsupported versions before spawning a server (unknown)`
- `owned OpenCode server lifecycle rejects unsupported versions before spawning a server (11.19.0)`
- `owned OpenCode server lifecycle reports the actual installed version`
- `owned OpenCode server lifecycle retries after replacing an unsupported executable`
- `owned OpenCode server lifecycle does not spawn after shutdown during version probing`
- `owned OpenCode server lifecycle coalesces concurrent startup and passes isolated configuration, auth and preferences to its owned child`
- `owned OpenCode server lifecycle removes failed startup and health entries so an explicit retry launches a fresh child`
- `owned OpenCode server lifecycle explains incompatible server APIs and stops its child instead of accepting an HTML fallback`
- `owned OpenCode server lifecycle rejects startup timeout, spawn error and shutdown while startup is pending`
- `owned OpenCode server lifecycle isolates server configurations and only kills children returned by its spawn factory`
- `starts a new server for new owners after retireAll while existing owners keep theirs`

## T-owners

`src/main/app/handlers/composer-catalog.test.ts`

- `shares pending acquisition for parts, isolates windows, and releases on navigation/crash/shutdown`
- `releases acquisitions completing after close and rejects stale requests without exposing native errors`
- `reports a dead native generation and reacquires only on explicit retry`
- `validates directory and owner before preparation, then retries failed setup`
- `refresh re-resolves and keeps old owner until replacement is ready`
- `returns read-stage HTTP diagnostics without leaking native bodies and preserves the lease for retry`
- `silently cancels an in-flight metadata read when its owner leaves`

## T-global

`src/main/adapters/opencode/v1/global-plugins.test.ts`

- `derives the fingerprint only from the effective plugin array`
- `lists only plugins declared by the effective global file as fixed rows`

## T-watch

`src/main/app/opencode-global-watch.test.ts`

- `fans out once per external plugin change and ignores unchanged polls`
- `does not publish an in-flight read after closing`
- `reports a failed poll and observes the next successful change`

## T-wire

`src/preload/index.test.ts`

- `carries explicit global extension scope and choices across renderer API and preload`
- `preserves claude engine CRUD identities through the renderer API and actual preload`
- `preserves opencode engine CRUD identities through the renderer API and actual preload`
- `imports settings for the selected harness through the renderer wrapper and exposed preload`
- `reveals logs through the renderer wrapper and exposed preload on the dedicated no-input channel`
- `promotes the selected shell through the renderer API and actual preload with all identity fields`
- `sends all held inputs now through the renderer API and actual preload using the session key`
- `opens a context file through the renderer wrapper and actual preload with unchanged results`
- `artifact actions preserve session and publication IDs on dedicated channels`
- `artifact catalog and pin state preserve their exact IPC requests`
- `preload orca.chat — 서브에이전트 제어 wire 홉 (0212 §10 EP-14) backgroundSubagent 는 받은 두 값을 각자의 필드에 실어 보낸다`
- `preload orca.chat — 서브에이전트 제어 wire 홉 (0212 §10 EP-14) stopSubagent 도 같은 규칙이다 — 같은 좌표를 쓰는 형제 채널이다`
- `preload orca.chat — 서브에이전트 제어 wire 홉 (0212 §10 EP-14) 두 채널은 서로 다른 채널 상수를 쓴다 — 맞바꿔도 위 두 케이스는 침묵한다`
- `preload public event subscriptions 'session.onComposerCatalogInvalidated' keeps its channel, strips the Electron event and releases only its own listener`
- `preload public event subscriptions 'session.onNativeResourcesChanged' keeps its channel, strips the Electron event and releases only its own listener`
- `preload public event subscriptions 'chat.onEvent' keeps its channel, strips the Electron event and releases only its own listener`
- `preload public event subscriptions 'install.onStatus' keeps its channel, strips the Electron event and releases only its own listener`
- `preload public event subscriptions 'session.onTitle' keeps its channel, strips the Electron event and releases only its own listener`
- `preload public event subscriptions 'cost.onUsage' keeps its channel, strips the Electron event and releases only its own listener`
- `preload public event subscriptions 'provider.onState' keeps its channel, strips the Electron event and releases only its own listener`
- `preload public event subscriptions 'concurrency.onEvent' keeps its channel, strips the Electron event and releases only its own listener`
- `preload public event subscriptions 'update.onState' keeps its channel, strips the Electron event and releases only its own listener`
- `preload public event subscriptions 'update.onProgress' keeps its channel, strips the Electron event and releases only its own listener`
- `wires DB load and lazy refresh as separate calls with the same stored session ID`
- `preserves native resource state and toggle identity through renderer and preload`
- `forwards OpenCode plugin changes on their own channel`

## T-control

`src/main/app/extension-control.test.ts`

- `persists explicit global choices and restores them in a new control`
- `keeps the last saved choices when persistence fails and allows a retry`

## T-settings

`src/main/infra/settings-store.test.ts`

- `SettingsStore (0092 — write-on-read 제거) getAll 반복 호출은 최초 1회(마이그레이션)만 디스크에 쓴다`
- `SettingsStore (0092 — write-on-read 제거) patch 는 쓰기 1회를 추가하고 이후 getAll 은 쓰기 없이 반영값을 돌려준다`
- `SettingsStore (0092 — write-on-read 제거) 깨진 디스크 데이터는 기본값으로 복원된다 (기존 불변식 유지)`
- `SettingsStore — scheduler 중첩 병합 (0156) updateCheck 기본값은 켜짐 + 6시간이다`
- `SettingsStore — scheduler 중첩 병합 (0156) updateCheck 부분 패치가 usageRecompute 와 자기 형제 필드를 보존한다`
- `SettingsStore — scheduler 중첩 병합 (0156) usageRecompute 패치가 updateCheck 를 되돌리지 않는다`
- `SettingsStore — scheduler 중첩 병합 (0156) 허용되지 않는 intervalHours 가 디스크에 있으면 기본값으로 복원된다`
- `SettingsStore — scheduler 중첩 병합 (0156) 허용되지 않는 intervalHours 패치는 거부된다`
- `SettingsStore — scheduler 중첩 병합 (0156) onPatch 는 이번 patch 가 건드린 키만 알린다`
- `SettingsStore — 0256 대화 텍스트 크기·너비 두 키 patch 는 저장되고 같은 backend 의 새 인스턴스(재시작)에서 유지된다 (AC4·AC5·ST-01)`
- `SettingsStore — 0256 대화 텍스트 크기·너비 density patch 는 결과와 디스크에 남지 않는다 (AC3)`
- `SettingsStore harness isolation merges separate harness preferences and restores them after restart`
- `persists global choices through the main-only setter, unrelated patches and restarts`

## T-migration

`src/main/infra/settings-migration.test.ts`

- `settings migration clears legacy native extension choices once when upgrading to settings version 2`
- `settings migration uiLocale — 부재는 ko 기본값, 유효값(en)은 보존, 불량값은 ko 로 복구(0096)`
- `settings migration 유효한 기존 설정을 보존하고 내부 버전 메타데이터를 기록한다`
- `settings migration 일부 키가 invalid여도 보존 가능한 사용자 상태를 기본값으로 무음 리셋하지 않는다`
- `settings migration settingsVersion/lastAppVersion은 공개 settings 결과에 노출하지 않는다`
- `settings migration ssoBypass → authBypass 개명 (AC14) 구 키의 값을 새 키로 옮긴다`
- `settings migration ssoBypass → authBypass 개명 (AC14) 구 키가 없으면 기본값을 유지한다`
- `settings migration ssoBypass → authBypass 개명 (AC14) 새 키가 이미 있으면 그쪽이 이긴다 (재실행 안전)`
- `settings migration ssoBypass → authBypass 개명 (AC14) 멱등 — 마이그레이션 결과를 다시 넣어도 값이 유지된다`
- `settings migration ssoBypass → authBypass 개명 (AC14) 형제 설정을 보존한다`
- `settings migration 0256 — 밀도 제거와 대화 텍스트 크기·너비 저장된 density 는 다음 로드에서 settings·raw 모두에서 사라지고 형제 키는 보존된다 (AC3)`
- `settings migration 0256 — 밀도 제거와 대화 텍스트 크기·너비 두 키 — 부재는 medium, 유효값 보존, 불량값 medium 복구 (AC4·AC5)`

## T-private

`src/main/app/handlers/settings.private.test.ts`

- `keeps global choices out of renderer patches in both settings responses`

## T-hook

`src/renderer/src/features/skills/hooks/useNativeMcpCatalog.test.ts`

- `queries explicit global scope without owning runtime observations, retains good rows on failure and ignores stale reads`
- `renders native plugin capabilities and updates the actual row through its toggle`
- `reports a choice write failure once and releases the queue for a retry`

## T-mcpSdk

`src/main/adapters/opencode/v1/mcp-control.test.ts`

- `applies restored choices once per new directory and preserves project overrides and existing instances`

## T-runtime

`src/main/app/native-resource-sharing.test.ts`

- `serializes project mutations across manual and observer callers without blocking another project`
- `uses the canonical harness project for unassigned sessions, keeping projects and backends isolated`
- `does not write after a peer runtime changes while its metadata is loading`
- `does not write after a peer generation changes while its metadata is loading`
- `does not write after a peer project changes while its metadata is loading`

`src/renderer/src/features/chat/harnesses/common/composer/Composer.native-menu.test.ts`

- `highlights selected native @ plugins in the real claude composer and refreshes their membership`
- `highlights selected native @ plugins in the real opencode composer and refreshes their membership`
- `keeps a quoted native plugin id highlighted after selection in claude`
- `keeps a quoted native plugin id highlighted after selection in opencode`
- `reflects session-enabled plugin commands in real autocomplete and decoration without changing the draft`
- `keeps Orca file skill autocomplete scoped to extension-enabled claude inputs`
- `keeps Orca file skill autocomplete scoped to extension-enabled opencode inputs`
- `loads claude native commands from +, inserts without sending, reuses on reentry and refreshes on reconnect`
- `loads opencode native commands from +, inserts without sending, reuses on reentry and refreshes on reconnect`
- `offers an installed frontend-design skill before the Claude runtime starts (saved)`
- `offers an installed frontend-design skill before the Claude runtime starts (draft)`
- `shows all source groups directly for claude and keeps draft text on selection`
- `shows all source groups directly for opencode and keeps draft text on selection`

## T-persistent

`src/main/adapters/opencode/v1/adapter.persistent.test.ts`

- `OpenCode persistent SDK channel waits beyond the menu deadline for native command dispatch without submitting twice`
- `OpenCode persistent SDK channel fails command preparation safely before acceptance without aborting or submitting a prompt`
- `OpenCode persistent SDK channel cancels command preparation at the SDK request before any command is accepted`
- `OpenCode persistent SDK channel retries explicitly after an SDK SSE HTTP failure without replaying the failed input`
- `OpenCode persistent SDK channel reports an initial timeout SSE failure before submission`
- `OpenCode persistent SDK channel reports an initial empty SSE failure before submission`
- `OpenCode persistent SDK channel preserves a safe stream failure after the initial connection without resubmitting`
- `OpenCode persistent SDK channel discards menu metadata that finishes after the channel closes`
- `OpenCode persistent SDK channel passes a live plugin agent and drops its removed variant on the next prompt`
- `OpenCode persistent SDK channel does not wait for menu metadata before sending a default prompt`
- `OpenCode persistent SDK channel dispatches a real native slash command while its HTTP response is pending and retains context and files`
- `OpenCode persistent SDK channel surfaces a rejected command and ignores a previous command error after a later submission`
- `OpenCode persistent SDK channel sends an unknown slash through the ordinary prompt path`
- `OpenCode persistent SDK channel carries the selected engine model limit through the channel into telemetry`
- `OpenCode persistent SDK channel creates a replacement native session without trying to reuse an expired server identity`
- `OpenCode persistent SDK channel sends archived context only to the model and routes the replacement native session to the existing Orca transcript`
- `OpenCode persistent SDK channel subscribes once before initial and subsequent prompts`
- `OpenCode persistent SDK channel publishes the accepted echo before an early SSE reply while the HTTP response is pending`
- `OpenCode persistent SDK channel retires a rejected warm submission before another adapter input can be accepted`
- `OpenCode persistent SDK channel preserves owned reception on interrupt and retires stale channel callbacks`
- `OpenCode persistent SDK channel keeps child approvals independent from interrupted root frames`
- `OpenCode persistent SDK channel reads the current root approval scope on a subsequent frame`
- `OpenCode persistent SDK channel closes owned subscriptions once and reports uncertain abort failures`
- `exposes native resources from the live channel client and its directory without mutations`
- `resolves the native plugin directory with the same environment as the live channel`
