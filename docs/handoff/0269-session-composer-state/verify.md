# Verify — 0269-session-composer-state

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0269-session-composer-state` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `2ad05cb..e58f839` — `9653018`(r1, `Status: partial`) · `e58f839`(r1.2, CI 결과 기록) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | V1 `2ad05cb` |
| V mode / 유효 V | Baseline V / V1 (0267·0268 경로 REGRESSION) |
| 라운드 | 1 (verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — §10 EP1 8자리 중 reader→load DTO 자리에서 심은 고장이 green이었다.** 모델 저장·연속 턴 운반·Composer 복원(등록 M1)·기본 승인은 잠겼지만, 복원 시 저장 모델보다 마지막 telemetry 모델을 먼저 쓰는 고장을 어떤 테스트도 잡지 못한다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `9653018`·`e58f839`의 `plan.md` 변경: 메타 상태와 `[구현자 기입]` 채움. 등록 변이 M1 문단은 설계 커밋 `2ad05cb`에 이미 있다(`git show 2ad05cb:…plan.md`에 1회).
- 기준선 diff 성립: 예.
- 채점 기준: AC1–6, VP1–5 REQUIRED, §10 EP1 8자리, 등록 변이 M1(Composer alias hydration의 `modelFamily`↔`model.alias` 맞바꿈).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V | 유효 | VP1–5 NEW REQUIRED, 0267/0268 경로 REGRESSION 명시 |
| §10 자리 목록 | 유효 | EP1 8자리 역할 고정 + 검색 명령 기록 |
| 선택 적대 증거 | 유효 | M1 — 이번에 바꾼 구조적 호출 전수(setModel 3→4곳) oracle의 민감도. 자리 명시(새 alias hydration 호출) |
| 운영 gate | 유효 | Vitest(DB는 Electron Node 또는 분리)·타입·lint·build·migration·inventory·boundary·원격 CI |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D1 | 사용자 입력 소비 확정 시 세션별 provider+정확한 모델([1m] 포함) 저장 | `turn-context.ts` modelFamily → `HistoryWriter` user commit → `queries.ts` `last_model = @modelFamily` |
| D2 | load/refresh DTO가 저장 모델 전달, cold load 복원, cached 새 선택 보존, legacy null은 telemetry fallback | `reader.ts` `meta.last_model ?? lastTelemetry?.model ?? null` → `LOAD_SESSION` → `Composer.tsx` `setModel(providerKey, modelFamily, model.alias, …)` |
| D3 | 명시 선택 없는 Claude는 4.6+에서 auto 기본 | `chatReducer.ts` `backend === 'claude' && !state.permissionModeExplicit` |
| D4 | CI 15파일 회복 | Windows CI #39446331194 |
| D5 | append-only nullable migration | `0033_*.sql`(이번 추가) |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 제목 생성 모델·미소비 입력이 저장을 덮음 | ✅ | 사용자 입력 소비 확정에서만 같은 UPDATE(`queries.ts:258`, `writer.ts:190·357`) — G2·G3 잡음 |
| cached 새 선택을 refresh가 덮음 | ✅ | G1(등록 M1) 잡음 |
| 명시 승인 선택 보존 | ✅ | `permissionModeExplicit` 조건(`chatReducer.ts:1646`, G7 잡음) |
| 복원 우선순위 | ⚠️ | reader가 `last_model`을 telemetry보다 먼저 쓰는 순서를 뒤집어도 green(G6) — §4 |
| migration append-only | ✅ | 새 nullable 컬럼 파일 추가, `check-migrations-appendonly` 통과 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| test-only symbol | 없음 | `updateSessionProviderKey`·`LoadedSession.modelFamily` production 호출 |
| setModel 호출 전수 | 유지 | Composer alias 복원으로 4곳 — composerWiring guard가 4곳 검사(G1 red 포함) |

## 4. 고장 내 보기

- 등록 변이 M1 = G1(새 alias hydration 호출의 `modelFamily`↔`model.alias` 맞바꿈). 나머지는 §10 EP1 8자리 재량 고장. 실행: main `src/main src/shared`(실제 SQLite 포함, 기준선 15 red = Windows 전용), renderer `features/chat`.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| G1 (M1) | `chat/components/Composer.tsx:201` | 맞바꿈 | `setModel` 인자 modelFamily↔alias | 잡음 | `Composer.selection.test: shows each loaded session model instead of the provider default…` | EP1⑤ · AC2 · VP3 등록 변이 |
| G2 | `infra/db/queries.ts:258` | 빈 값 | `last_model = NULL` | 잡음 | `last-model.test: restores each session model after closing and reopening its database…` | EP1① · AC4 |
| G3 | `features/history/writer.ts:190` | 빈 값 | 소비 확정 modelFamily → `null` | 잡음 | 같음 | EP1③ · AC1 |
| G4 | 같은 파일 `:352` | 고정값 | 새 세션 조건 → `true` | 잡음 | 같음 | EP1③ · AC1 |
| G5 | `app/chat-turn/turn-context.ts:230` | 빈 값 | 연속 턴 modelFamily → `null` | 잡음 | `turn-context.test: carries the actual resolved model, separately from the title model, into continuation turns` | EP1② · AC1 |
| G6 | `features/history/reader.ts:86` | 뒤집기 | `last_model ?? telemetry` → `telemetry ?? last_model` | **못 잡음** | — main 464파일 green(기준선 15 제외). 저장 모델과 마지막 telemetry 모델이 다른 입력이 없다 | EP1④ · AC1 · VP3 |
| G7 | `chat/reducer/chatReducer.ts:1646` | 제거 | `!permissionModeExplicit` 조건 삭제 | 잡음 | `chatReducer.model.test: defaults claude-haiku-5-5 / claude-opus-4-6[1m] to automatic approval…preserves explicit choices` | EP1⑥ · AC3 |

- 검산: 시도 7 = 잡음 6 · 못 잡음 1(G6) · 동치 0. G6은 §10 EP1④ 고정 자리 → `PAIR_FAIL`. 등록 변이 M1(G1) red 재현.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP4 | UT | REQUIRED | PASS | G7 잡음 |
| VP3 | IT | REQUIRED | **PAIR_FAIL** | G1(M1)·G2·G3·G4·G5 잡음, **G6** 못 잡음(reader 우선순위) |
| VP2 | ST | REQUIRED | PASS | G1 잡음(cached A→B→A·fresh store), G2 재개방 |
| VP1 | AT | REQUIRED | BLOCKED_BY:VP3 | AC2 관측 PASS, AC1 복원값은 VP3 root |
| VP5 | AT | REQUIRED | PASS | 원래 CI 실패 15파일 포함 Windows CI #853 green |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 세션별 모델 저장·재개방 복원(제목 모델 무관) | ❌ | G2–G5 잡음, G6(복원 시 telemetry 우선) green |
| AC2 cached 보존·cold 복원·legacy fallback | ✅ | G1 잡음 |
| AC3 4.6+ 기본 auto·명시 선택 보존 | ✅ | G7 잡음 |
| AC4 append-only migration·같은 UPDATE | ✅ | G2 잡음, `upgrades an existing database without losing conversation rows…` pass |
| AC5 CI 15파일 회복 | ✅ | Windows CI #853 green(`84fe913`) |
| AC6 gate·원격 CI | ✅ | 운영 gate 아래 |

- 합계 재측정: `✅ 5 · ❌ 1 = 6`. 자기보고 `Criteria-Met: 6/6`(`e58f839`)과 불일치.

### §10 강제 지점 분모

| 자리 | 결과 |
|---|---|
| ① migration/query UPDATE | PASS (G2) |
| ② resolve→turn-context·continuation | PASS (G5) |
| ③ writer 소비·새 session 확정 | PASS (G3·G4) |
| ④ reader→load/refresh DTO | PAIR_FAIL (G6) |
| ⑤ LOAD_SESSION→Composer | PASS (G1) |
| ⑥ permission 기본/명시 | PASS (G7) |
| ⑦ CI 15파일 | PASS (CI #853) |
| ⑧ 운영 gate·원격 CI | PASS |

- 7/8. 목록 밖 발견 없음.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error · renderer 374/3060 · main(SQLite Node ABI) 15 red 전부 Windows 전용 fixture · migrations append-only·inventory·budgets 통과 · Windows CI #853 green.

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → `verify/FAIL`·Codex·라운드 2.
- 대상 커밋: `2ad05cb`·`9653018`·`e58f839` `git cat-file -t` = commit. `9653018`(`Status: partial`)·`e58f839`(`implemented`, `Criteria-Met: 6/6`) trailer 파싱.
- `[구현자 기입]` 7필드와 8자리 표 존재. 등록 변이 문단은 설계 커밋 `2ad05cb`에 있었다(구현자 추가 아님).

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | G6: 저장 모델보다 telemetry를 먼저 써도 green | EP1④ · AC1 · VP3 | BLOCKING (PAIR_FAIL) | `last_model`과 다른 마지막 telemetry(제목 모델 포함)가 있는 세션의 load DTO가 저장 모델을 돌려줌을 단언 |

## 14. Review Signals

- 첫 verify. 관련 plan 지침: D1이 "제목 생성 모델이 덮지 않는다", D2가 "last_model이 없을 때만 telemetry fallback"을 명시.
- 반복 환경 한계: SQLite ABI(Node 재빌드로 실행), Windows CI로 AC5 확인.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: PASS 3(VP2·VP4·VP5) · root PAIR_FAIL 1(VP3) · BLOCKED_BY 1(VP1). PLAN_GAP 없음.
- AC: ✅5 · ❌1 / 6.
- 다음 단계: Codex r2 — D1, 다음 verify는 G6·G1(M1) 재실행.
