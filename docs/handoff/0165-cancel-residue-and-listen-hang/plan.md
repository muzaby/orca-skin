# Plan — 0165-cancel-residue-and-listen-hang

## 메타

| 항목 | 값 |
|---|---|
| slug | `0165-cancel-residue-and-listen-hang` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 |
| 매핑 | PHASES 행 (verify PASS 후 승격) / PR 없음 |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "첫 취소에서 orca ui에서는 어시스턴트의 **에러 메시지 버블 노출**. 이후 delta 도착 시작하자, 에러 메시지 버블 삭제후 delta 출력 시작" | 라이브 세션 요청 (2026-08-04) + 첨부 `orcacancelresendanalysis.md` §1 |
| 명시 요구 ② | "마지막 어시스턴트 답변 이후 **inflight 애니메이션 지속** + 패널스택에서 **'중단했지만 대기 중인 메시지가 남아 있습니다'** 표기" | 라이브 세션 요청 + 첨부 `orcacancelresendanalysis.md` §2 |
| 추론 의도 | 두 현상 모두 **결함**이며 원인 규명 + 수정을 원한다 (추론 — 첨부 문서가 "원인 분석·조치는 포함하지 않는다" 라고 명시했고, 사용자가 그 문서를 근거로 두 현상을 다시 지목했다) | 첨부 문서 머리말 |
| 추론 의도 | 첨부 문서의 "대응 레코드 없음" 4건은 *로그가 부족하다* 는 요구가 아니라 *UI 현상의 출처를 코드에서 찾으라* 는 요구다 (추론) | — |

## Context (왜)

실기 세션 `8f6ad70c`(2026-08-03 02:11:29~02:12:20Z, 앱 `0.3.1`)에서 **턴 취소 → 재전송** 을
반복하자 세 가지가 어긋났다.

1. 취소한 턴이 **에러가 아닌데 에러 버블**로 표시되고, 그 버블이 **다음 턴** 위에 뜬다.
2. 마지막 답변 뒤 **inflight(작업 중) 애니메이션이 영구 지속**된다 — 사용자가 다음 메시지를
   보내기 전까지 앱이 계속 "응답 중" 으로 보인다.
3. **"중단했지만 대기 중인 메시지가 남아 있습니다"** 경고가 뜨고 **해제되지 않는다**.

세 현상은 전부 **취소가 남긴 잔여물**에서 나온다(아래 §자료조사에서 코드로 확정). 로그에
`error`/`warn` 이 0건인 것도 그래서다 — 셋 다 예외가 아니라 *정상 경로의 오판*이다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 (`파일:라인`) |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **전제 정정** — 사용자는 세 현상을 별개로 보고했으나 ②-a(inflight 고착)와 ②-b(잔여 경고)는 **원인이 다르다**. ②-a 는 ①과 같은 뿌리(취소가 예약을 미확정으로 남김)에서, ②-b 는 **지각 도착한 interrupt 영수증**에서 나온다. 원인별로 3개 결함(D1·D2·D3)으로 갈라 고친다. | D1 `app/src/main/adapters/claude-map.ts:474-486` · D2 `app/src/main/app/chat-turn.ts:901,939,951` · D3 `app/src/main/features/sessions/session-runtime.ts:485-504` |
| 이미 있는 것 아닌가 (기존 코드로 충족되나) | **부분적으로 있다 — 그래서 더 위험했다.** "의도적 중단은 에러가 아니다" 는 결정이 **어댑터 예외 경로에만** 구현돼 있고(`claude.ts:445-447` 주석 "설계 결정 3"), **result 메시지 경로에는 없다**. 같은 결정을 두 경로 중 한 곳에만 적용한 누락이다. | `app/src/main/adapters/claude.ts:445-456` ↔ `claude-map.ts:474-486` |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **된다.** 세 수정 모두 기존 자료구조(`MapContext`·`PendingMessageQueue`·`residualBySession`)에 필드/호출을 더하는 수준이고, 신규 모듈 0개·IPC 채널 변경 0건·스키마 변경 0건이다. 프레임 모델(`isTerminal`) 변경 같은 구조 수술은 **의도적으로 피했다** — §범위의 미룬 항목 참조. | §설계 |
| 인용 자료가 요구를 부풀리지 않았나 | **첨부 문서는 정확하다.** 다만 §4 "delta 도착 개시 시점 — 대응 레코드 없음" 은 결함이 아니다(델타는 설계상 미기록 — `observability.md` prod info 카탈로그 원칙). 그리고 §2-1 은 마지막 `listen:true` 턴의 종료 레코드 부재를 "로그 종료" 로 적었는데, **실제로는 그 턴이 끝나지 않은 것**이다(아래 F4). 문서의 관측은 맞고 해석 여지만 열려 있었다. | `docs/arch/backend/observability.md` · 첨부 §2-1 |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다.** 0154 의 "미확정 예약은 폐기하지 않고 기다린다" 를 그대로 유지한 채, *기다리는 방식*(무한 listen → 상한 있는 유예)과 *취소로 끝난 체인의 처리*(방치 → orphaned 강등)만 정한다. orphaned 는 0154 가 이미 "지각 confirm 으로 확정 가능" 하게 만들어둔 상태라 **손실이 없다**. | `pending-message-queue.ts:294-305`(orphanUnconfirmed 주석) · `confirm` 의 `open` 술어 `:250` |

- **사용자에게 올릴 것**(단독 결정 불가): **유예 상한 값(3초)** 은 제품 감각이 섞인 파라미터다.
  근거는 §설계 F4 에 적었으나, 실기에서 짧다고 느끼면 사용자가 조정할 값이다(되돌리기 쉬움 —
  상수 1개). 그 외 단독 결정 금지 항목은 없다.

## 자료조사 (Research)

> 아래 수치·전이는 전부 **이번 세션에서 직접 측정**했다(승계 0건). SDK 는 `app/node_modules`
> 를 `npm ci` 로 설치해 `sdk.d.ts` 원문을 대조했다(설치 전 "조사 불가" 로 적지 않았다 — P12).

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **SDK 결과 메시지는 취소도 `error` subtype 으로 돌려준다.** `SDKResultError.subtype ∈ {error_during_execution, error_max_turns, error_max_budget_usd, error_max_structured_output_retries}` (4멤버 전수). 해설 미러가 `error_during_execution` 을 "오류가 루프를 중단했습니다(예: API 실패 또는 **취소된 요청**)" 로 명시. | `app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:4269-4288` (설치본 `0.3.220`) · `docs/spec/claude/agent-sdk/agent-loop.md:274` |
| **매퍼가 그 result 를 `[telemetry, error]` 2건으로 분해한다** — `is_error===true \|\| subtype!=='success'` 면 무조건 error 를 덧붙인다. 취소를 구분하는 분기가 없다. | `app/src/main/adapters/claude-map.ts:474-486` |
| `SDKResultError.terminal_reason?: TerminalReason` 에 `aborted_streaming`·`aborted_tools` 가 있으나 **optional(미지정 가능)** 이다 — 이 필드로 취소를 판정하면 미지정 CLI 에서 fail-open 된다. 그래서 **앱 자신의 중단 사실**을 권위로 쓴다(§설계 F1). | `sdk.d.ts:4282`, `:6909` (TerminalReason 19멤버) |
| **취소 시 프레임은 drain 으로 끊긴다** — `markAborted` 가 `frame.end()` + `draining=true`. draining 중 이벤트는 **첫 terminal 까지** 드랍된다. | `session-runtime.ts:485-504`, `routeEvent` `:354-380` |
| **그래서 `[telemetry, error]` 의 두 번째가 샌다**: `telemetry`(terminal)가 draining 을 끝내고(`:360-366`), 바로 뒤 `error` 는 `draining=false` + `frame===null` 이라 **`unframed` 로 버퍼링**된다(`:378`). 다음 턴의 `openFrame()` 이 unframed 를 **새 프레임 앞에 합류**시킨다(`:328-335`) → 취소한 턴의 에러가 **다음 턴 버블**로 뜬다. | `session-runtime.ts:328-335, 354-380` |
| **"첫 취소에서만" 인 이유도 이 경로가 설명한다**: `teardownChannel()` 이 `unframed` 를 비운다(`:446`). 실기 로그의 2·3번째 취소는 직후 forced teardown+respawn(02:12:02.652 / 02:12:06.989)이 있어 샌 에러가 폐기됐고, 첫 취소만 teardown 없이 다음 턴으로 이어졌다. | `session-runtime.ts:439-451` · 첨부 §3 표 |
| **renderer 는 그 `error` 이벤트로 라이브 배너를 띄우고, `BEGIN_TURN` 에서 지운다** — "delta 도착 시 삭제" 는 `shouldBeginTurn`(유휴 세션의 첫 활동 이벤트)이 `BEGIN_TURN` 을 걸어 `error: undefined` 로 리셋하기 때문이다. 보고 문장과 정확히 일치. | `chatReducer.ts:546-556`(error→state.error), `:297-309`(BEGIN_TURN), `chatStore.ts:238-262`(shouldBeginTurn) · `Exchange.tsx:64,77`(TurnErrorBanner) |
| 같은 `error` 이벤트는 **DB 에도 다음 턴 assistant 메시지의 error 파트로 영속**된다 — 재로드하면 답변 위에 에러 카드가 남는다(사용자 미보고 파생 피해). | `features/history/writer.ts:276-285` |
| **취소로 끝난 턴 체인은 예약을 `submitted` 인 채로 방치한다.** `orphanUnconfirmed` 호출점은 **전수 2곳**이며(`chat-turn.ts:939` break, `:951` listen) 둘 다 턴-후 루프 안이다. 루프 조건이 `!aborted` 라 취소·stall 로 끝난 체인은 **한 번도 도달하지 않는다**. | `chat-turn.ts:897,939,951` (`rg 'orphanUnconfirmed\|hasSubmitted' app/src` 결과 전수) |
| **그 잔재가 다음 턴 끝에서 무한 listen 을 연다.** `decidePostTurnStep` 은 `haveUnconfirmed` 만으로 `listen` 을 고르고(`post-turn.ts:57`), listen 턴은 **stall 미무장**(`turn-coordinator.ts:239-241`)이라 CLI 가 유휴면 **끝날 계기가 없다** — 프레임을 닫는 것은 ⓐ CLI terminal ⓑ 새 메시지의 `endListenFrame` ⓒ 취소, 셋뿐이다. | `post-turn.ts:41-62` · `chat-turn.ts:942-985` · `session-runtime.ts:419-427` |
| 실기 로그가 이 경로를 그대로 보여준다 — `1d5b5a35` listen 턴은 12,472ms 뒤 **사용자 입력으로만** 끝났고, `7374c1c9` listen 턴은 **끝나지 않았다**(종료 레코드 없는 턴 = 1건). | 첨부 §2-1 표 |
| **잔여 경고는 지각 영수증이 띄운다.** `interrupt()` 의 영수증은 비동기로 오고(`session-runtime.ts:491-494`) 도착 시점의 **현재 턴 delegate** 로 배달된다. 실기에서 02:12:04.142 의 interrupt 영수증이 **02:12:10.202** 에 도착했고, 그 사이 02:12:06.989 에 채널이 teardown+respawn 됐다 — 즉 **이미 죽은 서브프로세스의 큐**를 현재 큐와 대조해 잔여로 판정했다. | `session-runtime.ts:485-504` · `chat-turn.ts:794-819` · 첨부 §2-2 / §3 표 |
| respawn 이 `takeForRespawn` 으로 uuid 를 **보존한 채** 재주입하므로(`pending-message-queue.ts:371-390`) 교집합이 비지 않아 오탐이 성립한다. | `pending-message-queue.ts:371-390` · `interrupt-reconcile.ts:29-37` |
| **잔여 경고 해제 경로는 2곳뿐**이다 — ⓐ 이후 영수증이 `clear` ⓑ `chatDiscardSession`. 채널이 죽어 CLI 큐가 사라져도 경고는 남는다. | `chat-turn.ts:236-241`(주석이 해제 지점 2곳을 명시), `:806-818`, `:1109-1127` |
| 게이트 기준선(수정 전, 이번 세션 실측): `npm run lint` = 0 error / **1 warning**(`react-hooks/incompatible-library` — 기존, 무관) · `npm run typecheck` = 0 · `npm test` = vitest **196 files / 1772 passed** + node:test **28 pass**. | 이번 세션 실행 |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 (`파일::케이스`) | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 앱이 중단한 턴의 `result{subtype:'error_during_execution', is_error:true}` 는 **`telemetry` 1건만** 산출한다(이벤트 총 1건, `error` 0건) | `app/src/main/adapters/claude-map.test.ts::"중단한 턴의 error result 는 telemetry 만 낸다"` | `SessionRuntime.markAborted` → `LiveTurn.interrupt`(`claude.ts`) → CLI result → `claudeToNormalized` |
| 2 | 그 `telemetry` 는 usage(`inputTokens`/`costUsd` 등)를 **그대로 싣는다** — 중단해도 비용 원장이 비지 않는다 | `claude-map.test.ts::"중단한 턴의 telemetry 는 usage 를 유지한다"` | 동 AC1 → `features/usage` 버스 구독 |
| 3 | 중단 표식은 **result 1건에만** 적용된다 — 같은 채널에서 그 다음에 오는 error result 는 `[telemetry, error]` 2건을 낸다 | `claude-map.test.ts::"중단 표식은 다음 result 로 이월되지 않는다"` | 장수명 채널의 연속 턴(`pushTurn`) |
| 4 | 중단 없이 도착한 error result 는 종전대로 `[telemetry, error]` 2건을 낸다 (미표식 = 기본 동작) | `claude-map.test.ts::"result 실패는 telemetry + error 를 낸다"` (기존 케이스 유지) | 실제 API 실패 턴 |
| 5 | 어댑터의 `LiveTurn.interrupt()` 호출이 매퍼 컨텍스트에 중단 표식을 세워, **어댑터 스트림 밖에서 조립하지 않고도** AC1 이 성립한다 (배선 검증) | `app/src/main/adapters/claude.interrupt.test.ts::"interrupt 후 도착한 error result 는 error 이벤트를 내지 않는다"` | `chat:cancel` → `abortTurn` → `SessionRuntime.markAborted` → `live.interrupt()` |
| 6 | `LiveTurn.pushTurn()`(다음 턴 시작)은 미소진 중단 표식을 **해제**해, 다음 턴의 실제 실패가 삼켜지지 않는다 | `claude.interrupt.test.ts::"pushTurn 이 미소진 중단 표식을 지운다"` | 취소 직후 같은 채널로 재전송하는 흐름 |
| 7 | 턴 체인이 **취소로 끝나도** 그 세션의 미확정(`submitted`) 예약이 `orphaned` 로 강등된다 | `app/src/main/app/chat-turn.cancel-residue.test.ts::"취소로 끝난 턴 체인도 미확정 예약을 강등한다"` | `chat:cancel` → `abortTurn` → `handleChatSend` 의 `finally` |
| 8 | 강등 후에도 **지각 echo 가 그 배치를 확정**한다 — 강등이 커밋을 잃게 하지 않는다 | `app/src/main/features/chat/pending-message-queue.test.ts::"orphaned 배치도 지각 echo 로 확정된다"` (기존 AC7 케이스 유지) | 취소 후 CLI 가 큐 잔여를 뒤늦게 픽업하는 흐름 |
| 9 | `isUnconfirmedGraceListen` 은 **미확정 유예만으로 연 listen**(held 없음·백그라운드 태스크 없음·채널 생존)에서만 `true` 다 — held 있음 / 태스크 있음 / 채널 사망은 각각 `false` | `app/src/main/features/chat/post-turn.test.ts::"유예 전용 listen 판정"` | `chat-turn.ts` 턴-후 루프의 listen 분기 |
| 10 | 유예 전용 listen 은 `UNCONFIRMED_GRACE_MS` 경과 시 `runtime.endListenFrame()` 을 호출해 **프레임을 닫는다** | `chat-turn.cancel-residue.test.ts::"유예 전용 listen 은 상한 뒤 프레임을 닫는다"` | 답변 완료 후 턴-후 루프 → listen 턴 |
| 11 | 백그라운드 태스크 대기로 연 listen 에는 **상한 타이머를 걸지 않는다**(0143 대기 UX 보존) — `endListenFrame` 이 호출되지 않는다 | `chat-turn.cancel-residue.test.ts::"태스크 대기 listen 에는 상한을 걸지 않는다"` | 서브에이전트 백그라운드 실행 세션 |
| 12 | 중단 영수증이 **채널이 바뀐 뒤** 도착하면 `onInterruptReceipt` 로 배달되지 않는다 (죽은 큐로 잔여를 판정하지 않는다) | `app/src/main/features/sessions/session-runtime.test.ts::"채널이 교체된 뒤 도착한 중단 영수증은 폐기된다"` | `markAborted` → `live.interrupt()` promise → `delegate.onInterruptReceipt` |
| 13 | 같은 채널이 유지된 채 도착한 영수증은 **종전대로 배달**된다 (AC12 가 정상 경로를 막지 않는다) | `session-runtime.test.ts::"같은 채널의 중단 영수증은 그대로 배달된다"` | 동 AC12 |
| 14 | 채널이 respawn/teardown 되면 그 세션의 잔여 경고가 **해제된다** — renderer 로 `chat.residual{count:0}` 이 나간다 | `chat-turn.cancel-residue.test.ts::"채널 teardown 이 잔여 경고를 해제한다"` | `chat:send` 의 respawn 판정(`decideRespawn`) → `teardownChannel` |
| 15 | 잔여가 없던 세션의 teardown 은 `chat.residual` 을 **보내지 않는다**(무의미한 이벤트 소음 0) | `chat-turn.cancel-residue.test.ts::"잔여가 없으면 teardown 이 이벤트를 내지 않는다"` | 동 AC14 |
| 16 | 실기 재현: 답변 → 취소 → 재전송에서 ⓐ 에러 버블이 뜨지 않고 ⓑ 마지막 답변 후 inflight 애니메이션이 3초 안에 멈춘다 | **사람 실기 — 실행 경로**: `cd app && npm run dev` → 채팅 전송 → 응답 중 중단 버튼 → 재전송 → transcript 에 에러 배너 부재 확인 → 답변 완료 후 StatusLine 애니메이션 정지 확인 (범위 안: renderer·main 모두 이 작업 대상) | 앱 전체 |

