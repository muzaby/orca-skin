# Backend Architecture

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-02 (Phase 3++ 구현 반영: DB/MCP/Runtime/CapabilityBuilder. §2·§3·§3.1·§4·§5·§6·§7·§9·§11 갱신.)
> 관련 문서: [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md), [IPC_CONTRACT.md](./IPC_CONTRACT.md), [GLOSSARY.md](./GLOSSARY.md), [TRD.md](./TRD.md), [claude-code-spec.md](./claude-code-spec.md), [PRD.md](./PRD.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 이 문서의 범위

**다루는 것**
- Electron Main Process 구조 (`app/src/main/`)
- Backend Adapter 추상화 (SessionAdapter — LLM Provider 가 아님)
- 데이터 영속성 (electron-store 현재 + 로컬 DB + 파일 시스템 Phase 3+ 채택 결정)
- IPC 핸들러 구조 (채널 카탈로그는 [IPC_CONTRACT.md](./IPC_CONTRACT.md))
- 보안 경계 (BrowserWindow 옵션 + 자격증명 모델)
- 시스템 통합 (자동 업데이트 / 로깅 / 플랫폼 차이)

**다루지 않는 것 (→ FRONTEND_ARCHITECTURE.md 참조)**
- UI 컴포넌트 / 렌더링 최적화
- 사용자 입력 처리 / 자동완성
- React 상태 관리 / 스타일링

---

## 2. 기술 스택

`app/package.json` 기준 (2026-05-20).

| 영역 | 선택 | 버전 | 비고 |
|---|---|---|---|
| 런타임 | Electron | ^39.2.6 | `app.whenReady()` 부트 |
| 언어 | TypeScript | ~5.x (strict, target ES2022) | tsconfig.node.json 분리 |
| 빌드 도구 | electron-vite | ^5.0.0 | main + preload sub-config |
| LLM SDK (claude-code) | @anthropic-ai/claude-agent-sdk | latest | `query()` 함수 직접 사용 (Phase 3 채택) |
| LLM SDK (opencode) | @opencode-ai/sdk | — | **미설치** (Future, OQ7) |
| 입력 검증 | zod | ^4.4.3 | `src/shared/protocol.ts` 스키마 |
| 설정 저장 | electron-store | ^8.2.0 | 단일 객체 스토어 (`orca-settings`) |
| 로컬 DB | **better-sqlite3** | ^12.x | ✅ Phase 3 도입 완료. 동기 API, Electron 호환. 직접 마이그레이션 (`db/migrations/`). WAL + foreign_keys pragma. |
| HTTP 클라이언트 | (SDK 내부) | — | 별도 채택 없음 |
| 보안 저장 (자격증명) | Electron safeStorage | (Electron 내장) | ✅ Phase 3++ 도입 완료 (MCP 인증 비밀 첫 실사용). OS keychain — macOS Keychain / Windows DPAPI / Linux libsecret. `config/secret-store.ts` 래퍼. |
| 자동 업데이트 | **미선정** (PRD OQ3) | — | electron-updater 채택 미확정 |
| 로깅 | TBD | — | 라이브러리 미선정 |
| 패키저 | electron-builder | — | `electron-builder.yml` |
| 유틸 | @electron-toolkit/utils | ^4.0.0 | 경로 / dev 모드 감지 |
| Preload 유틸 | @electron-toolkit/preload | ^3.0.2 | contextBridge 헬퍼 |

---

## 3. 프로세스 구조

```
Electron App
├── Main Process (src/main/)
│   ├── index.ts                # 부트: IpcRouter → BrowserWindow → 라이프사이클
│   ├── ipc/router.ts           # 31 채널 등록 + zod 검증 + 디스패치 + CapabilityBuilder 조립
│   ├── adapters/
│   │   ├── types.ts            # SessionAdapter / Backend 공통 타입
│   │   ├── registry.ts         # AdapterRegistry — claude-code 단일 등록
│   │   ├── claude-code.ts      # ClaudeCodeAdapter — SDK query() 직접 사용
│   │   └── claude-adapt.ts     # OrcaCapabilities → claude query() 옵션 순수 변환 (adaptMcp / adaptSystemPrompt / adaptSkills / adaptHooks)
│   ├── capabilities/
│   │   ├── types.ts            # OrcaCapabilities (백엔드 중립 보조기능 집합)
│   │   ├── hooks.ts            # OrcaHookSet 평가기 (before/after-tool 결정)
│   │   └── builder.ts          # CapabilityBuilder — DB/McpStore/Skills 읽어 OrcaCapabilities 조립
│   ├── config/
│   │   ├── paths.ts            # orcaConfigDir() (~/.config/orca) 경로 상수
│   │   ├── mcp-file.ts         # mcp.json atomic write (temp+rename)
│   │   └── secret-store.ts     # Electron safeStorage 래퍼 — 암호화/복호화
│   ├── db/
│   │   ├── index.ts            # DB 초기화 (better-sqlite3) + DbQueries 팩토리. WAL + foreign_keys.
│   │   ├── migrate.ts          # 마이그레이션 실행기 (schema_version 추적, 순번 자동 실행)
│   │   ├── queries.ts          # 모든 prepared statement (sessions/messages/projects/FTS5)
│   │   ├── types.ts            # DB 행 타입 (SessionRow / MessageRow / ProjectRow 등)
│   │   └── migrations/
│   │       ├── 0001_initial.sql        # sessions + messages + tool_calls 테이블
│   │       ├── 0002_projects.sql       # projects 테이블 + sessions.project_id FK
│   │       └── 0003_messages_fts.sql   # FTS5 가상 테이블 + 3 트리거 + 백필
│   ├── mcp/
│   │   ├── schema.ts           # OrcaMcpConfig (= ClaudeMcpConfig 별칭). 순정 Claude mcpServers 스키마.
│   │   ├── store.ts            # McpStore — mcp.json + secret-store + settings(mcpEnabled/mcpMeta) 조율
│   │   ├── convert.ts          # toClaudeConfig / toOpencodeConfig 순수 변환 (동형 시그니처)
│   │   ├── expand.ts           # ${VAR} 플레이스홀더 확장
│   │   ├── resolver.ts         # safeStorage → process.env 2단계 해소. 미해결 변수 → 서버 드롭.
│   │   ├── crypto.ts           # safeStorage encrypt/decrypt 헬퍼
│   │   └── migrate.ts          # 레거시 orca-mcp 스토어 → 파일 모델 1회 이전 (부팅 시, mcp.json 부재 시만)
│   ├── runtime/
│   │   ├── PythonRuntime.ts    # uv 기반 격리 Python 환경 관리. ensure() / getEnv() / statusEvent 브로드캐스트.
│   │   ├── env.ts              # UV_*/PATH env 조립 (SDK query().options.env 주입용)
│   │   └── paths.ts            # <userData>/runtime 경로 상수
│   ├── installer/index.ts      # 4줄 래퍼 — adapter.install() 의 AsyncIterable yield
│   ├── settings/store.ts       # electron-store 영속화 (9 키 — §6.2)
│   └── skills/
│       ├── scan.ts             # ~/.claude/skills + <cwd>/.claude/skills 부팅 1회 스캔
│       └── plugin-bundle.ts    # ensureOrcaPlugin() — ~/.config/orca/.claude-plugin/plugin.json 생성
│
├── Preload (src/preload/index.ts)
│   └── contextBridge.exposeInMainWorld('orca', api) — window.orca 노출 (IPC_CONTRACT §2)
│
└── Renderer (src/renderer/) → FRONTEND_ARCHITECTURE.md 참조
```

### 3.1 부트 시퀀스 (`src/main/index.ts`)

```
1. app.whenReady()
2. settings = new SettingsStore()           # electron-store 로드 (9 키, §6.2)
3. db = openDatabase()                      # better-sqlite3 초기화 + 마이그레이션 자동 실행
4. mcpStore = new McpStore(db, settings)    # mcp.json + secret-store + settings 조율. 레거시 1회 이전.
5. router = new IpcRouter(settings, db, mcpStore, ...)
6. router.start()                           # 31 채널 ipcMain.handle / send 등록. CapabilityBuilder 초기화.
7. createWindow(settings)                   # BrowserWindow + webPreferences 명시
   ├─ contextIsolation: true
   ├─ nodeIntegration: false
   ├─ sandbox: true
   └─ preload: '../preload/index.js'
8. PythonRuntime.ensure() 비동기 킥          # 진행 상태는 orca:runtime:statusEvent 로 브로드캐스트
9. windowBounds 복구 (settings.getAll().windowBounds 와 DEFAULT_BOUNDS merge)
10. mainWindow.on('close') → settings.patch({ windowBounds })
```

### 3.2 모듈 간 import 규약

- **Main** → `shared` (타입 + protocol zod 스키마) 만. `renderer` 절대 import 금지.
- **Preload** → `shared/ipc.ts` (zod 의존 없는 순수 TS 타입) 만. `protocol.ts` (zod) import 금지 (sandbox=true 에서 zod 작동 안 함).
- **Renderer** → `shared/ipc.ts` 만. `main` 절대 import 금지.

---

## 4. Backend Adapter 추상화

> ⚠️ **"LLM Provider" 가 아니다.** Orca 는 LLM API 를 직접 호출하지 않고 외부 CLI/SDK (Claude Code SDK, opencode 등) 를 래핑한다. 용어는 [GLOSSARY.md](./GLOSSARY.md) §3 참조.

### 4.1 SessionAdapter 인터페이스 계약

`app/src/main/adapters/types.ts:5-15` 그대로:

```typescript
export interface SessionAdapter {
  readonly id: Backend
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  sendMessage(
    sessionId: string | null,   // null = 새 세션
    text: string,
    cwd: string,
    signal?: AbortSignal
  ): AsyncIterable<ChatEvent>
}
```

### 4.2 등록된 백엔드 (현재 — Phase 3 SDK)

| Backend | 어댑터 파일 | 구현 방식 | 상태 |
|---|---|---|---|
| `claude-code` | `adapters/claude-code.ts` | `@anthropic-ai/claude-agent-sdk` 의 `query()` 함수 직접 호출 | ✅ Phase 3 채택 (CLI spawn 폐기) |
| `opencode` | (없음) | — | ⏳ Future (PRD OQ7) |

`AdapterRegistry` (`adapters/registry.ts`) 는 현재 `claude-code` 단일 어댑터만 등록. 활성 백엔드는 부팅 시 자동 결정 (`this.active = claudeCode.id`).

### 4.3 ClaudeCodeAdapter 호출 패턴

`claude-adapt.ts` 의 순수 변환 함수들이 `OrcaCapabilities` → claude `query()` 옵션 조각(object)으로 변환하며, `...spread` 로 합성된다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'
import { adaptMcp, adaptSystemPrompt, adaptSkills, adaptHooks } from './claude-adapt'

async function* sendMessage(sessionId, text, cwd, caps, resolvedMcp, signal) {
  try {
    const opts = {
      resume: sessionId ?? undefined,
      includePartialMessages: true,
      cwd,
      ...adaptMcp(resolvedMcp),            // mcpServers + allowedTools (빈 config면 생략)
      ...adaptSystemPrompt(caps.systemPromptAppend), // systemPrompt preset:claude_code + append
      ...adaptSkills(),                    // plugins:[{type:'local', path:~/.config/orca}] + skills:'all'
      ...adaptHooks(caps.hooks),           // PreToolUse / PostToolUse / UserPromptSubmit hook 콜백
    }
    for await (const msg of query({ prompt: text, options: opts })) {
      yield normalize(msg)  // SDKMessage → ChatEvent
    }
  } catch (err) {
    yield { type: 'error', data: detectError(err) }
  }
}
```

`adaptMcp` 는 활성 서버가 없으면 옵션 자체를 빈 객체로 반환(생략). `allowedTools` 는 `mcp__<name>__*` 와일드카드로 서버 전체 도구 자동 허용 — `canUseTool` 미도입(Phase 4 anchor) 환경에서 도구 호출 차단 방지.

### 4.4 CapabilityBuilder (백엔드 중립 보조기능 조립)

`capabilities/builder.ts` 의 `CapabilityBuilder` 는 DB / McpStore / Skills 를 읽어 **백엔드 중립** `OrcaCapabilities` 를 조립한다. 어댑터를 전혀 모른다 — 어댑트(claude 타깃 변환 + `${VAR}` 확장)는 `claude-adapt.ts` 와 `mcp/resolver.ts` 의 책임.

```typescript
interface OrcaCapabilities {
  mcpConfig: OrcaMcpConfig          // 확장 전 정규 소스 (${VAR} 미확장)
  systemPromptAppend?: string       // 프로젝트 지침 + PY_AGENT_RULES 합성
  skills: SkillInfo[]               // 가시화 메타 (어댑트는 항상-on)
  hooks: OrcaHookSet                // before-tool / after-tool / prompt-submit 핸들러 집합
}
```

`build(sessionId, projectId)` 동작:
- resume 경로 (`sessionId !== null`): 세션 바인딩으로 프로젝트 지침 조회
- 새 채팅 경로 (`sessionId === null`): `projectId` 로 직접 조회
- `systemPromptAppend` = (프로젝트 지침 있으면 그 뒤에) `PY_AGENT_RULES` 항상 합류
- 매 턴 DB 1회 조회 — 캐시 없음 (지침 편집이 다음 메시지부터 즉시 반영)

### 4.4 SDKMessage → ChatEvent 정규화

`adapters/claude-code.ts` 의 `normalize()` 함수 (줄 30-124):

| SDKMessage | → ChatEvent |
|---|---|
| `SDKSystemMessage { subtype: 'init', session_id, model? }` | `{ type: 'init', data: { sessionId, model, cwd } }` |
| `SDKPartialAssistantMessage` 의 `event.delta.type === 'text_delta'` | `{ type: 'assistant_delta', data: { text } }` |
| `SDKAssistantMessage` 의 `content` 내 text block (완성본) | `{ type: 'assistant_message', data: { text } }` |
| `SDKAssistantMessage` 의 `content` 내 `tool_use` block | `{ type: 'tool_use', data: { toolUseId, name, input } }` |
| `SDKUserMessage` 의 `content` 내 `tool_result` block | `{ type: 'tool_result', data: { toolUseId, output, isError, durationMs? } }` |
| `SDKResultMessage { subtype: 'success' \| 'error_*', usage, total_cost_usd }` | `{ type: 'result', data: { usage } }` |
| `SDKPermissionDeniedMessage` (Phase 4) | (현재 무시 — 권한 정책 도입 시 매핑) |
| 어댑터 catch → Error | `{ type: 'error', data: { code: 'sdk.*' \| 'auth.expired' \| ..., message, recoverable } }` |

> **정규화 계층 (설계 확정 / 구현 대기)**: 위 `ChatEvent` 는 claude-code 결합 형태다. provider 중립 `NormalizedEvent`(+ `permission.requested` 1급 이벤트) 로의 승격 설계와 현행 9종 전수 매핑표는 **§12.1** 참조.

### 4.5 인증 만료 감지

SDK 가 throw 하는 에러 메시지/코드에서 `401` / `OAuth` / `expired` 패턴 매칭 → `error / auth.expired` 이벤트 발행 → UI 의 AuthExpiredModal 로 `claude /login` 안내.

### 4.6 SDK 채택 범위 (Phase 3 MVP)

| SDK 기능 | Orca | Phase | 비고 |
|---|---|---|---|
| `query({ prompt, options })` 단일 진입점 | ✅ | Phase 3 | CLI `claude -p` 의 대체 |
| `options.resume: sessionId` | ✅ | Phase 3 | `--resume` 직접 대응 |
| `options.includePartialMessages: true` | ✅ | Phase 3 | delta 스트리밍 |
| `options.cwd` | ✅ | Phase 3 | spawn `{ cwd }` 대체 |
| `result.total_cost_usd` / `usage` | ✅(부분) | Phase 3 | `usage` 만 매핑, cost 는 별도 결정 |
| `options.permissionMode` / `canUseTool` | ⏳ | Phase 4 (OQ9) | 도구 권한 정책 미정 |
| `options.hooks` (PreToolUse / PostToolUse / Stop) | ⏳ | Phase 4 | 도구 호출 감사 |
| `createSdkMcpServer` + `tool()` | ⏳ | Phase 4+ | in-process MCP 서버(별건) |
| `options.mcpServers` | ✅ | MCP&Skill 통합 레이어 | 정규 소스(`mcp.json`) → `toClaudeConfig` → 활성 서버 주입. `allowedTools`=`mcp__<name>__*` |
| `options.plugins` + `options.skills` | ✅ | MCP&Skill 통합 레이어 | `~/.config/orca` 디렉토리 *자체*를 로컬 플러그인으로 머티리얼라이즈(`.claude-plugin/plugin.json` + `skills/`·`agents/`·`commands/`) → `plugins:[{local, path: ~/.config/orca}]` + `skills:'all'` |
| `prompt: AsyncIterable<SDKUserMessage>` | ⏳ | Phase 4 | 다중 이미지 / 실시간 중단 |
| `forkSession` / `listSessions` / `loadSession` | ⏳ | Phase 3+/4 | 과거 대화 / 멀티 세션 anchor (§6 의 로컬 DB 가 진실의 기준이 되므로 SDK 메서드는 *동기화 소스* 로만) |

자세한 SDK API 시그니처는 [`docs/spec/claude/agent-sdk/typescript.md`](./spec/claude/agent-sdk/typescript.md) (SSOT).

### 4.7 Adapter 책임 확장 (Future anchor)

opencode 등 다중 어댑터 환경 대비:

| 책임 | 현재 (claude-code 전용) | Future 인터페이스 |
|---|---|---|
| Skills 스캔 경로 | `skills/scan.ts` 에 `~/.claude/skills/` + `<cwd>/.claude/skills/` 하드코딩 | `SessionAdapter.getSkillPaths(cwd): string[]` 인터페이스로 책임 이관 — §7 참조 |
| 자격증명 키 이름 | 없음 (SDK 가 `~/.claude` 자동 사용) | 각 어댑터가 `getCredentialKeys(): string[]` 등으로 base URL / API key 키 이름 정의 — §8 참조 |
| 외부 세션 저장소 → Orca DB 동기화 | 없음 (현재 SDK 의 jsonl 을 직접 읽지 않음) | `listSessions / loadSession` 옵셔널 메서드로 외부 jsonl/SQLite 등을 Orca 로컬 DB 로 단방향 동기화 — §6 참조 |
| 설치 / binary 해소 | SDK `optionalDependencies` 가 자동 처리 → `install()` 즉시 `done: true` 반환 | opencode 등은 별도 install 스크립트 필요 |

### 4.8 새 백엔드 추가 체크리스트

1. `src/main/adapters/<id>.ts` 생성
2. `SessionAdapter` 인터페이스 구현 + `normalize()` (해당 SDK/CLI 의 이벤트 → ChatEvent)
3. `adapters/registry.ts` 에 등록
4. `Backend` union 에 ID 추가 (`src/shared/ipc.ts`)
5. (Future) 어댑터별 Skills 스캔 경로 / 자격증명 키 / 세션 동기화 메서드 정의
6. 설치가 필요하면 `install()` AsyncIterable 구현, 인스톨러 UI 안내 추가
7. preload 의 `backend:select` 채널 재노출 (현재 미노출)
8. 통합 테스트 추가

---

## 5. 동시성 모델

### 5.1 현재 상태 (Phase 3)

- **단일 inflight**: `ChatState.inflight: boolean` — 한 시점에 한 요청만.
- `chat:send` invoke → `CapabilityBuilder.build()` → 어댑터의 `sendMessage` AsyncIterable 소비 → 각 ChatEvent 를 `webContents.send('orca:chat:event', ...)` 로 발행.
- `chat:cancel` invoke → 해당 sessionId 의 `AbortController.abort()` → SDK `query()` 중단.

**InflightTurn 상태 머신** (`ipc/router.ts` 내부): 새 채팅에서 `init` 이벤트 도착 전까지 user 메시지를 in-memory 에 보관하는 상태 머신.

| 상태 | 동작 |
|---|---|
| 새 채팅 시작 (`sessionId: null`) | `pendingUserText` 에 user 메시지 보관. DB insert 보류. |
| `init` 이벤트 도착 | `db.insertSession()` + `db.appendMessage(pendingUserText)` → `pendingUserText = null` (중복 방지) |
| resume 경로 (`sessionId !== null`) | `init` 이전에 user 메시지를 즉시 `db.appendMessage()`. pendingUserText 없음. |
| `assistant_message` 이벤트 | `db.appendMessage()` + `updateSessionPreview()` (`last_message_preview` / `updated_at`) |
| `result` 이벤트 | InflightTurn 클리어. renderer 에 `inflight = false` 전달. |

### 5.2 Phase 4 멀티세션 anchor

- 각 세션이 독립된 `AbortController` 보유
- 요청별 상태는 `requestRegistry: Map<sessionId, RequestState>` 로 추적 (도입 예정)
- 세션 종료/삭제 시 해당 세션의 모든 진행 중 요청 취소
- 동시 요청 수 제한: **없음** (사용자 결정 시 변경 가능)

### 5.3 Rate Limit / 재시도

- SDK 가 내부적으로 처리. Orca 어댑터 레벨의 재시도 로직은 **없음**.
- 사용자에게 보여줄 에러: `error / sdk.crashed` 또는 `error / internal` (recoverable: true 표기).

---

## 6. 데이터 영속성 — 2 계층 모델 (사용자 결정)

### 6.1 현재 상태 (Phase 3++)

| 항목 | 위치 | 상태 |
|---|---|---|
| **electron-store** (`settings/store.ts`) | `~/Library/Application Support/orca-settings/...` (OS별 userData) | ✅ 완료 (9 키 — §6.2) |
| **로컬 SQLite DB** (`db/`) | `<userData>/orca.db` (better-sqlite3, WAL + foreign_keys) | ✅ Phase 3 완료 |
| **FTS5 전문 검색** | `messages_fts` 가상 테이블 (3 트리거로 `messages` 와 동기 유지) | ✅ Phase 3++ 완료 |
| **MCP 인증 비밀** | `orca-secrets` (electron-store) + safeStorage 암호화 | ✅ Phase 3++ 완료 |
| **첨부 / 산출물 디렉토리** | — | ❌ 미구현 (Future) |

### 6.2 electron-store 의 9 키 카탈로그

`app/src/main/settings/store.ts` + `src/shared/ipc.ts` 의 `Settings` 타입:

| 키 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `theme` | `'classic' \| 'dark' \| 'cool'` | `'classic'` | Tweaks 테마 |
| `density` | `'compact' \| 'normal' \| 'comfortable'` | `'normal'` | Tweaks 밀도 |
| `sidebarCollapsed` | `boolean` | `false` | Sidebar 펼침 상태 |
| `sidebarWidth` | `number` | `248` | Sidebar 너비 (180–480, Phase 3+) |
| `lastBackend` | `Backend \| null` | `null` | 직전 활성 백엔드 (재시작 시 복원) |
| `lastSessionId` | `string \| null` | `null` | 재시작 후 세션 재개 |
| `windowBounds` | `{x, y, width, height} \| null` | `null` | BrowserWindow 위치·크기 복원 |
| `mcpEnabled` | `Record<string, boolean>` | `{}` | MCP 서버 on/off (키=name, 부재⇒true). mcp.json 정의와 분리. |
| `mcpMeta` | `Record<string, { description: string }>` | `{}` | MCP Orca 전용 메타 (순정 Claude 스키마 오염 방지). |

**검증 전략**:
- Read: `SettingsSchema.safeParse()` → 실패 시 `{}` fallback (깨진 디스크 데이터 복원)
- Write: `SettingsPatchSchema.parse()` → 병합 → `SettingsSchema.parse()`

### 6.3 로컬 DB (Phase 3 도입 완료)

> **선택 이유**: better-sqlite3 — 동기 API (Main thread 직접 실행, worker thread 불필요), Electron 호환, 마이그레이션 자체 관리 용이 (Drizzle/Prisma ORM 의존 없이 SQL 파일 직접 관리).

#### 현재 스키마 (3 마이그레이션)

| 마이그레이션 | 내용 |
|---|---|
| `0001_initial.sql` | `sessions` + `messages` + `tool_calls` 테이블. WAL + foreign_keys pragma 설정. |
| `0002_projects.sql` | `projects` 테이블 + `sessions.project_id` FK (`ON DELETE SET NULL`). |
| `0003_messages_fts.sql` | `messages_fts` FTS5 가상 테이블 + INSERT/UPDATE/DELETE 3 트리거 (`messages` 와 동기 유지) + 기존 행 백필. |

**마이그레이션 규칙**:
- `src/main/db/migrations/NNN_<name>.sql` (NNN = 0으로 패딩된 일련번호)
- 한 번 머지된 마이그레이션은 절대 수정하지 않는다 (스키마 변경은 새 마이그레이션으로)
- 앱 시작 시 `db/migrate.ts` 가 자동 실행. `schema_version` 테이블로 실행 이력 추적.

#### 저장 대상 (현재 구현)

| 테이블 | 저장 내용 |
|---|---|
| `sessions` | sessionId, title, backend, projectId, createdAt, updatedAt, lastMessagePreview |
| `messages` | sessionId FK, role, content(text), createdAt, metadata(JSON) |
| `tool_calls` | messageId FK, toolUseId, name, input, output, isError, durationMs |
| `projects` | id, name, instructions, createdAt, updatedAt |
| `messages_fts` | FTS5 가상 테이블 (content + sessionId 인덱싱. rank 정렬. `toFtsMatch` 가 토큰마다 `*` wildcard 부착.) |

#### FTS5 검색

`db/queries.ts` 의 `toFtsMatch(q)` — 공백으로 토큰 분리 후 모든 토큰에 prefix wildcard `*` 부착 (예: `진행 중` → `"진행"* "중"*`). 결과는 FTS5 rank 정렬, LIMIT 적용.

#### 6.4 계층 2 — 파일 시스템 (Future)

| 저장 대상 | 경로 패턴 |
|---|---|
| 큰 산출물 (첨부 파일, 모델 생성 md / 코드 / 이미지) | `<userData>/artifacts/<sessionId>/<uuid>.<ext>` |

- `app.getPath('userData')` 기준
- DB 에는 경로·해시·크기만 저장 (Blob 직접 저장 금지)
- 메시지/세션 삭제 시 DB CASCADE + 후처리로 파일 삭제 (GC 전략 — 신규 OQ)

#### 어댑터 외부 저장과의 관계

- 어댑터별 외부 저장 (claude-code 의 `~/.claude/projects/<cwd>/<sessionId>.jsonl` 등) 은 **단방향 동기화 소스** 로만 취급.
- **Orca 로컬 DB 가 진실의 기준** — IPC 이벤트 흐름 (`InflightTurn` 상태 머신, §5.1) 을 통해 DB 에 실시간 persist. 외부 jsonl 직접 읽기 없음.

#### 백업 전략

- DB 파일 1개 + `<userData>/artifacts/` 디렉토리 = 단일 export/import 단위
- export 형식: TBD (zip / tar.gz / DB dump)

---

## 7. 파일 및 리소스

### 7.1 Skills 스캔 (현재)

`app/src/main/skills/scan.ts`:

| 항목 | 값 |
|---|---|
| 스캔 경로 | `~/.claude/skills/<name>/SKILL.md` + `<cwd>/.claude/skills/<name>/SKILL.md` |
| 파서 | frontmatter 정규식 (`^---\s*\n...\n---`) |
| 인식 키 | `name`, `description`, `argument-hint` |
| 캐싱 | 부팅 시 1회 스캔 → `skillsCache` (`router.ts`) |
| 핫리로드 | ❌ 없음 (재시작 필요) |

> **⚠️ 현재 경로는 claude-code 어댑터 전용** (`~/.claude/...` 은 Claude Code 의 표준 경로). 다른 어댑터 (opencode 등) 도 지원하면 스캔 경로 분리 필요 — 사용자 결정.

**`skills/plugin-bundle.ts`** — `ensureOrcaPlugin()`:
- `~/.config/orca/.claude-plugin/plugin.json` 을 생성하여 Orca config 디렉토리 자체를 **Claude 로컬 플러그인**으로 마테리얼라이즈.
- `adaptSkills()` (§4.3) 이 `plugins:[{type:'local', path:~/.config/orca}]` + `skills:'all'` 로 로드하면 `skills/`, `agents/`, `commands/` 가 자동 로드됨.
- `mcp.json` 은 플러그인 로더가 무시 → MCP 는 `options.mcpServers` 로 별도 주입 (이중 주입 없음).

### 7.2 어댑터별 Skills 경로 분리 (Future 채택 결정)

- 현재 `skills/scan.ts` 의 하드코딩을 `SessionAdapter.getSkillPaths(cwd): string[]` 인터페이스로 책임 이관.
- 어댑터별 스캔 경로 예시 (도입 시):

| Backend | 예상 경로 |
|---|---|
| `claude-code` | `~/.claude/skills/` + `<cwd>/.claude/skills/` (현재) |
| `opencode` | `~/.config/opencode/skills/` (TBD — opencode 공식 경로 확인 필요) |

- IPC `orca:skills:list` 의 응답은 활성 어댑터의 경로만 반영 (또는 모든 등록된 어댑터의 경로 통합 — 결정 필요).

### 7.3 Artifacts 디렉토리 (Phase 3+ 도입)

- 경로: `<userData>/artifacts/<sessionId>/<uuid>.<ext>`
- GC 전략: 세션 삭제 시 디렉토리째 제거 + DB CASCADE
- 동기화 안 됨 (로컬 only). 클라우드 백업은 export/import 단위로만.

### 7.4 로그

- 위치 / 라이브러리: **TBD**.
- 후보: `<userData>/logs/main.log` + `<userData>/logs/renderer.log`, electron-log 등.
- 일자별 로테이션 / 크기 제한 정책: TBD.

---

## 8. 보안 경계 / 자격증명

### 8.1 BrowserWindow webPreferences (실제 값)

`app/src/main/index.ts` 의 명시 값 (줄 21-23):

```typescript
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,    // ✅ 필수
    nodeIntegration: false,    // ✅ 필수
    sandbox: true,             // ✅ 필수
    preload: join(__dirname, '../preload/index.js')
  }
})
```

기타 보안 옵션:
- `webSecurity: true` (기본값 유지 — CORS, 외부 리소스 제한)
- `autoHideMenuBar: true`

### 8.2 Renderer 가 절대 접근할 수 없는 자원

- ❌ Node.js API (fs, path, child_process 등)
- ❌ Electron Main 모듈
- ❌ 원본 자격증명 / API 키
- ❌ DB 파일 직접 접근 (Phase 3+ 도입 후)

→ 모든 접근은 IPC 채널을 통해서만 가능하며, 채널은 [IPC_CONTRACT.md](./IPC_CONTRACT.md) 에 정의된 것만 사용한다.

### 8.3 현재 자격증명 (Phase 2)

- 앱은 비밀을 디스크에 저장하지 않는다.
- claude-code SDK 가 `~/.claude` 디렉토리의 자격증명 (OAuth / API key) 을 자동 사용.
- 디스크 암호화는 OS 에 위임.

### 8.4 채택된 자격증명 모델 (Phase 3+ 도입 결정)

> **사용자 결정**: 어댑터별 base URL + API key 직접 저장 필요 (custom 백엔드 / 호스트 선택 지원). SDK 자격증명 위임 단독 의존 폐기.

| 항목 | 채택 결정 |
|---|---|
| 저장 메커니즘 | **Electron safeStorage** (OS keychain — macOS Keychain / Windows DPAPI / Linux libsecret) |
| 저장 대상 | 어댑터별 base URL + API key (+ 필요 시 추가 키) |
| 저장 위치 | **TBD (신규 OQ)** — 로컬 DB 의 `credentials` 테이블 (암호화 blob) vs electron-store + safeStorage 조합 |
| 입력 UI | EngineSettings 화면 (FRONTEND §8) |
| 로그 / 에러 메시지 노출 | **절대 금지** — 마스킹 의무 |
| Linux 추가 의존성 | libsecret 필요 (배포 시 의존성 명시) |

> **첫 실사용처 (MCP 서버 설정)**: 전역 MCP 서버 설정의 인증값(stdio API 키 / http Bearer 토큰)이 본 모델의 첫 구현이다. **저장 위치는 electron-store(`orca-secrets`) + safeStorage 조합**. 복호화는 query 직전 resolver 안에서만 수행(메모리 단기 체류). `isEncryptionAvailable()` 이 false 면 저장을 거부(에러). EngineSettings 의 어댑터별 base URL/API key 는 동일 패턴을 따른다(후속).
>
> **MCP & Skill 통합 레이어 (파일-백드 모델로 재설계)**: 초기 구현은 `orca-mcp` 스토어에 풍부한 per-server 레코드(authEnc 포함)를 담았으나, 이후 **정규 소스 = `~/.config/orca/mcp.json`** (순정 Claude `mcpServers` 스키마 + `${VAR}` 플레이스홀더) 로 이전했다. 3출처 분할:
> - **소스** (`mcp.json`, `~/.config/orca`): 정의의 진실. 순정 Claude 스키마만 — Claude Code 로 그대로 복사 가능. `${VAR}` 만 있고 **평문 비밀 0**. atomic write(temp+rename).
> - **비밀** (`secret-store`, `orca-secrets` + safeStorage): **env-var 이름**으로 키잉(서버 id 아님) → 여러 서버가 같은 `${TOKEN}` 공유. mcp.json 엔 `${VAR}` 만, 실제 값은 여기에만.
> - **enabled / description** (settings `mcpEnabled` / `mcpMeta`): per-install UI 상태 + Claude 스키마에 없는 Orca 메타. 정의(mcp.json) 와 분리(D2).
>
> **`${VAR}` resolver 순서 = safeStorage(비밀) → process.env (2단계)**. 미해결 변수가 있으면 해당 **서버를 드롭 + 사유 기록**(`console.warn`) — 조용한 빈 문자열 치환 금지(인증 없는 요청 누출 방지).
>
> **타입 모델**: 정규 컬렉션 타입은 `OrcaMcpConfig`(claude-code 스펙). Claude 형식은 이와 동일하므로 **별칭** `type ClaudeMcpConfig = OrcaMcpConfig` 로 못박는다. 단일 항목 타입 `ClaudeMcp` 의 http/sse 는 분리된 판별 멤버라 SDK `McpServerConfig`(stdio|http|sse) 유니온에 그대로 대입된다. **"IR(중간형)" 표현은 쓰지 않는다** — 정규형이 곧 claude-code 스펙.
>
> **양 백엔드 대칭 변환 파이프라인** (`src/main/mcp/`): `expandEnv`(순수) → `toClaudeConfig` / `toOpencodeConfig`(순수, **동형 시그니처** — 둘 다 `to<Backend>Config(servers, resolve) → { config: <Backend>McpConfig; dropped }`). `OrcaMcpConfig == ClaudeMcpConfig` 이므로 `toClaudeConfig` 는 **구조적으로 항등**(${VAR} 확장만) — "변환 불필요 특례"로 두지 않고 어댑터 경계에서 값이 `ClaudeMcpConfig` 라는 이름으로 다뤄지는 명시적 지점으로 존재한다. SDK 가 sse 트랜스포트를 지원하므로 sse→http 강제는 하지 않는다. `allowedTools` 는 config 에 넣지 않고 호출부(`buildQueryOptions`)에서 `Object.keys` 로 파생. opencode 변환기는 순수 함수 + 단위 테스트만 존재(어댑터·라이프사이클·백엔드 선택 미구현, `Backend`=`'claude-code'` 유지).
>
> **비밀 누출 불변식**: `writeMcpFile` 은 *미확장 정규 소스*(`OrcaMcpConfig`, `${VAR}`)만 받는다(타입 강제). `expandEnv` 의 확장 결과(평문)는 SDK 주입 타깃(`toClaudeConfig`/`toOpencodeConfig` 출력)으로만 흐르고 절대 파일에 기록되지 않는다.
>
> **확장 정규 레이어 (정규 소스 + 어댑터 머티리얼라이저)**: MCP 의 `정규소스→변환기→주입` 패턴을 확장(skill/agent/command) 전반으로 일반화한다. 백엔드-중립 정규 소스를 `~/.config/orca` 한 곳에 두고, 각 어댑터가 실행 시 자기 백엔드 형식으로 *머티리얼라이즈(주입)* 한다.
>
> - **정규 소스**(백엔드 중립): `~/.config/orca/{skills/<name>/SKILL.md, agents/<name>.md, commands/<name>.md}` + `mcp.json`. 비밀은 secret-store(safeStorage)에만.
> - **Claude 어댑터 머티리얼라이즈**(인프로세스 `query()`): `ensureOrcaPlugin()` 이 `~/.config/orca` 에 `.claude-plugin/plugin.json` 을 생성 → **디렉토리 자체가 Claude 로컬 플러그인**이 된다. `plugins:[{type:'local', path: ~/.config/orca}]` + `skills:'all'` 로 로드(같은 플러그인이라 agents/·commands/ 도 자동 로드). `mcp.json`(점 없음)은 플러그인 로더가 무시 → MCP 는 `options.mcpServers` 로 별도 주입(이중 주입 없음).
> - **opencode 어댑터 머티리얼라이즈**(future anchor, 미구현): `opencode serve` + config-on-disk 모델이라 query 주입 불가 — `toOpencodeConfig(mcp.json)` 를 `opencode.json` `mcp` 키로 쓰고, skills 는 opencode 가 네이티브 글로빙하는 경로로 심링크/복사, agents/commands 는 변환기로 `~/.config/opencode/{agent,command}` 에 셰이핑.
>
> **이식성 경계 (= 변환 가능성)**: **Skill(`SKILL.md`)** 은 변환 없이 양 백엔드 공통(opencode 가 `.claude/skills`·`~/.claude/skills` 네이티브 글로빙). **MCP/Agent/Command** 는 변환 가능(MCP 는 구현됨, agent/command 변환기는 anchor). **Hook·full-plugin 번들** 은 본질적으로 백엔드 종속(Claude=선언형 `hooks.json`+shell·manifest 디렉토리 / opencode=TS 코드 모듈; SDK 도 Claude=인프로세스 vs opencode=`serve` HTTP) → 정규화 대상이 아니며 향후 백엔드별 슬롯으로 둔다. `skill-creator` 같은 full Claude 플러그인은 정규 모델에 포함하지 않는다(필요 시 `SKILL.md` 만 `skills/` 로 추출).
>
> **마이그레이션**: 레거시 `orca-mcp` 레코드 → 파일 모델 1회 이전(부팅 시, `mcp.json` 부재 시에만). 레거시 authEnc 복호화 → secret-store 재저장, enabled → settings. safeStorage 잠김 시 비밀 없이 이전(재입력 필요 로그) — 평문/빈 플레이스홀더 금지. 레거시 스토어는 한 릴리스 보존(롤백 안전망).

### 8.5 외부 콘텐츠 처리

- 마크다운 렌더링: react-markdown 기본값 (raw HTML 비활성). 이미지는 data-uri 만 허용.
- 외부 링크: `shell.openExternal` 경유, 절대 `webContents` 에서 직접 열지 않음.
- `will-navigate` / `setWindowOpenHandler` 에서 외부 URL 모두 거부.
- DevTools 자동 오픈: dev 빌드 (`process.env.NODE_ENV !== 'production'`) 한정.

### 8.6 CSP

`src/renderer/index.html`:
```
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com
```

— Google Fonts CDN 허용. 그 외 외부 도메인 금지.

---

## 9. IPC 핸들러 구조

### 9.1 등록 패턴

`app/src/main/ipc/router.ts`:

```typescript
ipcMain.handle('orca:chat:send', async (event, req) => {
  const validated = SendChatMessageSchema.parse(req)  // zod 검증
  const caps = capabilityBuilder.build(validated.sessionId, validated.projectId)
  const resolvedMcp = mcpStore.buildQueryOptions()
  const adapter = registry.getActive()
  const turn = new InflightTurn(validated)
  for await (const ev of adapter.sendMessage(validated.sessionId, validated.text, cwd, caps, resolvedMcp, abortCtrl.signal)) {
    turn.persist(ev, db)           // InflightTurn 상태 머신 (§5.1)
    event.sender.send('orca:chat:event', ev)
  }
})
```

- **총 31 채널** (IPC_CONTRACT §2): `ipcMain.handle` invoke + `webContents.send` push. 도메인 12개 (chat · backend · install · settings · skills · files · session · project · window · search · mcp · runtime).
- 모든 invoke 는 zod 스키마 (`app/src/shared/protocol.ts`) 로 페이로드 검증.

### 9.2 명명 규칙

[IPC_CONTRACT.md](./IPC_CONTRACT.md) §1 참조. `orca:<domain>:<action>`.

### 9.3 에러 처리

- 모든 핸들러는 try/catch
- 에러는 직렬화 가능한 형태로 변환: `{ code: ErrorCode, message: string, recoverable: boolean }` ([IPC_CONTRACT.md](./IPC_CONTRACT.md) §4)
- 민감 정보 (자격증명 / 파일 전체 경로 등) 는 마스킹 의무

---

## 10. 시스템 통합

### 10.1 자동 업데이트

- **PRD OQ3 미정** — electron-updater 채택 미확정.
- 빌드 채널 (stable / beta) / 업데이트 확인 주기 / 사용자 확인 정책 모두 TBD.

### 10.2 로깅

- **라이브러리 TBD** (§7.4 참조). 후보: electron-log.
- 레벨: error / warn / info / debug (도입 시).
- 프로덕션 기본: info. 사용자 설정으로 debug 활성화 가능.
- 크래시 리포팅: PRD OQ4 미정 (Sentry 등).

### 10.3 플랫폼 차이

| 항목 | macOS | Windows | Linux |
|---|---|---|---|
| safeStorage 가용성 (Phase 3+) | Keychain | DPAPI | libsecret (추가 의존성) |
| 단축키 modifier | Cmd | Ctrl | Ctrl |
| 메뉴 위치 | 시스템 상단바 | 윈도우 내부 | 윈도우 내부 |
| userData 경로 | `~/Library/Application Support/orca/` | `%APPDATA%/orca/` | `~/.config/orca/` |

---

## 11. 현재 구현 상태

| 영역 | Phase | 상태 | 비고 |
|---|---|---|---|
| BrowserWindow + 보안 옵션 명시 | Phase 1 | ✅ 완료 | `main/index.ts` |
| IpcRouter + 31 채널 등록 | Phase 3++ | ✅ 완료 | `ipc/router.ts` (IPC_CONTRACT §2) |
| 모든 invoke 의 zod 검증 | Phase 2 | ✅ 완료 | `shared/protocol.ts` |
| SessionAdapter 인터페이스 | Phase 2 | ✅ 완료 | `adapters/types.ts` |
| ClaudeCodeAdapter (SDK `query()`) | Phase 3 | ✅ 완료 | CLI spawn 폐기 (2026-05-18) |
| `claude-adapt.ts` (Capability → claude 옵션 변환) | Phase 3++ | ✅ 완료 | adaptMcp / adaptSystemPrompt / adaptSkills / adaptHooks |
| `capabilities/` CapabilityBuilder | Phase 3++ | ✅ 완료 | DB/McpStore/Skills 읽어 OrcaCapabilities 조립 |
| InflightTurn 상태 머신 | Phase 3 | ✅ 완료 | 새 채팅 user 메시지 in-memory 보관 → init 도착 시 DB insert |
| OpencodeAdapter | Future | ❌ 미구현 | PRD OQ7 |
| AdapterRegistry | Phase 2 | ✅ 완료 | claude-code 단일 등록 |
| Installer (래퍼) | Phase 2 | ✅ 완료 | 4줄 — 어댑터의 `install()` yield |
| electron-store (9 키) | Phase 3++ | ✅ 완료 | `settings/store.ts` — sidebarWidth / mcpEnabled / mcpMeta 추가 |
| Skills 스캔 (`~/.claude/skills` + cwd) | Phase 2 | ✅ 완료 | claude-code 전용 — 어댑터별 분리는 Future |
| `ensureOrcaPlugin()` / plugin-bundle | Phase 3++ | ✅ 완료 | `~/.config/orca` 를 Claude 로컬 플러그인으로 마테리얼라이즈 |
| 인증 만료 감지 (`auth.expired`) | Phase 2 | ✅ 완료 | UI 에 AuthExpiredModal 노출 |
| 로컬 DB (sessions / messages / projects / tool_calls) | Phase 3 | ✅ 완료 | better-sqlite3 + 3 마이그레이션. `db/` 디렉토리. |
| FTS5 전문 검색 (`messages_fts`) | Phase 3++ | ✅ 완료 | `0003_messages_fts.sql` + `orca:search:messages` IPC |
| MCP 서버 CRUD + safeStorage 인증 비밀 | Phase 3++ | ✅ 완료 | `mcp/store.ts` + `config/secret-store.ts`. 파일-백드 모델. |
| Python uv 런타임 (`runtime/`) | Phase 3++ | ✅ 완료 | PythonRuntime.ensure() + `orca:runtime:*` 3채널 |
| Artifacts 디렉토리 (큰 산출물) | Future | ❌ 미구현 | §6.4 |
| 자동 업데이트 | Future | ❌ 미구현 | PRD OQ3 |
| 로깅 라이브러리 | TBD | ❌ 미구현 | electron-log 후보 |
| `options.permissionMode` (도구 권한) | Phase 4 | ❌ 미구현 | PRD OQ9 |
| `options.hooks` 완전 구현 (도구 감사 외부 핸들러) | Phase 4 | ❌ 미구현 | 현재 인프로세스 OrcaHookSet 은 구현됨 |
| 멀티세션 (`requestRegistry: Map`) | Phase 4 | ❌ 미구현 | FRONTEND §5 와 함께 |
| Zustand persist 전략 (renderer store ↔ 로컬 DB / electron-store) | Phase 4 | ❌ 미정 OQ | FRONTEND §4.4.6 |
| i18n (`src/shared/i18n/ko.ts`) | Future | ❌ 미구현 | 현재 인라인 한국어 |
| **Provider Runtime Model (정규화 계층)** | Future | 📐 설계 확정 / 구현 대기 | §12 — NormalizedEvent · PermissionBridge · AppCommandPolicy · SessionCapability · RevertManager · ErrorClassifier · Telemetry · AuthStore · AuditLog. SDK 타입 확정(§12.12) 후 착수 |

> 이 표는 코드 변경 시 함께 갱신한다.

---

## 12. Provider Runtime Model — 범용 정규화 계층 (설계 확정 / 구현 대기)

> **상태**: 📐 *설계 확정 · 구현 대기*. 본 절은 **인터페이스/설계만** 정의하며 현재 코드 동작을 바꾸지 않는다 (코드 변경 0). 여기 정의한 타입은 **정본(SSOT)** 이며, FRONTEND_ARCHITECTURE 의 렌더링/UX 절은 이 타입들을 *참조만* 한다(중복 정의 금지).
>
> **출처 신뢰 원칙**: 각 사실 옆에 `[검증]`(SDK 1차 출처/현재 코드에서 확인됨) / `[미확인]`(구현 전 실제 SDK 타입에서 직접 확정 필요)을 표기한다. **현재 `@anthropic-ai/claude-agent-sdk` 와 OpenCode SDK 가 `node_modules` 에 미설치**라 다수 항목이 `[미확인]` 이다 — §12.12 의 확정 절차를 거친 뒤 구현에 들어간다.
>
> **rename 범위 밖**: 실제 코드 심볼(`ChatEvent`·`SessionAdapter`·`makeCanUseTool` 등)은 이번 라운드에서 변경하지 않는다. 본 절의 *목표 타입명*(`NormalizedEvent` 등)과 현행 코드명의 대응은 §12.11 매핑표로만 둔다.

### 12.0 왜 — 현재 결합의 3가지 괴리

Phase 3++ 구현은 claude-code SDK 에 강하게 결합돼 있어, 범용(OpenCode + Claude) 런타임 모델과 어긋난다. 핵심 명제: **이 앱은 "툴 이름 매핑" 앱이 아니라, 서로 다른 SDK 런타임을 공통 이벤트·세션·권한·직접 호출 모델로 정규화하는 앱이다.**

| 괴리 | 현재 코드 | 목표 |
|---|---|---|
| 이벤트가 provider-specific | `ChatEvent`(`src/shared/ipc.ts`, 9종) 가 Claude SDK 메시지 모양. `sessionId`/`provider`/`toolRunId` 정규화 축 없음 | `NormalizedEvent` (§12.1) + `permission.requested` 1급 이벤트 |
| 일반 권한 승인 UX 부재 | `makeCanUseTool`(`src/main/adapters/claude-code.ts`) 가 `AskUserQuestion`/`ExitPlanMode` 만 surface, **그 외 모든 tool 을 무조건 allow** | PermissionBridge + ApprovalResolution 2분기 (§12.2) |
| capability/revert/app-command/telemetry/audit/error 계층 부재 | 없음 | §12.3 ~ §12.10 |

> **ADAPTER_DESIGN_REVIEW 연속성**: 본 정규화 계층은 신규 발명이 아니라 [`ADAPTER_DESIGN_REVIEW.md`](./ADAPTER_DESIGN_REVIEW.md) 의 **2계층 모델**(Tier A `OrcaCapabilities` / Tier B 얇은 `SessionAdapter`)과 **중립 이벤트 어휘 `OrcaHookEvent`**(§6.2)의 *다음 단계*다. 그 리뷰가 제안한 `sendMessage(req: TurnRequest)` 객체 시그니처는 **이미 코드에 채택됨**(§4.3) — 정규화 계층은 그 위에 `NormalizedEvent`(아웃바운드 이벤트)와 권한/세션/revert 정규화를 추가한다. `OrcaHookSet`(§4.4·ADAPTER_DESIGN_REVIEW §6.5)과 `OrcaHookDecision` 은 §12.2 의 권한 결정 흐름과 의미가 겹치며, 구현 시 단일 결정 모델로 합류 검토.

### 12.1 NormalizedEvent — provider 중립 이벤트

**① 설명.** OpenCode 는 `event.subscribe()` SSE 스트림(`event.type` + `event.properties`)을 `[검증]`, Claude 는 `query()`/`ClaudeSDKClient` 메시지 async iterator + `canUseTool` 콜백을 사용한다 `[검증]`. 이 둘을 단일 이벤트 union 으로 정규화한다. 모든 이벤트는 `sessionId` 를 갖고(멀티세션 라우팅), 권한 요청은 1급 이벤트다.

**② 예시.** "Bash 한 줄 실행" 한 턴이 현재는 `tool_use` → `tool_result` 두 `ChatEvent` 로 흐른다. 정규화 후엔 `sessionId`/`provider`/`toolRunId` 를 가진 `tool.call.started` → `tool.call.completed` 가 되어, 같은 `toolRunId` 로 start/complete 를 매칭하고 어느 provider/세션에서 왔는지 식별한다.

**③ 현재 코드 갭.** `ChatEvent`(`src/shared/ipc.ts:59-75`)는 `init` variant 만 `sessionId` 를 갖고 나머지는 단일 세션 가정. `provider` 필드 없음. tool 이벤트는 `tool_use`/`tool_result` 로 분리돼 있으나 정규 `toolRunId` 명명·origin 개념 없음.

**④ 인터페이스 (정본).**

```ts
type ProviderId = 'claude-code' | 'opencode'

