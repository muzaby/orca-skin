# Renderer 컴포넌트 디자인 카탈로그

> [디자인 시스템](design-system.md)의 역할·테마·상태 기준을 파일별로 연결한다.
> 경로는 `app/src/renderer/src/` 기준이며 테스트·fixture를 제외한 TSX 진입점과 보조 표시 모듈을 포함한다.
> 한 파일의 내부/보조 컴포넌트는 해당 행을 상속한다. Provider·registry·hook도 시각 규칙을 우회하는 새 표면을 만들지 않도록 명시한다.

## 사용과 갱신

1. 먼저 디자인 시스템에서 테마 범위·프리미티브·상태 기준을 선택한다.
2. 아래에서 동일 역할의 파일을 열어 props·실제 토큰·수명 계약을 확인하고 재사용한다.
3. 신설·이동·삭제 시 같은 변경에서 해당 경로 행·특수 규칙을 갱신한다. 새 export의 역할이 달라지면 행에 이름과 기준을 보완한다.
4. 행은 색상 값·타입 계약의 사본이 아니다. 구체 값은 링크한 코드와 `styles/tokens.css`, 동작은 [rendering.md](rendering.md)·[state.md](state.md)를 따른다.

`.ts`의 appearance·registry 정책·tooltip·tone·syntax 같은 비시각 보조 모듈은 그 모듈을 사용하는 TSX 행과 디자인 시스템의 정본 링크를 함께 따른다.
카탈로그의 포함 여부는 스타일 준수 자체를 증명하지 않는다. 구현 후 양 테마·상태·폭·키보드 경로를 별도로 확인한다.


## 앱 셸·진입·페이지

app 또는 pages 조립은 하향 의존만 허용한다. 페이지는 feature UI를 배치하며 공통 색·레이아웃을 복제하지 않는다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [App.tsx](../../../app/src/renderer/src/App.tsx) | Provider·라우터·TooltipHost 합성 루트. 화면별 색·레이아웃을 이곳에 추가하지 않는다. |
| [app/AppLayout.tsx](../../../app/src/renderer/src/app/AppLayout.tsx) — `AppLayout` | Header·Sidebar·본문·overlay의 구조와 스크롤 소유자를 보존한다. |
| [app/BootFailureFrame.tsx](../../../app/src/renderer/src/app/BootFailureFrame.tsx) — `BootFailureFrame` | 실패 제목·원인·다음 동작의 위계를 유지하고 일반 오류를 성공 화면처럼 꾸미지 않는다. |
| [app/BootRedirector.tsx](../../../app/src/renderer/src/app/BootRedirector.tsx) — `BootRedirector` | 화면 전환 책임만 유지한다. 별도 로딩 셸·팔레트를 추가하지 않는다. |
| [app/ErrorToastLayer.tsx](../../../app/src/renderer/src/app/ErrorToastLayer.tsx) — `ErrorToastLayer` | 전역 오류 host 조립. 토스트 외형은 ErrorToastHost에 맡긴다. |
| [app/FullFrameShell.tsx](../../../app/src/renderer/src/app/FullFrameShell.tsx) — `FullFrameShell` | 전체 프레임·titlebar·본문 슬롯을 보존하고 페이지별 배경을 강제하지 않는다. |
| [app/GateFrame.tsx](../../../app/src/renderer/src/app/GateFrame.tsx) — `GateFrame` | 로그인·window control·개발 패널 배치. 창 드래그와 입력 클릭 영역을 분리한다. |
| [app/Header.tsx](../../../app/src/renderer/src/app/Header.tsx) — `Header` | 작은 툴바·버전/업데이트 동작. 메뉴는 Popover·MenuItem을 재사용한다. |
| [app/OverlayLayer.tsx](../../../app/src/renderer/src/app/OverlayLayer.tsx) — `OverlayLayer` | 전역 overlay·modal 슬롯의 배경·상태 책임. backdrop을 중첩하지 않는다. |
| [app/RootGate.tsx](../../../app/src/renderer/src/app/RootGate.tsx) — `RootGate` | 부팅·인증·앱 진입 분기. 각 상태의 셸을 재사용한다. |
| [app/Sidebar.tsx](../../../app/src/renderer/src/app/Sidebar.tsx) — `SIDEBAR_MIN_WIDTH`, `SIDEBAR_MAX_WIDTH`, `SIDEBAR_DEFAULT_WIDTH`, `Sidebar` | sidebar 표면·접힘·리사이즈·nav 선택 위계를 유지한다. |
| [app/SidebarUserButton.tsx](../../../app/src/renderer/src/app/SidebarUserButton.tsx) — `SidebarUserButton` | 프로필·보조 라벨·사용자 메뉴의 밀도를 sidebar에 맞춘다. |
| [app/WinControls.tsx](../../../app/src/renderer/src/app/WinControls.tsx) — `WinControls` | 플랫폼별 창 제어·no-drag 클릭 영역·닫기 hover를 보존한다. |
| [app/boot/BootScreen.tsx](../../../app/src/renderer/src/app/boot/BootScreen.tsx) — `BootScreen` | 부팅 단계·브랜드·실패 안내를 구별하고 의미 없는 무한 진행을 추가하지 않는다. |
| [app/hooks/useArtifactCatalogViewer.tsx](../../../app/src/renderer/src/app/hooks/useArtifactCatalogViewer.tsx) | 카탈로그 뷰어 조립 슬롯. 공통 ArtifactViewer의 chrome을 재사용한다. |
| [app/hooks/useSidebarSlots.tsx](../../../app/src/renderer/src/app/hooks/useSidebarSlots.tsx) | sidebar feature 슬롯 연결. 시각 변형은 각 슬롯의 소유 feature에서 한다. |
| [app/router.tsx](../../../app/src/renderer/src/app/router.tsx) — `AppRouter` | 페이지 진입·레이아웃 조립. 도메인별 UI를 라우터에 구현하지 않는다. |
| [main.tsx](../../../app/src/renderer/src/main.tsx) | 앱 mount·전역 스타일 진입점. 테마 baseline은 styles에서 소유한다. |
| [pages/AgentPage.tsx](../../../app/src/renderer/src/pages/AgentPage.tsx) — `AgentPage` | 페이지 조립만 담당한다. 해당 feature의 화면·catalog·pane·읽기 열을 재사용하고 도메인 로직·별도 팔레트를 넣지 않는다. |
| [pages/ArtifactsPage.tsx](../../../app/src/renderer/src/pages/ArtifactsPage.tsx) — `ArtifactsPage` | 페이지 조립만 담당한다. 해당 feature의 화면·catalog·pane·읽기 열을 재사용하고 도메인 로직·별도 팔레트를 넣지 않는다. |
| [pages/CapturesPage.tsx](../../../app/src/renderer/src/pages/CapturesPage.tsx) — `CapturesPage` | 페이지 조립만 담당한다. 해당 feature의 화면·catalog·pane·읽기 열을 재사용하고 도메인 로직·별도 팔레트를 넣지 않는다. |
| [pages/ChatPage.tsx](../../../app/src/renderer/src/pages/ChatPage.tsx) — `ChatPage` | 페이지 조립만 담당한다. 해당 feature의 화면·catalog·pane·읽기 열을 재사용하고 도메인 로직·별도 팔레트를 넣지 않는다. |
| [pages/NewChatLandingPage.tsx](../../../app/src/renderer/src/pages/NewChatLandingPage.tsx) — `NewChatLandingPage` | 페이지 조립만 담당한다. 해당 feature의 화면·catalog·pane·읽기 열을 재사용하고 도메인 로직·별도 팔레트를 넣지 않는다. |
| [pages/PluginsPage.tsx](../../../app/src/renderer/src/pages/PluginsPage.tsx) — `PluginsPage` | 페이지 조립만 담당한다. 해당 feature의 화면·catalog·pane·읽기 열을 재사용하고 도메인 로직·별도 팔레트를 넣지 않는다. |
| [pages/ProjectLandingPage.tsx](../../../app/src/renderer/src/pages/ProjectLandingPage.tsx) — `ProjectLandingPage` | 페이지 조립만 담당한다. 해당 feature의 화면·catalog·pane·읽기 열을 재사용하고 도메인 로직·별도 팔레트를 넣지 않는다. |
| [pages/ProjectsPage.tsx](../../../app/src/renderer/src/pages/ProjectsPage.tsx) — `ProjectsPage` | 페이지 조립만 담당한다. 해당 feature의 화면·catalog·pane·읽기 열을 재사용하고 도메인 로직·별도 팔레트를 넣지 않는다. |

## 공통 UI·테마

Orca 공통 토큰이 기본이다. stage·개발 전용 표면은 아래 행의 제한을 따른다. 같은 파일의 보조 컴포넌트도 이 규칙을 상속한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [shared/theme/TweakProvider.tsx](../../../app/src/renderer/src/shared/theme/TweakProvider.tsx) — `TweakProvider` | 루트 테마·폰트·읽기 설정 적용. 컴포넌트별 테마 상태를 만들지 않는다. |
| [shared/ui/AuthKindChoices.tsx](../../../app/src/renderer/src/shared/ui/AuthKindChoices.tsx) — `AuthKindChoices` | 인증 방식 선택을 같은 크기·선택 상태로 표시하고 옵션 label을 제공한다. |
| [shared/ui/AutoGrowTextarea.tsx](../../../app/src/renderer/src/shared/ui/AutoGrowTextarea.tsx) — `AutoGrowTextarea` | 자동 높이·줄 수·입력 글꼴을 유지한다. 새 textarea 높이 계산을 복제하지 않는다. |
| [shared/ui/Avatar.tsx](../../../app/src/renderer/src/shared/ui/Avatar.tsx) — `Avatar` | kind별 사용자·Claude·OpenCode 표식의 크기·모서리·글리프를 해당 primitive에 맡긴다. |
| [shared/ui/BayerPattern.tsx](../../../app/src/renderer/src/shared/ui/BayerPattern.tsx) — `BayerPattern` | 센서 이미지 표시용 stage 배경·그리드·표적. 일반 카드 장식으로 사용하지 않는다. |
| [shared/ui/Button.tsx](../../../app/src/renderer/src/shared/ui/Button.tsx) — `Button` | variant·size·busy·pressed·dropdown props 사용. primary=중립 반전, danger=rust; 배경 span·isolate 유지. |
| [shared/ui/CascadeMenu.tsx](../../../app/src/renderer/src/shared/ui/CascadeMenu.tsx) — `CascadeMenu`, `CascadeBody` | MenuItem 표면·계단식 submenu·키보드·초점·viewport 배치를 재사용한다. heading은 MenuTitle로 렌더하며 키보드 탐색에서 건너뛴다. disabled submenu는 회색이며 확장하지 않는다. 선택적 status 공은 제목 왼쪽의 수동 상태 표시다. 오른쪽 secondary는 주 액션과 독립된 클릭/Enter/Space 스위치이며 처리 중에는 원형 손잡이 내부 spinner와 해당 제어의 중복 입력 방지를 적용한다. 다른 항목은 계속 사용한다. |
| [shared/ui/CatalogListRow.tsx](../../../app/src/renderer/src/shared/ui/CatalogListRow.tsx) — `CatalogListRow` | 아이콘→제목·메타→행 동작 위계. 선택/hover를 구별하고 제목과 동작 버튼을 중첩하지 않는다. |
| [shared/ui/CatalogSearch.tsx](../../../app/src/renderer/src/shared/ui/CatalogSearch.tsx) — `CatalogSearch` | 검색 열기·입력·닫기·초점 복귀를 공통 형태로 유지한다. |
| [shared/ui/CatalogTabs.tsx](../../../app/src/renderer/src/shared/ui/CatalogTabs.tsx) — `CatalogTabs` | 선택 탭 표면·방향키·Home/End·ARIA 연결을 유지한다. |
| [shared/ui/ConfirmDialogHost.tsx](../../../app/src/renderer/src/shared/ui/ConfirmDialogHost.tsx) — `ConfirmDialogHost` | 전역 확인 요청을 Modal·ModalActions로 표시한다. feature별 확인창 복제를 피한다. |
| [shared/ui/CopyIconButton.tsx](../../../app/src/renderer/src/shared/ui/CopyIconButton.tsx) — `CopyIconButton` | 복사·완료 피드백·tooltip을 재사용하며 아이콘 크기를 인접 액션과 맞춘다. |
| [shared/ui/DotsSpinner.tsx](../../../app/src/renderer/src/shared/ui/DotsSpinner.tsx) — `DotsSpinner` | 기존 dot-wave 크기 옵션·타이밍을 사용한다. 소비처에서 dot 애니메이션을 재구현하지 않는다. |
| [shared/ui/ErrorToastHost.tsx](../../../app/src/renderer/src/shared/ui/ErrorToastHost.tsx) — `ErrorToastHost` | toast 역할 토큰·설명·닫기·동작 영역·축소 모션을 유지한다. |
| [shared/ui/FloatingPanel.tsx](../../../app/src/renderer/src/shared/ui/FloatingPanel.tsx) — `FloatingPanel`, `PanelSection`, `PanelButton`, `PanelToggle`, `PanelRadio`, `PanelSelect`, `PanelSlider` | 개발 패널 전용 floating-panel 토큰·드래그·접기를 사용한다. 제품 modal보다 높은 z를 일반화하지 않는다. |
| [shared/ui/Histogram.tsx](../../../app/src/renderer/src/shared/ui/Histogram.tsx) — `Histogram` | stage 배경 위 RGB 채널 분포. 현재 생성 샘플을 실제 센서 데이터처럼 설명하지 않는다. |
| [shared/ui/Icon.tsx](../../../app/src/renderer/src/shared/ui/Icon.tsx) — `Icon` | 등록된 SVG·currentColor·size API를 사용하고 임의 아이콘 세트를 추가하지 않는다. |
| [shared/ui/KebabButton.tsx](../../../app/src/renderer/src/shared/ui/KebabButton.tsx) — `KebabButton` | 행·카드의 보조 메뉴 진입점. 번역된 tooltip·접근성 이름과 메뉴 anchor를 유지한다. |
| [shared/ui/MenuItem.tsx](../../../app/src/renderer/src/shared/ui/MenuItem.tsx) — `MenuItem`, `MenuTitle` | MenuItem·MenuTitle로 메뉴 행·설명·섹션 위계를 공유한다. MenuTitle의 leading 슬롯에 출처 브랜드 로고를, trailing 슬롯에 수동 진행 표시를 넣으며 제목은 선택 대상이 아니다. 파괴적 항목은 danger. disabled에서도 일반 커서(cursor-default)를 유지하며 회색 표시와 입력 차단을 적용한다. |
| [shared/ui/Meter.tsx](../../../app/src/renderer/src/shared/ui/Meter.tsx) — `Meter` | ratio·tone API와 공통 의미색을 사용한다. 수치와 함께 표시한다. |
| [shared/ui/Modal.tsx](../../../app/src/renderer/src/shared/ui/Modal.tsx) — `MODAL_BACKDROP_CLASS`, `Modal`, `MODAL_LABEL`, `MODAL_INPUT`, `ModalActions` | Modal·ModalActions·MODAL_LABEL·MODAL_INPUT 재사용. busy 닫기 정책·크롬리스 ariaLabel 확인. |
| [shared/ui/OrcaLogo.tsx](../../../app/src/renderer/src/shared/ui/OrcaLogo.tsx) — `OrcaLogo` | 승인된 Orca artwork의 비율·색 경계를 보존한다. 새 whale 그림으로 교체하지 않는다. |
| [shared/ui/PanelControls.tsx](../../../app/src/renderer/src/shared/ui/PanelControls.tsx) — `PanelExpandButton`, `PanelCloseButton` | PanelExpandButton·PanelCloseButton의 아이콘·공통 번역·상태·대상 접근성 이름을 재사용한다. |
| [shared/ui/Popover.tsx](../../../app/src/renderer/src/shared/ui/Popover.tsx) — `Popover` | anchor·placement·align·flip·바깥 클릭·Escape 재사용. 메뉴 키보드는 소비처와 함께 확인한다. |
| [shared/ui/Rail.tsx](../../../app/src/renderer/src/shared/ui/Rail.tsx) — `Rail`, `RailItem` | 설정·카탈로그 모달의 좌측 탭 레일. sidebar 표면·중립 선택·nested 들여쓰기·aria-current를 유지한다. |
| [shared/ui/ReadingColumn.tsx](../../../app/src/renderer/src/shared/ui/ReadingColumn.tsx) — `ReadingColumn` | transcript와 composer의 폭·거터·min-w-0를 공유한다. 설정값을 로컬 상수로 복사하지 않는다. |
| [shared/ui/RenameInput.tsx](../../../app/src/renderer/src/shared/ui/RenameInput.tsx) — `RenameInput` | 인라인 편집의 focus·확정·취소와 원래 행 크기를 유지한다. |
| [shared/ui/ResizableSidePane.tsx](../../../app/src/renderer/src/shared/ui/ResizableSidePane.tsx) — `ResizableSidePane` | pane 단위 폭·확대·복원·키보드/포인터 리사이즈와 iframe 경계 처리를 재사용한다. |
| [shared/ui/SidebarSection.tsx](../../../app/src/renderer/src/shared/ui/SidebarSection.tsx) — `CollapsibleSection` | 구획 제목·우측 동작·접힘·본문 여백을 sidebar 패턴으로 통일한다. |
| [shared/ui/SparkSpinner.tsx](../../../app/src/renderer/src/shared/ui/SparkSpinner.tsx) — `SparkSpinner` | 원본 artwork·spinner 고정색·진행 애니메이션을 사용하고 테마별 재색칠하지 않는다. |
| [shared/ui/Status.tsx](../../../app/src/renderer/src/shared/ui/Status.tsx) — `Dot`, `Status` | 의미 tone에 visible/accessibility label·tooltip을 함께 둔다. 연결 상태 공은 수동 표시이며 활성 스위치와 구분한다. |
| [shared/ui/Toggle.tsx](../../../app/src/renderer/src/shared/ui/Toggle.tsx) — `Toggle`, `ToggleIndicator` | Toggle은 on·label API와 switch ARIA를 제공한다. 메뉴의 ToggleIndicator는 손잡이 transform·배경색200ms 전환을 사용하며 reduced motion에서는 전환하지 않는다. 선택 blue·off border-strong과 흰색 원형 손잡이를 유지한다. busy spinner는 손잡이 안에 표시하고 축소 모션에서는 회전을 멈춘다. 접근성 이름·checked/busy·중복 입력 방지는 바깥 메뉴 버튼이 맡는다. |
| [shared/ui/TooltipHost.tsx](../../../app/src/renderer/src/shared/ui/TooltipHost.tsx) — `TooltipHost` | title 기반 tooltip을 루트에서 표시한다. feature별 title host를 추가하지 않는다. |
| [shared/ui/UsageCircle.tsx](../../../app/src/renderer/src/shared/ui/UsageCircle.tsx) — `UsageCircle` | 사용량 ratio·공통 tone·숫자 피드백을 유지하고 Meter와 다른 임계값을 만들지 않는다. |
| [shared/ui/markdown/CodeBlock.tsx](../../../app/src/renderer/src/shared/ui/markdown/CodeBlock.tsx) — `CodeBlock` | 코드 header·언어·복사·스크롤·Shiki 테마 유지. hover는 group/codeblock로 격리한다. |
| [shared/ui/markdown/Markdown.tsx](../../../app/src/renderer/src/shared/ui/markdown/Markdown.tsx) — `Markdown` | 공통 prose·표·인라인 코드·링크·CodeBlock을 재사용한다. 허용되지 않은 HTML을 직접 삽입하지 않는다. |

## 채팅 공통 진입·조립

하네스 선택은 registry/조립 계층이 담당한다. wrapper에서 Claude·OpenCode의 고유 표면을 하나로 재색칠하지 않는다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/chat/components/AgentModeToggle.tsx](../../../app/src/renderer/src/features/chat/components/AgentModeToggle.tsx) — `AgentModeToggle` | Work/Code 모드의 선택·disabled·tooltip을 유지하고 하네스별 가용 정책을 우회하지 않는다. |
| [features/chat/components/ApprovalCard.tsx](../../../app/src/renderer/src/features/chat/components/ApprovalCard.tsx) — `ApprovalCard` | 계획 검토 시 입력을 대체하는 카드. 수락·수정·거부·주석 chip의 위계를 유지하며 도구/질문 요청은 해당 하네스 표면에 둔다. |
| [features/chat/components/ArtifactCard.tsx](../../../app/src/renderer/src/features/chat/components/ArtifactCard.tsx) — `ArtifactCard` | 산출물 카드의 공통 진입점. 파일 제목·종류·상태·보기 동작의 위계를 유지한다. |
| [features/chat/components/AutomaticFeedDebugSection.tsx](../../../app/src/renderer/src/features/chat/components/AutomaticFeedDebugSection.tsx) — `AutomaticFeedDebugSection` | 자동 피드 개발 제어. 실제 transcript의 제품 상태 표시와 구분한다. |
| [features/chat/components/ChatTile.tsx](../../../app/src/renderer/src/features/chat/components/ChatTile.tsx) — `ChatTile` | 제목·transcript·composer·패널의 조립과 읽기 열을 보존한다. |
| [features/chat/components/ChatTitleBar.tsx](../../../app/src/renderer/src/features/chat/components/ChatTitleBar.tsx) — `ChatTitleBar` | 폴더 아이콘→제목·rename·우측 도구 배치. 텍스트 truncation과 메뉴 클릭 영역을 보존한다. |
| [features/chat/components/ChatView.tsx](../../../app/src/renderer/src/features/chat/components/ChatView.tsx) — `ChatView` | 세션별 채팅·타일 조립. 배경·테마를 세션마다 새로 정의하지 않는다. |
| [features/chat/components/Composer.tsx](../../../app/src/renderer/src/features/chat/components/Composer.tsx) — `ComposerPanelStackView`, `Composer` | 공통 입력 controller와 하네스 표면 조립. 전환 시 초안·첨부·IME를 보존한다. |
| [features/chat/components/CwdButton.tsx](../../../app/src/renderer/src/features/chat/components/CwdButton.tsx) — `CwdButton` | 작업 경로 진입 버튼의 축약·전체 경로 확인·키보드 이름을 유지한다. |
| [features/chat/components/CwdPanel.tsx](../../../app/src/renderer/src/features/chat/components/CwdPanel.tsx) — `CwdPanel` | 작업 경로·추가 디렉터리 선택. 경로는 mono·긴 값은 안전한 줄바꿈. |
| [features/chat/components/Landing.tsx](../../../app/src/renderer/src/features/chat/components/Landing.tsx) — `Landing` | 새 대화의 브랜드·읽기 열·입력 위계. 하네스별 브랜드 슬롯을 사용한다. |
| [features/chat/components/LandingHeader.tsx](../../../app/src/renderer/src/features/chat/components/LandingHeader.tsx) — `LandingHeader` | 새 대화와 프로젝트에서 현재 하네스의 기존 헤더를 선택한다. Claude 모드 문구와 OpenCode 브랜드를 재사용하고 Composer 수명을 유지한다. |
| [features/chat/components/Notice.tsx](../../../app/src/renderer/src/features/chat/components/Notice.tsx) — `Notice` | 대화 문맥의 안내·오류를 본문과 구별하고 과도한 강조색을 늘리지 않는다. |
| [features/chat/components/StatusLine.tsx](../../../app/src/renderer/src/features/chat/components/StatusLine.tsx) — `StatusLine` | 진행 아이콘·상태 문구·경과값을 같은 작은 행에 정렬한다. |
| [features/chat/components/UsagePanel.tsx](../../../app/src/renderer/src/features/chat/components/UsagePanel.tsx) — `UsagePanel` | 기간·비용·컨텍스트·설정 진입을 같은 공통 meter·숫자 표기로 표시한다. |
| [features/chat/components/composer/GitRow.tsx](../../../app/src/renderer/src/features/chat/components/composer/GitRow.tsx) — `GitRowView`, `GitRow` | composer 상단 Git 문맥. branch·변경량·worktree 조작을 같은 작은 행에 정렬한다. |
| [features/chat/components/composer/ModelMenu.tsx](../../../app/src/renderer/src/features/chat/components/composer/ModelMenu.tsx) — `ModelMenu` | 모델·provider 선택은 하네스 정책과 MenuItem 위계를 따르고 긴 이름을 처리한다. Claude/OpenCode 그룹 제목 왼쪽에 명시 브랜드 색의 HarnessLogo를 표시한다. |
| [features/chat/components/markdown/StreamingMarkdown.tsx](../../../app/src/renderer/src/features/chat/components/markdown/StreamingMarkdown.tsx) — `StreamingMarkdown` | 완료 Markdown과 같은 폭·활자·코드 스타일. 토큰 도착 때 전체 본문을 불필요하게 재배치하지 않는다. |
| [features/chat/components/rightpanel/NativeResourcesTile.tsx](../../../app/src/renderer/src/features/chat/components/rightpanel/NativeResourcesTile.tsx) — `NativeResourcesTileContent`, `NativeResourcesTileHeader` | Code 전용 타일이며 제목은 normal weight·명시 브랜드 색·하네스 상태·프로젝트 이름을 사용한다. hover에는 catalog 프로젝트 경로(cwd fallback)를 표시한다. MCP와 native plugin 그룹을 직접 펼쳐 공통 CascadeBody 행·상태 공·독립 async 스위치·설정 위치 열기를 재사용한다. 같은 session/backend cache를 Composer와 공유하고 닫기·확대·복원은 타일 셸을 따른다. |
| [features/chat/harnesses/opencode/rightpanel/NativeResources.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/NativeResources.tsx) — `OpenCodeNativeResourcesTile` | 첫 입력 전에는 컴포저와 같은 준비 목록을 공통 `NativeResourcesTileView`에 전달한다. MCP/plugin은 각각 완료되는 대로 표시하고 읽기 전용 행·고정 새로고침 버튼을 쓴다. 파일이 없는 동적 항목에는 열기 동작을 제공하지 않는다. 첫 입력 이후 공통 runtime 타일로 전환한다. |
| [features/chat/components/rightpanel/RightPanel.tsx](../../../app/src/renderer/src/features/chat/components/rightpanel/RightPanel.tsx) — `RightPanel` | 하네스별 패널 진입 조립. 상세·확대·숨김 상태에서 수명과 초점을 유지하며 주입된 프로젝트 이름을 타일 헤더로 전달한다. |
| [features/chat/components/transcript/AssistantMessage.tsx](../../../app/src/renderer/src/features/chat/components/transcript/AssistantMessage.tsx) — `AssistantMessage`, `AssistantSegment` | 응답의 본문·메타·액션과 하네스별 renderer 선택을 유지한다. |
| [features/chat/components/transcript/HarnessScrollController.tsx](../../../app/src/renderer/src/features/chat/components/transcript/HarnessScrollController.tsx) — `HarnessScrollController` | 하네스의 스크롤 controller만 선택한다. 공통 선택·읽기 정책을 임의로 강제하지 않는다. |
| [features/chat/components/transcript/LineageBanner.tsx](../../../app/src/renderer/src/features/chat/components/transcript/LineageBanner.tsx) — `LineageBanner` | 세션 계보·이동 동작을 낮은 강조 행으로 표시하고 원문과 구별한다. |
| [features/chat/components/transcript/PendingAssistantStatus.tsx](../../../app/src/renderer/src/features/chat/components/transcript/PendingAssistantStatus.tsx) — `PendingAssistantStatus` | 응답 대기 상태의 하네스 표시를 선택한다. 별도 spinner·문구를 중복 표시하지 않는다. |
| [features/chat/components/transcript/ToolGroup.tsx](../../../app/src/renderer/src/features/chat/components/transcript/ToolGroup.tsx) — `ToolGroup` | 같은 목적의 도구를 요약 행과 펼침으로 묶고 상태·개수를 표시한다. |
| [features/chat/components/transcript/TranscriptView.tsx](../../../app/src/renderer/src/features/chat/components/transcript/TranscriptView.tsx) — `TranscriptView` | 하네스 viewport·본문 배율·가상화 경계 유지. 읽는 위치와 선택 영역을 보존한다. |
| [features/chat/harnesses/SubmitButton.tsx](../../../app/src/renderer/src/features/chat/harnesses/SubmitButton.tsx) — `HarnessSubmitButton` | 보내기·중단·busy·disabled 상태와 접근성 이름을 하네스 정책에 맞게 표시한다. |

## 공유 composer

입력 controller의 초안·첨부·IME 수명과 ReadingColumn을 보존한다. 버튼/chip 외형은 주입된 하네스 슬롯을 사용한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/chat/harnesses/common/composer/AnchoredDropdown.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/AnchoredDropdown.tsx) — `AnchoredDropdown` | 자동완성 anchor·폭·viewport 경계를 입력과 맞춘다. 메뉴를 입력 영역 밖에 방치하지 않는다. |
| [features/chat/harnesses/common/composer/AttachMenu.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/AttachMenu.tsx) — `AttachMenu` | 파일 추가는 Material Attach File 아이콘. 스킬·플러그인 패널은 출처 제목+로고 아래 단일 목록이다. 현재 하네스 스킬·native plugin 스킬·Orcinus orca·lock 등록 agents 스킬만 표시하고 스킬 설명은 툴팁에 둔다. 플러그인은 연결된 native/Orca MCP와 valid Orca 플러그인 이름만 표시한다. 재개·재열기에서 갱신하고 살아 있는 generation의 관측을 navigation·부분 실패에도 유지한다. 갱신/partial 안내는 없다. native 명령은 초안 앞, MCP 요청은 커서에 넣으며 자동 전송하지 않는다. |
| [features/chat/harnesses/common/composer/AttachmentChip.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/AttachmentChip.tsx) — `AttachmentChip` | 파일명·종류·제거를 조밀하게 표시한다. 긴 이름이 제거 버튼을 밀어내지 않게 한다. |
| [features/chat/harnesses/common/composer/AttachmentThumb.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/AttachmentThumb.tsx) — `AttachmentThumb` | 이미지 미리보기·크기·제거 위치를 유지하고 파일 chip과 간격을 맞춘다. |
| [features/chat/harnesses/common/composer/AttachmentTray.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/AttachmentTray.tsx) — `AttachmentTray` | 첨부 chip·thumb을 공통 간격으로 감싸고 입력·전송 영역을 가리지 않는다. |
| [features/chat/harnesses/common/composer/AutocompleteSectionHeader.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/AutocompleteSectionHeader.tsx) — `AutocompleteSectionHeader` | 스킬·멘션 후보의 출처 구획 제목을 동일한 활자·인셋으로 표시한다. |
| [features/chat/harnesses/common/composer/BranchChip.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/BranchChip.tsx) — `BranchChip` | 브랜치 이름·상태·메뉴 진입을 composer chip 크기에 맞춘다. |
| [features/chat/harnesses/common/composer/BranchMenu.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/BranchMenu.tsx) — `BranchMenu` | 브랜치 목록·선택·검색·동작의 위계를 유지하고 변경 중 중복 전환을 막는다. |
| [features/chat/harnesses/common/composer/BranchSwitchActions.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/BranchSwitchActions.tsx) — `BranchSwitchActions` | 브랜치 전환의 취소·계속·복구 동작을 같은 버튼 계층으로 표시한다. |
| [features/chat/harnesses/common/composer/BranchSwitchDialog.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/BranchSwitchDialog.tsx) — `BranchSwitchDialog` | 전환 선택·진행·실패를 Modal 패턴으로 구별하고 위험한 동작을 일반 확정으로 꾸미지 않는다. |
| [features/chat/harnesses/common/composer/CheckoutErrorBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/CheckoutErrorBody.tsx) — `CheckoutErrorBody` | checkout 오류의 경로·원인·복구 안내를 읽을 수 있는 mono/본문 위계로 표시한다. |
| [features/chat/harnesses/common/composer/ComposerChip.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/ComposerChip.tsx) — `ComposerChip` | 모드·모델·경로용 공통 chip. 선택·dropdown·disabled와 줄 높이를 props로 제어한다. |
| [features/chat/harnesses/common/composer/ComposerDecorationLayer.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/ComposerDecorationLayer.tsx) — `ComposerDecorationLayer` | mirror와 실제 입력의 글꼴·줄바꿈·padding·스크롤을 정확히 맞춘다. `/스킬` 배경과 `@플러그인`·파일 참조 배경을 구별하며 플러그인과 파일은 같은 참조색을 사용한다. IME caret를 가리지 않는다. |
| [features/chat/harnesses/common/composer/ComposerInputController.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/ComposerInputController.tsx) — `ComposerInputController` | 입력·첨부·자동완성 수명 소유자. 테마 전환 때 controller key를 바꿔 remount하지 않는다. |
| [features/chat/harnesses/common/composer/ComposerInputSurface.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/ComposerInputSurface.tsx) — `ComposerInputSurface` | textarea·mirror·포인터 영역과 하네스 appearance를 조립한다. 입력 스케일과 장식 스케일을 맞춘다. |
| [features/chat/harnesses/common/composer/ExtraDirChip.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/ExtraDirChip.tsx) — `ExtraDirChip` | 추가 디렉터리 경로·제거를 공통 chip 밀도로 표시한다. |
| [features/chat/harnesses/common/composer/GitIdentityMenu.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/GitIdentityMenu.tsx) — `GitIdentityMenu` | Git identity 선택·설명은 메뉴 위계를 따르고 긴 이름·주소를 처리한다. |
| [features/chat/harnesses/common/composer/GitIdentityMenus.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/GitIdentityMenus.tsx) — `GitIdentityMenus` | identity 메뉴 조립과 anchor 연결. 동일 메뉴 표면을 복제하지 않는다. |
| [features/chat/harnesses/common/composer/MentionAutocomplete.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/MentionAutocomplete.tsx) — `MentionAutocomplete` | 경로/Plugin 후보의 구획·선택·키보드·전체 경로 확인과 입력 focus를 유지한다. |
| [features/chat/harnesses/common/composer/RequirementTray.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/RequirementTray.tsx) — `RequirementTray` | 사용자 요구 첨부를 입력과 연결된 낮은 강조 영역으로 표시하고 diff와 본문을 구별한다. |
| [features/chat/harnesses/common/composer/SkillAutocomplete.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/SkillAutocomplete.tsx) — `SkillAutocomplete` | 스킬 출처·이름·설명·선택 행을 멘션 메뉴와 같은 header/row 위계로 표시한다. |
| [features/chat/harnesses/common/composer/WorktreeToggle.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/composer/WorktreeToggle.tsx) — `WorktreeToggle` | 격리 worktree 선택 상태와 사용 불가 이유를 명확히 표시한다. |

## 공유 transcript

Orca 본문·버블·의미 상태 토큰을 사용한다. 메시지별 key·접힘·선택·hover 스코프를 보존한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/chat/harnesses/common/transcript/AgentTaskRow.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/AgentTaskRow.tsx) — `AgentTaskRow` | 하위 에이전트 작업의 이름·상태·진입 동작을 조밀한 한 행으로 표시한다. |
| [features/chat/harnesses/common/transcript/ArtifactCards.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/ArtifactCards.tsx) — `ArtifactCards` | 출력 카드의 파일명·종류·상태·열기/저장 동작. 원문 메시지 연결과 중복 표시 정책을 유지한다. |
| [features/chat/harnesses/common/transcript/AssistantMessage.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/AssistantMessage.tsx) — `AssistantMessage` | 텍스트→도구→텍스트의 본문 순서·segment identity·미완료 표시를 보존한다. 메타·복사 동작은 턴 단위 표면에 맡긴다. |
| [features/chat/harnesses/common/transcript/CompactBoundaryMarker.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/CompactBoundaryMarker.tsx) — `CompactBoundaryMarker` | 문맥 압축 경계를 낮은 강조 구분자로 표시하고 대화 본문처럼 보이지 않게 한다. |
| [features/chat/harnesses/common/transcript/DiffTable.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/DiffTable.tsx) — `DiffTable` | 행 번호·추가/삭제 기호·tint·코드·가로 스크롤 유지. 색상만으로 diff를 구별하지 않는다. |
| [features/chat/harnesses/common/transcript/ForegroundShellActions.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/ForegroundShellActions.tsx) — `ForegroundShellActions` | 실행 중 shell의 백그라운드 전환 버튼·진행 비활성·실패 안내를 작은 보조 액션으로 표시한다. 세션 전환 후 지각 응답을 반영하지 않는다. |
| [features/chat/harnesses/common/transcript/ForkBoundaryMarker.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/ForkBoundaryMarker.tsx) — `ForkBoundaryMarker` | 분기 경계·출처·이동을 중립 구분 행으로 표시한다. |
| [features/chat/harnesses/common/transcript/InlineSubagentDetail.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/InlineSubagentDetail.tsx) — `InlineSubagentDetail` | 하위 작업 상세를 같은 transcript 밀도로 표시하고 펼침 시 부모 선택·스크롤을 보존한다. |
| [features/chat/harnesses/common/transcript/MessageMeta.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/MessageMeta.tsx) — `MessageMeta` | 시간·모델·사용량 등 메타는 보조 활자로, 숫자는 고정 자릿수 폭으로 표시한다. |
| [features/chat/harnesses/common/transcript/PendingSteerTurn.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/PendingSteerTurn.tsx) — `PendingSteerTurn` | 대기 입력·즉시 보내기·취소를 현재 응답과 구별하고 입력 원문을 유지한다. |
| [features/chat/harnesses/common/transcript/StatusLine.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/StatusLine.tsx) — `StatusLine` | 진행 아이콘·상태 문구·경과값을 같은 작은 행에 정렬한다. |
| [features/chat/harnesses/common/transcript/SubagentNoticeRow.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/SubagentNoticeRow.tsx) — `SubagentNoticeRow` | 하위 작업 알림·상태·상세 진입을 일반 assistant 본문과 구별한다. |
| [features/chat/harnesses/common/transcript/TranscriptActionRow.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/TranscriptActionRow.tsx) — `TranscriptActionRow` | 메시지 복사·분기 등 액션의 icon 크기·tooltip·hover/focus 노출을 맞춘다. |
| [features/chat/harnesses/common/transcript/TurnErrorBanner.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/TurnErrorBanner.tsx) — `TurnErrorBanner` | 턴 실패의 설명·재시도를 문맥 안에 표시한다. retry 가능 여부를 시각·이벤트 양쪽에 반영한다. |
| [features/chat/harnesses/common/transcript/UserBubbleText.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/UserBubbleText.tsx) — `UserBubbleText` | 긴 메시지 접기·더 보기·키별 펼침 상태를 보존하고 전체 원문 복사를 유지한다. |
| [features/chat/harnesses/common/transcript/UserDiffRequirements.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/UserDiffRequirements.tsx) — `UserDiffRequirements` | 사용자 diff 요구를 일반 메시지와 구별하고 파일·행·내용의 대응을 유지한다. |
| [features/chat/harnesses/common/transcript/UserMessage.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/UserMessage.tsx) — `UserMessage` | 사용자 버블·첨부·메타·액션과 공통 bubble-user 표면을 유지한다. |
| [features/chat/harnesses/common/transcript/UserTurn.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/UserTurn.tsx) — `UserTurn` | 사용자 turn의 메시지·요구·첨부 배치. assistant 출력과 같은 카드로 합치지 않는다. |
| [features/chat/harnesses/common/transcript/diffSyntaxText.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/transcript/diffSyntaxText.tsx) | diff 구문 강조의 언어·토큰 스타일을 공통 syntax와 맞추고 의미색을 가리지 않는다. |

## 공유 우측 패널·타일·뷰어

공통 타일 chrome·ResizableSidePane·PanelControls를 재사용한다. 상세 전환 시 본문·폭·스크롤·초점 수명을 보존한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/chat/harnesses/common/rightpanel/ArtifactPreviewContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/ArtifactPreviewContent.tsx) — `ArtifactPreviewContent` | 형식별 미리보기·코드·이미지 표면을 재사용하고 HTML sandbox·네트워크 차단 경계를 보존한다. |
| [features/chat/harnesses/common/rightpanel/ArtifactViewer.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/ArtifactViewer.tsx) — `ArtifactViewer` | 파일 제목·탭·복사·저장·확대·닫기·로딩/오류/재시도를 같은 viewer chrome으로 제공한다. |
| [features/chat/harnesses/common/rightpanel/BackgroundModelLabel.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/BackgroundModelLabel.tsx) — `BackgroundModelLabel` | 모델명·보조 메타를 작은 라벨로 표시하고 긴 이름을 축약한다. |
| [features/chat/harnesses/common/rightpanel/BackgroundTaskGroup.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/BackgroundTaskGroup.tsx) — `BackgroundTaskGroup` | 작업 묶음의 제목·개수·진행·펼침을 같은 타일 행으로 표시한다. |
| [features/chat/harnesses/common/rightpanel/ChangedNavigationSidebar.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/ChangedNavigationSidebar.tsx) — `ChangedNavigationSidebar` | 변경 파일·디렉터리의 선택/hover·들여쓰기·증감 표시를 정렬한다. |
| [features/chat/harnesses/common/rightpanel/DiffReview.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/DiffReview.tsx) — `DiffReview` | 변경사항 목록↔상세·검토 액션·스크롤 복원과 방향 있는 전환을 유지한다. |
| [features/chat/harnesses/common/rightpanel/DiffTileContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/DiffTileContent.tsx) — `DiffTileContent` | diff 타일 조립. 목록·상세의 제목·상태·읽기 폭을 유지한다. |
| [features/chat/harnesses/common/rightpanel/FileDiffSection.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/FileDiffSection.tsx) — `CONTEXT_EXPAND_STEP`, `FileDiffSection` | 파일 header·행 번호·추가/삭제 tint·코드 강조를 DiffTable과 일치시킨다. |
| [features/chat/harnesses/common/rightpanel/GitContextBar.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/GitContextBar.tsx) — `GitContextBar` | 브랜치·변경량·보기 전환·확대 상태를 같은 header 밀도로 배치한다. |
| [features/chat/harnesses/common/rightpanel/PanelResizeSeparators.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/PanelResizeSeparators.tsx) — `ColumnResizeSeparator`, `RowSeparator` | 열/행 구분자의 drag 영역·cursor·접힘 상태와 실제 DOM 좌표를 유지한다. 뷰어 pane 리사이즈는 ResizableSidePane 규칙을 따른다. |
| [features/chat/harnesses/common/rightpanel/PlanCommentOverlay.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/PlanCommentOverlay.tsx) — `PlanCommentOverlay` | 계획 주석 선택 영역과 본문 위치를 정렬하고 스크롤·리사이즈에도 위치를 맞춘다. |
| [features/chat/harnesses/common/rightpanel/PlanCommentPopover.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/PlanCommentPopover.tsx) — `PlanCommentPopover` | 주석 입력·취소·확정의 작은 부유 폼. anchor·초점·닫기와 오류 피드백을 유지한다. |
| [features/chat/harnesses/common/rightpanel/PlanTileContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/PlanTileContent.tsx) — `PlanTileHeaderActions`, `PlanTileContent` | 계획 제목·Markdown·검토·주석 동작을 같은 타일 안에 배치한다. |
| [features/chat/harnesses/common/rightpanel/RightPanelColumn.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/RightPanelColumn.tsx) — `RightPanelColumn` | 타일 열·크기·스크롤·진입 모션. 형제 타일 변경으로 기존 본문을 remount하지 않는다. |
| [features/chat/harnesses/common/rightpanel/RightPanelTile.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/RightPanelTile.tsx) — `RightPanelTile` | 타일 제목·본문·확대/닫기 버튼의 공통 chrome을 사용한다. |
| [features/chat/harnesses/common/rightpanel/SubAgentTaskDetail.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/SubAgentTaskDetail.tsx) — `SubAgentTaskDetail` | 하위 작업 상세에서 상태·진행·출력·돌아가기의 위계를 유지한다. |
| [features/chat/harnesses/common/rightpanel/TaskContextContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/TaskContextContent.tsx) — `TaskContextContent` | 경로·소스·첨부를 라벨/값으로 구분하고 긴 경로는 읽을 수 있게 처리한다. |
| [features/chat/harnesses/common/rightpanel/TaskOutputContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/TaskOutputContent.tsx) — `TaskOutputContent` | 출력 파일 목록의 종류·이름·상태·보기/저장 동작을 ArtifactCards와 맞춘다. |
| [features/chat/harnesses/common/rightpanel/TaskPanelContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/TaskPanelContent.tsx) — `TaskPanelContent` | 작업 타일 섹션 조립. 진행·출력·문맥 구획의 위치와 정체성을 보존한다. |
| [features/chat/harnesses/common/rightpanel/TaskProgressList.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/TaskProgressList.tsx) — `TaskProgressList`, `TaskDetail` | 작업 단계의 아이콘·라벨·진행·완료를 같은 rail/행 밀도로 표시한다. |
| [features/chat/harnesses/common/rightpanel/TaskScheduleContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/TaskScheduleContent.tsx) — `TaskScheduleContent` | 실행 일정·상태·사용 가능한 동작을 본문/메타로 구별한다. |
| [features/chat/harnesses/common/rightpanel/TaskStatusIcon.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/TaskStatusIcon.tsx) — `TaskStatusIcon` | 작업 상태를 아이콘·색·애니메이션으로 통일하고 주변 라벨을 함께 제공한다. |
| [features/chat/harnesses/common/rightpanel/TaskTileSections.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/TaskTileSections.tsx) — `TileSection`, `SectionPlaceholder` | 작업의 진행·출력·컨텍스트 구획 header와 접힘·개수를 일치시킨다. |
| [features/chat/harnesses/common/rightpanel/TilePanel.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/TilePanel.tsx) — `TilePanel` | registry 타일·행/열·상세·확대 조립. panel 폭·상태·focus 수명 계약을 유지한다. |
| [features/chat/harnesses/common/rightpanel/WorkTaskProgress.tsx](../../../app/src/renderer/src/features/chat/harnesses/common/rightpanel/WorkTaskProgress.tsx) — `WorkTaskProgress` | Work 진행 단계를 같은 상태 아이콘·읽기 순서로 표시한다. |

## Claude 전용 표면

Orca 공통 팔레트와 기존 Claude 활자·카드·메뉴를 따른다. Work·Code 차이는 기존 정책/슬롯을 사용한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/chat/harnesses/claude/Spinner.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/Spinner.tsx) — `ClaudeSpinner` | 하네스가 선택한 spinner의 원본 artwork·크기·모션을 재사용한다. |
| [features/chat/harnesses/claude/composer/Controls.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/Controls.tsx) — `ClaudeModeControl`, `ClaudeEffortControl` | 하네스의 실제 모드/agent·effort/variant 선택만 노출하며 chip·메뉴 밀도를 맞춘다. |
| [features/chat/harnesses/claude/composer/ConversationStatus.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/ConversationStatus.tsx) — `ClaudeConversationStatus` | 대화 상태의 표면 조립. 진행 label과 세부 팝오버를 중복 표시하지 않는다. |
| [features/chat/harnesses/claude/composer/ConversationStatusLine.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/ConversationStatusLine.tsx) — `ConversationStatusLine` | 진행 상태·경과 시간·컨텍스트를 보조 행과 고정 숫자로 표시한다. |
| [features/chat/harnesses/claude/composer/EffortMenu.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/EffortMenu.tsx) — `EffortMenu` | 지원 effort 값·선택·설명만 동일한 MenuItem 계층으로 표시한다. |
| [features/chat/harnesses/claude/composer/ModeMenu.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/ModeMenu.tsx) — `ModeMenu` | 권한 모드·설명·선택을 같은 메뉴 위계로 표시한다. |
| [features/chat/harnesses/claude/composer/Module.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/Module.tsx) — `composerModule` | 하네스 appearance·슬롯·가용 정책 등록. 입력 controller를 복제하지 않는다. |
| [features/chat/harnesses/claude/composer/QuestionCard.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/QuestionCard.tsx) — `AskUserQuestionCard` | 질문·옵션·단일/복수 선택·추가 입력·제출 상태를 구별한다. |
| [features/chat/harnesses/claude/composer/Requests.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/Requests.tsx) — `Requests` | 하네스 요청 종류에 따른 표시·순서를 조립한다. 다른 하네스의 대기 정책을 섞지 않는다. |
| [features/chat/harnesses/claude/composer/StatusPopover.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/StatusPopover.tsx) — `StatusPopover` | 진행 상태 세부값·설명·행 정렬을 Popover와 공통 보조 활자로 표시한다. |
| [features/chat/harnesses/claude/composer/SubmitButton.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/SubmitButton.tsx) — `SubmitButton` | 보내기·중단·busy·disabled 상태와 접근성 이름을 하네스 정책에 맞게 표시한다. |
| [features/chat/harnesses/claude/composer/ToolApproval.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/composer/ToolApproval.tsx) — `ToolApprovalBody` | 도구명·입력·승인/거부·세션 정책·진행 상태를 명확히 구별한다. |
| [features/chat/harnesses/claude/rightpanel/CanonicalBackgroundContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/rightpanel/CanonicalBackgroundContent.tsx) — `CanonicalBackgroundContent`, `BackgroundTaskCard` | 백그라운드 작업의 원본 상태·목록·출력을 공통 타일 chrome에 표시한다. |
| [features/chat/harnesses/claude/rightpanel/Panel.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/rightpanel/Panel.tsx) — `ClaudeRightPanel` | 하네스별 타일 registry·헤더와 공통 TilePanel을 연결한다. |
| [features/chat/harnesses/claude/rightpanel/PlanTile.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/rightpanel/PlanTile.tsx) — `PlanContent` | 하네스 계획 데이터를 공통 계획 타일/본문 규칙으로 표시한다. |
| [features/chat/harnesses/claude/rightpanel/SubAgentTileContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/rightpanel/SubAgentTileContent.tsx) — `SubAgentTileHeader`, `SubAgentTileContent`, `SubAgentTaskList` | 하위 에이전트 목록·상세·상태를 같은 작업 타일 밀도로 표시한다. |
| [features/chat/harnesses/claude/rightpanel/TaskTileContent.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/rightpanel/TaskTileContent.tsx) — `TaskTileHeader`, `TaskTileContent` | 작업 목록·선택·진행·출력을 공통 타일 구획에 배치한다. |
| [features/chat/harnesses/claude/transcript/AskExchange.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/AskExchange.tsx) — `AskExchange` | 질문과 답변의 연결·순서·메타를 유지하며 일반 도구 로그와 구별한다. |
| [features/chat/harnesses/claude/transcript/AssistantSegment.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/AssistantSegment.tsx) — `ClaudeAssistantSegment` | 텍스트·추론·도구 segment를 하네스 transcript 위계에 맞게 분리한다. |
| [features/chat/harnesses/claude/transcript/AssistantTurn.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/AssistantTurn.tsx) — `AssistantTurn` | 응답 segment·상태·메타의 순서와 메시지별 동작 범위를 유지한다. |
| [features/chat/harnesses/claude/transcript/ErrorCard.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/ErrorCard.tsx) — `ErrorCard` | 실패 설명·원인·재시도를 읽기 열 안에서 표시한다. |
| [features/chat/harnesses/claude/transcript/Exchange.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/Exchange.tsx) — `Exchange` | 사용자·assistant 교환 경계·간격·가상화 key를 유지한다. |
| [features/chat/harnesses/claude/transcript/PendingAssistant.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/PendingAssistant.tsx) — `PendingAssistant` | 대기 spinner·문구를 하네스 기본 상태 행과 일치시킨다. |
| [features/chat/harnesses/claude/transcript/ReasoningBlock.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/ReasoningBlock.tsx) — `ReasoningBlock` | 추론 제목·상태·접힘·본문을 낮은 강조 표면으로 구별한다. |
| [features/chat/harnesses/claude/transcript/ScrollController.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/ScrollController.tsx) — `ClaudeScrollController` | 읽기/선택 중 자동 추종 해제·최신 이동·세션별 복원을 유지한다. 색상/장식 책임을 넣지 않는다. |
| [features/chat/harnesses/claude/transcript/StructuredOutputCard.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/StructuredOutputCard.tsx) — `StructuredOutputCard` | 구조화 결과의 제목·상태·필드·원문을 중립 카드 위계로 표시한다. |
| [features/chat/harnesses/claude/transcript/Timeline.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/Timeline.tsx) — `ClaudeTranscriptView` | 하네스별 가상화·행/교환 key·읽기 열·스크롤과 선택을 보존한다. |
| [features/chat/harnesses/claude/transcript/ToolCard.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/ToolCard.tsx) — `ToolCard` | 도구 아이콘·제목·상태·펼침·본문의 위계를 유지하고 실행과 완료를 구별한다. |
| [features/chat/harnesses/claude/transcript/ToolGroup.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/ToolGroup.tsx) — `ClaudeToolGroup` | 같은 목적의 도구를 요약 행과 펼침으로 묶고 상태·개수를 표시한다. |
| [features/chat/harnesses/claude/transcript/WorkActivity.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/WorkActivity.tsx) — `WorkActivity` | Work 활동 요약·진행·완료를 읽기 흐름을 방해하지 않는 행으로 표시한다. |
| [features/chat/harnesses/claude/transcript/WorkToolBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/WorkToolBody.tsx) — `WorkToolBody` | Work 출력 종류별 body를 선택하고 긴 로그/코드를 접을 수 있게 유지한다. |
| [features/chat/harnesses/claude/transcript/WorkToolTimeline.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/WorkToolTimeline.tsx) — `WorkToolRow`, `WorkToolTimeline` | Work 도구 흐름의 시간·상태·요약·상세 연결을 유지한다. |
| [features/chat/harnesses/claude/transcript/tool-bodies/AgentTaskBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/tool-bodies/AgentTaskBody.tsx) — `AgentTaskBody` | 에이전트 작업명·상태·입력/결과·상세 진입을 도구 body 위계로 표시한다. |
| [features/chat/harnesses/claude/transcript/tool-bodies/AskBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/tool-bodies/AskBody.tsx) — `AskBody` | 도구 질문·옵션·결과 요약을 일반 텍스트 출력과 구별한다. |
| [features/chat/harnesses/claude/transcript/tool-bodies/BashBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/tool-bodies/BashBody.tsx) — `BashBody` | 명령·stdout/stderr·종료·실행 동작을 mono와 명확한 구획으로 표시한다. |
| [features/chat/harnesses/claude/transcript/tool-bodies/DiffBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/tool-bodies/DiffBody.tsx) — `DiffBody` | 공통 DiffTable을 통해 파일·행 번호·증감·구문 강조를 표시한다. |
| [features/chat/harnesses/claude/transcript/tool-bodies/FileBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/tool-bodies/FileBody.tsx) — `FileBody` | 파일 경로·언어·읽기 범위·본문을 코드/메타로 구분한다. |
| [features/chat/harnesses/claude/transcript/tool-bodies/KeyValueBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/tool-bodies/KeyValueBody.tsx) — `KeyValueBody` | 입력/출력 key·value·중첩 JSON의 들여쓰기·긴 값 줄바꿈을 유지한다. |
| [features/chat/harnesses/claude/transcript/tool-bodies/TaskToolBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/transcript/tool-bodies/TaskToolBody.tsx) — `TaskToolBody` | 작업 도구의 이름·상태·진행/결과·상세를 의미 있는 행으로 표시한다. |

## OpenCode 전용 표면

전용 chrome은 oc-* 토큰·해당 하네스의 Icon/Spinner/Chip을 사용한다. 공유 채팅 배경·버블·입력 controller는 공통 계약을 유지한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/chat/harnesses/opencode/Icon.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/Icon.tsx) — `OpenCodeIcon` | OpenCode 전용 SVG의 비율·stroke·currentColor를 보존한다. |
| [features/chat/harnesses/opencode/Spinner.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/Spinner.tsx) — `OpenCodeSpinner` | 하네스가 선택한 spinner의 원본 artwork·크기·모션을 재사용한다. |
| [features/chat/harnesses/opencode/Wordmark.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/Wordmark.tsx) — `OpenCodeWordmark` | OpenCode wordmark artwork·크기·비율을 유지한다. |
| [features/chat/harnesses/opencode/composer/AboveInput.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/AboveInput.tsx) — `AboveInput` | 요청 dock·Todo와 입력의 위아래 관계·진입/퇴장·숨김 정책을 유지한다. |
| [features/chat/harnesses/opencode/composer/Chip.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/Chip.tsx) — `ComposerChip` | OpenCode chip의 oc-ink·oc-hover·고정 줄 높이를 사용하고 공통 chip을 전역 변형하지 않는다. |
| [features/chat/harnesses/opencode/composer/Controls.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/Controls.tsx) — `OpenCodeAgentControl`, `OpenCodeVariantControl` | 첫 입력 전 작업폴더 SDK의 visible agent·model variant를 독립 준비한다. 성공한 빈 variant는 컨트롤을 숨기며 조회 실패에는 기존 목록을 보존한다. 에이전트는 앱 실행 중 첫 성공 목록을 scope가 없는 화면까지 재사용한다. store는 화면 수명과 무관하게 전용 OpenCode plugin 변경 이벤트를 구독하며 새 revision에만 목록을 비운다. 모델은 같은 scope/generation의 성공 캐시를 사용한다. 실제 에이전트 항목만 제공하며 합성 기본 에이전트는 표시하지 않는다. 에이전트 로딩 중에만 그룹 제목 오른쪽에 회전 표시를 두고 축소 모션에서는 멈춘다. 나머지 팝업에 새로고침 항목·상태 문구·진행 안내를 추가하지 않으며 빈 목록도 Escape로 닫고 키보드 초점을 복귀한다. |
| [features/chat/harnesses/opencode/composer/DockPrompt.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/DockPrompt.tsx) — `DockPrompt`, `DockButton` | 요청 설명·입력 영역·액션을 dock의 같은 인셋과 활자 위계로 표시한다. |
| [features/chat/harnesses/opencode/composer/Module.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/Module.tsx) — `composerModule` | 하네스 appearance·슬롯·가용 정책 등록. 입력 controller를 복제하지 않는다. |
| [features/chat/harnesses/opencode/composer/PermissionDock.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/PermissionDock.tsx) — `OpenCodePermissionDock` | 권한 요청 대상·범위·승인/거부 동작과 busy를 구별한다. |
| [features/chat/harnesses/opencode/composer/QuestionDock.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/QuestionDock.tsx) — `OpenCodeQuestionDock` | 질문 단계·옵션·추가 답변·제출·취소를 요청 dock 안에서 표시한다. |
| [features/chat/harnesses/opencode/composer/QuestionOption.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/QuestionOption.tsx) — `QuestionMark`, `QuestionOption` | 선택·focus·설명·단축 표시와 라벨 클릭 영역을 일치시킨다. |
| [features/chat/harnesses/opencode/composer/RequestDock.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/RequestDock.tsx) — `OpenCodeRequestDock` | 현재 요청만 입력 자리를 대체하고 대기 순서·해소 후 입력 복원을 유지한다. |
| [features/chat/harnesses/opencode/composer/SubmitButton.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/SubmitButton.tsx) — `SubmitButton` | 보내기·중단·busy·disabled 상태와 접근성 이름을 하네스 정책에 맞게 표시한다. |
| [features/chat/harnesses/opencode/composer/TodoDock.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/TodoDock.tsx) — `OpenCodeTodoDock` | 단계 진행·펼친 목록/한 줄 요약·완료 퇴장과 요청 우선순위를 유지한다. |
| [features/chat/harnesses/opencode/composer/ToolApproval.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/composer/ToolApproval.tsx) — `ToolApprovalBody` | 도구명·입력·승인/거부·세션 정책·진행 상태를 명확히 구별한다. |
| [features/chat/harnesses/opencode/landing/Brand.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/landing/Brand.tsx) — `LandingBrand` | OpenCode landing 브랜드의 wordmark·간격·하네스 스코프를 유지한다. |
| [features/chat/harnesses/opencode/rightpanel/AgentViews.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/AgentViews.tsx) — `AgentList`, `AgentDetail` | agent 목록·avatar·진행·상세를 OpenCode 패널 행으로 표시한다. |
| [features/chat/harnesses/opencode/rightpanel/Panel.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/Panel.tsx) — `OpenCodeRightPanel` | 하네스별 타일 registry·헤더와 공통 TilePanel을 연결한다. |
| [features/chat/harnesses/opencode/rightpanel/PlanTile.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/PlanTile.tsx) — `PlanContent` | 하네스 계획 데이터를 공통 계획 타일/본문 규칙으로 표시한다. |
| [features/chat/harnesses/opencode/rightpanel/Sources.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/Sources.tsx) — `OpenCodeSources` | 소스 종류·이름·경로·진입 동작을 동일한 패널 행으로 표시한다. |
| [features/chat/harnesses/opencode/rightpanel/chrome.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/chrome.tsx) — `PanelRow`, `AgentAvatar` | PanelRow·AgentAvatar의 oc 계열 톤·행 인셋·상태·접근성 이름을 공유한다. |
| [features/chat/harnesses/opencode/rightpanel/tiles.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/tiles.tsx) — `OpenCodeTaskContent`, `OpenCodeAgentContent`, `OpenCodeAgentHeader`, `OpenCodeProcessContent`, `OpenCodeSourceContent` | OpenCode 타일의 헤더·본문 슬롯을 registry에 제공하고 공통 패널 수명을 보존한다. |
| [features/chat/harnesses/opencode/transcript/AskExchange.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/transcript/AskExchange.tsx) — `OpenCodeAskExchange` | 질문과 답변의 연결·순서·메타를 유지하며 일반 도구 로그와 구별한다. |
| [features/chat/harnesses/opencode/transcript/AssistantSegment.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/transcript/AssistantSegment.tsx) — `OpenCodeAssistantSegment` | 텍스트·추론·도구 segment를 하네스 transcript 위계에 맞게 분리한다. |
| [features/chat/harnesses/opencode/transcript/ScrollController.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx) — `OpenCodeScrollController` | 읽기/선택 중 자동 추종 해제·최신 이동·세션별 복원을 유지한다. 색상/장식 책임을 넣지 않는다. |
| [features/chat/harnesses/opencode/transcript/Text.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/transcript/Text.tsx) — `OpenCodeText` | OpenCode assistant prose에만 활자·링크·코드 override를 적용한다. shared Markdown을 전역 변경하지 않는다. |
| [features/chat/harnesses/opencode/transcript/Timeline.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.tsx) — `OpenCodeTimeline`, `OpenCodeTimelineRow` | 하네스별 가상화·행/교환 key·읽기 열·스크롤과 선택을 보존한다. |
| [features/chat/harnesses/opencode/transcript/ToolBody.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/transcript/ToolBody.tsx) — `OutputPanel`, `ToolBody` | OpenCode 도구별 출력과 provider 원문 disclosure를 구별한다. 긴 로그·diff를 펼침 안에서 표시한다. |
| [features/chat/harnesses/opencode/transcript/ToolCard.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/transcript/ToolCard.tsx) — `OpenCodeToolCard` | 도구 아이콘·제목·상태·펼침·본문의 위계를 유지하고 실행과 완료를 구별한다. |
| [features/chat/harnesses/opencode/transcript/ToolGroup.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/transcript/ToolGroup.tsx) — `OpenCodeToolGroup` | 같은 목적의 도구를 요약 행과 펼침으로 묶고 상태·개수를 표시한다. |

## 하네스 registry·Provider

Provider와 registry는 시각 컴포넌트 선택/수명 책임만 갖는다. 새 팔레트나 카드 chrome을 이 계층에서 정의하지 않는다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/backend/providers/BackendProvider.tsx](../../../app/src/renderer/src/features/backend/providers/BackendProvider.tsx) — `BackendProvider` | 상태 구독·해제와 children 조립을 유지한다. 시각 외형은 소비 컴포넌트의 규칙을 따른다. |
| [features/chat/harnesses/registries/assistant.tsx](../../../app/src/renderer/src/features/chat/harnesses/registries/assistant.tsx) | assistant 표시 registry. 구체 하네스 구현을 선택하며 새로운 전역 시각 규칙을 넣지 않는다. |
| [features/chat/harnesses/registries/transcript.tsx](../../../app/src/renderer/src/features/chat/harnesses/registries/transcript.tsx) | transcript 표시 registry. 행·scroll controller·timeline 조합을 하네스별로 선택한다. |
| [features/chat/providers/ChatProvider.tsx](../../../app/src/renderer/src/features/chat/providers/ChatProvider.tsx) — `ChatProvider` | 상태 구독·해제와 children 조립을 유지한다. 시각 외형은 소비 컴포넌트의 규칙을 따른다. |
| [features/cost/providers/CostProvider.tsx](../../../app/src/renderer/src/features/cost/providers/CostProvider.tsx) — `CostProvider` | 상태 구독·해제와 children 조립을 유지한다. 시각 외형은 소비 컴포넌트의 규칙을 따른다. |
| [features/sessions/providers/SessionsProvider.tsx](../../../app/src/renderer/src/features/sessions/providers/SessionsProvider.tsx) — `SessionsProvider` | 상태 구독·해제와 children 조립을 유지한다. 시각 외형은 소비 컴포넌트의 규칙을 따른다. |
| [features/update/providers/UpdateProvider.tsx](../../../app/src/renderer/src/features/update/providers/UpdateProvider.tsx) — `UpdateProvider` | 상태 구독·해제와 children 조립을 유지한다. 시각 외형은 소비 컴포넌트의 규칙을 따른다. |

## 산출물·카메라·캡처·개발 도구

목록/뷰어는 공통 카탈로그·pane, 카메라는 stage, 개발 제어는 floating-panel 범위를 따른다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/artifacts/components/ArtifactCatalogRow.tsx](../../../app/src/renderer/src/features/artifacts/components/ArtifactCatalogRow.tsx) — `ArtifactCatalogRow` | CatalogListRow에 파일 종류·제목·위치·시각·상태·메뉴를 같은 슬롯으로 제공한다. |
| [features/artifacts/components/ArtifactsView.tsx](../../../app/src/renderer/src/features/artifacts/components/ArtifactsView.tsx) — `ArtifactsView` | CatalogTabs·CatalogSearch·행·뷰어 pane. 목록/상세 폭과 빈/로딩 상태를 유지한다. |
| [features/camera/components/CameraView.tsx](../../../app/src/renderer/src/features/camera/components/CameraView.tsx) — `Metric`, `CameraView` | stage 뷰포트·검사 컨트롤·지표 구획을 유지하고 데이터/조작의 대비를 분리한다. |
| [features/captures/components/CapturesView.tsx](../../../app/src/renderer/src/features/captures/components/CapturesView.tsx) — `CapturesView` | Future Scope 안내 화면. 중앙 아이콘·serif 제목·설명·참조 메타의 위계를 유지하고 미구현 목록·미리보기를 동작하는 UI처럼 제시하지 않는다. |
| [features/debug/components/DebugPanel.tsx](../../../app/src/renderer/src/features/debug/components/DebugPanel.tsx) — `DebugPanel` | FloatingPanel과 feature별 debug 슬롯 조립. dev 전용 외형을 일반 설정에 복제하지 않는다. |

## 엔진·모델·설치

공통 catalog/Modal/폼을 사용한다. components의 facade는 common 구현과 하네스 전용 슬롯에 외형을 위임한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/backend/harnesses/claude/components/AuthExpiredModal.tsx](../../../app/src/renderer/src/features/backend/harnesses/claude/components/AuthExpiredModal.tsx) — `AuthExpiredModal` | 인증 만료 안내·재로그인 다음 동작을 전역 modal 슬롯 규약에 맞춘다. |
| [features/backend/harnesses/claude/components/BackendStatus.tsx](../../../app/src/renderer/src/features/backend/harnesses/claude/components/BackendStatus.tsx) — `BackendStatus` | 설치·준비·실패 상태의 label·tone·동작을 구별한다. |
| [features/backend/harnesses/claude/components/InstallerDialog.tsx](../../../app/src/renderer/src/features/backend/harnesses/claude/components/InstallerDialog.tsx) — `InstallerDialog` | 설치 진행·로그·명령 복사·실패 복구를 같은 dialog 안에 배치한다. |
| [features/engine/common/components/AgentEnvironmentView.tsx](../../../app/src/renderer/src/features/engine/common/components/AgentEnvironmentView.tsx) — `AgentEnvironmentView` | 엔진/모델 목록·추가·설정 진입을 카탈로그/상세 위계로 표시한다. 추가 메뉴의 Claude/OpenCode 라벨 왼쪽에는 각 공식 컬러 마크를 정렬한다. |
| [features/engine/common/components/EngineCard.tsx](../../../app/src/renderer/src/features/engine/common/components/EngineCard.tsx) — `EngineCard` | 제목 왼쪽에 지원 하네스의 공식 컬러 로고를 배치하며 엔진명·하네스·연결 상태·모델·동작의 위계를 유지한다. |
| [features/engine/common/components/EngineFormModal.tsx](../../../app/src/renderer/src/features/engine/common/components/EngineFormModal.tsx) — `EngineFormModal` | 단일 화면 엔진 폼. Modal 입력·label·인증/불러오기·저장 상태를 재사용한다. |
| [features/engine/common/components/EngineModelList.tsx](../../../app/src/renderer/src/features/engine/common/components/EngineModelList.tsx) — `EngineModelList` | 모델명·선택·메타를 같은 행 높이와 정렬로 표시한다. |
| [features/engine/components/AgentEnvironmentView.tsx](../../../app/src/renderer/src/features/engine/components/AgentEnvironmentView.tsx) — `AgentEnvironmentView` | 엔진/모델 목록·추가·설정 진입을 카탈로그/상세 위계로 표시한다. |
| [features/engine/components/EngineCard.tsx](../../../app/src/renderer/src/features/engine/components/EngineCard.tsx) — `EngineCard` | 제목 왼쪽에 지원 하네스의 공식 컬러 로고를 배치하며 엔진명·하네스·연결 상태·모델·동작의 위계를 유지한다. |
| [features/engine/components/EngineFormModal.tsx](../../../app/src/renderer/src/features/engine/components/EngineFormModal.tsx) — `EngineFormModal` | 단일 화면 엔진 폼. Modal 입력·label·인증/불러오기·저장 상태를 재사용한다. |
| [features/engine/harnesses/opencode/ProviderForm.tsx](../../../app/src/renderer/src/features/engine/harnesses/opencode/ProviderForm.tsx) — `OpenCodeProviderForm` | OpenCode provider 입력을 공통 폼 규칙 안에서 표시하고 필드 오류를 가까이에 둔다. |

## 프로젝트·세션

목록 행·구획·메뉴·검색·상세는 공통 catalog/sidebar 패턴을 사용한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/projects/components/CreateProjectModal.tsx](../../../app/src/renderer/src/features/projects/components/CreateProjectModal.tsx) — `CreateProjectModal` | 프로젝트명·설명·지침을 공통 Modal 입력으로 표시하고 필수/선택·글자 제한을 구별한다. |
| [features/projects/components/EditInstructionsModal.tsx](../../../app/src/renderer/src/features/projects/components/EditInstructionsModal.tsx) — `EditInstructionsModal` | 여러 줄 지침·글자 제한·저장 오류·busy를 Modal 패턴으로 표시한다. |
| [features/projects/components/ProjectCatalogRow.tsx](../../../app/src/renderer/src/features/projects/components/ProjectCatalogRow.tsx) — `ProjectCatalogRow` | CatalogListRow의 아이콘·제목·고정·메타·메뉴 슬롯을 사용한다. |
| [features/projects/components/ProjectInfoHero.tsx](../../../app/src/renderer/src/features/projects/components/ProjectInfoHero.tsx) — `ProjectInfoHero` | serif 프로젝트 제목·rename·보조 메뉴와 긴 제목 처리를 유지한다. |
| [features/projects/components/ProjectInstructionsCard.tsx](../../../app/src/renderer/src/features/projects/components/ProjectInstructionsCard.tsx) — `ProjectInstructionsCard` | 지침 본문·미설정 안내·편집을 낮은 강조 카드로 구별한다. |
| [features/projects/components/ProjectInstructionsSidebar.tsx](../../../app/src/renderer/src/features/projects/components/ProjectInstructionsSidebar.tsx) — `ProjectInstructionsSidebar` | 지침 카드의 보조 열·여백·좁은 폭 배치를 유지한다. |
| [features/projects/components/ProjectLandingHeader.tsx](../../../app/src/renderer/src/features/projects/components/ProjectLandingHeader.tsx) — `ProjectLandingHeader` | 프로젝트 돌아가기·상단 chrome을 작은 중립 툴바로 유지한다. |
| [features/projects/components/ProjectsScreen.tsx](../../../app/src/renderer/src/features/projects/components/ProjectsScreen.tsx) — `ProjectsScreen` | 카탈로그 제목·총계·추가·탭·검색·목록·상세를 같은 읽기 위계로 구성한다. |
| [features/projects/components/ProjectsView.tsx](../../../app/src/renderer/src/features/projects/components/ProjectsView.tsx) — `ProjectsView` | 프로젝트 화면 조립. 목록·선택·상세 데이터는 feature 안에서 소유한다. |
| [features/projects/components/SidebarCard.tsx](../../../app/src/renderer/src/features/projects/components/SidebarCard.tsx) — `SidebarCard` | 프로젝트 보조 정보의 제목·설명·동작 간격을 맞춘다. |
| [features/sessions/components/PinnedProjectsSection.tsx](../../../app/src/renderer/src/features/sessions/components/PinnedProjectsSection.tsx) — `PinnedProjectsSectionView`, `PinnedProjectChildren`, `PinnedProjectsSection` | 고정 프로젝트 구획의 이름·펼침·세션 행 밀도를 sidebar와 맞춘다. |
| [features/sessions/components/PinnedSection.tsx](../../../app/src/renderer/src/features/sessions/components/PinnedSection.tsx) — `PinnedSectionView`, `PinnedSection` | 고정 대화·구획 제목·정렬·활성 행 표시를 유지한다. |
| [features/sessions/components/ProjectSessionsPanel.tsx](../../../app/src/renderer/src/features/sessions/components/ProjectSessionsPanel.tsx) — `ProjectSessionsPanel` | 프로젝트 세션의 검색/정렬·행·빈 상태를 공통 SessionRow 패턴으로 표시한다. |
| [features/sessions/components/SearchModal.tsx](../../../app/src/renderer/src/features/sessions/components/SearchModal.tsx) — `SearchModal` | 검색 입력·그룹·후보 선택·키보드·focus trap/복귀를 전역 modal 규약에 맞춘다. |
| [features/sessions/components/SessionList.tsx](../../../app/src/renderer/src/features/sessions/components/SessionList.tsx) — `SessionListView`, `SessionList` | 세션 구획·정렬·스크롤·빈 상태와 활성 행을 유지한다. |
| [features/sessions/components/SessionRow.tsx](../../../app/src/renderer/src/features/sessions/components/SessionRow.tsx) — `SessionRow` | 활성/hover·상태 점·rename·kebab을 유지하고 group/session으로 형제 hover를 격리한다. |

## 인증·설정·사용량

