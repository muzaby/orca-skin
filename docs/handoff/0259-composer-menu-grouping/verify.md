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

---

# r2 검증

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `80d373bf..cc041181` = r2 `cc041181` |
| 구현 전 plan 기준 | `7f6ed426` (V1) — r1 기준 그대로 |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 라운드 | 2 |
| 상태 | **FAIL** — D1·D2 closed, 새 root `PAIR_FAIL` VP-06(D4: `AttachMenu`의 '플러그인 관리' 행 표시 edge 미잠금) |
| 자기 검증 여부 | **예** — 구현 `Agent: claude`. 보고에 없던 축 7건(S2c·X1~X6)을 넣었고 그중 X5·X6이 미검출 |

## 0. 기준선 (r2)

- 구현 커밋의 `plan.md` 변경: hunk 1개 `@@ -529` — r1 `[구현자 기입]` 이후 r2 절 추가만. Decision·AC·V·§10·oracle 변경 없음.
- 사용자가 요청 후 취소한 ΔV1: 공유 브랜치에 흔적 없음(`80d373bf..cc041181` 6파일, plan에 Delta V 행 0).
- 채점 기준은 r1 §0 인용 그대로(AC2·AC3 · VP-05·VP-06 oracle).

## 2. 비판적 읽기 (r2)

| 질문 | 판정 | 근거 |
|---|---|---|
| 추출이 동작을 보존하는가 | 예 | `runAttachMenuAction` = r1 컨트롤러 본문과 같은 순서(닫기 → attach 분기 → 토큰 → IME 거부 → 삽입 → focus) |
| 컨트롤러가 넘기는 의존성 6개가 잠겼는가 | 3/6 | `snapshot`·`updateSnapshot`·`focus`는 원문 정규식 · `closeMenu`·`compositionActive`·`pickAttachments`는 미잠금(X1~X3) |
| 미잠금 셋이 실제 결함 자리인가 | 1/3 | X1 등가(`replaceDraftRange`·`focus`가 `composing`을 다시 거부) · X2 등가(`CascadeMenu`가 `onSelect` 뒤 `onClose` 호출, 컨트롤러 `onClose`=`setAttachMenuOpen(false)`) · **X3 실결함**(파일 추가 무동작) |
| '플러그인 관리' 행 표시가 잠겼는가 | **아니오** | `AttachMenu`의 `canManagePlugins: !!onManagePlugins` — X5·X6 green |

## 4. 적대 증거 재측정 (r2)

- 실행: 변이마다 파일 백업 → `node node_modules/vitest/vitest.mjs run composer/ features/chat/lib pages`(96파일 737케이스) → 원복. 최종 `git status` clean.
- 첫 실행은 Windows에서 `./node_modules/.bin/vitest` 를 shell로 부르지 못해 12건 전부 산출 없음(`?`)이었다 — exit 0을 증거로 쓰지 않고 실행 경로를 고쳐 재실행했다.

| 변이 | 자리 | r1 | r2 | 귀속 |
|---|---|---|---|---|
| Z1 커서 대신 `text.length` | `composerAttachMenu.ts` | green | **red** 1파일 2케이스 | VP-05 · D1 |
| Z2 `focus(0)` | 같음 | green | **red** 4 | VP-05 · D1 |
| Z3 `replacement.trim()` | 같음 | green | **red** 4 | VP-05 · D1 |
| Z4 `managePlugins` 콜백 미호출 | `AttachMenu.tsx` | green | **red** `attachMenuSelect` 1 | VP-06 · D2 |
| S2c 컨트롤러 자리 접두 맞바꿈 | `composerAttachMenu.ts` | (S2는 lib 자리만) | **red** 4 | VP-05 등록 S2 |
| X7 `closeMenu()` 삭제 | `composerAttachMenu.ts` | — | red 6 | VP-05 (독립) |
| X1 `compositionActive: () => false` | 컨트롤러 | — | green · **등가** | — |
| X2 `closeMenu: () => undefined` | 컨트롤러 | — | green · **등가** | — |
| X4 `value.revision` 으로 비교 | `composerAttachMenu.ts` | — | green · **등가**(읽기·갱신이 같은 동기 호출) | — |
| X3 `pickAttachments: () => undefined` | 컨트롤러 | — | **green** · 실결함 | 파일 추가(기존 동작) → D5 |
| X5 `canManagePlugins: false` | `AttachMenu.tsx` | — | **green** · 실결함 | VP-06 · AC3 → **D4** |
| X6 `canManagePlugins: true` | `AttachMenu.tsx` | — | **green** · 실결함 | VP-06 · §10 선택적 필드 → **D4** |

