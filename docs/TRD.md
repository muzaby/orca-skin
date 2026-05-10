# Orca — Technical Requirements Document (v1)

> `docs/PRD.md` (Orca v1) 의 *WHAT* 을 *HOW* 로 옮기는 기술 사양. MVP(Phase 1) 를 본문으로 하고, Phase 2~4 는 구조적 anchor 만 명시한다. Future Scope (PRD §9) 는 본 TRD 의 대상이 아니다.

| 항목 | 값 |
|---|---|
| 문서 버전 | v1 (MVP 구현 사양) |
| 입력 | `docs/PRD.md` (MVP §6, Architecture §7, Roadmap §8, Open Questions §11) |
| 출력 대상 | 코드 작성 에이전트 / 구현자 |
| 미정 항목 처리 | PRD §11 Open Questions 는 **여기서 결정하지 않는다.** "결정 후 결정값으로 대체" 표시만 둔다. |

---

## 1. Architecture Overview

### 1.1 프로세스 구성

```
┌────────────────────── Electron App ──────────────────────┐
│                                                           │
│  ┌─── Renderer Process (BrowserWindow) ───────────────┐   │
│  │  React UI (Chat, Composer, Tweaks, Settings)       │   │
│  │  ↑ ↓ webContents → ipcRenderer.send / on            │   │
│  └─────────────────────────────────────────────────────┘   │
│                       ↕ Electron IPC                       │
│  ┌─── Main Process (Node.js) ──────────────────────────┐   │
│  │  IpcRouter ──→ AdapterRegistry                      │   │
│  │                  ├─ ClaudeCodeAdapter               │   │
│  │                  └─ OpencodeAdapter                 │   │
│  │  Installer  (CLI 탐지/설치 자동화)                    │   │
│  │  Settings   (electron-store, Phase 2+)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                       ↕ child_process / HTTP               │
└──────────────────────────────────────────────────────────┘
                            ↕
          Host CLI: `claude` / `opencode` (사용자 PC)
```

### 1.2 모듈 레이아웃 (TypeScript 소스)

| 경로 | 책임 |
|---|---|
| `src/main/index.ts` | Electron `app` 부트, BrowserWindow 생성, IpcRouter 부착 |
| `src/main/ipc/router.ts` | Renderer ↔ Main 채널 라우팅, 입력 검증 |
| `src/main/adapters/types.ts` | `SessionAdapter`, `ChatEvent`, `Backend` 등 공통 타입 (PRD §7.3) |
| `src/main/adapters/claude-code.ts` | Claude Code spawn / NDJSON 파싱 / `--resume` |
| `src/main/adapters/opencode.ts` | opencode serve 라이프사이클 / SDK / SSE |
| `src/main/adapters/registry.ts` | 설치 상태 스캔 + 활성 백엔드 선택 |
| `src/main/installer/index.ts` | CLI 설치 자동화 + 폴백 |
| `src/main/settings/store.ts` | electron-store (Phase 2+) — Phase 1 은 in-memory |
| `src/renderer/index.tsx` | React 엔트리 |
| `src/renderer/app/ChatShell.tsx` | 채팅 셸 (사이드바, 메시지 영역, 컴포저) |
| `src/renderer/app/Composer.tsx` | 메시지 입력 |
| `src/renderer/app/MessageList.tsx` | 메시지·도구호출 카드 렌더링 |
| `src/renderer/app/Markdown.tsx` | react-markdown + shiki 래퍼 |
| `src/renderer/app/TweaksPanel.tsx` | 테마/밀도/사이드바 토글 |
| `src/renderer/app/state.ts` | sessionId / messages / settings 상태 (Context + reducer) |
| `src/renderer/preload.ts` | contextBridge 로 IPC API 노출 |
| `src/shared/protocol.ts` | Renderer ↔ Main 메시지 스키마 |
| `src/shared/i18n/ko.ts` | 한국어 라벨 |

### 1.3 보안 베이스라인

