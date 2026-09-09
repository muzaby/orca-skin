# Plan r5 — 패널 밀도와 세션 완료 표시

작성: **Codex**, 2026-09-09. 상태: **impl/IMPL_DONE — Codex 자기확인 8/8, 독립 verify pending**. 기준은 원격 r4 구현 `eb7e0db9`의 V1 + ΔV2 + ΔV3 + [ΔV4](panel-plan-r4.md)이며, 이번 사용자 피드백을 **ΔV5**로 적용한다. 사용자의 지시에 따라 handoff-review를 사용하지 않고 plan/impl 추적만 수행했다. 구현과 Windows 인수는 [구현 보고 r5](impl-r5.md)에 기록한다.

# Part I — Product & UX Contract

## 1. 목표와 범위

랜딩의 장식을 줄이고 Work에서 불필요한 Git 제어와 패널 버튼을 숨긴다. Work는 내용만큼 작은 패널로 표시하고 Coding 작업 목록은 같은 테마와 전체 상세 전환을 사용한다. 채팅 목록은 모드 아이콘으로 종류와 아직 확인하지 않은 완료를 구분한다.

사용자 조건은 “단 해당 세션이 안열려있을때를 전제함”, “각 영역에서 여백 운영하지 말것”, “아무것도 없으면 패널의 랜딩페이지에서도 여백을 없애 작업패널의 높이를 줄이라”, “코딩의 우측 패널은 현재 상태 유지”다. 마지막 조건은 Coding의 높이 정책이며, 별도로 명시한 작업 목록 테마·전체 상세 전환은 변경한다.

## 2. Decision Ledger

| ID | ACTIVE 결정 | 출처·대체 관계 |
|---|---|---|
| D-033 | 모드 토글의 tooltip을 삭제하고 Hero는 normal 두께로 표시한다. 아이콘·문구 크기, 파란 선택색, Hero 아래 배치, 접근성 이름·잠금은 유지한다. | 사용자 1. D-032의 Hero bold만 대체 |
| D-034 | Work CwdPanel은 BranchChip/WorktreeToggle을 렌더링하지 않는다. Coding에서 다시 표시하며 폴더 추가는 기존 flex 순서에서 빈자리 없이 당겨진다. | 사용자 2. r4 랜딩 Git 표시 예외를 대체 |
| D-035 | Work 타일의 우상단 확대 버튼과 출력 목록의 모두 저장을 제거한다. 케밥 활성/비활성, 개별 파일 동작, 트랜스크립트 모두 저장, Coding 계획의 복사/확대/닫기는 유지한다. | 사용자 3. Work 확대 유지 결정만 대체 |
| D-036 | Coding/Work는 같은 작업 행·배지·상태·제목 CSS를 사용한다. 클릭은 해당 패널 전체 상세로 전환하며 뒤로가기·삭제 복귀·캐시·초점을 유지한다. Coding의 기존 blockedBy 정보와 Work 전용 질문 액션은 보존한다. | 사용자 4. Coding 하단 inline 상세 대체 |
| D-037 | 채팅 행의 우측 모드 텍스트를 제거하고 왼쪽은 Google Material Terminal 2 / Checklist SVG를 사용한다. 비열람 세션이 정상 완료되면 아이콘만 selected 파란색으로, 세션을 열면 원래 색으로 복원한다. | 사용자 5. 기존 말풍선/우측 라벨 대체 |
| D-038 | Work 작업·출력·Context 항목 제목은 가용 폭을 넘으면 한 줄 말줄임한다. 전체 제목의 접근성 이름·title 및 상세 내용은 유지한다. | 사용자 6 |
| D-039 | Work 외곽은 내용 높이에 맞춰 줄어든다. 세 영역 각각의 header/padding 포함 최대 높이는 부모가 허용하는 패널 최대 높이의 1/3이며, 남는 공간을 배분하지 않는다. 넘치는 본문은 영역 안에서 스크롤한다. | 사용자 7 |
| D-040 | Work 상세는 세 영역 제한을 적용하지 않고 전체 허용 높이까지 사용한다. Coding 외곽의 현재 높이 정책은 보존한다. | 사용자 4/7의 적용 범위 해석 |

