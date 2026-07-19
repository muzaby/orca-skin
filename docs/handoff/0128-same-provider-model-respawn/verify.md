# Verify — 0128-same-provider-model-respawn

## 메타

| 항목 | 값 |
|---|---|
| slug | `0128-same-provider-model-respawn` |
| 검증자 | Claude Code |
| 일자 | 2026-07-20 |
| 대상 커밋 | (커밋 대기) |
| 라운드 | 1 |
| 상태 | PASS (기계 판정) + 사람 실기 대기 |

## 설계 전환(pivot) 기록

최초 설계(로그/telemetry.model 오기록 정정 + modelUsage 단일키 재귀속)는 **실기 데이터로 반증**됐다:
- "haiku 전환" 턴의 `message.model = claude-sonnet-5`(실제 생성=sonnet), `modelUsage` = 다중키 누적, 비용은 sonnet 만 증가·haiku 불변.
- → 로그의 sonnet 은 진실이었고, 결함은 **모델 전환이 실제 생성에 안 먹는 것**. 사용자 결정으로 respawn 접근 채택. 최초 접근 코드는 전량 revert.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `SessionRuntime.spawnedModel` 기록 수명(스폰 기록·pushTurn 불변·teardown/사망 해제) | ✅ | `session-runtime.ts` field `spawnedModelValue` + getter `spawnedModel`; set `runAttempt`(spawn), clear `finishPump`·`teardownChannel`. 테스트 "콜드 스폰이 model 을 기록…pushTurn 은 불변" green |
| 2 | 메인 턴 respawn 조건에 `resolved.model !== runtime.spawnedModel` | ✅ | `chat-turn.ts:518-531` OR 절 추가(주석 0128) |
| 3 | 연속 턴(0067 AC7) 조건 무변경 | ✅ | `chat-turn.ts:744-752` 미변경(providerSettings 만) — model 조건 미추가 |
| 4 | 기존 respawn(provider/settings)·이월 무회귀 | ✅ | 기존 조건 절 유지, session-runtime 기존 19 테스트 green |
| 5 | 신규 테스트 3종 통과 | ✅ | `vitest run sessions/session-runtime` → **22 passed**(19+3) |
| 6 | lint 0 / typecheck(변경 파일) 0 / 경계 0 / 의존성 0 / IPC·DB 0 | ✅* | lint 0 error, 변경 파일 typecheck 0, features/sessions·app 하향 의존 유지, 신규 의존성 0, IPC/DB 무변경. (*baseline `claude.ts:465` 별도) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/test | ✅ | — | lint 0 error · session-runtime 22/22 |
| 게이트 typecheck | ✅ | — | 변경 파일 0 / baseline `claude.ts:465` 분리 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 6/6 |
| 레이어 경계 위반 0 | ✅ | — | 위반 0 |
| **실기: 모델 변경→respawn→haiku 생성** | ✖ (electron egress 불가) | ✅ | **대기** |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ ./node_modules/.bin/vitest run sessions/session-runtime
 Test Files  1 passed (1)
      Tests  22 passed (22)

$ npm run lint            → ✖ 1 problem (0 errors, 1 warning=기존 TanStack Virtual)
$ npx tsc -p tsconfig.node.json --composite false
   src/main/adapters/claude.ts(465,24): TS2322   # baseline(본 변경 무관, claude.ts diff 0)
   # session-runtime.ts / chat-turn.ts 관련 에러: 0
```

## 실기 검증 포인트 (사람)

같은 시나리오(응답 후 `/model haiku` → `now?`) 재실행 시 **수정 확인 신호**:
1. 모델 변경 턴에 **`engine.spawn.started` + `engine.spawn.completed` 가 새로 뜬다** — warm 채널 재사용이 아니라 respawn 됐다는 직접 증거(수정 전엔 이 턴에 spawn 로그 없었음).
2. 그 턴의 `chat.turn.completed` model = **haiku**, 비용이 haiku 누적에 증가(sonnet 불변).
3. 답변 정체성·세션 모델 칩과 실제 생성 모델이 일치.

## 위생 검토

- AGENTS.md 변경 없음. 문서에 비밀/일회성 정보 혼입 없음.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: **최초 진단이 틀렸다** — 단일 로그(started≠completed)만 보고 "로그 배선" 으로 성급 단정. `message.model`·비용 증분이라는 권위 신호를 진단 로그로 확보한 뒤에야 진상(생성 자체가 sonnet)이 드러났다. 교훈: telemetry model 은 "요청" 이 아니라 "실제 생성" — 둘을 처음부터 분리 관측했어야.
- 구현 단계: 라이브 setModel 이 왜 안 먹는지의 SDK 내부는 미규명(respawn 로 우회). respawn 이 실제로 haiku 를 만드는지는 fresh spawn 이 model 지킴(turn 1 실측)에 근거한 추론 — 실기로 최종 확정 필요.
- 검증 단계: chat-turn 조건은 컴포지션 루트라 단위 테스트 seam 이 없어 `spawnedModel` 수명(session-runtime)으로 갈음. 조건 자체(`resolved.model !== spawnedModel`)는 자명한 `!==` 라 순수 헬퍼 불요.

## 결론 / 다음 단계

- **상태: PASS(기계 판정)** — 인수 6/6, 게이트 lint 0·session-runtime 22/22·변경 파일 typecheck 0. baseline `claude.ts:465` 분리.
- 커밋 대기(사용자) → 커밋 시 PHASES 승격.
- **사람 실기 대기**: 모델 변경 턴의 `engine.spawn.started` 출현 + 생성/비용/로그 haiku 정합.
