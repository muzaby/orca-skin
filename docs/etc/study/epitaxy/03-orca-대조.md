# Orca 대조

Orca 는 이미 같은 계보의 스킨이다 — `shared/ui/Button` 주석이 "Epitaxy (Claude Code desktop) button
primitive" 를 명시하고, paint 층 분리·`-z-[1]`·`relative isolate` 구조가 캡처와 일치한다.
그래서 대조의 관심은 *외형* 이 아니라 **아직 없는 구조적 장치**다.

## 1. 축별 대조

| 축 | Claude Code (캡처) | Orca 현재 | 간극 |
|---|---|---|---|
| 버튼 프리미티브 | `cds-reset` + paint 층 + `cds-btn-squish` | `shared/ui/Button` 이 동일 구조 | 없음 |
| 컴포저 상단 행 | `nav`, 1행=1저장소, 세로 스택, `max-h-[50vh]` 스크롤 | `CwdPanel` — `flex-wrap` 칩 행, **랜딩에서만** 노출 | 스택 아님 · 좁아지면 줄바꿈 · 세션 시작 후 사라짐 |
| 행 내부 축소 | shrink 서열 + `contents` 그룹 | `flex-wrap` 으로 도피 | 폭이 줄면 컴포저 높이가 뛴다 |
| 칩 외형 | ghost 버튼 + 토큰 | `chipSurface(flat\|outlined)` 가 단독 소유 | 동등 (Orca 가 더 명시적) |
| 문자열 줄임 | 2-span 머리자름 + 꼬리보존 | `ComposerChip` 의 `truncate` 한 겹 | 긴 브랜치·경로의 **꼬리가 날아간다** |
| 타일 슬롯 크기 | `flex: <grow> 1 0px` (비율) | 열 = `width: px` (clamp 280–640), 행 = `flexBasis: %` | 창 리사이즈 시 열 비율이 보존되지 않는다 |
| 타일 껍데기 | `tiles-shell` 1×1 grid + `contents` 호스트 | flex + `min-h-0` 체인 | 동등하지만 함정 방어가 **관례에 의존** |
| 타일 재배치 | `tiles-drag-handle` 버튼 (키보드 가능) | 없음 — 추가/제거와 column-major 자동 배치만 | 사용자 재배치 없음 |
| 창 드래그 | 헤더 뒤 `.draggable` 층 + `draggable-none` 예외 | 렌더러에 `-webkit-app-region` 흔적 없음(미확인) | — |
| 포커스 링 | 패널 루트에서 `--cds-page-bg` 재기준 | `ring-focus` / `hide-focus-ring` 유틸 | 표면별 자동 정합 없음 |
| 코드 표면 색 | `--code-theme-{light,dark}-bg` 패널 스코프 주입 | 전역 토큰 | 패널별 코드 배경 불가 |
| 성능 계측 | `data-perf-region` · `data-perf-screen` | 없음 | — |
| diff | 저장소 diff 패널(트리 · 커밋 · 파일별 블록) | `transcript/tool-bodies/DiffBody` — **도구 입력**(Edit/Write/MultiEdit)만 `diffLines` 로 그린다 | 저장소 전체 diff · 파일트리 · 커밋 목록 전무 |
| git IPC | (PR · CI · 커밋 · diff 전부) | `gitStatus` · `gitBranches` · `gitCheckout` 3종, worktree 미지원 | diff/log/PR/CI 채널 부재 |
| 색 토큰 | `text-git-added` · `text-git-removed` · `text-git-draft` | `--color-good` · `extended-green` · `rust` | **git 의미 토큰 없음** |

## 2. 적용 후보

결정이 아니라 후보다. 값이 크고 비용이 작은 순으로 둔다 — 채택 여부는 별도 handoff 의 몫이다.

### A. 2-span 트렁케이션 유틸 (비용 최소, 값 즉시)

브랜치 칩 · 참조 경로 칩 · (장차) 파일 경로가 전부 같은 문제를 갖는다. 지금 `ComposerChip` 은
`<span class="min-w-0 truncate">` 한 겹이라 `claude/0205-cowork-study-and-task-tile-suspend` 가
`claude/0205-cowork-study-and-…` 로 잘려 **꼬리로 구분되는 브랜치들이 같아 보인다.**
분할 규칙(경로=마지막 세그먼트, 그 외=문자 비율)만 정하면 `shared/ui` 의 작은 컴포넌트 하나다.

### B. shrink 서열 + `contents` 그룹으로 `flex-wrap` 대체

`CwdPanel` 은 좁아지면 두 줄이 되어 컴포저 높이가 뛴다. 줄바꿈 대신 **무엇을 먼저 줄일지** 를
정하는 편이 낫다 — 작업 경로 · 브랜치는 줄이고, `+` 버튼과 제거 버튼은 `shrink-0`.
그룹핑이 필요하면 래퍼에 `display:contents` 를 줘서 레이아웃 경계를 만들지 않는다.

### C. 패널 루트 변수 재기준

`RightPanelTile` 이 루트에서 자기 표면색을 `--page-bg` 상당 변수로 재정의하면, 내부의 모든
포커스 링·인셋 그림자가 그 타일 배경에 자동으로 맞는다. 타일 배경이 다양해질수록 값이 커지고,
지금 넣는 비용이 가장 싸다.

### D. 타일 크기를 px → grow 비율로

`rightPanelColWidths: number[]` (px, clamp 280–640) 를 grow 비율로 바꾸면 창 리사이즈에서 열 비율이
보존된다. 다만 clamp 의 의미가 "px 하한" 이라 `min-width` 로 옮겨야 하고, 저장된 사용자 설정의
마이그레이션이 따른다 — **되돌리기 어려운 데이터 포맷 변경이라 사용자 결정 사안**이다.

### E. diff 패널 — IPC 계약 신설이 선행한다

UI 는 캡처가 충분히 보여주지만, Orca 에는 **먹일 데이터가 없다.** 최소 3채널이 필요하다.

| 채널 | 내용 |
|---|---|
| 변경 목록 | `git diff --numstat <base>...<head>` → 파일별 `+/-` (트리와 헤더가 함께 쓴다) |
| 커밋 범위 | `git log --format` → sha · 제목 · 작성자 · 시각 (좌측 하단 목록) |
| 파일 본문 | 파일별 patch 또는 양쪽 blob (본문 렌더는 캡처에 없어 별도 조사 필요) |

**PR · CI 는 성격이 다르다.** GitHub 네트워크 접근이 필요해 폐쇄망 확장 정책
([`docs/guides/`](../../../guides/))과 정면으로 걸린다 — UI 를 먼저 만들 대상이 아니라 제품 결정이
먼저인 항목이다.

### F. git 의미 색 토큰

`text-git-added` / `text-git-removed` / `text-git-draft` 에 해당하는 토큰이 Orca 에 없다.
`DiffBody` 가 지금 무슨 색을 쓰는지와 함께 한 번에 정리하는 편이 낫다 — A~D 중 무엇을 하든
diff 표면이 늘어나면 바로 필요해진다.

## 3. 이 캡처로 못 가른 것

Orca 구현을 설계할 때 **여기서 답을 찾으면 안 되는** 것들이다.

- 브랜치 문자열의 분할 비율 규칙 (문자 수? 픽셀 측정? 고정 꼬리 길이?).
- `scroll-fade-y` · `status-dot` · `epitaxy-panel-subheader` · `cds-btn-squish` 의 CSS 구현.
- CI 팝오버 · 저장소 메뉴 · 브랜치 메뉴의 내용 (전부 닫힌 상태로 캡처).
- diff **본문** 마크업 (전 파일 접힘 — hunk·줄·거터가 하나도 없다).
- 다중 행(저장소 여럿) 스택의 실제 동작 — 1행만 캡처.
- 파일트리 가상 스크롤 여부 · 리사이즈 핸들 구현.
- 상태 전이와 애니메이션 전부.
