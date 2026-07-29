# Verify — 0153-live-persist-structure-parity

## 메타

| 항목 | 값 |
|---|---|
| slug | `0153-live-persist-structure-parity` |
| 검증자 | Claude Code |
| 일자 | 2026-07-29 |
| 라운드 | 1 |
| 상태 | **PASS** |

> 비기능(버그수정)이라 plan → impl → verify 를 Claude 가 순차 수행했다. 구현자 코멘트 섹션은
> 설계자=구현자라 아래 "설계↔구현 자기 이견" 으로 대체한다.

## 설계↔구현 자기 이견 (매트릭스 전 선행)

| 설계 시점 판단 | 구현하며 드러난 사실 | 반영 |
|---|---|---|
| F2 를 "F1 도달 전 창을 덮는 **백스톱**" 으로 부차 취급했다 | **F2 는 독립적으로 더 심각한 결함을 막는다.** idle 세션 + 잔여 held 조합에서 구 경로는 순서 역전이 아니라 **라이브 메시지 소실**을 낳는다(아래 증거 D1). 0152 가 main 을 병합으로 바꾼 뒤 renderer 가 따라오지 않아 생긴 미탐지 회귀 | AC2 증거에 소실 경로를 명시. 파생 이슈 아님 — 이번 변경이 실제로 고친다 |
| busy 판정을 하나로 넓히면 된다고 봤다 | `steerBlockedByProviderBoundary`(0119)가 같은 `busy` 를 입력으로 쓴다. 넓은 predicate 를 그대로 먹이면 **0119 의 의미**("진행 중 턴의 provider 경계")가 바뀐다 | 0119 게이트는 기존 `busy` 유지, 예약 판정만 새 predicate 사용. `chatStore.ts` 주석에 근거 기록 |
| `beginListenPhase` 를 listen 분기에 남겨둬도 무해(멱등 가드) | 남기면 "신호를 어디서 여는가" 가 두 곳이 돼 회귀 시 추적이 어렵다 | listen 분기의 중복 호출 제거, 루프 상단 1곳으로 단일화 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | F1 — `flush` 스텝도 renderer 를 busy 로 유지. 판정은 순수 함수 + 단위 테스트 | ✅ | `post-turn.ts` — `postTurnHoldsSession(step) = step !== 'break'` · `chat-turn.ts` 루프 상단 `if (postTurnHoldsSession(step)) beginListenPhase(sessionId)`(스텝 판정 직후, `break` 분기 **앞**) · listen 분기의 중복 호출 제거 · `post-turn.test.ts` "postTurnHoldsSession (0153)" 4 케이스(flush/listen/break + `havePending` 전수 4조합) |
| 2 | F2 — inflight·listening 이 모두 false 여도 `pendingSteer` 가 비어있지 않으면 예약 경로 | ✅ | `lib/sendAdmission.ts` `shouldQueueAsPending` (신규 순수 함수) · `chatStore.ts:663-676` 가 이를 `queueAsPending` 으로 소비, 분기문이 `if (!queueAsPending)` · `sendAdmission.test.ts` 4 케이스 · store 계약은 아래 AC4 |
| 3 | F3 — `flush` 연속 턴의 `reserveHeld` 가 `message.submitted{true}` 발화 | ✅ | `chat-turn.ts` — `batch = pendingMessages.reserveHeld(sessionId,'turn-open')` 직후 `if (batch) sendOwnership(sessionId, batch.ids, true)`. 0151 은 `takeSteerFlush`(게이트) 경로에만 걸어 이 경로가 비어 있었다 |
| 4 | 관측 시나리오 회귀 테스트 — 낙관 커밋 미발생 | ✅ | `chatStore.listen.test.ts` "턴 경계 낙관 커밋 금지 (0153)" 2 케이스. ① steer 3건 예약 → `chat.listen ended` + `telemetry` 로 **inflight·listening 둘 다 false 확인** → 새 send → `messages` 0개(낙관 커밋 없음)·`inflight` false·`pendingSteer` 순서 `['666','777','888','999']` ② 잔여가 모두 커밋된 뒤의 유휴 send 는 **종전대로 낙관 커밋**(과잉 차단 아님) |
| 5 | 회귀 0 · IPC 무변경 | ✅ | lint 0 error(warning 1 = 0102 베이스라인) · typecheck 3/3 · vitest **149 파일 / 1234 테스트 전량 pass** · `src/shared/ipc.ts` diff 0(채널·이벤트 variant 무변경 — 기존 `chat.listen`·`message.submitted` 재사용) · 신규 의존성 0 · 마이그레이션 0 · 레이어 경계 0 |

