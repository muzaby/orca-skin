# app/ — 코딩 에이전트용 가이드

이 디렉토리는 **Orca v1 의 실제 구현체**가 사는 곳이다. 현재는 **Phase 3++ (로컬 SQLite SSOT + 사이드바 세션 히스토리 + DOM Architecture + 4-layer Feature 아키텍처)** 상태로, claude-code 어댑터 + 채팅 IPC + Composer 스킬 UX + `better-sqlite3` 기반 로컬 DB 영속화 + 사이드바 세션 관리 위에 **① `app-frame-*` 구조 클래스 + `data-*` 행동/상태 마커 체계, ② 4-layer 렌더러 아키텍처 (`app/` 셸 · `pages/` 조립 · `features/` 도메인 · `shared/` 공통), ③ ESLint boundaries v6 로 레이어 역방향·cross-feature import 회귀 차단** 이 누적 적용되었다. 본 구현은 `docs/TRD.md` 의 사양과 `docs/FRONTEND_ARCHITECTURE.md` §3 의 아키텍처 명세를 따른다.

## 현재 상태 (Phase 3++ — 로컬 DB + 세션 히스토리 + DOM Architecture + 4-layer Feature 아키텍처)

| 영역                              | 상태                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 템플릿                            | `@quick-start/electron` `react-ts` (electron-vite 기반)                                                                                                                                    |
| 번들러                            | Vite (main/preload/renderer 3-config 통합)                                                                                                                                                 |
| Electron                          | 39.x — **`frame: false` + macOS `titleBarStyle: 'hidden'` + `trafficLightPosition`** (Phase 3+)                                                                                            |
| React                             | 19.x                                                                                                                                                                                       |
| TypeScript                        | 5.x (strict, target ES2022)                                                                                                                                                                |
| 스타일링                          | **Tailwind CSS v4** (`@tailwindcss/vite` 플러그인, CSS-first `@theme` 설정) + **`app-frame-*` 마커 클래스 + `data-behavior` / `data-state` / `data-axis` / `data-context` / `data-platform` 속성 공존** (FRONTEND §3.3) |
| 메인 (`src/main/index.ts`)        | **`app://` 커스텀 스킴 등록 (standard/secure/supportFetchAPI) + `protocol.handle` 의 SPA fallback** + IpcRouter 부트 + `createWindow` (`frame:false` + 윈도우 컨트롤 IPC 3개). 보안 옵션 명시 (contextIsolation/nodeIntegration/sandbox).      |
| 렌더러 (`src/renderer/src/`)      | **Phase 1~3++ 누적** — `app/` 셸 (AppLayout · Header · Sidebar · OverlayLayer · WinControls · router · BootRedirector), `pages/` 조립 (NewChatLandingPage · ChatPage · ProjectsPage · ProjectLandingPage · EnginePage · SkillsPage · CapturesPage), `features/` 도메인 6개 (backend · camera · captures · chat · engine · projects · sessions · skills), `shared/` 공통 (navigation · theme · hooks · ui · api · config). ESLint boundaries v6 로 레이어 방향 강제. **`react-router-dom` v7 BrowserRouter + `app://` 커스텀 스킴** 으로 URL 자체가 라우팅 진실의 출처. |
| 프리로드 (`src/preload/index.ts`) | `contextBridge.exposeInMainWorld('orca', OrcaApi)` — chat/backend/install/settings/skills/files/session/project/window/search/**mcp** 화이트리스트 + **`orca.platform` sync 노출**                  |
| 패키저                            | electron-builder (`electron-builder.yml`)                                                                                                                                                  |
| 도메인 코드 (IPC/어댑터)          | **claude-code 단일 어댑터 (SDK query)** + **로컬 SQLite SSOT** — ClaudeCodeAdapter(SDK NDJSON 정규화), AdapterRegistry, IpcRouter, Installer, SettingsStore, DbQueries (prepared statements), 마이그레이션 러너. opencode 는 future work                                  |
| 영속화 (`src/main/db/`)           | `better-sqlite3@^12` + `<userData>/orca.db` (WAL · foreign_keys ON). 스키마: `sessions / messages / tool_calls` + `_migrations` 메타. SQL 은 vite `?raw` 로 main 번들에 인라인              |
| 설정 영속화 (`src/main/settings/store.ts`) | `electron-store` + zod. `Settings.sidebarWidth: number` (180–480, default 248) 신설 (Phase 3+)                                                                                  |
| `package.json`                    | 템플릿 기본값 (`name: "app"`, `author: "example.com"` 등) — 차후 도메인 PR 에서 갱신                                                                                                       |

## 타깃 모듈 레이아웃 (TRD §1.2 기준)

경로는 electron-vite (`@quick-start/electron` react-ts 템플릿) 의 sub-config 분할을 반영한다. 빌드는 `electron.vite.config.ts` 의 main/preload/renderer 3개 sub-config 가 각각 처리한다.

### 렌더러 4-layer 아키텍처 (`src/renderer/src/`)

레이어 의존 방향: `app/` → `pages/` → `features/` → `shared/`. 역방향 및 cross-feature import 는 `eslint-plugin-boundaries` v6 (`boundaries/dependencies` 규칙) 로 **빌드 시 차단**.

```
src/renderer/src/
├── App.tsx                  # Provider 합성 루트 (Tweak → BrowserRouter → Backend → Sessions → Projects → Chat)
├── main.tsx                 # React 엔트리 + DOM mount
├── app/                     # 셸 — 고정 골격 (cross-feature wiring 권한 있음)
│   ├── AppLayout.tsx        # Header + Sidebar (슬롯 wiring) + main + OverlayLayer 조립
│   ├── Header.tsx           # app-frame-header, drag 2-layer, WinControls 통합
│   ├── Sidebar.tsx          # app-frame-sidebar, collapsible/resizable, SessionList/NewChatButton 슬롯
│   ├── OverlayLayer.tsx     # modal backdrop z-stack + InstallerDialog + AuthExpiredModal
│   ├── WinControls.tsx      # minimize/maximize/close IPC. macOS → null
│   ├── router.tsx           # path → Page 매핑 (`react-router-dom` v7 `<Routes>` — `/new`, `/chat/:sessionId`, `/projects`, `/projects/:projectId`, `/engine`, `/skills`, `/captures`, catch-all → `/new`)
│   ├── BootRedirector.tsx   # `/` 라우트 element — settings.lastSessionId → `/chat/<id>` 또는 `/new` replace
│   └── hooks/useChatRouteSync.ts  # URL ↔ ChatState 양방향 동기화 (방향 1: URL→loadSession/newChat, 방향 2: 첫 턴 완료 시 `/new` → `/chat/<id>` replace)
├── pages/                   # 조립 전용 — Context 읽기 + features 배치 + cross-feature props. 로직 0
│   ├── NewChatLandingPage.tsx # `/new` — 메시지 비어 있으면 중앙 Composer (랜딩), 메시지 있으면 ChatTile
│   ├── ChatPage.tsx         # `/chat/:sessionId` — ChatView (전체 ChatTile)
│   ├── ProjectsPage.tsx     # ProjectsScreen 단순 배치
│   ├── ProjectLandingPage.tsx # 프로젝트 채팅 랜딩 (useProjectChatLanding + ChatTile + ProjectSessionsPanel + ProjectInstructionsSidebar)
│   ├── EnginePage.tsx
│   ├── SkillsPage.tsx
│   └── CapturesPage.tsx
├── features/                # 도메인별 — 각 feature 는 자기 레이어 내부만 의존
│   ├── backend/
│   │   ├── providers/BackendProvider.tsx   # useBackendContext export
│   │   ├── hooks/useBackend.ts
│   │   ├── components/BackendStatus.tsx    # sidebar footer widget
│   │   ├── components/InstallerDialog.tsx
│   │   ├── components/AuthExpiredModal.tsx
│   │   └── index.ts                        # barrel: BackendProvider, useBackendContext, BackendStatus, …
│   ├── chat/
│   │   ├── providers/ChatProvider.tsx      # useChatContext export
│   │   ├── hooks/useChat.ts                # useReducer + 세션 캐시 + loadSession/newChat/send/…
│   │   ├── hooks/useSkillAutocomplete.ts
│   │   ├── hooks/useFileAutocomplete.ts
│   │   ├── reducer/chatReducer.ts          # ChatState reducer (SEND/RECV/NEW/LOAD/RENAME/…)
│   │   ├── components/ChatTile.tsx         # 채팅 tile — 헤더 + transcript + <Composer />
│   │   ├── components/Composer.tsx         # textarea + chip 행 + send/cancel + autocomplete (ChatTile/NewChatLandingPage 양쪽 재사용)
│   │   ├── components/ChatView.tsx         # ChatTile wrapper (backendLabel prop 수신)
│   │   ├── components/NewChatButton.tsx    # sidebar 슬롯 widget
│   │   ├── components/composer/…           # HighlightedTextarea, SkillAutocomplete, FileAutocomplete, ComposerChip, SkillsMenu
│   │   ├── components/transcript/…         # AssistantMessage, UserMessage, PendingAssistant, ToolCard, MessageMeta
│   │   ├── components/markdown/…           # Markdown, CodeBlock (react-markdown + shiki)
│   │   ├── format.ts                       # formatTimeShort / formatTimeFull / stringify
│   │   └── index.ts
│   ├── sessions/
│   │   ├── providers/SessionsProvider.tsx  # useSessionsContext export
│   │   ├── hooks/useSessions.ts            # 세션 메타 목록 (list/refresh/remove/rename)
│   │   ├── hooks/useProjectSessions.ts     # 프로젝트 세션 IPC 래퍼 (list/remove/rename)
│   │   ├── components/SessionList.tsx      # sidebar 슬롯 — 세션 행 목록 (SessionRow 합성)
│   │   ├── components/SessionRow.tsx       # app-frame-session-row, kebab 메뉴, inline rename
│   │   ├── components/ProjectSessionsPanel.tsx # 프로젝트 랜딩용 세션 패널 (IPC 캡슐화)
│   │   └── index.ts
│   ├── projects/
│   │   ├── providers/ProjectsProvider.tsx  # useProjectsContext export
│   │   ├── hooks/useProjects.ts
│   │   ├── components/ProjectsView.tsx / ProjectsScreen.tsx
│   │   ├── components/ProjectLandingHeader.tsx  # 뒤로가기 + 프로젝트명 헤더
│   │   ├── components/ProjectInstructionsSidebar.tsx  # 지침 사이드바 + 편집 모달 state
│   │   ├── components/CreateProjectModal.tsx
│   │   ├── components/EditInstructionsModal.tsx
│   │   └── index.ts
│   ├── skills/
│   │   ├── hooks/useSkillsMcp.ts           # (SkillsMcp 화면 전용)
│   │   ├── components/SkillsMcpView.tsx
│   │   └── index.ts
│   ├── camera/ · engine/ · captures/      # CameraView, EngineView, CapturesView + index.ts
├── shared/                  # 범용 — 모든 레이어가 의존 가능, 도메인 로직 0
│   ├── navigation/
│   │   ├── routes.ts                       # path 패턴 + 라벨 + breadcrumb 카탈로그 (AppLayout 의 matchPath 소스)
│   │   └── index.ts
│   ├── theme/
│   │   ├── TweakProvider.tsx               # useTweakContext export (theme/density state)
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useSkills.ts                    # orca:skills:list IPC → SkillInfo[] 캐시
│   │   └── useTweaks.ts                    # theme/density state hook (TweakProvider 내부)
│   ├── config/theme.ts                     # ThemeId / DensityId 타입 + DENSITY_FONT
│   ├── api/ipc.ts                          # window.orca.* 타입드 래퍼
│   └── ui/                                 # 도메인-무관 UI atom: Icon, Avatar, Status+Dot, BayerPattern,
│                                           #   Histogram, Popover, CopyIconButton, StatusLine, TweaksPanel
└── styles/
    ├── tokens.css                          # Tailwind @theme (시맨틱 토큰) + [data-theme] 스코프
    └── app.css                             # Tailwind 엔트리 + @layer base 리셋 + @utility kbd
```

### Main / Preload / Shared (변경 없음)

| 경로                                                      | 책임                                                                            | 현 상태                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| `src/main/index.ts`                                       | Electron `app` 부트, BrowserWindow (`frame: false` + macOS `titleBarStyle: 'hidden'` + `trafficLightPosition`), IpcRouter 부착, 윈도우 컨트롤 IPC 3개 직접 부착 | 구현됨 (Phase 3+)                       |
| `src/main/ipc/router.ts`                                  | IPC 채널 라우팅 + 입력 검증 (zod) + ChatEvent → DB persist (turn-local 상태 머신)| 구현됨 (Phase 3)                       |
| `src/main/adapters/claude-code.ts`                        | `@anthropic-ai/claude-agent-sdk` query() · SDKMessage → ChatEvent 정규화        | 구현됨                                  |
| `src/main/adapters/opencode.ts`                           | opencode `serve` / SDK / SSE                                                    | **미구현 (future work)**                |
| `src/main/installer/index.ts`                             | CLI 설치 자동화 (`npm install -g @anthropic-ai/claude-code`)                    | 구현됨                                  |
| `src/main/settings/store.ts`                              | `electron-store` + zod. `Settings.sidebarWidth` 포함                            | 구현됨 (Phase 2+)                       |
| `src/main/mcp/store.ts`                                   | **파일-백드 MCP 모델.** 3출처 조율: `mcp.json`(정규 소스, 순정 Claude `mcpServers` 스키마 + `${VAR}`) + `secret-store`(safeStorage, env-var 이름 키잉) + settings(`mcpEnabled`/`mcpMeta`). CRUD + `buildQueryOptions()` (활성 서버 → `toClaudeConfig` → SDK `mcpServers`/`allowedTools`) | 구현됨 (MCP&Skill 통합 레이어)        |
| `src/main/config/{paths,mcp-file,secret-store}.ts`        | `~/.config/orca` 루트 헬퍼 + `mcp.json` atomic R/W (정규 소스) + 비밀 저장소(env-var 이름 키잉, safeStorage) | 구현됨 |
| `src/main/mcp/{schema,crypto,expand,convert,resolver,migrate}.ts` | 정규 소스/타깃 타입 + safeStorage 헬퍼 + `${VAR}` 확장(순수) + **양 백엔드 대칭 변환기**(`toClaudeConfig`/`toOpencodeConfig`, 순수) + resolver 팩토리 + 레거시 `orca-mcp` 1회 이전 | 구현됨 |
| `src/main/skills/plugin-bundle.ts`                        | `~/.config/orca/plugins/orca-skills` 번들 골격 보장(멱등). claude-code query() 에 `plugins`+`skills:'all'` 로 명시 로드 | 구현됨 |
| `src/main/db/`                                            | `better-sqlite3` singleton + WAL + 마이그레이션 러너 + queries (11개 prepared statements) | 구현됨 (Phase 3)       |
| `src/main/files/scan.ts`                                  | `@` 파일 자동완성용 — `cwd + relDir` 한 단계 listing                            | 구현됨                                  |
| `src/main/skills/scan.ts`                                 | `~/.claude/skills/` · `<cwd>/.claude/skills/` `SKILL.md` frontmatter 스캔      | 구현됨                                  |
| `src/shared/ipc.ts`                                       | `CHANNELS` 상수 + 순수 TS 타입. **zod 0 의존** (preload 안전). SSOT 는 `docs/IPC_CONTRACT.md` §2 | 구현됨 (Phase 3+)      |
| `src/shared/protocol.ts`                                  | zod 스키마 (main 전용). 타입은 `ipc.ts` 에서 re-export                          | 구현됨                                  |
| `src/shared/i18n/ko.ts`                                   | 한국어 라벨                                                                     | 미작성 (현재는 인라인 한국어)           |

> 이 레이아웃에서 벗어나려면 사용자에게 먼저 확인. TRD §1.2 와 코드를 동시에 갱신해야 한다.

### 의존성 규칙 요약 (ESLint boundaries v6)

```
app/     → pages · features · shared  (허용)
pages/   → features · shared          (허용)
features/<X>/ → shared + 동일 feature 내부만 (허용)  |  다른 feature → 차단
shared/  → shared 내부만              (허용)
```

위반 시 `npm run lint` 에서 `boundaries/dependencies` error 발생. cross-feature 데이터 흐름이 필요하면 **pages/ 또는 app/ 에서 props 로 전달** (결정 트리 규칙 5).

## 스타일링 정책 (Tailwind v4)

Phase 1 의 1차 목표는 **mockup 픽셀 재현**이었으며, 마이그레이션 PR 에서 Tailwind CSS v4 로 일괄 전환되었다. 현재 정책:

| 항목                 | 현재                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 스타일링             | Tailwind CSS v4 (`@tailwindcss/vite`). 클래스는 시맨틱 토큰 우선 (`bg-bg`, `text-ink`, `border-border` 등)                         |
| 디자인 토큰          | `styles/tokens.css` 의 `@theme` 블록 — `--color-{bg,sidebar,panel,border,border-strong,ink,ink2,ink3,rust,rust-soft}` 등           |
| 테마 전환            | `<html data-theme="classic\|dark\|cool">` — 토큰 변수만 재정의되므로 트리 remount 불요 (`key={t.theme}` 제거됨)                    |
| 밀도                 | `document.documentElement.style.fontSize`(`DENSITY_FONT`) — rem 기반 Tailwind spacing 으로 자연 cascade                            |
| 폰트                 | Google Fonts CDN (Source Serif 4 / Inter / JetBrains Mono) — `index.html` link 유지, CSP 그대로                                    |
| 인라인 `style`       | 동적 계산값 한정 (TweaksPanel 드래그 `right/bottom`, Slider `width %`, BayerPattern grid template 등). 정적 값은 Tailwind 클래스로 |
| 매직 픽셀 값         | mockup 픽셀 재현이 우선. Tailwind 표준 스케일과 어긋날 땐 arbitrary value (`text-[13px]`, `gap-[22px]`) 허용                       |
| `kbd` 등 글로벌 유틸 | `app.css` 의 `@utility kbd` 단일 정의 (Tailwind v4)                                                                                |

**새 컴포넌트는 Tailwind 클래스 + 시맨틱 토큰 사용**. 색상은 raw hex 대신 토큰(`bg-rust`, `text-ink2`) 으로. 새 토큰이 필요하면 `tokens.css` 의 `@theme` 에 먼저 추가하고 세 테마 스코프(`classic`/`dark`/`cool`) 에 대응값을 모두 채워라.

**DOM 마커 체계 (Phase 3+ 도입).** 구조 식별을 위한 `app-frame-*` 클래스와 행동/상태 메타 (`data-behavior`, `data-state`, `data-axis`, `data-context`, `data-platform`) 는 **Tailwind 유틸과 공존하는 마커 전용**이다. 시각 스타일은 여전히 Tailwind 유틸이 진실. 새 컴포넌트 추가 시 가이드라인 (`docs/FRONTEND_ARCHITECTURE.md` §3.3) 의 트리 위치에 맞는 `app-frame-*` 클래스를 부여하고, 인터랙션이 있으면 `data-behavior` / `data-state` 도 함께 부여한다. 새 CSS 파일/규칙은 추가하지 않는다 — grid 1×1 z-stack 같은 레이아웃도 Tailwind arbitrary value 로 표현 (`grid-cols-1 grid-rows-1 [&>*]:[grid-area:1/1]`).

**그룹 스코프 (`group` / `group-hover:`) 는 named group 으로 격리.** 자체 hover 인터랙션을 가진 컴포넌트 (코드블럭, 카드, 행 등) 는 익명 `group` 대신 `group/<컴포넌트명>` + `group-hover/<컴포넌트명>:` 패턴을 쓴다. 이유: `AssistantMessage` 같은 상위 컴포넌트가 이미 `.group` 으로 마킹돼 있을 때 익명 `group-hover:` 는 상위 group 까지 매칭되어 형제 인스턴스도 같이 hover 상태가 된다 (메시지 본문 hover → 그 메시지 내 모든 코드블럭의 카피 버튼이 동시에 노출되는 버그 사례). 예: `CodeBlock` 은 `group/codeblock` + `group-hover/codeblock:opacity-100` 으로 hover 범위를 자기 자신으로 한정한다 (`screens/chat/markdown/CodeBlock.tsx`). Sidebar 의 `SessionRow` 도 `group/session` + `group-hover/session:grid` 로 자기 kebab 버튼만 노출 (`frame/sidebar/SessionRow.tsx`).

### 데스크톱 컨텍스트는 production 에서 제외

mockup (`project/electron/index.html`) 은 디자인 시연을 위해 _Windows 11 데스크톱_ 컨텍스트 — 배경 그라데이션, taskbar, 좌상단 "Orca · Electron BrowserWindow" 배너, 우상단 floating screen-tabs, 1280×820 frameless 윈도우 박스 (둥근 모서리 / 그림자 / center transform / auto-scale) — 를 입혀 보여준다. **이 wrapper 는 production 렌더러에 포함하지 않는다** — 실제 앱은 OS 의 BrowserWindow 안에서 실행되므로 데스크톱 시뮬레이션은 중복·불필요. 렌더러는 mockup `.app-window` _내부_ 의 콘텐츠 (Frame / Titlebar / Sidebar / 본문 / TweaksPanel) 만 viewport 풀-블리드 로 렌더한다.

화면 전환은 사이드바 메뉴 (`Sidebar` 의 `onSelect`) 만으로 진행. mockup 의 우상단 floating screen-tabs 는 디자인 캔버스용 개발 보조 UI 였으므로 제외.

## 보안 베이스라인 (TRD §1.3) — 첫 PR 에서 반드시 적용

`BrowserWindow` 생성 시 다음을 _명시_. 스캐폴드 기본값을 신뢰하지 말 것. 현재 템플릿은 이미 올바르게 설정되어 있으나, 변경 시 반드시 유지할 것.

```ts
import { join } from 'path'
new BrowserWindow({
  webPreferences: {
    contextIsolation: true, // 필수
    nodeIntegration: false, // 필수
    sandbox: true, // 필수
    preload: join(__dirname, '../preload/index.js')
  }
})
```

| 항목                              | 규칙                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| DevTools 자동 오픈                | dev 빌드(`process.env.NODE_ENV !== 'production'`) 한정                                                                                |
| 외부 URL 로드                     | 금지. `webContents.setWindowOpenHandler` 로 차단 + OS 기본 브라우저 위임                                                              |
| CSP (`src/renderer/index.html`)   | `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com` — Google Fonts 허용을 위해 |
| 비밀 저장                         | 앱은 저장하지 않음 — OAuth/API 키는 호스트 CLI 가 관리 (PRD N6)                                                                       |
| `@electron-toolkit/utils` 사용 시 | `contextIsolation`, `nodeIntegration`, `sandbox` 는 여전히 _명시_. 공통 유틸은 이 3옵션 조합을 가정한다                               |

## DB 영속화 정책 (Phase 3)

- **DB**: `better-sqlite3@^12` raw + prepared statements (`src/main/db/queries.ts`). Phase 3 MVP 쿼리 수 11개 내외, 스키마 변경 빈도 낮아 ORM/쿼리 빌더 가치 작음 — **Drizzle 재검토는 Phase 4 멀티 세션 · artifact · 권한 · 통계 도입 시점**.
- **버전**: 12.x 메이저 — Electron 39 의 V8 API 변경과 11.x 비호환 (Windows postinstall 실패 → MSVC 의존). 12.x 는 V8 sandboxing 플래그 수정 + npm tarball 에 Windows prebuild 포함.
- **DB 위치**: `<userData>/orca.db`. `app.getPath('userData')` 단일 출처 — settings/store 와 같은 경로 패턴.
- **마이그레이션**: `NNNN_<name>.sql` (4자리 zero-pad). `migrations/0001_initial.sql` 같은 **머지된 파일은 절대 수정 금지** — 변경은 새 마이그레이션으로. 상태는 `_migrations(name PK, applied_at)` 메타 테이블로 추적. SQL 은 vite `?raw` 로 main 번들에 인라인 (`electron.vite.config.ts` 의 main rollup 입력에 포함).
- **PRAGMA**: 부팅 시 `journal_mode = WAL` + `foreign_keys = ON`.
- **SSOT**: 메시지 / 툴콜 / 세션 메타의 진실은 DB. claude-code SDK 의 `resume` 은 컨텍스트 유지용일 뿐 메시지 출처는 DB.
- **삭제**: hard delete 만 (CASCADE 로 messages/tool_calls 함께 제거). 휴지통 30일 보존은 Future Scope.

## 비동기 lazy load + 캐시 (Phase 3)

- **부하 모델**: 사이드바 메타 (`session.list`) 는 부팅 1회 + 턴 종료 시 자동 refresh. 메시지 (`session.load`) 는 사이드바 클릭 또는 부팅 자동 복원 시점에만 1회 IPC.
- **메모리 캐시**: `useChat` 내부 `useRef<Map<sessionId, CachedSession>>`. 활성 세션을 떠날 때 snapshot 저장 → 같은 세션 재진입 시 IPC 없이 `LOAD_SESSION_FROM_CACHE`. 무효화: 세션 삭제 시 `invalidateSessionCache(id)` 호출, 이름 변경 시 cache entry 의 title 동기화. 크기 제한 없음 (Phase 4 LRU cap 검토).
- **즉시 제목**: `ChatState.title` 이 사이드바 메타 (`title || preview`) 에서 클릭 즉시 채워짐 → 헤더가 "새 대화" 깜빡임 없이 정확한 제목 표시. 부팅 자동 복원만 메타 없이 호출되고 IPC 응답의 `LoadedSession.title` 로 reconcile.
- **로딩 인디케이터**: `loadingSession` flag — ChatTile 이 "대화 불러오는 중…" 한 줄.

## 의존성 정책

- TRD §2 의 Stack 표 밖의 패키지 추가는 **사용자 승인 필수**. PR 설명에 _왜_ 가 들어가야 한다.
- 이미 채택된 것 (도입 시점만 자유): React, react-markdown, shiki, electron-store, zod, vitest, playwright.
- 설치 완료: **Tailwind CSS v4** (`tailwindcss@^4`, `@tailwindcss/vite@^4`), **`better-sqlite3@^12`** (Phase 3 — Electron 39 V8 ABI 호환을 위해 12.x 메이저 사용. Windows prebuild 포함), **`react-router-dom@^7`** (URL/path 라우팅 — `app://` 커스텀 스킴 + BrowserRouter).
- 템플릿 동봉 (사전 승인): `@electron-toolkit/utils`, `@electron-toolkit/preload`.
- 미정 항목 (PRD §11 / TRD §15 — 단독 결정 금지):
  - ~~OQ1~~ React 19 확정 (2026-05-20)
  - OQ2: 마크다운/하이라이트 라이브러리 최종 결정
  - OQ3: 패키징·서명·자동업데이트
  - OQ4: 텔레메트리·크래시 리포트
  - OQ5: 라이센스
  - OQ6: 성능 SLA 수치
  - OQ7: 둘 다 설치된 경우 기본 백엔드
  - ~~OQ8~~ "새 대화" 클릭 시 빈 상태 진입 + 직전 세션은 사이드바 "최근 대화" 최상단 보존 (Phase 3, 2026-05-20). Phase 4 멀티 세션 도입 시 재검토.

## 빌드 / 실행

| 스크립트              | 동작                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev`         | electron-vite dev (HMR for renderer, main/preload watch+restart)  |
| `npm run build`       | `tsc --noEmit && electron-vite build` (3-config 번들 → `out/`)    |
| `npm start`           | `electron-vite preview` (프로덕션 번들 실행)                      |
| `npm run build:win`   | `electron-vite build && electron-builder --win` Windows 배포 산출 |
| `npm run build:mac`   | macOS 배포 산출                                                   |
| `npm run build:linux` | Linux 배포 산출                                                   |
| `npm run typecheck`   | `tsc --noEmit` (node + web 두 tsconfig 분리 검증)                 |
| `npm run lint`        | ESLint                                                            |
| `npm run format`      | Prettier                                                          |
| `npm test`            | `vitest run` — 순수 함수 단위 테스트 (`expand`/`convert` 등, electron 비의존). `npm run test:watch` 는 watch 모드 |

## 에이전트 원칙

1. **`docs/TRD.md` 먼저 읽고 코드 짜라.** 본 디렉토리 작업의 1차 사양은 TRD. PRD §11 / TRD §15 Open Questions 는 단독 결정 금지.
2. **위 모듈 레이아웃을 따르라.** 스캐폴드의 평면 구조에 코드 누적 금지. `src/main/`, `src/preload/`, `src/renderer/src/`, `src/shared/` 로 분리한 뒤 진행.
3. **스타일은 Tailwind 클래스 + 시맨틱 토큰.** 인라인 `style` 은 동적 계산값에만 사용. 새 토큰은 `styles/tokens.css` 의 `@theme` 에 추가하고 세 테마 스코프 모두에 대응값을 채울 것.
4. **새 의존성 추가 시 사용자 확인.** TRD §2 표 밖이면 PR 설명에 사유 명시.
5. **Electron 보안 옵션은 항상 명시.** 기본값 의존 금지. 위 code block 참고.
6. **테스트 동반.** 어댑터 정규화, reducer, IPC 스키마는 단위 테스트와 함께 작성 (TRD §10). Phase 1 UI 는 시각 검증으로 갈음.
7. **`package.json` 메타데이터는 템플릿 기본값이다.** 차후 도메인 PR 에서 `name`, `productName`, `description`, `author` 갱신. `electron-builder.yml` 도 검토.
8. **TRD 와 코드가 충돌하면 사용자에게 물어라.** TRD 갱신과 코드 변경은 같은 PR 또는 짝 PR 로.
9. **단일 파일 분해 가이드.** `.tsx` / `.ts` 파일은 *하나의 응집된 책임* 을 지킨다. 다음 두 조건 중 하나라도 충족하면 분해를 검토한다: (1) 한 파일에 **5개 이상의 React 컴포넌트** 가 모여 있고 그중 일부가 *레이어/슬롯이 다른 위치* 에 자리할 수 있다, (2) 파일이 **400줄을 넘는다**. 단일 컴포넌트의 응집된 구현(예: `HighlightedTextarea`, `chatReducer`) 은 예외. 분해 시 새 파일은 **해당 레이어·feature 의 디렉토리** (`features/<X>/components/` · `features/<X>/hooks/` · `shared/ui/` 등) 에 둔다 — 4-layer 경계를 보존하기 위함. 수치(5개·400줄)는 *경고 트리거* 이지 절대 규칙이 아니다 — PR 리뷰에서 *왜 한 파일에 두었는지* 설명을 요구하는 시그널.

## Phase 로드맵

| Phase   | 범위                                                                                                                                                   | 상태                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Phase 1 | mockup 시각 재현 + Tailwind CSS v4 마이그레이션. chat / projects / engine / skills 4개 화면 + Tweaks. 캡처는 placeholder                               | **완료**                    |
| Phase 2 | IPC 채널 + zod 검증. **Claude Code 단일** 어댑터. 세션 재개. UI 데이터를 mockup 하드코딩 → IPC props 로 교체                                           | **완료 (claude-code 단독)** |
| Phase 2+ | `electron-store` 영속화 — Tweaks (theme/density/sidebarCollapsed), `lastSessionId`, `lastBackend`, window bounds                                       | **완료**                    |
| Phase 2++ | Composer 스킬 UX — `SKILL.md` 스캔 · `orca:skills:list` IPC · 3-chip 행 (첨부·현재 프레임·Skill) · Skill picker popover · 활성 스킬 `/skillname` chip 강조 · 인라인 자동완성 dropdown | **완료**                    |
| **Phase 3** | **로컬 SQLite SSOT** — `better-sqlite3@^12` + `<userData>/orca.db` (sessions / messages / tool_calls). 마이그레이션 러너 + WAL · foreign_keys. ChatEvent → DB persist (router turn-local 상태). 사이드바 "최근 대화" 실세션 연동 · **비동기 lazy load** (메타 부팅 1회 + messages 진입 시점 1회) · **메모리 캐시** (재진입 IPC 생략) · **즉시 제목 표시** (state.title). 사이드바 행 **kebab 메뉴** (이름 변경 / 삭제) + inline rename. 부팅 시 lastSessionId 자동 복원 (메시지까지 비동기 fetch). | **완료 (PR #20)**           |
| **Phase 3+** | **DOM Architecture 일괄 적용** — `app-frame-*` 마커 클래스 + `data-behavior` / `data-state` / `data-axis` / `data-context` / `data-platform` 체계. 4종 신규 기능: ① Custom titlebar (`frame: false` + macOS `titleBarStyle: 'hidden'` + 윈도우 컨트롤 IPC 3개 + `orca.platform` sync 노출), ② Grid z-stack (`#app-frame-overlay` modal backdrop 전용 z 부호 반전 + `#app-frame-modal` focus-trap + `#app-frame-debug` floating UI 호스트 3슬롯), ③ Sidebar resize-handle (180–480px clamp, `Settings.sidebarWidth` 영속화), ④ Tile structure (`pane-host > pane-row > tile` 마크업). SSOT 는 `docs/FRONTEND_ARCHITECTURE.md` §3.3. | **완료 (브랜치 `claude/charming-galileo-7lAqY`, 커밋 `45e129f` + 정정 `acf1295`)** |
| **Phase 3++ (PR #25)** | **`frame/` + `screens/` 슬롯 분리** — 셸 슬롯(Frame/Header/Sidebar/ChatTile/Composer/Modal/Debug) 은 `frame/` 으로, 도메인 화면 (Chat/Camera/Projects/Engine/SkillsMcp/Captures) 은 `screens/` 로 1:1 정렬. 컴포넌트 rename: `Titlebar` → `Header`, `ChatPane` → `ChatTile`, `*Pane` / `*Placeholder` / 화면 이름 → `*Screen` 접미사. 마커 보강: `app-frame-composer-repo` (3-chip 행 wrapper) · `app-frame-session-row` (sidebar 세션 행) · `app-frame-floating` (body portal Popover / Autocomplete). `docs/GLOSSARY.md` 에 *Frame/Tile/Screen/Header/Slot* 정의 + 사용 금지 어휘에 *Pane* / *Titlebar (셸 헤더 의미)* 추가. | **완료 (PR #25, 커밋 `1d68e05`)** |
| **Phase 3++ (PR #26)** | **ChatTile 분해** — 620줄 단일 파일에 모인 transcript 컴포넌트 5개 + composer 부속 2개 + 시간/JSON 포맷 유틸을 슬롯 디렉토리로 추출. 신규: `screens/chat/{format.ts, ToolCard, MessageMeta, AssistantMessage, UserMessage, PendingAssistant}.tsx` + `frame/composer/{ComposerChip, SkillsMenu}.tsx` 총 8개. ChatTile.tsx 잔류 = 셸 컴포지션 + state hook 연결 + 입력 핸들러만 (369줄). 에이전트 원칙 9 (단일 파일 분해 가이드: 한 파일 5+ 컴포넌트 또는 400줄 초과 시 분해 검토, 새 파일은 슬롯 디렉토리에 배치) 신설. | **완료 (PR #26, 커밋 `3d202ff`)** |
| **Feature-based 구조 감사 + FRONTEND_ARCHITECTURE.md 엄격 갱신 (PR #28)** | **완료 (PR #28)** — `frame/` 완전 해체 결정 (→ `app/` + `features/` + `shared/`), `pages/` = 조립만, `router` = which, App Shell §3.A 조립 규칙 신설, §3-2 목표 트리 + §10 구현 대기 행 추가. 코드 변경 없음 — 문서만. | **완료 (PR #28)** |
| **Feature-based 아키텍처 구현 + ESLint boundaries 강제 (PR #29)** | **4-layer 렌더러 아키텍처 전면 구현.** `app/providers/` 6개 → `features/<X>/providers/` 4개 + `shared/navigation/` + `shared/theme/` 로 이전. `frame/` + `screens/` + `state/` 완전 해체 → `app/` (셸) · `pages/` (조립) · `features/` (도메인 6개) · `shared/` (범용) 4-layer 완성. `useSkills` → `shared/hooks/`. `useProjectSessions` → `features/sessions/hooks/`. `ProjectDetail` 3-파일 (`ProjectDetailPage` + `ProjectDetailView` + `ProjectDetailScreen`) → `pages/ProjectLandingPage.tsx` 단일 파일 통합. 신규: `useProjectChatLanding` · `ProjectSessionsPanel` · `ProjectLandingHeader` · `ProjectInstructionsSidebar`. `eslint-plugin-boundaries` v6 (`boundaries/dependencies`) 로 레이어 역방향·cross-feature import 회귀 차단. | **완료 (PR #29)** |
| **URL/path 라우팅 전환 (`app://` 커스텀 스킴 + BrowserRouter)** | **Context-기반 `ScreenId` enum 라우팅 → URL/path 라우팅 전면 전환.** `react-router-dom@^7` 도입. main: `protocol.registerSchemesAsPrivileged` 로 `app://` 표준 스킴 등록 + `protocol.handle` 의 SPA fallback (자산 파일은 그대로, 그 외 path 는 `index.html`); production 로딩이 `loadFile` → `loadURL('app://renderer/')`. renderer: `NavigationProvider` 삭제 → `BrowserRouter`. `app/router.tsx` switch → `<Routes>` (`/`=BootRedirector · `/new`=ChatPage · `/chat`=Navigate→/new · `/chat/:sessionId`=ChatPage · `/projects` · `/projects/:projectId` · `/engine` · `/skills` · `/captures` · `*`→/new). 신규 `BootRedirector` 가 `settings.lastSessionId` 조회 후 `/chat/<id>` 또는 `/new` 로 replace — `useChat` 의 부팅 자동 복원 effect 제거. 신규 `useChatRouteSync` 가 URL ↔ ChatState 양방향 동기화 (방향 1: URL→loadSession/newChat, 방향 2: 첫 턴 완료 시 `/new` → `/chat/<id>` `replace`). `Sidebar`/`useSessionHandlers`/`NewChatButton`/`ProjectsView`/`ProjectLandingPage` 의 `navigate(screen)` → `navigate('/path')`. `electron.vite.config.ts` 에 `enforce: 'post'` 플러그인으로 `base: '/'` 강제 (electron-vite preset 의 production `./` 덮어쓰기 우회). 삭제: `shared/navigation/NavigationProvider.tsx`, `shared/navigation/screens.ts`, `shared/types/screen.ts`. 신규 `shared/navigation/routes.ts` (path 패턴 + 라벨 + breadcrumb). | **완료** |
| **Phase 3++ (Sidebar brand + nav 재구성 + Header 5-버튼 툴바)** | **셸 정렬.** Sidebar `app-frame-sidebar-brand` = newChatSlot → 🐋 + "Orca" 로고 (브랜드 정체성만). Sidebar nav = 3-항목 (새 대화 `/new` · 프로젝트 `/projects` · 자동화 `/routines` placeholder). collapsed 상태 아이콘 컬럼도 동일 NAV + 활성 강조 동적화. Header `app-frame-header-left` 의 brand/breadcrumb/프로젝트명 제거 → 5-버튼 액션 툴바 (햄버거 popover + 종료 menuitem · 사이드바 접기 토글 · 검색 · 뒤로 · 앞으로). `NewChatButton.tsx` 삭제 + `features/chat/index.ts` barrel export 정리. shared/ui/Icon.tsx 에 4종 신규 아이콘 추가 (`clock`/`menu`/`arrowL`/`arrowR`). `shared/ui/Popover.tsx` 에 `placement?: 'top' \| 'bottom'` 확장 (default 'top' — 기존 호출처 무영향). | **완료** |
| **Phase 3++ (FTS5 대화 검색 모달 + IPC)** | **대화 이력 전체 검색.** `0003_messages_fts.sql` 마이그레이션 (FTS5 가상 테이블 `messages_fts` + INSERT/UPDATE/DELETE 트리거 + 기존 메시지 백필). `DbQueries.searchMessages` prepared statement (FTS5 quote escape + 모든 토큰에 prefix wildcard `*` 부착 — 어느 토큰이든 미완성일 수 있다는 가정). 신규 IPC 채널 `orca:search:messages` + zod 스키마 + preload `orca.search.messages` + renderer `searchApi.messages`. `app/SearchModal.tsx` 신설 — `#app-frame-modal` 슬롯 안에 conditional mount (React 19 useEffect 내 setState 금지 회피), 150ms debounce + request id supersede + `<mark>` split-parse XSS 방어 + ↑↓/Enter/Esc 키보드. `AppLayout` 이 `searchOpen` useState lift, Header `onOpenSearch` / OverlayLayer `searchOpen+onCloseSearch` props 로 전파. Worker thread 도입 보류 (FTS5 latency 단위 ms — 향후 perf 회귀 시 utilityProcess 위임 검토). | **완료** |
| **Phase 3++ (Sidebar 활성 효과 URL 동기화)** | **활성 표시의 진실은 URL.** `useSessionHandlers` 의 `currentSessionId` 를 `matchPath('/chat/:sessionId', pathname)` 로 도출 — 기존 `ChatContext.state.sessionId` 의존 제거 (캐시/IPC 호출 용도로만 잔존). 다른 라우트로 이동 시 모든 세션 행 활성 자동 해제. Sidebar NAV[0] '새 대화' isActive 도 `p === '/new'` 로 좁힘 (`/chat/<id>` 진입 시 활성 해제). `handleDeleteSession` 의 `wasActive` 검사도 새 `currentSessionId` 사용. | **완료** |
| **Phase 3++ (MCP 서버 지원)** | **전역 MCP 서버 등록·관리 + query 주입.** 사이드바 nav 4번째 항목 'Skills & MCP'(`/skills`) 신설. `SkillsMcpView` 의 MCP 섹션을 하드코딩 mockup → 실데이터(`useMcpServers`)로 교체 (토글·삭제·추가/편집 모달 `AddMcpServerModal`). 신규 IPC 도메인 `orca:mcp:*` 4채널 + `McpStore`(`src/main/mcp/store.ts`, electron-store `orca-mcp`). **인증값은 Electron `safeStorage` 로 암호화 저장** (authEnc base64, renderer 엔 `hasAuth` boolean 만 노출 — 보안 베이스라인 준수). transport 2종: stdio(command·args·인증 env) / streamable-http(url·Bearer 토큰). `handleChatSend` 가 `buildQueryOptions()` 로 활성 서버를 `query().options.mcpServers` + `allowedTools`(`mcp__<name>__*`) 에 주입. `SessionAdapter.sendMessage` 에 `mcp?: McpQueryOptions` 인자 추가. Skills(좌측)·권한 섹션은 mockup 유지. | **완료** |
| **MCP & Skill 통합 레이어** | **정규 소스 = `~/.config/orca/mcp.json`**(순정 Claude `mcpServers` 스키마 + `${VAR}`). 비밀은 평문 금지 — `secret-store`(safeStorage, env-var 이름 키잉)에 저장하고 소스엔 `${VAR}` 플레이스홀더만. `${VAR}` 확장 resolver 순서 = safeStorage → process.env (미해결 시 서버 드롭+사유). **양 백엔드 대칭 변환기** `toClaudeConfig`/`toOpencodeConfig` (둘 다 `Record<string, <Backend>Mcp>` 동형 반환, opencode 는 순수 함수+테스트만 — 어댑터 미구현). `enabled`/`description` 은 settings(`mcpEnabled`/`mcpMeta`) 가 보유(mcp.json 순정 유지). 레거시 `orca-mcp` → 파일 모델 1회 마이그레이션. Skill = `~/.config/orca/plugins/orca-skills` 플러그인 번들을 query() 에 `plugins`+`skills:'all'` 로 명시 로드. **Vitest 도입** (expand/convert 14 케이스). | **완료** |
| 후속    | CI 워크플로우 (`.github/workflows/`), Playwright 테스트, opencode 어댑터(변환기는 구현됨 — 어댑터/라이프사이클만 남음), `V1Captures` 실 구현 (캡처 RAW 보관 + AI 분석), 다국어 (`src/shared/i18n/ko.ts`), 세션 휴지통 30일 보존 (soft delete), 세션 메타 LRU 캐시 cap, 자동 제목 생성 (요약), Tile 우측 분할 콘텐츠 (`app-frame-tile-separator` 도입), `pages/RoutinesPage.tsx` placeholder + `/routines` 라우트 등록, **Phase 4 (Zustand 전환 + 멀티세션, `FRONTEND_ARCHITECTURE.md` §4.4)**. | Future Scope                |

## 위치 규약

- 사용자 의도 트랜스크립트 → `chats/` (참조: `chats/CLAUDE.md`)
- 제품 정의 / 구현 사양 / 전략 문서 → `docs/` (참조: `docs/CLAUDE.md`)
- 디자인 프로토타입 → `project/` (참조: `project/CLAUDE.md`)
- 실 구현체 → `app/` (여기)
- 저장소 전체 진입점 → `./CLAUDE.md`
