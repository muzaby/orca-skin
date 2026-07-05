# Backend Architecture — Adapters (어댑터·ExtensionBuilder·파일/리소스·Hook 정규화)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (BACKEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [provider-runtime.md](./provider-runtime.md), [overview.md](./overview.md), [adapter-design 흡수], [../../claude-code-spec.md](../../claude-code-spec.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. Backend Adapter 추상화

> ⚠️ **"LLM Provider" 가 아니다.** Orca 는 LLM API 를 직접 호출하지 않고 외부 CLI/SDK (Claude Code SDK, opencode 등) 를 래핑한다. 용어는 [GLOSSARY.md](./GLOSSARY.md) §3 참조.

### 1.1 SessionAdapter 인터페이스 계약

`app/src/main/adapters/types.ts:5-15` 그대로:

```typescript
export interface SessionAdapter {
  readonly id: Backend
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  sendMessage(
    sessionId: string | null,   // null = 새 세션
    text: string,
    cwd: string,
    signal?: AbortSignal
  ): AsyncIterable<ChatEvent>
}
```

### 1.2 등록된 백엔드 (현재 — Phase 3 SDK)

| Backend | 어댑터 파일 | 구현 방식 | 상태 |
|---|---|---|---|
| `claude-code` | `adapters/claude-code.ts` | `@anthropic-ai/claude-agent-sdk` 의 `query()` 함수 직접 호출 | ✅ Phase 3 채택 (CLI spawn 폐기) |
| `opencode` | (없음) | — | ⏳ Future (PRD OQ7) |

`AdapterRegistry` (`adapters/registry.ts`) 는 현재 `claude-code` 단일 어댑터만 등록. 활성 백엔드는 부팅 시 자동 결정 (`this.active = claudeCode.id`).

### 1.3 ClaudeCodeAdapter 호출 패턴

`claude-adapt.ts` 의 순수 변환 함수들이 `TurnExtensions`(§1.4) → claude `query()` 옵션 조각(object)으로 변환하며, `...spread` 로 합성된다.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'
import { adaptMcp, adaptSystemPrompt, adaptSettings, adaptSkills, adaptHooks } from './claude-adapt'

