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

1. orca.json 의 각 agent 항목을 `${adapter}-${provider}` 합성 키(이하 **provider key**)로 식별해 **Composer 의 모델 선택 UI** (`${provider key}/${family}`) 로 노출한다. 선택 후 첫 프롬프트 입력 시 그 항목으로 세션이 생성된다.
2. **세션은 adapter(agent) 종속** — 생성 후 다른 adapter 로 전환할 수 없다. 같은 adapter 안에서는 **provider 전환과 모델(family) 변경이 모두 턴 단위로 가능** — env 주입은 0009 그대로 매 턴 `sendMessage` 에서 일어나므로 provider·모델 변경이 턴 단위로 자연 적용된다.
3. `/agents` 페이지(`AgentEnvironmentView`)의 하드코딩 샘플을 orca.json agents 기반 동적 데이터로 교체한다.

**사용자 확정 결정** (설계 협의 결과 — 임의 변경 금지):

1. **턴 단위 적용이 진실.** env·model 은 매 턴 `sendMessage` 의 `query()` 옵션으로 주입된다 (`claude-code.ts:193-199, 229` — 턴마다 새 subprocess + `resume`). 따라서 **라이브 모델 전환 IPC 채널은 도입하지 않는다** — agent 턴 종료 후(사용자 입력 가능 시점) 세션 adapter 의 모든 provider×family 가 선택 가능하고, 선택은 다음 send 페이로드로 적용된다. `LiveTurn.setModel` 은 현행대로 미사용 유지(턴 중 선택 변경은 다음 턴부터 반영).
2. **세션 잠금은 adapter 단위, provider 는 턴 단위 선택 — adapter+provider 조합(= provider key)은 전 앱에서 중복 불허(유일).** auth token 은 *세션이 아니라 agent+provider 조합에 속하는 자격* — 사용자가 orca.json 이 아닌 **앱에서 직접 agent with model 을 추가할 때(현재 mock UI, "엔진 추가")** 함께 입력하는 모델 접근 토큰이다. 토큰은 **secret store(safeStorage, `provider:${provider key}` 키)** 에만 보관하고 **DB 에는 토큰을 평문·해시 어느 형태로도 저장하지 않는다**. 같은 adapter 에 provider 가 다른 항목이 복수 있으면 **사용자 턴마다 다른 provider 로 대화를 지속할 수 있다** — 세션을 잠그는 것은 adapter(기존 `sessions.backend`)뿐이다. 신규 컬럼 `sessions.provider_key` 는 바인딩 제약이 아니라 **마지막 사용 provider 의 기록**(턴마다 갱신)으로, 시작/resume 시 그 항목의 토큰을 복호화·주입하고 composer 초기 선택을 복원하는 데 쓴다. provider key 가 안정적 키가 될 수 있는 근거가 중복 불허 — orca.json 로드 시 같은 key 항목은 두 번째 이후 드롭 + warn, 앱 내 추가 경로(추후 실구현)도 중복 조합 생성을 차단한다. 앱에서 추가한 agent 의 기본 세팅은 **토큰을 제외하고** orca.json 에 저장한다(현재는 목업 — 저장 실동작은 후속).
3. **모델(family)은 영속하지 않는다.** 재개 시 composer 는 세션 adapter 로 잠기고 마지막 사용 provider 항목(`provider_key`)의 default 모델로 시작 — send 시점에 composer 가 선택 중인 provider·family 가 그 턴의 환경·모델.
4. **orca.json `apiKey` → `authToken` 리네임.** 의미를 정확히 반영(API 키뿐 아니라 OAuth 류 access token 포괄, `baseUrl` 과 camelCase 일관). 구명 `apiKey` 는 deprecated 별칭으로 수용 + 경고.
5. **`/agents` 카드에서 orca.json 에 없는 파생 필드 제거** — `id`/`status`/`version`/`tone`/`error`/`active` 삭제, `name`→`adapter`, `platform`→`provider`, `models`→orca.json 구조.
6. **mock UI 공통 규약 신설** — 동작하지 않는 장식 UI("엔진 추가"/"+ 모델" 버튼)는 비활성 + DOM 마커 `data-state="mock"` + **빗금 배경**. 앞으로 모든 mock 에 적용하는 전 앱 규약으로 `dom-architecture.md` 에 문서화.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능한 항목.

1. **provider key 규칙**: `providerKeyOf` — provider 부재/공백 → adapter 단독(`claude-code`), 존재 → `${adapter}-${provider(trim·lowercase)}`(`claude-code-bedrock`). 역파싱 함수 없음 — 조회는 생성 방향 매칭. 모델 표시 키 `${providerKey}/${family}` 는 표시 전용 문자열이고 와이어/상태는 구조 필드 `{providerKey, family}` 로 운반된다. family 부재 모델은 `family ?? name` 폴백. **중복 불허**: 같은 provider key(adapter+provider 조합) 항목 복수 → orca.json 로드 시 두 번째 이후 드롭 + warn — 조합 유일성은 앱 전 경로 공통 규약(앱 내 추가 UI 실구현 시에도 동일 적용).
2. **Composer 노출**: orca.json 에 `claude-code`(provider 부재) + `claude-code`+`bedrock` 2항목 구성 시 모델 메뉴에 `claude-code/<family…>`, `claude-code-bedrock/<family…>` 가 전부 노출된다 (supported adapter 만). 초기 선택은 첫 supported agent 의 default 모델(`default: true` 우선, 없으면 `models[0]`).
3. **세션 생성 + 영속**: 모델 선택 후 첫 send → 세션 생성 시 `sessions.provider_key` 에 그 턴 항목의 provider key 가 저장되고, **이후 매 턴 persist 시 그 턴에 사용된 provider key 로 갱신된다(마지막 사용 provider 기록)**. **토큰은 평문·해시 어느 형태로도 DB 에 저장되지 않는다.**
4. **env·model 주입**: `claude-code-bedrock/sonnet` 으로 생성된 세션의 턴은 SDK subprocess env 에 `CLAUDE_CODE_USE_BEDROCK=1` + 해당 항목 env 가 주입되고(0009 경로), query options `model` = 그 family 의 `models[].name` 이다. family 미지정/미매칭 → default 모델, models 빈 배열 → model 옵션 생략(SDK 기본 모델, 현행 동작 보존). **토큰 해석 순서**: secret store `provider:${provider key}` 우선 → orca.json `authToken`(`${VAR}` 확장) 폴백 — 복호화는 턴 env 합성 시점에만 일어나고, 평문은 DB·캐시·로그·renderer 어디에도 노출되지 않는다.
5. **adapter 전환 불가 · provider 전환 가능 (양측 가드)**: 세션 생성 후 모델 메뉴는 **세션 adapter(`backend`)와 같은 adapter 의 모든 provider 항목 × family** 를 노출하고 타 adapter 항목은 비노출(reducer 가드). 같은 adapter 내라면 **턴마다 다른 provider 를 선택해 대화 지속이 가능** — 유효한 페이로드 `providerKey` 가 그 턴에 적용되고 `sessions.provider_key` 가 갱신된다. main 가드: 페이로드 `providerKey` 가 무효이거나 그 항목의 adapter 가 세션 `backend` 와 불일치하면 DB `provider_key`(→ adapter first-match) 폴백 + warn.
6. **턴 단위 모델 적용**: agent 턴 종료 후 family 변경 → 다음 send 의 `TurnRequest.model` 에 반영된다. 라이브 전환 채널은 존재하지 않는다 (`LiveTurn.setModel` 호출자 0 유지).
7. **resume 복원**: 앱 재시작 → 세션 로드 시 composer 가 **세션 adapter 로 잠기고**, 초기 선택은 `LoadedSession.providerKey`(DB `sessions.provider_key` 값 그대로 — 마지막 사용 provider) 항목 + default 모델. 이후 같은 adapter 의 다른 provider 로 전환해 대화를 지속할 수 있다.
8. **폴백**: 레거시 세션(컬럼 NULL)·provider key 미매칭(orca.json 항목 삭제·provider 표기 변경) → 0009 의 adapter first-match(`agentFor`) 폴백 + warn. 토큰 로테이션은 매칭과 무관 — 키가 자격이 아니므로 토큰 교체만으로 세션이 깨지지 않는다.
9. **제목 생성 agent 일치**: `complete()`(세션 제목) 경로도 그 턴에서 해석된 agent 를 그대로 사용한다 — bedrock 세션의 제목 생성이 다른 env 로 새는 현행 잠재 버그 수정 (`router.ts:657` 의 `agentFor(adapter.id)` 교체).
10. **비밀 미노출**: `orca:agent:list` 응답 DTO 에 `authToken`/`baseUrl`/`env`/secret store 값은 **필드 자체가 존재하지 않는다** (직렬화 결과 부재를 테스트로 단언).
11. **`authToken` 리네임 + 호환**: `OrcaAgentSchema` 가 `authToken` 을 정식 필드로, 구명 `apiKey` 를 deprecated 별칭(경고 후 동일 처리)으로 수용한다. `claude-env.ts` 매핑 산출(`ANTHROPIC_API_KEY`)은 불변 — 0009 테스트가 별칭 경로로 green 유지.
12. **/agents 동적화**: `AgentEnvironmentView` 가 하드코딩 샘플 대신 IPC 데이터를 렌더한다. 카드 필드 = `adapter`/`provider`/`models`(default 에 ✓ 강조, family ?? name 표기). `id`/`status`/`version`/`tone`/`error`/`active` 는 인터페이스·렌더 모두에서 제거. agents 0건이면 orca.json 경로 안내 placeholder.
13. **mock 규약**: "엔진 추가"/"+ 모델" 버튼은 비활성(disabled) + `data-state="mock"` + 빗금 배경(공용 상수 재사용). 규약이 `dom-architecture.md` 에 문서화된다.
14. **무회귀**: orca.json 부재/agents 빈 배열 → 모델 칩 숨김, send 페이로드 신규 필드 생략 → 0009 와 동일 동작. 기존 테스트 무수정 green(better-sqlite3 ABI 환경 제한 제외).
15. **게이트 + 테스트**: `npm run lint && npm run typecheck && npm test` 통과, §게이트의 신규 테스트 전부 green.

