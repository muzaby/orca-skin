# Backend Architecture — Overview (범위·스택·프로세스)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-07-05 (handoff 0071 — §3 프로세스 구조를 0062 main 재편으로 정합)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [adapters.md](./adapters.md), [provider-runtime.md](./provider-runtime.md), [standardization.md](./standardization.md), [persistence.md](./persistence.md), [security.md](./security.md), [runtime-ipc.md](./runtime-ipc.md), [terms.md](./terms.md) (사람용 용어 해설), [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md) (레이어 DAG 정본)
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

main 은 **feature 수직 슬라이스 + adapters 한정 ports&adapters + 얇은 infra + app 컴포지션 루트**(handoff 0062)로 구성된다. 하향 의존만 + feature 교차 import 금지를 `eslint-plugin-boundaries` + `import/no-cycle` 로 강제한다. **레이어 DAG·슬라이스 매핑·작업 규칙의 정본은 [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md)** — 아래는 슬라이스 대표 모듈만(드리프트 방지, 사본 아님).

```
Electron App
├── Main Process (src/main/) — 5-슬라이스 (하향 의존만, handoff 0062)
│   ├── index.ts                # 부트 진입 — Bootstrap.start() → BrowserWindow → will-quit(shutdown→closeDb)
│   ├── app/                    # 컴포지션 루트 (전 레이어 의존 허용 — 유일)
│   │   ├── bootstrap.ts        # 의존성 생성 + 부팅 시퀀스 + 버스 구독 순서 SSOT + 핸들러 등록 위임
│   │   ├── chat-turn.ts        # 턴 셋업 — chat:send 배선(pending queue·supervisor·coordinator 연결)
│   │   ├── context.ts          # RouterContext (핸들러 공유 의존성)
│   │   └── handlers/           # 도메인 IPC — session · project · mcp · engine · misc
│   ├── features/               # 수직 슬라이스 (교차 import 금지)
│   │   ├── chat/               # 턴 오케스트레이션 — turn-coordinator · pending-message-queue · settle · timers · title
│   │   ├── sessions/           # 런타임 거버넌스 — supervisor · session-runtime · runtime-pool · eviction/cap-policy · active-turn-tracker
│   │   ├── approvals/          # ApprovalCoordinator(도구 승인 broker) · permission-mode-controller
│   │   ├── usage/              # UsageTracker — turn_usage 집계(일/주/월 SUM)
│   │   ├── history/            # HistoryWriter — NormalizedEvent → DB parts 영속
│   │   ├── providers/          # provider/engine 설정·모델 해석
│   │   ├── extensions/         # ExtensionBuilder(지침·MCP·skill 조립) + deployer · conformance · mcp/ · skills/
│   │   └── orchestration/      # Conversation Continuity(fork/handoff) 순수 로직 (handoff 0051 §A.4)
│   ├── adapters/               # SessionAdapter 포트 & 구현 (구체 provider 리터럴 격리)
│   │   ├── types.ts·turn.ts·provider-config.ts·mcp-config.ts·hooks.ts·descriptor.ts  # 포트
│   │   ├── claude.ts           # ClaudeAdapter — SDK query() (장수명 채널 pushTurn)
│   │   ├── claude-map.ts       # SDKMessage → NormalizedEvent 정규화 (순수)
│   │   ├── claude-adapt.ts     # TurnExtensions → query() 옵션 순수 변환
│   │   ├── claude-settings.ts·claude-plugin.ts  # settings/플러그인 합성
│   │   ├── streaming-input.ts  # 턴-스코프 AsyncIterable 입력
│   │   ├── error-classifier.ts # claude 에러 분류
│   │   └── mock.ts             # MockAdapter (DEV 디버그 하네스)
│   ├── contracts/              # 여러 feature 공유 타입 계약 (구현 최소)
│   │   ├── turn.ts             # TurnContext
│   │   ├── bus-events.ts       # OrcaBusEvents — turn.event 단일 이벤트 맵
│   │   ├── ports.ts            # ManagedRuntime · RuntimeSessionAdapter 등 구조적 포트
│   │   └── session-state.ts    # SessionRuntimeState 머신 (cold/live/busy/interrupting/error/closed)
│   └── infra/                  # 얇은 인프라 (feature/어댑터 비의존)
│       ├── ipc/                # handle(safeParse+실패정책) · send(push 헬퍼·wire-log) · dto
│       ├── bus/                # TypedBus
│       ├── db/                 # better-sqlite3 싱글턴 + migrate + queries (WAL + foreign_keys)
│       ├── config/             # orca-config · secret-store · paths · crypto · mcp-file
│       ├── errors/             # 에러 정규화 (ErrorCategory)
│       └── settings-store.ts   # electron-store 영속화 (persistence.md §1.2)
│
├── Preload (src/preload/index.ts)
│   └── contextBridge.exposeInMainWorld('orca', api) — window.orca 노출 (IPC_CONTRACT §2)
│
└── Renderer (src/renderer/) → ../frontend/ 참조
```

### 3.1 부트 시퀀스 (`src/main/index.ts` → `app/bootstrap.ts`)

```
1. app.whenReady() → registerAppProtocol()  # app:// 커스텀 스킴 핸들러
2. bootstrap = new Bootstrap()              # SettingsStore / McpStore / AdapterRegistry field-init
3. bootstrap.start()
   a. initDb() + recoverDanglingToolCalls   # better-sqlite3 초기화 + 마이그레이션 + 재시작 잔재 정착
   b. new UsageTracker(db, …) → recompute() # 부팅 1회 일/주/월 합산 + 비용 요약 push 배선
   c. new ExtensionBuilder(db, mcp, …)      # DB/McpStore/Skills 읽어 TurnExtensions 조립기
   d. ensureConfigDir() → loadOrcaConfig()  # ~/.config/orca 보장 + orca.json 부팅 1회 로드
   e. scaffoldProviderSettings('claude')    # sources/settings/claude 최초 1회 스캐폴드
   f. deployExtensions()                    # sources → dist/<engine> 렌더 (ExtensionDeploymentService)
   g. refreshSkills()                       # 스킬 부팅 1회 스캔(orca + ~/.claude/skills) → 메모리 캐시
   h. register(ctx):                        # RouterContext 조립
        - RuntimeSupervisor(cap 5 · BoundedRuntimeCapPolicy · ActiveTurnTracker→concurrency push)
        - TypedBus 구독 순서 SSOT: usage → history → title → relay(sendChatEvent)  (§runtime-ipc §2.4)
        - PendingMessageQueue · ApprovalCoordinator · PermissionModeController
        - registerChatHandlers + session/project/mcp/engine/misc 핸들러 등록
4. createWindow(bootstrap.settings)         # BrowserWindow + webPreferences 명시
   ├─ contextIsolation: true / nodeIntegration: false / sandbox: true
   └─ preload: '../preload/index.js'
5. windowBounds 복구 + mainWindow.on('close') → settings.patch({ windowBounds })
6. app.on('will-quit') → bootstrap.shutdown() → closeDb()  # 열린 도구 정착·abort·idle 런타임 close·WAL 정리
```

> 부팅 각 단계 실패는 부팅을 막지 않는다(채팅/세션 기능은 config/deploy 와 독립). 레거시 1회성 이전(구 평면 레이아웃·구 orca-mcp 스토어)은 정식 배포 전 정리(handoff 0011)로 제거 — 구 dev 환경은 `~/.config/orca` 재생성으로 해결.

### 3.2 모듈 간 import 규약

- **Main** → `shared` (타입 + protocol zod 스키마) 만. `renderer` 절대 import 금지.
- **Preload** → `shared/ipc.ts` (zod 의존 없는 순수 TS 타입) 만. `protocol.ts` (zod) import 금지 (sandbox=true 에서 zod 작동 안 함).
- **Renderer** → `shared/ipc.ts` 만. `main` 절대 import 금지.

---


## 4. 현재 구현 상태

