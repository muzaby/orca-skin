# Verify — 0273-opencode-command-stream-errors

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0273-opencode-command-stream-errors` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `eeb0341..a1a1f01`(r1) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | V1 `eeb0341` |
| V mode / 유효 V | Baseline V / V1 (AR1/IT1·R6/AT6은 이후 0274가 SUPERSEDED) |
| 라운드 | 1 (verify 1회째) |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**PASS — 4개 pair와 §10 8자리가 HEAD 위치(0274가 옮긴 공유 context 포함)에서 성립한다.** 실행용 30초 명령 조회·준비 실패 미제출·SSE 원인 분류·명시 재시도 고장 6건이 모두 잡혔다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `a1a1f01`의 `plan.md` 변경: 메타 상태와 `[구현자 기입]` 채움만.
- 기준선 diff 성립: 예 — V1 `eeb0341`이 구현과 분리된 설계 커밋.
- 채점 기준: AC1–6·VP-01–04·§10 8자리(EP01 4 · EP02 4).
- HEAD 관점: 0274가 command 준비를 `session-context.ts`의 directory 공유 flight로, SSE를 server별 global stream으로 옮겼다(AR1→AR2 SUPERSEDED 명시). 0273 자리의 현재 위치는 아래 §4가 HEAD 좌표로 적는다 — 30초 실행 예산(`session-context.ts` `timeoutMs: 30_000`), 준비 오류 변환(`channel.ts`), SSE callback(`session-context.ts` `onSseError`), 분류(`errors.ts`).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V | 유효 | R1–6·SD1·AR1·MD1 NEW ↔ VP-01–04 REQUIRED |
| §10 자리 목록 | 유효 | EP01·EP02 각 4자리를 역할로 고정, 검색 명령 기록 |
| 선택 적대 증거 | 유효 | 없음 — 직접 행동 출력 |
| oracle 좌표 | 유효 | P 6개·E 1개 HEAD 실재(`adapter.persistent.test.ts`·`errors.test.ts`) |
| 운영 gate | 유효 | Vitest·lint·typecheck·build·boundary·inventory·budgets |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D-01 | 메뉴 조회 2.5초, 실행 전 조회 30초 + caller 취소 | menu: `native-resources` 기본값 · 실행: `ServerContext.commands` `timeoutMs: 30_000` + caller signal |
| D-02 | 명령 조회 성공 전 수락 상태·모델 요청 없음 | channel이 slash lookup 성공 후 `responseOpen` |
| D-03 | SSE HTTP·timeout·EOF·일반 실패를 고정 문장으로 구분 | `errors.ts` `openCodePreparationError` 분기 |
| D-04 | 자동 재제출 없음 | 실패 채널 종료 후 사용자 입력만 새 제출 |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 실행 전 조회가 메뉴 2.5초에 묶임 | ✅ | `session-context.ts:215` `timeoutMs: 30_000`(T1 잡음) |
| 준비 실패 후 수락·제출 | ✅ | 준비 오류는 `responseOpen` 전에 throw(`channel.ts:141`, T5 잡음) |
| SSE 원인 소실 | ✅ | `onSseError` 보관(`session-context.ts:328`, T7 잡음) → `errors.ts` 분류(T2–T4 잡음) |
| 비밀 노출 | ✅ | HTTP 상태는 숫자 allowlist(`errors.ts:25`) |
| 자동 재제출 | ✅ | 실패 채널 종료 후 명시 입력만 새 제출(P3 pass) |
| 사용자 환경 원인 | 미확정(보고 그대로) | 구현 보고가 원격 SSE 실패 원인 미확정을 명시 — 범위 밖 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| 자리 이동 | 관찰 | EP01(1)·EP02(1)의 운반 위치가 0274에서 `session-context.ts`로 이동(AR1→AR2). 이동 후 위치를 §4에서 직접 고장 냈다 |
| test-only symbol | 없음 | `openCodePreparationError`는 channel·context production 호출 |

## 4. 고장 내 보기

- 등록 변이 0. §10 8자리의 HEAD 위치에 재량 고장. 0274 공유 실행(같은 ID).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| T1 | `opencode/v1/session-context.ts:215` | 다른 값 | 실행용 명령 조회 30초 → 2.5초 | 잡음 | `adapter.persistent.test: waits beyond the menu deadline for native command dispatch without submitting twice` | EP01(1)(2) · AC1 |
| T2 | `opencode/v1/errors.ts:19` | 고정값 | timeout 분류 → `false` | 잡음 | `adapter.persistent.test: fails command preparation safely before acceptance…`·`errors.test: sanitizes %s preparation errors` | EP02(4) · AC3 |
| T3 | 같은 파일 `:25` | 빈 값 | HTTP 상태 추출 → `undefined` | 잡음 | `adapter.persistent.test: retries explicitly after an SDK SSE HTTP failure…` | EP02(4) · AC3 |
| T4 | 같은 파일 `:31` | 고정값 | EOF 분류 → `false` | 잡음 | `adapter.persistent.test: reports an initial empty SSE failure before submission` | EP02(4) · AC3 |
| T5 | `opencode/v1/channel.ts:141` | 제거 | 준비 실패의 commands 단계 오류 throw 삭제 | 잡음 | `adapter.persistent.test: fails command preparation safely before acceptance…` | EP01(3)(4) · AC2 |
| T7 | `opencode/v1/session-context.ts:328` | 빈 값 | `onSseError` 보관 삭제 | 잡음 | `adapter.persistent.test: preserves a safe stream failure after the initial connection…` | EP02(1)(2)(3) · AC3 |

- 검산: 시도 6 = 잡음 6 · 못 잡음 0 · 동치 0. caller signal 결합(EP01(2))은 P2 `cancels command preparation at the SDK request…`가 실제 Request abort를 직접 관측(좌표 실재·pass).

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP-04 | UT | REQUIRED | PASS | T2·T3·T4 잡음, `errors.test` 분류 |
| VP-03 | IT | REQUIRED(→0274 AR2 이관) | PASS | T1·T7 잡음 — HEAD 위치(공유 context)에서 SDK signal·callback 경로 |
| VP-02 | ST | REQUIRED | PASS | T5 잡음, P2·P3 pass |
| VP-01 | AT | REQUIRED | PASS | T1–T5·T7 잡음 |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 2.5초 넘는 명령 1회 제출 | ✅ | T1 잡음 |
| AC2 timeout·close 미제출·Request 취소 | ✅ | T5 잡음, P2 pass |
| AC3 SSE 원인 구분·비밀 없음 | ✅ | T2·T3·T4·T7 잡음 |
| AC4 명시 재시도만 새 제출 | ✅ | T3(`retries explicitly…`) 잡음 |
| AC5 메뉴 조회·기존 slash 회귀 | ✅ | `native-resources.test`·persistent 회귀 green |
| AC6 1.17.19 조사·미확정 구분(→0274 AC12 이관) | ✅(보고) | `evidence/compatibility-result.json` 존재, 미확정 범위 명시 |

- 합계 재측정: `✅ 6 · ❌ 0 = 6`. 자기보고 `Criteria-Met: 6/6`(`a1a1f01`) 일치.

### §10 강제 지점 분모

| EP | 결과 |
|---|---|
| EP01 (4) budget·signal 결합·준비 오류 변환·수락 순서 | 4/4 PASS (T1·T5, P2) |
| EP02 (4) callback·초기 판정·후속 판정·분류 | 4/4 PASS (T2–T4·T7) |

- 8/8. HEAD 위치 재열거: `rg -n 'openCodeNativeCommands|onSseError|openCodePreparationError|timeoutMs: 30_000' app/src/main/adapters/opencode/v1`의 비테스트 운반 자리가 위 8자리와 대응. 목록 밖 발견 없음.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error · main 465파일 중 15 red 전부 Windows 전용 fixture · Windows CI #853 green.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 사용자 원격 환경의 두 번째 SSE 실패 원인 | 원인 분류·안전 문장 | 해당 환경 로그 수집 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → PASS 행 archive 이동.
- 대상 커밋: `eeb0341`·`a1a1f01` `git cat-file -t` = commit. `a1a1f01` trailer 5키 파싱.
- `[구현자 기입]`은 6개 소절 — "설계 리뷰" 필드가 없고 Product/UX와 잠재 문제가 한 표로 합쳐졌다(N1).

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| N1 | `[구현자 기입]` 7필드 중 설계 리뷰 누락·두 필드 병합 | repository operation | NON_BLOCKING | 이후 구현 턴은 7필드 유지 |

## 14. Review Signals

- 이전 라운드: 첫 verify, 반복 증상 없음.
- 사용자 결정 변경: R6/AT6 → 0274 R12/AT12, AR1 → 0274 AR2(최신 handoff 기준으로 HEAD 위치 채점).
- 반복 환경 한계: 실제 CLI·원격 환경 로그 없음.

## 15. 결론

- 상태: **PASS** — verify 1회째. pair PASS 4/4, PLAN_GAP 없음, AC ✅6/6.
- 남은 사람 확인: 사용자 환경의 원격 SSE 실패 원인(구현 범위 밖, 보고 유지).