| 설정 | 값 | 근거 |
|---|---|---|
| `contextIsolation` | `true` | Electron 보안 권고 |
| `nodeIntegration` | `false` | Renderer 가 Node 직접 접근 불가 |
| `sandbox` | `true` | Renderer 샌드박스화 |
| `webSecurity` | `true` | 기본값 유지 |
| Preload | `contextBridge.exposeInMainWorld('orca', {...})` 로만 노출 | 화이트리스트된 IPC API 만 |
| 외부 콘텐츠 로드 | 금지 (오프라인 가정) | 마크다운 렌더링은 sanitize |
| 비밀 저장 | 앱은 저장하지 않음 | OAuth/API 키는 CLI 가 관리 (PRD N6) |

---

## 2. Tech Stack (확정 vs 미정)

PRD §7.1 의 Stack 표를 구현 단위로 확정한다. 미정은 PRD §11 OQ 와 동기.

| 계층 | 기술 | 버전 / 옵션 | 비고 |
|---|---|---|---|
| 데스크톱 셸 | Electron | (확정 후 결정값으로 대체) | OQ3 패키징 |
| 빌드/스캐폴딩 | `create-electron-app` | webpack-typescript 템플릿 | 전략 §2.1 |
| 언어 | TypeScript | strict, `target: ES2022` | 타입 안정성 |
| UI | React | OQ1 (확정 후 18 또는 19) | PRD §7.1 권장 |
| 상태 관리 | React Context + reducer | 외부 상태 라이브러리 도입 금지 | MVP 범위 |
| **스타일링** | **Tailwind CSS** | **^3.4.0** | **Utility-first CSS. 디자인 토큰(색상/타이포)은 tailwind.config.js 커스터마이징. 마크다운 + UI 컴포넌트 모두 적용.** |
| 마크다운 | react-markdown + shiki | OQ2 | PRD §7.1 권장 |
| HTTP (opencode) | `@opencode-ai/sdk` | latest stable | 전략 §5.1 |
| IPC | Electron 기본 ipc | — | 별도 RPC 라이브러리 안 씀 |
| 영속화 (Phase 2+) | `electron-store` | — | 전략 §11 |
| 패키징 | Electron Forge | OQ3 | webpack-typescript 템플릿 기본 |
| 테스트 | Vitest (단위) + Playwright (E2E) | latest stable | §10 참고 |

> **새 의존성 추가 금지** (사용자 승인 없이). 위 표에 없는 패키지를 도입하려면 사용자에게 확인.

---

## 3. Adapter Layer

### 3.1 공통 인터페이스 (PRD §7.3 그대로)

```typescript
// src/main/adapters/types.ts
export type Backend = 'claude-code' | 'opencode';

export interface ChatEvent {
  type: 'init' | 'assistant_delta' | 'assistant_message'
      | 'tool_use' | 'tool_result' | 'result' | 'error';
  sessionId: string;
  data: unknown;   // 타입은 type 별로 협의 (3.2)
}

export interface SessionAdapter {
  isInstalled(): Promise<boolean>;
  install(): Promise<void>;
  sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
  ): AsyncIterable<ChatEvent>;
  listSessions?(): Promise<SessionInfo[]>;     // Phase 3+
  loadSession?(id: string): Promise<ChatEvent[]>;
}

export interface SessionInfo {
  id: string;
  createdAt: string;   // ISO8601
  title?: string;      // CLI 가 제공하는 경우만
  cwd: string;
  backend: Backend;
}
```

### 3.2 ChatEvent 의 `data` 페이로드 스펙

| `type` | `data` 형태 | 발화자 |
|---|---|---|
| `init` | `{ sessionId, model, cwd }` | 어댑터 (첫 응답에서 1회) |
| `assistant_delta` | `{ text: string }` (부분 토큰) | LLM 스트리밍 |
| `assistant_message` | `{ text: string }` (완성 메시지) | LLM 종료 시 |
| `tool_use` | `{ toolUseId, name, input: object }` | LLM 도구 호출 |
| `tool_result` | `{ toolUseId, output: string \| object, isError: boolean, durationMs?: number }` | CLI 도구 결과 |
| `result` | `{ usage?: { inputTokens, outputTokens } }` | 턴 종료 |
| `error` | `{ code: string, message: string, recoverable: boolean }` | 어떤 단계든 |

