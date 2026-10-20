# 하네스 메뉴 시각 검증

`app`에서 `node node_modules/vite/bin/vite.js --config scripts/fixtures/opencode-ui/vite.config.ts --host 127.0.0.1`을 실행한 뒤 `/scripts/fixtures/harness-entry/index.html`을 연다.

실제 Sidebar·ChatTitleBar·하네스 Header·chatStore를 렌더한다. IPC만 메모리 대역이며 실제 모델/파일/설정에 쓰지 않는다. 테마, nav 접힘/너비, Claude/OpenCode 세션 버튼으로 배치·그룹·상태·지원되는 Claude 세션 제어를 확인한다. 새 대화 메뉴 선택은 실제 초안 전이를 실행한다.

`Claude 세션`과 `Claude 세션 B`는 서로 다른 세션 ID로 전환한다. `빈 세션`의 케밥에서는 MCP·플러그인 그룹이 회색 disabled이며 하위 패널이 열리지 않는다. 실제 목록에서는 제목 왼쪽 상태 공과 MCP 공식 마크를 확인한다. 공은 활성 제어, 플러그인 이름은 폴더 열기이며 상태 부제목·우측 스위치는 없다. IPC 응답을 지연시키면 해당 공의 spinner와 다른 항목의 사용 가능 여부를 확인할 수 있다.

`프로젝트 화면`은 실제 ProjectLandingPage와 Composer를 렌더한다. 초안을 입력하고 모델 메뉴에서 하네스를 바꿔 헤더 교체와 초안 보존을 확인한다. `메뉴 화면`으로 돌아와 Claude 세션의 플러그인 하위 메뉴에서 폴더 열기 행과 독립된 세션 활성 제어를 볼 수 있다. 이 화면의 확장 이름은 예시 데이터이며 실제 native 조회는 main reader/IPC 테스트와 로컬 읽기 smoke로 검증한다.
