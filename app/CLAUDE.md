# app/ — 코딩 에이전트용 가이드

이 디렉토리는 **Orca v1 의 실제 구현체**가 사는 곳이다. 현재는 **Phase 1 (시각 재현 완료)** 상태로, `project/electron/index.html` mockup 의 5개 화면 중 4개를 렌더러에 인테그레이션한 단계다 (캡처 화면은 placeholder). 본 구현은 `docs/TRD.md` 의 사양을 따른다.

## 현재 상태 (Phase 1 — 시각 재현)

| 영역                              | 상태                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 템플릿                            | `@quick-start/electron` `react-ts` (electron-vite 기반)                                                               |
| 번들러                            | Vite (main/preload/renderer 3-config 통합)                                                                            |
| Electron                          | 39.x                                                                                                                  |
| React                             | 19.x                                                                                                                  |
| TypeScript                        | 5.x (strict, target ES2022)                                                                                           |
| 메인 (`src/main/index.ts`)        | 템플릿 기본 `createWindow`. `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` 명시                |
| 렌더러 (`src/renderer/src/`)      | **Phase 1 mockup 재현 완료** — Frame/Titlebar/Sidebar/ChatPane/CameraPane/Projects/EngineSettings/SkillsMcp + Tweaks. 캡처는 placeholder |
| 프리로드 (`src/preload/index.ts`) | `contextBridge.exposeInMainWorld('electron', electronAPI)` 샘플 — Orca 화이트리스트로 교체 필요 (Phase 2)             |
| 패키저                            | electron-builder (`electron-builder.yml`)                                                                             |
| 도메인 코드 (IPC/어댑터)          | **없음** — 모든 UI 데이터는 mockup 하드코딩. Phase 2 에서 IPC 도입                                                    |
| `package.json`                    | 템플릿 기본값 (`name: "app"`, `author: "example.com"` 등) — 차후 도메인 PR 에서 갱신                                  |

## 타깃 모듈 레이아웃 (TRD §1.2 기준)

경로는 electron-vite (`@quick-start/electron` react-ts 템플릿) 의 sub-config 분할을 반영한다. 빌드는 `electron.vite.config.ts` 의 main/preload/renderer 3개 sub-config 가 각각 처리한다.

| 경로                                                | 책임                                                              | 현 상태                                |
| --------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| `src/main/index.ts`                                 | Electron `app` 부트, BrowserWindow, IpcRouter 부착                | 템플릿 기본                            |
| `src/main/ipc/router.ts`                            | IPC 채널 라우팅 + 입력 검증 (zod)                                 | 미작성 (Phase 2)                       |
| `src/main/adapters/types.ts`                        | `SessionAdapter`, `ChatEvent`, `Backend` 공통 타입                | 미작성 (Phase 2)                       |
| `src/main/adapters/claude-code.ts`                  | Claude Code spawn / NDJSON / `--resume`                           | 미작성 (Phase 2)                       |
| `src/main/adapters/opencode.ts`                     | opencode `serve` / SDK / SSE                                      | 미작성 (Phase 2)                       |
| `src/main/adapters/registry.ts`                     | 설치 상태 + 활성 백엔드 선택                                      | 미작성 (Phase 2)                       |
| `src/main/installer/index.ts`                       | CLI 설치 자동화                                                   | 미작성 (Phase 2)                       |
| `src/main/settings/store.ts`                        | Phase 2+ `electron-store`. Phase 1 은 in-memory                   | 미작성                                 |
| `src/renderer/src/main.tsx`                         | React 엔트리 + DOM mount + 글로벌 CSS import                      | 구현됨                                 |
| `src/renderer/src/App.tsx`                          | 루트 셸 — Tweaks state, theme/density effect, 화면 라우팅         | 구현됨 (Phase 1)                       |
| `src/renderer/src/app/Frame.tsx`                    | `V1Frame` — app-frame 컨테이너                                    | 구현됨                                 |
| `src/renderer/src/app/Titlebar.tsx`                 | `V1Titlebar` — Orca 브랜드 + breadcrumb + WinControls             | 구현됨                                 |
| `src/renderer/src/app/Sidebar.tsx`                  | `V1Sidebar` — 새 대화, 메뉴, 프로젝트, 최근 대화, 엔진 footer     | 구현됨 (collapsed/expanded)            |
| `src/renderer/src/app/ChatPane.tsx`                 | 메시지 / 툴 콜 / 테이블 / Composer                                | 구현됨 (mockup 하드코딩)               |
| `src/renderer/src/app/CameraPane.tsx`               | Bayer 뷰포트 / Histogram / Slider / Metric / 캡처 버튼            | 구현됨                                 |
| `src/renderer/src/app/Projects.tsx`                 | 프로젝트 카드 그리드                                              | 구현됨                                 |
| `src/renderer/src/app/EngineSettings.tsx`           | 엔진/모델 카드 리스트                                             | 구현됨                                 |
| `src/renderer/src/app/SkillsMcp.tsx`                | Skills / MCP / 권한 패널                                          | 구현됨                                 |
| `src/renderer/src/app/CapturesPlaceholder.tsx`      | 캡처 화면 — "준비 중" placeholder (Future Scope)                  | placeholder                            |
| `src/renderer/src/app/TweaksPanel.tsx`              | Tweaks UI 셸 + `TweakSection/Radio/Toggle`                        | 구현됨                                 |
| `src/renderer/src/app/useTweaks.ts`                 | Tweaks state hook                                                 | 구현됨                                 |
| `src/renderer/src/app/screens.ts`                   | 화면 ID + 라벨 + breadcrumb 카탈로그                              | 구현됨                                 |
| `src/renderer/src/app/theme.ts`                     | `THEME_PALETTES`, `DENSITY_FONT`, `V1` 가변 팔레트 객체           | 구현됨                                 |
| `src/renderer/src/components/atoms/*`               | `Icon`, `WinControls`, `Avatar`, `Status`, `BayerPattern`, `Histogram` | 구현됨 (mockup atoms 1:1)         |
| `src/renderer/src/styles/tokens.css`                | CSS 변수 디자인 토큰 (cream/ink/rust 팔레트, 폰트)                | 구현됨 (mockup 복제)                   |
| `src/renderer/src/styles/app.css`                   | 글로벌 baseline (html/body/#root 리셋, 폰트, 배경)                 | 구현됨                                 |
| `src/preload/index.ts`                              | `contextBridge.exposeInMainWorld` 화이트리스트                    | 템플릿 기본 (Phase 2 에서 교체)        |
| `src/shared/protocol.ts`                            | Renderer ↔ Main 메시지 스키마                                     | 미작성 (Phase 2)                       |
| `src/shared/i18n/ko.ts`                             | 한국어 라벨                                                       | 미작성 (현재는 mockup 인라인 한국어)   |

> 이 레이아웃에서 벗어나려면 사용자에게 먼저 확인. TRD §1.2 와 코드를 동시에 갱신해야 한다.

## 스타일링 정책 (Phase 1)

Phase 1 의 1차 목표는 **mockup 픽셀 재현**이다. 단계적 마이그레이션 전략 — 한 번에 시각 재현 + Tailwind 마이그레이션을 함께 하면 mockup 의도가 깨지는 것이 확인되어, 본 Phase 는 시각 재현에만 집중.

| 항목                | Phase 1 (현재)                                                                                      | Phase 2+                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 스타일링            | mockup 인라인 `style` + `styles/tokens.css` (CSS 변수)                                              | Tailwind CSS 도입 마이그레이션 — TRD §2 의 확정 결정 유지                |
| 색상 토큰           | `V1` 가변 팔레트 객체 (`app/theme.ts`) — 테마 변경 시 mutate + `key={t.theme}` 로 트리 remount       | CSS 변수 + Tailwind config 동기화                                       |
| 폰트                | Google Fonts CDN (Source Serif 4 / Inter / JetBrains Mono) — `index.html` 에 link, CSP 갱신         | 동일 (또는 로컬 번들로 전환)                                            |
| Tweaks 연동         | mockup 패턴 그대로 — 팔레트 객체 mutation + `key` bump 로 자식 remount                              | 동일 (또는 React Context 로 정규화)                                     |

mockup 의 인라인 스타일을 그대로 가져왔으므로 **새 컴포넌트도 같은 패턴** (인라인 `style` + `V1.*` 색상) 으로 작성한다. Tailwind 클래스 도입은 Phase 2 마이그레이션 PR 에서 일괄 진행.

### 데스크톱 컨텍스트는 production 에서 제외

mockup (`project/electron/index.html`) 은 디자인 시연을 위해 *Windows 11 데스크톱* 컨텍스트 — 배경 그라데이션, taskbar, 좌상단 "Orca · Electron BrowserWindow" 배너, 우상단 floating screen-tabs, 1280×820 frameless 윈도우 박스 (둥근 모서리 / 그림자 / center transform / auto-scale) — 를 입혀 보여준다. **이 wrapper 는 production 렌더러에 포함하지 않는다** — 실제 앱은 OS 의 BrowserWindow 안에서 실행되므로 데스크톱 시뮬레이션은 중복·불필요. 렌더러는 mockup `.app-window` *내부* 의 콘텐츠 (Frame / Titlebar / Sidebar / 본문 / TweaksPanel) 만 viewport 풀-블리드 로 렌더한다.

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
- 이미 채택된 것 (도입 시점만 자유): React, react-markdown, shiki, electron-store, zod, vitest, playwright, Tailwind CSS (Phase 2 마이그레이션).
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
3. **Phase 1 동안 스타일은 mockup 패턴 그대로.** Tailwind 클래스 도입은 Phase 2 마이그레이션 PR 에서. 새 컴포넌트도 인라인 style + `V1.*` 토큰 사용.
4. **새 의존성 추가 시 사용자 확인.** TRD §2 표 밖이면 PR 설명에 사유 명시.
5. **Electron 보안 옵션은 항상 명시.** 기본값 의존 금지. 위 code block 참고.
6. **테스트 동반.** 어댑터 정규화, reducer, IPC 스키마는 단위 테스트와 함께 작성 (TRD §10). Phase 1 UI 는 시각 검증으로 갈음.
7. **`package.json` 메타데이터는 템플릿 기본값이다.** 차후 도메인 PR 에서 `name`, `productName`, `description`, `author` 갱신. `electron-builder.yml` 도 검토.
8. **TRD 와 코드가 충돌하면 사용자에게 물어라.** TRD 갱신과 코드 변경은 같은 PR 또는 짝 PR 로.

## Phase 로드맵

| Phase   | 범위                                                                                                                                   | 상태       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Phase 1 | mockup 시각 재현 (인라인 스타일). chat / projects / engine / skills 4개 화면 + Tweaks. 캡처는 placeholder                              | **완료**   |
| Phase 2 | Tailwind 마이그레이션. IPC 채널 + zod 검증. Claude Code / opencode 어댑터. 세션 재개. UI 데이터를 mockup 하드코딩 → IPC props 로 교체  | 진행 전    |
| 후속    | `V1Captures` 실 구현 (캡처 RAW 보관 + AI 분석). `electron-store` 영속화. 다국어 (`src/shared/i18n/ko.ts`). Vitest / Playwright 테스트  | Future Scope |

## 위치 규약

- 사용자 의도 트랜스크립트 → `chats/` (참조: `chats/CLAUDE.md`)
- 제품 정의 / 구현 사양 / 전략 문서 → `docs/` (참조: `docs/CLAUDE.md`)
- 디자인 프로토타입 → `project/` (참조: `project/CLAUDE.md`)
- 실 구현체 → `app/` (여기)
- 저장소 전체 진입점 → `./CLAUDE.md`
