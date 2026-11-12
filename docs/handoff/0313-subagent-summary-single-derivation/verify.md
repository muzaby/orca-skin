# Verify — 0313-subagent-summary-single-derivation

## 메타

| 항목 | 값 |
|---|---|
| slug | `0313-subagent-summary-single-derivation` |
| 검증자 | Claude Code (비기능 handoff — 설계자 = 구현자 = 검증자, plan validity는 자기 설계 감사) |
| 일자 | 2026-11-12 |
| 대상 range | `68797c0..8ba051f` (구현 `6504dae` M1 · `be5587b` M2 · `8ba051f` 보고) |
| V mode / 유효 V | `Baseline V: V1` |
| 라운드 / 상태 | 1 / **PASS** (기계 범위 — AC8 사람 실기는 D-006에 따라 일괄 실기 목록, 판정을 막지 않음) |
| 확장 창 | verify 1회째 — 창 안 · ΔV 없음 |
| 독립 축(⑥) | 2축: ① 캐시 `includeNested` 적중 조건 변이(M-x) ② 키 identity 위험 — 제자리 변경·fresh 배열 호출자 전수 읽기 |
| 열거 sweep(⑦) | 1회째 전수 규모는 구현자 41행을 신뢰하지 않고 대표 5종 재실행(M-a·b·e·f + M-x) — 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 1(vitest 기준선) |

## 0. 기준선

- 구현 커밋의 `plan.md` diff는 `[구현자 기입]` 117줄 추가뿐이다(`git diff --stat 68797c0..8ba051f` → plan.md +117). Decision·AC·V·§10 변경 0 — 기준선이 diff로 성립한다(설계 `68797c0`).
- Plan validity: EP-01~03 검색을 이번 턴 재실행 → 호출 5자리·`hasCanonicalBackground` 사용 2·`SubagentTaskSummary[]` 비readonly 1줄(`parts.ts:348` 지역 누적)·`projectLegacyBackgroundPanel` 파일 1(`LegacySubAgentTile.tsx`), 차집합 0. 유효.
- 구현자가 보고한 plan 제안(VP-04 oracle이 EP-01 2자리를 못 봄)은 사실이다 — 신규 `AgentTaskRow.render.test.ts`·`InlineSubagentDetail.test.ts`가 그 자리를 닫는다. 다음 plan 개정이 있으면 반영(규범 변경 아님).

## 1. diff 비판 읽기 · 역방향 탐색

- 캐시는 계산 뒤 저장(`parts.ts` diff) — 던지면 칸이 빈다. WeakMap이라 정리 불필요.
- 헤더·본문 선택: 구 `canonical && hasCanonicalBackground` 판정식과 동일(`SubAgentTileContent.tsx:20-24,68-72`). 구 모델 마크업은 `git diff`상 파일 이동이며 클래스·문구 변경 없음.
- 제자리 변경: `rg "\.messages\.(push|splice|sort|reverse)\(|\.parts\.(push|splice)\("` 프로덕션 → `turns.ts:43`(턴 묶음용 파생 배열) 1건, 상태 배열 아님. 호출자 5자리 모두 상태 `messages`를 그대로 넘김(`model.ts:36` ← `tiles.tsx:30`).
- `scan-surface.sh`: 변경 관련 후보는 `SubAgentTaskList`(테스트 참조 12·프로덕션 0)뿐 — `LegacySubAgentContent`가 같은 파일에서 렌더하므로 프로덕션 도달(`LegacySubAgentTile.tsx` 내부 호출), 나머지는 이번 diff 밖 기존 항목.

## 2. V-pair closeout

| Pair | 판정 | 직접 oracle 좌표 · 이번 실행 |
|---|---|---|
| VP-01 | PASS | `parts.test.ts` K1~K3 신규 3건 — 28 passed. M-a(저장 제거) 3 failed · M-b(칸 고정) 1 failed · M-x(중첩 적중 불가) 1 failed |
| VP-02 | PASS | `CanonicalBackgroundContent.wiring.test.ts` T1·T3·T4·T5 신규 + 기존 T2·T6 · `rightPanelTiles`·`subagentWiring.render.test.ts`. M-e(본문 맞바꿈) 10 failed · M-f(헤더 맞바꿈) 8 failed |
| VP-03 | PASS | `typecheck:web`·`typecheck:test` error 0 · EP-03 검색 차집합 0 |
| VP-04 | PASS | 자리 5: 타일 본문·헤더(wiring) · `AgentTaskRow.render.test.ts` · `InlineSubagentDetail.test.ts` · OpenCode `activity.integration.test.ts` — 대상 묶음 417 passed(변이 전 기준) |

