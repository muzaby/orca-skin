# Plan — 0153-live-persist-structure-parity

## 메타

| 항목 | 값 |
|---|---|
| slug | `0153-live-persist-structure-parity` |
| 작성자 | Claude Code |
| 일자 | 2026-07-28 |
| 매핑 | PR #292 후속 (0151·0152 와 별건) |
| 상태 | **READY — 로그로 원인 확정(2026-07-29). 비기능(버그수정) = Claude 직접 구현** |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "재시작 시 메시지버블의 위치가 재조정됨. 이 말은 위에 언급했던 내용과 다르게 랜더링된다는 것임. **db 영속과 당시의 렌더링이 다르다**" | 라이브 세션 버그 리포트 (실기, 2026-07-28) |
| 명시 요구 | 이 건을 후속 핸드오프 **0153** 으로 진행 | 라이브 세션 지시 |
| 선행 관찰(맥락) | "**잔여**가 있는 상황에서 새 메시지를 보냈을 때 이미 답변 델타가 많이 쌓여있어서 한번에 렌더링 되는 상황. **델타가 발생하는 동안 assistant 직전 턴이 종료된 것처럼 되고 있는 것이 문제**" | 동상(직전 리포트) + 오타 정정("자녀"→"잔여", 사용자 확인) |

> **오타 정정의 파급**: 초판은 "자녀"를 서브에이전트 child 로 읽고 가설 ②(child 파트 경로)를 세웠다. 실제 단어가 **잔여**이므로 **가설 ②는 배제**되고, 세 리포트(잔여 늦은 flush · 델타 일괄 렌더 · 재시작 시 위치 재조정)가 **하나의 원인**으로 수렴한다(아래 §단일 근본 가설).

## Context (왜)

라이브 transcript 와 재로드 transcript 의 **구조가 다르다**. 사용자가 본 것은 재시작 후 버블 위치가 바뀌는 현상이고, 이는 "현재 렌더링" 과 "영속된 진실" 이 어긋난다는 뜻이다. 대화 기록의 신뢰성 문제라 표면 버그가 아니다.

0151/0152 는 **큐(전달) 계층**을 다뤘고, 이 건은 **커밋 이후의 표현 계층** — 별건이라 분리했다.

## 자료조사 (Research) — 이번 턴에 확인한 것

| # | 발견 | 레퍼런스 | 판정 |
|---|---|---|---|
| R1 | DB 정렬은 **삽입 순서**다 — `ORDER BY m.idx ASC, mp.idx ASC`. `created_at` 정렬 아님 | `app/src/main/infra/db/queries.ts:132` | 확인 |
| R2 | `LOAD_SESSION` 은 DB 순서를 **재정렬 없이 1:1 매핑**한다 | `renderer/.../chatReducer.ts:614-624` | 확인 |
| R3 | `groupExchanges`/`groupTurns` 는 `messages` 배열의 **순수 함수**(연속 동일 role 묶기 + user 경계로 exchange 분할). 같은 배열 → 같은 렌더 | `renderer/.../lib/turns.ts:15-55` | 확인 |
| R4 | **main 분할 규칙**: assistant 파트는 `currentAssistantMessageId` 에 누적되고, `commitUserMessage` → `finalizeTurn` 이 그 id 를 **null 로 리셋**한다. 다음 파트는 `ensureAssistantMessage` 가 새 메시지를 만든다 | `features/history/writer.ts:66-100`(`commitUserMessage`·`finalizeTurn`) | 확인 |
| R5 | **renderer 분할 규칙**: `appendAssistantPart` 는 **마지막 메시지가 `user` 면 새 assistant 메시지**를 만들고, 아니면 마지막 메시지의 parts 에 붙인다 | `renderer/.../chatReducer.ts:285-294` | 확인 |
| R6 | `APPEND_COMMITTED_USER_MESSAGE` 는 user 메시지를 **배열 끝에 append** 한다(clientId 멱등 가드 포함) | `renderer/.../chatReducer.ts:311-336` | 확인 |
| R7 | 라이브 스트리밍 텍스트는 `messages` 가 아니라 **`live` 슬라이스(transient)** 에 있고, `PendingAssistant` 리프가 **tail exchange 안**에서 렌더한다. `message.completed` 시에 비로소 `messages` 의 파트로 굳는다 | `chatReducer.ts:90` 주석 · `TranscriptView.tsx:52-58`(head/tail 분리) | 확인 |
| R8 | 로드 경로에만 적용되는 변환이 2개 있다 — `settleOrphanToolParts`(incomplete 한정) · `settleStaleAsyncLaunchParts`(0143, async_launched → aborted). **둘 다 파트 내용만 바꾸고 순서·그룹핑은 건드리지 않는다** | `chatReducer.ts:620-623` | 확인 |

