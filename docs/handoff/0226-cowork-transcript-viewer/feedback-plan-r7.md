# 0226 CI·추가 버튼·Temp 게시 보정 — Delta V8

READY · Codex · 2026-09-10. V1~V7 및 r6 구현 `cdc8175b`를 승계한다. 같은 사용자 피드백의 구현을 이어가며 독립 verify pending은 유지한다.

## Part I — 사용자 결과와 결정

| 결정 | 명시 요구 / 동작 |
|---|---|
| D-37 ACTIVE | “엔진 추가 버튼이 레퍼런스” — 프로젝트 상단 새 프로젝트와 플러그인 상단 스킬/MCP 추가를 같은 공통 Button 디자인으로 맞춘다. 기존 생성 모달·스킬 메뉴와 탭 전환을 유지한다. |
| D-38 ACTIVE | “publish artifact 도구가 … Temp 경로를 unsafe-path라고 한다. 해당 경로는 허용” — 게시 입력에 실제 OS 사용자 Temp와 그 하위 파일을 허용한다. Windows는 기존 resolver의 LocalAppData/Temp 및 OS 재지정을 따른다. cwd/add-dir 게시와 기존 파일 형식·크기·로컬 경로·실체 경계 검사는 유지한다. |
| D-39 ACTIVE | “vitest 실패: 첨부” — 첨부는 제목 한 줄뿐이다. 현재 HEAD의 CI run 34465282903에서 확인한 실패 10건을 보정하고 실행 결과로 확인한다. 테스트가 현재 동작과 어긋나면 기대값/fixture를 수정하며 정상 제품 동작을 과거 기대값으로 되돌리지 않는다. |

버튼은 light/dark에서 레퍼런스와 같은 색상·크기·간격·plus 아이콘을 사용한다. 스킬의 dropdown 표시와 메뉴 열림은 유지한다. 프로젝트 empty CTA는 지정한 상단 버튼과 별개이며 그대로 둔다.

Temp의 완성된 파일로 publish_artifact를 호출하면 관리 사본과 해당 세션의 게시 참조를 얻는다. 입력 원본은 보존하고 게시 성공 여부·취소·실패·재시도·세션 소유권은 기존 흐름을 따른다. OS Temp 허용은 게시 입력에 한정하며 임의 폴더나 다른 도구의 권한으로 확장하지 않는다. 일반 출력의 Temp 직속 원본 정책은 유지한다.

| AC / 노드 | 행동 기준 / 직접 oracle |
|---|---|
| AC43 / NEW R43↔AT43 | 프로젝트·스킬·MCP 상단 추가 버튼이 엔진 추가와 같은 primary/small/plus 토큰을 사용한다. 실제 computed style과 light/dark 화면, 기존 클릭·키보드·닫기 동작 |
| AC44 / NEW R44↔AT44 | cwd/add-dir 밖의 실제 OS Temp 파일을 게시할 수 있다. root·하위·Windows 짧은 표기, tool→service→실파일/DB/preview 경로. Temp 밖 형제 및 외부로 나가는 정션은 거부하고 게시 사본·원본·세션 격리를 유지한다. |
| AC45 / NEW R45↔AT45 | 현재 CI의 4 suite 10 실패를 재현 가능한 현재 계약으로 보정한다. 해당 suite 실행, 전체 Vitest 및 Windows CI 결과로 확인한다. |

## Part II — 조사와 기술 적용

| 대상 | 관측 / 최소 적용 |
|---|---|
| 상단 추가 버튼 | AgentEnvironmentView는 primary/small/plus다. ProjectsScreen은 variant 생략, ExtensionsCatalogView는 contained이며 plus 누락이다. 기존 Button props만 맞추고 공통 토큰은 수정하지 않는다. |
| publisher 허용 root | tool→service→readArtifactInput의 허용 목록은 cwd/extraDirs뿐이다. SDK에는 별도로 Temp가 전달되지만 publisher context에는 없다. 파일 입력 검사에서 실제 Temp를 허용하고 query/사용자 extraDirs는 바꾸지 않는다. |
| Temp 검증 | getTemporaryFilesPath를 단일 출처로 사용한다. canonical root와 candidate containment 및 stable read 뒤 root/candidate 재검사를 유지한다. 기존 cwd 게시가 존재하지 않는 별도 Temp root 때문에 실패하지 않게 한다. |
| CI 현재 실패 | [run 34465282903](https://github.com/muzaby/orca-skin/actions/runs/34465282903): files.contextDirectory 1, attachments 2, composerRequirementWiring 6, workPanelSections 1. 경로 실체 기대값·현재 hook mock·컨텍스트 표시 기대값을 원인과 대조한다. |

publish 입력→바이트 검증→관리 파일 준비→DB publication→tool 영수증/알림의 기존 수명은 재사용한다. 새 저장소·migration·IPC·의존성은 없다. tool 설명과 현재 영속성 문서에 Temp 입력 허용을 반영한다. 실제 파일·DB 검증은 기존 service fixture의 독립 Temp resolver를 사용하여 허용 밖 형제 경로를 계속 검사한다.

| Pair | requiredness / 경로 / oracle |
|---|---|
| VP83 | REQUIRED · NEW R43↔AT43 · 세 화면 상단 Button→메뉴/모달, 실제 스타일·기존 액션 |
| VP84 | REQUIRED · NEW R44↔AT44 · Temp 완성 파일→publisher→관리 사본/세션 참조→preview, 실제 파일/DB 결과 |
| VP85 | REQUIRED · NEW AR11↔IT11 · runtime tool context→service→Temp 입력 검사·사본/DB·영수증, 실제 tool handler 합성 |
| VP86 | REQUIRED · NEW MD11↔UT11 · 허용 roots·canonical containment·stable read 및 후검사, 정상 Temp/short path와 외부 탈출·교체 직접 결과 |
| VP87 | REQUIRED · NEW R45↔AT45 · CI에 명시된 4 suite→생산 경로/현재 fixture→기대 결과, 로컬 및 CI Vitest |
| VP88 | REGRESSION · INHERITED R18·38↔AT18·38와 게시/카탈로그 동작 · 일반 Temp 직속·원본, 기존 cwd/add-dir·형식/크기·세션·취소/실패/cleanup, 기존 실제 suite |

별도 적대 변이는 not selected다. 실제 반환값·파일·DB·DOM을 직접 관측하며 r6의 PowerShell 승인 분리와 spark 순서 및 비영향 nav/패널은 기존 증거를 승계한다.

## §10 강제 지점과 gate

| EP | 지점 / N | 실패 의미 |
|---|---|---|
| EP35 | 프로젝트 상단·스킬 상단·MCP 상단 / 3 | 다른 버튼 색상/아이콘, 메뉴·모달 동작 소실 |
| EP36 | Temp root 해석·candidate 경계·stable read와 후검사·서비스 사본/세션·tool 입력/영수증 / 5 | Temp 정상 파일 거부, 외부 탈출, 변경 중 혼합 바이트, 잘못된 세션/거짓 성공 |
| EP37 | files.contextDirectory·attachments·composerRequirementWiring·workPanelSections / 4 | Windows canonical 경로 불일치, 누락 mock export, 현재 컨텍스트 기대값 불일치 |

원인 재현 후 최소 수정한다. 영향 Vitest와 전체 Vitest, node/web/test 타입, 변경 파일 ESLint/Prettier, 두 테마의 실제 Button 스타일·메뉴/모달·좁은 화면, electron-vite build, inventory/test budget/whitespace를 수행한다. SQLite는 기존 Electron ABI를 유지하여 Electron-as-Node로 실행한다. 기존 브랜치에 설계와 구현을 분리하여 커밋·푸시하고 CI를 확인한다.

READY self-review: D37~39→AC43~45→VP83~88→EP35~37을 현재 호출부와 대조했다. 기존 ACTIVE 결정과 충돌 0; Temp 허용을 publisher에 추가하되 일반 출력의 직속 수집과 다른 도구의 권한은 유지한다. handoff-review DIAGNOSE_ONLY: 버튼은 사용자 구체화(D), Temp 입력 불일치는 구현 결함(F), CI는 현행 fixture와의 불일치를 실측 후 분류한다. 지침 자체는 수정하지 않는다.

## [구현자 기입] Delta V8 결과

AC43~45 자기확인 3/3, VP83~88 SELF_PASS, EP35 3/3·EP36 5/5·EP37 4/4. [구현 보고](impl-r7.md)에 Windows 8.3 경로 재현, Temp 게시의 실제 tool/DB 동작, 최종 CSS native 228건 및 로컬·Windows CI의 전체 Vitest 결과를 기록했다. 독립 verify는 pending이다.
