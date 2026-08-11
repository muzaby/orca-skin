# Frontend Architecture — Overview (범위·스택·구현상태)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [layers.md](./layers.md), [dom-architecture.md](./dom-architecture.md), [state.md](./state.md), [rendering.md](./rendering.md), [ux-domains.md](./ux-domains.md), [terms.md](./terms.md) (사람용 용어 해설)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 이 문서의 범위

**다루는 것**
- Electron Renderer Process 의 UI 렌더링, 상태 관리, 사용자 입력 처리
- 컴포넌트 구조 및 디렉토리 컨벤션
- 도메인 화면 카탈로그 (Chat / Projects / Engine / SkillsMcp / Tweaks)
- IPC 호출 방식 (Renderer 측 관점)
- Tailwind v4 + CSS 토큰 기반 테마 시스템

**다루지 않는 것 (→ ../backend/ 참조)**
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
| 상태 관리 | **Zustand v5** (feature별 store + chat `sessions` Record 외피, 0008/0013 전환 완료) + 세션-단위 순수 `chatReducer` | ^5.x | Provider 는 bootstrap-only. state.md §1 참조 |
| 라우팅 | **`react-router-dom` v7 BrowserRouter** + `app://` 커스텀 스킴 (production) / Vite dev server (dev). `app/router.tsx` 의 `<Routes>` 가 URL path → Page 매핑. `app/BootRedirector.tsx` 가 `/` → `/chat/<lastSessionId>` 또는 `/new` replace. `app/hooks/useChatRouteSync.ts` 가 URL ↔ ChatState 양방향 동기화. `app/AppLayout.tsx` 가 Header · Sidebar · `<AppRouter />` · OverlayLayer 를 직접 조립. | ^7.10.1 | layers.md §1.A App Shell 조립 규칙 참조. path 카탈로그 (라벨/breadcrumb) 는 `shared/navigation/routes.ts` |
| 스타일링 | Tailwind CSS v4 (`@tailwindcss/vite`) + CSS-first `@theme` 토큰 | ^4.1.16 | `tailwind.config.js` 없음. Tailwind 유틸 + `app-frame-*` 마커 클래스 (dom-architecture.md) **공존**. |
| 마크다운 렌더링 | react-markdown + remark-gfm | ^9.1.0 / ^4.0.1 | GFM 테이블·체크박스 지원 |
| 코드 하이라이팅 | shiki (async 싱글톤 로드) | ^1.29.2 | 11언어 + 3테마, MutationObserver 로 data-theme 추적 |
| 가상 스크롤 | **미사용** (TanStack Virtual 등 채택 안 됨) | — | 임계값·도입 시점 모두 TBD |
| 폰트 | Google Fonts CDN (Source Serif 4 / Inter / JetBrains Mono) | — | `index.html` link, CSP 허용 |
| 플랫폼 통합 | Electron `frame: false` + custom titlebar | — | macOS `titleBarStyle: 'hidden'` + traffic light overlay, Windows/Linux 는 WinControls 가 직접 그림 (dom-architecture.md / rendering.md §1.5) |

---


## 3. 현재 구현 상태

