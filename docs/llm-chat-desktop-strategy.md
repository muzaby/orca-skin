# LLM 채팅 데스크톱앱 구현 전략

> Claude Code / opencode CLI를 백엔드로 활용하는 Electron 기반 채팅 데스크톱앱의 설계 문서

---

## 1. 프로젝트 개요

### 1.1 목표

호스트에 설치된 **Claude Code** 또는 **opencode** CLI를 백엔드로 활용하여, 데스크톱 GUI에서 LLM과 대화할 수 있는 앱을 만든다. 두 CLI를 모두 지원하며, 각 CLI가 제공하는 공식 메커니즘을 최대한 활용해 직접 구현 영역을 최소화한다.

### 1.2 운영 가정

| 항목 | 내용 |
|---|---|
| 백엔드 CLI 위치 | 호스트(사용자 PC)에 설치되어 있다고 가정 |
| CLI 부재 시 | 앱이 설치를 안내·시도, 실패 시 수동 명령 안내 |
| 지원 CLI | Claude Code, opencode (둘 다) |
| 직접 구현 범위 | 어댑터 + UI만, LLM/컨텍스트 로직은 CLI에 완전 위임 |

---

## 2. 기술 스택

### 2.1 결정된 스택

| 계층 | 채택 기술 | 비고 |
|---|---|---|
| 데스크톱 셸 | **Electron** | Claude Desktop도 동일 채택 |
| 빌드/스캐폴딩 | **electron-vite (`@quick-start/electron` react-ts 템플릿)** | Vite 기반 (TRD §4 확정, 구 create-electron-app/Forge 대체) |
| 언어 | **TypeScript** | CLI JSON 메시지의 타입 안정성 |
| UI 프레임워크 | **React** 확정 (PRD §11 OQ1 채택, TRD §4) | 메시지 스트리밍·마크다운 렌더링에 적합 |
| 마크다운 렌더링 | **react-markdown + Highlight.js** 확정 (PRD §11 OQ2 채택, TRD §4; 추후 shiki 전환 가능) | LLM 응답 렌더링 |
| 스타일링 | **Tailwind CSS** | TRD §4 채택. 디자인 토큰은 CSS 커스텀 프로퍼티 그대로 (PRD §10) |

### 2.2 Claude Desktop의 기술적 참고

Anthropic의 공식 Claude Desktop도 **Electron**으로 만들어져 있다. 그 이유는 다음과 같이 알려져 있다.

- 일부 엔지니어가 과거 Electron 경험이 있어 비네이티브 개발을 선호
- 웹 버전과 데스크톱 버전이 동일한 룩앤필을 갖도록 코드 공유
- LLM(Claude)이 Electron 코드를 잘 다룸

같은 사례: Slack, Discord, VS Code, Notion, Microsoft Teams.

---

## 3. CLI 연결 패턴 결정

### 3.1 검토한 3가지 패턴

| 패턴 | 방식 | 채택 여부 |
|---|---|---|
| **패턴 1**: 터미널 에뮬레이션 | `node-pty` + `xterm.js`로 가상 터미널에 CLI 실행 화면을 그대로 띄움 | ✗ (메시지 단위 가공 어려움) |
| **패턴 2**: 구조화 I/O | CLI의 프로그래밍 모드(`stream-json` / HTTP API)로 JSON 송수신 | ✓ **채택** |
| **패턴 3**: 세션 파일 동기화 | CLI가 디스크에 저장하는 세션 파일을 읽어 표시 | △ (보조 용도) |

### 3.2 채택 사유

- 패턴 2는 **GUI를 자유롭게 디자인** 가능하면서 두 CLI 모두 공식 지원
- 패턴 3은 단방향이라 부적합하지만 "과거 세션 목록 표시" 용도로 보조 활용 가능
- 패턴 1은 GUI라기보다 "터미널을 박아놓은 창"에 가까워 부적합

---

