# Verify — 0322-tray-residency

## 메타

| 항목 | 값 |
|---|---|
| slug | `0322-tray-residency` |
| 검증자 | Claude Code |
| 일자 | 2026-11-16 |
| 대상 커밋/range | `847c102..345be89` (구현 r1 = `345be89`) |
| 구현 전 plan 기준 | `847c102` (ΔV3 설계) — 구현 커밋의 plan diff는 `[구현자 기입]` 추가뿐 |
| V mode / 유효 V | `Baseline V: V1` / `V1 + ΔV1 + ΔV2 + ΔV3` |
| 검증 기준 plan revision | `847c102:V1+ΔV1~ΔV3` |
| 라운드 | 1 → 2 (RETURN_TO_PLAN) |
| 상태 | **RETURN_TO_PLAN** |
| 확장 창 | verify 1회째 — 창 안. 재오픈 노드(ΔV): ΔV1·ΔV2 모두 구현 전 설계라 verify 횟수 불변 |
| 독립 축(⑥) | 3축 — `this` 바인딩(X1) · 낡은 라벨 캡처(X2) · 플래그 되돌림(X3·X4·X6). 발견 1(확장) |
| 열거 sweep(⑦) | 1회째 전수 — 항목 24(M1~M15·S1~S9) · 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 1(막음 1 / 후보 0) · 경계 0 · 비귀속 1 |
| 구현 주체·문맥 | 구현 = Claude(사용자 지시). 설계자 = 검증자라 plan validity는 자기 설계 감사다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 바꿨는가: `[구현자 기입]` 절 추가만(`git diff 847c102..345be89` 삭제 행 1 = 안내 인용문). AC·Decision·V 변경 없음.
- 기준선 성립: 예(`847c102`). 채점 원 기준 = D-001~D-009 ACTIVE · AC1~AC11 · §10 EP-01~05.
- 창 밖 ΔV 새 열거 항목: 해당 없음.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode·기준 | 유효 | Baseline + ΔV1~3 순서 적용으로 유효 V 재구성 가능 |
| NEW/CHANGED ↔ REQUIRED pair | 유효 | VP-01~04 |
| INHERITED ↔ REGRESSION | 유효 | VP-05 |
| §10 자리 목록·검색 재실행 | 유효 | `rg` 재실행 EP-01·02·03·04·05 = 1·4·2·1·2 = 목록과 일치(차집합 0) |
| 적대 증거·선택 이유 | 유효 | M1~M15 |
| SUPERSEDED 이관 | 유효 | D-006→D-008, D-007→D-009 본문 정정 |
| 운영 gate | 유효 | §19 |

## 1. Product & UX / ACTIVE Decision

| Decision | 실제 production path |
|---|---|
| D-001·D-003 | X·헤더 → `oo:window:close` → `mainWindow.close()` → `close`(위치 저장 `index.ts:206` → 숨김 판정) |
| D-002·D-009 | `Menu.buildFromTemplate([열기·종료])` · `settings.onPatch` → 재구성 |
| D-004 | `resident = platform === 'win32'` |
| D-005 | 트레이 `click` → `focusMainWindow` |
| D-008 | `createTray()` 무방비 — `try` 없음, `whenReady().then` reject → `unhandledRejection` |

## 2. 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 종료 중 숨김이 종료를 막는가 | 막지 않음 | 업데이트: `BaseUpdater.js:21` `app.quit()`; 트레이 종료: `app.quit()`; 둘 다 `before-quit` 경유 |
| `before-quit` 취소(드레인) 구간 | 정상 | 새 리스너는 취소하지 않고 `quitting`만 켠다. 드레인 뒤 `app.quit()` 재호출에서 `close` 통과 |
| 트레이 생성이 던질 때 | D-008대로 | 창은 이미 생성됨(`index.ts` 순서). 이후 동작은 경계 B6 |
| 비-win32 | 무변경 | `attach`·구독 모두 `resident` 가드 |
| 숨은 창 renderer | 계속 동작 | `backgroundThrottling` 설정 `rg` 0건 = 기본값. 숨김은 타이머 감속뿐 — 계약 대상 아님 |
| 구독 누적 | 없음 | `onPatch`·`before-quit`·`will-quit` 설치 1회씩 |

## 3. 역방향 탐색

`scan-surface.sh bede719..345be89`: 미사용 값 export 0 · 타입 export `TrayPort`·`TrayResidencyDeps`(시그니처용, 정상) · `TRAY_MENU_LABELS`(production 참조 = 같은 파일 `applyMenu`) · 형제 비대칭 0. `rg new Tray\( app/src/main` → `index.ts` 1건(주입 지점) — 유일한 production 호출자가 `index.ts`다(미배선 아님, EP-03 2자리 존재 확인).

## 4. semantic 검증 / 고장 이력

- 하네스: `mutate.py <spec> --cwd app` — oracle `vitest run src/main/app/tray-residency.test.ts`, 원복 "모든 파일 원문 그대로", `git status` 깨끗.
- ③ 직전 `못 잡음`·`동치`: 없음(첫 verify). ④ 이전 `잡음` 재실행: 해당 없음.
- ⑤ 형제 슬롯 맞바꿈: 메뉴 두 항목 `click`(M2a)·라벨(S3)·`ko`↔`en` 표(M12) 3종 — 전부 red.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| M1 | tray-residency.ts:102 | 제거 | `if (quitting) return` | 잡음(4) | AC4×2·AC5·수명주기 | ① | — |
| M2a | :76 | 맞바꿈 | 첫 항목 click → `quit` | 잡음(3) | AC2×2·수명주기 | ①⑤ | — |
| M3 | :66 | 고정값 | `resident = true` | 잡음(2) | AC6×2 | ① | — |
| M4 | :103 | 제거 | `preventDefault()` | 잡음(3) | AC1·B5·수명주기 | ① | — |
| M5 | :71 | 다른 값 | `createTray` try/catch 삼킴 | 잡음(1) | AC7 | ① | — |
| M6 | :83 | 제거 | 트레이 `click` 리스너 | 잡음(2) | AC3·수명주기 | ① | — |
| M7 | :98 | 제거 | `session-end` 리스너 | 잡음(1) | AC5 | ① | — |
| M8 | :92 | 제거 | `destroy()` | 잡음(2) | AC8·수명주기 | ① | — |
| M9 | :77 | 다른 값 | 세 번째 항목 | 잡음(3) | AC2×2·AC11 | ① | — |
| M10 | :88 | 제거 | `before-quit` 리스너 | 잡음(3) | AC4×2·수명주기 | ① | — |
| M11 | :104 | 제거 | `hide()` | 잡음(3) | AC1·B5·수명주기 | ① | — |
| M12 | :22 | 맞바꿈 | 라벨 표 ko↔en | 잡음(3) | AC2×2·AC11 | ①⑤ | — |
| M13 | :85 | 제거 | `onPatch` 구독 | 잡음(1) | AC11 | ① | — |
| M14 | :73 | 고정값 | 라벨 `'ko'` 고정 | 잡음(2) | AC2(en)·AC11 | ① | — |
| M15 | :86 | 제거 | `includes('uiLocale')` 조건 | 잡음(1) | AC11 | ① | — |
| S1~S2 | :81 | 제거·다른 값 | 툴팁 호출 제거 · `'x'` | 잡음(1·1) | 툴팁 케이스 | ⑦ | — |
| S3 | :76 | 맞바꿈 | 두 항목 라벨 | 잡음(3) | AC2×2·AC11 | ⑤⑦ | — |
| S4 | :97 | 제거 | `attach`의 `if (!resident) return` | 잡음(2) | AC6×2 | ⑦ | — |
| S5·S6 | :76·:77 | 제거 | 첫·둘째 항목 제거 | 잡음(4·4) | AC2·AC11 | ⑦ | — |
| S7 | :83 | 호출 대체 | click → `app.quit()` | 잡음(2) | AC3·수명주기 | ⑦ | — |
| S8 | :92 | 제거 | `will-quit` 리스너 | 잡음(2) | AC8·수명주기 | ⑦ | — |
| S9 | :82 | 제거 | 설치 시 `applyMenu()` | 잡음(4) | AC2×2·AC11·수명주기 | ⑦ | — |
| X2 | :73 | 뒤집기 | 라벨을 설치 시 1회 캡처 | 잡음(1) | AC11 | ⑥ | — |
| X3 | :88 | 뒤집기 | `before-quit`가 `quitting=false` | 잡음(3) | AC4×2·수명주기 | ⑥ | — |
| X4 | :98 | 뒤집기 | `session-end`가 `quitting=false` | 잡음(1) | AC5 | ⑥ | — |
| X6 | :102 | 뒤집기 | 숨김 뒤에 `quitting` 검사 | 잡음(4) | AC4×2·AC5·수명주기 | ⑥ | — |
| X5 | :83 | 호출 대체 | `tray.on('click', deps.open)` | **동치** | — | ⑥ | `focusMainWindow(): void`(`index.ts:62`)는 인자를 읽지 않는다 |
| **X1** | :77 | 호출 대체 | `click: () => deps.app.quit()` → `click: deps.app.quit`(this 소실) | **못 잡음**(16 passed) | — | ⑥ | **확장** |