- 덮개 회귀: 없음 — r1 red 변이 중 이번 diff가 닿은 것은 S2뿐이고 lib 자리(`attachMenuModel` 테스트)는 코드 무변경, 컨트롤러 자리 S2c는 red.
- X5는 §10 EP-05 `실패 의미`("'플러그인 관리' 미표시")를 프로덕션 5화면 전부에서 그대로 재현하는데 스위트가 침묵한다. VP-06 path는 `… → Controller → AttachMenu` 로 이 edge를 명시하므로 PLAN_GAP이 아니라 VP-06 분모의 미잠금이다.

## 5. V-pair closeout (r2)

| Pair | r2 결과 | 근거 |
|---|---|---|
| VP-05 | **PASS** | `composerAttachMenu.test.ts` 4경우 텍스트·caret·focus 1회 · Z1~Z3·S2c·X7 red · 컨트롤러 의존성 중 결함 가능한 자리(`snapshot`·`updateSnapshot`·`focus`)는 원문 단언, 나머지 둘은 등가 |
| VP-06 | **PAIR_FAIL** | 콜백 edge는 Z4 red로 닫힘 · 행 표시 edge(`!!onManagePlugins`)가 X5·X6 green — D4 |
| VP-01 | **BLOCKED_BY:VP-06** | AC2 ✅(VP-05) · AC3의 '플러그인 관리' 행이 VP-06 미잠금 edge에 걸림 |
| VP-02·03·07~11 | PASS (r1 증거 좌표) | 코드 무변경 |
| VP-04 | 실기 대기 | AC12 |

### AC 합계 (r2)

- `✅ 11 · ⚠️ 1 · ❌ 1(AC3) = 총 13` · 자기보고 `✅12·⚠️1` · 불일치 AC3.
- 사본 대조: 본문 `✅12·⚠️1·❌0` ↔ trailer `Criteria-Met: 12/13` ↔ INDEX `✅12·⚠️1` — 사본끼리는 일치.

## 9. 게이트 (r2)