type NormalizedEvent =
  | { type: 'message.delta';      sessionId: string; provider: ProviderId; messageId: string; delta: unknown }
  | { type: 'message.completed';  sessionId: string; provider: ProviderId; messageId: string; message: unknown } // [미확인] payload 모양
  | { type: 'tool.call.started';  sessionId: string; provider: ProviderId; toolRunId: string; toolName: string; args: unknown }
  | { type: 'tool.call.completed';sessionId: string; provider: ProviderId; toolRunId: string; result: unknown; isError: boolean; durationMs?: number }
  | { type: 'permission.requested'; sessionId: string; provider: ProviderId; approvalId: string; origin: 'agent' | 'app'; action: PermissionAction } // §12.2
  | { type: 'permission.resolved';  sessionId: string; provider: ProviderId; approvalId: string; resolution: ApprovalResolution }
  | { type: 'session.updated';    sessionId: string; provider: ProviderId; patch: unknown }
  | { type: 'telemetry';          sessionId: string; provider: ProviderId; usage: ProviderReportedTelemetry } // §12.7
  | { type: 'error';              sessionId?: string; provider: ProviderId; error: ClassifiedError }           // §12.5

// 한 provider 원본 1개가 N개 NormalizedEvent 로 분해될 수 있다(delta+tool 동시).
type ProviderEventMapper = { provider: ProviderId; map(raw: unknown): NormalizedEvent[] }
```

**현행 `ChatEvent`(9종) ↔ `NormalizedEvent` 전수 매핑표** `[검증: 현재 코드]`:

| 현행 `ChatEvent` | → `NormalizedEvent` | 비고 |
|---|---|---|
| `init` | `session.updated`(최초) — `sessionId`/`model`/`cwd` 주입 | 현재 sessionId 출처 |
| `assistant_delta` | `message.delta` | 스트리밍 텍스트 |
| `assistant_message` | `message.completed` | 완성본 |
| `tool_use` | `tool.call.started` | `toolUseId` → `toolRunId` |
| `tool_result` | `tool.call.completed` | `isError`/`durationMs` 보존 |
| `result` | `telemetry` | `usage` → `ProviderReportedTelemetry` (§12.7) |
| `error` | `error` | `ErrorCode` → `ClassifiedError` (§12.5) |
| `ask_question` | `permission.requested`(`origin:'agent'`) | Claude `AskUserQuestion` 의 합성 — §12.2 |
| `plan_review` | `permission.requested`(`origin:'agent'`) | Claude `ExitPlanMode` 의 합성 — §12.2 |

> `[미확인]`: OpenCode `event.type` enum 전수와 Claude 메시지 타입 전수는 `types.gen.ts` / Claude SDK 타입에서 추출해 위 매핑을 완성한다(§12.12). 현재 union 은 골격이다.

### 12.2 권한 정규화 파이프라인

#### permission.requested 는 1급 이벤트 (`origin`)

**① 설명.** 권한 요청은 반드시 `origin` 을 갖는다. `agent` = 에이전트가 tool 을 쓰려다 발생, `app` = 앱이 직접 SDK API 를 호출하려다 발생(§12.2 AppCommandPolicy).

**② 예시.** 현재 자동 allow 되는 `Bash rm -rf build/` 가 `permission.requested{origin:'agent', action:{kind:'shell', label:'rm -rf build/', risk:'high'}}` 로 surface → 렌더러 ApprovalCard(FRONTEND §7) 가 뜨고, 사용자 결정이 콜백으로 회신된다.

**③ 현재 코드 갭.** `makeCanUseTool`(`src/main/adapters/claude-code.ts`)은 `AskUserQuestion`/`ExitPlanMode` 두 도구만 `askUser`/`reviewPlan` 콜백으로 surface 하고 **그 외 전부 `{behavior:'allow'}` passthrough**. 즉 일반 tool 승인 경로가 없다. `allowedTools=mcp__<name>__*` 와일드카드(§4.3)도 같은 "차단 안 함" 전제.

**④ 인터페이스 (정본).**

```ts
type PermissionAction = { kind: string; label: string; input?: unknown; risk?: 'low' | 'medium' | 'high' }
```

- **OpenCode (agent)**: event 스트림에서 permission request 감지 → `postSessionByIdPermissionsByPermissionId({path, body})` → `boolean` 회신 `[검증]`.
- **Claude (agent)**: `canUseTool` 콜백 지점에서 합성 `permission.requested` 발행 → UI 결정 후 콜백을 `PermissionResult` 로 resolve. `canUseTool` 은 권한 평가의 마지막 단계 `[검증]`.

#### ApprovalResolution — 2분기 (4값 모델 폐기)

**① 설명.** 실제 Claude `PermissionResult` 는 **2분기**다. "modified input" 은 `allow` 의 `updatedInput` 필드, "interrupt" 는 `deny` 의 boolean. `allow` 에는 향후 자동승인 규칙을 갱신하는 `updatedPermissions` 가 있다(trust escalation 직결).

**② 예시.** (a) 사용자가 Bash 인자를 `rm -rf build/` → `rm -rf build/tmp/` 로 고쳐 승인 = `allow{updatedInput}`. (b) "이 세션 동안 Read 는 자동 허용" = `allow{updatedPermissions:[addRules…]}`. (c) "거부하고 에이전트 중단" = `deny{interrupt:true}`.

**③ 현재 코드 갭.** 현행 `AskResult`/`PlanDecision`(`src/shared/ipc.ts`)은 이 2분기의 *도메인 특수형*이다(answered/skipped, approved/rejected/revise). `makeCanUseTool` 이 Claude `PermissionResult` 를 직접 반환하지만 정규 `ApprovalResolution` 추상이 없어 OpenCode 와 공유 불가.

**④ 인터페이스 (정본).**

```ts
type ApprovalResolution =
  | { type: 'allow'; updatedInput?: unknown; updatedPermissions?: PermissionUpdate[] }
  | { type: 'deny';  message?: string; interrupt?: boolean }

