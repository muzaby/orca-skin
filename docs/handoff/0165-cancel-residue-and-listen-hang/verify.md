# Verify — 0165-cancel-residue-and-listen-hang

> 검증 절차·역방향 탐색은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업 규칙·상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0165-cancel-residue-and-listen-hang` |
| 검증자 | Claude Code |
| 일자 | 2026-08-04 |
| 대상 커밋 | `03ff691` (base `bffa726`) |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **설계=Claude / 구현=Codex / 검증=Claude** — 설계자와 검증자가 같다. 내가 쓴 인수 기준을 내가 채점하므로 §역방향 탐색과 §0 을 우선 적용했고, 두 건은 **직접 실행(프로브)** 으로 확정했다. |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 | **취소 시 이미 도착한 미소비 이벤트가 통째로 소실**된다 | `session-runtime.ts:60-63` `discard()` = `queue.length=0` 후 `end()`. `markAborted` 가 `frame.end()` → **`deliveryFrame.discard()`** 로 바뀌었다(`:509-521`). 프로브로 확정 → **F1** |
| **잘못된 성공(false success)** | 있음 — 취소 턴의 `telemetry` 가 버스에 못 올라가 **사용량/비용 집계가 조용히 누락**될 수 있다 | `[telemetry, error]` 는 A 배치화로 **같은 배치**에 들어오므로(AC1), 취소가 그 배치를 discard 하면 usage 구독자(`bootstrap.ts` 파이프라인 1번)가 그 턴을 못 본다. 실패가 아니라 "정상 종료" 로 보인다 → **F1** |
| 되돌릴 수 있는가 | 예 — 마이그레이션·파일 쓰기·외부 상태 변경 없음. 전부 in-memory 라우팅 | DB 스키마 무변경, IPC 무변경(0165 범위 준수) |
| 설계가 의도한 것을 구현이 실제로 했는가 | **A·B·C 는 했고, 취소 의미론은 설계가 말하지 않은 것을 했다** | plan §A 는 "배치를 한 목적지로 보낸 **뒤** terminal 전이" 까지만 정의했다. `Frame.discard()` 와 "unframed 있으면 채널 격리" 는 r8 에서 **구현자가 새로 넣은 의미**다(plan 개정 이력에 자진 기재 ✅). 그중 `discard()` 는 아래 F1 |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **1건 넘었다** | 놓친 문제 #1 `Frame.discard()` + renderer `CANCEL_CHAT` error clear 는 **plan UX 표의 "부분 답변 존재 → 내용 보존"** 을 바꾼다 → `⚠️ 보고만` 이었어야 한다(AGENTS.md 선조치 경계 "제품 의도·인수 기준 변경"). #2·#3·#4 는 구현 세부라 ✅ 타당 |

### F1 — 취소가 **읽지 않은 이벤트를 통째로 버린다** (프로브로 확정)

`markAborted` 는 전달 중 프레임을 `discard()` 한다. `Frame.iterate()` 는 `done` 을 보기 전에 큐를
먼저 비우므로(`:70-87`) 구 `end()` 는 **적체분을 드레인**했지만, `discard()` 는 큐를 **먼저 비운다**.

프로브(실행 확인, verify 후 삭제):

```
취소 후 소비한 delta: ["A"]        # B·C 는 provider 가 이미 보냈고 프레임 큐에 있었다
```

- 사용자에게 보이는 효과: 중단 직전 **모델이 이미 생성한 부분 답변의 꼬리가 사라진다**(화면·DB 양쪽).
  plan §UX 표 "부분 답변 존재 → 내용 보존 + 작은 '중단됨' 표시" 와 어긋난다.
- 회계 효과: 같은 배치의 `telemetry` 도 함께 버려져 **그 턴의 usage/cost 가 집계되지 않는다.**
- **덜 비싼 대안이 있다**: 큐를 통째로 비울 필요 없이 취소 이후에는 `error` 만 라우팅에서 제외하거나
  (`routeBatch` 가 `cancelled` 를 보고 error 를 걸러냄), 프레임에 "취소됨" 플래그를 둬 **드레인은
  허용하되 새 error push 만 거부**하면 AC14 는 그대로 달성된다.

## 역방향 탐색 (매트릭스 전 선행)

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh bffa726..03ff691` (27 파일)

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export `chatStore.ts :: sessionBusy` | **오탐(정상)** | 정의 파일 내부에서 사용된다 — `chatStore.ts:944`(`useChatSessionsSync` 판정) · `:1278`(`useChatBusy`). 0143 계약 유지 확인 |
| 미사용 값 export `turn-coordinator.ts :: MAX_RETRIES` | **정상(선재)** | 이번 변경 이전부터 상수 export. 회귀 아님 |
| 타입 전용 `types.ts :: AdapterSubmissionOutcome` | **정상** | `LiveTurn.pushTurn` 시그니처(`types.ts:33`)와 `claude.ts:480-486` 반환에 사용. 0166 계약의 실체 |
| 타입 전용 `pending-message-queue.ts :: SubmissionAttempt` | **정상** | `commitMany`/`canCommitMany`/`selectAttempts` 시그니처에 사용(`:307-324, 572-586`) |
| 형제 파일 정책 비대칭 | **없음** | 스크립트 3) 절 "(없음)" |
| **스크립트 밖 추가 점검** — 인수 기준 동사가 테스트 파일에 있는가 | **다수 부재** | `channelToken` 은 **테스트에 0회 등장**(AC3·AC4) · `chat.postturn.step` 은 프로덕션 1곳뿐 테스트 0(AC15) · `orphanUnconfirmed(…, chainId)` 는 테스트가 전부 **인자 없이** 호출(AC11 스코프 미검증) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 — "r7 의 'unframed 를 다음 openFrame 앞에 합류' 전제는 사용자 프레임에 안전하지 않다" | **타당. 설계 결함을 구현이 잡았다** | 과거 자동 턴의 result 를 새 질문에 귀속시키는 경로가 실재했다(보고 ① 의 원인 경로와 동형). `openFrame(claimUnframed)` 분기 + `runAttempt` 의 `unframed.length>0 → teardownChannel` 수용 |
| 이견 — "배치가 Frame 에 원자 삽입된 뒤 취소가 끼어들 수 있어 Frame 에 discard 의미가 필요" | **문제 인식은 타당, 처방이 과하다** | → **F1**. 프레임 전체 폐기가 아니라 취소 후 `error` 배제로 좁혀야 한다 |
| 선조치 #1 `Frame.discard()` + renderer error clear | **경계 위반(✅ 아님 → ⚠️)** | 제품 의도(부분 답변 보존) 변경 → **D1** |
| 선조치 #2 backlog 격리·#3 `onChannelRetired`·#4 terminal backlog 즉시 종료 | **타당 ✅** | AC 밖이지만 방향이 설계와 일치. #2 는 respawn 비용이 붙으므로 **D2** 로 관측만 남긴다 |

