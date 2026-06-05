# Backend Architecture — Extension Standardization (개발환경 표준화·배포 계층)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-05
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [provider-runtime.md](./provider-runtime.md) (런타임 정규화 — *짝 문서*), [adapters.md](./adapters.md) (자산 변환 매트릭스), [security.md](./security.md) (비밀·MCP credential), [terms.md](./terms.md) (사람용 용어)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

> **상태**: 📐 *설계 확정 · 구현 대기*. 본 문서는 **배포 계층(deploy-time) 표준화** 설계만 정의하며 현재 코드 동작을 바꾸지 않는다 (코드 변경 0). 신규 배포 타입(`ExtensionDeployer`·`StandardConformance`)은 본 문서가 **정본(SSOT)** 이고, 런타임 타입(`PermissionBridge`·`RevertManager`·`NormalizedEvent`)은 [provider-runtime.md](./provider-runtime.md) 가 정본 — 본 문서는 *참조만* 한다(중복 정의 금지).
>
> **출처 신뢰 원칙**: 각 사실 옆에 `[검증]`(SDK 1차 출처/현재 코드 확인) / `[미확인]`(구현 전 실제 SDK 타입 확정 필요)을 표기한다. **두 SDK 미설치**라 다수 항목이 `[미확인]`.
>
> **핵심 명제**: 이 앱은 "엔진 통합" 앱이 아니라, **엔진이 아니라 업계 표준(AGENTS.md·MCP·SKILL.md)을 1차 추상화 단위로 삼는** 앱이다. 새 엔진 편입은 "그 표준을 구현하는가?"라는 단일 질문으로 환원된다.

## 1. 설계 원칙

엔진은 자주 바뀌고 새로 생기지만, 거버넌스 기구가 관리하는 표준은 상대적으로 안정적이다. 앱이 표준에 정렬하면 새 엔진은 "그 표준을 구현하는가"라는 단일 질문으로 편입된다.

세 가지 규칙을 따른다.

1. **표준 정렬과 보안 경계(권한·되돌리기)에만 선제 투자한다.** 그 외는 사용처가 강제할 때 만든다.
2. **사용처 없는 추상을 만들지 않는다.** 읽는 코드가 없는 자료구조, 트리거할 사례가 없는 정책, 끼울 엔진이 없는 인터페이스는 만들지 않는다.
3. **공통 인터페이스는 미리 설계하지 않고 세 번째 사례가 강제할 때 추출한다 (rule of three).**

따라서 1차 구현은 범용 어댑터가 아니라 **두 개의 구체 엔진 클래스**로 시작하며, 공통화는 사용하면서 추출한다.

> **짝 문서와의 방법론 정합**: 이 deferral/standards-first 입장은 [provider-runtime.md](./provider-runtime.md) 의 upfront-normalization 카탈로그와 **양립**한다. provider-runtime.md 의 정본 인터페이스는 *목표 카탈로그*이고, 구현은 rule of three 로 점진 추출하되 **v1 은 `permission.requested` 를 우선 정규화**한다(§6). 두 문서는 "목표 스펙(provider-runtime) + 구현 방법론·배포 계층(본 문서)"으로 한 쌍을 이룬다.

## 2. 표준의 분류

에이전트 개발환경의 확장 리소스는 네 축으로 나뉘고, 거버넌스 성숙도가 다르므로 동일하게 다루지 않는다.

| 축 | 표준 | 거버넌스 | 앱의 처리 |
|---|---|---|---|
| instructions | AGENTS.md | AAIF (Linux Foundation) | SSOT 로 공통화 (§5 AGENTS.md 채택) |
| custom tool | MCP | AAIF (Linux Foundation) | 서버 정의 공통, 설정만 렌더 (현행 `mcp/convert.ts` 선례) |
| skill | Agent Skills / SKILL.md | 개방 표준 + 벤더 확장 | 표준 본체 공통화, 확장은 게이팅 |
| hook / lifecycle | (표준 부재) | 없음 | **정규화하지 않고 엔진별 분리** (adapters.md §3.2 — 정정됨) |

AGENTS.md 와 MCP 는 같은 재단(AAIF) 거버넌스로 수렴했으므로 공통화의 1차 후보다. Agent Skills 는 개방 표준이되 Claude 가 주도·확장하고 OpenCode 가 네이티브 지원하는 형태라, 표준 본체는 공통화하고 벤더 확장만 게이트한다. hook 은 cross-tool 표준이 없고 엔진별 실행 모델(shell exit code, in-process throw, config matcher 등)이 근본적으로 달라 통합하지 않는다 — 이 입장은 [adapters.md §3.2](./adapters.md) 의 hook 정규화 분석을 *근거*로 채택됐다(분석이 "교차-엔진 정규화는 비용·표현력 손실이 크다"를 입증).

`commands` 는 독립 축이 아니다. Claude 가 custom commands 를 skills 로 병합했으므로, commands 는 skill 의 invocation surface 로 본다(adapters.md §3.1 Command 행).

## 3. 시스템 구조

```text
┌─────────────────────────────────────────────────────────┐
│ UI Layer (chat, tool cards, approval prompts)            │
├─────────────────────────────────────────────────────────┤
│ 표준 계층 (배포 시점 — 세션 시작 전)                       │
│   ExtensionDeployer  ·  StandardConformance              │  ← 본 문서 §5 (정본)
├─────────────────────────────────────────────────────────┤
│ 런타임 계층 (실행 시점 — 세션 중)                          │
│   PermissionBridge · RevertManager · EventStream         │  ← provider-runtime.md (정본) §6 참조
├─────────────────────────────────────────────────────────┤
│ Engine (구체 클래스)                                       │
│   ClaudeEngine            OpenCodeEngine                  │  ← §4
└─────────────────────────────────────────────────────────┘
```

표준 계층은 사람이 편집한 단일 원천(sources)을 각 엔진 규약으로 배포한다. 런타임 계층은 배포된 환경에서 세션이 실행될 때 이벤트·권한·되돌리기를 다룬다. **두 계층은 ExtensionDeployer 의 산출물이 런타임 설정 입력이 되는 단방향으로 연결된다**(§9).

## 4. Engine 추상화 (구체 클래스로 시작)

범용 `BackendAdapter` 인터페이스를 미리 만들지 않는다. 두 엔진을 구체 클래스로 구현하고, 세 번째 엔진이 추가될 때 겹치는 부분만 인터페이스로 추출한다(rule of three).

```ts
class ClaudeEngine {
  // Agent SDK: query() / ClaudeSDKClient
  // 권한: canUseTool 콜백
  // 되돌리기: 대화는 resume/fork, 파일은 file checkpointing
  // 인증: API key | 로컬 바이너리 세션 | Bedrock/Vertex
}
class OpenCodeEngine {
  // SDK: createOpencode() / createOpencodeClient()
  // 이벤트: event.subscribe() SSE 스트림
  // 권한: permission event → postSession...Permissions...(boolean)
  // 되돌리기: session.revert / session.unrevert
  // 인증: auth.set / 서버 config
}
```

엔진별로 표현력이 다른 기능(Claude 의 권한 갱신, OpenCode 의 직접 파일·검색 API)은 정규화로 뭉개지 않고, 해당 엔진 클래스 안에 그대로 둔다. UI 는 capability 를 보고 없는 기능의 버튼을 숨긴다(provider-runtime.md §4 SessionCapability / §15 CapabilityProbe).

> **현행 코드와의 관계**: `app/src/main/adapters/types.ts` 의 `SessionAdapter`(`isInstalled`/`install`/`sendMessage`)는 **이미 존재하는 인터페이스**지만 현재 **claude 단일 구체** 구현뿐이다([adapters.md §1.1](./adapters.md)). 본 설계는 이를 부정하지 않는다 — `SessionAdapter` 는 세션 실행의 얇은 계약으로 두고, *엔진 전체*(인증·되돌리기·직접 API 등)를 묶는 범용 `BackendAdapter` 추출은 **3번째 엔진까지 미룬다**([adapters.md §1.9](./adapters.md) 새 백엔드 체크리스트와 연계).

## 5. 표준 계층

### 5.1 sources / dist 분리

```text
~/.config/orca/
├── sources/                 # 사람이 편집하는 단일 원천 (SSOT)
│   ├── instructions/        # AGENTS.md (SSOT)
│   ├── skills/              # SKILL.md (폴더 규약)
│   ├── mcp/                 # 벤더 중립 MCP 서버 정의
│   └── hooks/               # 표준 없음 → 엔진별 분리
│       ├── claude/
│       └── opencode/
└── dist/<engine>/           # ExtensionDeployer 생성물 (편집 금지)
```

