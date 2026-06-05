# Frontend Architecture — Layers & App Shell (4-layer·디렉토리·boundaries)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (FRONTEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [overview.md](./overview.md), [dom-architecture.md](./dom-architecture.md), [state.md](./state.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 디렉토리 구조

### 1-1. 현재 상태 (코드 기준)

`app/src/renderer/src/` 의 실제 트리 (PR #29 적용 완료 — 2026-05-27 검증). 4-layer (`app/` · `pages/` · `features/` · `shared/`) 가 ESLint boundaries v6 로 강제됨.

```
src/renderer/
├── index.html                       # React 마운트 + CSP + Google Fonts link
└── src/
    ├── main.tsx                     # React entrypoint (createRoot) + 글로벌 CSS import
    ├── App.tsx                      # Provider 합성 루트 (Tweak → Navigation → Backend → Sessions → Projects → Chat)
    ├── env.d.ts                     # Vite 클라이언트 타입
    │
    ├── app/                         ✅ 셸 — 고정 골격. cross-feature wiring 권한.
    │   ├── AppLayout.tsx            # Header + Sidebar (슬롯) + main + OverlayLayer 조립. 본체는 wiring hook 호출 + JSX 만
    │   ├── Header.tsx               # `app-frame-header` — 브랜드 + breadcrumb + WinControls + drag 2-layer
    │   ├── Sidebar.tsx              # `app-frame-sidebar` — NAV + collapsible/resizable + 3개 슬롯 (newChat/sessions/footer). React.memo + 도메인 특정 설정값 (SIDEBAR_MIN/MAX/DEFAULT_WIDTH) 유지
    │   ├── OverlayLayer.tsx         # `#app-frame-overlay` + `#app-frame-modal` + `#app-frame-debug` 3슬롯 통합
    │   ├── WinControls.tsx          # minimize/maximize/close IPC. macOS → null
    │   ├── router.tsx               # `<Routes>` — URL path → Page (which). `/`=BootRedirector · `/new`=NewChatLandingPage · `/chat`→/new · `/chat/:sessionId`=ChatPage · `/projects` · `/projects/:projectId` · `/engine` · `/skills` · `/captures` · `*`→/new
    │   ├── BootRedirector.tsx       # `/` 라우트 element — settings.lastSessionId → `/chat/<id>` 또는 `/new` replace
    │   └── hooks/                   # cross-feature wiring (셸 내부 전용)
    │       ├── useChatRouteSync.ts      # URL ↔ ChatState 동기화 (방향 1: `/new` · `/chat/:id` · `/projects/:id` 모두 처리, 방향 2: armed-ref 패턴 — sessionId null→non-null 전이 시 `/chat/<id>` replace)
    │       ├── useChatSessionsSync.ts   # inflight: true→false 전환 감지 → sessionsCtx.refresh(). 폴링·pub-sub 없음. AppLayout 에서 호출 (cross-feature wiring 권한 보유).
    │       ├── useSessionHandlers.ts    # navigate(`/chat/<id>`)/chat/sessions 핸들러 합성 + projectNameById. currentSessionId = URL matchPath('/chat/:sessionId') 로 도출 (ChatContext.state 아님 — 활성 하이라이트 SSOT = URL).
    │       └── useSidebarSlots.tsx      # Sidebar React.memo 효과 위한 slot ReactNode 안정화
    │
    ├── pages/                       ✅ 조립 전용 — Context 읽기 + features 배치. 비즈니스 로직 0.
    │   ├── NewChatLandingPage.tsx   # `/new` — empty 시 중앙 Composer (랜딩), 메시지 있으면 ChatTile
    │   ├── ChatPage.tsx             # `/chat/:sessionId` — useBackendContext → ChatView.backendLabel wiring
    │   ├── ProjectsPage.tsx         # ProjectsView 단순 배치
    │   ├── ProjectLandingPage.tsx   # 프로젝트 채팅 랜딩 (ChatTile + ProjectSessionsPanel + ProjectInstructionsSidebar). 랜딩 라이프사이클은 셸의 useChatRouteSync 가 담당
    │   ├── EnginePage.tsx
    │   ├── SkillsPage.tsx
    │   └── CapturesPage.tsx
    │
    ├── features/                    ✅ 도메인 모듈 — 자기 레이어 내부만 의존. cross-feature import 금지.
    │   ├── backend/                 # BackendProvider, useBackend, BackendStatus, InstallerDialog, AuthExpiredModal
    │   ├── chat/                    # ChatProvider, useChat, useSkillAutocomplete, useFileAutocomplete,
    │   │                            #   chatReducer, ChatTile, Composer, ChatView, NewChatButton, composer/, transcript/, markdown/, format.ts
    │   ├── sessions/                # SessionsProvider, useSessions, useProjectSessions, SessionList, SessionRow, ProjectSessionsPanel
    │   ├── projects/                # ProjectsProvider, useProjects, ProjectsView/Screen, ProjectLandingHeader,
    │   │                            #   ProjectInstructionsSidebar, CreateProjectModal, EditInstructionsModal
    │   ├── skills/                  # useSkillsMcp, SkillsMcpView
    │   ├── camera/                  # CameraView
    │   ├── engine/                  # EngineView
    │   └── captures/                # CapturesView
    │
    ├── shared/                      ✅ 범용 — 도메인 로직 0. 모든 레이어 의존 가능.
    │   ├── navigation/              # routes.ts (path 패턴 + 라벨 + breadcrumb 카탈로그 — AppLayout matchPath 소스)
    │   ├── theme/                   # TweakProvider, useTweakContext
    │   ├── hooks/                   # useTweaks (theme/density), useSkills (orca:skills:list), useDragResize (1D 드래그→숫자 일반 메커니즘)
    │   ├── api/ipc.ts               # `window.orca.*` 타입드 래퍼 — chatApi/backendApi/installApi/settingsApi/skillApi/fileApi/sessionApi/projectApi/windowApi
    │   ├── config/theme.ts          # ThemeId / DensityId 타입 + DENSITY_FONT
    │   └── ui/                      # Icon, Avatar, Status, Dot, Popover, CopyIconButton, StatusLine, TweaksPanel, BayerPattern, Histogram
    │
    └── styles/                      ✅
        ├── tokens.css               # Tailwind @theme + [data-theme] 스코프
        └── app.css                  # @import tailwindcss + @layer base + @utility kbd
```

> **부재 확인 (`frame/` · `screens/` · `state/` · `components/`)**: 위 세 디렉토리는 코드에 존재하지 않는다. PR #29 가 이들을 4-layer 로 완전 해체했다. 과거 매핑은 §1-2 이행 이력 참조.

### 1-2. 이행 이력 (PR #29 적용 완료, 2026-05-27)

> 본 절은 **이행 이력** 으로만 보존. 현재 상태는 §1-1 가 SSOT. PR #29 가 `frame/` · `screens/` · `state/` 를 모두 해체해 아래 매핑대로 분산했다.

**`frame/` 해체 귀속 매핑:**

| 구 위치 | 현 위치 |
|---|---|
| `frame/Header.tsx` | `app/Header.tsx` |
| `frame/Sidebar.tsx` (레이아웃) | `app/Sidebar.tsx` |
| `frame/ModalLayer.tsx` + `frame/DebugLayer.tsx` | `app/OverlayLayer.tsx` (통합 3슬롯) |
| `frame/header/WinControls.tsx` | `app/WinControls.tsx` |
| `frame/Frame.tsx` / FrameGrid | `app/AppLayout.tsx` 인라인 흡수 |
| `frame/ChatTile.tsx` | `features/chat/components/ChatTile.tsx` |
| `frame/composer/` (전체) | `features/chat/components/composer/` |
| `frame/sidebar/SessionRow.tsx` | `features/sessions/components/SessionRow.tsx` |
| `frame/modal/InstallerDialog.tsx` · `AuthExpiredModal.tsx` | `features/backend/components/` |
| `frame/debug/TweaksPanel.tsx` | `shared/ui/TweaksPanel.tsx` |
| `frame/debug/useTweaks.ts` | `shared/hooks/useTweaks.ts` |
| `frame/theme.ts` | `shared/config/theme.ts` |

**`screens/` 해체 귀속 매핑:**

| 구 위치 | 현 위치 |
|---|---|
| `screens/registry.ts` | `shared/navigation/screens.ts` + `shared/types/screen.ts` |
| `screens/CameraScreen.tsx` | `features/camera/components/` |
| `screens/ProjectsScreen.tsx` | `features/projects/components/` |
| `screens/ProjectDetailScreen.tsx` | (해체) `pages/ProjectLandingPage.tsx` + `features/projects/components/ProjectLandingHeader.tsx` + `ProjectInstructionsSidebar.tsx` |
| `screens/EngineScreen.tsx` | `features/engine/components/` |
| `screens/SkillsMcpScreen.tsx` | `features/skills/components/` |
| `screens/CapturesScreen.tsx` | `features/captures/components/` |
| `screens/chat/` (transcript 부속) | `features/chat/components/transcript/` |
| `screens/chat/markdown/` | `features/chat/components/markdown/` |
| `screens/projects/CreateProjectModal.tsx` · `EditInstructionsModal.tsx` | `features/projects/components/` |

**`state/` 해체 귀속 매핑:**

| 구 위치 | 현 위치 |
|---|---|
| `state/chatReducer.ts` | `features/chat/reducer/chatReducer.ts` |
| `state/useChat.ts` | `features/chat/hooks/useChat.ts` |
| `state/useSkillAutocomplete.ts` · `useFileAutocomplete.ts` | `features/chat/hooks/` |
| `state/useSessions.ts` | `features/sessions/hooks/` |
| `state/useProjects.ts` | `features/projects/hooks/` |
| `state/useProjectSessions.ts` | `features/sessions/hooks/` |
| `state/useBackend.ts` | `features/backend/hooks/` |
| `state/useSkills.ts` | `shared/hooks/useSkills.ts` |

**`window.orca.*` 직접 호출 → 래퍼 경유**: PR #29 에서 `shared/api/ipc.ts` 타입드 래퍼 도입. `features/` 내부에서 `window.orca.*` 직접 호출 0건 확인.

### 1.1 디렉토리 책임 규칙

> PR #29 로 강제됨 (ESLint `eslint-plugin-boundaries` v6 `boundaries/dependencies` 규칙). 의존 방향: `app/` → `pages/` → `features/` → `shared/`. 위반 시 `npm run lint` 가 차단.

- **`app/`**: Provider 합성 + 라우터 + 앱 셸 레이아웃 원자. `router.tsx` = 어느 pages/를 보여줄지. `AppLayout.tsx` = 셸 조립 (wiring hook 호출 + JSX 만). Header/Sidebar/OverlayLayer/WinControls = 레이아웃 컴포넌트 — 셸의 *도메인 특정 설정값과 적용* (예: `SIDEBAR_MIN/MAX/DEFAULT_WIDTH` + `setTweak('sidebarWidth', n)`) 은 컴포넌트 자체에 잔류 (공용 인프라가 아니므로). cross-feature wiring (chat→sessions 동기화, 다중 도메인 핸들러 합성, slot 안정화 등) 은 **`app/hooks/`** 에 캡슐화. ❌ 도메인 비즈니스 로직 (UI 위젯 설정/적용을 넘어선 도메인 규칙) 금지.
- **`pages/`**: 라우터가 `<Outlet>` (`app-frame-body > main`) 에 마운트하는 진입점. **무엇을 배치할지 조립만. 비즈니스 로직 없음.** features/ + shared/ 를 가져다 배치하는 역할.
- **`features/<domain>/`**: 도메인 기능 모듈. 6-슬롯 (`components/` / `hooks/` / `api/` / `store/` / `types.ts` / `index.ts`). 외부 노출: `index.ts` barrel 만. 다른 feature 의 내부 파일 직접 import 금지. features 간 직접 의존 금지 — 공유 필요 시 `shared/` 로. **IPC 호출: `shared/api/ipc.ts` 래퍼 경유만 허용. `window.orca.*` 직접 호출 금지.**
- **`shared/`** (renderer 내부): 도메인 지식 없는 재사용 자산. `ui/` = 도메인-무관 UI 원자 (구 `components/atoms/`). `hooks/` = 도메인-무관 hook — 셸 컴포넌트의 *재사용 가능한 메커니즘* (예: 1D 드래그→숫자 `useDragResize`) 도 여기에. *도메인 특정 설정* (sidebar 폭 경계, sessions 액션 wiring 등) 은 shared 자격 미달. `api/ipc.ts` = `window.orca.*` 타입드 래퍼. `config/` = 상수·테마 타입. **store / 도메인 hook import 금지.**
- **`styles/`**: Tailwind + CSS 변수만. JS 의존 없음.

### 1.2 새 파일을 만들 때 결정 흐름

1. **어느 페이지를 보여줄지 (라우팅)?** → `app/router.tsx` 에 경로 추가
2. **페이지 조립 (배치만, 로직 없음)?** → `pages/XxxPage.tsx`
3. **도메인 비즈니스 로직 (컴포넌트·hook·reducer)?** → `features/<domain>/components/` 또는 `features/<domain>/hooks/`
4. **도메인-무관 UI 원자 (presentational only)?** → `shared/ui/`
5. **도메인-무관 hook?** → `shared/hooks/`
6. **앱 셸 레이아웃 (라우팅 시 재마운트 없는 고정 컴포넌트)?** → `app/` 직속
7. **CSS 변수 추가?** → `styles/tokens.css` 의 `@theme` + 세 테마 스코프 모두

> 분해 가이드 (`app/CLAUDE.md` 원칙 9): 한 파일이 (a) 5+ 컴포넌트를 담거나 (b) 400줄을 넘으면 분해 검토. 새 파일은 위 결정 흐름에 따라 배치.

### 1.A App Shell 조립 규칙 (PR #29 적용 완료)

#### 정규 레이아웃 다이어그램

```
app/AppLayout.tsx
└── app-frame                                    ← Frame 컨테이너
    ├── Header (TitleBar)                        ← 고정. 라우팅 시 재마운트 없음.
    ├── app-body (flex row)
    │   ├── Sidebar (aside)                      ← 고정. React.memo. 전용 selector만.
    │   └── main [data-context="route-target"]
    │       └── <Outlet />                       ← ★ 여기만 라우팅 전환 시 교체 → pages/ 마운트
    └── OverlayLayer                             ← z-index 토글, useOverlay() hook 제어
```

#### 슬롯별 불변 규칙

| 슬롯 | 규칙 | 위반 예시 |
|---|---|---|
| **Header** | 라우팅 변경 시 재마운트 없음. 도메인 상태 직접 소비 금지. | Header 안에서 useChat() 호출 |
| **Sidebar** | `React.memo()` 필수. NavigationContext/TweakContext/SessionsContext selector만 구독. ChatContext 직접 구독 금지. | Sidebar 에서 chat 스트리밍 상태 읽기 |
| **`<Outlet>`** | `app-frame-main` 슬롯 자식만 교체. Header/Sidebar unmount 없음. | 화면 전환 시 Header 리렌더 |
| **OverlayLayer** | `ModalLayer + DebugLayer` 통합. `useOverlay()` hook이 `modalActive` bool 관리. z-index 직접 토글. | 별도 backdrop 컴포넌트 추가 |

#### 조립 위치 원칙

- 셸 조립 = `app/AppLayout.tsx` 단일 파일에서 직접.
- `AppShell`, `AppContainer` 등 중간 wrapper 로 숨기지 않는다.
- Provider 합성은 `app/providers/` 에서 수행, 조립 파일은 JSX 레이아웃만.

#### 3계층 역할 구분

| 계층 | 역할 |
|---|---|
| `app/router.tsx` | **어느 pages/를 보여줄지** 결정 |
| `pages/XxxPage.tsx` | **무엇을 배치할지** 조립만 (비즈니스 로직 없음) |
| `features/<domain>/` | **실제 비즈니스 로직** (components + hooks + reducer) |

#### 적용 결과 (PR #29 + PR #30)

| 항목 | 적용 후 상태 |
|---|---|
| `frame/` 디렉토리 | ✅ 부재 — `app/` / `features/` / `shared/` 로 완전 분산 (§1-2 매핑) |
| ChatTile 위치 | ✅ `features/chat/components/ChatTile.tsx` |
| Composer 위치 | ✅ `features/chat/components/composer/` |
| 오버레이 | ✅ `app/OverlayLayer.tsx` 통합 (overlay/modal/debug 3슬롯, z 부호 반전 토글) |
| AppLayout 본체 | ✅ wiring 3-hook (`app/hooks/useChatSessionsSync` · `useSessionHandlers` · `useSidebarSlots`) 로 분리. 본체는 hook 호출 + JSX 조립만 (30여 줄). 도메인 Context 직접 구독 0건. |
| Sidebar 메모이제이션 | ✅ `React.memo()` + NavigationContext/TweakContext selector 한정 구독 (도메인 슬롯은 props 주입) |
| Sidebar 드래그 메커니즘 | ✅ `shared/hooks/useDragResize` 로 분리 (sidebar 핸들바·설정값 모르는 일반 1D 드래그→숫자 hook). `SIDEBAR_MIN/MAX/DEFAULT_WIDTH` 상수·`asideRef`·`setTweak('sidebarWidth', n)` 적용은 Sidebar 잔류 (도메인 특정 설정) |

---

