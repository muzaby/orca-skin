# Verify — 0315-supplementary-bloat-audit

## 메타

| 항목 | 값 |
|---|---|
| slug | `0315-supplementary-bloat-audit` |
| 검증자 | Claude Code (설계자 = 구현자 = 검증자 — plan validity는 자기 설계 감사다) |
| 일자 | 2026-11-12 |
| 대상 커밋/range | `c1af29f..f5d93fc` (P1 `57daa44` · P2~P4 `f5d93fc`) |
| 구현 전 plan 기준 | `f5c85b4` (V1 rev.2 규범 행 정정 커밋) |
| V mode / 유효 V | `Baseline V` / `V1 rev.2` |
| 라운드 | 1 |
| 상태 | **PASS** (기계 범위 — AC10은 사람) |
| 확장 창 | verify 1회째 — 창 안. ΔV로 다시 열린 노드 없음 |
| 독립 축(⑥) | 2축·시도 2 — (a) A4·A5 3줄 창 중복 블록 독립 탐색(자리 2건 → 둘 다 audit.md O-5·A4 근거에 있음) (b) A1·A2·A3·A6의 4줄 창 중복 블록 독립 탐색(자리 4군 → 전부 B-03·B-04·B-05·B-09에 이미 있음). 새 후보 0 |
| 열거 sweep(⑦) | 1회째 — 데이터·표식 변이 14(D1~D9 + 승인 4종) 전부 red · 판정 민감도 1(D9) · 규칙 칸 분기·`red()` 51줄·EP-02·06·08 변이는 구현자 UT 보고분을 재실행하지 않았다(아래 못 본 것) |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 2 · 비귀속 0 |
| 구현 주체·문맥 | 기록만 — 설계자와 구현자가 같은 에이전트라 plan validity는 자기 설계 감사다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 plan을 바꿨는가: `[구현자 기입]` 절 추가(+110줄)와 "(impl 턴에서 채운다)" 자리표시자 1행 삭제뿐이다. `git diff f5c85b4 HEAD -- plan.md`의 삭제 줄은 그 1행이고 Decision·AC·V·§10 행은 불변이다.
- 기준선이 diff로 성립하는가: 예(`f5c85b4`).
- 채점 기준: plan 원문 AC1~AC11 · §10 EP-01~09 · D-015.
- 창 밖 ΔV: 해당 없음.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 신규 handoff, 상속 V 없음 |
| NEW node ↔ REQUIRED pair | 유효 | R-01~05 ↔ VP-01~05 · AR-01 ↔ VP-05 · MD-01~03 ↔ VP-06~08 |
| INHERITED ↔ REGRESSION | 해당 없음 | INHERITED 없음 |
| pair별 path·§10 자리 목록·oracle | 유효 | `node …/check.mjs --units \| wc -l` → 136(재실행) · 구간별 20·1·33·25·25·32는 `--check` 단위 집계와 일치 · `grep -c '^<!-- gen:' audit.md` → 5 |
| 선택 적대 증거 | 유효 | VP-02·03·05에 변이 명시 — 아래 고장 이력이 재실행 |
| SUPERSEDED 이관 | 해당 없음 | node가 아니라 Decision(D-010·D-012 → D-015)만 대체 |
| 운영 gate 범위 | 유효 | 5개, `app` gate 없음(§19) |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 결과 | 실제 |
|---|---|---|
| D-001 · AC8 | `app`·`.github` 무변경 | `git diff --stat c1af29f..HEAD -- app .github` → 0줄 |
| D-005 | 후보 전제 3칸 필수 | 후보 10 × 3 = 30칸 — K5 red 조건 재현(D4) |
| D-006 · AC6 | 테스트·script·CI·mock 자리 제외 | D5(자리를 `map.test.ts`로) → `RED K4` |
| D-008 · D-015 | 통과 정의 · 두 축 판정 | `--ruling` 출력 아래 §ruling |
| D-014 | `remove`는 승인 목록 | B-02·B-07 승인 표, D-승인 변이 3종 red |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | 없음 | `--check`가 `위반 0 · 대기 0`을 내지만 판정 정당성은 아래 재현 |
| 부분 실패 | 해당 없음 | 일회 실행 문서 |
| 낙관 전제 | 보수 쪽 | B-02 `agentsRule`을 `blocks`로 둠(plan §9 범위 밖 근거 — 아래 경계 1), B-03·B-04 `ui: risk` |
| 판정 민감도 | 낮음 — 구조상 견고 | 통과 7건 전부 prod 20줄 이하. 30줄 경계에 걸린 후보 0, 25~34줄 구간 후보 0(선언 경계 3 재계산 불필요) |

