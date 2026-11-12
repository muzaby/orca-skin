# Verify — 0316-bloat-reduction-0315-candidates-child-cache

## 메타

| 항목 | 값 |
|---|---|
| 판정 | **PASS** (V1 r1 · 기계 범위) — AC12 사람 실기 대기 |
| 검증 회차 | verify 1회째 (확장 창 안) · ΔV 없음 |
| 대상 | 구현 `dcda8c5`·`3caf377`·`bbe4e30`·`a10f205` · 보고 `abff71c` (모두 `git cat-file -t` = commit, 공유 PR 브랜치 좌표 — `main` 미병합) |
| 기준선 | 설계 `354fe8a`. 구현 커밋이 바꾼 plan diff는 `[구현자 기입]`·상태 줄뿐(AC·Decision 변경 0) |
| plan validity | PLAN_GAP 0 — Baseline V · 모든 NEW·CHANGED 노드에 REQUIRED pair · §10 자리 목록 고정 |

## 1. 판정 요약

막는 발견 0 · PLAN_GAP 0 · VP-01~VP-09 PASS · VP-10은 AC10·AC11 측정 PASS, AC12(사람 실기)만 남음.

## 2. 재측정

| 항목 | 재측정 | 보고와 |
|---|---|---|
| prod numstat | M1 −4 · M2 −13 · M3 −42 · M4 +9 (파일 6) · 7건 합 −59 | 일치, AC10(a) 임계 안 |
| 커밋 파일 분리(c) | 4 커밋의 prod 파일이 각 묶음 것뿐 | 일치 |
| 삭제된 `it(`(d) | 0 | 일치 |
| EP 검색 | 집합 필드 `app/src` 0 · `toolNames?.get(` 1 · 델타 비교 2 · 소비처 `useMemo` 0 · `default:` 1(retrying·activity case 0) | §10 변경 후 값과 일치 |
| 제자리 변경 | 저장 메시지 배열·파트 변경 grep: `chatReducer.ts:819`는 `slice()` 사본, 나머지 지역 배열 | 캐시 전제(선언 경계 4) 성립 |
| commit trailer | `abff71c` 파싱 11/12·`Verified-By: pending` 등 키 그대로 반환 | 정상 |

## 3. gate (이번 턴 실행)

- 가드 4종 OK(migrations · doc-inventory · product-naming · test-budgets 18).
- `npm run typecheck` 3종 exit 0 · `npm run lint` 0 error·2 warning(변경 전과 같은 파일) · lint 뒤 `git status` 변화 0.
- 필터 없는 `vitest run`: 실패 68파일·320케이스 · 통과 8,387 — 기준선(plan §8: 68파일·320케이스)과 수치 같고, 이번 변경 파일·테스트가 실패 목록에 든 것 0.
- 못 한 것: 변경 전 트리의 vitest를 이번 턴에 다시 돌려 식별자 집합 `comm`을 직접 대조하지는 않았다(수치·접촉 파일 교집합 0으로 갈음). `node --test scripts/*.test.mjs`는 이번 턴 재실행 안 함 — diff가 `scripts/`를 닿지 않음.

## 4. 고장 이력

하네스 대신 직접 심고 원복했다(`git status` 변화 0).

| ID | 자리 | 종류 | 바꾼 것 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| v01 | `InlineSubagentDetail.tsx` child 호출 | 다른 값(⑥ 독립) | 부모 id → `''` | 잡음 | 인라인 상세 child 단언(T-08b) 외 1건 | — |
| v02 | `map.ts` 편집 패치 투영 | 호출 대체(⑥ 독립) | `readFileEditStructuredPatch(...)` → 원본 `toolUseResult` | 잡음 | `map.fileEdit` 2건 | — |
| v03 | `chatStore.ts` 종료 게이트 | 항 제거(m08) | `\|\| pendingFallback` 제거 | 잡음 | T-02 2건 | — |
| v04 | `parts.ts` 적중 판정 | 뒤집기(c03) | `!== undefined` → truthy | 잡음 | T-07d | — |
| v05 | `map.ts` 델타 가드 | 다른 값(n12) | `typeof === 'string'` → `!== undefined` | 잡음 | T-06 | — |
| v06 | `chatStore.ts` 종료 게이트 전체 제거 | 시도 무효 | 문자열이 telemetry case에도 있어 적용 실패(2회 매치) — 시도하지 않은 고장 | — | — | — |

- 독립 축(⑥) 2건(v01·v02) 모두 red, 새 발견 0. 구현자 sweep 45건 중 4건(m08·c03·n12 외 v03~v05)을 재실행해 일치. 구현자 동치 2건(s04·s06)은 코드 근거(술어가 `name === 'Edit'` · `readParentToolRunId`가 빈 값을 버림)를 읽고 동의.
- 못 본 것: 45건 전수 재실행·`mutate.py` 하네스 사용은 하지 않았다.

## 5. Repository operation checks

- INDEX 비고 5줄 이내 · 다음 주체 하나 · 좌표 자리표시자를 위 커밋으로 채움. AC12 사람 실기가 남아 archive 이동은 0312와 같이 실기 뒤.
- `AGENTS.md` 변경 0 · 구현자 기입 일곱 필드 모두 존재, 강제 지점 표가 §10 자리 37개를 담음.

## 6. 발견 분류

| 분류 | 건수 | 내용 |
|---|---|---|
| 이행·현재 결함 | 0 | — |
| 확장 후보 | 0 | — |
| 비귀속 | 1 | `normalizeResultTelemetry` 위 기존 주석이 문장 중간에서 끊김(구현자 보고 #1) · O-1~O-3(D-015) — 설계자 몫 |

## Review Signals — 사실만

- 이전 라운드 없음 · 독립 축 발견 0건 · 반복 환경 한계: Electron·sqlite 바인딩 부재로 vitest 68파일 실패(기준선과 동수), AC12 실기 불가.