> Renderer 는 `assistant_delta` 를 누적해 표시하다가 `assistant_message` 가 오면 최종본으로 교체. `tool_use` 는 카드로 인라인 표시, 같은 `toolUseId` 의 `tool_result` 가 오면 카드 상태를 갱신.

### 3.3 에러 모델

| 코드 | 의미 | 복구 가능? | 사용자 표시 |
|---|---|---|---|
| `cli.not-installed` | 백엔드 CLI 미발견 | yes | 인스톨러 다이얼로그 트리거 |
| `cli.spawn-failed` | spawn / EACCES / PATH 문제 | yes | 수동 명령 안내 |
| `cli.crashed` | 프로세스 비정상 종료 | yes | 재시도 버튼 |
| `cli.timeout` | 일정 시간 무응답 (값은 OQ6) | yes | 재시도 |
| `auth.expired` | Claude Code OAuth 401 | yes | "터미널에서 `claude /login` 실행" 안내 |
| `protocol.parse` | NDJSON / SSE 파싱 실패 | no | 디버그 로그 + 사용자에게 일반 오류 |
| `internal` | 어댑터 내부 버그 | no | 디버그 로그 |

---

## 4. ClaudeCodeAdapter

### 4.1 설치 탐지

| 항목 | 동작 |
|---|---|
| 명령 존재 | `which claude` (POSIX) / `where claude` (Windows). exit 0 = 설치됨 |
| 버전 확인 | `claude --version` (선택, 디버깅용) |
| 자동 설치 | `npm install -g @anthropic-ai/claude-code` (Node + npm 필요) |

### 4.2 메시지 전송 흐름

```
sendMessage(sessionId, text, cwd):
  args = ['-p', text, '--output-format', 'stream-json']
  if (sessionId) args.push('--resume', sessionId)
  child = spawn('claude', args, { cwd, env })

  for await line of readLines(child.stdout):
    event = parseJSON(line)
    yield normalize(event)   // ChatEvent 로 매핑

  on child.exit(code):
    if (code !== 0) yield { type: 'error', code: 'cli.crashed', ... }
```

### 4.3 sessionId 발급

- 첫 응답의 `system` 또는 `init` 타입 이벤트에서 `session_id` 필드를 추출 → `ChatEvent { type:'init' }` 으로 정규화 → Renderer 가 받아 보관.
- 두 번째 턴부터는 호출자가 `sessionId` 를 전달 → `--resume` 플래그가 자동 포함.

### 4.4 stdout 스트리밍 파서

- NDJSON: 라인 단위 분할.
- 부분 라인은 버퍼에 보관, 다음 chunk 와 합쳐서 파싱.
- 파싱 실패한 라인은 `error / protocol.parse` 로 변환 + 디버그 로그.

### 4.5 인증 만료 감지

- stdout/stderr 에서 401 / "OAuth" / "expired" 패턴 매칭 → `error / auth.expired` 이벤트 발행.
- UI 는 토스트 + 모달로 `claude /login` 명령 카피 버튼 제공.

### 4.6 환경변수

| 변수 | 값 | 비고 |
|---|---|---|
| `PATH` | 사용자 셸 PATH 상속 | npm 글로벌 빈 경로 포함 필수 |
| `HOME` | 사용자 홈 | 세션 jsonl 저장 위치 결정 |
| `CLAUDE_*` | (확정 후 결정값으로 대체) | 필요 시만 |

---

## 5. OpencodeAdapter

### 5.1 서버 라이프사이클

