# Glossary

> 이 프로젝트에서 사용하는 용어를 한 곳에 정의한다. 문서·코드·UI 라벨이 같은 개념을 다르게 부르지 않도록 한다.
> 최종 업데이트: 2026-08-05 (handoff 0177 — Tweaks 키 수 실측 20 반영. §1 표제어는 0157/0161 판 유지)
> 관련 문서: [ARCHITECTURE.md](ARCHITECTURE.md), [IPC_CONTRACT.md](./IPC_CONTRACT.md), [TRD.md](./TRD.md), [PRD.md](./PRD.md)
> 사람용 해설(파생): [arch/frontend/terms.md](./arch/frontend/terms.md) · [arch/backend/terms.md](./arch/backend/terms.md) — 본 SSOT 를 쉬운 한국어로 풀어 링크하는 사람용 문서.

## 1. 도메인 용어

| 용어 | 정의 | 코드상 명칭 | 진실의 기준 |
|---|---|---|---|
| **Session (Orca Session)** | **대화 기록의 진실** — 앱/DB 기준의 대화 단위(메시지·이벤트·메타데이터·lineage). `sessionId` 로 식별, **DB row 가 SSOT**. 어댑터 외부 저장(jsonl)은 진실이 아니라 *SDK resume context*(아래)일 뿐이다. "새 대화" = 새 Orca Session. *실행 핸들*은 **SessionRuntime**, *SDK 실행 컨텍스트*는 **SDK resume context** — 아래 별도 표제어(세 개념을 한 단어로 뭉치지 않는다). | `sessionId: string`, `SessionRow`(`db/types.ts`), `ChatState.sessionId` | TRD §6.5 / `app/src/shared/ipc.ts` |
| **SessionRuntime** | 하나의 Orca Session 을 *실행*하기 위한 **일시적 실행 핸들** — SDK `query()` 핸들 + subprocess + AbortController + coarse 상태(`cold/idle/busy/interrupting/error/closed`, 단일 SSOT·비영속). 휘발·유자원: 한 Orca Session 에 대해 open→idle-close→reopen 으로 여러 번 생성될 수 있다(Session : Runtime = 1:N). **cap/LRU/idle-close 가 *세는 유닛* = 자원·프로세스 라이프사이클의 단위**(오케스트레이션 아님). | `SessionRuntime`(`app/src/main/features/sessions/session-runtime.ts`) | `etc/orca_lifecycle_orchestration_design_draft_ko.md` §A / 0050·0051 |
| **SDK resume context** | Claude SDK 가 `query`/`resume` 에 쓰는 **외부 실행 binding**(jsonl). 모델이 실제 조건화되는 라이브 컨텍스트에 가깝지만 **compaction 으로 손실적**이라 Orca DB(전문)와 발산할 수 있고 없어질 수도 있다. **대화의 진실이 아니다**(진실 = Orca Session DB). resume 실패 시 DB 기반 이어가기는 무손실 복구가 아니라 *reseed/bootstrap*. | (SDK 소유, jsonl) | `etc/orca_lifecycle_orchestration_design_draft_ko.md` §A·결정 ⑰ |
| **Message** | 세션 안의 단일 발화. `role: 'user' \| 'assistant'` + 본문 + (assistant 의 경우) 부착된 ToolCall 들. | `Message`, `ChatState.messages` | `app/src/renderer/src/features/chat/reducer/chatReducer.ts` |
| **NormalizedEvent** | 어댑터→Renderer 정규화 스트림(`orca:chat:event`)의 단위. provider 중립 discriminated union — 대표 예: `session.updated / message.delta / message.completed / tool.call.started / tool.call.completed / telemetry / error / permission.requested`. **전수 variant(현재 19종)는 IPC_CONTRACT §3 이 SSOT.** 모든 이벤트가 `sessionId`, tool 은 `toolRunId` 보유 — `provider` 필드는 싣지 않는다(0016 에서 제거, 백엔드 중립 코어). claude 어댑터가 `claudeToNormalized`(`adapters/claude-map.ts`)로 SDK 메시지를 직접 정규화한다. (구 `ChatEvent` 는 제거됨.) | `NormalizedEvent` | `app/src/shared/ipc.ts` (variant 목록은 IPC_CONTRACT §3, 설계는 provider-runtime.md §2) |
| **Delta** | 어시스턴트 응답이 스트리밍되는 동안 도착하는 부분 텍스트 조각. UI 에는 chat store 의 `live.text`/`live.reasoning`(구 `pendingDelta`, 0008/0013)에 누적되며 DB 에는 최종 메시지만 저장. | `message.delta`, chatStore `live` 슬라이스 | provider-runtime.md §2 / `features/chat/store/chatStore.ts` |
| **Backend** | LLM 실행 백엔드의 식별자. **현재**: `'claude'` 단일. **Future**: `'opencode'` 등 추가 가능. | `Backend` | `app/src/shared/ipc.ts` |
| **SessionAdapter** | 모든 백엔드가 구현하는 공통 인터페이스 (`isInstalled / install / sendMessage`). LLM 직접 호출이 아니라 외부 CLI/SDK 의 래퍼다. | `SessionAdapter` | `app/src/main/adapters/types.ts` |
| **AdapterRegistry** | 등록된 어댑터의 설치 상태를 추적하고 활성 백엔드를 결정. | `AdapterRegistry` | `app/src/main/adapters/registry.ts` |
| **Tool Call** | 어시스턴트가 호출한 도구 1회 (Read / Write / Bash 등). `toolRunId` 로 start/completed 쌍이 결합된다. | `tool.call.started`, `tool.call.completed` NormalizedEvent | provider-runtime.md §2 |
| **Skill** | `SKILL.md` frontmatter (name, description, argument-hint) 로 정의된 슬래시 명령. 입력창에서 `/skillname` 으로 호출. **스캔 루트**: orca `~/.config/orca/sources/skills/` + claude `~/.claude/skills/` (`<cwd>` 루트는 제거됨). 번들 스킬은 부팅 시 `sources/skills` 로 1회 시딩(0078). | `SkillInfo` | `app/src/main/features/extensions/skills/scan.ts` / `app/src/shared/ipc.ts` |
| **Fork (분기)** | 원본 Orca Session 을 잃지 않고 대체 방향을 시도하는 파생 — SDK 네이티브 `forkSession`(resume 복사본 + **새 session_id**, 원본 불변)에 위임하고, Orca 는 도착 세션에 원문 display 복사 + lineage(`fork`)만 남긴다. 렌더러는 클릭 시 **DOM draft 뷰만** 만들고 첫 보내기에서 lazy 물질화(취소 = no-op, 영속 0). v1 = 전체 대화 분기. | `SendChatMessage.forkFrom`, `TurnRequest.forkFrom`, `chatStore.startForkDraft` | handoff 0064 / `app/src/main/features/orchestration/fork.ts` |
| **Handoff (핸드오프)** | 컨텍스트 소진/과업 전환 시 대화를 **새 Orca Session 으로 잇기** — rebind 방식: fork 로 전체 맥락을 전달하고 도착 세션의 첫 프롬프트(`/compact [핸드오프] …` 자동 메시지, main 단일 출처 템플릿)가 SDK 네이티브 압축으로 요약을 생성한다. 클릭 = **즉시 물질화**(fork 와 달리 display 복사 없음), lineage(`handoff`). Orca 자체 요약 파이프라인 없음. | `SendChatMessage.handoffFrom`, `buildHandoffMessage`, `chatStore.startHandoff` | handoff 0064 / `app/src/main/features/orchestration/handoff.ts` |
| **Lineage (세션 계보)** | fork/handoff 로 파생된 세션의 부모 관계 영속 — `session_lineage`(child PK · parent · relation `'fork' \| 'handoff'` · CASCADE). hot `sessions` 행을 오염시키지 않는 전용 테이블. v1 은 기록만(시각화 UI 는 Future). | `session_lineage`, `insertLineage`/`getLineage` | handoff 0064 / `app/src/main/infra/db/migrations/0011_session_lineage.sql` |
| **Tweaks** | 사용자 환경 설정 — `theme`(white/dark) / `density` / `sidebarCollapsed` / `sidebarWidth` / `spendingLimitUsd` 등. electron-store 로 영속 (전체 20 키 카탈로그는 IPC_CONTRACT §2.4 / persistence.md §1.2). | `Tweaks` | `app/src/renderer/src/shared/hooks/useTweaks.ts` |
| **Artifact** | 큰 산출물 — 첨부 파일, 모델이 생성한 markdown / 코드 / 이미지 등. **Phase 3+ 채택 결정**: 파일 시스템 (`<userData>/artifacts/<sessionId>/...`) 에 저장하고 DB 에는 경로·해시·크기만 보관. 현재 미구현. | (Phase 3+ 도입 예정) | [arch/backend/persistence.md](arch/backend/persistence.md) |
| **Credential** | 어댑터별 자격증명 — base URL + API key 등. **부분 구현**: MCP 인증 비밀은 Electron safeStorage(OS keychain) 기반 secret-store(`orca-secrets`)로 구현 완료. 어댑터별 base URL/API key 저장은 Future (claude 어댑터는 SDK 가 `~/.claude` 자격증명 자동 사용, provider settings env 는 verbatim — security.md §1.4). | `secret-store` | [arch/backend/security.md](arch/backend/security.md) |
| **Provider (인증 대상)** | 폐쇄망 배포가 채우는 **유일한 인증 선언**. `id`·`label`·`kind`·`origin`·`auth[]`(+`tools`/`llm`). ⚠️ **"LLM Provider" 와 다른 어휘다** — 아래 §3 의 금지어는 *LLM 백엔드* 의미의 Provider 이고, 이 표제어는 *인증 대상* 이다. 구분이 필요하면 "인증 provider 선언" 으로 풀어 쓴다. | `Provider`(`main/contracts/provider.ts`) | 0181 / `guides/closed-network-extensions.md` |
| **Provider kind (관계)** | `gate`(앱 로그인) · `llm`(모델 게이트웨이) · `service`(사내 REST). **프로토콜이 아니라 관계**다 — 누가 누구를 상대하는가만 말하고, 프로토콜은 `AuthSpec` 안에 접혀 있다. 구 구조가 무너진 이유가 프로토콜 enum 을 1급 축으로 둔 것이었다. | `ProviderKind`(`shared/ipc.ts`) | 0181 |
| **AuthSpec** | provider 선언 **안에 인라인**된 인증 방식. 5분기 — `api-key`·`password`·`pat`(코어 구현) · `oauth`(code→token) · `browser-session`(ADFS/WIA). **배열이고 선언 순서가 GUI 선택지 순서**다. 별도 레지스트리를 id 로 참조하지 않으므로 cross-reference 검증이 성립하지 않는다. | `AuthSpec`(`main/contracts/provider.ts`) | 0181 (구 **Auth provider**, 0180 제거) |
| **Grant** | 인증의 결과물. `secret`(vault 키) · `token`(vault 키 + 만료 + refresh 키) · `session`(cookie jar 그룹) 3종이며 **`providerId → Grant` 단일 맵**이다. 구 `bindingId`·`parentBindingId`·cascade·fingerprint 는 없다 — 참조가 없어 무결성 검증도 없다. | `Grant`(`main/contracts/provider.ts`) | 0181 (구 **Auth binding**, 0180 제거) |
| **ProviderApi** | 앱 안의 다른 모듈이 인증을 쓰는 **단일 포트** — `request`(정책+주입+전송) · `materialize`(env/헤더, 미인증이면 `null`) · `token`(MCP `${BINDING:}` 용 동기 조회). 소비 슬라이스는 `Pick<ProviderApi, …>` 로 좁혀 받는다. | `ProviderApi`(`main/contracts/provider.ts`) | 0181 (구 **InternalApi**, 0180 제거) |
| **Connector** | *(0180 에서 제거, 0181 이 대체)* 인증된 요청으로 사내 서비스 기능을 제공하던 contribution. 지금은 `Provider{kind:'service'}` 의 `tools` 가 그 자리다. | *(어휘 폐기)* | 0157 → 0180 제거 → **0181 대체** |
| **Plugin** | 두 레지스터를 구분한다: (A) UI 우산어인 플러그인 카탈로그 탭(`nav.plugins` — 0180 현재 스킬·MCP 2탭), (B) Claude Code 플랫폼 배포 산출물(`ORCA_PLUGIN_NAME`). 0157~0178 의 (C) *provider·connector 를 묶는 빌드타임 패키지* 는 **0180 에서 사라졌다**. 문맥 없이 서로 대체하지 않는다. ⚠️ **"플러그인을 추가한다" 는 요청은 provider 선언(빌드타임) 또는 MCP 서버(런타임) 로 번역해야 한다** — 라우팅 표는 [`guides/closed-network-extensions.md §0`](guides/closed-network-extensions.md). | `nav.plugins` · `ORCA_PLUGIN_NAME` | 0159 → **0180 개정** |
| **로그인 게이트** | `kind:'gate'` provider 선언 여부로 켜지는 앱 진입 게이트. **prod 는 선언 0 이면 통과**(OSS/기본 배포가 잠기지 않게 하는 안전장치), **DEV 는 선언 0 이어도 게이트를 세운다**(`alwaysRequired` — 로그인 화면 도달성. 탈출구는 디버그 패널 우회 토글 하나). 멤버가 여럿이면 **전부 `valid` 일 때만** 통과, **판정 전에는 통과시키지 않는다**(fail-closed). ⚠️ **UX 게이트이지 보안 경계가 아니다** — 인증 전에도 main IPC 는 열려 있다. | `evaluateGate`(`features/providers/gate/`) | 0181 (구 **Auth target `application`**) |
| **Session group** | 여러 provider 가 **같은 Electron cookie jar 를 직접 공유**하도록 지정하는 논리 이름(`persist:auth.<group>` partition). ADFS SSO cookie 가 여러 서비스의 redirect 에서 재사용되는 폐쇄망 구조를 모델링한다. partition 간 cookie 복사는 공유가 아니라 수동 복제이며 사용하지 않는다. | `BrowserSessionStore`(`main/infra/browser-session.ts`) | 0157 → **0181 복원** |
| **Presentation** | secret 을 HTTP 요청의 header·cookie·query 중 **어디에 어떤 형식으로** 넣는지에 대한 선언. **방식(kind)에서 추론하지 않는다** — 같은 PAT 를 서비스별로 Bearer / Basic password / `PRIVATE-TOKEN` 으로 다르게 붙인다. `AuthSpec` 이 소유한다. | `Presentation`(`main/contracts/provider.ts`) | 0157 → **0181 개정**(구 `CredentialPresentation`) |
| **PKCE / state** | OAuth code→token 의 가로채기·CSRF 방어. **코어가 발급·보관·대조한다**(`ctx.pkce()`·`ctx.state()`) — 배포 선언은 값을 URL 에 싣기만 한다. `state` 는 **파일에 보관**돼 루프백 콜백 전 앱이 재시작돼도 대조가 성립한다. | `features/providers/auth/oauth.ts` | 0181 |
| **Project** | 대화를 묶는 컨테이너 — 지침(instructions)·작업 디렉토리 스코프 보유. **구현 완료**: CRUD 5채널(`orca:project:*`) + 카드 그리드(`ProjectsScreen`) + 랜딩(`ProjectLandingPage`). | `Project`, `ProjectsScreen.tsx` | IPC_CONTRACT §2.7-b / `app/src/shared/ipc.ts` |
| **Python Runtime / uv / buildPyEnv** | **제거됨 (0050 PR-B)** — uv 기반 격리 Python 환경(`<userData>/runtime`)과 `RuntimeStatus`/runtime IPC 채널은 main 에서 삭제됐다. uv 사용 규약 정책 append(`prompts/policies/python-runtime.md`, 0030)만 프롬프트 계층에 잔존. 어휘는 재사용하지 않는다. | (제거) | IPC_CONTRACT §2.11 주석 / `arch/backend/system-prompt.md` |
| **Scheduler** | main 프로세스 in-app 주기 실행 엔진 (croner — 앱 실행 중만 발화). job 등록·겹침 방지(`protect`)·실행 이력(`schedule_runs`). 첫 소비처 = 주기 사용량 recompute(설정 `scheduler.usageRecompute`). job action 은 컴포지션 루트가 주입(교차 feature 회피). | `Scheduler`(`features/scheduler/`) | handoff 0091 / `arch/backend/runtime-ipc.md` §3.1-b |
| **사용량 한도 (Spending Limit)** | 월간 지출 한도(USD) — 전역 `spendingLimitUsd`(설정) + provider별 한도(`provider_limits` 테이블). 실사용 SSOT(UsageTracker/costStore)에서 `computeUsageLimits`(`shared/usage/limits.ts`)로 **파생만** 하며 한도 자체는 사용량을 계산하지 않는다. UI = UsagePanel 도넛 팝오버 + 설정 사용량 탭. | `spendingLimitUsd`, `provider_limits` | handoff 0079~0082 / `arch/frontend/rendering.md` §1.9 |

