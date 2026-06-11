# Verify — 0010-agent-model-select

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0010-agent-model-select` |
| 검증자 | Claude Code |
| 일자 | 2026-06-11 |
| 대상 커밋 | `0a3c043` (INDEX 기재 `c2a90d8` — 리베이스/스쿼시로 해시 변경, 이전 행과 동일한 "위생 노트 ①" 패턴. trailer `Agent: codex`·`Status: implemented`·`Criteria-Met: 15/15`·`Verified-By: pending`) |
| 라운드 | 1 |
| 상태 | **FAIL** |

## 요약

설계의 핵심 — provider key 합성·중복 불허·토큰 해석(secret store 우선)·`orca:agent:list` 채널·턴 단위 모델/ provider 적용·세션 adapter 잠금·`provider_key` 영속·`authToken` 리네임·`/agents` 동적화·mock 규약 — 은 모두 코드/문서에 반영되어 있고 lint·typecheck·신규 비-DB 테스트는 green 이다.

그러나 **인수 기준 #14 (무회귀)** 가 미충족이다. 구현이 `db/queries.test.ts` 의 **공유 헬퍼 `insertSession` 에 `provider_key` 컬럼을 추가**하면서, 0008 마이그레이션 이전 스키마(`dbBefore0006()` — 0001~0005만 적용)에서 그 헬퍼를 호출하는 **기존 `0006_turn_usage` 마이그레이션 테스트가 깨진다**. 이 실패는 `NODE_MODULE_VERSION` ABI 제한(인수 #14 의 명시적 예외)과 **무관한** 실제 회귀이며, CI(Electron ABI) 환경에서는 파일 전체 로드 실패에 가려져 보이지 않을 뿐이다.

## 요구사항 충족 매트릭스

| # | 인수 기준 (요약) | 충족 | 증거 |
|---|---|---|---|
| 1 | provider key 규칙(부재→adapter 단독·trim/lowercase 합성)·생성방향 매칭·중복 dedupe·family 표시키 | ✅ | `config/provider-key.ts:9-38,66-68` + `provider-key.test.ts:21-38` (전부 green) |
| 2 | Composer 노출(supported agent×family, 초기선택 default) | ✅ | `composer/ModelMenu.tsx:23,35-57`(`supported && (!sessionBackend || adapter===sessionBackend)`), 초기선택 `Composer.tsx:107`+`defaultModelFamily`(`provider-key.ts:70-74`) |
| 3 | 세션 생성+영속(`provider_key` 저장·매 턴 갱신, 토큰 DB 미저장) | ✅ | `router.ts` `updateSessionProviderKey`(insert 시 `:544-552`, 매 턴 `:363-366`), 마이그레이션 컬럼만(`0008_provider_key.sql`) — 토큰 컬럼 없음 |
| 4 | env·model 주입(0009 경로 + query `model`)·토큰 해석순서(secret→authToken) | ✅ | `claude-code.ts` `...(model ? { model } : {})`, `router.ts` `resolveTurnAgent`→`authTokenFor`(secret store 우선), `provider-key.ts:40-51` |
| 5 | adapter 전환 불가·provider 턴 전환 가능(양측 가드) | ✅ | reducer 가드 `ModelMenu.tsx:23`, main 가드 `router.ts resolveTurnAgent`(adapter 불일치→`meta.provider_key`→`agentFor` 폴백+warn) |
| 6 | 턴 단위 모델 적용·라이브 채널 없음(`LiveTurn.setModel` 호출자 0) | ✅ | renderer `setModel` 은 chat 액션(턴 단위, `Composer.tsx:107`)일 뿐 `live.setModel(` 호출자 0(grep). `TurnRequest.model` 다음 send 에 반영 |
| 7 | resume 복원(adapter 잠금 + `providerKey` 초기선택) | ✅ | `router.ts` `LoadedSession.providerKey = meta.provider_key`(`:830` 부근), reducer `LOAD_SESSION` 잠금 |
| 8 | 폴백(레거시 NULL·미매칭 → `agentFor` first-match + warn) | ✅ | `router.ts resolveTurnAgent`(`agentForProviderKey(...) ?? agentFor(req.adapter.id)`, warn) |
| 9 | 제목 생성 agent 일치(`agentFor` 교체) | ✅ | `router.ts:719` `agent: req.agent`(턴 해석 agent), `:699-703` `titleAgent` 전달 |
| 10 | 비밀 미노출(`agent:list` DTO 에 `authToken`/`baseUrl`/`env` 부재) | ✅ | `toAgentEnvironments`(화이트리스트, `provider-key.ts:76-94`) + `provider-key.test.ts:70-96`(부재 단언, green) + IPC_CONTRACT 명시 |
| 11 | `authToken` 리네임 + `apiKey` deprecated 별칭(경고) | ✅ | `orca-file.ts`(`authToken` 정식·`apiKey` 경고 후 정규화) + `orca-file.test.ts`(green) + `claude-env.ts` 산출 불변 |
| 12 | `/agents` 동적화(IPC 데이터·필드 정리·빈상태) | ✅ | `AgentEnvironmentView.tsx:3,12`(`useAgents`), 빈상태 안내(`:38`), 하드코딩 샘플 제거 |
| 13 | mock 규약(disabled+`data-state="mock"`+빗금)·문서화 | ✅ | `shared/ui/mock.ts`(`MOCK_HATCH_BG`), `AgentEnvironmentView.tsx:23-24,68-69`, `dom-architecture.md` "Mock UI marker (0010)" |
| **14** | **무회귀(기존 테스트 무수정 green, ABI 제한 제외)** | **❌** | **공유 `insertSession` 헬퍼에 `provider_key` 추가(`queries.test.ts:40`) → `dbBefore0006()`(0005까지) 사용하는 `0006_turn_usage` 마이그레이션 테스트가 `SqliteError: table sessions has no column named provider_key` 로 실패. Node ABI 재빌드 후 `queries.test.ts` 8/9 — 1건 실질 회귀(ABI 무관)** |
| 15 | 게이트 + 신규 테스트 green | ⚠️ 부분 | lint ✅·typecheck ✅·신규 비-DB 테스트(provider-key/orca-file/protocol.send/chatReducer.permission/claude-env) 전부 green. 단 #14 회귀로 전체 test 미green |

## 게이트 재실행 결과

의존성 미설치 상태였어 `npm ci`(better-sqlite3 네이티브 빌드 포함) 후 실행.

```
$ cd app && npm run lint && npm run typecheck && npm test
lint       → EXIT 0 ✅
typecheck  → EXIT 0 ✅
test (Electron ABI) → Test Files 1 failed | 47 passed (48)
                      Tests       9 failed | 340 passed (349)
   실패 9건 전부 src/main/db/queries.test.ts:
   "NODE_MODULE_VERSION 140 … requires 127" (better-sqlite3 가 Electron ABI 빌드 → vitest=Node ABI 로드 불가)
```

`db/queries.test.ts` 의 9건 중 7건은 0007/0009 와 동일 계열의 순수 ABI 환경 제한이다. **그러나 ABI 마스킹이 실제 회귀 1건을 가린다** — 검증을 위해 native module 을 Node ABI 로 재빌드해 그 파일만 직접 실행:

```
$ npm rebuild better-sqlite3 --build-from-source && npx vitest run src/main/db/queries.test.ts
   Tests  1 failed | 8 passed (9)
   ✅ 신규 provider_key 테스트 2건 모두 통과
      (insertSession+updateSessionProviderKey / 레거시 NULL row 조회)
   ❌ "0006_turn_usage migration > usage_events …" 1건 실패
      SqliteError: table sessions has no column named provider_key
        at insertSession (queries.test.ts:39) ← dbBefore0006() 는 0008 미적용
```

> 재빌드는 `node_modules`(gitignore) 한정이며 커밋에 영향 없다. 신규 provider_key 로직 자체는 정상(2/2 통과). 회귀는 **공유 테스트 헬퍼 오염**이 원인.

## 근본 원인 + 권고 수정 (Codex 액션)

`queries.test.ts` 의 `insertSession` 헬퍼(`:38-43`)는 `dbWithMigrations()`(0008 포함)와 `dbBefore0006()`(0005까지) **양쪽에서 공유**된다. 0010 이 이 헬퍼의 INSERT 에 `provider_key` 컬럼을 추가하면서, `provider_key` 컬럼이 없는 0006 마이그레이션 테스트 경로가 깨졌다.

- [ ] **#14**: `0006_turn_usage migration` 테스트가 `provider_key` 를 참조하지 않도록 한다. 권고: 그 테스트(`:46-81`)에서 공유 `insertSession` 대신 0005 스키마용 인라인 insert(`provider_key` 제외)를 쓰거나, `insertSession` 을 마이그레이션 단계별로 분기. 신규 provider_key 테스트(`dbWithMigrations` 기반)는 현행 유지(이미 green). 수정 후 `npm rebuild better-sqlite3 --build-from-source && npx vitest run src/main/db/queries.test.ts` 로 9/9 확인.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행+출력 | — | lint/typecheck ✅, test 회귀 1건 검출 |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일:라인`) | 이견 시 중재 | 14/15 충족, #14 ❌ |
| 레이어 경계(eslint-boundaries) | ✅ 위반 0 | — | lint green = 경계 위반 0 |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT(Agent 도메인·39채널)·dom-architecture(mock)·TRD §6.8·persistence·security·ux-domains 갱신 확인 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 본 핸드오프는 AGENTS.md 미변경 — 해당 없음 |
| 제품 의도 부합(PRD/트랜스크립트) | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증(Composer 모델칩·/agents 카드·빗금) | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| 실환경 bedrock/secret store 토큰 주입 | ✖ | ✅ | 사람 확인 대기(런타임) |
| PR 머지 승인 | ✖ | ✅ | 해당 없음(FAIL) |

## PHASES.md 정합성

FAIL 이므로 PHASES 승격 보류. PASS 라운드에서 승격한다.

## 결론 / 다음 단계

- 상태: **FAIL** (라운드 1). 인수 14/15 충족, **#14 무회귀 미충족**(공유 테스트 헬퍼 오염으로 0006 마이그레이션 테스트 회귀 — ABI 환경 제한과 무관).
- 다음 주체: **Codex** (라운드 +1). 위 "근본 원인 + 권고 수정" 체크리스트 1건 처리 후 게이트 재확인 → `impl/IMPL_DONE`.
- 비고: 회귀는 테스트 한정(프로덕션 `migrate.ts` 는 0001→0008 순차 적용이라 실제 `sessions` 테이블에는 `provider_key` 존재). 기능 로직·신규 테스트는 정상이며, 수정 범위는 `queries.test.ts` 한 곳.
