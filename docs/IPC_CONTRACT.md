# IPC Contract

> 이 문서는 Main ↔ Renderer 간 IPC 채널의 **단일 진실 공급원 (SSOT)** 이다.
> 채널을 추가/변경할 때는 코드와 이 문서를 함께 갱신한다.
> 최종 업데이트: 2026-08-05 (handoff 0177 — §2.4 `Settings` 카탈로그에 누락돼 있던 `connectorInstances`(0161)·`pluginAddEnabled`(0164) 2키 보충 → **20 키**. 채널 수는 86 유지, §2 카탈로그 무변경)
>
> ⚠️ **카운트 정정 (0157 verify r1)**: 이전 판은 헤더 73 · 내역 합 72 · 실측 74 로 셋이 서로 달랐다. `chat`(5→6)·`cost`(5→6) 가 내역에서 누락돼 있었다. 아래 수치는 `CHANNELS` 상수를 기계 카운트한 실측치이며 **내역 합 = 총계**가 되도록 맞췄다.
> 관련 문서: [ARCHITECTURE.md](./ARCHITECTURE.md), [GLOSSARY.md](./GLOSSARY.md), [TRD.md](./TRD.md) §5

## 1. 명명 규칙

- 형식: `orca:<domain>:<action>` — 소문자 + 콜론 구분
- 도메인 (23개): `chat`, `boot`, `backend`, `agent`, `engine`, `install`, `update`, `settings`, `skills`, `files`, `session`, `project`, `window`, `search`, `mcp`, `cost`, `concurrency`, `permission`, `notify`, `debug`(dev 전용), `log`, `auth`, `plugin`
- 방향:
  - Renderer → Main 요청: `ipcMain.handle` + `ipcRenderer.invoke` (Promise 반환)
  - Main → Renderer 이벤트: `webContents.send` + `ipcRenderer.on` (단방향 push)
  - Renderer → Main one-way send: `ipcMain.on` + `ipcRenderer.send` (응답 없음 — 현재 `log:emit` 유일, `infra/ipc/handle.ts` 의 `on()` 헬퍼로 zod 검증 경유)
- preload 노출: `window.orca.<domain>.<action>(...)` 형태 (`app/src/preload/index.ts`)
- 채널 상수: `app/src/shared/ipc.ts` 의 `CHANNELS` 객체. 문자열 리터럴 직접 사용 금지.
- 입력 검증: 모든 invoke 핸들러는 `app/src/main/ipc/registry.ts` 의 `handle(channel, schema, invalid, fn)` 헬퍼를 경유해 **zod 스키마 (`app/src/shared/protocol.ts`)** 로 safeParse 검증한다. 채널별 실패 정책은 등록부에 명시:
  - `'reject'` — zod 에러로 invoke reject (쓰기·생성류: project create/update/delete/listSessions · mcp delete · install start · chat cancel · debug setMock). 무효 페이로드 = 프로그래머 오류 표면화.
  - `{ fallback }` — 무해 폴백 반환 (조회·무시-안전류: session load(null)/delete/rename(undefined) · files list([]) · search([]) · permission respond/setMode(undefined)).
  - 특례: `chat:send` 는 실패를 `error` 이벤트로 회신(§2.1). 입력이 없거나 store 내부 zod 가 검증하는 채널(settings set · mcp add/update)은 `handlePlain`.
- 출력(main→renderer send) 무검증: `NormalizedEvent` 등의 형상 보증은 어댑터 정규화(`claude-map.ts`)가 담당 — 의도된 설계.

## 2. 채널 카탈로그 (총 86 채널)

도메인별 분포: `chat` 6 (`send` · `event` · `cancel` · `stopSubagent` · `steerCancel` · `steer`) · `boot` 2 (`report` · `whenReady`) · `backend` 1 · `agent` 1 · `engine` 5 · `install` 2 · `update` 6 · `settings` 2 · `skills` 7 · `files` 5 · `session` 7 (0129 `setPinned` 추가) · `project` 6 (0129 `setPinned` 추가) · `window` 3 · `search` 1 · `mcp` 4 · `cost` 6 · `concurrency` 1 · `permission` 2 (`respond` · `setMode`) · `notify` 1 (`show` — §2.12-c) · `debug` 2 (dev 전용 — `getMock` · `setMock`) · `log` 1 (`emit` — §2.13-b) · `auth` 8 (`status` · `providers` · `bindings` · `begin` · `continue` · `refresh` · `logout` · `stateEvent` — §2.13-c, 0157) · `plugin` 7 (`list` · `connectionConnect` · `connectionDisconnect` — 0158 · `templateList` · `instanceCreate` · `instanceDelete` — 0161 · `diagnostics` — 0164) = **86**.

`app/src/shared/ipc.ts` 의 `CHANNELS` 상수와 1:1 일치. **단, `debug` 2채널은 `import.meta.env.DEV` 일 때만 `ipcMain.handle` 로 등록된다** (CHANNELS 상수 문자열은 상존하나 prod 핸들러 미등록 — §2.13 참조).

### 2.1 Chat

| 채널               | 방향         | 페이로드                                                                                                                                                                                                                            | 응답/스트림           | 설명                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orca:chat:send`   | R→M (invoke) | `SendChatMessage` = `{ sessionId: string \| null; projectId: string \| null; text: string; permissionMode?; providerKey?: string \| null; modelFamily?: string \| null; effort?: 'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'; attachments?: ComposerAttachment[]; attachmentViews?: AttachmentView[]; cwd?: string \| null; forkFrom?: string; handoffFrom?: string; continuityLang?: 'ko' \| 'en'; clientKey?: string; clientRequestId?: string }` | `Promise<void>` (ack) | **모든 사용자 프롬프트의 단일 입구(0067·0166)** — 메시지는 논리 세션 lease의 pending queue에 먼저 적재된다. 유휴면 즉시 제출하고, preparing/active 체인이 있으면 held로 합류한다. 즉시 steer 미지원 백엔드도 admission은 거부하지 않고 체인 종료 뒤 자동 continuation으로 전달한다. provider 경계 위반·closing만 명시적으로 거부한다. 제출은 `submitting → submitted → confirmed/orphaned` 트랜잭션이며 adapter의 `accepted/rejectedBeforeAccept` 결과와 결합된다. `clientRequestId`는 메시지 정체성, `clientKey`는 session ID 발급 전 provisional lease/큐/라우팅 정체성이다. 같은 client request 재호출은 멱등이며 준비 중 후속 입력도 별도 체인을 열지 않는다. 커밋(user row 영속·preview·renderer 승격)은 echo 또는 허용된 첫 모델 출력 관측 뒤 `message.committed`로만 일어난다. |
| `orca:chat:steerCancel` | R→M (invoke) | `CancelSteer` = `{ sessionId: string; id: string }` | `Promise<void>` | held(주입 전) pending 메시지 1건을 취소한다 — 응답으로 `message.cancelled(ids:[id])` 가 나간다. 이미 예약(stdin 주입)된 항목은 거부되며, **0151 부터 무이벤트가 아니라 `message.submitted(submitted:true)`** 로 소유권 이전을 회신해 renderer 가 버블을 '전달됨'(취소 버튼 없음)으로 재동기화한다(구 구현은 침묵이라 눌러도 화면 변화가 없었다). renderer hover 취소는 낙관 제거+draft 복원. |
| `orca:chat:event`  | M→R (send)   | —                                                                                                                                                                                                                                   | `NormalizedEvent` (반복) | 어댑터 정규화 스트림. variant 정의는 §3 참조.                                                                                                                                                                                                                                                                                        |
| `orca:chat:cancel` | R→M (invoke) | `CancelChat` = `{ sessionId: string }`                                                                                                                                                                                              | `Promise<void>`       | 진행 중 요청 취소 (`AbortSignal` 전파).                                                                                                                                                                                                                                                                                              |
| `orca:chat:discardSession` | R→M (invoke) | `DiscardSession` = `{ sessionId: string }` | `Promise<void>` | **세션 전체 중단(0151 r2, 0167 갱신)** — 진행 턴 abort + active/idle 런타임(서브프로세스) 폐기로 CLI 입력 큐 잔여를 통째로 소멸시킨다. 공개 SDK 에 provider 큐 개별 취소 표면이 없어 Stop 잔여를 없애는 유일한 수단. **백그라운드 서브에이전트도 함께 종료**되므로 `chat.activity.residualCount>0` 일 때만 UI 가 제시한다. 폐기된 open 예약은 `message.cancelled` 로 회신돼 composer draft 로 복원된다. |
| `orca:chat:stopSubagent` | R→M (invoke) | `StopSubagent` = `{ sessionId: string; toolUseId: string }`                                                                                                                                                            | `Promise<void>`       | 서브에이전트(Task) **단위** 중단(턴 전체 취소 아님). main 이 `toolUseId`→SDK `task_id`(subagent.task 이벤트에서 누적)를 찾아 `query.stopTask(taskId)` 호출(foreground 거부 시 `backgroundTasks(toolUseId)` 후 재시도). UI 전이는 SDK 의 `task_notification status:'stopped'` → `subagent.task(settled)` 로. |

### 2.1-b Boot

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
| --- | --- | --- | --- | --- |
| `orca:boot:report` | R→M (invoke) | — | `BootReport` = `{ startedAt; finishedAt; durationMs; status:'ok'\|'warning'\|'failed'; steps: BootReportStep[]; warnings: string[] }` | main `Bootstrap.start()` 부트 결과의 **완료 리포트 스냅샷**을 조회한다. 실시간 진행률/event 채널이 아니며, renderer boot 에서는 non-mandatory diagnostic 단계로만 조회한다(`whenReady` 게이트 뒤). 조회 실패나 `warning` status 는 앱 진입을 막지 않고 degrade/console warning 으로 남긴다. |
| `orca:boot:whenReady` | R→M (invoke) | — | `void` (resolve = main 준비 완료 / reject = `start()` 실패) | **main 부팅 완료 게이트** (0109). 창이 `start()` 완료 *이전* 에 뜨므로, renderer 부트 오케스트레이터의 **첫 mandatory 스텝**(`main-ready`)이 이 invoke 로 main 준비를 기다린 뒤에야 나머지 IPC 스텝(settings/session 조회 등)을 시작한다 — "미등록 핸들러 invoke" 창을 구조적으로 차단. 핸들러는 `index.ts` 가 `start()` 착수 직후(다른 어떤 핸들러 등록보다 먼저) 등록하고 `start()` promise 를 그대로 반환한다. reject 는 renderer mandatory 규칙에 따라 BootScreen failed UX 로 표면화된다. |

`BootReportStep` = `{ id; label?; status:'ok'\|'warning'\|'failed'; critical; startedAt; finishedAt; durationMs; message? }`. `critical:false` 단계의 실패는 `warning` 으로 기록되며 main 부트를 막지 않는다. `critical:true` 단계의 실패는 main 부트 실패로 전파되며, renderer 는 `whenReady` reject 로 이를 관측한다(0109 이전에는 창 자체가 뜨지 않았다).

### 2.2 Backend

| 채널                | 방향         | 페이로드 | 응답                                                                                                                                               | 설명                                                                                                                                                                |
| ------------------- | ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orca:backend:list` | R→M (invoke) | —        | `BackendListResult` = `{ backends: { id: Backend; installed: boolean; version?: string; capabilities?: ProviderDescriptor }[]; active?: Backend }` | 등록된 어댑터의 설치 상태 + 활성 백엔드 + 능력 서술자(`capabilities`, computed-on-the-fly — provider-runtime.md §4/§15). 신규 채널 아님(기존 페이로드 비파괴 확장). |

