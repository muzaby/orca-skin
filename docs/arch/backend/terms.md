# Backend 용어 해설 (사람용)

> 이 문서의 독자: **사람** (신규 합류자·팀 동료) — AI agent 용 정본 문서가 아니다.
> 관련 문서: [../../GLOSSARY.md](../../GLOSSARY.md) (용어 정본/SSOT), [overview.md](./overview.md), [adapters.md](./adapters.md), [provider-runtime.md](./provider-runtime.md), [persistence.md](./persistence.md), [security.md](./security.md), [runtime-ipc.md](./runtime-ipc.md)
> 진실의 기준: **정의는 GLOSSARY.md / 해당 arch 문서가 정본.** 본 문서는 처음 보는 사람을 위한 쉬운 해설일 뿐, 충돌 시 정본 우선.

이 문서는 main(백엔드) 코드·아키텍처 문서에 나오는 *요소 이름* 을 처음 보는 사람을 위해 평이한 한국어로 풀어준다. 정확한 한 줄 정의·코드 심볼·진실의 기준은 GLOSSARY.md(및 링크된 arch 절)에 있으니 "정본" 칸을 따라가면 된다. 본 문서는 새 정의를 만들지 않는다.

> 큰 그림 한 줄: Orca 는 LLM API 를 직접 부르지 않는다. **외부 CLI/SDK(현재 claude-code)를 래핑** 해서 그 출력을 정규화해 화면에 흘려보낸다.

