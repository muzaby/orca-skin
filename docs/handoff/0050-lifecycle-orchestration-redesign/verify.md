# Verify — 0050-lifecycle-orchestration-redesign

## 메타

| 항목 | 값 |
|---|---|
| slug | `0050-lifecycle-orchestration-redesign` |
| 검증자 | Claude Code |
| 일자 | 2026-06-29 |
| 대상 커밋 | 구현(C1~C4) `d8ec70d` + 검증 중 갭보강(인수 2·6c, Claude) `0535be9` |
| 라운드 | 2 (PASS-final) |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 §: PR-A/C3 까지 이어 구현, resume 는 `turns.hasSession` 로 live skip·`settleOpenToolRuns` 재사용 안 함(DB-only) | 타당 | 인수 5 매트릭스에서 코드로 확인(`send.ts:288-290`·`recovery.ts:31`) |
| 놓친 문제 #1~3 (scoped upsert·markComplete·DB-only recovery) | 타당, 모두 ✅ 선조치 | 인수 5 증거로 반영 |
| 라운드2 커밋(plan:320): 과거 PR-A/C3 커밋이 trailer 규약 위반 → 이번 구현 커밋부터 표준 trailer 로 복구 | 타당 | `d8ec70d` 는 `refactor` 타입·trailer 정상 파싱 확인(위생 검토). 다만 보드 대상커밋이 미해결 placeholder(`HEAD`)·유령 해시(`3c737fb`) — 본 verify 가 교정 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | SessionRuntime OneShot 단일구현 | ✅ | `lifecycle/session-runtime.ts:18` `OneShotSessionRuntime`. Persistent 미구현. (`push()` stub 부재·`setMode`→`setPermissionMode` 는 경미 명칭차, 동작 동일) |
| 2 | 모드-무관 소비자 계약 (FakeSessionRuntime) | ✅ | 소비: `send.ts:482` `for await … runtime.send()` close 정책 무분기. 테스트: `session-runtime.test.ts` `SessionRuntime mode-invariance` 2 케이스(`0535be9`) — OneShot/persistent 소비 출력 동일 |
| 3 | 상태머신 단일 소유·별도 SSOT 없음 | ✅ | `turn.cancelled/timedOut` 필드 **제거**(`turn-context.ts`), `RuntimeLiveTurn.markAborted?/cancelled?/timedOut?`(`ports.ts:15-17`), 소비자는 런타임 파생 읽기(`send.ts:79·83`), StallTimer 위임(`timers.ts:21`) |
| 4 | StallTimer/IdleCloseTimer 분리 | ✅ | `timers.ts` `createStallTimer`+`STALL_TIMEOUT_MS`+`createIdleCloseTimer`(P1 stub). `send.ts:45-46` re-export 무회귀 |
| 5 | resume/부팅 dangling 마감 | ✅ | `recovery.ts` message-scoped(`upsertToolResultPartScoped`)·`markMessageComplete`·`isSessionLive` skip·부팅(`router.ts:123`)+resume(`send.ts:288`)·`{reason:'aborted'}` 통일. `queries.ts` `findDanglingToolCalls`(complete=0·NOT EXISTS·message scope) |
| 6 | P0 테스트 4종 | ✅ | (a)`session-state.test.ts` (b)`recovery.test.ts` (c)`session-runtime.test.ts` mode-invariance (d)`timers.test.ts` StallTimer abort. 4/4 |
| 7 | 핸들 cap 축출 훅 예약 | ✅ | `session-registry.ts:48` `evictIdle()`+`maxIdleRuntimes`(P0 미사용) |
| 8 | 문서 정합 (disallowedTools D1 보류·maxTurns P1) | ✅ | `disallowedTools` 코드 미주입(grep 0, D1 보류 유지). `app/AGENTS.md`·`src/main/AGENTS.md` uv 행 제거·`lifecycle/orchestration` L1 등재. `IPC_CONTRACT.md`·`provider-runtime.md` 정합 |
| 9 | 레이어 경계 0·게이트·신규의존 0 | ✅ | `lifecycle`/`orchestration`=L1, `ports.ts` 의존역전(L2 미import). lint(boundaries) 0 error, 신규 의존성 0 |
| 10 | 2축 모듈 구조 | ✅ | `src/main/lifecycle/`+`orchestration/` 신설, `concurrency` 이전, `ipc/chat/turn-registry.ts`=re-export shim(무회귀) |
| 11 | uv Python runtime 폐기 | ✅ | `runtime/*` 4파일·`fetch-uv.mjs`·`electron-builder.yml` extraResources·`package.json` 스크립트·`index/router/context` 배선 삭제. 정책 cascade: `POLICY_REGISTRY=[]`(`registry.ts`)·`python-runtime.md` 삭제·`loader` 빈 sources·`buildAppend/loader` 테스트 갱신. IPC 무변경 |

