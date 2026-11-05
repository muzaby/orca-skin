# Verify — 0295-closed-network-ipc-mcp-tests

## 메타

| 항목 | 값 |
|---|---|
| slug | `0295-closed-network-ipc-mcp-tests` |
| 검증자 | Claude Code |
| 일자 | 2026-11-05 |
| 대상 커밋/range | `d16822a..17bcbf4` |
| 구현 전 plan 기준 | `d16822a` |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `d16822a:V1` |
| 라운드 | 1 |
| 상태 | **PASS** (기계 범위) — 포크 CI 실기 1회가 남는다(plan §19) |
| 확장 창 | verify 1회째 — 창 안 · 다시 열린 노드 없음 |
| 독립 축(⑥) | 4건 — 대기 술어 원천 맞바꿈(X3) · 형제 거부 메시지 맞바꿈(X4) · 메시지 구별성 소거(X5) · 실제 연결 실패 주입(X2b, Part I 상태표 "failed 정착" 행) + 동치 1(X2) |
| 열거 sweep(⑦) | 1회째 전수 — §10 자리 7(EP-1 1 · EP-2 4 · EP-3 2) + 등록 변이 10 · 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 0 |
| 구현 주체·문맥 | 설계자 = 구현자 = 검증자(Claude, 같은 세션 계열). plan validity는 자기 설계 감사다 — 독립성은 ⑥이 맡는다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: hunk 1개(`@@ -325`), 전부 `[구현자 기입]` 표지 아래. Decision·Product/UX·AC·V·§10 변경 0.
- 기준선: diff로 성립(`d16822a` 설계 커밋 ↔ `17bcbf4` 구현 커밋 분리).
- 설계 대비 차이 1건: AC3·§11의 `satisfies` → 타입 주석. 계약("형상이 어긋나면 컴파일 실패")은 그대로이고 T1(멤버 이름 바꿈)이 `TS2561`로 red — 구현 세부 정정으로 받는다(§12).
- 채점 기준: `d16822a:V1` 원문.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 상속할 V 없음 |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01/AT↔VP-01 · AR-01↔VP-02 · AR-02↔VP-04 · MD-01↔VP-03 |
| INHERITED ↔ REGRESSION | 유효 | R-02↔VP-05 |
| §10 자리 목록 재검색 | 유효 | `createRuntimeConfigAugmenters\(\{` 테스트 1건(`engine.ipc.test.ts:103`) · `auth: {} as never` 0건 · `.read('mcp'` 1건(`:297`) — 차집합 0. EP-2 분모 4 = `Pick<AuthRuntime,'bind'\|'connectionValue'>` 2 + `BoundAuth` 메서드 2(authId는 bind 자리에서 단언) |
| 적대 증거 선택 이유 | 유효 | VP-02 "기본 배포는 auth를 안 써 green이 정합을 뜻하지 않음" — E1 동치로 재확인 |
| 운영 gate | 유효 | lint · typecheck · test-budgets · 대상 스위트 · trailer |

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 path |
|---|---|---|
| D-002 | bind 성공 · 나머지 사용은 이름 붙은 실패 | `engine.ipc.test.ts:73-88` `authStub` → `:103` 조립 |
| D-003·D-005 | activate 뒤 pending 소멸까지 재조회 | `managed-mcp.cli.integration.test.ts:290` → `:294-306` `vi.waitFor` |
| D-004 | read 자가 활성화 없음 | `mcp-control.ts:149` 불변(이번 diff 프로덕션 0줄) |
| D-006 | 타임아웃·skipIf·기대값 6 불변 | diff에 `scaledBudget`·`skipIf`·`toHaveLength`·`testTimeout` 변경 줄 0 · `scaleMs(40_000)`은 옮겨졌을 뿐 값 동일 |
| D-007 | 네 조합 green | 아래 §5 |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 적절 | 실제 연결 실패(X2b) → 대기 즉시 종료 · `expected [] to have a length of 6` · tests 1.98s |
| false success | 없음 | 대기 술어를 무력화(M2·X3)하면 red — 경쟁을 흡수하지 않는 형태가 아님을 확인 |
| 정착하지 않음 | 상한 있음 | `vi.waitFor` 40s × 배율(setup `vitest-setup.mjs:5`) < `testTimeout 120_000` × 배율 |
| read reject 시 재시도 | 수용 | 구현자 놓친 문제 #1 — 즉시 실패 → 대기 한도까지 재시도. 진단은 마지막 오류에 남는다. 동작 의미 변화는 실패 시간뿐 |
| 다른 B 구현 | 아님 | — |

## 3. 역방향 탐색

`scan-surface.sh d16822a..17bcbf4` → "변경된 소스 파일이 없습니다" (테스트 2파일만 변경). 신규 export·소비처 없음. `authStub`는 같은 파일 production 조립(`:103`)과 UT(`:150`)가 함께 쓰는 단일 정의 — 로컬 재구현 아님.

## 4. 고장 이력

하네스 `mutate.py` spec 2개(15 + 5줄) + 수동 2건. 종료 후 "모든 파일 원문 그대로" · `git status` 깨끗.

