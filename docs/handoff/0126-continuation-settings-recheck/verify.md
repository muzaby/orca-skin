# Verify — 0126-continuation-settings-recheck

## 메타

| 항목 | 값 |
|---|---|
| slug | `0126-continuation-settings-recheck` |
| 검증자 | Claude Code |
| 일자 | 2026-07-19 |
| 대상 커밋 | `9abeadd` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 #1 — 백스톱 `turn` null-내로잉은 기존 early-return 이 보장(코드 변화 없음) | 타당 — `!turn?.live?.canSteer` return 이후 `turn` non-null 확정 | 매트릭스 #4 증거에 포함 |
| 이견/우려 없음 | 코드 대조로 확인 | — |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 연속 턴 settings 재해석(원 턴 키 고정, contRequest 신선 blob, 실패 시 원본 유지) | ✅ | `chat-turn.ts:721-726`(`resolveTurnProvider` — `providerKey: activeTurn.providerKey` 고정, `modelFamily: null`) + `:759-762`(`contResolved.providerSettings` 있을 때만 override — undefined 는 `...request` 원본 유지) |
| 2 | 변경 시 teardown → `takeForRespawn` 콜드 패스 자연 진입 | ✅ | `chat-turn.ts:728-736`(`channelAlive && providerSettingsChangedSinceSpawn(spawnedProviderSettings, contResolved.providerSettings)` → `teardownChannel()`) — 판정이 `channelAlive` 분기(`:739`) *앞* 이라 teardown 직후 채널-사망 분기(takeForRespawn)로 전환 |
| 3 | 의미론 불변(연속 턴 provider/model = 원 턴 계승, 경계 재판정 없음) | ✅ | 연속 루프에 `crossesProviderBoundary` 호출 없음(grep — 백스톱 `:241` 과 유휴 send `:517` 뿐), `contRequest` 의 `model` 은 `...request` 원 모델 유지, `makeContinuationTurn` 의 `prev.providerKey` 계승 불변 |
| 4 | busy send 백스톱(경계면 held 미적재 + error 회신, null 보수적 허용) | ✅ | `chat-turn.ts:237-252`(`crossesProviderBoundary(turn.providerKey, data.providerKey ?? null)` → `provider_connection_error`/retryable 회신 후 return — enqueue 앞) + 파라미터 `providerKey?: string \| null` 추가(`:221`), null false 는 함수 계약(`provider-boundary.ts:9`) |
| 5 | 기존 경로 무회귀(유휴 0118/0125 판정·게이트 flush·취소 경로 불변) | ✅ | 유휴 send 판정(`:512-522`)·`takeSteerFlush`(`:713-714` 상당)·`cancelAllHeld` 경로 diff 없음 — 변경은 연속 루프 서두·contRequest·reserveOnBusySession 3곳뿐(커밋 diff 69/-1), vitest 전체 1009/1009 green |
| 6 | 게이트 | ✅ | 아래 "게이트 재실행 결과" |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 에러 0 / typecheck 3분할 0 / vitest 1009/1009 + scripts 25 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 6/6 (위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | 변경이 컴포지션 루트 단일 파일 — boundaries 에러 0 |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/runtime-ipc/INDEX 정상 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경 — 해당 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 (검토 plan §비고 I-4 의미론 포함) |
| Open Questions | ✖ | ✅ | 해당 없음 |
| UI/UX 시각 검증 | ✖ | ✅ | 렌더러 무변경 — 백스톱 error 표시는 기존 경로 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        # 에러 0 (기존 warning 1 — react-hooks/incompatible-library, 본 변경 무관)
$ npm run typecheck             # node/web/test 3분할 모두 0 에러
$ ./node_modules/.bin/vitest run
  Test Files  1 failed | 130 passed (131)
  Tests       1009 passed (1009)
  # 실패 1파일 = chat-turn.continuity.test.ts 로드 실패 — electron 바이너리 egress 베이스라인
  # (0124/0125 verify 와 동일), 본 변경 무관.
$ node --test scripts/*.test.mjs   # 25 pass / fail 0
```

`npm test`(pretest) 대신 분해 실행 사유: egress 차단 환경의 electron ABI 순환 회피(app/AGENTS.md). Windows CI 가 완전 환경 최종 판정.

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 변경 없음. 문서에 키/토큰 실값 없음.

## PHASES.md 정합성

- 본 verify 커밋에서 0126 행 승격(구현 커밋 `9abeadd` 기재) — 0125 행과 동일 패턴.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 검토 §비고 I-4(경계 respawn 시 이월 프렐류드가 새 provider 로 처리) 를 코드 변경 없이 "설계 확인 사항" 으로만 남겼다 — 폐쇄망 간 데이터 정책이 다르면 후속 결정(예: 경계 teardown 시 held 를 draft 복원으로 전환) 이 필요할 수 있다. 사용자 판단 대기.
- 구현 단계: 연속 루프 재해석은 provider 삭제(entries 에서 원 키 소실) 시 폴백 provider 를 해석할 수 있으나, settings 비교의 null-보수성이 오동작을 막는다 — 극단 엣지의 실측은 없다.
- 검증 단계: 연속 턴 배선의 실기(busy 중 토큰 로테이션 + steer 예약 → 연속 턴 새 토큰 respawn)는 electron egress 제약으로 본 환경 불가 — **사람/완전환경 확인 대기**. 백스톱은 렌더러 가드 우회 재현이 곤란해 코드 리뷰 판정으로 갈음했다.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 사람 확인 대기: ① 실기 — busy 턴 중 현재 provider settings.json 토큰 수정 + steer 예약 → 턴 종료 후 자동 연속 턴이 새 토큰으로 respawn(`engine.spawn.started` 로그) 확인, ② 검토 §비고 I-4 의미론(경계 이월 프렐류드의 새 provider 처리) 수용 여부 판단, ③ PR 머지.
