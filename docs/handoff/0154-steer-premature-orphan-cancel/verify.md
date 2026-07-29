# Verify — 0154-steer-premature-orphan-cancel

## 메타

| 항목 | 값 |
|---|---|
| slug | `0154-steer-premature-orphan-cancel` |
| 검증자 | Claude Code |
| 일자 | 2026-07-29 |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 채널 생존 + held 없음 + 미확정 예약 → `listen` | ✅ | `post-turn.ts` — `PostTurnState.haveUnconfirmed` 추가, `if (s.haveUnconfirmed) return 'listen'` 을 `haveTasks` 판정 **앞**에 배치. `chat-turn.ts` 가 `pendingMessages.submittedUuids(sessionId).length > 0` 로 공급 |
| 2 | 유예는 배치당 1회 — 무한 대기 부재 | ✅ | `chat-turn.ts` — `if (step === 'listen' && haveUnconfirmed) pendingMessages.orphanUnconfirmed(sessionId)`. 강등 단조 + 술어가 `submitted` 만 셈. 테스트 "유예는 배치당 1회 — orphaned 강등 후 break 에 도달한다" |
| 3 | `break` 가 `message.cancelled` 를 보내지 않는다 | ✅ | `chat-turn.ts` break 분기 — `discardOrphaned`·`sendChatEvent(message.cancelled)` 제거, `orphanUnconfirmed` 결과를 `chat.steer.orphaned` 로 **로깅만**. `grep -rn "message.cancelled" src/main` → 3곳 전부 사용자 조작 경로(`:1073`·`:1095`·`:1110`) |
| 3b | orphaned 가 큐에 남아 커밋/이월된다 | ✅ | `pending-message-queue.test.ts` "orphaned 잔존 계약 (0154)" 2케이스 — ① `takeForRespawn` 이 이월 ② orphaned 인 채로도 늦은 echo 가 `confirm`→`drainConfirmed` |
| 4 | 기존 판정 8케이스 불변 | ✅ | `base` 에 `haveUnconfirmed: false` 만 추가, 기존 8케이스 그대로 pass |
| 5 | 회귀 0 · IPC 무변경 | ✅ | lint 0 error(warning 1 = 0102 베이스라인) · typecheck 0 error(3분할) · vitest **149 파일 / 1238 테스트 전량 pass** · `src/shared/ipc.ts` diff 0 · 신규 의존성 0 |

## 로그 ↔ 코드 대조 (원인 확정 — 추정 없음)

| 로그/실기 사실 | 코드 근거 | 결론 |
|---|---|---|
| `chat.steer.orphaned { count: 1 }` → `message.cancelled`, 사용자 조작 이벤트 0 | 그 로그 라인은 `break` 분기 한 곳에서만 나온다 | 발화 지점 확정 |
| `message.submitted` 3회가 각각 `tool.call.completed` 직후 | PostToolBatch 게이트(`takeSteerFlush`, origin=`steer`) | 확정 신호가 **echo 뿐** |
| flush #2 의 echo 가 Bash 호출 하나를 건너뛴 뒤 도착 | `streaming-input.ts:21-29`(pull ≠ 소비) | **echo 지연은 정상 동작** |
| 모델 reasoning 에 777 이후 부재 | — | 모델이 그 턴에 못 봤다 |
| **`?` 입력 시 777~11 답변이 먼저 나왔다** | `streaming-input.ts:35-38` — `priority:'next'` = idle 채널에서 **다음 턴 프롬프트로 픽업** | **메시지는 유실된 적 없다. CLI 가 배달했다** |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 0 error · 0 error · 1238/1238 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 5/5 |
| 원인 확정(로그 + 실기 대조) | ✅ | — | **확증** |
| **0151 OQ2 철회** | ✖ 단독 결정 금지 | ✅ **승인** | 사용자가 실측 증거로 전제 반증을 제시 |
| 증상 실제 해소 | ✖ 불가 | ✅ | 사람 실기 대기 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ npm run lint
✖ 1 problem (0 errors, 1 warning)   ← useTranscriptVirtualizer(0102 베이스라인)

$ npm run typecheck
0 errors (node/web/test 3분할 전부)

$ ELECTRON_OVERRIDE_DIST_PATH=<any> ./node_modules/.bin/vitest run
 Test Files  149 passed (149)
      Tests  1238 passed (1238)
