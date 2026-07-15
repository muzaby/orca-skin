# Verify — 0107-streaming-persist-hotpath

## 메타

| 항목 | 값 |
|---|---|
| slug | `0107-streaming-persist-hotpath` |
| 검증자 | Claude Code |
| 일자 | 2026-07-15 |
| 대상 커밋 | `223e353` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 정정: 재구성은 recover **이전** 호출(complete=0 이 식별자) | 타당 — plan 인수 기준 6 으로 정식화됨 | 매트릭스 #6 |
| 선조치 ✅ #1: chatCancel 경로 finalize 누락 → `finalizeTurn` 신설 | 타당 — 상시 사용 경로(사용자 중단) 공백을 닫음 | 매트릭스 #4 |
| 선조치 ✅ #2: writer 스위트 electron mock hermetic 주입 | 타당(0104 선례) — 제약 환경에서도 신규 테스트 실행 확보 | 게이트 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `synchronous=NORMAL` (WAL 직후) | ✅ | `app/src/main/infra/db/index.ts:17-21` |
| 2 | 스트리밍 중 `updateMessageContent` 0회, telemetry 마감 시 누적 전체 1회 | ✅ | `writer.ts` message.completed 케이스(호출 제거)·`finalizeAssistantMessage` + 테스트 "텍스트 블록 N개 → … 1회 기록"(`writer.test.ts`) green |
| 3 | `commitUserMessage` 마감 시 content 기록 + complete | ✅ | `writer.ts:70-74` finalize 대체 + 테스트 "commitUserMessage 가 … 마감" green |
| 4 | chatCancel 시 finalize | ✅ | `app/chat-turn.ts` chatCancel — `persistence.finalizeTurn(turn)`(settle 뒤) + `finalizeTurn` 테스트 green |
| 5 | `rebuildIncompleteMessageContent` — 최상위 text concat, 서브에이전트 child 제외, 부팅+세션 send | ✅ | `recovery.ts` 신설 + 테스트 3건 green(`recovery.test.ts`), 배선 `bootstrap.ts`(chat-recovery)·`chat-turn.ts`(send 초입, 비-live 가드) |
| 6 | 재구성이 recover **이전** 실행 | ✅ | `bootstrap.ts` chat-recovery 스텝 내 순서, `chat-turn.ts` 호출 순서(주석 명기) |
| 7 | `updateSessionPreview` 라이브 갱신 유지 | ✅ | writer message.completed 케이스 유지 + 테스트 단언(3회 호출) |
| 8 | 게이트 | ✅ | lint 0 error(경고 1=0102 기지) · typecheck 3종 0 · **vitest 878/878 전체 green**(Node ABI 재빌드 성공 — DB 로드 스위트 포함, `queries.test` 가 신규 statement SQL 유효성 검증) · scripts node:test fail 0 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전체 green(위) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 |
| 레이어 경계 위반 0 | ✅ | — | lint boundaries 0 error |
| 실기: 장문 스트리밍 wireLog 간격 전/후·강제종료 후 FTS 검색 적중 | ✖ | ✅ | **사람 확인 대기**(electron 실기 — egress 제약, 0019 선례) |
| `synchronous=NORMAL` durability 트레이드오프 수용 | ✖ 제안 | ✅ | persistence.md 명기 — 사람 최종 판단 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
lint: 0 error (warning 1 = 0102 TanStack↔React Compiler 기지)
typecheck: node/web/test 3종 0 error
vitest run: 878 passed (878) — npm rebuild better-sqlite3(Node ABI 소스 컴파일) 성공으로 DB 스위트 포함 전체 green
node --test scripts: fail 0
```

## PHASES.md 정합성

- 성능 시리즈 4행 일괄 승격(0107~0110) — 형식 확인.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 초안이 재구성 호출 순서를 recover "직후"로 잘못 뒀다 — 구현 중 발견·정정(설계자=구현자 동일인의 한계, 인수 기준으로 고정해 회귀 방지).
- 구현 단계: adapter error/stall timeout 종료의 finalize 는 다음 send/부팅 재구성에 위임 — 즉시성은 미해결(수용 범위 명기).
- 검증 단계: wireLog 전/후 실측 수치를 남기지 못함(electron 실기 불가 환경) — 사람 실기 항목으로 이관.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 실기(스트리밍 체감·FTS 재구성·durability)는 사람 확인 대기.
