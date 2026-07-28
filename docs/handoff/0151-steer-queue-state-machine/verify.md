# Verify — 0151-steer-queue-state-machine

## 메타

| 항목 | 값 |
|---|---|
| slug | `0151-steer-queue-state-machine` |
| 검증자 | Claude Code |
| 일자 | 2026-07-28 |
| 대상 커밋 | `32a350e` · `2d4480e` · r2 |
| 라운드 | 2 |
| 상태 | **PASS (r2)** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 1 — AC8 "payload 스크럽" 이 과약속(호출자 스냅샷은 큐가 도달 불가) | **타당.** `reserveHeld` 는 `toBatch` 산출을 반환하고 `track()` 이 별도 사본을 보관하므로(`pending-message-queue.ts:189-194,355`), 큐가 지울 수 있는 것은 자기 맵 사본 + 공유 `PendingMessage` 뿐이다. 실제 leak(맵이 base64 를 pin)은 해소된다 | AC8 을 "큐 보유분 스크럽 + 맵 제거" 로 판정. plan 문구가 과했던 것은 설계 단계 미흡으로 자기 리뷰에 기록 |
| 이견 2 — `interrupt` 반환형 변경이 거버넌스 표면 3곳으로 전파 | **타당.** 두 `interrupt` 는 실제로 다른 행위다(SDK 제어 호출 vs 턴 중단 표시) | P2 선조치(`GovernedLiveTurn`)를 AC10 증거로 수용 |
| 선조치 P1 ✅ — 교집합 판정을 순수 함수로 추출(신규 모듈 1개) | **수용.** 설계의 "신규 모듈 0개" 를 어겼으나, AC14 가 요구한 4분기 테스트가 클로저 안에서는 **검증 불가**했다. 순수 판정 함수 1개는 정당한 대가 | AC11·AC14 증거로 채택 |
| 선조치 P2~P7 ✅ | 전건 수용 — 각각 AC 매트릭스 증거에 반영 | — |
| 블로커 — OQ1·OQ2 미결 | **정상.** 제품 의도라 단독 결정 금지 항목 | 아래 "사람 확인 대기" + 파생 이슈 D1·D2 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 배치가 `origin` 을 보유하고 **호출자가 명시**, respawn 회수분은 `turn-open` 재스탬프 | ✅ | `pending-message-queue.ts:26` 타입 · 호출부 3곳이 각각 명시: 게이트 `chat-turn.ts:811`(`'steer'`) · 연속 턴 `:945`(`'turn-open'`) · 턴 프롬프트 `:620`(`'turn-open'`). 재스탬프 `pending-message-queue.ts:319-323` + 회귀 테스트 "takeForRespawn 은 미확정 예약 재전달…"(echo 거부 → model-output 확정) |
| 2 | `state` 1급 필드 3종, `consumed` 불리언 제거 | ✅ | `:34` `BatchState`. `grep -rn "consumed" src/main` → 큐/코디네이터에 잔존 0(변수명 `turnOpenConsumed` 는 코디네이터 로컬 플래그로 무관) |
| 3 | `push(): boolean`, closed=false | ✅ | `streaming-input.ts:30`(계약)·`:77`(구현). 테스트 3건 — "push 는 수용 시 true" · "closed 스트림의 push 는 false" · "closed 이후 push 한 내용은 흘러나오지 않는다" |
| 4 | 예약 롤백 — push false/예외 → held 복귀, createdAt 순서 보존 | ✅ | 큐 `:218-232` · 게이트 `claude-adapt.ts:151-172` · 배선 `chat-turn.ts:818-822`. 테스트 6건(rollback describe) + 게이트 5건(false/true/예외/take-throw/rollback 미주입) |
| 5 | `confirm` 이 origin↔signal.kind 를 대조 (**r2 교정: 비대칭**) | ✅ | `model-output` → turn-open 만(0060 D2 — 응답 진행은 steer 의 소비 증거가 못 된다). `echo` → 양쪽(CLI drain 영수증). 테스트 "첫 모델 출력은 turn-open 배치만 확정한다 — steer 배치는 거부" · "echo 는 turn-open 배치도 확정한다". **r1 은 이를 대칭으로 만들어 CI 회귀를 냈다** — 아래 r2 절 |
| 6 | uuid 있으면 uuid 로만 판정, text 폴백 금지 | ✅ | 큐 `:257-263`(삼항 — uuid 분기와 text 분기가 배타). 테스트 "uuid 가 실려 오면 uuid 로만 판정한다"(불일치+텍스트 일치 → `[]`) · "uuid 부재 replay 만 텍스트 폴백" |
| 7 | 턴 체인 종료 시 orphan 전이 + 로그, 지각 확정 허용 | ✅ | 큐 `:283-294` · 배선 `chat-turn.ts:874-880`(`step === 'break'`) · 로그 `chat.steer.orphaned`(count 만). 테스트 3건(미확정만·멱등·지각 확정) |
| 8 | `dispose` 가 전량 제거 + payload 스크럽, 세션 삭제·종료에서 호출 | ✅ | 큐 `:336-348` · 세션 삭제 `handlers/session.ts:103` ← 루트 주입 `bootstrap.ts:500` · 종료 `bootstrap.ts:419,442`. 테스트 3건. **구현자 이견 1 반영** — 보장 범위는 "큐 보유분" |
| 9 | `freeze()` 이후 enqueue/예약 거부, shutdown 선두 호출 | ✅ | 큐 `:119` · `bootstrap.ts:415`(scheduler·supervisor보다 **앞**). 테스트 3건 — enqueue throw `app_closing` · 예약 undefined · **취소/확정/drain 은 통과**(진행 중 정리 보존) |
| 10 | `InterruptReceipt` 상위 전달, `undefined` ≠ `[]` | ✅ | 포트 `adapters/types.ts` `interrupt(): Promise<InterruptReceipt \| undefined>` · claude 매핑 `claude.ts:478-482`(`!res \|\| !Array.isArray` → `undefined` 보존) · mock `undefined` · 위임 `session-runtime.ts:477-481`. 타입 분리 `contracts/ports.ts` `GovernedLiveTurn` |
| 11 | 우리 uuid 교집합만, 미지 uuid 무시 | ✅ | `interrupt-reconcile.ts` `reconcileInterruptReceipt` · 배선 `chat-turn.ts:769,823-826`. 테스트 6건 — **"모르는 uuid 만 남으면 clear"** 가 0143 무회귀의 기계 증명 |
| 12 | `message.submitted` 로 소유권 가시화, 취소 버튼 제거 | ✅ | `shared/ipc.ts` variant · 발신 `chat-turn.ts:755-760,814,821` + 취소 거부 회신(구 무이벤트 경로) · renderer `chatStore.ts` case + `PendingSteerTurn.tsx` 조건부 렌더 + i18n ko/en. `IPC_CONTRACT.md:35,408` 동시 갱신 |
| 13 | 교차 feature import 0, boundaries 위반 0 | ✅ | `npm run lint` **0 error**. `features/sessions` → `features/chat` 참조 0(영수증은 `TurnRequest.onInterruptReceipt` 구조적 포트, 판정은 루트) · `handlers/session.ts` 는 `SessionDisposeHooks` 로 chat 큐 타입조차 모른다 |
| 14 | AC3~AC11 신규 테스트 | ✅ | queue **32** · streaming-input+claude-adapt **56** · interrupt-reconcile **6**. 전체 1212 pass |
| 15 | 게이트 통과, 신규 의존성 0 | ✅ | 아래 게이트 절. `package.json` diff 0 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 error(warning 1 베이스라인) · typecheck 3/3 · **vitest 148 파일/1216 테스트 전부 pass** · scripts 28/28 · CI gate success |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | **19/19** (r1 15 + r2 4, `파일:라인` 첨부) |
| 레이어 경계 위반 0 | ✅ | — | boundaries 0 |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/IPC_CONTRACT 한국어·표 형식 유지 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경 — 스캔 대상 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | **사람 확인 대기** |
| Open Questions (OQ1·OQ2) | ✖ | ✅ | **결정 완료 (r2)** — 둘 다 (b) 채택 → AC16~19 로 구현 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** — '전달됨' 배지·취소 버튼 소거, 두 테마 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 해당 없음(0건) |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ npm run lint
✖ 1 problem (0 errors, 1 warning)
  └ useTranscriptVirtualizer.ts:22  react-hooks/incompatible-library  ← 0102 이래 베이스라인