> **예약 (현재 미노출)**: `orca:backend:select` — 단일 백엔드 (`claude`) 라 호출자가 없어 preload 에서 의도적으로 제외. opencode 어댑터 활성화 PR 에서 재노출.

### 2.2-b Agent (handoff 0010)

| 채널              | 방향         | 페이로드 | 응답                 | 설명                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ------------ | -------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orca:agent:list` | R→M (invoke) | —        | `AgentEnvironment[]` | `~/.config/orca/sources/settings/<adapter>/<provider>/` 의 provider 디렉토리를 열거하고 각 `settings.json` 을 `claude-model-parser` 로 파싱해 renderer-safe DTO 로 반환. `models` 는 `AgentModelView = { alias, model: string\|null, isCustom, oneMillionContext, isDefault }`. `authToken`/`baseUrl`/`env`/secret 값 필드는 존재하지 않는다(화이트리스트 — `toAgentEnvironments`). |

### 2.2-c Engine (handoff 0021)

| 채널                 | 방향         | 페이로드                                                                               | 응답                                                                     | 설명                                                                                                                                                                        |
| -------------------- | ------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orca:engine:add`    | R→M (invoke) | `CreateEngineRequest` = `{ engine: 'claude'; provider: string; settingsJson: string }` | `EngineWriteResult` = `{ key; engine: 'claude'; provider }`              | `sources/settings/claude/<provider>/settings.json` 을 원자적으로 생성한다(파생 캐시 없음 — 모델은 열거 시 settings.json 파싱). provider 중복/빈 값/허용 문자 위반은 reject. |
| `orca:engine:update` | R→M (invoke) | `UpdateEngineRequest` = `{ key: string; settingsJson: string }`                        | `EngineWriteResult`                                                      | 기존 provider 의 raw settings.json 을 원자적으로 교체한다. provider rename 은 비범위(삭제+추가).                                                                            |
| `orca:engine:delete` | R→M (invoke) | `DeleteEngineRequest` = `{ key: string }`                                              | `Promise<void>`                                                          | provider 디렉토리를 제거한다.                                                                                                                                               |
| `orca:engine:read`   | R→M (invoke) | `ReadEngineRequest` = `{ key: string }`                                                | `EngineReadResult` = `{ key; engine: 'claude'; provider; settingsJson }` | 편집 모달 프리필용 raw settings.json 읽기.                                                                                                                                  |
| `orca:engine:importUserSettings` (handoff 0090) | R→M (invoke) | 없음 (`handlePlain`)                                                                    | `EngineUserSettingsResult` = `{ exists: boolean; settingsJson: string }` | 사용자 전역 `~/.claude/settings.json` 원문 읽기 — 엔진 추가/편집 모달의 settings.json 자동완성용. 부재/읽기 실패 = `exists:false` (무해 read). 내용 검증은 렌더러 실시간 JSON 검증이 담당. |

### 2.3 Install

