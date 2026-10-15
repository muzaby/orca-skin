# Backend Architecture — Adapters (어댑터·ExtensionBuilder·파일/리소스·Hook 정규화)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [provider-runtime.md](./provider-runtime.md), [overview.md](./overview.md), [adapter-design 흡수], [../../claude-code-spec.md](../../claude-code-spec.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. Backend Adapter 추상화

> ⚠️ **"LLM Provider" 가 아니다.** Orca 는 LLM API 를 직접 호출하지 않고 외부 CLI/SDK (Claude Code SDK, opencode 등) 를 래핑한다. 용어는 [GLOSSARY.md](../../GLOSSARY.md) §3 참조.

### 1.1 SessionAdapter 인터페이스 계약

Work와 Code는 실행 backend와 별개인 제품 에이전트 종류다. `features/agents/profiles.ts`의 고정 프로필을 app 컴포지션 루트가 선택하고 `ExtensionBuilder`에 지침·key만 전달한다. 어댑터는 제품 종류를 해석하지 않고 기존 `TurnExtensions`의 prompt·도구·plugin 입력을 실행한다. 별도 플러그인 인터페이스나 에이전트 등록 플랫폼은 없다.

실행 계약 정본은 [adapters/types.ts](../../../app/src/main/adapters/types.ts)의 `SessionAdapter`·`LiveTurn`·`ProviderMessageBatch`다. `sendMessage(req: TurnRequest)`는 `LiveTurn`을 반환하고 `eventBatches`에 정규화 이벤트 묶음을 제공한다.
설치 확인/안내 외에 `describe()`·`complete()`·`classifyError()`와 LiveTurn 제어도 어댑터 책임이다. 입력은 [adapters/turn.ts](../../../app/src/main/adapters/turn.ts), 와이어는 [shared/ipc.ts](../../../app/src/shared/ipc.ts)의 `NormalizedEvent`를 참조한다.

### 1.2 등록된 백엔드 (현재 — Phase 3 SDK)

| Backend | 어댑터 파일 | 구현 방식 | 상태 |
|---|---|---|---|
| `claude` | `adapters/claude/adapter.ts` (+`claude/map.ts` 정규화) | `@anthropic-ai/claude-agent-sdk`의 `query()` 호출 | ✅ 활성 |
| `opencode` | `adapters/opencode/v1/adapter.ts`·`opencode/v1/server.ts`·`opencode/v1/map.ts` | 소유 CLI 서버 + 주입 fetch의 SDK HTTP/SSE | Code 전용; [SDK 해설](../../opencode-sdk-spec.md) |

`AdapterRegistry`에 bootstrap이 하네스 어댑터를 등록한다. 신규 요청은 선택 backend로, 기존 요청은 DB backend로 라우팅한다. payload·provider key·준비 중 lease·설정 해석 이후 DB를 대조해 하네스 변경을 거부한다.

하네스 중립 포트·등록·공통 프롬프트/도구 어휘는 `adapters/` 루트에 둔다. `claude/`는 SDK query·정규화·설정·hook·dev mock을 소유한다. `opencode/index.ts`는 현재 지원하는 구현을 선택하는 진입점이며 SDK import, HTTP/SSE 매핑, CLI 실행/버전 판정, native 설정/모델 해석은 `opencode/v1/`에 격리한다. 하네스 구현끼리의 직접 import와 v1 밖 OpenCode SDK import는 ESLint가 거부한다.

#### OpenCode 실행과 격리

`opencode/v1/activity.ts`는 현재 prompt의 task metadata가 지정한 child만 수집한다. child 텍스트·도구는 root 세션과 parentToolRunId로 저장하며 도구 ID는 native session으로 구분한다. child 종료·오류·usage는 root 턴을 종료하지 않는다. task와 셸의 수신 상태·로그는 기존 providerEvents의 background.call journal로 보존하고, 부모 턴 종료 뒤의 상시 구독이나 독립 프로세스 제어는 제공하지 않는다. 추가 컨텍스트 폴더는 system 문맥의 JSON 목록으로 전달하며 native 도구 승인은 유지한다.

앱은 `createOpenCodeAdapter`를 통해 `SessionAdapter`를 받고, `opencode/implementation.ts`의 전송·서버 수명·설정 로더 계약만 사용한다. 구체 adapter/server 생성은 `opencode/v1/index.ts`가 담당한다. 버전 디렉터리를 직접 소비하거나 버전 구현끼리 참조하는 import는 ESLint가 차단한다. 다른 버전 구현은 같은 계약을 제공하고 중립 진입점에서 선택해야 하며, 현재 실행 가능한 구현은 1.x다.

`OpenCodeServerPool`은 실행 파일·구성·환경 fingerprint별 시작을 합치고 loopback 임의 포트, 임의 인증 암호, Orca 전용 XDG 데이터 경로를 사용한다. 앱 종료는 자신이 spawn한 child만 종료한다. 설치된 CLI를 PATH와 npm 설치 경로에서 찾거나 하네스 설정의 절대 실행 파일 경로를 사용한다. 자동 CLI 설치·사용자 OpenCode 프로세스 재사용은 제공하지 않는다.

`OpenCodeAdapter`는 `/v2/client`의 legacy 호환 API(`/session`, `/event`)를 사용한다. catalog는 구성별 캐시를 사용하며 목록 새로고침은 다시 조회한다. 입력 전에 SSE 연결을 준비하고, session ID·prompt parent ID·event/part ID로 턴과 중복을 격리한다. 스트림 단절은 오류로 끝내고 프롬프트를 자동 재전송하지 않는다. 권한·질문은 공통 approval broker를 거쳐 해당 요청으로 회신하고, 취소는 해당 세션만 abort한다.

도구 종류·입력은 공통 어휘로 변환하고 `providerTool: { name, input }`을 history에 함께 저장한다. 시스템 지침은 prompt의 system에 추가한다. Claude 전용 plugin·hook·runtime tool 변환은 제공하지 않으며 OpenCode native config를 사용한다. fork·share·revert·개별 background 제어는 descriptor에서 비활성이다.

### 1.3 ClaudeCodeAdapter 호출 패턴

공통 실행 설정은 `claude/adapt.ts`의 `adaptExecutionConfig`가 SDK `Options` 타입에 맞춰 조립한다. `complete`와 `sendMessage`는 이를 함께 사용하며, 실행별 도구·hook·plugin 정책은 각 호출부가 소유한다.

| 입력 | SDK 전달 | 책임 |
|---|---|---|
| provider settings | `settings`에 인라인 JSON 문자열 | `adaptSettings`; SDK argv 직렬화 경계 |
| 설정 탐색 범위 | `settingSources: ['project', 'local']` | `adaptSettingSources`; 사용자 전역 설정과 provider 설정 분리 |
| 턴 실행 env | 비어 있지 않으면 `Options.env` | `adaptEnv`; provider settings의 env와 별도 입력 |
| 파일 기반 MCP·스킬 | 로컬 plugin 경로 | 배포가 산출물을 만들고 `adaptPlugins`가 매니페스트 확인 |
| 인프로세스 도구 | `mcpServers` | `claude/runtime-tools.ts`의 `adaptRuntimeTools` — 대화 query 는 `allowedTools` 를 쓰지 않는다 |
| 시스템 지침·스킬 선택·hook | 대화 query 옵션 조각 | `adaptSystemPrompt`·`adaptSkills`·`adaptHooks` |

제목용 `complete`는 도구 없는 단발 실행이고, 대화는 plugin·runtime tool·권한 hook을 사용한다. `~/.claude/skills`는 사용자 스킬 래퍼 plugin으로 전달한다. 정확한 호출 옵션은 [claude.ts](../../../app/src/main/adapters/claude/adapter.ts)가 정본이다.

#### 컨텍스트 모델과 파일 입력

[claude-context-policy.ts](../../../app/src/main/adapters/claude/context-policy.ts)가 대화 실행 모델의 컨텍스트 정책을 해석한다. 명시 모델이 별칭이면 `ANTHROPIC_DEFAULT_<별칭>_MODEL`을 조회하고, 모델이 없으면 `ANTHROPIC_MODEL` 다음 settings `model`을 조회한다. 준비된 턴 env가 있으면 그 값을 읽고, 없으면 settings env 문자열이 process env보다 우선한다.

| 대상 | 현재 동작 |
|---|---|
| 모델 분류 | 이름의 계열·버전과 `[1m]`으로 Claude·미확인 모델을 구분한다. 네이티브 1M은 Opus 4.7 이상·Sonnet 5 이상·Haiku 5.5 이상·Fable·Mythos다. |
| 실행 모델 | Claude 1M을 CLI가 스스로 인정하지 못하는 게이트웨이·3P 연결이면 실행 문자열에만 `[1m]`을 붙인다. 직결·기존 접미사·1M 비활성 설정·3P Sonnet 5 이상은 원문을 유지한다. |
| 식별자·env | 저장 모델과 settings·env는 바꾸지 않는다. 창 크기·자동 요약 env도 주입하지 않는다. 스폰과 후속 턴·라이브 모델 전환이 같은 해석 함수를 쓴다. |
| 텍스트 첨부 | `.txt`·`.md`와 NUL 검사를 거쳐 원본 바이트를 보관하고, 마지막 텍스트 블록에 `@"<저장 경로>"`를 넣는다. 본문 읽기와 상한·이어읽기 안내는 CLI가 처리한다. |
| 이미지·도구 결과 | 첨부 이미지 원본 블록들을 먼저 두고 텍스트를 마지막에 둔다. 축소·미디어 제한·도구 결과 처리는 CLI에 맡긴다. |
| 결과 오류 | 비어 있지 않은 SDK `result` → `errors` 줄바꿈 결합 → `message` → `error` → 합성 문구 순으로 원문을 표시한다. 분류는 `stream_error`다. |

입력 조립은 [buildTurnContent](../../../app/src/main/adapters/claude/adapter.ts)가 소유하고 첫 입력·프렐류드·후속 턴이 공유한다. [첨부 저장](../../../app/src/main/features/chat/attachment-files.ts)은 보관 파일명에서 큰따옴표·`#` 등의 멘션 구분자를 정제하며, 화면에는 원래 첨부 이름을 표시한다. CLI 정책의 버전별 근거는 [컨텍스트·파일 연구](../../etc/study/claude/08-컨텍스트-한도와-파일-정책.md)를 참조한다.

### 1.4 ExtensionBuilder (턴 확장 입력 조립)

`features/extensions/builder.ts`의 `ExtensionBuilder`는 프로젝트 지침·앱 설정·스킬·plugin 경로·runtime tool snapshot으로 `TurnExtensions`를 조립한다. 실제 필드는 [adapters/turn.ts](../../../app/src/main/adapters/turn.ts)가 정본이다.
파일 기반 MCP의 설정 조회·변수 해석·배포는 bootstrap의 배포 closure가 소유하며, 턴 builder는 MCP store를 읽지 않는다. 인프로세스 runtime tool snapshot은 별도 입력으로 유지한다.

`build(sessionId, projectId, profile?)`는 resume이면 세션에 연결된 프로젝트를, 새 채팅이면 전달된 프로젝트를 읽는다. 프로젝트 지침은 `# Project`, Work 프로필은 `# Agent` 섹션으로 합성한다([system-prompt.md](./system-prompt.md) §2A). 지침은 매 턴 재조회하지만 SDK append는 query 생성 시 적용된다. `agentProfileKey` 변경은 최초·자동 연속 실행의 공통 respawn 판정을 거치고, 같은 key는 기존 warm 채널을 유지한다. 스킬 목록은 bootstrap의 스캔 캐시를 읽는다.

### 1.5 SDKMessage → NormalizedEvent 정규화

`adapters/claude/map.ts` 의 `claudeToNormalized` 가 SDK 메시지를 `NormalizedEvent` 로 직접 정규화한다(순수 함수). 와이어(`orca:chat:event`)의 유일한 페이로드는 `NormalizedEvent` 이고, variant 전수는 [IPC_CONTRACT.md §3](../../IPC_CONTRACT.md) 이 SSOT, SDKMessage → variant 매핑표는 [provider-runtime.md §2](./provider-runtime.md) 가 갖는다. 구 `ChatEvent` 어휘는 제거됐다([GLOSSARY.md](../../GLOSSARY.md) NormalizedEvent 항목).

### 1.6 인증 만료 감지

SDK 가 throw 하는 에러 메시지/코드에서 `401` / `OAuth` / `expired` 패턴 매칭 → `error / auth.expired` 이벤트 발행 → UI 의 AuthExpiredModal 로 `claude /login` 안내.

### 1.7 SDK 채택 범위 (현행)

| SDK 기능 | Orca | 상태 | 비고 |
|---|---|---|---|
| `query({ prompt, options })` 단일 진입점 | ✅ | 구현 | CLI `claude -p` 의 대체. 대화는 장수명 채널(`pushTurn`), 제목은 `complete()` 단발 |
| `options.resume: sessionId` | ✅ | 구현 | `--resume` 직접 대응 |
| `options.includePartialMessages: true` | ✅ | 구현 | delta 스트리밍 |
| `options.cwd` | ✅ | 구현 | 세션 cwd — 격리 세션은 managed worktree 경로(`features/worktrees`) |
| `result.total_cost_usd` / `usage` / `modelUsage` / `duration_ms` | ✅ | 구현 | `ProviderReportedTelemetry` 로 정규화(cost·model·캐시 토큰·duration·numTurns) → UsagePanel (provider-runtime.md §8) |
| `options.permissionMode` / `canUseTool` | ✅ | 구현 | `shared/permission-mode.ts` + `features/approvals/permission-mode-controller.ts`(세션 SSOT); `canUseTool` 은 RISKY_TOOLS(`adapters/risky-tools.ts`) 승인 브리지. **기본 정책값은 PRD OQ9 로 열려 있다** |
| `options.allowDangerouslySkipPermissions` | ✅ | 구현 | 대화 query 가 `permissionMode` 를 명시할 때 `true` — 장수명 채널의 라이브 `bypass` 전환 전제([claude-code-spec §5.5](../../claude-code-spec.md)). 제목 생성 `complete()` 는 넘기지 않는다 |
| `options.hooks` (PreToolUse / Stop …) | ✅ | 구현 | `adaptHooks(extensions.hooks)` + 어댑터 내부 훅(workspace guard PreToolUse · Stop git sync · Stop 출력 수집)을 `claude/adapter.ts` 가 병합 — in-process 콜백(§3.2.5) |
| `createSdkMcpServer` + `tool()` | ✅ | 구현 | 인프로세스 runtime tool(`claude/runtime-tools.ts` `adaptRuntimeTools` → `mcpServers`) — 산출물 게시 도구 등 |
| `options.mcpServers` | ✅ (runtime tool 전용) | 구현 | 파일 기반 MCP 는 plugin `.mcp.json` 으로 로드([standardization.md §5.1](./standardization.md)); `options.mcpServers` 는 인프로세스 runtime tool 서버에만 쓴다 |
| `options.skills` + `settingSources: ['project','local']` | ✅ | 구현 | `adaptSkills`·`adaptSettingSources`(§1.3, 0117) — 사용자 전역 settings 는 상속하지 않고, 사용자 `~/.claude/skills` 는 wrapper plugin 으로 전달 |
| `options.disallowedTools` | ✅ | 구현 | `['WebSearch']` — 대화 실행에서 WebSearch 를 차단하는 용도 하나(`claude/adapter.ts`). 격리 해제 보완 용도가 아니다 |
| `options.plugins` (로컬 플러그인) | ✅ | 구현 | `dist/<engine>/plugins/orcinus-orca` + 사용자 skill wrapper 를 `{ type: 'local', path }` 로 주입(`adaptPlugins`, 0058) |
| `prompt: AsyncIterable<SDKUserMessage>` | ✅ | 구현 | `streaming-input.ts` 턴-스코프 입력 — 장수명 채널 `pushTurn` 의 토대 |
| `forkSession` | ✅ | 구현 | Fork(분기)가 SDK 네이티브 `forkSession` 에 위임([GLOSSARY.md](../../GLOSSARY.md) Fork) |
| `listSessions` / `loadSession` | ❌ | 미사용 | 로컬 DB 가 진실의 기준이라 외부 jsonl 을 읽지 않는다([persistence.md](./persistence.md)) |

