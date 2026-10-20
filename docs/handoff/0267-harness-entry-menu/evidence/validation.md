# 구현 r1 검증 관측

2026-10-19, Windows. 구현자 자기확인이며 독립 verify 결과가 아니다.

## 기준선

`git fetch origin` 후 `git switch main`, `git rebase origin/main` 성공. 기준은 origin/main `5a99c1f5`이며 이전 작업 브랜치는 보존했다. 시작 시 기존 `.codex-remote-attachments/`와 ignored `.tmp/`를 보존했다.

## 명령과 관측

| 검사 | 관측 |
|---|---|
| `npm run lint` | 오류 0, 기존 react-hooks/incompatible-library 경고 2. 추가 titlebar 통합 테스트와 최종 명시 선택 보완 7파일도 개별 eslint 오류/경고 0. |
| `npm run typecheck` / `npm run build` | node·web·test 진단 0. Electron ABI already ok. main·preload·renderer 빌드 성공. 기존 SubAgentTaskDetail 정적/동적 import chunk 경고. |
| 관련 비-DB Vitest | 명시 선택 보완 후 store/reducer/Composer까지 포함해 135파일 1,515케이스 통과. |
| `node --test scripts/harness-boundary.test.mjs` | 8케이스 통과. 하네스/버전 경계 위반 없음. |
| `python -X utf8 docs/handoff/0266-renderer-design-guidelines/evidence/check-design-docs.py` | TSX source 291 / rows 291, 양방향 차집합 []; 누락/허위 행 및 링크 음성 대조 red. |
| `node scripts/check-doc-inventory.mjs --check` | 생성물·산문 통과. 링크 단계는 작업 전부터 있던 ignored `.tmp/opencode-dev` 외부 clone의 깨진 링크 5개로 실패. |
| 저장소 문서 링크 재검사 | 같은 `checkLinks`를 `LINK_EXCLUDED + '.tmp'`로 실행: broken=[]; 기존 외부 clone은 수정/삭제하지 않음. |
| `git diff --check` | 공백 오류 없음. lint가 만든 무관한 chat-turn.execution-config.test.ts 포맷 변경은 원복. |

Vitest 재현은 `app`에서 실행한다:

```powershell
node node_modules/vitest/vitest.mjs run src/main/adapters/claude src/main/adapters/opencode/v1/adapter.persistent.test.ts src/main/adapters/opencode/v1/native-resources.test.ts src/main/features/sessions/session-runtime.test.ts src/main/app/handlers/session-resources.test.ts src/main/app/bootstrap.native-history.test.ts src/main/app/bootstrap.shutdown.test.ts src/main/app/bootstrap.artifacts.test.ts src/preload/index.test.ts src/renderer/src/app/Sidebar.interaction.test.ts src/renderer/src/features/chat/store src/renderer/src/features/chat/reducer src/renderer/src/features/chat/components/Composer src/renderer/src/features/chat/components/ChatTitleBar.render.test.ts src/renderer/src/features/chat/components/ChatTitleBar.native-resources.test.ts src/renderer/src/features/chat/components/AgentModeToggle.test.ts src/renderer/src/features/chat/hooks/useNativeResources.test.ts src/renderer/src/features/chat/lib/nativeResourcesMenu.test.ts src/renderer/src/shared/ui/Popover src/renderer/src/shared/ui/popoverPosition.test.ts src/renderer/src/shared/ui/CascadeMenu
```

문서 링크 환경 분리 재현(`app`):

```powershell
node --input-type=module -e "import {checkLinks,LINK_EXCLUDED} from './scripts/check-doc-inventory.mjs'; const result=checkLinks('..',[...LINK_EXCLUDED,'.tmp']); console.log(result); process.exitCode=result.length?1:0"
```

## 적대 증거

| ID | 실제 삽입 | 관측 | 복원 |
|---|---|---|---|
| M1 | NewChatHarnessMenu의 setModel backend를 반대로 전달 | Sidebar.interaction: 2 failed / 4 | 원본 바이트 복원 후 green |
| M2 | nativeResourcesMenu의 MCP/plugin contents 맞바꿈 | nativeResourcesMenu: 2 failed / 2 | 원본 바이트 복원 후 green |

선택 증거 2, 인용 변이 0, 새 구조/배선 proxy oracle 0 = 잠금 2행. 새 테스트는 production 함수를 실행하는 직접 행동 oracle이다.

## 실제 브라우저

재현 화면은 [fixture README](../../../../app/scripts/fixtures/harness-entry/README.md)를 따른다. 실제 Sidebar·ChatTitleBar·landing Header·Popover·CascadeBody와 store를 쓰고 IPC만 메모리 대역으로 바꾼다.

