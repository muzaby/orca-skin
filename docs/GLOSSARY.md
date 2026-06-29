# Glossary

> 이 프로젝트에서 사용하는 용어를 한 곳에 정의한다. 문서·코드·UI 라벨이 같은 개념을 다르게 부르지 않도록 한다.
> 최종 업데이트: 2026-05-20
> 관련 문서: [ARCHITECTURE.md](ARCHITECTURE.md), [IPC_CONTRACT.md](./IPC_CONTRACT.md), [TRD.md](./TRD.md), [PRD.md](./PRD.md)
> 사람용 해설(파생): [arch/frontend/terms.md](./arch/frontend/terms.md) · [arch/backend/terms.md](./arch/backend/terms.md) — 본 SSOT 를 쉬운 한국어로 풀어 링크하는 사람용 문서.

## 1. 도메인 용어

| 용어 | 정의 | 코드상 명칭 | 진실의 기준 |
|---|---|---|---|
| **Session (Orca Session)** | **대화 기록의 진실** — 앱/DB 기준의 대화 단위(메시지·이벤트·메타데이터·lineage). `sessionId` 로 식별, **DB row 가 SSOT**. 어댑터 외부 저장(jsonl)은 진실이 아니라 *SDK resume context*(아래)일 뿐이다. "새 대화" = 새 Orca Session. *실행 핸들*은 **SessionRuntime**, *SDK 실행 컨텍스트*는 **SDK resume context** — 아래 별도 표제어(세 개념을 한 단어로 뭉치지 않는다). | `sessionId: string`, `SessionRow`(`db/types.ts`), `ChatState.sessionId` | TRD §6.5 / `app/src/shared/ipc.ts` |
| **SessionRuntime** | 하나의 Orca Session 을 *실행*하기 위한 **일시적 실행 핸들** — SDK `query()` 핸들 + subprocess + AbortController + coarse 상태(`cold/idle/busy/interrupting/error/closed`, 단일 SSOT·비영속). 휘발·유자원: 한 Orca Session 에 대해 open→idle-close→reopen 으로 여러 번 생성될 수 있다(Session : Runtime = 1:N). **cap/LRU/idle-close 가 *세는 유닛* = 자원·프로세스 라이프사이클의 단위**(오케스트레이션 아님). | `SessionRuntime`(`app/src/main/lifecycle/session-runtime.ts`) | `etc/orca_lifecycle_orchestration_design_draft_ko.md` §A / 0050·0051 |
| **SDK resume context** | Claude SDK 가 `query`/`resume` 에 쓰는 **외부 실행 binding**(jsonl). 모델이 실제 조건화되는 라이브 컨텍스트에 가깝지만 **compaction 으로 손실적**이라 Orca DB(전문)와 발산할 수 있고 없어질 수도 있다. **대화의 진실이 아니다**(진실 = Orca Session DB). resume 실패 시 DB 기반 이어가기는 무손실 복구가 아니라 *reseed/bootstrap*. | (SDK 소유, jsonl) | `etc/orca_lifecycle_orchestration_design_draft_ko.md` §A·결정 ⑰ |
| **Message** | 세션 안의 단일 발화. `role: 'user' \| 'assistant'` + 본문 + (assistant 의 경우) 부착된 ToolCall 들. | `Message`, `ChatState.messages` | `app/src/renderer/src/state/chatReducer.ts` |
| **NormalizedEvent** | 어댑터→Renderer 정규화 스트림(`orca:chat:event`)의 단위. provider 중립 discriminated union: `session.updated / message.delta / message.completed / tool.call.started / tool.call.completed / telemetry / error / permission.requested / permission.resolved`. 모든 이벤트가 `sessionId`·`provider`, tool 은 `toolRunId` 보유. claude 어댑터가 `claudeToNormalized`(`adapters/claude-map.ts`)로 SDK 메시지를 직접 정규화한다. (구 `ChatEvent` 는 제거됨.) | `NormalizedEvent` | `app/src/shared/ipc.ts` (provider-runtime.md §2 SSOT) |
| **Delta** | 어시스턴트 응답이 스트리밍되는 동안 도착하는 부분 텍스트 조각. UI 에는 `pendingDelta` 에 누적되며 DB 에는 최종 메시지만 저장. | `message.delta`, `ChatState.pendingDelta` | provider-runtime.md §2 / `chatReducer.ts` |
| **Backend** | LLM 실행 백엔드의 식별자. **현재**: `'claude'` 단일. **Future**: `'opencode'` 등 추가 가능. | `Backend` | `app/src/shared/ipc.ts:20` |
| **SessionAdapter** | 모든 백엔드가 구현하는 공통 인터페이스 (`isInstalled / install / sendMessage`). LLM 직접 호출이 아니라 외부 CLI/SDK 의 래퍼다. | `SessionAdapter` | `app/src/main/adapters/types.ts` |
| **AdapterRegistry** | 등록된 어댑터의 설치 상태를 추적하고 활성 백엔드를 결정. | `AdapterRegistry` | `app/src/main/adapters/registry.ts` |
| **Tool Call** | 어시스턴트가 호출한 도구 1회 (Read / Write / Bash 등). `toolRunId` 로 start/completed 쌍이 결합된다. | `tool.call.started`, `tool.call.completed` NormalizedEvent | provider-runtime.md §2 |
| **Skill** | `SKILL.md` frontmatter (name, description, argument-hint) 로 정의된 슬래시 명령. 입력창에서 `/skillname` 으로 호출. **스캔 경로는 어댑터별로 다르다** (현재는 claude 의 `~/.claude/skills/` + `<cwd>/.claude/skills/` 만). | `SkillInfo` | `app/src/main/skills/scan.ts` / `app/src/shared/ipc.ts:100-104` |
| **Tweaks** | 사용자 환경 설정 — `theme` / `density` / `sidebarCollapsed`. electron-store 로 영속. | `Tweaks` | `app/src/renderer/src/app/useTweaks.ts` |
| **Artifact** | 큰 산출물 — 첨부 파일, 모델이 생성한 markdown / 코드 / 이미지 등. **Phase 3+ 채택 결정**: 파일 시스템 (`<userData>/artifacts/<sessionId>/...`) 에 저장하고 DB 에는 경로·해시·크기만 보관. 현재 미구현. | (Phase 3+ 도입 예정) | [arch/backend/persistence.md](arch/backend/persistence.md) |
| **Credential** | 어댑터별 자격증명 — base URL + API key 등. **Phase 3+ 채택 결정**: Electron safeStorage (OS keychain) 로 암호화 저장. 현재는 미구현 (claude 어댑터는 SDK 가 `~/.claude` 자격증명 자동 사용). | (Phase 3+ 도입 예정) | [arch/backend/security.md](arch/backend/security.md) |
| **Project** | 프로젝트 카드 그리드 화면. **Phase 1 mockup 만** 구현 (실 데이터 없음). PRD §9 Future Scope. | `Projects.tsx` | PRD §9 |
| **Python Runtime** | 앱이 `<userData>/runtime` 에 제공하는 **uv 기반 격리 Python 환경** (venv + 인터프리터 3.12). agent 가 Python 도구를 실행할 때 시스템을 오염시키지 않도록 격리. 부팅 시 비동기 초기화(멱등·자가복구·`.ready` 마커), 상태는 `RuntimeStatus`(`idle/preparing/ready/error`). | `PythonRuntime`, `RuntimeStatus` | `app/src/main/runtime/` / `app/src/shared/ipc.ts` |
| **uv** | Astral 의 Python 패키지·인터프리터 관리자. 바이너리만 동봉(`resources/bin/`), 인터프리터는 첫 실행 시 다운로드(4-A). agent 는 `uv run python` / `uv pip install` 로 격리 환경에 수렴(이 사용 규약은 정적 정책 append `prompts/policies/python-runtime.md`, handoff 0030). | `buildPyEnv` | `app/src/main/runtime/env.ts` · `app/src/main/prompts/policies/python-runtime.md` |
| **buildPyEnv** | Python 런타임 환경변수의 **단일 소스**. 초기화와 agent 실행(SDK `query().options.env`)이 동일 env 공유. 인덱스/미러(`UV_DEFAULT_INDEX`·`UV_PYTHON_INSTALL_MIRROR`·`PIP_INDEX_URL`)는 하드코딩하지 않고 operator env pass-through — 미설정 시 공개 PyPI/github 기본. | `buildPyEnv()` | `app/src/main/runtime/env.ts` |

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
| **Frame** | 셸의 외곽 — `app-frame-root` element 와 그 자식 슬롯 트리 (header / grid / body / sidebar / pane-host / tile / composer / overlay / modal / debug). 코드상으로는 `src/renderer/src/frame/` 디렉토리에 1:1 대응. [arch/frontend/dom-architecture.md](arch/frontend/dom-architecture.md) SSOT. |
| **Tile** | `app-frame-pane-host > pane-row > app-frame-tile` 트리의 단위. tile 의 *내용물* 은 도메인 화면(Screen) 이다. 채팅 tile(`ChatTile`) 우측에 **plan 모드 계획 타일(`PlanTile`)** 이 `app-frame-tile-separator` 분리선으로 분할되어 붙는다(ExitPlanMode 시 자동 오픈 + 헤더 `panelR` 토글). |
| **Screen** | tile 의 *내용물* 인 도메인 화면. `src/renderer/src/screens/` 에 모임. 파일 명명은 `*Screen.tsx` (예: `ProjectsScreen`, `EngineScreen`). 화면 카탈로그는 `screens/registry.ts`. |
| **Header** | `app-frame-header` 슬롯 — 셸 최상단 OS 윈도우 헤더 (액션 5-버튼 툴바 + WinControls). tile 의 헤더(`app-frame-titlebar`) 와 구분된다. *Phase 3++ 이후*: 브랜드는 Sidebar 의 `app-frame-sidebar-brand` 로 이동했고, breadcrumb 표시는 제거. header-left 는 menu / panelL / search / arrowL / arrowR 5-버튼 툴바. |
| **Slot** | 마크업 트리에서 정해진 자리. `app-frame-*` 클래스 + (필요 시) `data-context` 로 식별. |
| **Engine** | 코딩 에이전트 런타임의 구체 구현 (ClaudeEngine / OpenCodeEngine). **설계 채택**: 범용 `BackendAdapter` 를 미리 만들지 않고 구체 클래스로 시작, 3번째 엔진에서 공통 추출 (rule of three). 현행 코드는 `SessionAdapter`(claude 단일). 정본 [arch/backend/standardization.md](./arch/backend/standardization.md) §4. ("Backend" 와 의미 인접 — Engine 은 *전체 런타임*, Backend 는 *식별자/얇은 세션 계약*.) |
| **표준 계층 / 런타임 계층** | 배포 시점(세션 전 — 무엇을 배포·주입) vs 실행 시점(세션 중 — 이벤트·권한·되돌리기). 단방향 연결 (배포 산출물 → 런타임 입력). 정본 [standardization.md](./arch/backend/standardization.md) §3 / [provider-runtime.md](./arch/backend/provider-runtime.md). |
| **sources / dist** | 확장 리소스의 단일 원천(`~/.config/orca/sources/`, 사람 편집) ↔ 엔진별 생성물(`dist/<engine>/`, 편집 금지). **설계 채택 / 구현 대기** — 현행 `ensureOrcaPlugin()` 은 `~/.config/orca/` 직접 write. 정본 standardization.md §5.1. |
| **ExtensionDeployer** | `sources` 를 엔진 규약으로 render → validate → backup-then-write 하는 배포기 (dryRun 지원). 현행 선례: `mcp/convert.ts`(`toClaudeConfig`/`toOpencodeConfig`). 정본 standardization.md §5.2. |
| **StandardConformance** | 엔진을 "표준(AGENTS.md·MCP·SKILL.md·hook)을 얼마나 구현하나"로 기술하는 구조 (+ `mcpSpecVersion`). 정본 standardization.md §5.3. |
| **AGENTS.md** | instructions 업계 표준 (AAIF / Linux Foundation). **설계 채택 방향**: Orca instructions SSOT (현 `systemPromptAppend` + 정적 정책 append `prompts/` 와 통합 경로). 코드 미도입. 정본 standardization.md §5.4. |
| **TurnExtensions / Extension(확장 리소스)** | 한 턴에 주입하는 활성 확장 리소스 묶음 (mcp · skills · hooks · systemPromptAppend) — Extension 계층의 *런타임 조립물*. `ExtensionBuilder`(`app/src/main/extensions/builder.ts`) 가 정규 소스에서 생성하고 어댑터가 자기 query 옵션으로 어댑트한다. `ExtensionDeployer` 의 배포-시점 산출물(dist/)과 대응하는 *주입-시점* 묶음. (구 `OrcaCapabilities`/`CapabilityBuilder` — 아래 capability 어휘 충돌로 개명, `TurnRequest.extensions`.) 코드 `app/src/main/extensions/types.ts`. |
| **SessionCapabilities / capability(능력 탐지)** | 백엔드가 *지원하는* 라이프사이클 기능(fork/revert/abort/structuredOutput…)의 서술. 방향: **백엔드→앱**(탐지·게이팅), 시점: **세션 중**(런타임 계층). UI 가 `false` 인 액션을 사전 비활성/숨김(사후 `capability_unsupported` 보다 UX 우월). **Extension(주입 묶음, 앱→백엔드, 세션 전)과 무관한 별개 개념** — 이 어휘 충돌을 없애려 per-turn 묶음을 Extension 으로 개명했다. 순수 DTO 는 `app/src/shared/ipc.ts`(SSOT, `ProviderDescriptor`), main 재노출은 `app/src/main/capabilities/types.ts`. 정본 provider-runtime.md §4. |
| **CapabilityProbe** | 한 provider 의 능력을 탐지해 `ProviderDescriptor` 를 반환하는 main 전용 추상화. claude 는 두 SDK 미설치(§13)라 introspection 불가 → **정적 서술자**(`CLAUDE_DESCRIPTOR`, 문서 지식 기반) 반환. `discover()` 가 async 인 건 opencode SDK introspection seam. `backend:list` 가 `describeAll()` 로 능력을 computed-on-the-fly 부착(영속 안 함). 코드 `app/src/main/capabilities/claude-probe.ts`. |
| **RevertManager** | 되돌리기 능력의 런타임 seam. **conversation revert ≠ file revert — 절대 병합 금지**(§5)라 메서드 4개를 각자 `RevertCapabilities` 로 가드. claude 는 전 cap false 라 오늘 전 메서드 throw(호출자 없음) — §5 의미 분리를 코드로 앵커하고 테스트로만 운동되는 seam. 코드 `app/src/main/capabilities/revert-manager.ts`. 정본 provider-runtime.md §5. |

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
- ❌ **"Capture"** — Orca 의 도메인 카탈로그에서 제외 (사용자 결정). `CapturesScreen.tsx` 코드는 남아있으나 문서·논의에서는 거론하지 않는다.
- ❌ **"Provider"** (LLM 의미로) — 위 "LLM Provider" 와 동일. 단, `orca.json` 의 `agents[].provider` 는 claude SDK 가 사용하는 클라우드 제공자(`anthropic`/`bedrock`/`vertex`) 필드명으로만 허용하며, Orca 도메인 어휘로 일반화하지 않는다.
