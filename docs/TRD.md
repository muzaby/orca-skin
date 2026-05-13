# Orca — Technical Requirements Document (v1)

> `docs/PRD.md` 의 *WHAT* 을 *HOW* 로 옮기는 기술 사양. 기능·스택·API·데이터 모델을 다룬다. 시스템 구성·프로세스 모델·모듈 레이아웃·데이터 흐름 등 아키텍처 구조는 `docs/architecture.md` 참조.

| 항목 | 값 |
|---|---|
| 문서 버전 | v1 (MVP 구현 사양) |
| 입력 | `docs/PRD.md` (MVP §6, §7, §11), `docs/llm-chat-desktop-strategy.md` |
| 출력 대상 | 코드 작성 에이전트 / 구현자 |
| 범위 | Phase 1 MVP 본문. Phase 2~4 / Future Scope = §10 anchor only |
| 미정 항목 처리 | PRD §11 Open Questions 는 **여기서 결정하지 않는다.** "결정 후 결정값으로 대체" 표시만 둔다. |

---

## 1. 문서의 목적과 범위

본 문서는 Orca v1 MVP (Phase 1) 가 **무엇을 기능으로 제공하고, 어떤 기술 스택으로 만드는가** 를 검증 가능한 형태로 정의한다.

본문은 Phase 1 만 다루며, Phase 2~4 확장 구조는 §10 의 anchor 로만 언급한다. 하드웨어·Skills·MCP·Captures·Projects 등 도메인 기능은 `docs/PRD.md` §9 Future Scope 를 참조.

시스템이 **어떻게 구성되어 있고 입력이 어디로 흘러가는가** 는 `docs/architecture.md` 에서 다룬다.

---

## 2. Functional Spec (Phase 1)

PRD §6.1 의 F1~F10 을 *수용 기준* 으로 구체화한다.

| ID | 요구사항 | 구현 책임 모듈 | 수용 기준 | PRD |
|---|---|---|---|---|
| F1 | **Chat 입력/스트리밍** | Composer, MessageList, useEngineStream | 전송 즉시 첫 `assistant_delta` 가 N ms 내 도착 (SLA는 OQ6), 토큰 단위 누적 표시, 마지막 `assistant_message` 로 완성본 교체 | §6.1 |
| F2 | **마크다운 렌더링** | Markdown, react-markdown + shiki | 본문 + 코드 블록 syntax highlighting, 타겟 언어: Python·JavaScript·TypeScript·Bash 등 (shiki 제공 범위), 안전성: markdown 구현체의 sanitize 기본 적용 | §6.1 |
| F3 | **도구 호출 표시** | ToolCallCard, MessageList | `tool_use` 이벤트 도착 시 카드 생성 (이름·입력 JSON 표시), 같은 `toolUseId` 의 `tool_result` 도착 시 카드에 결과·소요시간 추가, 상태 전이: pending → running → completed/failed | §6.1 |
| F4 | **단일 활성 대화 컨텍스트** | ChatState (reducer), Adapter | 같은 `sessionId` 를 매 턴 CLI에 전달 (`--resume <id>` / same session HTTP call), Renderer는 `sessionId` 변수 1개만 메모리 보관, CLI가 이전 턴들을 복원 | §6.1 |
| F5 | **새 대화** | ChatShell ("새 대화" 버튼) | `sessionId = null` 리셋 → reducer 메시지 배열·pendingDelta 초기화, 다음 전송 시 `sendMessage(null, ...)` 호출 → 어댑터가 ID 발급 (`init` 이벤트에서 추출) | §6.1 |
| F6 | **백엔드 선택** | AdapterRegistry, BackendSelector UI | 시작 시 병렬 `isInstalled()` → (둘 다/한쪽/없음) 결과. 둘 다 설치: 사용자 선택 또는 OQ7 정책. 한쪽: 자동 선택. 없음: 인스톨러 트리거. v1에서 세션 중 전환 불가 | §6.1 |
| F7 | **CLI 설치 자동화** | Installer (IPC `orca:install:*`) | 둘 다 미설치 → 다이얼로그 (npm / curl 선택) → child_process 실행 → 라인 단위 status 스트림 → 완료/실패 표시 | §6.1 |
| F8 | **설치 실패 폴백** | Installer | 자동 실패 → 수동 명령 전체 텍스트 UI에 표시 + 복사 버튼. Node.js 미설치 (Windows: choco, macOS: brew 안내), npm 글로벌 권한 부족 (sudo / npm config 안내) | §6.1 |
| F9 | **인증 만료 처리** | ClaudeCodeAdapter, Auth modal | Claude Code OAuth 401 감지 (stdout/stderr `"401"` / `"expired"` 패턴) → `error / auth.expired` 이벤트 → UI 모달 "`claude /login` 을 터미널에서 실행 후 새 대화" | §6.1 |
| F10 | **Tweaks 패널** | TweaksPanel, useTweaks | 테마 선택 (Classic/Dark/Cool) + 밀도 슬라이더 (11.5/13/14.5px) + 사이드바 접기 토글 → `data-theme` 속성 + root `font-size` 동적 갱신 → Tailwind `@theme` 토큰 스코프 cascade → 전 화면 반영. 선택값은 Phase 1에서 메모리만 (Phase 2+ `electron-store` 로 영속화). 트리 remount 불요 (CSS 변수 재설정으로 충분). Phase 2+ 에서 ThemeProvider 로 영속화 연동 검토 | §6.1 |

