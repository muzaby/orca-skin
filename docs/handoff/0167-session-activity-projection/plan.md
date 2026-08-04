# Plan — 0167-session-activity-projection (r3 · 구현 반영)

> **출신**: `0165` r5 리뷰(5라운드 · 24건)에서 **표시·관측 계층**에 해당하는 항목을 분리한
> 핸드오프(사용자 결정 ⑦).
> **선행**: `0165`(배치 라우팅·토큰·attempt) · `0166`(lease 수명·open 정본). **0165 → 0166 → 0167
> 순차 병합 강제**(파일 중첩).
>
> **r2 개정** — 6차 리뷰 흡수: **잔여 상태·발행이 0165 에서 이 문서로 이관**(유일 publisher) ·
> **legacy producer 제거** · **transport 공식 확정** · **activity clock 모순 해소** ·
> **projection key 승격** · **hydrate 는 store 적용까지 검증** · AC7 을 **main admission 테스트**로 이동 ·
> count 의미 확정 · 무활동 임계 상수 확정.
>
> **r3 구현 교정** — 같은 빌드의 main/renderer 사이에 legacy 호환 variant를 남길 이유가 없고,
> 두 publisher가 공존하면 최신 상태를 되살리는 구조적 위험이 더 크다. `chat.listen`과
> `chat.residual`을 제거하고 `chat.activity` 단일 snapshot으로 교체했다. foreground까지 snapshot에
> 포함해 준비/hydrate/live race를 revision 한 축으로 해결한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0167-session-activity-projection` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 |
| 상태 | **IMPLEMENTED** (자동 게이트 완료, GUI 문구/동작 사람 실기만 잔여) |
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
기존 UI 는 그 근거를 말하지 못했다 — legacy listen edge는 **started 를 1회만** 보내고
이유·개수를 싣지 않았으며, 잔여 경고는 체인이 끝난 뒤 도착한 변경을
전달할 대상(WebContents)이 없어 **해제되지 못한다**.

즉 남은 문제는 **"상태를 사실에서 파생해 모든 뷰어에게, 재접속 후에도 전달하는 경로"** 가 없다는
것이다. 본 문서는 그 경로(projector + broadcast + hydrate)를 세우고, 그 위에 대기 UX 를 얹는다.

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당하되 순서가 중요하다.** 0165·0166 이 먼저 들어가야 "근거 없는 대기" 가 사라진다. 그 전에 라벨만 붙이면 **틀린 이유를 정확히 표시**하게 된다 | §선행 |
| 이미 있는 것 아닌가 | 부분적으로. legacy listen/residual 채널은 있었으나 **엣지 1회 발행 + turn owner 전송**이라 파생 상태를 실을 수 없었다 | 구현 전 기준선 · `infra/ipc/send.ts` |
| 더 작은 해법이 있는가 | "라벨만 추가" 가 더 작지만, **체인 종료 후 해제**(보고 ②-b 의 절반)를 못 닫는다 — 그건 broadcast 계약이 있어야 성립한다 | 리뷰 P1-12 |
| 인용 자료(리뷰)가 요구를 부풀리지 않았나 | **3차 ⓒ 는 등급 하향.** "main/renderer 버전 스큐" 는 패키징 앱에서 발생하지 않는다(같은 빌드). 구현에서는 호환 edge를 유지하는 편이 오히려 revision 없는 지각 이벤트로 최신 상태를 되살리므로 **단일 snapshot으로 교체**했다 | `shared/ipc.ts` · `chatReducer.ts` |
| 기존 채택 결정을 뒤집는가 | **0건.** 0143 유지(결정 ⑥) · 0153 `sessionBusy` 정의 불변 | §기존 결정 표 |

- **사용자에게 올릴 것**: 자동 게이트 이후 남는 것은 GUI에서 문구 길이·시각 안정성을 확인하는 실기뿐이다.

## 자료조사 (Research)

| 발견 | 레퍼런스 |
|---|---|
| legacy listen edge는 started 1회 발행이라 파생값을 실으면 노후했다 | 구현 전 기준선 |
| legacy reducer는 phase 누락을 종료로 처리해 send admission을 흔들 수 있었다 | 구현 전 기준선 |
| renderer busy 는 **단일 정의** `sessionBusy = inflight \|\| listening` — 0143·0153 계약의 접점 | `chatStore.ts:1286-1292` · `sendAdmission.ts:15-24` |
| StatusLine 은 `turnStartedAt ?? listenStartedAt` 로 애니메이션을 유지한다 | `PendingAssistant.tsx:39-42` · `StatusLine.tsx:46-100` |
| **`sendChatEvent` 는 WebContents 를 필수 인자로 받는다** — 체인 종료 후 도착한 변경은 보낼 대상이 없다 | `infra/ipc/send.ts` · 호출부 `chat-turn.ts` 전역 |
| residual은 delivery-pending의 부분집합이라 UI에서 둘을 그대로 더하면 같은 메시지를 중복 표기한다 | `StatusLine.tsx` |
| **배치는 여러 메시지를 병합**한다(`ids: string[]`) — 표시 count 를 배치 수로 세면 3→1 로 줄어 "사라졌다" 로 보인다 | `pending-message-queue.ts` `toBatch` |
| 활동 계약의 정본 | `docs/IPC_CONTRACT.md` · `app/src/shared/ipc.ts` |
| 게이트 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed (196 files)** + node:test **28 pass** | 이번 세션 실행 |

## 구조적 결함

> **파생 상태를 엣지 이벤트로, 단일 뷰어에게만, 초기 동기화 없이 전달한다.**

| # | 발현 | 처방 |
|---|---|---|
| G-1 | 엣지 1회 발행 → 이유·개수가 노후 | **A** 스냅샷 투영 |
| G-2 | 소스가 여럿(lease·큐·트래커·transport)인데 구독이 하나뿐 | **A** projector 3구독 + transport 입력 |
| G-3 | 전송 대상이 turn owner 뿐 → 체인 종료 후 전달 불가 | **B** broadcast/viewer |
| G-4 | 초기 동기화 경로 없음 → renderer 재접속 시 영구 미상 | **C** hydrate |

## 설계

### A. SessionActivityProjector — 앱 수명 단일 투영기 (G-1·G-2, 리뷰 P1-11)

- **3소스 구독 + transport 입력**: lease 수명 · pending queue mutation · background tracker를 앱
  수명 동안 구독하고, 턴-후 루프가 transport를 명시 설정한다. 어느 하나가 바뀌면 **세션
  스냅샷 전체를 재계산**한다. 같은 tick의 큐 전이는 microtask로 합쳐 중간 상태를 노출하지 않는다.
- projector는 queue·tracker 타입만 같은 chat feature에서 읽고, lease는 구조적 source를
  **컴포지션 루트가 주입**한다. transport는 명시 입력이라 네 번째 subscription이 아니다.
- **앱 수명 1회 등록**(turn 수명 금지) — 체인 종료 후 도착한 변경도 투영된다.

```ts
interface ChatActivitySnapshot {
  type: 'chat.activity'; sessionId: string
  revision: number                // 세션별 앱 수명 단조 증가
  foreground: 'idle' | 'preparing' | 'streaming'
  transport: 'idle' | 'listening'
  busy: boolean
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

### A-2. 유일 publisher (r3 — legacy variant 제거)

- projector만 **`chat.activity`**를 발행한다. `chat.listen`·`chat.residual` variant와 reducer/store
  경로를 삭제했다. `beginListenPhase`/`endListenPhase`는 projector의 `setTransport`만 호출하고,
  interrupt 화해는 생존 attempt ledger만 갱신한다.
- 이유: revision 없는 legacy 이벤트가 최신 스냅샷 뒤에 도착하면 이미 지운 경고가 되살아난다.

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
- load 응답보다 live broadcast가 먼저 도착할 수 있다. `LOAD_SESSION`은 현재 store revision이
  hydrate revision보다 높으면 activity 필드를 되감지 않는다.
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
| `SessionActivityProjector` | 3구독+transport → 스냅샷 파생·발행 | main `features/chat` + app(lease 주입) | fake lease + 실 queue/tracker 단위 테스트 |
| 스냅샷 리듀서 경로 | revision 가드 · 라벨 파생 | renderer `features/chat` | `chatReducer.listen.test.ts` |
| 대기 라벨 컴포넌트 | 사실 조합 표시 · a11y | renderer | 단위 + 시각 확인(사람) |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | **lease·queue·tracker·transport 중 어느 하나가 바뀌어도** 새 스냅샷이 발행된다 | `session-activity-projector.test.ts::"foreground·transport·background를 같은 권위 스냅샷에서 계산한다"` | lease/queue/tracker 구독 + transport 입력 |
| 2 | 동일 값이면 재발행하지 않는다(`lastActivityAt` 은 dedupe 키에서 제외) | `session-activity-projector.test.ts::"동일 값은 재발행하지 않는다"` | 동 1 |
| 3 | `revision` 은 세션별로 **단조 증가**한다 — `started → ended → started` 에서 감소하지 않는다 | `session-activity-projector.test.ts::"revision 은 단조 증가한다"` | 반복 listen |
| 4 | 리듀서는 **낮은 revision 스냅샷을 무시**한다 | `chatReducer.listen.test.ts::"낮은 revision 은 무시된다"` | 순서 뒤바뀐 IPC |
| 5 | `chat.activity`가 foreground·transport·busy·count를 **한 revision으로 원자 적용**한다 | `chatReducer.listen.test.ts::"chat.activity 권위 스냅샷"` | main → renderer |
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
| 16 | `docs/IPC_CONTRACT.md`가 **`chat.activity` 단일 계약과 load hydrate**를 반영한다 | 문서 육안 대조 + `rg` | 문서 SSOT |
| 17 | **legacy variant/producer 0건** — `chat.listen`·`chat.residual` 타입·발행·reducer 경로가 없다 | `rg 'chat\.(listen|residual)' app/src` | 빌드 게이트 |
| 18 | **`promoteProjection`** 이 clientKey→sessionId 승격 시 counts·snapshot·**revision 을 원자 이전**한다(revision 이 낮아지지 않는다) | `session-activity-projector.test.ts::"projection key 승격은 revision 을 보존한다"` | 새 채팅 첫 응답 |
| 19 | 세션 삭제·shutdown 시 projector 스냅샷·revision·provisional key 가 **제거**된다 | `session-activity-projector.test.ts::"세션 삭제가 투영 캐시를 지운다"` | `session:delete` · 종료 |
| 20 | hydrate가 store까지 반영되고 **더 최신 live revision을 되감지 않는다** | `chatReducer.listen.test.ts::"hydrate가 되감지 않는다"` | 세션 전환 · 앱 재시작 |
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
- 전제 2: residual attempt ledger는 queue의 생존 attempt와 교집합으로만 count한다.
- **신규 의존성: 없음.**

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 이번 변경 |
|---|---|---|
| **0143** listen 대기 = 작업 중(inflight 지속) | `ChatTile.tsx:51-53` · `chatReducer.ts:92-96` | **유지 — 결정 ⑥**. 애니메이션 제거 없음, 라벨만 추가 |
| **0153** send admission(`inflight‖listening‖pendingCount`) | `sendAdmission.ts:15-24` | **유지** — `sessionBusy` 정의 불변(AC13) |
| legacy listen/residual variant | 구현 전 IPC 계약 | **교체** — revisioned `chat.activity`만 유지(AC5·AC16·AC17) |
| 0136 릴리즈 밸브 | `session-runtime.ts:416-418` | **유지** — 표시 타이머는 프레임을 닫지 않는다(AC14) |
| observability prod info 원칙 | `docs/arch/backend/observability.md` | **준수** — 스냅샷은 카운트·불리언만 |
| main 레이어 DAG | `eslint.config.mjs` | **준수** — lease source는 루트 주입, chat 내부 queue/tracker만 직접 참조 |

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

- 되돌리기 어려운 결정: legacy 두 variant를 단일 `chat.activity`로 교체한 IPC 변경. 같은 빌드의
  main/renderer가 함께 배포되고 load hydrate가 있어 별도 호환 publisher는 두지 않는다.
- **Open Question**: 없음. GUI 실기는 문구 재결정이 아니라 길이·동작 검증이다.

## 영향 받는 파일

- `app/src/main/features/chat/session-activity-projector.ts` (신규, 순수 계산)
- `app/src/main/app/bootstrap.ts` — lease source 주입 · 앱 수명 등록
- `app/src/main/app/handlers/session.ts` — 세션 로드 응답에 스냅샷 동봉(hydrate)
- `app/src/main/infra/ipc/send.ts` — broadcast 헬퍼(파괴된 WebContents 제외)
- `app/src/shared/ipc.ts` + `docs/IPC_CONTRACT.md` — `chat.activity` 단일 스냅샷
- renderer — `chatReducer.ts`(revision·스냅샷) · `chatStore.ts`(**`sessionBusy` 불변**) ·
  `PendingAssistant.tsx` · `StatusLine.tsx` · `shared/i18n/resources/{ko,en}.ts`

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed
  (196 files)** + node:test **28 pass**.
- 구현 검증은 projector·queue·lease·runtime·reducer/store 기존 suite에 회귀 케이스를 추가했다.

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

> **[구현자 기입]** 구현 결과.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 앱 수명 projector, revision 단조 증가, broadcast, load hydrate, 사실 기반
  대기 라벨은 그대로 구현했다. source mutation은 microtask transaction으로 합쳐 중간 깜빡임을 막았다.
- 이견 / 보완: additive legacy publisher는 제거했다. 호환보다 **단일 권위**가 중요하며, 같은 메시지를
  deliveryPending과 residual로 중복 표기하지 않도록 UI에서 부분집합을 차감했다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | load 응답보다 live snapshot이 먼저 올 수 있음 | ✅ 더 높은 store revision 보존 | `LOAD_SESSION` reducer |
| 2 | client key 승격 뒤 이전 lease 알림이 provisional snapshot을 되살림 | ✅ alias를 session key로 흡수 | projector promotion test |
| 3 | residual이 deliveryPending 부분집합이라 같은 입력을 두 번 표시 | ✅ 일반 delivery count에서 residual 차감 | `StatusLine.tsx` |
| 4 | 세션 삭제 뒤 지각 lease release가 빈 activity snapshot을 되살릴 수 있음 | ✅ 삭제 tombstone으로 지각 source mutation 차단 | projector clear 회귀 테스트 |

## [구현자 기입] 구현 체크리스트

- [x] A projector(3구독+transport · dedupe · revision 단조 · key 승격)
- [x] B broadcast 계약(파괴 뷰어 제외)
- [x] C hydrate(세션 로드 동봉 · 최신 live 보존)
- [x] D 대기 UX(사실 조합 · 30초 라벨 · a11y · reduced-motion · i18n) + IPC 문서

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | projector(+test), bootstrap/session handler/send IPC, shared activity schema, reducer/store/PendingAssistant/StatusLine/i18n, IPC·아키텍처 문서 |
| 게이트 결과 | lint 0 error(기존 TanStack warning 1) · typecheck 3/3 · Vitest 198파일 1793/1793 · scripts 28/28 |
| 블로커 / 역질문 | 자동 검증 블로커 없음. Electron GUI 문구·동작 실기만 잔여 |
| 대상 커밋 | 작업 트리 구현(아직 커밋하지 않음) |

### [구현자 기입 · r2] 검증 FAIL 대응 (구현자 = Claude)

| # | 조치 | 근거 |
|---|---|---|
| **D3 (F1)** | `listening = ev.transport === 'listening'` 으로 좁혔다 — `busy` OR 제거. 0154 가 의도적으로 남기는 `orphaned` 배치가 더 이상 애니메이션을 붙들지 않는다(**보고 ②-a**) | `chatReducer.ts:521-541` |
| **D4 (F2)** | `inflight` 를 **renderer 소유로 환원**했다. 라이브 스냅샷은 `inflight` 를 건드리지 않고 `foreground` 는 **라벨 전용**이다. **hydrate(LOAD_SESSION)만 예외** — 재접속 시점에는 로컬 진실이 없다(G-4) | `chatReducer.ts:531-541`, `:674-691` |
| **D5** | 리듀서·store 테스트 헬퍼가 `busy`·counts·`foreground` 를 **transport 와 독립**으로 받는다. 이전 헬퍼는 위험 분기를 구조적으로 가리고 있었다 | 두 테스트 파일 |
| **D6** | 무활동 상수를 plan 값 **`IDLE_HINT_MS = 30_000`** 으로 통일(구 `LONG_WAIT_SECONDS = 30`) | `lib/activityLabel.ts` |
| **AC12·14·15·21** | 라벨 조합 규칙을 **순수 모듈로 추출**(`lib/activityLabel.ts`) — 사실 조합·residual 차감·상위 2 + 합계·무활동 임계·**foreground 미적용**을 13건으로 고정. "UI = 시각 검증" 관례로 넘기던 로직을 되찾았다(verify 0150 D4 의 반복 지적) | `activityLabel.test.ts` |
| **AC13** | "현행과 동일" 을 **동작으로** 고정 — 잔여만 남은 idle 스냅샷에서 `sessionBusy=false` 이고, 그 상태의 send 는 **여전히 예약 경로**(0153 `pendingCount>0` 유지) | `chatStore.listen.test.ts` 2건 |
| **AC10·AC20** | hydrate 가 store 까지 반영되는지 + 최신 live revision 을 되감지 않는지 | `chatReducer.listen.test.ts` 3건 |

**미충족 잔여**: AC7(main admission)·AC9(broadcast 뷰어 필터)는 각각 chat-turn 하네스·electron
`webContents` 모킹이 필요해 남겼다(D7). AC22 는 사람 실기.

**게이트(재실행)**: lint **0 error** · typecheck **3/3** · vitest **201 파일 1832/1832** · scripts **28/28**.

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D2 | 진짜 백그라운드 통지 유실 시 애니메이션 지속(0143 유지의 귀결) | 0165 에서 이관 · 사용자 결정 ⑥ | 30초 후 라벨("종료 확인 대기")·개수·중단 버튼으로 항해 | 완화 구현 · GUI 실기 대기 |
| D3 | **잔여가 애니메이션을 영구히 붙든다** — 리듀서가 `listening` 에 `busy`(큐 카운트 포함)를 OR 해, 0154 가 의도적으로 남기는 `orphaned` 배치 하나로 `sessionBusy` 가 무한 true. **보고 ②-a 를 결정론적으로 재현한다** | verify r1 §F1 (실모듈 조립 실행 확정 — `chatReducer.ts:526` ↔ `session-activity-projector.ts:172-177`) | `listening = ev.transport === 'listening'` 으로 좁힌다(AC6 직교 규칙). 대기 이유는 애니메이션이 아니라 **라벨/개수**로 | **open — 라운드 2** |
| D4 | **`inflight` 소유권이 renderer → main 으로 이전**됐다(`inflight: ev.foreground !== 'idle'`) — plan 은 "0143 유지·정책 불변" 으로 renderer 소유를 명시했다. 현재는 `queueMicrotask` 배칭 덕에 취소 직후 되살아나지 않지만 **우연히 안전**하고 테스트로 고정돼 있지 않다 | verify r1 §F2 (`chatReducer.ts:530`) | renderer 소유로 복원하거나(권장) 이전을 **사용자 결정**으로 승격. `foreground` 는 라벨 전용으로 | **open — 사람 결정 대기** |
| D5 | 리듀서 테스트 헬퍼가 `busy = (transport === 'listening')` 로 **고정**돼 위험 분기(D3)가 한 번도 실행되지 않는다 | verify r1 (`chatReducer.listen.test.ts:21`) | 헬퍼에 counts/busy 를 독립 인자로 | open |
| D6 | 무활동 상수가 plan(`IDLE_HINT_MS = 30_000`)과 코드(`LONG_WAIT_SECONDS = 30`)에서 **이름·단위 불일치** | verify r1 (`StatusLine.tsx:24`) | 한쪽으로 통일 | **해소(r2)** — `lib/activityLabel.ts` 의 `IDLE_HINT_MS = 30_000` |
| D7 | **AC7(main admission)·AC9(broadcast 뷰어 필터)는 하네스가 없어 미검증** — 각각 chat-turn 전 경로와 electron `webContents` 모킹이 필요하다 | r2 구현 | 0166 D6(하네스 신설)에 함께 태운다 | open |
