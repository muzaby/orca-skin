# Orca — Technical Requirements Document (v1)

> `docs/PRD.md` 의 *WHAT* 을 *HOW* 로 옮기는 기술 사양. 기능·스택·API·데이터 모델을 다룬다. 시스템 구성·프로세스 모델·모듈 레이아웃·데이터 흐름 등 아키텍처 구조는 `docs/ARCHITECTURE.md` (Renderer) + `docs/ARCHITECTURE.md` (Main) + `docs/IPC_CONTRACT.md` (채널 SSOT) + `docs/GLOSSARY.md` (용어 SSOT) 4 문서 참조.

| 항목 | 값 |
|---|---|
| 문서 버전 | v1 (MVP 구현 사양) |
| 입력 | `docs/PRD.md` (MVP §6, §7, §11), `docs/etc/llm-chat-desktop-strategy.md` |
| 출력 대상 | 코드 작성 에이전트 / 구현자 |
| 범위 | Phase 1 MVP 본문. Phase 2~4 / Future Scope = §10 anchor only |
| 미정 항목 처리 | PRD §11 Open Questions 는 **여기서 결정하지 않는다.** "결정 후 결정값으로 대체" 표시만 둔다. |

> **Phase 1 단일 백엔드 결정 (2026-05-13)**
> Phase 1 MVP 는 **`claude-code` 단일 백엔드** 로 구현한다. `opencode` 어댑터는 `SessionAdapter` 인터페이스로만 자리를 남겨두고 **§10 future anchor** 로 이동했다. 따라서 §4 의 `@opencode-ai/sdk` 와 §7.2 (OpencodeAdapter) 는 *예약 사양* 으로 본다 — 코드에는 구현되어 있지 않다. AdapterRegistry 는 claude-code 만 등록한 상태에서 동작한다 (OQ7 는 자동으로 무관). 자세한 채택 표는 `docs/claude-code-spec.md §11` 도 함께 본다.

> **Preload 노출 표면 축소 결정 (2026-05-13)**
> preload `window.orca` 는 **renderer 가 실제 호출하는 채널만** 노출한다 (principle of least privilege). Phase 2 활성 6채널: `chat:send`/`chat:event`/`chat:cancel`/`backend:list`/`install:start`/`install:status`. 이전 Q1 ("`backend:select` 유지") 결정은 본 정책 도입으로 **취소** — 단일 백엔드에서 사용처가 없으므로 main 핸들러까지 함께 제거했다. `settings:get`/`settings:set` 도 동일 사유로 Phase 2 범위 밖. 향후 사용처가 생기면 (멀티 백엔드 / 영속화) 한 PR 에서 preload+main+CHANNELS 를 함께 다시 등록한다. zod 스키마 (`shared/protocol.ts`) 는 main 전용이며, preload 는 zod 비종속의 `shared/ipc.ts` 만 import 한다 (`sandbox: true` 호환).

---

## 1. 문서의 목적과 범위

본 문서는 Orca v1 MVP (Phase 1) 가 **무엇을 기능으로 제공하고, 어떤 기술 스택으로 만드는가** 를 검증 가능한 형태로 정의한다.

본문은 Phase 1 만 다루며, Phase 2~4 확장 구조는 §10 의 anchor 로만 언급한다. 하드웨어·Skills·MCP·Captures·Projects 등 도메인 기능은 `docs/PRD.md` §9 Future Scope 를 참조.

시스템이 **어떻게 구성되어 있고 입력이 어디로 흘러가는가** 는 `docs/ARCHITECTURE.md` / `docs/ARCHITECTURE.md` / `docs/IPC_CONTRACT.md` 4문서에서 다룬다 (2026-05-20 이전 `architecture.md` 단일 파일에서 분할).

---

## 2. Functional Spec (Phase 1)

PRD §6.1 의 F1~F10 을 *수용 기준* 으로 구체화한다.

| ID | 요구사항 | 구현 책임 모듈 | 수용 기준 | PRD |
|---|---|---|---|---|
| F1 | **Chat 입력/스트리밍** | Composer, MessageList, useEngineStream | 전송 즉시 첫 `assistant_delta` 가 N ms 내 도착 (SLA는 OQ6), 토큰 단위 누적 표시, 마지막 `assistant_message` 로 완성본 교체 | §6.1 |
| F2 | **마크다운 렌더링** | Markdown, react-markdown + shiki | 본문 + 코드 블록 syntax highlighting, 타겟 언어: Python·JavaScript·TypeScript·Bash 등 (shiki 제공 범위), 안전성: markdown 구현체의 sanitize 기본 적용 | §6.1 |
| F3 | **도구 호출 표시** | ToolCallCard, MessageList | `tool_use` 이벤트 도착 시 카드 생성 (이름·입력 JSON 표시), 같은 `toolUseId` 의 `tool_result` 도착 시 카드에 결과·소요시간 추가, 상태 전이: pending → running → completed/failed | §6.1 |
| F4 | **단일 활성 대화 컨텍스트** | ChatState (reducer), Adapter | 같은 `sessionId` 를 매 턴 어댑터에 전달 (Claude: `options.resume` / opencode: same session HTTP call), Renderer는 `sessionId` 변수 1개만 메모리 보관, 백엔드가 이전 턴들을 복원 | §6.1 |
| F5 | **새 대화** | ChatShell ("새 대화" 버튼) | `sessionId = null` 리셋 → reducer 메시지 배열·pendingDelta 초기화, 다음 전송 시 `sendMessage(null, ...)` 호출 → 어댑터가 ID 발급 (`init` 이벤트에서 추출) | §6.1 |
| F6 | **백엔드 선택** | AdapterRegistry, BackendSelector UI | 시작 시 병렬 `isInstalled()` → (둘 다/한쪽/없음) 결과. 둘 다 설치: 사용자 선택 또는 OQ7 정책. 한쪽: 자동 선택. 없음: 인스톨러 트리거. v1에서 세션 중 전환 불가 | §6.1 |
| F7 | **CLI 설치 자동화** | Installer (IPC `orca:install:*`) | 둘 다 미설치 → 다이얼로그 (npm / curl 선택) → child_process 실행 → 라인 단위 status 스트림 → 완료/실패 표시 | §6.1 |
| F8 | **설치 실패 폴백** | Installer | 자동 실패 → 수동 명령 전체 텍스트 UI에 표시 + 복사 버튼. Node.js 미설치 (Windows: choco, macOS: brew 안내), npm 글로벌 권한 부족 (sudo / npm config 안내) | §6.1 |
| F9 | **인증 만료 처리** | ClaudeCodeAdapter, Auth modal | Claude Code OAuth 401 감지 (stdout/stderr `"401"` / `"expired"` 패턴) → `error / auth.expired` 이벤트 → UI 모달 "`claude /login` 을 터미널에서 실행 후 새 대화" | §6.1 |
| F10 | **Tweaks 패널** | TweaksPanel, useTweaks | 테마 선택 (Classic/Dark/Cool) + 밀도 슬라이더 (11.5/13/14.5px) + 사이드바 접기 토글 → `data-theme` 속성 + root `font-size` 동적 갱신 → Tailwind `@theme` 토큰 스코프 cascade → 전 화면 반영. 선택값은 Phase 1에서 메모리만 (Phase 2+ `electron-store` 로 영속화). 트리 remount 불요 (CSS 변수 재설정으로 충분). Phase 2+ 에서 ThemeProvider 로 영속화 연동 검토 | §6.1 |