```

## 위생 검토

- `AGENTS.md` 무변경 · IPC 무변경 · 신규 의존성 0 · 마이그레이션 0 · 신규 소스 파일 0.
- 제거: `PendingMessageQueue.discardOrphaned` + 해당 describe 블록(3케이스) → 대체 계약 2케이스. 순 테스트 수 1239→1238.
- 신규 로그 0 — `chat.steer.orphaned` 는 유지하되 의미가 "폐기했다" 에서 **"미확정으로 남겨둔다"** 로 바뀌었다.

## 검증 자기 리뷰 (무엇이 부족했나)

- **0151 설계의 미흡이 원인이다.** AC7 은 "미확정 배치를 관측 가능하게" 라는 옳은 목표를 세우고 **관측 가능 = 즉시 폐기**로 구현했다. `pending()` 이 held 만 센다는 사실과 `break` 판정이 그 값 하나에 의존한다는 사실 — 둘 다 0151 작업 중 내 눈앞에 있었는데 연결하지 못했다.
- **0151 verify 도 놓쳤다.** AC7 을 "orphaned 전이가 코드에 있다" 로만 대조하고 *언제 도달하는지* 를 묻지 않았다. 상태 전이의 존재와 그 전이가 **정당한 시점에** 일어나는지는 다른 질문이다.
- **OQ2 의 선택지 자체가 불완전했다.** 나는 두 상태("못 봤다"/"echo 유실")를 제시하고 사용자에게 고르게 했는데, `streaming-input.ts:35-38` 의 `priority:'next'` 계약이 이미 제3의 상태("곧 본다")를 명시하고 있었다. **선택지를 잘못 제시한 것은 설계자 책임이다** — 사용자는 주어진 두 개 중에서 합리적으로 골랐을 뿐이다.
- **1차 진단은 잘못된 로그 위에서 이뤄졌다.** 사용자 착오로 직전 리포트와 동일한 파일이 첨부됐고, 나는 그것을 대조로 잡아내 명시한 뒤 **소거법(발화 지점이 유일)** 으로만 원인을 좁혔다. 결과는 전부 맞았지만 이는 발화점이 하나였기에 가능했던 것이지 일반화할 방법이 아니다.
- **남은 한계**: 유예가 실제로 echo 를 잡아내는지는 실기로만 확정된다(listen 턴의 프레임 드레인은 컴포지션 루트 클로저 안 — 0153 D1 과 같은 뿌리).

## 결론 / 다음 단계

**PASS — 인수 5/5 충족.** 원인은 로그 + 실기(`?` 입력)로 **확증**됐다. 수정의 요지는 한 줄이다 — **CLI 에 넘긴 것은 CLI 가 배달한다. Orca 는 기다리면 되고, 지워서는 안 된다.**

### 파생 이슈

| # | 이슈 | 대응 방향 | 상태 |
|---|---|---|---|
| D1 | 폐기를 없애 미확정 배치가 세션 런타임 수명 동안 메모리에 남는다(첨부 base64 포함) — 0151 이 고쳤던 "GC 부재" 의 부분적 되돌림 | 의도한 트레이드오프(데이터 파괴보다 나음). 상한은 채널 사망·세션 폐기. 실사용에서 문제가 되면 첨부 payload 만 조기 해제하는 방향 | open |
| D2 | 턴-후 루프의 IPC 발화·프레임 드레인을 관측할 테스트 하네스 부재 | 0153 D1 과 같은 뿌리 — 루프를 주입 가능한 단위로 분리 시 함께 해소 | open |
| D3 | `chat.steer.orphaned` 의 의미가 바뀌었으나 이름은 그대로 | 로그 카탈로그 정리 시 `chat.steer.unconfirmed` 등으로 개명 검토 | open |

### 사람 확인 대기

1. **증상 해소 (1순위)** — 도구를 쓰는 답변 중 메시지를 연달아 보내고 마지막 도구 호출 직후 턴이 끝나게 한다. 예약 버블이 **자동 취소되지 않고** 다음 턴에서 정상 커밋되는가.
2. **렌더링 순서** — 그 뒤 새 메시지를 보냈을 때 잔여가 먼저, 신규가 뒤인가(0153 F2 와의 합성 효과).
3. **0143 무회귀** — 백그라운드 서브에이전트 완료 통지.
