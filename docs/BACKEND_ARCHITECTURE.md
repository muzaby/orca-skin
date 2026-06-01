# Backend Architecture

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-05-20
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
| 로컬 DB | **미선정** (TBD) | — | Phase 3+ 채택 결정 (§6) — better-sqlite3 / Drizzle 등 |
| HTTP 클라이언트 | (SDK 내부) | — | 별도 채택 없음 |
| 보안 저장 (자격증명) | Electron safeStorage | (Phase 3+) | OS keychain — macOS Keychain / Windows DPAPI / Linux libsecret |
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
│   ├── ipc/router.ts           # 11 채널 등록 + zod 검증 + 디스패치
│   ├── adapters/
│   │   ├── types.ts            # SessionAdapter / Backend 공통 타입
│   │   ├── registry.ts         # AdapterRegistry — claude-code 단일 등록
│   │   └── claude-code.ts      # ClaudeCodeAdapter — SDK query() 직접 사용
│   ├── installer/index.ts      # 4줄 래퍼 — adapter.install() 의 AsyncIterable yield
│   ├── settings/store.ts       # electron-store 영속화 (6 키)
│   └── skills/scan.ts          # ~/.claude/skills + <cwd>/.claude/skills 부팅 1회 스캔
│
├── Preload (src/preload/index.ts)
│   └── contextBridge.exposeInMainWorld('orca', api) — window.orca 노출 (IPC_CONTRACT §2)
│
└── Renderer (src/renderer/) → FRONTEND_ARCHITECTURE.md 참조
```

### 3.1 부트 시퀀스 (`src/main/index.ts`)

```
1. app.whenReady()
2. router = new IpcRouter(settings)
3. router.start()                    # 11 채널 ipcMain.handle / send 등록
4. createWindow(router.settings)     # BrowserWindow + webPreferences 명시
   ├─ contextIsolation: true
   ├─ nodeIntegration: false
   ├─ sandbox: true
   └─ preload: '../preload/index.js'
5. windowBounds 복구 (settings.getAll().windowBounds 와 DEFAULT_BOUNDS merge)
6. mainWindow.on('close') → settings.patch({ windowBounds })
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

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'

async function* sendMessage(sessionId, text, cwd, signal) {
  try {
    for await (const msg of query({
      prompt: text,
      options: {
        resume: sessionId ?? undefined,
        includePartialMessages: true,
        cwd,
        // permissionMode / canUseTool / hooks: Phase 4 anchor (PRD OQ9)
      }
    })) {
      yield normalize(msg)  // SDKMessage → ChatEvent
    }
  } catch (err) {
    yield { type: 'error', data: detectError(err) }
  }
}
```

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

### 5.1 현재 상태 (Phase 1·2)

- **단일 inflight**: `ChatState.inflight: boolean` — 한 시점에 한 요청만.
- `chat:send` invoke → 어댑터의 `sendMessage` AsyncIterable 소비 → 각 ChatEvent 를 `webContents.send('orca:chat:event', ...)` 로 발행.
- `chat:cancel` invoke → 해당 sessionId 의 `AbortController.abort()` → SDK `query()` 중단.

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

### 6.1 현재 상태 (Phase 2)

| 항목 | 위치 | 상태 |
|---|---|---|
| **electron-store** (`settings/store.ts`) | `~/Library/Application Support/orca-settings/...` (OS별 userData) | ✅ 완료 |
| **자체 메시지 DB** | — | ❌ 없음 (better-sqlite3 등 미채택) |
| **채팅 이력** | claude-code SDK 가 `~/.claude/projects/<cwd>/<sessionId>.jsonl` 에 자동 저장 | ⚠️ **어댑터 외부 저장** — Orca 가 통합 관리·백업 불가능 |
| **첨부 / 산출물** | — | ❌ 없음 |

### 6.2 electron-store 의 6 키 카탈로그

`app/src/main/settings/store.ts` + `src/shared/ipc.ts:87-94`:

| 키 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `theme` | `'classic' \| 'dark' \| 'cool'` | `'classic'` | Tweaks 테마 |
| `density` | `'compact' \| 'normal' \| 'comfortable'` | `'normal'` | Tweaks 밀도 |
| `sidebarCollapsed` | `boolean` | `false` | Sidebar 펼침 상태 |
| `lastBackend` | `Backend \| null` | `null` | 직전 활성 백엔드 (재시작 시 복원) |
| `lastSessionId` | `string \| null` | `null` | 재시작 후 세션 재개 (Phase 2+) |
| `windowBounds` | `{x, y, width, height} \| null` | `null` | BrowserWindow 위치·크기 복원 |

**검증 전략**:
- Read: `SettingsSchema.safeParse()` → 실패 시 `{}` fallback (깨진 디스크 데이터 복원)
- Write: `SettingsPatchSchema.parse()` → 병합 → `SettingsSchema.parse()`

### 6.3 채택된 영속성 모델 (Phase 3+ 도입 결정)

> **사용자 결정**: 어댑터별 외부 저장 방식 (jsonl, SQLite, 클라우드 등) 이 제각각이고 Orca 가 통합 관리·백업할 수 없으므로, **Orca 자체 영속성** 을 2 계층으로 도입한다.

#### 계층 1 — 로컬 DB

| 저장 대상 | 비고 |
|---|---|
| 세션 메타데이터 | sessionId, title, backend, model, system prompt, created/updated_at |
| 메시지 본문 (텍스트) | role, content, created_at, metadata (tokens, model) |
| 첨부 메타데이터 | filename, mime_type, storage_path (계층 2 ref), size |
| 산출물 경로 | storage_path (계층 2 ref) + hash + size |
| 도구 호출 이력 | toolUseId, name, input, output, isError, durationMs |

**라이브러리 후보 (미정 — 신규 OQ)**: better-sqlite3 / Drizzle / Prisma / sql.js. 결정 기준: 동기 API, Electron 호환, 마이그레이션 도구.

**마이그레이션 규칙 (도입 시)**:
- `src/main/db/migrations/NNN_<name>.sql` (NNN = 0으로 패딩된 일련번호)
- 한 번 머지된 마이그레이션은 절대 수정하지 않는다 (스키마 변경은 새 마이그레이션으로)
- 앱 시작 시 자동 실행, `schema_version` 테이블로 추적

**FTS5 (전문 검색) 도입 여부**: 미정 (신규 OQ).

#### 계층 2 — 파일 시스템

| 저장 대상 | 경로 패턴 |
|---|---|
| 큰 산출물 (첨부 파일, 모델 생성 md / 코드 / 이미지) | `<userData>/artifacts/<sessionId>/<uuid>.<ext>` |

- `app.getPath('userData')` 기준
- DB 에는 경로·해시·크기만 저장 (Blob 직접 저장 금지)
- 메시지/세션 삭제 시 DB CASCADE + 후처리로 파일 삭제 (GC 전략 — 신규 OQ)

#### 어댑터 외부 저장과의 관계

- 어댑터별 외부 저장 (claude-code 의 `~/.claude/projects/<cwd>/<sessionId>.jsonl` 등) 은 **단방향 동기화 소스** 로만 취급.
- **Orca 로컬 DB 가 진실의 기준** — 어댑터 외부 데이터를 읽어 DB 에 반영하되, DB 변경을 어댑터로 push 하지 않는다.
- 동기화 시점: 세션 목록 로드 시 (`session:list`), 세션 상세 로드 시 (`session:load`).

#### 백업 전략

- DB 파일 1개 + `<userData>/artifacts/` 디렉토리 = 단일 export/import 단위
- export 형식: TBD (zip / tar.gz / DB dump)

### 6.4 도입 시점

- **Phase 3** (과거 대화 목록 단계) 진입 시 일괄 도입.
- 영향 받는 IPC 채널: `message:list / append / delete`, `session:list / load / delete` — 모두 [IPC_CONTRACT.md](./IPC_CONTRACT.md) §2.8 예약 채널.

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
  const adapter = registry.getActive()
  for await (const ev of adapter.sendMessage(validated.sessionId, validated.text, cwd)) {
    event.sender.send('orca:chat:event', ev)
  }
})
```

- 9 개 `ipcMain.handle` + 2 개 `webContents.send` = 11 채널 (IPC_CONTRACT §2)
- 모든 invoke 는 zod 검증 (`SendChatMessageSchema`, `CancelChatSchema`, `StartInstallSchema`, `SettingsPatchSchema`, `ListFilesRequestSchema`)

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
| BrowserWindow + 보안 옵션 명시 | Phase 1 | ✅ 완료 | `main/index.ts:21-23` |
| IpcRouter + 11 채널 등록 | Phase 2 | ✅ 완료 | `ipc/router.ts` |
| 모든 invoke 의 zod 검증 | Phase 2 | ✅ 완료 | `shared/protocol.ts` |
| SessionAdapter 인터페이스 | Phase 2 | ✅ 완료 | `adapters/types.ts` |
| ClaudeCodeAdapter (SDK `query()`) | Phase 3 | ✅ 완료 | CLI spawn 폐기 (2026-05-18) |
| OpencodeAdapter | Future | ❌ 미구현 | PRD OQ7 |
| AdapterRegistry | Phase 2 | ✅ 완료 | claude-code 단일 등록 |
| Installer (래퍼) | Phase 2 | ✅ 완료 | 4줄 — 어댑터의 `install()` yield |
| electron-store (6 키) | Phase 2+ | ✅ 완료 | `settings/store.ts` |
| Skills 스캔 (`~/.claude/skills` + cwd) | Phase 2 | ✅ 완료 | claude-code 전용 — 어댑터별 분리는 Future |
| 인증 만료 감지 (`auth.expired`) | Phase 2 | ✅ 완료 | UI 에 AuthExpiredModal 노출 |
| 로컬 DB (메시지 / 메타) | Phase 3+ | ❌ 미구현 | §6.3 채택 결정. 라이브러리·스키마·마이그레이션 도구 TBD |
| Artifacts 디렉토리 (큰 산출물) | Phase 3+ | ❌ 미구현 | §6.3 |
| safeStorage 자격증명 저장 | Phase 3+ | ❌ 미구현 | §8.4 |
| 자동 업데이트 | Future | ❌ 미구현 | PRD OQ3 |
| 로깅 라이브러리 | TBD | ❌ 미구현 | electron-log 후보 |
| `options.permissionMode` (도구 권한) | Phase 4 | ❌ 미구현 | PRD OQ9 |
| `options.hooks` (도구 감사) | Phase 4 | ❌ 미구현 | — |
| `mcpServers` / `createSdkMcpServer` | Phase 4+ | ❌ 미구현 | — |
| 멀티세션 (`requestRegistry: Map`) | Phase 4 | ❌ 미구현 | FRONTEND §5 와 함께 |
| Zustand persist 전략 (renderer store ↔ 로컬 DB / electron-store) | Phase 4 | ❌ 미정 OQ | FRONTEND §4.4.6 — middleware vs custom subscribe, storage 어댑터 선택 |
| i18n (`src/shared/i18n/ko.ts`) | Future | ❌ 미구현 | 현재 인라인 한국어 |

> 이 표는 코드 변경 시 함께 갱신한다.

---

## 12. 참고

- IPC 채널 정의: [IPC_CONTRACT.md](./IPC_CONTRACT.md)
- 용어 정의: [GLOSSARY.md](./GLOSSARY.md)
- 프론트엔드 측 구조: [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)
- 데이터 모델 / 어댑터 사양 SSOT: [TRD.md](./TRD.md) §6 / §7
- 외부 SDK 사양 SSOT: [`docs/spec/claude/agent-sdk/typescript.md`](./spec/claude/agent-sdk/typescript.md)
- CLI 시기 외부 계약 + Orca 채택 표기: [claude-code-spec.md](./claude-code-spec.md)
- Phase 로드맵 / Future Scope: [PRD.md](./PRD.md) §8 / §9 / §11
- 운영 규칙: [`app/CLAUDE.md`](../app/CLAUDE.md)
