# Plan — 0010-agent-model-select

> Claude Code 설계. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0010-agent-model-select` |
| 작성자 | Claude Code |
| 일자 | 2026-06-11 |
| 매핑 | PHASES 행 (verify PASS 시 승격) / PR (미정) |
| 상태 | DRAFT → READY |

## Context (왜)

0009-orca-config 가 `~/.config/orca/orca.json` 로드 + claude-code env 주입을 구현하면서 **"adapter 일치 첫 항목"** 이라는 임시 선택 규칙을 남겼다 (0009 인수 기준 12, TRD §6.8 "다음 핸드오프 범위"). 이번 핸드오프는 그 잔여 범위 — **복수 agent 간 선택**을 완성한다:

1. orca.json 의 각 agent 항목을 `${adapter}-${provider}` 합성 키로 식별해 **Composer 의 모델 선택 UI** (`${합성키}/${family}`) 로 노출한다. 선택 후 첫 프롬프트 입력 시 그 agent 로 세션이 생성된다.
2. **세션은 agent(SDK 자격) 종속** — 생성 후 다른 agent 로 전환할 수 없고, 해당 agent 의 모델(family)만 변경 가능하다. env 주입은 0009 그대로 매 턴 `sendMessage` 에서 일어나므로, 모델 변경도 턴 단위로 자연 적용된다.
3. `/agents` 페이지(`AgentEnvironmentView`)의 하드코딩 샘플을 orca.json agents 기반 동적 데이터로 교체한다.

**사용자 확정 결정** (설계 협의 결과 — 임의 변경 금지):

1. **턴 단위 적용이 진실.** env·model 은 매 턴 `sendMessage` 의 `query()` 옵션으로 주입된다 (`claude-code.ts:193-199, 229` — 턴마다 새 subprocess + `resume`). 따라서 **라이브 모델 전환 IPC 채널은 도입하지 않는다** — agent 턴 종료 후(사용자 입력 가능 시점) bound agent 의 모든 family 가 선택 가능하고, 선택은 다음 send 페이로드로 적용된다. `LiveTurn.setModel` 은 현행대로 미사용 유지(턴 중 선택 변경은 다음 턴부터 반영).
2. **세션 바인딩 기준은 auth token(모델 접근 토큰)의 해시.** auth token 은 *agent 식별자가 아니라 자격(계정)* — agent 가 모델(LLM)에 접근할 때 쓰는 access token 이다. DB 에는 **`${VAR}` 해석 완료된 토큰의 SHA-256 hex(불투명 값)만** 영속한다 (`sessions.auth_token_hash`). 평문 토큰·합성 키는 저장하지 않는다. 세션 재개는 같은 자격(해시 일치 + adapter 일치)을 가진 agent 항목으로 매칭된다.
3. **모델(family)은 영속하지 않는다.** 재개 시 composer 는 매칭된 agent 로 잠기고 default 모델로 시작 — send 시점에 composer 가 선택 중인 family 가 그 턴의 모델.
4. **orca.json `apiKey` → `authToken` 리네임.** 의미를 정확히 반영(API 키뿐 아니라 OAuth 류 access token 포괄, `baseUrl` 과 camelCase 일관). 구명 `apiKey` 는 deprecated 별칭으로 수용 + 경고.
5. **`/agents` 카드에서 orca.json 에 없는 파생 필드 제거** — `id`/`status`/`version`/`tone`/`error`/`active` 삭제, `name`→`adapter`, `platform`→`provider`, `models`→orca.json 구조.
6. **mock UI 공통 규약 신설** — 동작하지 않는 장식 UI("엔진 추가"/"+ 모델" 버튼)는 비활성 + DOM 마커 `data-state="mock"` + **빗금 배경**. 앞으로 모든 mock 에 적용하는 전 앱 규약으로 `dom-architecture.md` 에 문서화.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능한 항목.

1. **합성 키 규칙**: `agentKeyOf` — provider 부재/공백 → adapter 단독(`claude-code`), 존재 → `${adapter}-${provider(trim·lowercase)}`(`claude-code-bedrock`). 역파싱 함수 없음 — 조회는 생성 방향 매칭. 모델 표시 키 `${agentKey}/${family}` 는 표시 전용 문자열이고 와이어/상태는 구조 필드 `{agentKey, family}` 로 운반된다. family 부재 모델은 `family ?? name` 폴백.
2. **Composer 노출**: orca.json 에 `claude-code`(provider 부재) + `claude-code`+`bedrock` 2항목 구성 시 모델 메뉴에 `claude-code/<family…>`, `claude-code-bedrock/<family…>` 가 전부 노출된다 (supported adapter 만). 초기 선택은 첫 supported agent 의 default 모델(`default: true` 우선, 없으면 `models[0]`).
3. **세션 생성 + 영속**: 모델 선택 후 첫 send → 세션 생성 시 `sessions.auth_token_hash` 에 그 agent 의 해석된 토큰 SHA-256 hex 가 저장된다. **평문 토큰·합성 키는 DB 에 저장되지 않는다.** 토큰 부재(미설정/`${VAR}` 미해결) agent 는 NULL.
4. **env·model 주입**: `claude-code-bedrock/sonnet` 으로 생성된 세션의 턴은 SDK subprocess env 에 `CLAUDE_CODE_USE_BEDROCK=1` + 해당 항목 env 가 주입되고(0009 경로), query options `model` = 그 family 의 `models[].name` 이다. family 미지정/미매칭 → default 모델, models 빈 배열 → model 옵션 생략(SDK 기본 모델, 현행 동작 보존).
5. **agent 전환 불가 (양측 가드)**: 세션 생성 후 모델 메뉴는 bound agent 의 family 만 노출(타 agent 항목 비노출 — reducer 가드). resume send 에서 main 은 DB 해시 매칭을 우선하고, 페이로드 `agentKey` 가 불일치하면 해시 매칭 승 + warn.
6. **턴 단위 모델 적용**: agent 턴 종료 후 family 변경 → 다음 send 의 `TurnRequest.model` 에 반영된다. 라이브 전환 채널은 존재하지 않는다 (`LiveTurn.setModel` 호출자 0 유지).
7. **resume 복원**: 앱 재시작 → 세션 로드 시 `LoadedSession.agentKey`(해시 → agent 해석 → 표시용 합성 키 *파생값*)로 composer 가 그 agent 로 잠기고 default 모델이 선택된다. 해시 자체는 renderer 로 노출되지 않는다.
8. **폴백**: 레거시 세션(컬럼 NULL)·토큰 부재 agent 세션·토큰 로테이션(해시 불일치) → 0009 의 adapter first-match(`agentFor`) 폴백 + warn. 같은 토큰의 항목 복수 → first-match + warn.
9. **제목 생성 agent 일치**: `complete()`(세션 제목) 경로도 그 턴에서 해석된 agent 를 그대로 사용한다 — bedrock 세션의 제목 생성이 다른 env 로 새는 현행 잠재 버그 수정 (`router.ts:657` 의 `agentFor(adapter.id)` 교체).
10. **비밀 미노출**: `orca:agent:list` 응답 DTO 에 `authToken`/`baseUrl`/`env`/해시는 **필드 자체가 존재하지 않는다** (직렬화 결과 부재를 테스트로 단언).
11. **`authToken` 리네임 + 호환**: `OrcaAgentSchema` 가 `authToken` 을 정식 필드로, 구명 `apiKey` 를 deprecated 별칭(경고 후 동일 처리)으로 수용한다. `claude-env.ts` 매핑 산출(`ANTHROPIC_API_KEY`)은 불변 — 0009 테스트가 별칭 경로로 green 유지.
12. **/agents 동적화**: `AgentEnvironmentView` 가 하드코딩 샘플 대신 IPC 데이터를 렌더한다. 카드 필드 = `adapter`/`provider`/`models`(default 에 ✓ 강조, family ?? name 표기). `id`/`status`/`version`/`tone`/`error`/`active` 는 인터페이스·렌더 모두에서 제거. agents 0건이면 orca.json 경로 안내 placeholder.
13. **mock 규약**: "엔진 추가"/"+ 모델" 버튼은 비활성(disabled) + `data-state="mock"` + 빗금 배경(공용 상수 재사용). 규약이 `dom-architecture.md` 에 문서화된다.
14. **무회귀**: orca.json 부재/agents 빈 배열 → 모델 칩 숨김, send 페이로드 신규 필드 생략 → 0009 와 동일 동작. 기존 테스트 무수정 green(better-sqlite3 ABI 환경 제한 제외).
15. **게이트 + 테스트**: `npm run lint && npm run typecheck && npm test` 통과, §게이트의 신규 테스트 전부 green.

## 범위 / 비범위

- **범위**: 합성 키·auth token 해시 순수 함수 모듈, `orca:agent:list` 채널(+도메인 `agent`), `orca:chat:send` 페이로드 확장, `orca:session:load` 응답 확장, sessions 마이그레이션(0008), Composer 모델 선택 UI(ModelMenu), chat 상태(agentKey/modelFamily) + 가드, `/agents` 동적화 + mock 규약, `authToken` 리네임, 단위 테스트, 문서 갱신.
- **비범위 (후속)**: orca.json 핫리로드(파일 watch — 변경 반영은 앱 재시작), opencode 등 추가 어댑터 소비, orca.json 앱 내 편집 UI(mock 버튼의 실동작), 모델(family) 영속, orca.json 파싱 warning 의 renderer 노출, 턴 중 라이브 모델 전환.

## 설계

### 합성 키 · auth token 조회 — `src/main/config/agent-key.ts` (신규, 순수 함수)

```ts
// 합성 키 — 표시/선택(composer·/agents) 전용. 영속 바인딩 키가 아니다.
export function agentKeyOf(agent: OrcaAgentConfig): string
//  provider 부재/공백 → adapter 단독. 존재 → `${adapter}-${provider.trim().toLowerCase()}`

