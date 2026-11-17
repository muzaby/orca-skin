# Backend Architecture — Overview (범위·스택·프로세스)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [adapters.md](./adapters.md), [provider-runtime.md](./provider-runtime.md), [standardization.md](./standardization.md), [persistence.md](./persistence.md), [security.md](./security.md), [runtime-ipc.md](./runtime-ipc.md), [terms.md](./terms.md) (사람용 용어 해설), [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md) (레이어 DAG 정본)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.
> Decision rationale: [ADR-002](../../decisions/002-feature-slice-boundaries.md) — 왜 feature 수직 슬라이스인가.

## 1. 이 문서의 범위

**다루는 것**
- Electron Main Process 구조 (`app/src/main/`)
- Backend Adapter 추상화 (SessionAdapter — LLM Provider 가 아님)
- 데이터 영속성 (하네스 native 원본 + Orcinus orca 보관 DB + 앱 설정·게시 파일 — [persistence.md](./persistence.md))
- IPC 핸들러 구조 (채널 카탈로그는 [IPC_CONTRACT.md](../../IPC_CONTRACT.md))
- 보안 경계 (BrowserWindow 옵션 + 자격증명 모델)
- 시스템 통합 (자동 업데이트 / 로깅 / 플랫폼 차이)

**다루지 않는 것 (→ ../frontend/ 참조)**
- UI 컴포넌트 / 렌더링 최적화
- 사용자 입력 처리 / 자동완성
- React 상태 관리 / 스타일링

---

## 2. 기술 스택

`app/package.json` 이 정본이다 — 아래 버전은 2026-10-13 기준 요약이고 갈리면 package.json 이 맞다.

| 영역 | 선택 | 버전 | 비고 |
|---|---|---|---|
| 런타임 | Electron | ^39.2.6 | `app.whenReady()` 부트 |
| 언어 | TypeScript | ~5.x (strict, target ES2022) | tsconfig.node.json 분리 |
| 빌드 도구 | electron-vite | ^5.0.0 | main + preload sub-config |
| LLM SDK (claude-code) | @anthropic-ai/claude-agent-sdk | **exact pin** (`package.json` — 모델 세대 추가 시 갱신, 0246·0258) | `query()` 장수명 채널(`pushTurn`) + `complete()` 단발 |
| LLM SDK (opencode) | @opencode-ai/sdk | 1.18.27 (exact) | 앱 소유 로컬 CLI 서버의 HTTP/SSE 어댑터; Code 모드 지원 ([SDK 해설](../../opencode-sdk-spec.md)) |
| 입력 검증 | zod | ^4.4.3 | `src/shared/protocol.ts` 스키마 |
| 설정 저장 | electron-store | ^8.2.0 | 단일 객체 스토어 (`orcinus-orca-settings`) |
| 로컬 DB | **better-sqlite3** | ^12.x | ✅ Phase 3 도입 완료. 동기 API, Electron 호환. 직접 마이그레이션 (`db/migrations/`). WAL + foreign_keys pragma. |
| HTTP 클라이언트 | (SDK 내부) | — | 별도 채택 없음 |
| 보안 저장 (자격증명) | Electron safeStorage | (Electron 내장) | ✅ Phase 3++ 도입 완료 (MCP 인증 비밀 첫 실사용). OS keychain — macOS Keychain / Windows DPAPI / Linux libsecret. `config/secret-store.ts` 래퍼. |
| 자동 업데이트 | **electron-updater** | ^6.x | ✅ 채택·구현 완료 (0084~0086). `app/updater.ts` UpdateController — autoDownload=false·사용자 게이트. runtime-ipc.md §3.1 |
| 스케줄링 | croner | ^10.x | ✅ 채택 (0091). `infra/cron.ts` 래퍼 + `features/scheduler/` — main in-app cron, 앱 실행 중만 발화 |
| 로깅 | 자체 구현 (`infra/log/`) | — | ✅ 구현 완료 (0123/0124) — 외부 로깅 라이브러리 미도입 결정. 중앙 LogManager + JSONL. 정본 [observability.md](./observability.md) |
| HTML/Markdown 변환 | cheerio · turndown(+gfm) | ^1 / ^7 | HTML 미리보기 정제(`features/artifacts/html-preview.ts`) · Confluence storage → Markdown(`features/plugins/confluence/storage-to-markdown.ts`) |
| 패키저 | electron-builder | — | `electron-builder.yml` |
| 유틸 | @electron-toolkit/utils | ^4.0.0 | 경로 / dev 모드 감지 |
| Preload 유틸 | @electron-toolkit/preload | ^3.0.2 | contextBridge 헬퍼 |

---

## 3. 프로세스 구조

main 은 **feature 수직 슬라이스 + adapters 한정 ports&adapters + 얇은 infra + app 컴포지션 루트**(handoff 0062)로 구성된다. 하향 의존만 + feature 교차 import 금지를 `eslint-plugin-boundaries` + `import/no-cycle` 로 강제한다. **레이어 DAG·슬라이스 매핑·작업 규칙의 정본은 [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md)** — 아래는 슬라이스 대표 모듈만(드리프트 방지, 사본 아님).

```
Electron App
├── Main Process (src/main/) — 5-레이어 app·features·adapters·contracts·infra (하향 의존만, handoff 0062)
│   ├── index.ts                # 셸 진입 — 두 호스트 기동(app/shell/) → BrowserWindow → 트레이 상주 조립 → will-quit(shutdownHosts)
│   ├── app/                    # 컴포지션 루트 (전 레이어 의존 허용 — 유일)
│   │   ├── shell/              # 셸 — 두 호스트 감독(boot·host-supervisor) · 셸 서비스(비밀 봉인·대화상자·알림·외부 열기)
│   │   ├── data-host/          # 데이터 호스트 조립 — DB·설정·비밀·인증 · 저장 스트림 수신 · 세션 조각 전송
│   │   ├── agent-host/         # 에이전트 호스트 조립 — 어댑터·턴·버스 구독 순서 SSOT · 저장 스트림 송신
│   │   ├── host-process.ts     # 두 호스트 공용 시작 순서(환경 → 로그 → 멈춤 계측 → 전송 → 조립)
│   │   ├── tray-residency.ts   # Windows 트레이 상주 — 창 닫기=숨김 판정 · 트레이 메뉴(열기·종료, uiLocale) · 종료 중 통과
│   │   ├── chat-turn/          # 턴 셋업 (0179 분해, 목록은 디렉토리가 진실) — index(배럴·IPC 등록) ·
│   │   │                       #   send(순서) · admission/turn-context/continuation(순수 판정·조립) ·
│   │   │                       #   resolve-turn · runtime-entry · respawn-inputs(최초/연속 턴 공용 respawn 입력) ·
│   │   │                       #   enqueue · turn-request · approval · post-turn · deps
│   │   ├── context.ts          # RouterContext (핸들러 공유 의존성)
│   │   ├── boot-report.ts      # 부팅 진단 계측 (0077) — 각 부팅 단계 step 래핑 · oo:boot:report
│   │   ├── builtin-resources.ts # 번들 스킬 리소스 해석 (0078)
│   │   ├── updater.ts          # UpdateController — electron-updater 자동 업데이트 (0084~0086)
│   │   ├── updater-feed.ts     # 업데이트 피드 해석 — object storage(S3/MinIO)·GHE host (0133)
│   │   ├── chat-turn-continuation.ts # 자동 연속 턴 배선 (실행 구성 전체 재resolve, 0126/0188)
│   │   ├── auth-resume.ts      # 부팅 복원 순서 — gate 우선 → 나머지 병렬 → push 1회 (0188)
│   │   ├── connection-views.ts # Auth descriptor/snapshot → 기존 GUI DTO (0188 compat mapper)
│   │   ├── daily-gate.ts       # 실행 중 날짜 경계의 게이트 해제 배선 (0255, ADR-008)
│   │   ├── error-report-sink.ts · error-report-drain.ts  # 오류 toast 의 창 전달·drain (0242, observability.md §7)
│   │   ├── artifact-sender.ts  # 게시 알림 → renderer (0223)
│   │   ├── harnesses/ · runtime-model-startup.ts · settings-reactions.ts
│   │   │                       #   Work/Code 프로필 선택 · 부팅 시 모델 카탈로그 준비 · 설정 변경 반응
│   │   ├── deployment/         # 배포별 concrete (build-time) — auth-definitions · gate-auth ·
│   │   │                       #   harness-runtime · plugins · usage-fetcher · spawn-env(배포별 subprocess env)
│   │   └── handlers/           # 도메인 IPC — artifacts · boot · context-file · cost · engine · error · files · git ·
│   │                           #   log · mcp · misc · project · providers(연결/Auth) · session · session-directory ·
│   │                           #   settings · skills · update
│   ├── features/               # 수직 슬라이스 (교차 import 금지)
│   │   ├── chat/               # 턴 오케스트레이션 — turn-coordinator · pending-message-queue · settle · title ·
│   │   │                       #   recovery · attachment-files · background-controller(백그라운드 작업)
│   │   ├── sessions/           # 런타임 거버넌스 — supervisor · session-runtime · runtime-pool · eviction/cap-policy · active-turn-tracker
│   │   ├── approvals/          # ApprovalCoordinator(도구 승인 broker) · permission-mode-controller
│   │   ├── usage/              # UsageTracker — telemetry 원장 기록·집계·provider별 한도
│   │   ├── history/            # HistoryWriter — 이벤트 영속 / reader — 저장된 세션 복원
│   │   ├── auth/               # 인증 lifecycle (0181 → 0188 독립) — runtime · registry · store ·
│   │   │                       #   login · oauth · authenticated-request · secret-access · policy ·
│   │   │                       #   present · session-policies · specs/ · browser-session/
│   │   ├── gate/               # Auth 상태를 앱 접근 조건으로 소비하는 정책 (0188)
│   │   ├── harnesses/          # settings 열거·해석(0014) · Model 해석 · 실행 구성(runtime-config) ·
│   │   │                       #   respawn 경계 · claude/model-parser
│   │   │                       #   (spawn 입력 조립은 adapters/common/harness-config.ts 소관)
│   │   ├── plugins/            # 제품 기능 단위 — confluence/ · jira/ · mail/ (자격증명·로그인 프리 Plugin, 0188·0236·0237·0248)
│   │   ├── agents/             # Work/Code 고정 프로필 + Work 시스템 프롬프트 (0224·0234)
│   │   ├── artifacts/          # 게시 원본 파일 — 검증·보관·카탈로그·출력 수집·휴지통 (0223·0226·0232)
│   │   ├── worktrees/          # managed Git worktree 생성·명명·안전 삭제 (0209~0211)
│   │   ├── extensions/         # ExtensionBuilder(지침·plugin·skill 조립) + deployer · mcp/ · skills/(scan·seed) ·
│   │   │                       #   harness-plugins/(하네스에 얹는 번들 플러그인) · runtime-tool-registry · system-header
│   │   ├── orchestration/      # Conversation Continuity(fork/handoff) 순수 로직 (handoff 0051 §A.4)
│   │   └── scheduler/          # 주기 실행 엔진 (croner, 0091) — register/protect/nextRun/stopAll + schedule_runs 기록
│   ├── adapters/               # SessionAdapter 포트 & 구현 (구체 provider 리터럴 격리)
│   │   ├── types.ts·turn.ts·mcp-config.ts·hooks.ts·descriptor.ts  # 포트
│   │   ├── harness-config.ts   # 실행 구성 계약 + spawn 입력 조립(PreparedHarnessConfig·env fingerprint)
│   │   ├── claude.ts           # ClaudeAdapter — SDK query() (장수명 채널 pushTurn)
│   │   ├── claude-map.ts       # SDKMessage → NormalizedEvent 정규화 (순수)
│   │   ├── claude-adapt.ts     # TurnExtensions → query() 옵션 순수 변환
│   │   ├── claude-settings.ts·claude-plugin.ts  # settings/플러그인 합성
│   │   ├── streaming-input.ts  # 턴-스코프 AsyncIterable 입력
│   │   ├── error-classifier.ts # claude 에러 분류
│   │   └── mock.ts             # MockAdapter (DEV 디버그 하네스)
│   ├── contracts/              # 여러 feature 가 공유하는 타입 계약 (구현 최소, 모듈 수는 생성물 inventory)
│   │   ├── turn.ts             # TurnContext
│   │   ├── bus-events.ts       # OoBusEvents — turn.event 단일 이벤트 맵
│   │   ├── ports.ts            # ManagedRuntime · RuntimeSessionAdapter 등 구조적 포트
│   │   ├── session-state.ts    # SessionRuntimeState 머신 (cold/live/busy/interrupting/error/closed)
│   │   └── auth.ts             # **AuthDefinition·AuthMethod·Grant·BoundAuth·AuthSecretReader** (0188)
│   │                           #   — 인증만 표현한다(소비 슬롯 없음)
│   └── infra/                  # 얇은 인프라 (feature/어댑터 비의존)
│       ├── ipc/                # handle(safeParse+실패정책) · send(push 헬퍼·wire-log) · dto
│       ├── bus/                # TypedBus
│       ├── db/                 # 같은 SQLite 연결 + migrate + queries / usage-queries (WAL + foreign_keys)
│       ├── config/             # oo-config · secret-store · paths · crypto · mcp-file
│       ├── net/               # 원격 전송 스택 — net-fetch(net.fetch) · net-request(net.request) · net-response(순수) ·
│       │                       #   transport(인증 요청 조각·상한, 0181). 전역 fetch( 호출은 net-fetch.ts 에만 허용
│       ├── vault.ts            # safeStorage 네임스페이스 뷰 — provider:<id>:<authKind>@<세대>
│       ├── browser-session.ts  # session group → Electron Session · 로그인 창. 판정은 -policy 순수부
│       ├── loopback-callback.ts # OAuth 루프백 1회성 리스너 (0181, RFC 8252)
│       ├── log/                # 중앙 LogManager (0123/0124) — file-transport(JSONL 로테이션) · redact · suppress ·
│       │                       #   registry · log-context · serialize-error. 정본 observability.md
│       ├── errors.ts           # 에러 정규화 (ErrorCategory) + errorMessage 헬퍼 (0092)
│       ├── cron.ts             # croner 래퍼 (scheduler 의 타이머 프리미티브, 0091)
│       ├── git/                # Git 게이트웨이·runner — 절대 경로 execFile·읽기 동시성·mutation queue (0241, security.md §1.10)
│       ├── error-report/       # 소비되지 않은 오류 보고 API (0242, observability.md §7)
│       ├── background-output.ts # 백그라운드 작업 출력 파일 읽기 (background-tasks.md)
│       └── settings-store.ts   # electron-store 영속화 (+settings-migration.ts, persistence.md §1.2)
│
├── Preload (src/preload/index.ts)
│   └── contextBridge.exposeInMainWorld('oo', api) — window.oo 노출 (IPC_CONTRACT §2)
│
└── Renderer (src/renderer/) → ../frontend/ 참조
```

### 3.1 부트 시퀀스 (`src/main/index.ts` → 두 호스트 조립)

앱은 프로세스 셋으로 뜬다 — 셸(Electron main) · 데이터 호스트(상태) · 에이전트 호스트(실행). 누가 무슨 일을 하고 어떤 경로로 부탁하는지는 [실행 모델](../execution-model.md)이 정본이고, 여기는 부팅 순서만 적는다. 각 단계는 `boot-report.ts` 의 `step`/`stepSync` 로 래핑돼 성공/실패·소요가 계측된다(0077). 창이 받는 부팅 보고(`oo:boot:report`)는 데이터 호스트가 두 호스트의 단계를 합친 것이다. `critical: true` 단계 실패만 부팅을 막는다.

```
셸 (src/main/index.ts · app/shell/)
1. app.whenReady() → registerAppProtocol()   # app:// 커스텀 스킴 핸들러
2. createHostBoot → start()                  # 데이터 호스트 fork → ready → 에이전트 호스트 fork → ready → 피어 포트 1쌍
3. createWindow()                            # 2 와 병행. BrowserWindow + webPreferences 명시(§보안). 창은 oo:boot:whenReady 로 두 호스트 준비를 기다린다
4. 창 문서마다 두 호스트의 포트를 받는다       # preload 가 채널 소유 표(shared/channel-owner.ts)로 전송을 고른다
5. will-quit → shutdownHosts                 # 에이전트 호스트(런타임 정지) → 데이터 호스트(예약 작업 → 스케줄러 → DB 닫기)

데이터 호스트 (app/data-host/bootstrap.ts — DB·설정·비밀·인증의 유일한 소유자)
0. 동기 구간(첫 await 전)                     # 창이 붙자마자 부르는 채널
   - registerSettingsReadHandler               # oo:settings:get — TweakProvider 첫 테마 읽기 (0244)
   - 오류 보고 싱크·핸들러                      # 두 호스트의 오류 보고를 창에 준다
   - 비밀 해제(셸 서비스) → 인증 스택 + registerConnectionHandlers  # oo:provider:state 등 게이트 판정 채널 (0181/0188)
a. db-init (critical)                        # initDb — better-sqlite3 초기화 + 마이그레이션(infra/db/migrations/)
a-2. chat-recovery (critical)                # recoverSessionHistory — 미완료 도구 호출 정착 + FTS text-cache 공백 복구 (persistence.md §1.3)
b. cost-recompute (critical)                 # UsageTracker — 부팅 1회 일/주/월 합산 + 비용 요약 push 배선
c. Scheduler · 예약 작업                      # 'usage-recompute' job(0091) · 사용자 예약 작업 타이머
d. workspace · config-dir · builtin-skill-seed · provider-scaffold · skill-scan
e. 저장 스트림 수신기 + 에이전트 링크          # 턴 저장 입력을 도착 순서대로 UsageTracker → HistoryWriter 에 넣는다
f. 세션·프로젝트·검색·설정·MCP·스킬·사용량·예약 작업·인증 핸들러 등록 → ready

에이전트 호스트 (app/agent-host/bootstrap.ts — 어댑터·SDK·하네스 프로세스의 유일한 소유자)
a. 설정 사본·데이터 링크·저장 스트림 송신기    # DB·설정 파일·비밀 저장소를 열지 않는다
b. adapter-registry (critical)               # 어댑터 설치 상태 갱신
c. RuntimeSupervisor(cap 5 · BoundedRuntimeCapPolicy · ActiveTurnTracker→concurrency push)
d. TypedBus 구독 순서 SSOT: 저장 송신 → title → relay  (§runtime-ipc §2.4)
e. PendingMessageQueue · ApprovalCoordinator · PermissionModeController · extension-deploy
f. chat/engine/extension/composer/git 핸들러 등록 → 부팅 보고를 데이터 호스트로 → ready
```

> critical 이 아닌 단계 실패는 부팅을 막지 않는다(채팅/세션 기능은 config/deploy 와 독립). 레거시 1회성 이전(구 평면 레이아웃·구 orca-mcp 스토어)은 정식 배포 전 정리(handoff 0011)로 제거 — 구 dev 환경은 `~/.config/orcinus-orca` 재생성으로 해결.

### 3.2 모듈 간 import 규약

- **Main** → `shared` (타입 + protocol zod 스키마) 만. `renderer` 절대 import 금지.
- **Preload** → `shared/ipc.ts` (zod 의존 없는 순수 TS 타입) 만. `protocol.ts` (zod) import 금지 (sandbox=true 에서 zod 작동 안 함).
- **Renderer** → `shared/ipc.ts` 만. `main` 절대 import 금지.

---


## 4. 현재 구현 상태

| 영역 | Phase | 상태 | 비고 |
|---|---|---|---|
| BrowserWindow + 보안 옵션 명시 | Phase 1 | ✅ 완료 | `main/index.ts` |
| 컴포지션 루트 + 5-레이어 재편 | Phase 3++ | ✅ 완료 | `app/{data-host,agent-host}/bootstrap.ts` + `app/handlers/` + `features/*` (handoff 0062 · 0324, 채널 카탈로그는 IPC_CONTRACT §2) |
| 모든 invoke 의 zod 검증 | Phase 2 | ✅ 완료 | `infra/ipc/handle.ts` 헬퍼 + `shared/protocol.ts` |
| SessionAdapter 인터페이스 | Phase 2 | ✅ 완료 | `adapters/common/types.ts` |
| ClaudeAdapter (SDK `query()` · 장수명 채널 pushTurn) | Phase 3 | ✅ 완료 | `adapters/claude/adapter.ts` (구 claude-code.ts). CLI spawn 폐기 (2026-05-18) |
| `claude/adapt.ts` (TurnExtensions → claude 옵션 변환) | Phase 3++ | ✅ 완료 | 공통 실행 설정은 SDK 타입으로 조립하고 plugin·systemPrompt·skill·hook은 대화 호출부에서 합성 |
| ExtensionBuilder | Phase 3++ | ✅ 완료 | `features/extensions/common/builder.ts` — DB 지침·settings·Skills·plugin/runtime tool로 TurnExtensions 조립 |
| SessionRuntime + RuntimeSupervisor (세션별 런타임 거버넌스) | Phase 4 | ✅ 완료 | `features/sessions/` — 장수명 세션 채널(프레임) · idle 풀 LRU cap 5 · 세션별 pending message queue(`features/chat/`). runtime-ipc.md §1 |
| OpencodeAdapter | Future | ❌ 미구현 | PRD OQ7 |
| AdapterRegistry | Phase 2 | ✅ 완료 | claude 단일 등록 |
| Installer (래퍼) | Phase 2 | ✅ 완료 | 4줄 — 어댑터의 `install()` yield |
| electron-store | Phase 3++ | ✅ 완료 | `infra/settings-store.ts` (키 카탈로그는 persistence.md §1.2 / IPC_CONTRACT §2.4) |
| Skills 스캔 (Orcinus orca sources + Claude native skills) | Phase 2 | ✅ 완료 | `features/extensions/common/skills/scan.ts` — 루트는 app 하네스 조립부가 제공. native 경로는 [adapters.md §1.3](./adapters.md#13-claudecodeadapter-호출-패턴), 캐시는 `Bootstrap.skillsCache` |
| Skills 번들 시딩 (부트 1회) | Phase 4 | ✅ 완료 (0078) | `features/extensions/common/skills/seed.ts` + `app/builtin-resources.ts` — manifest/marker 버전 게이트 |
| ExtensionDeployer | Phase 3++ | ✅ 완료 | `features/extensions/claude/deployer.ts` — sources → `dist/<engine>/` 렌더 (표준화 스테이지 A) |
| 인증 만료 감지 (`auth.expired`) | Phase 2 | ✅ 완료 | UI 에 AuthExpiredModal 노출 |
| 로컬 DB (sessions / messages / parts / projects) | Phase 3 | ✅ 완료 | better-sqlite3 + 마이그레이션(`infra/db/migrations/`, `0001_initial` 부터 순번). |
| FTS5 전문 검색 (`messages_fts`) | Phase 3++ | ✅ 완료 | `0003_messages_fts.sql` + `oo:search:messages` IPC |
| MCP 서버 CRUD + safeStorage 인증 비밀 | Phase 3++ | ✅ 완료 | `features/extensions/common/mcp/store.ts` + `infra/config/secret-store.ts`. 파일-백드 모델. |
| 산출물 게시 · 게시 원본 파일 (`features/artifacts`) | Phase 4 | ✅ 완료 (0223·0226·0232) | 모델 직접 호출 `publish_artifact` runtime tool + 우측 목록 + Work 일반 출력 파일 수집. 보관 규칙 persistence.md §1.4 |
| 자동 업데이트 (electron-updater) | Phase 4 | ✅ 완료 (0084~0086) | `app/updater.ts` UpdateController + `handlers/update.ts`(update 6채널) + `shared/update-restart.ts` 재시작 게이트. runtime-ipc.md §3.1 |
| 스케줄러 (주기 실행) | Phase 4 | ✅ 완료 (0091) | `features/scheduler/` (croner) — 첫 소비처 = 주기 사용량 recompute. `schedule_runs` 실행 이력(`0013`) |
| provider별 사용량 한도 | Phase 4 | ✅ 완료 (0079~0082) | `provider_limits`(`0012`) + `cost:usage`/`cost:setProviderLimit` |
| CI/CD 릴리스 파이프라인 (v0.1.0) | Phase 4 | ✅ 완료 (0087~0089) | `.github/workflows/{ci,release}.yml` — Windows unsigned NSIS + GitHub Releases **즉시 게시**(`v*` 태그 push 시. 수동 dispatch 는 항상 dry-run). 배포 빌드는 로그인 게이트 스킵(0089). 정본 [`../../guides/release-operations.md`](../../guides/release-operations.md) |
| 중앙 로깅 (LogManager · JSONL · redaction) | Phase 4 | ✅ 완료 (0123/0124, prod opt-in 토글 0144) | `infra/log/` — 외부 로깅 라이브러리 미도입. 정본 [observability.md](./observability.md) |
| **인증 + 소비 경계** (앱 로그인 + Harness 실행 구성 + Plugin) | Phase 4 | ✅ **0181 재작성 → 0188 경계 분리** | `contracts/auth.ts` 가 **인증만** 표현하고 `features/{auth,gate,harnesses,plugins}` 가 구현이다. 인증 5종(api-key·password·pat·**oauth code→token**·browser-session) · IPC `provider` 6채널(compat) · 카탈로그 연결 탭. 실값과 배선은 `app/deployment/` 에서 채운다. 구조 정본 [`auth.md`](./auth.md) |
| **원격 전송 스택 단일화** (Node 전역 `fetch` 금지 → Chromium 스택) | Phase 4 | ✅ 완료 (0173/0174) | 전역 `fetch(` 호출은 `infra/net/net-fetch.ts` 에만 허용(`no-node-fetch.test.ts` 가 0건으로 고정), 소비자는 `typeof fetch` 포트 주입. Chromium 스택을 무는 파일은 **3개**(`net-fetch`·`net-request`·`browser-session`). [security.md](./security.md) §1.8 |
| `options.permissionMode` (도구 권한) | Phase 4 | ✅ 완료 | `shared/permission-mode.ts`(`NormalizedPermissionMode` ↔ SDK 모드 변환) + `features/approvals/permission-mode-controller.ts`(세션 SSOT) + `oo:permission:setMode`. 진행 중 턴은 어댑터가 살아있는 `Query` 핸들에 즉시 위임한다. **MVP 기본값 정책은 PRD OQ9 로 계속 열려 있다** |
| `options.hooks` (in-process 콜백) | Phase 4 | ✅ 완료 | `adaptHooks` + 어댑터 내부 훅(workspace guard · Stop git sync · Stop 출력 수집)을 `adapters/claude/adapter.ts` 가 병합 — adapters.md §3.2.5. 사용자 작성 hook 파일 배포는 하지 않는다(engine-specific) |
| 멀티세션 + 장수명 세션 채널 | Phase 4 | ✅ main 런타임 완료 (handoff 0011·0051·0067) | 세션별 SessionRuntime + 동시 턴 + 장수명 채널(프레임)·idle 풀 LRU. runtime-ipc.md §1. renderer 외피는 ../frontend/state.md §2 |
| Zustand persist 전략 (renderer store ↔ 로컬 DB / electron-store) | Phase 4 | ❌ 미정 OQ | ../frontend/state.md §1.4.6 |
| i18n | Phase 4 | ✅ 완료 (0096/0097) | `renderer/src/shared/i18n/` — i18next + react-i18next. UI 라벨은 리소스 번들, 기술 용어·터미널 출력은 영어 |
| **Provider Runtime Model (정규화 계층)** | Phase 4 | ✅ 와이어 전환 완료 · 일부 seam 미활성 | `NormalizedEvent`(`shared/ipc.ts`, variant 수는 [생성물](../../generated/inventory.md)) 이 `oo:chat:event` 의 유일한 페이로드이고 매핑은 `adapters/claude/map.ts` 다. PermissionBridge·PermissionModeController·ErrorClassifier·Telemetry 활성. **미활성 seam**: `RevertManager`(claude 는 전 cap false) · `provider` 축 claude 고정(opencode 미구현). 절별 상태는 [provider-runtime.md](./provider-runtime.md) |
| Git worktree 격리 세션 (`features/worktrees`) | Phase 4 | ✅ 완료 (0209~0211·0241) | 세션별 managed worktree 생성·수명·표시명(`managed_worktrees`), Stop 시 git sync 훅, git 호출 게이트웨이(`infra/git/`, security.md §1.10) |
| Work / Code 에이전트 종류 (`features/agents`) | Phase 4 | ✅ 완료 (0224·0234·0235) | 고정 프로필 + Work 시스템 프롬프트(`# Agent` 섹션) + 종류별 spawn env(`SessionAdapter.agentSpawnEnv`). 종류는 `sessions.agent_kind`(`code`/`work`) |
| 백그라운드 작업 (`features/chat/background-controller.ts`) | Phase 4 | ✅ 완료 (0231·0232·0239) | 원본 journal(`background_task_events`)·출력 읽기·중단 정착 — [background-tasks.md](./background-tasks.md) |
| 런타임 모델 카탈로그 (`features/harnesses`) | Phase 4 | ✅ 완료 (0198·0202·0238·0246·0258) | 인증 뒤 Claude Code `availableModels` 수집·무효화 범위·모델 계열 판정 |
| 사내 서비스 Plugin (`features/plugins/{confluence,jira,mail}`) | Phase 4 | ✅ 완료 (0188·0236·0237·0248) | 자격증명 Plugin 과 로그인 프리 Plugin 이 같은 binding(`app/deployment/plugins.ts`)으로 등록 — [auth.md §7](./auth.md) |
| 전역 오류 보고(toast) (`infra/error-report`) | Phase 4 | ✅ 완료 (0242) | main/renderer 공통 `reportError` → 토스트 — observability.md §7 |
| 일일 로그인 게이트 (`features/gate/daily.ts` · `app/daily-gate.ts`) | Phase 4 | ✅ 완료 (0255) | 실행 중 로컬 날짜 경계에서 통과 해제 — [ADR-008](../../decisions/008-daily-login-gate.md) · auth.md §5.3 |
| 폐쇄망 spawn env 주입점 (`app/deployment/spawn-env.ts`) | Phase 4 | ✅ 완료 (0207) | 배포가 `SPAWN_ENV_INJECTOR` 를 채우면 모든 Harness+ModelProvider subprocess env 에 실린다(최상위 레이어, 기본 배포는 비움). host-managed provider 표식(0200)은 `adapters/common/harness-config.ts` 가 조립 — security.md "Agent provider auth token" |

> 이 표는 코드 변경 시 함께 갱신한다.

---


## 5. 참고

- IPC 채널 정의: [IPC_CONTRACT.md](../../IPC_CONTRACT.md)
- 용어 정의: [GLOSSARY.md](../../GLOSSARY.md)
- 프론트엔드 측 구조: [../frontend/overview.md](../frontend/overview.md)
- 데이터 모델 / 어댑터 사양 SSOT: [TRD.md](../../TRD.md) §6 / §7
- 외부 SDK 사양 SSOT: [`docs/spec/claude/agent-sdk/typescript.md`](../../spec/claude/agent-sdk/typescript.md)
- CLI 시기 외부 계약 + Orcinus orca 채택 표기: [claude-code-spec.md](../../claude-code-spec.md)
- Phase 로드맵 / Future Scope: [PRD.md](../../PRD.md) §8 / §9 / §11
- 운영 규칙: [`app/AGENTS.md`](../../../app/AGENTS.md)