async function* sendMessage(sessionId, text, cwd, caps, resolvedMcp, signal) {
  try {
    const opts = {
      resume: sessionId ?? undefined,
      includePartialMessages: true,
      cwd,
      ...adaptMcp(resolvedMcp),            // mcpServers + allowedTools (빈 config면 생략)
      ...adaptSystemPrompt(caps.systemPromptAppend), // systemPrompt preset:claude_code + append
      ...adaptSkills(),                    // skills:'all' — settingSources 경로(SDK 기본 user/project/local)로 발견
      ...adaptSettings(req.providerSettings), // settings(flag 레이어) + disallowedTools 게이팅, settingSources 옵션 생략 (TRD §6.8)
      ...adaptHooks(caps.hooks),           // PreToolUse / PostToolUse / UserPromptSubmit hook 콜백
    }
    for await (const msg of query({ prompt: text, options: opts })) {
      yield normalize(msg)  // SDKMessage → ChatEvent
    }
  } catch (err) {
    yield { type: 'error', data: detectError(err) }
  }
}
```

`adaptMcp` 는 활성 서버가 없으면 옵션 자체를 빈 객체로 반환(생략). `allowedTools` 는 `mcp__<name>__*` 와일드카드로 서버 전체 도구 자동 허용 — `canUseTool` 미도입(Phase 4 anchor) 환경에서 도구 호출 차단 방지. **신 설계(0024 구현됨 / disallowedTools 보류)**: `adaptSettings` 는 `settingSources` 옵션을 주입하지 않아 SDK 기본 소스(user/project/local)가 활성화되며(격리 해제 — handoff 0014/0015 폐기), Orca 가 막아야 할 도구는 `disallowedTools` 로 차단한다(해석은 `adapters/claude-settings.ts` 의 `loadClaudeProviderSettings` — SDK `resolveSettings` + `filterEscalatingDefaultMode` + env `${VAR}` 확장·secret 주입, 캐시는 `settings/provider-settings.ts`). `claude-adapt.ts` 는 0024에서 `settingSources`·`plugins` 주입 제거까지 정렬됐다. `disallowedTools` 는 D1 사용자 결정 전이라 보류.

### 1.4 ExtensionBuilder (백엔드 중립 확장 조립)

> 구 `CapabilityBuilder`/`OrcaCapabilities` 개명(handoff 0062) — 현재 이름은 `ExtensionBuilder`/`TurnExtensions`.

`features/extensions/builder.ts` 의 `ExtensionBuilder` 는 DB / McpStore / Skills 를 읽어 **백엔드 중립** `TurnExtensions` 를 조립한다. 어댑터를 전혀 모른다 — 어댑트(claude 타깃 변환 + `${VAR}` 확장)는 `claude-adapt.ts` 와 `mcp/resolver.ts` 의 책임.

```typescript
// 정확한 필드 SSOT 는 `adapters/turn.ts` 의 TurnExtensions
interface TurnExtensions {
  mcpConfig: OrcaMcpConfig          // 확장 전 정규 소스 (${VAR} 미확장)
  systemPromptAppend?: string       // 프로젝트 지침 (DB)
  skills: SkillInfo[]               // 가시화 메타 (어댑트는 항상-on)
  hooks: OrcaHookSet                // before-tool / after-tool / prompt-submit 핸들러 집합
}
```

`build(sessionId, projectId)` 동작:
- resume 경로 (`sessionId !== null`): 세션 바인딩으로 프로젝트 지침 조회
- 새 채팅 경로 (`sessionId === null`): `projectId` 로 직접 조회
- `systemPromptAppend` = 프로젝트 지침(DB, 있으면). **정적 정책 append 체인(구 `app/src/main/prompts/`)은 handoff 0062 에서 제거**(빈 레지스트리 데드코드) — 관리 구조 논의는 [system-prompt.md](./system-prompt.md) 참조(historical)
- 매 턴 DB 1회 조회 — 캐시 없음 (지침 편집이 다음 메시지부터 즉시 반영)

### 1.5 SDKMessage → ChatEvent 정규화

`adapters/claude-code.ts` 의 `normalize()` 함수 (줄 30-124):

| SDKMessage | → ChatEvent |
|---|---|
| `SDKSystemMessage { subtype: 'init', session_id, model? }` | `{ type: 'init', data: { sessionId, model, cwd } }` |
| `SDKPartialAssistantMessage` 의 `event.delta.type === 'text_delta'` | `{ type: 'assistant_delta', data: { text } }` |
| `SDKAssistantMessage` 의 `content` 내 text block (완성본) | `{ type: 'assistant_message', data: { text } }` |
| `SDKAssistantMessage` 의 `content` 내 `tool_use` block | `{ type: 'tool_use', data: { toolUseId, name, input } }` |
| `SDKUserMessage` 의 `content` 내 `tool_result` block | `{ type: 'tool_result', data: { toolUseId, output, isError, durationMs? } }` |
| `SDKResultMessage { subtype: 'success' \| 'error_*', usage, total_cost_usd }` | `{ type: 'result', data: { usage } }` |
| `SDKPermissionDeniedMessage` (Phase 4) | (현재 무시 — 권한 정책 도입 시 매핑) |
| 어댑터 catch → Error | `{ type: 'error', data: { code: 'sdk.*' \| 'auth.expired' \| ..., message, recoverable } }` |

> **정규화 계층 (설계 확정 / 구현 대기)**: 위 `ChatEvent` 는 claude-code 결합 형태다. provider 중립 `NormalizedEvent`(+ `permission.requested` 1급 이벤트) 로의 승격 설계와 현행 9종 전수 매핑표는 **provider-runtime.md §2** 참조.

### 1.6 인증 만료 감지

SDK 가 throw 하는 에러 메시지/코드에서 `401` / `OAuth` / `expired` 패턴 매칭 → `error / auth.expired` 이벤트 발행 → UI 의 AuthExpiredModal 로 `claude /login` 안내.

### 1.7 SDK 채택 범위 (Phase 3 MVP)

| SDK 기능 | Orca | Phase | 비고 |
|---|---|---|---|
| `query({ prompt, options })` 단일 진입점 | ✅ | Phase 3 | CLI `claude -p` 의 대체 |
| `options.resume: sessionId` | ✅ | Phase 3 | `--resume` 직접 대응 |
| `options.includePartialMessages: true` | ✅ | Phase 3 | delta 스트리밍 |
| `options.cwd` | ✅ | Phase 3 | spawn `{ cwd }` 대체 |
| `result.total_cost_usd` / `usage` / `modelUsage` / `duration_ms` | ✅ | Phase 3++ | `ProviderReportedTelemetry` 로 정규화(cost·model·캐시 토큰·duration·numTurns) → TelemetryPanel (provider-runtime.md §8) |
| `options.permissionMode` / `canUseTool` | ⏳ | Phase 4 (OQ9) | 도구 권한 정책 미정 |
| `options.hooks` (PreToolUse / PostToolUse / Stop) | ⏳ | Phase 4 | 도구 호출 감사 |
| `createSdkMcpServer` + `tool()` | ⏳ | Phase 4+ | in-process MCP 서버(별건) |
| `options.mcpServers` | ✅ | MCP&Skill 통합 레이어 | 정규 소스(`mcp.json`) → `toClaudeConfig` → 활성 서버 주입. `allowedTools`=`mcp__<name>__*` |
| `options.skills: 'all'` (+ `settingSources` 생략) | ✅ | 표준 정렬 | skill 은 SDK 기본 `settingSources` 경로(user/project/local)로 발견. dist 는 `.claude/skills` 거울(추후 cwd 설치 복사). ✅ 0024 구현됨 — `plugins` 주입 제거 |
| `options.disallowedTools` | ✅ | 표준 정렬 | 격리 해제로 끌려오는 사용자 allow 규칙을 확정 차단(deny/disallowed > allow > canUseTool). **D1 사용자 결정 전 보류** |
| `options.plugins` (로컬 플러그인) | ⏳ | claude plugin 지원(future) | agents·commands·full-plugin 등 engine-specific 자산 주입 채널. `~/.claude/plugins` 스캔 + query 주입(§3.1) |
| `prompt: AsyncIterable<SDKUserMessage>` | ⏳ | Phase 4 | 다중 이미지 / 실시간 중단 |
| `forkSession` / `listSessions` / `loadSession` | ⏳ | Phase 3+/4 | 과거 대화 / 멀티 세션 anchor (persistence.md 의 로컬 DB 가 진실의 기준이 되므로 SDK 메서드는 *동기화 소스* 로만) |

자세한 SDK API 시그니처는 [`docs/spec/claude/agent-sdk/typescript.md`](./spec/claude/agent-sdk/typescript.md) (SSOT).

### 1.8 Adapter 책임 확장 (Future anchor)

> **rule of three ([standardization.md §4](./standardization.md))**: 현 `SessionAdapter`(§1.1)는 세션 실행의 얇은 계약이며 **claude 단일 구체** 구현뿐이다. *엔진 전체*(인증·되돌리기·직접 API 등)를 묶는 범용 `BackendAdapter` 추출은 **3번째 엔진까지 미룬다** — 두 엔진은 구체 클래스(`ClaudeEngine`/`OpenCodeEngine`)로 시작하고 겹치는 부분만 추출한다.

opencode 등 다중 어댑터 환경 대비:

| 책임 | 현재 (claude-code 전용) | Future 인터페이스 |
|---|---|---|
| Skills 스캔 경로 | `skills/scan.ts` 에 `~/.claude/skills/` + `<cwd>/.claude/skills/` 하드코딩 | `SessionAdapter.getSkillPaths(cwd): string[]` 인터페이스로 책임 이관 — §2 참조 |
| 자격증명 키 이름 | 없음 (SDK 가 `~/.claude` 자동 사용) | 각 어댑터가 `getCredentialKeys(): string[]` 등으로 base URL / API key 키 이름 정의 — security.md 참조 |
| 외부 세션 저장소 → Orca DB 동기화 | 없음 (현재 SDK 의 jsonl 을 직접 읽지 않음) | `listSessions / loadSession` 옵셔널 메서드로 외부 jsonl/SQLite 등을 Orca 로컬 DB 로 단방향 동기화 — persistence.md 참조 |
| 설치 / binary 해소 | SDK `optionalDependencies` 가 자동 처리 → `install()` 즉시 `done: true` 반환 | opencode 등은 별도 install 스크립트 필요 |

### 1.9 새 백엔드 추가 체크리스트

1. `src/main/adapters/<id>.ts` 생성
2. `SessionAdapter` 인터페이스 구현 + `normalize()` (해당 SDK/CLI 의 이벤트 → ChatEvent)
3. `adapters/registry.ts` 에 등록
4. `Backend` union 에 ID 추가 (`src/shared/ipc.ts`)
5. (Future) 어댑터별 Skills 스캔 경로 / 자격증명 키 / 세션 동기화 메서드 정의
6. 설치가 필요하면 `install()` AsyncIterable 구현, 인스톨러 UI 안내 추가
7. preload 의 `backend:select` 채널 재노출 (현재 미노출)
8. 통합 테스트 추가

---


## 2. 파일 및 리소스

### 2.1 Skills 스캔 (현재)

`app/src/main/skills/scan.ts`:

| 항목 | 값 |
|---|---|
| 스캔 경로 | `~/.claude/skills/<name>/SKILL.md` + `<cwd>/.claude/skills/<name>/SKILL.md` |
| 파서 | frontmatter 정규식 (`^---\s*\n...\n---`) |
| 인식 키 | `name`, `description`, `argument-hint` |
| 캐싱 | 부팅 시 1회 스캔 → `skillsCache` (`router.ts`) |
| 핫리로드 | ❌ 없음 (재시작 필요) |

> **⚠️ 현재 경로는 claude-code 어댑터 전용** (`~/.claude/...` 은 Claude Code 의 표준 경로). 다른 어댑터 (opencode 등) 도 지원하면 스캔 경로 분리 필요 — 사용자 결정.

**Skill/MCP 머티리얼라이즈** (0024 구현됨 / disallowedTools 보류, standardization.md §5.1/§5.2):
- ExtensionDeployer 가 호환 자산을 SDK 표준 경로 거울로 배포 = 설치 스테이징: skill → `dist/<engine>/.claude/skills/`, mcp → `dist/<engine>/.mcp.json`(${VAR} 보존). 추후 "cwd 설치(복사)" 기능이 설치 대상으로 복사한다.
- `adaptSkills()` (§1.3) 은 `skills:'all'` 만 두고 skill 은 `settingSources` 경로(SDK 기본 user/project/local — 옵션 생략)로 발견한다(`plugins` 주입 제거).
- MCP 는 `options.mcpServers` 로 주입 (런타임 ${VAR} 확장). settings.json 은 query flag(`options.settings`)로 주입 (거울 예외, TRD §6.8).
- agents·commands·hooks·plugin 은 engine-specific 이라 배포하지 않는다 — 추후 claude plugin 지원으로 연기(§3.1). (0024에서 구 `plugin/` 컨테이너 + manifest + `plugins:[{local}]` 경로를 제거했다.)

### 2.2 어댑터별 Skills 경로 분리 (Future 채택 결정)

- 현재 `skills/scan.ts` 의 하드코딩을 `SessionAdapter.getSkillPaths(cwd): string[]` 인터페이스로 책임 이관.
- 어댑터별 스캔 경로 예시 (도입 시):

| Backend | 예상 경로 |
|---|---|
| `claude-code` | `~/.claude/skills/` + `<cwd>/.claude/skills/` (현재) |
| `opencode` | `~/.config/opencode/skills/` (TBD — opencode 공식 경로 확인 필요) |

- IPC `orca:skills:list` 의 응답은 활성 어댑터의 경로만 반영 (또는 모든 등록된 어댑터의 경로 통합 — 결정 필요).

### 2.3 Artifacts 디렉토리 (Phase 3+ 도입)

- 경로: `<userData>/artifacts/<sessionId>/<uuid>.<ext>`
- GC 전략: 세션 삭제 시 디렉토리째 제거 + DB CASCADE
- 동기화 안 됨 (로컬 only). 클라우드 백업은 export/import 단위로만.

### 2.4 로그

- 위치 / 라이브러리: **TBD**.
- 후보: `<userData>/logs/main.log` + `<userData>/logs/renderer.log`, electron-log 등.
- 일자별 로테이션 / 크기 제한 정책: TBD.

---


## 3. 자산 변환 매트릭스 + Hook 정규화 모델

> 구 `ADAPTER_DESIGN_REVIEW.md` §5·§6 흡수 (2026-06-04). 어댑터 *위* Tier A capability 계층의 자산 변환 + hook 정규화 설계 근거. 2계층 개요는 §1.4(ExtensionBuilder) 참조. 본 모델의 권한 결정(allow/deny/ask)은 [provider-runtime.md §3](./provider-runtime.md) 의 `ApprovalResolution` 2분기와 합류 검토 대상이다.

### 3.1 자산별 변환기 매트릭스

모든 변환기는 **순수 함수**로 유지한다(electron 비의존 → 단위 테스트 가능, `mcp/convert.ts` 가 선례). 동형 시그니처 `to<Backend><Asset>(source, resolve) → { config, dropped }`.

| 자산 | 정규 소스 (Tier A, 중립) | claude 어댑트 | opencode 어댑트 | 정규화도 |
|---|---|---|---|---|
| **MCP** | `mcp.json` (`OrcaMcpConfig`) | `toClaudeConfig` → `options.mcpServers` + `allowedTools`; 디스크 거울 `dist/<engine>/.mcp.json`(${VAR} 보존) | `toOpencodeConfig` → `opencode.json` `mcp` | ✅ 구현됨 |
| **Skill** | `skills/<n>/SKILL.md` | `dist/<engine>/.claude/skills/` 배포 → `settingSources` 경로로 발견(`skills:'all'`) | 네이티브 글로빙 경로로 심링크/복사 | ✅ 변환 불필요(양 백엔드 공통) |
| **systemPrompt** | 중립 문자열(프로젝트 지침) | `preset:'claude_code' + append` | opencode system prompt 옵션 | ⏳ |
| **Hook(런타임)** | **런타임 전용** — 배포 자산 아님 | `options.hooks` in-process 콜백(claude-side `OrcaHookSet`, §3.2.5) | 네이티브 플러그인 모듈 | ❌ 정규화 안 함(§3.2) |

→ "어댑터를 Orca 범용 데이터 계층으로"라는 질문의 답은 이 표다: **어댑터는 표의 *세로 한 칸*(자기 백엔드 열)만 안다. 가로(자산 종류)와 정규 소스(Tier A)는 어댑터 밖이 소유한다.**

> **engine-specific 자산 연기 (agents·commands·plugin·hooks 배포)**: **agents·commands·full-plugin 번들**은 cross-engine 표준이 아니라 **엔진 고유**다 — Orca SSOT 에서 제외하고 배포하지 않는다(standardization.md §2). 이들과 **hooks 의 파일 배포**(구 `sources/hooks/<engine>` → `dist/<engine>/plugin/hooks` 복사)는 추후 **claude plugin 지원**(가까운 미래: `~/.claude/plugins` 스캔 + query 호출 시 사용자 설정에 따라 주입 여부 결정 — `options.plugins` 채널 재사용)으로 도입한다. 단 **런타임 hook 기능**(`options.hooks` in-process, §3.2.5)은 위 표대로 별개 유지된다. (구 Agent/Command "로컬 플러그인 자동 로드" 행은 plugin 컨테이너 폐기로 제거.)

---

### 3.2 Hook 정규화 모델

> **결론 (2026-06-05 정정 — [standardization.md §2](./standardization.md) 채택)**: Hook 은 **cross-tool 표준이 부재**하고 엔진별 실행 모델이 근본적으로 다르므로(shell exit code / in-process throw / config matcher) **정규화하지 않고 엔진별로 분리**한다. 배포 계층에서 사용자 작성 hook 의 **파일 배포는 추후 claude plugin 지원으로 연기**한다(engine-specific — §3.1, standardization.md §2). 런타임 hook(`options.hooks` in-process, §3.2.5)은 그와 별개로 어댑터 구현 디테일로 유지된다.
>
> 아래 §3.2.1~3.2.4 의 기술 분석은 **이 결론의 근거로 보존**한다 — 분석이 입증하는 것은 정확히 "교차-엔진 정규화는 out-of-process 브릿지 비용·표현력 손실·이벤트 택소노미 갭으로 손익이 맞지 않는다"는 점이다. (이전 라운드는 같은 분석에서 "정규화 가능 표면이 크다"는 *반대 결론*을 냈으나, 표준화 설계 채택으로 입장을 정정한다.) 단, **claude-side in-process `OrcaHookSet`** 은 교차-tool 표준이 아니라 *claude 어댑터 구현 디테일*로서 코드에 존재하며 유지된다(§3.2.5).

#### 3.2.1 왜 hook 이 "어려운" 자산인가 (MCP 와의 차이)

MCP/skill 은 **정적 선언 데이터**다 — 디스크 파일을 다른 형식의 디스크 파일/옵션으로 변환하면 끝. Hook 은 **실행 시점 콜백 + 양방향 제어 흐름**이다 — 이벤트가 발생하고(런타임), 로직이 결정을 *되돌려*(allow/block/inject) 에이전트 진행을 바꾼다. 정적 변환만으로는 안 되고 *실행 주체*가 어딘가 있어야 한다. 그 실행 주체의 위치가 백엔드마다 다른 게 난점의 핵심이다 (§3.2.4).

#### 3.2.2 중립 이벤트 어휘 — `OrcaHookEvent`

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

**한계 명시**: claude 의 hook 이벤트 목록(`hooks.md` 표)은 opencode 보다 훨씬 풍부하다(`PostToolBatch`, `Worktree*`, `TeammateIdle` 등). → `OrcaHookEvent` 의 각 항목에 **`supportedBackends` 메타**를 달고, 미지원 백엔드에서는 UI 에서 해당 hook 을 비활성/경고한다. 정규화는 *교집합* 에서 무손실, *전용 영역* 은 §3.2.5 이스케이프 해치로.

#### 3.2.3 중립 입출력 형식

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
  raw: unknown                     // 백엔드 원본 payload 패스스루 (필드명/구조 미스매치 흡수, §3.2.5)
}

interface OrcaHookDecision {       // 핸들러가 돌려주는 것 (claude HookOutput 의 중립화)
  decision?: 'allow' | 'deny' | 'ask'  // ↔ permissionDecision (claude 'defer' 는 제외 — §3.2.5)
  reason?: string                  // ↔ permissionDecisionReason / stopReason
  injectContext?: string           // ↔ additionalContext / systemMessage (대화에 컨텍스트 주입)
  updatedToolInput?: unknown       // ↔ updatedInput (before-tool 입력 변형)
  updatedToolOutput?: unknown      // ↔ updatedToolOutput (after-tool 결과 변형)
  continue?: boolean               // ↔ continue
}

type OrcaHookHandler = (ctx: OrcaHookContext) => Promise<OrcaHookDecision> | OrcaHookDecision
```

