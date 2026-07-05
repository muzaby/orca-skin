# Verify — 0068-turn-open-optimistic-commit

## 메타

| 항목 | 값 |
|---|---|
| slug | `0068-turn-open-optimistic-commit` |
| 검증자 | Claude Code |
| 일자 | 2026-07-05 |
| 대상 커밋 | impl `a881d77` |
| 라운드 | 1 |
| 상태 | **PASS (코드 검증 — 버그 2건 실기 재현 확인·wire 계측 판독은 사람 확인 대기)** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

plan `[구현자 기입]` 선조치 ✅ 2건(테스트 시드 `?? []` 정규화 · wire-log electron 비의존 분리 확증)은 전부 무해한 구현 세부 — 설계 변경 없음. ⚠️ 0건.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 랜딩 즉시 전환 + `!inflight` 이중 방어 | ✅ | `NewChatLandingPage.tsx` isEmpty 에 `!s.inflight` 추가. 낙관 커밋(AC2)으로 send 동기 사이클에 `messages` 채워짐 — 새-채팅 테스트가 `messages[0]` 존재를 단언 |
| 2 | 턴-시작 낙관 커밋(idle·새 세션) / busy=pending 유지 | ✅ | `chatStore.send()` — 새 세션 경로 BEGIN_TURN+APPEND 이중 reducer, idle 경로 dispatchActive 2연타, busy 경로 patchPendingSteer 현행. 테스트 "idle 세션 send 는 낙관 커밋", "busy 세션 send 는 예약" |
| 3 | 이중 버블 0 — queued skip·committed 멱등, 핸드오프 자동 메시지 경로 불변 | ✅ | `hasCommittedClientId` + queued 조기 return + committed `ids.some` skip + reducer clientId 멱등 가드. 테스트 "낙관 커밋 뒤 도착한 message.queued/committed 는 멱등" + 기존 핸드오프 에코 순서 테스트 2건 green(자동 메시지 pending 경로 보존) |
| 4 | invoke 거부 롤백 | ✅ | `DROP_UNCOMMITTED_USER` 액션 + send catch 분기. 테스트 "idle send 의 invoke 거부는 낙관 커밋 버블을 롤백한다" |
| 5 | steer 경로 불변 | ✅ | busy 예약·게이트 flush·echo 승격·hover 취소·중단 draft 복원 코드 무변경 — 0067 스위트(steer lifecycle 7종) 전부 green |
| 6 | main 커밋 경로 불변 | ✅ | `HistoryWriter`·`PendingMessageQueue`·echo 관측·IPC 스키마 diff 0 — main 변경은 계측(wire-log 분리·echo 로그 1줄·훅 tap)뿐. `git show a881d77 --stat` 확인 |
| 7 | wire 계측 — input.echo·UserPromptSubmit/PostToolBatch tap | ✅(코드) | `infra/ipc/wire-log.ts`(electron 비의존)·coordinator echo 로그·`makeHookWireTap()`(관측 전용, fail-open, mergeHooks concat). off 시 무출력(플래그 게이트). **판독은 사람 실기** |
| 8 | 게이트 + 무변경 불변식 | ✅ | lint 0 · typecheck 3종 0 · vitest **687/687 (88파일)** · build exit 0 · 신규 의존성 0 · IPC 채널/이벤트 스키마 0 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 green |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 |
| **버그 2건 실기 재현 확인** | ✖ 원격 환경 제약 | ✅ | **사람 확인 대기(1순위)**: ① 랜딩 첫 메시지 → 즉시 transcript 전환 ② idle send → 정식 버블 즉시 + 답변이 그 아래 스트림(점프 없음) ③ 도구 턴 steer → pending→승격 회귀 없음 ④ 재로드 정렬 정합 |
| **wire 계측 판독(echo↔훅 논쟁 판정)** | ✖ | ✅ | 디버그 패널 Wire 토글 on 후 일반 턴 1회+도구 턴 steer 1회: (a) `hook.UserPromptSubmit` 이 push 프롬프트에 찍히는가·keys 에 uuid 유무 (b) `input.echo` ↔ 어시스턴트 스트림 순서 → **main 커밋 신호 echo→훅 교체 여부 결정 자료** |
| PR 머지 | ✖ | ✅ | — |

## 게이트 재실행 결과

```
$ npm run lint        # 0 error
$ npm run typecheck   # node + web + test → 0 error
$ npx vitest run      # Test Files 88 passed, Tests 687 passed
$ npm run build       # tsc --noEmit && electron-vite build → exit 0
```

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계(0067): "echo sub-second → pending-first 로 충분" 전제를 실측 없이 채택한 것이 이번 버그의 뿌리 — 장수명 채널에서 echo 타이밍이 표시 계약을 결정하는데 실기 검증을 사람 확인 대기로만 미뤘다. 표시 계약처럼 사용자가 즉시 체감하는 전제는 코드 검증 PASS 이전에 최소 실기 1회가 필요하다는 교훈.
- 구현 단계: 낙관 커밋의 DB↔표시 불일치 창(스폰 실패·즉시 취소 시 라이브에만 보임)은 트레이드오프로 수용 — 0067 이전과 동일 계약이나, 실측에서 거슬리면 후속에서 error 시 버블 시각 처리(흐림 등)를 검토할 수 있다.
- 검증 단계: 이번에도 실기 재현 확인은 원격 제약으로 사람 몫 — 대신 wire 계측을 동봉해 다음 실기가 곧 판정 데이터가 되도록 했다.

## 결론 / 다음 단계

**PASS(코드 검증).** 인수 8/8, 게이트 4종 green. 사람 확인 2건 — ① 버그 재현 소멸 실기 ② wire 로그 판독(UserPromptSubmit 발화 여부·echo 순서) → 판독 결과로 main 커밋 신호(echo 유지 vs 훅 교체) Open Question 을 닫는다.