## 요구사항 충족 매트릭스

> **테스트가 있는 기준만 ✅.** 코드 존재는 "구현됨"(⚠️)이지 "검증됨" 이 아니다.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 실패 result 두 이벤트가 같은 프레임 | ✅ | `session-runtime.test.ts:300` `'provider 실패 result의 terminal 복수 이벤트를 같은 프레임에 모두 배달한다'` |
| 2 | 취소 draining 중 배치 통째 드랍 + `hasUnframedBacklog` false | ✅ | `session-runtime.test.ts:281` + `:561` `expect(runtime.hasUnframedBacklog).toBe(false)` |
| 3 | **이전 세대(토큰) 배치 통째 폐기** | ❌ **미검증** | `routeBatch` 가드 구현됨(`session-runtime.ts:413-414`)이나 `channelToken` 이 테스트에 **0회** 등장 |
| 4 | 토큰은 **채널 화신 단위**(spawn/respawn 때만 발급) | ❌ **미검증** | `session-runtime.ts:307-308` 구현. 테스트 없음 |
| 5 | claude 어댑터 **한 SDK 메시지 = 한 배치** | ⚠️ 구현만 | `claude.ts:439-446` 구현. AC 가 지정한 `claude.eventbatches.test.ts` **파일 부재**, 대체 테스트 없음. (부수: `drainCompactSummaries()` 를 직전 메시지 배치에 합쳐 **한 배치 = 두 provider 메시지**가 되는 경우가 있다 → **D3**) |
| 6 | mock 도 배치 계약 + `consumeTurnScoped` 동일 경로 | ⚠️ 부분 | mock `eventBatches` 소비 테스트 ✅(`mock.test.ts:25,31,45,52,67,79`). `consumeTurnScoped` **배치 라우팅** 자체를 직접 겨눈 케이스는 없다(`session-runtime.test.ts:92` 는 폴백 상태 전이만) |
| 7 | 채널 교체 뒤 도착한 중단 영수증 무시 | ✅ | `session-runtime.test.ts:335` `'채널 교체 뒤 지각 도착한 interrupt 영수증은 …'` |
| 8 | 같은 세대 영수증은 그대로 반영 | ⚠️ 간접 | 부정 케이스만 명시. 긍정 경로는 `interrupt-reconcile.test.ts` 선재 스위트에 의존 — **이번 토큰 게이트 통과**를 겨눈 단언은 없다 |
| 9 | `SubmissionAttempt` 가 배치의 `messageIds` 전부 | ⚠️ 간접 | `selectAttempts` 가 `sameIds` 로 대조(`pending-message-queue.ts:583`), `:343` fence 테스트가 간접 커버. 병합 배치 전용 단언 없음 |
| 10 | `takeForRespawn` = ids 보존 + attemptId 재발급 | ✅ | `pending-message-queue.test.ts:379` — `ids` 동일 단언 + `uuid` 가 구 값 아님 단언 |
| 11 | 체인 종료 강등이 **`(attemptId, chainId)` 일치분만** | ❌ **미검증 + 설계 축소** | 구현은 **chainId 만**으로 스코프(`:379-392`) — 체인 단위 강등으로는 의미가 맞지만 AC 문구와 다르다. 게다가 테스트의 `orphanUnconfirmed` 호출이 **전부 인자 없음**(`:149,264,274,282,294,304,374,424`) → **스코프 자체가 한 번도 실행되지 않았다** |
| 12 | orphaned 도 지각 echo 로 확정 | ✅ | `pending-message-queue.test.ts:278,299` |
| 13 | `discardSubmitted` 가 **orphaned 도** 폐기 | ⚠️ 구현만 | 술어에 `orphaned` 포함(`:407`). discard 테스트 3건은 **orphaned 배치를 만들지 않는다**(`:313-341`) — 확장분 미실행 |
| 14 | **취소→재전송 프로덕션 경로에서 error 0건 / history error 파트 0건 / 반복 취소 동일** | ❌ **미검증** | `chat-turn.cancel-residue.test.ts` **파일 부재**. 보고 증상 ① 이 실제로 닫혔다는 **기계 증거가 없다** — 이 문서의 존재 이유에 해당하는 기준 |
| 15 | `chat.postturn.step` 판정 입력 5 + 개수 2 | ⚠️ 구현만 | `chat-turn.ts:1055-1065` 에 7필드 모두 존재 ✅. 테스트 0 |
| 16 | 실기 3단계 | ⏳ **사람 실기 대기** | GUI 필요 |