> **현행 갭 (채택 방향)**: 현재 `ensureOrcaPlugin()`([`skills/plugin-bundle.ts`](../../../app/src/main/skills/plugin-bundle.ts))은 `~/.config/orca/` 에 **직접** `.claude-plugin/plugin.json` + `skills/`·`agents/`·`commands/` 를 머티리얼라이즈한다([adapters.md §2.1](./adapters.md)). **sources/dist 분리도, `mcp/` 서브디렉토리도, AGENTS.md 도 아직 없다.** 본 절은 그 진화 방향이며 코드 변경은 구현 PR 로 미룬다.

### 5.2 ExtensionDeployer

배포는 렌더 후 검증과 백업을 거친다. 다단계 파이프라인이나 다중 drift 정책은 두지 않고, 안전한 기본 동작 하나로 시작한다.

```ts
type DeployOptions = { dryRun?: boolean }
function deploy(engine: EngineId, opts: DeployOptions): DeployResult {
  // 1. render : sources → 엔진 규약 산출물
  // 2. validate: 산출물이 엔진 스키마에 맞는가 (특히 MCP 키 이름)
  // 3. dryRun ? 계획 출력 : backup-then-write
}
```

축별 동작:

| 축 | 렌더 동작 | 비고 |
|---|---|---|
| instructions | AGENTS.md 를 SSOT 로 두고 각 엔진 instruction 파일로 렌더 | 엔진이 AGENTS.md 를 직접 읽거나 `@import` 로 끌어쓰면 그대로 사용 |
| skills | 규약 디렉터리에 **복사** 배치 | 심링크는 샌드박스 이슈를 피해 복사 우선 |
| mcp | 벤더 중립 정의를 엔진별 config 로 렌더 + **키 이름 검증** | 잘못된 키는 조용히 무시될 수 있으므로 |
| hooks | **변환 없이 엔진별로 복사만** | 표준 부재 (§2) |

`dist/<engine>` 산출물은 편집 대상이 아니다. 기존 파일이 마지막 배포와 다르면(사용자가 손댄 경우) 무단 덮어쓰기를 막기 위해 **항상 백업 후 기록**한다.

> **현행 선례 재사용**: "render sources → engine config" 는 이미 MCP 축에서 구현돼 있다 — `mcp/convert.ts` 의 순수 함수 `toClaudeConfig`/`toOpencodeConfig`(동형 시그니처), `mcp/resolver.ts` 의 `${VAR}` resolver(safeStorage → process.env 2단계), `mcp/expand.ts` 의 `expandEnv`([security.md §1.4](./security.md), [adapters.md §3.1](./adapters.md)). ExtensionDeployer 의 mcp 축은 이 함수들을 *호출*하면 되고 새로 발명하지 않는다.

### 5.3 StandardConformance

엔진을 "표준을 얼마나 구현하는가"로 기술한다. 실재하는 값과 런타임이 실제로 읽는 필드만 둔다.

```ts
type StandardConformance = {
  instructions: {
    agentsMd: 'native' | 'manual_import'   // 현재 두 엔진에 실재하는 값만
    mergePolicy: 'nearest_wins' | 'layered_memory'
  }
  tool: {
    mcp: 'native' | 'none'
    transports: ('stdio' | 'streamable_http')[]
    mcpSpecVersion: string                 // 스펙이 날짜 버전을 가지고 깨지는 변경이 있음
    configFormat: string                   // 렌더 타깃
  }
  skill: {
    skillMd: 'native' | 'none'
    compatibilityPaths?: string[]          // 예: .claude/skills
  }
  hook: {
    standardized: false                    // 항상 false (§2)
    executionModel: 'shell_exitcode' | 'inprocess_throw' | 'config_matcher'
  }
}
```

capability 플래그는 그것을 읽고 분기하는 코드가 생길 때 추가한다(규칙 2). 새 엔진 편입은 이 구조를 채우는 일이다.

### 5.4 AGENTS.md 채택 (instructions SSOT)