## 3. VP-02 — 통과 후보 전부의 전제 근거 재실행

각 후보의 근거 명령을 `c1af29f` 트리(= `app` 무변경이라 HEAD와 동일)에서 다시 돌렸다.

| 후보 | 재현한 관측 | 결과 |
|---|---|---|
| B-01 | `chatReducer.ts:168-169` `withoutId` 정의와 1121-1126 두 식이 글자 단위로 같은 판정(읽음) · `grep withoutId` 테스트·script·eslint → 0 · AGENTS·docs → 0 | 일치 |
| B-05 | `chatStore.ts:945-957` turn.aborted·error 본문 3문장 동일(읽음) · eslint `no-fallthrough\|default-case\|switch-exhaustiveness` → 0 | 일치 |
| B-06 | `776-779`·`855-858`이 `default`(981-982)와 같은 한 문장(읽음) | 일치 |
| B-07 | `git grep -n taskToolRunIds c1af29f -- app/src` → `map.ts` 117·613·614 3줄(읽는 곳 0) · 테스트·script grep → 0 | 일치 |
| B-08 | `fileEditToolRunIds`·`toolNames` 쓰기는 `map.ts:608-619` 한 블록뿐, 삭제 지점 0(`git grep`) · `carriesFileEditPatch(name) = name === 'Edit'`(`shared/file-edit-tool.ts:23`) | 일치 — 같은 id를 다른 이름으로 재사용하는 경우만 차이가 나고 호출 계약 밖 |
| B-09 | 타입 리터럴 779-809·913-934의 `usage`·`modelUsage` 구간 동일(읽음) · `normalizeResultTelemetry` 테스트 참조 0 | 일치 |
| B-10 | `map.ts:504-523` text_delta·thinking_delta 조립이 type·읽는 필드만 다름(읽음) | 일치 |

통과하지 못한 후보 3건 중 B-02는 `0309 plan.md:56` D-012(ACTIVE)가 "renderer no-op 두 자리를 `chatStore.schedules.test.ts:202`가 잠근 방어로 유지"를 확인했다. B-03·B-04 `ui: risk`는 `preserveLocalState`·`message.queued` 갱신 분기를 지나는 테스트 부재라는 주장이며 구간 grep으로 재확인하지는 못했다(못 본 것).

## 4. VP-03 — L6 `none` 단위 5개 짝 검색 재실행

무작위(seed 315)로 뽑은 5개를 `git grep -F`로 재실행: `A5/settleExpired` 같은 파일 3줄 ✓ · `A3/turn.ended` 같은 파일 2줄 ✓ · `A1/session.schedules` reducer 1줄·store 1줄 ✓(B-02 소속과 일치) · `A4/commands` 같은 파일 12줄 ✓ · `A4/choices` 인터페이스 멤버 1건 ✓. 5/5 일치.

## 5. gate 실행

| Gate | 명령 | 관측 |
|---|---|---|
| 감사 검사 | `node …/scan/check.mjs --check` | `단위 136 · 후보 10 · 위반 0 · 대기 0` |
| 검사기 테스트 | `node --test …/scan/*.test.mjs` | tests 97 · pass 97 · fail 0 |
| 문서 가드 | `cd app && node scripts/check-doc-inventory.mjs --check` | generated ok · prose ok · `links ok` |
| 무변경 | `git diff --stat c1af29f..HEAD -- app .github` | 0줄 |
| trailer | `git log -1 --format='%(trailers:only=true)'` (`f5d93fc`·`57daa44`) | 두 커밋 모두 `Agent`·`Handoff`·`Status`·`Criteria-*`·`Verified-By` 파싱 |

- 작업 트리: 변이 실행 뒤 `audit.json`·`audit.md`를 원복했고 `cmp`가 `restored`, `git status`가 clean이다.

## 6. 고장 이력

