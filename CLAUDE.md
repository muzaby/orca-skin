# 저장소 루트 — 코딩 에이전트용 가이드

이 저장소는 **Orca** (검증 엔지니어용 Windows Electron 데스크톱 앱) 의 디자인 핸드오프 + 구현 작업 공간이다. 한 화면에 모든 정보를 담을 수 없으므로 디렉토리마다 별도의 `CLAUDE.md` 가 있다. 본 문서는 *어디로 가서 무엇을 읽어야 하는지* 만 안내한다.

## 디렉토리 한눈에

| 디렉토리 | 역할 | 가이드 |
|---|---|---|
| `chats/` | 사용자 의도 트랜스크립트 (Claude Design 핸드오프) — *왜* 가 산다 | `chats/CLAUDE.md` |
| `docs/` | PRD, TRD, 전략 문서 — *무엇을* / *어떻게* 가 산다 | `docs/CLAUDE.md` |
| `project/` | HTML/CSS/JS 디자인 프로토타입 (variation A 채택) — *어떻게 보여야 하는가* | `project/CLAUDE.md` |
| `app/` | Orca v1 실제 구현체 (electron-vite + React/TypeScript). Phase 3++ — 로컬 SQLite SSOT + 세션 히스토리 + DOM Architecture + 4-layer Feature 아키텍처 (`app/` · `pages/` · `features/` · `shared/`) + ESLint boundaries 강제 + URL/path 라우팅 (`app://` + BrowserRouter) + **Header 액션 5-버튼 툴바 + Sidebar brand/nav 재구성 + FTS5 대화 검색 모달 + MCP 서버 지원 (safeStorage 암호화) + uv 기반 Python 런타임 내장 (격리 venv + SDK env 주입)**. | `app/CLAUDE.md` |

## 새 세션 진입 시 읽는 순서

1. **`chats/`** — 트랜스크립트(현재 1개). *결정 키워드* ("A로 진행", "확정", "OK") 가 진실. 어시스턴트의 긴 제안보다 사용자의 짧은 응답이 우선.
2. **`docs/PRD.md`** — 무엇을 만들지 (Orca v1 MVP). §6 (MVP Scope), §9 (Future Scope), §11 (Open Questions) 가 핵심.
3. **`docs/TRD.md`** — 어떻게 구현할지. 코드 작업의 1차 참고서.
4. **`app/CLAUDE.md`** → `app/` — 구현 디렉토리 규칙·모듈 레이아웃·의존성 정책·보안 베이스라인.
5. (필요 시) **`project/electron/index.html`** — 시각 기준 (variation A). 픽셀 퍼펙트 *재현* 대상이지 그대로 가져갈 production 코드가 아니다.
6. (필요 시) **`docs/etc/llm-chat-desktop-strategy.md`** — TRD 가 소화한 전략적 근거. TRD 결정의 *왜* 를 거슬러볼 때.

## 현재 페이즈

| 단계 | 상태 |
|---|---|
| 디자인 핸드오프 (variation A 확정) | 완료 — `chats/chat1.md`, `project/electron/` |
| 제품 정의 (PRD v1) | 완료 — `docs/PRD.md` |
| 구현 사양 (TRD v1) | 완료 — `docs/TRD.md` (Tailwind CSS 결정 반영 §2, §9.5) |
| 스캐폴드 (electron-vite react-ts + Tailwind CSS) | 완료 — `app/` |
| Phase 1 (mockup 시각 재현 + Tailwind v4) | 완료 — `app/src/renderer/` |
| **Phase 2 (claude-code 단일 어댑터 + 채팅 IPC)** | **완료** — `app/src/main/`, `app/src/preload/` |
| **Phase 2+ (`electron-store` 영속화: Tweaks · lastSessionId · lastBackend · window bounds)** | **완료** — `app/src/main/settings/store.ts` |
| **Phase 2++ (Composer 스킬 UX: SKILL.md 스캔 · 3-chip 행 · picker · 인라인 자동완성)** | **완료** — `app/src/renderer/src/frame/composer/` (PR #25 이전엔 `components/composer/`), `app/src/main/skills/` |
| **Phase 3 (로컬 SQLite SSOT · 세션 히스토리 · 사이드바 비동기 lazy load + 캐시 + kebab 메뉴)** | **완료 (PR #20)** — `app/src/main/db/`, `app/src/renderer/src/state/useSessions.ts`, `useChat.ts` (캐시), `Sidebar.tsx` (kebab rename/delete) |
| **Phase 3+ (DOM Architecture: `app-frame-*` 마커 + `data-*` 체계 + Custom titlebar `frame:false` + Grid z-stack + Sidebar resize-handle + Tile structure)** | **완료** — `app/src/renderer/src/frame/`, `data-platform`/`data-context`/`data-behavior` 마커 부착, `docs/[docs/arch/frontend/dom-architecture.md](docs/arch/frontend/dom-architecture.md) |
| **Phase 3++ (frame/ + screens/ 슬롯 분리 + 마크업 마커 보강)** | **완료 (PR #25)** — 셸 슬롯 `frame/` vs 도메인 화면 `screens/` 디렉토리 분리, 컴포넌트 rename (`Titlebar`→`Header`, `ChatPane`→`ChatTile`, `*Pane`→`*Screen`), `app-frame-composer-repo` / `app-frame-session-row` / `app-frame-floating` 마커 신설 |
| **Phase 3++ (ChatTile 분해: transcript/composer 부속을 슬롯 디렉토리로 추출)** | **완료 (PR #26)** — 구 620줄 ChatTile.tsx → 369줄. `screens/chat/{format.ts, ToolCard, MessageMeta, AssistantMessage, UserMessage, PendingAssistant}.tsx` + `frame/composer/{ComposerChip, SkillsMenu}.tsx` 추출. `app/CLAUDE.md` 원칙 9 (단일 파일 분해 가이드) 신설 |
| **Feature-based 구조 감사 + [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 엄격 갱신** | **완료 (PR #28)** — `frame/` 완전 해체 결정 (→ `app/` + `features/` + `shared/`), `pages/` = 조립만, `router` = which, App Shell §3.A 조립 규칙 신설, §3-2 목표 트리 + §10 구현 대기 행 추가. 코드 변경 없음 — 문서만. |
| **Feature-based 아키텍처 구현 + ESLint boundaries 강제 (PR #29)** | **완료 (PR #29)** — `app/providers/` 6개 Provider → `features/<X>/providers/` 4개 + `shared/navigation/` + `shared/theme/`. `screens/` + `frame/` → `app/` · `pages/` · `features/` · `shared/` 4-layer 완성. `ProjectDetail` 3-파일 → `pages/ProjectLandingPage.tsx` 단일 파일 통합. `eslint-plugin-boundaries` v6 + `boundaries/dependencies` 규칙으로 역방향·cross-feature import 회귀 차단. |
| **URL/path 라우팅 전환 (`app://` 커스텀 스킴 + `react-router-dom` v7 BrowserRouter)** | **완료** — Context-기반 `ScreenId` enum → URL path. main 의 `protocol.registerSchemesAsPrivileged` + `protocol.handle` SPA fallback, `loadURL('app://renderer/')`. `app/router.tsx` `<Routes>` + `BootRedirector` (settings.lastSessionId → `/chat/<id>` 또는 `/new` replace) + `useChatRouteSync` (URL ↔ ChatState). |
| **Phase 3++ (Sidebar brand + nav 재구성 + Header 5-버튼 툴바)** | **완료** — Sidebar `app-frame-sidebar-brand` = 🐋 + "Orca" 로고 (newChatSlot 폐기). nav = 3-항목 (새 대화·프로젝트·자동화 placeholder). Header `app-frame-header-left` = 5-버튼 액션 툴바 (햄버거 popover + 종료 menuitem · 사이드바 접기 토글 · 검색 · 뒤로 · 앞으로). `NewChatButton.tsx` 삭제. shared/ui/Icon.tsx 에 clock·menu·arrowL·arrowR 추가. Popover 에 `placement: 'top' \| 'bottom'` 확장. |
| **Phase 3++ (FTS5 대화 검색 모달)** | **완료** — `0003_messages_fts.sql` (FTS5 가상 테이블 + 3 트리거 + 백필), `orca:search:messages` IPC (`searchApi.messages`), `app/SearchModal.tsx` (150ms debounce + request id supersede + `<mark>` split-parse XSS 방어 + ↑↓/Enter/Esc), `toFtsMatch` 가 모든 토큰에 prefix wildcard `*` 부착. |
| **Phase 3++ (활성 효과 URL 동기화)** | **완료** — `useSessionHandlers` 의 `currentSessionId` 를 `matchPath('/chat/:sessionId', pathname)` 로 도출. ChatContext.state.sessionId 의존 제거. Sidebar nav '새 대화' isActive 도 `p === '/new'` 로 좁힘. |
| **Phase 3++ (MCP 서버 지원)** | **완료** — 사이드바 nav 4번째 'Skills & MCP'(`/skills`) 노출. `orca:mcp:*` 4채널 + `McpStore`(electron-store `orca-mcp`, 인증값 `safeStorage` 암호화). `SkillsMcpView` MCP 섹션 실데이터화 + `AddMcpServerModal`(stdio/streamable-http 2종). `handleChatSend` 가 활성 서버를 `query().options.mcpServers`+`allowedTools`(`mcp__<name>__*`) 에 주입. |
| **범용 Provider Runtime 재설계 (설계 + 인터페이스 → 스테이지 A/B/C 구현)** | **설계 확정 → 스테이지 A/B 구현 완료, C 완료** — 배포 A(`sources/dist` + `ExtensionDeployer` + `StandardConformance`) · 런타임 B(`NormalizedEvent` 단일 와이어 + `permission.requested` 1급 이벤트) · 프론트 C(`ToolRendererRegistry` + `ApprovalCard` 일반화 + **`tool_approval` 게이트 활성**(`RISKY_TOOLS` 화이트리스트) + **권한 응답 채널 단일화**(`permissionRespond` + `InteractionBroker<ApprovalResolution>`)) · 정리(레거시 `ChatEvent`·`cli.*` 제거). 상세는 `app/CLAUDE.md` 로드맵. — OpenCode/Claude 공통 정규화 계층을 기존 아키텍처 문서에 흡수. `docs/[docs/arch/backend/provider-runtime.md](docs/arch/backend/provider-runtime.md) (정본: NormalizedEvent·PermissionBridge·ApprovalResolution 2분기·AppCommandPolicy 3분기·PermissionModeController·SessionCapability·RevertManager·ErrorClassifier·AppMessagePart·Telemetry·AuthStore·AuditLog·DirectBackendAPI·WorkspaceManager·ConfigManager·우선순위 P0/P1) + `docs/[docs/arch/frontend/rendering.md](docs/arch/frontend/rendering.md) §1.6~6.9·§7.6 (ToolRendererRegistry·ApprovalCard 일반화·StructuredOutput·Streaming·TelemetryPanel). Claude 기준 + OpenCode 확장점만. 코드 변경 0 (rename 범위 밖, 매핑표로만). **정정 (PR #52 ①)**: "두 SDK 미설치" 전제는 Claude 축에선 거짓 — Claude Agent SDK 는 lockfile `0.3.143` 핀 고정·spec 문서로 타입 확정이라 Claude 태그를 분해(`[검증-타입]`/`[N/A-claude]` 등)하고 OpenCode 축만 `[미확인-opencode]` 보존. **`PermissionModeController`(§3) 구현 완료 (PR #52 ②③)** — `NormalizedPermissionMode` 6종 + 세션-키 controller + 턴-스코프 스트리밍 라이브 전환(`orca:permission:setMode`) + 6종 UI(위험모드 2-스텝 가드). 풀 크로스턴 멀티세션은 후속(resume-from-DB SSOT 충돌·구동 UI 부재). **짝 문서 `docs/[docs/arch/backend/standardization.md](docs/arch/backend/standardization.md) (배포 계층 표준화 — standards-first·표준 택소노미·sources/dist+ExtensionDeployer·StandardConformance·Engine 구체클래스 rule of three·AGENTS.md 채택): 런타임 정규화(provider-runtime)와 단방향(deploy 산출물→런타임 입력)으로 연결. hook 은 표준 부재로 엔진별 분리(adapters.md §3.2 정정).** |
| 후속 (CI 워크플로우·Vitest·i18n·`/routines` placeholder·Phase 4 Zustand+멀티세션·opencode 어댑터·캡처 실 구현·세션 휴지통 30일 보존) | Future Scope |

> 페이즈별 상세 이력(범위·PR·커밋)은 [`docs/PHASES.md`](docs/PHASES.md) 에 있다.

## 핵심 원칙 (모든 에이전트 공통)

1. **트랜스크립트 + PRD/TRD 가 진실이다.** `project/` HTML 은 *결과물* 이지 의도가 아니다. 의도는 `chats/` 와 `docs/` 에 있다.
2. **PRD §11 / TRD §15 의 Open Questions 는 미정 항목.** 에이전트가 단독으로 결정하지 마라. 사용자에게 묻는다.
3. **문서와 코드가 모순되면 사용자에게 물어라.** 둘 다 바꿔야 하는지(설계 변경) 코드만(구현 버그) 인지 결정해야 한다.
4. **각 디렉토리의 `CLAUDE.md` 가 그 디렉토리에서 더 구체적인 규칙을 갖는다.** 본 문서와 충돌 시 디렉토리별 가이드 우선.
5. **새 디렉토리 추가 시 그 디렉토리에도 `CLAUDE.md` 를 둔다** — 본 표를 갱신.
6. **언어**: 모든 `CLAUDE.md`, PRD, TRD, 전략 문서, 트랜스크립트는 **한국어**. 코드 식별자·로그·외부 라이브러리 인터페이스는 영어. UI 라벨은 한국어 (`src/shared/i18n/ko.ts`).

## 별도 제품 방향 (본 저장소 내 *문서로만* 존재)

- `docs/etc/lightweight-llm-strategy.md` — 로컬 4B LLM 기반 이미지 센서 QA 시스템. **Orca 와 독립** 한 별개 제품 방향. 본 저장소에서 구현체는 없다.

## 외부 진입점과의 구분

- 루트 `README.md` — Claude Design 핸드오프 *원본 README* (영어). 처음 저장소를 받는 외부 수신자용으로 보존.
- 루트 `CLAUDE.md` (본 문서) — *코딩 에이전트* 진입점 (한국어).
- 둘은 같은 사실을 다른 청중에게 설명한다 — 충돌 시 본 문서가 최신.
