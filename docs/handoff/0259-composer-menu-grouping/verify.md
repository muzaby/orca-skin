# Verify — 0259-composer-menu-grouping

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0259-composer-menu-grouping` |
| 검증자 | Claude Code |
| 일자 | 2026-10-12 |
| 대상 커밋/range | `d289279b..8de244ee` = r1 `8de244ee` |
| 구현 전 plan 기준 | `7f6ed426` (V1 설계, plan/READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `7f6ed426:V1` |
| 라운드 | 1 |
| 상태 | **FAIL** — VP-05·VP-06 `PAIR_FAIL`(plan이 지정한 직접 oracle 부재, 적대 변이 4건 미검출) |
| 자기 검증 여부 | **예** — 구현 커밋 `Agent: claude`. 보고에 없던 축 4건(Z1~Z4)을 넣었다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: `[구현자 기입]` 절만 — hunk 시작 줄이 전부 마커(`:431`) 이후.
- 기준선이 diff로 성립하는가: 예 — 설계 `7f6ed426`, 구현 `8de244ee` 별도 커밋.
- Decision Ledger · Product/UX · AC · V node/pair · §10 · oracle 변경: 없음.
- 채점 기준: `7f6ed426:plan.md` §7(AC2 "컨트롤러 배선 UT(선택 → 스냅샷 텍스트)") · §7-A VP-05 oracle "컨트롤러 UT(스냅샷 텍스트·커서)" · VP-06 oracle "원문 UT(9자리 전달) + AttachMenu 콜백 UT".

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 상속 V 없음 |
| NEW node ↔ REQUIRED pair | 유효 | R-01~03·SD-01·AR-01·02·MD-01~04 → VP-01~11 |
| pair별 path·§10 전수·직접 oracle | 유효 | VP-05·06은 oracle을 이름으로 지정 |
| 선택적 적대 증거 | 유효 | S1~S3·K1·K2·G1·W1 |
| 운영 gate | 유효 | §7-A 3종 |

- root PLAN_GAP: 없음 — 빠진 것은 plan이 지정한 테스트이고, 계약은 명시돼 있다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001·D-009 | 최상위 4행 · 빈 그룹 안내 | `buildAttachMenu` |
| D-002·D-003 | 스킬 `/이름 `·플러그인 `@id ` 커서 자리 삽입 · 관리 → `/plugins` | `CascadeBody` activate → `AttachMenu.onSelect` → `ComposerInputController.onAttachMenuAction` → `attachMenuToken` → `insertComposerToken` → `replaceDraftRange` → `focus(caret)` / `onManagePlugins` |
| D-004 | `/`·`@` 섹션 헤더 공용 | `groupSkillSuggestions` · `AutocompleteSectionHeader` 2파일 |
| D-005 | 항목 `title` → 0257 호스트 | `MenuItem title` |
| D-006 | 같은 데이터 출처 | `useSkills` · `useMentionAutocomplete().plugins` |
| D-007·D-008 | 키보드·hover·배치 | `reduceCascade` · `HOVER_OPEN_DELAY_MS` · `submenuPosition` |
| D-010 | 페이지 콜백 주입 | 생성 5 · 중계 4 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 하위 패널 Esc가 메뉴 전체를 닫는가 | 아니오(코드 읽기) | 포털 컨테이너 body의 React 리스너가 `stopPropagation` → document bubble 단계의 Popover `keydown`에 닿지 않는다(`Popover.tsx` bubble 등록). 실기 확인은 AC12 |
| `position:fixed` 하위 패널 기준 | 정상 | Popover 패널에 transform/filter 없음(`Popover.tsx:129` 클래스) |
| 삽입의 늦은 적용 | 거부 | `replaceDraftRange(value, current.revision, …)` |
| 삽입 경로가 테스트로 잠겼는가 | **아니오** | Z1~Z3 green(§4) |
| '플러그인 관리' 호출이 잠겼는가 | **아니오** | Z4 green(§4) |

## 3. 역방향 탐색

`scan-surface.sh`는 ripgrep 부재로 미실행 — 신규 export 23종 참조 계수로 대신했다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export | 정상 | 23/23 비테스트 참조 ≥1 |
| 테스트 seam `CascadeBody`·`initialState` | 정상 | 비테스트 호출부는 `CascadeMenu` 1곳, `initialState` 미전달 |
| plan §11 신규 테스트 `CascadeMenu.test.ts`·`attachMenuWiring.test.ts` | **부재** | 배선은 `attachMenu.render.test.ts` 원문 단언으로 대체, 컨트롤러·콜백 동작 UT 없음 → D1·D2 |
| 형제 정책 | 정상 | skill·plugin 둘 다 같은 `insertComposerToken` |

## 4. 선택된 적대 증거 재측정

- 등록 변이 7건 중 검출 7 · 미검출 0.
- 자기검증 분모: 보고에 없던 축 4건 — 등록 S2가 겨냥한 "컨트롤러 action 처리" 자리를 실제 컨트롤러에서 깼다(Z1~Z3, 구현자는 S2를 순수 `attachMenuToken`에만 심었다), VP-06 path의 `AttachMenu` 콜백 edge(Z4).

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| S1 스킬·플러그인 하위 맞바꿈 | composer·lib·hooks·shared/ui·pages 115파일 | red 5 | VP-01·08 |
| S2 `attachMenuToken` 접두 `/`↔`@` | 같음 | red 1 | VP-01·05·10 |
| S3 앞 공백 규칙 제거 | lib·composer 96파일 | red 2 | VP-10 |
| K1 `ArrowLeft` 무시 | 115파일 | red 1 | VP-02·09 |
| K2 왼쪽 뒤집기 생략 | 같음 | red 1 | VP-02·09 |
| G1 섹션 안 역순 | 같음 | red 2 | VP-03·11 |
| W1 `ProjectLandingPage` Composer 자리 prop 누락 | 같음 | red 1 | VP-06 |
| Z1 컨트롤러가 커서 대신 `text.length`에 삽입 | 115파일 842케이스 | **green** | VP-05 (독립) |
| Z2 컨트롤러 `focus(inserted.caret)` → `focus(0)` | 같음 | **green** | VP-05 (독립) |
| Z3 컨트롤러가 `replacement.trim()`으로 공백 제거 | 같음 | **green** | VP-05 (독립) |
| Z4 `AttachMenu`가 `managePlugins`에서 콜백 미호출 | 109파일 804케이스 | **green** | VP-06 (독립) |

- Z1~Z4는 현재 코드의 결함이 아니라(현재 코드는 `current.selectionStart`·`focus(inserted.caret)`·`onManagePlugins?.()`로 올바르다) plan이 지정한 oracle이 없어 그 계약이 잠기지 않았다는 증거다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 증거 | §10 전수 |
|---|---|---|---|---|
| VP-08 | MD-01↔UT-01 | PASS | 트리 UT · S1 red | EP-01 4/4 |
| VP-09 | MD-02↔UT-02 | PASS | reducer·좌표 표 · K1·K2 red | EP-03 3/3 |
| VP-10 | MD-03↔UT-03 | PASS | 4경우 UT · S2·S3 red | EP-02 순수부 |
| VP-11 | MD-04↔UT-04 | PASS | 인덱스 UT · G1 red | EP-06 3/3 |
| VP-06 | AR-01↔IT-01 | **PAIR_FAIL** | 원문 9자리 W1 red · **"AttachMenu 콜백 UT" 부재, Z4 green** | EP-05 9/9(prop) · 호출 edge 미잠금 |
| VP-07 | AR-02↔IT-02 | PASS | 훅 반환 `plugins: allPlugins`(같은 `pluginMentionCandidates`) · typecheck | EP-04 1/1 |
| VP-05 | SD-01↔ST-01 | **PAIR_FAIL** | **"컨트롤러 UT(스냅샷 텍스트·커서)" 부재, Z1~Z3 green** | EP-02 컨트롤러 자리 미잠금 |
| VP-01 | R-01↔AT-01~05 | **BLOCKED_BY:VP-05** | AC1·AC4·AC5 ✅ · AC2·AC3은 VP-05·06에 걸림 | — |
| VP-02 | R-02↔AT-06~08 | PASS | reducer·좌표 · AC7 바깥 클릭은 구조 증거(D3) | EP-03 |
| VP-03 | R-03↔AT-09~11 | PASS | 섹션·헤더 · 기존 자동완성 스위트 green | EP-06 |
| VP-04 | R↔AT-12 | 실기 대기 | 사람 실기 | 0 |

- root `PAIR_FAIL`: VP-05 · VP-06. 종속: VP-01 → `BLOCKED_BY:VP-05`(AC2·AC3 행동이 같은 미잠금 경로).

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1 | ✅ | 트리·render · S1 red |
| AC2 | ❌ | 트리·`insertComposerToken` UT는 있으나 plan이 요구한 컨트롤러 배선 UT 부재 — Z1~Z3 green |
| AC3 | ❌ | 원문 prop 전달(W1 red)은 있으나 삽입은 Z1~Z3, 관리 콜백 1회는 Z4 green |
| AC4·AC5 | ✅ | 트리 UT · render `title` |
| AC6·AC8 | ✅ | reducer 키 표 · 좌표 4경우 · K1·K2 red |
| AC7 | ✅ | reducer hover UT · 하위 패널 DOM 포함 render (D3) |
| AC9~AC11 | ✅ | G1 red · 헤더 원문 · 기존 스위트 green |
| AC12 | ⚠️ | 사람 실기 |
| AC13 | ✅ | §9 |

- **합계 재측정**: `✅ 10 · ⚠️ 1 · ❌ 2 = 총 13` · 자기보고 `✅12·⚠️1` · **불일치(AC2·AC3)**.
- **합계 사본 대조**: 자기보고 본문 13 ↔ trailer `Criteria-Met: 12/13` ↔ INDEX `✅12·⚠️1` — 사본끼리는 일치.

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC12 | 트리·키 reducer·좌표·순수 삽입 | 계단식 배치(첨부 10 대비) · hover 검은 툴팁 · 하위 Esc가 한 단계만 닫는지 · 대각선 이동 체감 |

## 9. 게이트 재실행

- lint 0 error · 1 warning(기존) · typecheck exit 0 · 전체 vitest 653 passed · 1 skipped / 6643 passed · 1 skipped · 실패 0 · build exit 0.
- 잔여물: 변이마다 원복, 최종 `git status` clean.

## 11. Repository operation checks

- INDEX 상태 일치 · 좌표 `8de244ee`(`git cat-file -t` commit, 원격 포함) 기입.
- trailer `8de244ee` 7키 파싱.
- `[구현자 기입]` 7필드 존재. 단 "설계 대비 명시적 차이"에 plan §11의 두 테스트 파일을 다른 방식으로 대체한 사실이 없다.

## 12. 구현자 코멘트

| 코멘트 | 판단 | 반영 |
|---|---|---|
| #1 `CascadeBody` export·`initialState` seam | 타당 — 프로덕션 호출부 미전달 | — |
| #2 `attachMenuToken` 분리 | 타당하나 S2를 컨트롤러 자리에서도 확인해야 했다 — Z1~Z3 | D1 |
| #3 하위 Esc `stopPropagation` | 코드 읽기로 성립 · 실기 확인 | AC12 |

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | '+' 메뉴 선택 → 컨트롤러 삽입 경로(`selectionStart`·`replaceDraftRange` 인자·`focus(caret)`)를 잠그는 테스트가 없다 — Z1~Z3 green | VP-05 oracle · AC2·AC3 | **BLOCKING** | 구현: 컨트롤러 동작을 관측하는 UT 추가(예: 스냅샷·액션 → 다음 스냅샷·caret 순수 helper를 컨트롤러가 쓰게 하고 그것을 단언, 또는 훅 하네스). Z1~Z3가 red가 되어야 닫힘 |
| D2 | `AttachMenu`의 '플러그인 관리' 콜백 호출을 잠그는 테스트가 없다 — Z4 green | VP-06 oracle "AttachMenu 콜백 UT" · AC3 | **BLOCKING** | 구현: `AttachMenu`(또는 `onSelect` 분기) 콜백 UT 추가 — Z4가 red, `managePlugins`가 `onAction`으로 새지 않음까지 |
| D3 | AC7 하위 패널 안 mousedown 유지·바깥 닫힘은 plan의 "stub document mousedown UT" 대신 DOM 포함 구조 증거로 잠겼다. `Popover`의 바깥 클릭 자체는 테스트가 없다 | AC7 | NON_BLOCKING | 재구현 시 함께 보강 권장 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일 증상: 없음(최초).
- 관련 plan 지침: VP-05·VP-06이 oracle을 이름으로 지정했고 §11이 테스트 파일 2개를 열거했다.
- 구현 보고의 "설계 대비 차이"가 테스트 대체를 적지 않았다.

## 15. 결론

- 상태: **FAIL**.
- pair: PASS 7 · root PAIR_FAIL 2(VP-05·VP-06) · BLOCKED_BY 1(VP-01) · 실기 대기 1(VP-04).
- PLAN_GAP: 없음.
- AC: ✅10 · ⚠️1 · ❌2(AC2·AC3).
- 다음 단계: 구현자 r2 — D1·D2를 닫고 Z1~Z4를 다시 심어 red를 보고한다.