// Claude TS 기준 [검증]
type PermissionUpdate =
  | { type: 'addRules' | 'replaceRules' | 'removeRules'; rules: unknown[]; behavior: 'allow' | 'deny' | 'ask'; destination?: unknown }
  | { type: 'setMode'; mode: NormalizedPermissionMode }
```

**Provider 별 downcast (OpenCode boolean 손실표)**:

| Provider | allow | deny |
|---|---|---|
| OpenCode | `body:true` — `updatedInput`/`updatedPermissions` **표현 불가, 무시(손실)** | `body:false` |
| Claude | `{behavior:'allow', updatedInput, updatedPermissions}` | `{behavior:'deny', message, interrupt}` |

> UI 는 OpenCode 세션에서 `updatedInput`/`updatedPermissions` 가 손실됨을 **명시**(provider capability 차이) — FRONTEND §7 ApprovalCard 가 배지로 표시.

#### PendingApprovalStateMachine

**① 설명.** 콜백형(Claude `canUseTool` Promise)과 이벤트형(OpenCode SSE + response endpoint) 승인을 동일 상태 모델로 처리: `requested → resolving → resolved(allow|deny)`, 이탈 분기 `timed_out`/`aborted`.

**③ 현재 코드 갭.** `src/main/ask/broker.ts` 의 `InteractionBroker<T>`(register/resolve + abort signal + default-on-cancel)가 이 상태기계의 **부분 구현**이다 — 단, ask/plan 전용. 일반 권한으로 일반화하면 그대로 PendingApprovalStateMachine 이 된다.

**④ 인터페이스 (정본).**

```ts
type PendingApprovalState = 'requested' | 'resolving' | 'resolved' | 'timed_out' | 'aborted'