## 4. 핵심 개념: 세션과 컨텍스트 유지

### 4.1 용어 정리

| 용어 | 의미 |
|---|---|
| **대화 컨텍스트 유지** | 한 활성 대화 안에서 LLM이 이전 메시지들을 기억하는 것. 매 턴이 새 대화로 인식되지 않는 상태 |
| **세션 영속화** | 앱 재시작 후에도 과거 대화가 사이드바에 남아있는 것 |
| **TODO/멀티 세션** | 사이드바에서 여러 대화를 클릭으로 전환하는 확장 기능 |

본 단계의 핵심 요구는 **대화 컨텍스트 유지**이며, 위 세 단계는 모두 동일한 `session_id`로 식별되므로 컨텍스트 유지를 제대로 구현하면 이후 확장은 자연스럽게 따라온다.

### 4.2 /context가 유지된다는 것의 의미

Claude Code의 `/context`가 보여주는 것은 **현재 LLM에 주입되는 컨텍스트 윈도우의 상태**(시스템 프롬프트, 도구 정의, 누적 대화 메시지, 토큰 사용량)이다.

> "대화가 유지되는 동안 `/context`의 메모리가 유지된다"
>
> = 같은 활성 대화 안에서 메시지를 주고받을 때, 이전 턴의 사용자 메시지·AI 응답·도구 호출 결과가 모두 컨텍스트 윈도우에 누적되어 LLM이 그것들을 보면서 응답하는 상태

---

## 5. 두 CLI의 컨텍스트 유지 메커니즘

### 5.1 핵심 차이 요약

| 항목 | Claude Code | opencode |
|---|---|---|
| **프로세스 모델** | 세션당 영구 stdin child (5분 idle 회수, 다음 메시지에 `--resume` 으로 재spawn). 과거 모델은 매 턴 spawn — §6.7 Legacy. | Long-running server: 한 번 띄우고 유지 |
| **컨텍스트 보관 위치** | 살아있는 child 메모리 + 디스크 jsonl (`~/.claude/projects/<cwd>/<session-id>.jsonl`) | 서버 프로세스 메모리 + SQLite (`~/.local/share/opencode/`) |
| **세션 ID 발급 시점** | 첫 spawn 의 `system/init` 이벤트 (이후 stdin 재사용 동안 유지) | `POST /session` 응답 |
| **이어가기 명령** | 같은 child stdin 에 user NDJSON 한 줄 write. child 가 죽었을 때만 `--resume <id>` 로 새 spawn. | 같은 `session_id`로 HTTP 재요청 |
| **GUI가 호출하는 방식** | `child_process.spawn` 1회 (세션당) + 이후 stdin write | HTTP 클라이언트 (SDK 권장) |
| **공식 SDK** | Agent SDK (TS/Python) | `@opencode-ai/sdk` (TS) |
| **스트리밍 방식** | stdout으로 NDJSON | HTTP SSE/스트림 |
| **GUI가 보관할 상태** | `sessionId` 문자열 한 개 (child 핸들은 어댑터 내부) | `sessionId` + 서버 핸들 |

### 5.2 한 줄 요약

```
Claude Code: "세션마다 살아있는 child 가 곧 세션의 정체.
              매 턴 그 child 의 stdin 에 한 줄 던진다.
              비활성 5분이 지나면 child 만 회수하고, 다음 진입에 --resume 으로 복원한다"

opencode:    "살아있는 서버 프로세스가 곧 세션의 정체.
              클라이언트는 HTTP로 말을 건다"
```

---

## 6. Claude Code: 영구 stdin 세션 + idle 회수 + --resume fallback

> 본 섹션은 Phase 2.5 모델 (영구 stdin 세션) 을 기준으로 한다. Phase 2 (one-shot, 매 턴 spawn) 는 §6.7 Legacy 로 보존.

### 6.1 동작 다이어그램

