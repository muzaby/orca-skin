# 하네스 메뉴 시각 검증

`app`에서 `node node_modules/vite/bin/vite.js --config scripts/fixtures/opencode-ui/vite.config.ts --host 127.0.0.1`을 실행한 뒤 `/scripts/fixtures/harness-entry/index.html`을 연다.

실제 Sidebar·ChatTitleBar·하네스 Header·chatStore를 렌더한다. IPC만 메모리 대역이며 실제 모델/파일/설정에 쓰지 않는다. 테마, nav 접힘/너비, Claude/OpenCode 세션 버튼으로 배치·그룹·상태·지원되는 Claude 세션 제어를 확인한다. 새 대화 메뉴 선택은 실제 초안 전이를 실행한다.

`Claude Code 세션`과 `Claude 세션 B`는 같은 프로젝트의 다른 세션 ID다. 케밥→타일 표시의 Claude 상태/OpenCode 상태는 실제 RightPanel을 연다. Work인 Claude 세션에서는 상태 타일이 없다. 케밥 하네스/MCP/플러그인 popup은 없고 제어는 상태 타일에서 제공한다.

타일 제목의 normal weight·컬러 브랜드·프로젝트 이름과 hover의 프로젝트 경로, MCP/plugin 그룹 간격, 상태 공·독립 스위치·thumb 내부 spinner를 확인한다. on/off 손잡이 이동/색 전환과 reduced motion을 확인하며, 양 세션 이동과 재열기 때 cache의 추가 조회가 없는지 검사한다. 프로젝트 catalog 이름/경로 변경도 native 재조회를 만들지 않는다.

프로젝트 화면은 실제 ProjectLandingPage와 Composer를 렌더한다. Composer + 메뉴의 파일/스킬/플러그인과 nav 플러그인 페이지의 출처별 스킬 목록을 검사한다. 스킬 행에는 출처 보조설명 없이 이름/시간만 있고 후속 그룹 간격을 넓힌다. 엔진 화면의 실제 EngineCard는 양 하네스 제목 왼쪽 컬러 로고를 표시한다. IPC는 메모리 대역이며 실제 파일 선택·CLI 수명은 이 fixture의 범위가 아니다.