export function agentForKey(key: string): OrcaAgentConfig | undefined
//  생성 방향 매칭: agents.find(a => agentKeyOf(a) === key). 중복 키 → first-match + warn.

// 세션 바인딩 — 자격(토큰) 기준. 해시는 main 전용, renderer 미노출.
export function authTokenHashOf(agent: OrcaAgentConfig, resolve: Resolver): string | undefined
//  authToken 을 expandVars 로 해석 → SHA-256 hex (node:crypto). 부재/미해결 → undefined.

export function agentForAuthTokenHash(hash: string, adapterId: string, resolve: Resolver): OrcaAgentConfig | undefined
//  adapter 일치 + authTokenHashOf 일치, first-match + warn(복수 매칭 시).

export function modelNameForFamily(agent: OrcaAgentConfig, family?: string): string | undefined
//  family 지정: models.find(m => (m.family ?? m.name) === family)?.name
//  미지정/미매칭: default 모델(= default:true ?? models[0]).name — warn(미매칭 시)
//  models 빈 배열: undefined → 어댑터는 model 옵션 생략(SDK 기본 모델)

export function toAgentEnvironments(config: OrcaConfig, supportedAdapters: ReadonlySet<string>): AgentEnvironment[]
//  화이트리스트 복사 — key/adapter/provider/models/supported 만. authToken·baseUrl·env·해시 미포함.
```

- **역파싱 금지 근거**: adapter 자체에 `-` 가 포함(`claude-code`)되어 `claude-code-bedrock` 을 (adapter, provider) 로 재분해하면 모호하다. 조회는 항상 생성 방향.
- **해시 설계 근거**: 세션은 SDK 자격(계정)에 종속 — 합성 키는 orca.json 편집(항목 재배열·provider 표기 변경)에 불안정하고 비밀도 아니지만, 토큰은 자격 그 자체다. 해시(불투명 값)만 저장해 "앱은 비밀을 저장하지 않는다" 베이스라인(`arch/backend/security.md`)을 유지한다. 로테이션 시 매칭이 깨지는 것은 **의도된 동작**(다른 자격 = 다른 환경) — 폴백 + warn 으로 완화.
- 기존 `agentFor(adapter)`(`orca-config.ts:31`)는 폴백(레거시 NULL·매칭 실패) 경로로 유지.
- `expandVars`/`Resolver` 는 0009 산출물(`mcp/expand.ts`) 재사용. 해시 계산은 router 의 바인딩 시점에만 — 캐시/`TurnRequest` 에는 여전히 미확장 값이 흐른다(0009 원칙 유지).

### IPC (총 38 → 39 채널, 도메인 15 → 16)

| 채널 | 방향 | 변경 |
|---|---|---|
| `orca:agent:list` (신규 도메인 `agent`) | R→M invoke | 인자 없음(`runtime:status` 패턴, zod 불요). 응답 `AgentEnvironment[]` |
| `orca:chat:send` | 기존 확장 | `SendChatMessageSchema`(`protocol.ts:24-29`)에 optional `agentKey?: string`(새 세션 첫 send 만 유효 — 표시 키) + `modelFamily?: string`(이 턴의 모델). 생략 시 0009 동작 |
| `orca:session:load` | 기존 확장 | `LoadedSession`(`ipc.ts:518-526`)에 `agentKey?: string | null` — main 이 저장 해시를 agent 로 해석해 **표시용 합성 키로 파생** 후 반환 |

```ts
// src/shared/ipc.ts — 비밀 0 보장 view DTO
export interface AgentModelView { name: string; family?: string; default?: boolean }
export interface AgentEnvironment {
  key: string            // agentKeyOf 산출 합성 키
  adapter: string
  provider?: string
  models: AgentModelView[]
  supported: boolean     // AdapterRegistry 등록 여부 — composer 필터용 최소 파생 필드
}
```

- 도메인 어휘: GLOSSARY 상 Backend=어댑터 엔진, orca.json 항목은 "agent 환경"(TRD §6.8 어휘) — `backend` 도메인 재사용 대신 `agent` 신설.
- 라이브 모델 전환 채널 없음 (사용자 결정 1).

### main / DB

- **마이그레이션 신규** `src/main/db/migrations/0008_session_auth_token.sql`:

  ```sql
  ALTER TABLE sessions ADD COLUMN auth_token_hash TEXT;
  ```

  nullable — 레거시 세션·토큰 부재 agent 는 NULL. `db/types.ts`(SessionInsert 등) + `db/queries.ts`(insertSession stmt, 해시 조회) 동반 확장.
- **orca.json 스키마** (`config/orca-file.ts`): `authToken` 정식 필드 + `apiKey` deprecated 별칭(파싱 시 `authToken` 으로 정규화 + 경고 1회). `claude-env.ts` 의 `ANTHROPIC_API_KEY` 매핑 산출 불변.
- **router.ts**:
  - `handleAgentList` 등록 — `toAgentEnvironments(getOrcaConfig(), registry 어댑터 집합)`.
  - `handleChatSend`(`:385` 부근) — 새 세션(sessionId null): 페이로드 `agentKey` → `agentForKey` 해석·검증(무효/생략 → `agentFor(adapter.id)` 폴백 + warn) → `InflightTurn` 에 보관 → `session.updated` persist(`:476-494`) 시 `authTokenHashOf(agent)` 를 `insertSession` 에 저장. resume: DB 해시 → `agentForAuthTokenHash` → `TurnRequest.agent` (NULL/매칭 실패 → 폴백 + warn).
  - `modelNameForFamily(agent, payload.modelFamily)` 해석값을 `TurnRequest.model` 로 전달.
  - 제목 생성 경로(`:657`)의 `agentFor(adapter.id)` 를 그 턴에서 해석된 agent 로 교체.
- **어댑터**: `extensions/types.ts` `TurnRequest.model?: string` 추가 → `claude-code.ts` query options 에 `...(model ? { model } : {})` (`:221-237` 옵션 블록). orca.json 어휘 해석(family→name)은 config 계층에서 끝나고 어댑터에는 해석 완료된 `model` 문자열만 — 어댑터 중립 유지. mock adapter 는 model 무시(변경 없음).

### renderer (4-layer 준수)

- **shared**: `shared/api/ipc.ts` `agentApi.list()` + preload `agent: { list }` + `shared/hooks/useAgents.ts`(`useSkills.ts` 동형 — 1회 로드·캐시).
- **chat feature**:
  - `chatReducer`: 상태 `agentKey: string | null`·`modelFamily: string | null` + `SET_MODEL` 액션. 가드 — 세션 미생성: 자유 변경 / 세션 생성 후: **같은 agentKey 의 family 만** 허용. `NEW_CHAT` → 리셋(이후 default 초기 선택 1회 디스패치), `LOAD_SESSION` → `agentKey = session.agentKey` 잠금 + family default 복귀, `CachedSession` 에 `agentKey` 추가해 캐시 복원 동일.
  - `chatStore`: `setModel(agentKey, family)` 액션 + `send()` 페이로드에 `agentKey`(새 세션일 때만)·`modelFamily` 동봉 (`chatStore.ts:149-154, 253-259` 의 permissionMode 동봉 패턴 미러).
  - `composer/ModelMenu.tsx` 신규 — `composer/ModeMenu.tsx` 패턴 복제(role="menuitemradio"). 세션 미생성: supported agent 전체 × family(agent 별 그룹 헤더, 라벨 `${key}/${family ?? name}`) / 세션 생성 후: bound agent 의 family 만. `Composer.tsx` 권한 모드 칩(`:336-343`) 옆에 모델 칩 추가, agents 0건 → 칩 숨김.
- **engine feature**: `AgentEnvironmentView.tsx` — 로컬 interface·`AGENT_ENVIRONMENT` 샘플(`:4-55`) 삭제 → shared DTO + `useAgents()` 바인딩. 카드 = adapter(굵게)/provider(부제)/모델 칩(default ✓ 강조 — 기존 primary 스타일 재사용). "엔진 추가"/"+ 모델" 버튼 = disabled + `data-state="mock"` + 빗금 배경. 빈 상태 = `~/.config/orca/orca.json` 편집 안내.
- **mock 규약 (전 앱 공통, 신설)**: 동작하지 않는 장식 UI 는 ① `disabled`(또는 `aria-disabled`) ② DOM 마커 `data-state="mock"`(기존 `data-state` 어휘 재사용) ③ 빗금 배경 — Tailwind arbitrary `repeating-linear-gradient` 를 `shared/ui` 공용 상수(예: `MOCK_HATCH_BG`)로 export 해 재사용. `dom-architecture.md` 에 규약 추가.

### 레이어 경계

- renderer: engine·chat feature 모두 `shared/api`·`shared/hooks` 만 의존 — cross-feature import 0. pages 변경은 props 추가 없음(각 feature 가 shared 훅으로 자급).
- main: orca.json 어휘(합성 키·family 해석·해시)는 `config/` 계층, SDK 어휘는 0009 그대로 `adapters/` 격리. 어댑터는 해석 완료된 `model`/`agent` 만 받는다.

## 영향 받는 파일

- **신규** `app/src/main/config/agent-key.ts` + `agent-key.test.ts`
- **신규** `app/src/main/db/migrations/0008_session_auth_token.sql`
- **신규** `app/src/renderer/src/shared/hooks/useAgents.ts`
- **신규** `app/src/renderer/src/features/chat/components/composer/ModelMenu.tsx`
- **수정** `app/src/main/config/orca-file.ts` (+test — authToken/apiKey 별칭)
- **수정** `app/src/main/db/{types,queries}.ts` (+queries.test — auth_token_hash)
- **수정** `app/src/shared/ipc.ts` (CHANNELS.agentList · AgentEnvironment/AgentModelView · SendChatMessage · LoadedSession)
- **수정** `app/src/shared/protocol.ts` (SendChatMessageSchema 확장)
- **수정** `app/src/main/extensions/types.ts` (TurnRequest.model)
- **수정** `app/src/main/adapters/claude-code.ts` (model 옵션 주입)
- **수정** `app/src/main/ipc/router.ts` (handleAgentList · send 의 agent 해석/해시 영속/resume 매칭 · 제목 생성 agent · session:load 응답)
- **수정** `app/src/preload/index.ts`, `app/src/renderer/src/shared/api/ipc.ts`
- **수정** `app/src/renderer/src/features/chat/` (chatReducer · chatStore · Composer)
- **수정** `app/src/renderer/src/features/engine/components/AgentEnvironmentView.tsx`
- **문서**: `docs/IPC_CONTRACT.md`(도메인 16·총 39 채널·§2.x Agent 표 신설·send/load 확장 — §6 절차 준수) / `docs/TRD.md` §6.8(models 소비 개시 — "파싱·보존만" 문구 폐기, 합성 키·family 해석·`authToken` 리네임·세션 토큰-해시 바인딩·로테이션 동작, 잔여 범위는 핫리로드 등 §비범위로 정리) / `docs/arch/backend/persistence.md`(0008 — 해시만 저장) / `docs/arch/backend/security.md`(DB 에 토큰 SHA-256 해시(불투명 값)만 저장 — "비밀 저장 0" 정합 명시) / `docs/arch/frontend/dom-architecture.md`(mock 규약) / `docs/arch/frontend/ux-domains.md`(Engine 화면·Composer 모델 칩)

## 참고 문서

- `docs/TRD.md` §6.8 (orca.json — 0009 산출, 이번에 개정), §6 (데이터 모델), §7 (어댑터 외부 계약)
- `docs/IPC_CONTRACT.md` §6 (변경 절차 — **반드시 동시 갱신**), §2 (채널 카탈로그·DTO 패턴: McpServer `hasAuth` 의 비밀 화이트리스트 동형)
- `docs/arch/backend/security.md` (비밀 모델 — 해시 저장 정합을 추가할 곳)
- `docs/arch/frontend/dom-architecture.md` (마커 체계 — mock 규약을 추가할 곳)
- 재사용 코드: `config/orca-{file,config}.ts`·`mcp/expand.ts`(`expandVars`/Resolver)·`adapters/claude-env.ts`(0009 산출) / `composer/ModeMenu.tsx`·`composer/modes.ts`(메뉴 패턴) / `shared/hooks/useSkills.ts`(훅 패턴) / `db/migrations/0007_title_source.sql`(ALTER 단문 패턴)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구 (vitest, electron 비의존 순수 함수):
  - `config/agent-key.test.ts` — `agentKeyOf`: provider 부재/trim·lowercase / `agentForKey`: 매칭·중복 first-match / `authTokenHashOf`: 결정성(같은 토큰 → 같은 해시)·`${VAR}` 해석 후 해시·부재 → undefined / `agentForAuthTokenHash`: adapter+해시 매칭·복수 매칭 first-match / `modelNameForFamily`: family 매칭·`family ?? name` 폴백·미매칭 → default·빈 배열 → undefined / `toAgentEnvironments`: 직렬화 결과에 `authToken`·`baseUrl`·`env`·해시 키 부재 단언.
  - `config/orca-file.test.ts` 보강 — `authToken` 정식 필드 / `apiKey` 별칭 정규화 + 경고 / 둘 다 있을 때 우선순위.
  - `db/queries.test.ts` 보강 — auth_token_hash insert/조회, 레거시 NULL row.
  - chat reducer 테스트 — `SET_MODEL` 세션 전 자유 변경·세션 후 agentKey 불변 가드 / `NEW_CHAT` 리셋 / `LOAD_SESSION` 잠금.
  - `protocol` 스키마 — SendChatMessageSchema 신규 optional 필드 수용 + 구 페이로드 호환.
  - claude-code — `TurnRequest.model` → query options `model` 주입(옵션 빌드 추출 시 순수 함수로).

---

## [Codex 기입] 구현 체크리스트

- [ ] `config/agent-key.ts` (agentKeyOf · agentForKey · authTokenHashOf · agentForAuthTokenHash · modelNameForFamily · toAgentEnvironments) + 테스트
- [ ] `config/orca-file.ts` authToken 리네임 + apiKey 별칭 (+테스트)
- [ ] `db/migrations/0008_session_auth_token.sql` + `db/{types,queries}.ts` (+테스트)
- [ ] `shared/ipc.ts` · `shared/protocol.ts` (채널·DTO·스키마)
- [ ] `extensions/types.ts` TurnRequest.model + `claude-code.ts` model 옵션 주입
- [ ] `router.ts` (handleAgentList · send agent 해석/해시 영속/resume 매칭 · 제목 생성 agent · session:load agentKey)
- [ ] preload + `shared/api/ipc.ts` + `shared/hooks/useAgents.ts`
- [ ] chat feature (chatReducer · chatStore · ModelMenu · Composer 칩)
- [ ] engine feature (AgentEnvironmentView 동적화 · mock 규약 · 빈 상태)
- [ ] 문서 6건 (IPC_CONTRACT / TRD §6.8 / persistence / security / dom-architecture / ux-domains)
- [ ] 게이트 3종 실행

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint / typecheck / test |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |
