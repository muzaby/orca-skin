# Adapter 설계 검토 — 어댑터를 "Orca 범용 데이터 계층"으로 볼 수 있는가

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-05-30
> 문서 성격: **설계 검토(Design Review) / 제안** — 구현 SSOT 가 아니다. 현재 구현의 진실은 [`BACKEND_ARCHITECTURE.md`](./BACKEND_ARCHITECTURE.md) 가, 외부 계약은 [`TRD.md`](./TRD.md) §7 이 갖는다. 본 문서는 *채택되기 전까지* 제안으로만 존재하며, 채택 시 §8 의 표대로 SSOT 문서로 역수혈한다.
> 관련 문서: [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) (§4 어댑터 내부, §7 외부 계약, §8.4 MCP&Skill 통합 레이어), [TRD.md](./TRD.md) §6.3, [GLOSSARY.md](./GLOSSARY.md), [spec/claude/agent-sdk/hooks.md](./spec/claude/agent-sdk/hooks.md)
> 진실의 기준: 코드와 어긋날 경우 코드 우선 — 발견 시 사용자에게 보고.

---

## 1. 검토 배경 & 핵심 질문

main 프로세스는 `claude-code` / `opencode` 백엔드 차이를 감추기 위해 `SessionAdapter` 어댑터 추상화를 둔다. 그런데 **skill · MCP · hook 같은 보조기능**을 하나씩 붙이면서 호환 복잡도가 커지고 있다. 사용자(저장소 소유자)의 우려를 그대로 옮기면:

> "어댑터만으로 이 모든 기능들을 지원할 수 있는가? 어댑터를 Orca 범용 데이터를 다루는 계층으로 설계검토하라."

본 검토의 두 가지 작업 결정:

1. **산출물은 설계 검토 문서뿐** — 코드는 바꾸지 않는다. (구현은 채택 후 별도 PR.)
2. **Hook 도 정규화를 *시도*** 한다 — 현재 `BACKEND_ARCHITECTURE.md` §8.4 가 "Hook 은 정규화 대상이 아니며 백엔드별 슬롯으로 둔다"고 못박은 입장에 의도적으로 도전한다. 단, 정직하게 — 정규화 가능한 표면과 환원 불가능한 잔여를 분리해서 제시한다.

### 핵심 결론 (먼저)

> **어댑터는 "범용 데이터를 *다루는* 계층"이 되어선 안 된다. 어댑터는 "범용 데이터를 *자기 백엔드 형식으로 번역하고, 자기 백엔드 이벤트를 범용 형식으로 되돌리는*" 얇은 양방향 경계여야 한다.**
>
> 범용 데이터의 *소유권* 은 어댑터 **위** 의 별도 계층(이하 **Orca Capability 계층**)에 둔다. 이 2계층 분리는 새로 만들 추상화가 아니다 — **MCP 모듈이 이미 정확히 이 형태**(`정규 소스 → 대칭 변환기 → 어댑터 주입`)로 구현되어 있다. 문제는 그 좋은 패턴이 skill / hook / system-prompt 로 *일반화되지 않은 채*, 대신 어댑터의 `sendMessage` 시그니처에 인자로 쌓이고 있다는 것이다. 사용자가 느끼는 "복잡도"의 정체가 바로 이 비대칭이다.

---

## 2. 현황 진단 — 무엇이 복잡도를 만드는가

### 2.1 증상 A: `sendMessage` 위치 인자 증식

`app/src/main/adapters/types.ts`:

```ts
export interface SessionAdapter {
  readonly id: Backend
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
    signal?: AbortSignal,
    systemPromptAppend?: string,   // ← 프로젝트 지침 기능이 붙으며 추가됨
    mcp?: McpQueryOptions          // ← MCP 기능이 붙으며 추가됨
  ): AsyncIterable<ChatEvent>
}
```

