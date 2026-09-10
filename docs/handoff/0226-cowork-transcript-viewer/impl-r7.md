# 0226 r7 구현 보고 — Delta V8

[Delta V8](feedback-plan-r7.md)의 AC43~45 자기확인 3/3, VP83~88 SELF_PASS다. 로컬 전체 Vitest와 구현 커밋의 Windows CI가 통과했다. 독립 handoff verify는 이전 라운드와 함께 pending이다.

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

| Pair | 자기결과 / 관측 |
|---|---|
| VP83 REQUIRED | SELF_PASS — 최종 production CSS에서 세 버튼의 기본/hover 토큰과 기존 실제 입력 동작 |
| VP84 REQUIRED | SELF_PASS — Temp 직속·하위·Windows 8.3 파일을 extraDirs 없이 게시하고 원본·관리 사본 보존 |
| VP85 REQUIRED | SELF_PASS — 실제 tool handler가 서비스·파일·SQLite를 거쳐 영수증/알림을 반환하고 타 세션 읽기를 거부 |
| VP86 REQUIRED | SELF_PASS — cwd/extraDirs 및 Temp root와 candidate의 실체 경계·읽기 후 교체 검출 |
| VP87 REQUIRED | SELF_PASS — 현재 CI의 10 실패가 포함된 4 suite와 전체 로컬/Windows CI 통과 |
| VP88 REGRESSION | SELF_PASS — 일반 출력 직속 원본, 기존 게시 형식/크기·세션·취소/실패·cleanup을 영향 71건과 전체 집합에서 확인 |

| AC | 자기확인 |
|---|---|
| AC43 | ✅ 최종 CSS native 228/228, 두 테마와 두 폭에서 레퍼런스 토큰 및 기존 액션 일치 |
| AC44 | ✅ Temp 입력 8건 및 실제 tool→service 게시 경로, 기존 게시/일반 출력 회귀 통과 |
| AC45 | ✅ 실제 Windows 8.3 환경의 4 suite 50/50, 로컬·Windows CI 전체 Vitest 각각 4493 통과·1 skip |

✅ 3 · ⚠️ 0 · ❌ 0 = 이번 Delta AC 총 3. 이전 라운드 분모와 합산하지 않는다.

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
| CI 집합 로컬 재현 | 일반 경로에서는 7 실패/43 통과. [로그](evidence/r7-ci-local-baseline.log). 실제 8.3 Temp로 보정 후 50/50, [결과](evidence/r7-ci-local.json) |
| Temp 게시 | 수정 전 7 실패/29 통과 → 영향 7파일 71/71. [red](evidence/r7-publish-red.log)·[green](evidence/r7-publish-green.log). 개별 실행 worker 종료 timeout 경고 한 건은 [stderr](evidence/r7-publish-green-error.log)에 보존 |
| 타입·스타일·빌드 | node/web/test 타입, 변경 TS/TSX ESLint(오류·경고 0), Prettier, electron-vite main/preload/renderer 통과. 기존 SubAgentTileContent 정적/동적 import 경고 유지 |
| 문서·스크립트 | inventory·test budgets 통과. Node script tests [116/116](evidence/r7-script-tests.log) |
| 최종 Native | production CSS를 로드한 228/228, 28장, runtime/console/외부 요청 오류 0. [결과](evidence/r7-button-native-result.json)·[manifest](evidence/r7-button-native-manifest.json). 생산 입력 357개·증거 31개 SHA 대조 불일치 `[]`, CSS hash 일치 |
| 로컬 전체 Vitest | 477파일 중 476 통과·1 skip, 테스트 4493 통과·1 skip·실패 0, Electron-as-Node exit 0. [로그](evidence/r7-vitest.log)·[stderr](evidence/r7-vitest-errors.log). 1065.24초, worker 종료 경고 재발 없음 |
| Windows CI | [run 34487744739](https://github.com/muzaby/orca-skin/actions/runs/34487744739), 구현 코드의 `75322377`에서 전체 gate success. Vitest 4493 통과·1 skip, Node script 116/116. [결과](evidence/r7-ci-green.json)·[로그](evidence/r7-ci-green.log) |

원격 CI와 로컬 전체 결과로 AC45를 확인했다. 중간 구현 커밋은 Criteria-Met 2/3, Status partial이었고 최종 보고는 3/3이다. 최종 증거 커밋은 구현 코드에 추가 변경을 하지 않는다.

native hover의 최초 고정 150ms 대기는 offscreen CSS transition 완료 전 색상을 읽어 세 비교에서 한 색상 채널 차이를 보였다. fixture가 실제 CSS Animation.finished를 기다리게 보정한 뒤 최종 production CSS로 다시 228/228을 관측했다. 제품 코드를 이 측정 오차에 맞춰 변경하지 않았다. CI 원문 증거는 ANSI와 줄 끝 공백만 정리했다.

## [구현자 기입] Review Signals

현재 라운드 7. 버튼은 사용자 구체화이고 Temp는 SDK와 publisher의 입력 허용 범위 불일치였다. 테스트 fixture가 추가 권한을 주어 결함을 가린 점을 실제 무추가권한 tool 경로로 보완했다. 전체 Vitest와 구현 커밋의 원격 CI를 확인했으며 독립 코드 리뷰에서도 추가 수정이 필요한 finding은 없었다. 독립 코드 리뷰는 handoff verify를 대체하지 않는다.
