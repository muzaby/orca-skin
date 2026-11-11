# Plan — 0311-bloat-reduction-pending-queue-claims

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0305 감사](../0305-code-bloat-audit/audit.md) §3 C-14·C-15·C-19·C-25 · §8 분해안 · §9 분할안 H-D, [0308 plan](../0308-bloat-reduction-legacy-migration-and-output-store/plan.md) D-006, [0307 plan](../0307-bloat-reduction-unreached-and-constant-args/plan.md) D-008이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0311-bloat-reduction-pending-queue-claims` |
| 작성자 | Claude Code |
| 일자 | 2026-11-11 |
| 매핑 | 0305 분할안 H-D(C-25 전부 · C-14 2단계). H-D의 나머지는 §4에서 제외 |
| 상태 | IMPL_DONE (r1) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0151·0166·0301의 대기열 V는 문서로 상속하지 않고, 그 테스트를 VP-05가 회귀로 다시 닫는다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 작업 — root `AGENTS.md` 협업 워크플로우) |
| 조사 기준 커밋 | `c72103b` (`git cat-file -t` → commit · PR 브랜치 좌표, `main` 조상 여부 미확인) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 응답 중 입력 대기열(`PendingMessageQueue`)이 한 배치를 두 이름(`uuid`·`attemptId`)으로 부르고, 호출부가 배치를 "claim" 객체로 한 번 더 옮겨 적는다. 제품이 부르지 않는 전이 메서드를 테스트 19곳이 대신 쓴다.
- 완료 후 달라지는 것: 배치 식별자가 `uuid` 하나다. 제출 확정·재개방은 배치를 그대로 받는다. 제품 호출이 없는 `commit`·`isFrozen`이 없고, 같은 검사를 네 번 적던 claim 메서드가 검사 하나를 공유한다.
- 성공을 사용자 관점에서 한 문장으로: 응답 중 보낸 입력이 지금과 똑같이 대기·취소·즉시 보내기·전달되고, 재시도와 중단 뒤에도 같은 입력이 두 번 전달되거나 사라지지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "305에서 검토한 내용을 최적화를 이어가려한다. 307~310까지 작업했다. 이어서 하라. Plan 까지 작성할 것" | 라이브 세션 턴 1 |
| 상속 | 회귀 금지 · 판정 단위는 시나리오별 관측 동작 · 목표는 코드 감량 · 백그라운드/서브 에이전트 금지 · 단계마다 커밋 | 0305 plan D-003 · D-011 · D-006 · D-007 |
| 상속 | C-25는 "H-D로 남는다" — `commit`은 테스트 7파일이 대기열을 `submitted`로 모는 수단이고 식별자 통합은 어댑터 계약 타입 변경이다 | 0308 plan D-006 |
| 추론 의도 | "이어서"는 0305 분할안에서 아직 다루지 않은 묶음 중 순위가 가장 앞선 H-D(4위)다. 남은 묶음은 H-D·H-G(7위)·H-J(10위)이고 H-H는 0307 D-004로 보류됐다 | 0305 audit §9 · 0307~0310 plan §6 |
| 추론 의도 | H-D 후보 가운데 재실측에서 순증이거나 사용자 관측 동작을 바꾸는 항목은 뺀다 — 회귀 금지와 감량 목표를 둘 다 지키는 범위(0309 D-006 · 0310 §2와 같은 처리) | §4 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이번 handoff는 0305 분할안 H-D를 다룬다 | 남은 묶음 중 순위가 가장 앞선다(§2 추론 행). 사용자가 다른 묶음을 고르면 새 handoff다 | 설계자 판단 | ACTIVE | — |
| D-002 | 회귀 금지. 판정 단위는 시나리오별 관측 동작이고, 내부 구조에 묶인 테스트는 통합·삭제할 수 있다 | 0305 D-003 | 0305 plan §3 | ACTIVE | — |
| D-003 | 목표는 코드 감량이다. CI·가드·테스트 인프라를 따로 줄이지 않는다 | 0305 D-011 | 0305 plan §3 | ACTIVE | — |
| D-004 | 백그라운드·서브 에이전트를 쓰지 않는다. 단계(M0·M1·M2)마다 커밋을 남긴다 | 0305 D-006 · D-007 | 0305 plan §3 | ACTIVE | — |
| D-005 | 구현 대상은 대기열 claim 표면이다 — (a) `commit`·`isFrozen` 삭제 (b) `attemptId`를 지우고 `uuid` 하나로 (c) claim 메서드가 배치를 그대로 받는다(`SubmissionAttempt`·`batchClaims`·`TurnRequestDeps.chainId` 삭제) (d) claim 4메서드의 공통 검사를 하나로 (e) `toPublic`을 나머지 펼침으로 | H-D 4후보 중 재실측에서 남은 것이 이것뿐이다(D-007~D-009). 근거는 §8 | 설계자 조사 | ACTIVE | 0308 D-006의 "H-D로 남는다"를 실행 |
| D-006 | 테스트 19곳의 `commit(sid, batch.attemptId!, batch.chainId)`는 `commitMany(sid, [batch])`로 바꾼다 | claim이 배치 그대로면 한 줄 치환이라 테스트가 늘지 않는다 — 0308 D-006이 든 제외 사유가 (c)와 함께 사라진다 | 설계자 조사 | ACTIVE | 0308 D-006(이번 범위 한정 제외)을 대체 |
| D-007 | C-15(`handleChatSend` 단계 함수 추출·공유 `let` 객체화·턴-후 루프 3분할)를 하지 않는다 | 추출은 함수 머리·인자 전달만큼 순증한다(D-003). "중복 준비 호출" 셋은 중복이 아니다(§4 전제 정정) | 설계자 조사 | ACTIVE | — |
| D-008 | C-19(renderer 예약 판정 제거·이벤트 4종 합치기)와 C-14 3단계를 하지 않는다 | renderer 판정을 걷으면 대기 버블이 IPC 왕복만큼 늦게 뜬다(감사 C-19 위험 칸) — 사용자 관측 변화다(D-002). `sendAdmission.ts:4-14`가 그 판정을 0153 결함의 수정으로 적는다 | 설계자 조사 | ACTIVE | 사용자가 동작 변경을 고르면 새 handoff |
| D-009 | C-14 2단계의 "대응 없는 메서드 합치기"는 claim 4메서드에만 적용한다 | public 28개 중 제품 호출이 없는 것은 `commit`·`isFrozen` 둘뿐이고(§8), 나머지는 호출 자리마다 다른 전이다 | 설계자 조사 | ACTIVE | — |
| D-010 | `SteerFlushBatch.chainId`는 optional로 둔다. `chainId`가 없는 claim은 어떤 추적 배치와도 일치하지 않는다 | 필수로 올리면 배치 리터럴을 쓰는 테스트 10곳 이상이 한 줄씩 는다(`rg -n "uuid: " app/src/main/app -g "*.test.*"`)(D-003). 대기열이 만든 배치는 전부 `chainId`를 갖는다(§8) | 설계자 판단 | ACTIVE | — |
| D-011 | 메서드 이름(`commitMany`·`canCommitMany`·`canReopenMany`·`reopenMany`)과 `residualAttemptIds`·`setResidualAttempts`·`messageCountForAttempts`를 바꾸지 않는다 | 이름 변경은 줄 수가 줄지 않고 테스트 20곳 이상을 건드린다(claim 메서드 이름만 테스트 21줄)(D-003) | 설계자 판단 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-011. D-002~D-004는 상속.
- D-001·D-005~D-011은 설계자 판단이다. 완료 보고에서 D-001(다음 묶음 선택)과 D-008(renderer 판정을 걷는 동작 변경)의 선택지를 알린다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0.
  - D-005(a)(b)(c) ↔ AC1: 부재를 EP-01·EP-02 검색 0줄로 요구한다.
  - D-005(c)(d) ↔ AC2: claim 규칙 K1~K8을 행동으로 요구한다. AC2는 메서드를 지우라고 하지 않는다(D-011).
  - D-005(e) ↔ AC3: 공개 배치의 키 집합을 요구한다.
  - D-002 ↔ AC4·AC5: 동작 기준이 "지금과 같다"이고 기대값은 변경 전 코드에서 얻는다(§7 주의사항).
  - D-007·D-008 ↔ AC6: `send.ts`·`post-turn.ts`의 구조와 renderer·IPC wire를 바꾸지 않는다 — AC6이 diff 범위로 본다.
  - D-010 ↔ AC2 K4: `chainId` 없는 claim의 불일치를 요구한다.
  - D-003 ↔ AC7: prod 순감과 test 비증가를 요구한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 같은 값을 두 이름으로 들면 폴백(`attemptId ?? uuid`)과 옮겨 적기(`batchClaims`)가 따라 생긴다 | `pending-message-queue.ts:57-58,481-482` · `turn-request.ts:83-92` |
| 이미 기존 코드가 충족하는가 | 아니오 | EP-01 70줄 12파일 · EP-02 19줄 7파일(§10) |
| 더 작은 해법이 있는가 | `commit`·`isFrozen`만 지우는 안은 테스트 19곳이 claim 객체 3줄씩으로 늘어 순증이다 — (c)와 함께 해야 줄어든다 | D-006 |
| 선행 자료의 주장을 코드와 대조했는가 | **전제 정정 5건** | 아래 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음. `app/src/main/AGENTS.md` chat-turn 작업 규칙 2("게터로 넘긴다")를 그대로 지킨다 | §16 |

전제 정정(0305 감사 주장 ↔ 현재 코드):

| 후보 | 감사 주장 | 재실측 | 처리 |
|---|---|---|---|
| C-14 | public 메서드 26개, 전이와 대응 없는 메서드를 합친다 | public 28개(getter 포함) 중 제품 호출 0은 `commit`·`isFrozen` 둘이다. `transaction`은 `reserveItem` 내부에서만 쓴다 | D-009 — 둘 삭제 + claim 4메서드만 합침 |
| C-15 | `prepareAgentExtensionProfile` 2회가 중복이다 | `send.ts:420`은 최초 턴, `:661`은 연속 턴마다 다시 준비하는 콜백 안이다 | D-007 — 제외 |
| C-15 | 하네스 `instructions` 설정을 2회 읽는다 | `:256`은 await 전 해석 입력의 지문, `:186`은 확장 조립 시점(연속 턴 포함)의 현재 값이다 | D-007 — 제외 |
| C-15 | 세션 행 재조회가 중복이다 | `:83`과 `:151` 사이에 `await normalizeAttachments`(`:134`)가 있고 `:149` 주석이 "둘 사이 await 없이"를 요구한다 | 0307 D-008과 같은 판정 — 제외 |
| C-25 | 폴백 `attemptId ?? uuid` 5곳 | 4곳이다 — `send.ts:636,762` · `turn-request.ts:90,114`. 대기열 안 `:541`은 `track`의 같은 폴백이다 | D-005(b) — 다섯 자리 모두 대상 |

조사에서 새로 본 것:

- `docs/arch/backend/runtime-ipc.md:72`가 `reserveHeld('turn-open')`이라 적지만 그 인자는 세션 키다(`pending-message-queue.ts:238-242`). 문서가 낡았다 — 이번에 그 호출 표기를 현재 시그니처에 맞춘다(AC1의 EP-04).
- `pending-message-queue.ts:573-574` 주석은 "모든 상태 판정은 여기 이름 중 하나를 쓴다"고 적지만 claim 4메서드는 상태 배열 리터럴을 쓴다(`:306,320,328,337`). (d)가 `awaitsReceipt`로 맞춘다.

- 사용자에게 올릴 결정: 없음. D-001·D-008은 완료 보고에 선택지로 적는다.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

UI 변화는 없다. 관측자는 앱 사용자(대기 버블·취소·즉시 보내기·재시도)와 하네스 어댑터(입력 인계 콜백 5종)다.

```text
[입력 예약] → 배치(uuid · chainId · ids) = 제출 중
  → [어댑터가 입력을 받기 직전] 제출 가능? — 배치 전부가 "제출 중"일 때만
  → [받음] 제출 확정 — 배치 전부를 "제출됨"으로
  ↘ [못 받음] 되돌림 — "제출 중" 배치만 대기로 복귀