보조기능이 하나 추가될 때마다 **위치 인자가 하나씩 늘어난다.** skill 정규화, hook, 권한 모드, 자격증명까지 이 패턴으로 가면 `sendMessage(sessionId, text, cwd, signal, systemPromptAppend, mcp, skills, hooks, permissionMode, credentials, …)` 가 된다. 인자 순서·옵셔널 조합이 폭발하고, 모든 어댑터가 *자기가 쓰지 않는 인자까지* 시그니처로 떠안는다. → **이것이 "어댑터만으로 다 지원 가능한가"라는 불안의 1차 원인.**

### 2.2 증상 B: 추상화 경계가 잘못 그어져 있다

`mcp?: McpQueryOptions` 의 타입을 보면 (`app/src/main/adapters/types.ts`):

```ts
export interface McpQueryOptions {
  servers: ClaudeMcpConfig   // ← 이미 "claude 타깃 타입"!
  allowedTools: string[]     // ← 이미 claude 의 `mcp__<name>__*` 규칙으로 굳음
}
```

즉 **어댑터에 도달하기도 전에 데이터가 claude 형태로 굳어 있다.** 누가 굽는가? IPC 라우터다 (`app/src/main/ipc/router.ts` `handleChatSend`):

```ts
// 전역 MCP 설정 — 활성화된 서버를 query 옵션(mcpServers + allowedTools)으로 주입.
const mcpOptions = this.mcp.buildQueryOptions()   // ← claude 타깃을 router 가 미리 구움
...
for await (const ev of adapter.sendMessage(
  parsed.data.sessionId, parsed.data.text, cwd,
  controller.signal, systemPromptAppend, mcpOptions
)) { ... }
```

`buildQueryOptions()` 는 `toClaudeConfig()` 를 호출해 **claude 전용 결과**를 만든다. 라우터(백엔드 중립이어야 할 상위 계층)가 claude 의 세부를 알고 있다는 뜻이다. opencode 어댑터를 붙이는 순간 이 라인은 거짓이 된다 — opencode 는 `mcpServers`/`allowedTools` 형식을 쓰지 않는다.

### 2.3 증상 C: claude-SDK 리터럴이 어댑터 본문에 박혀 있다

`app/src/main/adapters/claude-code.ts` `sendMessage` 내부:

```ts
const systemPromptOption = systemPromptAppend ? {
  systemPrompt: { type: 'preset', preset: 'claude_code', append: systemPromptAppend }
} : {}

const mcpOption = (mcp && Object.keys(mcp.servers).length > 0)
  ? { mcpServers: mcp.servers, allowedTools: mcp.allowedTools } : {}

const skillsOption = {
  plugins: [{ type: 'local', path: orcaConfigDir() }],
  skills: 'all'
}
```

이 자체는 **올바른 위치다** — claude-SDK 전용 리터럴은 claude 어댑터 안에 있어야 한다. 문제는 증상 B 때문에 *일부* 변환(MCP)은 어댑터 밖(router)에서 일어나고, *일부* 변환(skills, systemPrompt)은 어댑터 안에서 일어나는 **일관성 없는 경계**다. 어디서 무엇이 변환되는지가 기능마다 다르다.

### 2.4 진단 요약

| 보조기능 | 정규(중립) 소스 존재? | 변환 위치 | 경계 상태 |
|---|---|---|---|
| MCP | ✅ `~/.config/orca/mcp.json` (`OrcaMcpConfig`) | **router** (`buildQueryOptions`) → claude 타깃을 어댑터에 주입 | ⚠️ 변환이 어댑터 밖 |
| Skill / agent / command | ✅ `~/.config/orca/{skills,agents,commands}` | **어댑터** (`plugins`+`skills:'all'`) | ✅ 위치 맞음, 단 인자 아닌 부팅 부수효과(`ensureOrcaPlugin`)에 의존 |
| systemPrompt(프로젝트 지침) | ⚠️ DB 조회 결과를 router 가 문자열로 | **어댑터** (preset+append) | ⚠️ 중립 소스 개념 없음 |
| Hook | ❌ 없음 | — | ❌ 미설계 (Phase 4 anchor) |

→ **경계가 기능마다 제각각.** 일관된 단일 규칙이 없어, 새 기능마다 "이건 어디서 변환하지?"를 매번 새로 결정하게 되고, 그 결정이 `sendMessage` 인자 또는 router 분기로 새어 나온다.

---

## 3. 이미 증명된 반례: MCP 의 2계층 파이프라인

좋은 소식은, **올바른 패턴이 같은 코드베이스에 이미 살아 있다**는 것이다. `app/src/main/mcp/` 는 교과서적인 2계층 구조다:

```
정규 소스(백엔드 중립)        대칭 변환기(순수 함수)            어댑터 주입(백엔드 타깃)
~/.config/orca/mcp.json  →   toClaudeConfig(servers,resolve)  →  query().options.mcpServers
(OrcaMcpConfig, ${VAR})  ╲   toOpencodeConfig(servers,resolve) ╲  opencode.json "mcp"
                          ╲   둘 다 동형 시그니처:               ╲
                              to<Backend>Config(servers, resolve)
                                → { config: <Backend>McpConfig; dropped }
```

핵심 속성 (그대로 일반화 대상):

- **정규 소스는 백엔드 중립 + 미확장**(`${VAR}` 플레이스홀더 보유). claude 형식과 *우연히 동형*이라 `type ClaudeMcpConfig = OrcaMcpConfig` 별칭이지만, 개념상 "Orca 의 것"이다.
- **변환기는 순수 함수** — electron 비의존, 단위 테스트 14케이스(`mcp/convert.test.ts`, `expand.test.ts`). 두 백엔드 변환기가 **동형 시그니처**라 대칭이 강제된다.
- **비밀 누출 불변식**: `writeMcpFile` 은 *미확장* 소스만 받는다(타입 강제). 확장 결과(평문)는 메모리→어댑터 주입으로만 흐르고 절대 디스크에 기록되지 않는다.
- **확장 정규 레이어**: `ensureOrcaPlugin()` 이 `~/.config/orca` *디렉토리 자체*를 claude 로컬 플러그인으로 머티리얼라이즈 → skill/agent/command 도 같은 정규 소스에서 출발.

> 이 패턴은 `BACKEND_ARCHITECTURE.md` §8.4 가 "MCP 의 `정규소스→변환기→주입` 패턴을 확장(skill/agent/command) 전반으로 일반화한다"고 *이미 선언*했다. **본 검토의 제안은 그 선언을 끝까지 밀어붙이는 것** — hook 과 systemPrompt 까지, 그리고 어댑터 인터페이스의 형태까지.

---

## 4. 권장 타깃 아키텍처 — 2계층 공식화

### 4.1 그림

```
┌───────────────────────────────────────────────────────────────────┐
│ Tier A — Orca Capability 계층 (백엔드 중립, "범용 데이터 소유")        │
│                                                                     │
│  디스크 정규 소스 ~/.config/orca/                                     │
│    mcp.json · skills/ · agents/ · commands/ · hooks/                 │
│  + secret-store (safeStorage)  ← 비밀은 여기만                        │
│        │                                                            │
│        ▼  조립 (미확장, 백엔드 모름)                                   │
│   OrcaCapabilities 번들  ───────────────────────────────────┐       │
└──────────────────────────────────────────────────────────────│─────┘
                                                                 │ TurnRequest 로 1회 전달
┌──────────────────────────────────────────────────────────────│─────┐
│ Tier B — SessionAdapter (백엔드 종속, "얇은 양방향 번역기")    ▼      │
│                                                                     │
│  어댑트(주입)                ┌── claude: toClaudeConfig + plugins +   │
│   capabilities → 자기 형식 ──┤        skills:'all' + options.hooks    │
│                             └── opencode: toOpencodeConfig + config   │
│                                      on-disk + plugin module          │
│  정규화(역방향)                                                       │
│   SDK/HTTP 이벤트 → ChatEvent   (이미 존재: normalize())              │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Tier A — `OrcaCapabilities` 번들 (개념 스케치, 구현 아님)

```ts
// 모두 "미확장 / 백엔드 중립". 어댑터가 보기 전까지 어떤 백엔드 형식도 모른다.
interface OrcaCapabilities {
  mcp: OrcaMcpConfig                  // ${VAR} 미확장 (현존 타입 재사용)
  skills: OrcaSkillRef[]              // SKILL.md 경로/메타 (현존 SkillInfo 확장)
  agents: OrcaAgentDef[]              // anchor — 정규 소스 ~/.config/orca/agents/
  commands: OrcaCommandDef[]          // anchor — 정규 소스 ~/.config/orca/commands/
  hooks: OrcaHookSet                  // §6
  systemPromptAppend?: string         // 프로젝트 지침 등 중립 텍스트
  // credentials 는 번들에 넣지 않는다 — secret-store 가 별도 소유 (누출 불변식, §7)
}
```

### 4.3 Tier B — 얇아진 `SessionAdapter` (위치 인자 증식 종식)

```ts
interface SessionAdapter {
  readonly id: Backend
  isInstalled(): Promise<InstallInfo>
  install(): AsyncIterable<InstallStep>
  sendMessage(req: TurnRequest): AsyncIterable<ChatEvent>   // ← 인자 1개로 고정
}