| ID | 대상 | 종류 | 바꾼 내용 | 결과 | 잡은 것 | 분류 |
|---|---|---|---|---|---|---|
| V1 | `audit.json` areas A4 | 제거 | `X8` 칸 삭제 | 잡음 | `RED K1` | — |
| V2 | `units[5]` | 제거 | 단위 1행 삭제 | 잡음 | `RED K2 단위 누락 A1/response.boundary` | — |
| V3 | `units` | 다른 값 | 없는 단위 `ghost` 추가 | 잡음 | `RED K2 추출되지 않은 단위` | — |
| V4 | B-05 premises | 제거 | `formLock` 삭제 | 잡음 | `RED K5` | — |
| V5 | B-07 sites[0] | 다른 값 | `map.test.ts:10` | 잡음 | `RED K4` | — |
| V6 | A1.X1 | 다른 값 | 유령 ID `B-99` | 잡음 | `RED K7` | — |
| V7 | `audit.md` ruling 블록 | 다른 값 | `1건` → `2건` | 잡음 | `RED K10` | — |
| V8 | `audit.md` | 제거 | ruling 표식 삭제 | 잡음 | `RED K10` · `RED K9` | — |
| V9 | B-01 `raceGuard` | 뒤집기 | `blocks` | 잡음 | `--ruling` P 7→6 · H 4→3, 판정 불변 | — |
| V10 | `audit.md` 승인 표 | 맞바꿈 | B-07 행 이름 변경 | 잡음 | `RED K9` · `RED K10` | — |
| V11 | B-07 `approval` | 제거 | 키 삭제 | 잡음 | `RED K9` | — |
| V12 | B-01 `hotEntry` | 다른 값 | `send` | 잡음 | `RED K8` | — |
| V13 | B-01 `saving.prod` | 다른 값 | 0 | 잡음 | `RED K8` | — |
| V14 | 최상위 | 추가 | 키 `x` | 잡음 | `RED K10` | — |

- 직전 고장 이력: 없음(verify 0회) — 하한 ③·④ 해당 없음.
- 하한 ① pair 등록 변이 D1~D9 = V1~V9 재현. ② 닫는 파생 이슈 없음. ⑤ 형제 슬롯 맞바꿈: V10(승인 표 행 이름). ⑥ 위 메타. ⑦ 일부(아래).

## 7. 판정 — 중단 규칙 (`--ruling` 출력 인용)

`node …/scan/check.mjs --ruling` → `impl: 1건` · `wideAudit: 연다` · `reasons: [W1]` · `bundles: [{area: null, ids: B-01 B-05 B-06 B-07 B-08 B-09 B-10}]` · `P`: B-01(4)·B-05(5)·B-06(8)·B-07(10)·B-08(6)·B-09(20)·B-10(6) · `H`: B-01(4)·B-05(5)·B-06(8)·B-10(6).

- **구현 건수 1건**: 통과 후보가 모두 30줄 미만(최대 B-09 20줄).
- **넓은 감사 연다**: W1 — 핫패스 L6 통과 후보 4건. 이 판정은 H 중 하나만 맞아도 성립한다(V9: B-01을 빼도 H 3건 · 판정 동일).
- 재현 뒤에도 판정 입력이 흔들리지 않는 이유: 30줄 이상 후보가 나오려면 최대 20줄 추정이 1.5배 이상 틀려야 하고, 막힌 B-02(8)·B-03(2)·B-04(10)이 통과로 바뀌어도 모두 30줄 미만이다.
- G4: 구현 1건 + 넓은 감사 (plan §10 G4 행). 후속 handoff는 이번 턴이 만들지 않는다(plan §5) — 사용자 확인(AC10) 뒤 다음 설계 턴.

## 8. V-pair closeout

| Pair | 결과 | 직접 oracle 좌표 · 범위 |
|---|---|---|
| VP-01 | PASS | `gate: check.mjs --check`(66칸 K1 · 136단위 K2) · V1~V3 |
| VP-02 | PASS | 같은 gate(K3~K9) · V4~V6 · V11~V13 · §3 근거 재현 7/7 |
| VP-03 | PASS(기계 범위) | `check.test.mjs` UT-03 · `--ruling` · V9 · §4 5/5 · AC10은 사람 |
| VP-04 | PASS | `git diff --stat` 0줄 |
| VP-05 | PASS | `--check` K10 · V7·V8·V10·V14 · `grep -c '^<!-- gen:'` → 5 |
| VP-06 | PASS | `check.test.mjs` "UT-01 P1"~"U7"(97건 안) |
| VP-07 | PASS | `check.test.mjs` "UT-02 red …" |
| VP-08 | PASS | `check.test.mjs` "UT-03 …" |

VP-06~08은 `node --test` 97/97 통과와 구현자 sweep 보고를 근거로 하고 `check.mjs`의 `red()` 51줄·EP-02·06 제거 변이는 이번 턴에 다시 심지 않았다 — 아래 못 본 것.

## 9. repository operation checks

- INDEX 행: `IMPL_DONE` → 이번 턴에 `verify/PASS`(기계 범위)로 갱신. 비고 5줄 이내.
- 대상 커밋 좌표: `57daa44`(P1) · `f5d93fc`(P2~P4)를 `git cat-file -t`로 commit 확인, `c1af29f`·`f5c85b4`·`9c5811c`도 commit. 이 환경에는 `origin/main` ref가 없어 `main` 조상 여부는 확인하지 못했다 — `git merge-base --is-ancestor c1af29f origin/ccr-1ed0459c-8aznf6`는 성공(PR 브랜치 좌표, `main` 병합 뒤 교정).
- `[구현자 기입]` 7필드(설계 리뷰·강제 지점 전수·잠금(sweep 포함)·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals): 7/7 있음. 강제 지점 표 9행은 EP-01~09 전부를 담는다.
- 합계: 구현 보고 `✅ 10 · ⚠️ 1 · ❌ 0 = 11`, 커밋 trailer `Criteria-Met: 10/11` · 본문 일치.
- `AGENTS.md` 변경 없음.
- 커밋 `Co-Authored-By` 모델명 표기 등 trailer 형식은 허용값 밖 키 없음.

## 10. 발견 목록

| # | 내용 | 분류 | disposition |
|---|---|---|---|
| 1 | `agentsRule` 근거 범위가 plan §9에서 handoff Decision을 포함하지 않는다 — B-02를 구현자가 보수적으로 `blocks`로 둠. 구현자 제안(plan 수정)은 판정에 영향 없음(B-02 8줄·비핫패스) | 경계 — 선언 경계 2(전제 판정은 감사자 판단) | 판정 영향 없음. 후속 감사가 이 범위를 쓰면 plan에서 정한다 |
| 2 | L6 `none` 단위의 근거 검색 키가 plan §8의 "판정 주어·필드 이름"이 아니라 단위 이름 일괄이다(구현자 보고 #3) | 경계 — 선언 경계 1(하한) | 표본 5/5와 독립 중복 탐색 6군이 모두 기존 후보·관찰에 있음 → 판정 영향 없음 |

## 11. 못 본 것

- `check.mjs`의 `red('K…')` 51줄·EP-02 패턴·EP-06 판정 조건에 대한 구현자 변이(80건)는 재실행하지 않았다. 대신 `node --test` 97/97과 데이터 변이 14건 red를 근거로 삼았다.
- B-03·B-04의 `ui: risk` 주장(해당 분기를 지나는 테스트 없음)은 grep으로 다시 세지 않았다. 두 후보가 통과로 바뀌어도 판정은 같다.
- 후보의 감량 `saving.prod` 줄 수는 B-01·B-07·B-09만 읽어 확인했다. 30줄 경계에서 멀어 판정에 쓰이지 않는다.
- AC10(사용자가 판정과 후보를 보고 다음 handoff 여부를 정한다) — 사람.

## 12. Review Signals — 사실만

- 이전 라운드와 같은 증상: 없음(첫 verify).
- 관련 plan 지침/AC: 구현자 보고 #1은 plan §9 전제 표의 `agentsRule` 범위가 handoff Decision을 포함하지 않는다는 사실이다.
- 사용자 결정 변경 근거: D-015(턴 2)가 구현 전에 반영됐다.
- 반복된 검증 환경 한계: `origin/main` ref 부재로 `main` 조상 확인 불가.
- 독립 축(⑥) 발견: 2축·새 후보 0.