interface PermissionBridge {                          // agent-originated approval 만 담당
  request(ev: Extract<NormalizedEvent, { type: 'permission.requested' }>): Promise<ApprovalResolution>
  // Claude: resolved 도달 시 canUseTool Promise 를 PermissionResult 로 resolve
  // OpenCode: resolved 도달 시 postSessionByIdPermissionsByPermissionId 호출(boolean downcast)
}
```

#### AppCommandPolicy — 3분기 (app-originated)

**① 설명.** OpenCode 는 앱이 *직접* 호출하는 상태변경/권한우회 API 를 제공한다. 이는 agent tool permission gate **바깥**이므로 앱 자체 정책이 필요하다 `[검증]`. read-only / bypass-risk / state-changing 3분기.

**② 예시.** `file.read`(무프롬프트 통과) vs `session.shell`(agent gate 밖 → 항상 승인) vs `session.revert`(상태 변경 → 승인 + audit). Claude 단독에선 대부분 무의미하나 **OpenCode 확장점**으로 필요.

**③ 현재 코드 갭.** 없음(Claude 단독이라 app-originated direct call 표면이 아직 없음). OpenCode 어댑터 도입 시 필수.

**④ 인터페이스 (정본).**

```ts
type AppCommandKind =
  | 'read_only_direct_action'      // file.read, find.text/files/symbols, file.status
  | 'bypass_risk_direct_action'    // session.shell, session.command, direct file mutation
  | 'state_changing_direct_action' // session.revert/unrevert/abort/delete/share/init