interface TurnRequest {
  sessionId: string | null
  text: string
  cwd: string
  signal?: AbortSignal
  capabilities: OrcaCapabilities    // 미확장 중립 번들 — 어댑터가 자기 형식으로 어댑트
}
```

**왜 증식이 멈추는가**: 새 보조기능을 추가할 때 하는 일은 단 두 가지 —
1. `OrcaCapabilities` 에 필드 1개 추가 (중립 데이터),
2. *그 기능을 이해하는 어댑터의 어댑트 변환* 에서만 처리 추가.

`sendMessage` 시그니처는 **영원히 그대로**다. 기능을 모르는 어댑터는 그 필드를 무시하면 된다(opencode 가 아직 hook 미지원이면 `capabilities.hooks` 를 안 본다). 어댑터들이 "남의 기능 인자"를 떠안지 않는다.

### 4.4 권장 호출 흐름 (변환을 어댑터 안으로 되돌림)

```ts
// router.handleChatSend — 백엔드를 모른 채 "중립 번들"만 조립
const capabilities: OrcaCapabilities = this.capabilities.build(sessionId, projectId)
//   build() 내부: mcp.json 읽기(미확장) + skills 스캔 + hooks 로드 + 프로젝트 지침 DB 조회
for await (const ev of adapter.sendMessage({ sessionId, text, cwd, signal, capabilities })) {
  this.persist(turn, ev); this.sendChatEvent(sender, ev)
}