**비고**: 모듈 경로·정확한 IPC 채널·컴포넌트 트리는 `architecture.md` 참조. 위 표는 *기능 정의* 에만 집중.

---

## 3. Non-functional Spec

PRD §6.2 의 N1~N6 을 구현 가능한 형태로 변환한다.

| ID | 요구사항 | 명세 |
|---|---|---|
| N1 | **플랫폼** | Windows x64 1차 지원. macOS (arm64 + x64), Linux (x64) 는 후순위. Electron 다중 빌드 (`electron-builder.yml`) |
| N2 | **i18n** | 한국어 라벨 (`src/shared/i18n/ko.ts`). 기술 용어/터미널 출력은 영어 그대로. |
| N3 | **접근성** | 키보드 단축키: 새 대화 (Ctrl+N), 전송 (Ctrl+Enter), Tweaks 패널 (Shift+T 등, architecture.md 참조). 다크모드는 Tweaks 경유 (CSS 변수 override). ARIA label은 주요 UI 요소에. |
| N4 | **데이터 위치** | 세션 본체: CLI 저장소 (Claude Code: `~/.claude/projects/<cwd>/<id>.jsonl`, opencode: `~/.local/share/opencode/` 등). 앱: 메모리에 `sessionId` 변수 1개만 보유. Phase 2+ `electron-store` (선택값·마지막 세션 ID 등) |
| N5 | **응답 지연 가이드** | 첫 토큰까지 지연, 시작 시간 SLA = OQ6. 목표치가 정해지면 본 섹션 갱신. |
| N6 | **보안** | OAuth/API 키 미저장 (CLI 관리). 마크다운 렌더링 시 XSS sanitize (react-markdown 기본). Electron contextIsolation=true, sandbox=true 적용 (상세는 architecture.md §2). |

---

## 4. Tech Stack (확정 vs 미정)

electron-vite 환경 기준. 표 밖 의존성 추가 시 **사용자 승인 필수**.