| 채널                  | 방향         | 페이로드                                | 응답/스트림                                                                                           | 설명                                                                                                                                                            |
| --------------------- | ------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orca:install:start`  | R→M (invoke) | `StartInstall` = `{ backend: Backend }` | `Promise<void>` (ack)                                                                                 | 백엔드 설치 시작. 진행 상태는 `orca:install:status` 스트림. **현재 claude 는 SDK `optionalDependencies` 가 binary 를 자동 해소** 하므로 즉시 `done: true` 반환. |
| `orca:install:status` | M→R (send)   | —                                       | `InstallStatus` = `{ step: string; progress?: number; log?: string; error?: string; done?: boolean }` | 설치 라인별 진행 이벤트.                                                                                                                                        |


### 2.3-b Update

| 채널 | 방향 | 페이로드 | 응답/스트림 | 설명 |
| --- | --- | --- | --- | --- |
| `orca:update:state` | R→M (invoke) | — | `UpdateState` | main updater 상태 캐시 스냅샷. renderer Provider mount 시 event 유실을 복구하기 위해 조회한다. |
| `orca:update:check` | R→M (invoke) | — | `UpdateCheckResult` | 사용자 명시 재확인. 시작 자동 확인과 달리 실패 시 error state를 반환한다. |
| `orca:update:download` | R→M (invoke) | — | `UpdateCheckResult` | `available` 상태에서 사용자 버튼으로 다운로드를 시작한다. `autoDownload=false`라 앱 시작 확인은 다운로드를 자동 시작하지 않는다. |
| `orca:update:quitAndInstall` | R→M (invoke) | — | `UpdateInstallResult` | 다운로드 완료 후 사용자 명시 액션으로만 호출한다. main은 restart gate를 재확인하고 install lock 설정 후 idle runtime을 close한 뒤 `quitAndInstall(false, true)`를 호출한다. |
| `orca:update:stateEvent` | M→R (send) | `UpdateState` | — | updater event와 restart gate 변화 상태를 모든 창에 push한다. |
| `orca:update:progressEvent` | M→R (send) | `UpdateProgress` | — | 다운로드 진행률 DTO를 push한다. |

`UpdateState.status` = `idle | checking | available | downloading | ready | installing | error`. 일반 앱 종료/창 닫기/OS shutdown은 업데이트 자동 설치 경로가 아니며, 설치는 update dialog의 사용자 명시 액션으로만 진입한다.

### 2.4 Settings

| 채널                | 방향         | 페이로드                              | 응답       | 설명                                     |
| ------------------- | ------------ | ------------------------------------- | ---------- | ---------------------------------------- |
| `orca:settings:get` | R→M (invoke) | —                                     | `Settings` | electron-store 의 전체 설정 객체.        |
| `orca:settings:set` | R→M (invoke) | `SettingsPatch` = `Omit<Partial<Settings>, 'scheduler'> & { scheduler?: { usageRecompute?: Partial<…>; updateCheck?: Partial<…> } }` (scheduler 는 그룹별 중첩 partial — 한 그룹만 보내도 형제 그룹은 보존) | `Settings` | 부분 패치 후 병합·검증된 전체 객체 반환. |

`Settings` 타입 (`app/src/shared/ipc.ts`):

```typescript
interface Settings {
  theme: "white" | "dark";
  density: "compact" | "normal" | "comfortable";
  sidebarCollapsed: boolean;
  sidebarWidth: number; // 180–480, default 248 (Phase 3+ 도입)
  lastBackend: Backend | null;
  lastSessionId: string | null;
  windowBounds: { x: number; y: number; width: number; height: number } | null;
  mcpEnabled: Record<string, boolean>; // MCP 서버 on/off (키=name). 부재 ⇒ true
  mcpMeta: Record<string, { description: string }>; // MCP Orca 전용 메타 (mcp.json 순정 유지)
  skillEnabled: Record<string, boolean>; // Skill on/off (키=sourceId/name). 부재 ⇒ true
  authBypass: boolean; // 인증 게이트 우회 (디버그 패널 토글, DEV 전용). true ⇒ 앱 시작 시 로그인 건너뜀. default false (0157 — 구 ssoBypass)
  connectorInstances: unknown[]; // 사용자가 UI 에서 템플릿으로 추가한 connector 인스턴스 (0161). **비밀 미포함** — 주소·라벨만, 자격증명은 safeStorage vault 소유(AUTH-PLAT-008). 항목 단위 검증은 `features/connectors/instance-store.ts` (깨진 항목만 버리고 나머지를 살리려 여기서는 형태만 받는다). default []
  pluginAddEnabled: boolean; // 플러그인 '추가' UI 노출 토글 (디버그, 0164). 기본 경로는 빌드타임 서버 목록이라 기본 false. default false
  language: string; // 선호 언어 (LLM 응답 언어). 시스템 프롬프트 '# User' 헤더로 매 턴 주입. uiLocale 과 별개. default '한국어'
  uiLocale: "ko" | "en"; // UI 표시 언어 (앱 크롬 로케일, 0096) — 렌더러 i18n(ko/en) + 날짜/시간 포맷 로케일. default 'ko'
  accountInstructions: string; // 설정 모달 '계정 지침' textarea. 시스템 프롬프트 '# User' 헤더로 매 턴 주입. default ''
  appFont: "sans" | "serif" | "mono"; // 앱 전체 폰트 (설정 모달). --font-app 에 매핑. default 'sans'
  notifyOnComplete: boolean; // 응답완료 알림 토글. on ⇒ 턴 완료 시(창 비활성 한정) OS 알림. default false
  spendingLimitUsd: number | null; // 월간 지출 한도(USD) — 사용량 한도 바의 기준. null=무제한. default 90 (0079)
  scheduler: {
    usageRecompute: { enabled: boolean; cron: string }; // 사용량 recompute job (0091). default enabled=false
    updateCheck: { enabled: boolean; intervalHours: 1 | 6 | 12 | 24 }; // 자동 업데이트 확인 주기 (0156) — 앱 시작 시각 anchor 간격. default { true, 6 }. 앱 시작 시 1회 확인은 이 설정과 무관하게 항상 수행
  };
}
```

> MCP 서버 정의의 진실은 `~/.config/orca/sources/mcp/mcp.json`(순정 Claude `mcpServers` 스키마 + `${VAR}`). `enabled`/`description` 만 settings 가 보유한다 — `orca:mcp:*` 핸들러가 mcp.json + secret-store + settings 를 함께 조율([arch/backend/security.md](arch/backend/security.md) §1.4).

### 2.5 Skills

| 채널                       | 방향         | 페이로드                                                 | 응답                                                                                                                                                                           | 설명                                                                                 |
| -------------------------- | ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `orca:skills:list`         | R→M (invoke) | —                                                        | `SkillInfo[]` = `{ name; description; argumentHint?; sourceId; sourceLabel; sourceKind; enabled; canToggle; canRemove; skillPath; skillDir; body?; createdAt?; updatedAt? }[]` | Orca sources + 어댑터/워크스페이스 SKILL.md 카탈로그.                                |
| `orca:skills:author`       | R→M (invoke) | `AuthorSkillRequest` = `{ name; description; body }`     | `SkillInfo[]`                                                                                                                                                                  | `~/.config/orca/sources/skills/<name>/SKILL.md` 작성 후 refresh.                     |
| `orca:skills:upload`       | R→M (invoke) | `UploadSkillRequest` = `{ fileName; content }`           | `SkillInfo[]`                                                                                                                                                                  | `.md`/`.skill` 파일 내용을 Orca skill source 로 저장 후 refresh.                     |
| `orca:skills:setEnabled`   | R→M (invoke) | `SetSkillEnabledRequest` = `{ name; sourceId; enabled }` | `SkillInfo[]`                                                                                                                                                                  | Orca source 스킬만 settings `skillEnabled[sourceId/name]` 을 갱신하고 dist/cwd 싱크. |
| `orca:skills:open`         | R→M (invoke) | `SkillTargetRequest` = `{ name; sourceId }`              | `Promise<void>`                                                                                                                                                                | SKILL.md 를 OS 기본 앱으로 연다.                                                     |
| `orca:skills:showInFolder` | R→M (invoke) | `SkillTargetRequest`                                     | `Promise<void>`                                                                                                                                                                | SKILL.md 위치를 OS 파일 관리자에서 표시한다.                                         |
| `orca:skills:remove`       | R→M (invoke) | `SkillTargetRequest`                                     | `SkillInfo[]`                                                                                                                                                                  | Orca source 스킬 폴더를 제거하고 refresh/sync 한다.                                  |

> **현재 스캔 경로**: `~/.config/orca/sources/skills/<name>/SKILL.md` + 어댑터 네이티브 경로(`~/.claude/skills/<name>/SKILL.md`) + workspace 경로(`<cwd>/.claude/skills/<name>/SKILL.md`).

### 2.6 Files

| 채널                         | 방향         | 페이로드                                               | 응답                                                       | 설명                                                                         |
| ---------------------------- | ------------ | ------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `orca:files:list`            | R→M (invoke) | `ListFilesRequest` = `{ cwd: string; relDir: string }` | `FileEntry[]` = `{ name: string; isDirectory: boolean }[]` | `@` 파일 경로 자동완성용. `cwd` 기준 `relDir` 의 직속 항목 한 단계만 리스팅. |
| `orca:files:pickAttachments` | R→M (invoke) | —                                                      | `PickedAttachment[]`                                      | 컴포저 첨부 다이얼로그. main 이 OS 파일 선택창을 열고 txt/md/image 경로 메타데이터를 반환한다. |
| `orca:files:pickDirectory` | R→M (invoke) | —                                                      | `string \| null`                                      | 컴포저 cwd 버튼용 디렉토리 선택 다이얼로그. 기본 시작 위치는 Orca 기본 작업 경로(`projects/default`)이며, 취소/빈 선택은 `null`. |
| `orca:files:openPath` | R→M (invoke) | `OpenPathRequest` = `{ path: string }`                  | `Promise<void>`                                          | 세션 cwd 를 OS 파일 탐색기로 연다. **경로 화이트리스트**: 실재 디렉토리이면서 `projects/` 루트 하위이거나 실재 세션 cwd 인 경우에만 열고, 그 외(파일·실행파일·임의 경로)는 reject 한다. `shell.openPath` 실패 문자열도 invoke reject 로 표면화한다. |
| `orca:files:readAttachment`  | R→M (invoke) | `ReadAttachmentRequest` = `{ path: string }`           | `ReadAttachmentResult` = `{ data: string; mimeType: string }` | 이미지 첨부 썸네일용 base64 읽기. main path allowlist 검증 후 image 파일만 반환한다. |

### 2.7 Session

| 채널                      | 방향         | 페이로드                                                        | 응답                    | 설명                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------ | --------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orca:session:cwd`        | R→M (invoke) | —                                                               | `Promise<string>`       | 현재 작업 디렉토리. 파일 자동완성·`init` 이벤트의 `cwd` 검증용.                                                                                                                                                                                                                                                                                                                                                                                          |
| `orca:session:list`       | R→M (invoke) | —                                                               | `SessionListItem[]`     | 사이드바 '최근 대화' 메타 목록(`cwd` 포함). DB SSOT — `updatedAt` 내림차순.                                                                                                                                                                                                                                                                                                                                                                                          |
| `orca:session:load`       | R→M (invoke) | `LoadSessionRequest` = `{ sessionId: string }`                  | `LoadedSession \| null` | 세션 cwd·순서 보존 메시지·마지막 턴 통계 `lastTelemetry`·비용 `costUsd`·fork/handoff `lineage`를 일괄 로드한다. **0167부터 `activity?: ChatActivitySnapshot`**을 동봉해 renderer 재접속/세션 전환 시 현재 준비·스트리밍·대기·잔여 상태를 추가 왕복 없이 복원한다. live broadcast가 load 응답보다 먼저 도착했으면 renderer는 더 높은 `revision`을 보존한다. |
| `orca:session:delete`     | R→M (invoke) | `DeleteSessionRequest` = `{ sessionId: string }`                | `Promise<void>`         | hard delete (CASCADE — messages/tool_calls 동반 삭제). `lastSessionId` 가 대상이면 settings 도 해제.                                                                                                                                                                                                                                                                                                                                                     |
| `orca:session:rename`     | R→M (invoke) | `RenameSessionRequest` = `{ sessionId: string; title: string }` | `Promise<void>`         | title 덮어쓰기 + `updatedAt` 갱신. title 길이 1–120 자. 사용자 rename 으로 간주해 DB `title_source='user'` 로 표기한다.                                                                                                                                                                                                                                                                                                                                  |
| `orca:session:setPinned`  | R→M (invoke) | `SetSessionPinnedRequest` = `{ sessionId: string; pinned: boolean }` | `Promise<void>`    | 0129 — 세션 고정 토글. `pinned=true` 면 `pinned_at=Date.now()`(정렬 키 겸용), false 면 `null`. 좌측 nav "고정됨" 섹션이 `SessionListItem.pinnedAt` 로 파생.                                                                                                                                                                                                                                                                                            |
| `orca:session:titleEvent` | M→R (send)   | `SessionTitleEvent` = `{ sessionId: string; title: string }`    | —                       | 새 세션 첫 턴 종료 후 main 이 자동 요약 제목을 영속화하면 모든 창에 push 한다. renderer 는 사이드바 목록과 활성 세션 헤더를 새로고침 없이 갱신한다.                                                                                                                                                                                                                                                                                                      |

### 2.7-b Project (Phase 3)

