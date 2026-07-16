# Verify — 0118-provider-boundary-respawn

## 메타

| 항목 | 값 |
|---|---|
| slug | `0118-provider-boundary-respawn` |
| 검증자 | Claude Code |
| 일자 | 2026-07-16 |
| 대상 커밋 | `b929d9e` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 조정 1건 — 판정 함수를 chat-turn export 대신 `features/providers/provider-boundary.ts` 분리 + 배럴 re-export (chat-turn 모듈은 import 시 electron 을 끌어와 비-DB vitest 직접 import 불가) | 타당 — 설계 의도(컴포지션 루트가 판정을 *호출*)는 불변이고, 테스트 가능성 + provider 어휘 위치가 모두 개선. 선조치 경계(구현 세부) 내 ✅ | 매트릭스 AC#2·3 증거를 분리 모듈 테스트로 대조 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 경계 respawn — providerKey 변경 + 채널 생존 시 teardown → spawn(resume) 콜드 패스가 새 env 주입 | ✅ | 호출부 `app/src/main/app/chat-turn.ts` (acquireRuntime 직후 `crossesProviderBoundary(sessionMeta?.provider_key, resolved.providerKey) && runtime.channelAlive → teardownChannel()`); 테스트 `session-runtime.test.ts` "teardownChannel() 은 유휴 채널을 내리고(상태 불변) 다음 send 가 새 env 로 respawn 한다" — spawn 2회 + 2번째 요청 `env` 신값 단언, PASS |
| 2 | 동일 provider 무 teardown | ✅ | `provider-boundary.test.ts` "같은 providerKey 는 경계가 아니다" false 단언, PASS |
| 3 | 보수적 no-op (이전 null/undefined·resolved null) | ✅ | `provider-boundary.test.ts` null/undefined/resolved-null 3케이스 false 단언, PASS |
| 4 | 새 세션/fork/handoff 무영향 | ✅ | 호출부가 `parsed.data.sessionId &&` 가드 — sessionId=null(새 채팅·fork·handoff 수렴 경로)은 판정 자체를 건너뜀. 풀도 sessionId 키라 null 은 재사용 없음(`supervisor.ts` acquireRuntime) |
| 5 | teardown 위생 — 상태머신 불변 + unframed 백로그 클리어 | ✅ | 테스트 1: `state === 'live'` 유지 단언; 테스트 2: "unframed 백로그를 비운다 — respawn 후 프레임에 유출 금지" respawn 프레임이 `['telemetry']` 만 수신, 둘 다 PASS |
| 6 | busy 세션 비범위 문서화 | ✅ | plan `범위/비범위` + `파생 UX` — held 예약 경로(`chat-turn.ts` reserveOnBusySession)는 판정에 도달하지 않음을 명시 |
| 7 | 게이트 green | ✅ | 아래 "게이트 재실행 결과" — lint 에러 0 / typecheck 3분할 / vitest 921/921 / scripts fail 0 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 에러 0(경고 1건은 기존 renderer 가상화 파일, 변경 무관) · typecheck node/web/test · vitest 921/921 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 위 매트릭스 |
| 레이어 경계 위반 0 | ✅ | — | app→features/providers·sessions 하향만, feature 교차 import 0 (lint 에 boundaries 포함) |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/runtime-ipc 한국어·링크 확인 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 요구("provider 경계 모델 변경 시 세션 재시작") 직결 — 사람 확인 대기 |
| Open Questions | ✖ | ✅ | 해당 없음 |
| UI/UX 시각 검증 | ✖ | ✅ | 렌더러 무변경 — 해당 없음 |
| **실기 provider 전환** | ✖ | ✅ | **사람 실기 대기(1순위)**: 유휴 세션에서 provider A→B 모델 변경 후 send — 응답이 새 provider 로 이어지는지 + 대화 컨텍스트 유지(resume) 확인 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # 에러 0, 경고 1(react-hooks/incompatible-library — 기존 useTranscriptVirtualizer, 변경 무관)
$ npm run typecheck               # node/web/test 3분할 모두 통과
$ ./node_modules/.bin/vitest run  # Test Files 120 passed | 1 failed(121) · Tests 921/921 passed
$ node --test scripts/*.test.mjs  # fail 0
```

- vitest 실패 1 스위트 = `chat-turn.continuity.test.ts` **로드 실패**("Electron failed to install correctly") — electron 바이너리 egress 403 환경 베이스라인(0117 verify 와 동일 계열, 테스트 실행 자체가 안 된 것이지 실패 아님). better-sqlite3 는 `npm rebuild`(Node ABI 소스 컴파일)로 DB 스위트까지 green.
- 신규 테스트 기여: +6 (판정 4 + respawn 계약 2) — 0117 시점 915 → 921.

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 변경 없음. plan/verify 에 키/토큰/이메일/IP 없음.

## PHASES.md 정합성

- 0118 행 승격(구현 커밋 `b929d9e`) — 본 검증 커밋에 포함.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 판정 함수 배치를 chat-turn export 로 잡아 테스트 격리(electron import)를 놓쳤다 — 구현 턴에서 조정(선조치 ✅). 다음부터 순수 함수는 처음부터 feature 슬라이스 배치를 기본값으로.
- 구현 단계: `handleChatSend` 전체 통합 테스트(경계→teardown 호출 순서)는 DB+electron 하네스가 필요해 생략 — 판정·프리미티브 단위 테스트 + 3줄 호출부 리뷰로 갈음(plan 테스트 전략대로). 실기 검증이 이를 보완해야 한다.
- 검증 단계: 실환경 provider 전환(env 실제 적용·resume 컨텍스트 유지)은 이 환경에서 불가 — 사람 실기 대기로 분리(0019/0102 선례).

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 사람 확인 대기: 실기 provider A→B 전환 1회(응답 provider 변경 + 대화 연속성).
