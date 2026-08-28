# Orca 대조 — 버튼 구성 관점

Orca 는 이미 같은 계보의 스킨이다(`shared/ui/Button` 주석이 "Epitaxy (Claude Code desktop) button
primitive" 를 명시한다). 그래서 관심은 *버튼이 어떻게 생겼는가* 가 아니라
**어떤 자리에 · 어떤 순서로 · 어떤 위계로 놓였는가** 다.

## 1. 이미 일치하는 규약

새로 할 일이 없는 것부터 가른다.

| 규약 | Orca 근거 |
|---|---|
| 닫기 = 마지막 · ghost 아이콘 전용 | `RightPanelTile` 헤더 — `ml-auto` 뒤 `[headerActions][닫기]`, `Button iconOnly leadingIcon="x"` |
| 아이콘 전용 조작을 우측에 묶기 | `ChatTitleBar` — `ml-auto flex gap-1` 로 [고정][복사][kebab] |
| 토글 상태를 `aria-pressed` 로 | `ChatTitleBar` 고정 버튼(`pressed` + `aria-pressed`), kebab(`pressed={open}`) |
| 접기를 `aria-expanded` 전폭 행으로 | `TaskTileSections` — `w-full … text-left` + `aria-expanded` |
| 이름 규약 `title` + `aria-label` 병행 | 위 세 버튼 전부 |
| 메뉴 항목의 체크 상태 | 타일 메뉴 — `role="menuitemcheckbox"` + `aria-checked` |

## 2. 어긋나는 것

### ① 컴포저 행에 **조작 구역이 없다**

| | Claude Code | Orca `CwdPanel` |
|---|---|---|
| 좌(식별) | 상태 · PR · 저장소 · 브랜치 | 작업 경로 · 브랜치 · 참조 경로… |
| 우(조작) | **diff · CI · 닫기** | **없음** |
| 그 외 | — | `＋`(참조 경로 추가)가 식별 칩 **사이에** 섞여 있다 |

Orca 의 `＋` 는 식별 칩과 같은 줄·같은 외형(`chipSurface('outlined')`)이라 "이 행이 무엇인가" 와
"이 행으로 무엇을 하는가" 가 구분되지 않는다. Claude Code 는 그 둘을 행의 좌/우로 갈랐다.

### ② 채움으로 위계를 만들 수단이 없다

`chipSurface` 의 두 변종 `flat` · `outlined` 는 **둘 다 `bg-transparent`** 다. 테두리 유무만 다르다.
즉 컴포저 행에서 "누르면 새 표면이 열린다" 를 나타낼 방법이 없다 — Claude Code 가 diff·CI 에만
채움을 준 그 축이 Orca 에는 존재하지 않는다.

### ③ 축소 우선순위 대신 줄바꿈으로 도피한다

`CwdPanel` 은 `flex-wrap` 이다. 폭이 줄면 두 줄이 되어 **컴포저 높이가 뛴다.**
Claude Code 는 줄바꿈 없이 shrink 계수로 서열을 매겼다.

```
상태  #397   orca-skin      브랜치            diff  CI  ×
shrink-0     shrink(≤160)   shrink-[9999]     shrink-0
```

DOM 순서 = 축소 순서라 **잘림이 항상 브랜치 한 곳에서만** 일어나고, 여러 행이 쌓여도 앞쪽 자리가
세로로 정렬된다. Orca 는 칩 순서와 축소 성질이 연결돼 있지 않다.

### ④ 패널 헤더에 영역 토글이 없다

| | Claude Code diff 패널 헤더 | Orca `RightPanelTile` 헤더 |
|---|---|---|
| 좌 | **파일트리 토글**(`aria-pressed` + `aria-keyshortcuts`) + 비교 대상 표시 | 라벨 또는 `headerContent` |
| 중앙 | **이동 핸들** | — |
| 우 | 설정(menu) · 펼치기 · 닫기 | `headerActions` · 닫기 |

세 자리가 비어 있다 — **패널 내부 영역을 접는 토글**, **타일 재배치 핸들**, **크기 전환(펼치기)**.
우측 구성(액션 → 닫기)은 이미 같은 형태라 자리를 늘리는 문제이지 구조를 바꾸는 문제가 아니다.

### ⑤ 단축키가 DOM 에 선언되지 않는다

`aria-keyshortcuts` 사용처가 없다. 단축키와 버튼이 분리돼 있으면 툴팁·도움말이 실제 바인딩과
어긋나도 아무것도 잡지 못한다.

### ⑥ 툴팁 규약이 다르다

Claude Code 는 거의 모든 조작에 툴팁 트리거를 붙인다(컴포저 행 6/7, 패널 헤더 5/5).
Orca 는 네이티브 `title` 속성을 쓴다 — 지연·스타일·터치 동작이 다르고 테마를 따르지 않는다.
**규약 자체를 정할 문제**이지 개별 버튼의 문제가 아니다.

## 3. 적용 후보

결정이 아니라 후보다. 채택은 별도 handoff 의 몫이다.

| # | 후보 | 크기 | 비고 |
|---|---|---|---|
| A | `CwdPanel` 을 **[식별] ─ [조작]** 두 구역으로 가르고 `＋` 를 우측으로 | 작다 | 버튼 재배치 + shrink 서열. 컴포넌트 신설 없음 |
| B | `chipSurface` 에 **채움 변종** 추가 | 작다 | "새 표면이 열린다" 를 나타낼 축이 생긴다. `Button` 의 `contained` 와 톤을 맞춘다 |
| C | `RightPanelTile` 헤더 좌측에 **영역 토글 슬롯** | 중간 | `headerActions`(우측)와 대칭인 좌측 슬롯. `aria-pressed` 규약은 이미 있다 |
| D | `aria-keyshortcuts` 규약 도입 | 작다 | 단축키를 가진 버튼부터 |
| E | 툴팁 규약 통일(`title` → 공용 툴팁) | 중간 | `shared/ui` 신설. 전 표면에 걸린다 |
| F | 타일 **이동 핸들** | 중간 | 재배치 상태(`rightPanelTiles` 열 구조)까지 건드린다 |
| G | diff 패널 | 크다 | 버튼 구성은 캡처가 충분히 보여주지만 **먹일 데이터가 없다** — IPC 계약이 선행한다 |

**A·B 가 한 쌍이다.** 구역을 가르기만 하고 위계 수단이 없으면 우측 조작이 좌측 식별과 똑같아 보인다.

**G 의 PR·CI 는 성격이 다르다.** GitHub 네트워크 접근이 필요해 폐쇄망 확장 정책
([`docs/guides/`](../../../guides/))과 정면으로 걸린다 — 버튼을 어디 둘지가 아니라 제품 결정이
먼저인 항목이다.

## 4. 이 캡처로 못 가른 것

버튼 구성을 설계할 때 **여기서 답을 찾으면 안 되는** 것들이다.

- 메뉴 내용 전부 — 저장소 · 브랜치 · 패널 설정 메뉴가 모두 `aria-expanded="false"` 로 닫혀 있다.
  **어떤 항목이 들어가는지 하나도 모른다.**
- CI 팝오버(`aria-haspopup="dialog"`)의 내용과 그 안의 버튼들.
- `펼치기` 버튼이 무엇을 하는지 — 타일 최대화인지 별도 창인지.
- 비활성/로딩 상태의 버튼 형태(`disabled` · `aria-busy` 사례가 캡처에 없다).
- 여러 행(저장소 여럿)일 때 행 사이의 조작 차이 — 1행만 캡처했다.
- 트리·커밋 목록의 키보드 이동 규약(방향키? Tab?).
- 상태 전이와 애니메이션 전부.