여러 핸들러가 같은 이벤트에 등록되면 **충돌 해소 규칙을 정규 규칙으로 명문화**한다(claude 의 우선순위와 일치): `deny > ask > allow`. (claude 고유의 `defer` 는 §3.2.5 escape-hatch.)

claude 의 `HookCallback`/`HookOutput`(`hooks.md` 예제 참조)과 **거의 1:1 매핑**된다. `.env` 보호 예제(`hooks.md`)를 중립 핸들러로 쓰면:

```ts
const protectEnv: OrcaHookHandler = (ctx) =>
  (ctx.toolName?.match(/Write|Edit/) && String((ctx.toolInput as any)?.file_path).endsWith('.env'))
    ? { action: 'block', reason: 'Cannot modify .env files' }
    : { action: 'allow' }
```

**한계 명시**: ① claude 의 `hookSpecificOutput`(불투명·이벤트별 확장 필드)과 `defer`(쿼리 종료 후 재개) 결정은 중립 형식으로 완전 흡수 불가 → §3.2.5 이스케이프 해치. ② 백엔드 payload 필드명/구조 미스매치(`tool_input`(snake) vs opencode 필드)는 코어가 공통 필드만 약속하고 원본은 `raw` 로 패스스루 — 어댑터가 `raw` 를 채운다.

#### 3.2.4 디스패치 분기점 — 정규화의 진짜 경계

여기가 "정규화 가능 / 불가능"이 갈리는 지점이다.

- **claude (인프로세스)**: SDK 가 `query().options.hooks` 로 **인프로세스 TS 콜백**을 받는다. → Orca 가 hook 로직을 `OrcaHookHandler`(인프로세스 함수)로 소유하고, claude 어댑터는 이를 claude `HookCallback` 으로 **얇게 래핑**해 넘기면 된다. **claude 단독 운영에서는 거의 완전 정규화** — 어휘·입출력·로직 전부 Orca 소유, 어댑터는 시그니처 어댑팅만.

- **opencode (out-of-process `serve`)**: opencode 는 HTTP 서버로 동작하고 hook 을 **별도 TS 플러그인 코드 모듈**로 로드한다. Orca 메인 프로세스의 인프로세스 콜백을 직접 호출할 수 없다. 두 가지 길:
  - **(A) 코드생성 브릿지**: opencode config 에 *thin 플러그인 모듈*을 생성해 두고, 그 모듈이 발생 이벤트를 Orca 메인으로(local HTTP/IPC) 되돌려 `OrcaHookHandler` 를 실행 → 결정을 회신. 임의 TS 로직을 그대로 살릴 수 있으나, **`before-tool` 같은 동기 게이팅은 왕복(round-trip) 레이턴시**가 붙는다(도구 실행을 막아 세우고 메인의 응답을 기다림). 후처리/로깅 계열(`after-tool`, `on-*`)은 비동기라 비용이 작다.
  - **(B) 선언형 변환**: 단순·선언형 hook(예: "이 도구는 차단", "이 프롬프트에 이 텍스트 주입")만 opencode 네이티브 형식으로 정적 변환. **임의 TS 로직은 표현 불가** → 표현력 손실.