자세한 SDK API 시그니처는 [`docs/spec/claude/agent-sdk/typescript.md`](../../spec/claude/agent-sdk/typescript.md) (SSOT).

### 1.8 Adapter 책임 확장 (Future anchor)

> **rule of three ([standardization.md §4](./standardization.md))**: 현 `SessionAdapter`(§1.1)는 세션 실행의 얇은 계약이며 **claude 단일 구체** 구현뿐이다. *엔진 전체*(인증·되돌리기·직접 API 등)를 묶는 범용 `BackendAdapter` 추출은 **3번째 엔진까지 미룬다** — 두 엔진은 구체 클래스(`ClaudeEngine`/`OpenCodeEngine`)로 시작하고 겹치는 부분만 추출한다.

opencode 등 다중 어댑터 환경 대비:

| 책임 | 현재 (claude-code 전용) | Future 인터페이스 |
|---|---|---|
| Skills 스캔 경로 | `Bootstrap.skillRoots()` 에 orca `sources/skills` + `~/.claude/skills` 하드코딩 (`features/extensions/skills/scan.ts` 는 루트 주입식) | `SessionAdapter.getSkillPaths(cwd): string[]` 인터페이스로 책임 이관 — §2 참조 |
| 자격증명 주입 | Auth 플랫폼 — Harness `RuntimeConfigAugmenter`(`features/harnesses/runtime-config.ts`)가 선택된 Harness+ModelProvider 에 자격증명 env overlay 를 붙여 `options.env` 로 넘긴다([auth.md](./auth.md)). 어댑터는 키 이름을 모른다 | 어댑터별 자격증명 요구를 선언으로 노출하는 seam — security.md §1.4 |
| 외부 세션 저장소 → Orca DB 동기화 | 없음 (현재 SDK 의 jsonl 을 직접 읽지 않음) | `listSessions / loadSession` 옵셔널 메서드로 외부 jsonl/SQLite 등을 Orca 로컬 DB 로 단방향 동기화 — persistence.md 참조 |
| 설치 / binary 해소 | SDK `optionalDependencies` 가 자동 처리 → `install()` 즉시 `done: true` 반환 | opencode 등은 별도 install 스크립트 필요 |

### 1.9 새 백엔드 추가 체크리스트

1. `src/main/adapters/<id>.ts` 생성
2. 현행 `SessionAdapter`·`LiveTurn` 구현 + 해당 SDK 이벤트를 `NormalizedEvent[]`를 담은 `ProviderMessageBatch`로 변환
3. `adapters/registry.ts` 에 등록
4. `Backend` union 에 ID 추가 (`src/shared/ipc.ts`)
5. (Future) 어댑터별 Skills 스캔 경로 / 자격증명 키 / 세션 동기화 메서드 정의
6. 설치가 필요하면 `install()` AsyncIterable 구현, 인스톨러 UI 안내 추가
7. preload 의 `backend:select` 채널 재노출 (현재 미노출)
8. 통합 테스트 추가

OpenCode 적용 시의 추가 선행조건·레이어별 gate는 [마이그레이션 연구](../../etc/study/opencode/orca-migration-guide.md)를 참조한다. 위 목록은 실제 활성화 완료를 뜻하지 않는다.

---


## 2. 파일 및 리소스

### 2.1 Skills 스캔 (현재)