## 범위 / 비범위

- **범위**: provider key·중복 검증(dedupe)·토큰 해석(secret store 우선) 순수 함수 모듈, `orca:agent:list` 채널(+도메인 `agent`), `orca:chat:send` 페이로드 확장, `orca:session:load` 응답 확장, sessions 마이그레이션(0008 `provider_key`), Composer 모델 선택 UI(ModelMenu), chat 상태(providerKey/modelFamily) + 가드, `/agents` 동적화 + mock 규약, `authToken` 리네임, 단위 테스트, 문서 갱신.
- **비범위 (후속)**: orca.json 핫리로드(파일 watch — 변경 반영은 앱 재시작), opencode 등 추가 어댑터 소비, 앱 내 agent 추가 UI 실동작(mock 버튼 — 기본 세팅을 **토큰 제외**로 orca.json 에 저장 + 토큰을 secret store `provider:${provider key}` 에 기록 + 중복 조합 입력 차단; 본 핸드오프는 읽기 경로만 연결), 모델(family) 영속, orca.json 파싱 warning 의 renderer 노출, 턴 중 라이브 모델 전환.

## 설계

### provider key · auth token 조회 — `src/main/config/provider-key.ts` (신규, 순수 함수)

```ts
// provider key — composer·/agents 표시/선택 + "마지막 사용 provider" 영속 키. adapter+provider 조합은 중복 불허(유일).
export function providerKeyOf(agent: OrcaAgentConfig): string
//  provider 부재/공백 → adapter 단독. 존재 → `${adapter}-${provider.trim().toLowerCase()}`

export function agentForProviderKey(key: string): OrcaAgentConfig | undefined
//  생성 방향 매칭: agents.find(a => providerKeyOf(a) === key). 로드 시 dedupe 가 선행되므로 매칭은 항상 ≤1.

export function dedupeAgents(agents: OrcaAgentConfig[]): OrcaAgentConfig[]
//  같은 provider key → 두 번째 이후 항목 드롭 + warn. orca.json 로드 시 1회 적용(중복 불허 규약).

// 토큰 해석 — auth token 은 agent+provider 조합의 자격. 앱에서 추가한 항목의 토큰은 secret store 에만 존재.
export function authTokenFor(agent: OrcaAgentConfig, secrets: SecretStore, resolve: Resolver): string | undefined
//  secrets.get(`provider:${providerKeyOf(agent)}`) ?? expandVars(agent.authToken, resolve). 부재/미해결 → undefined.
//  복호화·확장은 턴 env 합성 시점에만 — 캐시/TurnRequest 에는 흐르지 않는다(0009 원칙).

export function modelNameForFamily(agent: OrcaAgentConfig, family?: string): string | undefined
//  family 지정: models.find(m => (m.family ?? m.name) === family)?.name
//  미지정/미매칭: default 모델(= default:true ?? models[0]).name — warn(미매칭 시)
//  models 빈 배열: undefined → 어댑터는 model 옵션 생략(SDK 기본 모델)

export function toAgentEnvironments(config: OrcaConfig, supportedAdapters: ReadonlySet<string>): AgentEnvironment[]
//  화이트리스트 복사 — key/adapter/provider/models/supported 만. authToken·baseUrl·env·secret store 값 미포함.
```

- **역파싱 금지 근거**: adapter 자체에 `-` 가 포함(`claude-code`)되어 `claude-code-bedrock` 을 (adapter, provider) 로 재분해하면 모호하다. 조회는 항상 생성 방향.
- **provider_key 영속 근거**: auth token 은 세션이 아니라 *agent+provider 조합의 자격* — 세션을 잠그는 자격 경계는 adapter(기존 `sessions.backend`)이고, 같은 adapter 내 provider 전환은 턴 단위 허용이 사용자 결정이다. `sessions.provider_key` 는 바인딩 *제약* 이 아니라 **마지막 사용 provider 의 기록** — resume 시 composer 초기 선택과 토큰 주입의 출발점. provider key 는 중복 불허 + trim·lowercase 정규화로 안정적 식별자가 되고, 비밀이 아니므로 DB 영속이 "앱은 비밀을 저장하지 않는다" 베이스라인(`arch/backend/security.md`)과 충돌하지 않는다. orca.json 항목 삭제·provider 표기 변경으로 매칭이 깨지는 것은 **의도된 동작** — 폴백 + warn 으로 완화. 토큰 로테이션은 매칭에 영향 없음.
- **secret store 키 규약**: 기존 `config/secret-store.ts`(safeStorage, `orca-secrets`) 를 그대로 재사용하되 키를 `provider:${provider key}` 로 네임스페이스 — 기존 env-var 이름 키와 충돌 없음(env-var 이름에 `:` 불가). 본 핸드오프는 **읽기 경로(턴 토큰 해석)만** 연결하고, 쓰기 경로(앱 내 agent 추가 UI)는 후속(§비범위).
- 기존 `agentFor(adapter)`(`orca-config.ts:31`)는 폴백(레거시 NULL·매칭 실패) 경로로 유지.
- `expandVars`/`Resolver` 는 0009 산출물(`mcp/expand.ts`) 재사용. 토큰 해석(복호화·확장)은 router 의 턴 env 합성 시점에만 — 캐시/`TurnRequest` 에는 여전히 미확장 값이 흐른다(0009 원칙 유지).

### IPC (총 38 → 39 채널, 도메인 15 → 16)

| 채널 | 방향 | 변경 |
|---|---|---|
| `orca:agent:list` (신규 도메인 `agent`) | R→M invoke | 인자 없음(`runtime:status` 패턴, zod 불요). 응답 `AgentEnvironment[]` |
| `orca:chat:send` | 기존 확장 | `SendChatMessageSchema`(`protocol.ts:24-29`)에 optional `providerKey?: string`(**매 턴 유효** — 이 턴에 쓸 같은 adapter 의 provider 항목) + `modelFamily?: string`(이 턴의 모델). 생략 시 0009 동작 |
| `orca:session:load` | 기존 확장 | `LoadedSession`(`ipc.ts:518-526`)에 `providerKey?: string | null` — DB `sessions.provider_key`(마지막 사용 provider) 저장 값 그대로 반환 |

```ts
// src/shared/ipc.ts — 비밀 0 보장 view DTO
export interface AgentModelView { name: string; family?: string; default?: boolean }
export interface AgentEnvironment {
  key: string            // providerKeyOf 산출 provider key
  adapter: string
  provider?: string
  models: AgentModelView[]
  supported: boolean     // AdapterRegistry 등록 여부 — composer 필터용 최소 파생 필드
}
```

- 도메인 어휘: GLOSSARY 상 Backend=어댑터 엔진, orca.json 항목은 "agent 환경"(TRD §6.8 어휘) — `backend` 도메인 재사용 대신 `agent` 신설.
- 라이브 모델 전환 채널 없음 (사용자 결정 1).

### main / DB

- **마이그레이션 신규** `src/main/db/migrations/0008_provider_key.sql` (auth token 은 agent+provider 조합 소유 — DB·마이그레이션 어휘에 "session token" 류 표현 금지):

  ```sql
  ALTER TABLE sessions ADD COLUMN provider_key TEXT;
  ```

  nullable — 레거시 세션은 NULL. *마지막 사용 provider* 기록이므로 세션 생성 시 저장 + 매 턴 persist 시 갱신. `db/types.ts`(SessionInsert 등) + `db/queries.ts`(insertSession stmt·턴 갱신 stmt, provider_key 조회) 동반 확장. **토큰 컬럼은 어떤 형태(평문/해시)로도 만들지 않는다.**
- **orca.json 스키마** (`config/orca-file.ts`): `authToken` 정식 필드 + `apiKey` deprecated 별칭(파싱 시 `authToken` 으로 정규화 + 경고 1회). 로드 시 `dedupeAgents` 적용(중복 provider key 드롭 + warn). `claude-env.ts` 의 `ANTHROPIC_API_KEY` 매핑 산출 불변.
- **router.ts**:
  - `handleAgentList` 등록 — `toAgentEnvironments(getOrcaConfig(), registry 어댑터 집합)`.
  - `handleChatSend`(`:385` 부근) — 매 턴 페이로드 `providerKey` → `agentForProviderKey` 해석·검증(새 세션: 무효/생략 → `agentFor(adapter.id)` 폴백 + warn / resume: 항목의 adapter 가 세션 `backend` 와 불일치·무효 → DB `provider_key` → 폴백 + warn, **adapter 일치하는 유효 키는 그 턴에 적용** — provider 턴 전환) → `InflightTurn` 에 보관 → `session.updated` persist(`:476-494`) 시 `providerKeyOf(agent)` 를 insert/update(마지막 사용 provider 갱신). 페이로드 생략 resume 은 DB `provider_key` → `agentForProviderKey` → `TurnRequest.agent` (NULL/매칭 실패 → 폴백 + warn). 턴 env 합성 시 `authTokenFor`(secret store 우선 → orca.json `authToken` 폴백)로 토큰 해석.
  - `modelNameForFamily(agent, payload.modelFamily)` 해석값을 `TurnRequest.model` 로 전달.
  - 제목 생성 경로(`:657`)의 `agentFor(adapter.id)` 를 그 턴에서 해석된 agent 로 교체.