→ **정규화 불가 영역이 이만큼으로 좁혀진다**: ① opencode 의 out-of-process 브릿지 비용(레이턴시) + ② (B 경로 선택 시) 표현력 한계 + ③ §3.2.2 의 백엔드 전용 이벤트. **이벤트 어휘·결정 형식·핸들러 로직 자체는 정규화된다.**

#### 3.2.5 코드 현실: claude-side in-process `OrcaHookSet` (교차-tool 표준 아님)

> **코드 진실**: `OrcaHookSet` 은 이미 구현·테스트된 코드다 — `capabilities/hooks.ts`(`OrcaHookSet`/`OrcaHookEvent`), `adapters/claude-adapt.ts`(`adaptHooks()` + `ORCA_TO_CLAUDE_EVENT`), `claude-adapt.test.ts`, `capabilities/builder.ts`(현재 `hooks: { normalized: {} }` — 빈 핸들러). 이는 **claude 어댑터가 SDK `query().options.hooks` 로 넘기는 in-process 콜백**의 형태이며, **교차-엔진(claude+opencode) 정규화 표준이 아니다**. §3.2 정정에 따라 `normalized` 는 *앱이 주입하는 claude 전용 in-process hook* 의 컨테이너로 재해석하고, `backendSpecific` 슬롯이 엔진별 분리(§2 채택)의 코드 표현이다. opencode 의 hook 은 `backendSpecific.opencode`(네이티브 플러그인 모듈 경로)로 분리되며 `normalized` 로 합치지 않는다.