**집계 — ✅ 5 / ⚠️ 6 / ❌ 4 / ⏳ 1 (16건).** 구현 보고의 `게이트 결과`(1793/1793)는 사실과 일치하나,
그것은 **인수 기준 충족률이 아니다.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | lint 0 error(warning 1 = 0102 베이스라인) · typecheck 3/3 · vitest **198파일 1793/1793** · scripts 28/28 |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일:라인`) | 이견 시 중재 | 위 매트릭스 |
| 레이어 경계(eslint-boundaries) 위반 0 | ✅ | — | lint 0 error — 신규 포트 0·레이어 무변경 유지 ✅ |
| F1 재현 | ✅ **프로브 실행** | — | 미소비 delta 소실 확정 |
| 취소 UX(부분 답변 꼬리 손실 허용치) | ✖ 옵션 제시 | ✅ 결정 | **D1 — 사람 결정 대기** |
| UI/UX 시각 검증(AC16) | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | — | — | 신규 의존성 0 ✅ |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)        # useTranscriptVirtualizer — 0102 선재 베이스라인

$ npm run typecheck
typecheck:node / typecheck:web / typecheck:test  — 3/3 통과(무출력)

$ ./node_modules/.bin/vitest run          # pretest 우회(ABI 중립)
Test Files  198 passed (198)
     Tests  1793 passed (1793)

$ node --test "scripts/*.test.mjs"
# tests 28 · # pass 28 · # fail 0
```