- **어댑터**: `extensions/types.ts` `TurnRequest.model?: string` 추가 → `claude-code.ts` query options 에 `...(model ? { model } : {})` (`:221-237` 옵션 블록). orca.json 어휘 해석(family→name)은 config 계층에서 끝나고 어댑터에는 해석 완료된 `model` 문자열만 — 어댑터 중립 유지. mock adapter 는 model 무시(변경 없음).

### renderer (4-layer 준수)

- **shared**: `shared/api/ipc.ts` `agentApi.list()` + preload `agent: { list }` + `shared/hooks/useAgents.ts`(`useSkills.ts` 동형 — 1회 로드·캐시).
- **chat feature**:
  - `chatReducer`: 상태 `providerKey: string | null`·`modelFamily: string | null` + `SET_MODEL` 액션. 가드 — 세션 미생성: 자유 변경 / 세션 생성 후: **세션 adapter(`backend`)와 같은 adapter 의 provider×family 만** 허용(adapter 판별은 `AgentEnvironment.adapter`), 타 adapter 차단. `NEW_CHAT` → 리셋(이후 default 초기 선택 1회 디스패치), `LOAD_SESSION` → adapter 잠금 + `providerKey = session.providerKey`(초기 선택) + family default 복귀, `CachedSession` 에 `providerKey` 추가해 캐시 복원 동일.
  - `chatStore`: `setModel(providerKey, family)` 액션 + `send()` 페이로드에 `providerKey`·`modelFamily` **매 턴 동봉** (`chatStore.ts:149-154, 253-259` 의 permissionMode 동봉 패턴 미러).
  - `composer/ModelMenu.tsx` 신규 — `composer/ModeMenu.tsx` 패턴 복제(role="menuitemradio"). 세션 미생성: supported agent 전체 × family(항목별 그룹 헤더, 라벨 `${key}/${family ?? name}`) / 세션 생성 후: 같은 adapter 의 provider 항목 × family. `Composer.tsx` 권한 모드 칩(`:336-343`) 옆에 모델 칩 추가, agents 0건 → 칩 숨김.
- **engine feature**: `AgentEnvironmentView.tsx` — 로컬 interface·`AGENT_ENVIRONMENT` 샘플(`:4-55`) 삭제 → shared DTO + `useAgents()` 바인딩. 카드 = adapter(굵게)/provider(부제)/모델 칩(default ✓ 강조 — 기존 primary 스타일 재사용). "엔진 추가"/"+ 모델" 버튼 = disabled + `data-state="mock"` + 빗금 배경. 빈 상태 = `~/.config/orca/orca.json` 편집 안내.
- **mock 규약 (전 앱 공통, 신설)**: 동작하지 않는 장식 UI 는 ① `disabled`(또는 `aria-disabled`) ② DOM 마커 `data-state="mock"`(기존 `data-state` 어휘 재사용) ③ 빗금 배경 — Tailwind arbitrary `repeating-linear-gradient` 를 `shared/ui` 공용 상수(예: `MOCK_HATCH_BG`)로 export 해 재사용. `dom-architecture.md` 에 규약 추가.

### 레이어 경계

- renderer: engine·chat feature 모두 `shared/api`·`shared/hooks` 만 의존 — cross-feature import 0. pages 변경은 props 추가 없음(각 feature 가 shared 훅으로 자급).
- main: orca.json 어휘(provider key·family 해석·토큰 해석)는 `config/` 계층, SDK 어휘는 0009 그대로 `adapters/` 격리. 어댑터는 해석 완료된 `model`/`agent` 만 받는다.

## 영향 받는 파일

