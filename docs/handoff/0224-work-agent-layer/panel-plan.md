# Plan r2 — 모드별 우측 패널과 Work 폴더 추가

작성: **Codex**, 2026-09-08. 상태: **plan/READY**. 같은 0224 핸드오프의 사용자 피드백을 구현한다. 독립 검증은 아직 수행하지 않았으며 사용자가 이번 피드백의 우선 반영을 지시했다.

| 항목 | 기준 |
|---|---|
| V mode / revision | Delta V / ΔV2 |
| 기준선 | 0224 V1 설계 `51268488`, r1 코드·인수 `ac4bebec` |
| 유효 계약 | [V1](plan.md) + 이 ΔV2. 아래 대체 관계 외 V1 결정 유지 |
| 참조 | [Coding](evidence/r2-reference-coding.png), [Work](evidence/r2-reference-work.png), [빈 Work](evidence/r2-reference-empty.png) |

# Part I — Product & UX Contract

## 1. 목표와 출처

Coding은 계획과 작업을 같은 패널에서 읽고, Work는 진행 상황·출력·컨텍스트를 가진 작업 패널 하나를 항상 볼 수 있게 한다. 기존 Markdown·작업 데이터·게시 액션을 재사용하며 새 패널 플랫폼을 만들지 않는다.

사용자는 “상단은 exitplanmode의 계획을 출력하고, 하단엔 … 작업을 표기”, “작업 패널 1개만 항상 노출”, “컨텍스트에 배치된 버튼은 add-dir 역할”을 명시했다. 후속 정정은 “cowork의 케밥버튼 제거는 취소다. 대신 요청한 타일을 제외한 다른 타일들은 노출을 하지않는다”이다.

기존 add-dir가 확정 세션에서 무시되는 사실을 설명한 뒤, 사용자는 **기존 대화에서도 추가 허용**을 선택했다. 유휴 상태에서 폴더를 저장하고 다음 요청에 적용하는 계약으로 확정했다.

## 2. Decision Ledger

| ID | 결정 | 출처/조건 | 상태·대체 |
|---|---|---|---|
| D-012 | Coding task 타일 제거. plan 상단 계획·하단 작업, copy/expand/close 유지 | 이번 이미지1·명시 요청 | ACTIVE, V1 D-004/D-008의 공유 패널 부분 대체 |
| D-013 | Work는 task 하나를 항상 노출. 케밥 유지·타일 메뉴도 task만. 전체 타일 닫기는 제공하지 않고 펼치기/복귀 1개 | 이번 요청+후속 정정 | ACTIVE, V1의 1회 자동열기·사용자 닫기 규칙 대체 |
| D-014 | Work 세 섹션·구분선·출력 행·빈 상태 일러스트를 참조 비례에 맞춘다 | 이미지2·3, 기존 시맨틱 토큰 사용 | ACTIVE |
| D-015 | Work Context '+'는 폴더 선택. 유휴 기존 세션에도 추가·영속, 다음 요청부터 적용 | 사용자 질문 답변. 진행 중 변경 금지 | ACTIVE, V1 D-005의 폴더 편집 후속 부분 보완 |
| D-016 | 허용 폴더와 실제 참조 증거를 혼동하지 않는다. Context 폴더 칩은 사용자가 추가한 폴더임을 접근성/툴팁으로 명시 | 기존 참조 수집 후속 결정 유지 | ACTIVE |
| D-017 | 상태는 실제 데이터에서 파생. 빈 진행 그림은 설명용이며 완료 개수로 읽히지 않는다 | 이미지3의 완료 체크는 빈 상태 장식으로 해석 | ACTIVE |

V1 D-001/002/003/006/007/009/010/011은 유지한다. D-004의 게시 원본·삭제 UX, D-005의 실제 참조 수집·뷰어·일반 생성물 감지 후속, D-008의 실행 계층 범위도 유지한다. 최초 케밥 제거 요청은 후속 사용자 정정으로 폐기하며 구현하지 않는다.

## 3. 흐름과 상태

| 상태/동작 | 사용자 관측 |
|---|---|
| 새 대화/프로젝트 랜딩에서 Work 선택 | 입력/첨부를 유지하고 우측 빈 작업 패널 표시. Coding 선택 시 Work 패널 제거 |
| Coding 계획 열기·작업 카드 진입 | plan 하나에 위 계획·아래 작업. 계획이 없어도 작업은 표시. 작업 상세는 하단에서 열고 목록으로 돌아감 |
| Coding 계획 검토 | 기존 선택 코멘트·복사·승인 흐름 유지. 작업 영역은 계획 선택 오프셋에 포함하지 않음 |
| Work 진입·이동·재로드·늦은 tile open | task 하나만 보임. 메뉴/복원/직접 열기가 다른 타일을 표시하지 않음 |
| Work task 메뉴 | 활성 작업 항목 유지. 비활성 토글처럼 오해하지 않게 고정 상태 표시. 세션 고정/이름/삭제 메뉴 유지 |
| 펼치기·복귀 | 같은 콘텐츠를 더 넓게 표시하고 원래 폭으로 복귀. 이중 마운트·추가 모델 호출 없음 |
| 섹션 접기 | 해당 본문만 접힘. 타일 전체는 유지. 세션 이동 시 다른 세션의 로컬 표시/선택 상태 유출 금지 |
| Work 출력 없음/로딩/실패 | 빈 일러스트+설명, 실제 로딩, 재시도 가능한 오류를 구별 |
| 폴더 선택 취소/실패/중복/루트 | 취소는 무변경, 실패·루트는 이유 표시, 중복은 늘지 않음 |
| 폴더 선택 중 세션 이동/전송 시작 | 늦은 결과로 다른 세션이나 실행 중 범위를 변경하지 않음 |
| 기존 Work 유휴에서 추가 | 성공 응답 후 칩 표시. DB가 정본이며 재시작 복원·다음 실행의 SDK/호스트 도구 범위에 반영 |
| 진행/준비/백그라운드 실행 중 추가 | 버튼 비활성+안내, Main도 재검사. 기존 실행/DB는 무변경 |

기존 Work의 계획 승인 카드는 트랜스크립트에서 유지한다. 비노출 타일로 보내는 별도 버튼은 숨기고 해당 도구 원문·승인·오류를 유지한다. 새 뷰어·자체 컨텍스트 수집·일반 파일 발견·다른 모드의 권한 변경은 범위 밖이다.

## 4. Acceptance Criteria

이번 ΔV2 자기확인 분모는 아래 **8개**다. V1 전체 재인수로 합산하지 않으며 기존 V1 증거는 별도 보존한다.

| AC | 관측 기준 | 직접 oracle / production 경로 |
|---|---|---|
| AC-R2-1 | Coding 메뉴/영역에는 task가 없고 작업 진입은 plan으로 연결 | 실제 action→store→RightPanel/TitleBar. 정상 plan/diff/subagent와 task 차단을 함께 관측 |
| AC-R2-2 | plan 위 ExitPlanMode 본문·아래 작업, 진행 원/완료 체크+취소선/대기 점선 원. 계획 부재에도 작업·상세 접근 | plan_review·TaskCreate/Update fixture→실제 PlanTileContent, 영역별 DOM/좌표·선택 댓글·복사 |
| AC-R2-3 | Work task 상시 1개, 케밥 유지·task만, 펼치기/복귀. 랜딩·복원·직접열기에서 동일 | 실제 모드 전환·오염된 columns·OPEN_*→렌더, 구독/마운트 보존·폭 관측 |
| AC-R2-4 | Work 진행/출력/컨텍스트 순서와 populated/empty 상태가 참조와 대응 | 실제 task/게시 fixture, 흰색·어두운색·좁은 창 스크린샷. 상태 접근성·접기 확인 |
| AC-R2-5 | 폴더 추가 UI에서 취소·중복·루트·오류·세션 이동·busy 결과가 명확하고 안전 | picker→store→IPC를 실제 소비 컴포넌트로 호출, 다른 세션 DB/상태 무변경 |
| AC-R2-6 | 기존 Work idle 폴더 추가가 DB 저장·재로드·다음 SDK/호스트 scope로 전달, Coding/진행 중은 거부 | 실제 IPC handler·SQLite·turn/runtime 준비 시험, 기존 resume payload 임의 변경 거부 유지 |
| AC-R2-7 | 게시 다운로드·부재·휴지통 및 계획 승인·도구 원문을 보존 | 기존 ArtifactCard/TaskOutput 수명·plan review/Work transcript 회귀, 비노출 타일의 dead CTA 검사 |
| AC-R2-8 | 입력·첨부·종류 고정·세션 이동·Coding diff/subagent 회귀, 신규 의존성/모델 호출/이중 구독 없음 | 기존 agentKind/라우팅/패널/extraDirs suite 및 실제 renderer 인수 |

# Part II — Technical Design

## 5. 조사 결과와 구조

