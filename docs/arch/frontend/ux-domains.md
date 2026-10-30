# Frontend Architecture — UX & Domains (UX 패턴·ApprovalCard·도메인·IPC 호출)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [rendering.md](./rendering.md), [../backend/provider-runtime.md](../backend/provider-runtime.md), [../../IPC_CONTRACT.md](../../IPC_CONTRACT.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. UX 패턴

### 1.1 키보드 단축키

| 단축키        | 동작                                         | 구현 위치                                        |
| ------------- | -------------------------------------------- | ------------------------------------------------ |
| `/`           | Composer 에서 Skill 자동완성 dropdown 트리거 | `SkillAutocomplete.tsx`                          |
| `@`           | Composer 에서 Plugin 식별자와 파일 경로 자동완성 트리거 — 루트 plain 입력은 경로 그룹을 먼저, Plugin 그룹을 마지막에 표시 | `MentionAutocomplete.tsx`·`useMentionAutocomplete.ts` |
| ↑ / ↓         | 자동완성 dropdown 내 navigate                | 동일                                             |
| Tab / Enter   | 자동완성 항목 선택                           | 동일                                             |
| Esc           | 자동완성 dismiss                             | `composer/autocompleteKeys.ts` — 스트리밍 취소 키는 없다(중단 버튼) |
| Enter         | 메시지 전송                                  | `features/chat/components/ChatTile.tsx` Composer |
| Shift + Enter | 줄바꿈                                       | 동일                                             |

> 그 외 단축키 (Cmd/Ctrl+N 새 대화 등) 는 **현재 미구현**. PRD §11 OQ 추가 후보.

### 1.2 입력창 (Composer)

`features/chat/components/ChatTile.tsx` 의 Composer 섹션 + `features/chat/components/composer/` 부속:

- 멀티라인 textarea + 자동 높이 조절
- 컨트롤 행: `+` 메뉴(아래) · 권한 모드 칩 · 모델 칩 · 사용량 도넛 — Skill 선택은 `+` 메뉴의 계단식 하위 항목이다(구 Popover picker 는 0259 에서 대체)
- `+` 메뉴는 파일 또는 사진 추가 / 스킬 ▸ / 플러그인 ▸이다. 스킬·플러그인 패널은 출처 제목과 로고 아래 항목을 직접 나열한다. 스킬은 현재 하네스·해당 native plugin·Orcinus orca·lock에 등록된 `~/.agents/skills`만 표시하며 설명은 툴팁에 둔다. 두 패널 모두 Orcinus orca 그룹이 첫 그룹이다. 플러그인은 연결된 native/Orca MCP와 인증이 유효한 Orca 플러그인 이름만 표시한다. native 명령은 초안 앞에, Orca 스킬·플러그인 토큰과 MCP 사용 요청은 커서에 삽입하며 자동 전송하지 않는다. 틀 = `shared/ui/CascadeMenu.tsx`, 트리 = `lib/attachMenuModel.ts`. 재개 연결 이벤트와 메뉴 재열기에서 갱신하고 같은 프로세스의 관측은 navigation·부분 실패 동안 유지한다. 갱신 안내·부분 실패 토스트는 표시하지 않는다.
- `/` 자동완성 후보는 출처 라벨 섹션으로 묶이고, `/`·`@` 헤더는 `AutocompleteSectionHeader` 하나를 쓴다
- `/skillname` 토큰을 **활성 스킬일 때만** 파란 chip 으로 mirror overlay 강조 (`composer/ComposerDecorationLayer.tsx` + `composer/composerDecoration.ts`, `knownSkillNames: ReadonlySet<string>`)
- `@filepath` 자동완성: 디렉토리 단계별 진입, quoted/plain 자동 감지, 공백 시 자동 wrapping
- `@plugin-id` 자동완성: main이 Plugin source에만 싣는 cached `tools`가 있는 내장 Plugin을 인증 상태와 무관하게 식별자 토큰으로 노출한다. `catalog`는 gate·harness·plugin·usage 공용 표시 입력이며 후보 판별과 분리한다. 팝업은 path/Plugin 그룹을 분리해 path를 먼저 보이고, 선택 시 label이 아닌 id를 Composer에 삽입하며, 검증된 Plugin id는 violet chip으로 mirror overlay 강조한다 (`pluginMention.ts`·`mentionAutocomplete.ts`).
- 입력을 모두 지워 token이 사라지면 해당 occurrence의 dismissal과 active index를 끝낸다. 같은 Composer에서 다시 `@`를 입력하면 팝업이 다시 열린다 (`useTokenAutocompleteState.ts`).
- 플러그인 상세 상단 인증 액션은 미인증이면 검정 `인증`, 인증 이력이 있으면 `재인증` dropdown으로 표시하고 메뉴 안에 재인증과 빨간 `연결 해제`를 둔다 (`ProviderAuthActions.tsx`).
- 전송 후 입력창 비우기, 포커스 유지

