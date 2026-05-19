# app/ — 코딩 에이전트용 가이드

이 디렉토리는 **Orca v1 의 실제 구현체**가 사는 곳이다. 현재는 **Phase 1 (시각 재현 + Tailwind 마이그레이션 완료)** 상태로, `project/electron/index.html` mockup 의 5개 화면 중 4개를 렌더러에 인테그레이션했고 (캡처 화면은 placeholder), 스타일은 Tailwind CSS v4 로 일괄 마이그레이션되었다. 본 구현은 `docs/TRD.md` 의 사양을 따른다.

## 현재 상태 (Phase 1 — 시각 재현 + Tailwind)

| 영역                              | 상태                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 템플릿                            | `@quick-start/electron` `react-ts` (electron-vite 기반)                                                                                                                                    |
| 번들러                            | Vite (main/preload/renderer 3-config 통합)                                                                                                                                                 |
| Electron                          | 39.x                                                                                                                                                                                       |
| React                             | 19.x                                                                                                                                                                                       |
| TypeScript                        | 5.x (strict, target ES2022)                                                                                                                                                                |
| 스타일링                          | **Tailwind CSS v4** (`@tailwindcss/vite` 플러그인, CSS-first `@theme` 설정)                                                                                                                |
| 메인 (`src/main/index.ts`)        | IpcRouter 부트 + `createWindow`. `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` 명시                                                                                |
| 렌더러 (`src/renderer/src/`)      | **Phase 1 시각 재현 + Phase 2 채팅 IPC 통합** — Frame/Titlebar/Sidebar/ChatPane(실데이터)/CameraPane/Projects/EngineSettings/SkillsMcp + Tweaks + Installer/Auth modal. 캡처는 placeholder |
| 프리로드 (`src/preload/index.ts`) | `contextBridge.exposeInMainWorld('orca', OrcaApi)` — chat/backend/install/settings 화이트리스트                                                                                            |
| 패키저                            | electron-builder (`electron-builder.yml`)                                                                                                                                                  |
| 도메인 코드 (IPC/어댑터)          | **claude-code 단일 어댑터** — ClaudeCodeAdapter(NDJSON), AdapterRegistry, IpcRouter, Installer, SettingsStore. opencode 는 future work                                                     |
| `package.json`                    | 템플릿 기본값 (`name: "app"`, `author: "example.com"` 등) — 차후 도메인 PR 에서 갱신                                                                                                       |

## 타깃 모듈 레이아웃 (TRD §1.2 기준)

경로는 electron-vite (`@quick-start/electron` react-ts 템플릿) 의 sub-config 분할을 반영한다. 빌드는 `electron.vite.config.ts` 의 main/preload/renderer 3개 sub-config 가 각각 처리한다.

| 경로                                                      | 책임                                                                            | 현 상태                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| `src/main/index.ts`                                       | Electron `app` 부트, BrowserWindow, IpcRouter 부착                              | 구현됨                                  |
| `src/main/ipc/router.ts`                                  | IPC 채널 라우팅 + 입력 검증 (zod)                                               | 구현됨                                  |
| `src/main/adapters/types.ts`                              | `SessionAdapter`, `ChatEvent`, `Backend` 공통 타입                              | 구현됨                                  |
| `src/main/adapters/claude-code.ts`                        | Claude Code spawn / NDJSON / `--resume`                                         | 구현됨                                  |
| `src/main/adapters/opencode.ts`                           | opencode `serve` / SDK / SSE                                                    | **미구현 (future work)**                |
| `src/main/adapters/registry.ts`                           | 설치 상태 + 활성 백엔드 선택                                                    | 구현됨 (claude-code 단일)               |
| `src/main/installer/index.ts`                             | CLI 설치 자동화 (`npm install -g @anthropic-ai/claude-code`)                    | 구현됨                                  |
| `src/main/settings/store.ts`                              | `electron-store` 단일 객체 스토어. `getAll()` / `patch()` 모두 zod 검증         | 구현됨 (Phase 2+)                       |
| `src/shared/ipc.ts`                                       | `CHANNELS` 상수 + 순수 TS 타입. **zod 0 의존** (preload 안전)                   | 구현됨                                  |
| `src/shared/protocol.ts`                                  | zod 스키마 (main 전용). 타입은 `ipc.ts` 에서 re-export                          | 구현됨                                  |
| `src/renderer/src/state/chatReducer.ts`                   | ChatState reducer (SEND/RECV/NEW/CANCEL/CLEAR_ERROR)                            | 구현됨                                  |
| `src/renderer/src/state/useChat.ts`                       | useReducer + `window.orca.chat.onEvent` 구독                                    | 구현됨                                  |
| `src/renderer/src/state/useBackend.ts`                    | 부트 시 `orca.backend.list()` 호출 → 설치 상태 보관                             | 구현됨                                  |
| `src/renderer/src/components/install/InstallerDialog.tsx` | 설치 진행 로그 + 수동 명령 복사                                                 | 구현됨                                  |
| `src/renderer/src/components/auth/AuthExpiredModal.tsx`   | `claude /login` 안내 + 새 대화                                                  | 구현됨                                  |
| `src/renderer/src/main.tsx`                               | React 엔트리 + DOM mount + 글로벌 CSS import                                    | 구현됨                                  |
| `src/renderer/src/App.tsx`                                | 루트 셸 — Tweaks state, theme/density effect, 화면 라우팅                       | 구현됨 (Phase 1)                        |
| `src/renderer/src/app/Frame.tsx`                          | `V1Frame` — app-frame 컨테이너                                                  | 구현됨                                  |
| `src/renderer/src/app/Titlebar.tsx`                       | `V1Titlebar` — Orca 브랜드 + breadcrumb + WinControls                           | 구현됨                                  |
| `src/renderer/src/app/Sidebar.tsx`                        | `V1Sidebar` — 새 대화, 메뉴, 프로젝트, 최근 대화, 엔진 footer                   | 구현됨 (collapsed/expanded)             |
| `src/renderer/src/app/ChatPane.tsx`                       | 메시지 / 툴 콜 / 테이블 / Composer (3-chip 행 + 스킬 picker + 자동완성 통합)    | 구현됨 (실 IPC + 스킬 UX)               |
| `src/renderer/src/app/CameraPane.tsx`                     | Bayer 뷰포트 / Histogram / Slider / Metric / 캡처 버튼                          | 구현됨                                  |
| `src/renderer/src/app/Projects.tsx`                       | 프로젝트 카드 그리드                                                            | 구현됨                                  |
| `src/renderer/src/app/EngineSettings.tsx`                 | 엔진/모델 카드 리스트                                                           | 구현됨                                  |
| `src/renderer/src/app/SkillsMcp.tsx`                      | Skills / MCP / 권한 패널                                                        | 구현됨                                  |
| `src/renderer/src/app/CapturesPlaceholder.tsx`            | 캡처 화면 — "준비 중" placeholder (Future Scope)                                | placeholder                             |
| `src/renderer/src/app/TweaksPanel.tsx`                    | Tweaks UI 셸 + `TweakSection/Radio/Toggle`                                      | 구현됨                                  |
| `src/renderer/src/app/useTweaks.ts`                       | Tweaks state hook                                                               | 구현됨                                  |
| `src/renderer/src/app/screens.ts`                         | 화면 ID + 라벨 + breadcrumb 카탈로그                                            | 구현됨                                  |
| `src/renderer/src/app/theme.ts`                           | `ThemeId` / `DensityId` 타입 + `DENSITY_FONT` (색상은 CSS 변수가 진실)          | 구현됨                                  |
| `src/renderer/src/components/atoms/*`                     | `Icon`, `WinControls`, `Avatar`, `Status`+`Dot`, `BayerPattern`, `Histogram`, `Popover` (anchor-ref floating menu) | 구현됨 (Tailwind 클래스)                |
| `src/renderer/src/components/composer/HighlightedTextarea.tsx` | textarea + mirror overlay. `/skillname` 토큰을 파란 chip 으로 강조. `onCaretChange` 노출 (caret 추적용) | 구현됨                                  |
| `src/renderer/src/components/composer/SkillAutocomplete.tsx`   | caret 근처 floating dropdown. ↑/↓ navigate · Tab/Enter pick · Esc dismiss        | 구현됨                                  |
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

**그룹 스코프 (`group` / `group-hover:`) 는 named group 으로 격리.** 자체 hover 인터랙션을 가진 컴포넌트 (코드블럭, 카드, 행 등) 는 익명 `group` 대신 `group/<컴포넌트명>` + `group-hover/<컴포넌트명>:` 패턴을 쓴다. 이유: `AssistantMessage` 같은 상위 컴포넌트가 이미 `.group` 으로 마킹돼 있을 때 익명 `group-hover:` 는 상위 group 까지 매칭되어 형제 인스턴스도 같이 hover 상태가 된다 (메시지 본문 hover → 그 메시지 내 모든 코드블럭의 카피 버튼이 동시에 노출되는 버그 사례). 예: `CodeBlock` 은 `group/codeblock` + `group-hover/codeblock:opacity-100` 으로 hover 범위를 자기 자신으로 한정한다 (`components/markdown/CodeBlock.tsx`).

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

## 의존성 정책

- TRD §2 의 Stack 표 밖의 패키지 추가는 **사용자 승인 필수**. PR 설명에 _왜_ 가 들어가야 한다.
- 이미 채택된 것 (도입 시점만 자유): React, react-markdown, shiki, electron-store, zod, vitest, playwright.
- 설치 완료: **Tailwind CSS v4** (`tailwindcss@^4`, `@tailwindcss/vite@^4`).
- 템플릿 동봉 (사전 승인): `@electron-toolkit/utils`, `@electron-toolkit/preload`.
- 미정 항목 (PRD §11 / TRD §15 — 단독 결정 금지):
  - OQ1: React 버전 (18 / 19) — 현재 19 로 템플릿 기본, TRD 확인 필요
  - OQ2: 마크다운/하이라이트 라이브러리 최종 결정
  - OQ3: 패키징·서명·자동업데이트
  - OQ4: 텔레메트리·크래시 리포트
  - OQ5: 라이센스
  - OQ6: 성능 SLA 수치
  - OQ7: 둘 다 설치된 경우 기본 백엔드
  - OQ8: 새 대화 시 직전 세션 노출 방식

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
| Phase 2++ | Composer 스킬 UX — `SKILL.md` 스캔 · `orca:skills:list` IPC · 3-chip 행 (첨부·현재 프레임·Skill) · Skill picker popover · `/skillname` chip 강조 · 인라인 자동완성 dropdown | **완료**                    |
| 후속    | opencode 어댑터, `V1Captures` 실 구현 (캡처 RAW 보관 + AI 분석). 다국어 (`src/shared/i18n/ko.ts`). Vitest / Playwright 테스트                          | Future Scope                |

## 위치 규약

- 사용자 의도 트랜스크립트 → `chats/` (참조: `chats/CLAUDE.md`)
- 제품 정의 / 구현 사양 / 전략 문서 → `docs/` (참조: `docs/CLAUDE.md`)
- 디자인 프로토타입 → `project/` (참조: `project/CLAUDE.md`)
- 실 구현체 → `app/` (여기)
- 저장소 전체 진입점 → `./CLAUDE.md`
