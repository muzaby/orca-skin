# app/ — 코딩 에이전트용 가이드

이 디렉토리는 **Orca v1 의 실제 구현체**가 사는 곳이다. 현재는 **F1 (기본 채팅 셸) + F2 (마크다운 렌더링) 구현 완료** 단계이며, 어댑터/인스톨러/세션 영역은 미완. 본 구현은 `docs/TRD.md` 의 사양을 따른다.

## 현재 상태 (F1/F2 완료)

| 영역 | 상태 |
|---|---|
| Forge 템플릿 | `webpack-typescript` 적용 완료 (`forge.config.ts`, `webpack.*.config.ts`) |
| Electron | 42.0.1 |
| TypeScript | **5.x** — `strict + target: ES2022 + jsx: react` 적용 완료 |
| 메인 (`src/main/index.ts`) | BrowserWindow 생성, **TRD §1.3 보안 베이스라인 (`contextIsolation`/`nodeIntegration:false`/`sandbox:true`) 적용 완료**, IpcRouter 부착 |
| 렌더러 (`src/renderer/index.tsx` + `app/*.tsx`) | React 18 + Tailwind CSS 기반 ChatShell, MessageList, Composer, Sidebar, MarkdownRenderer 완료 |
| 프리로드 (`src/renderer/preload.ts`) | `contextBridge.exposeInMainWorld('orca', ...)` 화이트리스트 IPC API 노출 |
| 도메인 코드 | **F1+F2 완료** — IPC 라우터 (mock 응답), React 채팅 셸, react-markdown 기반 마크다운 렌더링. **미완**: 실제 어댑터 (Claude Code/opencode), 인스톨러, 세션 영속화 |
| 스타일링 | **Tailwind CSS** (`tailwind.config.js` 의 V1Frame 디자인 토큰 — 크림/잉크/러스트 팔레트, Inter/Source Serif 4/JetBrains Mono) + `src/renderer/index.css` 글로벌 |
| `package.json` | `name: "orca"`, `productName: "Orca"` 적용 완료 |
| **Phase 1 — 정리** | **완료** — TRD OQ2 동기화 (shiki → Prism.js), 죽은 파일 제거 (`src/renderer.ts`), i18n foundation (`src/shared/i18n/ko.ts`) 작성 + 4개 컴포넌트 통합 |
| **Phase 2.2 — AdapterRegistry** | **완료** — Parallel 설치 감지 (claude-code, opencode), registry 생명주기 (`app.ready`), IPC 연동 (`orca:backend:list/select`) |
| **Phase 2.3 — Mock 제거** | **완료** — `orca:chat:send` 가 mock 응답 대신 real adapter.sendMessage() 호출 (Phase 2+ 구현으로 "not implemented" 에러 발생) |
| **Phase 2.4 — Error UI** | **완료** — ErrorToast 컴포넌트 (auto-dismiss 4초), Composer 에서 error event 처리 |

## 타깃 모듈 레이아웃 (TRD §1.2)