- 1280×720 white: 펼친 nav.right=255.25, popup.left=255.25; trigger.top=popup.top=91.325. 로고 두 개와 라벨 순서 확인.
- dark 접힘: nav.right=popup.left=58; trigger.top=popup.top=85.325. 로고·문구 대비와 동일 정렬 확인.
- Claude Work/Code: h1의 첫 자식 SVG, 다음 span은 각 모드 문구. Code에서 SVG x=570.95, span x=614.45. 전체 묶음 중앙 배치.
- Down→Enter로 OpenCode 선택: 메뉴 닫힘, 새 대화와 기존 OpenCode 랜딩 마크 표시. Escape·바깥 클릭도 닫힘.
- 케밥: 타일 표시와 Claude/OpenCode 제목, MCP/플러그인 하위 메뉴. 화면 우측의 하위 메뉴는 왼쪽으로 펼쳐져 viewport 안에 유지.
- Claude MCP: 클릭 전 connected/checked, 클릭 후 disabled/unchecked, 메뉴 유지. 미지원 plugin은 enabled/checked/disabled와 세션별 제어 미지원 안내.
- 640×600: nav 메뉴 viewport 안. 긴 Code 문구는 남은 본문 폭에 맞춰 줄바꿈한다. 검증 후 viewport override 해제.

화면은 로컬 `.codex-remote-attachments/0267/nav-hero.jpg`, `native-menu.jpg`에 보관했다. 실 CLI 인증·MCP 서버에 연결한 smoke는 수행하지 않았다. SDK 경계는 mock Query 및 실제 OpenCode SDK+가짜 transport 테스트로 확인했다.

## 명시 하네스 선택 보완

모델 목록이 없는 하네스를 명시 선택했을 때 기존 Composer 폴백이 다른 하네스로 바꾸는 경로를 발견했다. ΔV2를 별도 설계 커밋으로 확정한 뒤 메모리 전용 선택 표시를 nav→store→reducer로 전달했다. 실제 Composer 렌더와 effect를 실행해 다른 하네스의 모델을 표시/선택하지 않음, 해당 모델의 늦은 도착, 기억값의 기존 폴백을 확인했다. store action 테스트는 자동 모델 채움·지각 boot seed·newChat 초기화를 확인한다.

## r1.2 — 사용자 지적 후속

2026-10-19. ΔV3를 구현과 별도 커밋으로 확정했다. native 파일은 읽기만 하고 실제 앱의 설치·인증·전역 설정을 변경하지 않았다.

| 검사 | 관측 |
|---|---|
| 위 Vitest 집합 + `pages/agentModeLanding.render.test.ts` + `pages/NewChatLandingPage.harness.test.ts`, `--maxWorkers=2` | 138파일 1,535케이스. 샌드박스 실행에서 135파일/1,524케이스 통과, 기존 plan-file 계열 3파일의 11케이스가 조상 파일 접근 제한으로 실패. 동일 3파일을 일반 권한으로 재실행: 37/37 통과. 합쳐서 대상 1,535케이스 통과. |
| 변경 경로 집중 테스트 | reader·adapter·bootstrap·IPC·메뉴·프로젝트 9파일 38/38 통과 |
| `node node_modules/eslint/bin/eslint.js --cache src scripts` | 최종 오류 0, 기존 경고 4(가상화 라이브러리 2, 무관한 chat-turn.execution-config.test.ts 포맷 2). 새 테스트 변수 선언 오류·변경 파일 포맷 경고는 수정했다. 이후 관련 3파일 10케이스 재통과. |
| `npm run typecheck` | node/web/test 모두 exit 0 |
| `node node_modules/electron-vite/bin/electron-vite.js build` | main/preload/renderer production 번들 성공. prebuild 없이 기존 Electron ABI 유지. |
| `node --test scripts/harness-boundary.test.mjs` | 8/8 통과 |
| design catalog 검사 | source=292, rows=292; source-minus-doc=[], doc-minus-source=[]; 기존 음성 대조도 통과 |
| doc inventory / prose / links | 생성물·산문 통과. 기존 `.tmp/opencode-dev` 외부 clone 링크 오류 5개 유지. `.tmp` 제외 재검사 broken=[] |
| 실제 native reader smoke | production reader를 esbuild로 임시 번들한 뒤 저장소 cwd로 실행. 로컬 설치 플러그인 3개(구성 활성 2, 비활성 1), canToggle 전부 false. 해당 사용자/프로젝트 MCP 정의 없음. names/status만 관측하고 인증값·경로는 출력하지 않음. |

샌드박스 실패 재현 대상은 `adapters/claude/{plan-file,adapter.plan-file,adapter.plan-mode}.test.ts`다. 이번 변경의 reader는 영향을 받지 않았고 실제 파일 fixture 테스트도 통과했다. 완전한 인증 CLI/MCP 실행 smoke와 독립 verify는 수행하지 않았다.

### 잠금 / 화면

