# [구현자 기입] 구현 보고 r3 — 콘텐츠별 패널과 Work 작업 목록

작성: **Codex**, 2026-09-09. 기준은 [ΔV3](panel-plan-r3.md), 대체되지 않은 [ΔV2](panel-plan.md)와 [V1](plan.md)이다. ΔV3 AC **8/8 자기확인**, 독립 verify는 pending이다.

## 1. 설계 리뷰

Coding은 존재하는 계획·작업만 표시하고 모두 없으면 단일 빈 상태를 표시한다. Work 랜딩에는 패널이 없으며 첫 전송/최초 로드 후 작업 타일을 기본으로 연다. 이후 케밥 선택은 세션 캐시에서 유지한다. 작업 데이터가 있으면 참조 이미지의 세로 목록으로 표시하고 질문 버튼으로 입력에 작업 인용을 추가한다.

기존 타일 필터·reducer·작업 파생 hook·입력 controller를 수정했다. 새 패널 계층·의존성·IPC·DB migration은 없다. 작업 배열은 부모에서 한 번 파생해 Coding 하단에 전달한다. 추가한 composerDraft 모듈은 기존 복원 신호의 타입과 단조 순번만 소유한다.

명시 cwd 선택이 성공 응답에도 목록에 남지 않는 원인은 Main과 draft의 cwd 중복 제외였다. Work에서는 직접 고른 cwd도 extraDirs에 남긴다. cwd 자체나 권한 정책을 바꾸지 않는다. 유휴 추가·canonical 검증·DB 정본·다음 요청 범위 적용은 유지한다.

## 2. 강제 지점 전수와 V-pair 자기확인

분모는 아래 열거한 책임 지점이다. 경로 정본은 ΔV3 §10이며 검색은 `rightPanelColumnsForAgent|activateTile|removeTile|agentPanelInitialized`, `ADD_EXTRA_DIR|SYNC_SESSION_EXTRA_DIRS|addSessionDirectory`, `draftRestore|restoredDraft|ComposerDraftUpdate`로 수행했다.

| EP | 전수 | 관측한 지점 |
|---|---:|---|
| EP1 | 5/5 | PlanTileContent presence, 계획 본문 ref, TaskProgressContent/empty, TaskStatusIcon, 슬롯 순서 시험. 빈 형제 숨김·승인 오류·선택 범위·하단 상세를 확인했다. |
| EP2 | 14/14 | 표시 필터, SET_AGENT_KIND, BEGIN_TURN, LOAD_SESSION, toggle/set/remove action, plan_review, OPEN_TASK, OPEN_SUBAGENT_TASK, SELECT_DIFF_REQUIREMENT, activateTile, removeTile, store reveal. 닫힘 보존과 허용 Coding 대조를 확인했다. |
| EP3 | 6/6 | 새 대화/프로젝트 랜딩, ChatTitleBar, RightPanel, 타일 chrome, 완료 배지. 실제 페이지에서 패널 부재와 메뉴의 Work task 한 항목을 확인했다. |
| EP4 | 6/6 | WorkTaskProgress, TaskTileContent, 출력, Context, 작업 상세, 질문 버튼. 실제 TaskCreate/Update 파생과 7상태·제목·번호·완료 취소선을 확인했다. |
| EP5 | 6/6 | Main canonical/duplicate/busy 재확인, DB 저장/load, draft ADD_EXTRA_DIR, store 응답, picker, Context. 명시 cwd와 신규 폴더·중복·실패·세션 경계를 확인했다. |
| EP6 | 5/5 | 질문 producer, 신호 target/seq, ChatTile, Composer, InputController append/restore/focus. 초안·첨부·취소 복원·IME·승인 중 보류·stale target을 확인했다. |
| EP7 | 6/6 | plan 메타, r2 대체 표기, r3 문서, INDEX, 본 보고, 구현 trailer. 작성자 Codex·impl/IMPL_DONE·다음 Claude·독립 검증 pending을 맞춘다. |

증거 묶음:

- **R**: [채팅/페이지 회귀](evidence/r3-renderer-tests.json), 147파일 1,134개 통과. 게시·입력·작업·계획·diff·서브에이전트 회귀 포함.
- **L**: [추가 랜딩 시험](evidence/r3-landing-tests.json), 1파일 7개 통과. 실제 두 페이지 조립과 첫 메시지 후 ChatTile 전환을 검사한다. feature 경계의 Composer 등은 stub이다.
- **M**: [Main/SQLite](evidence/r3-directory-tests.json), 8파일 78개 통과. handler 실제 SQLite·history·turn/runtime·respawn·SDK 폴더 옵션·workspace 경계를 포함한다. SDK 호출 자체는 mock이다.
- **U**: [Chromium 인수](evidence/r3-native-ui.json), 상호작용 44개와 화면 10개 통과. 실제 페이지·패널·입력 controller·store·production CSS를 사용한다. 도구/출력 데이터는 합성이다. 기존 picker 실패 시험은 mock, 마지막 폴더 추가 구간은 테스트 preload/IPC→실제 Main handler→SQLite→Context/reload다. 질문의 ChatTile→Composer 전달은 R에서, 입력·첨부·포커스는 실제 controller를 붙인 U에서 확인했다.
- **D**: [Coding 직접 시험](evidence/r3-plan-tests.json), 22개 통과와 [선택 슬롯 교환](evidence/r3-plan-slot-mutant.json), 3개 단언 실패 후 복원. R에 같은 시험이 포함되므로 중복 합산하지 않는다.

| Pair | 자기 상태 | 직접 증거 |
|---|---|---|
| VP-R3-01 | SELF_PASS | R/D 네 조합·오류·상태, U 콘텐츠별 화면과 실제 회전 애니메이션·reduced-motion 중지. |
| VP-R3-02 | SELF_PASS | L/U 랜딩 부재, R 최초 시작/로드, U 케밥 끄기·켜기·세로 목록. |
| VP-R3-03 | SELF_PASS | U 실제 cwd/새 폴더 저장·칩·reload, 질문 추가·동일 첨부·포커스·send 0. |
| VP-R3-04 | SELF_PASS | R session 캐시·첫 로드·다음 턴·stale target, U 닫은 뒤 BEGIN_TURN에서도 닫힘. |
| VP-R3-05 | SELF_PASS | R 직접 진입·오염 columns 필터, L 실제 페이지 조립, U 메뉴·작업·상세 상태. |
| VP-R3-06 | SELF_PASS | M DB/로드, R draft 및 신호 target/mode 전달, U 실제 입력과 Main 저장 연결. |
| VP-R3-07 | SELF_PASS | R/D presence/status/필터·추가/교체·IME·단조 seq, 선택 swap 검출. |
| VP-R3-08 | SELF_PASS | M cwd/alias/중복·busy·루트·최신 DB 재확인, R draft identity와 응답 순서. |
| VP-R3-09 | SELF_PASS | M 기존 DB 우선 resume·runtime 재준비·SDK/호스트 범위, R Coding diff/subagent와 권한 동작. |
| VP-R3-10 | SELF_PASS | R 게시 부재/삭제/저장·입력/취소/첨부·계획 회귀, U 계획 복사/댓글 범위·승인·하위 대화·동일 첨부 DOM. |

## 3. 이번 라운드 수정의 잠금

선택한 적대 증거는 계획/작업 형제 슬롯 swap **1건**이다. 실제 PlanTileContent를 교환하면 순서·승인 오류 위/작업 아래·상세 하단 단언 3개가 실패했다. 원본 복원 뒤 D 22개 및 R이 통과했다. 별도 인용 변이 0, 새 구조 proxy 0이다.

새 요구의 RED는 [Coding](evidence/r3-plan-red.json), [표시 정책](evidence/r3-policy-red.json), [Main cwd](evidence/r3-directory-red.json)에 보존했다. Main cwd 최초/alias 선택 2개는 수정 전 성공 응답의 빈 목록 때문에 실패했다. 나머지 검사는 직접 DOM·action·IPC 결과다.

## 4. Product/UX 파생 검토

계획 본문이 없는 승인 요청은 오류로 남겨 단순 빈 상태와 구분한다. 작업이 사라져도 열린 계획 타일에서 완료 알림 확인이 유지되도록 effect를 상위로 옮겼다. Work에서 다른 타일을 여는 이벤트는 닫은 작업 패널을 복구하지 않는다. 명시 작업 열기는 사용자 진입이므로 허용한다.

질문은 기존 텍스트 뒤에 작업 인용을 추가하며 첨부는 기존 controller 인스턴스가 유지한다. 입력이 승인 화면에 가려진 동안 신호를 소비하지 않는다. 새 세션별 초안 저장소나 자동 전송은 추가하지 않았다.

직접 확인한 화면: [Work 목록](evidence/r3-work-full.png), [빈 Work](evidence/r3-work-empty.png), [어두운 테마](evidence/r3-work-dark.png), [작업만](evidence/r3-coding-tasks-only.png), [계획만](evidence/r3-coding-plan-only.png), [단일 빈 상태](evidence/r3-coding-empty.png). 기존 시맨틱 토큰과 Button/Icon·패널 폭/접기를 사용한다. 좁은 창과 두 랜딩도 U에 보존했다.

## 5. 놓친 잠재 문제 + 대응

- r2 native의 폴더 추가 stub은 선택값을 무조건 목록에 넣어서 실제 Main cwd no-op을 놓쳤다. 이번에는 실제 SQLite handler와 native IPC 연결을 추가했다. 일반 실패/취소 UI의 mock 구간과 구분한다.
- r2 보고의 “SYNC_SESSION_EXTRA_DIRS canonical identity 병합”은 과장이다. 실제로는 문자열 Set 합집합이며 이번에도 그대로다. Main은 기존 alias를 보존하면서 identity로 중복을 막고, Work draft는 대소문자/구분자 identity를 비교한다. renderer가 realpath/junction을 해소한다고 주장하지 않는다.
- native의 첫 첨부 검사는 파일명이 본문에 표시된다고 잘못 가정했다. 실제 AttachmentThumb의 title/제거 접근성 이름·MD 표시로 수정하고, 질문 전후 동일 첨부 DOM과 1개 유지까지 확인했다. [실패 기록](evidence/r3-native-fixture-red.json)은 남겼으며 production 변경으로 시험을 맞추지 않았다.
- test fixture의 Message.createdAt 누락은 타입 검사에서 수정했다. 최종 web/node/test 검사는 모두 통과했다. swap 복원 때 일시 Windows 파일 쓰기 실패가 있었으나 바로 복원·재읽기·GREEN 후 빌드했다.

## 6. 구현 보고

| AC | 결과 | 관측 |
|---|---|---|
| AC-R3-1 | ✅ | Coding 네 조합·단일 빈 상태·승인 오류. |
| AC-R3-2 | ✅ | 실제 실행 중 회전, motion 감소 시 animationName none, 완료/대기 유지. |
| AC-R3-3 | ✅ | 두 Work 랜딩 패널 없음, 첫 전송/최초 로드 기본 작업 표시. |
| AC-R3-4 | ✅ | Work 메뉴 task만, 활성/비활성·닫힘 유지·직접 열기. |
| AC-R3-5 | ✅ | 세로 번호/상태/제목·완료 취소선·빈 그림과 실제 목록 전환. |
| AC-R3-6 | ✅ | 명시 cwd/신규 폴더→실제 DB→칩→reload, 반복 선택 1개. |
| AC-R3-7 | ✅ | 기존 입력 뒤 인용·포커스·첨부 DOM 보존·자동 전송 없음. |
| AC-R3-8 | ✅ | 기존 게시/계획/작업/입력/범위·Coding UI 회귀 통과, 의존성 불변. |

검산: ✅ 8 + ⚠️ 0 + ❌ 0 = 8. Criteria-Met은 ΔV3 **8/8 자기확인**이며 V1·r2 전체 재인수로 합산하지 않는다.

| Gate | 결과 |
|---|---|
| Vitest | R 1,134 + L 7 + M 78 = **1,219 통과**, 실패/skip 0. focused GREEN·선택 변이는 중복 합산하지 않는다. |
| typecheck | node/web/test 모두 exit 0. 최종 테스트 fixture 정정 후 web 재실행 통과. |
| lint | 전체 src/scripts 오류 0·기존 useTranscriptVirtualizer 경고 1. |
| build | electron-vite build exit 0. 기존 SubAgentTileContent 정적/동적 import 혼합 경고를 유지한다. |
| native | success=true·errors=[]·상호작용 44개·화면 10개. motion/reduced-motion 별도 직접 관측. |
| DB 환경 | 설치된 Electron ABI 유지. Main assertion 78개 통과 뒤 worker 종료 지연 경고 4개는 assertion 실패와 구분한다. |
| 문서/저장소 | current rendering/state 갱신, inventory/prose/link·diff 검사, 구현 trailer 파싱. |

명령 요약은 [r3-gates.json](evidence/r3-gates.json), [빌드 원문](evidence/r3-build.log), [Main native 소스 해시](evidence/r3-directory-native-manifest.json)에 보존한다. native fixture는 사용자 DB·파일이나 외부 모델에 접근하지 않는다.

## 7. Review Signals

현재 라운드는 사용자 결정 변경에 따른 구현이며 이전 r2의 상시 표시·정적 진행·빈 형제 영역 oracle은 ΔV3이 대체한다. 실제 수정한 결함은 명시 cwd의 성공/no-op 불일치다. 재현·저장·표시를 같은 경로로 확인했다.

다음 주체는 Claude 독립 verify다. 실제 참조 수집·일반 생성물 자동 감지·뷰어·SRT·OpenCode는 후속이며 이번 완료 범위에 포함하지 않는다. r1 모델 실행 증거를 이번 실행으로 세지 않았다.