| 경로 | 책임 | 현 상태 |
|---|---|---|
| `src/main/index.ts` | Electron `app` 부트, BrowserWindow, IpcRouter 부착, AdapterRegistry 초기화 | **완료** (보안 베이스라인 포함) |
| `src/main/ipc/router.ts` | IPC 채널 라우팅 + 입력 검증 (zod) | **완료** (`orca:backend:list/select` 에 registry 연동, `orca:chat:send` 는 실제 adapter 호출) |
| `src/main/adapters/types.ts` | `SessionAdapter`, `ChatEvent`, `Backend` 공통 타입 | 미작성 (현재 `src/shared/protocol.ts` 에 통합 — 필요 시 `main/adapters/types.ts` 로 분리 검토) |
| `src/main/adapters/claude-code.ts` | Claude Code spawn / NDJSON / `--resume` | **Stub 작성** (`isInstalled()` 완료, sendMessage 미구현 — Phase 2+) |
| `src/main/adapters/opencode.ts` | opencode `serve` / SDK / SSE | **Stub 작성** (`isInstalled()` 완료, sendMessage 미구현 — Phase 2+) |
| `src/main/adapters/registry.ts` | 설치 상태 + 활성 백엔드 선택 | **완료** (parallel detection, active backend management) |
| `src/main/installer/index.ts` | CLI 설치 자동화 | **미작성** |
| `src/main/settings/store.ts` | Phase 2+ `electron-store`. Phase 1 은 in-memory | 미작성 (Phase 2 anchor) |
| `src/renderer/index.tsx` | React 엔트리 (StrictMode + ChatShell) | **완료** |
| `src/renderer/index.css` | Tailwind 지시어 + CSS 토큰 (`:root` `--cream-0/--ink-900/--rust-400/...`) + 마크다운 스타일 | **완료** |
| `src/renderer/app/ChatShell.tsx` | 사이드바 + 헤더 + 메시지 + 컴포저 레이아웃 | **완료** (Tailwind 기반) |
| `src/renderer/app/Sidebar.tsx` | "새 대화" 버튼 + 활성 백엔드 표시 | **완료** |
| `src/renderer/app/MessageList.tsx` | 메시지 버블 + pending delta + 자동 스크롤 | **완료** |
| `src/renderer/app/Composer.tsx` | textarea + 전송 버튼 (`Enter` 전송 / `Shift+Enter` 줄바꿈) | **완료** |
| `src/renderer/app/Markdown.tsx` | `react-markdown` + `remark-gfm` + 컴포넌트 오버라이드로 Tailwind 클래스 적용 | **완료** (Prism.js 의존성 있음 — 코드 하이라이트 Hook 통합은 후속) |
| `src/renderer/app/state.ts` | Context + reducer (`SET_SESSION`/`SEND_USER_MESSAGE`/`RECV_DELTA`/`RECV_MESSAGE`/`NEW_CHAT`/...) | **완료** |
| `src/renderer/app/ErrorToast.tsx` | 에러 토스트 (자동 dismiss 4초) | **완료** (error state 디스플레이, 기본 메시지만) |
| `src/renderer/app/TweaksPanel.tsx` | 테마/밀도/사이드바 토글 | **미작성** (PRD §10.3 — 후속) |
| `src/renderer/preload.ts` | `contextBridge.exposeInMainWorld('orca', ...)` 화이트리스트 | **완료** (`chat.send/onEvent/cancel`, `backend.list/select`) |
| `src/global.d.ts` | `Window.orca` 타입 선언 | **완료** |
| `src/shared/protocol.ts` | Renderer ↔ Main 메시지 스키마 (zod) + `Backend`/`ChatEvent`/`SessionAdapter`/`SessionInfo` 공통 타입 | **완료** |
| `src/shared/i18n/ko.ts` | 한국어 라벨 | **완료** (sidebar, chat, composer, messageList 라벨 통합) |
| `tailwind.config.js` | V1Frame 디자인 토큰 (색상/폰트/크기) | **완료** |
| `postcss.config.js` | tailwindcss + autoprefixer | **완료** |
| `eslint.config.js` | ESLint 9 **flat config** — `@typescript-eslint`, `eslint-plugin-import` 사용. `src/**/*.{ts,tsx}` 만 lint. `.eslintrc.*` 으로 회귀 금지 | **완료** |

> 이 레이아웃에서 벗어나려면 사용자에게 먼저 확인. TRD 와 코드를 동시에 갱신해야 한다.

## 보안 베이스라인 (TRD §1.3) — 적용 완료, 변경 시 사용자 확인

`src/main/index.ts` 의 `BrowserWindow` 생성 시 아래가 *명시되어 있다*. 후속 변경에서 무력화 금지.

```ts
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,   // 필수
    nodeIntegration: false,   // 필수
    sandbox: true,            // 필수 (Forge 템플릿 기본값 false)
    preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
  },
});
```

| 항목 | 규칙 |
|---|---|
| DevTools 자동 오픈 | dev 빌드(`process.env.NODE_ENV !== 'production'`) 한정 |
| 외부 URL 로드 | 금지. `webContents.setWindowOpenHandler` 로 차단 + OS 기본 브라우저 위임 |
| 비밀 저장 | 앱은 저장하지 않음 — OAuth/API 키는 호스트 CLI 가 관리 (PRD N6) |
| Renderer 환경 shim | `src/index.html` 의 `window.__dirname=''/window.__filename=''` inline `<script>` 는 sandbox+nodeIntegration:false 환경에서 `@vercel/webpack-asset-relocator-loader` 가 inject 한 `__dirname` 참조의 `ReferenceError` 를 막기 위함. 제거 금지 (renderer 가 native module 안 쓰므로 base path 는 dead-branch metadata). |

## 의존성 정책

- TRD §2 의 Stack 표 밖의 패키지 추가는 **사용자 승인 필수**. PR 설명에 *왜* 가 들어가야 한다.
- **이미 도입된 것** (`package.json` 참조):
  - 런타임: `react@18`, `react-dom@18`, `react-markdown@9`, `remark-gfm@4`, `prismjs@1.30`, `zod@3.22`, `electron-squirrel-startup`
  - 폰트 (self-hosted, TRD §1.3 정합): `@fontsource/inter@5`, `@fontsource/source-serif-4@5`, `@fontsource/jetbrains-mono@5` (latin subset 만 import — 한글은 시스템 fallback)
  - 빌드/스타일: `typescript@5.x`, `ts-loader@9.5`, `css-loader@7`, `style-loader@4`, `node-loader@2`, `@vercel/webpack-asset-relocator-loader@1.10`, `fork-ts-checker-webpack-plugin@7.3` (v8/v9 는 `electron-forge plugin-webpack` 과 IPC EPIPE 충돌 — electron/forge #3861. v7.3 은 deprecation 없음), `tailwindcss@3.4`, `postcss@8.4`, `postcss-loader@8.1`, `autoprefixer@10.4`
  - Lint: `eslint@9`, `@eslint/js@9`, `@typescript-eslint/eslint-plugin@8`, `@typescript-eslint/parser@8`, `eslint-plugin-import@2.32`, `globals@15`
  - 타입: `@types/react@18`, `@types/react-dom@18`
- **사용자 결정으로 확정된 항목** (TRD §15 OQ 와 동기화 필요):
  - OQ1: **React 18** 채택
  - OQ2: **react-markdown + Prism.js** (TRD 표기는 shiki — 동기화 시 사용자 확인 후 갱신)
  - OQ3: **Windows (Squirrel/NSIS) 패키징, 자동 업데이트는 Phase 2**
- **여전히 미정** (단독 결정 금지):
  - OQ4: 텔레메트리·크래시 리포트
  - OQ5: 라이센스
  - OQ6: 성능 SLA 수치
  - OQ7: 둘 다 설치된 경우 기본 백엔드
  - OQ8: 새 대화 시 직전 세션 노출 방식
- **전이적 deprecation 은 silence 금지.** `npm install` 시 남는 deprecation 경고 (`xterm@4`, `glob@7/8`, `rimraf@2/3`, `tar@6`, `uuid@8`, `inflight`, `sourcemap-codec`, `boolean`, `gar`, `lodash.get`, `@npmcli/move-file`, `xterm-addon-*`) 는 모두 `electron-forge@7.x` 의 nested deps. `npm overrides` 로 강제 다운/업그레이드 금지 — 부모 패키지가 특정 구 API 에 의존할 수 있음. electron-forge 8.x stable 출시 시 자연 해소.

## 스타일링 정책 (Tailwind CSS)

- **모든 UI 컴포넌트는 Tailwind 유틸리티 클래스로 작성.** 인라인 `style={{...}}` 에 색/크기 하드코딩 금지 (`minHeight` 같은 동적 값은 예외).
- **디자인 토큰은 `tailwind.config.js` 의 `theme.extend`** — 신규 색상/폰트가 필요하면 여기에 추가하고 클래스로 사용. 컴포넌트 안에 hex 값 직접 입력 금지.
- **CSS 변수** (`src/renderer/index.css` 의 `:root` `--cream-0/--ink-900/--rust-400/...`) 는 마크다운 렌더, 스크롤바 같은 *비-React 영역* 에서만 사용. React 컴포넌트는 Tailwind 우선.
- **마크다운 스타일** 은 `Markdown.tsx` 의 `components` 오버라이드에서 Tailwind 클래스 지정 + `index.css` 의 `.markdown` 보조 규칙 병행.
- **폰트는 self-hosted** (`@fontsource/*` latin subset). `src/renderer/index.css` 의 `@import '@fontsource/...'` 만으로 번들 (webpack `asset/resource` 룰이 woff2 추출). 새 외부 CDN 링크 추가 금지 — TRD §1.3 "외부 콘텐츠 로드 금지 (오프라인 가정)" 위반. 새 weight/style 이 필요하면 `@fontsource` import 추가.

## 빌드 / 실행

| 스크립트 | 동작 |
|---|---|
| `npm start` | Forge dev 모드 (electron + webpack watch) |
| `npm run package` | 패키징 (서명/notarize 미설정 — OQ3) |
| `npm run make` | `maker-*` 디스트리뷰션 빌드 |
| `npm run lint` | ESLint 9 (flat config) — `eslint src` |
| `npm test` | **미설정** — Vitest 추가 시 채워라 (TRD §10.1) |

## 에이전트 원칙

1. **`docs/TRD.md` 먼저 읽고 코드 짜라.** 본 디렉토리 작업의 1차 사양은 TRD. PRD §11 / TRD §15 Open Questions 는 단독 결정 금지.
2. **위 모듈 레이아웃을 유지하라.** `src/main/`, `src/renderer/`, `src/shared/` 분리 구조. 평면 구조(`src/index.ts`, `src/renderer.ts`)로 회귀 금지.
3. **새 의존성 추가 시 사용자 확인.** TRD §2 표 밖이면 PR 설명에 사유 명시.
4. **Electron 보안 옵션은 명시 상태 유지.** `contextIsolation/nodeIntegration:false/sandbox:true` 무력화 금지.
5. **Tailwind 우선.** 새 컴포넌트는 Tailwind 클래스 + `tailwind.config.js` 토큰으로 작성. 인라인 색/크기 하드코딩 금지.
6. **테스트 동반.** 어댑터 정규화, reducer, IPC 스키마는 단위 테스트와 함께 작성 (TRD §10). 현재는 테스트 인프라 미구축 — Vitest 도입 시 이 원칙 활성화.
7. **TRD 와 코드가 충돌하면 사용자에게 물어라.** TRD 갱신과 코드 변경은 같은 PR 또는 짝 PR 로. (예: OQ2 의 TRD 표기 `shiki` vs 실제 도입 `Prism.js` — TRD 동기화 필요.)
8. **mock 응답 영역은 명확히 표시.** `src/main/ipc/router.ts` 의 mock 부분은 실제 어댑터 도입 시 *제거 + 교체*. mock 위에 기능 누적 금지.
9. **ESLint 9 flat config 유지.** 설정은 `eslint.config.js`. 새 lint 룰은 여기에 추가. `.eslintrc.json` 형식으로 회귀 금지 (ESLint 9 미지원).

## 위치 규약

- 사용자 의도 트랜스크립트 → `chats/` (참조: `chats/CLAUDE.md`)
- 제품 정의 / 구현 사양 / 전략 문서 → `docs/` (참조: `docs/CLAUDE.md`)
- 디자인 프로토타입 → `project/` (참조: `project/CLAUDE.md`)
- 실 구현체 → `app/` (여기)
- 저장소 전체 진입점 → `./CLAUDE.md`