| 계층 | 채택 | 버전·옵션 | 확정 여부 | 비고 |
|---|---|---|---|---|
| 데스크톱 셸 | Electron | ^39 (스캐폴드 기준) | 미정 OQ3 | 패키징/서명/auto-update |
| 빌드 아키텍처 | electron-vite | ^5 | 확정 | main/preload/renderer 3 sub-config |
| 번들러 | Vite | ^7 | 확정 | electron-vite가 sub-config 통합 |
| 언어 | TypeScript | strict, `target: ES2022` | 확정 | 타입 안정성 |
| UI 프레임워크 | React | ^19 (템플릿 기본, OQ1은 18 가능성) | OQ1 | React Hooks + Context/reducer |
| 상태 관리 | React Context + reducer | — | 확정 | 외부 상태 라이브러리 (Redux 등) 금지 MVP 범위 |
| 스타일링 | Tailwind CSS | **^4** (`@tailwindcss/vite` 플러그인, CSS-first `@theme`) | 확정 (Phase 1 완료) | utility-first. `styles/tokens.css` 의 `@theme` 블록으로 시맨틱 디자인 토큰 정의 (`--color-{bg,sidebar,ink,...}`). `[data-theme]` 스코프로 Classic/Dark/Cool 전환. Tweaks 패널과 연동. 자세한 정책은 `app/CLAUDE.md` "스타일링 정책" 참조 |
| 마크다운 렌더링 | react-markdown + shiki | OQ2에서 확정 | OQ2 | 코드 블록 syntax highlighting |
| HTTP (opencode) | `@opencode-ai/sdk` | latest | 확정 | 공식 SDK 사용 |
| IPC | Electron 기본 ipcRenderer/ipcMain | — | 확정 | 별도 RPC 라이브러리 금지 |
| IPC 보안 | `@electron-toolkit/preload` + contextBridge | ^3 | 확정 | preload 화이트리스트 |
| 입력 검증 | zod | latest | 확정 | IPC 메시지 + CLI 응답 파싱 |
| 영속화 (Phase 2+) | `electron-store` | — | 보류 | Phase 1은 in-memory. Phase 2에 도입 |
| 패키징 | electron-builder | ^26 | 미정 OQ3 | signing/notarization/auto-update |
| 테스트 (단위) | Vitest | latest | 확정 | 어댑터·reducer·IPC zod·installer |
| 테스트 (E2E) | Playwright | latest | 확정 | Electron 지원 |

**정책**: 위 표 외의 패키지 (예: date-fns, lodash, zustand, redux 등) 도입 시 먼저 사용자 확인.

---

## 5. IPC API Specification

### 5.1 채널 명명 규칙

모든 IPC 채널은 `orca:<domain>:<action>` 형식.
- `domain`: 기능 영역 (chat, backend, install, settings)
- `action`: 동작 (send, event, cancel, list, select, start, status, get, set)

### 5.2 채널 카탈로그 (확정 8개)

| 채널 | 방향 | 요청 페이로드 (TS) | 응답·스트림 | zod 스키마 |
|---|---|---|---|---|
| `orca:chat:send` | R→M (invoke) | `{ sessionId: string \| null; text: string; }` | ChatEvent stream (M→R send) | SendChatMessage |
| `orca:chat:event` | M→R (send) | — | `ChatEvent` (반복) | ChatEvent union |
| `orca:chat:cancel` | R→M (invoke) | `{ sessionId: string; }` | `{ ok: true }` | CancelChat |
| `orca:backend:list` | R→M (invoke) | — | `{ backends: Backend[]; active?: Backend; }` | BackendList |
| `orca:backend:select` | R→M (invoke) | `{ backend: Backend; }` | `{ ok: true }` | SelectBackend |
| `orca:install:start` | R→M (invoke) | `{ backend: Backend; }` | InstallStatus stream (M→R send) | StartInstall |
| `orca:install:status` | M→R (send) | — | `{ step: string; progress?: number; error?: string; }` | InstallStatus |
| `orca:settings:get` | R→M (invoke) | `{ key: string; }` | `{ value: unknown; }` | GetSettings |
| `orca:settings:set` | R→M (invoke) | `{ key: string; value: unknown; }` | `{ ok: true }` | SetSettings |

### 5.3 `window.orca` API (Preload 화이트리스트)

```typescript
// src/preload/index.ts 에서 노출
interface OrcaApi {
  chat: {
    send(req: { sessionId: string | null; text: string }): Promise<void>;
    onEvent(handler: (ev: ChatEvent) => void): () => void;  // unsubscribe 함수 반환
    cancel(sessionId: string): Promise<void>;
  };
  backend: {
    list(): Promise<{ backends: Backend[]; active?: Backend }>;
    select(backend: Backend): Promise<void>;
  };
  install: {
    start(backend: Backend): Promise<void>;
    onStatus(handler: (st: InstallStatus) => void): () => void;
  };
  settings: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
}

declare global {
  interface Window {
    orca: OrcaApi;
  }
}
```

Renderer 코드는 `window.orca.*` 만으로 통신 (ipcRenderer 직접 접근 금지).

### 5.4 스트림 종료 신호

