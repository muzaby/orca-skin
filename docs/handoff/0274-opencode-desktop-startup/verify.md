# Verify — 0274-opencode-desktop-startup

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0274-opencode-desktop-startup` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `8c3dc1e..5233585`(r1) · 검증 HEAD `32b43cc`(0275가 같은 context·channel을 이후 확장) |
| 구현 전 plan 기준 | ΔV2 `46bfa52` · ΔV3 `fe830da` · ΔV4 `8c3dc1e` |
| V mode / 유효 V | Delta V / 0273 V1 + ΔV2 + ΔV3 + ΔV4 |
| 라운드 | 1 (verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — §10 23자리 중 ΔV3가 추가한 warm 거절 fence(EP06)에서 심은 고장이 green이었다.** global SSE 공유·handshake·directory/인증 격리·명령 cache·config 단일 flight·병렬 준비는 잠겼다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `5233585`의 `plan.md` 변경: 메타 상태와 `[구현자 기입]` 채움만.
- 기준선 diff 성립: 예 — ΔV2·ΔV3·ΔV4가 구현과 분리된 설계 커밋.
- ΔV3(warm 거절 callback fence)는 구현 중 발견한 누락 자리를 설계 커밋으로 먼저 고정 — 규범 행 정정이 구현과 분리됐다.
- 채점 기준: AC 11(0273 AC1–5 + AC7–12), pair VP01·02·04 REGRESSION + VP05–09 REQUIRED, §10 23자리(EP03 6 · EP04 8 · EP05 8 · EP06 1).
- HEAD 관점: 0275가 D10(cwd 격리)을 D13으로 SUPERSEDED했다. AC9의 "인증 generation 격리"는 유지되고 "다른 cwd server 격리"는 0275 AC13이 대체 — 이 verify는 HEAD 코드에서 0274 계약 중 SUPERSEDED되지 않은 부분을 채점한다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V·상속 | 유효 | 기준 0273 V1 `9ae4d5f3`, AR1/IT1 SUPERSEDED → AR2/IT2 이관(AC1–5·SDK 실패 oracle을 VP07·08로) 명시 |
| ΔV4 SUPERSEDED 이관 | 유효 | 0273 R6/AT6 → R12/AT12, 기존 evidence 보존 |
| §10 자리 목록 | 유효 | 23자리가 역할·파일로 고정되고 구현자 표가 23행 모두 좌표를 단다. 좌표 21개(A1–6·C1–9·P1–6) HEAD 실재 확인 |
| 선택 적대 증거 | 유효 | 없음 — 실제 SDK 조립 경로 직접 관측 |
| 운영 gate | 유효 | Vitest·lint·typecheck·build·inventory·실측 |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D06 | server 인증 generation별 client·global SSE 공유 | `OpenCodeSessionContexts.acquire` key = `url:harnessEnvFingerprint(headers)` (`session-context.ts:408`) |
| D07 | `server.connected` 확인 후 config 준비, commands/catalog 병렬, session 후 첫 입력 | `ServerContext` handshake barrier → `state.ready ??= client.config…` → channel `connection.prepare` |
| D08 | 일반 입력은 command 목록 미대기, `/명령`은 같은 instance 목록으로 1회 dispatch | channel `void connection.commands(signal)` · slash 경로만 await |
| D09 | 한 채널 close는 자기 lease만 | lease `release` → refs, 마지막만 stream 종료 |
| D11·D12 | 이벤트 단절은 현재 채널 명시 실패, 자동 재제출 없음, 고정 문장 | `onSseError` 보관 → `openCodePreparationError('events', …)` |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 임의 첫 이벤트를 준비 완료로 오인 | ✅ | `server.connected` 전 다른 이벤트는 준비 오류(`session-context.ts:338`, E1 잡음) |
| 다른 directory·인증 세대 혼입 | ✅ | key=`url:fingerprint`(`:408`), directory 정확 비교(`:352`) — E2·E3 잡음 |
| 큐 포화가 조용히 이벤트 유실 | ✅ | 상한 초과 시 명시 실패(`:261`, E5 잡음) |
| 일반 입력이 명령 목록을 기다림 | ✅ | `void connection.commands(signal)`(`channel.ts:304`, E9 잡음) |
| warm 거절 뒤 늦은 callback | ⚠️ | catch의 `close()`(`channel.ts:255`)를 지워도 P5가 green(E11) — §4 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| test-only symbol | 없음 | `OpenCodeSessionContexts`는 adapter가 생성, `ServerContext`는 그 내부 |
| 후속 handoff 확장 | 관찰 | 0275가 instance lifecycle·profile 공유를, 0276이 composer cache를 같은 파일에 추가 — 이 verify는 0274 계약 자리만 채점 |

## 4. 고장 내 보기

- 등록 변이 0(선택 적대 증거 없음). §10 23자리 중 재량 고장. 0273 승계 회귀(T1–T7)는 [0273 verify](../0273-opencode-command-stream-errors/verify.md).
- 실행: Linux `src/main/adapters/opencode src/main/app src/main/features/sessions`(기준선 7 red = Windows 전용) + Windows 전용 adapter 2파일을 검증자 win32 shim으로. 보정 shim 기준선 25/25 green.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| E1 | `opencode/v1/session-context.ts:338` | 제거 | handshake 전 이벤트 거부 삭제 | 잡음 | `session-context.test: requires the server handshake instead of treating an arbitrary first event as ready` | EP04 handshake · AC7 |
| E2 | 같은 파일 `:352` | 제거 | directory 일치 비교 삭제 | 잡음 | `adapter.startup.test: connects global events before project readiness…` | EP04 route · AC9 |
| E3 | 같은 파일 `:408` | 다른 값 | context key에서 인증 fingerprint 삭제 | 잡음 | `session-context.test: shares one global subscription and routes directory and authenticated server generations separately` | EP03 identity · AC9 |
| E4 | 같은 파일 `:347` | 제거 | instance disposed 전달 삭제 | 잡음 | `adapter.instances.test: awaits directory disposal…` 외 62건 | EP04 disposed · AC10 |
| E5 | 같은 파일 `:261` | 고정값 | 큐 상한 검사 → `false` | 잡음 | `session-context.test: fails an overflowing subscriber explicitly…` | EP04 queue |
| E6 | 같은 파일 `:208` | 제거 | 명령 cache 재사용 삭제 | 잡음 | `adapter.startup.test: shares one subscription and bootstrap for many first sessions…` | EP05 commands · AC8 |
| E7 | 같은 파일 `:221` | 제거 | 명령 revision 비교 삭제 | 잡음 | `session-context.test: cancels shared SDK work on the last release and ignores a late command result…` | EP05 inventory |
| E8 | 같은 파일 `:176` | 뒤집기 | config 준비 `??=` → `=`(매번 재요청) | 잡음 | `adapter.persistent.test: subscribes once before initial and subsequent prompts` | EP05 config · AC8 |
| E9 | `opencode/v1/channel.ts:304` | 호출 대체 | 명령 목록 `void` → `await` | 잡음 | `adapter.persistent.test: fails command preparation safely before acceptance…` | EP05 parallel · AC8 |
| E10 | 같은 파일 `:305` | 제거 | session 전 `connection.prepare` 대기 삭제 | 잡음 | `adapter.persistent.test: subscribes once before initial and subsequent prompts` | EP05 config · AC7 |
| E11 | 같은 파일 `:255` | 제거 | warm 거절 catch의 `close()` 삭제 | **못 잡음**(Linux·보정 shim) | — 호출자 `pushTurn` catch가 한 microtask 뒤 `close()`하므로 등록 oracle P5가 그 사이 늦은 callback을 만들지 않는다 | EP06 · AC11 · VP09 |

- 검산: 시도 11 = 잡음 10 · 못 잡음 1(E11) · 동치 0. E11은 ΔV3가 고정한 EP06 단일 자리 → `PAIR_FAIL`.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP08 | UT | REQUIRED | PASS | E3·E5·E6·E7 잡음 |
| VP09 | UT | REQUIRED | **PAIR_FAIL** | **E11** 못 잡음 — P5 `retires a rejected warm submission…`가 fence 제거에 둔감 |
| VP07 | IT | REQUIRED | PASS | E2·E3·E8·E10 잡음 |
| VP06 | ST | REQUIRED | PASS | E4·E6·E7 잡음 |
| VP05 | AT | REQUIRED | PASS | E1·E2·E9·E10 잡음 |
| VP01·02·04 (0273) | — | REGRESSION | PASS | T1–T5·T7 잡음 |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1–AC5 (0273) | ✅ | T1–T5·T7 잡음 |
| AC7 global→config→session 순서 | ✅ | E1·E10 잡음 |
| AC8 일반 입력 무대기·slash 1회 | ✅ | E6·E8·E9 잡음 |
| AC9 stream 공유·directory·인증 격리 | ✅ | E2·E3 잡음 |
| AC10 실패·종료·disposal 정리 | ✅ | E4·E7 잡음 |
| AC11 0273 회귀 + warm 거절 fence | ❌ | E11 green |
| AC12 실제 1.17.19 시퀀스 | ✅(보고) | `evidence/cli117-context-result.json`·`pooled-electron-result.json` 존재. 검증자 미재실행 — 실제 CLI 없음 |

- 합계 재측정: `✅ 10 · ❌ 1 = 11`. 자기보고 `Criteria-Met: 11/11`(`5233585`)과 불일치.

### §10 강제 지점 분모

| EP | 결과 |
|---|---|
| EP03 (6) | 6/6 PASS (E3, A2·A3·C1·C3·C5 좌표 pass) |
| EP04 (8) | 8/8 PASS (E1·E2·E4·E5, A2 global·P3/P4 onSseError 좌표 pass) |
| EP05 (8) | 8/8 PASS (E6–E10, C8 closed fence·A6 refresh 좌표 pass) |
| EP06 (1) | PAIR_FAIL (E11) |

- 22/23. 좌표 21개(A1–6·C1–9·P1–6) HEAD 실재. 목록 밖 발견 없음.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error · main 465파일 중 15 red 전부 Windows 전용 fixture · Windows CI #853 green.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 실제 Electron·CLI 1.17.19 다중 세션 | SDK transport 테스트 | 실제 바이너리 실행 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → `verify/FAIL`·Codex·라운드 2.
- 대상 커밋: `46bfa52`·`fe830da`·`8c3dc1e`·`5233585` 모두 `git cat-file -t` = commit. `5233585` trailer 5키 파싱.
- `[구현자 기입]` 7필드와 23자리 표 존재.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | E11: warm 거절 catch의 `close()`를 지워도 green | EP06 · AC11 · VP09 | BLOCKING (PAIR_FAIL) | 거절 응답과 `submitting` 해제 사이에 늦은 SSE callback을 주입해 다음 frame에 도달하지 않음을 단언, 또는 호출자 close로 동치임을 근거와 함께 보임 |

## 14. Review Signals

- 이전 라운드: 첫 verify. 관련 plan 지침: ΔV3가 이 fence를 단일 강제 지점으로 고정하고 P5를 oracle로 지정했다 — 당시 red였던 P5가 지금은 fence 없이 green이다.
- 사용자 결정 변경: D10 → 0275 D13(cwd 간 서버 공유) — 최신 handoff 기준 채점.
- 반복 환경 한계: Windows 전용 fixture(검증자 shim), 실제 CLI 없음.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: PASS 7(VP05·06·07·08·VP01·02·04) · root PAIR_FAIL 1(VP09). PLAN_GAP 없음.
- AC: ✅10 · ❌1 / 11.
- 다음 단계: Codex r2 — D1, 다음 verify는 E11 재실행.
