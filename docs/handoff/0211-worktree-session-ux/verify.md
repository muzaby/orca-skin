# Verify — 0211-worktree-session-ux

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0211-worktree-session-ux` |
| 검증자 | Claude Code |
| 일자 | 2026-09-02 |
| 대상 커밋/range | r1 `b85195e8cc14dd53c056b46c215a7797cc2bcf08` · **r2 `e62a2a074e80da04225eaa6a2746184c73cf5940` + `fe36194e2f062e4b7116d4919c06e053756aca43`** (`b85195e..fe36194`) |
| 구현 전 plan 기준 | r1 `e776360`+`ee5d10d` · **r2 `3b472f7`**(ΔV4 규범 정정 — D10·D11·D12) |
| V mode / 유효 V | `Baseline V + Delta V` / `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4` |
| 검증 기준 plan revision | r1 `ee5d10d:ΔV4` · **r2 `3b472f7:ΔV4`** |
| 라운드 | **2** (ΔV4) |
| 상태 | **FAIL** (r1 FAIL · **r2 FAIL**) |
| 자기 검증 여부 | **설계·구현·검증이 같은 에이전트다.** r1 은 적대 축 8건(6 green), **r2 는 구현 보고가 이름을 대지 않은 축 9건을 넣었고 그중 4건이 green** 이다 |

---

## Verify r1 (ΔV4) — FAIL

**판정: `FAIL`.** 동작은 내가 읽은 범위에서 전부 옳다 — 결함은 **잠금**에 있다. pair 가 자기 직접 oracle 로 등록한 단언 중 **7개 pair 분**이 존재하지 않고, 그 자리를 깨는 변이가 green 이다. `PLAN_GAP` 은 없다 — 빠진 oracle 을 plan 이 전부 이름으로 적어 두었다(AT-43 렌더 · AT-50 스텁 · AT-52 인자 · AT-44 detached · §10 EP-34 ② · EP-36 ①②). 다음 주체는 구현자다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: **예 — 추가만 119줄**(`git show b85195e -- …/plan.md` 의 단일 hunk `@@ -3080,6 +3080,125 @@`, 삭제 0줄).
- **기준선이 diff 로 성립하는가**: **예.** 설계 커밋 `e776360`·`ee5d10d` 와 구현 커밋 `b85195e` 가 분리돼 §0 의 자기 증명 방지 장치가 작동한다.
- Decision Ledger 변경: **없음**(구현 커밋의 plan diff 는 `## [구현자 기입] … (ΔV4)` 7절뿐).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음 — AT-43~AT-54 원문이 `ee5d10d` 시점 그대로다.
- V node/pair·requiredness·§10·oracle 변경: 없음.
- 채점에 사용할 원 기준: `ee5d10d` 의 §7 ΔV4 AC 12행 · §7-A ΔV4 pair 20행 · §10 EP-28~EP-36.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 기준 `V1+ΔV1+ΔV2+ΔV3 @ 46047ac` 가 실재 커밋(`git cat-file -t 46047ac` = commit) |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | **1건 누락** | `lib/diffPatchLines.ts` 는 §11 이 "**신규** 순수 / 테스트 seam 신규" 로 적은 새 모듈인데 MD node 가 없다 → D9 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | VP-22·29·30·31·35·39·40~42·45·48·50 이 ΔV4 경로에 매핑됨 |
| pair별 path·§10 전수·직접 oracle | 유효 | 12 REQUIRED 전건이 path·oracle·§10 지점 수를 갖는다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | `required` 11 · `not selected` 9 각각 이유가 붙어 있다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | ΔV4 gate 차분 7행이 lint·typecheck·test·inventory·IPC 문서·i18n·append-only 를 열거 |

- D9(`diffPatchLines.ts` node 누락)를 **`PLAN_GAP` 으로 올리지 않는다**: 계약이 `lib/diffLines.ts` 로 이미 결정돼 구현자가 고를 것이 없었고, §11 이 그 파일의 테스트 seam 을 "신규" 로 이미 지시했다. 구현자가 새 규범 행 없이 닫을 수 있다.
- root `PLAN_GAP`: **없음**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-069 · D-070 · D-071 | 컨텍스트 바가 세션 시작 브랜치 이름 하나만 그린다 | `0020` → `insertSession` → `getSessionBaseline` → `handlers/git.ts:92` → `GitDiffSummary.base.ref` → `summaryBaseText` → `GitContextBar:180` |
| D-073 · D-074 · D-075 · D-076 | 한 화면 연속 review, 범위당 패치 1회, 전문맥 | `DiffTileContent` → `useGitPatch` → `orca:git:diffPatch` → `gitDiffPatch()` → `parseUnifiedPatch` → `DiffReview` → `FileDiffSection` |
| D-079 · D-080 | 커밋 모드는 목록만 좁히고 diff 기준은 세션 유지 | `gitSnapshot.comparison` → `diffSections()` → 같은 `GitDiffPatchFile` **객체 참조** |
| D-083 · D-084 · D-092 | 사이드바 기본 숨김, 두 구획, 파일 선택은 스크롤 | `sidebarVisible` → `ChangedNavigationSidebar` → `onPickFile` → `DiffReview.pickFile` → `scrollIntoView` |
| D-086 · D-087 · D-088 | `⋮` 8항목, 표시 옵션 넷은 순수 파생 | `DIFF_VIEW_MENU_ITEMS` → `chatActions.setDiffViewOption` → `gitSnapshot.view` → `diffDisplay.ts` |
| D-091 | `↗` 는 기존 열 폭 축을 토글 | `GitContextBar` → `nextDiffPanelWidth` → `setRightPanelColWidth` |
| D-093 | 요구사항은 파일 섹션에서, 재anchor 는 패치 도착 시점 | `RECEIVE_GIT_PATCH` → `reanchoredRequirements` → `FileDiffSection` 줄 |

### end-to-end 흐름

```text
타일 열기 → DiffTileContent 마운트 → useGitPatch(patch === null)
  → orca:git:diffPatch → handlers/git.ts(baselineFor) → gitDiffPatch()
  → git -c core.quotePath=false diff --unified=1000000 -M --no-color <base>   (실패 시 --unified=3 1회)
  → parseUnifiedPatch(상한 3종)
  → RECEIVE_GIT_PATCH(세대 판정) + 요구사항 재anchor
  → DiffReview(사이드바 | 연속 섹션) → FileDiffSection(gap·표시 옵션·요구사항)
  → 성공: 파일별 diff · 실패: diffPatchUnavailable · 축소: diffContextLimited
```

**판정: 경로가 끊긴 자리는 없다.** 위 홉 전부를 코드에서 따라갔고 소비자가 없는 산출은 발견하지 못했다.

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 값으로 보인다 | 전문맥 실패 → `--unified=3` → 둘 다 실패 시 `unavailable:true` 로 문구(`DiffReview:89`) |
| false success 가능성 | **없음** | 빈 `files` 와 `unavailable` 가 다른 필드다 — 빈 목록이 "변경 없음" 으로 읽히지 않는다 |
| partial failure/rollback | 새 축 없음 | `baseline_ref` 가 `baseline_oid` 와 **한 `insertSession` 문장**(`queries.ts:116`) — 이름/커밋이 갈리는 조합이 생기지 않는다 |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | 커밋 모드가 `patch.files` 의 **같은 객체**를 재사용한다(`diffComparison.ts:57`) — "목록만 좁힌다" 그대로 |
| 증상만 제거하고 상태가 남았는가 | 아니오 | `diffFile` 채널·`diffBodyCache`·peek 상태가 계약·배선·소비 네 자리에서 함께 사라졌다 |
| 최적화가 잃은 재검증 관측 | **1건** | `RECEIVE_GIT_SNAPSHOT_SUMMARY` 의 `patch:null` 이 코드엔 있으나 **잠기지 않았다** → D3 |
| 출력/요청 worst-case 상한 | 계산 일치 | 파일 200 · 파일당 50,000 · 전체 200,000 줄 → 줄당 80 B 로 약 16 MB, 전용 버퍼 16 MiB. `maxBuffer` 초과는 `execFile` error → `ok:false` → 폴백(`runner.ts:43`) |

- `parseUnifiedPatch` 는 hunk 본문 줄을 **마커(` `/`+`/`-`)로만** 읽는다 — 파일 내용이 `diff --git ` 로 시작해도 마커가 앞에 붙어 블록 분할이 오염되지 않는다(`splitBlocks` 는 `raw.startsWith('diff --git ')`).
- **전체 줄 상한의 의미차 1건**: `overTotal` 은 파일마다 다시 재므로 예산을 넘긴 파일 **뒤에 오는 더 작은 파일은 다시 수집된다**. AC 문구("넘긴 파일부터 too-large")보다 관대하지만 상한 자체는 지켜진다 → D10(NON_BLOCKING).

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh b85195e^..b85195e   # 36 파일
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `diffComparison.ts :: comparisonKey` | **죽은 코드** | `grep -rn '\bcomparisonKey\b' app/src` = **1건(정의뿐)**. 이번 라운드 신규 → D8 |
| `app.css :: animate-depth-out` | **프로덕션 소비처 0** | 참조 3건 전부 테스트(`depthCss.test.ts`·`diffPanelDesign.test.ts`·`diffTile.render.test.ts`). D-092 이유란은 "두 utility 를 재사용" 이라 적었다 → D7 |
| `git-diff-parse.ts :: parseNameStatusZ` | 기준선 한계 | `git grep parseNameStatusZ b85195e^` 도 프로덕션 0 — ΔV3(D-062) 이후 이미 test-only, 이번 변경 아님 |
| `FileDiffSection :: CONTEXT_EXPAND_STEP` | 정상 | 같은 파일 216줄에서 쓴다 — 스캔 오탐 |
| `sessionChangesData :: summaryBaseLabel` | 정상 | 같은 파일의 `summaryBaseText` 가 부른다 |
| 형제 정책 비대칭 | **없음** | 스크립트 §3 "(없음)" |
| producer ↔ consumer 파생 불일치 | 없음 | `GitDiffPatchFile` 의 7종 status·kind 를 `DiffSection`·`FileDiffSection` 이 전부 분기한다 |
| 동일 규칙 중복 구현 | SSOT 유지 | `--no-optional-locks` 는 `git-diff.ts:41` 의 `run()` 관문 하나. `repository.ts` 는 `runGit(readOnly:true)` 로 `GIT_OPTIONAL_LOCKS=0` 을 환경변수로 세워 같은 효과(`runner.ts:27`) — 비대칭 아님 |

**테스트 있음 ≠ 배선됨**: `useGitPatch` 의 프로덕션 유일 호출자가 `DiffTileContent` 임을 스윕이 잠근다(`gitQueryOwner.test.ts`, P34-3 에서 red 확인). `shouldFetchGitPatch`·`gitPatchRequest` 는 test-only 참조지만 같은 파일의 훅이 부르므로 미배선이 아니다.

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트 실제 존재: **예** — `gitRowState.test.ts`·`git-diff.test.ts`·`git-diff-parse.test.ts`·`queries.test.ts`·`migrate.test.ts`·`chatReducer.plan.test.ts` 전부 실재.
- structural proxy 만으로 통과시킨 §10 행: **3건** — EP-28 ②(`rg 'baseRef' service.ts` = 3), EP-36 ①(`rg 'toggleDiffSidebar' GitContextBar.tsx` = 2), EP-36 ②(코드 읽기). 셋 다 아래에서 green 으로 재측정됐다.
- **선택된 적대 증거 재측정**: 구현 보고 표 **20행 전건 재현 → 20/20 RED**. 인용 변이 0(첫 라운드) · 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: ΔV3 잠금 표 13행 중 **10행은 주어가 삭제**돼(`diffBodyCache`·`diffFileCache`·`SessionChangesList`) 재실행 불가. 재실행 가능한 3축 중 **2축이 green** → 덮개 회귀(D5·D6).
- **자기검증 분모**(구현자 = 검증자): 보고에 없던 축 **8건**을 만들었다 — 같은 계약의 다른 지점 3(I1·I4·I5) · 형제/추가 지점 3(I2-total·P29-2·P34-2) · 삭제된 장치의 재측정 2(I2-coords·I3). 그중 **6건 green**.

### 재측정 표 — 등록 변이 (20/20 RED)

| 변이 | 스위트 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 라벨에 `→ 현재` 되살림 | `sessionChangesData.test.ts` | 미실행 | **red(2)** | VP-51 등록 변이 |
| M2 `insertSession` 을 `DO UPDATE` 로 | `writer.test.ts` | 미실행 | **red(1)** | VP-52 |
| M3 개별 접기를 전체 접기로 | `diffTile.render.test.ts` | 미실행 | **red(1)** | VP-53 |
| M4a `patch === null` 조건 제거 | `gitPatchQuery.test.ts` | 미실행 | **red(2)** | VP-54 ① |
| M4b `shouldFetchGitPatch → false` | `gitPatchQuery.test.ts` | 미실행 | **red(1)** | VP-54 ② |
| M5a 파일당 줄 상한 제거 | `git-diff-parse.test.ts` | 미실행 | **red(1)** | VP-55 ① |
| M5b 파일 수 상한 제거 | `git-diff-parse.test.ts` | 미실행 | **red(1)** | VP-55 ② |
| M5c 폴백을 전문맥으로 | `git-diff.test.ts` | 미실행 | **red(1)** | VP-55 추가 |
| M6 `up`↔`down` 맞바꿈 | `diffHunks.test.ts` | 미실행 | **red(3)** | VP-56 |
| M7 세션 패치 무시 | `diffComparison`·`diffTile.render` | 미실행 | **red(2)** | VP-57 |
| M8a 사이드바 커밋 목록 제거 | `diffTile.render.test.ts` | 미실행 | **red(1)** | VP-58 ① |
| M8b 사이드바 연출 utility 제거 | `diffPanelDesign`·`diffTile.render` | 미실행 | **red(2)** | VP-58 ② |
| M9 메뉴 항목 하나 삭제 | `diffViewMenu.test.ts` | 미실행 | **red(1)** | VP-59 |
| M10 파일 경계 없이 재anchor | `chatReducer.plan.test.ts` | 미실행 | **red(1)** | VP-62 |
| M11 삭제 모듈 import 되살림 | `diffPeekRemoved.test.ts` | 미실행 | **red(1)** | VP-61 |
| M12 제거된 i18n 키 되살림 | `diffPeekRemoved.test.ts` | 미실행 | **red(1)** | VP-61 |
| M13 단어 강조 조건 `false` | `diffTile.render.test.ts` | 미실행 | **red(1)** | 새 oracle |
| M14 `wrapLines` 무시 | `diffTile.render.test.ts` | 미실행 | **red(1)** | 새 oracle |
| M15 열 폭 토글 항상 `MAX` | `diffTile.render.test.ts` | 미실행 | **red(2)** | 새 oracle |
| M16 `aria-expanded` 상수 `true` | `diffPanelDesign.test.ts` | 미실행 | **red(1)** | 새 oracle |

### 재측정 표 — 검증자 독립 축 (8건 중 6 green)

| 변이 | 스위트 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| **I1** `GitContextBar` 가 `{label} → feature-x` 를 그린다 | 98파일/924 | 미실행 | **green** | VP-51 — 같은 계약, **AC 가 지정한 지점** |
| **I2-coords** 저장소 좌표 캐시 무력화 | 98파일/924 | red(삭제된 `git-diff-service.test.ts`) | **green** | VP-48 / §10 EP-25 ② — 덮개 회귀 |
| **I3** log 폴백 삭제(`commitFilesUnavailable` 소멸) | 98파일/924 | red(같은 삭제 파일 2케이스) | **green** | VP-31·VP-39 / §10 EP-17 ④⑤ — 덮개 회귀 |
| **I5** `patchLinesToDiffLines` 의 old/new 축 맞바꿈 | 98파일/924 | 미실행 | **green** | node 없음 → D9 |
| **I6** `resolveHeadRef` 를 상수 `'HEAD'` 로 | 98파일/924 | 미실행 | **green** | VP-52 / §10 EP-28 ② |
| **I7** `service.ts` 의 `baseRef` 를 `null` 로 | 98파일/924 | 미실행 | **green**(재실행 확인) | VP-52 / §10 EP-28 ② |
| I4 `baselineOid`↔`baselineRef` 형제 슬롯 맞바꿈 | `writer.test.ts` | 미실행 | **red(2)** | VP-52 — 이 축은 잠겨 있다 |
| I2-total 전체 줄 상한 제거 | `git-diff-parse.test.ts` | 미실행 | **red(1)** | VP-55 ③ |

### 재측정 표 — §10 지점별 추가 축 (5건 중 3 green)

| 변이 | 이번 라운드 | 귀속 |
|---|---|---|
| **P29-2** `PATCH_MAX_BUFFER` 를 4 MiB 로 | **green** | §10 EP-29 ② 전용 버퍼 |
| **P34-2** `RECEIVE_GIT_SNAPSHOT_SUMMARY` 의 `patch:null` 제거 | **green**(77파일/727 전건 통과) | §10 EP-34 ② |
| **P36-1** `⋮ › 파일 표시` 를 no-op 으로 | **green** | §10 EP-36 ① |
| **P36-2** `pickFile` 에서 `onExpandFile` 제거 | **green** | §10 EP-36 ② |
| **P62** 줄별 요구사항 마커 렌더 제거 | **green** | VP-62 / AT-54 렌더 절반 |
| P32-2 `canUp`/`canDown` 상수 `true` | red(1) | §10 EP-32 ② |
| P33-1 공백 접기 우회 | red(1) | §10 EP-33 ① |
| P33-3 side-by-side 짝짓기 파괴 | red(3) | §10 EP-33 ③ |
| P34-3 두 번째 `gitApi.diffPatch` 호출부 추가 | red(2) | §10 EP-34 ③ |
| P35-2 `세션 기준 변경 없음` 문구 제거 | red(1) | §10 EP-35 ② |

- 동작 보존 추출 라운드인가: **아니오** — 화면 구조·채널·스키마가 바뀐다. hunk 되돌림 논점 해당 없음.
- 소거 변이의 잔여물 수렴: 해당 없음 — 위 변이는 전부 값 치환이라 미사용 심볼 잔여물이 남지 않았고, typecheck 를 재실행할 필요가 없었다.
- 형제 슬롯 맞바꿈 변이: **2슬롯**(`baselineOid`↔`baselineRef` = I4) 실행, red. 다른 형제 슬롯(`up`↔`down` = M6) 도 red.
- `N회` 기준의 실제 관측 주체: `diffPatch` 호출 수는 **인자 수집 runner**(`git-diff.test.ts:238`)와 **순수 판정 + 파일 스윕**(`gitPatchQuery.test.ts`·`gitQueryOwner.test.ts`)이 나눠 관측한다 — 구현자가 §설계 대비 차이 1 로 선언한 대체이고, 마운트 순서 자체는 어느 쪽도 보지 못한다.
- 순서 기준의 관측 훅: `pickFile` 의 "먼저 펼치고 그 다음 스크롤" 순서는 **관측 지점이 없다**(P36-2 green).

### 0건/전수 스윕 엄격화 (§8)

| 스윕 | 원 기준 | 엄격화 기준 | 차집합 |
|---|---|---|---|
| `diffPeekRemoved` i18n 키 | 카탈로그에서 `<key>:` 부재 | `app/src` 전역에서 `<key>` 부재 | **0** — 6키 각각 1건, 전부 그 테스트 자신 |
| `diffPeekRemoved` 삭제 모듈 | `from '…<name>'` 부재 | 파일 전체에서 이름 부재 | **0** — 7모듈 각각 그 테스트 파일만 |
| `gitQueryOwner` 조회 소유자 | `gitApi.<api>(` | `.<api>(` (접두 무관) | **0** — 추가 2건은 `shared/api/ipc.ts` 정의부와 줄바꿈된 같은 호출 |

세 스윕 모두 **엄격화해도 0건이 유지**되므로 그 `0건` 은 전수를 뜻한다. 다만 §8 이 경계로 못박은 대로, 엄격화는 *전수인지* 만 재고 *불변식을 잠그는지* 는 재지 않는다 — 그 방향은 M11·M12·P34-3 의 소거 변이가 red 로 판정했다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-56 | R-48·MD-19 ↔ AT-48 / UT | REQUIRED | **PASS** | `diffHunks.test.ts` 방향 6케이스; M6·P32-2 red | EP-32 2/2 |
| VP-59 | R-51·MD-20 ↔ AT-51 / UT | REQUIRED | **PASS** | 8항목 배열 동등; M9·M13·M14·P33-1·P33-3 red | EP-33 4/4 |
| VP-55 | R-47·AR-13·MD-18 ↔ AT-47 / UT+IT | REQUIRED | **PASS** | 임시 저장소 5 status; 상한 셋 각각 red(M5a·M5b·I2-total); 폴백 인자 차집합 red(M5c) | EP-29 2.5/3 · EP-31 3/3 |
| VP-57 | R-49·MD-22 ↔ AT-49 / UT | REQUIRED | **PASS** | 두 모드의 `patch` **객체 동일**; `commit` 멤버 0건; M7·P35-2 red | EP-35 2/2 |
| VP-53 | R-45 ↔ AT-45 / AT | REQUIRED | **PASS** | 한 컨테이너 순서·개별 접기(M3 red)·peek 전수 0건 | EP-30 4/4 |
| VP-61 | R-53 ↔ AT-53 / AT | REQUIRED | **PASS** | 스윕 3종 엄격화 차집합 0; M11·M12 red; AT-45·AT-46 양성과 같은 라운드 green | EP-30 4/4 |
| **VP-51** | R-43·MD-23 ↔ AT-43 / UT+AT | REQUIRED | **PAIR_FAIL** | 순수 4상태는 green(M1 red). **렌더 절반 부재** — `GitContextBar` 를 그리는 테스트 0건, I1 green | EP-28 2/3 |
| **VP-52** | R-44·AR-14 ↔ AT-44 / IT+ST | REQUIRED | **PAIR_FAIL** | 불변·형제 맞바꿈은 green(M2·I4 red). **생산자 미잠금** — I6·I7 green | EP-28 2/3 |
| **VP-54** | R-46·SD-10 ↔ AT-46 / ST | REQUIRED | **PAIR_FAIL** | 판정·소유자는 green(M4a·M4b·P34-3 red). **세대 폐기 절반 미잠금** — P34-2 green | EP-34 2/3 |
| **VP-58** | R-50·MD-21·SD-11 ↔ AT-50 / AT | REQUIRED | **PAIR_FAIL** | 두 구획·트리·연출은 green(M8a·M8b red). **두 지점 전부 미잠금** — P36-1·P36-2 green | EP-36 0/2 |
| **VP-60** | R-52 ↔ AT-52 / AT | REQUIRED | **PAIR_FAIL** | 순수 폭 토글만 green(M15 red). **`setRightPanelColWidth` 인자·`aria-label` 단언 부재** | EP-36 0/2 |
| **VP-62** | R-54·MD-11 ↔ AT-54 / AT | REQUIRED | **PAIR_FAIL** | 재anchor 는 green(M10 red). **줄별 `+`·draft·marker 렌더 단언 부재** — P62 green | EP-23 3/3 |
| **VP-48** | R-39·AR-12 ↔ AT-39 / IT | REGRESSION | **PAIR_FAIL** | `--no-optional-locks` 차집합 0 은 유지(`git-diff.test.ts:264`). **EP-25 ② 좌표 캐시 미잠금** — I2-coords green | EP-11 2/2 · EP-25 2/3 |
| **VP-31·VP-39** | R-25·R-33 ↔ AT-25·AT-33 / IT | REGRESSION | **PAIR_FAIL** | 커밋 목록·절단은 유지. **EP-17 ④⑤ 미잠금** — I3 green, 8 MiB 버퍼 단언 소멸 | EP-17 4/6 |
| VP-29·VP-30 | R-22~R-24 ↔ AT-22~AT-24 / IT | REGRESSION | **PASS** | `queries.test.ts` 레거시 행 `{oid:null,ref:null}`; 미추적 제외 케이스 green |
| VP-35 | R-29 ↔ AT-29 / IT | REGRESSION | **PASS** | `GitDiffPatchRequest` 파싱이 `commit` 을 버린다(`git-diff-schema.test.ts`) | EP-16 2/2 |
| VP-22 | R-18 ↔ AT-18 / IT | REGRESSION | **PASS** | `git-diff.test.ts:107` "커밋하고 트리가 깨끗해도 합계가 0 이 아니다" | EP-11 2/2 |
| VP-50 | R-41 ↔ AT-41 / AT | REGRESSION | **PASS** | `diffPanelDesign.test.ts` 를 새 컴포넌트 3개 집합에 재실행; M16 red | EP-27 3/3 |
| VP-40·41·42·45 | R-34~R-37 ↔ AT-34~AT-37 / IT | REGRESSION | **PASS** | anchor 10키·홉 전수·중화가 자리 이동 뒤에도 green(`chatStore.test.ts` 50) | EP-21 3/3 · EP-22 3/3 |
| VP-01~08·18~21·24~27·46·47·49 | — | NOT_REQUIRED | **NOT_REQUIRED** | plan 이 적은 비영향 근거 확인: `useGitSnapshot.ts`·`CwdButton`·`gitRowState.ts` 가 이번 diff 에 **없다**(`git show --stat`) |

- root `PAIR_FAIL`: **VP-51 · VP-52 · VP-54 · VP-58 · VP-60 · VP-62 · VP-48 · VP-31·VP-39** — 8행. 서로 다른 지점이라 `BLOCKED_BY` 로 접히지 않는다.
- 종속 `BLOCKED_BY`: **없음** — 모든 상위 pair 를 독립 관측했다.
- 하나의 증거가 함께 닫은 pair: I1 이 VP-51·VP-60 의 같은 원인(= `GitContextBar` 렌더 테스트 부재)을 드러내지만 두 pair 의 계약은 다르므로 각각 판정했다.
- 이번 라운드 실행 범위: **최초 검증** — 유효 V 의 REQUIRED 12 · REGRESSION 12행 · NOT_REQUIRED 근거 전건 + 현재 변경의 운영 gate 7종.

### AT / AC 세부와 합계

| AT | 제품/동작 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AT-43 | 기준 라벨은 브랜치 이름 하나, `→`·현재 브랜치 **부재** | ⚠️ | 순수 5케이스 green; **부재 단언이 프로덕션 렌더에 없다**(I1 green) |
| AT-44 | `baseline_ref` 를 출생 시 1회 기록, 이후 불변 | ⚠️ | 불변 green(M2 red); **detached→null 과 managed baseRef 생산자 미관측**(I6·I7 green) |
| AT-45 | 한 화면 연속 review | ✅ | 두 섹션 한 컨테이너·개별 접기(M3 red)·peek 0건 |
| AT-46 | 패치 조회 1회, 파일 수 무관 | ✅ | 닫힘 0·첫 열기 1·왕복 0·40파일 1(`gitPatchQuery.test.ts` 5) + 소유자 스윕 |
| AT-47 | 파일별 줄·상한 셋·축소 재조회 | ✅ | 임시 저장소 5 status; 상한 3 각각 red; 폴백 인자 차집합 |
| AT-48 | 양방향 확장, 조회 0, 키 보존 | ✅ | `insertedAbove` up=n/down=0(M6 red) · 선두·말미 후보(P32-2 red) |
| AT-49 | 목록만 좁힘, diff 는 세션 기준 | ✅ | 같은 파일 `patch` **객체 동일**(M7 red) · `commit` 멤버 0건 |
| AT-50 | 사이드바 두 구획 + 파일 선택이 그 섹션으로 이동 | ⚠️ | 두 구획·트리·카드 green(M8a red); **"이동" 단언 부재**(P36-2 green) |
| AT-51 | `⋮` 8항목 + 표시 옵션 넷 | ✅ | 배열 동등(M9 red) · 넷 각각(P33-1·M13·P33-3·M14 red) |
| AT-52 | `↗` 가 열 폭을 토글 | ⚠️ | 순수 3케이스 green(M15 red); **`setRightPanelColWidth` 인자·`aria-label` 단언 부재** |
| AT-53 | 제거 대상 소멸 | ✅ | 스윕 3종 엄격화 차집합 0 · M11·M12 red · 양성 짝 green |
| AT-54 | 요구사항이 새 자리에서 동작 + 재anchor | ⚠️ | 재anchor green(M10 red); **줄별 `+`·marker 렌더 단언 부재**(P62 green) |

- **합계 재측정**: `✅ 8 · ⚠️ 4 · ❌ 0 = 총 12`. 분모는 §7 ΔV4 표의 AT-43~AT-54 를 직접 세어 **12**.
- 자기보고 값: `✅12 ⚠️0 ❌0`. **불일치** — 자기보고가 ⚠️ 로 낮췄어야 할 4건을 ✅ 로 셌다.
- **합계 사본 대조**: 본문 12 ↔ 커밋 trailer `Criteria-Met: 12/12` ↔ INDEX 비고 `✅12 ⚠️0 ❌0 / 12` — 세 사본은 **서로 일치**하고, 검증 재측정과 갈린다.

### pair별 plan §10 강제 지점 분모

| Pair | 계약 | plan 지점 | 확인 | 결과 |
|---|---|---|---|---|
| VP-51·52 | EP-28 비교 기준 이름 | 3 | **2/3** — ① 마이그레이션·③ 4상태 잠김, ② 생산자 미잠금(I6·I7) | PAIR_FAIL |
| VP-55 | EP-29 한 채널·한 호출 | 3 | **2.5/3** — ①③ 잠김, ② 는 "1회" 만 잠기고 16 MiB 버퍼 미잠금(P29-2) | PASS(D4 기록) |
| VP-53·61 | EP-30 구 본문 경로 소멸 | 4 | **4/4** — M11·M12 + 엄격화 차집합 0 | PASS |
| VP-55 | EP-31 상한 셋 | 3 | **3/3** — M5a·M5b·I2-total 각각 red | PASS |
| VP-56 | EP-32 방향 값 | 2 | **2/2** — M6·P32-2 | PASS |
| VP-59 | EP-33 표시 옵션 넷 | 4 | **4/4** — P33-1·M13·P33-3·M14 | PASS |
| VP-54 | EP-34 세대당 1회 | 3 | **2/3** — ①③ 잠김, ② 미잠금(P34-2) | PAIR_FAIL |
| VP-57 | EP-35 목록만 좁힘 | 2 | **2/2** — M7·P35-2 | PASS |
| VP-58·60 | EP-36 사이드바·확대 | 2 | **0/2** — P36-1·P36-2 둘 다 green | PAIR_FAIL |
| VP-48 | EP-25 합쳐서 한 번·잠그지 않고 | 3 | **2/3** — ①③ 잠김, ② 캐시 미잠금(I2-coords) | PAIR_FAIL |
| VP-31·39 | EP-17 요약 세 범위 | 6 | **4/6** — ④⑤ 미잠금(I3, 버퍼 단언 소멸) | PAIR_FAIL |

- **검증자 재계수: ΔV4 신규 9 EP 의 26지점 중 21 잠김 · 5 미잠금**(EP-28 ②, EP-29 ② 버퍼 반쪽, EP-34 ②, EP-36 ①, EP-36 ②). 구현 보고는 **26/26** 이다 — 그 보고의 근거 중 3건이 `rg` 개수와 코드 읽기였고, §4 가 그것을 증거로 받지 말라고 한 자리다.
- 표에 없는데 같은 불변식이 필요한 지점: **없음**.
- `실패 의미` 가 "다른 게이트가 막는다" 라고 적은 행: **없음**(§10 본문이 그렇게 명시).
- **§10 EP-17 의 표기 오류 1건**: 머리말이 "5지점" 인데 항목은 ①~**⑥** 이고 ΔV4 pair registry 는 `EP-17 (6)` 이다 → D11.

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 결과 | 증거 |
|---|---|---|---|
| `npm run lint` | `app/src/**` 수정 | **PASS** | `0 errors, 1 warning` — 기존분 `useTranscriptVirtualizer.ts:22 react-hooks/incompatible-library` |
| `npm run typecheck` | 같음 | **PASS** | 3구성(`node`·`web`·`test`) 진단 **0줄** |
| `vitest run` 전체 | 새 계약·리듀서·파서 | **PASS(환경 1)** | **305파일 중 304 green · 3029케이스 전건 green**. red 1 = `chat-turn.continuity.test.ts` = `Electron failed to install correctly` — `app/AGENTS.md §제약 환경` 의 알려진 서명이고 이번 diff 에 없는 파일 |
| `node --test "scripts/*.test.mjs"` | 스크립트 게이트 | **PASS** | `# tests 67 # pass 67 # fail 0` |
| `check-doc-inventory.mjs --check` | 채널명·마이그레이션 수 변경 | **PASS** | `9 items, 82 channels` · 산문·링크 검사 ok · 차이 0 |
| `check-migrations-appendonly.mjs` | `0020` 신설 | **PASS** | exit 0 · `20 migrations, dir == migrate.ts imports` |
| IPC 계약 문서 | 채널 교체 | **PASS** | `docs/IPC_CONTRACT.md` 에 `orca:git:diffPatch` 행, `orca:git:diffFile` 부재(`git-diff-schema.test.ts` 가 단언) |

**DB 스위트가 실제로 돌았다**: `queries.test.ts`·`migrate.test.ts` 가 green — 이 컨테이너의 better-sqlite3 는 Node ABI 로 빌드돼 있어 `app/AGENTS.md` 가 말한 "DB 로드 5파일 red" 베이스라인보다 넓게 검증됐다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `orca:git:diffPatch` | `GitDiffPatchRequestSchema` 파싱이 `commit` 을 버린다 | 성공·축소·불가 3상태를 renderer 가 각각 분기 | **PASS** |
| `docs/IPC_CONTRACT.md` | 행 교체 | `git-diff-schema.test.ts` 가 `diffPatch` 존재 + `diffFile` 부재를 단언 | **PASS** |
| `sessions.baseline_ref` | `0020` ALTER 1줄 | 레거시 행이 `{oid:null, ref:null}` | **PASS** |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 변경 파일 재측정: `git show --stat` = **78파일**(main 13 · shared/preload 3 · renderer 신규 12 · renderer 변경 9 · **삭제 13** · i18n 2 · 문서 3 · plan/INDEX 2). 구현 보고의 각 항목과 일치.
- **삭제 목록 불일치 1건**: §18 ΔV4 는 삭제 **10**(소스 5 + 테스트 5)을 적고 `DiffTileHeader.tsx` 를 *변경* 으로 분류했다. 실제 삭제는 **13**(추가분: `DiffTileHeader.tsx` · `SessionChangesList.tsx` · `diffRequirementBridge.ts` · `sessionChangesList.render.test.ts` · `DiffTileContent.bridge.test.ts` · `git-diff-service.test.ts`) → D12.
- 내역 합 = 총계: AC 12 = ✅8+⚠️4+❌0 ✓. §10 26 = 3+3+4+3+2+4+3+2+2 ✓.
- 0건 게이트의 정당한 예외 보존: `gitQueryOwner` 가 `BranchChip.tsx` 예외 1건을 열거하고 그 파일 실재를 함께 단언한다 — 예외가 조용히 넓어지지 않는다.
- 출력 상한 실측: `MAX_PATCH_TOTAL_LINES = 200_000` × 줄당 80 B ≈ 16 MB ≤ `PATCH_MAX_BUFFER = 16 MiB`. `maxBuffer` 초과는 `execFile` 이 error 로 만들어 `ok:false` → 폴백이 받는다(`runner.ts:43`).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

**"UI 라서" 는 이번 미잠금 5건의 이유가 되지 못한다.** 프로브로 확인했다 — `renderToStaticMarkup(createElement(GitContextBar))` 가 **설정 없이 그대로 통과**하고 `data-diff-context-bar` 를 낸다(vitest `environment: 'node'`, 969ms). §11 도 `GitContextBar` 의 테스트 seam 을 "SSR 렌더" 로 적었다.

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 연속 스크롤의 파일 경계 가독성 | 섹션 순서·헤더 구성·`data-diff-file` | **시각 확인** | 3파일 이상 세션에서 타일을 열고 경계가 읽히는지 |
| 사이드바 열기/닫기 연출 | `animate-depth-in` 부착 · 180ms · `motion-reduce` | **끊김 확인** | 폴더 버튼을 반복 토글 |
| 형제 타일과의 이질감 | `Icon`·hover 전이·`group/` 대응 | **시각 확인**(D-067) | 계획·작업 타일과 나란히 |
| 위쪽 문맥 확장 후 시야 유지 | `insertedAbove` 값 | **스크롤 보정 확인**(D-060) | 중간 gap 에서 `︿` 클릭 |
| 마운트 순서 자체 | — | effect 순서는 어느 자동 oracle 도 보지 못한다 | 타일 열고 조회 1회인지 로그 확인 |

## 9. 게이트 재실행

- 실제 실행 명령: `npm run typecheck` · `./node_modules/.bin/vitest run`(전체) · `./node_modules/.bin/vitest run <8 suite>`(변이 40회) · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node --test "scripts/*.test.mjs"` · `npm run lint`.
- **관측한 실행 산출**(exit code 아님): vitest **305파일 / 3029케이스**(실패 1파일은 import 단계) · typecheck **3구성 0줄** · lint **0 error / 1 warning** · scripts **67 pass / 0 fail** · inventory **9 items, 82 channels, 차이 0** · migrations **exit 0, 20 migrations**.
- `npm test` 를 쓰지 않았다: `app/AGENTS.md` 대로 `pretest` 를 우회했고, DB 스위트는 이미 Node ABI 로 green 이라 ABI 를 뒤집을 이유가 없었다.
- 환경 기인 실패 분리 근거: 유일한 red 파일이 `Electron failed to install correctly`(`node_modules/electron/index.js:17`)로 죽고 그 파일은 `git show --stat b85195e` 에 **없다**.
- **게이트가 작업 트리를 바꿨는가**: **아니오** — `npm run lint` 는 `--fix` 지만 실행 후 `git status --porcelain` 이 빈 값이다.
- **검증 중 실행한 명령이 남긴 잔여물**: **없음** — 변이 40회는 전부 `git checkout -- app/src` 로 되돌렸고, 임시 프로브 2개(`__verify_probe.test.ts` · `__probe2.test.ts`)를 삭제한 뒤 `git status --porcelain` 이 빈 값임을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 관측 | — | 전건 수행 |
| AC ↔ production path | 12행 1:1 대조 + 변이 40회 | — | ⚠️4 발견 |
| 레이어/계약/문서 링크 | boundaries lint · inventory · IPC 문서 | — | PASS |
| AGENTS 위생 | 해당 없음 | — | 이번 변경에 `AGENTS.md` 수정 없음 |
| 제품 의도 / Open Question | — | **결정** | 해당 없음 — ΔV4 는 사용자 명시 결정만 담았다 |
| UI/UX 시각 품질 | 구조 단언(D-067) | **시각 확인** | §8 4건 |
| 신규 의존성 / PR merge | 신규 의존성 **0** 확인(`package.json` 이 diff 에 없다) | **승인** | 해당 없음 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 변경에 `AGENTS.md` 수정 **없음**(`git show --stat` 에 부재) → 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 구현 커밋 시점 `impl / IMPL_DONE(ΔV4) / Claude(ΔV4 검증) / (ΔV4 구현 — 검증자 기입)` — 실제 상태와 **일치**했다.
- 「다음 주체」 칸이 주체 하나만 담는가: **예**.
- 대상 커밋 좌표 기입: 검증자가 `b85195e8cc14dd53c056b46c215a7797cc2bcf08` 로 채웠다 — `git cat-file -t` = `commit`.
- **비고 5줄 이내: 위반.** 이번 턴에 갱신된 0211 행의 비고가 **1,055자**(한 칸)로 §산출물 문장 규칙 3 을 넘는다 → D13. 검증 갱신에서 5줄 이내로 줄인다.
- PASS 시 archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Handoff: docs/handoff/0211-worktree-session-ux/` · `Status: implemented` · `Criteria-Met: 12/12` · `Verified-By: pending` — root `AGENTS.md` 표와 일치.
- **trailer 파싱**: `git log -1 --format='%(trailers:only=true)' b85195e` 가 **7키를 그대로** 반환(`Co-Authored-By`·`Claude-Session` 포함) — 메시지 버스 정상.
- 인용된 커밋 해시 실재: `46047ac`(ΔV4 기준 V) · `e776360` · `ee5d10d` 전부 `git cat-file -t` = `commit`.
- `[구현자 기입]` 7필드: **7/7 존재** — 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals. 산문으로 접힌 필드 0.
- 이동/삭제한 reference·script: `git-diff-service.test.ts` 삭제가 **9케이스를 재배치 없이** 없앴다(§4 표) → D5·D6.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 차이 1 — 스텁 호출 수 세기를 순수 판정 + 소유자 스윕으로 분해 | **타당** | 대체물이 더 넓은 분모(파일 하나 → renderer 전체)를 갖고 P34-3 이 red 다. 다만 그 차이가 **세대 폐기 축**(EP-34 ②)까지 덮지는 못했다 → D3 |
| 차이 1 의 이유 "vitest `environment: 'node'` 라 effect 가 돌지 않는다" | **부분적으로만 타당** | effect 는 사실이나 **SSR 렌더는 된다**(§8 프로브). AT-43·AT-50·AT-52·AT-54 의 렌더 단언은 effect 를 요구하지 않는다 |
| 차이 2 — 메뉴 목록을 `diffViewMenuItems.ts` 로 추출 | **타당** | 배열 비교가 M9 에서 red 다. 소비자 1개도 재확인(`rg DIFF_VIEW_MENU_ITEMS` = 정의 + `ViewMenu` + 테스트) |
| 놓친 문제 4 — `MAX_DIFF_FILE_BYTES` 를 죽은 상수로 남겨 선조치 삭제 | **타당** | `grep MAX_DIFF_FILE_BYTES app/src` = 0건 |
| 놓친 문제 5 — `-c core.quotePath=false` | **타당** | `git-diff.test.ts:190` 이 한글·공백 경로를 임시 저장소로 확인 |
| 구현 보고 "강제 지점 26/26" | **미달** | 검증 재계수 **21/26**. 근거 3건이 `rg` 개수·코드 읽기였다(§5 표) |
| V-pair 자기확인 12 `SELF_PASS` | **미달** | 검증 재판정 REQUIRED **6 PASS · 6 PAIR_FAIL** |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `GitContextBar` 를 렌더하는 테스트가 **0건**이라 AT-43 의 "`→`·현재 브랜치 부재" 와 AT-52 의 `setRightPanelColWidth` 인자·`aria-label` 단언이 없다. I1 green | VP-51 · VP-60 / AT-43 · AT-52 | **BLOCKING** | SSR 렌더 테스트 신설(§8 프로브가 가능성을 보였다) |
| D2 | `resolveHeadRef` 와 `service.ts` 의 `baseRef` 계산에 행동 oracle 이 없다. I6·I7 green. §10 EP-28 ② 는 `rg` 개수로 닫혔다 | VP-52 / AT-44 · §10 EP-28 ② | **BLOCKING** | `repository.test.ts` 에 detached·unborn 케이스, `service.test.ts` 에 `baseRef` 산출 단언 |
| D3 | `RECEIVE_GIT_SNAPSHOT_SUMMARY` 의 `patch:null` 이 미잠금. P34-2 green(77파일/727 전건 통과) | VP-54 / §10 EP-34 ② | **BLOCKING** | `chatReducer.plan.test.ts` 에 "요약이 새로 오면 패치가 버려진다" 케이스 |
| D4 | §10 EP-36 두 지점이 **0/2** 잠김 — 두 진입점의 같은 상태·선펼침 후 스크롤 모두 미잠금. P36-1·P36-2 green | VP-58 · VP-60 / §10 EP-36 | **BLOCKING** | `onPickFile` 스텁 렌더 + 두 진입점이 같은 액션을 부르는 단언 |
| D5 | `git-diff-service.test.ts` 삭제로 **EP-25 ② 좌표 캐시** 오라클 소멸. I2-coords green(이전 라운드 red) | VP-48 / §10 EP-25 ② | **BLOCKING** | 그 2케이스를 `git-diff.test.ts` 로 재배치 |
| D6 | 같은 삭제로 **EP-17 ④⑤**(log 폴백·`commitFilesUnavailable`·8 MiB 버퍼) 오라클 소멸. I3 green | VP-31 · VP-39 / §10 EP-17 ④⑤ | **BLOCKING** | 같은 재배치 |
| D7 | `animate-depth-out` 이 프로덕션 소비처 **0**. D-092 이유란은 "두 utility 재사용" 이라 적었다 | D-092(이유란) | **NON_BLOCKING** | 닫기 연출을 붙이거나 utility·테스트를 함께 정리 |
| D8 | `diffComparison.ts :: comparisonKey` 가 **참조 0**(정의뿐) — 이번 라운드 신규 죽은 export | 비귀속 | **NON_BLOCKING** | 삭제 또는 소비처 배선 |
| D9 | `lib/diffPatchLines.ts` 가 MD node·pair·테스트 없이 들어왔다. old/new 축 맞바꿈(I5)이 green | §11 ΔV4 "테스트 seam 신규" | **NON_BLOCKING** | `diffPatchLines.test.ts` 신설(축 계약 단언) |
| D10 | 전체 줄 상한이 초과 파일 **뒤의 더 작은 파일을 다시 수집**한다 — AC 문구("넘긴 파일부터")보다 관대 | AT-47(문구) | **NON_BLOCKING** | 동작 유지 시 AC 문구 정정 |
| D11 | §10 EP-17 머리말이 "5지점" 인데 항목은 ⑥까지이고 pair registry 는 `EP-17 (6)` | plan 내부 불일치 | **NON_BLOCKING** | 설계자가 머리말을 6으로 |
| D12 | §18 ΔV4 삭제 목록 **10** vs 실제 **13**(`DiffTileHeader.tsx` 를 변경으로 분류) | plan §18 | **NON_BLOCKING** | 설계자가 목록 정정 |
| D13 | INDEX 0211 행 비고가 **1,055자**로 5줄 상한 초과 | `docs/handoff/AGENTS.md §산출물 문장 규칙 3` | **NON_BLOCKING** | 이번 검증 갱신에서 축약(수행함) |
| D14 | `summaryBaseText` 의 `kind:'none'` 이 카탈로그 밖 문자 `'∅'` 를 낸다 | 비귀속 | **NON_BLOCKING** | i18n 키로 옮길지 결정 |
| D15 | 임시 저장소 통합 스위트(`queue-entry`·`mutation-queue`·`git-cli`·`git-diff`)가 부하에서 간헐 타임아웃 — 40회 중 2회 관측, 재실행 시 전부 green | 검증 환경 | **NEXT_HANDOFF** | 타임아웃 상향 또는 직렬화 검토 |

