# Verify — 0330-windows-responsiveness-verdict

## 판정 — verify 2회째: **RETURN_TO_PLAN** (WU-M 기계 범위)

창 안 확장 후보 2건이 `PLAN_GAP`이라 설계자가 먼저다. 이행·현재 결함(`BLOCKING`)은 0건이고, verify 1의 D1·D2는 닫혔다.

- **F4**(확장): 공백·비문자열 근거 좌표에 대한 잠금이 없다. `hasRef`를 `textValue` 대신 truthy 검사로 바꾼 변이 `V2.textValue-truthy`가 `windows-verdict.test.mjs`에서 green이었다. U39는 근거가 “없음(undefined)”인 경우만 준다.
- **F5**(확장): owners 행의 `task`·`owner`·`key`가 plan 셀과 맞지 않으면 그 행은 조용히 버려진다. 그래서 그 행의 `FAIL`이 사라지고 전체가 `합격`·exit 0이다(`verify2-axes.txt` `keyedUnknownCellFailNoRef`·`unknownTaskFailNoRef`). 트리에 없는 입력 형태라 현재 결함이 아니다.
- 그 밖은 PASS다.
  - 고장 153건 중 151건이 red다. 대조 1건(`V2.hold-order`)은 기대대로 green이고, 못 잡음은 F4 1건이다.
  - 독립 축 11건 중 9건이 W-038대로 판정됐다. 나머지 2건이 F5다.
  - 실제 Electron `--shell` 실행의 최종 기록이 `environment: linux-electron`이다. 자식은 이 값을 내지 않는다.
  - gate 차집합은 ∅다.

## 메타 (verify 2)

| 항목 | 값 |
|---|---|
| 회차 · 확장 창 | verify **2회째** — 창 안. 사용자 요구 변경 ΔV 없음. 다음 설계 턴(ΔV2)이 열거 원문을 늘릴 수 있는 마지막 턴이다 |
| 대상 | `99d4def2..8e3384e7`. 설계 기준 = V1 rev 7 + ΔV1(`99d4def2`). 구현 r2는 `40a545e4`(partial)·`8e3384e7`(implemented, `Agent: codex`). PR 브랜치 해시이며 `main` 미병합(`merge-base --is-ancestor` 실패) |
| 범위 | ΔV1 REQUIRED VP-10·VP-11·VP-14 · REGRESSION VP-08·09·13·15 · AC7·AC8. NOT_REQUIRED VP-12·16·17·18·19·R1은 r2 diff가 닿지 않음을 확인했다(app 변경 5파일: 판독기·그 시험·stage-d 시험·자식 2) |
| 환경 | Linux x64 · Node 22.23.5 · Electron 39.8.10 바이너리 · Xvfb. better-sqlite3 바인딩 없음(verify 1과 같은 403 한계) — host 시나리오 실측 불가, shell 시나리오는 실측함 |
| 독립 축(⑥) | 16건 — 예제 변형 11([`evidence/verify2-axes.txt`](evidence/verify2-axes.txt)) + 구현자 원장 밖 변이 5(`V2.ref-swap`·`V2.some-every`·`V2.ref-guard`·`V2.textValue-truthy`·`V2.hold-order`) |
| ⑦ 전수 잔여 | **0** — verify 1 잔여 S4는 W-037이 자리 자체를 없앴다(plan §20-C “고장 이력 처리”). 재앵커 S6 red |

## 0. 기준선 / plan 변경 확인 (verify 2)

- 구현 커밋의 plan diff는 메타 `상태` 1줄, `[구현자 기입]` r2 절 추가, `[검증자 기입]` D1·D2 `상태` 칸뿐이다(`git diff 99d4def2 8e3384e7 -- plan.md` hunk 3개). Decision·AC·§10·V는 그대로다. 채점 기준은 V1 rev 7 + ΔV1이다.
- **plan validity — gap 0**: P6′ 자리 검색을 다시 돌리면 28줄이다. 기대 목록(운반 24 + import 4)과 `diff`가 0줄이고, 자식 두 파일은 `environment|measurementEnvironment` 0줄이다. §10-C 환경 한계 문장은 W-037과 맞는다.

## 1~3. diff 비판 · 역방향 탐색 · end-to-end (verify 2)

| 대상 | 판정 · 관측 |
|---|---|
| 소유 열 판독 `windows-verdict.mjs:640-655` | ✅ `FAIL`이 근거와 무관하게 먼저 `ownerFailures`(참고 셀 제외)에 들어가고, 근거 없는 FAIL 행이 하나라도 있으면 hold 플래그를 세운다. `PASS`·`미완`은 근거 있는 행만 읽는다. 근거 판정은 `textValue`(공백·비문자열 = 없음)로 r1의 truthy 판정보다 좁아졌다 → 동작은 W-038과 맞지만 잠금 없음(F4) |
| hold 집계 `:672` · 전체 판정 `:676-677` | ✅ `소유 판정 근거 없음`이 `소유 판정 없음` 앞에 한 번 들어가고, `ownerFailures`가 있으면 `불합격`이 hold보다 우선한다(`failNoRefUnconfirmed` → `불합격`, holds 2개) |
| owners 행 대응 `:636-638` | ⚠️ `task`·`owner`·`key`가 plan 셀과 맞는 행만 읽는다. 맞지 않는 행은 `unexpected` 같은 보고 없이 버려진다 → F5(r1부터 있던 동작, 이번 diff 밖이지만 W-038 “FAIL 보존”의 주어에 닿는다) |
| 자식 기록 `electron-main.mjs`·`probe.ts` | ✅ `environment` 필드와 import만 지웠다. 러너는 자식 결과를 그대로 넘기고 `main`이 스탬프한다(`measure-stage-d.mjs:37`). `xvfb-run -a node scripts/measure-stage-d.mjs --shell` → exit 0 · `environment: linux-electron` · `tool`=`sha`=`8e3384e7` · `provenanceConflict` 없음 · `verdict: true` |
| 새 시험 | ✅ `child records carry no provenance of their own`은 production 원문을 직접 읽는다. `report CLI: owner FAIL without evidence still fails`는 실제 CLI 자식 프로세스를 띄운다. 로컬 재구현 0 |

## 4. 증거 재계수 — 하한 ①~⑦ (verify 2)

| # | 결과 |
|---|---|
| ① | ΔV1 등록 변이 — P5.8a·P5.8b·P6-child-host·P6-child-shell red. oracle은 이름 필터 없이 시험 파일 전체다 |
| ② | 닫는 D1의 인용 변이(S4·S5)는 W-037이 자리를 없앴다. 재앵커 S6(`measure-stage-d.mjs:37` 스탬프 호출 제거) red. 닫는 D2의 인용 입력 `ownerFailNoRef`는 `판정 보류` → `불합격`·`ownerFailures` 1·hold `소유 판정 근거 없음`. verify 1 축 나머지 18건은 출력이 바이트 단위로 같다 |
| ③ | verify 1 `못 잡음` S4·S5 → plan §20-C 근거로 닫음. 같은 실수는 S6·P6-child·P6-property·P6-import 6건이 red로 잡는다 |
| ④ | diff가 닿은 판독기·stage-d 파일과 oracle 파일(`windows-verdict.test.mjs`·`measure-stage-d.test.mjs`)의 verify 1 `잡음` 행을 다시 돌렸다. 구현자 r2 원장 136행(이전 100행 포함)은 136/136 red. oracle이 `measure-stage-d.test.mjs`인 E6·V5, 형제 맞바꿈 X5.1~4도 red. `red → green` 0 |
| ⑤ | 형제 맞바꿈 — `V2.ref-swap`(machine↔windows 근거 칸) red · X5.2(소유 두 열) red |
| ⑥ | 예제 변형 11건 + 원장 밖 변이 5건. 계약과 다른 결과는 F4(`V2.textValue-truthy` green)와 F5(`keyedUnknownCellFailNoRef`·`unknownTaskFailNoRef` 합격) |
| ⑦ | diff·ΔV1 항목 — P5 ⑧을 구현한 diff 자리마다 제거 변이를 심었다(`V2.a8-rm`·`V2.flag-rm`·`V2.hold-rm`·`V2.b8-rm`·`V2.fail-early-rm`) 5/5 red. P6′ 24자리는 원장 S·measurement 행으로 red. 잔여 0 |

고장 이력 전체는 [`evidence/verify2-mutations.tsv`](evidence/verify2-mutations.tsv)에 있다(153행, 원복 확인 출력 포함). 판정에 영향을 준 행만 적는다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 직전 결과 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|---|
| V2.textValue-truthy | `windows-verdict.mjs:642` | 호출 대체 | `textValue(row[kind+'Ref'])` → `row[kind+'Ref']` | — | 못 잡음 | — | 확장(F4) |
| V2.hold-order | `windows-verdict.mjs:672-673` | 뒤집기 | 두 hold push 순서 교환 | — | green(대조) | — | 경계 — hold 순서는 계약 아님 |
| V2.ref-guard | `windows-verdict.mjs:644-647` | 뒤집기 | 근거 플래그를 참고 셀 가드 밖으로 | — | 잡음 | U39(참고 셀) | — |
| V2.some-every | `windows-verdict.mjs:646` | 다른 값 | `some` → `every` | — | 잡음 | U39(형제 행) | — |
| S6 | `measure-stage-d.mjs:37` | 제거 | 스탬프 호출 제거 | 잡음(v1) | 잡음 | `non-comparison CLI…`·`provenance stamps…` | — |
| S4·S5 | (자리 없음) | — | — | 못 잡음(v1) | 닫힘 — §20-C | — | W-037 |

## 5. V-pair closeout (verify 2)

| Pair | 결과 | 직접 좌표 · 공유 증거 |
|---|---|---|
| VP-10 (UT, REQUIRED) | PASS | `windows-verdict.test.mjs:'U39 keeps owner failures…'` — 두 열 × 6입력 + 형제 행 + 참고 셀. P5.8a/b·V2.a8/flag/hold/b8/fail-early/ref-swap/some-every/ref-guard red. 공백 근거는 열거 밖 → F4 |
| VP-11 (UT, REQUIRED) | PASS | `measure-stage-d.test.mjs:'child records carry no provenance of their own'`(음성) · `'provenance stamps every scenario result'`(양성). P6-child·property·import ×2 red, S6 red, P6′ 28줄 일치 |
| VP-14 (AT, REQUIRED) | PASS | `windows-verdict.test.mjs:'report CLI: owner FAIL without evidence still fails'` — exit 1·`불합격`·`ownerFailures` `['T17/0326']`·hold 1·`typing.ownerMachine` `FAIL`. P5.8a red |
| VP-08·VP-09 (REGRESSION) | PASS | 판독기 시험 파일 25건 green, 원장 판독기 행 99/99 red |
| VP-13·VP-15 (REGRESSION) | PASS | `compare CLI…` green, S8a~e red. 0328 보관 쌍 `--compare` exit 0은 `compare CLI` 시험 안에서 재현 |
| VP-12·16·17·18·19·R1 | NOT_REQUIRED | r2가 닿지 않는다(위 메타). verify 1 §5 좌표가 그대로이고, 이번 `node --test scripts/*.test.mjs` 1153/1153과 vitest(아래)에서 해당 시험이 실패 목록에 없다 |
| VP-01~07 | 미착수(WU-W) | W-004 대기(W-018) |

AC 합계: AC7·AC8·AC9·AC10·AC11 ✅ · AC1~AC6 미착수 = 11. 구현자 합계 `✅ 5 · ⚠️ 6`과 같다.

## 8. 게이트 재실행 (마지막 수정 뒤 트리 `8e3384e7`)

