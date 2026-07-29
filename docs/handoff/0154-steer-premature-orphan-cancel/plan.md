# Plan — 0154-steer-premature-orphan-cancel

## 메타

| 항목 | 값 |
|---|---|
| slug | `0154-steer-premature-orphan-cancel` |
| 작성자 | Claude Code |
| 일자 | 2026-07-29 |
| 매핑 | 0151 회귀 + **0151 OQ2 결정 철회** (같은 PR #292) |
| 상태 | **READY — 비기능(버그수정) = Claude 직접 구현** |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "스티어메시지 777~11 이 예약된 상태인데 **답변 완료 후 메시지가 자동으로 취소**되었다" | 실기 리포트 (2026-07-29) |
| 결정적 후속 관측 | `?` 를 추가 입력하니 **777~11 에 대한 답변이 먼저 렌더**되고 그 다음 `?` 답변이 왔다. "결국 777~11 입력 메시지가 유실되었고 **그에 대한 답변만 받은 상태**" | 동상 |
| 사용자 질문 | "턴이 종료되었다면 pending 메시지로서 주입이 되어야 하는 것 아닌가? 어떤 기술적인 문제로 주입이 안 된 것인가?" | 동상 |

> **질문에 대한 답이 진단의 핵심이다: 주입은 실패하지 않았다. 성공했고, CLI 가 아직 읽지 않았을 뿐이다.**

## 자료조사 (Research)

| # | 발견 | 레퍼런스 |
|---|---|---|
| R1 | 사용자 조작 없이 `message.cancelled` 를 보내는 곳은 **단 하나** — 턴 체인 종료(`break`)의 `discardOrphaned`. 나머지 3곳은 전부 조작 필요(Stop·hover 취소·세션 전체 중단) | `chat-turn.ts:906` vs `:1073`·`:1095`·`:1110` |
| R2 | `pending()` 은 **`heldBySession` 만** 반환한다. 예약된(`submitted`) 배치는 `trackedBySession` 에 있어 포함되지 않는다 | `pending-message-queue.ts:166-168` |
| R3 | `decidePostTurnStep` 의 `havePending` 이 R2 의 값이다 → **"CLI 에 넘겨놓고 영수증을 기다리는 중"** 을 판정이 볼 수 없다 | `post-turn.ts` |
| R4 | `break` 분기가 `orphanUnconfirmed` **직후 같은 틱에** `discardOrphaned` 를 호출한다 — 대기 구간 **0** | `chat-turn.ts:889-905` |
| R5 | **push 는 CLI 수신의 증거가 아니다.** "stdin 은 ack 없는 단방향이라 CLI 가 실제로 받았는지는 여기서 알 수 없다(그건 echo 몫)" · "SDK 는 이 AsyncIterable 을 eager 하게 drain 하므로 **pull ≠ 소비**" | `streaming-input.ts:21-29` |
| R6 | 주입 메시지는 `priority: 'next'` 로 실린다 — **"idle 채널에서는 다음 턴 프롬프트로(P2 픽업), busy 채널에서는 도구 경계에서(P1 drain) 소비된다 — 분기는 CLI 몫"** | `streaming-input.ts:35-38` |
| R7 | `confirm` 의 `open()` 술어는 `submitted` 와 `orphaned` **둘 다** 받는다 — 늦은 echo 가 orphaned 를 되살릴 수 있다 | `pending-message-queue.ts` |
| R8 | 채널 사망 시 `takeForRespawn` 이 `state !== 'confirmed'` 배치를 **전부 이월**한다 — 회수 경로가 이미 있다 | `pending-message-queue.ts` |

## 확증 시퀀스 (세션 `8c70aacd`, 턴 `f8ecfd77`, 33.3초)

```
message.committed 957        게임 규칙 + "111, 222"  ← 턴 프롬프트
tool.call.completed(Read)  → message.submitted   ← 게이트 flush #1
input.echo '222\n\n333\n\n444'                    ✅ 즉시 확정 → committed 959
message.queued 555, 666
tool.call.completed(Read#2) → message.submitted  ← 게이트 flush #2 = [555,666]
message.queued 777, 888
tool.call.started(Bash)
message.queued 999, 1010, 11
tool.call.completed(Bash)  → message.submitted   ← 게이트 flush #3 = [777,888,999,1010,11]
input.echo '555\n\n666'                           ✅ flush #2 확정 → committed 961
                                                     (submit 후 **Bash 호출 하나를 통째로 건너뛴 뒤** 도착)
message.completed → telemetry → chat.turn.completed
chat.steer.orphaned { count: 1 }                  ← flush #3
message.cancelled                                  ← 사용자가 본 "취소됨"
```

`count: 1` = 병합 배치 1개 = 777~11 다섯 건. 사용자 관측과 일치.

**모델의 마지막 reasoning 이 결정적 증거다**: *"They sent 111, 222 (and also 222, 333, 444, 555, 666 in mid-turn messages)"* — **777 이후가 없다.** 모델은 그것을 보지 못했다.

### `?` 입력이 남긴 최종 증거

사용자가 이어서 `?` 를 보내자:

```
? 입력 → 777~11 에 대한 답변 렌더링 → ? 에 대한 답변 렌더링
```

CLI 는 777~11 을 `priority:'next'`(R6)로 큐에 갖고 있다가 **다음 턴 프롬프트로 정상 픽업해 답변까지 만들어냈다.** 즉 **메시지는 유실된 적이 없다.** 유실시킨 것은 Orca 의 `discardOrphaned` 뿐이고, 결과가 "질문 버블 없이 답변만 존재" 다.

## 근본 원인

주입은 두 층이고, 실패한 층은 없다:

| 층 | 주체 | 결과 |
|---|---|---|
| ① Orca → SDK stdin (`push`) | Orca | **성공** — `message.submitted` 3회가 증거(롤백 `submitted:false` 없음) |
| ② CLI 가 그것을 **읽는 시점** | **CLI** (R5·R6) | flush #3 은 그 턴 안에 읽히지 않았다. 다음 턴에 읽혔다 |

Orca 쪽 결함은 ②를 기다리지 않는 것이다 — `pending()` 이 held 만 보므로(R2·R3) 턴 체인이 "영수증 대기 중" 을 모른 채 `break` 하고, `break` 분기가 **같은 틱에** 폐기한다(R4).

0151 이 `orphanUnconfirmed` 에 적은 의도는 *"확정 신호가 **끝내** 오지 않은 예약"* 이었다. "끝내" 는 기다렸다는 뜻인데 **한 순간도 기다리지 않는다.**

## 0151 OQ2 철회 (사용자 승인)

OQ2 는 미확정 상태를 두 가지로 봤다 — "CLI 가 못 봤다" vs "봤는데 echo 유실" — 구분 불가하니 **폐기 후 draft 복원**을 택했다.

**실측이 제3의 상태를 보여줬다: "아직 안 봤을 뿐, 곧 본다."** 그리고 이것이 흔한 경우다. 이 상태에서 폐기는 이중으로 틀린다:

- 버블은 사라지는데 **CLI 는 그 메시지를 실제로 처리한다** → 질문 없는 답변 (실기 확인)
- 사용자가 복원된 draft 를 재전송하면 **진짜 이중 전달** — 0151 이 자동 재주입을 거부한 바로 그 위험이 폐기 쪽에 대칭으로 존재했는데 검토되지 않았다

**재주입(이중 전달)도 폐기(유실)도 아니고, 옳은 것은 기다리는 것이다.**

## 설계

| # | 수정 | 위치 |
|---|---|---|
| F1 | `PostTurnState` 에 `haveUnconfirmed` 추가. 채널 생존 + held 없음 + 미확정 있음 → **`listen`**(프레임 드레인 = echo 수신 기회) | `post-turn.ts` |
| F2 | listen 을 열며 `submitted`→`orphaned` 강등 — 유예를 **배치당 1회**로 묶는다. 강등은 단조이고 술어는 `submitted` 만 세므로 무한 대기 불가. 늦은 echo 는 여전히 확정한다(R7) | `chat-turn.ts` |
| F3 | **`break` 에서 폐기하지 않는다.** `orphanUnconfirmed` 로 표시만 하고 `message.cancelled` 를 보내지 않는다. 회수는 CLI 큐가 실제로 사라지는 시점이 맡는다 — 채널 사망 → `takeForRespawn`(R8), 세션 폐기 → `dispose` | `chat-turn.ts` |
| F4 | `discardOrphaned` **제거** — 잘못으로 판명된 경로를 실수로 되살리지 않게 | `pending-message-queue.ts` |

**부수 효과**: 예약이 남아 있으면 0153 F2(`shouldQueueAsPending`)가 발동해 다음 send 가 예약 경로를 탄다 → 사용자가 본 **"`?` 와 답변의 렌더링 위치 어긋남" 도 함께 해소**된다. 취소로 `pendingSteer` 가 비워지던 것이 그 증상의 원인이었다.

## 인수 기준

1. 채널 생존 + held 없음 + 미확정 예약 존재 → `break` 가 아니라 `listen`.
2. 유예는 배치당 1회 — 강등 후 재평가에서 `break` 도달(무한 대기 부재를 테스트로 고정).
3. `break` 가 `message.cancelled` 를 **보내지 않는다**. orphaned 는 큐에 남아 ① 늦은 echo 로 정상 커밋되고 ② `takeForRespawn` 으로 이월된다.
4. 기존 판정 8케이스 불변(0143 회귀 0).
5. 회귀 0 — lint 0 error · typecheck 3/3 · vitest 전량 green. IPC 무변경.

## 리스크

| 리스크 | 완화 |
|---|---|
| 폐기를 없애면 미확정 배치가 세션 런타임 수명 동안 메모리에 남는다(첨부 base64 포함) — 0151 이 고쳤던 "GC 부재" 의 부분적 되돌림 | **의도한 트레이드오프.** 사용자 데이터를 파괴하는 것보다 메모리를 붙드는 편이 낫고, 채널 사망·세션 폐기로 상한이 있다. 유예(F1)로 대부분은 즉시 해소된다 |
| echo 가 영영 안 오면 버블이 "전달됨" 인 채 남는다 | 정직한 표현이다 — 실제로 CLI 큐에 있을 수 있다. 거짓 취소보다 낫다 |
| 유예 1라운드로 부족한 경우 | 실측 지연은 도구 호출 1회 수준이고 listen 턴은 그보다 넓은 프레임을 드레인한다. 부족해도 F3 덕에 **유실은 없다** — 다음 턴에 커밋될 뿐 |
