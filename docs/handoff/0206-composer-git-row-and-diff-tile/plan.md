# Plan — 0206-composer-git-row-and-diff-tile

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0206-composer-git-row-and-diff-tile` |
| 작성자 | Claude Code |
| 일자 | 2026-08-28 |
| 매핑 | — |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 세션이 시작되면 작업 트리의 git 상태가 화면에서 사라진다 — 브랜치 칩은 랜딩 전용(`CwdPanel.tsx:17`)이고 변경량은 어디에도 없다.
- 완료 후 달라지는 것: 세션 중 컴포저 위에 `저장소 · 브랜치 · 변경량` 한 줄이 서고, 변경량 버튼이 우측 `diff` 타일을 연다.
- 성공을 사용자 관점 한 문장으로: **턴이 끝날 때마다 "어느 저장소의 어느 브랜치에서 얼마나 바꿨는지" 가 컴포저 위에 갱신된다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "조사한 내용을 바탕으로 컴포저 스택에 git 정보를 출력한다" | 세션 턴 (2026-08-28) |
| 명시 요구 | "디자인룰 및 테마는 orca지침을 따른다" | 같은 턴 |
| 명시 요구 | "버튼요소 및 배치는 조사한 내용을 따르며 **기능 제공을 못하는 것이 있다면 배선을 하지 읺고 목업만 남겨둔다**" | 같은 턴 |
| 명시 요구 | "구현 목표: 컴포저 스택, diff패널" | 같은 턴 |
| 명시 요구 | "별도행이다. 랜딩에는 보이지 읺는다. 세션이 시작되었을때는 git 프로젝트에 한하여 보인다. **Git init이 안되어잇엇다면 보이지 않다가 작업 중간에 셋업이되면 노출돼야 한다**" | AskUserQuestion 1차 |
| 명시 요구 | "안 그린다 — 행은 4자리" (PR·CI 자리) | AskUserQuestion 2차 |
| 명시 요구 | "gitStatus 에 루트 한 필드 추가" · "3영역 골격 전부" · "reserved1 을 diff 로 대체" · "닫기 버튼을 두지 않는다" | AskUserQuestion 1·2차 |
| 추론 의도 | 더미로 채운 타일에는 **예시임을 알리는 문구**가 필요하다 — 2차 답변의 "가짜 값 금지"와 "3영역을 더미로 채운다"를 함께 만족시키는 유일한 형태 | 설계자 판단 (D-012) |
| 추론 의도 | 조사 문서의 버튼 배치는 [`docs/etc/study/epitaxy/`](../../etc/study/epitaxy/README.md) 가 정본이다 | 같은 세션 산출 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | git 행은 **CwdPanel 과 별도 행**이고 랜딩에는 뜨지 않는다 | 사용자: "별도행이다. 랜딩에는 보이지 읺는다" | 사용자 턴 | ACTIVE | — |
| D-002 | 노출 조건은 **세션 시작됨 ∧ git 저장소**다 | 사용자: "세션이 시작되었을때는 git 프로젝트에 한하여 보인다" | 사용자 턴 | ACTIVE | — |
| D-003 | 세션 중간에 `git init` 되면 **노출돼야 한다** — 재조회가 필요하다 | 사용자: "Git init이 안되어잇엇다면 보이지 않다가 작업 중간에 셋업이되면 노출돼야 한다" | 사용자 턴 | ACTIVE | — |
| D-004 | 재조회 시점은 **cwd 변경 + 턴 종료(busy true→false)** 둘이다 | 에이전트가 도구로 `git init`·커밋하는 것이 주 시나리오라 턴 경계가 가장 정확하고 싸다. 변경량 갱신도 같은 시점을 필요로 한다 | 설계자 판단 | ACTIVE | — |
| D-005 | 행은 **`[저장소] [브랜치] ─ [+N −M]` 3자리**다. PR·CI·상태 글리프·닫기를 두지 않는다 | 사용자: "안 그린다 — 행은 4자리"(닫기 포함 셈) + "닫기 버튼을 두지 않는다" | 사용자 턴 | ACTIVE | — |
| D-006 | 저장소·브랜치는 **표시 전용**이고 버튼은 변경량 하나다 | 저장소 전환 개념이 Orca 에 없고 세션 시작 후 브랜치 전환은 D-009(0201)이 이미 닫았다. 요구 동사도 "출력한다" 다 | 설계자 판단 + 0201 D-009 | ACTIVE | — |
| D-007 | 변경량 버튼의 동작은 **`diff` 타일 토글** 하나다 | 조사 규약 "채움은 새 표면이 열릴 때만"과 정확히 맞고, 배선이 이미 있다(`toggleRightPanelTile`) | 설계자 판단 + 조사 | ACTIVE | — |
| D-008 | `GitStatus` 에 **`root: string \| null` 한 필드**를 더한다 | 사용자 선택. cwd 가 하위 폴더면 basename 이 저장소 이름이 아니다 — `~/proj/orca-skin/app` → `app` | 사용자 턴 | ACTIVE | — |
| D-009 | 우측 패널 타일 `reserved1` 을 **`diff` 로 대체**한다 — 4종 유지 | 사용자 선택. 0204 가 `reserved2`→`task` 로 한 것과 같은 형태 | 사용자 턴 | ACTIVE | 0204 D-021 의 4종을 유지 |
| D-010 | diff 타일은 **3영역 골격 전부**를 더미로 채운다 — 좌측 트리 · 좌측 커밋 목록 · 우측 파일 헤더 | 사용자 선택. 조사한 배치·들여쓰기·선택 상태를 실물로 확인하는 것이 목적 | 사용자 턴 | ACTIVE | — |
| D-011 | 더미 위의 **순수 UI 상호작용은 배선한다** — 파일트리 토글 · 디렉토리 접기 · 커밋 선택 | 데이터 채널이 필요 없고, 배선하지 않으면 D-010 의 목적(선택 상태 확인)을 달성하지 못한다. "기능 제공을 못하는 것" 에 해당하지 않는다 | 설계자 판단 | ACTIVE | — |
| D-012 | diff 타일 본문 최상단에 **예시임을 알리는 문구**를 둔다 | 2차 답변의 "가짜 값 금지"와 D-010 의 "더미로 채운다"가 양립하는 형태는 이것 하나다 — 더미가 실제 변경으로 읽히면 안 된다 | 설계자 판단 | ACTIVE | — |
| D-013 | diff 타일 헤더에 **설정 메뉴 · 펼치기 · 이동 핸들을 두지 않는다** | 셋 다 Orca 에 대응 동작이 없다. 컴포저 행에 적용한 "죽은 버튼을 두지 않는다"(D-005)를 같은 이유로 헤더에도 적용한다 | 설계자 판단 | ACTIVE | — |
| D-014 | 비교 대상 표시는 **현재 브랜치만**이다 — `main →` 을 붙이지 않는다 | base 브랜치를 알 채널이 없다. 조사의 `main → …` 을 그대로 옮기면 `main` 이 가짜 값이 된다 | 설계자 판단 | ACTIVE | — |
| D-015 | `aria-keyshortcuts` 를 쓰지 않는다 | 단축키를 실제로 배선하지 않으면 그 속성은 거짓 선언이다 | 설계자 판단 | ACTIVE | — |
| D-016 | git 색은 **`--color-git-added` · `--color-git-removed` 신설**이고 두 테마 스코프 전부에 값을 채운다 | `renderer/AGENTS.md §스타일` 이 요구한다. `--color-good`·`--color-bad` 는 dark 스코프에 재정의가 없어(`tokens.css:177-200`) 어두운 배경에서 검증되지 않았다 | 저장소 규칙 + 실측 | ACTIVE | — |
| D-017 | 우측 **파일 항목은 접었다 펼 수 있다** — 기본 접힘(`aria-expanded="false"`) | 조사 캡처가 그 상태다(study 02 §3). D-011 과 같은 부류의 순수 UI 상호작용이라 데이터 채널이 필요 없다 | 사용자 지적 (2026-08-28) | ACTIVE | D-011 을 넓힌다 |
| D-018 | 펼치면 **diff 본문이 실제로 그려진다** — 더미 old/new 문자열 쌍을 기존 렌더러에 먹인다 | "diff 패널" 이 diff 를 그리지 않으면 배치 확인이라는 D-010 의 목적을 절반만 채운다. `diff@^9.0.0` 과 렌더러가 이미 있어 새 IPC·새 의존성이 없다 | 사용자 지적 (2026-08-28) | ACTIVE | — |
| D-019 | 줄 파생·줄 렌더는 **한 곳이 소유한다** — `buildDiffLines` 를 `lib/diffLines.ts` 로, `DiffTable` 을 `components/DiffTable.tsx` 로 올린다 | 소비자가 둘이 되는데 규칙이 두 벌이면 도구 카드와 타일의 +/− 표현이 갈라진다. 현재 둘 다 `DiffBody.tsx` 모듈 로컬이라 재사용할 수 없다 | 설계자 판단 + 실측 | ACTIVE | — |
| D-S01 | **승계** — 0205 D-008(`reserved1` 의 지위는 바꾸지 않는다)은 이번 D-009 로 대체된다 | `reserved1` 이 `diff` 가 되면 메뉴에 오르고 활성화된다. 그 결정이 지키려던 3타일 기하 회귀는 `diff` 로 그대로 재현된다 | 이번 턴 | SUPERSEDED | 0205 D-008 → 본 D-009 |

### 갱신 메모

- 신규 결정: D-001 ~ D-019. 이번 handoff 의 첫 턴이라 SUPERSEDED 는 승계 1건(D-S01)뿐이다.
- **설계 2턴 갱신(2026-08-28)**: 사용자 지적으로 **D-017·D-018·D-019 추가**. 1턴 설계는 우측을 *파일 헤더 목록*으로만 두어 접기·펼치기와 diff 본문이 **둘 다 빠져 있었다** — "diff 패널" 이 diff 를 그리지 않는 상태였다. D-011 의 상호작용 목록도 셋뿐이라 파일 항목 접기가 그 안에 없었다. 기존 결정 16건은 **문장 그대로 유지**된다 — 바뀐 것은 우측 영역의 깊이이지 노출 조건·행 구성·목업 표현 원칙이 아니다.
- 승계되는 타 handoff ACTIVE 결정: **0201 D-002**(저장소가 아니면 그리지 않는다) · **0201 D-009**(작업 컨텍스트 행은 랜딩에만) · **0201 D-011**(칩 외형은 `chipSurface` 소유) · **0204 D-021**(타일 4종). 넷 다 §16 에서 본문 문장과 대조한다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. 확인한 쌍 — D-001↔AT-02(랜딩 음성) · D-002↔AT-01·AT-03 · D-003·D-004↔AT-04 · D-005↔AT-07(PR·CI·닫기 음성 + 양성 짝) · D-006↔AT-01(저장소·브랜치가 `button` 이 아니다) · D-007↔AT-05 · D-008↔AT-09 · D-009↔AT-10 · D-010↔AT-11 · D-011↔AT-14·AT-15·AT-16 · D-012↔AT-12 · D-013↔AT-13 · D-014↔AT-13 의 양성 짝 · D-016↔EP-04 · **D-017↔AT-17**(기본 접힘 + 펼침 양성 짝) · **D-018↔AT-18** · **D-019↔AT-19·EP-07**. **반대를 요구하는 AC 0건.**
- **D-018 ↔ D-012 비충돌**: 더미 diff 본문이 실제 변경으로 읽히는 위험은 D-012 의 예시 문구가 **본문 최상단**에서 이미 막는다 — 두 결정이 같은 축의 앞뒤다.
- **D-017 ↔ D-013 비충돌**: 헤더에서 뺀 셋(설정·펼치기·이동)은 *타일 자체*를 다루는 조작이고, D-017 은 *내용 항목*의 접기다 — 서로 다른 계층이다.
- 0201 D-002 와 사용자의 "목업만 남겨둔다" 는 **충돌하지 않는다** — 2차 질의에서 사용자가 컴포저 행의 목업 자리를 "안 그린다" 로 좁혔다(D-005). 목업은 diff 타일 안에만 산다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 세션 시작 후 git 상태 표면이 0개다 — `showLandingCwdPanel` 이 false 인 `ChatTile` 경로에 `BranchChip` 이 도달하지 않는다(`Composer.tsx:281`) |
| 이미 기존 코드가 충족하는가 | 아니오 | `BranchChip` 은 랜딩 전용이고 변경량은 `dirty` 를 전환 모달에서만 쓴다(`branchChipState.ts:37`) |
| 더 작은 해법이 있는가 | 아니오 | `CwdPanel` 확장은 D-001 이 배제했다. 노출 조건이 반대(랜딩 vs 세션)라 한 컴포넌트로 접을 수 없다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 — 1건 정정 | 조사 문서가 diff 수치를 "PR 변경량"으로 읽었으나 Orca 에서 낼 수 있는 값은 **작업 트리의 미커밋 변경**(`git diff HEAD --shortstat`)이다. 같은 자리·다른 의미다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 1건 대체 | 0205 D-008 → D-S01. 나머지 넷은 §16 에서 유지 판정 |

- 사용자에게 올릴 결정: 없음 — 5건을 2회 질의로 닫았다.
- 코드 조사로 닫은 사실: 렌더 하네스가 이미 있다(`rightPanelTiles.render.test.ts:14` — `react-dom/server`, 신규 의존성 0). 0201 AC16 이 ⚠️ 로 남긴 하네스 부재는 0204 가 해소했다.

## 5. 동작 / 사용자 흐름

```text
[세션 시작(첫 전송)]
  → gitStatus(cwd) 조회
  → isRepo=true  → 컴포저 위에 [저장소][브랜치][+N −M] 행이 선다
  ↘ isRepo=false → 행 없음 (자리도 잡지 않는다)

[턴 종료(busy true→false)]
  → gitStatus(cwd) 재조회
  → 그 사이 git init 되었으면 행이 나타난다
  → 변경량이 갱신된다

[변경량 버튼 클릭]
  → diff 타일 토글 (aria-pressed 왕복)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 랜딩 | 조회하지 않는다 | 행 없음. 기존 `CwdPanel` 만 |
| 세션 시작 · `isRepo=false` | `gitStatus` 가 `{isRepo:false, root:null}` | 행 없음 |
| 세션 시작 · `isRepo=true` | `root`·`branch`·`dirty` 를 읽는다 | `orca-skin` `main` `+0 −0` |
| 턴 종료 | 재조회 | 값 갱신 또는 행 등장 |
| `detached HEAD` | `branch=null, detached=true` | 브랜치 자리가 `분리 헤드` |
| `dirty=null`(커밋 없음 ∨ 깨끗함) | 0/0 으로 접는다 | `+0 −0` |
| cwd 를 빠르게 바꿈 | 늦게 온 응답을 cwd 태그로 버린다 | 화면이 옛 저장소로 되돌아가지 않는다 |
| 조회 실패 | `handle` 의 `fallback: NOT_REPO` | 행 없음 (오류 표면 없음) |
| diff 타일 · 파일 항목 초기 | 접힘(`aria-expanded="false"`) | 파일명 · 흐린 경로 · `+N −M` 만 |
| diff 타일 · 파일 항목 펼침 | 그 항목의 더미 old/new 를 `buildDiffLines` 에 먹인다 | 줄번호 거터 · `+`/`-` 거터 · 본문 3열 |

### 파생 UX / 엣지케이스

- loading: 첫 응답 전에는 행이 없다 — 껍데기를 깜빡이지 않는다(0201 D-002 와 같은 이유).
- empty: `+0 −0` 은 빈 상태가 아니라 정상 값이다. diff 타일은 열 수 있다.
- error: 조회 실패와 저장소 아님이 화면에서 같다 — `fallback` 이 이미 그렇게 접는다(`handlers/git.ts:25`).
- concurrency: 세션이 여럿이어도 행 상태는 컴포넌트 로컬이고 cwd 로 태깅된다.
- a11y: 변경량은 `sr-only` 문장 + `aria-hidden` 색 span(조사 규약). 버튼은 `aria-pressed`.
- theme: 새 색 토큰 2개를 `:root` 와 `[data-theme='dark']` 양쪽에 채운다(D-016).

## 6. 범위 / 비범위

