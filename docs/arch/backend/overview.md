# Backend Architecture — Overview (범위·스택·프로세스)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [adapters.md](./adapters.md), [provider-runtime.md](./provider-runtime.md), [standardization.md](./standardization.md), [persistence.md](./persistence.md), [security.md](./security.md), [runtime-ipc.md](./runtime-ipc.md), [terms.md](./terms.md) (사람용 용어 해설), [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md) (레이어 DAG 정본)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.
> Decision rationale: [ADR-002](../../decisions/002-feature-slice-boundaries.md) — 왜 feature 수직 슬라이스인가.

## 1. 이 문서의 범위

**다루는 것**
- Electron Main Process 구조 (`app/src/main/`)
- Backend Adapter 추상화 (SessionAdapter — LLM Provider 가 아님)
- 데이터 영속성 (electron-store 현재 + 로컬 DB + 파일 시스템 Phase 3+ 채택 결정)
- IPC 핸들러 구조 (채널 카탈로그는 [IPC_CONTRACT.md](../../IPC_CONTRACT.md))
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
| 자동 업데이트 | **electron-updater** | ^6.x | ✅ 채택·구현 완료 (0084~0086). `app/updater.ts` UpdateController — autoDownload=false·사용자 게이트. runtime-ipc.md §3.1 |
| 스케줄링 | croner | ^10.x | ✅ 채택 (0091). `infra/cron.ts` 래퍼 + `features/scheduler/` — main in-app cron, 앱 실행 중만 발화 |
| 로깅 | 자체 구현 (`infra/log/`) | — | ✅ 구현 완료 (0123/0124) — 외부 로깅 라이브러리 미도입 결정. 중앙 LogManager + JSONL. 정본 [observability.md](./observability.md) |
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
│   │   ├── chat-turn/          # 턴 셋업 14모듈 (0179 분해) — index(배럴·IPC 등록) · send(순서) ·
│   │   │                       #   admission/turn-context/continuation(순수 판정·조립) · resolve-turn ·
│   │   │                       #   runtime-entry · enqueue · turn-request · approval · post-turn · busy-reserve
│   │   ├── context.ts          # RouterContext (핸들러 공유 의존성)
│   │   ├── boot-report.ts      # 부팅 진단 계측 (0077) — 각 부팅 단계 step 래핑 · orca:boot:report
│   │   ├── builtin-resources.ts # 번들 스킬 리소스 해석 (0078)
│   │   ├── updater.ts          # UpdateController — electron-updater 자동 업데이트 (0084~0086)
│   │   ├── updater-feed.ts     # 업데이트 피드 해석 — object storage(S3/MinIO)·GHE host (0133)
│   │   ├── chat-turn-continuation.ts # 자동 연속 턴 배선 (실행 구성 전체 재resolve, 0126/0188)
│   │   ├── auth-resume.ts      # 부팅 복원 순서 — gate 우선 → 나머지 병렬 → push 1회 (0188)
│   │   ├── connection-views.ts # Auth descriptor/snapshot → 기존 GUI DTO (0188 compat mapper)
│   │   ├── deployment/         # 배포별 concrete (build-time) — auth-definitions · gate-auth ·
│   │   │                       #   harness-runtime · plugins · usage-fetcher (0188)
│   │   └── handlers/           # 도메인 IPC — boot · cost · engine · files · log · mcp · misc · project ·
│   │                           #   providers(연결/Auth) · session · settings · skills · update
│   ├── features/               # 수직 슬라이스 (교차 import 금지)
│   │   ├── chat/               # 턴 오케스트레이션 — turn-coordinator · pending-message-queue · settle · timers · title
│   │   ├── sessions/           # 런타임 거버넌스 — supervisor · session-runtime · runtime-pool · eviction/cap-policy · active-turn-tracker
│   │   ├── approvals/          # ApprovalCoordinator(도구 승인 broker) · permission-mode-controller
│   │   ├── usage/              # UsageTracker — turn_usage 집계(일/주/월 SUM) + provider별 한도(0080~0082)
│   │   ├── history/            # HistoryWriter — NormalizedEvent → DB parts 영속
│   │   ├── auth/               # 인증 lifecycle (0181 → 0188 독립) — runtime · registry · store ·
│   │   │                       #   login · oauth · authenticated-request · secret-access · policy ·
│   │   │                       #   present · session-policies · specs/ · browser-session/
│   │   ├── gate/               # Auth 상태를 앱 접근 조건으로 소비하는 정책 (0188)
│   │   ├── harnesses/          # settings 열거·해석(0014) · Model 해석 · 실행 구성(runtime-config) ·
│   │   │                       #   spawn 입력 조립(prepared-config) · respawn 경계 · claude/model-parser
│   │   ├── plugins/            # 제품 기능 단위 — confluence/ (0188 이설)
│   │   ├── extensions/         # ExtensionBuilder(지침·MCP·skill 조립) + deployer · mcp/ · skills/(scan·seed)
│   │   ├── orchestration/      # Conversation Continuity(fork/handoff) 순수 로직 (handoff 0051 §A.4)
│   │   └── scheduler/          # 주기 실행 엔진 (croner, 0091) — register/protect/nextRun/stopAll + schedule_runs 기록
│   ├── adapters/               # SessionAdapter 포트 & 구현 (구체 provider 리터럴 격리)
│   │   ├── types.ts·turn.ts·harness-config.ts·mcp-config.ts·hooks.ts·descriptor.ts  # 포트
│   │   ├── claude.ts           # ClaudeAdapter — SDK query() (장수명 채널 pushTurn)
│   │   ├── claude-map.ts       # SDKMessage → NormalizedEvent 정규화 (순수)
│   │   ├── claude-adapt.ts     # TurnExtensions → query() 옵션 순수 변환
│   │   ├── claude-settings.ts·claude-plugin.ts  # settings/플러그인 합성
│   │   ├── streaming-input.ts  # 턴-스코프 AsyncIterable 입력
│   │   ├── error-classifier.ts # claude 에러 분류
│   │   └── mock.ts             # MockAdapter (DEV 디버그 하네스)
│   ├── contracts/              # 여러 feature 공유 타입 계약 5모듈 (구현 최소)
│   │   ├── turn.ts             # TurnContext
│   │   ├── bus-events.ts       # OrcaBusEvents — turn.event 단일 이벤트 맵
│   │   ├── ports.ts            # ManagedRuntime · RuntimeSessionAdapter 등 구조적 포트
│   │   ├── session-state.ts    # SessionRuntimeState 머신 (cold/live/busy/interrupting/error/closed)
│   │   └── auth.ts             # **AuthDefinition·AuthMethod·Grant·BoundAuth·AuthSecretReader** (0188)
│   │                           #   — 인증만 표현한다(소비 슬롯 없음)
│   └── infra/                  # 얇은 인프라 (feature/어댑터 비의존)
│       ├── ipc/                # handle(safeParse+실패정책) · send(push 헬퍼·wire-log) · dto
│       ├── bus/                # TypedBus
│       ├── db/                 # better-sqlite3 싱글턴 + migrate + queries (WAL + foreign_keys)
│       ├── config/             # orca-config · secret-store · paths · crypto · mcp-file
│       ├── net/               # 원격 전송 스택 — net-fetch(net.fetch) · net-request(net.request) · net-response(순수) ·
│       │                       #   transport(인증 요청 조각·상한, 0181). 전역 fetch( 호출은 net-fetch.ts 에만 허용
│       ├── vault.ts            # safeStorage 네임스페이스 뷰 — provider:<id>:<authKind>
│       ├── browser-session.ts  # session group → Electron Session · 로그인 창. 판정은 -policy 순수부
│       ├── loopback-callback.ts # OAuth 루프백 1회성 리스너 (0181, RFC 8252)
│       ├── log/                # 중앙 LogManager (0123/0124) — file-transport(JSONL 로테이션) · redact · suppress ·
│       │                       #   registry · log-context · serialize-error. 정본 observability.md
│       ├── errors.ts           # 에러 정규화 (ErrorCategory) + errorMessage 헬퍼 (0092)
│       ├── cron.ts             # croner 래퍼 (scheduler 의 타이머 프리미티브, 0091)
│       └── settings-store.ts   # electron-store 영속화 (+settings-migration.ts, persistence.md §1.2)
│
├── Preload (src/preload/index.ts)
│   └── contextBridge.exposeInMainWorld('orca', api) — window.orca 노출 (IPC_CONTRACT §2)
│
└── Renderer (src/renderer/) → ../frontend/ 참조
```

### 3.1 부트 시퀀스 (`src/main/index.ts` → `app/bootstrap.ts`)

각 단계는 `boot-report.ts` 의 `step`/`stepSync` 로 래핑돼 성공/실패·소요가 계측된다(0077, `orca:boot:report` 로 renderer 조회). `critical: true` 단계 실패만 부팅을 막는다.

```
1. app.whenReady() → registerAppProtocol()  # app:// 커스텀 스킴 핸들러
2. bootstrap = new Bootstrap()              # SettingsStore / McpStore / AdapterRegistry field-init
3. bootstrap.start()                        # 각 단계 = bootReport.step* 래핑
   a. db-init (critical)                    # initDb — better-sqlite3 초기화 + 마이그레이션(0001~0013) + 재시작 잔재 정착
   b. cost-recompute (critical)             # new UsageTracker(db, …) → 부팅 1회 일/주/월 합산 + 비용 요약 push 배선
   c. new Scheduler(DbRunRecorder)          # 'usage-recompute' job 등록(action = cost.recordAndBroadcast 주입)
      → scheduler.applySettings(settings.scheduler)  # croner 스케줄 시작 (0091, 실패 시 비활성 시작)
   d. new ExtensionBuilder(db, mcp, …)      # DB/McpStore/Skills 읽어 TurnExtensions 조립기
   e. adapter-registry (critical)           # 어댑터 설치 상태 갱신
   f. workspace                             # 기본 작업공간(~/.config/orca/workspace) mkdir
   g. config-dir → orca-config              # ~/.config/orca 보장 + orca.json 부팅 1회 로드
   h. builtin-skill-seed                    # seedBuiltinSkills — 번들 스킬 → sources/skills 시딩 (0078, manifest/marker 버전 게이트)
   i. provider-scaffold                     # 최초 1회 — readUserClaudeSettings() 로 ~/.claude/settings.json env 판별
                                            # (classifyClaudeEnv) 후 provider verbatim 시딩, 부재 시 anthropic 템플릿 (0090)
   j. extension-deploy                      # sources → dist/<engine> 렌더 (ExtensionDeploymentService)
   k. skill-scan                            # 스킬 부팅 1회 스캔(orca sources/skills + ~/.claude/skills) → Bootstrap.skillsCache
   l. register(ctx):                        # RouterContext 조립
        - RuntimeSupervisor(cap 5 · BoundedRuntimeCapPolicy · ActiveTurnTracker→concurrency push)
        - TypedBus 구독 순서 SSOT: usage → history → title → relay(sendChatEvent)  (§runtime-ipc §2.4)
        - PendingMessageQueue · ApprovalCoordinator · PermissionModeController
        - updates: UpdateController (app/updater.ts — electron-updater, 0084~0086)
        - registerChatHandlers + session/project/mcp/engine/boot/update/misc 핸들러 등록
4. createWindow(bootstrap.settings)         # BrowserWindow + webPreferences 명시
   ├─ contextIsolation: true / nodeIntegration: false / sandbox: true
   └─ preload: '../preload/index.js'
5. windowBounds 복구 + mainWindow.on('close') → settings.patch({ windowBounds })
6. app.on('will-quit') → bootstrap.shutdown() → closeDb()  # 열린 도구 정착·abort·idle 런타임 close·Scheduler.stopAll·WAL 정리
```

> critical 이 아닌 단계 실패는 부팅을 막지 않는다(채팅/세션 기능은 config/deploy 와 독립). 레거시 1회성 이전(구 평면 레이아웃·구 orca-mcp 스토어)은 정식 배포 전 정리(handoff 0011)로 제거 — 구 dev 환경은 `~/.config/orca` 재생성으로 해결.

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
| electron-store | Phase 3++ | ✅ 완료 | `infra/settings-store.ts` (키 카탈로그는 persistence.md §1.2 / IPC_CONTRACT §2.4) |
| Skills 스캔 (orca `sources/skills` + `~/.claude/skills`) | Phase 2 | ✅ 완료 | `features/extensions/skills/scan.ts` — `<cwd>/.claude/skills` 루트는 제거됨. 캐시는 `Bootstrap.skillsCache` |
| Skills 번들 시딩 (부트 1회) | Phase 4 | ✅ 완료 (0078) | `features/extensions/skills/seed.ts` + `app/builtin-resources.ts` — manifest/marker 버전 게이트 |
| ExtensionDeployer | Phase 3++ | ✅ 완료 | `features/extensions/deployer.ts` — sources → `dist/<engine>/` 렌더 (표준화 스테이지 A) |
| 인증 만료 감지 (`auth.expired`) | Phase 2 | ✅ 완료 | UI 에 AuthExpiredModal 노출 |
| 로컬 DB (sessions / messages / parts / projects) | Phase 3 | ✅ 완료 | better-sqlite3 + 마이그레이션(`infra/db/migrations/`, `0001_initial` 부터 순번). |
| FTS5 전문 검색 (`messages_fts`) | Phase 3++ | ✅ 완료 | `0003_messages_fts.sql` + `orca:search:messages` IPC |
| MCP 서버 CRUD + safeStorage 인증 비밀 | Phase 3++ | ✅ 완료 | `features/extensions/mcp/store.ts` + `infra/config/secret-store.ts`. 파일-백드 모델. |
| Artifacts 디렉토리 (큰 산출물) | Future | ❌ 미구현 | persistence.md §1.4 |
| 자동 업데이트 (electron-updater) | Phase 4 | ✅ 완료 (0084~0086) | `app/updater.ts` UpdateController + `handlers/update.ts`(update 6채널) + `shared/update-restart.ts` 재시작 게이트. runtime-ipc.md §3.1 |
| 스케줄러 (주기 실행) | Phase 4 | ✅ 완료 (0091) | `features/scheduler/` (croner) — 첫 소비처 = 주기 사용량 recompute. `schedule_runs` 실행 이력(`0013`) |
| provider별 사용량 한도 | Phase 4 | ✅ 완료 (0079~0082) | `provider_limits`(`0012`) + `cost:usage`/`cost:setProviderLimit` |
| CI/CD 릴리스 파이프라인 (v0.1.0) | Phase 4 | ✅ 완료 (0087~0089) | `.github/workflows/{ci,release}.yml` — Windows unsigned NSIS + GitHub Releases draft. 배포 빌드는 로그인 게이트 스킵(0089). 정본 `docs/guides/release-operations.md` |
| 중앙 로깅 (LogManager · JSONL · redaction) | Phase 4 | ✅ 완료 (0123/0124, prod opt-in 토글 0144) | `infra/log/` — 외부 로깅 라이브러리 미도입. 정본 [observability.md](./observability.md) |
| **인증 + 소비 경계** (앱 로그인 + Harness 실행 구성 + Plugin) | Phase 4 | ✅ **0181 재작성 → 0188 경계 분리** | `contracts/auth.ts` 가 **인증만** 표현하고 `features/{auth,gate,harnesses,plugins}` 가 구현이다. 인증 5종(api-key·password·pat·**oauth code→token**·browser-session) · IPC `provider` 6채널(compat) · 카탈로그 연결 탭. 실값과 배선은 `app/deployment/` 에서 채운다. 구조 정본 [`auth.md`](./auth.md) |
| **원격 전송 스택 단일화** (Node 전역 `fetch` 금지 → Chromium 스택) | Phase 4 | ✅ 완료 (0173/0174) | 전역 `fetch(` 호출은 `infra/net/net-fetch.ts` 에만 허용(`no-node-fetch.test.ts` 가 0건으로 고정), 소비자는 `typeof fetch` 포트 주입. Chromium 스택을 무는 파일은 **3개**(`net-fetch`·`net-request`·`browser-session`). [security.md](./security.md) §1.8 |
| `options.permissionMode` (도구 권한) | Phase 4 | ❌ 미구현 | PRD OQ9 |
| `options.hooks` 완전 구현 (도구 감사 외부 핸들러) | Phase 4 | ❌ 미구현 | 현재 인프로세스 OrcaHookSet 은 구현됨 |
| 멀티세션 + 장수명 세션 채널 | Phase 4 | ✅ main 런타임 완료 (handoff 0011·0051·0067) | 세션별 SessionRuntime + 동시 턴 + 장수명 채널(프레임)·idle 풀 LRU. runtime-ipc.md §1. renderer 외피는 ../frontend/state.md §2 |
| Zustand persist 전략 (renderer store ↔ 로컬 DB / electron-store) | Phase 4 | ❌ 미정 OQ | ../frontend/state.md §1.4.6 |
| i18n (`src/shared/i18n/ko.ts`) | Future | ❌ 미구현 | 현재 인라인 한국어 |
| **Provider Runtime Model (정규화 계층)** | Future | 📐 설계 확정 / 구현 대기 | §12 — NormalizedEvent · PermissionBridge · AppCommandPolicy · SessionCapability · RevertManager · ErrorClassifier · Telemetry · AuthStore · AuditLog. SDK 타입 확정(provider-runtime.md §13) 후 착수 |

> 이 표는 코드 변경 시 함께 갱신한다.

---


## 5. 참고

- IPC 채널 정의: [IPC_CONTRACT.md](../../IPC_CONTRACT.md)
- 용어 정의: [GLOSSARY.md](../../GLOSSARY.md)
- 프론트엔드 측 구조: [../frontend/overview.md](../frontend/overview.md)
- 데이터 모델 / 어댑터 사양 SSOT: [TRD.md](../../TRD.md) §6 / §7
- 외부 SDK 사양 SSOT: [`docs/spec/claude/agent-sdk/typescript.md`](../../spec/claude/agent-sdk/typescript.md)
- CLI 시기 외부 계약 + Orca 채택 표기: [claude-code-spec.md](../../claude-code-spec.md)
- Phase 로드맵 / Future Scope: [PRD.md](../../PRD.md) §8 / §9 / §11
- 운영 규칙: [`app/AGENTS.md`](../../../app/AGENTS.md)