```
                        ┌─────────────────────────────────┐
                        │   GUI (Electron Main Process)   │
                        │   sessionId: string | null      │
                        │                                 │
                        │   ┌─ ClaudeCodeAdapter ──────┐  │
                        │   │ child:    proc | null    │  │
                        │   │ idleTimer: T | null      │  │
                        │   │ lastSid:  string | null  │  │
                        │   └──────────────────────────┘  │
                        └──────────────┬──────────────────┘
                                       │
                                       │ 첫 user 메시지 (lazy spawn)
                                       ▼
                    spawn child_process (세션당 1회)
                    ┌──────────────────────────────────────┐
                    │ claude -p                            │
                    │   --input-format  stream-json        │
                    │   --output-format stream-json        │
                    │   --verbose --include-partial-messages│
                    │   [--resume <sid>]   ← idle/crash 후 │
                    └──────────────┬───────────────────────┘
                                   │ child 살아있음
            ┌──────────────────────┼──────────────────────┐
            │ 1턴                  │ 2턴                  │ 3턴 ...
            ▼                      ▼                      ▼
     stdin write             stdin write             stdin write
     {"type":"user",         {"type":"user",         {"type":"user",
      "message":...}          "message":...}          "message":...}
            │                      │                      │
            ▼                      ▼                      ▼
     stdout: system/init    stdout: assistant_*     stdout: assistant_*
        (sessionId)          stream + result          stream + result
            │                      │                      │
            ├── idle 타이머        ├── 타이머 RESET      ├── 타이머 RESET
            │   start (5min,      │   (result 시점)     │   ...
            │   ready 상태)       │                      │
            │                      │                      │
            ▼                      ▼                      ▼
     [child idle, ready]    [child idle, ready]    [child idle, ready]

     ※ in-turn (어시스턴트 스트리밍·도구 호출 중) 동안 idle 타이머는 OFF.
       응답이 5분을 넘겨도 자원 회수 대상 아님.

     ※ 5분간 다음 user write 없음 → child.stdin.end() → 2초 grace → SIGTERM.
       sessionId (어댑터 메모리) 는 보존. 다음 user 메시지에 lazy 재spawn:
       claude -p ... --resume <sid>  → 같은 jsonl 재진입 → 정상 흐름 복귀.

    ~/.claude/projects/<cwd>/abc-123.jsonl  (CLI 가 자동 append)
    ┌────────────────────────────────────────────────────────────────┐
    │ {"role":"user","content":"안녕"}                                │
    │ {"role":"assistant","content":"안녕하세요!"}                    │
    │ {"role":"user","content":"방금 뭐랬어?"}            ← 2턴 후   │
    │ ...                                                             │
    └────────────────────────────────────────────────────────────────┘
```

### 6.2 매 턴 흐름

정상 흐름 (살아있는 child 에 보내는 경우):

| 단계 | 동작 |
|---|---|
| ① | GUI 가 어댑터에 `sendMessage(sid, text)` 호출 |
| ② | 어댑터가 살아있는 child 의 stdin 에 user NDJSON 한 줄 write — 별도 spawn 없음 |
| ③ | child 가 LLM 호출, stdout 으로 `assistant_delta` → `result` 까지 NDJSON 출력 |
| ④ | child 가 새 메시지/응답을 jsonl 에 자동 append (CLI 책임) |
| ⑤ | `result` 이벤트 도착 — 어댑터가 idle 타이머 RESET 후 5분 카운트 시작 |
| ⑥ | child 는 살아있는 채로 다음 user write 또는 idle 만료 대기 |

lazy spawn 흐름 (child 가 없을 때 — 첫 메시지 / idle 회수 후 / crash 후):

