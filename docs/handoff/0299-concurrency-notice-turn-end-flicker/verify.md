# Verify — 0299-concurrency-notice-turn-end-flicker

## 메타

| 항목 | 값 |
|---|---|
| slug | `0299-concurrency-notice-turn-end-flicker` |
| 검증자 | Claude Code |
| 일자 | 2026-11-08 |
| 대상 커밋/range | `801e42f8..4c780d8f` (구현 `93b3e381` r1 · `4c780d8f` r1.2) — 브랜치 좌표, `main` 미병합 |
| 구현 전 plan 기준 | `801e42f8` (V1 `28cffb4a` · ΔV1 `75e1ab46` · ΔV2 `801e42f8`) |
| V mode / 유효 V | `V1 + ΔV1 + ΔV2` |
| 검증 기준 plan revision | `801e42f8:ΔV2` |
| 라운드 | 1 (verify 1회째) |
| 상태 | **FAIL** — 이행 결함 1건(문서 AC13), 나머지 pair PASS |
| 확장 창 | verify 1회째 — 창 안. 창이 다시 열린 노드: ΔV2 NEW·CHANGED(R-04·MD-07·MD-08 등)는 이번이 첫 verify |
| 독립 축(⑥) | 3축 — ① post-turn 계상 인자 3자리 변이(X-first·X-cont·X-listen, 구현 목록 밖) ② 문서 산출물의 렌더 파서 검증(mdast GFM) ③ 298 가드·CI 실행 결과 대조 |
| 열거 sweep(⑦) | 1회째 전수 — §10 자리 E0~E3·P1~P3·T1~T4·A1·N1~N3·I1·S1~S6·C1 중 변이 24건(자리별 제거/맞바꿈) · 못 잡음 0 · 경계 1 |
| 발견 분류 | 이행 1 · 현재 0 · 확장 0 · 경계 1 · 비귀속 2 |
| 구현 주체·문맥 | Codex 구현. 설계자 = 검증자(Claude)라 plan validity는 자기 설계 감사다 — 독립 축으로 보완 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: 메타 상태 줄 1곳과 `[구현자 기입]` 영역만. `git diff 801e42f8..HEAD -- plan.md` 헝크 2개(`@@ -8` 메타 · `@@ -590` 구현자 기입 이후).
- 기준선이 diff로 성립하는가: 예(`801e42f8` 설계 커밋이 구현과 분리).
- Decision Ledger·Product/UX·AC·V node/pair·§10 변경: 없음. 채점은 `801e42f8` 원문 기준.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode·상속 기준 | 유효 | ΔV2가 V1·ΔV1 커밋을 명시, §7-B 유효 registry에서 재구성 가능 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | R-04·MD-07·MD-08·R-03 등 전부 pair 있음 |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | VP-01·02는 REQUIRED로 포함 |
| path·§10 자리 목록·oracle | 유효 | 아래 §6 — 검색 재실행 차집합 0 |
| 적대 증거 선택 이유 | 유효 | VP-14·15·16 |
| SUPERSEDED pair 이관 | 유효 | §7-A 표 |
| 운영 gate | 유효 | §7-C 표 |

root PLAN_GAP: 없음.

## 1. 기준 재현 (이번 턴 관측)

| gate | 관측 |
|---|---|
| `npm run lint` | error 0 · warning 2(`virtualization` 파일, 이번 diff 밖). lint 후 `git status` 변화 없음 |
| `npm run typecheck` | node·web·test 3분할 error 0 |
| 관련 vitest (sessions·chat·worktrees·app·renderer chat·pages·shared) | 550파일 중 38파일·115케이스 실패. **구현 전 `801e42f8` worktree에서 같은 범위를 돌린 실패 집합과 동일**(38파일 115케이스, 신규 0·해소 0). 111건이 `Could not locate the bindings file` — `app/AGENTS.md` ABI 기준선 서명 |
| `node scripts/check-test-budgets.mjs` | `17 real-git suites ok · all budget sites scaled` |
| `node scripts/check-doc-inventory.mjs --check` · migrations 가드 | 통과 · 통과 |
| `node --test scripts/test-pools.test.mjs scripts/check-test-budgets.test.mjs` | 681 pass · 0 fail |
| CI run 1021 (Windows, `4c780d8f`) | **success**. r1 `93b3e381`은 run 1020 failure(`no-stray-auth-subscribe` 전역 가드 — `onChange` 선언) → r1.2가 닫음 |

못 본 것: 이 샌드박스는 electron 바이너리가 없어 `send.agent-profile` 등 `send.*` 테스트가 변경 전·후 모두 import 단계에서 실패한다. 이 파일들의 unit 풀 통과는 로컬 관측이 아니라 CI run 1021의 관측이다.

## 2. 298 CI 규칙 준수 (사용자 추가 요청)

| 298 규칙(출처 `app/AGENTS.md`) | 판정 | 관측 |
|---|---|---|
| 새 테스트는 unit/io 풀 분류가 맞다 | ✅ | `classifyTestSource`로 변경·신규 테스트 25파일 분류: 신규 9개 전부 unit, 신호 없음. 기존 io(sqlite·git-fixture)는 그대로 io |
| unit에서 자식 프로세스·SQLite를 쓰지 않는다 | ✅ | 신규·수정 테스트 diff에서 `child_process`·`runGit`·`temp-repo`·`git config`·타이머 grep 0건. CI unit 가드 통과(run 1021) |
| 시간 예산 — `scaledBudget`/`scaleMs`, 인라인 타임아웃 금지 | ✅ | 예산 가드 통과, 새 파일에 타이머 자리 0 |
| hermetic — 테스트가 홈·git 전역 설정을 보지 않는다 | ✅ | 새 테스트에 홈·env·git 설정 접근 없음. 전송 테스트 6개는 `probeRepo`를 mock해 환경 git 조회 제거 |
| exe 감소 — git 호출을 늘리지 않는다 | ✅ | r1.2가 `send.*` 5파일에 `probeRepo` mock 추가. 신규 git 실행 0 |
| `FORCED_IO`는 깨진 파일만 올린다(`test-pools.mjs` 주석) | ✅ (비귀속 메모 있음) | `send.agent-profile.test.ts` 제거는 규칙 취지(해결되면 내린다)와 일치, CI unit 가드 green. 풀 이동 자체는 이 샌드박스에서 관측 불가(변경 전 io에서도 같은 electron 오류) → CI 증거 |

비귀속 메모(0298 설계자 몫): 0298 plan VP-01 `forced 목록`은 `send.agent-profile`·`loopback-callback` 2건을 열거 원문으로 적는다(`0298 plan.md:196`). 0299 r1.2가 1건을 제거하고 고정 테스트를 바꿨다 — 0299 plan §18 범위 밖의 0298 게이트 수정이다. 게이트는 green이고 가드 목적에 부합하므로 0299를 막지 않는다. 0298 설계 턴이 VP-01 forced N을 2→1로 정정해야 한다.

## 3. Product & UX / ACTIVE Decision ↔ production path

| Decision / 요구 | 구현 | 판정 |
|---|---|---|
| D-009 신원 목록·`count` 제거 | `ipc.ts` `ConcurrencyEvent.turns` · tracker `begin/confirm/end/turns` · `rg "useProjectConcurrencyCount\|increment(\|decrement("` 프로덕션 0건 | ✅ |
| D-008 순서 무관 | ST-02 전수 인터리빙 + AS-IS 공식 음성 대조(`order.test.ts:92-156`, P1·W1 오탐 >0 단언) | ✅ |
| D-006 listen 비계상 | `turn-coordinator.ts` `countsAsActive` 유지, X-listen 변이 red | ✅ |
| D-011 응답 중일 때만 | 목록은 응답 중 항목만, 열려 있기만 한 세션은 항목 없음 | ✅ |
| D-012 (a)(b)(c) | S5 `displayedSessionIsolated`·E3 `isolated ? null` · P1c/S6 | ✅ |
| D-010 철회 | 코드에 같은 세션 다른 창 분기 없음 | ✅ |

## 4. 고장 이력 (이번 턴 시도 전부)

원복 확인: 모든 파일 원문 그대로, `git status` clean. oracle = §10 좌표 11개 파일 묶음(334케이스).

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 분류 |
|---|---|---|---|---|---|
| E0 | `turn-coordinator.ts` begin | 빈 값 | ref를 `{null,null}`로 | 잡음(7 fail) | — |
| E1 | 같은 파일 confirm | 제거 | `confirm` 호출 삭제 | 잡음(1) | — |
| E2 | 같은 파일 finally | 제거 | `end` 삭제 | 잡음(9) | — |
| E3 | `send.ts:710` | 다른 값 | 항상 `boundProjectId` | 잡음(2) | — |
| P1d·P1c·P1m | `prepare-worktree.ts` | 다른 값 | `isolated` 세 분기 각각 뒤집기 | 잡음(3·2·3) | — |
| P3 | `service.ts` | 뒤집기 | `!== null` → `=== null` | 잡음(1) | — |
| S1 | `chatStore.ts` 핸들러 | 빈 값 | `turns` 대신 `[]` | 잡음(8) | — |
| S2·S3 | `send`·`startHandoff` 엔트리 | 제거 | `clientKey: draftKey` 삭제 | 잡음(3·2) | — |
| S5 | `otherProjectTurnCount` | 제거 | 격리 조기 반환 삭제 | 잡음(6) | — |
| S6 | `chatReducer.ts` | 빈 값 | `{}` | 잡음(2) | — |
| C1 | `Composer.tsx` | 호출 대체 | AS-IS 산술 복귀 | 잡음(2) | — |
| N1·N2or·N2swap·I1 | `concurrencyNotice.ts` | 제거/뒤집기/맞바꿈(`clientKey`↔`sessionId`) | 각각 | 잡음(9·16·6·6) | — |
| T1·T2 | `active-turn-tracker.ts` | 제거 | 중복 begin 가드·confirm 가드 | 잡음(1·1) | — |
| A1 | `active-turn-ref.ts` | 뒤집기 | `isNewSession` 조건 제거 | 잡음(1) | — |
| X-first·X-cont·X-listen | `post-turn.ts` | 다른 값 | 세 `coordinator.run` 인자를 `null`로 | 잡음(4·1·1) | — |
| B2 | `bootstrap.ts` | 빈 값 | `broadcastConcurrency({…turns: []})` | 못 잡음 | **경계** — plan §10 B-2 선언 경계(electron import로 vitest 불가), AC14가 덮음 |
| G-mock | `send.agent-profile.test.ts` mock 삭제 | 제거 | 로컬 환경 | 무효 | 샌드박스에서 변이 전·후 모두 electron import 실패 — 판정 불가, CI 증거로 대체 |

변이 25건 중 잡음 23 · 경계 1 · 무효 1. 못 잡음(이행·현재 결함) 0. 구현자 r1 77건·r1.2 증거(`evidence/`)는 재실행 대상이 아니고 독립 축으로 대체했다.

## 5. V-pair closeout (UT → IT → ST → AT)

| Pair | 판정 | 좌표·근거 |
|---|---|---|
| VP-17 (T1~T4) | PASS | `active-turn-tracker.test.ts` — T1·T2 변이 red |
| VP-19 (A1) | PASS | `active-turn-ref.test.ts` — A1 변이 red |
| VP-18·21 (N1~N3·I1) | PASS | `concurrencyNotice.test.ts` — N1·N2or·N2swap·I1 red |
| VP-22 (P1~P3) | PASS | `prepare-worktree.test.ts`·`service.test.ts` — P1×3·P3 red |
| VP-15 (E0~E3) | PASS | `concurrency-identity.test.ts`·`send.worktree.test.ts`·`turn-coordinator.test.ts` — E0~E3 red + X 3자리 red |
| VP-16 (S1~S6·C1) | PASS | `chatStore.concurrency.test.ts`·`chatReducer.worktreeIsolation.test.ts`·`Composer.concurrency.test.ts` — S1·S2·S3·S5·S6·C1 red. S4(엔트리 객체 이동)는 코드 변경 없는 운반 자리이고 S2·S3 변이 red가 승격 뒤 일치를 관측 |
| VP-14 (SD-1·SD-2) | PASS | `chatStore.concurrency.order.test.ts` 전수 인터리빙 + AS-IS 음성 대조 |
| VP-01~03·20 | PASS(기계 범위) | ST-02 P·O·W 경로. 페인트·실제 IPC는 AC14 사람 실기(B-1·B-2) |

§10 자리 검색 재실행: E0~E2 `activeTurns.(begin|confirm|end)` 프로덕션 3건 + E3 `sharedPathProjectId` 전달 자리 — 목록과 차집합 0. N1~N3·I1 `^export function` 4건 일치.

## 6. 발견

| # | 이슈 | 출처 | 분류 | disposition |
|---|---|---|---|---|
| D1 | `docs/IPC_CONTRACT.md:473` 표 셀의 `string \| null`에 이스케이프 없는 `\|` 2개 — 헤더 5열 표의 해당 행이 mdast GFM 파싱에서 **7셀**(`remark` 계열 파서로 재현). GFM 규격상 초과 셀은 렌더에서 버려지고, 버려지는 뒤쪽 셀에 AC13이 요구한 "보고 있는 세션은 신원으로 제외 · 격리 세션의 응답은 목록에 넣지 않는다" 서술이 들어 있다. 같은 문서는 `\|`를 25곳에서 이스케이프하는 관례다 | AC13("서술한다") · VP 없음(문서 AC) | **이행 결함** | **BLOCKING** |
| D2 | 0298 plan VP-01 `forced 목록` 2건 열거 원문과 r1.2 제거(`send.agent-profile`)가 어긋난다 | 0298 `plan.md:196` | 비귀속 | NEXT_HANDOFF(독립) — 0298 설계 턴 |
| D3 | lint warning 2(`react-hooks/incompatible-library`) | 이번 diff 밖 | 비귀속 | NON_BLOCKING |

수정 지침(D1): `ConcurrencyEvent` 행의 `string | null`을 `string \| null`로 이스케이프하고 파서로 행 셀 수 5를 확인한다. 같은 변경이 `runtime-ipc.md`(3열 표, 셀 수 3 — 이상 없음)에는 필요 없다.

## 7. repository operation checks

- INDEX: 상태 `IMPL_DONE`·다음 주체 하나(Claude)·비고 2줄(`<br>` 2개)로 정상. 이번 verify가 갱신한다.
- 대상 커밋: 구현자가 자리표시자로 남겼고, `git cat-file -t` 확인 — `93b3e381`·`4c780d8f` 모두 commit. `main` 조상 아님 → 브랜치 좌표, `main` 병합 뒤 교정.
- trailer: `git log --format='%(trailers:only=true)'`가 두 구현 커밋에서 `Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met: 17/18`·`Criteria-Pending`·`Verified-By: pending`을 돌려준다.
- `[구현자 기입]` 일곱 필드: r1·r1.2 각각 모두 존재(`plan.md:591-789`·`797-997`). 합계 ✅17·⚠️1·❌0 = 18, 본문·trailer 일치.
- 사람 실기: AC14(OpenCode·Claude 격리 2건 포함)는 이 환경에서 불가 — 사람 몫.

## Review Signals — 사실만

- 이전 라운드와 같은 증상: 없음(첫 verify).
- 구현 r1이 CI에서 실패(run 1020, 전역 가드 `onChange` 선언)했고 r1.2에서 닫았다 — 로컬 vitest에는 `no-stray-auth-subscribe`가 있었으나 구현자 r1 보고 시점의 gate 목록에 없었다.
- 독립 축 ⑥ 발견: 3축 중 1건(문서 렌더, D1) 이행 결함, 1건(0298 열거 충돌, D2) 비귀속.
- 반복 환경 한계: 샌드박스 electron 미설치로 `send.*` 테스트 로컬 관측 불가(CI로 대체).
