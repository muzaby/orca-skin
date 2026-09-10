# 구현 보고 — 플러그인 상세와 Code 변경사항 확대

같은 사용자 피드백 구현 턴에서 Delta V4의 AC28~31을 구현 완료했다. 앞선 탐색·프로젝트 변경은 [V3 보고](impl-r3.md)에 기록되어 있다.

| 요구 | 구현 결과 / 관측 경로 |
|---|---|
| AC28 | 스킬·MCP·연결을 공통 `CatalogListRow` 세로 목록으로 표시한다. 그룹 접힘과 표 열 헤더를 제거하고 제목·보조 정보·선택 상태를 유지한다. |
| AC29 | 목록을 유지한 채 `ExtensionDetailPane`에 기존 상세를 연다. 닫기 후 실행한 행으로 초점을 복구하고 탭 변경 시 상세를 닫는다. |
| AC30 | `ResizableSidePane`의 드래그·키보드 조절과 전체 확대·복원을 재사용한다. 탭+ID로 상세 폼을 구분하며 확대 동안 목록은 inert, 상세 DOM·스크롤은 보존한다. |
| AC31 | Code 변경사항 헤더에 공통 확대 상태를 전달한다. 펼치기는 transcript host를 덮고 복원은 기존 열 너비를 유지한다. 확대한 타일을 닫을 때 확대 상태도 해제한다. |

## V-pair와 강제 지점

EP18 3/3은 세 탭의 실제 목록, EP19 5/5는 선택·닫기·탭·항목 전환·MCP 이름 변경/삭제, EP20 2/2는 실제 드래그/키보드·확대/복원을 관측했다. VP51~57은 이 경로와 선택/목록 렌더 테스트로 자기확인했다. EP21 2/2 및 VP58~59는 Code의 실제 헤더 버튼에서 공통 pane까지 확인했다. VP60은 공통 크기 조절·뷰어 저장소·레이아웃 및 Work/Code 세션별 inert 회귀를 확인했다. 독립 verify를 대신하지 않는다.

## 검증

- 최종 플러그인 선택·목록·MCP 상세·그룹·행 및 Code 헤더·타일·세션 수명 Vitest: 10파일 88개 통과.
- 공통 크기 조절·뷰어 저장소·우측 패널 레이아웃 Vitest: 3파일 19개 통과.
- 플러그인 실제 Electron fixture: [84/84 통과](evidence/r3-plugin-panel-result.json), JS 오류·콘솔 경고·외부 요청 0. 1400/960/720 폭, 포인터·키보드 조절, 동일 DOM·스크롤·너비 복원, 닫기 초점, MCP 변경·삭제와 지연 저장을 확인했다.
- [플러그인 manifest](evidence/r3-plugin-panel-manifest.json)는 실행 당시 소스 SHA를 보존한다. 이후 ko/en 변경은 fixture가 사용하지 않는 Code 변경사항 복원 라벨이다. `catalogGroups.ts`는 소비자가 사라진 접힘 export만 제거했으며 목록 순서를 정하는 함수 본문은 불변이다. 정리 후 목록·그룹 테스트를 다시 확인했다.
- Code 실제 Electron fixture: [18/18 통과](evidence/r3-code-panel-native-result.json), JS 오류·콘솔 경고·외부 요청 0. 확대 시 transcript host와 surface의 위치·크기가 일치하며 캡처 직전에도 다시 확인했다. 비교 선택·열 너비·입력 초안·diff/가로/transcript 스크롤 및 닫은 뒤 재열기를 확인했다. [Code manifest](evidence/r3-code-panel-native-manifest.json)의 소스 SHA는 현재 코드와 모두 일치한다.
- renderer 타입 검사, 변경 소스 ESLint·Prettier, electron-vite build, doc inventory·test budget·diff whitespace를 통과했다. 처음 확인된 테스트 props 타입 추론과 lint 오류는 수정 후 해당 검사와 테스트를 다시 통과했다.
- Electron fixture는 mock IPC와 임시 userData를 사용한다. 실사용 DB나 외부 인증 서버를 변경하지 않는다.

## 발견과 수정

스킬/MCP 케밥을 연 뒤 초점이 트리거에 남으면 Escape가 상세까지 닫는 경로를 발견했다. 메뉴·모달이 있을 때 패널의 Escape 처리를 건너뛰어 해당 overlay가 먼저 닫히게 했다. 실제 키 입력으로 첫 Escape는 메뉴만, 다음 Escape는 상세를 닫는 것을 확인했다.

MCP 저장 중 모달을 닫고 다른 편집을 열면 이전 저장 완료가 새 편집을 닫을 수 있었다. 기존 취소 비활성화와 같은 `busy` 상태를 공통 Modal에 전달해 저장 중 Escape·배경 클릭도 차단했다. fixture가 update Promise를 보류한 상태에서 차단과 저장 완료 후 이름 변경을 확인했다.

삭제 완료와 닫기 후 지연 초점 복구는 선택 세대를 확인해 사용자가 새로 고른 항목에 영향을 주지 않는다. 다른 탭의 같은 ID가 서로 다른 상세를 가리키며, 스킬 본문 표시 모드와 연결 입력은 항목 전환 시 초기화한다.

## Review Signals

신규 의존성·IPC·DB migration 없이 기존 feature 조립과 공통 패널을 사용한다. 본 보고는 Delta V4 자기확인이며 V1~V3의 독립 검증 상태를 PASS로 바꾸지 않는다.