- `orca:chat:event` 스트림: `ChatEvent { type: 'result' | 'error' }` 도착 시 **턴 종료** → Renderer가 `inflight` 플래그 해제.
- `orca:install:status` 스트림: `{ step: 'complete' | 'failed' }` 도착 시 설치 프로세스 종료.

---

## 6. Data Models

모든 타입 정의의 단일 출처. 구현은 `src/shared/protocol.ts` + `src/main/adapters/types.ts`.

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

### 6.3 SessionAdapter (공통 인터페이스)

```typescript
interface SessionAdapter {
  isInstalled(): Promise<boolean>;
  install(): Promise<void>;  // 성공/실패는 예외로 표시
  sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
  ): AsyncIterable<ChatEvent>;

  // Phase 3+ (옵셔널, v1에서는 구현 안 함)
  listSessions?(): Promise<SessionInfo[]>;
  loadSession?(id: string): Promise<ChatEvent[]>;
}
```

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

| 코드 | 의미 | 복구 가능 | 사용자 표시 |
|---|---|---|---|
| `cli.not-installed` | 백엔드 CLI 미발견 (which/where 실패) | yes | 인스톨러 다이얼로그 트리거 |
| `cli.spawn-failed` | spawn 실패 / EACCES / 경로 문제 | yes | 수동 명령 안내 + 복사 버튼 |
| `cli.crashed` | 프로세스 비정상 종료 (exit code ≠ 0) | yes | 재시도 버튼 |
| `cli.timeout` | CLI 무응답 (타임아웃 값은 OQ6) | yes | 재시도 |
| `auth.expired` | Claude Code OAuth 401 | yes | "`claude /login` 실행 후 새 대화" 모달 |
| `protocol.parse` | NDJSON/SSE 파싱 실패 | no | 디버그 로그 + "일반 오류" 표시 |
| `internal` | 어댑터/Main 내부 버그 | no | 디버그 로그 + "문제가 발생했습니다" |

### 6.7 Settings 키 카탈로그

Phase 1은 메모리만, Phase 2+에서 `electron-store` 로 영속화. 인터페이스 동일 유지.

| 키 | 타입 | 설명 |
|---|---|---|
| `theme` | `'Classic' \| 'Dark' \| 'Cool'` | 테마 선택 |
| `density` | `11.5 \| 13 \| 14.5` | 폰트 밀도 (px) |
| `sidebarCollapsed` | `boolean` | 사이드바 접음 상태 |
| `lastBackend` | `Backend \| null` | 마지막 사용 백엔드 (OQ7) |
| `lastSessionId` | `string \| null` | Phase 2+ 재개용 마지막 세션 ID |

---

## 7. Backend Adapters (외부 인터페이스 계약)

어댑터가 외부 CLI/SDK와 주고받는 명령·플래그·SDK 호출의 계약. *내부 구현* (NDJSON 파서, 서버 라이프사이클 대기열 등) 은 `architecture.md` §5 참조.

### 7.1 ClaudeCodeAdapter

> CLI 플래그 의미·NDJSON 이벤트 스키마(`system/init`, `stream_event`, `system/api_retry`, `system/plugin_install`)·세션 재개 메커니즘 상세는 [`claude-code-spec.md`](./claude-code-spec.md) §3·§4·§7 참조 (단일 출처). 본 절은 *어댑터가 외부와 어떻게 계약하는지* 만 다룬다. 권한 정책 미정(OQ9) 도 spec §5 참조.

**설치 탐지**:

| 항목 | 명령 | 성공 기준 |
|---|---|---|
| 설치 여부 | `which claude` (POSIX) / `where claude` (Windows) | exit code 0 |
| 버전 확인 | `claude --version` | 출력에 버전 번호 |

**자동 설치**:
```
npm install -g @anthropic-ai/claude-code
```

**메시지 전송** (매 턴):
```
claude -p "<text>" --output-format stream-json [--resume <sessionId>]
```
- `-p <text>`: 사용자 입력
- `--output-format stream-json`: NDJSON 형식 (필수)
- `--resume <sessionId>`: 2턴 이상에서 조건부 추가 (sessionId != null)
- `cwd`: spawn 의 `{ cwd }` 옵션에 전달