instructions 는 **AGENTS.md**(AAIF/Linux Foundation 거버넌스)를 SSOT 로 채택한다. `[검증: AAIF 표준]` / 엔진 네이티브 지원 여부는 `[미확인]`(StandardConformance.instructions.agentsMd 로 기술).

> **현행 instructions 모델과의 통합 경로 (코드 변경 0)**: 현재 instructions 는 (a) **프로젝트 지침**(DB) → `systemPromptAppend`([adapters.md §1.4](./adapters.md) CapabilityBuilder) + (b) **`PY_AGENT_RULES`**(`runtime/env.ts`, 앱이 항상 주입하는 Python 격리 규칙)로 합성된다. AGENTS.md 채택 시:
> - `sources/instructions/AGENTS.md` 가 사람이 편집하는 SSOT 가 되고, ExtensionDeployer 가 엔진 instruction 파일로 렌더(또는 엔진이 AGENTS.md 직접 읽기).
> - `PY_AGENT_RULES` 는 *앱이 주입하는 런타임 append* 로 **유지**(사용자 편집 대상이 아니므로 sources 에 두지 않음).
> - 프로젝트 지침(DB)과 AGENTS.md 의 병합 정책(`mergePolicy`)은 구현 PR 에서 확정 `[미확인]`.

## 6. 런타임 계층 (cross-ref only)

런타임 계층의 타입은 [provider-runtime.md](./provider-runtime.md) 가 **정본**이다. 본 문서는 재정의하지 않고 연결만 한다.

| 런타임 관심사 | 정본 |
|---|---|
| 권한 승인(agent-originated) | [provider-runtime.md §3](./provider-runtime.md) PermissionBridge · ApprovalResolution 2분기 |
| 되돌리기(대화 ≠ 파일) | [provider-runtime.md §5](./provider-runtime.md) RevertManager |
| 이벤트 스트림 정규화 | [provider-runtime.md §2](./provider-runtime.md) NormalizedEvent |

**EventStream 시퀀싱**: 이벤트 union 을 미리 완성하지 않는다. UI 가 실제로 소비하는 것만 정규화하고 나머지는 통과시킨다. 1차에서 정성껏 정규화하는 것은 `permission.requested` 하나다(UI 가 반드시 소비하고 엔진 차이가 크므로). 메시지 델타·도구 호출은 표시에 필요한 만큼만, 그 외 엔진 고유 이벤트는 소비자가 생길 때 케이스를 추가한다. → 이 시퀀싱 주석은 provider-runtime.md 헤더의 양립 노트와 정합한다.

## 7. 1차 구현 스코프

**포함한다**: 두 엔진 구체 클래스, PermissionBridge 와 승인 상태 머신, conversation/file 되돌리기 분리, AGENTS.md SSOT 렌더, MCP 서버 정의 렌더와 키 검증, sources/dist 분리와 백업 후 기록, `skillMd: native|none`, `mcpSpecVersion`.

**연기한다 (필요해질 때 추가)**: 범용 Engine 인터페이스(세 번째 엔진에서), EventStream union 완성, 자동 verify, `vendorExtensions` 같은 미사용 플래그.

**만들지 않는다**: 아직 어떤 대상 엔진에도 없는 미래 enum 값, 미사용 maturity 자료구조, 양방향 probe→redeploy 루프, 다중 drift 정책.

## 8. 표준 변화 대응

capability 는 정적이지 않다. 표준 버전(MCP 스펙 날짜 등)에 종속되며, 거버넌스(AAIF)에서 skill 표준이 수렴하거나 hook 표준이 생기면 **게이팅에서 정규화로 승격**한다. 따라서 SSOT 는 앱 독자 포맷이 아니라 **표준 파일(AGENTS.md, SKILL.md, MCP 정의) 자체**로 둔다. 앱이 자체 포맷을 SSOT 로 삼으면 표준 생태계와 단절된다.

## 9. 런타임 정규화 문서와의 관계

이 문서는 **개발환경 표준화(무엇을 배포·주입하는가)** 를 다룬다. 세션 실행 중의 이벤트·권한·세션 흐름 정규화는 [provider-runtime.md](./provider-runtime.md) 가 다루며, 둘이 한 쌍으로 앱을 닫는다. **ExtensionDeployer 산출물이 런타임 계층의 설정 입력이 되는 단방향 연결**이다(표준 계층 → 런타임 계층, 역방향 없음).
