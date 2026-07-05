# Verify — 0067-long-lived-session-queue

## 메타

| 항목 | 값 |
|---|---|
| slug | `0067-long-lived-session-queue` |
| 검증자 | Claude Code |
| 일자 | 2026-07-05 |
| 대상 커밋 | W1 `d124c05` · W2 `f079945` · W3 `90d501b` · W4 `8afe764` · W5(docs) 본 커밋 |
| 라운드 | 1 |
| 상태 | **PASS (코드 검증 — 실기 wire 실측은 사람 확인 대기)** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

plan `[구현자 기입]` 선조치 ✅ 5건(신호 분리·draining respawn·interrupting 보존·respawn 폐기 규칙·이중 복원 방지)은 전부 코드+테스트로 확인. ⚠️ 1건(CLI 자동 픽업 자동 프레임 오픈 미배선)은 **비의존 설계**(orca 가 flush 소유·버퍼 무유실 합류)로 AC7 충족에 영향 없음 — wire 실측 후 필요 시 후속 라운드로 이관.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 장수명 세션 채널(턴 넘어 생존, 후속 턴 push) | ✅ | `claude.ts` result 미폐쇄+`pushTurn`, `session-runtime.ts` 채널 pump. 테스트 "후속 send 는 pushTurn 으로 이어붙인다 — spawn 1회" |
| 2 | 프레임 demux — 1 프레임=1 턴, coordinator 모델 보존 | ✅ | `session-runtime.ts` Frame/routeEvent(terminal 에서 프레임만 닫음), `TurnCoordinator.run` 시그니처 무변. 테스트 "terminal 에서 프레임만 닫고 채널 유지" |
| 3 | 취소=interrupt(채널 생존) + held 전량 취소 + draft 복원 | ✅ | `markAborted`(interrupt+draining), `chat-turn.ts` chatCancel(`cancelAllHeld`+`message.cancelled`), renderer `draftRestore`→Composer. 테스트 "markAborted=interrupt — 채널 생존", "message.cancelled 는 draftRestore 로 복원" |
| 4 | 거버넌스 — cap 5·LRU·IdleCloseTimer 폐기·종료 close | ✅ | `bootstrap.ts` `BoundedRuntimeCapPolicy`+capacity 5, `runtime-pool.ts` 타이머 제거(idle-close-timer 삭제), shutdown `closeIdleRuntimes` 기존 배선. 테스트 "idle 은 시간 경과로 회수되지 않는다". `ORCA_PERSISTENT_RUNTIME` 게이트 삭제 |
| 5 | 큐 완전 일원화 — 구조 페이로드·상태별 주입·chat:steer 흡수(54→53) | ✅ | `pending-message-queue.ts`(payload+flushItem/flushHeld/takeForRespawn), `chat-turn.ts` busy=예약/idle=즉시 flush/스폰 프렐류드, `CHANNELS` chatSteer 삭제. 큐 단위테스트 10종 |
| 6 | 커밋 = echo 단일 경로 | ✅ | `HistoryWriter.commitUserMessage`(구 send 선영속 2곳 삭제 — chat-turn resume block·session.updated persist), coordinator `commitConsumed`(배치 단위), 턴 첫 프롬프트 echo 매칭(promptUuid=item id). continuity 통합테스트가 [init→echo→telemetry→committed] 잠금 |
| 7 | 자동 연속 턴 — held 잔여 즉시 다음 턴 | ✅ | `chat-turn.ts` run 후 while 루프(채널 생존=flushHeld 병합 pushTurn / 사망=takeForRespawn 프렐류드+프롬프트), 취소 시 미발동(controller abort 가드). renderer 활동 이벤트 BEGIN_TURN 파생 테스트 |
| 8 | renderer pending-first + 이벤트 일반화 | ✅ | 모든 send 가 pending 항목으로 시작(`chatStore.send`), `message.queued/committed/cancelled` 처리, Composer 단일 submit(steer 분기 삭제), TranscriptView 유휴 pending 표시. store 테스트 7종(신규 busy send·cancelled 복원·자동 연속 inflight 포함) |
| 9 | clientKey — 세션-이전 큐 키 + init rekey | ✅ | `SendChatMessage.clientKey`(zod+타입), renderer draftKey 전달(send·startHandoff), `TurnContext.queueKey`, coordinator session.updated `rekey`. 큐 rekey 단위테스트 |
| 10 | admission 제거(0056 supersede) | ✅ | `admission-{controller,policy}.ts`+테스트 삭제, 새-채팅 슬롯 race 가드만 인라인. busy send=예약 |
| 11 | mock 턴-스코프 폴백 | ✅ | `session-runtime.ts` `pushTurn` 부재 시 `consumeTurnScoped`(구 동작 보존) — 기존 mock/coordinator 테스트 전부 green |
| 12 | 게이트 + 문서 | ✅ | lint 0 · typecheck(node/web/test) 0 · vitest **685/685 (88파일)** · build green · boundaries 0 · 신규 의존성 0. IPC_CONTRACT(총 53·chat 5·§3 variant 4종 개정)·src/main/AGENTS.md·INDEX·PHASES |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 green |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 12/12 |
| 레이어 경계 위반 0 | ✅ | — | lint 포함 0 |
| **실기 wire 실측(plan §리스크 1~4)** | ✖ 원격 환경 제약 | ✅ | **사람 확인 대기(1순위)**: ① 장수명 스트림 턴별 result 프레이밍 ② result 후 push→CLI 픽업(자동 연속) ③ interrupt 후 채널 생존·후속 push ④ 프로세스 5개 메모리 |
| 실기 UX 6종(승인 계획의 검증 절) | ✖ | ✅ | pending→committed 승격·도구 턴 steer·텍스트-only 자동 연속·취소 후 재사용·LRU 축출·재로드 정렬 |
| 앱 종료 held 버림 한계 수용 | ✖ 문서화 | ✅ | plan 비범위 명기 |
| PR 머지 | ✖ | ✅ | — |

## 게이트 재실행 결과

```
$ npm run lint        # 0 error
$ npm run typecheck   # node + web + test → 0 error
$ npx vitest run      # Test Files 88 passed, Tests 685 passed
$ npm run build       # tsc --noEmit && electron-vite build → exit 0
```

## PHASES.md 정합성

- 본 검증 커밋에서 표 행 승격.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 승인 계획이 "콜백 세션-레벨화"를 함정으로 선지목한 것이 유효했다 — 실제로 W1 최대 난점이었다. 반면 취소 신호/draining 상호작용은 설계에 없었고 구현 중 도출(선조치 3건).
- 구현 단계: CLI 자동 픽업 자동 프레임 오픈을 의도적으로 미배선(⚠️) — [I] 전제에 코드를 세우지 않는 원칙을 지켰으나, 실측에서 발생이 확인되면 이벤트 지연 표시가 생긴다(다음 프레임 합류까지).
- 검증 단계: 장수명 채널의 실기 E2E(멀티턴 단일 서브프로세스)는 단위/통합 테스트로 근사했을 뿐 — wire log 실측이 이번 검증의 최대 잔여 리스크다.

## 결론 / 다음 단계

**PASS(코드 검증).** 인수 12/12, 게이트 4종 green. INDEX PASS + PHASES 승격. 실기 wire 실측 4건 + UX 6종은 사람 확인 대기 — 실측에서 프레이밍/자동 연속이 어긋나면 라운드 2 로 루프백한다.