**미검출 인용 변이**: 파생 이슈가 없는 첫 라운드라 인용 변이 0건. 대신 **pair 가 등록한 적대 증거 중 VP-51 의 "화살표를 되살리는 변이"가 AC 가 지정한 지점(렌더)에서 green** 이다 — 등록 변이의 절반만 잠겼다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **있다.** "조회 계기 축"(AT-20 → AT-32 → AT-38 → AT-46)이 네 번째이고, 이번에는 그 축이 아니라 **`0건/구조 스윕으로 §10 을 닫는 축`** 이 미달했다 — 0157·0209·0211 이 같은 형태다.
- 관련 plan 지침/AC 의 존재 여부: **전부 있었다.** AT-43 "부재까지 단언한다" · AT-50 "`scrollIntoView` 를 부른다고 단언(스텁)" · AT-52 "스텁을 주고 첫 클릭 인자" · AT-44 "detached HEAD 에서 `null`" 이 §7 ΔV4 원문에 그대로 있고 §11 이 `GitContextBar` 의 seam 을 "SSR 렌더" 로 적었다.
- 사용자 결정 변경 근거: 해당 없음 — 이번 라운드에 Decision 변경 없음.
- 반복된 검증 환경 한계: **둘.** ① vitest `environment: 'node'` — effect 기반 계기는 자동 관측 불가(SSR 렌더는 가능). ② electron 바이너리 미설치 — `chat-turn.continuity` 1파일 red.
- **삭제된 테스트 파일이 옮겨지지 않은 사례가 이번에 3건**(`git-diff-service.test.ts` 9케이스 · `diffPeek.render.test.ts` 의 요구사항 마커 3단언 · 8/16 MiB 버퍼 단언) — 같은 라운드 안의 반복이다.

## 15. 결론

- 상태: **FAIL**
- pair 결과: REQUIRED **6 PASS · 6 PAIR_FAIL** · REGRESSION **10 PASS · 2 PAIR_FAIL** · BLOCKED_BY **0** · NOT_REQUIRED **15**
- PLAN_GAP: **없음** — 빠진 oracle 을 plan 이 전부 이름으로 적어 두었다. D9 는 node 누락이지만 계약이 `diffLines.ts` 로 결정돼 있어 gap 으로 올리지 않는다.
- Product/UX 및 ACTIVE Decision 충족: **코드 상 충족.** 내가 만든 40개 변이 중 이번 구현이 계약을 **위반한** 사례는 0건이다 — 실패는 전부 "그 계약을 깨도 아무도 red 가 되지 않는다" 쪽이다.
- AC 충족: `✅8 ⚠️4 ❌0 / 12`(자기보고 `✅12`).
- 현재 변경 운영 gate: **7종 전건 PASS**(vitest 1파일 red 는 electron 미설치, 변경 무관).
- NON_BLOCKING / NEXT_HANDOFF: D7~D14(8건) / D15(1건).
- repository operation checks: trailer 7키 파싱 정상 · 좌표 기입 완료 · **비고 5줄 초과 1건(D13, 이번 갱신에서 축약)**.
- 남은 사람 확인: §8 의 4건(파일 경계 가독성 · 사이드바 연출 · 형제 대비 이질감 · 위쪽 확장 시야 유지).
- 다음 단계: **구현자**가 D1~D6 을 닫는다. 여섯은 전부 **테스트 추가**이며 프로덕션 코드 변경을 요구하지 않는다 — D7·D8·D9 를 같은 라운드에 함께 정리하면 죽은 표면도 사라진다.

---

## Verify r2 (ΔV4) — FAIL

**판정: `FAIL`.** r1 이 차단으로 올린 여섯(D1~D6)은 **전건 닫혔다** — 그 자리를 깨는 변이 11건을 다시 심어 전건 RED 다. 남은 실패는 **하나**다: `VP-58` 이 AT-50 의 머리 동사를 관측하지 않는다. `scrollIntoView` 를 통째로 지워도 **3,071 케이스가 전건 green** 이다(C1) — 사이드바에서 파일을 골라도 화면이 움직이지 않는 회귀를 아무도 잡지 못한다. `PLAN_GAP` 은 없다: AT-50 이 그 오라클을 "스텁" 이라는 말까지 붙여 이미 적어 두었다. 다음 주체는 구현자다.

r1 판정 원문은 위 `## Verify r1 (ΔV4) — FAIL` 절에 그대로 둔다 — 이 절은 이번 라운드의 재측정만 적는다.

## 0. 기준선 / plan 변경 확인

- **기준선이 diff 로 성립하는가**: **예.** 규범 정정이 `3b472f7`(`Status: designed`) 로 분리됐고 구현은 `e62a2a0`·`fe36194`(`Status: implemented`) 다.
- 구현 커밋의 `plan.md` diff: **91 추가 / 10 삭제**. 삭제 10줄은 전부 `[검증자 기입] 파생 이슈` 표의 **상태 칸 갱신**(D1~D6·D7·D8·D9·D14 행 재작성)이고, 추가분은 `## [구현자 기입] … (ΔV4 r2)` 7절이다.
- Decision Ledger · Product/UX Contract 변경: **없음**.
- **AC 변경: 있다 — 설계 커밋 `3b472f7` 이 AT-47 과 EP-31 ③ 을 고쳤다.** r1 의 D10 이 "동작 유지 시 AC 문구 정정" 으로 낸 처방이고, 완화가 아니라 **관대한 실제 동작을 문구가 따라간 것**이다. 프로덕션은 `if (collect) totalLines += counted.total`(`git-diff-parse.ts:406`) 이라 예산을 수집한 파일만 소비한다 — 새 문구가 코드와 맞는다. 이 문구로 채점한다.
- 그 밖의 규범 행 변경: EP-17 머리말 `5지점 → 6지점`(D11) · §18 ΔV4 파일 목록 재계수(D12). 둘 다 코드 대조로 확인했다(아래 §7).

### Plan validity (r2 차분만)

| 검사 | 판정 | 근거 |
|---|---|---|
| 기준 커밋 실재 | 유효 | `git cat-file -t` — `46047ac`·`b85195e`·`e776360`·`ee5d10d`·`3b472f7`·`e7604eb` 전부 `commit` |
| 정정된 AC ↔ 코드 | 유효 | AT-47 새 문구 = `git-diff-parse.ts:404~406` 의 실제 분기 |
| §18 재계수 ↔ 커밋 | 유효 | `git show b85195e --name-status` = `A 18 · D 15 · M 45`. A 18 = 마이그레이션 1 + renderer 프로덕션 11 + renderer 테스트 6 |
| EP-17 지점 수 | 유효 | 열거 ①~⑥ · pair registry `EP-17 (6)` · 머리말 6 — 세 자리가 일치 |
| root `PLAN_GAP` | **없음** | 이번 라운드가 못 닫은 오라클(C1)을 AT-50 이 이미 이름으로 적었다 |

## 1. 구현 결과 비판적 검토 — AC 전에

- **프로덕션 로직 변경 0 을 직접 확인했다.** `e62a2a0` 의 프로덕션 hunk 는 둘뿐이다 — `diffComparison.ts` 의 죽은 export 삭제(D8), `sessionChangesData.ts` 의 `'∅' → tr('chat.rightpanel.diffBaselineNone')`(D14). 나머지 12파일은 테스트와 i18n 카탈로그다.
- false success 가능성: 이번 diff 는 계기·상태·외부 쓰기를 만들지 않는다. `fe36194` 는 스윕 술어의 **분모 열거 방식**만 바꾸므로 분모가 줄어드는 쪽이 위험인데, 그것을 §4 C6 에서 집합 동등으로 확인했다.
- 사용자에게 보이는 유일한 변화는 D14 다 — 커밋이 없는 저장소에서 라벨이 `∅` 대신 `기준 없음`/`no baseline`.
- 동작 보존 라운드인가: **테스트 추가 라운드**다. hunk 되돌림은 아무것도 재지 못하므로 쓰지 않았다 — 전부 **프로덕션 소거·치환 변이**로 쟀다.

## 2. 역방향 탐색

`scan-surface.sh e62a2a0^..fe36194` 는 후보 2건을 냈고 둘 다 오탐이다.

| 후보 | 판정 | 근거 |
|---|---|---|
| `sessionChangesData.ts :: summaryBaseLabel` — 프로덕션 참조 0 | 오탐 | 같은 파일 30행 `summaryBaseText` 가 부른다(파일 내 호출을 스크립트가 세지 않는다) |
| `sessionChangesData.ts :: SummaryBaseLabel` (타입) | 오탐 | 같은 파일 시그니처용 |

- 이번 라운드 신규 죽은 export: **0**. 미배선 신규 심볼: **0**(신규는 전부 `.test.ts`).
- 형제 파일 정책 비대칭: **0**.
- **테스트 신설이 프로덕션 계약을 잠그는가** — 신규 4파일 모두 프로덕션 심볼을 직접 부른다. `GitContextBar.render`·`.actions` 는 `await import('./GitContextBar')`, `diffReviewNavigation` 은 `./DiffReview`, `diffPatchLines` 는 `patchLinesToDiffLines` 다. 동명 로컬 재구현은 **없다** — 그 사실을 §4 의 프로덕션 변이가 red 로 증명한다.

## 3. 재측정 표 — 구현 보고가 등록한 변이 (11/11 RED)

보고를 대조의 출발점으로만 쓰고 11건을 **직접 다시 심어** 각 대상 스위트를 재실행했다.

| 변이 | r1 | r2 재측정 | 관측 |
|---|---|---|---|
| I1 라벨에 `→ 현재 브랜치` 되살림 | green | **RED** | `GitContextBar.render`+`.actions` 17케이스 전건 실패 |
| I2-coords 좌표 캐시 무력화 | green | **RED** | `git-diff.test.ts` 1/28 |
| I3 log 폴백 삭제 | green | **RED** | `git-diff.test.ts` 2/28 |
| I5 `patchLinesToDiffLines` 축 맞바꿈 | green | **RED** | `diffPatchLines`+`diffTile.render` 3/31 |
| I6 `resolveHeadRef` 상수화 | green | **RED** | `repository`+`service` 6/16 |
| I7 `service.ts` baseRef `null` | green | **RED** | `service.test.ts` 1/11 |
| P29-2 `PATCH_MAX_BUFFER` 4 MiB | green | **RED** | `git-diff.test.ts` 1/28 |
| P34-2 요약 수신 `patch:null` 제거 | green | **RED** | `chatReducer.plan` 1/37 |
| P36-1 `⋮ › 파일 표시` no-op | green | **RED** | `GitContextBar.actions` 1/17 |
| P36-2 `pickFile` 의 `onExpandFile` 제거 | green | **RED** | `diffReviewNavigation`+`diffTile.render` 2/31 |
| P62 줄별 요구사항 마커 렌더 제거 | green | **RED** | `diffTile.render` 1/27 |

### 재측정 표 — 이전 라운드가 red 로 본 변이 (덮개 회귀 없음)

r2 가 프로덕션 로직을 바꾸지 않았으므로 **이번 diff 가 건드린 파일 주변**의 r1 red 를 표본으로 재실행했다.

| 변이 | r1 | r2 재측정 | 비고 |
|---|---|---|---|
| M1 라벨에 `→ 현재` 되살림 | red(2) | **RED**(3) | `sessionChangesData.ts` 가 이번에 바뀐 파일이다 |
| M7 세션 패치 무시 | red(2) | **RED**(2) | `diffComparison.ts` 가 이번에 바뀐 파일이다 |
| M12 제거된 i18n 키 되살림 | red(1) | **RED**(1) | 카탈로그 2파일이 이번에 바뀌었다 |

`red → green` 으로 뒤집힌 축은 **0** 이다.

### 재측정 표 — 검증자 독립 축 (9건 중 4 green)

구현자 = 검증자이므로 **구현 보고가 이름을 대지 않은 축**만 골랐다 — 같은 계약의 다른 지점 3(C1·C3·C12) · 형제 슬롯 맞바꿈 2(C8a·C8d) · 분모 독립 재열거 2(C5·C6) · §10 표 밖 형제 지점 1(C9) · 이번 라운드가 정정한 AC 절 1(C11).

| 축 | 무엇을 깼나 | 결과 | 귀속 |
|---|---|---|---|
| **C1** | `DiffReview.pickFile` 의 `scrollIntoView` **만** 삭제(`onExpandFile` 은 남긴다) | **green**(전체 3,071 전건) | **VP-58 / AT-50 — D16** |
| **C3** | `↗` 의 `aria-label` **만** 삭제(`title` 은 남긴다) | **green**(전체 3,071 전건) | VP-60 / AT-52 — D17 |
| **C9** | `BEGIN_GIT_SNAPSHOT_QUERY` 의 `patch: null` 삭제 | **green**(전체 3,071 전건) | §10 EP-34 표 밖 형제 — D18 |
| **C11** | 전체 줄 상한을 예산이 아닌 **커서**로(`if (collect)` 제거) | **green**(전체 3,071 전건) | AT-47·EP-31 ③ 새 문구 — D19 |
| C5 | 좌표 캐시가 `cwd` 를 무시하고 한 칸만 쓴다 | red(2) | VP-48 / EP-25 ② — 잠겨 있다 |
| C6 | `walkSourceFiles` ↔ `globSync` 분모 대조 | 동등 | VP-54 / EP-34 ③ — 아래 §5 |
| C8a | 형제 메뉴 `highlight` ↔ `whitespace` 의 action 맞바꿈 | red(3) | VP-59 / EP-33 — 잠겨 있다 |
| C8d | 형제 버퍼 8 MiB ↔ 16 MiB 맞바꿈 | red(1) | VP-31·VP-55 / EP-17 ④·EP-29 ② |
| C12 | `prepare-worktree.ts` 의 `sessionBaselineRef: prepared.baseRef` 를 `null` 로 | red(2) | VP-52 / EP-28 ② 운반 링크 |

- **C1 이 이번 라운드의 유일한 차단이다.** 프로덕션은 옳게 스크롤한다(`DiffReview.tsx:70`) — 없는 것은 그 호출을 보는 눈이다. r2 가 이 지점을 위해 만든 `diffReviewNavigation.test.ts` 는 `onExpandFile` 까지만 단언하고 한 줄 앞에서 멈췄다.
- C3 은 라벨 **문자열**이 카탈로그를 지나는 것까지는 잠겼고(키가 새면 red) 그 문자열이 **어느 속성**에 실리는지만 못 가린다 — `title` 이 같은 값을 갖기 때문이다.

### 0건/전수 스윕 엄격화 (§8)

`fe36194` 가 스윕의 **열거 방식**을 바꿨으므로 그 스윕을 다시 엄격화했다.

| 스윕 | 엄격화 기준 | 차집합 |
|---|---|---|
| `gitPatchQuery` 소유자(`walkSourceFiles` 로 교체) | 같은 루트를 `globSync('**/*.{ts,tsx}')` 로 다시 열거 | **0** — 양쪽 **436파일** 정확히 동일, glob-only·walk-only 각 0 |
| 같은 스윕의 술어 | `gitApi\.diffPatch\(` → 수신자 무관 `\.diffPatch\(` | **+1** — `shared/api/ipc.ts` 정의부. r1 이 이미 계상한 그 1건이다 |
| `diffPeekRemoved` i18n 6키 | 카탈로그 `<key>:` 부재 → `app/src` 전역 `<key>` 부재 | **0** — 6키 각각 1건, 전부 그 테스트 자신 |
| `diffPeekRemoved` 삭제 모듈 7개 | `from '…<name>'` → 파일 전체 이름 부재 | **0** — 7모듈 각각 그 테스트 파일만 |

경로 구분자 수정이 분모를 깎지 않았다 — `globSync` 가 Linux 에서 세던 436파일을 `walkSourceFiles` 도 그대로 센다. §8 의 경계대로 엄격화는 *전수인지* 만 재고, *불변식을 잠그는지* 는 위 소거 변이가 판정했다.

## 4. V-pair closeout — 재검증 범위

r1 의 root 실패 pair 8행 + 그 pair 의 §10 지점 + 이번 diff 가 영향을 준 pair 를 실행했다. 영향받지 않은 r1 `PASS` 는 r1 의 `§5 V-pair closeout` 증거 좌표를 참조하고 다시 세지 않는다.

| Pair | 레벨 | r1 | r2 | 직접 검증 증거 |
|---|---|---|---|---|
| VP-51 | UT+AT | PAIR_FAIL | **PASS** | `GitContextBar.render.test.ts` 8케이스 — 현재 브랜치를 `feature-x` 로 **다르게** 주고 부재를 센다. I1·M1 red |
| VP-52 | IT+ST | PAIR_FAIL | **PASS** | `repository.test.ts` 4(브랜치·unborn·detached·비저장소) · `service.test.ts` 2(임시 저장소 실기). I6·I7·C12 red |
| VP-54 | ST | PAIR_FAIL | **PASS** | `chatReducer.plan.test.ts` — 요약 수신 후 `patch===null`, `collapsedFiles`·`sidebarVisible` 은 생존. P34-2 red |
| **VP-58** | AT | PAIR_FAIL | **PAIR_FAIL** | ①두 진입점·선펼침·같은 컨테이너는 잠겼다(P36-1·P36-2 red). **②"이동" 자체가 미잠금 — C1 green** |
| VP-60 | AT | PAIR_FAIL | **PASS** | `GitContextBar.actions.test.ts` — 첫 클릭 `(2, MAX)` · 둘째 `(2, DEFAULT)` · 열 인덱스까지 단언. C3 는 속성 축(D17) |
| VP-62 | AT | PAIR_FAIL | **PASS** | `diffTile.render.test.ts` 4케이스 — 확정 마커 · draft 입력 · 줄별 `+` · 위치 상실. P62 red |
| VP-48 | IT | PAIR_FAIL | **PASS** | `git-diff.test.ts` — 같은 runner 두 조회에 좌표 1건, runner 다르면 비공유. I2-coords·C5 red |
| VP-31·VP-39 | IT | PAIR_FAIL | **PASS** | 같은 파일 — 폴백 인자 **차집합** + 2단계 실패의 `commitFilesUnavailable` + 버퍼 8/16/4 MiB 동시 단언. I3·C8d red |
| VP-55 | UT+IT | PASS | **PASS** | EP-29 ② 의 16 MiB 반쪽이 이번에 닫혔다(P29-2·C8d red). 새 AC 절은 D19 |
| VP-59 | UT | PASS | **PASS** | 형제 슬롯 맞바꿈 C8a red 로 보강 확인 |
| VP-53·VP-61 | AT | PASS | **PASS** | 스윕 엄격화 차집합 0 유지(위 §3). M12 red |
| VP-57 | UT | PASS | **PASS** | M7 red 재현 — `diffComparison.ts` 가 이번에 바뀐 파일이라 다시 쟀다 |
| 그 밖의 r1 `PASS`·`NOT_REQUIRED` | — | — | **미영향** | 이번 diff 가 그 프로덕션 경로를 건드리지 않는다(프로덕션 hunk 2개) |

- root `PAIR_FAIL`: **VP-58** 1행. 종속 `BLOCKED_BY`: **없음** — 나머지 상위 pair 를 전부 독립 관측했다.
- REQUIRED **11 PASS · 1 PAIR_FAIL** · REGRESSION **12 PASS** · NOT_REQUIRED **15**.

## 5. plan §10 강제 지점 — 검증자 재계수

구현자는 r1 이 미잠금으로 본 지점만 다시 셌다. 검증자는 **ΔV4 신규 9 EP 의 26지점 전체**를 다시 세고, 회귀 EP 둘(EP-17·EP-25)의 문제 지점을 함께 봤다.

| EP | 지점 | r1 | r2 재계수 | 미잠금 |
|---|---|---|---|---|
| EP-28 비교 기준 이름 | 3 | 2/3 | **3/3** | — (I6·I7·C12 red) |
| EP-29 한 채널·한 호출 | 3 | 2.5/3 | **3/3** | — (P29-2·C8d red) |
| EP-30 구 본문 경로 소멸 | 4 | 4/4 | **4/4** | — |
| EP-31 상한 셋 | 3 | 3/3 | **3/3** | 값 자체는 잠김. 새 문구의 “예산” 절은 D19 |
| EP-32 방향 값 | 2 | 2/2 | **2/2** | — |
| EP-33 표시 옵션 넷 | 4 | 4/4 | **4/4** | — (C8a red) |
| EP-34 세대당 1회 | 3 | 2/3 | **3/3** | — (P34-2 red · ③은 C6 로 분모 재확인) |
| EP-35 목록만 좁힘 | 2 | 2/2 | **2/2** | — (M7 red) |
| EP-36 사이드바·확대 | 2 | 0/2 | **2/2** | 표에 적힌 두 *실패 의미* 는 잠겼다 |
| EP-17 요약 세 범위(회귀) | 6 | 4/6 | **6/6** | — (I3·C8d red) |
| EP-25 합쳐서 한 번(회귀) | 3 | 2/3 | **3/3** | — (I2-coords·C5 red) |

- **ΔV4 신규 26/26 잠김**(r1 21/26). 회귀 EP-17·EP-25 도 전수 복구됐다.
- **EP-36 ② 는 §10 표 기준으로는 닫혔다** — 표의 실패 의미가 "화면 전환이면 두 번째 화면이 이름만 바꿔 돌아온다" 이고 그 축은 잠겼다(같은 스크롤 소유자·두 섹션 공존). 못 닫힌 것은 §10 이 아니라 **AT-50 이 별도로 이름 붙인 오라클**(`scrollIntoView` 스텁)이다 — 그래서 VP-58 의 실패이지 `PLAN_GAP` 이 아니다.
- 라벨 진실성 표본: `resolveHeadRef` 의 `{ readOnly: true }` 는 실제로 `symbolic-ref` 한 호출이라 참이다. 구현 보고의 "신규 4파일 25 · 변경 6파일 17" 도 파일별로 다시 셌다(아래 §7).
- 표 밖인데 같은 불변식이 필요한 지점: **1건** — `BEGIN_GIT_SNAPSHOT_QUERY` 의 `patch:null`(D18). ΔV4 가 새로 넣은 줄인데 EP-34 의 세 지점 어디에도 없다.

## 6. 숫자 / 상한 재측정

- **케이스 증가 +42**: 3,029(r1) → **3,071**(r2 실측). 파일별 자기보고를 다시 셌다 — 신규 `GitContextBar.render` **8** · `.actions` **9** · `diffReviewNavigation` **4** · `diffPatchLines` **4** = 25, 변경 `repository` **4** · `git-diff` **5** · `diffTile.render` **4** · `service` **2** · `chatReducer.plan` **1** · `sessionChangesData` **1** = 17. **25 + 17 = 42 ✓**, 자기보고와 전건 일치.
- **§18 재계수(D12) 검산**: `git show b85195e --name-status` = `A 18 · D 15 · M 45`. A 18 = 마이그레이션 1 + renderer 신규 프로덕션 11 + renderer 신규 테스트 6 ✓. D 15 = renderer 14 + main 1 ✓.
- **EP-17 지점 수(D11) 검산**: 머리말 6 = 열거 ①~⑥ = pair registry `EP-17 (6)` ✓.
- 출력 상한: `MAX_PATCH_TOTAL_LINES = 200_000` 은 예산 의미에서도 **수집 총량의 상한**이라 worst-case 16 MB ≤ `PATCH_MAX_BUFFER` 16 MiB 관계가 그대로다 — D19 는 안전 축이 아니라 충실도 축이다.
- 자기보고 합계 사본 대조: 본문 `12/12` ↔ trailer `Criteria-Met: 12/12` + `Criteria-Pending: D7` ↔ INDEX 비고 — **세 사본 일치**.

### AT / AC 세부

| AT | r1 | r2 | 근거 |
|---|---|---|---|
| AT-43 | ⚠️ | ✅ | 렌더 부재 단언 신설, 현재 브랜치를 다른 값으로 준다. I1 red |
| AT-44 | ⚠️ | ✅ | 생산자 4 + 산출 2케이스. I6·I7·C12 red |
| AT-45~AT-49 | ✅ | ✅ | 미영향 — 증거 좌표는 r1 §5 |
| AT-47 | ✅ | ✅ | 값 상한 셋은 잠김. 정정된 “예산” 절은 미잠금(D19) |
| **AT-50** | ⚠️ | **⚠️** | 두 구획·트리·선펼침·같은 컨테이너 잠김. **“이동” 미잠금 — C1 green** |
| AT-51 | ✅ | ✅ | C8a 형제 맞바꿈 red 로 보강 |
| AT-52 | ⚠️ | ✅ | 첫/둘째 클릭 인자 + 열 인덱스 단언. 속성 축은 D17 |
| AT-53 | ✅ | ✅ | 엄격화 차집합 0 유지. M12 red |
| AT-54 | ⚠️ | ✅ | 렌더 4케이스. P62 red |

- **합계 재측정: `✅11 · ⚠️1 · ❌0 = 12`.** 분모는 §7 ΔV4 표의 AT-43~AT-54 를 직접 세어 12.
- 자기보고 `12/12`. **불일치 1건** — AT-50 은 ⚠️ 다.

## 7. 게이트 재실행 — 산출 관측

exit code 가 아니라 실행 산출을 적는다.

| Gate | 결과 | 관측한 산출 |
|---|---|---|
| `npm run lint` | **PASS** | `0 errors, 1 warning` — 기존분 `useTranscriptVirtualizer.ts:22`. 실행 후 `git status --porcelain` **빈 값**(`--fix` 가 트리를 바꾸지 않았다) |
| `npm run typecheck` | **PASS** | 3구성(`node`·`web`·`test`) 진단 **0줄** |
| `vitest run --maxWorkers=2` 전체 | **PASS(환경 1)** | **309파일 중 308 green · 3,071 케이스 전건 green**, 34.9s. red 1 = `chat-turn.continuity.test.ts` = `Electron failed to install correctly`, 이번 diff 에 없는 파일 |
| `node --test "scripts/*.test.mjs"` | **PASS** | `# tests 67 # pass 67 # fail 0` |
| `check-doc-inventory.mjs --check` | **PASS** | `9 items, 82 channels` · 산문 ok · 링크 ok · 차이 0 |
| `check-migrations-appendonly.mjs` | **PASS** | exit 0 · `20 migrations, dir == migrate.ts imports` · `scanned 884 source files` |
| IPC 계약 문서 | **PASS** | 변경 없음 — 이번 diff 에 `shared/ipc.ts`·`protocol.ts`·`IPC_CONTRACT.md` 가 **없다** |