**비고**: 모듈 경로·정확한 IPC 채널·컴포넌트 트리는 [ARCHITECTURE.md](ARCHITECTURE.md) / `IPC_CONTRACT.md` 참조. 위 표는 *기능 정의* 에만 집중.

---

## 3. Non-functional Spec

PRD §6.2 의 N1~N6 을 구현 가능한 형태로 변환한다.

| ID | 요구사항 | 명세 |
|---|---|---|
| N1 | **플랫폼** | Windows x64 1차 지원. macOS (arm64 + x64), Linux (x64) 는 후순위. Electron 다중 빌드 (`electron-builder.yml`) |
| N2 | **i18n** | 한국어 라벨 (`src/shared/i18n/ko.ts`). 기술 용어/터미널 출력은 영어 그대로. |
| N3 | **접근성** | 키보드 단축키: 새 대화 (Ctrl+N), **전송 (Enter), 줄바꿈 (Shift+Enter)**, Tweaks 패널 (Shift+T 등, [arch/frontend/ux-domains.md](arch/frontend/ux-domains.md) §1.1 참조). 다크모드는 Tweaks 경유 (CSS 변수 override). ARIA label은 주요 UI 요소에. (전송 키 결정: 2026-05-13 — chat 류 앱 관례를 따라 Ctrl+Enter 대신 Enter 단일 키로 변경) |
| N4 | **데이터 위치** | 세션 본체: CLI 저장소 (Claude Code: `~/.claude/projects/<cwd>/<id>.jsonl`, opencode: `~/.local/share/opencode/` 등). 앱: 메모리에 `sessionId` 변수 1개만 보유. Phase 2+ `electron-store` (선택값·마지막 세션 ID 등) |
| N5 | **응답 지연 가이드** | 첫 토큰까지 지연, 시작 시간 SLA = OQ6. 목표치가 정해지면 본 섹션 갱신. |
| N6 | **보안** | 현재 (Phase 2): OAuth/API 키 미저장 (SDK 가 `~/.claude` 자동 사용). **Phase 3+ 채택 결정**: 어댑터별 base URL + API key 를 safeStorage 로 저장 ([arch/backend/security.md](arch/backend/security.md) §1.4). 마크다운 렌더링 시 XSS sanitize (react-markdown 기본). Electron contextIsolation=true, sandbox=true 적용 (상세는 [arch/backend/security.md](arch/backend/security.md)). |

---

## 4. Tech Stack (확정 vs 미정)

electron-vite 환경 기준. 표 밖 의존성 추가 시 **사용자 승인 필수**.

