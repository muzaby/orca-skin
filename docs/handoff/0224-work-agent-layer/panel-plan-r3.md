# Plan r3 — 콘텐츠에 따른 패널 표시와 Work 작업 목록

작성: **Codex**, 2026-09-09. 상태: **impl/IMPL_DONE**. [구현 보고](impl-r3.md)의 ΔV3 AC 8/8은 Codex 자기확인이며 독립 검증 pending이다. 사용자 지시로 독립 검증에 앞서 이번 피드백을 같은 0224 핸드오프에 반영했다.

| 항목 | 기준 |
|---|---|
| V mode / revision | Delta V / ΔV3 |
| 기준 | V1 + [ΔV2](panel-plan.md), r2 구현 `473c4238` |
| 유효 계약 | V1 + ΔV2 + 이 ΔV3. 아래 대체 부분 이외 결정은 유지 |
| 참조 | [기존 Coding](evidence/r2-reference-coding.png), [채워진 Work](evidence/r3-reference-work.png) |

# Part I — Product & UX Contract

후속 사용자 피드백의 Work 권한/토글/Context 클릭/전체 상세는 [ΔV4](panel-plan-r4.md)가 대체한다. 그 외 이 문서의 계약과 r3 증거는 유지한다.

## 1. 목표와 출처

사용자는 “작업만 존재할때는 계획이 비었다는 표시 없이 작업만”, “계획이 존재하고 작업이 없을때는 계획만”, “둘 다 비었때는 2개 구역 구분 필요없음”과 Coding in-progress 애니메이션을 요청했다. Work는 “새 대화 랜딩페이지에서 작업 패널 표시는 없어야”, “케밥 버튼에서 활성/비활성화 가능”, “add-dir … 추가했을때 목록에 나와야” 하며 실제 콘텐츠는 새 참조처럼 표시해야 한다.

기존 빈 패널의 그림은 콘텐츠가 없는 상태로 유지하고, 작업 데이터가 생기면 작업명·상태를 가진 세로 목록으로 전환한다. 랜딩 제거는 앱의 새 대화/프로젝트 랜딩이며 빈 작업 섹션 자체의 삭제를 뜻하지 않는다.

## 2. Decision Ledger

| ID | 결정·조건 | 출처 / 대체 |
|---|---|---|
| D-018 | Coding은 존재하는 계획/작업만 표시. 둘 다 없으면 단일 빈 영역. in-progress는 움직임 있는 상태 표시 | 이번 1-1. D-012의 무조건 상하 구역·r2 정적 진행 원 부분 대체 |
| D-019 | 새 대화·프로젝트 랜딩에 Work 패널 없음. 대화 최초 진입/첫 전송에서는 작업을 기본으로 열고, 이후 사용자가 케밥에서 닫거나 열 수 있음 | 이번 2-1/2-2. D-013의 상시·비활성 토글 부분 SUPERSEDED. 최초 대화 기본 열기는 기존 의도 유지 |
| D-020 | Work 데이터가 있으면 번호/작업명 세로 목록. 진행은 강조 윤곽 번호, 완료는 채운 체크+취소선, 대기는 옅은 번호. 각 상태를 실제 task 데이터에서 파생 | 이번 2-4 이미지. D-014의 populated 진행 원 연결 그림 부분 대체. D-017 빈 장식 구분 유지 |
| D-021 | Work에서 add-dir로 명시 선택한 cwd도 목록에 한 번 표시·저장. 자동 cwd 노출은 하지 않음. 이미 추가한 경로의 재선택은 중복 생성 안 함 | 이번 2-3. D-015의 cwd 중복 no-op 해석 정정. D-016 사용자 추가 폴더 의미 유지 |
| D-022 | 작업별 질문/변경 제안 버튼은 작업명을 인용해 기존 입력 뒤에 추가하고 입력창에 포커스. 사용자가 작성·전송 | 이미지의 버튼/툴팁에 따른 구현 해석. 기존 초안·첨부·세션별 입력 보존 |
| D-023 | 승인 요청은 있으나 계획 본문 해소에 실패한 오류는 빈 계획과 구분해 유지. 도구 미지원 안내는 둘 다 빈 단일 영역의 보조 정보로 보존 | 기존 0215·ΔV2 오류 계약. 단순 빈 상태 숨김으로 승인 실패를 은폐하지 않음 |

