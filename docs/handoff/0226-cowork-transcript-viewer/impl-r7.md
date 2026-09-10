# 0226 r7 구현 보고 — Delta V8

[Delta V8](feedback-plan-r7.md)의 CI·상단 추가 버튼·Temp 게시 보정이다. 독립 handoff verify는 이전 라운드와 함께 pending이다.

## [구현자 기입] 설계 리뷰

게시 입력 검사는 기존 cwd/add-dir를 먼저 적용하고, 그 밖의 파일에만 실제 OS Temp를 추가 허용 root로 검사한다. Temp가 없더라도 기존 작업 폴더 게시가 실패하지 않는다. Temp를 사용한 경우 그 경로도 읽기 후 canonical root 재검사에 포함한다.

상단 버튼은 기존 공통 Button의 primary/small/plus를 사용한다. 프로젝트와 플러그인 두 생산 파일만 바꾸고 엔진 reference·공통 토큰·생성 동작은 유지한다. 새 저장소·migration·IPC·의존성은 없다.

현재 CI의 실패는 이전에 보고된 runtime-tools/bootstrap 실패와 다른 집합이었다. 첨부에 제목만 있어 [실제 현재 커밋의 CI](evidence/r7-ci-baseline.json)를 조회하고 파일·라인·관측값을 기준으로 범위를 확정했다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인

| EP | 생산 경로 / 관측 |
|---|---|
| EP35 3/3 | 프로젝트·스킬·MCP 상단 버튼을 엔진 버튼과 대조. 실제 light/dark 및 넓은/좁은 화면에서 computed 기본/hover 스타일·plus, 메뉴/모달·Enter/Escape 확인 |
| EP36 5/5 | Temp resolver→canonical containment→stable/candidate/root 후검사→서비스 사본/세션→실제 tool 영수증. input-files/service 테스트에서 정상 입력·탈출·교체·실파일/DB/preview 결과 관측 |
| EP37 4/4 | files.contextDirectory의 async canonical 경로, attachments의 실제 Temp 실체, Composer mock export, 작업폴더/add-dir context 표시 기대값. 실제 Windows 8.3 Temp에서 4 suite 50/50 |

전수 검색은 artifacts의 files/tool/service 생산 파일에서 `readArtifactInput|sourceRoots|finalRoots|publish_artifact|service.publish`, AgentEnvironmentView/ProjectsScreen/ExtensionsCatalogView에서 `leadingIcon|variant|addEngine|newProject`를 대조했다. 기존 일반 출력의 직속 파일 검사와 RuntimeToolContext/query의 extraDirs는 수정하지 않았다.

## [구현자 기입] 이번 라운드 수정의 잠금

별도 적대 변이는 해당 없음 — query 모형이 아닌 실제 tool handler→서비스·파일·SQLite와 실제 renderer 스타일/행동을 관측한다. 새 Temp 테스트는 수정 전 unsafe-path로 7건 실패했고 영향 집합은 수정 후 71건 통과했다. candidate/root를 읽기 뒤 정션으로 바꾸는 두 경우도 file-changed를 직접 관측한다.

선택 적대 증거 0 · 인용 변이 0 · 새 구조적 proxy oracle 0 = 잠금 표 행 0. 버튼 검사도 클래스 존재만 보지 않고 실제 computed style과 입력 결과를 비교한다.

## [구현자 기입] Product/UX 파생 검토

일반 파일과 아티팩트 게시의 구분을 유지한다. Temp 파일을 게시하면 관리 사본이 생기고 원본은 남는다. 원본 삭제 후에도 게시 사본 preview가 가능하며 다른 세션은 그 참조를 읽을 수 없다.

스킬의 드롭다운·열림 상태, MCP 추가 모달, 프로젝트 생성 모달, provider 탭의 추가 버튼 숨김은 유지한다. 상단 외 프로젝트 empty CTA를 변경하지 않았다. 기존 PowerShell 권한 정책과 카드 뒤 spark 순서도 무변경이다.

## [구현자 기입] 놓친 잠재 문제와 대응

- 기존 service 테스트가 Temp를 extraDirs에 명시해 게시 입력 누락을 가렸다. 해당 보조 권한을 제거하고 실제 tool context도 extraDirs 없이 게시하도록 보강했다.
- 동기 realpath와 비동기 realpath는 Windows 짧은 경로에서 다른 표기를 반환할 수 있었다. 테스트 기대값은 생산 경로와 같은 비동기 canonical 결과를 사용하며, 실제 8.3 TMP/TEMP를 주입하여 확인했다.
- 전체 루트 목록에 Temp를 무조건 더하면 Temp가 없는 경우 기존 cwd 게시가 실패한다. 기존 root로 승인되지 않을 때만 Temp를 평가하고 없는 Temp 회귀를 함께 검사했다.

## [구현자 기입] 구현 보고

| 검사 | 관측 |
|---|---|
| 기존 CI | 4 suite 10 실패. [요약](evidence/r7-ci-baseline.json)·[원문 로그](evidence/r7-ci-baseline.log) |
| CI 집합 로컬 재현 | 일반 경로에서는 7 실패/43 통과. [로그](evidence/r7-ci-local-baseline.log). 실제 8.3 Temp로 보정 후 50/50, [결과](evidence/r7-ci-local-green.json) |
| Temp 게시 | 수정 전 7 실패/29 통과 → 영향 7파일 71/71. [red](evidence/r7-publish-red.log)·[green](evidence/r7-publish-green.log). 개별 실행 worker 종료 timeout 경고 한 건은 [stderr](evidence/r7-publish-green-error.log)에 보존 |
| 타입·스타일·빌드 | node/web/test 타입, 변경 TS/TSX ESLint(오류·경고 0), Prettier, electron-vite main/preload/renderer 통과. 기존 SubAgentTileContent 정적/동적 import 경고 유지 |
| 문서·스크립트 | inventory·test budgets 통과. Node script tests 116/116 |
| 전체 gate | 로컬 전체 Vitest 실행 중. 관련 집합은 통과한 상태로 먼저 푸시하여 Windows CI도 병행 확인한다. 최종 CSS 기반 native 증거와 CI 결과를 추가한 뒤 IMPL_DONE으로 전환한다. |

현재 AC43·44 SELF_PASS, AC45는 현재 실패 집합 50/50을 확인했으며 전체 CI 결과를 기다린다. 중간 구현 커밋은 Criteria-Met 2/3, Status partial이고 최종 완료를 주장하지 않는다.

## [구현자 기입] Review Signals

현재 라운드 7. 버튼은 사용자 구체화이고 Temp는 SDK와 publisher의 입력 허용 범위 불일치였다. 테스트 fixture가 추가 권한을 주어 결함을 가린 점을 실제 무추가권한 tool 경로로 보완했다. 이번에는 전체 Vitest와 현재 커밋의 원격 CI까지 확인한다. 독립 코드 리뷰는 handoff verify를 대체하지 않는다.
