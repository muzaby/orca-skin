# Plan — 0153-live-persist-structure-parity

## 메타

| 항목 | 값 |
|---|---|
| slug | `0153-live-persist-structure-parity` |
| 작성자 | Claude Code |
| 일자 | 2026-07-28 |
| 매핑 | PR #292 후속 (0151·0152 와 별건) |
| 상태 | **DRAFT — 재현 정보 대기(아래 "블로킹 입력")** |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "재시작 시 메시지버블의 위치가 재조정됨. 이 말은 위에 언급했던 내용과 다르게 랜더링된다는 것임. **db 영속과 당시의 렌더링이 다르다**" | 라이브 세션 버그 리포트 (실기, 2026-07-28) |
| 명시 요구 | 이 건을 후속 핸드오프 **0153** 으로 진행 | 라이브 세션 지시 |
| 선행 관찰(맥락) | "자녀가 있는 상황에서 새 메시지를 보냈을 때 이미 답변 델타가 많이 쌓여있어서 한번에 렌더링 되는 상황. **델타가 발생하는 동안 assistant 직전 턴이 종료된 것처럼 되고 있는 것이 문제**" | 동상(직전 리포트) |

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

## 현재 판단

지금까지의 조사로는 **라이브와 DB 의 `messages` 구조가 일치해야 한다.** 그런데 사용자는 재시작 시 위치가 바뀌는 것을 실제로 봤다. 따라서 다음 중 하나다:

1. **라이브 리프(R7)의 시각적 위치** 문제 — 스트리밍 중 `PendingAssistant` 는 **tail exchange 안**에 렌더된다. steer 가 커밋되면 새 exchange 가 생기므로, *직전 응답의 잔여 델타* 가 **steer 버블 아래**에 붙어 보인다. 사용자의 직전 리포트("델타가 발생하는 동안 assistant 직전 턴이 종료된 것처럼 되고 있다")와 정확히 일치한다. 이 경우 **재시작 후 위치가 "재조정" 되는 게 아니라, 라이브 쪽이 과도기적으로 어긋나 보였던 것**이 된다.
2. 내가 아직 보지 않은 경로에서 파트/메시지가 다르게 커밋된다 — 유력 후보: **서브에이전트 child 파트**(`parentToolRunId`). 사용자가 "자녀가 있는 상황" 을 명시했다.
3. 위 트레이스가 실제 이벤트 순서와 다르다 — 예: `message.completed` 가 steer echo **이후**에 도착해 pre-steer 텍스트가 post-steer 메시지로 들어간다.

**추측으로 고치지 않는다.** 1번이면 고칠 대상이 렌더 계층(라이브 리프 배치)이고, 2·3번이면 커밋 계층이다. **정반대 방향의 수정**이라 재현 정보 없이 손대면 다른 회귀를 만든다.

## 블로킹 입력 (사용자 확인 필요)

다음 중 하나면 즉시 좁혀진다:

- **A. 구체 before/after** — 재시작 **전** 화면의 버블 순서와 **후** 순서를 한 줄씩(예: `전: [사용자 질문][답변][내 steer]` / `후: [사용자 질문][답변 일부][내 steer][답변 나머지]`). 어느 버블이 어디로 갔는지가 곧 원인 위치다.
- **B. 로그** — 해당 세션에서 `~/.config/orca/logs/` 의 `ipc.wire.event`(DebugPanel "로그" 스위치 ON) — `input.echo` 와 `message.completed` 의 **상대 순서**가 3번 가설을 판정한다.
- **C. 서브에이전트 유무** — 이 현상이 **서브에이전트(자녀) 없이도** 재현되는가. 재현되면 2번 가설이 배제된다.

## 인수 기준 (재현 정보 확보 후 확정 — 잠정)

1. 라이브 `messages` 구조와 재로드 `messages` 구조가 **같은 이벤트 시퀀스에 대해 일치**함을 기계적으로 고정한다(차등 테스트).
2. 사용자가 본 재조정이 재현되지 않는다.
3. 회귀 0 — 기존 transcript/persist 스위트 green.

> AC 는 원인이 확정되면 구체화한다. 지금 숫자를 채우면 검증 불가능한 기준이 된다.

## 범위 / 비범위

- **범위(확정 후)**: 라이브 표현 ↔ 영속 구조의 **동치 보장** + 차등 회귀 테스트.
- **비범위**: 0151(큐 상태 머신)·0152(고아/순서) — 이미 PR #292 에 있음. 이 건은 커밋 **이후** 표현 계층이다.
- **부수 작업**: PR #292 본문의 "알려진 미해결" 절에 적은 원인 추정("main 은 분할하는데 renderer 는 한 버블 유지")이 **R4·R5 트레이스로 반증**됐으므로 정정한다.

## 리스크

| 리스크 | 완화 |
|---|---|
| 원인 미확정 상태에서 렌더 계층을 고치면, 실제 원인이 커밋 계층일 때 **증상만 가리고 DB 는 계속 틀린다** | 블로킹 입력을 받고 착수 |
| 차등 테스트가 main·renderer 두 트리를 함께 import 해야 하는데 `boundaries/include` 가 트리별로 분리돼 있다 | 배치 후 `npm run lint` 로 확인. 걸리면 순수 그룹핑 규칙만 양쪽에서 뽑아 비교하는 형태로 축소 |

## 참고

- `app/src/main/infra/db/queries.ts:132` · `features/history/writer.ts:66-107`
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts:285-294,311-336,614-624`
- `app/src/renderer/src/features/chat/lib/turns.ts` · `components/transcript/TranscriptView.tsx`
- 선행: 0067(커밋 단일 경로) · 0069(확정 신호) · 0143/0149(서브에이전트·라이브 델타 가드)
