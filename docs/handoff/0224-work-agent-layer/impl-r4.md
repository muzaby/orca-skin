# [구현자 기입] 구현 보고 r4 — Work Composer와 패널 탐색

작성: **Codex**, 2026-09-09. 기준은 [ΔV4](panel-plan-r4.md)와 대체되지 않은 V1·ΔV2·ΔV3이다. D-032 최종 스타일 인수를 포함한 AC 8/8 자기확인을 완료했다. 상태는 impl/IMPL_DONE이며 독립 verify는 pending이다.

## 1. 설계 대조

Work의 Git 스택을 mount 경계에서 제거하고 같은 Composer의 입력·첨부·폴더 상태를 유지한다. Work 권한은 수동 승인·자동 승인·모든 승인 건너뛰기 순으로 제공한다. Coding 메뉴는 보존하며 자동 승인 조건만 공통 정책으로 적용한다. 명시된 Claude 버전 >4.5만 지원하며 날짜 접미사·커스텀 이름·버전 불명을 최신 Claude로 추정하지 않는다.

기존 공유 권한 함수·세션 reducer·Main 조립부를 연결했다. 계획 승인 목표는 Main이 계산한 값만 adapter에 전달한다. 새 router·패널 플랫폼·DB migration·패키지는 없다. 랜딩 토글이 Hero를 함께 소유하고, Context는 기존 파일 열기 IPC의 directory 요청에 세션 범위를 추가한다. Work 작업 상세는 같은 타일 안에서 화면을 바꾸고 숨긴 목록의 수명을 보존한다.

사용자는 handoff-review를 사용하지 말라고 명시했다. 지침 자체를 바꾸지 않았고 일반 사용자 결정 추적과 구현 절차만 수행했다.

## 2. 강제 지점 전수와 V-pair 자기확인

분모는 ΔV4 §10의 논리 검사 단위이며 함수 총계가 아니다. 변경한 지점과 그대로 보존한 소비 경계를 함께 대조했다.

| EP | 전수 | 실제 경계 |
|---|---:|---|
| EP1 | 6/6 | Composer gitRow, GitRow, useGitSnapshot, NewChatLandingPage, ProjectLandingPage, ChatTile의 같은 Composer 경로. 랜딩 CwdPanel의 기존 브랜치 조회는 별도 범위다. |
| EP2 | 17/17 | 모델 판별, 종류/모델 정착, 승인 목표, 메뉴/칩, 초기·로드, 사용자 선택 전이, 실제 적용 이벤트, store 발신, request/settlement 순서, renderer 계획 승인, Main 실제 send, 세션 확인 통지, coordinator 직렬화/수명, runtime raw 채널, Main 계획 승인, adapter 승인, listen/flush 후속. |
| EP3 | 6/6 | AgentModeToggle, agentPresentation, NewChatLandingPage, ProjectLandingPage, ko, en. |
| EP4 | 10/10 | Context 버튼, fileApi, preload, IPC 타입/schema, Main handler 등록, Work DB 목록 일치, 실제 디렉터리 검사, await 후 재확인, OS 열기/오류, renderer pending·재시도·늦은 응답. |
| EP5 | 12/12 | 작업 파생·선택, overview/detail 형제, 뒤로가기, 대상 소멸, 완료 ack, 초점/스크롤, 행/질문 분리, 기존 상세 재사용, 섹션·출력·Context 수명, reducer 선택/로드, 캐시·Content key, 케밥·확대 chrome. |
| EP6 | 8/8 | plan 메타, r3 대체 표기, r4 메타, INDEX, 본 보고, IPC 계약, 현재 아키텍처, 구현 trailer. |

증거는 [전체 채팅/페이지 회귀](evidence/r4-renderer-tests.json), [권한 경계](evidence/r4-permission-tests.json), [Context Main](evidence/r4-context-tests.json), [Context 표시](evidence/r4-context-renderer-tests.json), [기존 Main 범위 회귀](evidence/r4-main-regression-tests.json), [상세 직접 검사](evidence/r4-detail-tests.json), [랜딩 직접 검사](evidence/r4-landing-tests.json)에 보존한다. 최종 집계는 같은 파일·테스트 이름을 중복 합산하지 않는다.

| Pair | 자기 상태 | 직접 확인 대상 |
|---|---|---|
| VP-R4-01 | SELF_PASS | 실제 Composer의 Work GitRow 부재/Coding 대조, 메뉴 순서·모델 필터·실제 선택값. |
| VP-R4-02 | SELF_PASS | 토글/Hero 순서·파랑, Context 클릭/OS 포트, 전체 상세·복귀. |
| VP-R4-03 | SELF_PASS | shared→reducer/store→Main send/live/controller→SDK 승인·listen/flush 실제 전달값. |
| VP-R4-04 | SELF_PASS | Context 실패/재시도/다른 세션, 상세 수명/삭제/cache, 요청 성공·실패 역순. |
| VP-R4-05 | SELF_PASS | 한 공유 정책을 쓰는 양 계층, Work Git mount 경계, raw SDK 교체 중 늦은 setter. |
| VP-R4-06 | SELF_PASS | 요청 타입/schema/preload/API→실제 Main·임시 SQLite·디렉터리·OS 포트. |
| VP-R4-07 | SELF_PASS | 4.5 경계·날짜/1m·custom/unknown, Work 메뉴/칩·승인 목표. |
| VP-R4-08 | SELF_PASS | 실제 Toggle 순서 oracle와 선택 swap, 실제 TaskTileContent·Context DOM. |
| VP-R4-09 | SELF_PASS | Coding 계획 네 조합·회전, Work 타일 켜기/끄기·입력/추가 폴더 범위. |
| VP-R4-10 | SELF_PASS | 질문/초안·첨부, 게시 파일 수명, 폴더 저장/reload/다음 요청, 계획 댓글·승인. |

VP-R4-01~10은 자기확인 SELF_PASS다. [실제 Chromium 인수](evidence/r4-native-ui.json)는 105개 상호작용·배치 검사와 reduced-motion 검사를 통과했고 화면 14개를 보존했다. 실제 프로덕션 컴포넌트/CSS·store와 테스트 preload/IPC→Main handler→임시 SQLite를 사용한다. SDK와 OS 열기는 주입 포트이므로 외부 모델/Explorer 실사용 성공 증거로 세지 않는다.

## 3. 이번 라운드 수정의 잠금

[랜딩 사전 RED](evidence/r4-landing-red.json)에서 정확한 새 문구/순서 부재를 확인했다. 선택한 적대 증거는 실제 AgentModeToggle의 controls/Hero 형제 슬롯 교환 1건이다. [교환 결과](evidence/r4-landing-slot-mutant.json)는 순서 단언 실패, 원본 바이트 복원 후 [재검사](evidence/r4-landing-slot-restored.json)는 통과했다. [재현 스크립트](fixtures/panel-r4-landing-mutation.mjs)와 [복원 기록](evidence/r4-landing-mutation.json)을 보존한다.

[Context RED](evidence/r4-context-red.json)는 실제 SQLite handler의 허용 목록과 scoped 요청 경계를, [상세 RED](evidence/r4-detail-red.json)는 실제 TaskTileContent의 전체 상세 표시를, [권한 RED](evidence/r4-permission-red.json)는 기존 자동 승인 정책의 경계를 대상으로 한다. mock 메뉴에 요구 문구만 적어 통과시키지 않는다.

## 4. Product/UX 파생 검토

[구현자 기입] 상세가 overview를 숨기는 동안 기존 완료 ack effect가 보이지 않은 작업을 읽음 처리했다. 유효한 선택이 없어 목록이 보일 때만 ack하도록 제한하고 상세 유지/복귀 시점을 직접 검사했다. 뒤로가기에는 이전 행 초점을, 작업이 삭제되면 목록 초점을 복원한다. 구역 접힘·출력 더보기·폴더 picker가 상세 진입으로 사라지지 않는다.

[구현자 기입] SDK 권한 변경 실패 뒤 선택 모델 기준으로 이전 모드를 정착시키면 실제 SDK 적용값과 같다고 오해할 수 있다. 실패 칩과 Notice를 표시하고 재선택하도록 연결했다. 다음 요청값은 정책상 유효하게 유지한다. 위험 모드의 기존 확인은 유지한다.

Context 폴더가 없어도 항목은 남고 오류를 표시한다. 새 파일 뷰어나 실제 참조 추적을 추가하지 않는다. 기존 Work add-dir의 idle 저장·다음 요청 적용과 Coding cwd/reveal 열기를 보존한다.

## 5. 발견한 잠재 문제와 대응

- Main이 확정한 권한을 다음 선택 모델로 다시 정착시키거나 무관한 cwd patch로 덮는 문제를 막았다. 사용자 선택과 실제 적용값 action을 구분하고 권한 필드가 없는 patch는 기존값을 보존한다. request/settlement 메타를 한 Map에 두어 최신 요청 성공은 수용하고 Main 확정 뒤 구실패 rollback만 억제한다.
- 같은 세션에서 권한 응답이 역전되면 renderer는 구응답을 버리지만 Main/SDK가 구모드로 남을 수 있었다. Main의 변경을 세션별로 직렬화하고 비동기 적용 후 대상 수명을 확인한다.
- 기존 openPath schema는 sessionId를 제거할 수 있어 scoped 요청이 일반 cwd/reveal 허용으로 흘렀다. directory에만 sessionId를 허용하고 scoped 요청은 해당 Work 저장 목록을 만족해야 한다.
- Work 랜딩 CwdPanel의 브랜치/워크트리 선택은 이번 Git 스택 제거와 별개다. 조회 0 증거는 GitRow를 소유한 대화 Composer 경계에서 비교하며 전체 앱의 Git 조회 중단으로 확대해 주장하지 않는다.

- 최초 native의 랜딩 wrapper에 flex-1이 없어 실제 앱보다 좁게 렌더됐다. [첫 실행 기록](evidence/r4-native-fixture-initial.json)을 별도로 남기고 테스트 호스트만 수정했다. 최종 인수는 호스트 전체 폭과 Hero 중앙 좌표까지 직접 검사하며 production 코드 변경으로 시험을 맞추지 않았다.
- 전체 회귀의 최초 실패는 새 Git 검사에서 textarea를 contenteditable로 잘못 가정한 1건이었다. 실제 입력 요소로 oracle을 정정한 뒤 전수 재검사했다. 테스트 fixture 반환 타입 오류와 형식 경고도 최종 타입/린트에서 해소했다.

- 마지막 사용자 피드백 D-032는 AgentModeToggle의 표현만 변경했다. SVG 36px·꺾쇠 28px·슬래시/Hero 32px bold로 확대하고 회색 바탕/외곽선을 제거했다. 기존 입력·선택·권한 구현은 유지하며 랜딩 직접 검사·web 타입·변경 파일 린트·빌드·Chromium 인수를 갱신했다.

## 6. 구현 보고

| AC | 결과 | 직접 관측 |
|---|---|---|
| AC-R4-1 | ✅ | Work 대화 Composer의 Git 스택/조회 부재, Coding 대조와 동일 입력/첨부 보존. |
| AC-R4-2 | ✅ | Work 메뉴 순서·정확 라벨·수동 실제값, bypass 2단계 확인, Coding 기존 메뉴. |
| AC-R4-3 | ✅ | Claude 4.5 경계·날짜/1m·custom/unknown, renderer와 Main의 같은 정책. |
| AC-R4-4 | ✅ | 선택·로드·send·live·승인·후속 값 일치, 요청/확정 응답 역순과 실패·수명 보호. |
| AC-R4-5 | ✅ | 두 랜딩의 전체 호스트 폭·중앙 토글·파랑·Hero 아래 배치·입력/첨부/잠금. 꺾쇠 28px·SVG 36px·슬래시/Hero 32px/700·투명 바탕/테두리 0을 실측. |
| AC-R4-6 | ✅ | 실제 저장 폴더의 클릭·Enter/Space, 실패/재시도·중복 호출 차단·다른 세션 응답 격리. |
| AC-R4-7 | ✅ | 전체 상세·뒤로가기·삭제 복귀·키보드 초점, 숨긴 목록/출력/picker 상태와 캐시 수명. |
| AC-R4-8 | ✅ | Coding 계획·Work 케밥·출력·질문·입력·폴더 범위 회귀, 의존성/DB migration 불변. |

검산: ✅ 8 + ⚠️ 0 + ❌ 0 = 8. Criteria-Met은 ΔV4 8/8 자기확인이며 과거 모델 실행을 이번 검사에 합산하지 않는다.

| Gate | 결과 |
|---|---|
| Vitest | 전체 채팅/페이지 153파일 1,173개, 권한 14파일 197개, Context Main 4파일 36개, 기존 Main 8파일 78개 통과. 같은 파일·이름 중복 제외 **173파일 1,423개 통과**, 실패/skip 0. |
| 타입 | node/web/test 모두 exit 0. |
| 린트 | 전체 src/scripts exit 0, 오류 0·기존 useTranscriptVirtualizer 경고 1. |
| 프로덕션 빌드 | electron-vite build exit 0. 기존 SubAgentTileContent 혼합 import 경고 유지. |
| Windows Chromium | success=true/errors=[], 105개 상호작용·배치 검사와 reduced-motion, 화면 14개. |
| 최종 스타일 재검사 | 랜딩/문구 3파일 14개·web 타입·변경 파일 린트·프로덕션 빌드·Windows Chromium 통과. 위 전체 회귀는 기능 구현 완료 시 실행했으며 이후 표현만 변경했다. |
| 문서/저장소 | inventory/prose/links·diff 확인. plan/INDEX/보고 작성자 Codex·impl/IMPL_DONE·독립 검증 pending과 구현 trailer를 일치시킨다. |

[집계](evidence/r4-gates.json), [중복 제거 규칙](evidence/r4-test-summary.json), [빌드 로그](evidence/r4-build.log), [Main native 소스 해시](evidence/r4-directory-native-manifest.json)를 보존한다. 직접 확인한 화면은 [새 랜딩](evidence/r4-new-landing.png), [프로젝트 랜딩](evidence/r4-project-landing.png), [Work 권한](evidence/r4-work-menu.png), [전체 상세](evidence/r4-work-detail.png), [Context 오류](evidence/r4-work-context-error.png)다.

## 7. 후속 확인 신호

이번 라운드는 사용자 피드백 보완이다. 일반 코드 점검과 자기확인은 독립 verify를 대체하지 않는다. 다음 주체는 Claude 독립 verify다. 실제 모델 호출과 OS Explorer 실행을 새로 수행한 것으로 세지 않으며 테스트 자원은 임시 DB·디렉터리와 주입된 OS 포트다.