## 범위 / 비범위

- **범위**: main 프로세스의 ⓐ claude 어댑터/매퍼 중단 표식(D1) ⓑ 턴 체인 종료 시 예약 강등 +
  유예 listen 상한(D2) ⓒ 중단 영수증 채널 정합 + 잔여 경고 해제(D3). 관련 단위 테스트.
- **비범위**:
  - **에러 result 일반의 프레임 이탈**(취소가 아닌 실제 API 실패도 `error` 가 `unframed` 로 새어
    다음 턴에 붙는다 — §자료조사 3~4행). 고치려면 "한 SDK 메시지가 terminal 을 2개 낸다" 는
    프레임 모델 전제를 바꿔야 한다(`isTerminal` 에서 `error` 제외 또는 메시지 단위 라우팅).
  - renderer 표시 계층(`TurnErrorBanner`·`Composer` 잔여 Notice) 변경 — 이번 결함은 전부 main
    측 이벤트 산출이 원인이라 표시 계층은 손대지 않는다.
  - 첨부 문서 §4 의 "delta 개시 미기록"·"3.499초 무이벤트 구간" — 로깅 카탈로그 설계 사안.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 에러 result 일반의 프레임 이탈 | **아니오 — 되돌릴 수 있음.** 내부 이벤트 라우팅 버그이며 이름·식별자·스키마·IPC 계약이 걸리지 않는다(공개 표면 0). 다만 프레임 모델 불변식을 바꾸는 변경이라 자체 인수 기준·회귀 테스트가 필요해 **독립 핸드오프가 맞다**. 이번 D1 이 취소 경로를 막으면 실사용 노출 빈도는 실패 턴으로 한정된다. |
| 유예 상한 값(3초)의 제품 튜닝 | **아니오** — 상수 1개(`UNCONFIRMED_GRACE_MS`), 저장·전송되지 않음. |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `MapContext`(claude-map) · `PendingMessageQueue.orphanUnconfirmed/confirm` ·
  `SessionRuntime.endListenFrame/markAborted` · `decidePostTurnStep`(post-turn) ·
  `residualBySession`(chat-turn) · `sendChatEvent`.
- 전제 1: `claudeToNormalized` 의 `ctx` 는 **채널(spawn) 단위로 살아 있고** 어댑터의 `LiveTurn`
  클로저와 같은 스코프다 → `interrupt()`/`pushTurn()` 에서 같은 객체를 쓴다.
  근거 `claude.ts:437-455`(events 가 ctx 참조) · `:468-480`(pushTurn 이 같은 스코프).
- 전제 2: `orphaned` 배치는 여전히 확정 가능하다(`confirm` 의 `open` 술어가 orphaned 포함) —
  근거 `pending-message-queue.ts:250`. 이 전제가 깨지면 AC8 이 실패한다.
- **신규 의존성: 없음.**

## 설계

### D1 — 중단한 턴의 result 를 에러로 만들지 않는다

- `MapContext` 에 `interruptedPendingResult?: boolean` 을 더한다(선택 필드, **미지정 = 기존
  동작**이라 기본이 fail-safe 다 — 표식이 없으면 종전대로 error 를 낸다).