| 단계 | 동작 |
|---|---|
| ① | GUI 가 `sendMessage(sid, text)` 호출. 어댑터의 child 가 null 임을 확인 |
| ② | spawn `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages [--resume <sid>]` (sid 있으면 추가) |
| ③ | 첫 `system/init` 이벤트에서 `session_id` 캡처 (새 세션이면 신규, `--resume` 이면 동일 ID) |
| ④ | 이후 §6.2 정상 흐름과 동일 |

### 6.3 활용하는 CLI 기능

| 옵션 | 역할 |
|---|---|
| `-p` | 프로그래밍(헤드리스) 모드 진입. argv 로 user 텍스트를 전달하지 않고 stdin 으로 흘림 |
| `--input-format stream-json` | stdin 을 NDJSON 라인으로 받음 — 영구 세션의 핵심 |
| `--output-format stream-json` | stdout NDJSON 스트리밍 |
| `--verbose` | 메타데이터 포함 (`session_id` 등) — 영구 세션의 첫 이벤트 캡처에 필수 |
| `--include-partial-messages` | 토큰 단위 델타 (Phase 2.5 적용) |
| `--resume <session_id>` | child 가 죽거나 idle 회수 후 새 spawn 시 같은 jsonl 로 컨텍스트 복원 — fallback 용. 정상 흐름에서는 사용 안 함 |

### 6.4 GUI 가 직접 안 하는 것

- 컨텍스트 윈도우 관리 (살아있는 child + jsonl 이 자동 처리)
- 토큰 한계 시 압축 (CLI 내장 `/compact` 로직)
- 세션 파일 쓰기 (CLI가 자동 기록)

### 6.5 알려진 제약과 idle 정책

- **OAuth 만료**: Claude Code OAuth 토큰이 약 10~15분 후 만료될 수 있음 → 401 감지 시 child 종료 → 사용자에게 `claude /login` 안내 → 재로그인 후 다음 메시지에 `--resume <sid>` 로 새 spawn.
- **Idle 회수 (5분 고정)**: child 가 살아있는 동안에도 유휴 메모리·OAuth 토큰을 점유하므로, **마지막 `result` 이벤트 (정상 답변 완료) 수신 후** 5분간 다음 user write 가 없으면 child 만 회수한다 (sessionId 는 어댑터 메모리에 보존). 다음 user 메시지에 lazy 재spawn + `--resume <sid>` 로 컨텍스트 무결하게 복원.
- **in-turn 은 idle 이 아님**: 어시스턴트가 5분 넘게 스트리밍·도구 호출을 해도 idle 타이머는 동작하지 않으므로 자원 회수 대상이 아니다 (`result` 이벤트 도착 전까지는 활발한 작업으로 간주).
- **N 세션 ≠ N child**: lazy spawn 정책으로 ChatSession N 개가 동시에 N 개의 child 를 띄우지 않는다 — 사용자가 *그 세션에서 첫 user 메시지를 실제로 보내는 순간* 에만 spawn 한다.

### 6.6 claude-code(web) 와의 정책 동형성

claude-code 의 웹/클라우드 버전은 비활성 컨테이너를 기간 후 회수하고, 다음 진입 시 컨텍스트를 복원한다. 데스크톱의 본 모델은 동일 패턴의 매핑이다.

| 차원 | claude-code(web) | Orca 데스크톱 |
|---|---|---|
| 살아있는 단위 | 클라우드 컨테이너 | 로컬 child 프로세스 |
| 회수 트리거 | 일정 비활성 시간 | 5분 idle (마지막 `result` 후) |
| 컨텍스트 저장소 | 원격 세션 스토어 | `~/.claude/projects/<cwd>/<sid>.jsonl` |
| 복원 트리거 | 사용자 재진입 | 다음 user 메시지 (`sendMessage`) |
| 복원 메커니즘 | 컨테이너 재가동 + 세션 로드 | 새 spawn + `--resume <sid>` |

### 6.7 Legacy: Phase 2 one-shot 모델 (보존, 미권장)

