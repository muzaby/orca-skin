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

---

## Verify ΔV5+ΔV6 (라운드 3) — FAIL

> ΔV5 verify 가 밀려 있어 **ΔV5 와 ΔV6 을 한 번에** 검증한다. r1~r3 은 ΔV4 판정이고 그 원문은 위에 그대로 둔다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0211-worktree-session-ux` |
| 검증자 | Claude Code |
| 일자 | 2026-09-03 |
| 대상 커밋/range | ΔV5 `a6b4504d`·`6f8de148`·`40a1b918` · ΔV6 `171847d1` (코드 range `f060f26b..171847d1`, 0214 커밋 6건 제외) |
| 구현 전 plan 기준 | ΔV5 설계 `66556287` · ΔV6 설계 `1d6cfc52` |
| V mode / 유효 V | Delta V — `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 + ΔV6` |
| 검증 기준 plan revision | `66556287:ΔV5` · `1d6cfc52:ΔV6` |
| 라운드 | 3 (사용자 피드백 라운드라 유지) |
| 상태 | **FAIL** |
| 자기 검증 여부 | **설계·구현·검증이 모두 Claude 다.** §4 가 요구한 독립 축 **6건**(N1~N6)을 넣었고 그중 **4건이 green** — N1·N2·N3 이 이번 차단이다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: **그렇다. 다만 규범 행은 0건이다** — `a6b4504d`(+83) · `6f8de148`(±5) · `40a1b918`(+6) · `171847d1`(+121) 이 전부 `[구현자 기입]` 절 신설이고, `40a1b918` 만 §18 영향 파일에 `vitest.config.ts` 한 줄을 더했다(G4 로 보고됨).
- **기준선이 diff 로 성립한다** — 설계 커밋 둘(`66556287`·`1d6cfc52`)이 구현 커밋과 분리돼 있어 §0 의 자기 증명 방지 장치가 작동한다.
- Decision Ledger 변경: **설계 커밋에서만.** ΔV6 신설 11건(D-111~D-121) · `SUPERSEDED` 5건 — 전부 사용자 명시 근거가 §2 요구 출처 표에 있다.
- AC 변경: 구현 커밋 **0건**. AT-62~AT-69(ΔV5) · AT-70~AT-76(ΔV6) 원문 그대로 채점했다.
- V node/pair·requiredness·§10·oracle 변경: 구현 커밋 **0건**.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | ΔV6 기준 `628123bc` 재현 — `git show 628123bc:…/useGitSnapshot.ts` 의 `D-099` 수 = **2**(plan 이 적은 값과 일치) |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | ΔV6 의 `NEW`·`CHANGED` 왼쪽 node 가 VP-71~VP-77 에 전부 매핑된다 |
| 영향 INHERITED ↔ REGRESSION pair | 유효 | VP-63·VP-66 이 입력 타입 변경분을, VP-64·65·67~70 이 ΔV5 축을 회귀로 받는다 |
| pair별 path·§10 전수·직접 oracle | 유효 | EP-46~EP-51 이 전부 지점 수와 SSOT 를 적었다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | VP-74 만 `not selected`(직접 행동 oracle)이고 이유가 적혀 있다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | ΔV6 gate 차분이 채널 불변·variant +1 을 미리 적었고 실측이 일치한다(82 · 24) |

- root PLAN_GAP: **없음.** 아래 다섯 차단은 전부 plan 이 **이미 이름으로 적은** 계약이다(EP-46 ①②④ · D-118 · AT-75 클래스 절 · AT-76 검증 수단) — 구현 실패이지 계획 누락이 아니다.

## 1. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | **차단 하나** | Stop hook 배선이 빠지면 목록이 영영 미싱크다 — 옛 `busy` 폴백을 함께 지웠으므로 복구 경로가 없다(EP-46 실패 의미 원문) |
| false success 가능성 | **있다** | D25~D27 — 세 배선이 사라져도 게이트가 baseline 과 **완전히 같다** |
| partial failure/rollback | 문제 없음 | `turn.ended` 는 terminal 판정에 들어가지 않고 저장소 쓰기가 0이다 |
| Product/UX 의 A 가 아닌 B | **하나** | D-118 이 지정한 `fill-selected`(rust-soft) 대신 `fill-uncontained-active`(중립 회색)가 그려진다 |
| 증상만 제거하고 상태가 남았는가 | 아니오 | `shouldRefetchGitStatus` 를 파일에서 제거했고 `busy` 프로덕션 참조가 0건이다 |
| 캐시/축소가 잃은 관측 | 없음 | 패치 가드는 성공·실패·폐기 세 경로에서 풀린다(`useGitPatch.ts:106`·`112`) |
| 출력/요청 worst-case | 불변 | `MAX_DIFF_FILES` 200 · 패치 1 MiB 그대로. 범위가 좁아져 상한이 내려간다 |

## 2. 역방향 탐색

`rg` 가 이 환경에 없어 `scan-surface.sh` 대신 `grep -r` 로 같은 축을 돌았다.

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `makeTurnEndHook` 프로덕션 참조 | **배선은 있으나 잠금이 없다** | `claude.ts:406` 호출 1건. 그 호출을 지워도 전건 green(D25) |
| `drainTurnEnded` 소비처 | 같음 | `claude.ts:477`·`480` 두 드레인. 둘 다 지워도 green(D26) |
| `chatStore` 의 `turn.ended` 분기 | 같음 | `chatStore.ts:589` 1건. 지워도 green(D27) |
| `GitDiffSummary.uncommitted` | **죽은 필드** | 항상 `EMPTY_GROUP`. renderer 소비처 0건 — 구현자가 I-06 으로 보고했다 |
| 형제 정책 비대칭 | **결함** | 사이드바 선택은 `bg-fill-selected`(러스트) 2건, 헤더 세그먼트는 `bg-fill-uncontained-active`(중립) — 같은 "선택" 문법이 둘로 갈렸다(D28) |
| 신규 등록값의 기존 소비처 | 무영향 | `turn.ended` 는 terminal 열거 어디에도 들어가지 않고 `writer.ts` 는 `default` 절이 없어 무시한다 |
| 동일 규칙 중복 구현 | SSOT 유지 | `diffRevArgs` 하나를 요약·패치가 함께 쓴다 |
| 테스트 전용 잔여 | **하나** | `GitContextBar.render.test.ts:77` 의 `toggleDiffSidebar: vi.fn()` — 프로덕션에 없는 키(D30) |

## 3. 재측정 표 — 구현 보고가 등록한 변이 (ΔV6 12 · ΔV5 9 = 21/21 RED)

| 변이 | 스위트 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 복귀 해제 제거 | `gitRowState`+`gitRow.render` | red(자기보고) | **red** 1/21 | VP-71 등록 |
| M2 `order-first` CSS 축 | `gitRow.render` | red | **red** 1/9 | VP-71 등록 |
| M2b `×` 를 변경량 앞으로 | `gitRow.render`+`composerPanel.render` | red | **red** 1/14 | VP-71 등록 |
| M3 옛 `busy` 계기 부활 | `gitQueryReason` | red | **red** 2/9 | VP-72 등록 |
| M4 `Stop` 조각이 `{}` | `turn-end-hook` | red | **red** 4/4 | VP-72 등록 |
| M5 hook 이 `await` 뒤 발화 | `turn-end-hook` | red | **red** 1/4 | 새 oracle 민감도 |
| M6 패치만 작업 트리로 | `git-diff` | red | **red** 2/34 | VP-73 등록 |
| M7 리듀서가 tick 을 안 센다 | `chatReducer.turnEnd` | red | **red** 3/5 | VP-72 등록 |
| M8 유니온을 `range` 로 접음 | `diffPanel0211dv6.render` | red | **red** 1/14 | VP-75 등록 |
| M9 두 세그먼트에 같은 `pressed` | `diffPanel0211dv6`+`GitContextBar.render` | red | **red** 2/23 | VP-76 등록 |
| M10 옛 폭 클래스 병존 | `diffPanel0211dv6.render` | red | **red** 1/14 | VP-77 등록 |
| M11 `stripComments` 제거 | `diffPanel0211dv6.render` | red | **red** 2/14 | 새 oracle 민감도 |
| V5-M3 가드 해제 삭제 | `gitPatchGuard` | red | **red** 1/5 | VP-65 등록 |
| V5-M4 가드 통째 삭제 | `gitPatchGuard` | red | **red** 2/5 | VP-65 등록 |
| V5-M5 기준↔현재 맞바꿈 | `GitContextBar.render`+`diffPanel0211dv6` | red | **red** 3/23 | VP-66 등록 |
| V5-M6 기본 펼침 복귀 | `diffSyncState`+`diffTile.render` | red | **red** 3/34 | VP-67 등록 |
| V5-M7 두 문구를 같은 키로 | `diffSyncState.render` | red | **red** 1/7 | VP-64 등록 |
| V5-M8 `revealFileSection(null,…)` | `diffReviewNavigation` | red | **red** 1/6 | VP-70 등록 (D22 축) |
| V5-M9 서브메뉴를 평면으로 | `GitContextBar.actions`+`.render` | red | **red** 1/18 | VP-68 등록 |
| V5-M10 화이트리스트 삭제 | `files.openPath` | red | **red** 2/8 | VP-69 등록 (보안 축) |
| V5-M11 메뉴 항목 하나 삭제 | `diffViewMenu`+`GitContextBar.render` | red | **red** 3/16 | VP-68 등록 |

- **덮개 회귀 0.** 이전 라운드가 red 로 본 변이 중 이번에 green 이 된 것은 없다. ΔV5 의 `busy` 입력 축(V5-M1·M2)은 ΔV6 이 입력 타입을 바꿔 문언 그대로는 성립하지 않으며, 같은 계약을 M3 이 **더 넓게**(계기 부활 전체) red 로 잡는다.

### 재측정 표 — 검증자 독립 축 (6건 중 4 green)

> 구현자 = 검증자라 §4 가 요구한 축이다. 구현 보고가 **이름을 대지 않은** 지점·형제 슬롯·분모 재열거에서 만들었다.

| 축 | 무엇을 바꿨나 | 스위트 | 결과 | 귀속 |
|---|---|---|---|---|
| **N1** | `claude.ts:406` 의 `makeTurnEndHook(…)` **호출**을 지운다(팩토리는 그대로, import 도 정리해 진단 0) | **전건** | **green — 322/323 파일 · 3179/3179 케이스, baseline 과 동일** | **D25 BLOCKING** — EP-46 ① |
| **N2** | `drainTurnEnded()` 두 드레인 제거 → 잔여물(미사용 제너레이터·카운터)까지 밀어 진단 0 | **전건** | **green — 3178/3179**(유일 실패는 무관 flaky `queue-entry > removeWorktree`) | **D26 BLOCKING** — EP-46 ② |
| **N3** | `chatStore.receive` 의 `case 'turn.ended'` 제거(진단 0) | **전건** | **green — 322/323 · 3179/3179, baseline 과 동일** | **D27 BLOCKING** — EP-46 ④ 스토어 절반 |
| **N4** | `w-[25%]` 를 `<aside>` 에서 **형제 안쪽 `<div>`** 로 옮긴다(문자열은 파일에 남는다) | `diffPanel0211dv6.render` | **green** 0/14 | **D29 BLOCKING** — AT-76 오라클이 *어느 요소*인지 못 본다 |
| N5 | 두 세그먼트의 접근성 이름을 **맞바꾼다**(형제 슬롯 swap) | `diffPanel0211dv6`+`GitContextBar` ×2 | **red** 1/32 | 잠김 |
| N6 | `off` 세그먼트를 `display:none` 으로 숨긴다 | `diffPanel0211dv6`+`GitContextBar.render` | green 0/23 | 비귀속 — AC 가 가시성을 계약하지 않는다 |
| **D23 재측정** | 컨텍스트 바 `⋮` ↔ `↗` 의 `title`+`aria-label` 을 **맞바꾼다** | `GitContextBar.render`+`diffPanel0211dv6` | **green** 0/23 | **D23 은 닫히지 않았다** — ΔV5 §7 이 닫겠다고 적은 축이다 |

- 소거 변이의 잔여물 수렴: **N1 1단계 · N2 3단계**(드레인 → 제너레이터 → 카운터)까지 밀어 `eslint` 0 error · `tsc` 0 error 상태의 게이트로 판정했다.
- 형제 슬롯 맞바꿈: **2건**(M2b JSX 자리 · N5 라벨) — 둘 다 red.
- 동작 보존 추출 라운드인가: 아니오.

### 0건/전수 스윕 엄격화 (§8)

| 스윕 | 구현자 판정 기준 | 한 단계 엄격하게 | 차집합 |
|---|---|---|---|
| `gitSyncTriggersRemoved` 의 8 식별자 | `features/chat` + `i18n/resources` 두 subtree | **`app/src` 전체** 프로덕션 | **0** — G5 의 분모 축소가 성립한다 |
| `diffEmpty` 소비처 4 | 지정한 4파일에 존재 | renderer 전체에서 **전수 열거** | **0** — 정확히 4건 |
| `readUntracked`·`parseUntrackedPaths` 0건 | `app/src/main` | **`app/src` 전체**(테스트 포함) | **0** |

## 4. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 증거 / §10 전수 |
|---|---|---|---|---|
| VP-63 | UT | REGRESSION | **PASS** | 이름 축 세 계기 유지(`gitQueryReason` 9케이스) · EP-42 **3/3** |
| VP-64 | UT/AT | REGRESSION | **PASS** | V5-M7 red · EP-43 **2/2**(두 분기 + 두 키) |
| VP-65 | UT | REGRESSION | **PASS** | V5-M3·M4 양방향 red · EP-34 ④ **1/1** |
| VP-66 | UT/AT | REGRESSION | **PASS** | V5-M5 red · `all` 모드 순서 유지 · EP-28 **3/3** |
| VP-67 | AT | REGRESSION | **PASS** | V5-M6 red · `collapsedFiles` 전수 0 · EP-45 **2/2** |
| VP-68 | AT | REGRESSION | **PASS** | V5-M9·M11 red · EP-33 4 · EP-35 2 |
| VP-69 | IT | REGRESSION | **PASS** | V5-M10 red(보안 축) · `isInsideAllowedDir` 가 `resolve` 로 `..` 를 접는다 · EP-44 **3/3** |
| VP-70 | IT | REGRESSION | **PASS** | V5-M8 red — ΔV4 r3 의 **D22 가 여기서 닫혔다** · EP-36 ③ **1/1** |
| VP-71 | UT/AT | REQUIRED | **PASS** | M1·M2·M2b red · EP-48 **2/2**(`gitRowState.ts:56` · `CLOSE_GIT_ROW`, 해제 액션 0건) |
| **VP-72** | AR/IT | REQUIRED | **PAIR_FAIL** | 순수·리듀서 축은 red(M3·M4·M5·M7)이나 **EP-46 ①②④ 배선이 전부 무관측**(N1·N2·N3 green) → **1/4** |
| VP-73 | IT | REQUIRED | **PASS** | M6 red · 임시 저장소 3파일 fixture 집합 동등 · EP-47 **3/3** |
| VP-74 | AT | REQUIRED | **PASS** | 커밋 0 저장소 `files:[]`·`commits:[]` + 문구 1 · EP-49 **2/2** |
| VP-75 | UT/AT | REQUIRED | **PASS** | M8 red · 판별 유니온 + 두 갈래 렌더 · EP-50 **2/2** |
| **VP-76** | AT | REQUIRED | **PAIR_FAIL** | `aria-pressed` 축은 M9·N5 red 이나 **AC 가 이름 붙인 `bg-fill-selected` 절이 구현·단언 어디에도 없다** → EP-51 **1/2** |
| **VP-77** | AT | REQUIRED | **PAIR_FAIL** | **실측 9행이 D-118 과 다른 토큰**이고, 남은 행의 오라클이 소스 텍스트라 요소를 지목하지 않는다(N4 green) → EP-27 ④ **0/1** |
| VP-53·54·55·56·61·62 | 혼합 | REGRESSION | **PASS** | 기존 oracle 전건 재실행 green |
| VP-22·48·50 | 혼합 | REGRESSION | **PASS** | 합계 SSOT · `--no-optional-locks` · primitive 짝 유지 |
| VP-30 | — | SUPERSEDED | — | VP-73 이 더 넓은 술어로 받는다 |
| VP-01~08 · 18~21 · 24~29 · 31 · 35 · 39~42 · 45~47 · 49 · 57~59 | — | NOT_REQUIRED | — | 비영향 근거를 §18 파일 목록으로 재확인 |

- root `PAIR_FAIL`: **VP-72 · VP-76 · VP-77** 셋. 서로 독립된 원인이라 `BLOCKED_BY` 로 접지 않는다.
- 이번 라운드 실행 범위: **최초 검증**이므로 ΔV5+ΔV6 유효 V 의 REQUIRED·REGRESSION **전건**과 현재 변경 gate 를 실행했다.

### AT / AC 세부와 합계

| AT | 결과 | 검증 증거 |
|---|---|---|
| AT-62 계기 하나 | ✅ | `gitQueryReason` 9케이스 + 전수 0건 · M3 red |
| AT-63 미싱크 문구 | ✅ | 두 분기 + 두 키 · V5-M7 red |
| AT-64 패치 교착 부정 | ✅ | `fetch:true→false→(해제)→true` · V5-M3·M4 red |
| AT-65 `기준 → 현재` | ✅ | 순서 인덱스 · V5-M5 red |
| AT-66 기본 접힘 | ✅ | 첫 출력 diff 줄 0 · V5-M6 red |
| AT-67 메뉴 2행·7항목 | ✅ | 집합 동등 · V5-M9·M11 red |
| AT-68 파일 헤더 `↗` | ✅ | 허용 1 + 거부 3 · V5-M10 red |
| AT-69 이동 소유자 | ✅ | 첫 인자 단언 · V5-M8 red |
| AT-70 컴포저 `×` | ✅ | 세 값 + 자리 인덱스 · M1·M2·M2b red |
| **AT-71 Stop hook 싱크** | **❌** | 순수·리듀서는 닫혔으나 **hook → renderer 전 구간이 무관측**(N1·N2·N3 green) |
| AT-72 커밋 전용 범위 | ✅ | 임시 저장소 집합 동등 `{edited.ts}` · M6 red |
| AT-73 빈 커밋 문구 | ✅ | `files:[]`·`commits:[]` + 문구 + 소비처 4 |
| AT-74 모드별 라벨 | ✅ | 두 모드 산출 대조 · M8 red |
| **AT-75 세그먼트 둘** | **⚠️** | `aria-pressed` 상호배타는 성립(M9·N5 red). **클래스 절 미구현·미단언** |
| **AT-76 실측 9행** | **❌** | 9행이 `bg-fill-uncontained-active`/`text-t9` — D-118 위반. 나머지 행은 요소 미지목(N4 green) |

- **합계 재측정**: ΔV5 `✅8 · ⚠️0 · ❌0 = 8`(자기보고 8/8 — **일치**). ΔV6 `✅4 · ⚠️1 · ❌2 = 7`(자기보고 `✅7` — **불일치**).
- **합계 사본 대조**: 본문 7 ↔ trailer `Criteria-Met: 7/7` ↔ INDEX 비고 `AC 7/7` — 세 사본은 서로 일치하나 **재측정과 갈린다**.

### pair별 plan §10 강제 지점 분모 — 검증자 재계수

| EP | plan 지점 | 검증자 재열거 | 결과 |
|---|---|---|---|
| EP-42 | 3 | 두 함수 정의 2 + effect 배선 2 | **3/3** PASS |
| EP-42 ③ 갱신 | 1 | `useGitSnapshot.ts` 의 `busy` = **주석 2건**, 프로덕션 참조 **0** · deps 두 줄 `[tick, …]` | **1/1** PASS (보고값 `0` 은 재현 안 됨 → D31) |
| EP-43 | 2 | `DiffReview.tsx:104`·`:108` 두 분기 · `ko.ts:803`·`:804` 두 키 | **2/2** PASS |
| EP-44 | 3 | 스키마 모드 · `files.ts:88`·`:94` 두 분기 · `isAllowedDir` 재사용 1 | **3/3** PASS |
| EP-45 | 2 | 리듀서 액션 쌍 · 소비 컴포넌트 2(`DiffReview`·`DiffTileContent`) | **2/2** PASS |
| **EP-46** | 4 | ① `claude-adapt.ts:199` 1 ② `claude.ts:462·477·480` 3 ③ `ipc.ts:645` 1 ④ `chatReducer:888`+`chatStore:589` 2 — **존재는 7/7 이나 잠긴 것은 ④의 리듀서 1개뿐** | **1/4** PAIR_FAIL |
| EP-47 | 3 | `diffRevArgs` = `[oid,'HEAD']` · `readUntracked` 0 · `untrackedPatchFiles` 0 | **3/3** PASS |
| EP-48 | 2 | `gitRowState.ts:56` 판정식 · `CLOSE_GIT_ROW` + 해제 액션 **0건** | **2/2** PASS |
| EP-49 | 2 | ko/en 값 1 · 소비처 **4**(전수 재열거 일치) | **2/2** PASS |
| EP-50 | 2 | 판별 유니온 반환 · `label.kind === 'commit'` 두 갈래 | **2/2** PASS |
| **EP-51** | 2 | ① `pressed={!sidebarVisible}`·`pressed={sidebarVisible}` 2 ② 값을 싣는 액션 1, `toggleDiffSidebar` 프로덕션 0 — **①의 채움 절이 D-118 과 다르다** | **1/2** PAIR_FAIL |
| **EP-27 ④** | 1 | 실측 9행이 "표 한 곳에서 온다" 를 요구하는데 그 행의 토큰이 코드와 다르다 | **0/1** PAIR_FAIL |

- **`toggleDiffSidebar` 전수**: 구현 보고 `app/src` 0건 ↔ 재측정 **3건**(테스트 2 + 주석 1). 프로덕션 0 이라 계약은 성립하나 보고 수치는 재현되지 않는다(D31).
- 표 밖인데 같은 불변식이 필요한 지점: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 관측한 산출 |
|---|---|---|
| `npx eslint ./src ./scripts`(`--fix` 없이) | **PASS** | **0 error · 1 warning** — warning 은 `useTranscriptVirtualizer.ts:22` react-compiler 비호환(기준선) |
| `npm run typecheck` 3분할 | **환경 기인 2건** | `opencode-sdk.test.ts(7,8)`·`(14,8)` `TS2307 Cannot find module '@opencode-ai/sdk'`. `node_modules/@opencode-ai` **부재** — 0214 가 선언한 의존이고 ΔV6 기준선(`628123bc`)에 이미 있다 |
| `vitest run` 전건 | **PASS** | **323파일 중 322 green · 3,179/3,179 케이스**. 실패 1파일 = 같은 `opencode-sdk` import 오류(0 케이스 실행) |
| `check-doc-inventory --check` | **환경 기인** | `generated doc ok (9 items, 82 channels)` · `inventory.md` diff 0. exit 1 의 위반 **1,940건이 전부 `.claude/worktrees/**`** — `.git/info/exclude` 로 제외된 로컬 워크트리다. 추적 파일 위반 **0** |
| `check-migrations-appendonly` | **PASS** | `sync ok: 20 migrations` · `no-copies ok: 900 files` · `append-only ok since v0.3.1` · exit 0 |
| `node --test scripts/*.test.mjs` | **PASS** | **67/67 pass · 0 fail**(8 suites) |

- **exit code 를 통과 증거로 쓰지 않았다.** 첫 `vitest run --reporter=basic | tail` 이 **exit 0 인데 0 케이스**였다(리포터 로드 실패 + 파이프가 코드를 가림). 재실행해 산출을 관측했다.
- **게이트가 작업 트리를 바꿨는가**: **아니오.** `npm run lint` 는 `--fix` 라 남의 변경을 덮으므로 `npx eslint`(fix 없이)로 돌렸고, 전 게이트·전 변이 실행 후 `git status --porcelain` 이 비어 있다.
- **검증 중 잔여물**: 없음 — 임시 프로브 파일(`zzProbe.test.ts`)을 삭제해 트리를 비웠다.

## 5. 숫자 / 상한 재측정

- IPC 채널 **82** 불변 · `NormalizedEvent` variant **23 → 24**(`turn.ended` 신설) — `docs/generated/inventory.md:13`·`:15` 실측이 ΔV6 gate 차분과 일치.
- 마이그레이션 **20** 불변.
- `diffEmpty` 소비처 **4** · `⋮` 항목 **7**(`DIFF_VIEW_MENU_ITEMS` 배열 실측).
- `MAX_DIFF_FILES` 200 · 패치 1 MiB 불변. 범위가 `base..HEAD` 로 좁아져 worst-case 가 내려간다.

## 6. 테스트 가능한 핸들 — 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| Stop hook 배선 | 조각 등록·콜백 비동기성은 순수 단언으로 잠긴다. **배선도 잠글 수 있다** — plan §11 이 seam 을 이미 적었다("통합 — fake SDK 메시지 스트림"). 사람 실기가 아니다 | 실제 claude SDK 가 `Stop` 을 부르는지(외부 계약) |
| 활성 채움 색 | **기계 검증 가능** — `bg-fill-selected` 클래스 단언으로 잠긴다 | 러스트가 "선택됨" 으로 읽히는가(§19 ①) |
| 커밋 0 세션 문구 | 문구·소비처는 잠겼다 | "고장" 으로 읽히지 않는가(§19 ②) |
| 24.8% 사이드바 | 폭 값은 잠겼으나 **어느 요소인지**는 무관측(D29) | 실사용 폭에서 파일명 가독(§19 ③) |

## 7. Repository operation checks

- `AGENTS.md` 변경: **없음** — 위생 검사 해당 없음.
- INDEX 상태/다음 주체: **일치**(`impl / IMPL_DONE (ΔV6) / Claude`). 「다음 주체」 칸에 주체 하나만 있다.
- **대상 커밋 좌표 기입**: ΔV6 자리표시자 → **`171847d1`**(`git cat-file -t` = commit). ΔV5 칸의 "`628123bc` 에 squash 병합" 은 부정확하다 — ΔV5 는 **`a6b4504d`·`6f8de148`·`40a1b918` 세 일반 커밋**으로 들어왔고 셋 다 `628123bc` 의 조상이다. 좌표를 그대로 고쳤다.
- ΔV4 좌표 7개(`b85195e`…`177def6`)는 **살아 있다** — `claude/git-uphuk-panel-redesign-xybgmd` 에 있고 main 히스토리에는 rebase 된 사본이 있다. plan ΔV5 절이 그 사실을 이미 적었다.
- 비고 5줄 이내: **647자 5문장** — 상한 안.
- commit trailer: `171847d1`·`a6b4504d` 가 6키를 **그대로 파싱**한다. 설계 커밋 `1d6cfc52` 는 `Criteria-*`·`Next-Action` 없이 `Status: designed` — 규약 일치.
- `[구현자 기입]` 7필드: **ΔV5·ΔV6 모두 7/7 존재**. 산문으로 접힌 필드 0.

## 8. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| G1 `isInsideAllowedDir` 로 조상까지 올림 | **타당** — `hasSessionWithCwd` 는 동등 조회다. `resolve()` 가 `..` 를 접어 보안 축이 유지된다 | 수용 |
| G4 `vitest.config.ts` `testTimeout: 20_000`(범위 밖) | **타당** — red CI gate 는 갈림길이 아니라 미완료다. 멈춤 탐지는 예산과 무관하게 유지된다 | 수용. 저장소 전역 인프라 변경이라 사용자 확인 항목으로 남긴다 |
| G5 스윕 분모를 두 subtree 로 축소 | **타당** — `app/src` 전체 재측정에서 차집합 **0** | 수용 |
| 차이 1 `diffRevArgs` 가 `null` 반환 | **타당** — 빈 배열이면 `git diff` 가 작업 트리를 본다. 세 축(만료·공유·재진입) 보고도 성립 | 수용 |
| I-06 `uncommitted` 항상 빈 값 | **타당** — 소비처 0건 재확인 | NEXT_HANDOFF 로 이관 |
| I-08 `queue-entry` 간헐 실패 | **타당** — 단독 4회 중 1회 red(`release is not a function` → `EBUSY rmdir`). ΔV5·ΔV6 이 `queue*` 를 **한 줄도 바꾸지 않았다** | 환경 기인 분리 |

## 9. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| **D25** | `claude.ts:406` 의 `makeTurnEndHook(…)` 호출을 지워도 **전건 green**(3179/3179, baseline 동일). 계기의 시작점이 무관측이다 | VP-72 · §10 EP-46 ① | **BLOCKING** | 구현 — fake SDK 스트림으로 `options.hooks` 에 `Stop` 이 실렸는지 단언 |
| **D26** | `drainTurnEnded()` 두 드레인을 지우고 잔여물까지 밀어도 **green**(3178/3179, 유일 실패는 무관 flaky). 신호가 이벤트가 되는 자리가 무관측이다 | VP-72 · EP-46 ② | **BLOCKING** | 구현 — 버퍼 → `turn.ended` 변환을 통합으로 잠근다 |
| **D27** | `chatStore.receive` 의 `case 'turn.ended'` 를 지워도 **green**(3179/3179, baseline 동일). 이벤트가 리듀서에 닿는 자리가 무관측이다 | VP-72 · EP-46 ④ | **BLOCKING** | 구현 — 스토어 라우팅 케이스를 단언한다 |
| **D28** | 헤더 활성 세그먼트가 `bg-fill-uncontained-active`(ink 14% 중립) + `text-t9` 를 그린다. **D-118 이 지정한 값은 `bg-fill-selected`(rust-soft) + `text-accent`** 이고 사이드바 선택은 그 값을 쓴다 — 같은 "선택" 문법이 둘로 갈렸다 | D-118 ACTIVE · AT-75 클래스 절 · AT-76 실측 9행 · VP-76·VP-77 | **BLOCKING** | 구현 — 세그먼트에 `bg-fill-selected`/`text-accent` 를 주고 그 클래스를 단언한다 |
| **D29** | AT-76 오라클이 **소스 텍스트 스윕**이라 "어느 요소가 그 클래스를 갖는가" 를 보지 않는다. `w-[25%]` 를 형제 안쪽 `<div>` 로 옮겨도 green(N4). AC 검증 수단은 "대상 요소를 `data-*` 로 지목" 이었다 | VP-77 · AT-76 검증 수단 | **BLOCKING** | 구현 — 렌더 후 `data-*` 요소의 className 을 단언한다 |
| D30 | `GitContextBar.render.test.ts:77` 에 프로덕션에 없는 `toggleDiffSidebar: vi.fn()` mock 키가 남았다 | 비귀속 | NON_BLOCKING | 정리 |
| D31 | 구현 보고 두 수치가 재현되지 않는다 — `busy` 보고 `0` ↔ 실측 **2**(주석), `toggleDiffSidebar` 보고 `0` ↔ 실측 **3**(테스트·주석). 불변식(프로덕션 0)은 둘 다 성립 | 비귀속 | NON_BLOCKING | 다음 라운드 보고 시 술어를 오라클과 맞춘다 |
| D32 | `check-doc-inventory --check` 가 `.claude/worktrees/**`(git 제외 경로)를 스캔해 1,940건을 낸다. 추적 파일 위반은 0 | 비귀속 — 스크립트 기존 동작 | NEXT_HANDOFF | 스크립트가 `.git/info/exclude`·`.gitignore` 를 존중하게 |
| D33 | `GitDiffSummary.uncommitted` 가 항상 `EMPTY_GROUP` 인 죽은 계약 필드다(구현자 I-06) | 비귀속 — §6 비범위 | NEXT_HANDOFF | 계약 필드 제거 |
| D23(계속) | 컨텍스트 바 아이콘 버튼 둘의 접근성 이름을 맞바꿔도 green — r3 이 연 축이 ΔV5 의 처방 뒤에도 그대로다 | VP-60 / AT-52 | NON_BLOCKING | 버튼을 `data-*` 로 지목해 이름과 짝짓는다 |
| D34 | `queue-entry.test.ts` 가 `release is not a function` → `EBUSY rmdir` 로 간헐 실패한다(단독 4회 중 1). 고정 `setTimeout(150)` 경합 | 비귀속 — 이번 변경 무관(`queue*` diff 0) | NEXT_HANDOFF | 기존 D15·I-08 과 같은 축 |

## 10. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상인가**: **형태가 같은 것 둘, 새 형태 셋.** ΔV4 r1~r3 의 root 실패는 셋 다 "AC 가 이름 붙인 오라클을 다른 장치로 대신했다" 였고 D28·D29 가 같은 형태다. D25~D27 은 새 형태다 — **배선을 만들었으나 그 배선을 세는 오라클을 만들지 않았다**.
- **관련 plan 지침/AC 가 있었는가**: **전부 있었다.** EP-46 이 4지점을 번호로 적고 실패 의미까지 썼다("하나라도 빠지면 화면이 영영 갱신되지 않는다"). D-118 이 토큰 이름을 적었고 AT-75·AT-76 이 그 클래스를 단언하라고 적었다.
- **구현자 = 검증자였는가**: **그렇다**(양쪽 `Agent: claude`). §4 독립 축 6건 중 **4건 green**, 그중 넷이 차단이다 — 보고된 21변이만 다시 심었다면 이 라운드는 PASS 로 닫혔다. ΔV4 r3 과 같은 결론이 두 라운드 연속이다.
- **사용자 결정 변경 근거**: ΔV6 의 `SUPERSEDED` 5건은 전부 라이브 세션 명시 인용이 §2 표에 있다 — 무단 변경 0.
- **반복된 검증 환경 한계**: ① `environment: 'node'`(effect 계기를 렌더로 못 센다) ② `@opencode-ai/sdk` 미설치로 typecheck 2 · vitest 1파일 상시 red ③ 임시 저장소 스위트의 간헐 타이밍 실패 ④ **`rg` 부재** — `scan-surface.sh` 를 못 돌려 `grep -r` 로 대체했다.

## 11. 결론 (ΔV5+ΔV6)

- 상태: **FAIL**
- pair 결과: REQUIRED **4 PASS · 3 PAIR_FAIL**(VP-72·VP-76·VP-77) · REGRESSION **17 PASS** · BLOCKED_BY **0**
- PLAN_GAP: **없음** — 다섯 차단이 전부 plan 이 이미 이름으로 적은 계약이다. **다음 주체는 구현자다**
- 등록 변이 **21/21 RED**(ΔV6 12 · ΔV5 9) · 덮개 회귀 **0** · 검증자 독립 축 **6건 중 4 green**(D25·D26·D27·D29)
- §10 강제 지점: **EP-46 1/4 · EP-51 1/2 · EP-27 ④ 0/1**, 나머지 9개 EP 는 전수 일치
- AC 충족: ΔV5 `✅8/8`(자기보고 일치) · ΔV6 `✅4 ⚠️1 ❌2 / 7`(자기보고 `7/7` 과 불일치)
- 현재 변경 운영 gate: **eslint·vitest·migrations·scripts 4종 PASS**. typecheck 2건과 inventory exit 1 은 **환경 기인**(미설치 의존 · git 제외 워크트리)으로 분리했다. 검증 중 트리 변화·잔여물 **0**
- NON_BLOCKING: D30·D31 · NEXT_HANDOFF: D32·D33·D34
- 남은 사람 확인: §19 실기 **3건**(러스트 활성 채움 가독 · 커밋 0 세션 문구 · 24.8% 사이드바 폭) + `vitest.config.ts` 전역 `testTimeout` 20초 승인
- 다음 단계: **구현자가 D25~D29 를 닫는다**(+ 여전히 열린 D23). 라운드가 3을 넘으므로 재구현 전에 `handoff-review` 를 수행한다(AGENTS 트리거 — 라운드 초과 + 같은 형태 반복)

---

## Verify ΔV7~ΔV14 (라운드 4) — FAIL

> 라운드 3(ΔV5+ΔV6)이 FAIL로 닫힌 뒤 구현자가 ΔV7~ΔV14를 같은 라운드로 이어 붙였다. 이번 검증은
> **미검증분 ΔV7~ΔV14 + 라운드 3의 열린 root(D25~D29)** 를 함께 본다. 라운드 3 원문은 위에 그대로 둔다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0211-worktree-session-ux` |
| 검증자 | Claude Code |
| 일자 | 2026-09-04 |
| 대상 커밋/range | 미검증분 `171847d1..15baced` (impl 8: `7a6c04e`·`1a6cb00`·`7fde817`·`6f22f47`·`905573b`·`15dd6c7`·`af52753`·`15baced`) · PR [#429](https://github.com/muzaby/orca-skin/pull/429) (`628123bc..15bacede`) |
| 구현 전 plan 기준 | ΔV7 `8f02097` · ΔV8 `e5f7428`·`5f3fb79`·`b657fd3` · ΔV9 `10117ef` · ΔV10 `bcd0dee` · ΔV11 `619e645` · ΔV12 `21c83f6`·`47cf39a` · ΔV13 `6440799`·`32da703` · ΔV14 `6314867`·`99ebb1c` |
| V mode / 유효 V | Delta V — `V1 + ΔV1 … + ΔV14` |
| 검증 기준 plan revision | `99ebb1c:ΔV14` (그 아래 ΔV7~ΔV13은 각 설계 커밋 원문) |
| 라운드 | **4** (라운드 3의 root가 닫히지 않은 채 8개 revision이 더 쌓였다) |
| 상태 | **FAIL** |
| 자기 검증 여부 | **아니다** — ΔV7~ΔV14 구현자는 `Agent: codex`, 검증자는 Claude다. ΔV6 구현자만 Claude였고 그 축은 라운드 3이 이미 적었다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: **그렇다. 규범 행은 0건이다** — impl 8커밋이 전부 `[구현자 기입]` 절 신설이고, 그 밖의 변경은 메타 표의 `상태`·`이번 V revision`·`유효 V` 세 줄뿐이다.
- **기준선이 diff로 성립한다** — 8개 revision 모두 설계 커밋(`Status: designed`)이 구현 커밋(`Status: partial`)과 분리돼 있다.
- Decision Ledger 변경: **설계 커밋에서만.** D-122~D-153 신설, `SUPERSEDED` 다수 — 전부 각 절의 사용자 인용이 근거로 붙어 있다.
- AC 변경: 구현 커밋 **0건**. AT-77~AT-102 원문으로 채점했다.
- V node/pair·requiredness·§10·oracle 변경: 구현 커밋 **0건**.
- 채점 기준: 유효 V의 REQUIRED/REGRESSION pair + EP-46·EP-52~EP-77.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 각 revision이 기준 커밋을 적었다 — ΔV8 `7a6c04eb` · ΔV10 `7fde817b` · ΔV11 `6f22f473`. 적용 순서로 유효 V를 재구성할 수 있다 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | ΔV7 VP-78~80 · ΔV8 VP-81~85 · ΔV9 VP-86~87 · ΔV10 VP-88~90 · ΔV11 VP-91~93 · ΔV12 VP-94~95 · ΔV13 VP-96~100 · ΔV14 VP-101~103 이 각 NEW/CHANGED 왼쪽 node를 덮는다 |
| 영향 INHERITED ↔ REGRESSION pair | 유효 | ΔV12-REG·ΔV13-REG 및 VP-58~60·64·66·71·78~80·83·87·89 이 회귀를 받는다 |
| pair별 path·§10 전수·직접 oracle | 유효 | EP-52~EP-77이 전부 대상·N·실패 의미를 적었다 |
| 필요한 pair의 선택적 적대 증거 | 유효 | ΔV8 VP-83만 변이를 등록했고(“hook에서 comparison 운반 제거”), 나머지는 `직접 oracle이라 not selected`와 그 이유가 있다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | ΔV14가 URL/Git/메뉴 테스트·typecheck 3구성·lint·prettier·문서 gate·diff check를 열거했고 전부 실행 가능했다 |

- root PLAN_GAP: **없음.** 아래 여덟 차단은 전부 plan이 **이미 번호로 적은** 강제 지점이다(EP-46 ①②④ · EP-53 ① · EP-61 ① · EP-71 ③ · EP-73 ①② · EP-74 ① · EP-76 ③ · EP-77 ①) — 구현·오라클 실패이지 계획 누락이 아니다.

## 1. Product & UX / ACTIVE Decision — end-to-end

| Decision | 기대 결과 | 실제 production path | 판정 |
|---|---|---|---|
| D-151 (사내 hostname 포함) | `github.company.com` origin이 그대로 열린다 | `git remote get-url origin` → `githubRepositoryUrl` → `GitStatus.githubUrl` → 메뉴 | 충족 |
| D-152 (메뉴 조회 캐시) | 재클릭 재사용, 턴 종료·새로 고침에 갱신 | `GitRow.identityGeneration` → `GitIdentityMenus` key → `useGitIdentityRemote` → `gitApi.status` | 코드는 충족, **오라클 없음**(D35) |
| D-153 (빈 diff) | 본문 중앙 안내 1개·트리 0개·토글 숨김 | `GitContextBar.knownEmpty` / `DiffReview` / `ChangedNavigationSidebar` | 안내·트리·토글 충족, **중앙 배치 오라클 없음**(D38) |
| D-149 (수동 새로 고침) | 케밥 마지막 항목이 즉시 조회 | `diffViewMenuItems` → `GitContextBar.onRefresh` → `DiffTileContent` → `REFRESH_GIT_SNAPSHOT` → `gitRefreshTick` | 코드는 충족, **오라클 없음**(D36) |
| D-147 (코멘트 선택 연동) | composer↔diff 같은 항목이 함께 활성 | `chatStore.activeDiffRequirementId` → `DiffTileContent` → `DiffReview` | 코드는 충족, **오라클 없음**(D37) |
| D-115 (Stop hook 싱크) | 턴 종료가 git 목록 갱신의 유일한 계기 | `claude.ts:406` → `drainTurnEnded` → `chatStore` `turn.ended` | **라운드 3 이후 변화 0**(D25~D27) |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success 가능성 | **있다** | 메뉴 원격 조회를 통째로 끊어도(M41) 게이트가 3324/3324 green이다. 사용자에게는 메뉴가 `loading`에서 멈추는데 CI는 통과한다 |
| 실환경 실패 방식 | 양호 | `useGitIdentityRemote`의 error는 다음 열기에서 재시도하고(M38 red), 늦은 응답은 구 resource에만 반영된다 |
| partial failure/rollback | 해당 없음 | 이번 범위에 외부 쓰기·마이그레이션이 없다(migrations 20 불변) |
| A가 아닌 B를 구현했는가 | 아니다 | D-151의 “포함관계”가 `hostname.toLowerCase().includes('github')`로 정확히 구현됐다 |
| 증상만 제거하고 상태가 남았는가 | 아니다 | D-145가 cwd 변경 시 격리 선택을 실제로 OFF로 되돌린다(M21 red) |
| 최적화가 잃은 재검증 관측 | **부분적으로 있다** | ΔV13 캐시는 세대/cwd 무효화가 잠겨 있으나(M9·M10·M12 red), ΔV14 메뉴 캐시의 갱신 계기는 잠겨 있지 않다(M8) |
| 출력/요청 worst-case 상한 | 유지 | `GIT_PATCH_CACHE_SCOPES=16` · `GIT_PATCH_CACHE_BYTES=32MiB`가 잠겨 있다(M12 red) |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 171847d1..15baced   # 53 파일
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export 11건 | **정상** | `EMPTY_TREE_OID`·`GIT_PATCH_CACHE_SCOPES` 등은 동일 파일 내 소비 또는 테스트 상수다. 미배선 0 |
| 테스트 전용 참조 30건 | **정상 — 스크립트 오탐** | `createGitIdentityRemoteCache`·`createGitSnapshotQueryOwner`·`beginPatchQuery` 등 12개 심볼을 직접 대조해 **전부 동일 파일 내 프로덕션 호출**을 확인했다(정의+사용 2회 이상) |
| 형제 정책 비대칭 | **없음** | 스크립트 §3 = 0건 |
| 신규 등록값의 기존 소비처 | 무영향 | IPC 채널 82 불변(doc-inventory), 마이그레이션 20 불변 |
| producer ↔ consumer 파생 불일치 | **1건** | `diffRequirementSelection.render.test.ts`가 `DiffReview`를 직접 렌더하며 producer인 `DiffTileContent`를 지나지 않는다 → D37 |
| 동일 규칙 중복 구현 | SSOT 유지 | `githubRepositoryUrl` 한 곳이 SCP/URL 두 분기의 hostname 판정을 공유한다 |

## 4. 적대 증거 재측정 — 54변이 · RED 41 · GREEN 13

- **등록·인용 변이**: ΔV7~ΔV14가 등록한 변이는 ΔV8 VP-83 **1건뿐**이고(나머지는 “직접 oracle이라 not selected”), 그 1건을 재현해 red를 확인했다(M34) — **덮개 회귀 0**.
- **라운드 3 green 3건 재측정**: D25·D26·D27을 그대로 다시 심었고 **셋 다 여전히 green**(3324/3324, baseline 동일)이다.
- **라운드 3 red 변이**: ΔV6의 UI 변이들은 D-122·D-123·D-124·D-128이 계약 자체를 대체해 재측정 대상이 아니다. 대신 **후속 계약에 새 변이를 심어** 잠금을 확인했다(M39·M26~M28) — 이것으로 라운드 3의 D28·D29를 닫았다.
- **검증자 독립 축 50건** — 구현 보고가 이름을 대지 않은 축이며 그중 **10건이 green**이다.
- 동작 보존 추출 라운드인가: **아니다** — 신규 기능 8건이라 hunk 되돌림 논점이 없다.
- 소거 변이의 잔여물 수렴: 전 변이가 typecheck를 깨지 않는 형태다(상수 치환·조건 고정·구문 제거 후 사용처 없음). 잔여물 기인 red 0.

| 변이 | 대상 / 계약 | 결과 | 귀속 |
|---|---|---|---|
| D25 | `claude.ts:406` `makeTurnEndHook(…)` 호출 제거 | **GREEN** | VP-72 · EP-46 ① — 라운드 3과 동일 |
| D26 | `drainTurnEnded()` 두 드레인 제거 | **GREEN** | VP-72 · EP-46 ② |
| D27 | `chatStore` `case 'turn.ended'` 제거 | **GREEN** | VP-72 · EP-46 ④ |
| M1 | `hostname.includes('github')` → `=== 'github.com'` | RED (12) | VP-101 · EP-75 ③ |
| M2 | 반환 주소를 `github.com` 고정 | RED (12) | VP-101 · EP-75 ③ |
| M37 | SCP host 추출을 고정 호스트로 대체 | RED (7) | VP-101 · EP-75 ① |
| M3 | `if (pending) return pending` 제거 | RED (1) | VP-102 · EP-76 ① |
| M4 | `ready\|unavailable` 조기 반환 제거 | RED (3) | VP-102 · EP-76 ① |
| M38 | error 재시도 → error 고착 | RED (1) | VP-102 · EP-76 ② |
| **M41** | 훅의 `void cache.ensure()` 제거 — 메뉴가 원격을 **아예 조회하지 않는다** | **GREEN** | VP-102·VP-100 · EP-76·EP-74 → D35 |
| **M8** | `identityGeneration`을 상수 `''`로 — 턴 종료·새로 고침이 원격을 갱신하지 않는다 | **GREEN** | VP-102 · EP-76 ③ → D35 |
| **M5** | 빈 안내의 `flex h-full items-center justify-center text-center` 제거 | **GREEN** | VP-103 · EP-77 ① → D38 |
| M23 | 빈 안내 문구 자체 제거 | RED (4) | VP-103 · EP-77 ① (존재는 잠김) |
| M6 | 파일트리에 빈 안내 복원 | RED (7) | VP-103 · EP-77 ② |
| M7 | `{!knownEmpty && …}` → 항상 렌더 | RED (1) | VP-103 · EP-77 ③ |
| M9 | `next.push(...)` 제거 — 캐시 미기록 | RED (4) | VP-96 · EP-70 ① |
| M10 | `cache.find(...)` → `undefined` — 캐시 미조회 | RED (4) | VP-96 · EP-70 ② |
| M12 | `GIT_PATCH_CACHE_SCOPES` 16 → 1000 | RED (1) | VP-96 · EP-70 상한 |
| M11 | 초과 단일 패치 guard 제거 | **GREEN** | 부분 등가 변이 → D42 |
| **M13** | `DiffTileContent.activeRequirementId` → `null` | **GREEN** | VP-97 · EP-71 ③ → D37 |
| M14 | composer 선택이 diff 선택을 세우지 않게 | RED (1) | VP-97 · EP-71 ① |
| M15 | writer의 `diff_requirements` → `text` | RED (2) | VP-98 · EP-72 ③ |
| M16 | 로드 경로의 `diff_requirements` 분기 제거 | RED (1) | VP-98 · EP-72 ④ |
| M17 | 케밥 `refresh` 항목 id 변경 | RED (2) | VP-99 · EP-73 ① (존재만) |
| **M42** | `REFRESH_GIT_SNAPSHOT`이 tick을 올리지 않게 | **GREEN** | VP-99 · EP-73 ② → D36 |
| **M43** | `DiffTileContent.onRefresh` 배선 제거 | **GREEN** | VP-99 · EP-73 ① → D36 |
| M18 | `renderTrigger` 무시 — 묶음 미조립 | RED (8) | VP-94 · EP-67 |
| M19 | `type="checkbox"` → `hidden` | RED (4) | VP-95 · EP-68 ① |
| M22 | 전송 중 `disabled` 제거 | RED (2) | VP-95 · EP-68 ② |
| **M20** | `accent-selected` 제거 | **GREEN** | EP-68 시각 토큰 → D41 |
| M21 | cwd 변경 시 격리 초기화 제거 | RED (2) | ΔV12 · EP-69 |
| M24 | 요약 미준비여도 diff 버튼 렌더 | RED (4) | VP-86·87 · EP-60 ③ |
| M25 | `gitRowView`가 null totals를 0/0으로 | RED (1) | VP-86 · EP-60 ② |
| M26 | 사이드바 `w-[240px]` → `300px` | RED (1) | VP-79 · EP-53 |
| M27 | 커밋 목록 `max-h-[40%]` → `80%` | RED (1) | VP-79 · EP-53 |
| M28 | 파일 밴드 `h-[32px]` → `48px` | RED (1) | VP-79 · EP-53 |
| **M29** | 헤더 밴드 `h-[32px]` → `48px` | **GREEN** | VP-79 · EP-53 ① → D39 |
| M30 | 브랜치 URL 경로·인코딩 제거 | RED (2) | VP-92 · EP-65 ③ |
| M31 | 브랜치 이름 복사를 3자로 절단 | RED (3) | VP-92 · EP-65 ② |
| M32 | `window.open` 제거 | RED (2) | VP-92 · EP-65 ① |
| M33 | 메뉴 키보드 포커스 이동 제거 | RED (1) | VP-93 · EP-66 ③ |
| M34 | 실제 IPC 요청에서 `comparison` 제거 | RED (2) | **VP-83 등록 변이 재현** |
| M35 | 첫 부모 대신 empty tree를 base로 | RED (2) | VP-82 · EP-56 ③ |
| M36 | 선택 커밋을 patch 실행에 미전달 | RED (3) | VP-82 · EP-56 ④ |
| M39 | 목록 토글의 `selected`/`selected-soft` 제거 | RED (1) | VP-81 · D-128 (구 D28 후속) |
| M40 | 파일 밴드 글자 크기를 nav 토큰에서 분리 | RED (1) | VP-81 · EP-55 ③ |
| M44 | 헤더 토글이 같은 값을 세우게 | RED (2) | VP-78 · EP-52 ① |
| M45 | 설정 메뉴 진입점이 같은 값을 세우게 | RED (2) | VP-78 · EP-52 ② |
| M46 | 삭제 줄의 old 축 번호 제거 | RED (1) | VP-80 · EP-54 |
| M47 | composer 입력 안 인용 타일 슬롯 제거 | RED (1) | VP-89 · EP-62 ② |
| M48 | 빈 입력에서도 제출 가능하게 | RED (1) | VP-84 · EP-58 ③ |
| M49 | 작성 상자 `focus-within:border-selected` 제거 | RED (1) | VP-90 · EP-63 ① |
| **M50** | 작성 입력 `[field-sizing:content]` 제거 | **GREEN** | VP-88 · EP-61 ① → D40 |
| M51 | 비교 범위 태그 필터 무력화 | RED (2) | VP-85 · EP-59 ③ |

## 5. V-pair closeout — 재검증 범위

> 실행 범위: 라운드 3의 root(VP-72·76·77) + ΔV7~ΔV14의 REQUIRED/REGRESSION 전건 + 현재 변경의 운영 gate.

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP-72 | AR↔IT | REQUIRED | **PAIR_FAIL** | D25·D26·D27 전건 green — 라운드 3에서 변화 0 |
| VP-76 · VP-77 | R↔AT | NOT_REQUIRED | 계약 대체 | D-122·D-123이 AT-75/76 계약을 SUPERSEDE. 후속 계약은 M39·M26~M28 red |
| VP-78 | R↔AT, AR↔IT | REQUIRED | PASS | M44·M45 red |
| VP-79 | R↔AT | REQUIRED | **PAIR_FAIL** | M29 green (EP-53 ①); M26·M27·M28 red |
| VP-80 | R↔AT, MD↔UT | REQUIRED | PASS | M46 red |
| VP-81 | R↔AT | REQUIRED | PASS | M39·M40 red |
| VP-82 | R↔AT, MD↔UT | REQUIRED | PASS | M35·M36 red (실제 Git fixture) |
| VP-83 | R↔AT, AR↔IT | REQUIRED | PASS | M34 red — 등록 변이 재현 |
| VP-84 | R↔AT | REQUIRED | PASS | M48 red |
| VP-85 | R↔AT, AR↔IT | REQUIRED | PASS | M51 red |
| VP-86 · VP-87 | R↔AT, MD↔UT, AR↔IT | REQUIRED | PASS | M24·M25 red |
| VP-88 | R↔AT | REQUIRED | **PAIR_FAIL** | M50 green (EP-61 ①) |
| VP-89 | R↔AT, AR↔IT | REQUIRED | PASS | M47 red |
| VP-90 | R↔AT | REQUIRED | PASS | M49 red |
| VP-91 | R↔AT, AR↔IT, MD↔UT | REQUIRED | PASS | M1·M2·M37 red |
| VP-92 | R↔AT | REQUIRED | PASS | M30·M31·M32 red |
| VP-93 | R↔AT | REQUIRED | PASS | M33 red |
| VP-94 | R↔AT, AR↔IT, MD↔UT | REQUIRED | PASS | M18 red |
| VP-95 | R↔AT | REQUIRED | PASS | M19·M22 red (M20은 시각 토큰 → D41) |
| VP-96 | R↔AT, AR↔IT, MD↔UT | REQUIRED | PASS | M9·M10·M12 red |
| VP-97 | R↔AT, AR↔IT | REQUIRED | **PAIR_FAIL** | M13 green — producer `DiffTileContent`를 지나는 오라클 0 |
| VP-98 | R↔AT, SD↔ST, AR↔IT | REQUIRED | PASS | M15·M16 red · 실제 DB roundtrip 11건 |
| VP-99 | R↔AT, AR↔IT | REQUIRED | **PAIR_FAIL** | M42·M43 green |
| VP-100 | R↔AT, AR↔IT | REQUIRED | **PAIR_FAIL** | M41 green (VP-102와 root 공유) |
| VP-101 | R↔AT, MD↔UT | REQUIRED | PASS | M1·M2·M37 red |
| VP-102 | R↔AT, AR↔IT, MD↔UT | REQUIRED | **PAIR_FAIL** | M41·M8 green — 팩토리만 잠기고 배선은 무관측 |
| VP-103 | R↔AT, MD↔UT | REQUIRED | **PAIR_FAIL** | M5 green (EP-77 ①); M6·M7·M23 red |
| ΔV12-REG · ΔV13-REG · VP-58~60·64·66·71 | 회귀 | REGRESSION | PASS | 전체 스위트 342파일 3324케이스 green |

- root `PAIR_FAIL` **8**: VP-72 · VP-79 · VP-88 · VP-97 · VP-99 · VP-100 · VP-102 · VP-103
- 공유 root: **M41 하나가 VP-100·VP-102를 함께 연다** — 같은 누락 오라클이라 두 행에 같은 증거를 적었고 네 단계로 부풀리지 않았다.
- 종속 `BLOCKED_BY`: **0** — 여덟 실패 모두 상위 행동을 다른 경로에서 독립 관측했다.

### AT / AC 세부와 합계 (이번 revision ΔV14)

| AT | 결과 | 검증 증거 |
|---|---|---|
| AT-100 | ✅ | M1·M2·M37 red · `github-url.test.ts` + 실제 Git `git-cli.test.ts` |
| AT-101 | ⚠️ | 캐시 팩토리는 M3·M4·M38 red. **배선은 M41·M8 green** — “메뉴 open→resource→load” 경로가 무관측 |
| AT-102 | ⚠️ | 안내 1개·트리 0개·토글 0개는 M23·M6·M7 red. **중앙 배치는 M5 green** |

- **합계 재측정**: `✅ 1 · ⚠️ 2 · ❌ 0 = 총 3`. 자기보고 `✅3 ⚠️0 ❌0` 과 **불일치**.
- **합계 사본 대조**: 본문 자기보고 `3` ↔ trailer `Criteria-Met: 3/3` ↔ INDEX 비고 `ΔV14 AC 3/3` — 세 사본은 서로 일치하나 검증 재측정과 갈린다.

### pair별 plan §10 강제 지점 분모 — 검증자 재계수

| EP | plan N | 검증자 확인 | 결과 |
|---|---|---|---|
| EP-46 (ΔV6) | 4 | **1/4** — ①②④ 무관측 | PAIR_FAIL (라운드 3 유지) |
| EP-52 | 2 | 2/2 (M44·M45) | PASS |
| EP-53 | 5 | **3/4 측정** — 헤더 밴드 green(M29). 트리 들여쓰기 1지점은 **미측정** | PAIR_FAIL |
| EP-54 | 2 | 1/2 측정 (M46) | PASS |
| EP-55 | 3 | 2/3 측정 (M39·M40) | PASS |
| EP-56 | 4 | 2/4 측정 (M35·M36) | PASS |
| EP-57 | 8 | 1/8 측정 (M34, 등록 변이) | PASS |
| EP-58 | 4 | 1/4 측정 (M48) | PASS |
| EP-59 | 4 | 1/4 측정 (M51) | PASS |
| EP-60 | 3 | 2/3 측정 (M24·M25) | PASS |
| EP-61 | 2 | **1/2 — ① green(M50)** | PAIR_FAIL |
| EP-62 | 3 | 1/3 측정 (M47) | PASS |
| EP-63 | 3 | 1/3 측정 (M49) | PASS |
| EP-64 | 4 | 3/4 측정 (M1·M2·M37) | PASS |
| EP-65 | 3 | 3/3 (M30·M31·M32) | PASS |
| EP-66 | 4 | 1/4 측정 (M33) | PASS |
| EP-67 | 2 | 1/2 측정 (M18) | PASS |
| EP-68 | 2 | 2/2 (M19·M22) | PASS |
| EP-69 | 1 | 1/1 (M21) | PASS |
| EP-70 | 3 | 2/3 + 상한 (M9·M10·M12) | PASS |
| EP-71 | 4 | **2/4 — ③ green(M13)** | PAIR_FAIL |
| EP-72 | 4 | 2/4 측정 (M15·M16) | PASS |
| EP-73 | 4 | **1/4 — ①② green(M42·M43)** | PAIR_FAIL |
| EP-74 | 3 | **0/3 — ① green(M41)** | PAIR_FAIL |
| EP-75 | 3 | **3/3** (M1·M2·M37) | PASS |
| EP-76 | 3 | **2/3 — ③ green(M8), 배선 green(M41)** | PAIR_FAIL |
| EP-77 | 3 | **2/3 — ① 중앙 green(M5)** | PAIR_FAIL |

- **이번 revision ΔV14 합계: EP-75~77 = 7/9.** 자기보고 `9/9`와 **불일치**.
- 못 본 것: EP-53의 트리 들여쓰기, EP-57의 8지점 중 7, EP-66의 4지점 중 3 등은 **측정하지 않았다** — 위 표의 `측정` 표기가 그 범위다. 미측정을 PASS 근거로 쓰지 않았고, 해당 pair의 PASS는 측정한 지점의 red에 근거한다.

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 산출 |
|---|---|---|
| `tsc --noEmit` node/web/test | **PASS** | 3구성 모두 오류 **0** |
| `eslint ./src ./scripts` (`--fix` 없이) | **PASS** | **0 error · 1 warning** (기존 `useTranscriptVirtualizer`) |
| `vitest run` (전체) | **PASS** | **342파일 / 3324케이스 / 실패 0 / skip 0** |
| `node --test scripts/*.test.mjs` | **PASS** | **67/67** |
| `check-migrations-appendonly` | PASS | 마이그레이션 **20**, 소스 931파일 스캔 |
| `check-doc-inventory --check` | PASS | generated(9 items · **82 channels**) · prose · links 3종 |
| `prettier --check` (변경 소스) | PASS | 전건 통과 |
| `git diff --check` | PASS | 0건 |

## 6. 숫자 / 상한 재측정

- `rightpanel` 스위트: **21파일 / 203케이스** — 자기보고와 **일치**.
- `writer.test.ts`: **11건** — 자기보고와 **일치**.
- IPC 채널 **82** · 마이그레이션 **20** — 이번 변경으로 불변.
- 캐시 상한 `16범위 / 32MiB`: 상한 변경이 red를 낸다(M12).
- **환경 개선**: `npm rebuild better-sqlite3`(Node ABI)로 DB 스위트까지 green이다. 라운드 3의 “ABI 차단 10파일 56건 red”는 이번 환경에서 **0**이며, 라운드 3이 적은 환경 한계 ②③④가 해소됐다.

## 7. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 메뉴 원격 조회 | 팩토리 5케이스(M3·M4·M38) | **없음 — 사람 실기가 아니라 결손이다.** `GitIdentityMenus`를 렌더해 `gitApi.status` 호출 수를 세면 M41·M8이 red가 된다 |
| 코멘트 선택 연동 | `DiffReview` prop 렌더 | **없음 — 결손.** `DiffTileContent`를 store와 함께 렌더하면 M13이 red가 된다 |
| 수동 새로 고침 | 메뉴 항목 존재(M17) | **없음 — 결손.** reducer 전이 단언 1줄이면 M42가 red가 된다 |
| 중앙 배치·헤더 32px·자동 높이 | 클래스 문자열 미단언 | 렌더 후 className 단언으로 기계화 가능(M26~M28이 같은 방식으로 이미 red) |
| 파란 accent 색 실측 | — | **두 테마 계산색** — `src/renderer/AGENTS.md`가 시각 검증으로 갈음한다고 적었다 |

## 8. Repository operation checks

- **AGENTS.md 변경**: 이번 범위에 없다 — 위생 스캔 대상 0.
- **INDEX 보드**: 상태 `impl/IN_PROGRESS`·다음 주체 `Codex`는 구현 시점 기준이었다. 이번 검증으로 `verify/FAIL`·다음 주체 `Codex`·라운드 4로 갱신한다. 비고 5줄 이내.
- **대상 커밋 좌표**: 자리표시자 `(r3 구현 — 검증자 기입)`을 실제 8커밋으로 기입했다. 인용 해시는 `git cat-file -t`로 전건 실재를 확인했다.
- **trailer 파싱**: PR의 **24커밋 전부** `git log -1 --format='%(trailers:only=true)'`가 적힌 키를 그대로 돌려준다(3~6키). 0건 없음.
- **trailer 허용값**: 값은 전부 허용값이나, **설계 커밋 12건이 `Agent: codex` + `Status: designed`** 다 — root `AGENTS.md` 커밋 프로토콜은 설계 커밋을 `Agent: claude`로 적는다 → D43.
- **`[구현자 기입]` 7필드**: ΔV7~ΔV14 **8라운드 전건 7필드 존재**(ΔV14만 `강제 지점 전수`와 `V-pair 자기확인`을 한 제목으로 묶었고 내용은 둘 다 있다). 산문으로 접힌 필드 0.
- **reference/script**: 이동·삭제 0.

## 9. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| “별도 mutation은 선택하지 않는다 — 직접 oracle이다” (8라운드 전건) | **부분 부당.** 직접 oracle이 있는 지점은 실제로 잠겨 있으나(41 red), **배선 지점 6곳은 오라클 자체가 없다** | D35~D40 |
| “EP-75~77 9/9” | **재계수 7/9** | §5 §10 표 |
| “기존 ΔV6 D25~D27 차단 유지” | **정확하다** — 재측정도 green이다 | 유지 |
| ΔV13 “LRU 16개/추정 32MiB 제한과 초과 패치 미보관 단언 통과” | **상한은 재현(M12 red), 초과 패치 guard는 부분 등가라 재현 불가** | D42 |
| ΔV14 “rightpanel 21파일/203케이스” | **재현** | §6 |

## 10. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D25·D26·D27 | 라운드 3의 Stop hook 3지점이 **8 revision 뒤에도 그대로 green** | VP-72 · EP-46 ①②④ | **BLOCKING** | 라운드 3 후속란 그대로 |
| **D35** | 메뉴 원격 조회 배선이 무관측 — `ensure()` 호출을 지워도(M41), 갱신 세대를 상수로 만들어도(M8) 3324/3324 green. 유일한 테스트는 팩토리 단위 테스트다 | VP-102·VP-100 · EP-76 ③·EP-74 ① | **BLOCKING** | `GitIdentityMenus`를 렌더해 `gitApi.status` 호출 수와 갱신 계기를 단언 |
| **D36** | 수동 새로 고침의 효과가 무관측 — tick 미증가(M42)·`onRefresh` 미배선(M43) 둘 다 green. 메뉴 항목 존재만 잠겨 있다 | VP-99 · EP-73 ①② | **BLOCKING** | `REFRESH_GIT_SNAPSHOT` 전이와 `DiffTileContent` 배선을 단언 |
| **D37** | composer↔diff 선택 연동 배선이 무관측 — `activeRequirementId`를 `null`로 고정해도 green(M13). 선택 테스트가 producer `DiffTileContent`를 건너뛰고 `DiffReview`를 직접 렌더한다 | VP-97 · EP-71 ③ | **BLOCKING** | store를 지나는 렌더로 양방향 활성을 단언 |
| **D38** | 빈 diff 안내의 **중앙 배치**가 무관측 — 중앙 클래스를 지워도 green(M5). 존재·트리·토글은 잠겨 있다 | VP-103 · EP-77 ① | **BLOCKING** | 렌더 후 해당 요소 className을 단언(M26~M28과 같은 방식) |
| **D39** | 헤더 밴드 `h-[32px]`가 무관측 — 48px로 바꿔도 green(M29). 파일 밴드·사이드바·목록 높이는 잠겨 있다 | VP-79 · EP-53 ① | **BLOCKING** | `RightPanelTile` 헤더를 같은 render 테스트에 추가 |
| **D40** | 작성 입력 자동 높이 `[field-sizing:content]`가 무관측(M50) | VP-88 · EP-61 ① | **BLOCKING** | 렌더 className 단언 |
| D41 | `accent-selected` 파란 체크 토큰이 무관측(M20) | EP-68 시각 | NON_BLOCKING | `src/renderer/AGENTS.md`가 시각은 육안 검증으로 갈음한다 |
| D42 | 초과 단일 패치 guard 제거가 green(M11). 단일 항목이면 `while` 루프가 같은 결과를 내는 **부분 등가 변이**이고, 다항목 캐시 전체가 비워지는 차이만 무관측 | 비귀속 — 계약 미명시 | NON_BLOCKING | D-146에 “기존 캐시 보존” 여부를 적을지 설계 판단 |
| D43 | 설계 커밋 12건이 `Agent: codex` + `Status: designed` — root `AGENTS.md`는 설계 커밋을 Claude 몫으로 적는다 | 비귀속 — 협업 프로토콜 | NON_BLOCKING | 주체 배분 재확인 |
| D44 | 라운드 3 verify가 지시한 `handoff-review`가 수행되지 않았다. 저장소에 review 산출물·커밋 0건이며 ΔV7~ΔV14가 라운드 3을 유지했다 | 비귀속 — 프로세스 | NON_BLOCKING | 재구현 전 `handoff-review` |
| D45 | `mutation-queue.test.ts:35` 고정 `setTimeout(10)` 경합으로 54회 실행 중 **2회** 간헐 실패. 변경 무관(`mutation-queue` diff 0) | 비귀속 | NEXT_HANDOFF | 라운드 3 D34·D15와 같은 축 |
| D32(계속) | 라운드 3의 inventory 워크트리 스캔은 **이 환경에 `.claude/worktrees/`가 없어 재현되지 않았다** — 수정이 아니라 환경 차이다 | 비귀속 | NEXT_HANDOFF | 유지 |

## 11. Review Signals — 사실만

- **이전 라운드와 동일 증상**: **그렇다.** 라운드 3의 root 형태는 “배선을 만들었으나 그 배선을 세는 오라클을 만들지 않았다”(D25~D27)였고, 이번 D35·D36·D37이 **같은 형태**다. 세 라운드 연속(ΔV4 r3 · ΔV5+ΔV6 · 이번)으로 같은 형태가 나왔다.
- **관련 plan 지침/AC의 존재**: **전부 있었다.** EP-71 ③은 “diff prop 전달”, EP-73은 “refresh tick/조회 계기”, EP-76 ③은 “GitRow 갱신 세대 전달”을 번호로 적고 실패 의미까지 썼다.
- **8라운드 전건이 “별도 mutation not selected”**를 적었고, 그 근거는 “직접 oracle”이었다. 직접 oracle이 실제로 있는 지점은 잠겼고(41 red), **직접 oracle이 없는 지점만 green**이 됐다 — 즉 not-selected 판단 자체가 오라클 유무를 확인하지 않은 채 내려졌다.
- **사용자 결정 변경 근거**: ΔV7~ΔV14의 `SUPERSEDED`는 전부 각 절에 사용자 인용이 붙어 있다 — 무단 변경 0. 라운드 3의 D28·D29는 이 대체로 닫혔다.
- **라운드 관리**: 사용자 후속 입력 8건이 전부 “라운드 3 유지”로 처리돼, 라운드 3의 root 5건 중 3건이 닫히지 않은 채 revision만 8개 쌓였다.
- **검증 환경 한계**: 라운드 3의 넷 중 셋이 해소됐다(ABI·`@opencode-ai/sdk`·`rg`). 남은 하나는 `environment: 'node'`라 effect 계기를 실제 브라우저로 재지 못한다 — 다만 이번 여섯 차단은 전부 **jsdom/renderToStaticMarkup으로 기계화 가능**하다.

## 12. 결론 (ΔV7~ΔV14, 라운드 4)

- 상태: **FAIL**
- pair 결과: REQUIRED **19 PASS · 8 PAIR_FAIL**(VP-72·79·88·97·99·100·102·103) · REGRESSION **PASS** · BLOCKED_BY **0** · NOT_REQUIRED 2(VP-76·77, 계약 대체)
- PLAN_GAP: **없음** — 여덟 차단이 전부 plan이 이미 번호로 적은 강제 지점이다. **다음 주체는 구현자다**
- 변이: **54건 · RED 41 · GREEN 13** · 등록 변이 1/1 재현 · **덮개 회귀 0**
- §10 강제 지점: **EP-46 1/4 · EP-53 3/4 · EP-61 1/2 · EP-71 2/4 · EP-73 1/4 · EP-74 0/3 · EP-76 2/3 · EP-77 2/3**. 이번 revision ΔV14 = **7/9**(자기보고 9/9와 불일치)
- AC 충족(ΔV14): **✅1 ⚠️2 ❌0 / 3** — 자기보고 `✅3`과 불일치
- 현재 변경 운영 gate: **8종 전건 PASS** — typecheck 3구성 오류 0 · eslint 0 error/1 warning · vitest **342파일 3324케이스** · scripts 67/67 · migrations 20 · doc-inventory 3종 · prettier · diff check. 검증 중 트리 변화 **0**(변이 54회 전건 복원 검증), 잔여물 0
- NON_BLOCKING: D41·D42·D43·D44 · NEXT_HANDOFF: D45·D32
- 남은 사람 확인: 두 테마 파란 accent 계산색(D41) + 라운드 3에서 이월된 시각 실기 3건
- 다음 단계: **구현자가 D25~D27·D35~D40 여섯 축의 오라클을 만든다.** 전부 렌더/reducer 단언으로 기계화 가능하며 사람 실기가 아니다. **라운드가 4이므로 재구현 전에 `handoff-review`를 수행한다**(AGENTS 트리거 — 라운드 초과 + 같은 형태 3연속, D44)

---

## Verify 라운드 5 (D25~D27 · D35~D40 오라클) — FAIL

> 라운드 4 가 남긴 차단 9행을 닫는 재구현 턴의 검증이다. 라운드 4 원문은 위에 그대로 둔다.
> 8행은 닫혔고 **D35 는 닫히지 않았다** — 인용 변이는 red 인데, 그 계약이 사는 형제 지점이 green 이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0211-worktree-session-ux` |
| 검증자 | Claude Code |
| 일자 | 2026-09-05 |
| 대상 커밋/range | `fc517d1` (`05c8da7..fc517d1`) |
| 구현 전 plan 기준 | ΔV14 `99ebb1c` — 그 뒤 규범 행 변경 0 (아래 §0) |
| V mode / 유효 V | Delta V — `V1 + ΔV1 … + ΔV14` |
| 검증 기준 plan revision | `99ebb1c:ΔV14` (r4 verify 커밋 `05c8da7` 의 파생 이슈 표가 이번 계약) |
| 라운드 | **5** |
| 상태 | **FAIL** |
| 자기 검증 여부 | **그렇다** — `fc517d1` 의 `Claude-Session` 이 이 검증 세션과 같다. §4 에 구현 보고가 이름을 대지 않은 적대 축 **10건**을 넣었고 그중 **5건이 green** 이다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: **그렇다. 규범 행은 0건이다** — hunk 3개가 전부 메타 `상태` 1줄 · `[구현자 기입] 라운드 5` 신설 · 파생 이슈 표의 `처리` 칸(D25~D27·D35~D40·D44)이다.
- **기준선이 diff 로 성립한다** — 계약을 정한 커밋은 r4 verify `05c8da7`(`Status: verified`)이고 구현은 `fc517d1`(`Status: partial`)로 갈려 있다.
- Decision Ledger·Product/UX Contract·AC·V node/pair·§10·oracle 변경: 구현 커밋 **0건**(`git show fc517d1 -- plan.md | grep '^@@'` = 3 hunk, 위 범위).
- 채점 기준: r4 파생 이슈 9행이 인용한 pair(VP-72·79·88·97·99·100·102·103)와 §10 지점(EP-46·53·61·71·73·74·76·77).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | ΔV14 까지 각 revision 이 기준 커밋을 적었다 — r4 §0 판정 유지 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | 이번 라운드는 새 node 를 만들지 않는다(계약 변경 0) |
| 영향 INHERITED ↔ REGRESSION pair | 유효 | VP-100 이 ΔV13 상속의 REGRESSION 으로 남아 있다 |
| pair별 path·§10 전수·직접 oracle | 유효 | 아래 세 차단은 전부 plan 이 **번호로 적은** 지점이다 — EP-74 ①③ · EP-71 ② · EP-61 ② |
| 필요한 pair의 선택적 적대 증거 | 유효 | r4 파생 이슈 9행이 각 인용 변이를 지정했다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 8종 전건 실행 가능했다(§9) |

- root PLAN_GAP: **없음.** 세 차단이 전부 기존 §10 번호이므로 구현자가 새 계약을 발명할 필요가 없다. **다음 주체는 구현자다.**

## 1. Product & UX / ACTIVE Decision — end-to-end

| Decision | 기대 결과 | production path | 판정 |
|---|---|---|---|
| D-115 (Stop hook 싱크) | 턴 종료가 git 목록 갱신의 유일한 계기 | `claude.ts:406` → `drainTurnEnded` → `ingestChatEvent` → reducer `turnEndTick` | **충족 — 4지점 전건 잠김**(M-A1·M-A2·M-A3·N3·M-A6) |
| D-149 (수동 새로 고침) | 케밥 마지막 항목이 즉시 조회 | `GitContextBar:143` → `:334` `refreshGitSnapshot` → `REFRESH_GIT_SNAPSHOT` → `gitRefreshTick` | **충족**(M42·M43·N2a·N2b red) |
| D-147 (코멘트 선택 연동) | composer ↔ diff 같은 항목이 **함께** 활성 | diff 쪽 `DiffTileContent:95` · composer 쪽 `Composer.tsx:367` | **절반만** — diff 쪽 잠김(M13·M13b), **composer 쪽 green**(N4a·N4b) → D47 |
| D-151·D-152 (Enterprise 원격·메뉴 캐시) | 사내 origin 이 **조회 결과로** 메뉴에 뜬다 | `GitRow:147` → `GitRowView` key → `GitIdentityMenus:36` → `useGitIdentityRemote` → `GitIdentityMenu` | **미충족 — 메뉴 컨테이너 구간이 무관측**(N1·N1b·N5 green) → D46 |
| D-153 (빈 diff) | 본문 중앙 안내 1개·트리 0개·토글 숨김 | `DiffReview:140` `data-diff-empty` / `GitContextBar:210` | **충족**(M5·M23·M7 red) |
| D-123 (밴드 치수) | 헤더 32px · 트리거 24px · 사이드바 240px · 파일 밴드 32px | `RightPanelTile:42` 등 5지점 | **충족 — EP-53 5/5 red** |
| D-136 (작성 입력 자동 높이) | 긴 입력이 한 줄에 갇히지 않는다 | `FileDiffSection:855` draft · `:913` 저장 카드 | draft 잠김(M50), **저장 카드 본문 green**(N7) → D48 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success 가능성 | **있다** | `GitIdentityMenus:36` 의 `menuEpoch` 를 `undefined` 로 굳혀도(N1b) **3,352/3,352 + typecheck 3구성 0 error**. 사용자에게는 메뉴가 영영 `확인 중` 인데 게이트가 조용하다 |
| 실환경 실패 방식 | 양호 | 훅 자신의 실패·재시도·경로 전환은 잠겨 있다(M41·M8·M8b·M8c red) |
| partial failure/rollback | 해당 없음 | 프로덕션 변경이 DOM 속성 1개다 — 외부 쓰기·마이그레이션 0 |
| A가 아닌 B를 구현했는가 | **부분적으로 그렇다** | D35 처방은 “`GitIdentityMenus` 를 렌더해 `gitApi.status` 호출 수를 단언” 이었고, 구현은 **훅을 단독 실행**했다. 컨테이너→훅 hop 이 분모 밖에 남았다 |
| 증상만 제거하고 상태가 남았는가 | 아니다 | 인용 변이 11건 중 10건이 red 다 |
| 최적화가 잃은 재검증 관측 | 해당 없음 | 이번 라운드에 캐시·축약 변경 0 |
| 출력/요청 worst-case 상한 | 유지 | 이번 diff 에 상한 변경 0 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 05c8da7..fc517d1   # 대상 1 파일
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | **0건** | 스크립트 §1a 공백 |
| 테스트 전용 참조 | **0건** | 스크립트 §2 공백 |
| 형제 정책 비대칭 | **0건** | 스크립트 §3 공백 |
| producer ↔ consumer 파생 불일치 | **3건** | `GitIdentityMenus`(D46) · `Composer` 선택(D47) · 저장 카드 본문(D48) — 셋 다 아래 §4 에서 변이로 확인 |
| 렌더되지 않는 컨테이너 | **1건** | `rg -l GitIdentityMenus src` = 3파일(정의·`GitRow`·`gitRowIdentityGeneration.test.ts`). 그 테스트는 요소를 **찾기만** 하고 렌더하지 않는다 → D46 |
| 동일 규칙 중복 구현 | SSOT 유지 | `gitQueryOwner.test.ts` 가 `gitApi.status` 소유자 2 + 예외 1 을 전수로 잠근다 |

## 4. 적대 증거 재측정 — 34변이 · RED 29 · GREEN 5

- **인용·등록 변이 23행 재현**: 구현 보고의 표를 그대로 다시 심어 **22 red · 1 green**. 자기보고와 일치한다.
- **덮개 회귀 0** — r4 가 red 로 본 M26·M28·M23 에 M7 을 더해 **4/4 재현**. r5 diff 는 테스트 8파일 전부 **추가**이고 삭제 hunk 1개는 import 한 줄이라(`-import { createElement } from 'react'`) 단언 제거가 없다.
- **자기검증 분모** — 구현자 = 검증자이므로 보고에 없는 축 **10건**을 만들었다: 같은 계약의 **다른 지점** 4(N1·N1b·N5·N3) · **형제 지점** 4(N2a·N2b·N4a·N4b) · §10 분모 **독립 재열거** 2(N6 = EP-53 ⑤, N7 = EP-61 ②). **5건이 green** 이다.
- 동작 보존 추출 라운드인가: **아니다** — 오라클 신설 라운드라 hunk 되돌림 논점이 없다.
- 소거 변이의 잔여물 수렴: 전 변이가 typecheck 를 깨지 않는 형태다. N1b 는 typecheck 3구성을 **실제로 돌려** 0 error 를 확인했다.
- 복원 검증: 변이 34회 전건 백업→복원 후 `git diff --quiet` 로 바이트 동일성을 확인했다.

### 4-1. 구현 보고가 등록·인용한 변이 (23행 · red 22 · green 1)

| 변이 | 스위트 / 분모 | 결과 | 귀속 |
|---|---|---|---|
| M-A1 `makeTurnEndHook(…)` 호출 제거 | turnEnd+turn-end-hook 8 | **red 4/8** — 팩토리 4/4 는 green | VP-72 · EP-46 ① |
| M-A2 스트림 중 `drainTurnEnded()` 제거 | claude.turnEnd 4 | **red 1/4** | VP-72 · EP-46 ② |
| M-A3 꼬리 `drainTurnEnded()` 제거 | claude.turnEnd 4 | **red 1/4** (다른 케이스) | VP-72 · EP-46 ② |
| **M-A4** `case 'turn.ended'` 제거 | 전체 3,352 | **green — 등가 확정** | 아래 4-2 |
| M-A5 스토어가 이벤트를 삼킨다 | gitTriggers 5 | **red 2/5** | VP-72 · EP-46 ④ |
| M-A6 리듀서가 tick 을 안 센다 | gitTriggers+turnEnd 10 | **red 5/10** | VP-72 · EP-46 ④ |
| M-A7 `turn.ended` ↔ `turn.aborted` 산출 맞바꿈 | 같은 10 | **red 2/10** | VP-72 형제 비대칭 |
| M41 훅의 `void cache.ensure()` 제거 | wiring+factory 11 | **red 5/11** — 팩토리 6/6 green | VP-102 · EP-76 ① |
| M8 `identityGeneration` 상수 | gitRowIdentity 3 | **red 2/3** | VP-102 · EP-76 ③ |
| M8b 세대를 메뉴 owner key 에서 제거 | 같은 3 | **red 1/3** | 새 oracle 민감도 |
| M8c 새로 고침 축만 제거 | 같은 3 | **red 2/3** | 새 oracle 민감도 |
| M13 `activeRequirementId` → `null` | diffTileWiring+selection 10 | **red 2/10** | VP-97 · EP-71 ③ |
| M13b 선택 액션 배선 제거 | 같은 10 | **red 1/10** | 새 oracle 민감도 |
| M43 `onRefresh` 배선 제거 | 같은 10 | **red 1/10** | VP-99 · EP-73 ① |
| M42 `REFRESH_GIT_SNAPSHOT` 무효화 | gitTriggers+turnEnd 10 | **red 2/10** | VP-99 · EP-73 ② |
| M5 빈 안내 중앙 3토큰 제거 | rightpanel 213 | **red 1/213** | VP-103 · EP-77 ① |
| M23 빈 안내 문구 제거 | rightpanel 213 | **red 4/213** | r4 red 재현 |
| M29 헤더 밴드 32 → 48px | rightpanel 213 | **red 1/213** | VP-79 · EP-53 ① |
| M29b 두 밴드 갈래를 한 모양으로 | rightpanel 213 | **red 1/213** | 형제 맞바꿈 |
| M50 `[field-sizing:content]` 제거 | rightpanel 213 | **red 1/213** | VP-88 · EP-61 ① |
| M-B1 컨텍스트 바 24 → 32px | rightpanel 213 | **red 1/213** | VP-79 · EP-53 ② |
| M26 사이드바 240 → 300px | rightpanel 213 | **red 1/213** | r4 red 재현 |
| M28 파일 밴드 32 → 48px | rightpanel 213 | **red 1/213** | r4 red 재현 |

### 4-2. M-A4 는 등가 변이다 — 구현자의 `부분 closed` 를 `closed` 로 올린다

- **판정: D27 은 닫혔다.** 인용 변이가 검출되지 않은 것이 오라클 결손이 아니라 **변이가 동작을 바꾸지 않기 때문**이다.
- 관측: `chatStore.ts:610-612` 는 `case 'turn.ended': dispatchTo(key, { type: 'RECV_EVENT', event: ev }); return`, `:644-645` 는 `default: dispatchTo(key, { type: 'RECV_EVENT', event: ev })` — 같은 인자로 같은 호출이고 그 사이 `case` 들은 전부 `return` 한다.
- 검출 가능한 오라클이 존재하지 않는 변이를 근거로 이슈를 열어 두면 그 행은 영구 차단이 된다. 계약(스토어→리듀서 도달·tick·형제 비대칭)은 M-A5·M-A6·M-A7 로 닫혔다.

### 4-3. 검증자 독립 축 (10건 중 5 green)

| # | 변이 | 분모 | 결과 | 귀속 |
|---|---|---|---|---|
| **N1** | `GitIdentityMenus` 가 `useGitIdentityRemote` 를 **아예 부르지 않는다** | 전체 3,352 | **GREEN** | VP-100·VP-102 · EP-74 ① → D46 |
| **N1b** | 메뉴가 `menuEpoch` 를 훅에 넘기지 않는다(한 토큰, typecheck 3구성 0 error) | 전체 3,352 | **GREEN** | 같은 축 → D46 |
| **N5** | 메뉴가 조회 결과 대신 옛 스냅샷 주소를 쓴다 | 전체 3,352 | **GREEN** | VP-100 · EP-74 ③ → D46 |
| **N4a** | `Composer.selectedId` 를 `null` 로 고정 | 전체 3,352 | **GREEN** | VP-97 · EP-71 ② → D47 |
| **N4b** | `Composer.onSelect` 를 no-op 으로 | 전체 3,352 | **GREEN** | VP-97 · EP-71 ② → D47 |
| **N7** | 저장 카드 본문 `whitespace-pre-wrap` → `truncate` | 전체 3,352 | **GREEN** | VP-88 · EP-61 ② → D48 |
| N2a | 케밥 `refresh` 항목이 `onRefresh` 를 안 부른다 | 전체 3,352 | red 1 | VP-99 · EP-73 ① |
| N2b | 바가 `refreshGitSnapshot` 를 안 부른다 | 전체 3,352 | red 1 | VP-99 · EP-73 ① |
| N3 | `turn.ended` 가 빈 `sessionId` 를 싣는다 | 전체 3,352 | red 1 | VP-72 · EP-46 ③ |
| N6 | `data-diff-scroll-owner` 마커 제거 | 전체 3,352 | red 4 | VP-79 · EP-53 ⑤ |

- 다섯 green 은 **한 형태**다 — 컨테이너가 자식/훅에 건네는 값이 아무 렌더 오라클을 지나지 않는다. `GitIdentityMenus`(N1·N1b·N5)와 `Composer`(N4a·N4b)는 **어느 테스트도 렌더하지 않는다**(`Composer.requirements.render.test.ts` 는 `ComposerPanelStackView` 와 손으로 만든 `RequirementTray` 를 그린다).

## 5. V-pair closeout — 재검증 범위

> 실행 범위: r4 의 root 8 pair + 이번 변경이 닿은 §10 지점 + 현재 변경의 운영 gate. 영향 없는 r4 PASS 는 그 좌표를 참조한다.

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP-72 | AR↔IT | REQUIRED | **PASS** | EP-46 4/4 red — M-A1 · M-A2·M-A3 · N3 · M-A6 |
| VP-79 | R↔AT | REQUIRED | **PASS** | EP-53 5/5 red — M29·M29b · M-B1 · M26 · M28 · N6 |
| VP-88 | R↔AT | REQUIRED | **PAIR_FAIL** | EP-61 ① red(M50) · **② green(N7)** |
| VP-97 | R↔AT, AR↔IT | REQUIRED | **PAIR_FAIL** | EP-71 ③ red(M13·M13b) · **② green(N4a·N4b)** |
| VP-99 | R↔AT, AR↔IT | REQUIRED | **PASS** | EP-73 ① red(M43·N2a·N2b) · ② red(M42) |
| VP-100 | R↔AT, AR↔IT | REGRESSION | **PAIR_FAIL** | **EP-74 ① green(N1·N1b) · ③ green(N5)** |
| VP-102 | R↔AT, AR↔IT, MD↔UT | REQUIRED | **PAIR_FAIL** | EP-76 ③ red(M8·M8b·M8c)이나 `메뉴 open → resource` 가 green(N1b) |
| VP-103 | R↔AT, MD↔UT | REQUIRED | **PASS** | EP-77 ① red(M5) · ③ red(M7) · ② 는 r4 M6 좌표(이번 diff 0) |
| 그 밖 REQUIRED·REGRESSION | — | — | **PASS** | 전체 스위트 347파일 3,352케이스 green |

- root `PAIR_FAIL` **4**: VP-88 · VP-97 · VP-100 · VP-102.
- 공유 root: **N1b 하나가 VP-100·VP-102 를 함께 연다** — 같은 컨테이너 seam 이라 두 행에 같은 증거를 적고 네 단계로 부풀리지 않았다.
- 종속 `BLOCKED_BY`: **0** — 네 실패 모두 상위 행동을 독립 관측했다.

### 라운드 5 대상 9행 채점

| 행 | 결과 | 이번 턴 증거 |
|---|---|---|
| D25 | ✅ | M-A1 red 4/8 — 같은 실행에서 팩토리 `turn-end-hook.test.ts` 4/4 green |
| D26 | ✅ | M-A2 red 1/4 · M-A3 red 1/4 |
| D27 | ✅ | M-A5·M-A6·M-A7 red. 인용 변이 M-A4 는 **등가 확정**(§4-2) |
| **D35** | ❌ | 인용 변이 M41·M8 은 red 이나 **처방이 지목한 `GitIdentityMenus` 렌더 오라클이 0** — N1·N1b·N5 green |
| D36 | ✅ | M42 red 2/10 · M43 red 1/10 · 형제 N2a·N2b red |
| D37 | ✅ | M13 red 2/10 · M13b red 1/10 (composer 쪽은 **새 행 D47**) |
| D38 | ✅ | M5 red 1/213 |
| D39 | ✅ | M29 red · M29b red |
| D40 | ✅ | M50 red 1/213 (저장 카드 축은 **새 행 D48**) |

- **합계 재측정**: `✅ 8 · ❌ 1 = 총 9`. 자기보고 `✅8 ⚠️1` 과 **개수는 같고 대상이 다르다** — 구현자는 D27 을 미완으로, 검증은 **D35** 를 미완으로 본다.
- **합계 사본 대조**: 본문 `8/9` ↔ trailer `Criteria-Met: 8/9` ↔ INDEX 비고 — 세 사본 일치. `Criteria-Pending` 의 대상만 정정이 필요하다.
- ΔV1~ΔV14 의 AC 분모는 이번 라운드가 바꾸지 않았다(AC 변경 0건).

### pair별 plan §10 강제 지점 분모 — 검증자 재계수

| EP | plan N | 검증자 확인 | 결과 |
|---|---|---|---|
| EP-46 | 4 | **4/4** — ① M-A1 ② M-A2·M-A3 ③ N3 ④ M-A6 | PASS |
| EP-53 | 5 | **5/5** — ① M29 ② M-B1 ③ M26 ④ M28 ⑤ N6 | PASS |
| EP-61 | 2 | **1/2 — ② green(N7)** | PAIR_FAIL |
| EP-71 | 4 | **2/4 측정 — ② green(N4a·N4b)** · ③ red · ①④ 미측정 | PAIR_FAIL |
| EP-73 | 4 | 2/4 측정 — ① red(M43·N2a·N2b) ② red(M42) · ③④ 미측정 | PASS |
| EP-74 | 3 | **0/3 — ① green(N1·N1b) ③ green(N5)** · ② 미측정 | PAIR_FAIL |
| EP-76 | 3 | 3/3 — ①② M41·팩토리 5케이스 ③ M8·M8b·M8c | PASS (효과는 EP-74 ① 에 막힌다) |
| EP-77 | 3 | 2/3 측정 — ① M5 ③ M7 · ② 는 r4 M6 좌표 | PASS |

- 이번 라운드 합계: **EP-46 4/4 · EP-53 5/5 · EP-61 1/2 · EP-71 2/4 · EP-73 2/4 · EP-74 0/3 · EP-76 3/3 · EP-77 2/3**. 자기보고(EP-46 4/4 · EP-53 5/5 · EP-61 1/2 · EP-71 2/4 · EP-73 2/4 · EP-74 2/3 · EP-76 3/3 · EP-77 1/3)와 **EP-74 에서 갈린다** — 자기보고는 M41 을 ① 로 셌으나 그 변이는 훅 내부이고, ① 이 요구하는 것은 `cwd prop 전달` 즉 컨테이너 hop 이다.
- 못 본 것: EP-71 ①④ · EP-73 ③④ · EP-74 ② · EP-77 ② 는 **측정하지 않았다**. 미측정을 PASS 근거로 쓰지 않았다.
- 표 밖인데 같은 불변식이 필요한 지점: **없음** — 세 차단이 전부 표 안의 번호다(PLAN_GAP 아님).

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 산출 |
|---|---|---|
| `tsc --noEmit` node/web/test | **PASS** | 3구성 오류 **0** |
| `eslint ./src ./scripts` (`--fix` 없이) | **PASS** | **0 error · 1 warning**(기존 `useTranscriptVirtualizer`) |
| `vitest run` (전체) | **PASS** | **347파일 / 3,352케이스 / 실패 0 / skip 0** |
| `node --test scripts/*.test.mjs` | **PASS** | **67/67** (suites 8) |
| `check-migrations-appendonly` | PASS | 마이그레이션 **20** · 소스 **936파일** 스캔 |
| `check-doc-inventory --check` | PASS | generated(9 items · **82 channels**) · prose · links |
| `prettier --check` 변경 8파일 | PASS | 전건 통과 |
| `git diff --check` | PASS | 0건 |

## 6. 숫자 / 상한 재측정

- 전체 스위트 **347파일 3,352케이스** — 자기보고와 일치. r4 기준선 342/3,324 대비 파일 +5 · 케이스 +28.
- 케이스 증분 검산: 신규 5파일 = claude.turnEnd 4 + chatStore.gitTriggers 5 + gitIdentityRemoteWiring 6 + gitRowIdentityGeneration 3 + diffTileWiring 5 = **23**, 기존 파일 추가 5 → **28**. 실측과 일치.
- `rightpanel` 스위트: **22파일 / 213케이스**(r4 21/203 → 신규 `diffTileWiring` 1파일 + 10케이스).
- IPC 채널 **82** · 마이그레이션 **20** — 이번 변경으로 불변.
- **D45 재측정**: 전체 스위트 **13회 실행 중 `mutation-queue` 간헐 실패 0회**. r4 의 54회 중 2회와 다른 관측이다.

## 7. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 메뉴 원격 조회 | 훅 단독 6케이스 · GitRow 세대 3케이스 | **없음 — 결손이다.** `GitIdentityMenus` 를 `renderToStaticMarkup` 으로 그리고 `gitApi.status` 호출 수·`data-git-identity-menu` 안의 주소를 단언하면 N1b·N5 가 red 가 된다 |
| composer 선택 연동 | diff 쪽 4케이스 | **없음 — 결손.** `Composer` 를 store 와 함께 그려 `selectedId`/`onSelect` 를 단언하면 N4a·N4b 가 red 가 된다 |
| 저장 카드 본문 줄바꿈 | draft 자동 높이 1행 | **없음 — 결손.** 같은 render 테스트에 `data-diff-requirement-body` className 단언 1줄이면 N7 이 red 가 된다 |
| 두 테마 파란 accent 계산색 | — | **남는다**(D41) — `src/renderer/AGENTS.md` 가 시각은 육안 검증으로 갈음한다 |

## 8. 게이트 재실행 — 산출 관측

- 실행 명령: `cd app && npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(**`--fix` 없이**) · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-migrations-appendonly.mjs` · `prettier --check` · `git diff --check`.
- `npm test` 는 쓰지 않았다 — DB 동작 검증이 필요 없고 `pretest` 가 ABI 를 뒤집기 때문이다(`app/AGENTS.md`).
- **게이트가 작업 트리를 바꿨는가: 없음** — `lint` 를 `--fix` 없이 돌렸고 실행 후 `git status --porcelain` 이 비었다.
- **검증 중 잔여물: 없음** — 변이 34회를 전건 백업→복원하고 `git diff --quiet` 로 확인했다. 스크래치는 저장소 밖이다.
- 환경 기인 실패: **0** — r4 가 적은 ABI·electron 한계가 이 환경에서 재현되지 않았다.

## 9. Repository operation checks

- **AGENTS.md 변경**: 이번 범위에 없다 — 위생 스캔 대상 0.
- **INDEX 보드**: `impl/IMPL_DONE (r5)` → 이번 검증으로 `verify/FAIL`·다음 주체 Claude(구현)·라운드 5 로 갱신한다. 비고 5줄 이내로 다시 쓴다(기존 r5 비고는 약 700자였다).
- **대상 커밋 좌표**: 자리표시자 `(r5 구현 — 검증자 기입)` 를 `fc517d1` 로 기입했다. `git cat-file -t fc517d1` = `commit`.
- **인용 해시 실재**: plan·verify 가 인용한 25개 해시를 `git cat-file -t` 로 전건 확인했다 — 죽은 좌표 0.
- **trailer 파싱**: `git log -1 --format='%(trailers:only=true)' fc517d1` 이 7키를 그대로 돌려준다. 값도 전부 허용값이다.
- **`[구현자 기입]` 7필드**: 설계 리뷰 · 강제 지점 전수/V-pair 자기확인 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 + 대응 · 구현 보고 · Review Signals = **7/7 존재**. 산문으로 접힌 필드 0.
- **reference/script**: 이동·삭제 0.

## 10. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| “D27 인용 변이가 등가라 부분 closed” | **타당하나 과보수.** 등가를 소스로 확정했으므로 `closed` 로 올린다 | §4-2 |
| “EP-74 2/3 측정” | **재계수 0/3** — M41 은 훅 내부이고 ① 은 컨테이너 hop 이다 | §5 §10 표 |
| “EP-77 1/3 측정” | **2/3** — ③ 도 이번에 red 를 확인했다(M7) | §5 §10 표 |
| 선조치 `data-diff-empty` 마커 | **타당** — 형제 넷이 이미 같은 체계를 갖고 화면 변화 0 | 유지 |
| “덮개 회귀 0 — 전부 추가” | **재현** — 삭제 hunk 1개가 import 한 줄이다 | §4 |
| “②④ 기존 단언(미측정)” (EP-71·EP-61) | **부당** — 측정하니 EP-71 ②·EP-61 ② 에 단언이 없다 | D47·D48 |

## 11. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| **D35(계속)** | 메뉴 원격 조회의 **컨테이너 hop** 이 여전히 무관측 — `GitIdentityMenus:36` 의 `menuEpoch` 를 `undefined` 로 굳혀도 3,352 green + typecheck 0 error(N1b) | VP-100·VP-102 · EP-74 ① | **BLOCKING** | 아래 D46 으로 좁혀 잇는다 |
| **D46** | `GitIdentityMenus` 를 렌더하는 테스트가 **0개**다. 훅 미호출(N1)·open 미전달(N1b)·옛 주소 표시(N5) 셋 다 green | VP-100·VP-102 · EP-74 ①③ · D-151·D-152 | **BLOCKING** | `GitIdentityMenus` 를 `renderToStaticMarkup` 으로 그려 `gitApi.status` 호출 수와 메뉴에 실린 주소를 단언한다 |
| **D47** | composer 쪽 선택 배선이 무관측 — `Composer.tsx:367` `selectedId` 를 `null` 로 굳혀도(N4a), `:368` `onSelect` 를 no-op 으로 해도(N4b) green. D-147 의 “양방향” 중 절반만 잠겼다 | VP-97 · EP-71 ② · D-147 | **BLOCKING** | `Composer` 를 store 와 함께 렌더해 인용 타일의 활성과 클릭 액션을 단언한다 |
| **D48** | 저장 카드 본문의 줄바꿈이 무관측 — `whitespace-pre-wrap` 을 `truncate` 로 바꿔도 green(N7). draft 자동 높이만 잠겨 있다 | VP-88 · EP-61 ② · D-136 | **BLOCKING** | `data-diff-requirement-body` className 단언을 기존 render 테스트에 더한다 |
| D27 | 인용 변이 M-A4 는 **등가**다 — `chatStore.ts:644` `default:` 가 같은 dispatch 를 한다 | VP-72 · EP-46 ④ | 해소 | **closed** — 계약은 M-A5·M-A6·M-A7 red |
| D41 | `accent-selected` 파란 체크 토큰이 무관측 | EP-68 시각 | NON_BLOCKING | 사람 확인(변화 없음) |
| D42 | 초과 단일 패치 guard 제거가 green(부분 등가) | 비귀속 — D-146 미명시 | NON_BLOCKING | 설계 판단 대기 |
| D43 | 설계 커밋 12건이 `Agent: codex` + `Status: designed` | 비귀속 — 협업 프로토콜 | NON_BLOCKING | 주체 배분 재확인 |
| D44 | 라운드 3 이 지시한 `handoff-review` 미수행 | 비귀속 — 프로세스 | 해소 | **closed** — r5 가 round 26 을 `DIAGNOSE_ONLY` 로 수행(지침 변경 0). A 후보 2건은 사용자 판단 대기 |
| D45 | `mutation-queue.test.ts:35` 간헐 실패 | 비귀속 | NEXT_HANDOFF | **이번 13회 실행에서 0회 재현** — 유지하되 빈도 관측을 갱신한다 |
| D32(계속) | inventory 워크트리 스캔 | 비귀속 | NEXT_HANDOFF | 이 환경에서도 재현 0(`.claude/worktrees/` 없음) |

## 12. Review Signals — 사실만

- **이전 라운드와 동일 증상: 그렇다.** “컨테이너가 건네는 값을 아무도 렌더하지 않는다” 가 ΔV4 r3 D1 → ΔV6 D25~D27 → ΔV14 D35~D40 → 이번 D46·D47·D48 로 **다섯 라운드 연속**이다.
- **관련 plan 지침·§10 은 셋 다 있었다** — EP-74 ① `cwd prop 전달`, EP-71 ② `Composer.selectedId/onSelect`, EP-61 ② `저장 카드 … whitespace-pre-wrap 본문`. 셋 다 번호와 실패 의미까지 적혀 있다.
- **r5 는 재구현 전에 `handoff-review` round 26 을 수행했고 세 축을 `B(실행 누락)` 로 분류해 지침을 바꾸지 않았다.** 같은 라운드에서 인접 seam 에 **같은 형태 5건**이 새로 관측됐다.
- **처방과 구현이 갈린 지점이 명시적으로 있다** — D35 처방은 “`GitIdentityMenus` 를 렌더해” 였고 구현은 훅 단독 실행이었다. 처방이 지목한 컨테이너가 분모에 오르지 않았다.
- **사용자 결정 변경 근거**: 이번 라운드 Decision 변경 0건.
- **검증 환경 한계**: 없다 — ABI·electron·`rg` 전부 정상이고 effect 축은 r5 의 react 대역 하네스로 돌았다.

## 13. 결론 (라운드 5)

- 상태: **FAIL**
- pair 결과: **PASS 4**(VP-72·79·99·103) · **root PAIR_FAIL 4**(VP-88·97·100·102) · BLOCKED_BY 0 · 그 밖 REQUIRED/REGRESSION PASS
- PLAN_GAP: **없음** — 세 차단이 전부 plan 이 번호로 적은 §10 지점이다. **다음 주체는 구현자다**
- 라운드 5 대상 9행: **✅8 ❌1** — 닫히지 않은 것은 **D35** 다(구현자는 D27 로 보고했다)
- 변이: **34건 · RED 29 · GREEN 5** · 인용 변이 23행 중 22 red · **덮개 회귀 0**(r4 red 4/4 재현)
- 자기검증 분모: 구현자 = 검증자이므로 보고에 없던 축 **10건**을 넣었고 **5건이 green** 이다(D46·D47·D48)
- §10 강제 지점: **EP-46 4/4 · EP-53 5/5 · EP-61 1/2 · EP-71 2/4 · EP-73 2/4 · EP-74 0/3 · EP-76 3/3 · EP-77 2/3**
- 현재 변경 운영 gate: **8종 전건 PASS** — typecheck 3구성 0 · eslint 0 error/1 warning · vitest **347파일 3,352케이스** · scripts 67/67 · migrations 20 · doc-inventory 3종 · prettier · diff check. 검증 중 트리 변화 **0**, 잔여물 0
- NON_BLOCKING: D41·D42·D43 · NEXT_HANDOFF: D45·D32 · 해소: D27·D44
- 남은 사람 확인: 두 테마 파란 accent 계산색(D41) + 라운드 3 이월 시각 실기 3건
- 다음 단계: **구현자가 D46·D47·D48 세 오라클을 만든다.** 셋 다 `renderToStaticMarkup` + className/호출수 단언으로 기계화되며 사람 실기가 아니다. 라운드 6 은 `handoff-review` round 26 직후이므로 별도 review 를 다시 요구하지 않는다

## Verify 라운드 6 (컨테이너 hop 오라클 D46·D47·D48) — FAIL

> 라운드 5 가 남긴 차단 3행을 닫는 재구현 턴의 검증이다. 라운드 5 원문은 위에 그대로 둔다.
> **차단 3행은 전부 닫혔다.** 그런데 같은 pair(VP-97)의 §10 지점 두 개가 여전히 열려 있다 —
> 처방 밖의 형제 자리라 이번 라운드 분모에 오르지 않았다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0211-worktree-session-ux` |
| 검증자 | Claude Code |
| 일자 | 2026-09-05 |
| 대상 커밋/range | `788aff3` (`844b0ff..788aff3`) |
| 구현 전 plan 기준 | ΔV14 `99ebb1c` — 그 뒤 규범 행 변경 0 (아래 §0) |
| V mode / 유효 V | Delta V — `V1 + ΔV1 … + ΔV14` |
| 검증 기준 plan revision | `91f0a16:ΔV14` (r5 verify 커밋의 파생 이슈 표가 이번 계약) |
| 라운드 | **6** |
| 상태 | **FAIL** |
| 자기 검증 여부 | **그렇다** — `788aff3` 의 `Claude-Session` 이 이 검증 세션과 같다. §4 에 구현 보고가 이름을 대지 않은 적대 축 **9건**을 넣었고 그중 **4건이 green** 이다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: **그렇다. 규범 행은 0건이다** — `git show 788aff3 --unified=0 -- plan.md | grep '^@@'` = hunk **3개**(`@@ -11 +11 @@` 메타 `상태` 1줄 · `@@ -16,0 +17,152 @@` `[구현자 기입] 라운드 6` 신설 · `@@ -5376,3 +5528,3 @@` 파생 이슈 D46~D48 의 `처리` 칸).
- **기준선이 diff 로 성립한다** — 계약을 정한 커밋은 r5 verify `91f0a16`(`Status: verified`)이고 구현은 `788aff3`(`Status: implemented`)로 갈려 있다.
- Decision Ledger·Product/UX Contract·AC·V node/pair·§10·oracle 변경: 구현 커밋 **0건**.
- 채점 기준: r5 파생 이슈 D46·D47·D48 이 인용한 pair(VP-88·97·100·102)와 §10 지점(EP-61 ② · EP-71 ② · EP-74 ①③), 그리고 구현자가 스스로 범위에 넣은 EP-71 ④ · EP-73 ④.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | ΔV14 까지 각 revision 이 기준 커밋을 적었다 — r5 §0 판정 유지 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | 이번 라운드는 새 node 를 만들지 않는다(계약 변경 0) |
| 영향 INHERITED ↔ REGRESSION pair | 유효 | VP-100 이 ΔV13 상속의 REGRESSION 으로 남아 있다 |
| pair별 path·§10 전수·직접 oracle | 유효 | 이번 차단 3행이 전부 plan 이 **번호로 적은** 지점이다 |
| 필요한 pair의 선택적 적대 증거 | 유효 | r5 파생 이슈 3행이 각 인용 변이를 지정했다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 8종 전건 실행 가능했다(§8) |

- root PLAN_GAP: **없음.** 아래 두 실패도 plan 이 번호로 적은 §10 지점(EP-71 ①④)이라 구현자가 새 계약을 발명할 필요가 없다. **다음 주체는 구현자다.**
- **상속 좌표 3건이 죽었다**(§9) — plan validity 를 깨지는 않는다. 상속 기준이 handoff + revision 이름으로도 지시되기 때문이다.

## 1. Product & UX / ACTIVE Decision — end-to-end

| Decision | 기대 결과 | production path | 판정 |
|---|---|---|---|
| D-151·D-152 (Enterprise 원격·메뉴 캐시) | 사내 origin 이 **조회 결과로** 메뉴에 뜬다 | `GitRow:147` → `GitRowView:57` cwd → `GitIdentityMenus:36` → `useGitIdentityRemote` → `GitIdentityMenu:74` `window.open` | **충족 — 3지점 전건 잠김**(N1·N1b·V1 · S5 · N5·V4) |
| D-147 (코멘트 선택 연동) | composer ↔ diff 같은 항목이 **함께** 활성이고 그 코멘트가 **보인다** | composer `Composer.tsx:367` · diff `DiffTileContent:95` · reveal `FileDiffSection:292` | **부분 충족** — 두 표면 활성은 잠겼고(N4a·N4b·N4c·M13), **reveal 대상 컨테이너와 선택 정리 3자리가 green**(V2·V3·V6·V8) → D49·D50 |
| D-136 (작성 입력 자동 높이) | 긴 입력이 한 줄에 갇히지 않는다 | `FileDiffSection:855` draft · `:913` 저장 카드 본문 | **충족**(M50 red · N7 red · N7b red). 잔여는 §4 W1 |
| D-149 (수동 새로 고침) | 케밥 마지막 항목이 즉시 조회하고 옛 실패가 새 조회를 덮지 않는다 | `GitContextBar:143` → `refreshGitSnapshot` → `REFRESH_GIT_SNAPSHOT` → `FAIL_GIT_SNAPSHOT_QUERY` 가드 | **충족 — EP-73 4/4**(M43·M42·S3·S4) |
| D-153 (빈 diff) | 본문 중앙 안내 1개·트리 0개·토글 숨김 | `DiffReview:141` `data-diff-empty` / `GitContextBar:210` | **충족**(M5·M23·M7 red). ② 파일트리는 이번 라운드 미측정 |
| D-115 · D-123 | r5 판정 유지 | — | **PASS 좌표 참조** — 이번 diff 가 그 경로를 건드리지 않는다 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success 가능성 | **있다** | `FileDiffSection:292` 의 `scrollOwnerRef.current` 를 `null` 리터럴로 굳혀도(V2) **3,369/3,369 green**. `revealDiffRequirement` 는 owner 가 null 이면 `false` 를 돌려주고 아무것도 하지 않는다 |
| 실환경 실패 방식 | 양호 | 늦은 응답·닫힌 메뉴·다른 세션 응답은 잠겨 있다(S5·S4 red) |
| partial failure/rollback | 해당 없음 | **프로덕션 변경 0** — 외부 쓰기·마이그레이션 0 |
| A가 아닌 B를 구현했는가 | 아니다 | 세 처방이 지목한 컨테이너를 실제로 렌더한다. `GitIdentityMenus`·`Composer`·`FileDiffSection` 모두 **프로덕션 심볼 자신**을 돌리고 동명 재구현이 없다 |
| 증상만 제거하고 상태가 남았는가 | 아니다 | 인용 변이 11건이 전건 red 다 |
| 최적화가 잃은 재검증 관측 | 해당 없음 | 이번 라운드에 캐시·축약 변경 0 |
| 출력/요청 worst-case 상한 | 유지 | 이번 diff 에 상한 변경 0 |

- **오라클의 fixture 가 계약을 지운 자리가 있다.** `fileDiffRequirementReveal.test.ts:88` 이 `scrollOwnerRef: { current: null }` 을 넣어 첫 인자가 **항상 null** 이다. 그래서 `toHaveBeenCalledExactlyOnceWith(null, 'one')` 은 id 만 잠그고 대상 컨테이너는 잠그지 않는다.

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 844b0ff..788aff3   # 대상 0 파일
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 스크립트 대상 | **0 파일** | 프로덕션 소스 변경이 없다(`app/src` 비-테스트 diff 0) |
| 테스트 전용 참조 | 0건 | 신규 4파일이 전부 프로덕션 심볼을 import 해 실행한다 |
| 동명 로컬 재구현 | **0건** | react 대역은 훅 디스패처만 갈아끼우고 컴포넌트 함수는 프로덕션 것이다 |
| 형제 정책 비대칭 | **1건** | `fileDiffRequirementReveal` 은 fixture 로 인자를 지웠고 `gitIdentityMenusWiring` 은 `window.open` 인자를 실제로 단언한다 → D49 |
| producer ↔ consumer 파생 불일치 | **3건** | EP-71 ① 의 reducer cleanup 4자리 중 3자리가 소비처 없이 남는다 → D50 |
| 게이트가 바꾼 트리 | **0건** | eslint 를 `--fix` 없이 돌렸고 실행 후 `git status --porcelain` 이 비었다 |

## 4. 적대 증거 재측정 — 31변이 · RED 27 · GREEN 4

- **분모**: 인용·등록 11 + 이전 라운드 red 재현 11 + 검증자 독립 축 9 = **31**.
- **덮개 회귀 0** — 이전 라운드가 red 로 본 11 변이가 전건 red 다. 그중 **M41 은 red 5(r5) → red 10** 으로 늘었다(새 컨테이너 오라클이 같은 변이를 함께 잡는다).
- 동작 보존 추출 라운드인가: **아니다** — 프로덕션 변경 0 이라 hunk 되돌림 논점이 없다.
- 복원 검증: 31회 전건 적용 전 `git diff --quiet` 확인 → 복원 후 재확인. 모든 행이 `restore:ok`.
- 실행 분모는 `--exclude '**/loopback-callback.test.ts'` 기준 **350파일 3,369케이스**다(제외 사유는 §8).