| 단계 | 관측 |
|---|---|
| 가드 5종 | migrations·doc-inventory·product-naming·test-budgets·ui-thread 모두 exit 0 |
| lint · typecheck | error 0 · warning 12 · `error TS` 0. lint 뒤 `git status` 변화 0 |
| `node --test scripts/*.test.mjs` | 1153/1153. 대상 4파일은 25·18·4·9건 |
| 전체 `vitest run` | 61파일 실패 / 1,088 통과 · 테스트 421 실패. io 586줄·unit 20건(8파일 — claude/opencode adapter·composer)이며 바인딩 부재 서명 2,828줄. verify 1의 61파일·unit 20건과 같다. r2 diff는 `src`·테스트 설정 0줄이고, vitest 시험 중 변경 5파일을 import하는 것은 0개(`rg -l` 0)라 차집합 ∅ |
| `electron-vite build` · `smoke-preload` | exit 0 · OK(키 7). 일반 빌드 `__ooDev` 0파일 |
| `smoke-hosts` | 14줄 FAIL — verify 1과 같은 SQLite 바인딩 부재 서명. `src/main` 변경 0 → 기준선 |

## 9. Repository operation checks (verify 2)

- 구현 커밋 trailer 두 건이 파싱된다(`Agent: codex` · `Status: partial`/`implemented` · `Criteria-*` · `Verified-By: pending`). `git cat-file -t` → commit ×3(`99d4def2`·`40a545e4`·`8e3384e7`).
- `[구현자 기입]` r2 일곱 필드가 모두 있다. 강제 지점 표는 ΔV1 pair의 §10 자리 전부(P5 ⑧·P6′ 24)를 담는다.
- INDEX 대상 커밋의 `(ΔV1 설계 — 검증자 기입)`·`(r2 구현 — 검증자 기입)` 자리표시자를 이 커밋에서 채운다(PR 브랜치 해시, `main` 미병합).

## 13. Finding disposition (verify 2)

| # | 이슈 | 분류 | disposition |
|---|---|---|---|
| F4(D4) | 근거 좌표가 공백 문자열·비문자열이면 “없음”으로 읽는다(`textValue`). 이 동작을 잠그는 입력이 없어 truthy 판정으로 되돌려도 green이다. `wsRefFail`은 현재 `불합격`+hold, `numRefPass`는 `미기록`으로 계약대로 나온다 | 확장 — W-038 “근거 좌표가 없으면”이 공백을 덮는지 해석이 필요하다 | PLAN_GAP(창 안) — 채택(U39 입력 추가) 또는 경계 |
| F5(D5) | owners 행의 `task`·`owner`·`key`가 plan 셀과 하나도 맞지 않으면 무시된다. 그 행의 `FAIL`이 버려져 `합격`·exit 0이 된다 | 확장 — 트리에 없는 입력 형태. P5에 owners 행 대응 규칙이 없다 | PLAN_GAP(창 안) — fail-closed(exit 2 또는 `unexpected`+보류) 채택 또는 경계 |
| — | 구현자가 `[검증자 기입]` D1·D2 `상태` 칸에 `r2 해결`을 적었다 | 비귀속(운영) — 상태 확인은 이번 verify가 했다 | NON_BLOCKING |

### 발견 원장 — verify 2

| ID | disposition | 직전 상태 | 이번 결과 | 직전 기록 | 증거 |
|---|---|---|---|---|---|
| F1(D1) | PLAN_GAP | closed 보고 | 닫힘 | — | 새 실행 |
| F2(D2) | PLAN_GAP | closed 보고 | 닫힘 | — | 새 실행 |
| F4 | PLAN_GAP | — | 열림 | — | 새 실행 |
| F5 | PLAN_GAP | — | 열림 | — | 새 실행 |

F(2) = 2.

## 14. Review Signals (verify 2)

| 리뷰 필요 여부 | 근거 | 검토할 질문 |
|---|---|---|
| 불필요 | verify 2회째, 의무 트리거 없음. F4·F5는 확장이라 `직전 기록` `—` | — |

