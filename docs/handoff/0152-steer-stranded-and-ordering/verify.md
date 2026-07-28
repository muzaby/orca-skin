# Verify — 0152-steer-stranded-and-ordering

## 메타

| 항목 | 값 |
|---|---|
| slug | `0152-steer-stranded-and-ordering` |
| 검증자 | Claude Code |
| 일자 | 2026-07-28 |
| 대상 커밋 | (아래 결론 참조) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 — AC1 의 보장 범위를 "`reserveOnBusySession` 경로의 창" 으로 좁혀야 한다 | **타당.** "창이 닫힌다" 는 두 사실의 곱이다 — ① send 경로에서 판정↔적재 간 await 제거(이번 변경) ② 턴-후 루프의 `break`→`release` 구간에 await 부재(기존 코드 성질). ②는 이번 PR 이 만든 보장이 아니라 **의존하는 전제**다 | AC1 판정을 "①은 구현으로 보장, ②는 전제로 확인" 으로 나눠 기록. 파생 이슈 D1 |
| P1 ✅ `pending().length` 를 enqueue **직후**에 읽어야 함 | 수용 — 순서가 틀리면 병합이 죽는 실질 결함이었다 | AC2 증거로 확인 |
| P2 ✅ 호출부 `await` 제거 | 수용 | lint 0 error 로 확인 |
| P3 ⚠️ 불변식에 기계 강제 없음 | **수용(보고만이 옳다).** ESLint 로 "이 두 지점 사이에 await 금지" 를 표현할 수단이 없다 | 파생 이슈 D1 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 판정↔적재 원자성 — `reserveOnBusySession` 동기화 | ✅ | `chat-turn.ts` — `const reserveOnBusySession = (event, sessionId, data, na): void =>`(동기 시그니처, 내부 `await` 0) · 호출부 `reserveOnBusySession(event, parsed.data.sessionId, parsed.data, normalizedAttachments)`(`await` 없음) · 정규화 블록이 `supervisor.hasSession(...)` 분기 **위**로 이동. **구현자 이견 반영**: ②(루프 `break`→`release` 무-await)는 전제로 재확인 — `if (step === 'break') { … break }` 이후 `finally` 의 `endListenPhase`·`release`·`releaseRuntime` 모두 동기 |
| 2 | 잔여 held 병합, 시간순 보존 | ✅ | `chat-turn.ts` — `pending(queueKey).length > 1 ? reserveHeld(queueKey,'turn-open') : reserveItem(queueKey, queuedItem.id,'turn-open')`, `enqueue` 직후 판정(P1). 큐 semantics 는 `toBatch` 가 적재 순서 유지 + `createdAt = items[0].createdAt` |
| 3 | 중복 정규화 제거 | ✅ | `grep -c "await normalizeAttachments" chat-turn.ts` → **1**(변경 전 2). busy 경로의 자체 try/catch·`na` 지역변수 제거 |
| 4 | 회귀 0 | ✅ | vitest **148 파일 / 1223 테스트 전부 pass**(0151 종료 시점 1222 + 신규 1). steer·커밋·프렐류드·respawn·continuity 스위트 전부 green |
| 5 | 순서 회귀 테스트 | ✅ | `pending-message-queue.test.ts` — "잔여 held + 신규 send 를 병합하면 시간순이 보존된다 (0152)": `ids=['stranded','fresh']` · `text` 순서 · `createdAt=10`(가장 오래된 값) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 error(warning 1 = 0102 베이스라인) · typecheck 3/3 · vitest 1223/1223 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 5/5 |
| 레이어 경계 위반 0 | ✅ | — | boundaries 0(컴포지션 루트 내부 변경) |
| 문서 형식/한국어 | ✅ | — | 유지 |
| **증상 1 실제 해소** | ✖ **불가** | ✅ | **사람 실기 대기** — 레이스라 재현이 확률적, 아래 참조 |
| 증상 2 실제 해소 | ✖ 보조 | ✅ | 사람 실기 대기 |
| UI/UX(병합 버블 표현) | ✖ | ✅ | 사람 확인 대기 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ npm run lint
✖ 1 problem (0 errors, 1 warning)   ← useTranscriptVirtualizer(0102 베이스라인)

