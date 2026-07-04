# Verify — 0065-nav-draft-unify-simplify

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능+소규모 UX = Claude 직접 plan→impl→verify. 이번 검증의 특기점: **로컬(사용자 머신) 실기 E2E** — 0064 까지 원격 환경 제약으로 불가하던 실 SDK /compact 턴 실측을 수행했다(CDP 9223 + wireLog + 실 Claude 턴 3회, 테스트 세션은 검증 후 삭제).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0065-nav-draft-unify-simplify` |
| 검증자 | Claude Code |
| 일자 | 2026-07-04 |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | compact 후 도넛 갱신(r5 결함 수정) | ✅ | **실측 재현**: compact 턴 `result.usage` 전부 0(wire log) → 도넛 8% 고착. **수정**: `claude-map.ts` 근사 폴백=modelUsage 출력 합(`summaryTokens`) + `chatReducer.ts:350` compacted 시 `lastTelemetry: undefined`. **실측 확증**: telemetry `inputTokens:1471`, 도넛 aria-label 8%→**1%**, `session.load` 복원값 1471/cache 없음/비용 보존. 테스트: `claude-map.test.ts` "순수 /compact 턴(실측 wire)" + `chatReducer.parts.test.ts` "session.compacted 는 … 지운다" |
| 2 | '새 대화' nav 행 통일 | ✅ | `useDraftSessionRows`(chatStore — `activeKey===NEW_CHAT_KEY` 시 최상단 행) · 실기: /new 진입 즉시 `__new__` 행 active·kebab 無 → 세션 이동 시 소멸 → mock 전송 물질화 시 DB 행(`Mock 자동 제목`) 교체 확인 |
| 3 | continuity draft 행 회귀 없음 | ✅ | 기존 r4 draft nav 테스트 green(이름 변경 무관 — store 직접 테스트) + 실기: fork 클릭 → draft 행 즉시·구분선·'원본 열기' 즉시 전환·행 생존 |
| 4 | draft 시드 dedup 동작 diff 0 | ✅ | `continuityDraftSession` 헬퍼(fork=lastTelemetry/메시지/forkFrom 추가, handoff=inflight/handoffFrom 추가) — chatStore r4/r5 테스트 전부 green |
| 5 | 게이트 + 무추가 | ✅ | lint/typecheck(3종)/test **677 passed(90파일)**. 신규 의존성·IPC 채널·DB 변경 0 |

## 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 | ✅ | — | 677 green |
| 실기 E2E(도넛·nav 행·fork·원본 열기) | ✅ CDP 실측 | ✅ 재확인 환영 | 위 매트릭스 |
| handoff 실기(도착 세션 compact) | ✖ 미실행(수정 경로는 manual /compact 와 동일 — claude-map 공통) | ✅ | 사람 확인 대기 |
| auto 압축(임계 도달) 실기 | ✖ 재현 비용 큼(200k 컨텍스트) — 경계 이후 실측 usage 스냅샷 경로는 단위테스트 잠금 | ✅ | 사람 확인 대기(저빈도) |
| PR 머지·push | ✖ | ✅ | 대기 |

## 결론

- **PASS** — 사용자 보고 결함(도넛 고착)의 근본 원인을 실측으로 확정(*compact 턴 result.usage=0, 사용량은 modelUsage 에만*)하고 수정·확증했다. r5 가 방어 구현(원격 환경 제약)으로 놓친 것을 로컬 실측이 잡음 — **continuity 계열의 잔여 검증은 로컬 실기가 기본 경로**(교훈).
- 사람 확인 대기: 핸드오프 실기 1회(도착 세션 도넛)·StatusPopover warn 경로 /compact 실기.
