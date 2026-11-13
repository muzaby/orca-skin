# Verify — 0318-bloat-reduction-0317-approved-candidates

## 메타

| 항목 | 값 |
|---|---|
| slug | `0318-bloat-reduction-0317-approved-candidates` |
| 검증자 | Claude Code |
| 일자 | 2026-11-13 |
| 대상 커밋/range | `3e7e6fc..c14f189` (i18n `21ab394` · 코드 `080ec61` · 보고 `c14f189`) |
| 구현 전 plan 기준 | `3e7e6fc` (설계 커밋과 구현이 분리 — diff로 기준선 성립) |
| V mode / 유효 V | `Baseline V: V1` / V1 |
| 라운드 / 상태 | 1 / **PASS (기계 범위)** — AC10 사람 실기 대기 |
| 확장 창 | verify 1회째 — 창 안. ΔV 없음 |
| 독립 축(⑥) | 3축·변이 10건 — ① 조회 환경을 `{...process.env}` 사본으로(X1·X2) ② 카드 `task` 구조분해에서 `task` 제거·묶음 비교를 `'running'`으로(X3·X4) ③ 카드 `transcript`·`persistedModel` 고정값(X5·X6) → 전부 red |
| 열거 sweep(⑦) | 1회째 전수 대표 — 시도 29(A 10 · X1~X6 6 · P 13) · 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 1(`backgroundStore.ts:73·75` 이중 조회, 구현 보고와 같음) |
| 구현 주체·문맥 | 설계자 = 검증자 = 구현자(Claude) — plan validity는 자기 설계 감사이며 독립성은 ⑥ 변이와 재측정으로만 확보 |

## 0. 기준선

- 구현 커밋의 `plan.md` 변경: `[구현자 기입]`·상태 칸 추가뿐, 삭제 줄은 `(구현 턴)` 자리표시자 7개. Decision·AC·V·§10 변경 없음.
- 채점 원 기준: `3e7e6fc` plan 그대로(D-001~D-009 ACTIVE, AC1~AC10).
- Plan validity: Baseline V 유효 · NEW node 7개 모두 같은 레벨 REQUIRED pair · pair마다 path·자리 목록·좌표 있음 · EP-02 5자리(`grep` 재실행: 정의 124·125 + 읽는 자리 132·133·190·196, 차집합 0) · EP-03 6자리 + 횟수(113·134~136 + 조립 91~93, 차집합 0) · 운영 gate 열거됨. PLAN_GAP 0.

## 4. 증거 재측정

| 항목 | 이번 턴 관측 |
|---|---|
| AC1·AC2 | `node …/scan/keyset.mjs 3e7e6fc` → 두 파일 `잎 1173→1119 · 지운 잎 54 · 남은 승인 키 0 · 승인 밖 삭제 0 · 새 키 0 · 값 바뀜 0 · 빈 묶음 0`, `ko↔en 차이 0`, exit 0 |
| AC3 | `npm run typecheck` 3종 오류 0 · `npm run lint` error 0·warning 2(변경 밖) · 파일 필터 없는 vitest 944파일: 실패 68파일·320케이스, 기준선(`3e7e6fc` worktree) 실패 파일 목록과 diff 0줄 |
| AC4·AC5·AC6 | 대상 3스위트 90케이스 중 2 failed = 기준선과 같은 `adapter.instances` Windows 경로 2케이스(`C:/two`), 신규·수정 케이스 전부 pass |
| AC7 | numstat `5/9 · 11/20 · 6/65 · 6/65`(추가/삭제) 4파일 · `^[+-]export ` 0줄 |
| AC8 | `GitContextBar.tsx` diff 0줄 |
| AC9 | `git log --name-only`: `21ab394` = 리소스 2파일만, `080ec61` = 코드·테스트 4파일 |

**고장 이력** — 범위: 해당 oracle 스위트. 직전 이력 없음(0회째)이라 ③④는 구현자 35행 중 대표를 재실행.

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| A1 | `adapter.ts:132` | 맞바꿈 | 조회 폴더 → `nativeWorkingDirectory()` | 잡음 | `adapter.instances` 2 failed | ①④ | — |
| A3 | `:133` | 맞바꿈 | 전역 조회 환경 → `process.env` | 잡음 | 2 failed | ①⑦ | — |
| A4 | `:190` | 맞바꿈 | 컨텍스트 폴더 | 잡음 | 3 failed | ① | — |
| A5·A6 | `:196` | 맞바꿈 | 키 폴더·키 환경 | 잡음 | 2·2 failed | ① | — |
| A9 | `:124` | 뒤집기 | `\|\|` → `??` | 잡음 | 1 failed(빈 문자열) | ⑦ 분기 | — |
| A10 | `:125` | 제거 | `...env` 제거 | 잡음 | 2 failed | ⑦ 분기 | — |
| A11 | `:196` | 맞바꿈 | 키 `'false'`→`'true'`(형제 슬롯) | 잡음 | 4 failed | ⑤ | — |
| X1·X2 | `:132·133` | 다른 값 | 환경 → `process.env` / `{...process.env}` 사본 | 잡음 | 각 2 failed | ⑥ | — |
| P1 | `Content.tsx:91` | 빈 값 | `call` → `undefined` | 잡음 | 2 failed | ① | — |
| P2·P6 | `:92·136` | 뒤집기 | 두 키 식 순서 | 잡음 | 각 1 failed | ① | — |
| P3·P4 | `:94·113` | 고정값·뒤집기 | `settled: false` · `!==` | 잡음 | 각 7 failed | ① | — |
| P5a·P5c | `:134` | 맞바꿈·빈 값 | 카드 `call` → `rows[0].call` / `undefined` | 잡음 | 각 1 failed | ⑤ | — |
| P7·P7b | `:134·113` | 호출 대체 | 카드·거르기에서 재조회 | 잡음 | `'looks up the call of each listed task at most once per render'` | ① AC6 | — |
| X3·X4 | `:127·113` | 제거·다른 값 | 카드 `task` 제거 / 비교를 `'running'` | 잡음 | 19·7 failed | ⑥ | — |
| X5·X6 | `:137·138` | 빈 값 | 카드 `transcript`·`persistedModel` 키 고정 | 잡음 | 각 1 failed | ⑥ | — |