사실: F5의 동작은 r1부터 있었고 verify 1 독립 축은 owners 행 삭제·근거 삭제만 시도했다. 반복된 환경 한계는 SQLite 바인딩 403(host 시나리오 실측 불가)이다. 독립 축에서 나온 발견은 2건이고 둘 다 확장이다.

## 15. 결론 (verify 2)

`RETURN_TO_PLAN` — 다음 주체는 설계자다. 라운드는 3이 된다.

- **F4**: 공백·비문자열 근거를 “없음”으로 잠글지(U39 입력 추가), 경계로 둘지 정한다.
- **F5**: plan 셀과 맞지 않는 owners 행을 어떻게 다룰지 정한다. 특히 그 행이 `FAIL`일 때다.
- 이번 ΔV2가 열거 원문을 늘릴 수 있는 마지막 설계 턴이다. 경계만 선언하고 새 의무가 0이면 구현 턴 없이 verify 3으로 갈 수 있다.

---

## 판정 — verify 1회째: **RETURN_TO_PLAN** (WU-M 기계 범위)

`PLAN_GAP` 2건 때문에 설계자가 먼저다. 구현 결함(`BLOCKING`)은 0건이다.

- **F1**: plan §10-C는 “VP-08~17 좌표는 전부 Electron 없이 도는 `node --test`”라고 적는다. 하지만 P6 S4·S5(Electron 생산자의 `environment`)는 `node --test`로 잠기지 않는다. 변이 S4·S5가 두 시험 파일에서 green이었다. 이 자리는 커밋되지 않은 Electron 하네스로만 잠긴다.
- **F2**(확장 후보, 창 안): 근거 좌표(`machineRef`·`windowsRef`)가 없는 소유자 `FAIL` 행은 보고서에서 `미기록`이 되고 `ownerFailures`가 0이다. 그래서 전체 판정이 `불합격`이 아니라 `판정 보류`로 나온다.
- 그 밖에는 모두 PASS다.
  - 고장 145건 중 열거 원문 대상 144건에서 143건이 red다(oracle을 정정한 E6·V5와 Electron 하네스로 돌린 S5 포함). S4 1건은 이 환경에서 실행하지 못했고, R3.0은 열거 밖이다.
  - 형제 맞바꿈 4/4가 red다.
  - 독립 축 19건이 모두 계약대로 판정됐다.
  - gate 차집합은 ∅다.

## 메타

| 항목 | 값 |
|---|---|
| 회차 · 확장 창 | verify **1회째** — 창 안. 사용자 요구 변경 ΔV 없음 |
| 대상 | `a8bbe99a..f5ce4ca9`. 설계 기준 = V1 rev 7(`a8bbe99a`). 구현은 `ae27c4f7`(Status partial)과 `f5ce4ca9`(implemented, `Agent: codex`)다. 둘 다 PR #655 브랜치 해시이며 `main` 미병합 |
| 범위 | WU-M 기계 pair VP-08~19·VP-R1, AC7~AC11. WU-W(VP-01~07·AC1~AC6)는 W-018대로 `미착수(WU-W)`이고 pair 결과를 주지 않는다 |
| 환경 | Linux x64 · Node 22.22.1. node_modules는 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts`로 설치했다. Electron 39.8.10 바이너리는 `install.js`로 설치됐다. better-sqlite3 바인딩은 없다 — Electron 헤더가 `electronjs.org:443` 403으로 막혔다 |
| 독립 축(⑥) | 23건 — 예제 변형 19([`evidence/verify1-axes.txt`](evidence/verify1-axes.txt)) + 형제 맞바꿈 4 |
| ⑦ 전수 잔여 | **1건 — S4**(`stage-d-host/electron-main.mjs:87`). 호스트 생산자가 Electron ABI SQLite를 요구하는데 이 환경에서 빌드할 수 없다(위 403). 다음 verify의 ⑦ 범위로 넘긴다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 plan 규범 절 diff는 메타 `상태` 1줄뿐이다(`[구현자 기입]` 표지 위 597줄을 대조). Decision·AC·§10·V는 바뀌지 않았다. 채점 기준은 V1 rev 7이다.
- **plan validity — gap 1건(F1)**: §10-C “환경 한계”가 VP-08~17 좌표를 전부 `node --test`라고 단정한다. 그런데 P6 S4·S5 자리의 `실패 의미`(생산자 기록의 환경 누락)는 상위 CLI가 출처를 덧붙이므로 `node --test`에서 관측되지 않는다(아래 고장 이력 S4·S5). 이 자리를 닫는 좌표 종류가 plan 안에서 정해지지 않았다.

## 1~3. diff 비판 · 역방향 탐색 · end-to-end

| 대상 | 판정 · 관측 |
|---|---|
| 판독기 `windows-verdict.mjs` 전체 판정(`:594-672`) | ✅ 위반·소유 FAIL → `불합격`, 그 밖의 보류 → `판정 보류`, 확정이 `불합격`을 바꾸지 않음. 단 근거 없는 `FAIL` 행은 `column()`(`:640`)이 `undefined`로 읽어 `미기록`이 된다 → **F2** |
| 원본 대조(`:87-210`) | ✅ 같은 run의 `runRef` 대조(`:186-191`, W-036), `profileRef`만 있으면 수집 실패, 선택 표시가 구간 안·대상 표시가 그 뒤(`markerSample`), 다른 행 강조 → `failed`. 관측 값 ↔ 표시 시각 차이는 대조하지 않는다 → 경계(F3) |
| 측정 도구 출처(`stage-d/measurement.mjs:16-72`) | ✅ 고정 SHA 대조(diff 0·미추적 0), 전체 40자 SHA만 허용, 기준선과 `--app-source`의 오류 문구 구분, `stampProvenance` 충돌 표식. `linux-electron` 리터럴은 도구 안에서 `measurement.mjs:9` 한 곳 |
| 렌더러(`ChatTile.tsx:150` → `TranscriptView` `{...props}` → 두 `Timeline` 루트) | ✅ `sessionId`·`messages`가 같은 슬롯에서 나온다(`chatStore.ts:3119-3121`). 검색 보기 `view.messages`도 같은 세션 슬롯이다(`TranscriptView.tsx:14-27`). 화면 동작 변화 0 |
| 진단 스크립트 `visibility-marks.js` | ✅ 소유 세션·`expectText`·높이·뷰포트·강조, 입력 = `click`·`Enter`, 600프레임 사유 두 종, `opId` 중복 거부 |
| 일반 빌드 진단 비노출 | ✅ `npx electron-vite build` 뒤 `rg -c "__ooDev" out/renderer` → 0건(W-006) |

## 4. 증거 재계수 — 하한 ①~⑦

| # | 결과 |
|---|---|
| ①⑦ | 구현자 원장 144행을 `mutate.py` 명세로 옮겼다. oracle은 이름 필터 대신 **변이 파일에 대응하는 시험 파일 전체**로 바꿔 독립 실행했다 → 140 red + 오검(E6·V5 — oracle이 `measure-stage-d.test.mjs`에 있어 정정 재실행 red) + S4·S5 green(`node --test`) → S5는 Electron 셸 하네스로 red·대조 green, **S4는 환경 제약으로 미실행(잔여)**. R3.0(`ChatTile.tsx:133`, 기존 HarnessScrollController 자리)은 열거 밖 추가 실험이라 판정에 쓰지 않는다 |
| ② | 닫는 파생 이슈 없음(1회째) |
| ③④ | 직전 verify 없음 |
| ⑤ | 형제 맞바꿈 4/4 red — Node 표 `median`↔`max`, 소유 `machine`↔`windows` 열, W 이후↔이전 SHA 대조 둘 |
| ⑥ | 예제 변형 19건. 합의 불일치·모르는 `sample`(exit 2)·모르는 연산자·`target` 누락(exit 2)·원본 삭제·manifest 런타임 거짓·이른 확정·중복 줄·통합 SHA 오류·선택 셀 위반·소유 행 삭제·단위·다른 실행 `opId`·예상 밖 행·빈 값·문자열 값이 계약대로 나왔다. 계약과 다른 결과는 1건(근거 없는 `FAIL` → F2)이다. 관측 값을 표시 시각과 다르게 적은 입력은 `합격` → 경계(F3) |

고장 이력 전체는 [`evidence/verify1-mutations.tsv`](evidence/verify1-mutations.tsv)에 있다. 판정에 영향을 준 행만 아래에 적는다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| S4 | `stage-d-host/electron-main.mjs:87` | 빈 값 | `environment: undefined` | 못 잡음(`node --test`) · 하네스 미실행 | — | 이행(F1 — 좌표 미정) · ⑦ 잔여 |
| S5 | `stage-d-shell/probe.ts:282` | 빈 값 | `environment: undefined` | 못 잡음(`node --test`) · 잡음(Xvfb 하네스 exit 0 → 1, 대조 green) | 하네스(`evidence/H1-0-linux.md:121-134`) | 이행(F1 — 하네스가 gate 집합 밖) |
| E6·V5 | `measure-stage-e.mjs:30`·`:83` | 제거·고정값 | 출처 스탬프 제거 · `exitCode = 0` | 잡음 | `measure-stage-d.test.mjs:'non-comparison CLI stamps…'` | — |
| X5.1~4 | `windows-verdict.mjs:121`·`:652-653`·`:401-402` | 맞바꿈 | 형제 열·SHA | 잡음 ×4 | `windows-verdict.test.mjs` 2·2·20·4건 | — |

## 5. V-pair closeout

| Pair | 결과 | 직접 좌표 · 공유 증거 |
|---|---|---|
| VP-09·VP-10 (UT) | PASS | `windows-verdict.test.mjs` 53건 중 판독기 시험. P1~P5 원장 행 red |
| VP-11 (UT) | **BLOCKED_BY:F1** | S1~S3·S6~S11 red. S5는 하네스로만 red, S4는 미확인. 좌표 종류가 plan 정정 대상이라 독립 판정하지 않는다 |
| VP-12·VP-17·VP-18 (UT) | PASS | E0~E7 · V1~V5(E6·V5 정정 재실행 포함) · M1~M7 red |
| VP-08·VP-13 (IT) | PASS | `cli rejects…` · `compare CLI…`. 기존 0328 Linux 증거 `--compare` exit 0 |
| VP-19 (IT) | PASS | `ChatTile.transcriptSession.test.ts` 3/3. R1·R2·R3(`ChatTile.tsx:150` `sessionId={activeKey}`) red |
| VP-14·VP-16 (AT) | PASS | `report CLI: failing/passing example …` · 두 `CLI refuses …` |
| VP-15 (AT) | BLOCKED_BY:F1 | VP-13 좌표를 공유한다. 출처 스탬프 자리(VP-11)가 열려 있다 |
| VP-R1 (REGRESSION) | PASS | `measure-stage-d.test.mjs` 기존 7케이스 green(`node --test scripts/*.test.mjs` 1150/1150) |
| VP-01~07 | 미착수(WU-W) | W-004 대기(W-018) |

AC 합계: AC7·AC9·AC10·AC11 ✅ · AC8 ⚠️(F1) · AC1~AC6 미착수 = 11. 구현자 합계 `✅ 5`와 AC8 하나가 다르다.

## 9. 게이트 재실행(마지막 수정 뒤 트리 `f5ce4ca9`)

| 단계 | 관측 |
|---|---|
| 가드 5종 | migrations·doc-inventory·product-naming(2,801파일)·test-budgets(18 suites)·ui-thread 모두 exit 0 |
| lint · typecheck | error 0 · warning 12(변경 파일 0건) · `error TS` 0. lint 뒤 트리 변화 0 |
| `node --test scripts/*.test.mjs` | 1150/1150 |
| 전체 `vitest run` | 61파일 실패 / 1,088 통과. io 53파일은 better-sqlite3 바인딩 부재 서명(2,828줄). unit 8파일 20건은 변경 전 트리 `a8bbe99a`에서도 같은 20건이다(이름 차집합 ∅). 원인은 Linux의 `win32` 분기(`native-resources.ts:39` 등). 이번 변경은 `src/main`·테스트 설정을 0줄 건드렸다 |
| `electron-vite build` · `smoke-preload` | 통과 · OK(키 7) |
| `smoke-hosts` | 14줄 FAIL — 데이터 호스트가 `begin` 뒤 exit 1(SQLite 바인딩 없음). 변경 전 트리 빌드에서 같은 14줄이다(차집합 ∅) → 기준선 |

## 11. Repository operation checks

- 구현 커밋 trailer 두 건이 파싱된다(`Agent: codex` · `Status` · `Criteria-*` · `Verified-By: pending`). `git cat-file -t` → commit.
- `[구현자 기입]` 일곱 필드가 모두 있다. 강제 지점 표는 pair별 §10 자리 전체를 담는다.
- `app/AGENTS.md` 변경(스크립트 3줄)에 비밀·변동 정보가 없다.
- INDEX 대상 커밋 좌표는 이 커밋에서 기입한다(PR 브랜치 해시, `main` 미병합).

## 13. Finding disposition

| # | 이슈 | 분류 | disposition |
|---|---|---|---|
| F1 | §10-C “VP-08~17 좌표 = `node --test`”와 P6 S4·S5의 실제 잠금 수단(Electron 생산자 하네스, 커밋 안 된 문서 속 코드)이 어긋난다. S4는 이 환경에서 재현할 수 없다 | 이행 — plan 내부 불일치(oracle 없는 자리) | PLAN_GAP |
| F2 | 근거 좌표 없는 소유자 `FAIL` 행이 `미기록`으로 읽혀 `ownerFailures`·`불합격`에서 빠진다(`verify1-axes.txt` `ownerFailNoRef`: `판정 보류`) | 확장 — 스키마 밖 입력이라 P4 ⑤가 덮는지 해석이 필요하다 | PLAN_GAP(창 안) — 채택 또는 경계 |
| F3 | 관측 `values`를 `trace-marker` 표시 시각 차와 다르게 적어도 통과(`valueMismatchMarker`) | 경계 — §10-C “구간 안의 수치를 다시 계산하는 것은 H5 사람 검증” | 영향 없음 |

### 발견 원장 — verify 1

| ID | disposition | 직전 상태 | 이번 결과 | 직전 기록 | 증거 |
|---|---|---|---|---|---|
| F1 | PLAN_GAP | — | 열림 | — | 새 실행 |
| F2 | PLAN_GAP | — | 열림 | — | 새 실행 |

F(1) = 2.

## 14. Review Signals

| 리뷰 필요 여부 | 근거 | 검토할 질문 |
|---|---|---|
| 불필요 | verify 1회째, 의무 트리거 없음. 앞 회차 기록 없음 | — |

사실: F1은 설계자(=검증자)가 rev 2~7 동안 §10-C 문장을 고치지 않은 채 S4·S5를 Electron 생산자 자리로 열거해 생겼다. 반복된 환경 한계는 Electron 헤더·SQLite 바인딩 403이다.

## 15. 결론

`RETURN_TO_PLAN` — 다음 주체는 설계자다. 라운드는 2가 된다.

- **F1**: S4·S5의 좌표를 정해야 한다. 생산자 하네스를 커밋된 gate 명령으로 등록하거나, `node --test`로 잡히는 seam을 둔다. 그리고 §10-C 문장을 고친다.
- **F2**: 근거 없는 `FAIL`을 `불합격`으로 셀지, 경계로 선언할지 정한다.

S4 ⑦ 잔여는 다음 verify로 넘긴다.
