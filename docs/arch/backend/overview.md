# Backend Architecture — Overview (범위·스택·프로세스)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (BACKEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [adapters.md](./adapters.md), [provider-runtime.md](./provider-runtime.md), [persistence.md](./persistence.md), [security.md](./security.md), [runtime-ipc.md](./runtime-ipc.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 이 문서의 범위

**다루는 것**
- Electron Main Process 구조 (`app/src/main/`)
- Backend Adapter 추상화 (SessionAdapter — LLM Provider 가 아님)
- 데이터 영속성 (electron-store 현재 + 로컬 DB + 파일 시스템 Phase 3+ 채택 결정)
- IPC 핸들러 구조 (채널 카탈로그는 [IPC_CONTRACT.md](./IPC_CONTRACT.md))
- 보안 경계 (BrowserWindow 옵션 + 자격증명 모델)
- 시스템 통합 (자동 업데이트 / 로깅 / 플랫폼 차이)

**다루지 않는 것 (→ ../frontend/ 참조)**
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
│   ├── settings/store.ts       # electron-store 영속화 (9 키 — persistence.md §1.2)
│   └── skills/
│       ├── scan.ts             # ~/.claude/skills + <cwd>/.claude/skills 부팅 1회 스캔
│       └── plugin-bundle.ts    # ensureOrcaPlugin() — ~/.config/orca/.claude-plugin/plugin.json 생성
│
├── Preload (src/preload/index.ts)
│   └── contextBridge.exposeInMainWorld('orca', api) — window.orca 노출 (IPC_CONTRACT §2)
│
└── Renderer (src/renderer/) → ../frontend/ 참조
```

### 3.1 부트 시퀀스 (`src/main/index.ts`)

```
1. app.whenReady()
2. settings = new SettingsStore()           # electron-store 로드 (9 키, persistence.md §1.2)
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


## 4. 현재 구현 상태

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
| Artifacts 디렉토리 (큰 산출물) | Future | ❌ 미구현 | persistence.md §1.4 |
| 자동 업데이트 | Future | ❌ 미구현 | PRD OQ3 |
| 로깅 라이브러리 | TBD | ❌ 미구현 | electron-log 후보 |
| `options.permissionMode` (도구 권한) | Phase 4 | ❌ 미구현 | PRD OQ9 |
| `options.hooks` 완전 구현 (도구 감사 외부 핸들러) | Phase 4 | ❌ 미구현 | 현재 인프로세스 OrcaHookSet 은 구현됨 |
| 멀티세션 (`requestRegistry: Map`) | Phase 4 | ❌ 미구현 | ../frontend/state.md §2 와 함께 |
| Zustand persist 전략 (renderer store ↔ 로컬 DB / electron-store) | Phase 4 | ❌ 미정 OQ | ../frontend/state.md §1.4.6 |
| i18n (`src/shared/i18n/ko.ts`) | Future | ❌ 미구현 | 현재 인라인 한국어 |
| **Provider Runtime Model (정규화 계층)** | Future | 📐 설계 확정 / 구현 대기 | §12 — NormalizedEvent · PermissionBridge · AppCommandPolicy · SessionCapability · RevertManager · ErrorClassifier · Telemetry · AuthStore · AuditLog. SDK 타입 확정(provider-runtime.md §13) 후 착수 |

> 이 표는 코드 변경 시 함께 갱신한다.

---


## 5. 참고

- IPC 채널 정의: [IPC_CONTRACT.md](./IPC_CONTRACT.md)
- 용어 정의: [GLOSSARY.md](./GLOSSARY.md)
- 프론트엔드 측 구조: [../frontend/overview.md](../frontend/overview.md)
- 데이터 모델 / 어댑터 사양 SSOT: [TRD.md](./TRD.md) §6 / §7
- 외부 SDK 사양 SSOT: [`docs/spec/claude/agent-sdk/typescript.md`](./spec/claude/agent-sdk/typescript.md)
- CLI 시기 외부 계약 + Orca 채택 표기: [claude-code-spec.md](./claude-code-spec.md)
- Phase 로드맵 / Future Scope: [PRD.md](./PRD.md) §8 / §9 / §11
- 운영 규칙: [`app/CLAUDE.md`](../app/CLAUDE.md)