Phase 2 까지의 ClaudeCodeAdapter 는 매 턴 새 프로세스를 spawn 하고 `--resume <sessionId>` 로 컨텍스트를 복원하는 one-shot 모델이었다. 매 턴 spawn → CLI 부팅 → jsonl 읽기 → LLM 호출 사이클이 첫 토큰 지연을 늘리므로 Phase 2.5 부터는 영구 stdin 모델이 정상 흐름. Legacy 경로 (`claude -p "<text>" --resume <sid>` argv 단발) 는 코드에서 완전 제거하지 않고 *crash recovery / 단발성 도구 호출* 용으로 보존한다.

---

## 7. opencode: Long-running server + 세션 ID 재사용

### 7.1 동작 다이어그램

```
                    ┌────────────────────────────────────┐
                    │    GUI (Electron Main Process)     │
                    │                                    │
                    │    sessionId: string | null        │
                    │    serverProc: ChildProcess        │
                    │    httpClient: OpencodeClient      │
                    └────────────────┬───────────────────┘
                                     │
                                     │ 앱 시작 시 1회
                                     ▼
                    spawn child_process (계속 살아있음)
                    ┌────────────────────────────────────┐
                    │  opencode serve                    │
                    │   --port 4096 --hostname 127.0.0.1 │
                    │  (env: OPENCODE_SERVER_PASSWORD)   │
                    └────────────────┬───────────────────┘
                                     │
                                     │ HTTP (OpenAPI 3.1)
                                     │
            ┌────────────────────────┼────────────────────────┐
            │ 1턴                    │ 2턴                    │ 3턴
            ▼                        ▼                        ▼
    POST /session              POST /session/             POST /session/
    (신규 생성)                  abc-123/message            abc-123/message
            │                        │                        │
            ▼                        ▼                        ▼
    sessionId 발급            "방금 뭐랬어?"             "더 알려줘"
    POST /session/                  │                        │
      abc-123/message               │                        │
    "안녕"                          │                        │
            │                        │                        │
            ▼                        ▼                        ▼
    [SSE 스트림 응답]          [SSE 스트림 응답]         [SSE 스트림 응답]

  서버 프로세스 내부 상태:
  ┌───────────────────────────────────────────────────────────────┐
  │  세션 abc-123                                                 │
  │  ├─ 메시지 누적 리스트 (메모리)                              │
  │  ├─ ~/.local/share/opencode/ 의 SQLite로 영속화              │
  │  └─ LLM 호출 시 누적 메시지 전체를 컨텍스트로 사용           │
  └───────────────────────────────────────────────────────────────┘
```

### 7.2 각 턴 흐름

| 단계 | 동작 |
|---|---|
| ① | GUI가 SDK로 chat 호출 (`sessionId` 포함) |
| ② | 서버가 자기 메모리/DB에서 해당 세션 히스토리 로드 |
| ③ | 새 메시지 추가 후 LLM 호출 |
| ④ | 응답을 SSE/스트림으로 GUI에 전송 |
| ⑤ | 서버가 응답을 세션 히스토리에 추가 (메모리 + DB) |
| ⑥ | 서버는 계속 살아있음 |

### 7.3 활용하는 CLI/SDK 기능

| 항목 | 역할 |
|---|---|
| `opencode serve --port <P> --hostname 127.0.0.1` | 헤드리스 HTTP 서버 기동 |
| `OPENCODE_SERVER_PASSWORD` 환경변수 | HTTP basic auth로 보안 |
| `@opencode-ai/sdk`의 `createOpencodeClient({ baseUrl, auth })` | 타입세이프 클라이언트 |
| `client.session.create()` | 신규 세션 생성 |
| `client.session.chat({ sessionId, parts })` | 메시지 전송 + 스트림 수신 |

### 7.4 GUI가 직접 안 하는 것

- HTTP 요청/응답 직접 작성 (SDK가 처리)
- 세션 메모리 관리 (서버가 처리)
- 디스크 영속화 (서버가 SQLite에 자동 저장)
- 컨텍스트 압축 (서버가 처리)

