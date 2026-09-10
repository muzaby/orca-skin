# 0226 r5 구현 보고 — Delta V6

기준 설계 `2ce0d3ba`, [Delta V6](feedback-plan-r5.md). AC36~40 자기확인 5/5, VP70~78 SELF_PASS. 독립 verify는 pending이다.

## 변경과 사용자 결과

- 최근 대화는 기존 CollapsibleSection 아래에 임시·저장 행을 모두 배치한다. 표시용 프로젝트명 전달을 제거하고 실제 제목의 `/`는 보존한다. 접힘·키보드·새 항목·화면 전환에서 같은 수명을 사용한다.
- 일반 출력도 기존 artifact part에 저장하고 게시 카드와 같은 턴 footer에서 표시한다. 확정/live 본문 아래 spark/status, 완료 메타, 카드 순서이며 background ready에서는 기존 spinner 숨김을 유지한다. 세션 최하단 OrdinaryOutputCards는 제거했다.
- 일반 파일은 OS Temp 원본에서 status/preview/export/reveal/trash를 실행한다. 관리 사본을 만들지 않으며 과거 일반 파일도 원본 소실 시 사본으로 fallback하지 않는다. 게시 아티팩트는 관리 사본을 유지한다.
- Work·Code 대화에 Bash/WebSearch 제외와 PowerShell 허용을 적용했다. 새 설정·seed·provider 템플릿 및 실행 설정이 공통 기본값을 사용한다. `CLAUDE_CODE_USE_POWERSHELL_TOOL="1"`, `skipWebFetchPreflight=true`를 기본으로 하되 명시 환경값과 기존 우선순위를 보존한다. completion의 도구 없음은 유지한다.
- CI의 파일 reveal 기대값을 실제 canonical 경로로 수정했다. 첨부 경로의 Windows 짧은 표기를 지원하면서 미등록 파일·다른 세션·외부 정션은 거부한다. runtime/부팅 fixture를 현재 인터페이스에 맞추고 catch가 실행 오류를 숨기지 못하게 검사를 보강했다.

## 강제 지점과 검증

| EP / 결과 | 직접 확인한 경로 |
|---|---|
| EP28 3/3 | Sidebar 그룹·draft·저장 행. 접기/Enter/Space·새 행 수신·route 이동, 실제 제목 보존 |
| EP29 6/6 | hook 반환→SDK result 전 합류→HistoryWriter→DB part→live reducer→reload/footer. 세션·원래 tool ID 또는 응답 경계, 중복·지각 결과·메타 순서 |
| EP30 5/5 | ordinary capture·status·preview/export·reveal·trash가 동일 Temp inspect 사용. 게시 prepare는 별도 유지 |
| EP31 6/6 | conversation·completion·설정 조립·scaffold/seed·provider 템플릿·system header. default/명시값 충돌과 두 profile의 실제 query options |
| EP32 5/5 | cwd·extraDirs·정확한 첨부·runtime fixture·bootstrap ArtifactCatalog 위임. Windows 실파일 및 SQLite |

강제 지점 검색: `rg "captureOutput|files.inspect|inspectOutputFile|readForExport|revealPath|trashOne" app/src/main/features/artifacts`, `rg "output.captured|makeOutputFilesHook|ArtifactCards|PendingAssistant" app/src`, `rg "projectNameById|projectName=|CollapsibleSection" app/src/renderer/src`, `rg "allowedTools|disallowedTools|CLAUDE_CODE_USE_POWERSHELL_TOOL|skipWebFetchPreflight" app/src`로 생산·소비 경계를 대조했다.

