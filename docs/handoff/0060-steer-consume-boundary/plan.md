# Plan — 0060-steer-consume-boundary

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 `0059-steer-queue-feedback` 의 후속 버그수정 —
> steer 버블의 **커밋 경계**를 "SDK 가 입력을 pull 한 순간"에서 **"모델이 그 메시지를 실제로 받아들인 지점"**
> 으로 옮기고, 그 지점 이후에도 턴이 살아 있도록 **sub-turn 연속성**을 도입한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0060-steer-consume-boundary` |
| 작성자 | Claude Code |
| 일자 | 2026-07-28 |
| 매핑 | PHASES 행 / PR (요청 시) |
| 상태 | **READY** |
| 구현 주체 | **Claude** (비기능 — 버그수정) |
| 선행 | `0059-steer-queue-feedback`(steer 기전·UX) · `0052`(TurnCoordinator) · `0054`(SessionRuntime) · `0013`(세션별 store 라우팅) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 (버그 1) | "잔여(steer) 메시지가 있는 상황에서 새 메시지를 보냈을 때 이미 답변 델타가 많이 쌓여 있어서 한 번에 렌더링되는 상황이 발생한다. **델타가 발생하는 동안 assistant 직전 턴이 종료된 것처럼 되고 있는 것이 문제.**" | 라이브 세션 버그리포트(2026-07-28) |
| 명시 요구 (버그 2) | "재시작 시 메시지 버블의 위치가 재조정됨. **영속과 당시의 렌더링이 다르다.**" | 라이브 세션 버그리포트(2026-07-28) |
| 명시 정정 | "steer 메시지를 result 경계에서 커밋한다는 말은 더 이상 **posttoolbatch** 에서 커밋하지 않는다는 의미인가?" — 설계자가 잡은 "result 경계" 단독 전제를 사용자가 교정. | 라이브 세션(2026-07-28) |
| 명시 결정 (경계) | **PostToolBatch 훅과 `result` 중 먼저 오는 것.** | AskUserQuestion(2026-07-28) |
| 명시 결정 (채택 조건) | "직전 응답 완료 경계가 **db영속과 순서가 똑같다면** 그렇게 진행하라." | AskUserQuestion(2026-07-28) |
| 명시 결정 (중단 시 잔여) | 이미 SDK 로 전달된 steer 는 **사용자 메시지로 커밋**. | AskUserQuestion(2026-07-28) |
| 추론 의도 | 두 버그는 **하나의 근인**(턴 경계 오판)에서 갈라진다는 해석 — 커밋 지점과 종료 판정을 같이 고쳐야 한다(내 해석). | 설계자 해석 |

## Context (왜)

0059 는 "끼어들기 성공 = SDK 가 큐를 pull 한 순간(producer-side)" 이라는 모델 위에 서 있다(0059 plan §자료조사·리스크). 실제로는 pull 은 **우리가 텍스트를 SDK transport 에 넘긴 시각**일 뿐이고, 모델이 그 메시지를 대화에 받아들이는 지점은 따로다. 그래서 버블이 응답 한복판에서 굳고, 그 뒤 도착하는 `result` 가 "턴 종료"로 오판돼 라이브 렌더가 멈춘다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **pull ≠ 소비.** `push(text)` 는 텍스트를 버리고(`void text`) `() => nextInjectedInput?.()` thunk 를 큐에 넣는다. SDK transport 가 generator 를 eager drain 하므로 thunk 는 push 직후 실행되고, 그 자리에서 `onConsume` 이 발화한다. | `@app/src/main/adapters/streaming-input.ts:50-59,74-80` · `@app/src/main/adapters/claude.ts:279-282` |
| **그 발화가 곧 영속·forward** 였다 — 응답 한복판에서 user row + `steer.flushed`. | `@app/src/main/lifecycle/turn-coordinator.ts:82-99,126-128` |
| **첫 terminal = 턴 전체 종료**로 하드코딩. `SessionRuntime` 은 `yield` 직후 `live.close()` 까지 한다 → 코디네이터가 뒤늦게 rewrite 해도 못 막는다(신호는 **어댑터가 만들어야** 한다). | `@app/src/main/lifecycle/session-runtime.ts:18-20,75-82` · `@app/src/main/lifecycle/turn-coordinator.ts:140-142` |
| 렌더러는 telemetry 에서 `inflight=false` → `PendingAssistant`(`isLast && inflight`)가 사라져 이후 델타가 **보이지 않게** 누적되고, 다음 `SEND_USER_MESSAGE` 때 한 번에 렌더된다. | `@app/src/renderer/src/features/chat/reducer/chatReducer.ts:339-353` · `.../store/chatStore.ts:361-369` · `.../components/transcript/Exchange.tsx:54` · `.../TranscriptView.tsx:74,76` |
| **`PostToolBatch` 훅 = "전체 도구 호출 배치가 해결되며, 다음 모델 호출 전에 배치당 한 번"**, TypeScript SDK 지원. 루프 내 소비 지점의 1급 관측점. | [SDK hooks 문서](https://code.claude.com/docs/ko/agent-sdk/hooks) · `@docs/spec/claude/agent-sdk/hooks.md:147-152` |
| 스트리밍 입력의 대기 메시지는 "**순차적으로 처리**" — 별도 sub-turn(자체 `result`) 경로도 존재한다. 버그 1 의 `inflight=false` 가 그 증거. | [SDK streaming-input 문서](https://code.claude.com/docs/ko/agent-sdk/streaming-vs-single-mode) · `@docs/spec/claude/agent-sdk/streaming-vs-single-mode.md:69` |
| Orca 훅 인프라는 이미 있으나 **등록된 핸들러가 0개**(`adaptHooks` 가 `{}` 반환) → 이번이 첫 실사용. 중립 어휘 9종 + `backendSpecific` 이스케이프 해치. | `@app/src/main/extensions/hooks.ts:9-18,50-57` · `@app/src/main/adapters/claude-adapt.ts:99-128` |
| `drainForFlush` 가 세션 큐 전체를 `\n\n` 로 병합해 **단일 텍스트**를 돌려준다 → 0059 요구 4(단일 버블) 는 경계를 옮겨도 그대로 유지된다. | `@app/src/main/lifecycle/steer-queue.ts:49-58` |
| `TurnCoordinator` 는 **턴 스코프 인스턴스**(`handleChatSend` 안에서 `new`) → 턴-로컬 상태를 두기에 적합. | `@app/src/main/ipc/chat/send.ts:393-404` |
| 제목 생성 `maybeStart` 는 `titleGenerationStarted` 로 **이미 멱등** → sub-turn 다중 발화는 무해(그래도 의미 정합상 게이팅). | `@app/src/main/ipc/chat/title-generation.ts:14-27` |
| `NormalizedEvent` 는 main→renderer send 라 zod 스키마가 없다 → 타입만 고치면 계약 갱신 완료. | `@app/src/shared/protocol.ts:42-43` · `@docs/IPC_CONTRACT.md` |

## 인수 기준 (Acceptance Criteria)

1. **pull 은 커밋 신호가 아니다.** `streaming-input.push(text)` 가 실텍스트를 큐에 넣고, `onConsume`/`nextInjectedInput` 간접층이 제거된다. SDK 가 입력을 pull 해도 **영속·forward 가 일어나지 않는다**(회귀 가드 테스트).
2. **소비 경계 관측.** 중립 훅 어휘에 `on-tool-batch-end`(claude `PostToolBatch`) 추가 + 어댑터가 턴-스코프 핸들러를 합성 등록해 발화 시 `req.onModelCallBoundary?.()` 를 호출한다. 사용자/확장 훅과 공존(머지).
3. **`continuation` 계약.** `NormalizedEvent` telemetry variant 에 `continuation?: true` 추가. 어댑터가 **미커밋 steer 존재 여부**(`req.hasPendingSteer?.()`)로 태깅한다. steer 없는 턴에서는 **키 자체가 붙지 않는다**(조건부 spread).
4. **연속성 존중.** continuation telemetry 는 `SessionRuntime.isTerminal` ✗, 코디네이터 `sawTerminal` ✗, 렌더러 `inflight`/`turnStartedAt` 유지. usage 적재·`markMessageComplete`·assistant 메시지 reset·`lastTelemetry` 갱신은 **그대로 수행**.
5. **커밋 지점 3곳.** ① PostToolBatch → 플래그 → 코디네이터 루프가 **다음 이벤트 처리 직전**에 커밋 ② telemetry forward **직후** ③ 턴 정착(`finalizeSteer`).
6. **정렬 동일성(채택 조건).** 경계에서 `persist(telemetry)` → `forward(telemetry)` → `persistSteerUserMessage` → `forward(steer.flushed)` 순서가 보장돼 DB·라이브 모두 `[응답-전][steer user][응답-후]`. store 테스트가 `messages` 배열로 못박는다.
7. **정착 정책.** 턴 종료(정상·error·abort) 시 ① 미커밋 steer 는 **사용자 메시지로 커밋**(사용자 결정) ② 전달조차 못 된 큐 잔여는 `steer.cancelled` + 큐 비우기(현행 누수 해소 — 다음 턴 첫 flush 오염 방지).
8. **취소 비대칭 해소.** `chatStore.cancelSteer` 의 낙관적 제거를 제거 — main 의 `steer.cancelled` 수신 시에만 pending 버블 제거 + 컴포저 재주입.
9. **무회귀.** steer 미사용 턴의 이벤트·DB·렌더 동작 0 변경, 레이어 경계 0, 신규 의존성 0, **IPC 채널 수 불변**(52).

## 범위 / 비범위

- **범위**: 커밋 경계 이동(pull → PostToolBatch|result) · sub-turn 연속성 · 정착 정책 · 취소 비대칭 · 문서.
- **비범위**: interrupt 병용(현재 답변 절단 후 즉시 소비) — 0059 Open Question 유지. `enactAdmissionDecision` 의 `queue`/`steer` dead seam(0056 잔재, 실제 경로는 explicit `chat:steer`). 전달 완료 상태의 시각 표현(`steer.delivered` 류 신규 이벤트).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 모듈: `adapters/{streaming-input,claude,claude-adapt}` · `extensions/{hooks,types}` · `lifecycle/{session-runtime,turn-coordinator,steer-queue,ports}` · `ipc/chat/{send,persist}` · renderer `features/chat/{reducer,store}`. 전부 기존.
- SDK 전제: TypeScript SDK 의 `HookEvent` 유니온에 **`'PostToolBatch'` 가 존재**한다(문서 §사용 가능한 훅 = TypeScript "예").
- **신규 의존성 0.**

## 설계

### 레이어별 변경

| 레이어 | 변경 | 성격 |
|---|---|---|
| L0 `shared/ipc.ts` | telemetry `continuation?: true` | 계약(optional — 미인지 코드는 현행 동작) |
| L2 `adapters/streaming-input.ts` | `push(text)` 실텍스트화, `onConsume`/`nextInjectedInput` 제거 | 간접층 제거(pull=신호 폐기) |
| L1 `extensions/hooks.ts` | `NormalizedHookEvent` 에 `on-tool-batch-end` | 중립 어휘 9→10 |
| L2 `adapters/claude-adapt.ts` | `on-tool-batch-end` → `PostToolBatch` 매핑 | 어댑터 구체 |
| L2 `adapters/claude.ts` | 턴-스코프 훅 합성(머지) + telemetry `continuation` 태깅 | 신호 생성(가장 상류) |
| L1 `extensions/types.ts` | seam 교체: `onInputConsumed`·`consumeInjectedInput` 제거 → `onModelCallBoundary`·`hasPendingSteer` | 포트 |
| L1 `lifecycle/session-runtime.ts` | `isTerminal` 에 `continuation !== true` | 종료 판정 |
| L1 `lifecycle/turn-coordinator.ts` | `commitSteer`(개명) · 경계 플래그 · telemetry 직후 커밋 · `sawTerminal` 조건 · turn-level `finally` 의 `finalizeSteer` | 가로축 구동체 |
| L1 `lifecycle/steer-queue.ts` | `clear(sessionId)` | 정착 |
| L3 `ipc/chat/persist.ts` | `onTurnEnd` 만 `!continuation` 게이팅 + 주석 갱신 | 최소 변경(테스트 환경 제약) |
| renderer `reducer/chatReducer.ts`·`store/chatStore.ts` | continuation 가드 · `cancelSteer` 비낙관화 | UX 정합 |

### 재사용할 기존 함수·파일

`SteerQueue.drainForFlush`(병합) · `TurnPersistence.persistSteerUserMessage`(마감 안전망 포함) · `adaptHooks`/`makeClaudeHookCallback`(훅 배선) · `APPEND_COMMITTED_USER_MESSAGE`(0059 D1) · `COMMIT_PENDING_TEXT`(잔여 live 확정) · 컴포저 `restoredDraft` 재주입 경로.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **PostToolBatch 미발화 응답**(도구 없는 순수 텍스트 답변) → result 경계 단독으로 커밋. 폴백이 곧 기본 경로.
- **PostToolBatch 로 이미 커밋된 뒤 오는 result** → 미커밋 steer 없음 → `continuation` 미태깅 → 정상 종료(루프 내 소비 경로에서 턴이 안 닫히는 오판 원천 차단).
- **경계 플래그 후 이벤트가 더 안 오는 경우** → `finalizeSteer` 가 커밋.
- **중단/에러** → 전달분 커밋 + 미전달분 취소(인수 7).
- **stall 타이머** — sub-turn 사이 공백은 모델 지연(초 단위) ≪ 임계. 오히려 연속성 도입으로 "steer 응답이 영영 안 오는" 행업이 타이머로 회수된다.
- **mock 어댑터**(`canSteer=false`) — `chat:steer` 가 capability 에러로 조기 반환 → 큐 항상 빔, 무회귀.
- **멀티세션** — 커밋은 `turn.dbSessionId` 스코프, pending 은 세션별 store(0013).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 | 완화책 / 결정 |
|---|---|
| 설치된 SDK 타입에 `PostToolBatch` 부재 가능 | 구현 1단계에서 타입 확인. 없으면 `backendSpecific.claude` 로 등록, 그마저 불가면 **result 단독 graceful degrade**(설계가 그대로 동작, 커밋만 늦어짐). |
| 훅 콜백에서 직접 persist 하면 아직 루프에 도달 못 한 tool_result 보다 버블이 위로 감 | 훅은 **플래그만** 세우고 커밋은 코디네이터 루프 선두에서 — 단일 제어 흐름 유지. |
| `continuation` 오판으로 턴이 안 닫힘 | 판정을 카운터가 아니라 **"미커밋 steer 존재"**(코디네이터 상태)로 둔다. 커밋되면 즉시 false. |
| 이벤트 순서(1·2 가 3·4 보다 먼저)가 깨지면 정렬 불일치 재발 | `forward` 호출 순서를 테스트로 못박음(인수 6). |
| 취소 비낙관화로 클릭 후 반응이 한 틱 늦음 | 정확성 우선(이미 전달된 항목을 지우는 거짓 UI 제거). |

- 되돌리기 어려운 결정: 없음(계약은 optional 필드 추가, 채널 변경 0).
- **단독 결정 금지 항목**: 없음 — 경계·정착 정책은 사용자가 확정(위 Intent 표).

## 영향 받는 파일

- main: `adapters/{streaming-input,claude,claude-adapt}.ts` · `extensions/{hooks,types}.ts` · `lifecycle/{session-runtime,turn-coordinator,steer-queue}.ts` · `ipc/chat/persist.ts`
- shared: `src/shared/ipc.ts`
- renderer: `features/chat/reducer/chatReducer.ts` · `features/chat/store/chatStore.ts`
- 테스트: `adapters/streaming-input.test.ts` · `adapters/claude-adapt.test.ts` · `lifecycle/{turn-coordinator,steer-queue}.test.ts` · renderer `reducer/*.test.ts` · `store/chatStore.test.ts`
- 문서: `docs/IPC_CONTRACT.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `@docs/handoff/0059-steer-queue-feedback/plan.md`(전제 모델 — 본 핸드오프가 "pull=소비" 부분을 supersede)
- [SDK hooks](https://code.claude.com/docs/ko/agent-sdk/hooks) · `@docs/spec/claude/agent-sdk/hooks.md:147-152`
- [SDK streaming-input](https://code.claude.com/docs/ko/agent-sdk/streaming-vs-single-mode) · `@docs/spec/claude/agent-sdk/streaming-vs-single-mode.md:69`
- **IPC 변경**: `@docs/IPC_CONTRACT.md` (§6 절차)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`
- 신규/갱신 테스트: `streaming-input`(실텍스트 push·close 멱등) · `claude-adapt`(훅 매핑) · `turn-coordinator`(pull 무커밋 가드 · 경계 커밋 · forward 순서 · continuation · 정착) · `steer-queue`(`clear`) · `chatReducer`(continuation) · `chatStore`(전체 시퀀스 배열 잠금 · 취소 비낙관).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 버그리포트 2건 + "posttoolbatch" 정정 + 경계/조건/정착 결정 3건 인용, 추론(단일 근인) 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인` · `@docs/spec/…` · 웹 URL.
- [x] 인수 기준 — 9개 번호, 검증 가능, 무회귀 포함.
- [x] 의존 기술 — 기존 모듈 + SDK `PostToolBatch` 전제(미검증 리스크 등재), 신규 의존성 0.
- [x] 파생 UX — 훅 미발화·이중 커밋·플래그 후 무이벤트·중단·타이머·mock·멀티세션.
- [x] 리스크 — SDK 타입·훅 커밋 순서·오판·이벤트 순서·취소 지연 + 완화책. 단독 결정 금지 항목 없음(전부 사용자 확정).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- **인수 8(`cancelSteer` 비낙관화)은 전제가 틀려서 구현하지 않았다.** 설계는 "이미 SDK 로 전달된 항목은 main 이 취소할 수 없는데 렌더러만 지운다"고 봤지만, 실제로는 큐 항목이 **커밋 경계까지 큐에 남아 있어** `SteerQueue.cancel` 이 성공한다 — main·renderer 는 일치한다. 진짜 비대칭은 **모델**을 향한 것이고(이미 stdin 으로 나간 텍스트는 회수 불가), 그건 "전달 즉시" 정책의 성질이라 코드 한 줄로 고칠 문제가 아니다. 파생 이슈로 이관(D1).
- 대신 **진짜 유령 버블 경로**를 고쳤다: `chat:steer` 가 capability 미지원/전달 실패로 조기 반환할 때 `steer.queued` 를 안 보내 렌더러의 낙관적 pending 이 영원히 남던 문제 → 두 경로 모두 `error` + `steer.cancelled` 로 마감.
- `push()` 를 `boolean` 반환으로 바꿔 "close 된 스트림에 밀어넣기" 를 **호출자가 감지**하게 했다. 설계가 예상한 "미전달 잔여" 카테고리가 구조적으로 사라져(전달 실패 시 즉시 큐에서 되돌림) `SteerQueue.clear` 는 불필요해졌다 — 정착은 `commitSteer` 하나로 충분.

## [구현자 기입] 구현 체크리스트

- [x] L0 `continuation` 계약
- [x] L2 streaming-input 단순화(+ `push` 전달 성공 여부 반환)
- [x] L2 훅 어휘·매핑·합성 등록(`withModelCallBoundaryHook`)
- [x] L2 telemetry 태깅
- [x] L1 연속성 존중(session-runtime·coordinator)
- [x] L1 커밋 3지점(경계 플래그·telemetry 직후·정착)
- [x] L3 persist `onTurnEnd` 게이팅 + 안전망 주석
- [x] 렌더러 continuation 가드 (`cancelSteer` 비낙관화는 미채택 — 위 설계 리뷰)
- [x] 테스트
- [x] 게이트 green
- [x] IPC_CONTRACT

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `adapters/{streaming-input,claude,claude-adapt,mock,types}.ts` · `extensions/{hooks,types}.ts` · `lifecycle/{session-runtime,ports,turn-coordinator}.ts` · `ipc/chat/{send,persist}.ts` / shared: `shared/ipc.ts` / renderer: `features/chat/reducer/chatReducer.ts` · `features/chat/store/chatStore.ts` / 테스트 4파일 / 문서 2건 |
| 실행 명령 | `npm run lint` · `npm run typecheck`(node+web+test) · `npm test` · `npm run build` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test **635/635 (84 파일)** / build ✅ — better-sqlite3 Node ABI 재빌드(`npm rebuild better-sqlite3`, 0019 계열) 후 db 계열 포함 전체 green |
| 블로커 / 역질문 | 없음. SDK `HookEvent` 에 `'PostToolBatch'` 존재 확인(`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:757`) → 설계에 등재했던 폴백(backendSpecific / result 단독) 불필요 |
| 대상 커밋 | (push 후) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | **pending 취소의 의미가 반쪽이다.** 전달은 `chat:steer` 시점(즉시)이고 커밋만 경계로 미뤄지므로, hover 취소(0059 요구 5)는 *DB·트랜스크립트에서만* 지운다 — 모델은 이미 그 텍스트를 받았고 답을 할 수 있다. 결과적으로 "보이지 않는 사용자 메시지에 대한 응답"이 생길 수 있다. | 0060 구현 중 발견(설계 인수 8 재검토) | 택1 필요(사용자 결정): ① 전달도 경계로 미뤄 취소를 진짜로 유효하게(끼어들기 반영이 한 배치 늦어질 수 있음) ② 전달 후에는 취소 버튼을 감추고 '전달됨' 상태 표기(신규 이벤트 1종) ③ 현행 유지(취소=표시상 철회). | open |
