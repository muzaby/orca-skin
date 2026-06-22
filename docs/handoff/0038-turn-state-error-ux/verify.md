# Verify — 0038-turn-state-error-ux

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 작업은 *버그수정/UX*(비기능)이므로 Claude 가 plan → impl → verify 를 직접 수행했다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0038-turn-state-error-ux` |
| 검증자 | Claude Code |
| 일자 | 2026-06-22 |
| 대상 커밋 | `a886f67` (plan 기재 `6c13da0` 은 미존재 — 위생 노트 ① 참조) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

> plan 의 인수 기준 8개를 1:1 로 대조. 증거는 `파일:라인` + 테스트 출력.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 도구 **거부** 후 무result 종료해도 in-progress 해제(폴백 종료 이벤트) | ✅ | `send.ts:337-343` — `for await` 정상 종료 후 `!sawTerminal && !controller.signal.aborted` 면 폴백 `telemetry` emit(`persist`+`sendChatEvent`). reducer `telemetry`→`inflight=false`(`chatReducer.ts:291`). mock `tool_approval.deny` 가 closing 제거(`mock-scenarios.ts` `toolApprovalFragment` `deny:[]`)로 이 경로를 실제 재현. |
| 2 | **취소**(턴 취소) 시 `turn.aborted` 즉시 종료(회귀 없음) | ✅ | cancel 핸들러 무변경. catch 의 `if (turn.cancelled && controller.signal.aborted) return`(`send.ts:357`)·폴백 가드 `!controller.signal.aborted`(`send.ts:337`)로 이중 발행 방지. `turn.aborted`→`inflight=false`(`chatReducer.ts:321-329`). |
| 3 | API 400/조기종료 무한대기 없음 + "재시도 N/M" + 최종 에러 배너 | ✅ | retryable 분기 직전 `turn.retrying` emit(`send.ts:366-372`, attempt+1/MAX_RETRIES), 최종 실패 `sawTerminal=true`+`error` emit(`send.ts:382-388`). UI `RetryStatus`(`PendingAssistant.tsx:41-49`) `재시도 {attempt}/{max} · {label}`. reducer `turn.retrying`→inflight 유지+retry 세팅(`chatReducer.ts:268-272`). 테스트 `chatReducer.runtime-resilience.test.ts` 신규 케이스 green. |
| 4 | SDK `result`(is_error/비-success)가 에러 배너로 표면화(빈 완료 금지) | ✅ | `claude-map.ts:233-244` — `r.is_error===true \|\| (r.subtype!==undefined && r.subtype!=='success')` 면 telemetry 외 `errorEvent(makeClassifiedError('stream_error', …))` push. 테스트 `claude-map.test.ts` "result 에러는 telemetry 와 error 이벤트를 함께 낸다" green. |
| 5 | 쿨 테마 에러 표시 빨강(`--color-bad`), classic/dark 도 일관 | ✅ | `ErrorCard.tsx:25-30`(`border-bad/40`·`bg-bad/10`·`text-bad`×2), `Exchange.tsx:58` TurnErrorBanner(`border-bad/40 bg-bad/10`), `ToolCard.tsx:108,143`(`text-bad`), `ToolGroup.tsx:46`(`text-bad`). `rust`/`rust-soft` 잔존 0(에러 표시 한정). |
| 6 | mock `tool_calls`·`tool_approval`(allow/deny)·`ask_question` in-progress→종료보장으로 정상종료 | ✅ | `mock-scenarios.ts` 프래그먼트화 — 도구/사용자요청 시나리오 `closing()` 제거(in-progress 종료). 테스트 `mock-scenarios.test.ts` deny 케이스 `message.completed=false`·`telemetry=false` 단언 추가 green. |
| 7 | `full` = text·reasoning·tool_calls·tool_approval·ask_question·plan_review → 도구호출 에러점프 | ✅ | `mock-scenarios.ts` `full` 6 프래그먼트 순차 + `errorJumpFragment`(`tool.call.started` 직후 `tool.call.completed` 없이 `error`). 테스트 `events.at(-1)={type:'error'}`·`telemetry` 부재 단언 green. |
| 8 | 세션 복원 시 모델 라벨 `provider/모델`(provider 기본 모델), `<provider>` 단독 금지 | ✅ | `Composer.tsx:132-139` — `providerKey && modelFamily==null` 이면 `agent.models.find(isDefault) ?? models[0]` 로 `setModel(providerKey, modelKey(model), agent.adapter)`. effect deps 에 `modelFamily` 추가. |

**결과: 8/8 충족.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/typecheck:test/test/build | ✅ | — | lint clean · typecheck(node+web+test) clean · test **429/429** · build ✓ |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 (위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | eslint-plugin-boundaries(lint) 위반 0. send/persist=L3·claude-map/mock=L2·classifier=L1 하향 의존만, shared `ipc.ts`=L0 순수 타입, renderer 변경=`features/chat` 내부 |
| IPC 변경 동기화 | ✅ | — | `turn.retrying` variant + telemetry 폴백 노트 + full 시나리오 설명 갱신(IPC_CONTRACT §2.13/§3). IPC **채널 수 40 유지**(NormalizedEvent variant 추가는 채널 무증가) |
| 신규 의존성 | ✅ 0 | ✅ 승인 | 신규 의존성 0 |
| 제품 의도 부합(거부/취소 의미론·재시도 렌더·모델 폴백) | ✖ 보조 | ✅ 결정 | plan §사용자 확정 결정 3건 반영 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** |
| PR 머지 승인 | ✖ | ✅ | **사람 확인 대기** |

## 게이트 재실행 결과

```
$ cd app && npm ci            # node_modules 부재 → 설치(876 packages)
$ npm rebuild better-sqlite3  # Node ABI 정렬(0019 dual-ABI 계열)
$ npm run lint                # clean (eslint --cache --fix, 출력 없음)
$ npm run typecheck           # node + web + test 전부 clean
$ npm test
  Test Files  60 passed (60)
       Tests  429 passed (429)
$ npm run build               # electron-vite build ✓ built in 3.36s
```

- **1차 test**: `db/queries.test.ts` 11-red — `better-sqlite3` 가 postinstall 에서 Electron ABI 로 빌드되어 vitest(Node ABI)에서 `Module did not self-register`. **본 변경과 무관**(0019 dual-ABI 환경 계열, 9개 선행 verify 동일 패턴). `npm rebuild better-sqlite3`(Node ABI) 후 **429/429 green**.

## 위생 검토

- AGENTS.md 변경 없음 → 키/토큰/이메일/IP 스캔 대상 외.
- 문서 변경(IPC_CONTRACT)은 한국어·표 톤 유지, 신규 비밀/변동성 정보 혼입 0.
- **위생 노트 ①**: impl 커밋 기재 불일치 — plan/INDEX 의 대상 커밋 `6c13da0` 은 미존재, 실 커밋은 `a886f67`(코드+구현보고 합본). history 기록용(INDEX 9개 선행 행 동일 패턴).
- **위생 노트 ②**: impl 커밋(`a886f67`) trailer 가 `Agent: codex` 인데, 본 작업은 *비기능 = Claude 직접 구현*이므로 규약상 `Agent: claude` 가 옳다. 또한 커밋 제목 `docs(handoff): 0038 구현 보고 갱신` 이 실제 전체 코드 구현(13파일)을 포함해 범위를 과소기술. 동작·검증에는 무영향, 후속 커밋 규약 준수로 해소.

## PHASES.md 정합성

- `docs/PHASES.md` 완료 표에 0038 행 승격(커밋 `a886f67`). 형식·한국어 컨벤션 기존 행과 일치.

## 결론 / 다음 단계

- **상태: PASS** — 인수 8/8, 게이트 4종(lint/typecheck/test 429/build) 통과, 레이어 경계 0, 신규 의존성 0, IPC 채널 40 유지.
- INDEX `verify/PASS` 갱신 + PHASES 표 승격.
- **사람 확인 대기**: ① 거부/취소 후 in-progress 해제 실기 ② 재시도 "N/M" 배너 시각 ③ 쿨/classic/dark 에러색 ④ 세션 복원 모델 라벨 ⑤ mock `full`/거부 경로 실기 ⑥ PR 머지(verify §책임 분리).
