# Plan — 0068-turn-open-optimistic-commit

> 0067 실기 테스트 버그픽스 + echo↔훅 논쟁 판정용 wire 계측. 비기능(버그수정) = Claude 직접 plan→impl→verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0068-turn-open-optimistic-commit` |
| 작성자 | Claude Code |
| 일자 | 2026-07-05 |
| 매핑 | PHASES 행 (0067 후속) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구(버그 1) | "새대화-랜딩페이지에서 첫 메시지를 보냈을때, uiux상에서 transcript 화면전환이 바로 이어지지 않고 있음" | 라이브 세션(2026-07-05) 버그 리포트 |
| 명시 요구(버그 2) | "사용자 턴에서 메시지를 보내고, 어시스턴트의 답변이 시작됐는데도, uxui 상에서 대기중 메시지로 표시되고 있음. 사용자 질의 없이도 답변이 시작되는 형태… 답변 진행 중에 대기중 메시지가 일반 메시지로 승격되어 위치가 재조정되는 상황" | 라이브 세션(2026-07-05) 버그 리포트 |
| 명시 검토 의견 | "PostToolBatch 는 mid-turn 입력의 마지막 타이밍이라 flush=consumed 로 판단해도 좋다. UserPromptSubmit 은 매 턴의 첫 이벤트라 pending flush(consumed) 처리로 충분하다. echo 재확인은 과한 장치로 보인다" (참고: code.claude.com/docs/en/hooks#hook-lifecycle) | 라이브 세션(2026-07-05) 검토 |
| 추론 의도 | 버그의 본질은 "턴을 여는 내 메시지가 즉시 정식 버블로 보이지 않는 것" — steer(어시스턴트 턴 중 예약)의 pending 표시 자체에 대한 이의는 아님 | (추론 — 버그 2 서술이 "사용자 턴에서 보낸 메시지" 한정) |
| 추론 의도 | echo 검토 의견의 실질 목표도 *표시 지연 제거* — main DB 커밋 경로 교체는 실측(UserPromptSubmit 이 push 프롬프트에 발화하는가) 후 별도 판단으로 합의 | (추론 — 세션 논의 흐름; 실측 전 커밋 경로 불변) |

## Context (왜)

0067 pending-first 는 **모든** 사용자 메시지를 pending(연회색/기울임)으로 시작시키고 `messages` 커밋을 echo 관측(`message.committed`)까지 지연했다. 실기에서 두 UX 버그가 실증됐다:

1. **랜딩 전환 지연** — `NewChatLandingPage` 게이트가 `messages.length === 0` 이라, 첫 메시지가 pending 에만 있는 스폰(1~2s)+echo 창 동안 랜딩에 머문다.
2. **답변 중 대기표시 + 위치 점프** — 턴 경계(user)를 여는 커밋 메시지가 없어 새 턴의 어시스턴트 파트가 직전 assistant 메시지에 병합 렌더되고(`appendAssistantPart` — 마지막이 assistant 면 이어붙임), pending 버블은 최하단에 뜬다. echo 커밋 도착 시 user 가 뒤늦게 append 되며 exchange 재그룹핑 → 점프. 0067 의 "echo sub-second" 전제가 장수명 채널 실기에서 깨진 것(verify 실측 리스크 ② 실증).

교정 원칙: **턴을 여는 사용자 메시지 = 낙관 커밋(즉시 정식 버블), steer 예약만 pending 유지.** main 의 echo 커밋 경로(DB 정렬 정본)는 불변 — renderer 표시 계층만 고친다. 아울러 echo↔훅 논쟁(위 검토 의견)을 판정할 **wire 계측 2점**을 심어 사용자의 다음 실기 로그가 데이터를 남기게 한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 랜딩 전환 게이트 = `messages.length === 0 && !loadingSession` — pending 항목은 안 본다 | `app/src/renderer/src/pages/NewChatLandingPage.tsx:13` |
| 어시스턴트 파트는 마지막 메시지가 assistant 면 그 메시지에 이어붙는다 — 사이 user 커밋이 없으면 새 턴 응답이 직전 답변에 병합 | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:239-247` |
| pending 버블은 마지막 Exchange 최하단/독립 블록으로 렌더 — 스트리밍 답변 아래 | `app/src/renderer/src/features/chat/components/transcript/TranscriptView.tsx:70-91` |
| id 정합: renderer `requestId` = `SendChatMessage.clientRequestId` = 큐 `item.id` = `flushItem` 배치 `uuid`/`ids[0]` = `message.committed.ids[0]` | `chatStore.ts:541·567` · `app/src/main/app/chat-turn.ts:441-468` · `pending-message-queue.ts:133-139` · `turn-coordinator.ts:122-143` |
| 게이트 병합 배치(flushHeld)의 ids 는 전부 busy 예약(steer) 항목 — 턴-시작 낙관 커밋 항목과 겹치지 않는다(턴 프롬프트는 flushItem 단독 배치) | `pending-message-queue.ts:122-139` · `chat-turn.ts:246-251(busy 분기)` |
| `message.queued` 는 새 세션 send·핸드오프 자동 메시지도 발행 — renderer 가 본문을 모르는 발화(핸드오프)의 pending 버블 경로는 보존해야 한다 | `chat-turn.ts:460-467` · `chatStore.ts:368-378` |
| PostToolBatch 게이트 훅은 push(주입)만 하고 커밋하지 않는다 — flush=consumed 겸용의 구멍은 drain-이전 발화·C7/C8 취소 창 | `app/src/main/adapters/claude-adapt.ts:132-154` · 0067 plan §B |
| 훅 공식 문서: UserPromptSubmit 은 판정-이전 발화 + block 시 프롬프트 폐기("erases the prompt"); **프로그램적 push/스트리밍 입력에 대한 훅 발화는 미문서화** — "매 턴 첫 이벤트" 전제는 push 프롬프트에서 [I] | https://code.claude.com/docs/en/hooks#hook-lifecycle (2026-07-05 조회) |
| wire log 인프라: `sendChatEvent` 단일 chokepoint 의 모듈 플래그(디버그 패널 토글, DEV 전용) — `input.echo` 는 renderer 미전달이라 현재 로그에 안 잡힌다 | `app/src/main/infra/ipc/send.ts:14-26` · `turn-coordinator.ts:179-184` |
| `infra/ipc/send.ts` 는 electron 런타임 import — coordinator(순수 vitest)가 직접 import 하면 테스트 환경 파손 → 플래그를 electron 비의존 모듈로 분리 필요 | `send.ts:5` |