| 영역 | Phase | 상태 | 비고 |
|---|---|---|---|
| BrowserWindow + 보안 옵션 명시 | Phase 1 | ✅ 완료 | `main/index.ts` |
| 컴포지션 루트(Bootstrap) + 5-슬라이스 재편 | Phase 3++ | ✅ 완료 | `app/bootstrap.ts` + `app/handlers/` + `features/*` (handoff 0062, 채널 카탈로그는 IPC_CONTRACT §2) |
| 모든 invoke 의 zod 검증 | Phase 2 | ✅ 완료 | `infra/ipc/handle.ts` 헬퍼 + `shared/protocol.ts` |
| SessionAdapter 인터페이스 | Phase 2 | ✅ 완료 | `adapters/types.ts` |
| ClaudeAdapter (SDK `query()` · 장수명 채널 pushTurn) | Phase 3 | ✅ 완료 | `adapters/claude.ts` (구 claude-code.ts). CLI spawn 폐기 (2026-05-18) |
| `claude-adapt.ts` (TurnExtensions → claude 옵션 변환) | Phase 3++ | ✅ 완료 | adaptMcp / adaptSystemPrompt / adaptSkills / adaptHooks |
| ExtensionBuilder | Phase 3++ | ✅ 완료 | `features/extensions/builder.ts` — DB/McpStore/Skills 읽어 TurnExtensions 조립 (구 CapabilityBuilder) |
| SessionRuntime + RuntimeSupervisor (세션별 런타임 거버넌스) | Phase 4 | ✅ 완료 | `features/sessions/` — 장수명 세션 채널(프레임) · idle 풀 LRU cap 5 · 세션별 pending message queue(`features/chat/`). runtime-ipc.md §1 |
| OpencodeAdapter | Future | ❌ 미구현 | PRD OQ7 |
| AdapterRegistry | Phase 2 | ✅ 완료 | claude 단일 등록 |
| Installer (래퍼) | Phase 2 | ✅ 완료 | 4줄 — 어댑터의 `install()` yield |
| electron-store | Phase 3++ | ✅ 완료 | `infra/settings-store.ts` — sidebarWidth / mcpEnabled / mcpMeta / skillEnabled |
| Skills 스캔 (`~/.claude/skills` + orca) | Phase 2 | ✅ 완료 | `features/extensions/skills/scan.ts` — 어댑터별 분리는 Future |
| ExtensionDeployer | Phase 3++ | ✅ 완료 | `features/extensions/deployer.ts` — sources → `dist/<engine>/` 렌더 (표준화 스테이지 A) |
| 인증 만료 감지 (`auth.expired`) | Phase 2 | ✅ 완료 | UI 에 AuthExpiredModal 노출 |
| 로컬 DB (sessions / messages / parts / projects) | Phase 3 | ✅ 완료 | better-sqlite3 + 마이그레이션 11종(`0001_initial`…`0011_session_lineage`). `infra/db/`. |
| FTS5 전문 검색 (`messages_fts`) | Phase 3++ | ✅ 완료 | `0003_messages_fts.sql` + `orca:search:messages` IPC |
| MCP 서버 CRUD + safeStorage 인증 비밀 | Phase 3++ | ✅ 완료 | `features/extensions/mcp/store.ts` + `infra/config/secret-store.ts`. 파일-백드 모델. |
| Artifacts 디렉토리 (큰 산출물) | Future | ❌ 미구현 | persistence.md §1.4 |
| 자동 업데이트 | Future | ❌ 미구현 | PRD OQ3 |
| 로깅 라이브러리 | TBD | ❌ 미구현 | electron-log 후보 |
| `options.permissionMode` (도구 권한) | Phase 4 | ❌ 미구현 | PRD OQ9 |
| `options.hooks` 완전 구현 (도구 감사 외부 핸들러) | Phase 4 | ❌ 미구현 | 현재 인프로세스 OrcaHookSet 은 구현됨 |
| 멀티세션 + 장수명 세션 채널 | Phase 4 | ✅ main 런타임 완료 (handoff 0011·0051·0067) | 세션별 SessionRuntime + 동시 턴 + 장수명 채널(프레임)·idle 풀 LRU. runtime-ipc.md §1. renderer 외피는 ../frontend/state.md §2 |
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
- 운영 규칙: [`app/AGENTS.md`](../app/AGENTS.md)
