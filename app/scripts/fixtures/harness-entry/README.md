# 하네스 메뉴 시각 검증

`app`에서 `node node_modules/vite/bin/vite.js --config scripts/fixtures/opencode-ui/vite.config.ts --host 127.0.0.1`을 실행한 뒤 `/scripts/fixtures/harness-entry/index.html`을 연다.

실제 Sidebar·ChatTitleBar·하네스 Header·chatStore를 렌더한다. IPC만 메모리 대역이며 실제 모델/파일/설정에 쓰지 않는다. 테마, nav 접힘/너비, Claude/OpenCode 세션 버튼으로 배치·그룹·상태·잠긴 제어를 확인한다. 새 대화 메뉴 선택은 실제 초안 전이를 실행한다.
