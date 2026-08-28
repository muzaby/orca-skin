# diff 패널 — 타일 하나의 전체 해부

우측 타일 영역에 뜨는 diff 뷰다. 바깥에서 안으로 층이 여섯 겹이고, 각 층이 정확히 한 가지만 한다.

## 1. 층 구조

```
div[flex:1.03417 1 0px; min-width:280px; min-height:100px; z-index:1]     ← ① 타일 슬롯(기하)
└ div.tiles-shell[grid; rows:minmax(0,1fr); cols:minmax(0,1fr)]           ← ② 크기 함정 방어
  └ div[data-tile-host="diff"][display:contents]                          ← ③ 호스트(레이아웃 무개입)
    └ div[display:contents]
      └ div[data-cds=Surface][data-surface=panel][data-pane-root]         ← ④ 패널 표면 + 변수 스코프
          [data-perf-region=side_pane][data-perf-screen=diff]
        ├ header.h-[32px]                                                 ← ⑤ 드래그 2종 + 조작
        └ div.flex-1.min-h-0.overflow-hidden.rounded-b-[inherit]          ← ⑥ 본문
```

### ① 슬롯 크기는 `flex-grow` 비율이다

```
flex: 1.03417 1 0px;  min-width: 280px;  min-height: 100px;
```

basis 가 `0` 이므로 **grow 계수가 곧 지분**이다. 드래그 리사이즈는 grow 값만 조정하면 되고, 창 크기가
바뀌어도 비율이 그대로 보존된다 — px basis 를 쓰면 창 리사이즈마다 재계산해야 한다. 소수점 다섯 자리
(`1.03417`)는 이 값이 사람이 고른 프리셋이 아니라 **드래그 픽셀을 비율로 환산한 결과**임을 말한다.

`min-width`/`min-height` 는 바닥이고, `overflow: visible` 이라 리사이즈 핸들·그림자가 슬롯 밖으로
나갈 수 있다.

### ② `tiles-shell` — flex `min-height:auto` 함정을 구조로 없앤다

```css
display: grid;
grid-template-rows: minmax(0, 1fr);
grid-template-columns: minmax(0, 1fr);
```

단일 셀 그리드다. `minmax(0, …)` 덕에 트랙이 0까지 줄 수 있어, 자식이 아무리 커도 내부
`overflow-y-auto` 가 실제로 동작한다. flex 로 짰다면 조상 체인 전체에 `min-h-0` 을 발라야 하고 한
곳만 빠뜨려도 스크롤이 죽는다 — **관례로 지키던 것을 껍데기 한 겹으로 옮겼다.**

### ③ 호스트 두 겹이 `display: contents`

`data-tile-host="diff"` 와 그 자식이 모두 `contents` 라, 패널이 그리드 셀의 **직계 자식처럼** 늘어난다.
"어떤 타일을 여기 꽂을 것인가" 를 결정하는 호스트 컴포넌트가 레이아웃에 전혀 개입하지 않는다.
(컴포저 상단 행의 `contents` 와 같은 기법이다 — 이 코드베이스의 반복 어휘로 보인다.)

### ④ 패널 루트가 색 변수를 재기준(rebase)한다

```css
--cds-page-bg: var(--cds-surface-2);
--cds-focus-shadow:        inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-accent), 0 0 6px 1px var(--cds-bg-accent);
--cds-focus-shadow-danger: inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-danger), 0 0 6px 1px var(--cds-bg-danger);
--code-theme-light-bg: #fcfcfb;
--code-theme-dark-bg:  #111111;
```

포커스 링은 3겹이다 — **페이지 배경색 1px 인셋** + 강조색 1px + 글로우. 인셋 겹의 색이 *실제로 뒤에
있는 표면* 과 같아야 링이 표면에서 떠 보인다. 패널마다 배경이 다르므로, 루트에서 `--cds-page-bg` 를
그 패널의 표면으로 재정의하면 **내부의 모든 포커스 가능 요소가 자동으로 맞는 링을 얻는다.**

이게 이 패널에서 가장 이식 가치가 큰 기법이다. 컴포넌트가 "내가 어느 표면 위에 있는지" 를 알 필요가
없어진다 — 알아야 한다면 prop 으로 표면 종류를 내려보내는 배선이 트리 전체에 생긴다.
`--code-theme-*-bg` 도 같은 방식으로 코드 표면 색을 패널 스코프에 주입한다.

`data-perf-region="side_pane"` · `data-perf-screen="diff"` 는 렌더 성능 계측 마커다 — 계측 축이 DOM 에
선언으로 남아 있다.

### ⑤ 헤더(32px) — 드래그가 두 종류다

| | 구현 | 목적 |
|---|---|---|
| **창 드래그** | `div.draggable.absolute.inset-0.-z-[1][aria-hidden]` | 헤더 전면을 덮는 층. 조작 요소는 `relative z-[1]` + `draggable-none` |
| **타일 재배치** | `button.tiles-drag-handle` 44×16, `top:0; left:50%; translateX(-50%)`, `cursor:move; touch-action:none` | 안에 32×3 알약 어포던스. `aria-label="이동"` + `aria-describedby="…-reorder-hint"` |

창 드래그를 **별도 층으로 분리한 것**이 요점이다. 버튼마다 `no-drag` 를 바르는 대신 드래그 층을 뒤
(`-z-[1]`)에 깔고 조작 요소를 앞으로 올려, "드래그 가능이 기본, 조작이 예외" 를 뒤집었다. Electron
프레임리스 창에서 반복되는 "헤더 버튼이 안 눌린다" 를 구조로 막는다.

재배치 핸들이 `<div>` 가 아니라 **`<button>`** 인 것도 의도적이다 — `touch-action:none` 으로 포인터
제스처를 잡으면서, 키보드 사용자에게는 `aria-describedby` 가 가리키는 안내문과 함께 포커스 가능한
조작으로 남는다.

헤더 나머지:

| 위치 | 요소 |
|---|---|
| 좌 | 파일트리 토글 (`aria-pressed=true`, `aria-label="파일 숨기기"`, `aria-keyshortcuts="Control+Shift+y"`) |
| 좌 | 비교 대상 — `main` `→` `claude/0205-…` (양쪽 `truncate`) |
| 우 | 패널 설정(`aria-haspopup=menu`) · 펼치기 · 닫기(`epitaxy-pane-close-control`) |

토글 버튼이 `aria-pressed` + `aria-keyshortcuts` 를 함께 갖는다 — 상태와 단축키가 DOM 에 선언돼 있어
단축키 안내를 별도 문서로 관리하지 않는다.

### ⑥ 본문 골격

```
div.flex.flex-col.flex-1.min-h-0.overflow-hidden.rounded-b-[inherit]
└ div[data-diff-pane-body][tabindex="-1"].h-full.select-text.outline-none
  └ div.flex.h-full.flex-col[style="contain: size layout"]
    └ div.flex.flex-1.min-h-0
      ├ div[width:240px].shrink-0.flex.flex-col.border-r     ← 트리 + 커밋
      └ div.flex-1.min-w-0.flex.flex-col                     ← 파일별 diff
```

| 장치 | 이유 |
|---|---|
| `rounded-b-[inherit]` | 부모 카드 반경을 물려받아 본문을 클리핑. 반경 값을 두 곳에 적지 않는다 |
| `tabindex="-1"` + `select-text` | 본문을 **프로그램적으로 포커스**해 키보드 네비게이션의 뿌리로 삼되 탭 순서엔 넣지 않는다 |
| `contain: size layout` | 이 서브트리의 레이아웃이 바깥에 영향을 주지 않음을 브라우저에 약속. 파일 수백 개가 접혔다 펴져도 조상 리플로우가 없다 |

## 2. 좌측 컬럼(240px) — 한 열을 위아래로 나눠 쓴다

위는 **파일트리**(`flex-1`, 스크롤), 아래는 **커밋 목록**(`shrink-0 border-t max-height:40%`).
*대상 선택(어느 파일)* 과 *범위 선택(어느 커밋)* 이 한 열에 세로로 놓인다.

### 파일트리 — 평탄 버튼 리스트 + 계산된 들여쓰기