> **환경 기인 실패 분리 불필요** — DB 로드 스위트 포함 전 스위트 green 이다(`better-sqlite3` Node ABI 정상).
> 즉 이번 판정은 "알려진 베이스라인 제외" 없이 **전량 green 위에서** 내려졌다.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계(내 책임)**: 인수 기준이 **테스트 파일명을 지정**했는데 구현이 다른 파일에 다른 이름으로
  넣으면 대조가 무너진다. r7 에서 "검증 수단이 실제로 성립하는가" 를 한 번 걸렀지만, 걸러야 했던 것은
  *존재 가능성* 이 아니라 **"그 기준을 겨눈 단언이 실제로 실행되는가"** 였다. AC11 이 전형이다 — 함수는
  있고 테스트도 있는데 **스코프 인자를 넘기는 호출이 한 건도 없다.** 또한 AC 문구(`(attemptId, chainId)`)
  가 구현의 옳은 형태(chainId 단위)보다 과하게 좁았다 — 설계가 fence(commit)와 강등(chain)의 단위를
  혼동했다.
- **구현 단계**: 선조치 경계 1건 위반(F1). 나머지 3건은 방향이 옳았고 **설계 결함(unframed 합류)을
  실제로 잡았다** — 그 점은 명확히 인정한다.
- **검증 단계 — 이번 verify 가 못 본 것**: ⓐ 실제 CLI/SDK 를 띄운 **엔드투엔드 취소→재전송**은
  기계 검증하지 못했다(AC14 는 코드 리딩 + 프로브 대리). ⓑ `drainCompactSummaries` 합류(D3)의
  실사용 빈도는 로그 없이는 모른다. ⓒ 배치 순서 역전·pump 재진입 같은 **실시간 레이스**는 프로브
  2건 외에 탐색하지 못했다.

> 새 실패 패턴 1건을 `handoff-plan/references/failure-patterns.md` 에 더한다 —
> **"인수 기준이 테스트 *파일명* 을 지정하면 구현이 이름을 바꾸는 순간 대조가 끊긴다. 파일명이 아니라
> *단언 대상 동작* 을 쓰고, verify 는 그 동작을 겨눈 호출이 실행되는지 grep 으로 확인한다."**

## [FAIL] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **F1 — 취소가 미소비 이벤트를 버리지 않게 좁힌다.** `Frame.discard()` 전량 폐기 대신
      (a) 취소 후 `error` 만 배제하거나 (b) 프레임에 `cancelled` 플래그를 둬 **드레인은 허용·신규
      error push 만 거부**한다. 회귀 테스트: *취소 시점에 큐에 있던 delta 는 전부 배달되고 error 만
      배달되지 않는다* + *취소 턴의 telemetry 가 버스에 도달한다*.
- [ ] **AC14** — `chat:send → chat:cancel → chat:send` 프로덕션 경로 테스트 신설(renderer error 이벤트
      0건 · history error 파트 0건 · 다음 턴 첫 delta 정상 · **반복 취소 3회**). 이 문서의 핵심 기준이다.
- [ ] **AC3·AC4** — `channelToken` 세대 검사와 화신 단위 발급을 겨눈 단언 추가.
- [ ] **AC11** — `orphanUnconfirmed(sessionId, chainId)` 를 **인자와 함께** 호출해 *다른 chainId 의
      배치는 강등되지 않는다* 를 단언.
- [ ] **AC13** — orphaned 배치를 만든 뒤 `discardSubmitted` 가 그것을 폐기하는지 단언.
- [ ] **AC5** — 어댑터 배치 계약 테스트(한 SDK 메시지 = 한 배치) 신설.
- [ ] **AC15** — `chat.postturn.step` 필드 7종 단언.
- [ ] (선택) **AC6** — `consumeTurnScoped` 배치 라우팅 직접 단언.

## 결론 / 다음 단계

**FAIL (r1).** 설계 A·B·C 의 **구조는 올바르게 들어왔고**(AC1·2·7·10·12 실측 green), 구현자가 설계
결함 1건(unframed 합류)을 잡아 고친 것은 이 라운드의 실질 성과다. 그러나 ⓐ 취소 의미론이 **부분 답변과
usage 를 잃는 방향으로** 넓어졌고(F1, 실행 확정), ⓑ **보고 증상 ① 이 닫혔다는 기계 증거(AC14)가 없다.**
16건 중 ❌ 4 · ⚠️ 6.

다음 = **구현자**(라운드 2). 파생 이슈는 plan 의 `[검증자 기입]` 챕터로 이관했다.