| 계층 | 채택 | 버전·옵션 | 확정 여부 | 비고 |
|---|---|---|---|---|
| 데스크톱 셸 | Electron | ^39 (스캐폴드 기준) | 미정 OQ3 | 패키징/서명/auto-update |
| 빌드 아키텍처 | electron-vite | ^5 | 확정 | main/preload/renderer 3 sub-config |
| 번들러 | Vite | ^7 | 확정 | electron-vite가 sub-config 통합 |
| 언어 | TypeScript | strict, `target: ES2022` | 확정 | 타입 안정성 |
| UI 프레임워크 | React | ^19 | 확정 (~~OQ1~~ 해소, 2026-05-20) | React Hooks + Context/reducer |
| 상태 관리 (Renderer) | **Phase 1·2**: React Context + useReducer. **Phase 4**: Zustand | — | 확정 (Phase 4 전환 채택) | 단일 root + `sessions: Record<sessionId, SessionState>` 슬라이스. 외부 dispatch (`getState().recv(ev)`) 로 React 트리 외부에서 호출. **Phase 3 사전 마이그레이션 금지** — Phase 4 진입 PR 묶음에서 한 번에 전환. 상세 [arch/frontend/state.md](arch/frontend/state.md) §1.4 |
| 스타일링 | Tailwind CSS | **^4** (`@tailwindcss/vite` 플러그인, CSS-first `@theme`) | 확정 (Phase 1 완료) | utility-first. `styles/tokens.css` 의 `@theme` 블록으로 시맨틱 디자인 토큰 정의 (`--color-{bg,sidebar,ink,...}`). `[data-theme]` 스코프로 Classic/Dark/Cool 전환. Tweaks 패널과 연동. 자세한 정책은 `app/AGENTS.md` "스타일링 정책" 참조 |
| 마크다운 렌더링 | react-markdown + remark-gfm + shiki | `^9` / `^4` / `^1` | 확정 (Phase A `feat-pretty-ui` 도입) | GFM (표·체크박스) + 코드 블록 syntax highlighting. shiki 번들은 11개 언어 (ts/js/tsx/jsx/python/bash/json/yaml/html/css/markdown) 로 제한 |
| LLM 백엔드 SDK (Claude) | `@anthropic-ai/claude-agent-sdk` | latest | 확정 (Phase 3 채택, 2026-05-18) | TypeScript SDK. 진입점 `query({ prompt, options })`. 플랫폼별 native binary 는 `optionalDependencies` 자동 처리. 최소 요구 Node.js 18+. API 명세 SSOT 는 `docs/spec/claude/agent-sdk/typescript.md` |
| HTTP (opencode) | `@opencode-ai/sdk` | latest | 확정 | 공식 SDK 사용 |
| IPC | Electron 기본 ipcRenderer/ipcMain | — | 확정 | 별도 RPC 라이브러리 금지. main→renderer 는 Electron 가 ordered + lossless 보장 — 별도 메시지큐 미도입 (멀티 세션 도입 시 §11.3 anchor) |
| IPC 보안 | `@electron-toolkit/preload` + contextBridge | ^3 | 확정 | preload 화이트리스트 |
| 입력 검증 | zod | latest | 확정 | IPC 메시지 + SDK / SSE 응답 파싱 |
| 영속화 (Phase 2+) | `electron-store` | — | **확정 (Phase 2+ 완료)** | 6 키 — `theme` / `density` / `sidebarCollapsed` / `lastBackend` / `lastSessionId` / `windowBounds`. §6.7 참조 |
| 로컬 DB (Phase 3+) | better-sqlite3 (Phase 3 MVP raw) / Drizzle 후보 (Phase 4 재검토) | — | **채택 (Phase 3+)** | 메시지·세션 메타 SSOT. 어댑터 외부 저장 (jsonl 등) 은 단방향 동기화 소스로 격하. 마이그레이션 `src/main/db/migrations/NNN_<name>.sql`. **Phase 3 MVP: raw better-sqlite3 + prepared statements (쿼리 6 개 내외, ORM 가치 작음). Drizzle 은 Phase 4 멀티 세션·artifact·권한·통계 도입 시 재검토 (2026-05-20).** 상세 [arch/backend/persistence.md](arch/backend/persistence.md) |
| 자격증명 (Phase 3+) | Electron `safeStorage` (OS keychain) | — | **채택 (Phase 3+)** | 어댑터별 base URL + API key 암호화 저장. [arch/backend/security.md](arch/backend/security.md) §1.4 |
| Python 런타임 (Phase 3++) | `uv` (동봉 바이너리) + python-build-standalone (첫 실행 다운로드) | uv latest / Python 3.12 | **채택 (Phase 3++)** | agent 의 Python 도구 실행용 격리 환경. `<userData>/runtime` 의 uv venv + 인터프리터. 시스템 비오염. 인터프리터 확보 4-A(github 다운로드) 기본, operator 가 `UV_PYTHON_INSTALL_MIRROR`/`UV_DEFAULT_INDEX` 지정 시 그 값으로 수렴. SDK `query().options.env` 로 `UV_*`/`PATH` 주입. uv 바이너리는 빌드 전 `scripts/fetch-uv.mjs` 로 `resources/bin/` 배치 + `extraResources` 동봉 |
| 패키징 | electron-builder | ^26 | 미정 OQ3 | signing/notarization/auto-update. **uv 바이너리 `extraResources` 동봉. macOS 는 동봉 바이너리 codesign/notarize 대상 포함 필요** |
| 테스트 (단위) | Vitest | latest | 확정 | 어댑터·reducer·IPC zod·installer |
| 테스트 (E2E) | Playwright | latest | 확정 | Electron 지원 |

**정책**: 위 표 외의 패키지 (예: date-fns, lodash, redux 등) 도입 시 먼저 사용자 확인. (`zustand` 는 Phase 4 전환으로 채택됨.)

---

## 5. IPC API Specification

### 5.1 채널 명명 규칙

모든 IPC 채널은 `orca:<domain>:<action>` 형식.
- `domain`: 기능 영역 (chat, backend, install, settings)
- `action`: 동작 (send, event, cancel, list, select, start, status, get, set)

### 5.2 채널 카탈로그

> **SSOT 는 [`IPC_CONTRACT.md`](./IPC_CONTRACT.md) §2** — 본 표는 TRD 의 가독성용 미러. 충돌 시 IPC_CONTRACT 우선. 채널 변경 절차는 IPC_CONTRACT §6 참조.

Phase 2 활성 **11 채널** — 7 도메인 (chat / backend / install / settings / skills / files / session). preload + main 양쪽에 등록.

| 채널 | 방향 | 요청 페이로드 (TS) | 응답·스트림 | zod 스키마 |
|---|---|---|---|---|
| `orca:chat:send` | R→M (invoke) | `SendChatMessage` = `{ sessionId: string \| null; text: string }` | `Promise<void>` (ack). 응답은 `orca:chat:event` 스트림 | SendChatMessage |
| `orca:chat:event` | M→R (send) | — | `ChatEvent` (반복) | ChatEvent union |
| `orca:chat:cancel` | R→M (invoke) | `CancelChat` = `{ sessionId: string }` | `Promise<void>` — `AbortSignal` 전파 | CancelChat |
| `orca:backend:list` | R→M (invoke) | — | `BackendListResult` = `{ backends: { id: Backend; installed: boolean; version?: string }[]; active?: Backend }` | (검증 생략) |
| `orca:install:start` | R→M (invoke) | `StartInstall` = `{ backend: Backend }` | `Promise<void>` (ack). 진행은 `orca:install:status` 스트림. 현재 claude-code 는 SDK `optionalDependencies` 자동 해소 → 즉시 `done: true` | StartInstall |
| `orca:install:status` | M→R (send) | — | `InstallStatus` = `{ step: string; progress?: number; log?: string; error?: string; done?: boolean }` | InstallStatus |
| `orca:settings:get` | R→M (invoke) | — | `Settings` (electron-store 전체 객체) | (검증 생략) |
| `orca:settings:set` | R→M (invoke) | `SettingsPatch` = `Partial<Settings>` | `Settings` (병합·검증된 전체 객체) | SettingsPatch |
| `orca:skills:list` | R→M (invoke) | — | `SkillInfo[]` = `{ name: string; description: string; argumentHint?: string }[]` — 부팅 1회 스캔, 핫리로드 없음 | (검증 생략) |
| `orca:files:list` | R→M (invoke) | `ListFilesRequest` = `{ cwd: string; relDir: string }` | `FileEntry[]` = `{ name: string; isDirectory: boolean }[]` — `@` 자동완성용 | ListFilesRequest |
| `orca:session:cwd` | R→M (invoke) | — | `Promise<string>` — 현재 작업 디렉토리 | (검증 생략) |

Phase 2 범위 밖 (예약 — 도입 시점에 재등록):