- `claude-map.ts` result 분기: 표식을 **읽고 즉시 소진**(`false` 로 되돌림)한 뒤, 표식이 섰던
  경우에만 error push 를 건너뛴다. `telemetry` 는 항상 낸다(AC2 — 중단 턴도 usage·비용이 있다).
- `claude.ts` 의 `LiveTurn.interrupt()` 가 `handle.interrupt()` **호출 전에** 표식을 세운다
  (영수증 await 뒤에 세우면 그 사이 도착한 result 를 놓친다).
- `claude.ts` 의 `LiveTurn.pushTurn()` 이 표식을 지운다 — 중단했는데 result 가 오지 않은 채
  다음 턴이 열리는 경로에서 표식이 남아 **다음 턴의 진짜 실패를 삼키는 것**을 막는다(AC6).
- `terminal_reason` 은 **읽지 않는다** — optional 이라 미지정 CLI 에서 판정이 무너진다(§자료조사).
  앱이 스스로 부른 `interrupt()` 가 더 권위 있는 신호다.

### D2 — 취소가 남긴 미확정 예약 + 끝나지 않는 유예 listen

- **F3(강등)**: `handleChatSend` 의 턴 체인 `finally` 에서 `pendingMessages.orphanUnconfirmed(sid)`
  를 호출한다. 정상 종료(break)는 이미 강등하므로 **멱등**이고, 취소·stall·throw 로 끝난 체인만
  실효가 있다. 0154 의 "폐기하지 않는다" 는 유지된다 — orphaned 는 지각 echo 로 확정 가능(AC8).