고장 이력(하네스 대신 수동 치환, 매번 `git checkout`으로 원복·`git status` 깨끗):

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 분류 |
|---|---|---|---|---|---|
| M-a | `parts.ts` 저장 줄 | 제거 | `entry[slot] = derived` 삭제 | 잡음(3) | — |
| M-b | `parts.ts` 칸 | 고정값 | `slot = 0` | 잡음(1) K2 | — |
| M-x | `parts.ts` 적중 | 뒤집기 | `cached && !includeNested` | 잡음(1) | 독립 축 |
| M-e | 타일 본문 | 맞바꿈 | 두 분기 교환 | 잡음(10) | — |
| M-f | 타일 헤더 | 맞바꿈 | 두 분기 교환 | 잡음(8) | — |

## 3. gate (마지막 수정 뒤 트리, `git status` 깨끗 — lint `--fix`가 트리를 바꾸지 않음)

| 단계 | 관측 |
|---|---|
| `npm run lint` | 0 error · 2 warning(기존 `react-hooks/incompatible-library`) |
| `npm run typecheck` | web·test 모두 error 0 |
| 가드 4종 | migrations ok · doc-inventory ok(generated·prose·links) · product-naming OK 2226파일 · test-budgets 18 suites ok |
| vitest 파일 필터 없음 | 2400 suites · 8813 케이스 · passed 8363 · failed 320(68파일) — 구현 보고와 수치 일치. 이번 변경이 만진 파일(parts·wiring·nonExecution·rightPanelTiles·BackgroundModelLabel·taskSurface0212·AgentTaskRow·InlineSubagentDetail 등)의 실패 0 |
| `node --test scripts/*.test.mjs` | 이번 턴 미실행 — 구현 보고(868 pass)를 증거로 쓰지 않음, `scripts/**` 변경 0이라 영향 없음 |

- 못 본 것: 변경 전 트리의 vitest를 이번 턴에 다시 돌리지 않아 실패 식별자 양방향 차집합은 직접 재측정하지 못했다. 근거는 케이스 수 일치(8,813−14 신규=8,799 변경 전 보고)와 실패 파일이 만진 파일 0이라는 점 — 환경 서명(ABI·electron)은 `app/AGENTS.md` 기준. 비귀속.
- CI 대응 중 별도 실행하지 못한 단계: electron 필요 단계(바이너리 없음).

## 4. repository operation checks

- 커밋 trailer 3개 파싱 OK(`git log -1 --format='%(trailers:only=true)'`로 `Agent/Handoff/Status/Criteria-Met/Verified-By` 반환). `Criteria-Met: 7/8` = 보고 합계 ✅7·⚠️1과 일치.
- 대상 커밋 좌표: 세 해시 `git cat-file -t` → commit. `origin/main` ref가 이 환경에 없어 `main` 조상 여부는 확인하지 못했다 — PR 브랜치 좌표로 기입하고 병합 뒤 교정 대상.
- `[구현자 기입]` 일곱 필드 존재(설계 리뷰·강제 지점 전수·수정의 잠금·Product/UX·놓친 잠재 문제·구현 보고·Review Signals). 강제 지점 표가 EP-01 5·EP-02 2·EP-03 3자리 전부를 담음.
- INDEX 비고 5줄 이내 확인 — 이번 턴 갱신 행도 5줄 이내.

## 5. 발견

- 비귀속 1: vitest 320 실패는 기존 환경 서명(`better_sqlite3.node` ABI·Electron 미설치·손대지 않은 `src/main` 경로 단언).
- 확장 후보 0 — child 조회 메모(D-008c)의 호출 횟수는 선언 경계 5, 정본 구독 수는 경계 1로 닫혀 있다.
- 사용자에게 알릴 것: D-008·D-010·D-011(범위 선택)은 설계자 판단이다. AC8(사람 실기)은 일괄 실기 목록(a~d)에 남는다.

## Review Signals — 사실만

- 반복 환경 한계: electron 바이너리 없음·better-sqlite3 ABI(vitest 68파일 고정 실패).
- 독립 축 발견 수 0.
- 설계자 = 구현자 = 검증자였다. 독립성은 mutation 재실행·검색 재실행으로만 확보했고 구현자 자기보고 수치는 수치 일치 확인에만 썼다.