| gate | 관측 |
|---|---|
| 최종 통합 Vitest | Electron-as-Node, threads pool, 22파일 **328/328**. 사용자 CI 실패 항목 전부 포함. [실행 로그](evidence/r5-vitest.log), [stderr](evidence/r5-vitest-errors.log) |
| 타입 | node·web·test 구성 모두 exit 0 |
| ESLint / Prettier | 모든 변경·신규 app/src TS/TSX scoped 검사 exit 0 |
| Native nav/프로젝트 | **179/179**, 29장, runtime/console/외부 요청 오류 0. [결과](evidence/r5-project-native-result.json) |
| Native transcript | **33/33**, 6장, 원래 턴·live spark·카드·preview·reload·idle 직접 검사. [결과](evidence/r5-turn-native.json) |
| 증거 현재성 | 두 manifest의 소스·CSS를 현재 파일과 대조하여 불일치 0. 기존 r4 증거 보존 |
| Build | electron-vite main/preload/renderer exit 0. 기존 SubAgentTileContent 정적/동적 import 경고 유지 |
| 문서/운영 | inventory 재생성·check, test budgets, git diff --check 통과. ABI rebuild·새 의존성 없음 |

Vitest는 PowerShell의 GUI 실행 파일 직접 호출이 종료를 기다리지 않는 문제를 피하도록 `ELECTRON_RUN_AS_NODE=1`과 `Start-Process -WindowStyle Hidden -Wait -PassThru`로 실행하고 로그 및 exit code를 수집했다. 테스트 종료 전의 `RUN` 출력만 성공으로 세지 않았다.

## [구현자 기입] 발견과 조치

1. 일반 파일의 DB `relative_path`는 UNIQUE다. 원본 파일명만 넣으면 다음 버전 등록이 실패했다. 기존 필드에 `temporary/<파일 ID>/<파일명>` 고유 등록 키를 저장하고 실제 읽기 권위는 검증된 inputSource로 분리했다. 새 migration은 없다.
2. SDK Stop은 스트림 밖에서 실행된다. 다음 result에 무조건 비우면 늦은 Stop이 다른 응답에 붙는다. hook 진입 때 메인 응답 세대를 고정하고 같은 세대의 result에서만 전달하며 중단된 신호도 제외했다. 종료 후 Stop, background child 텍스트, 최초 assistant 소비와 경쟁하는 Stop을 각각 실제 adapter 테스트로 닫았다.
3. Windows 8.3는 디렉터리뿐 아니라 파일명에도 적용된다. 등록 filename은 canonical basename을 사용하고 원본 검사와 같은 이름 체계를 유지한다. 일반 파일 root 비교도 짧은 디렉터리 표기를 허용하되 정션 우회는 허용하지 않는다.
4. runtime fixture의 최초 오류는 ensurePathProject 누락이었고 cancelAllHeld 누락이 이를 덮었다. current runtime 구독/종료와 tracker 계약까지 대조했고 정상 경로에서 classifier 호출·error event가 없음을 단언했다. 기존 artifact writer fixture의 category 기대값도 현재 DTO와 일치시켰다.

독립 코드 리뷰에서 늦은 Stop과 파일명 별칭 문제를 제기하여 수정·재확인했다. user consume 시 응답 경계가 남는다는 추가 의심은 coordinator의 closeBeforeUser 경로를 확인하여 철회했다. 구현 세부 조정이며 유효 결정·AC·EP를 바꾸지 않았다.

## Review Signals / 한계

- UI: 최근 그룹·턴 footer·원본 viewer를 실제 Electron 화면으로 확인했다. 일반 출력과 게시 아티팩트의 문구·액션 재사용 및 기존 idle 상태를 유지한다.
- 소유권 없는 과거 일반 출력은 우측 목록에 남는다. 시각이나 현재 tail로 과거 메시지 소유자를 추정하지 않는다.
- PowerShell 정책은 설치 SDK/동봉 CLI 지원과 실제 query 인자로 검증했다. 무원격 CLI 초기화 probe는 제한 시간 안에 목록을 반환하지 않아 실제 모델의 PowerShell 실행 성공으로 세지 않았다.
- probe 임시 폴더 `C:\Users\rlaeo\AppData\Local\Temp\orca-claude-policy-probe-Qm5cqO`의 삭제 재시도는 자동 승인 검토의 `blocked by policy` 거절로 수행하지 못했다. 추가 사유는 제공되지 않았고 우회하지 않았다. 이 폴더는 앱 데이터나 구현 산출물이 아니다.
- 독립 handoff verify는 수행하지 않았다. 이전 라운드 pending과 함께 검증자가 유효 V를 확인해야 한다.