### D1 — 갱신한 기존 테스트 1건 (계약 변경, 은폐하지 않음)

`chatStore.test.ts` 의 **"idle 세션 send 는 낙관 커밋 — 정식 user 버블 즉시 + 이월 pending 은 그대로(0068)"** 가 실패했다. 이 실패는 **정당하다** — 해당 테스트는 **0152 이전 main 동작**을 전제한다.

- 0152 AC2 이후 main 은 idle send 를 받으면 잔여 held + 신규를 **적재 순서대로 병합해 한 배치**로 커밋한다(사용자 확정 "병합 1버블").
- 구 renderer 경로는 그 상황에서 낙관 커밋을 했고, 뒤이어 도착하는 병합 커밋 `ids=[a,b,requestId]` 는 `chatStore.ts` 의 `patchPendingSteer` 로 `a`·`b` 를 pending 에서 **지운 뒤**, `hasCommittedClientId(requestId)` 가 참이라 **early return** 한다 → 병합 텍스트가 반영되지 않고 버블은 신규 텍스트만 남는다. **잔여 'first'/'second' 가 라이브에서 소실되고 재시작해야 복원된다.**
- 조치: 테스트를 두 개로 분해했다 — (a) 잔여 **없는** idle send 는 종전대로 낙관 커밋 + `clientId` 배선 검증(0068 계약 보존), (b) 잔여 **있는** idle send 는 예약 경로 → 병합 커밋이 세 항목을 한 버블로 정직하게 승격.

즉 이번 변경은 순서 역전뿐 아니라 **0152 가 남긴 미탐지 renderer 측 회귀**를 함께 닫는다.

## 로그 ↔ 코드 대조 (원인 확정 근거)

| 로그 사실 | 코드 근거 | 결론 |
|---|---|---|
| 6개 턴 전부 `telemetry` 가 마지막 — 이후 델타/`message.completed` 없음 | — | 초판 가설(프레임 조기 종료 → `unframed` 적체) **반증** |
| `telemetry`(555) → `chat.turn.started` → `message.queued 999` → `input.echo 666-888` | `chat-turn.ts` flush 분기에 phase 신호 부재 | renderer idle · main busy 구간 확정 |
| 999·101010 의 echo uuid ≠ queued id (`983a2cb8`≠`81ee8c26`) | `reserveHeld` = 배치 uuid 신규 발급 / `reserveItem` = item id 유지 | main 이 이들을 **held 로 받았다**는 독립 교차검증 |
| 111·555 는 echo uuid = queued id | `chat-turn.ts:626-629` | 턴-여는 send 는 종전대로 — 대조군 성립 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 0 error · 3/3 · 1234/1234 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 5/5 |
| 레이어 경계 | ✅ | — | 0 (신규 파일 `lib/sendAdmission.ts` = features 내부 lib) |
| 원인 확정(로그 대조) | ✅ | — | 확정 |
| **증상 실제 해소** | ✖ 불가 | ✅ | **사람 실기 대기** — 아래 |
| StatusLine 표시 변화 수용 여부 | ✖ | ✅ | flush 구간에 "대기 중" 이 유지된다(의도) |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ npm run lint
✖ 1 problem (0 errors, 1 warning)   ← useTranscriptVirtualizer(0102 베이스라인)

$ npm run typecheck
0 errors (node/web/test 3분할 전부)

$ ELECTRON_OVERRIDE_DIST_PATH=<any> ./node_modules/.bin/vitest run
 Test Files  149 passed (149)
      Tests  1234 passed (1234)
