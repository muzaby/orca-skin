# Plan — 0167-session-activity-projection (r2)

> **출신**: `0165` r5 리뷰(5라운드 · 24건)에서 **표시·관측 계층**에 해당하는 항목을 분리한
> 핸드오프(사용자 결정 ⑦).
> **선행**: `0165`(배치 라우팅·토큰·attempt) · `0166`(lease 수명·open 정본). **0165 → 0166 → 0167
> 순차 병합 강제**(파일 중첩).
>
> **r2 개정** — 6차 리뷰 흡수: **잔여 상태·발행이 0165 에서 이 문서로 이관**(유일 publisher) ·
> **legacy producer 제거** · **transport 공식 확정** · **activity clock 모순 해소** ·
> **projection key 승격** · **hydrate 는 store 적용까지 검증** · AC7 을 **main admission 테스트**로 이동 ·
> count 의미 확정 · 무활동 임계 상수 확정.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0167-session-activity-projection` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 |
| 상태 | DRAFT → **READY** |
| 선행 | `0165` · `0166` (둘 다 착지 후 착수) |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ② | "마지막 어시스턴트 답변 이후 **inflight 애니메이션 지속** + **'중단했지만 대기 중인 메시지가 남아 있습니다'** 표기" | 라이브 세션 + 첨부 `orcacancelresendanalysis.md` §2 |
| 명시 요구 | "**구조적 결함을 극복하되 사용자 경험을 해치지 말 것**" | 라이브 세션 ×3 |
| **사용자 결정 ⑥** | **0143(listen 대기 = inflight 지속) 유지 — 라벨만 추가.** foreground/transport UI 분리 **미채택** | 라이브 세션 |
| 외부 리뷰 | 3차 ⓒ(호환) · 5차 P1-11~14 · P2-19~20 · P2-23 | PR 리뷰 |
| 추론 의도 | 사용자는 "왜 기다리는지 모르겠다" 를 문제로 본다 — 애니메이션 제거가 아니라 **설명**을 원한다 (추론, 결정 ⑥ 근거) | 결정 ⑥ |

## Context (왜)

0165·0166 이 **유령 근거로 열리는 listen** 을 제거하고 나면, 남는 대기는 **근거가 있는 대기**다.
그런데 현재 UI 는 그 근거를 말하지 못한다 — `chat.listen{phase}` 는 **started 를 1회만** 보내고
(`chat-turn.ts:869-878`) 이유·개수를 싣지 않으며, 잔여 경고는 체인이 끝난 뒤 도착한 변경을
전달할 대상(WebContents)이 없어 **해제되지 못한다**.

즉 남은 문제는 **"상태를 사실에서 파생해 모든 뷰어에게, 재접속 후에도 전달하는 경로"** 가 없다는
것이다. 본 문서는 그 경로(projector + broadcast + hydrate)를 세우고, 그 위에 대기 UX 를 얹는다.

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당하되 순서가 중요하다.** 0165·0166 이 먼저 들어가야 "근거 없는 대기" 가 사라진다. 그 전에 라벨만 붙이면 **틀린 이유를 정확히 표시**하게 된다 | §선행 |
| 이미 있는 것 아닌가 | 부분적으로. `chat.listen`·`chat.residual` 채널은 있으나 **엣지 1회 발행 + turn owner 전송**이라 파생 상태를 실을 수 없다 | `chat-turn.ts:869-878` · `infra/ipc/send.ts` |
| 더 작은 해법이 있는가 | "라벨만 추가" 가 더 작지만, **체인 종료 후 해제**(보고 ②-b 의 절반)를 못 닫는다 — 그건 broadcast 계약이 있어야 성립한다 | 리뷰 P1-12 |
| 인용 자료(리뷰)가 요구를 부풀리지 않았나 | **3차 ⓒ 는 등급 하향.** "main/renderer 버전 스큐" 는 패키징 앱에서 발생하지 않는다(같은 빌드). 그럼에도 `phase` 를 유지하는 이유는 **리듀서 강건성**이다 — `phase!=='started'` 를 전부 종료로 처리하므로 필드 하나가 빠지면 `listening` 이 꺼지고 send 가 새 턴으로 분류된다 | `chatReducer.ts:509-520` |
| 기존 채택 결정을 뒤집는가 | **0건.** 0143 유지(결정 ⑥) · 0153 `sessionBusy` 정의 불변 | §기존 결정 표 |

- **사용자에게 올릴 것**: **대기 라벨 최종 문구**(i18n 키는 이번에 확정, 문구는 verify 사람 실기에서).

## 자료조사 (Research)

| 발견 | 레퍼런스 |
|---|---|
| **`chat.listen` 은 started 를 1회만 발행**한다(`listenPhaseSessionId` 가드) → 엣지 이벤트에 파생값을 실으면 노후한다 | `chat-turn.ts:869-878` |
| 리듀서는 **`phase!=='started'` 를 전부 종료로 처리**한다 → 필드 누락 시 `listening` 이 꺼진다 | `chatReducer.ts:509-520` |
| renderer busy 는 **단일 정의** `sessionBusy = inflight \|\| listening` — 0143·0153 계약의 접점 | `chatStore.ts:1286-1292` · `sendAdmission.ts:15-24` |
| StatusLine 은 `turnStartedAt ?? listenStartedAt` 로 애니메이션을 유지한다 | `PendingAssistant.tsx:39-42` · `StatusLine.tsx:46-100` |
| **`sendChatEvent` 는 WebContents 를 필수 인자로 받는다** — 체인 종료 후 도착한 변경은 보낼 대상이 없다 | `infra/ipc/send.ts` · 호출부 `chat-turn.ts` 전역 |
| `chat.residual` 은 renderer 에서 **멱등**(같은 값이면 상태 미변경) | `chatStore.ts:476-483` |
| **배치는 여러 메시지를 병합**한다(`ids: string[]`) — 표시 count 를 배치 수로 세면 3→1 로 줄어 "사라졌다" 로 보인다 | `pending-message-queue.ts` `toBatch` |
| `chat.listen` 계약 기재 위치 | `docs/IPC_CONTRACT.md:453` · `app/src/shared/ipc.ts:841` |
| 게이트 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed (196 files)** + node:test **28 pass** | 이번 세션 실행 |

## 구조적 결함

> **파생 상태를 엣지 이벤트로, 단일 뷰어에게만, 초기 동기화 없이 전달한다.**

| # | 발현 | 처방 |
|---|---|---|
| G-1 | 엣지 1회 발행 → 이유·개수가 노후 | **A** 스냅샷 투영 |
| G-2 | 소스가 여럿(lease·큐·트래커·transport)인데 구독이 하나뿐 | **A** projector 4소스 |
| G-3 | 전송 대상이 turn owner 뿐 → 체인 종료 후 전달 불가 | **B** broadcast/viewer |
| G-4 | 초기 동기화 경로 없음 → renderer 재접속 시 영구 미상 | **C** hydrate |

## 설계

### A. SessionActivityProjector — 앱 수명 단일 투영기 (G-1·G-2, 리뷰 P1-11)

- **4소스 구독**: lease 수명(0166) · pending queue mutation(0165) · background tracker · channel
  activity/retirement. 어느 하나가 바뀌면 **세션 스냅샷 전체를 재계산**한다.
- 배치는 `features/*` 를 직접 import 하지 않는다 — **컴포지션 루트가 4개 구독을 주입**한다.
- **앱 수명 1회 등록**(turn 수명 금지) — 체인 종료 후 도착한 변경도 투영된다.

```ts
interface ChatActivitySnapshot {
  type: 'chat.listen'; sessionId: string
  phase: 'started' | 'ended'      // 기존 계약 유지 — transport 에서 파생
  revision: number                // 세션별 앱 수명 단조 증가
  transport: 'idle' | 'listening'
  queuedCount; deliveryPendingCount; residualCount; backgroundTaskCount: number
}   // lastActivityAt 없음 — renderer 로컬 시계(r2)
```

- **count 의미 확정**(r2): 표시용은 **`queuedCount`**(held) + **`deliveryPendingCount`**
  (= submitting + accepted + orphaned, **open 정본 3상태** — 0166 확정)로 둔다. 단위는 전부
  **메시지 수**(`sum(batch.ids.length)`) — 배치 수로 세면 3건 flush 시 3→1 로 줄어 "사라졌다" 로
  보인다(P2-19). 내부 상태명은 노출하지 않는다.
- **`transport` 공식 확정**(r2 — lease 존재로 판정하면 안 된다): lease 는 foreground 턴 시작부터
  존재하므로 그것만으로 `listening` 을 만들면 **정상 응답 중에도 대기 라벨이 켜진다**.
  **`transport = 'listening' ⟺ 턴-후 루프가 세션을 붙들고 있는 구간**(`postTurnHoldsSession(step)`).
  foreground 응답 중은 기존 `inflight` 가 담당한다(0143 유지 — 애니메이션 정책 불변).
- **잔여와 직교**(P1-14): `residualCount>0` 이어도 체인이 없으면 `transport:'idle'` 이다.
- **발행 규칙 + activity clock**(r2 — 자기모순 해소): 의미 전이가 있을 때만 발행(동일 값 무발행)하고,
  **`lastActivityAt` 은 스냅샷에서 아예 뺀다.** 넣은 채 dedupe 에서만 제외하면 "활동이 계속 오는데도
  스냅샷이 안 나가 무활동으로 보이는" 모순이 생긴다. 경과·무활동 판정은 **renderer 가 기존
  delta/tool 이벤트로 로컬 시계를 굴려** 계산한다.
- **revision 은 세션별 앱 수명 단조 증가** — listen 종료 시 0으로 리셋하면 다음 started 가 과거
  revision 보다 낮아 무시된다(P1-13). 리듀서는 낮은 revision 을 무시한다.

### A-2. 유일 publisher (r2 — 이중 권위 제거)

- **projector 만 `chat.listen`·`chat.residual` 을 발행한다.** 0165 는 잔여를 발행하지 않으며
  (영수증 정합만), 본 문서가 **legacy 직접 producer 를 제거**한다:
  `beginListenPhase`/`endListenPhase`(`chat-turn.ts:869-883`) · `reconcileInterrupt` 의
  `chat.residual` 발행(`chat-turn.ts:806-818`). → **"legacy producer 0건"** 을 AC 로 잠근다.
- 이유: revision 없는 legacy 이벤트가 최신 스냅샷 **뒤에** 도착하면 **이미 지운 경고가 되살아난다**.

### B. 전달 계약 — broadcast + viewer 필터 (G-3, 리뷰 P1-12)

- 스냅샷은 **살아 있는 모든 renderer 에 broadcast** 하고 renderer 가 `sessionId` 로 필터한다.
  (대안인 session-viewer registry 는 창·탭 수명 관리를 새로 요구해 비용이 크다 — 스냅샷은
  카운트 6개짜리 작은 페이로드라 broadcast 가 합리적이다.)
- 파괴된 WebContents 는 발신 전에 `isDestroyed()` 로 거른다.

### C. hydrate — 초기 동기화 (G-4, 리뷰 P1-13)

- **세션 로드 응답에 현재 스냅샷을 포함**한다(추가 IPC 왕복 0). 보조로 renderer 준비 시
  projector 가 현재값을 재발행한다.
- **store 적용까지 검증한다**(r2): handler 반환만이 아니라 renderer 가 `lastRevision`·`listening`·
  counts 를 **실제로 반영**하는지 테스트한다(`LoadedSession` 타입·preload 계약 포함).
- **projection key 승격**(r2): 신규 세션은 큐가 `clientKey`, lease 가 owner 키를 쓰다가
  `session.updated` 에서 sessionId 로 승격된다. **`promoteProjection(oldKey, sessionId)`** 로
  counts·snapshot·**revision 을 원자 이전**한다 — 안 하면 revision 이 초기화되거나 held 가 두 키로
  갈린다.
- **수명 정리**(r2): 세션 삭제·shutdown 시 projector 스냅샷·revision·provisional key 를 함께 제거한다.

### D. 대기 UX (리뷰 P2-23 · 결정 ⑥)

- **0143 유지** — 애니메이션은 계속 돈다. `sessionBusy` 정의도 **불변**.
- **여러 이유가 동시에 존재할 수 있으므로 사실을 함께 보여준다**: 예) "백그라운드 작업 2건 처리
  중 · 전달 확인 1건". 우선순위로 하나만 고르지 않는다.
- **길이 규칙**(r2): StatusLine 에는 **상위 2개 + 합계**만, 나머지는 tooltip/popover 로 보낸다 —
  긴 문자열이 composer 배치를 밀지 않게 한다.
- **문구 중립화**(r2): "중단했지만 대기 중인 메시지가 남아 있습니다"(경고형) → **상태 서술형**
  ("응답 중단됨 · 전송 대기 N개"). **액션 버튼(지금 보내기·편집·삭제)은 보고 범위 밖 제품 변경이라
  채택하지 않는다** — 별도 결정으로 올린다.
- **장시간 무활동**(r2 — 값 확정): 프레임을 닫지 않고 **라벨만** "종료 확인 대기" 로 전환한다.
  `IDLE_HINT_MS = 30_000`(renderer 상수) · 재평가 주기 `1_000ms`(기존 `useElapsed` 틱 재사용) ·
  **foreground(`inflight`) 구간에는 적용하지 않는다**. 표시 계층 타이머라 프레임·큐·라우팅 불변.
- **탈출구를 항상 보이게**: 중단 버튼은 childless lease 에서도 동작(0166 A9), 잔여가 있으면
  "세션 전체 중단" 을 함께 제시.
- **접근성**: 라벨에 스크린리더용 텍스트를 제공하고, `prefers-reduced-motion` 에서 애니메이션
  대신 정적 표시로 대체한다.

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `SessionActivityProjector` | 4소스 → 스냅샷 파생·발행 | main `features/chat`(순수 계산) + app(구독 주입) | **순수 단위** — 소스 4개를 fake 로 주입해 스냅샷 시퀀스 검증 |
| 스냅샷 리듀서 경로 | revision 가드 · 라벨 파생 | renderer `features/chat` | `chatReducer.listen.test.ts` |
| 대기 라벨 컴포넌트 | 사실 조합 표시 · a11y | renderer | 단위 + 시각 확인(사람) |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | **4소스 중 어느 하나가 바뀌어도** 새 스냅샷이 발행된다(큐 변화 없이 백그라운드 태스크만 바뀐 경우 포함) | `session-activity-projector.test.ts::"4소스 각각의 변화가 스냅샷을 낸다"` | lease/queue/tracker/channel 구독 |
| 2 | 동일 값이면 재발행하지 않는다(`lastActivityAt` 은 dedupe 키에서 제외) | `session-activity-projector.test.ts::"동일 값은 재발행하지 않는다"` | 동 1 |
| 3 | `revision` 은 세션별로 **단조 증가**한다 — `started → ended → started` 에서 감소하지 않는다 | `session-activity-projector.test.ts::"revision 은 단조 증가한다"` | 반복 listen |
| 4 | 리듀서는 **낮은 revision 스냅샷을 무시**한다 | `chatReducer.listen.test.ts::"낮은 revision 은 무시된다"` | 순서 뒤바뀐 IPC |
| 5 | 스냅샷에 **`phase` 가 실려** 기존 리듀서 전이가 동일하게 동작한다 | `chatReducer.listen.test.ts::"phase 파생값이 기존 전이를 유지한다"` | main → renderer |
| 6 | **`transport` 는 lease/listen frame 에서만 파생**된다 — `residualCount>0` 이어도 체인이 없으면 `'idle'` 이다 | `session-activity-projector.test.ts::"잔여는 transport 를 붙들지 않는다"` | 체인 종료 후 잔여 존재 |
| 7 | 그 상태의 새 send 는 renderer 에서 **pending 버블로 표시**되고(0153 의 `pendingCount>0` 유지), **main 에서는 lease 가 없으므로 새 체인이 시작**된다 — 잔여는 respawn 프렐류드로 앞서 전달된다 | `chat-turn.lease.test.ts::"잔여만 있고 lease 가 없으면 새 체인을 연다"`(**main admission 테스트** — r2 로 renderer 판정에서 이동) | `chat:send` → admission |
| 8 | **체인 종료 후** 잔여 배치가 커밋되면 `residualCount:0` 스냅샷이 **발행되어 경고가 해제**된다 (보고 ②-b) | `session-activity-projector.test.ts::"체인 종료 후 큐 변경도 발행된다"` + 사람 실기 | 앱 수명 구독 |
| 9 | 스냅샷이 **살아 있는 모든 renderer 로 broadcast** 되고, 파괴된 WebContents 는 제외된다 | `activity-broadcast.test.ts::"파괴된 뷰어를 제외하고 전송한다"` | 다중 창 |
| 10 | 세션 로드 응답에 **현재 스냅샷이 포함**돼 renderer 재시작 후 대기 상태가 복원된다 | `handlers/session.test.ts::"세션 로드가 활동 스냅샷을 포함한다"` | 앱 재시작 · 세션 전환 |
| 11 | 사용자에게 보이는 count 는 전부 **메시지 수**다(3건 flush 시 3→3 유지, 배치 수 1로 줄지 않음) | `session-activity-projector.test.ts::"count 는 메시지 수로 센다"` | 대기 라벨 · 잔여 Notice |
| 12 | 백그라운드 대기 중 StatusLine 이 **사실을 조합해 표시**하고(예: 작업 N건 + 전달 확인 M건) **애니메이션은 유지**된다(0143) | `chatReducer.listen.test.ts::"스냅샷이 라벨 상태에 반영된다"` + 사람 실기 | `PendingAssistant.tsx:42` |
| 13 | `sessionBusy` 정의가 **`inflight \|\| listening` 그대로**여서 중단 버튼·steer 라우팅·concurrency 가 현행과 동일하다 | `chatStore.test.ts::"busy 정의는 스냅샷 도입 후에도 동일하다"` | Composer |
| 14 | 장시간 무활동 시 **라벨만** "종료 확인 대기" 로 바뀌고 **프레임은 열린 채**다 | `chatReducer.listen.test.ts::"무활동 임계 후 라벨이 바뀐다"` + `session-runtime` 프레임 무변경 확인 | 표시 계층 타이머 |
| 15 | **접근성**: 대기 상태에 스크린리더 텍스트가 제공되고 `prefers-reduced-motion` 에서 정적 표시로 대체된다 | `StatusLine.test.tsx::"a11y 텍스트와 reduced-motion 대체"` | 접근성 설정 |
| 16 | `docs/IPC_CONTRACT.md` 의 `chat.listen` 행이 **스냅샷 필드를 반영**한다 | 문서 육안 대조(verify 체크) | 문서 SSOT |
| 17 | **legacy 직접 producer 0건** — `chat.listen`·`chat.residual` 을 projector 외에서 발행하는 코드가 없다 | `grep` 기반 위생 테스트 `activity-publisher.test.ts::"projector 외 발행 지점이 없다"` | 빌드 게이트 |
| 18 | **`promoteProjection`** 이 clientKey→sessionId 승격 시 counts·snapshot·**revision 을 원자 이전**한다(revision 이 낮아지지 않는다) | `session-activity-projector.test.ts::"projection key 승격은 revision 을 보존한다"` | 새 채팅 첫 응답 |
| 19 | 세션 삭제·shutdown 시 projector 스냅샷·revision·provisional key 가 **제거**된다 | `session-activity-projector.test.ts::"세션 삭제가 투영 캐시를 지운다"` | `session:delete` · 종료 |
| 20 | hydrate 가 **renderer store 까지 반영**된다(`lastRevision`·`listening`·counts) | `chatStore.test.ts::"세션 로드 스냅샷이 store 에 반영된다"` | 세션 전환 · 앱 재시작 |
| 21 | 무활동 라벨 전환은 **`IDLE_HINT_MS` 경과 + foreground 아님** 일 때만 일어난다 | `StatusLine.test.tsx::"foreground 에는 무활동 라벨을 붙이지 않는다"` | 표시 계층 |
| 22 | 실기: 백그라운드 작업이 도는 세션에서 **무엇을 기다리는지 라벨로 확인**되고, 작업이 끝나면 애니메이션이 멈춘다 | **사람 실기** — `npm run dev` → 서브에이전트 실행 → 라벨·개수·종료 확인 | 앱 전체 |

## 범위 / 비범위

- **범위**: A~D + AC **22건** + `IPC_CONTRACT.md` 동기화.
- **비범위**:
  - **foreground/transport UI 분리** — 결정 ⑥ 미채택. (스냅샷이 `transport`·`backgroundTaskCount`
    를 이미 실으므로, 나중에 채택하면 `sessionBusy` **한 줄**로 전환된다.)
  - provider 통지 유실의 재조정 — SDK 에 태스크 열거 API 없음(`sdk.d.ts:2562,2575`).
  - 대기 라벨 **최종 문구** — verify 사람 실기에서 확정(**i18n 키는 이번에 확정**).

| 미룬 항목 | 나중에 하면 더 비싼가 |
|---|---|
| UI 분리 | **아니오** — 스냅샷 필드가 이미 있어 selector 한 줄 |
| 통지 유실 재조정 | **아니오** — SDK 가 열거 API 를 주면 붙인다 |
| 라벨 문구 | **아니오**(문자열). **i18n 키는 이번에 확정**(일방향) |

## 의존 기술 / 전제

- **선행 의존**: `0165`(큐 파생 잔여 = 스냅샷 입력) · `0166`(lease 수명 = `transport` 파생 원천).
  둘 없이 착수하면 `transport` 를 사실에서 파생할 수 없다.
- 전제 1: `sendChatEvent` 는 WebContents 가 필수 — broadcast 계약이 필요한 이유.
- 전제 2: `chat.residual` 은 renderer 에서 멱등 — 중복 발행이 무해하다.
- **신규 의존성: 없음.**

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 이번 변경 |
|---|---|---|
| **0143** listen 대기 = 작업 중(inflight 지속) | `ChatTile.tsx:51-53` · `chatReducer.ts:92-96` | **유지 — 결정 ⑥**. 애니메이션 제거 없음, 라벨만 추가 |
| **0153** send admission(`inflight‖listening‖pendingCount`) | `sendAdmission.ts:15-24` | **유지** — `sessionBusy` 정의 불변(AC13) |
| `chat.listen` variant 계약 | `IPC_CONTRACT.md:453` · `shared/ipc.ts:841` | **additive 확장** — `phase` 유지 + 필드 추가(AC5·AC16) |
| 0136 릴리즈 밸브 | `session-runtime.ts:416-418` | **유지** — 표시 타이머는 프레임을 닫지 않는다(AC14) |
| observability prod info 원칙 | `docs/arch/backend/observability.md` | **준수** — 스냅샷은 카운트·불리언만 |
| main 레이어 DAG | `eslint.config.mjs` | **준수** — projector 는 순수 계산, 4소스 구독은 루트 주입 |

## 파생 UX / 엣지케이스

- **다중 창**: broadcast + sessionId 필터로 모든 창이 같은 상태를 본다(AC9).
- **renderer 재시작**: 세션 로드가 스냅샷을 동봉해 즉시 복원(AC10).
- **잔여만 남은 세션**: `transport:'idle'` + 잔여 Notice. 새 send 는 정상적으로 새 체인을 연다(AC6·7).
- **장시간 대기**: 라벨 전환 + 중단 버튼 + (잔여 시) 세션 전체 중단이 항상 보인다(AC14, 0166 A9).
- **reduced-motion**: 정적 표시로 대체(AC15).

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| broadcast 가 무관한 창에 트래픽을 만든다 | 페이로드는 정수 6개 + 문자열 2개. 의미 전이에서만 발행(AC2). 필요 시 viewer registry 로 후퇴 가능(계약은 그대로) |
| `lastActivityAt` 을 dedupe 에서 빼면 "마지막 활동" 표시가 늦어질 수 있다 | 경과 표시는 **renderer 로컬 시계**로 계산한다 — 스냅샷은 의미 전이만 나른다 |
| 라벨이 여러 사실을 나열해 길어질 수 있다 | 조합 규칙과 최대 길이를 컴포넌트에서 정하고, 상세는 팝오버/툴팁으로 |
| 0143 유지의 귀결 — 통지 유실 시 애니메이션 지속 | 라벨이 "종료 확인 대기" 로 바뀌고 탈출구(중단)가 항상 보인다(AC14) |

- 되돌리기 어려운 결정: `chat.listen` 필드 추가(공개 IPC) — additive + `phase` 유지. i18n 키 확정.
- **Open Question**: 대기 라벨 최종 문구(사람 확인).

## 영향 받는 파일

- `app/src/main/features/chat/session-activity-projector.ts` (신규, 순수 계산)
- `app/src/main/app/bootstrap.ts` — 4소스 구독 주입 · 앱 수명 등록
- `app/src/main/app/handlers/session.ts` — 세션 로드 응답에 스냅샷 동봉(hydrate)
- `app/src/main/infra/ipc/send.ts` — broadcast 헬퍼(파괴된 WebContents 제외)
- `app/src/shared/ipc.ts` + `docs/IPC_CONTRACT.md` — `chat.listen` 스냅샷(additive)
- renderer — `chatReducer.ts`(revision·스냅샷) · `chatStore.ts`(**`sessionBusy` 불변**) ·
  `PendingAssistant.tsx` · `StatusLine.tsx` · `shared/i18n/resources/{ko,en}.ts`

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed
  (196 files)** + node:test **28 pass**.
- 신규 테스트: projector 10 · renderer reducer/store 6 · IPC/handlers 2 · StatusLine 2 · 위생 1 ·
  chat-turn admission 1.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 요구·결정(0143 유지) 인용, 추론 표기
- [x] 자료조사 — 9행 전부 `파일:라인`
- [x] 의존 기술 — **선행 의존(0165·0166)** 명시, 신규 의존성 0
- [x] 파생 UX — 다중 창·재시작·잔여만 남은 세션·장시간 대기·reduced-motion 5건
- [x] 리스크 — 4건 + 완화책, Open Question 1건(라벨 문구 — 사람 확인으로 분리)
- [x] `검증 수단` 공란 0 — AC **22건** 중 20건 `파일::케이스`, 사람 실기 1건, 문서 대조 1건
- [x] **AC7 을 main admission 테스트로 이동**(r2) — 0153 의 `pendingCount>0` 은 그대로 pending 버블을 만들고 그게 옳다. renderer 판정으로 두면 0153 과 충돌한다
- [x] 부정형 기준 0개 — AC2·AC6·AC14 는 "재발행하지 않는다"·"idle 이다"·"프레임은 열린 채다" 를 **관측 가능한 상태**로 단언
- [x] AC 간 모순 없음 — AC1↔AC2(변화 시 발행 / 동일 값 무발행) · AC6↔AC8(잔여가 transport 를 안 붙듦 / 그래도 잔여 해제는 발행됨) · AC12↔AC13(라벨 추가 + busy 정의 불변) · AC14↔AC12(라벨 전환 / 애니메이션 유지)
- [x] 인용 수치 직접 측정 — 게이트 기준선 이번 세션 실행
- [x] 신규 모듈 테스트 방법 — 3항목 전부. projector 는 **fake 소스 주입**으로 순수 테스트
- [x] 각 AC 에 프로덕션 도달 경로 — 유일한 호출자가 테스트인 AC 0개
- [x] "사람 실기" AC(17)에 실행 절차가 있고 비범위에 막혀 있지 않다
- [x] 미룬 항목 일방향 여부 — 3건 답변, i18n 키는 이번 확정
- [x] 관문 4 를 본문 완성 후 실행 — 기존 결정 표 6행을 본문 문장 기준으로 채웠고 인용 경로 확인

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만 | … |

## [구현자 기입] 구현 체크리스트

- [ ] A projector(4소스 · dedupe · revision 단조)
- [ ] B broadcast 계약(파괴 뷰어 제외)
- [ ] C hydrate(세션 로드 동봉)
- [ ] D 대기 UX(사실 조합 · 무활동 라벨 · a11y · i18n 키) + `IPC_CONTRACT.md`

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D2 | 진짜 백그라운드 통지 유실 시 애니메이션 지속(0143 유지의 귀결) | 0165 에서 이관 · 사용자 결정 ⑥ | 라벨("종료 확인 대기")·개수·중단 버튼으로 항해(AC14) | 이번 범위 |
