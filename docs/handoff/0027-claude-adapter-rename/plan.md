# Plan — 0027-claude-adapter-rename

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(리네임 리팩토링) = Claude 직접 구현.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0027-claude-adapter-rename` |
| 작성자 | Claude Code |
| 일자 | 2026-06-17 |
| 매핑 | PHASES 행 / PR (구현 후) |
| 상태 | IMPL_DONE |

## Context (왜)

Orca 의 claude 어댑터/엔진 식별자는 기존 `'claude-code'` 에서 현재 `'claude'` 로 변경됐다(`Backend` 타입, `adapter.id`, `SUPPORTED_ENGINE`, provider key 접두, `sources/settings/claude/`·`dist/claude/` 디렉토리). 사용자 결정으로 이 **Orca 내부 식별자**를 `'claude'` 로 단순화하고, 그에서 파생되는 **디렉토리 규칙**(sources/dist/hooks 트리)도 전부 `claude` 로 통일한다.

핵심 제약: 이름은 **Orca 내부 어휘만** 바꾼다. 외부/SDK 어휘(`@anthropic-ai/claude-code` CLI 패키지, `@anthropic-ai/claude-agent-sdk`, `.claude/` SDK 표준 경로, `CLAUDE_CODE_USE_BEDROCK|VERTEX` env, Claude Code CLI/문서 참조)는 **절대 바꾸지 않는다** — 이것들은 우리가 소비하는 외부 계약이다.

기존 `claude-code` 는 src 트리에서 175회/54파일 등장했으므로(분류는 §설계), 버킷 오분류(특히 외부 어휘 오변경)가 최대 리스크다.

## 인수 기준 (Acceptance Criteria)

1. Orca 어댑터/엔진 식별자 리터럴 기존값 `'claude-code'` 가 코드에서 **0개** (외부 어휘 제외). `Backend = 'claude'`, `ProviderId = 'claude' | 'opencode'`, `adapter.id === 'claude'`, `SUPPORTED_ENGINE = 'claude'`, zod 스키마(`CreateEngineSchema` 등) literal 전부 `'claude'`.
2. 디렉토리 규칙이 `claude` 로 통일: 신규 스캐폴드/배포가 `~/.config/orca/sources/settings/claude/<provider>/settings.json`·`dist/claude/`·`sources/hooks/claude/` 를 사용한다.
3. provider key 합성이 `claude-<provider>`(예: `claude-anthropic`) 로 동작하고, `parseProviderKey` 최장-접두 분해가 새 id 로 정상 동작한다(주석의 기존 `claude-code` 하이픈 설명 갱신).
4. 외부/SDK 어휘 **무변경**(인수 검증: §설계 버킷 C 의 패키지 import·`.claude/` 경로·`CLAUDE_CODE_USE_*`·CLI 설치 명령·문서 URL 이 그대로다).
5. 레거시 provider key(`claude-code-*`) 처리 정책이 결정대로 구현됨(§결정 D1) — 마이그레이션 or graceful fallback.
6. 어댑터 소스 파일/클래스 표기 정책이 결정대로 반영됨(§결정 D2).
7. 게이트 통과(lint/typecheck/test) — 영향 테스트(provider-key·engine-write·provider-settings·deployer·scaffold·conformance·registry·db/queries·renderer reducer/store)가 새 id/경로로 갱신되어 green.
8. 문서 동기화: `app/src/main/AGENTS.md`·`app/AGENTS.md`·`docs/TRD.md §6.8`·`docs/IPC_CONTRACT.md`·`docs/arch/backend/standardization.md`·`docs/GLOSSARY.md`(Backend 어휘)에서 `claude-code` 어댑터/디렉토리 표기를 `claude` 로 갱신(외부 어휘 인용은 보존).

## 범위 / 비범위

- **범위**: Orca 어댑터/엔진 식별자 + 파생 디렉토리 규칙 리네임(버킷 A·B). 영향 테스트·문서 동기화. 레거시 키/파일명 정책(§결정).
- **비범위(절대 변경 금지 — 버킷 C)**:
  - npm 패키지명 `@anthropic-ai/claude-code`(InstallerDialog 설치 안내)·`@anthropic-ai/claude-agent-sdk`(import).
  - `.claude/` SDK 표준 경로(`distSkillsDir` 의 `.claude/skills`, conformance `compatibilityPaths`).
  - env 변수명 `CLAUDE_CODE_USE_BEDROCK`/`CLAUDE_CODE_USE_VERTEX`(SDK 어휘 — providerCatalog recipe).
  - Claude Code CLI/문서 참조 주석·URL(`docs/claude-code-spec.md` 등).
  - `opencode` 식별자(미래 어댑터, 무관).

## 설계

### 버킷 분류 (변경 대상 판별의 SSOT)

- **버킷 A — 식별자 리터럴 (RENAME `'claude-code'`→`'claude'`)**:
  - 타입: `src/shared/ipc.ts:99`(`Backend`), `:185`(`ProviderId`), `:120/:140/:147`(engine 필드). `src/shared/protocol.ts:9`(`z.enum(['claude'])`), `:159`(`z.literal`).
  - 어댑터 id: `adapters/claude.ts:126`(`readonly id`), `adapters/mock.ts:9`(mock 이 실 id 를 흉내 — 같이 변경).
  - 엔진 상수/검증: `settings/engine-write.ts:7`(`SUPPORTED_ENGINE`)·`parseEngineKey`.
  - 레지스트리/배선: `adapters/registry.ts`(생성·active), `ipc/router.ts:76/81/87`(loader 키·scaffold·deploy), `ipc/handlers/engine.ts:22`(deploy), `deploy/conformance.ts:69`(맵 키).
  - capabilities: `capabilities/claude-probe.ts:22/63`(descriptor `provider`).
  - 렌더러 비교/기본값: `backend/store/backendStore.ts`(3곳 `id === 'claude'`), `chat/components/Composer.tsx:106`(fallback), `engine/components/EngineCard.tsx:17`·`AgentEnvironmentView.tsx:92`·`EngineFormModal.tsx:40`·`engine/lib/providerCatalog.ts:16`(ENGINE_OPTIONS id).
- **버킷 B — 디렉토리 경로 (RENAME)**: `config/paths.ts`(`sourcesSettingsDir`/`distDir`/`distSkillsDir`/`distMcpJsonPath` 는 `Backend` 인자로 파생 — 인자가 `'claude'` 가 되면 자동 정합, 단 주석/예시 갱신), `settings/engine-write.ts:36`, `deploy/scaffold.ts`·`deployer.ts`·`conformance.ts`, 그리고 경로를 하드코딩한 테스트들.
- **버킷 C — 외부 어휘 (NO CHANGE)**: §비범위.
- **버킷 D — 소스 파일명**: `adapters/claude.ts`·`claude.effort.test.ts`·`claude.describe.test.ts`·`claude.canusetool.test.ts`(+ 클래스 `ClaudeAdapter`). →§결정 D2.

### provider key / DB

- `config/provider-key.ts` `providerKeyOf`/`parseProviderKey` 는 어댑터 문자열을 인자로 받으므로 로직 변경 불필요. 단 기존 `:19` 주석("adapter id 자체가 하이픈을 포함하므로(claude-code)")은 새 id 가 하이픈 없음 → 갱신. 최장-접두 매칭은 provider 가 하이픈을 포함하는 경우와 future opencode 때문에 유지.
- `sessions.provider_key`(마이그레이션 `0008_provider_key.sql`, `db/queries.ts` insert/select/update)에 기존값 `claude-code-<provider>` 가 영속될 수 있음. **주의**: 리네임 후 레거시 `parseProviderKey('claude-code-anthropic', ['claude'])` 는 `claude-` 접두에 걸려 provider=`code-anthropic` 로 **오분해**될 수 있다. 다만 턴 해석(`ipc/chat/send.ts`)의 provider 선택은 `entries` 의 **정확 키 매칭**(`byKey`)이라 신규 `claude-<provider>` 와 불일치 → 기본 provider 로 graceful fallback(크래시 없음, 마지막-사용 provider 만 초기화). → §결정 D1.

### 레이어 경계

- 구체 provider/engine 리터럴(`'claude'`)은 기존과 동일하게 `adapters`·`capabilities`·`deploy`·컴포지션 루트(`ipc/router.ts`)·렌더러에만. 새 리터럴 도입으로 경계 변동 없음(같은 위치의 문자열 교체).

## 영향 받는 파일

- **타입/스키마**: `src/shared/{ipc.ts,protocol.ts}`
- **어댑터/배선**: `src/main/adapters/{claude.ts,mock.ts,registry.ts}`, `src/main/ipc/{router.ts,handlers/engine.ts}`, `src/main/deploy/{conformance.ts,scaffold.ts,deployer.ts}`, `src/main/settings/engine-write.ts`, `src/main/config/{paths.ts,provider-key.ts}`, `src/main/capabilities/claude-probe.ts`
- **렌더러**: `features/backend/store/backendStore.ts`, `features/chat/components/Composer.tsx`, `features/engine/{lib/providerCatalog.ts,components/EngineCard.tsx,components/AgentEnvironmentView.tsx,components/EngineFormModal.tsx}`
- **테스트(다수)**: `provider-key.test.ts`, `engine-write.test.ts`, `provider-settings.test.ts`, `deployer.test.ts`, `scaffold.test.ts`, `conformance.test.ts`, `registry.test.ts`, `db/queries.test.ts`, `capabilities/claude-probe.test.ts`, `runtime-errors/claude-classifier.test.ts`, `adapters/claude-settings.test.ts`, `protocol.send.test.ts`, renderer `chatReducer.*.test.ts`, `orca-file.test.ts`
- **D2 파일명**: `adapters/claude-code*.ts` → `adapters/claude*.ts` 적용 완료
- **(D1 마이그레이션 채택 시)**: `src/main/db/migrations/0009_provider_key_claude.sql`(신규)
- **문서**: `app/src/main/AGENTS.md`, `app/AGENTS.md`, `docs/TRD.md`, `docs/IPC_CONTRACT.md`, `docs/arch/backend/standardization.md`, `docs/GLOSSARY.md`

## 참고 문서

- `docs/TRD.md §6.8`(provider settings 트리·디렉토리 SSOT)
- `docs/IPC_CONTRACT.md §2.2-c`(engine 도메인 — `engine: 'claude'` literal)
- `docs/arch/backend/standardization.md §5.1`(sources/dist 레이아웃)
- `app/src/main/AGENTS.md`(구체 리터럴 허용 위치 규칙)
- handoff `0010`(provider key 합성), `0014`(디렉토리 SSOT), `0026`(직전 settings 파서)

## 결정 필요 (착수 전 사용자 확인)

- **D1 — 레거시 provider key 처리**:
  - (a) **채택: 클린 브레이크 + graceful fallback** — 마이그레이션 없음. 기존 세션의 `claude-code-*` provider_key 는 매칭 실패 시 기본 provider 로 폴백(마지막-사용 provider 만 초기화). 저장소 사전-배포 클린 브레이크 선례(0011/0014)와 정합.
  - (b) **DB 마이그레이션** — `0009_*.sql` 로 `provider_key` 의 `claude-code` 접두를 `claude` 로 UPDATE(`'claude-code'`→`'claude'`, `'claude-code-%'`→`'claude-%'`). 데이터 보존.
- **D2 — 어댑터 소스 파일명/클래스 표기**:
  - (a) **채택: 함께 리네임** — `adapters/claude-code.ts`→`claude.ts`(+ `*.test.ts`), 클래스 `ClaudeCodeAdapter`→`ClaudeAdapter`. "adapter 표기" 일관.
  - (b) **id/경로만 변경, 파일명/클래스 유지** — diff 최소화.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 검증 보조: `rg -n "claude-code" app/src` 결과가 **버킷 C(외부 어휘)만** 남는지 확인.

---

## 구현 체크리스트 (Claude — READY 전 D1/D2 확정 후)

- [x] 버킷 A 리터럴 일괄 교체(타입·스키마·adapter.id·SUPPORTED_ENGINE·registry·router·capabilities·렌더러)
- [x] 버킷 B 디렉토리 경로/주석/예시 갱신
- [x] `provider-key.ts` 주석 갱신
- [x] D1 정책 구현(마이그레이션 or 폴백 확인)
- [x] D2 정책 구현(파일명/클래스)
- [x] 영향 테스트 새 id/경로로 갱신
- [x] 외부 어휘(버킷 C) 무변경 grep 확인
- [x] 문서 6건 동기화
- [ ] 게이트 통과 (환경 제한: npm 의존성 설치 불가)

## 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/shared/{ipc.ts,protocol.ts}`; `app/src/main/adapters/claude.ts`(+ 테스트 파일명 리네임); `app/src/main/{settings,deploy,config,capabilities,ipc,db}` 영향 파일; renderer backend/chat/engine 영향 파일; `app/AGENTS.md`; `app/src/main/AGENTS.md`; `docs/{TRD.md,IPC_CONTRACT.md,arch/backend/standardization.md,GLOSSARY.md}` |
| 실행 명령 | `git diff --check`; `rg -n "claude-code" app/src`; `npm run lint`; `npm run typecheck`; `npm test` |
| 게이트 결과 | `git diff --check` 통과. `rg -n "claude-code" app/src` 는 버킷 C 2건만 잔존(`docs/claude-code-spec.md` 주석, CLI 설치 안내). `npm run lint`/`npm run typecheck`/`npm test` 는 `node_modules` 부재 및 `npm install`/`npm ci` 장기 무응답으로 의존성 설치 불가해 환경 제한 실패. |
| 블로커 / 역질문 | D1-a(클린 브레이크+graceful fallback)·D2-a(파일/클래스 함께 리네임)로 구현. 런타임 의존성 설치 환경 확인 필요. |
| 대상 커밋 | fb652e9 |