## 인수 기준 (Acceptance Criteria)

1. **랜딩 즉시 전환**: 새 대화에서 send 직후(이벤트 왕복 없이) 활성 엔트리 `messages` 에 user 메시지가 존재한다 → `NewChatLandingPage` 가 같은 렌더 사이클에 ChatTile 로 전환. 게이트에 `!inflight` 이중 방어 추가.
2. **턴-시작 메시지 낙관 커밋**: 기존 세션 idle send·새 세션 첫 send 는 pending 항목 대신 정식 user 버블(`APPEND_COMMITTED_USER_MESSAGE`, `clientId`=clientRequestId, attachmentViews 포함)로 즉시 커밋된다. busy send(steer 예약)는 현행 pending-first 유지.
3. **이중 버블 0 (멱등 합류)**: 낙관 커밋된 clientId 에 대해 `message.queued` 는 pending 항목을 만들지 않고, `message.committed` 는 중복 append 하지 않는다(reducer 멱등 가드 + store 스킵). 핸드오프 자동 메시지 등 낙관 커밋 없는 발화의 queued→pending→committed 승격 경로는 불변.
4. **롤백**: idle send 의 invoke 거부(`chatApi.send` reject) 시 낙관 커밋 버블이 제거된다(`DROP_UNCOMMITTED_USER`).
5. **steer 경로 불변**: busy 예약 → pending 버블 → 게이트 flush → echo 커밋 승격, hover 취소·중단 버튼 draft 복원 — 0067 동작 그대로(관련 기존 테스트 green).
6. **main 커밋 경로 불변**: `HistoryWriter.commitUserMessage`·echo 관측·큐 상태 머신·IPC 이벤트 스키마 무변경(`src/main` 의 커밋 로직 diff 0 — 계측 제외).
7. **wire 계측**: 디버그 "Wire 메시지" 토글 on 일 때 ① `input.echo` 관측(uuid·text 스니펫), ② `UserPromptSubmit`/`PostToolBatch` 훅 발화(이벤트명·session_id·prompt 스니펫·input 키 목록)가 `[wire]` 로그로 남는다. off 면 무출력(현행 DEV 가드 동형). 판정 목적: (a) push 프롬프트에 UserPromptSubmit 이 발화하는가 (b) echo↔어시스턴트 스트림 순서.
8. **게이트**: lint 0 · typecheck 3종 0 · vitest 전체 green(갱신 포함) · build green. 신규 의존성 0 · IPC 채널/이벤트 스키마 변경 0.

