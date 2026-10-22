# Verify — 0275-opencode-shared-instances

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0275-opencode-shared-instances` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `79ccc64..5e9ab52`(r1) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | ΔV5 `a83b6f5` · ΔV6 `79ccc64` |
| V mode / 유효 V | Delta V / 0273 V1 + 0274 ΔV2~4 + 0275 ΔV5~6 |
| 라운드 | 1 (verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — §10 23자리 중 1자리(EP08 context 예약)에서 심은 고장이 green이고, 그 자리의 보고 좌표는 존재하지 않는다.** profile 공유·directory ref·native 완료 대기·실패 retire·소비처 반납은 잠겼다. 0274에서 이관받은 warm 거절 fence(E11, VP09)도 미잠금이다. 0273·0268에서 이관받은 계약은 성립한다(§0-1).

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `5e9ab52`의 `plan.md` 변경: 메타 상태 1행(`READY`→`IMPL_DONE`)과 `[구현자 기입]` 채움. `-` 줄은 메타와 `구현 전.` 자리표시자뿐.
- 기준선 diff 성립: 예 — ΔV5 `a83b6f5`·ΔV6 `79ccc64`가 구현과 분리된 설계 커밋.
- Decision: 0274 D10 → D13 SUPERSEDED는 사용자 승인("구현하라") 인용. 구현자 변경 없음.
- 채점 기준: 유효 AC20(0274 승계 11 + AC13–21), pair 9(VP01·02·04·05·09 REGRESSION, VP10–13 REQUIRED), §10 고정 23자리.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V·상속 | 유효 | 기준 0274 유효 V `7b6111f6`, SUPERSEDED SD2/AR2/MD2 → SD3/AR3/MD4 이관과 VP06~08 AC의 VP11~13 이관 명시 |
| NEW ↔ REQUIRED / 영향 INHERITED ↔ REGRESSION | 유효 | R13–21·SD3·AR3·MD4 ↔ VP10–13, 0273/0274 VP01·02·04·05·09 REGRESSION |
| §10 자리 목록 | 유효(관찰 1) | 23자리를 역할로 고정. 검색 범위의 `implementation.ts`는 `v1/`에 없고 `adapters/opencode/implementation.ts`(retire 포트 2줄)다 — 경로 표기 오차, 자리는 EP07 retire generation에 포함 |
| 선택 적대 증거 | 유효 | 없음 — native Request·frame·signal·child 종료 직접 단언 |
| 운영 gate | 유효 | typecheck·lint·관련 Vitest·Electron DB·build·inventory |

- root PLAN_GAP: 없음.

### 0-1. 이전 handoff에서 이관 받은 책임 (사용자 결정 2026-10-22)

구현이 옛 plan과 갈라진 항목 중 이 plan이 계약을 뒤집은 것은 이 verify가 판정한다. 관측은 모두 같은 HEAD `32b43cc`이며 고장 이력 원문은 각 verify §4다.

| 출처 항목 | 뒤집은 요소(이 plan 또는 경유 handoff) | 이 verify 판정 | 근거 |
|---|---|---|---|
| [0274](../0274-opencode-desktop-startup/verify.md#0-1-최신-handoff-이관--plan_gap-사용자-결정-2026-10-22) D10 cwd 서버 격리(AC9·AC11 해당 부분) | Decision `0274 D10 → SUPERSEDED → D13` | AC13 ✅ | L9·L11 잡음 |
| 0274 VP06–08(SD2/AR2/MD2) | `SUPERSEDED → SD3/AR3/MD4`, AC는 VP11–13 | VP11 PASS · VP12 PAIR_FAIL(L15) · VP13 PASS | §5 |
| 0274 §10 EP03–06 23자리 | §10 "이전 EP03~06 자리의 의무는 … 이관" | 22자리 PASS — 0274 E1–E10 잡음 | 0274 §4 |
| 0274 D1 · E11 warm 거절 fence(EP06·AC11 fence 부분) | 같은 §10 이관 + `0274 MD3/UT3 → VP09 REGRESSION` | **PAIR_FAIL** — VP09 root(D2) | 0274 E11 못 잡음 |
| [0273](../0273-opencode-command-stream-errors/verify.md) VP-03(AR1/IT1)·§10 EP01·02 8자리 | 0274 `AR1→AR2`·EP01/02→EP03–05, 이 plan `AR2→AR3`·EP03–06→EP07–10 | PASS — VP12의 SDK signal·callback edge | 0273 T1–T5·T7 잡음, P2 pass |
| [0268](../0268-opencode-runtime-composer/verify.md) D2 서버 참조 소유권(AC1 공유 부분·EP1 서버 9자리·VP1·VP6·VP8 서버 해제 edge) | D13 공유 key `cwd → profile`, D14·D15·D20 마지막 ref 정리 절차 재정의 | PASS — AC13·AC14·AC17 ✅ | L1·L9·L12·L13 잡음 |

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D13·D19 | 호환 profile은 cwd가 달라도 server 공유, 상대 경로 env는 요청 cwd 기준 절대화(XDG는 보존·격리) | `server-profile.ts` profile 정규화 → `server.ts` profile key·`nativeWorkingDirectory()` host cwd |
| D14 | lease 단위 directory ref, idle·탭 전환으로 해제 안 함 | `instance-lifecycle.ts` refs, `session-context.ts` `acquire`의 `owned.references++` |
| D15 | 마지막 ref는 dispose RPC + matching `server.instance.disposed` 대기 | `instance-lifecycle` closing actor(30s 예산) |
| D16 | disposing 중 재획득은 완료 후 새 scope | closing barrier `await current.closing; continue` |
| D17 | 정리 실패 → retire(새 획득만 분리), B 유지 | `deps.retire()` → server map 제거, owned 집합 유지 |
| D18 | 미사용 lease는 dispose로 bootstrap 안 함 | `state.touched` 검사 |
| D20 | 일반 해제는 정리 후 반환, 앱 종료는 강제 close fallback | `adapter.ts`/`channel.ts` finally `await release()` |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 정리 실패가 B를 죽이는가 | ✅ | retire는 pool map에서만 제거하고 owned entry는 별도 집합으로 종료 시 회수(구현자 #1, N3·N9 좌표 실재) |
| HTTP ack만으로 반환 | ✅ | ack와 matching event 둘 다 대기(N11 실재) |
| 늦은 결과 오염 | ✅ | scope abort + identity WeakMap fence(C8·N12 실재) |
| 앱 종료 후 획득 | ✅ | `OpenCodeSessionContexts.closed` fence(`session-context.ts:407`) |
| finally에서 오류가 정상 결과를 덮는가 | ✅ | 정리 오류는 `reportError` 안전 보고 후 raw lease 반환 |
| 사용자 지연 개선율 | 미측정 | 구현 보고가 "실제 환경 개선율 미측정·directory별 plugin/MCP 비용 유지"로 명시 — 범위 밖 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| 죽은 oracle 좌표 | **발견** | 구현 보고 N6 `adapter.instances.test.ts:reserves the sole context during last-owner cleanup and rejects late direct SDK requests`는 `5e9ab52`·HEAD 어디에도 없다(`git grep` 0건). EP08 "context acquire 예약"의 유일한 좌표였다(§4 L15) |
| test-only symbol | 없음 | `InstanceLifecycle`·`serverProfile`·`OpenCodeSessionContexts.acquire`는 adapter/server production 경로에서 호출 |
| 형제 정책 비대칭 | 없음 | adapter의 complete/recover/history와 channel close가 모두 `await release()`(`adapter.ts:160·179`·`channel.ts:409`) |

## 4. 고장 내 보기

- 등록 변이 0("직접 행동 oracle"). §10 23자리 중 재량 고장. 직전 이력 없음(첫 verify).
- 실행: Linux `src/main/adapters/opencode src/main/app src/main/features/sessions`(147파일, 기준선 7 red = Windows 전용) + Windows 전용 `adapter.instances.test.ts`·`adapter.test.ts`를 검증자 win32 shim으로(`…w`). shim은 마지막 단언의 `homedir()` 구분자를 보정한 뒤 기준선 25/25 green이고, 보정 전 실행의 `…w` 판정은 그 기준선 실패 1건을 뺀 차집합으로 다시 셌다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| L1 | `opencode/v1/instance-lifecycle.ts:79` | 고정값 | 남은 ref가 있어도 정리 진행 | 잡음 | `adapter.startup.test: reuses draft preparation…` 외 14건 | EP08 refs · AC14 |
| L2 | 같은 파일 `:81` | 제거 | 미사용(touched=false) 조건 삭제 | 잡음 | `adapter.instances.test: sends default POST directory and workspace…bootstrapping unused leases`·`instance-lifecycle.test: bounds completion…` | EP08 touched · AC17 |
| L3 | 같은 파일 `:100` | 제거 | matching disposed event 대기 삭제 | 잡음 | `adapter.instances.test: awaits directory disposal in the %s consumer finally…` | EP09 completion · AC15 |
| L4 | 같은 파일 `:57` | 제거 | closing 재진입 barrier 삭제 | 잡음 | `instance-lifecycle.test: bounds %s and retires new acquisitions…` | EP09 barrier · AC16 |
| L5 | 같은 파일 `:104` | 제거 | 실패 시 server retire 삭제 | 잡음 | 같음 | EP09 failure · AC19 |
| L6 | 같은 파일 `:91` | 다른 값 | 정리 예산 30초 → 300초 | 잡음 | 같음 | EP09 budget · AC19 |
| L7 | 같은 파일 `:125` | 제거 | 외부 disposed의 completion 해제 삭제 | 잡음 | `adapter.instances.test: awaits directory disposal…` 외 63건 | EP09 completion |
| L8 | 같은 파일 `:136` | 제거 | close 시 각 entry controller abort 삭제 | 동치 | — 확인 실행: Linux·보정 shim green. 근거: 유일한 호출자 `ServerContext.close`(`session-context.ts:381-385`)가 먼저 `this.controller`를 abort하고, scoped fetch·composer·mcp 요청이 모두 그 signal을 합성(`:109·149`), event 구독은 같은 close의 subscriber 오류로 종료 | EP09 shutdown |
| L9 | `opencode/v1/server-profile.ts:36` | 다른 값 | 상대 XDG가 없어도 요청 cwd를 host로 | 잡음 | `server.test: separates relative path environments and preserves relative XDG…`·`retires only future acquisitions…` | EP07 cwd · AC13·AC18 |
| L10 | 같은 파일 `:34` | 제거 | 상대 파일 경로 env 절대화 삭제 | 잡음 | `server.database-path.test: reads the database path through the server and CLI environment…` | EP07 env · AC18 |
| L11 | 같은 파일 `:8` | 고정값 | 실행 파일 identity에서 stat 제거 | 잡음 | `server.test: invalidates the version cache when the executable bytes change…` | EP07 profile · AC13 |
| L12 | `opencode/v1/adapter.ts:160` | 호출 대체 | complete finally `await release()` → `void` | 잡음 | `adapter.instances.test: awaits directory disposal in the complete consumer finally…`·`adapter.test: rejects a failed auxiliary response…` | EP10 complete |
| L13 | `opencode/v1/channel.ts:409` | 호출 대체 | channel finally `await release()` → `void` | 잡음 | `adapter.instances.test: …in the channel consumer finally…`·`adapter.persistent.test: cancels command preparation…` | EP10 channel |
| L14 | `opencode/v1/session-context.ts:460` | 맞바꿈 | server 반납(`finish`)을 native 정리 전에 | 잡음 | `adapter.instances.test: awaits directory disposal…` 2건 | EP08 composite · EP09 order |
| L15 | 같은 파일 `:424` | 뒤집기 | context `references++`를 `await instances.acquire` 뒤로 | **못 잡음**(Linux·보정 shim) | — 마지막 owner 정리 중 같은 directory 재획득이 대기하는 동안 ref 0이 되어 context가 닫히고 재획득이 실패하는 경로가 남는다 | EP08 reservation · AC16 |

- 검산: 시도 15 = 잡음 13 · 동치 1(L8) · 못 잡음 1(L15). L15는 §10 고정 자리(EP08 "context acquire 예약") → `PAIR_FAIL`. 그 자리의 보고 좌표 N6은 존재하지 않는다.
- 형제 슬롯 맞바꿈: L14(정리 완료↔server 반납 순서) 잡음.
- 이관 수령 관측(§0-1): 0274 E1–E11 = 잡음 10 · 못 잡음 1(E11) · 0273 T1–T5·T7 = 잡음 6. 이 표의 시도 15와 합산하지 않는다.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP13 | UT | REQUIRED | PASS | L1·L2·L6·L11 잡음, L8 동치 (0274 VP08 이관 포함) |
| VP12 | IT | REQUIRED | **PAIR_FAIL** | L9–L14 잡음, **L15** 못 잡음(context 예약). 0274 VP07·0273 VP-03 이관분은 E2·E3·T1·T7 잡음 |
| VP11 | ST | REQUIRED | PASS | L3·L4·L5·L7 잡음 (0274 VP06 이관 포함, E4·E6·E7 잡음) |
| VP10 | AT | REQUIRED | BLOCKED_BY:VP12 | AC13–15·17–21 관측 PASS, AC16 재진입은 VP12 root |
| VP01·02·04 (0273) | — | REGRESSION | PASS | 0273 T1–T7 잡음([0273 verify](../0273-opencode-command-stream-errors/verify.md)) |
| VP05 (0274) | AT | REGRESSION | PASS | 0274 E1–E10 잡음 |
| VP09 (0274) | UT | REGRESSION | **PAIR_FAIL** | 0274 E11(warm 거절 fence) 못 잡음 — 0274 D1 이관 수령, P5가 fence 제거에 둔감 |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1–AC5 (0273) | ✅ | T1–T7 잡음 |
| AC7–AC10·AC12 (0274) | ✅ | E1–E10 잡음 |
| AC11 (0274 회귀) | ❌ | E11(warm 거절 callback fence) green — 0274 D1 이관 수령, VP09 root |
| AC13 profile 공유·격리 | ✅ | L9·L11 잡음 (0274 D10·0268 D2 이관 수령) |
| AC14 ref·마지막만 dispose | ✅ | L1 잡음 (0268 D2 공유 owner 이관 수령) |
| AC15 ack 뒤 event 대기 | ✅ | L3·L7 잡음 |
| AC16 재진입·늦은 결과 격리 | ❌ | L4 잡음, L15 green |
| AC17 미사용 취소·소비처 반납 | ✅ | L2·L12·L13 잡음 |
| AC18 상대 경로·db path | ✅ | L9·L10 잡음 |
| AC19 정리 실패 retire·예산 | ✅ | L5·L6 잡음 |
| AC20 다중 directory 격리 | ✅ | L14 잡음, 0274 E2·E3 잡음 |
| AC21 실제 CLI 실측 | ✅(보고) | `execution-report.md` 원시 결과 존재. 검증자 미재실행 — 실제 CLI 바이너리 없음 |

- 합계 재측정: `✅ 18 · ❌ 2 = 20`. 자기보고 `Criteria-Met: 20/20`(`5e9ab52`)과 불일치.

### §10 강제 지점 분모

| EP | 결과 |
|---|---|
| EP07 (5) | 5/5 PASS (L9·L10·L11, server retire N3 pass, scoped directory N5 pass) |
| EP08 (6) | 5/6 — context acquire 예약 PAIR_FAIL(L15, 좌표 N6 부재) |
| EP09 (8) | 8/8 PASS (L3–L7·L14, L8 동치) |
| EP10 (4) | 4/4 PASS (L12·L13, complete/recover/history N14 pass) |

- 22/23. 목록 밖 발견 없음.
- 이관 수령 자리(이 분모와 별도): 0274 EP03–06 23자리 = 22 PASS(E1–E10) · 1 PAIR_FAIL(E11 → VP09) · 0273 EP01·02 8자리 = 8 PASS(T1–T5·T7·P2) · 0268 EP1 서버 9자리 = EP07–10 관측으로 PASS.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error · main 465파일 중 15 red 전부 Windows 전용 fixture · Windows CI #853 green.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 실제 CLI 1.17.19의 module import 재사용·서버 종료 | SDK transport·spawn fake 단언 | 실제 바이너리 실행 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → `verify/FAIL`·Codex·라운드 2. 이관 수령 뒤에도 상태·라운드 동일.
- 대상 커밋: `a83b6f5`·`79ccc64`·`5e9ab52` 모두 `git cat-file -t` = commit. `5e9ab52` trailer 5키 파싱.
- `[구현자 기입]` 7필드와 23자리 표 존재. 다만 좌표 N6이 실재하지 않는다(D1).

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | L15: context ref 예약을 await 뒤로 옮겨도 green, 보고 좌표 N6 부재 | EP08 reservation · AC16 · VP12 | BLOCKING (PAIR_FAIL) | 마지막 owner 정리 중 같은 directory 재획득이 같은 context로 성공함을 단언(N6 실구현) |
| D2 | E11(0274 D1 이관 수령): warm 거절 catch의 `close()` 삭제 green | 0274 MD3/UT3 → VP09 REGRESSION · AC11 | BLOCKING (PAIR_FAIL) | 거절 응답과 `submitting` 해제 사이 늦은 SSE callback을 주입해 다음 frame 미도달 단언, 또는 호출자 close로 동치임을 근거와 함께 보임 |
| N1 | L8: shutdown의 entry abort는 상위 controller abort와 동치 | EP09 shutdown | NON_BLOCKING | 방어 중복으로 유지 가능 |

## 14. Review Signals

- 이전 라운드: 첫 verify. 관련 plan 지침: 구현자 표가 EP08 reservation의 좌표로 N6을 적었으나 테스트가 만들어지지 않았다.
- 사용자 결정 변경: 0274 D10 → D13(사용자 승인) — 최신 handoff 기준 채점.
- 사용자 결정(2026-10-22): 구현이 옛 plan과 갈라진 항목은 계약을 뒤집은 최신 handoff verify가 책임 — 0274·0273·0268에서 이관 수령(§0-1).
- 반복 환경 한계: Windows 전용 fixture(검증자 shim), 실제 CLI 바이너리 없음.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: PASS 6(VP01·VP02·VP04·VP05·VP11·VP13) · root PAIR_FAIL 2(VP12·VP09) · BLOCKED_BY 1(VP10). PLAN_GAP 없음.
- AC: ✅18 · ❌2 / 20.
- 다음 단계: Codex r2 — D1·D2, 다음 verify는 L15·E11 재실행·L8 동치 재확인.