| 채널                        | 방향         | 페이로드                                                                        | 응답                | 설명                                                             |
| --------------------------- | ------------ | ------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------- |
| `orca:project:list`         | R→M (invoke) | —                                                                               | `Project[]`         | 모든 프로젝트, `updatedAt` 내림차순.                             |
| `orca:project:create`       | R→M (invoke) | `CreateProjectRequest` = `{ name: string; instructions: string }`               | `Project`           | 생성 + 신규 row 반환. name 1–120 자, instructions 최대 8000 자.  |
| `orca:project:update`       | R→M (invoke) | `UpdateProjectRequest` = `{ id: string; name?: string; instructions?: string }` | `Promise<void>`     | 부분 업데이트. null 인자는 기존 값 유지.                         |
| `orca:project:delete`       | R→M (invoke) | `{ id: string }`                                                                | `Promise<void>`     | ON DELETE SET NULL — sessions.project_id 정리. 세션 자체는 보존. |
| `orca:project:setPinned`    | R→M (invoke) | `SetProjectPinnedRequest` = `{ id: string; pinned: boolean }`                   | `Promise<void>`     | 0129 — 프로젝트 고정 토글. `pinned=true` 면 `pinned_at=Date.now()`, false 면 `null`. "고정됨" 섹션이 `Project.pinnedAt` 로 파생. |
| `orca:project:listSessions` | R→M (invoke) | `ListProjectSessionsRequest` = `{ projectId: string }`                          | `SessionListItem[]` | 프로젝트 소속 세션만.                                            |

### 2.8 Window (Phase 3+)

`frame: false` 커스텀 타이틀바의 `WinControls` 가 호출. macOS 는 OS traffic light 가 윈도우 조작을 담당하므로 `WinControls` 가 null 을 반환 → 이 채널 호출자가 없다 (채널 자체는 플랫폼 공통 노출).

| 채널                   | 방향         | 페이로드 | 응답            | 설명                                                       |
| ---------------------- | ------------ | -------- | --------------- | ---------------------------------------------------------- |
| `orca:window:minimize` | R→M (invoke) | —        | `Promise<void>` | 현재 BrowserWindow 최소화 (`mainWindow.minimize()`).       |
| `orca:window:maximize` | R→M (invoke) | —        | `Promise<void>` | 최대화 토글 (`isMaximized() ? unmaximize() : maximize()`). |
| `orca:window:close`    | R→M (invoke) | —        | `Promise<void>` | 윈도우 종료 (`mainWindow.close()`).                        |

추가:

- **preload 노출**: `window.orca.window.{minimize,maximize,close}()`.
- **핸들러 위치**: `app/src/main/index.ts` 의 `createWindow` 내부 (router 가 아닌 직접 부착 — 윈도우 인스턴스 직접 참조 필요).
- **`window.orca.platform`** (sync 노출): `'darwin' | 'win32' | 'linux'`. `<html data-platform>` 부착 + WinControls 플랫폼 분기에 사용.

### 2.9 Search (Phase 3++)

대화 이력 전체 검색. Header 의 검색 버튼이 여는 `SearchModal` 이 단일 호출자. 백엔드는 SQLite FTS5 가상 테이블 (`messages_fts`) — `0003_messages_fts.sql` 마이그레이션이 INSERT/UPDATE/DELETE 트리거로 `messages` 와 동기 유지.

| 채널                   | 방향         | 페이로드                                                                                         | 응답          | 설명                                          |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------------------ | ------------- | --------------------------------------------- |
| `orca:search:messages` | R→M (invoke) | `SearchMessagesRequest` = `{ q: string; limit?: number }` (q: 1–200자, limit: 1–100, default 30) | `SearchHit[]` | FTS5 검색. 결과는 rank 정렬, 최대 `limit` 개. |

`SearchHit` 타입 (`app/src/shared/ipc.ts`):

```typescript
interface SearchHit {
  messageId: number;
  sessionId: string;
  sessionTitle: string | null;
  role: "user" | "assistant";
  createdAt: number;
  // SQLite snippet() 가 생성한 `<mark>…</mark>` 포함 발췌. 렌더러는 split-parse 후
  // React 노드로 재구성 (innerHTML 우회로 XSS 방어).
  snippet: string;
}
```

추가:

- **입력어 prefix 매칭**: `toFtsMatch` (`app/src/main/db/queries.ts`) 가 공백 토큰 분리 후 _모든 토큰_ 에 `*` wildcard 부착 (예: `진행 중` → `"진행"* "중"*`). 어느 토큰이든 미완성으로 타이핑 중일 수 있다는 가정. 짧은 토큰의 매치 폭증은 LIMIT + FTS5 rank 정렬로 흡수.
- **실행 위치**: main thread 직접 (better-sqlite3 sync). FTS5 latency 가 단위 ms 라 worker thread 도입 보류 — 향후 perf 회귀 시 `utilityProcess` 로 위임 검토.
- **렌더러 debounce**: 150ms + request id supersede 로 stale 응답 폐기.

### 2.10 MCP (Phase 3++)

전역 MCP 서버 설정 CRUD. 플러그인 모달(`ExtensionsCatalogModal`)이 단일 호출자. **영속화는 파일-백드 모델** — 정의의 진실은 `~/.config/orca/sources/mcp/mcp.json`(순정 Claude `mcpServers` 스키마 + `${VAR}`), **인증 비밀은 secret-store(`orca-secrets` + `safeStorage`)에 env-var 이름으로 암호화 저장**(mcp.json 엔 `${VAR}` 만, renderer 엔 `hasAuth` boolean 만), enabled/description 은 settings(`mcpEnabled`/`mcpMeta`). 활성화된 서버는 `handleChatSend` 가 `McpStore.buildQueryOptions()`(→ `toClaudeConfig`)로 변환해 매 query 의 `mcpServers` + `allowedTools`(`mcp__<name>__*`) 옵션에 주입. 상세 = [arch/backend/security.md](arch/backend/security.md) §1.4.

> IPC DTO 표면(`McpServer` + 4채널)은 파일-백드 재설계 전후로 **불변**이다(preload/renderer 무영향). `id` = 서버 `name`(고유 키), `authEnvKey` 는 stdio·http 양쪽에서 비밀을 주입할 env-var 이름.

| 채널              | 방향         | 페이로드                                           | 응답                | 설명                                                                                                                                        |
| ----------------- | ------------ | -------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `orca:mcp:list`   | R→M (invoke) | —                                                  | `McpServer[]`       | 전역 MCP 서버 목록 (DTO — 비밀 제외, `hasAuth` 포함).                                                                                       |
| `orca:mcp:add`    | R→M (invoke) | `CreateMcpServerRequest`                           | `McpServer`         | 서버 추가. `name` 유일 + `^[A-Za-z0-9_-]+$`. transport 별 필수 필드 검증.                                                                   |
| `orca:mcp:update` | R→M (invoke) | `UpdateMcpServerRequest` = `{ id } & Partial<...>` | `McpServer \| null` | 부분 수정 (토글 enabled 포함). `auth` 미지정=유지, `''`=제거, 그 외=secret-store 재저장. `authEnvKey` 변경 시 기존 비밀을 새 이름으로 이전. |
| `orca:mcp:delete` | R→M (invoke) | `DeleteMcpServerRequest` = `{ id }`                | `Promise<void>`     | 서버 삭제.                                                                                                                                  |

`McpServer` DTO (`app/src/shared/ipc.ts`):

```typescript
interface McpServer {
  id: string;
  name: string;
  description: string;
  transport: "stdio" | "http";
  enabled: boolean;
  command: string | null; // stdio
  args: string[]; // stdio
  authEnvKey: string | null; // stdio — 인증값을 주입할 env 이름 (비밀 아님)
  url: string | null; // http
  hasAuth: boolean; // 인증 비밀 보유 여부 (raw 값은 main safeStorage 만 접근)
}
```

소스(mcp.json)→SDK 매핑(`toClaudeConfig`, 구조 항등): stdio → `{ command, args, env: { [authEnvKey]: '${authEnvKey}' } }`, http → `{ type:'http', url, headers: { Authorization: 'Bearer ${authEnvKey}' } }`, sse → 그대로 보존(SDK 가 sse 트랜스포트 지원). `${VAR}` 는 query 직전 resolver(safeStorage→process.env)로 확장되며, 미해결 시 해당 서버는 드롭된다.

### 2.11 Runtime — **제거됨 (handoff 0012)**

구 `orca:runtime:{status,prepare,statusEvent}` 3채널은 renderer 소비처(과거 `features/runtime` RuntimeStatus 위젯)가 제거된 뒤 preload 에만 노출된 고아 채널이라 **2026-06-11 제거**됐다. 0050 PR-B 에서 main 내부 `PythonRuntime`/uv 격리 인터프리터도 제거됐다. 현재 chat send 는 orca.json 앱 env 만 SDK `query().options.env` 로 병합한다. 런타임 UI/채널 재도입 시 §6 변경 절차로 새로 추가한다.

### 2.12 Cost (Phase 3++)

일/주/월 비용·토큰 누적 summary. Main 의 `CostTracker` 가 `turn_usage.created_at` 기준 SQL `SUM` 으로 재계산하고, Renderer 는 costStore 미러 + 설정 사용량 UI 에서 참조한다. provider별(0080) 은 `turn_usage ⨝ sessions.provider_key` 로 귀속·집계하고, provider별 월 한도는 `provider_limits` 테이블에 영속한다. 0098부터 provider/gateway API가 제공하는 authoritative usage report는 `provider_usage_report_cache`에 최신값만 저장하며, 로컬 `summary`를 덮어쓰지 않고 도넛·provider 서브탭의 한도/잔량 계산용 `effectiveLimit`에만 반영한다.