`app/src/main/features/extensions/skills/scan.ts` (루트는 `Bootstrap.skillRoots()` 가 주입):

| 항목 | 값 |
|---|---|
| 스캔 루트 | `sources/skills/<name>/SKILL.md` (sourceId=`orca`) + `~/.claude/skills/<name>/SKILL.md` (sourceId=`adapter:claude`). **`<cwd>/.claude/skills` 루트는 제거됨** |
| 파서 | frontmatter 정규식 (`^---\s*\n...\n---`) |
| 인식 키 | `name`, `description`, `argument-hint` |
| 캐싱 | 부팅 스캔 + Orca 의 작성·업로드·토글·삭제 뒤 재스캔(`refreshSkills`, `app/handlers/skills.ts`) → `Bootstrap.skillsCache` |
| 핫리로드 | 파일 감시 없음 — 바깥에서 고친 스킬은 다음 재스캔(위 동작) 또는 재시작에 반영 |

> **⚠️ `~/.claude/skills` 루트는 claude-code 어댑터 전용** (Claude Code 의 표준 경로). 다른 어댑터 (opencode 등) 도 지원하면 스캔 경로 분리 필요 — 사용자 결정.

**번들 스킬 시딩 (0078)**: 부팅 시퀀스의 `builtin-skill-seed` 단계에서 `skills/seed.ts` 의 `seedBuiltinSkills(builtinDir, sourcesSkillsDir)` 가 앱에 번들된 스킬을 `sources/skills/` 로 1회 시딩한다. `app/builtin-resources.ts` 가 dev/패키지 빌드의 번들 경로를 해석하고, manifest/marker 버전 게이트로 이미 시딩된(또는 사용자가 수정한) 스킬을 덮어쓰지 않는다.

**Skill/MCP 배포와 주입** (정본 [standardization.md §5.1](./standardization.md)):
- ExtensionDeployer 가 `sources` 를 `dist/<engine>/plugins/orcinus-orca/{skills,.mcp.json}` plugin 패키지로 렌더하고(0058), `adaptPlugins()` 가 그 경로를 `options.plugins` 로 주입한다. 세션 cwd 로 복사하지 않는다.
- `adaptSkills()`·`adaptSettingSources()`(§1.3) — `settingSources: ['project','local']` 로 사용자 전역 settings 를 상속하지 않고(0117), 사용자 `~/.claude/skills` 는 별도 wrapper plugin 으로 전달한다.
- 파일 기반 MCP 는 plugin `.mcp.json` 으로 로드되고(`${VAR}` 는 배포 시 resolver 가 해석 — [security.md §1.4](./security.md)), `options.mcpServers` 는 인프로세스 runtime tool 서버에만 쓴다. provider settings 는 query flag(`options.settings`)로 주입한다(TRD §6.8).
- agents·commands 는 engine-specific 이라 배포하지 않는다(§3.1). 런타임 hook 은 `options.hooks` in-process 경로다(§3.2.5).

### 2.2 어댑터별 Skills 경로 분리 (Future 채택 결정)

- 현재 `Bootstrap.skillRoots()` 의 하드코딩을 `SessionAdapter.getSkillPaths(cwd): string[]` 인터페이스로 책임 이관.
- 어댑터별 스캔 경로 예시 (도입 시):

| Backend | 예상 경로 |
|---|---|
| `claude-code` | `~/.claude/skills/` (현재 — orca `sources/skills` 와 병행) |
| `opencode` | `~/.config/opencode/skills/` (TBD — opencode 공식 경로 확인 필요) |

- IPC `orca:skills:list` 의 응답은 활성 어댑터의 경로만 반영 (또는 모든 등록된 어댑터의 경로 통합 — 결정 필요).

### 2.3 게시 원본 파일 (Artifacts)

보관 경로·세션과 파일의 수명·휴지통 규칙은 [persistence.md §1.4](./persistence.md) 가 정본이다 — 본 문서는 중복 서술하지 않는다. 게시 도구의 실행 문맥은 [runtime-ipc.md §1](./runtime-ipc.md) "게시 도구의 실행 문맥".

### 2.4 로그

- 위치: `~/.config/orcinus-orca/logs/application.jsonl` (홈 디렉토리 고정, dev/prod 공통). 중앙 LogManager JSONL 단일 파이프라인 — 정본은 [observability.md](observability.md).
- 로테이션: 10MB × 5개(base + .1~.4), 초과 시 오래된 것부터 삭제.

---


## 3. 자산 변환 매트릭스 + Hook 정규화 모델

> 구 `ADAPTER_DESIGN_REVIEW.md` §5·§6 흡수 (2026-06-04). 어댑터 *위* Tier A capability 계층의 자산 변환 + hook 정규화 설계 근거. 2계층 개요는 §1.4(ExtensionBuilder) 참조. 본 모델의 권한 결정(allow/deny/ask)은 [provider-runtime.md §3](./provider-runtime.md) 의 `ApprovalResolution` 2분기와 합류 검토 대상이다.