| 채널 | 도입 시점 | 사유 |
|---|---|---|
| `orca:backend:select` | opencode 어댑터 활성화 시 | 단일 백엔드 운영, 선택 호출자 없음 |
| `orca:message:*` (list / append / delete) | **Phase 3+** | 로컬 DB SSOT 도입과 함께 ([arch/backend/persistence.md](arch/backend/persistence.md)) |
| `orca:session:list` / `:load` / `:delete` | **Phase 3+** | `SessionAdapter.listSessions?()` / `loadSession?()` 옵셔널 메서드 노출 |
| `orca:credentials:set` / `:hasKey` | **Phase 3+** | safeStorage 자격증명 ([arch/backend/security.md](arch/backend/security.md) §1.4) |
| `orca:skills:reload` | **Future** | 핫리로드 도입 시 |

> **Phase 3+ 이후 추가 도메인** (본 표는 Phase 2 미러라 누락 — SSOT 는 IPC_CONTRACT §2): `session` 5 · `project` 5 · `window` 3 · `search` 1 · `mcp` 4 · **`runtime` 3 (Python uv 런타임 — `orca:runtime:status` / `:prepare` / `:statusEvent`, IPC_CONTRACT §2.11)**. 총 31 채널.

### 5.3 `window.orca` API (Preload 화이트리스트)

```typescript
// src/preload/index.ts 에서 노출 (Phase 2 활성 11 채널 표면)
interface OrcaApi {
  chat: {
    send(req: { sessionId: string | null; text: string }): Promise<void>;
    onEvent(handler: (ev: ChatEvent) => void): () => void;  // unsubscribe 함수 반환
    cancel(sessionId: string): Promise<void>;
  };
  backend: {
    list(): Promise<BackendListResult>;  // { backends: { id; installed; version? }[]; active? }
  };
  install: {
    start(backend: Backend): Promise<void>;
    onStatus(handler: (st: InstallStatus) => void): () => void;
  };
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
  };
  skills: {
    list(): Promise<SkillInfo[]>;
  };
  files: {
    list(req: { cwd: string; relDir: string }): Promise<FileEntry[]>;
  };
  session: {
    cwd(): Promise<string>;
  };
}

declare global {
  interface Window {
    orca: OrcaApi;
  }
}
```

Renderer 코드는 `window.orca.*` 만으로 통신 (ipcRenderer 직접 접근 금지). `backend.select` / `credentials.*` / `message.*` / `session.list|load|delete` 는 §5.2 의 예약 표대로 도입 시점에 노출한다.

**Preload 안전 import 정책**: preload 는 `sandbox: true` 로 실행되므로 Node `require` 가 화이트리스트 (`electron`, `events`, `timers`, `url`) 로 제한된다. 따라서 preload 는 zod 가 끼어있는 `src/shared/protocol.ts` 를 **import 하지 않는다**. CHANNELS 상수와 순수 TS 타입은 별도 파일 `src/shared/ipc.ts` (zod 0 의존) 에 두고, preload + renderer 가 이 파일을 import 한다. zod 스키마는 main 측 IPC 라우터에서만 사용.

### 5.4 스트림 종료 신호

- `orca:chat:event` 스트림: `ChatEvent { type: 'result' | 'error' }` 도착 시 **턴 종료** → Renderer가 `inflight` 플래그 해제.
- `orca:install:status` 스트림: `{ step: 'complete' | 'failed' }` 도착 시 설치 프로세스 종료.

---

## 6. Data Models

TS 타입 정의의 단일 출처. 구현은 `app/src/shared/ipc.ts` (zod-free) + `app/src/shared/protocol.ts` (zod 스키마) + `app/src/main/adapters/types.ts`. 용어 정의는 [`GLOSSARY.md`](./GLOSSARY.md), IPC 채널 카탈로그는 [`IPC_CONTRACT.md`](./IPC_CONTRACT.md) §2 가 SSOT.

### 6.1 Backend (백엔드 선택)

```typescript
type Backend = 'claude-code' | 'opencode';
```

### 6.2 ChatEvent (어댑터→Renderer 정규화 스트림)

Discriminated union. 어댑터가 CLI/SDK의 다양한 형식을 이 하나의 타입으로 정규화.

| type | data 형태 | 발화자 | Renderer 처리 |
|---|---|---|---|
| `init` | `{ sessionId: string; model?: string; cwd: string; }` | 어댑터 (첫 응답) | sessionId 저장, UI 업데이트 |
| `assistant_delta` | `{ text: string; }` | LLM 스트리밍 | `pendingDelta` 누적, debounce 렌더 |
| `assistant_message` | `{ text: string; }` | LLM 턴 종료 | `pendingDelta` → 최종 메시지로 교체 |
| `tool_use` | `{ toolUseId: string; name: string; input: unknown; }` | LLM 도구 호출 | ToolCallCard 생성 |
| `tool_result` | `{ toolUseId: string; output: string \| unknown; isError: boolean; durationMs?: number; }` | CLI/LLM | 해당 ToolCallCard 업데이트 |
| `result` | `{ usage?: { inputTokens: number; outputTokens: number; }; }` | 어댑터 | 턴 완료, `inflight = false` |
| `error` | `{ code: string; message: string; recoverable: boolean; }` | 어댑터 (언제든) | 에러 토스트 + 선택적 복구 UI |

> **(Phase 4 anchor)** 멀티 세션 (§10) 도입 시 모든 변형에 `sessionId: string` 필드 추가 예정. 현재는 `init` 만 보유 — 단일 inflight 모델에서는 sessionId 식별 불요. main↔renderer IPC 는 Electron 의 ordered+lossless 보장을 그대로 활용 (별도 메시지큐 미도입). 상세는 [arch/frontend/state.md](arch/frontend/state.md) §2.

> **(OQ10)** `tool_use.name` / `tool_use.input` 표준화 정책 미정 — PRD §11 OQ10 진실 원천. Phase 3 단일 백엔드 운영에서는 raw 전달 (분기 의미 없음). opencode 어댑터 활성화 PR 에서 결정.

