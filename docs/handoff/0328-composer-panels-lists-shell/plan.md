# 0328 · 컴포저·패널·목록·셸 응답성 (단계 D)

**DRAFT · Baseline V1 rev 3.** 첨부·댓글·입력 높이·설치 로그·셸과 목록 화면의 작업 및 검증 단위를 작성했다. 측정 결과에 따라 T20·T28·T30의 공개 조회 계약을 추가할 수 있는지 D-004에서 사용자 결정을 받는다.

## 메타

| 항목 | 값 |
|---|---|
| slug / 날짜 | `0328-composer-panels-lists-shell` / 2026-11-20 |
| 기준 트리 | `62125eaa` (0326 r2 verify FAIL, 0327 V1 plan READY). 착수 시 영향받는 파일과 채널의 변경만 재대조 |
| V mode / 기준 V / 이번·유효 revision | Baseline V / 없음 / V1 rev 3 초안. 0325의 A·0327의 C는 별도 V |
| 다음 주체 | 사용자(D-004 선택). 선택이 정해지면 설계자가 해당 조회 계약과 Q20 변경 전달 배선을 잠근다. 비기능 구현 담당은 0325 §6-C 기준 Claude. T21의 공통 워커 변경은 C와 조율 |
| 입력 | [0325 계획 §6-C·D](../0325-ui-responsiveness-followup/plan.md) · [원 요청서 T20~T33와 셸](../0325-ui-responsiveness-followup/input/0324-agent-requests.ko.md) · [실행 위치 감사](../0325-ui-responsiveness-followup/input/0324-audit.ko.md) · [0327 공통 워커 계약](../0327-worker-protocol-visible-views/plan.md) |

# Part I · 제품 및 사용 흐름

## 1. 목표

긴 계획서에서 댓글을 쓰거나 이미지를 붙여넣고 바로 전송할 때, 화면이 새 입력을 받을 수 있어야 한다. 메뉴·목록·설정·셸은 기존 결과와 데이터 보존을 지키면서 입력·commit·paint·디스크 작업 중 어디에 시간이 걸렸는지 나누어 판단한다.

## 2. 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 사용자 | 0327 구현 전에 0328 D·0329 E·0330 W를 별도 계획으로 작성. 현재와 변경 후를 사용자 시나리오로 설명. 단계 D의 제품 레퍼런스는 VS Code | 이번 대화 |
| 승계 | D가 맡는 아홉 T행과 셸 세 항목. T21 작업 수·실패 폴백은 A에서 완료. 조건부 이주는 입력 크기·실측으로 판정 | 0325 §6-C·D, D-012·D-019·D-029·D-041·D-043 |
| 설계 제안 | 상한 초과 경로만 채택하는 조회·전송 방식과 테스트 입력. 기기별 최종 허용치는 0330에서 사용자 판정 | §3 D-004, §19 |

## 3. 결정 기록

| ID | 결정·조건 | 출처 | 상태 |
|---|---|---|---|
| D-001 | D 전체를 이 handoff에 두고 구현·Windows 최종 판정은 각 소유 단계에 둔다 | 사용자 확정, 0325 §6-C | ACTIVE |
| D-002 | 전송 스냅숏의 원본·순서와 최근 편집을 보존한다. 크기 검사 후 워커가 축소·인코딩하고 실패한 첨부는 파일 표시로 남긴다 | T21, 0325 D-012·D-041 | ACTIVE |
| D-003 | DOM 위치·댓글 선택·읽는 중인 스크롤은 창이 소유한다. 설치 전체 출력은 기존 실행의 수명 안에 보존한다 | T24·T32·T33 | ACTIVE |
| D-004 | **결정 요청**. T20·T28·T30에서 §19 측정이 원인을 확인한 경우 (가) 기존 호출과 전체 열람을 유지하면서 제한된 추가 조회를 사용(추천), (나) 기존 공개 계약으로 국한해 창에서 가시화를 개선하고, 여전히 초과하면 해당 항목만 재설계. 가·나의 사용자 흐름은 §5 | 0325 D-029, 요청서, 설계자의 선택지 | **OPEN** |
| D-005 | T29·T31·T33와 셸의 측정 우선 항목은 §19 입력과 구간별 비용으로 유지·수정을 기록한다. 0327은 테마 재강조, D는 입력 높이를 맡는다 | 0325 D-019·D-043, 0327 D-016 | ACTIVE |
| D-006 | 제안 예산은 §14에 둔다. 성능 측정·진단 fixture에는 본문·경로·기밀 설정값을 수집하지 않는다 | 설계자, 실행 모델의 계측 계약 | ACTIVE |
| D-007 | 단계 D의 제품 레퍼런스는 VS Code다. 파일 후보는 현재 폴더를 열어 둔 채 외부에서 생성·이름 변경·삭제해도 갱신한다. 입력 높이·대량 목록·설치 로그는 §8의 대응 동작을 참조한다 | “D는 vscode를 레퍼런스로 따를 것” · 사용자 보고, VS Code 1.100.0 소스(§8) | ACTIVE |

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
| **메뉴**. 파일 2만 개가 있는 폴더에서 `@src`를 입력하고 두 번째 후보를 선택한다 | 디렉터리 목록을 받은 창이 접두사·숨김 규칙을 적용해 파일 최대 8개를 띄운다. 슬래시·플러그인·모델은 서로 다른 후보 집합을 쓴다 | (가) 초과 시 목록 소유자가 같은 순서의 제한 결과를 주고 같은 키로 선택한다. (나) 창에서 같은 후보를 일찍 찾아도 첫 전체 목록 전송은 남는다. 목록 밖에서 직접 붙여넣은 유효 파일·선택 모델의 장식은 두 안 모두 보존 |
| **새 파일**. `@new` 목록을 열어 두고 외부에서 `new-file.txt`와 `new-dir/`를 만든 뒤 파일 이름을 바꾸고 폴더를 삭제한다 | 처음 읽은 폴더 이름이 창에 남는다. 입력을 다시 열어도 새 이름이 빠지고 삭제된 이름이 계속 보일 수 있다 | VS Code 탐색기의 변경 처리 방식을 따라 data가 활성 폴더의 변화를 감지해 목록을 다시 읽는다. 이름이 바뀌면 새 이름으로, 지우면 후보에서 사라진다. 같은 목록에서 연속 타이핑하는 동안에는 이미 확보한 후보를 필터한다 |
| **이미지**. 5장을 붙이고 바로 전송한 뒤 다음 메시지를 입력한다 | 창이 첨부 원본에서 썸네일을 만들고 전송 승인 후 초안 revision을 검사한다. 선택 직후 미리보기는 별도로 원본을 읽는다 | 워커가 픽셀 예산 안에서 작은 미리보기를 준비한다. 전송 시점의 원본 5장은 같은 순서로 도착하고 실패 이미지만 파일로 보인다. 이전 요청의 완료는 새 초안을 비우지 않는다 |
| **계획 댓글**. 긴 계획에서 두 문단에 걸쳐 코멘트를 달고 폭을 끈 다음, 목록에서 화면 밖 댓글을 다시 연다 | 폭이 바뀔 때마다 모든 댓글을 문서 처음부터 찾아 rect를 읽는다 | 본문 revision에 묶은 오프셋 색인으로 같은 인용을 찾고 가시 부분만 프레임당 한 번 잰다. 목록 선택은 원 위치로 스크롤한 뒤 해당 댓글을 연다 |
| **탐색·카탈로그**. 고정한 세션과 최근 세션을 보다가 프로젝트를 고정하고 산출물을 두 단어로 검색한다 | 창이 전체 목록에서 고정 섹션·순서와 일치 결과를 만든다. 본문 검색은 별도 150ms 지연·최대 30건 | (가) 초과 시 data가 같은 정렬·필터를 페이지로 반환한다. 고정 변경 뒤 선택한 ID와 위치를 보존하고 다음 페이지에서 나머지를 읽는다. (나) 화면의 행만 그려도 전체 목록 이동·정렬은 남는다 |
| **설정**. 스킬·MCP·모델 목록을 바꾸고 공급자 JSON을 붙여넣는다 | 창에서 정렬·폼 파싱을 진행한다 | 계산이 예산 안이면 유지한다. 초과한 큰 JSON은 워커로 검증해 마지막 입력의 유효한 결과만 같은 폼에 채운다. 작은 입력, 엔진 선택과 오류 설명을 보존 |
| **예약**. 실행 이력을 열고 실패한 실행의 긴 로그를 읽는다 | 최근 실행 최대 20건의 저장 출력을 함께 싣고 각 출력 전체를 `pre`로 그린다 | (가) 초과 시 현재 화면에는 상태·짧은 끝부분을 보이고 선택한 실행만 보관된 출력을 읽는다. (나) 같은 전체 응답을 쓰되 상세 DOM을 늦게 만든다. 양쪽 모두 저장 때 잘린 앞부분은 절단 표시가 남는다 |
| **차트·로그·입력 높이** | 기간 전환은 창에서 일/주 집계 후 차트를 그리고, 설치 출력은 올 때마다 맨 아래로 이동한다. 긴 입력도 값마다 높이를 읽는다 | 차트는 실제 병목 구간만 바꾸고 포인터·총계를 보존한다. 설치 로그에서 위로 읽던 문장은 유지하고 하단으로 돌아가면 새 출력을 따른다. 보이는 입력은 폭·최신 값에 맞춰 커지고 숨은 입력은 다시 보일 때 갱신한다 |
| **셸**. 앱을 열고 자산을 읽고 창을 닫았다가 다시 연다 | 확장자가 있는 경로는 동기 파일 확인을 거친다. 최초 설정 승계·종료 시 위치 저장·정상 주기 및 장애 로그 쓰기 주체는 각각 다르다 | 비용이 확인된 작업을 먼저 줄인다. SPA 직접 진입, 누락 자산의 기존 fallback, 이전 창 위치·언어, 종료 직전까지 기록된 로그를 그대로 복원한다 |