| 채널                            | 방향         | 페이로드                                | 응답                   | 설명                                                                                                                       |
| ------------------------------- | ------------ | --------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `orca:cost:summary`             | R→M (invoke) | —                                       | `CostSummary`          | 조회 시 `recompute()` 로 최신 일/주/월 비용·토큰 누적값을 반환한다(설정 사용량 동기화 버튼이 최신값을 받도록, 0080 항목 2). |
| `orca:cost:summaryEvent`        | M→R (send)   | `CostSummary`                           | —                      | telemetry 저장 직후 `CostTracker.recordAndBroadcast()` 가 모든 창에 push 하는 summary 갱신 이벤트.                          |
| `orca:cost:providerSummaries`   | R→M (invoke) | `{ providerKeys: string[] }`            | `ProviderUsageEntry[]` | provider key 마다 로컬 summary + 적용 한도 + 외부 API report 파생 `effectiveLimit`을 묶어 반환한다.                         |
| `orca:cost:refreshProviderUsageReport` | R→M (invoke) | `{ providerKey: string }` | `ProviderUsageEntry` | 정적 provider 모듈의 external usage provider/config를 호출해 authoritative report를 fetch·영속하고 갱신 엔트리를 반환한다. 실패/미지원 시 마지막 cache 또는 로컬 한도로 폴백한다. |
| `orca:cost:setProviderLimit`    | R→M (invoke) | `{ providerKey: string; limitUsd: number \| null }` | `ProviderUsageEntry`   | provider별 월 한도를 upsert 하고 갱신된 엔트리를 반환한다(즉시 반영).                                                       |
| `orca:cost:usageStats`          | R→M (invoke) | `{ range: '7d' \| '30d' \| 'all' }`     | `UsageStats`           | 사용량 요약(0112) — range 하한(since, 로컬 자정 기준) 이후의 일별 토큰/비용 시계열(희소, 오름차순)과 모델별 집계(총 토큰 내림차순)를 한 번에 반환한다. 제로필은 renderer(`shared/usage/stats.ts`) 몫. 실패 정책 = fallback(빈 요약). |

`CostSummary` 타입 (`app/src/shared/ipc.ts`):

```typescript
interface CostPeriodSummary {
  totalCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}
interface CostSummary {
  day: CostPeriodSummary;
  week: CostPeriodSummary;
  month: CostPeriodSummary;
  updatedAt: number;
}
interface UsageQuota {
  limitUsd?: number | null;
  usedUsd?: number;
  remainingUsd?: number | null;
}
interface ExternalUsageReport {
  providerKey: string;
  fetchedAt: number;
  asOf?: number;
  source: 'external';
  scope?: 'provider-account' | 'organization' | 'workspace' | 'project' | 'user' | 'unknown';
  quota?: UsageQuota;
  totals?: Partial<CostPeriodSummary & { costUsd: number }>;
  byModel?: { model: string; totals: Partial<CostPeriodSummary & { costUsd: number }> }[];
}
interface EffectiveUsageLimitView {
  source: 'local' | 'external';
  usedUsd: number;
  limitUsd: number | null;
  remainingUsd: number | null;
  fetchedAt?: number;
  asOf?: number;
  stale?: boolean;
}
interface ProviderUsageEntry {
  providerKey: string;
  summary: CostSummary; // Orca 내부 turn_usage 기준, 외부 report로 덮어쓰지 않음
  limitUsd: number | null; // 적용 한도(외부 report quota.limitUsd 우선, 없으면 provider_limits)
  externalReport?: ExternalUsageReport;
  effectiveLimit: EffectiveUsageLimitView; // 도넛/provider 서브탭 한도·잔량 계산 입력
}
type UsageStatsRange = '7d' | '30d' | 'all';
interface UsageStatsDay {
  day: string; // 'YYYY-MM-DD' (OS 로컬 타임존, SQL date(...,'localtime') 버킷)
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  totalCostUsd: number;
}
interface UsageStatsModel {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  costUsd: number;
}
interface UsageStats {
  range: UsageStatsRange;
  since: number | null; // range 하한(epoch ms, 로컬 자정) — 'all' 은 null
  days: UsageStatsDay[]; // 희소(사용 있던 날만), 오름차순
  models: UsageStatsModel[]; // 총 토큰 내림차순
  updatedAt: number;
}
```


### 2.12-b Concurrency

| 채널                       | 방향       | 페이로드                                      | 응답 | 설명                                                                 |
| -------------------------- | ---------- | --------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `orca:concurrency:event`   | M→R (send) | `ConcurrencyEvent` = `{ projectId; count }`   | —    | 같은 projectId에서 실행 중인 query 수를 브로드캐스트한다. Composer는 자기 inflight를 차감해 경고 표시 여부를 판정한다. |

### 2.12-c Notify

| 채널               | 방향         | 페이로드                              | 응답            | 설명                                                                                                                                                              |
| ------------------ | ------------ | ------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orca:notify:show` | R→M (invoke) | `NotifyShow` = `{ title; body }`      | `Promise<void>` | OS 네이티브 알림(응답완료 등). main 이 요청 창의 포커스 여부로 표시를 게이트한다(**창 비활성일 때만**). 렌더러는 설정 토글 `notifyOnComplete` 만 확인해 요청한다. |

### 2.13 Debug (dev 전용 — MockAdapter 하네스)

LLM API 없이 renderer 의 스트리밍·사고 블록·도구 카드·권한 승인 카드·에러·컨텍스트 도넛을 라이브 디버깅하기 위한 **dev 전용** 채널. main 의 `MockAdapter`(`adapters/mock.ts`, `id='claude'` 위장)가 라우터의 권한 합성·DB 영속화·IPC 송신 경로를 실트래픽과 동형으로 타며, renderer 의 `features/debug` 패널(`FloatingPanel`)이 단일 호출자다.

> **prod 안전성**: `debug` 도메인은 `import.meta.env.DEV` 게이트 안에서만 `ipcMain.handle` 로 등록되고 MockAdapter 도 그때만 인스턴스화된다(빌드타임 상수라 prod 번들에서 dead-code 제거 — `out/main` 에 핸들러 등록 코드 부재, `out/renderer` 에 DebugPanel 미포함). preload 는 `window.orca.debug` 를 상시 노출하나, prod 에선 main 핸들러가 없어 invoke 가 무효다. mock 모드 상태(`debugMock`)는 **비영속** — 재시작 시 OFF.

| 채널                 | 방향         | 페이로드                                                                                       | 응답                                                                                             | 설명                                                                                                                           |
| -------------------- | ------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `orca:debug:getMock` | R→M (invoke) | —                                                                                              | `DebugMockState` = `{ enabled: boolean; scenarioId: MockScenarioId; contextUsageRatio: number; log: boolean }` | 현재 mock 상태 1회 조회 (패널 마운트 시 동기화). `log`(구 `wireLog`, 0025→0124 개편) = **"로그" 스위치 통합 게이트** — ON 이면 outbound `NormalizedEvent`(델타 2종 제외)를 로거 debug `ipc.wire.event` 로 기록하고 모든 로그 레코드를 main 콘솔에 미러한다. |
| `orca:debug:setMock` | R→M (invoke) | `Partial<DebugMockState>` (`DebugMockPatchSchema` — 네 필드 optional, `contextUsageRatio` 0~1) | `DebugMockState`                                                                                 | mock 상태 부분 패치 후 병합된 전체 반환. `enabled` 토글 시 `handleChatSend` 의 어댑터 선택이 MockAdapter ↔ 활성 어댑터로 분기. |

`MockScenarioId` 13종 (`app/src/shared/ipc.ts` `MOCK_SCENARIO_IDS`): `text_streaming` · `reasoning` · `tool_calls` · `tool_approval` · `ask_question` · `plan_review` · `subagent_task` · `subagent_task_child` · `subagent_task_aborted` · `subagent_task_multi` · `subagent_task_running` · `error` · `full`. `full` 은 text/reasoning/tool_calls/tool_approval/ask_question/plan_review 를 순차 재생한 뒤 도구호출→error 점프로 종료한다(권한 2종은 approval 스텝이 라우터를 경유해 합성). 시나리오 telemetry 는 `costUsd: 0`·`model: 'mock-sonnet'`, 컨텍스트 토큰 합 = `round(contextUsageRatio × 200_000)` 로 도넛/`nearCompaction` 경고를 구동.

### 2.13-b Log (0123 — 로그 인제스트)

renderer/preload 발 구조화 로그를 main 의 중앙 LogManager 로 전달하는 **유일한 R→M one-way send** 채널. 로깅 정본(스키마·레벨 정책·redaction·파일 위치)은 [arch/backend/observability.md](arch/backend/observability.md).

| 채널            | 방향       | 페이로드                                                                       | 응답 | 설명                                                                                                                                                                                                             |
| --------------- | ---------- | ------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orca:log:emit` | R→M (send) | `LogInput` = `{ level; event; scope; message?; correlationId?; data?; error? }` | —    | fire-and-forget 로그 전송. main 이 `LogInputSchema` + payload 32KB 상한으로 검증, 실패는 **폐기 + `ipc.payload.rejected` warn 집계**(reject 응답 없음). 공통 필드(`timestamp`·`process`·`appVersion`·`sessionId`·`windowId`)는 **main 이 강제 부여** — renderer 가 보내면 strict 스키마가 거부한다(위조 방지). |