```ts
interface OrcaHookSet {
  // 양 백엔드가 어댑트하는 중립 코어 (§3.2.2 교집합 이벤트만)
  normalized: Partial<Record<OrcaHookEvent, OrcaHookHandler[]>>

  // 환원 불가 영역을 위한 탈출구 — 정규화하지 않고 그대로 전달
  backendSpecific?: {
    'claude-code'?: unknown   // 예: 선언형 hooks.json 조각, hookSpecificOutput 사용 콜백
    'opencode'?: unknown      // 예: opencode 네이티브 플러그인 모듈 경로
  }
}
```

이 구조는 §2 채택과 정합한다: 교차-tool hook 표준이 없으므로 `normalized` 는 *claude 단일 엔진의 in-process 콜백*에 한정하고(범용 정규화 야망 폐기), 엔진별로 묶이는 hook 은 `backendSpecific` 으로 분리한다. 배포 계층의 사용자 작성 hook 파일은 코드 타입이 아니라 `sources/hooks/<engine>/` 디렉토리로 엔진별 분리된다([standardization.md §5.1](./standardization.md)).

#### 3.2.6 보안 주의 — hook 은 임의 코드 실행

Hook 은 정의상 도구 호출/세션 시점에 **임의 로직**을 실행한다. claude 선언형 hook 은 shell 명령까지 돈다. 정규 소스 `~/.config/orca/hooks/` 를 도입한다면:
- 출처 신뢰 모델(누가 hook 을 넣을 수 있는가)을 명시하고,
- renderer 에는 hook *메타*만 노출(코드 본문 비노출),
- 비밀은 security.md 의 불변식대로 hook 코드에 평문 인라인 금지(secret-store 경유).

---