- lint 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts`) · typecheck `error TS` 0 · exit 0.
- 관련 vitest(plan §7-A 범위 `features/chat` · `shared/ui` · `pages`) 235파일 1851케이스 pass · 실패 0.
- 전체 vitest는 이번 라운드 미실행 — 변경이 composer 4파일이고 plan gate가 관련 범위를 지정한다.

## 11. Repository operation checks (r2)

- INDEX 좌표 `cc041181` 기입(`git cat-file -t` commit, origin 포함).
- trailer `cc041181` 7키 파싱.
- `[구현자 기입]` r2 7필드 존재 · 합계 사본 일치.

## 13. Finding disposition (r2)

| # | finding | 귀속 | disposition |
|---|---|---|---|
| D1 | 컨트롤러 삽입 경로 미잠금 | VP-05 | **closed** — Z1~Z3 red |
| D2 | '플러그인 관리' 콜백 미잠금 | VP-06 | **closed** — Z4 red |
| D3 | AC7 바깥 클릭 stub UT 부재 | AC7 | NON_BLOCKING · open(r1 그대로) |
| D4 | `AttachMenu`가 `onManagePlugins` 유무로 '플러그인 관리' 행을 그리는지 잠기지 않았다 — X5(항상 숨김)·X6(항상 표시) green | VP-06 path 마지막 edge · AC3 · §10 EP-05 실패 의미·선택적 필드 | **BLOCKING** — `AttachMenu`를 콜백 있음/없음으로 렌더해 `CascadeMenu`가 받은 `items`(또는 플러그인 하위)에 관리 행 유무를 단언. X5·X6 red로 닫힘 |
| D5 | 컨트롤러가 `pickAttachments`를 넘기는 자리가 잠기지 않았다 — X3 green(파일 추가 무동작) | 기존 파일 추가 동작 · 현재 pair 밖 | NON_BLOCKING — D4와 함께 원문 단언에 `pickAttachments: () => void pickAttachments(),` 추가 권장 |

## 14. Review Signals (r2)

- 이전 라운드와 유사 증상: 예 — r1 D2와 같은 VP-06 pair, 다른 edge(콜백 호출 → 행 표시).
- 관련 plan 지침: VP-06 path가 `AttachMenu`까지 명시, §10 EP-05 실패 의미가 "미표시".
- 구현 보고의 "다른 무효화 축" 행은 컨트롤러 의존성만 셌고 `AttachMenu` 의 prop → 트리 파생은 세지 않았다.
- 반복 환경 한계: Windows에서 `.bin/vitest` shell 호출 실패 · cp949 출력 인코딩.

## 15. 결론 (r2)

- 상태: **FAIL**.
- pair: PASS 8 · root PAIR_FAIL 1(VP-06) · BLOCKED_BY 1(VP-01) · 실기 대기 1(VP-04).
- PLAN_GAP: 없음.
- AC: ✅11 · ⚠️1 · ❌1(AC3).
- 다음 단계: 구현자 r3 — D4를 닫고 X5·X6 red를 보고한다(D5 권장).

---

# r3 검증

## 메타 (r3)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `349f6701..399a36ce` = r3 `399a36ce` |
| 구현 전 plan 기준 | `7f6ed426` (V1) — r1 기준 그대로 |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 라운드 | 3 |
| 상태 | **FAIL** — D4·D5 closed, 새 root `PAIR_FAIL` VP-07(D6: plan이 지정한 "훅 반환 UT" 부재, 전체↔필터 목록 맞바꿈 V4 green) |
| 자기 검증 여부 | **예** — 구현 `Agent: claude`. 보고에 없던 축 5건(V1~V5)을 넣었고 V2~V5가 전 gate 통과 |

## 0. 기준선 (r3)

- 구현 커밋의 `plan.md` 변경: hunk 1개 `@@ -621` — r2 `[구현자 기입]` 뒤 r3 절 추가만. Decision·AC·V·§10·oracle 변경 없음.
- production 변경 0 — `399a36ce` app diff는 테스트 2파일(`attachMenuSelect.test.ts`·`composerAttachMenu.test.ts`).
- 채점 기준: r1 §0 인용 + `7f6ed426:plan.md` VP-07 oracle "훅 반환·트리 UT" · §10 EP-04 "반환 `plugins`(전체 후보) — 실패 의미: 메뉴와 `@` 후보 불일치" · §8 "필터용·전체용 — 메뉴는 전체용을 쓴다".

## 2. 비판적 읽기 (r3)

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 단언이 production `AttachMenu`를 통과하는가 | 예 | `CascadeMenu`만 mock, 실제 `AttachMenu` → `buildAttachMenu` 트리를 `captured.items`로 관측 |
| '콜백 없음' 케이스가 관리 행 부재를 보는가 | 예 | `not.toContain('action:managePlugins')` · 남는 구분선은 `attachMenuModel.test.ts:62`가 본다 |
| 원문 블록 8줄이 의존성 6개 전부인가 | 예 | `ComposerInputController.tsx:196-203`과 일치 · `.gitattributes` `eol=lf` |
| 컨트롤러 → `AttachMenu` 데이터 prop(`skills`·`plugins`)이 잠겼는가 | **아니오** | V2·V3·V5 green(§4) |
| VP-07 "훅 반환 UT"가 있는가 | **아니오** | `useMentionAutocomplete.test.ts` 17케이스에 `plugins` 반환 단언 0(`grep -n "\.plugins\|allPlugins"` → 0) · r1 PASS 근거는 코드 읽기 + typecheck |

## 4. 적대 증거 재측정 (r3)

- 실행: 변이마다 백업 → `node node_modules/vitest/vitest.mjs run composer/ features/chat/lib [features/chat/hooks] pages` → 원복. hooks 제외 96파일 739케이스, 포함 102파일 777케이스. green 변이는 `eslint <file>` · `tsc -p tsconfig.web.json`도 실행. 최종 `git status` clean.

| 변이 | 자리 | r2 | r3 | 귀속 |
|---|---|---|---|---|
| X5 `canManagePlugins: false` | `AttachMenu.tsx` | green | **red** attachMenuSelect 1 | D4 인용 |
| X6 `canManagePlugins: true` | 같음 | green | **red** 1 | D4 인용 |
| X3 `pickAttachments: () => undefined` | 컨트롤러 | green | **red** composerAttachMenu 1 | D5 인용 |
| X1 `compositionActive: () => false` | 컨트롤러 | green·등가 | red 1 | 새 oracle |
| X2 `closeMenu: () => undefined` | 컨트롤러 | green·등가 | red 1 | 새 oracle |
| Y1 `!onManagePlugins` | `AttachMenu.tsx` | — | red 2 | 새 oracle |
| Y2 관리 선택 시 `onAction`도 호출 | 같음 | — | red 1 | 새 oracle |
| Y4 `onAction={(action) => void action}` | 컨트롤러 | — | red 1 | 새 oracle |
| Z1 · Z2 · Z3 · X7 · S2c | `composerAttachMenu.ts` | red | red 2·4·4·6·4 | 덮개 회귀 검사 |
| Z4 관리 콜백 미호출 | `AttachMenu.tsx` | red | red 1 | 덮개 회귀 검사 |
| W1 `ProjectLandingPage` Composer 자리 prop 삭제 | 페이지 | red | red attachMenu.render 1 | 덮개 회귀 검사 |
| **V1** 컨트롤러 `onManagePlugins && false ?` | 컨트롤러 | — | vitest green · **eslint 1 error · tsc 1 error** | VP-06 — gate가 잠금 |
| **V2** 컨트롤러 `plugins={[]}` | 컨트롤러 | — | **green** · eslint 0 · tsc 0 | VP-07 → **D6** |
| **V4** 훅 `plugins: allPlugins` → `plugins`(접두 필터 목록) | `useMentionAutocomplete.ts` | — | **green** · eslint 0 · tsc 0 | VP-07 → **D6** |
| **V3** 컨트롤러 `skills={[]}` | 컨트롤러 | — | **green** · eslint 0 · tsc 0 | D-006 스킬 절반 → D7 |
| **V5** 컨트롤러 `skills={autocomplete.suggestions}` | 컨트롤러 | — | **green** · eslint 0 · tsc 0 | D-006 스킬 절반 → D7 |

- 재측정 합계: 인용 3/3 red · 새 oracle 5/6 재실행 red(Y3은 Y2·X6과 같은 단언을 공유해 생략) · 덮개 회귀 0(r2 red 7건 전부 red).
- V4는 §8이 명시한 형제 슬롯(필터용 `plugins` ↔ 전체용 `allPlugins`) 맞바꿈이다. 타입이 같아 typecheck가 못 잡고, `@ji` 토큰 뒤에서 '+'를 열면 플러그인 하위가 접두 일치분만 보인다.
- V2는 5화면 전부에서 플러그인 하위를 '사용 가능한 플러그인 없음'으로 만든다 — EP-04 실패 의미 그대로.
- VP-07은 r1 이후 코드 무변경이지만 r1 PASS의 증거가 plan이 지정한 oracle이 아니었다(코드 읽기 + typecheck). 이전 verify 결론은 증거가 아니므로 재판정한다.

## 5. V-pair closeout (r3)

| Pair | r3 결과 | 근거 |
|---|---|---|
| VP-06 | **PASS** | 9자리 원문(W1 red) · 콜백 edge(Z4·Y2 red) · 행 표시 edge(X5·X6·Y1 red) · 컨트롤러 중계 자리는 원문 `onManagePlugins()` + gate(V1 eslint·tsc red) |
| VP-05 | **PASS** | Z1~Z3·S2c·X7 red 유지 · 의존성 6/6 원문(X1~X3·Y4 red) |
| VP-07 | **PAIR_FAIL** | plan oracle "훅 반환 UT" 부재 · 컨트롤러 → `AttachMenu` `plugins` edge 미잠금 — V2·V4 green(D6) |
| VP-01 | **BLOCKED_BY:VP-07** | AC3 "`@` 후보와 같은 플러그인 목록"이 VP-07 미잠금 edge에 걸림 · AC1·AC2·AC4·AC5 ✅ |
| VP-02·03·08~11 | PASS (r1 증거 좌표) | 코드 무변경 · S1·K1·K2·G1·S3 r1 red |
| VP-04 | 실기 대기 | AC12 |

### AC 합계 (r3)

- `✅ 11 · ⚠️ 1 · ❌ 1(AC3) = 총 13` · 자기보고 `✅12·⚠️1` · 불일치 AC3(r2는 관리 행, r3은 플러그인 목록 출처).
- 사본 대조: 본문 `✅12·⚠️1·❌0` ↔ trailer `Criteria-Met: 12/13` ↔ INDEX `✅12·⚠️1` — 사본끼리는 일치.

## 9. 게이트 (r3)

- eslint(`--fix` 없이 `./src ./scripts`) 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts`) · 트리 무변경.
- typecheck(node·web·test) exit 0 · `error TS` 0.
- 관련 vitest(plan §7-A: `features/chat` · `shared/ui` · `pages`) 235파일 1853케이스 pass · 실패 0.

## 11. Repository operation checks (r3)

- INDEX 좌표 `399a36ce` 기입(`git cat-file -t` commit · `origin/claude/0256-0259-prefs-tooltip-sdk-menu` 포함).
- trailer `399a36ce` 7키 파싱.
- `[구현자 기입]` r3 7필드 존재 · 분모 검산 `0 · 3 · 6 = 9` 행 수 일치 · INDEX 비고 3줄.

## 13. Finding disposition (r3)

| # | finding | 귀속 | disposition |
|---|---|---|---|
| D4 | '플러그인 관리' 행 유무 미잠금 | VP-06 | **closed** — X5·X6 red |
| D5 | `pickAttachments` 전달 미잠금 | 기존 동작 | **closed** — X3 red |
| D3 | AC7 바깥 클릭 stub UT 부재 | AC7 | NON_BLOCKING · open |
| D6 | 메뉴 플러그인 목록이 훅의 **전체** 후보라는 계약이 잠기지 않았다 — 훅 반환 UT 부재(V4 green) · 컨트롤러 `plugins=` 전달 미잠금(V2 green) | VP-07 oracle · §10 EP-04 · D-006 · AC3 | **BLOCKING** — 기존 훅 하네스로 `@` 접두 토큰 중에도 `plugins`가 전체 후보임을 단언(V4 red) + 컨트롤러 전달 원문 단언(V2 red) |
| D7 | 컨트롤러가 `useSkills()` 전체를 넘기는 자리 미잠금 — V3·V5 green | D-006 스킬 절반 · 현재 코드 충족(`ComposerInputController.tsx:423`) · plan에 이 edge oracle 없음 | NON_BLOCKING — D6 원문 단언에 `skills={skills}` 함께 추가 권장 |

## 14. Review Signals (r3)

- 이전 라운드와 유사 증상: 예 — r1 D1·D2, r2 D4와 같은 축(pair path에 적힌 edge 중 테스트가 닿지 않은 자리)이 네 번째 edge(VP-07 데이터 공급)에서 나왔다.
- 관련 plan 지침: VP-07 oracle이 "훅 반환·트리 UT"를 지정 · §8·§10이 전체/필터 구분을 명시.
- r1 검증이 VP-07을 코드 읽기 + typecheck로 PASS 처리했다 — 지정 oracle 부재를 그때 잡지 못했다.
- 반복 환경 한계: 컨트롤러를 node 환경에서 렌더할 수 없어 배선이 원문 단언에 기댄다 · Windows `.bin/vitest` shell 호출 실패.
- 라운드가 4로 올라 3을 초과한다 — 다음 재구현 전 `handoff-review` 진입 조건.

## 15. 결론 (r3)

- 상태: **FAIL**.
- pair: PASS 9 · root PAIR_FAIL 1(VP-07) · BLOCKED_BY 1(VP-01) · 실기 대기 1(VP-04).
- PLAN_GAP: 없음 — VP-07 path·oracle·EP-04가 계약을 명시한다.
- AC: ✅11 · ⚠️1 · ❌1(AC3).
- 다음 단계: `handoff-review`(라운드 4 > 3) → 구현자 r4 — D6을 닫고 V2·V4 red를 보고한다(D7 권장).