### 4-1. 구현 보고가 등록·인용한 변이 (11행 · red 11 · green 0)

| 변이 | 자기보고 | 재측정 | 귀속 |
|---|---|---|---|
| N1 컨테이너가 `useGitIdentityRemote` 를 안 부른다 | red 6 | **red 6** | VP-100·102 · EP-74 ① |
| N1b `menuEpoch` 를 `undefined` 로 굳힌다 | red 5 | **red 5** | 같은 축 |
| N5 조회 결과 대신 옛 스냅샷 주소를 싣는다 | red 3 | **red 3** | VP-100 · EP-74 ③ |
| N4a `selectedId` 를 `null` 로 굳힌다 | red 2 | **red 2** | VP-97 · EP-71 ② |
| N4b `onSelect` 를 no-op 으로 | red 1 | **red 1** | VP-97 · EP-71 ② |
| N4c `onSelect`↔`onRemove` 맞바꿈 | red 2 | **red 2** | 형제 슬롯 |
| N7 본문 `whitespace-pre-wrap` → `truncate` | red 1 | **red 1** | VP-88 · EP-61 ② |
| N7b 본문 줄바꿈 클래스 소거 | red 1 | **red 1** | 소거 변이 |
| S5 늦은 복사 결과의 세대 가드 제거 | red 2 | **red 2** | VP-100 · EP-74 ② |
| S1 reveal 인자를 상수 id 로 | red 2 | **red 2** | VP-97 · EP-71 ④ |
| S4 `FAIL_GIT_SNAPSHOT_QUERY` 가드 전체 제거 | red 3 | **red 3** | VP-99 · EP-73 ④ |

### 4-2. 이전 라운드 red 좌표 재현 (11행 · 덮개 회귀 0)

| 변이 | r5 / 자기보고 | 재측정 | 비고 |
|---|---|---|---|
| M41 훅의 `void cache.ensure()` 제거 | 5 / 10 | **red 10** | 새 오라클이 함께 잡는다 |
| M13 `activeRequirementId` → `null` | 2 / 2 | **red 2** | — |
| M42 `REFRESH_GIT_SNAPSHOT` 무효화 | 2 / 2 | **red 2** | — |
| M43 `onRefresh` 배선 제거 | 1 / 1 | **red 1** | — |
| M5 빈 안내 중앙 3토큰 제거 | 1 / 1 | **red 1** | — |
| M7 토글 조건 무력화 | — / 1 | **red 1** | — |
| M50 `[field-sizing:content]` 제거 | 1 / 1 | **red 1** | — |
| M23 빈 안내 문구 제거 | 4 / — | **red 4** | EP-77 ① 형제 축 |
| S6 선택 액션 무력화 | — / 1 | **red 1** | EP-71 ① 액션 축 |
| **M8** `identityGeneration` 상수 | 2 / **3** | **red 2** | 자기보고 **1 과다**. `''`·`'fixed'` 두 상수 모두 red 2 |
| **S3** `patchCache: []` 제거 | — / **2** | **red 1** | 자기보고 **1 과다** |

- 두 과다는 **행 관측이 아니라 개수**만 틀렸다. EP-76 ③ · EP-73 ③ 은 각각 red ≥ 1 로 여전히 잠긴다.

### 4-3. 검증자 독립 축 (9건 중 4 green)

| # | 변이 | 결과 | 귀속 |
|---|---|---|---|
| V1 | `GitRowView` 가 `cwd={null}` 을 건넨다 | red 1 | VP-100 · EP-74 ① — GitRow hop 은 잠겨 있다 |
| V4 | `remotePhase={'ready'}` 로 굳힌다(형제 슬롯) | red 3 | VP-100 · EP-74 ③ |
| V7 | 성공 clear(`CLEAR_DIFF_REQUIREMENTS_IF_UNCHANGED`)가 활성 id 를 안 지운다 | red 1 | VP-97 · EP-71 ① |
| **V2** | `revealDiffRequirement(null, id)` — 대상 컨테이너를 지운다 | **GREEN** | VP-97 · EP-71 ④ → **D49** |
| **V3** | 삭제(`REMOVE_DIFF_REQUIREMENT`)가 활성 id 를 안 지운다 | **GREEN** | VP-97 · EP-71 ① → **D50** |
| **V6** | 수동 범위 전환(`SET_DIFF_COMPARISON`)이 활성 id 를 안 지운다 | **GREEN** | 같은 축 → D50 |
| **V8** | cwd 초기화(`resetGitReview`)가 활성 id 를 안 지운다 | **GREEN** | 같은 축 → D50 |
| V5 | draft 열기가 활성 id 를 안 지운다 | GREEN | §10 표 밖 — NON_BLOCKING(D51) |
| W1 | 본문에 `line-clamp-1` 을 **더한다**(§8 엄격화) | GREEN | EP-61 ② 잔여 — NON_BLOCKING(D52) |

- 네 green 은 **한 형태**다 — 이번 라운드가 만든 오라클이 배선의 **한 인자·한 사건**만 잠그고, 같은 §10 지점의 형제 인자·형제 사건은 그대로 열려 있다.
- **V2 는 S1 과 같은 사용자 결과를 만든다** — 코멘트를 눌러도 화면이 그 자리로 가지 않는다. S1(잘못된 id)은 red 이고 V2(대상 컨테이너 없음)는 green 이다.
- V3·V6·V8 은 EP-71 ① 이 적은 `cleanup` 의 네 자리 중 셋이다. 넷째(성공 clear, V7)만 잠겨 있다.

### 4-4. §8 엄격화 — 이번 라운드가 만든 전수/0건 판정

| 장치 | 엄격화 | 차집합 |
|---|---|---|
| `body.attr('class')?.split(' ')` 토큰 대조 | 이미 부분 문자열이 아니라 **토큰 일치**다. 한 단계 더: 금지 토큰을 `truncate` 외로 넓힌다 | **비지 않는다** — W1(`line-clamp-1` 추가)이 green |
| `openItem(items, expected)` 정확 개수 | 소스 대조 — `GitIdentityMenu` 는 repo 1개·branch 2개(복사+열기)를 그린다 | 비어 있다 — 항목 가감이 red 로 온다 |
| `expect(h.status).not.toHaveBeenCalled()` 0건 | 양성 짝(`toHaveBeenCalledExactlyOnceWith('/repo')`)이 같은 파일에 있다 | 비어 있다 |
| `aria-pressed="true"` 0개 / `"false"` 2개 | 0건과 전수가 같은 단언에 쌍으로 있다 | 비어 있다 |

## 5. V-pair closeout — 재검증 범위

> 실행 범위: r5 의 root 4 pair + 이번 diff 가 닿은 §10 지점 + 현재 변경의 운영 gate. 영향 없는 r5 PASS 는 그 좌표를 참조한다.

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP-88 | R↔AT | REQUIRED | **PASS** | EP-61 ① red(M50) · ② red(N7·N7b) |
| VP-97 | R↔AT, AR↔IT | REQUIRED | **PAIR_FAIL** | ② red(N4a·N4b·N4c) · ③ red(M13) · **① cleanup 3/4 green**(V3·V6·V8) · **④ 컨테이너 인자 green**(V2) |
| VP-99 | R↔AT, AR↔IT | REQUIRED | **PASS** | EP-73 ① red(M43) · ② red(M42) · ③ red(S3) · ④ red(S4) |
| VP-100 | R↔AT, AR↔IT | REGRESSION | **PASS** | EP-74 ① red(N1·N1b·V1) · ② red(S5) · ③ red(N5·V4) |
| VP-102 | R↔AT, AR↔IT, MD↔UT | REQUIRED | **PASS** | EP-76 ①② red(M41 10) · ③ red(M8 2) |
| VP-103 | R↔AT, MD↔UT | REQUIRED | **PASS** | EP-77 ① red(M5·M23) · ③ red(M7) · ② 는 r5·r6 좌표 참조(미측정) |
| VP-72 · VP-79 | — | — | **PASS 좌표 참조** | r5 §5 — 이번 diff 가 EP-46·EP-53 경로를 건드리지 않는다 |
| 그 밖 REQUIRED·REGRESSION | — | — | **PASS** | 전체 스위트 350파일 3,369케이스 green |

- root `PAIR_FAIL` **1**: VP-97.
- 종속 `BLOCKED_BY`: **0** — 다른 pair 의 상위 행동을 전부 독립 관측했다.

### 라운드 6 대상 5행 채점

| 행 | 결과 | 이번 턴 증거 |
|---|---|---|
| D46 | ✅ | N1 red 6 · N1b red 5 · N5 red 3 · S5 red 2 · 검증자 축 V1 red 1 · V4 red 3 |
| D47 | ✅ | N4a red 2 · N4b red 1 · N4c red 2 |
| D48 | ✅ | N7 red 1 · N7b red 1 |
| EP-71 ④ | ❌ | S1 red 2 이나 **대상 컨테이너 인자가 green**(V2) — 반만 잠겼다 |
| EP-73 ④ | ✅ | S4 red 3 — 세 축(요청 key·세대·비교 범위) 음성 대조 |

- **합계 재측정**: `✅ 4 · ❌ 1 = 총 5`. 자기보고 `✅5 ❌0` 과 **개수가 다르다** — EP-71 ④ 를 닫힌 것으로 셌다.
- **합계 사본 대조**: 본문 `5/5` ↔ trailer `Criteria-Met: 5/5` ↔ INDEX 비고 — 세 사본은 서로 일치한다. 틀린 것은 사본이 아니라 값이다.
- ΔV1~ΔV14 의 AC 분모는 이번 라운드가 바꾸지 않았다(AC 변경 0건).

### pair별 plan §10 강제 지점 분모 — 검증자 재계수

| EP | plan N | 검증자 확인 | 결과 |
|---|---|---|---|
| EP-61 | 2 | **2/2** — ① M50 ② N7·N7b | PASS |
| EP-71 | 4 | **2/4** — ② N4a·N4b·N4c ③ M13. **① cleanup 4자리 중 V7 만 red** · **④ 인자 절반 green** | PAIR_FAIL |
| EP-73 | 4 | **4/4** — ① M43 ② M42 ③ S3 ④ S4 | PASS |
| EP-74 | 3 | **3/3** — ① N1·N1b·V1 ② S5 ③ N5·V4 | PASS |
| EP-76 | 3 | **3/3** — ①② M41 ③ M8 | PASS |
| EP-77 | 3 | **2/3 측정** — ① M5·M23 ③ M7 · ② 미측정 | PASS |

- 이번 라운드 합계: **16/19 확인 · 1 미측정(EP-77 ②) · 2 실패(EP-71 ①④)**. 자기보고 **19/19** 와 **EP-71 에서 갈린다**.
- **분모를 라벨이 아니라 코드에서 다시 셌다.** EP-71 ① 의 `cleanup` 이 걸리는 reducer 자리를 전수로 찾으면 넷이다 — `SET_DIFF_COMPARISON`(V6) · `REMOVE_DIFF_REQUIREMENT`(V3) · `CLEAR_DIFF_REQUIREMENTS_IF_UNCHANGED`(V7) · `resetGitReview`(V8). 구현 보고는 이 지점을 `선택 액션 — S6 red 1` 한 줄로 접었다.
- 못 본 것: **EP-77 ② 는 측정하지 않았다**(구현 보고는 S7 red 7 로 적었다). 미측정을 PASS 근거로 쓰지 않았다 — VP-103 은 ①③ 의 직접 red 로 PASS 다.
- 표 밖인데 같은 불변식이 필요한 지점: **없음** — 두 실패가 전부 표 안의 번호다(PLAN_GAP 아님).

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 산출 |
|---|---|---|
| `tsc --noEmit` node/web/test | **PASS** | 3구성 오류 **0** |
| `eslint ./src ./scripts` (`--fix` 없이) | **PASS** | **0 error · 1 warning**(기존 `useTranscriptVirtualizer:22`) |
| `vitest run` (전체) | **PASS + 환경 실패 1** | **351파일 / 3,375케이스 / 실패 1** — 실패는 `src/main/infra/loopback-callback.test.ts` 뿐(§8) |
| `vitest run --exclude loopback` | **PASS** | **350파일 / 3,369케이스 / 실패 0 / skip 0** — 연속 4회 동일 |
| `node --test scripts/*.test.mjs` | **PASS** | **67/67** (suites 8) |
| `check-migrations-appendonly` | PASS | 마이그레이션 **20** · 소스 **940파일** 스캔 |
| `check-doc-inventory --check` | PASS | generated(9 items · **82 channels**) · prose · links |
| `prettier --check` 변경 5파일 | PASS | 전건 통과 |
| `git diff --check` | PASS | 0건 |

## 6. 숫자 / 상한 재측정

- 전체 스위트 **351파일 3,375케이스** — 자기보고와 일치. r5 기준선 347/3,352 대비 파일 +4 · 케이스 +23.
- 케이스 증분 검산: 신규 4파일 = `gitIdentityMenusWiring` 9 + `composerRequirementWiring` 5 + `fileDiffRequirementReveal` 4 + `chatReducer.gitSnapshotFail` 5 = **23**. `diffTile.render.test.ts` 는 기존 케이스에 단언 3줄만 더해 케이스 수 불변. 실측과 일치.
- IPC 채널 **82** · 마이그레이션 **20** — 이번 변경으로 불변.
- **자기보고 "삭제 hunk 가 없다 · 전부 추가" 는 부정확하다** — `diffTile.render.test.ts` 에 삭제 1줄이 있다(`first.find(...).text()` → 지역 변수 `body` 로 추출). 표현만 바뀌고 단언은 같아 잃은 커버리지는 0 이다.
- **D45 재측정**: 전체 스위트 **28회 실행 중 `mutation-queue` 재현 0회**. 다만 N4b 실행 1회에서 **정체 미확인 추가 실패 1건**을 봤고, 같은 변이를 단독 재실행하니 red 1(보고와 일치)이었다. 그 1회 외 27회는 깨끗하다.

## 7. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 메뉴 원격 조회 | 컨테이너 렌더 9케이스 + 훅 6 + GitRow 세대 3 | **없음 — 닫혔다** |
| composer 선택 표시·액션 | 컴포저 렌더 5케이스 | **없음 — 닫혔다** |
| 코멘트 reveal | id 축 4케이스 | **없음 — 결손이다.** `scrollOwnerRef` 에 `{ querySelector: () => null }` 센티널을 넣고 그 값으로 단언하면 V2 가 red 가 된다. DOM 불필요 |
| 선택 cleanup 3자리 | 없음 | **없음 — 결손이다.** 순수 reducer 3케이스면 V3·V6·V8 이 red 가 된다 |
| 저장 카드 본문이 **실제로** 여러 줄로 서는지 | 클래스 토큰 대조 | **남는다**(D52) — 레이아웃 실측이라 `src/renderer/AGENTS.md` 의 시각 검증 몫 |
| 두 테마 파란 accent 계산색 | — | **남는다**(D41) |

## 8. 게이트 재실행 — 산출 관측

- 실행 명령: `cd app && npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(**`--fix` 없이**) · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-migrations-appendonly.mjs` · `prettier --check` · `git diff --check`.
- `npm test` 는 쓰지 않았다 — DB 동작 검증이 필요 없고 `pretest` 가 ABI 를 뒤집기 때문이다(`app/AGENTS.md`).
- **환경 기인 실패 1건 — 변경 무관으로 분리한다.** `loopback-callback.test.ts` 의 `타임아웃은 LoopbackCancelledError 로 끝난다` 가 `EADDRINUSE 127.0.0.1:45214` 로 실패한다. 근거 셋: ① 그 파일은 기준 커밋 `844b0ff` 와 **바이트 동일**하고 이번 diff 에 `src/main/**` 변경이 0 이다 ② 저장소와 무관한 `net.createServer().listen(45214)` 프로브가 같은 컨테이너에서 `EADDRINUSE` 를 내고 45211~45213·45215~45216 은 비어 있다 ③ 포트를 문 프로세스는 컨테이너 서비스(`environment-man`)다. 테스트가 포트를 45211 부터 **고정 증가**로 잡으므로 네 번째 케이스가 45214 를 만난다.
- **게이트가 작업 트리를 바꿨는가: 없음** — `eslint` 를 `--fix` 없이 돌렸고 실행 후 `git status --porcelain` 이 비었다. 변이 31회도 전건 복원 후 `git diff --quiet` 로 확인했다.
- **검증 중 잔여물: 1건, 저장소 내용 밖이다.** 인용 해시를 실제로 확인하려고 `git fetch --unshallow --filter=blob:none` 를 돌려 로컬 clone 을 54커밋 → 1,372커밋으로 깊게 했다. 작업 트리·인덱스 변화 0. 스크래치는 저장소 밖이다.
- **exit code 를 통과 증거로 쓰지 않았다** — 각 행에 파일 수·케이스 수·error/warning 수를 적었다.

## 9. Repository operation checks

- **AGENTS.md 변경**: 이번 범위에 없다 — 위생 스캔 대상 0.
- **INDEX 보드**: `impl/IMPL_DONE (r6)` → 이번 검증으로 `verify/FAIL`·다음 주체 Claude(구현)·라운드 6 으로 갱신한다. 비고는 5줄 이내로 다시 쓴다.
- **대상 커밋 좌표**: 자리표시자 `(r6 구현 — 검증자 기입)` 를 `788aff3` 로 기입했다. `git cat-file -t 788aff3` = `commit`.
- **trailer 파싱**: `git log -1 --format='%(trailers:only=true)' 788aff3` 이 **7키를 그대로** 돌려준다. 값도 전부 허용값이다(`Agent: claude` · `Status: implemented` · `Criteria-Met: 5/5` · `Verified-By: pending`).
- **인용 해시 실재 — 재계수**: plan·verify 가 인용한 해시꼴 토큰 **68개** 중 **62개가 commit** 이다. 3개는 애초에 커밋이 아니다(`33718212925` CI run id · `deadbee` fixture · `f1b46a0` 사용자의 다른 저장소). **3개가 죽은 좌표다** — `62eeefb`(0206 r2, 실제는 `0eee6fbd`) · `ec3ec1bc`(0209 AR 상속 기준) · `e4dd1ec`. 셋 다 **이번 라운드가 만든 것이 아니다**. r5 의 `죽은 좌표 0` 은 25개 부분집합 + shallow clone 관측이었다 → D53.
- **`[구현자 기입]` 7필드**: 설계 리뷰 · 강제 지점 전수/V-pair 자기확인 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 + 대응 · 구현 보고 · Review Signals = **7/7 존재**. 산문으로 접힌 필드 0.
- **reference/script**: 이동·삭제 0.

## 10. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "처방 3자리를 닫는 김에 전수로 밀어 형제 2지점을 더 찾았다" | **타당하고 실제로 그랬다.** 다만 스윕이 EP 의 **번호** 단위에서 멈췄다 — 번호 안의 자리(EP-71 ① 4자리 · ④ 2인자)까지 내려가지 않았다 | §5 §10 표 |
| "EP-71 4/4 SELF_PASS" | **재계수 2/4** — ① 은 cleanup 4자리 중 1, ④ 는 2인자 중 1 만 잠겼다 | D49·D50 |
| "§10 19/19" | **16/19 확인 · 1 미측정 · 2 실패** | §5 §10 표 |
| "M8 red 3 · S3 red 2" | **재측정 red 2 · red 1** — 개수만 과다하고 잠금은 유지된다 | §4-2 |
| "삭제 hunk 가 없다 — 전부 추가" | **부정확** — 삭제 1줄이 있다. 등가 추출이라 잃은 커버리지 0 | §6 |
| "D46 처방의 '메뉴에 실린 주소' 는 문자 그대로 성립하지 않는다 → `window.open` 인자로 관측" | **타당** — 소스 대조로 확인했다(`GitIdentityMenu:74`). 대체물이 원본보다 강하다 | 유지 |
| "jsdom/happy-dom 은 신규 의존성이라 단독 도입하지 않았다" | **타당** — `app/AGENTS.md` 의존성 정책 그대로다 | 사람 판단 대기 |
| 선조치 | **0건** — 프로덕션 파일 변경이 0 이다 | 확인 |

## 11. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| **D49** | 코멘트 reveal 의 **대상 컨테이너**가 무관측 — `FileDiffSection:292` 의 `scrollOwnerRef.current` 를 `null` 로 굳혀도 3,369 green(V2). 오라클 fixture 가 그 값을 항상 `null` 로 넣어 인자가 지워졌다. 사용자에게는 S1 과 같은 결과다 | VP-97 · §10 EP-71 ④ · D-147 | **BLOCKING** | `scrollOwnerRef` 에 센티널 객체를 넣고 `toHaveBeenCalledExactlyOnceWith(sentinel, id)` 로 단언한다 |
| **D50** | 선택 **cleanup** 4자리 중 3자리가 무관측 — 삭제(V3)·수동 범위 전환(V6)·cwd 초기화(V8)가 활성 id 를 안 지워도 green. 성공 clear(V7)만 잠겨 있다 | VP-97 · §10 EP-71 ① · D-147 | **BLOCKING** | 순수 reducer 3케이스를 더한다 — DOM·렌더 불필요 |
| D51 | draft 를 열 때의 활성 id 정리가 무관측(V5 green) | 비귀속 — §10 EP-71 ① 이 열거하지 않은 자리 | NON_BLOCKING | D50 을 닫을 때 같은 파일에 함께 넣으면 값이 싸다 |
| D52 | 저장 카드 본문에 `line-clamp-1` 을 **더하면** 한 줄로 접히는데 green(W1). 클래스 토큰 단언은 존재만 보고 억제 토큰을 못 본다 | VP-88 · EP-61 ② 잔여 | NON_BLOCKING | 레이아웃 실측은 시각 검증 몫이다(`src/renderer/AGENTS.md`) |
| D53 | plan·verify 인용 해시 68개 중 **3개가 죽은 좌표**(`62eeefb`·`ec3ec1bc`·`e4dd1ec`). 상속 기준 좌표 2개가 포함된다 | 비귀속 — 이번 라운드 산출 아님 | NON_BLOCKING | 상속 기준을 현재 히스토리의 해시로 정정한다 |
| D54 | 검증 환경의 `loopback-callback.test.ts` 가 고정 포트 45214 점유로 red. 테스트가 포트를 하드코딩한다 | 비귀속 — 변경 무관(§8) | NEXT_HANDOFF | 포트를 런타임 탐색으로 바꾸거나 충돌 시 건너뛴다 |
| D46·D47·D48 | 라운드 5 차단 3행 | — | 해소 | **closed**(§4-1) |
| D41 · D42 · D43 | r5 원문 유지 | 비귀속 | NON_BLOCKING | 사람/설계 판단 대기 |
| D45 · D32 | r5 원문 유지 | 비귀속 | NEXT_HANDOFF | D45 는 28회 중 0회 재현 |

## 12. Review Signals — 사실만

- **이전 라운드와 동일 증상: 형태가 한 단계 좁아졌다.** 라운드 3·4·5 는 "컨테이너를 아무도 렌더하지 않는다" 였고, 이번은 "컨테이너는 렌더하는데 **그 배선의 형제 인자·형제 사건**을 안 본다" 다. 같은 §10 번호 안에서 반복된다 — **여섯 라운드 연속** 같은 pair(VP-97)가 열려 있다.
- **관련 plan 지침은 둘 다 있었다** — EP-71 ① 의 `cleanup`, EP-71 ④ 의 `카드/문맥 reveal`. 번호와 실패 의미까지 적혀 있다.
- **구현자가 스스로 전수 스윕을 수행했고 그 스윕이 EP 번호에서 멈췄다.** 보고는 `EP-71 (4)` 를 네 항목으로 세었고 각 항목 안의 자리 수(① 4자리 · ④ 2인자)를 세지 않았다.
- **자기검증이 두 라운드 연속 새 green 을 냈다** — r5 는 보고 밖 10축 중 5 green, r6 은 9축 중 4 green. 두 번 다 blocking 이 그 축에서만 나왔다.
- **사용자 결정 변경 근거**: 이번 라운드 Decision 변경 0건.
- **반복된 검증 환경 한계 2건**: DOM 없음(jsdom/happy-dom 미설치) · 하드코딩 포트 충돌(D54, 이번에 처음 관측).
- **라운드 수 6 > 3 이나 `handoff-review` round 26 이 r5 직전에 수행됐다.** r5 §13 이 라운드 6 을 면제했다. **라운드 7 은 그 면제 범위 밖이므로 재구현 전에 `handoff-review` 를 수행한다.**

## 13. 결론 (라운드 6)

- 상태: **FAIL**
- pair 결과: **PASS 6**(VP-88·99·100·102·103 + r5 좌표 VP-72·79) · **root PAIR_FAIL 1**(VP-97) · BLOCKED_BY 0
- PLAN_GAP: **없음** — 두 실패가 전부 plan 이 번호로 적은 §10 지점이다(EP-71 ①④). **다음 주체는 구현자다**
- 라운드 6 대상 5행: **✅4 ❌1** — D46·D47·D48 은 닫혔고 **EP-71 ④ 가 반만 닫혔다**(자기보고는 ✅5)
- 변이: **31건 · RED 27 · GREEN 4** · 인용 변이 11행 전건 red · **덮개 회귀 0**(이전 red 11/11 재현, M41 은 5 → 10)
- 자기검증 분모: 구현자 = 검증자이므로 보고에 없던 축 **9건**을 넣었고 **4건이 green** 이다(D49·D50·D51·D52)
- §10 강제 지점: **EP-61 2/2 · EP-71 2/4 · EP-73 4/4 · EP-74 3/3 · EP-76 3/3 · EP-77 2/3 측정** = 16/19 확인 · 1 미측정 · 2 실패
- 현재 변경 운영 gate: **8종 PASS** — typecheck 3구성 0 · eslint 0 error/1 warning · vitest **351파일 3,375케이스**(환경 기인 1 제외 시 350/3,369 green) · scripts 67/67 · migrations 20 · doc-inventory 3종 · prettier · diff check. 검증 중 트리 변화 **0**
- NON_BLOCKING: D51·D52·D53 · D41·D42·D43 · NEXT_HANDOFF: D54·D45·D32 · 해소: D46·D47·D48
- 남은 사람 확인: 본문 실제 줄바꿈 레이아웃(D52) · 두 테마 파란 accent(D41) · 라운드 3 이월 시각 실기 3건
- 다음 단계: **구현자가 D49·D50 두 오라클을 만든다.** 둘 다 순수 reducer 케이스와 fixture 센티널이라 신규 의존성·DOM·사람 실기가 필요 없다. **라운드 7 착수 전 `handoff-review` 를 수행한다**(라운드 3 초과, r5 의 면제는 라운드 6 한정)

## Verify 라운드 7 (활성 코멘트 정리 8자리 + reveal 인자) — PASS

> 라운드 6 이 남긴 차단 2행(D49·D50)과 동반 1행(D51)을 닫는 재구현 턴의 검증이다. 라운드 6 원문은 위에 그대로 둔다.
> **세 행이 전부 닫혔고 VP-97 이 일곱 라운드 만에 PASS 다.** 검증자 독립 축에서 나온 새 green 은
> 전부 사용자 결과가 다른 잠금으로 닫혀 있어 비차단이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0211-worktree-session-ux` |
| 검증자 | Claude Code |
| 일자 | 2026-09-05 |
| 대상 커밋/range | `9137791` (`01a0237..9137791`) |
| 구현 전 plan 기준 | ΔV14 `99ebb1c` — 그 뒤 규범 행 변경 0 (아래 §0) |
| V mode / 유효 V | Delta V — `V1 + ΔV1 … + ΔV14` |
| 검증 기준 plan revision | `01a0237:ΔV14` (r6 verify 커밋의 파생 이슈 표가 이번 계약) |
| 라운드 | **7** |
| 상태 | **PASS** |
| 자기 검증 여부 | **에이전트 동일**(둘 다 `Agent: claude`) · 세션은 다르다 — 구현 `session_01YCfNmoiHu3qSY3VMcgdTrx`, 검증 `session_01Ev6tr9z6NTYkN533KSvhkX`. 규칙은 그대로 적용했다: 보고가 이름을 대지 않은 축 **10건** + §10 분모 독립 재열거를 넣었고 **5건이 green** 이다(§4-3) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: **그렇다. 규범 행은 0건이다** — `git show 9137791 --unified=0 -- plan.md | grep '^@@'` = hunk **3개**(`@@ -11 +11 @@` 메타 `상태` 1줄 · `@@ -16,0 +17,110 @@` `[구현자 기입] 라운드 7` 신설 · `@@ -5531,3 +5641,3 @@` 파생 이슈 D49~D51 의 `처리` 칸).
- **기준선이 diff 로 성립한다** — 계약을 정한 커밋은 r6 verify `01a0237`(`Status: verified`)이고 구현은 `9137791`(`Status: implemented`)로 갈려 있다.
- Decision Ledger·Product/UX Contract·AC·V node/pair·§10·oracle 변경: 구현 커밋 **0건**.
- 채점 기준: r6 파생 이슈 D49·D50·D51 이 인용한 pair(VP-97)와 §10 지점(EP-71 ①④), 그리고 그 행들이 귀속시킨 AC **AT-96** 원문 — "삭제/전송/세션 경계에서 이전 선택이 남지 않는다".

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | ΔV14 까지 각 revision 이 기준 커밋을 적었다 — r6 §0 판정 유지 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | 이번 라운드는 새 node 를 만들지 않는다(계약 변경 0) |
| 영향 INHERITED ↔ REGRESSION pair | 유효 | VP-100 이 ΔV13 상속의 REGRESSION 으로 남아 있다 |
| pair별 path·§10 전수·직접 oracle | 유효 | 이번 두 행이 전부 plan 이 번호로 적은 지점이다(EP-71 ①④) |
| 필요한 pair의 선택적 적대 증거 | 유효 | r6 파생 이슈 3행이 각 인용 변이를 지정했다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 8종 전건 실행 가능했다(§8) |

- root PLAN_GAP: **없음.**
- 상속 좌표 3건은 여전히 죽어 있다(D53) — 이번 라운드가 만든 것이 아니고 plan validity 를 깨지 않는다. **r7 이 새로 인용한 해시꼴 토큰은 0개다**(`git show 9137791 -- plan.md INDEX.md | grep '^+' | grep -oE '[0-9a-f]{7,40}'` = 빈 집합).

## 1. Product & UX / ACTIVE Decision — end-to-end

| Decision | 기대 결과 | production path | 판정 |
|---|---|---|---|
| D-147 (코멘트 선택 연동) | composer ↔ diff 같은 항목이 **함께** 활성이고 그 코멘트가 **보인다** | composer `Composer.tsx:367` · diff `DiffTileContent:95` · reveal `FileDiffSection:292` · cleanup `chatReducer.ts` 8자리 | **충족 — EP-71 4/4 전건 잠김**(①은 8자리 각각 red · ② N4a·N4b·N4c · ③ M13 · ④ V2·V2b) |
| D-151·D-152 · D-136 · D-149 · D-153 | r6 판정 유지 | — | **PASS 좌표 참조** — 이번 diff 는 프로덕션 0줄이고 그 경로를 건드리지 않는다 |
| D-115 · D-123 | r5 판정 유지 | — | **PASS 좌표 참조** |

```text
사용자가 코멘트 카드/인용 타일을 누른다
  → chatActions.selectDiffRequirement (chatStore.ts:1399)
  → SELECT_DIFF_REQUIREMENT → activeDiffRequirementId (chatReducer.ts:1339)
  → Composer selectedId(:367) · DiffTileContent activeRequirementId(:95)
  → FileDiffSection effect → revealDiffRequirement(scrollOwnerRef.current, id) (:292)
  → 대상이 아니게 되는 8자리에서 다시 null (범위 전환·해제·요약·삭제·draft·clear·cwd 2)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success 가능성 | **r6 의 것은 닫혔다** | `scrollOwnerRef.current` 를 `null` 로 굳히면 이제 red 3(§4-1 V2). r6 에서는 3,369 green 이었다 |
| 실환경 실패 방식 | 양호 | 8자리 중 어느 하나라도 활성을 남기면 red 1 이상이다 |
| partial failure/rollback | 해당 없음 | **프로덕션 변경 0줄** — 외부 쓰기·마이그레이션 0 |
| A가 아닌 B를 구현했는가 | 아니다 | 두 파일 모두 프로덕션 심볼(`chatReducer` · `FileDiffSection`)을 직접 돌린다. 동명 로컬 재구현 0 |
| 증상만 제거하고 상태가 남았는가 | 아니다 | 인용·등록 변이 10건이 전건 red 다 |
| 최적화가 잃은 재검증 관측 | 해당 없음 | 이번 라운드에 캐시·축약 변경 0 |
| 출력/요청 worst-case 상한 | 유지 | 이번 diff 에 상한 변경 0 |

- **처방보다 넓힌 분모는 실재한다.** D50 처방은 3자리였고 구현은 8자리를 닫았다 — 검증자가 코드에서 다시 세도 **명시 write 는 8자리**다(§5 §10 표).

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 01a0237..9137791   # 변경된 소스 파일 없음
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 스크립트 대상 | **0 파일** | 프로덕션 소스 변경이 없다(`app/src` 비-테스트 diff 0) |
| 테스트 전용 참조 | 0건 | 신규 파일이 `chatReducer`·`initialChatState`·`ALL_CHANGES` 를 실제 import 해 실행한다 |
| 동명 로컬 재구현 | **0건** | 리듀서 테스트는 순수 함수를 직접 부르고, reveal 테스트는 `FileDiffSection` 을 렌더한다 |
| 형제 정책 비대칭 | **0건** | r6 이 지적한 비대칭(fixture 가 인자를 지움)이 이번에 해소됐다 |
| producer ↔ consumer 파생 불일치 | **1건, 비차단** | 세션 경계 3자리의 활성 id 정리에 소비처가 없다 → D55 |
| 게이트가 바꾼 트리 | **0건** | eslint 를 `--fix` 없이 돌렸고 실행 후 `git status --porcelain` 이 비었다 |

## 4. 적대 증거 재측정 — 25변이 · RED 20 · GREEN 5 (실행 28회)

- **분모**: 인용·등록 **10** + 이전 라운드 red 재현 7행 중 신규 실행 **5**(S1·V7 은 V2b·N-c 와 같은 실행) + 검증자 독립 축 **10** = 판정 대상 **25변이**. 재실행 3회를 더해 전체 스위트 **28회** 돌렸다.
- **덮개 회귀 0** — 이전 라운드가 red 로 본 7변이가 전건 red 이고 그중 하나는 red 1 → **red 2** 로 늘었다.
- 동작 보존 추출 라운드인가: **아니다** — 프로덕션 변경 0 이라 hunk 되돌림 논점이 없다.
- 복원 검증: 28회 전건 적용 후 `git checkout` → `git status --porcelain` 이 매번 비었다.
- **실행 분모는 전체 스위트 352파일 3,385케이스다**(scoped 실행이 아니다). 구현 보고의 `N/61`·`N/5` 는 scoped 분모이고 red 개수는 아래에서 그대로 일치한다.

### 4-1. 구현 보고가 등록·인용한 변이 (10행 · red 10 · green 0)