## 2. 아키텍처 용어

| 용어 | 정의 |
|---|---|
| **Main Process** | Electron 의 Node.js 환경. BrowserWindow / IPC 핸들러 / SDK 호출 / 파일 시스템 / 설정 저장 담당. |
| **Renderer Process** | Electron 의 Chromium sandbox 환경. React UI 렌더링 담당. Node API 직접 접근 불가. |
| **Preload** | Main 과 Renderer 사이의 다리. `contextBridge.exposeInMainWorld('orca', ...)` 로 화이트리스트된 API 만 노출. |
| **IPC** | Inter-Process Communication. Main ↔ Renderer 메시지 채널. `orca:<domain>:<action>` 명명. |
| **contextBridge** | Electron API. preload 스크립트가 sandboxed renderer 에 안전하게 함수를 노출하는 도구. |
| **window.orca** | Renderer 에서 IPC 호출을 위한 단일 진입점. 노출 표면은 [IPC_CONTRACT.md](./IPC_CONTRACT.md) §2 참조. |
| **Phase 1·2·3·4** | PRD §8 의 단계별 로드맵. Phase 1 = 시각 재현, Phase 2 = IPC + 단일 어댑터 + 세션 재개, Phase 3 = 과거 대화 목록, Phase 4 = 멀티 세션. |
| **Frame** | 셸의 외곽 — `app-frame-root` element 와 그 자식 슬롯 트리 (header / grid / body / sidebar / pane-host / tile / composer / overlay / modal / debug). *DOM 마커 체계*이며 구 `src/renderer/src/frame/` 디렉토리는 PR #29 로 해체됨(셸 컴포넌트는 `app/` 직속). [arch/frontend/dom-architecture.md](arch/frontend/dom-architecture.md) SSOT. |
| **Tile** | `app-frame-pane-host > pane-row > app-frame-tile` 트리의 단위. tile 의 *내용물* 은 도메인 화면(Screen) 이다. 채팅 tile(`ChatTile`) 우측에 **plan 모드 계획 타일(`PlanTile`)** 이 `app-frame-tile-separator` 분리선으로 분할되어 붙는다(ExitPlanMode 시 자동 오픈 + 헤더 `panelR` 토글). |
| **Screen** | tile 의 *내용물* 인 도메인 화면(개념). 구 `screens/` 디렉토리·`registry.ts` 는 PR #29 로 해체 — 화면은 `features/<domain>/components/` 의 뷰(`*Screen.tsx`/`*View.tsx`)를 `pages/*Page.tsx` 가 조립한다. |
| **Header** | `app-frame-header` 슬롯 — 셸 최상단 OS 윈도우 헤더 (액션 5-버튼 툴바 + WinControls). tile 의 헤더(`app-frame-titlebar`) 와 구분된다. *Phase 3++ 이후*: 브랜드는 Sidebar 의 `app-frame-sidebar-brand` 로 이동했고, breadcrumb 표시는 제거. header-left 는 menu / panelL / search / arrowL / arrowR 5-버튼 툴바. |
| **Slot** | 마크업 트리에서 정해진 자리. `app-frame-*` 클래스 + (필요 시) `data-context` 로 식별. |
| **Engine** | 코딩 에이전트 런타임의 구체 구현 (ClaudeEngine / OpenCodeEngine). **설계 채택**: 범용 `BackendAdapter` 를 미리 만들지 않고 구체 클래스로 시작, 3번째 엔진에서 공통 추출 (rule of three). 현행 코드는 `SessionAdapter`(claude 단일). 정본 [arch/backend/standardization.md](./arch/backend/standardization.md) §4. ("Backend" 와 의미 인접 — Engine 은 *전체 런타임*, Backend 는 *식별자/얇은 세션 계약*.) |
| **표준 계층 / 런타임 계층** | 배포 시점(세션 전 — 무엇을 배포·주입) vs 실행 시점(세션 중 — 이벤트·권한·되돌리기). 단방향 연결 (배포 산출물 → 런타임 입력). 정본 [standardization.md](./arch/backend/standardization.md) §3 / [provider-runtime.md](./arch/backend/provider-runtime.md). |
| **sources / dist** | 확장 리소스의 단일 원천(`~/.config/orca/sources/`, 사람 편집) ↔ 엔진별 생성물(`dist/<engine>/`, 편집 금지). **설계 채택 / 구현 대기** — 현행 `renderClaudePluginPackage()` 은 `~/.config/orca/` 직접 write. 정본 standardization.md §5.1. |
| **ExtensionDeployer** | `sources` 를 엔진 규약으로 render → validate → backup-then-write 하는 배포기 (dryRun 지원). 현행 선례: `mcp/convert.ts`(`toClaudeConfig`/`toOpencodeConfig`). 정본 standardization.md §5.2. |
| **StandardConformance** | 엔진을 "표준(AGENTS.md·MCP·SKILL.md·hook)을 얼마나 구현하나"로 기술하는 구조 (+ `mcpSpecVersion`). 정본 standardization.md §5.3. |
| **AGENTS.md** | instructions 업계 표준 (AAIF / Linux Foundation). **설계 채택 방향**: Orca instructions SSOT (현 `systemPromptAppend` + 정적 정책 append `prompts/` 와 통합 경로). 코드 미도입. 정본 standardization.md §5.4. |
| **TurnExtensions / Extension(확장 리소스)** | 한 턴에 주입하는 활성 확장 리소스 묶음 (mcp · skills · hooks · systemPromptAppend) — Extension 계층의 *런타임 조립물*. `ExtensionBuilder`(`app/src/main/features/extensions/builder.ts`) 가 정규 소스에서 생성하고 어댑터가 자기 query 옵션으로 어댑트한다. `ExtensionDeployer` 의 배포-시점 산출물(dist/)과 대응하는 *주입-시점* 묶음. (구 `OrcaCapabilities`/`CapabilityBuilder` — 아래 capability 어휘 충돌로 개명, `TurnRequest.extensions`.) 타입 `app/src/main/adapters/turn.ts`(`TurnExtensions`). |
| **SessionCapabilities / capability(능력 탐지)** | 백엔드가 *지원하는* 라이프사이클 기능(fork/revert/abort/structuredOutput…)의 서술. 방향: **백엔드→앱**(탐지·게이팅), 시점: **세션 중**(런타임 계층). UI 가 `false` 인 액션을 사전 비활성/숨김(사후 `capability_unsupported` 보다 UX 우월). **Extension(주입 묶음, 앱→백엔드, 세션 전)과 무관한 별개 개념** — 이 어휘 충돌을 없애려 per-turn 묶음을 Extension 으로 개명했다. 순수 DTO 는 `app/src/shared/ipc.ts`(SSOT, `ProviderDescriptor`), main 측 정적 서술자는 `app/src/main/adapters/descriptor.ts`. 정본 provider-runtime.md §4. |
| **CapabilityProbe** | 한 provider 의 능력을 탐지해 `ProviderDescriptor` 를 반환하는 추상화(설계 어휘). 현행 구현은 별도 probe 클래스 없이 **정적 서술자** `CLAUDE_DESCRIPTOR`(`app/src/main/adapters/descriptor.ts`, 문서 지식 기반)를 `AdapterRegistry.describeAll()` 이 `backend:list` 에 computed-on-the-fly 부착(영속 안 함). opencode SDK introspection 은 future seam. |
| **RevertManager** | 되돌리기 능력의 런타임 seam(설계 어휘). **conversation revert ≠ file revert — 절대 병합 금지**(§5). 구 `capabilities/revert-manager.ts` seam 코드는 정리됐고 현재는 `RevertCapabilities` DTO(`app/src/shared/ipc.ts`)만 잔존 — claude 는 전 cap false. 설계 정본 provider-runtime.md §5 유지. |