| ID | 자리 | 종류 | 바꾼 내용 | 이번 결과 | 잡은 테스트 / 근거 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| F1 | `harness-runtime.ts:74` | 호출 대체 | 생성 시 `bind` | green(기대) | engine.ipc 14 passed | ① | — |
| F2 | `harness-runtime.ts:123` | 다른 값 | contribution 1개 채움 | green(기대) | 14 passed | ① | — |
| F1+{} | 위 + `engine.ipc.test.ts:103` | 대조 | F1 + 구 `{}` | 잡음 | 14 failed · `TypeError: deps.auth.bind is not a function` | ① | — |
| F3 | `harness-runtime.ts:74` | 호출 대체 | 생성 시 `bind().request()` | 잡음 | 14 passed + Unhandled Rejection → exit 1 | ① | — |
| F4 | 〃 | 호출 대체 | 생성 시 `connectionValue()` | 잡음 | 14 failed | ① | — |
| F5 | 〃 | 호출 대체 | 생성 시 `bind().snapshot()` | 잡음 | 14 failed | ① | — |
| E1 | `engine.ipc.test.ts:103` | 제거 | `authStub` → `{}` | 동치 | 기본 배포 `void deps`(`harness-runtime.ts:74`) — 포크 형상은 F1+{}가 잠금 | ⑦ | — |
| T1 | `engine.ipc.test.ts:76` | 다른 값 | `bind` → `_bind` | 잡음 | `tsc -p tsconfig.test.json` TS2561 | ①⑦ | — |
| S1 | `:79` | 빈 값 | snapshot 반환 | 잡음 | `refuses every auth use…` 1 failed | ⑦ | — |
| S2 | `:82` | 빈 값 | request 반환 | 잡음 | 〃 | ⑦ | — |
| S3 | `:86` | 빈 값 | connectionValue `undefined` | 잡음 | 〃 | ⑦ | — |
| S4 | `:77` | 다른 값 | `authId` → `${authId}-x` | 잡음 | 〃 | ⑦ | — |
| S5 | `:79` | 맞바꿈 | snapshot 메시지 ← request | 잡음 | 〃 | ⑤ | — |
| X4 | `:86` | 맞바꿈 | connectionValue 메시지 ← snapshot | 잡음 | 〃 | ⑤⑥ | — |
| X5 | `:74` | 고정값 | 메시지에서 `${use}` 소거 | 잡음 | 〃 | ⑥ | — |
| M1 | `managed-mcp…:290` | 제거 | `activate?.()` | 잡음 | managed-mcp 1 failed | ①⑦ | — |
| M2 | `:300-301` | 제거 | pending 재조회 조건 | 잡음 | 1 failed | ①⑦ | — |
| X3 | `:300` | 다른 값 | 술어 `origin === 'orca'` → `'user'` | 잡음 | 1 failed | ⑥ | — |
| X2 | `mcp-control.ts:131` | 고정값 | connect 성공 뒤 `actual`을 `failed`로 | 동치 | 1 passed — 이어지는 `read()`가 OpenCode 상태로 `actual`을 덮는다(`mcp-control.ts:155-160`). 실패 주입으로 성립하지 않음 → X2b로 대체 | ⑥ | — |
| X2b | `mcp-control.ts:123` | 다른 값 | connect `name` → `${id}-missing` | 잡음 | 1 failed `expected [] … 6` · tests 1.98s(대기 즉시 종료) | ⑥ | — |
| M3 | `mcp-control.ts:149` | 호출 대체 | `return []` → `this.activate()` | 잡음 | mcp-connection 1 failed · 3 passed | ① | — |

- 검산: 시도 21 = 잡음 16 · 기대 green 2(F1·F2) · 동치 2(E1·X2) · 기대 red 미검출 0 · 못 잡음 0.
- F3은 테스트 케이스 실패가 아니라 vitest의 Unhandled Rejection(exit 1)으로 red다 — CI에서 같은 exit로 막힌다.
- managed-mcp 기준선: opencode 1.18.27 PATH에서 green 4/4(최초 1 · B0 1 · 반복 2).

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 직접 증거 | §10 |
|---|---|---|---|---|---|
| VP-03 | UT | REQUIRED | PASS | `engine.ipc.test.ts:'refuses every auth use outside the IPC boundary'` · S1~S5·X4·X5 red | EP-2 4/4 |
| VP-02 | IT | REQUIRED | PASS | `engine.ipc.test.ts` 14케이스 · F1·F2 green · F1+{} red 14 · T1 TS2561 | EP-1 1/1 |
| VP-04 | IT | REQUIRED | PASS | `managed-mcp.cli.integration.test.ts:'advertises and calls managed MCP through the supported CLI'` · M1·M2·X3·X2b red | EP-3 2/2 |
| VP-05 | AT(REGRESSION) | REGRESSION | PASS | `mcp-connection.test.ts` 4 passed · M3 red | 0 |
| VP-01 | AT | REQUIRED | PASS | opencode 없음: 3파일 18 passed · 1 skipped / 있음: 19 passed · 배포 채움(F1·F2) 14 passed | 0 |

