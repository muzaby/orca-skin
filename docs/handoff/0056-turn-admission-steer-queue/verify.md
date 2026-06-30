# Verify — 0056-turn-admission-steer-queue

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §3.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0056-turn-admission-steer-queue` |
| 검증자 | Claude Code |
| 일자 | 2026-06-30 |
| 대상 커밋 | `84354a3` (본 브랜치 실 커밋 — 위생 노트 ① 참조; INDEX/impl 기재 `d76d153` 은 Codex env) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 §동의: 0056 핵심은 인라인 중복가드를 L1 결정+L3 enact 로 분리, 0051 §A 가로축·main DAG 부합 | 타당 | 매트릭스 AC1·4 에 반영(레이어 분리 확인) |
| 보강 #1: `AdmissionDecision` 을 문자열 대신 discriminated union(`{kind}`)으로 — 후속 메타데이터 확장 시 breaking 회피 | 타당(개선) | AC3 충족. plan §설계도 union 의도였음(설계와 일치, 후속 exhaustive 확장 용이) |
| 보강 #2: L1 policy 는 `reason:'duplicate-turn'` 만 반환, `makeClassifiedError` 생성은 L3 enactment 에 유지 | 타당(개선) | AC2·4 충족. lifecycle 이 renderer-facing error shape 에 결합되지 않음 — 레이어 책임 보존 |
| 보강 #3: resume busy / 새-채팅 pending busy 를 `AdmissionTarget` (`existing-session`/`new-session-slot`) 으로 구분 | 타당(개선) | AC1 충족. plan 의 flat `{sessionId,owner,hasInflight,isNewSession}` 보다 견고하게 이중케이스 보존 — 인수 의도(이중케이스 보존) 정신 충족 |
| 우려 #4: queue/steer 예약 seam dead seam 위험 → 기본정책 미반환 테스트 + L3 주석/fallback | 타당 | AC3 충족. defensive fallback 은 reject 등가(실제 queue/steer 동작 0) + 후속 포인터 주석 → "enactment 0" 정신 보존. 미enact 테스트가 불변식 락 |

→ 구현자 선조치 4건 전부 **✅ 선조치 가능** 범주(구현 세부·견고화)이며 인수 기준 의도를 벗어나지 않음. ⚠️(사용자 결정 필요) 항목 없음 → 파생 이슈 이관 없음.

## 요구사항 충족 매트릭스

> plan §인수 기준 8개 1:1 대조. 증거 = `파일:라인` + 게이트 출력.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `AdmissionController` 1급화(L1) — busy 시 정책 질의, inflight 없으면 `accept`(정책 미질의). 이중케이스 보존 | ✅ | `lifecycle/admission-controller.ts:18-21` (`if (!ctx.hasInflight) return {kind:'accept'}` → 정책 질의). 이중케이스 = `AdmissionTarget` union(`admission-policy.ts:4-6`, 구현자 #3). 테스트 `admission-controller.test.ts:9-23` 가 `policy.decide` 미호출 락 |
| 2 | 기본 `RejectDuplicatePolicy` = `send.ts:163-179` 1:1 재현. 인라인 가드 제거→controller 위임(이중게이트 0) | ✅ | reject enact `send.ts` `enactAdmissionDecision` 가 동일 `provider_connection_error`·동일 문구("이미 진행 중인 턴이 있습니다…")·`retryable:true`·동일 이중케이스(sessionId 유무) 재현(diff 확인). busy 판정 `supervisor.hasSession/hasPending` 보존(`createAdmissionContext`). 인라인 가드 212-228줄 삭제→`admission.admit` 위임 |
| 3 | union `accept\|reject\|queue\|steer` — queue/steer 예약 seam(enactment 0) + 포인터 주석 | ✅ | `admission-policy.ts:13-18` (union + 예약 주석). 기본정책 미반환 락 `admission-controller.test.ts:48-60`. `send.ts` enact switch 의 queue/steer arm = reject 등가 defensive fallback + 후속 포인터 주석(실제 재디스패치/스트림주입 enactment 0). 0054→0055 빈-union seam 선례 동형 |
| 4 | enactment 레이어 분리(L1 결정·L3 enact) | ✅ | L1 `AdmissionController.admit` 는 `AdmissionDecision` 순수반환(renderer/sendChatEvent 미접촉, `admission-controller.ts` 전체). L3 `send.ts` `enactAdmissionDecision` 가 reject→`sendChatEvent(error)` enact. L1 에 forward/재디스패치 클로저 0 |
| 5 | cap 축 미접촉 — 0055 `RuntimeCapPolicy` 불변 | ✅ | 커밋 `84354a3` stat 에 `supervisor.ts`/`concurrency.ts` 부재(변경 7파일=admission 3 + send/router + plan/INDEX). cap default=무제한 → 현 동작 accept 보존 |
| 6 | 무회귀 게이트 + 신규 `admission-controller.test.ts` green | ✅ | lint/typecheck/test 통과. test **592/592 passed**(better-sqlite3 Node ABI 재빌드 후), admission 테스트 4/4(아래 게이트 결과). 이벤트·DB·UX 0 변경 |
| 7 | 레이어 경계·순환 0(L1 admission, L3 배선) | ✅ | `npm run lint`(eslint-plugin-boundaries + import/no-cycle 포함) 무오류. admission = L1 `lifecycle/`, send/router = L3 `ipc/` → 하향 의존만 |
| 8 | IPC 무변경 — 신규 채널/NormalizedEvent variant 0 | ✅ | 커밋 diff 에 `shared/ipc.ts`·`shared/protocol.ts`·`IPC_CONTRACT.md` 부재. 채널 40 유지 |

**충족: 8/8.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 통과(592/592) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 충족 |
| 레이어 경계 위반 0 | ✅ | — | lint 무오류 |
| 문서 형식/링크/한국어 | ✅ | — | 정합 |
| AGENTS.md 위생 스캔 | ✅ | ✅ | AGENTS.md 미변경(스캔 N/A) |
| 제품 의도 부합(steer 의도 default) | ✖ 보조 | ✅ 결정 | OQ 사용자 결정 완료(steer·framework-only·accept inert) |
| UI/UX 시각 검증 | ✖ | ✅ | framework-only 라 UX 0 변경 — 후속 steer/queue 도입 시 시각검증 이월 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 미요청(이번 PR 생성 안 함) |

**사람 확인 대기**: ① 후속 steer/queue 메커니즘 도입 시 중복턴 UX(가로채기/대기/취소·중복 권한카드) 시각검증 ② 실환경 중복-send reject 토스트 무회귀 실기.

## 게이트 재실행 결과

```
$ cd app && npm run lint
> eslint --cache --fix ./src        # 무오류 (boundaries·no-cycle 0)

