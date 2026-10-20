# 하네스 메뉴 시각 검증

`app`에서 `node node_modules/vite/bin/vite.js --config scripts/fixtures/opencode-ui/vite.config.ts --host 127.0.0.1`을 실행한 뒤 `/scripts/fixtures/harness-entry/index.html`을 연다.

실제 Sidebar·ChatTitleBar·하네스 Header·chatStore를 렌더한다. IPC만 메모리 대역이며 실제 모델/파일/설정에 쓰지 않는다. 테마, nav 접힘/너비, Claude/OpenCode 세션 버튼으로 배치·그룹·상태·지원되는 Claude 세션 제어를 확인한다. 새 대화 메뉴 선택은 실제 초안 전이를 실행한다.

`Claude 세션`과 `Claude 세션 B`는 서로 다른 세션 ID로 전환하며 같은 프로젝트를 나타낸다. plugin/MCP 스위치 변경 후 각 세션의 실제 조회 snapshot push를 대역으로 보내 양쪽 popup 캐시가 즉시 갱신되는지 확인한다. `빈 세션`의 케밥에서는 MCP·플러그인 그룹이 회색 disabled이며 하위 패널이 열리지 않는다. 실제 목록에서는 제목 왼쪽 상태 공과 MCP 공식 마크를 확인한다. 왼쪽 공은 연결 상태 표시, 오른쪽 enable/disable 스위치는 활성 제어, 플러그인 이름은 폴더 열기다. 상태 부제목은 없다. IPC 응답을 지연시키면 해당 스위치의 원형 손잡이 안 spinner와 다른 항목의 사용 가능 여부를 확인할 수 있다.

`프로젝트 화면`은 실제 ProjectLandingPage와 Composer를 렌더한다. 초안을 입력하고 모델 메뉴에서 하네스를 바꿔 헤더 교체와 초안 보존을 확인한다. `메뉴 화면`으로 돌아와 Claude 세션의 플러그인 하위 메뉴에서 폴더 열기 행과 독립된 세션 활성 제어를 볼 수 있다. 이 화면의 확장 이름은 예시 데이터이며 실제 native 조회는 main reader/IPC 테스트와 로컬 읽기 smoke로 검증한다.

Composer `+`에서 파일 추가의 paperclip과 스킬/플러그인의 출처별 단일 목록을 확인한다. 스킬에는 해당 하네스·native plugin·Orca·agents 항목이 보이고 상대 하네스 스킬은 제외한다. 플러그인은 연결된 native/Orca MCP와 valid Jira만 표시하며 needs-auth GitHub와 expired Confluence는 제외한다. nav 플러그인의 스킬/MCP 탭은 양 하네스의 설정 catalog를 출처로 구분한다. 출처와 모델 그룹 제목에는 브랜드 로고를 표시한다. 케밥 MCP 이름은 설정 파일 위치 열기 요청을 보내며 오른쪽 스위치와 독립이다. 실제 파일 선택·CLI 수명은 이 메모리 fixture의 검증 범위가 아니다.


케밥 → 타일 표시의 Claude 상태/OpenCode 상태는 실제 `RightPanel`의 nativeStatus 타일을 연다. 로고·프로젝트 이름 제목, MCP/플러그인의 직접 목록, popup과 동일한 상태 공·독립 스위치·손잡이 내부 spinner를 확인한다. Work의 작업과 상태는 함께 열고, Claude Code 세션 버튼으로 Code의 같은 진입도 확인한다. 프로젝트 catalog 이름을 바꾸면 제목이 즉시 바뀐다. 양 세션의 native cache가 준비된 뒤 타일/메뉴 재열기·A→B→A·rename 시 nativeResources 호출이 증가하지 않는지 확인할 수 있다. 초기 다른 하네스 조회는 별도이며, IPC는 메모리 대역이다.