- **신규** `app/src/main/config/provider-key.ts` + `provider-key.test.ts`
- **신규** `app/src/main/db/migrations/0008_provider_key.sql`
- **신규** `app/src/renderer/src/shared/hooks/useAgents.ts`
- **신규** `app/src/renderer/src/features/chat/components/composer/ModelMenu.tsx`
- **수정** `app/src/main/config/orca-file.ts` (+test — authToken/apiKey 별칭 · dedupe)
- **수정** `app/src/main/db/{types,queries}.ts` (+queries.test — provider_key)
- **수정** `app/src/shared/ipc.ts` (CHANNELS.agentList · AgentEnvironment/AgentModelView · SendChatMessage · LoadedSession)
- **수정** `app/src/shared/protocol.ts` (SendChatMessageSchema 확장)
- **수정** `app/src/main/extensions/types.ts` (TurnRequest.model)
- **수정** `app/src/main/adapters/claude-code.ts` (model 옵션 주입)
- **수정** `app/src/main/ipc/router.ts` (handleAgentList · send 의 provider 해석/`provider_key` 영속·갱신/resume 매칭/토큰 해석 · 제목 생성 agent · session:load 응답)
- **수정** `app/src/preload/index.ts`, `app/src/renderer/src/shared/api/ipc.ts`
- **수정** `app/src/renderer/src/features/chat/` (chatReducer · chatStore · Composer)
- **수정** `app/src/renderer/src/features/engine/components/AgentEnvironmentView.tsx`
- **문서**: `docs/IPC_CONTRACT.md`(도메인 16·총 39 채널·§2.x Agent 표 신설·send/load 확장 — §6 절차 준수) / `docs/TRD.md` §6.8(models 소비 개시 — "파싱·보존만" 문구 폐기, provider key·중복 불허·family 해석·`authToken` 리네임·세션 adapter 잠금 + provider 턴 전환 + `provider_key`(마지막 사용) 영속·secret store 토큰 모델(앱 추가 agent 는 orca.json 토큰 제외 저장), 잔여 범위는 핫리로드 등 §비범위로 정리) / `docs/arch/backend/persistence.md`(0008 `provider_key` — 자격 값 미저장) / `docs/arch/backend/security.md`(auth token 은 secret store(safeStorage) `provider:${provider key}` 키로만 보관 — DB "비밀 저장 0" 유지, MCP 비밀과 동일 모델) / `docs/arch/frontend/dom-architecture.md`(mock 규약) / `docs/arch/frontend/ux-domains.md`(Engine 화면·Composer 모델 칩)

## 참고 문서

- `docs/TRD.md` §6.8 (orca.json — 0009 산출, 이번에 개정), §6 (데이터 모델), §7 (어댑터 외부 계약)
- `docs/IPC_CONTRACT.md` §6 (변경 절차 — **반드시 동시 갱신**), §2 (채널 카탈로그·DTO 패턴: McpServer `hasAuth` 의 비밀 화이트리스트 동형)
- `docs/arch/backend/security.md` (비밀 모델 — secret store 토큰 키 규약을 추가할 곳)
- `docs/arch/frontend/dom-architecture.md` (마커 체계 — mock 규약을 추가할 곳)
- 재사용 코드: `config/orca-{file,config}.ts`·`mcp/expand.ts`(`expandVars`/Resolver)·`adapters/claude-env.ts`(0009 산출) / `composer/ModeMenu.tsx`·`composer/modes.ts`(메뉴 패턴) / `shared/hooks/useSkills.ts`(훅 패턴) / `db/migrations/0007_title_source.sql`(ALTER 단문 패턴)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구 (vitest, electron 비의존 순수 함수):
  - `config/provider-key.test.ts` — `providerKeyOf`: provider 부재/trim·lowercase / `agentForProviderKey`: 매칭·미매칭 undefined / `dedupeAgents`: 중복 provider key 두 번째 이후 드롭 + warn·비중복 보존 / `authTokenFor`: secret store `provider:${key}` 우선·orca.json `authToken`(`${VAR}` 확장) 폴백·양쪽 부재/미해결 → undefined (store 는 주입 가능한 인터페이스로 모킹) / `modelNameForFamily`: family 매칭·`family ?? name` 폴백·미매칭 → default·빈 배열 → undefined / `toAgentEnvironments`: 직렬화 결과에 `authToken`·`baseUrl`·`env` 키 부재 단언.
  - `config/orca-file.test.ts` 보강 — `authToken` 정식 필드 / `apiKey` 별칭 정규화 + 경고 / 둘 다 있을 때 우선순위 / 중복 provider key dedupe.
  - `db/queries.test.ts` 보강 — provider_key insert/턴 갱신/조회, 레거시 NULL row.
  - chat reducer 테스트 — `SET_MODEL` 세션 전 자유 변경·세션 후 **타 adapter 차단 + 같은 adapter provider 전환 허용** 가드 / `NEW_CHAT` 리셋 / `LOAD_SESSION` adapter 잠금 + providerKey 초기 선택.
  - `protocol` 스키마 — SendChatMessageSchema 신규 optional 필드 수용 + 구 페이로드 호환.
  - claude-code — `TurnRequest.model` → query options `model` 주입(옵션 빌드 추출 시 순수 함수로).

