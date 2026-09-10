# r2 구현 보고 — Delta V2

기준 구현은 `fde5557d`, 설계 정정은 `702c1cb5`·`75ce8388`·`a4e4ca9d`다. 사용자의 공통 패널·출력 카드·경로 프로젝트 요구와 Windows 임시 폴더 정정을 같은 구현 라운드에서 반영했다. 아래 결과는 구현자 자기확인이며 독립 handoff verify를 대체하지 않는다.

## 구현

- `ResizableSidePane`이 Transcript 뷰어, 아티팩트 화면 뷰어, 작업·계획 타일의 확대와 복원을 소유한다. 뷰어 좌측 핸들은 포인터·키보드로 폭을 조절한다. 확대는 현재 pane 전체를 사용하고 기존 DOM·초안·스크롤·일반 폭을 보존한다. iframe을 지나는 드래그와 취소·닫기·전환 시 자원 정리를 포함한다.
- `useSessionOutputs`로 닫힌 우측 패널과 무관하게 일반 출력의 최신 목록을 구독한다. 일반 파일은 Transcript 하단에서 공통 카드로 표시하며, 메시지에 이미 연결된 게시 ID는 중복하지 않는다. 게시 카드 부제목은 아티팩트만 표시한다. 두 카드 형상에서 메뉴 상단 메타·보관 폴더 열기·작업 성공 안내를 제거하고 실패·재시도는 유지한다.
- runtime의 채널 유휴·backlog 판정이 `ready` 활동을 전달한다. 점유 중인 세션과 실제 응답 중인 세션을 구별하여 즉시 입력 가능한 예약 대기는 일반 전송 UI로 표시한다. 실제 입력의 held→flush·commit 순서와 자동 응답 수신은 유지한다.
- Electron의 실제 Desktop 경로를 새 대화 기본값으로 사용한다. 최초 전송은 격리 전 source cwd로 경로 프로젝트를 생성하거나 재사용한다. 경로 정규화 키가 식별자이며 basename은 중복될 수 있다. nullable cwd migration은 기존 프로젝트와 지침을 보존한다. fork/handoff는 원래 프로젝트 관계를 계승한다.
- nav는 고정됨→전체 프로젝트 순서이며 최근 대화 그룹을 제거했다. 프로젝트 경로는 이름 왼쪽의 연한 prefix다. 프로젝트 랜딩은 제목→Composer→공통 목록 행을 사용하며 지침은 상단 메뉴에서 편집한다. 아티팩트 제목의 총 개수는 검색·고정 탭에 따라 변하지 않는다.
- 첨부·클립보드 사본과 일반 출력은 `getTemporaryFilesPath()`의 OS 임시 폴더를 공유한다. Windows 기본값은 `%LOCALAPPDATA%\\Temp`이며 OS의 TEMP 재지정을 따른다. 모델에 실제 절대 경로를 전달하고 Windows에서 `/tmp` 링크를 다른 경로로 바꾸던 별칭 처리를 제거했다. 기존 관리 사본과 과거 대화는 이동하지 않는다.

## 전수 확인과 V 추적

| 강제 지점 | 자기확인 | 실제 경로 |
|---|---|---|
| EP6 | 3/3 | Transcript viewer·catalog viewer·task/plan 확대 |
| EP7 | 3/3 | Transcript 목록 구독·우측 출력 구독·공통 카드 |
| EP8 | 4/4 | runtime 전이·snapshot/복원·Composer·Transcript |
| EP9 | 4/4 | Desktop 기본값·최초 send 연결·DB/DTO·landing cwd |
| EP10 | 3/3 | Sidebar·project landing/list·지침 menu/dialog |
| EP11 | 1/1 | catalog 제목의 전체 목록 개수 |
| EP12 | 3/3 | attachment directory·output directory·prompt/link 해석 |

재열거는 해결 함수 이름만 검색하지 않고 `ArtifactCards|acquireArtifacts`, `listening|sessionBusy|transport`, `getWorkspacePath|pendingProjectId|cwdKey`, `viewerExpanded|expanded`의 producer와 소비 흐름을 따라 확인했다. 확대의 Code plan, source cwd와 fork의 실행 cwd, 비활성 세션의 project promotion도 포함했다. 총 21지점을 위 표의 의미 단위로 닫는다.

| V pair | 증거의 범위 |
|---|---|
| VP13·21·27 | 두 뷰어와 task/plan의 native 치수·드래그·키보드·복원, resize/store 단위 검사 |
| VP14·15·24 | ordinary list/event→두 카드 형상→menu/viewer, 버전·중복·세션 격리·저장 성공/실패 |
| VP16·22·25·28 | runtime channel 활동→snapshot→store 복원→Composer/Transcript, 실제 post-turn·즉시 재개 검사 |
| VP17~20·23·26·29 | 실제 SQLite project 연결/보존·IPC 저장, route/nav/Composer/지침 편집 native |
| VP30 | 기존 viewer 수명·Code·late callback·busy admission/commit·첨부·출력 보관 회귀 |
| VP31 | catalog 전체 수 load/search/pinned/delete native 및 count 단위 검사 |
| VP32~34 | 실제 OS Temp 사본·원본 보존·출력 허용 루트·별도 드라이브·Windows 링크·Work prompt 검사 |

## 구현 중 발견과 대응

1. 일반 파일을 메시지 parts와 영속 목록이 모두 제공하는 경우 카드가 중복될 수 있었다. 기존 메시지 publication ID 집합을 제외하도록 수정하고 실제 카드 수와 store 회귀로 확인했다.
2. 직접 프로젝트 URL을 열 때 catalog 로드 전에 Desktop의 Composer가 노출될 수 있었다. 프로젝트 확인 전에는 로딩/실패·재시도만 보이고 확인 뒤 해당 cwd의 Composer를 제공한다.
3. fork/handoff는 실행 worktree cwd를 갖고 있어 신규 경로 binding을 그대로 적용하면 원래 프로젝트와 지침을 잃었다. 일반 신규 시작만 binding하고 continuity 관계는 그대로 계승한다. 실제 send의 fork/handoff 회귀로 잠갔다.
4. 비활성 대화의 최초 세션 확정은 활성 projectId 구독만으로 nav를 갱신하지 못했다. 기존 recentsEpoch 경로에서도 프로젝트 목록을 갱신하며 세션 전환 없이 이벤트를 반영한다.
5. 확대 시 콘텐츠 높이 변화가 기존 scrollTop을 줄일 수 있어 공통 pane이 일반 상태의 좌표를 보존하고 복원한다. 실제 native 스크롤과 다열 가로 스크롤로 확인했다.

남은 관측 한계: 경로 프로젝트 생성과 SDK 세션 시작은 서로 다른 시스템에 기록된다. SDK 시작이 실패하면 대화가 없는 경로 프로젝트가 남을 수 있으며, 기존 프로젝트/지침을 삭제하는 롤백은 하지 않는다. 기존 자동 응답의 동시 작업 수 표시는 `countsAsActive=false`인 listen child와 자기 응답 차감 사이에 근사값 차이가 있을 수 있다. 이번 ready 대기의 스피너·입력 계약을 막는 문제는 아니며 별도 후속 검토 대상으로 남긴다.

## 검증 기록

실행 환경은 Windows이며 설치된 Electron SQLite ABI를 유지했다. DB 검사는 `ELECTRON_RUN_AS_NODE=1`의 Electron 실행 파일로, 비DB 검사는 기존 Vitest로 실행했다. 새 의존성 설치·ABI 재빌드는 없다. Native는 실제 production React/store/공통 UI를 번들하고 IPC 응답을 fixture로 제공한다. 실제 DB·IPC handler 동작은 별도 SQLite 검사로 확인했으며 외부 Claude 세션을 실행한 것으로 주장하지 않는다.

- 일반 출력·카드: 최종 5파일 21테스트 통과(`OrdinaryOutputCards`, `ArtifactCard.render`, `ArtifactCards.lifecycle`, `artifactOperationIssues`, `chatStore.artifacts`). 첨부 사본/원본 보존과 출력 store를 함께 실행한 2파일 14테스트도 통과했다. 두 실행의 중복 결과는 합산하지 않는다.
- Temp·보관: `service`, `work-profile.integration`, `temp-directory`, `claude-output-files`, `profiles` 검사가 통과했다. 함께 실행했던 새 첨부 검사는 storage 옵션을 생략한 fixture 문제 1건을 수정하고 `attachments` 12테스트를 다시 통과시켰다.
- 활동: `session-runtime`, `session-activity-projector`, `post-turn.schedules`, `send.busy`, `chatStore.listen`, `chatStore.schedules`, `Composer.activity` 7파일 122테스트 통과. 후속 post-turn·Composer·ChatTile·sendAdmission 관련 5파일 45테스트는 일부 중복과 추가 회귀를 포함하므로 합산하지 않는다.

최종 패널·프로젝트 native, 집중 검사 및 운영 gate 결과는 증거 저장 후 이 절에 확정한다.

## Review Signals

사용자 요구 변경에 따른 r2 Delta 구현이다. 등록 mutation 0, 인용 mutation 0, 새 구조적 proxy oracle 0이므로 별도 결함 주입은 선택하지 않았다. 직접 행동·실파일·DB·native 관측으로 확인했다. 구현 중 발견한 중복·경로/연속성·catalog 전이 문제는 동일 라운드에서 회귀를 추가했다. 기존 독립 verify 대기 상태를 자체 PASS로 바꾸지 않는다.
