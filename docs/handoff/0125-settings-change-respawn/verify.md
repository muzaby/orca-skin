# Verify — 0125-settings-change-respawn

## 메타

| 항목 | 값 |
|---|---|
| slug | `0125-settings-change-respawn` |
| 검증자 | Claude Code |
| 일자 | 2026-07-19 |
| 대상 커밋 | `899604b` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 ✅ #1 — `channelAlive` 를 괄호 밖 공통 가드로 승격(`sessionId && channelAlive && (crosses ‖ settingsChanged)`) | 타당 — 0118 판정과 단락 평가 순서만 다르고 진리표 동일, 죽은 채널에서 판정 함수 미실행은 순수 이득 | 매트릭스 #5 무회귀 확인에 포함 |
| 이견/우려 없음 · 설계 그대로 구현 | 코드 대조로 확인(아래 매트릭스) | — |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 동일 provider settings 내용 변경 시 respawn | ✅ | 판정 `provider-boundary.ts:19-27`(내용 다름 → true, 테스트 "settings 내용이 바뀌면(토큰 로테이션) 변경이다") + 호출부 `chat-turn.ts:486-495`(true → `teardownChannel()` → 기존 콜드 패스/`takeForRespawn` 이월 재사용) |
| 2 | 내용 동일(동일 참조·재파싱 동일 내용) 무 teardown | ✅ | `provider-boundary.ts:24-26`(참조 fast-path + stringify 비교) — 테스트 "재파싱된 동일 내용(다른 객체)은 변경 아님"·"동일 참조(resolve 캐시 히트)는 변경 아님" |
| 3 | 보수적 no-op(기록/해석 부재) | ✅ | `provider-boundary.ts:24`(null/undefined → false) — 테스트 "spawn 기록/해석 어느 한쪽 부재는 보수적 no-op" 3분기 |
| 4 | spawn 기록 수명(스폰 기록·pushTurn 불변·teardown/사망 해제) | ✅ | 기록 `session-runtime.ts:198`(스폰 성공 직후), 해제 `:318`(finishPump)·`:344`(teardownChannel), getter `:122` — `session-runtime.test.ts` "SessionRuntime spawn settings 기록(0125)" 3건 green |
| 5 | 0118 경계 판정 무회귀 | ✅ | `crossesProviderBoundary` 본체 불변(`provider-boundary.ts:6-11`), 기존 `provider-boundary.test.ts` 4케이스 + `session-runtime.test.ts` 0118 describe 2건 green (전체 27/27) |
| 6 | 레이어 준수(판정=providers·기록=sessions 불투명·조합=app, 교차 import 0) | ✅ | sessions → adapters 타입만(`session-runtime.ts:3`), providers 순수 함수(`provider-boundary.ts`), 조합 `chat-turn.ts:24-33`(배럴 경유) — `npm run lint` boundaries 에러 0 |
| 7 | 게이트 | ✅ | 아래 "게이트 재실행 결과" |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 에러 0 / typecheck 3분할 0 / vitest 1009/1009 + scripts 25 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 (위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | boundaries/no-cycle 에러 0 |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/runtime-ipc/INDEX 한국어·링크 정상 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경 — 해당 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 (버그리포트 의도 = 폐쇄망 토큰/URL 동적 변경) |
| Open Questions | ✖ | ✅ | 해당 없음 |
| UI/UX 시각 검증 | ✖ | ✅ | 렌더러 무변경 — 해당 없음 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        # 에러 0 (기존 warning 1 — react-hooks/incompatible-library, 본 변경 무관)
$ npm run typecheck             # node/web/test 3분할 모두 0 에러
$ npm rebuild better-sqlite3    # Node ABI 소스 컴파일 성공 (egress 차단 환경 — AGENTS.md DO 절차)
$ ./node_modules/.bin/vitest run
  Test Files  1 failed | 130 passed (131)
  Tests       1009 passed (1009)
  # 실패 1파일 = src/main/app/chat-turn.continuity.test.ts 로드 실패("Electron failed to install
  # correctly") — electron 바이너리 egress 차단 베이스라인(0124 verify 와 동일), 본 변경 무관.
$ node --test scripts/*.test.mjs   # 25 pass / fail 0
```

`npm test`(pretest 포함) 대신 위 분해 실행을 쓴 이유: egress 차단 환경의 electron ABI 순환 회피(app/AGENTS.md 게이트 가이드). Windows CI(`ci.yml`)가 완전 환경 최종 판정.

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 변경 없음. plan/verify 에 키/토큰 실값 없음(플레이스홀더 어휘만 — `ANTHROPIC_AUTH_TOKEN` 키 이름·'old'/'rotated' 테스트 더미).

## PHASES.md 정합성

- 본 verify 커밋에서 0125 행 승격(구현 커밋 `899604b` 기재) — 형식은 0118 행과 동일 패턴.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: orca.json 앱 전역 env(`buildTurnEnv`) 변경 감지를 비범위로 미뤘다 — provider settings 와 같은 spawn-바운드 축이므로 운영에서 문제가 되면 후속 핸드오프 필요.
- 구현 단계: 내용 비교가 키 순서 편집에 오탐(불필요 respawn 1회)하는 트레이드오프를 수용했다(plan 리스크 표) — 실사용 빈도상 무시 가능하나 실측은 없다.
- 검증 단계: 실기(세션 대화 중 settings.json 토큰 수정 → 다음 send respawn + 새 env 적용을 wire log/`turn_model_usage` 로 관측)는 electron egress 제약으로 본 환경에서 불가 — **사람/완전환경 확인 대기**. 버그리포트의 "모델이 다음 턴에 변경된다고 답변" 증상은 에이전트 자기 보고(스폰-바운드 system prompt) 추정이므로, 실기 시 `turn_model_usage` 원장으로 실제 적용 모델을 판정할 것(자기 보고 무시).

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 사람 확인 대기: ① 실기 — 세션 유지 중 현재 provider 의 settings.json 토큰/URL 수정 후 다음 메시지에서 respawn(스폰 로그 `engine.spawn.started`)·새 env 적용 확인, ② provider A→B→A 왕복 시 각각 최신 파일 반영, ③ PR 머지.
