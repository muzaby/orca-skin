# Verify — 0010-agent-model-select

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0010-agent-model-select` |
| 검증자 | Claude Code |
| 일자 | 2026-06-11 |
| 대상 커밋 | r1 `0a3c043` · **r2 `c193166`** (INDEX 기재 r1 `c2a90d8`→실 `0a3c043`, r2 `ecf9752`→실 `c193166` — 리베이스/스쿼시 해시 변경, 이전 행과 동일한 "위생 노트 ①" 패턴) |
| 라운드 | 2 |
| 상태 | **PASS** |

## 요약

라운드 1 에서 **인수 #14 무회귀** 미충족(공유 테스트 헬퍼 `insertSession` 오염 → 0008 이전 스키마를 쓰는 기존 `0006_turn_usage` 마이그레이션 테스트 회귀)으로 FAIL. Codex r2 가 권고대로 그 테스트를 0005 스키마 컬럼만 쓰는 인라인 INSERT 로 교체(`queries.test.ts:46-51`, 프로덕션 코드 무변경)해 회귀를 해소했다. 전 게이트 green(349/349, db/queries.test.ts 포함) — **15/15 충족, PASS**.

## 라운드 이력

| 라운드 | 상태 | 핵심 |
|---|---|---|
| r1 (`0a3c043`) | FAIL | 인수 14/15. #14 무회귀 미충족 — `insertSession`(`queries.test.ts:40`)에 `provider_key` 추가로 `dbBefore0006()`(0001~0005) 경로의 `0006_turn_usage` 마이그레이션 테스트가 `SqliteError: table sessions has no column named provider_key` 회귀. CI(Electron ABI)에서는 파일 전체 로드 실패에 가려졌으나 Node ABI 재빌드로 검출. |
| r2 (`c193166`) | **PASS** | `0006_turn_usage migration` 테스트가 공유 헬퍼 대신 0005 스키마 컬럼(`id, backend, title, project_id, created_at, updated_at, last_message_preview`)만 쓰는 인라인 INSERT 사용(`queries.test.ts:48-51`). 변경은 `app/src/main/db/queries.test.ts` 1파일(테스트 한정) — 프로덕션·신규 provider_key 테스트 무변경. |

## 요구사항 충족 매트릭스

| # | 인수 기준 (요약) | 충족 | 증거 |
|---|---|---|---|
| 1 | provider key 규칙·생성방향 매칭·dedupe·family 표시키 | ✅ | `config/provider-key.ts:9-38,66-68` + `provider-key.test.ts:21-38` (green) |
| 2 | Composer 노출(supported agent×family, 초기선택 default) | ✅ | `composer/ModelMenu.tsx:23,35-57`, 초기선택 `Composer.tsx:107`+`defaultModelFamily`(`provider-key.ts:70-74`) |
| 3 | 세션 생성+영속(`provider_key` 저장·매 턴 갱신, 토큰 DB 미저장) | ✅ | `router.ts` `updateSessionProviderKey`(insert·매 턴), `0008_provider_key.sql`(컬럼만) + `queries.test.ts` provider_key 2건 green |
| 4 | env·model 주입 + 토큰 해석순서(secret→authToken) | ✅ | `claude-code.ts` `...(model ? { model } : {})`, `router.ts resolveTurnAgent`→`authTokenFor`(secret 우선), `provider-key.ts:40-51` |
| 5 | adapter 전환 불가·provider 턴 전환 가능(양측 가드) | ✅ | reducer 가드 `ModelMenu.tsx:23`, main 가드 `router.ts resolveTurnAgent`(adapter 불일치→`provider_key`→`agentFor` 폴백+warn) |
| 6 | 턴 단위 모델 적용·라이브 채널 없음(`LiveTurn.setModel` 호출자 0) | ✅ | renderer `setModel`=chat 액션(턴 단위, `Composer.tsx:107`), `live.setModel(` 호출자 0(grep) |
| 7 | resume 복원(adapter 잠금 + `providerKey` 초기선택) | ✅ | `router.ts` `LoadedSession.providerKey = meta.provider_key`, reducer `LOAD_SESSION` 잠금 |
| 8 | 폴백(레거시 NULL·미매칭 → `agentFor` first-match + warn) | ✅ | `router.ts resolveTurnAgent`(`agentForProviderKey(...) ?? agentFor(req.adapter.id)`, warn) |
| 9 | 제목 생성 agent 일치(`agentFor` 교체) | ✅ | `router.ts:719` `agent: req.agent`, `:699-703` `titleAgent` 전달 |
| 10 | 비밀 미노출(`agent:list` DTO 에 `authToken`/`baseUrl`/`env` 부재) | ✅ | `toAgentEnvironments`(화이트리스트) + `provider-key.test.ts:70-96`(부재 단언 green) + IPC_CONTRACT 명시 |
| 11 | `authToken` 리네임 + `apiKey` deprecated 별칭(경고) | ✅ | `orca-file.ts`(`authToken` 정식·`apiKey` 경고 후 정규화) + `orca-file.test.ts`(green), `claude-env.ts` 산출 불변 |
| 12 | `/agents` 동적화(IPC 데이터·필드 정리·빈상태) | ✅ | `AgentEnvironmentView.tsx:3,12`(`useAgents`), 빈상태 안내(`:38`), 하드코딩 샘플 제거 |
| 13 | mock 규약(disabled+`data-state="mock"`+빗금)·문서화 | ✅ | `shared/ui/mock.ts`(`MOCK_HATCH_BG`), `AgentEnvironmentView.tsx:23-24,68-69`, `dom-architecture.md` "Mock UI marker (0010)" |
| **14** | **무회귀(기존 테스트 무수정 green, ABI 제한 제외)** | **✅** | **r2 수정으로 `0006_turn_usage migration` 테스트 복구(`queries.test.ts:48-51` 인라인 INSERT). Node ABI 전체 실행 349/349 green — 기존 테스트 회귀 0** |
| 15 | 게이트 + 신규 테스트 green | ✅ | lint ✅·typecheck ✅·test ✅ **349/349 (48 파일)** |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint       → EXIT 0 ✅
typecheck  → EXIT 0 ✅
test       → EXIT 0 ✅   Test Files 48 passed (48) / Tests 349 passed (349)
```

> 본 검증 환경은 `npm rebuild better-sqlite3 --build-from-source`(Node ABI) 상태라 vitest 가 `db/queries.test.ts` 까지 전부 실행해 349/349 green 을 확인했다. 사용자의 표준 CI(Electron ABI)에서는 `db/queries.test.ts` 가 `NODE_MODULE_VERSION` 로드 실패로 가려지는 것이 정상(0007/0009 와 동일한 환경 제한) — 단, r2 수정으로 로직 자체는 Node ABI 전체 green 으로 입증됨.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행+출력 | — | 349/349 green |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일:라인`) | 이견 시 중재 | 15/15 충족 |
| 레이어 경계(eslint-boundaries) | ✅ 위반 0 | — | lint green |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT(Agent 도메인·39채널)·dom-architecture(mock)·TRD §6.8·persistence·security·ux-domains 갱신 확인 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 본 핸드오프 AGENTS.md 미변경 — 해당 없음 |
| 제품 의도 부합(PRD/트랜스크립트) | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증(Composer 모델칩·/agents 카드·빗금) | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| 실환경 bedrock/secret store 토큰 주입 | ✖ | ✅ | 사람 확인 대기(런타임) |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 |

## PHASES.md 정합성

PASS → 페이즈 표에 `0010-agent-model-select` 행 승격(커밋 `c193166`). 형식·링크 기존 행과 정렬.

## 결론 / 다음 단계

- 상태: **PASS** (라운드 2). 인수 15/15 충족, 게이트 349/349 green, 레이어 경계 0, 신규 의존성 0.
- 다음 주체: **—** (종료). PHASES 승격 완료.
- 사람 확인 대기(verify §책임 분리): Composer 모델 칩·`/agents` 카드·mock 빗금 **시각 검증**, 실환경 **bedrock/vertex provider 턴 전환 + secret store 토큰 주입**. PR 은 사용자 요청 시 생성.
