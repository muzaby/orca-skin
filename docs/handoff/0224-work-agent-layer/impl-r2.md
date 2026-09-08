# [구현자 기입] 구현 보고 r2 — 모드별 패널과 Work 폴더 추가

작성: **Codex**, 2026-09-08. 기준은 [패널 ΔV2](panel-plan.md)와 대체되지 않은 [V1](plan.md)이다. 이번 자기확인은 ΔV2의 AC 8개이며 r1 전체 재인수나 독립 verify가 아니다.

## 1. 설계 리뷰

Coding은 계획과 작업을 한 타일에 합쳤다. Work는 진행 상황·출력·컨텍스트가 있는 작업 타일을 항상 표시하고 케밥도 작업 항목만 제공한다. 유휴 Work의 폴더 추가는 명시 IPC로 저장하며 다음 실행의 범위에 적용한다.

| 검토 | 구현 판단 |
|---|---|
| 경량화 | 기존 표시 정책에 agentKind 축을 추가했다. 작업 목록·상세·캐시 hook과 디렉터리 picker만 추출했다. 새 패널 프레임워크·패키지·DB migration은 없다. |
| 사용자 정정 | 케밥 유지, 다른 타일 비노출, Work 전체 닫기 제거를 D-013대로 반영했다. 계획 승인·서브에이전트 상세는 대화 안에서 유지한다. |
| 저장 권위 | 폴더 추가는 Work 전용 명령이다. 일반 resume 요청의 extraDirs override는 계속 무시한다. SQLite가 정본이며 성공 응답만 대상 세션에 병합한다. |
| 허용 범위 | canonical 실제 폴더·절대 경로·루트·중복·상한을 검사하고, 비동기 검증 뒤 세션 존재/종류/busy를 다시 읽는다. 실행 중 기존 채널 범위는 바꾸지 않는다. |
| 조사 정정 | §5의 실제 diff 직접 진입은 SELECT_DIFF_REQUIREMENT다. 잘못 적힌 action 이름만 고쳤으며 결정·AC·V-pair·§10 책임은 바꾸지 않았다. |
| 후속 범위 | 실제 참조 리소스 수집·일반 생성물 감지·파일 뷰어·SRT·OpenCode adapter는 이번 변경에 포함하지 않는다. Context 칩은 사용자가 추가한 허용 폴더이다. |

## 2. 강제 지점 전수와 V-pair 자기확인

경로는 app/src 기준이다. 아래 분모는 파일 개수가 아닌 명시 책임 지점이다. 검색 결과의 각 변경 경로를 표에 대조했다.

| EP | 확인 지점 | 직접 관측 |
|---|---:|---|
| EP-R2-1 | 3/3 | rightPanelTiles 정책, ChatTitleBar 메뉴/배지, RightPanel 최종 필터. 실제 메뉴는 Coding 계획/백그라운드/변경사항, Work 작업만 표시. |
| EP-R2-2 | 13/13 | reducer SET_AGENT_KIND/BEGIN_TURN/LOAD_SESSION, toggle/set/remove, plan_review, OPEN_TASK/OPEN_SUBAGENT_TASK/SELECT_DIFF_REQUIREMENT, store reveal, 랜딩 2곳. panelPolicy·agentKind·페이지 회귀의 상태 결과 확인. |
| EP-R2-3 | 5/5 | PlanTileContent 조립, PlanDocument 댓글 ref, TaskProgressList, TaskDetail, TaskStatusIcon. 순서·빈 계획·3상태·하단 상세·본문 선택 범위 시험. U에서 계획 선택 팝오버 표시와 하단 작업 선택 무시를 각각 확인. |
| EP-R2-4 | 6/6 | TaskTileContent, TileSection, TaskOutputContent, TaskContextContent, RightPanel 확장, RightPanelTile chrome. 같은 DOM 유지·폭 복원·접힌 오류·세션 이동 초기화 관측. |
| EP-R2-5 | 4/4 | useDirectoryPicker, CwdPanel, Context, addSessionDirectory store action. 실제 클릭/늦은 picker와 store의 대상 세션·중복 병합 시험. |
| EP-R2-6 | 8/8 | 공유 request/result·schema·channel, preload, renderer API, Main registration, handler, DB write. strict schema·bridge 요청과 실제 SQLite 저장/재로드 확인. |
| EP-R2-7 | 10/10 | busy 최초/await 뒤, DB→turn, respawn inputs/policy, runtime-entry/send/continuation, runtime의 immutable host context, Claude SDK/guard 공통 배열. 준비 lease·listening 거부와 변경된 scope의 재준비 시험. |
| EP-R2-8 | 5/5 | plan 메타, panel-plan 상태, INDEX, 본 보고, 구현 trailer. 최종 상태는 impl/IMPL_DONE·다음 Claude·독립 검증 pending으로 맞춘다. |

검색: `rg -n 'rightPanelTiles:|activateTile|REMOVE_RIGHT_PANEL_TILE|SET_AGENT_KIND|BEGIN_TURN|LOAD_SESSION|OPEN_TASK|OPEN_SUBAGENT_TASK|SELECT_DIFF_REQUIREMENT' app/src/renderer/src/features/chat` 및 `rg -n 'extraDirs|extra_dirs|spawnedExtraDirs|extraDirectoriesChanged|sessionAddDirectory' app/src/main app/src/preload app/src/shared app/src/renderer/src/features/chat app/src/renderer/src/shared/api/ipc.ts`.

증거 묶음:

- **R**: [Renderer 결과](evidence/r2-renderer-tests.json) — 145파일, 1,113 통과. 변경한 chat feature와 페이지 전체, 기존 게시·입력·라우팅·diff·서브에이전트 포함.
- **M**: [Main/SQLite 결과](evidence/r2-main-tests.json) — 10파일, 153 통과. 실제 registration/schema·DB/파일시스템·history·turn/runtime/continuation. SDK 호출의 폴더 옵션은 mock에서 관측한다.
- **S**: [공유 프로토콜 결과](evidence/r2-protocol-tests.json) — 2파일, 80 통과. 신규 추가 명령 검증은 M에 포함한다.
- **U**: [Chromium 인수](evidence/r2-native-ui.json) — production RightPanel/TitleBar/ApprovalCard/작업·출력·Context/도구 상세, store/actions, 테마 CSS. IPC 응답과 게시/도구 입력은 합성이며 사용자 DB·모델에 접근하지 않는다.
- **D**: [계획/작업 시험](evidence/r2-plan-tests.json) 8 통과와 [슬롯 교환 변이](evidence/r2-plan-slot-mutant.json) 5 실패. R에도 복원된 시험이 포함된다.

| Pair | 자기 상태 | 관측 |
|---|---|---|
| VP-R2-01 | SELF_PASS | R/D의 실제 계획/작업 슬롯·상태 결과, U의 Coding 계획 위/작업 아래·하단 상세, 복사 문자열과 댓글 선택에서 작업 영역 제외. |
| VP-R2-02 | SELF_PASS | R의 Work 표시 정책, U의 단일 타일·세 섹션·빈/채운 상태·메뉴·확장/복귀. |
| VP-R2-03 | SELF_PASS | U picker→store→typed API, M 명시 handler→SQLite→load/turn, runtime 재준비 결과. |
| VP-R2-04 | SELF_PASS | R agentKind·랜딩·세션 load 전이, U 세션 이동 시 늦은 picker 폐기와 로컬 섹션 초기화. |
| VP-R2-05 | SELF_PASS | R 우회 action·오염 columns 복원, U 실제 메뉴·Work 계획 승인·하위 대화 펼침. |
| VP-R2-06 | SELF_PASS | M registration strict schema·busy/파일·DB, R typed bridge, 타입 검사 preload/OrcaApi 연결. |
| VP-R2-07 | SELF_PASS | R/D 실제 상태 아이콘·순서·기능 존재/상세와 선택한 슬롯 교환 변이 검출. |
| VP-R2-08 | SELF_PASS | M canonical alias/cwd/동시 요청/준비 lease/listening/실패·재로드, R out-of-order·삭제·다른 세션 응답. |
| VP-R2-09 | SELF_PASS | R 기존 ArtifactCards 수명·삭제·부재·TaskOutput·Composer·계획 회귀, U Work 계획 읽기/승인·하위 원문. |
| VP-R2-10 | SELF_PASS | M/S 기존 resume DB 우선·workspace 경계, R Coding diff/subagent·종류 잠금·입력/첨부·세션 이동. |

## 3. 이번 라운드 수정의 잠금

| 선택 증거 | 주입/관측/복원 |
|---|---|
| VP-R2-01/07 계획·작업 상하 슬롯 교환 | 실제 PlanTileContent의 두 형제 슬롯을 맞바꾸면 새 계획 시험 5개가 실패했다. 원복 후 관련 8개 및 R 전체가 통과했다. 존재 여부만 보는 검사로 대체하지 않았다. |

선택 증거 1 · 인용 변이 0 · 별도 새 구조 proxy 0 = 표 1행. 그 밖은 실제 상태·IPC·DOM의 직접 oracle이며 추가 mutation을 선택하지 않았다. 기존 taskTile0213의 작업 상세 시험은 작업을 소유하게 된 TaskProgressContent로 import만 옮겨 기능 존재·activeForm·blocked 관계 단언을 유지했다.

## 4. Product/UX 파생 검토

| 관측한 문제 | 대응과 관측 |
|---|---|
| Work에서 숨긴 plan/subagent 타일로 보내는 CTA | Work 계획 본문을 승인 카드에 표시하고, AgentTaskRow/SubagentNoticeRow는 기존 상세를 명시 펼침 때 렌더한다. U에서 승인 IPC allow와 하위 본문을 확인했다. Coding의 기존 진입은 유지했다. |
| Context '+'는 접힌 상태에서도 보이지만 오류는 본문에 가려질 수 있음 | 액션 클릭은 섹션을 열고 진행/오류 status는 접힘 밖에 배치했다. 선택 중 다시 접어도 오류가 남는 U 관측으로 확인했다. |
| 세션 사이에 섹션 접힘이 남음 | RightPanel의 Content를 activeKey로 구분한다. 같은 세션의 확장은 DOM을 보존하고 다른 세션은 로컬 상태를 초기화한다. 두 경우를 U에서 각각 관측했다. |
| 사용자가 넓힌 패널에서 확대가 무변경이 될 수 있음 | 기존 폭보다 넓게 계산하고 원래 폭을 보존한다. U에서 기본 폭과 사용자 지정 폭 모두 확대·복귀를 직접 비교한다. |
| Coding 계획 닫기에 옛 작업 선택이 남음 | REMOVE_RIGHT_PANEL_TILE에서 plan도 작업 선택을 해제한다. reducer 회귀 통과. |
| 참조 그림이 실제 완료·읽기 증거로 오해될 수 있음 | 빈 진행 그림은 aria-hidden 장식이다. Context 문구·툴팁은 사용자가 추가한 폴더임을 표시한다. 미지원 뷰어를 약속하는 빈 출력 문구도 수정했다. |

시각 자기확인은 [Coding](evidence/r2-coding-full.png), [빈 Work](evidence/r2-work-empty.png), [채운 Work](evidence/r2-work-full.png), [어두운 테마](evidence/r2-work-dark.png), [좁은 창](evidence/r2-work-narrow.png)에 남겼다. 일러스트는 기존 Icon/CSS와 시맨틱 토큰으로 구현했다. 실제 사용자 산출물 화면이 아니라 합성 인수 화면이다.

## 5. 놓친 잠재 문제 + 대응

- 폴더 검증은 await를 포함한다. Main은 await 뒤 busy·세션을 재확인하고 최신 목록을 읽어 단일 UPDATE로 추가한다. 준비 lease/실행/listening 동안 변경은 거부한다. 파일 경로가 나중에 바뀌는 모든 OS 경쟁을 원자적으로 막는 샌드박스라고 주장하지 않는다.
- 응답 순서가 바뀌면 renderer 목록을 대체하는 방식은 이미 저장한 폴더를 숨긴다. SYNC_SESSION_EXTRA_DIRS는 canonical identity로 추가 병합하고 대상 key를 고정한다. DB 성공 뒤 화면이 사라져도 reload가 복구한다.
- 따뜻한 채널을 그대로 재사용하면 SDK와 host 도구 범위가 낡는다. 생성 시점의 immutable extraDirs를 비교하는 respawn 축을 추가하고 최초/자동 연속 경로에 전달했다.
- InlineSubagentDetail의 dynamic import는 정적 초기화 순환과 접힌 상세의 구독을 피한다. 같은 모듈을 타일도 정적으로 import하므로 별도 bundle 분할 이득을 주장하지 않는다. build가 이 조건을 경고한다.
- 통합 중 발견한 잘못된 Markdown import, 옮긴 registry의 테스트 import, 잘못된 action fixture, CwdPanel mock은 수정하고 전체 R·타입을 재실행했다. 실행 결과를 바꾸려고 행동 단언을 제거하지 않았다.

## 6. 구현 보고

| AC | 결과 | 이번 관측 |
|---|---|---|
| AC-R2-1 | ✅ | Coding 메뉴에 task 없음, task open→plan. R의 허용 diff/subagent/plan와 Work 차단 행동. |
| AC-R2-2 | ✅ | 계획 위/작업 아래, 원·완료 취소선·점선, 빈 계획에서도 작업 표시. D와 U의 상세·계획 본문 범위. |
| AC-R2-3 | ✅ | Work task 상시 한 개·케밥 유지·다른 타일 없음. R 복원/랜딩/우회, U 같은 DOM 확대·복귀. |
| AC-R2-4 | ✅ | 진행/출력/Context 순서, 실제 상태와 장식 분리, empty/populated·dark/narrow 화면과 접기. |
| AC-R2-5 | ✅ | 실제 picker 클릭의 취소/루트/중복/실패/세션 이동/busy, 접힌 오류까지 관측. |
| AC-R2-6 | ✅ | 실제 SQLite 저장·재로드·다음 turn scope·channel 재준비. Coding/busy/준비 중 거부, resume override 차단. |
| AC-R2-7 | ✅ | R 게시 저장·삭제·부재/수명 회귀, U Work 계획 읽기/승인·서브에이전트 원문 접근. |
| AC-R2-8 | ✅ | R 입력·첨부·종류/세션·Coding diff/subagent 회귀. 신규 의존성 없음, 확장 시 같은 콘텐츠 유지. |

검산: ✅ 8 · ⚠️ 0 · ❌ 0 = 총 8. Criteria-Met은 ΔV2 **8/8 자기확인**이며 이전 V1 분모와 합산하지 않는다. 독립 verify는 pending이다.

| 게이트 | 실행 / 관측 |
|---|---|
| lint | npm run lint, 최종 읽기 전용 eslint --cache ./src ./scripts exit 0. 오류 0, 기존 useTranscriptVirtualizer 경고 1. |
| typecheck | npm run typecheck의 node/web/test exit 0, 마지막 renderer 변경 뒤 typecheck:web exit 0. |
| Vitest | M 153 + R 1,113 + S 80 = 1,346 통과, 실패/skip 0. D와 titlebar 별도 재실행은 중복 합산하지 않는다. |
| DB 실행 환경 | 설치된 Electron ABI 그대로 Electron의 Node 모드로 M 실행. 보고서 success=true, 모든 assertion 통과. 두 worker 종료 지연 경고는 assertion 실패와 구분한다. |
| production build | electron-vite build exit 0, main/preload/renderer 생성. 서브에이전트 모듈의 정적/동적 import 중복 경고 존재. |
| UI 인수 | U success=true, errors 비어 있음, 클릭/상태 단언 25개 통과. source 해시·상태/메뉴/폭/세션/picker/승인 관측 보존. 모델 호출 없음. |
| 문서 | IPC_CONTRACT·generated inventory·현재 렌더/영속 구조 갱신. check-doc-inventory --check의 inventory/prose/link 통과. |
| 저장소 | git diff --check와 staged diff 검사 후 구현 커밋. trailer의 Agent/Handoff/Status/Criteria-Met/Verified-By를 커밋 뒤 재파싱한다. |

명령 결과 요약은 [r2-gates.json](evidence/r2-gates.json), 최종 빌드 원문은 [r2-build.log](evidence/r2-build.log)에 보존했다.

## 7. Review Signals

- 현재 r2는 사용자 요구 변경에 따른 구현이다. 기존 단일 공유 패널·세션 범위 정책의 해당 부분만 ΔV2로 대체했다. r1 독립 검증은 여전히 미수행이다.
- 이번 실제 원인은 숨긴 타일의 기존 CTA, 세션별 로컬 상태, 폴더 검증의 비동기 경계였다. 각 UI/저장/실행 책임 지점에 직접 시험을 연결했다.
- Windows SQLite ABI는 유지했다. 합성 UI와 실제 DB 시험을 구분했고 기존 live Claude 증거를 이번 재실행으로 세지 않았다.
- 다음 주체는 Claude의 독립 verify다. watcher·일반 생성물·실제 참조 수집·뷰어·다른 adapter 구현 완료를 이 보고가 대신하지 않는다.
