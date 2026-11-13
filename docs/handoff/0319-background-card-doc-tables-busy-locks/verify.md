# Verify — 0319-background-card-doc-tables-busy-locks

## 메타

| 항목 | 값 |
|---|---|
| slug | `0319-background-card-doc-tables-busy-locks` |
| 검증자 | Claude Code |
| 일자 | 2026-11-13 |
| 대상 커밋/range | `0d76cf0..f1e41de` (특성 `dcaea48` · W1 `c66e663` · W2 `9e56355` · W3 `9b7a85e` · 세대 입력 `6d55edd` · 보고 `f1e41de`) |
| 구현 전 plan 기준 | `0d76cf0` (설계와 구현이 분리 — diff로 기준선 성립) |
| V mode / 유효 V | `Baseline V: V1` / V1 |
| 라운드 / 상태 | 1 / **RETURN_TO_PLAN** — 기계 gate·등록 pair 전부 PASS, 확장 후보 1건(PLAN_GAP) |
| 확장 창 | verify 1회째 — 창 안. ΔV 없음 |
| 독립 축(⑥) | 2축·변이 12건 — ① 틀 표시 속성(`cursor-pointer`·`tabIndex`·`truncate`·점 색: N1~N4) ② 점유 판정과 같은 식에 있는 이웃 조건(N6~N9·N12)·`dispose` 방향(N10·N11) |
| 열거 sweep(⑦) | 1회째 — 구현 sweep 59행 대신 등록 변이 22건 재실행(아래) · 전부 red · 규칙 칸 분기 인용은 구현 보고 표와 같음 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 1(막음 1: D1) · 경계 0 · 비귀속 0 |
| 구현 주체·문맥 | 설계자 = 구현자 = 검증자(Claude) — plan validity는 자기 설계 감사. 독립성은 ⑥ 변이와 재측정으로만 확보 |

## 0. 기준선 / plan 변경

- 구현 커밋의 `plan.md` 변경: `[구현자 기입]`(`:500` 이후 hunk 하나)뿐. Decision·AC·V·§10 변경 없음.
- Plan validity: 유효 — §10 자리 목록 재검색 차집합 0: `<BackgroundCard` 3 · `group/subagent cursor-pointer` `BackgroundCard.tsx:1` · `sessionBusy` 소비처 8줄(잡음 3 제외 5) · `dispose` 구간 `:210-217`. 규칙 칸 ↔ 입력 칸 모순 없음.
- 확인하지 못한 것: 없음(설계·구현 커밋이 분리).

## 1. Product & UX / Decision

- 구 카드 안 버튼 Enter·Space: 카드가 열지 않고 `preventDefault`도 안 부른다(테스트 `backgroundCard.interaction.test.ts` 케이스, 구 카드 안쪽 Enter·Space). 정본 두 카드·클릭·마크업은 변경 전과 같다.
- D-002~D-008: `BackgroundCard` 훅 0 · 새 export 1 · 판정은 `shouldActivateBackgroundCard` 하나.

## 2. 구현 diff 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 동작 변경 | 구 카드 안쪽 키만 | diff 읽음 — 틀 줄 이동 + 제목 지역 상수 |
| false success | 없음 | 특성 테스트가 공용화 전 코드에서 6/6 green(`dcaea48` 사본에서 직접 실행) |
| 렌더당 비용 | 같거나 낫다 | 훅 0 · `=>` 줄 +2/−3 · 제목 식 각 1 |
| W3 prod 변경 | 0 | `git diff --stat` 3파일 0줄 |

## 3. 역방향 탐색

`scan-surface.sh 0d76cf0..HEAD`: 미사용 export 0. 테스트 전용 참조 2(`BackgroundTaskCard`·`SubAgentTaskList`)는 기존 export가 각자 파일 안·상위에서 쓰이고 시그니처가 불변 — 정상. 형제 정책 비대칭 0. 키 판정 grep 4줄(`ToolCard`·`TranscriptActionRow`·`canonicalBackground`·`CascadeMenu`) — 안쪽 대화형 요소 0이라 W1-B3 경계.

## 4. 증거 재측정