모두 ACTIVE다. D-012의 독립 Coding task 제거·계획 댓글/복사·확대, D-013의 Work에서 다른 타일 비노출·케밥 유지, D-014의 출력/Context, D-015의 유휴 추가·DB·다음 실행 scope, D-016/017과 V1의 나머지 결정은 유지한다. 일반 생성물 수집·실제 참조 추적·뷰어·SRT·OpenCode adapter는 계속 후속이다.

## 3. 상태와 흐름

| 상태/행동 | 결과 |
|---|---|
| Coding 계획/작업 모두 있음 | 계획 위, 작업 아래. 댓글 오프셋에 작업은 포함하지 않음 |
| Coding 작업만 있음 | 빈 계획 안내 없이 작업만. 하단 상세·뒤로가기는 유지 |
| Coding 계획만 있음 | 작업 제목·빈 목록 없이 계획만 |
| Coding 둘 다 없음 | 구역 제목을 나누지 않은 단일 빈 상태. 미지원/판정 불가 보조 안내 보존 |
| Work 랜딩에서 종류 토글 | Composer/입력/첨부를 유지하고 작업 패널은 표시하지 않음 |
| Work 첫 전송 또는 처음 로드 | 작업 패널 기본 열림. 다른 타일은 필터링 |
| Work 케밥으로 닫음 | 이후 턴·계획 이벤트·화면 재렌더가 다시 열지 않음. 같은 캐시 세션 복귀도 닫힘 유지 |
| Work 케밥/명시 작업 열기 | 작업 한 개 표시. session별 선택/폭·확대 수명 유지. 앱 재시작 뒤 배치 영속은 새로 추가하지 않음 |
| Work 작업 데이터 발생/삭제 | 빈 장식↔세로 작업 목록. 출력·Context는 각 데이터의 기존 수명 유지 |
| 질문/변경 제안 | 해당 작업 인용을 입력에 추가·포커스. 기존 초안/첨부를 보존. 다른 세션에 늦게 적용하지 않음 |
| 폴더 추가 | 신규 폴더 또는 명시 cwd 모두 칩 표시. 중복/취소/루트/실패·busy/늦은 결과는 기존 경계 준수 |

## 4. Acceptance Criteria

| AC | 관측 결과 | 직접 oracle |
|---|---|---|
| AC-R3-1 | Coding 네 조합에서 빈 형제 구역이 없고 모두 비면 한 영역. 승인 본문 실패는 구분 | 실제 PlanTileContent DOM, 선택·상세·capability 회귀 |
| AC-R3-2 | Coding 진행 아이콘 애니메이션, 완료 체크/취소선·대기 점선 유지. reduced-motion 존중 | 실제 진행/완료/대기 행 DOM·Chromium animation 관측 |
| AC-R3-3 | 새 대화/프로젝트 Work 랜딩에 패널 없음. 첫 전송·로드 후 기본 표시 | 실제 페이지/모드·BEGIN_TURN·LOAD_SESSION 경로 |
| AC-R3-4 | Work 메뉴 task만, 켜기/끄기 가능. 닫음 이후 턴·이벤트·캐시 복귀가 자동 복원하지 않음 | 메뉴 클릭→store→RightPanel, reducer 우회/복원/허용 Coding 대조 |
| AC-R3-5 | Work 작업 세로 목록·번호/상태·제목·완료 취소선이 이미지에 대응. 빈 그림은 데이터 없을 때만 | 실제 TaskCreate/Update 입력·작업 상세·empty/populated·white/dark/narrow |
| AC-R3-6 | Work 명시 폴더/cwd 선택→칩→저장/reload. 반복 선택 중복 없음, Coding/busy/루트 경계 유지 | picker/store/renderer + 실제 Main handler·SQLite, draft/resume 모두 |
| AC-R3-7 | 작업 질문 버튼이 초안 뒤에 작업 인용을 추가·포커스하고 기존 텍스트/첨부 보존 | 실제 입력 controller와 세션 전환/취소 draft 복원 회귀. send IPC 없음 |
| AC-R3-8 | 출력 저장/삭제/부재·계획 승인/댓글·작업 상세·Coding diff/subagent·DB scope 회귀, 새 의존성 없음 | 해당 기존 UT/IT·native 상호작용·type/lint/build |