**전이.** 입력·페이지·JSON 요청은 세션/폼/작업과 세대를 함께 갖고 로딩→결과·빈 결과·기존 오류 표시로 간다. 뒤늦은 이전 응답·닫힌 팝오버의 응답은 폐기하고, 실패 뒤 같은 현재 입력으로 재시도한다. 첨부 썸네일 실패는 해당 썸네일만 생략한다. 설치 종료는 마지막 출력 → done/error → 버튼 상태 순서를 지킨다.

## 6. 범위와 단계 경계

T20 메뉴, T21 잔여, T24 댓글, T28 목록, T29 설정, T30 예약 목록·이력, T31 사용량, T32 설치 로그, T33 입력 높이와 S-D10의 셸 세 항목을 맡는다. T28은 본문 검색 결과·스니펫과 기존 대화 선택을 보존한다. 상단 검색에서 미로딩 메시지로 직접 이동하는 방식과 비용은 [0329 §8·§17](../0329-turn-history-paging/plan.md)에서 검토한다. T27 산출물 **본문**, T33 테마는 C의 범위다.

0320의 `ScheduleTaskModal.save` 중복 저장과 `shell-runner`의 프로세스 종료 조건은 조회 전용 T30 경로에 없다. 0327의 완료된 대형 Markdown 블록 후보·0326의 승인 순서 후보는 이 계획에서 승격하지 않는다. D에서 0327의 공유 워커를 쓰는 지점만 실제 규약과 대조한다.

## 7. 요구와 인수 기준 (R ↔ AT)

ID n의 R-n·AT-n은 같은 행을 가리킨다. 조건부 이주는 진단 입력과 분기 근거를 남긴다. 기준 안인 화면은 동작과 실측을 기록한 뒤 종결할 수 있다.

| AC | 행동 기준 | 검증 입력 → 관측 / 실제 경로 |
|---|---|---|
| AC1 | 열린 메뉴에서 생성/삭제/이름 변경을 반영하고, 재방문·감시 중단 후에는 디스크와 재대조한다. 키보드·초점·앵커와 완성 파일 토큰의 유효성을 보존 | S-D1. 대/소문자·숨김 점·따옴표 경로·늦은 prefix·후보 밖 파일·슬래시·plugin·모델 → 실제 메뉴의 ID/순서·토큰·커서. §10 Q20 |
| AC2 | 선택·놓기·붙이기 후 즉시 전송해도 원본/뷰 순서·최근 수정 보존. 미리보기 작업은 §14 예산 이내 | S-D2. 서로 다른 이미지 5장·오류·한도 경계·같은 이름 교체·IME·전송 거부 → 컴포저 송신 인자와 전송 후 표시/포커스. EP2 |
| AC3 | 인용의 UTF-16 시작·끝과 클릭 위치를 보존. 같은 프레임의 폭 변화는 한 번, 화면 밖 주석 rect는 읽지 않음 | S-D3. 문단·링크·이모지·동일 인용 2곳, 생성·취소·편집·원문 교체 → 실제 선택/버튼/편집 팝오버. EP3 |
| AC4 | 프로젝트·세션·고정 목록·전역 산출물 필터·순서·검색 선택이 유지됨 | S-D4. 결과 경계에서 고정 전환·삭제·중복 제목·두 단어 검색·이전 쿼리 지연 → 페이지 결합 ID와 전건 기준 일치. Q28 |
| AC5 | 큰 설정·카탈로그에서 정렬·선택·폼 오류·마지막 편집 보존 | S-D5. 유효/깨진 JSON·지원/미지원 npm·늦은 결과·빈 목록 → 저장 전 폼 값/오류와 원래 순서, 비밀값 로그 부재. EP5 |
| AC6 | 예약 목록·실행 이력·보관 출력·절단·실행 버튼의 기존 의미 보존 | S-D6. 없음·성공·실패·건너뜀·출력 없음·동명 작업·상세 전환 → 표시한 실행 ID, 보관된 끝부분 및 절단 상태가 DB와 일치. Q30 |
| AC7 | 기간/모델 총계, 일·주 단위, 포인터 값을 유지하고 첫 commit과 paint를 분리 | S-D7. 자료 없음, 7일·30일·전체 90/91일·730일 이전 자료 → 제품 화면 합계와 차트 자료. EP7 |
| AC8 | 로그 폭주 때 읽던 위치, 종료·오류 순서와 실행 중 전체 출력을 보존 | S-D8. 줄 경계 없는 큰 조각·분할 줄·빈 log·오류+done·재시작 → archive 연결값·화면 tail·첫 이벤트/마지막 이벤트 순서. EP8 |
| AC9 | 가시 입력은 최신 내용과 폭에 맞고 숨김→표시 뒤에 복원. 선택·한글 조합·팝오버 위치 유지 | S-D9. 긴 줄·삭제로 축소·연쇄 수정·폭 변경·숨김·언마운트 → 높이·포커스·측정 횟수. EP9 |
| AC10 | 기존 자산과 deep link·누락 경로가 동일 콘텐츠를 연다. 비용 초과 시 동기 존재 확인을 정상 요청에서 제거 | S-D10a. 존재 CSS, 누락 CSS, 확장자 없는 경로, 루트 → protocol.handle 결과의 본문/형식. EP10 |
| AC11 | 레거시 언어·위치 승계, 창 닫기 복원과 종료·장애 기록 보존 | S-D10b/c. 낡은 키·없음·손상·일반/최소/최대 창·주기 flush 중 quit/fatal → 재시작 값과 실제 로그의 순서·개수. EP11 |
| AC12 | 항목별 입력·전후 빌드·비용·처리 결론과 미측정을 분리하고 W로 전달 | S-D1~10 전부. §19 trace/재현 규약 → 결과표, 사람 실기. 작동하지 않는 실제 생산자(T32)는 진단표와 나누어 기록 |

## 7-A. Baseline V · 노드와 검증쌍

R-01~12/AT-01~12는 §7 각 행, 해당 VP-01~12는 모두 NEW/REQUIRED다. 그 행의 실제 진입점·입력·판정은 §7, 자리와 테스트 좌표는 §10의 같은 AC 행, 실기 조합은 §19의 같은 시나리오다. AC12는 실행 측정 기록 자체를 대상으로 한다.

| Pair | 노드(좌↔우) / 출처 | requiredness | 실제 경로 / 직접 증거 / 강제 지점 |
|---|---|---|---|
| VP-13 | SD-01 ↔ ST-01 · NEW | REQUIRED | 사용자 입력·전환 → 요청 세대 → 응답·취소 → 선택 또는 오류. §10 Q20·Q28·Q30·EP5 |
| VP-14 | SD-02 ↔ ST-02 · NEW | REQUIRED | 사진 선택·paste/drop → 전송·동시 편집 → 수락/거부 → 버블/초안. EP2 전 자리 |
| VP-15 | SD-03 ↔ ST-03 · NEW | REQUIRED | 댓글 선택/폭·스크롤 변경 → 가시 측정 → 클릭·편집 / 긴 설정 입력 → 높이 조절. EP3·EP9 |
| VP-16 | AR-01 ↔ IT-01 · NEW | REQUIRED | data·agent 소유 조회 → 포트 → 메뉴/목록·예약/차트 UI, 구 호출도 실행. Q20·Q28·Q30·EP5·EP7 |
| VP-17 | AR-02 ↔ IT-02 · NEW | REQUIRED | 첨부별 원본 → 실제 워커 요청·응답 → 첨부 뷰·컴포저. EP2 |
| VP-18 | AR-03 ↔ IT-03 · NEW | REQUIRED | 설치 어댑터 → agent 상태 전송 → R 구독 → 로그 화면·최종 상태. EP8 |
| VP-19 | AR-04 ↔ IT-04 · NEW | REQUIRED | 셸 요청·기동·창 닫기·flush → 실제 파일 → 다시 열기. EP10·EP11 |
| VP-20 | MD-01 ↔ UT-01 · NEW | REQUIRED | 형식별 치수/픽셀 합 → 축소 또는 썸네일 없음. EP2 ②③ |
| VP-21 | MD-02 ↔ UT-02 · NEW | REQUIRED | UTF-16 경계·revision/가시 범위 → 인용/rect/측정 예약. EP3, EP9 |
| VP-22 | MD-03 ↔ UT-03 · NEW | REQUIRED | 질의·정렬·cursor·변경 ID·세대 → limit과 결과, JSON→폼, 일/주 경계. Q20·Q28·Q30·EP5·EP7 |
| VP-23 | MD-04 ↔ UT-04 · NEW | REQUIRED | 출력 조각 → archive/tail/terminal + 스크롤 anchor, 재시작. EP8 |
| VP-24 | SD-04 ↔ ST-04 · INHERITED (0325 AC17·AC18, 0324 셸 상태) | REGRESSION | 원본 전송/썸네일 실패·셸 재실행 시 승계값 복원. EP2·EP11 |
| VP-25 | AR-05 ↔ IT-05 · NEW | REQUIRED | 시나리오 입력 → 실제 앱/진단 빌드의 이벤트 구간 → S-D 기록·W 인계. EP12 |

오라클이 배선이나 횟수를 확인하는 EP2(창 인코더 호출·픽셀 예산), EP3·EP9(가시성), EP8(종료 전 flush), EP12(실제/진단 표식)는 §10에 명시한 자리 변이를 추가한다. 그 밖의 쌍은 서로 다른 관측값을 비교하는 직접 행동 시험과 저장소의 열거 sweep을 사용한다. `git diff --check`, 문서 링크·표·보드·커밋 trailer 및 이후 구현의 subtree/통합 gate는 §19에 둔다.

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
| 조회 | R 전체 목록 → R 필터/마운트 → data/agent의 제한된 조회(승인·측정 시) 또는 같은 응답·가시 행만 렌더 | `shared/channel-owner.ts`에서 data는 파일·관리/DB, agent는 native 상태. 기존 전건 소비자는 기존 경로 |
| 첨부 | DOM 이미지 디코드 → worker가 입력 형식과 픽셀 예산을 점검하고 작은 JPEG 반환 → R 표시/송신 | OS 대화상자 main, 파일 읽기 data, 원본 첨부의 실제 검증·전송은 기존 agent. D는 표시 사본 변경 |
| 주석·높이 | 반복 DOM 탐색 → 본문 색인 + 가시 위치 확인/측정 예약 → 선택 복원 | text node·Range·textarea의 소유자는 R. 배율·레이아웃·폰트는 브라우저에서 관측 |
| 설치 | 어댑터 → agent 묶음 → 기존 상태 채널 → 분할 로그 archive·가시 창/최종 상태 | 설치 진행 중 출력은 해당 실행/다이얼로그 수명 안에 보존. 진단용 로그 파일에 복제하지 않는다 |
| 셸 | protocol, 창·로그 개별 수명주기 → 구간별 비용·조건부 비동기 개선 | main 내부. 호스트 승계·종료 순서/파일 권한·포트 소유자 보존 |

## 10. 계약과 강제 지점

아래 검색은 `app/`에서 `rg -n -g '!*.test*' -e '<술어>' src`로 실행한다. 검색 출력에서 예시·타입 선언·다른 도메인 소비자를 구분한 뒤 아래 **역할과 운반 값**으로 분류한다. 각 행은 위 §7-A의 모든 참조 쌍에 적용한다. 좌표는 구현 때 추가할 테스트의 파일명·진입점이다. UI·레이아웃은 진단 Chromium/Electron에서 실제 DOM·가시 화면으로 관측한다.

| 지점 · 검색 술어 | 계약을 운반하는 자리(번호순) | 직접 oracle · 구별 입력과 관측 |
|---|---|---|
| Q20 · `filesList\|nativeResources\|composerCatalog\|validFilePaths\|Menu\|Autocomplete` | ① data 파일/관리 질의 및 agent native 카탈로그 ② 포트·캐시(cwd·디렉터리·하네스·세대·query key) ③ 메뉴 소비자(파일/스킬/플러그인/모델) ④ 전체 유효 ID 장식·확정 토큰 ⑤ 활성 폴더 watcher→무효화·재조회 ⑥ 구독 종료/복구→포트·창 수명 정리 | 신규 `composer-menu-query.integration.test.ts` + S-D1. 임시 디렉터리와 실제 카탈로그로 ①②, `@src`·`@.s`·따옴표·빈 prefix·슬래시·모델 재조회로 ③④. 9번째 유효 파일 장식·모델 선택과 순서, ⑤⑥의 열린 창 변경/기한 만료/재접속 결과는 아래 F1~F5에서 단언 |
| EP2 · `AttachmentView\|attachmentPreviews\|readAttachment\|image/\|compositionActive` | ① 대화상자·drop·paste→초안별 첨부 ID/표시 요청 ② path/inline 소스→작업 수·픽셀 예산→워커 ③ 성공/실패→256px 이하 JPEG 또는 파일 표시 ④ submit snapshot·원본/뷰 순서→onSend→승인/거부·revision 검사 및 clear | 신규 `attachmentWorker.integration.test.ts`(실 worker), `ComposerInputController.test.ts` 보강, S-D2. ① 같은 이름 A/B 삭제·재추가, ② 형식별 정상·치수 누락·예산 ±1·동시 5장, ③ 거절·worker 오류, ④ IME/초안 교체·거부. 원본 bytes/ID·표시·최대 동시 픽셀 관측. 예산 확인을 decode 뒤로 이동하거나 성공/실패 응답 교환 시 검출 |
| EP3 · `contentRef\|contentKey\|offsetsFromSelection\|rangeFromOffsets\|rectsForRange\|ResizeObserver` | ① Markdown 전용 본문 revision→Text 색인 ② 선택→offset/quote 및 역방향 Range ③ 가시 문단+댓글→프레임 예약/rect ④ 활성 댓글 이동→재측정→팝오버/초점 | 신규 `planCommentGeometry.browser.test.ts`(진단 브라우저 케이스), S-D3. 본문·overlay를 구분하고 새 DOM/같은 문자열·이모지·역방향·경계·빈 주석·다른 폭을 준다. offscreen Range 측정 추가, 동일 인용 두 곳 교환, rAF 병합 제거가 각각 red |
| Q28 · `sessionList\|projectList\|artifactCatalog\|setPinned\|searchMessages\|navSections` | ① data DB 필터/안정 정렬·고정 변경 ② 응답/변경 ID→공유 store ③ nav 섹션·프로젝트 화면·전역 산출물 목록의 가시 선택 ④ 별도 본문 검색→선택 ID/스니펫 | 신규 `catalog-page.integration.test.ts` + S-D4. 임시 DB에서 같은 제목·날짜, 고정 전환, 경계행 삭제, 2검색어·상충 요청, 빈 페이지. 전건 정렬 기준과 ID 순서·중복·선택 ID를 비교 |
| EP5 · `importedProviders\|CustomizeList\|EngineModelList\|extensionCatalog` | ① 관리·native 자원 조회→정렬/필터/선택 ② 편집 revision→형식 검증 ③ 결과/오류→현재 폼→사용자 저장 | 신규 `provider-import-flow.test.ts` + S-D5. 정상·지원 안 하는 npm·문법 오류·느린 이전 입력·비밀 표식 입력에서 실제 폼 모델, 마지막 선택·로그 필드를 관측 |
| Q30 · `scheduledTask\|listRuns\|outputTruncated\|RunHistory` | ① data 목록/최근 실행·해당 task/run의 보관된 출력 ② 포트→조회 revision·순서 ③ 목록/상세 출력과 절단 표시·다른 session 열기 | 신규 `schedule-history-page.integration.test.ts` + S-D6. 출력 '', 짧음, 65,536바이트·절단 true, 타 task id, 사라진 run, 재탐색. DB 실데이터→DOM/동작으로 비교 |
| EP7 · `usageStats\|fillDailySeries\|aggregateWeekly\|TokensPerDayChart` | ① data 질의·원 집계 ② chart 기간/주 파생 ③ 기간 UI·총합·모델·tooltip paint | `UsageTab.chart.test.ts` 보강 + S-D7. 비연속 날짜·0일·90/91일·730일·과거 합계·누락 모델, DB 원본/표시값 대조. 일 10 토큰과 모델 21 토큰 등 서로 다른 지표 사용 |
| EP8 · `installStart\|installStatus\|InstallStatus\|adapter.install\|installApi.onStatus` | ① agent의 어댑터 스트림→버퍼 ② flush→기존 타깃 포트·done/error ③ installApi 구독→조각 archive/최근 행 ④ 읽는 위치/하단/재시작·완료 콜백 | 신규 `installer-status-flow.integration.test.ts`, S-D8. 가짜 어댑터만 주입, 실제 handler/포트/구독/대화상자 통과. 중간 줄바꿈·65KiB 무개행·두 run·error+done. archive 원문, tail, anchor와 terminal 사건 수 비교. terminal 앞 flush 제거·마지막 조각 순서 교환 시 red |
| EP9 · `scrollHeight\|AutoGrowTextarea\|PlanCommentPopover` | ① 일반 설정 textarea·② 계획 댓글 textarea의 값/폭/가시성→높이 ③ 댓글 overlay의 anchor→팝오버 배치 | 신규 `auto-height.browser.test.ts` + S-D9. 0→20,000자→2자, 숨김→폭 변경→표시, IME 조합·언마운트. 실제 박스 높이·커서/scrollTop 확인. 숨은 노드 측정, 표시 시 무효화 제거를 각각 검출 |
| EP10 · `protocol.handle\|RENDERER_DIST\|pathToFileURL` | ① app URL 경로 해석·기존 root ② 파일 유무→자산/SPA fallback ③ net.fetch→실창 응답 | 신규 `app-protocol.fixture.test.ts` + S-D10a. 고유 내용의 실제 파일/없는 확장자 파일/SPA route/루트, 기존 URL 정책과 응답 본문 비교. 디스크 경계 목을 두지 않는다 |
| EP11 · `windowBounds\|readLegacySettings\|mirrorUiLocale\|flushLogSync\|flushSync\|closeLog` | ① 자체/legacy 읽기→언어·위치 승계 ② 창 close→유효 위치 저장·재시작 ③ file transport 정상 주기·회전→파일 ④ main의 장애/종료→flush·close | 기존 `shell-state.test.ts`, `shell-state-file.cwd.test.ts`, `file-transport.test.ts` 보강 + S-D10b/c. 전용 임시 userData, 정상/최소/최대 창, 불량 JSON, 쓰기 거부, 장애와 quit 직전 다른 순번의 마지막 행. 세대별 실제 파일과 순서 대조 |
| EP12 · `perf.stall\|UI_TASK_BUDGET_MS\|STALL_SEVERE_MS` | ① S-D 입력·설치본/진단 빌드·실제/주입 라벨 ② host·R·worker trace→표 ③ §19 인계표→W에서 같은 사례 조회 | 신규 진단 `measure-stage-d.test.mjs` + W 인계표. build ID·입력 크기를 바꾸거나 terminal-only와 주입 폭주 라벨을 맞바꿔 비교 불가가 드러나는지 확인 |

기준 트리에서 위 술어를 각각 실행한 원시 적중(줄/파일)은 Q20 639/88, EP2 131/31, EP3 69/21, Q28 94/34, EP5 15/11, Q30 38/14, EP7 18/9, EP8 25/9, EP9 41/15, EP10 10/2, EP11 49/12, EP12 19/11다. 타입·다른 화면을 포함한 검색량이며 검증할 자리는 표의 번호로 식별한다.

### Q20 파일 최신성 · 열린 폴더의 감시와 복구

**목록 자동 갱신은 두 Q20 선택에 공통이다.** data는 `cwd + 상대 디렉터리` 직속 항목을 비재귀 감시한다. 창은 활성 메뉴·폴더·세대 하나의 후보만 반영한다. 파일 내용만 바뀌어 이름·종류가 같으면 현재 선택과 스크롤 위치를 유지한다.

1. 메뉴를 열면 읽을 수 있는 현재 디렉터리 범위를 확인하고 감시를 붙인 뒤 첫 목록을 읽는다. 같은 위치의 여러 소비자는 하나의 감시 핸들을 공유한다. 목록을 읽는 중 사건이 오면 현재 읽기가 끝난 뒤 한 번 더 읽어서 처음 읽기와 구독 사이의 누락을 없앤다.
2. 변경 사건은 다시 읽으라는 신호다. 연속 사건을 묶고 동시에 한 번만 읽는다. rename의 old/new 순서나 OS가 준 파일명에 의존하지 않고 정렬한 새 디렉터리 이름·종류와 대조한다. 창은 현재 generation의 결과를 원자 교체하고 흩어진 과거 응답은 버린다.
3. 다시 열기·폴더 재진입·포커스 복귀·포트 재연결에서 디스크를 다시 확인한다. 감시 오류·경로 삭제/재생성 때는 활성 디렉터리만 제한 간격으로 재조회하고 감시 등록을 재시도한다. 새 감시가 정상화되면 복구용 타이머를 멈춘다. IPC 오류와 정상인 빈 디렉터리는 다음 갱신을 가로막지 않는다.
4. 다른 폴더·세션으로 이동, 메뉴 닫기·unmount, 창 포트 종료에 소비권을 해제한다. 마지막 소유자가 사라지면 watcher·타이머·대기 작업을 해제한다. 닫힌 이전 창/폴더의 늦은 결과는 새 선택과 `validFilePaths`를 덮을 수 없다.

**현재 포트와 설계 선택.** 기준 트리의 `oo:files:list`는 단발 요청이다(`shared/ipc.ts:62`, `handlers/files.ts:93–96`). 기존 `fingerprint-watch.ts`는 지정 파일을 폴링하며 이 메뉴의 폴더 이벤트 구독은 없다. 다음 두 배선에서 실시간 후보 갱신과 조회 트래픽을 각각 검증한다.

| 선택 | 변경 전달·정리 | 계측 |
|---|---|---|
| 추가 프로토콜 허용 시 | data가 활성 창에 디렉터리 revision 무효화만 알리는 구독/해제 설계안. 포트는 기존 `sender.onClosed` 수명에 결합한다. R은 통지 후 현 query를 다시 읽는다. 작은 결과용 prefix/limit 질의 채택 여부는 D-004에서 따로 정한다 | 파일명이 없는 사건·중복·창 두 개·마지막 구독 해제. raw 사건 수, 실제 재조회 횟수·응답 bytes |
| 기존 공개 API만 유지 시 | 메뉴가 열려 있는 동안만 R이 기존 `files.list`로 주기적으로 최신 스냅숏을 확인한다(설계값 1초, 동시 요청 최대 1개). data는 요청자별 사용 기한을 갱신하고 비재귀 watcher로 이름 집합을 무효화한다. 닫으면 R은 즉시 중지하고 host는 포트 종료 또는 마지막 요청 3초 후 감시 해제 | 키 입력 수와 독립적인 읽기, 대형 폴더의 반복 전송량·cache-hit 비용. 초과는 숨기지 않고 §19의 조회 분기에 귀속 |

감시 오류 시 재시도는 한 폴더에 타이머 하나, 초기 1초부터 최대 5초까지로 제한한다(Orca 설계값). 변경한 디렉터리 밖은 탐색하지 않는다. 화면이 재개되면 최신 응답으로 원본 목록을 교체한다. 제한된 8개 응답만으로 다른 파일의 삭제를 추론하지 않는다.

| 직접 oracle | 입력 → 관측 |
|---|---|
| F1 · 열린 메뉴 | 실제 임시 디렉터리에서 파일·폴더 생성→rename→삭제. 메뉴를 계속 연 상태로 기대 후보와 `validFilePaths` 차집합 ∅, 선택한 생존 ID 보존. 파일 감시 없는 폴백도 가상 시계로 동일 동작 확인 |
| F2 · 읽기 경합 | 최초 읽기 중 mutation, 연속 rename·중복·파일명 없는 신호, 원래 읽기가 늦게 해소되는 순서를 결정적으로 주입. 진행 중 읽기 ≤1, 갱신 완료 후 실제 `listDir`와 동일 |
| F3 · 장애 복구 | watcher 오류, 활성 폴더 삭제→동일 경로 재생성, 창 blur 중 변화→focus, read 실패→성공. 현재 목록과 재결합, 복구 뒤 타이머 정리. OS 사건 지연이 있는 실기와 가상 시계 단언을 분리 |
| F4 · 수명 | 창 둘이 같은 폴더 열기→한 창 닫기→다른 창 이동/포트 종료. 감시 핸들 공유·마지막 소비권 해제/기한 만료·이전 폴더 늦은 응답 격리. heartbeat 방식은 닫은 창의 추가 IPC 0 |
| F5 · 캐시와 필터 | 같은 메뉴에서 접두사/커서만 연속 변경한 경우 진행 중 조회를 공유. 점파일·symlink·8개 상한·9번째 유효 파일·다른 cwd·실패 후 다시 열기. D-004(가)는 받은 결과로 새 prefix를 충족할 수 없는 경우만 제한 질의 추가 |

기존 `useMentionAutocomplete.test.ts`의 prefix/caret 단일 요청은 유지하고, 빈 목록을 다시 열 때까지 영구 캐시하던 기대값은 변경한다. 휘발성 OS 타이밍만으로 PASS하지 않는다. F2~F4는 주입한 감시·시계·해제 사건으로 재생하고 F1은 실제 host/port/React 경로도 재생한다.

**Q20·Q28·Q30 계약 시안**. D-004(가)를 고른 뒤 기존 채널은 호환 경로로 둔다. 요청자는 필드와 어휘를 기존 소유자의 조회 의미에 맞춘다. 포트 재연결은 기존 등록·검증 경로를 재사용하며, 오래된 요청이 현재 선택을 덮어쓰지 않는다.

| 조회 | 요청/응답 요지 | 비교 기준과 예외 |
|---|---|---|
| Q20 | 입력 범위(cwd 및 디렉터리/하네스·카탈로그 종류), prefix·limit. 소유자가 정규화하고 최대 8개인 기존 파일·슬래시 결과를 넘김. 모델·plugin은 기존 전건 선택 또는 페이지로 추가 접근 | 원 디렉터리 노출·symlink 제외·숨김/정렬 보존. 전체 유효성 조회와 제안 결과 캐시 분리, cwd 밖 요청 거부. 기존 토큰/모델·plugin을 검색 상한으로 삭제하지 않는다 |
| Q28 | 종류·기존 검색 조건·필터·범위·opaque cursor·limit(제안 50행). 응답 items·stable ID·nextCursor. 서버 정렬 키와 동률 ID 사용, 고정·삭제는 해당 범위 revision을 무효화 | 쿼리/범위가 다른 cursor나 기한 만료 revision은 첫 페이지 재요청. 선택한 ID 보존, 삭제 시 기존 선택 해제. 변경 ID를 기존 notification에 추가해야 하면 구 소비자 허용 형태를 유지 |
| Q30 | 작업/실행 목록 요청과 `taskId + runId` 상세를 분리. 기존 최신 20회 범위 유지. 예시 발췌는 보관 tail의 마지막 1 KiB(UTF-8 경계), 저장 절단과 표시 발췌 여부를 분리 | 전체 열기는 DB에 남은 해당 실행의 출력까지만. 보존기간 만료는 기존 없음/재조회, 다른 task의 run은 미발견 처리. 목록 조회에서 숨은 전체 output의 DB 읽기·IPC 전송을 별도 계측 |

D-004(나)를 고르면 Q행 ①은 현행 조회 계약으로 시험하고, ②③은 창의 가시 영역·로컬 필터와 세대 격리를 시험한다. Q20 파일 최신성은 기존 API 배선의 F1~F5로 확인한다. 상한 초과 비용이 ①에 남으면 해당 AC에 잔여값을 기록하고 설계자에게 돌린다. 비슷한 응답이란 이유로 외부 계약을 바꾸지 않는다.

## 11. 구현 설계와 순서

| 단위 | 구현 지점과 절차 | 실험·잠금 |
|---|---|---|
| WU1 · 기준선 | S-D 스크립트에 fixture 입력 크기, 익명 ID, 시간/바이트/행 수 계측을 작성. 0325와 같은 설치본/진단 빌드 구분 | D 이전 빌드와 적용 후 빌드에 같은 입력을 재생. 실제 생산자가 없는 T32 부하만 진단 adapter |
| WU2 · T21 | `useAttachments`의 선택 미리보기와 전송용 산출을 구분. 배열 위치 기반 표시 key를 첨부 수명에 묶은 내부 ID로 옮긴다. 파일별 원본·송신 어휘는 유지. 워커에서 확인한 치수로 decode 예산을 예약한 뒤 JPEG 생성 | PNG IHDR, JPEG SOF, GIF 논리 화면/첫 frame, WebP VP8/VP8L/VP8X 캔버스와 첫 frame 치수 확인. 0327의 요청 ID·세대/취소·오래된 응답 폐기·우선순위 규약을 재사용. 이미지 결과는 장기 compute 캐시에 남기지 않는다 |
| WU3 · T24 | `PlanTileContent`가 본문 DOM과 오버레이 DOM의 ref를 구분. Markdown text node와 누적 UTF-16 end, node→offset을 revision/실제 DOM 교체별 구성. element 경계 선택도 자식 offset으로 환산. 이분 탐색으로 역방향 Range 구성 | scroll 컨테이너와 viewport의 교집합을 감시하고 문단별 가시 offset 범위를 유지. 주석과 겹친 가시 텍스트만 rect를 읽는다. 선택된 화면 밖 댓글은 먼저 해당 문단으로 이동한 뒤 rAF에서 측정 |
| WU4 · T20·T28·T30 | §19에서 전송·필터·마운트를 분리 후 D-004의 분기로 진행. (가)는 §10 Q행 계약과 실제 소유 프로세스/라우팅/기존 호출/문서를 한 변경으로 맞춘다. (나)는 기존 전체 질의를 유지하고 가시화/캐시와 Q20의 활성 폴더 재확인을 구현 | 한 행의 DB/sort 비용이 낮고 DOM mount가 비싸면 그 화면에서 host 변경을 생략. 호스트 이주 조건은 §19에 기록 |
| WU5 · T29·T31 | 설정 목록 소유자의 정렬 결과 재사용, 동일 모델 보존. 큰 JSON 검증만 초과하면 현재 codec의 import 규칙을 worker가 실행. 차트는 집계 자체가 초과할 때만 data에서 같은 day/week series를 만든다 | JSON 파서와 사용자 값 검증을 중복 구현하지 않는다. 모델 key·결측일·시간대·통화·주 시작을 기존 `stats.ts` 테스트와 독립 자료 양쪽으로 비교 |
| WU6 · T32 | 작업별 agent 로그 병합. 같은 step·progress의 연속 log만 묶고, 다른 상태/오류/완료 전 flush. R은 실행별 원문 조각·줄 offset을 담고 화면에는 읽는 위치 주변만 표현. 실행 중 archive의 앞부분도 스크롤로 접근 가능 | 메시지 모양은 기존 InstallStatus. 전체 보존을 위해 한 번에 문자열 재조립·출력하지 않는다. 분할된 줄·매우 긴 줄은 시각 조각으로 나누고 원문 순서 유지 |
| WU7 · T33·셸 | T33는 가시 두 입력의 CSS 기반 자연 높이(`field-sizing: content` 지원과 CSS 상한 실제 확인) 또는 visibility+폭·값 기반 단일 프레임 측정. 셸 자산은 실제 비용 확인 뒤 비동기 파일 조회 또는 빌드 자산 색인 선택. 레거시/창 닫기/종료는 독립 trace | CI의 Electron 버전에서 직접 렌더. CSS 경로로도 긴 입력 paint가 비싸면 §19에 분리 보고. 주기 쓰기만 원인일 때 로그 순서와 fatal flush를 유지하는 단일 writer 설계로 한정 |

**테스트 seam.** 날짜·정렬·cursor·로그 분할·픽셀 예산은 순수 모듈로 두어 `electron`이나 DB를 import하지 않고 경계값을 재생한다. 브라우저 진단 코드는 실제 worker와 실제 DOM/resize/scroll/IME를 통과시킨다. main 파일 복구는 실제 임시 디렉터리와 실제 파일 배선을 사용하고 데이터·실제 사용자 홈을 분리한다.

## 12. 종단 영향

파일 후보 감시는 data의 비재귀 watcher, 창별 수명은 host port의 `onClosed`, UI는 활성 메뉴에 둔다. 새 감시 통지·구독을 선택한 경우 해당 타입·소유자·정리 및 문서를 같은 변경에 포함한다.

등록 지점은 `shared/ipc.ts`, `shared/protocol.ts`, `shared/channel-owner.ts`, data/agent handler와 `renderer/src/shared/api/{transport/oo,ipc}.ts`다. D-004(가)의 새 공개 조회 승인 시 입력 Zod, 반환 타입, 라우터, 허용 포트, 취소/재연결, 구 호출 회귀를 서로 같은 채널로 시험하고 [IPC 정본](../../IPC_CONTRACT.md)을 같이 고친다. DB 스키마·기존 파일 형식·하네스 원본 전송은 현행 유지가 설계 기준이다.

T29는 기존 renderer에서 사용하는 v1 codec만 워커 경계로 전달하며 engine 선택·저장 소유자는 현재 경로를 쓴다. 팝오버·진행 상태는 소유자별 구독을 해제하고 컴포넌트나 preload 초기화를 앞당기지 않는다. 셸 종료 경로의 watcher·재시작·자산 lookup 실패는 프로토콜·트레이·로거의 기존 초기화 순서에서 실험한다.

## 13. 수명과 오류

