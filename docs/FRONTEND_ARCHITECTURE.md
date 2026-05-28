# Frontend Architecture

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-05-27 (PR #29 적용 완료 반영. §3-1 트리를 실제 코드 구조로 교체, §3-2 를 이행 이력으로 재정렬, §3.A / §10 의 "구현 대기" 표기를 "PR #29 적용 완료" 로 갱신. `frame/` · `screens/` · `state/` 디렉토리 부재 — `app/` · `pages/` · `features/` · `shared/` 4-layer 가 SSOT.)
> 관련 문서: [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md), [IPC_CONTRACT.md](./IPC_CONTRACT.md), [GLOSSARY.md](./GLOSSARY.md), [TRD.md](./TRD.md) §6 데이터 모델, [PRD.md](./PRD.md) §8 / §9 / §10
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 이 문서의 범위

**다루는 것**
- Electron Renderer Process 의 UI 렌더링, 상태 관리, 사용자 입력 처리
- 컴포넌트 구조 및 디렉토리 컨벤션
- 도메인 화면 카탈로그 (Chat / Projects / Engine / SkillsMcp / Tweaks)
- IPC 호출 방식 (Renderer 측 관점)
- Tailwind v4 + CSS 토큰 기반 테마 시스템

**다루지 않는 것 (→ BACKEND_ARCHITECTURE.md 참조)**
- SDK / LLM 호출 구현
- 데이터 영속성 (electron-store, 로컬 DB)
- 자격증명 저장, 보안 처리
- IPC 핸들러 구현, Main Process 구조

---

## 2. 기술 스택

`app/package.json` 기준 (2026-05-20).

| 영역 | 선택 | 버전 | 비고 |
|---|---|---|---|
| UI 프레임워크 | React | ^19.2.1 | PRD OQ1 확정 (2026-05) |
| 언어 | TypeScript | ~5.x (strict, target ES2022) | tsconfig.web.json 분리 |
| 빌드 도구 | electron-vite | ^5.0.0 | 3-config (main/preload/renderer) |
| 상태 관리 | **현재: React Context + useReducer.** Zustand 전환 예정 (Future) | — | 단일 inflight + props drilling 모델로 시작. 멀티세션 (Phase 4) / 영속성 통합 시점에 Zustand 로 전환 — §4.4 참조 |
| 라우팅 | **`react-router-dom` v7 BrowserRouter** + `app://` 커스텀 스킴 (production) / Vite dev server (dev). `app/router.tsx` 의 `<Routes>` 가 URL path → Page 매핑. `app/BootRedirector.tsx` 가 `/` → `/chat/<lastSessionId>` 또는 `/new` replace. `app/hooks/useChatRouteSync.ts` 가 URL ↔ ChatState 양방향 동기화. `app/AppLayout.tsx` 가 Header · Sidebar · `<AppRouter />` · OverlayLayer 를 직접 조립. | ^7.10.1 | §3.A App Shell 조립 규칙 참조. path 카탈로그 (라벨/breadcrumb) 는 `shared/navigation/routes.ts` |
| 스타일링 | Tailwind CSS v4 (`@tailwindcss/vite`) + CSS-first `@theme` 토큰 | ^4.1.16 | `tailwind.config.js` 없음. Tailwind 유틸 + `app-frame-*` 마커 클래스 (§3.3) **공존**. |
| 마크다운 렌더링 | react-markdown + remark-gfm | ^9.1.0 / ^4.0.1 | GFM 테이블·체크박스 지원 |
| 코드 하이라이팅 | shiki (async 싱글톤 로드) | ^1.29.2 | 11언어 + 3테마, MutationObserver 로 data-theme 추적 |
| 가상 스크롤 | **미사용** (TanStack Virtual 등 채택 안 됨) | — | 임계값·도입 시점 모두 TBD |
| 폰트 | Google Fonts CDN (Source Serif 4 / Inter / JetBrains Mono) | — | `index.html` link, CSP 허용 |
| 플랫폼 통합 | Electron `frame: false` + custom titlebar | — | macOS `titleBarStyle: 'hidden'` + traffic light overlay, Windows/Linux 는 WinControls 가 직접 그림 (§3.3 / §6.5) |

---

## 3. 디렉토리 구조

### 3-1. 현재 상태 (코드 기준)

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
    │       ├── useChatSessionsSync.ts   # chat 턴 완료 → sessions 자동 refresh
    │       ├── useSessionHandlers.ts    # navigate(`/chat/<id>`)/chat/sessions 핸들러 합성 + projectNameById
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

> **부재 확인 (`frame/` · `screens/` · `state/` · `components/`)**: 위 세 디렉토리는 코드에 존재하지 않는다. PR #29 가 이들을 4-layer 로 완전 해체했다. 과거 매핑은 §3-2 이행 이력 참조.

### 3-2. 이행 이력 (PR #29 적용 완료, 2026-05-27)

> 본 절은 **이행 이력** 으로만 보존. 현재 상태는 §3-1 가 SSOT. PR #29 가 `frame/` · `screens/` · `state/` 를 모두 해체해 아래 매핑대로 분산했다.

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

### 3.1 디렉토리 책임 규칙

> PR #29 로 강제됨 (ESLint `eslint-plugin-boundaries` v6 `boundaries/dependencies` 규칙). 의존 방향: `app/` → `pages/` → `features/` → `shared/`. 위반 시 `npm run lint` 가 차단.

- **`app/`**: Provider 합성 + 라우터 + 앱 셸 레이아웃 원자. `router.tsx` = 어느 pages/를 보여줄지. `AppLayout.tsx` = 셸 조립 (wiring hook 호출 + JSX 만). Header/Sidebar/OverlayLayer/WinControls = 레이아웃 컴포넌트 — 셸의 *도메인 특정 설정값과 적용* (예: `SIDEBAR_MIN/MAX/DEFAULT_WIDTH` + `setTweak('sidebarWidth', n)`) 은 컴포넌트 자체에 잔류 (공용 인프라가 아니므로). cross-feature wiring (chat→sessions 동기화, 다중 도메인 핸들러 합성, slot 안정화 등) 은 **`app/hooks/`** 에 캡슐화. ❌ 도메인 비즈니스 로직 (UI 위젯 설정/적용을 넘어선 도메인 규칙) 금지.
- **`pages/`**: 라우터가 `<Outlet>` (`app-frame-body > main`) 에 마운트하는 진입점. **무엇을 배치할지 조립만. 비즈니스 로직 없음.** features/ + shared/ 를 가져다 배치하는 역할.
- **`features/<domain>/`**: 도메인 기능 모듈. 6-슬롯 (`components/` / `hooks/` / `api/` / `store/` / `types.ts` / `index.ts`). 외부 노출: `index.ts` barrel 만. 다른 feature 의 내부 파일 직접 import 금지. features 간 직접 의존 금지 — 공유 필요 시 `shared/` 로. **IPC 호출: `shared/api/ipc.ts` 래퍼 경유만 허용. `window.orca.*` 직접 호출 금지.**
- **`shared/`** (renderer 내부): 도메인 지식 없는 재사용 자산. `ui/` = 도메인-무관 UI 원자 (구 `components/atoms/`). `hooks/` = 도메인-무관 hook — 셸 컴포넌트의 *재사용 가능한 메커니즘* (예: 1D 드래그→숫자 `useDragResize`) 도 여기에. *도메인 특정 설정* (sidebar 폭 경계, sessions 액션 wiring 등) 은 shared 자격 미달. `api/ipc.ts` = `window.orca.*` 타입드 래퍼. `config/` = 상수·테마 타입. **store / 도메인 hook import 금지.**
- **`styles/`**: Tailwind + CSS 변수만. JS 의존 없음.

### 3.2 새 파일을 만들 때 결정 흐름

1. **어느 페이지를 보여줄지 (라우팅)?** → `app/router.tsx` 에 경로 추가
2. **페이지 조립 (배치만, 로직 없음)?** → `pages/XxxPage.tsx`
3. **도메인 비즈니스 로직 (컴포넌트·hook·reducer)?** → `features/<domain>/components/` 또는 `features/<domain>/hooks/`
4. **도메인-무관 UI 원자 (presentational only)?** → `shared/ui/`
5. **도메인-무관 hook?** → `shared/hooks/`
6. **앱 셸 레이아웃 (라우팅 시 재마운트 없는 고정 컴포넌트)?** → `app/` 직속
7. **CSS 변수 추가?** → `styles/tokens.css` 의 `@theme` + 세 테마 스코프 모두

> 분해 가이드 (`app/CLAUDE.md` 원칙 9): 한 파일이 (a) 5+ 컴포넌트를 담거나 (b) 400줄을 넘으면 분해 검토. 새 파일은 위 결정 흐름에 따라 배치.

### 3.A App Shell 조립 규칙 (PR #29 적용 완료)

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
| `frame/` 디렉토리 | ✅ 부재 — `app/` / `features/` / `shared/` 로 완전 분산 (§3-2 매핑) |
| ChatTile 위치 | ✅ `features/chat/components/ChatTile.tsx` |
| Composer 위치 | ✅ `features/chat/components/composer/` |
| 오버레이 | ✅ `app/OverlayLayer.tsx` 통합 (overlay/modal/debug 3슬롯, z 부호 반전 토글) |
| AppLayout 본체 | ✅ wiring 3-hook (`app/hooks/useChatSessionsSync` · `useSessionHandlers` · `useSidebarSlots`) 로 분리. 본체는 hook 호출 + JSX 조립만 (30여 줄). 도메인 Context 직접 구독 0건. |
| Sidebar 메모이제이션 | ✅ `React.memo()` + NavigationContext/TweakContext selector 한정 구독 (도메인 슬롯은 props 주입) |
| Sidebar 드래그 메커니즘 | ✅ `shared/hooks/useDragResize` 로 분리 (sidebar 핸들바·설정값 모르는 일반 1D 드래그→숫자 hook). `SIDEBAR_MIN/MAX/DEFAULT_WIDTH` 상수·`asideRef`·`setTweak('sidebarWidth', n)` 적용은 Sidebar 잔류 (도메인 특정 설정) |

---

### 3.3 DOM Architecture Specification (Phase 3+)

> **채택 결정 (2026-05-26)**: 렌더러 전체에 구조 식별 클래스 + 행동/상태 메타 속성을 부여하는 마크업 컨벤션. 외부 도구(테스트·접근성·디버깅 인스펙터·디자인 시스템 분리)가 DOM 만으로 셸 구조와 인터랙션 상태를 읽을 수 있게 한다. 단일 PR (`claude/charming-galileo-7lAqY`, 커밋 `45e129f` + 정정 `acf1295`) 로 일괄 적용 완료.

#### 3.3.1 속성 체계 — 역할 분리

| 속성 | 역할 | 예시 |
|---|---|---|
| `class="app-frame-*"` | 구조 식별 — *이게 뭐다* | `app-frame-sidebar`, `app-frame-tile`, `app-frame-composer-input` |
| `class="<tailwind>"` | 스타일링 — *이렇게 생겼다* | `flex flex-col w-56 bg-sidebar` |
| `data-behavior="..."` | JS 행동 — *이걸 할 수 있다* | `drag-region`, `no-drag`, `resizable`, `collapsible`, `virtualizable`, `interactive`, `focus-trap`, `dismissible`, `action:{name}` |
| `data-state="..."` | 현재 상태 — *지금 이 상태다* | `expanded`/`collapsed`, `visible`/`hidden` |
| `data-axis`, `data-context` | 메타 설정 — *이런 조건이다* | `vertical`/`horizontal`, `sidebar`/`tile`/`modal`/`overlay`/`debug` |
| `data-theme`, `data-platform` | 루트 환경 — `<html>` 에만 | `classic`/`dark`/`cool`, `darwin`/`win32`/`linux` |

**원칙**: 두 속성은 **공존**한다. `app-frame-*` 클래스는 마커이며 시각 스타일은 같은 element 의 Tailwind 유틸이 계속 진실. 마커 부여로 인한 시각 회귀는 없어야 한다.

#### 3.3.2 DOM 골격 트리

```
html[data-theme][data-platform]
└── #root
    └── .app-frame-root                                  (flex column, 셸 컨테이너)
        ├── header.app-frame-header                       (drag 2-layer)
        │   ├── div[data-behavior="drag-region"]         (absolute inset-0)
        │   ├── .app-frame-header-left  [no-drag]        (5-버튼 툴바: menu · panelL · search · arrowL · arrowR)
        │   ├── .app-frame-header-center                 (drag 유지)
        │   └── .app-frame-header-right [no-drag]
        │       └── .app-frame-window-controls           (Win/Linux 만, macOS 는 null)
        │
        └── .app-frame-grid                               (1×1 CSS grid, z-stack)
            ├── .app-frame-body                z=0       (Sidebar + Main 가로 배치)
            │   ├── aside.app-frame-sidebar
            │   │   [data-behavior="collapsible resizable"]
            │   │   [data-state="expanded|collapsed"]
            │   │   ├── .app-frame-sidebar-body
            │   │   │   ├── .app-frame-sidebar-brand    (🐋 + "Orca" 브랜드 로고)
            │   │   │   ├── nav.app-frame-sidebar-nav   (3-항목: 새 대화 · 프로젝트 · 자동화)
            │   │   │   ├── .app-frame-sidebar-sessions
            │   │   │   └── .app-frame-sidebar-footer
            │   │   └── .app-frame-resize-handle          (aside 자식 — collapse 시 함께 사라짐)
            │   │
            │   └── main(.app-frame-pane-host)
            │       └── .app-frame-pane-row
            │           └── .app-frame-tile [data-behavior="resizable"]
            │               ├── .app-frame-titlebar
            │               ├── .app-frame-transcript [data-behavior="virtualizable"]
            │               └── .app-frame-composer
            │                   ├── .app-frame-composer-input [data-behavior="interactive"]
            │                   └── .app-frame-composer-controls
            │                       └── .app-frame-composer-repo  [data-behavior="dismissible"]
            │
            ├── #app-frame-overlay   z=-10 ↔ 10           (modal backdrop: blur + dim + pointer block)
            ├── #app-frame-modal     z=-20 ↔ 20           (focus-trap 컨테이너 — InstallerDialog · AuthExpiredModal · SearchModal)
            └── #app-frame-debug     z=30                 (TweaksPanel 등 개발 보조 floating UI)
```

footer 는 두지 않음 — Orca 는 정보 분산 배치 (모델/사용량 → composer 하단, 브랜치/상태 → titlebar, 계정 → sidebar footer).

> 추가로 sidebar `sessions` 슬롯 내부의 각 행은 `.app-frame-session-row` + `data-context="session"` + `data-state="active|inactive"` + `data-behavior="interactive selectable"` (rename 모드에서는 `interactive renaming`) 를 부여한다. `data-session-id` 가 함께 부착되어 외부 도구가 행을 식별할 수 있다.
>
> `body` 외부에 **portal 로 떠 있는 floating UI** (Popover · SkillAutocomplete · FileAutocomplete) 는 `document.body` 자식으로 mount 되며, 자기 element 에 `.app-frame-floating` + `data-context="floating"` + `data-behavior="dismissible"` 를 부여한다. 별도의 z-stack 슬롯은 사용하지 않으며 `z-50` Tailwind 유틸로 어디서나 상위에 뜨도록 한다. 마운트 위치가 body 직속인 이유는 (a) 부모 grid cell 의 overflow clip 회피, (b) modal/debug 슬롯 z 와 무관하게 anchor 기준 절대 위치가 보장되기 때문.

#### 3.3.3 Drag 2-layer 패턴

Electron `frame: false` 윈도우에서 드래그 영역을 정의할 때 동일하게 적용:

```
container (relative)
├── drag-layer (absolute inset-0, style={{ WebkitAppRegion: 'drag' }})
└── content-layer (relative z-[1])   ← 클릭 가능
```

inline 클래스 `[-webkit-app-region:drag]` 대신 `style={{ WebkitAppRegion: 'drag' }}` 로 명시 — 의미 명확 + TS 타입 안정.

#### 3.3.4 Sidebar 캡슐화

resize-handle 은 `aside` 형제가 아니라 **자식**으로 둔다.

| 위치 | 이름 | 이유 |
|---|---|---|
| aside 내부 | `app-frame-resize-handle` | sidebar 에 소속된 조작 장치. collapse 시 함께 사라진다. |
| tile 사이 | `app-frame-tile-separator` | 독립적인 두 tile 사이의 분리선. (현재 단일 tile 이라 미사용 — 후속 분할 시 도입.) |

같은 역할이지만 소속 관계가 다르므로 이름을 구분한다.

#### 3.3.5 Overlay / Modal / Debug 슬롯 규칙

`#app-frame-overlay` 는 **modal backdrop 전용**이며, modal 활성 시에만 떠올라야 한다. visibility 토글은 **z 부호 반전**으로 한다.

| 슬롯 | 평소 z | modal 활성 시 z | 역할 | children |
|---|---|---|---|---|
| `#app-frame-overlay` | `-10` | `10` | backdrop (`bg-black/40 backdrop-blur-sm`). 평소엔 body 뒤로 깔려 보이지도 클릭도 안 됨. | 없음 — 순수 layer |
| `#app-frame-modal` | `-20` | `20` | focus-trap 컨테이너. 두 모달은 동시에 열리지 않으므로 conditional render 로 1개만 노출. | `<InstallerDialog>` 또는 `<AuthExpiredModal>` |
| `#app-frame-debug` | `30` (상시) | `30` (상시) | TweaksPanel 등 개발 보조 floating UI. modal 상태와 무관. wrapper `pointer-events-none` + 자식 `pointer-events-auto`. | `<TweaksPanel>` 등 |

규칙:
- overlay 와 modal 의 z 부호는 **항상 동시에** 반전 (modal 발생 ↔ 부재).
- `data-state="visible|hidden"` 마커는 보존하되, **실제 visibility 는 z 가 결정**.
- DOM 은 항상 마운트된 상태 — z 부호 반전만으로 토글.
- backdrop 시각 (blur + dim) 은 overlay element 의 stable 스타일 — z 가 음수일 때는 어차피 안 보이므로 별도 토글 불요.
- modal 컴포넌트들은 자체 `fixed inset-0 bg-black/40` backdrop 을 갖지 않는다 — backdrop 은 `#app-frame-overlay` 가 단독으로 담당. panel 만 `grid place-items-center` 로 중앙 배치.

#### 3.3.6 data-* 마커 카탈로그 (현재 사용)

| 위치 | 속성 | 값 |
|---|---|---|
| `<html>` | `data-theme` / `data-platform` | `classic\|dark\|cool` / `darwin\|win32\|linux` |
| header drag-layer | `data-behavior` | `drag-region` |
| header content-layer · 좌 · 우 | `data-behavior` | `no-drag` |
| WinControls 각 버튼 | `data-behavior` | `action:window-minimize\|window-maximize\|window-close` |
| `aside.app-frame-sidebar` | `data-behavior` / `data-state` | `collapsible resizable` / `expanded\|collapsed` |
| `.app-frame-resize-handle` | `data-behavior` / `data-axis` / `data-context` / `data-state` | `resizable` / `vertical` / `sidebar` / `visible\|hidden` |
| `.app-frame-tile` | `data-behavior` | `resizable` |
| `.app-frame-transcript` | `data-behavior` | `virtualizable` |
| `.app-frame-composer-repo` | `data-behavior` | `dismissible` |
| `.app-frame-composer-input` | `data-behavior` | `interactive` |
| 스크롤 하단 버튼 (있을 때) | `data-behavior` | `action:scroll-bottom` |
| composer send/cancel 버튼 | `data-behavior` | `action:send` / `action:cancel-turn` |
| `.app-frame-session-row` | `data-context` / `data-state` / `data-behavior` | `session` / `active\|inactive` / `interactive selectable\|interactive renaming` |
| `.app-frame-floating` (Popover / SkillAutocomplete / FileAutocomplete) | `data-context` / `data-behavior` | `floating` / `dismissible` |
| `.app-frame-search-modal` (SearchModal 패널) | `data-context` / `data-behavior` | `modal` / `focus-trap` |
| `#app-frame-overlay` | `data-state` / `data-context` | `visible\|hidden` / `overlay` |
| `#app-frame-modal` | `data-behavior` / `data-state` / `data-context` | `focus-trap blocks-interaction` / `visible\|hidden` / `modal` |
| `#app-frame-debug` | `data-context` | `debug` |

#### 3.3.7 마커 전용 원칙

새 클래스/속성은 **기존 Tailwind 유틸과 공존**한다. 기존 유틸을 교체하지 않는다. 새 CSS 파일/규칙은 추가하지 않는다 (grid 1×1 z-stack 도 Tailwind arbitrary value `grid-cols-1 grid-rows-1 [&>*]:[grid-area:1/1]` 로). 시각 회귀 0 을 목표.

새 컴포넌트 추가 시:
1. 가이드라인의 트리 위치에 맞는 `app-frame-*` 클래스 부여.
2. 인터랙션이 있으면 `data-behavior` / `data-state` 도 함께.
3. 시각 스타일은 Tailwind 유틸로 — 마커가 스타일을 대신하지 않는다.

---

## 4. 상태 관리

> **현재 (Phase 1·2)**: React Context + useReducer (외부 store 라이브러리 미사용).
> **채택된 결정**: **Zustand 로 전환**. 패턴은 **단일 root store + `sessions: Record<sessionId, SessionState>` 슬라이스** (Map factory 폐기). 도입 시점은 **Phase 4 진입 PR 과 묶음** (Phase 3 사전 마이그레이션 금지). 상세는 §4.4.

### 4.1 상태 분류

| 상태 종류 | 위치 | 영속화 | 예시 |
|---|---|---|---|
| 채팅 세션 상태 | `features/chat/hooks/useChat` 의 useReducer (`ChatState`) | **Phase 3 부터**: 로컬 SQLite 영속화 (BACKEND §6). 메모리 캐시 + DB SSOT 병행. | sessionId, messages, pendingDelta, inflight |
| Tweaks (theme/density/sidebar) | `shared/hooks/useTweaks` + electron-store | ✅ `orca:settings:get` / `set` | theme, density, sidebarCollapsed, **sidebarWidth** (180–480, default 248 — Phase 3+) |
| 백엔드 설치 상태 | `features/backend/hooks/useBackend` useState 캐시 | — | backends, active |
| Skills 카탈로그 | `shared/hooks/useSkills` useState 캐시 | — | SkillInfo[] (부팅 1회 스캔) |
| 자동완성 상태 | `useSkillAutocomplete / useFileAutocomplete` 의 useMemo + useState | — | open, query, activeIndex |
| 입력창 텍스트 | 컴포넌트 로컬 `useState` | — | Composer 의 draft text |
| UI 인터랙션 (hover/focus/모달) | 컴포넌트 로컬 `useState` | — | TweaksPanel 펼침 여부 |

### 4.2 `ChatState` (실제 정의)

`app/src/renderer/src/features/chat/reducer/chatReducer.ts` 의 인터페이스 그대로:

```typescript
interface ChatState {
  sessionId: string | null         // 어댑터가 발급한 세션 ID (init 이벤트)
  cwd: string | null               // 작업 디렉토리 (@ 파일 자동완성 기준)
  messages: Message[]              // user/assistant 메시지 배열
  pendingDelta: string             // 스트리밍 중 누적 텍스트
  inflight: boolean                // 요청 진행 중 플래그
  turnStartedAt: number | null     // 회차 시작 시각 (ms, StatusLine 용)
  pendingInputTokens?: number      // 마지막 result 이벤트의 inputTokens
  error?: { code: ErrorCode; message: string; recoverable: boolean }
}
```

7 `ChatAction`: `SEND_USER_MESSAGE` / `RECV_EVENT` / `NEW_CHAT` / `CANCEL_CHAT` / `CLEAR_ERROR` / `RESTORE_SESSION` / `SET_CWD`

### 4.3 Anti-pattern (하지 말 것)

- ❌ **입력창 텍스트를 전역 store 에 두기** — 매 키 입력마다 전역 리렌더 발생. Composer 의 draft 는 컴포넌트 로컬 `useState` 로.
- ❌ **컴포넌트에서 `window.orca` 직접 호출** — `features/<domain>/hooks/use*.ts` (Tweaks 는 `shared/hooks/useTweaks.ts`) 안에서만 IPC 호출. Zustand 전환 후에도 IPC 호출은 store action 안에 머무르며 컴포넌트는 selector / action 만 사용한다.
- ❌ **`features/` hook 에서 `window.orca.*` 직접 호출** — `shared/api/ipc.ts` 타입드 래퍼 (PR #29 에서 도입) 를 경유한다. 직접 호출은 ESLint 위반은 아니지만 테스트 진입점 / IPC 계약 변경 추적성을 망가뜨린다.
- ❌ **`useEffect` 안에서 store→다른 store 갱신** — 무한 루프 위험. reducer 의 단일 액션으로 묶을 것.
- ❌ **`messages` 배열을 mutate** — reducer 는 `.slice()` 후 새 배열 반환 (`chatReducer.ts` 패턴).
- ❌ **Tailwind 클래스에 raw hex 색상** — 시맨틱 토큰 (`bg-bg`, `text-ink`, `border-border`) 우선. 새 색이 필요하면 `tokens.css` 의 `@theme` 에 추가하고 세 테마 스코프 모두 채움.

### 4.4 Zustand 전환 (채택 결정)

> **확정 사항 (사용자 결정)**:
> 1. **단일 root store + `sessions: Record<sessionId, SessionState>` 슬라이스** 패턴 채택. `Map<sessionId, store>` factory 패턴은 폐기.
> 2. **도입 시점은 Phase 4 멀티세션 진입과 동시** (ChatEvent sessionId 확장 + store 외피 변경 + Zustand 도입을 한 PR 로 묶음). **Phase 3 사전 마이그레이션 금지** — Phase 3 까지는 단일 세션이라 Zustand 이득 없음.

#### 4.4.1 도입의 핵심 명분 — selector 기반 구독

Context + useReducer 도 외피 (`sessions: Record<sessionId, ChatState>`) 변경만으로 *동작* 은 한다. 도입 명분은 **선택적 리렌더**:

- Phase 4 동시 스트리밍 시, 비활성 세션의 `pendingDelta` 가 16ms 간격으로 갱신된다. 단일 Context 모델은 모든 consumer 를 리렌더 → 활성 세션 UI 의 입력 응답성 저하.
- Zustand 의 `useChatStore((s) => s.sessions[activeId].messages)` selector 만으로 해결. Context split / `useContextSelector` 서드파티 패치 의존을 피한다.

#### 4.4.2 store 외부 접근 활용

`useChatStore.getState().recv(ev)` 로 IPC `chat:event` 핸들러가 **React 트리 밖에서 직접 dispatch** 가능. `webContents.send('orca:chat:event', ev)` 는 ordered+lossless 1채널이므로, renderer 의 1개 핸들러가 `ev.data.sessionId` 로 라우팅해 해당 세션 슬라이스만 갱신한다.

#### 4.4.3 store 슬라이스 분리

| 슬라이스 | 위치 | 필드 |
|---|---|---|
| **세션별** | `sessions[sessionId]: SessionState` | `messages` / `pendingDelta` / `pendingInputTokens` / `error` |
| **전역** | root state | `activeSessionId` / `inflight` (Phase 4 에서는 세션별로 분리 검토) / `turnStartedAt` / `Tweaks` / `Backend` / `Skills` |

세션 삭제: `delete state.sessions[id]` + 해당 세션의 진행 중 `AbortController.abort()` 호출.

#### 4.4.4 대안 비교

| 옵션 | 선택적 리렌더 | 외부 dispatch | 미채택 이유 |
|---|---|---|---|
| Context + useReducer (현행) | ❌ | ❌ | 동시 스트리밍 시 활성 UI 리렌더 |
| Context split + `useContextSelector` | ✅ | ❌ | 서드파티 패치 의존 |
| **Zustand (단일 root + sessions 슬라이스)** | ✅ | ✅ | **채택** |
| Zustand store factory (`Map<sessionId, store>`) | ✅ | ✅ | 전역 공유 필드용 root store 가 또 필요 → 분산. 영속성 hydration 도 2회 |
| Jotai (`atomFamily(sessionId)`) | ✅ | △ atom 외부 접근 우회 필요 | atom 폭증 + 학습 비용 |
| TanStack Store | ✅ | ✅ | Zustand 와 동급 — 채택 이유 약함 |
| Valtio (proxy mutable) | ✅ | ✅ | mutable 패턴이 reducer 일관성과 충돌 |
| 손수 `useSyncExternalStore` | ✅ | ✅ | Zustand 가 본질적으로 이것의 얇은 wrapper — 직접 구현 이득 적음 |

#### 4.4.5 전환 시 영향 범위

- `features/chat/reducer/chatReducer.ts` → `features/chat/store/chatStore.ts` (Zustand store) 로 재작성. 기존 액션 (`SEND_USER_MESSAGE` / `RECV_EVENT` 등) 은 store 메서드로 변환 + `sessionId` 인자 추가.
- `features/chat/hooks/useChat.ts` 의 useReducer 패턴 → `useChatStore((s) => s.sessions[activeId].field)` selector 로 교체.
- IPC onEvent 핸들러 → `useChatStore.getState().recv(ev)` 로 외부 dispatch.
- `shared/hooks/useTweaks` · `features/backend/hooks/useBackend` · `shared/hooks/useSkills` 도 단계적으로 Zustand root store 의 전역 슬라이스로 흡수 (Chat 마이그레이션 후순).
- `app/AppLayout.tsx` 의 props drilling (현 `newChatSlot` / `sessionsSlot` / `footerSlot` 슬롯) 은 store 직접 구독으로 단순화 가능 — 단, `shared/ui/` 의 presentational 규칙 (§3.1) 은 유지.

#### 4.4.6 도입 PR 에서 결정할 사항 (Open Questions)

| OQ | 내용 |
|---|---|
| persist middleware vs custom subscribe | Zustand `persist` middleware 의 기본 storage 는 localStorage/AsyncStorage. Electron 에선 custom storage 어댑터 (electron-store 또는 로컬 DB IPC bridge) 필요. zod 검증 흐름과의 정합성 검토. BACKEND §11 참조. |
| devtools middleware | Redux DevTools 호환 Zustand devtools 사용 여부 — 개발 모드에서만 활성화 권장. |

### 4.5 Tweaks 적용 흐름

```
useTweaks() ──► [Tweaks, setTweak]
                  │
useEffect(theme):  ──► document.documentElement.dataset.theme = t.theme
                       (tokens.css 의 [data-theme="..."] 스코프 활성)
useEffect(density): ──► document.documentElement.style.fontSize = DENSITY_FONT[t.density] + 'px'
                       (rem 기반 Tailwind spacing 자연 cascade)

부팅: window.orca.settings.get() → 초기 Tweaks 복원
변경: setTweak(key, val) → 로컬 state + window.orca.settings.set({ [key]: val })
```

`data-theme` 속성 변경만으로 모든 CSS 변수 재해석. **트리 remount 불요** (이전에 사용하던 `key={theme}` bump 제거됨).

---

## 5. 멀티세션 UI 동작 (Phase 4 anchor)

> **현재 상태 (Phase 1·2)**: **단일 활성 세션만 지원.** `ChatState.sessionId` 는 `string | null` 의 단일 값이며, `sessions: Record<sessionId, ChatState>` 같은 외피 없음.

### 5.1 Phase 4 확장점

`docs/architecture.md` 가 다루던 Phase 4 anchor 를 이 절에 흡수:

| 변경 | 위치 | 영향 범위 |
|---|---|---|
| `ChatState` 외피 변경 | `features/chat/reducer/chatReducer.ts` | `{ sessions: Record<sessionId, ChatState>; activeSessionId: sessionId }` 형태. 내부 reducer 로직은 "세션 1개 단위" 로 캡슐화되어 있어 외피 변경만으로 흡수 가능. |
| `ChatEvent.sessionId` 필드 추가 | `app/src/shared/ipc.ts` | 현재 `init` variant 만 sessionId 보유. Phase 4 진입 시 *모든 variant* (`assistant_delta` 등) 에 `sessionId: string` 필드 추가 — 동시 흐름의 출처 식별. |
| IPC 1채널 그대로 유지 | `orca:chat:event` | Electron `webContents.send` 가 V8 microtask queue 위에서 ordered + lossless 보장. 별도 메시지큐 도입 *중복 레이어* 이므로 미채택. |
| Sidebar 세션 탭 UI | `features/sessions/components/SessionList.tsx` + `app/Sidebar.tsx` 의 sessions 슬롯 | 활성 세션 전환 + 비활성 세션 배지 (스트리밍 중 표시). |
| 세션 전환 시 스크롤 위치 기억 | `features/chat/components/ChatTile.tsx` | 세션별 scrollTop 보관. |

### 5.2 동시 스트리밍 (Phase 4)

- 여러 세션이 동시에 응답을 받을 수 있다 (각 세션 독립 `AbortController` — BACKEND §5).
- 비활성 세션도 백그라운드에서 메시지 누적 (이전 세션 전환해도 스트리밍 중단되지 않음).
- 비활성 세션에 새 응답이 도착하면 Sidebar 에 배지 (예: 굵게).

---

## 6. 컴포넌트 렌더링 전략

### 6.1 메시지 리스트 가상화

- **현재: 미사용.** `features/chat/components/ChatTile.tsx` 의 메시지 리스트는 일반 `messages.map(...)` 렌더링.
- 도입 임계값·라이브러리·시점 모두 **TBD**. Phase 1 mockup 단계에서는 메시지 수가 적어 문제 없음.
- Phase 3+ 로컬 DB 도입과 함께 검토 권장.

### 6.2 스트리밍 렌더링 최적화

- `assistant_delta` 이벤트마다 `pendingDelta` 에 누적. UI 업데이트는 **16ms throttle** (60Hz 리렌더 상한).
- 마크다운 파싱은 `pendingDelta` 가 메시지로 commit 되는 시점 (`assistant_message`) 에 1회만 — 스트리밍 중에는 plain text.
- 코드 블록 하이라이팅도 동일하게 지연 (shiki async 로드).

### 6.3 마크다운 + 코드 블록

| 항목 | 구현 |
|---|---|
| Markdown 렌더러 | `features/chat/components/markdown/Markdown.tsx` — react-markdown + remarkGfm. h1~h4, p, a, ul/ol, blockquote, table, code 각각 커스터마이즈. |
| 이미지 정책 | **data-uri 만 허용** (보안). 외부 URL 차단. |
| 링크 정책 | 외부 링크 클릭은 `shell.openExternal` 경유 (Main 측에서 처리). target=_blank rel=noopener noreferrer 표시. |
| 코드 블록 | `features/chat/components/markdown/CodeBlock.tsx` — shiki 싱글톤 비동기 로드. 지원 언어 11종 (typescript / tsx / javascript / jsx / python / bash / json / yaml / html / css / markdown). 테마 3종 (github-light / github-dark / one-light). |
| 테마 추적 | `document.documentElement.dataset.theme` 의 MutationObserver. data-theme 변경 시 코드 블록 자동 재렌더링. |
| 로딩 fallback | shiki 로드 전엔 plain `<pre>` 표시. 로드 완료 후 HTML replace. |
| 복사 버튼 | named group (`group/codeblock` + `group-hover/codeblock:opacity-100`) 으로 hover 범위 자기 자신으로 한정. (`app/CLAUDE.md` 의 named group 규칙 참조.) |

### 6.4 마크다운 보안

- HTML 렌더링: react-markdown 의 기본값 (raw HTML 비활성) 유지.
- 이미지: data-uri 만 허용 (위 §6.3).
- 외부 URL 자동 차단: `will-navigate` (Main) + `setWindowOpenHandler` (Main).

### 6.5 Custom Titlebar / 윈도우 컨트롤 (Phase 3+)

- BrowserWindow: `frame: false` + macOS `titleBarStyle: 'hidden'` + `trafficLightPosition: { x: 12, y: 10 }` (`app/src/main/index.ts`).
- `data-platform` 부착: App boot effect 에서 `documentElement.dataset.platform = window.orca.platform` 1회 (preload 가 sync 노출).
- IPC: `window.orca.window.{minimize,maximize,close}()` 3개 (IPC_CONTRACT §2.8).
- macOS 분기: `WinControls` 가 `window.orca.platform === 'darwin'` 일 때 `null` 반환 — OS traffic light 가 그린다. 헤더 좌측 패딩 80px 로 traffic light 영역 회피.
- drag 영역: `[-webkit-app-region:drag]` inline 클래스 대신 `style={{ WebkitAppRegion: 'drag' }}` (§3.3.3 의 2-layer 패턴).
- **header-left 내용물 (Phase 3++)**: 액션 5-버튼 툴바 — `menu` (시스템 메뉴 popover · 자식 `종료` → `windowApi.close()`) · `panelL` (사이드바 접기 토글 · `setTweak('sidebarCollapsed', !current)`) · `search` (대화 검색 모달 열기 — `SearchModal`) · `arrowL` / `arrowR` (`navigate(-1)` / `navigate(1)` 항상 enabled, 추적 없음). 모든 버튼은 `data-behavior="no-drag"` 영역 안. 기존 brand + breadcrumb 표시는 제거 (브랜드는 Sidebar 의 `app-frame-sidebar-brand` 로 이동).

---

## 7. UX 패턴

### 7.1 키보드 단축키

| 단축키 | 동작 | 구현 위치 |
|---|---|---|
| `/` | Composer 에서 Skill 자동완성 dropdown 트리거 | `SkillAutocomplete.tsx` |
| `@` | Composer 에서 파일 경로 자동완성 트리거 | `FileAutocomplete.tsx` |
| ↑ / ↓ | 자동완성 dropdown 내 navigate | 동일 |
| Tab / Enter | 자동완성 항목 선택 | 동일 |
| Esc | 자동완성 dismiss / 스트리밍 취소 | TBD (스트리밍 취소는 명시적 키 미정) |
| Enter | 메시지 전송 | `features/chat/components/ChatTile.tsx` Composer |
| Shift + Enter | 줄바꿈 | 동일 |

> 그 외 단축키 (Cmd/Ctrl+N 새 대화 등) 는 **현재 미구현**. PRD §11 OQ 추가 후보.

### 7.2 입력창 (Composer)

`features/chat/components/ChatTile.tsx` 의 Composer 섹션 + `features/chat/components/composer/` 부속:

- 멀티라인 textarea + 자동 높이 조절
- 3-chip 행: 첨부 / 현재 프레임 / Skill 선택 (`Popover` 기반 picker)
- `/skillname` 토큰을 **활성 스킬일 때만** 파란 chip 으로 mirror overlay 강조 (`HighlightedTextarea.tsx`, `knownSkillNames: ReadonlySet<string>`)
- `@filepath` 자동완성: 디렉토리 단계별 진입, quoted/plain 자동 감지, 공백 시 자동 wrapping
- 전송 후 입력창 비우기, 포커스 유지

### 7.3 로딩 / 에러 / 네트워크 상태

| 상태 | UI 표시 | 위치 |
|---|---|---|
| 요청 대기 | StatusLine "Thinking... (Ns · ~Mtokens)" | `shared/ui/StatusLine.tsx` |
| 스트리밍 중 | StatusLine + 응답 메시지에 누적 텍스트 | `features/chat/components/ChatTile.tsx` |
| 에러 (`recoverable: true`) | 메시지 영역에 에러 카드 | `features/chat/reducer/chatReducer.ts` 의 `state.error` |
| 에러 (`auth.expired`) | AuthExpiredModal (`claude /login` 안내) — `#app-frame-modal` 슬롯, backdrop 은 `#app-frame-overlay` 가 담당 (§3.3.5) | `features/backend/components/AuthExpiredModal.tsx` |
| CLI 설치 진행 | InstallerDialog (라인별 로그 + 수동 명령 복사) — 동일하게 `#app-frame-modal` + `#app-frame-overlay` backdrop | `features/backend/components/InstallerDialog.tsx` |
| 네트워크 단절 | TBD (전역 배너 미구현) | — |

### 7.4 접근성

- 모든 인터랙티브 요소 키보드 접근 가능 (Composer / Sidebar / TweaksPanel)
- 다크/라이트/쿨 3 테마 — `data-theme` 속성 기반
- ARIA 레이블 / 스크린리더 지원: 현재 부분 적용 (TBD — 체계적 audit 필요)

### 7.5 Sidebar Resize (Phase 3+)

- 드래그 영역: `aside.app-frame-sidebar` 우측 1px hairline (`app-frame-resize-handle`) — aside 의 자식이라 collapse 시 함께 사라진다.
- **2단 분리** (PR #30):
  - 일반 메커니즘 → `shared/hooks/useDragResize` (`getOrigin` / `min` / `max` / `disabled` / `onChange` 옵션. sidebar 라는 도메인을 모르며 tile separator 등에도 재사용 가능).
  - 도메인 특정 설정·적용 → `app/Sidebar.tsx` (`SIDEBAR_MIN/MAX/DEFAULT_WIDTH` 상수, `asideRef`, `setTweak('sidebarWidth', n)` onChange).
- 영속화: `Settings.sidebarWidth: number` (180–480, default 248). `shared/hooks/useTweaks` 가 부팅 시 hydrate + flush.
- collapsed 상태: handle 의 `data-state="hidden"` + `pointer-events-none`. 폭은 `w-14` (56px) 고정. `useDragResize` 의 `disabled: collapsed` 옵션으로 mousedown 무반응.
- 명명: aside 내부는 `resize-handle`, tile 사이는 `separator` 로 구분 (§3.3.4).

---

## 8. 도메인 카탈로그 (Orca 고유)

`shared/navigation/routes.ts` 의 path 카탈로그 + Tweaks 패널을 화면 단위로 정리.

| ID / 컴포넌트 | 화면 라벨 | breadcrumb | Sidebar nav | Phase 상태 | 비고 |
|---|---|---|---|---|---|
| `chat` (`features/chat/components/ChatTile.tsx`) | 01 채팅 | (없음) | ✅ '새 대화' | **✅ Phase 1·2 활성** | 실 IPC 연결됨. Composer 자동완성·ToolCard·Markdown·CodeBlock 모두 구현. |
| `projects` (`features/projects/components/ProjectsScreen.tsx`) | 02 프로젝트 | 프로젝트 | ✅ '프로젝트' | **✅ Phase 3 활성** | 카드 그리드 + 생성 다이얼로그. ProjectDetail 은 `pages/ProjectLandingPage.tsx` 단일 파일. |
| `routines` (placeholder, 라우트 미정의) | 자동화 | — | ✅ '자동화' | **⏳ Phase 3++ 신설** | nav 항목만 추가, 라우트는 미정의 — `router.tsx` catch-all 이 `/new` 로 흡수. 후속 PR 에서 `pages/RoutinesPage.tsx` + 라우트 등록. |
| `engine` (`features/engine/components/EngineView.tsx`) | 03 엔진 & 모델 | 설정 · 엔진 & 모델 | ❌ (URL 직접 진입) | 🚧 Phase 1 mockup | nav 에서 빠짐 (Phase 3++ 재구성). 라우트 `/engine` 는 살아 있음. |
| `skills` (`features/skills/components/SkillsMcpView.tsx`) | 04 Skills / MCP | 설정 · Skills & MCP | ❌ (URL 직접 진입) | 🚧 Phase 1 mockup + Phase 2 부분 활성 | nav 에서 빠짐. Skills 목록 스캔은 Composer 자동완성에 그대로 활성. |
| (Tweaks Panel) `shared/ui/TweaksPanel.tsx` | (플로팅 패널 — `#app-frame-debug` 슬롯) | — | — | **✅ Phase 2+ 영속** | theme / density / sidebarCollapsed / sidebarWidth — electron-store 동기화. |
| (SearchModal) `app/SearchModal.tsx` | (모달 — `#app-frame-modal` 슬롯) | — | — | **✅ Phase 3++ 활성** | FTS5 대화 검색. Header 검색 버튼 → `searchOpen` lift → OverlayLayer conditional mount. |

> **CameraView** 와 **CapturesView** 는 `features/camera/` · `features/captures/` 에 존재하지만 도메인 카탈로그에서 제외 (GLOSSARY §3 사용자 결정). Sidebar nav 에도 없음.
>
> **Sidebar nav 재구성 (Phase 3++)**: nav 노출은 3-항목 (새 대화·프로젝트·자동화) 으로 축소. engine/skills/captures 는 *라우트가 살아 있으나 nav 미노출* — URL 직접 진입 또는 향후 nav 복귀 가능.

### 8.1 Future Scope 도메인의 IPC 연결 시점

- **Projects**: Phase 3+ 로컬 DB 도입 (BACKEND §6) 과 함께. 세션을 프로젝트별로 그룹화하는 메타데이터.
- **EngineSettings**: Phase 3+ 어댑터별 자격증명 저장 (BACKEND §8) 과 함께. base URL + API key 입력 UI.
- **SkillsMcp 권한·MCP**: Phase 4+ SDK 고급 기능 (`options.permissionMode` / `mcpServers`) 도입 시. PRD OQ9 미정.

---

## 9. IPC 호출 (Renderer → Main)

### 9.1 호출 규칙

- 직접 `window.orca.*` 호출은 **금지**. 모두 `shared/api/ipc.ts` 의 타입드 래퍼 (`chatApi`/`backendApi`/`installApi`/`settingsApi`/`skillApi`/`fileApi`/`sessionApi`/`projectApi`/`windowApi`) 를 경유한다.
- 래퍼 호출은 `features/<domain>/hooks/use*.ts` 안에 캡슐화. 컴포넌트가 직접 호출 금지.
- 모든 IPC 호출은 타입이 있어야 한다 (채널 정의는 [IPC_CONTRACT.md](./IPC_CONTRACT.md) 참조).
- 에러는 throw 로 전달 (Main 측에서 직렬화된 `{ code, message, recoverable }` 객체).

### 9.2 스트리밍 응답 수신

`useChat()` 의 패턴 (`features/chat/hooks/useChat.ts` — `shared/api/ipc.ts` 의 `chatApi.onEvent` 경유):

```typescript
import { chatApi } from '../../../shared/api/ipc'

useEffect(() => {
  // 1회 구독
  const unsubscribe = chatApi.onEvent((ev) => {
    dispatch({ type: 'RECV_EVENT', payload: ev })
  })
  return unsubscribe  // cleanup 필수
}, [])
```

- main→renderer 의 `orca:chat:event` 채널은 ordered + lossless (Electron `webContents.send` 가 V8 microtask queue 위에서 보장).
- Renderer 가 일시적으로 늦어도 microtask queue 에 안전히 쌓임.
- 컴포넌트 언마운트 시 unsubscribe **필수**.

### 9.3 취소

```typescript
import { chatApi } from '../../../shared/api/ipc'
chatApi.cancel(sessionId)  // → window.orca.chat.cancel(sessionId) → ipcRenderer.invoke('orca:chat:cancel', ...)
```

Main 이 `AbortSignal` 을 SDK `query()` 에 전파 → 현재 inflight 만 중단. 진행 중이던 도구 호출은 SDK 가 정리.

### 9.4 채널 전체 목록

[IPC_CONTRACT.md](./IPC_CONTRACT.md) §2 참조. 현재 **총 24 채널** (정확 수치는 IPC_CONTRACT 가 SSOT — chat 3 · backend 1 · install 2 · settings 2 · skills 1 · files 1 · session 5 · project 5 · window 3 · search 1).

---

## 10. 현재 구현 상태

| 영역 | Phase | 상태 | 비고 |
|---|---|---|---|
| Frame / Titlebar / Sidebar (collapsed/expanded) | Phase 1 | ✅ 완료 | mockup 시각 재현 |
| ChatTile 메시지 리스트 + 스트리밍 표시 | Phase 2 | ✅ 완료 | 16ms throttle. 메시지 컴포넌트는 `features/chat/components/transcript/` |
| Composer 3-chip + Skill picker | Phase 2++ | ✅ 완료 | Popover + `insertSkillFromMenu` |
| Composer `/skill` 인라인 자동완성 | Phase 2++ | ✅ 완료 | `SkillAutocomplete` + `useSkillAutocomplete` |
| Composer `@file` 자동완성 | Phase 2++ | ✅ 완료 | `FileAutocomplete` + `useFileAutocomplete` |
| Markdown 렌더링 (react-markdown + GFM) | Phase 2 | ✅ 완료 | `features/chat/components/markdown/Markdown.tsx` |
| Shiki 코드 블록 (3테마 + 11언어) | Phase 2 | ✅ 완료 | `features/chat/components/markdown/CodeBlock.tsx` |
| ToolCard 렌더링 (input/output 토글) | Phase 2 | ✅ 완료 | `features/chat/components/transcript/ToolCard.tsx` |
| AuthExpiredModal | Phase 2 | ✅ 완료 | `features/backend/components/AuthExpiredModal.tsx` — `error / auth.expired` 이벤트 트리거 |
| InstallerDialog | Phase 2 | ✅ 완료 | `features/backend/components/InstallerDialog.tsx` — claude-code 는 SDK 자동 처리로 즉시 done |
| Tweaks (theme/density/sidebar) + electron-store 영속화 | Phase 2+ | ✅ 완료 | `shared/hooks/useTweaks` + `shared/ui/TweaksPanel` |
| 세션 재개 (lastSessionId 부팅 복원) | Phase 2+ | ✅ 완료 | `RESTORE_SESSION` 액션 |
| DOM Architecture 마커 체계 (`app-frame-*` + `data-*`) | Phase 3+ | ✅ 완료 | §3.3 — 단일 PR 일괄 적용 (`45e129f`) |
| Custom titlebar (`frame: false` + 윈도우 컨트롤 IPC) | Phase 3+ | ✅ 완료 | §6.5 — 플랫폼 분기 + IPC 3채널 |
| Grid z-stack (overlay/modal/debug 3슬롯) | Phase 3+ | ✅ 완료 | §3.3.5 — z 부호 반전 토글 (정정 `acf1295`) |
| Sidebar resize-handle | Phase 3+ | ✅ 완료 | §7.5 — 180–480px clamp, `sidebarWidth` 영속화 |
| Tile structure (`pane-host > pane-row > tile`) | Phase 3+ | ✅ 마크업만 | §3.3.2 — 우측 분할 콘텐츠는 후속 |
| Zustand 전환 (Phase 4 진입 PR 과 묶음) | Phase 4 | ⏳ 채택 결정 | §4.4 — 단일 root + sessions 슬라이스. Phase 3 사전 마이그레이션 금지 |
| **App Shell 정규화** (`frame/` 해체 + AppLayout.tsx 직접 조립) | PR #29 | ✅ 완료 | §3.A — `ChatTile.tsx` → `features/chat/`. `ModalLayer+DebugLayer` → `OverlayLayer` 통합 3슬롯. Sidebar `React.memo` 적용. |
| **`features/<domain>/` 도입** (`screens/` + `state/` 흡수) | PR #29 | ✅ 완료 | 8개 도메인 (chat / sessions / projects / backend / engine / skills / camera / captures). 6-슬롯 구조 (components/hooks/reducer/providers/types/index). |
| **`shared/` 도입** (`shared/api/ipc.ts` + `shared/ui/` + `shared/hooks/` + `shared/config/` + `shared/navigation/` + `shared/theme/` + `shared/types/`) | PR #29 | ✅ 완료 | `window.orca.*` 래퍼 (chatApi/backendApi/installApi/settingsApi/skillApi/fileApi/sessionApi/projectApi/windowApi) 경유. `features/` 내 직접 호출 0건. ESLint boundaries v6 로 layer 방향 강제. |
| **Sidebar brand 교체 + nav 3-항목화** | Phase 3++ | ✅ 완료 | `app-frame-sidebar-brand` = 🐋 + "Orca" 로고 (이전 newChatSlot 폐기). nav = 새 대화 (`/new`) · 프로젝트 (`/projects`) · 자동화 (`/routines` — placeholder). `NewChatButton.tsx` 삭제. |
| **Header 액션 5-버튼 툴바** | Phase 3++ | ✅ 완료 | menu (popover · 종료 menuitem → windowApi.close) · panelL (사이드바 접기 토글) · search (대화 검색 모달) · arrowL/arrowR (navigate ∓1, 항상 enabled). HeaderProps `onOpenSearch` prop 만 노출. |
| **FTS5 대화 검색 모달** | Phase 3++ | ✅ 완료 | `0003_messages_fts.sql` 마이그레이션 (가상 테이블 + 3 트리거 + 백필). `orca:search:messages` IPC (IPC_CONTRACT §2.9). `app/SearchModal.tsx` (150ms debounce + request id supersede + `<mark>` split-parse XSS 방어). `toFtsMatch` 가 모든 토큰에 prefix wildcard `*` 부착. |
| **활성 효과 URL 동기화** | Phase 3++ | ✅ 완료 | `useSessionHandlers` 의 `currentSessionId` 를 `matchPath('/chat/:sessionId', pathname)` 로 도출 — `ChatContext.state.sessionId` 의존 제거 (캐시/IPC 용도로만 잔존). Sidebar nav '새 대화' isActive 도 `p === '/new'` 로 좁힘. |
| Projects 화면 | Phase 1 | 🚧 mockup 만 | Future Scope |
| EngineSettings 화면 | Phase 1 | 🚧 mockup 만 | Phase 3+ 자격증명 UI 와 통합 예정 |
| SkillsMcp 화면 (권한·MCP 토글) | Phase 1 | 🚧 mockup 만 | Phase 4+ |
| 메시지 가상 스크롤 | TBD | ❌ 미구현 | 임계값·라이브러리 미정 |
| 멀티세션 UI | Phase 4 | ❌ 미구현 | §5 확장점 anchor |
| 키보드 단축키 (Cmd/Ctrl+N 등) | Future | ❌ 미구현 | OQ 추가 후보 |
| 네트워크 단절 배너 | Future | ❌ 미구현 | — |
| ARIA / 스크린리더 audit | Future | 🚧 부분 적용 | 체계적 audit TBD |
| i18n (`src/shared/i18n/ko.ts`) | Future | ❌ 미구현 | 현재는 mockup 인라인 한국어 |

> 이 표는 코드 변경 시 함께 갱신한다.

---

## 11. 참고

- IPC 채널 정의: [IPC_CONTRACT.md](./IPC_CONTRACT.md)
- 용어 정의: [GLOSSARY.md](./GLOSSARY.md)
- 백엔드 측 구조: [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md)
- 데이터 모델 SSOT: [TRD.md](./TRD.md) §6
- 로드맵 / Phase: [PRD.md](./PRD.md) §8 / §9 Future Scope
- 디자인 토큰 정책: [PRD.md](./PRD.md) §10 + `app/CLAUDE.md` 스타일링 정책 절