| 시점 | 동작 |
|---|---|
| 앱 시작 (opencode 활성 시) | `opencode serve --port 0` 로 자유 포트 할당 spawn |
| 포트 발견 | 첫 stdout 라인에서 `Listening on http://127.0.0.1:<port>` 파싱 |
| 헬스체크 | `GET /health` 200 확인 |
| 앱 종료 | `child.kill('SIGTERM')` → 5s 후 `SIGKILL` |
| 비정상 종료 | 자동 재시작 1회 시도, 이후 사용자에게 에러 표시 |

### 5.2 SDK 호출

```typescript
import { OpencodeClient } from '@opencode-ai/sdk';
const client = new OpencodeClient({ baseURL: `http://127.0.0.1:${port}` });

// 새 세션
const { id } = await client.session.create({ cwd });

// 메시지 전송 + 스트림
for await (const ev of client.session.send({ id, text, stream: true })) {
  yield normalize(ev);
}
```

### 5.3 SSE 정규화

| opencode 이벤트 | ChatEvent 매핑 |
|---|---|
| `session.init` | `init` |
| `assistant.delta` | `assistant_delta` |
| `assistant.complete` | `assistant_message` |
| `tool.start` | `tool_use` |
| `tool.end` | `tool_result` |
| `turn.end` | `result` |
| `error` | `error` |

### 5.4 설치 탐지·자동 설치

| 항목 | 동작 |
|---|---|
| 명령 존재 | `which opencode` / `where opencode` |
| 자동 설치 | `bash -c "curl -fsSL https://opencode.ai/install \| bash"` (Windows 는 PowerShell 분기) |

---

## 6. Adapter Registry & Backend Selection

### 6.1 시작 흐름

```
1. ClaudeCodeAdapter.isInstalled() 와 OpencodeAdapter.isInstalled() 동시 실행
2. 결과 매트릭스:
   - 둘 다 ✓ → 사용자가 설정한 기본 백엔드 (OQ7) 또는 마지막 사용
   - 한 쪽만 ✓ → 그쪽 자동 선택
   - 둘 다 ✗ → InstallerDialog 표시 (§7)
3. 활성 어댑터를 AdapterRegistry.active 에 보관
```

### 6.2 백엔드 전환

- v1 에서는 *세션 중* 백엔드 전환 미지원. 활성 세션이 있으면 토스트로 "전환 시 새 대화" 경고.
- 설정 화면에서 명시적으로 "새 대화로 전환" 버튼만 허용.

---

## 7. CLI Installer

### 7.1 다이얼로그 모델

| 단계 | 화면 |
|---|---|
| 진단 | "Claude Code / opencode 가 설치되지 않았습니다." + 두 옵션 카드 |
| 진행 | 진행 바 + 실시간 stdout/stderr (접기 가능) |
| 성공 | 다이얼로그 닫고 정상 흐름 |
| 실패 | 에러 메시지 + **수동 명령 카피 버튼** + "다시 시도" / "취소" |

### 7.2 의존성 사전 점검

| 케이스 | 처리 |
|---|---|
| Node.js 미설치 (Claude Code) | OS 별 안내 (macOS Homebrew, Windows winget, Linux distro 패키지) |
| npm 글로벌 권한 부족 | 실패 시 sudo 또는 `npm config set prefix ~/.npm-global` 안내 |
| curl 미설치 (opencode, Linux) | 패키지 설치 안내 |

### 7.3 설치 후 검증

- 설치 직후 `isInstalled()` 재호출. 여전히 실패면 PATH 갱신 안내 (셸 재시작 / 새 터미널).

---

## 8. IPC Contract (Renderer ↔ Main)

### 8.1 채널 명명 규칙

`orca:<domain>:<action>` (예: `orca:chat:send`, `orca:install:status`).

### 8.2 채널 표 (MVP)

| 채널 | 방향 | 페이로드 | 응답/스트림 |
|---|---|---|---|
| `orca:chat:send` | R→M | `{ sessionId: string\|null, text: string, cwd: string }` | M→R 스트림 `orca:chat:event` (ChatEvent) |
| `orca:chat:event` | M→R | `ChatEvent` | (one-way, 다회) |
| `orca:chat:cancel` | R→M | `{ sessionId: string }` | 활성 spawn/HTTP 중단 |
| `orca:backend:list` | R→M | `{}` | `{ installed: Backend[], active: Backend\|null }` |
| `orca:backend:select` | R→M | `{ backend: Backend }` | `{ ok: true }` |
| `orca:install:start` | R→M | `{ backend: Backend }` | M→R 스트림 `orca:install:status` |
| `orca:install:status` | M→R | `{ phase, line?, ok?, error? }` | (one-way, 다회) |
| `orca:settings:get` | R→M | `{ key }` | `{ value }` |
| `orca:settings:set` | R→M | `{ key, value }` | `{ ok: true }` |

### 8.3 입력 검증

- Main 측에서 모든 IPC 메시지를 zod (또는 동급) 스키마로 검증. 검증 실패 시 즉시 거부 + 디버그 로그.
- `cwd` 는 절대경로 + 사용자 홈 하위만 허용 (path traversal 방지).

### 8.4 스트림 종료 신호

- `ChatEvent { type: 'result' }` 또는 `{ type: 'error' }` 가 오면 Renderer 는 그 턴이 끝난 것으로 간주.
- 프로세스 강제 종료(앱 종료) 시 Main 이 마지막으로 `error/cli.crashed` 보낸 뒤 채널 닫음.

---

## 9. Renderer (UI) 구현

### 9.1 컴포넌트 트리

```
<App>
  <ThemeProvider>          ← Tweaks 컨텍스트 (CSS 커스텀 프로퍼티 주입)
    <ChatShell>
      <Sidebar />          ← v1: "새 대화" 버튼 + 백엔드 표시만
      <Main>
        <MessageList>
          <MessageBubble role="user" />
          <MessageBubble role="assistant">
            <Markdown />
            <ToolCallCard />   ← tool_use/tool_result 페어
          </MessageBubble>
        </MessageList>
        <Composer />
      </Main>
      <TweaksPanel />      ← 우하단 플로팅
    </ChatShell>
  </ThemeProvider>