$ npm run typecheck
> typecheck:node (tsc -p tsconfig.node.json)   # 무오류
> typecheck:web  (tsc -p tsconfig.web.json)    # 무오류
> typecheck:test (tsc -p tsconfig.test.json)   # 무오류

$ npm test   # 초회 better-sqlite3 ABI mismatch (Node 137 ↔ Electron 140, 0019 dual-ABI 클래스)
$ npm rebuild better-sqlite3 && npm test
 Test Files  2 failed | 80 passed (82)
      Tests  592 passed (592)

$ npx vitest run src/main/lifecycle/admission-controller.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

- **테스트 실패 0건** (592/592). 실패한 2 *suite* (`ipc/chat/persist.test.ts`·`ipc/chat/send.runtime-resilience.test.ts`)는 **electron 바이너리 미설치**(프록시 차단 — postinstall `ELECTRON_SKIP_BINARY_DOWNLOAD`)로 *import-time* 실패라 0 tests 카운트. 0056 변경과 무관(0050~0055 동일 계열 환경제약). 정상환경(electron 설치)에서 impl 보고 601/601 과 정합(차이 9 = 두 electron-의존 suite 분).
- 신규 `admission-controller.test.ts` 4 케이스(accept-미질의·existing reject·new-slot reject·queue/steer 미반환) 전부 green.