## 1. 프로세스 구조 (앱이 나뉘어 도는 방식)

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **Main Process** | Electron 의 Node.js 쪽. 창 생성·SDK 호출·파일 시스템·설정 저장·IPC 핸들러 담당. | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |
| **Renderer Process** | Chromium 쪽. React UI 를 그린다. 보안상 Node API 직접 접근 불가(sandbox). | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |
| **Preload** | Main 과 Renderer 사이의 *다리*. 화이트리스트된 API 만 `window.orca` 로 노출. | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |
| **IPC** | 두 프로세스 간 메시지 채널. `orca:<도메인>:<액션>` 으로 이름 짓는다. | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) · [runtime-ipc.md §2](./runtime-ipc.md) |
| **window.orca** | Renderer 가 IPC 를 부르는 단일 진입점. 노출 표면은 IPC_CONTRACT 가 정본. | [GLOSSARY §2](../../GLOSSARY.md#2-아키텍처-용어) |

## 2. 어댑터 계층 (외부 백엔드 래핑)

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **Backend** | LLM 실행 백엔드 식별자. 지금은 `'claude'` 하나, 나중에 `'opencode'` 등. ("LLM Provider" 라 부르지 않음.) | [GLOSSARY §1](../../GLOSSARY.md#1-도메인-용어) |
| **SessionAdapter** | 모든 백엔드가 따르는 공통 인터페이스 (`isInstalled`/`install`/`sendMessage`). LLM 직접 호출이 아니라 외부 CLI/SDK 래퍼. | [GLOSSARY §1](../../GLOSSARY.md#1-도메인-용어) |
| **AdapterRegistry** | 등록된 어댑터들의 설치 상태를 추적하고 활성 백엔드를 고른다. | [GLOSSARY §1](../../GLOSSARY.md#1-도메인-용어) |
| **claude 어댑터** | claude-code SDK 의 `query()` 를 직접 부르고, 그 메시지를 `NormalizedEvent` 로 정규화하는 구현체(`adapters/claude.ts`). | [adapters.md §1](./adapters.md) |
| **ExtensionBuilder / TurnExtensions** | DB·MCP·Skills 를 모아 백엔드 중립적인 "확장 묶음"(mcpConfig·systemPromptAppend·skills·hooks)을 만든다. (구 CapabilityBuilder/OrcaCapabilities — handoff 0062 개명.) | [adapters.md §1](./adapters.md) |
| **NormalizedHookSet** | before-tool·after-tool·on-prompt 같은 *시점별 콜백* 모음. 어댑터별 hook 을 정규화(`adapters/hooks.ts`). | [adapters.md §3](./adapters.md) |

## 3. 영속성 (데이터를 저장하는 곳)

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **Database** | 로컬 SQLite(better-sqlite3). 세션·메시지·message_parts·projects 테이블이 진실의 기준. | [persistence.md §1](./persistence.md) |
| **FTS5** | 메시지 전문검색용 가상 테이블(`messages_fts`). SearchModal 이 이걸 쿼리한다. | [persistence.md §1](./persistence.md) |
| **Migrations** | 스키마를 버전 단위로 올리는 SQL 파일들. 부팅 시 자동 적용. | [persistence.md §1](./persistence.md) |
| **SettingsStore** | electron-store 래퍼. 테마·사이드바·마지막 세션·창 위치 등 가벼운 설정 저장. | [GLOSSARY §1 (Tweaks)](../../GLOSSARY.md#1-도메인-용어) |
| **TurnCoordinator** | 한 세션의 턴 파이프라인 구동체 — 이벤트 순서를 지켜 DB 적재/중복 저장 방지를 담당한다(`features/chat/turn-coordinator.ts`). 구 "단일 inflight" 모델(`InflightTurn`)은 폐기됐다. | [runtime-ipc.md §1](./runtime-ipc.md) |

## 4. MCP · Skills (확장 기능)

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **Skill** | `SKILL.md` 로 정의된 슬래시 명령(`/이름`). 입력창에서 호출. | [GLOSSARY §1](../../GLOSSARY.md#1-도메인-용어) |
| **McpStore** | MCP 서버 추가/삭제/목록 관리. 설정 + 비밀값 저장을 묶어 다룬다. | [security.md §1](./security.md) |
| **Secret Store** | Electron safeStorage(OS 키체인) 래퍼. API 키 등 비밀을 평문 없이 암호화 저장. | [GLOSSARY §1 (Credential)](../../GLOSSARY.md#1-도메인-용어) |
| **Skills Scan** | Orca `sources/skills/` 와 `~/.claude/skills/` 를 훑어 SKILL.md frontmatter 를 읽는 스캐너. | [GLOSSARY §1](../../GLOSSARY.md#1-도메인-용어) |

## 5. Python 런타임

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **Python Runtime / uv / buildPyEnv** | **제거됨** — uv 기반 격리 Python 환경과 runtime IPC 채널은 main 에서 삭제됐다. 어휘를 재사용하지 않는다. | [GLOSSARY §1](../../GLOSSARY.md#1-도메인-용어) |

## 6. 범용 정규화 계층

> **주의**: 이 절의 이름들은 OpenCode + Claude 를 함께 지원하기 위한 타입 어휘다. **이름마다 구현 여부가 다르다** — `NormalizedEvent`·`PermissionBridge`·`PermissionModeController`·`ErrorClassifier`·`Telemetry` 는 구현돼 있고, `RevertManager`·`DirectBackendAPI`·`WorkspaceManager`·`ConfigManager` 는 목표 계약이다. 절별 판정과 정본 타입 정의는 [provider-runtime.md](./provider-runtime.md) 가 소유한다.

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **NormalizedEvent** | 서로 다른 SDK 의 이벤트를 *하나의 공통 이벤트* 로 통일한 것. 모든 이벤트가 sessionId·provider 를 갖는다. | [provider-runtime.md §2](./provider-runtime.md) |
| **PermissionBridge** | 에이전트가 도구를 쓰려 할 때의 *승인 요청* 을 한 경로로 모아 처리하는 다리. 모듈을 가리키는 설계 이름 — 코드 진입점은 `features/approvals/permission-bridge.ts` 의 `agentPermissionRequest()`/`classifyAppCommand()` 다. | [provider-runtime.md §3](./provider-runtime.md) |
| **ApprovalResolution** | 승인 결과. 허용(allow, 입력 수정 가능) / 거부(deny, 중단 가능) **2갈래**. | [provider-runtime.md §3](./provider-runtime.md) |
| **AppCommandPolicy** | 앱이 *직접* 부르는 명령의 정책. read-only / 권한우회 / 상태변경 **3갈래**. | [provider-runtime.md §3](./provider-runtime.md) |
| **PermissionModeController** | 세션 도중 신뢰 수준을 올리는 스위치(예: 계획만 보기 → 자동 편집 허용). | [provider-runtime.md §3](./provider-runtime.md) |
| **SessionCapability** | 백엔드마다 가능한 세션 기능이 다르므로, 가능한 것만 런타임에 탐지해 버튼을 켜고 끈다. | [provider-runtime.md §4](./provider-runtime.md) |
| **RevertManager** | 되돌리기. *대화 되돌리기* 와 *파일 되돌리기* 는 다른 개념 — 절대 합치지 않는다. | [provider-runtime.md §5](./provider-runtime.md) |
| **ErrorClassifier** | 에러를 8종류로 분류하고 재시도 가능 여부를 붙인다. | [provider-runtime.md §6](./provider-runtime.md) |
| **DirectBackendAPI** | OpenCode 의 `find.*`/`file.*` 같은 직접 호출 API. 백엔드가 가진 만큼만 노출(optional). | [provider-runtime.md §17](./provider-runtime.md) |
| **WorkspaceManager** | 작업 경로·허용 디렉토리·sandbox 범위를 한 곳에서 관리. | [provider-runtime.md §18](./provider-runtime.md) |
| **ConfigManager** | Claude options 와 OpenCode config 를 병합하는 설정 계층. | [provider-runtime.md §19](./provider-runtime.md) |
| **Telemetry / AuthStore / AuditLog** | 사용량·비용 집계 / 인증 주입 전략 / 권한·실행 감사 기록. | [provider-runtime.md §8·§9·§10](./provider-runtime.md) |

> 구현 우선순위(P0/P1)는 [provider-runtime.md §20](./provider-runtime.md) 참조.

## 7. 표준 계층 (배포 — 무엇을 배포·주입하나)

> 정본은 [standardization.md](./standardization.md). §6 런타임 계층(세션 *중*)의 짝으로, 세션 *시작 전* 무엇을 깔지를 다룬다. `sources`/`dist` 분리와 배포기(`deployer.ts` 의 `deploy()`)는 구현돼 있고, `StandardConformance`·AGENTS.md 채택은 목표 계약이다.

| 이름 | 쉬운 설명 | 정본 |
|---|---|---|
| **표준 우선(standards-first)** | 엔진이 아니라 업계 표준(AGENTS.md·MCP·SKILL.md)을 1차 추상화 단위로. 새 엔진 = "그 표준을 구현하나?" 라는 한 질문. | [standardization.md §1·§2](./standardization.md) |
| **표준/런타임 2계층** | 배포 시점(세션 전, 무엇을 깔까) vs 실행 시점(세션 중, 이벤트·권한). 단방향: 배포 산출물 → 런타임 입력. | [standardization.md §3](./standardization.md) |
| **sources / dist** | 사람이 편집하는 단일 원천(sources) → 엔진별 생성물(dist, 편집 금지). | [standardization.md §5.1](./standardization.md) |
| **ExtensionDeployer** | sources 를 엔진 규약으로 렌더 → 검증 → 백업 후 기록(dryRun 지원). 모듈을 가리키는 설계 이름 — 코드 진입점은 `deployer.ts` 의 `deploy()`. | [standardization.md §5.2](./standardization.md) |
| **StandardConformance** | 엔진을 "표준을 얼마나 구현하나"로 기술(instructions/tool/skill/hook + mcpSpecVersion). | [standardization.md §5.3](./standardization.md) |
| **AGENTS.md** | instructions 표준(AAIF). Orca instructions SSOT 채택 방향(현 systemPromptAppend 헤더와 통합 — 정적 정책 append 체인은 제거됨). | [standardization.md §5.4](./standardization.md) |
| **Engine 구체클래스** | 범용 어댑터를 미리 안 만들고 ClaudeEngine/OpenCodeEngine 구체 클래스로 시작, 3번째 엔진에서 공통 추출(rule of three). | [standardization.md §4](./standardization.md) |

> 사용하지 않는 어휘(Provider/Conversation/Thread 등)는 [GLOSSARY §3](../../GLOSSARY.md#3-사용하지-않는-용어-혼동-방지).