## 3. 사용하지 않는 용어 (혼동 방지)

다음 용어는 이 프로젝트에서 **사용하지 않는다**. 의미가 모호하거나 다른 용어와 겹친다.

> **'세션' 과부하 주의 (2026-06-29 정제, 0051):** "Session" 은 **Orca Session(대화 기록, 위 §1)** 만 가리킨다. SDK 측의 *실행 컨텍스트* 는 "SDK 세션" 이 아니라 **SDK resume context**(데이터/jsonl), *실행 핸들* 은 **SessionRuntime**(프로세스)로 부른다. "SDK 세션" 같은 표현은 셋을 뭉치므로 지양한다.

- ❌ **"LLM Provider"** → **Backend** 또는 **SessionAdapter** 로 통일. Orca 는 LLM API 를 직접 호출하지 않고 외부 CLI/SDK 를 래핑한다.
- ❌ **"Conversation"** → **Session** 으로 통일.
- ❌ **"Thread"** (대화 의미) → **Session** 으로 통일.
- ❌ **"Chat"** (도메인 객체로) → **Session** 으로 통일. "Chat 화면" 처럼 *UI 영역 이름* 으로는 허용 (단, 컴포넌트 이름은 `ChatTile` — 아래 *Pane* 항목 참조).
- ❌ **"Pane"** — DOM Architecture 의 마크업 슬롯에 없는 어휘. **Tile** (단일 tile) / **Screen** (도메인 화면) 으로 분리한다. 구 `ChatPane` 은 `ChatTile`, 구 `CameraPane` 은 `CameraScreen`. `app-frame-pane-host` / `app-frame-pane-row` 는 *복수 tile 의 가로 행* 을 가리키는 구조 마커로만 사용한다.
- ❌ **"Titlebar"** (셸 헤더 의미로) — `Header` 로 통일. `app-frame-titlebar` 는 *tile 내부 헤더* 만을 가리킨다.
- ❌ **"Token"** (UI 청크 의미로) → **Delta** 로 통일. LLM token count 의미로는 사용 허용 (`inputTokens` / `outputTokens`).
- ❌ **"SSO 모듈"**(0130) · **"Auth provider"**(0157) · **"Connector"**(0157) · **"Auth binding"**(0157) → 전부 **`Provider` 선언 + `AuthSpec` + `Grant`** 로 통일 (0181). 구 어휘가 가리키던 계약(`contracts/{sso,auth-method,connector,internal-api}.ts`)과 채널(`orca:sso:*`·`orca:auth:*`·`orca:plugin:*`)은 전부 제거됐다.
- ❌ **"설치형 플러그인"** (auth 문맥에서) — 확장의 축은 "선언형이냐 코드냐" 가 아니라 **"빌드 타임 내장이냐 런타임 MCP 냐"** 다 (0157). 인증 provider·내장 도구는 빌드 타임, 그 외 서비스 연동은 MCP. 런타임 임의 코드 로딩은 금지.
- ❌ **"Capture"** — Orca 의 도메인 카탈로그에서 제외 (사용자 결정). `CapturesScreen.tsx` 코드는 남아있으나 문서·논의에서는 거론하지 않는다.
- ❌ **"Provider"** (LLM 백엔드 의미로) — 위 "LLM Provider" 와 동일. 단, 예외가 **둘** 있다: ⓐ `orca.json` 의 `agents[].provider` 는 claude SDK 가 쓰는 클라우드 제공자(`anthropic`/`bedrock`/`vertex`) 필드명, ⓑ **0181 의 `Provider`(인증 대상)** — 위 §1 표제어. 후자는 LLM 백엔드가 아니라 *인증 상대* 이며, `kind:'llm'` 인 경우에도 그것이 가리키는 것은 "모델 게이트웨이와의 인증 관계" 이지 백엔드 자체가 아니다. 문맥이 섞일 자리에서는 **"인증 provider"** / **"Backend"** 로 풀어 쓴다.