### 3.1 자산별 변환기 매트릭스

모든 변환기는 **순수 함수**로 유지한다(electron 비의존 → 단위 테스트 가능, `mcp/convert.ts` 가 선례). 동형 시그니처 `to<Backend><Asset>(source, resolve) → { config, dropped }`.

| 자산 | 정규 소스 (Tier A, 중립) | claude 어댑트 | opencode 어댑트 | 정규화도 |
|---|---|---|---|---|
| **MCP** | `mcp.json` (`OrcaMcpConfig`) | `toClaudeConfig` → plugin `.mcp.json`(`dist/<engine>/plugins/orcinus-orca/`, 배포 시 `${VAR}` 해석); 인프로세스 runtime tool 은 `options.mcpServers` | (opencode 변환기 미구현 — `opencode.json` `mcp` 는 목표 형식) | ✅ claude 축 구현됨 |
| **Skill** | `skills/<n>/SKILL.md` | `dist/<engine>/plugins/orcinus-orca/skills/` 배포 → `options.plugins` 로 로드(`settingSources: ['project','local']`) | 네이티브 글로빙 경로로 심링크/복사 | ✅ 변환 불필요(양 백엔드 공통) |
| **systemPrompt** | 중립 문자열(프로젝트 지침) | `preset:'claude_code' + append` | opencode system prompt 옵션 | ⏳ |
| **Hook(런타임)** | **런타임 전용** — 배포 자산 아님 | `options.hooks` in-process 콜백(claude-side `NormalizedHookSet`, §3.2.5) | 네이티브 플러그인 모듈 | ❌ 정규화 안 함(§3.2) |

→ "어댑터를 Orca 범용 데이터 계층으로"라는 질문의 답은 이 표다: **어댑터는 표의 *세로 한 칸*(자기 백엔드 열)만 안다. 가로(자산 종류)와 정규 소스(Tier A)는 어댑터 밖이 소유한다.**

> **engine-specific 자산 연기 (agents·commands·plugin·hooks 배포)**: **agents·commands·full-plugin 번들**은 cross-engine 표준이 아니라 **엔진 고유**다 — Orca SSOT 에서 제외하고 배포하지 않는다(standardization.md §2). 이들과 **hooks 의 파일 배포**(구 `sources/hooks/<engine>` → `dist/<engine>/plugin/hooks` 복사)는 추후 **claude plugin 지원**(가까운 미래: `~/.claude/plugins` 스캔 + query 호출 시 사용자 설정에 따라 주입 여부 결정 — `options.plugins` 채널 재사용)으로 도입한다. 단 **런타임 hook 기능**(`options.hooks` in-process, §3.2.5)은 위 표대로 별개 유지된다. (구 Agent/Command "로컬 플러그인 자동 로드" 행은 plugin 컨테이너 폐기로 제거.)

---

### 3.2 Hook 정규화 모델

> **결론 (2026-06-05 정정 — [standardization.md §2](./standardization.md) 채택)**: Hook 은 **cross-tool 표준이 부재**하고 엔진별 실행 모델이 근본적으로 다르므로(shell exit code / in-process throw / config matcher) **정규화하지 않고 엔진별로 분리**한다. 배포 계층에서 사용자 작성 hook 의 **파일 배포는 추후 claude plugin 지원으로 연기**한다(engine-specific — §3.1, standardization.md §2). 런타임 hook(`options.hooks` in-process, §3.2.5)은 그와 별개로 어댑터 구현 디테일로 유지된다.
>
> 아래 §3.2.1~3.2.4 의 기술 분석은 **이 결론의 근거로 보존**한다 — 분석이 입증하는 것은 정확히 "교차-엔진 정규화는 out-of-process 브릿지 비용·표현력 손실·이벤트 택소노미 갭으로 손익이 맞지 않는다"는 점이다. (이전 라운드는 같은 분석에서 "정규화 가능 표면이 크다"는 *반대 결론*을 냈으나, 표준화 설계 채택으로 입장을 정정한다.) 단, **claude-side in-process `NormalizedHookSet`** 은 교차-tool 표준이 아니라 *claude 어댑터 구현 디테일*로서 코드에 존재하며 유지된다(§3.2.5).

#### 3.2.1 왜 hook 이 "어려운" 자산인가 (MCP 와의 차이)

MCP/skill 은 **정적 선언 데이터**다 — 디스크 파일을 다른 형식의 디스크 파일/옵션으로 변환하면 끝. Hook 은 **실행 시점 콜백 + 양방향 제어 흐름**이다 — 이벤트가 발생하고(런타임), 로직이 결정을 *되돌려*(allow/block/inject) 에이전트 진행을 바꾼다. 정적 변환만으로는 안 되고 *실행 주체*가 어딘가 있어야 한다. 그 실행 주체의 위치가 백엔드마다 다른 게 난점의 핵심이다 (§3.2.4).

#### 3.2.2 중립 이벤트 어휘 — `NormalizedHookEvent`