# Part II — Technical Design

## 5. 조사·AS-IS → TO-BE

| 현재 사실 / 조사 | 변경 |
|---|---|
| PlanTileContent가 PlanDocument와 작업 section을 무조건 렌더. r2 시험도 빈 계획과 정적 진행 원을 요구 | 상위에서 plan/task presence 판단, 캐시된 작업 배열을 하단에 전달. 양쪽 슬롯 순서와 댓글 ref는 유지 |
| rightPanelColumnsForAgent는 빈 Work columns를 task로 복구. reducer toggle/remove도 Work를 거부. 랜딩 두 곳이 RightPanel을 직접 mount | 표시 필터는 빈 목록을 보존. 기존 agentPanelInitialized로 최초 진입에서만 기본 task 추가. 메뉴 비활성 제거, 일반 close/open 경로 통일 |
| TaskTileContent→WorkTaskProgress가 실제 작업도 연결된 원으로 표시 | 같은 taskBoard items의 세로 행과 상세. 별도 작업 모델·스토어 없음 |
| Main addSessionDirectory가 cwd를 중복 집합에 포함하지만 Context는 extraDirs만 읽음. draft ADD_EXTRA_DIR도 cwd를 버림 | Work의 명시 cwd 선택은 extraDirs에 한 번 기록. 저장된 extraDirs만 중복 비교. Coding 초안 정책은 유지 |
| draftRestore 소비자가 입력을 교체. 사용자 초안이 컴포저 내부에 있음 | 기존 feature 신호에 append 의미를 구분해 전달, 기본 restore는 교체 유지. 새 전역 이벤트 버스/두 번째 Composer 없음 |

검색 술어는 `rightPanelTiles|activateTile|removeTile|agentPanelInitialized`, `extraDirs|extra_dirs|ADD_EXTRA_DIR|addSessionDirectory`, `draftRestore|restoredDraft|replaceDraft`, `TaskProgressContent|WorkTaskProgress|TaskStatusIcon`이다. 실제 위치는 §10에서 잠근다.

새 IPC·DB 형식·adapter 계약은 없다. 명시 cwd 기록은 이미 허용된 경로의 UI 추적이며 cwd 자체를 변경하지 않는다. 기존 DB 우선 해석과 다음 턴 SDK/host 범위 비교를 유지한다. 사용자 지정 폭·로컬 접힘은 기존 lifetime을 따른다.

## 6. V nodes / pairs

ΔV2의 패널·폴더 표시 관련 R/SD/AR/MD 노드는 아래 CHANGED 노드로 대체하며, 저장/권한/게시 동작은 해당 REGRESSION으로 유지한다. 비영향 V1 모델 프로필·실제 Claude 게시 인수를 이번에 다시 실행한 것으로 세지 않는다.

| Pair | node ↔ oracle | provenance / requiredness | production path / EP |
|---|---|---|---|
| VP-R3-01 | R-R3-01 ↔ AT-R3-01 (AC1/2) | CHANGED / REQUIRED | task/plan state→Coding DOM, EP1 |
| VP-R3-02 | R-R3-02 ↔ AT-R3-02 (AC3/4/5) | CHANGED / REQUIRED | landing/turn/menu→Work view, EP2/3/4 |
| VP-R3-03 | R-R3-03 ↔ AT-R3-03 (AC6/7) | CHANGED / REQUIRED | picker/작업 질문→목록/입력, EP4/5/6 |
| VP-R3-04 | SD-R3-01 ↔ ST-R3-01 | CHANGED / REQUIRED | 최초/기존/캐시 대화·닫음→다음 턴, EP2/3/6 |
| VP-R3-05 | AR-R3-01 ↔ IT-R3-01 | CHANGED / REQUIRED | event/store/layout/메뉴/페이지, EP1/2/3/4 |
| VP-R3-06 | AR-R3-02 ↔ IT-R3-02 | CHANGED / REQUIRED | 명시 폴더 DB/로드·draft→controller, EP5/6 |
| VP-R3-07 | MD-R3-01 ↔ UT-R3-01 | CHANGED / REQUIRED | presence·status·tile 필터·draft 병합, EP1/2/4/6 |
| VP-R3-08 | MD-R3-02 ↔ UT-R3-02 | CHANGED / REQUIRED | cwd/중복·canonical·세션 경계, EP5 |
| VP-R3-09 | ΔV2 VP-R2-03/06/08/10 | INHERITED / REGRESSION | DB·runtime scope·기존 권한·Coding 동작, EP5 |
| VP-R3-10 | ΔV2 VP-R2-01/09·V1 공유 입력 | INHERITED / REGRESSION | 계획 댓글/승인·게시·입력/복원, EP1/4/6 |

선택 적대 증거는 기존 계획/작업 상하 슬롯 swap 1건을 유지한다. 새 조건부 표시의 네 조합은 실제 영역 결과를 직접 단언한다. 나머지는 직접 action/IPC/DOM oracle이며 새 mutation을 선택하지 않는다.

## 10. 강제 지점과 gate

| EP | 전수 대상 | 실패 의미 |
|---|---|---|
| EP1 | PlanTileContent presence/본문 ref·TaskProgressContent/empty·TaskStatusIcon·기존 슬롯 시험 | 빈 형제 영역 잔존, 본문 실패 은폐, 진행 원 정지, 순서/선택 회귀 |
| EP2 | 표시 필터·reducer SET_AGENT_KIND/BEGIN_TURN/LOAD_SESSION·toggle/set/remove·plan_review/task/subagent/diff open·store reveal | 닫은 타일 자동 복원 또는 다른 Work 타일 우회 노출 |
| EP3 | NewChatLandingPage·ProjectLandingPage·ChatTitleBar·RightPanel/Tile chrome·배지 | 랜딩 패널 잔존, 메뉴 비활성, 닫힌 Work 완료 알림 유실 |
| EP4 | WorkTaskProgress·TaskTileContent·TaskOutput/Context·작업 상세/질문 액션 | 그림이 실제 목록을 대체, 섹션/원문/기존 액션 유실 |
| EP5 | Main canonical/duplicate·DB 저장/load·draft ADD_EXTRA_DIR·store·picker·Context 소비 | 성공인데 칩 없음, 자동 cwd 노출, 중복/권한 회귀 |
| EP6 | 질문 producer·draft 신호 target/seq·ChatTile·Composer props·InputController append/restore·focus | 초안 덮어쓰기·다른 대화 적용·자동 전송 |
| EP7 | plan 메타·r2 대체 표기·r3 문서·INDEX·impl-r3·trailer | 결정·상태·작성 주체 불일치 |

운영 gate는 영향 Vitest(설치 ABI 유지), lint/typecheck, production build, actual production 컴포넌트/CSS의 Chromium 인수, 문서 inventory/link, diff와 trailer 파싱이다. 합성 UI 데이터·mock IPC와 실제 SQLite 시험을 구분한다. 시각 결과와 클릭/상태 결과, 선택 swap red/복원 green을 증거로 보존한다.

## 11. READY self-review

D-018/023→AC1/2, D-019→AC3/4, D-020→AC5, D-021→AC6, D-022→AC7, 유지 결정→AC8을 대조했다. 기존 정적 원/상시 노출/빈 형제 영역 oracle은 이 ΔV3으로 명시 대체한다. cwd 선택은 실제 handler를 로드한 재현에서 성공·writes=0·표시 목록=0, 다른 폴더는 writes=1·목록=1로 확인했다. 사용자 명시 수정 외 새 제품 권한이나 의존성 결정은 없다. 설계 커밋은 구현과 분리한다.