// claude-code 어댑터 내부 — 여기서 "비로소" claude 형식으로 어댑트
const { config } = toClaudeConfig(req.capabilities.mcp, this.resolver)  // ${VAR} 확장도 여기서
query({ prompt: req.text, options: {
  ...adaptSystemPrompt(req.capabilities.systemPromptAppend),
  ...adaptMcp(config),                  // mcpServers + allowedTools
  ...adaptSkills(req.capabilities),      // plugins + skills:'all'
  ...adaptHooks(req.capabilities.hooks)  // §6
}})
```

핵심 변화: 현재 router 가 하던 `buildQueryOptions()`(claude 타깃 굽기)를 **어댑터 안으로 되돌린다.** router 는 다시 백엔드 중립이 되고, `${VAR}` 확장(비밀 복호화)도 어댑트 시점에만 일어난다(누출 표면 축소).

---

## 5. 자산별 변환기 매트릭스

모든 변환기는 **순수 함수**로 유지한다(electron 비의존 → 단위 테스트 가능, `mcp/convert.ts` 가 선례). 동형 시그니처 `to<Backend><Asset>(source, resolve) → { config, dropped }`.

| 자산 | 정규 소스 (Tier A, 중립) | claude 어댑트 | opencode 어댑트 | 정규화도 |
|---|---|---|---|---|
| **MCP** | `mcp.json` (`OrcaMcpConfig`) | `toClaudeConfig` → `options.mcpServers` + `allowedTools` | `toOpencodeConfig` → `opencode.json` `mcp` | ✅ 구현됨 |
| **Skill** | `skills/<n>/SKILL.md` | `plugins:[{local}]` + `skills:'all'` | 네이티브 글로빙 경로로 심링크/복사 | ✅ 변환 불필요(양 백엔드 공통) |
| **Agent** | `agents/<n>.md` | 같은 로컬 플러그인에 포함(자동 로드) | `~/.config/opencode/agent/` 로 셰이핑 | ⏳ 변환기 anchor |
| **Command** | `commands/<n>.md` | 같은 로컬 플러그인에 포함 | `~/.config/opencode/command/` 로 셰이핑 | ⏳ 변환기 anchor |
| **systemPrompt** | 중립 문자열(프로젝트 지침) | `preset:'claude_code' + append` | opencode system prompt 옵션 | ⏳ |
| **Hook** | `hooks/` (`OrcaHookSet`, §6) | `options.hooks` 콜백 + (선언형은 hooks.json) | 코드생성 플러그인 모듈 브릿지 | ⚠️ 부분(§6) |

→ "어댑터를 Orca 범용 데이터 계층으로"라는 질문의 답은 이 표다: **어댑터는 표의 *세로 한 칸*(자기 백엔드 열)만 안다. 가로(자산 종류)와 정규 소스(Tier A)는 어댑터 밖이 소유한다.**

---

## 6. Hook 정규화 모델 (작업 결정 2)

> **정직한 결론 먼저**: Hook 의 **이벤트 어휘 + 결정(출력) 형식 + 인프로세스 핸들러 로직 소유권**까지는 정규화 가능하다. 환원 불가능한 것은 **opencode 의 out-of-process 디스패치 브릿지 비용**과 **백엔드별 이벤트 택소노미 갭**뿐이다. 따라서 "Hook 은 정규화 대상이 아니다"라는 현행 문서 입장은 *과도하게 비관적*이다 — 정규화 가능한 큰 표면을 포기하고 있다.

### 6.1 왜 hook 이 "어려운" 자산인가 (MCP 와의 차이)

MCP/skill 은 **정적 선언 데이터**다 — 디스크 파일을 다른 형식의 디스크 파일/옵션으로 변환하면 끝. Hook 은 **실행 시점 콜백 + 양방향 제어 흐름**이다 — 이벤트가 발생하고(런타임), 로직이 결정을 *되돌려*(allow/block/inject) 에이전트 진행을 바꾼다. 정적 변환만으로는 안 되고 *실행 주체*가 어딘가 있어야 한다. 그 실행 주체의 위치가 백엔드마다 다른 게 난점의 핵심이다 (§6.4).

### 6.2 중립 이벤트 어휘 — `OrcaHookEvent`

claude SDK 이벤트(`docs/spec/claude/agent-sdk/hooks.md`)를 Orca 중립 어휘로 매핑한다. **교집합을 코어로, 백엔드 전용은 메타데이터로 표시**한다.

| `OrcaHookEvent` | claude 이벤트 | opencode 대응(추정) | 코어/전용 |
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

**한계 명시**: claude 의 hook 이벤트 목록(`hooks.md` 표)은 opencode 보다 훨씬 풍부하다(`PostToolBatch`, `Worktree*`, `TeammateIdle` 등). → `OrcaHookEvent` 의 각 항목에 **`supportedBackends` 메타**를 달고, 미지원 백엔드에서는 UI 에서 해당 hook 을 비활성/경고한다. 정규화는 *교집합* 에서 무손실, *전용 영역* 은 §6.5 이스케이프 해치로.

### 6.3 중립 입출력 형식

```ts
interface OrcaHookContext {        // 핸들러가 받는 것 (claude HookInput 의 중립화)
  event: OrcaHookEvent
  sessionId: string
  cwd: string
  toolName?: string                // before/after-tool
  toolInput?: unknown              // before-tool
  toolOutput?: unknown             // after-tool
  prompt?: string                  // on-prompt
  signal: AbortSignal
  raw: unknown                     // 백엔드 원본 payload 패스스루 (필드명/구조 미스매치 흡수, §6.5)
}

