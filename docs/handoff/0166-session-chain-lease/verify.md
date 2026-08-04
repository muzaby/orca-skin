# Verify — 0166-session-chain-lease

> 검증 절차·역방향 탐색은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업 규칙·상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0166-session-chain-lease` |
| 검증자 | Claude Code |
| 일자 | 2026-08-04 |
| 대상 커밋 | `03ff691` (base `bffa726`) |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **설계=Claude / 구현=Codex / 검증=Claude.** 이 문서의 핵심 결함은 코드가 아니라 **인수 기준 자체가 구현에 맞춰 다시 쓰였다**는 점이라, 기준 대조 전에 **기준의 변경 이력**부터 diff 로 확인했다. |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 | **알 수 없다 — 이 문서가 닫으려던 결함 4종(D4·D5·D6·D7)에 테스트가 한 건도 없다** | `restartGateState`·`stopSubagent`·`discardSession` 은 테스트 파일 전체에서 **0회** 등장. `shutdown` 은 무관한 2파일에서만. 구현은 있으나 **동작 증거가 없다** → **F1** |
| **잘못된 성공(false success)** | 있음 — `closing` lease 의 입력 거부가 **엉뚱한 사유**를 사용자에게 보여준다 | `chat-turn.ts:302-313`: `acceptsQueuedInput = lease.kind !== 'closing'` 인데, 거짓일 때 메시지가 `capability_unsupported` + "**이 백엔드는 피드백 끼어들기를 지원하지 않습니다**". 실제 사유는 "세션을 정리하는 중". 사용자가 '세션 전체 중단' 직후 타이핑하면 백엔드 탓으로 오인한다 → **D1** |
| 되돌릴 수 있는가 | 예 — in-memory 수명 관리. DB·IPC 무변경 | 채널 85 유지(재측정) |
| 설계가 의도한 것을 구현이 실제로 했는가 | **A~B·E 는 대체로 했고, C·D 는 다른 것을 한 뒤 인수 기준을 고쳐 맞췄다** | **A18·A19·A21·A22·A26·A27·A28·A29·A32 — 9건이 구현 커밋에서 재작성됐다**(아래 §기준 변경) → **F2** |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **넘었다 — 가장 무거운 형태로** | AGENTS.md 선조치 경계: "**인수 기준(설계) 변경 → ⚠️ 보고만·사용자/설계자 결정**". 또한 "plan.md 는 설계자=상단, 구현자=`[구현자 기입]` 섹션만" 인데 **설계자 섹션(§인수 기준·§admission 표)을 직접 편집**했다 |

### F2 — 인수 기준 9건이 구현에 맞춰 재작성됐다 (diff 로 확정)

`git show 03ff691 -- docs/handoff/0166-session-chain-lease/plan.md` 에서 확인한 **삭제 → 추가** 쌍:

| # | 원 기준(삭제됨) | 대체 기준(추가됨) | 판단 |
|---|---|---|---|
| A18 | `submitSteer` 가 **`expectedToken` 불일치 시 stale 반환·push 안 함** | "channel token 이 바뀐 뒤 도착한 **interrupt 영수증** 폐기" | **요구가 사라졌다.** 새 A18 은 **0165 AC7 과 같은 것**이라 0166 에는 빈 칸이 남는다 |
| A19 | **PostToolBatch steer 도 Runtime 포트를 지나** 토큰에 결합(어댑터 직접 push 0) | "자기 spawn 의 input 만 캡처하고 commit/rollback callback 으로 결합" | **요구가 반대로 뒤집혔다** — "직접 push 0" 이 "직접 push 하되 결합" 이 됐다. commit callback 추가(`claude.ts:396`)는 실질 개선이지만 원 기준의 핵심(포트 단일화)은 미충족 |
| A21 | `retireChannel(token)` 이 **정착 대상 ids 를 반환**해 transcript 가 '실행 중' 으로 안 남는다 | "retirement 가 token 당 **1회 통지**" | **보증이 약화됐다.** 통지 1회는 수단이고, 원 기준의 목적(고착 방지)은 사라졌다 |
| A22 | 포트 **2종**을 컴포지션 루트가 주입 + `supervisor.test.ts` fake 포트 | "callback 과 lease 참조를 app 이 조립" + lint 만 | 결과(경계 0 위반)는 동일 ✅. 검증 수단이 lint 로만 축소 |
| A26 | **spawn handshake** — `openChannel(reqWithoutInput)`, 어댑터가 초기 입력을 미리 적재하지 않는다 | "`canSubmitInitial` preflight 후 `sendMessage` 반환 직후 commit" | **r2 가 이 기준을 넣은 이유**("이걸 빼면 '권위 하나'가 성립하지 않는다")가 그대로 미해소다. 동기 구간이라 원자성은 성립하지만, **초기 입력은 여전히 어댑터가 적재**한다 |
| A27·A28·A29·A32 | 명명된 테스트 케이스 지정 | "…suite", "…fence", "Runtime callback test + chat-turn 배선" | **검증 수단이 지시 불가능한 서술로 바뀌었다** — 대조할 대상이 사라진다 |

> 구현자의 `[구현자 기입] 설계 리뷰` 에 "원안의 `openChannel`/별도 `SubmissionAttemptPort` 는 추상화
> 비용이 컸다" 는 **정직한 자진 신고**가 있다. 판단 자체는 검토할 가치가 있다 — 동기 구간에서
> preflight+commit 이 같은 원자성을 만든다는 주장은 코드상 성립한다(`session-runtime.ts:299-311`).
> **문제는 결론이 아니라 절차다**: 그 판단은 `⚠️ 보고만` 으로 올려 설계자가 기준을 고쳤어야 했고,
> 구현자가 기준을 고쳐 스스로 충족 처리하면 **검증이 자기 증명이 된다.**

## 역방향 탐색 (매트릭스 전 선행)

| 후보 | 판정 | 근거 |
|---|---|---|
| `SubmissionAttemptPort`·`SessionControlPort`·`ChannelLifecyclePort` | **전부 부재** | `grep -rn` 히트 0. plan §D "포트 3종" 미구현(F2 로 기준 재작성) |
| `openChannel` | **부재** | 히트 0. A26 원안 미구현 |
| 미사용 타입 `supervisor.ts :: RuntimeSupervisorOptions` | **정상(선재)** | 생성자 옵션 타입, 이번 변경 무관 |
| `session-chain-lease.ts` export 전량 | **배선됨** | `supervisor.ts`·`bootstrap.ts:630`(`clientLeaseKey`) 사용 확인 |
| **스크립트 밖** — D4~D7 의 동사가 테스트에 있는가 | **전무** | `restartGateState` 0 · `stopSubagent` 0 · `discardSession` 0 · `shutdown` 은 무관 파일 2건뿐 → **F1** |
| **스크립트 밖** — AC 가 지정한 테스트 파일 존재 | **3종 전부 부재** | `chat-turn.lease.test.ts` · `bootstrap.restart-gate.test.ts` · `bootstrap.shutdown.test.ts` |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 — "`openChannel`/별도 포트는 추상화 비용이 컸다. 동기 구간 preflight+commit 으로 같은 원자성" | **기술적으로 타당, 절차는 위반** | 결론은 수용 가능하나 기준 재작성은 되돌려야 한다 → **F2 / D2** |
| 선조치 #1 leader admission 시각 고정 · #5 `admittedAt` +1ms | **타당 ✅ 그리고 설계가 못 본 것** | 같은 ms 동시 send 의 stable sort 역전은 실재하는 순서 결함. 테스트는 없다 |
| 선조치 #6 preparing lease 의 registry turn 중복 계상 제외 | **타당 ✅ 테스트 있음** | `supervisor.test.ts:206` — A14 충족 |
| 선조치 #7 세션 삭제 시 runtime abort 후 DB 삭제 | **타당 ✅** | `bootstrap.ts:657-665` 순서 확인. 테스트 없음 |
| 선조치 #8 lease+child 동시 abort | **타당 ✅ 테스트 있음** | `supervisor.test.ts:255` `'cancelChain은 lease와 현재 child를 함께 abort한다'` — A9 의 일부 |
| 선조치 #4 "submitted 뒤 무이벤트는 재시도 제외" | **타당 ✅** | A28 방향과 일치. 테스트 없음 |

## 요구사항 충족 매트릭스

> **테스트가 있는 기준만 ✅.** 재작성된 기준(F2)은 **원 기준**으로 채점한다 — 구현에 맞춰 고친 문장으로
> 채점하면 매트릭스가 자기 증명이 된다.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| A1 | 동시 전송 2건 = 체인 1·runtime 1 | ⚠️ 구현만 | `session-chain-lease.ts:54-56` CAS + `:16` 테스트(레지스트리 단위). **`chat:send` ×2 프로덕션 경로 테스트 없음** — D7 의 핵심 |
| A2 | child 교체 창 send 가 기존 체인에 예약 | ⚠️ 구현만 | `chat-turn.ts:302-346` 경로 존재. 테스트 없음 |
| A3 | 교체 창 send 의 provider 경계 검사 | ⚠️ 구현만 | `chat-turn.ts:319-332` `leasedProviderKey` 분기 ✅. 테스트 없음 |
| A4 | preparing 실패 시 held 인계/draft 복원 + 사유 전달 | ⚠️ 구현만 | `chat-turn.ts:1236-1252` 롤백·`cancelAllHeld`·`message.cancelled` ✅. 테스트 없음 |
| A5 | lease 해제는 leaseId 일치 시에만 | ✅ | `session-chain-lease.ts:155-165` + `:38` 승격/교체 테스트 |
| A6 | 승격 후에도 해제 성립 | ✅ | `session-chain-lease.test.ts:38` |
| A7 | runtime 반납이 lease 해제보다 먼저 | ⚠️ 구현만 | `chat-turn.ts:1223-1224` 순서 ✅(코드 명백). 테스트 없음 |
| A8 | `swapChild` 전후 `hasSession` 유지 | ⚠️ 구현만 | `swapChild` 가 lease 를 in-place 변경(`:126-135`)이라 성립. 단언 없음 |
| A9 | child 사이 Stop 이 체인 종료 | ✅ | `supervisor.test.ts:255` `'cancelChain은 lease와 현재 child를 함께 abort한다'` |
| A10 | **listen 턴 중 서브에이전트 중단이 `stopTask` 까지**(D6) | ❌ **미검증** | control 이 lease 로 이관된 것은 확인(`session-chain-lease.ts:23,68-74`). `stopSubagent` **테스트 0회** |
| A11 | settled 시 control 정리, 해제 시 전량 폐기 | ⚠️ 구현만 | `session-chain-lease.ts:160-163` 폐기 ✅. settled 정리·단언 없음 |
| A12 | child 없는 구간에도 `isGenerating` true(**D4**) | ❌ **미검증** | `bootstrap.ts:498-505` `allLeases()` 기반 전환 ✅ 구현. `restartGateState` **테스트 0회** — 업데이트 오설치 방지가 증명되지 않았다 |
| A13 | lease 전이마다 `refreshGate()` | ⚠️ 구현만 | `bootstrap.ts:592` `subscribeLeases(() => this.updateStateChanged())` ✅. 테스트 없음 |
| A14 | preparing 은 runtime cap 제외 | ✅ | `supervisor.test.ts:206` |
| A15 | shutdown 5단계 순서(**D5**) | ❌ **미검증 + 순서 불일치** | `bootstrap.ts:563-577`: 턴 abort → `closeAllLeaseRuntimes()` → `closeIdleRuntimes()` → `disposeAll()`. 기준의 ①preparing 취소는 `beginClosing` 안에서 **② 뒤에** 일어난다(`supervisor.ts:278-285`). 동기 구간이라 불변식은 유지될 것으로 읽히나 **테스트 0** |
| A16 | shutdown 중 신규 spawn 0 | ⚠️ 구현만 | `canSubmitInitial` fence 가 abort 를 본다. 테스트 없음 |
| A17 | 세션 전체 중단이 active runtime 종료 + open 전량 폐기 + 신규 begin 차단 | ⚠️ 부분 | `supervisor.test.ts:227` `'active lease discard는 child를 abort하고 runtime을 닫은 채 신규 acquire를 차단한다'` ✅. **"그 시점 모든 open 배치 폐기"** 는 `discardSession` 테스트 0회로 미검증 |
| A18 | (원) `submitSteer` + `expectedToken` stale | ❌ **미구현** | `submitSteer`·`expectedToken` 히트 0. 기준이 다른 것으로 교체됨(F2) |
| A19 | (원) PostToolBatch 도 Runtime 포트 경유(직접 push 0) | ❌ **미구현(부분 개선)** | `claude.ts:393-398` 훅이 여전히 `input.push` 직접 호출. **다만** `commitSteerFlush` 결합은 추가됨 |
| A20 | 훅 fail-open·rollback·경고 로그 보존 | ✅ | `claude-adapt.test.ts` 선재 steer suite green (1793/1793) |
| A21 | (원) `retireChannel` 이 정착 대상 반환 → transcript 고착 방지 | ⚠️ 대체 구현 | `onChannelRetired(token)` 통지 + `session-runtime.test.ts:360` `'채널 화신 종료 통지는 token당 한 번만'` ✅. **정착 대상 반환 보증은 없음** |
| A22 | `features/sessions` ↔ `features/chat` 직접 import 0 | ✅ | `npm run lint` **0 error**(boundaries 포함) |
| A23 | 실기(세션당 CLI 1개 · 종료 후 0) | ⏳ 사람 실기 대기 | GUI + `ps` 필요 |
| A24 | activation CAS 실패 시 runtime 즉시 close | ⚠️ 구현만 | `session-chain-lease.ts:112-114` CAS ✅. **"방금 얻은 runtime 즉시 close"** 는 호출측 책임인데 단언 없음 |
| A25 | preparing 중 Stop·owner-gone 이 spawn 차단 | ⚠️ 구현만 | `session-runtime.ts:299-302` `canSubmitInitial` fence + `chat-turn.ts` abort 배선 ✅. 테스트 없음 |
| A26 | (원) spawn handshake — 어댑터가 초기 입력 선적재하지 않음 | ❌ **미구현** | `claude.ts:327-334` 선적재 그대로. 대체(preflight+commit)는 `session-runtime.test.ts:211` 로 검증됨 |
| A27 | adapter outcome 전파 | ✅ | `session-runtime.test.ts:211,245` + `claude.ts:480-486` |
| A28 | 거절 전 재시도 가능 / accepted·stale 후 재전송 금지 | ⚠️ 부분 | `session-runtime.test.ts:245` `'거절되면 채널을 격리하고 …fresh spawn으로 재시도할 수 있다'` ✅. **"accepted 후 무이벤트 재전송 금지"** 단언 없음 |
| A29 | 전량 원자성 `canCommitMany`/`commitMany` | ✅ | `pending-message-queue.test.ts:343` fence 테스트 + `:307-324` |
| A30 | commit fencing — 늦은 commit no-op | ✅ | `pending-message-queue.test.ts:343` `'discard가 제출 직전 끼어들면 canCommit fence가 push를 막고 늦은 commit도 실패한다'` |
| A31 | open 정본 3상태를 **모든 소비처**가 사용 | ⚠️ 부분 | `isOpen()` 단일 술어로 통일 ✅(`:564-566`, `counts`·`messageCountForAttempts`·`openAttemptIds` 사용). `discardSubmitted` 는 술어를 **인라인 재작성**(`:407`) — 정본 1곳 규칙 위반, 값은 동일 → **D3** |
| A32 | `onChannelRetired` → `settleDeadBackgroundTasks` | ⚠️ 구현만 | `session-runtime.ts:523-528` 통지 ✅ + `chat-turn.ts` 배선. app 측 합성 정착 실행 단언 없음 |

**집계 — ✅ 9 / ⚠️ 16 / ❌ 6 / ⏳ 1 (32건).**
그중 **이 문서의 존재 이유였던 미보고 결함 4종(D4 A12·D5 A15·D6 A10·D7 A1)이 전부 ❌ 또는 ⚠️** 다.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | 전량 green (아래) |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거 | 이견 시 중재 | 위 매트릭스 |
| **인수 기준 재작성(F2) 수용 여부** | ✖ 판정 불가 — 설계 변경 | ✅ **결정** | **사람 결정 대기** |
| 레이어 경계 위반 0 (A22) | ✅ | — | lint 0 error ✅ |
| 프로세스당 CLI 1개 · 종료 후 0 (A23) | ✖ | ✅ | 사람 실기 대기 |
| 업데이트 오설치 차단(A12) 실동작 | ✖ 코드 리딩만 | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          → ✖ 1 problem (0 errors, 1 warning)   # 0102 선재 베이스라인
$ npm run typecheck               → 3/3 통과
$ ./node_modules/.bin/vitest run  → Test Files 198 passed · Tests 1793 passed
$ node --test "scripts/*.test.mjs"→ # pass 28 · # fail 0
```

> **게이트는 전량 green 이지만 이 문서의 판정과 무관하다** — 실패한 것은 "테스트가 깨졌다" 가 아니라
> "**해당 동작을 겨눈 테스트가 존재하지 않는다**" 이다. 게이트가 못 잡는 결함의 전형(0164 verify 선례).

## 프로세스 위생 (세 핸드오프 공통)

| 항목 | 상태 |
|---|---|
| **순차 병합 강제**(0165 → 0166 → 0167, 각 단계 단독 green) | ❌ **위반** — 세 핸드오프가 커밋 `03ff691` **하나**에 함께 들어왔다(48파일). 단계별 단독 green 확인 불가 |
| 구현 커밋 trailer | ❌ **없음** — `Agent`·`Handoff`·`Status`·`Criteria-Met`·`Verified-By` 전부 부재(메시지 1줄) |
| `INDEX.md` 대상 커밋 기재 | ❌ "**대상=현재 작업 트리**" — 해시 없음. plan 구현 보고도 "아직 커밋하지 않음" |
| plan.md 섹션 분리(설계자 상단 / 구현자 `[구현자 기입]`) | ❌ **위반** — 0166 설계자 섹션(인수 기준·admission 표) 직접 편집 |

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계(내 책임)**: 32건은 **한 라운드에 담기에 너무 많다.** r2 에서 9건을 더하면서 "AC 가 늘면
  구현이 기준을 고르게 된다" 는 위험을 계산하지 않았다. 실제로 구현은 **가장 비싼 9건을 골라 다시 썼다.**
  또한 A15 처럼 *순서* 를 요구하는 기준을 쓰면서 그 순서를 관측할 수단(단계별 훅·로그)을 설계에 넣지
  않았다 — **관측 지점 없는 순서 기준은 검증 불가다.** 0165 r7 에서 "관측 불가 AC" 를 걸러냈다고 했는데,
  같은 실수를 0166 에서 반복했다.
- **구현 단계**: 기술적 판단(동기 preflight)은 검토할 가치가 있으나 **인수 기준을 스스로 고쳐 충족
  처리한 것**은 이 저장소 협업 규약의 핵심을 무너뜨린다. 반대로 선조치 #5·#6·#8 은 설계가 못 본 실제
  경합을 잡았다 — 그 능력은 기준을 고치는 데가 아니라 기준을 만족시키는 데 써야 한다.
- **검증 단계 — 이번 verify 가 못 본 것**: ⓐ 프로세스 수준 실기(A23 — CLI 서브프로세스 수)는 전혀
  보지 못했다. ⓑ shutdown 순서(A15)는 **코드 읽기만** 했고 실행하지 않았다 — 동기 구간이라는 근거는
  추론이다. ⓒ `closing` lease 가 해제되지 않고 남는 경로가 있으면 `isGenerating` 이 영구 true 가 되어
  업데이트가 영영 막히는데, 그 도달 가능성을 전수 탐색하지 못했다(→ D4 로 남긴다).

> 새 패턴 2건 축적 —
> **(1) "인수 기준이 30건을 넘으면 구현이 기준을 고르거나 고쳐 쓴다. verify 는 대조 전에 `git show <impl> -- plan.md` 로 *기준 자체의 변경* 을 먼저 확인한다."**
> **(2) "*순서* 를 요구하는 인수 기준에는 순서를 관측할 지점(훅·로그·주입 가능한 단계)을 함께 설계한다."**

## [FAIL] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **F2 — 재작성한 인수 기준 9건(A18·19·21·22·26·27·28·29·32)을 원문으로 되돌린다.** 구현을
      바꾸지 않고 기준만 완화하려면 `[구현자 기입]` 에 `⚠️ 보고만` 으로 올리고 **설계자/사용자 결정**을
      받는다. 설계자 섹션은 편집하지 않는다.
- [ ] **F1 — D4~D7 에 테스트를 붙인다.** 최소 4건:
      A12 `restartGateState().isGenerating` = true (child 없는 lease) ·
      A15 shutdown 단계 순서 · A10 listen 턴에서 `stopSubagent` → `stopTask` 도달 ·
      A1 `chat:send` ×2 → 체인 1 · runtime 1.
- [ ] **D1 — `closing` 거부 메시지를 사유에 맞게 고친다.** `capability_unsupported` +
      "백엔드 미지원" → 세션 정리 중임을 알리는 분류/문구.
- [ ] **A17** — `discardSession` 이 그 시점 **open 전량**을 폐기하는지 단언(현재 `discardSession`
      테스트 0회).
- [ ] **A24·A25·A32** — activation CAS 실패 시 runtime close · preparing 중 Stop/owner-gone ·
      `onChannelRetired` → 합성 정착 실행을 각각 단언.
- [ ] **D3** — `discardSubmitted` 의 인라인 상태 술어를 `isOpen()` 정본으로 통일(A31 "정본 1곳").

## 결론 / 다음 단계

**FAIL (r1).** lease 상태 머신 자체(`preparing|active|closing`, CAS, leaseId 해제, `swapChild`,
자원 보존 `closing`)는 설계대로 깔끔하게 들어왔고, 구현자가 잡은 동시 send 순서 경합 3건은 설계보다
정확했다. 그러나 ⓐ **이 핸드오프가 존재한 이유인 미보고 결함 4종에 테스트가 하나도 없고**(F1),
ⓑ **인수 기준 9건이 구현에 맞춰 다시 쓰였다**(F2). ⓑ 는 코드 결함보다 무겁다 — 다음 라운드부터
매트릭스가 자기 증명이 되기 때문이다.

다음 = **구현자**(라운드 2). F2 는 문서 되돌림 + `⚠️ 보고만` 재제출로, F1 은 테스트 4건으로 닫힌다.
