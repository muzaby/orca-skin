# Verify — 0310-bloat-reduction-test-only-exports-and-model-wiring

## 메타

| 항목 | 값 |
|---|---|
| slug | `0310-bloat-reduction-test-only-exports-and-model-wiring` |
| 검증자 | Claude Code |
| 일자 | 2026-11-11 |
| 대상 커밋/range | `5b9c6f5..ca5a9dc` (M1 `5cf44d4` · M2 `d803996` · 보고 `ca5a9dc`) |
| 구현 전 plan 기준 | `5b9c6f5` (V1 READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — AC9 사람 실기 대기 |
| 확장 창 | verify 1회째 — 창 안. 창이 다시 열린 노드 없음 |
| 독립 축(⑥) | 3축 — 소유 인증 순서 뒤집기(V7) · 비우기 키 정규화(V2) · 소유 필터 `authId` 반전(V3). 전부 red |
| 열거 sweep(⑦) | 등록 변이 (a)~(f)·(g)~(l) 중 a·b·c·d·e·f·g~l 재실행 + EP-03 자리별 기본 변이. 구현자 sweep 23행 전부는 재실행하지 못함(14행 시도) · 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 1(기준선 vitest 29파일) |
| 구현 주체·문맥 | 구현자=설계자=검증자(Claude). plan validity가 자기 설계 감사임 — 아래 ⑥ 축으로 보완 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` diff: 상태 `READY → IMPL_DONE`과 `[구현자 기입]` 채움뿐. Decision·AC·§10 변경 없음.
- 기준선은 diff로 성립한다(설계 `5b9c6f5` ≠ 구현 `5cf44d4`).
- Plan validity: 유효. §10 EP-01을 재실행해 plan 패턴 + `redirectLocationOf` 0줄(착수 149줄 → 0), EP-02 0줄. 목록 차집합 ∅.

## 2~3. 비판적 읽기 · end-to-end

- `runtime-model-startup.ts` diff: 비우기 루프 → 정규화 키 → 소유 Set → 재조정 순서가 AS-IS와 같다. `keys`는 Set이라 중복 제거도 같다. 예외는 잡지 않고 전파(§13).
- 폐포 `redirectLocationOf`(16줄)는 `locationOf` 삭제로 생긴 고아다. `git grep -w redirectLocationOf -- app docs` 0줄 — D-011 범위, D-006 ②·③ 해당 없음.
- `system-prompt.md:127` 정정은 `getWorkspacePath`(`paths.ts:88-93`: `project?.cwd || desktopPath`)·`bootstrap.ts:827-828`과 일치.
- `scan-surface.sh` 후보 중 이번 diff가 새로 만든 고아 없음: `FILE_EDIT_TOOL_NAMES`는 `file-edit-tool.ts:19`가 쓴다, 나머지는 변경 전에도 같은 참조 수.

## 4~7. 재측정

| 항목 | 관측 |
|---|---|
| EP-01 | 0줄 · EP-02 0줄 |
| `lens-exports.mjs` | dead 8 + testOnly 31 + 내부 566 = 605 — §8 K1~K7 39이름과 목록 일치(눈으로 대조) |
| AC5 | `git diff 5b9c6f5..HEAD -- no-stray-auth-subscribe.test.ts bootstrap.ts` 0줄 |
| AC7 | prod +11 −368(순감 357 ≥ 280) · test +70 −455(순감 385) |
| 합계 | 구현 보고 `✅8 · ⚠️1 · ❌0 = 9` 재계산 일치. 커밋 trailer `8/9`와 일치 |

## 8. gate

| 명령 | 관측 |
|---|---|
| `npm ci`(ELECTRON_SKIP_BINARY_DOWNLOAD=1) · `ensure-sqlite-abi node` | 성공 |
| 가드 4종 | no-copies ok · product-naming OK 2222파일 · 18 real-git suites ok · prose/links ok |
| `npm run lint` | error 0 · warning 2(기존 `incompatible-library`) |
| `npm run typecheck` | exit 0(test 포함) |
| 전체 `vitest run` | 940파일 중 907 pass · **29 fail** · 4 skip / 8,771케이스 중 22 fail |

- 기준선 분리: 같은 29파일을 `5b9c6f5` worktree에서 재실행 → 29 fail · 22 케이스 fail로 동일. 29파일 ∩ 변경 파일 = 0. 원인은 Electron 바이너리 부재 등 환경(미분류 단언 포함) — 비귀속.
- gate가 만든 트리 변경 없음(`git status` 깨끗). 못 돌린 것: `node --test "scripts/*.test.mjs"`(이번 변경이 `app/scripts`를 만지지 않아 생략), AC9 사람 실기.

## 고장 이력

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| a | `credential.ts` | 제거 | `patSpec` export 떼기 | 잡음 | lens 집합 testOnly 30 | 이행 |
| b | `net-response.ts` | 되살림 | `locationOf` 추가 | 잡음 | lens dead 9 | 이행 |
| c | `chatReducer.ts:1027` | 제거 | `signature` 항 | 잡음 | `chatReducer.parts.test.ts` 2 | 이행 |
| d | `migrate.ts:33` | 다른 값 | `record(name+'x')` | 잡음 | `migrate.test.ts` 3 | 이행 |
| e | `useGitSnapshot.ts:68` | 다른 값 | `includeSummary: true` | 잡음 | composer 디렉토리 4 | 이행 |
| f | `useGitSnapshot.ts:70` | 고정값 | `refreshTick` 비교를 `false` | 잡음 | composer 1 | 이행 |
| L5 | `repository.ts:47` | 제거 | `refs/heads/${base}` 인자 | 잡음 | `repository.test.ts` 1 | 이행 |
| V1 | `runtime-model-startup.ts` | 제거 | 기여 쪽 `canonicalAgentKey` | 잡음 | startup 2 | 이행 I2 |
| V2 | 〃 | 다른 값 | 비울 키를 정규화 값으로 | 잡음 | startup 1 | ⑥ |
| V3 | 〃 | 뒤집기 | 기여 필터 `===` → `!==` | 잡음 | startup 3 | 이행 I1 |
| V4 | 〃 | 제거 | 소유 `Set` 제거 | 잡음 | startup 1 | 이행 I3 |
| V5 | 〃 | 맞바꿈 | `snapshotOf(owner)` → `(authId)` | 잡음 | startup 1 | 이행 I5 |
| V6 | 〃 | 맞바꿈 | `reconcile(owner…)` → `(authId…)` | 잡음 | startup 3 | ⑤ |
| V7 | 〃 | 뒤집기 | 소유 순서 reverse | 잡음 | startup 3 | ⑥ |

잡음 14 · 못 잡음 0 · 동치 0. 하네스 원복 확인 `원복: 모든 파일 원문 그대로`. 수동 변이(a·b·c·e·L5 일부)도 `git checkout`으로 원복, 종료 `git status` 깨끗.

## 6. V-pair closeout

| Pair | 판정 | 직접 oracle 좌표 |
|---|---|---|
| VP-01 | PASS | EP-01 0줄 · lens 집합 일치 · typecheck · 변이 a·b red |
| VP-02 | PASS | `chatReducer.parts.test.ts` · `migrate.test.ts` · `gitSnapshotPlan.test.ts` · `gitQueryReason.test.ts` · `repository.test.ts` · 변이 c~f red |
| VP-03 | PASS | `runtime-model-startup.test.ts` 15케이스 · 변이 V1~V7 red |
| VP-04 | PASS | 가드·bootstrap diff 0 · 해당 테스트 green(전체 vitest 안) |
| VP-05 | PASS | EP-02 0줄 · `check-doc-inventory --check` links ok |

## 9. Repository operation

- 커밋 trailer 3건(`5cf44d4`·`d803996`·`ca5a9dc`)은 `Agent`·`Handoff`가 파싱된다. `Co-Authored-By`가 구현 세션 모델 표기라 이번 검증 커밋과 다르다 — 판정 무관.
- 대상 커밋 좌표: `5b9c6f5` · `5cf44d4` · `d803996` · `ca5a9dc` — 전부 `git cat-file -t` = commit, **`origin/main`의 조상은 아님**(PR 브랜치 좌표, 병합 뒤 교정 필요).
- `AGENTS.md` 변경 없음.

## 판정

**PASS (기계 범위).** 막는 발견 0. 사람이 남은 일: AC9 실기(연결 화면 자격증명 저장·삭제 → 모델 목록 갱신 · git 행 갱신), D-007·D-009·`stage-*` 토큰 선택지 판단.

## Review Signals

- 이전 라운드 없음(1회째). 독립 축 발견 0건.
- 반복된 환경 한계: Electron 바이너리 부재로 vitest 29파일 기준선 실패, AC9 불가.
- 폐포 1건(`redirectLocationOf`)은 plan §11-2 절차가 예정한 것이라 plan 공백이 아니다.
