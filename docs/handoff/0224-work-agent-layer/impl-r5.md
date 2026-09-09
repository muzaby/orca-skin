# [구현자 기입] 구현 보고 r5 — 패널 밀도와 세션 완료 표시

작성: **Codex**, 2026-09-09. 기준은 [ΔV5](panel-plan-r5.md)와 대체되지 않은 기존 V다. 상태는 **impl/IMPL_DONE**, 자기확인 **8/8**이며 독립 verify는 pending이다.

## 1. 설계 대조

랜딩 tooltip과 Hero bold를 제거하고, CwdPanel의 Git 그룹은 Coding에서만 mount한다. Work 카드의 확대와 출력 목록의 모두 저장을 제거했다. 종류 선택·초안·첨부·폴더·개별 저장은 기존 소유자를 유지한다.

TaskProgressList와 TaskPanelContent가 두 모드의 작업 행과 전체 상세 수명을 공유한다. Work만 부모 available height를 CSS container로 받아 외곽 자연 높이와 영역별 상한을 적용한다. 새 패널 router·DB migration·의존성은 없다.

채팅 완료는 정상 라우팅된 turn.ended를 app에서 sessionsStore로 연결한다. 실제 열람 세션은 라우트와 draft 상태에서 계산하고, 미확인 표시는 엔티티 재조회와 분리한 transient Set으로 보관한다. 공식 아이콘의 출처·원본 path·해시는 [기록](evidence/r5-icon-sources.json)에 보존했다.

## 2. 강제 지점 전수와 V-pair 자기확인

| EP | 구현 대조 | 증거 경계 |
|---|---|---|
| EP1 | 6/6 | 두 랜딩의 공용 Toggle, CwdPanel kind, BranchChip mount/effect, add-dir flex 위치 |
| EP2 | 4/4 | Work available height wrapper, chrome/외곽, ArtifactCards list gate, Output consumer |
| EP3 | 10/10 | 공통 row/status·제목/blockedBy·질문·section cap/scroll·전체 depth·Back/삭제·focus/ack·Output/Context·문서/댓글·캐시/케밥 |
| EP4 | 6/6 | 정상 완료 생산, app 실제 열람, 완료/확인 Set, 재조회/삭제/late event, 아이콘/색, recent/pinned/project/draft 소비 |
| EP5 | 6/6 | 계획·root 메타·r4 대체 연결·보드·보고/증거·현재 문서와 구현 trailer |

전수 검색은 `AgentModeToggle|CwdPanel|BranchChip|WorktreeToggle`, `TaskProgressList|TaskPanelContent|TileSection`, `turn.ended|subscribeTurnEnd|SessionRow`의 실제 소비처를 대조했다. 선언 수나 테스트 파일 수를 EP의 논리 분모로 대신하지 않는다.

| Pair | 직접 관측 | 자기 상태 |
|---|---|---|
| VP-R5-01 | 랜딩/Composer/chrome 실제 렌더와 조회·좌표 | SELF_PASS |
| VP-R5-02 | 동일 작업 행·높이·말줄임·전체 depth | SELF_PASS |
| VP-R5-03 | 정상 완료→비열람 아이콘→열기 | SELF_PASS |
| VP-R5-04 | 두 overview의 DOM/스크롤/초점/ack 수명 | SELF_PASS |
| VP-R5-05 | 현재 라우트·완료·재조회·삭제·늦은 신호 | SELF_PASS |
| VP-R5-06 | 같은 실제 목록/shell의 양 패널 소비 | SELF_PASS |
| VP-R5-07 | chat→app→sessions→각 목록의 표시 | SELF_PASS |
| VP-R5-08 | 종류/상태/선택·삭제·키보드 경계 | SELF_PASS |
| VP-R5-09 | 완료·확인·재조회·삭제 상태 전이 | SELF_PASS |
| VP-R5-10 | 입력/권한/계획 댓글/게시/Context 기존 영향 회귀 | SELF_PASS |

## 3. 이번 라운드 수정의 잠금

[랜딩 RED](evidence/r5-landing-red.json), [완료 표시 RED](evidence/r5-nav-red.json), [패널 RED](evidence/r5-panel-red.json)는 실제 기존 컴포넌트/상태 경로가 새 요구를 만족하지 않음을 확인한다. 새 mutation은 계획에서 선택하지 않았다. 직접 event/click/style/bounds를 사용하고 토글과 Hero의 기존 순서 단언은 유지한다.

전체 회귀의 첫 실패는 작업 행의 예전 HTML 형태와 삭제된 inline wrapper를 직접 참조하던 검사였다. [첫 기록](evidence/r5-renderer-first-run.json)을 보존하고 실제 PlanTileContent 경로로 갱신했다. 이후 전체 Renderer 확장 검사에서 남아 있던 제목 regex 두 건도 발견했다([두 번째 기록](evidence/r5-renderer-second-run.json)). data-task-title의 실제 텍스트와 접근성 이름을 대조하도록 갱신했고 activeForm/subject 구분·blockedBy·미지원 안내·버전 전달 의미를 유지했다. 최종 전체 Renderer는 1,383개 모두 통과했다.

## 4. Product/UX 파생 검토

Work의 영역 스크롤은 같은 DOM을 유지하되 각 scroll owner의 위치를 별도로 복원한다. 상세 중 목록 완료를 확인 처리하지 않으며 Back과 선택 삭제의 초점 복귀를 공유했다. 저장된 계획 댓글과 문서는 같은 PlanDocument ref 범위에 남는다.

질문 tooltip이 새 overflow 경계에서 잘리는 실제 결함을 발견했다. 기존 Popover에 선택적 tooltip 역할을 추가해 portal로 표시한다. 기본 메뉴 동작은 유지하고 목록 전체가 하나의 anchor만 보관한다. 스크롤·질문 호출·상세 진입·작업 삭제 시 tooltip과 listener를 정리한다.

계획 댓글 팝오버는 문서 내부 absolute 요소여서 hidden overview 밖에 남는 portal은 없다. 저장된 댓글을 보존하고 미저장 편집 팝오버의 기존 outside-dismiss 동작을 유지한다.

## 5. 발견한 문제와 대응

- CwdPanel 표시만 바꾸면 Coding에서 켠 worktreeIsolation이 Work 전송에도 남는다. 이는 요청한 hide와 별개 실행 정책이므로 Q-R5-01로 질의했고 답변 전 전송 정책은 변경하지 않았다.
- 초기 타입 검사에서 삭제된 inline wrapper의 테스트 import와 새 세션 테스트 fixture의 넓어진 backend 타입을 확인했다. 실제 소비처와 SessionListItem 명시 타입으로 수정했다.
- 첫 native의 실패는 fixture의 폴더명 후행 공백, 같은 배열을 반환해 실제 IPC 복제를 재현하지 못한 출력 갱신, 진입 애니메이션 중 높이 측정이었다. 실제 basename 규칙·복제된 IPC 응답·안정된 측정 시점으로 시험 호스트를 수정했고 production을 바꾸지 않았다. [초기 결과](evidence/r5-native-initial.json)를 보존했다.
- 다음 native에서 높이·말줄임·완료 아이콘은 통과했지만 작업 질문 tooltip이 section scroll 경계에 잘렸다. [RED 결과](evidence/r5-native-tooltip-red.json)와 [화면](evidence/r5-native-tooltip-red.png)을 남기고 위 Popover 재사용으로 수정했다.
- tooltip 수명 검사는 키보드 조작 중 같은 위치에 남은 실제 마우스와 섞였다. Back은 작업 행 45로 초점을 복원했지만 그 행의 질문 버튼이 hover였고, 삭제 후에는 새 행 44가 포인터 아래에서 hover됐다. [원본과 직접 관측](evidence/r5-native-tooltip-lifecycle-red.json)을 보존했으며 포인터를 밖으로 옮긴 같은 소스의 대조 7개는 통과했다. 최종 fixture는 마우스 hover와 키보드/삭제 검사의 입력을 분리한다.

## 6. 구현 보고

| AC | 상태 | 직접 관측 |
|---|---|---|
| AC-R5-1 | ✅ | tooltip 부재·Hero normal·크기/순서/선택·입력 보존 |
| AC-R5-2 | ✅ | Work Git 부재·조회 중단·add-dir 당김·Coding 복귀 |
| AC-R5-3 | ✅ | Work 확대/모두 저장 부재·케밥/개별/트랜스크립트/Coding chrome |
| AC-R5-4 | ✅ | 공통 row/status animation·양쪽 전체 depth·Back |
| AC-R5-5 | ✅ | 모드 SVG·비열람 완료 파랑·실제 열기 확인·재조회/삭제 |
| AC-R5-6 | ✅ | 작업/출력/Context 제목 한 줄 말줄임·전체 이름 |
| AC-R5-7 | ✅ | Work 자연 높이/영역별 cap·overflow·Coding 높이 |
| AC-R5-8 | ✅ | 문서/댓글/scroll/focus/ack·출력/폴더/질문/캐시 수명 |

검산: ✅ 8 + ⚠️ 0 + ❌ 0 = 8. Criteria-Met은 ΔV5의 8/8 자기확인이다. 전수 EP는 6+4+10+6+6=32/32이며 현재 ΔV5 pair 9개와 상속 회귀 묶음 1개를 확인했다.

| Gate | 결과 |
|---|---|
| Vitest | 전체 Renderer 190파일·1,383개 통과, 실패/skip 0. focused 결과는 이 전수에 포함되므로 더하지 않는다. |
| 타입 | node/web/test 모두 exit 0. |
| 린트 | 전체 src/scripts exit 0, 오류 0·기존 useTranscriptVirtualizer 경고 1. 마지막 제목 테스트 수정의 scoped lint도 오류/경고 0. |
| 프로덕션 빌드 | 최종 tooltip 소스의 electron-vite build exit 0. 기존 SubAgentTileContent 혼합 import 경고 유지. |
| Windows Chromium | success=true/errors=[], named 검사 163/163·reduced-motion 통과·화면 17개. tooltip 수명 8/8을 포함한다. |
| 문서/저장소 | inventory/prose/links·diff 확인. 계획/보드/보고를 Codex 작성·impl/IMPL_DONE·독립 검증 pending으로 일치시키며 구현 trailer는 커밋 후 파싱한다. |

[전체 Renderer 집계](evidence/r5-test-summary.json), [원본 결과](evidence/r5-renderer-tests.json), [타입](evidence/r5-typechecks.json), [린트](evidence/r5-lint.log), [빌드](evidence/r5-build.log)를 보존했다. [랜딩 검사](evidence/r5-landing-tests.json), [nav 검사](evidence/r5-nav-tests.json), [패널 검사](evidence/r5-panel-tests.json), [제목 회귀](evidence/r5-task-surface-tests.json)는 단계별 증거다.

Windows [최종 결과](evidence/r5-native-ui.json)와 [검산/소스 해시](evidence/r5-native-validation.json), [Main manifest](evidence/r5-directory-native-manifest.json)는 같은 최종 소스·CSS·Main bundle임을 대조했다. 직접 확인한 화면은 [랜딩](evidence/r5-new-landing.png), [Work 내용](evidence/r5-work-full.png), [빈 카드](evidence/r5-work-empty.png), [영역 상한과 tooltip](evidence/r5-work-density.png), [Coding 목록](evidence/r5-coding-full.png), [Coding 전체 상세](evidence/r5-coding-detail.png), [완료 아이콘](evidence/r5-nav-completion.png)이다.

## 7. 후속 확인 신호

사용자 피드백을 반영한 라운드이며 handoff-review는 수행하지 않았다. 자기확인은 독립 verify를 대체하지 않으며 다음 주체는 Claude 독립 verify다. 새로운 외부 모델 실행·사용자 DB·Explorer 실행을 증거로 주장하지 않는다. 임시 DB·디렉터리와 주입한 OS 포트, 실제 Renderer/Main 코드를 사용했다.