**11/11 충족.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0·typecheck(node+web+test) 0·test 542 passed |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 11/11(위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | boundaries 0 error |
| 문서 형식/링크/한국어 | ✅ | — | OK |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 0(아래) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | N/A(메인 구조 변경, UI 무변경) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint            # eslint --cache --fix ./src → 0 error
$ npm run typecheck                 # node + web tsc --noEmit → 0 error
$ npm run typecheck:test            # tsconfig.test → 0 error
$ npm test                          # vitest run
   Test Files  2 failed | 74 passed (76)
        Tests  542 passed (542)
```

- **환경 제약(코드 무관)**: `send.runtime-resilience.test.ts`·`persist.test.ts` 2파일은 **로드 단계**에서 실패 — `Error: Electron failed to install correctly`(electron 바이너리 다운로드가 프록시에서 TLS 중단으로 차단). 테스트 *내용* 실패가 아니라 electron 의존 모듈 import 가 불가한 환경 제한이다(0019 ABI 클래스와 동형의 환경 제약). 두 파일의 핵심 회귀(StallTimer 6d)는 electron 비의존 `lifecycle/timers.test.ts` 가 직접 커버하므로 인수 충족에 공백 없음.
- 신규/대상 테스트 명시 재실행: `vitest run src/main/lifecycle src/main/orchestration` → **6 files / 20 tests passed**(상태·recovery·mode-invariance·StallTimer 포함).

## 위생 검토

- 변경/검토 파일에서 키/토큰/이메일/IP 패턴 스캔: 0건.
- **보드 위생 교정(이번 verify)**: INDEX 의 대상커밋이 codex 환경 로컬 해시 `3c737fb`(이 통합 브랜치에서 `git cat-file` 도달 불가) + 리터럴 placeholder `` `HEAD` `` 였음. 통합 브랜치 실 도달 커밋 `d8ec70d`(C1~C4) + `0535be9`(인수 2·6c 보강)로 교정. 과거 PR-A/C3 보고 커밋(`56af4a8`·`3c737fb`)은 codex 환경에 머물러 본 브랜치에 없음 — history 불변, 보드만 실 해시로 정정(0002·0027 위생노트 ① 선례).
- **절차 메모(수용)**: 보강 6 의 C1→C2→C3→C4 단계 커밋 분리 및 PR-A/PR-B 2-PR 분리 출시는 실제로는 2 커밋(`3db6e2b` 구조+recovery, `d8ec70d` 상태정리+uv)으로 통합됐고 중간 verify(PASS-partial)는 생략됐다(plan:299 에서 의식적 수정). 인수 충족·게이트·되돌림 가능성에 영향 없어 PASS 차단 사유 아님. 단 "단계 커밋으로 회귀 국소화" 의도는 일부 희석됨(자기리뷰 참조).

## PHASES.md 정합성

- PASS-final → `docs/PHASES.md` 에 0050 완료 행 승격(커밋 `d8ec70d`+`0535be9`). 형식·커밋 기재 확인.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 인수 2/6(c)의 "FakeSessionRuntime 모드-불변 테스트"를 plan 이 명시했으나, 구현 라운드(Codex)가 인수 3·11 정리에 집중하며 이 테스트를 누락 → "11/11" 자기보고와 실제(10/11)가 어긋났다. plan 의 테스트 4종 체크리스트를 impl 게이트에 더 직접 묶었어야 함.
- **구현 단계**: 커밋 위생(타입·trailer)은 라운드2에서 회복됐으나 보드 대상커밋이 placeholder/유령 해시로 남아 추적성이 깨졌다 — 구현 환경↔통합 브랜치 해시 비동기화의 반복(0010·0027 동일 계열). 구현자가 push 후 실 해시로 보드를 핀했어야 함.
- **검증 단계**: 갭(인수 2·6c)이 비기능 테스트라 사용자 결정에 따라 Claude 가 직접 보강(`0535be9`) 후 PASS. 다만 electron 바이너리 환경 제약으로 send.ts 경로 통합 테스트 2종을 실행하지 못해, StallTimer 외 send.ts 소비 회귀는 단위(timers/lifecycle)로만 간접 검증됨 — 실환경 GUI 회귀(채팅·취소·타임아웃·크래시 복구)는 사람 확인 대기.

## 결론 / 다음 단계

- **상태: PASS (r2, final).** 인수 11/11 충족, 게이트(lint/typecheck/typecheck:test) 0 error·test 542 passed(electron 의존 2파일은 환경 제약, 인수 공백 없음), 레이어 경계 0, 신규 의존성 0.
- INDEX `verify/PASS`, 다음 주체 `—`. PHASES 승격.
- **사람 확인 대기**: ① 실환경 GUI 회귀(첫 prompt cold→live·취소(user_cancelled)·StallTimer 타임아웃 메시지·크래시 후 재진입 dangling 해소) ② uv 제거 후 번들 Python MCP 사용자의 시스템 Python 폴백 ③ electron 게이트(`send.runtime-resilience`/`persist`) 정상 환경 재실행 ④ PR 머지.