### 2.13-c Auth (0157 — 인증 플랫폼. 구 `sso` 3채널 대체)

앱 로그인(`application`)과 서비스 연결(`connector`)을 **같은 lifecycle** 로 처리하는 채널. 둘의 차이는 `AuthTarget.kind` 뿐이고 별도 인증 인터페이스가 없다. 등록된 auth provider 가 0개(기본 배포)면 `required:false` 로 게이트가 자동 통과된다. **`status`/`begin`/`continue` 핸들러는 `Bootstrap.start()` 최상단에서 조기 등록**된다 — 창이 start() 완료 전에 열리므로(0109) renderer 게이트의 첫 invoke 가 부팅 완료를 기다리지 않는다.

계약 정본은 `app/src/main/contracts/auth-plugin.ts`, provider 등록은 `features/auth-platform/modules/` opt-in 레지스트리, 배포 가이드는 [guides/closed-network-extensions.md](guides/closed-network-extensions.md).

> **응답 DTO 에 raw secret 이 없다.** `AuthBindingInfo.artifact` 는 `handleId` 문자열만 갖고(브라우저 세션의 cookie jar·vault 의 값은 main 이 소유), provider 목록은 `allowedOrigins` 조차 내보내지 않는다. 앱 로그인은 **UX 게이트이지 보안 경계가 아니다** — 인증 전에도 main IPC 는 열려 있다(guides/closed-network-extensions.md §5).

| 채널                   | 방향         | 페이로드                                            | 응답/스트림 | 설명 |
| ---------------------- | ------------ | --------------------------------------------------- | ----------- | ---- |
| `orca:auth:status`     | R→M (invoke) | —                                                   | `AuthPlatformState` = `{ required; authenticated; inflight; identity: AuthPrincipal \| null; errorMessage: string \| null; step: AuthStepInfo \| null; providers: AuthProviderInfo[] }` | 게이트 판정용 상태 1회 조회. `required` = `application` target 을 지원하는 provider 등록 여부. **`authenticated` 는 앱 로그인 binding 이 하나 이상이고 전부 `valid` 일 때만 true** — 한 패키지가 application provider 를 여럿 선언하면 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다(0172). renderer 는 prod 에서 invoke 실패를 `required:false` 로 기본화하지 않는다(재시도 후 fail-closed). |
| `orca:auth:providers`  | R→M (invoke) | —                                                   | `AuthProviderInfo[]` | 등록 provider descriptor(라벨·targets·mechanisms·capabilities·sessionGroup). `allowedOrigins` 는 노출하지 않는다. |
| `orca:auth:bindings`   | R→M (invoke) | —                                                   | `AuthBindingInfo[]` | binding 목록(대상·상태·만료·principal). secret 없음. |
| `orca:auth:begin`      | R→M (invoke) | `{ providerId; target }` (`AuthBeginRequestSchema`) | `AuthStepInfo` | 인증 transaction 시작 → 다음 step(`collect`·`browser`·`device_code`·`done`·`failed`). `(providerId, target)` 당 1건이며 재진입 시 기존 transaction 을 **명시 취소**하고 교체한다(조용한 덮어쓰기 없음). **앱 로그인(`target.kind='application'`)은 그 provider 가 속한 패키지의 체인 전체를 실행한다**(0172) — 어느 멤버로 시작하든 manifest 선언 순서의 헤드부터 돈다. |
| `orca:auth:continue`   | R→M (invoke) | `{ transactionId; input: Record<string,string> }` (`AuthContinueRequestSchema` — 키 64자·값 4096자 상한) | `AuthStepInfo` | 입력이 필요한 step 을 잇는다. 브라우저 플로우(ADFS/WIA)는 `begin` 안에서 끝나 이 채널을 쓰지 않는다. 만료·취소된 transaction 은 `failed(reason:'cancelled')`. **체인 중간 멤버의 성공은 `done` 이 아니라 다음 멤버의 step 으로 나온다** — `done` 은 전 멤버가 성공했을 때만 오고 그 `binding` 은 체인의 root 다. 대화형 step 3종은 멤버가 둘 이상일 때 `chain: { index(1-based); total; label }` 을 함께 싣는다(멤버 1개면 필드 없음, 0172). |
| `orca:auth:refresh`    | R→M (invoke) | `{ bindingId }` (`AuthBindingRequestSchema`)        | `AuthRefreshOutcome` | 자동 갱신. static credential 처럼 갱신 개념이 없는 provider 는 `not_supported` 를 반환한다(메서드 부재 아님). |
| `orca:auth:logout`     | R→M (invoke) | `{ bindingId; cascade?: boolean }` (`AuthLogoutRequestSchema`, 기본 `false`) | `AuthLogoutOutcome` | `cascade:false`(기본) = 이 binding 만 — connector 하나의 연결 해제가 공유 session group 을 삭제하지 않는다. `true` = 종속 binding 까지(앱 로그아웃). |
| `orca:auth:stateEvent` | M→R (send)   | `AuthPlatformState`                                 | —           | 상태 변화 브로드캐스트(전 창) — transaction 진행·취소·binding 변경. renderer store 가 구독해 main 상태를 미러한다. |

### 2.13-d Plugin (0158 connector lifecycle + 0161 템플릿·인스턴스)

connector의 목록·연결 lifecycle과, 사용자가 서버를 추가/삭제하는 경로를 renderer에 노출한다.

connector는 두 출처를 갖는다 — **`static`**(코드로 배포, `modules/<x>/servers.ts`)과 **`instance`**(사용자가 템플릿으로 추가). DTO의 `source`가 그 구분이고 UI는 이 값으로 삭제 가능 여부를 판정한다. connector당 활성 연결은 하나다.

응답 DTO는 `connectorId`·`label`·`origin`·`pluginId`·`acceptedAuthProviders`·`connected`·`source`·`connectedProviderId?`만 포함하며 credential·binding artifact·runtime tool 구현은 포함하지 않는다. `connectedProviderId`(0164)는 활성 binding 의 **auth provider id** 이고 **키 부재 = 미연결**이다 — 화면이 "무엇으로 연결됐는지"를 보여주기 위한 값이라 id 만 나가고 secret·vault handle 은 이 경계를 넘지 않는다.

**주소 수정 채널은 없다.** 인스턴스의 `connectorId`가 host+컨텍스트 경로에서 파생되므로(0161) 주소 수정은 곧 도구 서버 ID·승인 키(`mcp__<server>__<tool>`)·다운로드 경로의 이동이다. 수정 대신 삭제 후 재생성한다.

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
| --- | --- | --- | --- | --- |
| `orca:plugin:list` | R→M (invoke) | — | `PluginConnectorInfo[]` | 등록된 connector와 연결 상태의 안전 DTO 목록(정적 + 사용자 인스턴스). |
| `orca:plugin:connectionConnect` | R→M (invoke) | `{ connectorId; bindingId }` (`PluginConnectionConnectRequestSchema`) | `void` | 유효한 connector binding으로 연결을 시작하고 runtime tool 서버를 등록한다. 같은 connector의 활성/pending 연결은 거부한다. |
| `orca:plugin:connectionDisconnect` | R→M (invoke) | `{ connectorId }` (`PluginConnectionDisconnectRequestSchema`) | `AuthLogoutOutcome` | connector 연결을 해제하고 해당 runtime tool 서버를 회수한다. |
| `orca:plugin:templateList` | R→M (invoke) | — | `ConnectorTemplateInfoDto[]` | 사용자가 추가할 수 있는 connector 청사진 목록(현재 Confluence 1종). 각 템플릿은 입력 필드 선언(`label`·`baseUrl`·`apiBasePath`)을 갖고 renderer가 그것으로 폼을 그린다. |
| `orca:plugin:instanceCreate` | R→M (invoke) | `{ templateId; label; baseUrl; apiBasePath? }` (`PluginInstanceCreateRequestSchema`) | `PluginConnectorInfo[]` | 인스턴스를 영속 저장하고 런타임 등록한 뒤 **갱신된 목록**을 반환한다. `baseUrl`은 경로·쿼리·자격증명·비 http(s)를 거부하는 origin이어야 한다. 같은 host+경로 중복은 `already_exists`로 거부. |
| `orca:plugin:instanceDelete` | R→M (invoke) | `{ connectorId }` (`PluginInstanceDeleteRequestSchema`) | `PluginConnectorInfo[]` | 연결 해제 → 등록 해제 → 저장소 제거 순으로 지우고 갱신된 목록을 반환한다. 정적 connector는 `not_found`로 거부된다(코드로 배포된 서버는 UI에서 지울 수 없다). |
| `orca:plugin:diagnostics` | R→M (invoke) | — | `PluginDiagnostic[]` (`PluginDiagnosticSchema`) | 부팅 등록에서 **거부된** 패키지·인스턴스·참조(0164). 등록은 패키지 단위 all-or-nothing이라 `baseUrl` 하나가 경로를 달고 있으면 그 패키지의 provider·connector가 전부 사라지는데, 사유가 warn 로그뿐이면 화면에는 아무 흔적이 없다. `kind`·`subject`·`message`만 나가고 manifest 원문·credential은 이 경계를 넘지 않는다. |

### 2.14 예약 / 미노출 채널

코드에 채널 상수는 없지만 향후 도입이 예약된 도메인:

| 도메인                                   | 도입 시점                 | 채택 결정                                                                        |
| ---------------------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `backend:select`                         | opencode 어댑터 활성화 시 | 단일 백엔드라 현재 미노출                                                        |
| `message:*` (개별 append / delete 등)    | **Future**                | 현재는 chat 턴 단위로 main 이 일괄 persist — 개별 메시지 조작 API 필요 시 도입   |
| `credentials:set` / `credentials:hasKey` | **Phase 3+**              | safeStorage 자격증명 저장 ([arch/backend/security.md](arch/backend/security.md)) |
| `skills:reload`                          | **Future**                | 핫리로드 도입 시                                                                 |
| `routines:*`                             | **Future**                | Sidebar nav 의 `/routines` placeholder 가 활성 페이지로 승격될 때                |

## 3. NormalizedEvent variant 정의

> **표준화 스테이지 B (provider-runtime.md §2)**: `orca:chat:event` 의 와이어 타입은 provider 중립 **`NormalizedEvent`** 다. 이벤트는 `sessionId` 로 키잉되고, tool 은 `toolRunId` 로 start/complete 를 매칭한다. **코어 중립(handoff 0016): 이벤트는 `provider` 필드를 싣지 않는다** — 어떤 소비자도 읽지 않는 write-only 메타였고 `session.backend`(0010 세션-어댑터 잠금)와 중복된 이중 진실원이라 제거했다. "어느 백엔드인지" 는 `sessionId` → `session.backend` 로 파생한다. claude 어댑터는 SDK 메시지를 `claudeToNormalized`(`adapters/claude-map.ts`)로 이 타입에 **직접** 정규화한다(구 `ChatEvent` 중간표현은 제거됨). `app/src/shared/ipc.ts` 의 `NormalizedEvent` union 이 정본. 취소는 에러가 아니므로 `turn.aborted` 로 분리하고, 무응답 idle timeout 은 재시도 가능한 `error(stream_error)` 로 발행한다.