</App>
```

### 9.2 상태 모델

```typescript
type ChatState = {
  sessionId: string | null;
  backend: Backend | null;
  messages: Message[];        // 사용자/어시스턴트 메시지 + 도구호출
  pendingDelta: string;        // 현재 스트리밍 중 누적 텍스트
  inflight: boolean;           // 현 턴 진행 중
  error?: ErrorState;
};
```

| 액션 | 효과 |
|---|---|
| `SEND_USER_MESSAGE { text }` | 유저 메시지 추가 + `inflight=true` + IPC `chat:send` |
| `RECV_EVENT { event: ChatEvent }` | 이벤트 타입별 머지 |
| `NEW_CHAT` | `sessionId=null, messages=[], pendingDelta=''` |
| `CANCEL` | IPC `chat:cancel` + UI 상태 정리 |

### 9.3 스트리밍 적용

- `assistant_delta` 도착 → `pendingDelta += text` → React 리렌더 (debounce 16ms 권장).
- `assistant_message` 도착 → `pendingDelta` 를 메시지에 확정 + 클리어.

### 9.4 마크다운 + 코드 하이라이트

- `react-markdown` + `remark-gfm` (테이블/취소선) + `rehype-shiki` 또는 `rehype-highlight` (OQ2 에서 확정).
- 코드 블록 언어 자동 감지 실패 시 plain text 폴백.
- 외부 링크는 `target="_blank" rel="noopener"`. 단 v1 은 외부 클릭 시 OS 기본 브라우저로만 열기.

### 9.5 CSS 및 디자인 토큰 (Tailwind 기반)

#### 9.5.1 Tailwind CSS 설정

- 빌드: `tailwind.config.js` 에서 V1Frame 디자인 시스템(크림/잉크/러스트 팔레트, Inter/Source Serif 4/JetBrains Mono 타이포) 을 `theme.extend.colors`, `theme.extend.fontFamily` 로 정의.
- 모든 UI 컴포넌트 (ChatShell, MessageList, Composer, Sidebar) 는 `@apply` 지시어 또는 className 으로 Tailwind 유틸리티 클래스 조합. 인라인 스타일 하드코딩 금지.
- PostCSS: webpack 설정에 `postcss-loader` 추가해 Tailwind 지시어 처리.

#### 9.5.2 글로벌 CSS 토큰

- `src/renderer/index.css` 에서 `:root` 의 CSS 커스텀 프로퍼티로 색상, 폰트, 간격 정의:
  ```css
  :root {
    --cream-0: theme('colors.cream.0');  /* tailwind.config.js 값 참조 */
    --ink-900: theme('colors.ink.900');
    --rust-400: theme('colors.rust.400');
    --mono: theme('fontFamily.mono');
  }
  ```
- 토큰은 마크다운 렌더러, 스크롤바 스타일, Tweaks 패널 커스텀 색상에서 사용.

#### 9.5.3 마크다운 + Tailwind

- `<MarkdownRenderer>` 의 `react-markdown` 컴포넌트 오버라이드에서 각 요소(`<code>`, `<pre>`, `<table>`, `<a>` 등)에 Tailwind 클래스명 지정.
- 예: `<code className="font-mono text-xs bg-cream-50 px-1.5 py-0.5 rounded" />`

### 9.6 Tweaks 적용 메커니즘 (PRD §10.3)

| 컨트롤 | DOM 영향 |
|---|---|
| 테마 팔레트 | `:root` 의 `--bg`, `--ink`, `--rust` 등 CSS 변수 set |
| 밀도 | `:root` 의 `font-size: 11.5\|13\|14.5px` set (em/rem cascade) |
| 사이드바 접기 | `.app[data-sidebar="collapsed"]` 토글, 너비 248↔56 |

> 인라인 스타일에 색/크기 하드코딩 금지. 모든 시각 변환은 변수 경유.

### 9.7 키보드

| 키 | 동작 |
|---|---|
| `Enter` (Composer) | 전송 |
| `Shift+Enter` | 줄바꿈 |
| `Esc` (스트리밍 중) | 취소 |
| `Ctrl/Cmd+N` | 새 대화 |

---

## 10. Testing Strategy

### 10.1 단위 (Vitest)

| 대상 | 목적 |
|---|---|
| Adapter 정규화 함수 | NDJSON 라인 → ChatEvent 매핑 정확성 (fixture 기반) |
| Reducer | 액션별 상태 전이 |
| IPC 스키마 | zod 검증 통과/실패 케이스 |
| Installer 진단 | which/where 모킹 |

### 10.2 통합 (mock CLI / mock server)

| 대상 | 방법 |
|---|---|
| ClaudeCodeAdapter | `claude` 를 가짜 스크립트(`#!/usr/bin/env node`)로 PATH 상위에 배치, NDJSON 출력 시뮬레이션 |
| OpencodeAdapter | 로컬 HTTP mock 서버 (msw 또는 직접 작성) |
| sessionId 천이 | PRD §7.5 표의 5 단계를 시나리오 테스트 |

### 10.3 E2E (Playwright on Electron)

- 시나리오: 신규 대화 → 메시지 전송 → 스트리밍 응답 수신 → 새 대화 버튼 → sessionId 리셋 확인.
- mock CLI 를 사용 (실 CLI 의존하지 않음).

### 10.4 매뉴얼 확인 체크리스트 (릴리즈 전)

- [ ] 둘 다 미설치 상태에서 인스톨러 흐름.
- [ ] Claude Code 만 설치된 호스트에서 정상 대화.
- [ ] opencode 만 설치된 호스트에서 정상 대화.
- [ ] 활성 대화 중 OAuth 만료 → `auth.expired` 표시.
- [ ] Tweaks 모든 옵션 토글 후 새 대화 시 유지 확인.
- [ ] 앱 강제 종료 후 재시작 시 (Phase 1 한정) 빈 상태로 시작.

---

## 11. Logging & Observability

| 영역 | 구현 |
|---|---|
| Main 로그 | `electron-log` 또는 동급. 파일: 사용자 로그 디렉토리 (`app.getPath('logs')`) |
| 로그 레벨 | `debug / info / warn / error`, 기본 `info` |
| Renderer 로그 | console + IPC 로 main 에 위임 (수집 일원화) |
| 민감 정보 | 메시지 본문은 로그에 남기지 **않음**. `length`, `eventType`, `latencyMs` 만. |
| 텔레메트리 | OQ4 — v1 비포함 |
| 크래시 리포트 | OQ4 — v1 비포함 |