interface OrcaHookDecision {       // 핸들러가 돌려주는 것 (claude HookOutput 의 중립화)
  decision?: 'allow' | 'deny' | 'ask'  // ↔ permissionDecision (claude 'defer' 는 제외 — §6.5)
  reason?: string                  // ↔ permissionDecisionReason / stopReason
  injectContext?: string           // ↔ additionalContext / systemMessage (대화에 컨텍스트 주입)
  updatedToolInput?: unknown       // ↔ updatedInput (before-tool 입력 변형)
  updatedToolOutput?: unknown      // ↔ updatedToolOutput (after-tool 결과 변형)
  continue?: boolean               // ↔ continue
}

type OrcaHookHandler = (ctx: OrcaHookContext) => Promise<OrcaHookDecision> | OrcaHookDecision
```

여러 핸들러가 같은 이벤트에 등록되면 **충돌 해소 규칙을 정규 규칙으로 명문화**한다(claude 의 우선순위와 일치): `deny > ask > allow`. (claude 고유의 `defer` 는 §6.5 escape-hatch.)

claude 의 `HookCallback`/`HookOutput`(`hooks.md` 예제 참조)과 **거의 1:1 매핑**된다. `.env` 보호 예제(`hooks.md`)를 중립 핸들러로 쓰면:

```ts
const protectEnv: OrcaHookHandler = (ctx) =>
  (ctx.toolName?.match(/Write|Edit/) && String((ctx.toolInput as any)?.file_path).endsWith('.env'))
    ? { action: 'block', reason: 'Cannot modify .env files' }
    : { action: 'allow' }
```

**한계 명시**: ① claude 의 `hookSpecificOutput`(불투명·이벤트별 확장 필드)과 `defer`(쿼리 종료 후 재개) 결정은 중립 형식으로 완전 흡수 불가 → §6.5 이스케이프 해치. ② 백엔드 payload 필드명/구조 미스매치(`tool_input`(snake) vs opencode 필드)는 코어가 공통 필드만 약속하고 원본은 `raw` 로 패스스루 — 어댑터가 `raw` 를 채운다.

### 6.4 디스패치 분기점 — 정규화의 진짜 경계

여기가 "정규화 가능 / 불가능"이 갈리는 지점이다.

- **claude (인프로세스)**: SDK 가 `query().options.hooks` 로 **인프로세스 TS 콜백**을 받는다. → Orca 가 hook 로직을 `OrcaHookHandler`(인프로세스 함수)로 소유하고, claude 어댑터는 이를 claude `HookCallback` 으로 **얇게 래핑**해 넘기면 된다. **claude 단독 운영에서는 거의 완전 정규화** — 어휘·입출력·로직 전부 Orca 소유, 어댑터는 시그니처 어댑팅만.

- **opencode (out-of-process `serve`)**: opencode 는 HTTP 서버로 동작하고 hook 을 **별도 TS 플러그인 코드 모듈**로 로드한다. Orca 메인 프로세스의 인프로세스 콜백을 직접 호출할 수 없다. 두 가지 길:
  - **(A) 코드생성 브릿지**: opencode config 에 *thin 플러그인 모듈*을 생성해 두고, 그 모듈이 발생 이벤트를 Orca 메인으로(local HTTP/IPC) 되돌려 `OrcaHookHandler` 를 실행 → 결정을 회신. 임의 TS 로직을 그대로 살릴 수 있으나, **`before-tool` 같은 동기 게이팅은 왕복(round-trip) 레이턴시**가 붙는다(도구 실행을 막아 세우고 메인의 응답을 기다림). 후처리/로깅 계열(`after-tool`, `on-*`)은 비동기라 비용이 작다.
  - **(B) 선언형 변환**: 단순·선언형 hook(예: "이 도구는 차단", "이 프롬프트에 이 텍스트 주입")만 opencode 네이티브 형식으로 정적 변환. **임의 TS 로직은 표현 불가** → 표현력 손실.

→ **정규화 불가 영역이 이만큼으로 좁혀진다**: ① opencode 의 out-of-process 브릿지 비용(레이턴시) + ② (B 경로 선택 시) 표현력 한계 + ③ §6.2 의 백엔드 전용 이벤트. **이벤트 어휘·결정 형식·핸들러 로직 자체는 정규화된다.**

### 6.5 권장 설계: 정규화 코어 + 백엔드별 이스케이프 해치

```ts
interface OrcaHookSet {
  // 양 백엔드가 어댑트하는 중립 코어 (§6.2 교집합 이벤트만)
  normalized: Partial<Record<OrcaHookEvent, OrcaHookHandler[]>>

