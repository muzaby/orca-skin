# Frontend Architecture

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-05-20
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
| 상태 관리 | **React Context + useReducer** (외부 store 라이브러리 미사용) | — | Zustand / Redux **미채택** |
| 라우팅 | 없음 (App.tsx 의 `screenId` state 로 화면 전환) | — | `app/screens.ts` 의 5 ScreenId enum |
| 스타일링 | Tailwind CSS v4 (`@tailwindcss/vite`) + CSS-first `@theme` 토큰 | ^4.1.16 | `tailwind.config.js` 없음 |
| 마크다운 렌더링 | react-markdown + remark-gfm | ^9.1.0 / ^4.0.1 | GFM 테이블·체크박스 지원 |
| 코드 하이라이팅 | shiki (async 싱글톤 로드) | ^1.29.2 | 11언어 + 3테마, MutationObserver 로 data-theme 추적 |
| 가상 스크롤 | **미사용** (TanStack Virtual 등 채택 안 됨) | — | 임계값·도입 시점 모두 TBD |
| 폰트 | Google Fonts CDN (Source Serif 4 / Inter / JetBrains Mono) | — | `index.html` link, CSP 허용 |

---

## 3. 디렉토리 구조

`app/src/renderer/src/` 의 실제 트리.

```
src/renderer/
├── index.html                       # React 마운트 + CSP + Google Fonts link
└── src/
    ├── main.tsx                     # React entrypoint (createRoot) + 글로벌 CSS import
    ├── App.tsx                      # 루트 셸 — Tweaks state, theme/density effect, 화면 라우팅
    ├── env.d.ts                     # Vite 클라이언트 타입
    │
    ├── app/                         # 화면 컴포넌트 (도메인 카탈로그 §8 참조)
    │   ├── Frame.tsx                # 전체 컨테이너 (flex column)
    │   ├── Titlebar.tsx             # Orca 브랜드 + breadcrumb + WinControls + drag region
    │   ├── Sidebar.tsx              # 네비게이션 + 새 대화 + 최근 대화 + collapsed/expanded
    │   ├── ChatPane.tsx             # 메시지 리스트 + Composer + ToolCard + 자동완성
    │   ├── CameraPane.tsx           # Bayer 뷰포트 + Histogram + Slider + 메트릭 (mockup)
    │   ├── Projects.tsx             # 프로젝트 카드 그리드 (mockup, Future Scope)
    │   ├── EngineSettings.tsx       # 엔진/모델 카드 (mockup, Future Scope)
    │   ├── SkillsMcp.tsx            # Skills + MCP 토글 (mockup, Future Scope)
    │   ├── CapturesPlaceholder.tsx  # (도메인 카탈로그에서 제외 — GLOSSARY §3)
    │   ├── TweaksPanel.tsx          # Tweaks 플로팅 패널 (드래그 가능)
    │   ├── theme.ts                 # ThemeId / DensityId / DENSITY_FONT
    │   ├── screens.ts               # ScreenId enum + 카탈로그
    │   └── useTweaks.ts             # Tweaks state hook (electron-store 동기화)
    │
    ├── components/                  # 재사용 컴포넌트
    │   ├── atoms/                   # presentational only — store import 금지
    │   │   ├── Icon.tsx             # SVG 아이콘 카탈로그 (~35종)
    │   │   ├── WinControls.tsx
    │   │   ├── Avatar.tsx
    │   │   ├── Status.tsx           # Dot + Status (green/amber/red/slate)
    │   │   ├── CopyIconButton.tsx
    │   │   ├── Popover.tsx          # anchor 기반 floating menu
    │   │   ├── StatusLine.tsx       # "Thinking... (45s · ~120 tokens)"
    │   │   ├── BayerPattern.tsx     # 카메라 뷰포트 시뮬레이션 (mockup 용)
    │   │   └── Histogram.tsx
    │   ├── composer/                # Composer 자동완성 + 칩 강조
    │   │   ├── HighlightedTextarea.tsx  # textarea + mirror overlay (chip 강조)
    │   │   ├── SkillAutocomplete.tsx    # `/skill` dropdown picker
    │   │   └── FileAutocomplete.tsx     # `@path` 파일 경로 picker
    │   ├── markdown/
    │   │   ├── Markdown.tsx         # react-markdown + remarkGfm
    │   │   └── CodeBlock.tsx        # shiki async + 테마 추적
    │   ├── auth/
    │   │   └── AuthExpiredModal.tsx # `claude /login` 안내 모달
    │   └── install/
    │       └── InstallerDialog.tsx  # 설치 진행 로그 + 수동 명령 복사
    │
    ├── state/                       # 훅 + 리듀서
    │   ├── chatReducer.ts           # ChatState reducer (7 액션)
    │   ├── useChat.ts               # useReducer + window.orca.chat 구독
    │   ├── useBackend.ts            # 백엔드 목록 + 설치 상태
    │   ├── useSkills.ts             # window.orca.skills.list() 캐시
    │   ├── useSkillAutocomplete.ts  # `/` 자동완성 매칭 로직
    │   └── useFileAutocomplete.ts   # `@` 자동완성 + 디렉토리 네비게이션
    │
    └── styles/
        ├── tokens.css               # Tailwind @theme + [data-theme] 스코프
        └── app.css                  # @import tailwindcss + @layer base + @utility kbd
```