중첩 `<ul>` 이 아니다. 형제 `<button>` 들이고 깊이는 인라인 스타일이다.

```
padding-left: 8px   → depth 0
padding-left: 20px  → depth 1     (= 8 + depth × 12)
padding-left: 32px  → depth 2
padding-left: 44px  → depth 3
```

평탄 구조라 가상 스크롤·키보드 상하 이동·검색 필터가 전부 배열 인덱스 하나로 끝난다. 트리 형태는
들여쓰기가 *그려줄 뿐* 이고 DOM 은 리스트다.

| 행 종류 | 표식 | 우측 |
|---|---|---|
| 디렉토리 | `aria-expanded` + chevron 아이콘 | — |
| 파일 | chevron 자리에 `span.w-3.shrink-0` **스페이서** | `+15` `-5` (`text-footnote`) |

**단일 자식 경로 압축**: `app/src/renderer/src/features/chat` 이 한 노드이고, 그 아래에 `components` ·
`lib` · `reducer` 가 온다. 중간에 자식이 하나뿐인 디렉토리를 접어 깊이를 줄인다 — 그렇지 않으면
`app` → `src` → `renderer` → `src` → `features` → `chat` 만으로 들여쓰기가 72px 를 먹는다.

> 사소한 불일치: 트리는 `-5`(ASCII 하이픈), 우측 diff 헤더는 `−5`(U+2212)를 쓴다. 같은 값을 두 표면이
> 다른 문자로 그린다.

### 커밋 목록

```
button[aria-pressed=false]  "All changes"
button[aria-pressed=true]   ├ span[title=<제목 전문>]  "feat(chat): 작업 타일의 진입점을 …"
                            └ span  "83a748e" · "daezaby" · "10m ago"
```

선택 상태를 `aria-pressed` 로 표현한다(라디오 그룹이 아니다). 제목은 `truncate` + `title` 속성에 전문,
메타 줄은 `sha · 작성자 · 상대시간` 이고 sha 만 `text-code`.

## 3. 우측 — 파일별 diff 리스트

파일 하나가 블록 하나다.

```
div[data-diff-file-path="app/src/renderer/src/features/chat/components/ChatTitleBar.tsx"]
└ button.epitaxy-panel-subheader.sticky.top-0.z-[4][aria-expanded=false][data-sticky]
  ├ span > svg.-rotate-90                    ← chevron (접힘 = -90°)
  ├ span  ChatTitleBar.tsx  +  흐린 디렉토리
  └ span  +15  −5   (tabular-nums)
```

| 장치 | 뜻 |
|---|---|
| `data-diff-file-path` | 트리 클릭 → 해당 블록 스크롤의 **앵커**. 좌우 두 영역을 잇는 유일한 키 |
| `sticky top-0 z-[4]` | 파일 헤더가 스크롤 중 상단에 고정 — 긴 diff 에서 "지금 어느 파일인가" 가 유지된다 |
| chevron `-rotate-90` | 회전 하나로 접힘/펼침. 아이콘 두 벌이 필요 없다 |
| 디렉토리 2-span 트렁케이션 | `app/src/renderer/src/features/chat/` + `components`, `aria-label` 에 전체 경로 |

디렉토리 표기가 **컴포저 브랜치 칩과 정확히 같은 2-span 기법**을 쓴다(01 문서 §2③). 마지막 세그먼트가
꼬리로 보존되므로 `.../chat/components` 와 `.../chat/lib` 이 폭이 좁아져도 구분된다.

## 4. 캡처가 보여주지 않은 것

- diff **본문** — 전 파일이 접힌 상태라 hunk·줄 마크업이 없다. (cowork 캡처의 `data-diff-type` ·
  `data-diff-line` 이 같은 계열일 가능성이 있으나 확인되지 않았다.)
- `scroll-fade-y` · `status-dot` · `epitaxy-panel-subheader` · `cds-btn-squish` 의 CSS 구현.
- 파일트리 가상 스크롤 여부 — 13개뿐이라 판별 불가.
- 리사이즈 핸들 자체(슬롯 바깥에 있어 캡처 범위 밖).
