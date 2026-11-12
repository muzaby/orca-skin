# Verify — 0312-bloat-reduction-turn-content-and-composer-catalog

## 메타

| 항목 | 값 |
|---|---|
| slug | `0312-bloat-reduction-turn-content-and-composer-catalog` |
| 검증자 | Claude Code |
| 일자 | 2026-11-12 |
| 대상 커밋/range | `943a520..555f807` (PR 브랜치 좌표 — `main` 미병합, `git merge-base --is-ancestor`는 전부 실패) |
| 구현 전 plan 기준 | `943a520` (설계 단독 커밋, 구현 3커밋 `15a58a3`·`5914806`·`340223b`과 분리) |
| V mode / 유효 V | `Baseline V: V1` / V1 |
| 라운드 | 1 |
| 상태 | **PASS** (기계 범위 — AC9 사람 실기 남음) |
| 확장 창 | verify 1회째 — 창 안. ΔV 없음 |
| 독립 축(⑥) | 등록 목록 밖 6건: 호출 자리 `''` 대체(x1 `service.ts`·x2 `owner.ts`) · 형제 슬롯 맞바꿈(x3 `backend`↔`cwd`) · `retired` 제거(x4) · `owners.set` 제거(x6) · `previousOwner = undefined` 제거(x5) |
| 열거 sweep(⑦) | 1회째 전수 — 항목 29(등록 a~t 20 + 구현자 sweep 재앵커 2 + 독립 7) · 못 잡음 1(x5, 비귀속) |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 1(x5) |
| 구현 주체·문맥 | Claude 구현 · 설계자 = 검증자 — plan validity는 자기 설계 감사다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` diff: `[구현자 기입]` 절 추가뿐(`git diff 943a520..HEAD -- plan.md`의 삭제 줄은 자리표시자 2줄). Decision·AC·V·§10 변경 0.
- 기준선 성립: 예(`943a520`). 채점 기준 = 그 plan의 AC1~AC9 · §10 · VP-01~06.
- plan validity: 유효. EP-01~05 검색을 재실행해 §10 목록과 차집합 0(EP-04 `composer-catalog.ts:51`은 §8이 사본 아님으로 기록 · EP-05 `read` 머리 3줄 = `:63,70,71`). `PLAN_GAP` 0.

## 1~3. 비판적 읽기 · 역방향 탐색

| 질문 | 판정 | 근거 |
|---|---|---|
| 실패 합류의 false success | 없음 | `.then`이 `result.part !== part \|\| 'status' in result`면 throw → `.catch`가 낡음 검사 뒤 실패 슬롯 + `publish()` (`composerCatalogState.ts:157,178-183`). 취소 응답이 ready로 가는 경로 0 |
| `stale()`에서 `disposed` 제거 | 안전 | `disposed = true`는 `dispose` 한 곳(`:197`)이고 바로 `epoch++`(`:198`). 변이 (l) red |
| 소유자 표 확보 한 번 | 동치 | AS-IS는 죽은 준비를 놓은 뒤 표를 다시 얻었다. 새 코드는 놓은 뒤 한 번(`:70-71`). 변이 (t) red(`reports a dead native generation…`) |
| `{ ...req, text }` 누수 | 없음 | `batchContent` 타입이 네 필드 `Pick`. 영수증 content는 같은 결과(`adapter.ts:559-561`) |
| scan-surface | 정상 | 미사용 값 export 0 · 테스트 전용 `buildTurnContent`는 `batchContent`가 프로덕션에서 호출 |

## 4. 증거 재측정

- 선택 변이 (a)~(t) 20 + 구현자 sweep 재앵커: 전부 red, 원복 `git status` 깨끗. (t)는 첫 시도가 구 동작(획득 2회)으로 심겨 green이었고, 단일 획득을 죽은 준비 놓기 앞에 두는 형태로 재심어 red.
- 규칙 칸 분기: `stale` 소유자 항 분해 — k(항 전체)·k2(`previousOwner` 항) 각각 red, j(epoch) red. F1~F5·Q1~Q3·E1~E4 입력 존재를 케이스 실행으로 확인.
- 독립 축 x1·x2·x3·x4·x6 red. **x5** `composerCatalogState.ts` `this.previousOwner = undefined` 제거는 renderer 542케이스 green — 이 줄은 diff가 닿지 않았고 §10·D-011 열거 밖이라 **비귀속**(기존 잠금 공백, 확인용으로만 기록).
- 직전 `못 잡음`·`잡음` 행: 해당 없음 — 첫 verify.

**고장 이력**

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| a·b·c | `adapter.ts:554-556` | 빈 값 | `?? []` → `[]` | 잡음 3·3·3 | `adapter.context-policy.test.ts` 세 경로 | — |
| d·e | `:561` | 호출 대체·제거 | `batchContent(req)` · `...req` 제거 | 잡음 1·1 | 처음 경로 / fork | — |
| f·s1·s2 | `:559,1045` | 제거·호출 대체 | `promptUuid` · prelude/후속을 `{text}`만 | 잡음 1·1·1 | uuid 단언 · 경로별 | — |
| g·h·i | `State.ts:157,181` | 제거 | status 항 · part 항 · 실패 슬롯 대입 | 잡음 4·1·4 | `composerCatalogState.test.ts` | — |
| j·k·k2·l | `State.ts:111,198` | 제거 | epoch 항 · 소유자 항 · previousOwner 항 · `epoch++` | 잡음 2·1·1·1 | 같은 파일 X1~X4 | — |
| m·n·x3 | `shared/composer-catalog.ts` | 제거·맞바꿈 | `sessionId` · `agentKind` · `backend`↔`cwd` | 잡음 2·1·1 | `composer-catalog.test.ts` Q1 | — |
| o·p | `State.ts:211` | 제거 | identity · 정본 키 | 잡음 1·4 | Q2·Q3 | — |
| q·r·s·t | `owner.ts:65,67,68,70` | 제거·재배치 | 범위 대조 · release · `entry = undefined` · 표 확보 앞당김 | 잡음 2·2·2·1 | `handlers/composer-catalog.test.ts` | — |
| x1·x2 | `service.ts:47` · `owner.ts:64` | 고정값 | 키 → `''` | 잡음 2·2 | service · handlers | — |
| x4·x6 | `State.ts` `retired` · `owner.ts` `owners.set` | 제거 | 각 항 | 잡음 1·9 | 상태·핸들러 | — |
| x5 | `State.ts` `previousOwner = undefined` | 제거 | 줄 삭제 | **못 잡음** | — | 비귀속 |

- 검산: 시도 29(t 1차 재심기 제외) = 잡음 28 · 못 잡음 1 · 동치 0 · 경계 0. 동작 보존 추출 라운드 아님(실패 반영 시점 D-012만 변경).
- 형제 슬롯: `scope` 여섯 필드 맞바꿈 x3 검출. 소거 변이 잔여물 진단: typecheck 0.

## 5~9. gate · operation (`app/`에서 실행)

| 항목 | 관측 |
|---|---|
| lint · typecheck | 0 error · warning 2(미접촉 `react-hooks/incompatible-library`) · typecheck 3종 0. lint `--fix`로 트리 변경 0 |
| 가드 4종 | migrations · doc-inventory `--check` · product-naming · test-budgets 모두 exit 0 |
| vitest(필터 없음) | 941파일 / 8,799케이스 · 실패 320 · 변경 전(`943a520` worktree) 8,793케이스 · 실패 320 · 실패 식별자 차집합 ∅(양방향) · 원인 `better_sqlite3.node` 부재·`C:/` 경로 |
| `node --test scripts/*.test.mjs` | 868 pass · 0 fail |
| AC6 | `app/src/main/adapters/opencode` · `adapter.turnEnd.test.ts` diff 0 · `adapter.ts` hunk 5 |
| AC7 | prod `+47 −81` = −34(≥ 28) · test `+187 −5` |
| 커밋 | trailer 5커밋 파싱 정상(Agent·Handoff·Status·Criteria-*·Verified-By) · 좌표는 PR 브랜치(`main` 미병합) |
| `[구현자 기입]` | 7필드 존재 · 강제 지점 표 12행 = §10 자리 12(3+2+2+4+1) · 합계 `✅8·⚠️1·❌0 = 9` 본문·trailer 일치 |

## 10~13. pair · AC · 판정

| Pair | 결과 | 근거 |
|---|---|---|
| VP-01 | PASS | 변이 a~f·s1·s2 red · 좌표 실재 확인 |
| VP-02 | PASS | g·h·i red |
| VP-03 | PASS | j·k·k2·l red · X2 입력 `composerCatalogState.test.ts`(구현자 보정) 확인 |
| VP-04 | PASS | m·n·o·p·x1·x2·x3 red · 정의 1 |
| VP-05 | PASS | q·r·s·t red |
| VP-06 | PASS | 실패 식별자 집합 = 변경 전 |

- AC1~AC8 ✅. AC9(사람 실기)는 사람 몫으로 남는다.
- 사람 실기로 남는 경계: 개발 빌드에서 Claude 첨부 전송·OpenCode 컴포저 목록 표시(plan §19). 못 본 것: Windows `C:/` 경로·DB 로드 스위트(환경 서명).
- **판정 PASS** — 막는 발견 0, PLAN_GAP 0, 필수 gate 통과.

## Review Signals — 사실만

- 구현자가 `못 잡음` 5건을 먼저 메웠고, verify 재실행에서 같은 자리의 새 `못 잡음` 0(비귀속 x5 제외).
- (t) 변이 첫 시도가 구 동작으로 심겨 green — 변이 정의가 "재배치"와 "추가"를 구별하지 못한 하네스 사례.
- 반복 환경 한계: `C:/` 경로·`better_sqlite3.node` 부재(기준선과 같은 서명).

## [검증자 기입] 파생 이슈

해당 없음 — BLOCKING 0.
