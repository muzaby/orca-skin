# Orcinus orca 디자인 시스템

> renderer를 만드는 AI와 개발자가 읽는 공통 시각·상호작용 기준이다.
> 적용 대상은 앱 셸, 페이지, 공통 UI, 도메인 화면, 하네스별 채팅 UI다.
> 파일별 적용 규칙은 [컴포넌트 카탈로그](design-components.md), 제작 절차는 [renderer AGENTS](../../../app/src/renderer/AGENTS.md)가 정본이다.

## 1. 디자인 방향과 근거

Orca는 검증 엔지니어가 긴 대화·코드·작업 결과를 읽는 데스크톱 도구다.
중립적인 표면, 얇은 경계, 작은 컨트롤, 읽기 쉬운 본문을 기본으로 한다.
색·그림자·애니메이션은 선택·상태·계층을 설명하는 데 사용한다.

| 원칙 | 적용 기준 |
|---|---|
| 내용이 중심 | 장식용 그라데이션·대형 배지·중복 카드 테두리를 새로 만들지 않는다. 본문과 동작의 위계를 먼저 정한다. |
| 같은 역할은 같은 외형 | 버튼·메뉴·탭·카탈로그 행·모달·패널 컨트롤은 공통 컴포넌트를 재사용한다. |
| 읽기와 조작을 구분 | 본문은 안정된 읽기 열, 메타 정보는 보조 활자, 조작은 버튼·메뉴로 표현한다. |
| 상태를 명시 | 로딩·빈 결과·오류·비활성·진행·완료를 구별한다. 색만으로 의미를 전달하지 않는다. |
| 제품 경계 유지 | 공통 셸과 하네스 전용 표면의 테마를 구분한다. 하네스 전환이 초안·선택·스크롤을 초기화하지 않게 한다. |

기존 코드의 정본은 [tokens.css](../../../app/src/renderer/src/styles/tokens.css), [app.css](../../../app/src/renderer/src/styles/app.css), 각 컴포넌트다.
값을 문서에서 복사하지 말고 해당 토큰·props를 사용한다.
코드와 문서가 어긋나면 코드·테스트를 조사해 문서 드리프트를 정정하며, 제품 동작 변경은 별도 요구로 구분한다.

## 2. 테마와 색상 역할

### 2.1 테마 적용

`html[data-theme='white'|'dark']`가 테마 범위다.
밝은 테마는 흰 본문과 옅은 중립 사이드바, 어두운 테마는 차콜 표면과 밝은 본문을 사용한다.
[TweakProvider](../../../app/src/renderer/src/shared/theme/TweakProvider.tsx)가 설정을 적용하므로 컴포넌트 안에 별도 테마 상태·감지 코드를 만들지 않는다.

| 범위 | 토큰 / 표면 | 선택 기준 |
|---|---|---|
| Orca 공통·Claude | `bg-bg`, `bg-sidebar`, `bg-panel`, `bg-bg2`, `text-ink` | 셸·카탈로그·설정·프로젝트·공통 채팅 표면의 기본 |
| OpenCode 전용 chrome | `oc-*` | OpenCode 컨트롤·요청 dock·전용 도구 행·패널 내부에서 해당 하네스 구현을 따른다. |
| OpenCode 공유 본문 | 공통 transcript 배경·활자·Markdown + 하네스별 색 | 전체 채팅 배경을 임의로 `oc-background`로 치환하지 않는다. [렌더링 계약](rendering.md)의 하네스 전용 표시 참조. |
| 카메라·이미지 검사 | `stage-*`, Bayer·Histogram | 뷰포트·엔지니어링 표시용. 일반 설정·모달로 확장하지 않는다. |
| 개발 도구 | `floating-panel-*` | FloatingPanel과 DebugPanel 전용. 일반 제품 카드에 유리 효과를 가져오지 않는다. |

### 2.2 공통 시맨틱 팔레트

| 역할 | 토큰 / 사용 예 | 적용 |
|---|---|---|
| 기본 배경 | `bg-bg` | 페이지·입력·읽기 영역 |
| 내비게이션 | `bg-sidebar` | 사이드바·보조 chrome |
| 떠 있는 표면 | `bg-panel` | 모달·팝오버·타일 |
| 낮은 강조 표면 | `bg-bg2`, `bg-bubble-user` | 구조화된 결과·추론·사용자 버블 |
| 경계 | `border-border`, `border-border-strong` | 기본 분리 / 입력 강조·강한 분리 |
| 본문 | `text-ink`, `text-ink2`, `text-ink3` | 핵심 / 설명·메타 / 부차적 힌트. 중요한 오류·값을 가장 흐린 색으로 숨기지 않는다. |
| 브랜드·파괴적 동작 | `rust`, `rust-soft` | 기존 브랜드 강조, 삭제 진입·확정. 일반 주 버튼을 rust로 새로 칠하지 않는다. |
| 제어 선택 | `toggle-on`, `selected`, `selected-soft` | 설정의 스위치·선택값. 버튼 pressed와 카탈로그 선택은 각 공통 UI의 규칙을 따른다. |
| 의미 상태 | `good`, `warn`, `bad`, `slate-dot` | 성공·주의·실패·중립. 아이콘·라벨과 함께 사용한다. |
| Git 변화 | `git-added`, `git-removed` | 변경량 텍스트. diff 행 배경은 기존 DiffTable의 tint 규칙을 따른다. |
| 사용량 | `indigo` 및 [usageTone.ts](../../../app/src/renderer/src/shared/ui/usageTone.ts) | Meter·UsageCircle의 의미 있는 구간. 별도 임계값·색 스케일을 만들지 않는다. |
| 툴팁 | `tooltip`, `tooltip-ink`, `tooltip-ink-muted` | 두 테마에서 같은 검정 표면·흰 글자. `TOOLTIP_SURFACE` 재사용. |
| 진행 artwork | `spinner` | SparkSpinner 원본 색. 테마별 임의 재정의 금지. |

`t1`~`t9`는 표면부터 텍스트까지의 기존 톤 별칭이다.
`fill-*`는 contained·ghost·선택·busy 표면을 위한 역할 토큰이며 실제 버튼 variant의 최종 외형은 [Button](../../../app/src/renderer/src/shared/ui/Button.tsx)이 소유한다.
특히 `fill-primary` 이름만 보고 주 버튼 색을 결정하지 않는다. 현재 `primary`는 `bg-ink`·`text-bg`의 중립 반전이다.

### 2.3 토큰 확장

- 기존 역할 토큰으로 표현할 수 있는지 먼저 확인한다. feature명·페이지명보다 역할을 이름으로 삼는다.
- 컴포넌트에 raw hex·RGB 팔레트를 추가하지 않는다. 기존 artwork·코드 하이라이트·카메라의 고정색은 그 구현의 제한된 예외다.
- 새 테마 의존 토큰은 `tokens.css`의 기본 `@theme`와 dark override를 함께 정의한다.
- 다른 시맨틱 토큰을 참조하는 별칭과 양 테마 공통 고정 artwork는 원본을 참조해 중복 정의하지 않는다.
- 새 테마나 전역 팔레트 교체는 컴포넌트 추가의 부수 작업으로 수행하지 않는다.

## 3. 활자와 읽기 밀도

[앱 루트](../../../app/src/renderer/src/styles/app.css)의 글자 크기를 기준으로 rem이 계산된다.
[type scale](../../../app/src/renderer/src/styles/tokens.css)의 `@theme inline`은 transcript 내부에서만 `--transcript-text-scale`을 곱한다.
본문 크기 설정을 바꾸기 위해 셸 전체에 배율이나 CSS transform을 적용하지 않는다.

| 역할 | 선택 | 기준 |
|---|---|---|
| 기본 UI·본문 | `text-body`, 앱 폰트 | 본문·설명·기본 읽기 |
| 메뉴·보조 본문 | `text-footnote` | 메뉴 행·설명·중간 메타 |
| 작은 메타 | `text-caption` | 상태 부연·배지·짧은 보조 문구 |
| 코드 | `text-code font-mono` | 명령·경로·코드·JSON |
| 패널 내 제목 | `text-heading` | 상세·구조화 결과의 제목 |
| 페이지 hero | 기존 ProjectsScreen·ExtensionsCatalogView의 serif 제목 | 카탈로그 상단에 한정. 메뉴·모든 카드에 확대 적용하지 않는다. |
| 표·시간·비용 | `tabular-nums`, 필요 시 `font-mono` | 값이 바뀌어도 열과 행의 폭이 흔들리지 않게 한다. |

`@theme inline`의 `--text-*`를 `var(--text-body)`처럼 직접 참조하지 않는다. `text-body` 등 유틸을 쓴다.
기존의 특수 크기가 필요한 경우 인접한 동일 역할의 컴포넌트를 따른다.
새로운 크기 계단을 feature마다 추가하지 않는다.

긴 제목·파일명·경로에는 부모 `min-w-0`, 짧은 행에는 `truncate`, 읽을 본문에는 `break-words`·`whitespace-pre-wrap`을 선택한다.
전체 값을 확인해야 하는 행에는 툴팁·상세 보기·복사를 제공한다.
한국어 기본 라벨과 다른 locale의 긴 라벨에서도 줄바꿈과 동작 영역을 확인한다.

본문 버블·어시스턴트 활자는 [`transcriptTypography`](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/typography.ts)를 상속한다. Markdown 구조·활자는 공통 Markdown 렌더러가 소유하고 하네스는 색만 바꾼다.

## 4. 간격·모서리·크기·표면 계층

| 역할 | 기준 |
|---|---|
| 아이콘·인라인 간격 | `gap-g*`와 기존 프리미티브의 padding을 우선한다. 버튼 내부 여백을 매 화면에서 덮어쓰지 않는다. |
| 컨트롤·카드 padding | `p-p*` 및 같은 종류의 기존 카드/폼을 따른다. 구조 scale은 rem이며 주석의 px 환산을 실제 고정 px로 복사하지 않는다. |
| 모서리 | `rounded-r3`~`rounded-r7` 역할 scale. 메뉴·작은 컨트롤은 작게, 모달·타일은 해당 공통 셸에 맡긴다. |
| 버튼 높이 | Button의 `compact`·`small`·`base`·`large` props로 선택한다. 기본은 `base`; 조밀한 도구 행은 기존 `small`·`compact` 선례를 따른다. |
| 분리 | 얇은 `border-border`가 기본. 같은 내용을 둘러싸는 카드·그림자를 중첩하지 않는다. |
| 부유 표면 | Popover·Modal의 그림자 또는 타일의 `effect-primary-elevated` 재사용. z-index를 키워 가림 문제를 덮지 않는다. |
| 읽기 열 | [ReadingColumn](../../../app/src/renderer/src/shared/ui/ReadingColumn.tsx)의 폭·거터를 transcript와 composer가 공유한다. 폭 설정은 [theme.ts](../../../app/src/renderer/src/shared/config/theme.ts)가 정본. |
| 좁은 pane | `min-w-0 min-h-0`와 명확한 스크롤 소유자를 둔다. 페이지 전체의 고정 폭으로 타일·사이드바를 밀어내지 않는다. |

카탈로그는 검색·탭·행·상세 pane 패턴을 사용한다.
타일·뷰어는 [ResizableSidePane](../../../app/src/renderer/src/shared/ui/ResizableSidePane.tsx)와 [PanelControls](../../../app/src/renderer/src/shared/ui/PanelControls.tsx)를 사용한다.
패널 확대는 해당 pane 안에서 이뤄지고 복원 시 폭·스크롤·초점을 보존한다.

## 5. 컨트롤 선택과 조합

### 5.1 버튼·아이콘·선택

| 목적 | 사용 | 주의 |
|---|---|---|
| 주요 완료 동작 | `Button variant="primary"` | 중립 반전. 같은 액션 묶음에서 주요 동작의 위계를 명확히 한다. |
| 보조·취소 | `contained` | 경계가 있는 중립 표면 |
| 툴바·가벼운 진입 | `uncontained` | hover·pressed는 Button에 맡긴다. |
| 삭제 확정 | `danger` | 기존 확인창 흐름과 연결한다. |
| 삭제 진입 | `danger-ghost` 또는 `MenuItem danger` | 목록에서 편집·삭제의 밀도를 일치시킨다. |
| 아이콘만 있는 동작 | `Button iconOnly`·KebabButton·CopyIconButton | 번역된 `aria-label`과 필요 시 `title` 제공 |
| 켜기·끄기 | `Toggle` | `label` 제공. 상태색은 toggle-on. |
| 단일·복수 옵션 | 기존 SettingsSelect·AuthKindChoices·하네스 질문 옵션 | 선택·focus·disabled 의미를 함께 구현한다. |

공통 [Icon](../../../app/src/renderer/src/shared/ui/Icon.tsx)의 아이콘 집합을 우선한다.
OpenCode 전용 artwork는 해당 하네스의 Icon·Wordmark를 재사용한다.
동작 아이콘을 임의의 이모지·새 아이콘 라이브러리·폰트 글리프로 대체하지 않는다.

### 5.2 메뉴·툴팁

메뉴 표면은 Popover, 메뉴 행은 MenuItem, 하위 메뉴는 CascadeMenu를 사용한다.
anchor 기준 배치·가장자리 flip·닫기를 재사용하고, 메뉴 항목과 클릭 영역의 폭을 맞춘다.
키보드 이동·선택·Escape·초점 복귀는 호출 화면에서도 확인한다. Popover만 추가했다고 메뉴의 키보드 처리가 완성되지는 않는다.

설명 툴팁은 `title`을 읽는 TooltipHost와 [tooltipStyle.ts](../../../app/src/renderer/src/shared/ui/tooltipStyle.ts)를 사용한다.
툴팁 안에 필수 동작 버튼이나 사용에 꼭 필요한 유일한 설명을 숨기지 않는다.
hover로 나타나는 조작에는 키보드 focus 진입 시의 노출도 제공한다.

### 5.3 입력·폼·모달

폼 입력은 Modal의 `MODAL_LABEL`·`MODAL_INPUT`, 자동 높이 입력은 AutoGrowTextarea, 이름 변경은 RenameInput을 재사용한다.
label과 입력을 연결하고 오류를 해당 필드 가까이에 배치한다.
설정 화면은 SettingsGroup·SettingsRow·SettingsSelect로 행·설명의 위계를 유지한다.

새 일반 모달은 Modal·ModalActions를 사용한다.
제목·본문·footer의 위계를 유지하고 busy 중 닫기·중복 제출을 정책에 맞게 차단한다.
현재 Modal에는 우상단 X가 없으며 Esc·backdrop·footer로 닫는다. 제목이 없으면 `ariaLabel`을 제공한다.

설정·검색·인증처럼 기존 전역 슬롯을 쓰는 모달은 [DOM 구조](dom-architecture.md)를 따른다.
일반 Modal은 body portal을 사용하므로 전역 슬롯 안에 backdrop을 이중으로 만들지 않는다.
포커스 진입·Tab 범위·Escape 우선순위·닫은 뒤 복귀는 새 흐름에서 직접 확인한다. 현재 공통 모달이 모든 접근성 요건을 자동 보장한다고 가정하지 않는다.

## 6. 콘텐츠와 도메인 패턴

| 영역 | 기준 / 재사용 |
|---|---|
| 셸·내비게이션 | Header·Sidebar·SidebarSection·SessionRow. 제목과 선택 상태, 고정·최근·프로젝트 구획을 보존한다. |
| 카탈로그 | CatalogTabs·CatalogSearch·CatalogListRow. 검색·필터·총계는 feature 소유, 상세는 공통 pane. 빈 결과와 아직 없는 데이터를 구별한다. |
| 사용자 메시지 | UserMessage·UserBubbleText. 첨부·메타·접기 상태를 유지하고 긴 원문을 임의 삭제하지 않는다. |
| AI 응답 | 하네스 registry의 AssistantMessage·Timeline. 스트리밍과 완료 후의 활자·폭을 일치시킨다. |
| Markdown·코드 | Markdown·StreamingMarkdown·CodeBlock. 기존 코드 테마·복사·가로 스크롤·메시지별 hover 스코프를 유지한다. |
| 도구 출력 | 하네스 ToolCard·ToolGroup과 body renderer를 선택한다. 제목·상태·요약을 먼저, 긴 로그·diff는 펼침 영역에 둔다. |
| 질문·승인 | 기존 하네스 Requests/RequestDock 정책을 따른다. Claude와 OpenCode의 입력 대체·추가 방식과 순서를 통합하지 않는다. |
| 진행·작업 | StatusLine·TaskStatusIcon·TaskProgressList. 상태 의미를 label과 아이콘으로 함께 보인다. |
| 계획·변경사항 | PlanTileContent·DiffReview·DiffTable. 파일·행 번호·증감·검토 동작의 대응을 보존한다. |
| 산출물·뷰어 | ArtifactCards·ArtifactViewer. 미리보기·코드·복사·저장·오류·재시도는 기존 요청 수명 계약을 따른다. HTML preview 보안 경계를 스타일 변경으로 우회하지 않는다. |
| 사용량·차트 | Meter·UsageCircle·TokensPerDayChart. 같은 단위·기간·임계값을 쓰고 툴팁은 공통 표면을 따른다. |
| 인증·설치·업데이트 | GateLogin·InstallerDialog·UpdateDialog. 작업 상태·진행률·실패 복구·재시작 동작을 명확히 한다. |
| 카메라·캡처 | CameraView·BayerPattern·Histogram은 이미지 내용과 chrome을 분리한다. 현재 카메라 목업과 CapturesView의 Future Scope 안내를 실제 연결·캡처 기능처럼 표시하지 않는다. |

전체 대응과 코드 링크는 [컴포넌트 카탈로그](design-components.md)에 있다.
상태 수명·데이터 흐름은 [state.md](state.md), [rendering.md](rendering.md), [ux-domains.md](ux-domains.md)를 따른다.

## 7. 상태·키보드·모션

| 상태 | 새 컴포넌트의 완료 기준 |
|---|---|
| 기본·hover·active | 기존 표면 토큰과 공통 control props 사용. 활성·선택·hover를 구별한다. |
| focus | `hide-focus-ring ring-focus` 또는 해당 공통 control의 focus-visible 처리. `outline-none`만 남기지 않는다. |
| disabled | 실제 `disabled` 또는 합당한 ARIA 상태와 이벤트 차단. 흐린 색만으로 비활성화하지 않는다. |
| busy·loading | 중복 실행을 막고 상태 라벨·기존 spinner를 사용한다. 진행 전후의 컨트롤 폭을 안정적으로 유지한다. |
| empty | 아직 없는 데이터·검색 결과 없음·로드 실패를 구별하고 가능한 다음 동작을 제공한다. |
| error | 설명과 복구 동작을 해당 영역에 둔다. 전역 오류는 기존 reportError→ErrorToastHost 경로를 따른다. 같은 오류를 중복 토스트로 만들지 않는다. |
| success | 저장·복사·다운로드 결과를 해당 control에서 확인할 수 있게 한다. 완료 후에도 disabled 상태에 갇히지 않게 한다. |
| 펼침·닫힘·전환 | `aria-expanded`·선택 상태, 초점·스크롤·초안 복원. 가려진 패널이 입력·키보드 이벤트를 받지 않게 한다. |

native button·input·select와 의미 있는 heading·label을 우선한다.
색상 상태에는 텍스트·아이콘을 함께 두고, 중요 본문·조작의 대비를 두 테마에서 확인한다.
키보드만으로 새 흐름의 열기·이동·선택·닫기·초점 복귀가 가능해야 한다. 기존 앱 전체의 접근성 audit 완료를 뜻하지 않는다.

작은 전환은 기존 Button·panel·shimmer 유틸을 재사용한다.
새 모션에는 `motion-reduce` 대응을 두고, 진행 상태가 움직임 없이도 읽히게 한다.
스피너·타일 애니메이션의 수치·artwork를 화면별로 복제하지 않는다.

## 8. 구현과 유지보수 계약

- Tailwind v4 유틸과 기존 토큰을 사용한다. 새 컴포넌트용 CSS 파일·전역 규칙을 추가하지 않는다.
- 정적 값은 클래스, 드래그 좌표·비율·측정된 grid 같은 동적 값만 inline style에 둔다.
- hover 그룹은 `group/<이름>`·`group-hover/<이름>:`로 격리한다. 중첩 코드블록·세션 행의 형제가 함께 반응하지 않게 한다.
- 공통 프리미티브를 `shared/ui`, 도메인 표시를 해당 feature, 조립을 pages/app에 둔다. 다른 feature의 컴포넌트를 직접 import해 스타일을 공유하지 않는다.
- 번역은 [shared/i18n](../../../app/src/renderer/src/shared/i18n/index.ts)의 `tr`와 locale 리소스를 사용한다. UI에 새 라벨 문자열을 직접 고정하지 않는다.
- 구조 마커는 [DOM 규약](dom-architecture.md)을 따른다. `app-frame-*`는 식별자이며 스타일의 대체물이 아니다.
- 컴포넌트를 신설·이동·삭제하면 같은 변경에서 카탈로그 경로·테마 범위·특수 규칙을 갱신한다. 같은 파일의 보조 컴포넌트도 해당 행의 규칙을 상속한다.
- 변경 보고에는 재사용한 컴포넌트·토큰과 확인한 테마·상태·폭·키보드 경로를 적는다. 미확인 시각 항목은 미확인으로 남긴다.