- M1의 backend 반전은 Sidebar 2 failed/4, M2의 MCP/plugin 맞바꿈은 메뉴 3 failed/3. 각 파일을 원본 바이트로 복원한 뒤 2파일 7/7 통과.
- 브라우저 실제 ProjectLandingPage + Composer에서 초안을 입력하고 모델 메뉴로 Claude→OpenCode→Claude 전환. 브랜드, Claude Code 히어로, 입력한 초안, 프로젝트 제목과 대화 목록을 관측했다.
- 1280×800 white/dark와 기본 좁은 pane에서 기존 헤더·Composer 표시 확인. 일시 viewport override는 reset했다.
- 실제 ChatTitleBar 그룹에서 연결 요약이 없고 플러그인 하위 행은 `설정에서 활성화`·checked·disabled로 표시된다. 브라우저 IPC 데이터는 fixture다.
- 증거 화면은 로컬 `.codex-remote-attachments/0267/project-opencode-r12.jpg`, `native-menu-r12.jpg`. 새 브라우저 세션 재연결 시 URL 대신 발견한 tab/browser ID를 사용해 복구했다.

## r1.3 — 재개 관측과 네이티브 명령

2026-10-19. ΔV4·ΔV5 설계를 별도 커밋한 뒤 구현했다. 기존 목록을 유지하면서 새 원천을 읽고, 제어 실패 시 자동 read를 실행한다. 설정/DB 쓰기와 네이티브 플러그인 자동 로딩은 추가하지 않았다.

| 검사 | 명령 / 관측 |
|---|---|
| 관련 회귀 | `node node_modules/vitest/vitest.mjs run src/main/adapters/claude src/main/adapters/opencode src/main/features/sessions/session-runtime.test.ts src/main/app/handlers/session-resources.test.ts src/main/app/bootstrap.native-history.test.ts src/preload/index.test.ts src/renderer/src/features/chat/hooks src/renderer/src/features/chat/lib src/renderer/src/features/chat/harnesses/common/composer src/renderer/src/features/chat/components/ChatTitleBar.native-resources.test.ts src/renderer/src/features/chat/components/Composer.selection.test.ts src/renderer/src/features/chat/components/AgentModeToggle.test.ts src/renderer/src/features/chat/store/chatStore.harness.test.ts src/renderer/src/app/Sidebar.interaction.test.ts src/renderer/src/pages/agentModeLanding.render.test.ts src/renderer/src/shared/ui/CascadeMenu.test.ts src/renderer/src/shared/ui/popoverPosition.test.ts --exclude src/main/adapters/opencode/v1/native-cursor.test.ts --exclude src/renderer/src/features/chat/lib/settlement.integration.test.ts`. 182파일 1,777케이스 중 최초 3실패. 빈 commands 계약의 기대값 1건과 refresh notice가 열린 submenu index를 바꾸던 실제 결함 2건을 수정했다. 실패한 2파일을 포함한 최종 집중 4파일 33/33 통과로 대상 전체 확인. |
| 수정 파일 추가 확인 | Claude native-resources + CascadeMenu + attachMenuModel 3파일 18/18. 주입 MCP·플러그인 명령 제외, exact 이름/힌트 운반 확인 |
| 이전 화면 회귀 | NewChatLandingPage.harness 1파일 3/3, CascadeMenu.flow 1파일 13/13, components/composer/modelSelection 1파일 4/4. Popover 단독 테스트 파일은 없으며 실제 래퍼 경로는 CascadeMenu.flow/CascadeMenu의 Popover 테스트에 있다. |
| DB 회귀 | Electron 실행 파일을 `ELECTRON_RUN_AS_NODE=1`로 spawn하고 native-cursor·settlement.integration 실행: 2파일 12/12. Node ABI127과 설치 ABI140 차이를 재빌드 없이 해결. 초기 일반 Node 실패 12개는 이 실행으로 재확인 |
| lint | `node node_modules/eslint/bin/eslint.js --cache src scripts`: 오류 0·기존 경고 4. 최종 변경 파일에 새 경고 없음 |
| typecheck | `npm run typecheck`: node/web/test 모두 통과 |
| build | `node node_modules/electron-vite/bin/electron-vite.js build`: main/preload/renderer 성공, prebuild 우회로 Electron ABI 유지 |
| boundary | `node --test scripts/harness-boundary.test.mjs`: 8/8 |
| catalog | `python -X utf8 docs/handoff/0266-renderer-design-guidelines/evidence/check-design-docs.py`: source=292/rows=292, 양방향 차집합 [], 기존 음성 대조 통과 |
| inventory/links | `node scripts/check-doc-inventory.mjs --check`: 생성물·산문 통과. ignored `.tmp/opencode-dev`의 기존 링크 오류 5개 유지. `checkLinks('..',[...LINK_EXCLUDED,'.tmp'])` = [] |
| M1/M2 | 기존 스크립트에서 파일명을 r1.3으로 바꾸어 실행. M1 2 failed/4, M2 3 failed/3. 원본 바이트 복원 후 7/7 |

합산 고유 회귀 범위는 187파일 1,809케이스다(182/1,777 + DB 2/12 + 추가 화면/선택 3/20). 단일 전건 실행의 통과 수치가 아니라 위 실패 수정·동일 파일 재실행을 합친 확인 범위다. 최종 집중/추가 검사와 mutation 복원 실행은 이 수에 중복 가산하지 않는다. 재현 로그는 로컬 `.tmp/0267-r13-{regression2,final-targeted,last-suites,db2,inherited,cascade-flow,model-selection,typecheck5,lint-final,build,boundary,inventory,links,mutations}.log`다.

### 직접 관측

- Hook: A→B→A, 닫힘/재열기, 재마운트, backend 변경, 지각 read/write, live 부재·부분 실패·완전 성공의 교체. 갱신 전 항목은 잠금·generation 제거. 제어 실패/read 성공 및 제어 실패/read 실패 모두 자동 read와 이전 목록 보존 확인.
- 실제 ComposerInputController→AttachMenu→CascadeMenu→draft: 양 backend에서 메뉴가 닫힌 진입부터 조회, `+ → 플러그인 → 하네스 → 플러그인`의 실제 이름 선택, `/session-B:review preserved draft`, onSend 0. 수동 refresh 중 명령 유지·메뉴 유지·완료 후 빈 명령 교체.
- OpenCode SDK+fake transport: `/docs:search`의 command/arguments/model/agent/variant/파일, synthetic noReply 문맥, HTTP 응답 미완료 동안 permission reply와 turn.ended. 이전 요청 오류는 새 입력을 종료하지 않고 현재 오류는 표면화. 미등록 slash는 prompt_async.
- 브라우저 production Composer fixture: `/native-workflow:review 기존 초안 유지`로 삽입되고 전송하지 않음. MCP에는 Filesystem 사용 안내·GitHub 인증 필요·`/mcp__filesystem__list`를 표시. refresh 클릭 후 메뉴 유지. 기본 좁은 pane과 1280×900에서 확인한 뒤 viewport override reset, 탭을 deliverable로 유지.
- 증거 화면: 로컬 `.codex-remote-attachments/0267/native-commands-r13.jpg`, `native-mcp-commands-r13.jpg`. 데이터는 fixture이며 실제 인증 CLI/MCP 사용 성공을 나타내지 않는다.

실 인증 CLI/MCP smoke 및 독립 handoff verify는 미실행이다. 앱 창 재시작 후 메모리 관측 보존은 범위 밖이며 실제 목록은 새 네이티브 원천 조회로 채운다.

## r1.4 — 네이티브 스킬과 설치 폴더 (ΔV6)

자기 검증 통과. 관련 회귀 집합은 Node 282파일 2,281케이스와 ABI가 맞는 Electron에서 DB 1파일 5케이스, 합계 고유 283파일 2,286케이스다. 이후 변경한 동일 파일 재실행은 합계에 더하지 않았다.

| 검사 | 명령 / 관측 |
|---|---|
| 회귀 | `vitest run src/renderer/src/features/chat` + Sidebar.interaction, NewChatLandingPage.harness, agentModeLanding.render, popoverPosition, CascadeMenu 및 main native/adapter/runtime/IPC/preload 테스트. `.tmp/0267-r14-regression.log`: 282 passed, DB 5건은 ABI 140/127 오류. |
| DB | `.tmp/0267-r14-electron.cjs`: `ELECTRON_RUN_AS_NODE=1`, settlement.integration 5/5. ABI 재빌드 없음. |
| 변경 후 재실행 | handler/hook/plugin-installation/session-runtime 4파일 107/107, Claude configured/handler 2파일 13/13. `.tmp/0267-r14-{final-tests,metadata-final}.log`. |
| 타입·린트·빌드 | `npm run typecheck`: node/web/test 성공. `eslint --cache src scripts`: 오류 0·기존 경고 4. 직접 electron-vite build: main/preload/renderer 성공. `.tmp/0267-r14-{typecheck,lint-final,build,build-final}.log`. 최종 hook 변경 후 web 타입 검사, 최종 상태 표시 후 메뉴 2파일 13케이스도 통과. |
| 문서·경계 | harness-boundary 8/8, design catalog source/rows 일치·양방향 차집합 []. inventory 생성물·산문 일치. ignored 외부 clone의 기존 링크 5건을 제외한 `checkLinks('..',[...LINK_EXCLUDED,'.tmp'])` = []. |
| 변이 | M1 backend 반전 → Sidebar 2 failed; M2 MCP/plugin 맞바꿈 → nativeResourcesMenu 3 failed; M3 스킬/MCP 목적지 맞바꿈 → attachMenuModel 1 failed. 원본 bytes 복원 뒤 3파일 15/15. `.tmp/0267-r14-mutations.cjs`와 동일 prefix 로그. |

실제 ComposerInputController→AttachMenu→CascadeMenu에서 양 backend의 스킬 선택은 `/session-B:review preserved draft`를 만든다. 화면 이름은 `session-B::review`, 설명은 title에만 있고 자동 전송은 없다. 플러그인 메뉴에 네이티브 스킬이 섞이지 않는 별도 트리 단언과 M3를 수행했다.

실제 NativeResourcesMenu→hook→sessionApi는 정상 밝기의 플러그인 행에서 openNativePlugin(sessionId,id)만 호출한다. 열기 실패는 목록을 다시 읽고 오류를 표시하며 다음 성공에서 오류를 지운다. main에서는 scoped 설치/라이브 ID, 세션·runtime 변경, strict 경로 주입 거부, 파일 실행 차단, shell 오류 반환을 검증했다.

브라우저 fixture에서 Claude/OpenCode, white/dark, 기본 좁은 viewport/1280×820를 확인하고 override를 reset했다. 플러그인 row의 computed opacity=1, role=menuitem, disabled=false, 설명+설치 폴더 열기 title을 관측했다. 스킬 선택의 원래 slash 삽입, +플러그인에는 MCP만 있음, 수동 새로고침 부재, 폴더 요청 fixture status를 확인했다.

로컬 화면: `.codex-remote-attachments/0267/native-plugin-folder-r14.jpg`, `native-skills-r14.jpg`, `native-plugin-folder-final.jpg`(활성/설치 상태 표시 유지). 실제 사용자 설치본의 Explorer 창 실행·인증 CLI 실행은 수행하지 않았으며 OS 경계는 shell stub으로 검증했다. OpenCode 설치 조회는 관측한 file/path 및 npm registry 캐시를 지원하고 미해석 명세/없는 폴더는 오류 안내와 자동 재조회로 처리한다.

## r1.5 — 활성 native plugin 스킬 발견과 실행 (ΔV7)

2026-10-20. 사용자 설치 registry의 frontend-design 활성 상태·manifest·SKILL.md를 읽어 누락 원인을 확인했다. 설치 설정과 원본 파일은 수정하지 않았다. 설계 본문과 새 초안 진입점 보완을 각각 구현과 분리해 커밋했다.

| 검사 | 명령 / 관측 |
|---|---|
| 새 catalog/query 집중 | `.tmp/0267-r15-targeted.log`: 7파일 69/69. 실제 설치 파일 fixture→metadata/SDK query options·기존 scan/allowlist 회귀 |
| 광역 회귀 | `.tmp/0267-r15-regression.log`: 70파일 918케이스 중 최초 16실패. 실행 옵션 테스트 1건이 실제 사용자 plugin을 예상하지 않아 native config를 격리했다. 나머지 15건은 Windows tmp 조상 stat EPERM. 같은 5파일을 일반 권한으로 재실행한 `restricted-rerun.log`는 65/65. 대상 918케이스를 이 재실행과 함께 확인했다. |
| 최종 saved/draft | `vitest run`에 session-resources, bootstrap.native-history, preload/index, useNativeResources, Composer.native-menu, composerAttachMenu 테스트를 지정: 6파일61/61(`final-focused.log`). 마지막 test fixture 타입 수정 후 session-resources 11/11(`handler-final.log`). |
| 최종 메뉴 | ChatTitleBar.native-resources, nativeResourcesMenu, attachMenuModel, composerAttachMenu: 4파일22/22(`final-menu.log`) |
| 회귀 포트 | Claude native-resources/adapter.live-control/configured-resources, OpenCode native-resources/plugin-installation/adapter.persistent, session-runtime: 7파일117/117(`ports-regression.log`) |
| 타입 | `npm run typecheck`의 node/web 성공. test 단계 새 mock 호출 타입 오류를 수정한 후 `npm run typecheck:test` 성공(`typecheck-final.log`, `typecheck-test-final.log`). 오류 없이 지나간 앞 단계는 반복하지 않았다. |
| lint | `node node_modules/eslint/bin/eslint.js --cache ./src ./scripts`: 오류0·기존 경고4(`lint-final.log`). 마지막 helper 주석·smoke 정리도 해당 파일 lint 통과 |
| build | `node node_modules/electron-vite/bin/electron-vite.js build`: main/preload/renderer 성공(`build-final.log`). prebuild 없이 SQLite Electron ABI 유지 |
| boundary | `node --test scripts/harness-boundary.test.mjs`: 8/8(`boundary.log`) |
| docs | design checker source=292/rows=292·양방향 차집합[]·음성 대조 통과(`catalog.log`). inventory 생성물/산문 일치, ignored `.tmp/opencode-dev`의 기존 링크 오류5개. `.tmp` 제외 `checkLinks`=[](`inventory.log`, `links.log`) |
| 선택 변이 | M2 MCP/plugin contents 맞바꿈→3failed; M3 스킬/MCP 목적지 맞바꿈→1failed. 원본 bytes 복원 후 2파일11/11(`mutations.log`) |