$ npm run typecheck
0 errors (3분할 전부)

$ ELECTRON_OVERRIDE_DIST_PATH=<any> ./node_modules/.bin/vitest run
 Test Files  148 passed (148)
      Tests  1223 passed (1223)
```

## 위생 검토

- `AGENTS.md` 무변경. IPC 무변경(채널·이벤트·스키마 diff 0). 신규 의존성 0. 마이그레이션 0.
- 신규 로그 0 — 이번 변경은 구조 조정이라 관측 표면이 늘지 않는다.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: AC1 을 "창이 닫힌다" 로 단정한 것이 부정확했다 — 실제로는 **두 사실의 곱**이고 그중 하나는 이번 PR 이 만들지 않은 전제다. 구현자 이견이 이를 잡았고, 설계가 먼저 분해했어야 했다.
- **구현 단계**: 미흡 없음. P1(판정 시점)은 설계가 놓쳤으나 구현이 잡았다.
- **검증 단계**: **증상 1 을 기계적으로 증명하지 못했다.** TOCTOU 는 `await` 를 인위적으로 지연시켜야 재현되는데, `handleChatSend` 가 컴포지션 루트의 큰 클로저라 그 지점만 떼어 테스트할 수 없다. 지금 증거는 **"동기 시그니처" 라는 구조적 사실**뿐이고, 이는 "레이스가 존재할 수 없다" 를 보이지만 "사용자가 본 증상이 이 레이스였다" 를 보이지는 못한다. 즉 **진단의 정확성은 여전히 실기로 확인해야 한다** — 고쳤는데 증상이 남으면 원인이 다른 것이다. 이 한계를 결론에 명시한다.

## 결론 / 다음 단계

**PASS — 인수 5/5 충족.** 게이트 green, 회귀 0.

**단, 두 증상의 해소는 실기로만 확정된다:**

| 증상 | 이번 변경의 성격 | 확신도 |
|---|---|---|
| 2 (순서 역전) | **결정적** — 코드 경로가 명확히 바뀌었고 단위 테스트로 고정 | 높음 |
| 1 (stranded held) | **구조적** — 레이스 창을 제거했으나 사용자가 본 증상이 이 창이었는지는 미확인 | 중간 |

증상 1 이 실기에서 재현되면 원인이 다른 곳이다. 그 경우 다음 후보를 본다: ① `decidePostTurnStep` 이 `channelBusy`/`hasBacklog` 로 `listen` 을 반환한 뒤 listen 턴이 오래 열려 있는 경우(백그라운드 태스크 미정착) ② 렌더러가 busy 로 보고 main 은 idle 로 보는 상태 불일치.

### 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | "busy 판정 ↔ 큐 적재 사이에 `await` 금지" 와 "턴-후 루프 `break`→`release` 사이에 `await` 금지" 가 **주석으로만 유지되는 불변식** | 구현자 P3 + 검증자 이견 수용 | 기계 강제 수단 없음. 두 지점에 근거 주석 유지 + 회귀 시 이 verify 를 참조 | open |
| D2 | 증상 1 의 기계 검증 부재 — 컴포지션 루트 클로저라 레이스 주입 테스트 불가 | 검증 자기 리뷰 | send 핸들러의 admission 판정을 순수 함수로 뽑으면 테스트 가능해진다(범위 밖, 후속) | open |

### 사람 확인 대기 (1순위)

1. **증상 1** — 어시스턴트 응답이 끝나는 타이밍에 steer 를 보냈을 때, pending 이 남지 않고 즉시 다음 턴으로 흘러가는가.
2. **증상 2** — 어떤 경로로든 pending 이 남은 상태에서 새 메시지를 보냈을 때 **잔여가 먼저** 들어가는가(병합 1버블로 보인다).
3. 병합 버블 표현이 수용 가능한가(잔여 + 신규가 `\n\n` 로 이어진 한 버블).
