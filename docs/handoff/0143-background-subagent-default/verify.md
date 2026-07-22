# Verify — 0143-background-subagent-default

## 메타

| 항목 | 값 |
|---|---|
| slug | `0143-background-subagent-default` |
| 검증자 | Claude Code |
| 일자 | 2026-07-22 |
| 대상 커밋 | `7728fe1` |
| 라운드 | 1 |
| 상태 | PASS* |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 F1(busy 판정의 백그라운드 스코프 제외 — 설계 초안 결함) | 타당 — 제외하지 않으면 child 스트리밍 중 밸브 영구 no-op 로 steer 가 태스크 종료까지 좌초(버그 a 의 절반 재발) | AC4 매트릭스에서 `isBackgroundScoped` + 전용 테스트로 검증 |
| 선조치 F2(완료 알림 조기 발화) | 타당 — listen 대기 = 미완이므로 알림 유예가 요구 UX("기다리는 경우")와 정합 | AC8 증거에 포함 |
| 선조치 F3(합성 settled 의 버스 방출) | 타당 — 이것 없이는 채널 사망/중단 경로에서 통지·메타가 renderer/writer 에 안 흐른다(AC13 성립 조건) | AC12/AC13 매트릭스 반영 |
| 선조치 F4(stop 핸들러 관측 선독) | 타당 — settled() 가 관측을 동반 제거하므로 순서 결함이었다 | AC11 증거 반영 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | canUseTool 무주입 passthrough(차단 deny 만) | ✅ | `adapters/claude.ts` 서브에이전트 분기(주입 삭제·옵션 소거), `claude.canusetool.test.ts` passthrough/명시 true·false 보존/deny 6종 |
| 2 | env·식별자 전수 소거 | ✅ | `grep -rn 'ORCA_SUBAGENT_BACKGROUND\|backgroundSubagents' app/src` **0건**(테스트 픽스처 포함) |
| 3 | listen 턴 상시화(0138 게이트 제거) | ✅ | `chat-turn.ts` 턴-후 루프 — 게이트 블록·`background-unexpected` 경고 삭제, `decidePostTurnStep` haveTasks→'listen' 테스트 |
| 4 | SessionRuntime channelBusy(백그라운드 스코프 제외)·밸브 유예 | ✅ | `session-runtime.ts` `isBackgroundScoped`/`routeEvent`/`endListenFrame`(busy no-op), 테스트 5종(busy 전이·스코프 제외·mid-turn 밸브 no-op→자연 마감 무손실·백로그·teardown 해제) |
| 5 | pushTurn 유휴 보장(busy‖백로그 → listen 드레인 선행) | ✅ | `features/chat/post-turn.ts` + 테스트 8종, `chat-turn.ts` 루프가 판정 소비 |
| 6 | 버그 a 회귀 테스트 + fatal 매핑 유지 | ✅ | session-runtime "mid auto-turn 밸브 no-op — terminal 자연 마감(무손실)" 테스트(auto-turn 전체가 listen 프레임 귀속·steer 프레임 오귀속 없음), `claude-map.ts:478-491` diff 0(매핑 유지) |
| 7 | `chat.listen` phase 신호(1쌍·직행·미영속) | ✅ | `shared/ipc.ts` variant, `chat-turn.ts` `beginListenPhase`/`endListenPhase`(finally 보장·phase 스코프), writer case 부재 = 구조적 미영속(명시 case 스위치) |
| 8 | renderer listening(busy 라우팅·표시·TURN_END 불변·클리어) | ✅ | `chatReducer.ts`(listening/listenStartedAt·CANCEL 클리어), `chatStore.ts` busy=`inflight‖listening`, `ChatTile`/`PendingAssistant`/`Composer`/`useCompletionNotifier` 확장, reducer/store listen 테스트 9+3종("telemetry 가 listening 비클리어" 포함) |
| 9 | 자동 BEGIN_TURN 자식 이벤트 제외 | ✅ | `chatStore.ts` `parentToolRunId === undefined` 조건, store 테스트 2종(자식 미점화·최상위 점화) |
| 10 | 서브에이전트 패널 라이브 무회귀 | ✅ | `deriveSubagentTaskStatus`/`SubAgentTileContent`/`AgentTaskRow` diff 0, 기존 parts/subagent 스위트 green |
| 11 | 트래커 asyncLaunched + stop per-task 분기 | ✅ | `background-tasks.ts`(mark/is·재started 보존·settled 동반 제거, 테스트 5종), `turn-coordinator.ts` 영수증 마킹, `settle.ts` `alreadyBackground` 파라미터, stop 핸들러 선독(F4) |
| 12 | 중단 의미론(태스크도 중단 — 사용자 확정) | ✅ | `chat-turn.ts` `stopAndSettleAbortedTasks`(stopTask + settled stopped + clear) — listen 턴 aborted 후 호출, ended 신호는 finally |
| 13 | 완료 통지(라이브·재로드 동일, 멱등, 직접 stop 미표시) | ✅ | coordinator enrich(테스트 3종 — 관측 settled true/미관측 미부여/중복 미부여), `writer.ts` `subagent_notice` case, reducer 멱등 커밋(테스트), `SubagentNoticeRow`+segments 분리(테스트), i18n ko/en 4키(패리티 자동), stopSubagent 핸들러 background 미부여 |
| 14 | listen activeTurns 미계상 | ✅ | `turn-coordinator.ts` `request.listen !== true` 게이트(increment/decrement 대칭), 테스트 |
| 15 | 재로드 위생(stale async_launched → aborted) | ✅ | `parts.ts` `settleStaleAsyncLaunchParts`(테스트 4종 — 미정착 aborted/정착 무변/무결과 소관밖/일반 도구 무변), `chatReducer.ts` LOAD_SESSION 전 메시지 적용 |
| 16 | 문서 동기 | ✅ | provider-runtime.md §2 서브에이전트 절 재서술(0143), IPC_CONTRACT.md §3 `chat.listen` 행 + `subagent.task.background` + notice 처리, INDEX/PHASES 주석(0135/0138 폐기·0136 기본화) |
| 17 | 게이트 | ✅ | 아래 게이트 재실행 결과 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 통과 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 17/17 |
| 레이어 경계 위반 0 | ✅ | — | boundaries lint 통과(post-turn 은 chat 슬라이스 내부) |
| 문서 형식/한국어 | ✅ | — | provider-runtime·IPC_CONTRACT 동기 |
| 백그라운드 라이브 실기(런치→listen 배달→통지) | ✖ | ✅ | 사람 실기 대기(electron 로드) |
| listen 중 steer(스트리밍 중·유휴 중) 무사망 실기 | ✖ | ✅ | 사람 실기 대기 |
| 중단 버튼 → 태스크 stopped 정착·완전 유휴 실기 | ✖ | ✅ | 사람 실기 대기 |
| StatusLine 지속·깜빡임 부재 시각 | ✖ | ✅ | 사람 실기 대기 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
npm run lint       → 0 error (1 pre-existing warning: useTranscriptVirtualizer, 무관)
npm run typecheck  → node/web/test 3분할 0 error
vitest run         → 1144 passed / 141 files (신규 ~35; chat-turn.continuity 1파일 로드 실패
                     = electron egress 베이스라인 — Electron failed to install)
node --test scripts → 25/25
grep 게이트        → ORCA_SUBAGENT_BACKGROUND|backgroundSubagents app/src 0건
레이어 경계        → boundaries lint 위반 0, 신규 의존성 0, IPC 채널 수 불변(variant/파트 additive),
                     DB 마이그레이션 0(파트 JSON 영속)
```

## PHASES.md 정합성

- 0143 행 승격 + 0135/0136/0138 주석(폐기/기본화) 기재 확인.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 버그 a 의 기전(프레임 오귀속)을 코드 트레이스로 확정하고 밸브 유예+유휴 보장 2중 차단을 세운 것이 유효. 단 busy 판정 초안이 백그라운드 스코프를 간과(F1) — 구현 턴의 비판적 리뷰가 잡았다.
- 구현 단계: 합성 settled 의 버스 방출(F3)이 없었으면 통지 AC 가 라이브 경로에서만 성립할 뻔했다 — 채널 사망/중단 경로 대칭성을 선조치로 확보.
- 검증 단계: chat-turn 턴-후 루프의 실제 listen phase 왕복(started→listen→flush→listen→ended)은 electron 로드 스위트라 순수 단위(판정 함수·프리미티브)로만 커버 — 실기는 사람/CI 몫. "가드 통과 직후 auto-turn 개시" 극소 레이스는 정적으로만 수용 판정(무손실·렌더 순서 수준) — 실기에서 관찰되면 파생 이슈로.

## 결론 / 다음 단계

- 상태: **PASS\*** — 인수 17/17 기계 충족. `*` = 라이브 실기 4항(백그라운드 라이브·steer 무사망·중단 정착·시각)·PR 머지가 사람 대기. PHASES 승격. 0138 은 본 핸드오프로 supersede(라이브 미검증 상태에서 방향 반전 — verify 미작성 종결), 0135 는 폐기.
