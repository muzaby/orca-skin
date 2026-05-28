# docs/ — 코딩 에이전트용 가이드

이 디렉토리는 **제품 정의(PRD) + 구현 사양(TRD) + 아키텍처 4문서 + 전략 문서**를 담는다. `project/` 하위의 디자인 프로토타입(Electron HTML/CSS/JS)이 *무엇을 보여주는지* 라면, 이 문서들은 *무엇을 만들 것인지* (PRD), *어떻게 구현할 것인지* (TRD), *어떻게 구성되어 있는지* (아키텍처 4문서), *왜 그렇게 결정했는지* (전략 문서) 를 다룬다.

## 문서 인벤토리

| 파일 | 주제 | 다룰 때 읽어야 하는 경우 |
|---|---|---|
| `PRD.md` | **Orca v1 제품 정의** — 채팅+세션 재개 MVP, 그 외 도메인 화면(Skills/MCP/하드웨어)은 Future Scope | **무엇을** 만들지 합의를 확인할 때. 화면/기능/Phase 의 진실 원천. 작업 시작 전 가장 먼저 읽는다. |
| `TRD.md` | **Orca v1 기능·스택·API 사양** — 기능 명세(F1~F10), 기술 스택, IPC API 카탈로그, 데이터 모델, 외부 CLI/SDK 계약, 테스트 전략 | **무엇을 만들고, 어떤 기술로 만드는가** 결정할 때. 코드 작성 직전 가장 가까이 두는 문서. 시스템 구성·프로세스·모듈 레이아웃은 `FRONTEND_ARCHITECTURE.md` / `BACKEND_ARCHITECTURE.md` 참조. |
| `FRONTEND_ARCHITECTURE.md` | **Renderer 진실 원천** — Tailwind v4 + React Context + useReducer 상태 관리 (현재), **Zustand 전환 채택 결정 (Phase 4 진입 PR 묶음, 단일 root + sessions 슬라이스)**, **Feature-based 4-layer 아키텍처 (PR #29 적용 완료): `app/` 셸 · `pages/` 조립만 · `features/<domain>/` 비즈니스 로직 · `shared/` 범용. ESLint boundaries v6 강제.**, 도메인 화면 카탈로그 (Chat / Projects / Routines placeholder / Engine / SkillsMcp / Tweaks / SearchModal), **URL/path 라우팅 (`app://` + BrowserRouter)**, IPC 호출 패턴, **DOM Architecture Specification (§3.3 — `app-frame-*` 마커 체계 + Custom titlebar `frame:false` + Grid z-stack (overlay/modal/debug 슬롯) + Sidebar resize-handle + Tile structure, Phase 3+ 적용 완료)**, **Header 액션 5-버튼 툴바 + Sidebar brand 로고 + nav 3-항목화 (Phase 3++)** | Renderer 작업할 때. UI / 상태 / 사용자 입력 / 자동완성 / Tweaks / DOM 마크업 컨벤션. |
| `BACKEND_ARCHITECTURE.md` | **Main 진실 원천** — Backend Adapter 추상화 (SessionAdapter — LLM Provider 가 아님), electron-store 영속화, **2 계층 영속성 모델 채택 결정 (로컬 DB + FS, Phase 3+)**, **자격증명 모델 채택 결정 (safeStorage, Phase 3+)**, IPC 핸들러, 보안 경계 | Main 작업할 때. SDK 호출 / 어댑터 / 영속성 / 자격증명 / IPC 핸들러. |
| `IPC_CONTRACT.md` | **Main ↔ Renderer 채널 SSOT** — **총 28 채널** (chat 3 · backend 1 · install 2 · settings 2 · skills 1 · files 1 · session 5 · project 5 · window 3 · search 1 · mcp 4), ChatEvent variant, ErrorCode, 변경 절차 | IPC 채널 추가/변경할 때. FRONTEND/BACKEND 가 이 문서를 인용. |
| `GLOSSARY.md` | **용어 단일 출처** — Session/Message/ChatEvent/Backend/SessionAdapter/Tweaks/Skill/Artifact/Credential 등. 사용 금지 어휘 (Provider/Conversation/Thread/Capture) 명시 | 문서·코드 작성 시 용어 통일. |
| `llm-chat-desktop-strategy.md` | Claude Code / opencode CLI 를 백엔드로 쓰는 Electron 채팅 데스크톱앱 설계 — Orca 엔진의 *전략적 근거 / 결정 출처* (TRD 가 이 문서를 소화한 결과) | TRD 의 결정 배경을 거슬러 확인하거나, TRD 가 다루지 않는 회색 지대 (예: 추가 백엔드, 대안 라이브러리) 를 검토할 때 |
| `lightweight-llm-strategy.md` | 로컬 4B LLM 기반 이미지 센서 QA 시스템 설계 (Case 1: 로컬 전용 / Case 2: 외부 LLM 가능) | Skill 라우팅, JSON 단계 통신, self-consistency 등 4B 운영 패턴을 구현할 때 |
| `claude-code-spec.md` | **Claude Code CLI 해설 미러** — 플래그·NDJSON 이벤트 스키마·세션 관리·Orca v1 채택 표기. 절 번호 (§3·§4·§5·§7·§13) 가 PRD/TRD/BACKEND 의 인용 anchor | ClaudeCodeAdapter 를 구현/수정하거나, PRD/TRD 에서 Claude Code CLI 동작을 인용할 때. 본 저장소의 Claude Code SSOT |
| `spec/claude/` | **외부 공식 문서의 원문 한국어 미러** — `headless.md`, `cli-reference.md`. *편집 금지*, 통째로 덮어쓰기로만 갱신. `claude-code-spec.md` 가 인용·해설하는 *원본* | 원문이 무엇을 말하는지 *원형 그대로* 확인할 때. 디렉토리 정책은 `spec/CLAUDE.md` 참조 |

문서 간 관계:

- **Orca 핵심**: `PRD.md` (*WHAT*) → `TRD.md` (*HOW, 기능·API 사양*) → `FRONTEND_ARCHITECTURE.md` + `BACKEND_ARCHITECTURE.md` (*HOW, 시스템 구조*) ← `IPC_CONTRACT.md` + `GLOSSARY.md` (단일 출처). TRD 는 strategy 를 소화해 만든 구현 사양이고, PRD §9 Future Scope 는 `project/` 프로토타입을 흡수한 결과다.
- **아키텍처 4문서 분할 (2026-05-20)**: 이전의 단일 `architecture.md` 가 4 문서로 전문화되었다. AI agent 가 특정 영역 (Renderer / Main / IPC / 용어) 만 빠르게 참조하기 위함. `IPC_CONTRACT.md` 와 `GLOSSARY.md` 는 단일 진실 공급원 (SSOT) 이며 FRONTEND / BACKEND 는 이들을 인용한다.
- **데이터 모델·외부 계약 SSOT 분할**:
  - 데이터 모델 (ChatEvent / Settings / ErrorCode 등) → `TRD.md` §6
  - IPC 채널 카탈로그 → `IPC_CONTRACT.md` §2
  - 어댑터 외부 계약 → `TRD.md` §7 + `claude-code-spec.md` §10
  - 어댑터 내부 구현·구조 → `BACKEND_ARCHITECTURE.md` §4
  - 용어 정의 → `GLOSSARY.md`
- **외부 미러 (2단)**: 외부 공식 문서는 두 층으로 보관한다.
  - **원문 미러** (`docs/spec/<vendor>/*.md`): 원문 그대로, 편집 금지. 디렉토리 정책은 `docs/spec/CLAUDE.md`.
  - **해설 미러** (`docs/<vendor>-*-spec.md`): Orca 채택 표기, 정리표, *절 번호 안정성* 보장 — PRD/TRD/BACKEND 의 인용 anchor.
  - 현재: `docs/spec/claude/headless.md` + `docs/spec/claude/cli-reference.md` (원문) ↔ `docs/claude-code-spec.md` (해설). 원문 갱신 시 사람이 수동으로 (1) 원문 미러를 덮어쓰고 (2) 해설 미러를 정합화한다.
- `lightweight-llm-strategy.md` 는 **별도 제품 방향** 으로 위와 독립.

## 코딩 에이전트가 따라야 할 원칙

1. **읽는 순서.** Orca 작업이면 `PRD.md` → `TRD.md` → (구조 이해 필요 시) `FRONTEND_ARCHITECTURE.md` 또는 `BACKEND_ARCHITECTURE.md` → (IPC 변경 시) `IPC_CONTRACT.md` → (용어 확인) `GLOSSARY.md` → (필요 시) `llm-chat-desktop-strategy.md` → `project/` 순. **PRD §11 / TRD 의 Open Questions** 는 두 문서가 동기화한 동일 미정 항목이므로 에이전트가 단독으로 결정하지 말고 사용자에게 묻는다.
2. **구현 전에 해당 문서를 끝까지 읽어라.** 표 안의 의사결정 행(`결정`, `채택`, `합의된 원칙`)이 핵심이다. 요약본만 보고 구현하지 말 것.
3. **문서에 명시된 결정을 임의로 바꾸지 마라.** 예: "Provider 어휘 폐기, Backend/Adapter 로 통일" (GLOSSARY §3), "2 계층 영속성 모델" (BACKEND §6.3), "어댑터별 자격증명 저장" (BACKEND §8.4), **"Zustand 전환 — 단일 root + sessions 슬라이스, Phase 4 진입 PR 묶음, Phase 3 사전 마이그레이션 금지" (FRONTEND §4.4)**, **"DOM Architecture 마커 체계 + 4종 신규 기능 (Custom titlebar `frame:false` / Grid z-stack / Sidebar resize / Tile structure), `#app-frame-overlay` 는 modal backdrop 전용 (z 부호 반전), `#app-frame-debug` 슬롯은 floating UI 호스트로 분리" (FRONTEND §3.3, Phase 3+ 완료)** 같은 채택 결정은 협의 결과다. 변경이 필요하면 사용자에게 먼저 확인.
4. **문서와 코드가 충돌하면 사용자에게 물어라.** 둘 다 바꿔야 하는지(설계 변경) 코드만 바꿔야 하는지(구현 버그) 결정해야 한다. 아키텍처 4문서는 *현재 코드* + *채택된 결정 (Phase 3+ 도입 예정)* 을 함께 다루므로, 충돌 발견 시 어느 쪽인지 사용자가 판단해야 한다.
5. **문서를 새로 추가/수정할 때**: 한국어, 표 위주, 결정 사항 중심으로 작성해 기존 톤을 유지한다. 변경 시 영향 받는 다른 문서의 참조도 함께 갱신. IPC 채널 변경은 반드시 `IPC_CONTRACT.md` 갱신 (변경 절차는 §6).
6. **외부 공식 문서 미러를 둘 때**: 2단 구조를 사용한다. (a) *원문 미러* 는 `docs/spec/<vendor>/` 에 두고 *편집 금지*, 통째로 덮어쓰기로만 갱신. (b) *해설 미러* 는 `docs/<vendor>-*-spec.md` 에 두고 Orca 채택 표기(✅/❌/⏳)·정리표·*안정된 절 번호* 를 추가한다. 외부 사실(플래그·이벤트 스키마)은 원문 미러를 따른다. 예: 원문 `docs/spec/claude/{headless,cli-reference}.md` ↔ 해설 `docs/claude-code-spec.md`. 디렉토리 정책 상세는 `docs/spec/CLAUDE.md` 참조.

## 위치 규약

- **제품 정의(PRD), 구현 사양(TRD), 아키텍처 4문서, 전략 문서** → `docs/` (여기)
- **`project/` 프로토타입 자체에 종속된 메모** (예: 특정 디자인 변형 설명) → `project/` 안에 둔다
- 한 문서가 어디에 속할지 모호하면 `docs/` 를 기본값으로