- **범위**: 컴포저 git 행 신설 · `GitStatus.root` 추가 · `reserved1`→`diff` 타일 교체 · diff 타일 3영역 더미 골격 · **파일 항목 접기/펼치기와 더미 diff 본문 렌더** · 줄 파생·줄 렌더 SSOT 승격 · 색 토큰 2종.
- **비범위**: PR·CI 표면(GitHub 접근 필요 — 폐쇄망 정책과 걸린다) · **실제** 파일 내용·patch·커밋 목록 IPC(더미만 그린다) · 세션 중 브랜치 전환 · 창 포커스 복귀 재조회 · 다중 저장소 행 스택 · worktree(0201 D-001).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| diff 데이터 IPC 3채널(numstat·log·본문) | 아니오 — 계약 신설이라 지금 형태를 잠글 이유가 없다 | 후속 handoff |
| 창 포커스 재조회 | 아니오 | 후속. 턴 종료만으로 D-003 이 닫힌다 |
| 다중 저장소 스택 | 아니오 — 세션당 cwd 가 하나다 | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 세션 중 git 저장소면 행이 서고 `저장소 → 브랜치 → 변경량` 순서를 갖는다 | 렌더 — 세 문자열의 **출현 인덱스가 그 순서**이고 저장소·브랜치는 `<button` 안에 없다 | `ChatTile` → `Composer` → `GitRow` |
| R-02 | AT-02 / AC2 | 랜딩에서는 행이 없다 | 순수 — `gitRowView(false, '/r', repo)` → `{visible:false}`. 양성 짝으로 `true` 케이스가 visible | `NewChatLandingPage`/`ProjectLandingPage` 가 prop 을 넘기지 않는다 |
| R-03 | AT-03 / AC3 | git 저장소가 아니면 행이 없다 | 순수 — `isRepo:false` → `{visible:false}` | `handle` fallback `NOT_REPO` |
| R-04 | AT-04 / AC4 | 턴이 끝나면 재조회한다 | 순수 — `shouldRefetchGitStatus(true,false)===true`, `(false,false)`·`(false,true)`·`(true,true)` 는 false | `useGitRowStatus` effect 가 `sessionBusy` 전이를 본다 |
| R-05 | AT-05 / AC5 | 변경량 버튼이 diff 타일을 연다·닫는다 | reducer — `TOGGLE_RIGHT_PANEL_TILE{id:'diff'}` 2회로 `columnsContain` 이 true→false 왕복 | 버튼 `onClick` → `chatActions.toggleRightPanelTile('diff')` |
| R-06 | AT-06 / AC6 | 변경 없음·커밋 없음이면 `+0 −0` | 순수 — `dirty:null` → `{added:0,removed:0}`. 양성 짝으로 `{insertions:7,deletions:2}` → `7/2` | 같은 뷰모델 |
| R-07 | AT-07 / AC7 | 행에 PR·CI·닫기가 없다 | 렌더 — 출력에 `haspopup="dialog"`·`aria-label="닫기"`·`<a ` 가 0건. **양성 짝**: 같은 출력에 변경량 버튼 1개가 있다 | 같은 컴포넌트 |
| R-08 | AT-08 / AC8 | detached HEAD 면 브랜치 자리가 분리 상태를 말한다 | 렌더 — `branch:null, detached:true` 출력에 `chat.gitRow.detached` 해석 문자열이 있다 | `gitRowView` → `GitRow` |
| R-09 | AT-09 / AC9 | 저장소 이름은 **git 루트**의 마지막 세그먼트다 | 순수 — `root:'/home/u/proj/orca-skin'`, `cwd:'/home/u/proj/orca-skin/app'` → `repo:'orca-skin'`. 구분자 `\` 케이스 포함 | `git rev-parse --show-toplevel` → `GitStatus.root` |
| R-10 | AT-10 / AC10 | 타일 메뉴가 `계획 · 백그라운드 작업 · diff` 3항목이다 | 순수 — `visibleRightPanelTileDefinitions.map(id)` 가 `['plan','subagent','diff']` 와 정확히 같다(음성 `task`·`reserved1` + 양성 3종) | `ChatTitleBar` `VISIBLE_TILE_REGISTRY` |
| R-11 | AT-11 / AC11 | diff 타일이 좌측 트리 · 좌측 커밋 · 우측 파일 헤더 3영역을 **그 배치로** 갖는다 | 렌더 — 세 영역 마커의 출현 인덱스가 `트리 < 커밋 < 파일헤더` 이고, 트리·커밋이 같은 좌측 컨테이너 안에 있다 | `tileRegistry.contentById.diff` |
| R-12 | AT-12 / AC12 | diff 타일이 예시임을 알리는 문구를 갖는다 | 렌더 — 본문 출력에 `chat.rightpanel.diffMockNotice` 해석 문자열이 있다 | 같은 컴포넌트 |
| R-13 | AT-13 / AC13 | diff 타일 헤더에 설정·펼치기·이동 핸들이 없다 | 렌더 — 헤더 출력에 `aria-haspopup="menu"`·`펼치기`·`tiles-drag-handle` 0건. **양성 짝**: 파일 토글 버튼 1개와 현재 브랜치 문자열이 있다 | `tileRegistry.headerContentById.diff` |
| R-14 | AT-14 / AC14 | 파일 토글이 좌측 컬럼을 감추고 되돌린다 | reducer — `TOGGLE_DIFF_FILES` 2회로 `diffFilesVisible` 왕복. 렌더 — `false` 면 트리 마커 0건, `true` 면 1건 | 헤더 버튼 → `chatActions.toggleDiffFiles()` |
| R-15 | AT-15 / AC15 | 커밋 목록에서 정확히 하나만 선택 상태다 | 렌더 — `aria-pressed="true"` 가 1건, `"false"` 가 나머지 | `DiffCommitList` props |
| R-16 | AT-16 / AC16 | 디렉토리를 접으면 그 하위 행이 사라진다 | 순수 — `visibleTreeRows(MOCK_TREE, new Set(['docs']))` 가 `docs/` 하위를 0건으로 만들고 형제 최상위는 남긴다 | `DiffFileTree` 가 같은 함수를 쓴다 |
| R-17 | AT-17 / AC17 | 파일 항목이 **기본 접힘**이고 펼치면 본문이 나온다 | 렌더 — `expanded:[]` 출력에 `<table` 0건이고 헤더 버튼이 전부 `aria-expanded="false"`. **양성 짝**: `expanded:['<경로>']` 출력에 `<table` 1건 + 그 항목만 `"true"` | 헤더 버튼 → 로컬 `expanded` 집합 → `DiffFileHeaders` |
| R-18 | AT-18 / AC18 | 펼친 본문이 **추가·삭제·유지 줄을 구분해** 그린다 | 순수 — `buildDiffLines` 가 세 종류를 낸다. 렌더 — 펼친 출력에 `+` 거터와 `-` 거터가 각 1건 이상 | `diffTileMock` old/new → `buildDiffLines` → `DiffTable` |
| R-19 | AT-19 / AC19 | 줄 파생·줄 렌더의 소비자가 둘이고 **같은 모듈에서 온다** | `rg "lib/diffLines'"` 2건 · `rg "components/DiffTable'"` 2건. **회귀 양성 짝**: 도구 카드 diff(`registry.ts:75` 경로)가 그대로 렌더된다 | `DiffBody` · `DiffFileHeaders` 둘 다 승격 모듈을 import |

### AC 검증 주의사항

- 기존 테스트 재사용: `rightPanelTiles.test.ts:23`("정의 순서") · `chatReducer.plan.test.ts:78`(타일 활성화)는 실재하는 케이스이며 `reserved1`→`diff` 치환으로 회귀 짝이 된다.
- 렌더 단언 수단: `renderToStaticMarkup` + `createElement`(`rightPanelTiles.render.test.ts:13-14`). **props-only View** 만 직접 렌더한다 — store 연결 컴포넌트는 SSR 스냅샷을 받아 시드가 반영되지 않는다(같은 파일 주석).
- 순서 기준: AT-01·AT-11 은 `html.indexOf(a) < html.indexOf(b)` 로 관측한다. **형제 자리를 맞바꾸면 실패**한다 — 존재만 단언하면 순서 회귀가 통과한다(SKILL §5).
- 음성 기준: AT-07·AT-10·AT-13 은 전부 **양성 짝을 함께 둔다**. 아무것도 그리지 않는 출력에서 음성만 참이 되는 것을 막는다.
- 총량/0건 분해: AT-07 의 `<a ` 0건은 **행 컴포넌트 출력 안에서만**이다 — 컴포저 전체가 아니다. AT-17 의 `<table` 0건도 `DiffFileHeaders` 출력 안에서만이다.
- 회귀 인용: AT-19 의 양성 짝은 **기존 도구 카드 경로**다(`registry.ts:75` — `kind:'diff'` 가 `FILE_EDIT_TOOLS` 에 매칭). D-019 의 모듈 승격이 그 경로를 깨지 않는지가 이 AC 의 절반이다.
- 사람 실기: 색 토큰의 두 테마 실측 1건(AC 아님, §19).

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V** — 상속할 명시적 V가 없다. 0201·0204·0205 는 Decision 축으로 승계하며 그 V를 상속하지 않는다.
- 기준 V 상속 근거: `none`
- 변경이 시작되는 수준: Baseline이라 해당 없음

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 ~ R-19 | R | §7 | NEW | — |
| AT-01 ~ AT-19 | AT | §7 | NEW | — |
| SD-01 | SD | §5 상태 전이표 · §13 — gitStatus 재조회 수명주기 | NEW | — |
| SD-02 | SD | §5 "cwd 를 빠르게 바꿈" 행 — 늦은 응답 방어 | NEW | 기법은 `branchChipState.ts:22` 재사용 |
| ST-01 | ST | AT-04 | NEW | — |
| ST-02 | ST | AT-01 의 cwd 태깅 전제 | NEW | — |
| AR-01 | AR | §10 EP-01 — `GitStatus` 계약에 `root` 추가 | NEW | — |
| AR-02 | AR | §10 EP-02·EP-03 — 타일 정의 교체 지점 | NEW | — |
| AR-03 | AR | §10 EP-05 — 노출 판정 SSOT 와 prop 배선 | NEW | — |
| AR-04 | AR | §10 EP-04 — 색 토큰 두 스코프 | NEW | — |
| IT-01 | IT | AT-09 | NEW | — |
| IT-02 | IT | AT-10 · AT-11 | NEW | — |
| IT-03 | IT | AT-02 · AT-05 | NEW | — |
| MD-01 | MD | §11 `gitRowState.ts` — 행 뷰모델 | NEW | — |
| MD-02 | MD | §11 `gitRowState.ts` — 재조회 트리거 판정 | NEW | — |
| MD-03 | MD | §11 `diffTileTree.ts` — 가시 행 파생 | NEW | — |
| MD-04 | MD | §10 EP-07 · §11 — 줄 파생·줄 렌더 SSOT 승격 | NEW | 현재 `DiffBody.tsx:41,72` 모듈 로컬 |
| AR-05 | AR | §10 EP-07 — 승격 모듈의 소비자 둘 | NEW | — |
| UT-01 ~ UT-04 | UT | AT-01·03·06·08 / AT-04 / AT-16 / AT-18 | NEW | — |
| IT-04 | IT | AT-17 · AT-19 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `ChatTile` → `Composer(showGitRow)` → `GitRow` → DOM | 렌더 출력의 세 문자열 순서 인덱스 | required — 저장소·브랜치 span 을 맞바꾼다(형제 자리 계약이 다르다) | EP-05 (1) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 랜딩 page → `Composer` (prop 없음) | `gitRowView` 반환값 + 양성 짝 | not selected — 반환값을 직접 본다 | EP-05 (1) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `handle` fallback → `gitRowView` | 같은 함수 반환값 | not selected — 직접 oracle | EP-05 (1) |
| VP-04 | SD-01 ↔ ST-01 (AT-04) | REQUIRED | `sessionBusy` 전이 → effect → `gitApi.status` | `shouldRefetchGitStatus` 진리표 4행 | not selected — 순수 함수 전건 | EP-06 (2) |
| VP-05 | SD-02 ↔ ST-02 | REQUIRED | 빠른 cwd 변경 → 늦은 응답 → `statusForCwd` | 기존 케이스 재사용 + 새 cwd 케이스 | not selected — 직접 oracle | 0 — 기존 seam 재사용 |
| VP-06 | R-05 ↔ AT-05 | REQUIRED | 버튼 → `toggleRightPanelTile('diff')` → `rightPanelTiles` | reducer 왕복 단언 | not selected — 상태 직접 관측 | EP-02 (6) |
| VP-07 | R-06·R-08 ↔ AT-06·AT-08 | REQUIRED | `GitStatus` → `gitRowView` → DOM | 순수 반환값 + 렌더 문자열 | not selected — 직접 oracle | EP-05 (1) |
| VP-08 | AR-01 ↔ IT-01 (AT-09) | REQUIRED | `git rev-parse --show-toplevel` → `GitStatus.root` → `gitRowView` | basename 파생 결과 2케이스(`/`·`\`) | not selected — 값 직접 비교 | EP-01 (6) |
| VP-09 | AR-02 ↔ IT-02 (AT-10·11) | REQUIRED | 타일 메뉴 → `toggleRightPanelTile` → `tileRegistry` → DOM | id 배열 정확 일치 + 3영역 순서 인덱스 | required — `headerContentById.diff` 를 지운다(`Partial<Record>` 라 typecheck 가 침묵한다) | EP-02·EP-03 (6 + 7파일 42행) |
| VP-10 | R-07·R-13 ↔ AT-07·AT-13 | REQUIRED | `GitRow` · `DiffTileHeader` → DOM | 음성 0건 + 양성 짝 동시 단언 | required — 양성 짝을 지웠을 때 음성이 여전히 참인지 확인한다 | EP-05 (1) |
| VP-11 | R-12 ↔ AT-12 | REQUIRED | `DiffTileContent` → DOM | i18n 해석 문자열 존재 | not selected — 직접 oracle | 0 — 단일 지점 |
| VP-12 | R-14 ↔ AT-14 | REQUIRED | 헤더 버튼 → `TOGGLE_DIFF_FILES` → `diffFilesVisible` → 좌측 컬럼 | reducer 왕복 + 렌더 0/1건 | not selected — 상태·출력 직접 관측 | EP-02 (6) |
| VP-13 | R-15 ↔ AT-15 | REQUIRED | `DiffCommitList` props → DOM | `aria-pressed="true"` 1건 | not selected — 개수 직접 관측 | 0 — props-only View |
| VP-14 | MD-03 ↔ UT-03 (AT-16) | REQUIRED | `visibleTreeRows` → `DiffFileTree` | 접힘 집합별 행 목록 비교 | not selected — 반환 배열 직접 비교 | 0 — 순수 함수 |
| VP-15 | AR-04 ↔ AT-01(색) | REQUIRED | `tokens.css` → Tailwind 유틸 → `GitRow` | 두 스코프에 토큰 선언 존재(`rg`) | not selected — 선언 존재가 곧 계약 | EP-04 (2) |

| VP-16 | R-17 ↔ AT-17 (IT-04) | REQUIRED | 헤더 버튼 → `expanded` 집합 → `DiffFileHeaders` → DOM | 접힘/펼침 두 출력의 `<table` 개수 0/1 | required — 기본값을 펼침으로 뒤집어 AT-17 의 음성 절이 red 인지 확인한다 | 0 — 단일 View |
| VP-17 | R-18 ↔ AT-18 (UT-04) | REQUIRED | `diffTileMock` old/new → `buildDiffLines` → `DiffTable` → DOM | 줄 종류 3종 반환값 + 거터 문자 존재 | not selected — 반환 배열을 직접 비교한다 | EP-07 (2) |
| VP-18 | AR-05·MD-04 ↔ AT-19 | REQUIRED | 승격 모듈 → `DiffBody`(도구 카드) · `DiffFileHeaders`(타일) | import 2건 + 도구 카드 렌더 회귀 | required — 승격 모듈의 export 를 지우면 **두 소비자가 함께** red 인지 확인한다(한쪽만 red 면 SSOT 가 아니다) | EP-07 (2) |

`NOT_REQUIRED` 행 없음 — Baseline V 라 비영향 판정 대상인 inherited pair 가 없다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| renderer subtree | `app/src/renderer/**` 를 바꾼다 — 4-layer boundaries · Tailwind 토큰 규칙 | `cd app && npm run lint && npm run typecheck` (`renderer/AGENTS.md §테스트`) | 이번 변경이 유발한 error 만 blocking |
| main subtree | `app/src/main/infra/git/**` · `app/src/shared/ipc.ts` 를 바꾼다 | 같은 명령 (`main/AGENTS.md` DAG) | 같음 |
| 순수 vitest | 신규·수정 스위트 7개 | `cd app && ./node_modules/.bin/vitest run <suite>` (`app/AGENTS.md:127` — `pretest` 우회로 ABI 중립) | DB 로드 스위트 실패는 알려진 베이스라인으로 분리 |
| repository | INDEX 보드 갱신 · 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | trailer 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `gitStatus` 는 `isRepo·branch·detached·dirty` 넷만 낸다 — 루트 경로가 없다 | `app/src/shared/ipc.ts:1004-1013` |
| `dirty` 는 `git diff HEAD --shortstat` 결과다 — **미커밋·추적 파일 한정** | `app/src/main/infra/git/git-cli.ts:73` |
| `dirty:null` 은 두 경우를 겹친다 — 커밋 없음(`rev-parse --verify HEAD` 실패)과 shortstat 미매치 | `git-cli.ts:71` · `git-parse.ts:12` |
| 읽기 2종은 `fallback` 정책이라 실패가 값으로 온다 | `app/src/main/app/handlers/git.ts:25,32` |
| `CwdPanel` 은 `showLandingCwdPanel` 로만 렌더된다 — 랜딩 2페이지만 넘긴다 | `Composer.tsx:281` · `NewChatLandingPage.tsx:49` · `ProjectLandingPage.tsx:79` |
| `ChatTile` 이 `Composer` 를 직접 렌더한다 — `ChatView` 는 경유하지 않는다 | `ChatTile.tsx:119` (`ChatView.tsx` 에 `Composer` 참조 0건) |
| 세션 busy 판정 SSOT 가 있다 — `sessionBusy(s) = inflight ‖ listening` | `chatStore.ts:1315` |
| 늦은 응답 방어 seam 이 있다 — `{cwd,status}` 스냅샷 + `statusForCwd` | `branchChipState.ts:22` |
| 렌더 하네스가 있다 — `react-dom/server` + `createElement`, `.test.ts`, 신규 의존성 0 | `rightPanelTiles.render.test.ts:12-14` |
| store 연결 컴포넌트는 SSR 스냅샷을 받는다 — **props-only View 만 직접 렌더**한다 | 같은 파일 26-29행 주석 |
| `chatReducer` 에 `reserved1` 특례가 없다 — 타일 특례는 `task`·`subagent` 둘뿐 | `chatReducer.ts:920-921` |
| `headerContentById` 는 `Partial<Record>` 라 **키 누락이 컴파일된다** | `tileRegistry.ts:23` (0204 §10 EP-13③ 과 같은 지점) |
| `--color-good`·`--color-bad` 는 dark 스코프에 재정의가 없다 | `tokens.css:49,51` · dark 블록 `177-200` 에 부재 |
| `Button` 은 `contained` variant 와 `pressed` prop 을 이미 갖는다 | `shared/ui/Button.tsx:22-27` |
| **diff 렌더러가 이미 있다** — `buildDiffLines`(순수) + `DiffTable`(3열: 줄번호·거터·본문) | `tool-bodies/DiffBody.tsx:41,72` |
| 둘 다 **모듈 로컬이라 export 되지 않는다** — 지금 형태로는 재사용할 수 없다 | 같은 파일 (`export` 는 `DiffBody` 하나) |
| `diff@^9.0.0` 이 이미 의존성이다 — `diffLines` 를 새로 들이지 않는다 | `app/package.json:41` |
| 줄 색은 `--color-good`·`--color-bad` 를 `color-mix` 로 14%/18% 섞은 **행 틴트**다 | `DiffBody.tsx:91-98` |
| 세 번째 소비자가 그 색 규칙을 이미 따라간다 | `BranchSwitchDialog.tsx:84` 주석 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `GitStatus` 객체 리터럴 생성 지점 | `git grep -n "isRepo:" -- app/src` 중 리터럴 행 | **6** | `root` 를 채워야 하는 전부 — prod 3(`git-cli.ts:79,82` · `handlers/git.ts:18`) · test 3(`git-cli.test.ts:53` · `handlers/git.test.ts:84` · `branchChipState.test.ts:14`) |
| `reserved1` 참조 | `git grep -c reserved1 -- app/src` | **7파일 / 42행** | tileRegistry 1 · rightPanelLayout.test 16 · rightPanelTiles.test 4 · rightPanelTiles.ts 3 · chatReducer.plan.test 16 · en 1 · ko 1 |
| `ReservedTileContent` 참조 | `git grep -n ReservedTileContent -- app/src` | **2파일 / 3행** | 정의 1 · import 1 · 매핑 1 |
| 타일 정의 변경 지점 | 0204 EP-13 을 이번 변경 형상으로 재계산 | **6** | ①정의 배열 ②`MENU_HIDDEN` ③`contentById` ④`headerContentById` ⑤`ko.ts` ⑥`en.ts`. reducer 는 제외 — `diff` 특례가 없다 |
| `showLandingCwdPanel` 전달처 | `git grep -n showLandingCwdPanel -- app/src` | **5** | Composer 3(import·prop·기본값·사용) · 랜딩 2페이지 |
| `buildDiffLines` 소비처 | `git grep -n buildDiffLines -- app/src` | **1** | `DiffBody.tsx:74` 뿐 — 승격 후 **2**(타일 추가)가 EP-07 의 분모다 |
| `DiffTable` 소비처 | `git grep -n DiffTable -- app/src` | **1** | `DiffBody.tsx:135` 뿐 — 승격 후 **2** |
| `DiffBody` 등록 경로 | `git grep -n "DiffBody" -- app/src` | **2** | `registry.ts:13` import · `registry.ts:75` `kind:'diff'` 등록. AT-19 회귀 짝이 이 경로다 |

### 수치 / 전칭 표현 검산

- 재측정 수치: `reserved1` 42행 = 1+16+4+3+16+1+1 — 내역 합 = 총계.
- `GitStatus` 리터럴 6 = prod 3 + test 3 — 내역 합 = 총계.
- 전칭 검산: "타일 정의 변경 지점에 reducer 가 없다" → `grep -n "'plan'\|'subagent'\|'task'" chatReducer.ts` 가 920·921·934·945·565 를 내고 `reserved1`·`diff` 는 0건 — 반례 없음.
- 문서 앵커 확인: 0201 D-002·D-009·D-011 은 `0201-composer-work-context-row/plan.md:44,51,54` 에 실재. 0204 D-021 은 `0204-taskxxx-right-panel/plan.md:65`. 0205 D-008 은 `0205-.../plan.md:51`.
- 기존 테스트 케이스 존재 확인: `rightPanelTiles.test.ts:23`("정의 순서 = 메뉴 순서") · `chatReducer.plan.test.ts:78` · `branchChipState.test.ts:24`("isRepo:false 면 렌더하지 않는다") 전부 실재.
- **`DiffBody` 에는 테스트가 없다** — `tool-bodies/` 에 `.test.ts` 0건. D-019 의 승격은 회귀 짝을 **새로 만들어야** 하고(AT-19), 기존 케이스를 인용할 수 없다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: 없음(Baseline)
- 현재 책임 소유자: `BranchChip`(브랜치 표시 + 전환) · `CwdPanel`(랜딩 행 조립) · `ReservedTileContent`(빈 예약 타일)
- 현재 entry → flow → state → consumer: 랜딩 페이지 → `Composer(showLandingCwdPanel)` → `CwdPanel` → `BranchChip` → `gitApi.status(cwd)` **1회(cwd 변경 시)** → 컴포넌트 로컬 `snapshot` → 칩 라벨
- 현재 오류/취소/정리 경로: `handle` fallback 이 `NOT_REPO` 를 돌려주고 `branchChipView` 가 `{visible:false}` 로 접는다. 늦은 응답은 `statusForCwd` 가 버린다.
- 구조적 제약: 조회가 **cwd 변경에만** 걸려 있어 저장소 상태 변화(`git init`·커밋·수정)를 화면이 따라가지 못한다. 그리고 그 경로 전체가 랜딩에만 도달한다.

```text
랜딩 page → Composer(showLandingCwdPanel) → CwdPanel → BranchChip
                                                  → gitApi.status(cwd)  [cwd 변경 시 1회]
ChatTile  → Composer(prop 없음)            → (git 표면 없음)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`·`SD-02`·`AR-01`·`AR-03`
- 변경 후 책임 소유자: `gitRowState.ts`(순수 판정 — 노출·값·재조회 트리거) · `useGitRowStatus`(조회 수명주기) · `GitRow`(표시) · `DiffTile*`(더미 골격)
- 변경 후 entry → flow → state → consumer: `ChatTile` → `Composer(showGitRow)` → `GitRow` → `useGitRowStatus(cwd)` → `gitApi.status` **2계기(cwd 변경 · busy true→false)** → 로컬 `BranchSnapshot` → `gitRowView` → DOM. 변경량 버튼 → `chatActions.toggleRightPanelTile('diff')` → `rightPanelTiles` → `RightPanel` → `diff` 타일.
- 변경 후 오류/취소/정리 경로: AS-IS 와 같다 — `fallback` + `statusForCwd` 를 그대로 쓴다. effect 는 `live` 플래그로 정리한다(`BranchChip.tsx:68` 형태).
- 유지하는 메커니즘: `handle` fallback 정책 · `statusForCwd` 태깅 · `Button` primitive · `chipSurface`(건드리지 않는다 — 이 행은 칩을 쓰지 않는다).
- 대체하는 메커니즘: `ReservedTileContent` → `DiffTileContent`. `reserved1` 정의 → `diff`.
- **이동하는 책임**(삭제 아님): `buildDiffLines`·`DiffTable` 이 `DiffBody.tsx` 에서 `lib/diffLines.ts`·`components/DiffTable.tsx` 로 옮겨 간다. `DiffBody` 는 그것을 쓰는 얇은 껍데기로 남는다 — 도구 카드 동작은 그대로다.

```text
ChatTile → Composer(showGitRow) → GitRow
                                    ├ useGitRowStatus(cwd)  [cwd 변경 · 턴 종료]
                                    │    → gitApi.status → BranchSnapshot
                                    ├ gitRowView(sessionStarted, cwd, status)
                                    └ 변경량 버튼 → toggleRightPanelTile('diff')
                                                        → RightPanel → DiffTileContent(더미)
랜딩 page → Composer(showLandingCwdPanel) → CwdPanel  [변경 없음]
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | git 표면이 `BranchChip` 하나, 랜딩 전용 | 표면 둘 — 랜딩 `BranchChip`(유지) · 세션 `GitRow`(신설) | 노출 조건이 반대라 한 컴포넌트로 접을 수 없다(D-001) | AR-03 / VP-01·VP-02 · `GitRow.tsx` |
| data/control flow | 조회 계기 1개(cwd 변경) | 계기 2개(cwd 변경 · busy true→false) | D-003 을 닫는 최소 계기 | SD-01 / VP-04 · `gitRowState.ts` |
| state/contract | `GitStatus` 4필드 | 5필드 — `root: string \| null` 추가 | cwd 하위 폴더에서 basename 이 저장소 이름이 아니다(D-008) | AR-01 / VP-08 · `ipc.ts`·`git-cli.ts` |
| state/contract | 타일 4종에 `reserved1` | 타일 4종에 `diff` — 메뉴 3항목 | D-009 | AR-02 / VP-09 · `rightPanelTiles.ts` |
| state/contract | 타일 로컬 상태 없음 | `diffFilesVisible: boolean` + `TOGGLE_DIFF_FILES` | 헤더와 본문이 형제라 로컬 state 로 공유할 수 없다 | AR-02 / VP-12 · `chatReducer.ts` |
| error/lifecycle | fallback + cwd 태깅 | **동일** — 재사용한다 | 검증된 경로를 두 벌로 만들지 않는다 | SD-02 / VP-05 · `branchChipState.ts` |
| test seam/관측점 | 순수 판정 파일 1개(`branchChipState`) | 순수 3개(`gitRowState`·`diffTileTree`) + 렌더 스위트 2개 | 노출·값·접힘이 전부 순수하다 | MD-01~03 / VP-01·04·14 |
| 우측 영역 깊이 | (설계 없음 — 1턴은 파일 헤더 목록까지) | 헤더 + **접기/펼치기 + 더미 diff 본문** | D-017·D-018 — diff 패널이 diff 를 그려야 배치 확인이 닫힌다 | R-17·R-18 / VP-16·17 · `DiffFileHeaders` |
| 줄 파생·줄 렌더 소유 | `DiffBody.tsx` 모듈 로컬, 소비자 1 | `lib/diffLines.ts` · `components/DiffTable.tsx` 로 승격, 소비자 2 | 규칙이 두 벌이면 도구 카드와 타일의 +/− 표현이 갈라진다(D-019) | MD-04·AR-05 / VP-18 · EP-07 |
| 색 토큰 | git 의미 토큰 없음 | `--color-git-added`·`--color-git-removed` 2종 × 2스코프 | `renderer/AGENTS.md §스타일` | AR-04 / VP-15 · `tokens.css` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `main/infra/git/git-cli.ts` | `--show-toplevel` 실행 | `cwd` → `GitStatus`(+`root`) | `handlers/git.ts` |
| `shared/ipc.ts` | `GitStatus` 계약 | — | main · preload · renderer |
| `features/chat/components/composer/gitRowState.ts` | 노출·값·재조회 판정 **전부** | `(sessionStarted, cwd, status)` → `GitRowView` · `(prev,next)` → `boolean` | `GitRow`·`useGitRowStatus` |
| `features/chat/components/composer/GitRow.tsx` | 표시 + 변경량 버튼 | props-only View + store 연결 래퍼 | `Composer` |
| `features/chat/lib/diffLines.ts` | 줄 파생 — `old·new` → `DiffLine[]` | 문자열 2개 → 줄 배열 | `DiffTable` · (간접) 두 소비자 |
| `features/chat/components/DiffTable.tsx` | 줄 렌더 — 3열 table | `{oldValue,newValue}` | `DiffBody` · `DiffFileHeaders` |
| `features/chat/components/rightpanel/diffTileMock.ts` | 더미 데이터 상수 — 트리·커밋·**파일별 old/new 쌍** | — | `DiffTile*` |
| `features/chat/components/rightpanel/diffTileTree.ts` | 접힘 집합 → 가시 행 | `(tree, collapsed)` → `Row[]` | `DiffFileTree` |
| `features/chat/components/rightpanel/DiffTileContent.tsx` | 3영역 조립 + props-only 하위 View 3개 | props | `tileRegistry` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| **EP-01** AR-01 / VP-08 | `GitStatus.root: string \| null` 을 **모든 생성 지점**이 채운다 — 지점 **6** (`git-cli.ts:79,82` · `handlers/git.ts:18` · `git-cli.test.ts:53` · `handlers/git.test.ts:84` · `branchChipState.test.ts:14`) | `shared/ipc.ts` | typecheck(prod 3) · `toEqual`(test 3) | 빌드·테스트 시점 | prod 지점 누락은 `TS2739`. **test 3지점은 typecheck 가 침묵하고 `toEqual` 만 잡는다** — 그래서 개수를 여기 적는다 |
| **EP-02** AR-02 / VP-09·VP-06·VP-12 | 타일 정의 교체 — 지점 **6** (①`rightPanelTiles.ts` 정의 배열 ②같은 파일 `MENU_HIDDEN_RIGHT_PANEL_TILES` ③`tileRegistry.contentById` ④같은 파일 `headerContentById` ⑤`ko.ts` ⑥`en.ts`) | `rightPanelTiles.ts` | typecheck(①②③⑤⑥) · 렌더 단언(④) | 빌드 시점 · AT-13 | **④만 `Partial<Record>` 라 키를 빠뜨려도 컴파일된다** — 헤더가 기본 라벨로 조용히 떨어진다 |
| **EP-03** AR-02 / VP-09 | `reserved1` 잔여 참조 0 — 7파일 42행을 전부 옮긴다 | 같은 정의 배열 | typecheck(`RightPanelTileId` 에서 사라진다) | 빌드 시점 | 잔여가 있으면 `TS2322`/`TS2345` 로 전부 드러난다 |
| **EP-04** AR-04 / VP-15 | 새 색 토큰 2종을 **두 스코프 전부**에 — 지점 **2** (`:root` `@theme` · `[data-theme='dark']`) | `styles/tokens.css` | `rg`(테스트) | 테스트 시점 | 한쪽만 채우면 그 테마에서 색이 죽는다. typecheck 가 CSS 를 보지 않으므로 **기계 강제가 이 검색뿐이다** |
| **EP-05** AR-03 / VP-01·02·03·07·10 | 행의 노출·값 판정은 `gitRowView` **한 곳**이다 — 소비 지점 **1** (`GitRow.tsx`) | `gitRowState.ts` | 렌더 단언 + `rg "isRepo" -- components/composer` 가 `branchChipState.ts` 외 0건 | 테스트 시점 | 두 곳이 판정하면 랜딩·세션 조건이 갈라진다 |
| **EP-06** SD-01 / VP-04 | 재조회 계기 **2** (cwd 변경 effect · busy 전이 effect) | `useGitRowStatus` | 순수 진리표(AT-04) + effect 배선 | 테스트 시점 | 하나가 빠지면 D-003(중간 `git init`) 또는 변경량 갱신이 죽는다 |

| **EP-07** MD-04·AR-05 / VP-17·VP-18 | 줄 파생·줄 렌더를 **한 모듈이 소유**한다 — 소비 지점 **2** (`DiffBody.tsx` · `DiffFileHeaders`) | `lib/diffLines.ts` · `components/DiffTable.tsx` | `rg` 2건 + 도구 카드 회귀 렌더(AT-19) | 테스트 시점 | 소비자가 각자 구현하면 `+`/`-` 거터·색·줄번호 규칙이 갈라진다. **`DiffBody` 에 기존 테스트가 없어 승격 회귀를 잡을 장치가 AT-19 뿐이다** |

- 같은 규칙의 SSOT: 늦은 응답 방어는 `branchChipState.ts` 의 `BranchSnapshot`·`statusForCwd` 를 **재사용한다** — 정규식/구조를 복사하지 않는다.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: EP-01·EP-03 둘. 근거는 이번 턴 실측 — `RightPanelTileId` 는 union 이라 잔여 참조가 error 를 내고(0204 r1 이 같은 형태로 4건을 드러냈다), `GitStatus` 필수 필드 추가는 리터럴 3곳에 `TS2739` 를 낸다. **테스트 3지점과 EP-02④·EP-04 는 그 강제 밖이라 별도로 적었다.**
- 선택적 필드 의미: `root: null` = 저장소 아님(`isRepo:false` 와 항상 함께). `dirty: null` = 커밋 없음 ∨ 변경 없음 — **뷰가 0/0 으로 접고 두 경우를 구분하지 않는다**(D-005 의 3자리에 그 축이 없다).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | 계약 | `GitStatus` 에 `root: string \| null` + 주석 | typecheck |
| `app/src/main/infra/git/git-cli.ts` | git 실행 | `repoRoot(cwd)` 추가(`rev-parse --show-toplevel`), `gitStatus` 두 반환에 `root` | 기존 `git-cli.test.ts` |
| `app/src/main/app/handlers/git.ts` | IPC | `NOT_REPO` 에 `root: null` | 기존 `git.test.ts` |
| `.../composer/gitRowState.ts` **신규** | 순수 판정 | `gitRowView` · `shouldRefetchGitStatus` · `repoNameFromRoot` | 순수 (UT-01·02) |
| `.../composer/gitRowState.test.ts` **신규** | — | AT-02·03·04·06·08·09 | — |
| `.../composer/GitRow.tsx` **신규** | 표시 | props-only `GitRowView` + store 연결 `GitRow` + `useGitRowStatus` | 렌더 (AT-01·07·08) |
| `.../composer/gitRow.render.test.ts` **신규** | — | AT-01·07·08 | — |
| `.../components/Composer.tsx` | 조립 | `showGitRow?: boolean` prop 추가 + `CwdPanel` 아래가 아닌 **위**에 배치 | — |
| `.../components/ChatTile.tsx` | 조립 | `showGitRow` 를 넘긴다 | — |
| `.../lib/rightPanelTiles.ts` | 타일 SSOT | `reserved1`→`diff`(EP-02①), `MENU_HIDDEN` 에서 제거(EP-02②) | 기존 `rightPanelTiles.test.ts` |
| `.../rightpanel/tileRegistry.ts` | 레지스트리 | `contentById.diff`·`headerContentById.diff`(EP-02③④), `ReservedTileContent` import 제거 | 렌더 (AT-13) |
| `.../rightpanel/ReservedTileContent.tsx` | — | **삭제** | — |
| `.../lib/diffLines.ts` **신규(이동)** | 줄 파생 | `DiffBody.tsx:35-70` 의 `DiffLine`·`buildDiffLines` 를 그대로 옮기고 export | 순수 (UT-04) |
| `.../lib/diffLines.test.ts` **신규** | — | AT-18 순수 절 | — |
| `.../components/DiffTable.tsx` **신규(이동)** | 줄 렌더 | `DiffBody.tsx:72-121` 의 `DiffTable` 을 옮기고 export. props-only 유지 | 렌더 (AT-18·19) |
| `.../transcript/tool-bodies/DiffBody.tsx` | 도구 카드 | 두 조각을 import 로 대체 — `buildPairs`·`DiffBody` 만 남는다 | 렌더 회귀 (AT-19) |
| `.../rightpanel/diffTileMock.ts` **신규** | 더미 상수 | 트리 · 커밋 3건 · 파일별 `{path, added, removed, oldValue, newValue}` | — |
| `.../rightpanel/diffTileTree.ts` **신규** | 순수 파생 | `visibleTreeRows(tree, collapsed)` — 깊이·들여쓰기 포함 | 순수 (UT-03) |
| `.../rightpanel/DiffTileContent.tsx` **신규** | 3영역 | props-only `DiffFileTree`·`DiffCommitList`·`DiffFileHeaders`(`expanded` 집합 소유) + store 연결 래퍼 | 렌더 (AT-11·12·14·15·17) |
| `.../rightpanel/DiffTileHeader.tsx` **신규** | 헤더 override | 파일 토글 + 현재 브랜치 표시 | 렌더 (AT-13) |
| `.../rightpanel/diffTile.render.test.ts` **신규** | — | AT-11·12·13·14·15·17·18·19 | — |
| `.../reducer/chatReducer.ts` | 상태 | `diffFilesVisible: boolean`(초기 `true`) + `TOGGLE_DIFF_FILES` | 기존 `chatReducer.plan.test.ts` |
| `.../shared/i18n/resources/{ko,en}.ts` | 문구 | `tiles.reserved1`→`tiles.diff`, `gitRow.*` 3키, `diffMockNotice` 외 타일 키 | typecheck(`MessageKey`) |
| `.../styles/tokens.css` | 토큰 | `--color-git-added`·`--color-git-removed` × 2스코프 | `rg`(EP-04) |
| `.../lib/rightPanelLayout.test.ts` · `rightPanelTiles.test.ts` · `chatReducer.plan.test.ts` | 회귀 | `reserved1`→`diff` 36행 치환 | — |

### 테스트 가능성

- electron 의존부와 분리한 **별도 순수 파일**: `gitRowState.ts` · `diffTileTree.ts` · `diffLines.ts` — 셋 다 `gitApi`·`chatStore` 를 import 하지 않는다. import graph 가 끊긴다.
- 기존 메커니즘 재사용 적합성: `BranchSnapshot`/`statusForCwd` 는 "어느 cwd 의 값인가" 만 판정하므로 조회 계기가 둘로 늘어도 형상이 맞는다.
- 순서를 관측할 훅: 렌더 출력의 `indexOf` 비교(AT-01·AT-11). 별도 로그를 만들지 않는다.
- **props-only 분리**: 렌더 단언 대상 View 6개(`GitRowView`·`DiffFileTree`·`DiffCommitList`·`DiffFileHeaders`·`DiffTileHeaderView`·`DiffTable`)는 store 를 읽지 않는다 — store 연결 래퍼가 props 를 내려준다.
- **`expanded` 는 타일 로컬 state 다** — 헤더가 아니라 본문 안에서만 쓰이므로 reducer 로 올리지 않는다(`diffFilesVisible` 과 다른 축이다).

## 12. End-to-end 영향

### producer → consumer

```text
git-cli.gitStatus  →  GitStatus(+root)  →  useGitRowStatus 로컬 snapshot  →  gitRowView  →  GitRow DOM
                                                                          ↘  변경량 버튼 → chatReducer.rightPanelTiles → RightPanel
```

- producer 기준: `root` 는 `rev-parse --show-toplevel` 원문(성공 시 trim, 실패 시 `null`).
- consumer 파생 규칙: 저장소 이름 = `root` 의 마지막 경로 세그먼트(`/`·`\` 양쪽). **`cwd` 에서 파생하지 않는다** — 그것이 D-008 이 막는 오류다.
- 파생 합성값이 정본을 우회하지 않는가: `GitRow` 는 `status.isRepo` 를 직접 읽지 않고 `gitRowView` 결과만 쓴다(EP-05).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `branchChipState.branchChipView` | `root` 를 읽지 않는다 — 무영향. fixture 만 필드 추가 | AT-03(같은 함수의 음성 케이스 유지) |
| `BranchChip` | 무영향 — `view.branch` 만 쓴다 | — |
| `rightPanelLayout` 3함수 | `reserved1`→`diff` 는 **id 문자열 치환**이라 기하 로직 무영향 | AT-05(왕복) · 기존 16행 회귀 |
| `chatReducer` 타일 특례 | `diff` 특례 없음 — `activateTile`/`removeTile` 일반 경로 | AT-05 |
| `ChatTitleBar` `VISIBLE_TILE_REGISTRY` | `MENU_HIDDEN` 파생이라 자동 반영 | AT-10 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `GitRow` 마운트 시 cwd 가 있으면 1회 조회.
- 취소/중단: effect 마다 `live` 플래그 — 언마운트·cwd 변경 시 늦은 응답을 버린다(`BranchChip.tsx:68` 형태).
- 종료/crash: 로컬 state 뿐이라 정리 대상 없음.
- retry/timeout: 재시도하지 않는다. `run` 이 10초 타임아웃을 이미 갖고(`git-cli.ts:25`) 실패는 `fallback` 으로 접힌다 — 다음 턴 종료가 자연스러운 재시도다.
- partial failure: `--show-toplevel` 만 실패하면 `root:null` 이고 `isRepo:true` 다 → 저장소 이름 자리가 비고 브랜치·변경량은 산다. **행이 통째로 사라지지 않는다.**
- **다중 저장소 쓰기**: 해당 없음 — 이 작업은 읽기 전용이고 새로 쓰는 저장소가 없다. 단, **문서 판정의 사본은 둘이다** — `plan.md`(본 문서)와 `docs/handoff/INDEX.md` 보드 행. 둘이 갈라지지 않도록 상태 변경 시 같은 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수: `원천 상한 × 배치 상한` = **턴당 1회** × cwd 1개 = 1. `git rev-parse --show-toplevel` 이 `gitStatus` 안에 1회 더 붙어 프로세스 호출이 turn 당 3→4회가 된다(`insideWorkTree`·`symbolic-ref`·`diff --shortstat` + 신규 1).
- 새 출력 상한: 행 문자열은 저장소명(파일시스템 상한) + 브랜치명(git 상한 255) + 숫자 2개 — CSS `truncate` 로 접는다. diff 타일 더미는 **모듈 상수라 상한이 고정**이다.
- 구조적 목표: 없음. 신규 파일 중 400줄을 넘길 후보는 `DiffTileContent.tsx` 하나 — 하위 View 3개를 같은 파일에 두면 `renderer/AGENTS.md §단일 파일 분해 가이드` 의 "컴포넌트 5개" 경고에 닿는다. **4개(래퍼 + View 3)로 유지**한다.
- 펼침 시 렌더 줄 수: `원천 상한 × 배치 상한` = **더미 파일당 old/new 각 20줄 이내 × 동시 펼침 파일 수**. 더미가 모듈 상수라 상한이 고정이고, `buildDiffLines` 의 `O(n·m)` 은 `DiffTable` 의 기존 `useMemo`(0108)가 이미 막는다.
- 캐시/축소로 잃는 부수 효과: `useGitRowStatus` 는 캐시하지 않는다 — 턴마다 새로 읽는 것이 D-003 의 요구다. `DiffTable` 의 `useMemo` 는 **승격하며 그대로 옮긴다** — 지우면 부모 재렌더마다 diff 를 다시 계산한다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 외부 구현자가 채우는 port/schema/config 를 만들지 않는다. `GitStatus` 는 앱 내부 IPC 계약이고 `shared/ipc.ts` 가 정본이다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0201 D-002 — 저장소가 아니면 칩을 그리지 않는다 | `0201/plan.md:44` | §5 상태 전이표 "isRepo=false → 행 없음" · D-005 | **유지** — 같은 규칙을 새 행에 그대로 적용한다 |
| 0201 D-009 — 작업 컨텍스트 행은 랜딩에만 | `0201/plan.md:51` | D-001·D-006 | **유지** — `CwdPanel` 은 손대지 않는다. 새 행은 별도 컴포넌트이고 노출 조건이 배타적이다 |
| 0201 D-011 — 칩 외형은 `chipSurface` 가 소유 | `0201/plan.md:54` | §9 "유지하는 메커니즘" | **유지** — git 행은 칩을 쓰지 않는다(저장소·브랜치는 표시 텍스트, 변경량은 `Button`) |
| 0201 D-001 — worktree 를 다루지 않는다 | `0201/plan.md:43` | §6 비범위 | **유지** |
| 0204 D-021 — 타일 정의 4종 | `0204/plan.md:65` | D-009 | **유지** — `reserved1`→`diff` 로 수를 바꾸지 않는다 |
| 0205 D-008 — `reserved1` 의 지위를 바꾸지 않는다 | `0205/plan.md:51` | D-009 | **변경(SUPERSEDED)** — D-S01. 그 결정이 지키려던 3타일 기하 회귀는 `diff` 로 재현된다(`rightPanelLayout.test.ts` 16행 치환) |
| 0205 `SUSPENDED_RIGHT_PANEL_TILES` = `['task']` | `rightPanelTiles.ts:44` | EP-02② | **유지** — `MENU_HIDDEN` 에서 `reserved1` 만 뺀다. 정지 목록은 건드리지 않는다 |
| `DiffBody.tsx:73` 주석 — `diffLines` 는 `O(n·m)`, `useMemo` 로 재계산 방지(0108) | 코드 주석 | §14 · §11 승격 행 | **유지** — `useMemo` 를 `DiffTable` 과 함께 옮긴다 |
| `BranchSwitchDialog.tsx:84` 주석 — diff 색은 `DiffBody` 와 같은 토큰(good/bad) | 코드 주석 | §8 조사 · D-016 | **유지** — D-016 이 만드는 `git-added/removed` 는 **텍스트 색**(행의 `+N −M`)이고 저 주석은 **행 틴트** 다. 두 축이라 기존 규칙을 건드리지 않는다 |
| `renderer/AGENTS.md §스타일` — 새 토큰은 두 테마 스코프 전부 | `app/src/renderer/AGENTS.md` | D-016 · EP-04 | **유지** |
| `renderer/AGENTS.md §4-layer` — feature 끼리 import 금지 | 같은 문서 | §11 신규 파일 전부 `features/chat/` 내부 | **유지** |
| `app/AGENTS.md:127` — 비-DB 테스트는 `pretest` 우회 | `app/AGENTS.md` | §19 | **유지** |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 더미 데이터가 실제 변경으로 읽힌다 | D-012 — 본문 최상단 예시 문구. AT-12 가 잠근다 |
| `headerContentById.diff` 누락이 조용히 컴파일된다 | EP-02④ + VP-09 의 결함 변이(그 키를 지우고 AT-13 이 red 인지 확인) |
| 색 토큰 한쪽 스코프 누락 | EP-04 — typecheck 밖이라 `rg` 단언이 유일한 강제. AT 가 아니라 §10 지점으로 명시 |
| `--show-toplevel` 추가로 turn 당 git 프로세스 1회 증가 | 수용 — 이미 3회이고 `GIT_OPTIONAL_LOCKS=0` 로 잠금을 잡지 않는다(`git-cli.ts:24`) |
| 턴 종료 재조회가 긴 턴에서 늦다 | 수용 — D-004 가 계기를 둘로 명시했고 창 포커스는 §6 비범위 |
| `reserved1` 42행 치환 중 일부 누락 | EP-03 — union 에서 사라지므로 typecheck 가 전부 드러낸다 |
| **`DiffBody` 승격이 도구 카드를 깬다** — 기존 테스트가 0건이라 잡을 장치가 없었다 | AT-19 가 회귀 짝을 새로 만든다(도구 카드 경로 렌더). VP-18 이 승격 모듈 export 를 지워 **두 소비자가 함께** red 인지 확인한다 |
| 더미 diff 본문이 실제 변경으로 읽힌다 | D-012 의 예시 문구가 본문 최상단에 있다(AT-12). 접힘이 기본이라 펼치는 행동이 있어야 본문이 나온다(AT-17) |

- 되돌리기 어려운 결정: `GitStatus.root` 필드 추가(공개 IPC 계약) · 타일 id `diff`(사용자 라벨 오버라이드 `rightPanelTileLabels` 의 키가 된다). 둘 다 사용자가 선택했다.
- 신규 의존성: **0건** — 렌더 하네스는 기존 `react-dom/server` 를 쓴다.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/ipc.ts` · `app/src/main/infra/git/git-cli.ts` · `app/src/main/app/handlers/git.ts`
- `app/src/renderer/src/features/chat/components/composer/{gitRowState.ts,gitRowState.test.ts,GitRow.tsx,gitRow.render.test.ts}` (신규)
- `app/src/renderer/src/features/chat/components/{Composer.tsx,ChatTile.tsx}`
- `app/src/renderer/src/features/chat/components/rightpanel/{diffTileMock.ts,diffTileTree.ts,DiffTileContent.tsx,DiffTileHeader.tsx,diffTile.render.test.ts}` (신규) · `tileRegistry.ts` · `ReservedTileContent.tsx`(삭제)
- `app/src/renderer/src/features/chat/lib/{diffLines.ts,diffLines.test.ts}` (신규·이동) · `components/DiffTable.tsx` (신규·이동) · `components/transcript/tool-bodies/DiffBody.tsx` (수정)
- `app/src/renderer/src/features/chat/lib/rightPanelTiles.ts` · `reducer/chatReducer.ts`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` · `app/src/renderer/src/styles/tokens.css`
- 회귀 스위트 3: `lib/rightPanelLayout.test.ts` · `lib/rightPanelTiles.test.ts` · `reducer/chatReducer.plan.test.ts`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/src/renderer/AGENTS.md §테스트` · `app/src/main/AGENTS.md` · `app/AGENTS.md §better-sqlite3 ABI`
- ABI/네트워크 제약: `npm test` 를 쓰지 않는다 — ABI 를 Node 로 뒤집는다(`app/AGENTS.md:122`).
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`
- 관련 테스트(ABI 중립): `cd app && ./node_modules/.bin/vitest run src/renderer/src/features/chat` 및 `... src/main/infra/git src/main/app/handlers`. **도구 카드 diff 회귀(AT-19)가 이 스위트에 새로 들어온다** — `tool-bodies/` 는 지금 테스트 0건이다.
- 사람 실기: **2건** — ① 다크/라이트 두 테마에서 `+N −M` 색 대비 ② 세션 중 `git init` → 다음 턴 종료 후 행 등장(D-003 의 실제 환경 확인). 둘 다 순수 로직으로 내릴 수 없는 축이다(색 지각 · 실제 git 부작용).

## READY self-review

- [x] Decision Ledger 가 ACTIVE 19 · SUPERSEDED 1(D-S01)로 세 턴(질의 2회 + 지적 1회)의 결정을 보존한다. 설계 2턴에서 D-001~D-016 을 문장 그대로 유지하고 D-017~D-019 만 더했다.
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §5 전이표 8행이 구현 방식 없이 결과를 말한다.
- [x] 조건절을 재해석하지 않았다 — "Git init이 안되어잇엇다면 … 셋업이되면 노출돼야 한다" 를 D-003 에 원문 인용하고 D-004 가 계기를 명시했다.
- [x] Product/UX 핵심 동작 8행이 전부 AC(AT-01~16)와 §9 TO-BE 경로에 연결된다.
- [x] AS-IS·TO-BE 가 같은 축(책임·flow·contract·lifecycle·seam)으로 있고 Delta 8행이 전부 §11 파일 또는 AC 로 간다.
- [x] AS-IS 에서 사라진 책임 명시 — `ReservedTileContent` = **삭제**, `buildDiffLines`·`DiffTable` = **이동**(삭제 아님), `BranchChip` = **유지**.
- [x] 수치 실측 — `reserved1` 7파일 42행(내역 합 = 총계) · `GitStatus` 리터럴 6(3+3) · 타일 지점 6 · `showLandingCwdPanel` 5 · `buildDiffLines`·`DiffTable` 소비처 각 1 → 승격 후 2 · `tool-bodies/` 테스트 **0건**.
- [x] 전칭 검산 — "reducer 에 타일 특례가 없다" 를 grep 반례 0건으로 확인.
- [x] 문서 앵커·기존 케이스 존재 확인 — 0201 D-002/009/011 · 0204 D-021 · 0205 D-008 · 테스트 3케이스 전부 실재.
- [x] 각 AC 가 행동 단언 · 검증 수단 · 프로덕션 도달 경로 3칸을 갖는다.
- [x] Baseline V 를 만들었고 유효 V = `V1` 로 재구성 가능하다.
- [x] 모든 NEW node 에 같은 레벨 REQUIRED pair — VP-01~15, `NOT_REQUIRED` 0건(Baseline).
- [x] 각 pair 가 경로 · §10 전수 분모 · 직접 oracle 을 갖고, 적대 증거는 5개(VP-01·09·10·16·18)만 이유와 변이를 적었다.
- [x] 운영 gate 4종이 이번 산출물 기준이고 DB 로드 실패를 blocking 으로 만들지 않는다.
- [x] 사람 실기로 미룬 순수 로직 없음 — 노출·값·접힘·재조회 트리거가 전부 순수 테스트다. 실기 2건은 색 지각과 실제 git 부작용뿐.
- [x] structural proxy 만으로 검증하는 AC 없음 — 순서는 인덱스 비교, 음성은 양성 짝과 함께.
- [x] "X 가 쓰인다" 불변식의 장치가 X 를 지웠을 때 실패한다 — EP-02④를 지우면 AT-13 이 red(VP-09 변이). **자리 불변식(AT-01·AT-11)은 형제를 맞바꿔도 실패한다**(VP-01 변이).
- [x] 신규 계약의 SSOT · 강제 지점 · 테스트 seam — EP-01~06 이 각각 소유자·강제자·시점을 갖는다.
- [x] 기존 소비처 전수 — §12 표 5행.
- [x] 상한 계산 — 턴당 git 프로세스 3→4, 요청 1회, 펼침 줄 수는 모듈 상수로 고정. one-way door 2건 명시.
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다 — `npm test` 를 쓰지 않고 `vitest run` 직접 호출.
- [x] 본문 완성 후 교차검증 — `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 관측으로 적었다(충돌 0, 확인 쌍 17 + 비충돌 판정 2건).
- [x] 문장 규칙 — 판정 먼저, 한 줄에 관측 하나, 표 한 칸 3줄. Part I 은 결과, Part II 는 경로로 갈랐다.