- **F4(유예 상한)**: `post-turn.ts` 에 순수 술어 `isUnconfirmedGraceListen(s: PostTurnState)`
  = `channelAlive && !havePending && !haveTasks && haveUnconfirmed` 와 상수
  `UNCONFIRMED_GRACE_MS = 3_000`(**단위 = 밀리초, 이름에 명시**)을 둔다. `decidePostTurnStep` 의
  분기 구조와 1:1 로 대응하는 여집합이라 두 함수가 어긋날 수 없다.
  `chat-turn.ts` listen 분기는 이 술어가 참일 때만 `setTimeout(() => runtime.endListenFrame(), …)`
  을 걸고 `finally` 에서 해제한다. `endListenFrame` 은 **CLI 가 자동 턴 진행 중(cliBusy)이면
  no-op** 이라(0143 유예, `session-runtime.ts:422`) 진행 중인 CLI 턴을 자르지 않는다.
  3초 근거: 0154 가 관측한 지각 echo 는 "도구 호출 한 번을 통째로 건너뛴 뒤" 도착했고
  (`post-turn.ts:52-55`), 그 사이 CLI 는 `cliBusy` 라 상한이 발화해도 no-op 이다. 즉 상한은
  **CLI 가 완전히 유휴인데도 아무것도 오지 않는 경우**에만 실효하며, 그 상태에서 3초는 충분하다.

### D3 — 지각 영수증 / 해제되지 않는 잔여 경고

- **F5(채널 정합)**: `SessionRuntime.markAborted` 가 `interrupt()` 를 부를 때의 `this.live` 를
  캡처하고, 영수증이 resolve 된 시점에 `this.live === captured` 일 때만 delegate 로 올린다.
  teardown/respawn 은 `this.live` 를 갈아치우므로(`:448-449`, `finishPump :406-407`) 죽은 큐의
  영수증이 구조적으로 걸러진다.
- **F6(해제)**: chat-turn 에 `clearResidual(sessionId, sender)` 를 두고 **채널이 죽는 전 지점**
  에서 부른다 — `teardownChannel()` 호출 **전수 3곳**(`:598` send respawn · `:956` listen
  continuation · `:999` flush continuation) + 채널 사망 이월 분기(`takeForRespawn` 직전). 잔여
  기록이 없으면 아무것도 보내지 않는다(AC15).

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `isUnconfirmedGraceListen` + `UNCONFIRMED_GRACE_MS` (`features/chat/post-turn.ts` 에 추가) | 유예 전용 listen 판정 + 상한 값 | main `features` (순수) | 순수 단위 — `post-turn.test.ts` |
| `clearResidual` (`app/chat-turn.ts` 내부 클로저) | 잔여 경고 해제 1지점 | main `app`(컴포지션 루트) | electron 의존 → **기존 harness seam**: `chat-turn.runtime-tools.test.ts` 방식(ipcMain·coordinator·post-turn mock)으로 신규 `chat-turn.cancel-residue.test.ts` 에서 핸들러를 직접 호출해 `sendChatEvent` 호출을 관측 |
| (신규 파일) `adapters/claude.interrupt.test.ts` | D1 배선 검증 | 테스트 | `vi.mock('@anthropic-ai/claude-agent-sdk')` — `claude.steer-replay.test.ts` 와 동형 |

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| "의도적 중단(턴 취소/계획 거부)은 에러가 아니므로 error 이벤트를 내지 않는다 — 설계 결정 3" | 코드 주석 `adapters/claude.ts:445-447` | §설계 D1 "중단한 턴의 result 를 에러로 만들지 않는다" | **유지·확장** — 같은 결정을 result 경로에도 적용(누락 보완) |
| 0154: "재주입도 폐기도 답이 아니고 옳은 것은 **기다리는 것**" / "orphaned 는 폐기 대상이 아니다" | 코드 주석 `chat-turn.ts:920-936` · `pending-message-queue.ts:294-305` | §설계 D2 F3 "폐기하지 않는다는 유지된다 — orphaned 는 지각 echo 로 확정 가능" | **유지** — 강등은 폐기가 아니다 |
| 0154: 미확정 유예는 "1라운드로 묶는다 — 무한 대기 불가" | 코드 주석 `post-turn.ts:57-62` · `chat-turn.ts:949-953` | §설계 D2 F4 | **유지·보강** — 라운드는 1회였으나 *그 1회의 길이*가 무한이었다. 상한이 원 의도를 완성한다 |
| 0143: listen 대기(백그라운드 서브에이전트)는 사용자 관점 "작업 중" — inflight 애니메이션 지속 | 코드 주석 `ChatTile.tsx:51-53` · `chatReducer.ts:92-96` | §설계 D2 F4 의 "백그라운드 태스크 대기 listen 에는 상한을 걸지 않는다"(AC11) | **유지** — 상한은 유예 전용 listen 에만 |
| 0136: listen 프레임 릴리즈 밸브는 CLI 자동 턴 진행 중이면 no-op | 코드 주석 `session-runtime.ts:416-418` | §설계 D2 F4 "cliBusy 면 no-op 이라 진행 중인 CLI 턴을 자르지 않는다" | **유지** — 같은 밸브를 그대로 쓴다 |
| 0151: 잔여 uuid 는 "교집합만" / 처분은 사용자 선택(세션 전체 중단) | 코드 주석 `interrupt-reconcile.ts:1-16` · `chat-turn.ts:753-767` | §설계 D3 F5·F6 | **유지** — 판정 규칙·사용자 선택지는 그대로, *영수증의 유효 범위*와 *해제 시점*만 정한다 |
| main 레이어 DAG: `app` → `features` → `adapters` → `infra` → `shared`, feature 교차 import 금지 | `app/eslint.config.mjs` (boundaries) · `app/src/main/AGENTS.md` | §설계의 배치(순수 술어는 `features/chat`, 잔여 해제는 `app`) | **준수** — 신규 import 방향은 `app → features` 1건뿐 |
| IPC 채널·이벤트 variant 변경 시 `IPC_CONTRACT.md` 동시 갱신 | `docs/AGENTS.md` · `docs/IPC_CONTRACT.md §6` | §범위 "IPC 채널 변경 0건" | **해당 없음** — 채널·variant 모두 무변경(`chat.residual` 은 기존 variant) |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **취소 직후 즉시 재전송**: D1 표식이 result 로 소진되기 전에 `pushTurn` 이 오면 표식이 해제된다
  (AC6) — 다음 턴의 진짜 실패가 삼켜지지 않는다. 반대로 result 가 먼저 오면 표식이 소진된다.
