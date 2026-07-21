# Verify — 0136-background-subagent-runtime

## 메타

| 항목 | 값 |
|---|---|
| slug | `0136-background-subagent-runtime` |
| 검증자 | Claude Code |
| 일자 | 2026-07-21 |
| 대상 커밋 | `046d54e` |
| 라운드 | 1 |
| 상태 | PASS* |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 §F1(런치 영수증 vs 권위결과 구분 필요) | 타당 — 선조치로 코디네이터에 `!isAsyncLaunchResult` 가드 추가됨 | AC5 매트릭스에서 테스트 3종으로 검증 |
| 선조치 F2(밸브 종료 시 합성 telemetry → inflight 깜빡임, ⚠️ 보고만) | 타당 — 기존 0067 AC7 연속 턴과 동형 패턴이라 신규 회귀 아님. 단독 결정 불요 | 파생 이슈 아님, 사람 시각 실기 대기 항목으로 기록 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | claude-map `tool_use_result`(async_launched, 단일 tool_result 블록) → result 매핑 | ✅ | `claude-map.ts:asyncLaunchReceipt` + 사용부, 테스트 "런치 영수증을 result 로 싣는다"·"완료 결과는 미매핑"·"복수 블록 미적용" |
| 2 | 렌더 '실행 중' 유지(renderer 무변) | ✅ | renderer `parts.ts:isAsyncLaunchedResult` 무변경(diff 0), main 이 객체 형태를 공급하도록 매핑 |
| 3 | listen 턴 — push/spawn 없이 프레임 소비, 채널 부재 즉시 종료, terminal 종료 | ✅ | `session-runtime.ts:runAttempt`(listen 분기), 테스트 "채널 생존 중 소비"·"백로그 선합류"·"채널 없으면 즉시 종료" |
| 4 | chat-turn 턴-후 루프가 listen 턴 구동, held 우선 | ✅ | `chat-turn.ts` 연속 루프(pending>0 → 연속 턴, else 태스크 존재 → listen 턴) |
| 5 | 백그라운드 태스크 추적 started/settled + 콜드 spawn 리셋 | ✅ | `background-tasks.ts` + `turn-coordinator.ts`(started/settled 훅·권위결과 해제), `chat-turn.ts:settleDeadBackgroundTasks`·콜드 spawn clear, 테스트 4종 |
| 6 | listen 턴 stall 미무장 | ✅ | `turn-coordinator.ts:stallTimerFor`, 테스트 "listen=true no-op"·"undefined 는 실제 abort" |
| 7 | busy-send 릴리즈 밸브(endListenFrame) | ✅ | `session-runtime.ts:endListenFrame` + `chat-turn.ts:listenRelease`(reserveOnBusySession 직후 호출), 테스트 "endListenFrame draining 없이 이월"·"비-listen no-op" |
| 8 | 채널 사망 시 합성 settled 정착 + clear | ✅ | `chat-turn.ts:settleDeadBackgroundTasks`(createSubagentSettlementEvents 재사용, status failed) |
| 9 | 단위 테스트 4계열 | ✅ | claude-map 3 + session-runtime listen 6 + background-tasks 8 + coordinator 5 |
| 10 | 게이트 + provider-runtime.md 동기 | ✅ | 아래 게이트 결과, `provider-runtime.md §2` 서브에이전트 백그라운드 라이프사이클 절 추가 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 통과 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 10/10 |
| 레이어 경계 위반 0(feature 교차 import 금지) | ✅ | — | boundaries lint 통과(background-tasks 는 chat 슬라이스 내부) |
| 문서 형식/한국어 | ✅ | — | provider-runtime.md 동기 |
| 백그라운드 서브에이전트 라이브 실기(런치→listen 배달→settled 정착) | ✖ | ✅ | 사람 실기 대기(electron 로드) |
| F2 inflight 깜빡임 시각 확인 | ✖ | ✅ | 사람 실기 대기 |
| 백그라운드 제품 기본 전환(Open Question) | ✖ | ✅ | 사람 결정 대기(0135 foreground 고정 해제 여부) |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
npm run lint       → 0 error (1 pre-existing warning: useTranscriptVirtualizer, 무관)
npm run typecheck  → node/web/test 3분할 0 error
vitest run         → 1099 passed / 138 files (신규 22; chat-turn.continuity 1파일 로드 실패 = electron egress 베이스라인)
node --test scripts → 25/25
레이어 경계        → boundaries lint 위반 0, 신규 의존성 0, IPC/DB 변경 0
```

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: listen 턴의 데드락/고착 경로(밸브·콜드 spawn·채널 사망)를 리스크 표에서 미리 펼쳐 구현이 그대로 착지했다.
- 구현 단계: F1(영수증 vs 권위결과)을 선조치로 잡은 것이 정확. F2(밸브 telemetry 깜빡임)는 기존 패턴 동형이라 보고만 한 판단이 적절.
- 검증 단계: chat-turn 의 루프 통합(listen 턴 실제 개시·재평가)은 electron 로드 스위트(`chat-turn.continuity`)라 순수 단위로만 커버 — 실기는 사람/CI 몫. listen 턴이 여러 백그라운드 태스크에 걸쳐 child 를 정착하는 다중-턴 엣지는 기존 per-turn openToolRuns 의미론과 동형이라 별도 검증 미수행(채널 사망 정리 AC8 이 백스톱).

## 결론 / 다음 단계

- 상태: **PASS\*** — 인수 10/10 기계 충족. `*` = 백그라운드 라이브 실기·F2 시각·제품 기본 전환 결정·PR 머지가 사람 대기. PHASES 승격. 0135 와 같은 브랜치라 통합 실기(foreground 기본 + 백그라운드 경로 수용)를 함께 확인한다.