| 대상 | 현재 코드 사실 | 변경 |
|---|---|---|
| 메뉴/패널 | `rightPanelTiles.ts` 전역 정의, `ChatTitleBar` 고정 메뉴, `RightPanel` columns 그대로 소비 | agentKind별 순수 표시 정책을 같은 모듈에서 소비. renderer 최종 필터도 적용 |
| 활성화 | reducer 일반 toggle/set/remove·BEGIN_TURN·LOAD_SESSION·plan_review·OPEN_TASK·OPEN_SUBAGENT_TASK·OPEN_DIFF_COMMIT | 모드 정책 전수 적용. Coding task→plan, Work 고정 task |
| 계획 | `PlanTileContent`의 planContent와 댓글 containerRef | 기존 본문을 상단에, 공통 작업 목록/상세를 하단에. 빈 본문 early return 제거 |
| 작업 | `taskBoardForMessages` 캐시·`taskBoardOrdered`·TaskProgressList | 목록/상세 최소 추출·재사용. Work 진행 요약도 같은 items에서 파생 |
| 출력 | TaskOutputContent→artifactStore→ArtifactCards(list) | 같은 수명 유지. 기본 refresh 행은 오류 재시도로 정리·빈 그림 제공. 액션은 기존 메뉴 보존 |
| 폴더 | CwdPanel picker→addExtraDir는 확정 세션 무시. Main `selectTurnExtraDirs`는 DB 우선 | Work 전용 명시 폴더 추가 명령. 일반 chat.send override는 계속 무시 |

검색 기준: `rg -n 'rightPanelTiles|activateTile|OPEN_TASK|OPEN_SUBAGENT_TASK|OPEN_DIFF_COMMIT|plan_review' app/src/renderer/src/features/chat`와 `rg -n 'extraDirs|extra_dirs|addExtraDir|pickDirectory' app/src/main/app app/src/main/features/sessions app/src/renderer/src/features/chat`.

레이어 방향은 기존 DAG를 유지한다. 페이지는 Work 랜딩 패널 조립만 담당하고 로직은 chat feature에 둔다. 새 실행 엔진·범용 패널 레지스트리·watcher·의존성은 추가하지 않는다.

## 6. 폴더 저장·실행 경계

새 명시적 `session:addDirectory` IPC는 `sessionId + directory`를 받고 현재 DB의 Work 종류·실제 디렉터리·절대 경로·루트 금지·개수 상한·실행/준비 여부를 검증한다. 비동기 디렉터리 검증 뒤 busy/세션을 다시 확인하고 기존 extra_dirs에 추가만 한다. cwd 변경·삭제·임의 send payload로 범위 확대는 허용하지 않는다.

`registerSessionHandlers`에 composition root가 `supervisor.hasSession` 기반 busy 판정을 주입한다. 이는 준비 lease·실행·listening을 포함한다. 성공은 `{ok:true, extraDirs}`이며 실패는 busy/not-found/invalid-directory/not-work/limit 같은 명시 reason을 반환한다. 원본과 canonical 경로의 루트 검증을 모두 수행하고 최종 busy 재검사→행 재읽기→UPDATE 사이에는 await를 두지 않는다.

DB 성공 응답 후 renderer의 대상 sessionKey에 반영한다. picker 시작 시 key를 캡처하고 중간 전환/실행 시작에는 적용하지 않는다. 선택 취소/실패를 구분하고, 컴포저와 Context는 같은 picker 동작을 재사용한다.

다음 요청은 기존 DB 우선 해석을 유지한다. 기존 persistent 채널의 extraDirs와 달라졌다면 재사용하지 않고 재준비하여 SDK `additionalDirectories` 및 host tool context를 같은 범위로 맞춘다. 기존 listener/자동 연속/준비 lease가 살아 있는 동안 변경을 허용하지 않는다.

DB 쓰기는 단일 저장소·단일 추가 연산이다. 응답 도중 창이 닫혀도 DB가 정본이며 reload에서 복원한다. 별도 DB migration은 필요하지 않다.

## 7. V nodes / pairs

V1 R-12/AT-12의 사용자 닫기·공유 패널 부분과 R-16/AT-16 패널 기본값, SD-02/AR-03/MD-05 관련 패널 부분은 아래 CHANGED 노드로 대체된다. V1 R-08/AT-08 중 Work 명시 추가 동작만 이번 사용자 승인으로 확장하며 나머지 권한 경계는 회귀다.

| Pair | node ↔ oracle | provenance / requiredness | 경로·강제 지점 |
|---|---|---|---|
| VP-R2-01 | R-R2-01 ↔ AT-R2-01 (AC1·2) | CHANGED / REQUIRED | Task/plan event→state→Coding panel, EP-R2-1·2·3 |
| VP-R2-02 | R-R2-02 ↔ AT-R2-02 (AC3·4) | CHANGED / REQUIRED | mode/load→Work sections, EP-R2-1·2·4 |
| VP-R2-03 | R-R2-03 ↔ AT-R2-03 (AC5·6) | NEW / REQUIRED | picker→IPC→DB→next turn, EP-R2-5·6·7 |
| VP-R2-04 | SD-R2-01 ↔ ST-R2-01 | CHANGED / REQUIRED | landing→first send→session switch/reload, AC3·5·8 |
| VP-R2-05 | AR-R2-01 ↔ IT-R2-01 | CHANGED / REQUIRED | menu/direct open→store→view, AC1·3·7 |
| VP-R2-06 | AR-R2-02 ↔ IT-R2-02 | NEW / REQUIRED | shared schema/preload→handler→DB→runtime, AC5·6 |
| VP-R2-07 | MD-R2-01 ↔ UT-R2-01 | CHANGED / REQUIRED | agent tile filter/activation+task status rendering, AC1·2·3 |
| VP-R2-08 | MD-R2-02 ↔ UT-R2-02 | NEW / REQUIRED | duplicate/root/busy/stale session directory handling, AC5·6 |
| VP-R2-09 | V1 R-12·AR-03 ↔ AT-12·IT-03의 게시/공유 입력 부분 | INHERITED / REGRESSION | ArtifactCard/TaskOutput/Composer/plan review, AC7·8 |
| VP-R2-10 | V1 R-08·R-13 ↔ AT-08·AT-13의 기존 권한·Coding 부분 | INHERITED / REGRESSION | 기존 workspace/extraDirs/종류·diff/subagent, AC6·8 |

각 AC는 위 표에서 독립 oracle이고 SD/AR/MD 행은 해당 AC의 구체 경로를 직접 검증한다. 선택 적대 증거는 **상단 계획/하단 작업 슬롯 맞교환 1건**(VP-R2-01/07): 존재만 확인하는 검사를 방지한다. 나머지는 실제 action/IPC/DOM 결과를 읽는 직접 행동 oracle이며 별도 변이는 선택하지 않는다.

V1의 프로필 문구·경계 part 기록·게시 모델 판단 자체는 바뀌지 않는다. 실제 Claude 요청을 다시 보내는 것은 이번 패널 변경의 필수 gate가 아니며 V1 실제 증거를 재실행 결과로 쓰지 않는다.

## 10. 강제 지점과 운영 gate

| ID | 전수 지점 | 실패 의미 |
|---|---|---|
| EP-R2-1 | rightPanelTiles 정책·ChatTitleBar 메뉴/배지·RightPanel 최종 렌더 | 메뉴만 숨기고 이벤트로 다른 타일이 노출됨 |
| EP-R2-2 | reducer 종류/시작/로드·일반 toggle/set/remove·계획 review·task/subagent/diff open, store reveal·랜딩 2곳 | 캐시/우회 진입/새 대화에서 계약 유실 |
| EP-R2-3 | PlanTileContent 상하 조립·댓글 ref·TaskProgressList/Detail·상태 아이콘 | 계획 없을 때 작업 유실, 순서/상태 오해, 댓글 오프셋 회귀 |
| EP-R2-4 | Work TaskTileContent·TileSection·TaskOutputContent·Context·expanded chrome | 단일 패널이 상세로 통째 교체, 빈 상태/오류 유실 |
| EP-R2-5 | picker shared hook·CwdPanel·Context·대상 key store action | 취소/실패·늦은 결과가 다른 대화에 적용 |
| EP-R2-6 | shared IPC schema/channel·preload·renderer API·main registration/handler·DB write | 공개 계약 미배선·범위 검증/영속 누락 |
| EP-R2-7 | Main busy/preparing/listening 재검사·DB→turn·respawn key·host context | 실행 중 확대, SDK와 host 허용 경로 불일치 |
| EP-R2-8 | plan.md 메타/Decision 상태·이 문서·INDEX·impl-r2 보고·commit trailer | 상태/기준선/작성 주체 서로 불일치 |

구현자는 실제 파일/분기 전수 검색으로 각 행 지점을 재열거하고 차집합을 보고한다. 관련 subtree gate는 lint/typecheck, 영향 Vitest(설치 ABI 유지), production build, 문서 inventory/link, diff와 trailer 파싱이다. 새 IPC는 IPC_CONTRACT와 generated inventory를 함께 갱신한다.

시각 인수는 실제 production 컴포넌트+테마 CSS를 Chromium에서 렌더해 Coding populated/empty, Work populated/empty, dark/narrow, expand/return을 저장한다. 테스트 합성 값은 실제 실행·게시로 주장하지 않는다. 실제 DB/IPC 시험과 그림용 합성 입력은 별도 증거로 남긴다.

## 11. READY 검토

사용자 정정과 add-dir 선택을 반영했으며 외부 제품 결정은 남지 않았다. ACTIVE 결정 대조: D-012→AC1/2, D-013→AC3, D-014/017→AC4, D-015→AC5/6, D-016→AC4/5, 기존 게시/권한/입력→AC7/8, 충돌 0. `supervisor.hasSession`의 준비 lease 포함, Runtime의 immutable host scope, 재개 DB 우선 해석을 코드에서 확인했다. 상단/하단 직접 oracle과 swap 변이를 선택했으며 READY 설계 커밋을 구현과 분리한다.