## 위생 검토

- **대상 커밋 위생 노트 ①**: INDEX/impl 보고 기재 대상커밋 `d76d153`(Codex 분리환경 커밋) ↔ 본 검증 브랜치 실 커밋 `84354a3`. 0002·0010·0020·0021·0024·0027·0033·0055 와 동일 패턴(분리환경 cherry-pick 해시 차). 검증은 실 커밋 `84354a3` 코드 기준.
- **위생 노트 ②**: impl 커밋 `84354a3` 본문에 리터럴 `\n` 가 삽입되어(`…landed.\nThis…\n\nAgent: codex\n…`) `git interpret-trailers --parse` 가 **빈 결과**(trailer 미파싱). handoff 0027 위생노트 ② 와 동형. history-only(푸시된 커밋이라 미수정), 본 검증 커밋은 trailer 블록 빈줄 없이 규약 준수로 해소.
- AGENTS.md 변경 없음 → 키/토큰/이메일/IP 스캔 N/A.

## PHASES.md 정합성

- 0055 verify 비고가 "PHASES 승격 보류(lifecycle P1 시리즈 0052~0055 일괄·0056 후)"로 승격을 지연 → 0056 PASS 시점에 **0052~0056 lifecycle P1 시리즈 일괄 승격**을 함께 수행(본 검증 커밋에 동반).

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan 의 `AdmissionContext` 를 flat `{sessionId,owner,hasInflight,isNewSession}` 로 적었으나 구현은 discriminated `AdmissionTarget` union 으로 더 견고화. 설계가 이중케이스 타입 표현을 union 으로 못박았으면 구현자 보강(#3)이 불필요했을 것 — 다만 인수 의도(이중케이스 보존)는 충족.
- **구현 단계**: AC3 "enactment 경로도 없다"를 글자 그대로 보면 enact switch 의 queue/steer arm 추가가 미세 마찰. 구현자는 exhaustive switch 안전망(reject 등가 fallback + 포인터 주석)으로 해석 — 실제 동작 0 이라 정신 충족이나, plan 이 "switch 는 accept/reject 만 + default throw" 같은 enactment 형태를 명시했으면 무마찰이었음. 후속 steer/queue 핸드오프가 이 arm 을 실제 enactment 로 채울 때 미반환 테스트를 함께 갱신해야 함(현재 회귀 테스트가 fallback 동작은 직접 락하지 않음).
- **검증 단계**: electron 미설치로 `send.runtime-resilience` suite 를 실행 못 해 admission 위임이 런타임 통합 경로(실제 `chat:send` 핸들러)에서 도는지는 단위 테스트(순수 결정기) + 정적 diff 로만 확인. 실환경 중복-send reject 실기는 사람 확인 대기로 분리.

## 결론 / 다음 단계

- **상태: PASS** (인수 8/8, 게이트 3종 통과, 레이어 경계·순환 0, 신규 의존성 0, IPC 무변경).
- INDEX 111행 `verify/PASS`, 다음주체 `—`. PHASES 0052~0056 lifecycle P1 시리즈 일괄 승격.
- **후속(사용자 결정 기록됨, 별 핸드오프)**: steer 의도 default → streaming-input 포트(`injectMessage`) + cross-turn 입력 스트림 선행 머지 후 default 전환. queue 메커니즘(0040 패턴 + 컴포저 UX). cap-over-capacity reject/queue(0055 §A P1 경계). `orchestration/`→supervision 리네임(Future).
- PR 은 사용자 미요청 → 생성 안 함.