const DEFAULT_APP_COMMAND_POLICY: Record<AppCommandKind, 'pass' | 'require_approval'> = {
  read_only_direct_action: 'pass',
  bypass_risk_direct_action: 'require_approval',
  state_changing_direct_action: 'require_approval',
}
```

> `session.summarize` 의 side effect(요약을 세션에 저장하는지)는 공식 문서상 불명확 `[미확인]` → 확정 전까지 보수적으로 `state_changing` 분류.

#### PermissionModeController — 세션 중 신뢰 상향

**① 설명.** Claude 는 `setPermissionMode()`(TS)/`set_permission_mode()`(Python)로 mid-session 모드를 즉시 전환한다 `[검증]`. 모드 전수: `default | acceptEdits | plan | dontAsk | bypassPermissions | auto`(auto=TS 전용 모델 분류기).

**② 예시.** 사용자가 "계획만 보기(plan)" 로 시작했다가, 신뢰가 쌓이면 런타임에 `accept_edits` 로 올려 파일 편집 자동 수락. 이후 `allow` 시 `updatedPermissions` 로 규칙 누적.

**③ 현재 코드 갭.** 현행은 per-turn `permissionMode: 'plan' | 'acceptEdits'`(`src/shared/ipc.ts`, 2종)만 `SendChatMessage` 로 전달. **mid-session 전환 없음**. 또 현재 어댑터는 `query()` **one-off** 구조라 런타임 전환의 **선행 조건 = `ClaudeSDKClient` 전환**(동일 세션 재사용, §5 동시성과 연계).

**④ 인터페이스 (정본).**

```ts
type NormalizedPermissionMode =
  | 'default' | 'accept_edits' | 'plan' | 'dont_ask' | 'bypass' | 'auto_classified'