- 검산: 시도 30 = 잡음 28 · 못 잡음 1 · 동치 1 · 경계 0. (M 15 + S 9 + X 6; 표는 S1·S2와 S5·S6을 한 행으로 묶었다.)
- 열거 sweep(⑦) 못 잡음 0. 규칙 칸 분기(B1~B5·EP-05 4분기·EP-04 2분기)는 diff 자리 변이로 전부 인용 가능한 red(M1·M3·M7·M10·M15·S4·S9·M8·S8).
- X1 분류 근거: 현재 코드(`:77`)는 화살표라 올바르다 — 현재 결함 아님. §10·AC·등록 변이 어디에도 "메뉴 `종료`가 `app`에 바인딩된 호출"이 없다 → 이행 아님. 테스트의 `app.quit`이 `vi.fn`이라 `this`를 관측하지 못한다 → **확장 후보**. 실제 Electron `app.quit`을 분리 호출하면 바인딩이 깨지는 형태다(재현은 이 환경에서 불가 — Electron 미설치).

## 5. V-pair closeout

| Pair | 결과 | 직접 검증 증거 | 자리 |
|---|---|---|---|
| VP-01 MD-01↔UT-01 | PASS | `tray-residency.test.ts` AC1~AC8·AC11 16케이스 + M1~M15 전부 red | EP-01 1/1 · EP-02 4/4 · EP-04 1/1 · EP-05 2/2 |
| VP-02 SD-01↔ST-01 | PASS | `'숨김 → 열기 → 종료 시작 → 닫힘 통과 → 정리 순서로…'`(X3·X6·S7·M6 red) | 0 추가 |
| VP-03 AR-01↔IT-01 | 사람 실기 대기 | `rg -o` → 2(존재) · typecheck 0 error(`app`·`settings: router.settings` 구조 일치) | EP-03 0/2 기계 — 경계 B1 |
| VP-04 R↔AT-01 | 사람 실기 대기 | §19 9단계 | 0 |
| VP-05 SD-02 REGRESSION | PASS | `native-settings-lifecycle.test.ts` 2파일 18케이스 passed(그 파일 diff 0) · AC4 2회 입력 | 0 |

- root PAIR_FAIL 없음. BLOCKED_BY 없음.
- 실행 구간: 모든 좌표가 `installTrayResidency`를 직접 호출하는 production 코드를 지나고 mock은 포트 경계(트레이·앱·창)뿐이다. 구간 밖 자리 = EP-03 2자리(plan 경계 B1). 운반 값 구별: 라벨 `ko`≠`en`, `quit`/`open` 서로 다른 mock, `changedKeys` `theme` vs `uiLocale`.
- AC 합계 재측정: `✅ 10(AC1~8·10·11) · ⚠️ 1(AC9) · ❌ 0 = 11` — 자기보고와 일치. trailer `Criteria-Met: 10/11` · INDEX `✅10·⚠️1` 일치. 강제 지점 8/10 재측정 일치(검색 출력 1·4·1·2 = 닫힌 8, EP-03 2 열림).

### 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| 가드 4종 | PASS | `check-migrations-appendonly`·`check-doc-inventory --check`·`check-product-naming`·`check-test-budgets` exit 0 |
| `npm run lint` | PASS | 0 error · 2 warning(renderer 기존 `useVirtualizer`) — 작업 트리 변화 없음(`git status` 깨끗) |
| `npm run typecheck` | PASS | node·web·test 3개 tsc 오류 0 |
| vitest 전체(파일 필터 없음) | 기준선 한계 | 971파일: 69 failed·898 passed·4 skipped / 9096케이스: 330 failed·8635 passed |
| `node --test scripts/*.test.mjs` | PASS | 868/868 |
| message-bus | PASS | `git log -1 --format='%(trailers:only=true)' 345be89` → Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By·Co-Authored-By·Claude-Session 파싱 |

- 기준선 분리: 변경 전 `847c102` worktree에서 같은 명령을 돌려 실패 파일 69·케이스 330의 **차집합 양방향 0**. 실패 330 중 308 = `better_sqlite3`/`NODE_MODULE_VERSION` ABI(환경), 나머지 22는 변경 전과 동일한 Windows 경로·Electron 부재 계열이며 이번 변경 파일(`tray-residency*`·`native-settings-*`)은 실패 0. `[test-pools]` 위반 0.
- 돌리지 못한 단계: `npm test`(pretest ABI)·Windows CI·`npm run dev` 실기.
- 잔여물: `app/node_modules`(`npm ci --ignore-scripts`)는 `.gitignore` 대상이며 검증용 worktree는 제거했다.

## 7. 숫자 재측정

- 문서 3곳 `rg "tray-residency"` → 3파일(AC10 ✅). `IPC_CONTRACT.md`는 행 서술이 현재형이고 이력 서술 없음.
- `docs/TRD.md` 취소선 + "구현 완료 (0322)"는 같은 절 인접 행(0084~0089)의 표기 관례와 일치.

## 8. 사람 실기

| 항목 | 기계 검증 | 남은 실기 |
|---|---|---|
| EP-03 `index.ts` 조립 · 실제 셸 트레이 · 로그오프 · 업데이트 설치 | 판정·메뉴·정리 전부(AC1~8·11) · 구조 타입 일치 | §19 9단계 — 설치본/`npm run dev`(Windows) |

## 11. Repository operation checks

- INDEX 행: 단계·상태·다음 주체(단일 `Claude`)를 이번 턴에 갱신. 비고 5줄 이내.
- **대상 커밋 좌표**: `bede719`·`3fc5544`·`d7be2e3`·`847c102`·`345be89` 전부 `git cat-file -t` = commit. 이 체크아웃에는 `origin/main`이 없어(`git branch -a` → `ccr-a3951617-s97a1b`·`feat/0320-scheduled-tasks`) `main` 조상 확인은 **못 했다** — 작업 브랜치 좌표로 기입한다.
- `[구현자 기입]` 7필드 전부 존재 · 강제 지점 표가 자리 10(검증 8 + 남긴 2) 전부와 `남긴 곳`을 담음 · 잠금 표에 sweep 9행.
- trailer 허용값 준수. `Co-Authored-By` 이름은 허용값 키 밖 정보라 판정 영향 없음.

## 12. 구현자 코멘트

| 코멘트 | 판단 |
|---|---|
| 자리 검색 명령이 타입 선언을 셌다 → ΔV3 | 타당 — 검증자가 정정 후 명령을 재실행해 1·4·2·1·2 확인 |
| 놓친 잠재 문제 #2~#4 보고만 | 타당 — #2는 `protocol.ts:829` `.catch('ko')`로 도달 불가 |

## 13. Finding disposition

| # | finding | 분류 · 근거 | 귀속 | disposition | 후속 |
|---|---|---|---|---|---|
| D1 | 메뉴 `종료` click이 `app.quit` 분리 호출(this 소실)로 바뀌어도 16케이스 green | 확장 — 현재 코드는 정상, 열거 원문 어디에도 바인딩 의무 없음, 변이 X1 `못 잡음` | VP-01 EP-02 둘째 항목 | `PLAN_GAP`(창 안) | 설계자: 채택(가짜 `app.quit`이 `this === app`을 단언 · 새 의무 +1 변이) 또는 경계 선언 |
| D2 | 설계 시점 `node_modules` 부재로 Electron 타입 대조를 구현자에게 넘겼던 §8 서술 | 비귀속 — 구현자가 typecheck 0 error로 닫음 | — | NON_BLOCKING | 없음 |

## 14. Review Signals — 사실만

- 이전 라운드 동일 증상: 없음(첫 verify).
- 설계자·구현자·검증자가 모두 Claude 세션이다. 구현자 변이 24가 전부 red였고 독립 축 6개 중 1개(this 바인딩)만 새로 못 잡혔다.
- 환경 한계: Electron·`better-sqlite3` ABI 부재로 EP-03·실제 트레이는 실행 불가(plan 경계 B1과 같음).
- 독립 축(⑥) 발견 1 — 확장.

## 15. 결론

- 상태: **RETURN_TO_PLAN** — `PLAN_GAP` 1(D1, 확장 후보, 창 안). FAIL 사유(이행·현재 결함·gate 위반)는 0이다.
- verify 1회째 — 창 안. 후보 표로 간 확장 후보 0.
- pair: REQUIRED/REGRESSION PASS 3(VP-01·02·05) · 사람 실기 대기 2(VP-03·04) · root PAIR_FAIL 0 · BLOCKED_BY 0.
- Product/UX·ACTIVE Decision: D-001~D-005·D-008·D-009 코드·테스트로 충족, 실제 트레이 관측은 AC9 실기.
- AC: ✅10 · ⚠️1 · ❌0 = 11.
- 운영 gate: 가드 4종·lint·typecheck·`node --test` PASS, vitest 실패 집합 = 변경 전과 동일(환경).
- 남은 사람 확인: §19 Windows 실기 9단계(AC9).
- 다음 단계: 설계자가 D1을 **채택**(권장 — `quit`을 `this`를 검사하는 가짜로 바꾸고 변이 M16 `click: deps.app.quit` 등록, 새 의무 1·구현 소규모) 또는 **경계 선언**(`app.quit`의 바인딩은 `index.ts` 실기 몫)한 뒤 `plan/READY` 커밋. 경계 선언이면 구현 턴 없이 verify로 갈 수 있다(`docs/handoff/AGENTS.md §확장 창`).
