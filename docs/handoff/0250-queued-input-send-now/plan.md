# Plan — 0250-queued-input-send-now

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**
> Claude Code 동작 근거: 같은 라이브 세션의 실측 4회(§2) + 번들 CLI 소스 문자열 조사(§8 `CLI-*` 행).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0250-queued-input-send-now` |
| 작성자 | Claude Code |
| 일자 | 2026-10-06 |
| 매핑 | — |
| 상태 | plan/READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 답변 중에 보낸 메시지가 다음 도구 경계(`PostToolBatch` 게이트)에서 자동 주입된다. 취소할 수 있는 시간이 도구 한 번 사이로 짧고, "답변이 끝난 뒤 전달" 또는 "지금 끊고 전달"을 사용자가 고를 수 없다.
- 완료 후 달라지는 것: 답변 중 보낸 메시지는 그 답변이 끝날 때까지 취소 가능한 대기 버블로 남고, 끝나면 자동으로 다음 턴이 된다. 대기 버블에 마우스를 올리면 '즉시 보내기'가 보이고, 누르면 현재 답변을 중단한 뒤 대기 메시지로 새 턴을 연다.
- 바뀌지 않는 것: 유휴 세션 전송, '중단' 버튼(대기 전량 취소·draft 복원), 대기 버블 hover '취소', 백그라운드 수신(listen)·예약 수신.
- 성공을 한 문장으로: **"답변 중에 보낸 말은 답변이 끝나야 들어가고, 지금 들어가길 원하면 '즉시 보내기'로 끊고 넣는다."**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "As- is: 미드턴 주입 후 echo 확인 시 주입 확정" | `/handoff-plan` 인자 (2026-10-06) |
| 명시 요구 | "to-be: composer에서 메시지 보내기 시 무조건 다음 턴에 주입하는 것으로 어시스턴트 답변이 완료되기까지 취소가능 형태로 대기된다. 이 때 메시지 버블 호버시 즉시보내시 버튼 노출. 즉시 보내기 클릭시 미드턴 주입 확정. 해당 동작은 interrupt 후 메시지 주입으로 동작해야 한다. 동닥 방식은 클로드코드와 완전히 똑같은 형태로 할 것" | 같은 인자 |
| 명시 결정 Q1 | "무조건 다음 턴 (Recommended)" — 선택지 설명: "도구 경계 자동 흡수(현 PostToolBatch 게이트)를 제거한다. 대기 메시지는 답변이 끝날 때까지 언제든 취소 가능하고, 미드턴 주입은 '즉시 보내기'로만 일어난다." | 질의 응답 (Claude Code 자동 흡수와의 충돌 질의) |
| 명시 결정 Q2 | "항상 interrupt 후 주입 (Recommended)" — 선택지 설명: "실행 중인 포그라운드 도구는 중단 처리되고, 그 메시지로 새 턴을 연다. 백그라운드 작업은 유지된다." | 질의 응답 (CLI 단계 판정 위임과의 선택) |
| 명시 결정 Q3 | "대기 전부를 순서대로 (Recommended)" — 선택지 설명: "입력 순서를 보존하며 대기 메시지 전부를 한 턴으로 보낸다." | 질의 응답 |
| 실측 배경 | 실험 1~3회차: thinking 중 보낸 메시지가 큐에 들어간 뒤 사용자가 버블의 '즉시 보내기'를 눌러 `[Request interrupted by user]` 후 새 턴. 4회차: 누르지 않으면 도구 없는 턴이 끝난 뒤 다음 턴(대기 32.6초) | 라이브 세션 transcript `queue-operation` 레코드 |
| 추론 의도 | "클로드코드와 완전히 똑같은 형태"는 Q1·Q2로 갈린 두 지점을 뺀 나머지 — 큐잉·hover 버튼·interrupt 후 새 턴·대기 전체 전송 — 를 가리킨다고 읽는다 | Q1·Q2가 원문과 충돌하는 두 지점을 사용자가 원문 쪽으로 닫음 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 답변 중(busy) 보낸 메시지는 **그 답변이 끝날 때까지** held 로 대기하고 취소 가능하다. 답변이 끝나면 기존 자동 연속 턴이 전달한다 | "무조건 다음 턴에 주입 … 어시스턴트 답변이 완료되기까지 취소가능 형태로 대기" | 인자 · Q1 | ACTIVE | — |
| D-002 | **도구 경계 자동 흡수를 제거한다** — `PostToolBatch` 게이트 flush(`makeSteerGateHook`·`takeSteerFlush`)를 없앤다. Claude Code CLI 의 `absorbed_mid_turn` 과 의도적으로 다르다 | Q1 "도구 경계 자동 흡수(현 PostToolBatch 게이트)를 제거한다" | Q1 | ACTIVE | — |
| D-003 | 대기 버블 hover 시 '즉시 보내기' 버튼을 '취소'와 함께 노출한다 | "메시지 버블 호버시 즉시보내시 버튼 노출" | 인자 | ACTIVE | — |
| D-004 | '즉시 보내기' = **항상 현재 응답 interrupt 후 대기 메시지로 새 턴**. CLI 의 단계 판정(백그라운드 이전·유예)은 쓰지 않는다. 실행 중 포그라운드 도구는 '중단됨'으로 정착한다 | "interrupt 후 메시지 주입으로 동작" · Q2 | 인자 · Q2 | ACTIVE | — |
| D-005 | '즉시 보내기'는 **누른 버블이 아니라 대기 전부**를 입력 순서대로 한 턴으로 보낸다. 병합 형태는 기존 연속 턴 규칙(병합 1버블, 0067 D4)을 그대로 쓴다 | Q3 · 입력 순서 보존(0152 AC2) | Q3 | ACTIVE | — |
| D-006 | '즉시 보내기'는 세션 체인과 백그라운드 작업을 유지한다 — 체인 취소·태스크 중지를 하지 않는다 | Q2 선택지 "백그라운드 작업은 유지된다" · '중단'(0143 태스크 중지)과 구분 | Q2 | ACTIVE | — |
| D-007 | '중단' 버튼은 현행 그대로다 — 응답 interrupt + 대기 전량 취소 + draft 복원 + (예약·백그라운드 없으면) 체인 취소 | 사용자 미언급 · 0067 확정 5 · 0143 | 기존 결정 | ACTIVE | — |
| D-008 | hover '취소'는 현행 그대로다 — 예약(전달) 전까지 가능, 이후 거부 시 '전달됨' 재동기화. '즉시 보내기'를 누른 뒤에도 예약 전이면 취소된다 | 0151 AC12 | 기존 결정 | ACTIVE | — |
| D-009 | '즉시 보내기'는 **끊을 응답이 있을 때만** interrupt 한다. 대기 메시지가 없거나, 체인이 준비 중/종료 중이거나, 응답이 진행 중이 아니면(턴 사이·수신 대기 유휴) 아무것도 끊지 않는다 — 그 경우 대기 메시지는 기존 경로가 곧 전달한다 | CLI `stand_by`/`not_ready` 대응(§8 CLI-04) · 끝난 턴을 끊어 막 시작한 연속 턴을 죽이는 경합 차단 | 설계 | ACTIVE | — |
| D-010 | 중단된 응답의 화면 표시는 현행 '중단' 표시를 재사용한다(부분 답변 유지·도구 '중단됨'). Claude Code 의 `[Request interrupted by user]` 표식은 도입하지 않는다 | 동작 방식 요구 범위 · 영속 스키마 무변경 | 설계 | ACTIVE | — |
| D-011 | 생산자가 사라지는 표면을 지운다 — 게이트 계약(`TurnRequest.take/commit/rollbackSteerFlush`·프레임 위임 키)·`makeSteerGateHook`·`canSteer`·`steerFailed`. 큐 내부 모델(`BatchOrigin` 의 `'steer'`·`confirm` 비대칭 규칙)은 건드리지 않는다 | 죽은 계약 방지 · 0151/0154/0166 의 큐 상태기계 회귀 위험 통제 | 설계 | ACTIVE | — |
| D-012 | IPC 신규 채널 `orca:chat:steerSendNow` = `{ sessionId }`. 메시지 id 를 받지 않는다 | D-005(대기 전부) — id 가 의미를 갖지 않는다 | 설계 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-012 (신규 handoff).
- 변경된 결정: 원문 "클로드코드와 완전히 똑같은 형태" 중 두 지점을 사용자가 Q1·Q2로 원문 쪽으로 닫았다 — 도구 경계 흡수 제거(D-002), 단계 판정 미채택(D-004).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0067 확정 5(D-007) · 0067 D4 병합 1버블(D-005) · 0151 AC12(D-008) · 0143 listen 중 Stop 태스크 중지 · 0153 예약 판정 predicate · 0154 미확정 유예 — §16.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1·AC2 · D-002↔AC1·AC11 · D-003↔AC3 · D-004↔AC4 · D-005↔AC2·AC4 · D-006↔AC5·AC7 · D-007↔AC8 · D-008↔AC9 · D-009↔AC6 · D-010↔AC4(표시 무추가)·§6 · D-011↔AC11 · D-012↔AC10.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | 자동 주입 경로는 하나다 — `makeSteerGateHook`(`app/src/main/adapters/claude-adapt.ts:208`)이 유일한 production `PostToolBatch` 훅(§8 전수) |
| 이미 기존 코드가 충족하는가 | 절반 | 턴 종료 후 자동 연속 턴(`app/chat-turn/post-turn.ts:80` flush)·hover 취소(`PendingSteerTurn.tsx:32`)는 있다. 즉시 보내기·자동 흡수 제거는 없다 |
| 더 작은 해법이 있는가 | 일부 채택 | 즉시 보내기 = 기존 "예약 유지 Stop"(`resumeScheduledReception`) 경로의 변형으로 짓는다 — 새 전송 경로 0. SDK `priority:'now'` 위임은 Q2로 기각 |
| 선행 자료의 주장을 코드와 대조했는가 | 정정 1건 | 앞선 대화의 "훅 push 가 한 경계 늦을 수 있다" 가설은 CLI 소스로 반증 — fold 는 `PostToolBatch` 훅 **뒤**에 큐를 읽는다(§8 CLI-01). 이번 설계에는 영향 없음(게이트 제거) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 1건 대체 | 0060 D3·D4(게이트 flush)를 D-002가 대체 — 코드 주석 `claude.ts:422`·`turn.ts:182`·`runtime-ipc.md §1.4` 갱신 대상 |

- 사용자에게 올릴 결정: 없음 (Q1~Q3 닫힘).
- 코드 조사로 닫은 사실: 즉시 보내기를 끊을 대상의 판정(D-009), 백그라운드 태스크 중지 위치(§9 AS-IS), 큐 내부 모델 비변경(D-011).

## 5. 동작 / 사용자 흐름

```text
[답변 중 composer 전송]
  → 대기 버블(연회색·기울임) — hover: [즉시 보내기] [취소]
  → (도구 호출이 여러 번 지나가도) 그대로 대기
  → 답변 완료 → 대기 전부가 입력 순서대로 한 턴으로 자동 전송 → '전달됨' → 정식 버블 + 새 답변
  ↘ [즉시 보내기] → 현재 답변 중단(부분 답변 유지·실행 중 도구 '중단됨')
                  → 대기 전부가 입력 순서대로 한 턴으로 전송 → 정식 버블 + 새 답변
  ↘ [취소] → 그 버블 제거 + composer 에 텍스트 복원 (전달 전까지)
  ↘ [중단 버튼] → 답변 중단 + 대기 전량 취소 + composer 복원 (현행)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 응답 중 전송 | held 적재. 도구 경계에서 아무것도 하지 않음 | 대기 버블. hover 시 '즉시 보내기'·'취소' |