---

## 8. GUI 측 어댑터 아키텍처

### 8.1 전체 구조

```
              ┌──────────────────────────────────────┐
              │  Renderer (UI)                       │
              │  - "메시지 보내기" 버튼만 누름       │
              │  - 메시지 버블 렌더링                │
              └────────────────┬─────────────────────┘
                               │ Electron IPC
              ┌────────────────▼─────────────────────┐
              │  공통 인터페이스 (얇음)              │
              │  ─ sendMessage(text) → stream         │
              │  ─ resetConversation()                │
              │  ─ listSessions() (확장 단계)         │
              └─────┬───────────────────────┬────────┘
                    │                       │
        ┌───────────▼─────────┐  ┌──────────▼──────────┐
        │ ClaudeCodeAdapter   │  │ OpencodeAdapter     │
        │                     │  │                     │
        │ 책임:               │  │ 책임:               │
        │ • spawn 호출만      │  │ • serve 1회 spawn  │
        │ • --resume 플래그   │  │ • SDK 위임          │
        │   에 sessionId 끼움 │  │ • sessionId 재사용 │
        │ • stdout NDJSON     │  │                     │
        │   파싱하여 yield    │  │                     │
        │                     │  │                     │
        │ 직접 안 함:         │  │ 직접 안 함:         │
        │ • 컨텍스트 누적     │  │ • HTTP 직접 작성   │
        │ • 세션 파일 쓰기    │  │ • 세션 저장         │
        │ • LLM 호출          │  │ • LLM 호출          │
        └─────────────────────┘  └─────────────────────┘
                    │                       │
                    ▼                       ▼
              [claude CLI]            [opencode serve]
                    │                       │
                    └─── 컨텍스트 유지 책임 (둘 다 CLI/서버 측) ───┘
```

### 8.2 공통 인터페이스 정의 (TypeScript)

```typescript
export type Backend = 'claude-code' | 'opencode';

export interface ChatEvent {
  type: 'init' | 'assistant_delta' | 'assistant_message'
      | 'tool_use' | 'tool_result' | 'result' | 'error';
  sessionId: string;
  data: unknown;
}

export interface SessionAdapter {
  isInstalled(): Promise<boolean>;
  install(): Promise<void>;
  sendMessage(
    sessionId: string | null,   // null이면 새 세션
    text: string,
    cwd: string,
  ): AsyncIterable<ChatEvent>;
  // 확장 단계용
  listSessions?(): Promise<SessionInfo[]>;
  loadSession?(id: string): Promise<ChatEvent[]>;
}
```

### 8.3 GUI가 보관·관리할 것 vs CLI/서버에 위임할 것

| 책임 | Claude Code | opencode |
|---|---|---|
| 세션 ID 발급 | CLI (첫 응답에서 받음) | 서버 (`POST /session` 응답) |
| 컨텍스트 윈도우 누적 | CLI가 jsonl 파일 기반으로 처리 | 서버가 메모리+SQLite로 처리 |
| 턴 간 컨텍스트 복원 | `--resume <id>` 한 줄 | 같은 `sessionId`로 HTTP 재호출 |
| GUI가 들고 있는 상태 | 활성 `sessionId` 문자열 | 활성 `sessionId` + 서버 핸들 |
| GUI가 매 턴 하는 일 | spawn에 ID 끼워주기 | SDK 호출에 ID 끼워주기 |
| **컨텍스트 관리 로직** | **GUI 측 0줄** (CLI 위임) | **GUI 측 0줄** (서버 위임) |

---

## 9. 컨텍스트 유지 동작 시나리오

### 9.1 한 번의 활성 대화 안에서