- **중단했는데 result 가 영영 안 오는 경우**(채널 사망): `finishPump` 가 `live=null` 로 만들고
  다음 send 는 콜드 spawn 이라 `ctx` 자체가 새로 만들어진다 — 표식이 이월될 통로가 없다.
- **취소 + 백그라운드 태스크 동시 존재**: 취소로 끝난 체인은 예약을 강등하지만 태스크 추적은
  건드리지 않는다. 다음 턴 후에도 `haveTasks` 로 listen 이 열리고 **상한은 걸리지 않는다**(AC11).
- **잔여 경고 표시 중 세션 전체 중단**: 기존 `chatDiscardSession` 경로 그대로. F6 의 해제와
  중복 호출돼도 `chat.residual{count:0}` 은 renderer 에서 멱등(같은 값이면 상태 미변경 —
  `chatStore.ts:476-483`).
- **창 종료/renderer 소멸 중 상한 타이머 발화**: `finally` 에서 `clearTimeout` 하고, 발화해도
  `endListenFrame` 은 프레임이 없으면 no-op 이다(`session-runtime.ts:420`).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| D1 표식이 **엉뚱한 result 를 삼킬** 수 있다(중단 직후 도착한, 중단과 무관한 실패 result) | 표식은 **1회 소진** + `pushTurn` 해제. 두 경로 모두 AC(3·6)로 잠근다. 최악의 경우에도 잃는 것은 *중단 직후 1건의 에러 표시*이고, telemetry·로그(`chat.turn.cancelled`)는 남는다 |
| F4 상한이 **지각 echo 를 라이브로 못 받게** 만들 수 있다 | 상한은 `cliBusy` 면 no-op 이므로 CLI 가 그 메시지를 처리 중이면 발화하지 않는다. 완전 유휴 상태에서 닫아도 배치는 CLI 큐에 남고(0154) 다음 턴 프레임의 unframed 합류로 배달된다 |
| F5 가 **정상 영수증까지 막을** 수 있다(빠른 respawn 경합) | 정상 경로 AC13 으로 양성 단언. respawn 이 끼어든 영수증은 애초에 죽은 큐를 가리키므로 버리는 것이 옳다 |
| 유예 상한 3초가 실기 감각과 안 맞을 수 있다 | 상수 1개로 분리 + §요구 비판적 검토에서 사용자 조정 항목으로 표기 |

- 되돌리기 어려운 결정: 없음(공개 계약·스키마·식별자 무변경).
- **단독 결정 금지 항목(Open Question)**: 없음. (상한 값은 조정 가능한 튜닝 파라미터로 분류)

## 영향 받는 파일

- `app/src/main/adapters/claude-map.ts` (MapContext + result 분기)
- `app/src/main/adapters/claude.ts` (interrupt/pushTurn 표식)
- `app/src/main/features/chat/post-turn.ts` (순수 술어 + 상수)
- `app/src/main/app/chat-turn.ts` (finally 강등 · 유예 상한 타이머 · clearResidual)
- `app/src/main/features/sessions/session-runtime.ts` (영수증 채널 정합)
- 테스트: `adapters/claude-map.test.ts` · `adapters/claude.interrupt.test.ts`(신규) ·
  `features/chat/post-turn.test.ts` · `features/sessions/session-runtime.test.ts` ·
  `app/chat-turn.cancel-residue.test.ts`(신규)

## 참고 문서