설정 row·label·control·단위·오류 위계를 통일한다. 인증/업데이트 정책은 시각 정리와 별개로 보존한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/providers/components/GateLogin.tsx](../../../app/src/renderer/src/features/providers/components/GateLogin.tsx) — `GateLogin` | Orca 브랜드·입력 카드·중립 로그인 버튼의 위계를 유지하고 인증 진행/실패를 구별한다. |
| [features/providers/components/ProviderDebugSection.tsx](../../../app/src/renderer/src/features/providers/components/ProviderDebugSection.tsx) — `ProviderDebugSection` | 인증 개발 제어를 FloatingPanel 패턴으로 표시하며 실제 게이트 상태와 혼동하지 않는다. |
| [features/settings/components/GeneralTab.tsx](../../../app/src/renderer/src/features/settings/components/GeneralTab.tsx) — `GeneralTab` | SettingsGroup·SettingsRow·SettingsSelect·Toggle 사용. 폰트/읽기 설정을 실제 적용 범위와 함께 안내한다. |
| [features/settings/components/ProviderUsageTab.tsx](../../../app/src/renderer/src/features/settings/components/ProviderUsageTab.tsx) — `ProviderUsageTab` | provider 상태·비용·기간·한도와 설정 동작을 보조 활자/고정 숫자로 표시한다. |
| [features/settings/components/SettingsModal.tsx](../../../app/src/renderer/src/features/settings/components/SettingsModal.tsx) — `SettingsModal` | 설정 nav·선택 탭·본문 스크롤·닫기/초점 복귀의 전역 modal 구조를 유지한다. |
| [features/settings/components/TokensPerDayChart.tsx](../../../app/src/renderer/src/features/settings/components/TokensPerDayChart.tsx) — `UsageTooltip`, `TokensPerDayChart` | 기간·축·데이터·공통 tooltip 표면을 맞추고 데이터 없음과 0값을 구별한다. |
| [features/settings/components/UsageLimitViews.tsx](../../../app/src/renderer/src/features/settings/components/UsageLimitViews.tsx) — `LimitBarsSection`, `LimitEditor` | 한도 입력·적용·단위·즉시 반영 안내와 숫자 정렬을 유지한다. |
| [features/settings/components/UsageTab.tsx](../../../app/src/renderer/src/features/settings/components/UsageTab.tsx) — `ModelUsageList`, `UsageDescription`, `UsageTab` | 기간 선택·차트·모델별 meter·총량·로딩/빈/실패를 같은 설정 위계로 표시한다. |
| [features/settings/components/parts.tsx](../../../app/src/renderer/src/features/settings/components/parts.tsx) — `SettingsSelect`, `SettingsGroup`, `SettingsRow` | SettingsSelect·SettingsGroup·SettingsRow를 설정 폼의 공통 label·설명·control 정렬로 재사용한다. |

## 플러그인·스킬·MCP·업데이트

카탈로그·상세·폼·확인·상태를 공통 primitive로 구성한다. 연결 종류별 의미와 파괴적 동작을 구별한다.

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [features/skills/components/AddMcpServerModal.tsx](../../../app/src/renderer/src/features/skills/components/AddMcpServerModal.tsx) — `AddMcpServerModal` | 전송 방식·이름·명령/URL·인자를 공통 Modal 입력·mono·필드 오류로 표시한다. |
| [features/skills/components/customize/CustomMcpModal.tsx](../../../app/src/renderer/src/features/skills/components/customize/CustomMcpModal.tsx) — `CustomMcpModal` | JSON 입력은 mono·code 크기, 설명·파싱 오류·취소/추가를 구별한다. |
| [features/skills/components/customize/CustomizeList.tsx](../../../app/src/renderer/src/features/skills/components/customize/CustomizeList.tsx) — `CustomizeList` | 전역 plugin·스킬·MCP 행은 CatalogListRow로 표시하고 제목 버튼과 토글을 분리한다. 지원하는 네이티브 MCP·플러그인은 일반 폰트·가변 토글, 나머지 네이티브 항목은 실제 상태의 회색 폰트·고정 토글이다. 네이티브 플러그인은 provider 그룹 뒤 Claude→OpenCode 순서로 표시한다. 스킬 탭은 플러그인 출처를 제외하고 기본 경로 스킬에 일반 글씨·토글 없음을 적용하며 Orca 스킬만 토글한다. 실제 설정/설치 위치가 있는 항목만 열기를 제공한다. 스킬 이름/시간, 출처 제목+브랜드 로고를 유지한다. |
| [features/skills/components/customize/CatalogToggle.tsx](../../../app/src/renderer/src/features/skills/components/customize/CatalogToggle.tsx) — `CatalogToggle` | 전역 목록/상세의 on/off switch. capability로 고정 여부를 결정하며 변경 중 중복 클릭을 막고 실패를 보고한다. |
| [features/skills/components/customize/SourceHeading.tsx](../../../app/src/renderer/src/features/skills/components/customize/SourceHeading.tsx) — `SourceHeading` | 스킬/MCP 출처 이름 왼쪽에 브랜드 색의 Claude·OpenCode·Orca 로고 또는 agents 폴더 아이콘을 배치한다. 두 탭 모두 후속 그룹은2rem top padding으로 분리한다. |
| [features/skills/components/customize/CustomizeTabs.tsx](../../../app/src/renderer/src/features/skills/components/customize/CustomizeTabs.tsx) — `CustomizeTabs` | CatalogTabs wrapper. Plugin·스킬·MCP의 선택·ARIA·방향키 처리를 공유한다. |
| [features/skills/components/customize/ExtensionDetailPane.tsx](../../../app/src/renderer/src/features/skills/components/customize/ExtensionDetailPane.tsx) — `ExtensionDetailPane` | ResizableSidePane·타일 header·PanelControls·본문 스크롤을 재사용한다. |
| [features/skills/components/customize/ExtensionsCatalogModal.tsx](../../../app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogModal.tsx) — `ExtensionsCatalogModal` | 카탈로그 modal 진입 조립. 같은 ExtensionsCatalogView를 사용한다. |
| [features/skills/components/customize/ExtensionsCatalogView.tsx](../../../app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.tsx) — `ExtensionsCatalogView` | 카탈로그 hero·탭·추가 메뉴·목록·선택 상세의 밀도와 폭을 맞춘다. |
| [features/skills/components/customize/McpDetail.tsx](../../../app/src/renderer/src/features/skills/components/customize/McpDetail.tsx) — `McpDetail` | 서버명·상태·전송 방식·설정 요약·메뉴를 label/값/코드 위계로 표시한다. |
| [features/skills/components/customize/ProviderAuthActions.tsx](../../../app/src/renderer/src/features/skills/components/customize/ProviderAuthActions.tsx) — `ProviderAuthActions` | 미인증 인증 버튼·재인증 메뉴·연결 해제의 중립/파괴적 동작 위계를 유지한다. |
| [features/skills/components/customize/ProviderDetail.tsx](../../../app/src/renderer/src/features/skills/components/customize/ProviderDetail.tsx) — `ProviderDetail` | Plugin 설명·연결 상태·인증·출처/버전/license를 구별하고 긴 URL을 안전하게 줄바꿈한다. |
| [features/skills/components/customize/SkillAddMenu.tsx](../../../app/src/renderer/src/features/skills/components/customize/SkillAddMenu.tsx) — `SkillAddMenu` | 작성·업로드 등 진입을 동일한 메뉴 행·아이콘·간격으로 표시한다. |
| [features/skills/components/customize/SkillAuthorModal.tsx](../../../app/src/renderer/src/features/skills/components/customize/SkillAuthorModal.tsx) — `SkillAuthorModal` | 이름·설명·지침·유효성 오류를 공통 Modal 폼으로 표시한다. |
| [features/skills/components/customize/SkillDetail.tsx](../../../app/src/renderer/src/features/skills/components/customize/SkillDetail.tsx) — `SkillDetail` | 스킬 메타·활성화·편집/삭제·Markdown/원문 전환의 위계를 유지한다. |
| [features/skills/components/customize/SkillUploadModal.tsx](../../../app/src/renderer/src/features/skills/components/customize/SkillUploadModal.tsx) — `SkillUploadModal` | 드롭 영역·선택 파일·지원 형식·업로드 오류와 drag 상태를 구별한다. |
| [features/update/components/UpdateDebugSection.tsx](../../../app/src/renderer/src/features/update/components/UpdateDebugSection.tsx) — `UpdateDebugSection` | 업데이트 개발 제어는 debug control 외형으로 표시한다. |
| [features/update/components/UpdateDialog.tsx](../../../app/src/renderer/src/features/update/components/UpdateDialog.tsx) — `UpdateDialog` | 버전·진행률·릴리스 정보·다운로드/재시작·오류를 같은 Modal 흐름으로 표시한다. |

## 하네스 진입·네이티브 상태

| 소스 / 표시 단위 | 적용 규칙 |
|---|---|
| [app/NewChatHarnessMenu.tsx](../../../app/src/renderer/src/app/NewChatHarnessMenu.tsx) — `NewChatHarnessMenu` | Popover의 right 배치·nav boundary·gap 0. 같은 로고 칸, 키보드 탐색·취소 시 초점 복귀. |
| [shared/ui/ClaudeLogo.tsx](../../../app/src/renderer/src/shared/ui/ClaudeLogo.tsx) — `ClaudeLogo` | 공식 Claude 마크, currentColor. 메뉴·히어로는 spinner 토큰. |
| [shared/ui/OpenCodeLogo.tsx](../../../app/src/renderer/src/shared/ui/OpenCodeLogo.tsx) — `OpenCodeLogo` | 공식 OpenCode 마크, currentColor와 ink 토큰. 원본 비율을 유지한다. |
| [features/chat/harnesses/claude/Logo.tsx](../../../app/src/renderer/src/features/chat/harnesses/claude/Logo.tsx) — `ClaudeLogo` | shared/ui의 ClaudeLogo를 하네스 registry에 재수출한다. |
| [features/chat/harnesses/opencode/Logo.tsx](../../../app/src/renderer/src/features/chat/harnesses/opencode/Logo.tsx) — `OpenCodeLogo` | shared/ui의 OpenCodeLogo를 하네스 registry에 재수출한다. |
| [features/chat/harnesses/registries/brand.tsx](../../../app/src/renderer/src/features/chat/harnesses/registries/brand.tsx) — `HarnessLogo` | 하네스별 마크 조립만 소유하며 기존 랜딩 presentation을 바꾸지 않는다. |

`Popover`의 `boundaryRef`는 right 배치의 가로 경계만 바꾼다. 세로 기준은 trigger이며 창·nav 리사이즈에 다시 측정한다. `CascadeBody`의 status는 왼쪽 연결 상태 공, secondary는 오른쪽 활성 스위치를 렌더한다. native 목록은 primary checked/description을 사용하지 않는다. 해당 항목의 진행 중 중복 입력만 막고, 지원되지 않는 MCP 제어는 disabled로 표시한다. 플러그인 폴더 열기는 일반 액션이다.