이전 계획 중 위에서 대체하지 않은 권한·게시·폴더 저장/열기·계획 댓글·세션 종류 잠금은 유지한다. SRT·OpenCode·뷰어·참조 추적·새 패키지·DB migration은 범위가 아니다.

**추가 질의 Q-R5-01:** Coding에서 켠 워크트리의 Work 전송 적용도 끌지 사용자에게 물었다. D-034의 UI 변경은 확정이며, 실행 정책 변경은 답변 전 수행하지 않는다. 기존 draft 선택값을 삭제하지 않고 보존한다.

## 3. 상태와 전이

| 시작/행동 | 관측 결과 |
|---|---|
| 새 대화 Work↔Coding | tooltip 없이 같은 입력/첨부 유지, normal Hero, Work Git 그룹 부재와 Coding 복귀 |
| Work 빈/일부/다수 내용 | 짧은 외곽→자연 증가→해당 영역만 최대치와 내부 스크롤. 다른 영역으로 잉여 높이 이전 없음 |
| 양 모드 작업 클릭/Back | overview가 화면·키보드에서 숨고 전체 상세가 표시됨. Back은 목록·문서·섹션 상태와 초점을 복원 |
| 상세 중 새 완료/선택 작업 삭제 | 보이지 않는 목록을 읽음 처리하지 않음. 선택 삭제 시 overview로 복귀 |
| 다른 세션 정상 완료 | 해당 행의 모드 아이콘만 파란색. 현재 열린 세션 완료·중간 메시지·오류/중단은 새 완료 표시를 만들지 않음 |
| 표시된 세션 열기/다른 곳 이동 | 열기에서 확인 처리. 다른 곳으로 이동해도 예전 완료가 다시 켜지지 않음 |
| 목록 재조회/삭제/앱 재시작 | 완료 표시는 재조회에 유지, 삭제 시 정리. 이번 앱 실행 동안의 transient 상태이며 DB 형식은 유지 |

## 4. Acceptance Criteria

| AC | 관측 기준 | 실제 도달 경로·oracle |
|---|---|---|
| AC-R5-1 | 두 랜딩 tooltip 없음·Hero normal, 크기/순서/파랑·동일 입력 보존 | 두 페이지→AgentModeToggle, 실제 DOM·computed style·click |
| AC-R5-2 | Work Git 그룹/조회 부재와 add-dir 빈자리 제거, Coding 표시/선택 보존 | Composer→CwdPanel→BranchChip, 실제 mock IPC 호출·좌표 비교 |
| AC-R5-3 | Work 확대/출력 모두 저장 제거, 케밥/개별 저장·Coding chrome 유지 | RightPanelTile·ArtifactCards 실제 DOM/클릭 |
| AC-R5-4 | 양 모드 동일 작업 테마·진행 애니메이션·전체 depth/Back | 실제 목록 computed style·상태 행렬·두 패널 클릭/키보드 |
| AC-R5-5 | 모든 채팅 목록의 종류 아이콘·완료 파랑·열기 확인·비열람 조건 | 정상 종료 이벤트→완료 표시 상태→SessionRow, 라우트/목록 재조회·삭제 검사 |
| AC-R5-6 | Work 제목이 폭 내 한 줄 ellipsis, 전체 이름/동작 유지 | 작업/출력/폴더 실제 DOM·scrollWidth/clientWidth·title/aria |
| AC-R5-7 | Work 빈 외곽 축소·내용 자연 증가·각 영역 1/3 cap/내부 scroll, Coding 높이 유지 | 실제 RightPanel 부모/카드/section border-box와 창 크기 변경 |
| AC-R5-8 | 상세 전환의 문서·댓글·목록·출력·Context·질문·선택 캐시 수명 보존 | 실제 두 패널 DOM identity/scroll/focus + 기존 store/댓글/게시 회귀 |

# Part II — Technical Design

## 5. 현재 구조와 최소 변경

| 조사 | 현재 관측 | 변경 |
|---|---|---|
| AgentModeToggle / CwdPanel | 두 페이지가 공유. tooltip wrapper와 font-bold가 있고 BranchChip은 종류와 무관하게 mount | tooltip/설명 연결 제거·font-normal. BranchChip 전체 Coding 조건부 생성; CwdButton·추가 폴더·plus 순서 유지 |
| RightPanelColumn / Tile | Work도 전체 flex 높이, absolute 확대 버튼 | 기존 row available height에 CSS size container. Work 카드만 자연 높이/max-height, 확대 chrome 삭제 |
| TaskTileSections / Output | 섹션 수명은 로컬, output 소유자는 구독·pagination 유지 | 세 section의 border-box max-height를 cqh/3, header 고정·body scroll. ArtifactCards list variant의 모두 저장만 제거 |
| WorkTaskProgress / TaskProgressList | 작업 행 CSS·inline/전체 detail 경로가 각각 존재 | 한 작업 행 컴포넌트·numbered badge CSS. in_progress 외곽 spin은 reduced-motion 준수. 질문 port는 Work에서만 제공 |
| TaskTileContent / PlanTileContent | r4 Work만 hidden/inert overview+형제 detail. Coding은 하단만 교체 | 작은 로컬 TaskPanelContent로 선택/Back/삭제/ack/focus 공유. overview를 mounted 유지, PlanDocument ref 범위 유지 |
| SessionRow / sessionsStore | 모드 텍스트·chat icon. 완료 미확인 상태 없음 | 공식 SVG registry 추가, 세션별 transient 표시. 정상 완료 신호와 실제 열람 라우트를 app 경계에서 연결 |

새 범용 router·패널 플랫폼·이벤트 저장소를 만들지 않는다. 작업 제목·번호·상태 파생은 기존 taskBoard가 소유하며 표현과 상세 화면 전환만 공유한다. Work의 section별 scroll owner와 Coding 문서 scroll은 상세 전환 후 복원한다.

### 완료 표시 경계

정상 완료는 기존 `turn.ended`/`turnEndTick` 신호를 사용하고 중간 `message.completed` 또는 무조건적인 busy 종료로 추정하지 않는다. 열람 여부는 `useSessionHandlers`가 계산하는 실제 `/chat/:sessionId`와 draft 상태를 기준으로 하며, 다른 화면에 남아 있는 chatStore.activeKey만으로 판정하지 않는다. app 계층이 chat/sessions를 조립하고 feature 교차 import와 매 delta 전체 세션 스캔을 피한다.

표시 상태는 목록 메타데이터와 분리해 재조회가 지우지 않도록 하고, 삭제/구독 해제/늦은 이벤트를 검사한다. 모드 아이콘은 shared Icon의 새 이름으로 추가해 다른 terminal/todo 사용처의 모양을 바꾸지 않는다. Google 공식 material-design-icons의 terminal_2/checklist SVG 출처·라이선스를 구현 기록에 남긴다.

## 6. ΔV5 nodes / pairs

| Pair | 같은 레벨 노드↔검사 | provenance / requiredness | production path / EP / 직접 oracle |
|---|---|---|---|
| VP-R5-01 | R-R5-01↔AT-R5-01 (AC1/2/3) | CHANGED / REQUIRED | kind→두 랜딩/Composer/chrome, EP1/2, DOM·실제 조회/좌표 |
| VP-R5-02 | R-R5-02↔AT-R5-02 (AC4/6/7) | CHANGED / REQUIRED | 작업/내용→row/전체 detail/section, EP2/3, computed style·border-box |
| VP-R5-03 | R-R5-03↔AT-R5-03 (AC5) | NEW / REQUIRED | 완료→비열람 아이콘→열기, EP4, actual event/route/color |
| VP-R5-04 | SD-R5-01↔ST-R5-01 | CHANGED / REQUIRED | overview→detail→Back/delete/cache, EP3, DOM/scroll/focus/ack |
| VP-R5-05 | SD-R5-02↔ST-R5-02 | NEW / REQUIRED | 완료/현재route/재조회/삭제→미확인 표시, EP4, 이벤트 순서·동일세션/타세션 |
| VP-R5-06 | AR-R5-01↔IT-R5-01 | CHANGED / REQUIRED | 공통row/shell→두 panel, EP2/3, 두 소비처 실제 렌더·수명 |
| VP-R5-07 | AR-R5-02↔IT-R5-02 | NEW / REQUIRED | chat 완료+app 열람→sessions→각 목록, EP4, feature 조립과 실제 행 |
| VP-R5-08 | MD-R5-01↔UT-R5-01 | CHANGED / REQUIRED | kind/작업상태/선택 파생→표현, EP1/3, 경계 행렬·삭제/키보드 |
| VP-R5-09 | MD-R5-02↔UT-R5-02 | NEW / REQUIRED | 완료/확인/삭제 상태 전이, EP4, 중간·오류·활성 대조 |
| VP-R5-10 | ΔV4 VP-R4-01/02/04/08/09/10 | INHERITED / REGRESSION | 영향받은 입력/권한선택/계획댓글/게시/Context/수명, EP1/2/3/4 |

검사는 실제 click·event·style·bounds를 직접 관측한다. 구조 문자열 존재만으로 완료/배치를 판정하지 않으므로 새 mutation은 선택하지 않는다. 과거 토글/Hero 슬롯 순서 단언은 유지하며 fixture의 바뀐 요구(굵기·확대·Git 표시)만 명시적으로 갱신한다.

## 10. 강제 지점과 운영 gate

| EP | N / 전수 대상 | 실패 의미 |
|---|---|---|
| EP1 | 6 — AgentModeToggle, NewChatLandingPage, ProjectLandingPage, CwdPanel kind 경계, BranchChip mount/조회, add-dir flex 배치 | 숨은 tooltip/조회·입력 remount·빈자리 |
| EP2 | 4 — RightPanelColumn available 높이, RightPanelTile Work chrome/외곽, ArtifactCards list 저장, TaskOutputContent 소비 | Coding 높이 변경·Work 확대 잔존·개별/트랜스크립트 저장 유실 |
| EP3 | 10 — 공통 row/status, 제목/blockedBy, Work 질문 port, TileSection cap/scroll, 공유 전체 depth, Back/삭제, focus/각scroll/ack, Output/Context mounted, PlanDocument/댓글 범위, selected/store/cache/kebab/key | 목록 CSS 분기·장문 넘침·blank 공간·댓글/구독/선택 유실 |
| EP4 | 6 — 정상 종료 생산자, app 실제열람 조립, transient 완료/확인, 재조회/삭제 수명, SessionRow 종류/색, recent/pinned/project/draft 소비 | 잘못된 완료/활성 기준·unread 재생·일부 목록 누락 |
| EP5 | 6 — r5 계획, root plan 메타, r4 대체 연결, INDEX, impl-r5와 증거, 현재 rendering/state·commit trailer | 결정/구현 상태 사본 불일치 |

분모는 표에 명시한 논리 경계이며 구현자는 실제 검색으로 각 경계의 모든 소비처를 다시 대조한다. 영향 Vitest·node/web/test 타입·전체 lint·production build·실제 Windows Chromium 인수·inventory/prose/links·diff·trailer 파싱을 수행한다. 설치 Electron SQLite ABI를 유지하며 실제 모델 호출·사용자 DB·외부 Explorer 실행을 인수 증거로 주장하지 않는다.

## 11. READY 대조

D-033→AC1, D-034→AC2, D-035→AC3, D-036→AC4/8, D-037→AC5, D-038→AC6, D-039/040→AC7/8을 대조했으며 충돌은 없다. 최신 조건과 반대인 r4 Hero bold·랜딩 Git 표시·Work 확대·Coding inline 상세·전체 높이만 대체한다. Q-R5-01은 확정한 표시 변경과 분리했으며, 답변 전 실행 정책을 바꾸는 근거로 사용하지 않는다.

후속 사용자 피드백은 [ΔV6](panel-plan-r6.md)가 부분 대체한다. Git 조회/캐시의 최종 정정은 ΔV6가 정본이다.