- 검산: 시도 29 = 잡음 29 · 못 잡음 0 · 동치 0(구현자 P2b·P3b·P3c 동치 3건은 코드 근거 `canonicalBackground.ts:92-101`·`:82`를 읽고 수긍하되 재실행하지 않음). `mutate.py` 종료 뒤 `원복 확인: 모든 파일 원문 그대로`, `git status` 깨끗.
- V1~V6(EP-01)은 `keyset.mjs` fail-closed 구조(기준 잎 집합과 양방향 차집합)를 코드로 확인했고 재심기는 하지 않았다 — 못 본 것.

## 5. V-pair closeout

| Pair | 결과 | 직접 증거 |
|---|---|---|
| VP-01 | PASS | `gate:keyset.mjs` exit 0 · typecheck 0 · `resources.test.ts:'ko↔en 리프 키 집합 일치'` pass |
| VP-02·04 | PASS | `adapter.instances.test.ts:'reads resources, holds discovery and scopes requests with %s'`(4) + `'sends default POST…'` · A·X 변이 12 red · 5/5 자리 |
| VP-03·05 | PASS | `CanonicalBackgroundContent.render.test.ts` 42 pass · 분기 ①~④ 입력 존재 · P·X 변이 17 red · 6/6 + 횟수 |
| VP-06 | PASS | AC7~AC9 명령 재실행 위 표 |
| VP-07 | ⚠️ 사람 | AC10 — Electron 바이너리 없는 환경이라 `npm run dev` 불가 |

AC 합계 재측정: `✅ 9 · ⚠️ 1 · ❌ 0 = 총 10` — 자기보고·trailer `Criteria-Met: 9/10`·INDEX 비고와 일치.

## 9. gate

- `npm run lint`(`--fix`) 뒤 `git status` 깨끗 · 가드 3종(`check-migrations-appendonly`·`check-product-naming`·`check-test-budgets`) + `check-doc-inventory --check` OK. `node --test scripts/*.test.mjs`는 이번 턴 미실행(구현자 868 pass 보고) — 못 본 것.
- vitest 환경 서명: 기준선과 같은 파일 집합이 red(Electron·ABI·Windows 경로). 이번 변경 파일의 가드 실패 0.
- 잔여물: `npm ci --ignore-scripts`로 만든 `app/node_modules`(gitignore). 임시 worktree 제거함.

## 11. Repository operation

- INDEX: 상태 `IMPL_DONE` → `verify/PASS(기계 범위)`, 다음 주체 `사람`(AC10) 하나. 비고 5줄 이내로 갱신.
- 좌표: `origin/main` 참조가 이 환경에 없어 `merge-base --is-ancestor` 확인 불가. `git cat-file -t`로 `3e7e6fc`·`21ab394`·`080ec61`·`c14f189` 전부 commit 확인, 브랜치 `ccr-3ba3f7a9-33hn23`. `main` 도착 해시는 병합 뒤 재확인 필요.
- trailer 3커밋 `git log --format=%(trailers:only=true)`로 키 전부 파싱됨(`Agent`·`Handoff`·`Status`·`Criteria-*`·`Verified-By`).
- `[구현자 기입]` 7필드 전부 존재, 강제 지점 표가 EP-01/02/03 자리를 담음, 잠금 표에 sweep 행 15.

## 13. Finding disposition

| # | finding | 분류 | disposition |
|---|---|---|---|
| D1 | `backgroundStore.ts:73·75` 같은 작업에 `callForBackgroundTask` 2회 | 비귀속(0317 자리 목록 밖) | NON_BLOCKING |

## 14. Review Signals

- 이전 라운드와 같은 증상: 없음(첫 verify).
- 반복된 환경 한계: Linux에서 vitest 68파일 red(기준선) · `npm run lint --fix`의 파일 덮어쓰기(구현자 보고).
- 독립 축(⑥) 발견: 0건.

## 15. 결론

- **PASS(기계 범위)** · verify 1회째, 창 안. 막는 발견 0 · PLAN_GAP 0 · REQUIRED pair PASS 6 · 사람 1(VP-07).
- Decision 충족: D-008 W-06 제외·D-003 W-12 유지·D-005 커밋 분리 확인.
- 남은 사람 확인: **AC10** — 백그라운드 패널(실행 중·완료 묶음·카드 열기·모델 라벨)과 한국어·영어 화면 훑기.
- 다음 단계: AC10 확인 뒤 INDEX 행을 archive history로 이동.