```

## 위생 검토

- `AGENTS.md` 무변경. IPC 무변경(`src/shared/ipc.ts` diff 0). 신규 의존성 0. 마이그레이션 0.
- 신규 로그 0 — 관측 표면은 기존 `chat.listen`·`message.submitted` 재사용이라 늘지 않는다.
- 신규 파일 2 + 신규 테스트 파일 1: `lib/sendAdmission.ts`(+`.test.ts`), `post-turn.ts` 함수 1개 추가.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 0153 초판이 **로그 없이** 프레임 조기 종료 가설을 세우고 그것을 PR 본문에까지 실었다. 코드 사실(R9~R11)은 맞았으나 *이번 증상의 원인* 이라는 연결은 근거가 없었다. "블로킹 입력을 받고 착수" 판단 자체는 옳았다 — 추측으로 고쳤다면 `unframed` 경로를 건드려 무관한 회귀를 만들었을 것이다.
- **더 일찍 잡을 수 있었나 — 그렇다.** 0152 가 main 의 idle-send 병합을 도입할 때 **renderer 측 대칭 경로를 점검하지 않았다.** `chatStore.test.ts` 의 그 테스트가 "잔여는 pending 유지" 를 명시적으로 잠그고 있었으므로, 0152 verify 에서 이 테스트를 읽었더라면 계약 불일치가 그때 드러났다. 0152 verify 의 "회귀 0(전량 green)" 은 **기존 테스트가 옛 계약을 통과시켰기 때문**이지 정합했기 때문이 아니다. *테스트 green ≠ 계약 정합* 의 사례로 기록한다.
- **검증 단계 한계**: F1 의 실제 발화(`chat.listen started` 가 flush 구간에 나가는가)는 **순수 함수 수준까지만** 기계 검증했다. 턴-후 루프는 `registerChatHandlers` 의 큰 클로저 안이라 IPC 발화를 떼어 관측할 하네스가 없다(0152 D2 와 동일 구조 한계). 증거는 "판정 함수 + 호출 지점" 이고, **사용자가 본 증상이 이 경로였다**는 로그 대조로 뒷받침되지만 실기 확인은 남는다.

## 결론 / 다음 단계

**PASS — 인수 5/5 충족.** 게이트 green, 회귀 0, IPC 무변경.

원인은 **로그로 확정**됐고(추정 아님), 수정은 원인 제거(F1) + 불변식 백스톱(F2) + 0151 구멍 마감(F3) 세 갈래다. 부수적으로 0152 가 남긴 renderer 측 미탐지 회귀(잔여 라이브 소실, D1)를 함께 닫았다.

### 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | 턴-후 루프의 IPC 발화를 관측할 테스트 하네스 부재 — F1 의 "실제로 신호가 나갔는가" 는 기계 검증 불가 | 검증 자기 리뷰 | `registerChatHandlers` 에서 턴-후 루프를 주입 가능한 단위로 분리하면 가능해진다(범위 밖, 0152 D2 와 같은 뿌리) | open |
| D2 | main 의 admission 계약을 바꿀 때 renderer 대칭 경로를 점검하는 절차가 없다 — 0152 가 그래서 D1(소실)을 남겼다 | 검증 자기 리뷰 | 큐/커밋 계약 변경 시 `chatStore.test.ts`·`chatStore.listen.test.ts` 를 **필수 리뷰 대상**으로 verify 체크리스트에 넣는다 | open |
| D3 | `listening` 의 의미가 "백그라운드 대기" 에서 "턴-후 체인 진행 중" 으로 넓어졌으나 wire 이름은 `chat.listen` 그대로 | F1 구현 | 이름 변경은 IPC 계약 변경이라 별건. 현재는 `postTurnHoldsSession` 주석·테스트가 의미를 고정 | open |

### 사람 확인 대기 (1순위)

1. **순서 역전 해소** — 응답 종료 직후(“답변완료”처럼 보이던 창)에 새 메시지를 보냈을 때, **잔여가 먼저** 들어가고 신규가 뒤인가. 재시작해도 순서가 그대로인가(= 라이브 == DB).
2. **StatusLine** — flush 연속 턴 동안 "대기 중" 표시가 유지되는 것이 수용 가능한가(종전에는 완료로 보였다 — 그게 거짓이었다).
3. **0143 무회귀** — 백그라운드 서브에이전트 완료 통지가 여전히 도착하는가.
4. **예약 버블** — 연속 턴으로 넘어간 예약 버블에서 취소 버튼이 사라지고 "전달됨" 으로 바뀌는가(F3).