---

## [Codex 기입] 구현 체크리스트

- [x] `config/provider-key.ts` (providerKeyOf · agentForProviderKey · dedupeAgents · authTokenFor · modelNameForFamily · toAgentEnvironments) + 테스트
- [x] `config/orca-file.ts` authToken 리네임 + apiKey 별칭 + 로드 시 dedupe (+테스트)
- [x] `db/migrations/0008_provider_key.sql` + `db/{types,queries}.ts` (+테스트)
- [x] `shared/ipc.ts` · `shared/protocol.ts` (채널·DTO·스키마)
- [x] `extensions/types.ts` TurnRequest.model + `claude-code.ts` model 옵션 주입
- [x] `router.ts` (handleAgentList · send provider 해석/`provider_key` 영속·턴 갱신/resume 매칭/토큰 해석(secret store 우선) · 제목 생성 agent · session:load providerKey)
- [x] preload + `shared/api/ipc.ts` + `shared/hooks/useAgents.ts`
- [x] chat feature (chatReducer · chatStore · ModelMenu · Composer 칩)
- [x] engine feature (AgentEnvironmentView 동적화 · mock 규약 · 빈 상태)
- [x] 문서 6건 (IPC_CONTRACT / TRD §6.8 / persistence / security / dom-architecture / ux-domains)
- [x] 게이트 3종 실행

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/config/provider-key.ts`, `app/src/main/config/orca-file.ts`, `app/src/main/db/migrations/0008_provider_key.sql`, `app/src/main/db/{types,queries}.ts`, `app/src/shared/{ipc,protocol}.ts`, `app/src/main/{extensions/types.ts,adapters/claude-code.ts,ipc/router.ts}`, `app/src/preload/index.ts`, `app/src/renderer/src/shared/{api/ipc.ts,hooks/useAgents.ts,ui/mock.ts}`, `app/src/renderer/src/features/chat/**`, `app/src/renderer/src/features/engine/components/AgentEnvironmentView.tsx`, 문서 6건 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` / 범위 `npm test -- src/main/config/provider-key.test.ts src/main/config/orca-file.test.ts src/main/adapters/claude-env.test.ts src/shared/protocol.send.test.ts src/renderer/src/features/chat/reducer/chatReducer.permission.test.ts` |
| 게이트 결과 | lint ✅ / typecheck ✅ / 전체 test ⚠️ better-sqlite3 ABI 환경 제한으로 `db/queries.test.ts` 9건 실패(기존 계열) / 범위 테스트 ✅ 39/39 |
| 블로커 / 역질문 | 없음 — 전체 test 실패는 better-sqlite3 native module ABI 환경 제한 |
| 대상 커밋 | `c2a90d8` |