### 3.1 디렉토리 책임 규칙

- **`components/atoms/`**: presentational only. props 받아서 렌더링만. **store / IPC 직접 호출 금지.**
- **`components/composer/` / `markdown/` / `auth/` / `install/`**: 도메인성 있는 재사용 컴포넌트. store 의존 가능하지만 props 우선.
- **`app/`**: 화면 단위 컴포넌트 + `screens.ts` / `theme.ts` / `useTweaks.ts`. App.tsx 가 props drilling 으로 연결.
- **`state/`**: 모든 reducer + hook. **IPC 호출은 여기서 캡슐화** (`useChat` 가 `window.orca.chat.onEvent` 구독 등). 컴포넌트는 hook 을 통해 사용.
- **`styles/`**: Tailwind + CSS 변수만. JS 의존 없음.

### 3.2 새 파일을 만들 때 결정 흐름

1. 화면 단위인가? → `app/`
2. presentational 만 하는가? → `components/atoms/`
3. 도메인 재사용 (markdown/composer/auth) 인가? → `components/<도메인>/`
4. 상태 / IPC 캡슐화 hook 인가? → `state/`
5. CSS 변수 추가인가? → `styles/tokens.css` 의 `@theme` + 세 테마 스코프 모두

---

## 4. 상태 관리

### 4.1 상태 분류

| 상태 종류 | 위치 | 영속화 | 예시 |
|---|---|---|---|
| 채팅 세션 상태 | `useChat()` 의 useReducer (`ChatState`) | **현재: 메모리만**. Phase 3+ 로컬 DB 도입 시 영속화 (BACKEND §6) | sessionId, messages, pendingDelta, inflight |
| Tweaks (theme/density/sidebar) | `useTweaks()` + electron-store | ✅ `orca:settings:get` / `set` | theme, density, sidebarCollapsed |
| 백엔드 설치 상태 | `useBackend()` useState 캐시 | — | backends, active |
| Skills 카탈로그 | `useSkills()` useState 캐시 | — | SkillInfo[] (부팅 1회 스캔) |
| 자동완성 상태 | `useSkillAutocomplete / useFileAutocomplete` 의 useMemo + useState | — | open, query, activeIndex |
| 입력창 텍스트 | 컴포넌트 로컬 `useState` | — | Composer 의 draft text |
| UI 인터랙션 (hover/focus/모달) | 컴포넌트 로컬 `useState` | — | TweaksPanel 펼침 여부 |

### 4.2 `ChatState` (실제 정의)