- `npm test` 를 쓰지 않았다 — `app/AGENTS.md` 대로 `pretest` 를 우회했고, DB 스위트(`queries`·`migrate`)는 이 컨테이너의 Node ABI 로 이미 green 이다.
- **`--maxWorkers=2` 는 구현자 보고대로 필요하다** — 무제한이면 컨테이너가 워커를 OOM 으로 죽인다. 이번 검증 전건을 이 옵션으로 돌렸다.
- **검증 중 트리 변화**: 변이 24회를 전부 `git checkout -- app/<file>` 로 되돌렸고, 마지막에 `git status --porcelain` 이 빈 값임을 확인했다. 잔여물 0.
- **CI(windows-latest) 가 두 자리를 닫았다 — 검증 커밋 `ae26806` 의 `gate` run [#33689101622](https://github.com/muzaby/orca-skin/actions/runs/33689101622) 9스텝 success.**
  - ① **경로 구분자**: `fe36194` 의 `walkSourceFiles` 교체가 실기됐다. 로컬(Linux)은 이 축을 재지 못한다 — r1 이후 red 였던 소유자 스윕 2케이스가 windows 에서 green 이다.
  - ② **환경 기인 red 의 확정**: windows 산출은 **309파일 전건 green · 3,073 케이스 전건 green**(56.8s). 로컬 3,071 과의 차 **2** 가 정확히 `chat-turn.continuity.test.ts` 의 케이스 수다 — 그 1파일 red 를 "electron 미설치, 변경 무관" 으로 분리한 판정이 egress 가 열린 환경에서 **측정으로 확인**됐다.
  - D15(임시 저장소 스위트 간헐 타임아웃)는 이 run 에서 재현되지 않았다.

## 8. 테스트 가능한 핸들 — 이번 라운드에 줄어든 사람 실기

r1 이 "UI 라서" 로 넘기지 않은 자리를 구현자가 SSR 렌더로 실제로 잡았다. 남는 사람 실기는 **4건 그대로**다(파일 경계 가독성 · 사이드바 연출 끊김 · 형제 타일 대비 · 위쪽 확장 시야 유지 — D-060·D-067).

- **C1 은 사람 실기가 아니다.** `onPickFile` 을 잡는 double 이 이미 서 있으므로, 그 double 이 `scrollIntoView` 스파이를 단 노드를 돌려주면 자동 관측된다 — AT-50 이 "스텁" 이라 적은 것이 그 뜻이다.
- 마운트 순서(effect) 자체는 이번에도 자동 oracle 이 없다 — `environment: 'node'` 의 한계이고 §8 사람 실기 표의 마지막 행이다.

## 9. Repository operation checks

- `AGENTS.md` 변경: **없음** — 위생 검사 해당 없음.
- **trailer 파싱**: `git log -1 --format='%(trailers:only=true)'` 가 `e62a2a0` **8키**, `fe36194` **8키**를 그대로 돌려준다(`Criteria-Pending` 포함). 허용값도 root `AGENTS.md` 표와 일치한다 — `Agent: claude` · `Status: implemented` · `Verified-By: pending`.
- 인용 커밋 실재: 위 §0 표의 6해시 + `da9c778d`·`0d8cf037`·`553da6a8`·`d23c5be` 전부 `commit`.
- **대상 커밋 좌표**: 구현자가 남긴 `(r2 구현 — 검증자 기입)` 을 `e62a2a0`·`fe36194` 로 채웠다(INDEX). plan 의 구현 보고 행은 자리표시자로 둔다 — 좌표 정본은 INDEX 한 곳이다.
- **`[구현자 기입]` 7필드**: **7/7 존재**(설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals). 산문으로 접힌 필드 0 — `이번 라운드 수정의 잠금` 이 11행 표를 그대로 갖는다.
- **INDEX 비고 5줄 초과**: r1 의 1,055자에서 809자로 줄었으나 **여전히 넘는다** → D21. 이번 검증 갱신에서 다시 줄인다.
- 이동/삭제한 reference: **없음**. r1 의 D5·D6 이 지적한 `git-diff-service.test.ts` 3축은 `git-diff.test.ts` 로 재배치돼 살아 있는 소비처를 갖는다.
- PR: [#422](https://github.com/muzaby/orca-skin/pull/422) (draft, open) · `mergeable_state: clean` · head `ae26806`(검증 커밋) — 브랜치와 일치. 체크런 `gate` **success**.

## 10. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "심은 결함 11건 전부 RED" | **타당** | 11/11 직접 재현. 근거를 `rg` 개수로 대신한 행 0 |
| "r1 미검출 13 = 이번 11 + 이미 red 2" 검산 | **타당** | I4·I2-total 이 r1 에서 red 였음을 r1 §4 표에서 확인 |
| 놓친 문제 1 — 렌더 테스트가 store 를 통째로 mock 한다 | **타당** | 마크업 계약만 잰다는 선언대로다. selector 배선은 C12 가 다른 층에서 red 로 잡는다 |
| 놓친 문제 2 — 사이드바 double 로 배선을 본다 | **부분적으로만 타당** | 나눈 이유는 옳으나 **그 double 이 스크롤 대상 노드를 돌려주지 않아** AT-50 의 오라클이 남았다(C1) |
| 놓친 문제 3 — D7 은 사용자 결정 | **타당** | `animate-depth-out` 프로덕션 소비처 실측 **0**(참조 4건 = CSS 정의 2 + 그 CSS 테스트 2) |
| 놓친 문제 4 — D10 은 문구를 고쳤지 동작을 고치지 않았다 | **타당** | 코드가 예산 의미다. 다만 **새 문구의 오라클이 없다**(C11 green) → D19 |
| 구현 보고 "강제 지점 전수" | **타당** | 검증 재계수도 ΔV4 26/26. 회귀 EP 둘도 복구 |
| 자기보고 `Criteria-Met: 12/12` | **미달 1** | 검증 재판정 `✅11 ⚠️1` — AT-50 |

## 11. Finding disposition / 파생 이슈

r1 의 D1~D15 처리는 아래 §12 에, 이번 라운드 신규는 D16~D21 이다. 정본 표는 [`plan.md` §[검증자 기입] 파생 이슈](plan.md) 에 함께 반영한다.

| # | finding | 귀속 | disposition |
|---|---|---|---|
| **D16** | `DiffReview.pickFile` 의 `scrollIntoView` 를 지워도 3,071 케이스 전건 green — AT-50 의 "이동" 을 보는 오라클이 없다 | VP-58 / AT-50 | **BLOCKING** — `diffReviewNavigation.test.ts` 의 사이드바 double 이 스크롤 스파이를 단 노드를 돌려주고, `pickFile` 이 그 노드의 `scrollIntoView` 를 부른다고 단언한다 |
| D17 | `↗` 의 `aria-label` 을 지워도 green — 같은 문자열이 `title` 에도 실려 두 속성을 가리지 못한다. AT-52 는 `aria-label` 을 이름으로 적었다 | VP-60 / AT-52 | NON_BLOCKING — 속성을 지목해 단언하거나 `title` 을 뺀다 |
| D18 | `BEGIN_GIT_SNAPSHOT_QUERY` 의 `patch: null`(ΔV4 신규, `b85195e`)이 미잠금 — 지워도 green. §10 EP-34 세 지점 밖이다 | 비귀속(§10 표 밖 형제) | NON_BLOCKING — 세션/cwd 전환에서 앞 세션 diff 가 남는 창을 잠근다 |
| D19 | 정정된 AT-47·EP-31 ③ 의 "예산은 수집한 파일만 소비한다" 절에 오라클이 없다 — 커서 의미로 바꿔도 green | AT-47 · EP-31 ③(문구) | NON_BLOCKING — 상한 초과 파일 **뒤의 더 작은 파일이 다시 실린다**는 케이스 1건 |
| D20 | §18 ΔV4 영향 파일 목록이 `b85195e` 만 담는다 — r2 가 더한 테스트 4 · 변경 6 이 빠져 있다 | plan §18 | NON_BLOCKING — 설계자가 revision 전체로 넓히거나 "r1 구현 기준" 이라 명시 |
| D21 | INDEX 0211 비고가 **809자**로 5줄 상한을 여전히 넘는다(r1 1,055자에서 축소) | `docs/handoff/AGENTS.md §산출물 문장 규칙 3` | NON_BLOCKING — 이번 검증 갱신에서 축약(수행함) |

**미검출 인용 변이**: **0**. D1~D6 이 인용한 변이(I1·I2-coords·I3·I6·I7·P29-2·P34-2·P36-1·P36-2)와 D9 가 인용한 I5 를 전부 다시 심어 RED 를 확인했다 — 구현자가 `closed` 로 적은 상태를 되돌릴 근거가 없다.

## 12. r1 파생 이슈 처리 확인

| # | r1 분류 | 구현자 상태 | 검증자 재판정 |
|---|---|---|---|
| D1 | BLOCKING | closed | **closed** — I1 red |
| D2 | BLOCKING | closed | **closed** — I6·I7 red, C12 로 운반 링크까지 확인 |
| D3 | BLOCKING | closed | **closed** — P34-2 red |
| D4 | BLOCKING | closed | **부분 closed** — EP-36 ①②는 닫혔으나 AT-50 오라클이 남았다 → **D16 으로 이관** |
| D5 | BLOCKING | closed | **closed** — I2-coords·C5 red |
| D6 | BLOCKING | closed | **closed** — I3·C8d red |
| D7 | NON_BLOCKING | open(사용자) | **open 유지** — 프로덕션 소비처 0 재확인 |
| D8 | NON_BLOCKING | closed | **closed** — `comparisonKey` 참조 0, 정의 삭제 |
| D9 | NON_BLOCKING | closed | **closed** — I5 red |
| D10·D11·D12 | NON_BLOCKING | closed(설계) | **closed** — §0·§6 에서 코드 대조 |
| D13 | NON_BLOCKING | closed(r1) | **재발** → D21 |
| D14 | NON_BLOCKING | closed | **closed** — `'∅'` 참조 0 |
| D15 | NEXT_HANDOFF | open | **open 유지** — 이번 라운드는 `--maxWorkers=2` 로 회피했고 간헐 실패를 보지 않았다 |

## 13. Review Signals — 사실만

- **이전 라운드와 동일 증상인가**: **부분적으로.** r1 의 뿌리는 "AC 가 이름 붙인 오라클이 없고 구조 스윕이 그 자리를 대신했다" 였다. r2 는 그 자리 여섯 중 다섯을 행동 oracle 로 닫았고, **남은 하나(AT-50 의 `scrollIntoView`)가 같은 형태**다 — 그 지점을 위해 만든 파일 안에서 한 줄 앞에 멈췄다.
- **관련 plan 지침/AC 가 있었는가**: **있었다.** AT-50 원문이 "파일 클릭이 그 섹션의 `scrollIntoView` 를 부른다고 단언(스텁)" 이다. AT-52 의 `aria-label`(D17)도 같다.
- **사용자 결정 변경 근거**: 해당 없음 — 이번 라운드에 Decision 변경 0. AC 정정 2건(AT-47·EP-31 ③)은 r1 검증이 낸 처방을 따른 문구 정정이고 동작을 바꾸지 않는다.
- **반복된 검증 환경 한계**: **셋.** ① `environment: 'node'` — effect 는 관측 불가(SSR 마크업은 가능하고 이번 라운드가 그 경계를 실제로 넓혔다) ② electron 바이너리 미설치 — 1파일 red ③ 컨테이너 메모리 — `--maxWorkers=2` 필요.
- **로컬 게이트가 보지 못하는 축**: 경로 구분자. `fe36194` 가 고쳤고 windows CI 가 실기로 확인했다 — 로컬(Linux) 전건 green 은 이 축을 재지 못하므로, 경로를 값으로 비교하는 스윕은 앞으로도 CI 가 최종 판정한다.
- **삭제된 테스트 파일의 계약 이전**: r1 이 3건을 지적했고 r2 가 전부 재배치했다(좌표 캐시·log 폴백·전용 버퍼 → `git-diff.test.ts`, 요구사항 마커 → `diffTile.render.test.ts`). 이번 라운드 신규 유실 **0**.

## 14. 결론 (r2)

- 상태: **FAIL**
- pair 결과: REQUIRED **11 PASS · 1 PAIR_FAIL**(VP-58) · REGRESSION **12 PASS** · BLOCKED_BY **0** · NOT_REQUIRED **15**
- PLAN_GAP: **없음** — 남은 오라클을 AT-50 이 이미 이름으로 적었다. 다음 주체는 **구현자**다.
- 등록·인용 변이: **11/11 RED** · 이전 라운드 red 재현 **3/3 RED**(덮개 회귀 0) · 검증자 독립 축 **9건 중 4 green**(C1 차단 · C3·C9·C11 비차단)
- §10 강제 지점: ΔV4 신규 **26/26**(r1 21/26) · 회귀 EP-17 **6/6** · EP-25 **3/3**
- AC 충족: `✅11 ⚠️1 ❌0 / 12`(자기보고 `12/12`)
- 현재 변경 운영 gate: **7종 전건 PASS**. 로컬 vitest 의 1파일 red 는 electron 미설치이고, **windows CI 가 309파일·3,073케이스 전건 green** 으로 그 분리를 확인했다. 검증 중 트리 변화·잔여물 **0**
- NON_BLOCKING: D17·D18·D19·D20·D21 + r1 잔여 D7 · NEXT_HANDOFF: D15
- 남은 사람 확인: **4건**(파일 경계 가독성 · 사이드바 연출 · 형제 대비 · 위쪽 확장 시야). windows CI 축은 `ae26806` 의 green gate 로 닫혔다
- 다음 단계: **구현자가 D16 하나를 닫는다.** 테스트 한 파일의 double 을 스크롤 스파이 노드로 바꾸는 작업이며 프로덕션 변경을 요구하지 않는다. D17·D19 를 같은 라운드에 함께 닫으면 AC 가 이름 붙인 오라클이 전부 선다.

## Verify r3 (ΔV4) — FAIL

**판정: `FAIL`.** r2 가 남긴 차단 D16 의 **인용 변이 넷은 전부 닫혔다**(M16a~M16d RED). 그런데 구현자가 처방과 **다른 장치**를 골랐고, 그 대체물이 원본에 없던 실패 모드를 만들었다 — 이동의 **소유자 인자**가 무관측이다. `revealFileSection(null, path)` 로 바꾸면 프로덕션에서 어떤 파일을 골라도 화면이 움직이지 않는데 **typecheck 0 error · lint 0 error · 3,080 케이스 전건 green** 이다(D22). 사용자가 보는 증상은 D16 과 같다: 사이드바에서 파일을 눌러도 아무 일이 없고 아무도 red 가 아니다. `PLAN_GAP` 은 없다 — AT-50 이 그 오라클을 이미 이름으로 적었다. 다음 주체는 구현자다.

r1·r2 판정 원문은 위 두 절에 그대로 둔다 — 이 절은 이번 라운드의 재측정만 적는다.

## 0. 기준선 / plan 변경 확인

- **기준선이 diff 로 성립하는가**: **예.** 설계 정정이 `9bf8c15`(`Status: designed`)로 분리됐고 구현은 `762db42`(`Status: implemented`) 다.
- 구현 커밋의 `plan.md` diff: **77 추가 / 5 삭제**. 삭제 5줄은 전부 `[검증자 기입] 파생 이슈` 표의 **상태 칸 갱신**(D16~D20 행 재작성)이고, 추가분은 `## [구현자 기입] … (ΔV4 r3)` 7절이다.
- Decision Ledger · Product/UX Contract · AC · V pair · §10 변경: **없음**. `git show 762db42 -- plan.md` 에 `| AT-` · `| VP-` · `| D-0` 로 시작하는 규범 행 변경 0.
- 그 밖의 규범 행 변경: §18 을 라운드별 3절로 나눈 것(`9bf8c15`, D20 처방)뿐이다.

### Plan validity (r3 차분만)

| 검사 | 판정 | 근거 |
|---|---|---|
| 기준 커밋 실재 | 유효 | `git cat-file -t` — `b85195e`·`e62a2a0`·`fe36194`·`762db42`·`9bf8c15`·`3b472f7`·`46047ac` 전부 `commit` |
| §18 재계수 ↔ 커밋 | 유효 | r3 절의 열거(프로덕션 신규 1·변경 1·테스트 신규 1·변경 4) = `git show 762db42 --stat` 의 코드 7파일 |
| root `PLAN_GAP` | **없음** | 남은 오라클(D22)을 AT-50 원문이 "그 섹션의 `scrollIntoView` 를 부른다고 단언(스텁)" 으로 이미 적었다 |

## 1. 구현 결과 비판적 검토 — AC 전에

- **프로덕션 hunk 는 둘이다.** `DiffReview.tsx` 의 세 줄 → 호출 한 줄, `lib/fileSectionScroll.ts` 신규 27줄. 선택자·정렬(`block:'start'`)·널 처리가 전부 같아 **화면 동작 변화 0** 이다.
- **동작 보존 추출 라운드다.** hunk 되돌림은 동작이 같은 이전 코드로 돌아갈 뿐이라 아무것도 재지 못하므로 쓰지 않았다 — 전부 프로덕션 소거·치환·**형제 맞바꿈** 변이로 쟀다.
- **추출이 새 실패 모드를 만든다.** 인라인일 때 `scrollOwnerRef.current` 는 호출 지점에서 직접 읽혀 틀릴 자리가 없었다. 인자가 된 지금은 **무엇을 넘기는가**가 새 축이고, 이 축을 보는 눈이 없다(§3 A1·A1b).
- false success 가능성: 이번 diff 는 계기·상태·외부 쓰기를 만들지 않는다. 새 반환값(`boolean`)은 프로덕션 소비처 0 이다.

## 2. 역방향 탐색

`scan-surface.sh 762db42^..762db42` 는 후보 3건을 냈다.

| 후보 | 판정 | 근거 |
|---|---|---|
| `DiffReview.tsx :: DiffReviewProps`(타입) | 오탐 | 같은 파일 시그니처용 |
| `fileSectionScroll.ts :: FileSectionTarget`(타입) | 오탐 | `FileSectionOwner.querySelector` 반환 타입 |
| `fileSectionScroll.ts :: FileSectionOwner`(타입, 테스트 참조 2·프로덕션 0) | 오탐 | 프로덕션은 구조적 호환으로 `HTMLDivElement` 를 넘긴다 — 이름을 안 쓸 뿐 계약은 지난다 |

- 신규 죽은 export **0** · 미배선 신규 심볼 **0**: `revealFileSection` 은 `DiffReview.tsx:69` 가 부른다.
- **동명 로컬 재구현 0**: `fileSectionScroll.test.ts` 는 `./fileSectionScroll` 을 직접 부르고, `diffReviewNavigation.test.ts` 는 `./DiffReview` 를 부른다. mock 대상 specifier(`../../lib/fileSectionScroll`)가 프로덕션 import 와 **같은 경로로 해석**된다.
- 형제 파일 정책 비대칭 **0**.
- 신규 구조적 proxy·0건/전수 스윕 **0** — 이번 라운드 신규 오라클은 전부 행동 단언이다(§8 엄격화 대상 없음).

## 3. 재측정 표 — 구현 보고가 등록한 변이 (7/7 RED)

보고를 대조의 출발점으로만 쓰고 7건을 **직접 다시 심어** 각 대상 스위트를 재실행했다.

| 변이 | 무엇을 깼나 | r3 재측정 | 관측 |
|---|---|---|---|
| M16a | `pickFile` 에서 `revealFileSection` 호출 제거(+ 죽은 import 정리) | **RED** | `fileSectionScroll`+`diffReviewNavigation` 1/10 |
| M16b | `revealFileSection` 에서 `scrollIntoView` 제거 | **RED** | 같은 두 파일 1/10 |
| M16c | `block:'start'` → `'center'` | **RED** | 같은 두 파일 1/10 |
| M16d | `CSS.escape` 우회 — 경로를 날것으로 | **RED** | 같은 두 파일 2/10 |
| M17 | `↗` 의 `aria-label` 제거(`title` 은 남긴다) | **RED** | `GitContextBar.render` 2/8 |
| M18 | `BEGIN_GIT_SNAPSHOT_QUERY` 의 `patch: null` 제거 | **RED** | `chatReducer.plan` 1/39 |
| M19 | 전체 줄 예산을 커서로(`if (collect)` 제거) | **RED** | `git-diff-parse` 1/30 |

> **검증자 자기 오측 1건, 교정함.** M16d 첫 실행은 GREEN 이었는데 원인은 코드가 아니라 **내 편집 스크립트가 no-op** 이었다(파이썬 `"\$"` 가 `${` 와 매치되지 않는다). 파일이 실제로 바뀌었는지 확인하고 다시 심자 RED 다 — exit code 를 관측으로 쓰지 않는다는 §8 이 검증자 자신에게도 걸린다.

### 재측정 표 — 이전 라운드가 red 로 본 변이 (덮개 회귀 0)

이번 diff 가 건드린 4파일 주변의 r1·r2 red 를 표본으로 재실행했다. **`red → green` 으로 뒤집힌 축 0.**

| 변이 | 이전 | r3 재측정 | 이번 라운드에 바뀐 파일이라 다시 잰 이유 |
|---|---|---|---|
| P36-2 `pickFile` 의 `onExpandFile` 제거 | red(r2) | **RED**(2/33) | `DiffReview.pickFile` 이 이번 diff 의 프로덕션 hunk 다 |
| P34-2 요약 수신 `patch:null` 제거 | red(r2) | **RED**(1/39) | `chatReducer.plan.test.ts` 가 이번에 바뀌었다 |
| I1 계열 — `filesLabel` 을 카탈로그 대신 날것 키로 | red(r2) | **RED**(2/8) | `GitContextBar.render.test.ts` 는 단언을 **교체**한 파일이라 위험도가 가장 높다 |
| EP-31 ② 파일당 줄 상한 소거 | red(r1) | **RED**(1/30) | `git-diff-parse.test.ts` 가 이번에 바뀌었다 |

### 재측정 표 — 검증자 독립 축 (5건 중 3 green)

**구현자 = 검증자인 라운드다**(둘 다 `Agent: claude`). 보고된 7변이를 다시 심는 것은 자기 목록의 재실행이라, 보고가 이름을 대지 않았거나 **이름은 댔으나 재지 않은** 축을 따로 만들었다 — 같은 계약을 seam 바깥에서 깨기 2(A1·A1b) · 형제 슬롯 맞바꿈 1(A7) · 순서 1(A2) · 반환 계약 1(A5).

| 축 | 무엇을 깼나 | 결과 | 귀속 |
|---|---|---|---|
| **A1b** | `revealFileSection(null, path)` — 프로덕션이 **아무것도 스크롤하지 않는다** | **green**(typecheck 0 error · lint 0 error · 3,080 전건) | **VP-58 / AT-50 — D22** |
| **A1** | 소유자를 형제 ref 로 맞바꿈(`scrollOwnerRef` → `tailSpacerRef`) | **green**(typecheck 0 error · 3,080 전건) | **VP-58 / AT-50 — D22** |
| A7 | 형제 아이콘 버튼 둘의 접근성 이름 맞바꿈(폴더 ↔ `↗`) | green(`render`+`actions` 17 전건) | VP-60 / AT-52 — D23 |
| A2 | `onExpandFile` 과 이동의 **순서** 뒤집기 | green(3,080 전건) | §10 EP-36 ② 문구 — D24 |
| A5 | `return target !== null` → `return true` | red(2/4) | 반환 계약은 잠겨 있다 |

- **A1b 가 이번 라운드의 유일한 차단이다.** 프로덕션은 옳은 ref 를 넘긴다(`DiffReview.tsx:69`) — 없는 것은 그 인자를 보는 눈이다. r3 이 만든 두 반쪽은 각각 **"고른 경로로 부른다"**(SSR 이라 첫 인자는 항상 `null`)와 **"주어진 소유자 안에서 찾아 스크롤한다"** 를 잰다. 둘을 잇는 **무엇을 소유자로 주는가**가 어느 쪽에도 없다.
- **구현 보고의 대응 주장은 실측으로 반증된다.** 보고 `놓친 잠재 문제 (ΔV4 r3)` 2 는 "`ref` 배선은 typecheck 와 `data-diff-scroll-owner` 렌더 단언이 받는다" 고 적었다. 두 형제 ref 가 같은 `useRef<HTMLDivElement>` 라 typecheck 는 **0 error**(A1)이고, `data-diff-scroll-owner` 단언은 두 곳 다 `toContain('data-diff-scroll-owner')` 라 **속성 존재만** 본다(`diffReviewNavigation.test.ts:139`·`diffTile.render.test.ts:96`) — 그 노드가 `revealFileSection` 에 건네지는지는 어느 쪽도 보지 않는다.
- A7 은 세 문자열이 마크업에 **모두 남아** 침묵한다. 새 단언이 세 이름을 돌며 `html` 전체에 `aria-label="<이름>"` 이 있는지만 보므로(`GitContextBar.render.test.ts:188~189`) 어느 버튼이 어느 이름을 갖는지는 세지 않는다 — 테스트 이름의 "**각자**" 를 단언이 따라가지 못한다.
- A2 는 프로덕션 동작 차이가 없다. `onExpandFile` 은 React 상태 갱신이라 같은 동기 블록 안에서 DOM 이 바뀌지 않으므로 두 순서가 같은 결과를 낸다 — §10 EP-36 ② 문구("먼저 펼친 뒤 이동")와 코드의 관계만 어긋난 자리다.

## 4. V-pair closeout — 재검증 범위

r2 의 root 실패 pair + 그 §10 지점 + 이번 diff 가 영향을 준 pair 를 실행했다. 영향받지 않은 r2 `PASS` 는 r2 `§4` 의 증거 좌표를 참조하고 다시 세지 않는다.

| Pair | 레벨 | r2 | r3 | 직접 검증 증거 |
|---|---|---|---|---|
| **VP-58** | AT | PAIR_FAIL | **PAIR_FAIL** | 호출·실행·정렬·이스케이프는 잠겼다(M16a~M16d red). **소유자 인자가 무관측 — A1b green** |
| VP-60 | AT | PASS | **PASS** | 폭 토글 인자 `(2, MAX)`·`(2, DEFAULT)` 유지(`GitContextBar.actions` 17 green). `aria-label` 속성 축이 이번에 닫혔다(M17 red). 슬롯 귀속은 D23 |
| VP-54 | ST | PASS | **PASS** | key 전환 폐기 + 같은 key 보존 양성 짝(M18 red · P34-2 red) |
| VP-55 | UT+IT | PASS | **PASS** | 예산 의미가 오라클을 얻었다(M19 red) · 파일당 상한 회귀 red |
| VP-51 | UT+AT | PASS | **PASS** | I1 계열 red 재현 — `GitContextBar.render.test.ts` 가 이번에 바뀐 파일이다 |
| VP-62·VP-57 | AT·UT | PASS | **PASS** | `diffTile.render` 27케이스 green 유지(P36-2 가 이 파일에서도 red) |
| 그 밖의 r2 `PASS`·`NOT_REQUIRED` | — | — | **미영향** | 이번 diff 의 프로덕션 hunk 둘이 그 경로를 건드리지 않는다 |

- root `PAIR_FAIL`: **VP-58** 1행. 종속 `BLOCKED_BY`: **없음** — 나머지 상위 pair 를 전부 독립 관측했다.
- REQUIRED **11 PASS · 1 PAIR_FAIL** · REGRESSION **12 PASS** · NOT_REQUIRED **15**.

## 5. plan §10 강제 지점 — 검증자 재계수

| 지점 | 분모 | 재계수 | 관측 |
|---|---|---|---|
| EP-36 ① 두 진입점이 같은 상태 | 2 | **2/2** | `toggleDiffSidebar` 프로덕션 호출 = `GitContextBar.tsx:173`(폴더)·`:246`(메뉴) 둘, 액션 정의 = `chatStore.ts:1367` 하나 |
| EP-36 ② 선펼침 + 이동 | 2 | **1.5/2** | 선펼침 red(P36-2) · 이동은 **반쪽**(호출·스크롤 red, 소유자 green) |
| EP-34 ③ 패치 조회 소유자 | 1 | **1/1** | `.diffPatch(` 프로덕션 = `useGitPatch.ts:55` 하나(`shared/api/ipc.ts:148` 은 정의부, r1 이 계상) |
| EP-31 ①②③ 상한 셋 | 3 | **3/3** | `MAX_DIFF_FILES=200`·`MAX_PATCH_FILE_LINES=50_000`·`MAX_PATCH_TOTAL_LINES=200_000`, 예산 소비는 `git-diff-parse.ts:407` |

**구현자가 센 라벨을 표본으로 확인했다.** AT-52 의 "아이콘 버튼 **셋**" 은 참이다 — `GitContextBar.tsx` 의 버튼은 넷이고(`:169`·`:179`·`:198`·`:210`), 그중 `:179` 는 기준선 이름을 **보이는 텍스트**로 갖는 비교 트리거라 접근성 이름이 따로 필요 없다. 나머지 셋이 `iconOnly` 이고 셋 다 `aria-label` 을 갖는다.

## 6. 숫자 / 상한 재측정

- 테스트 총계 **3,080**: 구현 보고의 `3,071 → 3,080`(+9) 이 내역과 맞는다 — `fileSectionScroll` 4(신규 파일 `it` 4개) · `diffReviewNavigation` +2 · `chatReducer.plan` +2 · `git-diff-parse` +1 = **9**. `GitContextBar.render` 는 ±0(단언 교체, 실측 8케이스).
- 심은 결함 검산 **7 = D16 넷 + D17·D18·D19 각 1**: 맞다.
- 자기보고 합계 대조: 본문 `12/12` ↔ trailer `Criteria-Met: 12/12` ↔ INDEX 비고 — **세 자리가 같은 값**이다(0190 r1 형태의 분기 없음). 다만 검증 재판정은 `✅11 ⚠️1`(AT-50).

## 7. 게이트 재실행 — 산출 관측

| 게이트 | 산출 | 판정 |
|---|---|---|
| `npm run typecheck` | 3구성(node·web·test) **0줄** | PASS |
| `npm run lint` | **0 error · 1 warning**(`react-hooks/incompatible-library`, 기존분). 실행 후 `git status` **빈 출력** | PASS |
| `vitest run --maxWorkers=2` | **310파일 중 309 green · 3,080 케이스 전건 green** | PASS |
| 같은 실행의 red 1파일 | `chat-turn.continuity.test.ts` — `Electron failed to install correctly` | 환경 기인, 이번 diff 무관 |
| `node --test "scripts/*.test.mjs"` | **67/67 pass · 8 suites · fail 0** | PASS |
| `check-doc-inventory.mjs --check` | `ok (9 items, 82 channels)` · prose ok · links ok | PASS |
| `check-migrations-appendonly.mjs` | `20 migrations, dir == migrate.ts imports` · exit 0 | PASS |

- **검증 중 트리 변화 0**: 변이 7 + 독립 축 5 를 심을 때마다 `git checkout -- app/src` 로 되돌렸고, 마지막 `git status` 가 빈 출력이다. `lint` 는 `--fix` 라 파일을 쓸 수 있어 실행 직후 따로 확인했다 — 변화 없음.
- **windows CI 축은 이 라운드에서 로컬이 재지 못한다**(r2 실측). 이번 diff 는 경로를 값으로 비교하는 스윕을 건드리지 않았다.

## 8. 테스트 가능한 핸들 — D22 는 사람 실기가 아니다

남는 사람 실기는 **4건 그대로**다(파일 경계 가독성 · 사이드바 연출 · 형제 타일 대비 · 위쪽 확장 시야, D-060·D-067).

- **D22 는 자동 관측이 가능하다.** 두 길 중 하나면 닫힌다: ① `diffReviewNavigation.test.ts` 가 `DiffReview` 에 **스크롤 소유자를 주입**해 `revealFileSection.mock.calls[0][0]` 을 단언한다(D16 의 원래 처방이 이 길이다 — double 이 노드를 공급하면 소유자도 함께 잠긴다) ② 소스 스윕으로 `revealFileSection(` 의 첫 인자가 `scrollOwnerRef.current` 임을 고정한다(§10 EP-34 ③ 이 이미 쓰는 형태). DOM 패키지 추가는 필요 없다.
- 마운트 순서(effect) 자체는 이번에도 자동 oracle 이 없다 — `environment: 'node'` 의 한계다.

## 9. Repository operation checks

- `AGENTS.md` 변경: **없음** — 위생 검사 해당 없음.
- **trailer 파싱**: `git log -1 --format='%(trailers:only=true)' 762db42` 가 **8키**를 그대로 돌려준다. 허용값도 root `AGENTS.md` 표와 일치 — `Agent: claude` · `Status: implemented` · `Verified-By: pending`, `Criteria-*` 는 구현 커밋에만.
- 인용 커밋 실재: 위 §0 표의 7해시 전부 `commit`.
- **대상 커밋 좌표**: 구현자가 남긴 `(r3 구현 — 검증자 기입)` 을 **`762db42`** 로 채웠다(INDEX). plan 의 구현 보고 행은 자리표시자로 둔다 — 좌표 정본은 INDEX 한 곳이다.
- **`[구현자 기입]` 7필드**: **7/7 존재**. 산문으로 접힌 필드 0 — `이번 라운드 수정의 잠금` 이 7행 표를, `강제 지점 전수` 가 4행 표를 갖는다.
- INDEX 비고: 구현자 갱신분 **643자**(r2 809자에서 축소). 이번 검증 갱신에서 5줄 이내로 다시 쓴다.
- 이동/삭제한 reference: **없음**. `DiffReview.pickFile` 의 두 줄은 삭제가 아니라 `lib/fileSectionScroll.ts` 로 이설됐고 살아 있는 소비처를 갖는다.

## 10. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "심은 결함 7/7 RED" | **타당** | 7/7 직접 재현 |
| "r2 등록 변이 11/11 RED 재확인 · 덮개 회귀 0" | **표본에서 타당** | 이번 diff 가 건드린 4파일 주변 4건을 다시 심어 전건 RED. red→green 0 |
| "축을 둘로 갈랐다 — 부르는지와 무엇을 부르는지" | **부분적으로만 타당** | 두 반쪽은 각각 잠겼다. **둘을 잇는 세 번째 축(무엇을 소유자로 주는가)** 이 남는다 → D22 |
| "`ref` 배선은 typecheck 와 `data-diff-scroll-owner` 렌더 단언이 받는다" | **반증됨** | typecheck 0 error(A1) · 두 단언 모두 속성 존재만 확인 |
| "반환값이 생겼다, 지금 소비처는 없다" | **타당** | 프로덕션 소비처 실측 0. 테스트는 값을 단언한다(A5 red) |
| "D17 을 아이콘 버튼 셋 전부로 닫았다" | **타당하나 부분적** | 분모 셋은 참(§5). 속성 축은 닫혔고(M17 red) **슬롯 귀속**이 열려 있다 → D23 |
| "D7 은 사용자 결정" | **타당** | r2 재확인과 같다 — 이번 라운드에 바뀐 것 없다 |
| 자기보고 `Criteria-Met: 12/12` | **미달 1** | 검증 재판정 `✅11 ⚠️1` — AT-50 |

## 11. Finding disposition / 파생 이슈

이번 라운드 신규는 D22~D24 다. 정본 표는 [`plan.md` §[검증자 기입] 파생 이슈](plan.md) 에 함께 반영한다.

| # | finding | 귀속 | disposition |
|---|---|---|---|
| **D22** | 이동의 **소유자 인자**가 무관측 — `revealFileSection(null, path)` 로 프로덕션이 아무것도 스크롤하지 않게 해도 typecheck·lint·3,080 케이스 전건 green | VP-58 / AT-50 | **BLOCKING** — 소유자를 주입해 첫 인자를 단언하거나(D16 원래 처방) 소스 스윕으로 `scrollOwnerRef.current` 를 고정한다 |
| D23 | 아이콘 버튼 셋의 접근성 이름을 **서로 맞바꿔도** green — 세 문자열이 마크업에 모두 남아 존재 단언이 침묵한다 | VP-60 / AT-52 | NON_BLOCKING — 버튼을 지목해(`data-diff-sidebar-toggle` 등) 이름을 짝지어 단언한다 |
| D24 | §10 EP-36 ② 는 "먼저 펼친 뒤 이동" 이라 적었는데 순서를 뒤집어도 green | §10 EP-36 ②(문구) | NON_BLOCKING — 프로덕션 동작 차이가 없다(React 상태 갱신은 동기 DOM 을 바꾸지 않는다). 문구를 코드에 맞추거나 순서 oracle 을 세운다 |

**미검출 인용 변이**: **0**. D16 이 인용한 넷(M16a~M16d)과 D17·D18·D19 가 인용한 셋을 전부 다시 심어 RED 를 확인했다 — 구현자가 `closed` 로 적은 상태를 인용 변이 축에서 되돌릴 근거는 없다. **D16 만 예외로 `부분 closed`** 다: 인용 변이는 닫혔으나 구현자가 처방과 다른 장치를 골랐고 그 대체물의 새 실패 모드가 열려 있다(D22).

## 12. r2 파생 이슈 처리 확인

| # | r2 분류 | 구현자 상태 | 검증자 재판정 |
|---|---|---|---|
| **D16** | BLOCKING | closed | **부분 closed** — M16a~M16d red 로 인용 변이는 닫혔으나 소유자 축이 남았다 → **D22 로 이관** |
| D17 | NON_BLOCKING | closed | **closed** — M17 red. 슬롯 귀속은 신규 D23 |
| D18 | NON_BLOCKING | closed | **closed** — M18 red, 양성 짝(같은 key 보존)까지 있다 |
| D19 | NON_BLOCKING | closed | **closed** — M19 red, 상수에서 유도한 케이스다 |
| D20 | NON_BLOCKING | closed(설계) | **closed** — §18 이 r1 기준 + r2·r3 절로 갈렸고 열거가 `--stat` 과 맞는다 |
| D21 | NON_BLOCKING | closed(r2 검증) | **재발 아님** — 643자로 더 줄었고 이번 갱신에서 5줄 이내로 쓴다 |
| D7 | NON_BLOCKING | open(사용자) | **open 유지** — 이번 라운드에 바뀐 것 없다 |
| D15 | NEXT_HANDOFF | open | **open 유지** — `--maxWorkers=2` 로 이번에도 간헐 실패를 보지 않았다 |

## 13. Review Signals — 사실만

- **이전 라운드와 동일 증상인가**: **그렇다 — 같은 pair 의 세 번째 라운드다.** r1 = AC 가 이름 붙인 오라클 6자리 부재 → r2 가 5 닫음 → r3 이 넷을 닫고 **한 축을 옆으로 옮겼다**. 사용자가 보는 증상은 세 라운드가 같다: 사이드바에서 파일을 눌러도 화면이 안 움직이는데 전건 green.
- **관련 plan 지침/AC 가 있었는가**: **있었다.** AT-50 원문이 "파일 클릭이 그 섹션의 `scrollIntoView` 를 부른다고 단언(스텁)" 이고, D16 의 처방도 "double 이 스크롤 스파이를 단 **노드를 돌려주고**" 였다 — 처방을 따랐다면 소유자가 double 에서 나왔으므로 이 축이 함께 닫혔다.
- **구현자 = 검증자였는가**: **그렇다**(양쪽 `Agent: claude`). §4 가 요구한 독립 축 5건 중 **3건이 green** 이고 그중 하나가 이번 차단이다. 보고된 7변이만 다시 심었다면 이 라운드는 PASS 로 닫혔을 것이다.
- **사용자 결정 변경 근거**: 해당 없음 — Decision 변경 0 · 새 AC 0.
- **반복된 검증 환경 한계**: **셋 그대로** — ① `environment: 'node'`(DOM 패키지 미설치) ② electron 바이너리 미설치 1파일 red ③ 컨테이너 메모리 → `--maxWorkers=2`.
- **환경 한계 우회의 결과**: ①을 seam 으로 우회한 것 자체는 성립했다(이동의 **아래쪽 절반**은 DOM 없이 잠겼다). 다만 seam 을 만들면 **seam 자체가 새 분모**가 된다 — 이번 라운드가 그 값을 세지 않았다.

## 14. 결론 (r3)

- 상태: **FAIL**
- pair 결과: REQUIRED **11 PASS · 1 PAIR_FAIL**(VP-58) · REGRESSION **12 PASS** · BLOCKED_BY **0** · NOT_REQUIRED **15**
- PLAN_GAP: **없음** — AT-50 이 오라클을 이미 이름으로 적었다. 다음 주체는 **구현자**다.
- 등록 변이 **7/7 RED** · 이전 라운드 red 재현 **4/4 RED**(덮개 회귀 0) · 검증자 독립 축 **5건 중 3 green**(A1b·A1 차단 · A7·A2 비차단)
- §10 강제 지점: EP-36 **1.5/2** · EP-34 ③ **1/1** · EP-31 **3/3**. AT-52 분모 라벨("셋")은 표본 확인에서 참
- AC 충족: `✅11 ⚠️1 ❌0 / 12`(자기보고 `12/12`)
- 현재 변경 운영 gate: **6종 전건 PASS**. 로컬 vitest 의 1파일 red 는 electron 미설치. 검증 중 트리 변화·잔여물 **0**
- NON_BLOCKING: D23·D24 + 잔여 D7 · NEXT_HANDOFF: D15
- 남은 사람 확인: **4건 그대로**. D22 는 사람 실기가 아니다(§8)
- **다음 라운드는 r4 로 3 을 넘는다** — `handoff-verify` 마무리 규칙에 따라 **재구현 전에 `handoff-review` 를 수행한다**. 같은 pair 가 세 라운드 연속 root 실패이고, 세 번 다 "AC 가 이름 붙인 오라클을 다른 장치로 대신했다" 는 같은 형태다
