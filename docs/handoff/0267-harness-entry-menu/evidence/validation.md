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