### 반증된 가설 (이번 턴에 배제)

| 가설 | 배제 근거 |
|---|---|
| DB 가 `created_at` 으로 정렬해서, 오래된 `createdAt` 을 가진 steer 배치가 위로 올라간다 | R1 — 정렬 키는 `idx`(삽입 순서). `createdAt` 은 정렬에 관여하지 않는다 |
| 로드 시 재정렬이 일어난다 | R2 — 1:1 매핑, 재정렬 없음 |
| 그룹핑(exchange) 로직이 라이브/로드에서 다르게 동작한다 | R3 — 순수 함수. 입력이 같으면 출력이 같다 |
| main 과 renderer 의 **assistant 메시지 분할 지점이 다르다** | R4·R5 — 아래 트레이스에서 **동치**로 확인 |

### 핵심 트레이스 — 두 분할 규칙은 동치다

steer 가 응답 중간에 커밋되는 표준 시나리오:

| 단계 | main (`HistoryWriter`) | renderer (`chatReducer`) |
|---|---|---|
| 턴 프롬프트 커밋 | `finalizeTurn`(id=null, no-op) → user row `U1` | `messages=[U1]` |
| `message.completed(A)` | `ensureAssistantMessage` → 새 `M1`, part A | 마지막=U1(user) → 새 assistant `[A]` |
| steer 커밋 | `finalizeTurn` → `M1` 마감·id=null → user row `U2` | `U2` append |
| `message.completed(B)` | `ensureAssistantMessage` → 새 `M2`, part B | 마지막=U2(user) → 새 assistant `[B]` |

→ 양쪽 모두 `[U1][A][U2][B]`. **구조가 일치한다.**

즉 **"main 이 분할하는데 renderer 가 안 한다" 는 내 초기 가설은 틀렸다.** (PR #292 본문에 그 가설을 적어뒀는데, 정정이 필요하다 — 아래 범위 참조.)

## ~~단일 근본 가설 — 프레임 조기 종료 → unframed 적체~~ (2026-07-29 **반증**)

> 초판은 `telemetry` 로 프레임이 닫힌 뒤에도 CLI 가 더 흘려 `unframed` 에 적체된다고 봤다(R9~R11).
> **사용자 로그가 이를 반증한다** — 6개 턴 전부에서 `telemetry` 가 마지막 이벤트이고, 그 뒤에
> assistant 델타·`message.completed` 가 **하나도 오지 않는다**. 적체는 발생하지 않았다.
> R9~R11 의 코드 사실 자체는 유효하나(프레임 수명·`unframed` 주입·`break` 조건), 이번 증상의
> 원인이 아니다. 아래가 로그로 확정된 진짜 원인이다.

## 확정 근본 원인 — **턴 경계에서 main 과 renderer 의 busy 판정이 어긋난다**

### 로그 증거 (사용자 제공, 2026-07-29 · 세션 `5a47b0c7`)

사용자가 `111`→`101010` 을 턴 메시지/steer 혼용으로 보냈다. 렌더링 결과:

```
111 → 답변 → 222 333 444 → 답변 → 555 → 답변 → [999] [666 777 888] → 답변 → [101010] → 답변 → 답변
                                                  ^^^^^ 역전
```

로그의 결정적 구간:

```
telemetry (555 턴)              ← renderer: TURN_END_RESET → inflight=false  ⇒ **idle**
chat.turn.completed
chat.turn.started               ← main: 666-888 연속 턴 개시 (renderer 로 가는 신호 **없음**)
message.queued 999              ← 이 창에서 999 전송
input.echo   666\n\n777\n\n888
message.committed 666-888 → messageId 801
...
message.committed 999     → messageId 803
```

| # | 발견 | 레퍼런스 | 판정 |
|---|---|---|---|
| L1 | renderer 의 send admission 은 `inflight ‖ listening` 단 둘로 판정한다. false 면 **낙관 커밋**(정식 버블 즉시 tail append), true 면 pendingSteer | `renderer/.../store/chatStore.ts:663,676-693` | 확인 |
| L2 | `telemetry` 가 `TURN_END_RESET` 으로 `inflight=false` 를 만든다 | `renderer/.../reducer/chatReducer.ts:217-219,440` | 확인 |
| L3 | `chat.listen started`(→ renderer `listening=true`)는 **`step === 'listen'` 에서만** 발화한다. **`flush` 스텝(held 를 연속 턴으로 잇는 경로)은 아무 신호도 보내지 않는다** | `chat-turn.ts:908-911` vs `:967-971` | **← 근본 결함** |
| L4 | 뒤늦게 온 `message.queued` 는 `hasCommittedClientId` 가드에 걸려 no-op — 낙관 버블이 그 자리에 굳는다 | `renderer/.../store/chatStore.ts:449,226-230` | 확인 |
| L5 | `message.committed` 는 `TURN_ACTIVITY_EVENTS` 에 없다 → 커밋만으로는 inflight 가 안 켜진다. 첫 모델 출력(`message.reasoning`/델타)까지 idle 구간이 이어진다 | `renderer/.../store/chatStore.ts:239-245` | 확인 |
| L6 | 999·101010 의 `input.echo` uuid(`983a2cb8`·`31612c35`)가 `message.queued` id(`81ee8c26`·`e8d026b6`)와 **다르다** = `reserveHeld`(배치 uuid 신규 발급) 경로 ⇒ main 은 이들을 **held 로 받았다**. 반면 111·555 는 uuid 동일(`reserveItem`, 턴-여는 send) | 로그 + `chat-turn.ts:626-629,971` | **독립 교차검증** |

### 기전

`telemetry` 도착 시점부터 다음 턴의 **첫 모델 출력**까지, main 은 busy(턴-후 루프가 연속 턴 진행)인데 renderer 는 **idle** 이다. 그 창에서 보낸 메시지는:

- **renderer**: idle 판정 → **낙관 커밋** → 정식 버블이 tail 에 즉시 선다
- **main**: busy 판정(`hasSession`) → held 적재 → **잔여 배치 뒤에** 커밋

⇒ 라이브 순서와 DB(`idx`) 순서가 **갈린다**.

### 관측 3건이 모두 이 하나로 설명된다

| 사용자 관찰 | 기전 |
|---|---|
| "steer 가 어시스턴트 턴 종료 후 바로 flush 안 되고 **답변완료 상태로 빠짐**" | L2 로 inflight 하강 + L3 로 flush 경로 무신호 ⇒ UI 는 완료, main 은 연속 턴 진행 중 |
| "새 메시지가 먼저, pending 메시지가 후에 들어간다" (`999` 가 `666~888` 앞) | L1+L4 — 그 창의 send 가 낙관 커밋 경로 |
| **"재시작 시 버블 위치가 재조정됨"** (0153 원 증상) | DB 는 main 커밋 순서(`idx`, R1)라 재로드 시 제자리로. **라이브 쪽이 틀렸던 것** |

> 초판 §현재 판단의 후보 1번("라이브 쪽이 과도기적으로 어긋나 보였던 것")이 **맞았다** — 단 원인은
> `PendingAssistant` 배치가 아니라 **낙관 커밋의 조기 발동**이다. 후보 2(서브에이전트)·3(커밋 계층)은 배제.

## 설계 — 무엇을 고치는가

**원칙: 사용자 메시지의 순서를 정하는 권위는 main 하나다.** renderer 의 낙관 커밋은 "main 도 이 메시지를 즉시 턴 프롬프트로 쓴다" 가 참일 때만 정당하다. 그 전제가 깨지는 구간을 없앤다.

| # | 수정 | 위치 | 성격 |
|---|---|---|---|
| F1 | **턴-후 루프가 세션을 붙들고 있는 동안 renderer 를 busy 로 유지한다.** phase 신호를 `listen` 스텝 전용에서 **`break` 아닌 모든 스텝**으로 넓힌다 | `chat-turn.ts` 턴-후 루프 · `post-turn.ts` | 원인 제거 |
| F2 | **renderer admission 에 "미확정 예약 존재" 를 더한다.** main 에 아직 확정 안 된 예약(`pendingSteer`)이 있으면 지금 보내는 메시지는 **반드시 그 뒤에** 커밋되므로 낙관 커밋은 항상 틀리다 | `renderer/.../lib/sendAdmission.ts`(신규 순수 함수) + `chatStore.ts` | 백스톱(F1 신호 도달 전 창) |
| F3 | **연속 턴의 예약도 소유권 전이를 알린다.** `flush` 경로의 `reserveHeld` 가 `message.submitted` 를 안 보내 예약분 버블이 "취소 가능" 인 채로 남는다 — 0151 AC12 가 게이트 경로만 덮은 구멍 | `chat-turn.ts:971` | 0151 구멍 마감 |

**비채택**: `message.committed` 를 `createdAt` 기준 **삽입**으로 바꿔 라이브를 사후 재정렬하는 안. 증상은 가리지만 (a) 이미 붙은 assistant 파트의 귀속이 흔들리고 (b) 화면이 눈앞에서 재배치돼 더 나쁘다. **순서를 틀리게 만든 뒤 고치지 말고, 틀린 순서가 생기지 않게 한다.**

## 인수 기준

1. **F1** — 턴-후 루프가 `flush` 스텝으로 연속 턴을 열 때도 renderer 가 busy 로 유지된다. 판정은 순수 함수로 표현되고 단위 테스트로 고정된다(`break` 만 세션을 놓는다).
2. **F2** — `inflight=false ∧ listening=false` 라도 `pendingSteer` 가 비어있지 않으면 send 는 **예약 경로**를 탄다(낙관 커밋 없음 · `BEGIN_TURN` 없음). 순수 함수 + store 계약 테스트.
3. **F3** — `flush` 연속 턴이 held 를 예약하면 `message.submitted{submitted:true}` 가 그 배치 ids 로 발화한다.
4. **관측 시나리오 회귀 테스트** — 로그 시퀀스(`telemetry` → 연속 턴 개시 → 그 창에서 send)를 store 레벨에서 재현해 **낙관 커밋이 발생하지 않음**을 잠근다.
5. **회귀 0** — lint 0 error · typecheck 3/3 · vitest 전량 green. IPC 채널·스키마 **무변경**(기존 `chat.listen`·`message.submitted` 재사용).

## 범위 / 비범위

- **범위**: send admission 의 busy 판정 일치(F1·F2) + 연속 턴 소유권 신호(F3) + 회귀 테스트.
- **비범위**: 0151(큐 상태 머신)·0152(고아/순서) — 이미 PR #292 에 있음. `unframed` 적체 처리(R9~R11 경로)는 이번 증상의 원인이 아니므로 **손대지 않는다**.
- **부수 작업**: PR #292 본문의 0153 절(프레임 조기 종료 가설)을 확정 원인으로 정정한다.

## 파생 UX / 엣지케이스

| 케이스 | 처리 |
|---|---|
| F1 로 `listening` 이 flush 구간에도 켜진다 | StatusLine 이 "대기 중" 애니메이션을 유지한다 — **의도한 것**. main 이 실제로 일하는 중이므로 완료로 보이던 종전이 오히려 거짓이었다 |
| F2 로 예약 경로를 타면 `BEGIN_TURN` 이 없어 즉시 "생각 중" 리프가 안 뜬다 | 기존 steer 경로와 동일한 UX. pending 버블(연회색)이 그 역할을 하고, F1 로 `listening` 이 켜져 StatusLine 은 살아 있다 |
| main 은 idle 인데 renderer 에 `pendingSteer` 가 남은 경우(0152 stranded 잔재) | F2 로 예약 경로 → main 은 idle send 로 받아 `reserveHeld` 가 잔여+신규를 **적재 순서대로 병합**(0152 AC2) ⇒ 순서 보존. 안전 |
| `break` 로 루프가 끝나는 정상 턴 | F1 은 `break` 에서 phase 를 열지 않는다 — listen started/ended 깜빡임 없음 |

## 리스크

| 리스크 | 완화 |
|---|---|
| F1 이 `listening` 의 의미를 넓힌다("백그라운드 대기" → "턴-후 체인 진행 중") | 이름은 `chat.listen`(wire) 그대로 두되 판정을 순수 함수 `postTurnHoldsSession` 으로 명시하고 주석·테스트로 의미를 고정. IPC 스키마 무변경이라 renderer 계약도 그대로 |
| F2 가 낙관 커밋을 과도하게 막아 첫 send 반응성이 나빠진다 | 조건이 `pendingSteer` **비어있지 않음**이라, 예약이 없는 통상 첫 send 는 영향 없다 |
| 실기 확인 필요 — 레이스라 기계 검증은 "판정 함수" 수준까지만 | verify 의 사람/에이전트 책임표에 명시. 0152 와 같은 한계 |

## 참고

- `app/src/main/infra/db/queries.ts:132` · `features/history/writer.ts:66-107`
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts:285-294,311-336,614-624`
- `app/src/renderer/src/features/chat/lib/turns.ts` · `components/transcript/TranscriptView.tsx`
- 선행: 0067(커밋 단일 경로) · 0069(확정 신호) · 0143/0149(서브에이전트·라이브 델타 가드)