- AC5~AC8·AC17·AC18 명령 재실행: 틀 클래스 1 · `<BackgroundCard` 3 · 틀 훅 0 · `=>` +2/−3 · numstat 14/44·6/21·42/0(+62/−65) · `+export` 1 · 제목 식 1·1 · 카탈로그 1행 · W3 prod 0줄 · 첫 구현 커밋 = 특성 테스트 파일만, 그 뒤 그 파일 diff 0 · W2·W3 커밋 경계 맞음.
- AC9·AC10: `tables.mjs` 3파일 `broken 0 · unknown 0` · `--base 9e56355^ --head 9e56355` `changed 1/1/6 = broken at base 1/1/6` · 구현 전 기준 `broken 8`(IPC 1 · app/AGENTS 1 · INDEX 6).
- 장치 민감도(VP-07): G1 재현 red(`broken 1`, 임시 저장소에서). G4는 내가 만든 입력(빈 줄 뒤 파이프 줄)이 표 연속이 아니라 무효 — **G2~G7은 이 턴에 다시 돌리지 못했다**(설계·구현 턴 관측만 있음).
- 자기 실행 재현: 대상 vitest 177파일 1415 green · 파일 필터 없는 vitest 실패 68파일·320케이스 = 구현 전(`0d76cf0` 사본) 실패 집합과 JSON 비교 차집합 ∅, 통과 8394 → 8437(+43) · 오류 서명 better-sqlite3 ABI · lint 오류 0(경고 2, 손대지 않은 파일, 트리 변화 0) · typecheck 3종 0 · budgets·doc-inventory·naming ok · `node --test` 868/868.

### 고장 이력

범위: W1 `harnesses` 982케이스 · W3 renderer 두 파일 · main controller. 하네스 `mutate.py`, 종료 후 원복 확인.

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 하한·출처 | 분류 |
|---|---|---|---|---|---|---|
| F1~F6 | `BackgroundCard.tsx` | 제거·다른 값·뒤집기 | `{...data}`·`aria-label`→title·판정→키만·`preventDefault`·`onOpen?.()`·`onClick` | 잡음 6/6(43·6·7·7·6·4) | ① | — |
| F7 | 같은 파일 | 맞바꿈 | `aria-label={title}` (F2와 같은 식 — 중복 시도) | 잡음 6 | ① | — |
| C1~C4·C7s | `CanonicalBackgroundContent.tsx` | 고정값·다른 값·제거 | 제목→`taskId` · 호출 `data-*`→`generation` · 작업 `data-*`→호출 · `onOpen` 제거 · 호출 세대→`state.generation ?? …` | 잡음 5/5 | ①·⑤ | — |
| L1·L2 | `LegacySubAgentTile.tsx` | 제거·빈 값 | `onOpen` · `title` | 잡음 2/2 | ① | — |
| S1c·S1d·S4c·S3x·S5c·S5d·S5e | `chatStore.ts` · `useDirectoryPicker.ts` | 맞바꿈·제거 | `sessionBusy`→`sessionListening`/`sessionResponding`·가드→`true` | 잡음 7/7 | ①·⑤ | — |
| l2 | `background-controller.ts:214` | 제거 | `clearTimeout` | 잡음 1 | ① | — |
| N1~N4 | `BackgroundCard.tsx` | 제거·다른 값 | `cursor-pointer` · `tabIndex={-1}` · `truncate` · 점 `bg-t6→bg-t5` | 잡음 4/4(6·7·6·6) | ⑥ | — |
| N10·N11 | `background-controller.ts` | 뒤집기·제거 | 세션 일치 `===`→`!==` · `disposed.add` | 잡음 2/2 | ⑥ | — |
| N6 | `chatStore.ts` 캐시 재진입 | 제거 | `hasCachedHistory &&` | **못 잡음**(19 green) | ⑥ | 확장 |
| N7 | `chatStore.ts` `current()` | 제거 | `activeKey === sessionId` | **못 잡음** | ⑥ | 확장 |
| N8 | 같은 곳 | 제거 | `isCurrent() &&` | **못 잡음** | ⑥ | 확장 |
| N9a·N9b | `useDirectoryPicker.ts` `current()` | 제거 | `session.sessionId === target.sessionId` · `!session.loadingSession` | **못 잡음**(4 green) | ⑥ | 확장 |
| N12 | `chatStore.ts` `startHandoff` | 제거 | `src.loadingSession \|\|` | **못 잡음** | ⑥ | 확장 |

- 검산: 시도 34 = 잡음 28 · 못 잡음 6(N6·N7·N8·N9a·N9b·N12) · 동치 0 · 경계 0. `못 잡음` 6건은 모두 확장 후보 한 묶음(D1).
- 등록 변이(① plan 선택 증거) 중 재실행한 것: W1 F1~F7·C1~C5(C5 제외 4+C7s 대용)·L1·L2, W3 S1·S3·S4·S5 대표·l2. **전수는 아니다** — 구현 보고의 59행 중 일부만 직접 재현했다. 재실행 안 한 것: C5·C6·C8~C10·L3·S1a·S1b·S2a~d·S3a·S3b·S3d·S3e·S4a·S4b·S5a·S5b·l3·l4·G2~G7.
- 동작 보존 추출 라운드: 틀 이동은 예 — hunk 되돌림이 아니라 특성 테스트를 공용화 전 코드에서 돌려 방향을 확인했다.

## 5. V-pair closeout

