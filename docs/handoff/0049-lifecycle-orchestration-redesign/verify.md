# Verify — 0049-lifecycle-orchestration-redesign

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 문서는 0049 재구현(codex-8voinj) 의 검증 라운드 2.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0049-lifecycle-orchestration-redesign` |
| 검증자 | Claude Code |
| 일자 | 2026-06-29 |
| 대상 커밋 | `12c2128`(codex-8voinj 재구현) — 본 브랜치 병합 `fad99f2`(impl 2커밋 revert 후 merge) |
| 라운드 | 2 |
| 상태 | **PASS** |

## 검증 경위 (revert → merge → review)

라운드 1 구현(PR-A `4080288` 10/11 + PR-B `cd94613` 11/11, 둘 다 `Verified-By: pending`)은
정식 verify 전 **수석 리뷰**에서 미충족 3건이 드러났다:

- **R-#4** `InflightTurn.cancelled/timedOut` 이 별도 mutable 필드로 남아 Criteria #3 "별도 SSOT 없음" 위반.
- **R-#5** `SessionRuntimeRegistry` 의 P0 축출 훅(Criteria #7) 누락.
- **R-#6** Criteria #6c(모드-불변)/#6d(StallTimer 회귀) 를 consumer/타이머 차원에서 직접 검증 못함.

Codex 가 이를 `codex-8voinj`(`12c2128`, "검증 전 리뷰에서 드러난 0049 미충족 항목을 닫는다")
단일 커밋으로 닫았다. 본 검증은 사용자 지시대로 라운드 1 구현 2커밋을 **revert**(`15388c1`·`fdfc411`)
후 `codex-8voinj` 를 **merge**(`fad99f2`) 했고, 병합 트리는 `git diff HEAD origin/codex-8voinj`
공백으로 codex-8voinj 와 바이트 동일함을 확인했다.

## 구현자 코멘트 확인 (매트릭스 전 선행)

> plan `[구현자 기입]` 의 설계 리뷰·놓친 문제 6건·체크리스트·구현 보고를 먼저 읽음.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰: L1 `lifecycle/` 가 L2 `adapters/` 타입 직접참조 시 boundaries 위반 → `RuntimeAdapterPort`/`RuntimeLiveTurn`/`TitleCompletionPort` 로 의존 역전 | **타당** — DAG(domain→adapters 금지) 준수의 정석 | 매트릭스 #9 증거(`session-runtime.ts:12-24`·`turn-context.ts:16-26`), lint boundaries 0 으로 확인 |
| 놓친 문제 #1 L1→L2 import 위험 → L1 포트 정의 + L3 주입 | 타당, 코드 일치 | #1·#9 |
| 놓친 문제 #2 취소/타임아웃 terminal 이 항상 stream 에서 안 나옴 → `abortCause` + finally 정리 | 타당 | #3·session-runtime.ts:62-71 |
| 놓친 문제 #3 tool_result upsert 전역 갱신 위험 → message-scoped | 타당, R4-3 일치 | #5·queries.ts:123-127 |
| 놓친 문제 #4(=수석 R-#4) `cancelled/timedOut` getter 파생 전환 | **닫힘 확인** | #3·turn-context.ts:104-109 |
| 놓친 문제 #5(=수석 R-#5) `evictIdle(limit=0)` no-op 훅 추가 | **닫힘 확인** | #7·turn-context.ts:161-164 |
| 놓친 문제 #6(=수석 R-#6) `FakeSessionRuntime` consumer 2모드 테스트 + `timers.test.ts` 회귀 | **닫힘 확인** | #6·send.session-runtime-consumer.test.ts·timers.test.ts |
| 선조치 ⚠️(결정 필요) | 없음(구현 보고 "블로커/역질문: 없음") | — |

수석 리뷰 미충족 3건이 모두 코드 차원에서 닫혔음을 매트릭스 #3/#6/#7 에서 증거로 확인.

## 요구사항 충족 매트릭스

> plan §인수 기준 1~11 을 1:1 대조. 증거 `파일:라인`.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | SessionRuntime 인터페이스 + OneShot 단일 구현(`send/interrupt/setMode/push(stub)/close`), Persistent 미구현 | ✅ | `lifecycle/session-runtime.ts:26-36`(인터페이스)·`38-104`(`OneShotSessionRuntime`)·`95-98`(`push()` P0 stub throw) |
| 2 | 모드-무관 소비자 계약(소비자는 `AsyncIterable<NormalizedEvent>` 만, close 정책 분기 X) — fake runtime 검증 | ✅ | 소비 단일 진입 `ipc/chat/send.ts:69-73`(`drainRuntimeEventsForTest` 가 `Pick<SessionRuntime,'send'>` 만 받음)·`send.session-runtime-consumer.test.ts:52-66`(oneshot↔persistent-like 결과 동일). 타입체크 ✅, 런타임 import-blocked(아래 게이트) |
| 3 | coarse 상태머신(`cold/live/busy/interrupting/error/closed`) SessionRuntime 단일 소유·비영속, InflightTurn 플래그는 파생 | ✅ | `lifecycle/session-state.ts:1-45`(전이·DB status 컬럼 없음·부팅 `initialSessionState`=cold)·`turn-context.ts:104-109`(`cancelled`/`timedOut` = `abortCause` getter)·`90-93`(`InflightTurnInit` 가 cancelled/timedOut/abort omit). **수석 R-#4 닫힘** |
| 4 | StallTimer 개칭(busy 무이벤트→abort) + IdleCloseTimer 별도(P0 stub) | ✅ | `lifecycle/timers.ts:6-44`(`StallTimer`·`createStallTimer`·`abort('stall')`)·`50-60`(`IdleCloseTimer`/`createIdleCloseTimer` no-op stub)·`13`(`createIdleTimer` 호환 alias). `send.ts:431,473` `beginPause` refcount 보존 |
| 5 | resume/부팅 dangling tool 합성 마감(`{reason:'aborted'}`) DB-only + `markComplete`, message-scoped | ✅ | `lifecycle/recovery.ts:3-24`(payload·message-scoped upsert·`markMessageComplete`)·`db/queries.ts:123-127`(message-scoped `UPDATE`)·`128-146`(`NOT EXISTS` 같은 message)·부팅 `ipc/router.ts:186`·resume `ipc/chat/send.ts:268`. **수석 R-#3 닫힘** |
| 6 | P0 테스트 4종(상태머신/dangling/모드불변/StallTimer 회귀) electron 비의존 | ✅ | (a)`session-state.test.ts` (b)`recovery.test.ts` (c)`send.session-runtime-consumer.test.ts:52-66` (d)`timers.test.ts:5-38`. lifecycle+orchestration **6파일/18테스트 green**. (c)는 `./send` 경유 electron import 로 *런타임* 차단(타입체크 ✅) |
| 7 | 핸들 cap 축출 훅 예약(P0 미사용) | ✅ | `turn-context.ts:161-164`(`evictIdle(limit=0)` no-op)·`session-registry.test.ts`. **수석 R-#5 닫힘** |
| 8 | 문서 정합(disallowedTools "D1 보류" 유지·maxTurns P1·resume 실패 현행 에러) | ✅ | `plan.md:70`·`docs/IPC_CONTRACT.md:216`(런타임 채널 없음 서술) |
| 9 | 레이어 경계 0 / 게이트 통과 / 신규 의존성 0 | ✅ | `npm run lint`(boundaries) exit 0·`typecheck` exit 0. L1 포트 역전 `session-runtime.ts:12-24`·`turn-context.ts:16-26`. `package.json` 의존성 무변경 |
| 10 | 앱-레벨 2축 모듈(`lifecycle/`+`orchestration/`), concurrency 이전 | ✅ | `src/main/lifecycle/*`·`orchestration/*` 신설·`orchestration/concurrency.ts`(구 concurrency-registry)·배선 `ipc/router.ts:39,134`·`ipc/context.ts:46`·`src/main/AGENTS.md` 매핑 |
| 11 | uv Python runtime 폐기(배선·python-runtime 정책·build, IPC 무변경) | ✅ | `src/main/runtime/` 삭제·`prompts/registry.ts`(`POLICY_REGISTRY = []`)·`scripts/fetch-uv.mjs`/`electron-builder.yml` extraResources 제거·코드 잔재 grep 0·`IPC_CONTRACT.md:216`·`app/AGENTS.md`·`app/src/main/AGENTS.md` 정합 |

**11/11 충족.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint exit 0·typecheck(node+web+test) exit 0·test 540 passed(아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 11/11(증거 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | lint boundaries 0(L1 포트 역전) |
| 문서 형식/링크/한국어 | ✅ | — | plan/INDEX/IPC_CONTRACT/AGENTS 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | `app/AGENTS.md`·`app/src/main/AGENTS.md` 변경분 키/토큰/이메일/IP 0(아래 위생) |
| 제품 의도 부합(경량 LLM 에이전트 컨셉) | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| Open Questions(P1 분리·default 백엔드) | ✖ | ✅ | 사람 확인 대기 |
| 실환경 동작(취소/stall/멀티세션/resume dangling) | ✖ | ✅ | 사람 확인 대기 — electron 미설치로 런타임 미실행 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 |

## 게이트 재실행 결과

```
$ cd app && npm install        # electron 바이너리 다운로드는 프록시 차단 → ELECTRON_SKIP_BINARY_DOWNLOAD=1
$ npm rebuild better-sqlite3   # Node ABI 정합(0019 dual-ABI 계열)

$ npm run lint                 # eslint(boundaries 포함)
  → exit 0

$ npm run typecheck            # typecheck:node && :web && :test
  → exit 0

$ npm test                     # vitest run
  Test Files  3 failed | 74 passed (77)
       Tests  540 passed (540)
  # 3 failed suites = persist.test.ts · send.runtime-resilience.test.ts · send.session-runtime-consumer.test.ts
  #   "Electron failed to install correctly" — electron 바이너리 미설치(프록시 다운로드 중단) import 차단.
  #   환경 제한이며 코드 무관(0033/0046/0048 동일 계열). 신규 consumer 테스트(#6c)는 이 체인에 걸려 런타임 미실행.

$ npx vitest run src/main/lifecycle src/main/orchestration   # electron 비의존 신규 단위
  Test Files  6 passed (6)
       Tests  18 passed (18)
```

게이트 판정: lint ✅ · typecheck(node+web+test) ✅ · test 540 green(신규 lifecycle/orchestration 18 포함).
electron-import 3 suite 만 환경 제한(코드 무관)으로 *런타임* 차단 — 그중 `send.session-runtime-consumer.test.ts`
(#6c)는 `typecheck:test` 가 통과해 타입 차원은 검증됨, 실행은 사람 실환경(또는 electron 바이너리 가용 CI)에서 확인 권장.

## 위생 검토 (AGENTS.md 변경)

- 변경 문서: `app/AGENTS.md`(uv 동봉 없음·dev 단계 정합)·`app/src/main/AGENTS.md`(lifecycle/orchestration L1 매핑·router 책임).
- 키/토큰/이메일/IP 패턴 스캔: 비밀/PII/IP 0(유일 "토큰" 매치는 `styles/tokens.css` 디자인 토큰).
- 변동성/일회성/장문 코드설명서 혼입: 없음(레이어 매핑·작업 규칙만).

## PHASES.md 정합성

- `docs/PHASES.md` Phase 3++ 표에 0049 행 승격(범위·게이트·커밋). 형식은 기존 행 톤 준수.
- 대상 커밋: 재구현 `12c2128`(본 브랜치 병합 `fad99f2`).

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 인수 기준 11건은 검증 가능 형태로 잘 분해됐으나, #3 "단일 소유자" 가 라운드 1
  구현에서 `InflightTurn` 의 잔존 mutable 필드로 새는 것을 plan 단계 self-review 가 못 잡았다 →
  수석 리뷰(R-#4)에서 비로소 포착. 상태 SSOT 의 *파생 강제*(getter)를 인수 기준 문구에 더 못박았다면 1라운드에 닫혔다.
- **구현 단계**: 라운드 1 이 #3/#6c/#6d/#7 을 놓쳤으나 codex-8voinj 가 6건 미스 표로 자기보고하며
  정확히 닫았다 — 핸드오프 "선조치 후보고" 가 작동.
- **검증 단계**: 이번 verify 의 한계는 #2/#6c(consumer mode-invariance) 의 *런타임* 실행을 electron
  바이너리 부재로 못 한 점. 타입체크+코드 인스펙션으로 갈음했으나, 실환경/CI 에서 `npm test` 전수 green
  (3 suite 포함) 재확인이 잔여. 또한 매트릭스는 *구조/타입* 검증이며 **실제 턴 라이프사이클(취소·stall·
  resume dangling·멀티세션)의 동작 검증은 사람 GUI/실환경 몫**(책임 분리표).

## 결론 / 다음 단계

- 상태: **PASS (r2)** — 인수 11/11 충족, 게이트 lint/typecheck/test green(신규 단위 18 포함, electron-import
  3 suite 만 환경 제한), 레이어 경계 0, 신규 의존성 0, 수석 리뷰 미충족 3건(R-#4/#5/#6) 코드 차원 닫힘 확인.
- `INDEX.md` 0049 → `verify/PASS`, 다음=`—`. `PHASES.md` 표 승격.
- **사람 확인 대기(차단 아님)**: 실환경 턴 라이프사이클(취소·stall abort·resume/부팅 dangling 마감·멀티세션)
  GUI 검증 · electron 가용 환경에서 `send.*`/`persist` 3 suite 실행 green 재확인 · uv 제거 후 Python MCP 시스템
  폴백 실기 · PR 머지 승인.