[턴 재시도] 재개방 가능? → 재개방 — "제출됨"을 "제출 중"으로 되돌려 다음 시도가 다시 통과
[확정 신호] uuid로 지목 → 확정 → 대화에 커밋
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 유휴 세션 전송(S-04·S-05) | 예약 → 제출 확정 → 확정 신호로 커밋 | 지금과 같다 |
| 응답 중 전송·취소·즉시 보내기(S-06·S-07) | 대기 → 턴 종료 뒤 병합 예약 | 대기 버블·취소·순서가 지금과 같다 |
| 스트림 실패 재시도(0301) | 재개방 → 같은 입력을 새 시도에 다시 제출 | 입력이 한 번만 전달된다 |
| 다른 경로가 예약을 가져감(폐기·확정·되돌림) | 제출 가능·재개방이 거부된다 | 원래 오류로 끝나고 입력이 입력창으로 돌아온다 |
| 채널 사망 뒤 재전송 | 남은 배치가 새 `uuid`·새 `chainId`로 이월 | 옛 시도의 늦은 영수증이 새 배치를 확정하지 못한다 |
| 중단 뒤 잔여(S-09) | 잔여 `uuid`와 열린 배치를 대조해 잔여 수 표시 | 지금과 같다 |

### 파생 UX / 엣지케이스

- loading / empty / error: 변화 없음.
- cancel / retry / close / restart: 위 표. 종료 freeze는 `freeze()`가 그대로 막는다(`isFrozen`은 읽는 곳이 없었다).
- concurrency: 제출 가능 검사와 제출 확정 사이에 폐기가 끼어드는 순서를 K3이 잠근다(기존 `pending-message-queue.test.ts:448`).
- 외부 소비자: 어댑터가 읽는 배치 필드는 `uuid`·`text`·첨부뿐이다(`claude/adapter.ts:560` · `opencode/v1/channel.ts:312`). IPC 채널·스키마 변화 없음.

## 6. 범위 / 비범위

- **범위**: `pending-message-queue.ts`의 D-005 (a)~(e) · `adapters/common/turn.ts`의 `attemptId` 한 줄 · `turn-request.ts`의 `batchClaims`·`chainId` 의존 · `send.ts`의 폴백 2곳과 `chainId` 전달 1줄 · 딸린 테스트 · `runtime-ipc.md:72` 한 칸.
- **비범위**: `handleChatSend`·`post-turn.ts` 구조(D-007) · renderer 대기 프로토콜(D-008) · 메서드·잔여 API 이름(D-011) · `chainId` 필수화(D-010) · C-26(0307 D-009) · 그 밖의 분할안 묶음(H-G·H-J·H-H).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| C-15 · C-19 · C-14 3단계 | 아니오 | 사용자가 동작 변경·구조 변경을 고르면 새 handoff |
| H-G · H-J | 아니오 | 0305 분할안에 남는다 |
| 이름 변경(D-011) | 아니오 | 하지 않는다 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | `attemptId`·`SubmissionAttempt`·`batchClaims`·`isFrozen`과 대기열 `commit` 호출이 없다. 문서가 `reserveHeld`의 현재 인자를 적는다 | EP-01·EP-02·EP-04 검색 0줄 · typecheck 3종 | 해당 없음 — 부재 계약 |
| R-02 | AC2 | 제출 가능·제출 확정·재개방 가능·재개방이 §10 K1~K8대로 동작한다. claim은 배치 그대로다 | §7-A VP-02 좌표 | 어댑터 입력 인계 → `TurnRequest` 콜백 → 대기열 |
| R-03 | AC3 | 대기열이 돌려주는 배치는 계약 필드만 갖는다 — `uuid`·`chainId`·`ids`·`text`·`createdAt`과 실제로 있는 첨부 필드. 추적 필드(`state`·`items`)와 `attemptId`가 없다. 반환 경로 5곳 모두 | §7-A VP-03 좌표 P1 | `confirm`·`drainConfirmed`·`orphanUnconfirmed`·`discardSubmitted`·`takeForRespawn` → coordinator·post-turn |
| R-04 | AC4 | 채널 사망 이월은 남은 배치와 대기 항목에 새 `uuid`와 주어진 `chainId`를 붙이고 메시지 id를 보존한다. 잔여 수는 잔여 `uuid`와 일치하는 열린 배치의 메시지 수다 | §7-A VP-03 좌표 P3·P5 | `enqueue.ts:45` · `post-turn.ts:267` · `session-activity-projector.ts:230` |
| R-05 | AC5 | 재시도·되돌림·중단 복원·잔여·커밋의 종단 동작이 지금과 같다 | §7-A VP-04·VP-05의 기존 테스트가 단언 변경 없이 green(바뀌는 것은 `commit` 호출 꼴과 조립 인자뿐) | `handleChatSend` → `coordinator.run` → 대기열 |
| R-06 | AC6 | renderer·preload·IPC 계약과 `post-turn.ts`·`enqueue.ts`가 그대로다 | `git diff --stat <설계 커밋>..HEAD -- app/src/renderer app/src/preload app/src/shared app/src/main/app/chat-turn/post-turn.ts app/src/main/app/chat-turn/enqueue.ts` 0줄 | 화면 |
| R-07 | AC7 | prod 순감이 45줄 이상이고 test는 늘지 않는다. 수치를 보고한다 | `git diff --numstat <설계 커밋>..HEAD -- app/src`를 prod/test로 갈라 합산 | 해당 없음 |
| R-08 | AC8 | §19 게이트가 green이거나 실패가 기준선과 같은 환경 서명이다 | §19 명령 산출 | CI |
| R-09 | AC9 | 개발 빌드에서 응답 중 입력의 대기·취소·즉시 보내기·전달이 지금과 같다 | 사람 실기 — §19 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: 인용한 케이스는 이번 세션에 실재를 확인했다 — `pending-message-queue.test.ts:37,79,261,448,484,672~738` · `turn-request.reopen.test.ts:47,65,79` · `retry-submission.test.ts:83~211` · `session-activity-projector.test.ts:184`.
- 기대값의 출처: 새로 더하는 K·P 입력은 M0에서 **변경 전 코드에 옛 claim 꼴로 먼저 넣어 green**을 확인하고, M1에서 claim 꼴만 바꾼다(§11).
- 사람 실기 항목: AC9. 판정 로직은 AC2~AC5가 기계로 본다.
- 총량/0건 기준: AC1의 불변식은 "없다"라 음성 검색이 방향에 맞다. "배치 하나로 판정이 된다"의 양성 짝은 AC2다 — claim 항(`uuid`·`chainId`·`ids`)을 지우면 K4가 실패한다.
- AC3는 structural proxy가 아니다 — 키 집합은 coordinator가 커밋·wire에 싣는 객체의 실제 형태다.
- AC7의 45는 §14 단계 지도의 합(약 65)에서 포맷 오차를 뺀 값이다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 문서 V가 없다.
- 기준 V 상속 근거: 없음. 0151·0166·0301이 잠근 동작은 VP-05가 기존 테스트로 다시 닫는다.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: `AR↔IT` — 조립부(`turn-request.ts`)와 대기열 사이의 claim 계약이 바뀐다. `SD↔ST`는 새 노드 없이 회귀(VP-05)로 닫는다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-09 | R | §7 각 행 | NEW | — |
| AT-01~AT-09 | AT | §7 검증 수단 칸 | NEW | — |
| AR-01 | AR | `TurnRequest` 콜백 5종이 현재 초기 배치를 claim으로 넘긴다 — §9·§10 EP-03 | CHANGED | `turn-request.ts:83-126` |
| IT-01 | IT | §10 W1~W4 | CHANGED | `turn-request.reopen.test.ts` · `retry-submission.test.ts` |
| MD-01 | MD | claim 규칙 K1~K8 | CHANGED | `pending-message-queue.ts:304-347,594-608` |
| MD-02 | MD | 공개 배치 형태·식별자 P1~P5 | CHANGED | `:51-84,473-501,460-467` |
| UT-01·UT-02 | UT | §10 규칙 칸 ↔ UT 입력 칸 | CHANGED | `pending-message-queue.test.ts` |
| SD-01 | SD | 전송·재시도·중단의 종단 수명주기 | INHERITED | 0151 · 0166 · 0301 테스트 |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 소스 트리 | `gate:git grep` EP-01·EP-02·EP-04 → 0줄 · `gate:npm run typecheck` | not selected — 부재는 검색과 컴파일러가 직접 본다(타입에서 필드를 지우면 남은 참조는 TS2339다) | EP-01 70줄 12파일 · EP-02 19줄 7파일 · EP-04 1줄 |
| VP-02 | MD-01 ↔ UT-01 | REQUIRED | `canCommitMany`·`commitMany`·`canReopenMany`·`reopenMany`(claims) → 공통 검사(일치 항 4개 + 상태 집합) → 상태 전이 → 변경 알림 | §10 K1~K8 좌표 | required — 형제 슬롯(확정↔재개방, 검사↔전이)과 일치 항. 변이 (a)~(f)·(k) — §10 등록 변이 표 | EP-03 정의 4자리 |
| VP-03 | MD-02 ↔ UT-02 | REQUIRED | 예약(`toBatch`) → 추적 → 공개 변환(`toPublic`) → 반환 5경로 · 이월(`takeForRespawn`) · 잔여 수(`messageCountForAttempts`) | §10 P1~P5 좌표 | required — 형태 주장(키 부재)과 재발급. 변이 (g)·(h)·(j) | EP-05 5자리 + 재발급 2자리 + 잔여 1자리 |
| VP-04 | AR-01 ↔ IT-01 | REQUIRED | 어댑터 `req.canSubmitInitial()` 등 → `buildTurnRequest` 콜백 → `deps.getInitialBatches()`(호출 시점) → 대기열 claim 메서드 · `rollback(key, batch.uuid)` | §10 W1~W4 좌표 | required — 배선(게터 호출 시점·세션 키). 변이 (i)·(l) | EP-03 호출 7자리 |
| VP-05 | SD-01 ↔ ST(기존) | REGRESSION | `handleChatSend` → `coordinator.run` → 확정·커밋·잔여 | `retry-submission.test.ts` A~H · `turn-coordinator.test.ts` · `chat-turn.continuity.test.ts` · `response-boundary.integration.test.ts` · `post-turn.schedules.test.ts` · `bootstrap.native-history.test.ts` · `session-activity-projector.test.ts` 전체 | not selected — 단언을 바꾸지 않는 기존 종단 테스트다 | 0 — 새 자리 없음 |

R-06~R-09는 범위·측정·게이트·실기라 pair 없이 §19가 닫는다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/**` 수정 | §19 | 이번 변경이 만진 파일에서 난 실패와 기준선 밖 실패만 blocking |
| 테스트 풀·예산 가드 | 테스트 파일을 수정한다 | `[test-pools]` · `node scripts/check-test-budgets.mjs` | 만진 파일의 위반만 blocking |
| 문서 인벤토리·이름 검사기 | `docs/arch` 1파일 수정 | `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` | 전부 blocking |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 대기열이 배치를 만드는 자리는 셋이고 셋 다 `uuid === attemptId`다 | `toBatch` `:57-58`(호출 `:248,264,490`) · `takeForRespawn` `:478-482` · `:488-491` |
| 대기열이 만든 배치는 전부 `chainId`를 갖는다 | `toBatch` `:59` · `takeForRespawn` `:483,492` |
| `attemptId`를 읽는 제품 코드는 폴백 4곳과 대기열 내부뿐이다 | `git grep -n -w attemptId -- app/src ':!*.test.*'` → `turn.ts` 1 · `send.ts` 2 · `turn-request.ts` 4 · 대기열 |
| 어댑터는 배치에서 `uuid`만 식별자로 읽는다 | `claude/adapter.ts:560` · `opencode/v1/channel.ts:312` · `continuation.ts:73` · `send.ts:602` |
| `commit`의 제품 호출은 0, 테스트 호출은 19곳 7파일이다 | EP-02 |
| `isFrozen`은 테스트 1곳만 읽는다 | `pending-message-queue.test.ts:620` |
| claim 4메서드는 같은 일치 검사에 상태 집합과 전이 방향만 다르다 | `:304-347` · `selectAttempts` `:594-608` |
| `buildTurnRequest`의 `chainId` 의존은 `batch.chainId ?? chainId` 한 곳에서만 쓰인다 | `turn-request.ts:77,91` |
| `buildTurnRequest`를 부르는 테스트 조립 7곳은 모두 실제 대기열이 만든 배치를 넘긴다 — 폴백에 기대는 조립 0 | `post-turn.schedules.test.ts:169` · `adapter-input.test.ts:52` · `opencode-runtime.test.ts:207` · `turn-request.reopen.test.ts:26` · `concurrency-identity.testfixture.ts:186` · `opencode-continuation.test.ts:319` · `retry-submission.test.ts`(fixture 경유) |
| 재개방 가능과 재개방은 다른 시점에 불린다 — 둘 다 필요하다 | `turn-coordinator.ts:614`(재시도 판정) · `:637`(backoff 뒤) |
| 나머지 펼침으로 필드를 빼는 꼴은 lint를 통과한다 | `features/history/native-sync.ts:122` `const { raw, ...lean }` |
| `toPublic`의 조건부 복사와 나머지 펼침은 같은 키를 낸다 — 첨부 키는 `toBatch`가 값이 있을 때만 만들고(`:63-66`) `undefined`로 대입하는 자리가 없다 | `scrubBatch` `:96-104`는 빈 배열을 대입한다(현재도 복사된다) |
| 지우는 이름을 문자열·정규식으로 요구하는 소스 스윕 테스트·가드 스크립트가 없다 | EP-01·EP-02가 테스트 파일까지 훑은 결과가 전부 직접 호출 · `grep -n 'attemptId\|commitMany' app/scripts/*.mjs` → 0줄 |
| 문서의 제거 이름 참조는 0줄이다 | `rg -n 'attemptId\|isFrozen\|commitMany\|SubmissionAttempt' docs/arch docs/IPC_CONTRACT.md docs/GLOSSARY.md docs/TRD.md docs/guides app/AGENTS.md app/src/main/AGENTS.md` |
| INDEX 후보 표에 이번 파일과 겹치는 행이 없다 | 0308 행은 `chatStore.ts`·`background-controller.ts`, 0296 행은 `send.wait-phase.test.ts`의 `clientKey` 하네스(대기열 claim과 무관) |

### 전수 조사 — 대기열 public 표면 (D-009)

| 묶음 | 메서드 | N | 제품 호출 자리 |
|---|---|---|---|
| 구독·수명 | `subscribe` · `freeze` · `rekey` · `dispose` · `disposeAll` | 5 | projector · bootstrap · coordinator |
| 적재·취소 | `enqueue` · `cancel` · `cancelAllHeld` · `pending` | 4 | `enqueue.ts` · `send.ts` · `index.ts` · `post-turn.ts` |
| 예약·이월 | `reserveHeld` · `reserveItem` · `takeForRespawn` · `rollback` | 4 | `enqueue.ts` · `post-turn.ts` · `send.ts` · `turn-request.ts` |
| claim | `canCommitMany` · `commitMany` · `canReopenMany` · `reopenMany` | 4 | `turn-request.ts:97,101,124,126` |
| 확정·폐기 | `confirm` · `drainConfirmed` · `orphanUnconfirmed` · `discardSubmitted` | 4 | coordinator · `post-turn.ts` · `send.ts` · `discard.ts` |
| 조회 | `hasSubmitted` · `submittedUuids` · `counts` · `messageCountForAttempts` | 4 | `post-turn.ts` · `turn-request.ts` · projector |
| 내부 전용 | `transaction` | 1 | `reserveItem` 안(`:260`) — 외부 호출 0 |
| 제품 호출 0 | `commit` · `isFrozen` | 2 | 없음 — 삭제 |

### 수치 / 전칭 표현 검산

- public 28 = 5 + 4 + 4 + 4 + 4 + 4 + 1 + 2. 변경 뒤 26.
- EP-01 70줄 = `turn.ts` 1 + `send.ts` 2 + `turn-request.ts` 8 + 대기열 27(prod 38) + 테스트 8파일 32(`pending-message-queue.test` 14 · `turn-coordinator.test` 8 · `retry-submission.test` 3 · `response-boundary` 2 · `projector.test` 2 · `native-history` 1 · `continuity` 1 · `post-turn.schedules` 1).
- EP-02 19줄 = 8 + 4 + 2 + 2 + 1 + 1 + 1.
- "셋 다 `uuid === attemptId`": 대기열에서 `uuid:`를 대입하는 줄은 `:57,73,481`이고 `:73`은 복사다 — `git grep -n 'uuid[:,]' -- app/src/main/features/chat/pending-message-queue.ts`.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

```text
turn-request.ts
  batchClaims() = getInitialBatches().map(b => ({ messageIds: b.ids,
                    attemptId: b.attemptId ?? b.uuid, chainId: b.chainId ?? chainId }))
  canSubmitInitial      → queue.canCommitMany(key, batchClaims())
  commitInitial…        → queue.commitMany(key, batchClaims())
  rollbackInitial…      → queue.rollback(key, b.attemptId ?? b.uuid)
  canReopen… / reopen…  → queue.canReopenMany / reopenMany(key, batchClaims())

pending-message-queue.ts
  SteerFlushBatch { uuid, attemptId?, chainId? }   TrackedBatch { attemptId, chainId, state, items }
  commit(attemptId, chainId?)            ← 테스트만
  commitMany / canCommitMany / canReopenMany / reopenMany
      각자 selectAttempts(batches, attempts, [상태 리터럴]) + 전이 루프
  toPublic: 필드 10개를 하나씩 다시 복사
```

- 같은 값을 두 이름으로 들어 폴백 5자리와 옮겨 적기 1자리가 생겼다.
- 네 메서드가 "전부 일치해야 한다"는 검사를 따로 적는다.

### TO-BE — 변경 후 목표 구조와 동작 경로

```text
turn-request.ts
  canSubmitInitial      → queue.canCommitMany(key, getInitialBatches())
  commitInitial…        → queue.commitMany(key, getInitialBatches())
  rollbackInitial…      → queue.rollback(key, b.uuid)
  canReopen… / reopen…  → queue.canReopenMany / reopenMany(key, getInitialBatches())

pending-message-queue.ts
  SteerFlushBatch { uuid, chainId? }     TrackedBatch { chainId: string, state, items }
  claim = Pick<SteerFlushBatch, 'uuid' | 'chainId' | 'ids'>
  claimed(sessionId, claims, 상태 술어) → TrackedBatch[] | undefined   (하나라도 불일치면 undefined)
  canCommitMany  = claimed(…, submitting만) 있음
  canReopenMany  = claimed(…, awaitsReceipt) 있음
  commitMany     = move(…, 'submitted')     reopenMany = move(…, 'submitting')
  move: claimed(…, awaitsReceipt) 없으면 false · 목표 상태가 아닌 것만 전이 · 바뀐 것이 있으면 알림 1회
  toPublic: const { state, items, ...rest } = batch → rest
```

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | 구현/AC |
|---|---|---|---|
| 배치 식별자 | `uuid` + `attemptId`(같은 값) | `uuid` | M1 · AC1·AC4 |
| claim 꼴 | `{messageIds, attemptId, chainId}`로 옮겨 적음 | 배치 그대로(`uuid`·`chainId`·`ids`) | M1 · AC2 |
| `chainId` 폴백 | 조립부가 lease 값으로 채움 | 없음 — `chainId` 없는 claim은 불일치(D-010) | M1 · AC2 K4 |
| 제품 호출 0 메서드 | `commit`·`isFrozen` | 삭제(이동 아님) | M1 · AC1 |
| claim 검사 | 4벌 | 1벌(`claimed`) + 전이 1벌(`move`) | M2 · AC2 |
| 공개 변환 | 필드별 복사 | 추적 필드 2개만 뺌 | M2 · AC3 |
| `send.ts`·`post-turn.ts` 구조 · renderer | — | 그대로 | AC6 |

### 핵심 책임 분리

- `features/chat/pending-message-queue.ts`: claim 일치·상태 전이의 유일한 자리. 상태 술어는 파일 끝 어휘(`isOpen`·`awaitsReceipt`·`receiptSettled`)만 쓴다.
- `app/chat-turn/turn-request.ts`: 세션 키 선택과 소유권 표시 발신. 배치는 게터로 호출 시점에 읽는다(`app/src/main/AGENTS.md` chat-turn 작업 규칙 2).
- import 방향 변화 없음(app → features → adapters).

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| R-01 / VP-01 — EP-01 | `attemptId`·`SubmissionAttempt`·`batchClaims`·`isFrozen` 부재 | 이 표 | 구현자 | 70줄 12파일(prod 4파일 38줄 · test 8파일 32줄) | `git grep -n -w -E 'attemptId\|SubmissionAttempt\|batchClaims\|isFrozen' -- app/src \| grep -v 'Object.isFrozen'` → 0줄 | 두 이름이 남는다. 게이트가 green인 채로 남는 차이: `attemptIds`(복수형 — `messageCountForAttempts`·`setResidualAttempts` 인자)는 `-w`가 세지 않는다 — D-011로 남기는 이름이다 |
| R-01 / VP-01 — EP-02 | 대기열 `commit` 호출 부재 | 이 표 | 구현자 | 19줄 7파일(전부 테스트) | `git grep -n -E '(pendingMessages\|queue\|q)\.commit\(' -- app/src` → 0줄 | 지운 메서드를 부른다(typecheck도 잡는다) |
| R-01 / VP-01 — EP-04 | 문서의 `reserveHeld` 호출 표기 | `docs/arch/backend/runtime-ipc.md` | 구현자 | 1줄(`:72`) | `git grep -n "reserveHeld('turn-open')" -- docs/arch` → 0줄 | 문서가 없는 인자를 적는다 |
| AR-01·MD-01 / VP-02·VP-04 — EP-03 | claim 일치·상태 전이와 그 호출 | 대기열 `claimed`·`move` | 구현자 | 정의 4자리(`canCommitMany`·`commitMany`·`canReopenMany`·`reopenMany`) + 호출 7자리(`turn-request.ts` 5 — 제출 가능·제출 확정·되돌림·재개방 가능·재개방, `send.ts` 되돌림 2) | `git grep -n -E 'canCommitMany\|commitMany\|canReopenMany\|reopenMany\|\.rollback\(' -- app/src/main ':!*.test.*' ':!*.testfixture.*'`(주석 줄 제외) | 다른 경로가 가져간 입력을 다시 보내거나(이중 전달), 보낼 수 있는 입력을 막는다(턴 실패) |
| MD-02 / VP-03 — EP-05 | 공개 배치 형태 · 재발급 · 잔여 수 | 대기열 `toPublic`·`takeForRespawn`·`messageCountForAttempts` | 구현자 | `toPublic` 호출 5자리(`confirm` 2 · `orphanUnconfirmed` · `takeForRespawn` · `remove`) + 재발급 2자리(이월 배치 · 대기 항목) + 잔여 대조 1자리 | `git grep -n -E 'toPublic\|randomUUID\(\)\|attemptIds\.has' -- app/src/main/features/chat/pending-message-queue.ts` | 추적 필드가 커밋·wire로 새거나, 옛 시도의 영수증이 새 배치를 확정하거나, 잔여 수가 틀린다 |

선언 경계:

- `chainId` 없는 claim은 불일치다(D-010). 대기열 밖에서 손으로 만든 배치를 claim으로 쓰는 제품 경로는 없다 — `setInitialBatches` 대입 2자리(`send.ts:487` · `post-turn.ts:272`)가 모두 대기열 반환값이다.
- 포크·배포 확장은 `SteerFlushBatch`를 만들지 않는다 — `docs/guides/closed-network-extensions.md`에 `SteerFlushBatch`·`attemptId` 0줄.
- `hasSubmitted`·`submittedUuids`의 중복(`:439-449`)은 다루지 않는다 — 주석이 배열 생성을 피하려 둔 술어라고 적는다.

규칙 칸 ↔ UT 입력 칸(픽스처: 세션 `s`, 메시지 `a`·`b`를 `reserveItem(…, 'chain-1')`로 따로 예약한 claim 2개 — 기존 `retry reopen` describe의 `setup()`):

| 규칙 | 분기 | 입력 | 기대 | 좌표 |
|---|---|---|---|---|
| K1 제출 확정 | 전부 제출 중 | `commitMany('s', claims)` | `true` · `submittedUuids` = 두 `uuid` · 알림 1회 | `pending-message-queue.test.ts` 추가 ① |
| K2 | 일부·전부 이미 제출됨 | ① 뒤 다시 `commitMany` / 하나만 먼저 확정한 뒤 둘 | 둘 다 `true` · 전부 제출됨이면 알림 0, 하나만 바뀌면 알림 1 | 추가 ② |
| K3 | 하나라도 확정됨·orphaned·대기로 복귀·폐기됨 | 둘째를 각 상태로 만든 뒤 `commitMany('s', claims)` | `false` · 첫째도 제출 중 그대로(`canCommitMany('s', [claims[0]])` 참) · 알림 0 | 추가 ③(`it.each` 4) · 폐기는 `:448` 기존 |
| K4 일치 항 | `uuid` 다름 / `chainId` 다름 / `chainId` 없음 / `ids` 다름 / `ids` 순서 다름 | `[{...claims[0], 항: 다른 값}]`(순서는 `reserveHeld` 병합 배치 `['a','b']` → `['b','a']`) | 네 메서드 모두 `false` · 상태 불변 | 추가 ④(`it.each` 5) · 재개방 쪽 chain·ids는 `Q7` 기존 |
| K5 제출 가능 | 전부 제출 중 / 하나가 제출됨 | ① 앞 / ① 뒤 | `true` / `false` | `turn-request.reopen.test.ts` W1(`:47`) 기존 + 추가 ① |
| K6 재개방 | Q1~Q7 | 기존 | 기존 | `:672~730` — claim 꼴만 치환 |
| K7 검사는 상태를 안 바꾼다 | `canCommitMany`·`canReopenMany` | ① 앞뒤로 호출 | 알림 0 · 상태 불변 | `Q2`(`:688`) 기존 + 추가 ① |
| K8 빈 claim | 네 메서드 | `[]` | 전부 `true` · 알림 0 | `Q8`(`:738`) 기존 + 추가 ⑤(확정 쪽) |
| P1 공개 형태 | 반환 5경로 × 첨부 있음/없음 | 첨부 텍스트·요구 있는 메시지 1 + 없는 메시지 1을 각 경로로 | `Object.keys` 정렬 = 계약 키(있는 첨부 키만) · `state`·`items`·`attemptId` 없음 | 추가 ⑥ · `reserveHeld` 반환은 `:37` 기존(키 목록에서 `attemptId` 삭제) |
| P2 예약 식별자 | 아이템 단위 / 병합(값 지정·미지정) | 기존 | `uuid` = 항목 id / 준 값 / 새 값 | `:79` · `:37` · `:125` 기존 |
| P3 이월 재발급 | 남은 배치 / 대기 항목 / 확정분 | 기존 `:484` 입력 | 새 `uuid`(옛 값·항목 id 아님) · `chainId` = 준 값 · `ids` 보존 · 확정분 제외 · `canCommitMany` 참 | `:484` 기존 + 마지막 단언 추가 · ABA는 `:338` 기존 |
| P4 되돌림 | 제출 중 / 그 밖 | 기존 | 기존 | `:101~153` 기존 |
| P5 잔여 수 | 잔여 `uuid` 일치·중복·모르는 값 | `setResidualAttempts('s', ['a1','a1','unknown'])` | `residualCount` 1 | `session-activity-projector.test.ts:184` 기존 |
| W1 배선 키 | 저장된 세션(DB id) / 새 세션(큐 키) | 기존 | 기존 | `turn-request.reopen.test.ts:47` |
| W2 게터 시점 | 배치가 바뀐 뒤 호출 | 기존 W3 | 새 배치로 판정 | `:65` |
| W3 재개방 거부 | 확정됨 / 되돌려짐 × 키 2 | 기존 | 기존 | `:79` |
| W4 되돌림 발신 | 되돌림 성공 + 세션 id 있음 / 없음 | 제출 중 배치로 `rollbackInitialSubmission()` | 대기 복귀 · `message.submitted(false)` 1회 / 0회 | `turn-request.reopen.test.ts` 추가 ⑦ |

등록 변이(심을 자리):

| ID | 자리 | 변이 | 기대 red |
|---|---|---|---|
| (a) | `claimed` | `ids` 일치 항 제거 | K4 |
| (b) | `claimed` | `chainId` 일치 항 제거 | K4 · Q7 |
| (c) | `move` | 상태 술어를 `isOpen`으로(orphaned 허용) | K3 · Q5 |
| (d) | `move` | 검사 없이 일치하는 것부터 전이(부분 전이) | K3 |
| (e) | `canCommitMany` | 술어를 `awaitsReceipt`로(제출됨 허용) | K5 · W1 |
| (f) | `commitMany`↔`reopenMany` | 목표 상태 맞바꿈 | K1 · Q1 |
| (g) | `toPublic` | 배치를 그대로 반환 | P1 |
| (h) | `takeForRespawn` 2자리 | 재발급 제거(옛 `uuid`·항목 id 유지) — 자리마다 | P3 |
| (i) | `turn-request.ts` | `getInitialBatches()`를 조립 시점에 한 번 읽어 캡처 | W2 |
| (j) | `messageCountForAttempts` | `uuid` 대조를 지워 열린 배치 전부를 셈 | P5(`unknown`만 준 입력을 더해 0 확인) |
| (k) | `move` | 바뀐 것이 없어도 알림 | K2 · Q2 |
| (l) | `turn-request.ts` 5자리 | 세션 키를 `queueKey`로 고정 — 자리마다 | W1(저장된 세션) · W4 |

## 11. 구현 설계

- 접근 요약: 기대값을 먼저 잠그고(M0), 계약을 줄이고(M1), 내부를 합친다(M2). 세 커밋이다(D-004).
- 단계별 구현:
  1. **M0 — 잠금 먼저**. §10의 추가 ①~⑦과 P3 단언, (j)의 입력을 **변경 전 코드에** 옛 claim 꼴(`{messageIds, attemptId, chainId}`)로 넣어 green을 확인한다. P1의 키 목록은 이 단계에서 `attemptId`를 포함한 현재 형태로 적는다.
  2. **M1 — 계약 축소**. `turn.ts`의 `attemptId`를 지우고 컴파일 오류를 따라 닫는다 — 대기열(`toBatch`·`TrackedBatch`·`track`·`takeForRespawn`·`selectAttempts`·`messageCountForAttempts`), 폴백 4곳, `batchClaims`, `TurnRequestDeps.chainId`와 그 전달(`send.ts:570` · 테스트 조립). claim 타입을 `Pick<SteerFlushBatch, 'uuid' | 'chainId' | 'ids'>`로 바꾸고 `commit`·`isFrozen`을 지운다. 테스트는 EP-02 19곳을 `commitMany(sid, [batch])`로, claim 리터럴을 배치 꼴로, P1 키 목록에서 `attemptId`를 뺀다. `reserveHeld`의 둘째 매개변수 이름은 `uuid`로 한다. `runtime-ipc.md:72`를 고친다.
  3. **M2 — 내부 합치기**. §9 TO-BE의 `claimed`·`move`와 `toPublic`. 테스트 파일은 건드리지 않는다 — M1 뒤의 테스트가 그대로 green인 것이 증거다.
- 변경하지 않는 것: `post-turn.ts` · `enqueue.ts` · renderer · `shared/` · 메서드 이름 · `hasSubmitted`·`submittedUuids` · `transaction`.

### 테스트 가능성

| 대상 | seam / 주입점 | 테스트 종류 | 이유 |
|---|---|---|---|
| claim 규칙·공개 형태 | `new PendingMessageQueue()`(순수 메모리) | UT | electron·DB 의존 없음 — unit 풀 |
| 배선 | `buildTurnRequest` + 실제 대기열 + 가짜 `WebContents`(기존 `assemble`) | IT | 양 끝(콜백 호출 → 대기열 상태·`send` 호출)을 mock하지 않는다 |

## 12. End-to-end 영향

### producer → consumer

| producer | 정규화/상태 | consumer | 계약 유지 방법 |
|---|---|---|---|
| 대기열 예약(`reserveItem`·`reserveHeld`·`takeForRespawn`) | 추적 배치 | 어댑터(`uuid`·`text`·첨부) · coordinator(`uuid`로 확정) · projector(`uuid`로 잔여) | 어댑터·coordinator·projector diff 0 — 읽는 필드가 그대로다 |
| `TurnRequest` 콜백 5종 | claim = 현재 초기 배치 | `session-runtime.ts:444~504` · `turn-coordinator.ts:614,637` · `opencode/v1/channel.ts:387` | 콜백 시그니처 불변 — 세 파일 diff 0 |

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음 — 등록·초기화 값을 늘리지 않는다.

## 13. Lifecycle / 오류 / 정리

| 상황 | 동작 | 사용자/운영 로그/정리 |
|---|---|---|
| 제출 가능 검사 실패 | 지금과 같이 어댑터가 되돌림을 부른다(`session-runtime.ts:483`) | 변화 없음 |
| 종료 freeze | `freeze()` 뒤 적재는 `app_closing`, 예약은 `undefined` | 변화 없음 — `:617,624,634` 테스트 유지(`isFrozen` 단언 1줄만 삭제) |
| 세션 폐기 | `dispose`가 스크럽 | 변화 없음 |

## 14. 성능 / 상한 / 최적화

- 예상 호출량·출력 크기: 변화 없음. claim 객체 배열 생성이 호출마다 1회 준다.
- 구조적 목표의 단계 지도(prod 줄):

| 자리 | 줄 |
|---|---|
| `SubmissionAttempt` 6 · `TrackedBatch`·`toBatch`·`track`·`takeForRespawn`의 `attemptId` 8 · `isFrozen` 4 · `commit` 13 | 31 |
| claim 4메서드 44줄 → 약 28줄 | 16 |
| `toPublic` 14줄 → 약 4줄 | 10 |
| `turn-request.ts` `batchClaims` 10 · `chainId` 의존 2 · `send.ts` 1 · `turn.ts` 1 | 14 |
| 합 | 약 71(추가되는 `claimed`·`move` 머리 약 6을 빼면 약 65) |

- test: `chainId:` 조립 인자 7줄 · `retry-submission.test`의 claim 헬퍼 약 6줄 · `attemptId` 단언 약 4줄이 줄고, K·P·W 추가가 약 60줄 는다 — AC7의 "test는 늘지 않는다"를 맞추려면 추가 ①~⑤를 기존 `retry reopen` describe의 `setup()`·`both()`를 재사용하는 `it.each`로 쓰고, 그래도 순증이면 수치와 함께 보고한다(구현자가 AC7을 ⚠️로 적는다 — 잠금을 줄여 맞추지 않는다).
- 최적화로 생략되는 부수 효과: 없음.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — `SteerFlushBatch`는 main 내부 어댑터 계약이고 배포 확장 문서가 지목하지 않는다(§10 선언 경계).

## 16. 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 관계 | 근거 |
|---|---|---|
| `app/src/main/AGENTS.md` chat-turn 작업 규칙 2 — `activeTurn`·`initialBatches`는 게터로 | 유지 | W2 · 변이 (i) |
| 0151 AC4 — 되돌림은 제출 중만 | 유지 | P4 |
| 0166 D9 — `uuid` 영수증은 제출 중도 확정 | 유지 — `confirm`을 건드리지 않는다 | `:224,233` 기존 테스트 |
| 0301 R-02 — 재시도는 같은 예약을 다시 보낸다 | 유지 | K6 · `retry-submission.test.ts` A~H |
| 대기열 상태 어휘 주석(`:573-577`) | 따른다 — claim 검사가 `awaitsReceipt`를 쓴다 | §9 TO-BE |
| 0308 D-006 — C-25 제외 | 대체 | D-006 |
| `docs/AGENTS.md` "`arch/`에 이력을 쓰지 않는다" | 따른다 — 표기만 현재 값으로 | EP-04 |

## 17. 리스크 / 트레이드오프

| 리스크 | 영향 | 대응 |
|---|---|---|
| 합치며 "하나라도 불일치면 아무것도 안 바꾼다"가 깨진다 | 일부만 제출됨으로 남아 이중 전달·영구 busy | K3 · 변이 (d) |
| `chainId` 폴백 제거가 숨은 경로를 막는다 | 턴이 제출 가능 검사에서 실패 | §8 — 대입 2자리·테스트 조립 7곳 전부 대기열 배치. VP-05 종단 테스트 |
| `toPublic`이 새 추적 필드를 흘린다(나중에 `TrackedBatch`에 필드가 늘 때) | 내부 필드가 wire로 샌다 | P1이 키 집합을 정확히 대조한다 — 새 필드는 red |
| test가 순증한다 | AC7 미달 | §14 — `it.each`로 쓰고, 순증이면 ⚠️ 보고 |

## 18. 영향 받는 파일 / 문서

| 파일 / 문서 | 변경 | V pair / AC |
|---|---|---|
| `app/src/main/features/chat/pending-message-queue.ts` | D-005 (a)~(e) | VP-01·02·03 |
| `app/src/main/adapters/common/turn.ts` | `attemptId` 삭제 | VP-01 |
| `app/src/main/app/chat-turn/turn-request.ts` · `send.ts` | `batchClaims`·폴백·`chainId` 의존 삭제 | VP-01·04 |
| test: EP-01·EP-02의 8파일(합집합 — EP-02 7파일은 EP-01에 포함) + `buildTurnRequest` 조립 7곳 + `turn-request.reopen.test.ts` | 호출 꼴 치환 · K·P·W 추가 | VP-02·03·04·05 |
| `docs/arch/backend/runtime-ipc.md` | `:72` 표기 정정 | VP-01 |
| `docs/handoff/INDEX.md` | 보드 행 | — |

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` — better-sqlite3 ABI · 제약 환경 게이트 가이드, 로컬 확인 목록 · `app/src/main/AGENTS.md`.
- 환경 제약: 이 환경은 `app/node_modules`가 없다 — 구현 턴이 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`로 설치한다. 0310 r1 verify의 기준선(vitest 실패 29파일·22케이스)과 차집합으로 분리한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 가드 스크립트: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs`.
- 테스트: 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"`.
- 이번 handoff 전용: EP-01·EP-02·EP-04 검색 · AC6 diff 범위 · AC7 numstat.
- 사람 실기(AC9): 개발 빌드에서 (a) 응답 중 메시지 2개를 보내면 대기 버블 2개가 뜨고 응답이 끝나면 한 버블로 전달된다 (b) 대기 버블을 취소하면 입력창으로 돌아온다 (c) "즉시 보내기"가 진행 중 응답을 끊고 대기 입력을 보낸다 (d) 응답 중 중단을 누르면 대기 입력이 입력창으로 돌아온다.

## READY self-review

- [x] Decision Ledger — D-001~D-011, 상속 3건은 출처 plan을 적었고 0308 D-006의 대체를 D-006에 적었다.
- [x] Part I의 §5 흐름·전이 표만으로 완료 상태를 설명한다.
- [x] 사용자 문장 "이어서 하라"를 §2에 원문으로 두고 범위 해석은 추론 행으로 갈랐다(D-001).
- [x] Product/UX 핵심 동작(제출 확정·재개방·이월·잔여) ↔ AC2~AC5 ↔ §9·§10.
- [x] AS-IS·TO-BE를 같은 축(호출부 5콜백 · 대기열 타입·메서드)으로 적었다.
- [x] Delta 7행이 M1·M2·AC에 연결된다. 사라지는 책임(`commit`·`isFrozen`·`chainId` 폴백)은 삭제로 적었다.
- [x] 수치 실측: public `28` · EP-01 `70줄 12파일` · EP-02 `19줄 7파일` · 폴백 `4 + 1` · 테스트 조립 `7`.
- [x] 각 AC가 동작 기준·검증 수단·도달 경로를 가진다 — §7.
- [x] Baseline V. `NEW`·`CHANGED` node마다 같은 레벨 `REQUIRED` pair — R↔AT VP-01, MD↔UT VP-02·03, AR↔IT VP-04.
- [x] 영향받는 상위(`SD-01`)는 VP-05 `REGRESSION`. `NOT_REQUIRED` 행 없음.
- [x] pair마다 path·§10 자리·검색 명령·좌표. 적대 증거는 VP-02·03·04만 이유와 함께.
- [x] 규칙 칸 분기 K1~K8·P1~P5·W1~W4마다 입력이 있다 — K3 4상태, K4 5항, P1 5경로 × 첨부 2.
- [x] 선언 경계 3건은 측정값과 함께 적었다. 열린 입력 집합 판정 산출물은 만들지 않는다.
- [x] INDEX 후보 표 겹침 0 — §8 마지막 행.
- [x] 운영 gate 4행.
- [x] 사람 실기는 AC9의 실환경뿐이다.
- [x] structural proxy만으로 닫는 semantic AC 없음 — AC1의 음성 검색은 AC2(K4)와 짝.
- [x] 신규 계약 없음. 줄어든 claim 타입의 SSOT·강제 지점·seam은 §9·§10·§11.
- [x] 부팅/등록 변경 없음.
- [x] producer/consumer — §12, 어댑터·coordinator·projector·runtime diff 0.
- [x] 상한·one-way door: 해당 없음(내부 타입, git으로 되돌린다).
- [x] 게이트 명령이 `app/AGENTS.md` 로컬 확인 목록과 같다.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 갱신 메모에 적었다 — 충돌 0.
- [x] 문장 규칙 — 표 칸 3줄·문단 3문장.


---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §9).

## [구현자 기입] 설계 리뷰 — r1

- 동의 / 그대로 진행: Part I·II 전부. §10 자리 수(EP-01 70줄 12파일 · EP-02 19줄 7파일 · EP-04 1줄)가 착수 시 재실행값과 일치했다.
- 이견 / 현실성 문제: §8 "나머지 펼침으로 필드를 빼는 꼴은 lint를 통과한다"가 틀렸다 — `native-sync.ts:122`의 `raw`는 뒤에서 쓰인다. 쓰지 않는 형제는 `@typescript-eslint/no-unused-vars` error다. 아래 `설계 대비 명시적 차이`.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) — r1

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 | 제거 이름·`commit` 호출·문서 표기 부재 | EP-01 70줄 12파일 · EP-02 19줄 7파일 · EP-04 1줄 | 70/70 · 19/19 · 1/1 | §10 EP-01·EP-02·EP-04 명령 → 착수 70·19·1줄, 종료 0·0·0줄(차집합 = 전부 제거) · `gate:npm run typecheck` error 0 | 운반 항 없음(부재 계약) — 양성 짝은 VP-02 K4 | — |
| VP-02 | claim 일치·상태 전이 | EP-03 정의 4자리 | 4/4 | §10 EP-03 명령 → 정의 4줄(`pending-message-queue.ts:278,282,289,295`), 목록과 차 0 · K1·K2·K3·K4·K8 = `pending-message-queue.test.ts`:'K1 commits every submitting claim…' · 'K2 accepts already submitted claims…' · 'K3 refuses to commit when one claim is %s…'(4) · 'K4 no claim method matches a claim with %s'(5) · 'Q8 accepts an empty claim list' · K6·K7 = 같은 파일 Q1~Q7 | `uuid` `u1`≠`other` · `chainId` `chain-1`≠`other`·없음 · `ids` `['a','b']`≠`['a']`·`['b','a']` → 네 메서드 반환값과 알림 수 · 상태 4종(확정·orphaned·대기·폐기) → 첫 claim의 `canCommitMany` | — |
| VP-03 | 공개 형태·재발급·잔여 수 | EP-05 `toPublic` 호출 5자리 + 재발급 2자리 + 잔여 1자리 | 5/5 · 2/2 · 1/1 | §10 EP-05 명령 → `toPublic` 호출 `:358,371,400,473,509` · 재발급 `:463,468` · 잔여 `:447`, 목록과 차 0 · P1 = 'P1 %s returns contract fields only'(6 — `confirm` 2갈래 포함) · P3 = 'takeForRespawn 은 미확정 예약 재전달 + held 아이템 배치를 시간순으로 회수한다' · 'takeForRespawn 이 새 chainId 를 붙이면…(ABA 차단)' · P5 = `session-activity-projector.test.ts`:'interrupt 생존 attempt만 residual로 세고…' | 첨부 있는 배치 `a`와 없는 배치 `b` → `Object.keys` · 옛 `uuid` `batch-1`·항목 id `b` → 새 `uuid`에 없음 · 잔여 `['a1','a1','unknown']` → 1, `['unknown']` → 0 | — |
| VP-04 | 콜백 → 대기열 배선 | EP-03 호출 7자리 | 7/7 | §10 EP-03 명령 → `turn-request.ts:86,93,105,113,118` · `send.ts:635,761`, 목록과 차 0 · `turn-request.reopen.test.ts`:'W1 …'·'W2 …'(키) · 'W3 follows the current initial batches through the getter' · 'W4 %s rollback returns the input to held…'(2) · `send.worktree.test.ts`:'확장 준비 await 중 취소한 최초 입력만 복원하고…'(`:635`) · '예약 뒤 준비가 실패하면 그 입력이 대기열에 예약으로도 대기로도 남지 않는다'(`:761`) | DB id `s1`≠큐 키 `q-other` → 대기열 상태 · 배치 `m1`→`m2` 교체 → 판정 · 발신 payload `submitted` true/false | — |
| VP-05 | 종단 회귀 | 0 | 0/0 | 파일 필터 없는 vitest — 실패 집합이 변경 전과 양방향 차 0 · 인용 7파일 중 이 환경에서 도는 6파일 green(`chat-turn.continuity.test.ts`는 변경 전에도 Electron 바이너리 부재로 파일 실패) | 운반 항 없음 | `chat-turn.continuity.test.ts` — 환경 한계 |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 없음(r1 — verify 이력 없음).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | EP-01·02·04 0줄 · typecheck error 0 | not selected |
| VP-02 | REQUIRED | SELF_PASS | 위 K1~K8 좌표 | required — (a)·(b)·(c)·(d)·(e)·(f)·(k) 전부 red |
| VP-03 | REQUIRED | SELF_PASS | 위 P1·P3·P5 좌표 | required — (g)·(h) 2자리·(j) 전부 red |
| VP-04 | REQUIRED | SELF_PASS | 위 W1~W4·`send.worktree` 좌표 | required — (i)·(l) 5자리 전부 red |
| VP-05 | REGRESSION | SELF_PASS | 전체 vitest 실패 집합 차 0 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 — r1

하네스 `mutate.py --cwd app`(종료 뒤 `git status` — 변이 잔여 0). oracle은 `features/chat` 전체 + `turn-request.reopen.test.ts` + `retry-submission.test.ts`(`send.ts` 두 행은 `src/main/app` + `features/chat` + `features/sessions`)이고, 변경 전 실패 집합에 없는 실패가 하나라도 나면 red로 읽었다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `claimed`의 `ids` 일치 항 제거 | VP-02 (a) · sweep | 최초 | K4·Q7 3건 | 잠김 |
| `claimed`의 `chainId` 일치 항 제거 | VP-02 (b) · sweep | 최초 | K4·Q7 3건 | 잠김 |
| `claimed`의 `uuid` 일치 항 제거 | sweep(일치 항) | 최초 | K4 1건 | 잠김 |
| `claimed`의 상태 항을 항상 참으로 | sweep(일치 항) | 최초 | 10건(`retry-submission` D 외) | 잠김 |
| `move`의 술어를 `isOpen`으로 | VP-02 (c) | 최초 | 3건(`retry-submission` D · Q5 외) | 잠김 |
| `claimed`가 일치하는 것만 모아 반환(부분 전이) | VP-02 (d) | 최초 | 24건 | 잠김 |
| `canCommitMany` 술어를 `awaitsReceipt`로 | VP-02 (e) | 최초 | W1 외 3건 | 잠김 |
| `commitMany`의 목표를 `submitting`으로 | VP-02 (f) · 하한 ⑤ | 최초 | 17건 | 잠김 |
| `reopenMany`의 목표를 `submitted`로 | VP-02 (f) · 하한 ⑤ | 최초 | 8건 | 잠김 |
| `move`가 바뀐 것이 없어도 알림 | VP-02 (k) | 최초 | Q2 외 3건 | 잠김 |
| `move`의 `state !== to` 필터 제거 | sweep(diff 자리) | 최초 | 5건 | 잠김 |
| `toPublic`이 배치를 그대로 반환 | VP-03 (g) | 최초 | P1 6건 | 잠김 |
| `toPublic`의 `delete rest.state` 제거 | sweep(diff 자리) | 최초 | P1 6건 | 잠김 |
| `toPublic`의 `delete rest.items` 제거 | sweep(diff 자리) | 최초 | P1 6건 | 잠김 |
| 이월 배치의 `uuid` 재발급 제거 | VP-03 (h) 자리 1 | 최초 | 2건 | 잠김 |
| 대기 항목 배치의 `uuid`를 항목 id로 | VP-03 (h) 자리 2 | 최초 | 1건 | 잠김 |
| 이월 배치의 `chainId` 재발급 제거 | sweep(형제 항) | 최초 | ABA 외 2건 | 잠김 |
| 잔여 수의 `uuid` 대조 제거 | VP-03 (j) | 최초 | projector 1건 | 잠김 |
| `reserveItem`의 `uuid`를 새 값으로 | sweep(P2) | 최초 | 17건 | 잠김 |
| `buildTurnRequest`가 배치를 조립 시점에 캡처 | VP-04 (i) | 최초 | 10건(W3 포함) | 잠김 |
| 세션 키를 `queueKey`로 고정 — 제출 가능 | VP-04 (l) 자리 1 | 최초 | W1 2건 | 잠김 |
| 같은 변이 — 제출 확정 | (l) 자리 2 | 최초 | W1 외 3건 | 잠김 |
| 같은 변이 — 되돌림 | (l) 자리 3 | 최초 | W4 2건 | 잠김 |
| 같은 변이 — 재개방 가능 | (l) 자리 4 | 최초 | W1 2건 | 잠김 |
| 같은 변이 — 재개방 | (l) 자리 5 | 최초 | W1 2건 | 잠김 |
| 되돌림의 `uuid`를 다른 값으로(`turn-request.ts`) | sweep(EP-03 호출) | 최초 | `retry-submission` H 1건 | 잠김 |
| 제출 확정 발신의 `submitted`를 `false`로 | sweep(path edge) | 최초 — 처음엔 green | W1 1건(단언 1줄 추가 뒤) | 잠김 |
| 되돌림 발신의 `submitted`를 `true`로 | sweep(path edge) · 하한 ⑤ | 최초 | W4 1건 | 잠김 |
| `send.ts:635` 되돌림의 `uuid`를 `'x'`로 | sweep(EP-03 호출) | 최초 | `send.worktree` 1건 | 잠김 |
| `send.ts:761` 되돌림의 `uuid`를 `'x'`로 | sweep(EP-03 호출) | 최초 — 처음엔 green | `send.worktree` 1건(케이스 1개 추가 뒤) | 잠김 |

- **분모 검산**: `선택 증거 16((a)(b)(c)(d)(e)(f)×2(g)(h)×2(i)(j)(k)(l)×5) · 인용 변이 0 · 새 oracle 0 · sweep 14 = 표 행 30`.
- **덮개 회귀**: 0건(r1 — 이전 라운드 없음). 지운 `commit` 전용 케이스는 없다 — 19곳 모두 다른 동작의 준비 단계였고 `commitMany`로 바꿔 단언을 그대로 뒀다. 지운 단언은 `expect(q.isFrozen).toBe(true)` 1줄이고 그 케이스의 `app_closing` 단언은 남는다.

## [구현자 기입] Product/UX 파생 검토 — r1

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 문구·상태 추가 0 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 — `send.ts`는 인자 1줄과 폴백 2곳만 바뀌었고 `try`/`finally` 구조 diff 0 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 실패 경로 없음. `chainId` 없는 claim의 불일치(D-010)는 제품 경로에서 만들 수 없다(§10 선언 경계) | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 변화 없음 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 변화 없음 — 이월 재발급(P3)이 그대로다 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r1

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `toPublic`을 나머지 펼침으로 쓰면 쓰지 않는 형제 변수가 lint error다(§8의 선례 인용이 틀렸다) | ✅ 선조치 — 얕은 복사 뒤 `state`·`items`를 `delete`. 키 집합은 같다 | `npx eslint …pending-message-queue.ts` error 2 → 0 · P1 6건 green |
| 2 | `send.ts:761`(준비 실패 정리의 되돌림)을 잠그는 테스트가 없었다 — 변경 전에도 같다 | ✅ 선조치 — `send.worktree.test.ts`에 케이스 1개 추가 | 추가 전 변이 green → 추가 뒤 red |
| 3 | W1이 제출 확정 발신의 횟수만 보고 `submitted` 값을 보지 않았다 | ✅ 선조치 — 단언 1줄 추가 | 추가 전 변이 green → 추가 뒤 red |
| 4 | test가 126줄 순증했다 — AC7의 "test는 늘지 않는다" 미달 | ⚠️ 보고만 — §14가 예정한 처리. 늘어난 것은 K·P·W 잠금과 #2의 케이스다 | `git diff --numstat 1582d12 -- app/src` test +200 −74 |
| 5 | `send.worktree.test.ts`의 `makeHarness('session-1')`은 세션 id와 큐 키(`new:1`)가 다르다 — production은 같다(`leaseKeyFor`). 그래서 `send.ts:764-770`의 "저장된 세션의 `message.cancelled` 발신" 갈래를 이 하네스로 잴 수 없었다 | ⚠️ 보고만 — 비귀속(이번 diff가 닿지 않은 줄). #2는 새 세션 흐름으로 되돌림 자체만 잠갔다 | 저장된 세션으로 쓴 첫 시도에서 `deliveryPendingCount` 1 — 하네스의 키 불일치 |
| 6 | 전체 vitest가 변경 전에도 29파일 실패한다(Electron 바이너리 부재 외 단언 실패 포함) | ⚠️ 보고만 — 비귀속. 29파일 중 이번에 만진 것은 `chat-turn.continuity.test.ts` 1개이고 변경 전후 모두 파일 로드 실패다 | 아래 구현 보고 게이트 행 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: D-005(e)·§9 TO-BE의 `const { state, items, ...rest } = batch`를 `{ ...batch }` 복사 + `delete` 2줄로 구현했다(위 1). 줄 수는 14 → 6이다(plan 추정 4).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 값 복사다 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 얕은 복사라 첨부 배열 참조를 추적 배치와 공유한다 — 변경 전 필드별 복사도 같은 참조를 넘겼다. `scrubBatch`는 배열을 새 빈 배열로 대입하므로 반환된 배치의 내용을 지우지 않는다(변경 전과 같다) | AC3 P1 · `pending-message-queue.test.ts`:'세션 전량을 제거하고 payload 를 스크럽한다' green |
| 재진입 | 해당 없음 — 동기 순수 함수 | — |
| 다른 무효화 축 | `TrackedBatch`에 추적 필드가 늘면 `delete`를 더하지 않는 한 새 필드가 샌다 — 나머지 펼침도 같다. P1의 키 집합 대조가 red로 잡는다(§17 리스크 3행) | AC3 P1 |

## [구현자 기입] 구현 보고 — r1

| 항목 | 내용 |
|---|---|
| 변경 파일 | prod 4(`pending-message-queue.ts` · `turn.ts` · `turn-request.ts` · `send.ts`) · test 14 · 문서 1 — `git diff --name-only 1582d12` |
| 실행 명령 | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` · `node scripts/ensure-sqlite-abi.mjs node` · 가드 4종 · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · EP-01·02·04 검색 · AC6 diff · `mutate.py` |
| **관측한 게이트 산출**(마지막 수정 뒤) | 가드 4종 OK(`append-only check skipped (first release)` · `links ok` · `product-naming OK 2222파일` · `18 real-git suites ok`) · lint error 0·warning 2(기존) · typecheck error 0 · vitest 940파일 중 911 pass·29 fail, 8,791케이스 중 22 fail · `node --test` 868/868. **기준선**: 변경 전 같은 명령 29파일·22케이스 fail, 실패 식별자 42줄의 차집합 양방향 0(`diff` 출력 0줄). 원인은 Electron 바이너리 부재 외 손대지 않은 파일의 단언 실패 — 비귀속. 돌리지 못한 단계: 없음(SQLite는 Node ABI로 재빌드) |
| **추가·수정 테스트의 subtree 규칙** | 수정 테스트 14파일 · 시간 예산 위반 0(`check-test-budgets` OK) · 호스트 격리 위반 0 · 풀 분류 위반 0(전체 vitest 로그에 `[test-pools]` 0줄) |
| V-pair 자기확인 | `SELF_PASS 5 / SELF_BLOCKED 0` |
| 강제 지점 전수 | EP-01 70/70 · EP-02 19/19 · EP-04 1/1 · EP-03 정의 4/4·호출 7/7 · EP-05 5/5·2/2·1/1 |
| **AC 자기보고**(`Criteria-Met`) | 7/9 — AC1 ✅ 검색 3종 0줄 · AC2 ✅ K1~K8 green + 변이 11행 red · AC3 ✅ P1 6건 green + 변이 3행 red · AC4 ✅ P3·P5 green + 변이 4행 red · AC5 ✅ 인용 테스트 단언 변경 없이 green(환경 한계 1파일 제외), 실패 집합 차 0 · AC6 ✅ AC6 명령 + 어댑터·coordinator·projector·`features/sessions` diff 0줄 · AC7 ⚠️ prod +84 −132(순감 48 ≥ 45), **test +200 −74(순증 126)** · AC8 ✅ 기준선 차집합 0 · AC9 ⚠️ 사람 실기 대기 |
| **합계 검산** | `✅ 7 · ⚠️ 2 · ❌ 0 = 총 9` |
| 블로커 / 역질문 | 없음. 사용자 선택지 2건 — D-001(다음 묶음: H-G · H-J) · D-008(renderer 예약 판정을 걷는 동작 변경). AC7의 test 조건은 설계자 판단 필요 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음(r1).
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: §8의 lint 선례 인용은 그 줄의 변수가 뒤에서 쓰이는지 확인하지 않았다. AC7의 test 조건은 0307(AC17)·0309에 이어 세 번째로 ⚠️다 — 잠금을 먼저 넣는 감량 작업에서 test 순감 조건이 맞은 적이 없다.
- 반복해서 부딪히는 환경 한계: 전체 vitest 기준선 실패 29파일(0309·0310과 같은 환경) · Electron 바이너리 부재로 AC9 불가.
- 현재 라운드·impl 턴: `r1`.

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.
> `발견 분류`는 이행(열거 원문 위반·plan 내부 불일치) · 현재(원본 동작 결함) · 확장(열거 밖 잠금 공백) · 경계 · 비귀속이다. 확장은 verify 1·2회째에만 `PLAN_GAP`이고 이후에는 `NEXT_HANDOFF(확장)`로 INDEX 후보 표에 간다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| D1 | P5가 `confirmed` 배치를 입력으로 갖지 않아 `messageCountForAttempts`의 `!isOpen` 항 제거(x5)를 못 잡음 | VP-03 · P5 · R-04 "열린 배치" | `confirmed`된 잔여 `uuid` 배치를 포함한 입력 추가(기대 0) | 이행 | BLOCKING | open |
| D2 | AC7 "test는 늘지 않는다" ↔ §14 "순증이면 ⚠️ 보고" 모순 | R-07 · §14 | 설계자가 AC7 정정 | plan 내부 불일치 | PLAN_GAP | open |
| D3 | `sameIds` 길이 항 제거(x4) 못 잡음 — 긴 claim 입력 없음 | VP-02 · K4 | 채택 또는 경계 | 확장 | PLAN_GAP | open |
| D4 | `committed &&` 제거(x6) 못 잡음 — commit 실패 시 발신 억제 입력 없음 | VP-04 · W 칸 | 채택 또는 경계 | 확장 | PLAN_GAP | open |
| D5 | 소유권 발신 `ids` 내용 단언 없음(x11) | VP-04 · W1 | 채택 또는 경계 | 확장 | PLAN_GAP | open |