| 시점 | sessionId 상태 | 동작 |
|---|---|---|
| 사용자가 "새 대화" 버튼 | `null` | 초기화 |
| 1번째 메시지 전송 | `null` → 발급됨 | resume 옵션 없이 호출, 응답의 첫 이벤트에서 ID 받아 저장 |
| 2번째 메시지 전송 | 보존 | 같은 ID로 재호출 → CLI/서버가 컨텍스트 복원 |
| 3번째, 4번째 ... | 보존 | 동일 |
| 사용자가 "새 대화" 버튼 다시 누름 | `null`로 리셋 | 다음 메시지부터 새 세션 |

### 9.2 핵심 포인트

> GUI는 활성 대화의 `sessionId`를 변수에 보관하고, 매 메시지 전송 시 그 ID를 CLI에 전달한다. 첫 메시지에서는 ID가 null이고, CLI 응답의 첫 이벤트에서 발급된 ID를 받아 이후 턴들에 재사용한다. 이것이 전부.

---

## 10. CLI 설치 자동화 전략

### 10.1 흐름

```
앱 시작
  │
  ▼
Claude Code 설치 확인  ──┐
                          │
opencode 설치 확인     ──┤
                          │
  ┌───────────────────────┘
  │
  ▼
둘 다 없음?
  │
  ├─ Yes ─→ 사용자에게 다이얼로그
  │          ├─ Claude Code 설치 (npm install -g @anthropic-ai/claude-code)
  │          ├─ opencode 설치 (curl -fsSL https://opencode.ai/install | bash)
  │          └─ 취소 → 수동 설치 안내 표시
  │
  └─ No ──→ 설치된 CLI를 활성 백엔드로 사용
```

### 10.2 설치 시 주의사항

| 이슈 | 대응 |
|---|---|
| Node.js 미설치 | `npm install -g`는 Node 필요 → OS별 안내 (macOS Homebrew, Windows winget 등) |
| 글로벌 npm 권한 부족 | sudo 권한 필요할 수 있음 → 실패 시 터미널 명령 안내 fallback |
| 자동 설치 실패 | 사용자에게 명령줄 표시 후 수동 설치 유도 |

---

## 11. 단계별 확장 로드맵

| 단계 | 기능 | 구현 위치 |
|---|---|---|
| **Phase 1** | 단일 활성 대화의 컨텍스트 유지 | `sessionId` 메모리 변수 1개 |
| **Phase 2** | 앱 재시작 후 마지막 대화 재개 | `electron-store`로 `sessionId` 영속화 |
| **Phase 3** | 사이드바에 과거 대화 목록 | `listSessions()` 구현 (jsonl 스캔 / `client.session.list()`) |
| **Phase 4** | TODO 같은 멀티 세션 관리 모드 | 활성 세션 전환 UI |

각 단계는 **이전 단계의 `sessionId` 추적 로직을 그대로 재사용**하므로 누적 비용이 낮다.

---

## 12. 결론 요약

| 항목 | 결론 |
|---|---|
| 데스크톱 셸 | Electron + electron-vite (react-ts) |
| CLI 연결 패턴 | 패턴 2 (구조화 I/O) 메인, 패턴 3 (세션 파일) 보조 |
| Claude Code 메커니즘 | 세션당 영구 stdin child (lazy spawn, `--input-format stream-json`). 매 턴 stdin NDJSON write. 5분 idle 회수 후 다음 메시지에 `--resume <sid>` 로 재spawn |
| opencode 메커니즘 | `serve`로 1회 띄운 서버에 같은 `sessionId`로 HTTP 재호출 |
| GUI의 컨텍스트 관리 코드 | **0줄** — 두 CLI/서버에 완전 위임 |
| GUI의 책임 | `sessionId` 변수 1개 보관 + 어댑터 인터페이스 통일 |
| 직접 구현 최소화 원칙 | 모든 컨텍스트/세션/LLM 로직은 CLI에 위임, 어댑터는 ID 전달·이벤트 정규화·child 라이프사이클(idle/재개) 만 담당 |