| `type`                    | 필드(공통: `sessionId`)                                                                                   | 발생 시점                                                                                      | Renderer 처리 (`chatReducer.ts`)                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session.updated`         | `patch: { model?; cwd? }`                                                                                 | 어댑터의 첫 메시지 (SDK `SDKSystemMessage.init`)                                               | `state.sessionId` 저장, `state.cwd` 갱신                                                                                                                               |
| `message.queued`          | `id; text; attachmentViews?; createdAt` (`sessionId` optional — 새 세션 send 는 미확정) | 사용자 프롬프트가 pending message queue 에 접수됨(0067 — 일반 send·busy 예약·handoff 자동 메시지 공통) | pending user 버블(연회색/기울임) 표시 — renderer 낙관 항목과 `id` 로 합류(idempotent upsert). sessionId 없으면 `clientKey`/`pendingNewChatKey` draft 라우팅 |
| `input.echo`              | `text; uuid?` | CLI 가 stdin 주입 입력을 흡수해 user 메시지로 echo(`SDKUserMessageReplay`)한 순간 — pending 소비 확정의 정밀 신호(0060 D1) | **main 내부 전용 — renderer 로 forward 되지 않는다.** TurnCoordinator 가 uuid(1차)/text(폴백) 매칭으로 pending 을 소비 표시하고 스트림에서 흡수 |
| `message.committed`       | `ids; text; attachmentViews?; messageId; createdAt` | echo 로 소비 확정된 pending 배치를 user 메시지로 영속한 직후(**유일한 user 커밋 경로**, 0067 AC6 — 턴 프롬프트·이월 프렐류드·steer 게이트 배치 공통. 배치 단위 = 게이트 병합 1버블/프롬프트 아이템 1버블) | pending 제거 + 정식 user 버블 승격(`APPEND_COMMITTED_USER_MESSAGE`, 첨부 파트 포함) |
| `message.submitted`       | `ids; submitted: boolean` | pending 버블의 **소유권 전이**(0151) — `true`=stdin 주입 완료(취소 불가), `false`=예약 롤백(닫힌 입력 스트림 등 → 다시 취소 가능). **transient·relay-only**(버스 미경유 = history/usage 미소비·미영속, `message.queued` 동렬) | `pendingSteer[].submitted` 토글 — `true` 면 취소 버튼을 감추고 `data-state="submitted-steer"` + '전달됨' 표기, `false` 면 취소 버튼 복귀 |
| `message.cancelled`       | `ids` | held pending 취소 확정 — 단건(hover) 또는 전량(중단 버튼, held 만) | pending 제거. 잔존해 있던 항목(=중단 버튼 경로)의 텍스트는 composer draft 로 복원(편집 가능) — hover 취소는 이미 낙관 제거돼 no-op |
| `session.compacted`       | `trigger?: 'manual' \| 'auto'; preTokens?; postTokens?` | SDK `system/compact_boundary`(네이티브 압축 완료) 정규화(0064). `postTokens`(compact_metadata.post_tokens, SDK optional) = 압축 후 컨텍스트 실측 — 구분선 "pre → post 토큰" 표기 + compact 턴 telemetry 컨텍스트 근사의 1순위 참조(0065 r2, 부재 시 요약 크기=modelUsage 출력 합 폴백) | `compact_boundary` 파트로 커밋 → transcript 압축 경계 구분선(`CompactBoundaryMarker`). main persist 도 같은 파트를 영속해 재로드 복원 |
| `message.delta`           | `delta: { text }`                                                                                         | LLM 스트리밍 (SDK `text_delta`)                                                                | chat store `live.text += text` (0008 — reducer 미경유 transient)                                                                                                       |
| `message.completed`       | `message: { text }; parentToolRunId?`                                                                     | LLM 턴 종료 (SDK `SDKAssistantMessage` text block)                                             | 현재 assistant 메시지에 `text` 파트 append, `live.text` 비움. `parentToolRunId` 가 있으면 서브에이전트 child 답변 — 메인 transcript/preview 제외, child transcript 에만 표시 |
| `message.reasoning`       | `text; signature?`                                                                                        | 확장사고 블록 (SDK `SDKAssistantMessage` thinking block)                                       | 현재 assistant 메시지에 `reasoning` 파트 append (signature 는 opaque 보관) + `live.reasoning` 비움                                                                     |
| `message.reasoning.delta` | `delta: { text }`                                                                                         | 확장사고 라이브 (SDK `thinking_delta`)                                                         | chat store `live.reasoning += text` (transient, 미저장). `message.delta` 와 동형 — 런타임 미수신 시 발생 안 함                                                         |
| `tool.call.started`       | `toolRunId; toolName; args; parentToolRunId?`                                                                               | LLM 도구 호출 (SDK `tool_use` block)                                                           | 현재 assistant 메시지에 `tool_call` 파트 append. `parentToolRunId` 가 있으면 부모 Task 의 child transcript 로 분기                                                                                                                        |
| `tool.call.completed`     | `toolRunId; result; isError; durationMs?; parentToolRunId?; subagentMeta?`                                                                 | 도구 실행 완료 (SDK `tool_result` block)                                                       | `tool_result` 파트 append (`toolRunId` 로 `tool_call` 과 페어링). `parentToolRunId` 가 있으면 child transcript 에만 표시. 부모 Task tool_result 면 `subagentMeta`(`{model?,durationMs?,toolUses?}`, claude-map 이 task_*/child model 누산)를 실어 영속 — 세션 재로드 후 카드/행 모델·소요시간 복원                                                                                                       |
| `subagent.task`           | `toolUseId; phase:'started'\|'progress'\|'settled'; taskId?; subagentType?; description?; model?; durationMs?; toolUses?; lastToolName?; status?; summary?; background?` | 서브에이전트(Task) 라이브 메타 (SDK `task_started`/`task_progress`/`task_notification` + child assistant `message.model`). `background?: true`(0143) = settled 한정 — async_launched 영수증이 관측된(실제 백그라운드 실행) 태스크의 정착에만 main(coordinator)이 부여 | chat store 가 `toolUseId` 키 transient 맵(`subagentMeta`)으로 흡수해 우측 패널·`AgentTaskRow` 표시를 구동(메인 transcript 파트 비오염). **단 settled+`background:true`(0143)는 reducer 로도 흘러 `subagent_notice` 파트(완료 통지 블록 — main writer 도 동형 영속, toolRunId 멱등)를 커밋한다.** `taskId` 는 `orca:chat:stopSubagent` 의 stop 대상. 메타 영속은 부모 Task `tool.call.completed.subagentMeta` 가 담당 |
| `chat.activity`           | `sessionId; revision; foreground:'idle'\|'preparing'\|'streaming'; transport:'idle'\|'listening'; queuedCount; deliveryPendingCount; residualCount; backgroundTaskCount` | **0167 단일 활동 스냅샷** — lease·pending queue·background tracker·턴-후 transport에서 전체를 재계산한다. 의미가 달라질 때만 세션별 단조 `revision`으로 모든 살아 있는 renderer에 broadcast하며 `chat.listen`/`chat.residual` legacy variant를 대체한다. count는 병합 배치 수가 아니라 고유 사용자 메시지 수다. | 낮거나 같은 revision은 무시한다. **`listening` 은 `transport` 에서만 파생한다** — 잔여·큐 개수를 섞으면 0154 가 의도적으로 남기는 예약 하나로 대기 표시가 영구 고착된다. foreground 는 라벨 전용이고 턴 시작/종료(`inflight`)는 renderer 소유다. count 는 무엇을 기다리는지 설명하는 표시용 사실이다. `residualCount>0`이면 상태 서술형 Notice와 명시적 '세션 전체 중단' 탈출구를 제공한다. |
| `telemetry`               | `usage?: ProviderReportedTelemetry` (model·input/output·캐시 토큰·costUsd·durationMs·numTurns·modelUsage·contextWindow) | 어댑터 턴 종료 (SDK `SDKResultMessage`, 또는 터미널 이벤트 누락 시 폴백)                         | `inflight = false`, `lastTelemetry`·`sessionCostUsd`(누산) 갱신 → 컨텍스트 도넛/TelemetryPanel. `contextWindow`(0134) = SDK `modelUsage[].contextWindow` 실측 — renderer 도넛 분모 1차 소스(`contextWindowOf`), 부재 시(재로드 복원 등) 모델명 휴리스틱 폴백                                                                         |
| `turn.retrying`           | `attempt; maxRetries; error: ClassifiedError` (`sessionId?`)                                              | 어댑터 catch 후 retryable error 를 재시도하기 직전                                              | `inflight` 유지, PendingAssistant 에 `재시도 N/M` 표시. 다음 이벤트/터미널 이벤트에서 표시 해제                                                                        |
| `error`                   | `error: ClassifiedError` (`sessionId?`)                                                                  | 어댑터 catch 또는 SDK 에러, idle timeout(`stream_error`, retryable)                            | `state.error` 설정, `inflight = false`                                                                                                                                 |
| `turn.aborted`            | `reason: 'user_cancelled' \| 'timeout'` (`sessionId?`)                                             | `chat:cancel` 에 대한 main 권위 ack. 현재 timeout 은 `error(stream_error)` 로 발행             | 에러 없이 `inflight = false`, 보류 승인 카드 정리, 해당 `sessionId` 세션만 종료                                                                                         |
| `permission.requested`    | `approvalId; origin; action: PermissionAction`                                                            | AskUserQuestion·ExitPlanMode·**위험 도구 게이트**(canUseTool)                                  | `action.kind` 로 분기 → `pendingAsks` / `pendingPlanReview` / `pendingToolApproval`. 응답은 단일 `permissionRespond`(`{approvalId, resolution}`, approvalId=requestId) |
| `permission.resolved`     | `approvalId; resolution: ApprovalResolution`                                                              | 라우터 `requestApproval` 클로저가 broker 해소 직후 발행(mock/실경로 공통 — audit/telemetry 용) | no-op(카드는 respond 시 로컬 RESOLVE\_\* 로 닫힘)                                                                                                                      |

`PermissionAction` = `{kind:'ask_question', request} | {kind:'plan_review', request} | {kind:'tool_approval', toolName, input}`. `ApprovalResolution` = `{behavior:'allow', updatedInput?, updatedPermissions?} | {behavior:'deny', message?, interrupt?, planFeedback?}` (claude `PermissionResult` 와 동형 + 앱 레벨 세션 권한 `updatedPermissions:[{toolName, scope:'session'}]`). `deny.planFeedback` = `{comments:[{id,quote,start,end,body}], note?}` — 계획(plan_review) 패널 인라인 코멘트를 담아 보내면 어댑터가 구조화 태그(`ORCA_PLAN_FEEDBACK`, `prompts/plan-feedback.ts`)로 직렬화해 ExitPlanMode deny message 로 전달한다(handoff 0047, 채널 수 불변·페이로드 확장).

**권한 응답 채널 단일화.** ask/plan/tool 세 종류의 승인 응답은 모두 단일 `permissionRespond`(`orca:permission:respond`, renderer→main invoke) 채널로 흐른다(구 `askRespond`/`planRespond` 2채널 통합). 페이로드 = `{approvalId, resolution: ApprovalResolution}`. main(`InteractionBroker<ApprovalResolution>`)이 `approvalId` 로 보류 중인 `canUseTool` Promise 를 해소한다. 부수효과: ① `allow.updatedPermissions{scope:'session'}` → 해당 세션의 자동 허용 도구 집합 갱신(같은 세션 이후 턴 카드 미surface), ② `deny.interrupt` → 해당 턴 abort(plan reject). **위험 도구 게이트**: `makeCanUseTool` 이 화이트리스트(`Bash`·`Write`·`Edit`·`MultiEdit`·`NotebookEdit`, `permission-bridge.ts` 의 `RISKY_TOOLS`)에 든 도구만 `tool_approval` 로 surface 하고, 안전 도구는 자동 통과한다.

**권한 모드 라이브 전환 (PR③).** `permissionSetMode`(`orca:permission:setMode`, renderer→main invoke). 페이로드 = `{sessionId, mode: NormalizedPermissionMode}`(정규화 6종 — `default`·`accept_edits`·`plan`·`dont_ask`·`bypass`·`auto_classified`). main 은 두 경로로 적용한다: ① `PermissionModeController`(세션 SSOT) 갱신 → 다음 턴 send 페이로드에 반영, ② 같은 세션의 진행 중 턴이 있으면 그 턴의 라이브 핸들로 즉시 `Query.setPermissionMode`(`toClaudePermissionMode` 변환) — 그 턴의 이후 도구부터 적용. 턴-스코프 스트리밍 입력(`prompt: AsyncIterable<SDKUserMessage>`)에서만 control 메서드가 열린다(resume-from-DB 모델 유지). 위험 모드(`bypass`·`dont_ask`)는 렌더러 `ModeMenu` 가 2-스텝 확인으로 가드한다.

## 4. 에러 분류 (ErrorCategory)

`orca:chat:event` 의 `error` 이벤트는 `ClassifiedError` = `{ category; message; retryable; provider?; cause? }` 를 싣는다 (`app/src/shared/ipc.ts` `ErrorCategory` 8종 — provider-runtime.md §6 정본). 구 `ErrorCode`(`sdk.*`/`cli.*`) 모델은 표준화 리팩토링(PR #47)에서 폐기됐다. **코어 중립(0016): `provider` 는 optional(표시용)** — 어댑터 컨텍스트가 있을 때만 분류기가 채우고, 세션-이전 오케스트레이션 에러(스키마 검증 실패·활성 백엔드 없음)는 provider 부재로 발행한다.

| category                    | 의미                                                                      | 발생 위치               | retryable 기본 |
| --------------------------- | ------------------------------------------------------------------------- | ----------------------- | -------------- |
| `provider_connection_error` | 백엔드 바이너리 부재 · 서버 다운 · 활성 백엔드 없음 · 같은 세션 중복 send | 어댑터 부팅 · chat send | true           |
| `auth_error`                | API key 무효/만료 (재로그인 모달 분기 — AuthExpiredModal)                 | claude 어댑터           | false          |
| `permission_denied`         | 사용자 deny / policy deny                                                 | 권한 게이트             | false          |
| `tool_execution_error`      | shell exit≠0 · 파일 read 실패                                             | 도구 실행               | false          |
| `stream_error`              | SSE 끊김 · iterator 오류                                                  | 어댑터 스트림           | true           |
| `capability_unsupported`    | 백엔드 미지원 기능 호출                                                   | capability 가드         | false          |
| `schema_validation_error`   | structured output / IPC payload 검증 실패                                 | chat send 서두 등       | false          |
| `user_cancelled`            | abort/interrupt — 정상 종료 (emit 안 함, 분류만)                          | —                       | false          |

## 5. 타입 정의 위치

| 파일                         | 역할                                               | import 가능한 곳                                  |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `app/src/shared/ipc.ts`      | 순수 TS 타입 + `CHANNELS` 상수. **zod 의존 없음.** | main / preload / renderer 모두                    |
| `app/src/shared/protocol.ts` | zod 런타임 스키마 (`SendChatMessageSchema` 등)     | **main 전용** (renderer/preload 에서 import 금지) |

**충돌 시 코드 우선** — 이 문서는 사람과 AI agent 를 위한 요약이며, 타입과 어긋날 경우 코드가 진실의 기준.

## 6. 변경 절차

채널을 추가·변경할 때 다음 순서를 따른다:

1. `app/src/shared/ipc.ts` — 채널 상수 + 타입 정의 추가/변경. `NormalizedEvent`/`AppMessagePart` 필드 변경도 이 단계에 포함
2. `app/src/shared/protocol.ts` — zod 스키마 추가 (요청 검증 필요 시)
3. `app/src/main/app/handlers/<domain>.ts`(또는 chat 계열이면 `app/chat-turn.ts`) — `handle(channel, schema, invalid, fn)` 또는 `handlePlain` 으로 등록(실패 정책 명시). 새 도메인이면 파일 신설 후 `Bootstrap.register()` 에서 호출
4. `app/src/preload/index.ts` — `window.orca.<domain>.<action>` 노출 추가
5. Renderer 사용처 (`app/src/renderer/src/shared/api/ipc.ts`, feature provider/hook 또는 컴포넌트)
6. **이 문서 §2 의 표 갱신** (도메인 추가 시 §2.x 신설, 총 채널 수/도메인별 분포도 동시 갱신)
7. 영향 받는 FRONTEND/BACKEND 문서 anchor 업데이트
8. PR 설명에 IPC 변경 사항 명시

## 7. 보안 / 제약

- preload 는 명시된 채널만 노출. `ipcRenderer` 직접 노출 금지.
- Renderer 에서 채널 이름 문자열 하드코딩 금지 — `window.orca.*` 만 사용.
- 모든 invoke 핸들러는 `try/catch` + 직렬화 가능한 에러 (`{ code, message, recoverable }`) 반환.
- 민감 정보 (자격증명·파일 전체 경로 등) 는 로그에 마스킹.