| 변이 | 자기보고 | 재측정 | 귀속 |
|---|---|---|---|
| V2 reveal 첫 인자를 `null` 로 굳힘 | red 3 | **red 3** | VP-97 · EP-71 ④ · D49 |
| V2b reveal id 를 상수로 굳힘 | red 2 | **red 2** | 형제 인자 |
| V6 `SET_DIFF_COMPARISON` 이 활성을 남김 | red 1 | **red 1** | VP-97 · EP-71 ① ① |
| N-a `SELECT(id=null)` 가 아무것도 안 함 | red 1 | **red 1** | 같은 축 ② |
| N-b 범위 바뀐 요약이 활성을 남김 | red 1 | **red 1** | 같은 축 ③ |
| V3 `REMOVE` 가 활성을 남김 | red 1 | **red 1** | 같은 축 ④ · D50 |
| V5 draft 열기가 활성을 남김 | red 1 | **red 1** | 같은 축 ⑤ · D51 |
| N-c 성공 clear 가 목록만 비움 | red 2 | **red 2** | 같은 축 ⑥ |
| V8 `resetGitReview` 가 활성을 남김 | red 2 | **red 2** | 같은 축 ⑦⑧ · D50 |
| N-d 선택·추가가 활성을 안 세움 | red 2 | **red 2** | 양성 축 |

- **구현 보고의 red 개수가 10행 전건 일치한다.** r6 의 두 개수 과다(M8·S3) 같은 어긋남은 이번에 0 이다.

### 4-2. 이전 라운드 red 좌표 재현 (7행 · 덮개 회귀 0)

| 변이 | r6 | 재측정 | 비고 |
|---|---|---|---|
| S1 reveal 인자를 상수 id 로 | red 2 | **red 2** | V2b 와 같은 변이 — 교체된 fixture 가 구 장치의 자리를 유지했다 |
| V7 성공 clear 가 활성을 안 지움 | red 1 | **red 2** | N-c 와 같은 변이 — 새 케이스가 함께 잡아 **늘었다** |
| S6 선택 액션 무력화 | red 1 | **red 1** | EP-71 ① 액션 축 |
| M13 `activeRequirementId` → `null` | red 2 | **red 2** | EP-71 ③ |
| N4a `selectedId` 를 `null` 로 | red 2 | **red 2** | EP-71 ② |
| N4b `onSelect` 를 no-op 으로 | red 1 | **red 1** | EP-71 ② |
| N4c `onSelect`↔`onRemove` 맞바꿈 | red 2 | **red 2** | 형제 슬롯 |

### 4-3. 검증자 독립 축 (10건 중 5 green)

| # | 변이 | 결과 | 귀속 |
|---|---|---|---|
| A4 | reveal 첫 인자를 형제 ref(`tailSpacerRef.current`)로 맞바꿈 | red 3 | VP-97 · EP-71 ④ — 형제 슬롯 맞바꿈도 잡는다 |
| A5 | reveal 을 한 번 더 부른다(`ExactlyOnce` 엄격화) | red 2 | 0건/전수 장치의 민감도 |
| V8a | `session.updated` **호출부만** 활성을 남김 | red 1 | ⑦ — 보고는 두 호출부를 한 행으로 접었다 |
| V8b | `SET_CWD` **호출부만** 활성을 남김 | red 1 | ⑧ |
| A3 | `NEW_CHAT` 이 활성 **과 목록** 을 물려줌 | red 1 | `chatReducer.plan.test.ts:705` 가 목록으로 잡는다 |
| **A3a** | `NEW_CHAT` 이 **활성만** 물려줌 | **GREEN** | 세션 경계 → **D55** |
| **A1** | `LOAD_SESSION` 이 활성과 목록을 물려줌 | **GREEN** | 같은 축 → D55 |
| **A1a** | `LOAD_SESSION` 이 활성만 물려줌 | **GREEN** | 같은 축 → D55 |
| **A1b** | `LOAD_SESSION` 이 목록만 물려줌 | **GREEN** | 같은 축 → D55 |
| **A2** | `START_LOAD_SESSION` 이 활성과 목록을 물려줌 | **GREEN** | 같은 축 → D55 |

- A2 는 3회 돌렸다 — 2회 green, 1회는 `mutation-queue.test.ts` red 1 이다. 그 실패는 **변이와 무관**(D45)이고 같은 변이 재실행에서 green 이다.

- 다섯 green 은 **한 형태**다 — `...initialChatState` 스프레드로 **구조적으로** 비워지는 자리라 명시 write 스윕에 잡히지 않았다.
- **그러나 사용자 결과는 다른 잠금이 닫는다**(§11 D55): `NEW_CHAT`·`SET_CWD` 는 목록 비움이 잠겨 있고(A3 red), 세션 간 격리는 store 가 잠근다(`chatStore.test.ts:709`), `LOAD_SESSION`·`START_LOAD_SESSION` 은 **프로덕션에서 항상 새 state 에 적용된다**(`chatStore.ts:1185` `{ ...initialChatState, cwd: cwdCache }` → `:1204` `dispatchTo`). 남은 것은 소비처 없는 dangling id 다.

### 4-4. §8 엄격화 — 이번 라운드가 만든 전수/0건 판정

| 장치 | 엄격화 | 차집합 |
|---|---|---|
| “cleanup **8자리** 전수” | 술어를 `chatReducer.ts` 의 **명시 write** → **diff-review 상태를 리셋하는 모든 자리**로 넓힌다 | **비지 않는다 — 3자리**(`NEW_CHAT`·`START_LOAD_SESSION`·`LOAD_SESSION`, 전부 `...initialChatState` 스프레드) → D55 |
| 같은 스윕의 파일 범위 | 저장소 전체로 넓힌다 — `grep -rn 'activeDiffRequirementId:' app/src --include=*.ts*` 비테스트 | **비어 있다** — 프로덕션 write 는 전부 `chatReducer.ts` 안이다 |
| `toHaveBeenCalledExactlyOnceWith(OWNER, id)` | 호출을 1 → 2회로 늘린다(A5) | 비어 있다 — red 2 |
| `expect(h.reveal).not.toHaveBeenCalled()` 0건 | 양성 짝이 같은 파일에 있다(id 축 2케이스) | 비어 있다 |

## 5. V-pair closeout — 재검증 범위

> 실행 범위: r6 의 root pair(VP-97) + 이번 diff 가 닿은 §10 지점 + 현재 변경의 운영 gate. 영향 없는 r6 PASS 는 그 좌표를 참조한다.

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| **VP-97** | R↔AT, AR↔IT | REQUIRED | **PASS** | ① 8자리 각각 red(V6·N-a·N-b·V3·V5·N-c·V8a·V8b) · ② red(N4a·N4b·N4c) · ③ red(M13) · ④ red(V2·V2b·A4) |
| VP-88 · VP-99 · VP-100 · VP-102 · VP-103 | — | REQUIRED/REGRESSION | **PASS 좌표 참조** | r6 §5 — 이번 diff 가 EP-61·73·74·76·77 경로를 건드리지 않는다(프로덕션 0줄) |
| VP-72 · VP-79 | — | — | **PASS 좌표 참조** | r5 §5 |
| 그 밖 REQUIRED·REGRESSION | — | — | **PASS** | 전체 스위트 352파일 3,385케이스 green |

- root `PAIR_FAIL`: **0**.
- 종속 `BLOCKED_BY`: **0**.

### 라운드 7 대상 3행 채점

| 행 | 결과 | 이번 턴 증거 |
|---|---|---|
| D49 | ✅ | V2 red 3 · V2b red 2 · 검증자 축 A4 red 3 · A5 red 2 |
| D50 | ✅ | 8자리 각각 red — V6·N-a·N-b·V3·V5·N-c 각 1~2 · 두 호출부를 갈라 V8a red 1 · V8b red 1 |
| D51 | ✅ | ⑤ V5 red 1 |

- **합계 재측정**: `✅ 3 · ⚠️ 0 · ❌ 0 = 총 3`. 자기보고 `✅3` 과 **일치한다**.
- **합계 사본 대조**: 본문 `3` ↔ trailer `Criteria-Met: 3/3` ↔ INDEX 비고 — 세 사본이 일치한다.
- ΔV1~ΔV14 의 AC 분모는 이번 라운드가 바꾸지 않았다(AC 변경 0건).

### pair별 plan §10 강제 지점 분모 — 검증자 재계수

| EP | plan N | 검증자 확인 | 결과 |
|---|---|---|---|
| **EP-71** | 4 | **4/4** — ① cleanup **8자리 전건 red** · ② N4a·N4b·N4c · ③ M13 · ④ V2·V2b·A4 | **PASS** |
| EP-61 · EP-73 · EP-74 · EP-76 | 2·4·3·3 | **r6 좌표 참조** | PASS |
| EP-77 | 3 | **2/3 측정** — ① ③ 은 r6 좌표 · **② 는 이번에도 미측정** | PASS(①③ 직접 red) |

- 이번 라운드 합계: **EP-71 4/4** 로 r6 의 `2/4` 가 닫혔다. 자기보고(① 8/8 · ④ 2/2)와 일치한다.
- **분모를 라벨이 아니라 코드에서 다시 셌다.** `grep -n 'activeDiffRequirementId' chatReducer.ts` = 13행 — 타입 선언 2(`:190` `:349`) · 헬퍼 정의 1(`:208`) · 초기 상태 1(`:458`) · 액션 내 write 8(비움 6 · 세움 2). `grep -n 'resetGitReview'` = 정의 1(`:181`) + 호출부 2(`:724` `:1030`). **비움 6 + 호출부 2 = 8자리** — 구현자 재열거와 일치한다.
- 못 본 것: **EP-77 ② 는 이번에도 측정하지 않았다**(r6 과 같다). 미측정을 PASS 근거로 쓰지 않았다 — VP-103 은 ①③ 의 직접 red 로 PASS 다.
- 표 밖인데 같은 불변식이 필요한 지점: **세션 경계 3자리**(D55). AT-96 의 "세션 경계" 절은 목록 비움과 store 격리로 닫혀 있어 `PLAN_GAP` 이 아니라 `NON_BLOCKING` 이다.

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 산출 |
|---|---|---|
| `tsc --noEmit` node/web/test | **PASS** | 3구성 오류 **0** |
| `eslint ./src ./scripts` (`--fix` 없이) | **PASS** | **0 error · 1 warning**(기존 `useTranscriptVirtualizer:22`) |
| `vitest run` (전체) | **PASS** | **352파일 / 3,385케이스 / 실패 0 / skip 0** |
| `node --test scripts/*.test.mjs` | **PASS** | **67/67** (suites 8) |
| `check-doc-inventory --check` | PASS | generated(9 items · **82 channels**) · prose · links |
| `check-migrations-appendonly` | PASS | 마이그레이션 **20** · 소스 **941파일** 스캔 |
| `prettier --check` 변경 2파일 | PASS | 전건 통과 |
| `git diff --check` | PASS | 0건 |

## 6. 숫자 / 상한 재측정

- 전체 스위트 **352파일 3,385케이스** — 자기보고와 일치. r6 기준선 351/3,375 대비 파일 +1 · 케이스 +10.
- 케이스 증분 검산: 신규 `chatReducer.diffRequirementSelection.test.ts` **9** + `fileDiffRequirementReveal.test.ts` **4 → 5**(+1) = **10**. 실측과 일치(각 파일 단독 실행으로 확인).
- IPC 채널 **82** · 마이그레이션 **20** — 이번 변경으로 불변.
- **자기보고의 분모 검산 줄이 자기 표와 갈린다.** 본문은 `인용 변이 4 · 새 oracle 6 = 10` 인데 같은 표의 `분모 갈래` 칸은 인용 변이를 **5행**(V2·V3·V6·V8·V5)으로 적었다. **총계 10 은 맞고** 표 행 수·red 개수도 전건 맞다 → D56.
- **D45 재측정**: 전체 스위트 **31회 실행**(변이 28 + 기준선 3) **중 `mutation-queue` 재현 1회**. 같은 변이 재실행은 green 이라 변이 무관이다.
- **D54 재측정**: `loopback-callback` 실패 **31회 중 0회** — 이번 컨테이너는 45211~45216 이 비어 있다.

## 7. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 코멘트 reveal | 컨테이너 인자·id·형제 ref·호출 횟수 5케이스 | **없음 — 닫혔다** |
| 선택 cleanup | 순수 reducer 9케이스(8자리 + 양성 축) | **없음 — 닫혔다** |
| 저장 카드 본문이 **실제로** 여러 줄로 서는지 | 클래스 토큰 대조 | **남는다**(D52) — 레이아웃 실측은 `src/renderer/AGENTS.md` 의 시각 검증 몫 |
| 두 테마 파란 accent 계산색 | — | **남는다**(D41) |
| 라운드 3 이월 시각 실기 | — | **남는다** |

## 8. 게이트 재실행 — 산출 관측

- 실행 명령: `cd app && npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(**`--fix` 없이**) · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-migrations-appendonly.mjs` · `prettier --check` · `git diff --check`.
- `npm test` 는 쓰지 않았다 — DB 동작 검증이 필요 없고 `pretest` 가 ABI 를 뒤집기 때문이다(`app/AGENTS.md`).
- **컨테이너가 새로 시작돼 `node_modules` 가 없었다 — 복구 과정을 분리해 적는다.** `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 직후에는 better-sqlite3 가 **Electron ABI** 라 DB 스위트 10파일 54케이스가 red 였다(`Module did not self-register`). `npm rebuild better-sqlite3`(Node ABI) 후 3,383 green + `chat-turn.continuity` 1파일이 electron 바이너리 부재로 red, `node node_modules/electron/install.js` 후 **352/3,385 전건 green**. 세 단계 모두 `app/AGENTS.md` 의 알려진 서명이고 **변경 무관**이다.
- **게이트가 작업 트리를 바꿨는가: 없음** — `eslint` 를 `--fix` 없이 돌렸고 실행 후 `git status --porcelain` 이 비었다. 변이 28회도 전건 복원 후 같은 명령으로 확인했다.
- **검증 중 잔여물: 1건, 저장소 내용 밖이다.** `node_modules/`(gitignore)와 `/tmp` 스크래치의 변이 로그 28개뿐이다. 추적 파일 변화 0.
- **exit code 를 통과 증거로 쓰지 않았다** — 각 행에 파일 수·케이스 수·error/warning 수를 적었다.

## 9. Repository operation checks

- **AGENTS.md 변경**: 이번 범위에 없다 — 위생 스캔 대상 0.
- **INDEX 보드**: `impl/IMPL_DONE (r7)` → 이번 검증으로 `verify/PASS`·다음 주체 사람(시각 3건)·라운드 7 로 갱신한다. 비고는 5줄 이내로 다시 쓴다.
- **대상 커밋 좌표**: 자리표시자 `(r7 구현 — 검증자 기입)` 를 `9137791` 로 기입했다. `git cat-file -t 9137791` = `commit`.
- **trailer 파싱**: `git log -1 --format='%(trailers:only=true)' 9137791` 이 **7키를 그대로** 돌려준다. 값도 전부 허용값이다(`Agent: claude` · `Status: implemented` · `Criteria-Met: 3/3` · `Verified-By: pending`).
- **인용 해시**: r7 이 새로 인용한 해시 **0개** — D53 의 죽은 좌표 3건은 그대로 남는다(비귀속).
- **`handoff-review` 선행 확인**: r6 §12·§13 이 지시한 review 가 **실제로 수행됐다** — 커밋 `0705fcd`(`Handoff: none`), 기록은 `regression-coverage.md § review round 27`, 모드 `DIAGNOSE_ONLY`, 지침 변경 0.
- **`[구현자 기입]` 7필드**: 설계 리뷰 · 강제 지점 전수/V-pair 자기확인 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 + 대응 · 구현 보고 · Review Signals = **7/7 존재**. 산문으로 접힌 필드 0.
- **reference/script**: 이동·삭제 0.

## 10. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "처방 3자리 대신 계약의 cleanup 8자리 전수를 닫았다" | **타당하고 재측정으로 확인했다** — 명시 write 술어로 세면 정확히 8자리고 8행이 각각 red 다 | §5 §10 표 |
| "차집합 3자리(`SELECT(id=null)`·범위 바뀐 요약·두 번째 호출부)" | **일치** — 두 호출부는 갈라서 각각 red(V8a·V8b) | §4-3 |
| "덮개 회귀 0 — fixture 의 `null` 을 센티널로 **바꾼** 편집" | **타당** — 구 장치가 잡던 S1 이 red 2 로 그대로다 | §4-2 |
| "분모 검산: 인용 변이 4 · 새 oracle 6 = 10" | **총계는 맞고 갈래가 자기 표와 갈린다** — 표는 인용 5행으로 적었다 | D56 |
| "D54 는 이번 실행에서 재현 0" | **일치** — 검증 30회 실행에서도 0회 | §6 |
| "프로덕션은 한 줄도 바꾸지 않았다" | **일치** — `app/src` 비-테스트 diff 0 | §3 |
| 선조치 | **0건** — 프로덕션 파일 변경이 0 이다 | 확인 |

## 11. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D55 | 세션 경계 3자리(`NEW_CHAT`·`START_LOAD_SESSION`·`LOAD_SESSION`)의 **활성 id 정리가 무관측** — 활성만 물려줘도 3,385 green(A3a·A1a·A2). `...initialChatState` 스프레드라 명시 write 스윕에 안 잡힌다 | VP-97 인접 — AT-96 "세션 경계" 절은 목록 비움(`chatReducer.plan.test.ts:705`)·store 격리(`chatStore.test.ts:709`)·`chatStore.ts:1185` 의 새 state 적용으로 닫혀 있다 | **NON_BLOCKING** | 남는 것은 소비처 없는 dangling id 다. 값이 싼 reducer 케이스 3개면 닫힌다 |
| D56 | 구현 보고 §"이번 라운드 수정의 잠금" 검산 줄이 `인용 4 · 새 oracle 6` 인데 같은 표의 갈래 칸은 인용 **5행**이다. 총계 10 과 행별 red 는 전건 정확하다 | 비귀속 — 보고 서술 | **NON_BLOCKING** | 다음 라운드에 갈래를 표와 같게 적는다 |
| D49 · D50 · D51 | 라운드 6 차단 2행 + 동반 1행 | — | 해소 | **closed**(§4-1 · §5) |
| D52 · D53 · D41 · D42 · D43 · D23 · D24 · D30 · D31 | r4~r6 원문 유지 | 비귀속 | NON_BLOCKING | 사람/설계 판단 대기 |
| D54 · D45 · D32 · D33 · D34 | r4~r6 원문 유지 | 비귀속 | NEXT_HANDOFF | D54 는 31회 중 0회 · D45 는 31회 중 1회 재현 |

## 12. Review Signals — 사실만

- **이전 라운드와 동일 증상: 이번에는 재발하지 않았다.** r5·r6 은 "처방이 지목한 자리만 닫고 형제 자리가 열린 채 남았다" 였고, r7 은 처방(3자리)보다 **넓은 분모**(8자리)를 스스로 세어 닫았다. 검증자 축의 green 4건은 전부 **새 형태**(구조적 스프레드)다.
- **관련 plan 지침은 있었다** — `handoff-impl` §2 의 "전수 검색으로 세고 검색 명령을 적는다". 구현 보고가 재열거 명령을 실제로 실었다.
- **review round 27 이 착수 전에 수행됐고 그 결과가 이번 구현에 반영됐다** — round 27 도 `activeDiffRequirementId` 를 코드에서 재열거해 **8자리**를 얻었다. 즉 **설계자·구현자·검증자 세 자리가 모두 같은 술어(명시 write)에서 멈췄고**, 그 술어를 넓혔을 때만 차집합 3자리가 나왔다(§4-4).
- **자기검증 분모가 세 라운드 연속 유일한 새 green 원천이다** — r5 10축 중 5 · r6 9축 중 4 · r7 10축 중 5. 다만 **r7 의 green 은 처음으로 blocking 이 아니다**.
- **사용자 결정 변경 근거**: 이번 라운드 Decision 변경 0건.
- **반복된 검증 환경 한계 1건 + 신규 1건**: DOM 없음(jsdom/happy-dom 미설치, 이번 범위는 순수 reducer 라 무영향) · **새 컨테이너의 `node_modules` 부재**(설치·ABI·electron 바이너리 3단계 복구가 필요했다, §8).
- 현재 라운드 수: **7**.

## 13. 결론 (라운드 7)

- 상태: **PASS**
- pair 결과: **PASS 8**(VP-97 이번 라운드 직접 · VP-88·99·100·102·103 r6 좌표 · VP-72·79 r5 좌표) · root PAIR_FAIL **0** · BLOCKED_BY 0
- PLAN_GAP: **없음**
- 라운드 7 대상 3행: **✅3 ❌0** — 자기보고와 일치
- 변이: **25종 · RED 20 · GREEN 5**(전체 스위트 28회 실행) · 인용·등록 10행 전건 red 이고 **red 개수까지 자기보고와 일치** · **덮개 회귀 0**(이전 red 7/7 재현, V7 은 1 → 2)
- 자기검증 분모: 에이전트가 같으므로 보고에 없던 축 **10건** + §10 분모 독립 재열거를 넣었고 **5건이 green** 이다(D55, 비차단)
- §10 강제 지점: **EP-71 4/4**(r6 의 2/4 해소) · EP-61·73·74·76 은 r6 좌표 · EP-77 2/3 측정(② 이번에도 미측정)
- 현재 변경 운영 gate: **8종 PASS** — typecheck 3구성 0 · eslint 0 error/1 warning · vitest **352파일 3,385케이스 전건 green** · scripts 67/67 · migrations 20 · doc-inventory 3종 · prettier · diff check. 검증 중 추적 파일 변화 **0**
- NON_BLOCKING: D55·D56 · D52·D53·D41·D42·D43·D23·D24·D30·D31 · NEXT_HANDOFF: D54·D45·D32·D33·D34 · 해소: D49·D50·D51
- 남은 사람 확인: 본문 실제 줄바꿈 레이아웃(D52) · 두 테마 파란 accent(D41) · 라운드 3 이월 시각 실기
- 다음 단계: **archive 이동은 사람 몫 3건이 끝날 때까지 보류한다.** 코드·오라클 축의 blocking 은 0 이다