claude SDK 이벤트(`docs/spec/claude/agent-sdk/hooks.md`)를 Orca 중립 어휘로 매핑한다. **교집합을 코어로, 백엔드 전용은 메타데이터로 표시**한다.

| `NormalizedHookEvent` | claude 이벤트 | opencode 대응(추정) | 코어/전용 |
|---|---|---|---|
| `before-tool` | `PreToolUse` | tool.execute.before | 코어(양쪽) |
| `after-tool` | `PostToolUse` | tool.execute.after | 코어 |
| `on-prompt` | `UserPromptSubmit` | chat.message | 코어 |
| `on-turn-end` | `Stop` | session.idle | 코어 |
| `on-session-start` / `on-session-end` | `SessionStart`/`SessionEnd` | session.* | 코어 |
| `on-subagent-end` | `SubagentStop` | (확인 필요) | claude 우선 |
| `on-notification` | `Notification` | (확인 필요) | claude 우선 |
| `before-compact` | `PreCompact` | (없을 수 있음) | claude 전용 |
| (없음) | `WorktreeCreate` 등 claude TS 전용 다수 | — | claude 전용 |

**한계 명시**: claude 의 hook 이벤트 목록(`hooks.md` 표)은 opencode 보다 훨씬 풍부하다(`PostToolBatch`, `Worktree*`, `TeammateIdle` 등). → (설계 — 미구현, 코드 현실은 §3.2.5) `NormalizedHookEvent` 의 각 항목에 **`supportedBackends` 메타**를 달고, 미지원 백엔드에서는 UI 에서 해당 hook 을 비활성/경고한다. 정규화는 *교집합* 에서 무손실, *전용 영역* 은 §3.2.5 이스케이프 해치로.

#### 3.2.3 중립 입출력 형식

```ts
interface NormalizedHookContext {        // 핸들러가 받는 것 (claude HookInput 의 중립화)
  event: NormalizedHookEvent
  sessionId: string
  cwd: string
  toolName?: string                // before/after-tool
  toolInput?: unknown              // before-tool
  toolOutput?: unknown             // after-tool
  prompt?: string                  // on-prompt
  signal: AbortSignal
  raw: unknown                     // 백엔드 원본 payload 패스스루 (필드명/구조 미스매치 흡수, §3.2.5)
}

interface NormalizedHookDecision {       // 핸들러가 돌려주는 것 (claude HookOutput 의 중립화)
  decision?: 'allow' | 'deny' | 'ask'  // ↔ permissionDecision (claude 'defer' 는 제외 — §3.2.5)
  reason?: string                  // ↔ permissionDecisionReason / stopReason
  injectContext?: string           // ↔ additionalContext / systemMessage (대화에 컨텍스트 주입)
  updatedToolInput?: unknown       // ↔ updatedInput (before-tool 입력 변형)
  updatedToolOutput?: unknown      // ↔ updatedToolOutput (after-tool 결과 변형)
  continue?: boolean               // ↔ continue
}

type NormalizedHookHandler = (ctx: NormalizedHookContext) => Promise<NormalizedHookDecision> | NormalizedHookDecision
```

여러 핸들러가 같은 이벤트에 등록되면 **충돌 해소 규칙을 정규 규칙으로 명문화**한다(claude 의 우선순위와 일치): `deny > ask > allow`. (claude 고유의 `defer` 는 §3.2.5 escape-hatch.)

claude 의 `HookCallback`/`HookOutput`(`hooks.md` 예제 참조)과 **거의 1:1 매핑**된다. `.env` 보호 예제(`hooks.md`)를 중립 핸들러로 쓰면:

```ts
const protectEnv: NormalizedHookHandler = (ctx) =>
  (ctx.toolName?.match(/Write|Edit/) && String((ctx.toolInput as any)?.file_path).endsWith('.env'))
    ? { decision: 'deny', reason: 'Cannot modify .env files' }
    : { decision: 'allow' }
```

**한계 명시**: ① claude 의 `hookSpecificOutput`(불투명·이벤트별 확장 필드)과 `defer`(쿼리 종료 후 재개) 결정은 중립 형식으로 완전 흡수 불가 → §3.2.5 이스케이프 해치. ② 백엔드 payload 필드명/구조 미스매치(`tool_input`(snake) vs opencode 필드)는 코어가 공통 필드만 약속하고 원본은 `raw` 로 패스스루 — 어댑터가 `raw` 를 채운다.

#### 3.2.4 디스패치 분기점 — 정규화의 진짜 경계

여기가 "정규화 가능 / 불가능"이 갈리는 지점이다.

- **claude (인프로세스)**: SDK 가 `query().options.hooks` 로 **인프로세스 TS 콜백**을 받는다. → Orca 가 hook 로직을 `NormalizedHookHandler`(인프로세스 함수)로 소유하고, claude 어댑터는 이를 claude `HookCallback` 으로 **얇게 래핑**해 넘기면 된다. **claude 단독 운영에서는 거의 완전 정규화** — 어휘·입출력·로직 전부 Orca 소유, 어댑터는 시그니처 어댑팅만.

