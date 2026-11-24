# 0328 · 컴포저·패널·목록·셸 응답성 (단계 D)

**READY · V1 rev 5 + ΔV1.** verify 1회째 RETURN_TO_PLAN을 정정했다 — 확장 후보 셋(폴더 통지 묶기·같은 창 중복 제거·창 폴더 필터)을 Q20 F1·F2·F6 입력으로 채택하고, 세션 전환 때 첨부를 텍스트와 함께 남기기로 했다(D-013, 사용자 결정). 바뀐 행은 §3 ΔV1 근거 줄에 있다.

rev 5 · r1 구현 중 돌아온 PLAN_GAP을 정정했다 — §19 R-H가 시간 합에 개수(DOM 행)를 섞고 commit·첫 paint의 경계가 없었다. EP12 측정표에 항목마다 단위와 시작→끝을 고정하고 R-H·R-R 식을 그 표의 시간 구간으로 다시 썼다(§10 EP12 측정표 · §19).

rev 4 · PR #640 0328 피드백을 반영했다. 기준 트리를 `c7d2adf2`로 재대조하고(§8-A) 단계 경계(D-008), T21 송신 시점(D-009)·워커 배치(D-010), 댓글·가상 목록 측정(D-011), WU1 구간 측정(D-012)을 확정했다. D-004는 사용자가 화면별 조건부 허용으로 정했다(D-004a~d).

## 메타

| 항목 | 값 |
|---|---|
| slug / 날짜 | `0328-composer-panels-lists-shell` / 2026-11-20 |
| 기준 트리 | `c7d2adf2` — PR #640 head(0326 verify 7 PASS · 0327 verify 5 PASS 기계 범위). rev 1~3의 `62125eaa`는 공유 브랜치에 없어 좌표가 아니다(§8-A A1) |
| V mode / 기준 V / 이번·유효 revision | Baseline V1 rev 5(`7663064`) + ΔV1 (READY). 0325 A·0326 B·0327 C는 별도 V이고 여기서는 그 AC를 REGRESSION pair(VP-24·VP-26·VP-27)로만 다시 닫는다 |
| 다음 주체 | 검증자(Claude) · V1 rev 5 + ΔV1, r2 구현 완료. INDEX의 `impl/IMPL_DONE`에서 독립 검증 대기. |
| 입력 | [0325 계획 §6-C·D](../0325-ui-responsiveness-followup/plan.md) · [원 요청서 T20~T33와 셸](../0325-ui-responsiveness-followup/input/0324-agent-requests.ko.md) · [실행 위치 감사](../0325-ui-responsiveness-followup/input/0324-audit.ko.md) · [0327 공통 워커 계약](../0327-worker-protocol-visible-views/plan.md) · [PR #640 0328 피드백](https://github.com/muzaby/orca-skin/pull/640#issuecomment-7122563525) |

# Part I · 제품 및 사용 흐름

## 1. 목표

긴 계획서에서 댓글을 쓰거나 이미지를 붙여넣고 바로 전송할 때, 화면이 새 입력을 받을 수 있어야 한다. 메뉴·목록·설정·셸은 기존 결과와 데이터 보존을 지키면서 입력·commit·paint·디스크 작업 중 어디에 시간이 걸렸는지 나누어 판단한다.

## 2. 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 사용자 | 0327 구현 전에 0328 D·0329 E·0330 W를 별도 계획으로 작성. 현재와 변경 후를 사용자 시나리오로 설명. 단계 D의 제품 레퍼런스는 VS Code | 이번 대화 |
| 승계 | D가 맡는 아홉 T행과 셸 세 항목. T21 작업 수·실패 폴백은 A에서 완료. 조건부 이주는 입력 크기·실측으로 판정 | 0325 §6-C·D, D-012·D-019·D-029·D-041·D-043 |
| 설계 제안 | 상한 초과 경로만 채택하는 조회·전송 방식과 테스트 입력. 기기별 최종 허용치는 0330에서 사용자 판정 | §3 D-004a~d, §19 |
| 사용자(PR #640) | 기준선 재대조·단계 경계, T21 송신 시점과 워커 계약, T24 댓글·가상 목록, D-004 화면별 조건부 (가), WU1 구간 측정·Windows 인계 여섯 항목. D-004 하위 결정 넷과 미준비 썸네일 처리는 이번 대화에서 사용자가 권고안을 골랐다 | [PR #640 댓글](https://github.com/muzaby/orca-skin/pull/640#issuecomment-7122563525), 이번 대화 |

## 3. 결정 기록

| ID | 결정·조건 | 출처 | 상태 |
|---|---|---|---|
| D-001 | D 전체를 이 handoff에 두고 구현·Windows 최종 판정은 각 소유 단계에 둔다 | 사용자 확정, 0325 §6-C | ACTIVE |
| D-002 | 전송 스냅숏의 원본·순서와 최근 편집을 보존한다. 크기 검사 후 워커가 축소·인코딩하고 실패한 첨부는 파일 표시로 남긴다 | T21, 0325 D-012·D-041 | ACTIVE |
| D-003 | DOM 위치·댓글 선택·읽는 중인 스크롤은 창이 소유한다. 설치 전체 출력은 기존 실행의 수명 안에 보존한다 | T24·T32·T33 | ACTIVE |
| D-004 | ~~결정 요청 — T20·T28·T30에서 (가) 제한된 추가 조회 / (나) 기존 공개 계약 안의 창 가시화~~ | 0325 D-029, 요청서, 설계자의 선택지 | SUPERSEDED → D-004a~d |
| D-004a | T20 열린 메뉴의 외부 생성·삭제·이름 변경 반영은 필수다. 변경 전달은 data→창 **폴더 변경 통지 채널**(활성 폴더 revision 무효화만 알림)로 한다. 기존 `files.list` 1초 재조회 폴백은 쓰지 않는다 | “통지 채널 허용 (권고)” · PR #640 “T20의 열린 메뉴에서 외부 생성·삭제·이름 변경 반영은 필수” | ACTIVE |
| D-004b | T20 후보 prefix/limit 조회는 **WU1이 호스트 조회·IPC 전송을 병목으로 보인 경우에만** 추가한다(§19 R-H). 기존 전체 목록 조회·9번째 이후 유효 파일 장식은 그대로 둔다 | “측정 조건부 허용 (권고)” | ACTIVE |
| D-004c | Q28 페이지 조회는 “DB·전송이 병목일 때만” 적용한다. DOM만 비싸면 렌더러에서 해결하고 기존 조회·정렬·선택 ID·전체 열람을 보존한다 | “둘 다 조건부 허용 (권고)” · PR #640 | ACTIVE |
| D-004d | Q30 목록/상세 분리는 “숨은 실행 출력 읽기·전송이 병목일 때만” 적용한다. 보존 조건은 D-004c와 같다 | “둘 다 조건부 허용 (권고)” · PR #640 | ACTIVE |
| D-005 | T29·T31·T33와 셸의 측정 우선 항목은 §19 입력과 구간별 비용으로 유지·수정을 기록한다. 0327은 테마 재강조, D는 입력 높이를 맡는다 | 0325 D-019·D-043, 0327 D-016 | ACTIVE |
| D-006 | 제안 예산은 §14에 둔다. 성능 측정·진단 fixture에는 본문·경로·기밀 설정값을 수집하지 않는다 | 설계자, 실행 모델의 계측 계약 | ACTIVE |
| D-007 | 단계 D의 제품 레퍼런스는 VS Code다. 파일 후보는 현재 폴더를 열어 둔 채 외부에서 생성·이름 변경·삭제해도 갱신한다. 입력 높이·대량 목록·설치 로그는 §8의 대응 동작을 참조한다 | “D는 vscode를 레퍼런스로 따를 것” · 사용자 보고, VS Code 1.100.0 소스(§8) | ACTIVE |
| D-008 | 단계 경계 — 0325의 첨부 원본·실패 처리, 0326의 세션·transcript, 0327의 Markdown·diff·가시 행을 승계(REGRESSION)한다. 0328은 컴포저·패널·목록 상호작용, 검색 결과 메시지 도착·강조는 0329, 장비별 최종 판정은 0330이 맡는다 | PR #640 “기준선·단계 경계” | ACTIVE |
| D-009 | T21 송신 — ‘다음 입력 가능’과 ‘원본 송신 시작’을 나눈다. “썸네일 완료를 기다리지 않고 전송 시점의 원본을 순서대로 보내며 미리보기는 준비된 것만 사용”한다. 전송 순간 미준비 이미지는 버블·DB(재시작 후 포함)에 썸네일 없이 파일로 남는다(0325 D-012 확장) | PR #640 권고 · “준비된 것만 사용 (권고)” | ACTIVE |
| D-010 | 워커 배치 — 이미지 썸네일은 0327 compute·markdown 레인의 요청 세대·취소·우선순위(0327 D-008·D-016·D-024) 위에 둔다. base64 문자열 복제로 보내고, 원본 송신은 워커와 독립이며, 픽셀 검사 후 decode하고 레인 슬롯을 모든 종료 경로에서 해제한다. 전용 `image` 레인 여부는 §19 R-W 겹침 측정으로 정한다. JSON은 기존 codec을 쓰고 최신 편집 revision만 폼에 반영한다 | PR #640 “T21 이미지·T29 대형 JSON의 워커” | ACTIVE |
| D-011 | 댓글·가상 목록 — 계획 본문 ref와 오버레이 ref를 나누고 본문 revision별 UTF-16 색인·가시 주석만 잰다. 화면 밖 댓글은 문단 이동 뒤 잰다. 0327 가상 행을 쓰는 목록·로그는 실제 스크롤 컨테이너·안정 행 ID·마운트 시 드래그 선택 취소 범위를 §10 VL 표로 고정한다. 저장 댓글 인용과 일시 브라우저 선택은 따로 검증한다 | PR #640 “T24 댓글·목록 가상화” | ACTIVE |
| D-012 | WU1은 같은 입력으로 호스트 조회·IPC 바이트·워커 대기·DOM 행·React commit·첫 paint를 나눠 재고 항목별 유지/변경 근거를 남긴다. 실제 설치 로그와 진단 폭주는 따로 적는다. “50ms·160ms는 원인 조사 기준”이고 Windows 전용 결과는 AC12·0330 인계 항목이며 0327 AC30은 WU1 착수 조건이 아니다 | PR #640 “기계 검증·Windows 인계” | ACTIVE |
| D-013 | 세션을 바꿔도 컴포저 첨부와 진행 중 썸네일 작업은 초안 텍스트와 함께 남는다(0328 전 동작). 전송하면 그때 활성 세션의 스냅숏으로 간다. r1.3의 “세션 전환 시 첨부만 비움”은 쓰지 않는다 | “텍스트와 함께 유지 (권고)” — verify 1 파생 이슈 #7 질의 답 | ACTIVE |

ΔV1 변경 근거 · verify 1회째(창 안) RETURN_TO_PLAN. 파생 이슈 #4(V-I4)→F2 · #5(V-I12)→F6 · #6(V-I13)→F1을 채택하고 등록 변이로 올렸다. #7→D-013·AC15·EP2 ⑥·VP-14·VP-31. #3(⑦ 잔여)은 VL 행에 이미 적힌 목록별 `*.virtual.test.ts` 좌표를 Electron ABI 없이 도는 필수 좌표로 명시했다(plan 내부 정합). #1·#2는 기존 열거 원문의 이행 결함이라 plan을 바꾸지 않는다. **ACTIVE 결정 ↔ AC 대조 (ΔV1)**: 충돌 0 — D-013→AC15, D-002 “최근 편집 보존”과 같은 방향, D-009의 송신 스냅숏 규칙은 그대로다.

rev 5 변경 근거 · r1 구현자 기입 “R-H는 호스트·창 수신 시간과 «DOM 행·React commit·첫 paint 합»을 비교한다. EP12의 DOM 행은 개수로 정의되어 있다”(PLAN_GAP — plan 내부 불일치). 결정 변경 0. 바뀐 규범 행은 AC12, VP-25 경로, §10 EP12 ②와 신설 EP12 측정표, §19 R-H·R-R 행과 선언 경계다. **ACTIVE 결정 ↔ AC 대조 (rev 5)**: 충돌 0 — D-012 “호스트 조회·IPC 바이트·워커 대기·DOM 행·React commit·첫 paint를 나눠 재고”의 여섯 항목을 EP12 측정표가 그대로 담고, R-H·R-R은 D-004b~d의 “병목일 때만”을 시간 구간 비교로 구체화한다.

rev 4 변경 근거 · PR #640 0328 피드백과 이번 대화의 사용자 답(D-004a~d · D-009 미준비 썸네일)을 반영했다. 바뀐 규범 행은 D-004a~d·D-008~D-012, AC1·AC2a·AC2b·AC3~AC6·AC12·AC13·AC14, VP-14·16·17·20·21·24, VP-02를 나눈 VP-02a·02b와 신규 VP-26·27·28·29·30, §10 Q20·EP2·EP3·EP5·EP12·VL·WL이다.

**ACTIVE 결정 ↔ AC 대조 (rev 4)**: 충돌 0. D-004a→AC1 · D-004b→AC1·R-H · D-004c→AC4 · D-004d→AC6 · D-008→VP-24·26·27 · D-009→AC2a·AC2b · D-010→AC13·AC5 · D-011→AC3·AC14 · D-012→AC12. D-002 “크기 검사 후 워커가 축소·인코딩”은 D-010과 같은 방향이고 D-009가 송신 시점만 정한다.

rev 3 변경 근거 · D-007→AC1·AC3·AC4·AC6·AC8·AC9. 제품 레퍼런스 지정과 T20 파일 최신성은 이번 결정에 따른다. DB/카탈로그의 반환 범위를 바꾸는 D-004와 W의 장비별 허용치는 각 소유 단계에 남는다.

rev 2 변경 근거 · 사용자가 “작성한 파일/디렉토리가 없어 이상하다”고 보고했다. §8 M1b에서 생성 파일 누락과 삭제한 파일 잔존을 재현해 §5·AC1·§10 Q20·S-D1에 재조회 계약을 제안했다. D-004의 공개 질의 선택은 열려 있다.

V1 대조 결과 · D-001→AC12, D-002→AC2, D-003→AC3·8·9, D-005→AC5·7·9~12, D-006→AC2·5·12. D-004의 두 선택은 AC1·4·6과 §10 Q에 연결된다. 어느 쪽도 사용자가 채택한 것으로 세지 않았다.

## 4. 선행 관찰과 작은 해법

- T24는 실제 Chromium에서 본문 2,000문단·댓글 128개를 한 번 재측정할 때 중앙 20.9ms였다(§8). 댓글마다 문서 처음부터 다시 찾는 경로와 폭 변경을 한 프레임에 여러 번 처리하는 경로를 각각 바꾼다.
- T32는 창에서 전체 문자열을 누적하지만, 현재 Claude 설치 어댑터는 완료 1건만 보낸다. 로그 폭주는 진단 어댑터로 전달 경로를 검증하고 실사용 결과와 출처를 구분한다.
- T28·T30·T31의 순수 계산/서버 렌더가 가볍더라도 IPC 직렬화·실창 paint를 포함하지 않는다. §8 표로 현행 유지를 확정하지 않는다. 설치나 조회를 실행하는 agent, DB를 소유하는 data, 창이나 트레이를 소유하는 main은 그대로다.

## 5. AS-IS → TO-BE · 사용자가 보는 변화

| 사용자 시나리오 | 현재(AS-IS) | 제안(TO-BE) / 조건부 대안 |
|---|---|---|
| **메뉴**. 파일 2만 개가 있는 폴더에서 `@src`를 입력하고 두 번째 후보를 선택한다 | 디렉터리 목록을 받은 창이 접두사·숨김 규칙을 적용해 파일 최대 8개를 띄운다. 슬래시·플러그인·모델은 서로 다른 후보 집합을 쓴다 | 기본은 기존 전체 목록 + 창 필터다. 큰 폴더의 목록 전송이 병목으로 측정되면 목록 소유자가 같은 순서의 prefix·8개 결과를 주고 같은 키로 선택한다(D-004b). 목록 밖에서 직접 붙여넣은 유효 파일·선택 모델의 장식은 보존 |
| **새 파일**. `@new` 목록을 열어 두고 외부에서 `new-file.txt`와 `new-dir/`를 만든 뒤 파일 이름을 바꾸고 폴더를 삭제한다 | 처음 읽은 폴더 이름이 창에 남는다. 입력을 다시 열어도 새 이름이 빠지고 삭제된 이름이 계속 보일 수 있다 | VS Code 탐색기 방식대로 data가 활성 폴더의 변화를 감지하고 창에 “다시 읽어라” 통지를 보낸다(D-004a). 창은 같은 질의를 다시 읽어 새 이름을 보이고 지운 이름을 뺀다. 연속 타이핑 중에는 확보한 후보를 필터한다 |
| **이미지**. 5장을 붙이고 바로 전송한 뒤 다음 메시지를 입력한다 | 창이 전송을 누른 뒤 원본을 다시 읽어 썸네일 5장을 만들고 나서야 송신한다(`composerSubmit.ts:42-43`). 그동안 입력창은 비지 않는다. 선택 직후 칩 미리보기는 원본 전체 data URL이다 | 첨부 직후 워커가 픽셀 예산 안에서 썸네일을 만들어 칩에 보인다. 전송을 누르면 썸네일을 기다리지 않고 원본 5장이 같은 순서로 송신을 시작하고 입력창이 비어 다음 입력을 받는다. 그때 준비된 썸네일만 버블에 붙고 미준비·실패 이미지는 재시작 뒤에도 파일로 보인다(D-009) |
| **계획 댓글**. 긴 계획에서 두 문단에 걸쳐 코멘트를 달고 폭을 끈 다음, 목록에서 화면 밖 댓글을 다시 연다 | 폭이 바뀔 때마다 모든 댓글을 문서 처음부터 찾아 rect를 읽는다 | 본문 revision에 묶은 오프셋 색인으로 같은 인용을 찾고 가시 부분만 프레임당 한 번 잰다. 목록 선택은 원 위치로 스크롤한 뒤 해당 댓글을 연다 |
| **탐색·카탈로그**. 고정한 세션과 최근 세션을 보다가 프로젝트를 고정하고 산출물을 두 단어로 검색한다 | 창이 전체 목록에서 고정 섹션·순서와 일치 결과를 만든다. 본문 검색은 별도 150ms 지연·최대 30건 | 화면의 행만 그린다(§10 VL — 같은 스크롤 위치·선택 ID 유지). DB·전송이 병목으로 측정된 화면만 data가 같은 정렬·필터를 페이지로 반환하고, 고정 변경 뒤에도 선택 ID와 위치를 보존한다(D-004c) |
| **설정**. 스킬·MCP·모델 목록을 바꾸고 공급자 JSON을 붙여넣거나 가져온다 | 창에서 정렬, 입력마다 settings JSON 전체 파싱(`EngineFormModal.tsx:80`), 가져오기 codec 실행(`ProviderForm.tsx:173`) | 계산이 예산 안이면 유지한다. 초과하면 같은 codec을 워커에서 실행하고 마지막 편집 revision의 결과만 같은 폼에 채운다. 작은 입력, 엔진 선택과 오류 설명을 보존 |
| **예약**. 실행 이력을 열고 실패한 실행의 긴 로그를 읽는다 | 최근 실행 최대 20건의 저장 출력을 함께 싣고 각 출력 전체를 `pre`로 그린다 | 기본은 같은 전체 응답에서 상세 DOM을 늦게 만든다. 숨은 출력의 DB 읽기·전송이 병목으로 측정되면 목록에는 상태·짧은 끝부분만 싣고 선택한 실행만 출력을 읽는다(D-004d). 저장 때 잘린 앞부분은 절단 표시가 남는다 |
| **차트·로그·입력 높이** | 기간 전환은 창에서 일/주 집계 후 차트를 그리고, 설치 출력은 올 때마다 맨 아래로 이동한다. 긴 입력도 값마다 높이를 읽는다 | 차트는 실제 병목 구간만 바꾸고 포인터·총계를 보존한다. 설치 로그에서 위로 읽던 문장은 유지하고 하단으로 돌아가면 새 출력을 따른다. 보이는 입력은 폭·최신 값에 맞춰 커지고 숨은 입력은 다시 보일 때 갱신한다 |
| **셸**. 앱을 열고 자산을 읽고 창을 닫았다가 다시 연다 | 확장자가 있는 경로는 동기 파일 확인을 거친다. 최초 설정 승계·종료 시 위치 저장·정상 주기 및 장애 로그 쓰기 주체는 각각 다르다 | 비용이 확인된 작업을 먼저 줄인다. SPA 직접 진입, 누락 자산의 기존 fallback, 이전 창 위치·언어, 종료 직전까지 기록된 로그를 그대로 복원한다 |

**전이.** 입력·페이지·JSON 요청은 세션/폼/작업과 세대를 함께 갖고 로딩→결과·빈 결과·기존 오류 표시로 간다. 뒤늦은 이전 응답·닫힌 팝오버의 응답은 폐기하고, 실패 뒤 같은 현재 입력으로 재시도한다. 설치 종료는 마지막 출력 → done/error → 버튼 상태 순서를 지킨다.

**첨부 썸네일 상태.** 첨부마다 `준비 중 → 준비됨 | 없음` 하나를 갖는다. 실패·형식 불명·예산 초과·워커 차단은 `없음`이고 칩은 파일로 보인다. 전송이 수락되면 그 순간 `준비됨`만 버블로 가고 `준비 중` 작업은 취소된다. 전송이 거부되면 초안·첨부·작업이 그대로 남는다.

## 6. 범위와 단계 경계

T20 메뉴, T21 잔여, T24 댓글, T28 목록, T29 설정, T30 예약 목록·이력, T31 사용량, T32 설치 로그, T33 입력 높이와 S-D10의 셸 세 항목을 맡는다. T28은 상단 본문 검색의 결과·순서·스니펫과 일반 대화 목록의 선택 동작을 보존한다. T27 산출물 **본문**, T33 테마는 C의 범위다.

| 경계 (D-008) | 0328이 하는 일 | 다른 단계가 소유 |
|---|---|---|
| 0325 A · 첨부 | 썸네일 생성 위치·시점, 송신 시점(D-009·D-010) | 원본 송신·실패 시 파일 표시·동시 작업 ≤2(0325 D-012·D-041·AC17·AC18) → VP-24 회귀 |
| 0326 B · 세션·transcript | 즉시 송신이 만든 사용자 버블이 기존 순서·하단 추적으로 들어가는지 | 세션 저장소·뷰포트·선택 가드(0326) → VP-26 회귀 |
| 0327 C · 워커·가시 행 | 이미지·JSON 작업 배치, 목록·로그의 가상 행 재사용(행 ID 인자 추가) | 레인·대기열·취소(0327 D-008·D-016·D-024), Markdown·diff·가시 행 → VP-27 회귀 |
| 0329 E · 검색 결과 | 상단 검색의 결과·순서·스니펫과 선택 ID를 S-D4에 기록 | 결과를 누른 뒤 메시지 도착·행 강조 → [0329 AC6·S-E5](../0329-turn-history-paging/plan.md) |
| 0330 W · 장비 판정 | Windows 전용 결과를 AC12 인계 항목으로 표시 | 목표 장비·허용치·최종 판정 → [0330](../0330-windows-responsiveness-verdict/plan.md) |

0320의 `ScheduleTaskModal.save` 중복 저장과 `shell-runner`의 프로세스 종료 조건은 조회 전용 T30 경로에 없다. 0327의 완료된 대형 Markdown 블록 후보·0326의 승인 순서 후보는 이 계획에서 승격하지 않는다. D에서 0327의 공유 워커를 쓰는 지점만 실제 규약과 대조한다.

## 7. 요구와 인수 기준 (R ↔ AT)

ID n의 R-n·AT-n은 같은 행을 가리킨다(AC2a·AC2b는 R-02a·R-02b). 조건부 이주는 진단 입력과 분기 근거(§19 R-H·R-W·R-R)를 남긴다. 기준 안인 화면은 동작과 실측을 기록한 뒤 종결할 수 있다.

| AC | 행동 기준 | 검증 입력 → 관측 / 실제 경로 |
|---|---|---|
| AC1 | 열린 메뉴가 외부 생성/삭제/이름 변경을 data 통지(D-004a)로 반영하고, 재방문·감시 중단 후에는 디스크와 재대조한다. 키보드·초점·앵커와 완성 파일 토큰의 유효성을 보존. prefix/limit 조회는 R-H가 켠 경우에만 있고 결과 순서·장식이 전체 목록 경로와 같다 | S-D1. 대/소문자·숨김 점·따옴표 경로·늦은 prefix·후보 밖 파일·슬래시·plugin·모델 → 실제 메뉴의 ID/순서·토큰·커서. §10 Q20 F1~F6 |
| AC2a | **다음 입력 가능** — 전송이 수락되면 같은 입력 처리 안에서 초안·첨부가 비고 초점이 입력창으로 돌아온다. 썸네일 작업이 보류돼 있어도 기다리지 않는다. 거부·IME 조합 중에는 초안·첨부를 보존 | S-D2. 미리보기 응답을 보류한 워커로 5장 즉시 전송 → 같은 task의 초안 revision·첨부 수·초점, 이어 친 후속 초안이 늦은 썸네일 응답 뒤에도 남는가. EP2 ⑤ |
| AC2b | **원본 송신 시작** — 전송 시점의 원본(경로/inline)이 입력 순서대로 `onSend`에 한 번 들어가고, 뷰에는 그 순간 `준비됨` 썸네일만 붙는다. `준비 중`·`없음`은 미리보기 없는 파일 뷰이며 저장 뒤 다시 열어도 같다(D-009) | S-D2. 준비됨 2·준비 중 2·실패 1, 같은 이름 교체, 거부 → `onSend` 인자 원본 bytes/ID·순서, 뷰의 `previewDataUrl` 유무, 저장된 첨부 파트. EP2 ⑤⑥ |
| AC3 | 인용의 UTF-16 시작·끝과 클릭 위치를 보존. 같은 프레임의 폭 변화는 한 번, 화면 밖 주석 rect는 읽지 않음. 오버레이·팝오버 텍스트는 본문 offset에 섞이지 않는다. 저장 댓글 인용과 일시 브라우저 선택을 따로 보존 | S-D3. 문단·링크·이모지·동일 인용 2곳, 생성·취소·편집·원문 교체, 화면 밖 댓글 열기 → 실제 선택/버튼/편집 팝오버. EP3 |
| AC4 | 프로젝트·세션·고정 목록·전역 산출물 필터·순서·검색 선택이 유지됨. 페이지 조회는 R-H가 그 화면에 켠 경우에만 있다(D-004c) | S-D4. 결과 경계에서 고정 전환·삭제·중복 제목·두 단어 검색·이전 쿼리 지연 → 화면 ID 순서와 전건 기준 일치(페이지면 결합 ID). Q28·VL |
| AC5 | 큰 설정·카탈로그에서 정렬·선택·폼 오류·마지막 편집 보존. settings JSON 입력 검증과 가져오기는 기존 codec 결과와 같고 마지막 편집 revision만 폼에 반영 | S-D5. 유효/깨진 JSON·지원/미지원 npm·늦은 결과·빈 목록·연속 입력 → 저장 전 폼 값/오류와 원래 순서, 비밀값 로그 부재. EP5 |
| AC6 | 예약 목록·실행 이력·보관 출력·절단·실행 버튼의 기존 의미 보존. 목록/상세 분리는 R-H가 켠 경우에만 있다(D-004d) | S-D6. 없음·성공·실패·건너뜀·출력 없음·동명 작업·상세 전환 → 표시한 실행 ID, 보관된 끝부분 및 절단 상태가 DB와 일치. Q30·VL |
| AC7 | 기간/모델 총계, 일·주 단위, 포인터 값을 유지하고 첫 commit과 paint를 분리 | S-D7. 자료 없음, 7일·30일·전체 90/91일·730일 이전 자료 → 제품 화면 합계와 차트 자료. EP7 |
| AC8 | 로그 폭주 때 읽던 위치, 종료·오류 순서와 실행 중 전체 출력을 보존 | S-D8. 줄 경계 없는 큰 조각·분할 줄·빈 log·오류+done·재시작 → archive 연결값·화면 tail·첫 이벤트/마지막 이벤트 순서. EP8 |
| AC9 | 가시 입력은 최신 내용과 폭에 맞고 숨김→표시 뒤에 복원. 선택·한글 조합·팝오버 위치 유지 | S-D9. 긴 줄·삭제로 축소·연쇄 수정·폭 변경·숨김·언마운트 → 높이·포커스·측정 횟수. EP9 |
| AC10 | 기존 자산과 deep link·누락 경로가 동일 콘텐츠를 연다. 비용 초과 시 동기 존재 확인을 정상 요청에서 제거 | S-D10a. 존재 CSS, 누락 CSS, 확장자 없는 경로, 루트 → protocol.handle 결과의 본문/형식. EP10 |
| AC11 | 레거시 언어·위치 승계, 창 닫기 복원과 종료·장애 기록 보존 | S-D10b/c. 낡은 키·없음·손상·일반/최소/최대 창·주기 flush 중 quit/fatal → 재시작 값과 실제 로그의 순서·개수. EP11 |
| AC12 | 항목별 입력·전후 빌드와 EP12 측정표의 항목(시간 구간 6 · 개수 2 — 단위·시작→끝 고정), 유지/변경 결론과 근거 규칙(R-H·R-W·R-R), 미측정을 분리한다. 구간이 빠진 행은 `판정 불가`로 남기고 유지로 세지 않는다. Windows 전용 결과는 0330 인계 항목으로 표시 | S-D1~10 전부. §19 측정 규약 → 결과표 `measure-stage-d` 산출, 사람 실기. 실제 설치 로그(terminal-only)와 진단 폭주는 다른 표. EP12 |
| AC13 | 이미지 썸네일 작업이 다른 가시 작업을 R-W 기준 이상 막지 않는다. 작업은 헤더 치수로 픽셀을 검사한 뒤에만 decode하고, 성공·실패·취소·워커 오류 모든 경로에서 레인 슬롯을 돌려준다. 원본 송신은 작업 상태와 무관 | S-D2 겹침(큰 이미지 × 답변 스트리밍 × Git 스크롤) → visible 작업 대기, 예산 초과·손상 헤더의 decode 0, 종료 경로별 다음 작업 시작. WL·EP2 ②③ |
| AC14 | 가상 행을 쓰는 목록·로그는 실제 스크롤 컨테이너 기준으로 창을 계산하고, 행 삽입·삭제 뒤에도 같은 행 ID에 같은 높이·선택 상태가 붙는다. 새 행이 마운트되면 그 목록 안의 진행 중 드래그 선택만 취소한다 | S-D4·S-D6·S-D8. 맨 위 고정 추가·경계 행 삭제·로그 앞부분 스크롤 중 드래그 → 화면 ID 순서, 측정 높이 대응, 목록 밖 선택 보존. §10 VL |
| AC15 | **초안 보존(ΔV1)** — 세션을 바꿔도 초안 텍스트와 첨부 칩·진행 중 썸네일 작업이 함께 남고, 늦게 끝난 썸네일은 그 첨부에 기록된다. 전송하면 그때 활성 세션으로 원본·준비된 뷰가 간다 | S-D2. 첨부 2장(준비 중 1·준비됨 1)과 텍스트 입력 → 세션 A→B 전환 → 보류 응답 해소 → B에서 전송 → 칩 수·썸네일 상태, `onSend` 인자와 대상 세션. EP2 ⑥ |

## 7-A. Baseline V · 노드와 검증쌍

R-n/AT-n ↔ VP-n(n = 1·3~12)은 §7 각 행이고 모두 NEW/REQUIRED다. AC2a ↔ VP-02a, AC2b ↔ VP-02b, AC13 ↔ VP-28, AC14 ↔ VP-29, AC15 ↔ VP-31다. 그 행의 실제 진입점·입력·판정은 §7, 자리와 테스트 좌표는 §10의 같은 AC 행, 실기 조합은 §19의 같은 시나리오다. AC12는 실행 측정 기록 자체를 대상으로 한다.

| Pair | 노드(좌↔우) / 출처 | requiredness | 실제 경로 / 직접 증거 / 강제 지점 |
|---|---|---|---|
| VP-02a·02b | R-02a·R-02b ↔ AT-02a·AT-02b · NEW (rev 4 분리) | REQUIRED | 전송 키/버튼 → `submit` → `onSend`(원본·준비된 뷰) → 수락 → 초안 clear·초점. EP2 ⑤⑥ |
| VP-13 | SD-01 ↔ ST-01 · NEW | REQUIRED | 사용자 입력·전환 → 요청 세대 → 응답·취소 → 선택 또는 오류. §10 Q20·Q28·Q30·EP5 |
| VP-14 | SD-02 ↔ ST-02 · NEW (rev 4 · ΔV1 갱신) | REQUIRED | 사진 선택·paste/drop → 워커 썸네일(칩) → (세션 전환 시 유지) → 즉시 전송(준비된 뷰만) → 수락/거부 → 버블/초안 → 세션 재열기. EP2 전 자리 |
| VP-15 | SD-03 ↔ ST-03 · NEW | REQUIRED | 댓글 선택/폭·스크롤 변경 → 가시 측정 → 클릭·편집 / 긴 설정 입력 → 높이 조절. EP3·EP9 |
| VP-16 | AR-01 ↔ IT-01 · NEW (rev 4 · ΔV1 갱신) | REQUIRED | data·agent 소유 조회·폴더 변경 통지(D-004a — 사건 묶기·같은 창 중복 제거) → 포트 → 메뉴(같은 폴더 통지만 재조회)/목록·예약/차트 UI, 구 호출도 실행. Q20 F1·F2·F6·Q28·Q30·EP5·EP7 |
| VP-17 | AR-02 ↔ IT-02 · NEW (rev 4 갱신) | REQUIRED | 첨부별 원본 → base64 문자열 → 실제 워커 레인 요청·응답 → 첨부 썸네일 상태 → 칩·송신 뷰. EP2 ②~④·WL |
| VP-18 | AR-03 ↔ IT-03 · NEW | REQUIRED | 설치 어댑터 → agent 상태 전송 → R 구독 → 로그 화면·최종 상태. EP8 |
| VP-19 | AR-04 ↔ IT-04 · NEW | REQUIRED | 셸 요청·기동·창 닫기·flush → 실제 파일 → 다시 열기. EP10·EP11 |
| VP-20 | MD-01 ↔ UT-01 · NEW (rev 4 갱신) | REQUIRED | 형식별 헤더 치수/픽셀 → decode 또는 `없음` → 레인 슬롯 해제. EP2 ②③·WL ③ |
| VP-21 | MD-02 ↔ UT-02 · NEW (rev 4 갱신) | REQUIRED | 본문 ref·UTF-16 경계·revision/가시 범위 → 인용/rect/측정 예약. EP3, EP9 |
| VP-22 | MD-03 ↔ UT-03 · NEW | REQUIRED | 질의·정렬·cursor·변경 ID·세대 → limit과 결과, JSON→폼, 일/주 경계. Q20·Q28·Q30·EP5·EP7 |
| VP-23 | MD-04 ↔ UT-04 · NEW | REQUIRED | 출력 조각 → archive/tail/terminal + 스크롤 anchor, 재시작. EP8 |
| VP-24 | SD-04 ↔ ST-04 · INHERITED (0325 AC17·AC18·D-012·D-041, 0324 셸 상태) | REGRESSION | 원본 전송/썸네일 실패 → 파일 뷰, 동시 작업 ≤2, 원본 data URL 대체 금지 · 셸 재실행 시 승계값 복원. EP2·EP11. 기대 변경은 §10 EP2 아래 표 |
| VP-25 | AR-05 ↔ IT-05 · NEW | REQUIRED | 시나리오 입력 → 실제 앱/진단 빌드의 EP12 측정표 항목 → S-D 기록·R-H/R-W/R-R 판정 → W 인계. EP12 |
| VP-26 | SD-05 ↔ ST-05 · INHERITED (0326 세션 저장소·transcript 뷰포트) | REGRESSION | 즉시 송신 → 낙관적 사용자 버블(첨부 파트) → `message.committed` → 하단 추적/읽던 위치 → 비활성 세션 격리. `chatReducer.parts.test.ts` ‘커밋 user 메시지의 attachmentViews 가 attachment 파트로 들어간다’·‘attachmentViews 가 없으면 attachment 파트가 생기지 않는다’ · `chatStore.test.ts` ‘비활성 세션의 이벤트는 그 엔트리에 백그라운드 누적되고 활성 엔트리는 불변’ · `TranscriptViewport.prepend.test.ts` ‘replays latest turn, bottom placement …’ + EP2 ⑥ |
| VP-27 | AR-06 ↔ IT-06 · INHERITED (0327 레인·대기열·가시 행·패널 선택) | REGRESSION | 요청 → 레인별 실행 1·우선순위·실행 중 취소 비종료 → 가시 행 마운트 알림 → 선택 취소. `client.lanes.test.ts` l1·l2 · `client.queue.test.ts` q1·q5·q6·q7 · `useVirtualRows.test.ts` · `rowMount.test.ts` · `usePanelSelection.test.ts` ps1~ps17. 이 파일들이 green이고 기존 호출부(키 인자 없음)의 동작이 같아야 한다 |
| VP-28 | R-13 ↔ AT-13 · NEW | REQUIRED | 첨부 → 레인 배치(R-W) → 픽셀 검사 → decode/거절 → 슬롯 해제 → 다음 작업. WL·EP2 ②③ |
| VP-29 | R-14 ↔ AT-14 · NEW | REQUIRED | 목록 데이터 → 실제 스크롤 컨테이너 → 행 ID 키 창 → 마운트 알림 → 그 목록 안 선택 취소. §10 VL |
| VP-30 | MD-05 ↔ UT-05 · NEW | REQUIRED | `useVirtualRows`의 행 ID 키 선택(인자 있음/없음) → 측정 캐시·`useMountedRows` 키. VL ①② |
| VP-31 | R-15 ↔ AT-15 · NEW (ΔV1) | REQUIRED | 첨부·텍스트 입력 → 세션 전환 → 썸네일 응답 → 전송 → 활성 세션 `onSend`. EP2 ⑥ |

오라클이 배선이나 횟수를 확인하는 EP2(픽셀 검사 위치·준비된 뷰만), EP3·EP9(가시성), EP8(종료 전 flush), EP12(실제/진단 표식), WL(레인 배치), VL(행 키)은 §10에 명시한 자리 변이를 추가한다. 그 밖의 쌍은 서로 다른 관측값을 비교하는 직접 행동 시험과 저장소의 열거 sweep을 사용한다. `git diff --check`, 문서 링크·표·보드·커밋 trailer 및 이후 구현의 subtree/통합 gate는 §19에 둔다.

# Part II · 기술 설계

## 8. 조사 · 기준 트리와 관측값

경로는 다른 표시가 없으면 `app/src` 기준이다. 아래 수치는 설계 판단용이며 최종 Windows 판정은 §19 입력으로 별도 수행한다.

| 입력·권위 경로 | 이 브랜치에서 확인한 사실 |
|---|---|
| T20 · `features/chat/hooks/useMentionAutocomplete.ts`, `lib/mentionAutocomplete.ts` (renderer), `main/features/chat/scan.ts` | 파일을 디렉터리 우선으로 정렬·숨김/대소문자 prefix 필터 뒤 최대 8개. 방문 디렉터리의 전체 파일은 완성 토큰 장식에도 사용. plugin ID·슬래시·모델 목록의 의미가 다르다 |
| T21 · `useAttachments.ts`, `attachmentViews.ts`, `imageThumb.ts`, `composerSubmit.ts` | 선택 미리보기는 path read 또는 inline 원본 URL. 송신 전 소스에서 다시 뷰 생성, 전송당 2 lane, 현재 DOM canvas JPEG quality 0.8·긴 변 256. 픽셀 예산 없음 |
| T24 · `planCommentDom.ts`, `PlanCommentOverlay.tsx`, `PlanTileContent.tsx`, `usePlanCommentSelection.ts` | offset 양 끝마다 TreeWalker, 텍스트 노드별 Range rect. ResizeObserver는 모든 저장 댓글과 draft 재측정. 활성 댓글 직접 열기·신규 선택도 같은 본문 좌표 사용 |
| T28 · `navSections.ts`, `SearchModal.tsx`, `artifactCatalogStore.ts` | 고정 세션 → 고정 프로젝트 → 최근, 중복 소속 제거. 본문 검색은 150ms·30건. 산출물 전역 검색은 제목·파일명·세션명에 검색어 전부 일치 |
| T29 · `CustomizeList.tsx`, `customProvider.ts:23`, `EngineModelList.tsx` | 목록 정렬·모델 행 렌더·JSON.parse와 지원 npm 필터가 창에서 실행. 원본 JSON의 apiKey와 headers가 폼으로 들어간다 |
| T30 · `main/features/scheduled-tasks/{limits,service}.ts`, `RunHistory.tsx` | 실행별 끝 64 KiB, 50회 보관, 한 조회 20회. 저장 출력 상한과 메뉴의 DOM/IPC 발췌 상한은 별개. 상세 바뀐 뒤 늦은 응답을 버리는 코드가 있다 |
| T31 · `shared/usage/stats.ts`, `UsageTab.tsx` | 최대 730일 차트, 전체 선택·90일 초과면 주 집계. 표시되는 차트 cap과 전체 금액·토큰 합계를 구분한다 |
| T32 · `main/app/handlers/misc.ts:88`, `main/adapters/claude/adapter.ts:410`, `InstallerDialog.tsx` | agent `installStart`가 어댑터 결과를 `installStatus`로 전달. Claude 실·mock은 각각 완료만, OpenCode는 실패 종료만 반환. 창은 log마다 문자열 누적·scrollHeight 후 강제 하단 이동 |
| T33 · `shared/ui/AutoGrowTextarea.tsx:29`, `PlanCommentPopover.tsx:60` (renderer) | `style.height='auto'` 뒤 `scrollHeight`로 높이를 다시 쓰는 입력 구현은 두 곳. 일반 설정 사용처와 댓글 팝오버. 포커스·닫기·IME를 보존 |
| 셸 · `main/index.ts:194,244,481`, `app/shell/shell-state{,-file}.ts`, `infra/log/file-transport.ts:66` (main) | 자산 경로에서 existsSync. 레거시 설정은 자체 유효 기록이 없을 때 읽고 언어·위치 일부라도 유효할 때 승계. 일반 창 close에서 위치 저장. 평상시 flush 타이머(500ms), shutdown/fatal의 즉시 flush를 구분 |

### 8-A. 기준선 재대조 (rev 4 · `c7d2adf2`)

**위 표의 사실은 `c7d2adf2`에서 유지된다.** rev 3 설계 커밋의 부모 `3271121`부터 D 영향 파일은 바뀌지 않았고 인용 줄도 그대로다. 아래는 PR #640 항목을 닫으려고 새로 확인한 사실이다.

| ID | 대상 / 검색 | N | 의미 |
|---|---|---|---|
| A1 | `git cat-file -t 62125eaa` (`origin/main` depth 300 · PR 브랜치 depth 451 fetch 후) | fatal | rev 1~3 기준 좌표는 공유 브랜치에 없다. 설계 커밋 `c72bcaf`의 부모는 `3271121` |
| A2 | `git diff --numstat 3271121 HEAD -- <§18 D 영향 파일>` | 43파일 중 0 변경 | 0327 구현은 D 파일을 건드리지 않았다. 0327 변경 106파일은 compute·diff·가상 행이다 |
| A3 | §8 인용 줄 12곳(`misc.ts:88` · `adapter.ts:410` · `AutoGrowTextarea.tsx:29` · `PlanCommentPopover.tsx:60` · `index.ts:194,244,481` · `file-transport.ts:66` · `customProvider.ts:23` · `ComposerInputController.tsx:230–235` · `ipc.ts:62` · `files.ts:93–96`) | 12/12 일치 | 줄 번호 갱신 불필요 |
| A4 | `composerSubmit.ts:42-43` | 1 | `await buildAttachmentViews(items)` 뒤에 `onSend` — 썸네일 5장이 끝나야 송신·초안 clear |
| A5 | `main/features/chat/attachments.ts:169-176` · `chat-turn/send.ts:135-138` | 2 | 송신 때 창이 준 `previewDataUrl`을 저장 뷰로 복사한다. 송신 뒤 미리보기를 보강하는 경로는 없다(D-009 근거) |
| A6 | `useAttachments.ts:51-60` · `:93-97` | 2 | 칩 미리보기 키가 `${name}-${index}`이고 값은 원본 전체 data URL. path 원본은 첨부 때 한 번, 송신 때 `attachmentViews.ts:22`에서 또 읽는다 |
| A7 | `shared/compute/protocol.ts:46,81-83` · `client.ts:391-397` · `client.ts:47` | 3 | 레인은 `compute`·`markdown` 둘, 레인마다 실행 1. 대기열은 우선순위→양보→크기→도착 순이며 선점이 없다. `postMessage`에 전송 목록 인자가 없다 |
| A8 | 0327 D-024 · `client.queue.test.ts` q6 | 1 | 실행 중 취소는 워커를 끝내지 않는다(jsdiff `diffView` 제외). compute 레인의 긴 decode는 뒤의 visible Git 작업을 그 시간만큼 세운다 |
| A9 | `shared/ui/virtual/useVirtualRows.ts:32-45` · `rowMount.ts` · `FileDiffSection.tsx:453` | 3 | `useVirtualizer`에 `getItemKey`가 없어 키·측정 캐시가 인덱스다. Git 패널은 `useMountedRows(row.id)`를 따로 부른다 |
| A10 | D 목록 스크롤 컨테이너 `rg -n 'overflow-y-auto\|overflow-auto'` | 6 | `app/Sidebar.tsx:156`(고정 세션·고정 프로젝트·최근 세 섹션 공유) · `ProjectsScreen.tsx:59` · `ArtifactsView.tsx:79` · `SchedulesScreen.tsx:111` · `RunHistory.tsx:98`(실행별 `pre`) · `InstallerDialog.tsx:88`(+ `:44` 강제 하단) |
| A11 | `PlanTileContent.tsx:169-185` · `planCommentDom.ts:43` | 2 | `contentRef`가 Markdown 본문·오버레이·팝오버를 함께 감싸고 TreeWalker가 그 전체 텍스트를 걷는다 |
| A12 | `EngineFormModal.tsx:80` · `ProviderForm.tsx:162-186` | 2 | settings JSON은 입력마다 `validateSettingsJson` 전체 파싱, 가져오기는 `importRevision`으로 늦은 결과를 버린다 |
| A13 | `node -e` 2만 개 `{name:'file-N',isDirectory:false}` JSON 길이 | 828,891 | 1초 재조회 폴백이면 메뉴가 열린 동안 매초 이만큼 전송(D-004a 근거) |
| A14 | §10 술어 원시 적중 재실행 | 표 아래 | EP3 73/23 · EP9 43/17은 0327의 `useDiffScrollCoordinator`·`useVirtualRows`·`FileDiffSection` 추가분이며 D 자리가 아니다. EP11 45/11 · EP12 18/10은 `3271121`과 같고 rev 3 수치는 A1 기준이라 재현 불가 |

### 측정 방법과 값

Linux Node v24.19.0, 실제 소스 entry를 esbuild CJS로 번들해 호출. M1·4~7은 1회 예열 뒤 9회 중앙/최대(ms), 입력 생성 제외. M6은 React 서버 렌더까지다. 브라우저 항목은 Chromium 154 headless, 900×670, 실제 DOM을 사용했다.

| ID | 입력과 실행 진입점 | 관측 |
|---|---|---|
| M1 | `groupMentionSuggestions(parseMentionToken('@file-',6),[],entries)`, file-0…19999 | 8개, 1.824 / 3.662ms |
| M1b | React·실제 `useMentionAutocomplete`를 Chromium에 마운트, IPC만 실제 `listDir`에 직접 연결. 임시 폴더에서 `before.txt` 조회 → 삭제, `new-file.txt`와 `new-dir/` 생성 → 같은 창/폴더에서 토큰 지우고 다시 입력 | 독립 `listDir`는 새 2개. 같은 훅에서 `@new`는 0개, `@bef`는 삭제한 파일 1개, 조회 누적 1회. 훅 재마운트 후 `@new`에 폴더·파일 2개, 누적 2회 |
| M2 | `downscaleDataUrl`, 4032×3024 단색 PNG 1장(321,986자), 동일 URL로 4회 | 처음 106.3ms, 재사용 3.9·2.3·2.4ms, 결과 각각 1,419자. decode 대기를 포함한 **경과 시간** |
| M3 | 600px 컨테이너에 50자 문단 N개. 주석 j의 시작은 `floor((N-1)*j/개수)*50+8`, 길이 10. `rangeFromOffsets → rectsForRange` 1회 예열+5회 | 100문단/8댓글 0.2/0.8ms, 100/128 3.3/6.7, 2,000/8 1.3/1.4, 2,000/128 20.9/21.6. 매 주석에 실제 rect 1개 |
| M4 | `splitNavSections`, 10,000세션, 매 10번째 pinnedAt, 프로젝트 없음 | 고정 1,000/최근 9,000, 4.953 / 10.263ms |
| M5 | `importedProviders`, 지원 npm 하나·모델 id와 이름 10,000쌍, 생성 JSON 307,845자 | 모델 10,000개, 9.044 / 12.701ms |
| M6 | `renderToStaticMarkup(RunHistory)`, 성공·절단 실행 20개 × 65,536 ASCII 문자 | HTML 1,321,710자, 6.040 / 18.014ms |
| M7 | `fillDailySeries → aggregateWeekly`, 2024-01-01부터 730일 연속, 일별 토큰 네 값 1·2·3·4, 마지막 날 기준 | 730일 → 105주, 1.765 / 2.788ms |
| M9 | 480px 폭·최대 높이 200px 실제 textarea에서 한글 문자열을 바꾸고 제품과 같은 `height='auto' → scrollHeight → height`. 1회 예열+5회 | 2,000자 중앙 4.7/최대 5.4ms, 20,000자 87.1/261.5ms. 컴포넌트가 아닌 DOM 연산 분리 측정 |

**파일을 읽는 시점.** 현재 `composer/ComposerInputController.tsx:230–235`가 활성 대화의 cwd를 전달한다. `useMentionAutocomplete.ts:93–125`는 방문하지 않은 디렉터리에서만 `files.list`를 호출하고 조회 실패도 빈 배열로 저장한다. cwd가 바뀌면 같은 훅의 캐시를 비운다(47–53행). `main/app/handlers/files.ts:93–96`에서 호출하는 `main/features/chat/scan.ts:15–29`는 Node `fs.promises.readdir(target,{withFileTypes:true})`로 직속 항목을 읽고, 이 경로에서 shell의 `ls`나 항목별 `stat`를 실행하지 않는다.

**보이는 범위.** 현재 폴더의 일반 파일·디렉터리가 대상이다. 하위 파일은 `@src/이름`으로 탐색하고, 점으로 시작하는 이름은 `@.`처럼 해당 이름의 접두사에 점을 넣는다. 디렉터리 우선 정렬 뒤 대소문자 무시 접두사 일치 중 최대 8개를 보이며 symlink 항목은 제외한다. 이 경로는 Git ignore 패턴을 읽지 않는다(`mentionAutocomplete.ts:45–60`, `scan.ts:15–29`).

### 제품 레퍼런스 · VS Code 1.100.0

| VS Code 원문에서 확인한 동작 | Orca D에서 적용하는 범위 |
|---|---|
| 디스크 제공자는 `readdir({withFileTypes:true})`로 이름과 형식을 얻는다. 일반 항목은 Dirent로 형식을 결정하고 링크만 `stat`로 대상 형식을 확인한다. [DiskFileSystemProvider](https://github.com/microsoft/vscode/blob/1.100.0/src/vs/platform/files/node/diskFileSystemProvider.ts#L102-L125) | T20은 직속 폴더를 처음 열 때 읽고 prefix 타이핑에는 메모리의 후보를 사용한다. Orca는 기존 symlink 항목 제외·점파일·8개 표시 규칙을 유지한다 |
| Explorer는 파일 변경 사건을 모아 표시 중인 모델에 영향을 주는 삭제와 새 자식 추가를 확인한 뒤 갱신한다. 감시 대상이 사라진 경우 기존 watcher 또는 `watchFile`로 복구를 감지해 감시를 재개할 수 있다. [Explorer 변경 처리](https://github.com/microsoft/vscode/blob/1.100.0/src/vs/workbench/contrib/files/browser/explorerService.ts#L65-L112) · [감시 복구](https://github.com/microsoft/vscode/blob/1.100.0/src/vs/platform/files/node/watcher/baseWatcher.ts#L147-L232) | T20은 활성 디렉터리 한 단계의 사건을 묶어 다시 읽고, 감시가 끊기거나 창으로 돌아왔을 때 디스크와 재대조한다. 감시 수명·전송과 파일 식별 규칙은 §10 Q20 |
| Quick Open의 파일 검색은 작업공간 폴더와 검색어·결과 상한을 넘긴다. 해당 로컬 파일 검색 경로에는 `rg --files`가 있다. [Quick Access](https://github.com/microsoft/vscode/blob/1.100.0/src/vs/workbench/contrib/search/browser/anythingQuickAccess.ts#L700-L710) · [로컬 검색](https://github.com/microsoft/vscode/blob/1.100.0/src/vs/workbench/services/search/node/ripgrepFileSearch.ts#L20-L34) | T20의 현재 탐색 단위는 `@폴더/접두사`다. 작업공간 전체의 재귀 파일 검색은 별도 제품 기능이다 |
| listView는 이전·현재 가시 범위의 차집합으로 DOM을 추가·제거하고, 크기 변경 observer는 한 animation frame에 한 번 처리한다. [ListView](https://github.com/microsoft/vscode/blob/1.100.0/src/vs/base/browser/ui/list/listView.ts#L898-L916) · [ElementSizeObserver](https://github.com/microsoft/vscode/blob/1.100.0/src/vs/editor/browser/config/elementSizeObserver.ts#L43-L86) | T28·T30의 가시 행, T24·T33의 폭/높이 재측정에 대응한다. Orca의 선택 ID·스크롤 앵커·React UI와 데이터 소유자는 §7 기준을 따른다 |
| 출력 모델은 내용을 추가하는 처리와 가시 화면 갱신을 구분하며 출력 뷰는 스크롤 잠금에 따라 따라읽기를 조절한다. [OutputChannelModel](https://github.com/microsoft/vscode/blob/1.100.0/src/vs/workbench/contrib/output/common/outputChannelModel.ts#L766-L782) · [OutputView](https://github.com/microsoft/vscode/blob/1.100.0/src/vs/workbench/contrib/output/browser/outputView.ts#L141-L161) | T32는 실행 전체의 원문과 화면에 그리는 부분을 구분한다. 사용자가 위로 읽는 위치를 보존하고 Orca의 현행 실행 수명에 맞춰 정리한다 |

## 9. 아키텍처 · 소유권과 데이터 흐름

| 대상 | 현재 → 변경 후보 | 경계 |
|---|---|---|
| 조회 | R 전체 목록 → R 필터/마운트 → 같은 응답·가시 행만 렌더가 기본. R-H가 켠 화면만 data/agent의 제한된 조회(D-004b~d). T20 파일 후보는 data 폴더 변경 통지(D-004a) | `shared/channel-owner.ts`에서 data는 파일·관리/DB, agent는 native 상태. 기존 전건 소비자는 기존 경로 |
| 첨부 | 송신 때 DOM canvas 디코드 → 첨부 때 워커 레인이 헤더·픽셀을 점검하고 작은 JPEG 반환 → R 칩 표시, 송신은 준비된 썸네일만 동기 사용 | OS 대화상자 main, 파일 읽기 data, 원본 첨부의 실제 검증·전송은 기존 agent. D는 표시 사본과 송신 시점만 변경 |
| 워커 레인 | compute·markdown 두 레인(0327) → 이미지 작업을 compute 레인 `background` 또는 신규 `image` 레인(R-W) · JSON 작업은 compute 레인(R-R이 켤 때) | `new Worker(`는 `shared/compute/client.ts`에서만(`check-ui-thread` 규칙 (i)). 레인 규칙은 0327 D-008·D-016·D-024 그대로 |
| 가상 목록 | 전체 행 DOM → `useVirtualRows`(실제 스크롤 컨테이너·행 ID 키) + 목록별 `VirtualRowMountContext` | `shared/ui/virtual`은 shared 레이어 — 도메인 키 규칙은 호출하는 feature가 넘긴다 |
| 주석·높이 | 반복 DOM 탐색 → 본문 색인 + 가시 위치 확인/측정 예약 → 선택 복원 | text node·Range·textarea의 소유자는 R. 배율·레이아웃·폰트는 브라우저에서 관측 |
| 설치 | 어댑터 → agent 묶음 → 기존 상태 채널 → 분할 로그 archive·가시 창/최종 상태 | 설치 진행 중 출력은 해당 실행/다이얼로그 수명 안에 보존. 진단용 로그 파일에 복제하지 않는다 |
| 셸 | protocol, 창·로그 개별 수명주기 → 구간별 비용·조건부 비동기 개선 | main 내부. 호스트 승계·종료 순서/파일 권한·포트 소유자 보존 |

## 10. 계약과 강제 지점

아래 검색은 `app/`에서 `rg -n -g '!*.test*' -e '<술어>' src`로 실행한다. 검색 출력에서 예시·타입 선언·다른 도메인 소비자를 구분한 뒤 아래 **역할과 운반 값**으로 분류한다. 각 행은 위 §7-A의 모든 참조 쌍에 적용한다. 좌표는 구현 때 추가할 테스트의 파일명·진입점이다. UI·레이아웃은 진단 Chromium/Electron에서 실제 DOM·가시 화면으로 관측한다.

| 지점 · 검색 술어 | 계약을 운반하는 자리(번호순) | 직접 oracle · 구별 입력과 관측 |
|---|---|---|
| Q20 · `filesList\|nativeResources\|composerCatalog\|validFilePaths\|Menu\|Autocomplete` | ① data 파일/관리 질의 및 agent native 카탈로그 ② 포트·캐시(cwd·디렉터리·하네스·세대·query key) ③ 메뉴 소비자(파일/스킬/플러그인/모델) ④ 전체 유효 ID 장식·확정 토큰 ⑤ 활성 폴더 watcher→**폴더 변경 통지(D-004a)**→창 무효화·재조회 ⑥ 구독 종료/복구→포트·창 수명 정리 ⑦ prefix/limit 조회 — R-H가 켰을 때만(D-004b), 켜지 않으면 자리 0 + R-H 기록 | 신규 `composer-menu-query.integration.test.ts` + S-D1. 임시 디렉터리와 실제 카탈로그로 ①②, `@src`·`@.s`·따옴표·빈 prefix·슬래시·모델 재조회로 ③④. 9번째 유효 파일 장식·모델 선택과 순서, ⑤⑥의 열린 창 변경/구독 해제/재접속은 아래 F1~F6. ⑦은 같은 입력에서 전체 목록 경로와 후보 ID·순서·장식이 같은가 |
| EP2 · `AttachmentView\|attachmentPreviews\|readAttachment\|image/\|compositionActive` | ① 대화상자·drop·paste→**첨부 수명 ID**(같은 이름·위치라도 추가마다 새 ID) ② 소스(path는 첨부 때 1회 읽기·inline은 보유 base64)→base64 문자열 복제→이미지 작업(WL 레인, `background`, `cacheable:false`, 키=첨부 ID). 비이미지·읽기 실패는 요청 없이 `없음` ③ 워커: 헤더 ≤256 KiB 치수→양의 정수·`w×h ≤ 16,777,216`일 때만 decode→긴 변 256 JPEG. 형식 불명·치수 없음·초과·decode/encode 오류는 `없음` ④ 응답→살아 있는 첨부 ID에만 `준비됨/없음` 기록→칩(원본 data URL 금지) ⑤ submit: 조합 중·빈 텍스트·steer 차단은 송신 안 함. 아니면 같은 task에서 원본 순서 그대로 `onSend`, 뷰에는 `준비됨`만 `previewDataUrl` → 수락이면 같은 task에서 첨부·초안 clear·초점, 거부면 보존 ⑥ 수락 뒤·제거·언마운트→그 첨부의 `준비 중` 작업 취소, 늦은 응답은 버림. 세션 전환은 취소 사유가 아니다 — 첨부·작업이 남고 응답은 그 첨부에 기록(D-013). 저장 뷰는 송신 순간 그대로(A5) | `attachmentThumbs.test.ts`(신규 순수 — ①④⑤ 상태·뷰), `worker/imageHeader.test.ts`(신규 — ③ 바이트 fixture), `ComposerInputController.test.ts` 보강(가짜 compute client로 응답 보류 — ⑤⑥), `gate:xvfb-run -a node scripts/measure-stage-d.mjs`의 S-D2 단계(실 워커 decode ③). 분기 입력은 아래 EP2 입력 표 |
| EP3 · `contentRef\|contentKey\|offsetsFromSelection\|rangeFromOffsets\|rectsForRange\|ResizeObserver` | ① **본문 ref = Markdown 래퍼만**, 오버레이·팝오버는 별도 ref(A11) ② 본문 revision(내용·DOM 교체)→Text 노드 색인(누적 UTF-16 end·node→offset) ③ **저장 댓글** `{start,end}`→색인 이분 탐색→역방향 Range ④ **일시 브라우저 선택**→offset/quote(element 경계는 자식 offset으로 환산)→draft ⑤ 가시 문단∩댓글→프레임당 1회 rect, 화면 밖 0 ⑥ 화면 밖 활성 댓글→문단 이동→다음 프레임 측정→팝오버/초점 | 신규 `planCommentGeometry.browser.test.ts`(진단 브라우저 케이스) + `planCommentIndex.test.ts`(색인 순수), S-D3. ① 오버레이·팝오버에 텍스트가 있을 때 본문 끝 선택 ② 같은 문자열의 새 DOM ③ 저장 댓글만 있는 재열기 ④ 선택만 있고 저장 0 · 링크·이모지·역방향 ⑤ 다른 폭·빈 주석 ⑥ 2,000문단 끝 댓글 열기. 본문/오버레이 ref 맞바꿈, offscreen Range 측정 추가, 동일 인용 두 곳 교환, rAF 병합 제거가 각각 red |
| Q28 · `sessionList\|projectList\|artifactCatalog\|setPinned\|searchMessages\|navSections` | ① data DB 필터/안정 정렬·고정 변경 ② 응답/변경 ID→공유 store ③ nav 섹션·프로젝트 화면·전역 산출물 목록의 가시 선택 ④ 별도 본문 검색→선택 ID/스니펫 | 신규 `catalog-page.integration.test.ts` + S-D4. 임시 DB에서 같은 제목·날짜, 고정 전환, 경계행 삭제, 2검색어·상충 요청, 빈 페이지. 전건 정렬 기준과 ID 순서·중복·선택 ID를 비교 |
| EP5 · `importedProviders\|validateSettingsJson\|CustomizeList\|EngineModelList\|extensionCatalog` | ① 관리·native 자원 조회→정렬/필터/선택 ② 편집 revision→형식 검증 — settings JSON 입력(`EngineFormModal.tsx:80`)·가져오기(`ProviderForm.tsx:173`) ③ 결과/오류→현재 폼→사용자 저장. R-R이 워커를 켜면 ②는 같은 codec 함수를 compute 레인에서 실행하고 요청에 편집 revision을 실어 최신 revision 결과만 ③으로 보낸다 | 신규 `provider-import-flow.test.ts` + S-D5. 정상·지원 안 하는 npm·문법 오류(줄·열 위치)·느린 이전 입력·연속 입력 3회·비밀 표식 입력에서 실제 폼 모델·오류 키, 마지막 선택·로그 필드를 관측. 워커 경로와 창 경로의 결과가 같은 입력에서 같은가 |
| Q30 · `scheduledTask\|listRuns\|outputTruncated\|RunHistory` | ① data 목록/최근 실행·해당 task/run의 보관된 출력 ② 포트→조회 revision·순서 ③ 목록/상세 출력과 절단 표시·다른 session 열기 | 신규 `schedule-history-page.integration.test.ts` + S-D6. 출력 '', 짧음, 65,536바이트·절단 true, 타 task id, 사라진 run, 재탐색. DB 실데이터→DOM/동작으로 비교 |
| EP7 · `usageStats\|fillDailySeries\|aggregateWeekly\|TokensPerDayChart` | ① data 질의·원 집계 ② chart 기간/주 파생 ③ 기간 UI·총합·모델·tooltip paint | `UsageTab.chart.test.ts` 보강 + S-D7. 비연속 날짜·0일·90/91일·730일·과거 합계·누락 모델, DB 원본/표시값 대조. 일 10 토큰과 모델 21 토큰 등 서로 다른 지표 사용 |
| EP8 · `installStart\|installStatus\|InstallStatus\|adapter.install\|installApi.onStatus` | ① agent의 어댑터 스트림→버퍼 ② flush→기존 타깃 포트·done/error ③ installApi 구독→조각 archive/최근 행 ④ 읽는 위치/하단/재시작·완료 콜백 | 신규 `installer-status-flow.integration.test.ts`, S-D8. 가짜 어댑터만 주입, 실제 handler/포트/구독/대화상자 통과. 중간 줄바꿈·65KiB 무개행·두 run·error+done. archive 원문, tail, anchor와 terminal 사건 수 비교. terminal 앞 flush 제거·마지막 조각 순서 교환 시 red |
| EP9 · `scrollHeight\|AutoGrowTextarea\|PlanCommentPopover` | ① 일반 설정 textarea·② 계획 댓글 textarea의 값/폭/가시성→높이 ③ 댓글 overlay의 anchor→팝오버 배치 | 신규 `auto-height.browser.test.ts` + S-D9. 0→20,000자→2자, 숨김→폭 변경→표시, IME 조합·언마운트. 실제 박스 높이·커서/scrollTop 확인. 숨은 노드 측정, 표시 시 무효화 제거를 각각 검출 |
| EP10 · `protocol.handle\|RENDERER_DIST\|pathToFileURL` | ① app URL 경로 해석·기존 root ② 파일 유무→자산/SPA fallback ③ net.fetch→실창 응답 | 신규 `app-protocol.fixture.test.ts` + S-D10a. 고유 내용의 실제 파일/없는 확장자 파일/SPA route/루트, 기존 URL 정책과 응답 본문 비교. 디스크 경계 목을 두지 않는다 |
| EP11 · `windowBounds\|readLegacySettings\|mirrorUiLocale\|flushLogSync\|flushSync\|closeLog` | ① 자체/legacy 읽기→언어·위치 승계 ② 창 close→유효 위치 저장·재시작 ③ file transport 정상 주기·회전→파일 ④ main의 장애/종료→flush·close | 기존 `shell-state.test.ts`, `shell-state-file.cwd.test.ts`, `file-transport.test.ts` 보강 + S-D10b/c. 전용 임시 userData, 정상/최소/최대 창, 불량 JSON, 쓰기 거부, 장애와 quit 직전 다른 순번의 마지막 행. 세대별 실제 파일과 순서 대조 |
| EP12 · `perf.stall\|UI_TASK_BUDGET_MS\|STALL_SEVERE_MS` | ① S-D 입력·설치본/진단 빌드·실제/주입 라벨 ② EP12 측정표의 시간 구간 6·개수 2를 한 상호작용마다 기록(겹치지 않는 구간 — 아래 표) ③ 측정표→R-H/R-W/R-R 판정과 `유지/변경` 근거 · 구간 누락은 `판정 불가` ④ §19 인계표(Windows 전용 표시)→W에서 같은 사례 조회 | 신규 진단 `scripts/measure-stage-d.mjs`(Electron, exit 0/1/3 — `check-transcript-streaming.mjs` 선례) + 순수 판정 `scripts/measure-stage-d.test.mjs`. build ID·입력 크기를 바꾸거나, terminal-only와 주입 폭주 라벨을 맞바꾸거나, 구간 하나를 빼면 판정·비교 불가가 드러나는지 확인. 판정 함수 입력은 아래 R-H·R-R 입력 표 |
| WL · `laneOf\|Lane\b\|createWorker\|imageThumb` | ① 이미지 작업 kind→레인 선택: R-W가 “분리”면 신규 `image` 레인(세 번째 워커, `client.ts`에서만 생성), “유지”면 compute 레인 `background` ② 레인 규칙은 0327 그대로 — 레인마다 실행 1, 우선순위→양보→크기(픽셀 수)→도착 ③ 슬롯 해제: 성공 · 오류 · 대기 중 취소(미전송) · 실행 중 취소(D-024: 끝날 때 결과 버림) · 워커 `error`/`messageerror`(워커 폐기) · 연속 실패 한도(즉시 `없음`) ④ 진단 timings에 lane·priority 기록 | `client.lanes.test.ts`·`client.queue.test.ts` 보강(가짜 워커). ① “분리”: 이미지 실행 중 visible `tokens` 요청이 즉시 compute 워커로 나간다 / “유지”: 이미지가 visible 요청보다 뒤에 선다 ③ 여섯 종료 경로마다 다음 이미지 작업이 시작되고 실행 중 개수 ≤1. 이미지 kind를 markdown 레인으로 맞바꿈·`background` 제거가 각각 red |
| VL · `useVirtualRows\|useMountedRows\|VirtualRowMountContext\|usePanelSelection` | ① `useVirtualRows`의 선택적 행 ID 키 인자 → `getItemKey`와 `useMountedRows` 키. 인자가 없으면 현행 인덱스(0327 호출부 4곳 불변 — VP-27) ② 목록별 실제 스크롤 컨테이너: `Sidebar.tsx:156`(세 섹션 공유 — root≠owner) · `ProjectsScreen.tsx:59` · `ArtifactsView.tsx:79` · `SchedulesScreen.tsx:111` · `RunHistory.tsx:98` · `InstallerDialog.tsx:88` ③ 행 ID: `session.id` · `project.id` · `artifactFileId` · `task.id` · `run.id` · 로그 조각 = 실행 세대+시작 offset ④ 드래그 선택 취소 범위: 목록마다 `usePanelSelection(②의 컨테이너, 목록 종류+필터/쿼리 또는 실행 세대)`의 `notify`를 `VirtualRowMountContext`로 공급 | `useVirtualRows.test.ts`·`rowMount.test.ts` 보강 + 목록별 `*.virtual.test.ts`(신규). ①은 인자 있음/없음 둘 다 · 맨 위 삽입 뒤 같은 ID의 측정 높이 · 같은 개수에서 ID만 바뀐 교체 ③④는 드래그 중 새 행 마운트 → 그 목록 안 선택 취소 / 목록 밖(transcript·다른 목록) 선택 보존. R-R이 가상화를 켜지 않은 ② 자리는 “유지 + 측정값”으로 닫는다. ③ 자리마다 Electron ABI 없이 도는 좌표(목록별 `*.virtual.test.ts`)가 필수이고 `--host`는 보조다(ΔV1 — verify 1 #3). 키 인자 무시·Provider root 맞바꿈·목록별 키 함수를 인덱스로 바꿈이 각각 red |

**EP2 입력 표 — 규칙 칸 분기마다 입력.**

| 자리 | 분기 | 구별 입력 → 관측 |
|---|---|---|
| ① | 같은 이름 재추가 | A·B(같은 이름) 추가 → A 제거 → A′ 재추가: 세 ID가 서로 다르고 B의 썸네일이 A′ 칩에 붙지 않는다 |
| ② | path 성공 / path 읽기 실패 / inline / 비이미지 | 각 1건: 요청 1·0(`없음`)·1·0, 원본 송신 인자는 네 건 모두 그대로 |
| ③ | PNG·JPEG(SOF)·GIF·WebP(VP8/VP8L/VP8X) 정상 / 치수 없음 / 16,777,216px(허용)·16,777,217px(거절) / 본문 손상 / 인코딩 실패 | 정상 4 → `준비됨`, 나머지 → `없음`, 거절 계열의 decode 호출 0 |
| ④ | 제거 뒤 응답 / 송신 뒤 응답 / 두 응답 역순 도착 | 기록 0 · 기록 0 · 각 ID에 자기 결과 |
| ⑤ | 조합 중 / 준비됨2·준비 중2·없음1 / 거부 / 수락 | 송신 0 · 뷰 5개 중 미리보기 2 · 초안·첨부 보존 · 같은 task에 clear·초점(응답 보류 중) |
| ⑥ | 수락 뒤 보류 응답 해소 / 언마운트 / 세션 전환 뒤 응답 해소(ΔV1) | 취소 2건, 새 초안·새 첨부 불변 · 남은 작업 0 · 취소 0, 칩 2개 유지, 응답이 그 첨부를 `준비됨`으로 |

등록 변이(EP2): ③ 픽셀 검사를 decode 뒤로 이동 · ⑤ `onSend` 전에 `준비 중` 작업을 기다리게 되돌림 · ⑤ `준비 중`에 원본 data URL을 미리보기로 넣음 · ④ `준비됨/없음` 결과 맞바꿈 · ⑥ 취소 제거 · ⑥ 세션 전환에 첨부 비움·작업 취소를 다시 넣음(ΔV1).

**EP12 측정표 — 한 상호작용의 구간(rev 5).** 시간 구간은 서로 겹치지 않고, 각 프로세스는 자기 시계로 길이만 잰다(프로세스 사이 시각 비교 없음). 개수는 시간 합에 넣지 않는다.

| 항목 | 단위 | 시작 → 끝 | 측정 지점 |
|---|---|---|---|
| T1 호스트 조회 | ms | 호스트 핸들러가 요청을 받음 → 응답을 반환 | data/agent 핸들러 래퍼(호스트 시계) |
| T2 IPC·수신 | ms | 창 왕복(요청 송신 → 응답 객체 resolve) − T1 | renderer 전송층 호출부(창 시계) |
| T3 창 처리 | ms | 응답 resolve → state 갱신 호출 직전(검증·필터·정렬·파생) | 화면 소비자 |
| T4 React commit | ms | state 갱신을 감싼 `flushSync` 시작 → 반환(render·commit·layout effect 포함) | 진단 하네스(r1 `probe.tsx` 방식) |
| T5 첫 paint | ms | `flushSync` 반환 → 두 번째 `requestAnimationFrame` 콜백 — T4를 포함하지 않는 상한 | 진단 하네스 |
| T6 워커 대기 | ms | `ComputeJobTiming` enqueuedAt → startedAt | compute client — 워커 경유 항목만, R-W 전용 |
| C1 IPC 바이트 | bytes | 응답 직렬화 길이 | 전송층 |
| C2 DOM 행 | 개 | T5 끝 시점 목록 컨테이너에 마운트된 행 수 | DOM 조회 |

응답이 여러 commit으로 나뉘면 T4는 응답 state 갱신부터 결과 행이 DOM에 들어간 commit까지의 합이고 T5는 그 마지막 commit 뒤부터 잰다. 표본은 예열 1회 + 9회이며 판정은 중앙값, 결과표에는 p95·최대를 함께 남긴다.

**R-H·R-R 입력 표 — 판정 함수(`measure-stage-d.test.mjs`) 분기마다 입력.**

| 규칙 | 분기 | 구별 입력(ms, 중앙값) → 기대 |
|---|---|---|
| R-H | 켬 | T1+T2 = 60, T3+T4+T5 = 40 → 켬 |
| R-H | 50 이상이지만 창 쪽이 더 큼 | T1+T2 = 60, T3+T4+T5 = 70 → 끔 |
| R-H | 50 미만 | T1+T2 = 49, T3+T4+T5 = 10 → 끔 |
| R-H | 경계 | T1+T2 = 50, T3+T4+T5 = 49 → 켬 |
| R-H·R-R | 구간 누락 | T2 없음 → `판정 불가`(유지 아님) |
| R-R | longtask | 상호작용 창 안 `longtask` 50ms 1건 → 켬 · 49ms만 → 끔 |
| R-R | 동기 구간 | T3 = 50 또는 T4 = 50(longtask 관측 불가 환경) → 켬 |
| R-R | T5만 큼 | T5 = 80이고 longtask 0 → 끔 — T5는 프레임 대기를 포함한 상한이라 단독 근거가 아니다 |

**ΔV1 기대 변경.** `useAttachments.views.test.ts` ‘does not move a preview to a same-name attachment or retain jobs across session changes’의 세션 전환 단언(스냅숏 비움·작업 취소)은 D-013에 따라 “칩·작업 유지, 응답 기록”으로 바꾼다. 같은 이름 첨부에 미리보기를 옮기지 않는 단언은 그대로다.

**VP-24 기대 변경.** `composerSubmit.test.ts` ‘sends the original attachment array even when a thumbnail fails’·t10, `attachmentViews.test.ts` t1·t5·t6·t8, `imageThumb.test.ts` t9, `useAttachments.views.test.ts` 두 케이스는 송신 때 만들던 썸네일을 첨부 때 워커로 옮긴 위치에서 같은 의미(실패=파일 뷰, 원본 그대로, 동시 ≤2 → 레인 실행 1, 원본 data URL 금지)로 다시 단언한다. `ComposerInputController.test.ts`의 ‘does not clear requirements when async attachment conversion finishes after draft drift’·‘…attachments drift during async submit’은 송신 전 await가 사라져 그 경쟁이 없어지므로 “응답 보류 중 수락 → 즉시 clear, 늦은 응답이 후속 초안을 바꾸지 않음”으로 기대를 바꾼다.

`c7d2adf2`에서 위 술어를 각각 실행한 원시 적중(줄/파일)은 Q20 639/88, EP2 131/31, EP3 73/23, Q28 94/34, EP5 18/13(rev 4 술어 추가 전 15/11), Q30 38/14, EP7 18/9, EP8 25/9, EP9 43/17, EP10 10/2, EP11 45/11, EP12 18/10, WL 22/7, VL 30/10이다(§8-A A14). 타입·다른 화면을 포함한 검색량이며 검증할 자리는 표의 번호로 식별한다.

### Q20 파일 최신성 · 열린 폴더의 감시와 복구

**목록 자동 갱신은 폴더 변경 통지로 한다(D-004a).** data는 `cwd + 상대 디렉터리` 직속 항목을 비재귀 감시한다. 창은 활성 메뉴·폴더·세대 하나의 후보만 반영한다. 파일 내용만 바뀌어 이름·종류가 같으면 현재 선택과 스크롤 위치를 유지한다.

1. 메뉴를 열면 읽을 수 있는 현재 디렉터리 범위를 확인하고 감시를 붙인 뒤 첫 목록을 읽는다. 같은 위치의 여러 소비자는 하나의 감시 핸들을 공유한다. 목록을 읽는 중 사건이 오면 현재 읽기가 끝난 뒤 한 번 더 읽어서 처음 읽기와 구독 사이의 누락을 없앤다.
2. 변경 사건은 다시 읽으라는 신호다. 연속 사건을 묶고 동시에 한 번만 읽는다. rename의 old/new 순서나 OS가 준 파일명에 의존하지 않고 정렬한 새 디렉터리 이름·종류와 대조한다. 창은 현재 generation의 결과를 원자 교체하고 흩어진 과거 응답은 버린다.
3. 다시 열기·폴더 재진입·포커스 복귀·포트 재연결에서 디스크를 다시 확인한다. 감시 오류·경로 삭제/재생성 때는 활성 디렉터리만 제한 간격으로 재조회하고 감시 등록을 재시도한다. 새 감시가 정상화되면 복구용 타이머를 멈춘다. IPC 오류와 정상인 빈 디렉터리는 다음 갱신을 가로막지 않는다.
4. 다른 폴더·세션으로 이동, 메뉴 닫기·unmount, 창 포트 종료에 소비권을 해제한다. 마지막 소유자가 사라지면 watcher·타이머·대기 작업을 해제한다. 닫힌 이전 창/폴더의 늦은 결과는 새 선택과 `validFilePaths`를 덮을 수 없다.

**현재 포트와 설계 선택.** 기준 트리의 `oo:files:list`는 단발 요청이다(`shared/ipc.ts:62`, `handlers/files.ts:93–96`). 기존 `fingerprint-watch.ts`는 지정 파일을 폴링하며 이 메뉴의 폴더 이벤트 구독은 없다. 채택한 배선은 아래 “통지 채널”이고 1초 재조회 폴백은 쓰지 않는다(D-004a · A13).

| 배선 | 변경 전달·정리 | 계측 |
|---|---|---|
| **통지 채널 (채택)** | 요청에 `observation { owner, active }`를 실어 감시를 등록하고 data가 그 창에만 `{ cwd, relDir, revision }` 무효화를 보낸다 — 파일명은 싣지 않는다. 선례는 `sessionNativeResources`의 observation·`sender.onClosed` 정리·`sender.send`(`handlers/session-resources.ts:152-179`). `active:false`·창 닫힘·폴더 이동이 해제다. R은 통지 후 현 query를 다시 읽는다 | 파일명이 없는 사건·중복·창 두 개·마지막 구독 해제. raw 사건 수, 통지 수, 실제 재조회 횟수·응답 bytes |
| ~~기존 공개 API만 유지~~ | 1초 `files.list` 재조회 — D-004a로 채택하지 않음 | — |

감시 오류 시 재시도는 한 폴더에 타이머 하나, 초기 1초부터 최대 5초까지로 제한한다(Orca 설계값). 변경한 디렉터리 밖은 탐색하지 않는다. 화면이 재개되면 최신 응답으로 원본 목록을 교체한다. 제한된 8개 응답만으로 다른 파일의 삭제를 추론하지 않는다.

| 직접 oracle | 입력 → 관측 |
|---|---|
| F1 · 열린 메뉴 | 실제 임시 디렉터리에서 파일·폴더 생성→rename→삭제. 메뉴를 계속 연 상태로 기대 후보와 `validFilePaths` 차집합 ∅, 선택한 생존 ID 보존. 통지 1회당 재조회 ≤1, 통지 없이는 재조회 0. 같은 창의 다른 relDir 통지 → 이 메뉴 재조회 0(ΔV1) |
| F2 · 읽기 경합 | 최초 읽기 중 mutation, 연속 rename·중복·파일명 없는 신호, 원래 읽기가 늦게 해소되는 순서를 결정적으로 주입. 진행 중 읽기 ≤1, 갱신 완료 후 실제 `listDir`와 동일. 묶음 간격(`CHANGE_DELAY_MS`) 안의 사건 3개 → 그 폴더 통지 1회(ΔV1) |
| F3 · 장애 복구 | watcher 오류, 활성 폴더 삭제→동일 경로 재생성, 창 blur 중 변화→focus, read 실패→성공. 현재 목록과 재결합, 복구 뒤 타이머 정리. OS 사건 지연이 있는 실기와 가상 시계 단언을 분리 |
| F4 · 수명 | 창 둘이 같은 폴더 열기→한 창 닫기→다른 창 이동/포트 종료. 감시 핸들 공유·마지막 소비권 해제·이전 폴더 늦은 응답 격리. 닫은 창으로 가는 통지 0 |
| F5 · 캐시와 필터 | 같은 메뉴에서 접두사/커서만 연속 변경한 경우 진행 중 조회를 공유. 점파일·symlink·8개 상한·9번째 유효 파일·다른 cwd·실패 후 다시 열기. R-H가 prefix/limit을 켠 경우에만 받은 결과로 새 prefix를 충족할 수 없을 때 제한 질의 추가 |
| F6 · 통지 계약 | `active:false` 요청 → 그 owner만 해제, 같은 창의 다른 owner 유지 · 창 닫힘(`onClosed`) → 그 창 owner 전부 해제 · 다른 창 폴더 변경 → 이 창에 통지 0 · 통지 payload에 파일명 0. 같은 창 owner 2개가 같은 scope → 그 창 통지 1회(ΔV1). 통지 송신을 지우거나, 대상 창을 broadcast로 바꾸거나, 사건 묶기 가드·같은 창 중복 제거·창 relDir 필터를 지우면 각각 red |

기존 `useMentionAutocomplete.test.ts`의 prefix/caret 단일 요청은 유지하고, 빈 목록을 다시 열 때까지 영구 캐시하던 기대값은 변경한다. 휘발성 OS 타이밍만으로 PASS하지 않는다. F2~F4·F6은 주입한 감시·시계·해제 사건으로 재생하고 F1은 실제 host/port/React 경로도 재생한다.

**Q20·Q28·Q30 조건부 조회 계약**. §19 R-H가 그 화면에 켰을 때만 아래 조회를 추가하고 기존 채널은 호환 경로로 둔다(D-004b~d). 요청자는 필드와 어휘를 기존 소유자의 조회 의미에 맞춘다. 포트 재연결은 기존 등록·검증 경로를 재사용하며, 오래된 요청이 현재 선택을 덮어쓰지 않는다.

| 조회 | 요청/응답 요지 | 비교 기준과 예외 |
|---|---|---|
| Q20 | 입력 범위(cwd 및 디렉터리/하네스·카탈로그 종류), prefix·limit. 소유자가 정규화하고 최대 8개인 기존 파일·슬래시 결과를 넘김. 모델·plugin은 기존 전건 선택 또는 페이지로 추가 접근 | 원 디렉터리 노출·symlink 제외·숨김/정렬 보존. 전체 유효성 조회와 제안 결과 캐시 분리, cwd 밖 요청 거부. 기존 토큰/모델·plugin을 검색 상한으로 삭제하지 않는다 |
| Q28 | 종류·기존 검색 조건·필터·범위·opaque cursor·limit(제안 50행). 응답 items·stable ID·nextCursor. 서버 정렬 키와 동률 ID 사용, 고정·삭제는 해당 범위 revision을 무효화 | 쿼리/범위가 다른 cursor나 기한 만료 revision은 첫 페이지 재요청. 선택한 ID 보존, 삭제 시 기존 선택 해제. 변경 ID를 기존 notification에 추가해야 하면 구 소비자 허용 형태를 유지 |
| Q30 | 작업/실행 목록 요청과 `taskId + runId` 상세를 분리. 기존 최신 20회 범위 유지. 예시 발췌는 보관 tail의 마지막 1 KiB(UTF-8 경계), 저장 절단과 표시 발췌 여부를 분리 | 전체 열기는 DB에 남은 해당 실행의 출력까지만. 보존기간 만료는 기존 없음/재조회, 다른 task의 run은 미발견 처리. 목록 조회에서 숨은 전체 output의 DB 읽기·IPC 전송을 별도 계측 |

R-H가 켜지 않은 화면은 Q행 ①을 현행 조회 계약으로 시험하고, ②③은 창의 가시 영역(VL)·로컬 필터와 세대 격리를 시험한다. Q20 파일 최신성은 화면과 무관하게 통지 채널의 F1~F6으로 확인한다. R-H가 켰는데도 상한 초과 비용이 ①에 남으면 해당 AC에 잔여값을 기록하고 설계자에게 돌린다.

## 11. 구현 설계와 순서

| 단위 | 구현 지점과 절차 | 실험·잠금 |
|---|---|---|
| WU1 · 기준선 (지금 착수) | `scripts/measure-stage-d.mjs`에 S-D1~10 fixture 입력 크기, 익명 ID, EP12 측정표 항목 계측을 작성. 0325와 같은 설치본/진단 빌드 구분. 기존 동작 회귀 테스트(VP-24·26·27 좌표 + EP2 기대 변경 전 단언)를 먼저 고정한다 | D 이전 빌드와 적용 후 빌드에 같은 입력을 재생. S-D2 겹침(R-W)과 S-D1·4·6 구간(R-H)을 먼저 잰다. 실제 생산자가 없는 T32 부하만 진단 adapter, 실제 설치 로그는 별표. 0327 AC30 Windows 실측은 착수 조건이 아니다(D-012) |
| WU2 · T21 | `useAttachments`가 첨부 수명 ID와 썸네일 상태(`준비 중/준비됨/없음`)를 갖고, 첨부 때 path를 한 번 읽어 base64 문자열로 이미지 작업을 요청한다. `submitComposerInput`은 await 없이 원본 순서·준비된 뷰로 `onSend`를 부르고 같은 task에서 clear한다. 칩은 썸네일만 쓰고 원본 data URL을 들지 않는다 | 워커는 PNG IHDR, JPEG SOF, GIF 논리 화면/첫 frame, WebP VP8/VP8L/VP8X 치수를 헤더 ≤256 KiB에서 읽고 픽셀 검사 뒤 decode한다. 레인은 R-W 결과대로 WL. 결과는 `cacheable:false`, `ImageBitmap.close()`. EP2 입력 표 전부 |
| WU3 · T24 | `PlanTileContent`가 본문 래퍼 ref와 오버레이·팝오버 ref를 나눈다(A11). Markdown text node와 누적 UTF-16 end, node→offset을 revision/실제 DOM 교체별 구성. element 경계 선택도 자식 offset으로 환산. 이분 탐색으로 역방향 Range 구성 | scroll 컨테이너와 viewport의 교집합을 감시하고 문단별 가시 offset 범위를 유지. 주석과 겹친 가시 텍스트만 rect를 읽는다. 선택된 화면 밖 댓글은 먼저 해당 문단으로 이동한 뒤 rAF에서 측정. 저장 댓글·일시 선택을 따로 시험 |
| WU4 · T20·T28·T30 | T20 폴더 변경 통지(D-004a)를 먼저 구현한다. 그 뒤 §19에서 전송·필터·마운트를 분리해 R-H가 켠 화면만 §10 Q행 조회를 소유 프로세스/라우팅/기존 호출/문서와 한 변경으로 맞춘다. 나머지 화면은 기존 전체 질의 + VL 가시화 | 한 행의 DB/sort 비용이 낮고 DOM mount가 비싸면 그 화면에서 host 변경을 생략(R-R). 화면별 판정과 측정값은 §19 결과표에 남긴다 |
| WU5 · T29·T31 | 설정 목록 소유자의 정렬 결과 재사용, 동일 모델 보존. R-R이 JSON을 켜면 `validateSettingsJson`·`importedProviders`를 compute 레인에서 그대로 실행하고 편집 revision이 최신인 결과만 폼에 반영한다. 차트는 집계 자체가 초과할 때만 data에서 같은 day/week series를 만든다 | JSON 파서와 사용자 값 검증을 중복 구현하지 않는다(codec 파일은 type import만 있어 워커에서 그대로 실행 가능 — `customProvider.ts:1-2`). 모델 key·결측일·시간대·통화·주 시작을 기존 `stats.ts` 테스트와 독립 자료 양쪽으로 비교 |
| WU6 · T32 | 작업별 agent 로그 병합. 같은 step·progress의 연속 log만 묶고, 다른 상태/오류/완료 전 flush. R은 실행별 원문 조각·줄 offset을 담고 화면에는 읽는 위치 주변만 표현(VL — 컨테이너 `InstallerDialog.tsx:88`, 행 ID = 실행 세대+시작 offset). 실행 중 archive의 앞부분도 스크롤로 접근 가능 | 메시지 모양은 기존 InstallStatus. 전체 보존을 위해 한 번에 문자열 재조립·출력하지 않는다. 분할된 줄·매우 긴 줄은 시각 조각으로 나누고 원문 순서 유지 |
| WU7 · T33·셸 | T33는 가시 두 입력의 CSS 기반 자연 높이(`field-sizing: content` 지원과 CSS 상한 실제 확인) 또는 visibility+폭·값 기반 단일 프레임 측정. 셸 자산은 실제 비용 확인 뒤 비동기 파일 조회 또는 빌드 자산 색인 선택. 레거시/창 닫기/종료는 독립 trace | CI의 Electron 버전에서 직접 렌더. CSS 경로로도 긴 입력 paint가 비싸면 §19에 분리 보고. 주기 쓰기만 원인일 때 로그 순서와 fatal flush를 유지하는 단일 writer 설계로 한정 |

**테스트 seam.** 날짜·정렬·cursor·로그 분할·픽셀 예산은 순수 모듈로 두어 `electron`이나 DB를 import하지 않고 경계값을 재생한다. 브라우저 진단 코드는 실제 worker와 실제 DOM/resize/scroll/IME를 통과시킨다. main 파일 복구는 실제 임시 디렉터리와 실제 파일 배선을 사용하고 데이터·실제 사용자 홈을 분리한다.

## 12. 종단 영향

파일 후보 감시는 data의 비재귀 watcher, 창별 수명은 host port의 `onClosed`, UI는 활성 메뉴에 둔다. 폴더 변경 통지(D-004a)의 타입·소유자(`data`)·정리 및 문서를 같은 변경에 포함한다.

등록 지점은 `shared/ipc.ts`(CHANNELS), `shared/protocol.ts`(Zod), `shared/channel-owner.ts`, data handler(`handlers/files.ts`), `renderer/src/shared/api/{transport/oo,ipc}.ts`(구독 — `oo.ts:334` 선례)다. 통지 채널과 R-H가 켠 조회는 입력 Zod, 반환 타입, 라우터, 허용 포트, 취소/재연결, 구 호출 회귀를 같은 채널로 시험하고 [IPC 정본](../../IPC_CONTRACT.md)을 같이 고친다. DB 스키마·기존 파일 형식·하네스 원본 전송·저장 첨부 뷰 형식은 현행 유지가 설계 기준이다.

계산 워커 쪽 등록 지점은 `renderer/src/shared/compute/{protocol,client,limits}.ts`와 `worker/` 진입점이다. 이미지 kind 추가·`image` 레인(R-W 분리 시)은 0327 레인 테스트(VP-27)를 그대로 통과해야 하고, 새 워커 생성은 `client.ts` 한 곳이다(`check-ui-thread` 규칙 (i)). `useVirtualRows`의 키 인자는 선택적이라 0327 호출부 4곳(`VirtualMarkdownView`·`VirtualCodeView`·`DiffTable`·`FileDiffSection`)은 바뀌지 않는다.

T29는 기존 renderer에서 사용하는 v1 codec만 워커 경계로 전달하며 engine 선택·저장 소유자는 현재 경로를 쓴다. 팝오버·진행 상태는 소유자별 구독을 해제하고 컴포넌트나 preload 초기화를 앞당기지 않는다. 셸 종료 경로의 watcher·재시작·자산 lookup 실패는 프로토콜·트레이·로거의 기존 초기화 순서에서 실험한다.

## 13. 수명과 오류

| 시점 | 처리 |
|---|---|
| 첨부 제거·붙여넣기 경쟁·세션 전환 | 첨부 수명 ID마다 작업 하나. 제거·수락된 송신·언마운트가 그 작업을 취소하고 늦은 응답은 버린다. 전송 스냅숏은 소유 세션·입력 순서를 유지하고 송신은 작업을 기다리지 않는다(D-009). worker 실패·미지원 디코더·연속 실패 차단은 `없음`으로 settle. 워커 안 bitmap·OffscreenCanvas 해제, 레인 슬롯은 WL ③ 여섯 경로에서 해제 |
| 페이지/설정 재요청 | cwd·프로젝트·정렬/필터·세대가 같은 결과만 사용. 실패/빈 결과/재시도 상태는 분리한다. 예전 전체 조회 응답은 기존 자료를 읽는 구 호출에서만 사용 |
| 계획 교체·숨김·주석 삭제 | 오래된 observer와 예약 frame 취소. 본문 교체 후 텍스트/offset이 맞지 않는 주석은 클릭 rect를 만들지 않는다. 선택/활성 ID는 기존 저장 의미를 따름 |
| 설치 재시작·다이얼로그 닫힘 | agent는 terminal 전 마지막 조각을 내보냄. 완료 콜백은 성공일 때 once. 구독 해제와 실행 세대 갱신으로 지난 실행 결과 폐기. 진행 중 닫기 금지와 기존 수동 설치 안내 보존 |
| 파일 접근·저장 실패 | 누락 자산의 index fallback과 복구 가능한 legacy read 실패는 현행대로. 로그 쓰기 거부는 기존 단발 emergency·비활성·기능 진행을 확인하고 기록 성공으로 세지 않는다 |

## 14. 수치와 비용 경계

- **이미지**. 작업당 원본 16,777,216 픽셀 이하. 레인마다 실행이 1이라(0327 D-016) 창 단위 활성 decode는 이미지 작업을 맡은 레인 하나에서 ≤1건·≤16,777,216픽셀이고, 0325의 “동시 ≤2”를 지킨다. 원본 RGBA 환산 상한 약 64 MiB와 JPEG 결과는 디코더의 모든 임시 메모리 사용을 합한 값과 구분한다. 너비/높이 양의 정수, `width <= floor(16,777,216/height)` 검사 후에만 decode한다.
- **전송 방식**. 창은 base64 문자열을 그대로 요청에 복제한다(`WorkerLike.postMessage`에 전송 목록 없음 — A7). 창에서 base64를 bytes로 풀어 ArrayBuffer를 넘기는 방식은 UI 스레드에서 원본 크기만큼 디코딩하므로 쓰지 않는다. 문자열은 불변이라 원본 송신 경로(path는 main이 다시 읽고 inline은 같은 문자열)가 워커 때문에 비거나 늦어지지 않는다.
- JPEG 등 가변 헤더는 워커에서 최대 256 KiB까지 읽는다. canvas/첫 frame 크기 검증 불가, 포맷 불일치, 초과는 **디코드 전 썸네일만 생략**한다. 실제 전송의 32 MiB·지원 MIME 검증은 기존 경로가 담당한다. 칩 표시에도 원본 data URL을 img로 주지 않아 예산 우회를 막는다. 파일 이름·MIME·원본 내용을 첨부 스냅숏에 유지하며 실제 전송 가능 여부는 기존 전송기가 판정한다.
- **댓글**. 본문 revision별 text node 색인 O(N), offset 조회 O(log N), 재배치 때 실제 가시 텍스트와 겹치는 주석만 rect 측정. 긴 단일 주석도 화면 밖 문단까지 범위 전체를 순회하지 않는다. 같은 프레임에 observer·scroll·resize 통지가 여러 번 와도 측정 한 세트.
- **로그**. agent flush 제안은 16ms 또는 16 KiB 중 먼저 도달한 시점. 터미널 상태는 즉시 flush, 긴 단일 조각은 문자 경계로 분할. 창의 표시 예산은 200줄 또는 32 Ki UTF-16 단위 중 먼저 닿는 상한이고 긴 한 줄 안에서도 영역을 옮길 수 있다. 전체 보관 메모리는 실행 중 원문 크기에 비례하며 다음 실행/다이얼로그 수명 종료에 해제한다.
- **조건부 화면**. 기계 oracle은 ID·순서·필드·바이트/픽셀·DOM 수를 확인한다. §19의 Windows 실기에서 단일 동기 작업이 50ms 초과 또는 160ms 이상 정지를 보이면 실행 층에 귀속하고 원인 경로를 고친다. 그보다 작아도 끊기는 입력은 commit·layout/paint·연속 누락 원인을 남긴다. 이 값은 `shared/perf-budget.ts`의 조사 경계이고 W의 기기별 합격선을 대신하지 않는다.

## 15. 외부 포트와 문서

§10 Q행의 추가 질의는 사용자 승인 범위(D-004b~d) 안에서 R-H가 필요를 확인한 채널만 확정한다. 폴더 변경 통지(D-004a)는 확정 채널이다. 외부 하네스 API, 디스크에 남기는 새 로그, 새 패키지 도입은 이 안에 들어가지 않는다. 브라우저에 포함된 API는 대상 Electron의 [Canvas 및 OffscreenCanvas 사양](https://html.spec.whatwg.org/multipage/canvas.html)과 실제 worker decode/encode 결과를 대조한다. 워커 초기화 실패 시 해당 요청은 파일 표시로 끝난다.

## 16. 기존 결정

| 출처 | 결정·계약 | 0328에서의 처리 |
|---|---|---|
| 0325 | D-012 썸네일 실패=미리보기 없음·원본 대체 금지 · D-041 예외 경계 · AC17·AC18 동시 ≤2 | 유지(VP-24). D-009가 “전송 시점 미준비”를 D-012의 `없음`에 더한다. AC19 기준선은 A 결과에 남긴다 |
| 0326 | 세션 저장소의 비활성 세션 격리 · transcript 뷰포트 하단 추적·읽던 위치 · 선택 가드(`selectionGuard`) | 유지(VP-26). 목록의 선택 취소는 0326 가드를 쓰는 `usePanelSelection`을 그대로 쓴다 |
| 0327 | D-008 공통 워커 요청 규약 · D-016 레인 실행 1 · D-024 실행 중 취소 비종료 · D-035 스트리밍 꼬리 markdown 레인 · 가상 행·패널 선택 | 유지(VP-27). 이미지는 markdown 레인에 두지 않는다(스트리밍 꼬리와 경합). compute 레인이면 D-024 때문에 decode가 visible 작업을 세우므로 R-W가 판정 |
| 0329·0330 | 검색 결과 도착·강조(0329 D-013) · 장비별 판정(0330 W-004) | 비범위(D-008). S-D4 결과·Windows 원본을 인계 |

[실행 모델](../../arch/execution-model.md)과 main/renderer 계층 경계는 적용 상태다.

## 17. 리스크와 검증 경계

| 위험 | 판별/대응 |
|---|---|
| 모델/플러그인 검색의 단순 prefix화로 선택되던 항목이 사라짐 | 기존 종류별 검색·정렬과 전건 멤버십의 기대값을 독립 계산. 특히 9번째 후보 밖 완성 토큰과 직접 선택된 모델을 비교 |
| 긴 주석이나 큰 입력의 DOM 비용이 같은 프레임에 집중 | 본문 선두/끝, 범위 전체 주석과 여러 폭/배율 시험. M9는 CSS 레이아웃 분리값, 설치본의 입력→paint는 S-D9에서 측정 |
| 이미지 header만 작은 다중 프레임, worker 장애 또는 긴 decode | 물리 크기·첫 표시 frame 크기·컨테이너 일관성을 확인할 수 있는 형식만 썸네일 생성. 작업 종료/예산 회수·원본 송신을 테스트. 변환 대기와 UI 점유를 따로 기록 |
| 이미지 decode가 같은 레인의 Git 가시 작업을 세움 | 대기열에 선점이 없고 실행 중 취소가 워커를 끝내지 않는다(A7·A8). R-W 겹침 측정으로 레인을 정한다 |
| 빨리 보낸 이미지가 썸네일 없이 남음 | 사용자가 수용한 결과다(D-009). S-D2에 “전송 시점 준비 수 / 전체”를 기록해 0330에서 빈도를 본다 |
| 종료 시 비동기 쓰기 순서가 바뀌어 로그/상태가 사라짐 | 실제 파일에 다른 순번을 써 주기 직전·쓰기 중·close/장애 순서를 검증. 보장이 어려우면 종료/fatal의 현행 동기 경로 유지 |
| 조건부 측정 오인 | SSR로는 paint·레이아웃을 판단할 수 없다. T32 생산 로그 없음과 진단 부하, 소유 호스트 시간과 창 시간을 나누어 기록 |

## 18. 영향 파일과 산출물

| 범위 | 기준 트리에서 대조할 모듈 / 구현 때 갱신할 산출물 |
|---|---|
| 컴포저·워커 | `features/chat/hooks/{useAttachments,useMentionAutocomplete,useSkillAutocomplete}.ts`, `chat/lib/{attachmentViews,imageThumb,mentionAutocomplete}.ts`, common/composer의 `ComposerInputController.tsx`·`composerSubmit.ts`, `renderer/src/shared/compute/{protocol,client,limits}.ts`·`worker/`, 메인 `main/features/chat/attachments.ts`(저장 뷰 — 변경 없음, 회귀 대조만) |
| 계획·입력 | `PlanTileContent.tsx`, `PlanCommentOverlay.tsx`, `PlanCommentPopover.tsx`, `usePlanCommentSelection.ts`, `planCommentDom.ts`, `AutoGrowTextarea.tsx`, `GeneralTab.tsx` |
| 목록·설정·예약·차트 | 세션 `navSections.ts`·`SearchModal.tsx`·`SessionList.tsx`·`PinnedSection.tsx`·`PinnedProjectsSection.tsx`와 `app/Sidebar.tsx`, 프로젝트 `ProjectsScreen.tsx`, 산출물 `ArtifactsView.tsx`·`artifactCatalogStore.ts`, `CustomizeList.tsx`, `EngineModelList.tsx`, `customProvider.ts`·`ProviderForm.tsx`·`EngineFormModal.tsx`·`providerCatalog.ts`, `SchedulesScreen.tsx`·`RunHistory.tsx`, `UsageTab.tsx`·`TokensPerDayChart.tsx`, 관련 기존 data/agent handler |
| 가상 행 | `shared/ui/virtual/{useVirtualRows,rowMount}.ts`, `features/chat/hooks/usePanelSelection.ts`(재사용 — 변경 없음 목표) |
| 설치·셸 | `main/app/handlers/misc.ts`, `main/infra/ipc/send.ts`, `InstallerDialog.tsx`, `main/index.ts`, `main/app/shell/shell-state{,-file}.ts`, `main/infra/log/{index,log-manager,file-transport}.ts` |
| 파일 후보 통지 | `main/app/handlers/files.ts`, `main/features/chat/scan.ts`, `shared/{ipc,protocol,channel-owner}.ts`, `renderer/src/shared/api/transport/oo.ts` |
| 계약·문서 | §12 공유 타입·라우팅, `docs/IPC_CONTRACT.md`(폴더 변경 통지는 확정, R-H 조회는 켠 경우)와 관련 현재 아키텍처, 측정 스크립트 `app/scripts/measure-stage-d{,.test}.mjs`와 `app/AGENTS.md` 스크립트 목록. 구현자 보고·측정 요약은 이 계획 및 검증 문서, 디스패치 상태는 [INDEX](../INDEX.md) |

## 19. 게이트와 Windows 재현표

**설계**. 상대링크·Markdown 표·섹션·T행·보드 승격과 trailer를 확인한다. **구현**. `app/AGENTS.md` 기준 lint·typecheck, 새 테스트의 예산·호스트 격리, migration·inventory·naming·test-budget·process-boundary 가드, 필터 없는 vitest와 scripts 테스트, host boot/preload smoke를 CI 단계와 맞춘다. **검증**. §10 각 자리에서 직접 oracle과 등록 변이를 재생하고, 실제 저장 파일·UI 결과를 독립 비교한다.

**측정 공통**. 기계 측정은 에이전트가 띄우는 Electron(`xvfb-run -a node scripts/measure-stage-d.mjs`)에서 하고, 사람 실기는 [0325 §19](../0325-ui-responsiveness-followup/plan.md)의 동일 장비·주사율·배율·설치본/진단 빌드, 반복과 프레임 판정 규약을 쓴다. 동일 시나리오를 D 변경 전 마지막 기준(`c7d2adf2`)과 D 적용 빌드에서 재생한다. 행마다 기준 SHA·환경(`linux-electron` 기계 / `windows-설치본` 사람)·fixture·크기·반복별 EP12 측정표 항목·p95/최대·50ms 초과 작업·160ms 이상 정지·연속 프레임 누락을 남긴다. `windows-설치본` 행과 Windows에서만 재현되는 항목(S-D9 IME, S-D10 창·자산)은 “0330 인계”로 표시한다.

| ID | 재현 입력과 조작 | 구간과 결과 |
|---|---|---|
| S-D1 | 파일 2만 개, 숨김 포함. 열린 메뉴에서 생성·삭제·rename 확인, 감시 폴더 재생성·포커스 복귀·닫기 후 재개·하위 디렉터리 왕복, `@src` 연속 입력→Enter. 슬래시·plugin·모델 키보드 선택과 9번째 직접 토큰 장식 | 감시 수·갱신 지연·조회 횟수·포트 전송량 → R 필터 → 팝오버 paint·초점. §10 F1~F6 |
| S-D2 | 0325 F4 5장을 dialog/drop/paste로 각각 추가→즉시 전송. (a) 미리보기 응답을 보류한 채 5장 즉시 전송·거부·후속 초안 편집 (b) 전송 중 새 초안 입력·첨부 제거 (c) 픽셀 경계·손상 1장 추가 (d) **겹침** — 큰 이미지 5장 처리 중 답변 스트리밍(0327 `check-transcript-streaming` 꼬리)과 Git diff 스크롤을 동시에 재생 | 첨부→칩 썸네일 시간, source read 수(첨부당 1), 전송→`onSend`·초안 clear·초점까지(같은 task), 전송 시점 준비 수/전체, 원본 순서, 이미지 작업 시간·visible 작업 대기(레인별)·decode 거절 수, 버블 paint |
| S-D3 | M3 2,000단락·128댓글에 같은 인용 2곳·본문 전체 댓글 추가. 폭 600→360→600px 드래그, 마지막 댓글을 목록에서 열기 | 색인 횟수/노드, 프레임별 rect 조회와 가시 ID, 선택 quote·실제 팝오버 위치 |
| S-D4 | M4 세션, 100프로젝트·1만 산출물. 고정/해제·페이지 경계 삭제·두 검색어의 결과 순서와 스니펫 선택 | DB조회·IPC bytes·DOM 행·정렬/선택·원래 본문 검색 상한. 선택한 결과의 세션·메시지를 기록해 0329 S-E5의 도착 행과 대조 |
| S-D5 | M5 JSON(307,845자)을 settings 입력창에 붙여넣고 연속 3회 편집, 같은 JSON 가져오기, 문법 오류/미지원 npm, 같은 입력창에서 교정, 1만 자원 목록 필터·모델 선택 | 입력마다 검증 task·가져오기 codec task·폼 commit·필터·최종 저장 값. 시간·크기만 기록 |
| S-D6 | 50회 이력을 가진 예약, 최근 20회 × 저장 tail 64KiB, 절단/빈/실패·다른 예약 지연 응답 | 목록·상세 DB 읽기와 IPC bytes·DOM·열린 run·저장 절단 표시 |
| S-D7 | 7·30·90·91·730일, 비어 있는 날과 730일 이전 내역 포함. 첫 표시·기간 변경·포인터 이동 | data 합산·R 파생·첫 commit·paint·도움말·표 합계 분리 |
| S-D8 | 실제 Claude 설치 진입(현재 terminal-only)과 **진단 어댑터**의 1만 줄(순번 0…9999)·65KiB 무개행·분할 줄·오류/완료를 각각 재생. 중간을 읽다 마지막으로 이동 | agent 원문/묶음 수·R commit·scrollTop/첫 가시 ID·terminal 전 마지막 출력. 운영 로그 수가 0인 실험은 진단 폭주 수치로 대체하지 않는다 |
| S-D9 | 일반 설정·댓글 입력에서 한글 2천·2만 자 붙여넣기·조합·삭제·폭 드래그·가림→다시 표시 | 입력→paint·실측 프레임/횟수·커서·보이는 마지막 줄·팝오버 위치 |
| S-D10a/b/c | a 자산 1,000요청(존재·누락·SPA 각각 구분). b 자체 상태 있음·없음/손상·최초 승계, 일반창/최소/최대 close→재실행. c 정상 주기·회전 경계·우아한 종료·격리된 진단 프로세스의 fatal | a main 조회/응답 분포·fallback, b 읽기/쓰기·재시작 언어/위치, c flush 소요·순번 보존을 **각각** 기록 |

**분기 판정 규칙.** 기준은 `UI_TASK_BUDGET_MS`(50ms) — PR #640대로 원인 조사 기준이지 합격선이 아니다. 판정은 변경 전 빌드의 `linux-electron` 최대 입력 행으로 하고, 결과표 `항목 / 입력 크기 / EP12 측정표 항목 / 규칙 / 유지·변경 / 잔여`에 남긴다. 설계자 턴 없이 구현자가 적용한다.

| 규칙 | 대상 | 켜는 조건 | 켜면 | 아니면 |
|---|---|---|---|---|
| R-H 호스트 | S-D1(T20 prefix/limit) · S-D4(Q28) · S-D6(Q30) | EP12 측정표의 T1+T2 ≥ 50ms이고 T1+T2 > T3+T4+T5 — 모두 ms, 같은 상호작용의 중앙값. C1·C2는 근거 열에만 적는다 | 그 화면만 §10 Q행 조회(D-004b~d) | 현행 조회 + R-R |
| R-W 워커 | S-D2 (d) | compute 레인 `background`에 둔 이미지 작업 1건 p95 ≥ 50ms — 선점이 없어 visible 작업이 그만큼 기다린다(A7·A8) | 신규 `image` 레인 | compute 레인 `background` |
| R-R 렌더러·셸 | S-D3~S-D9의 창 작업 · R-H가 꺼진 S-D1/4/6 · S-D10의 main 작업 | 상호작용 창 안 Chromium `longtask` 1건 ≥ 50ms(관측 방식은 `shared/perf/longTaskReporter.ts:43-50`과 같다), 또는 동기 구간 T3·T4 하나 ≥ 50ms. 셸은 main 루프 작업 ≥ 50ms | 그 구간만 고친다 — 목록은 VL, JSON은 EP5 워커, 댓글·높이는 EP3·EP9, 셸은 EP10·EP11 | 유지 + 측정값 |

**선언 경계(rev 5).** T5는 두 번째 rAF까지의 상한이라 60Hz에서 최대 약 2프레임(≈33ms)의 대기를 포함한다. 그래서 R-H는 창 쪽 합을 크게 보는 쪽으로 기울고, 공개 조회 변경보다 렌더러 해결을 먼저 고른다(D-004c·d “DOM만 비싸면 렌더러에서 해결”과 같은 방향). 이 편향 안에서 R-H가 꺼진 화면은 판정 결함이 아니다.

준비되지 않은 Windows 결과는 미측정으로 적고 [0330 Windows 판정](../0330-windows-responsiveness-verdict/plan.md)에 원본 기록을 인계한다. 0327 AC30 Windows 실측은 WU1 착수 조건이 아니다(D-012).

## READY self-review

**ΔV1 = READY.** verify 1 PLAN_GAP 4건을 닫았다(채택 3 · 사용자 결정 1). 이번 턴의 관측:

| 검사 | 관측 |
|---|---|
| 파생 이슈 → 규범 행 | #4→F2 · #5→F6 · #6→F1 · #7→D-013·AC15·EP2 ⑥·VP-14·VP-31 · #3→VL ③ 좌표 문장 · #1·#2는 plan 불변 |
| 채택 항목의 장치 방향 | F2·F6·F1의 새 단언은 V-I4·V-I12·V-I13 변이(가드·중복 제거·필터 제거)를 넣으면 red가 되는 방향 — 같은 변이를 F6 등록 변이로 올렸다 |
| 규칙 칸 ↔ 입력 칸 | EP2 ⑥ 규칙의 새 분기(세션 전환)에 입력 표 ⑥ “세션 전환 뒤 응답 해소” 1:1 |
| AC 수 · pair 수 | AC 16행(AC15 추가). pair 32 = R 16 · SD 5 · AR 6 · MD 5 |
| ACTIVE 결정 ↔ AC | 충돌 0 — ΔV1 변경 근거 줄 |

**rev 5 = READY.** r1 PLAN_GAP(R-H 단위·구간)을 닫았다. 이번 턴의 관측:

| 검사 | 관측 |
|---|---|
| 지적 원문 ↔ 정정 | “DOM 행은 개수” → C2를 개수로 두고 R-H 식에서 뺐다 · “commit의 중복 여부” → T4(`flushSync` 경과)와 T5(반환 뒤 → 두 번째 rAF)를 이어 붙인 구간으로 정의 |
| 같은 대상을 쓰는 절 | AC12 · VP-25 · EP12 행 · EP12 측정표 · §19 측정 공통 · WU1 · R-H/R-R 행 — 설계자 영역에서 `rg -n "여섯 구간"` 0(남은 1건은 `[구현자 기입]` r1 원문) |
| 규칙 칸 ↔ 입력 칸 | R-H 분기 4(켬·창 쪽 큼·50 미만·경계) + 누락 1, R-R 분기 3(longtask·동기 구간·T5 단독) — R-H·R-R 입력 표에 1:1 |
| 인용 코드 | `longTaskReporter.ts:43-50`(`longtask` 관측) · r1 `probe.tsx`의 `flushSync`·두 프레임 방식(r1 측정 기록 서문) |
| ACTIVE 결정 ↔ AC | 충돌 0 — rev 5 변경 근거 줄 |

**rev 4 = READY.** OPEN 결정 0(D-004 → D-004a~d 사용자 결정). 아래는 rev 4 턴에 대조한 관측이다.

| 검사 | 관측 |
|---|---|
| ACTIVE 결정 ↔ AC | 충돌 0 — §3 rev 4 대조 줄(D-004a~d·D-008~D-012 → AC·VP) |
| PR #640 여섯 항목 → 규범 행 | 기준선·경계 → 메타·§6 표·§8-A·D-008 / T21 송신 → D-009·AC2a·AC2b·EP2 ⑤⑥ / 워커 → D-010·AC13·WL·§14·R-W / T24·가상 목록 → D-011·AC3·AC14·EP3·VL / D-004 → D-004a~d·Q20 F6·R-H / WU1·Windows → D-012·AC12·EP12·§19 측정 공통 |
| AC 수 · pair 수 | AC 15행(AC1·AC2a·AC2b·AC3~AC14). pair 31 = R 15 · SD 5 · AR 6 · MD 5. NEW/REQUIRED 28 · INHERITED/REGRESSION 3(VP-24·26·27) |
| NEW 왼쪽 노드 ↔ §10 | VP-02a·02b→EP2 ⑤⑥ · VP-28→WL·EP2 ②③ · VP-29→VL · VP-30→VL ①② · 나머지는 rev 3 행 유지 |
| 규칙 칸 ↔ 입력 칸 | EP2는 자리 ①~⑥의 분기를 EP2 입력 표로 1:1 대응. WL ①③·VL ①④·F6은 같은 칸에 분기별 입력을 둔다 |
| 기존 테스트 인용 | `client.lanes.test.ts` l1·l2 · `client.queue.test.ts` q1·q5·q6·q7 · `usePanelSelection.test.ts` ps1~ps17 · `chatReducer.parts.test.ts` 두 케이스 · `chatStore.test.ts`:350 · `TranscriptViewport.prepend.test.ts`:156 · `composerSubmit.test.ts` 두 케이스 · `attachmentViews.test.ts` t1·t5·t6·t8 — `rg -n "^\s*(it\|test)\("`로 실재 확인 |
| 문서 앵커 | 0327 D-008·D-016·D-024·D-035, 0325 D-012·D-041·D-029·D-043, 0329 D-013, 0330 W-004 — 각 plan에서 `grep`으로 실재 확인 |
| 선언 경계 | 기계 판정은 `linux-electron`이고 Windows 수치는 0330(§19). 미준비 썸네일은 버블·DB에서 파일 표시가 계약이며 늦은 보강은 범위 밖(D-009). R-H·R-R이 켜지 않은 화면의 조회·DOM은 현행 + 측정값으로 닫는다 |
| 운영 gate | 설계 턴은 Markdown 표·상대 링크·INDEX·trailer. 구현 턴은 `app/AGENTS.md` 로컬 확인 전 단계 + `measure-stage-d` 실행(§19) |

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰 (r1)

- **동의 / 그대로 진행** 원본 송신과 미리보기 준비를 분리했다. 파일 목록은 활성 폴더의 data 통지로 갱신한다.
- **이견 / 현실성 문제** R-H는 호스트·창 수신 시간과 «DOM 행·React commit·첫 paint 합»을 비교한다. EP12의 DOM 행은 개수로 정의되어 있다. 화면별 호스트 조건을 판정하려면 비교에 쓰는 DOM 시간 구간과 commit의 중복 여부를 확정해야 한다.
- **ACTIVE Decision과 충돌하는 설계 발견** Q20·Q28·Q30의 추가 조회는 보류했다. 측정 단위와 비교 구간을 §19에서 정하는 작업이 남았다.
- **착수 대조** `c7d2adf2` 이후 구현 전 변경은 계획과 INDEX였다. VP-24·26·27 및 셸 관련 기준선 테스트 202건을 먼저 실행했다. R-W는 전용 레인으로 판정했다. R-R의 관측 범위는 [r1 측정](evidence/r1-measurements.md)에 기록했다.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-1·13·16·22 | Q20·Q28·Q30·EP5·EP7 | Q20 ①~⑦ · Q28 ①~④ · Q30 ①~③ · EP5·EP7 ①~③ | 부분 | `composer-menu-query.integration`, `useMentionAutocomplete`, `RunHistoryPanel.interaction`, Electron `--catalogs` | 창별 변경 통지 · 동일 prefix 소유 · 다른 예약의 늦은 응답 폐기 · 요청한 실행 출력 펼치기 | 조건부 조회와 호스트/IPC 계측 · 세션 목록 · 카탈로그 및 사용량의 전체 배선 |
| VP-02a·02b·14·17·20·24·26·28 | EP2·WL·EP11 | EP2 ①~⑥ · WL ①~④ · EP11 ①~④ | 부분 | `composerSubmit`, `ComposerInputController`, `useAttachments.views`, `imageHeader`, `client.lanes`, Electron S-D2 | 원본 5개와 준비 뷰 2개 · 거부·IME에서 보존 · decode 전 거절 · 작업 취소 | 실제 dialog/drop/paste 및 재시작 통합 replay · WL 종료 전수 · 셸 실기 |
| VP-3·9·15·21 | EP3·EP9 | EP3 ①~⑥ · EP9 ①~③ | 부분 | Electron S-D3·S-D9 | 2천 단락에서 폭 변경 rect 1회 · 마지막 댓글 표시와 초점 · 2만 자 입력 | 역방향·동일 인용과 DOM 교체 sweep · 실제 조합과 숨김 복귀 |
| VP-8·18·23 | EP8 | ①~④ | 부분 | `install-status`, `installLogArchive`, Electron 진단 폭주 | UTF-8/UTF-16 원문 보존 · terminal 앞 flush · 로그 1만 줄 중 가시 DOM 30개 · 완료 1회 | 실제 설치 진입 기록과 실 port → 창 연결 oracle |
| VP-10·11·19 | EP10·EP11 | EP10 ①~③ · EP11 ①~④ | 부분 | 기준선 `shell-state.test`, `shell-state-file.cwd`, `file-transport`와 [셸 진단](evidence/r1-shell.json) | 자산 1천 응답·파일 승계와 재열기·마지막 로그 행 | main 동기 작업 분리, 창 모드·주기/fatal 실기와 Windows |
| VP-12·25 | EP12 | ①~④ | 부분 | `measure-stage-d`와 [r1 측정](evidence/r1-measurements.md) | R-W 및 목록·입력의 구간별 관측 | 실측 시나리오 전부의 전후 여섯 구간과 0330 원본 |
| VP-27·29·30 | VL·WL | VL ①~④ · WL ①~④ | 부분 | `useVirtualRows`, `rowMount`, `usePanelSelection`, Electron `--catalogs` | 안정 행 키 · 대량 산출물 마지막 항목 · 프로젝트·설치 목록 가시 DOM | Sidebar·예약 목록/VL · 목록 밖 선택 보존의 실기 sweep |

- **§10 자리 목록 밖에서 본 운반 자리** 예약 조회 결과가 새 작업을 고른 뒤 응답 전까지 보이던 경로를 task ID로 묶었다(Q30 ②).
- **직전 verify 고장 이력의 `못 잡음` 행** 해당 없음(verify 0회).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-02a | REQUIRED | SELF_BLOCKED | `ComposerInputController.test.ts`의 수락·거부·IME·동기 변경 | 전송 지연 변이를 검출. 실제 입력 이벤트·초점의 끝단 replay 잔여 |
| VP-1·02b·3~23·25·28~30 | REQUIRED | SELF_BLOCKED | 위 자리 표의 부분 oracle | [r1 변이](evidence/r1-mutations.tsv). 열거 전수와 §19 실측 잔여 |
| VP-24·26·27 | REGRESSION | SELF_BLOCKED | 기존 단위 회귀와 뷰·송신의 교체 테스트 | 저장 후 버블부터 비활성 세션까지 묶는 EP2 ⑥, 전체 sweep 잔여 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 창 통지 제거 | F6 | 최초 | `composer-menu-query.integration` | 잡음 |
| 전송을 다음 task로 지연 | EP2 ⑤ | 최초 | `composerSubmit`, `ComposerInputController` 3 | 잡음 |
| 미준비 뷰에 원본을 채움 | EP2 ⑤ | 최초 | `composerSubmit` 1 | 잡음 |
| 헤더 거절 경로에서 decode 호출 | EP2 ③ | 최초 | `imageHeader` 1 | 잡음 |
| 수락 후 취소 제거 | EP2 ⑥ | 최초 | `useAttachments.views` 1 | 잡음 |
| 이미지 레인을 Markdown으로 교체 | WL ① | 최초 | `client.lanes` 2 | 잡음 |
| background 우선순위 제거 | WL ① | 최초 | `useAttachments.views` 1 | 잡음 |
| 터미널 뒤 로그 flush | EP8 ② | 최초 | `install-status` 1 | 잡음 |
| 행 키를 인덱스로 고정 | VL ① | 최초 | `useVirtualRows` 1 | 잡음 |
| 이전 작업의 예약 실행 결과 노출 | Q30 ② | 최초 | `RunHistoryPanel.interaction` 1 | 잡음 |

- **분모 검산** SELF_PASS 선택 증거 0 · 인용 변이 0 · 새 구조 oracle 0 · 이번 부분 sweep 10 = 표 행 10. 열거 전수는 잔여다.
- **덮개 회귀** 이전 0328 검증 이력 없음. 기존 썸네일 테스트는 첨부 수명·워커에 맞추어 이동했다.

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 큰 예약 출력의 펼치기 라벨을 한·영에 넣었다. | Electron에서 열어 저장 문자열과 대조했다. |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 활성 첨부 ID의 작업을 취소한다. 창·폴더 owner 해제는 등록한 ClientRef를 쓴다. | 소유자와 세션 변경 테스트를 실행했다. |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 파일 조회 실패의 재시도, 미준비·실패 첨부의 파일 표시, 설치 terminal. | 클릭·포커스·재연결 실기 범위는 잔여다. |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 경로 읽기·이미지 변환 실패는 원본 행과 파일 칩을 남긴다. | Windows 파일·입력 실기는 0330 인계 대상이다. |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 첨부 수명 ID, 파일 폴더 scope, 예약 task ID를 대조한다. | 지연 응답 테스트를 실행했다. |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 동일 작업명을 가진 다른 예약을 열면 새 응답 전까지 직전 예약의 출력이 보인다. | 현재 task ID를 가진 결과만 표시한다. | `RunHistoryPanel.interaction.test.ts` |
| 2 | 긴 입력의 CSS 높이 계산은 JS 강제 레이아웃을 줄여도 문자열 배치와 그리기 비용을 남긴다. | 입력 commit과 다음 두 프레임의 시간을 기록했다. | [r1 측정](evidence/r1-measurements.md) |
| 3 | R-H 비교식의 DOM 행은 EP12에서 시간 단위가 정해지지 않았다. | §19 비교 시간 구간을 확정하고 화면별 소유자·IPC를 함께 측정한다. | §10 EP12 ②, §19 R-H |

### 설계 대비 명시적 차이

- 첨부 작업 정렬에는 Chromium의 제한된 헤더 샘플을 사용한다. 실제 디코드 허용은 워커가 동일 헤더를 다시 확인해 결정한다. 목록과 예약의 구현을 DOM에서 관측한 범위로 적용했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 이전 드래프트의 작업이 늦게 끝날 수 있다. | EP2 ④·⑥. 수명 ID 폐기 및 취소 테스트. |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 하나의 디렉터리 감시를 여러 창이 공유한다. | Q20 F4·F6. 한 owner 해제 뒤 다른 창은 알림을 받았다. |
| 재진입 | 창 재진입 때 과거 빈 목록이 남을 수 있다. | Q20 F5. 열린 메뉴에서 실패 이후 재조회·폴더 재생성을 검증했다. |
| 다른 무효화 축 | 가시 행에 실제 크기가 들어오면서 목록의 총 크기가 바뀐다. | VL. 항목 키와 실제 스크롤 컨테이너로 보정했다. |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 컴포저·data IPC·워커·계획 본문·설치 로그·큰 카탈로그·예약 이력·두 자동 높이 입력·진단과 계약 문서 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npm test` · `node --test scripts/*.test.mjs` · CI 소스 가드 · 번들/호스트/프리로드 smoke · `DISPLAY=:82 node scripts/measure-stage-d.mjs` 및 `--catalogs` |
| **관측한 게이트 산출** | [r1 게이트](evidence/r1-gates.md) |
| **추가·수정 테스트의 subtree 규칙** | [r1 게이트](evidence/r1-gates.md) |
| V-pair 자기확인 | 부분 직접 증거와 남은 경로는 위 표 참조 |
| 강제 지점 전수 | 열거 sweep 완료 전. [실행한 10개 변이](evidence/r1-mutations.tsv) |
| **AC 자기보고** | ✅ AC2a 자체 송신 경계. ⚠️ AC1·2b·3~14 직접 관측 일부와 잔여 경로는 위 표와 [측정](evidence/r1-measurements.md). |
| **합계 검산** | ✅ 1 · ⚠️ 14 · ❌ 0 = 총 15 |
| 블로커 / 역질문 | R-H DOM 시간 구간 확정. Q20/28/30 실제 구간 측정, 세션·예약 목록, 셸 세 시나리오, 전체 sweep, Windows 인계 잔여. |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1)

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가** 첫 구현이다.
- **그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가** task 전환의 기존 늦은 응답 폐기는 보이는 기존 결과까지 스코프하지 않았다.
- **반복해서 부딪히는 환경 한계** Windows 경로를 사용하는 Linux 기준선 실패와 Windows 설치본 실기 미측정.
- **현재 라운드·impl 턴** `r1`

---

## [구현자 기입] 설계 리뷰 (r1.2)

- **타당한 부분** 같은 상호작용에서 T1+T2와 T3+T4+T5를 각각 계산했다. C1·C2는 별도 열로 기록했다.
- **이견 / 현실성 문제** r1의 R-H 단위 지적은 rev 5로 해소됐다. 기준의 일곱 조회는 R-H가 꺼졌고, 창 및 셸 비용은 따로 관측했다.
- **열거 차이** §10의 14개 술어를 다시 실행했다. 같은 어휘에 걸리는 타입·주석도 포함한 원시 검색 결과다. [검색 좌표와 개수](evidence/r1.2-sweep.tsv)
- **착수 대조** 원격 추적 브랜치로 리베이스했다. 기준 `c7d2adf2`의 앱 소스를 독립 worktree에서 실행했다. [전후 측정](evidence/r1.2-measurements.md)

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.2)

| V pair / 강제 지점 | §10이 적은 지점 | 자기확인 | 이번 실행의 직접 관측 | 남긴 곳 |
|---|---|---|---|---|
| VP-01·13·16·22 / Q20 | ①~⑦ | `SELF_BLOCKED` | S-D1 제품 파일 핸들러→창 포트→`MentionAutocomplete`, 2만 항목·DOM 8행. R-H 끔으로 ⑦ 자리 0. | ①~⑥의 모든 카탈로그·토큰·watch 재연결 조합 |
| VP-02a·02b·14·17·20·24·26·28 / EP2·WL | EP2 ①~⑥ · WL ①~④ · EP11 ①~④ | `SELF_BLOCKED` | `ComposerInputController`, `useAttachments.views`, `client.lanes`, `client.queue`, 헤더 oracle 및 r1 Electron 원본. | 실제 입력 3종→원본 저장/재열기, 독립 레인 오류/취소 전 조합 |
| VP-03·09·15·21 / EP3·EP9 | EP3 ①~⑥ · EP9 ①~③ | `SELF_BLOCKED` | r1 계획 문단/댓글·입력 높이 Electron 증거 및 `planComments` 단위 경로. | 전후 동일 선택/본문 교체 재생, Windows IME |
| VP-04·13·16·22 / Q28 | ①~④ | `SELF_BLOCKED` | 제품 data 응답과 59행 사이드바, `session-1` 클릭 결과. `SearchModal.test.ts`의 지연 응답·검색 이동·스니펫. | DB 고정·삭제와 창, 검색어 2개 및 메시지 ID를 한 재생에서 연결 |
| VP-05·07·13·16·22 / EP5·EP7 | EP5 ①~③ · EP7 ①~③ | `SELF_BLOCKED` | r1 기존 codec과 일·주 집계 기록, 전체 Vitest의 폼·차트 테스트. | 동일 입력 전후의 실제 폼, 카탈로그, 차트 DOM·포인터·paint 및 데이터 집계 |
| VP-06·13·16·22 / Q30 | ①~③ | `SELF_BLOCKED` | 50개 저장·20개 전송, 100개 목록의 DOM 26행, `task-0` 상세. `RunHistoryPanel.interaction.test.ts`의 전환 시 응답 격리. | 보관 출력과 실행 ID·절단을 실제 전달부터 열기까지 연결 |
| VP-08·18·23 / EP8 | ①~④ | `SELF_BLOCKED` | `install-status.test.ts`에서 실제 Claude 완료 1건·로그 0건, 분할 출력이 terminal보다 앞섰다. r1 진단 대화상자 기록. | 실제 handler·포트·구독·archive가 통하는 전체 재생 |
| VP-10 / EP10 | ①~③ | `SELF_PASS` | `--shell`에서 존재 CSS·누락 CSS·SPA·루트 각각 250건 본문·MIME, BrowserWindow에서 deep link DOM 확인. | Windows 설치본은 0330 |
| VP-11 / EP11 | ①~④ | `SELF_PASS` | 레거시 언어·위치 복구, 정상 창 close 뒤 재개방, 실제 최소·최대 상태의 위치 보존, 회전·쓰기 거부·장애·종료 JSONL. | Windows 설치본은 0330 |
| VP-19·24 / EP10·EP11·EP2 | EP10 ①~③ · EP11 ①~④ · EP2 ①~⑥(VP-24) | `SELF_BLOCKED` | Linux 창 모드와 파일 동작 및 r1 첨부 파일 표시 회귀. | 호스트와 함께 설치 앱 재시작, 첨부 원본 재열기 |
| VP-12·25 / EP12 | ①~④ | `SELF_BLOCKED` | `--host` 및 `--compare` 기본 조합, 판정 함수 실측·누락·환경·출처 단언, 0330 링크. | S-D 전체 전후 구간, 프레임 누락 및 미측정 사례 |
| VP-27·29·30 / VL | ①~④ | `SELF_BLOCKED` | `useVirtualRows` 행 ID, `rowMount` 같은 행 수의 새 ID, `usePanelSelection` 공용 owner 안 형제·중첩 목록 보존. | 실제 DOM에서 높이 유지, 삭제·삽입과 드래그 후 모든 목록의 합성 oracle |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.2)

| 종류 | 대상 | 단일 변이·직접 oracle | 관측 |
|---|---|---|---|
| 새 oracle | R-H 창 비교 | 창 시간 비교 제거, `R-H uses elapsed host and window time` | `on`과 `off` 불일치 |
| 새 oracle | R-H 조사 경계 | `≥`를 `>`로 교체, 동일 테스트 | 50ms 경계 불일치 |
| 새 oracle | R-H 단위 | 창 합에 DOM 행 수 추가, 동일 테스트 | 큰 행 수에서 판정 불일치 |
| 새 oracle | EP12 구간 | T2 필수 조건 제거, `missing timing makes R-H and host-related R-R unavailable` | 누락을 검출 |
| 새 oracle | R-R task | T5를 동기 작업 판정에 넣음, `R-R uses task duration and synchronous processing` | 프레임 대기 단독 입력 불일치 |
| 새 oracle | EP12 출처 | 실제/진단 출처 비교 제거, `comparison checks build provenance` | 비교가 잘못 허용됨 |
| 인용 변이 | VL 행 키 | `getItemKey` 연결 제거, `uses stable row IDs` | 문자열 ID가 인덱스로 바뀜 |
| 인용 변이 | VL 선택 범위 | 목록 root를 스크롤 owner로 교체, `a newly mounted row only cancels the selection in its own list` | 형제 선택도 지워짐 |
| 새 oracle | VL 중첩 | 최인접 목록 확인 제거, 동일 테스트 | 중첩 목록의 선택도 지워짐 |
| 새 oracle | EP11 손상 | 상태 파일 `clearInvalidConfig` 비활성화, `--shell` | `SyntaxError` 및 진단 실패 |

선택 증거 0 · 인용 변이 2 · 새 oracle 8 · 별도 전수 sweep 0 = 표 10행. 이 표는 실제 수행한 교체 기록이다. 두 셸 pair의 직접 시나리오 결과는 측정 원본에 있다. 행마다 요구된 변이의 전수 실행은 남아 있다. [검사 결과](evidence/r1.2-gates.md)

## [구현자 기입] Product/UX 파생 검토 (r1.2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 기존 예약 행과 상세 창을 재사용했다. | 마지막 예약 상세를 실제 DOM ID로 확인. |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 행 선택과 스크롤 소유자는 각각 DOM ref로 전달된다. | 형제와 중첩 목록의 선택을 별도로 관측. |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 셸 상태 파일이 읽히지 않을 때 레거시 언어·위치를 승계한다. | 손상 파일의 전후 실제 값을 확인. |
| 실패가 화면에서 아무 일도 안 일어남으로 보이지 않는가 | 기본 한국어·좌표 없음, 레거시 승계, 자체 상태 복원 순서가 확인됐다. | 최소·최대 창은 기존 좌표를 보존했다. 로그 쓰기 거부는 실패 transport를 비활성화하고 한 번 기록했다. |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 기존 예약·검색 응답 격리 oracle을 재실행했다. | 포트 기반 두 입력의 같은 재생은 잔여. |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 파일 JSON 구문 오류가 자체 데이터 검증 이전에 예외를 일으켰다. | 셸 상태 store에 손상 복구 옵션을 적용했다. | S-D10b 기준 `SyntaxError`, 적용 `en/x=5`. |
| 2 | 공용 스크롤 owner로 선택 소유권을 판단하면 형제·중첩 목록의 선택을 지운다. | 가상 목록 범위와 가장 가까운 목록 경계를 사용한다. | `usePanelSelection.test.ts`에서 세 소유권 및 단일 변이. |
| 3 | 산출물 DOM 가시화 이후 기존 IPC 비용이 중앙값 50ms를 넘는다. | §19 기준 판정을 보존하고 적용 값과 응답 크기를 남겼다. | S-D4 산출물 행, 적용 호스트·포트 중앙값 79.0ms. |

### 설계 대비 명시적 차이

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 적용 목록에서 작은 목록으로 바뀌면 가상 row가 교체된다. | VL. 기존 같은 ID의 측정값 전수 재생은 잔여. |
| 공유 | 같은 sidebar scroller에서 부모·자식 목록이 함께 움직인다. | VL ④. 형제·중첩 범위 보존과 자기 범위 취소. |
| 재진입 | 뷰포트 밖 마지막 행이 DOM에 없다가 스크롤 뒤 나타난다. | Q28·Q30. 실제 마지막 ID의 클릭과 상세 DOM. |
| 다른 무효화 축 | 레거시 기준과 현재 저장 좌표가 다르다. | EP11 ①②. 일반 close 및 자체 상태 손상에서 결과가 각각 `x=37`, `x=5`. |

## [구현자 기입] 구현 보고 (r1.2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 사이드바·예약 가상 행, 선택 범위, 셸 상태 복구, data host/창 및 셸 측정, 관련 단위 테스트와 인계 문서 |
| 실행 명령 | `--host [--baseline]` · `--compare` · `--shell [--baseline]` · 통합 Vitest/스크립트 · lint/typecheck · CI 소스 가드 · 호스트/프리로드 smoke |
| **관측한 게이트 산출** | [r1.2 게이트](evidence/r1.2-gates.md) |
| **추가·수정 테스트의 subtree 규칙** | [r1.2 게이트](evidence/r1.2-gates.md) |
| V-pair 자기확인 | 위 강제 지점 표와 [전후 실측](evidence/r1.2-measurements.md) |
| 강제 지점 전수 | 14개 검색 술어 재실행, 선택한 단일 변이 10건 관측. 전체 자리와 변이의 연결은 잔여. |
| **AC 자기보고** | ✅ AC10·AC11. ⚠️ AC1·2a·2b·3~9·12~14. AC2a의 즉시 초안 정리·초점은 단위 시험에서 확인했다. 미리보기를 보류한 이미지 5개와 같은 창 재생은 잔여다. |
| **합계 검산** | ✅ 2 · ⚠️ 13 · ❌ 0 = 총 15 |
| 블로커 / 역질문 | Windows 설치본·IME·창 모드는 0330 인계. Linux 전후 전수 스윕 및 전체 경로 관측 잔여. 새 설계 결정을 요구하는 항목 없음. |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.2)

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가** 단위 누락은 rev 5에서 정의됐고 이번 턴은 실제 호스트·포트·창으로 재생했다.
- **그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가** AC11의 손상 JSON은 기존 상태 테스트에서 레거시 JSON 예외로만 재생됐고 실제 셸 store의 생성 경계는 관측하지 않았다.
- **반복해서 부딪히는 환경 한계** Linux 실행의 Windows 경로 의존 테스트, Windows 설치본의 창 모드와 IME 미측정.
- **현재 라운드·impl 턴** `r1.2`

## [구현자 기입] 설계 리뷰 (r1.3)

- **타당한 부분** 원본 전송과 미리보기 수명을 구분한 D-009 덕분에 파일 선택 대화상자가 수락 이후에 끝나는 경우까지 검증할 수 있었다. 같은 입력 작업 안에서 원본 5개를 전달하고 준비된 미리보기 2개를 저장했다.
- **이견 / 현실성 문제** R-H는 변경 전 일곱 조회에서 모두 꺼졌다. 적용 후 조회·렌더 비율이 달라진 화면도 기준 빌드의 결론을 사용했다. 사람 실기의 장비·주사율·IME는 0330이 소유한다.
- **열거 차이** 자원 목록의 행 선택과 드래그 범위에 공용 스크롤 부모가 관여했다. 실제 목록 root를 선택 범위로 연결하고 83px 행의 위·아래에 삽입·삭제를 재생했다. [§10의 14개 원문 검색 결과](evidence/r1.3-sites.tsv)
- **착수 대조** 원격 추적 브랜치에 리베이스했다. 기준 앱 소스는 공유 트리 `c7d2adf2`다. 비교에 쓴 입력, 소스와 반복 수는 [측정 기록](evidence/r1.3-measurements.md)에 있다.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.3)

| V pair | §10이 적은 지점 | 자기확인 | 직접 oracle과 관측 | 남긴 곳 |
|---|---|---|---|---|
| VP-01·13·16·22 | Q20 ①~⑦ | SELF_PASS | `composer-menu-query.integration`, `folder-observations`, `useMentionAutocomplete`, `--data-flows`. 실제 파일 생성 → rename → 삭제 → 디렉터리 교체 → 재개방. focus·포트 복구·cwd 전환, 메뉴 8개와 유효한 9번째 토큰을 구별했다. | ⑦ R-H 끔으로 신규 조회 0 |
| VP-02a·02b·14·17·20·24·26·28 | EP2 ①~⑥, WL ①~④, VP-24의 EP11 | SELF_PASS | `--interactions`, `--data-flows`, `--overlap`, `imageHeader`, `client.lanes`, `client.queue`. 세 입력마다 원본 5개·미리보기 2개, 늦은 입력 폐기, DB 재연결 후 버블 재구성. 4032×3024 이미지 작업 5개가 진행되는 동안 스트림 델타와 diff 스크롤이 모두 실행됐다. | 운영체제 한글 IME는 0330 |
| VP-03·09·15·21 | EP3 ①~⑥, EP9 ①~③ | SELF_PASS | `--geometry`, `--interactions`. 2,000문단·129댓글, 새 Text 노드에서 두 번째 같은 인용을 역방향 선택. 화면 밖 127번 댓글로 이동한 뒤 입력 초점과 저장 본문 일치. 2천·2만 자 작성·삭제, 폭·가림·팝오버 높이 왕복. | Windows 실기 0330 |
| VP-04·13·16·22 | Q28 ①~④ | SELF_PASS | `queries.test.ts`, `SearchModal`, `--host`, `--data-flows`. 두 FTS 응답의 세션·메시지 ID와 mark 스니펫, 빈 검색과 새 입력 직후 Enter, ArrowDown 후 두 번째 결과 선택. | 도착 행 스크롤은 0329 S-E5 |
| VP-05·07·13·16·22 | EP5 ①~③, EP7 ①~③ | SELF_PASS | `--panel-timings`, `--resources`, `--data-flows`. 설정 JSON 307,845자와 교정 위치 3행 3열, 지원 및 미지원 npm, 마지막 편집. 사용량 7·30·90·91·800일, 730일 상한, 당일 10과 모델 21, 포인터 값 10. | 호스트 질의가 없는 행의 T1·T2는 해당 없음 |
| VP-06·13·16·22 | Q30 ①~③ | SELF_PASS | `scheduled-task-queries`, `RunHistoryPanel.interaction`, `--host`, `--data-flows`. 50회 중 최근 20회, 보관 65,536자 문자열과 펼친 본문 일치. 연결된 세션, 없는 작업, 절단 표식, 작업 전환의 늦은 응답 대조. | R-H 끔 |
| VP-08·18·23 | EP8 ①~④ | SELF_PASS | `install-status`, `--installer`. 실제 Claude 완료 1건. 진단 실패와 재시작 성공을 별도로 재생했다. 각각 164,455바이트, 마지막 행, 오류·완료 순서, 빈 로그로 재시작, 스크롤 중간 위치와 콜백 횟수 대조. | 설치본 실기 0330 |
| VP-10·11·19·24 | EP10 ①~③, EP11 ①~④ | SELF_PASS | `--shell`. 자산·누락·SPA·루트 각 250회와 deep link DOM. 일반·최소·최대 창, 레거시·손상 상태, 주기 flush·회전·쓰기 실패·fatal·quit를 실제 파일에서 확인했다. | Windows 설치본 0330 |
| VP-12·25 | EP12 ①~④ | SELF_PASS | `measure-stage-d.test.mjs`, `--host`, `--compare`, `--resources`, `--panel-timings`. 누락·일치 경계·카운트와 시간 단위·프레임 대기·출처 교체 고장 검사. 항목별 전후 입력과 판정 불가 구간은 측정표에 기록했다. | 0330 장비 결과 미측정 |
| VP-27·29·30 | VL ①~④ | SELF_PASS | `useVirtualRows`, `usePanelSelection`, `--interactions`, `--host`, `--installer`. 삽입·삭제 후 83px 행의 DOM과 다음 행 위치 보존, 같은 행 수의 새 ID에 드래그 취소, 형제 선택 유지, 끝 행과 저장 출력 도달. | 해당 없음 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.3)

[변이별 실제 프로세스 종료값과 직접 oracle](evidence/r1.3-mutations.tsv) · [재생 명세](evidence/r1.3-mutations.jsonl). 표의 ID가 동일한 명세와 연결된다. 이전 라운드 수치는 합산하지 않았다.

선택 증거 31 · 이번 라운드 이슈 인용 변이 0 · 새 oracle 10 · sweep 183/183 = 표 224행. 명세 ID와 sweep 결과 ID의 양방향 차집합은 0이다. 단일 교체 결과는 red 182건, 실제 Dirent 유형 필터의 동치 green 1건이다.

## [구현자 기입] Product/UX 파생 검토 (r1.3)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 상태와 소비자 | 수락 당시 준비된 썸네일은 복원한 버블에도 나온다. 파일 3개는 기존 파일 표시를 쓴다. | 실제 송신 스냅숏과 재연결한 SQLite 세션을 비교. |
| seam 재배치와 정리 수명 | 선택 대화상자, 클립보드 읽기, 이미지 작업이 초안보다 오래 살 수 있다. | 수락·삭제·세션 전환 직후 각각 늦은 콜백을 실행. |
| 실패와 Part I 상태 전이 | 실패한 미리보기와 거부된 전송은 원본을 보존한다. 설치 실패는 다음 실행에서 복구한다. | 오류와 성공의 콜백을 별도로 계수. |
| 실패를 사용자가 구별할 수 있는가 | 깨진 settings JSON은 저장을 막고 교정하면 저장된다. 기존 검색 결과에 Enter를 눌러 잘못 이동하던 경로를 닫았다. | 3행 3열, 올바른 세션 선택을 대조. |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.3)

| 관측 | 대응 | 직접 확인 |
|---|---|---|
| 열린 파일 선택과 클립보드 읽기는 썸네일 취소 뒤에도 끝날 수 있다. | 수락한 초안을 비우면서 세대 증가. | 이전 선택 완료 뒤 새 첨부·초안 유지. |
| 검색어가 바뀐 직후 debounce 이전에도 이전 응답과 Enter가 들어온다. | 입력 이벤트에서 요청 세대와 화면의 선택을 함께 갱신. | 현재 결과·빈 검색·역순 응답의 이동 ID. |
| 관리 스킬 9천 행이 화면에 함께 마운트됐다. | 안정 ID를 갖는 제목·스킬 행을 실제 스크롤 부모에서 가시화. | 9회 모두 DOM 30행, 마지막 스킬과 9번째 모델 선택. |

### 설계 대비 명시적 차이

| 축 | 대체물에서 확인할 실패 모드 | AC·§10과 관측 |
|---|---|---|
| 만료 | 대화상자의 Promise나 이미 완료된 작업이 취소보다 늦게 돌아온다. | AC2a·2b / EP2. 제거된 ID에 후속 요청·결과 기록 0. |
| 공유 | 하나의 스크롤 부모 안에 목록과 형제 콘텐츠가 있다. | AC14 / VL. 형제 텍스트 선택이 유지됐다. |
| 재진입 | 이전 설치 로그나 뒤늦은 settings 가져오기가 다시 열린 화면에 섞인다. | AC5·8 / EP5·EP8. 최종 저장 값과 빈 로그의 초기 표시 확인. |
| 다른 무효화 축 | 같은 Markdown 문자열의 Text 노드가 교체될 수 있다. | AC3 / EP3. 새 링크에서 두 번째 `reference`의 UTF-16 위치와 편집 값 일치. |

## [구현자 기입] 구현 보고 (r1.3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 컴포저 첨부, 검색 입력, 관리 스킬·공용 가상 목록, 해당 단위 시험, Stage D Electron·호스트 진단 및 증거. |
| 실행 명령 | 앱 전체 lint·typecheck·Vitest·scripts 테스트, CI 소스 가드·번들·호스트/프리로드 smoke. Electron의 명령·입력·반복 수는 측정표에 기록했다. |
| **관측한 게이트 산출** | [r1.3 게이트](evidence/r1.3-gates.md) |
| **추가·수정 테스트의 subtree 규칙** | 위 게이트 표의 main/renderer/shared 및 진단 앱 경계. |
| V-pair 자기확인 | 위 강제 지점 표, [시나리오별 측정](evidence/r1.3-measurements.md), [실제 상호작용](evidence/r1.3-interactions.json). |
| 강제 지점 전수 | §10 14개 검색 술어와 변이 명세 ID를 [실행 결과](evidence/r1.3-mutations.tsv)와 대조했다. |
| **AC 자기보고** | ✅ AC1, AC2a, AC2b, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC12, AC13, AC14. 각 행의 직접 관측은 위 표 및 측정 기록에서 찾을 수 있다. |
| **합계 검산** | ✅ 15 · ⚠️ 0 · ❌ 0 = 총 15 |
| 블로커 / 역질문 | 구현 인계에 필요한 계약 결정 없음. Windows 설치본·한국어 IME·장비별 프레임은 0330에서 실측. 전체 Vitest의 기준선 실패는 게이트에 별도 기재. |
| 대상 커밋 | `(r1.3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.3)

- **이전 라운드와 같은 축** r1.2의 가상 행 ID와 선택 범위가 관리 스킬의 공유 스크롤 부모에도 필요했다.
- **해당 지침과 기존 관측** AC2a의 취소 시험에서 이미지 작업과 수락 시점은 확인했지만, 사용자가 열어 둔 대화상자에서 나중에 파일을 골랐을 때의 초안은 확인하지 않았다.
- **환경 한계** Linux에서의 Windows 경로·Claude 프로젝트 플러그인 테스트 실패와 실제 Windows IME·설치본 측정은 게이트 기록에 따로 남겼다.
- **현재 라운드·impl 턴** `r1.3`.

---

## [구현자 기입] 설계 리뷰 (r2)

D-013의 초안 소유자는 열린 컴포저다. `ComposerInputController`가 세션 B의 송신 콜백을 받아도 같은 첨부 수명 ID와 워커 요청을 사용한다. 수락 후 다음 초안으로 넘어갈 때와 실제 언마운트 때는 비동기 파일 읽기의 세대를 바꾼다. 대기 중 선택·읽기를 버리는 기존 수락 경계는 `EP2-draft-generation`과 `EP2-old-paste`에서 확인했다.

§10의 검색 술어 14개를 `app`의 production 소스에서 다시 실행했다. 이름·일치 줄 수·파일 수를 비교한 결과 r1.3 표와 차이가 없었다. 이번에 달라진 생산 경로는 컴포저 호출부와 훅의 정리 시점 두 곳이다. [§10 검색 결과](evidence/r1.3-sites.tsv)

## [구현자 기입] 강제 지점 전수 및 V-pair 자기확인 (r2)

아래 행의 자기 판정은 `SELF_PASS`다. 같은 행의 pair가 공유하는 입력과 각 판정 대상을 함께 적었다. [이번 실행의 Electron 관측값](evidence/r2-observations.json)

| pair | §10 자리 | 이번 실행의 직접 관측 |
|---|---|---|
| VP-01·13·16·22 | Q20 ①~⑦, Q28·Q30, EP5·EP7 | `folder-observations`에서 사건 3개·동일 창 구독자 2개에 창별 통지 1회. `useMentionAutocomplete`에서 다른 relDir의 읽기 증가 0회. `--data-flows`에서 생성·rename·삭제·교체 후 열린 메뉴와 실제 폴더 일치. 조회 입력은 아래 VP-04·06·07 행. |
| VP-02a·02b·14·17·31 | EP2 ①~⑥ | `AttachmentTray.test`의 inline 칩 3상태, `useAttachments.views`의 수명 ID·취소, `ComposerInputController.session.test`의 A→B 송신. Chromium의 선택·드롭·붙여넣기 세 경로에서 각각 전송 수락·거부, 원본 5개와 준비된 뷰 2개, 다음 초안과 세션 전환을 확인했다. |
| VP-03·09·15·21 | EP3 ①~⑥, EP9 ①~③ | `--geometry`에서 본문 2,000문단·댓글 129개, 끝 댓글의 표시·포커스와 인용 복원. `--interactions`에서 설정·댓글 입력의 긴 줄, 폭과 높이 변경, IME 및 팝오버 위치 검사. |
| VP-04 | Q28 ①~④, VL ①~④ | `--host`에서 세션·프로젝트·산출물 조회, `--data-flows`에서 동명 항목 중 duplicate-b 선택과 제거 뒤 session-9951 교체, 서로 다른 두 FTS 결과의 세션·메시지 ID 확인. |
| VP-05 | EP5 ①~③ | `--interactions`의 설정 307,845자와 오류 위치 [3, 3], 이전 가져오기 응답 폐기. 자원 1만 건 중 마지막 선택 resource-9999. |
| VP-06 | Q30 ①~③, VL ③ | `--host`의 예약·이력 조회와 `--data-flows`의 20회·65,536자·session-1. `RunHistory.virtual.test`에서 새 실행 삽입 뒤 기존 run.id 두 개 유지. |
| VP-07 | EP7 ①~③ | `--usage` 9표본과 `--data-flows`의 기간별 버킷·막대·총계·툴팁. 첫 commit 및 paint를 별도 필드로 기록했다. |
| VP-08·18·23 | EP8 ①~④ | `--installer`에서 실제 설치 완료 통지 1회, 실패와 재시작 세대별 164,455바이트·종료 각 1회. `InstallLog.virtual.test`에서 시작 offset 0·4·11과 세대 7→8 교체. |
| VP-10·11·19 | EP10 ①~③, EP11 ①~④ | `--shell`에서 자산의 본문·MIME 및 deep link 렌더 확인. 레거시·손상 복원, 최소화·최대화와 fatal·quit 마지막 로그가 재실행 결과에 남았다. |
| VP-12·25 | EP12 ①~④ | `--compare`가 일치한 기준·적용 호스트 입력 일곱 개를 읽었고 R-H는 일곱 개 모두 off. `measure-stage-d.test.mjs`가 단위·누락·경계 판정을 검사한다. |
| VP-20·28 | WL ①~④, EP2 ②③ | 이미지 헤더 및 레인 회귀, `--overlap`의 보류 이미지 5개와 스크롤·델타, 실제 워커의 썸네일 5개. `AttachmentTray.test`에서 준비된 JPEG만 img에 전달된다. |
| VP-24·26·27 (REGRESSION) | EP2·EP11, transcript, WL·VL | `--data-flows`에서 각 원본 종류의 저장 뷰 5개·미리보기 2개 재열기. `chatReducer.parts`, `chatStore.hostLifecycle`, `client.queue`, `client.lanes`, `usePanelSelection` 통과. `--shell`의 승계값과 `--interactions`에서 목록 밖 선택 보존. |
| VP-29·30 | VL ①~④ | 목록별 Vitest 여섯 곳에서 ID 확인. 프로젝트·세션·예약·산출물·설치 로그는 실제 virtualizer 옵션, 실행 이력은 실제 React 행 키를 읽었다. `--interactions`에서 삽입·삭제 뒤 같은 행 높이 83px, 목록 밖 선택 outside-list, 마지막 행 item-299. |

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

직전 verify의 이슈와 이번 재현을 연결했다. [변이별 결과 및 실패한 테스트](evidence/r2-mutations.tsv) · [재실행 명세](evidence/r2-mutations.jsonl)

| verify 1 | 이번 입력·검출된 변이 | 구현자 판정 |
|---|---|---|
| #1 칩 | V-I8-pending·V-I8-unavailable은 원본 base64를 HTML에 노출하면 실패. EP2-ready-chip은 준비된 JPEG를 제거하면 실패. | closed |
| #2 설치 로그 | V-V2-index·generation·offset에서 인덱스 대체, 세대 누락, offset 대체가 각각 실패. | closed |
| #3 목록별 키 | V-V1·V-V3·V-V4·V-V5를 각 화면의 Vitest에서 검출. 실행 이력의 run.id→taskId도 VL-history로 검출. | closed |
| #4 사건 묶기 | V-I4에서 같은 40ms 안에 넣은 사건 3개가 중복 통지되어 실패. | closed |
| #5 같은 창 중복 | V-I12에서 같은 창·같은 scope의 두 owner가 중복 통지를 받아 실패. | closed |
| #6 메뉴 필터 | V-I13에서 같은 cwd의 다른 relDir 신호가 목록 읽기를 한 번 늘려 실패. | closed |
| #7 세션 전환 | D013-session-reset 및 D013-send-session에서 전환 때 지우거나 A의 송신 콜백을 유지하면 각각 Vitest와 Electron에서 실패. | closed |

검산은 pair 선택 증거 32개, 인용 변이 9개(V-I8·V-V2·V-V1·V-V3·V-V4·V-V5·V-I4·V-I12·V-I13), 새 관측 지점 10개(칩, 목록 6, 컴포저 단위, Electron 세션 전환, 진단 최종 판정), sweep 76/76이다. 이 네 항목의 합은 127개이며 같은 변이가 여러 계약의 증거가 될 수 있다. sweep 명세와 실행 ID의 양방향 차집합은 비었다. 새 변이 19개와 이번 변경·오라클에 닿는 기존 변이 57개가 각각 exit 1을 냈다. [실행 표](evidence/r2-mutations.tsv)

## [구현자 기입] Product/UX 파생 검토 (r2)

컴포저의 작성 위치가 바뀌어도 첨부 두 개와 편집한 텍스트가 남았다. B에서 송신하면 B의 콜백만 한 번 호출되고, 수락 뒤 입력창과 칩이 비었다. 같은 이름을 다시 추가한 경우 제거된 첨부의 미리보기가 새 첨부에 붙는지 별도로 검사했다. 새 제품 결정 요청은 없다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

기존 훅 테스트는 세션 전환 자체가 취소 사유라고 단언했다. 이번에는 같은 이름 첨부의 교체와 실제 언마운트 취소를 유지하고, 전환 중 진행하는 작업과 활성 송신 대상을 컴포저 테스트에서 구별한다. 메뉴 통지의 시계와 창·scope를 고정해 파일시스템 이벤트 수가 OS에 따라 달라져도 F1·F2·F6을 재현할 수 있다.

## [구현자 기입] 구현 보고 (r2)

| AC 자기보고 | 이번 실행에서 확인한 결과 |
|---|---|
| ✅ AC1 | 폴더 변경 4종 반영. 동일 창·scope 중복 제거, 다른 relDir 재조회 0회. |
| ✅ AC2a·AC2b | 세 입력 경로 모두 수락과 같은 task에서 clear·초점. 원본 5개·준비된 뷰 2개를 저장 뒤 다시 열었다. |
| ✅ AC3·AC9 | 마지막 댓글·선택 복원, 가시 댓글 rect만 재측정. 입력 길이·폭·조합·팝오버 시나리오 통과. |
| ✅ AC4·AC6 | 호스트 조회와 실제 data 포트의 목록 선택·검색, 예약 이력 20회 및 보관 출력 확인. |
| ✅ AC5·AC7 | 마지막 편집과 오류 위치, 자원 선택, 사용량 기간별 버킷·툴팁 관측. |
| ✅ AC8 | 설치 세대교체 시 행 키가 갱신되고 세대별 로그·종료를 보존. |
| ✅ AC10·AC11 | 셸 자산, deep link, 재실행 및 손상 복원과 마지막 로그 재생. |
| ✅ AC12 | 호스트 7개 기준·적용 비교, 이미지·패널·자원·셸 시나리오 재실행. |
| ✅ AC13·AC14 | 실제 워커 썸네일 5개, 원본 칩 노출 변이 검출. 목록 6곳이 도메인 ID 또는 세대·offset을 사용함을 확인. |
| ✅ AC15 | 준비 중 1개·준비됨 1개와 편집 텍스트를 A→B로 유지하고 두 번째 응답을 받은 후 B에서 전송. |

✅ 16 · ⚠️ 0 · ❌ 0 = 총 16. ΔV1에서 AC15가 추가되어 이전 분모는 15였다. 리눅스의 기준선 차이와 게이트 수치는 아래에 기록했다. Windows 설치본과 OS 한글 IME 실측은 0330의 담당 범위다.

| 통합 게이트 | r2 결과 |
|---|---|
| 운영 검사 | CI 가드 5종, node·web·test 타입 검사, 진단 TSX 타입 검사 성공. 전체 ESLint 오류 0·기존 경고 12. |
| Vitest | 핸드오프 집중 검사 11파일·34개 성공. 파일 필터 없는 전체 실행은 Linux 격리 컨테이너, Node 24.19.0에서 통과 10,747·예상 실패 1·생략 11·실패 22. 기준 `c7d2adf2`와 실패 이름 양방향 차집합 0개. 미처리 거부 1건의 오류 메시지와 첫 소스 위치 `native-resources.ts:152`도 기준과 동일. |
| 스크립트·번들 | `node --test --test-concurrency=3 scripts/*.test.mjs` 1,104개 통과. `electron-vite build`, `smoke-hosts`, `smoke-preload` 성공. |
| 진단 | Linux Electron 39.8.10에서 호스트·데이터 흐름·사용량·상호작용·설치·셸·목록·자원·패널 타이밍·기하·동시 작업·이미지 시나리오와 기준 호스트 비교에서 모두 `verdict: true`. |

## [구현자 기입] Review Signals — 사실만 (r2)

verify 1의 칩·로그 키 변이와 VL ③ 잔여 네 목록을 Electron ABI 없이 검출했다. Native SQLite가 필요한 호스트 진단은 같은 Electron 버전의 바이너리로 재실행했다. 라운드 2 구현 인계는 `IMPL_DONE`이며 독립 판정은 검증자에게 있다.

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| 1 | `준비 중` 칩에 원본 data URL을 넣어도 composer vitest 251·`--interactions`가 green (V-I8) | VP-14·17 / §10 EP2 ④ “칩(원본 data URL 금지)” · AC13 | 칩 미리보기가 `준비됨` 썸네일만 쓰는지 단언 | 이행 | BLOCKING | 열림 |
| 2 | 설치 로그 행 키를 인덱스로 바꿔도 backend vitest·`--installer` green (V-V2) | VP-29 / §10 VL ③ “로그 조각 = 실행 세대+시작 offset” · AC14 | 재시작·같은 개수 교체에서 마운트 알림·측정 높이 단언 | 이행 | BLOCKING | 열림 |
| 3 | VL ③ `session.id`·`project.id`·`artifactFileId`·`task.id` 키 변이(V-V1·V1h·V3~V5)는 `--host` 미실행으로 판정 불가 | VP-29 / §10 VL ③ | 다음 verify ⑦ 잔여. 구현자는 `--host`·vitest 좌표로 자리별 red를 보고 | — | ⑦ 잔여 | 열림 |
| 4 | 폴더 통지 사건 묶기 가드 제거(V-I4) 못 잡음 | VP-16 / Q20 4단계 2 “연속 사건을 묶고” | 설계자가 채택(F2에 통지 수 단언) 또는 경계 선언 | 확장 | PLAN_GAP | 열림 |
| 5 | 같은 창·같은 scope 통지 중복 제거 무력화(V-I12) 못 잡음 | VP-16 / Q20 F6 | 채택 또는 경계 | 확장 | PLAN_GAP | 열림 |
| 6 | 창 통지 필터의 relDir 조건 제거(V-I13) 못 잡음 | VP-16 / Q20 F1 | 채택 또는 경계 | 확장 | PLAN_GAP | 열림 |
| 7 | 세션 전환 시 초안 텍스트는 남고 첨부만 비워진다(변경 전엔 둘 다 남음) | VP-14 / D-002 · §13 | 사용자 결정 필요 — 첨부를 텍스트와 같이 둘지 | 확장 | PLAN_GAP | 열림 |