$ npm run typecheck          # tsc --noEmit 3분할
typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅   (에러 0)

$ ELECTRON_OVERRIDE_DIST_PATH=<any> ./node_modules/.bin/vitest run
 Test Files  148 passed (148)
      Tests  1216 passed (1216)

$ node --test "scripts/*.test.mjs"
# pass 28  # fail 0
```

**베이스라인 제외 0건 (r2 에서 정정).** r1 은 `chat-turn.continuity.test.ts` 로드 실패를 환경 베이스라인으로 분리 보고했으나 **그 판단이 틀렸고, 그 파일에 실재 회귀가 있었다**(아래 r2 절). `ELECTRON_OVERRIDE_DIST_PATH` 로 electron 경로 해석을 우회하면 전 스위트가 로컬에서 돌고, DB 스위트는 `npm rebuild better-sqlite3`(Node ABI)로 green 이다. CI `gate`(windows-latest) **success** 로 독립 확증됐다.

## 위생 검토 (AGENTS.md 변경 시)

- `AGENTS.md` **무변경** — 위생 스캔 대상 없음.
- 신규 로그 3종(`chat.steer.orphaned` · `chat.interrupt.receipt-absent` · `chat.interrupt.still-queued` · `engine.steer.submit-rejected`)은 **카운트·sessionId·boolean 만** 싣고 메시지 본문·첨부 경로·uuid 목록을 기록하지 않는다(`arch/backend/observability.md` prod 카탈로그 원칙). 키/토큰/이메일/IP 패턴 혼입 0.
- pending payload 를 SQLite·파일·localStorage 에 쓰는 경로 추가 0 — 비영속 정책 유지(신규 마이그레이션 0건, `chatStore` persist 미들웨어 여전히 없음).

## PHASES.md 정합성

- `docs/PHASES.md` Phase 4 표에 0151 행 승격(범위·상태·커밋 기재). `INDEX.md` `verify/PASS`, 다음 주체 `—`.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: (a) AC8 의 스크럽 보장 범위를 실제 객체 소유권을 따져보지 않고 과하게 적었다(구현자 이견 1이 교정). (b) `LiveTurn.interrupt()` 반환형 변경의 **타입 파급**(`RuntimeLiveTurn` 상속 → 거버넌스 표면 3곳)을 예측하지 못해 구현 턴이 `GovernedLiveTurn` 을 즉석 설계해야 했다 — 포트 상속 그래프를 먼저 그렸어야 했다. (c) AC11 을 클로저 배선으로 적어놓고 AC14 에서 그 4분기 테스트를 요구해 **자가당착**이었다(P1이 교정).
- **구현 단계**: 큰 미흡 없음. 다만 `reserveHeld`/`reserveItem` 개명으로 테스트 4파일이 함께 바뀌어 diff 가 커졌다 — 계약 변화를 이름이 말하게 한다는 목적은 달성했으나 리뷰 부담은 실재한다.
- **검증 단계**: **AC12 의 렌더러 부분이 기계 검증되지 않았다.** `chatStore` 의 `message.submitted` reducer 와 `PendingSteerTurn` 조건부 렌더는 순수 로직인데 테스트를 붙이지 않았다(0150 verify 의 D4 와 같은 종류의 누락 — 반복하고 있다). 파생 이슈 D3. 또한 `orphanUnconfirmed` 호출 지점이 `step === 'break'` **한 곳뿐**이라, 턴 루프를 타지 않고 끝나는 경로(에러 throw 등)에서는 orphan 전이가 일어나지 않는다 — 기능 피해는 없으나(takeForRespawn 이 submitted 도 회수) 관측 공백이다. D4.

## [FAIL 시] 미충족 요구사항

해당 없음 (PASS).

## r2 추가 검증 (CI 회귀 + OQ 결정 구현)

### 자기 검증 실패 1건 — r1 verify 가 틀렸다

r1 verify 는 `chat-turn.continuity.test.ts` 로드 실패를 *"알려진 환경 베이스라인, 변경 무관"* 으로 분리 보고했다. **오판이었다.** CI(windows-latest·egress 열림)가 같은 파일에서 **실재 회귀 2건**을 잡았다 — AC5 의 대칭 origin 검증이 모델 출력 없는 턴의 사용자 메시지 커밋을 막고 있었다.

두 가지를 잘못했다:
1. **"변경 무관" 이라 단정할 근거가 없었다.** 나는 바로 그 파일이 호출하는 큐 API(`flushItem`→`reserveItem`)를 바꿨다. 파일이 열리지 않는다면 "무관" 이 아니라 **"판정 불가"** 라고 적었어야 한다.
2. **실행 수단을 찾지 않았다.** `ELECTRON_OVERRIDE_DIST_PATH` 로 electron 경로 해석을 우회하면 전 스위트가 로컬에서 돈다(`electron/index.js` 가 이 env 를 보고 존재 검사 없이 경로를 반환). 베이스라인은 **회피 가능**했고, 그걸 확인하기 전에 베이스라인으로 분류한 것이 잘못이다.

→ 교훈을 `app/AGENTS.md` 제약 환경 절에 반영할 후보로 남긴다(D5).

### r2 요구사항 매트릭스 (AC16~19)

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 16 | Stop 잔여 능동 고지 + 통지 해제 | ✅ | `chat.residual` variant(`shared/ipc.ts`) · 발신 `chat-turn.ts` `reconcileInterrupt`(survived → set+emit, clear → delete) · `Composer.tsx` Notice + 액션 버튼 · `chatStore` `residualSteer`/`useChatResidualSteer` · i18n ko/en |
| 17 | `discardSession` 이 잔여를 실제로 없앤다 | ✅ | `CHANNELS.chatDiscardSession` + `DiscardSessionSchema` + 핸들러(abort → `discardRuntime` → `discardSubmitted` → `message.cancelled` + `residual{0}`) · `RuntimePool.close` · `Supervisor.discardRuntime` · preload/`shared/api/ipc.ts` 노출. UI 문구가 백그라운드 종료를 명시 |
| 18 | orphaned 자동 재주입 금지, draft 복원 | ✅ | `discardOrphaned` + 턴 체인 종료 배선. renderer 는 기존 `message.cancelled` 경로가 버블 제거 + draft 복원을 이미 수행(중복 구현 0) |
| 19 | 폐기분 미부활 | ✅ | 테스트 — "폐기 후 takeForRespawn 이 재주입하지 않는다" · "지각 echo 로 되살아나지 않는다" · 확정분/미지 uuid 불간섭 |

`IPC_CONTRACT.md` 갱신: 채널 **72→73**(chat 5→6), 이벤트 variant +1. `docs/AGENTS.md` 인벤토리 수치 동기화.

### r2 게이트

```
lint      0 error (warning 1 = 0102 베이스라인)
typecheck 3/3
vitest    148 files / 1216 tests — 전부 pass, 베이스라인 제외 0건
          (ELECTRON_OVERRIDE_DIST_PATH 로 종전 로드 실패 파일 포함)
scripts   28/28
CI gate   success (windows-latest) @ 2d4480e
```

## 결론 / 다음 단계

**PASS (r2) — 인수 19/19 충족.** r1 의 15건 + OQ 결정 구현 4건. CI green.

### 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | ~~OQ1 Stop 처분 정책~~ | plan OQ | **해결 (r2)** — 사용자 결정 (b): 능동 고지 + "세션 전체 중단" 제시 | closed |
| D2 | ~~OQ2 orphaned 처리~~ | plan OQ | **해결 (r2)** — 사용자 결정 (b): 폐기 후 draft 복원 | closed |
| D3 | renderer reducer(`message.submitted`·`chat.residual`)와 조건부 렌더가 기계 검증 없음 | verify 자기 리뷰 | `chatStore` reducer 테스트 추가 | open |
| D4 | `orphanUnconfirmed`/`discardOrphaned` 가 `step === 'break'` 경로에서만 — 예외 종료 경로는 관측·복원 공백 | verify 자기 리뷰 | `finally` 이동 검토 | open |
| D5 | `app/AGENTS.md` 제약 환경 절에 `ELECTRON_OVERRIDE_DIST_PATH` 우회를 명시해 "로드 실패=베이스라인" 오분류를 막는다 | r2 자기 검증 실패 | AGENTS.md 보강 | open |

### 사람 확인 대기

1. **UI 시각 검증** — (a) 예약 steer 버블의 취소 버튼 소거 + "전달됨" (b) Stop 잔여 시 컴포저 Notice + "세션 전체 중단" 버튼, 두 테마.
2. **실기** — 응답 중 steer → Stop → 잔여 통지가 뜨는가 / 안 눌렀을 때 백그라운드 완료 통지는 **여전히 도착하는가**(0143 무회귀) / 눌렀을 때 실제로 멈추는가.
3. **PR #292 머지 승인.**