## 범위 / 비범위

- **범위**: renderer 표시 계층(chatStore·chatReducer·NewChatLandingPage) + wire 계측(infra/ipc/wire-log 분리·coordinator echo 로그·claude-adapt 훅 tap) + 테스트.
- **비범위**: main 커밋 신호 교체(echo→훅) — **실측 후 별도 결정**(아래 Open Question). CLI 자동 픽업 자동 프레임 오픈(0067 ⚠️ 계승). 0067 의 나머지 실측 항목(interrupt 생존·cap5 메모리).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `chatReducer.APPEND_COMMITTED_USER_MESSAGE`(clientId 파라미터 추가), `mergeHooks`(훅 조각 병합), 디버그 패널 wireLog 토글(0025).
- 전제: clientRequestId 가 큐 아이템 id 로 그대로 쓰인다(자료조사 id 정합 행) — 낙관 커밋↔echo 합류의 상관키.
- 신규 의존성: 없음.

## 설계

**W1 — renderer 낙관 커밋** (`chatReducer.ts` · `chatStore.ts` · `NewChatLandingPage.tsx`)

- `Message.clientId?: string` — 낙관 커밋↔서버 이벤트 합류 키(표시 무영향, DB 미영속 — 재로드 메시지는 없음).
- `APPEND_COMMITTED_USER_MESSAGE` 에 `clientId?` 추가: 동일 clientId 의 user 메시지가 이미 있으면 no-op(멱등).
- 신규 액션 `DROP_UNCOMMITTED_USER { clientId }`: 롤백 전용.
- `send()`: **새 세션 경로** = BEGIN_TURN + 낙관 커밋을 draft 엔트리에 함께 적용(pendingSteer 미추가). **기존 세션 idle(!busy)** = resetLive + BEGIN_TURN + 낙관 커밋, invoke `.catch` 는 DROP_UNCOMMITTED_USER. **busy** = 현행 pendingSteer 예약 유지.
- `receive()`: `message.queued` 는 해당 clientId 가 이미 커밋돼 있으면 skip. `message.committed` 는 `ev.ids` 중 커밋된 clientId 가 있으면 append skip(pending 제거는 유지), 없으면 `clientId=ev.ids[0]` 로 append.
- `NewChatLandingPage`: `isEmpty` 에 `&& !s.inflight`.

**W2 — wire 계측** (`infra/ipc/wire-log.ts` 신설 · `send.ts` · `turn-coordinator.ts` · `claude-adapt.ts` · `claude.ts` · `handlers/misc.ts`)

- `wire-log.ts`: electron 비의존 모듈 플래그 + `setWireLog`/`wireLog(label, data?)`. `send.ts` 는 이를 소비(무회귀 re-export). coordinator(features→infra ✅)·claude-adapt(adapters→infra ✅) 가 import 가능해진다.
- coordinator: `input.echo` 관측 지점에서 `wireLog('input.echo', {uuid, text 80자})`.
- claude-adapt: `makeHookWireTap()` — UserPromptSubmit·PostToolBatch 매처가 `wireLog('hook.<이벤트>', {session_id, prompt 스니펫, keys})` 만 남기고 `{}` 반환(fail-open, 게이트 훅과 별도 매처 — mergeHooks concat). claude.ts 에서 병합.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **재로드 후 커밋 도착**: LOAD_SESSION 으로 엔트리가 교체되면 clientId 소실 → committed 는 현행처럼 append(중복 없음 — 낙관 버블 자체가 사라진 상태). DB 정본과 동일 결과.
- **프렐류드 재전달**(채널 사망 이월): 원 send 에서 낙관 커밋된 항목이 respawn 프렐류드로 재주입돼도 echo ids 가 같아 멱등 skip — 이중 버블 없음.
- **핸드오프 자동 메시지**: renderer 가 본문을 모름 → 낙관 커밋 불가 → queued pending 경로 보존(AC3 후단).
- **연속 새-채팅 큐**(0040 게이트): 각 draft 가 자기 낙관 버블을 갖고 승격 시 엔트리째 이동 — 게이트 로직 무변경.
- **취소**: idle send 직후 중단 → 낙관 버블은 유지(이미 정식 커밋 표시), main 은 미소비 시 DB 미영속 — 표시↔DB 불일치 창이 생기나 재로드 시 DB 정본으로 수렴(트레이드오프 표 참조).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 낙관 커밋 버블 ↔ DB(echo 미소비 시 미영속) 불일치 창 — 스폰 실패·즉시 취소 시 라이브 화면엔 보이나 재로드엔 없음 | 0067 이전(선영속 시절 검증된 UX)과 동일한 표시 계약으로 회귀하는 것 — DB 진실은 echo 가 지키고, 에러 시 error 배너가 맥락 제공. 수용 |
| 훅 tap 이 모든 턴에 등록됨(로그 off 여도 콜백 발화) | 콜백은 플래그 체크 후 즉시 `{}` — 게이트 훅과 동일 비용 클래스. fail-open |
| **Open Question(사용자 결정)**: main 커밋 신호를 echo → 훅(UserPromptSubmit/PostToolBatch)으로 교체할지 | 본 핸드오프 비범위. AC7 계측 로그로 (a) push 프롬프트 UserPromptSubmit 발화 여부 (b) echo 순서를 실측한 뒤 결정 — 발화 안 하면 echo 유지 확정, 발화하고 순서 결정적이면 훅 커밋 단순화 후속 핸드오프 |

- 되돌리기 어려운 결정: 없음(전부 renderer 표시 계층 + 로그).

## 영향 받는 파일

- `app/src/renderer/src/features/chat/reducer/chatReducer.ts`
- `app/src/renderer/src/features/chat/store/chatStore.ts` (+ `chatStore.test.ts`)
- `app/src/renderer/src/pages/NewChatLandingPage.tsx`
- `app/src/main/infra/ipc/wire-log.ts` (신설) · `send.ts`
- `app/src/main/features/chat/turn-coordinator.ts`
- `app/src/main/adapters/claude-adapt.ts` (+ test) · `claude.ts`

## 참고 문서

- `docs/handoff/0067-long-lived-session-queue/{plan,verify}.md` (pending-first 원설계·실측 리스크 ②)
- https://code.claude.com/docs/en/hooks#hook-lifecycle (훅 라이프사이클 원문)
- IPC 변경 없음 — `docs/IPC_CONTRACT.md` 무변경(이벤트 스키마 동일).

## 게이트

- `cd app && npm run lint && npm run typecheck && npx vitest run && npm run build`
- 신규/갱신 테스트: chatStore(낙관 커밋·queued/committed 멱등·롤백·busy 불변), claude-adapt(훅 tap fail-open).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 버그 리포트·검토 의견을 라이브 세션 출처로 인용, 추론 2건 표기.
- [x] 자료조사 — 전 발견에 `파일:라인`·웹 URL 레퍼런스.
- [x] 인수 기준 — 8건 번호, 조사 근거, 검증 가능.
- [x] 의존 기술 — 신규 의존성 0.
- [x] 파생 UX — 재로드·프렐류드·핸드오프·연속 큐·취소 엣지 전개.
- [x] 리스크 — 표시↔DB 불일치 창 트레이드오프 명시, echo↔훅 교체는 Open Question 으로 분리.

---

## [구현자 기입] 설계 리뷰 (비판적)

(구현 턴에서 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|

## [구현자 기입] 구현 체크리스트

- [ ] W1 chatReducer — clientId·멱등·DROP_UNCOMMITTED_USER
- [ ] W1 chatStore — send 낙관 커밋·queued/committed 합류·롤백
- [ ] W1 NewChatLandingPage — !inflight 게이트
- [ ] W2 wire-log 분리 + echo/훅 tap
- [ ] 테스트 갱신 + 게이트 4종

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | (기입 예정) |
| 실행 명령 | `npm run lint` / `typecheck` / `npx vitest run` / `build` |
| 게이트 결과 | (기입 예정) |
| 블로커 / 역질문 | (기입 예정) |
| 대상 커밋 | (기입 예정) |