interface PermissionModeController {
  getCurrentMode(): NormalizedPermissionMode
  setMode(mode: NormalizedPermissionMode): Promise<void>            // Claude: setPermissionMode / OpenCode: 앱 레벨 에뮬레이션 [미확인]
}
```

| Provider | 처리 |
|---|---|
| Claude | `setPermissionMode` 런타임 전환. `auto`(TS)=모델 분류기 승인 |
| OpenCode | 동일 런타임 mode setter 가 공식 문서에 없음 → 앱 레벨 "이후 같은 종류 자동 승인" 에뮬레이션 `[미확인]` |

> **권한 평가 순서 불일치 `[부분 불확실]`**: 공식 문서에 두 서술이 병존한다 — (a) `Hooks → Deny → Mode → Allow → canUseTool`, (b) `PreToolUse Hook → Deny → Allow → Ask → Mode → canUseTool → PostToolUse Hook`. **둘 다 1차 출처이며 불일치.** 구현은 hooks 3분기(allow/deny/passthrough)·ask rules·Pre/PostToolUse hook 까지 포함한 완전 파이프라인으로 모델링하고, 대상 SDK 버전 기준으로 단일화한다(§12.12).

### 12.3 SessionCapability + CapabilityProbe

**① 설명.** provider 는 대칭이 아니다. 세션 기능을 런타임에 탐지(probe)해 `AppSession.capabilities` 에 캐시하고, UI 는 `false` 인 액션 버튼을 **사전 비활성/숨김**(사후 `capability_unsupported` 에러보다 UX 우월).

**② 예시.** OpenCode 는 `session.children`/`share`/`init`(AGENTS.md) `[검증]`, Claude 는 `continueConversation`/`resume`/`forkSession` `[검증]`. 서로 대응이 없으므로 사이드바/메뉴가 가용한 액션만 노출.

**③ 현재 코드 갭.** `SessionAdapter`(`src/main/adapters/types.ts`)는 `isInstalled`/`install`/`sendMessage`(+옵셔널 listSessions/loadSession)만 — capability 서술자 없음.

**④ 인터페이스 (정본).**

```ts
interface SessionCapabilities {
  // lifecycle
  continue?: boolean; resume?: boolean; fork?: boolean; persistSessionFalse?: boolean; delete?: boolean; update?: boolean
  // structure / control
  children?: boolean; summarize?: boolean; abort?: boolean; share?: boolean; init?: boolean
  // context
  contextInjectionNoReply?: boolean; structuredOutput?: boolean
  // revert (§12.4)
  conversationRevert?: boolean; conversationUnrevert?: boolean; fileCheckpointCreate?: boolean; fileCheckpointRestore?: boolean
}

