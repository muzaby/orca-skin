# app/ — 코딩 에이전트용 가이드

이 디렉토리는 **Orca v1 의 실제 구현체**가 사는 곳이다. 현재는 **Phase 3+ (로컬 SQLite SSOT + 사이드바 세션 히스토리 + DOM Architecture 적용)** 상태로, claude-code 어댑터 + 채팅 IPC + Composer 스킬 UX + `better-sqlite3` 기반 로컬 DB 영속화 + 사이드바 세션 관리 위에 **`app-frame-*` 구조 클래스 + `data-*` 행동/상태 마커 체계와 4종 신규 기능 (Custom titlebar `frame:false`, Grid z-stack, Sidebar resize-handle, Tile structure)** 이 추가되었다. 본 구현은 `docs/TRD.md` 의 사양과 `docs/FRONTEND_ARCHITECTURE.md` §3.3 의 DOM Architecture Specification 을 따른다.

## 현재 상태 (Phase 3+ — 로컬 DB + 세션 히스토리 + DOM Architecture)

| 영역                              | 상태                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 템플릿                            | `@quick-start/electron` `react-ts` (electron-vite 기반)                                                                                                                                    |
| 번들러                            | Vite (main/preload/renderer 3-config 통합)                                                                                                                                                 |
| Electron                          | 39.x — **`frame: false` + macOS `titleBarStyle: 'hidden'` + `trafficLightPosition`** (Phase 3+)                                                                                            |
| React                             | 19.x                                                                                                                                                                                       |
| TypeScript                        | 5.x (strict, target ES2022)                                                                                                                                                                |
| 스타일링                          | **Tailwind CSS v4** (`@tailwindcss/vite` 플러그인, CSS-first `@theme` 설정) + **`app-frame-*` 마커 클래스 + `data-behavior` / `data-state` / `data-axis` / `data-context` / `data-platform` 속성 공존** (FRONTEND §3.3) |
| 메인 (`src/main/index.ts`)        | IpcRouter 부트 + `createWindow` (`frame:false` + 윈도우 컨트롤 IPC `orca:window:{minimize,maximize,close}` 직접 부착). `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` 명시 |
| 렌더러 (`src/renderer/src/`)      | **Phase 1 시각 재현 + Phase 2 채팅 IPC + Phase 3 세션 히스토리 + Phase 3+ DOM Architecture** — Frame(`app-frame-root` + `FrameGrid`/`FrameBody`/`OverlaySlot`/`ModalSlot`/`DebugSlot`)/Titlebar(drag 2-layer + 플랫폼 분기)/Sidebar(실세션 + kebab + resize-handle + width 영속화)/ChatPane(`pane-host>pane-row>tile` 래핑)/CameraPane/Projects/EngineSettings/SkillsMcp + Tweaks(DebugSlot) + Installer/Auth modal(ModalSlot, backdrop 은 OverlaySlot). 캡처는 placeholder |
| 프리로드 (`src/preload/index.ts`) | `contextBridge.exposeInMainWorld('orca', OrcaApi)` — chat/backend/install/settings/skills/files/session/project/**window** 화이트리스트 + **`orca.platform` sync 노출**                  |
| 패키저                            | electron-builder (`electron-builder.yml`)                                                                                                                                                  |
| 도메인 코드 (IPC/어댑터)          | **claude-code 단일 어댑터 (SDK query)** + **로컬 SQLite SSOT** — ClaudeCodeAdapter(SDK NDJSON 정규화), AdapterRegistry, IpcRouter, Installer, SettingsStore, DbQueries (prepared statements), 마이그레이션 러너. opencode 는 future work                                  |
| 영속화 (`src/main/db/`)           | `better-sqlite3@^12` + `<userData>/orca.db` (WAL · foreign_keys ON). 스키마: `sessions / messages / tool_calls` + `_migrations` 메타. SQL 은 vite `?raw` 로 main 번들에 인라인              |
| 설정 영속화 (`src/main/settings/store.ts`) | `electron-store` + zod. `Settings.sidebarWidth: number` (180–480, default 248) 신설 (Phase 3+)                                                                                  |
| `package.json`                    | 템플릿 기본값 (`name: "app"`, `author: "example.com"` 등) — 차후 도메인 PR 에서 갱신                                                                                                       |

## 타깃 모듈 레이아웃 (TRD §1.2 기준)

경로는 electron-vite (`@quick-start/electron` react-ts 템플릿) 의 sub-config 분할을 반영한다. 빌드는 `electron.vite.config.ts` 의 main/preload/renderer 3개 sub-config 가 각각 처리한다.

| 경로                                                      | 책임                                                                            | 현 상태                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| `src/main/index.ts`                                       | Electron `app` 부트, BrowserWindow (`frame: false` + macOS `titleBarStyle: 'hidden'` + `trafficLightPosition`), IpcRouter 부착, 윈도우 컨트롤 IPC 3개 (`orca:window:{minimize,maximize,close}`) 직접 부착 | 구현됨 (Phase 3+)                       |
| `src/main/ipc/router.ts`                                  | IPC 채널 라우팅 + 입력 검증 (zod) + ChatEvent → DB persist (turn-local 상태 머신)| 구현됨 (Phase 3)                       |
| `src/main/adapters/types.ts`                              | `SessionAdapter`, `ChatEvent`, `Backend` 공통 타입                              | 구현됨                                  |
| `src/main/adapters/claude-code.ts`                        | `@anthropic-ai/claude-agent-sdk` query() · SDKMessage → ChatEvent 정규화        | 구현됨 (Phase 3 SDK 마이그레이션)       |
| `src/main/adapters/opencode.ts`                           | opencode `serve` / SDK / SSE                                                    | **미구현 (future work)**                |
| `src/main/adapters/registry.ts`                           | 설치 상태 + 활성 백엔드 선택                                                    | 구현됨 (claude-code 단일)               |
| `src/main/installer/index.ts`                             | CLI 설치 자동화 (`npm install -g @anthropic-ai/claude-code`)                    | 구현됨                                  |
| `src/main/settings/store.ts`                              | `electron-store` 단일 객체 스토어. `getAll()` / `patch()` 모두 zod 검증         | 구현됨 (Phase 2+)                       |
| `src/main/db/index.ts`                                    | `better-sqlite3` connection singleton, `<userData>/orca.db`, WAL · foreign_keys, 부팅 시 마이그레이션 1회 실행 | 구현됨 (Phase 3)        |
| `src/main/db/migrate.ts`                                  | `_migrations` 메타 테이블 기반 적용 추적. SQL 은 vite `?raw` 로 main 번들에 인라인 | 구현됨 (Phase 3)                       |
| `src/main/db/migrations/0001_initial.sql`                 | sessions / messages / tool_calls + 인덱스. **병합 후 절대 수정 금지**           | 구현됨 (Phase 3)                       |
| `src/main/db/queries.ts`                                  | 11개 prepared statements: list/load/append/update/rename/delete 세션·메시지·툴콜 | 구현됨 (Phase 3)                       |
| `src/main/db/types.ts`                                    | row · insert 인터페이스 (`SessionRow` / `MessageInsert` / `ToolCallInsert` 등)   | 구현됨 (Phase 3)                       |
| `src/main/files/scan.ts`                                  | `@` 파일 자동완성용 — `cwd + relDir` 한 단계 listing                            | 구현됨                                  |
| `src/shared/ipc.ts`                                       | `CHANNELS` 상수 + 순수 TS 타입. **zod 0 의존** (preload 안전). Phase 2 11채널 + Phase 3 session/project + Phase 3+ window 3채널. `Settings.sidebarWidth` 추가. SSOT 는 `docs/IPC_CONTRACT.md` §2 | 구현됨 (Phase 3+)                       |
| `src/shared/protocol.ts`                                  | zod 스키마 (main 전용). 타입은 `ipc.ts` 에서 re-export                          | 구현됨                                  |
| `src/renderer/src/state/chatReducer.ts`                   | ChatState reducer — SEND/RECV/NEW/CANCEL/CLEAR_ERROR + SET_CWD + LOAD/RENAME 세션 액션. `title` 필드로 즉시 제목 표시 | 구현됨 (Phase 3)                       |
| `src/renderer/src/state/useChat.ts`                       | useReducer + `chat.onEvent` 구독 + **세션 메모리 캐시** (`useRef<Map<id, CachedSession>>`) — 같은 세션 재진입 시 IPC 생략. `loadSession(id, title?)` · `renameSession` · `invalidateSessionCache` 노출 | 구현됨 (Phase 3)                       |
| `src/renderer/src/state/useSessions.ts`                   | `session.list` 메타 캐시 (부팅 1회 + 턴 종료 자동 refresh). `remove(id)` / `rename(id, title)` — IPC + refresh | 구현됨 (Phase 3)                       |
| `src/renderer/src/state/useBackend.ts`                    | 부트 시 `orca.backend.list()` 호출 → 설치 상태 보관                             | 구현됨                                  |
| `src/renderer/src/components/install/InstallerDialog.tsx` | 설치 진행 로그 + 수동 명령 복사                                                 | 구현됨                                  |
| `src/renderer/src/components/auth/AuthExpiredModal.tsx`   | `claude /login` 안내 + 새 대화                                                  | 구현됨                                  |
| `src/renderer/src/main.tsx`                               | React 엔트리 + DOM mount + 글로벌 CSS import                                    | 구현됨                                  |
| `src/renderer/src/App.tsx`                                | 루트 셸 — Tweaks state, theme/density/**platform** effect, 화면 라우팅, Frame 자식 슬롯 (Sidebar+body + OverlaySlot + ModalSlot + DebugSlot) 배치 | 구현됨 (Phase 3+)                       |
| `src/renderer/src/frame/Frame.tsx`                        | `Frame` (`app-frame-root`) + `FrameGrid` (1×1 z-stack) + `FrameBody` + `OverlaySlot` (modal backdrop, z 부호 반전) + `ModalSlot` (focus-trap, z 부호 반전) + `DebugSlot` (`#app-frame-debug`, 상시 z=30) sub-export. FRONTEND §3.3 SSOT | 구현됨 (Phase 3+)                       |
| `src/renderer/src/frame/Header.tsx`                       | `Header` — `app-frame-header` + drag 2-layer (absolute drag-region + relative content-layer) + 플랫폼 분기 (macOS 80px 좌측 패딩) + WinControls. 구 `Titlebar` 에서 rename — `app-frame-titlebar` (tile 헤더) 와의 혼동 제거. | 구현됨 (Phase 3+)                       |
| `src/renderer/src/frame/Sidebar.tsx`                      | `Sidebar` — `app-frame-sidebar` + `data-behavior="collapsible resizable"` + `data-state`. 새 대화, 메뉴, 프로젝트, **최근 대화 (실세션 메타 + 행 hover 시 kebab → "이름 변경" / "삭제(rust)" Popover 메뉴 + inline rename input)**, 엔진 footer. `SessionRow` 컴포넌트 분리 (`frame/sidebar/SessionRow.tsx`). **`app-frame-resize-handle` 자식 내장 (180–480px clamp, `Settings.sidebarWidth` 영속화)** | 구현됨 (Phase 3+)                       |
| `src/renderer/src/frame/ChatTile.tsx`                     | `app-frame-pane-host > pane-row > app-frame-tile` 래핑 — 채팅 tile 구현. 구 `ChatPane` 에서 rename (마크업 슬롯 `tile` 과 일치). 헤더 → `app-frame-titlebar`, 스크롤 → `app-frame-transcript` (`data-behavior="virtualizable"`), composer → `app-frame-composer` + 내부 sub-region (`composer-input` interactive, `composer-controls` 에 `composer-repo` 3-chip 행 dismissible). 메시지 / 툴 콜 / 테이블 / Composer + **헤더 제목 state.title fallback** + **로딩 인디케이터** | 구현됨 (Phase 3+)                       |
| `src/renderer/src/frame/sidebar/SessionRow.tsx`           | `app-frame-session-row` + `data-context="session"` + `data-state="active\|inactive"` + `data-behavior="interactive selectable\|interactive renaming"` + `data-session-id`. Sidebar 와 ProjectDetailScreen 양쪽에서 재사용 | 구현됨 (Phase 3+)                       |
| `src/renderer/src/frame/header/WinControls.tsx`           | minimize/maximize/close 버튼. macOS 에서 null 반환 (OS traffic light). 각 버튼 `data-behavior="action:window-*"` + `window.orca.window.*()` 호출. `app-frame-window-controls` 마커. (`components/atoms/` 에서 `frame/header/` 로 이동 — header 전용 슬롯 부속) | 구현됨 (Phase 3+)                       |
| `src/renderer/src/frame/composer/{HighlightedTextarea,SkillAutocomplete,FileAutocomplete}.tsx` | composer 슬롯 내부 부속. HighlightedTextarea (textarea + mirror overlay, `/skill` 활성 chip 강조 + caret 추적), SkillAutocomplete (caret 근처 floating dropdown), FileAutocomplete (`@path` floating dropdown). 두 autocomplete 는 `document.body` portal + `app-frame-floating` + `data-context="floating"` | 구현됨 (Phase 3+)                       |
| `src/renderer/src/frame/modal/{InstallerDialog,AuthExpiredModal}.tsx` | `#app-frame-modal` 슬롯에 그려지는 다이얼로그. 자체 backdrop 없음 — `#app-frame-overlay` 가 단독 담당. panel 만 `grid place-items-center` 로 중앙 배치 | 구현됨 (Phase 3+)                       |
| `src/renderer/src/frame/debug/{TweaksPanel,useTweaks}.{tsx,ts}` | `#app-frame-debug` 슬롯에 그려지는 floating UI + state hook. modal 상태와 무관하게 항상 z=30 | 구현됨                                  |
| `src/renderer/src/frame/theme.ts`                         | `ThemeId` / `DensityId` 타입 + `DENSITY_FONT` (색상은 CSS 변수가 진실)          | 구현됨                                  |
| `src/renderer/src/screens/{CameraScreen,ProjectsScreen,ProjectDetailScreen,EngineScreen,SkillsMcpScreen,CapturesScreen}.tsx` | tile 의 내용물 — 도메인 화면. CameraScreen (Bayer 뷰포트 / Histogram / Slider / Metric), ProjectsScreen (카드 그리드), ProjectDetailScreen (랜딩 + 내부 ChatTile + 세션 리스트), EngineScreen (엔진/모델 카드), SkillsMcpScreen (Skills / MCP / 권한), CapturesScreen (placeholder) | 구현됨                                  |
| `src/renderer/src/screens/registry.ts`                    | 화면 ID + 라벨 + breadcrumb 카탈로그 (구 `app/screens.ts`)                      | 구현됨                                  |
| `src/renderer/src/screens/chat/markdown/{Markdown,CodeBlock}.tsx` | ChatTile 의 transcript 내부 마크다운 렌더링 부속. react-markdown + shiki | 구현됨                                  |
| `src/renderer/src/screens/projects/{CreateProjectModal,EditInstructionsModal}.tsx` | Projects 도메인 부속 다이얼로그 | 구현됨                                  |
| `src/renderer/src/components/atoms/*`                     | 도메인-무관 UI atom: `Icon` (kebab/edit/trash 등), `Avatar`, `Status`+`Dot`, `BayerPattern`, `Histogram`, `Popover` (anchor-ref floating menu — body portal + `app-frame-floating` + `data-context="floating"`), `CopyIconButton`, `StatusLine` | 구현됨 (Tailwind 클래스)                |
| `src/main/skills/scan.ts`                                 | `~/.claude/skills/` · `<cwd>/.claude/skills/` 의 `SKILL.md` frontmatter 부팅 1회 스캔 | 구현됨                                  |
| `src/renderer/src/state/useSkills.ts`                     | `orca:skills:list` IPC 로 `SkillInfo[]` 캐시                                    | 구현됨                                  |
| `src/renderer/src/state/useSkillAutocomplete.ts`          | `text + caret + skills` → `{open, query, suggestions, activeIndex, tokenStart, close}`. render-time 비교 (effect 없음) | 구현됨                                  |
| `src/renderer/src/styles/tokens.css`                      | Tailwind `@theme` (시맨틱 토큰) + `[data-theme]` 스코프 (classic/dark/cool)     | 구현됨                                  |
| `src/renderer/src/styles/app.css`                         | Tailwind 엔트리 (`@import 'tailwindcss'`) + `@layer base` 리셋 + `@utility kbd` | 구현됨                                  |
| `src/preload/index.ts`                                    | `contextBridge.exposeInMainWorld` 화이트리스트                                  | 템플릿 기본 (Phase 2 에서 교체)         |
| `src/shared/protocol.ts`                                  | Renderer ↔ Main 메시지 스키마                                                   | 미작성 (Phase 2)                        |
| `src/shared/i18n/ko.ts`                                   | 한국어 라벨                                                                     | 미작성 (현재는 mockup 인라인 한국어)    |

> 이 레이아웃에서 벗어나려면 사용자에게 먼저 확인. TRD §1.2 와 코드를 동시에 갱신해야 한다.

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

**그룹 스코프 (`group` / `group-hover:`) 는 named group 으로 격리.** 자체 hover 인터랙션을 가진 컴포넌트 (코드블럭, 카드, 행 등) 는 익명 `group` 대신 `group/<컴포넌트명>` + `group-hover/<컴포넌트명>:` 패턴을 쓴다. 이유: `AssistantMessage` 같은 상위 컴포넌트가 이미 `.group` 으로 마킹돼 있을 때 익명 `group-hover:` 는 상위 group 까지 매칭되어 형제 인스턴스도 같이 hover 상태가 된다 (메시지 본문 hover → 그 메시지 내 모든 코드블럭의 카피 버튼이 동시에 노출되는 버그 사례). 예: `CodeBlock` 은 `group/codeblock` + `group-hover/codeblock:opacity-100` 으로 hover 범위를 자기 자신으로 한정한다 (`components/markdown/CodeBlock.tsx`). Sidebar 의 `SessionRow` 도 `group/session` + `group-hover/session:grid` 로 자기 kebab 버튼만 노출 (`app/Sidebar.tsx`).

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
- **로딩 인디케이터**: `loadingSession` flag — ChatPane 이 "대화 불러오는 중…" 한 줄.

## 의존성 정책

- TRD §2 의 Stack 표 밖의 패키지 추가는 **사용자 승인 필수**. PR 설명에 _왜_ 가 들어가야 한다.
- 이미 채택된 것 (도입 시점만 자유): React, react-markdown, shiki, electron-store, zod, vitest, playwright.
- 설치 완료: **Tailwind CSS v4** (`tailwindcss@^4`, `@tailwindcss/vite@^4`), **`better-sqlite3@^12`** (Phase 3 — Electron 39 V8 ABI 호환을 위해 12.x 메이저 사용. Windows prebuild 포함).
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
| `npm test`            | **미설정** — Vitest 추가 시 채워라 (TRD §10.1)                    |

## 에이전트 원칙

1. **`docs/TRD.md` 먼저 읽고 코드 짜라.** 본 디렉토리 작업의 1차 사양은 TRD. PRD §11 / TRD §15 Open Questions 는 단독 결정 금지.
2. **위 모듈 레이아웃을 따르라.** 스캐폴드의 평면 구조에 코드 누적 금지. `src/main/`, `src/preload/`, `src/renderer/src/`, `src/shared/` 로 분리한 뒤 진행.
3. **스타일은 Tailwind 클래스 + 시맨틱 토큰.** 인라인 `style` 은 동적 계산값에만 사용. 새 토큰은 `styles/tokens.css` 의 `@theme` 에 추가하고 세 테마 스코프 모두에 대응값을 채울 것.
4. **새 의존성 추가 시 사용자 확인.** TRD §2 표 밖이면 PR 설명에 사유 명시.
5. **Electron 보안 옵션은 항상 명시.** 기본값 의존 금지. 위 code block 참고.
6. **테스트 동반.** 어댑터 정규화, reducer, IPC 스키마는 단위 테스트와 함께 작성 (TRD §10). Phase 1 UI 는 시각 검증으로 갈음.
7. **`package.json` 메타데이터는 템플릿 기본값이다.** 차후 도메인 PR 에서 `name`, `productName`, `description`, `author` 갱신. `electron-builder.yml` 도 검토.
8. **TRD 와 코드가 충돌하면 사용자에게 물어라.** TRD 갱신과 코드 변경은 같은 PR 또는 짝 PR 로.

## Phase 로드맵

| Phase   | 범위                                                                                                                                                   | 상태                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Phase 1 | mockup 시각 재현 + Tailwind CSS v4 마이그레이션. chat / projects / engine / skills 4개 화면 + Tweaks. 캡처는 placeholder                               | **완료**                    |
| Phase 2 | IPC 채널 + zod 검증. **Claude Code 단일** 어댑터. 세션 재개. UI 데이터를 mockup 하드코딩 → IPC props 로 교체                                           | **완료 (claude-code 단독)** |
| Phase 2+ | `electron-store` 영속화 — Tweaks (theme/density/sidebarCollapsed), `lastSessionId`, `lastBackend`, window bounds                                       | **완료**                    |
| Phase 2++ | Composer 스킬 UX — `SKILL.md` 스캔 · `orca:skills:list` IPC · 3-chip 행 (첨부·현재 프레임·Skill) · Skill picker popover · 활성 스킬 `/skillname` chip 강조 · 인라인 자동완성 dropdown | **완료**                    |
| **Phase 3** | **로컬 SQLite SSOT** — `better-sqlite3@^12` + `<userData>/orca.db` (sessions / messages / tool_calls). 마이그레이션 러너 + WAL · foreign_keys. ChatEvent → DB persist (router turn-local 상태). 사이드바 "최근 대화" 실세션 연동 · **비동기 lazy load** (메타 부팅 1회 + messages 진입 시점 1회) · **메모리 캐시** (재진입 IPC 생략) · **즉시 제목 표시** (state.title). 사이드바 행 **kebab 메뉴** (이름 변경 / 삭제) + inline rename. 부팅 시 lastSessionId 자동 복원 (메시지까지 비동기 fetch). | **완료 (PR #20)**           |
| **Phase 3+** | **DOM Architecture 일괄 적용** — `app-frame-*` 마커 클래스 + `data-behavior` / `data-state` / `data-axis` / `data-context` / `data-platform` 체계. 4종 신규 기능: ① Custom titlebar (`frame: false` + macOS `titleBarStyle: 'hidden'` + 윈도우 컨트롤 IPC 3개 + `orca.platform` sync 노출), ② Grid z-stack (`#app-frame-overlay` modal backdrop 전용 z 부호 반전 + `#app-frame-modal` focus-trap + `#app-frame-debug` floating UI 호스트 3슬롯), ③ Sidebar resize-handle (180–480px clamp, `Settings.sidebarWidth` 영속화), ④ Tile structure (`pane-host > pane-row > tile` 마크업). SSOT 는 `docs/FRONTEND_ARCHITECTURE.md` §3.3. | **완료 (브랜치 `claude/charming-galileo-7lAqY`, 커밋 `45e129f` + 정정 `acf1295`)** |
| 후속    | opencode 어댑터, `V1Captures` 실 구현 (캡처 RAW 보관 + AI 분석). 다국어 (`src/shared/i18n/ko.ts`). Vitest / Playwright 테스트. 세션 휴지통 30일 보존 (soft delete). 세션 메타 LRU 캐시 cap. 자동 제목 생성 (요약). Tile 우측 분할 콘텐츠 (`app-frame-tile-separator` 도입). | Future Scope                |

## 위치 규약

- 사용자 의도 트랜스크립트 → `chats/` (참조: `chats/CLAUDE.md`)
- 제품 정의 / 구현 사양 / 전략 문서 → `docs/` (참조: `docs/CLAUDE.md`)
- 디자인 프로토타입 → `project/` (참조: `project/CLAUDE.md`)
- 실 구현체 → `app/` (여기)
- 저장소 전체 진입점 → `./CLAUDE.md`