| Pair | 결과 | 증거 |
|---|---|---|
| VP-01·02·03 | PASS | EP-01 S1~S4 좌표 · 특성 6/6 공용화 전 코드 green · 변이 위 표 |
| VP-04 | PASS | `CanonicalBackgroundContent.render.test.ts` 판정 케이스 green(대상 스위트) |
| VP-05 | PASS | `gate:` AC5~AC8 재실행 |
| VP-06 | PASS | `tables.mjs` AC9·AC10 재실행 |
| VP-07 | PASS(부분 재현) | G1 재현. G2~G7은 못 돌림 — 설계·구현 관측을 증거로 받지 않는다는 원칙상 **이 칸은 약한 PASS**(§13 비고) |
| VP-08·10 | PASS | S1~S5 좌표 · 7/7 red · 단 이웃 조건은 D1 |
| VP-09 | PASS | l2·N10·N11 red |
| VP-11 | PASS | 위 gate |
| VP-12 | 사람 대기 | AC20 |

## 6. 숫자·음성 기준

`19/19 · 20(✅19 ⚠️1)` 검산: AC 행 20개 재계산 일치. 강제 지점 19 = EP-01 4 + EP-02 5 + EP-03 2 + EP-04 8. 구현 보고 합계 사본(본문·trailer `19/20`·INDEX)이 같다.

## 9. Repository operation checks

- 커밋 7개 모두 `git cat-file -t` = commit. 구현 보고 커밋 trailer `Agent·Handoff·Status: implemented·Criteria-Met 19/20·Verified-By: pending` 파싱 확인. 중간 커밋은 `Status: partial`(허용값).
- `[구현자 기입]` 7필드 존재 · 강제 지점 표가 §10 자리 전부와 `남긴 곳`을 담음 · 잠금 표에 sweep 행 있음.
- INDEX 비고 갱신 줄 수: 이번 검증 비고 5줄 이하로 작성.
- 대상 커밋 좌표는 INDEX 칸에 채웠다(브랜치 `ccr-dc60b9c9-lw9te1`, 아직 `main` 아님).

## 13. Finding disposition / 파생 이슈

| # | finding | 분류 · 근거 | 귀속 | disposition | 후속 |
|---|---|---|---|---|---|
| D1 | `sessionBusy` 항과 같은 식·같은 함수에 있는 이웃 조건 6자리(`chatStore.ts` 캐시 재진입 `hasCachedHistory &&` · `current()`의 `isCurrent()`·`activeKey` · `startHandoff`의 `loadingSession` · `useDirectoryPicker.current()`의 `sessionId` 일치·`loadingSession`)를 지워도 EP-02 오라클이 green | 확장 — plan이 열거하지 않은 잠금 공백(목록 밖 고장 못 잡음). 인용할 §10 원문 없음: EP-02 규칙 칸은 점유 4분기만 적는다. 현재 결함 아님(코드 동작은 맞음) | VP-08 pair path(같은 판정식) | **PLAN_GAP**(창 안) | 설계자가 채택(자리·구별 입력 추가)하거나 경계 선언(별개 계약이라 이번 범위 밖) |

## 14. Review Signals — 사실만

- 이전 라운드 대비: 첫 라운드. 구현 보고가 이미 EP-01 S2·S3 구별 입력 공백(세대 속성)을 sweep으로 찾아 닫았다 — 같은 모양(규칙 칸이 이웃 값을 안 적음)이 W3 점유 판정 식에서 다시 나왔다.
- 관련 plan 지침: EP-02 규칙 칸이 `sessionBusy` 항만 열거, 같은 술어의 다른 항은 §10 밖.
- 환경 한계: Electron ABI 재빌드로 DB 스위트 68파일 실패(기준선과 동일).
- 독립 축(⑥) 발견: 12건 중 확장 1묶음(6자리).

## 15. 결론

- 상태: **RETURN_TO_PLAN** · verify 1회째 — 창 안.
- pair: REQUIRED·REGRESSION PASS 11(VP-07은 부분 재현) · PAIR_FAIL 0 · 사람 대기 1(VP-12).
- PLAN_GAP: D1 — 설계자가 이웃 조건 6자리를 EP-02에 채택하거나 경계로 선언한다. 채택하면 구현 변경은 테스트 케이스 추가뿐(prod diff 0 유지).
- Product/UX·ACTIVE Decision: 충족. AC ✅19 · ⚠️1(AC20) · ❌0 — D1은 AC를 어기지 않는다.
- 운영 gate: 위 재측정 전부 통과.
- 남은 사람 확인: AC20(구 타일 키보드 흐름·시각·GitHub 표 렌더). 못 본 것: 실제 브라우저의 버튼 기본 동작 · G2~G7 재현 · 구현 sweep 59행 중 재실행하지 않은 행(위).
- 다음 단계: 설계자(Claude)가 D1 판정 후 `plan/READY` → 구현은 필요 시 테스트만 추가.