- `docs/arch/backend/adapters.md` (어댑터 내부 구현·정규화)
- `docs/arch/backend/observability.md` (로그 카탈로그 — 이번 변경은 신규 로그 이벤트 0건)
- `docs/handoff/0154-steer-premature-orphan-cancel/plan.md` (미확정 예약 유예의 원 설계)
- `docs/handoff/0151-steer-queue-state-machine/plan.md` (영수증·잔여 정책)
- IPC 변경: **없음** (`docs/IPC_CONTRACT.md` 무변경)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: 어댑터 정규화(claude-map 3건 + claude 배선 2건) · 순수 판정(post-turn 1건) ·
  런타임 영수증(session-runtime 2건) · 컴포지션 루트 배선(chat-turn 5건).
- 기준선(수정 전 실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · test vitest **1772 passed(196 files)** + node:test **28 pass**.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 2문장을 그대로 인용, 추론은 "추론" 으로 표기
- [x] 자료조사 — 발견 15행 전부 `파일:라인` 또는 `sdk.d.ts` 라인 레퍼런스
- [x] 의존 기술 — 전제 2건 명시, 신규 의존성 0
- [x] 파생 UX — 취소/재전송/채널 사망/창 종료 등 이 작업에 실제로 해당하는 것만 5건
- [x] 리스크 — 4건 + 완화책, Open Question 0건(튜닝 파라미터는 분리 표기)

**기계적으로 확인 가능한 것**:

- [x] 요구 비판적 검토 5질문 답변 — 전제를 1건 정정(②를 원인별 2결함으로 분리)했고 **요구 범위는 줄이지 않았다**(보고 3현상 전부 범위 안)
- [x] `검증 수단` 칸 공란 0 — 16개 AC 중 15개가 `파일::케이스`, AC16 만 "사람 실기 + 실행 경로"
- [x] 부정형/"불변" 기준 0개 — AC4·AC8·AC11·AC13 은 "종전대로 …를 낸다/확정한다/호출되지 않는다" 로 **관측 가능한 양성 단언**으로 작성
- [x] AC 간 모순 없음 — 짝지어 확인: AC1↔AC4(표식 유무로 갈림) · AC10↔AC11(유예 전용 vs 태스크 대기, AC9 술어가 경계) · AC7↔AC8(강등 후에도 확정 가능) · AC14↔AC15(잔여 유무로 갈림)
- [x] 인용 수치 직접 측정 — SDK subtype 4멤버·TerminalReason 19멤버는 설치본 `sdk.d.ts` 에서, `orphanUnconfirmed` 호출점 2곳·`teardownChannel` 호출점 3곳은 `rg` 전수, 게이트 기준선(vitest 1772 passed / 196 files + node:test 28)은 이번 세션 실행
- [x] 신규 모듈 테스트 방법 — 순수 술어는 순수 단위, electron 의존(chat-turn)은 **기존 harness seam**(ipcMain mock + 핸들러 직접 호출) 명시
- [x] 전수 조사 N — `orphanUnconfirmed`/`hasSubmitted` 호출점 **2곳**, `teardownChannel()` 호출점 **3곳**, SDK result subtype **4멤버**, `TerminalReason` **19멤버**
- [x] 각 AC 에 프로덕션 도달 경로 — 유일한 호출자가 테스트인 AC 0개(AC5·AC10·AC14 는 IPC 핸들러 → 런타임 경로를 명시)
- [x] "사람 실기" AC(16)에 실행 경로(`npm run dev` + 클릭 순서)가 있고, 그 경로가 비범위에 막혀 있지 않다(renderer 표시 변경은 안 하지만 **실행**은 가능)
- [x] 선택적 필드 미지정 케이스 AC — `interruptedPendingResult` 미지정 = 기존 동작을 AC4 가 잠근다. `terminal_reason` 은 optional 이라 **판정에 쓰지 않기로** 결정하고 근거를 §자료조사·§설계에 기록
- [x] 소비 계약의 제약 필드 강제 지점 — 표식의 소진(매퍼 result 분기)과 해제(`pushTurn`)를 **누가·언제** 로 §설계 D1 에 명시
- [x] 참조 구현 전수 커버리지 — SDK `SDKResultError.subtype` 4멤버 전부가 같은 분기(`subtype!=='success'`)를 타므로 표식 1개로 전수 커버(§자료조사 1행)
- [x] 미룬 항목 일방향 여부 — 2건 모두 "아니오" 로 답하고 근거 기재
- [x] 관문 4 를 본문 완성 후 실행 — 기존 결정 표 8행을 본문 문장 인용으로 채웠고, 인용 경로(`sdk.d.ts`·`docs/spec/claude/agent-sdk/agent-loop.md`·각 소스)를 실제로 열어 확인했으며, `[구현자 기입]`·`[검증자 기입]` 블록 존재
- [x] "확정돼 있다" 류 서술 — 이번 plan 은 문서 `§표제어` 를 근거로 삼지 않고 **코드 주석·`sdk.d.ts` 원문**만 인용했다(앵커 인용 0건)

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

- [ ] …

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | — | — | — |
