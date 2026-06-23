# Plan — 0040-new-chat-race-early-registration

> 새-채팅 전송 동시성 버그 해소(**직렬 디스패치 게이트 + 낙관적 멀티 엔트리**, IPC·main pending 모델 무변경 — 제목 트리거·`promote` 신원가드 2건만 한정 main 변경) + `session.updated`(init) 시점 최근대화 등록/제목 생성. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0040-new-chat-race-early-registration` |
| 작성자 | Claude Code |
| 일자 | 2026-06-23 |
| 매핑 | PHASES "현재 작업 중" (보드 링크) / PR 미생성 |
| 상태 | DRAFT → READY |
| 구현 주체 | Codex |

## Context (왜)

사용자 요구 2건:

- **(R1) 메시지 전송 버튼 누른 순간 세션 화면 전환.**
- **(R2) partial message 도착하자마자** ① 최근 대화 등록(세션데이터/공간/메타데이터 할당이 있으면 complete 전 **pre-init** 으로 접근) ② **제목 작성 query 호출**.

### 사용자 확정 사항

1. **R1 의 실체 = 동시성 버그.** 일반 단일 전송은 이미 정상 전환된다(`/new` 에서 `messages>0` 이 되는 순간 `NewChatLandingPage` 가 `ChatTile` 로 자연 전환). 문제는 **"전송 → 새 대화 클릭 → 다시 전송"** 을 첫 `session.updated` 도착 전에 빠르게 했을 때다: **2번째 세션이 최근대화에 기록되지 않고 소멸**, 남은 세션은 **첫 턴 사용자 메시지 버블이 사라진다**.
2. **R1 설계 = 직렬 디스패치 게이트 + 낙관적 멀티 엔트리** (draftId-IPC 방식 **아님**). 화면은 멀티턴처럼 **즉시** 전환되지만(낙관적), main 턴 진입은 **단일 진입로(직렬)** — 2번째 새-채팅 전송은 "연결 대기"로 보이고 1번째가 **id 발급(`session.updated`)** 된 뒤 진입한다. 시스템 관점에선 *임계구간 + 세마포어(1)* 와 동형이며, 렌더러는 단일 스레드 이벤트 루프라 store 상태로 모델링한 모니터(FIFO 큐)로 구현한다.
3. **R2 트리거 앵커 = `session.updated`(init)**. (1차 응답은 "첫 partial" 이었으나, 첫 이벤트가 `session.updated`(init)이고 sessionId·DB row 가 그 시점에 존재함을 반영해 init 으로 확정.)
4. **제목 생성 turn-end 안전망 유지** — 멱등 belt-and-suspenders.

### 근본 원인 (코드 확인 완료)

멀티세션은 `sessionId` 키잉인데, 새 채팅은 `session.updated`(init) 전까지 sessionId 가 없어 **단일 임시 슬롯**으로 보관한다 — 이 신원-이전(pre-init) 구간이 동시 2개가 되면 가정이 붕괴한다.

- **렌더러** `features/chat/store/chatStore.ts`: 새-채팅 슬롯이 `NEW_CHAT_KEY='__new__'` 단 1개. send 후 `session.updated` 전까지 A 가 이 슬롯에 머문다. 이 구간에 "새 대화" 클릭 시 `useChatRouteSync.ts:43-44`(Direction 1)이 dirty `/new` 에서 `newChat()` 를 호출 → `freshEntry()` 가 슬롯을 덮어써 **A 소멸**. `promoteNewChat(sessionId)` 도 "현재 `NEW_CHAT_KEY` 엔트리"를 re-key 하므로 끼어든 2번째가 엉뚱하게 승격될 수 있다.
- **메인** `ipc/chat/turn-registry.ts`: `pendingByOwner: Map<WebContents, InflightTurn>` — 창당 pending 슬롯 1개. 동시 미승격 새-채팅 2개를 담지 못한다.
- **메인 `promote` 미검증 (잠재 버그 · Codex Issue 1)**: `send.ts:361-363` 이 **모든** 턴의 `session.updated` 에 `turns.promote(event.sender, ev.sessionId)` 를 호출하고, `turn-registry.ts:89-94` `promote` 는 호출 턴과 무관하게 `pendingByOwner.get(owner)` 를 승격한다. resume 도 `session.updated` 를 방출하므로(`claude-map.ts:55-65`, `mock.test.ts:32`), **새 채팅 A 가 pending 인 동안 resume S 가 들어오면 A 가 S 로 오승격**되어 `bySession[S]` 의 turn_S 를 덮어쓴다(cancel 오작동·턴 누수). 0040 과 무관하게 **오늘도 존재하는 latent 버그**이며, 본 설계의 'resume 독립 동시'(AC 3-a)가 이를 지원 시나리오로 격상 → **`promote` 신원가드로 고친다**(Part A, pending 모델은 유지).

> 본 설계는 **렌더러가 미승격 새-채팅 main 턴을 항상 ≤1개로 직렬화**해 이 단일 슬롯 가정을 *지킨다* — main 을 일반화(멀티 슬롯)하는 대신 불변식을 강제한다. 그래서 **main pending 모델·IPC 무변경** (제목 트리거·`promote` 신원가드 2건은 pending 모델/IPC 계약과 무관한 한정 변경).

### 이벤트 순서 (확인 · `claude-map.ts` / `send.ts`)

claude SDK `system/init` → **`session.updated`**(sessionId 발급; `persist.ts` 가 `insertSession` 으로 DB 세션 row + 대기 user 메시지 기록) → **`message.delta`**(partials) → `assistant`(`message.completed`/`tool.call.started`) → … → **`telemetry`**(턴 종료; `persist.ts` 가 `onTurnEnd(turn)` → `TitleGenerator.maybeStart`).

함의 (중요):
- **첫 이벤트는 partial 이 아니라 `session.updated`(init)** 이다. partial(`message.delta`)은 그 뒤에 온다.
- **DB `insertSession` 은 이미 init 에서 pre-init** 된다. 반면 **사이드바 refresh·제목 생성은 turn-end** 라 늦다.
- 새 채팅은 `session.updated` **전에도 에러로 종료될 수 있다**(`send.ts:159` 중복가드 · `:178` 어댑터 부재 · `:382` sendMessage throw · `:402` 재시도). 이 pre-init 에러는 `turn.dbSessionId == null` 이라 **sessionId 없이** 발행된다(`send.ts:421` 의 `...(turn.dbSessionId ? {sessionId} : {})`). resume 에러는 항상 sessionId 를 갖는다(`send.ts:234` 에서 dbSessionId=sessionId).

→ **사용자 확정**: 두 후속 작업(등록·제목)의 트리거 앵커는 **`session.updated`(init)** — sessionId·DB row 가 존재하는 가장 이른 시점.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능 항목.

1. **동시 새-채팅 비소멸**: "전송 → 새 대화 → 전송"을 첫 `session.updated` 전에 수행해도 **두 세션 모두 최근 대화에 기록**되고 어느 것도 소멸하지 않는다.
2. **버블 보존**: 위 시나리오에서 각 세션의 **첫 턴 사용자 메시지 버블이 보존**된다(화면상 둘 다 즉시 보임).
3. **직렬 단일 진입로**: 2번째 새-채팅은 **즉시 화면 전환(연결 대기 표시)** 되고, 그 main 디스패치(`chatApi.send`)는 **1번째의 `session.updated` 이후** 발생한다.
   - **3-a (n 연속)**: 새 채팅을 **연속 n번(n≥3)** 첫 `session.updated` 전에 보내도 — ① 항상 `chatApi.send` 호출은 점유 1건뿐(나머지 `newChatQueue` FIFO), ② n개 draft 엔트리가 모두 보존·렌더, ③ 승격이 진행될 때마다 큐가 **진입 순서대로** 하나씩 디스패치되어 n개 전부 정상 승격된다(소실·오승격 0). resume 턴은 게이트 밖이라 독립 동시 진행.
4. **불변식**: 어느 시점에도 **미승격(sessionId 미발급) 새-채팅 main 턴은 ≤1개**다(렌더러 직렬화). **IPC 채널·payload·`NormalizedEvent`·main pending 모델 무변경** — main 변경은 제목 트리거(Part B)·`promote` 신원가드(아래 12) 2건으로 한정.
5. **배경 승격 비간섭**: 사용자가 2번째 새 채팅으로 이동한 상태에서 1번째 draft 가 `session.updated` 로 승격되어도 **활성 세션의 `activeKey`/URL 을 가로채지 않는다**.
6. **init 등록**: `session.updated`(init) 시 **사이드바 최근 대화에 해당 세션이 등장**한다(턴 종료를 기다리지 않음).
7. **init 제목**: `session.updated`(init) 시 **제목 생성 query 가 발사**되어 스트리밍과 **병렬** 진행되고, 완료 시 기존 `sessionTitleEvent` 로 in-place 반영된다.
8. **멱등 + 안전망**: 제목 생성은 **턴당 1회**만 실행된다(`titleGenerationStarted` 멱등). turn-end 안전망 유지.
9. **데드락 0**: 1번째 새-채팅이 init 전 종료(error/abort)해도 게이트가 해제되어 2번째(대기 중)가 진입한다.
10. **회귀 0**: 일반 단일 새-채팅 및 이어가기(resume, `sessionId != null`) 경로의 동작이 바뀌지 않는다.
11. **게이트 + 테스트**: `cd app && npm run lint && npm run typecheck && npm test` 통과 + 신규 단위 테스트(아래 게이트 절).
12. **resume 비간섭 승격**: 새 채팅 A 가 pending(미승격)인 동안 resume 턴 S 의 `session.updated` 가 도착해도 **A 가 S 로 오승격되지 않는다**(main `promote` 신원가드). resume 턴은 게이트 밖에서 정상 동시 진행.

## 범위 / 비범위

- **범위**: 렌더러 `chatStore` 의 직렬 디스패치 게이트(로컬 draft 키 + 세마포어 상태 + payload 스냅샷 FIFO 큐 + 원자 re-key)·release 라우팅; init 트리거(제목 = 메인 내부 `titles.maybeStart`, 등록 = 렌더러 셸 훅 `recentsEpoch`); "연결 대기" 표시; **메인 `promote` 신원가드**(resume 비간섭, pending 모델 유지); 단위 테스트.
- **비범위**:
  - **IPC 채널/payload/`NormalizedEvent` 변경** — 본 설계의 핵심 이점은 **무변경**. `draftId` IPC 필드는 **도입하지 않는다**(이전 초안 폐기).
  - **main pending 모델 일반화**(멀티 슬롯) — 직렬화로 단일 슬롯 가정이 유지되므로 그대로 둔다. main 변경은 **2건으로 한정**: ① R2 제목 `titles` 주입/호출(Part B), ② `promote` 신원가드(Part A) — 둘 다 pending 모델/IPC 계약 불변.
  - 낙관적 **URL 선전환**(전송 즉시 `/chat/<임시>` navigate). 현 전환(`messages>0`→`ChatTile`, init 시 Direction 2 URL 승격)으로 충족.
  - 미승격(main 진입) 새-채팅의 **cancel→main abort** — sessionId 부재로 현행 한계 유지(후속). 대기 중 draft cancel 은 로컬 큐 드롭으로 처리.
  - draft 구간 permission **setMode 라이브 반영**(초기 모드는 send payload 로 전달, init 전 *변경*만 미반영 — 후속).
  - 제목 모델/프롬프트 변경(handoff 0004 재사용), 세션 공간/워크스페이스 실제 선할당 신설(아래 pre-init 메모), opencode 등 타 어댑터.

## 설계

### Part A — 직렬 디스패치 게이트 + 낙관적 멀티 엔트리 (R1)

**불변식**: *미승격 새-채팅 main 턴은 항상 ≤1개.* 렌더러가 디스패치를 직렬화해 보장 → main 단일 `pendingByOwner` 슬롯 모델은 유지하고 `promote` 는 신원가드 API 로만 보강한다. **IPC 무변경**(draftId echo 불필요). 디스패치가 직렬이라 `session.updated` 가 진입 순서대로 오므로 **FIFO 승격이 정확**하다.

#### 시스템 관점 — semaphore(1) ↔ store 모니터 매핑

| 개념 | 구현 |
|---|---|
| 세마포어 count | `pendingNewChatKey: string \| null` (`null`=가용/1, non-null=점유/0) |
| 임계구간 | "미승격 새-채팅 main 턴 1개가 진입한 상태" |
| **P (acquire)** | `send()` 에서 `pendingNewChatKey` 검사 → null 이면 점유+디스패치, 아니면 큐잉 |
| **V (release)** | `receive()` 에서 점유 draft 가 **승격(session.updated) 또는 터미널**이면 해제 → 큐 shift → 재점유 |
| 대기자 큐 | `newChatQueue: Array<{ key: string; payload: SendPayload }>` (FIFO; **전송 시점 payload 스냅샷** 동봉 — release 가 active state 를 재독하지 않게) |

**비타협 규칙**: P 의 test-and-set(`pendingNewChatKey` 읽기+쓰기)은 **같은 동기 `setState` 콜백 안에서** 완결한다 — 사이에 `await`/마이크로태스크 금지(TOCTOU 차단). `chatApi.send()`(async)는 **점유 확정 이후**에만 호출한다. 단일 스레드 이벤트 루프라 OS 프리미티브·범용 async-mutex 는 불요(acquirer=`send` ≠ releaser=`receive` 이므로 mutex-around-block 이 아닌 조건변수/모니터 형태이고, UI 는 동기 즉시 갱신이 필요해 `await acquire()` 로 막으면 낙관적 전환이 깨진다).

#### 렌더러 `features/chat/store/chatStore.ts` (전부 렌더러-로컬, IPC 0)

- 새-채팅 엔트리에 **렌더러-로컬 키** `draft:<uuid>` 를 쓴다(`crypto.randomUUID()`). `NEW_CHAT_KEY` 는 **빈 랜딩(컴포저) 슬롯**으로 유지.
- 신규 store 상태: `pendingNewChatKey: string | null` + `newChatQueue: Array<{ key: string; payload: SendPayload }>` + `recentsEpoch: number`.
- `send()` — `cur.sessionId == null`(새 채팅)일 때, **단일 `setState` 트랜잭션**으로:
  1. 현 `NEW_CHAT_KEY` 엔트리를 `draft:<uuid>` 로 re-key(엔트리 객체 동일성 보존 → live/메시지 따라감),
  2. 그 엔트리에 `SEND_USER_MESSAGE`(버블 즉시) 적용 + live reset,
  3. `NEW_CHAT_KEY` 를 새 `freshEntry()` 로 재생성, `activeKey = draft:<uuid>`,
  4. **payload 스냅샷 구성**(Issue 2): 전송 버튼 시점의 `{ text, attachments, attachmentViews, permissionMode, providerKey, modelFamily, effort, projectId, sessionId: null }` 을 캡처한다 — release 가 나중에 active state 를 다시 읽으면 안 된다.
  5. **P**: `pendingNewChatKey == null` 이면 `pendingNewChatKey = draftKey`(점유), 아니면 `newChatQueue.push({ key: draftKey, payload })`(대기 — 스냅샷 동봉).
  - 트랜잭션 후(= `setState` **밖**): 점유한 경우에만 그 스냅샷으로 `chatApi.send(payload)` fire-and-forget. resume 경로(`sessionId != null`)는 **기존 그대로**(게이트 미적용 — 임계구간 밖, `bySession` 키잉).
- `receive(session.updated)` — **승격 조건(Issue 4)**: `ev.sessionId` 가 기존 엔트리에 없을 때만(`!sessions[ev.sessionId]`, 현 `chatStore.ts:160` 가드 유지 → resume·기존 세션의 `session.updated` 재방출은 entry 존재로 자동 제외). 이때 승격 대상 = **`pendingNewChatKey` 엔트리**(직렬 불변식상 그 새 sessionId 의 유일한 주인)를 `ev.sessionId` 로 re-key(현 `promoteNewChat` 을 "NEW_CHAT_KEY" 대신 "pendingNewChatKey" 기준으로). `pendingNewChatKey == null` 인데 새 sessionId 가 오면 불변식 위반 신호 → `console.warn` 노출(폐기). 그리고:
  - `recentsEpoch++` — **이 승격 분기에서만**(Issue 6, 세션당 1회). resume 의 `session.updated` 는 이 분기에 안 들어오므로 over-fire 없음(Part B).
  - **V(release) — side effect 경계 분리(Issue 3)**: `setState` 콜백 **안**에서는 `pendingNewChatKey = null` → `newChatQueue` 비어있지 않으면 shift 해 `pendingNewChatKey = next.key` 갱신하고 **`next.payload` 를 지역 변수로 캡처**만 한다(콜백은 순수 유지). `setState` **밖**에서 `chatApi.send(next.payload)` 호출(기존 `send()` 와 동일 패턴).
  - `activeKey` 는 승격 draft 가 **현재 활성일 때만** 추종(배경 승격은 URL/activeKey 불변 — 인수 5).
- **데드락 방지(draftId·타임아웃 없이)** — 불변식상 *sessionId 없는 터미널(error/turn.aborted/init-less telemetry)은 유일한 pre-init 새-채팅 턴 = `pendingNewChatKey`* 임이 확정된다(resume 에러는 항상 sessionId 보유). → `receive()` 의 현 폴백(`chatStore.ts:166` `key = activeKey`)을 **sessionId 없는 터미널 한정 `key = pendingNewChatKey ?? activeKey`** 로 바꾼다. 그 엔트리의 turn 이 종료(reducer inflight=false)되면 V(위와 동일한 경계 분리)를 호출해 슬롯 해제 + 큐 진행. 즉 release 조건 = "`pendingNewChatKey` 턴이 **승격 OR 터미널**".
- `newChat()` — `NEW_CHAT_KEY` 빈 엔트리만 리셋. **핵심**: send 가 `__new__`→`draft:uuid` 로 즉시 re-key 했으므로 in-flight A 는 이미 `NEW_CHAT_KEY` 를 떠났다 → 기존 `newChat()`(NEW_CHAT_KEY 만 리셋)이 **A 를 자동 보존**(별도 보존 로직 사실상 불필요, 회귀 테스트로 가드). 이게 현 버그(Direction 1 → `newChat()` → NEW_CHAT_KEY 의 A 소멸)의 직접 차단.
- `cancel()` — **(Issue 5) entry 상태 정리 정책**:
  - **대기 중 draft**(큐에 있고 main 미진입): `newChatQueue` 에서 제거 + **그 draft 엔트리 자체 제거**(미전송이므로 `dropSession` 동형) + 활성이었으면 `NEW_CHAT_KEY` 빈 랜딩으로 복귀. (입력 텍스트 컴포저 복원은 후속.) 게이트 미점유라 release 불필요.
  - **`pendingNewChatKey` draft**(main 진입·sessionId 미발급): 로컬 `CANCEL_CHAT`(UI inflight 종료)만. main 턴은 sessionId 부재로 실제 abort 불가(현행 한계, 후속). **게이트는 해제하지 않는다** — main 턴이 여전히 슬롯을 점유하므로, 해제하면 큐의 B 가 진입해 불변식(≤1)을 깬다. 슬롯은 그 턴의 실제 terminal(`receive` 데드락 경로) 때 V 로 해제된다.

#### 메인 — `promote` 신원가드 (Issue 1 · pending 모델 유지)

resume 를 게이트 밖에서 동시 진행시키려면(AC 3-a) `promote` 가 **호출 턴이 실제 pending 새-채팅 턴일 때만** 승격해야 한다. 시그니처를 `promote(turn, sessionId)` 로 바꾸고 신원 확인:

```ts
promote(turn: InflightTurn<W>, sessionId: string): void {
  if (this.pendingByOwner.get(turn.owner) !== turn) return   // resume·이미 승격·미등록 → no-op
  this.pendingByOwner.delete(turn.owner)
  this.bySession.set(sessionId, turn)
}
```

`send.ts:362` 호출부를 `turns.promote(turn, ev.sessionId)` 로 바꾼다. resume 턴 S 는 `startResume`→`bySession` 라 `pendingByOwner` 에 없어 `!== turn` → **no-op** → 새 채팅 A 오승격 차단. **pending 모델(단일 슬롯)·IPC 무변경**, 신원 검사만 추가. (대안: 호출부 `if (turn.isNewSession) turns.promote(...)` — 최소 변경이나 `promote` 자체의 footgun 잔존. **신원가드 권장**.)

#### 렌더 path (코드 확인 — "낙관적 멀티" 전제 성립, 무변경)

버블은 `session.updated` **전에** 정규 path 로 그려진다 — 전환 기준이 `sessionId` 가 아니라 **`messages` 길이**라 IPC/init 과 디커플된다:
- `send()` 의 `SEND_USER_MESSAGE`(`chatStore.ts:251`)가 **동기**로 활성 엔트리 `session.messages` 에 append(IPC 이전) → `NewChatLandingPage.tsx:13` `isEmpty = messages.length === 0` 해제 → `/new` 에서 `ChatTile`(transcript+버블) 즉시 렌더(URL 아직 `/new`, sessionId null).
- 이후 `session.updated` → 승격 re-key → `useChatRouteSync.ts:78-82` Direction 2(sessionId null→non-null arm-fire)가 `/chat/<id>` 로 URL 만 replace(같은 store 엔트리 매끄러운 인계).
- 큐 대기 B 도 동일 경로(`draft:<uuidB>` 엔트리 messages>0 → ChatTile) — 디스패치 보류는 **렌더 무관**(스트리밍만 지연), "연결 대기" 인디케이터만 추가. → `NewChatLandingPage`·`ChatTile`·`useChatRouteSync` **무변경**, draft 키에 그대로 적용됨을 확인만.

#### 게이트는 store, hook 아님 (배치 근거)

release 트리거(session.updated 도착)는 async 이벤트지만 그 핸들러 `receive()` 는 **React 트리 밖**에서 돈다(`chatStore.ts:152` 주석, `:231` 모듈-레벨 coalescer, `:494` bootstrap 배선). **Rules of Hooks** 상 `receive()` 에서 hook 직접 호출은 불가능하다. 대안인 `useEffect` pump(store state→effect 반응)는 이 자리엔 열등하다: ① pump 컴포넌트 마운트 의존(코어 불변식이 라이프사이클에 종속) ② effect 는 commit 후 스케줄 → 인입 receive 와 인터리빙해 순서 추론이 어려움 ③ effect 배칭·StrictMode 이중호출 → ref 가드 재도입(결국 명령형) ④ `chatStore.test.ts`(React 무의존)로 테스트 불가. 게다가 acquire(P)는 어차피 `send()` 안 동기 test-and-set 이어야 하므로 release 만 hook 으로 빼면 split-brain 이 된다.

큐 자료구조도 **store 배열**이 맞다(promise-chain·async-mutex 아님): 대기 draft 는 **화면에 렌더**되어야 하므로(낙관적 멀티 "대기" 표시+순서) 큐 정보는 *디스패치 순서 + UI 렌더* 두 소비자를 가진다. store 배열은 한 구조로 둘 다 만족(single source of truth)하고 cancel=`filter`·동기 테스트가 쉽다. promise-chain 은 `resolve` 를 stash 해 결국 상관 상태를 보관하고, splice 불가로 cancel 이 어려우며, UI "대기" store 가 별도로 필요해 **이중 관리**가 된다.

> "hook 형태" 직관은 **Zustand store 가 곧 hook substrate** 라는 사실로 이미 충족된다 — 읽기는 `useChatSession`/신규 `useNewChatPending(key)` hook(반응형), 쓰기는 `receive` 가 store 를 mutate 하면 모든 구독 hook 이 갱신된다. hook 은 "연결 대기" **표시 전용 셀렉터**로만 쓴다.

### Part B — `session.updated`(init) 에 등록 + 제목 (R2)

> 트리거 앵커 = **`session.updated`(init)**. sessionId·DB row 가 존재하는 가장 이른 시점이라 첫-콘텐츠 감지/게이팅(`contentStarted`·`registered`)이 **불필요**하다.

- **제목 생성 (메인 내부 · IPC 무변경)**: `router.ts:195` 에서 만든 `titles`(`TitleGenerator`)를 `ChatDeps` 로 `registerChatHandlers` 에 주입한다. `send.ts` 이벤트 루프에서 `ev.type === 'session.updated'` 처리 시 — **`persistence.persist(turn, ev)` 가 `turn.dbSessionId` 세팅 + `insertSession` 을 끝낸 직후** — `titles.maybeStart(turn)` 를 호출한다. `maybeStart` 는 `turn.titleGenerationStarted` 로 **멱등** → init·turn-end 양쪽 호출에도 1회만. 제목 query 가 스트리밍과 **병렬** 진행.
  - **turn-end 안전망 유지**: `persist.ts` 의 `onTurnEnd(turn)` → `maybeStart` 경로는 그대로(인수 8). 이제 belt-and-suspenders(멱등 무해).
  - 이는 main 변경 **2건 중 하나**(제목 트리거)이며 pending 모델·IPC 계약과 무관하다. (다른 하나 = `promote` 신원가드, Part A.)
- **최근 대화 등록 (렌더러 · 신규 IPC 채널 0)**: `chatStore.receive()` 의 `session.updated`(= `pendingNewChatKey` 승격) 경로에서 store 카운터 `recentsEpoch` 를 증가(세션당 1회, 전 세션/배경 턴 포함). 셸 훅 `app/src/renderer/src/app/hooks/useChatSessionsSync.ts` 가 `recentsEpoch` 변화를 구독해 `sessionsActions.refresh()` 호출(`features/chat`→`features/sessions` 직접 결합 금지 → **셸이 호스트**, 경계 준수). 기존 inflight false→refresh 는 완료 후 preview/정렬 동기화로 **유지**.
- **pre-init 메모**: 세션 DB row 는 이미 init 에서 `insertSession`(pre-init). 현재 별도 공간/워크스페이스 실제 할당은 없다(`getWorkspacePath` 는 턴마다 순수 계산, handoff 0039). 본 작업의 "등록"은 **사이드바 가시화 + 제목**을 init 으로 앞당기는 것. 향후 세션별 공간/메타데이터 **실제 선할당**이 필요하면 complete 를 기다리지 말고 동일하게 **init 시점에 pre-init** 하라.

### 레이어 경계

- 렌더러 게이트/큐는 `features/chat/store` 내부(L 동일). cross-feature(chat→sessions) refresh 는 **셸 훅**(`app/`)이 호스트 — `features/chat` 가 `features/sessions` 를 직접 import 하지 않는다.
- 메인: `titles` 주입은 컴포지션 루트(`router.ts`)에서 — 상위 참조 없음.

## 영향 받는 파일

- `app/src/renderer/src/features/chat/store/chatStore.ts` — **핵심**. 로컬 draft 키·`pendingNewChatKey`·`newChatQueue`·원자 re-key send·release 라우팅·`recentsEpoch`·`useNewChatPending` 셀렉터
- `app/src/renderer/src/app/hooks/useChatSessionsSync.ts` — `recentsEpoch` 구독 refresh
- `app/src/renderer/src/features/chat/components/Composer.tsx`(또는 `ChatTile.tsx`) — `useNewChatPending` 으로 "연결 대기" 인디케이터(표시만, 렌더 무영향)
- `app/src/main/ipc/chat/send.ts` — `session.updated` 처리 시 `titles.maybeStart(turn)`(제목) + 호출부 `turns.promote(turn, ev.sessionId)`(신원가드용 인자 변경)
- `app/src/main/ipc/router.ts` — `titles` 를 `ChatDeps` 로 주입
- `app/src/main/ipc/chat/turn-registry.ts` — `promote(turn, sessionId)` 신원가드(**pending 모델·단일 슬롯 유지**) + `turn-registry.test.ts` resume 비간섭 케이스
- (검토만·무변경) `NewChatLandingPage.tsx` · `ChatTile.tsx` · `useChatRouteSync.ts` — messages-구동 렌더/Direction 2 URL 승격이 draft 키에 그대로 적용됨을 확인
- **변경 없음(설계 핵심)**: `app/src/shared/{protocol.ts,ipc.ts}` · `app/src/preload/index.ts` · `app/src/renderer/src/shared/api/ipc.ts` · `docs/IPC_CONTRACT.md`

## 참고 문서

- `docs/IPC_CONTRACT.md` (§ chat send payload · §3 NormalizedEvent `session.updated` — **변경 없음 확인용**)
- `docs/arch/frontend/state.md §1.4` (멀티세션 외피 · `NEW_CHAT_KEY` 승격 · §4.4.1/§4.4.2 React-밖 dispatch · handoff 0013)
- `docs/handoff/0004-auto-session-title/` (제목 생성 seam · `sessionTitleEvent` · `TitleGenerator.maybeStart`)
- `docs/handoff/0011-main-decompose/`, `0013-renderer-multisession-store/` (세션 키잉 토대)
- `docs/TRD.md` §6 (세션/메시지 데이터 모델)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (better-sqlite3 Node ABI 재빌드 후 전체 green 확인).
- 신규 테스트 요구 (전부 `chatStore.test.ts` — React 무의존 store 직접 검증):
  - **직렬 디스패치**: 새-채팅 A send → `chatApi.send` 1회 + `pendingNewChatKey=A`. A 미승격 상태에서 B send → `chatApi.send` **추가 호출 없음** + B 는 `newChatQueue` + 두 엔트리(draft:A·draft:B) 공존(인수 3·4).
  - **FIFO 승격 + 큐 릴리스**: A `session.updated` → A 가 sessionId 로 re-key + `recentsEpoch++` + B 가 디스패치(`chatApi.send` 2번째)되고 `pendingNewChatKey=B`(인수 1·6). B `session.updated` → B 승격.
  - **n 연속(n≥3)**: A·B·C 연속 send → `chatApi.send` 1회 + `newChatQueue=[B,C]` + draft 엔트리 3개 공존. A·B·C 순서로 `session.updated` 처리 시 매번 큐가 하나씩 진행(`chatApi.send` 총 3회, 순서 보존)되고 3개 모두 sessionId 로 승격(인수 3-a).
  - **데드락 0**: A 가 init 전 sessionId 없는 `error`/`turn.aborted` → 큐 릴리스로 B 진입(인수 9).
  - **배경 비간섭**: 활성이 B 인데 A 가 승격 → `activeKey` 불변, A 만 re-key(인수 5).
  - **newChat 보존**: in-flight/대기 draft 가 있는 상태에서 `newChat()` → draft 엔트리·큐·`pendingNewChatKey` 불변(인수 2).
  - **대기 draft cancel**: 대기 중 draft cancel → 큐·엔트리 제거 + 랜딩 복귀. `pendingNewChatKey` draft cancel → **게이트 미해제**(슬롯 유지, 불변식 ≤1 보존)(Issue 5).
  - **resume 비간섭 승격**(`turn-registry.test.ts`): pending 새-채팅 `turn_A` 등록 + resume `turn_S`(`startResume`) 상태에서 `promote(turn_S, S_id)` → **A 불변·`bySession[S_id]` 미오염**; `promote(turn_A, A_id)` → A 정상 승격(인수 12).
  - **제목 멱등**: `session.updated` 다회/`onTurnEnd` 중복에도 `maybeStart` 1회(`titleGenerationStarted`)(인수 8). (main 측 — 별도 파일이면 함께.)

---

## [Codex 기입] 구현 체크리스트

- [x] 렌더러: `chatStore` 상태 `pendingNewChatKey`/`newChatQueue` 추가
- [x] 렌더러: `send()` 새-채팅 분기 — 원자 re-key(`__new__`→`draft:uuid`) + `SEND_USER_MESSAGE` + P(점유/큐잉) 단일 트랜잭션, 점유 시에만 `chatApi.send`
- [x] 렌더러: `receive(session.updated)` — `pendingNewChatKey` 기준 승격 re-key + `recentsEpoch++` + V(release/큐 shift), activeKey 활성 시만 추종
- [x] 렌더러: sessionId 없는 터미널 라우팅 `pendingNewChatKey ?? activeKey` + 슬롯 해제(데드락 0)
- [x] 렌더러: `send()` payload 스냅샷 구성 + `newChatQueue` 에 `{ key, payload }` 동봉(Issue 2)
- [x] 렌더러: `cancel()` 대기 draft = 큐+엔트리 제거/랜딩 복귀, pending draft = 게이트 미해제(Issue 5) / `newChat()` 보존 확인
- [x] 렌더러: `useNewChatPending(key)` 셀렉터 + Composer/ChatTile "연결 대기" 인디케이터
- [x] 렌더러: `useChatSessionsSync` `recentsEpoch` 구독 refresh
- [x] 메인: `send.ts` `session.updated` 시 `titles.maybeStart(turn)` + `router.ts` `titles` 주입(`ChatDeps`)
- [x] 메인: `turn-registry.promote(turn, sessionId)` 신원가드 + `send.ts` 호출부 `turns.promote(turn, …)`(Issue 1, pending 모델 유지)
- [x] 신규 단위 테스트 8종(게이트 절)
- [x] (확인) IPC/`shared`/`preload`/`IPC_CONTRACT.md`/라우트 컴포넌트 **무변경**, `turn-registry` 는 promote 가드만(pending 모델 유지)

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/renderer/src/features/chat/store/chatStore.ts`, `chatStore.test.ts`, `Composer.tsx`, `features/chat/index.ts`, `useChatSessionsSync.ts`, `app/src/main/ipc/chat/{send.ts,turn-registry.ts,turn-registry.test.ts}`, `app/src/main/ipc/router.ts`, 본 `plan.md` |
| 실행 명령 | `git pull --rebase --autostash`(upstream 없음), `cd app && npm run lint`, `cd app && npm run typecheck`, `cd app && npm test -- chatStore.test.ts turn-registry.test.ts`, `cd app && npm test`, `cd app && npm rebuild better-sqlite3` |
| 게이트 결과 | lint ✅ / typecheck ✅ / focused test ✅ 24 passed / full test ✅ 471 passed after `npm rebuild better-sqlite3` |
| 블로커 / 역질문 | 없음. 현재 브랜치에 upstream tracking 이 없어 `git pull --rebase --autostash` 는 원격 지정 요구로 종료됨. |
| 대상 커밋 | `f6a65d7` |