`app/src/renderer/src/state/chatReducer.ts` 의 인터페이스 그대로:

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
- ❌ **컴포넌트에서 `window.orca` 직접 호출** — `state/use*.ts` hook 으로 캡슐화한다. (현재 `useTweaks` / `useChat` / `useBackend` / `useSkills` / `useFileAutocomplete` 가 이 책임을 가짐.)
- ❌ **`useEffect` 안에서 store→다른 store 갱신** — 무한 루프 위험. reducer 의 단일 액션으로 묶을 것.
- ❌ **`messages` 배열을 mutate** — reducer 는 `.slice()` 후 새 배열 반환 (`chatReducer.ts` 패턴).
- ❌ **Tailwind 클래스에 raw hex 색상** — 시맨틱 토큰 (`bg-bg`, `text-ink`, `border-border`) 우선. 새 색이 필요하면 `tokens.css` 의 `@theme` 에 추가하고 세 테마 스코프 모두 채움.

### 4.4 Tweaks 적용 흐름

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
| `ChatState` 외피 변경 | `state/chatReducer.ts` | `{ sessions: Record<sessionId, ChatState>; activeSessionId: sessionId }` 형태. 내부 reducer 로직은 "세션 1개 단위" 로 캡슐화되어 있어 외피 변경만으로 흡수 가능. |
| `ChatEvent.sessionId` 필드 추가 | `app/src/shared/ipc.ts` | 현재 `init` variant 만 sessionId 보유. Phase 4 진입 시 *모든 variant* (`assistant_delta` 등) 에 `sessionId: string` 필드 추가 — 동시 흐름의 출처 식별. |
| IPC 1채널 그대로 유지 | `orca:chat:event` | Electron `webContents.send` 가 V8 microtask queue 위에서 ordered + lossless 보장. 별도 메시지큐 도입 *중복 레이어* 이므로 미채택. |
| Sidebar 세션 탭 UI | `app/Sidebar.tsx` | 활성 세션 전환 + 비활성 세션 배지 (스트리밍 중 표시). |
| 세션 전환 시 스크롤 위치 기억 | `app/ChatPane.tsx` | 세션별 scrollTop 보관. |

### 5.2 동시 스트리밍 (Phase 4)

- 여러 세션이 동시에 응답을 받을 수 있다 (각 세션 독립 `AbortController` — BACKEND §5).
- 비활성 세션도 백그라운드에서 메시지 누적 (이전 세션 전환해도 스트리밍 중단되지 않음).
- 비활성 세션에 새 응답이 도착하면 Sidebar 에 배지 (예: 굵게).

---

## 6. 컴포넌트 렌더링 전략

### 6.1 메시지 리스트 가상화

- **현재: 미사용.** `ChatPane.tsx` 의 메시지 리스트는 일반 `messages.map(...)` 렌더링.
- 도입 임계값·라이브러리·시점 모두 **TBD**. Phase 1 mockup 단계에서는 메시지 수가 적어 문제 없음.
- Phase 3+ 로컬 DB 도입과 함께 검토 권장.

### 6.2 스트리밍 렌더링 최적화

- `assistant_delta` 이벤트마다 `pendingDelta` 에 누적. UI 업데이트는 **16ms throttle** (60Hz 리렌더 상한).
- 마크다운 파싱은 `pendingDelta` 가 메시지로 commit 되는 시점 (`assistant_message`) 에 1회만 — 스트리밍 중에는 plain text.
- 코드 블록 하이라이팅도 동일하게 지연 (shiki async 로드).

### 6.3 마크다운 + 코드 블록

| 항목 | 구현 |
|---|---|
| Markdown 렌더러 | `components/markdown/Markdown.tsx` — react-markdown + remarkGfm. h1~h4, p, a, ul/ol, blockquote, table, code 각각 커스터마이즈. |
| 이미지 정책 | **data-uri 만 허용** (보안). 외부 URL 차단. |
| 링크 정책 | 외부 링크 클릭은 `shell.openExternal` 경유 (Main 측에서 처리). target=_blank rel=noopener noreferrer 표시. |
| 코드 블록 | `components/markdown/CodeBlock.tsx` — shiki 싱글톤 비동기 로드. 지원 언어 11종 (typescript / tsx / javascript / jsx / python / bash / json / yaml / html / css / markdown). 테마 3종 (github-light / github-dark / one-light). |
| 테마 추적 | `document.documentElement.dataset.theme` 의 MutationObserver. data-theme 변경 시 코드 블록 자동 재렌더링. |
| 로딩 fallback | shiki 로드 전엔 plain `<pre>` 표시. 로드 완료 후 HTML replace. |
| 복사 버튼 | named group (`group/codeblock` + `group-hover/codeblock:opacity-100`) 으로 hover 범위 자기 자신으로 한정. (`app/CLAUDE.md` 의 named group 규칙 참조.) |

### 6.4 마크다운 보안

- HTML 렌더링: react-markdown 의 기본값 (raw HTML 비활성) 유지.
- 이미지: data-uri 만 허용 (위 §6.3).
- 외부 URL 자동 차단: `will-navigate` (Main) + `setWindowOpenHandler` (Main).

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
| Enter | 메시지 전송 | `ChatPane.tsx` Composer |
| Shift + Enter | 줄바꿈 | 동일 |

> 그 외 단축키 (Cmd/Ctrl+N 새 대화 등) 는 **현재 미구현**. PRD §11 OQ 추가 후보.

### 7.2 입력창 (Composer)

`app/ChatPane.tsx` 의 Composer 섹션:

- 멀티라인 textarea + 자동 높이 조절
- 3-chip 행: 첨부 / 현재 프레임 / Skill 선택 (`Popover` 기반 picker)
- `/skillname` 토큰을 **활성 스킬일 때만** 파란 chip 으로 mirror overlay 강조 (`HighlightedTextarea.tsx`, `knownSkillNames: ReadonlySet<string>`)
- `@filepath` 자동완성: 디렉토리 단계별 진입, quoted/plain 자동 감지, 공백 시 자동 wrapping
- 전송 후 입력창 비우기, 포커스 유지

### 7.3 로딩 / 에러 / 네트워크 상태

| 상태 | UI 표시 | 위치 |
|---|---|---|
| 요청 대기 | StatusLine "Thinking... (Ns · ~Mtokens)" | `atoms/StatusLine.tsx` |
| 스트리밍 중 | StatusLine + 응답 메시지에 누적 텍스트 | `ChatPane.tsx` |
| 에러 (`recoverable: true`) | 메시지 영역에 에러 카드 | `chatReducer.ts` 의 `state.error` |
| 에러 (`auth.expired`) | AuthExpiredModal (`claude /login` 안내) | `components/auth/AuthExpiredModal.tsx` |
| CLI 설치 진행 | InstallerDialog (라인별 로그 + 수동 명령 복사) | `components/install/InstallerDialog.tsx` |
| 네트워크 단절 | TBD (전역 배너 미구현) | — |

### 7.4 접근성

- 모든 인터랙티브 요소 키보드 접근 가능 (Composer / Sidebar / TweaksPanel)
- 다크/라이트/쿨 3 테마 — `data-theme` 속성 기반
- ARIA 레이블 / 스크린리더 지원: 현재 부분 적용 (TBD — 체계적 audit 필요)

---

## 8. 도메인 카탈로그 (Orca 고유)

`app/screens.ts` 의 `ScreenId` enum 과 Tweaks 패널을 화면 단위로 정리.

| ID / 컴포넌트 | 화면 라벨 | breadcrumb | Phase 상태 | 비고 |
|---|---|---|---|---|
| `chat` (`ChatPane.tsx`) | 01 채팅 | (없음) | **✅ Phase 1·2 활성** | 실 IPC 연결됨. Composer 자동완성·ToolCard·Markdown·CodeBlock 모두 구현. |
| `projects` (`Projects.tsx`) | 02 프로젝트 | 프로젝트 | 🚧 Phase 1 mockup | 카드 그리드 시각만. 실 데이터 없음. **PRD §9 Future Scope.** |
| `engine` (`EngineSettings.tsx`) | 03 엔진 & 모델 | 설정 · 엔진 & 모델 | 🚧 Phase 1 mockup | 엔진/모델 카드 시각만. **Phase 3+ 도입 예정**: 어댑터별 base URL + API key 입력 UI 의 호스트 (BACKEND §8). |
| `skills` (`SkillsMcp.tsx`) | 04 Skills / MCP | 설정 · Skills & MCP | 🚧 Phase 1 mockup + Phase 2 부분 활성 | 시각은 mockup. Skills 목록 스캔 (`useSkills`) 은 Composer 자동완성에 활성. 권한·MCP 토글은 Future. |
| (Tweaks Panel) `TweaksPanel.tsx` | (플로팅 패널) | — | **✅ Phase 2+ 영속** | theme / density / sidebarCollapsed — electron-store 동기화. |

> **CameraPane.tsx** 와 **CapturesPlaceholder.tsx** 는 코드에 존재하지만 도메인 카탈로그에서 제외 (GLOSSARY §3 사용자 결정).

### 8.1 Future Scope 도메인의 IPC 연결 시점

- **Projects**: Phase 3+ 로컬 DB 도입 (BACKEND §6) 과 함께. 세션을 프로젝트별로 그룹화하는 메타데이터.
- **EngineSettings**: Phase 3+ 어댑터별 자격증명 저장 (BACKEND §8) 과 함께. base URL + API key 입력 UI.
- **SkillsMcp 권한·MCP**: Phase 4+ SDK 고급 기능 (`options.permissionMode` / `mcpServers`) 도입 시. PRD OQ9 미정.

---

## 9. IPC 호출 (Renderer → Main)

### 9.1 호출 규칙

- 직접 `window.orca.*` 호출은 **`state/use*.ts` hook 안에서만** 한다. 컴포넌트가 직접 호출 금지 (현재 `App.tsx` 의 초기화 effect 정도가 예외).
- 모든 IPC 호출은 타입이 있어야 한다 (채널 정의는 [IPC_CONTRACT.md](./IPC_CONTRACT.md) 참조).
- 에러는 throw 로 전달 (Main 측에서 직렬화된 `{ code, message, recoverable }` 객체).

### 9.2 스트리밍 응답 수신

`useChat()` 의 패턴 (`state/useChat.ts`):

```typescript
useEffect(() => {
  // 1회 구독
  const unsubscribe = window.orca.chat.onEvent((ev) => {
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
window.orca.chat.cancel(sessionId)  // → ipcRenderer.invoke('orca:chat:cancel', ...)
```

Main 이 `AbortSignal` 을 SDK `query()` 에 전파 → 현재 inflight 만 중단. 진행 중이던 도구 호출은 SDK 가 정리.

### 9.4 채널 전체 목록

[IPC_CONTRACT.md](./IPC_CONTRACT.md) §2 참조. Phase 2 활성 11채널.

---

## 10. 현재 구현 상태

| 영역 | Phase | 상태 | 비고 |
|---|---|---|---|
| Frame / Titlebar / Sidebar (collapsed/expanded) | Phase 1 | ✅ 완료 | mockup 시각 재현 |
| ChatPane 메시지 리스트 + 스트리밍 표시 | Phase 2 | ✅ 완료 | 16ms throttle |
| Composer 3-chip + Skill picker | Phase 2++ | ✅ 완료 | Popover + `insertSkillFromMenu` |
| Composer `/skill` 인라인 자동완성 | Phase 2++ | ✅ 완료 | `SkillAutocomplete` + `useSkillAutocomplete` |
| Composer `@file` 자동완성 | Phase 2++ | ✅ 완료 | `FileAutocomplete` + `useFileAutocomplete` |
| Markdown 렌더링 (react-markdown + GFM) | Phase 2 | ✅ 완료 | `components/markdown/Markdown.tsx` |
| Shiki 코드 블록 (3테마 + 11언어) | Phase 2 | ✅ 완료 | `components/markdown/CodeBlock.tsx` |
| ToolCard 렌더링 (input/output 토글) | Phase 2 | ✅ 완료 | `ChatPane.tsx` 내부 |
| AuthExpiredModal | Phase 2 | ✅ 완료 | `error / auth.expired` 이벤트 트리거 |
| InstallerDialog | Phase 2 | ✅ 완료 | claude-code 는 SDK 자동 처리로 즉시 done |
| Tweaks (theme/density/sidebar) + electron-store 영속화 | Phase 2+ | ✅ 완료 | `useTweaks` |
| 세션 재개 (lastSessionId 부팅 복원) | Phase 2+ | ✅ 완료 | `RESTORE_SESSION` 액션 |
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
