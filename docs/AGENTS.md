# docs/ — 코딩 에이전트용 가이드

이 디렉토리는 **제품 정의(PRD) + 구현 사양(TRD) + 아키텍처 문서(ARCHITECTURE.md 인덱스 + arch/) + 전략 문서**를 담는다. `project/` 하위의 디자인 프로토타입(Electron HTML/CSS/JS)이 *무엇을 보여주는지* 라면, 이 문서들은 *무엇을 만들 것인지* (PRD), *어떻게 구현할 것인지* (TRD), *어떻게 구성되어 있는지* (아키텍처 문서(ARCHITECTURE.md 인덱스 + arch/)), *왜 그렇게 결정했는지* (전략 문서) 를 다룬다.

## 문서 인벤토리

| 파일 | 주제 | 다룰 때 읽어야 하는 경우 |
|---|---|---|
| `PRD.md` | **Orca v1 제품 정의** — 채팅+세션 재개 MVP, 그 외 도메인 화면(Skills/MCP/하드웨어)은 Future Scope | **무엇을** 만들지 합의를 확인할 때. 화면/기능/Phase 의 진실 원천. 작업 시작 전 가장 먼저 읽는다. |
| `TRD.md` | **Orca v1 기능·스택·API 사양** — 기능 명세(F1~F10 + Phase 4 추가분 F11~F15), 기술 스택, IPC API 카탈로그, 데이터 모델, 외부 CLI/SDK 계약, 테스트 전략 | **무엇을 만들고, 어떤 기술로 만드는가** 결정할 때. 코드 작성 직전 가장 가까이 두는 문서. 시스템 구성·프로세스·모듈 레이아웃은 `arch/frontend/` / `arch/backend/` 참조. |
| `arch/frontend/` + `ARCHITECTURE.md`(인덱스) | **Renderer 진실 원천 (분해됨)** — Tailwind v4 + **Zustand v5 상태 관리 (0008/0013 전환 완료 — feature별 store + chat `sessions` Record 외피)**, **Feature-based 4-layer 아키텍처 (PR #29 적용 완료, 현재 features 13 도메인): `app/` 셸 · `pages/` 조립만 · `features/<domain>/` 비즈니스 로직 · `shared/` 범용. ESLint boundaries v6 강제.**, 도메인 화면 카탈로그 (Chat / Projects / Engine(`/agent`) / Skills&MCP / DebugPanel / SearchModal — Routines 는 Future), **URL/path 라우팅 (`app://` + BrowserRouter)**, IPC 호출 패턴, **DOM Architecture Specification (§3.3 — `app-frame-*` 마커 체계 + Custom titlebar `frame:false` + Grid z-stack (overlay/modal/debug 슬롯) + Sidebar resize-handle + Tile structure, Phase 3+ 적용 완료)**, **Header 액션 5-버튼 툴바 + Sidebar brand 로고 + nav 4-항목화 (0083)**, **사용량 한도 UI (UsagePanel 도넛 팝오버·설정 탭·provider별 한도, 0079~0082) + 인앱 업데이트 UX (0085/0086)**, **§6.6~6.9 + §7.6 Provider Runtime 렌더링/UX (ToolRendererRegistry · ApprovalCard 일반화 · StructuredOutput · Streaming lifecycle; **`ToolRendererRegistry` + `ApprovalCard` 일반화는 스테이지 C1/C2 로 부분 구현 (PR #47)**, 나머지 설계 대기, 정본 타입은 `arch/backend/provider-runtime.md` 참조)** | Renderer 작업할 때. UI / 상태 / 사용자 입력 / 자동완성 / Tweaks / DOM 마크업 컨벤션. |
| `arch/backend/system-prompt.md` | **시스템 프롬프트·정책 append 관리 (정본)** — preset+append 주입 메커니즘(현 구현)·정책 문자열 관리 구조(`app/src/main/prompts/` — policies/*.md · registry · loader · buildAppend, handoff 0030)·변동성 계층·**§5 Open Questions(settingSources/env 분리/옵션 캐싱 재검토)**. Opus 4.8 "시스템 프롬프트 관리 가이드 ver2" 를 Orca 코드·확정 핸드오프 결정으로 교정한 결과. | 시스템 프롬프트를 어떻게 주입·조립하고 정책 텍스트를 어디 둘지 다룰 때. |
| `arch/backend/standardization.md` | **배포 계층 표준화 (정본 — provider-runtime.md 와 짝)** — "엔진이 아니라 표준(AGENTS.md·MCP·SKILL.md)을 1차 추상화"·표준 택소노미·sources/dist+ExtensionDeployer·StandardConformance·Engine 구체클래스(rule of three)·AGENTS.md 채택 방향. **§5.1 배포 계층(`sources/dist`·`ExtensionDeployer`·`StandardConformance`) 스테이지 A 구현 완료 (PR #47); 잔여 표준(agents/commands 변환·hook full-plugin) 설계 대기.** | 어떤 확장 리소스를 *무엇을 배포·주입* 할지 설계할 때. 런타임(세션 중) 정규화는 provider-runtime.md. |
| `arch/backend/` + `ARCHITECTURE.md`(인덱스) | **Main 진실 원천 (분해됨)** — Backend Adapter 추상화 (SessionAdapter — LLM Provider 가 아님), electron-store 영속화(18 키·마이그레이션 13종), **2 계층 영속성 모델 (로컬 DB 구현 완료 + FS 잔여)**, **자격증명 모델 (safeStorage — MCP 비밀 구현 완료)**, IPC 핸들러, 보안 경계, **자동 업데이트 (electron-updater, 0084~0086 — runtime-ipc §3.1) + 스케줄러 (croner 9번째 슬라이스, 0091 — runtime-ipc §3.1-b) + skills 부트 시딩 (0078)**, **§12 Provider Runtime Model (범용 정규화 계층 — NormalizedEvent · PermissionBridge · AppCommandPolicy · SessionCapability · RevertManager · ErrorClassifier · Telemetry · AuthStore · AuditLog · DirectBackendAPI · WorkspaceManager · ConfigManager · 우선순위 P0/P1; 정본 타입 SSOT — **`NormalizedEvent` + `PermissionBridge`(`permission.requested` 1급 이벤트)는 스테이지 B 로 구현 완료 (PR #47), 잔여 항목 설계 대기**)** | Main 작업할 때. SDK 호출 / 어댑터 / 영속성 / 자격증명 / IPC 핸들러 / 범용 정규화 계층 설계. |
| `IPC_CONTRACT.md` | **Main ↔ Renderer 채널 SSOT** — **총 82 채널 · 23 도메인** (chat 6 · boot 2 · backend 1 · agent 1 · engine 5 · install 2 · update 6 · settings 2 · skills 7 · files 5 · session 7 · project 6 · window 3 · search 1 · mcp 4 · cost 6 · concurrency 1 · permission 2 · notify 1 · debug 2 · log 1 · auth 8 · plugin 3), NormalizedEvent variant, ErrorCategory, 검증 실패 정책, 변경 절차 | IPC 채널 추가/변경할 때. FRONTEND/BACKEND 가 이 문서를 인용. |
| `arch/backend/observability.md` | **로깅 정본 (0123/0124)** — JSONL `LogRecord` 스키마·중앙 LogManager 파이프라인(enrich→suppress→redact)·`~/.config/orca/logs/` 로테이션·renderer 인제스트 신뢰 경계·prod info 카탈로그 원칙·비범위(원격 전송 OQ4 등) | 로그를 남기거나 로깅 인프라를 변경할 때. |
| `GLOSSARY.md` | **용어 단일 출처** — Session/Message/NormalizedEvent/Backend/SessionAdapter/Tweaks/Skill/Scheduler/Artifact/Credential 등. 사용 금지 어휘 (Provider/Conversation/Thread/Capture) 명시 | 문서·코드 작성 시 용어 통일. |
| `arch/frontend/terms.md` · `arch/backend/terms.md` | **사람용 용어 해설 (파생)** — 프론트엔드/백엔드 요소 이름(Frame·Tile·Screen·ChatTile·SessionAdapter·NormalizedEvent 등)을 신규 합류자용 쉬운 한국어로. 정의는 GLOSSARY/arch 정본 링크, **재정의 안 함**. AI 정본 아님. | 처음 코드/문서를 받은 사람이 요소 이름의 뜻을 빠르게 잡을 때. |
| `PHASES.md` | **구현 페이즈 이력** — Phase 1 ~ 4(진행 중) 로드맵 표(범위·상태·PR/커밋) + Future Scope. `app/AGENTS.md` 에서 분리한 changelog 성격 문서. 완료 이력의 정본은 `git log`. | 과거에 무엇이 어떤 PR 로 들어왔는지 / 다음 Future Scope 가 무엇인지 확인할 때. |
| `git-template.md` | **커밋 trailer 가이드** — Claude↔Codex 가 커밋 trailer(`Key: value`)로 통신하기 위한 필드 표·에이전트별 작성 규칙·예시·파싱 명령. 규칙 요약은 root `AGENTS.md` "커밋 프로토콜". | 커밋 메시지에 trailer 를 작성하거나 trailer 를 파싱해 협업 상태를 읽을 때. |
| `etc/llm-chat-desktop-strategy.md` | Claude Code / opencode CLI 를 백엔드로 쓰는 Electron 채팅 데스크톱앱 설계 — Orca 엔진의 *전략적 근거 / 결정 출처* (TRD 가 이 문서를 소화한 결과) | TRD 의 결정 배경을 거슬러 확인하거나, TRD 가 다루지 않는 회색 지대 (예: 추가 백엔드, 대안 라이브러리) 를 검토할 때 |
| `etc/orca_lifecycle_orchestration_design_draft_ko.md` | **라이프사이클·오케스트레이션 재설계 설계서** — 하네스 소유 스펙트럼(SDK=턴 하네스 / Orca=워크플로 하네스), SessionRuntime 단일 신규 구조물, 20개 결정 + **엔지니어링 리뷰(2026-06-28) 8건 반영**(`[리뷰 N]`). 핸드오프 `0049` 의 설계 정본. | 라이프사이클/오케스트레이션 구조를 재설계·구현할 때 가장 먼저 읽는 정본. `0049/plan.md` 의 1차 출처. |
| `etc/lifecycle_management_ko.md` | **라이프사이클 일반론(기준자)** — LLM 채팅앱 8계층 모델(애플리케이션→리소스→세션→루프→도구/권한→상태/메모리→관측성→서브에이전트). 재설계의 yardstick. | 재설계 결정을 일반론 계층에 비추어 검증할 때. |
| `etc/orchestration_report_ko.md` | **오케스트레이션 일반론(기준자)** — 7요소(리드/하네스·메시지버스·동시성·subagent격리·deliberation·메모리/handoff·권한/샌드박스) + OpenCode/Codex/Claude Code 대조. | 오케스트레이션 스코프(무엇을 만들고 무엇을 위임/연기)를 가를 때. |
| `etc/study/opencode/` | **OpenCode real-world 분석** — 라이프사이클·오케스트레이션·인증 브로커(`AuthHook`·OAuth callback·런타임 주입). 기준 커밋과 `file:line` 근거. | 하네스 직접 구현과 인증 플러그인 계약을 참조해 Orca 경량판을 가늠할 때. |
| `etc/study/goose/` | **goose 인증 브로커 분석** — OS keyring/file fallback, secret metadata, Provider registry, OAuth cache, 선언형 custom provider. | 안전한 저장·인증 metadata·cleanup 선례와 자동 평문 fallback의 한계를 검토할 때. |
| `etc/study/hermes-agent/` | **Hermes-agent real-world 분석** — 라이프사이클·오케스트레이션·인증 브로커(credential pool·외부 secret source·provider profile). | 멀티에이전트/예산뿐 아니라 credential 회전·provenance·외부 vault 확장 계약을 확인할 때. |
| `etc/study/orca/` | **외부 연구 기반 Orca 인증 플랫폼 설계 (2026-07-31 개정본)** — auth provider·connector 계약, 앱 로그인/서비스 연결 공통 lifecycle, ADFS/WIA shared session, API key·Auth token·PAT, broker 보안 경계와 인수 기준. **개정 3건**: AUTH-PLAT-008 스코프 축소(Orca 는 LLM·MCP 요청 주체가 아님 → §소비자 경계) · AUTH-PLAT-011 격리 plugin-host 폐기(런타임 확장은 MCP, 인증 provider·내장 도구는 빌드 타임 → §확장 모델) · ADFS 전제를 사용자 확인 항목으로 표기. 정본은 `auth-plugin-platform-requirements-ko.md`(보고서와 충돌 시 우선). | 인증 플러그인 플랫폼의 요구사항·모듈 구조·secret 비노출 경계를 결정할 때. |
| `etc/study/claude/` | **Claude Agent SDK 분석 2부 16편** (`0.3.220` = CLI `2.1.220` 스냅샷). **1부 = 주제축 7편** — tool calling / subagent 호출 wire 규약, 제어 프로토콜·입력 큐/drain 루프, **비동기 턴 전환(런치 영수증 `async_launched` → 메인 턴 종결 → 서버 주도 auto-resume continuation; 호출자 계약은 polling 아닌 listen)**, wrapper 콜스택, 0.3.215↔0.3.220 실측 델타. **2부 [`api/`](etc/study/claude/api/) = 심볼축 9편** — `00` 진입점 분류(경계 문서: 진입점→SDK 심볼 매핑 4계열 + 미도달 채널 전수)와 `01`~`07` SDK 딥다이브(`query()` · `SDKUserMessage` · `SDKMessage` · 제어 메서드 3종 · 태스크 제어 2종 · `canUseTool`/`hooks` 역방향 · `Options`/실행파일 해석). 근거는 SDK 패키지 `파일:라인`. | SDK 가 도구/서브에이전트를 실제로 어떻게 주고받는지, 백그라운드 태스크가 왜 대화를 끝내고 다시 여는지 확인할 때(1부). **특정 SDK API 하나를 부르면 무슨 일이 일어나는지 — 프레임·가드·실패 모드·관측 불가 경계 — 를 볼 때(2부). 어떤 IPC 채널이 SDK 에 닿는지/안 닿는지 확인할 때(`api/00`).** SDK 버전을 올리기 전 §7.5 재현 절차로 규약 유효성 재확인. |
| `etc/lightweight-llm-strategy.md` | 로컬 4B LLM 기반 이미지 센서 QA 시스템 설계 (Case 1: 로컬 전용 / Case 2: 외부 LLM 가능) | Skill 라우팅, JSON 단계 통신, self-consistency 등 4B 운영 패턴을 구현할 때 |
| `claude-code-spec.md` | **`spec/claude/` 라우터** — Claude Code CLI/SDK *원문 미러* 로 가는 얇은 인덱스. 구 해설 미러의 Orca 합성분(권한 플래그↔`canUseTool`/`permissionMode` 매핑·SDK 채택 표)은 `arch/backend/provider-runtime.md`·`adapters.md` 로 이관됨. | Claude Code 원문(headless/cli-reference/agent-sdk)을 찾을 때. |
| `spec/claude/` | **외부 공식 문서의 원문 한국어 미러** — `headless.md`, `cli-reference.md`. *편집 금지*, 통째로 덮어쓰기로만 갱신. `claude-code-spec.md` 가 인용·해설하는 *원본* | 원문이 무엇을 말하는지 *원형 그대로* 확인할 때. 디렉토리 정책은 `spec/AGENTS.md` 참조 |

문서 간 관계:

- **Orca 핵심**: `PRD.md` (*WHAT*) → `TRD.md` (*HOW, 기능·API 사양*) → `arch/frontend/` + `arch/backend/` (*HOW, 시스템 구조*) ← `IPC_CONTRACT.md` + `GLOSSARY.md` (단일 출처). TRD 는 strategy 를 소화해 만든 구현 사양이고, PRD §9 Future Scope 는 `project/` 프로토타입을 흡수한 결과다.
- **아키텍처 문서(ARCHITECTURE.md 인덱스 + arch/) 분할 (2026-05-20)**: 이전의 단일 `architecture.md` 가 4 문서로 전문화되었다. AI agent 가 특정 영역 (Renderer / Main / IPC / 용어) 만 빠르게 참조하기 위함. `IPC_CONTRACT.md` 와 `GLOSSARY.md` 는 단일 진실 공급원 (SSOT) 이며 FRONTEND / BACKEND 는 이들을 인용한다.
- **데이터 모델·외부 계약 SSOT 분할**:
  - 데이터 모델 (NormalizedEvent / Settings / ErrorCategory 등) → `TRD.md` §6 (이벤트 variant·Settings 타입 원문은 `IPC_CONTRACT.md` §3/§2.4)
  - IPC 채널 카탈로그 → `IPC_CONTRACT.md` §2
  - 어댑터 외부 계약 → `TRD.md` §7. CLI/SDK 원문은 `claude-code-spec.md`(라우터) → `spec/claude/`
  - 어댑터 내부 구현·구조 → `arch/backend/adapters.md` §1 (정규화 계층은 `provider-runtime.md`)
  - 용어 정의 → `GLOSSARY.md`
- **외부 미러 (2단)**: 외부 공식 문서는 두 층으로 보관한다.
  - **원문 미러** (`docs/spec/<vendor>/*.md`): 원문 그대로, 편집 금지. 디렉토리 정책은 `docs/spec/AGENTS.md`.
  - **해설 미러** (`docs/<vendor>-*-spec.md`): Orca 채택 표기, 정리표, *절 번호 안정성* 보장 — PRD/TRD/BACKEND 의 인용 anchor.
  - 현재: `docs/spec/claude/{headless,cli-reference}.md` + `docs/spec/claude/agent-sdk/` (원문) ↔ `docs/claude-code-spec.md` (해설·라우터). 원문 갱신 시 사람이 수동으로 (1) 원문 미러를 덮어쓰고 (2) 해설 미러를 정합화한다.
- `etc/lightweight-llm-strategy.md` 는 **별도 제품 방향** 으로 위와 독립.

## 코딩 에이전트가 따라야 할 원칙

1. **읽는 순서.** Orca 작업이면 `PRD.md` → `TRD.md` → (구조 이해 필요 시) `arch/frontend/` 또는 `arch/backend/` → (IPC 변경 시) `IPC_CONTRACT.md` → (용어 확인) `GLOSSARY.md` → (필요 시) `etc/llm-chat-desktop-strategy.md` → `project/` 순. **PRD §11 / TRD 의 Open Questions** 는 두 문서가 동기화한 동일 미정 항목이므로 에이전트가 단독으로 결정하지 말고 사용자에게 묻는다.
2. **구현 전에 해당 문서를 끝까지 읽어라.** 표 안의 의사결정 행(`결정`, `채택`, `합의된 원칙`)이 핵심이다. 요약본만 보고 구현하지 말 것.
3. **문서에 명시된 결정을 임의로 바꾸지 마라.** 예: "Provider 어휘 폐기, Backend/Adapter 로 통일" (GLOSSARY §3), "2 계층 영속성 모델" (`arch/backend/persistence.md` §1.3), "어댑터별 자격증명 저장" (`arch/backend/security.md` §1.4), **"Zustand 전환 — 단일 root + sessions 슬라이스, Phase 4 진입 PR 묶음, Phase 3 사전 마이그레이션 금지" (`arch/frontend/state.md` §1.4)**, **"DOM Architecture 마커 체계 + 4종 신규 기능 (Custom titlebar `frame:false` / Grid z-stack / Sidebar resize / Tile structure), `#app-frame-overlay` 는 modal backdrop 전용 (z 부호 반전), `#app-frame-debug` 슬롯은 floating UI 호스트로 분리" (`arch/frontend/dom-architecture.md`, Phase 3+ 완료)** 같은 채택 결정은 협의 결과다. 변경이 필요하면 사용자에게 먼저 확인.
4. **문서와 코드가 충돌하면 사용자에게 물어라.** 둘 다 바꿔야 하는지(설계 변경) 코드만 바꿔야 하는지(구현 버그) 결정해야 한다. 아키텍처 문서(ARCHITECTURE.md 인덱스 + arch/)는 *현재 코드* + *채택된 결정 (Phase 3+ 도입 예정)* 을 함께 다루므로, 충돌 발견 시 어느 쪽인지 사용자가 판단해야 한다.
5. **문서를 새로 추가/수정할 때**: 한국어, 표 위주, 결정 사항 중심으로 작성해 기존 톤을 유지한다. 변경 시 영향 받는 다른 문서의 참조도 함께 갱신. IPC 채널 변경은 반드시 `IPC_CONTRACT.md` 갱신 (변경 절차는 §6).
6. **외부 공식 문서 미러를 둘 때**: 2단 구조를 사용한다. (a) *원문 미러* 는 `docs/spec/<vendor>/` 에 두고 *편집 금지*, 통째로 덮어쓰기로만 갱신. (b) *해설 미러* 는 `docs/<vendor>-*-spec.md` 에 두고 Orca 채택 표기(✅/❌/⏳)·정리표·*안정된 절 번호* 를 추가한다. 외부 사실(플래그·이벤트 스키마)은 원문 미러를 따른다. 예: 원문 `docs/spec/claude/{headless,cli-reference}.md` ↔ 해설 `docs/claude-code-spec.md`. 디렉토리 정책 상세는 `docs/spec/AGENTS.md` 참조.

## 위치 규약

- **제품 정의(PRD), 구현 사양(TRD), 아키텍처 문서(ARCHITECTURE.md 인덱스 + arch/), 전략 문서** → `docs/` (여기)
- **`project/` 프로토타입 자체에 종속된 메모** (예: 특정 디자인 변형 설명) → `project/` 안에 둔다
- 한 문서가 어디에 속할지 모호하면 `docs/` 를 기본값으로