| 응답 정상 종료 + held 있음 | 턴-후 루프 `flush`: held 병합 → 다음 턴 프롬프트 | '전달됨' → 첫 모델 출력 시 정식 버블 → 새 답변 |
| 응답 중 '즉시 보내기' | 응답 interrupt(체인·백그라운드 유지) → 잔여 tail 드레인 → `flush` | 부분 답변 정지 → 대기 버블 '전달됨' → 정식 버블 → 새 답변 |
| 수신 대기 중 CLI 자동 응답(알림 턴) 진행 + '즉시 보내기' | 그 자동 응답 interrupt → `flush` | 자동 응답 정지 → 새 답변 |
| '즉시 보내기' 시 끊을 응답 없음(턴 사이·준비 중·수신 유휴) | 아무것도 끊지 않음 | 대기 메시지는 곧 기존 경로로 전달된다 |
| '즉시 보내기' 직후 '취소' | 아직 예약 전이면 그 항목 취소 | 버블 제거 + composer 복원. 남은 대기가 없으면 새 턴 없음 |
| '중단' 버튼 | 현행(대기 전량 취소·draft 복원) | 현행 |
| IPC 실패 | renderer 낙관 표식 되돌림 + 오류 보고 | '즉시 보내기' 버튼 재노출 |

### 파생 UX / 엣지케이스

- '즉시 보내기'는 응답이 진행 중(`activityForeground === 'streaming'`)이고 항목이 전달 전(`submitted !== true`)이며 아직 누르지 않았을 때만 보인다.
- 누른 뒤 새로 들어온 대기 메시지에는 버튼이 다시 보인다. 두 번째 클릭은 이미 중단된 턴이라 main 이 무시한다.
- 승인 대기·질문 대기 중 '즉시 보내기'는 '중단'과 같은 방식으로 대기를 해소한다(현행 abort 경로).
- 키보드 단축키는 없다(§6 비범위). 버튼 노출은 기존 '취소'와 같은 hover 패턴이다.
- 다른 세션: 각 세션의 held·턴만 대상으로 한다(`sessionId` 키).

## 6. 범위 / 비범위

- **범위**: 게이트 자동 흡수 제거 · '즉시 보내기' 버튼·IPC·main 처리 · 턴-후 루프의 중단 후 재개 표식 일반화 · 생산자 없는 표면 제거 · 현재 상태 문서(IPC_CONTRACT·runtime-ipc·adapters)·ADR-007.
- **비범위**: CLI 단계 판정(백그라운드 이전·유예 — D-004) · `[Request interrupted by user]` 표식(D-010) · 키보드 단축키 · 큐 내부 `BatchOrigin` 정리(D-011) · 중단 잔여(residual)·세션 전체 중단 UI · 버블 병합 형태 변경.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 중단 표식 표시 | 아니오 — 표시 전용, 영속 스키마 무관 | 후속 handoff 후보 |
| `BatchOrigin 'steer'` 제거 | 아니오 — 내부 타입 | 후속 handoff 후보(NEXT_HANDOFF) |
| 채널 이름·형상 | **예 — IPC 공개 계약** | 지금 고정: D-012 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 응답 중 보낸 메시지는 도구 경계를 몇 번 지나도 응답이 끝날 때까지 held 로 남고 CLI 입력으로 나가지 않는다 | ST-01: 응답 중 held 2건 → 도구 이벤트 배치 N회 → `pending(s1)` 2건 유지·`pushed` 0건 → terminal 후 1건. IT-02: claude 어댑터의 모든 `PostToolBatch` 훅을 메인 루프 입력으로 호출해도 SDK 입력 스트림에 사용자 메시지 0건 | `chat:send` → `reserveOnBusySession` → held → 턴-후 루프 |
| R-02 | AT-02 / AC2 | 응답이 끝나면 대기 전부가 입력 순서대로 한 턴(병합 1건)으로 자동 전송되고, 첫 모델 출력에서 정식 버블로 확정된다 | ST-01 후반: `pushed === ['first\n\nsecond']`(입력 순서) · `message.committed` 1건이 병합 텍스트·두 id 를 갖는다 | `post-turn.ts` flush → `reserveHeld('turn-open')` → `pushTurn` → coordinator 확정 |
| R-03 | AT-03 / AC3 | 대기 버블의 '즉시 보내기'는 응답 진행 중 + 전달 전 + 미요청 항목에만 보이고, '취소'는 전달 전 항목에 보인다 | UT-04: 뷰모델 표(foreground×submitted×sendNowRequested) + `renderToStaticMarkup` 에서 `data-control="send-now"` ↔ '즉시 보내기', `data-control="cancel"` ↔ '취소' 짝 | `TranscriptView`/`Exchange` → `PendingSteerTurn` |
| R-04 | AT-04 / AC4 | '즉시 보내기'를 누르면 진행 중 응답이 1회 interrupt 되고 `turn.aborted` 가 나간 뒤, 대기 전부가 같은 채널로 한 턴 전송된다. 대기는 취소되지 않는다 | ST-02: `live.interrupt` 1회 · `turn.aborted` 송신 · `message.cancelled` 0건 · tail+terminal 후 `pushed === [병합 텍스트]` · `sendMessage`(respawn) 추가 호출 0 · `turn.aborted` 송신이 첫 push 보다 앞 | renderer `chatActions.sendSteerNow` → preload → `orca:chat:steerSendNow` → 핸들러 → post-turn flush |
| R-05 | AT-05 / AC5 | '즉시 보내기'는 세션 체인을 끊지 않고 백그라운드 작업을 멈추지 않는다 | ST-02 변형(백그라운드 태스크 관측): `lease.controller.signal.aborted === false` · `stopAndSettleAbortedTasks` 호출 0 · tracker 의 태스크 유지. 대조: 같은 상태의 '중단'은 현행대로 태스크 중지 호출 1 | 핸들러 → `abortContinuation:'send-now'` → post-turn 재개 정책 |
| R-06 | AT-06 / AC6 | 끊을 응답이 없거나 대기가 없으면 '즉시 보내기'는 아무것도 끊지 않는다 | UT-01: `decideSendNow` 표 전수. IT-01: 턴 사이(flush 준비 대기)·대기 0건·체인 준비 중에서 핸들러 호출 → `live.interrupt` 0 · `turn.aborted` 0 | 핸들러 → `decideSendNow` |
| R-07 | AT-07 / AC7 | 수신 대기 중 CLI 자동 응답이 진행 중이면 '즉시 보내기'가 그 응답을 끊고 대기를 전송하며, 백그라운드 작업은 유지된다 | ST-04: listen 단계 + 비-terminal 자동 응답 이벤트 → 핸들러 → `live.interrupt` 1 → terminal 후 `pushed === [대기]` · 태스크 중지 0 | 핸들러 → listen 턴 abort → post-turn 재개 |
| R-08 | AT-08 / AC8 | '중단' 버튼은 현행 그대로 대기 전량을 취소·복원하고, 예약·백그라운드가 없으면 체인을 취소한다 | 기존 `post-turn.schedules.test.ts` 'scheduled reception after Stop' 10 `it`(그중 `it.each` 2건)·'0239' 4 `it` green + renderer `message.cancelled` draft 복원 기존 테스트 green | `orca:chat:cancel` |
| R-09 | AT-09 / AC9 | hover '취소'는 전달 전 항목을 취소하고, '즉시 보내기'를 누른 뒤에도 예약 전이면 취소된다 | IT-03: `sendSteerNow` 후 `cancelSteer(id)` → `chatApi.cancelSteer` 호출 · 항목 제거 · draft 반환. main: 예약 전 `cancel` 성공 / 예약 후 `message.submitted(true)` 회신(기존 0151 테스트) | `PendingSteerTurn` → `orca:chat:steerCancel` |
| R-10 | AT-10 / AC10 | `orca:chat:steerSendNow` `{sessionId}` 는 스키마 검증·reject 정책으로 등록되고 IPC_CONTRACT·생성 인벤토리와 일치한다 | IT-01: 잘못된 payload(`{}`·빈 sessionId) reject · 정상 payload 처리 · `node scripts/check-doc-inventory.mjs --check` green · typecheck | preload → `handle(CHANNELS.chatSteerSendNow, SteerSendNowSchema, 'reject', …)` |
| R-11 | AT-11 / AC11 | 게이트 자동 흡수 계약과 생산자 없는 표면이 저장소에서 사라진다 | `rg -n "takeSteerFlush\|commitSteerFlush\|rollbackSteerFlush\|makeSteerGateHook\|canSteer\|steerFailed\|resumeScheduledReception" app/src` = 0 — **양성 짝은 AC1**(행동 단언) | 정적 |
| R-12 | AT-12 / AC12 | 현재 상태 문서가 새 동작을 서술하고 결정 근거가 ADR 로 남는다 | `runtime-ipc.md §1.4` 표에 게이트 행 0·즉시 보내기 행 1 · `adapters.md:55` 에 steer 0 · ADR-007 존재 + `decisions/README.md` 목록 행 · `check-doc-inventory --check` green | 문서 |
| R-13 | AT-13 / AC13 | 실제 앱·실제 CLI 에서 위 흐름이 보인다 | 사람 실기 — §19 절차 3건 | Electron + 번들 CLI |

### AC 검증 주의사항

- 기존 테스트 재사용: `post-turn.schedules.test.ts` 의 `describe('scheduled reception after Stop')`(줄 298 — `it` 10건, 그중 `it.each` 2건: 줄 379·495)·`describe('0239 …')`(줄 649 — `it` 4건) 존재를 확인했다. 'Stop 직후 held 입력은 …' 케이스(줄 595)는 "중단 후 held 를 같은 채널로 한 번 전송"을 이미 단언한다.
- 사람 실기 항목: 실제 CLI 의 interrupt 응답·hover 시각만 남긴다. 버튼 노출 판정·클릭 대상 매핑은 UT-04 뷰모델로 내린다 — renderer 테스트 환경이 `environment: 'node'`(`app/vitest.config.ts:7`)라 클릭 이벤트를 띄울 수 없다.
- N회 기준: `live.interrupt` 호출 sink 의 production 호출부는 `SessionRuntime.markAborted`(`session-runtime.ts:864`) 1곳이다. 핸들러 1회 = `abortTurn` 1회 = `markAborted` 1회 = `live.interrupt` 1회. fixture 의 fake `live.interrupt` 가 이 sink 를 직접 모형한다.
- 순서 기준(AC4): `turn.aborted` 는 `sendChatEvent` mock 으로, push 는 fixture `pushed` 로 관측된다 — 첫 push 시점의 `sendChatEvent` 호출 목록에 `turn.aborted` 가 있는지로 단언한다.
- 0건 기준(AC11): 음성 게이트는 "없다"만 잠근다. "held 가 응답 중 전송되지 않는다"는 AC1 이 행동으로 잠근다.

## 7-A. V / Trace Matrix

- V mode 판정: 이 영역(큐·턴-후 루프)에 상속할 명시적 V 가 없다 — 0067·0151·0154·0166 은 V 이전 템플릿. Baseline V1.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 응답 끝까지 대기 | NEW | — |
| R-02 | R | §7 종료 후 자동 전송 | INHERITED | 0067 AC7 · `post-turn.ts:80` |
| R-03 | R | §7 버튼 노출 | NEW | — |
| R-04 | R | §7 즉시 보내기 | NEW | — |
| R-05 | R | §7 체인·백그라운드 유지 | NEW | — |
| R-06 | R | §7 무효 조건 | NEW | — |
| R-07 | R | §7 수신 대기 중 즉시 보내기 | NEW | — |
| R-08 | R | §7 중단 버튼 | INHERITED | 0067 확정 5 · 0143 |
| R-09 | R | §7 hover 취소 | INHERITED | 0151 AC12 |
| R-10 | R | §7 IPC 계약 | NEW | — |
| R-11 | R | §7 표면 제거 | NEW | — |
| R-12 | R | §7 문서 | NEW | — |
| R-13 | R | §7 실기 | NEW | — |
| AT-01~AT-13 | AT | §7 검증 수단 칸 | R 과 같은 provenance | — |
| SD-01 | SD | §9 held 수명주기(게이트 없음) | CHANGED | 0067·0151 큐 상태기계 |
| SD-02 | SD | §9 즉시 보내기 수명주기 | NEW | — |
| SD-03 | SD | §9 Stop 수명주기 | INHERITED | `app/chat-turn/index.ts:156` |
| ST-01~ST-04 | ST | §11 테스트 | SD 와 같은 provenance | — |
| AR-01 | AR | §10 IPC 채널 계약 | NEW | — |
| AR-02 | AR | §10 `TurnContext.abortContinuation` | CHANGED | `contracts/turn.ts:13` `resumeScheduledReception` |
| AR-03 | AR | §10 게이트 계약 제거 | CHANGED | `adapters/turn.ts:185-190` |
| AR-04 | AR | §10 `RuntimeLiveTurn.responding` | NEW | — |
| AR-05 | AR | §10 renderer 액션·버튼·i18n | NEW | — |
| AR-06 | AR | §10 응답 중단 공통 시퀀스 | CHANGED | `index.ts:180-192` 인라인 시퀀스 |
| IT-01~IT-04 | IT | §11 테스트 | AR 과 같은 provenance | — |
| MD-01 | MD | §10 `decideSendNow` | NEW | — |
| MD-02 | MD | §10 `SessionRuntime.responding` | NEW | — |
| MD-03 | MD | §10 `abortResumePolicy` | NEW | — |
| MD-04 | MD | §10 `pendingSteerControls` 뷰모델 | NEW | — |
| UT-01~UT-04 | UT | §11 테스트 | MD 와 같은 provenance | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | busy `chat:send` → `reserveOnBusySession`(held) → 응답 이벤트·도구 배치 → (게이트 없음) → terminal | ST-01 `pending` 유지·`pushed` 0 · IT-02 훅 호출 후 입력 0 | required — 음성 불변식. M1: held 를 도구 경계에서 reserve+push 하는 경로 재도입. 자리 2: ⓐ claude 어댑터 `PostToolBatch` 훅(IT-02) ⓑ main 측 도구 완료 시점(`turn-request` 위임 → runtime) (ST-01) | EP-13 (코드 자리 18 — §10) |
| VP-02 | R-02 ↔ AT-02 | REGRESSION | terminal → `decidePostTurnStep`=flush → `reserveHeld('turn-open')` → `pushTurn` → 첫 모델 출력 → `message.committed` | ST-01 병합 텍스트·id 순서 | required — M10: `reserveHeld` 정렬을 역순으로 → 병합 순서 단언 red | 0 + 이유: 경로 코드 무변경(회귀 확인만) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | store `pendingSteer`·`activityForeground` → `pendingSteerControls` → `PendingSteerTurn` 버튼 | UT-04 표·markup 짝 | required — 형제 슬롯: M7 send-now↔cancel 의 control kind→액션 매핑 맞바꿈 · M8 `submitted` 조건 제거 | EP-15 (자리 4) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `chatActions.sendSteerNow` → `chatApi` → preload → 핸들러 → `decideSendNow` → `abortContinuation='send-now'` → `interruptResponse` → runtime drain → post-turn 재개 → flush → `pushTurn` | ST-02 interrupt 1·aborted·cancelled 0·push 1·respawn 0·순서 | required — M2 핸들러가 `cancelAllHeld` 호출 · M3 `abortContinuation` 미설정 · M5 `supervisor.cancelChain` 호출 | EP-01~EP-06(6) · EP-10 send-now 쓰기(1) · EP-15 `sendSteerNow`(1) · EP-16 send-now 호출(1) = 9 |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | 핸들러 → `abortContinuation='send-now'` → post-turn `abortResumePolicy` → (태스크 중지 생략) | ST-02 변형 lease 유지·중지 0 · 대조 Stop 중지 1 | required — M4 send-now 정책 `stopTasks:true` (자리 2: 루프 상단·listen 종료부) | EP-11 (자리 4) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | 핸들러 → `decideSendNow` → `none` | UT-01 표 · IT-01 무중단 3상황 | required — M6 `not-responding` 판정 제거 → IT-01 턴 사이 케이스 red | EP-17 (자리 2) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | listen 턴(CLI 자동 응답 busy) → 핸들러 → listen 턴 abort → drain → post-turn 재개 → flush | ST-04 | not selected — 직접 oracle 이 interrupt 횟수·push·중지 0 을 모두 관측 | EP-11 listen 실행 후·루프 상단(2) · EP-14 게터·소비(2) = 4 |
| VP-08 | R-08 ↔ AT-08 | REGRESSION | `orca:chat:cancel` → `cancelAllHeld` → 체인 판정 → `interruptResponse` → post-turn | 기존 Stop 14 `it` | not selected — 기존 행동 테스트가 직접 oracle | EP-10 · EP-16 (자리 2) |
| VP-09 | R-09 ↔ AT-09 | REGRESSION | `PendingSteerTurn` 취소 → `chatActions.cancelSteer` → `orca:chat:steerCancel` → `pendingMessages.cancel` | IT-03 · 기존 0151 테스트 | not selected — 직접 oracle | 0 + 이유: 경로 무변경 |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | `CHANNELS` → 스키마 → preload → renderer api → `handle` 등록 → 문서·인벤토리 | IT-01 reject/accept · inventory `--check` | not selected — 직접 oracle | EP-01~EP-08 (자리 8) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | 정적 | `rg` 0건 | required — 음성 게이트라 민감도 확인: 대상 식별자 1개를 주석 밖에 남겨 `rg` 1건 확인 | EP-13 (코드 자리 18) |
| VP-12 | R-12 ↔ AT-12 | REQUIRED | 문서 | 문서 행 존재·부재 + inventory `--check` | not selected — 직접 관측 | EP-18 (자리 5) |
| VP-13 | R-13 ↔ AT-13 | REQUIRED | Electron 실기 | §19 절차 결과 | not selected — 사람 실기 | 0 + 이유: 실기 |
| VP-14 | SD-01 ↔ ST-01 | REQUIRED | VP-01 + VP-02 경로 | ST-01 | VP-01 M1·VP-02 M10 공유 | EP-13 |
| VP-15 | SD-02 ↔ ST-02 | REQUIRED | VP-04 경로 + 이벤트 순서 | ST-02 | VP-04 M2·M3·M5 공유 | EP-10 · EP-11 · EP-16 |
| VP-16 | SD-03 ↔ ST-03 | REGRESSION | VP-08 경로 | 기존 Stop 14 `it` | not selected | EP-10 · EP-11 |
| VP-17 | AR-01 ↔ IT-01 | REQUIRED | VP-10 경로 | IT-01 | not selected | EP-01~EP-08 |
| VP-18 | AR-02 ↔ IT-04 | REQUIRED | 표식 쓰기 2곳 → 읽기 4곳 → `makeContinuationTurn` 비상속 | IT-04: 연속 턴 비상속 · Stop/send-now 각각 루프 재개 여부 | required — M9 `makeContinuationTurn` 이 표식 상속 → 다음 턴 중단 시 잘못 재개 | EP-09 · EP-10 · EP-11 · EP-12 (자리 8) |
| VP-19 | AR-03 ↔ IT-02 | REQUIRED | 어댑터 hooks 조립 → SDK options | IT-02 | VP-01 M1ⓐ 공유 | EP-13 |
| VP-20 | AR-04 ↔ UT-02 | REQUIRED | runtime 프레임·`cliBusy` → `responding` → 핸들러 | UT-02 표 | required — M11 `responding` 이 listen 프레임도 true → UT-02 listen 유휴 행 red | EP-14 (자리 3) |
| VP-21 | AR-05 ↔ IT-03 | REQUIRED | 버튼 → `chatActions.sendSteerNow` → `chatApi.sendSteerNow` · 실패 되돌림 | IT-03 | not selected — 직접 oracle | EP-15 (자리 4) |
| VP-22 | AR-06 ↔ IT-04 | REQUIRED | Stop·send-now → `interruptResponse` 1곳 | IT-04: 두 핸들러 모두 `finalizeTurn` 1회·`turn.aborted` 1회 | not selected — 직접 oracle | EP-16 (자리 2) |
| VP-23 | MD-01 ↔ UT-01 | REQUIRED | 순수 | UT-01 | VP-06 M6 공유 | EP-17 |
| VP-24 | MD-02 ↔ UT-02 | REQUIRED | 순수(runtime 상태) | UT-02 | VP-20 M11 공유 | EP-14 |
| VP-25 | MD-03 ↔ UT-03 | REQUIRED | 순수 | UT-03 표 3행 | VP-05 M4 공유 | EP-11 |
| VP-26 | MD-04 ↔ UT-04 | REQUIRED | 순수 | UT-04 | VP-03 M7·M8 공유 | EP-15 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| 관련 vitest(비-DB) | 수정 모듈 테스트 | §19 목록, `./node_modules/.bin/vitest run <suite>` | 같음. DB 로드 스위트 bindings 실패는 환경 기준선 |
| doc inventory | IPC 채널 수 변경 | `cd app && node scripts/check-doc-inventory.mjs --check` | 생성물 불일치 blocking |
| 커밋 trailer 파싱 | message-bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| busy 전송은 held 로 적재되고 listen 단계면 즉시 릴리즈한다 | `app/src/main/app/chat-turn/enqueue.ts:80-121` `reserveOnBusySession` |
| 도구 경계 자동 주입의 유일한 경로 = `PostToolBatch` 게이트 훅 → `takeSteerFlush` → `reserveHeld('steer')` → `input.push` | `adapters/claude-adapt.ts:199-254` · `adapters/claude.ts:576-583` · `app/chat-turn/turn-request.ts:99-116` |
| 턴 종료 후 held 는 자동 연속 턴(`flush`)이 병합 1배치로 보낸다 — CLI 유휴·백로그 없음에서만 | `app/chat-turn/post-turn.ts:193-231` · `features/chat/post-turn.ts:43-56` |
| 연속 턴 배치는 `commitInitialSubmission` 에서 `message.submitted(true)`, 첫 모델 출력에서 확정 | `turn-request.ts:119-130` · `pending-message-queue.ts:351-379` |
| '중단' = `cancelAllHeld` + 체인 판정 + `abortTurn` + 도구 정착 + `finalizeTurn` + `turn.aborted` | `app/chat-turn/index.ts:156-193` |
| 예약 유지 Stop 은 `resumeScheduledReception` 으로 루프를 재개하되 **백그라운드 태스크를 멈춘다**(루프 상단 `:91-94`, listen 종료부 `:187-189`) | `app/chat-turn/post-turn.ts:88-94,162-165,187-189,197-200` |
| `abortTurn` → `markAborted` → `live.interrupt()` fire-and-forget + 프레임 cancel + drain | `features/chat/abort.ts:11` · `features/sessions/session-runtime.ts:854-888` |
| 준비 중 abort 는 최초 프롬프트를 취소·draft 복원한다 — 즉시 보내기가 준비 중을 끊으면 안 되는 이유 | `app/chat-turn/send.ts:517-534` |
| runtime 의 "CLI 진행 중" = `cliBusy`(비-terminal·비-백그라운드 이벤트) · listen 프레임 = `listenFrame` | `session-runtime.ts:243,398,614-615` |
| renderer 는 `activityForeground`('idle'·'preparing'·'streaming')를 이미 받는다 — 'streaming' = 체인 active + child 있음 + transport≠ready | `features/chat/session-activity-projector.ts:10-19` · `chatStore.ts:1873-1890` |
| renderer 테스트는 `environment: 'node'` + `renderToStaticMarkup` — 클릭 불가 | `app/vitest.config.ts:7` · `TranscriptView.received.test.ts:1-2` |
| 통합 fixture = 실제 runtime·supervisor·queue·coordinator·IPC 핸들러 + fake live(`pushed`·`interrupt`) | `app/chat-turn/post-turn.schedules.test.ts:44-240` |
| CLI-01: CLI 는 `PostToolBatch` 훅 실행 **뒤** `getCommandsByMaxPriority("next")` 를 읽어 `consume(…,{reason:"absorbed_mid_turn"})` 한다 | 번들 `claude-agent-sdk-win32-x64/claude.exe`(SDK 0.3.286) 문자열 — `abort/suspension during mid-turn absorption` 주변 |
| CLI-02: 큐 메시지에 'now' 가 생기면 헤드리스 drain 이 진행 중 턴을 `abort(Pl("interrupt"))` 한다 | 같은 바이너리 — `getCommandsByMaxPriority("now").length>0` 구독 |
| CLI-03: 헤드리스 '즉시 보내기'(`print_send_now`)는 큐 **전체** 프롬프트를 대상으로 한다(`sendQueuedNow`) | 같은 바이너리 — `class … sendQueuedNow` |
| CLI-04: 판정표 `stand_by`(턴 비활성)·`wait`(dialog·not_ready·compacting·grace)·`background`·`interrupt`·`cancel` | 같은 바이너리 — `[low-latency-submit]` 로그 주변 |
| SDK 공개 `interrupt()` 는 영수증 `still_queued` 를 준다. `cancelAsyncMessage` 는 런타임에 있으나 공개 타입에 없다 | `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:2850-2858` · `sdk.mjs` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 게이트 계약 식별자(prod) | `rg -n "takeSteerFlush\|commitSteerFlush\|rollbackSteerFlush\|makeSteerGateHook" app/src --glob '!*.test.ts'` | 33 | 파일 8: `claude.ts` 8 · `session-runtime.ts` 9 · `turn.ts` 6 · `turn-request.ts` 6 · `claude-adapt.ts` 1 · `types.ts` 1 · `workspace-guard.ts` 1(주석) · `pending-message-queue.ts` 1(주석) |
| 게이트 계약 식별자(test) | 같은 패턴 `*.test.ts` | 32 | `claude-adapt.test.ts` · `claude.context-policy.test.ts` · `claude.turnEnd.test.ts` · `continuation.test.ts` · `session-runtime.test.ts` |
| production `PostToolBatch` 훅 | `rg -n "PostToolBatch" app/src/main --glob '!*.test.ts'` | 8 | 코드 1(`claude-adapt.ts:253`) + 주석 7. 게이트 외 production 훅 0 |
| `resumeScheduledReception` | `rg -n resumeScheduledReception app/src` | 10 | prod 7(`contracts/turn.ts:13` · `index.ts:179` · `post-turn.ts:89,92,164,187,199`) + test 3(`post-turn.schedules.test.ts:471` · `send.worktree.test.ts:110,227`) |
| `canSteer` | `rg -n canSteer app/src` | 5 | `types.ts:44,46` · `claude.ts:811` · `mock.ts:70` · `session-runtime.ts:373-374`. 소비자 0 — 이미 죽은 표면 |
| `steerFailed` | `rg -n steerFailed app/src` | 7 | `claude-adapt.ts:226,241` · `app-error.ts:23` · `ko.ts:549` · `en.ts:544` · `error-report.registry.test.ts:157,164` |
| `live.interrupt` sink 호출부 | `rg -n "\.interrupt\(\)" app/src/main --glob '!*.test.ts'` | 확인 대상 | 거버넌스 경로는 `session-runtime.ts:864` 1곳(§7 N회 근거) |

### 수치 / 전칭 표현 검산

- 게이트 식별자 prod 내역 합: 8+9+6+6+1+1+1+1 = 33 ✓.
- "유일한 production `PostToolBatch` 훅": 위 검색 8건 중 코드 1건 — 반례 0.
- 문서 앵커: `runtime-ipc.md §1.4`(줄 63 `### 1.4 세션별 pending message queue`) 존재. `IPC_CONTRACT.md §2.1` 존재. `decisions/README.md` 목록 표 존재.
- 기존 테스트 케이스 존재: §7 주의사항 1행.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `SD-03`, `AR-02`, `AR-03`
- busy 전송: renderer `send()` → `orca:chat:send` → `reserveOnBusySession` → held → `message.queued`.
- 응답 중: CLI 도구 배치마다 `PostToolBatch` 훅 → `takeSteerFlush`(`reserveHeld('steer')`) → `input.push(priority:'next')` → `message.submitted(true)` → CLI 가 같은 경계에서 fold → replay echo → `input.echo` → `message.committed`(응답 중간에 정식 버블).
- 응답 종료: held 잔여가 있으면 post-turn `flush`.
- 중단: `chat:cancel` → `cancelAllHeld` → 예약/백그라운드 있으면 `resumeScheduledReception=true`(체인 유지) 아니면 `cancelChain` → `abortTurn` → 정착 → `turn.aborted`. post-turn 은 표식이 있으면 태스크를 멈추고 재개, 없으면 종료.
- 문제: 취소 가능 구간이 도구 한 번 사이로 짧고, "지금 끊고 전달"할 수단이 없다.

```text
send(busy) → held ──PostToolBatch 훅──→ push('next') → CLI fold → echo → committed (응답 중간)
                 └─턴 종료──→ post-turn flush → pushTurn → 다음 턴
Stop → cancelAllHeld + abort (+resumeScheduledReception → 태스크 중지 후 재개)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `SD-02`, `SD-03`, `AR-01`~`AR-06`
- busy 전송: 동일하게 held. **도구 경계에서 아무것도 하지 않는다**(게이트 제거).
- 응답 종료: post-turn `flush` 가 held 를 보낸다(유일한 자동 전달 경로).
- 즉시 보내기: renderer `chatActions.sendSteerNow()` → `orca:chat:steerSendNow {sessionId}` → 핸들러가 `decideSendNow` 로 판정 → `interrupt` 면 `turn.abortContinuation = 'send-now'` → `interruptResponse(turn)`(Stop 과 공유) → runtime drain → post-turn 이 `abortResumePolicy('send-now')`=재개·태스크 유지 → `flush`.
- 중단: 동일 동작. 표식만 `abortContinuation = 'reception'` 으로 바뀐다.

```text
send(busy) → held ─────────────────(도구 경계 무동작)──────────→ 턴 종료 → flush → pushTurn
                 └─[즉시 보내기]→ steerSendNow → decideSendNow=interrupt
                                 → abortContinuation='send-now' → interruptResponse
                                 → drain(terminal) → post-turn 재개(태스크 유지) → flush → pushTurn
Stop → cancelAllHeld + interruptResponse (+abortContinuation='reception' → 태스크 중지 후 재개)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | held 회수: 게이트(응답 중) + flush(종료 후) | flush 단독 + 즉시 보내기는 abort 후 flush 재사용 | D-001·D-002·D-004 | AR-03 / VP-01·VP-04 · `claude-adapt.ts`·`post-turn.ts` |
| data/control flow | 훅 → `input.push` | 경로 삭제. 새 IPC → 핸들러 → abort → 재개 | D-002·D-004 | SD-01·SD-02 / VP-14·VP-15 · ST-01·ST-02 |
| state/contract | `resumeScheduledReception?: boolean` · `TurnRequest.*SteerFlush` · `canSteer` · `steerFailed` | `abortContinuation?: 'reception' \| 'send-now'` · 게이트 계약 삭제 · `responding?` 추가 · 채널 1개 추가 | D-006·D-011·D-012 | AR-01~AR-04 / VP-17~VP-20 · 타입·스키마 |
| error/lifecycle | 표식 있으면 태스크 중지 후 재개 | 'reception'=중지 후 재개 · 'send-now'=중지 없이 재개 | D-006 | SD-02 / VP-05·VP-18 · UT-03·IT-04 |
| test seam/관측점 | Stop fixture | 같은 fixture 에 `sendNow()` 추가 · 순수 판정 3종 · renderer 뷰모델 | §7 주의사항 | MD-01~MD-04 / VP-23~VP-26 |

- AS-IS 에서 사라지는 책임: 응답 중 held 회수(게이트) — **삭제**, 대체 없음(D-002). 응답 중단 시퀀스 — **이동**(인라인 → `interruptResponse`).

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/chat-turn/admission.ts`(순수) | `decideSendNow` — 끊을지 판정 | 대기 수·턴·체인 요약 → `SendNowDecision` | `app/chat-turn/index.ts` 핸들러 |
| `app/chat-turn/index.ts`(배선) | `steerSendNow` 핸들러 등록 · `interruptResponse` 공통 시퀀스 | IPC → abort 부작용 | `registerChatHandlers` |
| `features/chat/post-turn.ts`(순수) | `abortResumePolicy` — 중단 후 재개·태스크 중지 여부 | `AbortContinuation \| undefined` → 정책 | `app/chat-turn/post-turn.ts` |
| `app/chat-turn/post-turn.ts`(실행) | 정책대로 재개·중지 | 턴 표식 → 루프 분기 | `send.ts` |
| `features/sessions/session-runtime.ts` | `responding` 게터 | 프레임·`cliBusy` → boolean | 핸들러(`turn.live?.responding`) |
| renderer `chatStore.ts` | `sendSteerNow` 액션 · `sendNowRequested` 표식 | 활성 세션 → IPC | `PendingSteerTurn` |
| renderer `pendingSteerControls`(순수) | 버튼 노출·종류 판정 | 항목·foreground → 컨트롤 목록 | `PendingSteerTurn` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-10 | EP-01 `CHANNELS.chatSteerSendNow = 'orca:chat:steerSendNow'` · EP-02 `SteerSendNowSchema = z.object({ sessionId: z.string().min(1) })` + type export · EP-03 `interface SteerSendNow { sessionId: string }` · EP-04 preload `chat.sendSteerNow` · EP-05 `chatApi.sendSteerNow` · EP-06 `handle(…, 'reject', …)` · EP-07 IPC_CONTRACT §2.1 행 + 도메인 목록 · EP-08 `docs/generated/inventory.md` 재생성 | `shared/ipc.ts` · `shared/protocol.ts` | 구현자 | 빌드(typecheck) · 등록(부팅) · CI(`--check`) | 하나라도 빠지면 버튼이 무반응이거나 CI red |
| AR-02 / VP-18 | EP-09 `TurnContext.abortContinuation?: AbortContinuation`, `type AbortContinuation = 'reception' \| 'send-now'` — `resumeScheduledReception` 삭제 · EP-10 쓰기 2곳: `chat:cancel`(현 `index.ts:179`)=`'reception'`, `steerSendNow`=`'send-now'` · EP-11 읽기 4곳: 루프 상단(`post-turn.ts:88-94`)·listen 준비 후(`:162-165`)·listen 실행 후(`:187-189`)·flush 준비 후(`:197-200`) · EP-12 `makeContinuationTurn` 비상속 | `contracts/turn.ts` | 구현자 | 턴 중단 시 | 'send-now' 가 태스크를 멈추거나(D-006 위반) 루프가 끝나 대기가 안 감 |
| AR-03 / VP-11·VP-19 | EP-13 삭제 코드 자리 18 = `claude-adapt.ts` `makeSteerGateHook`(1) + `claude.ts` import·훅 병합·`canSteer` 값(3) + `turn.ts` 필드 3(3) + `types.ts` `canSteer`(1) + `mock.ts` `canSteer`(1) + `session-runtime.ts` `FRAME_DELEGATE_KEYS`·`ADAPTER_DELEGATE_KEYS`·`wrapRequest` 래퍼·`canSteer` 게터(4) + `turn-request.ts` Omit·콜백(2) + `steerFailed` `app-error.ts`·`ko.ts`·`en.ts`(3). 주석 정정: `claude.ts:422,535,810` · `turn.ts:25,180-188` · `types.ts:44` · `workspace-guard.ts:10` · `pending-message-queue.ts:121-135,396` · `enqueue.ts` ①·`:118` · `session-runtime.ts:698` | 삭제 | 구현자 | 정적(`rg`) | 죽은 계약이 남아 재도입이 쉬움 |
| AR-04 / VP-20 | EP-14 `RuntimeLiveTurn.responding?: boolean`(선택) 선언 · `SessionRuntime.responding` = `(frame !== null && frame !== listenFrame) \|\| cliBusy` · 소비 1곳: 핸들러 `turn.live?.responding === true` | `contracts/ports.ts` | 구현자 | 핸들러 호출 시 | `undefined` 는 false — **fail-closed**(끊지 않음) |
| AR-05 / VP-21·VP-26 | EP-15 `PendingSteerState.sendNowRequested?: boolean` · `chatActions.sendSteerNow()` · `pendingSteerControls(item, foreground)` · i18n `chat.steer.sendNow`(ko '즉시 보내기' · en 'Send now') | `chatStore.ts` · `ko.ts`/`en.ts` | 구현자 | 렌더·클릭 | 버튼 오노출·죽은 버튼 |
| AR-06 / VP-22 | EP-16 `interruptResponse(turn, sessionId)` = `abortTurn(turn,'user_cancelled')` → `settleOpenToolRuns(…,'aborted',…)` → `finalizeTurn` → `abortAcknowledged=true` → `turn.aborted(user_cancelled)` — 호출 2곳(Stop·send-now) | `app/chat-turn/index.ts` | 구현자 | 중단 시 | 두 경로의 정착 순서가 갈라짐 |
| MD-01 / VP-23 | EP-17 `decideSendNow` 판정 순서: 대기 0 → `no-held` · 턴 없음 → `no-turn` · 체인 없음/active 아님/aborted → `chain-inactive` · 턴 aborted → `turn-aborted` · `responding` 아님 → `not-responding` · 그 외 `interrupt`. 소비 1곳 | `admission.ts` | 구현자 | 핸들러 | 끝난 턴을 끊어 막 시작한 연속 턴 중단(D-009 위반) |
| AR-* 문서 / VP-12 | EP-18 `runtime-ipc.md §1.4` · `adapters.md:55` · `decisions/007-queued-input-next-turn.md` · `decisions/README.md` 목록 · `docs/INDEX.md` 결정 라우팅 행 | 문서 | 구현자 | PR | 문서-코드 불일치 |

- 같은 규칙의 SSOT: "중단 후 재개 여부·태스크 중지 여부"는 `abortResumePolicy` 한 곳. post-turn 4자리가 이 함수만 읽는다(표식 문자열 비교를 자리마다 쓰지 않는다).
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드 의미: `abortContinuation` `undefined` = 중단 후 재개 없음(현행 일반 Stop) · `responding` `undefined` = false · `sendNowRequested` `undefined` = 미요청.
- 외부 SDK 경계: 변경 없음. `interrupt()` 는 인자 없이 호출(현행). `priority:'now'`·`cancelAsyncMessage` 는 쓰지 않는다(D-004·공개 타입 아님).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` · `protocol.ts` | 채널·타입·스키마 | EP-01~EP-03 | typecheck · IT-01 |
| `app/src/preload/index.ts` · `renderer/src/shared/api/ipc.ts` | 노출 | EP-04·EP-05 | typecheck |
| `app/src/main/app/chat-turn/admission.ts` | 판정 | `decideSendNow` + `SendNowDecision` union(`{action:'interrupt'} \| {action:'none'; reason}`) | UT-01 |
| `app/src/main/app/chat-turn/index.ts` | 배선 | `interruptResponse` 추출(Stop 이 사용) · `steerSendNow` 핸들러(판정 → 표식 → 공통 시퀀스 · 로그 `chat.steer.send-now` `{sessionId, action, reason}`) · Stop 은 `'reception'` 표식 | IT-01·IT-04·ST-02 |
| `app/src/main/contracts/turn.ts` | 표식 | EP-09 | typecheck |
| `app/src/main/features/chat/post-turn.ts` | 정책 | `abortResumePolicy` | UT-03 |
| `app/src/main/app/chat-turn/post-turn.ts` | 실행 | EP-11 4자리를 정책으로 교체 — 재개 시 표식 삭제, `stopTasks` 일 때만 `stopAndSettleAbortedTasks` | ST-02·ST-03·ST-04 |
| `app/src/main/app/chat-turn/turn-context.ts` | 비상속 | `makeContinuationTurn` 이 표식을 싣지 않음을 유지·테스트 | IT-04 |
| `app/src/main/contracts/ports.ts` · `features/sessions/session-runtime.ts` | `responding` | EP-14 · 위임 키·래퍼·`canSteer` 삭제 | UT-02 |
| `app/src/main/adapters/{claude-adapt,claude,turn,types,mock}.ts` | 게이트 제거 | EP-13 | IT-02 |
| `app/src/main/app/chat-turn/{turn-request,enqueue}.ts` | 게이트 콜백·주석 | EP-13 | typecheck |
| `app/src/shared/app-error.ts` · i18n `ko.ts`/`en.ts` | `steerFailed` 삭제 · `chat.steer.sendNow` 추가 | EP-13·EP-15 | i18n 키 대칭 기존 테스트 |
| renderer `features/chat/store/chatStore.ts` | 액션·표식 | `sendSteerNow()`: 활성 세션의 `submitted!==true` 항목에 `sendNowRequested=true` → `chatApi.sendSteerNow({sessionId})` → reject 시 표식 되돌림 + `reportError('chat.steer-send-now.rejected')` | IT-03 |
| renderer `features/chat/components/transcript/pendingSteerControls.ts`(신규, 순수) | 노출 판정 | `(item, foreground) → Array<'send-now' \| 'cancel'>` + `runPendingSteerControl(kind, item)` 액션 매핑 | UT-04 |
| renderer `PendingSteerTurn.tsx` | 버튼 | 컨트롤 목록대로 버튼(`data-control`) 렌더 · '전달됨' 표기 유지 · foreground 는 `useChatActivity()` | UT-04 markup |
| `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md` · `docs/arch/backend/{runtime-ipc,adapters}.md` · `docs/decisions/{007-…,README}.md` · `docs/INDEX.md` | 문서 | EP-07·EP-08·EP-18 | `--check` |
| 테스트 갱신 | 게이트 케이스 제거·표식 이름 변경 | `claude-adapt.test.ts`(makeSteerGateHook describe 삭제) · `claude.context-policy.test.ts`('steer' 경로 삭제) · `claude.turnEnd.test.ts:517`(steer 부분 삭제) · `continuation.test.ts:52,71` · `session-runtime.test.ts:712-766` · `post-turn.schedules.test.ts:471` · `send.worktree.test.ts:110,227` · `error-report.registry.test.ts:157,164`(다른 title 로) | — |

### 신규 테스트

| ID | 위치 | 단언 |
|---|---|---|
| UT-01 | `admission.test.ts` | 6 결과(`no-held`·`no-turn`·`chain-inactive`×3 원인·`turn-aborted`·`not-responding`·`interrupt`) 표 — 앞 조건이 뒤 조건보다 우선 |
| UT-02 | `session-runtime.test.ts` | cold false · send 프레임 열림(이벤트 전) true · terminal 후 false · listen 프레임+유휴 false · listen+비-terminal 메인 이벤트 true · listen+백그라운드 스코프 이벤트만 false |
| UT-03 | `features/chat/post-turn.test.ts` | `undefined→{resume:false}` · `'reception'→{resume:true,stopTasks:true}` · `'send-now'→{resume:true,stopTasks:false}` |
| UT-04 | `pendingSteerControls.test.ts` + `PendingSteerTurn` markup | streaming+held → [send-now, cancel] · submitted → [] + '전달됨' · idle/preparing+held → [cancel] · sendNowRequested → [cancel] · `runPendingSteerControl('send-now')`→`sendSteerNow` 1 / `'cancel'`→`cancelSteer(id)` 1 · markup `data-control`↔라벨 짝 |
| IT-01 | `post-turn.schedules.test.ts`(fixture `sendNow()` 추가) | 등록 존재 · `{}`·`{sessionId:''}` reject · 대기 0 / 턴 사이(flush 준비 대기 — fixture `beforePrepare` 로 정지) / 체인 preparing 에서 interrupt 0·`turn.aborted` 0 |
| IT-02 | `claude.turnEnd.test.ts` 하네스 | options 의 모든 `PostToolBatch` 콜백(있으면)을 메인 루프 입력으로 호출 → SDK 입력에 최초 프롬프트 외 사용자 메시지 0 |
| IT-03 | `chatStore.test.ts` | `sendSteerNow` → `chatApi.sendSteerNow({sessionId})` 1 · 항목 표식 · reject → 표식 해제·`reportError` · 이후 `cancelSteer` 동작 |
| IT-04 | `turn-context.test.ts` + fixture | 표식 가진 턴의 `makeContinuationTurn` → 표식 없음 · Stop·send-now 각각 `finalizeTurn` 1·`turn.aborted` 1 |
| ST-01 | fixture | 응답 중 held 2건(`first`→`second`) + 도구 이벤트 배치 3회 → `pending` 2·`pushed` 0 → telemetry → `pushed === ['first\n\nsecond']` |
| ST-02 | fixture | 응답 중 held 1 → `sendNow()` → interrupt 1 · `turn.aborted` · `message.cancelled` 0 · lease 유지 · tail+telemetry → push 1(같은 live) · 첫 push 시점에 `turn.aborted` 송신 완료. 변형: 백그라운드 태스크 관측 시 `stopAndSettleAbortedTasks` spy 0, 같은 상태 Stop 은 1 |
| ST-03 | 기존 | Stop 14 `it`(위 두 describe) green — 표식 이름 변경만 |
| ST-04 | fixture | listen 단계 + 비-terminal 자동 응답 이벤트 → `sendNow()` → interrupt 1 → terminal → `pushed === [대기]` · 중지 spy 0 |

### 테스트 가능성

- 별도 순수 파일: `decideSendNow`(admission.ts — 이미 순수 모듈), `abortResumePolicy`(features/chat/post-turn.ts — 이미 순수), `pendingSteerControls.ts`(신규 — React·store import 없음; 액션 매핑은 주입 인자로 받는다).
- 기존 메커니즘 재사용 적합성: 예약 유지 Stop 경로는 "중단 후 같은 채널로 held 1회 전송"을 이미 테스트로 보장한다(`post-turn.schedules.test.ts:595`). 즉시 보내기는 태스크 중지만 뺀 같은 경로다.
- 순서 관측: `sendChatEvent` mock 호출 순서 + fixture `pushed` 길이 스냅샷.

## 12. End-to-end 영향

### producer → consumer

```text
PendingSteerTurn 클릭 → chatActions.sendSteerNow → preload → steerSendNow 핸들러
  → decideSendNow → abortContinuation + interruptResponse → SessionRuntime.markAborted → CLI interrupt
  → drain → post-turn abortResumePolicy → flush → pushTurn → message.submitted → message.committed
```

- producer 기준: main 이 판정·중단·전송의 권위다. renderer 표식(`sendNowRequested`)은 버튼 숨김 전용이며 전달 여부를 뜻하지 않는다.
- consumer 파생 규칙: 버블 상태는 기존 `message.submitted`·`message.committed`·`message.cancelled` 만 따른다 — 새 이벤트 없음.
- 합성값 우회: renderer 는 `activityForeground` 로 노출만 정하고 main 판정(D-009)을 대신하지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| IPC 채널 수(생성 인벤토리) | +1 | AC10 |
| `FRAME_DELEGATE_KEYS`/`ADAPTER_DELEGATE_KEYS` 소비(`wrapRequest`·listen 요청 조립) | 3키 감소 — 타입 맵이 키 집합을 강제 | AC11 · typecheck |
| `AppErrorTitle` 소비(오류 보고 레지스트리) | 1개 감소 | AC11 · registry 테스트 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 버튼은 렌더 조건(AC3)에서만 생긴다.
- 취소/중단: 즉시 보내기 후 tail 은 runtime drain 이 버리고(현행), 중단 표시·정착은 Stop 과 같은 `interruptResponse`.
- 종료/quit/crash/renderer-gone: 핸들러는 동기 판정·abort 만 한다. 앱 종료 freeze 뒤에는 `reserveHeld` 가 `undefined` 라 flush 가 일어나지 않는다(현행 `pending-message-queue.ts:251`).
- retry/timeout/partial failure: `live.interrupt()` 실패는 현행대로 삼킨다(`session-runtime.ts:868`). terminal 이 끝내 안 오면 채널 사망 경로(`takeForRespawn`)가 held 를 프렐류드로 이월한다.
- cleanup/rollback: renderer IPC reject 시 표식만 되돌린다. main 은 부분 상태를 만들지 않는다 — 표식 설정과 abort 가 같은 동기 블록.
- **다중 저장소 쓰기**: 핸들러는 ⓐ 턴 표식(메모리) ⓑ CLI interrupt ⓒ `finalizeTurn`(DB) ⓓ renderer 이벤트를 쓴다. ⓐ→ⓑ 순서라 ⓑ 실패 시에도 루프는 'send-now' 로 재개한다. ⓒ·ⓓ 는 Stop 과 같은 순서·같은 함수다. 문서 사본: plan 상태 행과 `INDEX.md` 행 2곳 — 같은 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수: 클릭 1회당 IPC 1 · CLI interrupt ≤1(이미 중단된 턴은 0). 반복 클릭은 `turn-aborted` 로 0.
- 새 출력: 없음(로그 1줄/클릭).
- 최적화 없음.

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

- 외부/배포가 구현할 port: 없음. `RuntimeLiveTurn.responding` 은 앱 내부 포트이며 선택 필드라 raw `LiveTurn`(mock) 대입이 유지된다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0060 D3·D4 게이트 flush | `turn.ts:180-184` 주석 · `runtime-ipc.md §1.4` | §9 TO-BE "도구 경계에서 아무것도 하지 않는다" | **변경** — D-002(사용자 Q1) |
| 0067 확정 5 중단 = held 전량 취소·draft 복원 | `index.ts:157` | D-007 | 유지 |
| 0067 D4 병합 1버블 | `pending-message-queue.ts:241-259` | D-005 | 유지 |
| 0067 AC7 자동 연속 턴 | `post-turn.ts:80` | R-02 | 유지 |
| 0143 listen 중 Stop 은 백그라운드 태스크 중지 | `index.ts:83-96` | D-006 · UT-03 | 유지(Stop) · 즉시 보내기는 적용하지 않음 |
| 0151 AC12 취소 거부 시 '전달됨' 재동기화 | `index.ts:116-131` | D-008 | 유지 |
| 0153 예약 판정 predicate(대기 있으면 pending 경로) | `chatStore.ts:936-947` | §9 즉시 보내기 후 inflight 해제 창 | 유지 — 대기가 남아 있는 동안 새 전송은 pending 경로 |
| 0154 미확정 유예 | `post-turn.ts:140-152` | 변경 없음 | 유지 |
| `resumeScheduledReception` "새 child 에는 상속하지 않는다" | `contracts/turn.ts:12` | EP-12 | 유지(표식 이름만 변경) |
| main 레이어 규칙(판정·발신 분리) | `src/main/AGENTS.md §chat-turn 분해 1` | `decideSendNow` 를 admission.ts 에 | 유지 |
| `docs/AGENTS.md` IPC 변경 시 같은 PR 에서 IPC_CONTRACT 갱신 | `docs/AGENTS.md 작성 규칙 6` | EP-07 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 도구가 긴 응답에서 사용자는 끝날 때까지 기다려야 한다 | 의도된 결과(D-001). 즉시 보내기로 끊는다 |
| flush 직후 CLI 자동 턴이 동시에 시작되면 push 가 CLI 큐에서 fold 될 수 있다 | 현행 0143 경합 그대로 — `decidePostTurnStep` 이 busy 면 listen 선행. 이번 범위 밖 |
| 즉시 보내기 직후 '취소'로 대기를 모두 지우면 응답만 끊긴다 | 사용자 명시 행동 — 상태 표 행으로 고정 |
| Claude Code 와 다른 지점 4개 — 도구 경계 흡수 없음(D-002) · 단계 판정 없음(D-004) · 중단 표식 없음(D-010) · 병합 1버블(D-005) | 앞 둘은 사용자 결정, 뒤 둘은 범위 통제 — ADR-007 에 기록 |

- 되돌리기 어려운 결정: 채널 이름·형상(D-012).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{ipc,protocol,app-error}.ts` · `app/src/preload/index.ts`
- `app/src/main/adapters/{claude-adapt,claude,turn,types,mock,workspace-guard}.ts`
- `app/src/main/app/chat-turn/{index,admission,post-turn,turn-request,turn-context,enqueue}.ts`
- `app/src/main/contracts/{turn,ports}.ts` · `app/src/main/features/chat/{post-turn,pending-message-queue}.ts` · `app/src/main/features/sessions/session-runtime.ts`
- `app/src/renderer/src/features/chat/store/chatStore.ts` · `…/transcript/{PendingSteerTurn.tsx,pendingSteerControls.ts}` · `…/shared/api/ipc.ts` · `…/shared/i18n/resources/{ko,en}.ts`
- 테스트: §11 갱신·신규 목록
- `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md` · `docs/arch/backend/{runtime-ipc,adapters}.md` · `docs/decisions/{007-queued-input-next-turn,README}.md` · `docs/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md §chat-turn 분해 작업 규칙` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크: 이번 테스트는 DB 를 열지 않는다 — `npm test` 대신 직접 vitest.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/main/app/chat-turn src/main/features/chat src/main/features/sessions/session-runtime.test.ts src/main/adapters src/main/error-report.registry.test.ts src/renderer/src/features/chat`.
- 문서: `node scripts/check-doc-inventory.mjs` 재생성 → `--check`.
- 사람 실기(AC13):
  1. 도구를 여러 번 쓰는 긴 요청 중 메시지 전송 → 도구 호출이 지나가도 응답 안에 끼지 않고 대기 버블로 남음 → 응답이 끝나면 다음 턴으로 전송됨.
  2. 다시 응답 중 메시지 2건 전송 → 버블 hover 에 '즉시 보내기'·'취소' → '즉시 보내기' → 응답이 멈추고(부분 답변 유지) 두 메시지가 입력 순서대로 한 턴으로 전송됨. `run_in_background` 셸이 있었다면 계속 실행 중.
  3. 응답 중 메시지 전송 후 '중단' 버튼 → 대기 버블이 사라지고 composer 에 텍스트 복원(현행).

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — 인자 + Q1~Q3 → D-001~D-012.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다 — §5 흐름·상태 표.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — §2 원문 인용, "완전히 똑같은 형태"와의 충돌은 Q1·Q2로 사용자에게 닫음.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — 상태 표 8행 ↔ AC1~AC9.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축/구체성으로 작성되어 있다.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일/모듈 또는 AC에 추적 가능하다.
- [x] AS-IS에서 사라진 책임은 삭제/이동/대체 중 무엇인지 TO-BE에 명시했다 — 게이트 삭제, 중단 시퀀스 이동.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수·검산.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 상속 기준이 없으면 Baseline V — V1.
- [x] 모든 NEW/CHANGED node에 같은 레벨 REQUIRED pair가 있다 — R 11·SD 2·AR 6·MD 4.
- [x] 영향받은 INHERITED node는 REGRESSION — R-02·R-08·R-09·SD-03.
- [x] 각 pair의 경로·§10 전수 분모·직접 oracle이 있고 적대 증거가 필요한 pair만 선택 이유·변이를 갖는다 — M1~M11.
- [x] 현재 변경 산출물의 운영 gate가 열거됐다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 버튼 노출·클릭 매핑은 UT-04.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC11 음성 게이트는 AC1 행동과 짝.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다 — §10 EP-01~EP-18.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12.
- [x] 상한·총량·one-way door를 필요한 곳에서 계산했다 — §14 · D-012.
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 전체 교차검증했고, `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §8).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님) | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
