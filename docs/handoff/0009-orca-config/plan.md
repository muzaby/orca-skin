# Plan — 0009-orca-config

> Claude Code 설계. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0009-orca-config` |
| 작성자 | Claude Code |
| 일자 | 2026-06-11 |
| 매핑 | PHASES 행 (verify PASS 시 승격) / PR (미정) |
| 상태 | DRAFT → READY |

## Context (왜)

`~/.config/orca/orca.json` 에 **agent 구성**(adapter/provider/apiKey/baseUrl/models/env)을 두고, **앱 실행 시 1회 파싱해 main 프로세스 어떤 레이어에서도 접근**할 수 있는 전역 설정 시스템을 만든다. 1차 소비처는 claude-code 어댑터의 **SDK env 주입**(bedrock/vertex 전환, API 키, base URL) — 현재는 사용자의 ambient 쉘 환경에만 의존해 앱 차원에서 provider/자격을 구성할 방법이 없다.

**사용자 확정 결정** (설계 협의 결과 — 임의 변경 금지):

1. **파일 위치**: `~/.config/orca/orca.json` — config **루트**. `sources/` 아님(`sources/` 는 엔진별 배포 대상 확장 리소스의 SSOT 인 반면, orca.json 은 앱 자체 전역 설정).
2. **apiKey 는 평문과 `${VAR}` 플레이스홀더 둘 다 허용**. `${VAR}` 는 기존 resolver(secret-store → process.env 순) 재사용. 기존 "파일 평문 비밀 0" 원칙(`arch/backend/security.md`)의 **명시적 예외** — 문서에 예외와 권장(`${VAR}`)을 기록한다.
3. **별도 `id` 필드 없음**: 동일 adapter 항목이 복수여도 된다 — provider/baseUrl 이 달라 모델이 자연 구분되며, 대화 시 선택하는 모델 식별자는 **`{adapter}-{provider}/{model}`** 합성 키 형태가 될 것(파생 가능하므로 파일에 중복 저장하지 않음, 합성 함수 도입은 다음 핸드오프).
4. **`env` 필드(레코드) 포함**: 일반적으로 사용되는 환경변수(`AWS_REGION` 등)가 들어간다.
5. **렌더러(IPC) 노출·모델 선택 UI 는 비범위** — 다음 핸드오프.

## orca.json 스키마 (정규형)

```jsonc
// ~/.config/orca/orca.json — 부재 시 부팅이 빈 템플릿을 생성한다
{
  "version": 1,
  "agents": [
    {
      "adapter": "claude-code",            // 필수. Backend id (SDK 사용 타입)
      "provider": "bedrock",               // optional. claude-code 가 아는 값: anthropic|bedrock|vertex
      "apiKey": "${ANTHROPIC_API_KEY}",    // optional. 평문 또는 ${VAR}
      "baseUrl": "",                       // optional. "" 는 부재 취급
      "env": { "AWS_REGION": "us-west-2" }, // optional. env passthrough — 값에 ${VAR} 허용, 매핑 필드보다 우선
      "models": [                          // optional. 이 agent 가 제공하는 모델들 — v1 은 파싱·보존만
        { "family": "sonnet", "name": "claude-sonnet-4-5", "default": true }
      ]
    }
  ]
}
```

zod 정의 (`src/main/config/orca-file.ts`):

```ts
export const OrcaModelSchema = z.object({
  name: z.string().min(1),          // SDK setModel / --model 에 넘길 실제 모델명
  family: z.string().optional(),    // UI 그룹/별칭 표시용 — v1 미소비, 보존만
  default: z.boolean().optional()   // 기본 모델 마킹 — v1 미소비
})

export const OrcaAgentSchema = z.object({
  adapter: z.string().min(1),       // 의도적으로 enum 아님 (설계 근거 2)
  provider: z.string().optional(),  // 동일
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  models: z.array(OrcaModelSchema).default([])
})
export type OrcaAgentConfig = z.infer<typeof OrcaAgentSchema>

export interface OrcaConfig { version: 1; agents: OrcaAgentConfig[] }
```

**스키마 설계 근거**:

1. **동일 adapter 복수 항목 허용** — 식별 필드 없음(사용자 결정 3). v1 소비 규칙은 "adapter 일치 첫 항목"(아래 §설계).
2. **`adapter`/`provider` 는 zod enum 이 아닌 string**: enum 으로 잠그면 사용자가 미래 값(`"adapter": "opencode"`)을 미리 적어두는 순간 파일 전체가 fallback 으로 죽는다. 스키마는 *형태*만 검증하고, *의미* 검증(known adapter/provider)은 소비 시점에 경고+무시.
3. **빈 문자열(`""`)·공백-only 는 부재 취급**: 사용자 템플릿 복붙(`"baseUrl": ""`)이 invalid 가 되지 않게 스키마에서 거부하지 않고 매핑 함수에서 정규화.
4. **알 수 없는 키는 strip**(zod 기본) — 전방 호환.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능한 항목.

1. **파일 생성/보존**: 부팅 시 `~/.config/orca/orca.json` 부재면 `{ "version": 1, "agents": [] }` 템플릿이 atomic(tmp+rename) 생성된다. 이미 존재하면 절대 덮어쓰지 않는다.
2. **전역 접근**: 부팅(`IpcRouter.start()`) 시 1회 파싱·캐시되고, main 의 임의 모듈에서 `getOrcaConfig()` 로 동기 접근된다. 미로드 상태에서 호출해도 lazy load 로 동작한다.
3. **전체 손상 관용**: JSON.parse 실패·최상위 스키마(`version`/`agents`) 위반 시 부팅이 실패하지 않고 기본값 `{version:1, agents:[]}` 로 동작 + `console.warn`. **원본 파일은 수정/덮어쓰기 되지 않는다.**
4. **항목별 관용**: agents 의 개별 항목이 invalid 면 해당 항목만 드롭 + 사유 경고, 나머지 항목은 정상 로드된다. 알 수 없는 키는 무시(에러 아님). `models` 배열은 파싱·보존된다(이번 범위에서 소비 없음).
5. **provider 매핑**: `bedrock`→`CLAUDE_CODE_USE_BEDROCK=1`, `vertex`→`CLAUDE_CODE_USE_VERTEX=1`, `anthropic`/부재→추가 없음, 미지의 값→경고+무시(항목 드롭 아님).
6. **apiKey/baseUrl 매핑**: `apiKey`→`ANTHROPIC_API_KEY`, `baseUrl`→`ANTHROPIC_BASE_URL`. 빈 문자열/공백-only 필드는 부재로 취급된다.
7. **`${VAR}` 해석**: `apiKey`/`baseUrl`/`env` 값의 `${VAR}` 는 secret-store → process.env 순으로 해석된다(`McpStore.resolver()` 재사용). 평문 값은 변형 없이 통과한다. 해석은 어댑트 시점에만 — 캐시/`TurnRequest` 에는 미확장 값이 흐른다.
8. **미해결 `${VAR}`**: **해당 env 키만** 드롭 + 경고. 빈 문자열로 조용히 치환되지 않는다. (mcp 의 서버 전체 드롭과 의도적으로 다름 — `ANTHROPIC_API_KEY` 미해결 시 키를 빼면 SDK 가 CLI 관리 인증으로 자연 폴백하고 나머지 env 는 유효.)
9. **env passthrough 우선순위**: `env` 레코드가 매핑 키보다 우선한다 (`env.ANTHROPIC_API_KEY` 가 `apiKey` 필드 값을 덮음).
10. **sendMessage env 합성**: 턴의 최종 env = `{ ...(pyEnv ?? process.env), ...agentEnv }`. agentEnv 가 비면 기존 동작과 비트 동일(pyEnv 그대로 / 부재 시 옵션 생략).
11. **complete 경로 포함**: 세션 제목 생성(`complete()`)에도 동일 agent env 가 적용된다(bedrock/vertex 사용자는 직접 Anthropic API 가 안 되므로 제외 시 제목 생성이 깨짐). agentEnv 가 비면 기존처럼 env 옵션 자체가 생략된다. agentEnv 가 있으면 `{ ...process.env, ...agentEnv }` 로 합성한다(subprocess 가 PATH 를 잃지 않도록).
12. **agent 선택 규칙 (v1)**: `adapter` 가 어댑터 id(`claude-code`)와 일치하는 **첫 항목**. 일치 항목 없으면 env 주입 0(현행 동작 보존). 복수 항목 간 선택(`{adapter}-{provider}/{model}` 합성 키)은 다음 핸드오프.
13. **변경 범위 0**: IPC 채널·preload·renderer 변경 0, `src/shared/` 변경 0, 신규 npm 의존성 0.
14. **게이트 + 테스트**: `npm run lint && npm run typecheck && npm test` 통과. 아래 §게이트의 신규 테스트 전부 green. `mcp/expand` 리팩토링 후 **기존 테스트 케이스 무수정 green**(동작 불변 증명).

## 범위 / 비범위

- **범위**: orca.json 스키마+파일 I/O+부팅 로드+모듈 싱글톤 접근자, `${VAR}`/평문 해석, claude-code 어댑터 SDK env 매핑·합성(sendMessage + complete), `mcp/expand.ts` 의 `expandVars` 추출(동작 불변), 단위 테스트, 문서 4건 갱신.
- **비범위 (다음 핸드오프)**: 렌더러(IPC) 노출·agent/모델 선택 UI, `{adapter}-{provider}/{model}` 합성 키 함수, `models[].family/default` 소비, 핫리로드(파일 watch — 변경 반영은 앱 재시작), opencode 어댑터 소비.

## 설계

### 접근

mcp.json 의 기존 3 패턴을 그대로 따른다 — (a) 파일 I/O·safeParse fallback 은 `config/mcp-file.ts`, (b) `${VAR}` 미확장 보존 + 어댑트 시점 해석은 `mcp/convert.ts`(`claude-code.ts:204-209` 주석), (c) SDK 고유 어휘의 어댑터 경계 격리는 `claude-adapt.ts`. router 는 백엔드 중립을 유지한다 — 미확장 `OrcaAgentConfig` 를 `TurnRequest.agent` 로 **전달만** 하고, env 변환은 어댑터 내부 순수 함수가 담당.

### 모듈 배치

| 파일 | 책임 |
|---|---|
| `src/main/config/paths.ts` (수정) | `orcaJsonPath()` 추가 = `join(orcaConfigDir(), 'orca.json')`. 헤더 주석 레이아웃 트리에 orca.json 반영 |
| `src/main/config/orca-file.ts` (신규) | zod 스키마 + `parseOrcaFile`(순수 — 문자열 입력) + `readOrcaFile`/`ensureOrcaFile`(템플릿 생성) — `mcp-file.ts` 패턴(sync fs, atomic tmp+rename) |
| `src/main/config/orca-config.ts` (신규) | 모듈 싱글톤: `loadOrcaConfig()`(재독+캐시 갱신) / `getOrcaConfig()`(lazy: `cached ?? loadOrcaConfig()`) / `agentFor(adapter)`(일치 첫 항목) |
| `src/main/adapters/claude-env.ts` (신규) | 순수 함수 `toClaudeEnv(agent, resolve)` + `mergeAgentEnv(base, agentEnv)` — `CLAUDE_CODE_USE_*` 어휘를 어댑터 경계 안에 격리 |
| `src/main/mcp/expand.ts` (수정) | 단일 값 확장 `expandVars(value, resolve)` 추출·export (`VAR_RE` 단일 출처 유지, 기존 동작 불변) |
| `src/main/extensions/types.ts` (수정) | `TurnRequest.agent?: OrcaAgentConfig` 추가 — env/permissionMode 처럼 확장 묶음이 아닌 직속(주석에 근거 기재) |
| `src/main/adapters/types.ts` (수정) | `CompleteRequest.agent?: OrcaAgentConfig` 추가 |
| `src/main/adapters/claude-code.ts` (수정) | env 합성 2지점 — `sendMessage`(`:224` `...(env ? { env } : {})`) + `runCompletion`(`:167` options) |
| `src/main/ipc/router.ts` (수정) | `start()` 부팅 로드(`ensureConfigDir()` 후 — 실패해도 부팅 차단 금지, try/warn) + `agent: agentFor(adapter.id)` 전달 2지점(`:372` sendMessage, `:646` complete) |

### 로딩·접근 정책

- **부팅 훅**: `IpcRouter.start()` 의 기존 마이그레이션 단계들과 같은 자리에서 `ensureOrcaFile()` + `loadOrcaConfig()`. 어떤 실패도 부팅을 막지 않는다(try + `console.warn`).
- **부재 시 템플릿 생성**: `{"version":1,"agents":[]}` 을 atomic write. mcp.json 은 미생성이지만 orca.json 은 *사용자 직접 편집이 1차 진입점*이므로 발견 가능한 앵커를 만든다 — 의도적 차이, 코드 주석으로 명시.
- **손상 3단 관용**: 전체 손상 → 기본값 fallback+경고(원본 보존, `settings/store.ts` 의 safeParse 복원 정신) / 개별 항목 invalid → 그 항목만 드롭+사유 경고(`mcp/expand.ts` 의 서버별 드롭 정신) / 미지 키 → strip.

### env 매핑 (`toClaudeEnv` — 조립 순서 = 우선순위 역순)

| 입력 | 출력 |
|---|---|
| `provider: 'bedrock'` | `CLAUDE_CODE_USE_BEDROCK: '1'` |
| `provider: 'vertex'` | `CLAUDE_CODE_USE_VERTEX: '1'` |
| `provider: 'anthropic'` / 부재 | (추가 없음) |
| provider 미지의 값 | 경고 + 무시 |
| `apiKey` (비공백) | `ANTHROPIC_API_KEY` (확장 후) |
| `baseUrl` (비공백) | `ANTHROPIC_BASE_URL` (확장 후) |
| `env` 레코드 | 마지막 spread (확장 후) — **매핑 키 덮어쓰기 가능** |

```ts
// 반환: 확장 완료 env + 미해결로 드롭된 키 목록(호출처가 mcp 드롭과 같은 형식으로 warn)
export function toClaudeEnv(
  agent: OrcaAgentConfig | undefined,
  resolve: Resolver
): { env: Record<string, string>; missing: string[] }

// agentEnv 가 비면 base 그대로 반환(undefined 포함 — 현행 동작 비트 동일 보존).
// 있으면 (base ?? process.env) 위에 덮는다.
export function mergeAgentEnv(
  base: Record<string, string> | undefined,
  agentEnv: Record<string, string>
): Record<string, string> | undefined
```

- **최종 우선순위: agentEnv > pyEnv(= process.env + uv 격리 변수) > (부재 시) process.env 상속.** orca.json 에 명시한 값이 ambient 쉘 환경을 이기는 것이 사용자 의도. uv 변수(`UV_*`)와 SDK 변수(`ANTHROPIC_*`/`CLAUDE_CODE_*`)는 네임스페이스가 겹치지 않아 실충돌 없음.
- **리스크 — PATH 소실**: SDK `env` 옵션은 subprocess env *전체 치환*이다. agentEnv 만 단독 주입하면 PATH 가 사라진다 — 모든 합성은 `mergeAgentEnv` 단일 관문을 거치게 강제한다.

### `${VAR}` 해석

- 파일 → 캐시 → `TurnRequest.agent` 까지 **미확장** 그대로. 확장은 어댑터의 어댑트 시점(`sendMessage`/`runCompletion` 진입부)에서만 — `toClaudeConfig` 호출과 같은 위치, 같은 `this.makeResolver()` 재사용(`AdapterRegistry` 생성자에 이미 주입됨).
- 평문 값은 `${VAR}` 패턴이 없으므로 `expandVars` 가 그대로 통과 — 추가 분기 불필요.
- `config/secret-store.ts` 헤더 주석을 "MCP 비밀 저장소" → "MCP·orca.json 공용 비밀 저장소" 로 갱신.

### 레이어 경계

renderer 변경 0 — 4-layer boundaries 영향 없음. main 내부에서는 SDK 어휘(`CLAUDE_CODE_USE_*`)가 `adapters/` 밖으로 새지 않게 한다(`makeCanUseTool` 격리와 동일 원칙). mock adapter 는 `agent` 를 무시(변경 없음).

## 영향 받는 파일

- **신규** `app/src/main/config/orca-file.ts` + `orca-file.test.ts`
- **신규** `app/src/main/config/orca-config.ts`
- **신규** `app/src/main/adapters/claude-env.ts` + `claude-env.test.ts`
- **수정** `app/src/main/config/paths.ts` (orcaJsonPath + 헤더 주석)
- **수정** `app/src/main/config/secret-store.ts` (헤더 주석만)
- **수정** `app/src/main/mcp/expand.ts` (+ `expand.test.ts` 보강 — 기존 케이스 무수정)
- **수정** `app/src/main/extensions/types.ts`, `app/src/main/adapters/types.ts`
- **수정** `app/src/main/adapters/claude-code.ts` (env 합성 2지점)
- **수정** `app/src/main/ipc/router.ts` (부팅 로드 + agent 전달 2지점)
- **문서**: `docs/TRD.md` — 새 절 "orca.json 전역 설정" (**스키마 정본 SSOT**: 필드 표 + known adapter/provider 값 + 선택 규칙 + `{adapter}-{provider}/{model}` 식별 체계 + 핫리로드 비범위 + models 미소비 명시) / `docs/arch/backend/standardization.md` §5.1 — `~/.config/orca/` 레이아웃 트리에 orca.json 추가 / `docs/arch/backend/security.md` — apiKey 평문 허용 예외 명시(권장은 `${VAR}` + secret-store/process.env, 파일 퍼미션 책임은 사용자) / `docs/GLOSSARY.md` — orca.json 의 `provider`(클라우드 제공자: anthropic|bedrock|vertex)는 폐기된 Provider 어휘(Backend/Adapter 의미)와 별개임을 1줄 주석

> IPC 변경 없음 → `docs/IPC_CONTRACT.md` 갱신 불필요.

## 참고 문서

- `docs/TRD.md` §6 (데이터 모델 — 설정 카탈로그), §7 (어댑터 외부 계약)
- `docs/arch/backend/standardization.md` §5.1 (`~/.config/orca` 레이아웃)
- `docs/arch/backend/security.md` (비밀 모델 — 평문 예외를 추가할 곳)
- `docs/arch/backend/adapters.md` §1 (어댑터 내부 구조)
- 재사용 코드: `config/mcp-file.ts`(I/O 패턴), `mcp/expand.ts`(`VAR_RE`·Resolver), `mcp/store.ts`(`resolver()`), `settings/store.ts`(safeParse fallback), `adapters/claude-adapt.ts`(어댑트 격리 패턴)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구 (vitest, electron 비의존 순수 함수):
  - `config/orca-file.test.ts` — `parseOrcaFile`: 정상 풀샘플 / 손상 JSON / version 불일치 / 항목별 드롭+사유 / 알 수 없는 키 strip / models 보존.
  - `adapters/claude-env.test.ts` — `toClaudeEnv`: provider 4분기(bedrock/vertex/anthropic·부재/미지), apiKey 평문·`${VAR}` 해석·미해결 키 드롭·빈 문자열 무시, baseUrl, env passthrough 우선순위, agent undefined → 빈 env. `mergeAgentEnv`: base undefined+빈 agentEnv → undefined, 우선순위, base 보존.
  - `mcp/expand.test.ts` 보강 — export 된 `expandVars` 단위 케이스 (기존 케이스 무수정).

---

## [Codex 기입] 구현 체크리스트

- [ ] `paths.ts` `orcaJsonPath()` + 헤더 주석
- [ ] `mcp/expand.ts` `expandVars` 추출·export (동작 불변)
- [ ] `config/orca-file.ts` (스키마 + parse + I/O + 템플릿 생성)
- [ ] `config/orca-config.ts` 싱글톤 (load/get/agentFor)
- [ ] `adapters/claude-env.ts` (toClaudeEnv + mergeAgentEnv)
- [ ] `extensions/types.ts` · `adapters/types.ts` 타입 확장
- [ ] `claude-code.ts` env 합성 2지점 (sendMessage + runCompletion)
- [ ] `router.ts` 부팅 로드 + agent 전달 2지점
- [ ] 테스트 3파일 (orca-file / claude-env / expand 보강)
- [ ] 문서 4건 (TRD / standardization §5.1 / security / GLOSSARY)
- [ ] 게이트 3종 통과

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |
