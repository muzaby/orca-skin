# Verify — 0267-harness-entry-menu

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0267-harness-entry-menu` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `2544dbd`(r1) … `7bbed6c`(r1.14) — 구현 14턴 · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | V1 `f08fd84` … ΔV16 `b809d9e`(각 ΔV는 구현 전 설계 커밋) |
| V mode / 유효 V | Baseline V + ΔV1–ΔV16, 누적 AC1–57 |
| 라운드 | 1 (verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — ΔV16 §10 EP31 11자리 중 4자리에서 심은 고장이 전 renderer 스위트에서 green이었다.** 등록 변이 M1–M4는 모두 red이고 Code 전용 상태 타일·제목 경로/색·Nav 스킬 간격·케밥 정리·엔진 카드 로고는 잠겼지만, 스위치 전환 애니메이션과 축소 모션(AC53)·상태 패널 그룹 간격(AC54)·모델 메뉴 그룹 로고 색(AC57)은 Chromium 일회성 실측만 좌표로 적혀 gate에서 잠기지 않는다.

## 0. 기준선 / plan 변경 확인

- 각 ΔV는 구현 전 설계 커밋(`Status: designed`)으로 들어왔다 — 기준선 diff 성립.
- 구현 커밋 14개의 `plan.md` `-` 줄을 셌다: 13개는 0줄(자리표시자 제외). r1 `2544dbd`가 §10 EP9 행의 검색 문구를 "아래 검색"으로 옮겼다 — 7자리 목록·의미 불변, 규범 행 편집이 구현 커밋에 섞였다(N1).
- 정책 충돌은 **최신 handoff가 정본**(사용자 지시): D-51→D-55, D-53→D-56 등 0267 내부 대체와 0278(capability 색)·0281(Composer 표현)을 최신으로 채점.
- 채점 기준: 누적 AC1–57(대체 조항 반영), ΔV16 VP52–58 REQUIRED + VP50·51 REGRESSION + 이전 pair REGRESSION, EP31 11자리, 등록 변이 M1–M4.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V 누적 | 유효 | ΔV1–ΔV16 각 절이 NEW/REGRESSION/NOT_REQUIRED·대체 조항을 명시 |
| EP31 자리 목록 | 유효 | 11자리 고정, 검색 명령 기록. 구현자가 146행을 11자리와 대조 |
| 등록 적대 증거 | 유효 | M1(하네스 선택 맞바꿈)·M2(MCP/plugin 하위 목록)·M3(스킬/MCP 목적지)·M4(ensure→refresh) |
| 직접 oracle 좌표 | **관찰** | EP31 ④⑤⑥(그리고 일부 ③⑦⑪)의 좌표가 "Chromium 실측"이다 — 일회성 실측은 좌표가 아니므로 해당 자리는 gate 테스트로 닫혀야 한다. 목록은 고정돼 있어 PLAN_GAP 아님 |
| 운영 gate | 유효 | renderer Vitest·타입·lint·build·boundary·inventory·catalog |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision (ΔV16 중심)

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D-55 | 상태 타일은 Code 전용 | `opencode/rightPanel.ts:18` Work policy에서 `nativeStatus` 제외 |
| D-56 | 제목 표준 활자·브랜드 색·경로 tooltip | `NativeResourcesTile.tsx:31·34·36` |
| D-57 | 스위치 200ms 전환·축소 모션 차단 | `shared/ui/Toggle.tsx:20` `transition-transform duration-200 motion-reduce:transition-none` |
| D-58 | 상태 패널 그룹 간격·Nav 스킬 간격 | `NativeResourcesTile.tsx:88` `[&_[data-menu-heading]:not(:first-child)]:mt-5` · `SourceHeading.tsx:18` |
| D-59 | 케밥 native popup 제거 | `ChatTitleBar` 메뉴 |
| D-60·D-61 | 엔진 카드·모델 메뉴 그룹 로고 색 | `EngineCard.tsx:30` · `composer/ModelMenu.tsx:46-48` |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 케밥 열기만으로 native 조회 | ✅ | `ChatTitleBar.native-resources` 회귀 pass(조회 sink 0 단언) |
| warm 재진입 재조회 | ✅ | M4(J4) red — `NativeResourcesTile.test: shares one cold read…` |
| 시각 계약의 테스트 잠금 | ⚠️ | 스위치 전환·축소 모션·그룹 간격·모델 로고 색은 class/DOM으로 단언 가능한데 gate 테스트가 없다(J7·J8·J13·J15) |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| 삭제된 `NativeResourcesMenu` 잔존 소비 | 없음 | 케밥 소비 코드 삭제, 모델·`CascadeBody`·hook/cache는 상태 타일·Composer가 사용 |
| 형제 슬롯 | 관찰 | 같은 브랜드 색 규칙이 세 곳(상태 제목·엔진 카드·모델 메뉴)에 복제 — 두 곳만 테스트(J11·J10 red, J15 green) |

## 4. 고장 내 보기

- 등록 변이 M1–M4를 현재 위치에 재실행(J1–J4). 나머지는 EP31 재량 고장. 실행: renderer `src/renderer/src` 전체 374파일/3060 기준선 green.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| J1 (M1) | `app/NewChatHarnessMenu.tsx:71` | 맞바꿈 | 선택 backend Claude↔OpenCode | 잡음 | `Sidebar.interaction.test: selects claude/opencode into a fresh draft…` | VP-02 |
| J2 (M2) | `chat/lib/nativeResourcesMenu.ts:56` | 맞바꿈 | MCP↔plugin 하위 목록 | 잡음 | `NativeResourcesTile.test: uses the native rows…`·`nativeResourcesMenu.test: maps distinct MCP and plugin lists…` 외 | VP-06·09 |
| J3 (M3) | `common/composer/AttachMenu.tsx:67` | 맞바꿈 | native 스킬↔MCP 목적지 | 잡음 | `Composer.native-menu.test: highlights selected native @ plugins…` 외 10건 | VP-17 |
| J4 (M4) | `chat/hooks/useNativeResources.ts:35` | 호출 대체 | open의 `ensure` → `refresh` | 잡음 | `NativeResourcesTile.test: shares one cold read between panel and Composer…` 외 | VP50 |
| J5 | `opencode/rightPanel.ts:18` | 제거 | Work policy의 상태 제외 삭제 | 잡음 | `rightPanelTiles.harness.test: limits opencode status to Code and filters persisted Work columns` | EP31 ① · AC51 |
| J6 | `rightpanel/NativeResourcesTile.tsx:31` | 제거 | tooltip의 catalog 경로 우선 삭제 | 잡음 | `NativeResourcesTile.test: shows the correct branded project title, rename and workspace fallback…` | EP31 ② · AC52 |
| J11 | 같은 파일 `:34` | 맞바꿈 | 제목 로고 색 Claude↔OpenCode | 잡음 | 같음 | EP31 ③ · AC52 |
| J12 | 같은 파일 `:36` | 다른 값 | `font-normal` → `font-semibold` | 잡음 | 같음 | EP31 ③ · AC52 |
| J7 | `shared/ui/Toggle.tsx:20` | 제거 | thumb `transition-transform duration-200 motion-reduce:transition-none` 삭제 | **못 잡음** | — | EP31 ④ · AC53 |
| J8 | 같은 줄 | 제거 | `motion-reduce:transition-none`만 삭제 | **못 잡음** | — | EP31 ⑤ · AC53 |
| J13 | `rightpanel/NativeResourcesTile.tsx:88` | 제거 | 후속 그룹 heading `mt-5` 삭제 | **못 잡음** | — | EP31 ⑥ · AC54 |
| J14 | `customize/SourceHeading.tsx:18` | 고정값 | 후속 출처 `pt-8` → `pt-5` | 잡음 | `CustomizeList.render.test: groups skills and MCP by canonical source…` 외 1 | EP31 ⑦ · AC54 |
| J10 | `engine/common/components/EngineCard.tsx:30` | 맞바꿈 | Claude 카드 로고 → OpenCode | 잡음 | `EngineCard.render.test: preserves the claude card label and editable actions` | EP31 ⑩ · AC56 |
| J15 | `composer/ModelMenu.tsx:48` | 맞바꿈 | 모델 그룹 로고 색 Claude↔OpenCode | **못 잡음** | — | EP31 ⑪ · AC57 |

- 검산: 시도 14 = 잡음 10 · 못 잡음 4(J7·J8·J13·J15) · 동치 0. 등록 변이 4/4 red. 못 잡음 4건은 EP31 고정 자리 → `PAIR_FAIL`.
- EP31 ⑧(Nav 보존 내용)·⑨(케밥 정리)는 직접 oracle(`CustomizeList` metadata·`ChatTitleBar.render`)이 pass — 이번에 변이하지 않았다.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP54 | UT | REQUIRED | **PAIR_FAIL** | J7·J8 못 잡음 |
| VP55 | IT | REQUIRED | **PAIR_FAIL** | J14 잡음, J13 못 잡음 |
| VP53 | ST | REQUIRED | PASS | J5 잡음 |
| VP52 | AT | REQUIRED | PASS | J6·J11·J12 잡음 |
| VP56 | AT | REQUIRED | PASS | `ChatTitleBar.render`·`native-resources` 직접 oracle pass |
| VP57 | AT | REQUIRED | PASS | J10 잡음 |
| VP58 | AT | REQUIRED | **PAIR_FAIL** | J15 못 잡음 |
| VP50·51 | — | REGRESSION | PASS | J4(M4) 잡음 |
| VP-01–49(ΔV1–ΔV15) | — | REGRESSION | PASS | J1–J3(M1–M3) 잡음, renderer 374/3060·main 회귀 green |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1–AC50(대체 조항 반영) | ✅ 50 | M1–M3 red, 해당 직접 oracle 스위트 green |
| AC51 Code 전용 상태 타일 | ✅ | J5 잡음 |
| AC52 제목 활자·색·경로 tooltip | ✅ | J6·J11·J12 잡음 |
| AC53 스위치 200ms 전환·축소 모션 | ❌ | J7·J8 green |
| AC54 그룹 간격·Nav 스킬 간격 | ❌ | J14 잡음, J13(상태 패널 그룹 간격) green |
| AC55 케밥 정리 | ✅ | 직접 oracle pass |
| AC56 엔진 카드 로고 | ✅ | J10 잡음 |
| AC57 모델 메뉴 그룹 로고 색 | ❌ | J15 green |

- 합계 재측정: `✅ 54 · ❌ 3 = 57`. 자기보고 `Criteria-Met: 57/57`(`7bbed6c`)과 불일치.

### §10 강제 지점 분모 (EP31)

| 자리 | 결과 |
|---|---|
| ① mode policy | PASS (J5) |
| ② catalog path→header | PASS (J6) |
| ③ 제목 표준·색 | PASS (J11·J12) |
| ④ 스위치 전환 | PAIR_FAIL (J7) |
| ⑤ 축소 모션 | PAIR_FAIL (J8) |
| ⑥ 상태 패널 그룹 heading 간격 | PAIR_FAIL (J13) |
| ⑦ Nav 스킬 출처 간격 | PASS (J14) |
| ⑧ Nav 보존 내용 | PASS (직접 oracle) |
| ⑨ 케밥 정리 | PASS (직접 oracle) |
| ⑩ 엔진 카드 로고 | PASS (J10) |
| ⑪ 모델 메뉴 로고 | PAIR_FAIL (J15) |

- 7/11. 목록 밖 발견 없음.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error/2 기존 warning · renderer 374/3060 · Windows CI #853 green · inventory·links 통과.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 스위치 전환의 실제 프레임·두 테마 | class 단언으로 잠글 수 있음(D2) | 실제 창 체감 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE`(r1.14) → `verify/FAIL`·Codex·라운드 2.
- 대상 커밋: `f08fd84`·`2544dbd`·`b809d9e`·`7bbed6c` `git cat-file -t` = commit. `7bbed6c` trailer 5키 파싱.
- 같은 라운드 impl 14턴은 모두 사용자 요구 변경(ΔV1–ΔV16)에 따른 턴이라 review 트리거(3 초과)에서 제외.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | J7·J8: 스위치 전환·축소 모션 class 삭제 green | EP31 ④⑤ · AC53 · VP54 | BLOCKING (PAIR_FAIL) | ToggleIndicator thumb의 `transition-transform duration-200`·`motion-reduce:transition-none` 단언 |
| D2 | J13: 상태 패널 후속 그룹 heading 간격 삭제 green | EP31 ⑥ · AC54 · VP55 | BLOCKING (PAIR_FAIL) | 상태 타일 컨테이너의 heading 간격 class 단언 |
| D3 | J15: 모델 메뉴 그룹 로고 색 맞바꿈 green | EP31 ⑪ · AC57 · VP58 | BLOCKING (PAIR_FAIL) | ModelMenu provider heading SVG의 하네스별 색 class 단언 |
| N1 | r1 구현 커밋이 §10 EP9 행 검색 문구를 함께 수정(의미 불변) | repository operation | NON_BLOCKING | 이후 규범 행 정정은 설계 커밋으로 |

## 14. Review Signals

- 첫 verify. 구현 14턴이 같은 라운드에서 verify 없이 누적(모두 사용자 요구 변경).
- 관련 plan 지침: EP31이 ④⑤⑥⑪의 oracle을 "Chromium 실측"으로 적었다 — gate 좌표가 아니어서 이번에 미잠금으로 드러남.
- 반복 환경 한계: 실제 창 시각.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: PASS(VP52·53·56·57·VP50·51·VP-01–49) · root PAIR_FAIL 3(VP54·VP55·VP58). PLAN_GAP 없음.
- AC: ✅54 · ❌3 / 57.
- 다음 단계: Codex r2 — D1–D3, 다음 verify는 J7·J8·J13·J15 재실행과 M1–M4.