### 1.3 로딩 / 에러 / 네트워크 상태

| 상태                       | UI 표시                                                                                                                             | 위치                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 요청 대기                  | StatusLine "Thinking... (Ns · ~Mtokens)"                                                                                            | `features/chat/components/StatusLine.tsx` (0093 에서 shared/ui 로부터 이동) |
| 스트리밍 중                | StatusLine + 응답 메시지에 누적 텍스트                                                                                              | `features/chat/components/ChatTile.tsx`                 |
| 에러 (`retryable: true`)   | 메시지 영역에 에러 카드                                                                                                             | `features/chat/reducer/chatReducer.ts` 의 `state.error` |
| 에러 (`auth.expired`)      | AuthExpiredModal (`claude /login` 안내) — `#app-frame-modal` 슬롯, backdrop 은 `#app-frame-overlay` 가 담당 (dom-architecture.md.5) | `features/backend/harnesses/claude/components/AuthExpiredModal.tsx`      |
| CLI 설치 진행              | InstallerDialog (라인별 로그 + 수동 명령 복사) — 동일하게 `#app-frame-modal` + `#app-frame-overlay` backdrop                        | `features/backend/harnesses/claude/components/InstallerDialog.tsx`       |
| 네트워크 단절              | TBD (전역 배너 미구현)                                                                                                              | —                                                       |

### 1.3-b 신규 UX (0083 / 0085~0086 / 0090)

| UX | 동작 | 위치 |
| --- | --- | --- |
| Transcript titlebar | 실제 cwd를 여는 **폴더 아이콘 전용 버튼 → 제목** 배치 + **인라인 rename**(`RenameInput`) | `features/chat/components/ChatTitleBar.tsx` |
| 프로젝트 삭제 | Nav 프로젝트 행·개별 프로젝트 페이지의 kebab에서 공용 확인을 거쳐 삭제. 대화·파일은 유지하고 세션의 프로젝트 연결만 해제 | `app/hooks/useProjectDeletion.ts` + `features/{projects,sessions,chat}` store |
| 대화 삭제 확인 | 전역 확인 다이얼로그 — `confirm()` 호출 → `#app-frame-modal` 슬롯에 렌더 | `shared/ui/ConfirmDialogHost.tsx` + `confirmDialogStore.ts` (0083) |
| 헤더 버전 모달 | 햄버거 메뉴 `버전` 항목 → 앱 버전/메타 모달 | `app/Header.tsx` 의 `HeaderVersionModal` (0083) |
| 인앱 업데이트 | 업데이트 가용 시 헤더 버튼 + 파란 뱃지 → `UpdateDialog`(다운로드/재시작 사용자 게이트). dev 는 디버그 패널 더미 토글 | `features/update/` (0085/0086) |
| 사용량 한도 | Composer 도넛 클릭 → `UsagePanel`(rendering.md §1.9) → `>` 로 설정 사용량 탭(provider 탭 포함) 이동, 월간 한도 편집 | `features/chat/components/UsagePanel.tsx` + `features/settings/` (0079~0082) |
| 툴팁 | 모든 `title` 툴팁은 앱 루트 `TooltipHost` 가 hover 500ms 뒤 검은 배경·흰 글자 툴팁으로 그린다(OS 툴팁 대신, 두 테마 동일). 표면 클래스 SSOT = `shared/ui/tooltipStyle.ts` | `shared/ui/{TooltipHost.tsx,tooltipController.ts,tooltipTarget.ts}` (0257) |
| 사용자 버블 접기 | 본문이 10줄을 넘으면 접고 마지막 줄을 흐린 뒤 버블 안 '더 보기'/'간략히 보기'로 오간다. 펼침 상태는 키별 메모리(가상화 재마운트에도 유지) | `features/chat/harnesses/common/transcript/UserBubbleText.tsx` + `store/bubbleExpansionStore.ts` (0257) |
| 엔진 추가 모달 | 단일 화면(마법사 폐기) — provider 드롭다운 + 선택 하네스의 native 설정 불러오기(`orca:engine:importUserSettings`) | `features/engine/components/EngineFormModal.tsx` (0090) |

### 1.4 접근성

- 모든 인터랙티브 요소 키보드 접근 가능 (Composer / Sidebar / DebugPanel)
- white/dark 2 테마 — `data-theme` 속성 기반
- ARIA 레이블 / 스크린리더 지원: 현재 부분 적용 (TBD — 체계적 audit 필요)

### 1.5 Sidebar Resize (Phase 3+)

- 드래그 영역: `aside.app-frame-sidebar` 우측 1px hairline (`app-frame-resize-handle`) — aside 의 자식이라 collapse 시 함께 사라진다.
- **2단 분리** (PR #30):
  - 일반 메커니즘 → `shared/hooks/useDragResize` (`getOrigin` / `min` / `max` / `disabled` / `onChange` 옵션. sidebar 라는 도메인을 모르며 tile separator 등에도 재사용 가능).
  - 도메인 특정 설정·적용 → `app/Sidebar.tsx` (`SIDEBAR_MIN/MAX/DEFAULT_WIDTH` 상수, `asideRef`, `setTweak('sidebarWidth', n)` onChange).
- 영속화: `Settings.sidebarWidth: number` (180–480, default 248). `shared/theme/TweakProvider` 가 부팅 시 hydrate + flush.
- collapsed 상태: handle 의 `data-state="hidden"` + `pointer-events-none`. 폭은 `w-14` (56px) 고정. `useDragResize` 의 `disabled: collapsed` 옵션으로 mousedown 무반응.
- 명명: aside 내부는 `resize-handle`, tile 사이는 `separator` 로 구분 (dom-architecture.md.4).

### 1.6 ApprovalCard 일반화

> **상태**: ✅ 승인 3종 구현 · 📐 단일 카드 일반화는 미착수. 권한 요청은 `plan_review`·`tool_approval`·`ask_question` 세 종류 모두 UI 에 도달한다 — plan 은 Composer 입력을 대체하는 `ApprovalCard`, tool·ask 는 입력 위 additive 인 `ToolApprovalBody`/`AskUserQuestionCard` 다(`features/chat/components/ApprovalCard.tsx`·`Composer.tsx`). **아래가 설계한 "하나의 일반 카드 + `origin`/`risk`/`provider` 배지" 형태는 아직 아니다.** 정본 타입(`permission.requested`/`ApprovalResolution`/`NormalizedPermissionMode`)은 [../backend/provider-runtime.md](../backend/provider-runtime.md) §3 가 소유.

**① 설명.** 현재 plan 전용인 승인 UI 를 **모든 agent tool `permission.requested`** 를 받는 일반 ApprovalCard 로 확장한다. 카드는 `origin`(agent/app) · `risk` · `provider` 배지를 표시하고, 사용자 결정을 `ApprovalResolution` 2분기로 회신한다.

**② 예시.** Bash `rm -rf …` 승인 카드에서 (a) 인자를 고쳐 승인 → `allow{updatedInput}`, (b) "이 세션 동안 Read 자동 허용" 토글 → `allow{updatedPermissions}`, (c) 거부 + 에이전트 중단 → `deny{interrupt:true}`. **OpenCode 세션이면** `updatedInput`/`updatedPermissions` 가 boolean 으로 downcast 되어 손실됨을 카드에 배지로 명시(../backend/provider-runtime.md §3 손실표).

**③ 현재 코드 갭.** 스테이지 C2 (`2d4ab8f`) 로 `PlanApprovalCard` → `features/chat/components/ApprovalCard.tsx` 일반화 — `permission.requested` 의 `action.kind` 분기. **스테이지 C 마무리로 `tool_approval` 게이트 활성** — `ApprovalCard` 가 `pendingPlanReview`/`pendingToolApprovals` 둘 다 디스패치하고, `ToolApprovalBody`(거부/세션 동안 허용/허용 3지)가 위험 도구 승인을 surface 한다. main 의 `makeCanUseTool` 이 `RISKY_TOOLS`(Bash/PowerShell/Write/Edit/MultiEdit/NotebookEdit — `adapters/common/risky-tools.ts`)만 게이트하고 안전 도구는 자동 통과(../backend/provider-runtime.md §3 ③). `AskUserQuestionCard.tsx`(명확화 질문)는 별도 유지. **현재 구조**: 승인 대기는 도메인별 분리 저장(`pendingAsks`/`pendingPlanReview`/`pendingToolApprovals`)이고 단일 큐로 합치지 않는다. 권한 모드는 Composer 권한 메뉴(`composer/modes.ts` — Code 와 Work 가 다른 선택지, rendering.md "Work/Code 표현")가 `orca:permission:setMode` 로 PermissionModeController 와 연동되고 진행 중 턴에도 라이브 적용된다(../backend/overview.md §4 `options.permissionMode` 행). 단일 카드 일반화(`origin`/`risk`/`provider` 배지)는 미착수.

**④ 연동.** `permission.requested` 이벤트 → reducer 가 종류별 대기 슬롯(`pendingPlanReview`·`pendingToolApprovals`·`pendingAsks`)에 적재 → `ApprovalCard.tsx` 가 Composer 입력창을 대체하거나 입력 위에 additive 로 뜬다(③) → 결정은 PermissionBridge(../backend/provider-runtime.md §3)로 회신. 렌더링은 ToolRendererRegistry 의 `'approval'` kind(rendering.md §1.6).

---

## 2. 도메인 카탈로그 (Orca 고유)

`shared/navigation/routes.ts` 의 path 카탈로그 + Tweaks 패널을 화면 단위로 정리.

| ID / 컴포넌트                                                  | 화면 라벨                               | breadcrumb          | Sidebar nav                   | Phase 상태                | 비고                                                                                                                                                                         |
| -------------------------------------------------------------- | --------------------------------------- | ------------------- | ----------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat` (`features/chat/components/ChatTile.tsx`)               | 01 채팅                                 | (없음)              | ✅ '새 대화'                  | **✅ Phase 1·2 활성**     | 실 IPC 연결됨. Composer 자동완성·ToolCard·Markdown·CodeBlock 모두 구현.                                                                                                      |
| `projects` (`features/projects/components/ProjectsScreen.tsx`) | 02 프로젝트                             | 프로젝트            | ✅ '프로젝트'                 | **✅ Phase 3 활성**       | 카드 그리드 + 생성 다이얼로그. ProjectDetail 은 `pages/ProjectLandingPage.tsx` 단일 파일.                                                                                    |
| `routines` (placeholder, 라우트 미정의)                        | 자동화                                  | —                   | ❌ (Future Scope, nav 미노출) | **⏳ Future Scope**       | 라우트는 미정의 — `router.tsx` catch-all 이 `/new` 로 흡수. 후속 PR 에서 `pages/RoutinesPage.tsx` + 라우트 등록 시 nav 복귀 가능.                                            |
| `engine` (`features/engine/components/AgentEnvironmentView.tsx`, 구 EngineView) | 03 엔진 & 모델                          | 설정 · 엔진 & 모델  | ✅ '엔진 & 모델'              | **✅ Phase 4 CRUD 활성 (0021·0090)** | nav 항목으로 노출. 라우트 `/agent`. provider CRUD(`EngineFormModal` — 단일 화면 모달 + 선택 하네스의 native 설정 불러오기, 0090) + `EngineCard`/`EngineModelList`. 제목 옆 개수는 settings·배포 runtime을 합친 화면 카드 수이며 단위는 '개'다. 카드는 Claude → OpenCode 순서로 정렬한다. OpenCode Composer 에이전트 선택은 목록 조회 중에 선택 provider 행의 agents(없으면 build·plan)를 스피너와 함께 보여 주고 조회가 끝나면 교체한다 — placeholder는 저장하지 않는다. |
| `plugins` (`pages/PluginsPage.tsx` → `features/skills/components/customize/ExtensionsCatalogView.tsx`) | 04 플러그인                             | 플러그인            | ✅ '플러그인' (`/plugins`)   | **✅ Phase 4 활성 (0159·0217·0236)** | 플러그인 → 스킬 → MCP 탭 카탈로그(rendering.md 카탈로그 단락). **MCP 섹션 실 연동**(`orca:mcp:*` + `AddMcpServerModal` 추가/편집/토글/삭제) · 연결(Auth) 상세와 인증 액션.                 |
| `artifacts` (`pages/ArtifactsPage.tsx` → `features/artifacts/`) | 05 아티팩트                             | 아티팩트            | ✅ '아티팩트' (`/artifacts`) | **✅ Phase 4 활성 (0223·0257)** | 전체/고정 탭 · 검색 · 세로 목록 · 우측 공통 파일 뷰어(rendering.md "산출물 게시 카드"). 일반 출력 파일은 목록 밖.                                                                       |
| (Debug Panel) `features/debug/components/DebugPanel.tsx`       | (플로팅 패널 — `#app-frame-debug` 슬롯, dev 전용) | —                   | —                             | **✅ Phase 2+ 영속**      | theme / sidebarCollapsed / sidebarWidth 등 Tweaks 컨트롤 — electron-store 동기화. 더미 업데이트·wire log·로그인 게이트 우회(`authBypass`) 토글 포함. |
| (SearchModal) `features/sessions/components/SearchModal.tsx`                            | (모달 — `#app-frame-modal` 슬롯)        | —                   | —                             | **✅ Phase 3++ 활성**     | FTS5 대화 검색. Header 검색 버튼 → `searchOpen` lift → OverlayLayer conditional mount.                                                                                       |

> **CameraView** 와 **CapturesView** 는 `features/camera/` · `features/captures/` 에 존재하지만 도메인 카탈로그에서 제외 (GLOSSARY §3 사용자 결정). Sidebar nav 에도 없음.
>
> **Sidebar nav 구성**: 정본은 `app/navItems.ts` — 새 대화 · 프로젝트 · 아티팩트 · 엔진 & 모델 · 플러그인. 자동화/captures 는 _Future Scope 로 nav 미노출_ — 향후 nav 복귀 가능.

### 2.1 도메인별 IPC 연결 상태

- **Projects**: ✅ 로컬 DB(`projects` + `sessions.project_id`, ../backend/persistence.md) — 카드 그리드·랜딩·삭제(`useProjectDeletion`).
- **Engine & Model / 연결**: ✅ Harness settings CRUD(`orca:engine:*`) + Auth 연결 탭(`orca:provider:*`, ../backend/auth.md §9). 자격증명은 Auth Grant → vault 가 소유한다(../backend/security.md §1.4).
- **플러그인 카탈로그 — MCP 서버**: ✅ `orca:mcp:*` CRUD + 파일-백드 `mcp.json`. 활성 서버는 배포기가 plugin `.mcp.json` 으로 렌더해 `options.plugins` 로 로드한다(../backend/standardization.md §5.1). 도구 권한은 승인 UI(§1.6)와 권한 모드 메뉴가 담당하고, **기본 정책값은 PRD OQ9** 로 열려 있다.
- **Artifacts**: ✅ `orca:artifact:*`(IPC_CONTRACT §2.6-a) — 목록·뷰어·휴지통.

---

## 3. IPC 호출 (Renderer → Main)

### 3.1 호출 규칙

- 직접 `window.orca.*` 호출은 **금지**. 모두 `shared/api/ipc.ts` 의 타입드 래퍼 (`chatApi`/`backendApi`/`installApi`/`settingsApi`/`skillApi`/`fileApi`/`sessionApi`/`projectApi`/`windowApi`) 를 경유한다.
- 래퍼 호출은 `features/<domain>/hooks/use*.ts` 안에 캡슐화. 컴포넌트가 직접 호출 금지.
- 모든 IPC 호출은 타입이 있어야 한다 (채널 정의는 [IPC_CONTRACT.md](../../IPC_CONTRACT.md) 참조).
- 에러는 throw 로 전달 (Main 측에서 직렬화된 `ClassifiedError` — `category`·`message`·`retryable`, IPC_CONTRACT §4).

### 3.2 스트리밍 응답 수신

수신 배선은 `features/chat/store/chatStore.ts` 가 갖는다 — 스토어 초기화가 `chatApi.onEvent(ingestChatEvent)`(`shared/api/ipc.ts` 래퍼 경유)를 1회 구독하고, 코얼레서를 거쳐 store 에 외부 dispatch 한다(state.md §1.2 · §1.4):

```typescript
// features/chat/store/chatStore.ts (개념)
chatApi.onEvent(ingestChatEvent) // 1회 구독 — 델타는 rAF 코얼레서, 그 외는 즉시 store.receive(ev)
```

- main→renderer 의 `orca:chat:event` 채널은 ordered + lossless (Electron `webContents.send` 가 V8 microtask queue 위에서 보장).
- Renderer 가 일시적으로 늦어도 microtask queue 에 안전히 쌓임.
- 컴포넌트 언마운트 시 unsubscribe **필수**.

### 3.3 취소

```typescript
import { chatApi } from "../../../shared/api/ipc";
chatApi.cancel(sessionId); // → window.orca.chat.cancel(sessionId) → ipcRenderer.invoke('orca:chat:cancel', ...)
```

Main 이 `AbortSignal` 을 SDK `query()` 에 전파 → 현재 inflight 만 중단. 진행 중이던 도구 호출은 SDK 가 정리.

### 3.4 채널 전체 목록

[IPC_CONTRACT.md](../../IPC_CONTRACT.md) §2 참조 — **채널 총계·도메인 분포는 IPC_CONTRACT 가 SSOT 이고 본 문서는 수치를 두지 않는다.**

---

## Agent/model UX (0010)

- Composer 모델 칩은 `orca:agent:list` 의 supported agent × model family 를 보여준다. 세션 생성 전에는 전체 supported agent 를, 세션 생성 후에는 같은 adapter 의 provider/model 만 노출한다.
- `availableModels`의 custom 항목은 실제 모델명을 Composer에 그대로 표시하고 선택값도 같은 이름을 쓴다. 1M 변형은 선택값에 `[1m]` 이 붙어 기본 변형과 구분된다(`shared/model-identity.ts`).
- Claude 모델 계열은 `sonnet`·`opus`·`haiku`·`fable`을 인식한다. `ANTHROPIC_DEFAULT_FABLE_MODEL`과 `availableModels`의 Fable 항목도 동일한 모델 identity 축(모델명 + `[1m]`)으로 Composer와 Engine 카드에 투영하며, alias 폴백 우선순위는 기존 호환 순서를 유지한 뒤 Fable을 마지막에 둔다.
- Engine 화면의 runtime-derived Orca Harness는 `readOnly:true` 배지를 표시하며 편집·삭제 액션을 노출하지 않는다. Main IPC도 같은 provenance로 mutation을 거부한다.