  // 환원 불가 영역을 위한 탈출구 — 정규화하지 않고 그대로 전달
  backendSpecific?: {
    'claude-code'?: unknown   // 예: 선언형 hooks.json 조각, hookSpecificOutput 사용 콜백
    'opencode'?: unknown      // 예: opencode 네이티브 플러그인 모듈 경로
  }
}
```

이 설계는 사용자의 작업 결정 2("Hook 도 정규화 시도")를 **정직하게** 충족한다: 정규화 가능한 최대 표면을 `normalized` 로 가져가되, 본질적으로 백엔드에 묶이는 잔여만 `backendSpecific` 슬롯으로 격리한다. "전부 정규화 가능"이라고 거짓말하지 않고, "전부 포기"라고 과소평가하지도 않는다.

### 6.6 보안 주의 — hook 은 임의 코드 실행

Hook 은 정의상 도구 호출/세션 시점에 **임의 로직**을 실행한다. claude 선언형 hook 은 shell 명령까지 돈다. 정규 소스 `~/.config/orca/hooks/` 를 도입한다면:
- 출처 신뢰 모델(누가 hook 을 넣을 수 있는가)을 명시하고,
- renderer 에는 hook *메타*만 노출(코드 본문 비노출),
- 비밀은 §7 불변식대로 hook 코드에 평문 인라인 금지(secret-store 경유).

---

## 7. 리스크 & 트레이드오프

| 리스크 | 내용 | 완화 |
|---|---|---|
| **단일 객체 vs 위치 인자** | `TurnRequest` 로 묶으면 "무엇이 필수인가" 가시성이 인자 나열보다 약해질 수 있음 | TS 타입으로 필수/옵셔널 강제. `capabilities` 는 *항상 존재*(빈 기능 = 빈 컬렉션, `undefined` 분기 제거) |
| **과잉 추상화(YAGNI)** | opencode 가 아직 미구현인데 일반화 비용을 먼저 치르는가 | 핵심 반박: **MCP 가 *이미* 2계층이다.** 신규 추상화를 *발명*하는 게 아니라 *이미 있는 패턴으로 통일*하는 것 → 순(net) 복잡도는 오히려 감소. opencode 어댑트(어댑터) *구현* 은 어댑터 도입 PR 로 미룰 수 있음(인터페이스만 선반영) |
| **인프로세스 콜백 이식성 갭** | hook 의 claude(인프로세스)/opencode(out-of-process) 비대칭 | §6.4 에 명시. `before-tool` 동기 게이팅 왕복 비용을 설계 문서에 경고로 박아두고, opencode 1차 구현은 비동기 hook(A 경로) 우선·동기 게이팅 후순위 |
| **비밀 누출 불변식 희석** | capability 번들이 커지며 비밀이 디스크/메모리에 새는 표면 확대 | **MCP 의 불변식을 capability 계층 전체로 승격**: 디스크 정규 소스는 *항상 미확장*(`${VAR}`), `resolve`/복호화는 *어댑트 시점만*, 확장 결과는 *메모리→어댑터 주입만*, 절대 파일 미기록. hooks/agents/commands 정규 소스에 동일 적용. `writeMcpFile` 의 "미확장 타입만 받기" 강제를 일반화 |
| **이벤트 택소노미 갭** | 백엔드별 hook 이벤트 차이로 "어떤 백엔드에선 안 되는 hook" 발생 | `OrcaHookEvent.supportedBackends` 메타 + UI 비활성/경고 (§6.2) |
| **정규화도 ≠ 균일** | skill 은 변환 불필요, MCP 는 구조 항등, agent 는 구조 변환, hook 은 부분 — "2계층"이 모든 자산에 똑같이 깔끔하진 않음 | §5 매트릭스로 자산별 정규화도를 *명시*. 일률 적용을 강요하지 않고 "같은 *경계 규칙*, 다른 *변환 깊이*"로 둠 |

---

## 8. 채택 시 갱신될 기존 문서 (지금은 수정하지 않음)

본 검토가 채택되면 아래 SSOT 문서들을 짝 PR 로 갱신한다. **지금은 표로만 명시**하고 본문은 건드리지 않는다(검토 단계).

| 문서 | 위치 | 현재 진술 | 채택 시 |
|---|---|---|---|
| `BACKEND_ARCHITECTURE.md` | §8.4 (이식성 경계) | "Hook·full-plugin 은 정규화 대상이 아니며 백엔드별 슬롯으로 둔다" | "Hook 은 이벤트 어휘·결정 형식·인프로세스 핸들러까지 정규화(코어) + 환원 불가만 `backendSpecific` 이스케이프 해치" |
| `BACKEND_ARCHITECTURE.md` | §4.7 (Adapter 책임 확장) | `getSkillPaths`/`getCredentialKeys` 등 자산별 개별 메서드 | `adapt(capabilities)` 단일 진입점으로 수렴 검토 |
| `TRD.md` | §6.3 SessionAdapter | 위치 인자 시그니처(`sendMessage(sessionId, text, cwd, …)`) | `sendMessage(req: TurnRequest)` 객체 시그니처 + `OrcaCapabilities` 추가 |
| `app/CLAUDE.md` | adapters 설명 | "claude-code 단일 어댑터 (SDK query)" | 2계층 capability 모델 1줄 추가 |
| `GLOSSARY.md` | §1/§2 | — | "Capability Bundle", "Adapt(어댑터 아웃바운드 변환)", "OrcaHook(Event/Decision)" 용어 추가 |
| `IPC_CONTRACT.md` | §2 | (hook IPC 없음) | hook CRUD 도메인 추가 시 채널 정의 |

---

## 9. 단계적 채택 경로 (채택될 경우의 순서 제안)

코드 변경은 본 검토 범위 밖이지만, 채택 시 권장 순서:

1. **시그니처 통합** — `sendMessage(req: TurnRequest)` + `OrcaCapabilities` 도입. 기존 MCP/systemPrompt 를 번들 필드로 이동. `buildQueryOptions()`(claude 타깃 굽기)를 router → claude 어댑터로 되돌림. **opencode 무관, 즉시 가치**(증상 A·B·C 해소).
2. **자산 흡수** — skill/agent/command 의 정규 소스를 `OrcaCapabilities` 로 명시 편입(현재 `ensureOrcaPlugin` 부수효과 의존을 데이터 흐름으로 가시화).
3. **Hook 정규화 코어** — `OrcaHookSet.normalized` + claude 어댑트(인프로세스 콜백 래핑). claude 단독에서 hook 기능 전체 동작. `backendSpecific` 슬롯 예약.
4. **opencode 어댑터** — 어댑트 변환(`toOpencodeConfig` 는 이미 있음) + hook 브릿지(A 경로). 이 시점에야 2계층의 *대칭*이 실증된다.

각 단계는 독립적으로 가치가 있고, 1단계만으로도 사용자가 느끼는 복잡도(인자 증식)는 사라진다.

---

## 10. 한 문단 요약

어댑터 "만으로" 모든 보조기능을 지원하려 하면 `sendMessage` 인자가 무한 증식하고 변환 경계가 기능마다 흩어진다 — 이것이 현재의 복잡도다. 답은 어댑터를 *얇게* 두고, 그 **위에 백엔드 중립 Capability 계층**을 세워 범용 데이터(skill·mcp·hook·agent·command·systemPrompt)를 소유하게 하는 2계층 분리다. 이 패턴은 발명이 아니라 **이미 MCP 모듈에 구현된 것의 일반화**다. Hook 조차 이벤트 어휘·결정 형식·인프로세스 핸들러까지는 정규화되며, 남는 것은 opencode out-of-process 브릿지 비용뿐 — 그것만 백엔드별 이스케이프 해치로 격리한다. 어댑터는 "범용 데이터를 다루는 계층"이 아니라 "범용 데이터를 자기 백엔드로 번역하는 양방향 경계"가 되어야 한다.
