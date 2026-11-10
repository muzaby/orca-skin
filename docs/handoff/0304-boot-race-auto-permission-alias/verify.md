# Verify — 0304-boot-race-auto-permission-alias

> 판정: **RETURN_TO_PLAN** (verify 1회째, 창 안). 이행 결함 1(`BLOCKING`, VP-17) · 확장 후보 1(`PLAN_GAP`, VP-12). 나머지 REQUIRED·REGRESSION pair와 현재 변경 gate는 PASS.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0304-boot-race-auto-permission-alias` |
| 검증자 | Claude Code |
| 일자 | 2026-11-10 |
| 대상 커밋/range | `c7c9e9d..a0a95f7` (`a0a95f7` = r1 구현, `origin/main` 조상 확인) |
| 구현 전 plan 기준 | `c7c9e9d` (설계와 구현이 별도 커밋 — 기준선이 diff로 성립) |
| V mode / 유효 V | `Delta V` / `V1 rev.2 + ΔV1` |
| 검증 기준 plan revision | `c7c9e9d:V1 rev.2` · `c7c9e9d:ΔV1` |
| 라운드 | 1 |
| 상태 | RETURN_TO_PLAN |
| 확장 창 | verify 1회째 — 창 안. 사용자 요구 변경 ΔV로 다시 열린 노드: 없음 |
| 독립 축(⑥) | 4건 — `updated_at` 값 · `SET_MODEL` stale 증거 · send 증거 우선순위 · 부팅 대기 중 cwd 사용자 선택 가드 (구현 보고·spec에 없음) |
| 열거 sweep(⑦) | 1회째 전수 — spec 70건 전부 재실행, 못 잡음 0 |
| 발견 분류 | 이행 1 · 현재 0 · 확장 1(막음 1 / 후보 표 0) · 경계 0 · 비귀속 1 |
| 구현 주체·문맥 | 구현 Codex. 설계자 = 검증자(Claude)라 plan validity는 자기 설계 감사다 |

## 0. 기준선 / plan validity

- 구현 커밋이 `plan.md`를 바꿨는가: 예 — `[구현자 기입]` 절만 추가(`git show --stat a0a95f7`: plan.md +194/−38). Decision·AC·V·§10 규범 행 변경 없음.
- Decision Ledger / Product·UX / AC / V·§10·oracle 변경: 없음. 채점 원 기준 = `c7c9e9d`의 plan.
- 창 밖 ΔV: 해당 없음.

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V 상속 기준 | 유효 | `eb5ecdb`(V1 rev.2) `origin/main` 조상 확인 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | VP-01~13·16·17 |
| INHERITED ↔ REGRESSION | 유효 | VP-14·15 |
| §10 자리 목록 차집합 | 유효 | 아래 검색 5개 재실행, 차집합 ∅ |
| 적대 증거 선택 | 유효 | VP-03·06·07·17 |
| SUPERSEDED pair 이관 | 유효 | VP-11 폐기 근거 §7-A |
| 운영 gate 열거 | 유효 | §7-A 표 4행 |

재실행한 자리 검색(`app/`): EP-1 `rg -Un "(sessionApi\s*\.cwd|updateApi\s*\.state)\("` → `chatStore.ts:2220-2221`·`updateStore.ts:161` 2자리 · EP-8 `rg "sessionModelRecordFor|updateSessionProviderKey\("` → helper 1·send 1·writer 2·queries 1 · EP-6 `rg 'ANTHROPIC_DEFAULT_\$\{'` → 1 · EP-7 `rg preserveLocalState` → 4 · EP-4 `rg "setMode\(sessionId|setPermissionMode\(|spawnedPermissionModel"` → 목록 3자리 포함 · EP-2 `rg -l resolvedModel` → 12파일, ΔV1 13자리 + EP-3 파일 집합과 차집합 ∅.

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| false success | 없음 | cwd/update ready reject → 조회 0·보고 0(`chatStore.ts:2245`, `updateStore.ts:154-160`) |
| partial failure | 유지 | coordinator SDK 실패 → 저장 0(`coordinator.ts:114-123`) |
| A 대신 B 구현 | 없음 | 저장·응답 = 선택, live는 그대로 받을 때만(D-008) |
| 선영속 뒤 실패 | 수용 | D-011·plan §17 |
| `updated_at` 값 | **결함** | D1 — 시각 인자가 고정값으로 바뀌어도 green |
| 출력/요청 상한 | 해당 없음 | 부팅 invoke +2 고정 |

## 3. 역방향 탐색

`scan-surface.sh c7c9e9d..a0a95f7` 후보 중 `defaultSelection`·`resolveCliModel`·`classifyContextModel`은 테스트 전용 참조로 보이나 같은 파일 내부 호출이 실제 경로다(`modelSelection.ts`, `context-policy.ts`) — 정상. 형제 정책 비대칭 0. `toAgentEnvironment`의 `...model` spread가 `resolvedModel`을 통과시키고 IPC에서 모델을 재조립하는 자리 없음(`rg oneMillionContext`, 비테스트 6자리 확인) — 무영향.

## 4. 고장 이력

구현자 spec 70건(`mutation-spec.jsonl`)을 `mutate.py`로 전수 재실행: **70/70 red**, 원복 확인 출력 "모든 파일 원문 그대로", 이후 `git status` 깨끗. 행별 결과는 구현자 표(`plan.md [구현자 기입] 잠금`)와 일치한다. 직전 이력이 없어 ③④ 해당 없음. 형제 슬롯 맞바꿈(⑤): `EP3-send-*`·`EP8-helper-session/model`(providerKey↔payload 계열)이 포함된다.

독립 축(⑥) — spec에 없던 변이:

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 / 근거 | 분류 |
|---|---|---|---|---|---|---|
| I1-record-time | `send.ts:297` | 고정값 | `Date.now()` → `0` | **못 잡음**(44 passed) | `send.permission-mode.test.ts:432`가 `expect.any(Number)` | 이행(D1) |
| I2-stale-evidence | `chatReducer.ts:1672` SET_MODEL | 뒤집기 | `action.modelResolved ?? null` → `?? state.modelResolved` | **못 잡음**(306 passed) | 증거 없는 모델로 바꾸는 입력이 어떤 테스트에도 없음 | 확장(D2) |
| I3-send-priority | `send.ts:556` | 뒤집기 | `permissionModel ?? model` → `model ?? permissionModel` | 잡음 | `send.permission-mode.test.ts` 1 failed | — |
| I4-cwd-revision-guard | `chatStore.ts:2223` | 제거 | `cwdRevision` 비교 제거 | 잡음 | `chatStore` 스위트 1 failed | — |

검산: 시도 74 = 잡음 72 · 못 잡음 2 · 동치 0 · 경계 0. 소거 변이 잔여물 해당 없음. 동작 보존 추출 라운드 아님.

## 5. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거(좌표 실재 확인) | §10 |
|---|---|---|---|---|
| VP-01·04·13 | R·SD·MD | PASS | `chatStore.bootGate.test.ts:37·48·57`, `updateStore.bootGate.test.ts` — spec 7행 red | 2/2 |
| VP-02·06 | R·AR | PASS | `model-parser.test.ts`·`models.test.ts`·`modelSelection.test.ts:98`·`Composer.selection.test.ts:303·349`·`chatStore.modelPermission.test.ts:43` — spec 21행 red, typecheck 변이 2행 red | 13/13 |
| VP-03·10 | R·MD | PASS | `coordinator.permission.test.ts:145` 외 — spec 7행 red(호출 대체·맞바꿈 포함) | 3/3 |
| VP-05·07·09 | SD·AR·MD | PASS | `send.permission-mode.test.ts`·`continuation.test.ts:235`·`chat-turn-continuation.test.ts`·`permission-mode.test.ts`·`session-runtime.test.ts` — spec 20행 red, I3 red | 8/8 |
| VP-08 | MD | PASS | `model-identity.test.ts` — spec EP6 6행 red | 2/2 |
| VP-12 | MD | **PASS, D2 확장 후보** | `chatReducer.model.test.ts:192·228` — spec 5행 red, I2 green | 8 중 ⑥ |
| VP-16 | R | PASS | `chatReducer.model.test.ts:192` — spec EP7 2행 red | 2/2 |
| VP-17 | AR | **PAIR_FAIL** | `turn-context.test.ts`·`send.permission-mode.test.ts:429-485`·`send.busy.test.ts` — spec 8행 red, **I1 green** | 2/2 중 시각 인자 미잠금 |
| VP-14·15 | SD | PASS(REGRESSION) | 전체 vitest에 포함(`steps.test.ts`·`bootstrap.settings-early.test.ts`) | 0 |

- root `PAIR_FAIL`: VP-17(D1). 종속 `BLOCKED_BY` 없음.
- 좌표 실행 구간: `send.permission-mode.test.ts`는 `handleChatSend` 조립으로 들어가 `ctx.db.updateSessionProviderKey` mock 인자를 관측한다 — mock한 것은 db 포트뿐이고 기록 호출 자리는 구간 안이다. 3번째 인자만 `expect.any(Number)`라 그 항은 기본·형제 구별이 없다(plan §공통 V "운반 항별 구별 입력").

### AC 세부와 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1·2·3·3b | ✅ | bootGate 2파일, spec EP1 7행 red |
| AC4~AC8 | ✅ | parser·modes·store·send·model-identity |
| AC9·AC10·AC12 | ✅ | coordinator 5행+resolved alias·context-policy |
| AC14·AC15 | ✅ | `chatReducer.model.test.ts:192` |
| AC16 | ⚠️ | 인자 4개 중 시각 미구별(D1) — 나머지 3항은 red |
| AC17 | ✅ | helper null 입력·`send.busy.test.ts` busy 0 |
| AC13 | ⚠️ | Windows 설치본·실제 SDK 실기 대기 |

- **합계 재측정**: ✅15 · ⚠️2 · ❌0 = 총 17 (AC ID `{1,2,3,3b,4,5,6,7,8,9,10,12,14,15,16,17,13}`, AC11 폐기 제외) · 구현자 보고 `16/17` ↔ 이번 재측정 15/17 · **불일치(AC16)**.
- 합계 사본: plan 본문 16 · 커밋 trailer `Criteria-Met: 16/17` · INDEX 비고 `AC 16/17` — 서로 일치(구현자 기준).

## 7. 숫자 재측정

`updateSessionProviderKey` 비테스트 호출 4(정의 1 + writer 2 + send 1) — AC15 정정과 일치. EP 분모 합 32 = 구현자 표 32.

## 8. 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| AC13 | 순서·live 호출·선택 유지·전송 기록 전부 vitest | Windows 설치본 콜드 부팅 로그·실제 SDK `status`·다음 턴 자동 승인 실행 |

## 9. 게이트 재실행

환경: `npm ci --ignore-scripts` 뒤 `npm rebuild better-sqlite3`(Node ABI, 성공) · `node node_modules/electron/install.js`(Electron 바이너리).

| 명령 | 관측 |
|---|---|
| `check-migrations-appendonly` · `check-doc-inventory --check` · `check-test-budgets` | 모두 exit 0 (20 real-git suites ok) |
| `npm run typecheck` | node·web·test exit 0 |
| `npx eslint ./src ./scripts` (`--fix` 없음) | 0 error · 2 warning(기존), 작업 트리 변화 없음 |
| `vitest run` 전체(바인딩 복구 후) | 945파일 중 29 failed · 22 케이스. Electron 설치 뒤 29→9파일 · 22케이스 |
| 기준선 `c7c9e9d` 같은 9파일 | 동일 9 failed · 22 케이스(Windows 경로 단언·`restart-required` 등 다른 OS 전용) — 파일 집합·건수 동일, 케이스 이름 단위 대조는 하지 않음 |

- 이번 변경이 추가·수정한 파일의 실패: 0(실패 9파일은 모두 미수정). `[test-pools]` 가드 실패 0.
- `node --test scripts/*.test.mjs`는 이번 턴 미실행(구현자 보고 827/827은 참조 값).
- 게이트가 작업 트리를 바꿨는가: 없음. 잔여물: `app/node_modules`·검증 worktree(제거함).

## 11. Repository operation checks

- INDEX: 상태 IMPL_DONE·다음 주체 Claude 하나 — 실제와 일치. 대상 커밋 자리표시자를 검증자가 채움: r1 구현 `a0a95f7`, 설계 `402c23a`·`e87d9bc`·`eb5ecdb`·`758309f`·`ec77831`·`c7c9e9d` — 전부 `git cat-file -t` commit · `origin/main` 조상.
- trailer: `git log -1 --format='%(trailers:only=true)' a0a95f7` → Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By 6키 파싱 ✓, 허용값 ✓.
- `[구현자 기입]` 7필드(설계 리뷰·강제 지점 전수·잠금(sweep 포함)·Product/UX·잠재 문제·구현 보고·Review Signals) 존재.
- AGENTS 변경 없음.

## 13. Finding disposition

| # | finding | 분류 · 근거 | 귀속 | disposition | root / 영향 | 후속 |
|---|---|---|---|---|---|---|
| D1 | send 선영속의 `updated_at` 인자를 `0`으로 바꿔도 green | **이행** — AC16 검증 수단 "인자 4개 구별 값"(`plan.md` §7 AC16 행)을 어김: 4번째가 `expect.any(Number)`(`send.permission-mode.test.ts:432`), I1 재현 | VP-17·AC16·EP-8 | BLOCKING (`PAIR_FAIL`) | root VP-17 | 구현: 시각을 고정(fake timer 또는 `Date.now` 스텁)하고 정확값 단언 |
| D2 | `SET_MODEL`이 증거 없는 모델로 바꿀 때 이전 `modelResolved`를 지워야 하는 분기가 무잠금 | **확장** — §10 "선택적 필드 의미: `resolvedModel` 부재 = … `model`로 폴백"은 표 밖 문장이라 규칙 칸 분기 인용으로 보기 어렵다(해석 필요). 트리에는 현재 결함 없음(코드는 `?? null`) | VP-12·EP-3 ⑥ | PLAN_GAP (창 안) | VP-12 | planner: UT 입력 채택(증거 모델 → 증거 없는 모델 전환) 또는 경계 선언 |
| D3 | `node --test scripts/*.test.mjs` 미실행 | 비귀속 | 운영 gate | NON_BLOCKING | — | 구현자 보고 827/827 참조, CI 몫 |

> D2가 `PLAN_GAP`이라 판정은 `RETURN_TO_PLAN`이고 다음 주체는 설계자다. D1은 창과 무관하게 막으므로 설계 정정 뒤 구현 턴이 고친다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음(1회째). 다만 "기록 인자 중 한 항이 `expect.any`로만 단언"은 0265 r2(운반 값 구별) 형태.
- 관련 plan 지침: AC16 "인자 4개 구별 값" · §공통 V 운반 항 구별 — 있었음.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: Electron 바이너리·better-sqlite3 바인딩 부재(`--ignore-scripts`), 복구 뒤에도 Windows 경로 단언 9파일.
- 독립 축(⑥) 발견: 4건 시도 → 못 잡음 2 (이행 1 · 확장 1).

## 15. 결론

- 상태: **RETURN_TO_PLAN**
- verify 횟수: 1회째 — 확장 창 안
- 후보 표로 간 확장 후보: 0 (D2는 창 안이라 `PLAN_GAP`)
- pair 결과: REQUIRED/REGRESSION PASS 15(VP-01~10·12~16 중 VP-12는 D2 확장 후보 동반) · root PAIR_FAIL 1(VP-17) · BLOCKED_BY 0
- PLAN_GAP: D2 → 영향 pair VP-12
- Product/UX 및 ACTIVE Decision 충족: 충족(D-001~D-004·D-007~D-009·D-011 코드·테스트 대조)
- AC 충족: ✅15 · ⚠️2(AC13 사람 실기, AC16 D1) · ❌0
- 현재 변경 운영 gate: PASS (기준선 9파일·22케이스 동일, `node --test`는 미실행)
- 남은 사람 확인: AC13
- 다음 단계: 설계자가 D2를 채택(UT 입력 행)하거나 경계로 선언하고 AC16 시각 항 입력을 §10 EP-8에 고정 → 구현자가 D1을 고치고 재검증.
