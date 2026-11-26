# Verify — 0330-windows-responsiveness-verdict

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