interface CapabilityProbe {
  provider: ProviderId
  discover(): Promise<{ session: SessionCapabilities; revert: RevertCapabilities; cancellation: CancellationCapability }>
}
```

| 기능 | OpenCode | Claude Code |
|---|---|---|
| continue/resume/fork | 동일 표면 없음 `[미확인]` | `continueConversation`/`resume`/`forkSession` `[검증]` |
| children / summarize / abort / share / init | `session.*` `[검증]` | 대응 `[미확인]` |
| noReply context injection | `session.prompt({noReply:true})` `[검증]` | `[미확인]` |
| structured output | `session.prompt({format})` `[검증]` | 대응 개념 존재, 형식 `[미확인]` |

### 12.4 RevertManager — 되돌리기 의미 분리 (핵심)

**① 설명.** **conversation revert ≠ file revert. 절대 합치지 않는다.** 대화/메시지 상태 되돌리기와 파일 변경 snapshot/복원은 별개 개념·별개 capability.

**② 예시.** OpenCode `session.revert`/`unrevert` = 대화 상태 되돌리기 `[검증]`. Claude file checkpointing(실험적, `betas` 로 활성화) = 파일 snapshot/복원 `[검증]`. 한쪽만 있는 provider 에서 다른 쪽 버튼은 숨긴다.

**③ 현재 코드 갭.** 둘 다 없음.

**④ 인터페이스 (정본).**

```ts
interface RevertCapabilities {
  conversationRevert: boolean; conversationUnrevert: boolean
  fileCheckpointCreate: boolean; fileCheckpointRestore: boolean
}
interface CancellationCapability {
  sessionAbort?: boolean   // OpenCode: session.abort [검증]
  denyInterrupt?: boolean  // Claude: PermissionResultDeny.interrupt [검증]
  abortSignal?: boolean    // Claude: ToolPermissionContext.signal [미확인 — 현재 "future" 표기]
}
```

### 12.5 ErrorClassifier — 8분류 + cancellation 분리

**① 설명.** `error` 이벤트는 분류돼야 재시도/표시 정책을 결정할 수 있다. 8 category + retryable 플래그.

**③ 현재 코드 갭.** 현행은 `detectError()`(`src/main/adapters/claude-code.ts`) 휴리스틱(401/OAuth/expired 정규식 → `auth.expired`)과 `ErrorCode` enum(`sdk.*`/`cli.*`/`auth.expired`/`protocol.parse`/`internal`)뿐 — 정규 분류기/`retryable` 없음.

**④ 인터페이스 (정본).**

```ts
type ErrorCategory =
  | 'provider_connection_error'  // OpenCode 서버 다운, Claude 바이너리 부재
  | 'auth_error'                 // API key 무효/누락 (현행 auth.expired)
  | 'permission_denied'          // user deny / policy deny
  | 'tool_execution_error'       // shell exit≠0, file read 실패
  | 'stream_error'               // SSE 끊김, iterator 오류
  | 'capability_unsupported'     // 예: Claude 에 OpenCode식 find.* 없음
  | 'schema_validation_error'    // structured output 검증 실패
  | 'user_cancelled'             // abort/interrupt

interface ClassifiedError { category: ErrorCategory; message: string; retryable: boolean; provider?: ProviderId; cause?: unknown }
interface ErrorClassifier { classify(error: unknown, ctx: { provider: ProviderId; phase: string }): ClassifiedError }
```

### 12.6 정규화 Persistence — AppMessagePart

**① 설명.** 이벤트 스트림과 별개로 대화 기록을 저장·재렌더링하는 내부 모델. OpenCode 가 messages 를 `{ info: Message, parts: Part[] }[]` 로 다루는 것을 반영해 **parts** 모델을 둔다. 무거운 페이로드(stdout/파일 본문)는 별도 blob store 로 분리해 메시지 행을 가볍게 유지.

**③ 현재 코드 갭.** 현행 DB(`src/main/db/`)는 `messages.content TEXT` + `tool_calls`(input_json/result_json) 구조 — 평면 텍스트 + 별 테이블. parts union·blob 분리 없음. (마이그레이션은 "구현 대기".)

**④ 인터페이스 (정본).**

```ts
interface AppSession { id: string; provider: ProviderId; providerSessionId: string; title?: string; cwd?: string; capabilities: SessionCapabilities; createdAt: string; updatedAt: string }
interface AppMessage { id: string; sessionId: string; providerMessageId?: string; role: 'user'|'assistant'|'system'|'tool'|'context'; parts: AppMessagePart[]; createdAt: string }
type AppMessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; collapsed?: boolean }
  | { type: 'tool_call'; toolRunId: string; toolName: string; args: unknown }   // 무거운 페이로드는 blobRef 로 분리
  | { type: 'tool_result'; toolRunId: string; result: unknown }
  | { type: 'file'; path: string; readType?: 'raw' | 'patch'; content?: string }
  | { type: 'diff'; patch: string }
  | { type: 'structured_output'; value: unknown }
  | { type: 'error'; error: unknown }
```

> 구현 전략: 스트리밍 중 `tool_call` part 를 먼저 append → `tool.call.completed` 도착 시 동일 `toolRunId` 로 `tool_result` 매칭. 무거운 stdout/파일 본문은 blob 로 빼고 행엔 ref 만.

### 12.7 TelemetryService

**① 설명.** provider 가 usage/cost 를 제공하면 쓰고, 없으면 앱이 자체 집계. 2계층.

**③ 현재 코드 갭.** 현행은 `result` 이벤트의 `usage`(inputTokens/outputTokens)만 매핑(§4.4). cost·latency·app-measured 집계 없음. (렌더러 `UsageCircle` 가 inputTokens 비율만 표시 — FRONTEND §6.)

**④ 인터페이스 (정본).**

```ts
interface ProviderReportedTelemetry { provider: ProviderId; model?: string; inputTokens?: number; outputTokens?: number; costUsd?: number } // [미확인] 정확한 필드
interface AppMeasuredTelemetry { latencyMs?: number; toolDurationMs?: number; streamDurationMs?: number; eventCount?: number; bytesStreamed?: number; errorRate?: number; cancelRate?: number }
interface TelemetryService { providerReported(sessionId: string): ProviderReportedTelemetry | undefined; appMeasured(sessionId: string): AppMeasuredTelemetry }
```

### 12.8 AuthStore — 키 저장소가 아니라 주입 전략

**① 설명.** provider 별 auth 주입 지점이 다르므로 단일 "키 저장소"가 아니라 **주입 전략**으로 모델링한다. 비밀값은 OS keychain/secret store 에 두고 메모리 노출 최소화.

**③ 현재 코드 갭.** 현행은 (a) Claude SDK 가 `~/.claude` 자격증명 자동 사용(§8.3) + (b) MCP 인증 비밀만 safeStorage(§8.4) — provider-중립 주입 전략 추상 없음. §8.4 의 safeStorage 모델을 "주입 전략" 으로 재서술하면 그대로 AuthStore 의 한 갈래가 된다.

**④ 인터페이스 (정본).**

```ts
type ClaudeAuthMode =
  | { kind: 'api_key'; env: { ANTHROPIC_API_KEY: string } }
  | { kind: 'local_binary'; pathToClaudeCodeExecutable: string }  // 구독 세션 [검증]
  | { kind: 'bedrock'; region: string }
  | { kind: 'vertex'; project: string }

type AuthInjection =
  | { provider: 'opencode';        via: 'auth.set'; body: { id: string; type: 'api'; key: string } }     // 서버 API [검증]
  | { provider: 'claude-code';     via: 'process_env_or_binary'; mode: ClaudeAuthMode }
  | { provider: 'openai_compatible'; via: 'baseURL+apiKey'; baseURL: string; apiKey: string }            // OpenCode provider 경유 [검증]

interface AuthStore { resolve(provider: ProviderId): Promise<AuthInjection> }
```

### 12.9 AuditLog

**① 설명.** permission/app-command/revert/shell 실행을 기록. 입출력은 원문 대신 **해시**로 저장(민감 데이터 노출 축소). 기록은 PermissionBridge·AppCommandPolicy 결정 지점에 **hook 으로 박는다**. state-changing/bypass-risk 는 audit 누락이 곧 보안 공백이므로 기록 실패 시 액션을 막는 **fail-closed** 옵션.

**③ 현재 코드 갭.** 없음(감사 로그 미도입).

**④ 인터페이스 (정본).**

```ts
interface AuditLogEntry {
  id: string; sessionId: string; actor: 'user' | 'agent' | 'app'; provider: ProviderId
  origin: 'agent' | 'app'; action: string; risk: 'low' | 'medium' | 'high'
  decision?: ApprovalResolution; inputHash?: string; outputHash?: string; createdAt: string
}
```

### 12.10 ModelProviderConfig — 게이트웨이를 합치지 않는다

**① 설명.** 두 런타임의 모델 구조는 **비대칭**이라 앱 공통 추론 게이트웨이를 두지 않는다. provider 별 "모델 설정 표면"만 정규화해 노출하고, 추론 트래픽은 각 런타임이 처리.

**② 예시.** OpenCode 는 `opencode.json` `provider` 섹션에서 75+ provider + 임의 `baseURL` override + `@ai-sdk/openai-compatible`(LiteLLM/vLLM/Ollama/LM Studio) 등록 `[검증]`. Claude Agent SDK 는 모델이 SDK 에 결합 — `model`/`fallbackModel` + 인증 경로로만 제한 `[검증]`. 따라서 "커스텀 OpenAI-compatible provider 추가" UI 는 **OpenCode runtime 일 때만** 노출.

**③ 현재 코드 갭.** 없음(claude 고정). OpenCode 도입 시 분기.

**④ 인터페이스 (정본).**

```ts
type ModelProviderConfig =
  | { runtime: 'opencode'; providers: Array<{ id: string; npm?: string; name?: string; baseURL?: string; models: Record<string, { name?: string; limit?: { context?: number; output?: number } }> }> }
  | { runtime: 'claude-code'; model?: string; fallbackModel?: string; auth: ClaudeAuthMode }
```

### 12.11 현행명 → 목표명 매핑표 (rename 범위 밖 — 문서로만)

> 실제 코드 심볼은 이번 라운드에서 변경하지 않는다(사용자 확정). 이름 정렬은 *구조가 실제로 바뀌는 구현 PR* 로 미룬다.

| 현행 코드 심볼 | 위치 | 목표명 | 비고 |
|---|---|---|---|
| `ChatEvent` | `src/shared/ipc.ts` | `NormalizedEvent` | sessionId/provider/toolRunId 필드 추가 시 함께 rename |
| `tool_use` / `tool_result` | 〃 | `tool.call.started` / `tool.call.completed` | toolUseId→toolRunId |
| `ask_question` / `plan_review` | 〃 | `permission.requested(origin:'agent')` | 합성 |
| `AskResult` / `PlanDecision` | 〃 | `ApprovalResolution` 특수형 | 2분기로 일반화 |
| `InteractionBroker` | `src/main/ask/broker.ts` | `PermissionBridge` + `PendingApprovalStateMachine` | ask/plan → 전체 tool |
| `makeCanUseTool` | `src/main/adapters/claude-code.ts` | (PermissionBridge 어댑트) | 일반 tool 승인 경로 |
| `detectError` | 〃 | `ErrorClassifier.classify` | 8분류 |
| `permissionMode`(2종) | `src/shared/ipc.ts` | `NormalizedPermissionMode`(6종) | + 런타임 전환 |
| `usage`(result) | §4.4 | `ProviderReportedTelemetry` | + AppMeasured |

### 12.12 구현 전 SDK 타입 확정 절차 (`[미확인]` 일괄)

> **선결 제약**: 두 SDK 가 현재 미설치. 아래 항목은 실제 타입 파일을 받아 확정한 **뒤** 구현에 들어간다.

| 항목 | 확인 위치 |
|---|---|
| OpenCode `event.type` enum 전수 (§12.1 매핑 완성) | `packages/sdk/js/src/gen/types.gen.ts` |
| Claude 권한 평가 순서 단일화(hooks/ask/Pre·PostToolUse 포함) | 대상 SDK 버전 permissions 문서 |
| Claude usage/cost 노출 형식 (§12.7) | `result` 메시지 타입 |
| OpenCode usage/cost 노출 형식 | `session.message` / `Message` 타입 |
| OpenCode mode setter 부재 확정 (§12.2) | `types.gen.ts` / 서버 OpenAPI |
| Claude children/summarize/abort/share/init 대응 (§12.3) | Claude SDK 타입 |
| OpenCode file checkpoint 대응 (§12.4) | 서버 OpenAPI |
| `session.summarize` side effect (§12.2 분류) | `types.gen.ts` / 서버 동작 |
| `forkSession`/`persistSession`/`includePartialMessages` 정확한 옵션명 | Claude SDK 타입 |
| Claude `ToolPermissionContext.signal`(abort) 실사용 가능 여부 | Claude SDK 타입 (현재 "future" 표기) |
| Claude structured output 형식 (FRONTEND `StructuredOutputState` 흡수 가능?) | Claude SDK 타입 |

---

## 13. 참고

- IPC 채널 정의: [IPC_CONTRACT.md](./IPC_CONTRACT.md)
- 용어 정의: [GLOSSARY.md](./GLOSSARY.md)
- 프론트엔드 측 구조: [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)
- 데이터 모델 / 어댑터 사양 SSOT: [TRD.md](./TRD.md) §6 / §7
- 외부 SDK 사양 SSOT: [`docs/spec/claude/agent-sdk/typescript.md`](./spec/claude/agent-sdk/typescript.md)
- CLI 시기 외부 계약 + Orca 채택 표기: [claude-code-spec.md](./claude-code-spec.md)
- Phase 로드맵 / Future Scope: [PRD.md](./PRD.md) §8 / §9 / §11
- 운영 규칙: [`app/CLAUDE.md`](../app/CLAUDE.md)