**첫 응답에서 sessionId 추출**:
- Claude Code stdout의 첫 이벤트 (`system` 또는 `init` 타입)에서 `session_id` 필드 추출
- 이를 `ChatEvent { type: 'init', data: { sessionId: ... } }` 로 정규화
- Renderer가 받아서 `sessionId` 변수에 저장

**인증 만료 감지**:
- stdout/stderr에서 `401` / `"OAuth"` / `"expired"` 패턴 → `error / auth.expired`
- UI: `claude /login` 명령 카피 버튼 + 새 대화 권유

**환경변수**:

| 변수 | 값 | 용도 |
|---|---|---|
| `PATH` | 사용자 셸 PATH 상속 | npm 글로벌 bin 경로 포함 필수 |
| `HOME` | 사용자 홈 디렉토리 | Claude Code가 `~/.claude/projects/<cwd>/` 에 jsonl 저장 |
| `CLAUDE_*` | (OQ에서 확정) | 필요 시만 |

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

### 8.1 다이얼로그 단계

| 단계 | 내용 | UI 요소 |
|---|---|---|
| 1. 진단 | "claudecode / opencode 확인 중..." | 스피너 + 로그 |
| 2. 선택 | "어떤 CLI를 설치할까요?" | npm / curl 라디오 버튼 + [시작] |
| 3. 진행 | 설치 진행률 + 라인 단위 로그 | 프로그레스바 + 터미널 텍스트 |
| 4. 성공 | "설치 완료! [새 대화]" | 확인 버튼 |
| 4. 실패 | "설치 실패. [수동 명령 복사] [진단 다시]" | 수동 명령 텍스트박스 + 버튼 |

### 8.2 사전 의존성 점검

| 조건 | 검사 | 메시지 |
|---|---|---|
| npm 선택 시 | Node.js / npm 존재 | `node -v`, `npm -v` |
| npm 권한 | 글로벌 설치 가능 | npm prefix 테스트 |
| curl 선택 시 | curl 존재 | `which curl` |

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
- **(anchor) OpenAI Compatible 백엔드** — `SessionAdapter` 인터페이스 재활용 가능. 3번째 어댑터 구현체 추가.
- **(anchor) Skills / MCP / Captures / Projects** — PRD §9 Future Scope. 별도 IPC 도메인 + 모듈 추가.
- **(anchor) 멀티 세션 / 과거 대화 목록** — Phase 3+. 인터페이스 `SessionAdapter.listSessions?()` / `loadSession?()` 이미 예약. Sidebar 세션 리스트 UI는 Phase 4.
- **(anchor) 재시작 재개** — Phase 2. Settings.store 의 `lastSessionId` 키 추가, 앱 부트 시 복원.
- **PRD §11 OQ1~OQ8** — 미정 항목. 여기서 결정하지 않음. 결정값 도착 시 본 문서 갱신.

---

## 11. Testing Strategy

### 단위 테스트 (Vitest)

- **어댑터**: ChatEvent 정규화 (NDJSON→ChatEvent, SSE→ChatEvent), 에러 감지 (auth.expired 패턴, spawn 실패 코드)
- **Reducer**: 모든 액션 (SEND_USER_MESSAGE, RECV_EVENT, NEW_CHAT, CANCEL_CHAT) → 상태 전이 정확성
- **IPC 검증**: zod 스키마 (SendChatMessage, ChatEvent, InstallStatus 등)
- **Installer**: 의존성 점검 (Node.js/npm/curl), 명령 조합

### 통합 테스트

- Mock CLI (stdout NDJSON 시뮬레이션)
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
- 키보드 단축키 (Ctrl+N, Ctrl+Enter)
- 에러 복구 (재시도, "claude /login" 안내 등)

---

## 12. References

- `docs/PRD.md` — 제품 정의 (WHAT)
- `docs/llm-chat-desktop-strategy.md` — 기술 결정 근거
- `docs/architecture.md` — 시스템 구성·프로세스·데이터 흐름
- `docs/claude-code-spec.md` — Claude Code CLI 공식 스펙 미러 (§7.1 외부 계약의 단일 출처)
- `app/CLAUDE.md` — 코드 작업 가이드
- `project/electron/` — 시각 기준 프로토타입