---

## 12. Performance Targets (placeholders)

PRD §11 OQ6 가 결정되면 수치를 채운다.

| 메트릭 | 정의 | 목표값 |
|---|---|---|
| 콜드 스타트 | 더블클릭 → 채팅 화면 인터랙티브 | OQ6 |
| 첫 토큰 지연 | 전송 클릭 → 첫 `assistant_delta` 수신 | OQ6 |
| 스트리밍 끊김 허용치 | 토큰 간 평균 지연 | OQ6 |
| 메모리 (idle) | Main + Renderer 합산 | OQ6 |

---

## 13. Phase 2~4 Architecture Anchors

본 TRD 는 Phase 1 만 구현하지만, 코드는 다음을 *막지 않도록* 설계.

| Phase | Anchor |
|---|---|
| Phase 2 (재시작 재개) | `Settings.store` 에 `lastSessionId` 키. 앱 시작 시 읽어 복원. `electron-store` 도입. |
| Phase 3 (과거 목록) | `SessionAdapter.listSessions` / `loadSession` 옵셔널 메서드는 이미 인터페이스에 존재. Claude Code: jsonl 스캔 (`~/.claude/projects/<cwd>/`), opencode: SDK `client.session.list()`. |
| Phase 4 (멀티 세션) | Renderer 상태를 `{ sessions: Record<id, ChatState> }` 로 확장 가능하도록 `ChatState` 를 *세션 단위* 로 캡슐화. v1 도 단일 인스턴스로 동일 구조 사용. |

---

## 14. Build & Distribution (대부분 OQ3)

| 항목 | 결정 |
|---|---|
| 패키저 | Electron Forge (`create-electron-app` 기본) |
| 타겟 OS | macOS (arm64+x64), Windows (x64), Linux (x64 deb/rpm) |
| macOS notarization | OQ3 |
| Windows code signing | OQ3 |
| 자동 업데이트 채널 | OQ3 |
| 라이센스 | OQ5 |

---

## 15. Open Questions (PRD §11 동기)

| # | 질문 | 본 TRD 에 미치는 영향 |
|---|---|---|
| OQ1 | React 버전 (18/19) | §2 Stack 확정값 |
| OQ2 | 마크다운/하이라이트 라이브러리 확정 | §9.4 |
| OQ3 | 패키징/서명/자동 업데이트 | §14 |
| OQ4 | 텔레메트리 정책 | §11 |
| OQ5 | 라이센스 | §14 |
| OQ6 | 성능 SLA 수치 | §12 |
| OQ7 | 둘 다 설치된 경우 기본 백엔드 정책 | §6.1 |
| OQ8 | "새 대화" 시 직전 세션 노출 방식 | §13 (Phase 2/3) |

> 위 미정 항목들은 사용자 결정 전까지 **에이전트가 단독으로 채우지 않는다**.

---

## 16. References

| 출처 | 사용 |
|---|---|
| `docs/PRD.md` | 본 TRD 의 입력. 모든 요구사항 ID (F1~F10, N1~N6, OQ1~OQ8) 가 PRD 와 동기. |
| `docs/llm-chat-desktop-strategy.md` | 어댑터/세션/설치 전략의 1차 근거 (§3, §5, §10) |
| `project/electron/`, `project/variations/v1-*` | UI 의 시각 기준 (PRD §9 Future Scope 와 §10 Design System) |
| 루트 `README.md` | 핸드오프 원칙 (트랜스크립트 우선, 픽셀 퍼펙트 재현은 타깃 기술에서) |