> **(정규화 계층 — 구현됨)** 위 `ChatEvent` 표는 구 claude-code 결합 형태로 **제거됨**. 와이어(`orca:chat:event`)는 provider 중립 **`NormalizedEvent`**(`session.updated`·`message.delta/completed`·`tool.call.started/completed`·`telemetry`·`error`·`permission.requested`/`permission.resolved`)이며 claude 어댑터가 `claudeToNormalized`(`adapters/claude-map.ts`)로 SDK 메시지를 직접 정규화한다. 정본은 [arch/backend/provider-runtime.md](arch/backend/provider-runtime.md) §2 + `app/src/shared/ipc.ts`. 본 §6.2 표는 변이명 매핑 참고용 히스토리로만 둔다(`init`→`session.updated`, `assistant_delta`→`message.delta`, `tool_use`→`tool.call.started` 등).

### 6.3 SessionAdapter (공통 인터페이스)

```typescript
interface SessionAdapter {
  readonly id: Backend;
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>;
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>;
  sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
    signal?: AbortSignal,
  ): AsyncIterable<ChatEvent>;

  // Phase 3+ (옵셔널, v1에서는 구현 안 함)
  listSessions?(): Promise<SessionInfo[]>;
  loadSession?(id: string): Promise<ChatEvent[]>;
}
```

내부 구현 패턴 (SDKMessage→ChatEvent 정규화, AbortSignal 전파, 인증 만료 감지, 인스톨러 스트리밍) 의 SSOT 는 [arch/backend/adapters.md](arch/backend/adapters.md). 현재 코드는 이미 `sendMessage(req: TurnRequest)` 객체 시그니처를 채택했다([arch/backend/adapters.md](arch/backend/adapters.md) §1.3). provider 중립 capability/권한/revert 정규화(SessionCapability·PermissionBridge·RevertManager 등)의 설계는 [arch/backend/provider-runtime.md](arch/backend/provider-runtime.md) (설계 확정 / 구현 대기).

### 6.4 SessionInfo

```typescript
interface SessionInfo {
  id: string;
  createdAt: string;      // ISO8601, 예: "2026-05-12T10:30:00Z"
  title?: string;         // CLI가 제공하는 경우만
  cwd: string;
  backend: Backend;
}
```

### 6.5 ChatState (Renderer 상태 모델)

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    toolUseId: string;
    name: string;
    input: unknown;
    result?: { output: string | unknown; isError: boolean; durationMs?: number; };
  }>;
}

interface ChatState {
  sessionId: string | null;        // 활성 세션 ID (메모리만 보관)
  backend: Backend | null;         // 활성 백엔드
  messages: Message[];             // 누적 메시지
  pendingDelta: string;            // 진행 중인 assistant_delta 누적
  inflight: boolean;               // 현재 턴 진행 중 (전송 중/응답 대기)
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}
```

**리듀서 액션**:
- `SEND_USER_MESSAGE(text)` → message 추가, `inflight = true`
- `RECV_EVENT(ev: ChatEvent)` → ev 타입별로 상태 업데이트
- `NEW_CHAT` → `sessionId = null`, messages 초기화, `pendingDelta` 초기화
- `CANCEL_CHAT` → `inflight = false`, 에러 표시

### 6.6 Error 코드 표

`IPC_CONTRACT.md` §4 와 1:1. 충돌 시 IPC_CONTRACT 우선.

| 코드 | 의미 | 복구 가능 | 사용자 표시 |
|---|---|---|---|
| `sdk.crashed` | SDK `query()` 내부 예외 (claude-code 어댑터) | yes | 새 대화 안내 |
| `sdk.spawn-failed` | SDK 가 platform binary 해소 실패 (부팅 시점) | yes | 인스톨러 다이얼로그 트리거 |
| `cli.not-installed` *(deprecated)* | 백엔드 CLI 미발견 (CLI spawn 시기) | yes | (Phase 3 SDK 마이그레이션 이후 사실상 미발생) |
| `cli.spawn-failed` *(deprecated)* | spawn 실패 / EACCES / 경로 문제 | yes | (legacy) |
| `cli.crashed` *(deprecated)* | 프로세스 비정상 종료 (exit code ≠ 0) | yes | (legacy) |
| `cli.timeout` *(deprecated)* | CLI 무응답 (타임아웃 값은 OQ6) | yes | (legacy) |
| `auth.expired` | SDK 가 401 / OAuth / expired 패턴 throw | yes | "`claude /login` 실행 후 새 대화" 모달 (AuthExpiredModal) |
| `protocol.parse` | 어댑터 정규화 실패 (예상치 못한 SDKMessage 형태) | no | 디버그 로그 + "일반 오류" 표시 |
| `internal` | 어댑터/Main 내부 버그 | no | 디버그 로그 + "문제가 발생했습니다" |

> `cli.*` 코드 그룹은 Phase 3 SDK 마이그레이션 이후 deprecated. 후속 PR 에서 정리 예정.

### 6.7 Settings 키 카탈로그

Phase 2+ 에서 `electron-store` 로 영속화 완료. `IPC_CONTRACT.md` §2.4 의 `Settings` 타입과 1:1.

| 키 | 타입 | 설명 |
|---|---|---|
| `theme` | `'classic' \| 'dark' \| 'cool'` | 테마 선택 (lowercase 표준) |
| `density` | `'compact' \| 'normal' \| 'comfortable'` | 밀도 — 내부 매핑 11.5 / 13 / 14.5 px |
| `sidebarCollapsed` | `boolean` | 사이드바 접음 상태 |
| `lastBackend` | `Backend \| null` | 마지막 사용 백엔드 (OQ7) |
| `lastSessionId` | `string \| null` | 재개용 마지막 세션 ID |
| `windowBounds` | `{ x: number; y: number; width: number; height: number } \| null` | 마지막 윈도우 위치/크기 — 재시작 시 복원 |

---

## 7. Backend Adapters (외부 인터페이스 계약)

어댑터가 외부 CLI/SDK와 주고받는 명령·플래그·SDK 호출의 계약. *내부 구현* (SDKMessage 정규화, 서버 라이프사이클 등) 은 [arch/backend/adapters.md](arch/backend/adapters.md) 참조.

### 7.1 ClaudeCodeAdapter

> SDK `query()` API 시그니처·`Options` 필드·SDKMessage 타입·세션 재개 메커니즘 상세는 [`docs/spec/claude/agent-sdk/typescript.md`](./spec/claude/agent-sdk/typescript.md) 가 단일 출처. CLI 플래그 ↔ SDK Options 대응 표·SDKMessage→ChatEvent 매핑·MVP 채택 범위·내부 구현 패턴은 [[arch/backend/adapters.md](arch/backend/adapters.md)](./[ARCHITECTURE.md](ARCHITECTURE.md)) 참조. 본 절은 *어댑터가 외부와 어떻게 계약하는지* 만 다룬다. 권한 정책 미정(OQ9) 은 `claude-code-spec.md §5` 참조.

**설치 탐지**:

| 항목 | 절차 | 성공 기준 |
|---|---|---|
| 패키지 해소 | `require.resolve('@anthropic-ai/claude-agent-sdk')` | 모듈 발견 |
| Native binary | SDK 의 `optionalDependencies` (`@anthropic-ai/claude-agent-sdk-{darwin-arm64,darwin-x64,linux-x64,win32-x64}`) 가 자동 설치 | `query()` 호출이 `MODULE_NOT_FOUND` 없이 시작 |
| 수동 경로 (실패 시) | `options.pathToClaudeCodeExecutable` 로 사용자 지정 binary 경로 허용 | UI 안내는 Phase 3+ anchor |

**자동 설치**: 별도 절차 없음 — Claude Code 는 SDK 패키지의 `npm install` 시점에 platform binary 가 자동 설치된다. (CLI 글로벌 설치 `npm install -g @anthropic-ai/claude-code` 는 폐기.) 인스톨러 모듈은 **opencode 전용** 으로 축소 — §8 참조.

**메시지 전송** (매 턴):
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const msg of query({
  prompt: text,
  options: {
    resume: sessionId ?? undefined,
    includePartialMessages: true,
    cwd,
    // permissionMode / canUseTool / hooks: Phase 4 anchor (§10)
  }
})) {
  yield normalize(msg);  // SDKMessage → ChatEvent
}
```