| 시점 | 처리 |
|---|---|
| 첨부 제거·붙여넣기 경쟁·세션 전환 | 선택·전송에 서로 다른 생명주기 토큰을 쓰고 제거한 표시 결과는 폐기. 전송 스냅숏은 소유 세션·입력 순서를 유지. worker 실패·시간 초과·미지원 디코더는 attachment view에 미리보기 없이 settle. bitmap·blob URL·예약 픽셀·대기 슬롯 해제 |
| 페이지/설정 재요청 | cwd·프로젝트·정렬/필터·세대가 같은 결과만 사용. 실패/빈 결과/재시도 상태는 분리한다. 예전 전체 조회 응답은 기존 자료를 읽는 구 호출에서만 사용 |
| 계획 교체·숨김·주석 삭제 | 오래된 observer와 예약 frame 취소. 본문 교체 후 텍스트/offset이 맞지 않는 주석은 클릭 rect를 만들지 않는다. 선택/활성 ID는 기존 저장 의미를 따름 |
| 설치 재시작·다이얼로그 닫힘 | agent는 terminal 전 마지막 조각을 내보냄. 완료 콜백은 성공일 때 once. 구독 해제와 실행 세대 갱신으로 지난 실행 결과 폐기. 진행 중 닫기 금지와 기존 수동 설치 안내 보존 |
| 파일 접근·저장 실패 | 누락 자산의 index fallback과 복구 가능한 legacy read 실패는 현행대로. 로그 쓰기 거부는 기존 단발 emergency·비활성·기능 진행을 확인하고 기록 성공으로 세지 않는다 |

## 14. 수치와 비용 경계

- **이미지**. 설계용 예산은 워커당 원본 16,777,216 픽셀 이하, 창 단위 활성 ≤2건·합계 ≤25,165,824 픽셀이다. F4 두 장은 24,385,536픽셀이다. 원본 RGBA 환산 상한 약 96 MiB와 JPEG 결과는 디코더의 모든 임시 메모리 사용을 합한 값과 구분한다. 너비/높이 양의 정수, `width <= floor(remainingPixels/height)` 검사 후에만 예약한다.
- JPEG 등 가변 헤더는 워커에서 최대 256 KiB까지 읽는다. canvas/첫 frame 크기 검증 불가, 포맷 불일치, 초과는 **디코드 전 썸네일만 생략**한다. 실제 전송의 32 MiB·지원 MIME 검증은 기존 경로가 담당한다. 초안 표시에도 원본 data URL을 img로 바로 주지 않아 예산 우회를 막는다. 파일 이름·MIME·원본 내용을 첨부 스냅숏에 유지하며 실제 전송 가능 여부는 기존 전송기가 판정한다.
- **댓글**. 본문 revision별 text node 색인 O(N), offset 조회 O(log N), 재배치 때 실제 가시 텍스트와 겹치는 주석만 rect 측정. 긴 단일 주석도 화면 밖 문단까지 범위 전체를 순회하지 않는다. 같은 프레임에 observer·scroll·resize 통지가 여러 번 와도 측정 한 세트.
- **로그**. agent flush 제안은 16ms 또는 16 KiB 중 먼저 도달한 시점. 터미널 상태는 즉시 flush, 긴 단일 조각은 문자 경계로 분할. 창의 표시 예산은 200줄 또는 32 Ki UTF-16 단위 중 먼저 닿는 상한이고 긴 한 줄 안에서도 영역을 옮길 수 있다. 전체 보관 메모리는 실행 중 원문 크기에 비례하며 다음 실행/다이얼로그 수명 종료에 해제한다.
- **조건부 화면**. 기계 oracle은 ID·순서·필드·바이트/픽셀·DOM 수를 확인한다. §19의 Windows 실기에서 단일 동기 작업이 50ms 초과 또는 160ms 이상 정지를 보이면 실행 층에 귀속하고 원인 경로를 고친다. 그보다 작아도 끊기는 입력은 commit·layout/paint·연속 누락 원인을 남긴다. 이 값은 `shared/perf-budget.ts`의 조사 경계이고 W의 기기별 합격선을 대신하지 않는다.

## 15. 외부 포트와 문서

§10 Q행의 추가 질의는 사용자 승인과 실제 측정에서 필요가 확인된 채널만 확정한다. 외부 하네스 API, 디스크에 남기는 새 로그, 새 패키지 도입은 이 안에 들어가지 않는다. 브라우저에 포함된 API는 대상 Electron의 [Canvas 및 OffscreenCanvas 사양](https://html.spec.whatwg.org/multipage/canvas.html)과 실제 worker decode/encode 결과를 대조한다. 워커 초기화 실패 시 해당 요청은 파일 표시로 끝난다.

## 16. 기존 결정

0325 AC17·18의 실패 처리와 동시 작업 상한을 지키고, A의 AC19 기준선은 A 결과에 남긴다. 0327 D-008·D-024의 요청 세대와 실행 중 취소 정책을 이미지 작업에 맞춰 연동하되 C 코드/설계와 공유 파일이 바뀐 경우 그 지점만 최신 구현에 대조한다. 0326의 B 고정 위치·이력 소비와 E의 세션 페이지 도입은 D와 독립 검증한다. [실행 모델](../../arch/execution-model.md)과 main/renderer 계층 경계는 적용 상태다.

## 17. 리스크와 검증 경계

| 위험 | 판별/대응 |
|---|---|
| 모델/플러그인 검색의 단순 prefix화로 선택되던 항목이 사라짐 | 기존 종류별 검색·정렬과 전건 멤버십의 기대값을 독립 계산. 특히 9번째 후보 밖 완성 토큰과 직접 선택된 모델을 비교 |
| 긴 주석이나 큰 입력의 DOM 비용이 같은 프레임에 집중 | 본문 선두/끝, 범위 전체 주석과 여러 폭/배율 시험. M9는 CSS 레이아웃 분리값, 설치본의 입력→paint는 S-D9에서 측정 |
| 이미지 header만 작은 다중 프레임, worker 장애 또는 긴 decode | 물리 크기·첫 표시 frame 크기·컨테이너 일관성을 확인할 수 있는 형식만 썸네일 생성. 작업 종료/예산 회수·원본 송신을 테스트. 변환 대기와 UI 점유를 따로 기록 |
| 종료 시 비동기 쓰기 순서가 바뀌어 로그/상태가 사라짐 | 실제 파일에 다른 순번을 써 주기 직전·쓰기 중·close/장애 순서를 검증. 보장이 어려우면 종료/fatal의 현행 동기 경로 유지 |
| 조건부 측정 오인 | SSR로는 paint·레이아웃을 판단할 수 없다. T32 생산 로그 없음과 진단 부하, 소유 호스트 시간과 창 시간을 나누어 기록 |

## 18. 영향 파일과 산출물

| 범위 | 기준 트리에서 대조할 모듈 / 구현 때 갱신할 산출물 |
|---|---|
| 컴포저·워커 | `features/chat/hooks/{useAttachments,useMentionAutocomplete,useSkillAutocomplete}.ts`, `chat/lib/{attachmentViews,imageThumb,mentionAutocomplete}.ts`, common/composer의 `ComposerInputController.tsx`·`composerSubmit.ts`, `renderer/src/shared/compute` |
| 계획·입력 | `PlanTileContent.tsx`, `PlanCommentOverlay.tsx`, `PlanCommentPopover.tsx`, `usePlanCommentSelection.ts`, `planCommentDom.ts`, `AutoGrowTextarea.tsx`, `GeneralTab.tsx` |
| 목록·설정·예약·차트 | 세션 `navSections.ts`·`SearchModal.tsx`, 프로젝트 `ProjectsScreen.tsx`, 산출물 `ArtifactsView.tsx`·`artifactCatalogStore.ts`, `CustomizeList.tsx`, `EngineModelList.tsx`, `customProvider.ts`, `SchedulesScreen.tsx`·`RunHistory.tsx`, `UsageTab.tsx`·`TokensPerDayChart.tsx`, 관련 기존 data/agent handler |
| 설치·셸 | `main/app/handlers/misc.ts`, `main/infra/ipc/send.ts`, `InstallerDialog.tsx`, `main/index.ts`, `main/app/shell/shell-state{,-file}.ts`, `main/infra/log/{index,log-manager,file-transport}.ts` |
| 계약·문서 | §12 공유 타입·라우팅, 변경한 경우 `docs/IPC_CONTRACT.md`와 관련 현재 아키텍처. 구현자 보고·측정 요약은 이 계획 및 검증 문서, 디스패치 상태는 [INDEX](../INDEX.md) |

## 19. 게이트와 Windows 재현표

**설계**. 상대링크·Markdown 표·섹션·T행·보드 승격과 trailer를 확인한다. **구현**. `app/AGENTS.md` 기준 lint·typecheck, 새 테스트의 예산·호스트 격리, migration·inventory·naming·test-budget·process-boundary 가드, 필터 없는 vitest와 scripts 테스트, host boot/preload smoke를 CI 단계와 맞춘다. **검증**. §10 각 자리에서 직접 oracle과 등록 변이를 재생하고, 실제 저장 파일·UI 결과를 독립 비교한다.

**실기 공통**. [0325 §19](../0325-ui-responsiveness-followup/plan.md)의 동일 장비·주사율·배율·설치본/진단 빌드, 반복과 프레임 판정 규약을 사용한다. 동일 시나리오를 D 변경 전 마지막 기준과 D 적용 빌드에서 재생한다. 기준 SHA·장비·fixture·크기·반복별 입력/첫 paint·p95/최대·50ms 초과 작업·160ms 이상 정지·연속 프레임 누락·호스트 응답·React commit·layout/paint를 남긴다.

| ID | 재현 입력과 조작 | 구간과 결과 |
|---|---|---|
| S-D1 | 파일 2만 개, 숨김 포함. 열린 메뉴에서 생성·삭제·rename 확인, 감시 폴더 재생성·포커스 복귀·닫기 후 재개·하위 디렉터리 왕복, `@src` 연속 입력→Enter. 슬래시·plugin·모델 키보드 선택과 9번째 직접 토큰 장식 | 감시 수·갱신 지연·조회 횟수·포트 전송량 → R 필터 → 팝오버 paint·초점. §10 F1~F5 |
| S-D2 | 0325 F4 5장을 dialog/drop/paste로 각각 추가→즉시 전송. 전송 중 새 초안 입력·첨부 제거; 픽셀 경계·손상 1장 추가 | 선택 preview와 송신 preview의 source read·활성 픽셀/작업·decode/encode·버블 paint, 원본 순서·초안 |
| S-D3 | M3 2,000단락·128댓글에 같은 인용 2곳·본문 전체 댓글 추가. 폭 600→360→600px 드래그, 마지막 댓글을 목록에서 열기 | 색인 횟수/노드, 프레임별 rect 조회와 가시 ID, 선택 quote·실제 팝오버 위치 |
| S-D4 | M4 세션, 100프로젝트·1만 산출물. 고정/해제·페이지 경계 삭제·두 검색어·스니펫 선택 후 해당 대화 열기 | DB조회·IPC bytes·DOM 행·정렬/선택·원래 본문 검색 상한. 기존 경로에 전달된 세션 ID 기록 |
| S-D5 | M5 JSON, 문법 오류/미지원 npm, 같은 입력창에서 교정, 1만 자원 목록 필터·모델 선택 | parse·폼 commit·필터·최종 저장 값. 시간·크기만 기록 |
| S-D6 | 50회 이력을 가진 예약, 최근 20회 × 저장 tail 64KiB, 절단/빈/실패·다른 예약 지연 응답 | 목록·상세 DB 읽기와 IPC bytes·DOM·열린 run·저장 절단 표시 |
| S-D7 | 7·30·90·91·730일, 비어 있는 날과 730일 이전 내역 포함. 첫 표시·기간 변경·포인터 이동 | data 합산·R 파생·첫 commit·paint·도움말·표 합계 분리 |
| S-D8 | 실제 Claude 설치 진입(현재 terminal-only)과 **진단 어댑터**의 1만 줄(순번 0…9999)·65KiB 무개행·분할 줄·오류/완료를 각각 재생. 중간을 읽다 마지막으로 이동 | agent 원문/묶음 수·R commit·scrollTop/첫 가시 ID·terminal 전 마지막 출력. 운영 로그 수가 0인 실험은 진단 폭주 수치로 대체하지 않는다 |
| S-D9 | 일반 설정·댓글 입력에서 한글 2천·2만 자 붙여넣기·조합·삭제·폭 드래그·가림→다시 표시 | 입력→paint·실측 프레임/횟수·커서·보이는 마지막 줄·팝오버 위치 |
| S-D10a/b/c | a 자산 1,000요청(존재·누락·SPA 각각 구분). b 자체 상태 있음·없음/손상·최초 승계, 일반창/최소/최대 close→재실행. c 정상 주기·회전 경계·우아한 종료·격리된 진단 프로세스의 fatal | a main 조회/응답 분포·fallback, b 읽기/쓰기·재시작 언어/위치, c flush 소요·순번 보존을 **각각** 기록 |

**분기 판정**. S-D1/4/6은 변경 전 trace에서 어떤 구간이 시간 예산을 썼는지 먼저 확인한다. 호스트 조회가 필요한 항목만 승인된 D-004(가)로 진행하고, R 렌더만 비싸면 가시화로 제한한다. T29·31·33 및 셸도 경량 입력과 최대 입력을 같은 구성으로 비교해 `항목 / 입력 크기 / 측정값과 구간 / 유지·변경 / 잔여`를 남긴다. 준비되지 않은 Windows 결과는 미측정으로 적고 [0330 Windows 판정](../0330-windows-responsiveness-verdict/plan.md)에 원본 기록을 인계한다.

## READY self-review

- 계약 출처·제품 흐름·예외·AS-IS/TO-BE·기준 측정·9개 T행/셸 3항목·12개 AC를 대조했다. §3의 ACTIVE와 §7의 연결 및 D-004의 두 시나리오는 §5에 있다.
- V1 rev 3 초안은 4레벨·25쌍·§10 자리별 입력과 관측·구현/검증 기입란을 제공한다. Windows 결과 및 실제 구현 완료 수치 기입은 각 후속 턴의 책임이다.
- **READY 전 남은 결정은 D-004**다. 사용자가 가/나 또는 화면별 조합을 고르면 해당 Q행에 선택을 기록한다. 파일 후보는 §10의 감시·재조회 배선과 새 공개 통지 허용 여부까지 명시하고 사이트 목록·직접 oracle을 대조한 뒤 보드 상태를 갱신한다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …
- 착수 대조 — D-004 확정안과 §10, C 워커·B/E 공유 표면 및 §18의 기준 트리 차이: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | … | … | … | … | … |

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(verify 0회)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | … |
| **추가·수정 테스트의 subtree 규칙** | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |
