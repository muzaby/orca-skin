# Verify — 0046-approval-idle-pause

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능=Claude 가 impl·verify 연속 수행.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0046-approval-idle-pause` |
| 검증자 | Claude Code |
| 일자 | 2026-06-25 |
| 대상 커밋 | (push 후 기재) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 #1 early-return 은 pause 미적용 | 타당 | 매트릭스 #2 증거로 확인(pause/카운터가 `await approvals.register` try-finally 한정) |
| 선조치 #2 Q2 incomplete 게이트로 라이브 보호 | 타당 | 매트릭스 #6 증거 |
| 선조치 #3 tool_result append 위치 무영향 | 타당(셀렉터 맵 선구축) | 매트릭스 #6 + parts.settle-orphan 테스트로 확인 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | createIdleTimer pause/resume(reset/clear 불변) | ✅ | `app/src/main/ipc/chat/send.ts:55-77`(IdleTimer + `pause:clear, resume:reset`); 테스트 `send.runtime-resilience.test.ts`(idle pause/resume 3건) |
| 2 | 승인 보류 동안 idle pause, early-allow 제외, 카운터 0↔1 | ✅ | `send.ts` requestApproval: `pendingApprovals`+`activeIdle?.pause()/resume()` 가 `await approvals.register` try-finally 한정(isSessionAllowed early-return 미경유) |
| 3 | provider stall 시 120s abort 보존 | ✅ | idle 로직 불변(승인 외 경로는 매 이벤트 reset 유지) `send.ts` 이벤트 루프 `idle.reset()`; 기존 stall 테스트 2건 유지 |
| 4 | owner-gone(destroyed/render-process-gone) abort + finally 해제 | ✅ | `send.ts` `wc.once('destroyed'/'render-process-gone', onOwnerGone)` + 바깥 finally `removeListener` |
| 5 | IpcRouter.shutdown() settle+abort, will-quit 순서, TurnRegistry.all() | ✅ | `router.ts` shutdown(turns.all 순회 settleOpenToolRuns+abort); `index.ts` will-quit `routerRef?.shutdown()`→`closeDb()`; `turn-registry.ts` all()+테스트 |
| 6 | Q2 settleOrphanToolParts + LOAD incomplete 한정, 라이브 무영향 | ✅ | `lib/parts.ts` settleOrphanToolParts; `chatReducer.ts` LOAD_SESSION `m.incomplete ? settle… : m.parts`; 테스트 5건(complete/이미결과/no-op/Ask/child parent) |
| 7 | 게이트 통과·경계 0·의존성 0·IPC/DB 불변 | ✅ | 아래 게이트; lint boundaries 0; package.json 무변경; IPC 채널/스키마 무변경 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint ✅ / typecheck ✅ / test 508/508 실행분 ✅ |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 충족 |
| 레이어 경계 위반 0 | ✅ | — | eslint boundaries 0(변경=L3 ipc·L1 domain·features/chat 내부) |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX 한국어·표 |
| AGENTS.md 위생 스캔 | ✅ | ✅ | AGENTS.md 무변경(해당 없음) |
| 제품 의도 부합 | ✖ 보조 | ✅ | 사람 확인 대기(아래 GUI) |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ npm run typecheck   # node + web + test
typecheck:node ✅  typecheck:web ✅  typecheck:test ✅

$ npm run lint        # eslint --cache --fix (boundaries 포함)
✅ 무오류

$ npm test            # vitest run
Test Files  2 failed | 68 passed (70)
     Tests  508 passed (508)
```

- **2 failed suites** = `src/main/ipc/chat/persist.test.ts` · `src/main/ipc/chat/send.runtime-resilience.test.ts` — `Error: Electron failed to install correctly`(getElectronPath). 두 파일은 `send.ts→ipc/context.ts`의 `import { webContents } from 'electron'` 체인을 끌어와 **electron 바이너리 미설치 환경**(프록시가 대용량 다운로드를 중단)에서 import 자체가 실패한다. 코드 결함 아님 — handoff 0033/0041~0044 와 동일 계열의 환경 제한.
- better-sqlite3 는 Node ABI 재빌드 후 `db/queries.test.ts` 포함 전체 green(0019 패턴).
- **검증 한계**: 본 작업의 idle pause/resume 신규 테스트 3건은 위 환경 제한으로 이 머신에서 미실행. electron 설치 환경에선 실행된다. 여기서는 typecheck(통과) + 코드 1:1(매트릭스 #1~4) + 동형 단위 테스트(turn-registry.all·parts.settle-orphan 실행 green)로 갈음.

## PHASES.md 정합성

- PHASES "현재 작업 중"은 보드 링크만 유지. PASS 로 표 행 승격(아래 결론).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 종료/재시작 케이스를 사용자 추가 질의로 늦게 편입 — 초기 plan 에 라이프사이클(quit/crash/renderer-gone)을 빠뜨렸다. 이후 Q1/Q2 로 보강.
- 구현 단계: idle pause/resume 가 reset/clear 의 alias 라 단순 — 별도 상태 불요. 적정.
- 검증 단계: idle pause/resume·shutdown·owner-gone 의 **런타임** 검증을 이 환경(electron 미설치)에서 못 했다. 사람 GUI 검증으로 위임(아래). 가능하면 CI(electron 설치)에서 send.runtime-resilience 재실행 권장.

## 사람 수동 GUI 검증 대기 (헤드리스 한계)

- ⓐ plan/ask/위험도구 카드 띄우고 2분+ 방치 → 턴 abort 안 됨·카드 유지, 응답 시 정상 재개.
- ⓑ provider 무응답(스트림 stall) → 여전히 120s 후 abort.
- ⓒ 카드 보류 중 창 닫기/리로드 → 좀비 없이 종료.
- ⓓ 카드 보류 중 Cmd+Q → 재시작 후 세션 복원 시 도구가 "실행 중" 아님(중단됨)·승인 카드 재현 안 함.
- ⓔ 강제 종료(`kill -9`) 후 재시작에서도 ⓓ 동일(Q2 백스톱).

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 표 승격. PR(draft) 생성. 런타임/GUI 항목은 사람 확인 대기.

---

## 라운드 2 검증 (PR #137 GUI 피드백 — 동시 도구 승인 큐화)

| 항목 | 값 |
|---|---|
| 라운드 | 2 |
| 상태 | PASS |
| 범위 | 렌더러 전용(백엔드·IPC·DB 무변경) |

### 파생 이슈 충족

| # | 이슈 | 충족 | 증거 |
|---|---|---|---|
| D2 | 동시 도구 승인 덮어쓰기 소실 | ✅ | `chatReducer.ts` `pendingToolApprovals` 큐 append(permission.requested) + `RESOLVE_TOOL_APPROVAL{approvalId}` filter; `Composer.tsx` 스택 map 렌더; `chatReducer.tool.test.ts` "동시 3건 보존"·"approvalId별 제거" |
| D1 | 서브에이전트 승인 후 inflight 고착 | ✅ | D2 의 downstream — 큐화로 모든 approvalId 가 UI 에 유지·개별 응답 → broker 전부 해소·`pendingApprovals`→0 으로 idle resume. (백엔드 동시성은 라운드1에서 이미 정확) |

### 게이트

```
$ npm run typecheck   # node + web + test  → ✅
$ npm run lint        # boundaries 0       → ✅
$ npm test            # 509 passed (509 실행분)
```

- 2 failed suites(`persist`·`send.runtime-resilience`) = electron 바이너리 미설치 환경 제한(라운드1 동일, 변경 무관).
- 신규 의존성 0, IPC 채널/DB 스키마/백엔드 무변경.

### 검증 한계 (사람 GUI 대기)

- ⓐ 서브에이전트 N개 동시 도구요청 → 카드 N개 스택, 개별 승인/거부 시 각 서브에이전트 진행·전부 처리 후 inflight 해제.
- ⓑ 일부만 승인 후 나머지도 차례로 처리.
- ⓒ 단일 도구 승인 회귀 없음.

### 결론

라운드 2 **PASS** — 동일 PR #137 에 push. D1/D2 코드 해소, 런타임/GUI 는 사람 확인 대기.

---

## 라운드 4 검증 (동시 서브에이전트 승인 — idle pause/reset 경쟁)

| 항목 | 값 |
|---|---|
| 라운드 | 4 |
| 상태 | PASS (코드/게이트 + 사람 GUI 확인 완료) |

### 파생 이슈 충족
| # | 이슈 | 충족 | 증거 |
|---|---|---|---|
| D3 | 동시 N 서브에이전트 승인 시 idle pause 무력화 → inflight 고착 | ✅ | `send.ts createIdleTimer` `paused` 플래그 — `reset()` paused 중 no-op(이벤트 루프·child 이벤트가 pause 무력화 못 함); `send.runtime-resilience.test.ts` "paused 중 reset 반복해도 미abort" |
| (하드닝) | SDK 권한요청 취소 시 무한 await/먹통 카드 | ✅ | `claude.ts makeCanUseTool` `options.signal`→`requestApproval`→`AbortSignal.any`(send.ts)→broker; 렌더러 `permission.resolved`가 approvalId 로 카드 정리 |

### 게이트
typecheck ✅(node+web+test) / lint ✅(boundaries 0) / test **509/509 실행분**. 2 suites(`persist`·`send.runtime-resilience`) electron 미설치 환경 제한(신규 paused 테스트 포함 — typecheck 검증, electron 환경서 실행). canUseTool signal 테스트(7건)는 실행 green. 신규 의존성 0, IPC 채널 0.

### 검증 한계 / 정직 노트
pause-race 는 코드 확정 버그·단건성공/동시실패와 정합하나, 관측 증상(무한·무에러)과 100% 일치 확증은 GUI 런타임뿐. 진단 로그(`[approval]`, 0025 wireLog 게이트) 동봉 — 주 수정 후에도 재현되면 로그로 잔여 원인(SDK/CLI 동시 처리) 확정.

### 사람 GUI 검증 — ✅ 확인 완료 (2026-06-25, 사용자)
- 서브에이전트 3개 동시 도구승인 → 각 승인 시 **정상 진행·inflight 해제 확인**(사용자 "정상동작 확인함"). 단건 회귀 없음.
- pause-race 가설(D3)을 GUI 로 확정. 진단 로그(`[approval]`)는 향후 회귀 시 사용.

### 결론
라운드 4 **PASS** (코드/게이트 + 사람 GUI 확인 완료). PR #137. 핸드오프 0046 전 라운드(1~4) 종료 — 머지 승인은 사용자 몫.

---

## 라운드 5 — /simplify 정리 (동작 보존)
세션 변경분 품질 정리(behavior-preserving). ① idle pause 를 `IdleTimer.beginPause()` refcount 로 일원화 — `send.ts` 의 `pendingApprovals` 카운터 + `pause/resume` 이원 메서드 제거(동시 N건 동치). ② 라운드4 조사용 `[approval]` 진단 로그 + `context.isWireLog()` 제거(GUI 확정으로 소임 종료). 유지: `options.signal` 존중(정상 SDK 계약)·queue·owner-gone·Q1/Q2. 게이트 typecheck/lint ✅·test 509/509 실행분(refcount 테스트는 electron 환경서 실행, 여기선 typecheck 검증). 신규 의존성 0·IPC 0.