- **opencode (out-of-process `serve`)**: opencode 는 HTTP 서버로 동작하고 hook 을 **별도 TS 플러그인 코드 모듈**로 로드한다. Orca 메인 프로세스의 인프로세스 콜백을 직접 호출할 수 없다. 두 가지 길:
  - **(A) 코드생성 브릿지**: opencode config 에 *thin 플러그인 모듈*을 생성해 두고, 그 모듈이 발생 이벤트를 Orca 메인으로(local HTTP/IPC) 되돌려 `NormalizedHookHandler` 를 실행 → 결정을 회신. 임의 TS 로직을 그대로 살릴 수 있으나, **`before-tool` 같은 동기 게이팅은 왕복(round-trip) 레이턴시**가 붙는다(도구 실행을 막아 세우고 메인의 응답을 기다림). 후처리/로깅 계열(`after-tool`, `on-*`)은 비동기라 비용이 작다.
  - **(B) 선언형 변환**: 단순·선언형 hook(예: "이 도구는 차단", "이 프롬프트에 이 텍스트 주입")만 opencode 네이티브 형식으로 정적 변환. **임의 TS 로직은 표현 불가** → 표현력 손실.

→ **정규화 불가 영역이 이만큼으로 좁혀진다**: ① opencode 의 out-of-process 브릿지 비용(레이턴시) + ② (B 경로 선택 시) 표현력 한계 + ③ §3.2.2 의 백엔드 전용 이벤트. **이벤트 어휘·결정 형식·핸들러 로직 자체는 정규화된다.**

#### 3.2.5 코드 현실: claude-side in-process `NormalizedHookSet` (교차-tool 표준 아님)

> **코드 진실**: 위 §3.2.2~3.2.4 가 설계한 중립 모델은 **`Normalized*` 이름으로 코드가 됐다** — `adapters/hooks.ts`
> (`NormalizedHookEvent` 9종 · `NormalizedHookContext` · `NormalizedHookDecision` · `NormalizedHookHandler` ·
> `NormalizedHookSet` · `resolveHookDecisions`), `adapters/claude/adapt.ts`(`adaptHooks()` + `NORMALIZED_TO_CLAUDE_EVENT`),
> `claude/adapt.test.ts`(`describe('adaptHooks')`), `adapters/turn.ts` 의 `TurnExtensions.hooks: NormalizedHookSet`,
> `features/extensions/builder.ts`(현재 `hooks: { normalized: {} }` — 빈 핸들러; 어댑터 내부 훅은 `claude/adapter.ts` 가 병합). 이는 **claude 어댑터가 SDK
> `query().options.hooks` 로 넘기는 in-process 콜백**의 형태이며, **교차-엔진(claude+opencode) 정규화 표준이 아니다**.
> §3.2 정정에 따라 `normalized` 는 *앱이 주입하는 claude 전용 in-process hook* 의 컨테이너로 재해석하고,
> `backendSpecific` 슬롯이 엔진별 분리(§2 채택)의 코드 표현이다. opencode 의 hook 은 `backendSpecific.opencode`
> (네이티브 플러그인 모듈 경로)로 분리되며 `normalized` 로 합치지 않는다.

```ts
// 정본은 `adapters/hooks.ts`
interface NormalizedHookSet {
  // 양 백엔드가 어댑트하는 중립 코어 (§3.2.2 교집합 이벤트만)
  normalized: Partial<Record<NormalizedHookEvent, NormalizedHookHandler[]>>

  // 환원 불가 영역을 위한 탈출구 — 정규화하지 않고 그대로 전달
  backendSpecific?: {
    claude?: unknown     // 예: 선언형 hooks.json 조각, hookSpecificOutput 사용 콜백
    opencode?: unknown   // 예: opencode 네이티브 플러그인 모듈 경로
  }
}
```

이 구조는 §2 채택과 정합한다: 교차-tool hook 표준이 없으므로 `normalized` 는 *claude 단일 엔진의 in-process 콜백*에 한정하고(범용 정규화 야망 폐기), 엔진별로 묶이는 hook 은 `backendSpecific` 으로 분리한다. 배포 계층의 사용자 작성 hook 파일은 코드 타입이 아니라 `sources/hooks/<engine>/` 디렉토리로 엔진별 분리된다([standardization.md §5.1](./standardization.md)).

#### 3.2.6 보안 주의 — hook 은 임의 코드 실행

Hook 은 정의상 도구 호출/세션 시점에 **임의 로직**을 실행한다. claude 선언형 hook 은 shell 명령까지 돈다. 정규 소스 `~/.config/orcinus-orca/hooks/` 를 도입한다면:
- 출처 신뢰 모델(누가 hook 을 넣을 수 있는가)을 명시하고,
- renderer 에는 hook *메타*만 노출(코드 본문 비노출),
- 비밀은 security.md 의 불변식대로 hook 코드에 평문 인라인 금지(secret-store 경유).

---