- root PAIR_FAIL 0 · BLOCKED_BY 0.
- 실행 구간: EP-1은 production `createRuntimeConfigAugmenters` → `createConfigApiAugmenters` 실제 조립을 지난다(mock 없음). EP-3은 실제 opencode CLI + 실제 `OpenCodeAdapter`·`OpenCodeServerPool`.
- 배포 채움 × opencode 설치 조합은 같은 실행에서 재현하지 않았다 — 두 파일이 서로 다른 축(engine.ipc=배포, managed-mcp=opencode)이라 독립이다. 실제 포크 CI는 사람 실기(§8).

### AC 세부

| AC | 결과 | 증거 |
|---|---|---|
| AC1 | ✅ | F1 상태 14 passed (현행 픽스처 `{}`는 14 failed) |
| AC2 | ✅ | UT + F3·F4·F5 red |
| AC3 | ✅ | T1 TS2561 (`satisfies` → 주석, §12) |
| AC4 | ✅ | opencode 1.18.27 green 4/4 · M1·M2 red · 값 불변(§1 D-006) |
| AC5 | ✅ | mcp-connection green · M3 red |
| AC6 | ✅ | opencode 없음 1 skipped · engine.ipc passed |

- 합계: `✅ 6 · ⚠️ 0 · ❌ 0 = 총 6` — trailer `Criteria-Met: 6/6` · INDEX 비고 "AC ✅6"과 일치.

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| typecheck | PASS | exit 0, 3분할 error 0 |
| lint | PASS | 0 error · 2 warning(renderer 기존 `react-hooks/incompatible-library`, diff 밖) · 트리 변경 0 |
| test-budgets | PASS | `16 real-git suites ok · all budget sites scaled` |
| 대상 스위트 | PASS | 위 VP-01 |
| trailer 파싱 | PASS | `d16822a`·`17bcbf4` 모두 키 그대로 반환 |

## 7. 숫자 재측정

- §10 검색 N: 1 · 0 · 1 — plan과 일치.
- `src/main/app` 전체 스위트(기준선 22 red)는 재실행하지 않았다 — 변경이 두 테스트 파일뿐이고 둘 다 직접 실행했다.

## 8. 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 실기 |
|---|---|---|
| 포크 CI | 포크 형상을 F1·F2·F3~F5 변이로 재현 | 배포 채움 × opencode 설치 포크 CI 1회 (포크 코드가 이 저장소에 없음) |
| Windows CI | — | `.github/workflows/ci.yml` (opencode 미설치 조합) PR 실행 |

## 9. 게이트 재실행

- 명령: `npm run typecheck` · `npm run lint` · `node scripts/check-test-budgets.mjs` · `./node_modules/.bin/vitest run` 3파일 × opencode 유/무 · `mutate.py` 2회 · 수동 변이 2.
- `npm test` 미사용(ABI 불변). better-sqlite3는 이미 Node ABI로 로드돼 managed-mcp 메일 도구까지 green.
- 잔여물: opencode 바이너리 사본을 scratchpad에만 둠. 작업 트리 변경 0.

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → 이번 커밋에서 `verify/PASS`(기계 범위), 다음 주체 사람(포크 CI). 0293·0292 선례대로 archive 이동은 실기 뒤.
- 대상 커밋 좌표: `d16822a`(V1 설계) · `17bcbf4`(r1) — `git cat-file -t` = commit. PR 브랜치 좌표(`origin/main` 참조 없음 — 병합 뒤 교정).
- `[구현자 기입]` 7필드 전부 존재 · 강제 지점 표가 §10 자리 7 전부와 `남긴 곳`을 담음 · 잠금 표에 sweep 행.

## 12. 구현자 코멘트

| 코멘트 | 판단 | 반영 |
|---|---|---|
| `satisfies` → 타입 주석 | 구현 세부 보완 — 계약 동일, T1로 재확인 | plan 원문 유지(검증 기준 불변) |
| read reject 재시도(놓친 문제 #1) | 타당 · 선조치 불필요 | — |
| ABI 의존(놓친 문제 #2) | 선언 경계 (3) | — |

## 13. Finding disposition

없음.

## 14. Review Signals — 사실만

- 이전 라운드: 없음(첫 라운드).
- plan 지침과 TS 추론 불일치 1건(`satisfies`) — 구현 세부로 흡수.
- 반복 환경 한계: Electron 바이너리 부재 · better-sqlite3 ABI(이번엔 Node ABI가 이미 있어 영향 없음).
- 독립 축(⑥) 발견: 0(5건 시도 — 잡음 4 · 동치 1).

## 15. 결론

- 상태: **PASS** (기계 범위) · verify 1회째.
- pair: REQUIRED/REGRESSION PASS 5 · PAIR_FAIL 0 · BLOCKED_BY 0 · PLAN_GAP 0.
- AC ✅6 · gate 전부 PASS.
- 다음: 사람 — PR Windows CI 확인 + 포크 CI 1회. 그 뒤 INDEX 행 archive 이동.