로그 이름은 별도 표기가 없으면 `.tmp/0267-r15-` 접두사다. 집중·메뉴·포트 재실행은 광역 회귀와 겹치므로 테스트 합계에 다시 가산하지 않았다. 실제 하네스 SDK 호출/파일 읽기/생산 컴포넌트 입력 경로를 확인했으며, 이번 턴에 전체 저장소 테스트를 실행했다고 주장하지 않는다.

### 실제 SDK/CLI와 설치 frontend-design

재현 스크립트는 [smoke-native-plugin-skills.mjs](../../../../app/scripts/smoke-native-plugin-skills.mjs)다. production ClaudeAdapter와 번들 SDK/CLI를 실행하며 모델 엔드포인트만 loopback HTTP/SSE 대역을 쓴다. 별도의 `.tmp/native-skill-smoke-*` 환경에 registry·settings를 만들고 host 인증 환경을 상속하지 않는다.

1. `node app/scripts/smoke-native-plugin-skills.mjs`: native plugin fixture + 비활성 Orca 스킬을 함께 전달한다. 실제 CLI가 frontend-design:frontend-design, frontmatter 별칭인 frontend-design:metadata-name을 보고하며 user-invocable:false 항목은 숨긴다.
2. `node app/scripts/smoke-native-plugin-skills.mjs <실제 설치 frontend-design 경로>`: 설치된 원본 SKILL.md를 그대로 읽는다. 원본 내용은 전후 동일하고, CLI의 모델 요청에 실제 skill 본문과 design-brief-0267 인자가 포함됐다.
3. 두 실행 모두 nativeResources에 frontend-design plugin/명령이 노출됐다. API 요청 1회, expanded=true, brief=true. 마지막 스크립트 정리 후 기본 fixture 재실행도 같은 결과다.

증거는 `cli-naming-final.log`, `cli-installed.log`, `cli-final.log`다. raw 설정·키·skill 본문은 로그에 출력하지 않았다. 외부 유료 모델·사용자 인증으로 실행하지 않았으므로 모델 응답 품질 검증을 의미하지 않는다.

### UI와 수명 관측

- 실제 ComposerInputController→AttachMenu→CascadeBody에서 저장 세션과 새 초안 모두 frontend-design::frontend-design을 표시하고 tooltip에 설명·인자 힌트를 제공한다. 선택 결과는 `/frontend-design:frontend-design preserved draft`, onSend=0이다.
- 초안 조회는 backend/cwd/pendingProjectId를 전달한다. A 폴더 요청 지연 중 B로 바꾸면 B 목록이 유지되고 A의 늦은 응답은 폐기한다. 새 초안 요청은 session lookup·토글·폴더 열기를 실행하지 않는다.
- runtime이 없으면 실제 설치 skill 파일의 명령 metadata를 쓰고, live commands가 있으면 빈 배열도 우선한다. 성공한 빈 설치 목록은 제거된 스킬을 지우고, 지원하지 않는 OpenCode offline 원천은 기존 관측을 유지한다.
- 네이티브 root는 SDK plugins와 skills에 합치되 Orca injected 제외 목록에는 넣지 않는다. 새/재개 spawn에 같은 정책을 적용하며 설정을 매번 다시 읽는다.

브라우저 mock을 추가로 바꾸거나 실제 Orca 창을 재시작하지 않았다. 현재 UI 스타일은 r1.4를 유지하며 이번 변경은 실제 데이터 발견·실행 및 새 초안 연결이다. 독립 handoff verify는 다음 단계다.

## r1.6 — 안내 제거·설치 범위·SDK 세션 제어

2026-10-20, Linux/Chromium. `codex-harness-entry-menu`의 r1.5에서 시작했으며 설계 정정을 구현과 분리했다. 아래는 구현자 자기확인이고 독립 verify가 아니다.

| 검사 | 관측 |
|---|---|
| 관련 회귀 Vitest | 74파일: 73파일 통과, 1파일의 미지원 configured 반환 기대값만 실패(1171 pass·1 fail·3 skipped). undefined로 계약을 정정하고 해당 bootstrap 포함 6파일 288/288 재통과. |
| 최종 변경 집중 Vitest | adapter native 제어·native resources·handler·hook·attachMenuModel·CascadeMenu: 8파일 71/71. registry 삭제 뒤 제어 거부 추가 후 handler 1파일 12/12. |
| 타입 | `npm run typecheck`: node/web/test 진단 0. |
| lint | `eslint --cache src scripts`: 오류 0, 기존 경고 4(무관 테스트 포맷 2·가상화 2). |
| production build | `node node_modules/electron-vite/bin/electron-vite.js build`: main/preload/renderer 성공. 네이티브 ABI 재빌드 없이 수행. |
| 실제 CLI smoke | `node scripts/smoke-native-plugin-skills.mjs`: 초기 비활성 inline flag가 명령을 숨김. 활성 skill 본문·인자가 loopback 요청으로 확장됨. runtimeToggle=true, 모델 요청 1회. 끄면 명령 제거, 다시 켜면 명령 복원. 설치/설정 파일 불변. |
| 경계 | `node --test scripts/harness-boundary.test.mjs`: 8/8. |
| 문서 | inventory/generated/prose/relative links 통과. design catalog source-minus-doc=[], doc-minus-source=[], 기존 음성 대조 통과. |
| 선택 변이 | M2 MCP/plugin 목록 맞바꿈 3/3 red; M3 native 스킬/MCP 배치 맞바꿈 1/8 red. 원본 bytes 복원 후 각각 3/3·8/8 green. |

관련 회귀 재현은 app에서 다음과 같이 실행한다. 최초 회귀 집합에서 빠졌던 attachMenuModel은 최종 집중 집합과 M3 복원 실행에 포함했다.

```sh
node node_modules/vitest/vitest.mjs run src/main/adapters/claude src/main/adapters/opencode/v1/native-resources.test.ts src/main/adapters/opencode/v1/plugin-installation.test.ts src/main/features/sessions/session-runtime.test.ts src/main/app/handlers/session-resources.test.ts src/main/app/bootstrap.native-history.test.ts src/preload/index.test.ts src/renderer/src/features/chat/hooks/useNativeResources.test.ts src/renderer/src/features/chat/lib/nativeResourcesMenu.test.ts src/renderer/src/features/chat/lib/attachMenuModel.test.ts src/renderer/src/features/chat/harnesses/common/composer/composerAttachMenu.test.ts src/renderer/src/features/chat/harnesses/common/composer/Composer.native-menu.test.ts src/renderer/src/features/chat/components/ChatTitleBar.native-resources.test.ts src/renderer/src/shared/ui/CascadeMenu src/renderer/src/shared/errors --maxWorkers=2
```

### 실제 브라우저

기존 harness-entry fixture의 실제 React 컴포넌트·store·ErrorToastLayer와 메모리 IPC를 사용했다. Chromium CDP로 클릭/Space 입력·DOM·bounds·스크린샷을 확인했으며 각 viewport에서 메뉴를 다시 열었다.

| 조건 | 관측 |
|---|---|
| white/dark 1280×800 | 그룹 제목·MCP·플러그인 및 실제 행만 표시, role=status 없음. 설명/폴더 열기 title 유지. 두 sibling 버튼, 중첩 button 없음. |
| dark 640×800 | 하위 메뉴 left=200.625/right=409.875, viewport 안. horizontalOverflow=false. |
| 폴더/제어 분리 | 이름 클릭은 folder API, Space로 활성 제어는 plugin write API만 호출. aria-checked true→false. |
| 실패 | 폴더 API reject 시 실제 전역 ErrorToastHost에 openFailed 제목과 상세 표시. 하네스 그룹에는 오류 안내를 추가하지 않음. 런타임 exception 0. |

시각 검사에서 secondary 버튼의 기본 w-full이 라벨을 밀어내는 문제를 발견해 w-auto!로 수정했다. 수정 후 두 테마에서 라벨·상태·제어가 모두 보이고 horizontalOverflow=false, primaryWidth=156.5였다. 기존 MenuItem/CascadeBody/ErrorToastHost를 재사용했으며 인증된 외부 모델이나 Windows OS 탐색기 실기는 수행하지 않았다.


r1.6 최종 추가 검사: 실제 Composer.native-menu/attachMenu.flow/composerAttachMenu/attachMenuModel 4파일31/31, partial 토스트+보고 registry 2파일253/253. 첫 전송 전 초안 보완 뒤 bootstrap/handler/preload/hook/titlebar/Composer 8파일79/79. 초안 목록은 읽기 전용이며 scope+id 폴더 요청의 strict union·상대 경로 거부·프로젝트 기본 cwd·미지원 하네스를 실제 callback/IPC/렌더로 확인했다.

브라우저 최종 보완 재실행: 첫 전송 전 플러그인 행 표시·폴더 클릭 성공, 활성 switch 부재. 이후 저장 Claude 세션에서 white/dark/640px·Space 활성 제어·이름 클릭·오류 토스트를 재확인했다. 관측은 draftInventory=true, draftFolder=true, keyboardToggle=true, folderOpen=true, errorToast=true, exceptions=[]였다.

## r1.7 — 프로세스 수명 상태와 비동기 상태 공

2026-10-20, Linux/Chromium. ΔV9를 구현과 별도 커밋으로 확정했다. 아래는 구현자 자기확인이며 독립 verify 결과가 아니다.

| 검사 | 관측 |
|---|---|
| 관련 Vitest | r1.6 재현 명령에 `src/renderer/src/shared/ui/cascadeMenuState.test.ts` 추가. 최종76파일 통과, 1,207 pass·3 skipped(`work/regression-final-r17.log`). |
| 수명/동시 작업 집중 | hook 21/21: 두 소비자의 같은 snapshot, A→B→A의 pending/완료 결과, 다른 항목 동시 시작·동일 항목 중복 차단, inactive/initial-read 종료, 새 generation 작업을 이전 완료가 지우지 않음을 관측했다. |
| main 상태/쓰기 | session-resources: 같은 살아 있는 generation에서만 metadata 실패 fallback 유지, generation 변경/exit 뒤 제거. runtime별 SDK 쓰기 순서 및 첫 reject 뒤 두 번째 실행을 관측했다. |
| 타입 | `npm run typecheck`: node/web/test 진단 0. 최종 hook·flow 테스트 변경 뒤 `npm run typecheck:test` 재실행도 exit 0. |
| lint | `eslint --cache src scripts`: 오류 0, 기존 경고 4(무관 테스트 포맷 2·가상화 2). |
| production build | `node node_modules/electron-vite/bin/electron-vite.js build`: main/preload/renderer 성공. 기존 chunk 경고 유지. 네이티브 ABI 재빌드 없음. |
| CLI | `node scripts/smoke-native-plugin-skills.mjs`: expanded=true, brief=true, requests=1, runtimeToggle=true. 초기 비활성·runtime off/on·설정 불변 확인. |
| 경계 | `node --test scripts/harness-boundary.test.mjs`: 8/8. |
| 문서 | inventory/generated/prose/relative links 통과. design catalog source-minus-doc=[], doc-minus-source=[], 기존 음성 대조 통과. |
| 선택 변이 | M2 MCP/plugin 목록 맞바꿈→10 failed/11, 원본 바이트 복원→11/11. M3 native 스킬/MCP 목적지 맞바꿈→1 failed/8, 복원→8/8. |

초기 회귀의 flow 테스트가 존재하지 않는 `pointerEnter` helper를 호출했다. 실제 harness의 `pointerTo`로 고친 후 해당 14/14와 관련 집중 6파일312/312를 재확인했고, 프로세스 교체 경쟁 1케이스를 추가해 hook 21/21을 확인했다. 초기 typecheck의 readonly fixture와 이전 제어 잠금/우측 스위치 기대값도 새 계약에 맞춰 정정했다. 생산 오류를 테스트 변경으로 숨긴 항목은 없다.

### 브라우저 직접 입력

[fixture README](../../../../app/scripts/fixtures/harness-entry/README.md)의 실제 React titlebar/Composer/메뉴와 IPC 대역을 사용했다. CDP에서 제어 응답을 수동 resolve해 대기 중 DOM·세션 이동·다른 항목 클릭을 관측했다. 스크린샷과 원시 로그는 작업 공간 `work/*-r17.log`, `work/native-menu-{spinner,empty}.png`에 보관했다.

| 조건 | 관측 |
|---|---|
| white/dark 1280×800·dark 640×800 | 이름만 있는 행, 왼쪽 상태 공, nestedButtons=false, horizontalOverflow=false. plugin primaryWidth=174.625, 640px submenu left=200.625/right=409.875. |
| 빈 saved 세션 | MCP/플러그인 각각 disabled=true, opacity=0.5, haspopup=false. click·ArrowDown/Right·Enter 뒤 하위 행 0. |
| 서로 다른 공 pending | MCP 요청 중 plugin 공 클릭 가능. requests=2, 같은 공 재클릭은 요청을 늘리지 않음. 메뉴/폴더 행은 enabled, 해당 공만 aria-busy=true·disabled=true. |
| A→B→A | A의 MCP 완료는 B를 보고 있는 동안 저장되고 복귀 시 checked=false. 아직 진행 중인 plugin은 복귀해도 spinner 유지, 완료 후 checked=false. A 재조회는 지연시켜 캐시 상태를 직접 확인. |
| 색·모션·로고 | MCP connected 초록, needs-auth 노랑, disabled 회색. 공식 SVG의 data-brand=mcp. reduced-motion에서 spinner animationName=none. |
| 회귀 | 초안 설치 목록/폴더 열기, 저장 세션 Space 제어, 폴더 이름 클릭, reject→전역 토스트. exceptions=[]. |

공식 MCP 경로 원본은 [modelcontextprotocol/favicon.svg](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/docs/favicon.svg)다. 배경 사각형을 제외한 원본 path를 currentColor stroke로 렌더했다. Windows OS 프로세스를 실기로 종료하는 검증은 하지 않았으며, 실제 SessionRuntime 채널 종료 이벤트와 renderer의 같은 이벤트 입력을 각각 테스트했다.