| 영역 | Phase | 상태 | 비고 |
|---|---|---|---|
| Frame / Titlebar / Sidebar (collapsed/expanded) | Phase 1 | ✅ 완료 | mockup 시각 재현 |
| ChatTile 메시지 리스트 + 스트리밍 표시 | Phase 2 | ✅ 완료 | 16ms throttle. 메시지 컴포넌트는 `features/chat/components/transcript/` |
| Composer 3-chip + Skill picker | Phase 2++ | ✅ 완료 | Popover + `insertSkillFromMenu` |
| Composer `/skill` 인라인 자동완성 | Phase 2++ | ✅ 완료 | `SkillAutocomplete` + `useSkillAutocomplete` |
| Composer `@file` 자동완성 | Phase 2++ | ✅ 완료 | `FileAutocomplete` + `useFileAutocomplete` |
| Markdown 렌더링 (react-markdown + GFM) | Phase 2 | ✅ 완료 | `shared/ui/markdown/Markdown.tsx` (features/chat 에는 StreamingMarkdown 만 잔류) |
| Shiki 코드 블록 (shiki 3테마 + 11언어) | Phase 2 | ✅ 완료 | `shared/ui/markdown/CodeBlock.tsx` |
| ToolCard 렌더링 (input/output 토글) | Phase 2 | ✅ 완료 | `features/chat/components/transcript/ToolCard.tsx` |
| AuthExpiredModal | Phase 2 | ✅ 완료 | `features/backend/components/AuthExpiredModal.tsx` — `error / auth.expired` 이벤트 트리거 |
| InstallerDialog | Phase 2 | ✅ 완료 | `features/backend/components/InstallerDialog.tsx` — claude-code 는 SDK 자동 처리로 즉시 done |
| Tweaks (theme/density/sidebar) + electron-store 영속화 | Phase 2+ | ✅ 완료 | `shared/hooks/useTweaks` — 컨트롤 UI 는 dev 전용 `features/debug/components/DebugPanel.tsx` (구 shared/ui/TweaksPanel 부재). 테마는 white/dark 2종 |
| 세션 재개 (lastSessionId 부팅 복원) | Phase 2+ | ✅ 완료 | `RESTORE_SESSION` 액션 |
| DOM Architecture 마커 체계 (`app-frame-*` + `data-*`) | Phase 3+ | ✅ 완료 | dom-architecture.md — 단일 PR 일괄 적용 (`45e129f`) |
| Custom titlebar (`frame: false` + 윈도우 컨트롤 IPC) | Phase 3+ | ✅ 완료 | rendering.md §1.5 — 플랫폼 분기 + IPC 3채널 |
| Grid z-stack (overlay/modal/debug 3슬롯) | Phase 3+ | ✅ 완료 | dom-architecture.md.5 — z 부호 반전 토글 (정정 `acf1295`) |
| Sidebar resize-handle | Phase 3+ | ✅ 완료 | ux-domains.md §1.5 — 180–480px clamp, `sidebarWidth` 영속화 |
| Tile structure (`pane-host > pane-row > tile`) | Phase 3+ | ✅ 마크업만 | dom-architecture.md.2 — 우측 분할 콘텐츠는 후속 |
| Zustand 전환 | Phase 4 | ✅ 완료 (0008 chat 선행 + 0013 전면) | state.md §1 — feature별 store + chat `sessions` Record 외피. Context 4종 흡수(Provider 는 bootstrap-only) |
| **App Shell 정규화** (`frame/` 해체 + AppLayout.tsx 직접 조립) | PR #29 | ✅ 완료 | layers.md §1.A — `ChatTile.tsx` → `features/chat/`. `ModalLayer+DebugLayer` → `OverlayLayer` 통합 3슬롯. Sidebar `React.memo` 적용. |
| **`features/<domain>/` 도입** (`screens/` + `state/` 흡수) | PR #29 | ✅ 완료 | PR #29 당시 8개 → 현재 **13개 도메인** (chat / sessions / projects / backend / engine / skills / camera / captures + cost / settings / update / login / debug — layers.md §1-1). 6-슬롯 구조 (components/hooks/reducer/providers/types/index). |
| **`shared/` 도입** (`shared/api/ipc.ts` + `shared/ui/` + `shared/hooks/` + `shared/config/` + `shared/navigation/` + `shared/theme/` + `shared/types/`) | PR #29 | ✅ 완료 | `window.orca.*` 래퍼 (chatApi/backendApi/installApi/settingsApi/skillApi/fileApi/sessionApi/projectApi/windowApi) 경유. `features/` 내 직접 호출 0건. ESLint boundaries v6 로 layer 방향 강제. |
| **Sidebar brand 교체 + nav 4-항목화** | Phase 3++ → 0083 | ✅ 완료 | `app-frame-sidebar-brand` = 🐋 + "Orca" 로고 (이전 newChatSlot 폐기, `NewChatButton.tsx` 삭제). nav = 새 대화 (`/new`) · 프로젝트 (`/projects`) · 엔진 & 모델 (`/agent`) · Skills & MCP (`/skills`) — 자동화(`/routines`)는 0083 에서 nav 제외(Future Scope, 라우트 미정의). | (0159 r3: 플러그인 모달로 전환)
| **Header 액션 5-버튼 툴바** | Phase 3++ | ✅ 완료 | menu (popover · 종료 menuitem → windowApi.close) · panelL (사이드바 접기 토글) · search (대화 검색 모달) · arrowL/arrowR (navigate ∓1, 항상 enabled). HeaderProps `onOpenSearch` prop 만 노출. |
| **FTS5 대화 검색 모달** | Phase 3++ | ✅ 완료 | `0003_messages_fts.sql` 마이그레이션 (가상 테이블 + 3 트리거 + 백필). `orca:search:messages` IPC (IPC_CONTRACT §2.9). `app/SearchModal.tsx` (150ms debounce + request id supersede + `<mark>` split-parse XSS 방어). `toFtsMatch` 가 모든 토큰에 prefix wildcard `*` 부착. |
| **활성 효과 URL 동기화** | Phase 3++ | ✅ 완료 | `useSessionHandlers` 의 `currentSessionId` 를 `matchPath('/chat/:sessionId', pathname)` 로 도출 — `ChatContext.state.sessionId` 의존 제거 (캐시/IPC 용도로만 잔존). Sidebar nav '새 대화' isActive 도 `p === '/new'` 로 좁힘. |
| **MCP 서버 지원 + nav Skills & MCP 항목** | Phase 3++ | ✅ 완료 | nav 4번째 항목 'Skills & MCP'(`/skills`) 신설. `SkillsCustomizeView`(구 SkillsMcpView) MCP 섹션 실 연동 (`orca:mcp:*` + `AddMcpServerModal` stdio/http). `McpStore`(파일-백드 mcp.json, 인증값 `safeStorage` 암호화). 활성 서버를 `query().options.mcpServers`+`allowedTools`(`mcp__<name>__*`) 에 전역 주입. | (0159 r3: 플러그인 모달로 전환)
| Projects 화면 | Phase 1 | 🚧 mockup 만 | Future Scope |
| 엔진 & 모델 화면 (`/agent`) | Phase 4 | ✅ CRUD 활성 (0021·0090) | `AgentEnvironmentView` + provider CRUD(`EngineFormModal` 단일 화면 + `~/.claude/settings.json` 불러오기, 0090) |
| SkillsMcp 화면 — Skills 좌측·권한 토글 | Phase 1 | 🚧 mockup 만 (MCP 섹션은 Phase 3++ 실 연동) | Phase 4+ (`canUseTool`/`permissionMode`) |
| 메시지 가상 스크롤 | TBD | ❌ 미구현 | 임계값·라이브러리 미정 |
| 멀티세션 UI | Phase 4 | ❌ 미구현 | §5 확장점 anchor |
| 키보드 단축키 (Cmd/Ctrl+N 등) | Future | ❌ 미구현 | OQ 추가 후보 |
| 네트워크 단절 배너 | Future | ❌ 미구현 | — |
| ARIA / 스크린리더 audit | Future | 🚧 부분 적용 | 체계적 audit TBD |
| i18n (`src/shared/i18n/ko.ts`) | Future | ❌ 미구현 | 현재는 mockup 인라인 한국어 |
| **ToolRendererRegistry (semantic kind)** | 스테이지 C1 | ✅ 부분 구현 (PR #47) | rendering.md §1.6 — RenderableKind taxonomy + registry. 정본 ../backend/provider-runtime.md |
| **ApprovalCard 일반화 + PermissionModeController 연동** | 스테이지 C2 | ✅ 부분 구현 (PR #47) | ux-domains.md §1.6 — plan 전용 → 모든 agent tool. 정본 ../backend/provider-runtime.md §3 |
| **StructuredOutput / Streaming lifecycle** | Future | 📐 설계 확정 / 구현 대기 | rendering.md §1.7·rendering.md §1.8 |
| **부팅 오케스트레이션 (BootScreen)** | Phase 4 | ✅ 완료 (0077) | `app/boot/` — bootStore + steps + `orca:boot:report` 진단 |
| **사용량 한도 UI (도넛 팝오버·설정 탭·provider별 한도)** | Phase 4 | ✅ 완료 (0079~0082) | `UsagePanel`(rendering.md §1.9) + `features/settings/`(Usage/ProviderUsage 탭) + `features/cost/` provider 요약. 파생 SSOT `shared/usage/limits.ts` |
| **인앱 업데이트 UX** | Phase 4 | ✅ 완료 (0085/0086) | `features/update/` — 헤더 조건부 업데이트 버튼+파란 뱃지, `UpdateDialog`(사용자 게이트), dev 더미 토글(DebugPanel) |
| **UI polish — 버전 모달·인라인 rename·삭제 확인** | Phase 4 | ✅ 완료 (0083) | `HeaderVersionModal`(Header) + `ChatTitleBar`(폴더 아이콘·`RenameInput`) + `ConfirmDialogHost`/`confirmDialogStore` |
| **로그인 게이트** | Phase 4 | ✅ **0181 재작성 완료** | `app/RootGate` 가 부팅 위에 게이트를 얹는다 — 부팅 실패(`app/BootFailureFrame`) → 부팅 미완료(`BootScreen`) → **게이트 미판정/미통과(`app/GateFrame`)** → 메인 UI. 판정 전(`gate=null`)에는 통과시키지 않는다(fail-closed). 상태·액션은 `features/providers/hooks/useProviderGate`(app → features 는 허용 방향, `GateFrame` 은 `WinControls`(app)를 쓰므로 app 에 산다). **prod** 는 게이트 provider 선언이 0개면 즉시 통과, **DEV 는 선언 0개여도 게이트를 세운다**(로그인 화면 도달성 — 탈출구는 디버그 패널 우회 토글). 로그인 랜딩은 `features/providers/components/GateLogin.tsx`(구 `AuthView` 복원 — Orca 제목·이미지·입력 카드). `Settings.authBypass` 는 **DEV 전용 우회**로 소비자 복귀 |
| **연결(provider) 카탈로그 탭** | Phase 4 | ✅ 완료 (0181) | 설정 카탈로그 3번째 탭 — 상태·방식 선택·인증·재인증·해제. 순수 판정은 `features/skills/lib/providerRows.ts`(AC5 회귀), 상세 패널은 `features/skills/components/customize/ProviderDetail.tsx`. **추가 버튼 없음**(빌드타임 선언) |

> 이 표는 코드 변경 시 함께 갱신한다.

---


## 4. 참고

- IPC 채널 정의: [IPC_CONTRACT.md](../../IPC_CONTRACT.md)
- 용어 정의: [GLOSSARY.md](../../GLOSSARY.md)
- 백엔드 측 구조: [../backend/overview.md](../backend/overview.md)
- 데이터 모델 SSOT: [TRD.md](../../TRD.md) §6
- 로드맵 / Phase: [PRD.md](../../PRD.md) §8 / §9 Future Scope
- 디자인 토큰 정책: [PRD.md](../../PRD.md) §10 + `app/AGENTS.md` 스타일링 정책 절