- `prompt: string`: single-shot 입력 (사용자 메시지). `AsyncIterable<SDKUserMessage>` 형태는 Phase 4 anchor (다중 이미지·실시간 중단 필요 시).
- `options.includePartialMessages: true`: `SDKPartialAssistantMessage` (text_delta) 스트리밍 — CLI 의 `--verbose --include-partial-messages` 대체.
- `options.resume`: 2턴 이상에서 조건부 — `sessionId != null` 시 첫 턴의 ID 전달. CLI `--resume <id>` 와 1:1 대응.
- `options.cwd`: 작업 디렉토리 — CLI spawn 의 `{ cwd }` 대체.

**첫 응답에서 sessionId 추출**:
- 첫 SDKMessage 가 `SDKSystemMessage(subtype: 'init')` — 그 `session_id` 필드 추출
- `ChatEvent { type: 'init', sessionId, model?, cwd }` 로 정규화 (TRD §6.2)
- Renderer 가 받아서 `state.sessionId` 에 저장

**인증 만료 감지**:
- SDK 가 throw 하는 에러 객체의 메시지/코드에서 `401` / `OAuth` / `expired` 패턴 매칭 → `error / auth.expired`
- UI: `claude /login` 명령 카피 버튼 + 새 대화 권유 (정책은 CLI 시기와 동일)

**환경변수**:

| 변수 | 값 | 용도 |
|---|---|---|
| `HOME` | 사용자 홈 디렉토리 | SDK 가 `~/.claude` 의 OAuth/API 자격증명 자동 사용 + 세션 jsonl 저장 (`~/.claude/projects/<cwd>/`) |
| `CLAUDE_*` | (OQ에서 확정) | 필요 시만 |

PATH 의존성 (npm 글로벌 bin) 은 폐기 — SDK 의 `optionalDependencies` 가 platform binary 를 패키지 내부에서 해소한다.

### 7.2 OpencodeAdapter

**서버 라이프사이클**:

| 시점 | 동작 | 성공 기준 |
|---|---|---|
| 앱 시작 (opencode 활성) | `opencode serve --port 0` | 자유 포트 할당 |
| 포트 발견 | 첫 stdout: `Listening on http://127.0.0.1:<port>` 파싱 | 정규식 매칭 |
| 헬스체크 | `GET /health` 요청 | HTTP 200 응답 |
| 앱 종료 | `child.kill('SIGTERM')` 후 5초 대기 | 정상 종료 또는 SIGKILL |
| 비정상 종료 | 자동 재시작 1회 시도 | 재시도 후에도 실패 → 사용자 에러 |

**SDK 호출**:

```typescript
import { OpencodeClient } from '@opencode-ai/sdk';
const client = new OpencodeClient({ baseURL: `http://127.0.0.1:${port}` });

// 새 세션 (매 턴 처음 또는 sessionId=null)
const { id } = await client.session.create({ cwd });

// 메시지 전송 + 스트림
for await (const ev of client.session.send({ id, text, stream: true })) {
  yield normalize(ev);  // ChatEvent로 정규화
}
```

**SSE→ChatEvent 매핑**:

| opencode 이벤트 | ChatEvent 타입 |
|---|---|
| `session.init` | `init` |
| `assistant.delta` | `assistant_delta` |
| `assistant.finish_message` | `assistant_message` |
| `tool_use` | `tool_use` |
| `tool_result` | `tool_result` |
| `finish_reason` | `result` |
| (HTTP/SSE 에러) | `error` |

**설치 탐지**:

| OS | 명령 |
|---|---|
| POSIX (macOS/Linux) | `which opencode` |
| Windows | `where opencode` |

**자동 설치**:

| OS | 명령 |
|---|---|
| POSIX | `curl -fsSL https://opencode.ai/install \| bash` |
| Windows | PowerShell 스크립트 (URL 확인 필요) |

### 7.3 AdapterRegistry & Backend 선택

**선택 알고리즘** (앱 부트 시):

1. 두 어댑터 `isInstalled()` **병렬 호출**
2. 결과:
   - **둘 다 설치**: Renderer에 선택지 제시 또는 OQ7 정책 (마지막 사용 / 기본값)
   - **한쪽만 설치**: 자동 선택
   - **둘 다 미설치**: 인스톨러 다이얼로그 트리거
3. 선택 후 `AdapterRegistry.active` 에 저장

**세션 중 전환**: v1 에서는 **불가능** (구조상 지원하지만 UI는 제공 안 함). Phase 2+ 검토.

---

## 8. CLI Installer (기능 사양)

사용자에게 보이는 인스톨러 다이얼로그와 프로세스.

> **(2026-05-18 갱신)** 본 인스톨러는 **opencode 전용** 으로 축소됨. Claude Code 는 SDK `@anthropic-ai/claude-agent-sdk` 의 `optionalDependencies` 가 platform binary 를 자동 처리하므로 인스톨러 대상 아님. Phase 3 단일 백엔드 (claude-code) 운영에서는 인스톨러 다이얼로그 자체가 트리거되지 않는다. opencode 어댑터 활성화 시점 (§10 anchor) 에 본 절이 다시 의미를 가진다.

### 8.1 다이얼로그 단계

| 단계 | 내용 | UI 요소 |
|---|---|---|
| 1. 진단 | "opencode 확인 중..." | 스피너 + 로그 |
| 2. 선택 | "opencode 를 설치할까요?" | curl / 수동 라디오 버튼 + [시작] |
| 3. 진행 | 설치 진행률 + 라인 단위 로그 | 프로그레스바 + 터미널 텍스트 |
| 4. 성공 | "설치 완료! [새 대화]" | 확인 버튼 |
| 4. 실패 | "설치 실패. [수동 명령 복사] [진단 다시]" | 수동 명령 텍스트박스 + 버튼 |

### 8.2 사전 의존성 점검

| 조건 | 검사 | 메시지 |
|---|---|---|
| curl 선택 시 | curl 존재 | `which curl` |
| Windows | PowerShell 사용 가능 여부 | (opencode 설치 스크립트 URL 확정 필요) |

### 8.3 설치 후 검증

- `isInstalled()` 재호출 → 설치 확인
- 실패 시 PATH 갱신 안내 (특히 npm): "새 터미널을 열거나 `source ~/.bashrc` 실행"

---

## 9. Build & Distribution

### 9.1 npm Scripts (electron-vite)

| 스크립트 | 목적 | 상세 |
|---|---|---|
| `npm run dev` | 개발 서버 (HMR) | Renderer Vite HMR + Main/Preload watch + electron 실행 |
| `npm run build` | 프로덕션 빌드 | 3-config 병렬 번들 + 타입체크 |
| `npm run start` | 빌드 결과 미리보기 | electron-vite preview 모드 |
| `npm run build:win` | Windows .exe 패키징 | electron-builder NSIS |
| `npm run build:mac` | macOS .dmg 패키징 | electron-builder DMG + 서명 |
| `npm run build:linux` | Linux AppImage 패키징 | electron-builder AppImage |
| `npm run typecheck` | TypeScript 검증 | `tsconfig.node.json` + `tsconfig.web.json` 분리 검증 |
| `npm run lint` | ESLint | `eslint.config.mjs` |
| `npm run format` | Prettier | `.prettierrc.yaml` |

### 9.2 패키져: electron-builder

- 설정 파일: `electron-builder.yml` (template 기본)
- Windows: **x64 NSIS installer** (1차 타깃)
- macOS: DMG (arm64 + x64), notarization (OQ3)
- Linux: AppImage + deb/rpm
- **Code signing / 자동 업데이트 = OQ3** 미정 사항 (§10 anchor)

### 9.3 환경변수

| 변수 | 값 (dev/build) | 용도 |
|---|---|---|
| `NODE_ENV` | `"development"` / `"production"` | 빌드 최적화 |
| DevTools | dev 빌드에서만 F12로 열기 | 보안 (production 제한) |

---

## 10. Future Work / Out-of-Scope

Phase 1 MVP 범위 밖. **anchor 수준만 언급** (자세한 설계는 향후).

- **(anchor) 시스템 트레이** — UI/Main 진입점 미지정. Phase 2+ 검토.
- **(anchor) electron-updater + GitHub Releases** — OQ3 패키징·배포 전략에서 함께 결정.
- **(anchor) Auto-update 채널** — OQ3.
- **(anchor) 하드웨어 어댑터 (BoardAdapter)** — USB/카메라 제어. `src/main/adapters/board.ts` 예약, 네이티브 모듈 (`orca-board.node`, libusb) Phase 2~3.
- **(anchor) opencode 어댑터** — Phase 1 에서는 미구현. §7.2 의 사양 (서버 라이프사이클, SDK 호출, SSE 매핑) 그대로 살아있으나 코드는 인터페이스 후크만 남아있다. claude-code 단독 운영이 안정화되면 도입. **단, MCP 설정 변환기 `toOpencodeConfig` 는 MCP&Skill 통합 레이어에서 *순수 함수 + 단위 테스트만* 선구현됨** (어댑터·라이프사이클·백엔드 선택은 여전히 미구현, `Backend`=`'claude-code'` 유지). `toClaudeConfig` 와 **동형 대칭 변환기**(동일 시그니처, `Record<string, <Backend>Mcp>` 반환).
- **(anchor) OpenAI Compatible 백엔드** — `SessionAdapter` 인터페이스 재활용 가능. 3번째 어댑터 구현체 추가.
- **(anchor) Agent SDK 고급 기능** — `permissionMode` / `canUseTool` / `hooks` / `createSdkMcpServer` (in-process custom tools) / 외부 `mcpServers` / `forkSession` / `startup()` (사전 워밍) / `AsyncIterable<SDKUserMessage>` 스트리밍 입력. 채택 표는 [arch/backend/adapters.md](arch/backend/adapters.md) §1.7 의 ⏳ 행 참조. Phase 4+ — 도구 권한 정책(OQ9) 결정 후 진행.
- **(anchor) 어댑터 도구명 정규화 (OQ10)** — claude vs opencode 의 `tool_use.name` / `tool_use.input` 차이 해소 정책. PRD §11 OQ10 결정 후 어댑터별 매핑 표 확정.
- **(anchor) ChatEvent sessionId 확장** — Phase 4 멀티 세션 진입 시 모든 변형(`assistant_delta` / `assistant_message` / `tool_use` / `tool_result` / `result` / `error`)에 `sessionId` 필드 추가. main↔renderer IPC 는 Electron 의 ordered+lossless 보장을 그대로 활용 (별도 메시지큐 미도입). 상세 anchor 는 [arch/frontend/state.md](arch/frontend/state.md) §2.
- **(구현됨) MCP & Skill 통합 레이어** — 정규 소스 = `~/.config/orca/mcp.json`(순정 Claude `mcpServers` 스키마 + `${VAR}`, 평문 비밀 0). 비밀은 secret-store(safeStorage, env-var 이름 키잉), enabled/description 은 settings. `${VAR}` resolver = safeStorage→process.env(미해결 시 서버 드롭). **양 백엔드 대칭 변환기**(`toClaudeConfig`/`toOpencodeConfig`, 순수). **확장 정규 레이어**: `~/.config/orca` 디렉토리 자체를 Claude 로컬 플러그인으로 머티리얼라이즈(`.claude-plugin/plugin.json` + 정규 소스 `skills/`·`agents/`·`commands/`) → query() 에 `plugins:[{local, path: ~/.config/orca}]`+`skills:'all'`. Skill 은 양 백엔드 공통(opencode `.claude/skills` 네이티브), Hook/full-plugin 은 백엔드 종속이라 정규화 제외. 레거시 `orca-mcp` 1회 마이그레이션. 상세 [arch/backend/security.md](arch/backend/security.md) §1.4.
- **(anchor) Captures / Projects 확장** — PRD §9 Future Scope. 별도 IPC 도메인 + 모듈 추가.
- **(anchor) 멀티 세션 / 과거 대화 목록** — Phase 3+. 인터페이스 `SessionAdapter.listSessions?()` / `loadSession?()` 이미 예약. Sidebar 세션 리스트 UI는 Phase 4.
- **(anchor) 재시작 재개** — Phase 2. Settings.store 의 `lastSessionId` 키 추가, 앱 부트 시 복원.
- **(anchor) Zustand 전환 (Phase 4 진입 PR 묶음)** — 단일 root + `sessions: Record<sessionId, SessionState>` 슬라이스. 외부 dispatch (`getState().recv(ev)`) — React 트리 외부에서 호출 가능. **Phase 3 사전 마이그레이션 금지**. 상세 [arch/frontend/state.md](arch/frontend/state.md) §1.4.
- **(anchor) 로컬 DB (Phase 3+)** — 메시지·세션 메타데이터 SSOT. 마이그레이션 `src/main/db/migrations/NNN_<name>.sql` (병합 후 절대 수정 금지). 라이브러리 미정 (better-sqlite3 / Drizzle 후보). 상세 [arch/backend/persistence.md](arch/backend/persistence.md).
- **(anchor) Artifact FS 저장 (Phase 3+)** — `<userData>/artifacts/<sessionId>/<uuid>.<ext>`. DB 에는 경로·해시·크기만. 클라우드 동기화 없음 (export/import 만). `GLOSSARY.md` "Artifact" / [arch/backend/persistence.md](arch/backend/persistence.md).
- **(anchor) safeStorage 자격증명 (Phase 3+)** — 어댑터별 base URL + API key 를 Electron `safeStorage` (OS keychain) 로 암호화 저장. [arch/backend/security.md](arch/backend/security.md) §1.4.
- **(anchor) 추가 IPC 도메인 (Phase 3+/Future)** — `message:*` / `session:list/load/delete` / `credentials:set/hasKey` / `skills:reload`. `IPC_CONTRACT.md` §2.8 예약 표 참조.
- **PRD §11 OQ1~OQ8** — 미정 항목. 여기서 결정하지 않음. 결정값 도착 시 본 문서 갱신.

---

## 11. Testing Strategy

### 단위 테스트 (Vitest)

- **어댑터**: ChatEvent 정규화 (SDKMessage→ChatEvent, SSE→ChatEvent), 에러 감지 (auth.expired 패턴, SDK throw 처리)
- **Reducer**: 모든 액션 (SEND_USER_MESSAGE, RECV_EVENT, NEW_CHAT, CANCEL_CHAT) → 상태 전이 정확성
- **IPC 검증**: zod 스키마 (SendChatMessage, ChatEvent, InstallStatus 등)
- **Installer**: 의존성 점검 (curl), opencode 설치 명령 조합
- **(구현됨) MCP 변환 파이프라인**: `expandEnv`(${VAR} 정의/미정의 드롭·다중 변수·빈 소스) + `toClaudeConfig`(구조 항등·sse 보존)/`toOpencodeConfig`(stdio→local·http/sse→remote)·dropped 전파·빈 소스 — `src/main/mcp/{expand,convert}.test.ts`, 14 케이스. electron 비의존 순수 함수. `npm test` = `vitest run`. store/secret-store 등 electron 결합 모듈은 런타임 수동 검증([arch/backend/security.md](arch/backend/security.md) §1.4 불변식).

### 통합 테스트

- Mock SDK (`query()` AsyncIterable 시뮬레이션 — SDKSystemMessage / SDKPartialAssistantMessage / SDKResultMessage 순서 재현)
- Mock opencode 서버 (SSE 스트림 시뮬레이션)
- IpcRouter ↔ Adapter 흐름 (메시지 → 어댑터 → 정규화 → IPC 송신 검증)

### E2E 테스트 (Playwright on Electron)

- 신규 대화 생성 → 메시지 입력 → 스트리밍 표시 → 완료
- 대화 1개 축적 후 새 대화 → sessionId 리셋 확인
- 설치 실패 시 수동 명령 표시 (mock CLI 설치 미지원)

### 매뉴얼 체크리스트 (QA)

- Claude Code / opencode 각각 테스트 (둘 다 설치된 환경)
- 백엔드 선택 → 메시지 전송 → 응답 스트리밍 → 종료
- Tweaks 테마 변경 → 전 화면 반영 검증
- 키보드 단축키 (Ctrl+N, Enter (전송) / Shift+Enter (줄바꿈) — N3 2026-05-13 결정)
- 에러 복구 (재시도, "claude /login" 안내 등)

---

## 12. References

- `docs/PRD.md` — 제품 정의 (WHAT)
- `docs/etc/llm-chat-desktop-strategy.md` — 기술 결정 근거
- `docs/ARCHITECTURE.md` — Renderer 구조·상태 관리·도메인 화면 카탈로그
- `docs/ARCHITECTURE.md` — Main 구조·Adapter·영속성·자격증명·보안
- `docs/IPC_CONTRACT.md` — Main ↔ Renderer 채널 SSOT
- `docs/GLOSSARY.md` — 용어 단일 출처
- `docs/claude-code-spec.md` — Claude Code CLI 공식 스펙 미러 (§7.1 외부 계약의 단일 출처)
- `app/AGENTS.md` — 코드 작업 가이드
- `project/electron/` — 시각 기준 프로토타입
